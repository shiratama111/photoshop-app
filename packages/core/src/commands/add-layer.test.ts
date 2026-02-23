import { describe, it, expect } from 'vitest';
import { AddLayerCommand } from './add-layer';
import type { LayerGroup, RasterLayer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';

function createGroup(id = 'group-1', children: RasterLayer[] = []): LayerGroup {
  return {
    id,
    name: 'Root',
    type: 'group',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    children,
    expanded: true,
  };
}

function createRasterLayer(id: string, name: string): RasterLayer {
  return {
    id,
    name,
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

describe('AddLayerCommand', () => {
  it('adds a layer to the end of the group', () => {
    const group = createGroup();
    const layer = createRasterLayer('layer-1', 'Background');
    const cmd = new AddLayerCommand(group, layer);

    cmd.execute();
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toBe(layer);
    expect(layer.parentId).toBe('group-1');
  });

  it('adds a layer at a specific index', () => {
    const existing = createRasterLayer('layer-1', 'Existing');
    const group = createGroup('g', [existing]);
    existing.parentId = 'g';
    const newLayer = createRasterLayer('layer-2', 'New');
    const cmd = new AddLayerCommand(group, newLayer, 0);

    cmd.execute();
    expect(group.children[0]).toBe(newLayer);
    expect(group.children[1]).toBe(existing);
  });

  it('undo removes the layer', () => {
    const group = createGroup();
    const layer = createRasterLayer('layer-1', 'Layer');
    const cmd = new AddLayerCommand(group, layer);

    cmd.execute();
    cmd.undo();
    expect(group.children).toHaveLength(0);
    expect(layer.parentId).toBeNull();
  });

  it('redo re-inserts the layer', () => {
    const group = createGroup();
    const layer = createRasterLayer('layer-1', 'Layer');
    const cmd = new AddLayerCommand(group, layer);

    cmd.execute();
    cmd.undo();
    cmd.execute();
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toBe(layer);
  });

  it('has a descriptive description', () => {
    const group = createGroup();
    const layer = createRasterLayer('l1', 'My Layer');
    const cmd = new AddLayerCommand(group, layer);
    expect(cmd.description).toBe('Add layer "My Layer"');
  });
});
