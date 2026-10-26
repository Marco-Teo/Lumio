import { Queue, Worker, UnrecoverableError } from 'bullmq';
import { Redis } from 'ioredis';
import { createDatabase } from '@lumio/database';
import {
  invitePayloadSchema,
  jobPayloadSchema,
  openToken,
  queueName,
  redisConnection,
  tokenHash,
  registrationReceiptSchema,
} from '@lumio/jobs';
import type { EmailMessage } from '@lumio/jobs/mail';

export type WorkerOptions = {
  databaseUrl: string;
  redisUrl: string;
  encryptionKey: string;
  appUrl: string;
  sendEmail: (message: EmailMessage) => Promise<void>;
  queue?: string;
  pollMilliseconds?: number;
};

export function startRuntime(options: WorkerOptions) {
  const db = createDatabase(options.databaseUrl);
  const producerConnection = new Redis(redisConnection(options.redisUrl));
  const consumerConnection = new Redis(redisConnection(options.redisUrl, true));
  const queue = new Queue<{ outboxId: string }, void>(
    options.queue ?? queueName,
    {
      connection: producerConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: { count: 1000 },
      },
    },
  );
  const worker = new Worker<{ outboxId: string }, void>(
    options.queue ?? queueName,
    async (job) => {
      const { outboxId } = jobPayloadSchema.parse(job.data);
      try {
        await db.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM outbox_event WHERE id=${outboxId} FOR UPDATE`;
            const event = await tx.outboxEvent.findUnique({
              where: { id: outboxId },
            });
            if (
              !event ||
              ['completed', 'cancelled', 'failed'].includes(event.status)
            )
              return;
            if (event.type === 'system.ping') {
              await tx.outboxEvent.update({
                where: { id: event.id },
                data: {
                  status: 'completed',
                  attempts: { increment: 1 },
                  lastErrorCode: null,
                },
              });
              return;
            }
            if (event.type === 'registration.started') {
              if (!event.organizationId || !event.registrationId)
                throw new UnrecoverableError('INVALID_EVENT');
              const payload = event.payload as { encryptedReceipt?: unknown };
              if (typeof payload.encryptedReceipt !== 'string')
                throw new UnrecoverableError('INVALID_PAYLOAD');
              const receipt = registrationReceiptSchema.parse(
                JSON.parse(
                  openToken(payload.encryptedReceipt, options.encryptionKey),
                ),
              );
              if (receipt.registrationId !== event.registrationId)
                throw new UnrecoverableError('INVALID_PAYLOAD');
              const link = new URL(
                `/registrations/${receipt.registrationId}`,
                options.appUrl,
              );
              await options.sendEmail({
                to: receipt.to,
                subject: 'Lumio — bozza di iscrizione ricevuta',
                text: `La tua bozza di iscrizione è stata salvata correttamente.\n\nConcorso: ${receipt.contestName}\nEdizione: ${receipt.editionName}\nOrganizzazione destinataria: ${receipt.organizationName}\nContatto organizzatore: ${receipt.contactEmail}\nRiferimento: ${receipt.registrationId}\n\nL’organizzatore può vedere la tua bozza. Non è richiesta un’approvazione dell’admin e non devi attendere una sua risposta.\n\nOra controlla e completa i dati della tua iscrizione:\n${link.toString()}\n\nQuesta email conferma il salvataggio della bozza, non l’iscrizione definitiva. Caricamento delle opere, eventuale pagamento e conferma finale non sono ancora disponibili. Non occorre effettuare pagamenti in questa fase.`,
              });
              await tx.outboxEvent.update({
                where: { id: event.id },
                data: {
                  status: 'completed',
                  attempts: { increment: 1 },
                  lastErrorCode: null,
                },
              });
              return;
            }
            if (
              event.type !== 'organization.invite' ||
              !event.organizationId ||
              !event.invitationId
            )
              throw new UnrecoverableError('INVALID_EVENT');
            await tx.$executeRaw`SELECT set_config('app.organization_id', ${event.organizationId}, true)`;
            const invitation = await tx.organizationInvitation.findUnique({
              where: { id: event.invitationId },
            });
            const organization = await tx.organization.findUnique({
              where: { id: event.organizationId },
            });
            if (
              !invitation ||
              invitation.status !== 'pending' ||
              invitation.expiresAt <= new Date() ||
              organization?.status !== 'active'
            ) {
              await tx.outboxEvent.update({
                where: { id: event.id },
                data: {
                  status: 'cancelled',
                  lastErrorCode: 'INVITATION_UNAVAILABLE',
                },
              });
              return;
            }
            const payload = invitePayloadSchema.parse(event.payload);
            const token = openToken(
              payload.encryptedToken,
              options.encryptionKey,
            );
            if (tokenHash(token) !== invitation.tokenHash)
              throw new UnrecoverableError('INVALID_PAYLOAD');
            const link = new URL('/invitations', options.appUrl);
            link.hash = `token=${token}`;
            await options.sendEmail({
              to: invitation.email,
              subject: 'Lumio — invito amministratore',
              text: `Sei stato invitato ad amministrare ${organization.name} su Lumio.\n\n${link.toString()}\n\nAccedi o crea un account con questa email e verifica il tuo indirizzo. L’invito scade dopo 72 ore. Se non attendevi questo invito, ignora il messaggio.`,
            });
            await tx.outboxEvent.update({
              where: { id: event.id },
              data: {
                status: 'completed',
                attempts: { increment: 1 },
                lastErrorCode: null,
              },
            });
          },
          { timeout: 25000 },
        );
        console.info(JSON.stringify({ event: 'job.completed', outboxId }));
      } catch (error) {
        const finalAttempt =
          error instanceof UnrecoverableError || job.attemptsMade + 1 >= 5;
        await db.outboxEvent.updateMany({
          where: {
            id: outboxId,
            status: { notIn: ['completed', 'cancelled'] },
          },
          data: {
            status: finalAttempt ? 'failed' : 'queued',
            attempts: { increment: 1 },
            lastErrorCode: 'DELIVERY_FAILED',
          },
        });
        console.warn(
          JSON.stringify({
            event: finalAttempt ? 'job.failed' : 'job.retry',
            outboxId,
          }),
        );
        // Queue errors are deliberately generic: SMTP errors can contain recipient data.
        if (finalAttempt) throw new UnrecoverableError('DELIVERY_FAILED');
        // eslint-disable-next-line preserve-caught-error -- SMTP causes may contain recipient addresses or invitation URLs persisted by BullMQ.
        throw new Error('DELIVERY_FAILED');
      }
    },
    { connection: consumerConnection, concurrency: 3 },
  );
  const lastWarning = new Map<string, number>();
  function warn(event: string) {
    if (Date.now() - (lastWarning.get(event) ?? 0) < 10000) return;
    lastWarning.set(event, Date.now());
    console.warn(JSON.stringify({ event }));
  }
  producerConnection.on('error', () => warn('redis.producer_unavailable'));
  consumerConnection.on('error', () => warn('redis.consumer_unavailable'));
  queue.on('error', () => warn('queue.unavailable'));
  worker.on('error', () => warn('worker.unavailable'));
  let busy = false;
  let closing = false;
  async function dispatchOnce() {
    if (busy || closing) return;
    busy = true;
    try {
      const events = await db.outboxEvent.findMany({
        where: {
          OR: [
            { status: 'pending' },
            {
              status: 'queued',
              updatedAt: { lt: new Date(Date.now() - 30000) },
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (const event of events) {
        let existing = await queue.getJob(event.id);
        if (
          existing &&
          event.status === 'pending' &&
          ['failed', 'completed'].includes(await existing.getState())
        ) {
          await existing.remove();
          existing = undefined;
        }
        if (!existing)
          await queue.add(
            event.type,
            { outboxId: event.id },
            { jobId: event.id },
          );
        await db.outboxEvent.updateMany({
          where: { id: event.id, status: { in: ['pending', 'queued'] } },
          data: { status: 'queued' },
        });
      }
    } catch {
      warn('outbox.dispatch_deferred');
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(() => {
    void dispatchOnce();
  }, options.pollMilliseconds ?? 1000);
  void dispatchOnce();
  return {
    queue,
    worker,
    dispatchOnce,
    async ready() {
      await db.$queryRaw`SELECT 1`;
      await queue.getJobCounts('waiting');
    },
    async close() {
      closing = true;
      clearInterval(timer);
      await worker.close();
      // Wait for the bounded producer loop before closing its connections.
      while (busy) await new Promise((resolve) => setTimeout(resolve, 20));
      await queue.close();
      producerConnection.disconnect();
      consumerConnection.disconnect();
      await db.$disconnect();
    },
  };
}
