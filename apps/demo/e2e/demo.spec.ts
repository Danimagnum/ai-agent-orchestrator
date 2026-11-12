import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const base = '/demos/orchestrator/';
test('runs offline in a same-origin iframe, including correction, trace and session history', async ({ page, context }, info) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', r => requests.push(r.url()));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/embed-test');
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('textbox', { name: 'Your task' })).toBeVisible();
  await expect(frame.getByText('Demo en modo simulado: respuestas pregeneradas, sin llamadas reales a modelos')).toBeVisible();
  const loadedRequests = requests.length;
  await context.setOffline(true);
  await frame.getByRole('button', { name: /Watch a review correction/ }).click();
  await frame.getByRole('button', { name: 'Run task', exact: true }).click();
  await expect(frame.getByTestId('run-status')).toHaveText('running');
  await expect(frame.locator('.agent-node.running')).toHaveCount(3, { timeout: 25000 });
  await expect(frame.getByTestId('run-status')).toHaveText('completed', { timeout: 60000 });
  await expect(frame.locator('.react-flow__node')).toHaveCount(5);
  await expect(frame.locator('.trace-row')).toHaveCount(9);
  await frame.getByRole('button', { name: 'Final result' }).click();
  await expect(frame.getByTestId('final-result')).toContainText('Acceptance criteria');
  await expect(frame.locator('.run-stats')).toContainText(/\$0\.00[1-9]/);
  await frame.getByRole('button', { name: 'Agent output', exact: true }).click();
  await frame.getByRole('tab', { name: 'Reviewer' }).click();
  await expect(frame.getByLabel('Agent call')).toContainText('Call 2');
  await page.screenshot({ path: info.outputPath('offline-completed.png'), fullPage: true });
  await frame.getByRole('link', { name: 'Run history', exact: true }).click();
  await expect(frame.locator('.history-task')).toContainText('[retry]');
  await frame.locator('.history-task').click();
  await expect(frame.getByTestId('run-status')).toHaveText('completed');
  expect(requests.slice(loadedRequests)).toEqual([]);
  expect(requests.every(url => url.startsWith('http://localhost:4173/'))).toBe(true);
  expect(errors).toEqual([]);
});

test('mobile, free text, budget guard and honest empty session after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByRole('textbox', { name: 'Your task' }).fill('Design a useful tool for local farmers');
  await page.getByRole('button', { name: /Configure agents/ }).click();
  await page.getByLabel('Maximum cost (USD)').fill('0.001');
  await page.getByRole('button', { name: 'Run task', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('budget exceeded');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Run unavailable' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to playground' }).click();
  await expect(page.getByRole('textbox', { name: 'Your task' })).toBeVisible();
});

test('CSP blocks a parent origin outside the frame-ancestors allowlist', async ({ page }) => {
  const blocked = page.waitForEvent('console', { predicate: message => /frame-ancestors/.test(message.text()) });
  await page.goto('http://127.0.0.1:4173/embed-test?cross=1');
  await blocked;
  await expect(page.frameLocator('iframe').getByRole('textbox', { name: 'Your task' })).toHaveCount(0);
});

test('cold load on simulated 4G with gzip; records timing without making external requests', async ({ browser }, info) => {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, connectionType: 'cellular4g' });
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const response = await page.goto(`http://localhost:4173${base}`);
    expect(response?.headers()['content-encoding']).toBe('gzip');
    expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'self' https://danielgil.eu https://www.danielgil.eu");
    await expect(page.getByRole('textbox', { name: 'Your task' })).toBeEnabled();
    await expect(page.locator('.react-flow__node')).toHaveCount(5);
    samples.push(await page.evaluate(() => ({ interactiveMs: performance.now(), fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      transferredBytes: performance.getEntriesByType('resource').reduce((n, r) => n + (r as PerformanceResourceTiming).transferSize, 0) })));
    await context.close();
  }
  const report = { profile: '1.6 Mbps down / 750 Kbps up / 150 ms latency / CPU x4; Chromium cold cache; 3 samples', samples,
    medianInteractiveMs: samples.map(s => s.interactiveMs).sort((a, b) => a - b)[1] };
  await writeFile(info.outputPath('4g-load.json'), JSON.stringify(report, null, 2));
  await info.attach('4G timings', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  process.stdout.write(JSON.stringify(report) + '\n');
});
