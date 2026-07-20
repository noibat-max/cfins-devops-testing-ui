import type { NavItem } from '../components/AppNavBar';

/** QA Studio's second-row navigation. Tabs without `to` are not built yet. */
export const QA_STUDIO_NAV: NavItem[] = [
  { label: 'Dashboard', to: '/apps/qa-studio' },
  { label: 'Use cases', to: '/apps/qa-studio/usecases' },
  { label: 'Test Suites', to: '/apps/qa-studio/suites' },
  { label: 'Templates', to: '/apps/qa-studio/templates' },
];

export const QA_STUDIO_APP_NAME = 'QA Studio';
