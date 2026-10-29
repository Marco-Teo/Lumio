import Link from 'next/link';
import {
  DiscoveryIntro,
  ParticipationSteps,
} from './components/discovery-intro';
export default function HomePage() {
  return (
    <main className="discovery-page">
      <DiscoveryIntro />
      <ParticipationSteps />
      <div className="discovery-account">
        <p>Hai già un account?</p>
        <Link className="text-action" href="/login">
          Accedi a Lumio
        </Link>
      </div>
    </main>
  );
}
