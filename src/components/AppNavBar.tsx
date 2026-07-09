import { useLocation, useNavigate } from 'react-router-dom';
import './AppNavBar.css';

export interface NavItem {
  label: string;
  /** Route to navigate to. Omit for a not-yet-built tab (rendered disabled). */
  to?: string;
}

/**
 * The per-application navigation bar (second row, below the workbench bar).
 * Route-aware: the tab whose `to` best matches the current path is active
 * (brand-blue underline). Tabs without `to` are placeholders (disabled).
 */
export default function AppNavBar({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Longest matching `to` wins so /usecases/:id keeps "Use cases" active.
  const activeTo = items
    .map((i) => i.to)
    .filter(
      (to): to is string =>
        !!to && (pathname === to || pathname.startsWith(to + '/')),
    )
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="app-nav" aria-label="Application navigation">
      {items.map((item) => {
        const active = !!item.to && item.to === activeTo;
        return (
          <button
            key={item.label}
            type="button"
            className={`app-nav-item${active ? ' app-nav-item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
            disabled={!item.to}
            title={item.to ? undefined : 'Coming soon'}
            onClick={() => item.to && navigate(item.to)}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
