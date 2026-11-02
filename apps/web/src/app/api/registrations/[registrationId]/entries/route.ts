import { listEntries, createEntry } from '../../../../../server/entries';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../../server/competitions/http';
type Context = { params: Promise<{ registrationId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    return json({
      entries: await listEntries(
        await competitionRequest(request),
        (await params).registrationId,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    return json(
      await createEntry(
        await competitionRequest(request),
        (await params).registrationId,
        await request.json(),
      ),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
