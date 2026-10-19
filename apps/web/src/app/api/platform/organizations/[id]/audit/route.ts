import {
  platformRequest,
  errorResponse,
  json,
} from '../../../../../../server/platform/http';
import { organizationAudit } from '../../../../../../server/platform';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return json(
      await organizationAudit(
        await platformRequest(request),
        (await params).id,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
