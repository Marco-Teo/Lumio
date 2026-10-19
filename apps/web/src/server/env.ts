import { z } from 'zod';

const environmentSchema = z.object({
  APP_URL: z
    .url({ protocol: /^https?$/ })
    .default('http://localhost:3000'),
});

export function parseEnvironment(input: Record<string, string | undefined>) {
  const result = environmentSchema.safeParse(input);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.'));
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }

  return result.data;
}
