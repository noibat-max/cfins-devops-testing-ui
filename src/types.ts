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
