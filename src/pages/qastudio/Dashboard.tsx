import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Link from '@cloudscape-design/components/link';
import Table from '@cloudscape-design/components/table';
import Badge from '@cloudscape-design/components/badge';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import AppChrome from '../../components/AppChrome';
import { QA_STUDIO_NAV, QA_STUDIO_APP_NAME } from '../../config/qaStudioNav';
import { useAuth } from '../../lib/auth';
import { hasScope } from '../../types';
import type { DashboardSummary, UpcomingSchedule } from '../../types';
import * as api from '../../lib/api';

const BASE = '/apps/qa-studio';

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** A clickable KPI tile: big number + label, optional "View all" link. */
function Stat({ label, value, hint, to }: { label: string; value: React.ReactNode; hint?: string; to?: string }) {
  const navigate = useNavigate();
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <Box fontSize="display-l" fontWeight="bold">{value}</Box>
      {hint && <Box color="text-body-secondary" fontSize="body-s">{hint}</Box>}
      {to && (
        <Link onFollow={(e) => { e.preventDefault(); navigate(to); }} href={to}>
          View all
        </Link>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/qawb/usecases.write');

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getDashboardSummary()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const c = data?.counts;
  const targetHref = (s: UpcomingSchedule) =>
    `${BASE}/${s.targetType === 'suite' ? 'suites' : 'usecases'}/${s.targetId}`;

  return (
    <AppChrome selectedAppName={QA_STUDIO_APP_NAME} nav={QA_STUDIO_NAV}>
      <Box padding={{ horizontal: 'l', top: 'l', bottom: 'xxl' }}>
        <SpaceBetween size="l">
          <Header
            variant="h1"
            description="Overview of your QA Studio use cases, suites, templates and schedules."
            actions={<Button iconName="refresh" onClick={load} ariaLabel="Refresh" loading={loading} />}
          >
            Dashboard
          </Header>

          {error && <Alert type="error" header="Could not load dashboard">{error}</Alert>}

          {!data ? (
            <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>
          ) : (
            <SpaceBetween size="l">
              {canWrite && (
                <Container header={<Header variant="h2">Quick links</Header>}>
                  <SpaceBetween direction="horizontal" size="l">
                    <Button variant="link" iconName="add-plus" onClick={() => navigate(`${BASE}/usecases`)}>New use case</Button>
                    <Button variant="link" iconName="add-plus" onClick={() => navigate(`${BASE}/suites`)}>New test suite</Button>
                    <Button variant="link" iconName="add-plus" onClick={() => navigate(`${BASE}/templates`)}>New template</Button>
                  </SpaceBetween>
                </Container>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '24px',
                }}
              >
                <Container><Stat label="Use cases" value={c!.usecases} to={`${BASE}/usecases`} /></Container>
                <Container><Stat label="Test suites" value={c!.suites} to={`${BASE}/suites`} /></Container>
                <Container><Stat label="Templates" value={c!.templates} to={`${BASE}/templates`} /></Container>
                <Container>
                  <Stat
                    label="Active schedules"
                    value={c!.schedulesEnabled}
                    hint={c!.schedules ? `of ${c!.schedules} total` : 'none scheduled'}
                  />
                </Container>
              </div>

              <Container header={<Header variant="h2" counter={`(${data.upcomingSchedules.length})`}>Upcoming schedules</Header>}>
                <Table<UpcomingSchedule>
                  variant="embedded"
                  items={data.upcomingSchedules}
                  empty={<Box textAlign="center" color="text-body-secondary" padding="m">No upcoming schedules</Box>}
                  columnDefinitions={[
                    {
                      id: 'name',
                      header: 'Name',
                      cell: (s) => (
                        <Link onFollow={(e) => { e.preventDefault(); navigate(targetHref(s)); }} href={targetHref(s)}>
                          {s.label || '(unnamed)'}
                        </Link>
                      ),
                      isRowHeader: true,
                    },
                    { id: 'target', header: 'Target', cell: (s) => <Badge>{s.targetType}</Badge> },
                    { id: 'kind', header: 'When', cell: (s) => (s.kind === 'once' ? 'Once' : 'Recurring') },
                    { id: 'next', header: 'Next run', cell: (s) => fmt(s.nextRun) },
                    { id: 'by', header: 'Created by', cell: (s) => s.createdBy ?? '—' },
                  ]}
                />
              </Container>
            </SpaceBetween>
          )}
        </SpaceBetween>
      </Box>
    </AppChrome>
  );
}
