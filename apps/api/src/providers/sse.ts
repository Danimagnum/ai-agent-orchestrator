// Handles arbitrary UTF-8/network boundaries, CRLF, comments and multiline SSE data.
export async function* readSSE(response: Response): AsyncGenerator<any> {
  if (!response.body)
    throw new Error('Provider returned an empty stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (data === '[DONE]')
          return;
        if (data)
          yield JSON.parse(data);
      }
      if (done)
        break;
    }
  }
  finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}
export async function checked(response: Response) {
  if (!response.ok) {
    // Avoid surfacing response bodies: upstream errors can contain sensitive prompts.
    throw new ProviderError(`Provider HTTP ${response.status}`, response.status === 429 || response.status >= 500);
  }
  return response;
}
