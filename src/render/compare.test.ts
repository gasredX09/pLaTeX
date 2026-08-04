import { describe, it, expect } from 'vitest';
import { compareBitmaps, CHANNEL_TOLERANCE, type Bitmap } from './compare.js';

/** Builds an opaque bitmap; `fill` receives the pixel index and returns [r,g,b]. */
function bitmap(
  width: number,
  height: number,
  fill: (i: number) => [number, number, number] = () => [255, 255, 255],
): Bitmap {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = fill(i);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

describe('compareBitmaps', () => {
  it('matches identical bitmaps', () => {
    const a = bitmap(8, 8, (i) => [i, 0, 0]);
    const b = bitmap(8, 8, (i) => [i, 0, 0]);
    expect(compareBitmaps(a, b)).toEqual({ match: true, differingPixels: 0 });
  });

  it('rejects a single differing pixel', () => {
    const a = bitmap(8, 8);
    const b = bitmap(8, 8, (i) => (i === 17 ? [0, 0, 0] : [255, 255, 255]));
    const result = compareBitmaps(a, b);
    expect(result.match).toBe(false);
    expect(result).toMatchObject({ reason: 'pixels' });
  });

  it('rejects on mismatched dimensions without comparing pixels', () => {
    const result = compareBitmaps(bitmap(8, 8), bitmap(8, 9));
    expect(result).toEqual({
      match: false,
      reason: 'dimensions',
      differingPixels: Number.POSITIVE_INFINITY,
    });
  });

  it('absorbs differences within the channel tolerance', () => {
    const a = bitmap(4, 4, () => [100, 100, 100]);
    const b = bitmap(4, 4, () => [100 + CHANNEL_TOLERANCE, 100, 100]);
    expect(compareBitmaps(a, b).match).toBe(true);
  });

  it('rejects a difference one step beyond the tolerance', () => {
    const a = bitmap(4, 4, () => [100, 100, 100]);
    const b = bitmap(4, 4, () => [100 + CHANNEL_TOLERANCE + 1, 100, 100]);
    expect(compareBitmaps(a, b).match).toBe(false);
  });

  it('detects a difference in any channel', () => {
    const a = bitmap(4, 4, () => [10, 20, 30]);
    for (const shifted of [
      [255, 20, 30],
      [10, 255, 30],
      [10, 20, 255],
    ] as [number, number, number][]) {
      expect(compareBitmaps(a, bitmap(4, 4, () => shifted)).match).toBe(false);
    }
  });

  it('ignores the alpha channel', () => {
    // Both renders sit on an opaque white page, so alpha carries no signal.
    const a = bitmap(4, 4, () => [50, 50, 50]);
    const b = bitmap(4, 4, () => [50, 50, 50]);
    (b.data as Uint8ClampedArray)[3] = 0;
    expect(compareBitmaps(a, b).match).toBe(true);
  });
});
