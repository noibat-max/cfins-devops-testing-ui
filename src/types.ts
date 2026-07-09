export interface User {
  username: string;
  displayName: string;
  email: string;
  /** Groups the user belongs to (source of truth for authorization). */
  groups: string[];
  /** Scopes resolved from the user's groups, for UI gating. */
  scopes: string[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface WorkbenchApp {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: string;
  route: string;
  status: 'available' | 'coming-soon';
  icon: string; // Cloudscape icon name (placeholder per-app icon)
}

/** Admin wildcard scope — grants everything, gates Administration UI. */
export const ADMIN_SCOPE = 'api/admin';

/** Whether a user may see workbench Administration actions. */
export function isAdmin(user: User | null): boolean {
  return !!user?.scopes?.includes(ADMIN_SCOPE);
}

/** Whether the user holds a scope (admin inherits everything). */
export function hasScope(user: User | null, scope: string): boolean {
  const scopes = user?.scopes ?? [];
  return scopes.includes(ADMIN_SCOPE) || scopes.includes(scope);
}

// ---- QA Studio domain types (use cases + steps) ----

export interface Usecase {
  id: string;
  name: string;
  description: string;
  starting_url: string;
  active: boolean;
  tags: string[];
  created_at: string;
  executing_region: string;
  model_id: string;
  enableCache: boolean;
  test_platform: string;
}

export interface Step {
  id: string;
  sort: number;
  instruction: string;
  step_type: string;
  secret_key?: string;
  capture_variable?: string;
  validation_type?: string;
  validation_operator?: string;
  validation_value?: string;
  assertion_variable?: string;
  value_type?: string;
  value_source?: string;
}

/** The export envelope produced by GET /usecase/{id}/export. */
export interface UsecaseExport {
  exportVersion: string;
  usecase: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  variables: unknown[];
  secrets: unknown[];
}
