import type {
  AuthResponse,
  Step,
  Usecase,
  UsecaseExport,
  User,
  WorkbenchApp,
} from '../types';

// Points at cfins-devops-testing-api (uvicorn). Override with VITE_API_BASE.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

const AUTH_STORAGE_KEY = 'qa-workbench.auth';

/** Bearer header from the stored token (works for local + Cognito). */
function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const token = raw ? (JSON.parse(raw) as { token?: string }).token : null;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    /* ignore */
  }
  return {};
}

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

/** Authenticated JSON request helper. */
function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...authHeader() };
  if (init.body) headers['Content-Type'] = 'application/json';
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string>) },
  }).then((r) => asJson<T>(r));
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

// ---- Use cases ----

export function listUsecases(): Promise<{ usecases: Usecase[] }> {
  return req('/usecases');
}

export function getUsecase(id: string): Promise<Usecase> {
  return req(`/usecase/${id}`);
}

export function createUsecase(body: Partial<Usecase>): Promise<Usecase> {
  return req('/usecase', { method: 'POST', body: JSON.stringify(body) });
}

export function updateUsecase(
  id: string,
  body: Partial<Usecase>,
): Promise<{ status: string; usecaseId: string }> {
  return req(`/usecase/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteUsecase(id: string): Promise<{ status: string }> {
  return req(`/usecase/${id}`, { method: 'DELETE' });
}

export function exportUsecase(id: string): Promise<UsecaseExport> {
  return req(`/usecase/${id}/export`);
}

export function cloneUsecase(
  id: string,
  name: string,
): Promise<{ usecaseId: string }> {
  return req(`/usecase/${id}/clone`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function importUsecase(
  payload: UsecaseExport,
): Promise<{ usecaseId: string }> {
  return req('/import', { method: 'POST', body: JSON.stringify(payload) });
}

// ---- Steps ----

export function listSteps(usecaseId: string): Promise<{ steps: Step[] }> {
  return req(`/usecase/${usecaseId}/steps`);
}

export function createStep(
  usecaseId: string,
  body: Partial<Step>,
): Promise<Step> {
  return req(`/usecase/${usecaseId}/steps`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateStep(
  usecaseId: string,
  stepId: string,
  body: Partial<Step>,
): Promise<{ status: string }> {
  return req(`/usecase/${usecaseId}/steps/${stepId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteStep(
  usecaseId: string,
  stepId: string,
): Promise<{ status: string }> {
  return req(`/usecase/${usecaseId}/steps/${stepId}`, { method: 'DELETE' });
}

export function reorderSteps(
  usecaseId: string,
  stepOrders: Array<{ step_id: string; sort: number }>,
): Promise<{ count: number }> {
  return req(`/usecase/${usecaseId}/steps/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ step_orders: stepOrders }),
  });
}
