import './observability/instrument';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { source } from './database/source';
import { redisUrl } from './config';
import { PostgresStore } from './events/store';
import { publishOutbox } from './events/outbox';
import { Orchestrator } from './orchestration/engine';
import { ProviderRouter } from './providers/router';
import { Sentry } from './observability/instrument';
import { StepEntity } from './database/entities';
async function main() {
  await source.initialize();
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const publisher = connection.duplicate();
  const store = new PostgresStore(source);
  let publishing = false;
  const outbox = setInterval(() => {
    if (publishing) return; publishing = true;
    void publishOutbox(source, publisher).catch(error => { Sentry.captureException(error); console.error('outbox publish failed', error.message); }).finally(() => { publishing = false; });
  }, 100);
  const worker = new Worker('runs', async job => {
    const run = await store.load(job.data.runId);
    if (run.status === 'running') {
      // A stalled job must not silently repeat potentially billable calls.
      for (const step of run.steps.filter(s => s.status === 'running')) {
        await source.getRepository(StepEntity).update(step.id, { status: 'failed', error: 'Worker interrupted; provider billing unknown', endedAt: new Date().toISOString(), latencyMs: Date.now() - Date.parse(step.startedAt) });
      }
      return store.end(run.id, { status: 'failed', error: 'Worker interrupted. Start a new run to retry; partial provider billing may be unknown.', endedAt: new Date().toISOString(), latencyMs: Date.now() - Date.parse(run.startedAt!) });
    }
    return new Orchestrator(store, new ProviderRouter(run.mock)).execute(run.id);
  }, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3), maxStalledCount: 1 });
  worker.on('failed', (job, error) => { Sentry.captureException(error, { tags: { runId: job?.data.runId } }); console.error('job failed', job?.id, error.message); });
  worker.on('error', error => { Sentry.captureException(error); console.error('worker error', error.message); });
  console.log(JSON.stringify({ event: 'worker.ready', concurrency: worker.opts.concurrency }));
  const stop = async () => { await worker.close(); clearInterval(outbox); while (publishing) await new Promise(resolve => setTimeout(resolve, 50)); await publishOutbox(source, publisher); await publisher.quit(); await connection.quit(); await source.destroy(); await Sentry.close(2000); process.exit(0); };
  process.once('SIGTERM', () => void stop()); process.once('SIGINT', () => void stop());
}
void main().catch(error => { console.error(error); Sentry.captureException(error); process.exit(1); });
