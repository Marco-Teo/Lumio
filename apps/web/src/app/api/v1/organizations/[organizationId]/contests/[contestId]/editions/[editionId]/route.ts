import {
  saveEdition,
  transitionEdition,
} from '../../../../../../../../../server/competitions';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../../../../../../server/competitions/http';
type Context = {
  params: Promise<{
    organizationId: string;
    contestId: string;
    editionId: string;
  }>;
};
export async function PUT(request: Request, { params }: Context) {
  try {
    const actor = await competitionRequest(request);
    const { organizationId, contestId, editionId } = await params;
    return json(
      await saveEdition(
        actor,
        organizationId,
        contestId,
        await request.json(),
        editionId,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await competitionRequest(request);
    const { organizationId, contestId, editionId } = await params;
    return json(
      await transitionEdition(
        actor,
        organizationId,
        contestId,
        editionId,
        await request.json(),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
