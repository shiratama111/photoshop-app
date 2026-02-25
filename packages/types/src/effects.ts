/**
 * @module effects
 * Layer effect (layer style) type definitions.
 * Effects are non-destructive visual modifications applied during rendering.
 */

import type { Color } from './common';

/** Discriminator for effect types. */
export type EffectType =
  | 'stroke'
  | 'drop-shadow'
  | 'outer-glow'
  | 'inner-shadow'
  | 'inner-glow'
  | 'color-overlay'
  | 'gradient-overlay'
  | 'bevel-emboss';

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

/** Inner shadow effect — renders a shadow inside the layer. */
export interface InnerShadowEffect extends BaseEffect {
  type: 'inner-shadow';
  /** Shadow color. */
  color: Color;
  /** Shadow opacity (0-1). */
  opacity: number;
  /** Angle in degrees (0-360, where 0 = right). */
  angle: number;
  /** Distance from the edge in pixels. */
  distance: number;
  /** Blur radius in pixels. */
  blur: number;
  /** Choke percentage (0-100). */
  choke: number;
}

/** Inner glow effect — renders a glow inside the layer. */
export interface InnerGlowEffect extends BaseEffect {
  type: 'inner-glow';
  /** Glow color. */
  color: Color;
  /** Glow opacity (0-1). */
  opacity: number;
  /** Size of the glow in pixels. */
  size: number;
  /** Choke percentage (0-100). */
  choke: number;
  /** Source of the glow. */
  source: 'center' | 'edge';
}

/** Color overlay effect — fills the layer with a solid color. */
export interface ColorOverlayEffect extends BaseEffect {
  type: 'color-overlay';
  /** Overlay color. */
  color: Color;
  /** Overlay opacity (0-1). */
  opacity: number;
}

/** Gradient overlay effect — fills the layer with a gradient. */
export interface GradientOverlayEffect extends BaseEffect {
  type: 'gradient-overlay';
  /** Gradient opacity (0-1). */
  opacity: number;
  /** Gradient angle in degrees. */
  angle: number;
  /** Gradient type. */
  gradientType: 'linear' | 'radial';
  /** Gradient color stops. */
  stops: Array<{ position: number; color: Color }>;
  /** Whether to reverse the gradient. */
  reverse: boolean;
  /** Scale percentage (10-150). */
  scale: number;
}

/** Bevel direction. */
export type BevelDirection = 'up' | 'down';

/** Bevel style. */
export type BevelStyle = 'outer-bevel' | 'inner-bevel' | 'emboss' | 'pillow-emboss' | 'stroke-emboss';

/** Bevel & Emboss effect — adds depth/3D look to the layer. */
export interface BevelEmbossEffect extends BaseEffect {
  type: 'bevel-emboss';
  /** Bevel style. */
  style: BevelStyle;
  /** Depth percentage (1-1000). */
  depth: number;
  /** Direction of the bevel. */
  direction: BevelDirection;
  /** Size in pixels. */
  size: number;
  /** Soften in pixels. */
  soften: number;
  /** Angle in degrees. */
  angle: number;
  /** Altitude in degrees (0-90). */
  altitude: number;
  /** Highlight color. */
  highlightColor: Color;
  /** Highlight opacity (0-1). */
  highlightOpacity: number;
  /** Shadow color. */
  shadowColor: Color;
  /** Shadow opacity (0-1). */
  shadowOpacity: number;
}

/** Union type for all layer effects. */
export type LayerEffect =
  | StrokeEffect
  | DropShadowEffect
  | OuterGlowEffect
  | InnerShadowEffect
  | InnerGlowEffect
  | ColorOverlayEffect
  | GradientOverlayEffect
  | BevelEmbossEffect;
