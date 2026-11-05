'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { agents, defaultAgentConfig, modelSchema, type AgentConfig, type Model, type Run } from '@orchestrator/shared';
import { api, modelLabel } from '../lib/api';
import { Icon } from './icon';
import { AgentGraph } from './graph';
const prompts = [
  { icon: 'pen', title: 'Create something', text: 'Plan a landing page for a coffee shop' },
  { icon: 'code', title: 'Make a technical decision', text: 'Compare Kafka vs RabbitMQ for a real-time game backend' },
  { icon: 'search', title: 'Explore an idea', text: 'Design an onboarding flow for a collaborative notes app' },
];
export function Composer() {
  const router = useRouter(); const [task, setTask] = useState(''); const [config, setConfig] = useState<AgentConfig>(defaultAgentConfig);
  const [budget, setBudget] = useState('0.50'); const [advanced, setAdvanced] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const run = await api<Run>('/runs', { method: 'POST', body: JSON.stringify({ task, agentConfig: config, maxCostUsd: Number(budget) }) }); router.push(`/runs/${run.id}`); } catch (e) { setError(e instanceof Error ? e.message : 'Could not start run'); setBusy(false); } }
  return <div className="page home-page"><div className="page-heading"><div><div className="heading-line"><span className="eyebrow-dot"/> Agent playground</div><h1>One task. A team of agents.</h1><p>Give your agents a goal. Watch them think, delegate, and deliver.</p></div><span className="quiet-tag">Your next idea starts here</span></div>
    <div className="home-grid"><section className="panel composer-panel"><div className="section-title"><Icon name="bolt"/><h2>What are we working on?</h2></div><form onSubmit={submit}><label htmlFor="task" className="sr-only">Your task</label><textarea id="task" value={task} onChange={e => setTask(e.target.value)} placeholder="Describe a task for your team of agents…" minLength={8} maxLength={4000} required rows={5}/><div className="composer-meta"><span>Be specific. Your Director will handle the rest.</span><span>{task.length.toLocaleString()} / 4,000</span></div>
      <div className="form-divider"/><div className="composer-actions"><button className="text-button" type="button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><Icon name="graph" size={16}/> Configure agents <span className="count-badge">5</span></button><button className="primary-button" disabled={busy || task.trim().length < 8}>{busy ? 'Starting team…' : 'Run task'}<Icon name="arrow" size={16}/></button></div>
      {advanced && <div className="config-grid">{agents.map(a => <label key={a}>{a}<select value={config[a]} onChange={e => setConfig({ ...config, [a]: e.target.value as Model })}>{modelSchema.options.map(m => <option key={m} value={m}>{modelLabel(m)}</option>)}</select></label>)}<label>Maximum cost (USD)<input type="number" min="0.001" max="5" step="0.001" value={budget} required onChange={e => setBudget(e.target.value)}/></label></div>}
      {error && <p role="alert" className="error-banner">{error}</p>}
    </form><div className="starter-label">Need a starting point?</div><div className="prompt-list">{prompts.map(p => <button type="button" key={p.title} className="prompt-option" onClick={() => setTask(p.text)}><span className="prompt-icon"><Icon name={p.icon}/></span><span><strong>{p.title}</strong><small>{p.text}</small></span><Icon name="arrow" size={16}/></button>)}</div></section>
    <section className="panel team-preview"><div className="panel-header"><h2>Your team, connected</h2><span className="muted">5 specialized agents</span></div><AgentGraph steps={[]} config={config}/><div className="graph-caption"><span className="dot violet"/> The Director delegates. Specialists collaborate. The Reviewer checks.</div></section></div>
    <div className="capabilities"><div><span className="capability-icon violet-text"><Icon name="graph"/></span><h3>Collaboration you can follow</h3><p>See who’s working, what they’re doing, and how it all connects.</p></div><div><span className="capability-icon cyan-text"><Icon name="clock"/></span><h3>A trace for every decision</h3><p>Inspect each step’s output, model, and execution time.</p></div><div><span className="capability-icon amber-text"><Icon name="bolt"/></span><h3>Every token accounted for</h3><p>Track costs as they happen. Set a budget before agents start.</p></div></div>
    <div className="demo-note"><span className="demo-icon">◈</span><div><strong>Ready to explore. No API keys needed.</strong><p>The default demo uses deterministic agents. Configure provider keys to run with OpenAI and Anthropic.</p></div><span className="outline-tag">Deterministic demo</span></div>
  </div>;
}
