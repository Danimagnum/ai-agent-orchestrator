import { useEffect, useState } from 'react';
import type { Run, RunEvent } from '@orchestrator/shared';
import { applyEvent } from '../../web/lib/reducer';
import { store } from './runtime';

export function useRun(id: string) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let cursor = 0;
    let loaded = false;
    const pending: RunEvent[] = [];
    const receive = (event: RunEvent) => {
      if (event.runId !== id || !active) return;
      if (!loaded) { pending.push(event); return; }
      if (event.sequence <= cursor) return;
      cursor = event.sequence;
      setRun(current => current ? applyEvent(current, event) : current);
    };
    const unsubscribe = store.subscribe(receive);
    setRun(null); setError('');
    void store.load(id).then(snapshot => {
      if (!active) return;
      cursor = snapshot.eventCursor ?? 0;
      setRun(snapshot); loaded = true; pending.forEach(receive);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; unsubscribe(); };
  }, [id]);
  return { run, error, connected: !error };
}
