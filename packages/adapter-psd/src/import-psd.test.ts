import { describe, it, expect, vi } from 'vitest';
import { importPsd } from './import-psd';
import { mapLayer } from './layer-mapper';
import { writePsd } from 'ag-psd';
import type { CompatibilityIssue, PsdImportOptions } from '@photoshop-app/types';

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
  const defaultOptions: PsdImportOptions = {
    rasterizeText: false,
    rasterizeSmartObjects: true,
    maxDimension: 0,
  };

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
        expect(layer.writingMode).toBe('horizontal-tb');
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

    it('should map PSD layer effects to internal LayerEffect[]', () => {
      const issues: CompatibilityIssue[] = [];
      const agLayer = {
        name: 'FX Layer',
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        effects: {
          dropShadow: [{
            enabled: true,
            color: { r: 10, g: 20, b: 30 },
            opacity: 80,
            angle: 135,
            distance: { units: 'Pixels', value: 12 },
            size: { units: 'Pixels', value: 8 },
            choke: { units: 'Pixels', value: 5 },
          }],
          innerShadow: [{
            enabled: true,
            color: { r: 1, g: 2, b: 3 },
            opacity: 70,
            angle: 45,
            distance: { units: 'Pixels', value: 6 },
            size: { units: 'Pixels', value: 7 },
            choke: { units: 'Pixels', value: 4 },
          }],
          outerGlow: {
            enabled: true,
            color: { r: 200, g: 210, b: 220 },
            opacity: 65,
            size: { units: 'Pixels', value: 10 },
            choke: { units: 'Pixels', value: 2 },
          },
          innerGlow: {
            enabled: true,
            color: { r: 100, g: 120, b: 140 },
            opacity: 55,
            size: { units: 'Pixels', value: 9 },
            choke: { units: 'Pixels', value: 3 },
            source: 'center',
          },
          solidFill: [{
            enabled: true,
            color: { r: 255, g: 0, b: 0 },
            opacity: 50,
          }],
          stroke: [{
            enabled: true,
            size: { units: 'Pixels', value: 4 },
            position: 'inside',
            opacity: 90,
            color: { r: 0, g: 255, b: 0 },
          }],
          gradientOverlay: [{
            enabled: true,
            opacity: 75,
            angle: 30,
            type: 'radial',
            reverse: true,
            scale: 130,
            gradient: {
              type: 'solid',
              name: 'test',
              colorStops: [
                { color: { r: 255, g: 0, b: 0 }, location: 0, midpoint: 50 },
                { color: { r: 0, g: 0, b: 255 }, location: 4096, midpoint: 50 },
              ],
              opacityStops: [
                { opacity: 100, location: 0, midpoint: 50 },
                { opacity: 100, location: 4096, midpoint: 50 },
              ],
            },
          }],
          bevel: {
            enabled: true,
            style: 'pillow emboss',
            strength: 220,
            direction: 'down',
            size: { units: 'Pixels', value: 11 },
            soften: { units: 'Pixels', value: 2 },
            angle: 110,
            altitude: 35,
            highlightColor: { r: 250, g: 250, b: 250 },
            shadowColor: { r: 5, g: 5, b: 5 },
            highlightOpacity: 60,
            shadowOpacity: 70,
          },
        },
      };

      const mapped = mapLayer(agLayer as never, null, defaultOptions, issues);
      expect(mapped.type).toBe('raster');
      expect(mapped.effects.map((e) => e.type)).toEqual(expect.arrayContaining([
        'drop-shadow',
        'inner-shadow',
        'outer-glow',
        'inner-glow',
        'stroke',
        'color-overlay',
        'gradient-overlay',
        'bevel-emboss',
      ]));

      const gradient = mapped.effects.find((e) => e.type === 'gradient-overlay');
      expect(gradient).toBeDefined();
      if (gradient?.type === 'gradient-overlay') {
        expect(gradient.gradientType).toBe('radial');
        expect(gradient.reverse).toBe(true);
      }

      const bevel = mapped.effects.find((e) => e.type === 'bevel-emboss');
      expect(bevel).toBeDefined();
      if (bevel?.type === 'bevel-emboss') {
        expect(bevel.style).toBe('pillow-emboss');
        expect(bevel.direction).toBe('down');
      }
    });

    it('should map unsupported gradient style to linear and report issue', () => {
      const issues: CompatibilityIssue[] = [];
      const agLayer = {
        name: 'Gradient Fallback',
        left: 0,
        top: 0,
        right: 10,
        bottom: 10,
        effects: {
          gradientOverlay: [{
            enabled: true,
            type: 'diamond',
            gradient: {
              type: 'solid',
              name: 'fallback',
              colorStops: [
                { color: { r: 255, g: 255, b: 255 }, location: 0, midpoint: 50 },
                { color: { r: 0, g: 0, b: 0 }, location: 4096, midpoint: 50 },
              ],
              opacityStops: [
                { opacity: 100, location: 0, midpoint: 50 },
                { opacity: 100, location: 4096, midpoint: 50 },
              ],
            },
          }],
        },
      };

      const mapped = mapLayer(agLayer as never, null, defaultOptions, issues);
      const gradient = mapped.effects.find((e) => e.type === 'gradient-overlay');
      expect(gradient).toBeDefined();
      if (gradient?.type === 'gradient-overlay') {
        expect(gradient.gradientType).toBe('linear');
      }
      expect(issues.some((i) => i.feature === 'gradient-overlay-style')).toBe(true);
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
