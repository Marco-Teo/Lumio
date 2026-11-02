'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { EditionSummary } from '../../server/participants';
import { contestCoverUrl } from '../../lib/contest-cover';
import { ContestCover } from './contest-cover';

export function ClosingContests({
  editions,
  initialNow,
}: {
  editions: EditionSummary[];
  initialNow: number;
}) {
  const [now, setNow] = useState(initialNow);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const visible = editions.filter(
    (edition) => new Date(edition.closesAt).getTime() > now,
  );
  const count = visible.length;
  const current = index % Math.max(count, 1);
  const edition = visible[current];

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(motion.matches);
    update();
    motion.addEventListener('change', update);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      motion.removeEventListener('change', update);
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (count < 2 || paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((value) => (value + 1) % count);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [count, paused, hovered, focused, reducedMotion]);

  function move(delta: number) {
    setPaused(true);
    setIndex((current + delta + count) % count);
  }
  return (
    <section
      className="closing-contests"
      aria-label="Concorsi in scadenza"
      aria-roledescription={count > 1 ? 'carosello' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <p className="eyebrow">IN SCADENZA</p>
      {edition ? (
        <>
          <div
            className="closing-slide"
            onTouchStart={(event) => setTouchStart(event.touches[0].clientX)}
            onTouchEnd={(event) => {
              if (touchStart !== null && count > 1) {
                const delta = event.changedTouches[0].clientX - touchStart;
                if (Math.abs(delta) > 55) move(delta < 0 ? 1 : -1);
              }
              setTouchStart(null);
            }}
          >
            <ContestCover
              src={contestCoverUrl(edition.contestId, edition.coverVersion)}
            />
            <div
              className="closing-caption"
              aria-live={paused || reducedMotion ? 'polite' : 'off'}
            >
              <p className="badge badge-sage">Iscrizioni aperte</p>
              <h2>{edition.contestName}</h2>
              <p>
                {edition.name} · {edition.organizationName}
              </p>
              <p>
                Iscrizioni fino al{' '}
                <time dateTime={edition.closesAt}>
                  {new Date(edition.closesAt).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'Europe/Rome',
                  })}
                </time>
              </p>
              <Link
                className="button-link"
                href={`/editions/${edition.editionId}`}
              >
                Scopri il concorso <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          {count > 1 && (
            <div className="carousel-controls">
              <button
                type="button"
                aria-label="Concorso precedente"
                onClick={() => move(-1)}
              >
                ←
              </button>
              <p aria-live="polite">
                {current + 1} / {count}
              </p>
              <button
                type="button"
                aria-label="Concorso successivo"
                onClick={() => move(1)}
              >
                →
              </button>
              {!reducedMotion && (
                <button
                  type="button"
                  onClick={() => setPaused((value) => !value)}
                >
                  {paused ? 'Riprendi' : 'Pausa'}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="closing-empty">
          <h2>Il prossimo concorso ti aspetta.</h2>
          <p>
            Al momento non ci sono concorsi con iscrizioni aperte. Esplora le
            edizioni pubblicate e consulta le prossime aperture.
          </p>
          <Link className="button-link" href="/editions#concorsi">
            Vai al catalogo
          </Link>
        </div>
      )}
    </section>
  );
}
