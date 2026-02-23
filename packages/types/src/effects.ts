/**
 * @module effects
 * Layer effect (layer style) type definitions.
 * Effects are non-destructive visual modifications applied during rendering.
 */

import type { Color } from './common';

/** Discriminator for effect types. */
export type EffectType = 'stroke' | 'drop-shadow' | 'outer-glow';

/** Base properties shared by all effects. */
export interface BaseEffect {
  /** Effect type discriminator. */
  type: EffectType;
  /** Whether the effect is enabled. */
  enabled: boolean;
}

/** Stroke position relative to the layer edge. */
export type StrokePosition = 'inside' | 'center' | 'outside';

/** Stroke effect — draws an outline around the layer content. */
export interface StrokeEffect extends BaseEffect {
  type: 'stroke';
  /** Stroke color. */
  color: Color;
  /** Stroke width in pixels. */
  size: number;
  /** Position of the stroke relative to the edge. */
  position: StrokePosition;
  /** Stroke opacity (0-1). */
  opacity: number;
}

/** Drop shadow effect — renders a shadow behind the layer. */
export interface DropShadowEffect extends BaseEffect {
  type: 'drop-shadow';
  /** Shadow color. */
  color: Color;
  /** Shadow opacity (0-1). */
  opacity: number;
  /** Angle in degrees (0-360, where 0 = right). */
  angle: number;
  /** Distance from the layer in pixels. */
  distance: number;
  /** Blur radius in pixels. */
  blur: number;
  /** Spread percentage (0-100). */
  spread: number;
}

/** Outer glow effect — renders a glow around the layer. */
export interface OuterGlowEffect extends BaseEffect {
  type: 'outer-glow';
  /** Glow color. */
  color: Color;
  /** Glow opacity (0-1). */
  opacity: number;
  /** Blur/size of the glow in pixels. */
  size: number;
  /** Spread percentage (0-100). */
  spread: number;
}

/** Union type for all layer effects. */
export type LayerEffect = StrokeEffect | DropShadowEffect | OuterGlowEffect;
