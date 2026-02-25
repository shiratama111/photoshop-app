/**
 * @module components/panels/ColorPalette
 * Preset color tile grid with foreground/background color swap.
 *
 * Layout:
 * [FG][BG]  [Swap][Reset]
 * 10x4 color grid (40 preset colors)
 *
 * @see APP-016: Brush variants, color picker, color palette
 */

import React from 'react';
import { useAppStore } from '../../store';
import { t } from '../../i18n';
import { rgbToHex } from './color-utils';

/** 40 preset colors: Row 1 = pure, Row 2 = light, Row 3 = dark, Row 4 = greys. */
const PRESET_COLORS: Array<{ r: number; g: number; b: number }> = [
  // Row 1 — pure/saturated
  { r: 255, g: 0, b: 0 },
  { r: 255, g: 127, b: 0 },
  { r: 255, g: 255, b: 0 },
  { r: 127, g: 255, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 255, b: 127 },
  { r: 0, g: 255, b: 255 },
  { r: 0, g: 127, b: 255 },
  { r: 0, g: 0, b: 255 },
  { r: 127, g: 0, b: 255 },
  // Row 2 — light/pastel
  { r: 255, g: 128, b: 128 },
  { r: 255, g: 191, b: 128 },
  { r: 255, g: 255, b: 128 },
  { r: 191, g: 255, b: 128 },
  { r: 128, g: 255, b: 128 },
  { r: 128, g: 255, b: 191 },
  { r: 128, g: 255, b: 255 },
  { r: 128, g: 191, b: 255 },
  { r: 128, g: 128, b: 255 },
  { r: 191, g: 128, b: 255 },
  // Row 3 — dark
  { r: 128, g: 0, b: 0 },
  { r: 128, g: 64, b: 0 },
  { r: 128, g: 128, b: 0 },
  { r: 64, g: 128, b: 0 },
  { r: 0, g: 128, b: 0 },
  { r: 0, g: 128, b: 64 },
  { r: 0, g: 128, b: 128 },
  { r: 0, g: 64, b: 128 },
  { r: 0, g: 0, b: 128 },
  { r: 64, g: 0, b: 128 },
  // Row 4 — greyscale
  { r: 0, g: 0, b: 0 },
  { r: 28, g: 28, b: 28 },
  { r: 57, g: 57, b: 57 },
  { r: 85, g: 85, b: 85 },
  { r: 113, g: 113, b: 113 },
  { r: 142, g: 142, b: 142 },
  { r: 170, g: 170, b: 170 },
  { r: 198, g: 198, b: 198 },
  { r: 227, g: 227, b: 227 },
  { r: 255, g: 255, b: 255 },
];

export function ColorPalette(): React.JSX.Element {
  const brushColor = useAppStore((s) => s.brushColor);
  const backgroundColor = useAppStore((s) => s.backgroundColor);
  const setBrushColor = useAppStore((s) => s.setBrushColor);
  const swapColors = useAppStore((s) => s.swapColors);
  const resetColors = useAppStore((s) => s.resetColors);

  const fgHex = rgbToHex(brushColor.r, brushColor.g, brushColor.b);
  const bgHex = rgbToHex(backgroundColor.r, backgroundColor.g, backgroundColor.b);

  return (
    <div className="color-palette">
      {/* FG/BG preview + Swap/Reset */}
      <div className="color-palette__header">
        <div className="color-palette__fg-bg">
          <div
            className="color-palette__swatch color-palette__swatch--fg"
            style={{ background: fgHex }}
            title={t('colorPalette.foreground')}
          />
          <div
            className="color-palette__swatch color-palette__swatch--bg"
            style={{ background: bgHex }}
            title={t('colorPalette.background')}
          />
        </div>
        <button
          className="color-palette__btn"
          onClick={swapColors}
          title={t('colorPalette.swap')}
        >
          &#x21C4;
        </button>
        <button
          className="color-palette__btn"
          onClick={resetColors}
          title={t('colorPalette.reset')}
        >
          &#x25A3;
        </button>
      </div>

      {/* Color grid */}
      <div className="color-palette__grid">
        {PRESET_COLORS.map((c, i) => (
          <button
            key={i}
            className="color-palette__tile"
            style={{ background: rgbToHex(c.r, c.g, c.b) }}
            title={rgbToHex(c.r, c.g, c.b)}
            onClick={(): void => setBrushColor({ r: c.r, g: c.g, b: c.b, a: brushColor.a })}
          />
        ))}
      </div>
    </div>
  );
}
