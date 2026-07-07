import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PlaceholderScreen from '../components/PlaceholderScreen';
import { getApps } from '../lib/api';
import type { WorkbenchApp } from '../types';

/**
 * Lands here after selecting an application card. Per design the user lands on
 * the application's Dashboard; that's stubbed here (app screens are still in
 * spec mode), but it demonstrates the selected-app context + second nav bar.
 */
export default function AppScreen() {
  const { appId } = useParams();
  const [app, setApp] = useState<WorkbenchApp | null>(null);

  useEffect(() => {
    let active = true;
    getApps()
      .then((apps) => active && setApp(apps.find((a) => a.id === appId) ?? null))
      .catch(() => active && setApp(null));
    return () => {
      active = false;
    };
  }, [appId]);

  const name = app?.shortName ?? appId ?? 'Application';

  return (
    <PlaceholderScreen
      title={`${name} · Dashboard`}
      description={app?.name}
      selectedAppName={name}
      appNav={['Dashboard', 'Use cases', 'Test Suites', 'Templates']}
    />
  );
}
