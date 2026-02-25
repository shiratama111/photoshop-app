/**
 * @module GradientMaskDialog
 * Dialog for applying gradient fade masks to raster layers.
 *
 * Multiplies the alpha channel of the selected raster layer with a directional gradient.
 * Only works on raster layers (text layers disabled).
 *
 * @see Phase 1-4: Border & decoration effects
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { t } from '../../i18n';
import { generateGradientMask, findLayerById } from '@photoshop-app/core';
import type { MaskDirection } from '@photoshop-app/core';
import type { RasterLayer } from '@photoshop-app/types';

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 112;

const DIRECTIONS: { value: MaskDirection; labelKey: string }[] = [
  { value: 'top', labelKey: 'gradientMask.direction.top' },
  { value: 'bottom', labelKey: 'gradientMask.direction.bottom' },
  { value: 'left', labelKey: 'gradientMask.direction.left' },
  { value: 'right', labelKey: 'gradientMask.direction.right' },
  { value: 'radial', labelKey: 'gradientMask.direction.radial' },
];

export function GradientMaskDialog(): React.JSX.Element | null {
  const show = useAppStore((s) => s.showGradientMaskDialog);
  const closeDialog = useAppStore((s) => s.closeGradientMaskDialog);
  const applyGradientMask = useAppStore((s) => s.applyGradientMask);
  const doc = useAppStore((s) => s.document);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);

  const [direction, setDirection] = useState<MaskDirection>('bottom');
  const [fadeStart, setFadeStart] = useState(30);
  const [fadeEnd, setFadeEnd] = useState(100);
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Find the selected raster layer
  const selectedLayer = doc && selectedLayerId
    ? findLayerById(doc.rootGroup, selectedLayerId)
    : null;
  const isRaster = selectedLayer?.type === 'raster' && (selectedLayer as RasterLayer).imageData !== null;

  useEffect(() => {
    if (!show) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate a preview: a gray rectangle with the mask applied
    const previewData = new ImageData(PREVIEW_WIDTH, PREVIEW_HEIGHT);
    const d = previewData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 128;
      d[i + 1] = 128;
      d[i + 2] = 200;
      d[i + 3] = 255;
    }

    const masked = generateGradientMask(previewData, direction, fadeStart / 100, fadeEnd / 100);

    // Draw checkerboard then overlay
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
    ctx.putImageData(masked, 0, 0);
  }, [show, direction, fadeStart, fadeEnd]);

  useEffect(() => {
    if (show) {
      setDirection('bottom');
      setFadeStart(30);
      setFadeEnd(100);
    }
  }, [show]);

  const handleApply = useCallback(() => {
    if (!isRaster || !selectedLayerId) return;
    const raster = selectedLayer as RasterLayer;
    if (!raster.imageData) return;

    const masked = generateGradientMask(raster.imageData, direction, fadeStart / 100, fadeEnd / 100);
    applyGradientMask(selectedLayerId, masked);
    closeDialog();
  }, [isRaster, selectedLayerId, selectedLayer, direction, fadeStart, fadeEnd, applyGradientMask, closeDialog]);

  if (!show) return null;

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog gradient-mask-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 380 }}>
        <div className="dialog-header">{t('insert.gradientMaskTitle')}</div>
        <div className="dialog-body">
          {/* Target layer */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('gradientMask.target')}</span>
            <span style={{ opacity: isRaster ? 1 : 0.5 }}>
              {selectedLayer ? selectedLayer.name : t('gradientMask.noSelection')}
              {selectedLayer && !isRaster ? ` (${t('gradientMask.rasterOnly')})` : ''}
            </span>
          </div>

          {/* Direction */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('gradientMask.direction')}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir.value}
                  className={`dialog-btn ${direction === dir.value ? 'dialog-btn--primary' : ''}`}
                  onClick={() => setDirection(dir.value)}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                >
                  {t(dir.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Fade start */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('gradientMask.fadeStart')}</span>
            <input
              type="range"
              className="effect-slider"
              min={0}
              max={100}
              value={fadeStart}
              onChange={(e) => setFadeStart(Number(e.target.value))}
            />
            <span className="effect-slider-value">{fadeStart}%</span>
          </div>

          {/* Fade end */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('gradientMask.fadeEnd')}</span>
            <input
              type="range"
              className="effect-slider"
              min={0}
              max={100}
              value={fadeEnd}
              onChange={(e) => setFadeEnd(Number(e.target.value))}
            />
            <span className="effect-slider-value">{fadeEnd}%</span>
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
          <button className="dialog-btn dialog-btn--primary" onClick={handleApply} disabled={!isRaster}>
            {t('common.applyMask')}
          </button>
        </div>
      </div>
    </div>
  );
}
