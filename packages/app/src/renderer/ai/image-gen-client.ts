/**
 * @module ai/image-gen-client
 * ComfyUI / Stable Diffusion API client for AI background image generation.
 *
 * Provides a client that communicates with a local ComfyUI server to generate
 * background images for thumbnails. Designed for graceful degradation — if
 * ComfyUI is not running or encounters errors, all methods return null/false
 * instead of throwing.
 *
 * Main API:
 * - `isAvailable()` — health check for the ComfyUI server
 * - `generateBackground()` — queue a txt2img workflow and retrieve the result
 * - `buildPromptForTheme()` — auto-construct an SD prompt from theme + mood
 *
 * @see BATCH-001: AI画像生成統合・バッチ生成
 * @see {@link ./batch-generator.ts} — batch generation orchestrator (consumer)
 * @see {@link ./pipeline.ts} — E2E pipeline (potential future integration)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default ComfyUI server URL. */
const DEFAULT_BASE_URL = 'http://localhost:8188';

/** Timeout for health check requests in milliseconds. */
const HEALTH_CHECK_TIMEOUT_MS = 3000;

/** Timeout for image generation polling in milliseconds. */
const GENERATION_TIMEOUT_MS = 120_000;

/** Interval between status polls in milliseconds. */
const POLL_INTERVAL_MS = 1000;

/** Default checkpoint model to use in workflows. */
const DEFAULT_CHECKPOINT = 'sd_xl_base_1.0.safetensors';

/** Default sampler name. */
const DEFAULT_SAMPLER = 'euler';

/** Default scheduler. */
const DEFAULT_SCHEDULER = 'normal';

/** Default number of generation steps. */
const DEFAULT_STEPS = 20;

/** Default CFG scale. */
const DEFAULT_CFG = 7;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response from the ComfyUI /prompt endpoint. */
interface QueuePromptResponse {
  /** Unique ID for the queued prompt. */
  prompt_id: string;
}

/** A single output image entry from ComfyUI history. */
interface ComfyUIOutputImage {
  /** Filename of the generated image. */
  filename: string;
  /** Subfolder in the output directory. */
  subfolder: string;
  /** Output type (usually 'output'). */
  type: string;
}

/** History entry for a completed prompt. */
interface ComfyUIHistoryEntry {
  /** Output node results keyed by node ID. */
  outputs: Record<string, { images?: ComfyUIOutputImage[] }>;
}

/** Theme-to-prompt mapping entry. */
interface ThemePromptMapping {
  /** Keywords that describe the theme/mood. */
  keywords: readonly string[];
  /** SD prompt fragment for this theme. */
  promptFragment: string;
}

// ---------------------------------------------------------------------------
// Theme-to-Prompt Mappings
// ---------------------------------------------------------------------------

/**
 * Mapping from common thumbnail themes/moods to Stable Diffusion prompt fragments.
 * Used by `buildPromptForTheme()` to generate appropriate background prompts.
 */
const THEME_PROMPT_MAPPINGS: readonly ThemePromptMapping[] = [
  {
    keywords: ['urgent', 'breaking', 'news', 'alert', 'shocking'],
    promptFragment: 'dramatic red and black background, intense lighting, news broadcast style, high contrast',
  },
  {
    keywords: ['educational', 'howto', 'tutorial', 'guide', 'learn'],
    promptFragment: 'clean minimal background, soft blue gradient, professional, whiteboard style',
  },
  {
    keywords: ['casual', 'vlog', 'personal', 'daily', 'lifestyle'],
    promptFragment: 'warm sunset gradient, soft bokeh, cozy atmosphere, pastel colors',
  },
  {
    keywords: ['informative', 'product', 'review', 'unboxing'],
    promptFragment: 'clean studio background, soft lighting, product photography, neutral tones',
  },
  {
    keywords: ['exciting', 'gaming', 'esports', 'competitive'],
    promptFragment: 'neon glow background, dark purple and cyan, futuristic, digital art, gaming aesthetic',
  },
  {
    keywords: ['comparison', 'versus', 'battle', 'competitive'],
    promptFragment: 'split background red and blue, dramatic, versus battle, high energy',
  },
  {
    keywords: ['calm', 'peaceful', 'relaxing', 'nature'],
    promptFragment: 'serene nature landscape, soft light, peaceful, green and blue tones',
  },
  {
    keywords: ['dark', 'mysterious', 'horror', 'thriller'],
    promptFragment: 'dark moody background, fog, mysterious, dramatic shadows, cinematic',
  },
  {
    keywords: ['colorful', 'vibrant', 'fun', 'party', 'celebration'],
    promptFragment: 'colorful confetti, vibrant gradient, celebration, pop art style, bright',
  },
  {
    keywords: ['minimal', 'clean', 'simple', 'modern'],
    promptFragment: 'minimalist flat background, single color gradient, modern design, clean',
  },
] as const;

/** Default prompt fragment when no theme matches. */
const DEFAULT_PROMPT_FRAGMENT = 'abstract colorful background, digital art, high quality, 4k';

/** Negative prompt applied to all generations for quality. */
const DEFAULT_NEGATIVE_PROMPT =
  'text, watermark, logo, signature, blurry, low quality, distorted, deformed, ugly, nsfw';

// ---------------------------------------------------------------------------
// ComfyUI txt2img Workflow Builder
// ---------------------------------------------------------------------------

/**
 * Build a ComfyUI API workflow JSON for txt2img generation.
 *
 * The workflow contains:
 * - KSampler node for denoising
 * - CheckpointLoaderSimple for the model
 * - CLIPTextEncode nodes for positive and negative prompts
 * - EmptyLatentImage for canvas dimensions
 * - VAEDecode for latent-to-pixel conversion
 * - SaveImage for output
 *
 * @param prompt - Positive text prompt.
 * @param negativePrompt - Negative text prompt.
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @param seed - Random seed (defaults to random).
 * @returns A ComfyUI API-compatible workflow object.
 */
function buildTxt2ImgWorkflow(
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number,
  seed?: number,
): Record<string, unknown> {
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 32);

  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: DEFAULT_CHECKPOINT,
      },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: prompt,
        clip: ['1', 1],
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: negativePrompt,
        clip: ['1', 1],
      },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width,
        height,
        batch_size: 1,
      },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed: actualSeed,
        steps: DEFAULT_STEPS,
        cfg: DEFAULT_CFG,
        sampler_name: DEFAULT_SAMPLER,
        scheduler: DEFAULT_SCHEDULER,
        denoise: 1.0,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'thumbnail_bg',
        images: ['6', 0],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// ComfyUIClient
// ---------------------------------------------------------------------------

/**
 * Client for communicating with a local ComfyUI server.
 *
 * All methods handle errors gracefully and return null/false on failure,
 * allowing the application to continue without AI-generated backgrounds.
 *
 * @example
 * ```ts
 * const client = new ComfyUIClient();
 * if (await client.isAvailable()) {
 *   const prompt = client.buildPromptForTheme('gaming', 'exciting');
 *   const imageData = await client.generateBackground(prompt, 1280, 720);
 *   if (imageData) {
 *     // Use imageData as a background layer
 *   }
 * }
 * ```
 */
export class ComfyUIClient {
  /** Base URL of the ComfyUI server. */
  private readonly baseUrl: string;

  /**
   * Create a new ComfyUI client.
   * @param baseUrl - URL of the ComfyUI server. Defaults to `http://localhost:8188`.
   */
  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  /**
   * Check whether the ComfyUI server is reachable and healthy.
   *
   * Sends a GET request to the `/system_stats` endpoint with a short timeout.
   * Returns false on any error (network unreachable, timeout, non-200 status).
   *
   * @returns `true` if the server responded successfully, `false` otherwise.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/system_stats`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate a background image using ComfyUI's txt2img pipeline.
   *
   * The flow:
   * 1. Queue a txt2img workflow via POST /prompt
   * 2. Poll GET /history/{prompt_id} until completion or timeout
   * 3. Download the resulting image via GET /view
   * 4. Return the image as a Uint8Array
   *
   * Returns null on any error (server unavailable, generation timeout, etc.).
   *
   * @param prompt - Positive text prompt for image generation.
   * @param width - Target image width in pixels.
   * @param height - Target image height in pixels.
   * @returns The generated image as a Uint8Array, or null on failure.
   */
  async generateBackground(
    prompt: string,
    width: number,
    height: number,
  ): Promise<Uint8Array | null> {
    try {
      // 1. Queue the workflow
      const promptId = await this.queuePrompt(prompt, width, height);
      if (!promptId) {
        return null;
      }

      // 2. Poll for completion
      const outputImage = await this.pollForCompletion(promptId);
      if (!outputImage) {
        return null;
      }

      // 3. Download the result image
      return await this.downloadImage(outputImage);
    } catch {
      return null;
    }
  }

  /**
   * Build a Stable Diffusion prompt string from a thumbnail theme and mood.
   *
   * Matches the theme and mood against known prompt fragments and combines
   * them into a well-structured generation prompt.
   *
   * @param theme - Thumbnail theme (e.g. 'news', 'gaming', 'vlog').
   * @param mood - Emotional mood (e.g. 'urgent', 'exciting', 'calm').
   * @returns A formatted prompt string suitable for Stable Diffusion.
   */
  buildPromptForTheme(theme: string, mood: string): string {
    const combined = `${theme} ${mood}`.toLowerCase();
    const matchedFragments: string[] = [];

    for (const mapping of THEME_PROMPT_MAPPINGS) {
      for (const keyword of mapping.keywords) {
        if (combined.includes(keyword)) {
          matchedFragments.push(mapping.promptFragment);
          break;
        }
      }
    }

    if (matchedFragments.length === 0) {
      return `${DEFAULT_PROMPT_FRAGMENT}, ${theme}, ${mood}`;
    }

    // Deduplicate and combine
    const uniqueFragments = [...new Set(matchedFragments)];
    return `${uniqueFragments.join(', ')}, masterpiece, best quality, 4k`;
  }

  // -------------------------------------------------------------------------
  // Private: Queue Prompt
  // -------------------------------------------------------------------------

  /**
   * Queue a txt2img workflow on the ComfyUI server.
   * @param prompt - Positive prompt text.
   * @param width - Image width.
   * @param height - Image height.
   * @returns The prompt ID if successful, or null on error.
   */
  private async queuePrompt(
    prompt: string,
    width: number,
    height: number,
  ): Promise<string | null> {
    try {
      const workflow = buildTxt2ImgWorkflow(prompt, DEFAULT_NEGATIVE_PROMPT, width, height);

      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as QueuePromptResponse;
      return data.prompt_id ?? null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Private: Poll for Completion
  // -------------------------------------------------------------------------

  /**
   * Poll the ComfyUI history endpoint until the prompt completes or times out.
   * @param promptId - The prompt ID to poll.
   * @returns The first output image info, or null on timeout/error.
   */
  private async pollForCompletion(promptId: string): Promise<ComfyUIOutputImage | null> {
    const deadline = Date.now() + GENERATION_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${this.baseUrl}/history/${promptId}`);
        if (!response.ok) {
          await this.sleep(POLL_INTERVAL_MS);
          continue;
        }

        const history = (await response.json()) as Record<string, ComfyUIHistoryEntry>;
        const entry = history[promptId];

        if (entry) {
          // Find the first output image across all output nodes
          for (const nodeOutput of Object.values(entry.outputs)) {
            if (nodeOutput.images && nodeOutput.images.length > 0) {
              return nodeOutput.images[0];
            }
          }
        }
      } catch {
        // Network error during poll — continue trying
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    // Timeout
    return null;
  }

  // -------------------------------------------------------------------------
  // Private: Download Image
  // -------------------------------------------------------------------------

  /**
   * Download a generated image from the ComfyUI server.
   * @param image - The output image metadata.
   * @returns The image data as a Uint8Array, or null on error.
   */
  private async downloadImage(image: ComfyUIOutputImage): Promise<Uint8Array | null> {
    try {
      const params = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder,
        type: image.type,
      });

      const response = await fetch(`${this.baseUrl}/view?${params.toString()}`);
      if (!response.ok) {
        return null;
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Private: Utility
  // -------------------------------------------------------------------------

  /**
   * Sleep for the specified number of milliseconds.
   * @param ms - Duration in milliseconds.
   * @returns A promise that resolves after the delay.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

// ---------------------------------------------------------------------------
// Exported Utilities
// ---------------------------------------------------------------------------

/**
 * Get the default negative prompt used for all generations.
 * Exposed for testing and external configuration.
 *
 * @returns The default negative prompt string.
 */
export function getDefaultNegativePrompt(): string {
  return DEFAULT_NEGATIVE_PROMPT;
}

/**
 * Build a txt2img workflow for testing or external use.
 * Delegates to the internal workflow builder.
 *
 * @param prompt - Positive text prompt.
 * @param negativePrompt - Negative text prompt.
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @param seed - Optional random seed.
 * @returns A ComfyUI API-compatible workflow object.
 */
export function buildWorkflow(
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number,
  seed?: number,
): Record<string, unknown> {
  return buildTxt2ImgWorkflow(prompt, negativePrompt, width, height, seed);
}
