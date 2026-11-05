import type { Agent, EventType, Run, RunEvent, Step, Usage } from '@orchestrator/shared';
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface Call {
  agent: Agent;
  model: string;
  input: string;
  system: string;
  tools?: Tool[];
  maxTokens: number;
}
export interface Completion {
  text: string;
  toolCalls: {
    name: string;
    arguments: unknown;
  }[];
  promptTokens: number;
  completionTokens: number;
}
export interface LLMProvider {
  complete(call: Call, onChunk: (chunk: string) => Promise<void>, signal: AbortSignal): Promise<Completion>;
}
export interface RunStore {
  load(id: string): Promise<Run>;
  start(id: string): Promise<boolean>;
  begin(step: Step): Promise<void>;
  finish(step: Step): Promise<void>;
  end(id: string, values: Partial<Run>): Promise<Run>;
  emit(id: string, type: EventType, stepId: string | null, payload: RunEvent['payload']): Promise<void>;
}
export const emptyUsage: Usage = { promptTokens: 0, completionTokens: 0, costUsd: 0 };
