import { describe, it, expect } from 'vitest';
import { BlendMode } from '@photoshop-app/types';
import { createRasterLayer, createTextLayer, createLayerGroup } from '../layer-factory';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createRasterLayer', () => {
  it('creates a raster layer with the given name and bounds', () => {
    const layer = createRasterLayer('Background', 1920, 1080);

    expect(layer.name).toBe('Background');
    expect(layer.type).toBe('raster');
    expect(layer.bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('generates a UUID for the id', () => {
    const layer = createRasterLayer('Layer 1', 100, 100);

    expect(layer.id).toMatch(UUID_RE);
  });

  it('sets default properties', () => {
    const layer = createRasterLayer('Layer 1', 100, 100);

    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(1);
    expect(layer.blendMode).toBe(BlendMode.Normal);
    expect(layer.position).toEqual({ x: 0, y: 0 });
    expect(layer.locked).toBe(false);
    expect(layer.effects).toEqual([]);
    expect(layer.parentId).toBeNull();
    expect(layer.imageData).toBeNull();
  });

  it('generates unique IDs for different layers', () => {
    const a = createRasterLayer('A', 100, 100);
    const b = createRasterLayer('B', 200, 200);

    expect(a.id).not.toBe(b.id);
  });
});

describe('createTextLayer', () => {
  it('creates a text layer with name and text', () => {
    const layer = createTextLayer('Title', 'Hello World');

    expect(layer.name).toBe('Title');
    expect(layer.type).toBe('text');
    expect(layer.text).toBe('Hello World');
  });

  it('generates a UUID for the id', () => {
    const layer = createTextLayer('Title', 'Hi');

    expect(layer.id).toMatch(UUID_RE);
  });

  it('uses default text styling when no options provided', () => {
    const layer = createTextLayer('Title', 'Hi');

    expect(layer.fontFamily).toBe('Arial');
    expect(layer.fontSize).toBe(16);
    expect(layer.color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(layer.bold).toBe(false);
    expect(layer.italic).toBe(false);
    expect(layer.alignment).toBe('left');
    expect(layer.lineHeight).toBe(1.2);
    expect(layer.letterSpacing).toBe(0);
    expect(layer.textBounds).toBeNull();
  });

  it('applies provided text options', () => {
    const layer = createTextLayer('Title', 'Hello', {
      fontFamily: 'Helvetica',
      fontSize: 24,
      color: { r: 255, g: 0, b: 0, a: 1 },
      bold: true,
      italic: true,
      alignment: 'center',
      lineHeight: 1.5,
      letterSpacing: 2,
    });

    expect(layer.fontFamily).toBe('Helvetica');
    expect(layer.fontSize).toBe(24);
    expect(layer.color).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(layer.bold).toBe(true);
    expect(layer.italic).toBe(true);
    expect(layer.alignment).toBe('center');
    expect(layer.lineHeight).toBe(1.5);
    expect(layer.letterSpacing).toBe(2);
  });

  it('partially applies options, using defaults for the rest', () => {
    const layer = createTextLayer('Title', 'Hi', { bold: true });

    expect(layer.bold).toBe(true);
    expect(layer.fontFamily).toBe('Arial');
    expect(layer.fontSize).toBe(16);
  });

  it('sets default base layer properties', () => {
    const layer = createTextLayer('Title', 'Hi');

    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(1);
    expect(layer.blendMode).toBe(BlendMode.Normal);
    expect(layer.position).toEqual({ x: 0, y: 0 });
    expect(layer.locked).toBe(false);
    expect(layer.effects).toEqual([]);
    expect(layer.parentId).toBeNull();
  });
});

describe('createLayerGroup', () => {
  it('creates a group with the given name', () => {
    const group = createLayerGroup('Folder 1');

    expect(group.name).toBe('Folder 1');
    expect(group.type).toBe('group');
  });

  it('generates a UUID for the id', () => {
    const group = createLayerGroup('Group');

    expect(group.id).toMatch(UUID_RE);
  });

  it('starts with an empty children array and expanded true', () => {
    const group = createLayerGroup('Group');

    expect(group.children).toEqual([]);
    expect(group.expanded).toBe(true);
  });

  it('sets default base layer properties', () => {
    const group = createLayerGroup('Group');

    expect(group.visible).toBe(true);
    expect(group.opacity).toBe(1);
    expect(group.blendMode).toBe(BlendMode.Normal);
    expect(group.position).toEqual({ x: 0, y: 0 });
    expect(group.locked).toBe(false);
    expect(group.effects).toEqual([]);
    expect(group.parentId).toBeNull();
  });
});
