import {
  myRegistrations,
  startRegistration,
} from '../../../server/participants';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../server/competitions/http';
import { z } from 'zod';
export async function GET(request: Request) {
  try {
    return json(await myRegistrations(await competitionRequest(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await competitionRequest(request);
    const data = z
      .object({
        editionId: z.uuid(),
        editionVersion: z.number().int().positive(),
        acceptRegulations: z.boolean(),
        acknowledgePrivacy: z.boolean(),
      })
      .strict()
      .parse(await request.json());
    const { editionId, ...input } = data;
    return json(await startRegistration(actor, editionId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
