/**
 * @module effect-mapper
 * Maps Photoshop ASL descriptor effect keys to internal LayerEffect types.
 *
 * Photoshop effect key mapping:
 * - DrSh → DropShadowEffect
 * - OrGl → OuterGlowEffect
 * - FrFX → StrokeEffect
 * - Other keys (IrSh, IrGl, ChFX, SoFi, GrFl, patternFill, BvlE, ebbl, satin)
 *   are not supported and added to skippedEffects.
 *
 * @see {@link @photoshop-app/types!LayerEffect}
 */

import type {
  Color,
  DropShadowEffect,
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
const SUPPORTED_EFFECTS = new Set(['DrSh', 'OrGl', 'FrFX']);

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
    case 'OrGl':
      return { effect: mapOuterGlow(items, enabled) };
    case 'FrFX':
      return { effect: mapStroke(items, enabled) };
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
  const angle = getNumber(items, 'lagl') ?? 120;
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

/**
 * Normalize a Photoshop percent value (0-100) to 0-1 range.
 */
function normalizePercent(value: number | undefined): number {
  if (value === undefined) return 1;
  return Math.max(0, Math.min(1, value / 100));
}
