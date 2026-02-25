/**
 * @module GradientMaskDialog
 * Dialog for applying gradient fade masks to raster layers.
 *
 * Supports linear (8 preset directions + custom angle) and radial gradient masks
 * with adjustable start/end positions and reversal. Uses the render package's
 * gradient-mask module for generation and application.
 *
 * Only works on raster layers (text layers disabled).
 *
 * @see GMASK-001 - Gradient mask ticket
 * @see @photoshop-app/render/gradient-mask - Mask generation/application
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { t } from '../../i18n';
import {
  generateGradientMask as generateMaskRender,
  applyGradientMask,
} from '@photoshop-app/render';
import type { GradientMaskConfig, GradientMaskType } from '@photoshop-app/render';
import { findLayerById } from '@photoshop-app/core';
import type { RasterLayer } from '@photoshop-app/types';

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 112;

/** Preset direction entry with angle and i18n label key. */
interface DirectionPreset {
  /** Display label i18n key. */
  labelKey: string;
  /** Angle in degrees (0=top-to-bottom). */
  angle: number;
}

/** 8 preset directions for linear gradient masks. */
const DIRECTION_PRESETS: DirectionPreset[] = [
  { labelKey: 'gradientMask.direction.top', angle: 180 },
  { labelKey: 'gradientMask.direction.bottom', angle: 0 },
  { labelKey: 'gradientMask.direction.left', angle: 270 },
  { labelKey: 'gradientMask.direction.right', angle: 90 },
  { labelKey: 'gradientMask.direction.topLeft', angle: 225 },
  { labelKey: 'gradientMask.direction.topRight', angle: 135 },
  { labelKey: 'gradientMask.direction.bottomLeft', angle: 315 },
  { labelKey: 'gradientMask.direction.bottomRight', angle: 45 },
];

export function GradientMaskDialog(): React.JSX.Element | null {
  const show = useAppStore((s) => s.showGradientMaskDialog);
  const closeDialog = useAppStore((s) => s.closeGradientMaskDialog);
  const applyGradientMaskAction = useAppStore((s) => s.applyGradientMask);
  const doc = useAppStore((s) => s.document);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);

  const [maskType, setMaskType] = useState<GradientMaskType>('linear');
  const [direction, setDirection] = useState(0);
  const [fadeStart, setFadeStart] = useState(30);
  const [fadeEnd, setFadeEnd] = useState(100);
  const [reversed, setReversed] = useState(false);
  const [useCustomAngle, setUseCustomAngle] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Find the selected raster layer
  const selectedLayer = doc && selectedLayerId
    ? findLayerById(doc.rootGroup, selectedLayerId)
    : null;
  const isRaster = selectedLayer?.type === 'raster' && (selectedLayer as RasterLayer).imageData !== null;

  // Build the config from current state
  const config: GradientMaskConfig = useMemo(() => ({
    type: maskType,
    direction,
    startPosition: fadeStart,
    endPosition: fadeEnd,
    reversed,
  }), [maskType, direction, fadeStart, fadeEnd, reversed]);

  // Real-time preview rendering
  useEffect(() => {
    if (!show) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate a preview: a colored rectangle with the mask applied
    const previewSource = new ImageData(PREVIEW_WIDTH, PREVIEW_HEIGHT);
    const d = previewSource.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 128;
      d[i + 1] = 128;
      d[i + 2] = 200;
      d[i + 3] = 255;
    }

    const mask = generateMaskRender(PREVIEW_WIDTH, PREVIEW_HEIGHT, config);
    const masked = applyGradientMask(previewSource, mask);

    // Draw checkerboard background then overlay the masked image
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
  }, [show, config]);

  // Reset state when dialog opens
  useEffect(() => {
    if (show) {
      setMaskType('linear');
      setDirection(0);
      setFadeStart(30);
      setFadeEnd(100);
      setReversed(false);
      setUseCustomAngle(false);
    }
  }, [show]);

  const handleApply = useCallback(() => {
    if (!isRaster || !selectedLayerId) return;
    const raster = selectedLayer as RasterLayer;
    if (!raster.imageData) return;

    const { width, height } = raster.imageData;
    const mask = generateMaskRender(width, height, config);
    const masked = applyGradientMask(raster.imageData, mask);
    applyGradientMaskAction(selectedLayerId, masked);
    closeDialog();
  }, [isRaster, selectedLayerId, selectedLayer, config, applyGradientMaskAction, closeDialog]);

  /** Handle direction preset button click. */
  const handlePresetClick = useCallback((angle: number) => {
    setDirection(angle);
    setUseCustomAngle(false);
  }, []);

  /** Handle custom angle input change. */
  const handleCustomAngleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDirection(value);
    setUseCustomAngle(true);
  }, []);

  if (!show) return null;

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog gradient-mask-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
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

          {/* Gradient type toggle (Linear / Radial) */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('gradientMask.type')}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={`dialog-btn ${maskType === 'linear' ? 'dialog-btn--primary' : ''}`}
                onClick={() => setMaskType('linear')}
                style={{ padding: '2px 12px', fontSize: 11 }}
              >
                {t('gradientMask.type.linear')}
              </button>
              <button
                className={`dialog-btn ${maskType === 'radial' ? 'dialog-btn--primary' : ''}`}
                onClick={() => setMaskType('radial')}
                style={{ padding: '2px 12px', fontSize: 11 }}
              >
                {t('gradientMask.type.radial')}
              </button>
            </div>
          </div>

          {/* Direction presets (only shown for linear) */}
          {maskType === 'linear' && (
            <div className="layer-style-dialog__row">
              <span className="layer-style-dialog__label">{t('gradientMask.direction')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 280 }}>
                {DIRECTION_PRESETS.map((preset) => (
                  <button
                    key={preset.angle}
                    className={`dialog-btn ${!useCustomAngle && direction === preset.angle ? 'dialog-btn--primary' : ''}`}
                    onClick={() => handlePresetClick(preset.angle)}
                    style={{ padding: '2px 8px', fontSize: 11 }}
                  >
                    {t(preset.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom angle input (only shown for linear) */}
          {maskType === 'linear' && (
            <div className="layer-style-dialog__row">
              <span className="layer-style-dialog__label">{t('gradientMask.customAngle')}</span>
              <input
                type="number"
                min={0}
                max={360}
                step={1}
                value={direction}
                onChange={handleCustomAngleChange}
                style={{ width: 60, fontSize: 12, padding: '2px 4px' }}
              />
              <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>deg</span>
            </div>
          )}

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

          {/* Reverse checkbox */}
          <div className="layer-style-dialog__row">
            <span className="layer-style-dialog__label">{t('gradientMask.reversed')}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={reversed}
                onChange={(e) => setReversed(e.target.checked)}
              />
            </label>
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
