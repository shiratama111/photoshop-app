/**
 * @photoshop-app/render
 *
 * Canvas rendering, compositing, and viewport management.
 *
 * @packageDocumentation
 */

// Viewport — RENDER-002
export { ViewportImpl } from './viewport';

// Compositor — RENDER-001
export { Canvas2DRenderer } from './compositor';
export { CanvasPool } from './canvas-pool';
export type { CanvasLike, CanvasContext2DLike, CanvasFactory } from './canvas-pool';
