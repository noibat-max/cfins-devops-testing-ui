import type { AuthResponse, User, WorkbenchApp } from '../types';

// Points at cfins-devops-testing-api (uvicorn). Override with VITE_API_BASE.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function getApps(): Promise<WorkbenchApp[]> {
  return fetch(`${API_BASE}/apps`).then((r) => asJson<WorkbenchApp[]>(r));
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then((r) => asJson<AuthResponse>(r));
}

// SSO (Cognito / OAuth2) is not wired yet — the backend path is deferred.
// Keep the signature stable so the button works once the provider lands.
export function ssoLogin(): Promise<AuthResponse> {
  return Promise.reject(new Error('SSO sign-in is not available yet.'));
}

export function getMe(token: string): Promise<User> {
  return fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => asJson<User>(r));
}
