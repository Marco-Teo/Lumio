import { saveEdition } from '../../../../../../../../server/competitions';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../../../../../server/competitions/http';
export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ organizationId: string; contestId: string }> },
) {
  try {
    const actor = await competitionRequest(request);
    const { organizationId, contestId } = await params;
    return json(
      await saveEdition(actor, organizationId, contestId, await request.json()),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
