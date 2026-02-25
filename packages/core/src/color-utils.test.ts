import { describe, expect, it } from 'vitest';
import {
  rgbToHsl,
  hslToRgb,
  rgbToHex,
  hexToRgb,
  blendColors,
  pickColor,
  pickColorAverage,
  rgbToHsb,
  hsbToRgb,
  rgbToCmyk,
  cmykToRgb,
  rgbaToHex,
  interpolateColors,
  colorDistance,
  luminance,
  contrastRatio,
  darken,
  lighten,
  saturate,
  desaturateColor,
  invertColor,
} from './color-utils';
import type { RgbaColor } from './color-utils';

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

function createTestImageData(w: number, h: number, fill?: [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  if (fill) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = fill[3];
    }
  }
  return new ImageData(data, w, h);
}

describe('color-utils', () => {
  it('converts RGB <-> HSL', () => {
    const hsl = rgbToHsl(255, 0, 0);
    expect(hsl.h).toBeCloseTo(0, 1);
    expect(hsl.s).toBeCloseTo(100, 1);
    expect(hsl.l).toBeCloseTo(50, 1);

    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    expect(rgb.r).toBeCloseTo(255, 0);
    expect(rgb.g).toBeCloseTo(0, 0);
    expect(rgb.b).toBeCloseTo(0, 0);
  });

  it('converts RGB <-> HSB', () => {
    const hsb = rgbToHsb(0, 255, 0);
    expect(hsb.h).toBeCloseTo(120, 1);
    expect(hsb.s).toBeCloseTo(100, 1);
    expect(hsb.b).toBeCloseTo(100, 1);

    const rgb = hsbToRgb(hsb.h, hsb.s, hsb.b);
    expect(rgb.r).toBeCloseTo(0, 0);
    expect(rgb.g).toBeCloseTo(255, 0);
    expect(rgb.b).toBeCloseTo(0, 0);
  });

  it('converts RGB <-> CMYK', () => {
    const cmyk = rgbToCmyk(0, 0, 0);
    expect(cmyk.k).toBe(100);

    const rgb = cmykToRgb(0, 100, 100, 0);
    expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('handles hex conversions', () => {
    expect(rgbToHex(255, 170, 0)).toBe('#ffaa00');
    expect(hexToRgb('#ffaa00')).toEqual({ r: 255, g: 170, b: 0 });
    expect(rgbaToHex(255, 170, 0, 0.5)).toBe('#ffaa0080');
  });

  it('blends and interpolates colors', () => {
    const bg: RgbaColor = { r: 0, g: 0, b: 255, a: 1 };
    const fg: RgbaColor = { r: 255, g: 0, b: 0, a: 0.5 };
    const blended = blendColors(bg, fg);
    expect(blended.a).toBe(1);
    expect(blended.r).toBeGreaterThan(0);
    expect(blended.b).toBeGreaterThan(0);

    const mid = interpolateColors(
      { r: 0, g: 0, b: 0, a: 0 },
      { r: 255, g: 255, b: 255, a: 1 },
      0.5,
    );
    expect(mid).toEqual({ r: 128, g: 128, b: 128, a: 0.5 });
  });

  it('calculates distance, luminance, and contrast', () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeGreaterThan(400);
    expect(luminance(255, 255, 255)).toBeGreaterThan(luminance(0, 0, 0));
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBe(21);
  });

  it('adjusts colors and inverts', () => {
    const base = { r: 120, g: 130, b: 140 };
    const darker = darken(base, 10);
    const lighter = lighten(base, 10);
    const saturated = saturate(base, 10);
    const desaturated = desaturateColor(base, 10);

    expect(darker.r + darker.g + darker.b).toBeLessThan(base.r + base.g + base.b);
    expect(lighter.r + lighter.g + lighter.b).toBeGreaterThan(base.r + base.g + base.b);
    expect(saturated).not.toEqual(desaturated);
    expect(invertColor({ r: 10, g: 20, b: 30 })).toEqual({ r: 245, g: 235, b: 225 });
  });

  it('samples colors from ImageData', () => {
    const image = createTestImageData(2, 2, [0, 0, 0, 255]);
    image.data.set([255, 128, 0, 255], 0);
    image.data.set([0, 255, 0, 255], 4);
    image.data.set([0, 0, 255, 255], 8);
    image.data.set([255, 255, 255, 255], 12);

    expect(pickColor(image, 0, 0)).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    const avg = pickColorAverage(image, 0, 0, 3);
    expect(avg.r).toBeGreaterThan(0);
    expect(avg.g).toBeGreaterThan(0);
    expect(avg.b).toBeGreaterThan(0);
  });
});
