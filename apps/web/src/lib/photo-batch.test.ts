import { expect, it } from 'vitest';
import { batchPositions } from './photo-batch';
it('assigns selected files to free portfolio positions without replacing existing photos', () => {
  expect(batchPositions(2, 5, [1, 3])).toEqual([2, 4]);
});
it('rejects an oversized selection before uploading any file', () => {
  expect(() => batchPositions(3, 3, [1])).toThrow(
    'Seleziona al massimo 2 file',
  );
});
it('reuses a removed slot and keeps file selection order', () => {
  expect(batchPositions(2, 4, [2, 4])).toEqual([1, 3]);
});
it('reports a full portfolio without silently discarding files', () => {
  expect(() => batchPositions(1, 2, [1, 2])).toThrow('ancora 0');
});
