/**
 * @photoshop-app/types
 *
 * Shared type definitions for the Photoshop App.
 * This package contains zero runtime code — only TypeScript interfaces,
 * types, and enums that serve as the "contract" between all packages.
 *
 * @packageDocumentation
 */

// Common primitives
export type { Color, Point, Rect, Size } from './common';
export { BlendMode } from './common';

// Layer types
export type {
  BaseLayer,
  Layer,
  LayerGroup,
  LayerMask,
  LayerType,
  RasterLayer,
  TextAlignment,
  TextLayer,
  WritingMode,
} from './layer';

// Effects
export type {
  BaseEffect,
  BevelDirection,
  BevelEmbossEffect,
  BevelStyle,
  ColorOverlayEffect,
  DropShadowEffect,
  EffectType,
  GradientOverlayEffect,
  InnerGlowEffect,
  InnerShadowEffect,
  LayerEffect,
  OuterGlowEffect,
  StrokeEffect,
  StrokePosition,
} from './effects';

// Document
export type { BitDepth, Canvas, ColorMode, Document } from './document';

// Command (undo/redo)
export type { Command, CommandHistory } from './command';

// Segmentation (AI cutout)
export type { Mask, MaskRefinementOptions, PointPrompt, SegmentationProvider } from './segmentation';

// Brush presets
export type { AbrParseResult, BrushPreset } from './brush';

// Layer style presets
export type { AslParseResult, LayerStylePreset } from './style';

// Renderer & Viewport
export type { RenderOptions, Renderer, Viewport } from './renderer';

// Events
export type { EventBus, EventCallback, EventMap } from './events';

// Project file & PSD I/O
export type {
  CompatibilityIssue,
  CompatibilityReport,
  CompatibilitySeverity,
  ProjectFile,
  ProjectLayerNode,
  ProjectManifest,
  PsdExportOptions,
  PsdImportOptions,
} from './project';
