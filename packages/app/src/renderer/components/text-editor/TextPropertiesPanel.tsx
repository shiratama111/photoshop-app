/**
 * @module components/text-editor/TextPropertiesPanel
 * Text property controls panel shown in sidebar when a TextLayer is selected.
 *
 * Controls: font family, font size, color, bold, italic, alignment,
 * line height, letter spacing.
 *
 * @see APP-005: Text editing UI
 */

import React, { useCallback } from 'react';
import type { TextLayer, Color, TextAlignment } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore } from '../../store';

/** Web-safe font options. */
const FONTS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Impact',
];

/** Convert 0-1 Color to hex string. */
function colorToHex(c: Color): string {
  const r = Math.round(c.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(c.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(c.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/** Convert hex string to 0-1 Color. */
function hexToColor(hex: string): Color {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b, a: 1 };
}

/** Inner panel component. */
function TextPropertiesPanelInner({ textLayer }: { textLayer: TextLayer }): React.JSX.Element {
  const setTextProperty = useAppStore((s) => s.setTextProperty);
  const id = textLayer.id;

  const onFontChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      setTextProperty(id, 'fontFamily', e.target.value);
    },
    [id, setTextProperty],
  );

  const onSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (v > 0) setTextProperty(id, 'fontSize', v);
    },
    [id, setTextProperty],
  );

  const onColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setTextProperty(id, 'color', hexToColor(e.target.value));
    },
    [id, setTextProperty],
  );

  const onBoldToggle = useCallback((): void => {
    setTextProperty(id, 'bold', !textLayer.bold);
  }, [id, textLayer.bold, setTextProperty]);

  const onItalicToggle = useCallback((): void => {
    setTextProperty(id, 'italic', !textLayer.italic);
  }, [id, textLayer.italic, setTextProperty]);

  const onAlignChange = useCallback(
    (align: TextAlignment): void => {
      setTextProperty(id, 'alignment', align);
    },
    [id, setTextProperty],
  );

  const onLineHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (v > 0) setTextProperty(id, 'lineHeight', v);
    },
    [id, setTextProperty],
  );

  const onLetterSpacingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setTextProperty(id, 'letterSpacing', Number(e.target.value));
    },
    [id, setTextProperty],
  );

  return (
    <div className="text-properties">
      <div className="sidebar-header">Text</div>

      <div className="text-property-row">
        <span className="text-property-label">Font</span>
        <select
          className="text-property-select"
          value={textLayer.fontFamily}
          onChange={onFontChange}
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <div className="text-property-row">
        <span className="text-property-label">Size</span>
        <input
          className="text-property-input"
          type="number"
          min="1"
          max="999"
          value={textLayer.fontSize}
          onChange={onSizeChange}
        />
        <span className="text-property-unit">px</span>
      </div>

      <div className="text-property-row">
        <span className="text-property-label">Color</span>
        <input
          type="color"
          value={colorToHex(textLayer.color)}
          onChange={onColorChange}
        />
      </div>

      <div className="text-property-row">
        <span className="text-property-label">Style</span>
        <button
          className={`text-property-btn ${textLayer.bold ? 'text-property-btn--active' : ''}`}
          onClick={onBoldToggle}
          title="Bold"
        >
          B
        </button>
        <button
          className={`text-property-btn ${textLayer.italic ? 'text-property-btn--active' : ''}`}
          onClick={onItalicToggle}
          title="Italic"
        >
          <em>I</em>
        </button>
      </div>

      <div className="text-property-row">
        <span className="text-property-label">Align</span>
        <button
          className={`text-property-btn ${textLayer.alignment === 'left' ? 'text-property-btn--active' : ''}`}
          onClick={(): void => onAlignChange('left')}
          title="Align left"
        >
          &lt;
        </button>
        <button
          className={`text-property-btn ${textLayer.alignment === 'center' ? 'text-property-btn--active' : ''}`}
          onClick={(): void => onAlignChange('center')}
          title="Align center"
        >
          =
        </button>
        <button
          className={`text-property-btn ${textLayer.alignment === 'right' ? 'text-property-btn--active' : ''}`}
          onClick={(): void => onAlignChange('right')}
          title="Align right"
        >
          &gt;
        </button>
      </div>

      <div className="text-property-row">
        <span className="text-property-label">Height</span>
        <input
          className="text-property-input"
          type="number"
          min="0.1"
          max="10"
          step="0.1"
          value={textLayer.lineHeight}
          onChange={onLineHeightChange}
        />
      </div>

      <div className="text-property-row">
        <span className="text-property-label">Spacing</span>
        <input
          className="text-property-input"
          type="number"
          min="-20"
          max="100"
          step="0.5"
          value={textLayer.letterSpacing}
          onChange={onLetterSpacingChange}
        />
        <span className="text-property-unit">px</span>
      </div>
    </div>
  );
}

/** Text properties panel — renders only when selected layer is a TextLayer. */
export function TextPropertiesPanel(): React.JSX.Element | null {
  const document = useAppStore((s) => s.document);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);
  const revision = useAppStore((s) => s.revision);

  void revision;

  if (!document || !selectedLayerId) return null;

  const layer = findLayerById(document.rootGroup, selectedLayerId);
  if (!layer || layer.type !== 'text') return null;

  return <TextPropertiesPanelInner textLayer={layer} />;
}
