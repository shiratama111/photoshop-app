import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { WebGLRenderer } from './webgl-compositor';
import { ViewportImpl } from './viewport';
import type {
  Document,
  LayerGroup,
  RasterLayer,
  RenderOptions,
  TextLayer,
} from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import type { CanvasLike } from './canvas-pool';
import { BLEND_MODE_MAP } from './shaders';

// Polyfill ImageData for Node.js test environment
beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as Record<string, unknown>).ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(widthOrData: number | Uint8ClampedArray, heightOrWidth: number, height?: number) {
        if (widthOrData instanceof Uint8ClampedArray) {
          this.data = widthOrData;
          this.width = heightOrWidth;
          this.height = height!;
        } else {
          this.width = widthOrData;
          this.height = heightOrWidth;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        }
      }
    };
  }
});

/** Mock canvas factory for Node.js test environment (Canvas 2D fallback). */
function createMockCanvas(width: number, height: number): CanvasLike {
  const ctx2d = {
    canvas: { width, height } as CanvasLike,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    filter: 'none',
    fillStyle: '',
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    createPattern: vi.fn(),
    font: '',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    letterSpacing: '0px',
  };
  const canvas: CanvasLike = {
    width,
    height,
    // Return 2D mock only for '2d'; return null for 'webgl2' (no WebGL in Node)
    getContext: vi.fn().mockImplementation((type: string) => {
      if (type === '2d') return ctx2d;
      return null;
    }),
  };
  ctx2d.canvas = canvas;
  return canvas;
}

function makeRasterLayer(name: string, opts?: Partial<RasterLayer>): RasterLayer {
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
    imageData: new ImageData(10, 10),
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    ...opts,
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
  };
}

function makeGroup(name: string, children: Array<RasterLayer | TextLayer | LayerGroup>): LayerGroup {
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

function createTestDocument(children: Array<RasterLayer | TextLayer | LayerGroup> = []): Document {
  const rootId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    name: 'Test',
    canvas: { size: { width: 100, height: 100 }, dpi: 72, colorMode: 'rgb', bitDepth: 8 },
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
      children: children.map((c) => ({ ...c, parentId: rootId })),
      expanded: true,
    },
    selectedLayerId: null,
    filePath: null,
    dirty: false,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };
}

function createRenderOptions(overrides?: Partial<RenderOptions>): RenderOptions {
  return {
    viewport: new ViewportImpl({ width: 100, height: 100 }),
    renderEffects: true,
    showSelection: false,
    showGuides: false,
    background: 'checkerboard',
    ...overrides,
  };
}

describe('WebGLRenderer', () => {
  let renderer: WebGLRenderer;

  beforeEach(() => {
    renderer = new WebGLRenderer(createMockCanvas);
  });

  describe('fallback behavior', () => {
    it('should fall back to Canvas 2D when WebGL is unavailable', () => {
      // In Node.js test env, WebGL2 is not available, so it should
      // fall back to Canvas2DRenderer without throwing.
      const canvas = createMockCanvas(100, 100);
      const doc = createTestDocument([makeRasterLayer('Layer 1')]);
      const options = createRenderOptions();

      // Should not throw — falls back to Canvas 2D
      expect(() => {
        renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);
      }).not.toThrow();
    });

    it('should report WebGL as inactive in test environment', () => {
      expect(renderer.isWebGLActive).toBe(false);
    });

    it('should render via fallback for all background types', () => {
      const canvas = createMockCanvas(100, 100);
      const doc = createTestDocument();

      for (const bg of ['white', 'black', 'checkerboard'] as const) {
        const options = createRenderOptions({ background: bg });
        expect(() => {
          renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);
        }).not.toThrow();
      }
    });

    it('should render visible layers via fallback', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const doc = createTestDocument([makeRasterLayer('Layer 1')]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('should skip invisible layers via fallback', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const hiddenLayer = makeRasterLayer('Hidden', { visible: false });
      const doc = createTestDocument([hiddenLayer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.putImageData).not.toHaveBeenCalled();
    });

    it('should render groups via fallback', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const group = makeGroup('Group', [makeRasterLayer('Child')]);
      const doc = createTestDocument([group]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should render text layers via fallback', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const doc = createTestDocument([makeTextLayer('Title', 'Hello')]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // New text rendering calls fillText instead of translate
      expect((ctx as unknown as Record<string, unknown>).fillText).toHaveBeenCalled();
    });

    it('should render effects via fallback', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const layer = makeRasterLayer('Shadowed', {
        effects: [{
          type: 'drop-shadow',
          enabled: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 0.5,
          angle: 135,
          distance: 5,
          blur: 4,
          spread: 0,
        }],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });

  describe('renderLayerThumbnail', () => {
    it('should return null for non-existent layer', () => {
      const doc = createTestDocument();
      const result = renderer.renderLayerThumbnail(doc, 'non-existent', { width: 50, height: 50 });
      expect(result).toBeNull();
    });

    it('should render raster layer thumbnail via fallback', () => {
      const layer = makeRasterLayer('Thumb');
      const doc = createTestDocument([layer]);
      const result = renderer.renderLayerThumbnail(doc, layer.id, { width: 50, height: 50 });
      expect(result).not.toBeNull();
    });
  });

  describe('dispose', () => {
    it('should clean up without throwing', () => {
      expect(() => renderer.dispose()).not.toThrow();
    });

    it('should be safe to call dispose multiple times', () => {
      renderer.dispose();
      expect(() => renderer.dispose()).not.toThrow();
    });
  });
});

describe('BLEND_MODE_MAP', () => {
  it('should map all BlendMode enum values', () => {
    for (const mode of Object.values(BlendMode)) {
      expect(BLEND_MODE_MAP).toHaveProperty(mode);
      expect(typeof BLEND_MODE_MAP[mode]).toBe('number');
    }
  });

  it('should have unique integer values for each blend mode', () => {
    const values = Object.values(BLEND_MODE_MAP);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('should map Normal to 0', () => {
    expect(BLEND_MODE_MAP['normal']).toBe(0);
  });
});

describe('TexturePool (via WebGLRenderer integration)', () => {
  it('should handle renderer creation and disposal lifecycle', () => {
    const r = new WebGLRenderer(createMockCanvas);
    expect(r.isWebGLActive).toBe(false);
    r.dispose();
    expect(r.isWebGLActive).toBe(false);
  });
});
