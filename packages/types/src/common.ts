/**
 * @module common
 * Common primitive types used across all packages.
 */

/** RGBA color representation with 0-255 integer channels and 0-1 alpha. */
export interface Color {
  /** Red channel (0-255) */
  r: number;
  /** Green channel (0-255) */
  g: number;
  /** Blue channel (0-255) */
  b: number;
  /** Alpha channel (0-1) */
  a: number;
}

/** 2D point in document or screen space. */
export interface Point {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
}

/** Axis-aligned rectangle. */
export interface Rect {
  /** Left edge X coordinate */
  x: number;
  /** Top edge Y coordinate */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/** Size in pixels. */
export interface Size {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Photoshop-compatible blend modes.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
 */
export enum BlendMode {
  Normal = 'normal',
  Multiply = 'multiply',
  Screen = 'screen',
  Overlay = 'overlay',
  Darken = 'darken',
  Lighten = 'lighten',
  ColorDodge = 'color-dodge',
  ColorBurn = 'color-burn',
  HardLight = 'hard-light',
  SoftLight = 'soft-light',
  Difference = 'difference',
  Exclusion = 'exclusion',
  Hue = 'hue',
  Saturation = 'saturation',
  ColorMode = 'color',
  Luminosity = 'luminosity',
}
