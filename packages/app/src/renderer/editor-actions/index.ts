/**
 * @module editor-actions
 * Editor Action API — programmatic interface for all editor operations.
 *
 * Re-exports types, dispatcher, validators, filter registry, and snapshot.
 *
 * @see Phase 2-1: Editor Action API
 * @see Phase 2-2: Canvas State Snapshot
 */

export type { EditorAction, ActionResult, ColorDef, GradientStopDef } from './types';
export {
  executeAction,
  executeActions,
  executeActionAsync,
  executeActionsAsync,
  serializeDocument,
  serializeLayerTree,
  serializeLayer,
} from './dispatcher';
export { validateAction } from './validators';
export type { ValidationResult } from './validators';
export { resolveFilter, REGISTERED_FILTER_NAMES } from './filter-registry';
export { captureCanvasSnapshot } from './snapshot';
export type { CanvasSnapshot } from './snapshot';
