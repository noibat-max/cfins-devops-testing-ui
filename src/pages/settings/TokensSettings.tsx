import { useCallback, useEffect, useState } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import Badge from '@cloudscape-design/components/badge';
import Popover from '@cloudscape-design/components/popover';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import WorkbenchTopBar from '../../components/WorkbenchTopBar';
import type { CreatedToken, Token } from '../../types';
import * as api from '../../lib/api';

const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;

/** Show just the date part of an ISO timestamp. */
const asDate = (iso: string) => (iso ? iso.slice(0, 10) : '—');

export default function TokensSettings() {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Token | null>(null);

  const flash = useCallback((type: FlashbarProps.Type, content: string) => {
    const fid = `${Date.now()}-${Math.random()}`;
    const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== fid));
    setFlashes((f) => [...f, { id: fid, type, content, dismissible: true, onDismiss: dismiss }]);
    if (type === 'success' || type === 'info') setTimeout(dismiss, 4000);
  }, []);

  const load = useCallback(() => {
    setError(null);
    api
      .listTokens()
      .then((r) => setTokens(r.tokens))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load tokens'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <WorkbenchTopBar />
      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header
              variant="h1"
              counter={tokens ? `(${tokens.length})` : undefined}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="icon" iconName="refresh" ariaLabel="Refresh" onClick={load} />
                  <Button variant="primary" iconName="add-plus" onClick={() => setShowCreate(true)}>
                    Generate token
                  </Button>
                </SpaceBetween>
              }
              description="Personal access tokens authenticate the QA Workbench CLI as you. A token inherits your permissions and works only in this environment."
            >
              Personal access tokens
            </Header>
          </Box>
        }
      >
        <Box padding={{ horizontal: 'l', bottom: 'xxl' }}>
          <SpaceBetween size="l">
            {flashes.length > 0 && <Flashbar items={flashes} />}
            {error ? (
              <Flashbar items={[{ type: 'error', content: error, dismissible: false }]} />
            ) : tokens === null ? (
              <Box textAlign="center" padding="xxl">
                <Spinner size="large" />
              </Box>
            ) : (
              <Table<Token>
                variant="container"
                items={tokens}
                columnDefinitions={[
                  {
                    id: 'name',
                    header: 'Name',
                    cell: (t) => <b>{t.name}</b>,
                  },
                  {
                    id: 'description',
                    header: 'Description',
                    cell: (t) =>
                      t.description ? (
                        t.description
                      ) : (
                        <Box color="text-status-inactive">—</Box>
                      ),
                  },
                  {
                    id: 'token',
                    header: 'Token',
                    cell: (t) => <Box fontSize="body-s" color="text-body-secondary">qapat_…{t.last4}</Box>,
                  },
                  {
                    id: 'scopes',
                    header: 'Scopes',
                    cell: (t) => (
                      <Popover
                        dismissButton={false}
                        position="top"
                        size="large"
                        triggerType="text"
                        content={
                          <SpaceBetween size="xxs">
                            {t.scopes.length ? (
                              t.scopes.map((s) => <Badge key={s} color="blue">{s}</Badge>)
                            ) : (
                              <Box color="text-status-inactive">No scopes</Box>
                            )}
                          </SpaceBetween>
                        }
                      >
                        {t.scopes.length} {t.scopes.length === 1 ? 'scope' : 'scopes'}
                      </Popover>
                    ),
                  },
                  {
                    id: 'created',
                    header: 'Created',
                    cell: (t) => asDate(t.createdAt),
                  },
                  {
                    id: 'expires',
                    header: 'Expires',
                    cell: (t) =>
                      t.expired ? (
                        <StatusIndicator type="error">Expired</StatusIndicator>
                      ) : (
                        asDate(t.expiresAt)
                      ),
                  },
                  {
                    id: 'actions',
                    header: '',
                    cell: (t) => (
                      <span className="wb-danger">
                        <Button variant="link" iconName="remove" onClick={() => setRevokeTarget(t)}>
                          Revoke
                        </Button>
                      </span>
                    ),
                  },
                ]}
                empty={
                  <Box textAlign="center" padding="l" color="text-body-secondary">
                    <SpaceBetween size="s">
                      <div>No personal access tokens yet.</div>
                      <Button iconName="add-plus" onClick={() => setShowCreate(true)}>
                        Generate token
                      </Button>
                    </SpaceBetween>
                  </Box>
                }
              />
            )}
          </SpaceBetween>
        </Box>
      </ContentLayout>

      {showCreate && (
        <GenerateTokenModal
          onClose={() => setShowCreate(false)}
          onCreated={() => load()}
        />
      )}
      {revokeTarget && (
        <RevokeTokenModal
          target={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onDone={() => {
            const n = revokeTarget.name;
            setRevokeTarget(null);
            flash('success', `Revoked “${n}”`);
            load();
          }}
          onError={(m) => flash('error', m)}
        />
      )}
    </>
  );
}

function GenerateTokenModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState(String(DEFAULT_DAYS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);

  const daysNum = Number(days);
  const daysError =
    days.trim() === '' || !Number.isInteger(daysNum) || daysNum < 1 || daysNum > MAX_DAYS
      ? `Enter a whole number of days between 1 and ${MAX_DAYS}`
      : undefined;
  const valid = !!name.trim() && !daysError;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const t = await api.createToken(name.trim(), description.trim(), daysNum);
      setCreated(t);
      onCreated(); // refresh the list behind the modal
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create token');
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select the text manually */
    }
  };

  return (
    <Modal
      visible
      onDismiss={onClose}
      header={created ? 'Token created' : 'Generate personal access token'}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>
              {created ? 'Done' : 'Cancel'}
            </Button>
            {!created && (
              <Button variant="primary" loading={busy} disabled={!valid} onClick={submit}>
                Generate
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      {created ? (
        <SpaceBetween size="m">
          <Alert type="success" header="Copy your token now">
            This is the only time the token is shown. Store it somewhere safe — you won't be able to
            see it again.
          </Alert>
          <FormField label="Token" description="Paste this into the CLI config for this environment.">
            <SpaceBetween direction="horizontal" size="xs">
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input readOnly value={created.token} />
              </div>
              <Button iconName={copied ? 'status-positive' : 'copy'} onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </SpaceBetween>
          </FormField>
          <Box fontSize="body-s" color="text-body-secondary">
            Expires {asDate(created.expiresAt)} · {created.scopes.length}{' '}
            {created.scopes.length === 1 ? 'scope' : 'scopes'} (inherited from your account)
          </Box>
        </SpaceBetween>
      ) : (
        <SpaceBetween size="m">
          {error && <Alert type="error">{error}</Alert>}
          <FormField label="Name" description="A short label, e.g. “cli-laptop”.">
            <Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="cli-laptop" />
          </FormField>
          <FormField
            label={
              <span>
                Description <i>- optional</i>
              </span>
            }
            description="What this token is for, so you can recognize it later."
          >
            <Input
              value={description}
              onChange={({ detail }) => setDescription(detail.value)}
              placeholder="Runs SAT smoke suite from my laptop"
            />
          </FormField>
          <FormField
            label="Expires in (days)"
            description={`Default ${DEFAULT_DAYS} days, maximum ${MAX_DAYS}.`}
            errorText={days.trim() !== '' ? daysError : undefined}
          >
            <Input
              type="number"
              value={days}
              onChange={({ detail }) => setDays(detail.value)}
              inputMode="numeric"
            />
          </FormField>
          <Box fontSize="body-s" color="text-body-secondary">
            The token inherits your current permissions and works only in this environment.
          </Box>
        </SpaceBetween>
      )}
    </Modal>
  );
}

function RevokeTokenModal({
  target,
  onClose,
  onDone,
  onError,
}: {
  target: Token;
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.revokeToken(target.id);
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to revoke');
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      onDismiss={onClose}
      header={`Revoke “${target.name}”`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>
              Cancel
            </Button>
            <span className="wb-danger-fill">
              <Button variant="primary" loading={busy} onClick={submit}>
                Revoke
              </Button>
            </span>
          </SpaceBetween>
        </Box>
      }
    >
      Revoke this token? Any CLI or script using it will immediately stop working. This cannot be
      undone.
    </Modal>
  );
}
