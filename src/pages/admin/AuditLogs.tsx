import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import Badge from '@cloudscape-design/components/badge';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Autosuggest from '@cloudscape-design/components/autosuggest';
import DateRangePicker, {
  type DateRangePickerProps,
} from '@cloudscape-design/components/date-range-picker';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import WorkbenchTopBar from '../../components/WorkbenchTopBar';
import { useAuth } from '../../lib/auth';
import { isAdmin } from '../../types';
import type { AdminUser, AuditEvent } from '../../types';
import * as api from '../../lib/api';
import './AuditLogs.css';

const PAGE = 50;

const ACTION_COLOR: Record<string, 'green' | 'blue' | 'red' | 'grey'> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  login: 'grey',
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/** Pretty-print the redacted JSON body; fall back to raw text. */
function pretty(body: string): string {
  if (!body) return '(no body)';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

// ---- date-time range picker (one field for the whole from→to window) ----
const RELATIVE_OPTIONS: DateRangePickerProps.RelativeOption[] = [
  { key: 'prev-15m', amount: 15, unit: 'minute', type: 'relative' },
  { key: 'prev-1h', amount: 1, unit: 'hour', type: 'relative' },
  { key: 'prev-6h', amount: 6, unit: 'hour', type: 'relative' },
  { key: 'prev-1d', amount: 1, unit: 'day', type: 'relative' },
  { key: 'prev-7d', amount: 7, unit: 'day', type: 'relative' },
];

const isValidRange: DateRangePickerProps.ValidationFunction = (value) => {
  if (!value) return { valid: false, errorMessage: 'Select a range.' };
  if (value.type === 'absolute') {
    if (!value.startDate || !value.endDate) {
      return { valid: false, errorMessage: 'Select a start and end date/time.' };
    }
    if (new Date(value.startDate).getTime() > new Date(value.endDate).getTime()) {
      return { valid: false, errorMessage: 'The start must be before the end.' };
    }
  }
  return { valid: true };
};

const RANGE_I18N: DateRangePickerProps.I18nStrings = {
  todayAriaLabel: 'Today',
  nextMonthAriaLabel: 'Next month',
  previousMonthAriaLabel: 'Previous month',
  customRelativeRangeDurationLabel: 'Duration',
  customRelativeRangeDurationPlaceholder: 'Enter duration',
  customRelativeRangeOptionLabel: 'Custom range',
  customRelativeRangeOptionDescription: 'Set a custom range in the past',
  customRelativeRangeUnitLabel: 'Unit of time',
  formatRelativeRange: (e) => `Last ${e.amount} ${e.unit}${e.amount === 1 ? '' : 's'}`,
  formatUnit: (unit, value) => (value === 1 ? unit : `${unit}s`),
  relativeModeTitle: 'Relative range',
  absoluteModeTitle: 'Absolute range',
  relativeRangeSelectionHeading: 'Choose a range',
  startDateLabel: 'Start date',
  endDateLabel: 'End date',
  startTimeLabel: 'Start time',
  endTimeLabel: 'End time',
  clearButtonLabel: 'Clear and dismiss',
  cancelButtonLabel: 'Cancel',
  applyButtonLabel: 'Apply',
  dateTimeConstraintText: 'Use 24-hour format.',
};

const UNIT_MS: Record<string, number> = {
  second: 1e3, minute: 6e4, hour: 3.6e6, day: 8.64e7,
  week: 6.048e8, month: 2.6298e9, year: 3.15576e10,
};

/** DateRangePicker value → the API's {from,to} ISO window (UTC "Z"). */
function rangeToWindow(value: DateRangePickerProps.Value | null): { from?: string; to?: string } {
  const iso = (d: string) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (!value) return {};
  if (value.type === 'absolute') {
    return {
      from: value.startDate ? iso(value.startDate) : undefined,
      to: value.endDate ? iso(value.endDate) : undefined,
    };
  }
  const now = Date.now(); // relative = "last N units" ending now
  const start = now - (UNIT_MS[value.unit] ?? 0) * value.amount;
  return { from: iso(new Date(start).toISOString()), to: iso(new Date(now).toISOString()) };
}

export default function AuditLogs() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<AuditEvent[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashes] = useState<FlashbarProps.MessageDefinition[]>([]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [actor, setActor] = useState('');
  const [range, setRange] = useState<DateRangePickerProps.Value | null>(null);
  const [detail, setDetail] = useState<AuditEvent | null>(null);

  const fetchPage = useCallback(
    (append: boolean, cursor?: string, override?: { user: string; from?: string; to?: string }) => {
      const w = rangeToWindow(range);
      const params = override ?? { user: actor, from: w.from, to: w.to };
      setLoading(true);
      setError(null);
      api
        .listAudit({
          user: params.user || undefined,
          from: params.from,
          to: params.to,
          limit: PAGE,
          cursor,
        })
        .then((r) => {
          setItems((prev) => (append && prev ? [...prev, ...r.items] : r.items));
          setNextCursor(r.nextCursor);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load audit log'))
        .finally(() => setLoading(false));
    },
    [actor, range],
  );

  useEffect(() => {
    if (!isAdmin(user)) return;
    api.listUsers().then((r) => setUsers(r.users)).catch(() => undefined);
    fetchPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!isAdmin(user)) {
    return (
      <>
        <WorkbenchTopBar />
        <Box padding="xxl">
          <Alert type="error" header="Access denied">
            You need administrator access to view audit logs.
            <Box padding={{ top: 's' }}>
              <Button onClick={() => navigate('/')}>Back to applications</Button>
            </Box>
          </Alert>
        </Box>
      </>
    );
  }

  const actorOptions = users.map((u) => ({ value: u.username }));
  const clearFilters = () => {
    setActor('');
    setRange(null);
    fetchPage(false, undefined, { user: '', from: undefined, to: undefined });
  };

  return (
    <>
      <WorkbenchTopBar />
      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header
              variant="h1"
              counter={items ? `(${items.length}${nextCursor ? '+' : ''})` : undefined}
              description="Every create, edit, and delete performed in the workbench — with actor, request payload (redacted), and result."
            >
              Audit logs
            </Header>
          </Box>
        }
      >
        <Box padding={{ horizontal: 'l', bottom: 'xxl' }}>
          <SpaceBetween size="l">
            {flashes.length > 0 && <Flashbar items={flashes} />}

            {/* Filters — inputs and actions bottom-aligned in one row */}
            <div className="audit-filters">
              <div className="audit-filter-field audit-filter-actor">
                <FormField label="Actor">
                  <Autosuggest
                    value={actor}
                    onChange={({ detail: d }) => setActor(d.value)}
                    onSelect={({ detail: d }) => {
                      const w = rangeToWindow(range);
                      fetchPage(false, undefined, { user: d.value, from: w.from, to: w.to });
                    }}
                    options={actorOptions}
                    placeholder="All users"
                    empty="No matching users"
                    enteredTextLabel={(v) => `Filter by "${v}"`}
                    filteringType="auto"
                    ariaLabel="Filter by actor"
                  />
                </FormField>
              </div>
              <div className="audit-filter-field audit-filter-range">
                <FormField label="Time range">
                  <DateRangePicker
                    value={range}
                    onChange={({ detail: d }) => {
                      setRange(d.value);
                      const w = rangeToWindow(d.value);
                      fetchPage(false, undefined, { user: actor, from: w.from, to: w.to });
                    }}
                    relativeOptions={RELATIVE_OPTIONS}
                    isValidRange={isValidRange}
                    i18nStrings={RANGE_I18N}
                    placeholder="Any time — pick a date + time range"
                    timeInputFormat="hh:mm:ss"
                  />
                </FormField>
              </div>
              <div className="audit-filter-actions">
                <SpaceBetween direction="horizontal" size="s" alignItems="center">
                  <Button variant="primary" onClick={() => fetchPage(false)}>
                    Apply
                  </Button>
                  <Button variant="link" onClick={clearFilters}>
                    Clear
                  </Button>
                  <Button variant="link" iconName="refresh" onClick={() => fetchPage(false)}>
                    Refresh
                  </Button>
                </SpaceBetween>
              </div>
            </div>

            {error ? (
              <Flashbar items={[{ type: 'error', content: error, dismissible: false }]} />
            ) : items === null ? (
              <Box textAlign="center" padding="xxl">
                <Spinner size="large" />
              </Box>
            ) : (
              <SpaceBetween size="m">
                <Table<AuditEvent>
                  variant="container"
                  wrapLines
                  loading={loading && items.length === 0}
                  items={items}
                  columnDefinitions={[
                    { id: 'time', header: 'Time', cell: (e) => fmt(e.timestamp), width: 190 },
                    { id: 'actor', header: 'Actor', cell: (e) => <b>{e.actor}</b>, width: 130 },
                    {
                      id: 'action',
                      header: 'Action',
                      cell: (e) => <Badge color={ACTION_COLOR[e.action] ?? 'grey'}>{e.action}</Badge>,
                      width: 110,
                    },
                    {
                      id: 'request',
                      header: 'Request',
                      cell: (e) => (
                        <Box fontSize="body-s">
                          <b>{e.method}</b>{' '}
                          <span style={{ fontFamily: 'monospace', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                            {e.path}
                          </span>
                        </Box>
                      ),
                    },
                    {
                      id: 'result',
                      header: 'Result',
                      cell: (e) =>
                        e.outcome === 'success' ? (
                          <StatusIndicator type="success">{e.status}</StatusIndicator>
                        ) : (
                          <StatusIndicator type="error">{e.status}</StatusIndicator>
                        ),
                      width: 110,
                    },
                    {
                      id: 'details',
                      header: '',
                      cell: (e) => (
                        <Button variant="inline-link" onClick={() => setDetail(e)}>
                          Details
                        </Button>
                      ),
                      width: 90,
                    },
                  ]}
                  empty={
                    <Box textAlign="center" padding="l" color="text-body-secondary">
                      No audit events for these filters.
                    </Box>
                  }
                />
                {nextCursor && (
                  <Box textAlign="center">
                    <Button loading={loading} onClick={() => fetchPage(true, nextCursor)}>
                      Load more
                    </Button>
                  </Box>
                )}
              </SpaceBetween>
            )}
          </SpaceBetween>
        </Box>
      </ContentLayout>

      {detail && <DetailModal event={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function DetailModal({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  const row = (label: string, value: ReactNode) => (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{value}</div>
    </div>
  );
  return (
    <Modal
      visible
      onDismiss={onClose}
      header="Audit event"
      size="large"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <ColumnLayout columns={2} variant="text-grid">
          {row('Time', fmt(event.timestamp))}
          {row('Actor', event.actor)}
          {row('Action', <Badge color={ACTION_COLOR[event.action] ?? 'grey'}>{event.action}</Badge>)}
          {row(
            'Result',
            event.outcome === 'success' ? (
              <StatusIndicator type="success">{event.status}</StatusIndicator>
            ) : (
              <StatusIndicator type="error">{event.status}</StatusIndicator>
            ),
          )}
          {row('Method', event.method)}
          {row('IP', event.ip || '—')}
          {row('Environment', event.env || '—')}
          {row('Correlation id', <span style={{ fontFamily: 'monospace' }}>{event.correlationId}</span>)}
        </ColumnLayout>
        {row('Path', <span style={{ fontFamily: 'monospace' }}>{event.path}</span>)}
        {event.query && row('Query', <span style={{ fontFamily: 'monospace' }}>{event.query}</span>)}
        <FormField label="Request payload (redacted)">
          <Box variant="code" padding="s" fontSize="body-s">
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{pretty(event.body)}</pre>
          </Box>
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}
