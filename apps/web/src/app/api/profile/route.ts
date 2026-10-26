import {
  participantProfile,
  saveParticipantProfile,
} from '../../../server/participants';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../server/competitions/http';
export async function GET(request: Request) {
  try {
    return json(await participantProfile(await competitionRequest(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    return json(
      await saveParticipantProfile(
        await competitionRequest(request),
        await request.json(),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
