import { useState } from 'react';
import './AppNavBar.css';

/**
 * The per-application navigation bar (second row, directly below the workbench
 * bar). Renders the app's functionality as tabs: hover highlights, and the
 * active tab carries a brand-gold underline.
 *
 * For now the active tab is local visual state (the app's sub-screens aren't
 * built yet); once they exist these become routes.
 */
export default function AppNavBar({ items }: { items: string[] }) {
  const [active, setActive] = useState(0);

  return (
    <nav className="app-nav" aria-label="Application navigation">
      {items.map((item, i) => (
        <button
          key={item}
          type="button"
          className={`app-nav-item${i === active ? ' app-nav-item--active' : ''}`}
          aria-current={i === active ? 'page' : undefined}
          onClick={() => setActive(i)}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
