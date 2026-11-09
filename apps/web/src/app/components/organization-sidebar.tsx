'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './ui-icon';
export function OrganizationSidebar({
  organizations,
  platformAdmin,
  onNavigate,
}: {
  organizations: Array<{ id: string; name: string }>;
  platformAdmin: boolean;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  const organization = organizations.find(
    ({ id }) =>
      path === '/organizations/' + id ||
      path.startsWith('/organizations/' + id + '/'),
  );
  const base = organization ? '/organizations/' + organization.id : '';
  return (
    <aside className="admin-navigation">
      <p className="sidebar-label">GESTIONE LUMIO</p>
      <nav aria-label="Gestione Lumio">
        <Link
          href="/"
          onClick={onNavigate}
          aria-current={path === '/' ? 'page' : undefined}
        >
          <Icon name="grid" />
          Home
        </Link>
        <Link
          href="/organizations"
          onClick={onNavigate}
          aria-current={path === '/organizations' ? 'page' : undefined}
        >
          <Icon name="building" />
          Le tue organizzazioni
        </Link>
        {platformAdmin && (
          <Link
            href="/platform"
            onClick={onNavigate}
            aria-current={path === '/platform' ? 'page' : undefined}
          >
            <Icon name="grid" />
            Console Lumio
          </Link>
        )}
      </nav>
      {organization && (
        <>
          <div className="organization-switch">
            <span className="scope-icon">
              <Icon name="building" />
            </span>
            <div>
              <small>Organizzazione</small>
              <strong>{organization.name}</strong>
            </div>
          </div>
          <nav aria-label="Gestione organizzazione">
            <Link
              href={base}
              onClick={onNavigate}
              aria-current={path === base ? 'page' : undefined}
            >
              <Icon name="camera" />
              Concorsi
            </Link>
            <Link
              href={base + '/registrations'}
              onClick={onNavigate}
              aria-current={
                path === base + '/registrations' ? 'page' : undefined
              }
            >
              <Icon name="list" />
              Iscrizioni
            </Link>
          </nav>
        </>
      )}
    </aside>
  );
}
