import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createRunSchema, filtersSchema, type HistoryResult } from '@orchestrator/shared';
import { z } from 'zod';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { source } from '../database/source';
import { PostgresStore } from '../events/store';
import { mockMode, pricing, redisUrl } from '../config';
import { RunEntity, StepEntity } from '../database/entities';
export const store = new PostgresStore(source);
export const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
export const queue = new Queue('runs', { connection: new Redis(redisUrl, { maxRetriesPerRequest: null }) });
export function validate<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data;
}
export async function getRun(id: string) {
  validate(z.string().uuid(), id);
  try { return await store.load(id); } catch (error) { if (error instanceof Error && error.name === 'EntityNotFoundError') throw new NotFoundException('Run not found'); throw error; }
}
export async function createRun(body: unknown) {
  const parsed = validate(createRunSchema, body);
  const run = await store.create({ ...parsed, pricing, mock: mockMode });
  // Queued rows are reconciled periodically if the process dies before this enqueue.
  await queue.add('execute', { runId: run.id }, { jobId: run.id }); return run;
}
export async function reconcileQueue() {
  const runs = await source.getRepository(RunEntity).find({ where: { status: 'queued' }, take: 100, order: { createdAt: 'ASC' } });
  for (const run of runs) await queue.add('execute', { runId: run.id }, { jobId: run.id });
}
export async function history(query: unknown): Promise<HistoryResult> {
  const f = validate(filtersSchema, query);
  const qb = source.getRepository(RunEntity).createQueryBuilder('r');
  if (f.status) qb.andWhere('r.status=:status', { status: f.status });
  if (f.from) qb.andWhere('r."createdAt">=:from', { from: f.from });
  if (f.to) qb.andWhere('r."createdAt"<=:to', { to: f.to });
  if (f.model) qb.andWhere('EXISTS (SELECT 1 FROM steps s WHERE s."runId"=r.id AND s.model=:model)', { model: f.model });
  const matching = qb.clone().select('r.id');
  const stats = await source.getRepository(StepEntity).createQueryBuilder('s')
    .select('s.model', 'model').addSelect('COUNT(*)::int', 'calls').addSelect('AVG(s."costUsd")::float8', 'avgCostUsd').addSelect('AVG(s."latencyMs")::float8', 'avgLatencyMs')
    .where(`s."runId" IN (${matching.getQuery()})`).setParameters(matching.getParameters()).andWhere('s.status=:stepStatus', { stepStatus: 'completed' })
    .groupBy('s.model').orderBy('s.model').getRawMany();
  if (f.cursor) {
    let cursor: { at: string; id: string };
    try { cursor = z.object({ at: z.string().datetime(), id: z.string().uuid() }).parse(JSON.parse(Buffer.from(f.cursor, 'base64url').toString())); }
    catch { throw new BadRequestException('Invalid pagination cursor'); }
    qb.andWhere('(r."createdAt",r.id)<(:at,:id)', cursor);
  }
  const rows = await qb.orderBy('r."createdAt"', 'DESC').addOrderBy('r.id', 'DESC').take(f.limit + 1).getMany();
  const items = rows.slice(0, f.limit).map(r => ({ ...r, steps: [] }));
  const last = items.at(-1);
  return { items: JSON.parse(JSON.stringify(items)), nextCursor: rows.length > f.limit && last ? Buffer.from(JSON.stringify({ at: new Date(last.createdAt).toISOString(), id: last.id })).toString('base64url') : null, models: stats };
}
