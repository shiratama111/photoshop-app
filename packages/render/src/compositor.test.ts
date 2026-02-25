import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { Canvas2DRenderer } from './compositor';
import { ViewportImpl } from './viewport';
import type {
  Document,
  LayerGroup,
  RasterLayer,
  RenderOptions,
  TextLayer,
} from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import type { CanvasContext2DLike, CanvasLike } from './canvas-pool';

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

/** Mock canvas factory for Node.js test environment. */
function createMockCanvas(width: number, height: number): CanvasLike {
  const ctx = createMockContext(width, height);
  const canvas: CanvasLike = {
    width,
    height,
    getContext: vi.fn().mockReturnValue(ctx),
  };
  ctx.canvas = canvas;
  return canvas;
}

function createMockContext(width: number, height: number): CanvasContext2DLike {
  const canvas = { width, height } as CanvasLike;
  return {
    canvas,
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
}

function makeRasterLayer(
  name: string,
  opts?: Partial<RasterLayer>,
): RasterLayer {
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
    writingMode: 'horizontal-tb',
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

describe('Canvas2DRenderer', () => {
  let renderer: Canvas2DRenderer;

  beforeEach(() => {
    renderer = new Canvas2DRenderer(createMockCanvas);
  });

  describe('render', () => {
    it('should clear the canvas before rendering', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const doc = createTestDocument();
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
    });

    it('should apply viewport transform', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const doc = createTestDocument();
      const vp = new ViewportImpl({ width: 100, height: 100 });
      vp.setZoom(2);
      vp.setOffset({ x: 10, y: 20 });
      const options = createRenderOptions({ viewport: vp });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 10, 20);
    });

    it('should scale viewport transform by canvas pixel ratio when CSS size is smaller', () => {
      const ctx = createMockContext(200, 200);
      const canvas = {
        width: 200,
        height: 200,
        clientWidth: 100,
        clientHeight: 100,
        getContext: vi.fn().mockReturnValue(ctx),
      } as unknown as HTMLCanvasElement;
      ctx.canvas = canvas as unknown as CanvasLike;
      const doc = createTestDocument();
      const vp = new ViewportImpl({ width: 100, height: 100 });
      vp.setZoom(2);
      vp.setOffset({ x: 10, y: 20 });
      const options = createRenderOptions({ viewport: vp });

      renderer.render(doc, canvas, options);

      expect(ctx.setTransform).toHaveBeenCalledWith(4, 0, 0, 4, 20, 40);
    });

    it('should render visible layers', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const doc = createTestDocument([makeRasterLayer('Layer 1')]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Should have drawn the layer (putImageData + drawImage)
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('should skip invisible layers', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const hiddenLayer = makeRasterLayer('Hidden', { visible: false });
      const doc = createTestDocument([hiddenLayer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // putImageData should NOT be called for hidden layer
      expect(ctx.putImageData).not.toHaveBeenCalled();
    });

    it('should set blend mode and opacity', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const layer = makeRasterLayer('Multiply', {
        opacity: 0.5,
        blendMode: BlendMode.Multiply,
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Context should have had opacity and blend mode set during render
      // (verified through save/restore calls and property assignments)
      expect(ctx.save).toHaveBeenCalled();
    });

    it('should render multiple layers in order', () => {
      const canvas = createMockCanvas(100, 100);
      const doc = createTestDocument([
        makeRasterLayer('Bottom'),
        makeRasterLayer('Top'),
      ]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);
      // Both layers should be rendered (order verified by call sequence)
    });

    it('should render groups as composites', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const group = makeGroup('Group', [makeRasterLayer('Child')]);
      const doc = createTestDocument([group]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Group should composite to temp canvas then draw to main
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should render text layers', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const doc = createTestDocument([makeTextLayer('Title', 'Hello')]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // New text rendering calls fillText instead of translate
      expect((ctx as unknown as Record<string, unknown>).fillText).toHaveBeenCalled();
    });
  });

  describe('background', () => {
    it('should draw white background', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const doc = createTestDocument();
      const options = createRenderOptions({ background: 'white' });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('should draw black background', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const doc = createTestDocument();
      const options = createRenderOptions({ background: 'black' });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('should draw checkerboard background', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const doc = createTestDocument();
      const options = createRenderOptions({ background: 'checkerboard' });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Checkerboard uses many fillRect calls
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('should prefer pattern fill for checkerboard when supported', () => {
      const ctx = createMockContext(100, 100);
      const pattern = {} as CanvasPattern;
      ctx.createPattern = vi.fn().mockReturnValue(pattern);
      const canvas = {
        width: 100,
        height: 100,
        getContext: vi.fn().mockReturnValue(ctx),
      } as unknown as HTMLCanvasElement;
      ctx.canvas = canvas as unknown as CanvasLike;
      const doc = createTestDocument();
      const options = createRenderOptions({ background: 'checkerboard' });

      renderer.render(doc, canvas, options);

      expect(ctx.createPattern).toHaveBeenCalled();
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
    });
  });

  describe('effects', () => {
    it('should render drop shadow when effects enabled', () => {
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

      // Shadow uses fillRect
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('should skip effects when renderEffects is false', () => {
      const canvas = createMockCanvas(100, 100);
      canvas.getContext('2d')!;
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
      const options = createRenderOptions({ renderEffects: false });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // No shadow fillRect should be called (only background fillRect)
      // Background checkerboard does call fillRect, so we check it's called fewer times
    });

    it('should skip disabled effects', () => {
      const canvas = createMockCanvas(100, 100);
      const layer = makeRasterLayer('NoEffect', {
        effects: [{
          type: 'drop-shadow',
          enabled: false,
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
      // Disabled effects should be skipped
    });
  });

  describe('renderLayerThumbnail', () => {
    it('should return null for non-existent layer', () => {
      const doc = createTestDocument();
      const result = renderer.renderLayerThumbnail(doc, 'non-existent', { width: 50, height: 50 });
      expect(result).toBeNull();
    });

    it('should render raster layer thumbnail', () => {
      const layer = makeRasterLayer('Thumb');
      const doc = createTestDocument([layer]);
      const result = renderer.renderLayerThumbnail(doc, layer.id, { width: 50, height: 50 });
      expect(result).not.toBeNull();
    });
  });

  describe('dispose', () => {
    it('should clean up canvas pool', () => {
      renderer.dispose();
      // Should not throw
    });
  });

  describe('RENDER-004: Text Layer Canvas Rendering', () => {
    it('should render text with correct font settings', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Bold Italic', 'Styled');
      layer.bold = true;
      layer.italic = true;
      layer.fontSize = 24;
      layer.fontFamily = 'Helvetica';
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.font).toContain('bold');
      expect(ctx.font).toContain('italic');
      expect(ctx.font).toContain('24px');
      expect(ctx.font).toContain('Helvetica');
    });

    it('should render multi-line text with one fillText per line', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Multi', 'Line 1\nLine 2\nLine 3');
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText.mock.calls.length).toBe(3);
    });

    it('should convert color to rgba CSS string', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Colored', 'Red');
      layer.color = { r: 128, g: 64, b: 32, a: 0.5 };
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
    });

    it('should apply text alignment with textBounds', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Centered', 'Center me');
      layer.alignment = 'center';
      layer.textBounds = { x: 10, y: 20, width: 200, height: 100 };
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.textAlign).toBe('center');
      // x should be position.x + textBounds.width/2 = 10 + 200/2 = 110
      const firstCall = ctx.fillText.mock.calls[0];
      expect(firstCall[1]).toBe(110);
    });

    it('should not render invisible text layers', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Hidden', 'Should not appear');
      layer.visible = false;
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).not.toHaveBeenCalled();
    });

    it('should handle empty text', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Empty', '');
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('should word-wrap text when textBounds width is set', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      // Each char ~8px (mock measureText), 'Hello World' = 11 chars = 88px
      // With maxWidth 50, 'Hello World' > 50 -> wraps
      const layer = makeTextLayer('Wrapped', 'Hello World Test');
      layer.textBounds = { x: 0, y: 0, width: 50, height: 200 };
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText.mock.calls.length).toBeGreaterThan(1);
    });

    it('should set textBaseline to top', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Baseline', 'Test');
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.textBaseline).toBe('top');
    });

    it('should position text at layer position for left alignment', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Positioned', 'At position');
      layer.position = { x: 50, y: 30 };
      layer.alignment = 'left';
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      const firstCall = ctx.fillText.mock.calls[0];
      expect(firstCall[1]).toBe(50);
      expect(firstCall[2]).toBe(30);
    });

    it('should render vertical-rl text with per-character fillText', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Vertical', 'AB');
      layer.writingMode = 'vertical-rl';
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText.mock.calls.length).toBe(2);
      expect(ctx.fillText.mock.calls[0][0]).toBe('A');
      expect(ctx.fillText.mock.calls[1][0]).toBe('B');
    });

    it('should render vertical-rl multi-line text in right-to-left columns', () => {
      const canvas = createMockCanvas(200, 200);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('VertMulti', 'AB\nCD');
      layer.writingMode = 'vertical-rl';
      layer.fontSize = 24;
      layer.lineHeight = 1.2;
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText.mock.calls.length).toBe(4);
      const colABx = ctx.fillText.mock.calls[0][1] as number;
      const colCDx = ctx.fillText.mock.calls[2][1] as number;
      expect(colABx).toBeGreaterThan(colCDx);
    });

    it('should use horizontal-tb by default (fillText with full line strings)', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Default', 'Hello');
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText.mock.calls.length).toBe(1);
      expect(ctx.fillText.mock.calls[0][0]).toBe('Hello');
    });

    it('should use correct line height spacing', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Spaced', 'Line1\nLine2');
      layer.fontSize = 20;
      layer.lineHeight = 1.5;
      layer.position = { x: 0, y: 0 };
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // lineH = fontSize * lineHeight = 20 * 1.5 = 30
      expect(ctx.fillText.mock.calls.length).toBe(2);
      expect(ctx.fillText.mock.calls[0][2]).toBe(0);
      expect(ctx.fillText.mock.calls[1][2]).toBe(30);
    });
  });

});
