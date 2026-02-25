/**
 * @module commands/reorder-layer
 * Command for moving a layer to a new position within its parent group.
 *
 * @see CORE-002: ReorderLayerCommand
 */

import type { Command, Layer, LayerGroup } from '@photoshop-app/types';

/**
 * Moves a layer from one index to another within the same parent group.
 * Undo restores the original position.
 */
export class ReorderLayerCommand implements Command {
  readonly description: string;
  private readonly parent: LayerGroup;
  private readonly layer: Layer;
  private readonly fromIndex: number;
  private readonly toIndex: number;

  /**
   * @param parent  - The group containing the layer.
   * @param layer   - The layer to move.
   * @param toIndex - The target index in `parent.children`.
   */
  constructor(parent: LayerGroup, layer: Layer, toIndex: number) {
    this.parent = parent;
    this.layer = layer;
    this.fromIndex = parent.children.indexOf(layer);
    if (this.fromIndex === -1) {
      throw new Error(`Layer "${layer.id}" is not a child of group "${parent.id}"`);
    }
    this.toIndex = toIndex;
    this.description = `レイヤー「${layer.name}」を並べ替え`;
  }

  /** Move the layer to the target index. */
  execute(): void {
    this.moveLayer(this.fromIndex, this.toIndex);
  }

  /** Restore the layer to its original index. */
  undo(): void {
    this.moveLayer(
      this.parent.children.indexOf(this.layer),
      this.fromIndex,
    );
  }

  private moveLayer(from: number, to: number): void {
    const [removed] = this.parent.children.splice(from, 1);
    this.parent.children.splice(to, 0, removed);
  }
}
