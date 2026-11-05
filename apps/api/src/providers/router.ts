import type { Call, LLMProvider } from '../orchestration/contracts';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { MockProvider } from './mock';
export class ProviderRouter implements LLMProvider {
  private openai = new OpenAIProvider();
  private anthropic = new AnthropicProvider();
  private mock = new MockProvider();
  constructor(private readonly mockMode: boolean) {
  }
  complete(call: Call, onChunk: (chunk: string) => Promise<void>, signal: AbortSignal) {
    return (this.mockMode ? this.mock : call.model.startsWith('claude') ? this.anthropic : this.openai).complete(call, onChunk, signal);
  }
}
