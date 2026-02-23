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

// WebGL Compositor — RENDER-003
export { WebGLRenderer } from './webgl-compositor';
export { TexturePool } from './texture-pool';
export type { RenderTarget } from './texture-pool';
export { BLEND_MODE_MAP } from './shaders';
