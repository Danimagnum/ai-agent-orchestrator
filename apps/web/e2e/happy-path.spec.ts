import { test, expect } from '@playwright/test';
test('orchestrates a task, streams its trace, survives reload, and appears in history', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'One task. A team of agents.' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('playground.png'), fullPage: true });
  await page.getByRole('button', { name: /Create something/ }).click();
  await expect(page.getByRole('textbox', { name: 'Your task' })).toHaveValue('Plan a landing page for a coffee shop');
  await page.getByRole('button', { name: 'Run task', exact: true }).click();
  await expect(page).toHaveURL(/\/runs\/[a-f0-9-]+/);
  await expect(page.getByTestId('agent-output')).not.toBeEmpty();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('live-run.png'), fullPage: true });
  await page.reload();
  await expect(page.getByTestId('run-status')).toHaveText('completed', { timeout: 60000 });
  await page.getByRole('button', { name: 'Final result' }).click();
  await expect(page.getByTestId('final-result')).toContainText('Acceptance criteria');
  await expect(page.getByRole('button', { name: /06.*Reviewer/ })).toBeVisible();
  await expect(page.locator('.react-flow__node').first()).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('completed-run.png'), fullPage: true });
  const id = page.url().split('/').at(-1)!;
  const detail = await page.request.get(`http://localhost:4000/runs/${id}`);
  const run = await detail.json();
  expect(run.steps).toHaveLength(6);
  expect(run.costUsd).toBeGreaterThan(0);
  expect(run.steps.every((s: {
    status: string;
  }) => s.status === 'completed')).toBe(true);
  const events = await (await page.request.get(`http://localhost:4000/runs/${id}/events`)).json();
  expect(events.some((e: {
    type: string;
  }) => e.type === 'step.token')).toBe(true);
  for (const event of events)
    if (event.payload.step)
      expect(typeof event.payload.step.costUsd).toBe('number');
  expect(events.map((e: {
    sequence: number;
  }) => e.sequence)).toEqual(events.map((_: unknown, i: number) => i + 1));
  await page.getByRole('link', { name: 'Run history' }).click();
  await expect(page.getByRole('link', { name: 'Plan a landing page for a coffee shop', exact: true }).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('completed');
  await expect(page.getByRole('heading', { name: 'Model efficiency' })).toBeVisible();
  await expect(page.getByText('Claude Haiku 4.5', { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('history.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/runs/${id}`);
  await expect(page.getByTestId('run-status')).toHaveText('completed');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-run.png'), fullPage: true });
  expect(errors).toEqual([]);
});
