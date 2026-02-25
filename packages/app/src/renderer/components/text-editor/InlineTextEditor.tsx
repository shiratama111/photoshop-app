/**
 * @module components/text-editor/InlineTextEditor
 * Custom overlay for inline text editing that avoids native textarea UI.
 *
 * Uses a contentEditable div positioned over the canvas at the text layer's
 * screen coordinates. Text is handled as plain text to avoid HTML injection
 * and to keep caret behavior stable while typing.
 *
 * @see PS-TEXT-005: Custom text editing overlay
 * @see APP-005: Text editing UI
 * @see APP-011: Text box resize with textBounds commit on blur
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { TextLayer } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore, getViewport } from '../../store';

/** Convert Color (r/g/b 0-255, a 0-1) to CSS rgba string. */
function colorToCss(c: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a})`;
}

/**
 * Build a contrasting text-shadow so typed text is always legible,
 * regardless of the underlying canvas / pasteboard colour.
 */
function contrastShadow(c: { r: number; g: number; b: number }): string {
  // Perceived luminance (ITU-R BT.709)
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const shadow = lum > 128 ? '0 0 4px rgba(0,0,0,0.8)' : '0 0 4px rgba(255,255,255,0.8)';
  return shadow;
}

/**
 * Extract plain text from a contentEditable element.
 * Handles browser-inserted line breaks and trims the trailing editor newline.
 */
function extractText(el: HTMLElement): string {
  return (el.innerText ?? '').replace(/\n$/, '');
}

/** Put the text caret at the end of a contentEditable element. */
function placeCaretAtEnd(el: HTMLElement): void {
  const range = globalThis.document.createRange();
  const selection = globalThis.document.getSelection();
  if (!selection) return;
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Insert plain text at current selection inside a contentEditable element. */
function insertPlainTextAtSelection(el: HTMLElement, text: string): void {
  const selection = globalThis.document.getSelection();
  if (!selection || selection.rangeCount === 0) {
    el.textContent = `${el.textContent ?? ''}${text}`;
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const textNode = globalThis.document.createTextNode(text);
  range.insertNode(textNode);

  const len = textNode.textContent?.length ?? 0;
  range.setStart(textNode, len);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** InlineTextEditor - fixed-position contentEditable overlay for editing text layers. */
export function InlineTextEditor(): React.JSX.Element | null {
  const editingTextLayerId = useAppStore((s) => s.editingTextLayerId);
  const document = useAppStore((s) => s.document);
  const zoom = useAppStore((s) => s.zoom);
  const setTextProperty = useAppStore((s) => s.setTextProperty);
  const stopEditingText = useAppStore((s) => s.stopEditingText);
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);

  useEffect(() => {
    if (!editingTextLayerId) return;
    const el = editorRef.current;
    if (!el) return;

    const currentDoc = useAppStore.getState().document;
    if (!currentDoc) return;

    const layer = findLayerById(currentDoc.rootGroup, editingTextLayerId);
    if (!layer || layer.type !== 'text') return;

    el.textContent = layer.text;
    el.focus();
    placeCaretAtEnd(el);
  }, [editingTextLayerId]);

  const handleCompositionStart = useCallback((): void => {
    isComposing.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLDivElement>): void => {
      isComposing.current = false;
      if (editingTextLayerId) {
        setTextProperty(editingTextLayerId, 'text', extractText(e.currentTarget));
      }
    },
    [editingTextLayerId, setTextProperty],
  );

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>): void => {
      if (isComposing.current) return;
      if (editingTextLayerId) {
        setTextProperty(editingTextLayerId, 'text', extractText(e.currentTarget));
      }
    },
    [editingTextLayerId, setTextProperty],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>): void => {
      e.preventDefault();
      const plainText = e.clipboardData.getData('text/plain').replace(/\r\n/g, '\n');
      insertPlainTextAtSelection(e.currentTarget, plainText);

      if (!isComposing.current && editingTextLayerId) {
        setTextProperty(editingTextLayerId, 'text', extractText(e.currentTarget));
      }
    },
    [editingTextLayerId, setTextProperty],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      // Allow all keys during IME composition
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        stopEditingText(editingTextLayerId ?? undefined);
      }
      // Stop propagation for Space so global pan shortcut does not intercept it.
      if (e.key === ' ') {
        e.stopPropagation();
      }
    },
    [editingTextLayerId, stopEditingText],
  );

  const handleBlur = useCallback((): void => {
    // Commit the resized dimensions as textBounds before stopping edit
    if (editingTextLayerId && editorRef.current) {
      const el = editorRef.current;
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
    stopEditingText(editingTextLayerId);
  }, [editingTextLayerId, setTextProperty, stopEditingText]);

  if (!editingTextLayerId || !document) return null;

  const layer = findLayerById(document.rootGroup, editingTextLayerId);
  if (!layer || layer.type !== 'text') return null;

  const textLayer = layer as TextLayer;
  const writingMode = textLayer.writingMode ?? 'horizontal-tb';
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
    <div
      ref={editorRef}
      className="inline-text-editor"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
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
        writingMode,
        textShadow: contrastShadow(textLayer.color),
        ...sizeStyle,
      }}
    />
  );
}
