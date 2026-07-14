import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextFilter from '@cloudscape-design/components/text-filter';
import Badge from '@cloudscape-design/components/badge';
import Icon from '@cloudscape-design/components/icon';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Spinner from '@cloudscape-design/components/spinner';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Toggle from '@cloudscape-design/components/toggle';
import AppChrome from '../../components/AppChrome';
import { QA_STUDIO_NAV, QA_STUDIO_APP_NAME } from '../../config/qaStudioNav';
import { useAuth } from '../../lib/auth';
import { hasScope } from '../../types';
import type { Usecase, UsecaseExport } from '../../types';
import * as api from '../../lib/api';
import './UseCasesList.css';

const USECASES_BASE = '/apps/qa-studio/usecases';

export default function UseCasesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/nova/usecases.write');

  const [items, setItems] = useState<Usecase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<Usecase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Usecase | null>(null);

  const flash = useCallback(
    (type: FlashbarProps.Type, content: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== id));
      setFlashes((f) => [...f, { id, type, content, dismissible: true, onDismiss: dismiss }]);
      // Auto-clear transient confirmations; keep errors until dismissed.
      if (type === 'success' || type === 'info') setTimeout(dismiss, 4000);
    },
    [],
  );

  const load = useCallback(() => {
    setError(null);
    api
      .listUsecases()
      .then((r) => setItems(r.usecases))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load use cases'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = items ?? [];
    if (!q) return list;
    return list.filter((u) =>
      [u.name, u.description, u.id, u.starting_url, (u.tags ?? []).join(' ')].some((s) =>
        (s ?? '').toLowerCase().includes(q),
      ),
    );
  }, [items, filter]);

  const onExport = async (u: Usecase) => {
    try {
      const data = await api.exportUsecase(u.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${u.name || 'usecase'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      flash('error', e instanceof Error ? e.message : 'Export failed');
    }
  };

  return (
    <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
      <Box padding={{ horizontal: 'l', top: 'l', bottom: 'xxl' }}>
        <SpaceBetween size="l">
          {flashes.length > 0 && <Flashbar items={flashes} />}

          <Header
            variant="h1"
            counter={items ? `(${items.length})` : undefined}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="icon" iconName="refresh" onClick={load} ariaLabel="Refresh" />
                {canWrite && (
                  <Button variant="link" iconName="upload" onClick={() => setShowImport(true)}>
                    Import
                  </Button>
                )}
                {canWrite && (
                  <Button variant="primary" iconName="add-plus" onClick={() => setShowCreate(true)}>
                    Create
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            Use cases
          </Header>

          <div style={{ maxWidth: 480 }}>
            <TextFilter
              filteringText={filter}
              filteringPlaceholder="Find use cases"
              filteringAriaLabel="Find use cases"
              onChange={({ detail }) => setFilter(detail.filteringText)}
            />
          </div>

          {error ? (
            <Flashbar items={[{ type: 'error', content: error, dismissible: false }]} />
          ) : items === null ? (
            <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>
          ) : filtered.length === 0 ? (
            <Box textAlign="center" padding="xxl" color="text-body-secondary">
              <SpaceBetween size="s">
                <b>{items.length === 0 ? 'No use cases' : `No matches for “${filter}”`}</b>
                {items.length === 0 && canWrite && (
                  <div><Button onClick={() => setShowCreate(true)}>Create use case</Button></div>
                )}
              </SpaceBetween>
            </Box>
          ) : (
            <div className="uc-grid">
              {filtered.map((u) => (
                <div
                  key={u.id}
                  className="uc-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${u.name || 'use case'}`}
                  onClick={() => navigate(`${USECASES_BASE}/${u.id}`)}
                  onKeyDown={(e) => {
                    // Only when the card itself is focused (not a child button).
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`${USECASES_BASE}/${u.id}`);
                    }
                  }}
                >
                  <Container
                    fitHeight
                    header={
                      <div className="uc-card-title-row">
                        <span className="uc-card-title">{u.name || '(untitled)'}</span>
                        {u.active ? (
                          <StatusIndicator type="success">Active</StatusIndicator>
                        ) : (
                          <StatusIndicator type="stopped" colorOverride="grey">Inactive</StatusIndicator>
                        )}
                      </div>
                    }
                  >
                    <div className="card-fill">
                      <SpaceBetween size="m">
                        {u.tags?.length ? (
                          <SpaceBetween direction="horizontal" size="xs">
                            {u.tags.map((t) => (
                              <Badge key={t} color="blue">{t}</Badge>
                            ))}
                          </SpaceBetween>
                        ) : null}

                        <div className="uc-card-desc" title={u.description || undefined}>
                          {u.description || (
                            <span className="uc-card-desc--empty">No description</span>
                          )}
                        </div>

                        <div className="uc-card-url" title={u.starting_url || undefined}>
                          <Icon name="external" size="small" />{' '}
                          {u.starting_url || (
                            <span className="uc-card-desc--empty">No starting URL</span>
                          )}
                        </div>

                        {/* Use case id + copy — stopPropagation so it doesn't open the card */}
                        <div className="uc-card-id" onClick={(e) => e.stopPropagation()}>
                          <span className="uc-card-id-label">ID</span>
                          <code className="uc-card-id-val" title={u.id}>{u.id}</code>
                          <Button
                            variant="inline-icon"
                            iconName="copy"
                            ariaLabel={`Copy ID for ${u.name || 'use case'}`}
                            onClick={() =>
                              navigator.clipboard?.writeText(u.id).then(
                                () => flash('success', 'Use case ID copied'),
                                () => flash('error', 'Copy failed'),
                              )
                            }
                          />
                        </div>

                        <Box fontSize="body-s" color="text-body-secondary">
                          {(u.executing_region || '—')} · {(u.created_at || '—')}
                        </Box>
                      </SpaceBetween>

                      {/* Actions, right-aligned; stopPropagation so they don't open the card */}
                      <span className="uc-card-actions" onClick={(e) => e.stopPropagation()}>
                        <Button variant="link" iconName="download" onClick={() => onExport(u)}>Export</Button>
                        {canWrite && (
                          <Button variant="link" iconName="copy" onClick={() => setCloneTarget(u)}>Clone</Button>
                        )}
                        {canWrite && (
                          <span className="wb-danger">
                            <Button variant="link" iconName="remove" onClick={() => setDeleteTarget(u)}>Delete</Button>
                          </span>
                        )}
                        <Button
                          variant="primary"
                          iconName="arrow-right"
                          iconAlign="right"
                          onClick={() => navigate(`${USECASES_BASE}/${u.id}`)}
                        >
                          Open
                        </Button>
                      </span>
                    </div>
                  </Container>
                </div>
              ))}
            </div>
          )}
        </SpaceBetween>
      </Box>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); navigate(`${USECASES_BASE}/${id}`); }}
          onError={(m) => flash('error', m)}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={(id) => { setShowImport(false); flash('success', 'Use case imported'); navigate(`${USECASES_BASE}/${id}`); }}
          onError={(m) => flash('error', m)}
        />
      )}
      {cloneTarget && (
        <CloneModal
          source={cloneTarget}
          onClose={() => setCloneTarget(null)}
          onCloned={(id) => { setCloneTarget(null); flash('success', 'Use case cloned'); navigate(`${USECASES_BASE}/${id}`); }}
          onError={(m) => flash('error', m)}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { const n = deleteTarget.name; setDeleteTarget(null); flash('success', `Deleted “${n}”`); load(); }}
          onError={(m) => flash('error', m)}
        />
      )}
    </AppChrome>
  );
}

// ---- Create ----
function CreateModal({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (id: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startingUrl, setStartingUrl] = useState('');
  const [tags, setTags] = useState('');
  const [active, setActive] = useState(false);
  const [enableCache, setEnableCache] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const created = await api.createUsecase({
        name: name.trim(),
        description,
        starting_url: startingUrl,
        active,
        enableCache,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      onCreated(created.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Create failed');
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
      onDismiss={onClose}
      header="Create use case"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={submit}>Create</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <FormField label="Name"><Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="Login smoke test" /></FormField>
        <FormField label="Description"><Textarea value={description} onChange={({ detail }) => setDescription(detail.value)} /></FormField>
        <FormField label="Starting URL"><Input value={startingUrl} onChange={({ detail }) => setStartingUrl(detail.value)} placeholder="https://example.com" /></FormField>
        <FormField label="Tags" description="Comma-separated"><Input value={tags} onChange={({ detail }) => setTags(detail.value)} placeholder="smoke, auth" /></FormField>
        <Toggle checked={active} onChange={({ detail }) => setActive(detail.checked)}>Active</Toggle>
        <Toggle checked={enableCache} onChange={({ detail }) => setEnableCache(detail.checked)}>Enable cache</Toggle>
      </SpaceBetween>
    </Modal>
  );
}

// ---- Import ----
function ImportModal({ onClose, onImported, onError }: { onClose: () => void; onImported: (id: string) => void; onError: (m: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  // After a successful import that carried secret keys (values never round-trip),
  // hold the result so we can tell the user which secrets still need values.
  const [pending, setPending] = useState<{ id: string; secrets: string[] } | null>(null);

  const submit = async () => {
    let payload: UsecaseExport;
    try {
      payload = JSON.parse(text) as UsecaseExport;
    } catch {
      setParseError('Not valid JSON');
      return;
    }
    setBusy(true);
    try {
      const r = await api.importUsecase(payload);
      const secrets = r.secretsPending ?? [];
      if (secrets.length > 0) {
        setPending({ id: r.usecaseId, secrets });
        setBusy(false);
      } else {
        onImported(r.usecaseId);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Import failed');
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <Modal
        visible
        onDismiss={() => onImported(pending.id)}
        header="Use case imported"
        footer={<Box float="right"><Button variant="primary" onClick={() => onImported(pending.id)}>Open use case</Button></Box>}
      >
        <Alert type="warning" header="Secrets need values">
          Secret values are never exported, so these keys were imported without a value. Set each one in the use case's <b>Secrets</b> tab before running it:
          <Box padding={{ top: 'xs' }}>
            <SpaceBetween direction="horizontal" size="xs">
              {pending.secrets.map((k) => <Badge key={k} color="grey">{k}</Badge>)}
            </SpaceBetween>
          </Box>
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      visible
      onDismiss={onClose}
      header="Import use case"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!text.trim()} onClick={submit}>Import</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <FormField label="Export JSON" description="Paste a use case export (exportVersion 1.0)." errorText={parseError ?? undefined}>
        <Textarea value={text} onChange={({ detail }) => { setText(detail.value); setParseError(null); }} rows={12} placeholder='{ "exportVersion": "1.0", ... }' />
      </FormField>
    </Modal>
  );
}

// ---- Clone ----
function CloneModal({ source, onClose, onCloned, onError }: { source: Usecase; onClose: () => void; onCloned: (id: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState(`${source.name} (copy)`);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.cloneUsecase(source.id, name.trim());
      onCloned(r.usecaseId);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Clone failed');
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      onDismiss={onClose}
      header="Clone use case"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={submit}>Clone</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <FormField label="New name"><Input value={name} onChange={({ detail }) => setName(detail.value)} /></FormField>
    </Modal>
  );
}

// ---- Delete ----
function DeleteModal({ target, onClose, onDeleted, onError }: { target: Usecase; onClose: () => void; onDeleted: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.deleteUsecase(target.id);
      onDeleted();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Delete failed');
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      onDismiss={onClose}
      header="Delete use case"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>Cancel</Button>
            <span className="wb-danger-fill"><Button variant="primary" loading={busy} onClick={submit}>Delete</Button></span>
          </SpaceBetween>
        </Box>
      }
    >
      Permanently delete <b>{target.name || '(untitled)'}</b> and all its steps? This cannot be undone.
    </Modal>
  );
}
