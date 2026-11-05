import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { URL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { waitForReady } from './readiness.mjs';
const { fetch, console, setTimeout, clearTimeout, AbortSignal } = globalThis;
const requireWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { io } = requireWeb('socket.io-client');
const { values } = parseArgs({ options: { 'api-url': { type: 'string' }, 'web-url': { type: 'string' }, 'socket-url': { type: 'string' } } });
const api = values['api-url'] ?? process.env.DEMO_API_URL ?? 'http://localhost:4000';
const web = values['web-url'] ?? process.env.DEMO_WEB_URL ?? 'http://localhost:3000';
const socketUrl = values['socket-url'] ?? api;

async function json(path, init) {
  const response = await fetch(`${api}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.json();
}
async function create(body) {
  return json('/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function terminal(id) {
  for (let i = 0; i < 150; i++) {
    const run = await json(`/runs/${id}`);
    if (!['queued', 'running'].includes(run.status)) return run;
    await delay(200);
  }
  throw new Error(`Worker did not finish ${id} within 30 seconds`);
}
async function streamWithReplay(id) {
  const socket = io(socketUrl, { transports: ['websocket'], autoConnect: false });
  const events = new Map();
  let cursor = 0;
  let disconnected = false;
  let completion;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket stream/replay timed out')), 20000);
      const fail = error => { clearTimeout(timer); reject(error); };
      socket.on('connect_error', fail);
      socket.on('connect', () => socket.emit('run.subscribe', { runId: id, after: cursor }, reply => {
        if (reply?.error) fail(new Error(reply.error));
      }));
      socket.on('run.event', event => {
        events.set(event.sequence, event);
        while (events.has(cursor + 1)) cursor++;
        if (event.type === 'run.completed') completion = event;
        if (cursor >= 8 && !disconnected) {
          disconnected = true;
          socket.disconnect();
          void delay(350).then(() => socket.connect());
        }
        if (completion && cursor >= completion.sequence) { clearTimeout(timer); resolve(); }
      });
      socket.connect();
    });
  } finally { socket.disconnect(); }
  assert.ok(disconnected, 'The reconnect path must be exercised');
  assert.equal(events.size, cursor, 'Replay must produce contiguous events');
  assert.equal(completion.payload.run.status, 'completed');
  for (const event of events.values()) {
    if (event.payload.step) assert.equal(typeof event.payload.step.costUsd, 'number');
  }
  return cursor;
}
async function main() {
  const health = await waitForReady(() => json('/health'), 'API');
  assert.equal(health.mode, 'mock', 'This acceptance check only runs in mock mode and must never create paid calls');
  const page = await waitForReady(async () => {
    const response = await fetch(web, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200);
    return response;
  }, 'Web');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /AI Agent Orchestrator/);
  assert.equal((await fetch(`${api}/runs/not-a-uuid`)).status, 400);
  assert.equal((await fetch(`${api}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"task":"x"}' })).status, 400);

  const retry = await create({ task: 'Plan a landing page for a coffee shop [retry]' });
  const eventCount = await streamWithReplay(retry.id);
  const reviewed = await json(`/runs/${retry.id}`);
  assert.equal(reviewed.steps.length, 9);
  assert.equal(reviewed.steps.filter(step => step.agent === 'Reviewer').length, 2);

  const genericTask = 'Design an onboarding flow for a collaborative notes app';
  const generic = await terminal((await create({ task: genericTask })).id);
  assert.equal(generic.status, 'completed');
  assert.match(generic.result, /onboarding flow/);
  assert.doesNotMatch(generic.result, /Kafka|RabbitMQ/);

  const budget = await terminal((await create({ task: 'Plan a landing page for a coffee shop', maxCostUsd: 0.001 })).id);
  assert.equal(budget.status, 'budget_exceeded');
  const first = await json('/runs?limit=1&status=completed&model=gpt-4.1-mini');
  assert.ok(first.nextCursor && first.models.length);
  const second = await json(`/runs?limit=1&status=completed&model=gpt-4.1-mini&cursor=${encodeURIComponent(first.nextCursor)}`);
  assert.notEqual(first.items[0].id, second.items[0].id);
  console.log(JSON.stringify({ status: 'passed', mode: 'mock', streamedEvents: eventCount, reconnectReplay: true, reviewSteps: reviewed.steps.length, genericTask: true, budgetGuard: budget.status, validation: true, cursorPagination: true }, null, 2));
}
main().catch(error => { console.error(`Demo acceptance failed: ${error.message}`); process.exitCode = 1; });
