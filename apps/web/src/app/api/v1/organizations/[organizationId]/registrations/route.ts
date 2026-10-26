import { organizationRegistrations } from '../../../../../../server/participants';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../../../server/competitions/http';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    return json(
      await organizationRegistrations(
        await competitionRequest(request),
        (await params).organizationId,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
