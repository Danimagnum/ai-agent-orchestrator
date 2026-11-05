import { Body, Controller, Get, HttpCode, HttpException, Param, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { createRun, getRun, history, redis, store, validate } from './service';
import { source } from '../database/source';
import { mockMode } from '../config';
@Controller()
export class RunsController {
  @Get('health')
  async health() {
    await source.query('SELECT 1');
    await redis.ping();
    return { status: 'ok', mode: mockMode ? 'mock' : 'live' };
  }
  @Post('runs')
  @HttpCode(202)
  async create(
    @Body()
    body: unknown,
    @Req()
    req: {
      ip: string;
    }) {
    const count = Number(await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", 1, `rate:runs:${req.ip}`));
    if (count > 10)
      throw new HttpException('Limit reached: try again in a minute.', 429);
    return createRun(body);
  }
  @Get('runs')
  list(
    @Query()
    query: unknown) {
    return history(query);
  }
  @Get('runs/:id')
  detail(
    @Param('id')
    id: string) {
    return getRun(id);
  }
  @Get('runs/:id/events')
  async events(
    @Param('id')
    id: string,
    @Query('after')
    after = '0') {
    await getRun(id);
    return store.replay(id, validate(z.coerce.number().int().min(0).max(2147483647), after));
  }
}
