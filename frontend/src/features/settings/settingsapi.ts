const API = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  disabled: boolean;
  permissions: string[];
}

export type AppSettings = Record<string, string>;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Please check the values and try again.',
      401: 'Your session has expired. Please log in again.',
      403: 'You need an enabled administrator account to make this change.',
      404: 'This user or setting no longer exists. Refresh and try again.',
      409: 'A setting with that name already exists.',
    };
    throw new Error(messages[response.status] ?? `Request failed (${response.status}). Please try again.`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export const usersQueryKey = ['admin', 'users'] as const;
export const settingsQueryKey = ['admin', 'settings'] as const;

export const getUsers = (signal?: AbortSignal) =>
  request<ManagedUser[]>('/users', { signal });

export const putUserPermissions = (id: string, permissions: string[]) =>
  request<void>(`/permissions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });

export const setUserDisabled = (id: string, disabled: boolean) =>
  request<void>(`/user/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ disabled }),
  });

export const getSettings = (signal?: AbortSignal) =>
  request<AppSettings>('/settings', { signal });

export const patchSettings = (values: AppSettings) =>
  request<void>('/settings', { method: 'PATCH', body: JSON.stringify(values) });

export const createSetting = (name: string, value: string) =>
  request<{ name: string; value: string }>('/settings', {
    method: 'POST',
    body: JSON.stringify({ name, value }),
  });
