import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tabs from '@cloudscape-design/components/tabs';
import Table from '@cloudscape-design/components/table';
import Badge from '@cloudscape-design/components/badge';
import Spinner from '@cloudscape-design/components/spinner';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Select from '@cloudscape-design/components/select';
import AppChrome from '../../components/AppChrome';
import { QA_STUDIO_NAV, QA_STUDIO_APP_NAME } from '../../config/qaStudioNav';
import { useAuth } from '../../lib/auth';
import { hasScope } from '../../types';
import type { Step, Template, Variable } from '../../types';
import * as api from '../../lib/api';

const BASE = '/apps/qa-studio/templates';
type FlashFn = (type: FlashbarProps.Type, content: string) => void;

type Opt = { label: string; value: string };
const STEP_TYPES: Opt[] = [
  { label: 'Navigation', value: 'navigation' },
  { label: 'URL', value: 'url' },
  { label: 'Secret', value: 'secret' },
  { label: 'Validation', value: 'validation' },
  { label: 'Retrieve Value', value: 'retrieve_value' },
  { label: 'Assertion', value: 'assertion' },
  { label: 'Download', value: 'download' },
];
const VALIDATION_TYPES: Opt[] = ['bool', 'string', 'number', 'currency', 'date', 'json'].map((v) => ({ label: v, value: v }));
const VALUE_TYPES: Opt[] = ['string', 'bool', 'number', 'json'].map((v) => ({ label: v, value: v }));
const TYPE_LABEL = Object.fromEntries(STEP_TYPES.map((t) => [t.value, t.label]));

const BUILTIN_VARS = ['UniqueID', 'Time', 'ExecutionID'];
const VAR_TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const usedVarTokens = (text: string): string[] => [...text.matchAll(VAR_TOKEN_RE)].map((m) => m[1]);

// Variable names must be snake_case: lowercase letters/digits/underscores,
// starting with a letter — no spaces. Empty is handled separately (required).
const VAR_NAME_RE = /^[a-z][a-z0-9_]*$/;
function varNameError(name: string): string | undefined {
  if (!name) return undefined;
  if (/\s/.test(name)) return 'No spaces — use snake_case (e.g. policy_number).';
  if (!VAR_NAME_RE.test(name)) return 'snake_case only: lowercase letters, digits, underscores; start with a letter.';
  return undefined;
}

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

export default function TemplateDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/nova/templates.write');
  const canApply = hasScope(user, 'api/nova/usecases.write');

  const [tpl, setTpl] = useState<Template | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [showApply, setShowApply] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const flash = useCallback<FlashFn>((type, content) => {
    const fid = `${Date.now()}-${Math.random()}`;
    const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== fid));
    setFlashes((f) => [...f, { id: fid, type, content, dismissible: true, onDismiss: dismiss }]);
    if (type === 'success' || type === 'info') setTimeout(dismiss, 4000);
  }, []);

  useEffect(() => {
    api.getTemplate(id).then(setTpl).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load template'));
  }, [id]);

  const remove = async () => {
    setDeleting(true);
    try { await api.deleteTemplate(id); navigate(BASE); }
    catch (e) { flash('error', e instanceof Error ? e.message : 'Delete failed'); setDeleting(false); setConfirmDelete(false); }
  };

  if (error) {
    return (
      <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
        <Box padding="xxl"><Alert type="error" header="Could not load template">{error}
          <Box padding={{ top: 's' }}><Button onClick={() => navigate(BASE)}>Back to templates</Button></Box>
        </Alert></Box>
      </AppChrome>
    );
  }
  if (!tpl) {
    return <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}><Box textAlign="center" padding="xxl"><Spinner size="large" /></Box></AppChrome>;
  }

  return (
    <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header
              variant="h1"
              description={tpl.description || 'Reusable step library'}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  {canWrite && (
                    <span className="wb-danger">
                      <Button variant="link" iconName="remove" onClick={() => setConfirmDelete(true)}>Delete</Button>
                    </span>
                  )}
                  {canApply && (
                    <Button variant="primary" iconName="add-plus" onClick={() => setShowApply(true)}>Apply</Button>
                  )}
                </SpaceBetween>
              }
            >
              <Button
                variant="inline-icon"
                iconName="arrow-left"
                ariaLabel="Back to templates"
                onClick={() => navigate(BASE)}
              />{' '}
              {tpl.name || '(untitled template)'}
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
                  content: <DetailsTab tpl={tpl} canWrite={canWrite} onSaved={(t) => { setTpl(t); flash('success', 'Saved'); }} onError={(m) => flash('error', m)} />,
                },
                {
                  id: 'steps',
                  label: 'Workflow Steps',
                  content: <StepsTab templateId={id} canWrite={canWrite} onFlash={flash} onError={(m) => flash('error', m)} />,
                },
                {
                  id: 'vars',
                  label: 'Variables',
                  content: <VariablesTab templateId={id} canWrite={canWrite} onFlash={flash} onError={(m) => flash('error', m)} />,
                },
              ]}
            />
          </SpaceBetween>
        </Box>
      </ContentLayout>

      {showApply && <ApplyModal tpl={tpl} onClose={() => setShowApply(false)} onApplied={(uid) => navigate(`/apps/qa-studio/usecases/${uid}`)} onError={(m) => flash('error', m)} />}

      {confirmDelete && (
        <Modal
          visible
          onDismiss={() => setConfirmDelete(false)}
          header="Delete template"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
                <span className="wb-danger-fill">
                  <Button variant="primary" iconName="remove" onClick={remove} loading={deleting}>Delete</Button>
                </span>
              </SpaceBetween>
            </Box>
          }
        >
          Permanently delete <b>{tpl.name || 'this template'}</b> and its steps? Use cases already created from it are unaffected. This cannot be undone.
        </Modal>
      )}
    </AppChrome>
  );
}

// ---- Details tab ----
function DetailsTab({ tpl, canWrite, onSaved, onError }: { tpl: Template; canWrite: boolean; onSaved: (t: Template) => void; onError: (m: string) => void }) {
  const [name, setName] = useState(tpl.name);
  const [description, setDescription] = useState(tpl.description);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setName(tpl.name); setDescription(tpl.description); }, [tpl]);
  const dirty = name !== tpl.name || description !== tpl.description;

  const save = async () => {
    setSaving(true);
    try { onSaved(await api.updateTemplate(tpl.id, { name: name.trim(), description })); }
    catch (e) { onError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <Container header={<Header variant="h2" actions={canWrite ? <Button variant="primary" loading={saving} disabled={!dirty || !name.trim()} onClick={save}>Save</Button> : undefined}>Details</Header>}>
      <SpaceBetween size="m">
        <FormField label="Name"><Input value={name} disabled={!canWrite} onChange={({ detail }) => setName(detail.value)} /></FormField>
        <FormField label="Description"><Textarea value={description} disabled={!canWrite} onChange={({ detail }) => setDescription(detail.value)} /></FormField>
        <FormField label="Template ID"><Box variant="code" fontSize="body-s">{tpl.id}</Box></FormField>
        <FormField label="Version" description="Read-only — increments on any step add, edit, delete, or reorder."><Box variant="code" fontSize="body-s">v{tpl.version ?? 1}</Box></FormField>
        <Box fontSize="body-s" color="text-body-secondary">Created by {tpl.created_by || '—'}{tpl.created_at ? ` · ${tpl.created_at}` : ''}</Box>
      </SpaceBetween>
    </Container>
  );
}

// ---- Workflow Steps tab ----
function StepsTab({ templateId, canWrite, onFlash, onError }: { templateId: string; canWrite: boolean; onFlash: FlashFn; onError: (m: string) => void }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [predefinedVars, setPredefinedVars] = useState<string[]>([]);
  const [stepModal, setStepModal] = useState<{ mode: 'add' | 'edit'; step?: Step } | null>(null);
  const [deleteStep, setDeleteStep] = useState<Step | null>(null);

  const load = useCallback(() => {
    api.listTemplateSteps(templateId)
      .then((s) => setSteps([...s.steps].sort((a, b) => a.sort - b.sort)))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : 'Failed to load steps'));
  }, [templateId, onError]);
  useEffect(load, [load]);

  // Predefined variables feed the step editor's variable picker (like use cases).
  useEffect(() => {
    api.getTemplateVariables(templateId)
      .then((r) => setPredefinedVars(r.variables.map((v) => v.key).filter(Boolean)))
      .catch(() => undefined);
  }, [templateId]);

  const moveStep = async (index: number, dir: -1 | 1) => {
    if (!steps) return;
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const arr = [...steps];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setSteps(arr.map((s, i) => ({ ...s, sort: i + 1 })));
    try { await api.reorderTemplateSteps(templateId, arr.map((s, i) => ({ step_id: s.id, sort: i + 1 }))); }
    catch (e) { onError(e instanceof Error ? e.message : 'Reorder failed'); load(); }
  };

  const onDelete = async () => {
    if (!deleteStep) return;
    try { await api.deleteTemplateStep(templateId, deleteStep.id); setDeleteStep(null); onFlash('success', 'Step deleted'); load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Delete failed'); }
  };

  if (steps === null) return <Box textAlign="center" padding="l"><Spinner /></Box>;

  return (
    <Container header={
      <Header variant="h2" counter={`(${steps.length})`}
        actions={canWrite ? <Button variant="link" iconName="add-plus" onClick={() => setStepModal({ mode: 'add' })}>Add step</Button> : undefined}
        description="The reusable steps copied in when this template is applied or imported.">
        Workflow Steps
      </Header>
    }>
      <Table<Step>
        variant="embedded"
        items={steps}
        trackBy="id"
        empty={<Box textAlign="center" padding="m" color="text-body-secondary">No steps yet.</Box>}
        columnDefinitions={[
          { id: 'sort', header: '#', width: 60, cell: (s) => s.sort },
          { id: 'type', header: 'Type', width: 140, cell: (s) => <Badge>{TYPE_LABEL[s.step_type] ?? s.step_type}</Badge> },
          { id: 'instruction', header: 'Instruction', cell: (s) => <Box fontSize="body-s">{s.instruction || '—'}</Box> },
          ...(canWrite ? [{
            id: 'actions', header: '', width: 190,
            cell: (s: Step) => {
              const i = steps.findIndex((x) => x.id === s.id);
              return (
                <SpaceBetween direction="horizontal" size="xxs">
                  <Button variant="inline-icon" iconName="angle-up" ariaLabel="Move up" disabled={i === 0} onClick={() => moveStep(i, -1)} />
                  <Button variant="inline-icon" iconName="angle-down" ariaLabel="Move down" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} />
                  <Button variant="inline-icon" iconName="edit" ariaLabel="Edit step" onClick={() => setStepModal({ mode: 'edit', step: s })} />
                  <span className="wb-danger"><Button variant="inline-icon" iconName="remove" ariaLabel="Delete step" onClick={() => setDeleteStep(s)} /></span>
                </SpaceBetween>
              );
            },
          }] : []),
        ]}
      />

      {stepModal && (
        <StepModal
          templateId={templateId}
          mode={stepModal.mode}
          step={stepModal.step}
          nextSort={(steps[steps.length - 1]?.sort ?? 0) + 1}
          predefinedVars={predefinedVars}
          existingSteps={steps}
          onClose={() => setStepModal(null)}
          onSaved={() => { setStepModal(null); onFlash('success', 'Step saved'); load(); }}
          onError={onError}
        />
      )}
      {deleteStep && (
        <Modal visible onDismiss={() => setDeleteStep(null)} header="Delete step"
          footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setDeleteStep(null)}>Cancel</Button><span className="wb-danger-fill"><Button iconName="remove" onClick={onDelete}>Delete</Button></span></SpaceBetween></Box>}>
          Delete step {deleteStep.sort}? This cannot be undone.
        </Modal>
      )}
    </Container>
  );
}

// ---- Variables tab (whole-list replace) ----
function VariablesTab({ templateId, canWrite, onFlash, onError }: { templateId: string; canWrite: boolean; onFlash: FlashFn; onError: (m: string) => void }) {
  const [rows, setRows] = useState<Variable[] | null>(null);
  const [loaded, setLoaded] = useState<Variable[]>([]);

  const load = useCallback(() => {
    api.getTemplateVariables(templateId)
      .then((r) => { setRows(r.variables); setLoaded(r.variables); })
      .catch((e: unknown) => onError(e instanceof Error ? e.message : 'Failed to load variables'));
  }, [templateId, onError]);
  useEffect(load, [load]);

  const dirty = rows !== null && JSON.stringify(rows) !== JSON.stringify(loaded);
  const keys = (rows ?? []).map((r) => r.key.trim());
  const hasInvalid = (rows ?? []).some((r) => !!varNameError(r.key.trim()));
  const canSave = canWrite && dirty && !keys.some((k) => !k) && new Set(keys).size === keys.length && !hasInvalid;

  const save = async () => {
    try {
      const r = await api.setTemplateVariables(templateId, (rows ?? []).filter((x) => x.key.trim()).map((x) => ({ key: x.key.trim(), value: x.value })));
      setRows(r.variables); setLoaded(r.variables); onFlash('success', 'Variables saved');
    } catch (e) { onError(e instanceof Error ? e.message : 'Save failed'); }
  };

  if (rows === null) return <Box textAlign="center" padding="l"><Spinner /></Box>;

  return (
    <Container header={
      <Header variant="h2" counter={`(${rows.length})`}
        description={<>Predefined placeholders substituted into steps as <code>{'{{key}}'}</code> when the template is applied or imported.</>}
        actions={canWrite ? (
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" iconName="add-plus" onClick={() => setRows([...rows, { key: '', value: '' }])}>Add variable</Button>
            <Button variant="primary" disabled={!canSave} onClick={save}>Save</Button>
          </SpaceBetween>
        ) : undefined}>
        Variables
      </Header>
    }>
      {rows.length === 0 ? (
        <Box color="text-body-secondary" padding={{ vertical: 's' }}>No variables.</Box>
      ) : (
        <SpaceBetween size="s">
          {rows.map((r, i) => (
            <SpaceBetween key={i} direction="horizontal" size="xs" alignItems="start">
              <FormField errorText={varNameError(r.key.trim())}>
                <Input value={r.key} disabled={!canWrite} placeholder="snake_case key" onChange={({ detail }) => setRows(rows.map((x, j) => (j === i ? { ...x, key: detail.value } : x)))} />
              </FormField>
              <Input value={r.value} disabled={!canWrite} placeholder="value" onChange={({ detail }) => setRows(rows.map((x, j) => (j === i ? { ...x, value: detail.value } : x)))} />
              {canWrite && <span className="wb-danger"><Button variant="inline-icon" iconName="remove" ariaLabel="Remove variable" onClick={() => setRows(rows.filter((_, j) => j !== i))} /></span>}
            </SpaceBetween>
          ))}
        </SpaceBetween>
      )}
    </Container>
  );
}

// ---- Apply ----
function ApplyModal({ tpl, onClose, onApplied, onError }: { tpl: Template; onClose: () => void; onApplied: (uid: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState(`${tpl.name} (from template)`);
  const [startingUrl, setStartingUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { const r = await api.applyTemplate(tpl.id, { name: name.trim(), starting_url: startingUrl }); onApplied(r.usecaseId); }
    catch (e) { onError(e instanceof Error ? e.message : 'Apply failed'); setBusy(false); }
  };
  return (
    <Modal visible onDismiss={onClose} header={`Apply “${tpl.name}”`}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!name.trim()} onClick={submit}>Create use case</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        <Alert type="info">Creates a new use case with this template's steps and variables.</Alert>
        <FormField label="New use case name"><Input value={name} onChange={({ detail }) => setName(detail.value)} /></FormField>
        <FormField label="Starting URL" description="Optional — templates are URL-agnostic, so set where this use case begins."><Input value={startingUrl} onChange={({ detail }) => setStartingUrl(detail.value)} placeholder="https://example.com" /></FormField>
      </SpaceBetween>
    </Modal>
  );
}

// ---- Step add/edit ----
function StepModal({ templateId, mode, step, nextSort, predefinedVars, existingSteps, onClose, onSaved, onError }: {
  templateId: string; mode: 'add' | 'edit'; step?: Step; nextSort: number;
  predefinedVars: string[]; existingSteps: Step[];
  onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const [stepType, setStepType] = useState<Opt>(STEP_TYPES.find((t) => t.value === step?.step_type) ?? STEP_TYPES[0]);
  const [instruction, setInstruction] = useState(step?.instruction ?? '');
  const [secretKey, setSecretKey] = useState(step?.secret_key ?? '');
  const [captureVar, setCaptureVar] = useState(step?.capture_variable ?? '');
  const [valueType, setValueType] = useState<Opt>(VALUE_TYPES.find((t) => t.value === step?.value_type) ?? VALUE_TYPES[0]);
  const [assertionVar, setAssertionVar] = useState(step?.assertion_variable ?? '');
  const [valType, setValType] = useState<Opt>(VALIDATION_TYPES.find((t) => t.value === step?.validation_type) ?? VALIDATION_TYPES[0]);
  const [valOp, setValOp] = useState(step?.validation_operator ?? '');
  const [valValue, setValValue] = useState(step?.validation_value ?? '');
  const [valTol, setValTol] = useState(step?.validation_tolerance ?? '');
  const [busy, setBusy] = useState(false);

  const t = stepType.value;
  const isValidation = t === 'validation';
  const isAssertion = t === 'assertion';
  const isSecret = t === 'secret';
  const isRetrieve = t === 'retrieve_value';

  // Variables usable in this step: predefined (Variables tab) + captured by
  // earlier retrieve_value steps + built-ins. Click to insert into the instruction.
  const capturedVars = existingSteps
    .filter((s) => s.step_type === 'retrieve_value' && s.capture_variable && s.id !== step?.id)
    .map((s) => s.capture_variable as string);
  const knownVars = new Set([...predefinedVars, ...capturedVars, ...BUILTIN_VARS]);
  const unknownVars = [...new Set(usedVarTokens(`${instruction} ${valValue}`))].filter((v) => !knownVars.has(v));
  const insertVar = (name: string) => setInstruction((v) => `${v}${v && !v.endsWith(' ') ? ' ' : ''}{{${name}}}`);

  const captureErr = isRetrieve ? varNameError(captureVar.trim()) : undefined;
  const assertErr = isAssertion ? varNameError(assertionVar.trim()) : undefined;
  const submitDisabled = !instruction.trim() || !!captureErr || !!assertErr;

  const submit = async () => {
    setBusy(true);
    const body: Partial<Step> = { step_type: t, instruction: instruction.trim() };
    if (mode === 'add') body.sort = nextSort;
    if (isSecret) body.secret_key = secretKey.trim();
    if (isRetrieve) { body.capture_variable = captureVar.trim(); body.value_type = valueType.value; }
    if (isAssertion) body.assertion_variable = assertionVar.trim();
    if (isValidation || isAssertion) {
      body.validation_type = valType.value;
      body.validation_operator = valOp.trim();
      body.validation_value = valValue.trim();
      body.validation_tolerance = valTol.trim();
    }
    try {
      if (mode === 'add') await api.createTemplateStep(templateId, body);
      else await api.updateTemplateStep(templateId, step!.id, body);
      onSaved();
    } catch (e) { onError(e instanceof Error ? e.message : 'Save failed'); setBusy(false); }
  };

  const instructionLabel = t === 'url' ? 'URL' : t === 'assertion' ? 'Description' : 'Instruction';

  return (
    <Modal visible onDismiss={onClose} header={mode === 'add' ? 'Add step' : `Edit step ${step?.sort}`}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={submitDisabled} onClick={submit}>{mode === 'add' ? 'Add' : 'Save'}</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        <FormField label="Step type"><Select selectedOption={stepType} options={STEP_TYPES} onChange={({ detail }) => setStepType(detail.selectedOption as Opt)} /></FormField>
        <FormField label={instructionLabel} description={t === 'url' ? 'The page to open. Supports {{variables}}.' : 'Plain-English instruction. Supports {{variables}}.'}>
          <Textarea value={instruction} onChange={({ detail }) => setInstruction(detail.value)} rows={2} />
        </FormField>
        <Box>
          <Box fontSize="body-s" color="text-body-secondary" padding={{ bottom: 'xxs' }}>Available variables — click to add to the instruction</Box>
          <SpaceBetween size="xxs">
            <VarRow label="Predefined" vars={predefinedVars} onInsert={insertVar} />
            <VarRow label="Captured" vars={capturedVars} onInsert={insertVar} />
            <VarRow label="Built-in" vars={BUILTIN_VARS} onInsert={insertVar} />
          </SpaceBetween>
        </Box>
        {unknownVars.length > 0 && (
          <Box color="text-status-warning" fontSize="body-s">
            Unknown variable{unknownVars.length > 1 ? 's' : ''}: {unknownVars.map((v) => `{{${v}}}`).join(', ')} — not defined for this template, so {unknownVars.length > 1 ? 'they' : 'it'} won’t be substituted at run time.
          </Box>
        )}
        {isSecret && <FormField label="Secret key" description="Which use-case secret to type."><Input value={secretKey} onChange={({ detail }) => setSecretKey(detail.value)} placeholder="login_pw" /></FormField>}
        {isRetrieve && (
          <SpaceBetween size="m">
            <FormField label="Capture variable" description="Name to store the value under (usable later as {{name}})." errorText={captureErr}><Input value={captureVar} onChange={({ detail }) => setCaptureVar(detail.value)} placeholder="policy_number" /></FormField>
            <FormField label="Value type"><Select selectedOption={valueType} options={VALUE_TYPES} onChange={({ detail }) => setValueType(detail.selectedOption as Opt)} /></FormField>
          </SpaceBetween>
        )}
        {isAssertion && <FormField label="Assertion variable" description="Runtime variable to check." errorText={assertErr}><Input value={assertionVar} onChange={({ detail }) => setAssertionVar(detail.value)} placeholder="policy_number" /></FormField>}
        {(isValidation || isAssertion) && (
          <SpaceBetween size="m">
            <FormField label="Comparison type"><Select selectedOption={valType} options={VALIDATION_TYPES} onChange={({ detail }) => setValType(detail.selectedOption as Opt)} /></FormField>
            <FormField label="Operator" description="e.g. exact, contains, equals, greater_then, matches, within_days."><Input value={valOp} onChange={({ detail }) => setValOp(detail.value)} placeholder="exact" /></FormField>
            <FormField label="Expected value" description="Supports {{variables}}."><Input value={valValue} onChange={({ detail }) => setValValue(detail.value)} /></FormField>
            <FormField label="Tolerance" description="Optional — ± for currency equals, N days for within_days."><Input value={valTol} onChange={({ detail }) => setValTol(detail.value)} /></FormField>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </Modal>
  );
}
