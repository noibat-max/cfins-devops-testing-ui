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
  /** Username of whoever created (or cloned/imported) this use case. */
  created_by?: string;
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
  validation_tolerance?: string;
  assertion_variable?: string;
  value_type?: string;
  value_source?: string;
  /** If this step originated from a template (Apply/Import/sync), a reference back to it. */
  template_id?: string;
  template_step_id?: string;
  template_step_hash?: string;
}

/** A plaintext use-case variable, interpolated into steps as {{key}}. */
export interface Variable {
  key: string;
  value: string;
}

/** A custom HTTP header injected into the browser session. Value may contain {{variables}}. */
export interface Header {
  name: string;
  value: string;
}

/** A use-case secret — metadata only; the value is never returned by the API. */
export interface SecretMeta {
  key: string;
  description: string;
  created_at: string;
}

/** The export envelope produced by GET /usecase/{id}/export. */
export interface UsecaseExport {
  exportVersion: string;
  usecase: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  variables: unknown[];
  secrets: unknown[];
}

// ---- Admin (local users + groups) ----

export interface AdminUser {
  username: string;
  email: string;
  displayName: string;
  groups: string[];
  status: string; // "active" | "disabled"
  createdAt: string;
}

export interface Group {
  name: string;
  description: string;
  scopes: string[];
}

export interface ScopeInfo {
  scope: string;
  description: string;
}

// ---- Personal access tokens (CLI auth) ----

/** A PAT's public metadata — the raw token is only returned once, at creation. */
export interface Token {
  id: string;
  name: string;
  description: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  last4: string;
  expired: boolean;
}

/** Create response: the metadata plus the one-time raw token value. */
export type CreatedToken = Token & { token: string };

// ---- Executions (§5 run history) ----

/** One run of a use case. Local (CLI) and remote both produce these. */
export interface Execution {
  executionId: string;
  usecaseId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'stopped' | string;
  mode: string;
  trigger?: string;
  createdBy?: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  errorMessage?: string;
  stopRequested?: boolean;
}

/** Per-step result within a run (upserted live by the runner's callbacks). */
export interface ExecutionStep {
  stepId: string;
  sort: number;
  status: 'pending' | 'executing' | 'passed' | 'failed' | string;
  startedAt?: string;
  endedAt?: string;
  errorMessage?: string;
  result?: string;
  updatedAt?: string;
  /** Cache-replay outcome for navigation steps: hit | cached | failed | (absent = no cache).
   *  Set by the cache-replay engine once ported; drives the Cache Performance panel. */
  cacheStatus?: string;
}

/** A run artifact in S3; `url` is a short-lived presigned GET for finished uploads. */
export interface Artifact {
  artifactId: string;
  artifactType: string; // screenshot | trace | video | ...
  filename: string;
  contentType: string;
  stepId?: string;
  status: string;
  sizeBytes?: number;
  createdAt: string;
  url?: string;
}

// ---- Templates (§7 — reusable step libraries) ----

export interface Template {
  id: string;
  name: string;
  description: string;
  created_at?: string;
  created_by?: string;
  /** Bumps on any step add/edit/delete/reorder. Starts at 1. */
  version?: number;
}

/** One step in a template-drift diff. */
export interface TemplateUpdateStep {
  templateStepId?: string;
  usecaseStepId?: string;
  sort?: number;
  step_type?: string;
  instruction?: string;
  localEdited?: boolean;
}

/** Per-template drift for a use case (new / updated / removed steps). */
export interface TemplateUpdateGroup {
  templateId: string;
  templateName: string;
  templateDeleted?: boolean;
  new: TemplateUpdateStep[];
  updated: TemplateUpdateStep[];
  removed: TemplateUpdateStep[];
}

// ---- Test suites (§8 — batch collections of use cases) ----

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tags: string[];
  created_at?: string;
  created_by?: string;
  /** Number of member use cases (computed live). */
  usecaseCount?: number;
}

/** Roll-up counts for a suite run (derived live from member executions). */
export interface SuiteRunCounts {
  total: number;
  completed: number;
  failed: number;
  stopped: number;
  running: number;
  pending: number;
}

/** One batch run of a suite (list row). */
export interface SuiteExecution {
  suiteExecutionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped' | string;
  counts: SuiteRunCounts;
  totalUsecases: number;
  mode: string;
  trigger?: string;
  triggeredBy?: string;
  createdAt: string;
}

/** One member use-case execution within a suite run. */
export interface SuiteExecMember {
  executionId: string;
  usecaseId: string;
  usecaseName?: string | null;
  status: string;
  startedAt?: string;
  endedAt?: string;
  errorMessage?: string;
}

/** A suite run with its member executions (detail view). */
export interface SuiteExecutionDetail extends SuiteExecution {
  suiteId: string;
  suiteName?: string;
  members: SuiteExecMember[];
}

/** A use case's membership in a suite, with its details resolved live. */
export interface SuiteMember {
  usecaseId: string;
  sort: number;
  addedAt?: string;
  /** null when the use case was deleted after being added (see `missing`). */
  name: string | null;
  description: string;
  active: boolean;
  missing: boolean;
}

// ---- Audit log (workbench governance) ----

/** One recorded mutating action. `body` is a redacted JSON string. */
export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string; // create | update | delete | login | change-password | ...
  method: string;
  path: string;
  query: string;
  body: string; // redacted JSON payload (or "" / "<non-JSON body>")
  status: number;
  outcome: 'success' | 'failure';
  ip: string;
  correlationId: string;
  env: string;
}
