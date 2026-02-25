import { describe, it, expect } from 'vitest';
import { ModifyPixelsCommand } from './modify-pixels';
import type { RasterLayer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';

/**
 * Create a fake ImageData-like object (Node/Vitest does not have real ImageData).
 * RGBA: width * height * 4 bytes.
 */
function createImageData(width: number, height: number, fill = 0): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4).fill(fill);
  return { data, width, height };
}

function createRasterLayer(width: number, height: number): RasterLayer {
  return {
    id: 'l1',
    name: 'Raster',
    type: 'raster',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    imageData: createImageData(width, height, 0) as unknown as ImageData,
    bounds: { x: 0, y: 0, width, height },
  };
}

describe('ModifyPixelsCommand', () => {
  it('applies new pixels to the region on execute', () => {
    const layer = createRasterLayer(4, 4);
    const region = { x: 1, y: 1, width: 2, height: 2 };
    const oldPixels = new Uint8ClampedArray(2 * 2 * 4).fill(0);
    const newPixels = new Uint8ClampedArray(2 * 2 * 4).fill(255);

    const cmd = new ModifyPixelsCommand(layer, region, oldPixels, newPixels);
    cmd.execute();

    const data = layer.imageData!.data;
    for (let row = 1; row <= 2; row++) {
      for (let col = 1; col <= 2; col++) {
        const offset = (row * 4 + col) * 4;
        expect(data[offset]).toBe(255);
        expect(data[offset + 1]).toBe(255);
        expect(data[offset + 2]).toBe(255);
        expect(data[offset + 3]).toBe(255);
      }
    }

    expect(data[0]).toBe(0);
  });

  it('restores old pixels on undo', () => {
    const layer = createRasterLayer(4, 4);
    const region = { x: 0, y: 0, width: 2, height: 2 };
    const oldPixels = new Uint8ClampedArray(2 * 2 * 4).fill(0);
    const newPixels = new Uint8ClampedArray(2 * 2 * 4).fill(128);

    const cmd = new ModifyPixelsCommand(layer, region, oldPixels, newPixels);
    cmd.execute();
    cmd.undo();

    const data = layer.imageData!.data;
    for (let i = 0; i < 2 * 2 * 4; i++) {
      expect(data[i]).toBe(0);
    }
  });

  it('only stores the changed region (memory efficiency)', () => {
    const layer = createRasterLayer(1000, 1000);
    const region = { x: 500, y: 500, width: 10, height: 10 };
    const oldPixels = new Uint8ClampedArray(10 * 10 * 4);
    const newPixels = new Uint8ClampedArray(10 * 10 * 4).fill(200);

    const cmd = new ModifyPixelsCommand(layer, region, oldPixels, newPixels);

    expect(oldPixels.length).toBe(400);
    expect(newPixels.length).toBe(400);

    cmd.execute();
    const data = layer.imageData!.data;
    const offset = (500 * 1000 + 500) * 4;
    expect(data[offset]).toBe(200);
  });

  it('throws if oldPixels length does not match region', () => {
    const layer = createRasterLayer(10, 10);
    const region = { x: 0, y: 0, width: 2, height: 2 };
    const badOld = new Uint8ClampedArray(1);
    const newPixels = new Uint8ClampedArray(2 * 2 * 4);

    expect(() => new ModifyPixelsCommand(layer, region, badOld, newPixels)).toThrow();
  });

  it('throws if newPixels length does not match region', () => {
    const layer = createRasterLayer(10, 10);
    const region = { x: 0, y: 0, width: 2, height: 2 };
    const oldPixels = new Uint8ClampedArray(2 * 2 * 4);
    const badNew = new Uint8ClampedArray(1);

    expect(() => new ModifyPixelsCommand(layer, region, oldPixels, badNew)).toThrow();
  });

  it('handles null imageData gracefully', () => {
    const layer = createRasterLayer(10, 10);
    layer.imageData = null;
    const region = { x: 0, y: 0, width: 2, height: 2 };
    const oldPixels = new Uint8ClampedArray(2 * 2 * 4);
    const newPixels = new Uint8ClampedArray(2 * 2 * 4);

    const cmd = new ModifyPixelsCommand(layer, region, oldPixels, newPixels);
    cmd.execute();
    cmd.undo();
  });

  it('has a descriptive description in Japanese', () => {
    const layer = createRasterLayer(10, 10);
    const region = { x: 0, y: 0, width: 2, height: 2 };
    const old = new Uint8ClampedArray(16);
    const nw = new Uint8ClampedArray(16);
    const cmd = new ModifyPixelsCommand(layer, region, old, nw);
    expect(cmd.description).toBe('「Raster」のピクセルを編集');
  });
});
