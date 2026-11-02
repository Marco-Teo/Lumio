import Link from 'next/link';
import { closingEditions } from '../server/participants';
import {
  DiscoveryIntro,
  ParticipationSteps,
} from './components/discovery-intro';
export const dynamic = 'force-dynamic';
export default async function HomePage() {
  const editions = await closingEditions();
  return (
    <main className="discovery-page">
      <DiscoveryIntro editions={editions} now={Date.now()} />
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
