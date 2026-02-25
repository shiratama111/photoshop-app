import type { SegmentationProvider } from '@photoshop-app/types';
import * as ort from 'onnxruntime-web';
import {
  MobileSamProvider,
  type OnnxRuntime,
  type OnnxSession,
  type OnnxTensor,
} from './sam-provider';

export interface CreateSegmentationProviderOptions {
  runtime?: 'onnx';
  encoderModelPath?: string;
  decoderModelPath?: string;
}

const DEFAULT_ENCODER_MODEL_PATH = '/models/mobile_sam_encoder.onnx';
const DEFAULT_DECODER_MODEL_PATH = '/models/mobile_sam_decoder.onnx';

function createOnnxRuntime(): OnnxRuntime {
  return {
    async createSession(modelPath: string): Promise<OnnxSession> {
      const session = await ort.InferenceSession.create(modelPath);
      return {
        run: async (feeds: Record<string, OnnxTensor>): Promise<Record<string, OnnxTensor>> => {
          const outputs = await session.run(feeds as unknown as Record<string, ort.Tensor>);
          return outputs as unknown as Record<string, OnnxTensor>;
        },
        release: async (): Promise<void> => {
          const releasable = session as unknown as { release?: () => Promise<void> };
          if (typeof releasable.release === 'function') {
            await releasable.release();
          }
        },
      };
    },
    createTensor(type: string, data: Float32Array, dims: number[]): OnnxTensor {
      return new ort.Tensor(type as never, data, dims) as unknown as OnnxTensor;
    },
  };
}

export function createSegmentationProvider(
  options: CreateSegmentationProviderOptions = {},
): SegmentationProvider {
  const runtime = options.runtime ?? 'onnx';
  if (runtime !== 'onnx') {
    throw new Error(`Unsupported segmentation runtime: ${runtime}`);
  }

  return new MobileSamProvider({
    encoderModelPath: options.encoderModelPath ?? DEFAULT_ENCODER_MODEL_PATH,
    decoderModelPath: options.decoderModelPath ?? DEFAULT_DECODER_MODEL_PATH,
    onnx: createOnnxRuntime(),
  });
}
