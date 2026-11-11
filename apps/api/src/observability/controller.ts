import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { source } from '../database/source';
import { redis } from '../runs/service';
import { mockMode } from '../config';

async function bounded<T>(check: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([check, new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Dependency timeout')), 3000);
    })]);
  } finally {
    clearTimeout(timeout);
  }
}

@Controller()
export class ObservabilityController {
  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  async ready() {
    const [postgres, cache] = await Promise.allSettled([
      bounded(source.query('SELECT 1')), bounded(redis.ping()),
    ]);
    const dependencies = {
      postgres: postgres.status === 'fulfilled' ? 'up' : 'down',
      redis: cache.status === 'fulfilled' ? 'up' : 'down',
    };
    if (Object.values(dependencies).includes('down'))
      throw new ServiceUnavailableException({ status: 'not_ready', dependencies });
    return { status: 'ok', dependencies, mode: mockMode ? 'mock' : 'live' };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics() {
    // One statement gives a consistent persisted snapshot across API replicas.
    // Gauges intentionally reflect retained history, including simulated usage.
    let rows: { status: string; mock: boolean; tasks: string; input: string; output: string; cost: string; duration: string; timed: string }[];
    try {
      rows = await bounded(source.query(`SELECT status, mock, COUNT(*) AS tasks,
        SUM("promptTokens") AS input, SUM("completionTokens") AS output,
        SUM("costUsd") AS cost, COALESCE(SUM("latencyMs"),0)/1000.0 AS duration,
        COUNT("latencyMs") AS timed FROM runs GROUP BY status, mock`));
    } catch {
      throw new ServiceUnavailableException('Metrics storage unavailable');
    }
    const definitions = [
      ['orchestrator_tasks', 'Persisted tasks by current state.'],
      ['orchestrator_input_tokens', 'Input tokens in retained tasks.'],
      ['orchestrator_output_tokens', 'Output tokens in retained tasks.'],
      ['orchestrator_cost_usd', 'Calculated USD cost in retained tasks; mock is simulated.'],
      ['orchestrator_duration_seconds', 'Sum of recorded task durations in seconds.'],
      ['orchestrator_timed_tasks', 'Tasks with a recorded duration.'],
    ];
    const lines = definitions.flatMap(([name, help]) => [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`]);
    for (const mode of ['mock', 'live']) {
      for (const status of ['queued', 'running', 'completed', 'failed', 'budget_exceeded']) {
        const row = rows.find(r => r.status === status && r.mock === (mode === 'mock'));
        const values = [row?.tasks, row?.input, row?.output, row?.cost, row?.duration, row?.timed];
        definitions.forEach(([name], i) => lines.push(`${name}{mode="${mode}",status="${status}"} ${Number(values[i] ?? 0)}`));
      }
    }
    return lines.join('\n') + '\n';
  }
}
