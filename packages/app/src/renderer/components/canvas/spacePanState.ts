/**
 * @module canvas/spacePanState
 * Shared Space-key pan state for CanvasView and SelectionOverlay.
 *
 * Single source of truth for Space-key press status, avoiding duplicate
 * keydown/keyup listeners across overlay components.
 *
 * CanvasView owns the keydown/keyup lifecycle and writes to this state.
 * Other overlays (e.g. SelectionOverlay) read `isSpacePressed` to decide
 * whether to defer mouse events to the pan handler.
 *
 * @see docs/agent-briefs/PS-PAN-001.md
 * @see docs/agent-briefs/PS-PAN-002.md
 */

/**
 * Shared mutable state for Space-key pan mode.
 *
 * This is intentionally a plain object (not reactive state) because it is
 * read synchronously inside event handlers, not during React render.
 */
export const spacePanState = {
  /** True while the Space key is physically held down and pan mode is available. */
  isSpacePressed: false,
};
