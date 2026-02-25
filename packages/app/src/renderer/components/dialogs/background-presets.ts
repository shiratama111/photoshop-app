/**
 * @module background-presets
 * Gradient background preset definitions for the BackgroundDialog.
 *
 * Each preset contains a name, gradient stops, type, and angle.
 * Stops use the GradientStop format (RGBA 0-255).
 *
 * @see Phase 1-3: Background & atmosphere tools
 */

import type { GradientStop, GradientType } from '@photoshop-app/core';

export interface BackgroundPreset {
  name: string;
  nameKey: string;
  stops: GradientStop[];
  type: GradientType;
  angle: number;
}

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
