import { describe, it, expect } from 'vitest';
import { ViewportImpl } from './viewport';

describe('ViewportImpl', () => {
  describe('constructor', () => {
    it('should initialize with default values', () => {
      const vp = new ViewportImpl();
      expect(vp.zoom).toBe(1);
      expect(vp.offset).toEqual({ x: 0, y: 0 });
    });

    it('should accept custom viewport size', () => {
      const vp = new ViewportImpl({ width: 1920, height: 1080 });
      expect(vp.zoom).toBe(1);
      expect(vp.visibleArea.width).toBe(1920);
      expect(vp.visibleArea.height).toBe(1080);
    });
  });

  describe('setZoom', () => {
    it('should set zoom within valid range', () => {
      const vp = new ViewportImpl();
      vp.setZoom(2);
      expect(vp.zoom).toBe(2);
    });

    it('should clamp zoom to minimum (0.01)', () => {
      const vp = new ViewportImpl();
      vp.setZoom(0.001);
      expect(vp.zoom).toBe(0.01);
    });

    it('should clamp zoom to maximum (64)', () => {
      const vp = new ViewportImpl();
      vp.setZoom(100);
      expect(vp.zoom).toBe(64);
    });

    it('should maintain anchor point when zooming', () => {
      const vp = new ViewportImpl({ width: 800, height: 600 });
      const anchor = { x: 400, y: 300 };

      // Document point under anchor at zoom=1, offset=0 is (400, 300)
      const docBefore = vp.screenToDocument(anchor);
      vp.setZoom(2, anchor);
      const docAfter = vp.screenToDocument(anchor);

      // The document point under the anchor should remain the same
      expect(docAfter.x).toBeCloseTo(docBefore.x, 10);
      expect(docAfter.y).toBeCloseTo(docBefore.y, 10);
    });

    it('should maintain anchor point for zoom-out', () => {
      const vp = new ViewportImpl({ width: 800, height: 600 });
      vp.setZoom(4);
      const anchor = { x: 200, y: 150 };
      const docBefore = vp.screenToDocument(anchor);

      vp.setZoom(0.5, anchor);
      const docAfter = vp.screenToDocument(anchor);

      expect(docAfter.x).toBeCloseTo(docBefore.x, 10);
      expect(docAfter.y).toBeCloseTo(docBefore.y, 10);
    });
  });

  describe('setOffset', () => {
    it('should set the pan offset', () => {
      const vp = new ViewportImpl();
      vp.setOffset({ x: 100, y: -50 });
      expect(vp.offset).toEqual({ x: 100, y: -50 });
    });

    it('should return a copy of offset (not a reference)', () => {
      const vp = new ViewportImpl();
      vp.setOffset({ x: 10, y: 20 });
      const offset = vp.offset;
      offset.x = 999;
      expect(vp.offset.x).toBe(10);
    });
  });

  describe('screenToDocument / documentToScreen', () => {
    it('should be identity at zoom=1, offset=(0,0)', () => {
      const vp = new ViewportImpl();
      const screen = { x: 150, y: 200 };
      const doc = vp.screenToDocument(screen);
      expect(doc).toEqual({ x: 150, y: 200 });
    });

    it('should scale by zoom factor', () => {
      const vp = new ViewportImpl();
      vp.setZoom(2);
      const doc = vp.screenToDocument({ x: 200, y: 100 });
      expect(doc).toEqual({ x: 100, y: 50 });
    });

    it('should account for offset', () => {
      const vp = new ViewportImpl();
      vp.setOffset({ x: 50, y: 100 });
      const doc = vp.screenToDocument({ x: 150, y: 200 });
      expect(doc).toEqual({ x: 100, y: 100 });
    });

    it('should account for zoom and offset together', () => {
      const vp = new ViewportImpl();
      vp.setZoom(4);
      vp.setOffset({ x: 40, y: 80 });
      // doc = (screen - offset) / zoom = (200-40)/4, (160-80)/4 = 40, 20
      const doc = vp.screenToDocument({ x: 200, y: 160 });
      expect(doc).toEqual({ x: 40, y: 20 });
    });

    it('should roundtrip screen → document → screen', () => {
      const vp = new ViewportImpl();
      vp.setZoom(3.7);
      vp.setOffset({ x: -123, y: 456 });

      const original = { x: 333, y: 222 };
      const doc = vp.screenToDocument(original);
      const back = vp.documentToScreen(doc);

      expect(back.x).toBeCloseTo(original.x, 10);
      expect(back.y).toBeCloseTo(original.y, 10);
    });

    it('should roundtrip document → screen → document', () => {
      const vp = new ViewportImpl();
      vp.setZoom(0.25);
      vp.setOffset({ x: 50, y: -80 });

      const original = { x: 1000, y: 2000 };
      const screen = vp.documentToScreen(original);
      const back = vp.screenToDocument(screen);

      expect(back.x).toBeCloseTo(original.x, 10);
      expect(back.y).toBeCloseTo(original.y, 10);
    });
  });

  describe('visibleArea', () => {
    it('should return full viewport at zoom=1, offset=(0,0)', () => {
      const vp = new ViewportImpl({ width: 800, height: 600 });
      const area = vp.visibleArea;
      expect(area.x).toBe(0);
      expect(area.y).toBe(0);
      expect(area.width).toBe(800);
      expect(area.height).toBe(600);
    });

    it('should shrink visible area when zoomed in', () => {
      const vp = new ViewportImpl({ width: 800, height: 600 });
      vp.setZoom(2);
      const area = vp.visibleArea;
      expect(area.width).toBe(400);
      expect(area.height).toBe(300);
    });

    it('should expand visible area when zoomed out', () => {
      const vp = new ViewportImpl({ width: 800, height: 600 });
      vp.setZoom(0.5);
      const area = vp.visibleArea;
      expect(area.width).toBe(1600);
      expect(area.height).toBe(1200);
    });

    it('should shift visible area with offset', () => {
      const vp = new ViewportImpl({ width: 800, height: 600 });
      vp.setOffset({ x: -200, y: -100 });
      const area = vp.visibleArea;
      expect(area.x).toBe(200);
      expect(area.y).toBe(100);
      expect(area.width).toBe(800);
      expect(area.height).toBe(600);
    });
  });

  describe('fitToWindow', () => {
    it('should fit a landscape document', () => {
      const vp = new ViewportImpl();
      vp.fitToWindow({ width: 800, height: 600 }, { width: 1600, height: 900 });
      // scaleX = 800/1600 = 0.5, scaleY = 600/900 = 0.667 → use 0.5
      expect(vp.zoom).toBeCloseTo(0.5, 5);
      // Centered: offset.x = (800 - 1600*0.5)/2 = 0
      expect(vp.offset.x).toBeCloseTo(0, 5);
      // offset.y = (600 - 900*0.5)/2 = 75
      expect(vp.offset.y).toBeCloseTo(75, 5);
    });

    it('should fit a portrait document', () => {
      const vp = new ViewportImpl();
      vp.fitToWindow({ width: 800, height: 600 }, { width: 400, height: 1200 });
      // scaleX = 800/400 = 2, scaleY = 600/1200 = 0.5 → use 0.5
      expect(vp.zoom).toBeCloseTo(0.5, 5);
      // offset.x = (800 - 400*0.5)/2 = 300
      expect(vp.offset.x).toBeCloseTo(300, 5);
      // offset.y = (600 - 1200*0.5)/2 = 0
      expect(vp.offset.y).toBeCloseTo(0, 5);
    });

    it('should center a small document that fits entirely', () => {
      const vp = new ViewportImpl();
      vp.fitToWindow({ width: 800, height: 600 }, { width: 200, height: 100 });
      // scaleX = 4, scaleY = 6 → use 4
      expect(vp.zoom).toBe(4);
      // offset.x = (800 - 200*4)/2 = 0
      expect(vp.offset.x).toBeCloseTo(0, 5);
      // offset.y = (600 - 100*4)/2 = 100
      expect(vp.offset.y).toBeCloseTo(100, 5);
    });
  });

  describe('zoomToActual', () => {
    it('should set zoom to 1 and center the document', () => {
      const vp = new ViewportImpl();
      vp.setZoom(5);
      vp.zoomToActual({ width: 800, height: 600 }, { width: 400, height: 300 });
      expect(vp.zoom).toBe(1);
      expect(vp.offset.x).toBeCloseTo(200, 5);
      expect(vp.offset.y).toBeCloseTo(150, 5);
    });

    it('should center document larger than viewport', () => {
      const vp = new ViewportImpl();
      vp.zoomToActual({ width: 800, height: 600 }, { width: 1600, height: 1200 });
      expect(vp.zoom).toBe(1);
      // Centered → negative offsets
      expect(vp.offset.x).toBeCloseTo(-400, 5);
      expect(vp.offset.y).toBeCloseTo(-300, 5);
    });
  });

  describe('setViewportSize', () => {
    it('should update visible area after resize', () => {
      const vp = new ViewportImpl({ width: 800, height: 600 });
      vp.setViewportSize({ width: 1920, height: 1080 });
      const area = vp.visibleArea;
      expect(area.width).toBe(1920);
      expect(area.height).toBe(1080);
    });
  });
});
