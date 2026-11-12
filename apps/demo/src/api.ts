import { filtersSchema, type HistoryResult } from '@orchestrator/shared';
import { startTask, store } from './runtime';
export { money, duration, modelLabel } from '../../web/lib/format';

/** Explicit in-process adapter for shared UI. No fetch, WebSocket or persistence. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (init?.signal?.aborted) throw new Error('Aborted');
  const url = new URL(path, 'https://browser.invalid');
  let result: unknown;
  if (url.pathname === '/health') result = { mode: 'mock' };
  else if (url.pathname === '/runs' && init?.method === 'POST') result = startTask(JSON.parse(String(init.body)));
  else if (url.pathname === '/runs') {
    const filters = filtersSchema.parse(Object.fromEntries(url.searchParams));
    const runs = store.list().filter(r => (!filters.status || r.status === filters.status)
      && (!filters.model || r.steps.some(s => s.model === filters.model))
      && (!filters.from || r.createdAt >= filters.from) && (!filters.to || r.createdAt <= filters.to));
    const offset = Number(filters.cursor ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid cursor');
    const models: HistoryResult['models'] = [];
    for (const model of new Set(runs.flatMap(r => r.steps.filter(s => s.status === 'completed').map(s => s.model)))) {
      const steps = runs.flatMap(r => r.steps.filter(s => s.model === model && s.status === 'completed'));
      models.push({ model, calls: steps.length, avgCostUsd: steps.reduce((n, s) => n + s.costUsd, 0) / steps.length,
        avgLatencyMs: steps.reduce((n, s) => n + (s.latencyMs ?? 0), 0) / steps.length });
    }
    result = { items: runs.slice(offset, offset + filters.limit), nextCursor: offset + filters.limit < runs.length ? String(offset + filters.limit) : null, models };
  } else if (/^\/runs\/[^/]+$/.test(url.pathname)) result = await store.load(decodeURIComponent(url.pathname.slice(6)));
  else throw new Error('Unsupported browser operation');
  return result as T;
}
