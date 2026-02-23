/**
 * @module viewport
 * Viewport implementation for zoom/pan and coordinate transformation.
 *
 * Manages the mapping between screen space (pixels on the display)
 * and document space (pixels in the image). Supports zoom (0.01–64),
 * pan offset, anchor-based zooming, and fit/actual-size helpers.
 *
 * @see {@link @photoshop-app/types!Viewport} for the interface contract.
 */

import type { Point, Rect, Size, Viewport } from '@photoshop-app/types';

/** Minimum allowed zoom level. */
const MIN_ZOOM = 0.01;
/** Maximum allowed zoom level. */
const MAX_ZOOM = 64;

/**
 * Clamp a number between min and max (inclusive).
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Concrete implementation of the Viewport interface.
 *
 * Coordinate system:
 * - Document space: origin at top-left of the image, 1 unit = 1 image pixel.
 * - Screen space: origin at top-left of the viewport element, 1 unit = 1 CSS pixel.
 *
 * Transform: screenPoint = docPoint * zoom + offset
 * Inverse:   docPoint   = (screenPoint - offset) / zoom
 */
export class ViewportImpl implements Viewport {
  private _zoom: number;
  private _offset: Point;
  private _viewportSize: Size;

  constructor(viewportSize: Size = { width: 800, height: 600 }) {
    this._zoom = 1;
    this._offset = { x: 0, y: 0 };
    this._viewportSize = { ...viewportSize };
  }

  /** Current zoom level (0.01 to 64). */
  get zoom(): number {
    return this._zoom;
  }

  /** Pan offset in screen pixels. */
  get offset(): Point {
    return { ...this._offset };
  }

  /** Visible area in document coordinates. */
  get visibleArea(): Rect {
    const topLeft = this.screenToDocument({ x: 0, y: 0 });
    const bottomRight = this.screenToDocument({
      x: this._viewportSize.width,
      y: this._viewportSize.height,
    });
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  /**
   * Set the zoom level, optionally anchored to a screen point.
   * When an anchor is provided, that point remains fixed on screen
   * after the zoom change (i.e. the user zooms toward/away from that point).
   */
  setZoom(zoom: number, anchor?: Point): void {
    const newZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    if (anchor) {
      // The document point under the anchor must stay under the anchor.
      // docPt = (anchor - offset) / oldZoom
      // anchor = docPt * newZoom + newOffset
      // newOffset = anchor - docPt * newZoom
      const docPt = this.screenToDocument(anchor);
      this._zoom = newZoom;
      this._offset = {
        x: anchor.x - docPt.x * newZoom,
        y: anchor.y - docPt.y * newZoom,
      };
    } else {
      this._zoom = newZoom;
    }
  }

  /** Set the pan offset in screen pixels. */
  setOffset(offset: Point): void {
    this._offset = { ...offset };
  }

  /** Update the viewport size (e.g. when the window resizes). */
  setViewportSize(size: Size): void {
    this._viewportSize = { ...size };
  }

  /** Convert a screen-space point to document-space. */
  screenToDocument(screenPoint: Point): Point {
    return {
      x: (screenPoint.x - this._offset.x) / this._zoom,
      y: (screenPoint.y - this._offset.y) / this._zoom,
    };
  }

  /** Convert a document-space point to screen-space. */
  documentToScreen(docPoint: Point): Point {
    return {
      x: docPoint.x * this._zoom + this._offset.x,
      y: docPoint.y * this._zoom + this._offset.y,
    };
  }

  /** Fit the entire document within the viewport, centered. */
  fitToWindow(viewportSize: Size, documentSize: Size): void {
    this._viewportSize = { ...viewportSize };
    const scaleX = viewportSize.width / documentSize.width;
    const scaleY = viewportSize.height / documentSize.height;
    const newZoom = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, MAX_ZOOM);
    this._zoom = newZoom;
    // Center the document
    this._offset = {
      x: (viewportSize.width - documentSize.width * newZoom) / 2,
      y: (viewportSize.height - documentSize.height * newZoom) / 2,
    };
  }

  /** Set zoom to 100% (1:1 pixel mapping), centered in the viewport. */
  zoomToActual(viewportSize: Size, documentSize: Size): void {
    this._viewportSize = { ...viewportSize };
    this._zoom = 1;
    this._offset = {
      x: (viewportSize.width - documentSize.width) / 2,
      y: (viewportSize.height - documentSize.height) / 2,
    };
  }
}
