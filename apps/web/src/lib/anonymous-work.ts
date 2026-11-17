import { z } from 'zod';

// Foundation only: no file URL, free text, internal ID or identity belongs here.
// A future authorized jury release must select/freeze the photographs first.
export const anonymousWorkSchema = z
  .object({
    code: z.uuidv4(),
    photos: z
      .array(
        z
          .object({ position: z.number().int().min(1).max(100) })
          .strict()
          .readonly(),
      )
      .max(100)
      .superRefine((photos, ctx) => {
        const positions = new Set<number>();
        photos.forEach((photo, index) => {
          if (positions.has(photo.position))
            ctx.addIssue({
              code: 'custom',
              path: [index, 'position'],
              message: 'Posizione fotografica duplicata.',
            });
          positions.add(photo.position);
        });
      })
      .readonly(),
  })
  .strict()
  .readonly();

export type AnonymousWork = z.infer<typeof anonymousWorkSchema>;
