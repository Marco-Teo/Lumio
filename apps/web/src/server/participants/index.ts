import { z } from 'zod';
import { sealToken } from '@lumio/jobs';
import type { Prisma } from '@lumio/database';
import { database } from '../database';
import { AccessError } from '../authorization';
import { CompetitionError } from '../competitions';
import { requireAdministrativeMfa } from '../authorization/administration';
import { withOrganization } from '../tenancy';
import { editionSchema } from '../../lib/competitions';
import {
  emptyProfile,
  profileSchema,
  profileStatus,
  registrationOpen,
  type ParticipantProfile,
} from '../../lib/participants';

export type ParticipantActor = {
  id: string;
  email: string;
  emailVerified: boolean;
};
export type EditionSummary = {
  editionId: string;
  organizationName: string;
  contestName: string;
  name: string;
  opensAt: string;
  closesAt: string;
};
type PublishedEdition = {
  editionId: string;
  organizationId: string;
  organizationName: string;
  contestName: string;
  contactEmail: string;
  version: number;
  configuration: unknown;
};
type RegistrationSummary = {
  id: string;
  organizationId: string;
  editionId: string;
  editionName: string;
  contestName: string;
  status: string;
  updatedAt: Date;
};

async function identity<T>(
  actor: ParticipantActor,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  if (!actor.emailVerified)
    throw new AccessError(403, 'Verifica la tua email per continuare');
  return database().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id',${actor.id},true)`;
    return action(tx);
  });
}
export async function publishedEditions() {
  return database().$queryRaw<
    EditionSummary[]
  >`SELECT * FROM published_edition_catalog()`;
}
async function publishedDetail(
  tx: Prisma.TransactionClient,
  editionId: string,
) {
  const [row] = await tx.$queryRaw<
    PublishedEdition[]
  >`SELECT * FROM published_edition_detail(${editionId})`;
  if (!row) throw new AccessError(404);
  return { ...row, configuration: editionSchema.parse(row.configuration) };
}
export async function publishedEdition(editionId: string) {
  return database().$transaction((tx) => publishedDetail(tx, editionId));
}
function profileFromPerson(
  person: Record<string, unknown>,
): ParticipantProfile {
  return profileSchema.parse(
    Object.fromEntries(
      Object.keys(emptyProfile).map((key) => [key, person[key] ?? '']),
    ),
  );
}
export async function participantProfile(actor: ParticipantActor) {
  return identity(actor, async (tx) => {
    const person = await tx.person.findUniqueOrThrow({
      where: { userId: actor.id },
    });
    return {
      version: person.profileVersion,
      profile: profileFromPerson(person),
    };
  });
}
export async function saveParticipantProfile(
  actor: ParticipantActor,
  input: unknown,
) {
  const data = z
    .object({ version: z.number().int().positive(), profile: profileSchema })
    .strict()
    .parse(input);
  return identity(actor, async (tx) => {
    const result = await tx.person.updateMany({
      where: { userId: actor.id, profileVersion: data.version },
      data: { ...data.profile, profileVersion: { increment: 1 } },
    });
    if (!result.count)
      throw new CompetitionError(
        409,
        'Il profilo è cambiato. Ricarica la pagina prima di salvare.',
      );
    return { version: data.version + 1, profile: data.profile };
  });
}
export async function myRegistrations(actor: ParticipantActor) {
  return identity(
    actor,
    (tx) =>
      tx.$queryRaw<
        RegistrationSummary[]
      >`SELECT * FROM own_registration_catalog()`,
  );
}
async function ownRegistration(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<
    RegistrationSummary[]
  >`SELECT * FROM own_registration_catalog(${id})`;
  const match = rows.find((row) => row.id === id);
  if (!match) throw new AccessError(404);
  await tx.$executeRaw`SELECT set_config('app.organization_id',${match.organizationId},true)`;
  const registration = await tx.registration.findUnique({ where: { id } });
  if (!registration) throw new AccessError(404);
  return registration;
}
export async function registrationDetail(actor: ParticipantActor, id: string) {
  return identity(actor, async (tx) => {
    const registration = await ownRegistration(tx, id);
    const [row] = await tx.$queryRaw<
      Array<{ open: boolean }>
    >`SELECT registration_window_open(${registration.organizationId},${registration.editionId},${registration.editionVersion}) AS open`;
    const receipt = await tx.outboxEvent.findFirst({
      where: { registrationId: id, type: 'registration.started' },
      select: { status: true },
    });
    return {
      ...registration,
      editable: row.open,
      receiptStatus: receipt?.status ?? null,
    };
  });
}
export async function startRegistration(
  actor: ParticipantActor,
  editionId: string,
  input: unknown,
) {
  const data = z
    .object({
      editionVersion: z.number().int().positive(),
      acceptRegulations: z.literal(true),
      acknowledgePrivacy: z.literal(true),
    })
    .strict()
    .parse(input);
  return identity(actor, async (tx) => {
    const edition = await publishedDetail(tx, editionId);
    if (
      edition.version !== data.editionVersion ||
      !registrationOpen(edition.configuration)
    )
      throw new CompetitionError(
        409,
        'Le iscrizioni non sono aperte o la versione è cambiata.',
      );
    const [locked] = await tx.$queryRaw<
      Array<{ open: boolean }>
    >`SELECT lock_registration_window(${edition.organizationId},${editionId},${edition.version}) AS open`;
    if (!locked.open)
      throw new CompetitionError(409, 'Le iscrizioni non sono aperte.');
    await tx.$executeRaw`SELECT set_config('app.organization_id',${edition.organizationId},true)`;
    await tx.$queryRaw`SELECT id FROM person WHERE "userId"=${actor.id} FOR UPDATE`;
    const person = await tx.person.findUniqueOrThrow({
      where: { userId: actor.id },
    });
    const existing = await tx.registration.findUnique({
      where: { editionId_personId: { editionId, personId: person.id } },
    });
    if (existing) return existing;
    const profile = profileFromPerson(person);
    const snapshot = { ...profile, email: actor.email };
    const registration = await tx.registration.create({
      data: {
        organizationId: edition.organizationId,
        editionId,
        editionVersion: edition.version,
        personId: person.id,
        organizationName: edition.organizationName,
        contestName: edition.contestName,
        contactEmail: edition.contactEmail,
        profileSnapshot: snapshot,
        configurationSnapshot: edition.configuration,
        status: profileStatus(profile),
      },
    });
    await tx.registrationEvent.create({
      data: {
        organizationId: edition.organizationId,
        registrationId: registration.id,
        actorUserId: actor.id,
        action: 'registration.started',
        before: {},
        after: {
          status: registration.status,
          editionVersion: edition.version,
          profile: snapshot,
        },
      },
    });
    const key = process.env.JOB_PAYLOAD_KEY;
    if (!key) throw new Error('Receipt encryption configuration missing');
    await tx.outboxEvent.create({
      data: {
        organizationId: edition.organizationId,
        registrationId: registration.id,
        type: 'registration.started',
        payload: {
          encryptedReceipt: sealToken(
            JSON.stringify({
              registrationId: registration.id,
              to: actor.email,
              organizationName: edition.organizationName,
              contestName: edition.contestName,
              editionName: edition.configuration.name,
              contactEmail: edition.contactEmail,
            }),
            key,
          ),
        },
      },
    });
    return registration;
  });
}
export async function saveRegistrationProfile(
  actor: ParticipantActor,
  id: string,
  input: unknown,
) {
  const data = z
    .object({ version: z.number().int().positive(), profile: profileSchema })
    .strict()
    .parse(input);
  return identity(actor, async (tx) => {
    const registration = await ownRegistration(tx, id);
    const [locked] = await tx.$queryRaw<
      Array<{ open: boolean }>
    >`SELECT lock_registration_window(${registration.organizationId},${registration.editionId},${registration.editionVersion}) AS open`;
    if (!locked.open)
      throw new CompetitionError(
        409,
        'La modifica dell’iscrizione non è più disponibile.',
      );
    const snapshot = { ...data.profile, email: actor.email };
    const status = profileStatus(data.profile);
    const updated = await tx.registration.updateMany({
      where: { id, version: data.version },
      data: { profileSnapshot: snapshot, status, version: { increment: 1 } },
    });
    if (!updated.count)
      throw new CompetitionError(
        409,
        'L’iscrizione è cambiata. Ricarica la pagina.',
      );
    await tx.registrationEvent.create({
      data: {
        organizationId: registration.organizationId,
        registrationId: id,
        actorUserId: actor.id,
        action: 'registration.profile_updated',
        before: {
          profile: registration.profileSnapshot,
          status: registration.status,
        },
        after: { profile: snapshot, status },
      },
    });
    return tx.registration.findUniqueOrThrow({ where: { id } });
  });
}
export async function organizationRegistrations(
  actor: ParticipantActor & { twoFactorEnabled?: boolean | null },
  organizationId: string,
) {
  if (!actor.emailVerified) throw new AccessError(403);
  requireAdministrativeMfa(actor);
  return withOrganization(actor.id, organizationId, async (tx, membership) => {
    if (membership.role !== 'admin') throw new AccessError(403);
    const rows = await tx.registration.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        editionId: true,
        status: true,
        profileSnapshot: true,
        configurationSnapshot: true,
        createdAt: true,
      },
    });
    return rows.map(({ configurationSnapshot, ...row }) => ({
      ...row,
      editionName: editionSchema.parse(configurationSnapshot).name,
    }));
  });
}
