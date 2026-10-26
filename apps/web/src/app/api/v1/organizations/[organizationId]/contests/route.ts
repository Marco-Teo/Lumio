import {
  listCompetitions,
  saveContest,
} from '../../../../../../server/competitions';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../../../server/competitions/http';
type Context = { params: Promise<{ organizationId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await competitionRequest(request);
    const { organizationId } = await params;
    return json(await listCompetitions(actor, organizationId));
  } catch (error) {
    return errorResponse(error, 'contest');
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await competitionRequest(request);
    const { organizationId } = await params;
    return json(
      await saveContest(actor, organizationId, await request.json()),
      201,
    );
  } catch (error) {
    return errorResponse(error, 'contest');
  }
}
