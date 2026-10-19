import { authentication } from '../../../../../server/auth';
import { withOrganization } from '../../../../../server/tenancy';
import { AccessError } from '../../../../../server/authorization';
import { requireAdministrativeMfa } from '../../../../../server/authorization/administration';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await authentication().api.getSession({
      headers: request.headers,
    });
    if (!session) throw new AccessError(401);
    const { organizationId } = await params;
    const data = await withOrganization(
      session.user.id,
      organizationId,
      async (tx, membership) => {
        requireAdministrativeMfa(session.user);
        return {
          organization: await tx.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, name: true, slug: true },
          }),
          role: membership.role,
        };
      },
    );
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 503;
    return Response.json(
      { code: status === 503 ? 'UNAVAILABLE' : 'ACCESS_DENIED' },
      { status },
    );
  }
}
