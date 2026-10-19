import { ZodError } from 'zod';
import { Prisma } from '@lumio/database';
import { authentication } from '../auth';
import { AccessError } from '../authorization';
import { ProvisioningError } from './index';

export async function platformRequest(request: Request) {
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
export function errorResponse(error: unknown) {
  let status = 503;
  let message = 'Servizio temporaneamente non disponibile';
  if (error instanceof AccessError || error instanceof ProvisioningError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof ZodError || error instanceof SyntaxError) {
    status = 400;
    message = 'Controlla i dati inseriti';
  } else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    status = 409;
    message = 'Slug già utilizzato';
  }
  return Response.json(
    { message, requestId: crypto.randomUUID() },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
