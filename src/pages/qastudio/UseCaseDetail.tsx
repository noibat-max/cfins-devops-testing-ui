import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Tabs from '@cloudscape-design/components/tabs';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Badge from '@cloudscape-design/components/badge';
import Spinner from '@cloudscape-design/components/spinner';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Toggle from '@cloudscape-design/components/toggle';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import AppChrome from '../../components/AppChrome';
import ExecutionHistoryTab from './ExecutionHistoryTab';
import { QA_STUDIO_NAV, QA_STUDIO_APP_NAME } from '../../config/qaStudioNav';
import { useAuth } from '../../lib/auth';
import { hasScope } from '../../types';
import type { Header as HeaderKV, SecretMeta, Step, Usecase, Variable } from '../../types';
import * as api from '../../lib/api';

const USECASES_BASE = '/apps/qa-studio/usecases';
// Canonical QA Studio step types (worker.py dispatch). Labels mirror the sample's StepForm.
const STEP_TYPES: { value: string; label: string }[] = [
  { value: 'navigation', label: 'Navigation' },
  { value: 'url', label: 'URL' },
  { value: 'secret', label: 'Secret' },
  { value: 'validation', label: 'Validation' },
  { value: 'retrieve_value', label: 'Retrieve Value' },
  { value: 'assertion', label: 'Assertion' },
  { value: 'download', label: 'Download' },
];
const STEP_TYPE_LABEL = (v?: string): string =>
  STEP_TYPES.find((t) => t.value === v)?.label ?? v ?? 'navigation';

// ---- Per-type field option sets (mirror the sample's StepForm) ----
type Opt = { label: string; value: string };
const VALIDATION_TYPES: Opt[] = [
  { label: 'Boolean (True/False)', value: 'bool' },
  { label: 'String comparison', value: 'string' },
  { label: 'Number comparison', value: 'number' },
  { label: 'Currency comparison', value: 'currency' },
  { label: 'Date comparison', value: 'date' },
  { label: 'JSON comparison', value: 'json' },
];
const VALUE_TYPES: Opt[] = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'bool' },
  { label: 'Currency', value: 'currency' },
  { label: 'Date', value: 'date' },
  { label: 'JSON', value: 'json' },
];
const NUMERIC_OPS: Opt[] = [
  { label: 'Equals', value: 'equals' },
  { label: 'Less than', value: 'less_then' },
  { label: 'Greater than', value: 'greater_then' },
  { label: 'Greater or equal than', value: 'greater_or_equal_then' },
  { label: 'Less or equal than', value: 'less_or_equal_then' },
];
const OPERATORS: Record<string, Opt[]> = {
  string: [
    { label: 'Exact match', value: 'exact' },
    { label: 'Exact match (case insensitive)', value: 'exact_case_insensitive' },
    { label: 'Not equal', value: 'not_equal' },
    { label: 'Contains', value: 'contains' },
    { label: 'Contains (case insensitive)', value: 'contains_case_insensitive' },
    { label: 'Matches (regex)', value: 'matches' },
  ],
  number: NUMERIC_OPS,
  currency: NUMERIC_OPS, // parsed ($/commas stripped); equals supports a ± tolerance
  date: [
    { label: 'On (same day)', value: 'date_on' },
    { label: 'Before', value: 'date_before' },
    { label: 'After', value: 'date_after' },
    { label: 'Within N days', value: 'within_days' },
  ],
  json: [
    // Deep, order/whitespace-independent — parsed and compared as objects, not text.
    { label: 'Equals (deep)', value: 'json_equals' },
    { label: 'Contains (subset)', value: 'json_contains' },
  ],
};
const BOOLEAN_MODES: Opt[] = [
  { label: 'True', value: 'true' },
  { label: 'False', value: 'false' },
  { label: 'Use variable', value: 'variable' },
];
const DEFAULT_OP = (t: string): string =>
  t === 'string' ? 'exact' : (t === 'number' || t === 'currency') ? 'equals' : t === 'date' ? 'date_on' : t === 'json' ? 'json_equals' : '';
const findOpt = (opts: Opt[], v?: string): Opt | null => opts.find((o) => o.value === v) ?? null;

// Operators that take a ± tolerance / N-days operand (uses validation_tolerance).
const NEEDS_TOLERANCE = (type: string, op: string): boolean =>
  (type === 'currency' && op === 'equals') || (type === 'date' && op === 'within_days');

/** True when a string parses as JSON (used to validate the expected-value field). */
function isValidJson(text: string): boolean {
  try { JSON.parse(text); return true; } catch { return false; }
}
/** True when a string is a valid regular expression. */
function isValidRegex(text: string): boolean {
  try { new RegExp(text); return true; } catch { return false; }
}

// HTTP header field-name token: letters, digits, hyphen/underscore (covers all
// real headers, e.g. Authorization, X-Feature-Flag). No spaces or colons.
const HEADER_NAME_RE = /^[A-Za-z0-9_-]+$/;
function headerNameError(name: string): string | undefined {
  if (!name) return undefined; // emptiness handled by the caller
  if (!HEADER_NAME_RE.test(name)) return 'Letters, digits, hyphens only (e.g. Authorization, X-Api-Key)';
  return undefined;
}

// Human-readable operator labels for the steps-list Details column.
const OP_LABEL: Record<string, string> = Object.fromEntries(
  [...OPERATORS.string, ...OPERATORS.number, ...OPERATORS.date, ...OPERATORS.json].map((o) => [o.value, o.label.toLowerCase()]),
);

/** "<type> <comparison> <value>" as human text: e.g. ":number greater than 1000". */
function checkPhrase(s: Step): string {
  const t = s.validation_type || 'bool';
  if (t === 'bool') return `:bool is ${s.validation_value || 'true'}`;
  const op = OP_LABEL[s.validation_operator ?? ''] ?? s.validation_operator ?? '';
  let val = (s.validation_value || '—').replace(/\s+/g, ' ').trim(); // collapse multi-line JSON
  if (val.length > 40) val = `${val.slice(0, 39)}…`;
  const tol = s.validation_tolerance?.trim();
  const tolStr = tol ? (t === 'date' ? ` (±${tol}d)` : ` (±${tol})`) : '';
  return `:${t} ${op} ${val}${tolStr}`.replace(/\s+/g, ' ').trim();
}

/** Per-type detail as human-readable text — variables in {{}}, data types as :<type>. */
function stepDetailsText(s: Step): string {
  switch (s.step_type) {
    case 'url':
      return s.instruction || '—';
    case 'secret':
      return s.secret_key ? `secret ${s.secret_key}` : '—';
    case 'retrieve_value':
      return s.capture_variable ? `{{${s.capture_variable}}}:${s.value_type || 'string'}` : '—';
    case 'validation':
      return checkPhrase(s);
    case 'assertion':
      return s.assertion_variable ? `{{${s.assertion_variable}}}${checkPhrase(s)}` : '—';
    default:
      return '—';
  }
}

export default function UseCaseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/nova/usecases.write');
  const canManageExec = hasScope(user, 'api/nova/executions.write');

  const [usecase, setUsecase] = useState<Usecase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const flash = useCallback((type: FlashbarProps.Type, content: string) => {
    const fid = `${Date.now()}-${Math.random()}`;
    const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== fid));
    setFlashes((f) => [...f, { id: fid, type, content, dismissible: true, onDismiss: dismiss }]);
    if (type === 'success' || type === 'info') setTimeout(dismiss, 4000);
  }, []);

  const loadUsecase = useCallback(() => {
    api.getUsecase(id).then(setUsecase).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load use case'));
  }, [id]);

  useEffect(() => { loadUsecase(); }, [loadUsecase]);

  if (error) {
    return (
      <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
        <Box padding="l"><Flashbar items={[{ type: 'error', content: error, dismissible: false }]} /></Box>
      </AppChrome>
    );
  }
  if (!usecase) {
    return (
      <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
        <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>
      </AppChrome>
    );
  }

  const onDelete = async () => {
    setDeleting(true);
    try { await api.deleteUsecase(id); navigate(USECASES_BASE); }
    catch (e) { flash('error', e instanceof Error ? e.message : 'Delete failed'); setDeleting(false); setConfirmDelete(false); }
  };

  return (
    <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header
              variant="h1"
              actions={
                canWrite && (
                  <span className="wb-danger-fill">
                    <Button iconName="remove" onClick={() => setConfirmDelete(true)}>Delete</Button>
                  </span>
                )
              }
              info={<Badge color={usecase.active ? 'green' : 'grey'}>{usecase.active ? 'Active' : 'Inactive'}</Badge>}
            >
              <Button
                variant="inline-icon"
                iconName="arrow-left"
                ariaLabel="Back to use cases"
                onClick={() => navigate(USECASES_BASE)}
              />{' '}
              {usecase.name || '(untitled)'}
            </Header>
          </Box>
        }
      >
        <Box padding={{ horizontal: 'l', bottom: 'xxl' }}>
          <SpaceBetween size="l">
            {flashes.length > 0 && <Flashbar items={flashes} />}
            <Tabs
              tabs={[
                {
                  id: 'details',
                  label: 'Details',
                  content: <DetailsTab usecase={usecase} canWrite={canWrite} onSaved={(u) => { setUsecase(u); flash('success', 'Saved'); }} onError={(m) => flash('error', m)} />,
                },
                {
                  id: 'steps',
                  label: 'Workflow Steps',
                  content: <StepsTab usecaseId={id} canWrite={canWrite} onError={(m) => flash('error', m)} />,
                },
                {
                  id: 'vars',
                  label: 'Variables',
                  content: <VariablesTab usecaseId={id} canWrite={canWrite} onFlash={flash} onError={(m) => flash('error', m)} />,
                },
                {
                  id: 'secrets',
                  label: 'Secrets',
                  content: <SecretsTab usecaseId={id} canWrite={canWrite} onFlash={flash} onError={(m) => flash('error', m)} />,
                },
                {
                  id: 'headers',
                  label: 'Headers',
                  content: <HeadersTab usecaseId={id} canWrite={canWrite} onFlash={flash} onError={(m) => flash('error', m)} />,
                },
                {
                  id: 'exec', label: 'Execution History',
                  content: <ExecutionHistoryTab usecaseId={id} canWrite={canManageExec} onFlash={flash} onError={(m) => flash('error', m)} />,
                },
                { id: 'sched', label: 'Schedule', content: <ComingSoon />, disabled: true },
                { id: 'hooks', label: 'Hooks', content: <ComingSoon />, disabled: true },
              ]}
            />
          </SpaceBetween>
        </Box>
      </ContentLayout>
      {confirmDelete && (
        <Modal
          visible
          onDismiss={() => setConfirmDelete(false)}
          header="Delete use case"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <span className="wb-danger-fill"><Button iconName="remove" loading={deleting} onClick={onDelete}>Delete</Button></span>
              </SpaceBetween>
            </Box>
          }
        >
          Delete <b>{usecase.name || 'this use case'}</b>? This permanently removes the use case, its steps, and all execution history &amp; artifacts. This cannot be undone.
        </Modal>
      )}
    </AppChrome>
  );
}

function ComingSoon() {
  return <Box color="text-body-secondary" padding="l">Coming soon — ported in a later slice.</Box>;
}

type FlashFn = (type: FlashbarProps.Type, content: string) => void;

// ---- Variables tab (whole-list replace) ----
function VariablesTab({ usecaseId, canWrite, onFlash, onError }: {
  usecaseId: string; canWrite: boolean; onFlash: FlashFn; onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<Variable[] | null>(null);
  const [loaded, setLoaded] = useState<Variable[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.getVariables(usecaseId)
      .then((r) => { setRows(r.variables); setLoaded(r.variables); })
      .catch((e: unknown) => onError(e instanceof Error ? e.message : 'Failed to load variables'));
  }, [usecaseId, onError]);
  useEffect(load, [load]);

  const dirty = rows !== null && JSON.stringify(rows) !== JSON.stringify(loaded);
  const keys = (rows ?? []).map((r) => r.key.trim());
  const hasEmpty = keys.some((k) => !k);
  const hasEmptyValue = (rows ?? []).some((r) => !r.value.trim());
  const hasDup = new Set(keys).size !== keys.length;
  const hasInvalid = (rows ?? []).some((r) => !!varNameError(r.key.trim()));
  const canSave = canWrite && dirty && !hasEmpty && !hasEmptyValue && !hasDup && !hasInvalid;

  const setRow = (i: number, patch: Partial<Variable>) => setRows((rs) => (rs ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...(rs ?? []), { key: '', value: '' }]);
  const removeRow = (i: number) => setRows((rs) => (rs ?? []).filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true);
    try {
      await api.putVariables(usecaseId, (rows ?? []).map((r) => ({ key: r.key.trim(), value: r.value })));
      onFlash('success', 'Variables saved');
      load();
    } catch (e) { onError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  if (rows === null) return <Box textAlign="center" padding="l"><Spinner /></Box>;

  return (
    <Container
      header={
        <Header
          counter={`(${rows.length})`}
          description={<>Variables are substituted into step text as <code>{'{{key}}'}</code>. Reserved built-ins are provided automatically at run time: <code>{'{{UniqueID}}'}</code>, <code>{'{{Time}}'}</code>, <code>{'{{ExecutionID}}'}</code>.</>}
          actions={canWrite ? (
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" iconName="add-plus" onClick={addRow}>Add</Button>
              <Button variant="primary" loading={saving} disabled={!canSave} onClick={save}>Save</Button>
            </SpaceBetween>
          ) : undefined}
        >
          Variables
        </Header>
      }
    >
      <SpaceBetween size="m">
        {rows.length === 0 && <Box color="text-body-secondary">No variables yet.</Box>}
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 260px' }}>
              <FormField errorText={varNameError(r.key.trim())}>
                <Input value={r.key} disabled={!canWrite} placeholder="snake_case key" onChange={({ detail }) => setRow(i, { key: detail.value })} />
              </FormField>
            </div>
            <div style={{ flex: 1 }}>
              <FormField errorText={r.key.trim() && !r.value.trim() ? 'Value is required' : undefined}>
                <Input value={r.value} disabled={!canWrite} placeholder="value" onChange={({ detail }) => setRow(i, { value: detail.value })} />
              </FormField>
            </div>
            {canWrite && <span className="wb-danger" style={{ paddingTop: 4 }}><Button variant="icon" iconName="remove" ariaLabel="Remove variable" onClick={() => removeRow(i)} /></span>}
          </div>
        ))}
        {(hasEmpty || hasEmptyValue || hasDup) && (
          <Box color="text-status-error" fontSize="body-s">
            {hasEmpty ? 'Every variable needs a key. ' : ''}{hasEmptyValue ? 'Every variable needs a value. ' : ''}{hasDup ? 'Keys must be unique.' : ''}
          </Box>
        )}
      </SpaceBetween>
    </Container>
  );
}

// ---- Headers tab (custom HTTP headers; values support {{variables}}) ----
function HeadersTab({ usecaseId, canWrite, onFlash, onError }: {
  usecaseId: string; canWrite: boolean; onFlash: FlashFn; onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<HeaderKV[] | null>(null);
  const [loaded, setLoaded] = useState<HeaderKV[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.getHeaders(usecaseId)
      .then((r) => { setRows(r.headers); setLoaded(r.headers); })
      .catch((e: unknown) => onError(e instanceof Error ? e.message : 'Failed to load headers'));
  }, [usecaseId, onError]);
  useEffect(load, [load]);

  const dirty = rows !== null && JSON.stringify(rows) !== JSON.stringify(loaded);
  const names = (rows ?? []).map((r) => r.name.trim());
  const hasEmpty = names.some((n) => !n);
  const hasEmptyValue = (rows ?? []).some((r) => !r.value.trim());
  const hasDup = new Set(names.map((n) => n.toLowerCase())).size !== names.length; // header names are case-insensitive
  const hasInvalid = (rows ?? []).some((r) => !!headerNameError(r.name.trim()));
  const canSave = canWrite && dirty && !hasEmpty && !hasEmptyValue && !hasDup && !hasInvalid;

  const setRow = (i: number, patch: Partial<HeaderKV>) => setRows((rs) => (rs ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...(rs ?? []), { name: '', value: '' }]);
  const removeRow = (i: number) => setRows((rs) => (rs ?? []).filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true);
    try {
      await api.putHeaders(usecaseId, (rows ?? []).map((r) => ({ name: r.name.trim(), value: r.value })));
      onFlash('success', 'Headers saved');
      load();
    } catch (e) { onError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  if (rows === null) return <Box textAlign="center" padding="l"><Spinner /></Box>;

  return (
    <Container
      header={
        <Header
          counter={`(${rows.length})`}
          description={<>Custom HTTP headers are injected into every request the browser makes. Values support <code>{'{{variables}}'}</code> and built-ins (resolved at run time) — so a token captured earlier can flow into e.g. <code>Authorization</code>.</>}
          actions={canWrite ? (
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" iconName="add-plus" onClick={addRow}>Add</Button>
              <Button variant="primary" loading={saving} disabled={!canSave} onClick={save}>Save</Button>
            </SpaceBetween>
          ) : undefined}
        >
          Headers
        </Header>
      }
    >
      <SpaceBetween size="m">
        {rows.length === 0 && <Box color="text-body-secondary">No headers yet.</Box>}
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 260px' }}>
              <FormField errorText={headerNameError(r.name.trim())}>
                <Input value={r.name} disabled={!canWrite} placeholder="Header name" onChange={({ detail }) => setRow(i, { name: detail.value })} />
              </FormField>
            </div>
            <div style={{ flex: 1 }}>
              <FormField errorText={r.name.trim() && !r.value.trim() ? 'Value is required' : undefined}>
                <Input value={r.value} disabled={!canWrite} placeholder="Value (supports {{variables}})" onChange={({ detail }) => setRow(i, { value: detail.value })} />
              </FormField>
            </div>
            {canWrite && <span className="wb-danger" style={{ paddingTop: 4 }}><Button variant="icon" iconName="remove" ariaLabel="Remove header" onClick={() => removeRow(i)} /></span>}
          </div>
        ))}
        {(hasEmpty || hasEmptyValue || hasDup) && (
          <Box color="text-status-error" fontSize="body-s">
            {hasEmpty ? 'Every header needs a name. ' : ''}{hasEmptyValue ? 'Every header needs a value. ' : ''}{hasDup ? 'Header names must be unique.' : ''}
          </Box>
        )}
      </SpaceBetween>
    </Container>
  );
}

// ---- Secrets tab (AWS Secrets Manager; values write-only) ----
function SecretsTab({ usecaseId, canWrite, onFlash, onError }: {
  usecaseId: string; canWrite: boolean; onFlash: FlashFn; onError: (m: string) => void;
}) {
  const [secrets, setSecrets] = useState<SecretMeta[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<SecretMeta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretMeta | null>(null);

  const load = useCallback(() => {
    api.listSecrets(usecaseId)
      .then((r) => setSecrets(r.secrets))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : 'Failed to load secrets'));
  }, [usecaseId, onError]);
  useEffect(load, [load]);

  // Secrets Manager's ListSecrets is eventually consistent, so we reflect
  // mutations locally rather than re-listing (which can briefly miss a new key).
  const upsertLocal = (m: SecretMeta) => setSecrets((prev) => {
    const rest = (prev ?? []).filter((s) => s.key !== m.key);
    return [...rest, m].sort((a, b) => a.key.localeCompare(b.key));
  });
  const removeLocal = (key: string) => setSecrets((prev) => (prev ?? []).filter((s) => s.key !== key));

  return (
    <>
      <Table<SecretMeta>
        items={secrets ?? []}
        loading={secrets === null}
        loadingText="Loading secrets"
        trackBy="key"
        empty={<Box textAlign="center" padding="m" color="text-body-secondary">No secrets yet.</Box>}
        header={
          <Header
            counter={secrets ? `(${secrets.length})` : undefined}
            description="Values are write-only — you can set or replace a secret, but never read it back. A Secret step references a key here."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="icon" iconName="refresh" ariaLabel="Refresh" onClick={load} />
                {canWrite && <Button variant="link" iconName="add-plus" onClick={() => setShowAdd(true)}>Add</Button>}
              </SpaceBetween>
            }
          >
            Secrets
          </Header>
        }
        columnDefinitions={[
          { id: 'key', header: 'Key', cell: (s) => <b>{s.key}</b>, isRowHeader: true },
          { id: 'desc', header: 'Description', cell: (s) => s.description || '—' },
          { id: 'created', header: 'Created', cell: (s) => s.created_at || '—' },
          {
            id: 'actions', header: '',
            cell: (s) => (canWrite ? (
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="inline-link" onClick={() => setUpdateTarget(s)}>Update value</Button>
                <span className="wb-danger"><Button variant="inline-icon" iconName="remove" ariaLabel="Delete secret" onClick={() => setDeleteTarget(s)} /></span>
              </SpaceBetween>
            ) : null),
          },
        ]}
      />
      {showAdd && (
        <AddSecretModal
          existingKeys={(secrets ?? []).map((s) => s.key)}
          onClose={() => setShowAdd(false)}
          onSubmit={(payload) => api.createSecret(usecaseId, payload)}
          onDone={(meta) => { setShowAdd(false); upsertLocal({ key: meta.key, description: meta.description, created_at: '' }); onFlash('success', `Secret “${meta.key}” saved`); }}
        />
      )}
      {updateTarget && (
        <UpdateSecretModal
          target={updateTarget}
          onClose={() => setUpdateTarget(null)}
          onSubmit={(value) => api.updateSecret(usecaseId, updateTarget.key, value)}
          onDone={() => { const k = updateTarget.key; setUpdateTarget(null); onFlash('success', `Updated “${k}”`); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteSecretModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSubmit={() => api.deleteSecret(usecaseId, deleteTarget.key)}
          onDone={() => { const k = deleteTarget.key; setDeleteTarget(null); removeLocal(k); onFlash('success', `Deleted “${k}”`); }}
        />
      )}
    </>
  );
}

function AddSecretModal({ existingKeys, onClose, onSubmit, onDone }: {
  existingKeys: string[];
  onClose: () => void;
  onSubmit: (p: { key: string; value: string; description?: string }) => Promise<unknown>;
  onDone: (meta: { key: string; description: string }) => void;
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const keyError = /\s/.test(key) ? 'Key cannot contain spaces' : undefined;
  const overwrites = existingKeys.includes(key.trim());
  const canSubmit = !!key.trim() && !keyError && !!value;

  const submit = async () => {
    setErr(null); setBusy(true);
    try { await onSubmit({ key: key.trim(), value, description: description.trim() || undefined }); onDone({ key: key.trim(), description: description.trim() }); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); setBusy(false); }
  };

  return (
    <Modal visible onDismiss={onClose} header="Add secret"
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!canSubmit} onClick={submit}>Save</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        {err && <Box color="text-status-error">{err}</Box>}
        <FormField label="Key" description="Referenced by a Secret step." errorText={keyError}>
          <Input value={key} placeholder="e.g. portal_password" onChange={({ detail }) => setKey(detail.value)} />
        </FormField>
        {overwrites && !keyError && <Box color="text-status-warning" fontSize="body-s">A secret with this key exists — saving overwrites its value.</Box>}
        <FormField label="Value" description="Stored encrypted in Secrets Manager; never shown again.">
          <Input type="password" value={value} onChange={({ detail }) => setValue(detail.value)} />
        </FormField>
        <FormField label="Description" description="Optional.">
          <Input value={description} onChange={({ detail }) => setDescription(detail.value)} />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

function UpdateSecretModal({ target, onClose, onSubmit, onDone }: {
  target: SecretMeta; onClose: () => void; onSubmit: (value: string) => Promise<unknown>; onDone: () => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setErr(null); setBusy(true);
    try { await onSubmit(value); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Update failed'); setBusy(false); }
  };
  return (
    <Modal visible onDismiss={onClose} header={`Update “${target.key}”`}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!value} onClick={submit}>Update</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        {err && <Box color="text-status-error">{err}</Box>}
        <FormField label="New value" description="Replaces the current value. The old value cannot be recovered.">
          <Input type="password" value={value} onChange={({ detail }) => setValue(detail.value)} />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

function ConfirmDeleteSecretModal({ target, onClose, onSubmit, onDone }: {
  target: SecretMeta; onClose: () => void; onSubmit: () => Promise<unknown>; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setErr(null); setBusy(true);
    try { await onSubmit(); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Delete failed'); setBusy(false); }
  };
  return (
    <Modal visible onDismiss={onClose} header={`Delete “${target.key}”`}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><span className="wb-danger-fill"><Button variant="primary" loading={busy} onClick={submit}>Delete</Button></span></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        {err && <Box color="text-status-error">{err}</Box>}
        <Box>Delete secret <b>{target.key}</b>? Any Secret step referencing it will fail until re-created. This cannot be undone.</Box>
      </SpaceBetween>
    </Modal>
  );
}

// ---- Details tab (inline edit) ----
function DetailsTab({ usecase, canWrite, onSaved, onError }: { usecase: Usecase; canWrite: boolean; onSaved: (u: Usecase) => void; onError: (m: string) => void }) {
  const [name, setName] = useState(usecase.name);
  const [description, setDescription] = useState(usecase.description);
  const [startingUrl, setStartingUrl] = useState(usecase.starting_url);
  const [region, setRegion] = useState(usecase.executing_region);
  const [modelId, setModelId] = useState(usecase.model_id);
  const [tags, setTags] = useState((usecase.tags ?? []).join(', '));
  const [active, setActive] = useState(usecase.active);
  const [enableCache, setEnableCache] = useState(usecase.enableCache);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.updateUsecase(usecase.id, {
        name: name.trim(), description, starting_url: startingUrl,
        executing_region: region, model_id: modelId, active, enableCache,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      const fresh = await api.getUsecase(usecase.id);
      onSaved(fresh);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const ro = !canWrite;
  return (
    <Container>
      <SpaceBetween size="m">
        <FormField label="Use case ID" description="System-assigned, read-only."><Input value={usecase.id} disabled readOnly /></FormField>
        <FormField label="Name"><Input value={name} readOnly={ro} onChange={({ detail }) => setName(detail.value)} /></FormField>
        <FormField label="Description"><Textarea value={description} readOnly={ro} onChange={({ detail }) => setDescription(detail.value)} /></FormField>
        <FormField label="Starting URL"><Input value={startingUrl} readOnly={ro} onChange={({ detail }) => setStartingUrl(detail.value)} /></FormField>
        <FormField label="Executing region"><Input value={region} readOnly={ro} onChange={({ detail }) => setRegion(detail.value)} /></FormField>
        <FormField label="Model"><Input value={modelId} readOnly={ro} onChange={({ detail }) => setModelId(detail.value)} /></FormField>
        <FormField label="Tags" description="Comma-separated"><Input value={tags} readOnly={ro} onChange={({ detail }) => setTags(detail.value)} /></FormField>
        <Toggle checked={active} disabled={ro} onChange={({ detail }) => setActive(detail.checked)}>Active</Toggle>
        <Toggle checked={enableCache} disabled={ro} onChange={({ detail }) => setEnableCache(detail.checked)}>Enable cache</Toggle>
        {canWrite && (
          <Box><Button variant="primary" loading={busy} disabled={!name.trim()} onClick={save}>Save</Button></Box>
        )}
      </SpaceBetween>
    </Container>
  );
}

// ---- Workflow Steps tab ----
function StepsTab({ usecaseId, canWrite, onError }: { usecaseId: string; canWrite: boolean; onError: (m: string) => void }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [predefinedVars, setPredefinedVars] = useState<string[]>([]);
  const [editStep, setEditStep] = useState<Step | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Step | null>(null);
  const [deletingStep, setDeletingStep] = useState(false);

  const load = useCallback(() => {
    api.listSteps(usecaseId).then((r) => setSteps(r.steps)).catch((e: unknown) => onError(e instanceof Error ? e.message : 'Failed to load steps'));
  }, [usecaseId, onError]);

  // Secret keys + predefined variables feed the step editor's pickers/helpers.
  // Best-effort — authoring still works if either list can't be loaded.
  const loadSecrets = useCallback(() => {
    api.listSecrets(usecaseId).then((r) => setSecretKeys(r.secrets.map((s) => s.key))).catch(() => undefined);
  }, [usecaseId]);
  const loadVars = useCallback(() => {
    api.getVariables(usecaseId).then((r) => setPredefinedVars(r.variables.map((v) => v.key).filter(Boolean))).catch(() => undefined);
  }, [usecaseId]);

  useEffect(() => { load(); loadSecrets(); loadVars(); }, [load, loadSecrets, loadVars]);

  const move = async (index: number, dir: -1 | 1) => {
    if (!steps) return;
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next); // optimistic
    setReordering(true);
    try {
      await api.reorderSteps(usecaseId, next.map((s, i) => ({ step_id: s.id, sort: i + 1 })));
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Reorder failed');
      load();
    } finally {
      setReordering(false);
    }
  };

  const remove = async (s: Step) => {
    setDeletingStep(true);
    try { await api.deleteStep(usecaseId, s.id); setDeleteTarget(null); load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setDeletingStep(false); }
  };

  return (
    <>
      <Table<Step>
        items={steps ?? []}
        loading={steps === null}
        loadingText="Loading steps"
        trackBy="id"
        empty={<Box textAlign="center" padding="m" color="text-body-secondary">No steps yet.</Box>}
        header={
          <Header
            counter={steps ? `(${steps.length})` : undefined}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" iconName="script" disabled={!steps || steps.length === 0} onClick={() => setShowCommands(true)}>
                  Nova Act commands
                </Button>
                {canWrite && <Button variant="primary" iconName="add-plus" onClick={() => { loadSecrets(); loadVars(); setShowAdd(true); }}>Add step</Button>}
              </SpaceBetween>
            }
          >
            Workflow steps
          </Header>
        }
        columnDefinitions={[
          { id: 'order', header: '#', width: 60, cell: (_s: Step) => (steps ? steps.indexOf(_s) + 1 : '') },
          { id: 'instruction', header: 'Instruction', cell: (s) => s.instruction, isRowHeader: true },
          { id: 'type', header: 'Type', cell: (s) => <Badge>{STEP_TYPE_LABEL(s.step_type)}</Badge> },
          { id: 'details', header: 'Details', cell: (s) => <Box color="text-body-secondary" fontSize="body-s"><span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{stepDetailsText(s)}</span></Box> },
          {
            id: 'actions',
            header: '',
            cell: (s) => {
              if (!canWrite) return null;
              const i = steps ? steps.indexOf(s) : -1;
              return (
                <SpaceBetween direction="horizontal" size="xxs">
                  <Button variant="inline-icon" iconName="angle-up" disabled={reordering || i <= 0} ariaLabel="Move up" onClick={() => move(i, -1)} />
                  <Button variant="inline-icon" iconName="angle-down" disabled={reordering || !steps || i >= steps.length - 1} ariaLabel="Move down" onClick={() => move(i, 1)} />
                  <Button variant="inline-icon" iconName="edit" ariaLabel="Edit" onClick={() => { loadSecrets(); loadVars(); setEditStep(s); }} />
                  <span className="wb-danger">
                    <Button variant="inline-icon" iconName="remove" ariaLabel="Delete" onClick={() => setDeleteTarget(s)} />
                  </span>
                </SpaceBetween>
              );
            },
          },
        ]}
      />
      {showAdd && (
        <StepModal
          title="Add step"
          nextSort={(steps?.length ?? 0) + 1}
          existingSteps={steps ?? []}
          secretKeys={secretKeys}
          predefinedVars={predefinedVars}
          onClose={() => setShowAdd(false)}
          onSubmit={async (payload) => { await api.createStep(usecaseId, payload); setShowAdd(false); load(); }}
          onError={onError}
        />
      )}
      {editStep && (
        <StepModal
          title="Edit step"
          initial={editStep}
          existingSteps={steps ?? []}
          secretKeys={secretKeys}
          predefinedVars={predefinedVars}
          onClose={() => setEditStep(null)}
          onSubmit={async (payload) => { await api.updateStep(usecaseId, editStep.id, payload); setEditStep(null); load(); }}
          onError={onError}
        />
      )}
      {showCommands && <NovaCommandsModal steps={steps ?? []} onClose={() => setShowCommands(false)} />}
      {deleteTarget && (
        <Modal
          visible
          onDismiss={() => setDeleteTarget(null)}
          header="Delete step"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <span className="wb-danger-fill"><Button iconName="remove" loading={deletingStep} onClick={() => remove(deleteTarget)}>Delete</Button></span>
              </SpaceBetween>
            </Box>
          }
        >
          Delete step {deleteTarget.sort} (<b>{deleteTarget.step_type}</b>)? This cannot be undone.
        </Modal>
      )}
    </>
  );
}

/** Read-only preview of the whole workflow as Nova Act commands, for review. */
function NovaCommandsModal({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  const script = workflowNovaCommands(steps);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(script).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => undefined);
  };
  return (
    <Modal
      visible
      size="large"
      onDismiss={onClose}
      header="Nova Act commands"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button iconName={copied ? 'status-positive' : 'copy'} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
            <Button variant="primary" onClick={onClose}>Close</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="s">
        <Box color="text-body-secondary" fontSize="body-s">
          The Nova Act calls this workflow generates, plus the Python <code>assert</code> for each validation/assertion — for review. Variables stay as <code>{'{{name}}'}</code> (resolved at run time); secret values show as the placeholder <code>{'{{key value}}'}</code> and are never revealed.
        </Box>
        <pre style={{
          margin: 0, padding: '12px 14px', borderRadius: 8,
          background: '#f4f6f9', border: '1px solid #d5dbdb',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 12.5, lineHeight: 1.55, color: '#16191f',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto', maxHeight: '55vh',
        }}>
          {script || '# No steps yet.'}
        </pre>
      </SpaceBetween>
    </Modal>
  );
}

// ---- Live "what the worker runs" preview ----
// Mirrors sample-qa-studio/web-app/worker dispatch (worker.py:486) so authors see
// the exact Nova Act call(s) each step produces.
const SCHEMA_NAME: Record<string, string> = { bool: 'BOOL_SCHEMA', string: 'STRING_SCHEMA', number: 'NUMBER_SCHEMA', currency: 'STRING_SCHEMA', date: 'STRING_SCHEMA', json: 'OBJECT_SCHEMA' };
const q = (v: string, fallback: string) => JSON.stringify(v.trim() || fallback);

const NUM_OP: Record<string, string> = { equals: '==', less_then: '<', greater_then: '>', greater_or_equal_then: '>=', less_or_equal_then: '<=' };

/** Python-ish comparison expression matching the worker's operators. */
function comparisonExpr(actual: string, type: string, operator: string, value: string, tolerance = ''): string {
  // bool defaults to `true` when unset; string/number show a … placeholder.
  if (type === 'bool') return `${actual} == ${value.trim() || 'true'}`;
  if (type === 'json') {
    // Parse both sides → structural compare (order/whitespace independent).
    const expected = `json.loads(${JSON.stringify(value.trim() || '{}')})`;
    const actualJson = `json.loads(${actual})`;
    return operator === 'json_contains'
      ? `json_contains(${actualJson}, ${expected})`
      : `${actualJson} == ${expected}`;
  }
  const v = value.trim() || '…';
  if (type === 'number') {
    return `float(${actual}) ${NUM_OP[operator] ?? '=='} ${v}`;
  }
  if (type === 'currency') {
    // Strip $/commas → number; equals honours a ± tolerance.
    if (operator === 'equals') return `abs(money(${actual}) - money(${JSON.stringify(v)})) <= ${tolerance.trim() || '0'}`;
    return `money(${actual}) ${NUM_OP[operator] ?? '=='} money(${JSON.stringify(v)})`;
  }
  if (type === 'date') {
    const a = `date(${actual})`;
    const e = `date(${JSON.stringify(v)})`;
    if (operator === 'date_before') return `${a} < ${e}`;
    if (operator === 'date_after') return `${a} > ${e}`;
    if (operator === 'within_days') return `abs((${a} - ${e}).days) <= ${tolerance.trim() || '0'}`;
    return `${a} == ${e}`; // date_on
  }
  // string
  switch (operator) {
    case 'not_equal': return `${actual} != ${JSON.stringify(v)}`;
    case 'contains': return `${JSON.stringify(v)} in ${actual}`;
    case 'contains_case_insensitive': return `${JSON.stringify(v)}.lower() in ${actual}.lower()`;
    case 'exact_case_insensitive': return `${actual}.lower() == ${JSON.stringify(v)}.lower()`;
    case 'matches': return `re.search(${JSON.stringify(v)}, ${actual}) is not None`;
    default: return `${actual} == ${JSON.stringify(v)}`; // exact
  }
}

function buildNovaPreview(s: {
  stepType: string; instruction: string; secretKey: string;
  validationType: string; validationOperator: string; validationValue: string; validationTolerance: string; boolMode: string;
  captureVariable: string; valueType: string; assertionVariable: string;
}): string {
  const instr = (fb = 'instruction') => q(s.instruction, `<${fb}>`);
  switch (s.stepType) {
    case 'url':
      return `nova.go_to_url(${instr('url')})`;
    case 'secret':
      return [
        `nova.act(${q(s.instruction, '<instruction>')} + " you must return true if the action was successful", schema=BOOL_SCHEMA)`,
        `nova.page.keyboard.type(  ← value of secret "${s.secretKey.trim() || '<secret_key>'}" )`,
      ].join('\n');
    case 'validation': {
      const schema = SCHEMA_NAME[s.validationType] ?? 'STRING_SCHEMA';
      const expected = s.validationType === 'bool' ? (s.boolMode === 'variable' ? s.validationValue : s.boolMode) : s.validationValue;
      return [
        `r = nova.act_get(${instr()}, schema=${schema})`,
        `# passes when:  ${comparisonExpr('r.parsed_response', s.validationType, s.validationOperator, expected, s.validationTolerance)}`,
      ].join('\n');
    }
    case 'retrieve_value': {
      const schema = SCHEMA_NAME[s.valueType] ?? 'STRING_SCHEMA';
      const name = s.captureVariable.trim() || '<name>';
      // JSON is stored with json.dumps (valid JSON), never str() (Python repr).
      const rhs = s.valueType === 'json' ? 'json.dumps(r.parsed_response)' : 'r.parsed_response';
      return [
        `r = nova.act_get(${instr()}, schema=${schema})`,
        `runtime["${name}"] = ${rhs}      # usable later as {{${name}}}`,
      ].join('\n');
    }
    case 'assertion': {
      const va = s.assertionVariable || '<variable>';
      const expected = s.validationType === 'bool' ? (s.boolMode === 'variable' ? s.validationValue : s.boolMode) : s.validationValue;
      return [
        `# no browser call — compares a previously captured variable`,
        `# passes when:  ${comparisonExpr(`runtime["${va}"]`, s.validationType, s.validationOperator, expected, s.validationTolerance)}`,
      ].join('\n');
    }
    case 'download':
      return [`with nova.page.expect_download():`, `    nova.act(${instr()})`, `# downloaded file uploaded to S3`].join('\n');
    default: // navigation
      return `nova.act(${instr()})`;
  }
}

// ---- Workflow-level Nova Act command preview (for review) ----
// The Nova Act calls, plus the Python `assert` for validation/assertion checks.
// Variables stay as {{name}}; secret values render as the placeholder {{<key> value}}.
function stepNovaCommands(s: Step): string[] {
  const instr = q(s.instruction, '<instruction>');
  switch (s.step_type) {
    case 'url':
      return [`nova.go_to_url(${q(s.instruction, '<url>')})`];
    case 'secret':
      return [
        `nova.act(${instr})`,
        `nova.page.keyboard.type("{{${s.secret_key || '<secret_key>'} value}}")`,
      ];
    case 'retrieve_value': {
      const schema = SCHEMA_NAME[s.value_type ?? ''] ?? 'STRING_SCHEMA';
      return [`{{${s.capture_variable || '<name>'}}} = nova.act_get(${instr}, schema=${schema})`];
    }
    case 'validation': {
      const schema = SCHEMA_NAME[s.validation_type ?? ''] ?? 'STRING_SCHEMA';
      return [
        `r = nova.act_get(${instr}, schema=${schema})`,
        `assert ${comparisonExpr('r.parsed_response', s.validation_type || 'bool', s.validation_operator ?? '', s.validation_value ?? '', s.validation_tolerance ?? '')}`,
      ];
    }
    case 'assertion':
      // Pure Python — compares a captured variable, no Nova Act call.
      return [`assert ${comparisonExpr(`{{${s.assertion_variable || '<variable>'}}}`, s.validation_type || 'bool', s.validation_operator ?? '', s.validation_value ?? '', s.validation_tolerance ?? '')}`];
    case 'download':
      return [`with nova.page.expect_download():`, `    nova.act(${instr})`];
    default: // navigation
      return [`nova.act(${instr})`];
  }
}

/** Full workflow as a Nova Act command script, grouped per step. */
function workflowNovaCommands(steps: Step[]): string {
  const sorted = [...steps].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return sorted
    .map((s, i) => {
      const cmds = stepNovaCommands(s);
      const header = `# Step ${i + 1} — ${STEP_TYPE_LABEL(s.step_type)}`;
      const body = cmds.length ? cmds.join('\n') : '# (no Nova Act command — variable assertion)';
      return `${header}\n${body}`;
    })
    .join('\n\n');
}

// One-line explanation of each step type, shown under the Step type selector so
// authors know what the selected type does without guessing.
const STEP_TYPE_HELP: Record<string, string> = {
  navigation: 'Drives the browser with a plain-English action — click, type, scroll, or select.',
  url: 'Navigates straight to a URL. Deterministic — no AI reasoning.',
  secret: 'Performs the action, then types a secret value (from Secrets Manager) — never shown in logs.',
  validation: 'Reads the live page and checks it against an expected value. Passes or fails the test.',
  retrieve_value: 'Reads a value off the page and stores it in a variable for later steps to use.',
  assertion: 'Compares a previously captured variable against an expected value. No browser action.',
  download: 'Triggers a file download and captures the artifact.',
};

// Variable names must be snake_case identifiers so they're safe in {{name}}
// templating: lowercase start, then lowercase letters / digits / underscores.
const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;
function varNameError(name: string): string | undefined {
  if (!name) return undefined; // emptiness handled by the caller
  if (/\s/.test(name)) return 'No spaces — use snake_case';
  if (!SNAKE_CASE_RE.test(name)) return 'Use snake_case: lowercase letters, digits and underscores; start with a letter';
  return undefined;
}

const INSTRUCTION_HELP: Record<string, { desc: string; placeholder: string }> = {
  navigation: { desc: 'Describe the action to perform on the page.', placeholder: 'e.g. Click the "Get a quote" button' },
  url: { desc: 'The URL to navigate to.', placeholder: 'https://portal.example.com/login' },
  secret: { desc: 'Describe the action that focuses the field; the secret is typed after.', placeholder: 'e.g. Click the Password field' },
  validation: { desc: 'Describe what to read off the page for the check.', placeholder: 'e.g. Is the status "Bound"?' },
  retrieve_value: { desc: 'Describe the value to capture from the page.', placeholder: 'e.g. Get the generated policy number' },
  download: { desc: 'Describe the action that triggers the download.', placeholder: 'e.g. Click "Download policy PDF"' },
};

/** Which boolean input mode a stored validation_value implies. */
function initialBoolMode(v?: string): string {
  if (v === 'true' || v === 'false') return v;
  return v ? 'variable' : 'true';
}

const BUILTIN_VARS = ['UniqueID', 'Time', 'ExecutionID'];
const VAR_TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const usedVarTokens = (text: string): string[] => [...text.matchAll(VAR_TOKEN_RE)].map((m) => m[1]);

/** One labelled row of click-to-insert variable chips. */
function VarRow({ label, vars, onInsert }: { label: string; vars: string[]; onInsert: (v: string) => void }) {
  if (!vars.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
      <Box fontSize="body-s" color="text-body-secondary" fontWeight="bold">{label}:</Box>
      {vars.map((v) => (
        <Button key={v} variant="inline-link" onClick={() => onInsert(v)}>{`{{${v}}}`}</Button>
      ))}
    </div>
  );
}

function StepModal({ title, initial, nextSort, existingSteps, secretKeys, predefinedVars, onClose, onSubmit, onError }: {
  title: string;
  initial?: Step;
  nextSort?: number;
  existingSteps: Step[];
  secretKeys: string[];
  predefinedVars: string[];
  onClose: () => void;
  onSubmit: (payload: Partial<Step>) => Promise<void>;
  onError: (m: string) => void;
}) {
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');
  const [stepType, setStepType] = useState(initial?.step_type || 'navigation');
  const [secretKey, setSecretKey] = useState(initial?.secret_key ?? '');
  const [validationType, setValidationType] = useState(initial?.validation_type || 'bool');
  const [validationOperator, setValidationOperator] = useState(initial?.validation_operator ?? '');
  const [validationValue, setValidationValue] = useState(initial?.validation_value ?? '');
  const [validationTolerance, setValidationTolerance] = useState(initial?.validation_tolerance ?? '');
  const [captureVariable, setCaptureVariable] = useState(initial?.capture_variable ?? '');
  const [valueType, setValueType] = useState(initial?.value_type || 'string');
  const [assertionVariable, setAssertionVariable] = useState(initial?.assertion_variable ?? '');
  const [boolMode, setBoolMode] = useState(initialBoolMode(initial?.validation_value));
  const [busy, setBusy] = useState(false);

  // Runtime variables captured by earlier retrieve_value steps — the source for assertions.
  const runtimeVars = existingSteps
    .filter((s) => s.step_type === 'retrieve_value' && s.capture_variable && s.id !== initial?.id)
    .map((s) => ({ label: s.capture_variable as string, value: s.capture_variable as string, description: `From step ${s.sort}: ${s.instruction}` }));

  const needsInstruction = stepType !== 'assertion';
  const isCheck = stepType === 'validation' || stepType === 'assertion'; // share the comparison block

  // Variables available to reference as {{name}} at THIS step's position:
  //   predefined (Variables tab) + captured by earlier retrieve_value steps + built-ins.
  const currentSort = initial?.sort ?? nextSort ?? Number.MAX_SAFE_INTEGER;
  const capturedVars = [
    ...new Set(
      existingSteps
        .filter((s) => s.step_type === 'retrieve_value' && s.capture_variable && s.id !== initial?.id && (s.sort ?? 0) < currentSort)
        .map((s) => s.capture_variable as string),
    ),
  ];
  const knownVars = new Set([...predefinedVars, ...capturedVars, ...BUILTIN_VARS]);
  // Tokens the author typed that resolve to nothing (typos, or a var not yet defined).
  const referenced = [...usedVarTokens(instruction), ...(isCheck && validationType !== 'bool' ? usedVarTokens(validationValue) : [])];
  const unknownVars = [...new Set(referenced.filter((t) => !knownVars.has(t)))];

  // Click-to-insert drops {{name}} at the end of the instruction (the primary
  // templated field). Cursor-precise insertion isn't worth the ref plumbing here.
  const insertVar = (name: string) => setInstruction((v) => `${v}${v && !v.endsWith(' ') ? ' ' : ''}{{${name}}}`);

  // Changing validation type resets the operator to its type default and clears the value.
  const changeValidationType = (t: string) => {
    setValidationType(t);
    setValidationOperator(DEFAULT_OP(t));
    setValidationValue(t === 'bool' ? 'true' : '');
    setValidationTolerance('');
    setBoolMode('true');
  };

  const regexInvalid = validationType === 'string' && validationOperator === 'matches' && !!validationValue.trim() && !isValidRegex(validationValue);
  const toleranceNeeded = isCheck && NEEDS_TOLERANCE(validationType, validationOperator);

  const canSubmit = (() => {
    if (needsInstruction && !instruction.trim()) return false;
    if (stepType === 'secret' && !secretKey.trim()) return false;
    if (stepType === 'retrieve_value' && (!captureVariable.trim() || !!varNameError(captureVariable.trim()))) return false;
    if (stepType === 'assertion' && !assertionVariable) return false;
    if (isCheck) {
      if (validationType === 'bool') return boolMode !== 'variable' || !!validationValue.trim();
      if (validationType === 'json') return !!validationOperator && isValidJson(validationValue);
      if (!validationOperator || !validationValue.trim()) return false;
      if (regexInvalid) return false;
      if (toleranceNeeded && !validationTolerance.trim()) return false;
      return true;
    }
    return true;
  })();

  const submit = async () => {
    setBusy(true);
    try {
      // Send only the fields relevant to the chosen type; others stay empty.
      const payload: Partial<Step> = { step_type: stepType, instruction: instruction.trim() };
      if (stepType === 'secret') payload.secret_key = secretKey.trim();
      if (stepType === 'retrieve_value') {
        payload.capture_variable = captureVariable.trim();
        payload.value_type = valueType;
      }
      // For bool, the value is the mode (true/false) unless it's a variable
      // expression — so an untouched "True" default still saves "true", not "".
      const checkValue = validationType === 'bool'
        ? (boolMode === 'variable' ? validationValue.trim() : boolMode)
        : validationValue.trim();
      if (isCheck) {
        payload.validation_type = validationType;
        if (validationType !== 'bool') payload.validation_operator = validationOperator;
        payload.validation_value = checkValue;
        payload.validation_tolerance = toleranceNeeded ? validationTolerance.trim() : '';
      }
      if (stepType === 'assertion') {
        payload.assertion_variable = assertionVariable;
        // Assertions have no browser instruction; synthesize a readable label for the list.
        payload.instruction = `Assert {{${assertionVariable}}} ${validationType === 'bool' ? `is ${checkValue}` : `${validationOperator} ${checkValue}`}`.trim();
      }
      if (nextSort !== undefined) payload.sort = nextSort;
      await onSubmit(payload);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
    }
  };

  const help = INSTRUCTION_HELP[stepType] ?? INSTRUCTION_HELP.navigation;

  const comparisonBlock = (
    <>
      <FormField label="Comparison type">
        <Select
          selectedOption={findOpt(VALIDATION_TYPES, validationType)}
          options={VALIDATION_TYPES}
          onChange={({ detail }) => changeValidationType(detail.selectedOption.value ?? 'bool')}
        />
      </FormField>
      {validationType === 'bool' && (
        <>
          <FormField label="Expected value">
            <Select
              selectedOption={findOpt(BOOLEAN_MODES, boolMode)}
              options={BOOLEAN_MODES}
              onChange={({ detail }) => {
                const m = detail.selectedOption.value ?? 'true';
                setBoolMode(m);
                setValidationValue(m === 'variable' ? '' : m);
              }}
            />
          </FormField>
          {boolMode === 'variable' && (
            <FormField label="Variable expression" description="A variable that evaluates to a boolean.">
              <Input value={validationValue} placeholder="{{myBooleanVar}}" onChange={({ detail }) => setValidationValue(detail.value)} />
            </FormField>
          )}
        </>
      )}
      {(validationType === 'string' || validationType === 'number' || validationType === 'currency' || validationType === 'date') && (
        <>
          <FormField label="Operator">
            <Select
              selectedOption={findOpt(OPERATORS[validationType], validationOperator)}
              options={OPERATORS[validationType]}
              onChange={({ detail }) => setValidationOperator(detail.selectedOption.value ?? DEFAULT_OP(validationType))}
            />
          </FormField>
          <FormField
            label={validationType === 'date' ? 'Expected date' : validationOperator === 'matches' ? 'Pattern (regex)' : 'Expected value'}
            description={
              validationType === 'currency' ? 'Currency text; $ and commas are ignored (e.g. $1,250.00). Supports {{variables}}.'
                : validationType === 'date' ? 'A date, e.g. 2026-07-10 or 07/10/2026. Supports {{variables}}.'
                : validationOperator === 'matches' ? 'A regular expression, e.g. ^POL-\\d{5}$.'
                : 'Supports variables like {{UniqueID}}, {{Time}}, {{ExecutionID}}.'
            }
            errorText={regexInvalid ? 'Invalid regular expression' : undefined}
          >
            <Input
              value={validationValue}
              placeholder={
                validationType === 'number' ? 'e.g. 42, 3.14 or {{UniqueID}}'
                  : validationType === 'currency' ? 'e.g. $1,250.00'
                  : validationType === 'date' ? 'e.g. 2026-07-10'
                  : validationOperator === 'matches' ? '^POL-\\d{5}$'
                  : 'e.g. Bound or {{Time}}'
              }
              onChange={({ detail }) => setValidationValue(detail.value)}
            />
          </FormField>
          {toleranceNeeded && (
            <FormField
              label={validationType === 'date' ? 'Tolerance (days)' : 'Tolerance (±)'}
              description={validationType === 'date' ? 'Passes if the actual date is within this many days of the expected date.' : 'Passes if the amounts differ by at most this much (rounding allowance).'}
            >
              <Input type="number" value={validationTolerance} placeholder={validationType === 'date' ? 'e.g. 7' : 'e.g. 0.01'} onChange={({ detail }) => setValidationTolerance(detail.value)} />
            </FormField>
          )}
        </>
      )}
      {validationType === 'json' && (
        <>
          <FormField label="Operator" description="Compared as parsed objects — order- and whitespace-independent.">
            <Select
              selectedOption={findOpt(OPERATORS.json, validationOperator)}
              options={OPERATORS.json}
              onChange={({ detail }) => setValidationOperator(detail.selectedOption.value ?? 'json_equals')}
            />
          </FormField>
          <FormField
            label="Expected JSON"
            description={validationOperator === 'json_contains' ? 'These fields must be present (a subset). Extra fields in the actual value are ignored.' : 'The full value must match this, deeply.'}
            errorText={validationValue.trim() && !isValidJson(validationValue) ? 'Invalid JSON' : undefined}
          >
            <Textarea value={validationValue} placeholder={'{\n  "status": "Bound",\n  "premium": 1250\n}'} rows={5} onChange={({ detail }) => setValidationValue(detail.value)} />
          </FormField>
        </>
      )}
    </>
  );

  return (
    <Modal
      visible
      onDismiss={onClose}
      header={title}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!canSubmit} onClick={submit}>Save</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <FormField label="Step type" description={STEP_TYPE_HELP[stepType]}>
          <Select
            selectedOption={{ label: STEP_TYPE_LABEL(stepType), value: stepType }}
            options={STEP_TYPES}
            onChange={({ detail }) => setStepType(detail.selectedOption.value ?? 'navigation')}
          />
        </FormField>

        {needsInstruction && (
          <FormField label={stepType === 'url' ? 'URL' : 'Instruction'} description={help.desc}>
            <Textarea value={instruction} placeholder={help.placeholder} rows={stepType === 'url' ? 1 : 3} onChange={({ detail }) => setInstruction(detail.value)} />
          </FormField>
        )}

        {needsInstruction && (
          <Box>
            <Box fontSize="body-s" color="text-body-secondary" padding={{ bottom: 'xxs' }}>Available variables — click to add to the instruction</Box>
            <SpaceBetween size="xxs">
              <VarRow label="Predefined" vars={predefinedVars} onInsert={insertVar} />
              <VarRow label="Captured" vars={capturedVars} onInsert={insertVar} />
              <VarRow label="Built-in" vars={BUILTIN_VARS} onInsert={insertVar} />
            </SpaceBetween>
          </Box>
        )}

        {unknownVars.length > 0 && (
          <Box color="text-status-warning" fontSize="body-s">
            Unknown variable{unknownVars.length > 1 ? 's' : ''}: {unknownVars.map((v) => `{{${v}}}`).join(', ')} — not defined for this use case, so {unknownVars.length > 1 ? 'they' : 'it'} won’t be substituted at run time.
          </Box>
        )}

        {stepType === 'secret' && (() => {
          const known = new Set(secretKeys);
          // Flag a dangling reference only when we actually have a loaded list.
          const missing = !!secretKey && secretKeys.length > 0 && !known.has(secretKey);
          const options = [
            ...secretKeys.map((k) => ({ label: k, value: k })),
            ...(missing ? [{ label: `${secretKey} (not defined)`, value: secretKey }] : []),
          ];
          return (
            <FormField
              label="Secret key"
              description="The secret whose value is typed after the action. Manage secrets in the Secrets tab."
              errorText={missing ? 'This secret is not defined for the use case.' : undefined}
            >
              {secretKeys.length > 0 ? (
                <Select
                  selectedOption={secretKey ? { label: missing ? `${secretKey} (not defined)` : secretKey, value: secretKey } : null}
                  options={options}
                  placeholder="Choose a secret"
                  empty="No secrets defined."
                  onChange={({ detail }) => setSecretKey(detail.selectedOption.value ?? '')}
                />
              ) : (
                <SpaceBetween size="xs">
                  <Box color="text-body-secondary" fontSize="body-s">No secrets defined for this use case yet — add one in the Secrets tab, then pick it here.</Box>
                  <Input value={secretKey} placeholder="e.g. portal_password" onChange={({ detail }) => setSecretKey(detail.value)} />
                </SpaceBetween>
              )}
            </FormField>
          );
        })()}

        {stepType === 'validation' && comparisonBlock}

        {stepType === 'retrieve_value' && (
          <>
            <FormField label="Variable name" description="Captured value is available as {{name}} in later steps." errorText={varNameError(captureVariable.trim())}>
              <Input value={captureVariable} placeholder="e.g. policy_number" onChange={({ detail }) => setCaptureVariable(detail.value)} />
            </FormField>
            <FormField label="Value type" description="Expected type of the retrieved value.">
              <Select selectedOption={findOpt(VALUE_TYPES, valueType)} options={VALUE_TYPES} onChange={({ detail }) => setValueType(detail.selectedOption.value ?? 'string')} />
            </FormField>
          </>
        )}

        {stepType === 'assertion' && (
          <>
            <FormField label="Runtime variable" description="A variable captured by an earlier Retrieve Value step.">
              <Select
                selectedOption={assertionVariable ? { label: assertionVariable, value: assertionVariable } : null}
                options={runtimeVars}
                filteringType="auto"
                placeholder="Select a runtime variable"
                empty="No runtime variables yet. Add a Retrieve Value step first."
                onChange={({ detail }) => setAssertionVariable(detail.selectedOption.value ?? '')}
              />
            </FormField>
            {comparisonBlock}
          </>
        )}

        <FormField label="Nova Act command" description="Exactly what the worker runs for this step. Updates as you edit.">
          <pre style={{
            margin: 0, padding: '12px 14px', borderRadius: 8,
            background: '#f4f6f9', border: '1px solid #d5dbdb',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 12.5, lineHeight: 1.55, color: '#16191f',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto',
          }}>
            {buildNovaPreview({ stepType, instruction, secretKey, validationType, validationOperator, validationValue, validationTolerance, boolMode, captureVariable, valueType, assertionVariable })}
          </pre>
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}
