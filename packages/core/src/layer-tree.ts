/**
 * @module layer-tree
 * Pure functions for operating on the layer tree structure.
 * All functions take the rootGroup as their first argument
 * and mutate the tree in place.
 *
 * @see CORE-001: Layer tree operations
 */

import type { Layer, LayerGroup } from '@photoshop-app/types';

/**
 * Adds a layer to the layer tree.
 *
 * @param rootGroup - The root LayerGroup of the document.
 * @param layer     - The layer to add.
 * @param parentId  - ID of the parent group. Defaults to rootGroup.
 * @param index     - Insertion index within the parent's children. Defaults to the end (top).
 */
export function addLayer(
  rootGroup: LayerGroup,
  layer: Layer,
  parentId?: string,
  index?: number,
): void {
  const parent = parentId ? findGroupById(rootGroup, parentId) : rootGroup;
  if (!parent) {
    return;
  }
  const insertIndex = index ?? parent.children.length;
  parent.children.splice(insertIndex, 0, layer);
  layer.parentId = parent.id;
}

/**
 * Removes a layer from the layer tree.
 * If the layer is a group, its children are removed recursively.
 *
 * @param rootGroup - The root LayerGroup of the document.
 * @param layerId   - ID of the layer to remove.
 * @returns The removed layer, or null if not found.
 */
export function removeLayer(rootGroup: LayerGroup, layerId: string): Layer | null {
  const parent = findParentGroup(rootGroup, layerId);
  if (!parent) {
    return null;
  }
  const idx = parent.children.findIndex((c) => c.id === layerId);
  if (idx === -1) {
    return null;
  }
  const [removed] = parent.children.splice(idx, 1);
  removed.parentId = null;
  return removed;
}

/**
 * Moves a layer to a new position in the tree.
 *
 * @param rootGroup  - The root LayerGroup of the document.
 * @param layerId    - ID of the layer to move.
 * @param newParentId - ID of the destination parent group.
 * @param newIndex   - Insertion index in the destination parent's children.
 * @returns true if the move succeeded, false otherwise.
 */
export function reorderLayer(
  rootGroup: LayerGroup,
  layerId: string,
  newParentId: string,
  newIndex: number,
): boolean {
  const removed = removeLayer(rootGroup, layerId);
  if (!removed) {
    return false;
  }
  const newParent = findGroupById(rootGroup, newParentId);
  if (!newParent) {
    return false;
  }
  const clampedIndex = Math.min(newIndex, newParent.children.length);
  newParent.children.splice(clampedIndex, 0, removed);
  removed.parentId = newParent.id;
  return true;
}

/**
 * Finds a layer by its ID using depth-first search.
 *
 * @param rootGroup - The root LayerGroup of the document.
 * @param layerId   - ID of the layer to find.
 * @returns The matching layer, or null if not found.
 */
export function findLayerById(rootGroup: LayerGroup, layerId: string): Layer | null {
  for (const child of rootGroup.children) {
    if (child.id === layerId) {
      return child;
    }
    if (child.type === 'group') {
      const found = findLayerById(child, layerId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * Finds the parent group of a layer.
 *
 * @param rootGroup - The root LayerGroup of the document.
 * @param layerId   - ID of the layer whose parent to find.
 * @returns The parent LayerGroup, or null if not found.
 */
export function findParentGroup(rootGroup: LayerGroup, layerId: string): LayerGroup | null {
  for (const child of rootGroup.children) {
    if (child.id === layerId) {
      return rootGroup;
    }
    if (child.type === 'group') {
      const found = findParentGroup(child, layerId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * Traverses all layers in depth-first order (bottom to top / draw order),
 * calling the callback for each layer.
 *
 * @param rootGroup - The root LayerGroup of the document.
 * @param callback  - Function called for each layer.
 */
export function traverseLayers(rootGroup: LayerGroup, callback: (layer: Layer) => void): void {
  for (const child of rootGroup.children) {
    if (child.type === 'group') {
      traverseLayers(child, callback);
    }
    callback(child);
  }
}

/**
 * Returns a flat array of all layers in draw order (bottom to top).
 *
 * @param rootGroup - The root LayerGroup of the document.
 * @returns An array of layers in depth-first (draw) order.
 */
export function flattenLayers(rootGroup: LayerGroup): Layer[] {
  const result: Layer[] = [];
  traverseLayers(rootGroup, (layer) => result.push(layer));
  return result;
}

/**
 * Finds a LayerGroup by its ID. Internal helper.
 */
function findGroupById(rootGroup: LayerGroup, groupId: string): LayerGroup | null {
  if (rootGroup.id === groupId) {
    return rootGroup;
  }
  for (const child of rootGroup.children) {
    if (child.type === 'group') {
      if (child.id === groupId) {
        return child;
      }
      const found = findGroupById(child, groupId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
