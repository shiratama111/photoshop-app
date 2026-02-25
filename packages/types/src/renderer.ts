/**
 * @module renderer
 * Renderer and Viewport types for canvas compositing and view management.
 */

import type { Point, Rect, Size } from './common';
import type { Document } from './document';

/**
 * Viewport manages the view transform (zoom/pan) between
 * screen coordinates and document coordinates.
 */
export interface Viewport {
  /** Current zoom level (0.01 to 64). */
  readonly zoom: number;
  /** Pan offset in screen pixels. */
  readonly offset: Point;
  /** Visible area in document coordinates. */
  readonly visibleArea: Rect;

  /** Set the zoom level, optionally anchored to a screen point. */
  setZoom(zoom: number, anchor?: Point): void;
  /** Set the pan offset. */
  setOffset(offset: Point): void;
  /** Convert a screen-space point to document-space. */
  screenToDocument(screenPoint: Point): Point;
  /** Convert a document-space point to screen-space. */
  documentToScreen(docPoint: Point): Point;
  /** Fit the entire document within the viewport. */
  fitToWindow(viewportSize: Size, documentSize: Size): void;
  /** Set zoom to 100% (1:1 pixel mapping). */
  zoomToActual(viewportSize: Size, documentSize: Size): void;
}

/** Options for rendering a document to a canvas. */
export interface RenderOptions {
  /** Viewport transform to apply. */
  viewport: Viewport;
  /** Whether to render layer effects. */
  renderEffects: boolean;
  /** Whether to show the selection outline (marching ants). */
  showSelection: boolean;
  /** Whether to render guides and grid. */
  showGuides: boolean;
  /** Background pattern for transparent areas ('checkerboard' or solid color). */
  background: 'checkerboard' | 'white' | 'black' | 'transparent';
  /** Document dimensions for artboard/pasteboard rendering. */
  documentSize?: { width: number; height: number };
  /** Layer IDs that should be skipped during this render pass. */
  hiddenLayerIds?: string[];
}

/** Renderer interface for compositing layers onto a canvas. */
export interface Renderer {
  /**
   * Render the full document to the target canvas.
   * @param document - The document to render.
   * @param canvas - The target HTML canvas element.
   * @param options - Rendering options.
   */
  render(document: Document, canvas: HTMLCanvasElement, options: RenderOptions): void;

  /**
   * Render a single layer to an offscreen canvas (for thumbnails).
   * @param document - The document context.
   * @param layerId - ID of the layer to render.
   * @param size - Target thumbnail size.
   * @returns An offscreen canvas with the rendered layer, or null if the layer is not found.
   */
  renderLayerThumbnail(
    document: Document,
    layerId: string,
    size: Size,
  ): HTMLCanvasElement | null;

  /** Release any GPU resources held by the renderer. */
  dispose(): void;
}
