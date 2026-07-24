/**
 * Suite executions — batch runs of a test suite, with a live roll-up (derived
 * from member executions) and drill-in to each member use case's result.
 * Runs are CLI-driven (`qa qawb run-suite`); in-flight runs auto-refresh.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Badge from '@cloudscape-design/components/badge';
import StatusIndicator, { type StatusIndicatorProps } from '@cloudscape-design/components/status-indicator';
import Spinner from '@cloudscape-design/components/spinner';
import Modal from '@cloudscape-design/components/modal';
import Container from '@cloudscape-design/components/container';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import type { FlashbarProps } from '@cloudscape-design/components/flashbar';
import type { SuiteExecution, SuiteExecutionDetail, SuiteExecMember, SuiteRunCounts } from '../../types';
import { ExecutionDetailModal } from './ExecutionHistoryTab';
import * as api from '../../lib/api';

type Flash = (t: FlashbarProps.Type, c: string) => void;

const isInFlight = (s: string) => s === 'pending' || s === 'running';

function suiteStatus(s: string): { type: StatusIndicatorProps.Type; label: string } {
  switch (s) {
    case 'completed': return { type: 'success', label: 'Completed' };
    case 'failed': return { type: 'error', label: 'Failed' };
    case 'running': return { type: 'in-progress', label: 'Running' };
    case 'stopped': return { type: 'stopped', label: 'Stopped' };
    case 'pending': return { type: 'pending', label: 'Pending' };
    default: return { type: 'pending', label: s };
  }
}

function memberStatus(s: string): { type: StatusIndicatorProps.Type; label: string } {
  switch (s) {
    case 'completed': return { type: 'success', label: 'Completed' };
    case 'failed': return { type: 'error', label: 'Failed' };
    case 'executing': return { type: 'in-progress', label: 'Executing' };
    case 'stopped': return { type: 'stopped', label: 'Stopped' };
    case 'skipped': return { type: 'stopped', label: 'Skipped' };
    default: return { type: 'pending', label: 'Pending' };
  }
}

function progressText(c: SuiteRunCounts): string {
  const parts: string[] = [];
  if (c.completed) parts.push(`${c.completed} passed`);
  if (c.failed) parts.push(`${c.failed} failed`);
  if (c.stopped) parts.push(`${c.stopped} stopped`);
  if (c.running) parts.push(`${c.running} running`);
  if (c.pending) parts.push(`${c.pending} pending`);
  return parts.join(' · ') || '—';
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function fmtDuration(start?: string, end?: string): string {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function SuiteExecutionsTab({
  suiteId, canWrite, onFlash, onError,
}: {
  suiteId: string; canWrite: boolean; onFlash: Flash; onError: (m: string) => void;
}) {
  const [runs, setRuns] = useState<SuiteExecution[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SuiteExecution | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.listSuiteExecutions(suiteId);
      setRuns(r.executions);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load suite runs');
    }
  }, [suiteId, onError]);

  useEffect(() => { load(); }, [load]);

  const anyInFlight = useMemo(() => (runs ?? []).some((r) => isInFlight(r.status)), [runs]);
  useEffect(() => {
    if (!anyInFlight) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [anyInFlight, load]);

  const onStop = async (r: SuiteExecution) => {
    setBusy(true);
    try {
      const res = await api.stopSuiteExecution(suiteId, r.suiteExecutionId);
      onFlash('info', `Stop requested for ${res.stopRequested} use case(s) — each stops at its next step.`);
      load();
    } catch (e) { onError(e instanceof Error ? e.message : 'Stop failed'); }
    finally { setBusy(false); }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.deleteSuiteExecution(suiteId, confirmDelete.suiteExecutionId);
      onFlash('success', 'Suite run deleted');
      setConfirmDelete(null);
      load();
    } catch (e) { onError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Table<SuiteExecution>
        items={runs ?? []}
        loading={runs === null}
        loadingText="Loading suite runs"
        trackBy="suiteExecutionId"
        variant="embedded"
        empty={
          <Box textAlign="center" padding="l" color="text-body-secondary">
            <SpaceBetween size="s">
              <b>No suite runs yet</b>
              <span>Use <b>Run Now</b> (top right) to run on ECS, or run it locally from the CLI:</span>
              <Box variant="code">qa qawb run-suite {suiteId} --env local</Box>
            </SpaceBetween>
          </Box>
        }
        header={
          <Header
            counter={runs ? `(${runs.length})` : undefined}
            actions={<Button variant="link" iconName="refresh" ariaLabel="Refresh" onClick={load} loading={busy} />}
          >
            Suite runs {anyInFlight && <Spinner size="normal" />}
          </Header>
        }
        columnDefinitions={[
          {
            id: 'seid', header: 'Run ID', isRowHeader: true,
            cell: (r) => (
              <Button variant="inline-link" onClick={() => setSelected(r.suiteExecutionId)}>
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>{r.suiteExecutionId}</span>
              </Button>
            ),
          },
          {
            id: 'status', header: 'Status',
            cell: (r) => {
              const s = r.mode === 'queued' && r.status === 'pending'
                ? { type: 'pending' as StatusIndicatorProps.Type, label: 'Queued' }
                : suiteStatus(r.status);
              return <StatusIndicator type={s.type}>{s.label}</StatusIndicator>;
            },
          },
          { id: 'progress', header: 'Results', cell: (r) => <Box fontSize="body-s" color="text-body-secondary">{progressText(r.counts)}</Box> },
          { id: 'total', header: 'Use cases', cell: (r) => r.totalUsecases },
          { id: 'started', header: 'Started', cell: (r) => fmtTime(r.createdAt) },
          { id: 'by', header: 'Run by', cell: (r) => r.triggeredBy || '—' },
          {
            id: 'actions', header: 'Actions',
            cell: (r) => (canWrite ? (
              <SpaceBetween direction="horizontal" size="xs">
                {isInFlight(r.status) && <Button variant="inline-link" onClick={() => onStop(r)}>Stop</Button>}
                <span className="wb-danger"><Button variant="inline-icon" iconName="remove" ariaLabel="Delete suite run" onClick={() => setConfirmDelete(r)} /></span>
              </SpaceBetween>
            ) : null),
          },
        ]}
      />

      {selected && (
        <SuiteRunModal suiteId={suiteId} seId={selected} onClose={() => setSelected(null)} onError={onError} />
      )}

      {confirmDelete && (
        <Modal
          visible
          onDismiss={() => setConfirmDelete(null)}
          header="Delete suite run"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setConfirmDelete(null)} disabled={busy}>Cancel</Button>
                <span className="wb-danger-fill">
                  <Button variant="primary" iconName="remove" loading={busy} onClick={onDelete}>Delete</Button>
                </span>
              </SpaceBetween>
            </Box>
          }
        >
          Delete this suite run and its {confirmDelete.totalUsecases} member execution(s) (results + artifacts)? This cannot be undone.
        </Modal>
      )}
    </>
  );
}

function SuiteRunModal({
  suiteId, seId, onClose, onError,
}: {
  suiteId: string; seId: string; onClose: () => void; onError: (m: string) => void;
}) {
  const [detail, setDetail] = useState<SuiteExecutionDetail | null>(null);
  // The member the user drilled into — opens its full step/artifact results
  // inline (stacked over this modal), so they never leave the suite run.
  const [drill, setDrill] = useState<SuiteExecMember | null>(null);

  const load = useCallback(async () => {
    try { setDetail(await api.getSuiteExecution(suiteId, seId)); }
    catch (e) { onError(e instanceof Error ? e.message : 'Failed to load suite run'); }
  }, [suiteId, seId, onError]);

  useEffect(() => { load(); }, [load]);

  const inFlight = detail ? isInFlight(detail.status) : false;
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [inFlight, load]);

  const s = detail
    ? (detail.mode === 'queued' && detail.status === 'pending'
        ? { type: 'pending' as StatusIndicatorProps.Type, label: 'Queued' }
        : suiteStatus(detail.status))
    : null;

  return (
    <Modal
      visible
      onDismiss={onClose}
      size="large"
      header={<>Suite run {detail && inFlight && <Spinner size="normal" />}</>}
      footer={<Box float="right"><Button variant="primary" onClick={onClose}>Close</Button></Box>}
    >
      {!detail ? (
        <Box textAlign="center" padding="l"><Spinner size="large" /></Box>
      ) : (
        <SpaceBetween size="l">
          <Container header={<Header variant="h3">{s && <StatusIndicator type={s.type}>{s.label}</StatusIndicator>}</Header>}>
            <ColumnLayout columns={4} variant="text-grid">
              <div><Box variant="awsui-key-label">Suite</Box>{detail.suiteName || '—'}</div>
              <div><Box variant="awsui-key-label">Results</Box>{progressText(detail.counts)}</div>
              <div><Box variant="awsui-key-label">Run by</Box>{detail.triggeredBy || '—'}</div>
              <div><Box variant="awsui-key-label">Started</Box>{fmtTime(detail.createdAt)}</div>
            </ColumnLayout>
          </Container>

          <Table<SuiteExecutionDetail['members'][number]>
            variant="embedded"
            items={detail.members}
            trackBy="executionId"
            header={<Header variant="h3" counter={`(${detail.members.length})`}>Use cases</Header>}
            empty={<Box textAlign="center" padding="m" color="text-body-secondary">No members.</Box>}
            columnDefinitions={[
              {
                id: 'name', header: 'Use case', isRowHeader: true,
                cell: (m) => (
                  <Button variant="inline-link" onClick={() => setDrill(m)}>
                    {m.usecaseName || m.usecaseId}
                  </Button>
                ),
              },
              {
                id: 'status', header: 'Status',
                cell: (m) => {
                  const ms = detail?.mode === 'queued' && m.status === 'pending'
                    ? { type: 'pending' as StatusIndicatorProps.Type, label: 'Queued' }
                    : memberStatus(m.status);
                  return <StatusIndicator type={ms.type}>{ms.label}</StatusIndicator>;
                },
              },
              { id: 'duration', header: 'Duration', cell: (m) => fmtDuration(m.startedAt, m.endedAt) },
              {
                id: 'view', header: '',
                cell: (m) => (
                  <SpaceBetween direction="horizontal" size="xs">
                    {m.errorMessage ? <Badge color="red">error</Badge> : null}
                    <Button variant="inline-link" iconName="status-info" onClick={() => setDrill(m)}>Results</Button>
                  </SpaceBetween>
                ),
              },
            ]}
          />
          <Box fontSize="body-s" color="text-body-secondary">
            Click a use case to see its per-step results and artifacts — without leaving this suite run.
          </Box>
        </SpaceBetween>
      )}

      {drill && (
        <ExecutionDetailModal
          usecaseId={drill.usecaseId}
          eid={drill.executionId}
          onClose={() => { setDrill(null); load(); }}
          onError={onError}
        />
      )}
    </Modal>
  );
}
