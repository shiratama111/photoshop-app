import { describe, it, expect, vi } from 'vitest';
import { importPsd } from './import-psd';
import { writePsd } from 'ag-psd';

// ag-psd needs a canvas implementation in Node.
// Provide a minimal mock for testing.
vi.mock('ag-psd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ag-psd')>();
  return {
    ...actual,
    // We'll use the real readPsd but need to handle canvas creation
  };
});

/**
 * Create a minimal PSD buffer using ag-psd's writePsd.
 */
function createTestPsd(options?: {
  width?: number;
  height?: number;
  layers?: Array<{
    name: string;
    type?: 'raster' | 'text' | 'group';
    children?: Array<{ name: string }>;
    text?: string;
  }>;
}): ArrayBuffer {
  const { width = 100, height = 100, layers = [] } = options ?? {};

  const children = layers.map((l) => {
    if (l.type === 'group' || l.children) {
      return {
        name: l.name,
        children: (l.children ?? []).map((c) => ({
          name: c.name,
          left: 0,
          top: 0,
          right: 10,
          bottom: 10,
        })),
      };
    }
    if (l.type === 'text' || l.text) {
      return {
        name: l.name,
        left: 0,
        top: 0,
        right: 50,
        bottom: 20,
        text: {
          text: l.text ?? 'Test text',
          style: { fontSize: 24, font: { name: 'Arial' } },
        },
      };
    }
    return {
      name: l.name,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
    };
  });

  const psd = {
    width,
    height,
    children,
  };

  return writePsd(psd);
}

describe('importPsd', () => {
  describe('basic import', () => {
    it('should import an empty PSD', () => {
      const buffer = createTestPsd({ width: 200, height: 150 });
      const { document, report } = importPsd(buffer, 'test.psd');

      expect(document.name).toBe('test');
      expect(document.canvas.size.width).toBe(200);
      expect(document.canvas.size.height).toBe(150);
      expect(document.rootGroup.type).toBe('group');
      expect(report.canProceed).toBe(true);
    });

    it('should strip .psd extension from filename', () => {
      const buffer = createTestPsd();
      const { document } = importPsd(buffer, 'MyDesign.psd');
      expect(document.name).toBe('MyDesign');
    });

    it('should use default name for unnamed files', () => {
      const buffer = createTestPsd();
      const { document } = importPsd(buffer);
      expect(document.name).toBe('Untitled');
    });

    it('should set canvas properties', () => {
      const buffer = createTestPsd({ width: 1920, height: 1080 });
      const { document } = importPsd(buffer);

      expect(document.canvas.colorMode).toBe('rgb');
      expect(document.canvas.bitDepth).toBe(8);
      expect(document.canvas.dpi).toBeGreaterThan(0);
    });

    it('should set document metadata', () => {
      const buffer = createTestPsd();
      const { document } = importPsd(buffer);

      expect(document.id).toBeTruthy();
      expect(document.selectedLayerId).toBeNull();
      expect(document.filePath).toBeNull();
      expect(document.dirty).toBe(false);
      expect(document.createdAt).toBeTruthy();
      expect(document.modifiedAt).toBeTruthy();
    });
  });

  describe('layer mapping', () => {
    it('should import raster layers', () => {
      const buffer = createTestPsd({
        layers: [{ name: 'Background' }, { name: 'Layer 1' }],
      });
      const { document, report } = importPsd(buffer);

      expect(document.rootGroup.children).toHaveLength(2);
      expect(document.rootGroup.children[0].name).toBe('Background');
      expect(document.rootGroup.children[1].name).toBe('Layer 1');
      expect(report.layerCount).toBe(2);
    });

    it('should import layer groups with children', () => {
      const buffer = createTestPsd({
        layers: [
          {
            name: 'Group 1',
            type: 'group',
            children: [{ name: 'Child A' }, { name: 'Child B' }],
          },
        ],
      });
      const { document } = importPsd(buffer);

      const group = document.rootGroup.children[0];
      expect(group.type).toBe('group');
      if (group.type === 'group') {
        expect(group.children).toHaveLength(2);
        expect(group.children[0].name).toBe('Child A');
      }
    });

    it('should import text layers when rasterizeText is false', () => {
      const buffer = createTestPsd({
        layers: [{ name: 'Title', type: 'text', text: 'Hello World' }],
      });
      const { document } = importPsd(buffer, 'test.psd', { rasterizeText: false });

      const layer = document.rootGroup.children[0];
      expect(layer.type).toBe('text');
      if (layer.type === 'text') {
        expect(layer.text).toBe('Hello World');
        expect(layer.fontFamily).toBe('Arial');
        expect(layer.fontSize).toBe(24);
      }
    });

    it('should rasterize text layers when rasterizeText is true', () => {
      const buffer = createTestPsd({
        layers: [{ name: 'Title', type: 'text', text: 'Hello' }],
      });
      const { document } = importPsd(buffer, 'test.psd', { rasterizeText: true });

      const layer = document.rootGroup.children[0];
      expect(layer.type).toBe('raster');
    });
  });

  describe('compatibility report', () => {
    it('should report when dimensions exceed max', () => {
      const buffer = createTestPsd({ width: 5000, height: 3000 });
      const { report } = importPsd(buffer, 'big.psd', { maxDimension: 4096 });

      const dimIssue = report.issues.find((i) => i.feature === 'max-dimension');
      expect(dimIssue).toBeDefined();
      expect(dimIssue?.severity).toBe('warning');
    });

    it('should allow proceed when no errors', () => {
      const buffer = createTestPsd();
      const { report } = importPsd(buffer);
      expect(report.canProceed).toBe(true);
    });
  });
});
