/**
 * @module tools.test
 * Tests for MCP tool definitions and handler logic.
 *
 * Covers all 30 tools: the original 17 (regression), 11 from MCP-002
 * (templates, text style presets, decorations, clipping mask, style analysis),
 * and 2 from PIPE-001 (pipeline: generate_thumbnail, refine_thumbnail).
 *
 * @see Phase 2-3: MCP Server
 * @see MCP-002: MCPツール拡充
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TOOLS, handleToolCall } from '../tools.js';

// Mock the bridge module so tests don't need a running Electron app
vi.mock('../bridge.js', () => ({
  callEditor: vi.fn(),
  healthCheck: vi.fn(),
}));

import { callEditor, healthCheck } from '../bridge.js';

const mockCallEditor = vi.mocked(callEditor);
const mockHealthCheck = vi.mocked(healthCheck);

describe('TOOLS definitions', () => {
  it('should have 30 tools defined', () => {
    expect(TOOLS.length).toBe(30);
  });

  it('should have unique tool names', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have valid inputSchema for each tool', () => {
    for (const tool of TOOLS) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('should include all original tool names (regression)', () => {
    const names = TOOLS.map((t) => t.name);
    const expected = [
      'get_document_info', 'get_canvas_snapshot', 'get_layer_info',
      'create_text_layer', 'create_raster_layer',
      'modify_layer', 'set_text_properties',
      'add_layer_effect', 'set_layer_effects',
      'apply_filter',
      'add_background', 'add_pattern', 'add_border',
      'remove_layer',
      'undo', 'redo',
      'execute_actions',
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });

  it('should include all MCP-002 tool names', () => {
    const names = TOOLS.map((t) => t.name);
    const mcp002Tools = [
      // Templates
      'list_templates', 'load_template', 'save_as_template', 'create_from_preset',
      // Text style presets
      'list_text_presets', 'apply_text_preset',
      // Decorations
      'add_concentration_lines', 'apply_gradient_mask',
      // Clipping mask
      'set_clipping_mask',
      // Style analysis
      'describe_layer_style', 'apply_style_description',
    ];
    for (const name of mcp002Tools) {
      expect(names).toContain(name);
    }
  });

  it('should have required fields on tools that need them', () => {
    const toolMap = new Map(TOOLS.map((t) => [t.name, t]));

    // load_template requires templateId
    const loadTemplate = toolMap.get('load_template');
    expect(loadTemplate?.inputSchema.required).toContain('templateId');

    // save_as_template requires name
    const saveAsTemplate = toolMap.get('save_as_template');
    expect(saveAsTemplate?.inputSchema.required).toContain('name');

    // create_from_preset requires presetName
    const createFromPreset = toolMap.get('create_from_preset');
    expect(createFromPreset?.inputSchema.required).toContain('presetName');

    // apply_text_preset requires layerId and presetId
    const applyTextPreset = toolMap.get('apply_text_preset');
    expect(applyTextPreset?.inputSchema.required).toContain('layerId');
    expect(applyTextPreset?.inputSchema.required).toContain('presetId');

    // apply_gradient_mask requires layerId and type
    const applyGradientMask = toolMap.get('apply_gradient_mask');
    expect(applyGradientMask?.inputSchema.required).toContain('layerId');
    expect(applyGradientMask?.inputSchema.required).toContain('type');

    // set_clipping_mask requires layerId and enabled
    const setClippingMask = toolMap.get('set_clipping_mask');
    expect(setClippingMask?.inputSchema.required).toContain('layerId');
    expect(setClippingMask?.inputSchema.required).toContain('enabled');

    // describe_layer_style requires layerId
    const describeStyle = toolMap.get('describe_layer_style');
    expect(describeStyle?.inputSchema.required).toContain('layerId');

    // apply_style_description requires layerId and description
    const applyStyle = toolMap.get('apply_style_description');
    expect(applyStyle?.inputSchema.required).toContain('layerId');
    expect(applyStyle?.inputSchema.required).toContain('description');
  });
});

describe('handleToolCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealthCheck.mockResolvedValue(true);
  });

  // ── Regression: Original tools ──────────────────────────────────

  it('should return error when app is not running', async () => {
    mockHealthCheck.mockResolvedValue(false);
    const result = await handleToolCall('get_document_info', {});
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('not running');
  });

  it('should call getDocumentInfo action for get_document_info', async () => {
    mockCallEditor.mockResolvedValue([{
      success: true,
      actionType: 'getDocumentInfo',
      data: { id: 'doc-1', name: 'Test', width: 800, height: 600, dpi: 72, layers: [] },
    }]);

    const result = await handleToolCall('get_document_info', {});
    expect(mockCallEditor).toHaveBeenCalledWith([{ type: 'getDocumentInfo' }]);
    expect(result.content[0].type).toBe('text');
    const data = JSON.parse(result.content[0].text!);
    expect(data.name).toBe('Test');
  });

  it('should call getCanvasSnapshot for get_canvas_snapshot', async () => {
    mockCallEditor.mockResolvedValue([{
      success: true,
      actionType: 'getCanvasSnapshot',
      data: {
        document: { id: 'doc-1', name: 'Test', width: 800, height: 600, dpi: 72, selectedLayerId: null },
        layers: [],
        thumbnail: 'data:image/png;base64,iVBOR',
        layerThumbnails: {},
      },
    }]);

    const result = await handleToolCall('get_canvas_snapshot', { includeThumbnails: false });
    expect(mockCallEditor).toHaveBeenCalledWith([{
      type: 'getCanvasSnapshot',
      params: { includeThumbnails: false },
    }]);
    // Should include an image content block for the thumbnail
    const imageContent = result.content.find((c) => c.type === 'image');
    expect(imageContent).toBeDefined();
    expect(imageContent!.mimeType).toBe('image/png');
  });

  it('should construct multiple actions for modify_layer', async () => {
    mockCallEditor.mockResolvedValue([
      { success: true, actionType: 'setLayerOpacity' },
      { success: true, actionType: 'renameLayer' },
    ]);

    await handleToolCall('modify_layer', {
      layerId: 'layer-1',
      opacity: 0.5,
      name: 'New Name',
    });

    expect(mockCallEditor).toHaveBeenCalledWith([
      { type: 'setLayerOpacity', params: { layerId: 'layer-1', opacity: 0.5 } },
      { type: 'renameLayer', params: { layerId: 'layer-1', name: 'New Name' } },
    ]);
  });

  it('should return error for modify_layer with no properties', async () => {
    const result = await handleToolCall('modify_layer', { layerId: 'layer-1' });
    expect(result.content[0].text).toContain('No properties to modify');
  });

  it('should pass through execute_actions', async () => {
    const actions = [
      { type: 'undo' },
      { type: 'createTextLayer', params: { text: 'Hello' } },
    ];
    mockCallEditor.mockResolvedValue([
      { success: true, actionType: 'undo' },
      { success: true, actionType: 'createTextLayer', layerId: 'new-layer' },
    ]);

    await handleToolCall('execute_actions', { actions });
    expect(mockCallEditor).toHaveBeenCalledWith(actions);
  });

  it('should return error for unknown tool', async () => {
    const result = await handleToolCall('nonexistent_tool', {});
    expect(result.content[0].text).toContain('Unknown tool');
  });

  it('should handle bridge errors gracefully', async () => {
    mockCallEditor.mockRejectedValue(new Error('Connection refused'));
    const result = await handleToolCall('get_document_info', {});
    expect(result.content[0].text).toContain('Connection refused');
  });

  it('should call createTextLayer with position params', async () => {
    mockCallEditor.mockResolvedValue([{
      success: true,
      actionType: 'createTextLayer',
      layerId: 'new-text-1',
    }]);

    await handleToolCall('create_text_layer', { text: 'Hello', x: 100, y: 200 });
    expect(mockCallEditor).toHaveBeenCalledWith([{
      type: 'createTextLayer',
      params: { name: undefined, text: 'Hello', x: 100, y: 200 },
    }]);
  });

  it('should call addBorderFrame for add_border', async () => {
    mockCallEditor.mockResolvedValue([{ success: true, actionType: 'addBorderFrame' }]);

    await handleToolCall('add_border', {
      borderWidth: 5,
      color: { r: 0, g: 0, b: 0, a: 255 },
      cornerRadius: 10,
      style: 'solid',
    });

    expect(mockCallEditor).toHaveBeenCalledWith([{
      type: 'addBorderFrame',
      params: {
        borderWidth: 5,
        color: { r: 0, g: 0, b: 0, a: 255 },
        cornerRadius: 10,
        style: 'solid',
      },
    }]);
  });

  // ── MCP-002: Template tools ─────────────────────────────────────

  describe('list_templates', () => {
    it('should call listTemplates action', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'listTemplates',
        data: [{ id: 'tmpl-1', name: 'YouTube Thumbnail', width: 1280, height: 720 }],
      }]);

      const result = await handleToolCall('list_templates', {});
      expect(mockCallEditor).toHaveBeenCalledWith([{ type: 'listTemplates' }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data).toBeInstanceOf(Array);
      expect(data[0].name).toBe('YouTube Thumbnail');
    });
  });

  describe('load_template', () => {
    it('should call loadTemplate with templateId', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'loadTemplate',
        data: { documentId: 'doc-new', templateId: 'tmpl-1' },
      }]);

      const result = await handleToolCall('load_template', { templateId: 'tmpl-1' });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'loadTemplate',
        params: { templateId: 'tmpl-1' },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.templateId).toBe('tmpl-1');
    });

    it('should return error when templateId is missing', async () => {
      const result = await handleToolCall('load_template', {});
      expect(result.content[0].text).toContain('templateId is required');
    });
  });

  describe('save_as_template', () => {
    it('should call saveAsTemplate with name', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'saveAsTemplate',
        data: { templateId: 'tmpl-new', name: 'My Template' },
      }]);

      const result = await handleToolCall('save_as_template', { name: 'My Template' });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'saveAsTemplate',
        params: { name: 'My Template' },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.name).toBe('My Template');
    });

    it('should return error when name is missing', async () => {
      const result = await handleToolCall('save_as_template', {});
      expect(result.content[0].text).toContain('name is required');
    });
  });

  describe('create_from_preset', () => {
    it('should call createFromPreset with valid presetName', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'createFromPreset',
        data: { documentId: 'doc-new', width: 1280, height: 720 },
      }]);

      const result = await handleToolCall('create_from_preset', { presetName: 'youtube_1280x720' });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'createFromPreset',
        params: { presetName: 'youtube_1280x720' },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.width).toBe(1280);
    });

    it('should return error when presetName is missing', async () => {
      const result = await handleToolCall('create_from_preset', {});
      expect(result.content[0].text).toContain('presetName is required');
    });

    it('should return error for invalid presetName', async () => {
      const result = await handleToolCall('create_from_preset', { presetName: 'invalid_preset' });
      expect(result.content[0].text).toContain('Invalid presetName');
      expect(result.content[0].text).toContain('youtube_1280x720');
    });

    it('should accept all valid preset names', async () => {
      const validPresets = [
        'youtube_1280x720', 'twitter_1200x675', 'instagram_1080x1080',
        'instagram_story_1080x1920', 'facebook_1200x630', 'a4_2480x3508',
        'business_card_1050x600',
      ];
      for (const presetName of validPresets) {
        mockCallEditor.mockResolvedValue([{
          success: true,
          actionType: 'createFromPreset',
          data: { documentId: 'doc-new' },
        }]);
        const result = await handleToolCall('create_from_preset', { presetName });
        // Should not contain error
        expect(result.content[0].text).not.toContain('Error');
      }
    });
  });

  // ── MCP-002: Text Style Preset tools ────────────────────────────

  describe('list_text_presets', () => {
    it('should call listTextPresets action', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'listTextPresets',
        data: [
          { id: 'preset-1', name: 'Title Bold', fontFamily: 'Noto Sans JP', fontSize: 48, color: '#FFFFFF' },
        ],
      }]);

      const result = await handleToolCall('list_text_presets', {});
      expect(mockCallEditor).toHaveBeenCalledWith([{ type: 'listTextPresets' }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data[0].name).toBe('Title Bold');
    });
  });

  describe('apply_text_preset', () => {
    it('should call applyTextPreset with layerId and presetId', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'applyTextPreset',
        data: { applied: true },
      }]);

      const result = await handleToolCall('apply_text_preset', {
        layerId: 'layer-1',
        presetId: 'preset-1',
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'applyTextPreset',
        params: { layerId: 'layer-1', presetId: 'preset-1' },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.applied).toBe(true);
    });

    it('should return error when layerId is missing', async () => {
      const result = await handleToolCall('apply_text_preset', { presetId: 'preset-1' });
      expect(result.content[0].text).toContain('layerId is required');
    });

    it('should return error when presetId is missing', async () => {
      const result = await handleToolCall('apply_text_preset', { layerId: 'layer-1' });
      expect(result.content[0].text).toContain('presetId is required');
    });
  });

  // ── MCP-002: Decoration tools ───────────────────────────────────

  describe('add_concentration_lines', () => {
    it('should call addConcentrationLines with config', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'addConcentrationLines',
        layerId: 'lines-layer-1',
      }]);

      const result = await handleToolCall('add_concentration_lines', {
        centerX: 640,
        centerY: 360,
        lineCount: 80,
        innerRadius: 150,
        color: { r: 0, g: 0, b: 0, a: 255 },
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'addConcentrationLines',
        params: {
          centerX: 640,
          centerY: 360,
          lineCount: 80,
          innerRadius: 150,
          color: { r: 0, g: 0, b: 0, a: 255 },
        },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.layerId).toBe('lines-layer-1');
    });

    it('should allow calling with no arguments (all optional)', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'addConcentrationLines',
        layerId: 'lines-layer-2',
      }]);

      const result = await handleToolCall('add_concentration_lines', {});
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'addConcentrationLines',
        params: {
          centerX: undefined,
          centerY: undefined,
          lineCount: undefined,
          innerRadius: undefined,
          color: undefined,
        },
      }]);
      expect(result.content[0].text).not.toContain('Error');
    });
  });

  describe('apply_gradient_mask', () => {
    it('should call applyGradientMask with full config', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'applyGradientMask',
        data: { applied: true },
      }]);

      const result = await handleToolCall('apply_gradient_mask', {
        layerId: 'layer-1',
        type: 'linear',
        direction: 'bottom',
        startPosition: 0.0,
        endPosition: 0.5,
        reversed: false,
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'applyGradientMask',
        params: {
          layerId: 'layer-1',
          type: 'linear',
          direction: 'bottom',
          startPosition: 0.0,
          endPosition: 0.5,
          reversed: false,
        },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.applied).toBe(true);
    });

    it('should accept radial gradient type', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'applyGradientMask',
        data: { applied: true },
      }]);

      await handleToolCall('apply_gradient_mask', {
        layerId: 'layer-1',
        type: 'radial',
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'applyGradientMask',
        params: {
          layerId: 'layer-1',
          type: 'radial',
          direction: undefined,
          startPosition: undefined,
          endPosition: undefined,
          reversed: undefined,
        },
      }]);
    });

    it('should return error when layerId is missing', async () => {
      const result = await handleToolCall('apply_gradient_mask', { type: 'linear' });
      expect(result.content[0].text).toContain('layerId is required');
    });

    it('should return error when type is missing', async () => {
      const result = await handleToolCall('apply_gradient_mask', { layerId: 'layer-1' });
      expect(result.content[0].text).toContain('type must be "linear" or "radial"');
    });

    it('should return error for invalid gradient type', async () => {
      const result = await handleToolCall('apply_gradient_mask', {
        layerId: 'layer-1',
        type: 'conic',
      });
      expect(result.content[0].text).toContain('type must be "linear" or "radial"');
    });
  });

  // ── MCP-002: Clipping Mask tool ─────────────────────────────────

  describe('set_clipping_mask', () => {
    it('should call setClippingMask to enable', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'setClippingMask',
        data: { layerId: 'layer-1', clippingMask: true },
      }]);

      const result = await handleToolCall('set_clipping_mask', {
        layerId: 'layer-1',
        enabled: true,
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'setClippingMask',
        params: { layerId: 'layer-1', enabled: true },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.clippingMask).toBe(true);
    });

    it('should call setClippingMask to disable', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'setClippingMask',
        data: { layerId: 'layer-1', clippingMask: false },
      }]);

      const result = await handleToolCall('set_clipping_mask', {
        layerId: 'layer-1',
        enabled: false,
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'setClippingMask',
        params: { layerId: 'layer-1', enabled: false },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.clippingMask).toBe(false);
    });

    it('should return error when layerId is missing', async () => {
      const result = await handleToolCall('set_clipping_mask', { enabled: true });
      expect(result.content[0].text).toContain('layerId is required');
    });

    it('should return error when enabled is not a boolean', async () => {
      const result = await handleToolCall('set_clipping_mask', {
        layerId: 'layer-1',
        enabled: 'yes',
      });
      expect(result.content[0].text).toContain('enabled must be a boolean');
    });

    it('should return error when enabled is missing', async () => {
      const result = await handleToolCall('set_clipping_mask', { layerId: 'layer-1' });
      expect(result.content[0].text).toContain('enabled must be a boolean');
    });
  });

  // ── MCP-002: Style Analysis tools ───────────────────────────────

  describe('describe_layer_style', () => {
    it('should call describeLayerStyle with layerId', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'describeLayerStyle',
        data: {
          description: 'White bold text, 48px, with black 3px stroke and soft drop shadow',
          properties: { fontSize: 48, color: '#FFFFFF', effects: ['stroke', 'drop-shadow'] },
        },
      }]);

      const result = await handleToolCall('describe_layer_style', { layerId: 'layer-1' });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'describeLayerStyle',
        params: { layerId: 'layer-1' },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.description).toContain('White bold text');
    });

    it('should return error when layerId is missing', async () => {
      const result = await handleToolCall('describe_layer_style', {});
      expect(result.content[0].text).toContain('layerId is required');
    });
  });

  describe('apply_style_description', () => {
    it('should call applyStyleDescription with layerId and description', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'applyStyleDescription',
        data: { applied: true, interpretedActions: 3 },
      }]);

      const result = await handleToolCall('apply_style_description', {
        layerId: 'layer-1',
        description: 'white text with black stroke and drop shadow',
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'applyStyleDescription',
        params: {
          layerId: 'layer-1',
          description: 'white text with black stroke and drop shadow',
        },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.applied).toBe(true);
    });

    it('should return error when layerId is missing', async () => {
      const result = await handleToolCall('apply_style_description', {
        description: 'some style',
      });
      expect(result.content[0].text).toContain('layerId is required');
    });

    it('should return error when description is missing', async () => {
      const result = await handleToolCall('apply_style_description', {
        layerId: 'layer-1',
      });
      expect(result.content[0].text).toContain('description is required');
    });
  });

  // ── PIPE-001: Pipeline tools ─────────────────────────────────────

  describe('generate_thumbnail', () => {
    it('should call generateThumbnail with instruction', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'generateThumbnail',
        data: {
          design: { canvas: { width: 1280, height: 720 }, layers: [], metadata: {} },
          actions: [{ type: 'addGradientBackground' }],
          success: true,
        },
      }]);

      const result = await handleToolCall('generate_thumbnail', {
        instruction: '衝撃ニュース系サムネ',
        platform: 'youtube',
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'generateThumbnail',
        params: {
          instruction: '衝撃ニュース系サムネ',
          category: undefined,
          platform: 'youtube',
          title: undefined,
          subtitle: undefined,
          canvasWidth: undefined,
          canvasHeight: undefined,
        },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.success).toBe(true);
    });

    it('should pass all optional parameters', async () => {
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'generateThumbnail',
        data: { success: true },
      }]);

      await handleToolCall('generate_thumbnail', {
        instruction: 'test thumbnail',
        category: 'news',
        platform: 'instagram',
        title: 'My Title',
        subtitle: 'My Subtitle',
        canvasWidth: 1920,
        canvasHeight: 1080,
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'generateThumbnail',
        params: {
          instruction: 'test thumbnail',
          category: 'news',
          platform: 'instagram',
          title: 'My Title',
          subtitle: 'My Subtitle',
          canvasWidth: 1920,
          canvasHeight: 1080,
        },
      }]);
    });

    it('should return error when instruction is missing', async () => {
      const result = await handleToolCall('generate_thumbnail', {});
      expect(result.content[0].text).toContain('instruction is required');
    });
  });

  describe('refine_thumbnail', () => {
    it('should call refineThumbnail with instruction and currentDesign', async () => {
      const currentDesign = {
        canvas: { width: 1280, height: 720 },
        layers: [],
        metadata: { category: 'news', mood: 'urgent', targetPlatform: 'youtube' },
        background: { type: 'solid', color: { r: 0, g: 0, b: 0, a: 1 } },
      };
      mockCallEditor.mockResolvedValue([{
        success: true,
        actionType: 'refineThumbnail',
        data: { success: true, design: currentDesign },
      }]);

      const result = await handleToolCall('refine_thumbnail', {
        instruction: 'もっと派手にして',
        currentDesign,
      });
      expect(mockCallEditor).toHaveBeenCalledWith([{
        type: 'refineThumbnail',
        params: { instruction: 'もっと派手にして', currentDesign },
      }]);
      const data = JSON.parse(result.content[0].text!);
      expect(data.success).toBe(true);
    });

    it('should return error when instruction is missing', async () => {
      const result = await handleToolCall('refine_thumbnail', {
        currentDesign: { canvas: { width: 1280, height: 720 } },
      });
      expect(result.content[0].text).toContain('instruction is required');
    });

    it('should return error when currentDesign is missing', async () => {
      const result = await handleToolCall('refine_thumbnail', {
        instruction: 'make it bigger',
      });
      expect(result.content[0].text).toContain('currentDesign is required');
    });
  });

  // ── PIPE-001: Pipeline tools included in regression checks ─────

  it('should include PIPE-001 pipeline tool names', () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toContain('generate_thumbnail');
    expect(names).toContain('refine_thumbnail');
  });

  it('should have required fields on pipeline tools', () => {
    const toolMap = new Map(TOOLS.map((t) => [t.name, t]));

    const genThumbnail = toolMap.get('generate_thumbnail');
    expect(genThumbnail?.inputSchema.required).toContain('instruction');

    const refineThumbnail = toolMap.get('refine_thumbnail');
    expect(refineThumbnail?.inputSchema.required).toContain('instruction');
    expect(refineThumbnail?.inputSchema.required).toContain('currentDesign');
  });

  // ── MCP-002: Error handling for bridge failures ─────────────────

  describe('MCP-002 tools bridge error handling', () => {
    it('should handle bridge errors in list_templates', async () => {
      mockCallEditor.mockRejectedValue(new Error('Connection timeout'));
      const result = await handleToolCall('list_templates', {});
      expect(result.content[0].text).toContain('Connection timeout');
    });

    it('should handle bridge errors in load_template', async () => {
      mockCallEditor.mockRejectedValue(new Error('Server error'));
      const result = await handleToolCall('load_template', { templateId: 'tmpl-1' });
      expect(result.content[0].text).toContain('Server error');
    });

    it('should handle action failure results', async () => {
      mockCallEditor.mockResolvedValue([{
        success: false,
        actionType: 'loadTemplate',
        error: 'Template not found: tmpl-999',
      }]);

      const result = await handleToolCall('load_template', { templateId: 'tmpl-999' });
      expect(result.content[0].text).toContain('Template not found');
    });

    it('should return health check error for MCP-002 tools when app is down', async () => {
      mockHealthCheck.mockResolvedValue(false);

      const tools = [
        ['list_templates', {}],
        ['load_template', { templateId: 'tmpl-1' }],
        ['save_as_template', { name: 'test' }],
        ['create_from_preset', { presetName: 'youtube_1280x720' }],
        ['list_text_presets', {}],
        ['apply_text_preset', { layerId: 'l1', presetId: 'p1' }],
        ['add_concentration_lines', {}],
        ['apply_gradient_mask', { layerId: 'l1', type: 'linear' }],
        ['set_clipping_mask', { layerId: 'l1', enabled: true }],
        ['describe_layer_style', { layerId: 'l1' }],
        ['apply_style_description', { layerId: 'l1', description: 'bold red' }],
      ] as const;

      for (const [toolName, args] of tools) {
        const result = await handleToolCall(toolName, args as Record<string, unknown>);
        expect(result.content[0].text).toContain('not running');
      }
    });
  });
});
