import {
  platformRequest,
  errorResponse,
  json,
} from '../../../../../../../../server/platform/http';
import { resendInvitation } from '../../../../../../../../server/platform';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  try {
    const actor = await platformRequest(request);
    const { id, invitationId } = await params;
    return json(await resendInvitation(actor, id, invitationId));
  } catch (error) {
    return errorResponse(error);
  }
}
