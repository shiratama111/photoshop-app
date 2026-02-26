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
import { t } from '../../i18n';
import { ColorPicker } from './ColorPicker';

/** All variant IDs for the selector. */
const VARIANT_IDS: BrushVariantId[] = ['soft', 'pencil', 'airbrush', 'marker'];

/** Tools that use brush-style options. */
const BRUSH_TOOLS = new Set(['brush', 'eraser', 'clone', 'dodge', 'burn']);

/** Tools that show this options panel. */
const PANEL_TOOLS = new Set([
  'brush', 'eraser', 'clone', 'dodge', 'burn',
  'gradient', 'fill', 'shape',
  'select', 'crop', 'text',
]);

/** BrushOptionsPanel — shown when brush, eraser, or other tools are active. */
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
  const gradientType = useAppStore((s) => s.gradientType);
  const setGradientType = useAppStore((s) => s.setGradientType);
  const shapeType = useAppStore((s) => s.shapeType);
  const setShapeType = useAppStore((s) => s.setShapeType);
  const fillTolerance = useAppStore((s) => s.fillTolerance);
  const setFillTolerance = useAppStore((s) => s.setFillTolerance);
  const selectionSubTool = useAppStore((s) => s.selectionSubTool);
  const setSelectionSubTool = useAppStore((s) => s.setSelectionSubTool);
  const selection = useAppStore((s) => s.selection);
  const cropToSelection = useAppStore((s) => s.cropToSelection);
  const editingTextLayerId = useAppStore((s) => s.editingTextLayerId);
  const commitAndStopEditingText = useAppStore((s) => s.commitAndStopEditingText);
  const cancelEditingText = useAppStore((s) => s.cancelEditingText);

  const [showPicker, setShowPicker] = useState(false);

  if (!PANEL_TOOLS.has(activeTool)) return null;

  // Select tool options
  if (activeTool === 'select') {
    const subTools = ['rect', 'ellipse', 'wand'] as const;
    return (
      <div className="brush-options-panel" data-testid="select-options">
        <div className="brush-option">
          <label className="brush-option__label">{t('brush.mode')}</label>
          <div className="shape-type-selector">
            {subTools.map((st) => (
              <button
                key={st}
                className={`shape-type-btn ${selectionSubTool === st ? 'shape-type-btn--active' : ''}`}
                onClick={(): void => setSelectionSubTool(st)}
              >
                {st === 'rect' ? t('brush.select.rect') : st === 'ellipse' ? t('brush.select.ellipse') : t('brush.select.wand')}
              </button>
            ))}
          </div>
        </div>
        {selectionSubTool === 'wand' && (
          <div className="brush-option">
            <label className="brush-option__label">{t('brush.tolerance')}</label>
            <input
              type="range"
              min="0"
              max="255"
              value={fillTolerance}
              onChange={(e): void => setFillTolerance(Number(e.target.value))}
              className="brush-option__slider"
            />
            <span className="brush-option__value">{fillTolerance}</span>
          </div>
        )}
      </div>
    );
  }

  // Crop tool options
  if (activeTool === 'crop') {
    return (
      <div className="brush-options-panel" data-testid="crop-options">
        <div className="brush-option">
          <button
            className="dialog-btn dialog-btn--primary"
            onClick={cropToSelection}
            disabled={!selection}
          >
            {t('brush.cropToSelection')}
          </button>
        </div>
      </div>
    );
  }

  // Gradient tool options
  if (activeTool === 'gradient') {
    const types = ['linear', 'radial', 'angle', 'diamond'] as const;
    return (
      <div className="brush-options-panel" data-testid="gradient-options">
        <div className="brush-option">
          <label className="brush-option__label">{t('brush.type')}</label>
          <div className="gradient-type-selector">
            {types.map((gradientTypeKey) => (
              <button
                key={gradientTypeKey}
                className={`gradient-type-btn ${gradientType === gradientTypeKey ? 'gradient-type-btn--active' : ''}`}
                onClick={(): void => setGradientType(gradientTypeKey)}
              >
                {t(`brush.gradient.${gradientTypeKey}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="brush-option">
          <label className="brush-option__label">{t('brush.opacity')}</label>
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
      </div>
    );
  }

  // Fill tool options
  if (activeTool === 'fill') {
    return (
      <div className="brush-options-panel" data-testid="fill-options">
        <div className="brush-option">
          <label className="brush-option__label">{t('brush.tolerance')}</label>
          <input
            type="range"
            min="0"
            max="255"
            value={fillTolerance}
            onChange={(e): void => setFillTolerance(Number(e.target.value))}
            className="brush-option__slider"
          />
          <span className="brush-option__value">{fillTolerance}</span>
        </div>
        <div className="brush-option">
          <label className="brush-option__label">{t('brush.opacity')}</label>
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
      </div>
    );
  }

  // Shape tool options
  if (activeTool === 'shape') {
    const shapes = ['rectangle', 'ellipse', 'line'] as const;
    return (
      <div className="brush-options-panel" data-testid="shape-options">
        <div className="brush-option">
          <label className="brush-option__label">{t('brush.shape')}</label>
          <div className="shape-type-selector">
            {shapes.map((shapeKey) => (
              <button
                key={shapeKey}
                className={`shape-type-btn ${shapeType === shapeKey ? 'shape-type-btn--active' : ''}`}
                onClick={(): void => setShapeType(shapeKey)}
              >
                {t(`brush.shape.${shapeKey}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="brush-option">
          <label className="brush-option__label">{t('brush.size')}</label>
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e): void => setBrushSize(Number(e.target.value))}
            className="brush-option__slider"
          />
          <span className="brush-option__value">{brushSize}px</span>
        </div>
      </div>
    );
  }

  // Text tool: show commit/cancel buttons only when editing
  if (activeTool === 'text') {
    if (!editingTextLayerId) return null;
    // Prevent mousedown from stealing focus from InlineTextEditor (which would
    // trigger handleBlur → commit before the onClick handler fires).
    const preventBlur = (e: React.MouseEvent): void => { e.preventDefault(); };
    return (
      <div className="brush-options-panel" data-testid="text-options">
        <div className="text-commit-buttons">
          <button
            className="text-commit-btn text-commit-btn--ok"
            onMouseDown={preventBlur}
            onClick={(): void => commitAndStopEditingText()}
            title={t('text.commit')}
          >
            ○
          </button>
          <button
            className="text-commit-btn text-commit-btn--cancel"
            onMouseDown={preventBlur}
            onClick={(): void => cancelEditingText()}
            title={t('text.cancel')}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // Brush-style tools (brush, eraser, clone, dodge, burn)
  if (!BRUSH_TOOLS.has(activeTool)) return null;

  const variant = BRUSH_VARIANTS[brushVariant];
  const hardnessDisabled = variant.hardnessOverride !== null;

  return (
    <div className="brush-options-panel" data-testid="brush-options">
      {/* Variant selector */}
      <div className="brush-option">
        <label className="brush-option__label">{t('brush.type')}</label>
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
        <label className="brush-option__label">{t('brush.size')}</label>
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
          {t('brush.hardness')}
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
        <label className="brush-option__label">{t('brush.opacity')}</label>
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
            title={t('brush.colorPickerToggle')}
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
