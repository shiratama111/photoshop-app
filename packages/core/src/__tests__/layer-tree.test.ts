import { describe, it, expect } from 'vitest';
import type { LayerGroup, RasterLayer, TextLayer, Layer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import {
  addLayer,
  removeLayer,
  reorderLayer,
  findLayerById,
  findParentGroup,
  traverseLayers,
  flattenLayers,
  isClippingMask,
  getClippingBase,
  getClippedLayers,
  toggleClippingMask,
} from '../layer-tree';
import type { ClippableLayer } from '../layer-tree';

// --- Test helpers ---

function makeRoot(id = 'root', children: Layer[] = []): LayerGroup {
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

function makeRaster(id: string, name: string): RasterLayer {
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

function makeText(id: string, name: string, text: string): TextLayer {
  return {
    id,
    name,
    type: 'text',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    text,
    fontFamily: 'Arial',
    fontSize: 16,
    color: { r: 0, g: 0, b: 0, a: 1 },
    bold: false,
    italic: false,
    alignment: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    textBounds: null,
    writingMode: 'horizontal-tb',
  };
}

function makeGroup(id: string, name: string, children: Layer[] = []): LayerGroup {
  return {
    id,
    name,
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

// --- Tests ---

describe('addLayer', () => {
  it('adds a layer to the root group when no parentId specified', () => {
    const root = makeRoot();
    const layer = makeRaster('l1', 'Layer 1');

    addLayer(root, layer);

    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toBe(layer);
    expect(layer.parentId).toBe('root');
  });

  it('adds a layer to a nested group by parentId', () => {
    const sub = makeGroup('sub', 'Subgroup');
    const root = makeRoot('root', [sub]);
    sub.parentId = 'root';

    const layer = makeRaster('l1', 'Layer 1');
    addLayer(root, layer, 'sub');

    expect(sub.children).toHaveLength(1);
    expect(sub.children[0]).toBe(layer);
    expect(layer.parentId).toBe('sub');
  });

  it('adds a layer at a specific index', () => {
    const existing = makeRaster('l1', 'Existing');
    const root = makeRoot('root', [existing]);
    existing.parentId = 'root';

    const newLayer = makeRaster('l2', 'New');
    addLayer(root, newLayer, undefined, 0);

    expect(root.children[0]).toBe(newLayer);
    expect(root.children[1]).toBe(existing);
  });

  it('appends to end when index is not specified', () => {
    const a = makeRaster('a', 'A');
    const b = makeRaster('b', 'B');
    const root = makeRoot('root', [a]);
    a.parentId = 'root';

    addLayer(root, b);

    expect(root.children[1]).toBe(b);
  });

  it('does nothing when parentId does not exist', () => {
    const root = makeRoot();
    const layer = makeRaster('l1', 'Layer 1');

    addLayer(root, layer, 'nonexistent');

    expect(root.children).toHaveLength(0);
    expect(layer.parentId).toBeNull();
  });
});

describe('removeLayer', () => {
  it('removes a layer from the root group', () => {
    const layer = makeRaster('l1', 'Layer 1');
    layer.parentId = 'root';
    const root = makeRoot('root', [layer]);

    const removed = removeLayer(root, 'l1');

    expect(removed).toBe(layer);
    expect(root.children).toHaveLength(0);
    expect(layer.parentId).toBeNull();
  });

  it('removes a layer from a nested group', () => {
    const layer = makeRaster('l1', 'Layer 1');
    layer.parentId = 'sub';
    const sub = makeGroup('sub', 'Subgroup', [layer]);
    sub.parentId = 'root';
    const root = makeRoot('root', [sub]);

    const removed = removeLayer(root, 'l1');

    expect(removed).toBe(layer);
    expect(sub.children).toHaveLength(0);
  });

  it('removes a group and its children together', () => {
    const child = makeRaster('child', 'Child');
    child.parentId = 'sub';
    const sub = makeGroup('sub', 'Subgroup', [child]);
    sub.parentId = 'root';
    const root = makeRoot('root', [sub]);

    const removed = removeLayer(root, 'sub');

    expect(removed).toBe(sub);
    expect(root.children).toHaveLength(0);
    // Children are still attached to the removed group
    expect((removed as LayerGroup).children).toHaveLength(1);
  });

  it('returns null for a nonexistent layer id', () => {
    const root = makeRoot();

    const removed = removeLayer(root, 'nonexistent');

    expect(removed).toBeNull();
  });

  it('preserves other layers when one is removed', () => {
    const a = makeRaster('a', 'A');
    const b = makeRaster('b', 'B');
    a.parentId = 'root';
    b.parentId = 'root';
    const root = makeRoot('root', [a, b]);

    removeLayer(root, 'a');

    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toBe(b);
  });
});

describe('reorderLayer', () => {
  it('reorders within the same group', () => {
    const a = makeRaster('a', 'A');
    const b = makeRaster('b', 'B');
    const c = makeRaster('c', 'C');
    a.parentId = 'root';
    b.parentId = 'root';
    c.parentId = 'root';
    const root = makeRoot('root', [a, b, c]);

    const result = reorderLayer(root, 'c', 'root', 0);

    expect(result).toBe(true);
    expect(root.children.map((l) => l.id)).toEqual(['c', 'a', 'b']);
    expect(c.parentId).toBe('root');
  });

  it('moves a layer from one group to another', () => {
    const layer = makeRaster('l1', 'Layer 1');
    layer.parentId = 'root';
    const sub = makeGroup('sub', 'Subgroup');
    sub.parentId = 'root';
    const root = makeRoot('root', [layer, sub]);

    const result = reorderLayer(root, 'l1', 'sub', 0);

    expect(result).toBe(true);
    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toBe(sub);
    expect(sub.children).toHaveLength(1);
    expect(sub.children[0]).toBe(layer);
    expect(layer.parentId).toBe('sub');
  });

  it('returns false when the source layer does not exist', () => {
    const root = makeRoot();

    const result = reorderLayer(root, 'nonexistent', 'root', 0);

    expect(result).toBe(false);
  });

  it('returns false when the target group does not exist', () => {
    const layer = makeRaster('l1', 'Layer 1');
    layer.parentId = 'root';
    const root = makeRoot('root', [layer]);

    const result = reorderLayer(root, 'l1', 'nonexistent', 0);

    expect(result).toBe(false);
    // Layer was removed but target not found — it's lost.
    // This is expected per the spec (returns false on failure).
  });

  it('clamps the index to the children length', () => {
    const a = makeRaster('a', 'A');
    a.parentId = 'root';
    const root = makeRoot('root', [a]);

    const b = makeRaster('b', 'B');
    b.parentId = 'root';
    root.children.push(b);

    const result = reorderLayer(root, 'a', 'root', 999);

    expect(result).toBe(true);
    expect(root.children[root.children.length - 1]).toBe(a);
  });
});

describe('findLayerById', () => {
  it('finds a top-level layer', () => {
    const layer = makeRaster('l1', 'Layer 1');
    layer.parentId = 'root';
    const root = makeRoot('root', [layer]);

    expect(findLayerById(root, 'l1')).toBe(layer);
  });

  it('finds a nested layer', () => {
    const nested = makeText('t1', 'Text', 'Hello');
    nested.parentId = 'sub';
    const sub = makeGroup('sub', 'Subgroup', [nested]);
    sub.parentId = 'root';
    const root = makeRoot('root', [sub]);

    expect(findLayerById(root, 't1')).toBe(nested);
  });

  it('finds a deeply nested layer', () => {
    const deep = makeRaster('deep', 'Deep');
    deep.parentId = 'sub2';
    const sub2 = makeGroup('sub2', 'Sub2', [deep]);
    sub2.parentId = 'sub1';
    const sub1 = makeGroup('sub1', 'Sub1', [sub2]);
    sub1.parentId = 'root';
    const root = makeRoot('root', [sub1]);

    expect(findLayerById(root, 'deep')).toBe(deep);
  });

  it('returns null for a nonexistent id', () => {
    const root = makeRoot();

    expect(findLayerById(root, 'nonexistent')).toBeNull();
  });

  it('returns null for the rootGroup id itself', () => {
    const root = makeRoot('root');

    // findLayerById searches children, not rootGroup itself
    expect(findLayerById(root, 'root')).toBeNull();
  });
});

describe('findParentGroup', () => {
  it('returns rootGroup for a top-level layer', () => {
    const layer = makeRaster('l1', 'Layer 1');
    layer.parentId = 'root';
    const root = makeRoot('root', [layer]);

    expect(findParentGroup(root, 'l1')).toBe(root);
  });

  it('returns the correct nested group', () => {
    const layer = makeRaster('l1', 'Layer 1');
    layer.parentId = 'sub';
    const sub = makeGroup('sub', 'Subgroup', [layer]);
    sub.parentId = 'root';
    const root = makeRoot('root', [sub]);

    expect(findParentGroup(root, 'l1')).toBe(sub);
  });

  it('returns null for a nonexistent layer', () => {
    const root = makeRoot();

    expect(findParentGroup(root, 'nonexistent')).toBeNull();
  });
});

describe('traverseLayers', () => {
  it('traverses in depth-first order (children before parent group)', () => {
    const a = makeRaster('a', 'A');
    const b = makeRaster('b', 'B');
    b.parentId = 'sub';
    const sub = makeGroup('sub', 'Sub', [b]);
    sub.parentId = 'root';
    a.parentId = 'root';
    const root = makeRoot('root', [a, sub]);

    const visited: string[] = [];
    traverseLayers(root, (layer) => visited.push(layer.id));

    // a is first child: visited directly
    // sub is second child: b is visited first (child), then sub (parent)
    expect(visited).toEqual(['a', 'b', 'sub']);
  });

  it('handles an empty root group', () => {
    const root = makeRoot();
    const visited: string[] = [];

    traverseLayers(root, (layer) => visited.push(layer.id));

    expect(visited).toEqual([]);
  });

  it('traverses deeply nested structures', () => {
    const deep = makeRaster('deep', 'Deep');
    deep.parentId = 'sub2';
    const sub2 = makeGroup('sub2', 'Sub2', [deep]);
    sub2.parentId = 'sub1';
    const sub1 = makeGroup('sub1', 'Sub1', [sub2]);
    sub1.parentId = 'root';
    const top = makeRaster('top', 'Top');
    top.parentId = 'root';
    const root = makeRoot('root', [sub1, top]);

    const visited: string[] = [];
    traverseLayers(root, (layer) => visited.push(layer.id));

    expect(visited).toEqual(['deep', 'sub2', 'sub1', 'top']);
  });
});

describe('flattenLayers', () => {
  it('returns layers in draw order (bottom to top)', () => {
    const bg = makeRaster('bg', 'Background');
    const text = makeText('t1', 'Title', 'Hello');
    const overlay = makeRaster('ol', 'Overlay');
    bg.parentId = 'root';
    text.parentId = 'root';
    overlay.parentId = 'root';
    const root = makeRoot('root', [bg, text, overlay]);

    const flat = flattenLayers(root);

    expect(flat.map((l) => l.id)).toEqual(['bg', 't1', 'ol']);
  });

  it('flattens nested groups in depth-first order', () => {
    const a = makeRaster('a', 'A');
    const b = makeRaster('b', 'B');
    b.parentId = 'grp';
    const grp = makeGroup('grp', 'Group', [b]);
    grp.parentId = 'root';
    a.parentId = 'root';
    const c = makeRaster('c', 'C');
    c.parentId = 'root';
    const root = makeRoot('root', [a, grp, c]);

    const flat = flattenLayers(root);

    expect(flat.map((l) => l.id)).toEqual(['a', 'b', 'grp', 'c']);
  });

  it('returns an empty array for an empty root group', () => {
    const root = makeRoot();

    expect(flattenLayers(root)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Clipping mask utilities — CLIP-001
// ---------------------------------------------------------------------------

/** Helper to create a raster layer with clippingMask flag. */
function makeClippingRaster(id: string, name: string): RasterLayer & ClippableLayer {
  const layer = makeRaster(id, name) as RasterLayer & ClippableLayer;
  layer.clippingMask = true;
  return layer;
}

describe('isClippingMask', () => {
  it('returns false for a normal layer', () => {
    const layer = makeRaster('l1', 'Normal');
    expect(isClippingMask(layer)).toBe(false);
  });

  it('returns true for a layer with clippingMask: true', () => {
    const layer = makeClippingRaster('l1', 'Clipped');
    expect(isClippingMask(layer)).toBe(true);
  });

  it('returns false for a layer with clippingMask: false', () => {
    const layer = makeRaster('l1', 'Normal') as RasterLayer & ClippableLayer;
    layer.clippingMask = false;
    expect(isClippingMask(layer)).toBe(false);
  });

  it('returns false for a layer without the clippingMask property', () => {
    const layer = makeText('t1', 'Text', 'Hello');
    expect(isClippingMask(layer)).toBe(false);
  });
});

describe('getClippingBase', () => {
  it('returns null for a non-clipping layer', () => {
    const a = makeRaster('a', 'A');
    const b = makeRaster('b', 'B');
    const siblings = [a, b];

    expect(getClippingBase(b, siblings)).toBeNull();
  });

  it('returns the immediately preceding non-clipping layer', () => {
    const base = makeRaster('base', 'Base');
    const clipped = makeClippingRaster('clip', 'Clipped');
    const siblings = [base, clipped];

    expect(getClippingBase(clipped, siblings)).toBe(base);
  });

  it('skips over intermediate clipping layers to find the base', () => {
    const base = makeRaster('base', 'Base');
    const clip1 = makeClippingRaster('c1', 'Clip1');
    const clip2 = makeClippingRaster('c2', 'Clip2');
    const siblings = [base, clip1, clip2];

    expect(getClippingBase(clip2, siblings)).toBe(base);
    expect(getClippingBase(clip1, siblings)).toBe(base);
  });

  it('returns null when the clipping layer is at index 0', () => {
    const clip = makeClippingRaster('c1', 'Clip');
    const siblings = [clip];

    expect(getClippingBase(clip, siblings)).toBeNull();
  });

  it('returns null when all layers below are also clipping', () => {
    const clip1 = makeClippingRaster('c1', 'Clip1');
    const clip2 = makeClippingRaster('c2', 'Clip2');
    const siblings = [clip1, clip2];

    expect(getClippingBase(clip2, siblings)).toBeNull();
  });
});

describe('getClippedLayers', () => {
  it('returns empty array for a clipping layer used as baseLayer', () => {
    const clip = makeClippingRaster('c1', 'Clip');
    const siblings = [clip];

    expect(getClippedLayers(clip, siblings)).toEqual([]);
  });

  it('returns empty array when no clipping layers follow the base', () => {
    const base = makeRaster('base', 'Base');
    const normal = makeRaster('normal', 'Normal');
    const siblings = [base, normal];

    expect(getClippedLayers(base, siblings)).toEqual([]);
  });

  it('returns a single clipped layer', () => {
    const base = makeRaster('base', 'Base');
    const clip = makeClippingRaster('c1', 'Clip');
    const siblings = [base, clip];

    expect(getClippedLayers(base, siblings)).toEqual([clip]);
  });

  it('returns multiple contiguous clipped layers', () => {
    const base = makeRaster('base', 'Base');
    const c1 = makeClippingRaster('c1', 'Clip1');
    const c2 = makeClippingRaster('c2', 'Clip2');
    const c3 = makeClippingRaster('c3', 'Clip3');
    const siblings = [base, c1, c2, c3];

    expect(getClippedLayers(base, siblings)).toEqual([c1, c2, c3]);
  });

  it('stops at the first non-clipping layer', () => {
    const base = makeRaster('base', 'Base');
    const c1 = makeClippingRaster('c1', 'Clip1');
    const normal = makeRaster('normal', 'Normal');
    const c2 = makeClippingRaster('c2', 'Clip2');
    const siblings = [base, c1, normal, c2];

    expect(getClippedLayers(base, siblings)).toEqual([c1]);
  });

  it('returns empty array when baseLayer is not in the siblings array', () => {
    const base = makeRaster('base', 'Base');
    const other = makeRaster('other', 'Other');
    const siblings = [other];

    expect(getClippedLayers(base, siblings)).toEqual([]);
  });
});

describe('toggleClippingMask', () => {
  it('enables clipping mask on a non-clipping layer', () => {
    const base = makeRaster('base', 'Base');
    const target = makeRaster('target', 'Target');
    base.parentId = 'root';
    target.parentId = 'root';
    const root = makeRoot('root', [base, target]);

    toggleClippingMask('target', root);

    expect(isClippingMask(target)).toBe(true);
  });

  it('disables clipping mask on a clipping layer', () => {
    const base = makeRaster('base', 'Base');
    const clip = makeClippingRaster('clip', 'Clip');
    base.parentId = 'root';
    clip.parentId = 'root';
    const root = makeRoot('root', [base, clip]);

    toggleClippingMask('clip', root);

    expect(isClippingMask(clip)).toBe(false);
  });

  it('does nothing for the bottom-most layer (index 0)', () => {
    const bottom = makeRaster('bottom', 'Bottom');
    bottom.parentId = 'root';
    const root = makeRoot('root', [bottom]);

    toggleClippingMask('bottom', root);

    expect(isClippingMask(bottom)).toBe(false);
  });

  it('does nothing for a nonexistent layer id', () => {
    const root = makeRoot('root');

    // Should not throw.
    toggleClippingMask('nonexistent', root);
  });

  it('works on deeply nested layers', () => {
    const a = makeRaster('a', 'A');
    const b = makeRaster('b', 'B');
    a.parentId = 'sub';
    b.parentId = 'sub';
    const sub = makeGroup('sub', 'Sub', [a, b]);
    sub.parentId = 'root';
    const root = makeRoot('root', [sub]);

    toggleClippingMask('b', root);

    expect(isClippingMask(b)).toBe(true);
  });

  it('toggles on then off', () => {
    const base = makeRaster('base', 'Base');
    const target = makeRaster('target', 'Target');
    base.parentId = 'root';
    target.parentId = 'root';
    const root = makeRoot('root', [base, target]);

    toggleClippingMask('target', root);
    expect(isClippingMask(target)).toBe(true);

    toggleClippingMask('target', root);
    expect(isClippingMask(target)).toBe(false);
  });
});
