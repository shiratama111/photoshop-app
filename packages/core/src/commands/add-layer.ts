/**
 * @module commands/add-layer
 * Command for adding a layer to a LayerGroup.
 *
 * @see CORE-002: AddLayerCommand
 */

import type { Command, Layer, LayerGroup } from '@photoshop-app/types';

/**
 * Adds a layer to a parent group at a given index.
 * Undo removes the layer; redo re-inserts it at the same position.
 */
export class AddLayerCommand implements Command {
  readonly description: string;
  private readonly parent: LayerGroup;
  private readonly layer: Layer;
  private readonly index: number;

  /**
   * @param parent - The group to add the layer to.
   * @param layer  - The layer to add.
   * @param index  - Insertion index within `parent.children`.
   *                 Defaults to the end (top of the stack).
   */
  constructor(parent: LayerGroup, layer: Layer, index?: number) {
    this.parent = parent;
    this.layer = layer;
    this.index = index ?? parent.children.length;
    this.description = `レイヤー「${layer.name}」を追加`;
  }

  /** Insert the layer into the parent group. */
  execute(): void {
    this.parent.children.splice(this.index, 0, this.layer);
    this.layer.parentId = this.parent.id;
  }

  /** Remove the layer from the parent group. */
  undo(): void {
    const pos = this.parent.children.indexOf(this.layer);
    if (pos !== -1) {
      this.parent.children.splice(pos, 1);
    }
    this.layer.parentId = null;
  }
}
