import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useAuth } from '../lib/auth';

/**
 * OAuth redirect target. Cognito sends the browser here with `?code=...`;
 * we complete the PKCE exchange, load identity from our API, then land on the
 * workbench. On failure we offer a way back to /login.
 */
export default function AuthCallback() {
  const { completeSso } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode's double-invoke — the auth code is
    // single-use, so a second exchange would fail.
    if (ran.current) return;
    ran.current = true;

    completeSso()
      .then(() => navigate('/', { replace: true }))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'SSO sign-in failed'),
      );
  }, [completeSso, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f2f3f3',
        padding: 24,
      }}
    >
      {error ? (
        <Box textAlign="center">
          <SpaceBetween size="m">
            <Alert type="error" header="Could not complete SSO sign-in">
              {error}
            </Alert>
            <div>
              <Button onClick={() => navigate('/login', { replace: true })}>
                Back to sign in
              </Button>
            </div>
          </SpaceBetween>
        </Box>
      ) : (
        <Box textAlign="center" color="text-body-secondary">
          <SpaceBetween size="m">
            <Spinner size="large" />
            <span>Completing sign-in…</span>
          </SpaceBetween>
        </Box>
      )}
    </div>
  );
}
