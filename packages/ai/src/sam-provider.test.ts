import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { MobileSamProvider, type OnnxRuntime, type OnnxSession, type OnnxTensor } from './sam-provider';

// Polyfill ImageData for Node.js
beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as Record<string, unknown>).ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(widthOrData: number | Uint8ClampedArray, heightOrWidth: number, height?: number) {
        if (widthOrData instanceof Uint8ClampedArray) {
          this.data = widthOrData;
          this.width = heightOrWidth;
          this.height = height!;
        } else {
          this.width = widthOrData;
          this.height = heightOrWidth;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        }
      }
    };
  }
});

/** Create a mock ONNX runtime. */
function createMockOnnx(): OnnxRuntime {
  const mockSession: OnnxSession = {
    run: vi.fn().mockResolvedValue({
      image_embeddings: {
        data: new Float32Array(256 * 64 * 64),
        dims: [1, 256, 64, 64],
      },
      output: {
        data: new Float32Array(256 * 64 * 64),
        dims: [1, 256, 64, 64],
      },
      masks: {
        data: new Float32Array(256 * 256).fill(3), // positive logits
        dims: [1, 1, 256, 256],
      },
      iou_predictions: {
        data: new Float32Array([0.95]),
        dims: [1, 1],
      },
    }),
    release: vi.fn().mockResolvedValue(undefined),
  };

  return {
    createSession: vi.fn().mockResolvedValue(mockSession),
    createTensor: vi.fn((type: string, data: Float32Array, dims: number[]): OnnxTensor => ({
      data,
      dims,
    })),
  };
}

describe('MobileSamProvider', () => {
  let mockOnnx: OnnxRuntime;

  beforeEach(() => {
    mockOnnx = createMockOnnx();
  });

  describe('initialize', () => {
    it('should load encoder and decoder sessions', async () => {
      const provider = new MobileSamProvider({
        encoderModelPath: '/models/encoder.onnx',
        decoderModelPath: '/models/decoder.onnx',
        onnx: mockOnnx,
      });

      expect(provider.isReady).toBe(false);
      await provider.initialize();
      expect(provider.isReady).toBe(true);
      expect(mockOnnx.createSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('setImage', () => {
    it('should run encoder on image', async () => {
      const provider = new MobileSamProvider({
        encoderModelPath: '/models/encoder.onnx',
        decoderModelPath: '/models/decoder.onnx',
        onnx: mockOnnx,
      });

      await provider.initialize();

      const imageData = new ImageData(100, 80);
      await provider.setImage(imageData, { width: 100, height: 80 });

      // Encoder session.run should have been called
      const session = await mockOnnx.createSession('');
      expect(session.run).toHaveBeenCalled();
    });

    it('should throw if not initialized', async () => {
      const provider = new MobileSamProvider({
        encoderModelPath: '/models/encoder.onnx',
        decoderModelPath: '/models/decoder.onnx',
        onnx: mockOnnx,
      });

      const imageData = new ImageData(100, 80);
      await expect(
        provider.setImage(imageData, { width: 100, height: 80 }),
      ).rejects.toThrow('not initialized');
    });
  });

  describe('segment', () => {
    it('should produce a binary mask from point prompts', async () => {
      const provider = new MobileSamProvider({
        encoderModelPath: '/models/encoder.onnx',
        decoderModelPath: '/models/decoder.onnx',
        onnx: mockOnnx,
      });

      await provider.initialize();
      const imageData = new ImageData(100, 80);
      await provider.setImage(imageData, { width: 100, height: 80 });

      const mask = await provider.segment([
        { position: { x: 50, y: 40 }, label: 'positive' },
      ]);

      expect(mask.size.width).toBe(100);
      expect(mask.size.height).toBe(80);
      expect(mask.data.length).toBe(100 * 80);
      // All pixels should be foreground (logits are all positive=3)
      expect(mask.data[0]).toBe(255);
      expect(mask.confidence).toBeGreaterThan(0);
    });

    it('should handle multiple point prompts', async () => {
      const provider = new MobileSamProvider({
        encoderModelPath: '/models/encoder.onnx',
        decoderModelPath: '/models/decoder.onnx',
        onnx: mockOnnx,
      });

      await provider.initialize();
      const imageData = new ImageData(100, 80);
      await provider.setImage(imageData, { width: 100, height: 80 });

      const mask = await provider.segment([
        { position: { x: 50, y: 40 }, label: 'positive' },
        { position: { x: 10, y: 10 }, label: 'negative' },
      ]);

      expect(mask.data.length).toBe(100 * 80);
    });

    it('should throw if no image set', async () => {
      const provider = new MobileSamProvider({
        encoderModelPath: '/models/encoder.onnx',
        decoderModelPath: '/models/decoder.onnx',
        onnx: mockOnnx,
      });

      await provider.initialize();
      await expect(
        provider.segment([{ position: { x: 50, y: 40 }, label: 'positive' }]),
      ).rejects.toThrow('No image set');
    });
  });

  describe('dispose', () => {
    it('should release sessions', async () => {
      const provider = new MobileSamProvider({
        encoderModelPath: '/models/encoder.onnx',
        decoderModelPath: '/models/decoder.onnx',
        onnx: mockOnnx,
      });

      await provider.initialize();
      provider.dispose();

      expect(provider.isReady).toBe(false);
    });
  });
});
