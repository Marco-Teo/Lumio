import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppHeader } from './components/app-header';

export const metadata: Metadata = {
  title: 'Lumio',
  description: 'Piattaforma per la gestione di concorsi fotografici.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <a className="skip-link" href="#main-content">
          Vai al contenuto
        </a>
        <AppHeader />
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <footer className="app-footer">
          Lumio <span>·</span> Concorsi fotografici
        </footer>
      </body>
    </html>
  );
}
