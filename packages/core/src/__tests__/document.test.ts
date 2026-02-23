import { describe, it, expect } from 'vitest';
import { createDocument } from '../document';

describe('createDocument', () => {
  it('creates a document with the given name, width, and height', () => {
    const doc = createDocument('Untitled', 1920, 1080);

    expect(doc.name).toBe('Untitled');
    expect(doc.canvas.size.width).toBe(1920);
    expect(doc.canvas.size.height).toBe(1080);
  });

  it('generates a UUID for the document id', () => {
    const doc = createDocument('Test', 800, 600);

    expect(doc.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('generates a UUID for the rootGroup id', () => {
    const doc = createDocument('Test', 800, 600);

    expect(doc.rootGroup.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('uses different UUIDs for document and rootGroup', () => {
    const doc = createDocument('Test', 800, 600);

    expect(doc.id).not.toBe(doc.rootGroup.id);
  });

  it('defaults DPI to 72 when not specified', () => {
    const doc = createDocument('Test', 800, 600);

    expect(doc.canvas.dpi).toBe(72);
  });

  it('uses the provided DPI value', () => {
    const doc = createDocument('Print', 2480, 3508, 300);

    expect(doc.canvas.dpi).toBe(300);
  });

  it('sets colorMode to rgb and bitDepth to 8', () => {
    const doc = createDocument('Test', 800, 600);

    expect(doc.canvas.colorMode).toBe('rgb');
    expect(doc.canvas.bitDepth).toBe(8);
  });

  it('creates an empty rootGroup of type group', () => {
    const doc = createDocument('Test', 800, 600);

    expect(doc.rootGroup.type).toBe('group');
    expect(doc.rootGroup.children).toEqual([]);
    expect(doc.rootGroup.expanded).toBe(true);
  });

  it('initializes document state correctly', () => {
    const doc = createDocument('Test', 800, 600);

    expect(doc.dirty).toBe(false);
    expect(doc.selectedLayerId).toBeNull();
    expect(doc.filePath).toBeNull();
  });

  it('sets createdAt and modifiedAt to ISO timestamps', () => {
    const before = new Date().toISOString();
    const doc = createDocument('Test', 800, 600);
    const after = new Date().toISOString();

    expect(doc.createdAt).toBe(doc.modifiedAt);
    expect(doc.createdAt >= before).toBe(true);
    expect(doc.createdAt <= after).toBe(true);
  });
});
