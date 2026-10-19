import {
  platformRequest,
  errorResponse,
  json,
} from '../../../../../server/platform/http';
import { changeOrganizationStatus } from '../../../../../server/platform';
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return json(
      await changeOrganizationStatus(
        await platformRequest(request),
        (await params).id,
        await request.json(),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
