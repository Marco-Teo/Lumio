import Image from 'next/image';
import Link from 'next/link';
import { Icon } from './ui-icon';

export function DiscoveryIntro({ catalog = false }: { catalog?: boolean }) {
  return (
    <div className="discovery-intro">
      <div className="discovery-copy">
        <p className="eyebrow">LUMIO · CONCORSI FOTOGRAFICI</p>
        <h1>
          La tua fotografia,
          <br />
          il prossimo concorso.
        </h1>
        <p className="discovery-description">
          Scopri i concorsi fotografici, consulta il regolamento e partecipa con
          Lumio.
        </p>
        <div className="actions">
          <Link
            className="button-link"
            href={catalog ? '#concorsi' : '/editions'}
          >
            Esplora i concorsi <Icon name="arrow" size={18} />
          </Link>
          {!catalog && (
            <Link className="text-action" href="/register">
              Crea account
            </Link>
          )}
        </div>
      </div>
      <div className="discovery-image">
        <Image
          src="/images/tuscany-hero.webp"
          alt="Colline toscane e un viale di cipressi nella luce del mattino"
          width={1536}
          height={1024}
          sizes="(min-width: 900px) 55vw, 100vw"
        />
      </div>
    </div>
  );
}
export function ParticipationSteps() {
  return (
    <section
      className="participation-steps"
      aria-labelledby="participation-title"
    >
      <h2 id="participation-title">Come partecipare</h2>
      <p>Dalla scoperta del concorso alla tua iscrizione.</p>
      <ol>
        <li>
          <span aria-hidden="true">01</span>
          <div>
            <h3>Scegli il concorso</h3>
            <p>
              Esplora i temi, le sezioni e il regolamento dell’edizione che ti
              interessa.
            </p>
          </div>
        </li>
        <li>
          <span aria-hidden="true">02</span>
          <div>
            <h3>Completa il profilo</h3>
            <p>
              Crea il tuo account e inserisci i dati necessari per partecipare.
            </p>
          </div>
        </li>
        <li>
          <span aria-hidden="true">03</span>
          <div>
            <h3>Inizia l’iscrizione</h3>
            <p>
              Apri la tua iscrizione e segui le indicazioni dell’edizione per i
              prossimi passi.
            </p>
          </div>
        </li>
      </ol>
    </section>
  );
}
