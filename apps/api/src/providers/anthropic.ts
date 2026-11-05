import type { Call, Completion, LLMProvider } from '../orchestration/contracts';
import { checked, readSSE } from './sse';
export class AnthropicProvider implements LLMProvider {
  async complete(call: Call, onChunk: (chunk: string) => Promise<void>, signal: AbortSignal): Promise<Completion> {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new Error('ANTHROPIC_API_KEY is required when MOCK_LLM=false');
    const response = await checked(await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal, headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: call.model, system: call.system, messages: [{ role: 'user', content: call.input }], max_tokens: call.maxTokens, stream: true,
        ...(call.tools?.length ? {
          tools: call.tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })), tool_choice: { type: 'any' }
        } : {}),
      }),
    }));
    const result: Completion = { text: '', toolCalls: [], promptTokens: 0, completionTokens: 0 };
    const tools = new Map<number, {
      name: string;
      json: string;
      initial: unknown;
    }>();
    let finished = false;
    for await (const frame of readSSE(response)) {
      if (frame.type === 'error')
        throw new Error('Anthropic stream failed');
      if (frame.type === 'message_start')
        result.promptTokens = frame.message.usage.input_tokens + (frame.message.usage.cache_read_input_tokens ?? 0) + (frame.message.usage.cache_creation_input_tokens ?? 0);
      if (frame.type === 'message_delta') {
        result.completionTokens = frame.usage?.output_tokens ?? result.completionTokens;
        if (frame.delta?.stop_reason && !['end_turn', 'tool_use'].includes(frame.delta.stop_reason))
          throw new Error(`Anthropic stopped: ${frame.delta.stop_reason}`);
      }
      if (frame.type === 'content_block_start' && frame.content_block.type === 'tool_use') {
        tools.set(frame.index, { name: frame.content_block.name, json: '', initial: frame.content_block.input });
        await onChunk(`\nTool: ${frame.content_block.name}\n`);
      }
      if (frame.type === 'content_block_delta') {
        if (frame.delta.type === 'text_delta') {
          result.text += frame.delta.text;
          await onChunk(frame.delta.text);
        }
        if (frame.delta.type === 'input_json_delta') {
          await onChunk(frame.delta.partial_json);
          const t = tools.get(frame.index);
          if (t)
            t.json += frame.delta.partial_json;
        }
      }
      if (frame.type === 'message_stop')
        finished = true;
    }
    if (!finished)
      throw new Error('Anthropic stream ended before message_stop');
    result.toolCalls = [...tools.values()].map(t => ({ name: t.name, arguments: t.json ? JSON.parse(t.json) : t.initial }));
    return result;
  }
}
