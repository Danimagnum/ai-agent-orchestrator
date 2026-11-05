export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message ?? `Request failed (${response.status})`); }
  return response.json();
}
export const money = (n: number) => `$${n.toFixed(4)}`;
export const duration = (n: number | null) => n === null ? '—' : n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(1)}s`;
export const modelLabel = (model: string) => model.replace('claude-sonnet-4-20250514', 'Claude Sonnet 4').replace('claude-haiku-4-5-20251001', 'Claude Haiku 4.5').replace('gpt-4.1-mini', 'GPT-4.1 mini').replace('gpt-4.1', 'GPT-4.1');
