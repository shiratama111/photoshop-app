import type { TextLayer } from '@photoshop-app/types';

export interface TextHitBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_TEXT_HIT_PADDING_PX = 8;
const MIN_TEXT_HIT_PADDING_DOC = 2;

function estimateCharacterWidth(ch: string, fontSize: number): number {
  if (ch === ' ' || ch === '\t') return fontSize * 0.35;
  if (ch.charCodeAt(0) <= 0x00ff) return fontSize * 0.56;
  return fontSize * 0.95;
}

function estimateHorizontalLineWidth(line: string, fontSize: number, letterSpacing: number): number {
  const chars = [...line];
  if (chars.length === 0) return fontSize * 0.75;
  let width = 0;
  for (const ch of chars) {
    width += estimateCharacterWidth(ch, fontSize);
  }
  width += Math.max(0, chars.length - 1) * letterSpacing;
  return width;
}

export function estimateTextContentSize(layer: TextLayer): { width: number; height: number } {
  const fontSize = Math.max(1, layer.fontSize);
  const lineHeightPx = Math.max(1, fontSize * Math.max(0.5, layer.lineHeight));
  const lines = layer.text.split('\n');
  const safeLines = lines.length > 0 ? lines : [''];

  if (layer.writingMode === 'vertical-rl') {
    const columns = Math.max(1, safeLines.length);
    const maxChars = Math.max(1, ...safeLines.map((line) => [...line].length));
    return {
      width: Math.max(fontSize, columns * lineHeightPx),
      height: Math.max(lineHeightPx, maxChars * lineHeightPx),
    };
  }

  const width = Math.max(
    fontSize * 0.75,
    ...safeLines.map((line) => estimateHorizontalLineWidth(line, fontSize, layer.letterSpacing)),
  );

  return {
    width,
    height: Math.max(lineHeightPx, safeLines.length * lineHeightPx),
  };
}

export function getTextLayerHitBounds(layer: TextLayer, zoom: number): TextHitBounds {
  const padding = Math.max(MIN_TEXT_HIT_PADDING_DOC, DEFAULT_TEXT_HIT_PADDING_PX / Math.max(0.1, zoom));

  let x = layer.position.x;
  const y = layer.position.y;
  let width = 0;
  let height = 0;

  if (layer.textBounds && layer.textBounds.width > 0 && layer.textBounds.height > 0) {
    width = layer.textBounds.width;
    height = layer.textBounds.height;
  } else {
    const estimated = estimateTextContentSize(layer);
    width = estimated.width;
    height = estimated.height;
    if (layer.writingMode !== 'vertical-rl') {
      if (layer.alignment === 'center') {
        x -= width / 2;
      } else if (layer.alignment === 'right') {
        x -= width;
      }
    }
  }

  return {
    x: x - padding,
    y: y - padding,
    width: Math.max(1, width + padding * 2),
    height: Math.max(1, height + padding * 2),
  };
}

export function isPointInBounds(
  point: { x: number; y: number },
  bounds: TextHitBounds,
): boolean {
  return (
    point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height
  );
}
