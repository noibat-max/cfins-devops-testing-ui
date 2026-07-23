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
import FileUpload from '@cloudscape-design/components/file-upload';
import Toggle from '@cloudscape-design/components/toggle';
import Checkbox from '@cloudscape-design/components/checkbox';
import RadioGroup from '@cloudscape-design/components/radio-group';
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
  const canWrite = hasScope(user, 'api/qawb/usecases.write');
  const canExecute = hasScope(user, 'api/qawb/usecases.execute');

  const [items, setItems] = useState<Usecase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<Usecase | null>(null);

  // --- bulk selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkRun, setShowBulkRun] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const clearSel = () => setSelected(new Set());

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
                <Button variant="link" iconName="refresh" onClick={load} ariaLabel="Refresh" />
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

          {selected.size > 0 && (
            <div className="uc-selbar">
              <span className="uc-selbar-count">{selected.size} selected</span>
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={clearSel}>Clear</Button>
                {canExecute && (
                  <Button iconName="caret-right-filled" onClick={() => setShowBulkRun(true)}>Run</Button>
                )}
                {canWrite && (
                  <span className="wb-danger">
                    <Button iconName="remove" onClick={() => setShowBulkDelete(true)}>Delete</Button>
                  </span>
                )}
              </SpaceBetween>
            </div>
          )}

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
                  className={`uc-card${selected.has(u.id) ? ' uc-card--selected' : ''}`}
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
                        <span className="uc-card-check" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(u.id)}
                            onChange={() => toggleSel(u.id)}
                            ariaLabel={`Select ${u.name || 'use case'}`}
                          />
                        </span>
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

                        {/* Creator last — variable-length username wraps on its own line */}
                        <Box fontSize="body-s" color="text-body-secondary">
                          <Icon name="user-profile" size="small" /> Created by{' '}
                          <span title={u.created_by || undefined}>{u.created_by || '—'}</span>
                        </Box>
                      </SpaceBetween>

                      {/* Actions, right-aligned; stopPropagation so they don't open the card */}
                      <span className="uc-card-actions" onClick={(e) => e.stopPropagation()}>
                        <Button variant="link" iconName="download" onClick={() => onExport(u)}>Export</Button>
                        {canWrite && (
                          <Button variant="link" iconName="copy" onClick={() => setCloneTarget(u)}>Clone</Button>
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
      {showBulkRun && (
        <BulkRunModal
          ids={Array.from(selected)}
          onClose={() => setShowBulkRun(false)}
          onDone={(mode, ok, failed) => {
            setShowBulkRun(false);
            clearSel();
            const verb = mode === 'queued' ? 'Queued' : 'Launched';
            flash(failed ? 'warning' : 'success',
              `${verb} ${ok} use case${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`);
          }}
        />
      )}
      {showBulkDelete && (
        <BulkDeleteModal
          items={(items ?? []).filter((u) => selected.has(u.id))}
          onClose={() => setShowBulkDelete(false)}
          onDone={(ok, failed) => {
            setShowBulkDelete(false);
            clearSel();
            flash(failed ? 'warning' : 'success',
              `Deleted ${ok} use case${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`);
            load();
          }}
        />
      )}
    </AppChrome>
  );
}

// ---- Bulk run ----
function BulkRunModal({
  ids, onClose, onDone,
}: {
  ids: string[];
  onClose: () => void;
  onDone: (mode: 'run_now' | 'queued', ok: number, failed: number) => void;
}) {
  const [mode, setMode] = useState<'run_now' | 'queued'>('queued');
  const [capture, setCapture] = useState<'screenshots' | 'full'>('screenshots');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.executeUsecase(id, mode, capture)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      onDone(mode, ok, ids.length - ok);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Run failed');
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
      onDismiss={onClose}
      header={`Run ${ids.length} use case${ids.length === 1 ? '' : 's'}`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="primary" iconName="caret-right-filled" loading={busy} onClick={submit}>
              {mode === 'queued' ? 'Queue' : 'Run'}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {err && <Alert type="error">{err}</Alert>}
        <FormField label="When">
          <RadioGroup
            value={mode}
            onChange={({ detail }) => setMode(detail.value as 'run_now' | 'queued')}
            items={[
              { value: 'queued', label: 'Run later', description: 'Queue them — the dispatcher runs them as slots free up (recommended for many).' },
              { value: 'run_now', label: 'Run now', description: 'Launch every selected use case as its own Fargate task, in parallel.' },
            ]}
          />
        </FormField>
        <FormField label="Logs to capture">
          <RadioGroup
            value={capture}
            onChange={({ detail }) => setCapture(detail.value as 'screenshots' | 'full')}
            items={[
              { value: 'screenshots', label: 'Snapshots', description: 'A screenshot after each step (lighter, faster).' },
              { value: 'full', label: 'Full logs', description: 'Also records the HTML trace and a video of each run.' },
            ]}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

// ---- Bulk delete ----
function BulkDeleteModal({
  items, onClose, onDone,
}: {
  items: Usecase[];
  onClose: () => void;
  onDone: (ok: number, failed: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const results = await Promise.allSettled(items.map((u) => api.deleteUsecase(u.id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    onDone(ok, items.length - ok);
  };
  return (
    <Modal
      visible
      onDismiss={onClose}
      header={`Delete ${items.length} use case${items.length === 1 ? '' : 's'}`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose} disabled={busy}>Cancel</Button>
            <span className="wb-danger-fill"><Button iconName="remove" loading={busy} onClick={submit}>Delete</Button></span>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="s">
        <Box>
          Permanently delete these {items.length} use case{items.length === 1 ? '' : 's'}, including their
          steps and all execution history &amp; artifacts? This cannot be undone.
        </Box>
        <ul className="uc-bulk-list">
          {items.map((u) => <li key={u.id}>{u.name || '(untitled)'}</li>)}
        </ul>
      </SpaceBetween>
    </Modal>
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
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  // After a successful import that carried secret keys (values never round-trip),
  // hold the result so we can tell the user which secrets still need values.
  const [pending, setPending] = useState<{ id: string; secrets: string[] } | null>(null);

  const submit = async () => {
    const file = files[0];
    if (!file) return;
    let payload: UsecaseExport;
    try {
      payload = JSON.parse(await file.text()) as UsecaseExport;
    } catch {
      setParseError('The selected file is not valid JSON');
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
            <Button variant="primary" loading={busy} disabled={files.length === 0} onClick={submit}>Import</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <FormField label="Export file" description="Choose a use case export produced by Export (a .json file, exportVersion 1.0)." errorText={parseError ?? undefined}>
        <FileUpload
          value={files}
          onChange={({ detail }) => { setFiles(detail.value); setParseError(null); }}
          accept="application/json,.json"
          tokenLimit={1}
          showFileSize
          showFileLastModified
          constraintText="A single .json use case export."
          i18nStrings={{
            uploadButtonText: (multiple) => (multiple ? 'Choose files' : 'Choose file'),
            dropzoneText: (multiple) => (multiple ? 'Drop files to upload' : 'Drop file to upload'),
            removeFileAriaLabel: (i) => `Remove file ${i + 1}`,
            limitShowFewer: 'Show fewer files',
            limitShowMore: 'Show more files',
            errorIconAriaLabel: 'Error',
          }}
        />
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

