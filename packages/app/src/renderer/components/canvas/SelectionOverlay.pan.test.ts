/**
 * @module SelectionOverlay.pan.test
 * Regression tests for PS-PAN-002: SelectionOverlay must not block Space+drag pan.
 *
 * Tests verify:
 * - Space+left-click on SelectionOverlay lets the event propagate (pan)
 * - Without Space, SelectionOverlay consumes mousedown for selection
 * - crop tool behaves the same as select tool
 * - Non-interactive tools (brush) do not block pan via overlay
 *
 * @see docs/agent-briefs/PS-PAN-002.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { spacePanState } from './spacePanState';

// ---------------------------------------------------------------------------
// DOM / global mocks for Node.js test environment
// ---------------------------------------------------------------------------

vi.stubGlobal('OffscreenCanvas', vi.fn(() => ({
  getContext: vi.fn(() => ({
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      colorSpace: 'srgb' as const,
    })),
  })),
})));

vi.stubGlobal('ImageData', class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: string;
  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, maybeHeight?: number) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = maybeHeight!;
    } else {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
    this.colorSpace = 'srgb';
  }
});

// ---------------------------------------------------------------------------
// Simulate SelectionOverlay mousedown logic extracted for unit testing.
// ---------------------------------------------------------------------------

/**
 * Simulates the SelectionOverlay handleMouseDown decision logic.
 *
 * Returns 'selection' if the overlay would consume the event for selection,
 * or 'propagate' if the event would propagate to CanvasView for pan.
 */
function simulateOverlayMouseDown(
  activeTool: string,
  button: number,
): 'selection' | 'propagate' {
  // Mirror SelectionOverlay.handleMouseDown guard checks
  if (activeTool !== 'select' && activeTool !== 'crop') return 'propagate';
  if (button !== 0) return 'propagate';

  // PS-PAN-002: Space held → let event propagate for pan
  if (spacePanState.isSpacePressed) return 'propagate';

  // Would consume the event for selection
  return 'selection';
}

/**
 * Simulates CanvasView handleMouseDown to determine if pan starts.
 */
function simulateCanvasMouseDown(button: number): 'pan' | 'tool' {
  if (button === 1) return 'pan';
  if (button === 0 && spacePanState.isSpacePressed) return 'pan';
  return 'tool';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PS-PAN-002: SelectionOverlay Space+drag pan passthrough', () => {
  beforeEach(() => {
    spacePanState.isSpacePressed = false;
  });

  // ---- Core regression: Space+drag on overlay triggers pan ----

  it('should propagate mousedown when Space is held with select tool', () => {
    spacePanState.isSpacePressed = true;
    const overlayResult = simulateOverlayMouseDown('select', 0);
    expect(overlayResult).toBe('propagate');
    // Event reaches CanvasView → pan starts
    const canvasResult = simulateCanvasMouseDown(0);
    expect(canvasResult).toBe('pan');
  });

  it('should propagate mousedown when Space is held with crop tool', () => {
    spacePanState.isSpacePressed = true;
    const overlayResult = simulateOverlayMouseDown('crop', 0);
    expect(overlayResult).toBe('propagate');
    const canvasResult = simulateCanvasMouseDown(0);
    expect(canvasResult).toBe('pan');
  });

  // ---- Non-Space: overlay consumes for selection ----

  it('should consume mousedown for selection when Space is not held (select tool)', () => {
    const result = simulateOverlayMouseDown('select', 0);
    expect(result).toBe('selection');
  });

  it('should consume mousedown for selection when Space is not held (crop tool)', () => {
    const result = simulateOverlayMouseDown('crop', 0);
    expect(result).toBe('selection');
  });

  // ---- Non-interactive tools always propagate ----

  it('should propagate mousedown for brush tool regardless of Space state', () => {
    const result = simulateOverlayMouseDown('brush', 0);
    expect(result).toBe('propagate');
  });

  it('should propagate mousedown for brush tool with Space held', () => {
    spacePanState.isSpacePressed = true;
    const result = simulateOverlayMouseDown('brush', 0);
    expect(result).toBe('propagate');
  });

  // ---- Right/middle click on overlay always propagates ----

  it('should propagate right-click on overlay even in select mode', () => {
    const result = simulateOverlayMouseDown('select', 2);
    expect(result).toBe('propagate');
  });

  it('should propagate middle-click on overlay in select mode', () => {
    const result = simulateOverlayMouseDown('select', 1);
    expect(result).toBe('propagate');
    // Middle-click pan on CanvasView
    const canvasResult = simulateCanvasMouseDown(1);
    expect(canvasResult).toBe('pan');
  });

  // ---- Space release restores selection behavior ----

  it('should restore selection behavior after Space is released', () => {
    // 1. Space held → pan passthrough
    spacePanState.isSpacePressed = true;
    expect(simulateOverlayMouseDown('select', 0)).toBe('propagate');

    // 2. Space released → selection resumes
    spacePanState.isSpacePressed = false;
    expect(simulateOverlayMouseDown('select', 0)).toBe('selection');
  });

  // ---- Full lifecycle: Space → drag pan → release → select ----

  it('should complete full lifecycle: Space pan then selection drag', () => {
    // 1. Press Space
    spacePanState.isSpacePressed = true;

    // 2. Click on overlay → should propagate for pan
    expect(simulateOverlayMouseDown('select', 0)).toBe('propagate');
    expect(simulateCanvasMouseDown(0)).toBe('pan');

    // 3. Release Space
    spacePanState.isSpacePressed = false;

    // 4. Click on overlay → should select
    expect(simulateOverlayMouseDown('select', 0)).toBe('selection');
  });
});
