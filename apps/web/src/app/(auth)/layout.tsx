import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthenticationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main>
      <Link href="/">Lumio</Link>
      {children}
      <nav aria-label="Account">
        <Link href="/login">Accedi</Link> ·{' '}
        <Link href="/register">Registrati</Link> ·{' '}
        <Link href="/forgot-password">Password dimenticata</Link>
      </nav>
    </main>
  );
}
