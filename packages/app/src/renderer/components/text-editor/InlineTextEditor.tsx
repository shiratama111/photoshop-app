/**
 * @module components/text-editor/InlineTextEditor
 * Canvas overlay textarea for inline text editing.
 *
 * Positioned over the canvas at the text layer's screen coordinates.
 * Matches the layer's font styling for WYSIWYG preview.
 * Supports resize via CSS `resize: both`; on blur the new dimensions
 * are committed to the layer's `textBounds` property (APP-011).
 *
 * @see APP-005: Text editing UI
 * @see APP-011: Text box resize with textBounds commit on blur
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { TextLayer } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore, getViewport } from '../../store';

/** Convert 0-1 Color to CSS rgba string. */
function colorToCss(c: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

/** InlineTextEditor — fixed-position textarea for editing text layers. */
export function InlineTextEditor(): React.JSX.Element | null {
  const editingTextLayerId = useAppStore((s) => s.editingTextLayerId);
  const document = useAppStore((s) => s.document);
  const zoom = useAppStore((s) => s.zoom);
  const setTextProperty = useAppStore((s) => s.setTextProperty);
  const stopEditingText = useAppStore((s) => s.stopEditingText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [editingTextLayerId]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      if (editingTextLayerId) {
        setTextProperty(editingTextLayerId, 'text', e.target.value);
      }
    },
    [editingTextLayerId, setTextProperty],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        stopEditingText();
      }
    },
    [stopEditingText],
  );

  const handleBlur = useCallback((): void => {
    // Commit the resized dimensions as textBounds before stopping edit
    if (editingTextLayerId && textareaRef.current) {
      const el = textareaRef.current;
      const vp = getViewport();
      const docWidth = el.offsetWidth / vp.zoom;
      const docHeight = el.offsetHeight / vp.zoom;

      const state = useAppStore.getState();
      const doc = state.document;
      if (doc) {
        const layer = findLayerById(doc.rootGroup, editingTextLayerId);
        if (layer && layer.type === 'text') {
          const tl = layer as TextLayer;
          setTextProperty(editingTextLayerId, 'textBounds', {
            x: tl.position.x,
            y: tl.position.y,
            width: docWidth,
            height: docHeight,
          });
        }
      }
    }
    stopEditingText();
  }, [editingTextLayerId, setTextProperty, stopEditingText]);

  if (!editingTextLayerId || !document) return null;

  const layer = findLayerById(document.rootGroup, editingTextLayerId);
  if (!layer || layer.type !== 'text') return null;

  const textLayer = layer as TextLayer;
  const vp = getViewport();
  const screenPos = vp.documentToScreen({
    x: textLayer.position.x,
    y: textLayer.position.y,
  });

  // Account for the canvas-area element offset
  const canvasArea = globalThis.document.querySelector('.canvas-area');
  const canvasRect = canvasArea?.getBoundingClientRect() ?? { left: 0, top: 0 };

  const left = canvasRect.left + screenPos.x;
  const top = canvasRect.top + screenPos.y;
  const fontSize = textLayer.fontSize * zoom;

  // If textBounds exists, set initial size in screen coordinates
  const sizeStyle: React.CSSProperties = {};
  if (textLayer.textBounds) {
    sizeStyle.width = `${textLayer.textBounds.width * zoom}px`;
    sizeStyle.height = `${textLayer.textBounds.height * zoom}px`;
  }

  return (
    <textarea
      ref={textareaRef}
      className="inline-text-editor"
      value={textLayer.text}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        fontFamily: textLayer.fontFamily,
        fontSize: `${fontSize}px`,
        color: colorToCss(textLayer.color),
        fontWeight: textLayer.bold ? 'bold' : 'normal',
        fontStyle: textLayer.italic ? 'italic' : 'normal',
        textAlign: textLayer.alignment,
        lineHeight: textLayer.lineHeight,
        letterSpacing: `${textLayer.letterSpacing * zoom}px`,
        ...sizeStyle,
      }}
    />
  );
}
