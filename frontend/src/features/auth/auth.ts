export type AuthState =
  | { loggedIn: false }
  | { loggedIn: true; disabled: true }
  | { loggedIn: true; disabled: false; name: string; email: string; permissions: string[] };

const API = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');

export const authQueryKey = ['auth', 'whoami'] as const;

export async function whoAmI(signal?: AbortSignal): Promise<AuthState> {
  const response = await fetch(`${API}/whoami`, {
    credentials: 'include',
    cache: 'no-store',
    signal,
  });

  if (response.status === 401) return { loggedIn: false };
  if (!response.ok) throw new Error('Unable to check your session. Please try again.');

  return response.json();
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API}/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok && response.status !== 401) {
    throw new Error('Unable to log out. Please try again.');
  }
}
