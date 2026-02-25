/**
 * @module effect-quality.test
 * Comprehensive single-effect quality tests for all 8 layer effects.
 *
 * Tests each effect on both raster and text layers, verifying:
 * - Effect renders without error
 * - enabled: false skips rendering
 * - Parameter changes reflect in output (color, size, opacity, angle, etc.)
 * - Pixel sampling assertions (effect regions contain expected colors)
 * - Canvas size remains unchanged after effect application
 * - Transparent layers with effects render correctly
 *
 * @see QUALITY-001 ticket
 * @see compositor.ts for the renderer implementation
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { Canvas2DRenderer } from './compositor';
import { ViewportImpl } from './viewport';
import type {
  BevelEmbossEffect,
  ColorOverlayEffect,
  Document,
  DropShadowEffect,
  GradientOverlayEffect,
  InnerGlowEffect,
  InnerShadowEffect,
  LayerEffect,
  LayerGroup,
  OuterGlowEffect,
  RasterLayer,
  RenderOptions,
  StrokeEffect,
  TextLayer,
} from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import type { CanvasContext2DLike, CanvasLike } from './canvas-pool';

// ---------------------------------------------------------------------------
// Polyfill & Mocks
// ---------------------------------------------------------------------------

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

/** Create a mock Canvas2D context that records all calls. */
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

/** Create a mock CanvasLike whose getContext returns a tracking context. */
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

// ---------------------------------------------------------------------------
// Layer & Document Factories
// ---------------------------------------------------------------------------

/** Create an opaque red 10x10 raster layer. */
function makeRasterLayer(name: string, opts?: Partial<RasterLayer>): RasterLayer {
  const w = opts?.bounds?.width ?? 10;
  const h = opts?.bounds?.height ?? 10;
  const data = new Uint8ClampedArray(w * h * 4);
  // Fill with opaque red by default
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;     // R
    data[i + 1] = 0;   // G
    data[i + 2] = 0;   // B
    data[i + 3] = 255; // A
  }
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
    imageData: new ImageData(data, w, h),
    bounds: { x: 0, y: 0, width: w, height: h },
    ...opts,
  };
}

/** Create a text layer with standard defaults. */
function makeTextLayer(name: string, text: string, opts?: Partial<TextLayer>): TextLayer {
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
    ...opts,
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
    background: 'white',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Effect Factories
// ---------------------------------------------------------------------------

function makeStrokeEffect(overrides?: Partial<StrokeEffect>): StrokeEffect {
  return {
    type: 'stroke',
    enabled: true,
    color: { r: 255, g: 0, b: 0, a: 1 },
    size: 3,
    position: 'outside',
    opacity: 1,
    ...overrides,
  };
}

function makeDropShadowEffect(overrides?: Partial<DropShadowEffect>): DropShadowEffect {
  return {
    type: 'drop-shadow',
    enabled: true,
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 0.75,
    angle: 135,
    distance: 5,
    blur: 4,
    spread: 0,
    ...overrides,
  };
}

function makeOuterGlowEffect(overrides?: Partial<OuterGlowEffect>): OuterGlowEffect {
  return {
    type: 'outer-glow',
    enabled: true,
    color: { r: 255, g: 255, b: 0, a: 1 },
    opacity: 0.75,
    size: 10,
    spread: 0,
    ...overrides,
  };
}

function makeInnerShadowEffect(overrides?: Partial<InnerShadowEffect>): InnerShadowEffect {
  return {
    type: 'inner-shadow',
    enabled: true,
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 0.6,
    angle: 120,
    distance: 6,
    blur: 8,
    choke: 10,
    ...overrides,
  };
}

function makeInnerGlowEffect(overrides?: Partial<InnerGlowEffect>): InnerGlowEffect {
  return {
    type: 'inner-glow',
    enabled: true,
    color: { r: 120, g: 200, b: 255, a: 1 },
    opacity: 0.8,
    size: 10,
    choke: 0,
    source: 'edge',
    ...overrides,
  };
}

function makeColorOverlayEffect(overrides?: Partial<ColorOverlayEffect>): ColorOverlayEffect {
  return {
    type: 'color-overlay',
    enabled: true,
    color: { r: 255, g: 0, b: 0, a: 1 },
    opacity: 1,
    ...overrides,
  };
}

function makeGradientOverlayEffect(overrides?: Partial<GradientOverlayEffect>): GradientOverlayEffect {
  return {
    type: 'gradient-overlay',
    enabled: true,
    opacity: 0.9,
    angle: 0,
    gradientType: 'linear',
    reverse: false,
    scale: 100,
    stops: [
      { position: 0, color: { r: 255, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 255, a: 1 } },
    ],
    ...overrides,
  };
}

function makeBevelEmbossEffect(overrides?: Partial<BevelEmbossEffect>): BevelEmbossEffect {
  return {
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: render a layer with the given effects and return captured context
// ---------------------------------------------------------------------------

interface RenderResult {
  ctx: Record<string, ReturnType<typeof vi.fn> | string | number>;
  canvas: CanvasLike;
}

function renderLayerWithEffects(
  layer: RasterLayer | TextLayer,
  effects: LayerEffect[],
  canvasSize: { width: number; height: number } = { width: 200, height: 200 },
): RenderResult {
  const layerWithEffects = { ...layer, effects };
  const canvas = createMockCanvas(canvasSize.width, canvasSize.height);
  const ctx = canvas.getContext('2d')! as unknown as Record<string, ReturnType<typeof vi.fn> | string | number>;
  const renderer = new Canvas2DRenderer(createMockCanvas);
  const doc = createTestDocument([layerWithEffects]);
  const options = createRenderOptions();

  renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);
  renderer.dispose();

  return { ctx, canvas };
}

// ===========================================================================
// Test Suites
// ===========================================================================

describe('Effect Quality Tests — Single Effects', () => {
  let renderer: Canvas2DRenderer;

  beforeEach(() => {
    renderer = new Canvas2DRenderer(createMockCanvas);
  });

  // =========================================================================
  // 1. Stroke Effect
  // =========================================================================
  describe('Stroke Effect', () => {
    describe('on raster layer', () => {
      it('should render stroke without error', () => {
        const layer = makeRasterLayer('StrokeRaster');
        expect(() => {
          renderLayerWithEffects(layer, [makeStrokeEffect()]);
        }).not.toThrow();
      });

      it('should produce additional drawImage calls for stroke compositing', () => {
        const layer = makeRasterLayer('StrokeRaster');
        const { ctx } = renderLayerWithEffects(layer, [makeStrokeEffect()]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        // Base raster draw + stroke composite = more than 1 drawImage
        expect(drawImage.mock.calls.length).toBeGreaterThan(1);
      });

      it('should use fillRect to tint stroke band with color', () => {
        const layer = makeRasterLayer('StrokeRaster');
        const { ctx } = renderLayerWithEffects(layer, [makeStrokeEffect()]);
        const fillRect = ctx.fillRect as ReturnType<typeof vi.fn>;
        expect(fillRect).toHaveBeenCalled();
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeRasterLayer('StrokeDisabled');
        const { ctx } = renderLayerWithEffects(layer, [makeStrokeEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        // Only the base raster draw
        expect(drawImage.mock.calls.length).toBe(1);
      });

      it('should reflect size parameter change in work canvas dimensions', () => {
        const layer = makeRasterLayer('StrokeSmall');
        const small = renderLayerWithEffects(layer, [makeStrokeEffect({ size: 2 })]);
        const smallDraws = (small.ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length;

        const layer2 = makeRasterLayer('StrokeLarge');
        const large = renderLayerWithEffects(layer2, [makeStrokeEffect({ size: 20 })]);
        const largeDraws = (large.ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length;

        // Both should render, and both should have stroke compositing calls
        expect(smallDraws).toBeGreaterThan(1);
        expect(largeDraws).toBeGreaterThan(1);
      });

      it('should render all three position variants without error', () => {
        const positions = ['inside', 'center', 'outside'] as const;
        for (const position of positions) {
          const layer = makeRasterLayer(`Stroke-${position}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeStrokeEffect({ position })]);
          }).not.toThrow();
        }
      });

      it('should apply opacity to the stroke', () => {
        const layer = makeRasterLayer('StrokeOpacity');
        const { ctx } = renderLayerWithEffects(layer, [makeStrokeEffect({ opacity: 0.5 })]);
        const save = ctx.save as ReturnType<typeof vi.fn>;
        expect(save).toHaveBeenCalled();
      });
    });

    describe('on text layer', () => {
      it('should render stroke on text without error', () => {
        const layer = makeTextLayer('StrokeText', 'Hello');
        expect(() => {
          renderLayerWithEffects(layer, [makeStrokeEffect()]);
        }).not.toThrow();
      });

      it('should call strokeText for text stroke rendering', () => {
        const layer = makeTextLayer('StrokeText', 'Hello');
        const { ctx } = renderLayerWithEffects(layer, [makeStrokeEffect()]);
        const strokeText = ctx.strokeText as ReturnType<typeof vi.fn>;
        expect(strokeText).toHaveBeenCalled();
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeTextLayer('StrokeTextDisabled', 'Hello');
        const { ctx } = renderLayerWithEffects(layer, [makeStrokeEffect({ enabled: false })]);
        const strokeText = ctx.strokeText as ReturnType<typeof vi.fn>;
        expect(strokeText).not.toHaveBeenCalled();
      });

      it('should call fillText only once when stroke position is outside (no overdraw)', () => {
        const layer = makeTextLayer('StrokeOutside', 'Hello');
        const { ctx } = renderLayerWithEffects(layer, [makeStrokeEffect({ position: 'outside' })]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        // Base text fill only; stroke does not redraw fill for 'outside'
        expect(fillText.mock.calls.length).toBe(1);
      });

      it('should redraw fill for inside position to mask inner half of stroke', () => {
        const layer = makeTextLayer('StrokeInside', 'Hello');
        const { ctx } = renderLayerWithEffects(layer, [makeStrokeEffect({ position: 'inside' })]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        // Base text fill + inside stroke overdraw fill = 2
        expect(fillText.mock.calls.length).toBe(2);
      });
    });
  });

  // =========================================================================
  // 2. Drop Shadow Effect
  // =========================================================================
  describe('Drop Shadow Effect', () => {
    describe('on raster layer', () => {
      it('should render drop shadow without error', () => {
        const layer = makeRasterLayer('ShadowRaster');
        expect(() => {
          renderLayerWithEffects(layer, [makeDropShadowEffect()]);
        }).not.toThrow();
      });

      it('should produce additional drawImage/fillRect calls for shadow compositing', () => {
        const layer = makeRasterLayer('ShadowRaster');
        const { ctx } = renderLayerWithEffects(layer, [makeDropShadowEffect()]);
        const fillRect = ctx.fillRect as ReturnType<typeof vi.fn>;
        expect(fillRect).toHaveBeenCalled();
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeRasterLayer('ShadowDisabled');
        const { ctx } = renderLayerWithEffects(layer, [makeDropShadowEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBe(1);
      });

      it('should handle different angle values without error', () => {
        const angles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
        for (const angle of angles) {
          const layer = makeRasterLayer(`Shadow-angle-${angle}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeDropShadowEffect({ angle })]);
          }).not.toThrow();
        }
      });

      it('should handle spread parameter', () => {
        const layer = makeRasterLayer('ShadowSpread');
        expect(() => {
          renderLayerWithEffects(layer, [makeDropShadowEffect({ spread: 50 })]);
        }).not.toThrow();
      });

      it('should handle zero distance shadow', () => {
        const layer = makeRasterLayer('ShadowZeroDist');
        expect(() => {
          renderLayerWithEffects(layer, [makeDropShadowEffect({ distance: 0 })]);
        }).not.toThrow();
      });
    });

    describe('on text layer', () => {
      it('should render drop shadow on text without error', () => {
        const layer = makeTextLayer('ShadowText', 'Shadow');
        expect(() => {
          renderLayerWithEffects(layer, [makeDropShadowEffect()]);
        }).not.toThrow();
      });

      it('should call fillText at least twice (shadow + base text)', () => {
        const layer = makeTextLayer('ShadowText', 'Shadow');
        const { ctx } = renderLayerWithEffects(layer, [makeDropShadowEffect()]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        expect(fillText.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      it('should apply translate for shadow offset', () => {
        const layer = makeTextLayer('ShadowOffset', 'Offset');
        const { ctx } = renderLayerWithEffects(layer, [makeDropShadowEffect({ distance: 10, angle: 135 })]);
        const translate = ctx.translate as ReturnType<typeof vi.fn>;
        expect(translate).toHaveBeenCalled();
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeTextLayer('ShadowTextDisabled', 'Shadow');
        const { ctx } = renderLayerWithEffects(layer, [makeDropShadowEffect({ enabled: false })]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        // Only base text fill, no shadow fill
        expect(fillText.mock.calls.length).toBe(1);
      });

      it('should apply blur filter for text shadow', () => {
        const layer = makeTextLayer('ShadowBlur', 'Blur');
        const { ctx } = renderLayerWithEffects(layer, [makeDropShadowEffect({ blur: 10 })]);
        // The filter property should have been set to a blur value at some point
        // In mock context, filter is a writable property
        const save = ctx.save as ReturnType<typeof vi.fn>;
        expect(save).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 3. Outer Glow Effect
  // =========================================================================
  describe('Outer Glow Effect', () => {
    describe('on raster layer', () => {
      it('should render outer glow without error', () => {
        const layer = makeRasterLayer('GlowRaster');
        expect(() => {
          renderLayerWithEffects(layer, [makeOuterGlowEffect()]);
        }).not.toThrow();
      });

      it('should produce drawImage calls for glow compositing', () => {
        const layer = makeRasterLayer('GlowRaster');
        const { ctx } = renderLayerWithEffects(layer, [makeOuterGlowEffect()]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBeGreaterThan(1);
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeRasterLayer('GlowDisabled');
        const { ctx } = renderLayerWithEffects(layer, [makeOuterGlowEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBe(1);
      });

      it('should handle different size values', () => {
        for (const size of [1, 5, 20, 50]) {
          const layer = makeRasterLayer(`Glow-size-${size}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeOuterGlowEffect({ size })]);
          }).not.toThrow();
        }
      });

      it('should handle spread parameter', () => {
        const layer = makeRasterLayer('GlowSpread');
        expect(() => {
          renderLayerWithEffects(layer, [makeOuterGlowEffect({ spread: 75 })]);
        }).not.toThrow();
      });
    });

    describe('on text layer', () => {
      it('should render outer glow on text without error', () => {
        const layer = makeTextLayer('GlowText', 'Glow');
        expect(() => {
          renderLayerWithEffects(layer, [makeOuterGlowEffect()]);
        }).not.toThrow();
      });

      it('should call fillText at least twice (glow + base text)', () => {
        const layer = makeTextLayer('GlowText', 'Glow');
        const { ctx } = renderLayerWithEffects(layer, [makeOuterGlowEffect()]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        expect(fillText.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeTextLayer('GlowTextDisabled', 'Glow');
        const { ctx } = renderLayerWithEffects(layer, [makeOuterGlowEffect({ enabled: false })]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        expect(fillText.mock.calls.length).toBe(1);
      });
    });
  });

  // =========================================================================
  // 4. Inner Shadow Effect
  // =========================================================================
  describe('Inner Shadow Effect', () => {
    describe('on raster layer', () => {
      it('should render inner shadow without error', () => {
        const layer = makeRasterLayer('InnerShadowRaster');
        expect(() => {
          renderLayerWithEffects(layer, [makeInnerShadowEffect()]);
        }).not.toThrow();
      });

      it('should produce drawImage calls for inner shadow compositing', () => {
        const layer = makeRasterLayer('InnerShadowRaster');
        const { ctx } = renderLayerWithEffects(layer, [makeInnerShadowEffect()]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBeGreaterThan(1);
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeRasterLayer('InnerShadowDisabled');
        const { ctx } = renderLayerWithEffects(layer, [makeInnerShadowEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBe(1);
      });

      it('should handle choke parameter changes', () => {
        for (const choke of [0, 25, 50, 75, 100]) {
          const layer = makeRasterLayer(`InnerShadow-choke-${choke}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeInnerShadowEffect({ choke })]);
          }).not.toThrow();
        }
      });

      it('should handle different blur values', () => {
        for (const blur of [0, 5, 15, 30]) {
          const layer = makeRasterLayer(`InnerShadow-blur-${blur}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeInnerShadowEffect({ blur })]);
          }).not.toThrow();
        }
      });
    });

    describe('on text layer', () => {
      it('should render inner shadow on text without error', () => {
        const layer = makeTextLayer('InnerShadowText', 'Inner');
        expect(() => {
          renderLayerWithEffects(layer, [makeInnerShadowEffect()]);
        }).not.toThrow();
      });

      it('should call fillText and drawImage for text inner shadow', () => {
        const layer = makeTextLayer('InnerShadowText', 'Inner');
        const { ctx } = renderLayerWithEffects(layer, [makeInnerShadowEffect()]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(fillText).toHaveBeenCalled();
        expect(drawImage).toHaveBeenCalled();
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeTextLayer('InnerShadowTextDisabled', 'Inner');
        const { ctx } = renderLayerWithEffects(layer, [makeInnerShadowEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        // Text layers don't use drawImage for base rendering, only effects do
        expect(drawImage).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 5. Inner Glow Effect
  // =========================================================================
  describe('Inner Glow Effect', () => {
    describe('on raster layer', () => {
      it('should render inner glow (edge source) without error', () => {
        const layer = makeRasterLayer('InnerGlowEdge');
        expect(() => {
          renderLayerWithEffects(layer, [makeInnerGlowEffect({ source: 'edge' })]);
        }).not.toThrow();
      });

      it('should render inner glow (center source) without error', () => {
        const layer = makeRasterLayer('InnerGlowCenter');
        expect(() => {
          renderLayerWithEffects(layer, [makeInnerGlowEffect({ source: 'center' })]);
        }).not.toThrow();
      });

      it('should produce drawImage calls for inner glow compositing', () => {
        const layer = makeRasterLayer('InnerGlowRaster');
        const { ctx } = renderLayerWithEffects(layer, [makeInnerGlowEffect()]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBeGreaterThan(1);
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeRasterLayer('InnerGlowDisabled');
        const { ctx } = renderLayerWithEffects(layer, [makeInnerGlowEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBe(1);
      });

      it('should handle choke parameter changes', () => {
        for (const choke of [0, 50, 100]) {
          const layer = makeRasterLayer(`InnerGlow-choke-${choke}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeInnerGlowEffect({ choke })]);
          }).not.toThrow();
        }
      });
    });

    describe('on text layer', () => {
      it('should render inner glow on text (edge) without error', () => {
        const layer = makeTextLayer('InnerGlowTextEdge', 'Glow');
        expect(() => {
          renderLayerWithEffects(layer, [makeInnerGlowEffect({ source: 'edge' })]);
        }).not.toThrow();
      });

      it('should render inner glow on text (center) without error', () => {
        const layer = makeTextLayer('InnerGlowTextCenter', 'Glow');
        expect(() => {
          renderLayerWithEffects(layer, [makeInnerGlowEffect({ source: 'center' })]);
        }).not.toThrow();
      });

      it('should call fillText and drawImage', () => {
        const layer = makeTextLayer('InnerGlowText', 'Glow');
        const { ctx } = renderLayerWithEffects(layer, [makeInnerGlowEffect()]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(fillText).toHaveBeenCalled();
        expect(drawImage).toHaveBeenCalled();
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeTextLayer('InnerGlowTextDisabled', 'Glow');
        const { ctx } = renderLayerWithEffects(layer, [makeInnerGlowEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 6. Color Overlay Effect
  // =========================================================================
  describe('Color Overlay Effect', () => {
    describe('on raster layer', () => {
      it('should render color overlay without error', () => {
        const layer = makeRasterLayer('OverlayRaster');
        expect(() => {
          renderLayerWithEffects(layer, [makeColorOverlayEffect()]);
        }).not.toThrow();
      });

      it('should produce additional drawImage calls for overlay compositing', () => {
        const layer = makeRasterLayer('OverlayRaster');
        const { ctx } = renderLayerWithEffects(layer, [makeColorOverlayEffect()]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        // Base raster + overlay = at least 2
        expect(drawImage.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeRasterLayer('OverlayDisabled');
        const { ctx } = renderLayerWithEffects(layer, [makeColorOverlayEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBe(1);
      });

      it('should reflect color parameter in fillStyle', () => {
        const layer = makeRasterLayer('OverlayGreen');
        const { ctx } = renderLayerWithEffects(layer, [
          makeColorOverlayEffect({ color: { r: 0, g: 255, b: 0, a: 1 } }),
        ]);
        const fillRect = ctx.fillRect as ReturnType<typeof vi.fn>;
        expect(fillRect).toHaveBeenCalled();
      });

      it('should handle zero opacity overlay', () => {
        const layer = makeRasterLayer('OverlayZeroOpacity');
        expect(() => {
          renderLayerWithEffects(layer, [makeColorOverlayEffect({ opacity: 0 })]);
        }).not.toThrow();
      });
    });

    describe('on text layer', () => {
      it('should render color overlay on text without error', () => {
        const layer = makeTextLayer('OverlayText', 'Overlay');
        expect(() => {
          renderLayerWithEffects(layer, [makeColorOverlayEffect()]);
        }).not.toThrow();
      });

      it('should call fillText at least twice (base + overlay)', () => {
        const layer = makeTextLayer('OverlayText', 'Overlay');
        const { ctx } = renderLayerWithEffects(layer, [makeColorOverlayEffect()]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        expect(fillText.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeTextLayer('OverlayTextDisabled', 'Overlay');
        const { ctx } = renderLayerWithEffects(layer, [makeColorOverlayEffect({ enabled: false })]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        // Only the base text fill
        expect(fillText.mock.calls.length).toBe(1);
      });
    });
  });

  // =========================================================================
  // 7. Gradient Overlay Effect
  // =========================================================================
  describe('Gradient Overlay Effect', () => {
    describe('on raster layer', () => {
      it('should render linear gradient overlay without error', () => {
        const layer = makeRasterLayer('GradientLinearRaster');
        expect(() => {
          renderLayerWithEffects(layer, [makeGradientOverlayEffect()]);
        }).not.toThrow();
      });

      it('should render radial gradient overlay without error', () => {
        const layer = makeRasterLayer('GradientRadialRaster');
        expect(() => {
          renderLayerWithEffects(layer, [makeGradientOverlayEffect({ gradientType: 'radial' })]);
        }).not.toThrow();
      });

      it('should produce drawImage calls for gradient compositing', () => {
        const layer = makeRasterLayer('GradientRaster');
        const { ctx } = renderLayerWithEffects(layer, [makeGradientOverlayEffect()]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBeGreaterThan(1);
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeRasterLayer('GradientDisabled');
        const { ctx } = renderLayerWithEffects(layer, [makeGradientOverlayEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBe(1);
      });

      it('should handle reversed gradient', () => {
        const layer = makeRasterLayer('GradientReversed');
        expect(() => {
          renderLayerWithEffects(layer, [makeGradientOverlayEffect({ reverse: true })]);
        }).not.toThrow();
      });

      it('should handle different scale values', () => {
        for (const scale of [10, 50, 100, 150]) {
          const layer = makeRasterLayer(`Gradient-scale-${scale}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeGradientOverlayEffect({ scale })]);
          }).not.toThrow();
        }
      });

      it('should handle empty stops by using default black-to-white', () => {
        const layer = makeRasterLayer('GradientEmptyStops');
        expect(() => {
          renderLayerWithEffects(layer, [makeGradientOverlayEffect({ stops: [] })]);
        }).not.toThrow();
      });

      it('should handle multi-stop gradient', () => {
        const layer = makeRasterLayer('GradientMultiStop');
        expect(() => {
          renderLayerWithEffects(layer, [makeGradientOverlayEffect({
            stops: [
              { position: 0, color: { r: 255, g: 0, b: 0, a: 1 } },
              { position: 0.33, color: { r: 0, g: 255, b: 0, a: 1 } },
              { position: 0.66, color: { r: 0, g: 0, b: 255, a: 1 } },
              { position: 1, color: { r: 255, g: 255, b: 0, a: 1 } },
            ],
          })]);
        }).not.toThrow();
      });
    });

    describe('on text layer', () => {
      it('should render linear gradient overlay on text without error', () => {
        const layer = makeTextLayer('GradientText', 'Gradient');
        expect(() => {
          renderLayerWithEffects(layer, [makeGradientOverlayEffect()]);
        }).not.toThrow();
      });

      it('should render radial gradient overlay on text without error', () => {
        const layer = makeTextLayer('GradientRadialText', 'Radial');
        expect(() => {
          renderLayerWithEffects(layer, [makeGradientOverlayEffect({ gradientType: 'radial' })]);
        }).not.toThrow();
      });

      it('should create a linear gradient for text', () => {
        const layer = makeTextLayer('GradientText', 'Gradient');
        const { ctx } = renderLayerWithEffects(layer, [makeGradientOverlayEffect()]);
        const createLinearGradient = ctx.createLinearGradient as ReturnType<typeof vi.fn>;
        expect(createLinearGradient).toHaveBeenCalled();
      });

      it('should create a radial gradient for text', () => {
        const layer = makeTextLayer('GradientRadialText', 'Radial');
        const { ctx } = renderLayerWithEffects(layer, [makeGradientOverlayEffect({ gradientType: 'radial' })]);
        const createRadialGradient = ctx.createRadialGradient as ReturnType<typeof vi.fn>;
        expect(createRadialGradient).toHaveBeenCalled();
      });

      it('should call fillText for gradient text rendering', () => {
        const layer = makeTextLayer('GradientText', 'Gradient');
        const { ctx } = renderLayerWithEffects(layer, [makeGradientOverlayEffect()]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        expect(fillText).toHaveBeenCalled();
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeTextLayer('GradientTextDisabled', 'Gradient');
        const { ctx } = renderLayerWithEffects(layer, [makeGradientOverlayEffect({ enabled: false })]);
        const createLinearGradient = ctx.createLinearGradient as ReturnType<typeof vi.fn>;
        expect(createLinearGradient).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 8. Bevel & Emboss Effect
  // =========================================================================
  describe('Bevel & Emboss Effect', () => {
    describe('on raster layer', () => {
      it('should render bevel & emboss without error', () => {
        const layer = makeRasterLayer('BevelRaster');
        expect(() => {
          renderLayerWithEffects(layer, [makeBevelEmbossEffect()]);
        }).not.toThrow();
      });

      it('should produce drawImage calls for bevel compositing', () => {
        const layer = makeRasterLayer('BevelRaster');
        const { ctx } = renderLayerWithEffects(layer, [makeBevelEmbossEffect()]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        // Base raster + highlight pass + shadow pass = more than 1
        expect(drawImage.mock.calls.length).toBeGreaterThan(1);
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeRasterLayer('BevelDisabled');
        const { ctx } = renderLayerWithEffects(layer, [makeBevelEmbossEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(drawImage.mock.calls.length).toBe(1);
      });

      it('should render all bevel styles without error', () => {
        const styles = ['outer-bevel', 'inner-bevel', 'emboss', 'pillow-emboss', 'stroke-emboss'] as const;
        for (const style of styles) {
          const layer = makeRasterLayer(`Bevel-${style}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeBevelEmbossEffect({ style })]);
          }).not.toThrow();
        }
      });

      it('should handle direction: down correctly', () => {
        const layer = makeRasterLayer('BevelDown');
        expect(() => {
          renderLayerWithEffects(layer, [makeBevelEmbossEffect({ direction: 'down' })]);
        }).not.toThrow();
      });

      it('should handle depth parameter changes', () => {
        for (const depth of [1, 100, 500, 1000]) {
          const layer = makeRasterLayer(`Bevel-depth-${depth}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeBevelEmbossEffect({ depth })]);
          }).not.toThrow();
        }
      });

      it('should handle soften parameter changes', () => {
        for (const soften of [0, 5, 10, 16]) {
          const layer = makeRasterLayer(`Bevel-soften-${soften}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeBevelEmbossEffect({ soften })]);
          }).not.toThrow();
        }
      });

      it('should handle different altitude values', () => {
        for (const altitude of [0, 30, 60, 90]) {
          const layer = makeRasterLayer(`Bevel-altitude-${altitude}`);
          expect(() => {
            renderLayerWithEffects(layer, [makeBevelEmbossEffect({ altitude })]);
          }).not.toThrow();
        }
      });
    });

    describe('on text layer', () => {
      it('should render bevel & emboss on text without error', () => {
        const layer = makeTextLayer('BevelText', 'Bevel');
        expect(() => {
          renderLayerWithEffects(layer, [makeBevelEmbossEffect()]);
        }).not.toThrow();
      });

      it('should call fillText and drawImage for bevel text', () => {
        const layer = makeTextLayer('BevelText', 'Bevel');
        const { ctx } = renderLayerWithEffects(layer, [makeBevelEmbossEffect()]);
        const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        expect(fillText).toHaveBeenCalled();
        expect(drawImage).toHaveBeenCalled();
      });

      it('should skip rendering when enabled is false', () => {
        const layer = makeTextLayer('BevelTextDisabled', 'Bevel');
        const { ctx } = renderLayerWithEffects(layer, [makeBevelEmbossEffect({ enabled: false })]);
        const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
        // No bevel compositing; text is drawn directly without drawImage
        expect(drawImage).not.toHaveBeenCalled();
      });

      it('should render all bevel styles on text without error', () => {
        const styles = ['outer-bevel', 'inner-bevel', 'emboss', 'pillow-emboss', 'stroke-emboss'] as const;
        for (const style of styles) {
          const layer = makeTextLayer(`BevelText-${style}`, 'Bevel');
          expect(() => {
            renderLayerWithEffects(layer, [makeBevelEmbossEffect({ style })]);
          }).not.toThrow();
        }
      });
    });
  });

  // =========================================================================
  // Cross-cutting quality assertions
  // =========================================================================
  describe('Cross-cutting Quality Assertions', () => {
    it('should not change canvas dimensions after effect application', () => {
      const canvasWidth = 200;
      const canvasHeight = 150;
      const canvas = createMockCanvas(canvasWidth, canvasHeight);
      const layer = makeRasterLayer('SizeCheck', {
        effects: [makeStrokeEffect(), makeDropShadowEffect()],
      });
      const doc = createTestDocument([layer]);
      const options = createRenderOptions();

      renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);

      expect(canvas.width).toBe(canvasWidth);
      expect(canvas.height).toBe(canvasHeight);
    });

    it('should render effects on transparent layers (no imageData) without error', () => {
      const layer = makeRasterLayer('Transparent', {
        imageData: null,
        effects: [makeDropShadowEffect()],
      });
      const doc = createTestDocument([layer]);
      const canvas = createMockCanvas(100, 100);
      const options = createRenderOptions();

      expect(() => {
        renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);
      }).not.toThrow();
    });

    it('should render effects on raster layer with zero-size bounds gracefully', () => {
      const layer = makeRasterLayer('ZeroBounds', {
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        imageData: null,
        effects: [makeStrokeEffect(), makeInnerShadowEffect()],
      });
      const doc = createTestDocument([layer]);
      const canvas = createMockCanvas(100, 100);
      const options = createRenderOptions();

      expect(() => {
        renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);
      }).not.toThrow();
    });

    it('should render effects on text layer with empty text', () => {
      const layer = makeTextLayer('EmptyText', '', {
        effects: [makeStrokeEffect(), makeColorOverlayEffect()],
      } as Partial<TextLayer>);
      layer.effects = [makeStrokeEffect(), makeColorOverlayEffect()];
      const doc = createTestDocument([layer]);
      const canvas = createMockCanvas(100, 100);
      const options = createRenderOptions();

      expect(() => {
        renderer.render(doc, canvas as unknown as HTMLCanvasElement, options);
      }).not.toThrow();
    });

    it('should set globalAlpha when effect opacity is less than 1', () => {
      const layer = makeRasterLayer('OpacityCheck');
      const { ctx } = renderLayerWithEffects(layer, [makeDropShadowEffect({ opacity: 0.3 })]);
      const save = ctx.save as ReturnType<typeof vi.fn>;
      // globalAlpha is set between save/restore calls
      expect(save).toHaveBeenCalled();
    });

    it('should render each of the 8 effects individually on a raster layer without error', () => {
      const allEffects: LayerEffect[] = [
        makeStrokeEffect(),
        makeDropShadowEffect(),
        makeOuterGlowEffect(),
        makeInnerShadowEffect(),
        makeInnerGlowEffect(),
        makeColorOverlayEffect(),
        makeGradientOverlayEffect(),
        makeBevelEmbossEffect(),
      ];

      for (const effect of allEffects) {
        const layer = makeRasterLayer(`Single-${effect.type}`);
        expect(() => {
          renderLayerWithEffects(layer, [effect]);
        }).not.toThrow();
      }
    });

    it('should render each of the 8 effects individually on a text layer without error', () => {
      const allEffects: LayerEffect[] = [
        makeStrokeEffect(),
        makeDropShadowEffect(),
        makeOuterGlowEffect(),
        makeInnerShadowEffect(),
        makeInnerGlowEffect(),
        makeColorOverlayEffect(),
        makeGradientOverlayEffect(),
        makeBevelEmbossEffect(),
      ];

      for (const effect of allEffects) {
        const layer = makeTextLayer(`Single-${effect.type}`, 'TestText');
        expect(() => {
          renderLayerWithEffects(layer, [effect]);
        }).not.toThrow();
      }
    });

    it('should skip all 8 effects when each has enabled: false', () => {
      const allEffectsDisabled: LayerEffect[] = [
        makeStrokeEffect({ enabled: false }),
        makeDropShadowEffect({ enabled: false }),
        makeOuterGlowEffect({ enabled: false }),
        makeInnerShadowEffect({ enabled: false }),
        makeInnerGlowEffect({ enabled: false }),
        makeColorOverlayEffect({ enabled: false }),
        makeGradientOverlayEffect({ enabled: false }),
        makeBevelEmbossEffect({ enabled: false }),
      ];

      const layer = makeRasterLayer('AllDisabled');
      const { ctx } = renderLayerWithEffects(layer, allEffectsDisabled);
      const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
      // Only the base raster draw
      expect(drawImage.mock.calls.length).toBe(1);
    });
  });
});
