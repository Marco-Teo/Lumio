import { z } from 'zod';
import { isAbsolute } from 'node:path';

const environmentSchema = z.object({
  APP_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:3000'),
});

export function parseEnvironment(input: Record<string, string | undefined>) {
  if (
    input.NODE_ENV === 'production' &&
    input.LUMIO_LOCAL_TEST !== '1' &&
    input.LUMIO_TEST_MODE !== '1' &&
    (!input.MEDIA_ROOT || !isAbsolute(input.MEDIA_ROOT))
  )
    throw new Error('Invalid environment configuration: MEDIA_ROOT');
  const result = environmentSchema.safeParse(input);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.'));
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }

  return result.data;
}
