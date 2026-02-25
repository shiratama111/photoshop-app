/**
 * @module ai/style-transfer
 * Style transfer engine: converts a ThumbnailAnalysis into a ThumbnailDesign.
 *
 * Enables "make a thumbnail with the same style as this reference image"
 * workflows by mapping analyzed visual properties (layout, colors, effects)
 * into an executable design blueprint.
 *
 * Pipeline:
 * 1. analysisToDesign() — convert analysis structure into a design blueprint
 * 2. replaceText() — swap text content while preserving all style properties
 * 3. scoreSimilarity() — evaluate how closely a generated design matches the original
 *
 * @see TRANSFER-001: Style Transfer Engine
 * @see {@link ./thumbnail-analyzer.ts} — ThumbnailAnalysis type (input)
 * @see {@link ./color-palette.ts} — ColorPalette type (input)
 * @see {@link ./design-schema.ts} — ThumbnailDesign type (output)
 * @see {@link ./thumbnail-architect.ts} — designToActions (output conversion)
 */

import type { ThumbnailAnalysis, EstimatedEffect, TextRegionInfo } from './thumbnail-analyzer';
import type { ColorPalette, PaletteColor } from './color-palette';
import type {
  ThumbnailDesign,
  TextLayerDesign,
  ImageLayerDesign,
  LayerDesign,
  BackgroundDesign,
  CanvasSpec,
} from './design-schema';
import type { EditorAction } from '../editor-actions/types';
import type { LayoutRegion } from '../../../../ai/src/layout-detector';
import { designToActions } from './thumbnail-architect';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Options for the style transfer operation. */
export interface StyleTransferOptions {
  /** Source analysis from analyzeThumbnail(). */
  analysis: ThumbnailAnalysis;
  /** Replacement title text (if omitted, a placeholder is used). */
  newTitle?: string;
  /** Replacement subtitle text (if omitted, subtitle is skipped). */
  newSubtitle?: string;
  /** Target canvas dimensions (defaults to 1280x720). */
  targetCanvas?: { width: number; height: number };
  /** Optional partial color palette override. */
  colorOverride?: Partial<ColorPalette>;
}

/** Similarity score breakdown between an analysis and a generated design. */
export interface SimilarityScore {
  /** Overall weighted similarity (0-1). */
  overall: number;
  /** Layout position/size similarity (0-1). */
  layout: number;
  /** Color palette similarity (0-1). */
  color: number;
  /** Effect type similarity (0-1). */
  effects: number;
}

/** Result of the style transfer operation. */
export interface StyleTransferResult {
  /** The generated design blueprint. */
  design: ThumbnailDesign;
  /** Editor actions to execute the design. */
  actions: EditorAction[];
  /** Similarity score between the original analysis and the generated design. */
  similarity: SimilarityScore;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default canvas size when none is specified. */
const DEFAULT_CANVAS: CanvasSpec = { width: 1280, height: 720 };

/** Default font family for text layers. */
const DEFAULT_FONT_FAMILY = 'Noto Sans JP';

/** Default font size for title text (pixels). */
const DEFAULT_TITLE_FONT_SIZE = 72;

/** Default font size for subtitle text (pixels). */
const DEFAULT_SUBTITLE_FONT_SIZE = 36;

/** Minimum font size to prevent illegible text (pixels). */
const MIN_FONT_SIZE = 12;

/** Weights for the overall similarity score calculation. */
const SIMILARITY_WEIGHTS = {
  layout: 0.4,
  color: 0.35,
  effects: 0.25,
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transfer the visual style from a reference image analysis to a new thumbnail design.
 *
 * Takes a ThumbnailAnalysis (from analyzeThumbnail) and produces a ThumbnailDesign
 * with the same layout structure, color palette, and effects but with optionally
 * replaced text content and target canvas size.
 *
 * @param options - Style transfer options including the source analysis and overrides.
 * @returns A StyleTransferResult with the design, actions, and similarity score.
 *
 * @example
 * ```ts
 * const analysis = analyzeThumbnail(imageData);
 * const result = transferStyle({
 *   analysis,
 *   newTitle: 'New Headline',
 *   targetCanvas: { width: 1280, height: 720 },
 * });
 * // result.design is ready for designToActions()
 * // result.actions are ready for execution
 * ```
 */
export function transferStyle(options: StyleTransferOptions): StyleTransferResult {
  const canvas = options.targetCanvas ?? { ...DEFAULT_CANVAS };
  const palette = mergePalette(options.analysis.palette, options.colorOverride);

  // Build the base design from analysis
  let design = analysisToDesign(options.analysis, canvas, palette);

  // Replace text if requested
  if (options.newTitle !== undefined || options.newSubtitle !== undefined) {
    design = replaceText(design, options.newTitle, options.newSubtitle);
  }

  // Convert to editor actions
  const actions = designToActions(design);

  // Score similarity
  const similarity = scoreSimilarity(options.analysis, design);

  return { design, actions, similarity };
}

/**
 * Convert a ThumbnailAnalysis into a ThumbnailDesign blueprint.
 *
 * Maps the analysis structure into a concrete design:
 * - Background: gradient derived from the dominant palette color
 * - Text layers: created from detected text regions with estimated fonts/effects
 * - Image layers: created from detected image regions as placeholders
 * - Positions: preserved as relative ratios, then scaled to target canvas
 *
 * @param analysis - The source thumbnail analysis.
 * @param canvas - Target canvas dimensions (width, height).
 * @param palette - Color palette to use (defaults to analysis.palette).
 * @returns A fully populated ThumbnailDesign.
 *
 * @example
 * ```ts
 * const design = analysisToDesign(analysis, { width: 1280, height: 720 });
 * ```
 */
export function analysisToDesign(
  analysis: ThumbnailAnalysis,
  canvas: { width: number; height: number },
  palette?: ColorPalette,
): ThumbnailDesign {
  const effectivePalette = palette ?? analysis.palette;

  // Determine source canvas dimensions from layout region extents
  const sourceCanvas = inferSourceCanvas(analysis);

  // Build background from palette
  const background = paletteToBackground(effectivePalette);

  // Build layers
  const layers: LayerDesign[] = [];

  // Add image region layers first (bottom of stack)
  const imageRegions = analysis.layout.filter((r) => r.type === 'image');
  for (let i = 0; i < imageRegions.length; i++) {
    layers.push(regionToImageLayer(imageRegions[i], sourceCanvas, canvas, i));
  }

  // Add text region layers (on top of images)
  const textColor = findPaletteColorByRole(effectivePalette, 'text');
  const effectRecords = estimatedEffectsToRecords(analysis.estimatedEffects);

  for (let i = 0; i < analysis.texts.length; i++) {
    const textInfo = analysis.texts[i];
    const isTitle = i === 0;
    const layerName = isTitle ? 'Title' : `Subtitle ${i}`;
    const text = isTitle ? 'Title Text' : `Subtitle ${i}`;
    const fontSize = estimateFontSize(textInfo, sourceCanvas, canvas, isTitle);

    layers.push(
      textRegionToLayer(
        textInfo,
        sourceCanvas,
        canvas,
        textColor,
        effectRecords,
        layerName,
        text,
        fontSize,
        isTitle,
      ),
    );
  }

  // If no text regions found, create a default title layer
  if (analysis.texts.length === 0) {
    layers.push(createDefaultTitleLayer(canvas, textColor, effectRecords));
  }

  return {
    canvas: { width: canvas.width, height: canvas.height },
    background,
    layers,
    metadata: {
      category: 'style-transfer',
      mood: describeMood(effectivePalette),
      targetPlatform: 'youtube',
    },
  };
}

/**
 * Replace text content in a ThumbnailDesign while preserving all style properties.
 *
 * Finds text layers by name convention:
 * - Layers containing "title" (case-insensitive) and NOT "sub" are treated as title layers
 * - Layers containing "sub" are treated as subtitle layers
 *
 * Returns a new design object (does not mutate the input).
 *
 * @param design - The source ThumbnailDesign.
 * @param title - New title text (undefined = keep existing).
 * @param subtitle - New subtitle text (undefined = keep existing).
 * @returns A new ThumbnailDesign with updated text content.
 *
 * @example
 * ```ts
 * const updated = replaceText(design, 'New Title', 'New Subtitle');
 * ```
 */
export function replaceText(
  design: ThumbnailDesign,
  title?: string,
  subtitle?: string,
): ThumbnailDesign {
  const cloned: ThumbnailDesign = JSON.parse(JSON.stringify(design)) as ThumbnailDesign;

  for (const layer of cloned.layers) {
    if (layer.kind !== 'text') continue;
    const textLayer = layer as TextLayerDesign;
    const nameLower = textLayer.name.toLowerCase();

    if (title !== undefined && nameLower.includes('title') && !nameLower.includes('sub')) {
      textLayer.text = title;
    }
    if (subtitle !== undefined && nameLower.includes('sub')) {
      textLayer.text = subtitle;
    }
  }

  return cloned;
}

/**
 * Score the similarity between a source analysis and a generated design.
 *
 * Compares three dimensions:
 * - **Layout**: how closely the design layers match the analysis regions in position and size
 * - **Color**: Euclidean RGB distance between palette colors and design colors
 * - **Effects**: overlap of effect types between analysis and design layers
 *
 * @param original - The original ThumbnailAnalysis.
 * @param generated - The generated ThumbnailDesign.
 * @returns A SimilarityScore with overall, layout, color, and effects scores (0-1).
 *
 * @example
 * ```ts
 * const score = scoreSimilarity(analysis, design);
 * console.log(score.overall); // 0.85
 * ```
 */
export function scoreSimilarity(
  original: ThumbnailAnalysis,
  generated: ThumbnailDesign,
): SimilarityScore {
  const layoutScore = computeLayoutSimilarity(original, generated);
  const colorScore = computeColorSimilarity(original.palette, generated);
  const effectsScore = computeEffectSimilarity(original.estimatedEffects, generated);

  const overall =
    layoutScore * SIMILARITY_WEIGHTS.layout +
    colorScore * SIMILARITY_WEIGHTS.color +
    effectsScore * SIMILARITY_WEIGHTS.effects;

  return {
    overall: clampScore(overall),
    layout: clampScore(layoutScore),
    color: clampScore(colorScore),
    effects: clampScore(effectsScore),
  };
}

// ---------------------------------------------------------------------------
// Internal: Palette Helpers
// ---------------------------------------------------------------------------

/**
 * Merge a base palette with optional partial overrides.
 * @param base - The original color palette.
 * @param overrides - Optional partial overrides.
 * @returns A merged ColorPalette.
 */
function mergePalette(
  base: ColorPalette,
  overrides?: Partial<ColorPalette>,
): ColorPalette {
  if (!overrides) return base;

  return {
    dominant: overrides.dominant ?? base.dominant,
    colors: overrides.colors ?? base.colors,
    contrastRatio: overrides.contrastRatio ?? base.contrastRatio,
  };
}

/**
 * Find a palette color by its classified role.
 * Falls back to the dominant color if the requested role is not found.
 * @param palette - The color palette.
 * @param role - The role to search for ('background', 'accent', 'text').
 * @returns The matching PaletteColor.
 */
function findPaletteColorByRole(
  palette: ColorPalette,
  role: string,
): PaletteColor {
  return palette.colors.find((c) => c.role === role) ?? palette.dominant;
}

// ---------------------------------------------------------------------------
// Internal: Background Generation
// ---------------------------------------------------------------------------

/**
 * Convert a color palette into a gradient background design.
 * Uses the dominant color as the base with a slightly lighter variant for the second stop.
 * @param palette - Source color palette.
 * @returns A BackgroundDesign.
 */
function paletteToBackground(palette: ColorPalette): BackgroundDesign {
  const dom = palette.dominant;
  const accentColor = findPaletteColorByRole(palette, 'accent');

  return {
    type: 'gradient',
    gradientType: 'linear',
    angle: 135,
    stops: [
      { position: 0, color: { r: dom.r, g: dom.g, b: dom.b, a: 1 } },
      { position: 1, color: { r: accentColor.r, g: accentColor.g, b: accentColor.b, a: 1 } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Internal: Source Canvas Inference
// ---------------------------------------------------------------------------

/**
 * Infer the source canvas dimensions from layout region extents.
 * Returns the bounding box that contains all detected regions.
 * @param analysis - The thumbnail analysis.
 * @returns Inferred source dimensions.
 */
function inferSourceCanvas(analysis: ThumbnailAnalysis): { width: number; height: number } {
  let maxRight = 0;
  let maxBottom = 0;

  for (const region of analysis.layout) {
    const right = region.bounds.x + region.bounds.w;
    const bottom = region.bounds.y + region.bounds.h;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  for (const text of analysis.texts) {
    const right = text.bounds.x + text.bounds.w;
    const bottom = text.bounds.y + text.bounds.h;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  // Fallback to default if nothing detected
  return {
    width: maxRight > 0 ? maxRight : DEFAULT_CANVAS.width,
    height: maxBottom > 0 ? maxBottom : DEFAULT_CANVAS.height,
  };
}

// ---------------------------------------------------------------------------
// Internal: Region -> Layer Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a layout region to an ImageLayerDesign, scaling positions to the target canvas.
 * @param region - The source layout region.
 * @param source - Source canvas dimensions.
 * @param target - Target canvas dimensions.
 * @param index - Region index for naming.
 * @returns An ImageLayerDesign.
 */
function regionToImageLayer(
  region: LayoutRegion,
  source: { width: number; height: number },
  target: { width: number; height: number },
  index: number,
): ImageLayerDesign {
  const scaled = scaleBounds(region.bounds, source, target);
  return {
    kind: 'image',
    name: `Image Region ${index + 1}`,
    x: scaled.x,
    y: scaled.y,
    width: scaled.w,
    height: scaled.h,
    description: 'Image region detected from reference (add content manually)',
  };
}

/**
 * Convert a TextRegionInfo into a TextLayerDesign with style properties.
 * @param textInfo - The detected text region info.
 * @param source - Source canvas dimensions.
 * @param target - Target canvas dimensions.
 * @param textColor - Text color from the palette.
 * @param effects - Effect records to apply.
 * @param name - Layer name.
 * @param text - Default text content.
 * @param fontSize - Computed font size.
 * @param bold - Whether the text should be bold.
 * @returns A TextLayerDesign.
 */
function textRegionToLayer(
  textInfo: TextRegionInfo,
  source: { width: number; height: number },
  target: { width: number; height: number },
  textColor: PaletteColor,
  effects: ReadonlyArray<Record<string, unknown>>,
  name: string,
  text: string,
  fontSize: number,
  bold: boolean,
): TextLayerDesign {
  const scaled = scaleBounds(textInfo.bounds, source, target);
  return {
    kind: 'text',
    name,
    text,
    x: scaled.x,
    y: scaled.y,
    fontSize,
    fontFamily: DEFAULT_FONT_FAMILY,
    color: { r: textColor.r, g: textColor.g, b: textColor.b, a: 1 },
    bold,
    italic: false,
    alignment: inferAlignment(textInfo.position),
    effects,
  };
}

/**
 * Create a default title layer when no text regions are detected.
 * @param canvas - Target canvas dimensions.
 * @param textColor - Text color from the palette.
 * @param effects - Effect records to apply.
 * @returns A TextLayerDesign.
 */
function createDefaultTitleLayer(
  canvas: { width: number; height: number },
  textColor: PaletteColor,
  effects: ReadonlyArray<Record<string, unknown>>,
): TextLayerDesign {
  return {
    kind: 'text',
    name: 'Title',
    text: 'Title Text',
    x: Math.round(canvas.width * 0.1),
    y: Math.round(canvas.height * 0.35),
    fontSize: DEFAULT_TITLE_FONT_SIZE,
    fontFamily: DEFAULT_FONT_FAMILY,
    color: { r: textColor.r, g: textColor.g, b: textColor.b, a: 1 },
    bold: true,
    italic: false,
    alignment: 'center',
    effects,
  };
}

// ---------------------------------------------------------------------------
// Internal: Scaling and Positioning
// ---------------------------------------------------------------------------

/** Scaled bounding box result. */
interface ScaledBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Scale a bounding box from source canvas coordinates to target canvas coordinates.
 * Preserves relative position and proportions.
 * @param bounds - Original bounds.
 * @param source - Source canvas dimensions.
 * @param target - Target canvas dimensions.
 * @returns Scaled bounds.
 */
function scaleBounds(
  bounds: { x: number; y: number; w: number; h: number },
  source: { width: number; height: number },
  target: { width: number; height: number },
): ScaledBounds {
  const scaleX = source.width > 0 ? target.width / source.width : 1;
  const scaleY = source.height > 0 ? target.height / source.height : 1;
  return {
    x: Math.round(bounds.x * scaleX),
    y: Math.round(bounds.y * scaleY),
    w: Math.round(bounds.w * scaleX),
    h: Math.round(bounds.h * scaleY),
  };
}

/**
 * Estimate font size for a text region based on region height and canvas scaling.
 * @param textInfo - The text region info.
 * @param source - Source canvas dimensions.
 * @param target - Target canvas dimensions.
 * @param isTitle - Whether this is the primary title (uses larger default).
 * @returns Estimated font size in pixels.
 */
function estimateFontSize(
  textInfo: TextRegionInfo,
  source: { width: number; height: number },
  target: { width: number; height: number },
  isTitle: boolean,
): number {
  const scaleY = source.height > 0 ? target.height / source.height : 1;
  // Approximate font size as ~80% of the region height, scaled
  const estimated = Math.round(textInfo.bounds.h * 0.8 * scaleY);
  const defaultSize = isTitle ? DEFAULT_TITLE_FONT_SIZE : DEFAULT_SUBTITLE_FONT_SIZE;

  // Use estimated size if reasonable, otherwise fall back to default
  if (estimated >= MIN_FONT_SIZE) {
    return estimated;
  }
  return defaultSize;
}

/**
 * Infer text alignment from a position label string.
 * @param position - Position label (e.g. "top-left", "middle-center").
 * @returns Text alignment value.
 */
function inferAlignment(position: string): 'left' | 'center' | 'right' {
  if (position.includes('left')) return 'left';
  if (position.includes('right')) return 'right';
  return 'center';
}

// ---------------------------------------------------------------------------
// Internal: Effects Conversion
// ---------------------------------------------------------------------------

/**
 * Convert EstimatedEffect[] into Record<string, unknown>[] for TextLayerDesign.effects.
 * @param estimatedEffects - Array of estimated effects from analysis.
 * @returns Array of plain effect objects.
 */
function estimatedEffectsToRecords(
  estimatedEffects: EstimatedEffect[],
): ReadonlyArray<Record<string, unknown>> {
  return estimatedEffects
    .filter((e) => e.confidence > 0.3)
    .map((e) => ({ ...e.effect } as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// Internal: Mood Description
// ---------------------------------------------------------------------------

/**
 * Derive a mood description from the palette characteristics.
 * @param palette - Color palette.
 * @returns A mood string.
 */
function describeMood(palette: ColorPalette): string {
  const dom = palette.dominant;
  const brightness = (dom.r + dom.g + dom.b) / 3;

  if (brightness < 60) return 'dark';
  if (brightness > 200) return 'bright';
  if (palette.contrastRatio > 7) return 'high-contrast';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Internal: Similarity Scoring
// ---------------------------------------------------------------------------

/**
 * Compute layout similarity between an analysis and a generated design.
 * Compares the number and relative positions of text regions vs text layers.
 * @param analysis - Source analysis.
 * @param design - Generated design.
 * @returns Score from 0 to 1.
 */
function computeLayoutSimilarity(
  analysis: ThumbnailAnalysis,
  design: ThumbnailDesign,
): number {
  const analysisTextCount = analysis.texts.length;
  const designTextLayers = design.layers.filter((l) => l.kind === 'text');
  const designTextCount = designTextLayers.length;

  if (analysisTextCount === 0 && designTextCount === 0) return 1;
  if (analysisTextCount === 0 || designTextCount === 0) return 0.5;

  // Count similarity (how many text layers match)
  const countRatio = Math.min(analysisTextCount, designTextCount) /
    Math.max(analysisTextCount, designTextCount);

  // Position similarity: compare first N matching regions
  const sourceCanvas = inferSourceCanvas(analysis);
  const pairCount = Math.min(analysisTextCount, designTextCount);
  let positionSimilarity = 0;

  for (let i = 0; i < pairCount; i++) {
    const srcRegion = analysis.texts[i];
    const dstLayer = designTextLayers[i] as TextLayerDesign;

    // Normalize positions to 0-1 range for comparison
    const srcNormX = sourceCanvas.width > 0 ? srcRegion.bounds.x / sourceCanvas.width : 0;
    const srcNormY = sourceCanvas.height > 0 ? srcRegion.bounds.y / sourceCanvas.height : 0;
    const dstNormX = design.canvas.width > 0 ? dstLayer.x / design.canvas.width : 0;
    const dstNormY = design.canvas.height > 0 ? dstLayer.y / design.canvas.height : 0;

    // Euclidean distance in normalized space (max possible = sqrt(2))
    const dist = Math.sqrt(
      (srcNormX - dstNormX) ** 2 + (srcNormY - dstNormY) ** 2,
    );
    const maxDist = Math.SQRT2;
    positionSimilarity += 1 - dist / maxDist;
  }

  positionSimilarity /= pairCount;

  return countRatio * 0.4 + positionSimilarity * 0.6;
}

/**
 * Compute color similarity between the analysis palette and the generated design.
 * Uses Euclidean RGB distance between palette dominant/accent and background/text colors.
 * @param palette - Source palette.
 * @param design - Generated design.
 * @returns Score from 0 to 1.
 */
function computeColorSimilarity(
  palette: ColorPalette,
  design: ThumbnailDesign,
): number {
  const scores: number[] = [];

  // Compare dominant palette color with background start color
  if (design.background.type === 'gradient' && design.background.stops.length > 0) {
    const bgColor = design.background.stops[0].color;
    scores.push(colorDistance01(palette.dominant, bgColor));
  } else if (design.background.type === 'solid') {
    scores.push(colorDistance01(palette.dominant, design.background.color));
  }

  // Compare text palette color with text layer colors
  const textPaletteColor = findPaletteColorByRole(palette, 'text');
  const textLayers = design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];

  if (textLayers.length > 0) {
    const firstTextLayer = textLayers[0];
    scores.push(colorDistance01(textPaletteColor, firstTextLayer.color));
  }

  if (scores.length === 0) return 0.5;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Compute effect similarity between the analysis estimated effects and design layer effects.
 * Checks whether the same effect types are present.
 * @param estimatedEffects - Effects from the analysis.
 * @param design - Generated design.
 * @returns Score from 0 to 1.
 */
function computeEffectSimilarity(
  estimatedEffects: EstimatedEffect[],
  design: ThumbnailDesign,
): number {
  // Gather effect types from the analysis (only high-confidence ones)
  const analysisTypes = new Set(
    estimatedEffects
      .filter((e) => e.confidence > 0.3)
      .map((e) => e.effect.type),
  );

  // Gather effect types from design text layers
  const designTypes = new Set<string>();
  for (const layer of design.layers) {
    if (layer.kind === 'text') {
      for (const eff of (layer as TextLayerDesign).effects) {
        const effType = (eff as Record<string, unknown>).type;
        if (typeof effType === 'string') {
          designTypes.add(effType);
        }
      }
    }
  }

  if (analysisTypes.size === 0 && designTypes.size === 0) return 1;
  if (analysisTypes.size === 0 || designTypes.size === 0) return 0;

  // Jaccard similarity: intersection / union
  let intersection = 0;
  for (const t of analysisTypes) {
    if (designTypes.has(t)) intersection++;
  }
  const union = new Set([...analysisTypes, ...designTypes]).size;

  return union > 0 ? intersection / union : 0;
}

/**
 * Compute color similarity as 1 - normalized Euclidean RGB distance.
 * @param c1 - First color (r, g, b in 0-255).
 * @param c2 - Second color (r, g, b in 0-255).
 * @returns Score from 0 (completely different) to 1 (identical).
 */
function colorDistance01(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
): number {
  const maxDist = Math.sqrt(255 ** 2 * 3); // max Euclidean distance in RGB space
  const dist = Math.sqrt(
    (c1.r - c2.r) ** 2 +
    (c1.g - c2.g) ** 2 +
    (c1.b - c2.b) ** 2,
  );
  return 1 - dist / maxDist;
}

/**
 * Clamp a score to the 0-1 range.
 * @param value - The score value.
 * @returns Clamped value between 0 and 1.
 */
function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}
