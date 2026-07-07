import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

// Cognito config. Non-secret; defaults match the provisioned pool, overridable
// via Vite env for other environments.
const AUTHORITY =
  import.meta.env.VITE_COGNITO_AUTHORITY ??
  'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_y7VZjMb6N';
const CLIENT_ID =
  import.meta.env.VITE_COGNITO_CLIENT_ID ?? '25ihduhnl3v8o4f4uuqjh41jkl';
const DOMAIN =
  import.meta.env.VITE_COGNITO_DOMAIN ??
  'https://us-east-1y7vzjmb6n.auth.us-east-1.amazoncognito.com';

/** Whether SSO is configured (mirrors the API's cognito_enabled). */
export const ssoEnabled = Boolean(AUTHORITY && CLIENT_ID && DOMAIN);

// Authorization Code + PKCE. oidc-client-ts discovers the authorize/token
// endpoints from {AUTHORITY}/.well-known/openid-configuration and persists the
// PKCE verifier in localStorage so it survives the redirect round-trip.
export const userManager = new UserManager({
  authority: AUTHORITY,
  client_id: CLIENT_ID,
  redirect_uri: `${window.location.origin}/auth/callback`,
  response_type: 'code',
  scope: 'openid email profile',
  stateStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: false, // we manage auth state ourselves in auth.tsx
});

/**
 * Cognito's /logout is non-standard — it takes `client_id` + `logout_uri`
 * (not the OIDC `post_logout_redirect_uri`), so we build it by hand. The
 * logout_uri must be a registered "Allowed sign-out URL" on the app client.
 */
export function cognitoLogoutUrl(): string {
  const logoutUri = encodeURIComponent(`${window.location.origin}/login`);
  return `${DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${logoutUri}`;
}
