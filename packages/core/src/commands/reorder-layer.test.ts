import { describe, it, expect } from 'vitest';
import { ReorderLayerCommand } from './reorder-layer';
import type { LayerGroup, RasterLayer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';

function createRasterLayer(id: string, name: string): RasterLayer {
  return {
    id, name, type: 'raster', visible: true, opacity: 1,
    blendMode: BlendMode.Normal, position: { x: 0, y: 0 },
    locked: false, effects: [], parentId: null,
    imageData: null, bounds: { x: 0, y: 0, width: 100, height: 100 },
  };
}

function createGroup(children: RasterLayer[]): LayerGroup {
  const group: LayerGroup = {
    id: 'g1', name: 'Root', type: 'group', visible: true, opacity: 1,
    blendMode: BlendMode.Normal, position: { x: 0, y: 0 },
    locked: false, effects: [], parentId: null, children, expanded: true,
  };
  for (const child of children) {
    child.parentId = group.id;
  }
  return group;
}

describe('ReorderLayerCommand', () => {
  it('moves a layer from index 0 to index 2', () => {
    const a = createRasterLayer('a', 'A');
    const b = createRasterLayer('b', 'B');
    const c = createRasterLayer('c', 'C');
    const group = createGroup([a, b, c]);
    const cmd = new ReorderLayerCommand(group, a, 2);

    cmd.execute();
    expect(group.children.map(l => l.id)).toEqual(['b', 'c', 'a']);
  });

  it('undo restores original order', () => {
    const a = createRasterLayer('a', 'A');
    const b = createRasterLayer('b', 'B');
    const c = createRasterLayer('c', 'C');
    const group = createGroup([a, b, c]);
    const cmd = new ReorderLayerCommand(group, a, 2);

    cmd.execute();
    cmd.undo();
    expect(group.children.map(l => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('moves a layer down (higher index to lower)', () => {
    const a = createRasterLayer('a', 'A');
    const b = createRasterLayer('b', 'B');
    const c = createRasterLayer('c', 'C');
    const group = createGroup([a, b, c]);
    const cmd = new ReorderLayerCommand(group, c, 0);

    cmd.execute();
    expect(group.children.map(l => l.id)).toEqual(['c', 'a', 'b']);
  });

  it('throws if layer is not in the group', () => {
    const group = createGroup([]);
    const orphan = createRasterLayer('orphan', 'Orphan');
    expect(() => new ReorderLayerCommand(group, orphan, 0)).toThrow();
  });

  it('redo after undo works correctly', () => {
    const a = createRasterLayer('a', 'A');
    const b = createRasterLayer('b', 'B');
    const group = createGroup([a, b]);
    const cmd = new ReorderLayerCommand(group, a, 1);

    cmd.execute();
    expect(group.children.map(l => l.id)).toEqual(['b', 'a']);
    cmd.undo();
    expect(group.children.map(l => l.id)).toEqual(['a', 'b']);
    cmd.execute();
    expect(group.children.map(l => l.id)).toEqual(['b', 'a']);
  });
});
