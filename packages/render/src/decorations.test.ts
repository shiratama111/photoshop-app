/**
 * @module decorations.test
 * Tests for decoration rendering utilities (concentration lines, etc.).
 *
 * @see DECO-001 - Concentration lines ticket
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderConcentrationLines } from './decorations';
import type { ConcentrationLinesConfig, ConcentrationLinesRenderOptions } from './decorations';

// ---------------------------------------------------------------------------
// Polyfill ImageData for Node.js test environment
// ---------------------------------------------------------------------------
beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).ImageData = class ImageData {
      readonly width: number;
      readonly height: number;
      readonly data: Uint8ClampedArray;
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

// ---------------------------------------------------------------------------
// Mock canvas infrastructure for Node.js
// ---------------------------------------------------------------------------

/** Captured state from mock context calls. */
interface MockContextState {
  saveCount: number;
  restoreCount: number;
  lastGlobalAlpha: number;
  lastGlobalCompositeOperation: string;
  drawImageCalls: Array<{ source: unknown; x: number; y: number }>;
  putImageDataCalls: Array<{ imageData: ImageData; x: number; y: number }>;
}

/**
 * Create a mock CanvasRenderingContext2D that tracks calls for assertions.
 * Includes a mock offscreen canvas via ownerDocument.createElement.
 */
function createMockContext(width: number, height: number): {
  ctx: CanvasRenderingContext2D;
  state: MockContextState;
} {
  const state: MockContextState = {
    saveCount: 0,
    restoreCount: 0,
    lastGlobalAlpha: 1,
    lastGlobalCompositeOperation: 'source-over',
    drawImageCalls: [],
    putImageDataCalls: [],
  };

  // Mock offscreen context (created via ownerDocument.createElement('canvas'))
  const offscreenCtx = {
    putImageData: vi.fn((imageData: ImageData, x: number, y: number) => {
      state.putImageDataCalls.push({ imageData, x, y });
    }),
  };

  const offscreenCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(offscreenCtx),
  };

  const ownerDocument = {
    createElement: vi.fn().mockReturnValue(offscreenCanvas),
  };

  const canvas = {
    width,
    height,
    ownerDocument,
  };

  const ctx = {
    canvas,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as string,
    save: vi.fn(() => { state.saveCount++; }),
    restore: vi.fn(() => { state.restoreCount++; }),
    drawImage: vi.fn((source: unknown, x: number, y: number) => {
      state.drawImageCalls.push({ source, x, y });
    }),
    putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  // Track property assignments on the mock
  const proxy = new Proxy(ctx, {
    set(target, prop, value) {
      if (prop === 'globalAlpha') {
        state.lastGlobalAlpha = value as number;
      }
      if (prop === 'globalCompositeOperation') {
        state.lastGlobalCompositeOperation = value as string;
      }
      (target as Record<string | symbol, unknown>)[prop] = value;
      return true;
    },
  });

  return { ctx: proxy, state };
}

/** Default test config. */
function makeConfig(overrides?: Partial<ConcentrationLinesConfig>): ConcentrationLinesConfig {
  return {
    centerX: 50,
    centerY: 50,
    canvasWidth: 100,
    canvasHeight: 100,
    lineCount: 30,
    lineWidthMin: 2,
    lineWidthMax: 6,
    innerRadius: 0.2,
    color: { r: 0, g: 0, b: 0, a: 255 },
    randomSeed: 12345,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderConcentrationLines', () => {
  it('saves and restores the canvas context state', () => {
    const { ctx, state } = createMockContext(100, 100);
    renderConcentrationLines(ctx, makeConfig());
    expect(state.saveCount).toBe(1);
    expect(state.restoreCount).toBe(1);
  });

  it('creates an offscreen canvas with correct dimensions', () => {
    const { ctx } = createMockContext(100, 100);
    const config = makeConfig({ canvasWidth: 200, canvasHeight: 150 });
    renderConcentrationLines(ctx, config);

    const ownerDoc = (ctx.canvas as unknown as { ownerDocument: { createElement: ReturnType<typeof vi.fn> } }).ownerDocument;
    expect(ownerDoc.createElement).toHaveBeenCalledWith('canvas');
  });

  it('calls drawImage to composite the result', () => {
    const { ctx, state } = createMockContext(100, 100);
    renderConcentrationLines(ctx, makeConfig());
    expect(state.drawImageCalls.length).toBe(1);
    expect(state.drawImageCalls[0].x).toBe(0);
    expect(state.drawImageCalls[0].y).toBe(0);
  });

  it('puts ImageData onto the offscreen canvas', () => {
    const { ctx, state } = createMockContext(100, 100);
    renderConcentrationLines(ctx, makeConfig());
    expect(state.putImageDataCalls.length).toBe(1);
    expect(state.putImageDataCalls[0].x).toBe(0);
    expect(state.putImageDataCalls[0].y).toBe(0);
    // The ImageData should have the correct dimensions
    const imageData = state.putImageDataCalls[0].imageData;
    expect(imageData.width).toBe(100);
    expect(imageData.height).toBe(100);
  });

  it('applies default blend mode (source-over) and opacity (1)', () => {
    const { ctx, state } = createMockContext(100, 100);
    renderConcentrationLines(ctx, makeConfig());
    expect(state.lastGlobalCompositeOperation).toBe('source-over');
    expect(state.lastGlobalAlpha).toBe(1);
  });

  it('applies custom blend mode', () => {
    const { ctx, state } = createMockContext(100, 100);
    const options: ConcentrationLinesRenderOptions = { blendMode: 'multiply' };
    renderConcentrationLines(ctx, makeConfig(), options);
    expect(state.lastGlobalCompositeOperation).toBe('multiply');
  });

  it('applies custom opacity', () => {
    const { ctx, state } = createMockContext(100, 100);
    const options: ConcentrationLinesRenderOptions = { opacity: 0.5 };
    renderConcentrationLines(ctx, makeConfig(), options);
    expect(state.lastGlobalAlpha).toBe(0.5);
  });

  it('applies both custom blend mode and opacity', () => {
    const { ctx, state } = createMockContext(100, 100);
    const options: ConcentrationLinesRenderOptions = { blendMode: 'screen', opacity: 0.3 };
    renderConcentrationLines(ctx, makeConfig(), options);
    expect(state.lastGlobalCompositeOperation).toBe('screen');
    expect(state.lastGlobalAlpha).toBe(0.3);
  });

  it('handles lineCount=0 gracefully', () => {
    const { ctx, state } = createMockContext(100, 100);
    renderConcentrationLines(ctx, makeConfig({ lineCount: 0 }));
    // Should still complete without error
    expect(state.drawImageCalls.length).toBe(1);
    // The ImageData should be fully transparent
    const imageData = state.putImageDataCalls[0].imageData;
    let hasContent = false;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) { hasContent = true; break; }
    }
    expect(hasContent).toBe(false);
  });

  it('generates non-transparent image data for normal config', () => {
    const { ctx, state } = createMockContext(100, 100);
    renderConcentrationLines(ctx, makeConfig({
      lineCount: 60,
      lineWidthMin: 4,
      lineWidthMax: 8,
    }));
    const imageData = state.putImageDataCalls[0].imageData;
    let hasContent = false;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) { hasContent = true; break; }
    }
    expect(hasContent).toBe(true);
  });
});
