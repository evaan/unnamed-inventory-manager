const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');

export async function request(path: string, init: RequestInit, errorPrefix: string): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body && typeof body.error === 'string' ? body.error : '';
    throw new Error(`${errorPrefix} (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res;
}
