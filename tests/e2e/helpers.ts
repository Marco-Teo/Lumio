import { expect, type APIRequestContext } from '@playwright/test';
import { createHmac } from 'node:crypto';

export async function emailLink(
  request: APIRequestContext,
  email: string,
  kind: string,
  exclude?: string,
) {
  let link = '';
  await expect
    .poll(
      async () => {
        const search = await request.get(
          `${process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025'}/api/v1/search`,
          { params: { query: `to:${email}` } },
        );
        const data = (await search.json()) as {
          messages: Array<{ ID: string }>;
        };
        for (const item of data.messages) {
          const message = (await (
            await request.get(
              `${process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025'}/api/v1/message/${item.ID}`,
            )
          ).json()) as { Text: string };
          const found = message.Text.match(/https?:\/\/[^\s]+/g)?.find(
            (url) => url.includes(kind) && url !== exclude,
          );
          if (found) {
            link = found;
            return true;
          }
        }
        return false;
      },
      { timeout: 15000 },
    )
    .toBe(true);
  return link;
}
export function totp(uri: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const secret = new URL(uri).searchParams.get('secret') ?? '';
  const bits = [...secret.toUpperCase()]
    .map((char) => alphabet.indexOf(char).toString(2).padStart(5, '0'))
    .join('');
  const key = Buffer.from(
    (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, '0');
}
