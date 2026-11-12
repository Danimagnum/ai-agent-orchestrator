'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { agents, type Agent, type Run, type Step } from '@orchestrator/shared';
import { useRun } from '../lib/use-run';
import { duration, modelLabel, money } from '../lib/api';
import { AgentGraph, agentIcons } from './graph';
import { Icon } from './icon';
import { Markdown } from './markdown';
function useNow(running: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running)
      return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}
function Waterfall({ run, onSelect }: {
  run: Run;
  onSelect: (agent: Agent) => void;
}) {
  const now = useNow(run.status === 'running');
  const origin = Date.parse(run.startedAt ?? run.createdAt);
  const elapsed = Math.max(1, (run.endedAt ? Date.parse(run.endedAt) : now) - origin);
  return <section className="panel waterfall">
    <div className="panel-header">
      <div className="section-title">
        <Icon name="clock" size={17} />
        <h2>Execution trace</h2>
        <span className="count-badge">{run.steps.length} steps</span>
      </div>
      <span className="muted">{duration(elapsed)} total</span>
    </div>
    <div className="trace-scale">
      <span>Agent / step</span>
      <div>
        <span>0s</span>
        <span>{duration(elapsed / 2)}</span>
        <span>{duration(elapsed)}</span>
      </div>
      <span>Duration</span>
    </div>{run.steps.map((step, i) => {
      const start = Math.max(0, Date.parse(step.startedAt) - origin);
      const length = Math.max(1, (step.endedAt ? Date.parse(step.endedAt) : now) - Date.parse(step.startedAt));
      return <button className={`trace-row agent-${step.agent.toLowerCase()}`} key={step.id} onClick={() => onSelect(step.agent)}>
        <span className="trace-name">
          <span className="trace-index">{String(i + 1).padStart(2, '0')}</span>
          <Icon name={agentIcons[step.agent]} size={14} />{step.agent}<small>{step.attempt > 1 ? `try ${step.attempt}` : ''}</small>
        </span>
        <span className="trace-track">
          <span className={`trace-bar ${step.status}`} style={{
            left: `${start / elapsed * 100}%`, width: `${Math.min(100 - start / elapsed * 100, Math.max(1, length / elapsed * 100))}%`
          }} />
        </span>
        <span className="trace-duration">{duration(length)}</span>
      </button>;
    })}{!run.steps.length && <p className="empty-inline">Waiting for a worker to start this run…</p>}<div className="trace-legend">
      <span>
        <i className="legend-square violet-bg" />Director</span>
      <span>
        <i className="legend-square amber-bg" />Researcher</span>
      <span>
        <i className="legend-square cyan-bg" />Writer</span>
      <span>
        <i className="legend-square blue-bg" />Coder</span>
      <span>
        <i className="legend-square green-bg" />Reviewer</span>
    </div>
  </section>;
}
function Output({ step, agent }: {
  step?: Step;
  agent: Agent;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(step?.output ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    catch {
      setCopyError('Select the output text to copy it.');
    }
  }
  return <div className="output-body">
    <div className="output-meta">
      <span>
        <span className={`dot ${step?.status === 'running' ? 'green pulse' : 'violet'}`} />{step ? step.status === 'running' ? 'Streaming response' : `${step.status} response` : 'Waiting for delegation'}</span>
      <button type="button" className="icon-button" onClick={copy} disabled={!step?.output} aria-label="Copy agent output">
        <Icon name={copied ? 'check' : 'copy'} size={15} />
      </button>
    </div>{copyError && <p role="status">{copyError}</p>}<pre className="stream-text" data-testid="agent-output">{step?.output || `${agent}’s output will appear here as the run progresses.`}{step?.status === 'running' && <span className="stream-cursor" />}</pre>{step?.error && <div className="error-banner">{step.error}</div>}</div>;
}
export function RunView({ id, localDemo = false }: {
  id: string;
  localDemo?: boolean;
}) {
  const { run, error, connected } = useRun(id);
  const [selected, setSelected] = useState<Agent>('Director');
  const [tab, setTab] = useState<'agents' | 'result'>('agents');
  const [stepId, setStepId] = useState('');
  const now = useNow(run?.status === 'running');
  if (!run)
    return <div className="page">
      <h1>{error ? 'Run unavailable' : 'Opening workspace…'}</h1>{error && <p role="alert" className="error-banner">{error}</p>}<Link href="/" className="text-button">Back to playground</Link>
    </div>;
  const running = run.status === 'running' || run.status === 'queued';
  const elapsed = run.latencyMs ?? (run.startedAt ? Math.max(0, now - Date.parse(run.startedAt)) : 0);
  const selectedSteps = run.steps.filter(s => s.agent === selected);
  const step = selectedSteps.find(s => s.id === stepId) ?? selectedSteps.at(-1);
  const tokens = (s: Step) => (s.status === 'running' ? Math.ceil(s.input.length / 4) : s.promptTokens) + s.completionTokens;
  const estimatedCost = (s: Step) => s.status === 'running' ? (s.completionTokens * (run.pricing[s.model]?.output ?? 0) + Math.ceil(s.input.length / 4) * (run.pricing[s.model]?.input ?? 0)) / 1e6 : s.costUsd;
  const liveTokens = run.steps.reduce((n, s) => n + tokens(s), 0);
  const costEstimate = run.steps.filter(s => s.status === 'running').reduce((n, s) => n + (s.completionTokens * (run.pricing[s.model]?.output ?? 0) + Math.ceil(s.input.length / 4) * (run.pricing[s.model]?.input ?? 0)) / 1e6, 0);
  function select(agent: Agent) {
    setSelected(agent);
    setStepId('');
    setTab('agents');
  }
  return <div className="page run-page">
    <div className="run-heading">
      <div>
        <div className="heading-line">
          <Link href="/">Playground</Link>
          <span>/</span>
          <span className="mono">{id.slice(0, 8)}</span>
          <span className={`status-badge ${run.status}`} data-testid="run-status">{run.status.replace('_', ' ')}</span>
        </div>
        <h1>{run.task}</h1>
        <p>{run.mock ? 'Deterministic demo' : 'Live provider execution'}<span className="separator">/</span>{new Date(run.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <Link href="/" className="secondary-button">
        <Icon name="plus" size={16} />New task</Link>
    </div>
    {error && <p role="alert" className="error-banner">{error}</p>}{run.error && <p role="alert" className="error-banner">{run.error}</p>}
    <div className="run-stats">
      <div>
        <span>Execution time</span>
        <strong>{duration(elapsed)}</strong>
        <small>{running ? 'Elapsed so far' : 'End-to-end latency'}</small>
      </div>
      <div>
        <span>Total tokens {running && <i className="estimate-label">estimated</i>}</span>
        <strong>{liveTokens.toLocaleString()}</strong>
        <small>{run.promptTokens.toLocaleString()} input / {run.completionTokens.toLocaleString()} settled output</small>
      </div>
      <div>
        <span>Total cost {running && <i className="estimate-label">estimated</i>}</span>
        <strong>{money(run.costUsd + costEstimate)}</strong>
        <small>of {money(run.maxCostUsd)} budget</small>
      </div>
      <div>
        <span>Agent activity</span>
        <strong>{run.steps.filter(s => s.status === 'running').length}<em> / 5 working</em>
        </strong>
        <small>{run.steps.filter(s => s.status === 'completed').length} completed calls</small>
      </div>
    </div>
    <div className="execution-grid">
      <section className="panel live-graph">
        <div className="panel-header">
          <div className="section-title">
            <h2>Agent network</h2>
            <span className="outline-tag">Live topology</span>
          </div>
          <span className="connection">
            <span className={`dot ${connected ? 'green' : 'amber'}`} />{localDemo ? 'Motor en este navegador' : connected ? 'Connected' : 'Reconnecting'}</span>
        </div>
        <AgentGraph steps={run.steps} config={run.agentConfig} selected={selected} onSelect={select} />
        <div className="graph-caption">Select an agent to inspect its output<span>Delegation edges follow the trace tree</span>
        </div>
      </section>
      <section className="panel outputs-panel">
        <div className="output-tabs">
          <button className={tab === 'agents' ? 'active' : ''} onClick={() => setTab('agents')}>Agent output</button>
          <button className={tab === 'result' ? 'active' : ''} onClick={() => setTab('result')}>Final result{run.result && <span className="dot green" />}</button>
        </div>{tab === 'agents' ? <>
          <div className="agent-tabs" role="tablist" aria-label="Agent output">{agents.map(a => <button key={a} role="tab" aria-selected={selected === a} className={`agent-tab agent-${a.toLowerCase()} ${selected === a ? 'active' : ''}`} onClick={() => select(a)} title={a}>
            <Icon name={agentIcons[a]} size={15} />
            <span>{a}</span>
          </button>)}</div>
          <div className="output-agent-heading">
            <div>
              <strong>{selected}</strong>
              <small>{modelLabel(run.agentConfig[selected])}</small>
            </div>
            <select aria-label="Agent call" value={step?.id ?? ''} onChange={e => setStepId(e.target.value)} disabled={!selectedSteps.length}>{selectedSteps.length ? selectedSteps.map((s, i) => <option key={s.id} value={s.id}>Call {i + 1} · {s.status}</option>) : <option value="">No calls yet</option>}</select>
          </div>
          <Output key={step?.id ?? selected} step={step} agent={selected} />
          <div className="output-footer">
            <span>{(step ? tokens(step) : 0).toLocaleString()} tokens{step?.status === 'running' ? ' (est.)' : ''}</span>
            <span>{duration(step?.latencyMs ?? null)}</span>
            <span>{money(step ? estimatedCost(step) : 0)}</span>
          </div>
        </> : <div className="final-result" data-testid="final-result">
          <div className="result-label">
            <Icon name="check" size={17} />{run.result ? 'Reviewed deliverable' : 'Your deliverable is on its way'}</div>
          <Markdown text={run.result ?? 'The Director will synthesize the team’s work, then the Reviewer will check the result. Keep watching the agent outputs while they work.'} />
        </div>}</section>
    </div>
    <Waterfall run={run} onSelect={select} />
    <section className="panel usage-panel">
      <div className="panel-header">
        <h2>Usage by agent</h2>
        <span className="muted">{run.mock ? 'Simulated usage & cost' : 'Provider usage; interrupted calls conservatively estimated'}</span>
      </div>
      <div className="usage-grid">{agents.map(agent => {
        const list = run.steps.filter(s => s.agent === agent);
        const usage = list.reduce((v, s) => ({ tokens: v.tokens + tokens(s), cost: v.cost + estimatedCost(s) }), { tokens: 0, cost: 0 });
        return <button key={agent} className={`usage-agent agent-${agent.toLowerCase()}`} onClick={() => select(agent)}>
          <div>
            <span className="agent-glyph">
              <Icon name={agentIcons[agent]} size={16} />
            </span>
            <strong>{agent}</strong>
          </div>
          <small>{modelLabel(run.agentConfig[agent])}</small>
          <p>{usage.tokens.toLocaleString()} <span>{list.some(s => s.status === "running") ? "tokens (est.)" : "tokens"}</span>
            <b>{money(usage.cost)}</b>
          </p>
        </button>;
      })}</div>
    </section>
  </div>;
}
