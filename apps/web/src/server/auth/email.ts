import { sendEmail } from '@lumio/jobs/mail';
import { authenticationEnvironment } from './environment';

export async function sendIdentityEmail(
  to: string,
  action: 'verify' | 'reset',
  url: string,
) {
  const env = authenticationEnvironment();
  const subject =
    action === 'verify'
      ? 'Lumio — verifica email'
      : 'Lumio — recupero password';
  const text = `${subject}\n\nApri questo collegamento per continuare:\n${url}\n\nSe non hai richiesto questa operazione, ignora il messaggio.`;
  await sendEmail(
    { to, subject, text },
    {
      transport: env.MAIL_TRANSPORT,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      from: env.EMAIL_FROM,
      region: env.AWS_REGION,
    },
  );
}
