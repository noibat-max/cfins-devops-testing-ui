import type { ReactNode } from 'react';
import WorkbenchTopBar from './WorkbenchTopBar';
import AppNavBar, { type NavItem } from './AppNavBar';

/** Workbench top bar + per-app nav bar wrapper shared by an app's screens. */
export default function AppChrome({
  selectedAppName,
  nav,
  children,
}: {
  selectedAppName?: string;
  nav?: NavItem[];
  children: ReactNode;
}) {
  return (
    <>
      <WorkbenchTopBar selectedAppName={selectedAppName} />
      {nav && <AppNavBar items={nav} />}
      {children}
    </>
  );
}
