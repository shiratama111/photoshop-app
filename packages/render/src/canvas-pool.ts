/**
 * @module canvas-pool
 * Reusable canvas pool for off-screen compositing.
 *
 * Creating and destroying canvas elements is expensive.
 * This pool recycles them to minimize GC pressure during rendering.
 *
 * In Node.js test environment, provides a mock canvas implementation
 * that records operations for testing.
 */

/** Canvas-like interface that works in both browser and test environments. */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasContext2DLike | null;
}

/** Minimal 2D context interface for compositing. */
export interface CanvasContext2DLike {
  canvas: CanvasLike;
  globalAlpha: number;
  globalCompositeOperation: string;
  filter: string;
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(source: CanvasLike | ImageData, dx: number, dy: number): void;
  drawImage(source: CanvasLike | ImageData, dx: number, dy: number, dw: number, dh: number): void;
  putImageData(imageData: ImageData, dx: number, dy: number): void;
  translate(x: number, y: number): void;
  scale(sx: number, sy: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillStyle: string;
  createPattern(image: CanvasLike, repetition: string): unknown;
}

/** Factory function for creating canvas elements. */
export type CanvasFactory = (width: number, height: number) => CanvasLike;

/**
 * Default browser canvas factory using OffscreenCanvas (or DOM canvas fallback).
 */
export function createBrowserCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height) as unknown as CanvasLike;
  }
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  return el as unknown as CanvasLike;
}

/**
 * Canvas pool for reusing off-screen canvases.
 */
export class CanvasPool {
  private pool: CanvasLike[] = [];
  private factory: CanvasFactory;

  constructor(factory?: CanvasFactory) {
    this.factory = factory ?? createBrowserCanvas;
  }

  /** Acquire a canvas of at least the given dimensions. */
  acquire(width: number, height: number): CanvasLike {
    // Find a suitable canvas in the pool
    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[i];
      if (c.width >= width && c.height >= height) {
        this.pool.splice(i, 1);
        // Clear it
        const ctx = c.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, c.width, c.height);
        return c;
      }
    }
    // Create new
    return this.factory(width, height);
  }

  /** Return a canvas to the pool for reuse. */
  release(canvas: CanvasLike): void {
    // Limit pool size
    if (this.pool.length < 16) {
      this.pool.push(canvas);
    }
  }

  /** Clear all pooled canvases. */
  dispose(): void {
    this.pool.length = 0;
  }
}
