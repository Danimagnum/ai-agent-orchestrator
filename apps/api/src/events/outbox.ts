import type { DataSource } from 'typeorm';
import type Redis from 'ioredis';
export async function publishOutbox(db: DataSource, redis: Redis) {
  await db.transaction(async tx => {
    const events = await tx.query('SELECT "runId",sequence,type,"stepId",payload,"createdAt" FROM run_events WHERE "publishedAt" IS NULL ORDER BY "createdAt",sequence LIMIT 100 FOR UPDATE SKIP LOCKED');
    for (const event of events) {
      await redis.publish('run-events', JSON.stringify(event));
      await tx.query('UPDATE run_events SET "publishedAt"=now() WHERE "runId"=$1 AND sequence=$2', [event.runId, event.sequence]);
    }
  });
}
