/**
 * @module background-presets
 * Gradient and pattern background preset definitions for the BackgroundDialog.
 *
 * Each gradient preset contains a name, gradient stops, type, and angle.
 * Each pattern preset contains a name, pattern type, and pattern-specific configuration.
 * Stops use the GradientStop format (RGBA 0-255).
 *
 * @see Phase 1-3: Background & atmosphere tools
 * @see BG-001: Pattern overlay & background expansion
 */

import type { GradientStop, GradientType } from '@photoshop-app/core';
import type { PatternColor } from './pattern-generator';

export interface BackgroundPreset {
  name: string;
  nameKey: string;
  stops: GradientStop[];
  type: GradientType;
  angle: number;
}

/** Supported procedural pattern types for pattern presets. */
export type PatternPresetType = 'dots' | 'stripes' | 'checkerboard' | 'hatching';

/** Pattern preset definition. */
export interface PatternPreset {
  /** Display name. */
  name: string;
  /** i18n key for the display name. */
  nameKey: string;
  /** Pattern type. */
  patternType: PatternPresetType;
  /** Pattern-specific configuration (width/height/opacity are applied at runtime). */
  config: PatternPresetConfig;
}

/** Union of pattern-specific configuration parameters (excluding width/height/opacity). */
export type PatternPresetConfig =
  | { type: 'dots'; dotSize: number; spacing: number; color: PatternColor }
  | { type: 'stripes'; stripeWidth: number; gap: number; color: PatternColor; angle: number }
  | { type: 'checkerboard'; cellSize: number; color1: PatternColor; color2: PatternColor }
  | { type: 'hatching'; lineWidth: number; spacing: number; angle: number; color: PatternColor };

function hexToStop(hex: string, position: number): GradientStop {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { position, r, g, b, a: 255 };
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    name: 'Sunset',
    nameKey: 'background.preset.sunset',
    stops: [
      hexToStop('#FF6B35', 0),
      hexToStop('#F7C59F', 0.5),
      hexToStop('#EFEFD0', 1),
    ],
    type: 'linear',
    angle: 135,
  },
  {
    name: 'Ocean',
    nameKey: 'background.preset.ocean',
    stops: [
      hexToStop('#0077B6', 0),
      hexToStop('#00B4D8', 0.5),
      hexToStop('#90E0EF', 1),
    ],
    type: 'linear',
    angle: 180,
  },
  {
    name: 'Night Sky',
    nameKey: 'background.preset.nightSky',
    stops: [
      hexToStop('#0D1B2A', 0),
      hexToStop('#1B263B', 0.5),
      hexToStop('#415A77', 1),
    ],
    type: 'radial',
    angle: 0,
  },
  {
    name: 'Sakura',
    nameKey: 'background.preset.sakura',
    stops: [
      hexToStop('#FFB7C5', 0),
      hexToStop('#FF69B4', 0.5),
      hexToStop('#FFE4E1', 1),
    ],
    type: 'linear',
    angle: 135,
  },
  {
    name: 'Neon',
    nameKey: 'background.preset.neon',
    stops: [
      hexToStop('#FF006E', 0),
      hexToStop('#8338EC', 0.5),
      hexToStop('#3A86FF', 1),
    ],
    type: 'linear',
    angle: 45,
  },
  {
    name: 'Forest',
    nameKey: 'background.preset.forest',
    stops: [
      hexToStop('#2D6A4F', 0),
      hexToStop('#52B788', 0.5),
      hexToStop('#95D5B2', 1),
    ],
    type: 'linear',
    angle: 180,
  },
  {
    name: 'Fire',
    nameKey: 'background.preset.fire',
    stops: [
      hexToStop('#FFBA08', 0),
      hexToStop('#E85D04', 0.5),
      hexToStop('#9D0208', 1),
    ],
    type: 'radial',
    angle: 0,
  },
  {
    name: 'Minimal Light',
    nameKey: 'background.preset.minimalLight',
    stops: [
      hexToStop('#F8F9FA', 0),
      hexToStop('#E9ECEF', 1),
    ],
    type: 'linear',
    angle: 180,
  },
  {
    name: 'Minimal Dark',
    nameKey: 'background.preset.minimalDark',
    stops: [
      hexToStop('#212529', 0),
      hexToStop('#343A40', 1),
    ],
    type: 'linear',
    angle: 180,
  },
  {
    name: 'YouTube Red',
    nameKey: 'background.preset.youtubeRed',
    stops: [
      hexToStop('#FF0000', 0),
      hexToStop('#CC0000', 1),
    ],
    type: 'linear',
    angle: 135,
  },
  {
    name: 'Vaporwave',
    nameKey: 'background.preset.vaporwave',
    stops: [
      hexToStop('#FF71CE', 0),
      hexToStop('#01CDFE', 0.5),
      hexToStop('#05FFA1', 1),
    ],
    type: 'linear',
    angle: 45,
  },
  {
    name: 'Gold',
    nameKey: 'background.preset.gold',
    stops: [
      hexToStop('#BF953F', 0),
      hexToStop('#FCF6BA', 0.5),
      hexToStop('#B38728', 1),
    ],
    type: 'linear',
    angle: 135,
  },
];

/** Pattern-based background presets for quick overlay application. */
export const PATTERN_PRESETS: PatternPreset[] = [
  {
    name: 'Dark Dots',
    nameKey: 'background.preset.darkDots',
    patternType: 'dots',
    config: {
      type: 'dots',
      dotSize: 4,
      spacing: 16,
      color: { r: 255, g: 255, b: 255, a: 255 },
    },
  },
  {
    name: 'Retro Stripes',
    nameKey: 'background.preset.retroStripes',
    patternType: 'stripes',
    config: {
      type: 'stripes',
      stripeWidth: 6,
      gap: 12,
      color: { r: 255, g: 200, b: 50, a: 255 },
      angle: 45,
    },
  },
  {
    name: 'Tech Grid',
    nameKey: 'background.preset.techGrid',
    patternType: 'checkerboard',
    config: {
      type: 'checkerboard',
      cellSize: 20,
      color1: { r: 30, g: 30, b: 40, a: 255 },
      color2: { r: 40, g: 40, b: 55, a: 255 },
    },
  },
  {
    name: 'Blueprint Hatch',
    nameKey: 'background.preset.blueprintHatch',
    patternType: 'hatching',
    config: {
      type: 'hatching',
      lineWidth: 1,
      spacing: 10,
      angle: 45,
      color: { r: 100, g: 160, b: 255, a: 255 },
    },
  },
  {
    name: 'Polka Pop',
    nameKey: 'background.preset.polkaPop',
    patternType: 'dots',
    config: {
      type: 'dots',
      dotSize: 8,
      spacing: 24,
      color: { r: 255, g: 100, b: 150, a: 255 },
    },
  },
  {
    name: 'Candy Stripes',
    nameKey: 'background.preset.candyStripes',
    patternType: 'stripes',
    config: {
      type: 'stripes',
      stripeWidth: 8,
      gap: 8,
      color: { r: 255, g: 50, b: 100, a: 255 },
      angle: -45,
    },
  },
  {
    name: 'Cross Hatch',
    nameKey: 'background.preset.crossHatch',
    patternType: 'hatching',
    config: {
      type: 'hatching',
      lineWidth: 2,
      spacing: 8,
      angle: 135,
      color: { r: 80, g: 80, b: 80, a: 255 },
    },
  },
  {
    name: 'Subtle Check',
    nameKey: 'background.preset.subtleCheck',
    patternType: 'checkerboard',
    config: {
      type: 'checkerboard',
      cellSize: 12,
      color1: { r: 240, g: 240, b: 240, a: 255 },
      color2: { r: 220, g: 220, b: 220, a: 255 },
    },
  },
];
