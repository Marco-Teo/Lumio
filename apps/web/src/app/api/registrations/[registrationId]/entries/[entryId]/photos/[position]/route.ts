import {
  uploadPhoto,
  removePhoto,
  photoUploadBody,
  renamePhoto,
} from '../../../../../../../../server/entries';
import { registrationDetail } from '../../../../../../../../server/participants';
import { editionSchema } from '../../../../../../../../lib/competitions';
import { maxPhotoBytes } from '@lumio/media/storage';
import { limitedUpload } from '../../../../../../../../server/entries/upload-limit';
import { CompetitionError } from '../../../../../../../../server/competitions';
import {
  competitionRequest,
  errorResponse,
  json,
} from '../../../../../../../../server/competitions/http';
type Context = {
  params: Promise<{
    registrationId: string;
    entryId: string;
    position: string;
  }>;
};
export async function PUT(request: Request, { params }: Context) {
  try {
    const actor = await competitionRequest(request),
      ids = await params;
    const registration = await registrationDetail(actor, ids.registrationId);
    if (!registration.editable)
      throw new CompetitionError(409, 'Le iscrizioni sono chiuse.');
    const rules = editionSchema.parse(
      registration.configurationSnapshot,
    ).imageRules;
    let title: string | undefined;
    const encodedTitle = request.headers.get('x-photo-title');
    if (encodedTitle !== null) {
      try {
        title = decodeURIComponent(encodedTitle);
      } catch {
        throw new CompetitionError(
          400,
          'Il titolo della fotografia non è valido.',
        );
      }
    }
    return await limitedUpload(actor.id, async () => {
      const bytes = await photoUploadBody(
        request,
        Math.min(maxPhotoBytes, rules.maxBytes),
      );
      return json(
        await uploadPhoto(
          actor,
          ids.registrationId,
          ids.entryId,
          Number(ids.position),
          request.headers.get('x-upload-id') ?? '',
          bytes,
          title,
        ),
        202,
      );
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const ids = await params;
    await renamePhoto(
      await competitionRequest(request),
      ids.registrationId,
      ids.entryId,
      Number(ids.position),
      await request.json(),
    );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    const ids = await params;
    await removePhoto(
      await competitionRequest(request),
      ids.registrationId,
      ids.entryId,
      Number(ids.position),
    );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
