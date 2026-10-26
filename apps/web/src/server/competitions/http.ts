import { z } from 'zod';
import { Prisma } from '@lumio/database';
import { authentication } from '../auth';
import { AccessError } from '../authorization';
import { CompetitionError } from './index';
import { competitionFormIssues } from '../../lib/competition-errors';

export async function competitionRequest(request: Request) {
  if (
    request.method !== 'GET' &&
    request.headers.get('origin') !== new URL(process.env.APP_URL ?? '').origin
  )
    throw new AccessError(403);
  const session = await authentication().api.getSession({
    headers: request.headers,
  });
  if (!session) throw new AccessError(401);
  return session.user;
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
export function errorResponse(error: unknown, kind?: 'contest' | 'edition') {
  let status = 503,
    message = 'Servizio temporaneamente non disponibile';
  if (error instanceof AccessError || error instanceof CompetitionError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof z.ZodError) {
    status = 400;
    message = kind
      ? competitionFormIssues(error, kind)
          .map((issue) => `${issue.label}: ${issue.message}`)
          .join(' ')
      : error.issues.map((issue) => issue.message).join(' ');
  } else if (error instanceof SyntaxError) {
    status = 400;
    message = 'Controlla i dati inseriti';
  } else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    status = 409;
    message = kind
      ? 'Slug già utilizzato: scegli un identificativo diverso per questo concorso o questa edizione.'
      : 'Il dato è già presente. Ricarica la pagina prima di riprovare.';
  }
  return json({ message, requestId: crypto.randomUUID() }, status);
}
