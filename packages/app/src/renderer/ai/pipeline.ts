/**
 * @module ai/pipeline
 * End-to-end thumbnail generation pipeline orchestrator.
 *
 * Coordinates the full flow from user instruction to finished thumbnail:
 *   1. Design blueprint generation (via ThumbnailArchitect)
 *   2. Font recommendation and application (via FontSelectorAI)
 *   3. Conversion to EditorAction sequence (via ThumbnailArchitect)
 *
 * Two main entry points:
 * - `generateThumbnail()` — instruction string -> design + actions (one-shot)
 * - `refineThumbnail()` — instruction + existing design -> updated design + actions (iterative)
 *
 * The pipeline does NOT execute actions itself. It returns the design and action
 * sequence for the caller (store/dispatcher/MCP) to execute.
 *
 * @see PIPE-001: E2E自動生成パイプライン
 * @see {@link ./thumbnail-architect.ts} — design generation and action conversion
 * @see {@link ./font-selector-ai.ts} — font recommendation engine
 * @see {@link ./design-schema.ts} — ThumbnailDesign type
 * @see {@link ../editor-actions/types.ts} — EditorAction types
 * @see {@link ../editor-actions/dispatcher.ts} — action execution
 */

import type { ThumbnailDesign, TextLayerDesign } from './design-schema';
import type { EditorAction } from '../editor-actions/types';
import { generateDesign, designToActions } from './thumbnail-architect';
import type { GenerateDesignOptions } from './thumbnail-architect';
import { recommendFonts } from './font-selector-ai';
import type { FontRecommendation } from './font-selector-ai';
import { getEffectsForMoodAndCategory } from './effect-presets';
import { isLocalFont } from './local-font-catalog';
import { useLocalFontsStore } from './local-fonts-store';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Options for the thumbnail generation pipeline. */
export interface PipelineOptions {
  /** Natural language instruction describing the desired thumbnail. */
  instruction: string;
  /** Explicit design category override (e.g. 'news', 'howto', 'vlog'). */
  category?: string;
  /** Target platform (defaults to 'youtube'). */
  platform?: 'youtube' | 'twitter' | 'instagram' | 'custom';
  /** Canvas size override as { width, height }. */
  canvasSize?: { width: number; height: number };
  /** Explicit title text (overrides extraction from instruction). */
  title?: string;
  /** Explicit subtitle text. */
  subtitle?: string;
}

/** Result of the thumbnail generation pipeline. */
export interface PipelineResult {
  /** The generated design blueprint. */
  design: ThumbnailDesign;
  /** Ordered array of EditorActions to execute. */
  actions: EditorAction[];
  /** Whether the pipeline completed successfully. */
  success: boolean;
  /** Error message if the pipeline failed. */
  error?: string;
  /** Font recommendations that were applied (for reference). */
  fontRecommendations?: ReadonlyArray<{
    /** Layer name that received the recommendation. */
    layerName: string;
    /** The recommended font family. */
    fontFamily: string;
    /** Score of the recommendation. */
    score: number;
  }>;
}

/** Pipeline processing stage identifiers. */
export type PipelineStage = 'design' | 'fonts' | 'actions' | 'execute' | 'export';

/**
 * Callback for pipeline progress notifications.
 * Called at the start of each processing stage.
 *
 * @param stage - The pipeline stage that is starting.
 * @param message - Human-readable progress message.
 */
export type PipelineProgress = (stage: PipelineStage, message: string) => void;

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

/**
 * Generate a complete thumbnail from a natural language instruction.
 *
 * This is the primary pipeline entry point. It orchestrates:
 * 1. Design blueprint generation from the instruction
 * 2. AI font recommendation + effect preset application for each text layer
 * 3. Lazy-loading of selected local fonts into the browser (async)
 * 4. Conversion of the finalized design to EditorActions
 *
 * The pipeline does NOT execute the actions. The caller is responsible for
 * dispatching them through the editor action system.
 *
 * @param options - Pipeline options including the instruction and overrides.
 * @param onProgress - Optional callback for stage progress notifications.
 * @returns A PipelineResult with the design, actions, and metadata.
 *
 * @example
 * ```ts
 * const result = await generateThumbnail({
 *   instruction: "衝撃ニュース系サムネ、タイトル「AIが世界を変える」",
 *   platform: 'youtube',
 * });
 * if (result.success) {
 *   executeActions(result.actions);
 * }
 * ```
 */
export async function generateThumbnail(
  options: PipelineOptions,
  onProgress?: PipelineProgress,
): Promise<PipelineResult> {
  try {
    // Validate input
    if (!options.instruction || options.instruction.trim().length === 0) {
      return {
        design: createEmptyDesign(),
        actions: [],
        success: false,
        error: 'Instruction is required and must not be empty.',
      };
    }

    // Stage 1: Generate design blueprint
    onProgress?.('design', 'Generating design blueprint...');
    const designOptions: GenerateDesignOptions = {
      category: options.category,
      platform: options.platform,
      width: options.canvasSize?.width,
      height: options.canvasSize?.height,
      title: options.title,
      subtitle: options.subtitle,
    };
    const design = generateDesign(options.instruction, designOptions);

    // Stage 2: Recommend fonts + apply effect presets
    onProgress?.('fonts', 'Selecting optimal fonts...');
    const { design: fontEnrichedDesign, recommendations } = applyFontRecommendationsInternal(design);

    // Stage 3: Lazy-load local fonts into the browser runtime
    await ensureSelectedFontsLoaded(fontEnrichedDesign);

    // Stage 4: Convert to EditorActions
    onProgress?.('actions', 'Converting design to editor actions...');
    const actions = designToActions(fontEnrichedDesign);

    return {
      design: fontEnrichedDesign,
      actions,
      success: true,
      fontRecommendations: recommendations,
    };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      design: createEmptyDesign(),
      actions: [],
      success: false,
      error: `Pipeline failed: ${errorMessage}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Refinement
// ---------------------------------------------------------------------------

/**
 * Refine an existing thumbnail design based on a follow-up instruction.
 *
 * Applies modification instructions to an existing design:
 * - Color changes ("もっと赤く", "make it bluer")
 * - Font size adjustments ("文字を大きく", "bigger text")
 * - Mood shifts ("もっと派手に", "make it calmer")
 * - Text content changes ("タイトルを変えて")
 *
 * After modification, fonts are re-recommended and the design is re-converted
 * to EditorActions.
 *
 * @param instruction - Follow-up instruction for refinement.
 * @param currentDesign - The existing ThumbnailDesign to modify.
 * @returns A PipelineResult with the updated design and actions.
 *
 * @example
 * ```ts
 * const refined = refineThumbnail("もう少し派手にして", existingDesign);
 * if (refined.success) {
 *   executeActions(refined.actions);
 * }
 * ```
 */
export async function refineThumbnail(
  instruction: string,
  currentDesign: ThumbnailDesign,
): Promise<PipelineResult> {
  try {
    if (!instruction || instruction.trim().length === 0) {
      return {
        design: currentDesign,
        actions: [],
        success: false,
        error: 'Refinement instruction is required and must not be empty.',
      };
    }

    // Deep clone the design to avoid mutating the original
    const design = cloneDesign(currentDesign);

    // Apply refinement modifications
    applyRefinementModifications(design, instruction);

    // Re-apply font recommendations
    const { design: fontEnrichedDesign, recommendations } = applyFontRecommendationsInternal(design);

    // Lazy-load any new local fonts
    await ensureSelectedFontsLoaded(fontEnrichedDesign);

    // Convert to actions
    const actions = designToActions(fontEnrichedDesign);

    return {
      design: fontEnrichedDesign,
      actions,
      success: true,
      fontRecommendations: recommendations,
    };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      design: currentDesign,
      actions: [],
      success: false,
      error: `Refinement failed: ${errorMessage}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Font Recommendation Application
// ---------------------------------------------------------------------------

/**
 * Enrich a design by replacing generic fonts with AI-recommended ones.
 *
 * For each text layer in the design, this function:
 * 1. Analyzes the text content and design mood
 * 2. Gets the top font recommendation from the AI engine
 * 3. Replaces the layer's fontFamily with the recommended font
 *
 * Returns a new design object (does not mutate the input).
 *
 * @param design - The ThumbnailDesign to enrich with font recommendations.
 * @returns A new ThumbnailDesign with updated font families.
 *
 * @example
 * ```ts
 * const enrichedDesign = applyFontRecommendations(design);
 * // enrichedDesign.layers text layers now have AI-selected fonts
 * ```
 */
export function applyFontRecommendations(design: ThumbnailDesign): ThumbnailDesign {
  const { design: enrichedDesign } = applyFontRecommendationsInternal(cloneDesign(design));
  return enrichedDesign;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Font recommendation result for a single layer. */
interface FontRecommendationEntry {
  /** Layer name that received the recommendation. */
  layerName: string;
  /** The recommended font family. */
  fontFamily: string;
  /** Score of the recommendation. */
  score: number;
}

/**
 * Internal implementation of font recommendation and effect preset application.
 * Mutates the design in place and returns recommendation metadata.
 *
 * For each text layer:
 * 1. Recommends the optimal font from the merged catalog (55 + 776 fonts)
 * 2. Applies mood × category effect presets to the layer
 *
 * @param design - The design to modify (will be mutated).
 * @returns The modified design and recommendation entries.
 */
function applyFontRecommendationsInternal(design: ThumbnailDesign): {
  design: ThumbnailDesign;
  recommendations: FontRecommendationEntry[];
} {
  const recommendations: FontRecommendationEntry[] = [];
  const mood = design.metadata.mood;

  for (const layer of design.layers) {
    if (layer.kind !== 'text') continue;

    const textLayer = layer as TextLayerDesign;
    const recs: FontRecommendation[] = recommendFonts({
      text: textLayer.text,
      mood: mood ? [mood] : [],
      limit: 1,
    });

    if (recs.length > 0) {
      const topRec = recs[0];
      textLayer.fontFamily = topRec.font.family;

      // Apply mood × category effect presets
      const effects = getEffectsForMoodAndCategory(mood, topRec.font.category);
      textLayer.effects = effects.map((e) => ({ ...e }));

      recommendations.push({
        layerName: textLayer.name,
        fontFamily: topRec.font.family,
        score: topRec.score,
      });
    }
  }

  return { design, recommendations };
}

/**
 * Lazy-load all local fonts referenced in the design into the browser runtime.
 * Called after font selection but before action conversion / rendering.
 *
 * @param design - The design whose text layers' fonts to ensure are loaded.
 */
async function ensureSelectedFontsLoaded(design: ThumbnailDesign): Promise<void> {
  const families: string[] = [];
  for (const layer of design.layers) {
    if (layer.kind === 'text') {
      const family = (layer as TextLayerDesign).fontFamily;
      if (family && isLocalFont(family)) {
        families.push(family);
      }
    }
  }
  if (families.length === 0) return;

  const store = useLocalFontsStore.getState();
  await store.ensureFontsLoaded(families);
}

/**
 * Apply refinement modifications to a design based on a natural language instruction.
 *
 * Supported modification patterns:
 * - Font size: "文字を大きく/小さく", "bigger/smaller text"
 * - Boldness: "太字に", "もっと太く", "bold"
 * - Brightness/saturation: "もっと派手に", "flashier", "もっと落ち着いて", "calmer"
 *
 * @param design - The design to modify (mutated in place).
 * @param instruction - The refinement instruction.
 */
function applyRefinementModifications(design: ThumbnailDesign, instruction: string): void {
  // Font size modifications
  const makeBigger = /大き[くい]|でかく|bigger|larger|huge/i.test(instruction);
  const makeSmaller = /小さ[くい]|smaller|tiny/i.test(instruction);

  if (makeBigger || makeSmaller) {
    const factor = makeBigger ? 1.2 : 0.8;
    for (const layer of design.layers) {
      if (layer.kind === 'text') {
        (layer as TextLayerDesign).fontSize = Math.round(
          (layer as TextLayerDesign).fontSize * factor,
        );
      }
    }
  }

  // Bold modification
  const makeBold = /太字|太く|bold/i.test(instruction);
  if (makeBold) {
    for (const layer of design.layers) {
      if (layer.kind === 'text') {
        (layer as TextLayerDesign).bold = true;
      }
    }
  }

  // Color vibrancy adjustments
  const makeFlashy = /派手|flashy|flashier|vibrant|鮮やか|目立/i.test(instruction);
  const makeCalm = /落ち着|calm|calmer|subtle|控えめ|シンプル/i.test(instruction);

  if (makeFlashy && design.background.type === 'gradient') {
    // Increase color saturation by pushing channels further apart
    for (const stop of design.background.stops) {
      const color = stop.color;
      const max = Math.max(color.r, color.g, color.b);
      const min = Math.min(color.r, color.g, color.b);
      if (max === min) continue; // achromatic, skip
      // Boost the dominant channel, reduce others
      if (color.r === max) { color.r = Math.min(255, color.r + 30); color.g = Math.max(0, color.g - 15); color.b = Math.max(0, color.b - 15); }
      if (color.g === max) { color.g = Math.min(255, color.g + 30); color.r = Math.max(0, color.r - 15); color.b = Math.max(0, color.b - 15); }
      if (color.b === max) { color.b = Math.min(255, color.b + 30); color.r = Math.max(0, color.r - 15); color.g = Math.max(0, color.g - 15); }
    }
  }

  if (makeCalm && design.background.type === 'gradient') {
    // Reduce color saturation by pulling channels toward the midpoint
    for (const stop of design.background.stops) {
      const color = stop.color;
      const avg = Math.round((color.r + color.g + color.b) / 3);
      color.r = Math.round(color.r * 0.6 + avg * 0.4);
      color.g = Math.round(color.g * 0.6 + avg * 0.4);
      color.b = Math.round(color.b * 0.6 + avg * 0.4);
    }
  }

  // Text content change: look for new title/subtitle in the instruction
  const titleMatch = instruction.match(/タイトル\s*[:：「](.+?)[」]?(?:に|で|$)/u) ??
    instruction.match(/title\s*[:=]\s*"(.+?)"/i);
  if (titleMatch) {
    for (const layer of design.layers) {
      if (layer.kind === 'text' && layer.name.toLowerCase().includes('title') && !layer.name.toLowerCase().includes('sub')) {
        (layer as TextLayerDesign).text = titleMatch[1].trim();
      }
    }
  }

  const subtitleMatch = instruction.match(/サブタイトル\s*[:：「](.+?)[」]?(?:に|で|$)/u) ??
    instruction.match(/subtitle\s*[:=]\s*"(.+?)"/i);
  if (subtitleMatch) {
    for (const layer of design.layers) {
      if (layer.kind === 'text' && layer.name.toLowerCase().includes('sub')) {
        (layer as TextLayerDesign).text = subtitleMatch[1].trim();
      }
    }
  }
}

/**
 * Create an empty design (used as fallback when the pipeline fails).
 * @returns A minimal valid ThumbnailDesign.
 */
function createEmptyDesign(): ThumbnailDesign {
  return {
    canvas: { width: 1280, height: 720 },
    background: { type: 'solid', color: { r: 0, g: 0, b: 0, a: 1 } },
    layers: [],
    metadata: { category: 'unknown', mood: 'neutral', targetPlatform: 'youtube' },
  };
}

/**
 * Deep-clone a ThumbnailDesign to avoid mutating the original.
 * @param design - The design to clone.
 * @returns A deep copy of the design.
 */
function cloneDesign(design: ThumbnailDesign): ThumbnailDesign {
  return JSON.parse(JSON.stringify(design)) as ThumbnailDesign;
}
