'use client';
import { useMemo } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, type NodeProps, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { agents, type Agent, type AgentConfig, type Step } from '@orchestrator/shared';
import { modelLabel } from '../lib/api';
import { Icon } from './icon';
export const agentIcons: Record<Agent, string> = { Director: 'graph', Researcher: 'search', Writer: 'pen', Coder: 'code', Reviewer: 'check' };
type AgentNode = Node<{
  agent: Agent;
  model: string;
  status: string;
  selected: boolean;
  count: number;
}, 'agent'>;
function AgentCard({ data }: NodeProps<AgentNode>) {
  return <div className={`agent-node agent-${data.agent.toLowerCase()} ${data.status} ${data.selected ? 'selected' : ''}`}>
    <Handle type="target" position={Position.Top} />
    <Handle id="side-source" type="source" position={Position.Right} />
    <Handle id="side-target" type="target" position={Position.Right} />
    <div className="agent-node-top">
      <span className="agent-glyph">
        <Icon name={agentIcons[data.agent]} size={18} />
      </span>
      <strong>{data.agent}</strong>
      <span className={`node-state ${data.status}`} aria-label={data.status} />
    </div>
    <div className="node-model">{modelLabel(data.model)}</div>
    <div className="node-foot">{data.status === 'idle' ? 'Ready to collaborate' : `${data.status} · ${data.count} ${data.count === 1 ? 'call' : 'calls'}`}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>;
}
const nodeTypes = { agent: AgentCard };
const positions: Record<Agent, {
  x: number;
  y: number;
}> = {
  Director: { x: 225, y: 0 }, Researcher: { x: 0, y: 165 }, Writer: { x: 225, y: 165 }, Coder: { x: 450, y: 165 }, Reviewer: { x: 225, y: 330 }
};
export function AgentGraph({ steps, config, selected, onSelect }: {
  steps: Step[];
  config: AgentConfig;
  selected?: Agent;
  onSelect?: (agent: Agent) => void;
}) {
  const nodes: AgentNode[] = useMemo(() => agents.map(agent => {
    const list = steps.filter(s => s.agent === agent);
    const last = list.at(-1);
    const status = list.some(s => s.status === 'running') ? 'running' : last?.status ?? 'idle';
    return {
      id: agent, type: 'agent', initialWidth: 192, initialHeight: 104, position: positions[agent], data: { agent, model: config[agent], status, selected: selected === agent, count: list.length }
    };
  }), [steps, config, selected]);
  const edges = useMemo(() => {
    const pairs = steps.length ? steps.flatMap(step => {
      const parent = steps.find(p => p.id === step.parentStepId);
      return parent && parent.agent !== step.agent ? [[parent.agent, step.agent] as const] : [];
    }) : [['Director', 'Researcher'], ['Director', 'Writer'], ['Director', 'Coder'], ['Director', 'Reviewer']] as [
      Agent,
      Agent
    ][];
    return [
      ...new Map(pairs.map(([source, target]) => {
        const side = [source, target].every(agent => agent === 'Director' || agent === 'Reviewer');
        const active = steps.some(step => step.agent === target && step.status === 'running');
        return [
          `${source}-${target}`, {
            id: `${source}-${target}`, source, target, type: 'smoothstep', animated: active,
            ...(side ? { sourceHandle: 'side-source', targetHandle: 'side-target' } : {}),
            style: { stroke: active ? '#a8a4ff' : '#39435a', strokeWidth: 1.5 },
          }
        ] as const;
      })).values()
    ];
  }, [steps]);
  return <div className="agent-graph" role="img" aria-label="Agent delegation graph">
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }} nodesDraggable={false} nodesConnectable={false} minZoom={0.35} maxZoom={1.15} onNodeClick={(_e, node) => onSelect?.(node.id as Agent)} proOptions={{ hideAttribution: true }}>
      <Background color="#2b3448" gap={22} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  </div>;
}
