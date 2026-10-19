import { createTransport } from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
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
  if (env.MAIL_TRANSPORT === 'smtp') {
    await createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
    }).sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text,
    });
    return;
  }
  await new SESv2Client({ region: env.AWS_REGION }).send(
    new SendEmailCommand({
      FromEmailAddress: env.EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: { Subject: { Data: subject }, Body: { Text: { Data: text } } },
      },
    }),
  );
}
