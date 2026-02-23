/**
 * @module components/panels/LayerPanel
 * Layer panel component.
 *
 * Displays the layer tree (reversed: top layers first) with full layer
 * management capabilities:
 * - Layer selection
 * - Drag & drop reorder
 * - Add/delete layer buttons
 *
 * @see APP-002: Layer panel integration
 */

import React, { useCallback, useRef } from 'react';
import { useAppStore } from '../../store';
import { LayerItem } from './LayerItem';

/** LayerPanel displays and manages the document's layer tree. */
export function LayerPanel(): React.JSX.Element {
  const document = useAppStore((s) => s.document);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);
  const revision = useAppStore((s) => s.revision);
  const addRasterLayer = useAppStore((s) => s.addRasterLayer);
  const addLayerGroup = useAppStore((s) => s.addLayerGroup);
  const removeLayer = useAppStore((s) => s.removeLayer);
  const reorderLayer = useAppStore((s) => s.reorderLayer);

  // Track drag state
  const dragIndexRef = useRef<number | null>(null);

  /** Handle drag start. */
  const handleDragStart = useCallback((_e: React.DragEvent, index: number): void => {
    dragIndexRef.current = index;
  }, []);

  /** Handle drag over — allow drop. */
  const handleDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  /** Handle drop — reorder layer. */
  const handleDrop = useCallback(
    (_e: React.DragEvent, dropIndex: number): void => {
      if (!document || dragIndexRef.current === null) return;
      const fromIndex = dragIndexRef.current;
      if (fromIndex === dropIndex) return;

      // children are displayed reversed (top-to-bottom),
      // so we need to convert display indices back to array indices
      const children = document.rootGroup.children;
      const realFromIndex = children.length - 1 - fromIndex;
      const realDropIndex = children.length - 1 - dropIndex;

      const layer = children[realFromIndex];
      if (!layer) return;

      reorderLayer(layer.id, realDropIndex);
      dragIndexRef.current = null;
    },
    [document, reorderLayer],
  );

  /** Delete the selected layer. */
  const handleDeleteSelected = useCallback((): void => {
    if (selectedLayerId) {
      removeLayer(selectedLayerId);
    }
  }, [selectedLayerId, removeLayer]);

  // Layers are stored bottom-to-top, display top-to-bottom (reversed)
  const layers = document ? [...document.rootGroup.children].reverse() : [];

  // Force re-read when revision changes
  void revision;

  return (
    <div className="sidebar">
      <div className="sidebar-header">Layers</div>

      {document ? (
        <>
          <div className="layer-list">
            {layers.map((layer, displayIndex) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                index={displayIndex}
                isSelected={selectedLayerId === layer.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
            {layers.length === 0 && <div className="layer-empty">No layers</div>}
          </div>

          {/* Layer action buttons */}
          <div className="layer-actions">
            <button
              className="layer-action-btn"
              onClick={(): void => addRasterLayer()}
              title="Add new layer"
            >
              + Layer
            </button>
            <button
              className="layer-action-btn"
              onClick={(): void => addLayerGroup()}
              title="Add new group"
            >
              + Group
            </button>
            <button
              className="layer-action-btn layer-action-btn--danger"
              onClick={handleDeleteSelected}
              disabled={!selectedLayerId}
              title="Delete selected layer"
            >
              Delete
            </button>
          </div>
        </>
      ) : (
        <div className="layer-empty">No document open</div>
      )}
    </div>
  );
}
