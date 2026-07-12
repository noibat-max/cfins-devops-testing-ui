import type {
  AdminUser,
  AuthResponse,
  CreatedToken,
  Group,
  Header,
  ScopeInfo,
  SecretMeta,
  Step,
  Token,
  Usecase,
  UsecaseExport,
  User,
  Variable,
  WorkbenchApp,
} from '../types';

// Points at cfins-devops-testing-api (uvicorn). Override with VITE_API_BASE.
// The app owns `/api`: every functional route is under it. QA Studio (Nova Act)
// calls go under `/api/nova`; workbench-shell calls (auth, apps, admin, tokens)
// sit directly under `/api`.
const ROOT = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const API = `${ROOT}/api`;
const NOVA = `${ROOT}/api/nova`;

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

/** Authenticated JSON request against a given base (workbench or Nova). */
function request<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...authHeader() };
  if (init.body) headers['Content-Type'] = 'application/json';
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string>) },
  }).then((r) => asJson<T>(r));
}

/** Workbench-shell request (under /api). */
function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(API, path, init);
}

/** QA Studio (Nova Act) request (under /api/nova). */
function novaReq<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(NOVA, path, init);
}

export function getApps(): Promise<WorkbenchApp[]> {
  return fetch(`${API}/apps`).then((r) => asJson<WorkbenchApp[]>(r));
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return fetch(`${API}/auth/login`, {
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
  return fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => asJson<User>(r));
}

// ---- Use cases (Nova / QA Studio) ----

export function listUsecases(): Promise<{ usecases: Usecase[] }> {
  return novaReq('/usecases');
}

export function getUsecase(id: string): Promise<Usecase> {
  return novaReq(`/usecase/${id}`);
}

export function createUsecase(body: Partial<Usecase>): Promise<Usecase> {
  return novaReq('/usecase', { method: 'POST', body: JSON.stringify(body) });
}

export function updateUsecase(
  id: string,
  body: Partial<Usecase>,
): Promise<{ status: string; usecaseId: string }> {
  return novaReq(`/usecase/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteUsecase(id: string): Promise<{ status: string }> {
  return novaReq(`/usecase/${id}`, { method: 'DELETE' });
}

export function exportUsecase(id: string): Promise<UsecaseExport> {
  return novaReq(`/usecase/${id}/export`);
}

export function cloneUsecase(
  id: string,
  name: string,
): Promise<{ usecaseId: string }> {
  return novaReq(`/usecase/${id}/clone`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function importUsecase(
  payload: UsecaseExport,
): Promise<{ usecaseId: string; secretsPending?: string[] }> {
  return novaReq('/import', { method: 'POST', body: JSON.stringify(payload) });
}

// ---- Steps ----

export function listSteps(usecaseId: string): Promise<{ steps: Step[] }> {
  return novaReq(`/usecase/${usecaseId}/steps`);
}

export function createStep(
  usecaseId: string,
  body: Partial<Step>,
): Promise<Step> {
  return novaReq(`/usecase/${usecaseId}/steps`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateStep(
  usecaseId: string,
  stepId: string,
  body: Partial<Step>,
): Promise<{ status: string }> {
  return novaReq(`/usecase/${usecaseId}/steps/${stepId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteStep(
  usecaseId: string,
  stepId: string,
): Promise<{ status: string }> {
  return novaReq(`/usecase/${usecaseId}/steps/${stepId}`, { method: 'DELETE' });
}

export function reorderSteps(
  usecaseId: string,
  stepOrders: Array<{ step_id: string; sort: number }>,
): Promise<{ count: number }> {
  return novaReq(`/usecase/${usecaseId}/steps/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ step_orders: stepOrders }),
  });
}

// ---- Use-case config: variables & secrets (§3) ----

export function getVariables(usecaseId: string): Promise<{ variables: Variable[] }> {
  return novaReq(`/usecase/${usecaseId}/variables`);
}

export function putVariables(usecaseId: string, variables: Variable[]): Promise<{ variables: Variable[] }> {
  return novaReq(`/usecase/${usecaseId}/variables`, {
    method: 'POST',
    body: JSON.stringify({ variables }),
  });
}

export function getHeaders(usecaseId: string): Promise<{ headers: Header[] }> {
  return novaReq(`/usecase/${usecaseId}/headers`);
}

export function putHeaders(usecaseId: string, headers: Header[]): Promise<{ headers: Header[] }> {
  return novaReq(`/usecase/${usecaseId}/headers`, {
    method: 'POST',
    body: JSON.stringify({ headers }),
  });
}

export function listSecrets(usecaseId: string): Promise<{ secrets: SecretMeta[] }> {
  return novaReq(`/usecase/${usecaseId}/secrets`);
}

/** Create (or upsert) one secret. The API accepts a batch; we send one at a time. */
export function createSecret(
  usecaseId: string,
  secret: { key: string; value: string; description?: string },
): Promise<{ count: number }> {
  return novaReq(`/usecase/${usecaseId}/secrets`, {
    method: 'POST',
    body: JSON.stringify({ secrets: [secret] }),
  });
}

export function updateSecret(usecaseId: string, secretKey: string, value: string): Promise<{ secret_key: string }> {
  return novaReq(`/usecase/${usecaseId}/secrets`, {
    method: 'PATCH',
    body: JSON.stringify({ secret_key: secretKey, value }),
  });
}

export function deleteSecret(usecaseId: string, secretKey: string): Promise<{ secret_key: string }> {
  return novaReq(`/usecase/${usecaseId}/secrets`, {
    method: 'DELETE',
    body: JSON.stringify({ secret_key: secretKey }),
  });
}

// ---- Admin: local users + groups ----

export function listUsers(): Promise<{ users: AdminUser[] }> {
  return req('/users');
}

export function listGroups(): Promise<{ groups: Group[] }> {
  return req('/groups');
}

export function listScopes(): Promise<{ scopes: ScopeInfo[] }> {
  return req('/scopes');
}

export function createGroup(body: {
  name: string;
  description?: string;
  scopes?: string[];
}): Promise<Group> {
  return req('/groups', { method: 'POST', body: JSON.stringify(body) });
}

export function updateGroup(
  name: string,
  body: { description?: string; scopes?: string[] },
): Promise<Group> {
  return req(`/groups/${name}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteGroup(name: string): Promise<{ status: string }> {
  return req(`/groups/${name}`, { method: 'DELETE' });
}

export function createUser(body: {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
  groups?: string[];
  status?: string;
}): Promise<AdminUser> {
  return req('/users', { method: 'POST', body: JSON.stringify(body) });
}

export function setUserPassword(username: string, password: string): Promise<{ status: string }> {
  return req(`/users/${username}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
}

export function setUserGroups(username: string, groups: string[]): Promise<{ status: string }> {
  return req(`/users/${username}/groups`, { method: 'PUT', body: JSON.stringify({ groups }) });
}

export function updateUser(
  username: string,
  body: { email?: string; displayName?: string; status?: string; groups?: string[] },
): Promise<AdminUser> {
  return req(`/users/${username}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteUser(username: string): Promise<{ status: string }> {
  return req(`/users/${username}`, { method: 'DELETE' });
}

export function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ status: string }> {
  return req('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

// ---- Personal access tokens (self-service, CLI auth) ----

export function listTokens(): Promise<{ tokens: Token[] }> {
  return req('/me/tokens');
}

/** Create a PAT. The raw token value is returned once, in `token`. */
export function createToken(
  name: string,
  description: string,
  expiresInDays?: number,
): Promise<CreatedToken> {
  return req('/me/tokens', {
    method: 'POST',
    body: JSON.stringify({ name, description, expiresInDays }),
  });
}

export function revokeToken(id: string): Promise<{ status: string; id: string }> {
  return req(`/me/tokens/${id}`, { method: 'DELETE' });
}
