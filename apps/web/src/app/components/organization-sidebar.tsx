'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './ui-icon';
export function OrganizationSidebar({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const path = usePathname(),
    base = `/organizations/${id}`;
  return (
    <aside className="workspace-sidebar">
      <div className="organization-switch">
        <span className="scope-icon">
          <Icon name="building" />
        </span>
        <div>
          <small>Organizzazione</small>
          <strong>{name}</strong>
        </div>
      </div>
      <p className="sidebar-label">GESTIONE</p>
      <nav aria-label="Gestione organizzazione">
        <Link href={base} aria-current={path === base ? 'page' : undefined}>
          <Icon name="camera" />
          Concorsi
        </Link>
        <Link
          href={`${base}/registrations`}
          aria-current={path === `${base}/registrations` ? 'page' : undefined}
        >
          <Icon name="list" />
          Iscrizioni
        </Link>
      </nav>
      <div className="sidebar-bottom">
        <Link href="/organizations">
          <Icon name="grid" />
          Le tue organizzazioni
        </Link>
      </div>
    </aside>
  );
}
