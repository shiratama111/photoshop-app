import { describe, expect, it } from 'vitest';
import { cropImage } from './transform';
import { colorRangeSelect } from './selection-ops';

if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as Record<string, unknown>).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, maybeHeight?: number) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
        return;
      }
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = maybeHeight ?? 0;
    }
  };
}

function getPixel(imageData: ImageData, x: number, y: number): [number, number, number, number] {
  const idx = (y * imageData.width + x) * 4;
  return [
    imageData.data[idx],
    imageData.data[idx + 1],
    imageData.data[idx + 2],
    imageData.data[idx + 3],
  ];
}

describe('image ops regressions', () => {
  it('cropImage handles out-of-bounds crops safely', () => {
    const src = new Uint8ClampedArray([
      10, 20, 30, 255, 40, 50, 60, 255,
      70, 80, 90, 255, 100, 110, 120, 255,
    ]);
    const image = new ImageData(src, 2, 2);

    const cropped = cropImage(image, -1, -1, 3, 3);
    expect(cropped.width).toBe(3);
    expect(cropped.height).toBe(3);

    expect(getPixel(cropped, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(getPixel(cropped, 1, 1)).toEqual([10, 20, 30, 255]);
    expect(getPixel(cropped, 2, 2)).toEqual([100, 110, 120, 255]);
  });

  it('colorRangeSelect with fuzziness=0 selects exact color only', () => {
    const src = new Uint8ClampedArray([
      10, 20, 30, 255,
      15, 25, 35, 255,
    ]);
    const image = new ImageData(src, 2, 1);

    const mask = colorRangeSelect(image, { r: 10, g: 20, b: 30 }, 0);
    expect(getPixel(mask, 0, 0)[0]).toBe(255);
    expect(getPixel(mask, 1, 0)[0]).toBe(0);
  });
});
