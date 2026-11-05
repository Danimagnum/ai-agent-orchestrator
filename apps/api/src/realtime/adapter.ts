import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import { redisUrl } from '../config';
export class RedisIoAdapter extends IoAdapter {
  readonly pub = new Redis(redisUrl);
  readonly sub = this.pub.duplicate();
  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    server.adapter(createAdapter(this.pub, this.sub));
    return server;
  }
  async shutdown() {
    await Promise.all([this.pub.quit(), this.sub.quit()]);
  }
}
