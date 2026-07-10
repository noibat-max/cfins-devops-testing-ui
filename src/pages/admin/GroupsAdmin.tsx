import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Badge from '@cloudscape-design/components/badge';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Multiselect from '@cloudscape-design/components/multiselect';
import WorkbenchTopBar from '../../components/WorkbenchTopBar';
import { useAuth } from '../../lib/auth';
import { isAdmin } from '../../types';
import type { Group, ScopeInfo } from '../../types';
import * as api from '../../lib/api';
import './GroupsAdmin.css';

const ADMIN_GROUP = 'admin';

export default function GroupsAdmin() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [scopes, setScopes] = useState<ScopeInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [scopesGroup, setScopesGroup] = useState<Group | null>(null);

  const flash = useCallback((type: FlashbarProps.Type, content: string) => {
    const fid = `${Date.now()}-${Math.random()}`;
    const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== fid));
    setFlashes((f) => [...f, { id: fid, type, content, dismissible: true, onDismiss: dismiss }]);
    if (type === 'success' || type === 'info') setTimeout(dismiss, 4000);
  }, []);

  const load = useCallback(() => {
    setError(null);
    api.listGroups().then((r) => setGroups(r.groups)).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load groups'));
  }, []);

  useEffect(() => {
    if (!isAdmin(user)) return;
    load();
    api.listScopes().then((r) => setScopes(r.scopes)).catch(() => undefined);
  }, [user, load]);

  if (!isAdmin(user)) {
    return (
      <>
        <WorkbenchTopBar />
        <Box padding="xxl">
          <Alert type="error" header="Access denied">
            You need administrator access to manage groups.
            <Box padding={{ top: 's' }}><Button onClick={() => navigate('/')}>Back to applications</Button></Box>
          </Alert>
        </Box>
      </>
    );
  }

  const scopeOptions = scopes.map((s) => ({ label: s.scope, value: s.scope, description: s.description }));

  return (
    <>
      <WorkbenchTopBar />
      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header
              variant="h1"
              counter={groups ? `(${groups.length})` : undefined}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="icon" iconName="refresh" ariaLabel="Refresh" onClick={load} />
                  <Button variant="primary" iconName="add-plus" onClick={() => setShowCreate(true)}>Create</Button>
                </SpaceBetween>
              }
              description="Groups map to scopes. Edits take effect immediately for all users. Scopes are defined by the API."
            >
              Groups
            </Header>
          </Box>
        }
      >
        <Box padding={{ horizontal: 'l', bottom: 'xxl' }}>
          <SpaceBetween size="l">
            {flashes.length > 0 && <Flashbar items={flashes} />}
            {error ? (
              <Flashbar items={[{ type: 'error', content: error, dismissible: false }]} />
            ) : groups === null ? (
              <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>
            ) : (
              <div className="group-grid">
                {groups.map((g) => {
                  const isAdminGroup = g.name === ADMIN_GROUP;
                  return (
                    <Container
                      key={g.name}
                      fitHeight
                      header={
                        <div className="group-card-title-row">
                          <span className="group-card-title">{g.name}</span>
                          {isAdminGroup && <Badge color="grey">protected</Badge>}
                        </div>
                      }
                    >
                      <div className="card-fill">
                        <SpaceBetween size="m">
                          <Box color="text-body-secondary" fontSize="body-s">{g.description || '—'}</Box>
                          <ScopeBadges scopes={g.scopes} onShowAll={() => setScopesGroup(g)} />
                        </SpaceBetween>
                        <div className="group-card-actions">
                          <span className="wb-danger">
                            <Button variant="link" iconName="remove" disabled={isAdminGroup} onClick={() => setDeleteTarget(g)}>Delete</Button>
                          </span>
                          <Button variant="primary" iconName="edit" onClick={() => setEditTarget(g)}>Edit</Button>
                        </div>
                      </div>
                    </Container>
                  );
                })}
              </div>
            )}
          </SpaceBetween>
        </Box>
      </ContentLayout>

      {showCreate && (
        <GroupModal
          title="Create group"
          scopeOptions={scopeOptions}
          onClose={() => setShowCreate(false)}
          onSubmit={(payload) => api.createGroup(payload)}
          onDone={(name) => { setShowCreate(false); flash('success', `Created “${name}”`); load(); }}
        />
      )}
      {editTarget && (
        <GroupModal
          title={`Edit group — ${editTarget.name}`}
          scopeOptions={scopeOptions}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={(payload) => api.updateGroup(editTarget.name, { description: payload.description, scopes: payload.scopes })}
          onDone={(name) => { setEditTarget(null); flash('success', `Updated ${name}`); load(); }}
        />
      )}
      {deleteTarget && (
        <DeleteGroupModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDone={() => { const n = deleteTarget.name; setDeleteTarget(null); flash('success', `Deleted ${n}`); load(); }}
        />
      )}
      {scopesGroup && (
        <Modal visible onDismiss={() => setScopesGroup(null)} header={`Scopes — ${scopesGroup.name}`}
          footer={<Box float="right"><Button variant="link" onClick={() => setScopesGroup(null)}>Close</Button></Box>}>
          <SpaceBetween size="xs">
            <Box color="text-body-secondary" fontSize="body-s">{scopesGroup.scopes.length} scope(s)</Box>
            <div className="scope-badge-wrap">
              {scopesGroup.scopes.map((s) => <Badge key={s} color="blue">{s}</Badge>)}
            </div>
          </SpaceBetween>
        </Modal>
      )}
    </>
  );
}

/** Scope badges clamped to ~two lines; a "+N more" opens the full list. */
function ScopeBadges({ scopes, onShowAll }: { scopes: string[]; onShowAll: () => void }) {
  const MAX = 6;
  if (!scopes.length) {
    return <Box color="text-status-inactive" fontSize="body-s">No scopes</Box>;
  }
  const visible = scopes.slice(0, MAX);
  const hidden = scopes.length - visible.length;
  return (
    <div className="scope-badge-wrap">
      {visible.map((s) => <Badge key={s} color="blue">{s}</Badge>)}
      {hidden > 0 && (
        <Button variant="inline-link" onClick={onShowAll}>+{hidden} more…</Button>
      )}
    </div>
  );
}

type Opt = { label?: string; value?: string; description?: string };
const values = (opts: readonly Opt[]): string[] => opts.map((o) => o.value).filter((v): v is string => !!v);

function GroupModal({ title, scopeOptions, initial, onClose, onSubmit, onDone }: {
  title: string;
  scopeOptions: Opt[];
  initial?: Group;
  onClose: () => void;
  onSubmit: (payload: { name: string; description: string; scopes: string[] }) => Promise<Group>;
  onDone: (name: string) => void;
}) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sel, setSel] = useState<readonly Opt[]>(scopeOptions.filter((o) => !!o.value && (initial?.scopes ?? []).includes(o.value)));
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nameError = !editing && /\s/.test(name) ? 'Name cannot contain spaces' : undefined;
  const canSubmit = editing || (!!name.trim() && !nameError);

  const submit = async () => {
    setSubmitError(null);
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), description, scopes: values(sel) });
      onDone(name.trim());
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
    }
  };

  return (
    <Modal visible onDismiss={onClose} header={title}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!canSubmit} onClick={submit}>{editing ? 'Save' : 'Create'}</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        {submitError && <Alert type="error">{submitError}</Alert>}
        <FormField label="Name" errorText={nameError}>
          <Input value={name} disabled={editing} onChange={({ detail }) => setName(detail.value)} />
        </FormField>
        <FormField label="Description">
          <Textarea value={description} onChange={({ detail }) => setDescription(detail.value)} rows={2} />
        </FormField>
        <FormField label="Scopes" description="Choose from the scopes the API defines.">
          <Multiselect selectedOptions={sel} options={scopeOptions} placeholder="Choose scopes" onChange={({ detail }) => setSel(detail.selectedOptions)} />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

function DeleteGroupModal({ target, onClose, onDone }: { target: Group; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setErr(null);
    setBusy(true);
    try { await api.deleteGroup(target.name); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Delete failed'); setBusy(false); }
  };
  return (
    <Modal visible onDismiss={onClose} header={`Delete ${target.name}`}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><span className="wb-danger-fill"><Button variant="primary" loading={busy} onClick={submit}>Delete</Button></span></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        {err && <Alert type="error">{err}</Alert>}
        <Box>Delete group <b>{target.name}</b>? Users in this group will lose its scopes.</Box>
      </SpaceBetween>
    </Modal>
  );
}
