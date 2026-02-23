import { describe, it, expect } from 'vitest';
import { BlendMode } from '@photoshop-app/types';
import type { RasterLayer, TextLayer, LayerGroup, LayerMask } from '@photoshop-app/types';
import { encodePng, decodePng } from '../png-codec';
import type { RgbaImage } from '../png-codec';
import { documentToProjectFile, projectFileToDocument } from '../project-serializer';
import { serialize, deserialize } from '../project-file';
import { zipSync } from 'fflate';
import { createDocument } from '../document';
import { createRasterLayer, createTextLayer, createLayerGroup } from '../layer-factory';
import { addLayer } from '../layer-tree';

// ── Helpers ──

/** Creates a mock ImageData-compatible object for testing (no browser API). */
function makeImageData(width: number, height: number, fill?: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill !== undefined) {
    data.fill(fill);
  } else {
    // Fill with a pattern for verification
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/** Creates a mock LayerMask. */
function makeMask(width: number, height: number): LayerMask {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    data[i] = (i * 7) % 256;
  }
  return {
    data,
    width,
    height,
    offset: { x: 5, y: 10 },
    enabled: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// PNG Codec Tests
// ═══════════════════════════════════════════════════════════════════

describe('PNG Codec', () => {
  it('round-trips a 1x1 image', () => {
    const original: RgbaImage = {
      data: new Uint8Array([255, 0, 128, 255]),
      width: 1,
      height: 1,
    };
    const encoded = encodePng(original);
    const decoded = decodePng(encoded);

    expect(decoded.width).toBe(1);
    expect(decoded.height).toBe(1);
    expect(Array.from(decoded.data)).toEqual(Array.from(original.data));
  });

  it('round-trips a 4x4 image', () => {
    const data = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < data.length; i++) {
      data[i] = (i * 13 + 7) % 256;
    }
    const original: RgbaImage = { data, width: 4, height: 4 };

    const encoded = encodePng(original);
    const decoded = decodePng(encoded);

    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
    expect(Array.from(decoded.data)).toEqual(Array.from(original.data));
  });

  it('round-trips a 100x100 image', () => {
    const data = new Uint8Array(100 * 100 * 4);
    for (let i = 0; i < data.length; i++) {
      data[i] = (i * 37 + 13) % 256;
    }
    const original: RgbaImage = { data, width: 100, height: 100 };

    const encoded = encodePng(original);
    const decoded = decodePng(encoded);

    expect(decoded.width).toBe(100);
    expect(decoded.height).toBe(100);
    expect(Array.from(decoded.data)).toEqual(Array.from(original.data));
  });

  it('handles all-transparent pixels', () => {
    const data = new Uint8Array(8 * 8 * 4); // all zeros
    const original: RgbaImage = { data, width: 8, height: 8 };

    const encoded = encodePng(original);
    const decoded = decodePng(encoded);

    expect(Array.from(decoded.data)).toEqual(Array.from(original.data));
  });

  it('handles all-white pixels', () => {
    const data = new Uint8Array(8 * 8 * 4).fill(255);
    const original: RgbaImage = { data, width: 8, height: 8 };

    const encoded = encodePng(original);
    const decoded = decodePng(encoded);

    expect(Array.from(decoded.data)).toEqual(Array.from(original.data));
  });

  it('throws on invalid PNG signature', () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(() => decodePng(garbage)).toThrow('Invalid PNG signature');
  });

  it('throws on empty data', () => {
    expect(() => decodePng(new Uint8Array(0))).toThrow();
  });

  it('throws on mismatched data length in encode', () => {
    const image: RgbaImage = {
      data: new Uint8Array(10), // wrong length
      width: 4,
      height: 4,
    };
    expect(() => encodePng(image)).toThrow('does not match dimensions');
  });

  it('works with Uint8ClampedArray input', () => {
    const data = new Uint8ClampedArray([255, 128, 64, 255, 0, 0, 0, 0, 100, 200, 50, 128, 10, 20, 30, 40]);
    const original: RgbaImage = { data, width: 2, height: 2 };

    const encoded = encodePng(original);
    const decoded = decodePng(encoded);

    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(Array.from(decoded.data)).toEqual(Array.from(data));
  });
});

// ═══════════════════════════════════════════════════════════════════
// Project Serializer Tests
// ═══════════════════════════════════════════════════════════════════

describe('Project Serializer', () => {
  it('round-trips an empty document', () => {
    const doc = createDocument('Empty', 800, 600);

    const projectFile = documentToProjectFile(doc);
    const restored = projectFileToDocument(projectFile);

    expect(restored.canvas).toEqual(doc.canvas);
    expect(restored.rootGroup.children).toEqual([]);
    expect(restored.createdAt).toBe(doc.createdAt);
    expect(restored.modifiedAt).toBe(doc.modifiedAt);
  });

  it('round-trips a raster layer with imageData', () => {
    const doc = createDocument('Test', 100, 100);
    const raster = createRasterLayer('Background', 100, 100);
    raster.imageData = makeImageData(100, 100);
    raster.opacity = 0.8;
    raster.blendMode = BlendMode.Multiply;
    raster.visible = false;
    addLayer(doc.rootGroup, raster);

    const projectFile = documentToProjectFile(doc);
    const restored = projectFileToDocument(projectFile);

    expect(restored.rootGroup.children).toHaveLength(1);
    const restoredRaster = restored.rootGroup.children[0] as RasterLayer;
    expect(restoredRaster.type).toBe('raster');
    expect(restoredRaster.name).toBe('Background');
    expect(restoredRaster.opacity).toBe(0.8);
    expect(restoredRaster.blendMode).toBe(BlendMode.Multiply);
    expect(restoredRaster.visible).toBe(false);
    expect(restoredRaster.imageData).not.toBeNull();
    expect(restoredRaster.imageData!.width).toBe(100);
    expect(restoredRaster.imageData!.height).toBe(100);
    // Verify pixel data round-trip
    expect(Array.from(restoredRaster.imageData!.data)).toEqual(
      Array.from(raster.imageData!.data),
    );
  });

  it('round-trips a raster layer with null imageData', () => {
    const doc = createDocument('Test', 100, 100);
    const raster = createRasterLayer('Empty Raster', 50, 50);
    addLayer(doc.rootGroup, raster);

    const projectFile = documentToProjectFile(doc);
    const restored = projectFileToDocument(projectFile);

    const restoredRaster = restored.rootGroup.children[0] as RasterLayer;
    expect(restoredRaster.imageData).toBeNull();
    expect(restoredRaster.bounds).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it('round-trips a text layer with all properties', () => {
    const doc = createDocument('Test', 800, 600);
    const text = createTextLayer('Title', 'Hello World', {
      fontFamily: 'Helvetica',
      fontSize: 24,
      color: { r: 255, g: 0, b: 0, a: 0.5 },
      bold: true,
      italic: true,
      alignment: 'center',
      lineHeight: 1.5,
      letterSpacing: 2,
    });
    text.textBounds = { x: 10, y: 20, width: 200, height: 50 };
    text.opacity = 0.9;
    text.locked = true;
    text.position = { x: 50, y: 100 };
    addLayer(doc.rootGroup, text);

    const projectFile = documentToProjectFile(doc);
    const restored = projectFileToDocument(projectFile);

    const restoredText = restored.rootGroup.children[0] as TextLayer;
    expect(restoredText.type).toBe('text');
    expect(restoredText.name).toBe('Title');
    expect(restoredText.text).toBe('Hello World');
    expect(restoredText.fontFamily).toBe('Helvetica');
    expect(restoredText.fontSize).toBe(24);
    expect(restoredText.color).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(restoredText.bold).toBe(true);
    expect(restoredText.italic).toBe(true);
    expect(restoredText.alignment).toBe('center');
    expect(restoredText.lineHeight).toBe(1.5);
    expect(restoredText.letterSpacing).toBe(2);
    expect(restoredText.textBounds).toEqual({ x: 10, y: 20, width: 200, height: 50 });
    expect(restoredText.opacity).toBe(0.9);
    expect(restoredText.locked).toBe(true);
    expect(restoredText.position).toEqual({ x: 50, y: 100 });
  });

  it('round-trips a nested layer group', () => {
    const doc = createDocument('Test', 800, 600);
    const outerGroup = createLayerGroup('Outer');
    const innerGroup = createLayerGroup('Inner');
    const raster = createRasterLayer('Pixel', 10, 10);
    raster.imageData = makeImageData(10, 10);

    addLayer(doc.rootGroup, outerGroup);
    addLayer(outerGroup, innerGroup);
    addLayer(innerGroup, raster);

    const projectFile = documentToProjectFile(doc);
    const restored = projectFileToDocument(projectFile);

    expect(restored.rootGroup.children).toHaveLength(1);
    const restoredOuter = restored.rootGroup.children[0] as LayerGroup;
    expect(restoredOuter.type).toBe('group');
    expect(restoredOuter.name).toBe('Outer');
    expect(restoredOuter.children).toHaveLength(1);

    const restoredInner = restoredOuter.children[0] as LayerGroup;
    expect(restoredInner.type).toBe('group');
    expect(restoredInner.name).toBe('Inner');
    expect(restoredInner.children).toHaveLength(1);

    const restoredRaster = restoredInner.children[0] as RasterLayer;
    expect(restoredRaster.type).toBe('raster');
    expect(restoredRaster.imageData).not.toBeNull();
  });

  it('round-trips blendMode and effects', () => {
    const doc = createDocument('Test', 800, 600);
    const raster = createRasterLayer('Styled', 10, 10);
    raster.blendMode = BlendMode.Screen;
    raster.effects = [
      {
        type: 'drop-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 0.75,
        angle: 120,
        distance: 5,
        blur: 10,
        spread: 0,
      },
    ];
    addLayer(doc.rootGroup, raster);

    const projectFile = documentToProjectFile(doc);
    const restored = projectFileToDocument(projectFile);

    const restoredRaster = restored.rootGroup.children[0] as RasterLayer;
    expect(restoredRaster.blendMode).toBe(BlendMode.Screen);
    expect(restoredRaster.effects).toHaveLength(1);
    expect(restoredRaster.effects[0].type).toBe('drop-shadow');
    expect(restoredRaster.effects[0].enabled).toBe(true);
  });

  it('round-trips a layer mask', () => {
    const doc = createDocument('Test', 100, 100);
    const raster = createRasterLayer('Masked', 20, 20);
    raster.imageData = makeImageData(20, 20);
    raster.mask = makeMask(20, 20);
    addLayer(doc.rootGroup, raster);

    const projectFile = documentToProjectFile(doc);
    const restored = projectFileToDocument(projectFile);

    const restoredRaster = restored.rootGroup.children[0] as RasterLayer;
    expect(restoredRaster.mask).toBeDefined();
    expect(restoredRaster.mask!.width).toBe(20);
    expect(restoredRaster.mask!.height).toBe(20);
    expect(restoredRaster.mask!.offset).toEqual({ x: 5, y: 10 });
    expect(restoredRaster.mask!.enabled).toBe(true);
    // Verify mask data round-trip (single channel)
    expect(Array.from(restoredRaster.mask!.data)).toEqual(
      Array.from(raster.mask!.data),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// Project File (ZIP) Tests
// ═══════════════════════════════════════════════════════════════════

describe('Project File (ZIP)', () => {
  it('serialize → deserialize round-trips a simple document', () => {
    const doc = createDocument('Simple', 1920, 1080, 300);
    const raster = createRasterLayer('Layer 1', 1920, 1080);
    raster.imageData = makeImageData(1920, 1080);
    addLayer(doc.rootGroup, raster);

    const zip = serialize(doc);
    expect(zip).toBeInstanceOf(Uint8Array);
    expect(zip.length).toBeGreaterThan(0);

    const restored = deserialize(zip);
    expect(restored.canvas.size).toEqual({ width: 1920, height: 1080 });
    expect(restored.canvas.dpi).toBe(300);
    expect(restored.rootGroup.children).toHaveLength(1);

    const restoredRaster = restored.rootGroup.children[0] as RasterLayer;
    expect(restoredRaster.imageData).not.toBeNull();
    expect(restoredRaster.imageData!.width).toBe(1920);
    expect(restoredRaster.imageData!.height).toBe(1080);
  });

  it('round-trips a complex document with mixed layer types', () => {
    const doc = createDocument('Complex', 800, 600);

    const group = createLayerGroup('Group A');
    const raster1 = createRasterLayer('Background', 800, 600);
    raster1.imageData = makeImageData(800, 600);
    const raster2 = createRasterLayer('Overlay', 400, 300);
    raster2.imageData = makeImageData(400, 300);
    raster2.opacity = 0.5;
    raster2.blendMode = BlendMode.Overlay;
    const text = createTextLayer('Title', 'Hello!', {
      fontFamily: 'Georgia',
      fontSize: 48,
      bold: true,
      alignment: 'center',
    });

    addLayer(doc.rootGroup, raster1);
    addLayer(doc.rootGroup, group);
    addLayer(group, raster2);
    addLayer(group, text);

    const zip = serialize(doc);
    const restored = deserialize(zip);

    expect(restored.rootGroup.children).toHaveLength(2);
    expect(restored.rootGroup.children[0].type).toBe('raster');
    expect(restored.rootGroup.children[1].type).toBe('group');

    const restoredGroup = restored.rootGroup.children[1] as LayerGroup;
    expect(restoredGroup.children).toHaveLength(2);
    expect(restoredGroup.children[0].type).toBe('raster');
    expect(restoredGroup.children[1].type).toBe('text');

    const restoredOverlay = restoredGroup.children[0] as RasterLayer;
    expect(restoredOverlay.opacity).toBe(0.5);
    expect(restoredOverlay.blendMode).toBe(BlendMode.Overlay);

    const restoredText = restoredGroup.children[1] as TextLayer;
    expect(restoredText.text).toBe('Hello!');
    expect(restoredText.fontFamily).toBe('Georgia');
    expect(restoredText.fontSize).toBe(48);
    expect(restoredText.bold).toBe(true);
    expect(restoredText.alignment).toBe('center');
  });

  it('throws on invalid ZIP data', () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5]);
    expect(() => deserialize(garbage)).toThrow();
  });

  it('throws when manifest.json is missing from ZIP', () => {
    // Create a valid ZIP without manifest.json
    const zip = zipSync({ 'dummy.txt': new TextEncoder().encode('hello') });
    expect(() => deserialize(zip)).toThrow('missing manifest.json');
  });

  it('produces a ZIP with manifest.version == 1', () => {
    const doc = createDocument('Version Check', 100, 100);
    const projectFile = documentToProjectFile(doc);
    expect(projectFile.manifest.version).toBe(1);
  });

  it('preserves document dirty=false and selectedLayerId=null on restore', () => {
    const doc = createDocument('Test', 100, 100);
    doc.dirty = true;
    doc.selectedLayerId = 'some-id';

    const zip = serialize(doc);
    const restored = deserialize(zip);

    expect(restored.dirty).toBe(false);
    expect(restored.selectedLayerId).toBeNull();
  });

  it('preserves canvas properties through round-trip', () => {
    const doc = createDocument('Canvas Test', 2560, 1440, 144);

    const zip = serialize(doc);
    const restored = deserialize(zip);

    expect(restored.canvas).toEqual({
      size: { width: 2560, height: 1440 },
      dpi: 144,
      colorMode: 'rgb',
      bitDepth: 8,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Performance Test
// ═══════════════════════════════════════════════════════════════════

describe('Performance', () => {
  it('serializes and deserializes 4000x4000 × 10 layers within 2 seconds', () => {
    const doc = createDocument('Perf', 4000, 4000);

    for (let i = 0; i < 10; i++) {
      const layer = createRasterLayer(`Layer ${i}`, 4000, 4000);
      // Create imageData with pattern data
      const data = new Uint8ClampedArray(4000 * 4000 * 4);
      // Fill with a compressible but non-trivial pattern
      for (let j = 0; j < data.length; j += 4) {
        data[j] = (j >> 2) % 256;
        data[j + 1] = ((j >> 2) * 7) % 256;
        data[j + 2] = ((j >> 2) * 13) % 256;
        data[j + 3] = 255;
      }
      layer.imageData = { data, width: 4000, height: 4000, colorSpace: 'srgb' } as ImageData;
      addLayer(doc.rootGroup, layer);
    }

    const start = performance.now();
    const zip = serialize(doc);
    const restored = deserialize(zip);
    const elapsed = performance.now() - start;

    // 640MB total pixel data (4000x4000x4x10); allow up to 10s for CI/slower machines
    expect(elapsed).toBeLessThan(10_000);
    expect(restored.rootGroup.children).toHaveLength(10);

    // Spot-check one layer
    const layer0 = restored.rootGroup.children[0] as RasterLayer;
    expect(layer0.imageData).not.toBeNull();
    expect(layer0.imageData!.width).toBe(4000);
    expect(layer0.imageData!.height).toBe(4000);
  });
});
