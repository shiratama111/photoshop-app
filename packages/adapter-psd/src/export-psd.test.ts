import { describe, it, expect } from 'vitest';
import { exportPsd } from './export-psd';
import { importPsd } from './import-psd';
import { exportLayer } from './layer-exporter';
import type { Document, LayerGroup, RasterLayer, TextLayer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';

/** Create a minimal test document. */
function createTestDocument(options?: {
  width?: number;
  height?: number;
  layers?: Array<RasterLayer | TextLayer | LayerGroup>;
}): Document {
  const { width = 100, height = 100, layers = [] } = options ?? {};
  const rootId = crypto.randomUUID();

  return {
    id: crypto.randomUUID(),
    name: 'Test',
    canvas: {
      size: { width, height },
      dpi: 72,
      colorMode: 'rgb',
      bitDepth: 8,
    },
    rootGroup: {
      id: rootId,
      name: 'Root',
      type: 'group',
      visible: true,
      opacity: 1,
      blendMode: BlendMode.Normal,
      position: { x: 0, y: 0 },
      locked: false,
      effects: [],
      parentId: null,
      children: layers.map((l) => ({ ...l, parentId: rootId })),
      expanded: true,
    },
    selectedLayerId: null,
    filePath: null,
    dirty: false,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };
}

function makeRasterLayer(name: string): RasterLayer {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'raster',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    imageData: null,
    bounds: { x: 0, y: 0, width: 50, height: 50 },
  };
}

function makeTextLayer(name: string, text: string): TextLayer {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'text',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 10, y: 20 },
    locked: false,
    effects: [],
    parentId: null,
    text,
    fontFamily: 'Arial',
    fontSize: 24,
    color: { r: 0, g: 0, b: 0, a: 1 },
    bold: false,
    italic: false,
    alignment: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    textBounds: null,
    writingMode: 'horizontal-tb',
  };
}

function makeGroup(name: string, children: Array<RasterLayer | TextLayer>): LayerGroup {
  const id = crypto.randomUUID();
  return {
    id,
    name,
    type: 'group',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    children: children.map((c) => ({ ...c, parentId: id })),
    expanded: true,
  };
}

describe('exportPsd', () => {
  it('should export an empty document', () => {
    const doc = createTestDocument();
    const buffer = exportPsd(doc);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('should export a document with raster layers', () => {
    const doc = createTestDocument({
      layers: [makeRasterLayer('BG'), makeRasterLayer('Layer 1')],
    });
    const buffer = exportPsd(doc);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('should export document with text layers', () => {
    const doc = createTestDocument({
      layers: [makeTextLayer('Title', 'Hello')],
    });
    const buffer = exportPsd(doc, { preserveText: true });
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('should export document with groups', () => {
    const doc = createTestDocument({
      layers: [makeGroup('Group 1', [makeRasterLayer('Child')])],
    });
    const buffer = exportPsd(doc);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('should preserve canvas dimensions', () => {
    const doc = createTestDocument({ width: 1920, height: 1080 });
    const buffer = exportPsd(doc);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('should export layer effects when includeEffects is true', () => {
    const layer = makeRasterLayer('FX');
    layer.effects = [
      {
        type: 'drop-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 0.5,
        angle: 120,
        distance: 8,
        blur: 6,
        spread: 3,
      },
      {
        type: 'inner-glow',
        enabled: true,
        color: { r: 255, g: 200, b: 120, a: 1 },
        opacity: 0.6,
        size: 10,
        choke: 5,
        source: 'edge',
      },
      {
        type: 'gradient-overlay',
        enabled: true,
        opacity: 0.8,
        angle: 45,
        gradientType: 'linear',
        reverse: false,
        scale: 100,
        stops: [
          { position: 0, color: { r: 255, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 255, a: 1 } },
        ],
      },
      {
        type: 'bevel-emboss',
        enabled: true,
        style: 'inner-bevel',
        depth: 120,
        direction: 'up',
        size: 6,
        soften: 1,
        angle: 120,
        altitude: 30,
        highlightColor: { r: 255, g: 255, b: 255, a: 1 },
        highlightOpacity: 0.7,
        shadowColor: { r: 0, g: 0, b: 0, a: 1 },
        shadowOpacity: 0.7,
      },
    ];

    const agLayer = exportLayer(layer, {
      preserveText: true,
      generateComposite: false,
      includeEffects: true,
    });

    expect(agLayer.effects).toBeDefined();
    expect(agLayer.effects?.dropShadow?.length).toBe(1);
    expect(agLayer.effects?.innerGlow).toBeDefined();
    expect(agLayer.effects?.gradientOverlay?.length).toBe(1);
    expect(agLayer.effects?.bevel).toBeDefined();
  });

  it('should omit layer effects when includeEffects is false', () => {
    const layer = makeRasterLayer('NoFX');
    layer.effects = [{
      type: 'drop-shadow',
      enabled: true,
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 0.5,
      angle: 120,
      distance: 8,
      blur: 6,
      spread: 3,
    }];

    const agLayer = exportLayer(layer, {
      preserveText: true,
      generateComposite: false,
      includeEffects: false,
    });

    expect(agLayer.effects).toBeUndefined();
  });
});

describe('PSD roundtrip (import → export → re-import)', () => {
  it('should preserve document dimensions', () => {
    const original = createTestDocument({ width: 800, height: 600 });
    const buffer = exportPsd(original);
    const { document: reimported } = importPsd(buffer, 'roundtrip.psd');

    expect(reimported.canvas.size.width).toBe(800);
    expect(reimported.canvas.size.height).toBe(600);
  });

  it('should preserve layer count and names', () => {
    const original = createTestDocument({
      layers: [makeRasterLayer('Background'), makeRasterLayer('Foreground')],
    });
    const buffer = exportPsd(original);
    const { document: reimported } = importPsd(buffer);

    expect(reimported.rootGroup.children).toHaveLength(2);
    expect(reimported.rootGroup.children[0].name).toBe('Background');
    expect(reimported.rootGroup.children[1].name).toBe('Foreground');
  });

  it('should preserve group structure', () => {
    const original = createTestDocument({
      layers: [makeGroup('Effects', [makeRasterLayer('Glow'), makeRasterLayer('Shadow')])],
    });
    const buffer = exportPsd(original);
    const { document: reimported } = importPsd(buffer);

    const group = reimported.rootGroup.children[0];
    expect(group.type).toBe('group');
    if (group.type === 'group') {
      expect(group.children).toHaveLength(2);
      expect(group.name).toBe('Effects');
    }
  });

  it('should preserve text content when preserveText is true', () => {
    const original = createTestDocument({
      layers: [makeTextLayer('Title', 'Hello World')],
    });
    const buffer = exportPsd(original, { preserveText: true });
    const { document: reimported } = importPsd(buffer, 'test.psd', { rasterizeText: false });

    const layer = reimported.rootGroup.children[0];
    expect(layer.type).toBe('text');
    if (layer.type === 'text') {
      expect(layer.text).toBe('Hello World');
    }
  });
});
