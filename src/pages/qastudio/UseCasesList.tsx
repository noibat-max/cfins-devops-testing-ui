import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextFilter from '@cloudscape-design/components/text-filter';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
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

const USECASES_BASE = '/apps/qa-studio/usecases';

export default function UseCasesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/usecases.write');

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
      setFlashes((f) => [
        ...f,
        { id, type, content, dismissible: true, onDismiss: () => setFlashes((x) => x.filter((m) => m.id !== id)) },
      ]);
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
      [u.name, u.description, (u.tags ?? []).join(' ')].some((s) =>
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

          <Table<Usecase>
            variant="full-page"
            items={filtered}
            loading={items === null && !error}
            loadingText="Loading use cases"
            trackBy="id"
            empty={
              <Box textAlign="center" padding="l" color="text-body-secondary">
                <SpaceBetween size="s">
                  <b>No use cases</b>
                  {canWrite && (
                    <Button onClick={() => setShowCreate(true)}>Create use case</Button>
                  )}
                </SpaceBetween>
              </Box>
            }
            filter={
              <TextFilter
                filteringText={filter}
                filteringPlaceholder="Find use cases"
                filteringAriaLabel="Find use cases"
                onChange={({ detail }) => setFilter(detail.filteringText)}
              />
            }
            header={
              <Header
                variant="h1"
                counter={items ? `(${items.length})` : undefined}
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button iconName="refresh" onClick={load} ariaLabel="Refresh" />
                    {canWrite && (
                      <Button iconName="upload" onClick={() => setShowImport(true)}>
                        Import
                      </Button>
                    )}
                    {canWrite && (
                      <Button variant="primary" iconName="add-plus" onClick={() => setShowCreate(true)}>
                        Create use case
                      </Button>
                    )}
                  </SpaceBetween>
                }
              >
                Use cases
              </Header>
            }
            columnDefinitions={[
              {
                id: 'name',
                header: 'Name',
                cell: (u) => (
                  <Link href={`${USECASES_BASE}/${u.id}`} onFollow={(e) => { e.preventDefault(); navigate(`${USECASES_BASE}/${u.id}`); }}>
                    {u.name || '(untitled)'}
                  </Link>
                ),
                isRowHeader: true,
              },
              { id: 'description', header: 'Description', cell: (u) => u.description || '—' },
              {
                id: 'active',
                header: 'Active',
                cell: (u) => <Badge color={u.active ? 'green' : 'grey'}>{u.active ? 'Active' : 'Inactive'}</Badge>,
              },
              { id: 'tags', header: 'Tags', cell: (u) => (u.tags?.length ? u.tags.join(', ') : '—') },
              { id: 'region', header: 'Region', cell: (u) => u.executing_region || '—' },
              { id: 'created', header: 'Created', cell: (u) => u.created_at || '—' },
              {
                id: 'actions',
                header: '',
                cell: (u) => (
                  <ButtonDropdown
                    variant="inline-icon"
                    ariaLabel={`Actions for ${u.name}`}
                    items={[
                      { id: 'open', text: 'Open' },
                      { id: 'export', text: 'Export' },
                      { id: 'clone', text: 'Clone', disabled: !canWrite },
                      { id: 'delete', text: 'Delete', disabled: !canWrite },
                    ]}
                    onItemClick={({ detail }) => {
                      if (detail.id === 'open') navigate(`${USECASES_BASE}/${u.id}`);
                      else if (detail.id === 'export') onExport(u);
                      else if (detail.id === 'clone') setCloneTarget(u);
                      else if (detail.id === 'delete') setDeleteTarget(u);
                    }}
                  />
                ),
              },
            ]}
          />
          {error && <Flashbar items={[{ type: 'error', content: error, dismissible: false }]} />}
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
      onImported(r.usecaseId);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Import failed');
      setBusy(false);
    }
  };

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
            <Button variant="primary" loading={busy} onClick={submit}>Delete</Button>
          </SpaceBetween>
        </Box>
      }
    >
      Permanently delete <b>{target.name || '(untitled)'}</b> and all its steps? This cannot be undone.
    </Modal>
  );
}
