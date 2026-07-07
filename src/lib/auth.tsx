import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as api from './api';
import { userManager, cognitoLogoutUrl } from './oidc';
import type { User } from '../types';

const STORAGE_KEY = 'qa-workbench.auth';

type Provider = 'local' | 'cognito';

interface StoredAuth {
  token: string;
  user: User;
  provider: Provider;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  /** Begin SSO — redirects the browser to Cognito (does not return). */
  loginSso: () => Promise<void>;
  /** Finish SSO on the /auth/callback route: exchange code, load identity. */
  completeSso: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => readStored());

  const persist = useCallback((next: StoredAuth | null) => {
    setAuth(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login(username, password);
      persist({ token: res.token, user: res.user, provider: 'local' });
    },
    [persist],
  );

  // Redirect to Cognito's hosted login. Control leaves the app here.
  const loginSso = useCallback(async () => {
    await userManager.signinRedirect();
  }, []);

  // Called on /auth/callback: complete the PKCE exchange, then ask our API who
  // this is (authoritative identity + resolved scopes) using the access token.
  const completeSso = useCallback(async () => {
    const oidcUser = await userManager.signinRedirectCallback();
    const token = oidcUser.access_token;
    const user = await api.getMe(token);
    persist({ token, user, provider: 'cognito' });
  }, [persist]);

  const logout = useCallback(() => {
    const wasCognito = auth?.provider === 'cognito';
    persist(null);
    // Clear any oidc-client-ts state too (best effort).
    void userManager.removeUser().catch(() => undefined);
    if (wasCognito) {
      // Also end the Cognito hosted session; returns to /login.
      window.location.assign(cognitoLogoutUrl());
    }
  }, [auth, persist]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      login,
      loginSso,
      completeSso,
      logout,
    }),
    [auth, login, loginSso, completeSso, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
