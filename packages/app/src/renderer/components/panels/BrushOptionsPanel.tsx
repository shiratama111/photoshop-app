/**
 * @module components/panels/BrushOptionsPanel
 * Brush/eraser options panel with size, hardness, and opacity controls.
 *
 * @see APP-014: Brush canvas integration
 */

import React from 'react';
import { useAppStore } from '../../store';

/** BrushOptionsPanel — shown when brush or eraser tool is active. */
export function BrushOptionsPanel(): React.JSX.Element | null {
  const activeTool = useAppStore((s) => s.activeTool);
  const brushSize = useAppStore((s) => s.brushSize);
  const brushHardness = useAppStore((s) => s.brushHardness);
  const brushOpacity = useAppStore((s) => s.brushOpacity);
  const brushColor = useAppStore((s) => s.brushColor);
  const setBrushSize = useAppStore((s) => s.setBrushSize);
  const setBrushHardness = useAppStore((s) => s.setBrushHardness);
  const setBrushOpacity = useAppStore((s) => s.setBrushOpacity);
  const setBrushColor = useAppStore((s) => s.setBrushColor);

  if (activeTool !== 'brush' && activeTool !== 'eraser') return null;

  const colorHex = `#${[brushColor.r, brushColor.g, brushColor.b]
    .map((c) => Math.round(c).toString(16).padStart(2, '0'))
    .join('')}`;

  return (
    <div className="brush-options-panel" data-testid="brush-options">
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
      <div className="brush-option">
        <label className="brush-option__label">Hardness</label>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(brushHardness * 100)}
          onChange={(e): void => setBrushHardness(Number(e.target.value) / 100)}
          className="brush-option__slider"
        />
        <span className="brush-option__value">{Math.round(brushHardness * 100)}%</span>
      </div>
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
      {activeTool === 'brush' && (
        <div className="brush-option">
          <label className="brush-option__label">Color</label>
          <input
            type="color"
            value={colorHex}
            onChange={(e): void => {
              const hex = e.target.value;
              setBrushColor({
                r: parseInt(hex.slice(1, 3), 16),
                g: parseInt(hex.slice(3, 5), 16),
                b: parseInt(hex.slice(5, 7), 16),
                a: 1,
              });
            }}
            className="brush-option__color"
          />
        </div>
      )}
    </div>
  );
}
