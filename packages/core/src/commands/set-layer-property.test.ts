import { describe, it, expect } from 'vitest';
import { SetLayerPropertyCommand } from './set-layer-property';
import type { RasterLayer, TextLayer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';

function createRasterLayer(): RasterLayer {
  return {
    id: 'l1',
    name: 'Layer 1',
    type: 'raster',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    imageData: null,
    bounds: { x: 0, y: 0, width: 100, height: 100 },
  };
}

function createTextLayer(): TextLayer {
  return {
    id: 't1',
    name: 'Title',
    type: 'text',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    text: 'Hello',
    fontFamily: 'Arial',
    fontSize: 16,
    color: { r: 0, g: 0, b: 0, a: 1 },
    alignment: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    textBounds: null,
    writingMode: 'horizontal-tb',
  };
}

describe('SetLayerPropertyCommand', () => {
  it('sets opacity', () => {
    const layer = createRasterLayer();
    const cmd = new SetLayerPropertyCommand(layer, 'opacity', 0.5);

    cmd.execute();
    expect(layer.opacity).toBe(0.5);
  });

  it('undo restores original value', () => {
    const layer = createRasterLayer();
    const cmd = new SetLayerPropertyCommand(layer, 'opacity', 0.5);

    cmd.execute();
    cmd.undo();
    expect(layer.opacity).toBe(1);
  });

  it('sets visibility', () => {
    const layer = createRasterLayer();
    const cmd = new SetLayerPropertyCommand(layer, 'visible', false);

    cmd.execute();
    expect(layer.visible).toBe(false);
    cmd.undo();
    expect(layer.visible).toBe(true);
  });

  it('sets blend mode', () => {
    const layer = createRasterLayer();
    const cmd = new SetLayerPropertyCommand(layer, 'blendMode', BlendMode.Multiply);

    cmd.execute();
    expect(layer.blendMode).toBe(BlendMode.Multiply);
    cmd.undo();
    expect(layer.blendMode).toBe(BlendMode.Normal);
  });

  it('sets name', () => {
    const layer = createRasterLayer();
    const cmd = new SetLayerPropertyCommand(layer, 'name', 'Renamed');

    cmd.execute();
    expect(layer.name).toBe('Renamed');
    cmd.undo();
    expect(layer.name).toBe('Layer 1');
  });

  it('sets locked', () => {
    const layer = createRasterLayer();
    const cmd = new SetLayerPropertyCommand(layer, 'locked', true);

    cmd.execute();
    expect(layer.locked).toBe(true);
    cmd.undo();
    expect(layer.locked).toBe(false);
  });

  it('has a descriptive description in Japanese', () => {
    const layer = createRasterLayer();
    const cmd = new SetLayerPropertyCommand(layer, 'opacity', 0.5);
    expect(cmd.description).toBe('「Layer 1」の不透明度を変更');
  });

  it('uses Japanese label for writingMode', () => {
    const layer = createTextLayer();
    const cmd = new SetLayerPropertyCommand(layer, 'writingMode', 'vertical-rl');
    expect(cmd.description).toBe('「Title」の文字方向を変更');
  });
});
