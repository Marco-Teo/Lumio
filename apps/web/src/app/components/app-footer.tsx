const socialIcons = [
  {
    name: 'Instagram',
    path: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM17.5 6.5h.01',
  },
  {
    name: 'Facebook',
    path: 'M14 22V13h3l.5-4H14V7c0-1 .3-2 2-2h2V1h-3c-3 0-5 2-5 6v2H7v4h3v9',
  },
  {
    name: 'LinkedIn',
    path: 'M4 9v12M4 3v.01M10 21V9h4v2c1-3 7-3 7 2v8M14 11v10',
  },
] as const;

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <p className="footer-logo">
              Lumio<span>.</span>
            </p>
            <p>La tua fotografia, nuove possibilità.</p>
            <p>
              Uno spazio per scoprire concorsi, condividere la tua visione e
              dare valore alle immagini.
            </p>
            <ul
              className="footer-social"
              aria-label="Social — anteprima senza collegamenti"
            >
              {socialIcons.map(({ name, path }) => (
                <li key={name}>
                  <span
                    className="footer-social-icon"
                    role="img"
                    aria-label={name}
                    title={`${name} — prossimamente`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={path} />
                    </svg>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Il mondo Lumio</h2>
            <ul>
              <li>Chi siamo</li>
              <li>Lavora con noi</li>
              <li>Per gli organizzatori</li>
              <li>Partner e collaborazioni</li>
            </ul>
          </div>
          <div>
            <h2>Ti aiutiamo</h2>
            <ul>
              <li>Come partecipare</li>
              <li>Domande frequenti</li>
              <li>Centro assistenza</li>
              <li>Contattaci</li>
            </ul>
          </div>
          <div>
            <h2>Sede e contatti</h2>
            <address>
              Lumio — sede legale di esempio
              <br />
              Via Esempio 25
              <br />
              20100 Milano, Italia
            </address>
            <p>ciao@lumio.example</p>
            <p className="footer-demo">
              Anteprima grafica: dati fittizi e collegamenti non attivi.
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Lumio. Tutti i diritti riservati.</p>
          <ul aria-label="Informazioni legali — anteprima">
            <li>Privacy</li>
            <li>Cookie</li>
            <li>Termini e condizioni</li>
            <li>Accessibilità</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
