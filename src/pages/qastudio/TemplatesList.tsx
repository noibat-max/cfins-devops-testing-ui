import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextFilter from '@cloudscape-design/components/text-filter';
import Icon from '@cloudscape-design/components/icon';
import Spinner from '@cloudscape-design/components/spinner';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import AppChrome from '../../components/AppChrome';
import { QA_STUDIO_NAV, QA_STUDIO_APP_NAME } from '../../config/qaStudioNav';
import { useAuth } from '../../lib/auth';
import { hasScope } from '../../types';
import type { Template } from '../../types';
import * as api from '../../lib/api';
import './UseCasesList.css';

const BASE = '/apps/qa-studio/templates';

export default function TemplatesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/qawb/templates.write');
  const canApply = hasScope(user, 'api/qawb/usecases.write');

  const [items, setItems] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [applyTarget, setApplyTarget] = useState<Template | null>(null);

  const flash = useCallback((type: FlashbarProps.Type, content: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== id));
    setFlashes((f) => [...f, { id, type, content, dismissible: true, onDismiss: dismiss }]);
    if (type === 'success' || type === 'info') setTimeout(dismiss, 4000);
  }, []);

  const load = useCallback(() => {
    setError(null);
    api
      .listTemplates()
      .then((r) => setItems(r.templates))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load templates'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = items ?? [];
    if (!q) return list;
    return list.filter((t) => [t.name, t.description, t.id].some((s) => (s ?? '').toLowerCase().includes(q)));
  }, [items, filter]);

  return (
    <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
      <Box padding={{ horizontal: 'l', top: 'l', bottom: 'xxl' }}>
        <SpaceBetween size="l">
          {flashes.length > 0 && <Flashbar items={flashes} />}

          <Header
            variant="h1"
            counter={items ? `(${items.length})` : undefined}
            description="Reusable step libraries. Apply a template to create a new use case, or import one into an existing use case."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" iconName="refresh" onClick={load} ariaLabel="Refresh" />
                {canWrite && (
                  <Button variant="primary" iconName="add-plus" onClick={() => setShowCreate(true)}>
                    Create
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            Templates
          </Header>

          <div style={{ maxWidth: 480 }}>
            <TextFilter
              filteringText={filter}
              filteringPlaceholder="Find templates"
              filteringAriaLabel="Find templates"
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
                <b>{items.length === 0 ? 'No templates yet' : `No matches for “${filter}”`}</b>
                {items.length === 0 && canWrite && (
                  <div><Button onClick={() => setShowCreate(true)}>Create template</Button></div>
                )}
              </SpaceBetween>
            </Box>
          ) : (
            <div className="uc-grid">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="uc-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${t.name || 'template'}`}
                  onClick={() => navigate(`${BASE}/${t.id}`)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`${BASE}/${t.id}`); }
                  }}
                >
                  <Container
                    fitHeight
                    header={
                      <div className="uc-card-title-row">
                        <span className="uc-card-title">
                          <Icon name="file" />{' '}{t.name || '(untitled)'}
                        </span>
                        <Badge color="grey">v{t.version ?? 1}</Badge>
                      </div>
                    }
                  >
                    <div className="card-fill">
                      <SpaceBetween size="m">
                        <div className="uc-card-desc" title={t.description || undefined}>
                          {t.description || <span className="uc-card-desc--empty">No description</span>}
                        </div>
                        <Box fontSize="body-s" color="text-body-secondary">
                          <Icon name="user-profile" size="small" /> Created by{' '}
                          <span title={t.created_by || undefined}>{t.created_by || '—'}</span>
                          {t.created_at ? ` · ${t.created_at}` : ''}
                        </Box>
                      </SpaceBetween>

                      <span className="uc-card-actions" onClick={(e) => e.stopPropagation()}>
                        {canApply && (
                          <Button variant="link" iconName="add-plus" onClick={() => setApplyTarget(t)}>Apply</Button>
                        )}
                        <Button variant="primary" iconName="arrow-right" iconAlign="right" onClick={() => navigate(`${BASE}/${t.id}`)}>
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
          onCreated={(id) => { setShowCreate(false); navigate(`${BASE}/${id}`); }}
          onError={(m) => flash('error', m)}
        />
      )}
      {applyTarget && (
        <ApplyModal
          template={applyTarget}
          onClose={() => setApplyTarget(null)}
          onApplied={(uid) => { setApplyTarget(null); flash('success', 'Use case created from template'); navigate(`/apps/qa-studio/usecases/${uid}`); }}
          onError={(m) => flash('error', m)}
        />
      )}
    </AppChrome>
  );
}

function CreateModal({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (id: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const t = await api.createTemplate({ name: name.trim(), description });
      onCreated(t.id);
    } catch (e) { onError(e instanceof Error ? e.message : 'Create failed'); setBusy(false); }
  };
  return (
    <Modal visible onDismiss={onClose} header="Create template"
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!name.trim()} onClick={submit}>Create</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        <FormField label="Name"><Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="Policyholder login" /></FormField>
        <FormField label="Description"><Textarea value={description} onChange={({ detail }) => setDescription(detail.value)} /></FormField>
      </SpaceBetween>
    </Modal>
  );
}

function ApplyModal({ template, onClose, onApplied, onError }: { template: Template; onClose: () => void; onApplied: (uid: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState(`${template.name} (from template)`);
  const [startingUrl, setStartingUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.applyTemplate(template.id, { name: name.trim(), starting_url: startingUrl });
      onApplied(r.usecaseId);
    } catch (e) { onError(e instanceof Error ? e.message : 'Apply failed'); setBusy(false); }
  };
  return (
    <Modal visible onDismiss={onClose} header={`Apply “${template.name}”`}
      footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!name.trim()} onClick={submit}>Create use case</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m">
        <Alert type="info">This creates a new use case with the template's steps and variables copied in.</Alert>
        <FormField label="New use case name"><Input value={name} onChange={({ detail }) => setName(detail.value)} /></FormField>
        <FormField label="Starting URL" description="Optional — where the run begins."><Input value={startingUrl} onChange={({ detail }) => setStartingUrl(detail.value)} placeholder="https://example.com" /></FormField>
      </SpaceBetween>
    </Modal>
  );
}
