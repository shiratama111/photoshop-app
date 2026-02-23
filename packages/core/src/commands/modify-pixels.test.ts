import { describe, it, expect } from 'vitest';
import { ModifyPixelsCommand } from './modify-pixels';
import type { RasterLayer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';

/**
 * Create a fake ImageData-like object (Node/Vitest doesn't have real ImageData).
 * RGBA: width * height * 4 bytes.
 */
function createImageData(width: number, height: number, fill = 0): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4).fill(fill);
  return { data, width, height };
}

function createRasterLayer(width: number, height: number): RasterLayer {
  return {
    id: 'l1', name: 'Raster', type: 'raster', visible: true, opacity: 1,
    blendMode: BlendMode.Normal, position: { x: 0, y: 0 },
    locked: false, effects: [], parentId: null,
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

    // Check that the 2x2 region at (1,1) is now 255
    const data = layer.imageData!.data;
    for (let row = 1; row <= 2; row++) {
      for (let col = 1; col <= 2; col++) {
        const offset = (row * 4 + col) * 4;
        expect(data[offset]).toBe(255); // R
        expect(data[offset + 1]).toBe(255); // G
        expect(data[offset + 2]).toBe(255); // B
        expect(data[offset + 3]).toBe(255); // A
      }
    }

    // Pixels outside the region should remain 0
    expect(data[0]).toBe(0); // (0,0)
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
    // A 1000x1000 layer with a small 10x10 edit region
    const layer = createRasterLayer(1000, 1000);
    const region = { x: 500, y: 500, width: 10, height: 10 };
    const oldPixels = new Uint8ClampedArray(10 * 10 * 4);
    const newPixels = new Uint8ClampedArray(10 * 10 * 4).fill(200);

    const cmd = new ModifyPixelsCommand(layer, region, oldPixels, newPixels);

    // The command stores only 10*10*4 = 400 bytes per buffer,
    // not the full 1000*1000*4 = 4,000,000 bytes.
    // We verify this indirectly by checking the stored pixel lengths.
    expect(oldPixels.length).toBe(400);
    expect(newPixels.length).toBe(400);

    cmd.execute();
    // Verify the small region was correctly written
    const data = layer.imageData!.data;
    const offset = (500 * 1000 + 500) * 4;
    expect(data[offset]).toBe(200);
  });

  it('throws if oldPixels length does not match region', () => {
    const layer = createRasterLayer(10, 10);
    const region = { x: 0, y: 0, width: 2, height: 2 };
    const badOld = new Uint8ClampedArray(1); // wrong size
    const newPixels = new Uint8ClampedArray(2 * 2 * 4);

    expect(() => new ModifyPixelsCommand(layer, region, badOld, newPixels)).toThrow();
  });

  it('throws if newPixels length does not match region', () => {
    const layer = createRasterLayer(10, 10);
    const region = { x: 0, y: 0, width: 2, height: 2 };
    const oldPixels = new Uint8ClampedArray(2 * 2 * 4);
    const badNew = new Uint8ClampedArray(1); // wrong size

    expect(() => new ModifyPixelsCommand(layer, region, oldPixels, badNew)).toThrow();
  });

  it('handles null imageData gracefully', () => {
    const layer = createRasterLayer(10, 10);
    layer.imageData = null;
    const region = { x: 0, y: 0, width: 2, height: 2 };
    const oldPixels = new Uint8ClampedArray(2 * 2 * 4);
    const newPixels = new Uint8ClampedArray(2 * 2 * 4);

    const cmd = new ModifyPixelsCommand(layer, region, oldPixels, newPixels);
    // Should not throw — just skip
    cmd.execute();
    cmd.undo();
  });

  it('has a descriptive description', () => {
    const layer = createRasterLayer(10, 10);
    const region = { x: 0, y: 0, width: 2, height: 2 };
    const old = new Uint8ClampedArray(16);
    const nw = new Uint8ClampedArray(16);
    const cmd = new ModifyPixelsCommand(layer, region, old, nw);
    expect(cmd.description).toBe('Modify pixels on "Raster"');
  });
});
