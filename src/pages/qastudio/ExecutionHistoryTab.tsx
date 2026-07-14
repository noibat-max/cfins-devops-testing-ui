/**
 * Execution History — runs of a use case (local CLI or remote), with drill-in
 * to per-step results and S3 artifacts. In-flight runs auto-refresh via polling.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator, { type StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import Modal from '@cloudscape-design/components/modal';
import Spinner from '@cloudscape-design/components/spinner';
import Badge from '@cloudscape-design/components/badge';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Link from '@cloudscape-design/components/link';
import * as api from '../../lib/api';
import type { Artifact, Execution, ExecutionStep } from '../../types';

type Flash = (type: 'success' | 'error' | 'info' | 'warning', content: string) => void;

const IN_FLIGHT = new Set(['pending', 'executing']);
const isInFlight = (s: string) => IN_FLIGHT.has(s);

function execStatus(s: string): { type: StatusIndicatorProps.Type; label: string } {
  switch (s) {
    case 'completed': return { type: 'success', label: 'Completed' };
    case 'failed': return { type: 'error', label: 'Failed' };
    case 'executing': return { type: 'in-progress', label: 'Executing' };
    case 'pending': return { type: 'pending', label: 'Pending' };
    case 'stopped': return { type: 'stopped', label: 'Stopped' };
    default: return { type: 'info', label: s || 'Unknown' };
  }
}
function stepStatus(s: string): { type: StatusIndicatorProps.Type; label: string } {
  switch (s) {
    case 'passed': return { type: 'success', label: 'Passed' };
    case 'failed': return { type: 'error', label: 'Failed' };
    case 'executing': return { type: 'in-progress', label: 'Executing' };
    case 'pending': return { type: 'pending', label: 'Pending' };
    default: return { type: 'info', label: s || '—' };
  }
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
function fmtDuration(start?: string, end?: string): string {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
function fmtBytes(n?: number): string {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExecutionHistoryTab({
  usecaseId, canWrite, onFlash, onError,
}: {
  usecaseId: string; canWrite: boolean; onFlash: Flash; onError: (m: string) => void;
}) {
  const [execs, setExecs] = useState<Execution[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // execution id for the modal
  const [confirmDelete, setConfirmDelete] = useState<Execution | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.listExecutions(usecaseId);
      // Newest first (API already sorts, but be defensive).
      r.executions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setExecs(r.executions);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load executions');
    }
  }, [usecaseId, onError]);

  useEffect(() => { load(); }, [load]);

  // Poll while any run is in flight.
  const anyInFlight = useMemo(() => (execs ?? []).some((e) => isInFlight(e.status)), [execs]);
  useEffect(() => {
    if (!anyInFlight) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [anyInFlight, load]);

  const onStop = async (e: Execution) => {
    setBusy(true);
    try { await api.stopExecution(usecaseId, e.executionId); onFlash('info', 'Stop requested'); load(); }
    catch (err) { onError(err instanceof Error ? err.message : 'Stop failed'); }
    finally { setBusy(false); }
  };
  const onDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.deleteExecution(usecaseId, confirmDelete.executionId);
      onFlash('success', 'Execution deleted');
      setConfirmDelete(null);
      load();
    } catch (err) { onError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Table<Execution>
        items={execs ?? []}
        loading={execs === null}
        loadingText="Loading executions"
        trackBy="executionId"
        variant="embedded"
        empty={
          <Box textAlign="center" padding="l" color="text-body-secondary">
            <SpaceBetween size="s">
              <b>No runs yet</b>
              <span>Run this use case from the CLI:</span>
              <Box variant="code">qa nova run {usecaseId} --env local</Box>
            </SpaceBetween>
          </Box>
        }
        header={
          <Header
            counter={execs ? `(${execs.length})` : undefined}
            actions={
              <Button iconName="refresh" onClick={load} loading={busy}>Refresh</Button>
            }
          >
            Execution History {anyInFlight && <Spinner size="normal" />}
          </Header>
        }
        columnDefinitions={[
          {
            id: 'status', header: 'Status',
            cell: (e) => { const s = execStatus(e.status); return <StatusIndicator type={s.type}>{s.label}</StatusIndicator>; },
          },
          { id: 'started', header: 'Started', cell: (e) => fmtTime(e.startedAt || e.createdAt) },
          { id: 'duration', header: 'Duration', cell: (e) => fmtDuration(e.startedAt, e.endedAt) },
          { id: 'mode', header: 'Mode', cell: (e) => <Badge>{e.mode || '—'}</Badge> },
          { id: 'by', header: 'Run by', cell: (e) => e.createdBy || '—' },
          {
            id: 'actions', header: 'Actions',
            cell: (e) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="inline-link" onClick={() => setSelected(e.executionId)}>View</Button>
                {canWrite && isInFlight(e.status) && (
                  <Button variant="inline-link" onClick={() => onStop(e)}>Stop</Button>
                )}
                {canWrite && (
                  <Button variant="inline-link" onClick={() => setConfirmDelete(e)}>Delete</Button>
                )}
              </SpaceBetween>
            ),
          },
        ]}
      />

      {selected && (
        <ExecutionDetailModal
          usecaseId={usecaseId}
          eid={selected}
          onClose={() => { setSelected(null); load(); }}
          onError={onError}
        />
      )}

      {confirmDelete && (
        <Modal
          visible
          onDismiss={() => setConfirmDelete(null)}
          header="Delete execution"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button variant="primary" loading={busy} onClick={onDelete}>Delete</Button>
              </SpaceBetween>
            </Box>
          }
        >
          This permanently deletes the run record, its step results, and all S3 artifacts. This cannot be undone.
        </Modal>
      )}
    </>
  );
}

function ExecutionDetailModal({
  usecaseId, eid, onClose, onError,
}: {
  usecaseId: string; eid: string; onClose: () => void; onError: (m: string) => void;
}) {
  const [exec, setExec] = useState<Execution | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[] | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
  const closedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [e, s, a] = await Promise.all([
        api.getExecution(usecaseId, eid),
        api.listExecutionSteps(usecaseId, eid),
        api.listArtifacts(usecaseId, eid),
      ]);
      if (closedRef.current) return;
      setExec(e);
      setSteps([...s.steps].sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0)));
      setArtifacts(a.artifacts);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load execution');
    }
  }, [usecaseId, eid, onError]);

  useEffect(() => { closedRef.current = false; load(); return () => { closedRef.current = true; }; }, [load]);

  // Poll while the run is in flight.
  useEffect(() => {
    if (!exec || !isInFlight(exec.status)) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [exec, load]);

  const s = exec ? execStatus(exec.status) : null;
  const images = (artifacts ?? []).filter((a) => a.url && a.contentType.startsWith('image/'));
  const videos = (artifacts ?? []).filter((a) => a.url && a.contentType.startsWith('video/'));
  const files = (artifacts ?? []).filter((a) => !a.contentType.startsWith('image/') && !a.contentType.startsWith('video/'));

  return (
    <Modal
      visible
      size="large"
      onDismiss={onClose}
      header={<>Run details {exec && isInFlight(exec.status) && <Spinner size="normal" />}</>}
      footer={<Box float="right"><Button variant="primary" onClick={onClose}>Close</Button></Box>}
    >
      {!exec ? (
        <Box textAlign="center" padding="l"><Spinner /> Loading…</Box>
      ) : (
        <SpaceBetween size="l">
          {/* Summary */}
          <Container header={<Header variant="h3">{s && <StatusIndicator type={s.type}>{s.label}</StatusIndicator>}</Header>}>
            <ColumnLayout columns={3} variant="text-grid">
              <div><Box variant="awsui-key-label">Execution ID</Box><Box fontSize="body-s"><code>{exec.executionId}</code></Box></div>
              <div><Box variant="awsui-key-label">Mode</Box><Badge>{exec.mode || '—'}</Badge></div>
              <div><Box variant="awsui-key-label">Run by</Box>{exec.createdBy || '—'}</div>
              <div><Box variant="awsui-key-label">Started</Box>{fmtTime(exec.startedAt || exec.createdAt)}</div>
              <div><Box variant="awsui-key-label">Ended</Box>{fmtTime(exec.endedAt)}</div>
              <div><Box variant="awsui-key-label">Duration</Box>{fmtDuration(exec.startedAt, exec.endedAt)}</div>
            </ColumnLayout>
            {exec.errorMessage && (
              <Box margin={{ top: 's' }} color="text-status-error">{exec.errorMessage}</Box>
            )}
          </Container>

          {/* Steps */}
          <Table<ExecutionStep>
            items={steps ?? []}
            loading={steps === null}
            loadingText="Loading steps"
            trackBy="stepId"
            variant="embedded"
            header={<Header variant="h3" counter={steps ? `(${steps.length})` : undefined}>Step results</Header>}
            empty={<Box textAlign="center" padding="m" color="text-body-secondary">No step results recorded.</Box>}
            columnDefinitions={[
              { id: 'sort', header: '#', width: 60, cell: (r) => r.sort },
              { id: 'status', header: 'Status', cell: (r) => { const st = stepStatus(r.status); return <StatusIndicator type={st.type}>{st.label}</StatusIndicator>; } },
              { id: 'result', header: 'Result', cell: (r) => <Box fontSize="body-s">{r.errorMessage || r.result || '—'}</Box> },
              { id: 'dur', header: 'Duration', cell: (r) => fmtDuration(r.startedAt, r.endedAt) },
            ]}
          />

          {/* Artifacts */}
          <Container header={<Header variant="h3" counter={artifacts ? `(${artifacts.length})` : undefined}>Artifacts</Header>}>
            {artifacts === null ? (
              <Box textAlign="center" padding="m"><Spinner /></Box>
            ) : artifacts.length === 0 ? (
              <Box color="text-body-secondary">No artifacts. Run with <code>--capture full</code> to also capture the HTML trace and video.</Box>
            ) : (
              <SpaceBetween size="l">
                {videos.length > 0 && (
                  <div>
                    <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Video</Box>
                    <SpaceBetween size="s">
                      {videos.map((v) => (
                        <video key={v.artifactId} src={v.url} controls style={{ width: '100%', maxWidth: 640, borderRadius: 8, background: '#000' }} />
                      ))}
                    </SpaceBetween>
                  </div>
                )}
                {images.length > 0 && (
                  <div>
                    <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Screenshots</Box>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {images.map((img) => (
                        <a key={img.artifactId} href={img.url} target="_blank" rel="noreferrer" title={img.filename}>
                          <img src={img.url} alt={img.filename}
                            style={{ height: 130, borderRadius: 8, border: '1px solid var(--color-border-divider-default, #d5dbdb)' }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {files.length > 0 && (
                  <div>
                    <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Files</Box>
                    <SpaceBetween size="xs">
                      {files.map((f) => (
                        <div key={f.artifactId}>
                          {f.url
                            ? <Link external href={f.url}>{f.filename}</Link>
                            : <span>{f.filename}</span>}
                          {' '}<Box variant="span" color="text-body-secondary" fontSize="body-s">
                            {f.artifactType}{f.sizeBytes ? ` · ${fmtBytes(f.sizeBytes)}` : ''}
                            {f.status !== 'uploaded' ? ` · ${f.status}` : ''}
                          </Box>
                        </div>
                      ))}
                    </SpaceBetween>
                  </div>
                )}
              </SpaceBetween>
            )}
          </Container>
        </SpaceBetween>
      )}
    </Modal>
  );
}
