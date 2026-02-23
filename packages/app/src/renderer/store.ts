/**
 * @module store
 * Zustand state store for the renderer process.
 *
 * Manages:
 * - Active document state
 * - Viewport (zoom/pan)
 * - UI state (selected tool, active panel)
 *
 * @see https://github.com/pmndrs/zustand
 */

import { create } from 'zustand';
import type { Document } from '@photoshop-app/types';

/** Active tool in the toolbar. */
export type Tool = 'select' | 'move' | 'brush' | 'eraser' | 'text' | 'crop' | 'segment';

/** Application state. */
export interface AppState {
  /** Currently active document, or null. */
  document: Document | null;
  /** Active tool. */
  activeTool: Tool;
  /** Current zoom level. */
  zoom: number;
  /** Status bar message. */
  statusMessage: string;
  /** Whether the about dialog is visible. */
  showAbout: boolean;
}

/** Actions on the state. */
export interface AppActions {
  /** Set the active document. */
  setDocument: (doc: Document | null) => void;
  /** Set the active tool. */
  setActiveTool: (tool: Tool) => void;
  /** Set the zoom level. */
  setZoom: (zoom: number) => void;
  /** Set the status bar message. */
  setStatusMessage: (msg: string) => void;
  /** Toggle the about dialog. */
  toggleAbout: () => void;
  /** Create a new empty document. */
  newDocument: (name: string, width: number, height: number) => void;
}

/** Zustand store for application state. */
export const useAppStore = create<AppState & AppActions>((set) => ({
  // State
  document: null,
  activeTool: 'select',
  zoom: 1,
  statusMessage: 'Ready',
  showAbout: false,

  // Actions
  setDocument: (doc): void => set({ document: doc }),
  setActiveTool: (tool): void => set({ activeTool: tool }),
  setZoom: (zoom): void => set({ zoom }),
  setStatusMessage: (msg): void => set({ statusMessage: msg }),
  toggleAbout: (): void => set((s) => ({ showAbout: !s.showAbout })),

  newDocument: (name, width, height): void => {
    const doc: Document = {
      id: crypto.randomUUID(),
      name,
      canvas: {
        size: { width, height },
        dpi: 72,
        colorMode: 'rgb',
        bitDepth: 8,
      },
      rootGroup: {
        id: crypto.randomUUID(),
        name: 'Root',
        type: 'group',
        visible: true,
        opacity: 1,
        blendMode: 'normal' as Document['rootGroup']['blendMode'],
        position: { x: 0, y: 0 },
        locked: false,
        effects: [],
        parentId: null,
        children: [],
        expanded: true,
      },
      selectedLayerId: null,
      filePath: null,
      dirty: false,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    set({ document: doc, statusMessage: `Created: ${name} (${width}x${height})` });
  },
}));
