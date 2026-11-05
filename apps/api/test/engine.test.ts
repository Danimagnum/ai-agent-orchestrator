import { describe, expect, it, vi } from 'vitest';
import { defaultAgentConfig, type EventType, type Run, type RunEvent, type Step } from '@orchestrator/shared';
import { Orchestrator } from '../src/orchestration/engine';
import type { Call, LLMProvider, RunStore } from '../src/orchestration/contracts';
import { MockProvider } from '../src/providers/mock';
import { ProviderError } from '../src/providers/sse';
import { pricing } from '../src/config';
class MemoryStore implements RunStore {
  events: { type: EventType; stepId: string | null; payload: RunEvent['payload'] }[] = [];
  run: Run = { id: 'test', task: 'Plan a landing page for a coffee shop', agentConfig: defaultAgentConfig, pricing, maxCostUsd: 0.5, mock: true, status: 'queued', result: null, error: null, createdAt: new Date().toISOString(), startedAt: null, endedAt: null, latencyMs: null, promptTokens: 0, completionTokens: 0, costUsd: 0, steps: [] };
  async load() { return structuredClone(this.run); }
  async start() { if (this.run.status !== 'queued') return false; this.run.status = 'running'; this.run.startedAt = new Date().toISOString(); await this.emit('', 'run.started', null, { status: 'running' }); return true; }
  async begin(step: Step) { this.run.steps.push(structuredClone(step)); await this.emit('', 'step.started', step.id, { step: structuredClone(step) }); }
  async finish(step: Step) {
    this.run.steps[this.run.steps.findIndex(s => s.id === step.id)] = structuredClone(step);
    this.run.costUsd += step.costUsd; this.run.promptTokens += step.promptTokens; this.run.completionTokens += step.completionTokens;
    await this.emit('', step.status === 'completed' ? 'step.completed' : 'step.failed', step.id, { step: structuredClone(step) });
  }
  async end(_id: string, values: Partial<Run>) { Object.assign(this.run, values); await this.emit('', 'run.completed', null, { run: await this.load() }); return this.load(); }
  async emit(_id: string, type: EventType, stepId: string | null, payload: RunEvent['payload']) { this.events.push({ type, stepId, payload }); }
}
const options = { timeoutMs: 1000, backoffMs: 0, maxRetries: 2 };
function setup(provider: LLMProvider = new MockProvider(0)) { const store = new MemoryStore(); return { store, engine: new Orchestrator(store, provider, options) }; }
describe('orchestration', () => {
  it('delegates, streams, synthesizes, reviews and accounts for every call', async () => {
    const { store, engine } = setup(); const run = await engine.execute('test');
    expect(run.status).toBe('completed'); expect(run.steps).toHaveLength(6); expect(run.result).toContain('coffee');
    const root = run.steps.find(s => !s.parentStepId)!;
    expect(run.steps.filter(s => ['Researcher', 'Writer', 'Coder'].includes(s.agent)).every(s => s.parentStepId === root.id)).toBe(true);
    expect(run.costUsd).toBeCloseTo(run.steps.reduce((n, s) => n + s.costUsd, 0));
    expect(run.completionTokens).toBe(run.steps.reduce((n, s) => n + s.completionTokens, 0));
    expect(store.events[0]?.type).toBe('run.started'); expect(store.events.at(-1)?.type).toBe('run.completed');
    expect(store.events.some(e => e.type === 'step.token')).toBe(true);
    expect(run.steps.every(s => s.latencyMs !== null && s.endedAt)).toBe(true);
  });
  it('allows one Director-requested correction', async () => {
    const { store, engine } = setup(); store.run.task += ' [retry]'; const run = await engine.execute('test');
    expect(run.status).toBe('completed'); expect(run.steps.filter(s => s.agent === 'Reviewer')).toHaveLength(2);
    expect(run.steps).toHaveLength(9);
  });
  it('fails after a second rejection without another correction', async () => {
    const mock = new MockProvider(0);
    const { engine } = setup({ complete: async (...args) => {
      const result = await mock.complete(...args);
      if (args[0].agent === 'Reviewer') result.toolCalls = [{ name: 'review', arguments: { approved: false, feedback: 'Fix it' } }];
      return result;
    } });
    const run = await engine.execute('test'); expect(run.status).toBe('failed'); expect(run.steps.filter(s => s.agent === 'Reviewer')).toHaveLength(2);
  });
  it('refuses provider calls when the reservation cannot fit', async () => {
    const complete = vi.fn(); const { store, engine } = setup({ complete }); store.run.maxCostUsd = 0.000001;
    const run = await engine.execute('test'); expect(run.status).toBe('budget_exceeded'); expect(complete).not.toHaveBeenCalled();
  });
  it('stops after authoritative usage exceeds the budget', async () => {
    const mock = new MockProvider(0); const { engine } = setup({ complete: async (...args) => ({ ...await mock.complete(...args), completionTokens: 1000000 }) });
    const run = await engine.execute('test'); expect(run.status).toBe('budget_exceeded'); expect(run.steps).toHaveLength(1);
  });
  it('retries transient HTTP failures with separate trace steps', async () => {
    const mock = new MockProvider(0); let failures = 0;
    const { engine } = setup({ complete: async (...args) => { if (failures++ < 2) throw new ProviderError('Provider HTTP 429', true); return mock.complete(...args); } });
    const run = await engine.execute('test'); expect(run.status).toBe('completed'); expect(run.steps.slice(0, 3).map(s => s.attempt)).toEqual([1, 2, 3]);
    expect(run.steps.filter(s => s.status === 'failed')).toHaveLength(2);
  });
  it('does not retry a partially streamed response', async () => {
    const complete = vi.fn(async (_call, chunk) => { await chunk('partial'); throw new ProviderError('Provider HTTP 503', true); });
    const { engine } = setup({ complete }); const run = await engine.execute('test');
    expect(run.status).toBe('failed'); expect(complete).toHaveBeenCalledTimes(1); expect(run.steps[0]?.output).toBe('partial');
  });
  it('rejects invalid delegation tool arguments', async () => {
    const { engine } = setup({ complete: async () => ({ text: '', toolCalls: [{ name: 'delegate', arguments: { subtasks: [{ agent: 'Hacker', task: 'bad' }] } }], promptTokens: 10, completionTokens: 10 }) });
    expect((await engine.execute('test')).status).toBe('failed');
  });
  it('aborts a timed-out call and records its conservative cost', async () => {
    const store = new MemoryStore(); const provider: LLMProvider = { complete: (_c, _chunk, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) };
    const run = await new Orchestrator(store, provider, { ...options, timeoutMs: 10 }).execute('test');
    expect(run.status).toBe('failed'); expect(run.steps[0]?.costUsd).toBeGreaterThan(0); expect(run.steps[0]?.status).toBe('failed');
  });
  it('does not re-execute a completed run', async () => {
    const complete = vi.fn(); const { store, engine } = setup({ complete }); store.run.status = 'completed';
    await engine.execute('test'); expect(complete).not.toHaveBeenCalled();
  });
  it('honors per-agent model configuration', async () => {
    const mock = new MockProvider(0); const calls: Call[] = [];
    const { store, engine } = setup({ complete: async (...args) => { calls.push(args[0]); return mock.complete(...args); } });
    store.run.agentConfig.Coder = 'claude-sonnet-4-20250514'; await engine.execute('test');
    expect(calls.find(c => c.agent === 'Coder')?.model).toBe('claude-sonnet-4-20250514');
  });
});
