/**
 * @module components/panels/ColorPicker
 * HSV color picker with SV-square, Hue bar, Alpha bar, and Hex/RGB inputs.
 *
 * @see APP-016: Brush variants, color picker, color palette
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { rgbToHsv, hsvToRgb, rgbToHex, hexToRgb } from './color-utils';

interface ColorPickerProps {
  color: { r: number; g: number; b: number; a: number };
  onChange: (color: { r: number; g: number; b: number; a: number }) => void;
  previousColor?: { r: number; g: number; b: number; a: number };
}

const SV_SIZE = 200;
const BAR_HEIGHT = 16;

/** Draw the SV (saturation-value) square for a given hue. */
function drawSvSquare(ctx: CanvasRenderingContext2D, hue: number): void {
  const w = SV_SIZE;
  const h = SV_SIZE;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  for (let y = 0; y < h; y++) {
    const v = 1 - y / (h - 1);
    for (let x = 0; x < w; x++) {
      const s = x / (w - 1);
      const { r, g, b } = hsvToRgb(hue, s, v);
      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Draw the horizontal hue bar (rainbow gradient). */
function drawHueBar(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;
  for (let x = 0; x < width; x++) {
    const hue = (x / (width - 1)) * 360;
    const { r, g, b } = hsvToRgb(hue, 1, 1);
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Draw the horizontal alpha bar with checkerboard + color gradient. */
function drawAlphaBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): void {
  // Draw checkerboard
  const checkSize = 4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isLight = (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0;
      ctx.fillStyle = isLight ? '#ffffff' : '#cccccc';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Overlay the color gradient from transparent to opaque
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},1)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

export function ColorPicker({ color, onChange, previousColor }: ColorPickerProps): React.JSX.Element {
  const hsv = rgbToHsv(color.r, color.g, color.b);
  const [hue, setHue] = useState(hsv.h);
  const [sat, setSat] = useState(hsv.s);
  const [val, setVal] = useState(hsv.v);
  const [alpha, setAlpha] = useState(color.a);
  const [hexInput, setHexInput] = useState(rgbToHex(color.r, color.g, color.b));

  const svCanvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);
  const alphaCanvasRef = useRef<HTMLCanvasElement>(null);
  const draggingSv = useRef(false);
  const draggingHue = useRef(false);
  const draggingAlpha = useRef(false);

  // Sync from external color changes
  useEffect(() => {
    const newHsv = rgbToHsv(color.r, color.g, color.b);
    // Only update hue if the color actually changed (avoid jumping hue on grey colors)
    if (Math.abs(newHsv.s) > 0.01 || Math.abs(newHsv.v) > 0.01) {
      setHue(newHsv.h);
    }
    setSat(newHsv.s);
    setVal(newHsv.v);
    setAlpha(color.a);
    setHexInput(rgbToHex(color.r, color.g, color.b));
  }, [color.r, color.g, color.b, color.a]);

  // Draw SV square when hue changes
  useEffect(() => {
    const ctx = svCanvasRef.current?.getContext('2d');
    if (ctx) drawSvSquare(ctx, hue);
  }, [hue]);

  // Draw hue bar once
  useEffect(() => {
    const ctx = hueCanvasRef.current?.getContext('2d');
    if (ctx) drawHueBar(ctx, SV_SIZE, BAR_HEIGHT);
  }, []);

  // Draw alpha bar when color changes
  useEffect(() => {
    const ctx = alphaCanvasRef.current?.getContext('2d');
    if (ctx) {
      const rgb = hsvToRgb(hue, sat, val);
      drawAlphaBar(ctx, SV_SIZE, BAR_HEIGHT, rgb.r, rgb.g, rgb.b);
    }
  }, [hue, sat, val]);

  const emitColor = useCallback(
    (h: number, s: number, v: number, a: number): void => {
      const { r, g, b } = hsvToRgb(h, s, v);
      setHexInput(rgbToHex(r, g, b));
      onChange({ r, g, b, a });
    },
    [onChange],
  );

  // SV square interaction
  const handleSvPointer = useCallback(
    (e: React.MouseEvent | MouseEvent): void => {
      const canvas = svCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(SV_SIZE - 1, e.clientX - rect.left));
      const y = Math.max(0, Math.min(SV_SIZE - 1, e.clientY - rect.top));
      const s = x / (SV_SIZE - 1);
      const v = 1 - y / (SV_SIZE - 1);
      setSat(s);
      setVal(v);
      emitColor(hue, s, v, alpha);
    },
    [hue, alpha, emitColor],
  );

  // Hue bar interaction
  const handleHuePointer = useCallback(
    (e: React.MouseEvent | MouseEvent): void => {
      const canvas = hueCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(SV_SIZE - 1, e.clientX - rect.left));
      const h = (x / (SV_SIZE - 1)) * 360;
      setHue(h);
      emitColor(h, sat, val, alpha);
    },
    [sat, val, alpha, emitColor],
  );

  // Alpha bar interaction
  const handleAlphaPointer = useCallback(
    (e: React.MouseEvent | MouseEvent): void => {
      const canvas = alphaCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(SV_SIZE - 1, e.clientX - rect.left));
      const a = x / (SV_SIZE - 1);
      setAlpha(a);
      emitColor(hue, sat, val, a);
    },
    [hue, sat, val, emitColor],
  );

  // Global mouse handlers for dragging
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (draggingSv.current) handleSvPointer(e);
      if (draggingHue.current) handleHuePointer(e);
      if (draggingAlpha.current) handleAlphaPointer(e);
    };
    const onUp = (): void => {
      draggingSv.current = false;
      draggingHue.current = false;
      draggingAlpha.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [handleSvPointer, handleHuePointer, handleAlphaPointer]);

  // Hex input handler
  const handleHexCommit = useCallback((): void => {
    const parsed = hexToRgb(hexInput);
    if (!parsed) return;
    const newHsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
    setHue(newHsv.h);
    setSat(newHsv.s);
    setVal(newHsv.v);
    onChange({ r: parsed.r, g: parsed.g, b: parsed.b, a: alpha });
  }, [hexInput, alpha, onChange]);

  // RGB input handler
  const handleRgbChange = useCallback(
    (channel: 'r' | 'g' | 'b', value: number): void => {
      const clamped = Math.max(0, Math.min(255, Math.round(value)));
      const rgb = hsvToRgb(hue, sat, val);
      const newRgb = { ...rgb, [channel]: clamped };
      const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
      setHue(newHsv.h);
      setSat(newHsv.s);
      setVal(newHsv.v);
      setHexInput(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
      onChange({ r: newRgb.r, g: newRgb.g, b: newRgb.b, a: alpha });
    },
    [hue, sat, val, alpha, onChange],
  );

  const currentRgb = hsvToRgb(hue, sat, val);
  const currentHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);
  const crosshairX = sat * (SV_SIZE - 1);
  const crosshairY = (1 - val) * (SV_SIZE - 1);
  const hueIndicatorX = (hue / 360) * (SV_SIZE - 1);
  const alphaIndicatorX = alpha * (SV_SIZE - 1);

  return (
    <div className="color-picker">
      {/* SV Square */}
      <div className="color-picker__sv-container">
        <canvas
          ref={svCanvasRef}
          width={SV_SIZE}
          height={SV_SIZE}
          className="color-picker__sv-canvas"
          onMouseDown={(e): void => {
            draggingSv.current = true;
            handleSvPointer(e);
          }}
        />
        <div
          className="color-picker__sv-crosshair"
          style={{ left: `${crosshairX}px`, top: `${crosshairY}px` }}
        />
      </div>

      {/* Hue Bar */}
      <div className="color-picker__bar-container">
        <canvas
          ref={hueCanvasRef}
          width={SV_SIZE}
          height={BAR_HEIGHT}
          className="color-picker__bar-canvas"
          onMouseDown={(e): void => {
            draggingHue.current = true;
            handleHuePointer(e);
          }}
        />
        <div
          className="color-picker__bar-indicator"
          style={{ left: `${hueIndicatorX}px` }}
        />
      </div>

      {/* Alpha Bar */}
      <div className="color-picker__bar-container">
        <canvas
          ref={alphaCanvasRef}
          width={SV_SIZE}
          height={BAR_HEIGHT}
          className="color-picker__bar-canvas"
          onMouseDown={(e): void => {
            draggingAlpha.current = true;
            handleAlphaPointer(e);
          }}
        />
        <div
          className="color-picker__bar-indicator"
          style={{ left: `${alphaIndicatorX}px` }}
        />
      </div>

      {/* Color preview + Hex/RGB inputs */}
      <div className="color-picker__info">
        <div className="color-picker__swatches">
          <div
            className="color-picker__swatch color-picker__swatch--current"
            style={{ background: currentHex }}
            title="Current"
          />
          {previousColor && (
            <div
              className="color-picker__swatch color-picker__swatch--previous"
              style={{ background: rgbToHex(previousColor.r, previousColor.g, previousColor.b) }}
              title="Previous"
              onClick={(): void => onChange(previousColor)}
            />
          )}
        </div>
        <div className="color-picker__inputs">
          <div className="color-picker__input-row">
            <label className="color-picker__label">Hex</label>
            <input
              className="color-picker__text-input color-picker__hex-input"
              value={hexInput}
              onChange={(e): void => setHexInput(e.target.value)}
              onBlur={handleHexCommit}
              onKeyDown={(e): void => { if (e.key === 'Enter') handleHexCommit(); }}
            />
          </div>
          <div className="color-picker__input-row">
            <label className="color-picker__label">R</label>
            <input
              className="color-picker__text-input color-picker__num-input"
              type="number"
              min="0"
              max="255"
              value={currentRgb.r}
              onChange={(e): void => handleRgbChange('r', Number(e.target.value))}
            />
            <label className="color-picker__label">G</label>
            <input
              className="color-picker__text-input color-picker__num-input"
              type="number"
              min="0"
              max="255"
              value={currentRgb.g}
              onChange={(e): void => handleRgbChange('g', Number(e.target.value))}
            />
            <label className="color-picker__label">B</label>
            <input
              className="color-picker__text-input color-picker__num-input"
              type="number"
              min="0"
              max="255"
              value={currentRgb.b}
              onChange={(e): void => handleRgbChange('b', Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
