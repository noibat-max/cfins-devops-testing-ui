import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PlaceholderScreen from '../components/PlaceholderScreen';
import { getApps } from '../lib/api';
import { QA_STUDIO_NAV } from '../config/qaStudioNav';
import type { NavItem } from '../components/AppNavBar';
import type { WorkbenchApp } from '../types';

/**
 * An application's Dashboard (landing screen inside the app). QA Studio gets its
 * real, route-aware nav (Use cases is live); other apps get placeholder tabs.
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

  const nav: NavItem[] =
    appId === 'qa-studio'
      ? QA_STUDIO_NAV
      : ['Dashboard', 'Scenarios', 'Runs', 'Results'].map((label) => ({ label }));

  return (
    <PlaceholderScreen
      title={`${name} · Dashboard`}
      description={app?.name}
      selectedAppName={name}
      appNav={nav}
    />
  );
}
