import {
  registrationDetail,
  saveRegistrationProfile,
} from '../../../../server/participants';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../server/competitions/http';
type Context = { params: Promise<{ registrationId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    return json(
      await registrationDetail(
        await competitionRequest(request),
        (await params).registrationId,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    return json(
      await saveRegistrationProfile(
        await competitionRequest(request),
        (await params).registrationId,
        await request.json(),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
