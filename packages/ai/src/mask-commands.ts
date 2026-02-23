/**
 * @module mask-commands
 * Command pattern implementations for mask refinement operations.
 * Each command stores the mask state before/after for undo/redo support.
 *
 * @see AI-002: Mask Refinement Tool
 * @see {@link @photoshop-app/types!Command}
 * @see {@link ./mask-refinement}
 */

import type { Command, Mask, Point } from '@photoshop-app/types';
import { applyBrushStroke, featherMask, adjustBoundary, type BrushConfig } from './mask-refinement';

/**
 * Command for applying a brush stroke to a mask.
 * Stores the full mask before/after for reliable undo.
 */
export class BrushMaskCommand implements Command {
  readonly description: string;
  private readonly mask: Mask;
  private readonly oldData: Uint8Array;
  private readonly newData: Uint8Array;

  /**
   * @param mask - The mask to modify (mutated on execute/undo).
   * @param points - Stroke path in mask coordinates.
   * @param config - Brush configuration.
   */
  constructor(mask: Mask, points: Point[], config: BrushConfig) {
    this.mask = mask;
    this.oldData = new Uint8Array(mask.data);
    this.newData = applyBrushStroke(mask.data, mask.size, points, config);
    this.description = `Brush ${config.mode} mask`;
  }

  execute(): void {
    this.mask.data.set(this.newData);
  }

  undo(): void {
    this.mask.data.set(this.oldData);
  }
}

/**
 * Command for feathering (Gaussian blur) a mask's edges.
 */
export class FeatherMaskCommand implements Command {
  readonly description: string;
  private readonly mask: Mask;
  private readonly oldData: Uint8Array;
  private readonly newData: Uint8Array;

  /**
   * @param mask - The mask to modify (mutated on execute/undo).
   * @param radius - Feather radius in pixels.
   */
  constructor(mask: Mask, radius: number) {
    this.mask = mask;
    this.oldData = new Uint8Array(mask.data);
    this.newData = featherMask(mask.data, mask.size, radius);
    this.description = `Feather mask (${radius}px)`;
  }

  execute(): void {
    this.mask.data.set(this.newData);
  }

  undo(): void {
    this.mask.data.set(this.oldData);
  }
}

/**
 * Command for expanding or contracting the mask boundary.
 */
export class AdjustBoundaryCommand implements Command {
  readonly description: string;
  private readonly mask: Mask;
  private readonly oldData: Uint8Array;
  private readonly newData: Uint8Array;

  /**
   * @param mask - The mask to modify (mutated on execute/undo).
   * @param amount - Pixels to expand (positive) or contract (negative).
   */
  constructor(mask: Mask, amount: number) {
    this.mask = mask;
    this.oldData = new Uint8Array(mask.data);
    this.newData = adjustBoundary(mask.data, mask.size, amount);
    this.description = amount > 0
      ? `Expand mask boundary (${amount}px)`
      : `Contract mask boundary (${Math.abs(amount)}px)`;
  }

  execute(): void {
    this.mask.data.set(this.newData);
  }

  undo(): void {
    this.mask.data.set(this.oldData);
  }
}
