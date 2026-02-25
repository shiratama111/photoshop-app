/**
 * @module commands/remove-layer
 * Command for removing a layer from a LayerGroup.
 *
 * @see CORE-002: RemoveLayerCommand
 */

import type { Command, Layer, LayerGroup } from '@photoshop-app/types';

/**
 * Removes a layer from its parent group.
 * Undo re-inserts the layer at its original position.
 */
export class RemoveLayerCommand implements Command {
  readonly description: string;
  private readonly parent: LayerGroup;
  private readonly layer: Layer;
  private readonly originalIndex: number;

  /**
   * @param parent - The group the layer belongs to.
   * @param layer  - The layer to remove.
   */
  constructor(parent: LayerGroup, layer: Layer) {
    this.parent = parent;
    this.layer = layer;
    this.originalIndex = parent.children.indexOf(layer);
    if (this.originalIndex === -1) {
      throw new Error(`Layer "${layer.id}" is not a child of group "${parent.id}"`);
    }
    this.description = `レイヤー「${layer.name}」を削除`;
  }

  /** Remove the layer from the parent group. */
  execute(): void {
    const pos = this.parent.children.indexOf(this.layer);
    if (pos !== -1) {
      this.parent.children.splice(pos, 1);
    }
    this.layer.parentId = null;
  }

  /** Re-insert the layer at its original position. */
  undo(): void {
    this.parent.children.splice(this.originalIndex, 0, this.layer);
    this.layer.parentId = this.parent.id;
  }
}
