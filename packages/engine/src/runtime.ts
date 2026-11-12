export interface EngineRuntime {
  now(): number;
  uuid(): string;
}
export const defaultRuntime: EngineRuntime = {
  now: () => Date.now(),
  uuid: () => globalThis.crypto.randomUUID(),
};
export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}
export function delay(ms: number, _value?: undefined, options?: { signal?: AbortSignal }): Promise<void> {
  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    signal?.throwIfAborted();
    const stop = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
    signal?.addEventListener('abort', stop, { once: true });
  });
}
