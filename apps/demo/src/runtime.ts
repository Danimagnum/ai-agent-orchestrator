import { MemoryStore, MockProvider, Orchestrator } from '@orchestrator/engine';
import pricing from '../../../config/model-pricing.json';

export const store = new MemoryStore();
export function startTask(body: unknown) {
  if (store.list().some(run => ['queued', 'running'].includes(run.status)))
    throw new Error('Ya hay una tarea en marcha. Puedes seguirla desde el historial.');
  const run = store.create(body, pricing);
  window.setTimeout(() => { void new Orchestrator(store, new MockProvider(45)).execute(run.id); }, 0);
  return run;
}
