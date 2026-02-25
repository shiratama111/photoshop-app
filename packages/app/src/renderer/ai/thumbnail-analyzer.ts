/**
 * @module ai/thumbnail-analyzer
 * Thumbnail analysis engine that extracts structure from reference images.
 *
 * Combines color palette extraction, layout detection, and pixel-level effect
 * estimation to produce a comprehensive analysis of a thumbnail image.
 * Enables "make a thumbnail like this one" workflows.
 *
 * Pipeline:
 * 1. Extract color palette via median-cut quantization
 * 2. Detect layout regions (text/image/background) via edge + variance analysis
 * 3. Estimate visual effects (stroke, shadow, glow) from pixel patterns around text regions
 * 4. Generate a natural language style description using the style analyzer
 *
 * @see ANALYZE-001: Thumbnail Analysis Engine
 * @see {@link ./color-palette.ts} — color extraction
 * @see {@link ../editor-actions/style-analyzer.ts} — describeEffects for style description
 * @see {@link ../../../../packages/ai/src/layout-detector.ts} — layout detection
 * @see {@link ./design-schema.ts} — ThumbnailDesign types (target output format)
 */

import type { LayerEffect, StrokeEffect, DropShadowEffect, OuterGlowEffect } from '@photoshop-app/types';
import { extractColorPalette } from './color-palette';
import type { ColorPalette } from './color-palette';
import { describeEffects } from '../editor-actions/style-analyzer';
import { detectLayout } from '../../../../ai/src/layout-detector';
import type { LayoutRegion, RegionBounds } from '../../../../ai/src/layout-detector';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Estimated visual effect detected from pixel analysis. */
export interface EstimatedEffect {
  /** The generated layer effect parameters. */
  effect: LayerEffect;
  /** Confidence in the estimation (0-1). */
  confidence: number;
  /** Human-readable description of what was detected. */
  description: string;
}

/** Complete thumbnail analysis result. */
export interface ThumbnailAnalysis {
  /** Detected layout regions (text, image, background areas). */
  layout: LayoutRegion[];
  /** Detected text regions with approximate positions. */
  texts: TextRegionInfo[];
  /** Extracted color palette with role classification. */
  palette: ColorPalette;
  /** Estimated visual effects (stroke, shadow, glow) from pixel analysis. */
  estimatedEffects: EstimatedEffect[];
  /** Natural language style description generated from detected effects. */
  styleDescription: string;
}

/** Information about a detected text region. */
export interface TextRegionInfo {
  /** Bounding box of the text region. */
  bounds: RegionBounds;
  /** Estimated position label (e.g. "top-left", "center", "bottom-right"). */
  position: string;
  /** Detection confidence (0-1). */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of pixels to sample around a text region boundary for effect detection.
 * Larger values are more robust but slower.
 */
const EDGE_SAMPLE_RADIUS = 8;

/** Minimum contrast ratio to consider an edge as a possible stroke boundary. */
const STROKE_CONTRAST_THRESHOLD = 40;

/** Minimum number of consistent edge pixels to confirm a stroke detection. */
const STROKE_MIN_EDGE_PIXELS = 5;

/** Distance offset (in pixels) to look for shadow patterns. */
const SHADOW_OFFSET = 4;

/** Darkness threshold (grayscale 0-255) below which pixels are considered "dark" for shadow detection. */
const SHADOW_DARKNESS_THRESHOLD = 80;

/** Minimum fraction of shadow-candidate pixels that must be dark to confirm a shadow. */
const SHADOW_MIN_DARK_FRACTION = 0.3;

/** Distance (in pixels) to look for glow patterns around text regions. */
const GLOW_SAMPLE_RADIUS = 12;

/** Brightness threshold (grayscale 0-255) above which pixels may indicate a glow. */
const GLOW_BRIGHTNESS_THRESHOLD = 180;

/** Minimum fraction of glow-candidate pixels that must be bright to confirm a glow. */
const GLOW_MIN_BRIGHT_FRACTION = 0.25;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a thumbnail image to extract its visual structure.
 *
 * @param imageData - The source thumbnail as ImageData (RGBA).
 * @returns A {@link ThumbnailAnalysis} with layout, colors, effects, and style description.
 *
 * @example
 * ```ts
 * const img = ctx.getImageData(0, 0, 1280, 720);
 * const analysis = analyzeThumbnail(img);
 * console.log(analysis.palette.dominant);
 * console.log(analysis.styleDescription);
 * ```
 */
export function analyzeThumbnail(imageData: ImageData): ThumbnailAnalysis {
  // Step 1: Extract color palette
  const palette = extractColorPalette(imageData);

  // Step 2: Detect layout regions
  const layout = detectLayout(imageData);

  // Step 3: Identify text regions and their positions
  const textRegions = layout.filter((r) => r.type === 'text');
  const texts = textRegions.map((r) => toTextRegionInfo(r, imageData.width, imageData.height));

  // Step 4: Estimate effects from pixel analysis around text regions
  const estimatedEffects = estimateEffects(imageData, textRegions);

  // Step 5: Generate style description
  const layerEffects = estimatedEffects.map((e) => e.effect);
  const textColor = palette.colors.find((c) => c.role === 'text');
  const textColorProps = textColor
    ? { color: { r: textColor.r, g: textColor.g, b: textColor.b, a: 1 } }
    : undefined;
  const styleDescription = describeEffects(layerEffects, textColorProps, 'ja');

  return {
    layout,
    texts,
    palette,
    estimatedEffects,
    styleDescription,
  };
}

/**
 * Estimate visual effects (stroke, shadow, glow) from pixel patterns around text regions.
 *
 * Examines pixels at the boundary of each text region to detect:
 * - Stroke/outline: consistent high-contrast edge pixels
 * - Drop shadow: offset dark pixels below/right of the region
 * - Outer glow: bright halo pixels around the region
 *
 * @param imageData - Source image data.
 * @param textRegions - Detected text-type layout regions.
 * @returns Array of estimated effects with confidence scores.
 */
export function estimateEffects(
  imageData: ImageData,
  textRegions: LayoutRegion[],
): EstimatedEffect[] {
  const effects: EstimatedEffect[] = [];

  if (textRegions.length === 0) return effects;

  // Analyze each text region and aggregate results
  const strokeDetections: StrokeDetection[] = [];
  const shadowDetections: boolean[] = [];
  const glowDetections: GlowDetection[] = [];

  for (const region of textRegions) {
    const stroke = detectStroke(imageData, region.bounds);
    if (stroke) strokeDetections.push(stroke);

    const hasShadow = detectShadow(imageData, region.bounds);
    shadowDetections.push(hasShadow);

    const glow = detectGlow(imageData, region.bounds);
    if (glow) glowDetections.push(glow);
  }

  // Stroke effect
  if (strokeDetections.length > 0) {
    // Use the most confident stroke detection
    const best = strokeDetections.reduce((a, b) => a.confidence > b.confidence ? a : b);
    const strokeEffect: StrokeEffect = {
      type: 'stroke',
      enabled: true,
      color: { r: best.color.r, g: best.color.g, b: best.color.b, a: 1 },
      size: best.estimatedSize,
      position: 'outside',
      opacity: 1,
    };
    effects.push({
      effect: strokeEffect,
      confidence: best.confidence,
      description: `Detected stroke/outline (~${best.estimatedSize}px)`,
    });
  }

  // Shadow effect
  const shadowCount = shadowDetections.filter(Boolean).length;
  if (shadowCount > 0) {
    const shadowConfidence = shadowCount / Math.max(1, textRegions.length);
    const shadowEffect: DropShadowEffect = {
      type: 'drop-shadow',
      enabled: true,
      color: { r: 0, g: 0, b: 0, a: 0.75 },
      opacity: 0.75,
      angle: 135,
      distance: SHADOW_OFFSET,
      blur: 6,
      spread: 0,
    };
    effects.push({
      effect: shadowEffect,
      confidence: Math.min(1, shadowConfidence),
      description: 'Detected drop shadow pattern',
    });
  }

  // Glow effect
  if (glowDetections.length > 0) {
    const best = glowDetections.reduce((a, b) => a.confidence > b.confidence ? a : b);
    const glowEffect: OuterGlowEffect = {
      type: 'outer-glow',
      enabled: true,
      color: { r: best.color.r, g: best.color.g, b: best.color.b, a: 1 },
      opacity: 0.6,
      size: GLOW_SAMPLE_RADIUS,
      spread: 0,
    };
    effects.push({
      effect: glowEffect,
      confidence: best.confidence,
      description: 'Detected outer glow effect',
    });
  }

  return effects;
}

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Result of stroke detection analysis. */
interface StrokeDetection {
  /** Estimated stroke color. */
  color: { r: number; g: number; b: number };
  /** Estimated stroke size in pixels. */
  estimatedSize: number;
  /** Detection confidence (0-1). */
  confidence: number;
}

/** Result of glow detection analysis. */
interface GlowDetection {
  /** Estimated glow color. */
  color: { r: number; g: number; b: number };
  /** Detection confidence (0-1). */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Internal: Text Region Info
// ---------------------------------------------------------------------------

/**
 * Convert a layout region to a text region info with position labels.
 *
 * @param region - The detected text-type layout region.
 * @param imageWidth - Total image width for position calculation.
 * @param imageHeight - Total image height for position calculation.
 * @returns A {@link TextRegionInfo} with position label.
 */
function toTextRegionInfo(
  region: LayoutRegion,
  imageWidth: number,
  imageHeight: number,
): TextRegionInfo {
  const centerX = region.bounds.x + region.bounds.w / 2;
  const centerY = region.bounds.y + region.bounds.h / 2;

  const hPos = centerX < imageWidth / 3 ? 'left' : centerX > (imageWidth * 2) / 3 ? 'right' : 'center';
  const vPos = centerY < imageHeight / 3 ? 'top' : centerY > (imageHeight * 2) / 3 ? 'bottom' : 'middle';

  const position = `${vPos}-${hPos}`;

  return {
    bounds: region.bounds,
    position,
    confidence: region.confidence,
  };
}

// ---------------------------------------------------------------------------
// Internal: Stroke Detection
// ---------------------------------------------------------------------------

/**
 * Detect stroke/outline patterns around a text region by sampling edge pixels.
 *
 * Looks at pixels just outside the bounding box. If there is a consistent
 * band of similar-colored pixels with high contrast against both the interior
 * and the exterior, it is likely a stroke/outline.
 *
 * @param imageData - Source image data.
 * @param bounds - Bounding box of the text region.
 * @returns Stroke detection result or undefined if no stroke detected.
 */
function detectStroke(
  imageData: ImageData,
  bounds: RegionBounds,
): StrokeDetection | undefined {
  const { data, width, height } = imageData;
  const edgePixels: Array<{ r: number; g: number; b: number }> = [];

  // Sample pixels at increasing distances outside the bounding box
  for (let dist = 1; dist <= EDGE_SAMPLE_RADIUS; dist++) {
    // Top edge
    const topY = bounds.y - dist;
    if (topY >= 0) {
      for (let x = bounds.x; x < bounds.x + bounds.w; x += 4) {
        if (x >= 0 && x < width) {
          const offset = (topY * width + x) * 4;
          edgePixels.push({ r: data[offset], g: data[offset + 1], b: data[offset + 2] });
        }
      }
    }

    // Bottom edge
    const botY = bounds.y + bounds.h + dist;
    if (botY < height) {
      for (let x = bounds.x; x < bounds.x + bounds.w; x += 4) {
        if (x >= 0 && x < width) {
          const offset = (botY * width + x) * 4;
          edgePixels.push({ r: data[offset], g: data[offset + 1], b: data[offset + 2] });
        }
      }
    }

    // Left edge
    const leftX = bounds.x - dist;
    if (leftX >= 0) {
      for (let y = bounds.y; y < bounds.y + bounds.h; y += 4) {
        if (y >= 0 && y < height) {
          const offset = (y * width + leftX) * 4;
          edgePixels.push({ r: data[offset], g: data[offset + 1], b: data[offset + 2] });
        }
      }
    }

    // Right edge
    const rightX = bounds.x + bounds.w + dist;
    if (rightX < width) {
      for (let y = bounds.y; y < bounds.y + bounds.h; y += 4) {
        if (y >= 0 && y < height) {
          const offset = (y * width + rightX) * 4;
          edgePixels.push({ r: data[offset], g: data[offset + 1], b: data[offset + 2] });
        }
      }
    }
  }

  if (edgePixels.length < STROKE_MIN_EDGE_PIXELS) return undefined;

  // Sample interior pixel (center of region) for contrast comparison
  const intX = Math.min(Math.max(0, Math.floor(bounds.x + bounds.w / 2)), width - 1);
  const intY = Math.min(Math.max(0, Math.floor(bounds.y + bounds.h / 2)), height - 1);
  const intOffset = (intY * width + intX) * 4;
  const interiorGray = 0.299 * data[intOffset] + 0.587 * data[intOffset + 1] + 0.114 * data[intOffset + 2];

  // Check if edge pixels form a consistent color band with contrast
  let consistentCount = 0;
  let rSum = 0, gSum = 0, bSum = 0;

  for (const px of edgePixels) {
    const edgeGray = 0.299 * px.r + 0.587 * px.g + 0.114 * px.b;
    if (Math.abs(edgeGray - interiorGray) >= STROKE_CONTRAST_THRESHOLD) {
      consistentCount++;
      rSum += px.r;
      gSum += px.g;
      bSum += px.b;
    }
  }

  const ratio = consistentCount / edgePixels.length;
  if (ratio < 0.3 || consistentCount < STROKE_MIN_EDGE_PIXELS) return undefined;

  const avgColor = {
    r: Math.round(rSum / consistentCount),
    g: Math.round(gSum / consistentCount),
    b: Math.round(bSum / consistentCount),
  };

  // Estimate stroke size by how many distance bands have consistent color
  let estimatedSize = 2;
  for (let dist = 1; dist <= EDGE_SAMPLE_RADIUS; dist++) {
    // Check if the color at this distance is still similar to the average
    const sampleY = bounds.y - dist;
    const sampleX = Math.min(Math.max(0, Math.floor(bounds.x + bounds.w / 2)), width - 1);
    if (sampleY >= 0) {
      const offset = (sampleY * width + sampleX) * 4;
      const sGray = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      const avgGray = 0.299 * avgColor.r + 0.587 * avgColor.g + 0.114 * avgColor.b;
      if (Math.abs(sGray - avgGray) < STROKE_CONTRAST_THRESHOLD) {
        estimatedSize = dist;
      } else {
        break;
      }
    }
  }

  return {
    color: avgColor,
    estimatedSize: Math.max(1, estimatedSize),
    confidence: Math.min(1, ratio * 1.2),
  };
}

// ---------------------------------------------------------------------------
// Internal: Shadow Detection
// ---------------------------------------------------------------------------

/**
 * Detect drop shadow patterns by looking for dark pixels offset from the text region.
 *
 * Checks below-right of the bounding box (typical shadow direction at 135 degrees).
 *
 * @param imageData - Source image data.
 * @param bounds - Bounding box of the text region.
 * @returns True if a shadow pattern is detected.
 */
function detectShadow(imageData: ImageData, bounds: RegionBounds): boolean {
  const { data, width, height } = imageData;

  // Sample pixels offset below-right of the bounding box
  const offsetX = SHADOW_OFFSET;
  const offsetY = SHADOW_OFFSET;
  let darkCount = 0;
  let totalSamples = 0;

  // Sample along the bottom edge, shifted down+right
  for (let x = bounds.x; x < bounds.x + bounds.w; x += 3) {
    const sy = bounds.y + bounds.h + offsetY;
    const sx = x + offsetX;
    if (sy >= height || sx >= width || sx < 0) continue;

    const offset = (sy * width + sx) * 4;
    const gray = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    totalSamples++;
    if (gray < SHADOW_DARKNESS_THRESHOLD) darkCount++;
  }

  // Sample along the right edge, shifted down+right
  for (let y = bounds.y; y < bounds.y + bounds.h; y += 3) {
    const sy = y + offsetY;
    const sx = bounds.x + bounds.w + offsetX;
    if (sy >= height || sx >= width) continue;

    const offset = (sy * width + sx) * 4;
    const gray = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    totalSamples++;
    if (gray < SHADOW_DARKNESS_THRESHOLD) darkCount++;
  }

  if (totalSamples === 0) return false;
  return darkCount / totalSamples >= SHADOW_MIN_DARK_FRACTION;
}

// ---------------------------------------------------------------------------
// Internal: Glow Detection
// ---------------------------------------------------------------------------

/**
 * Detect outer glow patterns by looking for a bright halo around the text region.
 *
 * @param imageData - Source image data.
 * @param bounds - Bounding box of the text region.
 * @returns Glow detection result or undefined if no glow detected.
 */
function detectGlow(
  imageData: ImageData,
  bounds: RegionBounds,
): GlowDetection | undefined {
  const { data, width, height } = imageData;
  let brightCount = 0;
  let totalSamples = 0;
  let rSum = 0, gSum = 0, bSum = 0;

  // Sample pixels in a ring at GLOW_SAMPLE_RADIUS distance from the bounding box
  for (let dist = EDGE_SAMPLE_RADIUS + 1; dist <= GLOW_SAMPLE_RADIUS; dist++) {
    // Top row
    const topY = bounds.y - dist;
    if (topY >= 0) {
      for (let x = bounds.x - dist; x <= bounds.x + bounds.w + dist; x += 3) {
        if (x >= 0 && x < width) {
          const offset = (topY * width + x) * 4;
          const gray = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
          totalSamples++;
          if (gray > GLOW_BRIGHTNESS_THRESHOLD) {
            brightCount++;
            rSum += data[offset];
            gSum += data[offset + 1];
            bSum += data[offset + 2];
          }
        }
      }
    }

    // Bottom row
    const botY = bounds.y + bounds.h + dist;
    if (botY < height) {
      for (let x = bounds.x - dist; x <= bounds.x + bounds.w + dist; x += 3) {
        if (x >= 0 && x < width) {
          const offset = (botY * width + x) * 4;
          const gray = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
          totalSamples++;
          if (gray > GLOW_BRIGHTNESS_THRESHOLD) {
            brightCount++;
            rSum += data[offset];
            gSum += data[offset + 1];
            bSum += data[offset + 2];
          }
        }
      }
    }
  }

  if (totalSamples === 0 || brightCount === 0) return undefined;

  const brightFraction = brightCount / totalSamples;
  if (brightFraction < GLOW_MIN_BRIGHT_FRACTION) return undefined;

  return {
    color: {
      r: Math.round(rSum / brightCount),
      g: Math.round(gSum / brightCount),
      b: Math.round(bSum / brightCount),
    },
    confidence: Math.min(1, brightFraction * 1.5),
  };
}
