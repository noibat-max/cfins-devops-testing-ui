import { useCallback, useEffect, useState } from 'react';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import RadioGroup from '@cloudscape-design/components/radio-group';
import Toggle from '@cloudscape-design/components/toggle';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import { useAuth } from '../../lib/auth';
import { hasScope } from '../../types';
import type { Schedule } from '../../types';
import * as api from '../../lib/api';

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '—');
const describeWhen = (s: Schedule) =>
  s.kind === 'once' ? `Once, at ${fmt(s.expression)}` : `Every ${s.expression}`;

export default function ScheduleTab({
  targetType, targetId,
}: {
  targetType: 'usecase' | 'suite'; targetId: string;
}) {
  const { user } = useAuth();
  const canWrite = hasScope(user, 'api/qawb/schedules.write');
  const [items, setItems] = useState<Schedule[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [flashes, setFlashes] = useState<FlashbarProps.MessageDefinition[]>([]);

  const flash = useCallback((type: FlashbarProps.Type, content: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const dismiss = () => setFlashes((x) => x.filter((m) => m.id !== id));
    setFlashes((f) => [...f, { id, type, content, dismissible: true, onDismiss: dismiss }]);
    if (type !== 'error') setTimeout(dismiss, 4000);
  }, []);

  const load = useCallback(() => {
    api.listSchedules(targetId).then((r) => setItems(r.schedules))
      .catch((e) => flash('error', e instanceof Error ? e.message : 'Failed to load schedules'));
  }, [targetId, flash]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (s: Schedule) => {
    try {
      await api.updateSchedule(s.scheduleId, { state: s.state === 'enabled' ? 'disabled' : 'enabled' });
      load();
    } catch (e) { flash('error', e instanceof Error ? e.message : 'Update failed'); }
  };
  const remove = async (s: Schedule) => {
    try { await api.deleteSchedule(s.scheduleId); flash('success', 'Schedule deleted'); load(); }
    catch (e) { flash('error', e instanceof Error ? e.message : 'Delete failed'); }
  };

  return (
    <SpaceBetween size="m">
      {flashes.length > 0 && <Flashbar items={flashes} />}
      <Table<Schedule>
        variant="embedded"
        items={items ?? []}
        loading={items === null}
        loadingText="Loading schedules"
        trackBy="scheduleId"
        header={
          <Header
            counter={items ? `(${items.length})` : undefined}
            description="You can enable or disable a schedule in place. To change its name, timing, or capture, delete it and create a new one."
            actions={canWrite && (
              <Button variant="link" iconName="add-plus" onClick={() => setShowCreate(true)}>
                Add
              </Button>
            )}
          >
            Schedules
          </Header>
        }
        empty={
          <Box textAlign="center" padding="l" color="text-body-secondary">
            <SpaceBetween size="s">
              <b>No schedules</b>
              {canWrite && <div><Button onClick={() => setShowCreate(true)}>New schedule</Button></div>}
            </SpaceBetween>
          </Box>
        }
        columnDefinitions={[
          { id: 'name', header: 'Name', isRowHeader: true, cell: (s) => s.label || <Box color="text-body-secondary">(unnamed)</Box> },
          { id: 'when', header: 'When', cell: describeWhen },
          { id: 'next', header: 'Next run', cell: (s) => fmt(s.nextRun) },
          { id: 'last', header: 'Last run', cell: (s) => fmt(s.lastRunAt) },
          { id: 'by', header: 'Created by', cell: (s) => s.createdBy || '—' },
          {
            id: 'sid', header: 'Schedule ID',
            cell: (s) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 12 }}>
                <span title={s.scheduleId}>{s.scheduleId.slice(0, 8)}…</span>
                <CopyToClipboard variant="icon" textToCopy={s.scheduleId}
                  copyButtonAriaLabel="Copy schedule ID" copySuccessText="Schedule ID copied" copyErrorText="Copy failed" />
              </span>
            ),
          },
          {
            id: 'state', header: 'Enabled',
            cell: (s) => (
              <Toggle checked={s.state === 'enabled'} disabled={!canWrite} onChange={() => toggle(s)}
                ariaLabel={`Toggle ${s.label || 'schedule'}`} />
            ),
          },
          {
            id: 'actions', header: '',
            cell: (s) => (canWrite ? (
              <span className="wb-danger">
                <Button variant="inline-icon" iconName="remove" ariaLabel="Delete schedule" onClick={() => remove(s)} />
              </span>
            ) : null),
          },
        ]}
      />
      {showCreate && (
        <CreateScheduleModal
          targetType={targetType} targetId={targetId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); flash('success', 'Schedule created'); load(); }}
        />
      )}
    </SpaceBetween>
  );
}

function CreateScheduleModal({
  targetType, targetId, onClose, onCreated,
}: {
  targetType: 'usecase' | 'suite'; targetId: string; onClose: () => void; onCreated: () => void;
}) {
  const [kind, setKind] = useState<'once' | 'rate'>('rate');
  const [when, setWhen] = useState('');            // datetime-local (once)
  const [rateN, setRateN] = useState('1');         // rate value
  const [rateUnit, setRateUnit] = useState('days');
  const [capture, setCapture] = useState<'screenshots' | 'full'>('screenshots');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!label.trim()) { setErr('Give the schedule a name.'); return; }
    let expression: string;
    if (kind === 'once') {
      if (!when) { setErr('Pick a date and time.'); return; }
      const d = new Date(when);
      if (isNaN(d.getTime())) { setErr('Invalid date/time.'); return; }
      expression = d.toISOString();                 // → UTC
    } else {
      const n = parseInt(rateN, 10);
      if (!n || n < 1) { setErr('Interval must be a positive number.'); return; }
      expression = `${n} ${rateUnit}`;
    }
    setBusy(true); setErr(null);
    try {
      await api.createSchedule({ targetType, targetId, kind, expression, capture, label: label.trim() || undefined });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed'); setBusy(false);
    }
  };

  return (
    <Modal
      visible onDismiss={onClose} header="New schedule"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={submit}>Create</Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {err && <Alert type="error">{err}</Alert>}
        <FormField label="Name" description="A name to recognize this schedule.">
          <Input value={label} onChange={({ detail }) => setLabel(detail.value)} placeholder="e.g. Nightly smoke" />
        </FormField>
        <FormField label="Repeat">
          <RadioGroup
            value={kind}
            onChange={({ detail }) => setKind(detail.value as 'once' | 'rate')}
            items={[
              { value: 'rate', label: 'Repeat', description: 'Run every N minutes / hours / days.' },
              { value: 'once', label: 'Run once', description: 'Run a single time at a specific date & time.' },
            ]}
          />
        </FormField>
        {kind === 'once' ? (
          <FormField label="Date & time" description="Your local time — stored and run in UTC.">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
              style={{ padding: '6px 8px', font: 'inherit' }} />
          </FormField>
        ) : (
          <FormField label="Every">
            <SpaceBetween direction="horizontal" size="xs">
              <div style={{ width: 90 }}>
                <Input type="number" value={rateN} onChange={({ detail }) => setRateN(detail.value)} />
              </div>
              <div style={{ width: 150 }}>
                <Select
                  selectedOption={{ value: rateUnit, label: rateUnit }}
                  onChange={({ detail }) => setRateUnit(detail.selectedOption.value as string)}
                  options={[{ value: 'minutes' }, { value: 'hours' }, { value: 'days' }].map((o) => ({ value: o.value, label: o.value }))}
                />
              </div>
            </SpaceBetween>
          </FormField>
        )}
        <FormField label="Logs to capture">
          <RadioGroup
            value={capture}
            onChange={({ detail }) => setCapture(detail.value as 'screenshots' | 'full')}
            items={[
              { value: 'screenshots', label: 'Snapshots', description: 'A screenshot after each step.' },
              { value: 'full', label: 'Full logs', description: 'Also HTML trace + video.' },
            ]}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}
