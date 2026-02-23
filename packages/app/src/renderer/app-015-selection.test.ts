/**
 * @module app-015-selection.test
 * Tests for selection tools (APP-015).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './store';

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
    selection: null,
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

describe('APP-015: Selection Tools', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should have null selection initially', () => {
    expect(useAppStore.getState().selection).toBeNull();
  });

  it('should set a selection rectangle', () => {
    useAppStore.getState().setSelection({ x: 10, y: 20, width: 100, height: 50 });
    const sel = useAppStore.getState().selection;
    expect(sel).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('should update status message when setting selection', () => {
    useAppStore.getState().setSelection({ x: 0, y: 0, width: 200, height: 150 });
    expect(useAppStore.getState().statusMessage).toContain('200');
    expect(useAppStore.getState().statusMessage).toContain('150');
  });

  it('should clear selection', () => {
    useAppStore.getState().setSelection({ x: 0, y: 0, width: 100, height: 100 });
    useAppStore.getState().clearSelection();
    expect(useAppStore.getState().selection).toBeNull();
    expect(useAppStore.getState().statusMessage).toContain('cleared');
  });

  it('should select all', () => {
    createTestDocument();
    useAppStore.getState().selectAll();
    const sel = useAppStore.getState().selection;
    expect(sel).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('should not select all without a document', () => {
    useAppStore.getState().selectAll();
    expect(useAppStore.getState().selection).toBeNull();
  });

  it('should allow setting selection to null', () => {
    useAppStore.getState().setSelection({ x: 0, y: 0, width: 100, height: 100 });
    useAppStore.getState().setSelection(null);
    expect(useAppStore.getState().selection).toBeNull();
  });

  it('should update selection dimensions', () => {
    useAppStore.getState().setSelection({ x: 0, y: 0, width: 100, height: 100 });
    useAppStore.getState().setSelection({ x: 10, y: 10, width: 200, height: 200 });
    expect(useAppStore.getState().selection).toEqual({ x: 10, y: 10, width: 200, height: 200 });
  });
});
