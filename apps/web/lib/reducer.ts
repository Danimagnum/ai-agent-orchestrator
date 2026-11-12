import type { Run, RunEvent } from '@orchestrator/shared';
export function applyEvent(run: Run, event: RunEvent): Run {
  if (event.type === 'run.completed')
    return { ...event.payload.run, eventCursor: event.sequence };
  if (event.type === 'run.started')
    return { ...run, status: 'running', startedAt: event.createdAt };
  if (event.type === 'step.started')
    return { ...run, steps: [...run.steps.filter(s => s.id !== event.stepId), event.payload.step] };
  if (event.type === 'step.token')
    return {
      ...run, steps: run.steps.map(s => s.id === event.stepId ? {
        ...s, output: s.output + event.payload.chunk, completionTokens: event.payload.estimatedCompletionTokens
      } : s)
    };
  if (event.type === 'step.completed' || event.type === 'step.failed') {
    const steps = run.steps.map(s => s.id === event.stepId ? event.payload.step : s);
    const completed = steps.filter(s => s.status !== 'running');
    return {
      ...run, steps, costUsd: completed.reduce((n, s) => n + s.costUsd, 0), promptTokens: completed.reduce((n, s) => n + s.promptTokens, 0), completionTokens: completed.reduce((n, s) => n + s.completionTokens, 0)
    };
  }
  return run;
}
