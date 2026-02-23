import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './store';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      document: null,
      activeTool: 'select',
      zoom: 1,
      statusMessage: 'Ready',
      showAbout: false,
    });
  });

  describe('initial state', () => {
    it('should have no document', () => {
      expect(useAppStore.getState().document).toBeNull();
    });

    it('should default to select tool', () => {
      expect(useAppStore.getState().activeTool).toBe('select');
    });

    it('should default to 100% zoom', () => {
      expect(useAppStore.getState().zoom).toBe(1);
    });

    it('should show Ready status', () => {
      expect(useAppStore.getState().statusMessage).toBe('Ready');
    });
  });

  describe('setActiveTool', () => {
    it('should change the active tool', () => {
      useAppStore.getState().setActiveTool('brush');
      expect(useAppStore.getState().activeTool).toBe('brush');
    });
  });

  describe('setZoom', () => {
    it('should update zoom level', () => {
      useAppStore.getState().setZoom(2.5);
      expect(useAppStore.getState().zoom).toBe(2.5);
    });
  });

  describe('setStatusMessage', () => {
    it('should update status message', () => {
      useAppStore.getState().setStatusMessage('Saving...');
      expect(useAppStore.getState().statusMessage).toBe('Saving...');
    });
  });

  describe('toggleAbout', () => {
    it('should toggle about dialog visibility', () => {
      expect(useAppStore.getState().showAbout).toBe(false);
      useAppStore.getState().toggleAbout();
      expect(useAppStore.getState().showAbout).toBe(true);
      useAppStore.getState().toggleAbout();
      expect(useAppStore.getState().showAbout).toBe(false);
    });
  });

  describe('newDocument', () => {
    it('should create a new document with correct dimensions', () => {
      useAppStore.getState().newDocument('Test', 800, 600);
      const doc = useAppStore.getState().document;

      expect(doc).not.toBeNull();
      expect(doc!.name).toBe('Test');
      expect(doc!.canvas.size.width).toBe(800);
      expect(doc!.canvas.size.height).toBe(600);
    });

    it('should set default canvas properties', () => {
      useAppStore.getState().newDocument('Test', 800, 600);
      const doc = useAppStore.getState().document!;

      expect(doc.canvas.dpi).toBe(72);
      expect(doc.canvas.colorMode).toBe('rgb');
      expect(doc.canvas.bitDepth).toBe(8);
    });

    it('should have empty root group', () => {
      useAppStore.getState().newDocument('Test', 800, 600);
      const doc = useAppStore.getState().document!;

      expect(doc.rootGroup.type).toBe('group');
      expect(doc.rootGroup.children).toHaveLength(0);
    });

    it('should update status message', () => {
      useAppStore.getState().newDocument('Test', 800, 600);
      expect(useAppStore.getState().statusMessage).toContain('Created');
      expect(useAppStore.getState().statusMessage).toContain('800x600');
    });

    it('should have correct metadata', () => {
      useAppStore.getState().newDocument('Test', 800, 600);
      const doc = useAppStore.getState().document!;

      expect(doc.id).toBeTruthy();
      expect(doc.selectedLayerId).toBeNull();
      expect(doc.filePath).toBeNull();
      expect(doc.dirty).toBe(false);
      expect(doc.createdAt).toBeTruthy();
    });
  });

  describe('setDocument', () => {
    it('should set document to null', () => {
      useAppStore.getState().newDocument('Test', 100, 100);
      useAppStore.getState().setDocument(null);
      expect(useAppStore.getState().document).toBeNull();
    });
  });
});
