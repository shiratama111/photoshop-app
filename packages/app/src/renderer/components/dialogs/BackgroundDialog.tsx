/**
 * @module BackgroundDialog
 * Dialog for generating gradient background layers.
 *
 * Features preset selection (12 presets) and custom gradient configuration.
 * Generates a raster layer via generateGradientBackground().
 *
 * @see Phase 1-3: Background & atmosphere tools
 * @see background-presets.ts for preset definitions
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { t } from '../../i18n';
import { generateGradientBackground } from '@photoshop-app/core';
import type { GradientStop, GradientType } from '@photoshop-app/core';
import { BACKGROUND_PRESETS } from './background-presets';
import type { BackgroundPreset } from './background-presets';

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 112;

function stopToHex(stop: GradientStop): string {
  const r = stop.r.toString(16).padStart(2, '0');
  const g = stop.g.toString(16).padStart(2, '0');
  const b = stop.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function BackgroundDialog(): React.JSX.Element | null {
  const show = useAppStore((s) => s.showBackgroundDialog);
  const closeDialog = useAppStore((s) => s.closeBackgroundDialog);
  const addProceduralLayer = useAppStore((s) => s.addProceduralLayer);
  const doc = useAppStore((s) => s.document);

  const [selectedPreset, setSelectedPreset] = useState<BackgroundPreset | null>(BACKGROUND_PRESETS[0]);
  const [customMode, setCustomMode] = useState(false);
  const [customStops, setCustomStops] = useState<GradientStop[]>([
    { position: 0, r: 255, g: 0, b: 0, a: 255 },
    { position: 1, r: 0, g: 0, b: 255, a: 255 },
  ]);
  const [customType, setCustomType] = useState<GradientType>('linear');
  const [customAngle, setCustomAngle] = useState(180);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const activeStops = customMode ? customStops : (selectedPreset?.stops ?? BACKGROUND_PRESETS[0].stops);
  const activeType = customMode ? customType : (selectedPreset?.type ?? 'linear');
  const activeAngle = customMode ? customAngle : (selectedPreset?.angle ?? 180);

  // Render preview
  useEffect(() => {
    if (!show) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = generateGradientBackground(
      PREVIEW_WIDTH, PREVIEW_HEIGHT,
      activeStops, activeType, activeAngle,
    );
    ctx.putImageData(imageData, 0, 0);
  }, [show, activeStops, activeType, activeAngle]);

  // Reset on open
  useEffect(() => {
    if (show) {
      setSelectedPreset(BACKGROUND_PRESETS[0]);
      setCustomMode(false);
    }
  }, [show]);

  const handleAdd = useCallback(() => {
    if (!doc) return;
    const { width, height } = doc.canvas.size;
    const imageData = generateGradientBackground(width, height, activeStops, activeType, activeAngle);
    const name = customMode ? 'Gradient Background' : (selectedPreset?.name ?? 'Gradient Background');
    addProceduralLayer(name, imageData);
    closeDialog();
  }, [doc, activeStops, activeType, activeAngle, customMode, selectedPreset, addProceduralLayer, closeDialog]);

  const handleColorChange = useCallback((index: number, hex: string) => {
    const rgb = hexToRgb(hex);
    setCustomStops((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...rgb };
      return next;
    });
  }, []);

  const handleAddStop = useCallback(() => {
    if (customStops.length >= 4) return;
    const pos = customStops.length === 2 ? 0.5 : customStops.length === 3 ? 0.75 : 0.25;
    setCustomStops((prev) => [...prev, { position: pos, r: 128, g: 128, b: 128, a: 255 }]
      .sort((a, b) => a.position - b.position));
  }, [customStops.length]);

  const handleRemoveStop = useCallback((index: number) => {
    if (customStops.length <= 2) return;
    setCustomStops((prev) => prev.filter((_, i) => i !== index));
  }, [customStops.length]);

  if (!show) return null;

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog background-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <div className="dialog-header">{t('insert.backgroundTitle')}</div>
        <div className="dialog-body">
          {/* Mode toggle */}
          <div className="layer-style-dialog__row" style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', gap: 8 }}>
              <button
                className={`dialog-btn ${!customMode ? 'dialog-btn--primary' : ''}`}
                onClick={() => setCustomMode(false)}
                style={{ flex: 1 }}
              >
                {t('background.presets')}
              </button>
              <button
                className={`dialog-btn ${customMode ? 'dialog-btn--primary' : ''}`}
                onClick={() => setCustomMode(true)}
                style={{ flex: 1 }}
              >
                {t('background.custom')}
              </button>
            </label>
          </div>

          {!customMode ? (
            /* Preset grid */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              marginBottom: 12,
            }}>
              {BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setSelectedPreset(preset)}
                  style={{
                    width: '100%',
                    height: 50,
                    border: selectedPreset?.name === preset.name ? '2px solid #0078d4' : '1px solid #555',
                    borderRadius: 4,
                    background: `linear-gradient(${preset.angle}deg, ${preset.stops.map((s) =>
                      `rgb(${s.r},${s.g},${s.b}) ${s.position * 100}%`).join(', ')})`,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title={preset.name}
                />
              ))}
            </div>
          ) : (
            /* Custom mode */
            <div style={{ marginBottom: 12 }}>
              <div className="layer-style-dialog__row">
                <span className="layer-style-dialog__label">{t('background.type')}</span>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as GradientType)}
                  style={{ flex: 1 }}
                >
                  <option value="linear">Linear</option>
                  <option value="radial">Radial</option>
                  <option value="angle">Angle</option>
                  <option value="diamond">Diamond</option>
                </select>
              </div>

              {customType !== 'radial' && (
                <div className="layer-style-dialog__row">
                  <span className="layer-style-dialog__label">{t('background.angle')}</span>
                  <input
                    type="range"
                    className="effect-slider"
                    min={0}
                    max={360}
                    value={customAngle}
                    onChange={(e) => setCustomAngle(Number(e.target.value))}
                  />
                  <span className="effect-slider-value">{customAngle}°</span>
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <span className="layer-style-dialog__label">{t('background.colors')}</span>
                {customStops.map((stop, i) => (
                  <div key={i} className="layer-style-dialog__row" style={{ marginTop: 4 }}>
                    <input
                      type="color"
                      value={stopToHex(stop)}
                      onChange={(e) => handleColorChange(i, e.target.value)}
                      style={{ width: 32, height: 24 }}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{Math.round(stop.position * 100)}%</span>
                    {customStops.length > 2 && (
                      <button
                        className="dialog-btn"
                        onClick={() => handleRemoveStop(i)}
                        style={{ padding: '0 6px', fontSize: 11 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {customStops.length < 4 && (
                  <button
                    className="dialog-btn"
                    onClick={handleAddStop}
                    style={{ marginTop: 4, fontSize: 11 }}
                  >
                    + {t('background.addColor')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span className="layer-style-dialog__label">{t('common.preview')}</span>
            <canvas
              ref={previewRef}
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              style={{ display: 'block', margin: '4px auto', border: '1px solid #555', borderRadius: 4 }}
            />
          </div>
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn" onClick={closeDialog}>{t('common.cancel')}</button>
          <button className="dialog-btn dialog-btn--primary" onClick={handleAdd} disabled={!doc}>
            {t('common.addAsLayer')}
          </button>
        </div>
      </div>
    </div>
  );
}
