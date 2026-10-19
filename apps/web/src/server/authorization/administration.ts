import { AccessError } from './index';

export function requireAdministrativeMfa(user: {
  twoFactorEnabled?: boolean | null;
}) {
  if (!user.twoFactorEnabled)
    throw new AccessError(403, 'Attiva l’autenticazione a due fattori');
}
