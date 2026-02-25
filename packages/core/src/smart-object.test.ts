/**
 * @module smart-object.test
 * Comprehensive tests for the smart object layer implementation.
 *
 * Covers:
 * - Conversion roundtrip (raster -> smart -> raster)
 * - Non-destructive resize (50% -> 200% -> 100% = original quality)
 * - Bilinear resampling dimension correctness
 * - Undo/redo for all 3 commands
 * - Edge cases (null imageData, invalid inputs)
 *
 * @see SMART-001 ticket for acceptance criteria
 */

import { describe, it, expect } from 'vitest';
import type { RasterLayer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import type { SmartObjectLayer } from './smart-object';
import {
  resampleSmartObject,
  convertToSmartObject,
  rasterizeSmartObject,
} from './smart-object';
import { createSmartObjectLayer } from './layer-factory';
import {
  ConvertToSmartObjectCommand,
  TransformSmartObjectCommand,
  RasterizeSmartObjectCommand,
} from './commands/smart-object-commands';
import type { LayerHolder } from './commands/smart-object-commands';
import { CommandHistoryImpl } from './command-history';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Create a fake ImageData-like object (Node/Vitest does not have real ImageData).
 */
function createImageData(
  width: number,
  height: number,
  fill = 0,
): { data: Uint8ClampedArray; width: number; height: number; colorSpace: string } {
  const data = new Uint8ClampedArray(width * height * 4).fill(fill);
  return { data, width, height, colorSpace: 'srgb' };
}

/**
 * Create a raster layer with specified dimensions and optional pixel fill value.
 */
function makeRasterLayer(width: number, height: number, fill = 0): RasterLayer {
  return {
    id: 'raster-test',
    name: 'Test Raster',
    type: 'raster',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 10, y: 20 },
    locked: false,
    effects: [],
    parentId: null,
    imageData: createImageData(width, height, fill) as unknown as ImageData,
    bounds: { x: 0, y: 0, width, height },
  };
}

/**
 * Create a raster layer with a known gradient pattern for quality tests.
 * Each pixel's RGBA = (x % 256, y % 256, (x + y) % 256, 255).
 */
function makeGradientRasterLayer(width: number, height: number): RasterLayer {
  const imgData = createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      imgData.data[idx] = x % 256;
      imgData.data[idx + 1] = y % 256;
      imgData.data[idx + 2] = (x + y) % 256;
      imgData.data[idx + 3] = 255;
    }
  }
  return {
    id: 'raster-gradient',
    name: 'Gradient Raster',
    type: 'raster',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    imageData: imgData as unknown as ImageData,
    bounds: { x: 0, y: 0, width, height },
  };
}

// ---------------------------------------------------------------------------
// convertToSmartObject
// ---------------------------------------------------------------------------

describe('convertToSmartObject', () => {
  it('copies pixel data from raster layer to sourceData', () => {
    const raster = makeRasterLayer(4, 4, 128);
    const smart = convertToSmartObject(raster);

    expect(smart.type).toBe('smart-object');
    expect(smart.sourceWidth).toBe(4);
    expect(smart.sourceHeight).toBe(4);
    expect(smart.sourceData.length).toBe(4 * 4 * 4);
    // All bytes should be 128
    for (let i = 0; i < smart.sourceData.length; i++) {
      expect(smart.sourceData[i]).toBe(128);
    }
  });

  it('preserves layer metadata (name, opacity, position, visibility)', () => {
    const raster = makeRasterLayer(2, 2);
    raster.name = 'Custom Name';
    raster.opacity = 0.5;
    raster.visible = false;
    raster.position = { x: 42, y: 99 };

    const smart = convertToSmartObject(raster);

    expect(smart.name).toBe('Custom Name');
    expect(smart.opacity).toBe(0.5);
    expect(smart.visible).toBe(false);
    expect(smart.position).toEqual({ x: 42, y: 99 });
  });

  it('creates an independent copy of sourceData (not a reference)', () => {
    const raster = makeRasterLayer(2, 2, 100);
    const smart = convertToSmartObject(raster);

    // Mutate original raster data
    raster.imageData!.data[0] = 0;

    // Smart object's sourceData should be unchanged
    expect(smart.sourceData[0]).toBe(100);
  });

  it('sets identity transform on newly created smart object', () => {
    const raster = makeRasterLayer(2, 2);
    const smart = convertToSmartObject(raster);

    expect(smart.transform).toEqual({ scaleX: 1, scaleY: 1, rotation: 0 });
  });

  it('sets displayData to null (cache not computed yet)', () => {
    const raster = makeRasterLayer(2, 2);
    const smart = convertToSmartObject(raster);

    expect(smart.displayData).toBeNull();
  });

  it('throws if raster layer has null imageData', () => {
    const raster = makeRasterLayer(2, 2);
    raster.imageData = null;

    expect(() => convertToSmartObject(raster)).toThrow('null imageData');
  });

  it('assigns a new unique id to the smart object', () => {
    const raster = makeRasterLayer(2, 2);
    const smart = convertToSmartObject(raster);

    expect(smart.id).toBeDefined();
    expect(smart.id).not.toBe(raster.id);
  });
});

// ---------------------------------------------------------------------------
// resampleSmartObject
// ---------------------------------------------------------------------------

describe('resampleSmartObject', () => {
  it('produces output with correct dimensions at identity transform', () => {
    const raster = makeRasterLayer(10, 8, 200);
    const smart = convertToSmartObject(raster);

    const display = resampleSmartObject(smart);

    expect(display.width).toBe(10);
    expect(display.height).toBe(8);
  });

  it('produces output at 50% scale with half dimensions', () => {
    const raster = makeRasterLayer(10, 8, 200);
    const smart = convertToSmartObject(raster);
    smart.transform = { scaleX: 0.5, scaleY: 0.5, rotation: 0 };

    const display = resampleSmartObject(smart);

    expect(display.width).toBe(5);
    expect(display.height).toBe(4);
  });

  it('produces output at 200% scale with double dimensions', () => {
    const raster = makeRasterLayer(10, 8, 200);
    const smart = convertToSmartObject(raster);
    smart.transform = { scaleX: 2, scaleY: 2, rotation: 0 };

    const display = resampleSmartObject(smart);

    expect(display.width).toBe(20);
    expect(display.height).toBe(16);
  });

  it('supports non-uniform scaling', () => {
    const raster = makeRasterLayer(10, 10, 200);
    const smart = convertToSmartObject(raster);
    smart.transform = { scaleX: 3, scaleY: 0.5, rotation: 0 };

    const display = resampleSmartObject(smart);

    expect(display.width).toBe(30);
    expect(display.height).toBe(5);
  });

  it('preserves pixel values at identity transform for solid color', () => {
    const raster = makeRasterLayer(4, 4, 128);
    const smart = convertToSmartObject(raster);

    const display = resampleSmartObject(smart);

    // All pixels should be approximately 128 (bilinear of uniform = exact)
    for (let i = 0; i < display.data.length; i++) {
      expect(display.data[i]).toBe(128);
    }
  });

  it('clamps output dimensions to at least 1x1', () => {
    const raster = makeRasterLayer(4, 4, 128);
    const smart = convertToSmartObject(raster);
    smart.transform = { scaleX: 0.001, scaleY: 0.001, rotation: 0 };

    const display = resampleSmartObject(smart);

    expect(display.width).toBeGreaterThanOrEqual(1);
    expect(display.height).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Non-destructive resize: 50% -> 200% -> 100% = original quality
// ---------------------------------------------------------------------------

describe('non-destructive resize', () => {
  it('50% -> 200% -> 100% produces identical output to never-scaled version', () => {
    const raster = makeGradientRasterLayer(8, 8);
    const smart = convertToSmartObject(raster);

    // Resample at identity (100%) — this is our reference
    const reference = resampleSmartObject(smart);

    // Scale down to 50%
    smart.transform = { scaleX: 0.5, scaleY: 0.5, rotation: 0 };
    resampleSmartObject(smart); // intermediate — we don't use this

    // Scale up to 200% (relative to original = back to 100%)
    smart.transform = { scaleX: 1, scaleY: 1, rotation: 0 };
    const restored = resampleSmartObject(smart);

    // Since we always resample from sourceData, the result should be identical
    expect(restored.width).toBe(reference.width);
    expect(restored.height).toBe(reference.height);
    expect(restored.data.length).toBe(reference.data.length);

    for (let i = 0; i < reference.data.length; i++) {
      expect(restored.data[i]).toBe(reference.data[i]);
    }
  });

  it('sourceData is never modified by transform changes', () => {
    const raster = makeRasterLayer(4, 4, 200);
    const smart = convertToSmartObject(raster);
    const originalSourceCopy = new Uint8Array(smart.sourceData);

    // Apply various transforms
    smart.transform = { scaleX: 0.25, scaleY: 0.25, rotation: 0 };
    resampleSmartObject(smart);

    smart.transform = { scaleX: 4, scaleY: 4, rotation: 0 };
    resampleSmartObject(smart);

    smart.transform = { scaleX: 1, scaleY: 1, rotation: 0 };
    resampleSmartObject(smart);

    // sourceData should be unchanged
    expect(smart.sourceData.length).toBe(originalSourceCopy.length);
    for (let i = 0; i < originalSourceCopy.length; i++) {
      expect(smart.sourceData[i]).toBe(originalSourceCopy[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// rasterizeSmartObject
// ---------------------------------------------------------------------------

describe('rasterizeSmartObject', () => {
  it('produces a raster layer with type "raster"', () => {
    const raster = makeRasterLayer(4, 4, 128);
    const smart = convertToSmartObject(raster);
    const result = rasterizeSmartObject(smart);

    expect(result.type).toBe('raster');
  });

  it('rasterized layer has imageData matching current transform dimensions', () => {
    const raster = makeRasterLayer(10, 10, 128);
    const smart = convertToSmartObject(raster);
    smart.transform = { scaleX: 2, scaleY: 0.5, rotation: 0 };

    const result = rasterizeSmartObject(smart);

    expect(result.imageData).not.toBeNull();
    expect(result.imageData!.width).toBe(20);
    expect(result.imageData!.height).toBe(5);
  });

  it('preserves layer metadata on rasterization', () => {
    const raster = makeRasterLayer(4, 4, 128);
    raster.name = 'My Layer';
    raster.opacity = 0.7;

    const smart = convertToSmartObject(raster);
    const result = rasterizeSmartObject(smart);

    expect(result.name).toBe('My Layer');
    expect(result.opacity).toBe(0.7);
  });

  it('assigns a new id different from the smart object', () => {
    const raster = makeRasterLayer(4, 4, 128);
    const smart = convertToSmartObject(raster);
    const result = rasterizeSmartObject(smart);

    expect(result.id).not.toBe(smart.id);
  });
});

// ---------------------------------------------------------------------------
// Conversion roundtrip: raster -> smart -> raster preserves data
// ---------------------------------------------------------------------------

describe('conversion roundtrip', () => {
  it('raster -> smart -> raster preserves pixel data at identity scale', () => {
    const original = makeGradientRasterLayer(6, 6);
    const originalData = new Uint8ClampedArray(original.imageData!.data);

    const smart = convertToSmartObject(original);
    const rasterized = rasterizeSmartObject(smart);

    expect(rasterized.imageData).not.toBeNull();
    expect(rasterized.imageData!.width).toBe(6);
    expect(rasterized.imageData!.height).toBe(6);

    // Pixel data should match the original
    for (let i = 0; i < originalData.length; i++) {
      expect(rasterized.imageData!.data[i]).toBe(originalData[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// createSmartObjectLayer factory
// ---------------------------------------------------------------------------

describe('createSmartObjectLayer', () => {
  it('creates a smart object with the given source data', () => {
    const data = new Uint8Array(4 * 4 * 4).fill(100);
    const layer = createSmartObjectLayer('Test', data, 4, 4);

    expect(layer.type).toBe('smart-object');
    expect(layer.name).toBe('Test');
    expect(layer.sourceWidth).toBe(4);
    expect(layer.sourceHeight).toBe(4);
    expect(layer.sourceData.length).toBe(64);
    expect(layer.transform).toEqual({ scaleX: 1, scaleY: 1, rotation: 0 });
    expect(layer.displayData).toBeNull();
  });

  it('creates an independent copy of the source data', () => {
    const data = new Uint8Array(2 * 2 * 4).fill(50);
    const layer = createSmartObjectLayer('Copy Test', data, 2, 2);

    data[0] = 0;
    expect(layer.sourceData[0]).toBe(50);
  });

  it('throws if sourceData length does not match dimensions', () => {
    const badData = new Uint8Array(10);
    expect(() => createSmartObjectLayer('Bad', badData, 4, 4)).toThrow('does not match');
  });

  it('assigns a unique id', () => {
    const data = new Uint8Array(2 * 2 * 4);
    const a = createSmartObjectLayer('A', data, 2, 2);
    const b = createSmartObjectLayer('B', data, 2, 2);

    expect(a.id).not.toBe(b.id);
  });

  it('sets default properties (visible, opacity, blendMode)', () => {
    const data = new Uint8Array(2 * 2 * 4);
    const layer = createSmartObjectLayer('Defaults', data, 2, 2);

    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(1);
    expect(layer.blendMode).toBe(BlendMode.Normal);
    expect(layer.locked).toBe(false);
    expect(layer.parentId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ConvertToSmartObjectCommand
// ---------------------------------------------------------------------------

describe('ConvertToSmartObjectCommand', () => {
  it('converts a raster layer to smart object on execute', () => {
    const raster = makeRasterLayer(4, 4, 128);
    const holder: LayerHolder = { layer: raster };

    const cmd = new ConvertToSmartObjectCommand(holder);
    cmd.execute();

    expect(holder.layer.type).toBe('smart-object');
    const smart = holder.layer as SmartObjectLayer;
    expect(smart.sourceWidth).toBe(4);
    expect(smart.sourceHeight).toBe(4);
  });

  it('restores the raster layer on undo', () => {
    const raster = makeRasterLayer(4, 4, 128);
    const holder: LayerHolder = { layer: raster };

    const cmd = new ConvertToSmartObjectCommand(holder);
    cmd.execute();
    cmd.undo();

    expect(holder.layer.type).toBe('raster');
    expect(holder.layer).toBe(raster);
  });

  it('re-execute after undo returns the same smart object', () => {
    const raster = makeRasterLayer(4, 4, 128);
    const holder: LayerHolder = { layer: raster };

    const cmd = new ConvertToSmartObjectCommand(holder);
    cmd.execute();
    const firstSmart = holder.layer;
    cmd.undo();
    cmd.execute();

    expect(holder.layer).toBe(firstSmart);
  });

  it('throws if holder does not contain a raster layer', () => {
    const data = new Uint8Array(2 * 2 * 4);
    const smart = createSmartObjectLayer('NotRaster', data, 2, 2);
    const holder: LayerHolder = { layer: smart };

    expect(() => new ConvertToSmartObjectCommand(holder)).toThrow('raster layer');
  });

  it('has a descriptive description', () => {
    const raster = makeRasterLayer(4, 4);
    raster.name = 'テストレイヤー';
    const holder: LayerHolder = { layer: raster };

    const cmd = new ConvertToSmartObjectCommand(holder);
    expect(cmd.description).toBe(`Convert "${raster.name}" to smart object`);
  });
});

// ---------------------------------------------------------------------------
// TransformSmartObjectCommand
// ---------------------------------------------------------------------------

describe('TransformSmartObjectCommand', () => {
  function makeSmartHolder(): LayerHolder {
    const raster = makeRasterLayer(10, 10, 128);
    const holder: LayerHolder = { layer: raster };
    const convertCmd = new ConvertToSmartObjectCommand(holder);
    convertCmd.execute();
    return holder;
  }

  it('applies the new transform on execute', () => {
    const holder = makeSmartHolder();
    const cmd = new TransformSmartObjectCommand(holder, {
      scaleX: 0.5,
      scaleY: 0.5,
      rotation: 45,
    });
    cmd.execute();

    const smart = holder.layer as SmartObjectLayer;
    expect(smart.transform.scaleX).toBe(0.5);
    expect(smart.transform.scaleY).toBe(0.5);
    expect(smart.transform.rotation).toBe(45);
  });

  it('updates displayData on execute', () => {
    const holder = makeSmartHolder();
    const cmd = new TransformSmartObjectCommand(holder, {
      scaleX: 2,
      scaleY: 2,
      rotation: 0,
    });
    cmd.execute();

    const smart = holder.layer as SmartObjectLayer;
    expect(smart.displayData).not.toBeNull();
    expect(smart.displayData!.width).toBe(20);
    expect(smart.displayData!.height).toBe(20);
  });

  it('restores the previous transform on undo', () => {
    const holder = makeSmartHolder();
    const smart = holder.layer as SmartObjectLayer;
    // Record original transform
    const originalTransform = { ...smart.transform };

    const cmd = new TransformSmartObjectCommand(holder, {
      scaleX: 3,
      scaleY: 3,
      rotation: 90,
    });
    cmd.execute();
    cmd.undo();

    expect(smart.transform).toEqual(originalTransform);
  });

  it('updates displayData on undo to match restored transform', () => {
    const holder = makeSmartHolder();
    const cmd = new TransformSmartObjectCommand(holder, {
      scaleX: 2,
      scaleY: 2,
      rotation: 0,
    });
    cmd.execute();
    cmd.undo();

    const smart = holder.layer as SmartObjectLayer;
    expect(smart.displayData).not.toBeNull();
    // Original transform is 1x1, so display should be 10x10
    expect(smart.displayData!.width).toBe(10);
    expect(smart.displayData!.height).toBe(10);
  });

  it('throws if holder does not contain a smart object', () => {
    const raster = makeRasterLayer(4, 4);
    const holder: LayerHolder = { layer: raster };

    expect(
      () => new TransformSmartObjectCommand(holder, { scaleX: 1, scaleY: 1, rotation: 0 }),
    ).toThrow('smart object layer');
  });

  it('has a descriptive description', () => {
    const holder = makeSmartHolder();
    const cmd = new TransformSmartObjectCommand(holder, {
      scaleX: 2,
      scaleY: 2,
      rotation: 0,
    });
    expect(cmd.description).toContain('Transform smart object');
  });
});

// ---------------------------------------------------------------------------
// RasterizeSmartObjectCommand
// ---------------------------------------------------------------------------

describe('RasterizeSmartObjectCommand', () => {
  function makeSmartHolder(): LayerHolder {
    const raster = makeRasterLayer(8, 8, 200);
    const holder: LayerHolder = { layer: raster };
    const convertCmd = new ConvertToSmartObjectCommand(holder);
    convertCmd.execute();
    return holder;
  }

  it('converts smart object to raster on execute', () => {
    const holder = makeSmartHolder();

    const cmd = new RasterizeSmartObjectCommand(holder);
    cmd.execute();

    expect(holder.layer.type).toBe('raster');
    const raster = holder.layer as RasterLayer;
    expect(raster.imageData).not.toBeNull();
    expect(raster.imageData!.width).toBe(8);
    expect(raster.imageData!.height).toBe(8);
  });

  it('restores the smart object on undo', () => {
    const holder = makeSmartHolder();
    const originalSmart = holder.layer;

    const cmd = new RasterizeSmartObjectCommand(holder);
    cmd.execute();
    cmd.undo();

    expect(holder.layer.type).toBe('smart-object');
    expect(holder.layer).toBe(originalSmart);
  });

  it('rasterizes at the current transform dimensions', () => {
    const holder = makeSmartHolder();
    const transformCmd = new TransformSmartObjectCommand(holder, {
      scaleX: 2,
      scaleY: 0.5,
      rotation: 0,
    });
    transformCmd.execute();

    const cmd = new RasterizeSmartObjectCommand(holder);
    cmd.execute();

    const raster = holder.layer as RasterLayer;
    expect(raster.imageData!.width).toBe(16);
    expect(raster.imageData!.height).toBe(4);
  });

  it('throws if holder does not contain a smart object', () => {
    const raster = makeRasterLayer(4, 4);
    const holder: LayerHolder = { layer: raster };

    expect(() => new RasterizeSmartObjectCommand(holder)).toThrow('smart object layer');
  });

  it('has a descriptive description', () => {
    const holder = makeSmartHolder();
    const cmd = new RasterizeSmartObjectCommand(holder);
    expect(cmd.description).toContain('Rasterize smart object');
  });
});

// ---------------------------------------------------------------------------
// Undo/Redo integration with CommandHistoryImpl
// ---------------------------------------------------------------------------

describe('undo/redo integration with CommandHistoryImpl', () => {
  it('full workflow: convert -> transform -> rasterize -> undo all -> redo all', () => {
    const history = new CommandHistoryImpl();
    const raster = makeRasterLayer(6, 6, 150);
    const holder: LayerHolder = { layer: raster };

    // Step 1: Convert to smart object
    const convertCmd = new ConvertToSmartObjectCommand(holder);
    history.execute(convertCmd);
    expect(holder.layer.type).toBe('smart-object');

    // Step 2: Transform (scale 50%)
    const transformCmd = new TransformSmartObjectCommand(holder, {
      scaleX: 0.5,
      scaleY: 0.5,
      rotation: 0,
    });
    history.execute(transformCmd);
    const smart = holder.layer as SmartObjectLayer;
    expect(smart.transform.scaleX).toBe(0.5);
    expect(smart.displayData).not.toBeNull();
    expect(smart.displayData!.width).toBe(3);

    // Step 3: Rasterize
    const rasterizeCmd = new RasterizeSmartObjectCommand(holder);
    history.execute(rasterizeCmd);
    expect(holder.layer.type).toBe('raster');
    expect((holder.layer as RasterLayer).imageData!.width).toBe(3);

    // Undo rasterize -> back to smart object at 50%
    history.undo();
    expect(holder.layer.type).toBe('smart-object');
    expect((holder.layer as SmartObjectLayer).transform.scaleX).toBe(0.5);

    // Undo transform -> back to smart object at 100%
    history.undo();
    expect(holder.layer.type).toBe('smart-object');
    expect((holder.layer as SmartObjectLayer).transform.scaleX).toBe(1);

    // Undo convert -> back to raster
    history.undo();
    expect(holder.layer.type).toBe('raster');
    expect(holder.layer).toBe(raster);

    // Redo all
    history.redo(); // convert
    expect(holder.layer.type).toBe('smart-object');

    history.redo(); // transform
    expect((holder.layer as SmartObjectLayer).transform.scaleX).toBe(0.5);

    history.redo(); // rasterize
    expect(holder.layer.type).toBe('raster');
    expect((holder.layer as RasterLayer).imageData!.width).toBe(3);
  });

  it('multiple transforms with undo/redo produce correct states', () => {
    const history = new CommandHistoryImpl();
    const raster = makeRasterLayer(10, 10, 128);
    const holder: LayerHolder = { layer: raster };

    history.execute(new ConvertToSmartObjectCommand(holder));

    // Transform #1: scale 50%
    history.execute(
      new TransformSmartObjectCommand(holder, { scaleX: 0.5, scaleY: 0.5, rotation: 0 }),
    );
    expect((holder.layer as SmartObjectLayer).displayData!.width).toBe(5);

    // Transform #2: scale 200%
    history.execute(
      new TransformSmartObjectCommand(holder, { scaleX: 2, scaleY: 2, rotation: 0 }),
    );
    expect((holder.layer as SmartObjectLayer).displayData!.width).toBe(20);

    // Undo #2 -> back to 50%
    history.undo();
    expect((holder.layer as SmartObjectLayer).displayData!.width).toBe(5);

    // Undo #1 -> back to 100%
    history.undo();
    expect((holder.layer as SmartObjectLayer).displayData!.width).toBe(10);

    // Redo #1 -> 50%
    history.redo();
    expect((holder.layer as SmartObjectLayer).displayData!.width).toBe(5);
  });
});
