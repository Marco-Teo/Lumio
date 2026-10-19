import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import { database } from '../database';
import { authenticationEnvironment } from './environment';
import { sendIdentityEmail } from './email';

function createAuthentication() {
  const env = authenticationEnvironment();
  return betterAuth({
    appName: 'Lumio',
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: prismaAdapter(database(), { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        sendIdentityEmail(user.email, 'reset', url),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        sendIdentityEmail(user.email, 'verify', url),
    },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    advanced: { useSecureCookies: env.APP_URL.startsWith('https://') },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 120,
      storage: 'memory',
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
      },
    },
    plugins: [
      twoFactor({
        issuer: 'Lumio',
        backupCodeOptions: { storeBackupCodes: 'encrypted' },
      }),
    ],
    logger: { disabled: true },
  });
}

let instance: ReturnType<typeof createAuthentication> | undefined;
export function authentication() {
  instance ??= createAuthentication();
  return instance;
}
