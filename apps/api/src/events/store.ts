import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { EventType, Run, RunEvent, Step } from '@orchestrator/shared';
import { runEventSchema } from '@orchestrator/shared';
import { RunEntity, StepEntity } from '../database/entities';
import type { RunStore } from '../orchestration/contracts';
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export class PostgresStore implements RunStore {
  constructor(readonly db: DataSource) {
  }
  async load(id: string): Promise<Run> {
    return this.db.transaction('REPEATABLE READ', async (tx) => {
      const run = await tx.getRepository(RunEntity).findOneByOrFail({ id });
      run.steps = await tx.getRepository(StepEntity).find({ where: { runId: id }, order: { startedAt: 'ASC', id: 'ASC' } });
      const [row] = await tx.query('SELECT "eventSequence" FROM runs WHERE id=$1', [id]);
      return plain({ ...run, eventCursor: row.eventSequence });
    });
  }
  async start(id: string) {
    const result = await this.db.getRepository(RunEntity).createQueryBuilder().update().set({ status: 'running', startedAt: () => 'now()' }).where('id=:id AND status=:status', { id, status: 'queued' }).execute();
    if (!result.affected)
      return false;
    await this.emit(id, 'run.started', null, { status: 'running' });
    return true;
  }
  async begin(step: Step) {
    await this.db.transaction(async (tx) => {
      // TypeORM insert can merge raw Postgres RETURNING decimals into the supplied object.
      // Keep the domain event numeric and independent of persistence-side mutation.
      await tx.createQueryBuilder().insert().into(StepEntity).values(step).updateEntity(false).execute();
      await this.event(tx, step.runId, 'step.started', step.id, { step });
    });
  }
  async finish(step: Step) {
    await this.db.transaction(async (tx) => {
      await tx.getRepository(StepEntity).update(step.id, step);
      await tx.query('UPDATE runs SET "promptTokens"="promptTokens"+$2, "completionTokens"="completionTokens"+$3, "costUsd"="costUsd"+$4 WHERE id=$1', [step.runId, step.promptTokens, step.completionTokens, step.costUsd]);
      await this.event(tx, step.runId, step.status === 'completed' ? 'step.completed' : 'step.failed', step.id, { step });
    });
  }
  async end(id: string, values: Partial<Run>) {
    return this.db.transaction(async (tx) => {
      await tx.getRepository(RunEntity).update(id, values);
      const run = plain({
        ...await tx.getRepository(RunEntity).findOneByOrFail({ id }), steps: await tx.getRepository(StepEntity).find({ where: { runId: id }, order: { startedAt: 'ASC' } })
      });
      await this.event(tx, id, 'run.completed', null, { run });
      return run;
    });
  }
  private async event(tx: import('typeorm').EntityManager, id: string, type: EventType, stepId: string | null, payload: RunEvent['payload']) {
    await tx.query('UPDATE runs SET "eventSequence"="eventSequence"+1 WHERE id=$1', [id]);
    const [row] = await tx.query('SELECT "eventSequence" FROM runs WHERE id=$1', [id]);
    const event = runEventSchema.parse({
      runId: id, sequence: row.eventSequence, type, stepId, payload, createdAt: new Date().toISOString()
    });
    await tx.query('INSERT INTO run_events ("runId",sequence,type,"stepId",payload,"createdAt") VALUES ($1,$2,$3,$4,$5,$6)', [id, event.sequence, type, stepId, JSON.stringify(event.payload), event.createdAt]);
  }
  async emit(id: string, type: EventType, stepId: string | null, payload: RunEvent['payload']) {
    await this.db.transaction(tx => this.event(tx, id, type, stepId, payload));
  }
  async replay(id: string, after: number, limit = 2000): Promise<RunEvent[]> {
    return this.db.query('SELECT "runId",sequence,type,"stepId",payload,"createdAt" FROM run_events WHERE "runId"=$1 AND sequence>$2 ORDER BY sequence LIMIT $3', [id, after, limit]);
  }
  async create(values: Pick<Run, 'task' | 'agentConfig' | 'maxCostUsd' | 'pricing' | 'mock'>) {
    const run: Run = {
      ...values, id: randomUUID(), status: 'queued', result: null, error: null, createdAt: new Date().toISOString(), startedAt: null, endedAt: null, latencyMs: null, promptTokens: 0, completionTokens: 0, costUsd: 0, steps: []
    };
    const { steps: _steps, ...record } = run;
    await this.db.getRepository(RunEntity).insert(record);
    return run;
  }
}
