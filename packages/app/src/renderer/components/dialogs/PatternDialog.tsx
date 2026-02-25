/**
 * @module PatternDialog
 * Dialog for generating pattern overlays and concentration lines.
 *
 * Pattern types: dots, stripes, checker, diagonal-stripes, concentration-lines
 * (core patterns), plus procedural overlays: proc-dots, proc-stripes,
 * proc-checkerboard, proc-hatching (pattern-generator).
 *
 * Generates raster layers via generatePattern() / generateConcentrationLines()
 * for core patterns, and via pattern-generator functions for procedural overlays.
 *
 * @see Phase 1-3: Background & atmosphere tools
 * @see BG-001: Pattern overlay & background expansion
 * @see pattern-generator.ts for procedural pattern generation
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { t } from '../../i18n';
import { generatePattern, generateConcentrationLines } from '@photoshop-app/core';
import type { PatternType } from '@photoshop-app/core';
import {
  generateDotPattern,
  generateStripePattern,
  generateCheckerboardPattern,
  generateHatchPattern,
} from './pattern-generator';
import type { PatternColor } from './pattern-generator';

/** All available pattern modes including core and procedural types. */
type PatternMode =
  | PatternType
  | 'concentration-lines'
  | 'proc-dots'
  | 'proc-stripes'
  | 'proc-checkerboard'
  | 'proc-hatching';

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 112;

/**
 * Convert a hex color string (#RRGGBB) to an RGBA object.
 *
 * @param hex - Hex color string (e.g. "#FF0000")
 * @returns RGBA object with channels 0-255
 */
function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    a: 255,
  };
}

/**
 * Check if a pattern mode is a procedural pattern (from pattern-generator).
 *
 * @param mode - Pattern mode to check
 * @returns True if the mode is a procedural pattern type
 */
function isProceduralPattern(mode: PatternMode): mode is 'proc-dots' | 'proc-stripes' | 'proc-checkerboard' | 'proc-hatching' {
  return mode === 'proc-dots' || mode === 'proc-stripes' || mode === 'proc-checkerboard' || mode === 'proc-hatching';
}

/**
 * Generate procedural pattern ImageData based on current settings.
 *
 * @param mode - Procedural pattern mode
 * @param width - Output width in pixels
 * @param height - Output height in pixels
 * @param color - Primary color
 * @param color2 - Secondary color (for checkerboard)
 * @param opacity - Overall opacity (0-1)
 * @param spacing - Spacing between elements
 * @param size - Element size
 * @param angle - Angle in degrees
 * @param gap - Gap between elements (for stripes)
 * @returns Generated ImageData
 */
function generateProceduralImageData(
  mode: 'proc-dots' | 'proc-stripes' | 'proc-checkerboard' | 'proc-hatching',
  width: number,
  height: number,
  color: PatternColor,
  color2: PatternColor,
  opacity: number,
  spacing: number,
  size: number,
  angle: number,
  gap: number,
): ImageData {
  switch (mode) {
    case 'proc-dots':
      return generateDotPattern({
        width,
        height,
        dotSize: size,
        spacing,
        color,
        opacity,
      });
    case 'proc-stripes':
      return generateStripePattern({
        width,
        height,
        stripeWidth: size,
        gap,
        color,
        angle,
        opacity,
      });
    case 'proc-checkerboard':
      return generateCheckerboardPattern({
        width,
        height,
        cellSize: size,
        color1: color,
        color2,
        opacity,
      });
    case 'proc-hatching':
      return generateHatchPattern({
        width,
        height,
        lineWidth: size,
        spacing,
        angle,
        color,
        opacity,
      });
  }
}

/** PatternDialog component for generating pattern overlays. */
export function PatternDialog(): React.JSX.Element | null {
  const show = useAppStore((s) => s.showPatternDialog);
  const closeDialog = useAppStore((s) => s.closePatternDialog);
  const addProceduralLayer = useAppStore((s) => s.addProceduralLayer);
  const doc = useAppStore((s) => s.document);

  const [mode, setMode] = useState<PatternMode>('proc-dots');
  const [colorHex, setColorHex] = useState('#000000');
  const [color2Hex, setColor2Hex] = useState('#FFFFFF');
  const [opacity, setOpacity] = useState(0.8);
  const [spacing, setSpacing] = useState(20);
  const [size, setSize] = useState(4);
  const [angle, setAngle] = useState(45);
  const [gap, setGap] = useState(10);
  // Concentration lines specific
  const [lineCount, setLineCount] = useState(60);
  const [innerRadius, setInnerRadius] = useState(100);
  const [lineWidth, setLineWidth] = useState(3);

  const previewRef = useRef<HTMLCanvasElement>(null);

  const renderPreview = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Checkerboard background for transparency
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

    const color = hexToRgba(colorHex);
    let imageData: ImageData;

    if (isProceduralPattern(mode)) {
      const patColor2 = hexToRgba(color2Hex);
      imageData = generateProceduralImageData(
        mode,
        PREVIEW_WIDTH,
        PREVIEW_HEIGHT,
        color,
        patColor2,
        opacity,
        spacing,
        size,
        angle,
        gap,
      );
    } else if (mode === 'concentration-lines') {
      imageData = generateConcentrationLines(
        PREVIEW_WIDTH, PREVIEW_HEIGHT,
        PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2,
        lineCount, { ...color, a: Math.round(255 * opacity) },
        innerRadius * (PREVIEW_WIDTH / (doc?.canvas.size.width ?? 1280)),
        lineWidth,
      );
    } else {
      imageData = generatePattern(
        PREVIEW_WIDTH, PREVIEW_HEIGHT,
        mode, color, spacing, size, opacity,
      );
    }

    ctx.putImageData(imageData, 0, 0);
  }, [mode, colorHex, color2Hex, opacity, spacing, size, angle, gap, lineCount, innerRadius, lineWidth, doc]);

  useEffect(() => {
    if (!show) return;
    renderPreview();
  }, [show, renderPreview]);

  useEffect(() => {
    if (show) {
      setMode('proc-dots');
      setColorHex('#000000');
      setColor2Hex('#FFFFFF');
      setOpacity(0.8);
      setSpacing(20);
      setSize(4);
      setAngle(45);
      setGap(10);
      setLineCount(60);
      setInnerRadius(100);
      setLineWidth(3);
    }
  }, [show]);

  const handleAdd = useCallback(() => {
    if (!doc) return;
    const { width, height } = doc.canvas.size;
    const color = hexToRgba(colorHex);

    let imageData: ImageData;
    let name: string;

    if (isProceduralPattern(mode)) {
      const patColor2 = hexToRgba(color2Hex);
      imageData = generateProceduralImageData(
        mode,
        width,
        height,
        color,
        patColor2,
        opacity,
        spacing,
        size,
        angle,
        gap,
      );
      const nameMap: Record<typeof mode, string> = {
        'proc-dots': 'Dot Pattern',
        'proc-stripes': 'Stripe Pattern',
        'proc-checkerboard': 'Checkerboard',
        'proc-hatching': 'Hatch Pattern',
      };
      name = nameMap[mode];
    } else if (mode === 'concentration-lines') {
      imageData = generateConcentrationLines(
        width, height,
        width / 2, height / 2,
        lineCount, { ...color, a: Math.round(255 * opacity) },
        innerRadius, lineWidth,
      );
      name = t('pattern.concentrationLines');
    } else {
      imageData = generatePattern(width, height, mode, color, spacing, size, opacity);
      name = t(`pattern.${mode === 'diagonal-stripes' ? 'diagonalStripes' : mode}`);
    }

    addProceduralLayer(name, imageData);
    closeDialog();
  }, [doc, mode, colorHex, color2Hex, opacity, spacing, size, angle, gap, lineCount, innerRadius, lineWidth, addProceduralLayer, closeDialog]);

  if (!show) return null;

  const PATTERN_OPTIONS: { value: PatternMode; labelKey: string }[] = [
    { value: 'proc-dots', labelKey: 'pattern.procDots' },
    { value: 'proc-stripes', labelKey: 'pattern.procStripes' },
    { value: 'proc-checkerboard', labelKey: 'pattern.procCheckerboard' },
    { value: 'proc-hatching', labelKey: 'pattern.procHatching' },
    { value: 'dots', labelKey: 'pattern.dots' },
    { value: 'stripes', labelKey: 'pattern.stripes' },
    { value: 'checker', labelKey: 'pattern.checker' },
    { value: 'diagonal-stripes', labelKey: 'pattern.diagonalStripes' },
    { value: 'concentration-lines', labelKey: 'pattern.concentrationLines' },
  ];

  const showProceduralControls = isProceduralPattern(mode);
  const showCorePatternControls = !isProceduralPattern(mode) && mode !== 'concentration-lines';
  const showConcentrationControls = mode === 'concentration-lines';

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog pattern-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <div className="dialog-header">{t('insert.patternTitle')}</div>
        <div className="dialog-body">
          {/* Pattern type */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('pattern.type')}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as PatternMode)} style={{ flex: 1 }}>
              <optgroup label="Procedural Patterns">
                {PATTERN_OPTIONS.filter((o) => o.value.startsWith('proc-')).map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </optgroup>
              <optgroup label="Classic Patterns">
                {PATTERN_OPTIONS.filter((o) => !o.value.startsWith('proc-')).map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Color */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('layerStyle.color')}</span>
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              style={{ width: 32, height: 24 }}
            />
          </div>

          {/* Secondary color for checkerboard */}
          {mode === 'proc-checkerboard' && (
            <div className="layer-style-dialog__row">
              <span className="layer-style-dialog__label">{t('pattern.color2')}</span>
              <input
                type="color"
                value={color2Hex}
                onChange={(e) => setColor2Hex(e.target.value)}
                style={{ width: 32, height: 24 }}
              />
            </div>
          )}

          {/* Opacity */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('layerStyle.opacity')}</span>
            <input
              type="range"
              className="effect-slider"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            />
            <span className="effect-slider-value">{Math.round(opacity * 100)}%</span>
          </div>

          {/* Procedural pattern controls */}
          {showProceduralControls && (
            <>
              {/* Size */}
              <div className="layer-style-dialog__row">
                <span className="layer-style-dialog__label">{t('layerStyle.size')}</span>
                <input
                  type="range"
                  className="effect-slider"
                  min={1}
                  max={50}
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                />
                <span className="effect-slider-value">{size}px</span>
              </div>

              {/* Spacing (dots, hatching) */}
              {(mode === 'proc-dots' || mode === 'proc-hatching') && (
                <div className="layer-style-dialog__row">
                  <span className="layer-style-dialog__label">{t('pattern.spacing')}</span>
                  <input
                    type="range"
                    className="effect-slider"
                    min={2}
                    max={100}
                    value={spacing}
                    onChange={(e) => setSpacing(Number(e.target.value))}
                  />
                  <span className="effect-slider-value">{spacing}px</span>
                </div>
              )}

              {/* Gap (stripes) */}
              {mode === 'proc-stripes' && (
                <div className="layer-style-dialog__row">
                  <span className="layer-style-dialog__label">{t('pattern.gap')}</span>
                  <input
                    type="range"
                    className="effect-slider"
                    min={1}
                    max={100}
                    value={gap}
                    onChange={(e) => setGap(Number(e.target.value))}
                  />
                  <span className="effect-slider-value">{gap}px</span>
                </div>
              )}

              {/* Angle (stripes, hatching) */}
              {(mode === 'proc-stripes' || mode === 'proc-hatching') && (
                <div className="layer-style-dialog__row">
                  <span className="layer-style-dialog__label">{t('background.angle')}</span>
                  <input
                    type="range"
                    className="effect-slider"
                    min={0}
                    max={360}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                  />
                  <span className="effect-slider-value">{angle}°</span>
                </div>
              )}
            </>
          )}

          {/* Core pattern controls */}
          {showCorePatternControls && (
            <>
              <div className="layer-style-dialog__row">
                <span className="layer-style-dialog__label">{t('pattern.spacing')}</span>
                <input
                  type="range"
                  className="effect-slider"
                  min={2}
                  max={100}
                  value={spacing}
                  onChange={(e) => setSpacing(Number(e.target.value))}
                />
                <span className="effect-slider-value">{spacing}px</span>
              </div>
              <div className="layer-style-dialog__row">
                <span className="layer-style-dialog__label">{t('layerStyle.size')}</span>
                <input
                  type="range"
                  className="effect-slider"
                  min={1}
                  max={50}
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                />
                <span className="effect-slider-value">{size}px</span>
              </div>
            </>
          )}

          {/* Concentration lines controls */}
          {showConcentrationControls && (
            <>
              <div className="layer-style-dialog__row">
                <span className="layer-style-dialog__label">{t('pattern.lineCount')}</span>
                <input
                  type="range"
                  className="effect-slider"
                  min={10}
                  max={200}
                  value={lineCount}
                  onChange={(e) => setLineCount(Number(e.target.value))}
                />
                <span className="effect-slider-value">{lineCount}</span>
              </div>
              <div className="layer-style-dialog__row">
                <span className="layer-style-dialog__label">{t('pattern.innerRadius')}</span>
                <input
                  type="range"
                  className="effect-slider"
                  min={0}
                  max={500}
                  value={innerRadius}
                  onChange={(e) => setInnerRadius(Number(e.target.value))}
                />
                <span className="effect-slider-value">{innerRadius}px</span>
              </div>
              <div className="layer-style-dialog__row">
                <span className="layer-style-dialog__label">{t('pattern.lineWidth')}</span>
                <input
                  type="range"
                  className="effect-slider"
                  min={1}
                  max={20}
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                />
                <span className="effect-slider-value">{lineWidth}°</span>
              </div>
            </>
          )}

          {/* Preview */}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
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
