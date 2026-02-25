/**
 * @module BorderDialog
 * Dialog for generating rectangular border frame layers.
 *
 * Supports solid, double, and dashed styles with corner radius.
 * Generates a raster layer via generateBorderFrame().
 *
 * @see Phase 1-4: Border & decoration effects
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { t } from '../../i18n';
import { generateBorderFrame } from '@photoshop-app/core';
import type { BorderStyle } from '@photoshop-app/core';

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

export function BorderDialog(): React.JSX.Element | null {
  const show = useAppStore((s) => s.showBorderDialog);
  const closeDialog = useAppStore((s) => s.closeBorderDialog);
  const addProceduralLayer = useAppStore((s) => s.addProceduralLayer);
  const doc = useAppStore((s) => s.document);

  const [borderWidth, setBorderWidth] = useState(8);
  const [colorHex, setColorHex] = useState('#ffffff');
  const [cornerRadius, setCornerRadius] = useState(0);
  const [style, setStyle] = useState<BorderStyle>('solid');
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!show) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Checkerboard background
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
    // Scale border width for preview
    const scale = PREVIEW_WIDTH / (doc?.canvas.size.width ?? 1280);
    const previewBorderW = Math.max(1, Math.round(borderWidth * scale));
    const previewRadius = Math.round(cornerRadius * scale);

    const imageData = generateBorderFrame(
      PREVIEW_WIDTH, PREVIEW_HEIGHT,
      previewBorderW, color, previewRadius, style,
    );
    ctx.putImageData(imageData, 0, 0);
  }, [show, borderWidth, colorHex, cornerRadius, style, doc]);

  useEffect(() => {
    if (show) {
      setBorderWidth(8);
      setColorHex('#ffffff');
      setCornerRadius(0);
      setStyle('solid');
    }
  }, [show]);

  const handleAdd = useCallback(() => {
    if (!doc) return;
    const { width, height } = doc.canvas.size;
    const color = hexToRgba(colorHex);
    const imageData = generateBorderFrame(width, height, borderWidth, color, cornerRadius, style);
    addProceduralLayer(t('insert.border'), imageData);
    closeDialog();
  }, [doc, borderWidth, colorHex, cornerRadius, style, addProceduralLayer, closeDialog]);

  if (!show) return null;

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog border-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 380 }}>
        <div className="dialog-header">{t('insert.borderTitle')}</div>
        <div className="dialog-body">
          {/* Border width */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('border.width')}</span>
            <input
              type="range"
              className="effect-slider"
              min={1}
              max={50}
              value={borderWidth}
              onChange={(e) => setBorderWidth(Number(e.target.value))}
            />
            <span className="effect-slider-value">{borderWidth}px</span>
          </div>

          {/* Color */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('border.color')}</span>
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              style={{ width: 32, height: 24 }}
            />
          </div>

          {/* Corner radius */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('border.cornerRadius')}</span>
            <input
              type="range"
              className="effect-slider"
              min={0}
              max={50}
              value={cornerRadius}
              onChange={(e) => setCornerRadius(Number(e.target.value))}
            />
            <span className="effect-slider-value">{cornerRadius}px</span>
          </div>

          {/* Style */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('border.style')}</span>
            <select value={style} onChange={(e) => setStyle(e.target.value as BorderStyle)} style={{ flex: 1 }}>
              <option value="solid">{t('border.style.solid')}</option>
              <option value="double">{t('border.style.double')}</option>
              <option value="dashed">{t('border.style.dashed')}</option>
            </select>
          </div>

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
