/**
 * @module ai/thumbnail-architect
 * Thumbnail Architect: generates a design blueprint from natural language instructions
 * and converts it into executable EditorAction sequences.
 *
 * Two main entry points:
 * - `generateDesign()` — instruction string -> ThumbnailDesign JSON
 * - `designToActions()` — ThumbnailDesign -> EditorAction[]
 *
 * The generation is fully rule-based (no external API calls). It:
 * 1. Selects a design pattern by keyword matching
 * 2. Extracts title/subtitle text from the instruction
 * 3. Applies color psychology overrides
 * 4. Resolves layer templates into concrete layer designs
 *
 * @see THUMB-001: Thumbnail Architect
 * @see {@link ./design-schema.ts} — ThumbnailDesign type
 * @see {@link ./design-patterns.ts} — design pattern database
 * @see {@link ../editor-actions/types.ts} — EditorAction types
 */

import type { EditorAction, ColorDef, GradientStopDef } from '../editor-actions/types';
import type {
  ThumbnailDesign,
  LayerDesign,
  TextLayerDesign,
  ImageLayerDesign,
  ShapeLayerDesign,
  BackgroundDesign,
  GradientBackground,
  PatternBackground,
  DesignMetadata,
} from './design-schema';
import {
  findPatternForInstruction,
  getPatternById,
  findPsychologyColor,
  resolveTextLayer,
  type DesignPattern,
  type ColorPalette,
} from './design-patterns';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for design generation. */
export interface GenerateDesignOptions {
  /** Explicit category override (bypasses keyword detection). */
  category?: string;
  /** Target platform. Defaults to 'youtube'. */
  platform?: 'youtube' | 'twitter' | 'instagram' | 'custom';
  /** Canvas width override. */
  width?: number;
  /** Canvas height override. */
  height?: number;
  /** Explicit title text (overrides extraction from instruction). */
  title?: string;
  /** Explicit subtitle text. */
  subtitle?: string;
}

// ---------------------------------------------------------------------------
// Platform Defaults
// ---------------------------------------------------------------------------

/** Default canvas dimensions per platform. */
const PLATFORM_SIZES: Record<string, { width: number; height: number }> = {
  youtube: { width: 1280, height: 720 },
  twitter: { width: 1200, height: 675 },
  instagram: { width: 1080, height: 1080 },
  custom: { width: 1280, height: 720 },
};

// ---------------------------------------------------------------------------
// Text Extraction
// ---------------------------------------------------------------------------

/**
 * Extract title and subtitle from user instruction text.
 *
 * Recognizes patterns like:
 * - "タイトル: ..." / "タイトル「...」"
 * - "サブタイトル: ..."
 * - Quoted strings 「...」 or "..."
 *
 * @param instruction - Raw user instruction.
 * @returns An object with extracted title and subtitle (may be empty strings).
 */
export function extractTextFromInstruction(instruction: string): { title: string; subtitle: string } {
  let title = '';
  let subtitle = '';

  // Japanese title patterns: タイトル: ..., タイトル「...」
  const titlePatternColon = /(?:タイトル|title)\s*[:：]\s*(.+?)(?:[、,。.]|サブ|$)/iu;
  const titlePatternBracket = /(?:タイトル|title)\s*[「"](.+?)[」"]/iu;

  const bracketMatch = instruction.match(titlePatternBracket);
  if (bracketMatch) {
    title = bracketMatch[1].trim();
  } else {
    const colonMatch = instruction.match(titlePatternColon);
    if (colonMatch) {
      title = colonMatch[1].trim();
    }
  }

  // Subtitle patterns
  const subPatternColon = /(?:サブタイトル|subtitle)\s*[:：]\s*(.+?)(?:[、,。.]|$)/iu;
  const subPatternBracket = /(?:サブタイトル|subtitle)\s*[「"](.+?)[」"]/iu;

  const subBracketMatch = instruction.match(subPatternBracket);
  if (subBracketMatch) {
    subtitle = subBracketMatch[1].trim();
  } else {
    const subColonMatch = instruction.match(subPatternColon);
    if (subColonMatch) {
      subtitle = subColonMatch[1].trim();
    }
  }

  // Fallback: extract first 「...」 as title if no explicit title found
  if (!title) {
    const genericBracket = /[「"](.+?)[」"]/u;
    const m = instruction.match(genericBracket);
    if (m) {
      title = m[1].trim();
    }
  }

  return { title, subtitle };
}

// ---------------------------------------------------------------------------
// generateDesign
// ---------------------------------------------------------------------------

/**
 * Generate a complete thumbnail design blueprint from a natural language instruction.
 *
 * This is the main entry point of the Thumbnail Architect. It performs:
 * 1. Pattern selection (by keyword matching or explicit category)
 * 2. Text extraction from the instruction
 * 3. Color psychology override
 * 4. Layer resolution with the selected pattern's templates
 *
 * No external API calls are made; generation is entirely rule-based.
 *
 * @param instruction - User instruction in natural language (Japanese or English).
 * @param options - Optional overrides for category, platform, canvas size, etc.
 * @returns A fully populated ThumbnailDesign object.
 *
 * @example
 * ```ts
 * const design = generateDesign("衝撃的なニュース系サムネ、タイトル: AIが弁護士を超えた日");
 * // => ThumbnailDesign with news pattern, red gradient, title text, etc.
 * ```
 */
export function generateDesign(
  instruction: string,
  options?: GenerateDesignOptions,
): ThumbnailDesign {
  // 1. Select pattern
  const pattern: DesignPattern = options?.category
    ? (getPatternById(options.category) ?? findPatternForInstruction(instruction))
    : findPatternForInstruction(instruction);

  // 2. Determine canvas size
  const platform = options?.platform ?? 'youtube';
  const platformSize = PLATFORM_SIZES[platform] ?? PLATFORM_SIZES.youtube;
  const canvasWidth = options?.width ?? platformSize.width;
  const canvasHeight = options?.height ?? platformSize.height;

  // 3. Extract text from instruction
  const extracted = extractTextFromInstruction(instruction);
  const titleText = options?.title ?? extracted.title;
  const subtitleText = options?.subtitle ?? extracted.subtitle;

  // 4. Build palette (with optional color psychology override)
  const palette: ColorPalette = {
    primary: { ...pattern.palette.primary },
    secondary: { ...pattern.palette.secondary },
    accent: { ...pattern.palette.accent },
    text: { ...pattern.palette.text },
    subText: { ...pattern.palette.subText },
  };

  const psychologyColor = findPsychologyColor(instruction);
  if (psychologyColor) {
    palette.accent = psychologyColor;
  }

  // 5. Resolve text layers
  const layers: LayerDesign[] = [];

  for (const template of pattern.textLayers) {
    let textContent = '';
    if (template.role === 'title') {
      textContent = titleText;
    } else if (template.role === 'subtitle') {
      textContent = subtitleText;
    } else if (template.role === 'label') {
      textContent = mapLabelText(pattern.id);
    } else if (template.role === 'accent') {
      textContent = titleText ? '' : '';
    }

    // Skip empty subtitle layers
    if (template.role === 'subtitle' && !textContent) {
      continue;
    }

    const resolved = resolveTextLayer(template, palette, canvasWidth, canvasHeight, textContent);
    layers.push(resolved);
  }

  // 6. Add shape layers (concentration lines, border frame) if pattern calls for them
  if (pattern.concentrationLines) {
    layers.push(createConcentrationLinesLayer(canvasWidth, canvasHeight));
  }
  if (pattern.borderFrame) {
    layers.push(createBorderFrameLayer(palette.accent));
  }

  // 7. Add subject image placeholder
  layers.push(createImagePlaceholder(canvasWidth, canvasHeight));

  // 8. Build metadata
  const metadata: DesignMetadata = {
    category: pattern.id,
    mood: pattern.mood,
    targetPlatform: platform,
  };

  return {
    canvas: { width: canvasWidth, height: canvasHeight },
    background: cloneBackground(pattern.background),
    layers,
    metadata,
  };
}

// ---------------------------------------------------------------------------
// designToActions
// ---------------------------------------------------------------------------

/**
 * Convert a ThumbnailDesign into an array of executable EditorActions.
 *
 * The action sequence:
 * 1. Background action (gradient, solid fill via gradient, or pattern)
 * 2. Layer actions for each layer in the design (bottom to top)
 *    - Text layers: createTextLayer + setTextProperties + setLayerEffects + setLayerPosition
 *    - Shape layers: addConcentrationLines or addBorderFrame
 *    - Image layers: skipped (placeholders only)
 *
 * @param design - A valid ThumbnailDesign object.
 * @returns An ordered array of EditorActions.
 *
 * @example
 * ```ts
 * const actions = designToActions(design);
 * executeActions(actions); // applies all actions to the editor
 * ```
 */
export function designToActions(design: ThumbnailDesign): EditorAction[] {
  const actions: EditorAction[] = [];

  // 1. Background
  actions.push(...backgroundToActions(design.background));

  // 2. Layers (bottom to top)
  for (const layer of design.layers) {
    actions.push(...layerToActions(layer));
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Internal: Background -> Actions
// ---------------------------------------------------------------------------

/**
 * Convert a background design into editor actions.
 * @param bg - Background design specification.
 * @returns Array of EditorAction for the background.
 */
function backgroundToActions(bg: BackgroundDesign): EditorAction[] {
  switch (bg.type) {
    case 'solid': {
      // Use a 2-stop gradient with the same color for solid fills
      const c = bg.color;
      const stop: GradientStopDef = {
        position: 0,
        r: c.r,
        g: c.g,
        b: c.b,
        a: Math.round(c.a * 255),
      };
      return [{
        type: 'addGradientBackground',
        params: {
          stops: [stop, { ...stop, position: 1 }],
          gradientType: 'linear',
          angle: 0,
        },
      }];
    }
    case 'gradient': {
      const stops: GradientStopDef[] = bg.stops.map((s) => ({
        position: s.position,
        r: s.color.r,
        g: s.color.g,
        b: s.color.b,
        a: Math.round(s.color.a * 255),
      }));
      return [{
        type: 'addGradientBackground',
        params: {
          stops,
          gradientType: bg.gradientType,
          angle: bg.angle,
        },
      }];
    }
    case 'pattern': {
      const actions: EditorAction[] = [];
      // If pattern has a background color, add it first as solid
      if (bg.backgroundColor) {
        const c = bg.backgroundColor;
        const stop: GradientStopDef = {
          position: 0,
          r: c.r,
          g: c.g,
          b: c.b,
          a: Math.round(c.a * 255),
        };
        actions.push({
          type: 'addGradientBackground',
          params: {
            stops: [stop, { ...stop, position: 1 }],
            gradientType: 'linear',
            angle: 0,
          },
        });
      }
      const pc = bg.color;
      const colorDef: ColorDef = { r: pc.r, g: pc.g, b: pc.b, a: Math.round(pc.a * 255) };
      actions.push({
        type: 'addPattern',
        params: {
          pattern: bg.pattern,
          color: colorDef,
          spacing: bg.spacing,
          size: bg.size,
          opacity: bg.opacity,
        },
      });
      return actions;
    }
  }
}

// ---------------------------------------------------------------------------
// Internal: Layer -> Actions
// ---------------------------------------------------------------------------

/**
 * Convert a single layer design into editor actions.
 * @param layer - Layer design specification.
 * @returns Array of EditorAction for the layer.
 */
function layerToActions(layer: LayerDesign): EditorAction[] {
  switch (layer.kind) {
    case 'text':
      return textLayerToActions(layer);
    case 'image':
      return imageLayerToActions(layer);
    case 'shape':
      return shapeLayerToActions(layer);
  }
}

/**
 * Convert a text layer design into editor actions.
 * @param layer - Text layer design.
 * @returns Array of EditorAction for a text layer.
 */
function textLayerToActions(layer: TextLayerDesign): EditorAction[] {
  const actions: EditorAction[] = [];

  // Create the text layer
  actions.push({
    type: 'createTextLayer',
    params: {
      name: layer.name,
      text: layer.text,
      x: layer.x,
      y: layer.y,
    },
  });

  // Set text properties
  // Note: layerId is not yet known at design time, so we use a placeholder.
  // The dispatcher sets text properties on the most recently created (selected) layer.
  // We use a sentinel layerId that the consumer should replace with the actual ID
  // from the createTextLayer result.
  const textProps: Record<string, unknown> = {
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    color: layer.color,
    bold: layer.bold,
    italic: layer.italic,
    alignment: layer.alignment,
  };

  actions.push({
    type: 'setTextProperties',
    params: {
      layerId: '__last_created__',
      properties: textProps,
    },
  });

  // Set effects if any
  if (layer.effects.length > 0) {
    actions.push({
      type: 'setLayerEffects',
      params: {
        layerId: '__last_created__',
        effects: [...layer.effects],
      },
    });
  }

  return actions;
}

/**
 * Convert an image placeholder layer into editor actions.
 * Image placeholders produce no actions (user fills them manually).
 * @param _layer - Image layer design (unused).
 * @returns Empty array.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function imageLayerToActions(_layer: ImageLayerDesign): EditorAction[] {
  // Image placeholders are informational only
  return [];
}

/**
 * Convert a shape layer design into editor actions.
 * @param layer - Shape layer design.
 * @returns Array of EditorAction for the shape.
 */
function shapeLayerToActions(layer: ShapeLayerDesign): EditorAction[] {
  switch (layer.shapeType) {
    case 'concentration-lines': {
      const p = layer.params;
      return [{
        type: 'addConcentrationLines',
        params: {
          centerX: (p.centerX as number) ?? 640,
          centerY: (p.centerY as number) ?? 360,
          lineCount: (p.lineCount as number) ?? 60,
          color: (p.color as ColorDef) ?? { r: 0, g: 0, b: 0, a: 128 },
          innerRadius: (p.innerRadius as number) ?? 150,
          lineWidth: (p.lineWidth as number) ?? 2,
        },
      }];
    }
    case 'border-frame': {
      const p = layer.params;
      return [{
        type: 'addBorderFrame',
        params: {
          borderWidth: (p.borderWidth as number) ?? 6,
          color: (p.color as ColorDef) ?? { r: 255, g: 255, b: 255, a: 255 },
          cornerRadius: (p.cornerRadius as number) ?? 0,
          style: (p.style as string) ?? 'solid',
        },
      }];
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Internal: Helpers
// ---------------------------------------------------------------------------

/**
 * Map a pattern ID to a label text (for "label" role text layers).
 * @param patternId - Design pattern ID.
 * @returns Appropriate label text.
 */
function mapLabelText(patternId: string): string {
  const labels: Record<string, string> = {
    news: '[ BREAKING NEWS ]',
    howto: '[ HOW TO ]',
    vlog: '[ VLOG ]',
    product: '[ REVIEW ]',
    gaming: '[ GAME ]',
    comparison: '[ VS ]',
  };
  return labels[patternId] ?? '';
}

/**
 * Create a concentration lines shape layer for the given canvas dimensions.
 * @param canvasWidth - Canvas width in pixels.
 * @param canvasHeight - Canvas height in pixels.
 * @returns A ShapeLayerDesign for concentration lines.
 */
function createConcentrationLinesLayer(canvasWidth: number, canvasHeight: number): ShapeLayerDesign {
  return {
    kind: 'shape',
    name: 'Concentration Lines',
    shapeType: 'concentration-lines',
    params: {
      centerX: Math.round(canvasWidth / 2),
      centerY: Math.round(canvasHeight / 2),
      lineCount: 60,
      color: { r: 0, g: 0, b: 0, a: 80 } as ColorDef,
      innerRadius: Math.round(Math.min(canvasWidth, canvasHeight) * 0.2),
      lineWidth: 2,
    },
  };
}

/**
 * Create a border frame shape layer with the given accent color.
 * @param accentColor - Accent color from the palette.
 * @returns A ShapeLayerDesign for a border frame.
 */
function createBorderFrameLayer(accentColor: { r: number; g: number; b: number; a: number }): ShapeLayerDesign {
  return {
    kind: 'shape',
    name: 'Border Frame',
    shapeType: 'border-frame',
    params: {
      borderWidth: 6,
      color: { r: accentColor.r, g: accentColor.g, b: accentColor.b, a: Math.round(accentColor.a * 255) } as ColorDef,
      cornerRadius: 0,
      style: 'solid',
    },
  };
}

/**
 * Create an image placeholder layer centered in the canvas.
 * @param canvasWidth - Canvas width in pixels.
 * @param canvasHeight - Canvas height in pixels.
 * @returns An ImageLayerDesign placeholder.
 */
function createImagePlaceholder(canvasWidth: number, canvasHeight: number): ImageLayerDesign {
  const placeholderWidth = Math.round(canvasWidth * 0.4);
  const placeholderHeight = Math.round(canvasHeight * 0.7);
  return {
    kind: 'image',
    name: 'Subject Image',
    x: Math.round((canvasWidth - placeholderWidth) / 2),
    y: Math.round((canvasHeight - placeholderHeight) / 2),
    width: placeholderWidth,
    height: placeholderHeight,
    description: 'Main subject image (add manually or via AI cutout)',
  };
}

/**
 * Deep-clone a BackgroundDesign to avoid mutating the pattern database.
 * @param bg - Background to clone.
 * @returns A new BackgroundDesign object.
 */
function cloneBackground(bg: BackgroundDesign): BackgroundDesign {
  switch (bg.type) {
    case 'solid':
      return { type: 'solid', color: { ...bg.color } };
    case 'gradient':
      return {
        type: 'gradient',
        gradientType: bg.gradientType,
        angle: bg.angle,
        stops: bg.stops.map((s) => ({ position: s.position, color: { ...s.color } })),
      } as GradientBackground;
    case 'pattern':
      return {
        type: 'pattern',
        pattern: bg.pattern,
        color: { ...bg.color },
        spacing: bg.spacing,
        size: bg.size,
        opacity: bg.opacity,
        backgroundColor: bg.backgroundColor ? { ...bg.backgroundColor } : undefined,
      } as PatternBackground;
  }
}
