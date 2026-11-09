import { expect, it } from 'vitest';
import {
  maxPhotoBytes,
  effectivePhotoBytes,
  photoSizeLabel,
  photoMiBValue,
  photoBytesFromMiB,
} from './limits';
it.each([
  [5_000_000, '4.76837158203125 MiB'],
  [maxPhotoBytes, '25 MiB'],
  [maxPhotoBytes + 1, '25 MiB'],
  [1, '0.00000095367431640625 MiB'],
  [4_999_999, '4.76837062835693359375 MiB'],
])(
  'formats the effective %i byte limit without rounding up',
  (configured, expected) => {
    expect(photoSizeLabel(effectivePhotoBytes(configured))).toBe(expected);
  },
);
it.each([1, 4_999_999, 5_000_000, 13_107_200, maxPhotoBytes, 1_000_000_000])(
  'round-trips %i bytes exactly, including historical limits',
  (bytes) => {
    expect(photoBytesFromMiB(photoMiBValue(bytes))).toBe(bytes);
  },
);
it.each(['25', '25.000', '25,000', ' 25 '])(
  'accepts exact input %s',
  (input) => {
    expect(photoBytesFromMiB(input)).toBe(maxPhotoBytes);
  },
);
it.each(['0.1', '25.0000001', '', 'NaN', '1e2', '-1', '1,2.3'])(
  'rejects invalid input or fractions of a byte: %s',
  (input) => expect(photoBytesFromMiB(input)).toBeNull(),
);
