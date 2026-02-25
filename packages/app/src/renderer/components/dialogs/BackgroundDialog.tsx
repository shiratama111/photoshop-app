/**
 * @module BackgroundDialog
 * Dialog for generating gradient and pattern background layers.
 *
 * Features three tabs: gradient presets (12 presets), custom gradient
 * configuration, and pattern presets (8 presets) for quick overlay application.
 * Generates raster layers via generateGradientBackground() and pattern-generator
 * functions.
 *
 * @see Phase 1-3: Background & atmosphere tools
 * @see BG-001: Pattern overlay & background expansion
 * @see background-presets.ts for preset definitions
 * @see pattern-generator.ts for procedural pattern generation
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { t } from '../../i18n';
import { generateGradientBackground } from '@photoshop-app/core';
import type { GradientStop, GradientType } from '@photoshop-app/core';
import { BACKGROUND_PRESETS, PATTERN_PRESETS } from './background-presets';
import type { BackgroundPreset, PatternPreset } from './background-presets';
import {
  generateDotPattern,
  generateStripePattern,
  generateCheckerboardPattern,
  generateHatchPattern,
} from './pattern-generator';

/** Active tab in the BackgroundDialog. */
type BackgroundTab = 'presets' | 'custom' | 'pattern';

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 112;

/**
 * Convert a GradientStop to a hex color string.
 *
 * @param stop - Gradient stop to convert
 * @returns Hex color string (e.g. "#FF0000")
 */
function stopToHex(stop: GradientStop): string {
  const r = stop.r.toString(16).padStart(2, '0');
  const g = stop.g.toString(16).padStart(2, '0');
  const b = stop.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Convert a hex color string to RGB components.
 *
 * @param hex - Hex color string (e.g. "#FF0000")
 * @returns Object with r, g, b channels (0-255)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/**
 * Generate pattern ImageData from a PatternPreset configuration.
 *
 * @param preset - Pattern preset definition
 * @param width - Output width in pixels
 * @param height - Output height in pixels
 * @param opacity - Overall opacity (0-1)
 * @returns Generated ImageData
 */
function generatePatternFromPreset(
  preset: PatternPreset,
  width: number,
  height: number,
  opacity: number,
): ImageData {
  const { config } = preset;
  switch (config.type) {
    case 'dots':
      return generateDotPattern({
        width,
        height,
        dotSize: config.dotSize,
        spacing: config.spacing,
        color: config.color,
        opacity,
      });
    case 'stripes':
      return generateStripePattern({
        width,
        height,
        stripeWidth: config.stripeWidth,
        gap: config.gap,
        color: config.color,
        angle: config.angle,
        opacity,
      });
    case 'checkerboard':
      return generateCheckerboardPattern({
        width,
        height,
        cellSize: config.cellSize,
        color1: config.color1,
        color2: config.color2,
        opacity,
      });
    case 'hatching':
      return generateHatchPattern({
        width,
        height,
        lineWidth: config.lineWidth,
        spacing: config.spacing,
        angle: config.angle,
        color: config.color,
        opacity,
      });
  }
}

/**
 * Get a CSS preview background string for a pattern preset button.
 *
 * @param preset - Pattern preset definition
 * @returns CSS background value for the button
 */
function getPatternPreviewCss(preset: PatternPreset): string {
  const { config } = preset;
  switch (config.type) {
    case 'dots':
      return `radial-gradient(circle ${config.dotSize}px, rgb(${config.color.r},${config.color.g},${config.color.b}) 50%, transparent 50%)`;
    case 'stripes': {
      const total = config.stripeWidth + config.gap;
      const c = config.color;
      return `repeating-linear-gradient(${config.angle}deg, rgb(${c.r},${c.g},${c.b}) 0px, rgb(${c.r},${c.g},${c.b}) ${config.stripeWidth}px, transparent ${config.stripeWidth}px, transparent ${total}px)`;
    }
    case 'checkerboard': {
      const c1 = config.color1;
      const c2 = config.color2;
      return `repeating-conic-gradient(rgb(${c1.r},${c1.g},${c1.b}) 0% 25%, rgb(${c2.r},${c2.g},${c2.b}) 0% 50%) 0 0 / ${config.cellSize * 2}px ${config.cellSize * 2}px`;
    }
    case 'hatching': {
      const c = config.color;
      return `repeating-linear-gradient(${config.angle}deg, rgb(${c.r},${c.g},${c.b}) 0px, rgb(${c.r},${c.g},${c.b}) ${config.lineWidth}px, transparent ${config.lineWidth}px, transparent ${config.spacing}px)`;
    }
  }
}

/** BackgroundDialog component for generating gradient and pattern backgrounds. */
export function BackgroundDialog(): React.JSX.Element | null {
  const show = useAppStore((s) => s.showBackgroundDialog);
  const closeDialog = useAppStore((s) => s.closeBackgroundDialog);
  const addProceduralLayer = useAppStore((s) => s.addProceduralLayer);
  const doc = useAppStore((s) => s.document);

  const [tab, setTab] = useState<BackgroundTab>('presets');
  const [selectedPreset, setSelectedPreset] = useState<BackgroundPreset | null>(BACKGROUND_PRESETS[0]);
  const [selectedPatternPreset, setSelectedPatternPreset] = useState<PatternPreset | null>(PATTERN_PRESETS[0]);
  const [patternOpacity, setPatternOpacity] = useState(0.8);
  const [customStops, setCustomStops] = useState<GradientStop[]>([
    { position: 0, r: 255, g: 0, b: 0, a: 255 },
    { position: 1, r: 0, g: 0, b: 255, a: 255 },
  ]);
  const [customType, setCustomType] = useState<GradientType>('linear');
  const [customAngle, setCustomAngle] = useState(180);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const activeStops = tab === 'custom' ? customStops : (selectedPreset?.stops ?? BACKGROUND_PRESETS[0].stops);
  const activeType = tab === 'custom' ? customType : (selectedPreset?.type ?? 'linear');
  const activeAngle = tab === 'custom' ? customAngle : (selectedPreset?.angle ?? 180);

  // Render preview
  useEffect(() => {
    if (!show) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (tab === 'pattern' && selectedPatternPreset) {
      // Pattern preview with transparency checkerboard
      ctx.fillStyle = '#ccc';
      ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
      for (let y = 0; y < PREVIEW_HEIGHT; y += 8) {
        for (let x = 0; x < PREVIEW_WIDTH; x += 8) {
          if ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(x, y, 8, 8);
          }
        }
      }
      const imageData = generatePatternFromPreset(
        selectedPatternPreset,
        PREVIEW_WIDTH,
        PREVIEW_HEIGHT,
        patternOpacity,
      );
      ctx.putImageData(imageData, 0, 0);
    } else {
      const imageData = generateGradientBackground(
        PREVIEW_WIDTH, PREVIEW_HEIGHT,
        activeStops, activeType, activeAngle,
      );
      ctx.putImageData(imageData, 0, 0);
    }
  }, [show, tab, activeStops, activeType, activeAngle, selectedPatternPreset, patternOpacity]);

  // Reset on open
  useEffect(() => {
    if (show) {
      setTab('presets');
      setSelectedPreset(BACKGROUND_PRESETS[0]);
      setSelectedPatternPreset(PATTERN_PRESETS[0]);
      setPatternOpacity(0.8);
    }
  }, [show]);

  const handleAdd = useCallback(() => {
    if (!doc) return;
    const { width, height } = doc.canvas.size;

    if (tab === 'pattern' && selectedPatternPreset) {
      const imageData = generatePatternFromPreset(
        selectedPatternPreset,
        width,
        height,
        patternOpacity,
      );
      addProceduralLayer(selectedPatternPreset.name, imageData);
    } else {
      const imageData = generateGradientBackground(width, height, activeStops, activeType, activeAngle);
      const name = tab === 'custom' ? 'Gradient Background' : (selectedPreset?.name ?? 'Gradient Background');
      addProceduralLayer(name, imageData);
    }
    closeDialog();
  }, [doc, tab, activeStops, activeType, activeAngle, selectedPreset, selectedPatternPreset, patternOpacity, addProceduralLayer, closeDialog]);

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
          {/* Tab toggle */}
          <div className="layer-style-dialog__row" style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', gap: 8 }}>
              <button
                className={`dialog-btn ${tab === 'presets' ? 'dialog-btn--primary' : ''}`}
                onClick={() => setTab('presets')}
                style={{ flex: 1 }}
              >
                {t('background.presets')}
              </button>
              <button
                className={`dialog-btn ${tab === 'custom' ? 'dialog-btn--primary' : ''}`}
                onClick={() => setTab('custom')}
                style={{ flex: 1 }}
              >
                {t('background.custom')}
              </button>
              <button
                className={`dialog-btn ${tab === 'pattern' ? 'dialog-btn--primary' : ''}`}
                onClick={() => setTab('pattern')}
                style={{ flex: 1 }}
              >
                {t('background.pattern')}
              </button>
            </label>
          </div>

          {tab === 'presets' && (
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
          )}

          {tab === 'custom' && (
            /* Custom gradient mode */
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

          {tab === 'pattern' && (
            /* Pattern presets */
            <div style={{ marginBottom: 12 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                marginBottom: 8,
              }}>
                {PATTERN_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedPatternPreset(preset)}
                    style={{
                      width: '100%',
                      height: 50,
                      border: selectedPatternPreset?.name === preset.name ? '2px solid #0078d4' : '1px solid #555',
                      borderRadius: 4,
                      background: getPatternPreviewCss(preset),
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 9,
                      color: '#fff',
                      textShadow: '0 0 3px #000',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      paddingBottom: 2,
                    }}
                    title={preset.name}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* Pattern opacity */}
              <div className="layer-style-dialog__row">
                <span className="layer-style-dialog__label">{t('layerStyle.opacity')}</span>
                <input
                  type="range"
                  className="effect-slider"
                  min={0}
                  max={100}
                  value={Math.round(patternOpacity * 100)}
                  onChange={(e) => setPatternOpacity(Number(e.target.value) / 100)}
                />
                <span className="effect-slider-value">{Math.round(patternOpacity * 100)}%</span>
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
