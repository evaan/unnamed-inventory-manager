const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export type AuthState =
  | { loggedIn: false }
  | { loggedIn: true; name: string; email: string; permissions: string[] };

export function login() {
  window.location.href = `${API}/auth/login`;
}

export async function whoAmI(): Promise<AuthState> {
  const res = await fetch(`${API}/auth/whoami`, { credentials: "include" });
  if (!res.ok) return { loggedIn: false };
  return res.json();
}

export async function logout() {
  await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
}