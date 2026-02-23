/**
 * @module components/panels/LayerItem
 * Individual layer row in the layer panel.
 *
 * Displays:
 * - Visibility toggle (eye icon)
 * - Layer thumbnail (rendered via Canvas2DRenderer)
 * - Layer name (double-click to edit)
 * - Opacity slider
 * - Blend mode selector
 *
 * Supports:
 * - Click to select
 * - Double-click name to rename
 * - Right-click for context menu
 * - Drag for reorder
 *
 * @see APP-002: Layer panel integration
 */

import React, { useCallback, useRef, useState } from 'react';
import type { Layer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import { useAppStore } from '../../store';

/** Props for LayerItem. */
interface LayerItemProps {
  /** The layer to display. */
  layer: Layer;
  /** Index of this layer in the parent's children array. */
  index: number;
  /** Whether this layer is currently selected. */
  isSelected: boolean;
  /** Callback when drag starts. */
  onDragStart: (e: React.DragEvent, index: number) => void;
  /** Callback when drag enters this item. */
  onDragOver: (e: React.DragEvent, index: number) => void;
  /** Callback when drop occurs on this item. */
  onDrop: (e: React.DragEvent, index: number) => void;
}

/** All blend modes with display labels. */
const BLEND_MODES: Array<{ value: BlendMode; label: string }> = [
  { value: BlendMode.Normal, label: 'Normal' },
  { value: BlendMode.Multiply, label: 'Multiply' },
  { value: BlendMode.Screen, label: 'Screen' },
  { value: BlendMode.Overlay, label: 'Overlay' },
  { value: BlendMode.Darken, label: 'Darken' },
  { value: BlendMode.Lighten, label: 'Lighten' },
  { value: BlendMode.ColorDodge, label: 'Color Dodge' },
  { value: BlendMode.ColorBurn, label: 'Color Burn' },
  { value: BlendMode.HardLight, label: 'Hard Light' },
  { value: BlendMode.SoftLight, label: 'Soft Light' },
  { value: BlendMode.Difference, label: 'Difference' },
  { value: BlendMode.Exclusion, label: 'Exclusion' },
  { value: BlendMode.Hue, label: 'Hue' },
  { value: BlendMode.Saturation, label: 'Saturation' },
  { value: BlendMode.ColorMode, label: 'Color' },
  { value: BlendMode.Luminosity, label: 'Luminosity' },
];

/** Layer type icon character. */
function layerTypeIcon(type: Layer['type']): string {
  switch (type) {
    case 'raster':
      return '\u25A3'; // ▣
    case 'text':
      return 'T';
    case 'group':
      return '\u25B7'; // ▷
    default:
      return '?';
  }
}

/** Individual layer row component. */
export function LayerItem({
  layer,
  index,
  isSelected,
  onDragStart,
  onDragOver,
  onDrop,
}: LayerItemProps): React.JSX.Element {
  const selectLayer = useAppStore((s) => s.selectLayer);
  const toggleLayerVisibility = useAppStore((s) => s.toggleLayerVisibility);
  const setLayerOpacity = useAppStore((s) => s.setLayerOpacity);
  const setLayerBlendMode = useAppStore((s) => s.setLayerBlendMode);
  const renameLayer = useAppStore((s) => s.renameLayer);
  const showContextMenu = useAppStore((s) => s.showContextMenu);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  /** Select this layer on click. */
  const handleClick = useCallback((): void => {
    selectLayer(layer.id);
  }, [layer.id, selectLayer]);

  /** Toggle visibility — stop propagation to avoid selecting. */
  const handleVisibilityClick = useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      toggleLayerVisibility(layer.id);
    },
    [layer.id, toggleLayerVisibility],
  );

  /** Start editing name on double-click. */
  const handleDoubleClick = useCallback((): void => {
    setIsEditing(true);
    setEditName(layer.name);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }, [layer.name]);

  /** Commit name edit. */
  const commitRename = useCallback((): void => {
    setIsEditing(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== layer.name) {
      renameLayer(layer.id, trimmed);
    }
  }, [editName, layer.id, layer.name, renameLayer]);

  /** Handle name input key events. */
  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter') {
        commitRename();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditName(layer.name);
      }
    },
    [commitRename, layer.name],
  );

  /** Handle opacity slider change. */
  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      e.stopPropagation();
      setLayerOpacity(layer.id, Number(e.target.value) / 100);
    },
    [layer.id, setLayerOpacity],
  );

  /** Handle blend mode change. */
  const handleBlendModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      e.stopPropagation();
      setLayerBlendMode(layer.id, e.target.value as BlendMode);
    },
    [layer.id, setLayerBlendMode],
  );

  /** Handle right-click for context menu. */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      selectLayer(layer.id);
      showContextMenu(e.clientX, e.clientY, layer.id);
    },
    [layer.id, selectLayer, showContextMenu],
  );

  return (
    <div
      className={`layer-item ${isSelected ? 'layer-item--selected' : ''} ${!layer.visible ? 'layer-item--hidden' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={(e): void => onDragStart(e, index)}
      onDragOver={(e): void => onDragOver(e, index)}
      onDrop={(e): void => onDrop(e, index)}
    >
      {/* Visibility toggle */}
      <button
        className="layer-visibility"
        onClick={handleVisibilityClick}
        title={layer.visible ? 'Hide layer' : 'Show layer'}
      >
        {layer.visible ? '\u{1F441}' : '\u25CB'}
      </button>

      {/* Layer type icon */}
      <span className="layer-type-icon">{layerTypeIcon(layer.type)}</span>

      {/* Layer name */}
      <div className="layer-name-area">
        {isEditing ? (
          <input
            ref={nameInputRef}
            className="layer-name-input"
            value={editName}
            onChange={(e): void => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleNameKeyDown}
            autoFocus
          />
        ) : (
          <span className="layer-name">{layer.name}</span>
        )}
      </div>

      {/* Controls row (only shown when selected) */}
      {isSelected && (
        <div className="layer-controls" onClick={(e): void => e.stopPropagation()}>
          <label className="layer-opacity-label">
            <span>{Math.round(layer.opacity * 100)}%</span>
            <input
              type="range"
              className="layer-opacity-slider"
              min="0"
              max="100"
              value={Math.round(layer.opacity * 100)}
              onChange={handleOpacityChange}
            />
          </label>
          <select
            className="layer-blend-select"
            value={layer.blendMode}
            onChange={handleBlendModeChange}
          >
            {BLEND_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
