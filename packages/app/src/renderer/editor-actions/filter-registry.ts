/**
 * @module editor-actions/filter-registry
 * Maps filter name strings to filter factory functions from @photoshop-app/core.
 *
 * Used by the EditorAction dispatcher to resolve `applyFilter` actions
 * without requiring the caller to have direct access to filter imports.
 *
 * @see packages/core/src/filters/ — Filter implementations
 * @see Phase 2-1: Editor Action API
 */

import {
  brightness,
  contrast,
  hueSaturation,
  levels,
  curves,
  colorBalance,
  invert,
  grayscale,
  sepia,
  posterize,
  threshold,
  desaturate,
  gaussianBlur,
  sharpen,
  motionBlur,
  addNoise,
  reduceNoise,
} from '@photoshop-app/core';

type FilterFactory = (options?: Record<string, unknown>) => (imageData: ImageData) => ImageData;

const FILTER_REGISTRY: Record<string, FilterFactory> = {
  brightness: (opts) => (img) => brightness(img, (opts?.amount as number) ?? 0),
  contrast: (opts) => (img) => contrast(img, (opts?.amount as number) ?? 0),
  hueSaturation: (opts) => (img) =>
    hueSaturation(
      img,
      (opts?.hue as number) ?? 0,
      (opts?.saturation as number) ?? 0,
      (opts?.lightness as number) ?? 0,
    ),
  levels: (opts) => (img) =>
    levels(
      img,
      (opts?.inputMin as number) ?? 0,
      (opts?.inputMax as number) ?? 255,
      (opts?.gamma as number) ?? 1,
      (opts?.outputMin as number) ?? 0,
      (opts?.outputMax as number) ?? 255,
    ),
  curves: (opts) => (img) =>
    curves(img, (opts?.controlPoints as Array<{ x: number; y: number }>) ?? [{ x: 0, y: 0 }, { x: 255, y: 255 }]),
  colorBalance: (opts) => (img) =>
    colorBalance(
      img,
      (opts?.shadows as [number, number, number]) ?? [0, 0, 0],
      (opts?.midtones as [number, number, number]) ?? [0, 0, 0],
      (opts?.highlights as [number, number, number]) ?? [0, 0, 0],
    ),
  invert: () => (img) => invert(img),
  grayscale: () => (img) => grayscale(img),
  sepia: () => (img) => sepia(img),
  posterize: (opts) => (img) => posterize(img, (opts?.levels as number) ?? 4),
  threshold: (opts) => (img) => threshold(img, (opts?.level as number) ?? 128),
  desaturate: () => (img) => desaturate(img),
  gaussianBlur: (opts) => (img) => gaussianBlur(img, (opts?.radius as number) ?? 3),
  sharpen: (opts) => (img) => sharpen(img, (opts?.amount as number) ?? 1),
  motionBlur: (opts) => (img) =>
    motionBlur(img, (opts?.angle as number) ?? 0, (opts?.distance as number) ?? 10),
  addNoise: (opts) => (img) =>
    addNoise(img, (opts?.amount as number) ?? 25, (opts?.monochrome as boolean) ?? false),
  reduceNoise: (opts) => (img) => reduceNoise(img, (opts?.strength as number) ?? 3),
};

/**
 * Resolve a filter name to a filter function with bound options.
 * Returns null if the filter name is not recognized.
 */
export function resolveFilter(
  name: string,
  options?: Record<string, unknown>,
): ((imageData: ImageData) => ImageData) | null {
  const factory = FILTER_REGISTRY[name];
  if (!factory) return null;
  return factory(options);
}

/** All registered filter names. */
export const REGISTERED_FILTER_NAMES = Object.keys(FILTER_REGISTRY);
