import { z } from 'zod';
export const agents = ['Director', 'Researcher', 'Writer', 'Coder', 'Reviewer'] as const;
export type Agent = typeof agents[number];
export const statusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'budget_exceeded']);
export type Status = z.infer<typeof statusSchema>;
export const modelSchema = z.enum(['gpt-4.1-mini', 'gpt-4.1', 'claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001']);
export type Model = z.infer<typeof modelSchema>;
export const agentConfigSchema = z.object({
  Director: modelSchema.default('gpt-4.1-mini'), Researcher: modelSchema.default('claude-haiku-4-5-20251001'),
  Writer: modelSchema.default('claude-sonnet-4-20250514'), Coder: modelSchema.default('gpt-4.1'), Reviewer: modelSchema.default('gpt-4.1-mini'),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export const defaultAgentConfig = agentConfigSchema.parse({});
export const createRunSchema = z.object({
  task: z.string().trim().min(8).max(4000), maxCostUsd: z.number().min(0.001).max(5).default(0.5), agentConfig: agentConfigSchema.default({})
}).strict();
export const filtersSchema = z.object({
  status: statusSchema.optional(), model: modelSchema.optional(),
  from: z.string().datetime().optional(), to: z.string().datetime().optional(),
  cursor: z.string().max(300).optional(), limit: z.coerce.number().int().min(1).max(50).default(20),
}).refine(v => !v.from || !v.to || v.from <= v.to, { message: 'from must precede to' });
export const delegationSchema = z.object({
  subtasks: z.array(z.object({ agent: z.enum(['Researcher', 'Writer', 'Coder']), task: z.string().min(1).max(3000) }).strict()).min(1).max(3)
}).strict();
export const reviewSchema = z.object({ approved: z.boolean(), feedback: z.string().max(4000) }).strict();
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}
export interface Step extends Usage {
  id: string;
  runId: string;
  parentStepId: string | null;
  agent: Agent;
  model: Model;
  provider: string;
  attempt: number;
  input: string;
  output: string;
  status: Status;
  startedAt: string;
  endedAt: string | null;
  latencyMs: number | null;
  error: string | null;
}
export interface Run extends Usage {
  id: string;
  task: string;
  status: Status;
  agentConfig: AgentConfig;
  maxCostUsd: number;
  pricing: Record<string, {
    input: number;
    output: number;
  }>;
  mock: boolean;
  result: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  latencyMs: number | null;
  steps: Step[];
  eventCursor?: number;
}
type EventPayloads = {
  'run.started': {
    status: 'running';
  };
  'step.started': {
    step: Step;
  };
  'step.token': {
    chunk: string;
    estimatedCompletionTokens: number;
  };
  'step.completed': {
    step: Step;
  };
  'step.failed': {
    step: Step;
  };
  'run.completed': {
    run: Run;
  };
};
export type RunEvent = {
  [K in keyof EventPayloads]: {
    runId: string;
    sequence: number;
    type: K;
    stepId: string | null;
    createdAt: string;
    payload: EventPayloads[K];
  };
}[keyof EventPayloads];
export type EventType = RunEvent['type'];
export interface HistoryResult {
  items: Run[];
  nextCursor: string | null;
  models: {
    model: Model;
    calls: number;
    avgCostUsd: number;
    avgLatencyMs: number;
  }[];
}
const usageFields = {
  promptTokens: z.number().int().nonnegative(), completionTokens: z.number().int().nonnegative(), costUsd: z.number().finite().nonnegative()
};
export const stepSchema = z.object({
  id: z.string().uuid(), runId: z.string().uuid(), parentStepId: z.string().uuid().nullable(),
  agent: z.enum(agents), model: modelSchema, provider: z.string(), attempt: z.number().int().positive(),
  input: z.string(), output: z.string(), status: statusSchema,
  startedAt: z.string().datetime(), endedAt: z.string().datetime().nullable(), latencyMs: z.number().nonnegative().nullable(),
  error: z.string().nullable(), ...usageFields,
});
export const runSnapshotSchema = z.object({
  id: z.string().uuid(), task: z.string(), status: statusSchema, agentConfig: agentConfigSchema,
  maxCostUsd: z.number().finite().positive(), pricing: z.record(z.object({ input: z.number().nonnegative(), output: z.number().nonnegative() })),
  mock: z.boolean(), result: z.string().nullable(), error: z.string().nullable(),
  createdAt: z.string().datetime(), startedAt: z.string().datetime().nullable(), endedAt: z.string().datetime().nullable(),
  latencyMs: z.number().nonnegative().nullable(), steps: z.array(stepSchema), eventCursor: z.number().int().nonnegative().optional(), ...usageFields,
});
const envelope = z.object({
  runId: z.string().uuid(), sequence: z.number().int().positive(), stepId: z.string().uuid().nullable(), createdAt: z.string().datetime()
});
export const runEventSchema = z.discriminatedUnion('type', [
  envelope.extend({ type: z.literal('run.started'), payload: z.object({ status: z.literal('running') }) }),
  envelope.extend({ type: z.literal('step.started'), payload: z.object({ step: stepSchema }) }),
  envelope.extend({
    type: z.literal('step.token'), payload: z.object({ chunk: z.string(), estimatedCompletionTokens: z.number().int().nonnegative() })
  }),
  envelope.extend({ type: z.literal('step.completed'), payload: z.object({ step: stepSchema }) }),
  envelope.extend({ type: z.literal('step.failed'), payload: z.object({ step: stepSchema }) }),
  envelope.extend({ type: z.literal('run.completed'), payload: z.object({ run: runSnapshotSchema }) }),
]);
