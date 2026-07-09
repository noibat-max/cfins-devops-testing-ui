import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Tabs from '@cloudscape-design/components/tabs';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
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
import { QA_STUDIO_NAV, QA_STUDIO_APP_NAME } from '../../config/qaStudioNav';
import { useAuth } from '../../lib/auth';
import { hasScope } from '../../types';
import type { Step, Usecase } from '../../types';
import * as api from '../../lib/api';

const USECASES_BASE = '/apps/qa-studio/usecases';
const STEP_TYPES = ['navigation', 'input', 'click', 'validation', 'extract'];

export default function UseCaseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/usecases.write');

  const [usecase, setUsecase] = useState<Usecase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);

  const flash = useCallback((type: FlashbarProps.Type, content: string) => {
    const fid = `${Date.now()}-${Math.random()}`;
    setFlashes((f) => [...f, { id: fid, type, content, dismissible: true, onDismiss: () => setFlashes((x) => x.filter((m) => m.id !== fid)) }]);
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
    try { await api.deleteUsecase(id); navigate(USECASES_BASE); }
    catch (e) { flash('error', e instanceof Error ? e.message : 'Delete failed'); }
  };

  return (
    <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header
              variant="h1"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button iconName="arrow-left" onClick={() => navigate(USECASES_BASE)}>Back</Button>
                  {canWrite && (
                    <ButtonDropdown
                      items={[
                        { id: 'delete', text: 'Delete' },
                      ]}
                      onItemClick={({ detail }) => { if (detail.id === 'delete') onDelete(); }}
                    >
                      Actions
                    </ButtonDropdown>
                  )}
                </SpaceBetween>
              }
              info={<Badge color={usecase.active ? 'green' : 'grey'}>{usecase.active ? 'Active' : 'Inactive'}</Badge>}
            >
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
                { id: 'exec', label: 'Execution History', content: <ComingSoon />, disabled: true },
                { id: 'sched', label: 'Schedule', content: <ComingSoon />, disabled: true },
                { id: 'vars', label: 'Variables', content: <ComingSoon />, disabled: true },
                { id: 'secrets', label: 'Secrets', content: <ComingSoon />, disabled: true },
                { id: 'headers', label: 'Headers', content: <ComingSoon />, disabled: true },
                { id: 'hooks', label: 'Hooks', content: <ComingSoon />, disabled: true },
              ]}
            />
          </SpaceBetween>
        </Box>
      </ContentLayout>
    </AppChrome>
  );
}

function ComingSoon() {
  return <Box color="text-body-secondary" padding="l">Coming soon — ported in a later slice.</Box>;
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
  const [editStep, setEditStep] = useState<Step | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(() => {
    api.listSteps(usecaseId).then((r) => setSteps(r.steps)).catch((e: unknown) => onError(e instanceof Error ? e.message : 'Failed to load steps'));
  }, [usecaseId, onError]);

  useEffect(() => { load(); }, [load]);

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
    try { await api.deleteStep(usecaseId, s.id); load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Delete failed'); }
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
            actions={canWrite ? <Button variant="primary" iconName="add-plus" onClick={() => setShowAdd(true)}>Add step</Button> : undefined}
          >
            Workflow steps
          </Header>
        }
        columnDefinitions={[
          { id: 'order', header: '#', width: 60, cell: (_s: Step) => (steps ? steps.indexOf(_s) + 1 : '') },
          { id: 'instruction', header: 'Instruction', cell: (s) => s.instruction, isRowHeader: true },
          { id: 'type', header: 'Type', cell: (s) => <Badge>{s.step_type || '—'}</Badge> },
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
                  <Button variant="inline-icon" iconName="edit" ariaLabel="Edit" onClick={() => setEditStep(s)} />
                  <Button variant="inline-icon" iconName="remove" ariaLabel="Delete" onClick={() => remove(s)} />
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
          onClose={() => setShowAdd(false)}
          onSubmit={async (payload) => { await api.createStep(usecaseId, payload); setShowAdd(false); load(); }}
          onError={onError}
        />
      )}
      {editStep && (
        <StepModal
          title="Edit step"
          initial={editStep}
          onClose={() => setEditStep(null)}
          onSubmit={async (payload) => { await api.updateStep(usecaseId, editStep.id, payload); setEditStep(null); load(); }}
          onError={onError}
        />
      )}
    </>
  );
}

function StepModal({ title, initial, nextSort, onClose, onSubmit, onError }: {
  title: string;
  initial?: Step;
  nextSort?: number;
  onClose: () => void;
  onSubmit: (payload: Partial<Step>) => Promise<void>;
  onError: (m: string) => void;
}) {
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');
  const [stepType, setStepType] = useState(initial?.step_type || 'navigation');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const payload: Partial<Step> = { instruction, step_type: stepType };
      if (nextSort !== undefined) payload.sort = nextSort;
      await onSubmit(payload);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
      onDismiss={onClose}
      header={title}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!instruction.trim()} onClick={submit}>Save</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <FormField label="Instruction" description="Plain-English step for Nova Act to execute.">
          <Textarea value={instruction} onChange={({ detail }) => setInstruction(detail.value)} rows={3} />
        </FormField>
        <FormField label="Step type">
          <Select
            selectedOption={{ label: stepType, value: stepType }}
            options={STEP_TYPES.map((t) => ({ label: t, value: t }))}
            onChange={({ detail }) => setStepType(detail.selectedOption.value ?? 'navigation')}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}
