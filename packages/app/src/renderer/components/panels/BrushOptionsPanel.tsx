/**
 * @module components/panels/BrushOptionsPanel
 * Brush/eraser options panel with variant selector, size, hardness, opacity, and color picker.
 *
 * @see APP-014: Brush canvas integration
 * @see APP-016: Brush variants, color picker, color palette
 */

import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { BRUSH_VARIANTS } from '../../brush-engine';
import type { BrushVariantId } from '../../brush-engine';
import { ColorPicker } from './ColorPicker';

/** All variant IDs for the selector. */
const VARIANT_IDS: BrushVariantId[] = ['soft', 'pencil', 'airbrush', 'marker'];

/** BrushOptionsPanel — shown when brush or eraser tool is active. */
export function BrushOptionsPanel(): React.JSX.Element | null {
  const activeTool = useAppStore((s) => s.activeTool);
  const brushSize = useAppStore((s) => s.brushSize);
  const brushHardness = useAppStore((s) => s.brushHardness);
  const brushOpacity = useAppStore((s) => s.brushOpacity);
  const brushColor = useAppStore((s) => s.brushColor);
  const brushVariant = useAppStore((s) => s.brushVariant);
  const setBrushSize = useAppStore((s) => s.setBrushSize);
  const setBrushHardness = useAppStore((s) => s.setBrushHardness);
  const setBrushOpacity = useAppStore((s) => s.setBrushOpacity);
  const setBrushColor = useAppStore((s) => s.setBrushColor);
  const setBrushVariant = useAppStore((s) => s.setBrushVariant);

  const [showPicker, setShowPicker] = useState(false);

  if (activeTool !== 'brush' && activeTool !== 'eraser') return null;

  const variant = BRUSH_VARIANTS[brushVariant];
  const hardnessDisabled = variant.hardnessOverride !== null;

  return (
    <div className="brush-options-panel" data-testid="brush-options">
      {/* Variant selector */}
      <div className="brush-option">
        <label className="brush-option__label">Type</label>
        <div className="brush-variant-selector">
          {VARIANT_IDS.map((vid) => (
            <button
              key={vid}
              className={`brush-variant-btn ${brushVariant === vid ? 'brush-variant-btn--active' : ''}`}
              onClick={(): void => setBrushVariant(vid)}
              title={BRUSH_VARIANTS[vid].label}
            >
              {BRUSH_VARIANTS[vid].label}
            </button>
          ))}
        </div>
      </div>

      {/* Size slider */}
      <div className="brush-option">
        <label className="brush-option__label">Size</label>
        <input
          type="range"
          min="1"
          max="200"
          value={brushSize}
          onChange={(e): void => setBrushSize(Number(e.target.value))}
          className="brush-option__slider"
        />
        <span className="brush-option__value">{brushSize}px</span>
      </div>

      {/* Hardness slider (disabled for pencil/marker) */}
      <div className="brush-option">
        <label className={`brush-option__label ${hardnessDisabled ? 'brush-option__label--disabled' : ''}`}>
          Hardness
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round((hardnessDisabled ? (variant.hardnessOverride ?? 1) : brushHardness) * 100)}
          onChange={(e): void => setBrushHardness(Number(e.target.value) / 100)}
          className="brush-option__slider"
          disabled={hardnessDisabled}
        />
        <span className={`brush-option__value ${hardnessDisabled ? 'brush-option__value--disabled' : ''}`}>
          {Math.round((hardnessDisabled ? (variant.hardnessOverride ?? 1) : brushHardness) * 100)}%
        </span>
      </div>

      {/* Opacity slider */}
      <div className="brush-option">
        <label className="brush-option__label">Opacity</label>
        <input
          type="range"
          min="1"
          max="100"
          value={Math.round(brushOpacity * 100)}
          onChange={(e): void => setBrushOpacity(Number(e.target.value) / 100)}
          className="brush-option__slider"
        />
        <span className="brush-option__value">{Math.round(brushOpacity * 100)}%</span>
      </div>

      {/* Color picker (brush only, not eraser) */}
      {activeTool === 'brush' && (
        <div className="brush-option brush-option--color">
          <button
            className="brush-option__color-swatch"
            style={{
              background: `rgb(${brushColor.r},${brushColor.g},${brushColor.b})`,
            }}
            onClick={(): void => setShowPicker(!showPicker)}
            title="Toggle color picker"
          />
          {showPicker && (
            <div className="brush-option__picker-popover">
              <ColorPicker color={brushColor} onChange={setBrushColor} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
