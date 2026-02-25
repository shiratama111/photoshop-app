/**
 * @module layer-mapper
 * Maps ag-psd layer structures to internal Layer types.
 *
 * ag-psd uses its own layer representation. This module converts
 * ag-psd Layer objects to our internal RasterLayer / TextLayer / LayerGroup types.
 *
 * @see {@link @photoshop-app/types!Layer}
 */

import type {
  BevelEmbossEffect,
  BlendMode,
  CompatibilityIssue,
  LayerEffect,
  Layer,
  LayerGroup,
  LayerMask,
  PsdImportOptions,
  RasterLayer,
  TextLayer,
} from '@photoshop-app/types';
import type {
  Color as AgColor,
  Layer as AgLayer,
  LayerEffectBevel,
  LayerEffectGradientOverlay,
  LayerEffectInnerGlow,
  LayerEffectShadow,
  LayerEffectSolidFill,
  LayerEffectStroke,
  LayerEffectsInfo,
  LayerEffectsOuterGlow,
  UnitsValue,
} from 'ag-psd';

/** ag-psd blend mode string → our BlendMode enum value. */
const BLEND_MODE_MAP: Record<string, BlendMode> = {
  'normal': 'normal' as BlendMode,
  'multiply': 'multiply' as BlendMode,
  'screen': 'screen' as BlendMode,
  'overlay': 'overlay' as BlendMode,
  'darken': 'darken' as BlendMode,
  'lighten': 'lighten' as BlendMode,
  'color-dodge': 'color-dodge' as BlendMode,
  'color-burn': 'color-burn' as BlendMode,
  'hard-light': 'hard-light' as BlendMode,
  'soft-light': 'soft-light' as BlendMode,
  'difference': 'difference' as BlendMode,
  'exclusion': 'exclusion' as BlendMode,
  'hue': 'hue' as BlendMode,
  'saturation': 'saturation' as BlendMode,
  'color': 'color' as BlendMode,
  'luminosity': 'luminosity' as BlendMode,
  // ag-psd sometimes uses different names:
  'dissolve': 'normal' as BlendMode,
  'linear dodge': 'lighten' as BlendMode,
  'linear burn': 'darken' as BlendMode,
  'vivid light': 'hard-light' as BlendMode,
  'linear light': 'hard-light' as BlendMode,
  'pin light': 'hard-light' as BlendMode,
  'hard mix': 'hard-light' as BlendMode,
  'pass through': 'normal' as BlendMode,
};

/**
 * Map a single ag-psd layer to our internal Layer type.
 * @param agLayer - ag-psd layer object.
 * @param parentId - ID of the parent group.
 * @param options - Import options.
 * @param issues - Accumulated compatibility issues.
 * @returns Internal Layer object.
 */
export function mapLayer(
  agLayer: AgLayer,
  parentId: string | null,
  options: PsdImportOptions,
  issues: CompatibilityIssue[],
): Layer {
  // Determine if this is a group
  if (agLayer.children && agLayer.children.length > 0) {
    return mapGroupLayer(agLayer, parentId, options, issues);
  }

  // Text layer
  if (agLayer.text && !options.rasterizeText) {
    return mapTextLayer(agLayer, parentId, issues);
  }

  // Default: raster layer
  return mapRasterLayer(agLayer, parentId, issues);
}

function mapGroupLayer(
  agLayer: AgLayer,
  parentId: string | null,
  options: PsdImportOptions,
  issues: CompatibilityIssue[],
): LayerGroup {
  const id = crypto.randomUUID();

  const children: Layer[] = [];
  if (agLayer.children) {
    for (const child of agLayer.children) {
      children.push(mapLayer(child, id, options, issues));
    }
  }

  return {
    id,
    name: agLayer.name ?? 'Group',
    type: 'group',
    visible: !agLayer.hidden,
    opacity: agLayer.opacity ?? 1,
    blendMode: mapBlendMode(agLayer.blendMode),
    position: { x: agLayer.left ?? 0, y: agLayer.top ?? 0 },
    locked: false,
    effects: mapLayerEffects(agLayer.effects, issues, agLayer.name),
    parentId,
    children,
    expanded: !(agLayer.opened === false),
  };
}

function mapRasterLayer(
  agLayer: AgLayer,
  parentId: string | null,
  issues: CompatibilityIssue[],
): RasterLayer {
  const id = crypto.randomUUID();
  const left = agLayer.left ?? 0;
  const top = agLayer.top ?? 0;
  const right = agLayer.right ?? left;
  const bottom = agLayer.bottom ?? top;
  const width = right - left;
  const height = bottom - top;

  // Check for smart object
  if (agLayer.placedLayer) {
    issues.push({
      severity: 'warning',
      message: 'Smart object rasterized on import',
      layerName: agLayer.name,
      feature: 'smart-object',
    });
  }

  // Extract image data
  let imageData: ImageData | null = null;
  if (agLayer.canvas) {
    try {
      const ctx = agLayer.canvas.getContext('2d');
      if (ctx && width > 0 && height > 0) {
        imageData = ctx.getImageData(0, 0, width, height);
      }
    } catch {
      // Canvas not available in Node environment
      issues.push({
        severity: 'info',
        message: 'Could not extract canvas data',
        layerName: agLayer.name,
        feature: 'canvas-extraction',
      });
    }
  } else if (agLayer.imageData) {
    // ag-psd may provide raw image data
    if (width > 0 && height > 0) {
      imageData = new ImageData(
        new Uint8ClampedArray(agLayer.imageData.data),
        width,
        height,
      );
    }
  }

  // Map mask
  let mask: LayerMask | undefined;
  if (agLayer.mask && agLayer.mask.canvas) {
    try {
      const maskCanvas = agLayer.mask.canvas;
      const ctx = maskCanvas.getContext('2d');
      if (ctx) {
        const mw = maskCanvas.width;
        const mh = maskCanvas.height;
        if (mw > 0 && mh > 0) {
          const maskImgData = ctx.getImageData(0, 0, mw, mh);
          const alphaChannel = new Uint8Array(mw * mh);
          for (let i = 0; i < mw * mh; i++) {
            alphaChannel[i] = maskImgData.data[i * 4 + 3]; // Alpha channel
          }
          mask = {
            data: alphaChannel,
            width: mw,
            height: mh,
            offset: {
              x: (agLayer.mask.left ?? 0) - left,
              y: (agLayer.mask.top ?? 0) - top,
            },
            enabled: !agLayer.mask.disabled,
          };
        }
      }
    } catch {
      // Mask extraction failed
    }
  }

  return {
    id,
    name: agLayer.name ?? 'Layer',
    type: 'raster',
    visible: !agLayer.hidden,
    opacity: agLayer.opacity ?? 1,
    blendMode: mapBlendMode(agLayer.blendMode),
    position: { x: left, y: top },
    locked: false,
    effects: mapLayerEffects(agLayer.effects, issues, agLayer.name),
    mask,
    parentId,
    imageData,
    bounds: { x: left, y: top, width, height },
  };
}

function mapTextLayer(
  agLayer: AgLayer,
  parentId: string | null,
  issues: CompatibilityIssue[],
): TextLayer {
  const id = crypto.randomUUID();
  const textData = agLayer.text!;

  // Extract font info from the first style run
  const style = textData.style;
  const fontSize = style?.fontSize ?? 24;
  const fontFamily = style?.font?.name ?? 'Arial';
  const bold = style?.fauxBold ?? false;
  const italic = style?.fauxItalic ?? false;

  // Extract color
  const fillColor = style?.fillColor;
  const color = fillColor
    ? { r: fillColor.r ?? 0, g: fillColor.g ?? 0, b: fillColor.b ?? 0, a: 1 }
    : { r: 0, g: 0, b: 0, a: 1 };

  // Warn about unsupported text features
  if (textData.style?.strokeEnabled) {
    issues.push({
      severity: 'info',
      message: 'Text stroke effect not fully supported',
      layerName: agLayer.name,
      feature: 'text-stroke',
    });
  }

  return {
    id,
    name: agLayer.name ?? 'Text',
    type: 'text',
    visible: !agLayer.hidden,
    opacity: agLayer.opacity ?? 1,
    blendMode: mapBlendMode(agLayer.blendMode),
    position: { x: agLayer.left ?? 0, y: agLayer.top ?? 0 },
    locked: false,
    effects: mapLayerEffects(agLayer.effects, issues, agLayer.name),
    parentId,
    text: textData.text ?? '',
    fontFamily,
    fontSize,
    color,
    bold,
    italic,
    alignment: mapAlignment(textData.paragraphStyle?.justification),
    lineHeight: style?.leading ? style.leading / fontSize : 1.2,
    letterSpacing: style?.tracking ? style.tracking / 1000 : 0,
    textBounds: null,
    writingMode: 'horizontal-tb',
    underline: style?.underline ?? false,
    strikethrough: style?.strikethrough ?? false,
  };
}

function mapLayerEffects(
  effectsInfo: LayerEffectsInfo | undefined,
  issues: CompatibilityIssue[],
  layerName?: string,
): LayerEffect[] {
  if (!effectsInfo) return [];

  const effects: LayerEffect[] = [];

  const dropShadow = effectsInfo.dropShadow?.[0];
  if (dropShadow) {
    effects.push(mapDropShadow(dropShadow));
  }

  const innerShadow = effectsInfo.innerShadow?.[0];
  if (innerShadow) {
    effects.push(mapInnerShadow(innerShadow));
  }

  const outerGlow = effectsInfo.outerGlow;
  if (outerGlow) {
    effects.push(mapOuterGlow(outerGlow));
  }

  const innerGlow = effectsInfo.innerGlow;
  if (innerGlow) {
    effects.push(mapInnerGlow(innerGlow));
  }

  const stroke = effectsInfo.stroke?.[0];
  if (stroke) {
    effects.push(mapStroke(stroke));
  }

  const solidFill = effectsInfo.solidFill?.[0];
  if (solidFill) {
    effects.push(mapColorOverlay(solidFill));
  }

  const gradientOverlay = effectsInfo.gradientOverlay?.[0];
  if (gradientOverlay) {
    effects.push(mapGradientOverlay(gradientOverlay, issues, layerName));
  }

  const bevel = effectsInfo.bevel;
  if (bevel) {
    effects.push(mapBevel(bevel));
  }

  return effects;
}

function mapDropShadow(shadow: LayerEffectShadow): LayerEffect {
  return {
    type: 'drop-shadow',
    enabled: shadow.enabled ?? true,
    color: mapColor(shadow.color, { r: 0, g: 0, b: 0, a: 1 }),
    opacity: normalizeOpacity(shadow.opacity, 0.75),
    angle: shadow.angle ?? 120,
    distance: getUnitsNumber(shadow.distance, 5),
    blur: getUnitsNumber(shadow.size, 5),
    spread: getUnitsNumber(shadow.choke, 0),
  };
}

function mapInnerShadow(shadow: LayerEffectShadow): LayerEffect {
  return {
    type: 'inner-shadow',
    enabled: shadow.enabled ?? true,
    color: mapColor(shadow.color, { r: 0, g: 0, b: 0, a: 1 }),
    opacity: normalizeOpacity(shadow.opacity, 0.75),
    angle: shadow.angle ?? 120,
    distance: getUnitsNumber(shadow.distance, 5),
    blur: getUnitsNumber(shadow.size, 5),
    choke: getUnitsNumber(shadow.choke, 0),
  };
}

function mapOuterGlow(glow: LayerEffectsOuterGlow): LayerEffect {
  return {
    type: 'outer-glow',
    enabled: glow.enabled ?? true,
    color: mapColor(glow.color, { r: 255, g: 255, b: 190, a: 1 }),
    opacity: normalizeOpacity(glow.opacity, 0.75),
    size: getUnitsNumber(glow.size, 10),
    spread: getUnitsNumber(glow.choke, 0),
  };
}

function mapInnerGlow(glow: LayerEffectInnerGlow): LayerEffect {
  return {
    type: 'inner-glow',
    enabled: glow.enabled ?? true,
    color: mapColor(glow.color, { r: 255, g: 255, b: 190, a: 1 }),
    opacity: normalizeOpacity(glow.opacity, 0.75),
    size: getUnitsNumber(glow.size, 10),
    choke: getUnitsNumber(glow.choke, 0),
    source: glow.source === 'center' ? 'center' : 'edge',
  };
}

function mapStroke(stroke: LayerEffectStroke): LayerEffect {
  return {
    type: 'stroke',
    enabled: stroke.enabled ?? true,
    color: mapColor(stroke.color, { r: 0, g: 0, b: 0, a: 1 }),
    size: getUnitsNumber(stroke.size, 3),
    position: stroke.position ?? 'outside',
    opacity: normalizeOpacity(stroke.opacity, 1),
  };
}

function mapColorOverlay(fill: LayerEffectSolidFill): LayerEffect {
  return {
    type: 'color-overlay',
    enabled: fill.enabled ?? true,
    color: mapColor(fill.color, { r: 255, g: 0, b: 0, a: 1 }),
    opacity: normalizeOpacity(fill.opacity, 1),
  };
}

function mapGradientOverlay(
  gradientOverlay: LayerEffectGradientOverlay,
  issues: CompatibilityIssue[],
  layerName?: string,
): LayerEffect {
  const style = gradientOverlay.type ?? 'linear';
  const gradientType = style === 'radial' ? 'radial' : 'linear';
  if (style !== 'linear' && style !== 'radial') {
    issues.push({
      severity: 'info',
      message: `Gradient overlay style "${style}" mapped to linear`,
      layerName,
      feature: 'gradient-overlay-style',
    });
  }

  const gradient = gradientOverlay.gradient;
  const rawStops =
    gradient && gradient.type === 'solid' && Array.isArray(gradient.colorStops)
      ? gradient.colorStops
      : [];

  const stops =
    rawStops.length > 0
      ? rawStops
        .map((s) => ({
          position: normalizeStopPosition(s.location),
          color: mapColor(s.color, { r: 255, g: 255, b: 255, a: 1 }),
        }))
        .sort((a, b) => a.position - b.position)
      : [
        { position: 0, color: { r: 255, g: 255, b: 255, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
      ];

  return {
    type: 'gradient-overlay',
    enabled: gradientOverlay.enabled ?? true,
    opacity: normalizeOpacity(gradientOverlay.opacity, 1),
    angle: (gradientOverlay as { angle?: number }).angle ?? 90,
    gradientType,
    stops,
    reverse: gradientOverlay.reverse ?? false,
    scale: clamp(Math.round(gradientOverlay.scale ?? 100), 10, 150),
  };
}

function mapBevel(bevel: LayerEffectBevel): LayerEffect {
  return {
    type: 'bevel-emboss',
    enabled: bevel.enabled ?? true,
    style: mapBevelStyle(bevel.style),
    depth: clamp(Math.round(bevel.strength ?? 100), 1, 1000),
    direction: bevel.direction === 'down' ? 'down' : 'up',
    size: getUnitsNumber(bevel.size, 5),
    soften: getUnitsNumber(bevel.soften, 0),
    angle: bevel.angle ?? 120,
    altitude: clamp(Math.round(bevel.altitude ?? 30), 0, 90),
    highlightColor: mapColor(bevel.highlightColor, { r: 255, g: 255, b: 255, a: 1 }),
    highlightOpacity: normalizeOpacity(bevel.highlightOpacity, 0.75),
    shadowColor: mapColor(bevel.shadowColor, { r: 0, g: 0, b: 0, a: 1 }),
    shadowOpacity: normalizeOpacity(bevel.shadowOpacity, 0.75),
  };
}

function mapBevelStyle(style: LayerEffectBevel['style']): BevelEmbossEffect['style'] {
  switch (style) {
    case 'outer bevel':
      return 'outer-bevel';
    case 'emboss':
      return 'emboss';
    case 'pillow emboss':
      return 'pillow-emboss';
    case 'stroke emboss':
      return 'stroke-emboss';
    case 'inner bevel':
    default:
      return 'inner-bevel';
  }
}

function getUnitsNumber(value: number | UnitsValue | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return value;
  if (typeof value.value === 'number') return value.value;
  return fallback;
}

function normalizeOpacity(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  if (value > 1) return clamp(value / 100, 0, 1);
  return clamp(value, 0, 1);
}

function normalizeStopPosition(location: number | undefined): number {
  if (location === undefined || Number.isNaN(location)) return 0;
  if (location > 1) return clamp(location / 4096, 0, 1);
  return clamp(location, 0, 1);
}

function mapColor(color: AgColor | undefined, fallback: { r: number; g: number; b: number; a: number }) {
  if (!color) return fallback;
  const c = color as Partial<{
    r: number;
    g: number;
    b: number;
    a: number;
    fr: number;
    fg: number;
    fb: number;
    k: number;
  }>;

  const toChannel = (v: number | undefined): number | undefined => {
    if (v === undefined || Number.isNaN(v)) return undefined;
    return v <= 1 ? v * 255 : v;
  };

  const gray = toChannel(c.k);
  const r = toChannel(c.r) ?? toChannel(c.fr) ?? gray ?? fallback.r;
  const g = toChannel(c.g) ?? toChannel(c.fg) ?? gray ?? fallback.g;
  const b = toChannel(c.b) ?? toChannel(c.fb) ?? gray ?? fallback.b;
  const a = c.a === undefined ? fallback.a : c.a > 1 ? c.a / 255 : c.a;

  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
    a: clamp(a, 0, 1),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapBlendMode(mode: string | undefined): BlendMode {
  if (!mode) return 'normal' as BlendMode;
  return BLEND_MODE_MAP[mode] ?? ('normal' as BlendMode);
}

function mapAlignment(justification: string | undefined): 'left' | 'center' | 'right' | 'justify' {
  switch (justification) {
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    case 'justifyAll':
    case 'justifyLeft':
    case 'justifyCenter':
    case 'justifyRight':
      return 'justify';
    default:
      return 'left';
  }
}
