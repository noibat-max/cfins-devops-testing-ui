import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Badge from '@cloudscape-design/components/badge';
import Tabs from '@cloudscape-design/components/tabs';
import Table from '@cloudscape-design/components/table';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Spinner from '@cloudscape-design/components/spinner';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import TextFilter from '@cloudscape-design/components/text-filter';
import Link from '@cloudscape-design/components/link';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import RadioGroup from '@cloudscape-design/components/radio-group';
import Alert from '@cloudscape-design/components/alert';
import AppChrome from '../../components/AppChrome';
import SuiteExecutionsTab from './SuiteExecutionsTab';
import ScheduleTab from './ScheduleTab';
import { QA_STUDIO_NAV, QA_STUDIO_APP_NAME } from '../../config/qaStudioNav';
import { useAuth } from '../../lib/auth';
import { hasScope } from '../../types';
import type { TestSuite, SuiteMember, Usecase, Step } from '../../types';
import * as api from '../../lib/api';

const SUITES_BASE = '/apps/qa-studio/suites';
const USECASES_BASE = '/apps/qa-studio/usecases';

export default function SuiteDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/qawb/suite.write');

  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [showRunNow, setShowRunNow] = useState(false);

  const flash = useCallback((type: FlashbarProps.Type, content: string) => {
    const key = `${Date.now()}-${Math.random()}`;
    const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== key));
    setFlashes((f) => [...f, { id: key, type, content, dismissible: true, onDismiss: dismiss }]);
    if (type === 'success' || type === 'info') setTimeout(dismiss, 4000);
  }, []);

  const loadSuite = useCallback(() => {
    api.getTestSuite(id).then(setSuite).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Failed to load test suite'));
  }, [id]);

  useEffect(() => { loadSuite(); }, [loadSuite]);

  const remove = async () => {
    setDeleting(true);
    try { await api.deleteTestSuite(id); navigate(SUITES_BASE); }
    catch (e) { flash('error', e instanceof Error ? e.message : 'Delete failed'); setDeleting(false); setConfirmDelete(false); }
  };

  if (error) {
    return (
      <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
        <Box padding="l"><Flashbar items={[{ type: 'error', content: error, dismissible: false }]} /></Box>
      </AppChrome>
    );
  }
  if (!suite) {
    return (
      <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
        <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>
      </AppChrome>
    );
  }

  return (
    <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header
              variant="h1"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  {canWrite && (
                    <Button variant="primary" iconName="caret-right-filled" onClick={() => setShowRunNow(true)}>
                      Run
                    </Button>
                  )}
                  {canWrite && (
                    <span className="wb-danger">
                      <Button variant="link" iconName="remove" onClick={() => setConfirmDelete(true)}>Delete</Button>
                    </span>
                  )}
                </SpaceBetween>
              }
              info={<Badge color={suite.usecaseCount ? 'blue' : 'grey'}>{suite.usecaseCount ?? 0} use case{suite.usecaseCount === 1 ? '' : 's'}</Badge>}
            >
              <Button variant="inline-icon" iconName="arrow-left" ariaLabel="Back to test suites" onClick={() => navigate(SUITES_BASE)} />{' '}
              {suite.name}
            </Header>
          </Box>
        }
      >
        <Box padding={{ horizontal: 'l', bottom: 'xxl' }}>
          <SpaceBetween size="l">
            {flashes.length > 0 && <Flashbar items={flashes} />}
            <Tabs
              activeTabId={activeTab}
              onChange={({ detail }) => setActiveTab(detail.activeTabId)}
              tabs={[
                {
                  id: 'details',
                  label: 'Details',
                  content: <DetailsTab suite={suite} canWrite={canWrite} onSaved={(s) => { setSuite(s); flash('success', 'Saved'); }} onError={(m) => flash('error', m)} />,
                },
                {
                  id: 'members',
                  label: 'Use cases',
                  content: <MembersTab suiteId={id} canWrite={canWrite} onFlash={flash} onCountChange={loadSuite} />,
                },
                {
                  id: 'exec',
                  label: 'Executions',
                  content: <SuiteExecutionsTab suiteId={id} canWrite={canWrite} onFlash={flash} onError={(m) => flash('error', m)} />,
                },
                { id: 'sched', label: 'Schedule', content: <ScheduleTab targetType="suite" targetId={id} /> },
              ]}
            />
          </SpaceBetween>
        </Box>
      </ContentLayout>

      {confirmDelete && (
        <Modal
          visible
          onDismiss={() => setConfirmDelete(false)}
          header="Delete test suite"
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
          Delete <b>{suite.name}</b>? This removes the suite and its membership. The use cases themselves are not deleted.
        </Modal>
      )}
      {showRunNow && (
        <SuiteRunNowModal
          suiteId={id}
          onClose={() => setShowRunNow(false)}
          onLaunched={(mode, n) => {
            setShowRunNow(false);
            setActiveTab('exec');
            flash('success', mode === 'queued'
              ? `Queued ${n} use case${n === 1 ? '' : 's'} — they run as slots free up. Tracking in Executions.`
              : `Launched ${n} use case${n === 1 ? '' : 's'} on ECS — tracking in Executions.`);
          }}
        />
      )}
    </AppChrome>
  );
}

function SuiteRunNowModal({
  suiteId, onClose, onLaunched,
}: {
  suiteId: string; onClose: () => void; onLaunched: (mode: 'run_now' | 'queued', count: number) => void;
}) {
  const [mode, setMode] = useState<'run_now' | 'queued'>('run_now');
  const [capture, setCapture] = useState<'screenshots' | 'full'>('screenshots');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.executeSuite(suiteId, mode, capture);
      onLaunched(mode, (mode === 'queued' ? r.queued : r.launched) ?? r.total);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Run failed');
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
      onDismiss={onClose}
      header="Run suite"
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
              { value: 'run_now', label: 'Run now', description: 'Launch every runnable use case as its own Fargate task, in parallel.' },
              { value: 'queued', label: 'Run later', description: 'Queue every use case — the dispatcher runs them as slots free up (capped concurrency).' },
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

// ---- Use cases (members) tab ----------------------------------------------

function MembersTab({
  suiteId,
  canWrite,
  onFlash,
  onCountChange,
}: {
  suiteId: string;
  canWrite: boolean;
  onFlash: (t: FlashbarProps.Type, c: string) => void;
  onCountChange: () => void;
}) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<SuiteMember[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SuiteMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [stepsFor, setStepsFor] = useState<SuiteMember | null>(null);

  const load = useCallback(() => {
    api.listSuiteUsecases(suiteId)
      .then((r) => setMembers(r.usecases))
      .catch((e: unknown) => onFlash('error', e instanceof Error ? e.message : 'Failed to load use cases'));
  }, [suiteId, onFlash]);

  useEffect(() => { load(); }, [load]);

  const doRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.removeUsecaseFromSuite(suiteId, removeTarget.usecaseId);
      onFlash('success', 'Removed from suite');
      setRemoveTarget(null);
      load();
      onCountChange();
    } catch (e) {
      onFlash('error', e instanceof Error ? e.message : 'Failed to remove');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Table<SuiteMember>
        items={members ?? []}
        loading={members === null}
        loadingText="Loading use cases"
        trackBy="usecaseId"
        empty={
          <Box textAlign="center" padding="m" color="text-body-secondary">
            <SpaceBetween size="s">
              <b>No use cases in this suite</b>
              {canWrite && <div><Button onClick={() => setShowAdd(true)}>Add use cases</Button></div>}
            </SpaceBetween>
          </Box>
        }
        header={
          <Header
            counter={members ? `(${members.length})` : undefined}
            actions={canWrite && <Button variant="primary" iconName="add-plus" onClick={() => setShowAdd(true)}>Add use cases</Button>}
          >
            Use cases
          </Header>
        }
        columnDefinitions={[
          { id: 'order', header: '#', width: 60, cell: (m) => m.sort },
          {
            id: 'name',
            header: 'Name',
            isRowHeader: true,
            cell: (m) =>
              m.missing ? (
                <span>{'(deleted use case)'}</span>
              ) : (
                <Link href={`${USECASES_BASE}/${m.usecaseId}`} onFollow={(e) => { e.preventDefault(); navigate(`${USECASES_BASE}/${m.usecaseId}`); }}>
                  {m.name || '(untitled)'}
                </Link>
              ),
          },
          {
            id: 'id',
            header: 'Use case ID',
            cell: (m) => (
              <CopyToClipboard
                variant="inline"
                textToCopy={m.usecaseId}
                copySuccessText="Use case ID copied"
                copyErrorText="Failed to copy"
              />
            ),
          },
          {
            id: 'status',
            header: 'Status',
            cell: (m) =>
              m.missing ? (
                <StatusIndicator type="warning">Deleted</StatusIndicator>
              ) : m.active ? (
                <StatusIndicator type="success">Active</StatusIndicator>
              ) : (
                <StatusIndicator type="stopped" colorOverride="grey">Inactive</StatusIndicator>
              ),
          },
          {
            id: 'actions',
            header: '',
            cell: (m) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="inline-link" iconName="script" disabled={m.missing} onClick={() => setStepsFor(m)}>Steps</Button>
                {canWrite && (
                  <span className="wb-danger">
                    <Button variant="inline-icon" iconName="remove" ariaLabel="Remove from suite" onClick={() => setRemoveTarget(m)} />
                  </span>
                )}
              </SpaceBetween>
            ),
          },
        ]}
      />

      {showAdd && (
        <AddUsecasesModal
          suiteId={suiteId}
          existingIds={new Set((members ?? []).map((m) => m.usecaseId))}
          onClose={() => setShowAdd(false)}
          onAdded={(n) => { setShowAdd(false); onFlash('success', `Added ${n} use case${n === 1 ? '' : 's'}`); load(); onCountChange(); }}
          onError={(m) => onFlash('error', m)}
        />
      )}

      {removeTarget && (
        <Modal
          visible
          onDismiss={() => setRemoveTarget(null)}
          header="Remove use case"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setRemoveTarget(null)} disabled={removing}>Cancel</Button>
                <span className="wb-danger-fill">
                  <Button variant="primary" iconName="remove" onClick={doRemove} loading={removing}>Remove</Button>
                </span>
              </SpaceBetween>
            </Box>
          }
        >
          Remove <b>{removeTarget.name || removeTarget.usecaseId}</b> from this suite? The use case itself is not deleted.
        </Modal>
      )}

      {stepsFor && (
        <StepsPreviewModal member={stepsFor} onClose={() => setStepsFor(null)} onError={(m) => onFlash('error', m)} />
      )}
    </>
  );
}

function StepsPreviewModal({
  member,
  onClose,
  onError,
}: {
  member: SuiteMember;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  // Template origin lookups (same as the use case's Workflow Steps tab): id ->
  // template name, and template-step id -> its position, so the Source column
  // can name the template + which of its steps this came from.
  const [tplNames, setTplNames] = useState<Record<string, string>>({});
  const [tplStepRefs, setTplStepRefs] = useState<Record<string, { sort: number }>>({});

  useEffect(() => {
    api.listSteps(member.usecaseId)
      .then((r) => setSteps([...r.steps].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : 'Failed to load steps'));
  }, [member, onError]);

  useEffect(() => {
    const ids = Array.from(new Set((steps ?? []).filter((s) => s.template_id).map((s) => s.template_id as string)));
    if (ids.length === 0) { setTplNames({}); setTplStepRefs({}); return; }
    let cancelled = false;
    (async () => {
      const names: Record<string, string> = {};
      const refs: Record<string, { sort: number }> = {};
      try {
        (await api.listTemplates()).templates.forEach((t) => { names[t.id] = t.name; });
      } catch { /* names best-effort */ }
      await Promise.all(ids.map(async (tid) => {
        try {
          (await api.listTemplateSteps(tid)).steps.forEach((st) => { refs[st.id] = { sort: st.sort }; });
        } catch { /* template may be deleted */ }
      }));
      if (!cancelled) { setTplNames(names); setTplStepRefs(refs); }
    })();
    return () => { cancelled = true; };
  }, [steps]);

  return (
    <Modal
      visible
      onDismiss={onClose}
      size="large"
      header={`Steps — ${member.name || member.usecaseId}`}
      footer={<Box float="right"><Button variant="primary" onClick={onClose}>Close</Button></Box>}
    >
      <Table<Step>
        variant="embedded"
        items={steps ?? []}
        loading={steps === null}
        loadingText="Loading steps"
        trackBy="id"
        empty={<Box textAlign="center" padding="m" color="text-body-secondary">This use case has no steps.</Box>}
        columnDefinitions={[
          { id: 'order', header: '#', width: 60, cell: (s) => (steps ? steps.indexOf(s) + 1 : '') },
          { id: 'type', header: 'Type', cell: (s) => <Badge>{s.step_type}</Badge> },
          { id: 'instruction', header: 'Instruction', isRowHeader: true, cell: (s) => s.instruction },
          {
            id: 'source',
            header: 'Source',
            cell: (s) => {
              if (!s.template_id) return <Box color="text-status-inactive" fontSize="body-s">—</Box>;
              const name = tplNames[s.template_id] ?? 'Deleted template';
              const ref = s.template_step_id ? tplStepRefs[s.template_step_id] : undefined;
              const json = JSON.stringify({ template: name, step: ref ? ref.sort : null });
              return (
                <Box color="text-body-secondary" fontSize="body-s">
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{json}</span>
                </Box>
              );
            },
          },
        ]}
      />
    </Modal>
  );
}

function AddUsecasesModal({
  suiteId,
  existingIds,
  onClose,
  onAdded,
  onError,
}: {
  suiteId: string;
  existingIds: Set<string>;
  onClose: () => void;
  onAdded: (count: number) => void;
  onError: (m: string) => void;
}) {
  const [all, setAll] = useState<Usecase[] | null>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Usecase[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listUsecases()
      .then((r) => setAll(r.usecases.filter((u) => !existingIds.has(u.id))))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : 'Failed to load use cases'));
  }, [existingIds, onError]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = all ?? [];
    if (!q) return list;
    return list.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.tags ?? []).some((t) => t.toLowerCase().includes(q)));
  }, [all, filter]);

  const submit = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const res = await api.addUsecasesToSuite(suiteId, selected.map((u) => u.id));
      onAdded(res.added.length);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to add use cases');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
      onDismiss={onClose}
      size="large"
      header="Add use cases to suite"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={submit} loading={busy} disabled={selected.length === 0}>
              Add{selected.length ? ` (${selected.length})` : ''}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <Table<Usecase>
        variant="embedded"
        items={filtered}
        loading={all === null}
        loadingText="Loading use cases"
        trackBy="id"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        filter={
          <TextFilter
            filteringText={filter}
            filteringPlaceholder="Find use cases"
            onChange={({ detail }) => setFilter(detail.filteringText)}
          />
        }
        empty={
          <Box textAlign="center" padding="m" color="text-body-secondary">
            {all && all.length === 0 ? 'All use cases are already in this suite.' : 'No matches.'}
          </Box>
        }
        columnDefinitions={[
          { id: 'name', header: 'Name', isRowHeader: true, cell: (u) => u.name || '(untitled)' },
          {
            id: 'status',
            header: 'Status',
            cell: (u) => u.active
              ? <StatusIndicator type="success">Active</StatusIndicator>
              : <StatusIndicator type="stopped" colorOverride="grey">Inactive</StatusIndicator>,
          },
          { id: 'tags', header: 'Tags', cell: (u) => (u.tags?.length ? u.tags.join(', ') : '—') },
        ]}
      />
    </Modal>
  );
}

// ---- Details tab ----------------------------------------------------------

function DetailsTab({
  suite,
  canWrite,
  onSaved,
  onError,
}: {
  suite: TestSuite;
  canWrite: boolean;
  onSaved: (s: TestSuite) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(suite.name);
  const [description, setDescription] = useState(suite.description);
  const [tags, setTags] = useState((suite.tags ?? []).join(', '));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(suite.name);
    setDescription(suite.description);
    setTags((suite.tags ?? []).join(', '));
  }, [suite]);

  const nameError = name.trim().length < 3 ? 'Name must be at least 3 characters.' : undefined;
  const tagsArr = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const dirty =
    name.trim() !== suite.name ||
    description !== suite.description ||
    tagsArr.join(',') !== (suite.tags ?? []).join(',');

  const save = async () => {
    if (nameError || !dirty) return;
    setBusy(true);
    try {
      const s = await api.updateTestSuite(suite.id, { name: name.trim(), description, tags: tagsArr });
      onSaved(s);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SpaceBetween size="l">
      <FormField label="Suite ID" description="Read-only — use this with the CLI (qa nova run-suite <id>).">
        <CopyToClipboard variant="inline" textToCopy={suite.id} copySuccessText="Suite ID copied" copyErrorText="Failed to copy" />
      </FormField>
      <FormField label="Name" errorText={canWrite ? nameError : undefined}>
        <Input value={name} readOnly={!canWrite} onChange={({ detail }) => setName(detail.value)} />
      </FormField>
      <FormField label="Description">
        <Textarea value={description} readOnly={!canWrite} onChange={({ detail }) => setDescription(detail.value)} rows={3} />
      </FormField>
      <FormField label="Tags" description="Comma-separated">
        <Input value={tags} readOnly={!canWrite} onChange={({ detail }) => setTags(detail.value)} placeholder="nightly, smoke" />
      </FormField>
      <Box color="text-body-secondary" fontSize="body-s">
        Created by {suite.created_by || '—'} · {suite.created_at || '—'}
      </Box>
      {canWrite && (
        <Box>
          <Button variant="primary" onClick={save} loading={busy} disabled={!dirty || !!nameError}>Save</Button>
        </Box>
      )}
    </SpaceBetween>
  );
}
