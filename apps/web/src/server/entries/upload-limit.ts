import { CompetitionError } from '../competitions';
const users = new Map<
  string,
  { active: number; count: number; until: number }
>();
let active = 0;
export async function limitedUpload<T>(
  userId: string,
  action: () => Promise<T>,
) {
  const now = Date.now();
  for (const [id, value] of users)
    if (value.active === 0 && value.until <= now) users.delete(id);
  let user = users.get(userId);
  if (!user) {
    if (users.size >= 10000)
      throw new CompetitionError(429, 'Troppi caricamenti. Riprova tra poco.');
    user = { active: 0, count: 0, until: now + 60000 };
    users.set(userId, user);
  }
  if (user.until <= now) {
    user.count = 0;
    user.until = now + 60000;
  }
  if (active >= 8 || user.active >= 2 || user.count >= 30)
    throw new CompetitionError(
      429,
      'Troppi caricamenti contemporanei. Attendi qualche istante e riprova.',
    );
  active++;
  user.active++;
  user.count++;
  try {
    return await action();
  } finally {
    active--;
    user.active--;
  }
}
