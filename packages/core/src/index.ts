/**
 * @photoshop-app/core
 *
 * Core document model, command history, and layer management.
 *
 * @packageDocumentation
 */

// UUID generation — CORE-001
export { generateId } from './uuid';

// Document creation — CORE-001
export { createDocument } from './document';

// Layer factories — CORE-001
export { createRasterLayer, createTextLayer, createLayerGroup } from './layer-factory';
export type { CreateTextLayerOptions } from './layer-factory';

// Layer tree operations — CORE-001
export {
  addLayer,
  removeLayer,
  reorderLayer,
  findLayerById,
  findParentGroup,
  traverseLayers,
  flattenLayers,
} from './layer-tree';

// Command history (undo/redo) — CORE-002
export { CommandHistoryImpl } from './command-history';

// Event bus — CORE-004
export { EventBusImpl } from './event-bus';

// Concrete commands — CORE-002
export {
  AddLayerCommand,
  RemoveLayerCommand,
  ReorderLayerCommand,
  SetLayerPropertyCommand,
  ModifyPixelsCommand,
} from './commands';

// Filters — CORE-005
export {
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
} from './filters';

// Gradient engine — CORE-006
export {
  renderGradient,
  renderGradientOverlay,
  createTwoColorGradient,
  createForegroundToTransparent,
  createBlackWhiteGradient,
  createRainbowGradient,
  createChromeGradient,
  createCopperGradient,
} from './gradient';
export type {
  GradientType,
  GradientStop,
  GradientDef,
  PresetGradientName,
} from './gradient';

// Color utilities — CORE-007
export {
  rgbToHsl,
  hslToRgb,
  rgbToHsb,
  hsbToRgb,
  rgbToCmyk,
  cmykToRgb,
  rgbToHex,
  hexToRgb,
  rgbaToHex,
  blendColors,
  interpolateColors,
  colorDistance,
  luminance,
  contrastRatio,
  darken,
  lighten,
  saturate,
  desaturateColor,
  invertColor,
  pickColor,
  pickColorAverage,
} from './color-utils';
export type {
  RgbColor,
  HslColor,
  HsbColor,
  CmykColor,
  RgbaColor,
} from './color-utils';

// Transform engine — CORE-008
export {
  identityMatrix,
  multiplyMatrix,
  rotateMatrix,
  scaleMatrix,
  translateMatrix,
  invertMatrix,
  flipHorizontal,
  flipVertical,
  rotate90CW,
  rotate90CCW,
  rotate180,
  rotateArbitrary,
  scaleImage,
  applyTransform,
  cropImage,
  canvasResize,
  bilinearSample,
  nearestSample,
} from './transform';
export type {
  Matrix2D,
  TransformOrigin,
  InterpolationMethod,
} from './transform';

// Fill operations — CORE-009
export {
  floodFill,
  fillAll,
  fillSelection,
  fillGradient,
  fillWithMask,
} from './fill';
export type {
  FillColor,
  FillSelection,
  SimpleGradientDef,
} from './fill';

// Selection operations — CORE-010
export {
  createEmptyMask,
  createFullMask,
  createRectSelection,
  createEllipseSelection,
  magicWandSelect,
  colorRangeSelect,
  invertSelection,
  expandSelection,
  contractSelection,
  featherSelection,
  selectionBounds,
  combineSelections,
  hasSelection,
  deselectAll,
  selectAll,
} from './selection-ops';
export type { SelectionMode } from './selection-ops';

// Clone stamp tool — CORE-011
export {
  createCloneSession,
  cloneStamp,
  cloneStampStroke,
} from './clone-stamp';
export type {
  CloneSession,
  CloneBrushParams,
} from './clone-stamp';

// Dodge/Burn/Sponge tools — CORE-012
export {
  dodgeDab,
  burnDab,
  spongeDab,
  dodgeStroke,
  burnStroke,
  spongeStroke,
} from './dodge-burn';
export type {
  ToneRange,
  SpongeMode,
  DodgeBurnBrush,
} from './dodge-burn';

// Shape drawing tool — CORE-013
export {
  drawRectangle,
  drawEllipse,
  drawLine,
  drawPolygon,
  drawRoundedRect,
  drawShapeAsNewLayer,
} from './shape-tool';
export type {
  Color as ShapeColor,
  Point as ShapePoint,
  DrawOptions as ShapeDrawOptions,
} from './shape-tool';

// Procedural generation — Phase 1-3/1-4
export {
  generateGradientBackground,
  generatePattern,
  generateConcentrationLines,
  generateBorderFrame,
  generateGradientMask,
} from './procedural';
export type {
  ProceduralColor,
  PatternType,
  BorderStyle,
  MaskDirection,
} from './procedural';
