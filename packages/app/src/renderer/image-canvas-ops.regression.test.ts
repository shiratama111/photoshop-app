import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './store';
import type { RasterLayer } from '@photoshop-app/types';

if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as Record<string, unknown>).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, maybeHeight?: number) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
        return;
      }
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = maybeHeight ?? 0;
    }
  };
}

function resetStore(): void {
  useAppStore.setState({
    document: null,
    activeTool: 'select',
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    statusMessage: 'Ready',
    showAbout: false,
    selectedLayerId: null,
    canUndo: false,
    canRedo: false,
    revision: 0,
    contextMenu: null,
  });
}

function getBackgroundLayer(): RasterLayer {
  const doc = useAppStore.getState().document!;
  return doc.rootGroup.children[0] as RasterLayer;
}

function setPixel(imageData: ImageData, x: number, y: number, value: number): void {
  const idx = (y * imageData.width + x) * 4;
  imageData.data[idx] = value;
  imageData.data[idx + 1] = value;
  imageData.data[idx + 2] = value;
  imageData.data[idx + 3] = 255;
}

function getPixel(imageData: ImageData, x: number, y: number): number {
  return imageData.data[(y * imageData.width + x) * 4];
}

describe('image/canvas operation regressions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('resizeDocument(image) rescales raster content and bounds', () => {
    useAppStore.getState().newDocument('Test', 4, 2);
    const bg = getBackgroundLayer();
    if (!bg.imageData) throw new Error('background imageData missing');

    setPixel(bg.imageData, 0, 0, 10);
    setPixel(bg.imageData, 3, 1, 200);

    useAppStore.getState().resizeDocument(2, 1, { mode: 'image' });

    const doc = useAppStore.getState().document!;
    expect(doc.canvas.size).toEqual({ width: 2, height: 1 });
    expect(bg.bounds.width).toBe(2);
    expect(bg.bounds.height).toBe(1);
    expect(bg.imageData?.width).toBe(2);
    expect(bg.imageData?.height).toBe(1);
  });

  it('resizeDocument(canvas) applies anchor offset to layer positions', () => {
    useAppStore.getState().newDocument('Test', 10, 10);
    useAppStore.getState().addRasterLayer('L1');
    const doc = useAppStore.getState().document!;
    const layer = doc.rootGroup.children[1] as RasterLayer;
    layer.position = { x: 2, y: 3 };

    useAppStore.getState().resizeDocument(14, 14, { mode: 'canvas', anchor: 'center' });

    expect(doc.canvas.size).toEqual({ width: 14, height: 14 });
    expect(layer.position).toEqual({ x: 4, y: 5 });
  });

  it('rotateCanvas(90cw) rotates raster imageData instead of only canvas size', () => {
    useAppStore.getState().newDocument('Test', 3, 2);
    const bg = getBackgroundLayer();
    if (!bg.imageData) throw new Error('background imageData missing');

    setPixel(bg.imageData, 0, 0, 11);
    setPixel(bg.imageData, 2, 1, 99);

    useAppStore.getState().rotateCanvas('90cw');

    const doc = useAppStore.getState().document!;
    expect(doc.canvas.size).toEqual({ width: 2, height: 3 });
    expect(bg.bounds.width).toBe(2);
    expect(bg.bounds.height).toBe(3);
    expect(bg.imageData?.width).toBe(2);
    expect(bg.imageData?.height).toBe(3);
    expect(getPixel(bg.imageData!, 1, 0)).toBe(11);
    expect(getPixel(bg.imageData!, 0, 2)).toBe(99);
  });
});
