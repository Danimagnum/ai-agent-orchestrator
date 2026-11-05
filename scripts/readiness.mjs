import { setTimeout as delay } from 'node:timers/promises';

export async function waitForReady(operation, label) {
  const deadline = Date.now() + 30000;
  let failure;
  while (Date.now() < deadline) {
    try { return await operation(); }
    catch (error) { failure = error; await delay(500); }
  }
  throw new Error(`${label} was not ready within 30 seconds: ${failure?.message ?? 'unknown error'}`);
}
