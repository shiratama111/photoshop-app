/**
 * @module sam-provider
 * Mobile SAM segmentation provider using ONNX Runtime Web.
 *
 * Architecture:
 * - Encoder: Runs once per image (1024x1024 RGB → image embeddings)
 * - Decoder: Runs per click (point prompts + embeddings → mask logits)
 *
 * Model files required:
 * - `mobile_sam_encoder.onnx` — Image encoder (ViT-tiny)
 * - `mobile_sam_decoder.onnx` — Prompt decoder + mask head
 *
 * @see {@link @photoshop-app/types!SegmentationProvider}
 */

import type { Mask, PointPrompt, SegmentationProvider, Size } from '@photoshop-app/types';
import {
  preprocessImage,
  createPointTensors,
  postprocessMask,
  calculateConfidence,
  SAM_INPUT_SIZE,
} from './image-utils';

/** ONNX Runtime session interface (duck-typed for testability). */
export interface OnnxSession {
  run(feeds: Record<string, OnnxTensor>): Promise<Record<string, OnnxTensor>>;
  release(): Promise<void>;
}

/** ONNX tensor interface. */
export interface OnnxTensor {
  data: Float32Array;
  dims: number[];
}

/** Factory for creating ONNX sessions and tensors. */
export interface OnnxRuntime {
  createSession(modelPath: string): Promise<OnnxSession>;
  createTensor(type: string, data: Float32Array, dims: number[]): OnnxTensor;
}

/** Configuration for the SAM provider. */
export interface SamProviderConfig {
  /** Path to the encoder ONNX model. */
  encoderModelPath: string;
  /** Path to the decoder ONNX model. */
  decoderModelPath: string;
  /** ONNX Runtime implementation. */
  onnx: OnnxRuntime;
}

/**
 * Mobile SAM segmentation provider.
 *
 * Usage:
 * ```ts
 * const provider = new MobileSamProvider(config);
 * await provider.initialize();
 * await provider.setImage(imageData, { width: 800, height: 600 });
 * const mask = await provider.segment([
 *   { position: { x: 400, y: 300 }, label: 'positive' }
 * ]);
 * ```
 */
export class MobileSamProvider implements SegmentationProvider {
  private config: SamProviderConfig;
  private encoderSession: OnnxSession | null = null;
  private decoderSession: OnnxSession | null = null;
  private imageEmbedding: OnnxTensor | null = null;
  private currentSize: Size | null = null;
  private resizedSize: Size | null = null;
  private _isReady = false;

  constructor(config: SamProviderConfig) {
    this.config = config;
  }

  get isReady(): boolean {
    return this._isReady;
  }

  /** Load encoder and decoder ONNX models. */
  async initialize(): Promise<void> {
    const { onnx, encoderModelPath, decoderModelPath } = this.config;

    this.encoderSession = await onnx.createSession(encoderModelPath);
    this.decoderSession = await onnx.createSession(decoderModelPath);
    this._isReady = true;
  }

  /**
   * Set the image and run the encoder to produce embeddings.
   * This is the expensive operation — called once per image.
   */
  async setImage(imageData: ImageData, size: Size): Promise<void> {
    if (!this.encoderSession) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }

    const { tensor, resizedSize } = preprocessImage(
      imageData.data as Uint8ClampedArray,
      size,
    );

    this.currentSize = { ...size };
    this.resizedSize = { ...resizedSize };

    // Run encoder: [1, 3, 1024, 1024] → image_embeddings
    const inputTensor = this.config.onnx.createTensor(
      'float32',
      tensor,
      [1, 3, SAM_INPUT_SIZE, SAM_INPUT_SIZE],
    );

    const encoderResult = await this.encoderSession.run({
      image: inputTensor,
    });

    this.imageEmbedding = encoderResult['image_embeddings'] ?? encoderResult['output'];
  }

  /**
   * Generate a segmentation mask from point prompts.
   * Uses cached image embeddings from setImage().
   */
  async segment(prompts: PointPrompt[]): Promise<Mask> {
    if (!this.decoderSession || !this.imageEmbedding || !this.currentSize || !this.resizedSize) {
      throw new Error('No image set. Call setImage() first.');
    }

    const points = prompts.map((p) => ({
      x: p.position.x,
      y: p.position.y,
      label: p.label,
    }));

    const { coords, labels } = createPointTensors(points, this.currentSize, this.resizedSize);
    const { onnx } = this.config;

    // Prepare decoder inputs
    const feeds: Record<string, OnnxTensor> = {
      image_embeddings: this.imageEmbedding,
      point_coords: onnx.createTensor('float32', coords, [1, points.length, 2]),
      point_labels: onnx.createTensor('float32', labels, [1, points.length]),
      has_mask_input: onnx.createTensor('float32', new Float32Array([0]), [1]),
      mask_input: onnx.createTensor(
        'float32',
        new Float32Array(256 * 256),
        [1, 1, 256, 256],
      ),
      orig_im_size: onnx.createTensor(
        'float32',
        new Float32Array([this.currentSize.height, this.currentSize.width]),
        [2],
      ),
    };

    const result = await this.decoderSession.run(feeds);

    // Extract best mask from output
    const masksKey = Object.keys(result).find((k) => k.includes('mask')) ?? Object.keys(result)[0];
    const scoresKey = Object.keys(result).find((k) => k.includes('score'));

    const maskLogits = result[masksKey].data;
    const maskDims = result[masksKey].dims;
    const maskHeight = maskDims[maskDims.length - 2];
    const maskWidth = maskDims[maskDims.length - 1];

    // Post-process: sigmoid + threshold + resize to original
    const binaryMask = postprocessMask(
      maskLogits,
      { width: maskWidth, height: maskHeight },
      this.currentSize,
    );

    // Calculate confidence
    let confidence = calculateConfidence(maskLogits);
    if (scoresKey && result[scoresKey]) {
      // Use model's own score if available
      const scores = result[scoresKey].data;
      confidence = scores[0] ?? confidence;
    }

    return {
      data: binaryMask,
      size: { ...this.currentSize },
      confidence,
    };
  }

  /** Release ONNX sessions. */
  dispose(): void {
    if (this.encoderSession) {
      void this.encoderSession.release();
      this.encoderSession = null;
    }
    if (this.decoderSession) {
      void this.decoderSession.release();
      this.decoderSession = null;
    }
    this.imageEmbedding = null;
    this.currentSize = null;
    this.resizedSize = null;
    this._isReady = false;
  }
}
