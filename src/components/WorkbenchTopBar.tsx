import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@cloudscape-design/components/icon';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../types';
// Inlined so the wordmark's text renders reliably (SVG text doesn't paint via <img>).
import workbenchWordmark from '../../public/branding/qa-workbench-white.svg?raw';
import './WorkbenchTopBar.css';

interface Props {
  /** When inside an application, the app name shown as context in the bar. */
  selectedAppName?: string;
}

/**
 * The workbench navigation bar (top, always present). Custom layout (not
 * Cloudscape TopNavigation) so we can render:
 *   - the company logo (crum_foster_logo.svg) full-height on a white plaque
 *   - "QA Workbench" as a separate inline SVG wordmark
 *   - environment · user menu (email-based, nav-themed) on the right
 */
export default function WorkbenchTopBar({ selectedAppName }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(user);
  // Environment isn't a user attribute — it's where this UI is deployed.
  const environment = import.meta.env.VITE_ENVIRONMENT ?? 'Local';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the user menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const goTo = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const signOff = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <header className="wb-bar">
      {/* Company logo, full height on a white plaque */}
      <button
        className="wb-plaque"
        onClick={() => navigate('/')}
        aria-label="QA Workbench home"
      >
        <img src="/branding/crum_foster_logo.svg" alt="Crum & Forster" />
      </button>

      {/* Separate QA Workbench wordmark SVG — click returns to landing */}
      <button
        className="wb-wordmark"
        onClick={() => navigate('/')}
        aria-label="QA Workbench — go to landing page"
        dangerouslySetInnerHTML={{ __html: workbenchWordmark }}
      />

      {/* Selected-application context */}
      {selectedAppName && (
        <span className="wb-context">
          <span className="wb-context-sep">|</span>
          <span>{selectedAppName}</span>
        </span>
      )}

      <span className="wb-spacer" />

      {/* Right-side utilities */}
      <div className="wb-right">
        <span className="wb-env" title={`Environment: ${environment}`}>
          <Icon name="globe" variant="inverted" />
          {environment}
        </span>

        {/* divider between region and user */}
        <span className="wb-divider" aria-hidden="true" />

        <div className="wb-usermenu" ref={menuRef}>
          <button
            className="wb-user"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Icon name="user-profile" variant="inverted" />
            <span className="wb-user-email" title={user?.email}>
              {user?.email}
            </span>
            <Icon name="angle-down" variant="inverted" />
          </button>

          {menuOpen && (
            <div className="wb-menu" role="menu">
              <div className="wb-menu-header" title={user?.email}>
                {user?.email}
              </div>
              <div className="wb-menu-divider" />
              {admin && (
                <>
                  <div className="wb-menu-section">Administration</div>
                  <button
                    className="wb-menu-item"
                    role="menuitem"
                    onClick={() => goTo('/admin/users')}
                  >
                    Users
                  </button>
                  <button
                    className="wb-menu-item"
                    role="menuitem"
                    onClick={() => goTo('/admin/audit')}
                  >
                    Audit logs
                  </button>
                  <div className="wb-menu-divider" />
                </>
              )}
              <button className="wb-menu-item" role="menuitem" onClick={signOff}>
                Sign off
              </button>
            </div>
          )}
        </div>

        {/* Quick sign-off — red power button */}
        <button
          className="wb-signoff"
          onClick={signOff}
          aria-label="Sign off"
          title="Sign off"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <line x1="12" y1="4" x2="12" y2="12" />
            <path d="M7.05 7.05a7 7 0 1 0 9.9 0" />
          </svg>
        </button>
      </div>
    </header>
  );
}
