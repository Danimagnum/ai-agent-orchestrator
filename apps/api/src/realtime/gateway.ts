import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { getRun, store } from '../runs/service';
import { webOrigin } from '../config';
@WebSocketGateway({ cors: { origin: webOrigin }, transports: ['websocket'] })
export class RunGateway {
  @WebSocketServer() server!: Server;
  @SubscribeMessage('run.subscribe')
  async subscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const parsed = z.object({ runId: z.string().uuid(), after: z.number().int().min(0).max(2147483647).default(0) }).safeParse(body);
    if (!parsed.success) return { error: 'Invalid subscription' };
    try {
      const { runId, after } = parsed.data;
      await getRun(runId);
      for (const room of socket.rooms) if (room !== socket.id) await socket.leave(room);
      // Join before replay; live/replayed duplicates are deduplicated by sequence in the client.
      await socket.join(runId);
      let cursor = after;
      while (socket.connected) {
        const events = await store.replay(runId, cursor);
        events.forEach(event => socket.emit('run.event', event));
        if (events.length < 2000) break;
        cursor = events.at(-1)!.sequence;
      }
      return { ok: true };
    } catch { return { error: 'Run unavailable' }; }
  }
}
