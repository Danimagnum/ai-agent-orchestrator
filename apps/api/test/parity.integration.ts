import { afterAll, beforeAll, expect, it } from 'vitest';
import { MemoryStore, MockProvider, Orchestrator, type RunStore, type EngineRuntime } from '@orchestrator/engine';
import type { RunEvent } from '@orchestrator/shared';
import { source } from '../src/database/source';
import { PostgresStore } from '../src/events/store';
import { pricing } from '../src/config';

beforeAll(async () => { await source.initialize(); await source.runMigrations(); });
afterAll(async () => { if (source.isInitialized) await source.destroy(); });

function runtime(prefix: string): EngineRuntime {
  let id = 0;
  return { now: () => Date.parse('2026-01-01T00:00:00Z'), uuid: () => prefix + String(++id).padStart(12, '0') };
}
/** Serial adapter boundaries make DB latency irrelevant to the schedule under test.
 * Calls still run concurrently; only persisted operations are ordered, like a single connection.
 */
function serial(store: RunStore): RunStore {
  let tail = Promise.resolve<unknown>(undefined);
  return Object.fromEntries(['load', 'start', 'begin', 'finish', 'end', 'emit'].map(method => [method, (...args: unknown[]) => {
    const task = tail.then(async () => {
      const value = await (store[method as keyof RunStore] as (...args: unknown[]) => Promise<unknown>).apply(store, args);
      // Both adapters cross a macrotask boundary, giving concurrent provider
      // continuations the same scheduling opportunities regardless of DB latency.
      await new Promise(resolve => setTimeout(resolve, 0));
      return value;
    });
    tail = task.catch(() => undefined);
    return task;
  }])) as unknown as RunStore;
}
function normalized(events: RunEvent[]) {
  // IDs and wall-clock timestamps belong to adapters; compare the full causal stream,
  // including every token chunk and all accounting at DB numeric precision.
  const ids = new Map<string, string>();
  let count = 0;
  return events.map(event => JSON.parse(JSON.stringify(event, (key, value: unknown) => {
    if (['createdAt', 'startedAt', 'endedAt', 'eventCursor'].includes(key)) return undefined;
    if (key === 'steps' && Array.isArray(value)) return [...value].sort((a, b) => a.id.localeCompare(b.id));
    if (['id', 'runId', 'stepId', 'parentStepId'].includes(key) && typeof value === 'string') {
      if (!ids.has(value)) ids.set(value, `id-${++count}`);
      return ids.get(value);
    }
    return key === 'costUsd' && typeof value === 'number' ? value.toFixed(8) : value;
  })));
}

for (const task of ['Plan a landing page for a coffee shop', 'Compare Kafka vs RabbitMQ for a real-time game backend [retry]', 'Design an onboarding flow for a collaborative notes app']) {
  it(`matches the PostgreSQL worker event sequence: ${task}`, async () => {
    const input = { task, maxCostUsd: 0.5 };
    const memory = new MemoryStore();
    if (process.env.PARITY_MUTATION === '1') {
      const finish = memory.finish.bind(memory);
      memory.finish = step => finish({ ...step, promptTokens: step.promptTokens + 1 });
    }
    const postgres = new PostgresStore(source);
    const a = memory.create(input, pricing);
    const b = await postgres.create({ ...a, pricing, mock: true });
    const options = { timeoutMs: 45000, backoffMs: 0, maxRetries: 2 };
    const prefix = globalThis.crypto.randomUUID().slice(0, 24);
    try {
      const left = await new Orchestrator(serial(memory), new MockProvider(0), options, runtime(prefix)).execute(a.id);
      const right = await new Orchestrator(serial(postgres), new MockProvider(0), options, runtime(prefix)).execute(b.id);
      expect(left.status).toBe('completed');
      expect(right.status).toBe('completed');
      const actual = await postgres.replay(b.id, 0);
      expect(actual.map(e => e.sequence)).toEqual(actual.map((_, i) => i + 1));
      expect(normalized(memory.replay(a.id, 0)), 'Browser/worker parity').toEqual(normalized(actual));
      expect(left.result).toEqual(right.result);
      expect(left.costUsd.toFixed(8)).toEqual(right.costUsd.toFixed(8));
    } finally {
      // No table truncation: clean only the run created by this test.
      await source.query('DELETE FROM run_events WHERE "runId"=$1', [b.id]);
      await source.query('DELETE FROM steps WHERE "runId"=$1', [b.id]);
      await source.query('DELETE FROM runs WHERE id=$1', [b.id]);
    }
  });
}
