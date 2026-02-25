/**
 * @module clone-stamp
 * Clone stamp tool engine for the Photoshop-like app.
 *
 * The clone stamp copies pixels from a source region to a destination region,
 * painting them with a configurable brush (size, hardness, opacity).
 *
 * Usage:
 * 1. Set the source point with createCloneSession().
 * 2. For each mouse move, call cloneStamp() with the current destination point.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A clone stamp session that tracks source/destination offsets. */
export interface CloneSession {
  /** Source layer image data (read-only reference). */
  sourceData: ImageData;
  /** Offset from destination to source in X. */
  offsetX: number;
  /** Offset from destination to source in Y. */
  offsetY: number;
  /** Whether the offset has been established. */
  offsetSet: boolean;
}

/** Brush parameters for the clone stamp. */
export interface CloneBrushParams {
  /** Brush diameter in pixels. */
  size: number;
  /** Brush hardness (0 = soft, 1 = hard). */
  hardness: number;
  /** Brush opacity (0 = transparent, 1 = opaque). */
  opacity: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Calculate brush alpha for a pixel at distance d from center,
 * given brush radius and hardness.
 */
function brushAlpha(d: number, radius: number, hardness: number): number {
  if (d >= radius) return 0;
  if (hardness >= 1) return 1;

  const hardRadius = radius * hardness;
  if (d <= hardRadius) return 1;

  // Linear falloff from hardRadius to radius
  return 1 - (d - hardRadius) / (radius - hardRadius);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Create a new clone stamp session.
 *
 * @param sourceData - The image data to clone FROM.
 * @param sourceX - The X coordinate of the source point (where Alt+Click happened).
 * @param sourceY - The Y coordinate of the source point.
 * @param destX - The X coordinate of the first paint destination.
 * @param destY - The Y coordinate of the first paint destination.
 * @returns A CloneSession object to pass to subsequent cloneStamp() calls.
 */
export function createCloneSession(
  sourceData: ImageData,
  sourceX: number,
  sourceY: number,
  destX: number,
  destY: number,
): CloneSession {
  return {
    sourceData,
    offsetX: sourceX - destX,
    offsetY: sourceY - destY,
    offsetSet: true,
  };
}

/**
 * Apply a single clone stamp dab at the given destination point.
 *
 * Copies pixels from the source (offset by session.offset) to the destination,
 * blended using the brush parameters.
 *
 * @param destData - The destination image data (modified in place).
 * @param session - The active clone session.
 * @param destX - Center X of the destination dab.
 * @param destY - Center Y of the destination dab.
 * @param brush - Brush parameters (size, hardness, opacity).
 */
export function cloneStamp(
  destData: ImageData,
  session: CloneSession,
  destX: number,
  destY: number,
  brush: CloneBrushParams,
): void {
  const { sourceData, offsetX, offsetY } = session;
  const { width: dw, height: dh, data: dd } = destData;
  const { width: sw, height: sh, data: sd } = sourceData;

  const radius = brush.size / 2;
  const r = Math.ceil(radius);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = brushAlpha(dist, radius, brush.hardness) * brush.opacity;
      if (alpha <= 0) continue;

      const px = Math.round(destX + dx);
      const py = Math.round(destY + dy);

      // Destination bounds check
      if (px < 0 || px >= dw || py < 0 || py >= dh) continue;

      // Source coordinates
      const sx = Math.round(px + offsetX);
      const sy = Math.round(py + offsetY);

      // Source bounds check
      if (sx < 0 || sx >= sw || sy < 0 || sy >= sh) continue;

      const srcIdx = (sy * sw + sx) * 4;
      const dstIdx = (py * dw + px) * 4;

      // Source pixel
      const sr = sd[srcIdx];
      const sg = sd[srcIdx + 1];
      const sb = sd[srcIdx + 2];
      const sa = sd[srcIdx + 3] / 255;

      // Effective alpha
      const effectiveAlpha = sa * alpha;
      if (effectiveAlpha <= 0) continue;

      // Alpha-over compositing
      const dstA = dd[dstIdx + 3] / 255;
      const outA = effectiveAlpha + dstA * (1 - effectiveAlpha);

      if (outA > 0) {
        dd[dstIdx] = clamp(
          Math.round((sr * effectiveAlpha + dd[dstIdx] * dstA * (1 - effectiveAlpha)) / outA),
          0, 255,
        );
        dd[dstIdx + 1] = clamp(
          Math.round((sg * effectiveAlpha + dd[dstIdx + 1] * dstA * (1 - effectiveAlpha)) / outA),
          0, 255,
        );
        dd[dstIdx + 2] = clamp(
          Math.round((sb * effectiveAlpha + dd[dstIdx + 2] * dstA * (1 - effectiveAlpha)) / outA),
          0, 255,
        );
        dd[dstIdx + 3] = clamp(Math.round(outA * 255), 0, 255);
      }
    }
  }
}

/**
 * Apply clone stamp along a stroke path (array of points).
 * Interpolates between points to ensure continuous coverage.
 *
 * @param destData - The destination image data (modified in place).
 * @param session - The active clone session.
 * @param points - Array of {x, y} destination points along the stroke.
 * @param brush - Brush parameters.
 * @param spacing - Spacing between dabs as a fraction of brush size (default 0.25).
 */
export function cloneStampStroke(
  destData: ImageData,
  session: CloneSession,
  points: Array<{ x: number; y: number }>,
  brush: CloneBrushParams,
  spacing: number = 0.25,
): void {
  if (points.length === 0) return;

  const step = Math.max(1, brush.size * spacing);

  // Apply first point
  cloneStamp(destData, session, points[0].x, points[0].y, brush);

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < step) {
      cloneStamp(destData, session, curr.x, curr.y, brush);
      continue;
    }

    const steps = Math.ceil(dist / step);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = prev.x + dx * t;
      const y = prev.y + dy * t;
      cloneStamp(destData, session, x, y, brush);
    }
  }
}
