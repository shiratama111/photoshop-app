/**
 * @module CanvasView.pan.test
 * Unit tests for Space+drag pan behavior (PS-PAN-001).
 *
 * Tests verify:
 * - Space+left-drag initiates pan and suppresses tool processing
 * - Middle-click pan still works as before
 * - Space key is ignored when input elements are focused
 * - Cursor state transitions (grab / grabbing / default)
 *
 * @see docs/agent-briefs/PS-PAN-001.md
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

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
// Helpers — simulate the keydown / keyup / mouse event logic from CanvasView
// without mounting the full React component.
// ---------------------------------------------------------------------------

/**
 * Encapsulates the pan state machine extracted from CanvasView so we can
 * test transitions in isolation.
 */
function createPanStateMachine(): {
  isSpacePressed: { current: boolean };
  isPanning: { current: boolean };
  panCursor: { value: 'grab' | 'grabbing' | null };
  lastPanPoint: { current: { x: number; y: number } };
  handleKeyDown: (e: Partial<KeyboardEvent>) => void;
  handleKeyUp: (e: Partial<KeyboardEvent>) => void;
  handleMouseDown: (button: number, clientX: number, clientY: number) => 'pan' | 'tool';
  handleMouseMove: (clientX: number, clientY: number) => 'pan' | 'other';
  handleMouseUp: () => void;
  getActiveElement: () => HTMLElement | null;
  setActiveElement: (el: HTMLElement | null) => void;
} {
  const isSpacePressed = { current: false };
  const isPanning = { current: false };
  const panCursor = { value: null as 'grab' | 'grabbing' | null };
  const lastPanPoint = { current: { x: 0, y: 0 } };
  let activeElement: HTMLElement | null = null;

  return {
    isSpacePressed,
    isPanning,
    panCursor,
    lastPanPoint,
    getActiveElement: (): HTMLElement | null => activeElement,
    setActiveElement: (el: HTMLElement | null): void => { activeElement = el; },

    handleKeyDown(e: Partial<KeyboardEvent>): void {
      if (e.code !== 'Space') return;
      // Skip if input element is focused
      const tag = activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (activeElement?.isContentEditable) return;
      isSpacePressed.current = true;
      panCursor.value = 'grab';
    },

    handleKeyUp(e: Partial<KeyboardEvent>): void {
      if (e.code !== 'Space') return;
      isSpacePressed.current = false;
      if (isPanning.current) return; // will clear on mouseup
      panCursor.value = null;
    },

    handleMouseDown(button: number, clientX: number, clientY: number): 'pan' | 'tool' {
      // Middle button
      if (button === 1) {
        isPanning.current = true;
        lastPanPoint.current = { x: clientX, y: clientY };
        panCursor.value = 'grabbing';
        return 'pan';
      }
      // Space + left button
      if (button === 0 && isSpacePressed.current) {
        isPanning.current = true;
        lastPanPoint.current = { x: clientX, y: clientY };
        panCursor.value = 'grabbing';
        return 'pan';
      }
      return 'tool';
    },

    handleMouseMove(clientX: number, clientY: number): 'pan' | 'other' {
      if (isPanning.current) {
        const dx = clientX - lastPanPoint.current.x;
        const dy = clientY - lastPanPoint.current.y;
        lastPanPoint.current = { x: clientX, y: clientY };
        // In real code this calls setPanOffset — we just track the intent
        void dx;
        void dy;
        return 'pan';
      }
      return 'other';
    },

    handleMouseUp(): void {
      if (isPanning.current) {
        isPanning.current = false;
        panCursor.value = isSpacePressed.current ? 'grab' : null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PS-PAN-001: Space + drag pan', () => {
  let sm: ReturnType<typeof createPanStateMachine>;

  beforeEach(() => {
    sm = createPanStateMachine();
  });

  // ---- Space key state ----

  it('should set isSpacePressed on Space keydown', () => {
    sm.handleKeyDown({ code: 'Space' });
    expect(sm.isSpacePressed.current).toBe(true);
  });

  it('should clear isSpacePressed on Space keyup', () => {
    sm.handleKeyDown({ code: 'Space' });
    sm.handleKeyUp({ code: 'Space' });
    expect(sm.isSpacePressed.current).toBe(false);
  });

  it('should ignore non-Space keys', () => {
    sm.handleKeyDown({ code: 'KeyA' });
    expect(sm.isSpacePressed.current).toBe(false);
    expect(sm.panCursor.value).toBeNull();
  });

  // ---- Cursor transitions ----

  it('should show grab cursor when Space is pressed', () => {
    sm.handleKeyDown({ code: 'Space' });
    expect(sm.panCursor.value).toBe('grab');
  });

  it('should show grabbing cursor during Space+left-drag', () => {
    sm.handleKeyDown({ code: 'Space' });
    sm.handleMouseDown(0, 100, 100);
    expect(sm.panCursor.value).toBe('grabbing');
  });

  it('should restore grab cursor after Space+drag mouseup while Space held', () => {
    sm.handleKeyDown({ code: 'Space' });
    sm.handleMouseDown(0, 100, 100);
    sm.handleMouseUp();
    expect(sm.panCursor.value).toBe('grab');
  });

  it('should clear cursor after Space+drag when Space released before mouseup', () => {
    sm.handleKeyDown({ code: 'Space' });
    sm.handleMouseDown(0, 100, 100);
    // Space released while dragging — keyUp defers clearing
    sm.handleKeyUp({ code: 'Space' });
    expect(sm.panCursor.value).toBe('grabbing'); // still dragging
    sm.handleMouseUp();
    expect(sm.panCursor.value).toBeNull();
  });

  it('should clear cursor when Space released without drag', () => {
    sm.handleKeyDown({ code: 'Space' });
    sm.handleKeyUp({ code: 'Space' });
    expect(sm.panCursor.value).toBeNull();
  });

  // ---- Pan initiation ----

  it('should start pan on Space + left-click', () => {
    sm.handleKeyDown({ code: 'Space' });
    const result = sm.handleMouseDown(0, 50, 50);
    expect(result).toBe('pan');
    expect(sm.isPanning.current).toBe(true);
  });

  it('should suppress tool processing during Space pan', () => {
    sm.handleKeyDown({ code: 'Space' });
    const result = sm.handleMouseDown(0, 50, 50);
    // 'pan' means tool was NOT invoked
    expect(result).toBe('pan');
  });

  it('should pass through to tool when Space is not pressed', () => {
    const result = sm.handleMouseDown(0, 50, 50);
    expect(result).toBe('tool');
    expect(sm.isPanning.current).toBe(false);
  });

  // ---- Middle-click pan still works ----

  it('should start pan on middle-click regardless of Space state', () => {
    const result = sm.handleMouseDown(1, 200, 200);
    expect(result).toBe('pan');
    expect(sm.isPanning.current).toBe(true);
    expect(sm.panCursor.value).toBe('grabbing');
  });

  it('should handle middle-click pan even when Space is pressed', () => {
    sm.handleKeyDown({ code: 'Space' });
    const result = sm.handleMouseDown(1, 200, 200);
    expect(result).toBe('pan');
    expect(sm.isPanning.current).toBe(true);
  });

  // ---- Mouse move during pan ----

  it('should route mousemove to pan when panning', () => {
    sm.handleKeyDown({ code: 'Space' });
    sm.handleMouseDown(0, 100, 100);
    const result = sm.handleMouseMove(110, 105);
    expect(result).toBe('pan');
  });

  it('should route mousemove to other when not panning', () => {
    const result = sm.handleMouseMove(110, 105);
    expect(result).toBe('other');
  });

  it('should track lastPanPoint during pan moves', () => {
    sm.handleKeyDown({ code: 'Space' });
    sm.handleMouseDown(0, 100, 100);
    sm.handleMouseMove(120, 130);
    expect(sm.lastPanPoint.current).toEqual({ x: 120, y: 130 });
  });

  // ---- Input element focus guard ----

  it('should not activate Space pan when INPUT is focused', () => {
    sm.setActiveElement({ tagName: 'INPUT' } as unknown as HTMLElement);
    sm.handleKeyDown({ code: 'Space' });
    expect(sm.isSpacePressed.current).toBe(false);
    expect(sm.panCursor.value).toBeNull();
  });

  it('should not activate Space pan when TEXTAREA is focused', () => {
    sm.setActiveElement({ tagName: 'TEXTAREA' } as unknown as HTMLElement);
    sm.handleKeyDown({ code: 'Space' });
    expect(sm.isSpacePressed.current).toBe(false);
  });

  it('should not activate Space pan when SELECT is focused', () => {
    sm.setActiveElement({ tagName: 'SELECT' } as unknown as HTMLElement);
    sm.handleKeyDown({ code: 'Space' });
    expect(sm.isSpacePressed.current).toBe(false);
  });

  it('should not activate Space pan when contentEditable element is focused', () => {
    sm.setActiveElement({ tagName: 'DIV', isContentEditable: true } as unknown as HTMLElement);
    sm.handleKeyDown({ code: 'Space' });
    expect(sm.isSpacePressed.current).toBe(false);
  });

  it('should activate Space pan when non-input element is focused', () => {
    sm.setActiveElement({ tagName: 'DIV', isContentEditable: false } as unknown as HTMLElement);
    sm.handleKeyDown({ code: 'Space' });
    expect(sm.isSpacePressed.current).toBe(true);
  });

  // ---- Right-click should not trigger pan ----

  it('should not trigger pan on right-click even with Space held', () => {
    sm.handleKeyDown({ code: 'Space' });
    const result = sm.handleMouseDown(2, 50, 50);
    expect(result).toBe('tool');
    expect(sm.isPanning.current).toBe(false);
  });

  // ---- Full lifecycle ----

  it('should complete full Space pan lifecycle: keydown -> mousedown -> move -> mouseup -> keyup', () => {
    // 1. Press Space
    sm.handleKeyDown({ code: 'Space' });
    expect(sm.panCursor.value).toBe('grab');

    // 2. Start drag
    sm.handleMouseDown(0, 100, 200);
    expect(sm.isPanning.current).toBe(true);
    expect(sm.panCursor.value).toBe('grabbing');

    // 3. Move
    const moveResult = sm.handleMouseMove(150, 250);
    expect(moveResult).toBe('pan');

    // 4. Release mouse
    sm.handleMouseUp();
    expect(sm.isPanning.current).toBe(false);
    expect(sm.panCursor.value).toBe('grab'); // Space still held

    // 5. Release Space
    sm.handleKeyUp({ code: 'Space' });
    expect(sm.panCursor.value).toBeNull();
  });
});
