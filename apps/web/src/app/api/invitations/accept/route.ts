import { z } from 'zod';
import { tokenHash } from '@lumio/jobs';
import { database } from '../../../../server/database';
import {
  platformRequest,
  errorResponse,
  json,
} from '../../../../server/platform/http';
import { AccessError } from '../../../../server/authorization';

export async function POST(request: Request) {
  try {
    const actor = await platformRequest(request);
    if (!actor.emailVerified) throw new AccessError(403);
    const { token } = z
      .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
      .parse(await request.json());
    const result = await database().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${actor.id}, true)`;
      return tx.$queryRaw<
        Array<{ organizationId: string }>
      >`SELECT accept_organization_invitation(${tokenHash(token)}) AS "organizationId"`;
    });
    return json(result[0]);
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      (error instanceof Error &&
        error.message.includes('INVITATION_UNAVAILABLE'))
    )
      return json(
        {
          message:
            'Invito non disponibile: verifica account, destinatario e scadenza',
        },
        400,
      );
    return errorResponse(error);
  }
}
