import './observability/instrument';
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { source } from './database/source';
import { RunsController } from './runs/controller';
import { RunGateway } from './realtime/gateway';
import { RedisIoAdapter } from './realtime/adapter';
import { redis, queue, reconcileQueue } from './runs/service';
import { webOrigin } from './config';
import { Sentry } from './observability/instrument';
@Module({ controllers: [RunsController], providers: [RunGateway, { provide: APP_FILTER, useClass: SentryGlobalFilter }] })
class AppModule {}
async function main() {
  await source.initialize();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: webOrigin });
  const adapter = new RedisIoAdapter(app); app.useWebSocketAdapter(adapter);
  const sub = redis.duplicate();
  await sub.subscribe('run-events');
  sub.on('message', (_channel, message) => {
    try { const event = JSON.parse(message); app.get(RunGateway).server?.local.to(event.runId).emit('run.event', event); }
    catch (error) { Sentry.captureException(error); }
  });
  let reconciling = false;
  const reconcile = setInterval(() => {
    if (reconciling) return; reconciling = true;
    void reconcileQueue().catch(error => { Sentry.captureException(error); console.error('queue reconciliation failed', error.message); }).finally(() => { reconciling = false; });
  }, 2000);
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
  const stop = async () => { clearInterval(reconcile); await sub.quit(); await queue.close(); await redis.quit(); await adapter.shutdown(); await app.close(); await source.destroy(); process.exit(0); };
  process.once('SIGTERM', () => void stop()); process.once('SIGINT', () => void stop());
}
void main().catch(error => { console.error(error); Sentry.captureException(error); process.exit(1); });
