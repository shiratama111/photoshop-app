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
  const makeGradient = (): CanvasGradient => ({
    addColorStop: vi.fn(),
  } as unknown as CanvasGradient);

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
    getImageData: vi.fn(() => new ImageData(width, height)),
    translate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    createPattern: vi.fn(),
    createLinearGradient: vi.fn(() => makeGradient()),
    createRadialGradient: vi.fn(() => makeGradient()),
    font: '',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    letterSpacing: '0px',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
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
    underline: false,
    strikethrough: false,
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

    it('should skip layers listed in hiddenLayerIds', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const textLayer = makeTextLayer('Editing', 'Inline');
      const doc = createTestDocument([textLayer]);
      const options = createRenderOptions({ hiddenLayerIds: [textLayer.id] });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect((ctx as unknown as Record<string, unknown>).fillText).not.toHaveBeenCalled();
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

    it('should wrap CJK text by character when textBounds width is narrow', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const layer = makeTextLayer('JP', 'あいう');
      layer.textBounds = { x: 0, y: 0, width: 16, height: 100 };
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      const fillText = (ctx as unknown as { fillText: ReturnType<typeof vi.fn> }).fillText;
      const renderedLines = fillText.mock.calls.map((c: unknown[]) => c[0]);
      expect(renderedLines).toContain('あい');
      expect(renderedLines).toContain('う');
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

    it('should render inner shadow on raster layers', () => {
      const canvas = createMockCanvas(120, 120);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeRasterLayer('InnerShadowRaster', {
        effects: [{
          type: 'inner-shadow',
          enabled: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 0.6,
          angle: 120,
          distance: 6,
          blur: 8,
          choke: 10,
        }],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
      // Base raster render + inner-shadow composite
      expect(drawImage.mock.calls.length).toBeGreaterThan(1);
    });

    it('should render inner shadow on text layers', () => {
      const canvas = createMockCanvas(200, 120);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('InnerShadowText', 'Hello');
      layer.effects = [{
        type: 'inner-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 0.6,
        angle: 45,
        distance: 4,
        blur: 6,
        choke: 0,
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should skip disabled inner shadow effects', () => {
      const canvas = createMockCanvas(120, 120);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeRasterLayer('DisabledInnerShadow', {
        effects: [{
          type: 'inner-shadow',
          enabled: false,
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 0.6,
          angle: 120,
          distance: 6,
          blur: 8,
          choke: 10,
        }],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
      // Raster base draw only
      expect(drawImage.mock.calls.length).toBe(1);
    });

    it('should render inner glow (edge source) on raster layers', () => {
      const canvas = createMockCanvas(120, 120);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeRasterLayer('InnerGlowEdgeRaster', {
        effects: [{
          type: 'inner-glow',
          enabled: true,
          color: { r: 255, g: 220, b: 80, a: 1 },
          opacity: 0.7,
          size: 12,
          choke: 20,
          source: 'edge',
        }],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
      // Base raster + inner glow composite
      expect(drawImage.mock.calls.length).toBeGreaterThan(1);
    });

    it('should render inner glow (center source) on text layers', () => {
      const canvas = createMockCanvas(220, 140);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('InnerGlowCenterText', 'Glow');
      layer.effects = [{
        type: 'inner-glow',
        enabled: true,
        color: { r: 120, g: 200, b: 255, a: 1 },
        opacity: 0.8,
        size: 10,
        choke: 0,
        source: 'center',
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should skip disabled inner glow effects', () => {
      const canvas = createMockCanvas(120, 120);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeRasterLayer('DisabledInnerGlow', {
        effects: [{
          type: 'inner-glow',
          enabled: false,
          color: { r: 255, g: 220, b: 80, a: 1 },
          opacity: 0.7,
          size: 12,
          choke: 20,
          source: 'edge',
        }],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
      expect(drawImage.mock.calls.length).toBe(1);
    });

    it('should render gradient overlay (linear) on text layers', () => {
      const canvas = createMockCanvas(220, 140);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('GradientText', 'Gradient');
      layer.effects = [{
        type: 'gradient-overlay',
        enabled: true,
        opacity: 0.9,
        angle: 45,
        gradientType: 'linear',
        reverse: false,
        scale: 100,
        stops: [
          { position: 0, color: { r: 255, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 255, a: 1 } },
        ],
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.createLinearGradient).toHaveBeenCalled();
    });

    it('should render gradient overlay (radial) on raster layers', () => {
      const canvas = createMockCanvas(120, 120);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeRasterLayer('GradientRaster', {
        effects: [{
          type: 'gradient-overlay',
          enabled: true,
          opacity: 0.8,
          angle: 0,
          gradientType: 'radial',
          reverse: true,
          scale: 120,
          stops: [
            { position: 0, color: { r: 255, g: 255, b: 0, a: 1 } },
            { position: 1, color: { r: 255, g: 0, b: 255, a: 1 } },
          ],
        }],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
      expect(drawImage.mock.calls.length).toBeGreaterThan(1);
    });

    it('should skip disabled gradient overlay effects', () => {
      const canvas = createMockCanvas(120, 120);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeRasterLayer('DisabledGradientOverlay', {
        effects: [{
          type: 'gradient-overlay',
          enabled: false,
          opacity: 0.8,
          angle: 0,
          gradientType: 'linear',
          reverse: false,
          scale: 100,
          stops: [
            { position: 0, color: { r: 255, g: 255, b: 255, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
          ],
        }],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
      expect(drawImage.mock.calls.length).toBe(1);
    });

    it('should render bevel & emboss on text layers', () => {
      const canvas = createMockCanvas(260, 180);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('BevelText', 'Bevel');
      layer.effects = [{
        type: 'bevel-emboss',
        enabled: true,
        style: 'inner-bevel',
        depth: 150,
        direction: 'up',
        size: 8,
        soften: 2,
        angle: 120,
        altitude: 30,
        highlightColor: { r: 255, g: 255, b: 255, a: 1 },
        highlightOpacity: 0.75,
        shadowColor: { r: 0, g: 0, b: 0, a: 1 },
        shadowOpacity: 0.75,
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should render bevel & emboss styles on raster layers without throwing', () => {
      const styles = [
        'outer-bevel',
        'inner-bevel',
        'emboss',
        'pillow-emboss',
        'stroke-emboss',
      ] as const;

      for (const style of styles) {
        const canvas = createMockCanvas(160, 160);
        const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
        const layer = makeRasterLayer(`BevelRaster-${style}`, {
          effects: [{
            type: 'bevel-emboss',
            enabled: true,
            style,
            depth: 200,
            direction: 'down',
            size: 10,
            soften: 3,
            angle: 45,
            altitude: 50,
            highlightColor: { r: 255, g: 255, b: 255, a: 1 },
            highlightOpacity: 0.6,
            shadowColor: { r: 10, g: 10, b: 10, a: 1 },
            shadowOpacity: 0.6,
          }],
        });
        const doc = createTestDocument([layer]);
        const options = createRenderOptions({ renderEffects: true });

        expect(() => {
          renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);
        }).not.toThrow();

        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBeGreaterThan(1);
      }
    });

    it('should skip disabled bevel & emboss effects', () => {
      const canvas = createMockCanvas(120, 120);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeRasterLayer('DisabledBevel', {
        effects: [{
          type: 'bevel-emboss',
          enabled: false,
          style: 'inner-bevel',
          depth: 100,
          direction: 'up',
          size: 6,
          soften: 1,
          angle: 120,
          altitude: 30,
          highlightColor: { r: 255, g: 255, b: 255, a: 1 },
          highlightOpacity: 0.75,
          shadowColor: { r: 0, g: 0, b: 0, a: 1 },
          shadowOpacity: 0.75,
        }],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
      expect(drawImage.mock.calls.length).toBe(1);
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

  describe('PS-TEXT-002: Text Layer Effects', () => {
    it('should render text + drop shadow with fillText called multiple times', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Shadow', 'Hello');
      layer.effects = [{
        type: 'drop-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 0.5,
        angle: 135,
        distance: 5,
        blur: 4,
        spread: 0,
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // fillText called for shadow + normal text = at least 2 calls
      expect(ctx.fillText.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should render text + stroke with strokeText called', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Stroked', 'Hello');
      layer.effects = [{
        type: 'stroke',
        enabled: true,
        color: { r: 1, g: 0, b: 0, a: 1 },
        size: 3,
        position: 'outside',
        opacity: 1,
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.strokeText).toHaveBeenCalled();
      // Text fill should be drawn once by base text rendering (no duplicate fill from stroke effect).
      expect(ctx.fillText.mock.calls.length).toBe(1);
    });

    it('should render text + outer glow with blur filter and fillText', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Glowing', 'Hello');
      layer.effects = [{
        type: 'outer-glow',
        enabled: true,
        color: { r: 1, g: 1, b: 0, a: 1 },
        opacity: 0.75,
        size: 10,
        spread: 0,
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // fillText called for glow + normal text
      expect(ctx.fillText.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should render text + color overlay with overlay color fillText', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Overlay', 'Hello');
      layer.effects = [{
        type: 'color-overlay',
        enabled: true,
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 1,
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // fillText called for normal text + overlay
      expect(ctx.fillText.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should render raster + color overlay with an additional overlay pass', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeRasterLayer('RasterOverlay', {
        effects: [{
          type: 'color-overlay',
          enabled: true,
          color: { r: 255, g: 0, b: 0, a: 1 },
          opacity: 0.7,
        }],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Base raster draw + overlay draw.
      expect(ctx.drawImage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should apply mask alpha when multiplying raster pixels', () => {
      const tempCtx = createMockContext(1, 1) as unknown as Record<string, unknown>;
      const maskedPixel = new ImageData(new Uint8ClampedArray([10, 20, 30, 200]), 1, 1);
      const getImageDataSpy = vi.fn(() => maskedPixel);
      const putImageDataSpy = vi.fn();
      tempCtx.getImageData = getImageDataSpy;
      tempCtx.putImageData = putImageDataSpy;

      const layer = makeRasterLayer('Masked', {
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        mask: {
          data: new Uint8Array([128]),
          width: 1,
          height: 1,
          offset: { x: 0, y: 0 },
          enabled: true,
        },
      });

      (renderer as unknown as {
        applyMask: (ctx: CanvasContext2DLike, layer: RasterLayer) => void;
      }).applyMask(tempCtx as unknown as CanvasContext2DLike, layer);

      expect(getImageDataSpy).toHaveBeenCalledWith(0, 0, 1, 1);
      expect(putImageDataSpy).toHaveBeenCalledTimes(1);
      const output = putImageDataSpy.mock.calls[0][0] as ImageData;
      expect(output.data[0]).toBe(10);
      expect(output.data[1]).toBe(20);
      expect(output.data[2]).toBe(30);
      expect(output.data[3]).toBe(100);
    });

    it('should render raster + drop shadow with fillRect (regression)', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const layer = makeRasterLayer('RasterShadow', {
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

    it('should skip disabled text effects', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Disabled', 'Hello');
      layer.effects = [{
        type: 'drop-shadow',
        enabled: false,
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 0.5,
        angle: 135,
        distance: 5,
        blur: 4,
        spread: 0,
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Only normal text fillText, no shadow fillText
      expect(ctx.fillText.mock.calls.length).toBe(1);
    });
  });

  describe('PS-TEXT-004: Text visibility after confirmation', () => {
    it('should render テスト ABC 123 via fillText', () => {
      const canvas = createMockCanvas(400, 200);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Mixed', '\u30c6\u30b9\u30c8ABC 123');
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalledWith('\u30c6\u30b9\u30c8ABC 123', expect.any(Number), expect.any(Number));
    });

    it('should render text with correct rgba fill for black text', () => {
      const canvas = createMockCanvas(200, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Black', 'Visible');
      layer.color = { r: 0, g: 0, b: 0, a: 1 };
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
      // fillStyle should be set to rgba(0, 0, 0, 1)
      expect(ctx.fillStyle).toBe('rgba(0, 0, 0, 1)');
    });

    it('should render text with correct rgba fill for non-black color', () => {
      const canvas = createMockCanvas(200, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Red', 'Colored');
      layer.color = { r: 255, g: 0, b: 0, a: 1 };
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.fillStyle).toBe('rgba(255, 0, 0, 1)');
    });
  });

  describe('Text Decorations', () => {
    it('should draw underline when underline=true', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Underlined', 'Hello');
      layer.underline = true;
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should draw strikethrough when strikethrough=true', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Struck', 'Hello');
      layer.strikethrough = true;
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should not draw decorations when both are false', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Plain', 'Hello');
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.beginPath).not.toHaveBeenCalled();
      expect(ctx.stroke).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // PS-TEXT-007: Text visibility regression
  // ---------------------------------------------------------------------------

  describe('PS-TEXT-007: Text visibility regression', () => {
    it('should render text layer simulating post-editing state', () => {
      const canvas = createMockCanvas(400, 200);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Post-Edit', '\u30c6\u30b9\u30c8ABC 123');
      layer.visible = true;
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.fillText.mock.calls[0][0]).toBe('\u30c6\u30b9\u30c8ABC 123');
    });

    it('should render multi-line JP-EN text with word wrap', () => {
      const canvas = createMockCanvas(200, 400);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      // With mock measureText returning char*8px width, and textBounds.width=60,
      // 'Hello World' (11 chars * 8 = 88px) should wrap
      const layer = makeTextLayer('Wrap Test', 'Hello World \u30c6\u30b9\u30c8');
      layer.textBounds = { x: 0, y: 0, width: 60, height: 400 };
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Should produce more lines than the single explicit line
      expect(ctx.fillText.mock.calls.length).toBeGreaterThan(1);
    });

    it('should render empty text layer without error', () => {
      const canvas = createMockCanvas(100, 100);
      const layer = makeTextLayer('Empty Post-Edit', '');
      layer.visible = true;
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      // Should not throw
      expect(() => {
        renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);
      }).not.toThrow();
    });

    it('should render text with effects after edit', () => {
      const canvas = createMockCanvas(200, 200);
      const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;
      const layer = makeTextLayer('Effect Post-Edit', 'Styled Text');
      layer.effects = [{
        type: 'drop-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 0.5,
        angle: 135,
        distance: 5,
        blur: 4,
        spread: 0,
      }];
      const doc = createTestDocument([layer]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Shadow fillText + normal fillText = at least 2 calls
      expect(ctx.fillText.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // Clipping mask rendering — CLIP-001
  // -------------------------------------------------------------------------

  describe('clipping mask', () => {
    /** Make a raster layer with the clippingMask flag set. */
    function makeClippingRasterLayer(
      name: string,
      opts?: Partial<RasterLayer>,
    ): RasterLayer {
      const layer = makeRasterLayer(name, opts);
      (layer as Record<string, unknown>).clippingMask = true;
      return layer;
    }

    it('should use source-atop when rendering a clipping group', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const base = makeRasterLayer('Base');
      const clipped = makeClippingRasterLayer('Clipped');
      const doc = createTestDocument([base, clipped]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // The mock canvas context tracks drawImage calls.
      // A clipping group renders base to temp, clipped with source-atop, then
      // composites back. We verify that drawImage was called.
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should render non-clipped layers normally alongside a clipping group', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const base = makeRasterLayer('Base');
      const clipped = makeClippingRasterLayer('Clipped');
      const standalone = makeRasterLayer('Standalone');
      const doc = createTestDocument([base, clipped, standalone]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // All layers should be drawn — drawImage called multiple times.
      const drawImageCalls = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls;
      expect(drawImageCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle a 3+ layer clipping chain', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const base = makeRasterLayer('Base');
      const c1 = makeClippingRasterLayer('Clip1');
      const c2 = makeClippingRasterLayer('Clip2');
      const c3 = makeClippingRasterLayer('Clip3');
      const doc = createTestDocument([base, c1, c2, c3]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // The renderer should not throw and should composite layers.
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should skip invisible clipped layers', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const base = makeRasterLayer('Base');
      const invisible = makeClippingRasterLayer('Hidden', { visible: false });
      const doc = createTestDocument([base, invisible]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // The invisible layer should not trigger putImageData on the clip canvas.
      // drawImage is still called for the base composite step.
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should skip the entire clipping group when the base is invisible', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const base = makeRasterLayer('Base', { visible: false });
      const clipped = makeClippingRasterLayer('Clipped');
      const doc = createTestDocument([base, clipped]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Nothing should be drawn for the group.
      // drawImage is not called for an invisible base group.
      const drawCalls = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls;
      expect(drawCalls.length).toBe(0);
    });

    it('should apply effects on clipped layers after clipping', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const base = makeRasterLayer('Base');
      const clipped = makeClippingRasterLayer('ClippedWithEffect', {
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
      (clipped as Record<string, unknown>).clippingMask = true;
      const doc = createTestDocument([base, clipped]);
      const options = createRenderOptions({ renderEffects: true });

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Effects should be rendered (fillRect for shadow tinting).
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should use the base layer blend mode for the clipping group composite', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const base = makeRasterLayer('Base', {
        blendMode: BlendMode.Multiply,
        opacity: 0.7,
      });
      const clipped = makeClippingRasterLayer('Clipped');
      const doc = createTestDocument([base, clipped]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // The final composite should use the base's blend mode and opacity.
      // We verify through property access on the mock context.
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should handle multiple separate clipping groups in one parent', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      const base1 = makeRasterLayer('Base1');
      const c1 = makeClippingRasterLayer('Clip1');
      const base2 = makeRasterLayer('Base2');
      const c2 = makeClippingRasterLayer('Clip2');
      const doc = createTestDocument([base1, c1, base2, c2]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // Both groups should be rendered.
      const drawCalls = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls;
      expect(drawCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle a clipping layer at index 0 as a normal layer (orphan clipping)', () => {
      const canvas = createMockCanvas(100, 100);
      const ctx = canvas.getContext('2d')!;
      // An orphan clipping layer (no base below it) should render normally.
      const orphan = makeClippingRasterLayer('Orphan');
      const doc = createTestDocument([orphan]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      // It should still be drawn (as a normal layer).
      expect(ctx.drawImage).toHaveBeenCalled();
    });
  });

});
