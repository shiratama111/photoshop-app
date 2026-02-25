/**
 * @module tools
 * MCP tool definitions and handlers for the Photoshop App editor.
 *
 * Defines 30 high-level tools that map to EditorAction(s) in the Electron app.
 * Each tool has a JSON Schema input definition and a handler that constructs
 * the appropriate EditorAction payload, calls the bridge, and formats the response.
 *
 * Tool groups:
 * - Read-only / Inspection (3)
 * - Layer Creation (2)
 * - Layer Modification (2)
 * - Layer Effects (2)
 * - Filters (1)
 * - Procedural Generation (3)
 * - Layer Management (1)
 * - History (2)
 * - Raw Dispatch (1)
 * - Templates (4) — MCP-002
 * - Text Style Presets (2) — MCP-002
 * - Decorations (2) — MCP-002
 * - Clipping Mask (1) — MCP-002
 * - Style Analysis (2) — MCP-002
 * - Pipeline (2) — PIPE-001
 *
 * @see Phase 2-3: MCP Server
 * @see PIPE-001: E2E自動生成パイプライン (.claude/tickets/PIPE-001.md)
 * @see MCP-002: MCPツール拡充 (.claude/tickets/MCP-002.md)
 * @see packages/app/src/renderer/editor-actions/types.ts (EditorAction union)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { callEditor, healthCheck } from './bridge.js';

/** All MCP tool definitions for ListTools. */
export const TOOLS: Tool[] = [
  // ── Read-only / Inspection ─────────────────────────────────────
  {
    name: 'get_document_info',
    description:
      'Get document metadata and full layer tree. Returns document dimensions, DPI, ' +
      'and a recursive list of all layers with their properties.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_canvas_snapshot',
    description:
      'Capture a full canvas snapshot including a base64 PNG thumbnail (max 480px) ' +
      'and optional per-layer thumbnails (64×64). Use this to "see" the current state of the canvas.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        includeThumbnails: {
          type: 'boolean',
          description: 'Include per-layer 64×64 thumbnails (default: true)',
        },
      },
    },
  },
  {
    name: 'get_layer_info',
    description:
      'Get detailed information about a single layer by ID, including properties, ' +
      'effects, and type-specific data (text content, bounds, children).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'The layer ID to inspect' },
      },
      required: ['layerId'],
    },
  },

  // ── Layer Creation ─────────────────────────────────────────────
  {
    name: 'create_text_layer',
    description:
      'Create a new text layer with optional text content, font, size, and position.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Layer name' },
        text: { type: 'string', description: 'Initial text content' },
        x: { type: 'number', description: 'X position in document coordinates' },
        y: { type: 'number', description: 'Y position in document coordinates' },
      },
    },
  },
  {
    name: 'create_raster_layer',
    description: 'Create a new empty raster (bitmap) layer.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Layer name' },
      },
    },
  },

  // ── Layer Modification ─────────────────────────────────────────
  {
    name: 'modify_layer',
    description:
      'Modify layer properties: opacity, blend mode, position, visibility, or name. ' +
      'Provide only the properties you want to change.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Target layer ID' },
        opacity: { type: 'number', description: 'Opacity 0-1' },
        blendMode: {
          type: 'string',
          description: 'Blend mode (normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity)',
        },
        x: { type: 'number', description: 'New X position' },
        y: { type: 'number', description: 'New Y position' },
        visible: { type: 'boolean', description: 'Layer visibility' },
        name: { type: 'string', description: 'New layer name' },
      },
      required: ['layerId'],
    },
  },
  {
    name: 'set_text_properties',
    description:
      'Modify text layer properties: text content, font, size, color, alignment, etc.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Target text layer ID' },
        properties: {
          type: 'object',
          description: 'Text properties to set (text, fontFamily, fontSize, color, bold, italic, alignment, lineHeight, letterSpacing, writingMode)',
        },
      },
      required: ['layerId', 'properties'],
    },
  },

  // ── Layer Effects ──────────────────────────────────────────────
  {
    name: 'add_layer_effect',
    description:
      'Add a layer effect (stroke, drop-shadow, outer-glow, inner-shadow, ' +
      'inner-glow, color-overlay, gradient-overlay, bevel-emboss).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Target layer ID' },
        effect: {
          type: 'object',
          description: 'Effect definition with "type" field and effect-specific properties',
        },
      },
      required: ['layerId', 'effect'],
    },
  },
  {
    name: 'set_layer_effects',
    description: 'Replace all effects on a layer with a new array of effects.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Target layer ID' },
        effects: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of effect definitions',
        },
      },
      required: ['layerId', 'effects'],
    },
  },

  // ── Filters ────────────────────────────────────────────────────
  {
    name: 'apply_filter',
    description:
      'Apply an image filter to the selected layer. Available filters: ' +
      'brightness, contrast, hueSaturation, levels, curves, colorBalance, ' +
      'invert, grayscale, sepia, posterize, threshold, desaturate, ' +
      'gaussianBlur, sharpen, motionBlur, addNoise, reduceNoise.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filterName: { type: 'string', description: 'Filter name' },
        options: {
          type: 'object',
          description: 'Filter-specific options (e.g. { amount: 50 } for brightness)',
        },
      },
      required: ['filterName'],
    },
  },

  // ── Procedural Generation ──────────────────────────────────────
  {
    name: 'add_background',
    description:
      'Add a gradient or solid color background layer. Supports linear and radial gradients.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        stops: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              position: { type: 'number', description: 'Position 0-1' },
              r: { type: 'number' }, g: { type: 'number' },
              b: { type: 'number' }, a: { type: 'number' },
            },
            required: ['position', 'r', 'g', 'b', 'a'],
          },
          description: 'Gradient color stops (min 2)',
        },
        gradientType: { type: 'string', description: 'linear or radial' },
        angle: { type: 'number', description: 'Angle in degrees (for linear gradient)' },
      },
      required: ['stops', 'gradientType'],
    },
  },
  {
    name: 'add_pattern',
    description: 'Add a pattern overlay layer (dots, stripes, checker, diagonal-stripes).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Pattern type: dots, stripes, checker, diagonal-stripes' },
        color: {
          type: 'object',
          properties: { r: { type: 'number' }, g: { type: 'number' }, b: { type: 'number' }, a: { type: 'number' } },
          required: ['r', 'g', 'b', 'a'],
          description: 'Pattern color (RGBA 0-255)',
        },
        spacing: { type: 'number', description: 'Spacing between pattern elements' },
        size: { type: 'number', description: 'Size of pattern elements' },
        opacity: { type: 'number', description: 'Pattern opacity 0-1' },
      },
      required: ['pattern', 'color', 'spacing', 'size', 'opacity'],
    },
  },
  {
    name: 'add_border',
    description: 'Add a border frame around the canvas (solid, double, or dashed).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        borderWidth: { type: 'number', description: 'Border width in pixels' },
        color: {
          type: 'object',
          properties: { r: { type: 'number' }, g: { type: 'number' }, b: { type: 'number' }, a: { type: 'number' } },
          required: ['r', 'g', 'b', 'a'],
          description: 'Border color (RGBA 0-255)',
        },
        cornerRadius: { type: 'number', description: 'Corner radius in pixels' },
        style: { type: 'string', description: 'Border style: solid, double, dashed' },
      },
      required: ['borderWidth', 'color', 'cornerRadius', 'style'],
    },
  },

  // ── Layer Management ───────────────────────────────────────────
  {
    name: 'remove_layer',
    description: 'Remove a layer by ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Layer ID to remove' },
      },
      required: ['layerId'],
    },
  },

  // ── History ────────────────────────────────────────────────────
  {
    name: 'undo',
    description: 'Undo the last editor action.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'redo',
    description: 'Redo the last undone editor action.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },

  // ── Raw Dispatch ───────────────────────────────────────────────
  {
    name: 'execute_actions',
    description:
      'Execute a raw array of EditorActions for advanced usage. ' +
      'Each action is { type: string, params: object }. ' +
      'Use this for batch operations or action types not covered by other tools.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              params: { type: 'object' },
            },
            required: ['type'],
          },
          description: 'Array of EditorAction objects',
        },
      },
      required: ['actions'],
    },
  },

  // ── Templates (MCP-002) ─────────────────────────────────────────
  {
    name: 'list_templates',
    description:
      'List all available templates from the template store. ' +
      'Returns template IDs, names, dimensions, and thumbnail info.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'load_template',
    description:
      'Load a template by ID and create a new document from it. ' +
      'The template layers, styles, and dimensions are applied to the new document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        templateId: { type: 'string', description: 'Template ID to load' },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'save_as_template',
    description:
      'Save the current document as a reusable template. ' +
      'The template preserves all layers, effects, and text content.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Template name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_from_preset',
    description:
      'Create a new blank document with a preset canvas size. ' +
      'Available presets: youtube_1280x720, twitter_1200x675, instagram_1080x1080, ' +
      'instagram_story_1080x1920, facebook_1200x630, a4_2480x3508, business_card_1050x600.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        presetName: {
          type: 'string',
          description:
            'Preset name: youtube_1280x720, twitter_1200x675, instagram_1080x1080, ' +
            'instagram_story_1080x1920, facebook_1200x630, a4_2480x3508, business_card_1050x600',
        },
      },
      required: ['presetName'],
    },
  },

  // ── Text Style Presets (MCP-002) ─────────────────────────────────
  {
    name: 'list_text_presets',
    description:
      'List all available text style presets (built-in and custom). ' +
      'Returns preset IDs, names, and style properties (font, size, color, effects).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'apply_text_preset',
    description:
      'Apply a text style preset to a text layer. ' +
      'Sets font, size, color, effects, and other text properties from the preset.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Target text layer ID' },
        presetId: { type: 'string', description: 'Text style preset ID to apply' },
      },
      required: ['layerId', 'presetId'],
    },
  },

  // ── Decorations (MCP-002) ────────────────────────────────────────
  {
    name: 'add_concentration_lines',
    description:
      'Add manga-style concentration lines (集中線) radiating from a center point. ' +
      'Creates a new layer with the generated lines.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        centerX: { type: 'number', description: 'X coordinate of the center point (in document pixels)' },
        centerY: { type: 'number', description: 'Y coordinate of the center point (in document pixels)' },
        lineCount: { type: 'number', description: 'Number of lines to generate (default: 60)' },
        innerRadius: { type: 'number', description: 'Inner radius (clear area) in pixels (default: 100)' },
        color: {
          type: 'object',
          properties: {
            r: { type: 'number' }, g: { type: 'number' },
            b: { type: 'number' }, a: { type: 'number' },
          },
          required: ['r', 'g', 'b', 'a'],
          description: 'Line color (RGBA 0-255). Default: black (0,0,0,255)',
        },
      },
    },
  },
  {
    name: 'apply_gradient_mask',
    description:
      'Apply a gradient mask to a layer for smooth fade-out effects. ' +
      'Supports linear and radial gradient types.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Target layer ID' },
        type: {
          type: 'string',
          description: 'Gradient type: linear or radial',
        },
        direction: {
          type: 'string',
          description: 'Direction for linear gradient: top, bottom, left, right, top-left, top-right, bottom-left, bottom-right',
        },
        startPosition: {
          type: 'number',
          description: 'Start position of the gradient (0-1, where 0 = fully transparent)',
        },
        endPosition: {
          type: 'number',
          description: 'End position of the gradient (0-1, where 1 = fully opaque)',
        },
        reversed: {
          type: 'boolean',
          description: 'Reverse the gradient direction (default: false)',
        },
      },
      required: ['layerId', 'type'],
    },
  },

  // ── Clipping Mask (MCP-002) ──────────────────────────────────────
  {
    name: 'set_clipping_mask',
    description:
      'Toggle clipping mask on a layer. When enabled, the layer is clipped ' +
      'to the content of the layer directly below it in the layer stack.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Target layer ID' },
        enabled: { type: 'boolean', description: 'true to enable clipping mask, false to disable' },
      },
      required: ['layerId', 'enabled'],
    },
  },

  // ── Style Analysis (MCP-002) ─────────────────────────────────────
  {
    name: 'describe_layer_style',
    description:
      'Get a natural language description of a layer\'s visual style, ' +
      'including text properties, effects, blend mode, and opacity.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Layer ID to describe' },
      },
      required: ['layerId'],
    },
  },
  {
    name: 'apply_style_description',
    description:
      'Apply a visual style to a layer using a natural language description. ' +
      'The editor interprets the description and applies matching properties and effects.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        layerId: { type: 'string', description: 'Target layer ID' },
        description: {
          type: 'string',
          description: 'Natural language style description (e.g. "white text with black stroke and drop shadow")',
        },
      },
      required: ['layerId', 'description'],
    },
  },

  // ── Pipeline (PIPE-001) ───────────────────────────────────────────
  {
    name: 'generate_thumbnail',
    description:
      'Generate a complete thumbnail from a natural language instruction. ' +
      'Produces a design blueprint with AI-selected fonts and returns an array of EditorActions ' +
      'to execute. Use execute_actions to apply the result to the canvas. ' +
      'Supports Japanese and English instructions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        instruction: {
          type: 'string',
          description: 'Natural language instruction (e.g. "衝撃ニュース系サムネ、タイトル「AIが世界を変える」")',
        },
        category: {
          type: 'string',
          description: 'Design category override: news, howto, vlog, product, gaming, comparison',
        },
        platform: {
          type: 'string',
          description: 'Target platform: youtube (1280x720), twitter (1200x675), instagram (1080x1080), custom',
        },
        title: { type: 'string', description: 'Explicit title text (overrides extraction from instruction)' },
        subtitle: { type: 'string', description: 'Explicit subtitle text' },
        canvasWidth: { type: 'number', description: 'Canvas width override in pixels' },
        canvasHeight: { type: 'number', description: 'Canvas height override in pixels' },
      },
      required: ['instruction'],
    },
  },
  {
    name: 'refine_thumbnail',
    description:
      'Refine an existing thumbnail with a follow-up instruction. ' +
      'Supports modifications like "もっと派手に", "文字を大きく", "太字にして", etc. ' +
      'Requires a previous generate_thumbnail result. Pass the design JSON from the previous result.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        instruction: {
          type: 'string',
          description: 'Refinement instruction (e.g. "もう少し派手にして", "make text bigger")',
        },
        currentDesign: {
          type: 'object',
          description: 'The current ThumbnailDesign JSON from a previous generate_thumbnail or refine_thumbnail result',
        },
      },
      required: ['instruction', 'currentDesign'],
    },
  },
];

/** Result type from the editor bridge. */
interface ActionResult {
  success: boolean;
  actionType: string;
  error?: string;
  layerId?: string;
  data?: unknown;
}

/**
 * Handle a tool call by constructing EditorAction(s) and calling the bridge.
 * Returns an MCP CallToolResult with text content.
 */
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: 'text' | 'image'; text?: string; data?: string; mimeType?: string }> }> {
  // Check connectivity first
  const alive = await healthCheck();
  if (!alive) {
    return errorResult('Photoshop App is not running or not reachable. Start the app first.');
  }

  try {
    switch (toolName) {
      case 'get_document_info': {
        const results = await callEditor([{ type: 'getDocumentInfo' }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'get_canvas_snapshot': {
        const results = await callEditor([{
          type: 'getCanvasSnapshot',
          params: { includeThumbnails: args.includeThumbnails ?? true },
        }]) as ActionResult[];
        return formatSnapshotResult(results[0]);
      }

      case 'get_layer_info': {
        const results = await callEditor([{
          type: 'getLayerInfo',
          params: { layerId: args.layerId },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'create_text_layer': {
        const results = await callEditor([{
          type: 'createTextLayer',
          params: { name: args.name, text: args.text, x: args.x, y: args.y },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'create_raster_layer': {
        const results = await callEditor([{
          type: 'createRasterLayer',
          params: { name: args.name },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'modify_layer': {
        const actions: unknown[] = [];
        const layerId = args.layerId as string;

        if (args.opacity !== undefined) {
          actions.push({ type: 'setLayerOpacity', params: { layerId, opacity: args.opacity } });
        }
        if (args.blendMode !== undefined) {
          actions.push({ type: 'setLayerBlendMode', params: { layerId, blendMode: args.blendMode } });
        }
        if (args.x !== undefined && args.y !== undefined) {
          actions.push({ type: 'setLayerPosition', params: { layerId, x: args.x, y: args.y } });
        }
        if (args.visible !== undefined) {
          actions.push({ type: 'setLayerVisibility', params: { layerId, visible: args.visible } });
        }
        if (args.name !== undefined) {
          actions.push({ type: 'renameLayer', params: { layerId, name: args.name } });
        }

        if (actions.length === 0) {
          return errorResult('No properties to modify. Provide at least one of: opacity, blendMode, x+y, visible, name.');
        }

        const results = await callEditor(actions) as ActionResult[];
        return formatResults(results);
      }

      case 'set_text_properties': {
        const results = await callEditor([{
          type: 'setTextProperties',
          params: { layerId: args.layerId, properties: args.properties },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'add_layer_effect': {
        const results = await callEditor([{
          type: 'addLayerEffect',
          params: { layerId: args.layerId, effect: args.effect },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'set_layer_effects': {
        const results = await callEditor([{
          type: 'setLayerEffects',
          params: { layerId: args.layerId, effects: args.effects },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'apply_filter': {
        const results = await callEditor([{
          type: 'applyFilter',
          params: { filterName: args.filterName, options: args.options },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'add_background': {
        const results = await callEditor([{
          type: 'addGradientBackground',
          params: { stops: args.stops, gradientType: args.gradientType, angle: args.angle },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'add_pattern': {
        const results = await callEditor([{
          type: 'addPattern',
          params: {
            pattern: args.pattern,
            color: args.color,
            spacing: args.spacing,
            size: args.size,
            opacity: args.opacity,
          },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'add_border': {
        const results = await callEditor([{
          type: 'addBorderFrame',
          params: {
            borderWidth: args.borderWidth,
            color: args.color,
            cornerRadius: args.cornerRadius,
            style: args.style,
          },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'remove_layer': {
        const results = await callEditor([{
          type: 'removeLayer',
          params: { layerId: args.layerId },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'undo': {
        const results = await callEditor([{ type: 'undo' }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'redo': {
        const results = await callEditor([{ type: 'redo' }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'execute_actions': {
        const actions = args.actions as unknown[];
        const results = await callEditor(actions) as ActionResult[];
        return formatResults(results);
      }

      // ── Templates (MCP-002) ───────────────────────────────────────
      case 'list_templates': {
        const results = await callEditor([{ type: 'listTemplates' }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'load_template': {
        const templateId = args.templateId as string | undefined;
        if (!templateId) {
          return errorResult('templateId is required.');
        }
        const results = await callEditor([{
          type: 'loadTemplate',
          params: { templateId },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'save_as_template': {
        const name = args.name as string | undefined;
        if (!name) {
          return errorResult('name is required.');
        }
        const results = await callEditor([{
          type: 'saveAsTemplate',
          params: { name },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'create_from_preset': {
        const presetName = args.presetName as string | undefined;
        if (!presetName) {
          return errorResult('presetName is required.');
        }
        const validPresets = [
          'youtube_1280x720', 'twitter_1200x675', 'instagram_1080x1080',
          'instagram_story_1080x1920', 'facebook_1200x630', 'a4_2480x3508',
          'business_card_1050x600',
        ];
        if (!validPresets.includes(presetName)) {
          return errorResult(
            `Invalid presetName "${presetName}". ` +
            `Valid presets: ${validPresets.join(', ')}`,
          );
        }
        const results = await callEditor([{
          type: 'createFromPreset',
          params: { presetName },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      // ── Text Style Presets (MCP-002) ──────────────────────────────
      case 'list_text_presets': {
        const results = await callEditor([{ type: 'listTextPresets' }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'apply_text_preset': {
        const layerId = args.layerId as string | undefined;
        const presetId = args.presetId as string | undefined;
        if (!layerId) {
          return errorResult('layerId is required.');
        }
        if (!presetId) {
          return errorResult('presetId is required.');
        }
        const results = await callEditor([{
          type: 'applyTextPreset',
          params: { layerId, presetId },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      // ── Decorations (MCP-002) ─────────────────────────────────────
      case 'add_concentration_lines': {
        const results = await callEditor([{
          type: 'addConcentrationLines',
          params: {
            centerX: args.centerX,
            centerY: args.centerY,
            lineCount: args.lineCount,
            innerRadius: args.innerRadius,
            color: args.color,
          },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'apply_gradient_mask': {
        const layerId = args.layerId as string | undefined;
        if (!layerId) {
          return errorResult('layerId is required.');
        }
        const gradientType = args.type as string | undefined;
        if (!gradientType || !['linear', 'radial'].includes(gradientType)) {
          return errorResult('type must be "linear" or "radial".');
        }
        const results = await callEditor([{
          type: 'applyGradientMask',
          params: {
            layerId,
            type: gradientType,
            direction: args.direction,
            startPosition: args.startPosition,
            endPosition: args.endPosition,
            reversed: args.reversed,
          },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      // ── Clipping Mask (MCP-002) ───────────────────────────────────
      case 'set_clipping_mask': {
        const layerId = args.layerId as string | undefined;
        if (!layerId) {
          return errorResult('layerId is required.');
        }
        if (typeof args.enabled !== 'boolean') {
          return errorResult('enabled must be a boolean (true or false).');
        }
        const results = await callEditor([{
          type: 'setClippingMask',
          params: { layerId, enabled: args.enabled },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      // ── Style Analysis (MCP-002) ──────────────────────────────────
      case 'describe_layer_style': {
        const layerId = args.layerId as string | undefined;
        if (!layerId) {
          return errorResult('layerId is required.');
        }
        const results = await callEditor([{
          type: 'describeLayerStyle',
          params: { layerId },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      case 'apply_style_description': {
        const layerId = args.layerId as string | undefined;
        const description = args.description as string | undefined;
        if (!layerId) {
          return errorResult('layerId is required.');
        }
        if (!description) {
          return errorResult('description is required.');
        }
        const results = await callEditor([{
          type: 'applyStyleDescription',
          params: { layerId, description },
        }]) as ActionResult[];
        return formatResult(results[0]);
      }

      // ── Pipeline (PIPE-001) ────────────────────────────────────────
      case 'generate_thumbnail': {
        const instruction = args.instruction as string | undefined;
        if (!instruction) {
          return errorResult('instruction is required.');
        }
        const pipelineResult = await callEditor([{
          type: 'generateThumbnail',
          params: {
            instruction,
            category: args.category,
            platform: args.platform,
            title: args.title,
            subtitle: args.subtitle,
            canvasWidth: args.canvasWidth,
            canvasHeight: args.canvasHeight,
          },
        }]) as ActionResult[];
        return formatResult(pipelineResult[0]);
      }

      case 'refine_thumbnail': {
        const instruction = args.instruction as string | undefined;
        const currentDesign = args.currentDesign as Record<string, unknown> | undefined;
        if (!instruction) {
          return errorResult('instruction is required.');
        }
        if (!currentDesign) {
          return errorResult('currentDesign is required. Pass the design JSON from a previous generate_thumbnail result.');
        }
        const pipelineResult = await callEditor([{
          type: 'refineThumbnail',
          params: { instruction, currentDesign },
        }]) as ActionResult[];
        return formatResult(pipelineResult[0]);
      }

      default:
        return errorResult(`Unknown tool: ${toolName}`);
    }
  } catch (e) {
    return errorResult(String(e));
  }
}

// ── Response formatters ────────────────────────────────────────

type ContentItem = { type: 'text' | 'image'; text?: string; data?: string; mimeType?: string };
type ToolResult = { content: ContentItem[] };

function formatResult(result: ActionResult): ToolResult {
  if (!result.success) {
    return { content: [{ type: 'text', text: `Error: ${result.error ?? 'Unknown error'}` }] };
  }
  const parts: ContentItem[] = [
    { type: 'text', text: JSON.stringify(result.data ?? { success: true, layerId: result.layerId }, null, 2) },
  ];
  return { content: parts };
}

function formatResults(results: ActionResult[]): ToolResult {
  const hasErrors = results.some((r) => !r.success);
  const text = JSON.stringify(
    results.map((r) => ({
      actionType: r.actionType,
      success: r.success,
      ...(r.error ? { error: r.error } : {}),
      ...(r.layerId ? { layerId: r.layerId } : {}),
      ...(r.data ? { data: r.data } : {}),
    })),
    null,
    2,
  );
  return {
    content: [{ type: 'text', text: hasErrors ? `Some actions failed:\n${text}` : text }],
  };
}

/**
 * Format a snapshot result, extracting the thumbnail as an image content block
 * so the AI model can actually "see" the canvas.
 */
function formatSnapshotResult(result: ActionResult): ToolResult {
  if (!result.success) {
    return { content: [{ type: 'text', text: `Error: ${result.error ?? 'Unknown error'}` }] };
  }

  const snapshot = result.data as Record<string, unknown>;
  const content: ContentItem[] = [];

  // Extract thumbnail as image content (strip data URI prefix)
  const thumbnail = snapshot.thumbnail as string | undefined;
  if (thumbnail) {
    const base64Data = thumbnail.replace(/^data:image\/png;base64,/, '');
    content.push({
      type: 'image',
      data: base64Data,
      mimeType: 'image/png',
    });
  }

  // Include document info and layer tree as text (omit raw thumbnail data)
  const textData = {
    document: snapshot.document,
    layers: snapshot.layers,
    layerThumbnailCount: Object.keys((snapshot.layerThumbnails as Record<string, string>) ?? {}).length,
  };
  content.push({ type: 'text', text: JSON.stringify(textData, null, 2) });

  return { content };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }] };
}
