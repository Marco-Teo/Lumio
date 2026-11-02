import { photoFile } from '../../../../../../server/entries';
import {
  competitionRequest,
  errorResponse,
} from '../../../../../../server/competitions/http';
export async function GET(
  request: Request,
  {
    params,
  }: { params: Promise<{ registrationId: string; revisionId: string }> },
) {
  try {
    const ids = await params,
      original = new URL(request.url).searchParams.get('original') === '1';
    const bytes = await photoFile(
      await competitionRequest(request),
      ids.registrationId,
      ids.revisionId,
      original,
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': original ? 'application/octet-stream' : 'image/webp',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        ...(original
          ? {
              'Content-Disposition': `attachment; filename="originale-${ids.revisionId}"`,
            }
          : {}),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
