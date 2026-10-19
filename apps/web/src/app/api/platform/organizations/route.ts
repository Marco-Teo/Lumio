import {
  platformRequest,
  errorResponse,
  json,
} from '../../../../server/platform/http';
import {
  createOrganization,
  listOrganizations,
} from '../../../../server/platform';
export async function GET(request: Request) {
  try {
    const actor = await platformRequest(request);
    const search = new URL(request.url).searchParams;
    return json(
      await listOrganizations(
        actor,
        search.get('q') ?? '',
        Number(search.get('page') ?? 1),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    return json(
      await createOrganization(
        await platformRequest(request),
        await request.json(),
      ),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
