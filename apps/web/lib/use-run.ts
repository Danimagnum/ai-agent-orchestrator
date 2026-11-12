'use client';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Run, RunEvent } from '@orchestrator/shared';
import { api, apiUrl } from './api';
import { applyEvent } from './reducer';
export { applyEvent } from './reducer';
export function useRun(id: string) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    let active = true;
    const pending = new Map<number, RunEvent>();
    const socket = io(apiUrl, { transports: ['websocket'], autoConnect: false, reconnectionDelay: 500 });
    function receive(event: RunEvent) {
      if (!active || event.runId !== id || event.sequence <= last.current)
        return;
      pending.set(event.sequence, event);
      const batch: RunEvent[] = [];
      while (pending.has(last.current + 1)) {
        const next = pending.get(++last.current)!;
        pending.delete(last.current);
        batch.push(next);
      }
      if (batch.length)
        setRun(current => current ? batch.reduce(applyEvent, current) : current);
    }
    socket.on('run.event', receive);
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('run.subscribe', { runId: id, after: last.current }, (reply: {
        error?: string;
      }) => {
        if (reply?.error)
          setError(reply.error);
      });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    void api<Run>(`/runs/${encodeURIComponent(id)}`).then(snapshot => {
      if (!active)
        return;
      last.current = snapshot.eventCursor ?? 0;
      setRun(snapshot);
      socket.connect();
    }).catch(e => {
      if (active)
        setError(e.message);
    });
    // Reconcile gaps even if Redis lost a transient publication while the socket stayed open.
    let polling = false;
    const timer = setInterval(() => {
      if (!active || polling)
        return;
      polling = true;
      void api<RunEvent[]>(`/runs/${encodeURIComponent(id)}/events?after=${last.current}`).then(events => events.forEach(receive)).catch(() => undefined).finally(() => {
        polling = false;
      });
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
      socket.disconnect();
      pending.clear();
    };
  }, [id]);
  return { run, error, connected };
}
