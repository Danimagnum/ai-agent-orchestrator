import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
export const pricing = z.record(z.object({ input: z.number().nonnegative(), output: z.number().nonnegative() })).parse(JSON.parse(readFileSync(resolve(__dirname, '../../../config/model-pricing.json'), 'utf8')));
export const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
export const databaseUrl = process.env.DATABASE_URL ?? 'postgres://orchestrator:orchestrator@127.0.0.1:5432/orchestrator';
export const mockMode = process.env.MOCK_LLM !== 'false';
export const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
