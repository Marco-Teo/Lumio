import { createTransport } from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

export type EmailMessage = { to: string; subject: string; text: string };
export type MailConfiguration = {
  transport: 'smtp' | 'ses';
  host: string;
  port: number;
  from: string;
  region: string;
};
export async function sendEmail(
  message: EmailMessage,
  config: MailConfiguration,
) {
  if (config.transport === 'smtp') {
    if (!['127.0.0.1', 'localhost', 'mailpit'].includes(config.host))
      throw new Error('SMTP is restricted to the local mail catcher');
    await createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    }).sendMail({ from: config.from, ...message });
    return;
  }
  await new SESv2Client({ region: config.region }).send(
    new SendEmailCommand({
      FromEmailAddress: config.from,
      Destination: { ToAddresses: [message.to] },
      Content: {
        Simple: {
          Subject: { Data: message.subject },
          Body: { Text: { Data: message.text } },
        },
      },
    }),
  );
}
