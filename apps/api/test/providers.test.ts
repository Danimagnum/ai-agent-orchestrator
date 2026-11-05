import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSSE } from '../src/providers/sse';
import { OpenAIProvider } from '../src/providers/openai';
import { AnthropicProvider } from '../src/providers/anthropic';
import type { Call } from '../src/orchestration/contracts';
function response(frames: unknown[]) {
  return new Response(frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`).join(''));
}
const call: Call = {
  agent: 'Director', model: 'test', input: 'test', system: 'test', maxTokens: 100, tools: [{ name: 'delegate', description: 'test', parameters: { type: 'object' } }]
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('provider protocol parsing', () => {
  it('parses SSE across UTF-8 and CRLF network boundaries', async () => {
    const bytes = new TextEncoder().encode('data: {"text":"café"}\r\n\r\ndata: [DONE]\n\n');
    const stream = new ReadableStream({
      start(c) {
        for (const byte of bytes)
          c.enqueue(new Uint8Array([byte]));
        c.close();
      }
    });
    const values = [];
    for await (const v of readSSE(new Response(stream)))
      values.push(v);
    expect(values).toEqual([{ text: 'café' }]);
  });
  it('assembles OpenAI tool deltas and final usage', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    vi.stubGlobal('fetch', vi.fn(async () => response([
      {
        choices: [{
          delta: { content: 'Plan', tool_calls: [{ index: 0, function: { name: 'delegate', arguments: '{"sub' } }] }
        }]
      },
      {
        choices: [{
          delta: { tool_calls: [{ index: 0, function: { arguments: 'tasks":[]}' } }] }, finish_reason: 'tool_calls'
        }]
      },
      { choices: [], usage: { prompt_tokens: 11, completion_tokens: 7 } },
    ])));
    const chunks: string[] = [];
    const result = await new OpenAIProvider().complete(call, async (c) => {
      chunks.push(c);
    }, new AbortController().signal);
    expect(chunks.join('')).toContain('Plan');
    expect(chunks.join('')).toContain('Tool: delegate');
    expect(chunks.join('')).toContain('{"subtasks":[]}');
    expect(result.toolCalls[0]?.arguments).toEqual({ subtasks: [] });
    expect(result.promptTokens).toBe(11);
  });
  it('assembles Anthropic tool input and usage', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    vi.stubGlobal('fetch', vi.fn(async () => response([
      { type: 'message_start', message: { usage: { input_tokens: 12 } } },
      {
        type: 'content_block_start', index: 0, content_block: { type: 'tool_use', name: 'delegate', input: {} }
      },
      {
        type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"subtasks":[]}' }
      },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 8 } }, { type: 'message_stop' },
    ])));
    const result = await new AnthropicProvider().complete(call, async () => undefined, new AbortController().signal);
    expect(result.toolCalls[0]?.arguments).toEqual({ subtasks: [] });
    expect(result.completionTokens).toBe(8);
  });
  it('rejects truncated streams', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    vi.stubGlobal('fetch', vi.fn(async () => response([{ choices: [{ delta: { content: 'partial' } }] }])));
    await expect(new OpenAIProvider().complete(call, async () => undefined, new AbortController().signal)).rejects.toThrow('final usage');
  });
});
