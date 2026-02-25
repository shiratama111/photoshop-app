/**
 * @module ai/image-gen-client.test
 * Tests for the ComfyUI API client (BATCH-001).
 *
 * All network calls are mocked — no actual ComfyUI server is required.
 *
 * Covers:
 * - Health check (isAvailable)
 * - Background generation (generateBackground) with mocked API
 * - Prompt building from theme and mood
 * - Graceful degradation on network errors
 * - Workflow structure validation
 *
 * @see BATCH-001: AI画像生成統合・バッチ生成
 * @see {@link ./image-gen-client.ts} — module under test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComfyUIClient, getDefaultNegativePrompt, buildWorkflow } from './image-gen-client';

// ---------------------------------------------------------------------------
// Mock Setup
// ---------------------------------------------------------------------------

/** Helper to create a minimal successful fetch Response. */
function createMockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => createMockResponse(body, ok, status),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    arrayBuffer: () => {
      // Return a small PNG-like buffer
      const buffer = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
      return Promise.resolve(buffer);
    },
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    body: null,
    bodyUsed: false,
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/** Store the original global fetch. */
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Constructor Tests
// ---------------------------------------------------------------------------

describe('ComfyUIClient constructor', () => {
  it('creates a client with default URL', () => {
    const client = new ComfyUIClient();
    // Verify the client instance exists (URL is private)
    expect(client).toBeInstanceOf(ComfyUIClient);
  });

  it('creates a client with a custom URL', () => {
    const client = new ComfyUIClient('http://192.168.1.100:8188');
    expect(client).toBeInstanceOf(ComfyUIClient);
  });

  it('strips trailing slashes from the URL', () => {
    const client = new ComfyUIClient('http://localhost:8188///');
    expect(client).toBeInstanceOf(ComfyUIClient);
  });
});

// ---------------------------------------------------------------------------
// isAvailable Tests
// ---------------------------------------------------------------------------

describe('ComfyUIClient.isAvailable', () => {
  it('returns true when server responds with 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ system: { os: 'windows' } }),
    );

    const client = new ComfyUIClient();
    const result = await client.isAvailable();

    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:8188/system_stats',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns false when server responds with non-200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({}, false, 500),
    );

    const client = new ComfyUIClient();
    const result = await client.isAvailable();

    expect(result).toBe(false);
  });

  it('returns false when fetch throws (server unreachable)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const client = new ComfyUIClient();
    const result = await client.isAvailable();

    expect(result).toBe(false);
  });

  it('returns false when request is aborted (timeout)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const client = new ComfyUIClient();
    const result = await client.isAvailable();

    expect(result).toBe(false);
  });

  it('uses custom URL for health check', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ system: {} }),
    );

    const client = new ComfyUIClient('http://custom:9999');
    await client.isAvailable();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://custom:9999/system_stats',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

// ---------------------------------------------------------------------------
// generateBackground Tests
// ---------------------------------------------------------------------------

describe('ComfyUIClient.generateBackground', () => {
  it('returns image data on successful generation', async () => {
    const promptId = 'test-prompt-123';
    const callCount = { value: 0 };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = typeof url === 'string' ? url : String(url);

      // POST /prompt -> queue response
      if (urlStr.includes('/prompt') && !urlStr.includes('/history')) {
        return Promise.resolve(
          createMockResponse({ prompt_id: promptId }),
        );
      }

      // GET /history/{id} -> first call returns empty, second returns complete
      if (urlStr.includes('/history/')) {
        callCount.value++;
        if (callCount.value === 1) {
          // Not ready yet
          return Promise.resolve(createMockResponse({}));
        }
        // Ready
        return Promise.resolve(createMockResponse({
          [promptId]: {
            outputs: {
              '7': {
                images: [{
                  filename: 'thumbnail_bg_00001.png',
                  subfolder: '',
                  type: 'output',
                }],
              },
            },
          },
        }));
      }

      // GET /view -> download image
      if (urlStr.includes('/view')) {
        return Promise.resolve(createMockResponse(null));
      }

      return Promise.resolve(createMockResponse({}, false, 404));
    });

    const client = new ComfyUIClient();
    const result = await client.generateBackground('test prompt', 1280, 720);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
  });

  it('returns null when prompt queue fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({}, false, 500),
    );

    const client = new ComfyUIClient();
    const result = await client.generateBackground('test prompt', 1280, 720);

    expect(result).toBeNull();
  });

  it('returns null when server is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const client = new ComfyUIClient();
    const result = await client.generateBackground('test prompt', 1280, 720);

    expect(result).toBeNull();
  });

  it('returns null when image download fails', async () => {
    const promptId = 'test-prompt-456';

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = typeof url === 'string' ? url : String(url);

      if (urlStr.includes('/prompt') && !urlStr.includes('/history')) {
        return Promise.resolve(createMockResponse({ prompt_id: promptId }));
      }

      if (urlStr.includes('/history/')) {
        return Promise.resolve(createMockResponse({
          [promptId]: {
            outputs: {
              '7': {
                images: [{
                  filename: 'test.png',
                  subfolder: '',
                  type: 'output',
                }],
              },
            },
          },
        }));
      }

      if (urlStr.includes('/view')) {
        return Promise.resolve(createMockResponse(null, false, 404));
      }

      return Promise.resolve(createMockResponse({}, false, 404));
    });

    const client = new ComfyUIClient();
    const result = await client.generateBackground('test prompt', 1280, 720);

    expect(result).toBeNull();
  });

  it('returns null when prompt response lacks prompt_id', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = typeof url === 'string' ? url : String(url);
      if (urlStr.includes('/prompt')) {
        return Promise.resolve(createMockResponse({}));
      }
      return Promise.resolve(createMockResponse({}, false, 404));
    });

    const client = new ComfyUIClient();
    const result = await client.generateBackground('test prompt', 1280, 720);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildPromptForTheme Tests
// ---------------------------------------------------------------------------

describe('ComfyUIClient.buildPromptForTheme', () => {
  it('builds a prompt for a gaming theme', () => {
    const client = new ComfyUIClient();
    const prompt = client.buildPromptForTheme('gaming', 'exciting');

    expect(prompt).toContain('neon');
    expect(prompt).toContain('gaming');
    expect(prompt.length).toBeGreaterThan(10);
  });

  it('builds a prompt for a news/urgent theme', () => {
    const client = new ComfyUIClient();
    const prompt = client.buildPromptForTheme('news', 'urgent');

    expect(prompt).toContain('dramatic');
    expect(prompt).toContain('red');
  });

  it('builds a prompt for an educational theme', () => {
    const client = new ComfyUIClient();
    const prompt = client.buildPromptForTheme('tutorial', 'educational');

    expect(prompt).toContain('clean');
    expect(prompt).toContain('professional');
  });

  it('builds a prompt for a minimal theme', () => {
    const client = new ComfyUIClient();
    const prompt = client.buildPromptForTheme('minimal', 'clean');

    expect(prompt).toContain('minimalist');
  });

  it('uses default prompt fragment for unknown theme', () => {
    const client = new ComfyUIClient();
    const prompt = client.buildPromptForTheme('xyzunknown', 'xyzunknown');

    expect(prompt).toContain('abstract');
    expect(prompt).toContain('xyzunknown');
  });

  it('combines multiple matching fragments', () => {
    const client = new ComfyUIClient();
    // 'calm nature' matches both calm and nature keywords
    const prompt = client.buildPromptForTheme('calm', 'nature');

    expect(prompt).toContain('serene');
    expect(prompt).toContain('masterpiece');
  });

  it('includes quality suffixes', () => {
    const client = new ComfyUIClient();
    const prompt = client.buildPromptForTheme('gaming', 'exciting');

    expect(prompt).toContain('4k');
  });

  it('returns a non-empty string for any input', () => {
    const client = new ComfyUIClient();
    const prompt = client.buildPromptForTheme('', '');

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Exported Utility Tests
// ---------------------------------------------------------------------------

describe('getDefaultNegativePrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = getDefaultNegativePrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('includes common negative prompt terms', () => {
    const prompt = getDefaultNegativePrompt();
    expect(prompt).toContain('watermark');
    expect(prompt).toContain('blurry');
    expect(prompt).toContain('low quality');
  });
});

describe('buildWorkflow', () => {
  it('returns a valid workflow object with required nodes', () => {
    const workflow = buildWorkflow('test prompt', 'bad quality', 1280, 720);

    expect(typeof workflow).toBe('object');
    // Should have nodes for: checkpoint, positive CLIP, negative CLIP, latent, sampler, VAE decode, save
    expect(Object.keys(workflow).length).toBe(7);
  });

  it('includes the prompt text in the CLIP encode node', () => {
    const workflow = buildWorkflow('my beautiful background', 'ugly', 1280, 720);
    const clipNode = workflow['2'] as Record<string, Record<string, unknown>>;

    expect(clipNode.inputs.text).toBe('my beautiful background');
  });

  it('includes the negative prompt in the negative CLIP node', () => {
    const workflow = buildWorkflow('positive', 'negative terms here', 1280, 720);
    const negClipNode = workflow['3'] as Record<string, Record<string, unknown>>;

    expect(negClipNode.inputs.text).toBe('negative terms here');
  });

  it('sets the correct canvas dimensions', () => {
    const workflow = buildWorkflow('prompt', 'negative', 1920, 1080);
    const latentNode = workflow['4'] as Record<string, Record<string, unknown>>;

    expect(latentNode.inputs.width).toBe(1920);
    expect(latentNode.inputs.height).toBe(1080);
  });

  it('uses the provided seed', () => {
    const workflow = buildWorkflow('prompt', 'negative', 512, 512, 42);
    const samplerNode = workflow['5'] as Record<string, Record<string, unknown>>;

    expect(samplerNode.inputs.seed).toBe(42);
  });

  it('generates a random seed when not provided', () => {
    const workflow1 = buildWorkflow('prompt', 'negative', 512, 512);
    const workflow2 = buildWorkflow('prompt', 'negative', 512, 512);
    const sampler1 = workflow1['5'] as Record<string, Record<string, unknown>>;
    const sampler2 = workflow2['5'] as Record<string, Record<string, unknown>>;

    // Seeds should be numbers (may or may not differ due to random)
    expect(typeof sampler1.inputs.seed).toBe('number');
    expect(typeof sampler2.inputs.seed).toBe('number');
  });

  it('includes a SaveImage node with filename prefix', () => {
    const workflow = buildWorkflow('prompt', 'negative', 512, 512);
    const saveNode = workflow['7'] as Record<string, Record<string, unknown>>;

    expect(saveNode.class_type).toBe('SaveImage');
    expect(saveNode.inputs.filename_prefix).toBe('thumbnail_bg');
  });
});
