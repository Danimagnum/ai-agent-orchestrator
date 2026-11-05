import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { waitForReady } from './readiness.mjs';
const { console, fetch, AbortSignal } = globalThis;
const api = process.env.DEMO_API_URL ?? 'http://localhost:4000';
const web = process.env.DEMO_WEB_URL ?? 'http://localhost:3000';
async function request(path, init) {
  const response = await fetch(`${api}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.json();
}
async function main() {
  const health = await waitForReady(() => request('/health'), 'API');
  assert.equal(health.mode, 'mock', 'Container smoke test requires MOCK_LLM=true');
  const ui = await waitForReady(async () => {
    const response = await fetch(web, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200);
    return response;
  }, 'Web');
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /One task/);
  const queued = await request('/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'Plan a landing page for a coffee shop' }) });
  let run;
  for (let i = 0; i < 120; i++) {
    run = await request(`/runs/${queued.id}`);
    if (!['queued', 'running'].includes(run.status)) break;
    await delay(250);
  }
  assert.equal(run.status, 'completed', run.error ?? 'Worker did not complete the run');
  assert.equal(run.steps.length, 6);
  assert.ok(run.costUsd > 0 && run.result.includes('Acceptance criteria'));
  const events = await request(`/runs/${run.id}/events`);
  assert.ok(events.some(event => event.type === 'step.token'));
  assert.equal(events.at(-1).type, 'run.completed');
  assert.deepEqual(events.map(event => event.sequence), events.map((_, index) => index + 1));
  for (const event of events) if (event.payload.step) assert.equal(typeof event.payload.step.costUsd, 'number');
  console.log(JSON.stringify({ status: 'passed', runId: run.id, steps: run.steps.length, events: events.length, costUsd: run.costUsd }));
}
main().catch(error => { console.error(`Compose smoke failed: ${error.message}. Start the stack with docker compose up --build --wait.`); process.exitCode = 1; });
