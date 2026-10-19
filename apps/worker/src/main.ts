import { createServer } from 'node:http';
import { z } from 'zod';
import { sendEmail } from '@lumio/jobs/mail';
import { startRuntime } from './runtime';

const schema = z.object({
  WORKER_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  JOB_PAYLOAD_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
  APP_URL: z.url({ protocol: /^https?$/ }),
  MAIL_TRANSPORT: z.enum(['smtp', 'ses']),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  EMAIL_FROM: z.email(),
  AWS_REGION: z.literal('eu-central-1').default('eu-central-1'),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3103),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success)
  throw new Error('Worker environment is incomplete or invalid');
const env = parsed.data;
if (
  process.env.NODE_ENV === 'production' &&
  process.env.LUMIO_LOCAL_TEST !== '1' &&
  (!env.APP_URL.startsWith('https://') || env.MAIL_TRANSPORT !== 'ses')
)
  throw new Error('Production worker requires HTTPS and SES');
const runtime = startRuntime({
  databaseUrl: env.WORKER_DATABASE_URL,
  redisUrl: env.REDIS_URL,
  encryptionKey: env.JOB_PAYLOAD_KEY,
  appUrl: env.APP_URL,
  sendEmail: (message) =>
    sendEmail(message, {
      transport: env.MAIL_TRANSPORT,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      from: env.EMAIL_FROM,
      region: env.AWS_REGION,
    }),
});
const server = createServer(async (request, response) => {
  if (request.url !== '/health') {
    response.writeHead(404).end();
    return;
  }
  try {
    await runtime.ready();
    response
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end('{"status":"ok"}');
  } catch {
    response
      .writeHead(503, { 'Content-Type': 'application/json' })
      .end('{"status":"unavailable"}');
  }
});
server.listen(env.WORKER_HEALTH_PORT, '127.0.0.1', () =>
  console.info(JSON.stringify({ event: 'worker.started' })),
);
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  await runtime.close();
}
process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
