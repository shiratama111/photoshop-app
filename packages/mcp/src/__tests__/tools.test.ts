/**
 * @module tools.test
 * Tests for MCP tool definitions and handler logic.
 *
 * @see Phase 2-3: MCP Server
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
  it('should have 17 tools defined', () => {
    expect(TOOLS.length).toBe(17);
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

  it('should include all expected tool names', () => {
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
});

describe('handleToolCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealthCheck.mockResolvedValue(true);
  });

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
});
