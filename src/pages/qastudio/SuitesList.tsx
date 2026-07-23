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
import Spinner from '@cloudscape-design/components/spinner';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import AppChrome from '../../components/AppChrome';
import { QA_STUDIO_NAV, QA_STUDIO_APP_NAME } from '../../config/qaStudioNav';
import { useAuth } from '../../lib/auth';
import { hasScope } from '../../types';
import type { TestSuite } from '../../types';
import * as api from '../../lib/api';
import './UseCasesList.css';

const SUITES_BASE = '/apps/qa-studio/suites';

export default function SuitesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/qawb/suite.write');

  const [items, setItems] = useState<TestSuite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);

  const [showCreate, setShowCreate] = useState(false);

  const flash = useCallback((type: FlashbarProps.Type, content: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== id));
    setFlashes((f) => [...f, { id, type, content, dismissible: true, onDismiss: dismiss }]);
    if (type === 'success' || type === 'info') setTimeout(dismiss, 4000);
  }, []);

  const load = useCallback(() => {
    setError(null);
    api
      .listTestSuites()
      .then((r) => setItems(r.testSuites))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load test suites'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = items ?? [];
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [items, filter]);

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
                  <Button variant="primary" iconName="add-plus" onClick={() => setShowCreate(true)}>
                    Create
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            Test suites
          </Header>

          <Box color="text-body-secondary">
            Group use cases and run them together as a batch. (Running a suite arrives in the next slice.)
          </Box>

          <div style={{ maxWidth: 480 }}>
            <TextFilter
              filteringText={filter}
              filteringPlaceholder="Find test suites"
              filteringAriaLabel="Find test suites"
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
                <b>{items.length === 0 ? 'No test suites' : `No matches for “${filter}”`}</b>
                {items.length === 0 && canWrite && (
                  <div><Button onClick={() => setShowCreate(true)}>Create test suite</Button></div>
                )}
              </SpaceBetween>
            </Box>
          ) : (
            <div className="uc-grid">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="uc-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${s.name}`}
                  onClick={() => navigate(`${SUITES_BASE}/${s.id}`)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`${SUITES_BASE}/${s.id}`); }
                  }}
                >
                  <Container
                    fitHeight
                    header={
                      <div className="uc-card-title-row">
                        <span className="uc-card-title">{s.name}</span>
                        <Badge color={s.usecaseCount ? 'blue' : 'grey'}>
                          {s.usecaseCount ?? 0} use case{s.usecaseCount === 1 ? '' : 's'}
                        </Badge>
                      </div>
                    }
                  >
                    <div className="card-fill">
                      <SpaceBetween size="m">
                        {s.tags?.length ? (
                          <SpaceBetween direction="horizontal" size="xs">
                            {s.tags.map((t) => (<Badge key={t} color="blue">{t}</Badge>))}
                          </SpaceBetween>
                        ) : null}

                        <div className="uc-card-desc" title={s.description || undefined}>
                          {s.description || <span className="uc-card-desc--empty">No description</span>}
                        </div>

                        {/* Suite id + copy — stopPropagation so it doesn't open the card */}
                        <div className="uc-card-id" onClick={(e) => e.stopPropagation()}>
                          <span className="uc-card-id-label">ID</span>
                          <code className="uc-card-id-val" title={s.id}>{s.id}</code>
                          <Button
                            variant="inline-icon"
                            iconName="copy"
                            ariaLabel={`Copy ID for ${s.name}`}
                            onClick={() =>
                              navigator.clipboard?.writeText(s.id).then(
                                () => flash('success', 'Suite ID copied'),
                                () => flash('error', 'Copy failed'),
                              )
                            }
                          />
                        </div>

                        <Box fontSize="body-s" color="text-body-secondary">
                          <Icon name="user-profile" size="small" /> Created by{' '}
                          <span title={s.created_by || undefined}>{s.created_by || '—'}</span>
                          {' · '}{s.created_at || '—'}
                        </Box>
                      </SpaceBetween>

                      <span className="uc-card-actions" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="primary"
                          iconName="arrow-right"
                          iconAlign="right"
                          onClick={() => navigate(`${SUITES_BASE}/${s.id}`)}
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
        <CreateSuiteModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); navigate(`${SUITES_BASE}/${id}`); }}
          onError={(m) => flash('error', m)}
        />
      )}

    </AppChrome>
  );
}

function CreateSuiteModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);

  const nameError = name.trim() && name.trim().length < 3 ? 'Name must be at least 3 characters.' : undefined;

  const submit = async () => {
    if (!name.trim() || nameError) return;
    setBusy(true);
    try {
      const s = await api.createTestSuite({
        name: name.trim(),
        description: description.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      onCreated(s.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to create test suite');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
      onDismiss={onClose}
      header="Create test suite"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={submit} loading={busy} disabled={!name.trim() || !!nameError}>Create</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <FormField label="Name" errorText={nameError}>
          <Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="Nightly regression" autoFocus />
        </FormField>
        <FormField label="Description" description="Optional">
          <Textarea value={description} onChange={({ detail }) => setDescription(detail.value)} rows={2} />
        </FormField>
        <FormField label="Tags" description="Optional, comma-separated">
          <Input value={tags} onChange={({ detail }) => setTags(detail.value)} placeholder="nightly, smoke" />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

