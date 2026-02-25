/**
 * @module components/panels/TextStylePresetsPanel
 * UI panel for browsing, applying, and managing text style presets.
 *
 * Features:
 * - Category tabs: All / YouTube / Impact / Elegant / Custom / Imported
 * - Card view with mini canvas preview for each preset ("Aa" rendered in style)
 * - Click card to apply preset to selected text layer (font, size, color, effects)
 * - If no text layer is selected, creates a new text layer with the preset style
 * - "Save current style" button to save custom presets
 * - Right-click on custom preset to delete
 * - localStorage persistence for custom presets
 *
 * @see PRESET-001 ticket
 * @see text-style-presets.ts for preset definitions and CRUD functions
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { t } from '../../i18n';
import {
  BUILT_IN_TEXT_STYLES,
  loadCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from './text-style-presets';
import type { TextStylePreset } from './text-style-presets';
import type { Color, LayerEffect, TextLayer } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';

/** Category filter type for the preset panel tabs. */
type PresetCategory = 'all' | 'youtube' | 'impact' | 'elegant' | 'custom' | 'imported';

/** Tab definitions for category filter. */
interface CategoryTab {
  /** Category key used for filtering. */
  key: PresetCategory;
  /** i18n message key for the tab label. */
  labelKey: string;
}

/** Ordered list of category tabs. */
const CATEGORY_TABS: CategoryTab[] = [
  { key: 'all', labelKey: 'textStyle.categoryAll' },
  { key: 'youtube', labelKey: 'textStyle.categoryYouTube' },
  { key: 'impact', labelKey: 'textStyle.categoryImpact' },
  { key: 'elegant', labelKey: 'textStyle.categoryElegant' },
  { key: 'custom', labelKey: 'textStyle.categoryCustom' },
  { key: 'imported', labelKey: 'textStyle.categoryImported' },
];

/** Canvas preview dimensions in pixels. */
const PREVIEW_WIDTH = 80;
const PREVIEW_HEIGHT = 48;

/**
 * Convert a Color to a CSS rgba() string.
 * @param color - RGBA color with r/g/b in 0-255 and a in 0-1.
 * @returns CSS rgba() string.
 */
function colorToCss(color: Color): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
}

/**
 * Render a mini canvas preview for a text style preset.
 * Draws "Aa" text in the preset's font, color, and approximate effects (stroke).
 * @param canvas - The target canvas element.
 * @param preset - The preset to preview.
 */
function renderPresetPreview(canvas: HTMLCanvasElement, preset: TextStylePreset): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Clear with a subtle checkerboard-like background
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, w, h);

  // Scale font to fit the preview
  const previewFontSize = Math.min(28, preset.fontSize * 0.4);
  const weight = preset.bold ? 'bold' : 'normal';
  const style = preset.italic ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${previewFontSize}px ${preset.fontFamily}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerX = w / 2;
  const centerY = h / 2;

  // Draw stroke effects first (behind text)
  for (const effect of preset.effects) {
    if (!effect.enabled) continue;
    if (effect.type === 'stroke') {
      const strokeEffect = effect as LayerEffect & { color: Color; size: number };
      ctx.strokeStyle = colorToCss(strokeEffect.color);
      ctx.lineWidth = Math.min(strokeEffect.size, 3);
      ctx.lineJoin = 'round';
      ctx.strokeText('Aa', centerX, centerY);
    }
  }

  // Draw outer glow (simplified as blur shadow)
  for (const effect of preset.effects) {
    if (!effect.enabled) continue;
    if (effect.type === 'outer-glow') {
      const glowEffect = effect as LayerEffect & { color: Color; blur: number; opacity: number };
      ctx.save();
      ctx.shadowColor = colorToCss({ ...glowEffect.color, a: glowEffect.opacity });
      ctx.shadowBlur = Math.min(glowEffect.blur ?? 0, 8);
      ctx.fillStyle = colorToCss(preset.color);
      ctx.fillText('Aa', centerX, centerY);
      ctx.restore();
    }
  }

  // Draw drop shadow
  for (const effect of preset.effects) {
    if (!effect.enabled) continue;
    if (effect.type === 'drop-shadow') {
      const shadowEffect = effect as LayerEffect & {
        color: Color;
        distance: number;
        angle: number;
        blur: number;
        opacity: number;
      };
      ctx.save();
      const rad = (shadowEffect.angle * Math.PI) / 180;
      ctx.shadowOffsetX = Math.cos(rad) * Math.min(shadowEffect.distance, 3);
      ctx.shadowOffsetY = Math.sin(rad) * Math.min(shadowEffect.distance, 3);
      ctx.shadowBlur = Math.min(shadowEffect.blur, 6);
      ctx.shadowColor = colorToCss({ ...shadowEffect.color, a: shadowEffect.opacity });
      ctx.fillStyle = colorToCss(preset.color);
      ctx.fillText('Aa', centerX, centerY);
      ctx.restore();
    }
  }

  // Draw the main text
  ctx.fillStyle = colorToCss(preset.color);
  ctx.fillText('Aa', centerX, centerY);
}

/**
 * Mini canvas component that renders a preview of a text style preset.
 * @param props.preset - The text style preset to render.
 */
function PresetPreviewCanvas({ preset }: { preset: TextStylePreset }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderPresetPreview(canvasRef.current, preset);
    }
  }, [preset]);

  return (
    <canvas
      ref={canvasRef}
      width={PREVIEW_WIDTH}
      height={PREVIEW_HEIGHT}
      style={{ borderRadius: 4, display: 'block' }}
    />
  );
}

/**
 * Text style presets panel component.
 * Displays built-in and custom presets in a grid, with category filtering,
 * one-click application, and custom preset management.
 */
export function TextStylePresetsPanel(): React.JSX.Element | null {
  const document = useAppStore((state) => state.document);
  const selectedLayerId = useAppStore((state) => state.selectedLayerId);
  const setTextProperty = useAppStore((state) => state.setTextProperty);
  const setLayerEffects = useAppStore((state) => state.setLayerEffects);
  const addTextLayer = useAppStore((state) => state.addTextLayer);
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);

  const [activeCategory, setActiveCategory] = useState<PresetCategory>('all');
  const [customPresets, setCustomPresets] = useState<TextStylePreset[]>(() => loadCustomPresets());
  const [contextMenuPresetId, setContextMenuPresetId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  /** Reload custom presets from localStorage. */
  const refreshCustomPresets = useCallback((): void => {
    setCustomPresets(loadCustomPresets());
  }, []);

  /** All presets (built-in + custom). */
  const allPresets = useMemo((): TextStylePreset[] => {
    return [...BUILT_IN_TEXT_STYLES, ...customPresets];
  }, [customPresets]);

  /** Filtered presets based on active category. */
  const filteredPresets = useMemo((): TextStylePreset[] => {
    if (activeCategory === 'all') return allPresets;
    return allPresets.filter((p) => p.category === activeCategory);
  }, [allPresets, activeCategory]);

  /** Get the selected text layer, or null. */
  const selectedTextLayer = useMemo((): TextLayer | null => {
    if (!document || !selectedLayerId) return null;
    const layer = findLayerById(document.rootGroup, selectedLayerId);
    if (!layer || layer.type !== 'text') return null;
    return layer;
  }, [document, selectedLayerId]);

  /**
   * Apply a preset to the selected text layer.
   * If no text layer is selected, create a new one with the preset style.
   */
  const handleApplyPreset = useCallback(
    (preset: TextStylePreset): void => {
      if (selectedTextLayer) {
        // Apply to existing text layer
        setTextProperty(selectedTextLayer.id, 'fontFamily', preset.fontFamily);
        setTextProperty(selectedTextLayer.id, 'fontSize', preset.fontSize);
        setTextProperty(selectedTextLayer.id, 'bold', preset.bold);
        setTextProperty(selectedTextLayer.id, 'italic', preset.italic);
        setTextProperty(selectedTextLayer.id, 'color', { ...preset.color });
        if (preset.letterSpacing !== undefined) {
          setTextProperty(selectedTextLayer.id, 'letterSpacing', preset.letterSpacing);
        }
        if (preset.lineHeight !== undefined) {
          setTextProperty(selectedTextLayer.id, 'lineHeight', preset.lineHeight);
        }
        setLayerEffects(selectedTextLayer.id, [...preset.effects]);
        setStatusMessage(t('textStyle.applied'));
      } else if (document) {
        // No text layer selected: create a new one
        addTextLayer(preset.name);
        // After addTextLayer, the new layer is selected.
        // We need to apply styles in the next tick since the store is updated asynchronously.
        const state = useAppStore.getState();
        const newLayerId = state.selectedLayerId;
        if (newLayerId) {
          setTextProperty(newLayerId, 'fontFamily', preset.fontFamily);
          setTextProperty(newLayerId, 'fontSize', preset.fontSize);
          setTextProperty(newLayerId, 'bold', preset.bold);
          setTextProperty(newLayerId, 'italic', preset.italic);
          setTextProperty(newLayerId, 'color', { ...preset.color });
          if (preset.letterSpacing !== undefined) {
            setTextProperty(newLayerId, 'letterSpacing', preset.letterSpacing);
          }
          if (preset.lineHeight !== undefined) {
            setTextProperty(newLayerId, 'lineHeight', preset.lineHeight);
          }
          setLayerEffects(newLayerId, [...preset.effects]);
        }
        setStatusMessage(t('textStyle.createdLayer'));
      }
    },
    [selectedTextLayer, document, setTextProperty, setLayerEffects, addTextLayer, setStatusMessage],
  );

  /** Save the current text layer's style as a custom preset. */
  const handleSaveCurrentStyle = useCallback((): void => {
    if (!selectedTextLayer) {
      setStatusMessage(t('textStyle.selectTextLayer'));
      return;
    }
    const name = window.prompt(t('textStyle.enterName'));
    if (!name || name.trim().length === 0) return;

    saveCustomPreset({
      name: name.trim(),
      fontFamily: selectedTextLayer.fontFamily,
      fontSize: selectedTextLayer.fontSize,
      bold: selectedTextLayer.bold,
      italic: selectedTextLayer.italic,
      color: { ...selectedTextLayer.color },
      letterSpacing: selectedTextLayer.letterSpacing,
      lineHeight: selectedTextLayer.lineHeight,
      effects: [...selectedTextLayer.effects],
      source: null,
    });
    refreshCustomPresets();
    setStatusMessage(t('textStyle.saved'));
  }, [selectedTextLayer, refreshCustomPresets, setStatusMessage]);

  /** Handle right-click on a preset card. */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, preset: TextStylePreset): void => {
      if (preset.builtIn) return; // Cannot delete built-in presets
      e.preventDefault();
      setContextMenuPresetId(preset.id);
      setContextMenuPos({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  /** Delete a custom preset. */
  const handleDeletePreset = useCallback((): void => {
    if (!contextMenuPresetId) return;
    deleteCustomPreset(contextMenuPresetId);
    refreshCustomPresets();
    setContextMenuPresetId(null);
    setContextMenuPos(null);
    setStatusMessage(t('textStyle.deleted'));
  }, [contextMenuPresetId, refreshCustomPresets, setStatusMessage]);

  /** Close context menu. */
  const handleCloseContextMenu = useCallback((): void => {
    setContextMenuPresetId(null);
    setContextMenuPos(null);
  }, []);

  // Close context menu when clicking anywhere else
  useEffect(() => {
    if (!contextMenuPresetId) return;
    const handler = (): void => handleCloseContextMenu();
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenuPresetId, handleCloseContextMenu]);

  if (!document) {
    return null;
  }

  return (
    <div className="text-style-presets-panel" data-testid="text-style-presets-panel">
      {/* Header */}
      <div className="sidebar-header">
        <span>{t('sidebar.textStyles')}</span>
      </div>

      {/* Category tabs */}
      <div
        className="text-style-category-tabs"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          padding: '4px 8px',
          borderBottom: '1px solid #444',
        }}
      >
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`layer-action-btn ${activeCategory === tab.key ? 'layer-action-btn--active' : ''}`}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              background: activeCategory === tab.key ? '#555' : 'transparent',
              border: activeCategory === tab.key ? '1px solid #888' : '1px solid transparent',
              color: activeCategory === tab.key ? '#fff' : '#aaa',
              borderRadius: 3,
              cursor: 'pointer',
            }}
            onClick={() => setActiveCategory(tab.key)}
            data-testid={`category-tab-${tab.key}`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Preset grid */}
      <div
        className="text-style-preset-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: 8,
          padding: 8,
          overflowY: 'auto',
          maxHeight: 320,
        }}
      >
        {filteredPresets.length === 0 && (
          <div style={{ color: '#888', fontSize: 12, gridColumn: '1 / -1', textAlign: 'center' }}>
            {t('textStyle.noPresets')}
          </div>
        )}
        {filteredPresets.map((preset) => (
          <div
            key={preset.id}
            className="text-style-preset-card"
            data-testid={`preset-card-${preset.id}`}
            style={{
              cursor: 'pointer',
              borderRadius: 6,
              border: '1px solid #555',
              overflow: 'hidden',
              background: '#333',
              transition: 'border-color 0.15s',
            }}
            onClick={() => handleApplyPreset(preset)}
            onContextMenu={(e) => handleContextMenu(e, preset)}
            title={preset.name}
          >
            <PresetPreviewCanvas preset={preset} />
            <div
              style={{
                fontSize: 10,
                textAlign: 'center',
                padding: '2px 4px',
                color: '#ccc',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {preset.name}
            </div>
          </div>
        ))}
      </div>

      {/* Save current style button */}
      <div style={{ padding: '8px', borderTop: '1px solid #444' }}>
        <button
          className="layer-action-btn"
          onClick={handleSaveCurrentStyle}
          style={{ width: '100%' }}
          data-testid="save-current-style-btn"
        >
          {t('textStyle.saveCurrent')}
        </button>
      </div>

      {/* Context menu for custom preset deletion */}
      {contextMenuPresetId && contextMenuPos && (
        <div
          className="text-style-context-menu"
          data-testid="preset-context-menu"
          style={{
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            background: '#2a2a2a',
            border: '1px solid #555',
            borderRadius: 4,
            padding: 4,
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          <button
            className="layer-action-btn"
            onClick={handleDeletePreset}
            style={{ width: '100%', color: '#ff6b6b', fontSize: 12 }}
            data-testid="delete-preset-btn"
          >
            {t('textStyle.deletePreset')}
          </button>
        </div>
      )}
    </div>
  );
}
