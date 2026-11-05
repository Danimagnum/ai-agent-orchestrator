import { EntitySchema } from 'typeorm';
import type { Run, Step } from '@orchestrator/shared';
const decimal = {
  type: 'numeric' as const, precision: 14, scale: 8, default: 0, transformer: { to: (v: number) => v, from: (v: string) => Number(v) }
};
export const RunEntity = new EntitySchema<Run>({
  name: 'Run', tableName: 'runs', columns: {
    id: { type: 'uuid', primary: true }, task: { type: 'text' }, status: { type: 'varchar' },
    agentConfig: { type: 'jsonb' }, pricing: { type: 'jsonb' }, mock: { type: 'boolean' }, maxCostUsd: decimal,
    result: { type: 'text', nullable: true }, error: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz' }, startedAt: { type: 'timestamptz', nullable: true }, endedAt: { type: 'timestamptz', nullable: true },
    latencyMs: { type: 'integer', nullable: true }, promptTokens: { type: 'integer', default: 0 }, completionTokens: { type: 'integer', default: 0 }, costUsd: decimal,
  }
});
export const StepEntity = new EntitySchema<Step>({
  name: 'Step', tableName: 'steps', columns: {
    id: { type: 'uuid', primary: true }, runId: { type: 'uuid' }, parentStepId: { type: 'uuid', nullable: true },
    agent: { type: 'varchar' }, model: { type: 'varchar' }, provider: { type: 'varchar' }, attempt: { type: 'integer' },
    input: { type: 'text' }, output: { type: 'text' }, status: { type: 'varchar' },
    startedAt: { type: 'timestamptz' }, endedAt: { type: 'timestamptz', nullable: true }, latencyMs: { type: 'integer', nullable: true },
    promptTokens: { type: 'integer', default: 0 }, completionTokens: { type: 'integer', default: 0 }, costUsd: decimal,
    error: { type: 'text', nullable: true },
  }
});
