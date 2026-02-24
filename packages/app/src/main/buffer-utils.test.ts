import { describe, it, expect } from 'vitest';
import { bufferToArrayBuffer } from './buffer-utils';

describe('bufferToArrayBuffer', () => {
  it('returns an ArrayBuffer with the same bytes for a regular Buffer', () => {
    const source = Buffer.from([1, 2, 3, 4]);
    const result = bufferToArrayBuffer(source);
    expect(result.byteLength).toBe(4);
    expect(Array.from(new Uint8Array(result))).toEqual([1, 2, 3, 4]);
  });

  it('returns only the view range for a sliced Buffer', () => {
    const pooled = Buffer.from([10, 11, 12, 13, 14, 15, 16, 17]);
    const sliced = pooled.subarray(2, 6); // [12, 13, 14, 15]
    const result = bufferToArrayBuffer(sliced);
    expect(result.byteLength).toBe(4);
    expect(Array.from(new Uint8Array(result))).toEqual([12, 13, 14, 15]);
  });
});
