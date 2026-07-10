import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Badge from '@cloudscape-design/components/badge';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Multiselect from '@cloudscape-design/components/multiselect';
import WorkbenchTopBar from '../../components/WorkbenchTopBar';
import { useAuth } from '../../lib/auth';
import { isAdmin } from '../../types';
import type { AdminUser, Group } from '../../types';
import * as api from '../../lib/api';
import './UsersAdmin.css';

export default function UsersAdmin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = user?.username ?? '';

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const flash = useCallback((type: FlashbarProps.Type, content: string) => {
    const fid = `${Date.now()}-${Math.random()}`;
    const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== fid));
    setFlashes((f) => [...f, { id: fid, type, content, dismissible: true, onDismiss: dismiss }]);
    if (type === 'success' || type === 'info') setTimeout(dismiss, 4000);
  }, []);

  const load = useCallback(() => {
    setError(null);
    api.listUsers().then((r) => setUsers(r.users)).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load users'));
  }, []);

  useEffect(() => {
    if (!isAdmin(user)) return;
    load();
    api.listGroups().then((r) => setGroups(r.groups)).catch(() => undefined);
  }, [user, load]);

  if (!isAdmin(user)) {
    return (
      <>
        <WorkbenchTopBar />
        <Box padding="xxl">
          <Alert type="error" header="Access denied">
            You need administrator access to manage users.
            <Box padding={{ top: 's' }}><Button onClick={() => navigate('/')}>Back to applications</Button></Box>
          </Alert>
        </Box>
      </>
    );
  }

  const groupOptions = groups.map((g) => ({ label: g.name, value: g.name, description: g.description }));

  return (
    <>
      <WorkbenchTopBar />
      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header
              variant="h1"
              counter={users ? `(${users.length})` : undefined}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="icon" iconName="refresh" ariaLabel="Refresh" onClick={load} />
                  <Button variant="primary" iconName="add-plus" onClick={() => setShowCreate(true)}>Create</Button>
                </SpaceBetween>
              }
              description="Local username/password users. SSO users are managed in Cognito."
            >
              Users
            </Header>
          </Box>
        }
      >
        <Box padding={{ horizontal: 'l', bottom: 'xxl' }}>
          <SpaceBetween size="l">
            {flashes.length > 0 && <Flashbar items={flashes} />}
            {error ? (
              <Flashbar items={[{ type: 'error', content: error, dismissible: false }]} />
            ) : users === null ? (
              <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>
            ) : (
              <div className="user-grid">
                {users.map((u) => {
                  const isSelf = u.username === me;
                  return (
                    <Container
                      key={u.username}
                      fitHeight
                      header={
                        <div className="user-card-title-row">
                          <span className="user-card-title">{u.username}</span>
                          {u.status === 'active' ? (
                            <StatusIndicator type="success">Active</StatusIndicator>
                          ) : (
                            <StatusIndicator type="stopped" colorOverride="grey">Disabled</StatusIndicator>
                          )}
                          {isSelf && <Badge color="blue">You</Badge>}
                        </div>
                      }
                    >
                      <div className="card-fill">
                        <SpaceBetween size="m">
                          <Box color="text-body-secondary" fontSize="body-s">
                            {u.displayName || '—'}{u.email ? ` · ${u.email}` : ''}
                          </Box>
                          <SpaceBetween direction="horizontal" size="xs">
                            {u.groups.length ? u.groups.map((g) => <Badge key={g} color="blue">{g}</Badge>) : <Box color="text-status-inactive" fontSize="body-s">No groups</Box>}
                          </SpaceBetween>
                        </SpaceBetween>
                        <div className="user-card-actions">
                          <Button variant="link" iconName="key" disabled={isSelf} onClick={() => setPwTarget(u)}>Set password</Button>
                          <span className="wb-danger">
                            <Button variant="link" iconName="remove" disabled={isSelf} onClick={() => setDeleteTarget(u)}>Delete</Button>
                          </span>
                          <Button variant="primary" iconName="edit" disabled={isSelf} onClick={() => setEditTarget(u)}>Edit</Button>
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
        <CreateUserModal
          groupOptions={groupOptions}
          onClose={() => setShowCreate(false)}
          onCreated={(name) => { setShowCreate(false); flash('success', `Created “${name}”`); load(); }}
        />
      )}
      {pwTarget && (
        <SetPasswordModal
          target={pwTarget}
          onClose={() => setPwTarget(null)}
          onDone={() => { const n = pwTarget.username; setPwTarget(null); flash('success', `Password updated for ${n}`); }}
          onError={(m) => flash('error', m)}
        />
      )}
      {editTarget && (
        <EditUserModal
          target={editTarget}
          groupOptions={groupOptions}
          onClose={() => setEditTarget(null)}
          onDone={() => { const n = editTarget.username; setEditTarget(null); flash('success', `Updated ${n}`); load(); }}
        />
      )}
      {deleteTarget && (
        <DeleteUserModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDone={() => { const n = deleteTarget.username; setDeleteTarget(null); flash('success', `Deleted ${n}`); load(); }}
          onError={(m) => flash('error', m)}
        />
      )}
    </>
  );
}

type Opt = { label?: string; value?: string; description?: string };

const values = (opts: readonly Opt[]): string[] =>
  opts.map((o) => o.value).filter((v): v is string => !!v);

function CreateUserModal({ groupOptions, onClose, onCreated }: { groupOptions: Opt[]; onClose: () => void; onCreated: (name: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selGroups, setSelGroups] = useState<readonly Opt[]>([]);
  const [status, setStatus] = useState<Opt>({ label: 'Active', value: 'active' });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const usernameError = /\s/.test(username)
    ? 'Username cannot contain spaces'
    : undefined;
  const emailError =
    email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? 'Enter a valid email address'
      : undefined;
  const passwordError =
    password.length > 0 && password.length < 8
      ? 'Password must be at least 8 characters'
      : undefined;
  const valid =
    !!username.trim() && !usernameError && password.length >= 8 && !emailError;

  const submit = async () => {
    setSubmitError(null);
    setBusy(true);
    try {
      await api.createUser({
        username: username.trim(),
        password,
        email,
        displayName,
        groups: values(selGroups),
        status: status.value ?? 'active',
      });
      onCreated(username.trim());
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Create failed');
      setBusy(false);
    }
  };

  return (
    <Modal visible onDismiss={onClose} header="Create user"
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!valid} onClick={submit}>Create</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        {submitError && <Alert type="error">{submitError}</Alert>}
        <FormField label="Username" errorText={usernameError}>
          <Input value={username} onChange={({ detail }) => setUsername(detail.value)} />
        </FormField>
        <FormField label="Password" description="At least 8 characters." errorText={passwordError}>
          <Input type="password" value={password} onChange={({ detail }) => setPassword(detail.value)} />
        </FormField>
        <FormField label="Display name">
          <Input value={displayName} onChange={({ detail }) => setDisplayName(detail.value)} />
        </FormField>
        <FormField label="Email" errorText={emailError}>
          <Input value={email} onChange={({ detail }) => setEmail(detail.value)} />
        </FormField>
        <FormField label="Groups">
          <Multiselect selectedOptions={selGroups} options={groupOptions} placeholder="Choose groups" onChange={({ detail }) => setSelGroups(detail.selectedOptions)} />
        </FormField>
        <FormField label="Status">
          <Select selectedOption={status} options={[{ label: 'Active', value: 'active' }, { label: 'Disabled', value: 'disabled' }]} onChange={({ detail }) => setStatus(detail.selectedOption as Opt)} />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

function SetPasswordModal({ target, onClose, onDone, onError }: { target: AdminUser; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await api.setUserPassword(target.username, password); onDone(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  };
  return (
    <Modal visible onDismiss={onClose} header={`Set password — ${target.username}`}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={password.length < 8} onClick={submit}>Update</Button></SpaceBetween></Box>}>
      <FormField label="New password" description="At least 8 characters."><Input type="password" value={password} onChange={({ detail }) => setPassword(detail.value)} /></FormField>
    </Modal>
  );
}

function EditUserModal({ target, groupOptions, onClose, onDone }: { target: AdminUser; groupOptions: Opt[]; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState(target.email);
  const [displayName, setDisplayName] = useState(target.displayName);
  const [status, setStatus] = useState<Opt>({ label: target.status === 'active' ? 'Active' : 'Disabled', value: target.status });
  const [sel, setSel] = useState<readonly Opt[]>(groupOptions.filter((o) => !!o.value && target.groups.includes(o.value)));
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address' : undefined;

  const submit = async () => {
    setSubmitError(null);
    setBusy(true);
    try {
      await api.updateUser(target.username, {
        email,
        displayName,
        status: status.value ?? 'active',
        groups: values(sel),
      });
      onDone();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Update failed');
      setBusy(false);
    }
  };

  return (
    <Modal visible onDismiss={onClose} header={`Edit user — ${target.username}`}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!!emailError} onClick={submit}>Save</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        {submitError && <Alert type="error">{submitError}</Alert>}
        <FormField label="Display name"><Input value={displayName} onChange={({ detail }) => setDisplayName(detail.value)} /></FormField>
        <FormField label="Email" errorText={emailError}><Input value={email} onChange={({ detail }) => setEmail(detail.value)} /></FormField>
        <FormField label="Status"><Select selectedOption={status} options={[{ label: 'Active', value: 'active' }, { label: 'Disabled', value: 'disabled' }]} onChange={({ detail }) => setStatus(detail.selectedOption as Opt)} /></FormField>
        <FormField label="Groups"><Multiselect selectedOptions={sel} options={groupOptions} placeholder="Choose groups" onChange={({ detail }) => setSel(detail.selectedOptions)} /></FormField>
      </SpaceBetween>
    </Modal>
  );
}

function DeleteUserModal({ target, onClose, onDone, onError }: { target: AdminUser; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await api.deleteUser(target.username); onDone(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  };
  return (
    <Modal visible onDismiss={onClose} header={`Delete ${target.username}`}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><span className="wb-danger-fill"><Button variant="primary" loading={busy} onClick={submit}>Delete</Button></span></SpaceBetween></Box>}>
      Permanently delete user <b>{target.username}</b>? This cannot be undone.
    </Modal>
  );
}
