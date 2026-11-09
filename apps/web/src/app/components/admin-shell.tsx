'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { OrganizationSidebar } from './organization-sidebar';
import { usePathname } from 'next/navigation';

export function AdminShell({
  organizations,
  platformAdmin,
  children,
}: {
  organizations: Array<{ id: string; name: string }>;
  platformAdmin: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (media.matches) dialog.current?.close();
    };
    media.addEventListener('change', closeOnDesktop);
    return () => {
      document.body.style.overflow = previous;
      media.removeEventListener('change', closeOnDesktop);
    };
  }, [open]);
  if (!platformAdmin && !organizations.length) return children;
  const navigation = (close?: () => void) => (
    <OrganizationSidebar
      organizations={organizations}
      platformAdmin={platformAdmin}
      onNavigate={close}
    />
  );
  return (
    <div className="admin-shell">
      <div className="admin-desktop-navigation">{navigation()}</div>
      <div className="admin-shell-content">
        <div className="admin-mobile-toolbar">
          <button
            ref={trigger}
            type="button"
            aria-expanded={open}
            aria-controls="admin-mobile-menu"
            onClick={() => {
              dialog.current?.showModal();
              setOpen(true);
            }}
          >
            ☰ Menu di gestione
          </button>
        </div>
        {children}
      </div>
      <dialog
        ref={dialog}
        id="admin-mobile-menu"
        className="admin-mobile-dialog"
        aria-label="Menu di gestione"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href]',
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <button
          type="button"
          className="admin-menu-close"
          onClick={() => dialog.current?.close()}
        >
          Chiudi menu
        </button>
        {navigation(() => dialog.current?.close())}
      </dialog>
    </div>
  );
}
