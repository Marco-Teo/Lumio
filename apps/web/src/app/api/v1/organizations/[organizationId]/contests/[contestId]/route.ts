import { saveContest } from '../../../../../../../server/competitions';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../../../../server/competitions/http';
export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ organizationId: string; contestId: string }> },
) {
  try {
    const actor = await competitionRequest(request);
    const { organizationId, contestId } = await params;
    return json(
      await saveContest(actor, organizationId, await request.json(), contestId),
    );
  } catch (error) {
    return errorResponse(error, 'contest');
  }
}
