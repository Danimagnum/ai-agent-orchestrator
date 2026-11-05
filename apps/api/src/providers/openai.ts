import type { Call, Completion, LLMProvider } from '../orchestration/contracts';
import { checked, readSSE } from './sse';
export class OpenAIProvider implements LLMProvider {
  async complete(call: Call, onChunk: (chunk: string) => Promise<void>, signal: AbortSignal): Promise<Completion> {
    if (!process.env.OPENAI_API_KEY)
      throw new Error('OPENAI_API_KEY is required when MOCK_LLM=false');
    const response = await checked(await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal, headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: call.model, messages: [{ role: 'system', content: call.system }, { role: 'user', content: call.input }],
        stream: true, stream_options: { include_usage: true }, max_completion_tokens: call.maxTokens,
        ...(call.tools?.length ? { tools: call.tools.map(t => ({ type: 'function', function: t })), tool_choice: 'required' } : {}),
      }),
    }));
    const result: Completion = { text: '', toolCalls: [], promptTokens: 0, completionTokens: 0 };
    const tools = new Map<number, {
      name: string;
      json: string;
    }>();
    let finished = false;
    let usage = false;
    for await (const frame of readSSE(response)) {
      if (frame.error)
        throw new Error('OpenAI stream failed');
      if (frame.usage) {
        result.promptTokens = frame.usage.prompt_tokens;
        result.completionTokens = frame.usage.completion_tokens;
        usage = true;
      }
      const choice = frame.choices?.[0];
      if (choice?.finish_reason) {
        if (!['stop', 'tool_calls'].includes(choice.finish_reason))
          throw new Error(`OpenAI stopped: ${choice.finish_reason}`);
        finished = true;
      }
      const delta = choice?.delta;
      if (delta?.content) {
        result.text += delta.content;
        await onChunk(delta.content);
      }
      for (const tool of delta?.tool_calls ?? []) {
        if (tool.function?.name) await onChunk(`\nTool: ${tool.function.name}\n`);
        if (tool.function?.arguments) await onChunk(tool.function.arguments);
        const entry = tools.get(tool.index) ?? { name: '', json: '' };
        entry.name += tool.function?.name ?? '';
        entry.json += tool.function?.arguments ?? '';
        tools.set(tool.index, entry);
      }
    }
    if (!finished || !usage)
      throw new Error('OpenAI stream ended before final usage');
    result.toolCalls = [...tools.values()].map(t => ({ name: t.name, arguments: JSON.parse(t.json) }));
    return result;
  }
}
