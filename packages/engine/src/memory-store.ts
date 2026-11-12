import { createRunSchema, runEventSchema, type Run, type RunEvent, type Step, type EventType } from '@orchestrator/shared';
import type { RunStore } from './contracts';
import { defaultRuntime, type EngineRuntime } from './runtime';

/** Session-only adapter. Snapshots and events never share mutable references. */
export class MemoryStore implements RunStore {
  private runs = new Map<string, Run>();
  private events = new Map<string, RunEvent[]>();
  private listeners = new Set<(event: RunEvent) => void>();
  constructor(private readonly runtime: EngineRuntime = defaultRuntime, private readonly maxRuns = 20) {}
  create(input: unknown, pricing: Run['pricing']): Run {
    const values = createRunSchema.parse(input);
    if (this.runs.size >= this.maxRuns) {
      const oldest = [...this.runs.values()].find(r => !['queued', 'running'].includes(r.status));
      if (!oldest) throw new Error('Session is full; wait for a task to finish.');
      this.runs.delete(oldest.id);
      this.events.delete(oldest.id);
    }
    const run: Run = { ...values, id: this.runtime.uuid(), pricing: structuredClone(pricing), mock: true,
      status: 'queued', result: null, error: null, createdAt: new Date(this.runtime.now()).toISOString(),
      startedAt: null, endedAt: null, latencyMs: null, promptTokens: 0, completionTokens: 0, costUsd: 0, steps: [], eventCursor: 0 };
    this.runs.set(run.id, run);
    this.events.set(run.id, []);
    return structuredClone(run);
  }
  private get(id: string) {
    const run = this.runs.get(id);
    if (!run) throw new Error('Run not found in this session. Start a new task.');
    return run;
  }
  async load(id: string) { return structuredClone(this.get(id)); }
  list() { return structuredClone([...this.runs.values()].reverse()); }
  replay(id: string, after: number) { this.get(id); return structuredClone((this.events.get(id) ?? []).filter(e => e.sequence > after)); }
  subscribe(listener: (event: RunEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  async start(id: string) {
    const run = this.get(id);
    if (run.status !== 'queued') return false;
    run.status = 'running';
    run.startedAt = new Date(this.runtime.now()).toISOString();
    await this.emit(id, 'run.started', null, { status: 'running' });
    return true;
  }
  async begin(step: Step) {
    this.get(step.runId).steps.push(structuredClone(step));
    await this.emit(step.runId, 'step.started', step.id, { step });
  }
  async finish(step: Step) {
    const run = this.get(step.runId);
    run.steps[run.steps.findIndex(s => s.id === step.id)] = structuredClone(step);
    run.promptTokens += step.promptTokens;
    run.completionTokens += step.completionTokens;
    // Mirror PostgreSQL numeric(14,8) rounding per completed call.
    run.costUsd = Number((run.costUsd + Number(step.costUsd.toFixed(8))).toFixed(8));
    await this.emit(step.runId, step.status === 'completed' ? 'step.completed' : 'step.failed', step.id, { step });
  }
  async end(id: string, values: Partial<Run>) {
    Object.assign(this.get(id), structuredClone(values));
    await this.emit(id, 'run.completed', null, { run: await this.load(id) });
    return this.load(id);
  }
  async emit(id: string, type: EventType, stepId: string | null, payload: RunEvent['payload']) {
    const run = this.get(id);
    const event = runEventSchema.parse({ runId: id, type, stepId, payload: structuredClone(payload),
      sequence: (run.eventCursor ?? 0) + 1, createdAt: new Date(this.runtime.now()).toISOString() });
    run.eventCursor = event.sequence;
    if (event.type === 'step.token') {
      const step = run.steps.find(s => s.id === stepId);
      if (step) { step.output += event.payload.chunk; step.completionTokens = event.payload.estimatedCompletionTokens; }
    }
    this.events.get(id)!.push(event);
    // Listener errors must not alter execution or accounting.
    for (const listener of this.listeners) { try { listener(structuredClone(event)); } catch { /* subscriber isolation */ } }
  }
}
