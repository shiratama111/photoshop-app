import { describe, it, expect } from 'vitest';
import { RemoveLayerCommand } from './remove-layer';
import type { LayerGroup, RasterLayer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';

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

function createGroup(children: RasterLayer[]): LayerGroup {
  const group: LayerGroup = {
    id: 'group-1',
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
  for (const child of children) {
    child.parentId = group.id;
  }
  return group;
}

describe('RemoveLayerCommand', () => {
  it('removes a layer from the group', () => {
    const layer = createRasterLayer('l1', 'Layer 1');
    const group = createGroup([layer]);
    const cmd = new RemoveLayerCommand(group, layer);

    cmd.execute();
    expect(group.children).toHaveLength(0);
    expect(layer.parentId).toBeNull();
  });

  it('undo re-inserts at original position', () => {
    const a = createRasterLayer('a', 'A');
    const b = createRasterLayer('b', 'B');
    const c = createRasterLayer('c', 'C');
    const group = createGroup([a, b, c]);
    const cmd = new RemoveLayerCommand(group, b);

    cmd.execute();
    expect(group.children.map((l) => l.id)).toEqual(['a', 'c']);

    cmd.undo();
    expect(group.children.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(b.parentId).toBe('group-1');
  });

  it('throws if layer is not a child of the group', () => {
    const group = createGroup([]);
    const orphan = createRasterLayer('orphan', 'Orphan');
    expect(() => new RemoveLayerCommand(group, orphan)).toThrow();
  });

  it('has a descriptive description in Japanese', () => {
    const layer = createRasterLayer('l1', 'BG');
    const group = createGroup([layer]);
    const cmd = new RemoveLayerCommand(group, layer);
    expect(cmd.description).toBe('レイヤー「BG」を削除');
  });
});
