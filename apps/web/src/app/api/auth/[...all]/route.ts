import { authentication } from '../../../../server/auth';

async function handle(request: Request) {
  try {
    return await authentication().handler(request);
  } catch {
    return Response.json(
      {
        code: 'AUTH_UNAVAILABLE',
        message: 'Servizio temporaneamente non disponibile',
      },
      { status: 503 },
    );
  }
}

export { handle as GET, handle as POST };
