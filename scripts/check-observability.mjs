import assert from 'node:assert/strict';
const base = process.env.API_URL ?? 'http://localhost:4000';
const expected = process.env.EXPECT_READY ?? 'up';
const fetch = url => globalThis.fetch(url, { signal: globalThis.AbortSignal.timeout(10000) });
const live = await fetch(`${base}/health/live`);
assert.equal(live.status, 200);
assert.equal((await live.json()).status, 'ok');
const ready = await fetch(`${base}/health/ready`);
assert.equal(ready.status, expected === 'up' ? 200 : 503);
const body = await ready.json();
if (expected === 'up') {
  assert.deepEqual(body.dependencies, { postgres: 'up', redis: 'up' });
} else {
  assert.equal(body.dependencies[expected], 'down');
}
const metrics = await fetch(`${base}/metrics`);
if (expected === 'postgres') {
  assert.equal(metrics.status, 503);
} else {
  assert.equal(metrics.status, 200);
  assert.match(metrics.headers.get('content-type'), /text\/plain/);
  const text = await metrics.text();
  for (const name of ['tasks', 'input_tokens', 'output_tokens', 'cost_usd', 'duration_seconds', 'timed_tasks']) {
    assert.match(text, new RegExp(`# TYPE orchestrator_${name} gauge`));
    assert.match(text, new RegExp(`orchestrator_${name}\\{mode="mock",status="completed"\\} [0-9]`));
  }
  if (expected === 'up') {
    const history = await (await fetch(`${base}/runs?limit=1`)).json();
    assert.ok(history.items.length > 0, 'Run smoke test before checking persisted metrics');
    assert.match(text, /orchestrator_tasks\{mode="mock",status="completed"\} [1-9]/);
    assert.match(text, /orchestrator_duration_seconds\{mode="mock",status="completed"\} [1-9]/);
    // Compare every metric against durable API history, not just its presence.
    const runs = [];
    let cursor;
    do {
      const response = await fetch(`${base}/runs?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      assert.equal(response.status, 200);
      const page = await response.json();
      runs.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    for (const mode of ['mock', 'live']) for (const status of ['queued', 'running', 'completed', 'failed', 'budget_exceeded']) {
      const group = runs.filter(r => r.mock === (mode === 'mock') && r.status === status);
      const sum = key => group.reduce((total, r) => total + Number(r[key] ?? 0), 0);
      const values = { tasks: group.length, input_tokens: sum('promptTokens'), output_tokens: sum('completionTokens'), cost_usd: sum('costUsd'), duration_seconds: sum('latencyMs') / 1000, timed_tasks: group.filter(r => r.latencyMs !== null).length };
      for (const [name, value] of Object.entries(values)) {
        const line = text.split('\n').find(l => l.startsWith(`orchestrator_${name}{mode="${mode}",status="${status}"} `));
        assert.ok(line, `Missing ${name}`);
        assert.ok(Math.abs(Number(line.split(' ').at(-1)) - value) < 0.0000001, `Incorrect ${name}: expected ${value}`);
      }
    }
  }
}
process.stdout.write(`Observability verified: ${expected}\n`);
