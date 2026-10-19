import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z.string().min(32),
  JOB_PAYLOAD_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
  APP_URL: z.url({ protocol: /^https?$/ }),
  MAIL_TRANSPORT: z.enum(['smtp', 'ses']).default('smtp'),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  EMAIL_FROM: z.email().default('lumio@example.invalid'),
  AWS_REGION: z.literal('eu-central-1').default('eu-central-1'),
});

export function authenticationEnvironment() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success)
    throw new Error('Authentication environment is incomplete or invalid');
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.LUMIO_LOCAL_TEST !== '1'
  ) {
    if (
      !parsed.data.APP_URL.startsWith('https://') ||
      parsed.data.MAIL_TRANSPORT !== 'ses'
    ) {
      throw new Error('Production requires HTTPS and SES');
    }
  }
  if (
    parsed.data.MAIL_TRANSPORT === 'smtp' &&
    !['127.0.0.1', 'localhost', 'mailpit'].includes(parsed.data.SMTP_HOST)
  ) {
    throw new Error('SMTP is restricted to the local mail catcher');
  }
  return parsed.data;
}
