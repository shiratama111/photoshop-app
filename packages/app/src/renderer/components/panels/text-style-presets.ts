/**
 * @module components/panels/text-style-presets
 * Built-in text style presets for thumbnail creation.
 *
 * Each preset defines font, size, color, and layer effects for one-click application.
 * Categories: youtube, impact, elegant, custom, imported.
 *
 * @see Phase 1: Text Style Presets
 */

import type { Color, LayerEffect } from '@photoshop-app/types';

/** Text style preset (local type — packages/types is locked). */
export interface TextStylePreset {
  id: string;
  name: string;
  category: 'youtube' | 'impact' | 'elegant' | 'custom' | 'imported';
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: Color;
  letterSpacing?: number;
  lineHeight?: number;
  effects: LayerEffect[];
  /** Null for built-in, file name for imported. */
  source: string | null;
  /** Whether this preset is a built-in (cannot be deleted). */
  builtIn: boolean;
}

/** 8 built-in text style presets. */
export const BUILT_IN_TEXT_STYLES: TextStylePreset[] = [
  {
    id: 'builtin-youtuber',
    name: 'YouTuber定番',
    category: 'youtube',
    fontFamily: 'Impact',
    fontSize: 72,
    bold: true,
    italic: false,
    color: { r: 255, g: 255, b: 255, a: 1 },
    effects: [
      {
        type: 'stroke',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        size: 4,
        position: 'outside',
        opacity: 1,
      },
      {
        type: 'drop-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 0.75 },
        angle: 135,
        distance: 3,
        blur: 6,
        spread: 0,
        opacity: 0.75,
      },
    ],
    source: null,
    builtIn: true,
  },
  {
    id: 'builtin-impact',
    name: 'インパクト',
    category: 'impact',
    fontFamily: 'Arial Black',
    fontSize: 80,
    bold: true,
    italic: false,
    color: { r: 255, g: 0, b: 0, a: 1 },
    effects: [
      {
        type: 'stroke',
        enabled: true,
        color: { r: 255, g: 255, b: 255, a: 1 },
        size: 5,
        position: 'outside',
        opacity: 1,
      },
      {
        type: 'outer-glow',
        enabled: true,
        color: { r: 255, g: 255, b: 0, a: 1 },
        blur: 10,
        spread: 0,
        opacity: 0.6,
      },
    ],
    source: null,
    builtIn: true,
  },
  {
    id: 'builtin-elegant',
    name: 'エレガント',
    category: 'elegant',
    fontFamily: 'Georgia',
    fontSize: 48,
    bold: false,
    italic: true,
    color: { r: 212, g: 175, b: 55, a: 1 },
    effects: [
      {
        type: 'drop-shadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 0.4 },
        angle: 135,
        distance: 2,
        blur: 4,
        spread: 0,
        opacity: 0.4,
      },
    ],
    source: null,
    builtIn: true,
  },
  {
    id: 'builtin-pop',
    name: 'ポップ',
    category: 'impact',
    fontFamily: 'Comic Sans MS',
    fontSize: 64,
    bold: true,
    italic: false,
    color: { r: 255, g: 105, b: 180, a: 1 },
    effects: [
      {
        type: 'stroke',
        enabled: true,
        color: { r: 255, g: 255, b: 255, a: 1 },
        size: 3,
        position: 'outside',
        opacity: 1,
      },
      {
        type: 'outer-glow',
        enabled: true,
        color: { r: 255, g: 192, b: 203, a: 1 },
        blur: 8,
        spread: 0,
        opacity: 0.5,
      },
    ],
    source: null,
    builtIn: true,
  },
  {
    id: 'builtin-breaking',
    name: '速報風',
    category: 'impact',
    fontFamily: 'Helvetica',
    fontSize: 56,
    bold: true,
    italic: false,
    color: { r: 255, g: 255, b: 255, a: 1 },
    effects: [
      {
        type: 'stroke',
        enabled: true,
        color: { r: 255, g: 0, b: 0, a: 1 },
        size: 3,
        position: 'outside',
        opacity: 1,
      },
    ],
    source: null,
    builtIn: true,
  },
  {
    id: 'builtin-simple-black',
    name: 'シンプル黒',
    category: 'youtube',
    fontFamily: 'Arial',
    fontSize: 48,
    bold: true,
    italic: false,
    color: { r: 0, g: 0, b: 0, a: 1 },
    effects: [],
    source: null,
    builtIn: true,
  },
  {
    id: 'builtin-gradient-text',
    name: 'グラデ文字',
    category: 'impact',
    fontFamily: 'Arial Black',
    fontSize: 72,
    bold: true,
    italic: false,
    color: { r: 255, g: 255, b: 255, a: 1 },
    effects: [
      {
        type: 'stroke',
        enabled: true,
        color: { r: 255, g: 255, b: 255, a: 1 },
        size: 2,
        position: 'outside',
        opacity: 1,
      },
      {
        type: 'gradient-overlay',
        enabled: true,
        gradientType: 'linear',
        angle: 90,
        scale: 100,
        opacity: 1,
        reverse: false,
        startColor: { r: 255, g: 215, b: 0, a: 1 },
        endColor: { r: 255, g: 69, b: 0, a: 1 },
      },
    ],
    source: null,
    builtIn: true,
  },
  {
    id: 'builtin-outlined',
    name: '縁取り',
    category: 'youtube',
    fontFamily: 'Impact',
    fontSize: 72,
    bold: true,
    italic: false,
    color: { r: 255, g: 255, b: 0, a: 1 },
    effects: [
      {
        type: 'stroke',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        size: 4,
        position: 'outside',
        opacity: 1,
      },
      {
        type: 'outer-glow',
        enabled: true,
        color: { r: 255, g: 255, b: 255, a: 1 },
        blur: 6,
        spread: 0,
        opacity: 0.5,
      },
    ],
    source: null,
    builtIn: true,
  },
];
