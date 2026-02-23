/**
 * @photoshop-app/ai
 *
 * AI-powered segmentation using Mobile SAM (ONNX Runtime Web).
 * Provides interactive point-prompt segmentation for subject cutout.
 *
 * @packageDocumentation
 */

// SAM Provider — AI-001
export { MobileSamProvider } from './sam-provider';
export type { OnnxSession, OnnxTensor, OnnxRuntime, SamProviderConfig } from './sam-provider';

// Image utilities
export {
  preprocessImage,
  createPointTensors,
  postprocessMask,
  calculateConfidence,
  SAM_INPUT_SIZE,
} from './image-utils';

// Mask refinement — AI-002
export { applyBrushStroke, featherMask, adjustBoundary } from './mask-refinement';
export type { BrushConfig, BrushMode } from './mask-refinement';

// Mask commands (undo/redo) — AI-002
export { BrushMaskCommand, FeatherMaskCommand, AdjustBoundaryCommand } from './mask-commands';
