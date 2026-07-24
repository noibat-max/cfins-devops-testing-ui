import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { token, login, loginSso } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ssoBusy, setSsoBusy] = useState(false);

  // Already signed in -> always go to the workbench landing (not a prior state)
  if (token) return <Navigate to="/" replace />;

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSso() {
    setError(null);
    setSsoBusy(true);
    try {
      // Redirects the browser to Cognito; on success we don't return here —
      // the /auth/callback route completes sign-in.
      await loginSso();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO sign in failed');
      setSsoBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f2f3f3',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        <Container
          header={
            <Box textAlign="center" padding={{ top: 'l' }}>
              <img
                src="/branding/crum_foster_logo.svg"
                alt="Crum & Forster"
                height={72}
                style={{ display: 'block', margin: '0 auto 12px' }}
              />
              <Header variant="h1">QA Platform</Header>
              <Box color="text-body-secondary">Sign in to continue</Box>
            </Box>
          }
        >
          <SpaceBetween size="l">
            {error && (
              <Alert type="error" header="Could not sign in">
                {error}
              </Alert>
            )}

            <form onSubmit={onPasswordSubmit}>
              <SpaceBetween size="l">
                <FormField label="User ID">
                  <Input
                    value={username}
                    autoComplete
                    placeholder="Enter your user ID"
                    onChange={({ detail }) => setUsername(detail.value)}
                  />
                </FormField>
                <FormField label="Password">
                  <Input
                    value={password}
                    type="password"
                    placeholder="Enter your password"
                    onChange={({ detail }) => setPassword(detail.value)}
                  />
                </FormField>
                <Button
                  variant="primary"
                  fullWidth
                  loading={busy}
                  formAction="submit"
                >
                  Sign in
                </Button>
              </SpaceBetween>
            </form>

            <Box textAlign="center" color="text-body-secondary" fontSize="body-s">
              or
            </Box>

            <Button
              fullWidth
              iconName="lock-private"
              loading={ssoBusy}
              onClick={onSso}
            >
              Sign in with SSO
            </Button>

            <Box textAlign="center" color="text-body-secondary" fontSize="body-s">
              SSO uses your Crum &amp; Forster account (Cognito / OAuth2).
            </Box>
          </SpaceBetween>
        </Container>
      </div>
    </div>
  );
}
