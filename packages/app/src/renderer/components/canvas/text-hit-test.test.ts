import { describe, it, expect } from 'vitest';
import type { TextLayer } from '@photoshop-app/types';
import {
  estimateTextContentSize,
  getTextLayerHitBounds,
  isPointInBounds,
} from './text-hit-test';

function makeTextLayer(overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    id: 'text-1',
    name: 'Text 1',
    type: 'text',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    position: { x: 100, y: 80 },
    locked: false,
    effects: [],
    parentId: null,
    text: 'Hello',
    fontFamily: 'Arial',
    fontSize: 20,
    color: { r: 0, g: 0, b: 0, a: 1 },
    bold: false,
    italic: false,
    alignment: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    textBounds: null,
    writingMode: 'horizontal-tb',
    underline: false,
    strikethrough: false,
    ...overrides,
  };
}

describe('text-hit-test', () => {
  it('estimates non-zero size for Japanese text', () => {
    const layer = makeTextLayer({ text: 'あいう', fontSize: 24 });
    const size = estimateTextContentSize(layer);
    expect(size.width).toBeGreaterThan(40);
    expect(size.height).toBeGreaterThan(20);
  });

  it('expands center-aligned hit area to the left when textBounds is missing', () => {
    const layer = makeTextLayer({ alignment: 'center', textBounds: null, text: 'Center Text' });
    const bounds = getTextLayerHitBounds(layer, 1);
    expect(bounds.x).toBeLessThan(layer.position.x);
    expect(isPointInBounds({ x: layer.position.x, y: layer.position.y }, bounds)).toBe(true);
  });

  it('uses textBounds and padding for near-click hit detection', () => {
    const layer = makeTextLayer({
      position: { x: 200, y: 120 },
      textBounds: { x: 200, y: 120, width: 80, height: 30 },
    });
    const bounds = getTextLayerHitBounds(layer, 1);

    // Slightly outside raw textBounds, but inside padded hit region.
    expect(isPointInBounds({ x: 195, y: 125 }, bounds)).toBe(true);
    expect(isPointInBounds({ x: 281, y: 151 }, bounds)).toBe(true);
  });

  it('keeps hit area at least minimally clickable when text is empty', () => {
    const layer = makeTextLayer({ text: '', textBounds: null });
    const bounds = getTextLayerHitBounds(layer, 1);
    expect(bounds.width).toBeGreaterThan(1);
    expect(bounds.height).toBeGreaterThan(1);
  });
});

