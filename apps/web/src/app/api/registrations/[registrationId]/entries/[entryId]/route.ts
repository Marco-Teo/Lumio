import { updateEntry } from '../../../../../../server/entries';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../../../server/competitions/http';
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ registrationId: string; entryId: string }> },
) {
  try {
    const ids = await params;
    await updateEntry(
      await competitionRequest(request),
      ids.registrationId,
      ids.entryId,
      await request.json(),
    );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
