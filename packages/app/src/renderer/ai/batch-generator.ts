/**
 * @module ai/batch-generator
 * Batch thumbnail variation generator.
 *
 * Generates multiple design variations from a single instruction by applying
 * different style strategies (Bold, Minimal, Colorful, Dark, Classic).
 * Each variation is a complete ThumbnailDesign + EditorAction[] pair ready
 * for preview or execution.
 *
 * Main entry point:
 * - `generateBatch()` — instruction + options -> array of complete variations
 *
 * Does not require ComfyUI or any external service; variation generation is
 * entirely rule-based using the existing design pipeline.
 *
 * @see BATCH-001: AI画像生成統合・バッチ生成
 * @see {@link ./pipeline.ts} — E2E pipeline (design + font + actions)
 * @see {@link ./thumbnail-architect.ts} — design generation
 * @see {@link ./design-schema.ts} — ThumbnailDesign type
 * @see {@link ./design-patterns.ts} — design pattern database
 */

import type { ThumbnailDesign, TextLayerDesign } from './design-schema';
import type { EditorAction } from '../editor-actions/types';
import { generateDesign, designToActions } from './thumbnail-architect';
import type { Color } from '@photoshop-app/types';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Options for batch thumbnail generation. */
export interface BatchOptions {
  /** Natural language instruction describing the desired thumbnail. */
  instruction: string;
  /** Number of variations to generate (default: 3, max: 10). */
  variationCount?: number;
  /** Explicit list of style names to apply. If omitted, auto-selects from STYLE_VARIATIONS. */
  styles?: readonly string[];
  /** Explicit design category override (e.g. 'news', 'howto'). */
  category?: string;
  /** Target platform (defaults to 'youtube'). */
  platform?: 'youtube' | 'twitter' | 'instagram' | 'custom';
  /** Canvas size override. */
  canvasSize?: { width: number; height: number };
}

/** A single variation within a batch result. */
export interface BatchVariation {
  /** The complete thumbnail design for this variation. */
  design: ThumbnailDesign;
  /** Ordered EditorActions to realize this design. */
  actions: EditorAction[];
  /** Name of the style variation applied. */
  styleName: string;
}

/** Result of a batch generation operation. */
export interface BatchResult {
  /** All generated variations. */
  variations: BatchVariation[];
  /** Whether the batch generation completed successfully. */
  success: boolean;
  /** Error message if the batch generation failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Style Variation Definitions
// ---------------------------------------------------------------------------

/** A style variation strategy that transforms a base design. */
export interface StyleVariation {
  /** Unique name for this variation. */
  name: string;
  /** Display label (Japanese). */
  labelJa: string;
  /** Display label (English). */
  labelEn: string;
  /** Description of what this variation does. */
  description: string;
  /** Transform function that modifies a cloned design. */
  transform: (design: ThumbnailDesign) => void;
}

/**
 * Predefined style variation strategies.
 *
 * Each strategy modifies a base design in a distinct way:
 * - **Bold**: Larger text, thicker strokes, stronger effects
 * - **Minimal**: Fewer effects, clean look, reduced visual clutter
 * - **Colorful**: Vibrant color palette with saturated accent colors
 * - **Dark**: Dark theme with light text on dark backgrounds
 * - **Classic**: Traditional serif-style fonts, muted elegant palette
 */
export const STYLE_VARIATIONS: readonly StyleVariation[] = [
  {
    name: 'Bold',
    labelJa: '太字・インパクト',
    labelEn: 'Bold Impact',
    description: 'Larger text, stronger effects, maximum visual impact',
    transform: applyBoldStyle,
  },
  {
    name: 'Minimal',
    labelJa: 'ミニマル',
    labelEn: 'Minimal Clean',
    description: 'Fewer effects, clean look, reduced visual clutter',
    transform: applyMinimalStyle,
  },
  {
    name: 'Colorful',
    labelJa: 'カラフル',
    labelEn: 'Colorful Vibrant',
    description: 'Vibrant color palette with saturated accent colors',
    transform: applyColorfulStyle,
  },
  {
    name: 'Dark',
    labelJa: 'ダークテーマ',
    labelEn: 'Dark Theme',
    description: 'Dark background with high-contrast light text',
    transform: applyDarkStyle,
  },
  {
    name: 'Classic',
    labelJa: 'クラシック',
    labelEn: 'Classic Elegant',
    description: 'Traditional serif fonts, muted elegant color palette',
    transform: applyClassicStyle,
  },
] as const;

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Generate multiple thumbnail design variations from a single instruction.
 *
 * For each requested variation, the function:
 * 1. Generates a base design from the instruction
 * 2. Deep-clones the base design
 * 3. Applies the style variation transform
 * 4. Converts the modified design to EditorActions
 *
 * If fewer styles are requested than `variationCount`, styles cycle.
 * If more styles are provided than `variationCount`, only the first N are used.
 *
 * @param options - Batch generation options.
 * @returns A BatchResult with all generated variations.
 *
 * @example
 * ```ts
 * const result = generateBatch({
 *   instruction: "衝撃ニュース系サムネ、タイトル「AIが世界を変える」",
 *   variationCount: 3,
 * });
 * if (result.success) {
 *   for (const v of result.variations) {
 *     console.log(v.styleName, v.actions.length);
 *   }
 * }
 * ```
 */
export function generateBatch(options: BatchOptions): BatchResult {
  try {
    // Validate input
    if (!options.instruction || options.instruction.trim().length === 0) {
      return {
        variations: [],
        success: false,
        error: 'Instruction is required and must not be empty.',
      };
    }

    const count = clampVariationCount(options.variationCount ?? 3);
    const styleNames = resolveStyleNames(options.styles, count);

    // Generate base design
    const baseDesign = generateDesign(options.instruction, {
      category: options.category,
      platform: options.platform,
      width: options.canvasSize?.width,
      height: options.canvasSize?.height,
    });

    // Generate variations
    const variations: BatchVariation[] = [];

    for (const styleName of styleNames) {
      const variation = createVariation(baseDesign, styleName);
      if (variation) {
        variations.push(variation);
      }
    }

    return {
      variations,
      success: true,
    };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      variations: [],
      success: false,
      error: `Batch generation failed: ${errorMessage}`,
    };
  }
}

/**
 * Get the list of all available style variation names.
 *
 * @returns An array of style variation name strings.
 */
export function getAvailableStyles(): readonly string[] {
  return STYLE_VARIATIONS.map((s) => s.name);
}

/**
 * Look up a style variation by name.
 *
 * @param name - The style variation name (case-insensitive).
 * @returns The matching StyleVariation, or undefined if not found.
 */
export function getStyleByName(name: string): StyleVariation | undefined {
  const lower = name.toLowerCase();
  return STYLE_VARIATIONS.find((s) => s.name.toLowerCase() === lower);
}

// ---------------------------------------------------------------------------
// Internal: Variation Creation
// ---------------------------------------------------------------------------

/**
 * Create a single design variation by cloning the base and applying a style transform.
 *
 * @param baseDesign - The original design to clone.
 * @param styleName - Name of the style variation to apply.
 * @returns A BatchVariation, or null if the style was not found.
 */
function createVariation(
  baseDesign: ThumbnailDesign,
  styleName: string,
): BatchVariation | null {
  const style = getStyleByName(styleName);
  if (!style) {
    return null;
  }

  // Deep clone to avoid mutating the base
  const cloned = cloneDesign(baseDesign);

  // Apply the style transformation
  style.transform(cloned);

  // Convert to actions
  const actions = designToActions(cloned);

  return {
    design: cloned,
    actions,
    styleName: style.name,
  };
}

// ---------------------------------------------------------------------------
// Internal: Style Transforms
// ---------------------------------------------------------------------------

/**
 * Apply the "Bold" style: larger text, thicker strokes, stronger effects.
 * @param design - Design to modify (mutated in place).
 */
function applyBoldStyle(design: ThumbnailDesign): void {
  for (const layer of design.layers) {
    if (layer.kind !== 'text') continue;
    const textLayer = layer as TextLayerDesign;

    // Increase font size by 25%
    textLayer.fontSize = Math.round(textLayer.fontSize * 1.25);

    // Force bold
    textLayer.bold = true;

    // Enhance stroke effects
    const mutableEffects = [...textLayer.effects] as Record<string, unknown>[];
    for (const effect of mutableEffects) {
      if (effect['type'] === 'stroke' && typeof effect['size'] === 'number') {
        effect['size'] = Math.round((effect['size'] as number) * 1.5);
      }
      if (effect['type'] === 'drop-shadow' && typeof effect['blur'] === 'number') {
        effect['blur'] = Math.round((effect['blur'] as number) * 1.3);
        effect['distance'] = Math.round(((effect['distance'] as number) ?? 4) * 1.3);
      }
    }
    (layer as { effects: Record<string, unknown>[] }).effects = mutableEffects;
  }
}

/**
 * Apply the "Minimal" style: fewer effects, clean look.
 * @param design - Design to modify (mutated in place).
 */
function applyMinimalStyle(design: ThumbnailDesign): void {
  // Simplify background to solid color
  if (design.background.type === 'gradient' && design.background.stops.length > 0) {
    const firstStop = design.background.stops[0];
    design.background = {
      type: 'solid',
      color: { ...firstStop.color },
    };
  }

  for (const layer of design.layers) {
    if (layer.kind !== 'text') continue;
    const textLayer = layer as TextLayerDesign;

    // Reduce font size slightly
    textLayer.fontSize = Math.round(textLayer.fontSize * 0.9);

    // Remove heavy effects, keep only a thin stroke
    const thinStroke: Record<string, unknown> = {
      type: 'stroke',
      enabled: true,
      color: { r: 0, g: 0, b: 0, a: 1 },
      size: 2,
      position: 'outside',
      opacity: 1,
    };
    (layer as { effects: Record<string, unknown>[] }).effects = [thinStroke];
  }

  // Remove shape layers (concentration lines, border frames)
  design.layers = design.layers.filter((l) => l.kind !== 'shape');
}

/**
 * Apply the "Colorful" style: vibrant, saturated color palette.
 * @param design - Design to modify (mutated in place).
 */
function applyColorfulStyle(design: ThumbnailDesign): void {
  // Boost background gradient colors
  if (design.background.type === 'gradient') {
    for (const stop of design.background.stops) {
      boostSaturation(stop.color, 40);
    }
  }

  // Apply vibrant accent colors to text
  const vibrantColors: Color[] = [
    { r: 255, g: 50, b: 100, a: 1 },   // Hot pink
    { r: 0, g: 200, b: 255, a: 1 },     // Cyan
    { r: 255, g: 200, b: 0, a: 1 },     // Golden yellow
    { r: 120, g: 255, b: 80, a: 1 },    // Lime green
    { r: 200, g: 80, b: 255, a: 1 },    // Purple
  ];

  let colorIndex = 0;
  for (const layer of design.layers) {
    if (layer.kind !== 'text') continue;
    const textLayer = layer as TextLayerDesign;

    // Apply a vibrant color from the palette
    textLayer.color = { ...vibrantColors[colorIndex % vibrantColors.length] };
    colorIndex++;

    // Add a yellow outer glow for pop
    const mutableEffects = [...textLayer.effects] as Record<string, unknown>[];
    const hasGlow = mutableEffects.some((e) => e['type'] === 'outer-glow');
    if (!hasGlow) {
      mutableEffects.push({
        type: 'outer-glow',
        enabled: true,
        color: { r: 255, g: 255, b: 0, a: 1 },
        opacity: 0.5,
        size: 10,
        spread: 0,
      });
    }
    (layer as { effects: Record<string, unknown>[] }).effects = mutableEffects;
  }
}

/**
 * Apply the "Dark" style: dark background with high-contrast light text.
 * @param design - Design to modify (mutated in place).
 */
function applyDarkStyle(design: ThumbnailDesign): void {
  // Replace background with a dark gradient
  design.background = {
    type: 'gradient',
    gradientType: 'linear',
    angle: 180,
    stops: [
      { position: 0, color: { r: 30, g: 30, b: 40, a: 1 } },
      { position: 1, color: { r: 10, g: 10, b: 15, a: 1 } },
    ],
  };

  for (const layer of design.layers) {
    if (layer.kind !== 'text') continue;
    const textLayer = layer as TextLayerDesign;

    // Make text white or near-white for contrast
    textLayer.color = { r: 255, g: 255, b: 255, a: 1 };

    // Replace stroke with a subtle light glow
    const mutableEffects: Record<string, unknown>[] = [
      {
        type: 'stroke',
        enabled: true,
        color: { r: 100, g: 100, b: 120, a: 1 },
        size: 2,
        position: 'outside',
        opacity: 0.8,
      },
      {
        type: 'drop-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 0.9 },
        opacity: 0.9,
        angle: 135,
        distance: 3,
        blur: 6,
        spread: 0,
      },
    ];
    (layer as { effects: Record<string, unknown>[] }).effects = mutableEffects;
  }
}

/**
 * Apply the "Classic" style: traditional serif fonts, muted elegant palette.
 * @param design - Design to modify (mutated in place).
 */
function applyClassicStyle(design: ThumbnailDesign): void {
  // Apply warm muted background tones
  design.background = {
    type: 'gradient',
    gradientType: 'linear',
    angle: 180,
    stops: [
      { position: 0, color: { r: 245, g: 235, b: 220, a: 1 } },
      { position: 1, color: { r: 220, g: 205, b: 185, a: 1 } },
    ],
  };

  for (const layer of design.layers) {
    if (layer.kind !== 'text') continue;
    const textLayer = layer as TextLayerDesign;

    // Switch to a serif-style font
    textLayer.fontFamily = 'Noto Serif JP';

    // Apply elegant dark text color
    textLayer.color = { r: 50, g: 40, b: 30, a: 1 };

    // Use subtle, refined effects
    const mutableEffects: Record<string, unknown>[] = [
      {
        type: 'drop-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 0.3 },
        opacity: 0.3,
        angle: 135,
        distance: 2,
        blur: 4,
        spread: 0,
      },
    ];
    (layer as { effects: Record<string, unknown>[] }).effects = mutableEffects;
  }

  // Remove flashy shape layers (concentration lines)
  design.layers = design.layers.filter(
    (l) => !(l.kind === 'shape' && l.name === 'Concentration Lines'),
  );
}

// ---------------------------------------------------------------------------
// Internal: Helpers
// ---------------------------------------------------------------------------

/**
 * Deep-clone a ThumbnailDesign to avoid mutating the original.
 * @param design - The design to clone.
 * @returns A deep copy of the design.
 */
function cloneDesign(design: ThumbnailDesign): ThumbnailDesign {
  return JSON.parse(JSON.stringify(design)) as ThumbnailDesign;
}

/**
 * Clamp the variation count to valid bounds.
 * @param count - Requested count.
 * @returns Clamped value between 1 and 10.
 */
function clampVariationCount(count: number): number {
  return Math.max(1, Math.min(10, Math.round(count)));
}

/**
 * Resolve which style names to use for the given count.
 * If explicit styles are provided, use those (cycling if needed).
 * Otherwise, pick from STYLE_VARIATIONS in order.
 *
 * @param explicitStyles - User-specified style names, or undefined.
 * @param count - Number of variations to produce.
 * @returns An array of style names with exactly `count` entries.
 */
function resolveStyleNames(
  explicitStyles: readonly string[] | undefined,
  count: number,
): string[] {
  const available = explicitStyles && explicitStyles.length > 0
    ? [...explicitStyles]
    : STYLE_VARIATIONS.map((s) => s.name);

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(available[i % available.length]);
  }
  return result;
}

/**
 * Boost the saturation of a Color by pushing channels further from the average.
 * Mutates the color in place.
 *
 * @param color - The color to modify.
 * @param amount - Amount to boost (positive = more saturated).
 */
function boostSaturation(color: Color, amount: number): void {
  const avg = Math.round((color.r + color.g + color.b) / 3);
  const boost = (channel: number): number => {
    const diff = channel - avg;
    return Math.max(0, Math.min(255, Math.round(channel + Math.sign(diff) * amount)));
  };
  color.r = boost(color.r);
  color.g = boost(color.g);
  color.b = boost(color.b);
}
