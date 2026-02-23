/**
 * @module components/panels/AssetBrowser
 * Asset browser panel for managing brush and style presets.
 *
 * Features:
 * - ABR file import with thumbnail grid display
 * - ASL file import with effect summary display
 * - Click to select brush preset
 * - Double-click to apply style to selected layer
 * - Preset persistence via localStorage
 *
 * @see APP-007: Asset browser
 * @see {@link @photoshop-app/types!BrushPreset}
 * @see {@link @photoshop-app/types!LayerStylePreset}
 */

import React, { useCallback, useRef, useState } from 'react';
import type { LayerEffect } from '@photoshop-app/types';
import { useAssetStore } from './asset-store';

/** Active tab within the asset browser. */
type AssetTab = 'brushes' | 'styles';

/** Format a list of effects as a short summary string. */
function formatEffectSummary(effects: readonly LayerEffect[]): string {
  if (effects.length === 0) return 'No effects';
  return effects
    .map((e) => {
      switch (e.type) {
        case 'stroke':
          return 'Stroke';
        case 'drop-shadow':
          return 'Drop Shadow';
        case 'outer-glow':
          return 'Outer Glow';
        default:
          return 'Effect';
      }
    })
    .join(' + ');
}

/** Brush grid panel — displays imported brush presets as a thumbnail grid. */
function BrushPanel(): React.JSX.Element {
  const brushPresets = useAssetStore((s) => s.brushPresets);
  const brushThumbnails = useAssetStore((s) => s.brushThumbnails);
  const selectedBrushId = useAssetStore((s) => s.selectedBrushId);
  const selectBrush = useAssetStore((s) => s.selectBrush);
  const importAbr = useAssetStore((s) => s.importAbr);
  const removeBrush = useAssetStore((s) => s.removeBrush);
  const clearBrushes = useAssetStore((s) => s.clearBrushes);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Handle ABR file selection from the hidden file input. */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (): void => {
        const buffer = reader.result as ArrayBuffer;
        importAbr(buffer, file.name);
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
    },
    [importAbr],
  );

  /** Handle right-click on a brush item to remove it. */
  const handleBrushContextMenu = useCallback(
    (e: React.MouseEvent, brushId: string): void => {
      e.preventDefault();
      removeBrush(brushId);
    },
    [removeBrush],
  );

  return (
    <>
      <div className="asset-browser__actions">
        <button
          className="asset-browser__import-btn"
          onClick={(): void => fileInputRef.current?.click()}
        >
          + Import ABR
        </button>
        {brushPresets.length > 0 && (
          <button className="asset-browser__clear-btn" onClick={clearBrushes}>
            Clear
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".abr"
        className="asset-browser__file-input"
        onChange={handleFileChange}
      />
      <div className="asset-browser__grid">
        {brushPresets.map((brush) => (
          <button
            key={brush.id}
            className={`asset-browser__brush-item ${
              selectedBrushId === brush.id ? 'asset-browser__brush-item--selected' : ''
            }`}
            onClick={(): void => selectBrush(brush.id)}
            onContextMenu={(e): void => handleBrushContextMenu(e, brush.id)}
            title={`${brush.name} (${brush.diameter}px)`}
          >
            {brushThumbnails[brush.id] ? (
              <img
                src={brushThumbnails[brush.id]}
                alt={brush.name}
                className="asset-browser__brush-thumb"
              />
            ) : (
              <div className="asset-browser__brush-placeholder" />
            )}
          </button>
        ))}
        {brushPresets.length === 0 && (
          <div className="asset-browser__empty">
            No brushes loaded.
            <br />
            Import an ABR file to get started.
          </div>
        )}
      </div>
    </>
  );
}

/** Style list panel — displays imported layer style presets as a list. */
function StylePanel(): React.JSX.Element {
  const stylePresets = useAssetStore((s) => s.stylePresets);
  const importAsl = useAssetStore((s) => s.importAsl);
  const applyStyle = useAssetStore((s) => s.applyStyle);
  const removeStyle = useAssetStore((s) => s.removeStyle);
  const clearStyles = useAssetStore((s) => s.clearStyles);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Handle ASL file selection. */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (): void => {
        const buffer = reader.result as ArrayBuffer;
        importAsl(buffer, file.name);
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
    },
    [importAsl],
  );

  /** Handle double-click to apply style to the selected layer. */
  const handleStyleDoubleClick = useCallback(
    (styleId: string): void => {
      applyStyle(styleId);
    },
    [applyStyle],
  );

  /** Handle right-click to remove style. */
  const handleStyleContextMenu = useCallback(
    (e: React.MouseEvent, styleId: string): void => {
      e.preventDefault();
      removeStyle(styleId);
    },
    [removeStyle],
  );

  return (
    <>
      <div className="asset-browser__actions">
        <button
          className="asset-browser__import-btn"
          onClick={(): void => fileInputRef.current?.click()}
        >
          + Import ASL
        </button>
        {stylePresets.length > 0 && (
          <button className="asset-browser__clear-btn" onClick={clearStyles}>
            Clear
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".asl"
        className="asset-browser__file-input"
        onChange={handleFileChange}
      />
      <div className="asset-browser__style-list">
        {stylePresets.map((style) => (
          <div
            key={style.id}
            className="asset-browser__style-item"
            onDoubleClick={(): void => handleStyleDoubleClick(style.id)}
            onContextMenu={(e): void => handleStyleContextMenu(e, style.id)}
            title="Double-click to apply"
          >
            <div className="asset-browser__style-name">{style.name}</div>
            <div className="asset-browser__style-effects">
              {formatEffectSummary(style.effects)}
            </div>
          </div>
        ))}
        {stylePresets.length === 0 && (
          <div className="asset-browser__empty">
            No styles loaded.
            <br />
            Import an ASL file to get started.
          </div>
        )}
      </div>
    </>
  );
}

/** Asset browser panel with tabbed brush/style sections. */
export function AssetBrowser(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AssetTab>('brushes');

  return (
    <div className="asset-browser">
      <div className="asset-browser__tabs">
        <button
          className={`asset-browser__tab ${
            activeTab === 'brushes' ? 'asset-browser__tab--active' : ''
          }`}
          onClick={(): void => setActiveTab('brushes')}
        >
          Brushes
        </button>
        <button
          className={`asset-browser__tab ${
            activeTab === 'styles' ? 'asset-browser__tab--active' : ''
          }`}
          onClick={(): void => setActiveTab('styles')}
        >
          Styles
        </button>
      </div>
      {activeTab === 'brushes' ? <BrushPanel /> : <StylePanel />}
    </div>
  );
}
