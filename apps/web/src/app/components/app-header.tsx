'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './ui-icon';
export function AppHeader() {
  const path = usePathname();
  return (
    <header className="app-header">
      <div className="header-inner">
        <Link className="wordmark" href="/" aria-label="Lumio, home">
          Lumio
          <span className="wordmark-dot" />
        </Link>
        <nav aria-label="Navigazione principale">
          <Link
            href="/editions"
            aria-current={path.startsWith('/editions') ? 'page' : undefined}
          >
            Esplora
          </Link>
          <Link
            href="/registrations"
            aria-current={
              path.startsWith('/registrations') ? 'page' : undefined
            }
          >
            Le mie iscrizioni
          </Link>
          <Link
            className="header-account"
            aria-label="Account"
            href="/account"
            aria-current={path.startsWith('/account') ? 'page' : undefined}
          >
            <span className="avatar">
              <Icon name="user" size={17} />
            </span>
            <span>Account</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
