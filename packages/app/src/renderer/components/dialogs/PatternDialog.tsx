/**
 * @module PatternDialog
 * Dialog for generating pattern overlays and concentration lines.
 *
 * Pattern types: dots, stripes, checker, diagonal-stripes, concentration-lines.
 * Generates raster layers via generatePattern() / generateConcentrationLines().
 *
 * @see Phase 1-3: Background & atmosphere tools
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { t } from '../../i18n';
import { generatePattern, generateConcentrationLines } from '@photoshop-app/core';
import type { PatternType } from '@photoshop-app/core';

type PatternMode = PatternType | 'concentration-lines';

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 112;

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    a: 255,
  };
}

export function PatternDialog(): React.JSX.Element | null {
  const show = useAppStore((s) => s.showPatternDialog);
  const closeDialog = useAppStore((s) => s.closePatternDialog);
  const addProceduralLayer = useAppStore((s) => s.addProceduralLayer);
  const doc = useAppStore((s) => s.document);

  const [mode, setMode] = useState<PatternMode>('dots');
  const [colorHex, setColorHex] = useState('#000000');
  const [opacity, setOpacity] = useState(0.8);
  const [spacing, setSpacing] = useState(20);
  const [size, setSize] = useState(4);
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

    if (mode === 'concentration-lines') {
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
  }, [mode, colorHex, opacity, spacing, size, lineCount, innerRadius, lineWidth, doc]);

  useEffect(() => {
    if (!show) return;
    renderPreview();
  }, [show, renderPreview]);

  useEffect(() => {
    if (show) {
      setMode('dots');
      setColorHex('#000000');
      setOpacity(0.8);
      setSpacing(20);
      setSize(4);
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

    if (mode === 'concentration-lines') {
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
  }, [doc, mode, colorHex, opacity, spacing, size, lineCount, innerRadius, lineWidth, addProceduralLayer, closeDialog]);

  if (!show) return null;

  const PATTERN_OPTIONS: { value: PatternMode; labelKey: string }[] = [
    { value: 'dots', labelKey: 'pattern.dots' },
    { value: 'stripes', labelKey: 'pattern.stripes' },
    { value: 'checker', labelKey: 'pattern.checker' },
    { value: 'diagonal-stripes', labelKey: 'pattern.diagonalStripes' },
    { value: 'concentration-lines', labelKey: 'pattern.concentrationLines' },
  ];

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog pattern-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
        <div className="dialog-header">{t('insert.patternTitle')}</div>
        <div className="dialog-body">
          {/* Pattern type */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('pattern.type')}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as PatternMode)} style={{ flex: 1 }}>
              {PATTERN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
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

          {mode !== 'concentration-lines' ? (
            <>
              {/* Spacing */}
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
            </>
          ) : (
            <>
              {/* Line count */}
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

              {/* Inner radius */}
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

              {/* Line width */}
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
