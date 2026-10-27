import {
  administrativeCover,
  coverResponse,
  coverUpload,
  saveContestCover,
} from '../../../../../../../../server/competitions/cover';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../../../../../server/competitions/http';
type Context = {
  params: Promise<{ organizationId: string; contestId: string }>;
};
export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await competitionRequest(request),
      { organizationId, contestId } = await params;
    return coverResponse(
      await administrativeCover(actor, organizationId, contestId),
      request,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const actor = await competitionRequest(request),
      { organizationId, contestId } = await params;
    return json(
      await saveContestCover(
        actor,
        organizationId,
        contestId,
        await coverUpload(request),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    const actor = await competitionRequest(request),
      { organizationId, contestId } = await params;
    return json(await saveContestCover(actor, organizationId, contestId, null));
  } catch (error) {
    return errorResponse(error);
  }
}
