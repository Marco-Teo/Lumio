import { expect, it } from 'vitest';
import { limitedUpload } from './upload-limit';
import { photoUploadBody } from './index';
it('bounds streamed upload bodies without trusting Content-Length', async () => {
  const request = new Request('http://example.invalid', {
    method: 'PUT',
    body: Buffer.alloc(20),
  });
  await expect(photoUploadBody(request, 10)).rejects.toThrow(
    'dimensione massima',
  );
});
it('limits concurrent uploads per actor and releases the slot after failure', async () => {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const first = limitedUpload('synthetic-actor', () => gate),
    second = limitedUpload('synthetic-actor', () => gate);
  await expect(
    limitedUpload('synthetic-actor', async () => undefined),
  ).rejects.toThrow('Troppi caricamenti');
  finish();
  await Promise.all([first, second]);
  await expect(
    limitedUpload('synthetic-actor', async () => {
      throw new Error('failure');
    }),
  ).rejects.toThrow('failure');
  await expect(
    limitedUpload('synthetic-actor', async () => true),
  ).resolves.toBe(true);
});
