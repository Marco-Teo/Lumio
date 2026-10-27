import { authentication } from '../../../../../server/auth';
import {
  visibleCover,
  coverResponse,
} from '../../../../../server/competitions/cover';
import { errorResponse } from '../../../../../server/competitions/http';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ contestId: string }> },
) {
  try {
    const session = await authentication().api.getSession({
      headers: request.headers,
    });
    return coverResponse(
      await visibleCover((await params).contestId, session?.user.id),
      request,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
