/**
 * @module effect-mapper
 * Maps Photoshop ASL descriptor effect keys to internal LayerEffect types.
 *
 * Supported Photoshop effect keys:
 * - DrSh -> drop-shadow
 * - IrSh -> inner-shadow
 * - OrGl -> outer-glow
 * - IrGl -> inner-glow
 * - ChFX -> color-overlay
 * - GrFl -> gradient-overlay
 * - FrFX -> stroke
 * - BvlE -> bevel-emboss
 */

import type {
  BevelEmbossEffect,
  Color,
  ColorOverlayEffect,
  DropShadowEffect,
  GradientOverlayEffect,
  InnerGlowEffect,
  InnerShadowEffect,
  LayerEffect,
  OuterGlowEffect,
  StrokeEffect,
  StrokePosition,
} from '@photoshop-app/types';
import type { DescriptorValue } from './descriptor-reader';
import { getBool, getColor, getEnum, getNumber } from './descriptor-reader';

/** Result of mapping effects from a single style descriptor. */
export interface EffectMappingResult {
  effects: LayerEffect[];
  skipped: string[];
}

/** Photoshop effect keys we support. */
const SUPPORTED_EFFECTS = new Set(['DrSh', 'IrSh', 'OrGl', 'IrGl', 'ChFX', 'GrFl', 'FrFX', 'BvlE']);

/** Photoshop effect key to human-readable name. */
const EFFECT_NAMES: Record<string, string> = {
  DrSh: 'Drop Shadow',
  IrSh: 'Inner Shadow',
  OrGl: 'Outer Glow',
  IrGl: 'Inner Glow',
  ChFX: 'Color Overlay',
  SoFi: 'Satin',
  GrFl: 'Gradient Overlay',
  patternFill: 'Pattern Overlay',
  FrFX: 'Stroke',
  BvlE: 'Bevel and Emboss',
  ebbl: 'Emboss',
};

/**
 * Map a Photoshop effect descriptor to internal LayerEffect types.
 * @param key - The Photoshop effect key (e.g. 'DrSh').
 * @param items - The effect's descriptor items.
 * @returns Mapped effect or null if unsupported.
 */
export function mapEffect(
  key: string,
  items: Map<string, DescriptorValue>,
): { effect: LayerEffect } | { skipped: string } {
  if (!SUPPORTED_EFFECTS.has(key)) {
    const name = EFFECT_NAMES[key] ?? key;
    return { skipped: name };
  }

  const enabled = getBool(items, 'enab') ?? true;

  switch (key) {
    case 'DrSh':
      return { effect: mapDropShadow(items, enabled) };
    case 'IrSh':
      return { effect: mapInnerShadow(items, enabled) };
    case 'OrGl':
      return { effect: mapOuterGlow(items, enabled) };
    case 'IrGl':
      return { effect: mapInnerGlow(items, enabled) };
    case 'ChFX':
      return { effect: mapColorOverlay(items, enabled) };
    case 'GrFl':
      return { effect: mapGradientOverlay(items, enabled) };
    case 'FrFX':
      return { effect: mapStroke(items, enabled) };
    case 'BvlE':
      return { effect: mapBevelEmboss(items, enabled) };
    default:
      return { skipped: key };
  }
}

/**
 * Map a batch of effects from a style's effects list.
 */
export function mapEffects(
  effectEntries: Array<{ key: string; items: Map<string, DescriptorValue> }>,
): EffectMappingResult {
  const effects: LayerEffect[] = [];
  const skipped: string[] = [];

  for (const entry of effectEntries) {
    const result = mapEffect(entry.key, entry.items);
    if ('effect' in result) {
      effects.push(result.effect);
    } else {
      skipped.push(result.skipped);
    }
  }

  return { effects, skipped };
}

function mapDropShadow(items: Map<string, DescriptorValue>, enabled: boolean): DropShadowEffect {
  const color = getColor(items, 'Clr ') ?? { r: 0, g: 0, b: 0, a: 1 };
  const opacity = normalizePercent(getNumber(items, 'Opct'));
  const angle = getNumber(items, 'Angl') ?? getNumber(items, 'lagl') ?? 120;
  const distance = getNumber(items, 'Dstn') ?? 5;
  const blur = getNumber(items, 'blur') ?? 5;
  const spread = getNumber(items, 'Ckmt') ?? 0;

  return {
    type: 'drop-shadow',
    enabled,
    color: color as Color,
    opacity,
    angle,
    distance,
    blur,
    spread,
  };
}

function mapInnerShadow(items: Map<string, DescriptorValue>, enabled: boolean): InnerShadowEffect {
  const color = getColor(items, 'Clr ') ?? { r: 0, g: 0, b: 0, a: 1 };
  const opacity = normalizePercent(getNumber(items, 'Opct'));
  const angle = getNumber(items, 'Angl') ?? getNumber(items, 'lagl') ?? 120;
  const distance = getNumber(items, 'Dstn') ?? 5;
  const blur = getNumber(items, 'blur') ?? 5;
  const choke = getNumber(items, 'Ckmt') ?? 0;

  return {
    type: 'inner-shadow',
    enabled,
    color: color as Color,
    opacity,
    angle,
    distance,
    blur,
    choke,
  };
}

function mapOuterGlow(items: Map<string, DescriptorValue>, enabled: boolean): OuterGlowEffect {
  const color = getColor(items, 'Clr ') ?? { r: 255, g: 255, b: 190, a: 1 };
  const opacity = normalizePercent(getNumber(items, 'Opct'));
  const size = getNumber(items, 'blur') ?? 5;
  const spread = getNumber(items, 'Ckmt') ?? 0;

  return {
    type: 'outer-glow',
    enabled,
    color: color as Color,
    opacity,
    size,
    spread,
  };
}

function mapInnerGlow(items: Map<string, DescriptorValue>, enabled: boolean): InnerGlowEffect {
  const color = getColor(items, 'Clr ') ?? { r: 255, g: 255, b: 190, a: 1 };
  const opacity = normalizePercent(getNumber(items, 'Opct'));
  const size = getNumber(items, 'blur') ?? 5;
  const choke = getNumber(items, 'Ckmt') ?? 0;
  const sourceEnum = getEnum(items, 'glwS') ?? 'SrcE';
  const source = sourceEnum === 'SrcC' || sourceEnum === 'center' ? 'center' : 'edge';

  return {
    type: 'inner-glow',
    enabled,
    color: color as Color,
    opacity,
    size,
    choke,
    source,
  };
}

function mapStroke(items: Map<string, DescriptorValue>, enabled: boolean): StrokeEffect {
  const color = getColor(items, 'Clr ') ?? { r: 0, g: 0, b: 0, a: 1 };
  const opacity = normalizePercent(getNumber(items, 'Opct'));
  const size = getNumber(items, 'Sz  ') ?? 3;
  const posEnum = getEnum(items, 'Styl') ?? 'OutF';

  const positionMap: Record<string, StrokePosition> = {
    InsF: 'inside',
    CtrF: 'center',
    OutF: 'outside',
  };
  const position: StrokePosition = positionMap[posEnum] ?? 'outside';

  return {
    type: 'stroke',
    enabled,
    color: color as Color,
    size,
    position,
    opacity,
  };
}

function mapColorOverlay(items: Map<string, DescriptorValue>, enabled: boolean): ColorOverlayEffect {
  const color = getColor(items, 'Clr ') ?? { r: 255, g: 0, b: 0, a: 1 };
  const opacity = normalizePercent(getNumber(items, 'Opct'));

  return {
    type: 'color-overlay',
    enabled,
    color: color as Color,
    opacity,
  };
}

function mapGradientOverlay(
  items: Map<string, DescriptorValue>,
  enabled: boolean,
): GradientOverlayEffect {
  const opacity = normalizePercent(getNumber(items, 'Opct'));
  const angle = getNumber(items, 'Angl') ?? getNumber(items, 'lagl') ?? 90;
  const gradientTypeEnum = getEnum(items, 'Type') ?? 'Lnr ';
  const gradientType = gradientTypeEnum === 'Rdl ' || gradientTypeEnum === 'radial'
    ? 'radial'
    : 'linear';
  const reverse = getBool(items, 'Rvrs') ?? false;
  const scale = clamp(Math.round(getNumber(items, 'Scl ') ?? 100), 10, 150);
  const stops = parseGradientStops(items.get('Grad'));

  return {
    type: 'gradient-overlay',
    enabled,
    opacity,
    angle,
    gradientType,
    stops,
    reverse,
    scale,
  };
}

function mapBevelEmboss(items: Map<string, DescriptorValue>, enabled: boolean): BevelEmbossEffect {
  const styleEnum = getEnum(items, 'bvlS') ?? 'InrB';
  const directionEnum = getEnum(items, 'bvlD') ?? 'In  ';

  return {
    type: 'bevel-emboss',
    enabled,
    style: mapBevelStyle(styleEnum),
    depth: clamp(Math.round(getNumber(items, 'srgR') ?? 100), 1, 1000),
    direction: directionEnum === 'Out ' || directionEnum === 'down' ? 'down' : 'up',
    size: getNumber(items, 'blur') ?? 5,
    soften: getNumber(items, 'Sftn') ?? 0,
    angle: getNumber(items, 'Angl') ?? getNumber(items, 'lagl') ?? 120,
    altitude: clamp(Math.round(getNumber(items, 'Lald') ?? 30), 0, 90),
    highlightColor: (getColor(items, 'hglC') ?? { r: 255, g: 255, b: 255, a: 1 }) as Color,
    highlightOpacity: normalizePercent(getNumber(items, 'hglO') ?? 75),
    shadowColor: (getColor(items, 'sdwC') ?? { r: 0, g: 0, b: 0, a: 1 }) as Color,
    shadowOpacity: normalizePercent(getNumber(items, 'sdwO') ?? 75),
  };
}

function mapBevelStyle(styleEnum: string): BevelEmbossEffect['style'] {
  switch (styleEnum) {
    case 'OtrB':
    case 'outer bevel':
      return 'outer-bevel';
    case 'Embs':
    case 'emboss':
      return 'emboss';
    case 'PlEb':
    case 'pillow emboss':
      return 'pillow-emboss';
    case 'strokeEmboss':
    case 'stroke emboss':
      return 'stroke-emboss';
    case 'InrB':
    case 'inner bevel':
    default:
      return 'inner-bevel';
  }
}

function parseGradientStops(gradientValue: DescriptorValue | undefined): GradientOverlayEffect['stops'] {
  const defaultStops: GradientOverlayEffect['stops'] = [
    { position: 0, color: { r: 255, g: 255, b: 255, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
  ];

  if (!gradientValue || gradientValue.type !== 'Objc') {
    return defaultStops;
  }

  const gradItems = gradientValue.items;
  const samples = getNumber(gradItems, 'Intr') ?? 4096;
  const colorStops = getList(gradItems, 'Clrs');
  if (!colorStops || colorStops.length === 0) {
    return defaultStops;
  }

  const mappedStops = colorStops
    .map((stop, index) => parseGradientStop(stop, samples, index))
    .filter((stop): stop is GradientOverlayEffect['stops'][number] => stop !== null)
    .sort((a, b) => a.position - b.position);

  return mappedStops.length > 0 ? mappedStops : defaultStops;
}

function parseGradientStop(
  value: DescriptorValue,
  samples: number,
  index: number,
): GradientOverlayEffect['stops'][number] | null {
  if (value.type !== 'Objc') return null;

  const stopItems = value.items;
  const color = getColor(stopItems, 'Clr ') ?? (index === 0
    ? { r: 255, g: 255, b: 255, a: 1 }
    : { r: 0, g: 0, b: 0, a: 1 });
  const rawLocation = getNumber(stopItems, 'Lctn');
  const position = normalizeGradientLocation(rawLocation, samples);

  return { position, color: color as Color };
}

function getList(items: Map<string, DescriptorValue>, key: string): DescriptorValue[] | undefined {
  const value = items.get(key);
  if (!value || value.type !== 'VlLs') return undefined;
  return value.items;
}

function normalizeGradientLocation(location: number | undefined, samples: number): number {
  if (location === undefined || Number.isNaN(location)) return 0;
  if (samples > 0) return clamp(location / samples, 0, 1);
  return clamp(location > 1 ? location / 4096 : location, 0, 1);
}

/**
 * Normalize a Photoshop percent value (0-100) to 0-1 range.
 */
function normalizePercent(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 1;
  if (value > 1) return clamp(value / 100, 0, 1);
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
