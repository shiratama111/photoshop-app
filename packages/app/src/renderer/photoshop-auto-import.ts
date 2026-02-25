/**
 * @module photoshop-auto-import
 * Renderer-side orchestrator for automatic Photoshop preset import.
 *
 * Called once on app startup. Invokes the main process scanner via IPC,
 * then feeds discovered ASL/ABR/font files into the appropriate stores.
 *
 * Flow:
 * 1. `window.electronAPI.scanPhotoshopPresets()` → IPC scan
 * 2. ASL buffers → `useAssetStore.batchImportAsl()`
 * 3. ABR buffers → `useAssetStore.batchImportAbr()`
 * 4. Fonts → `FontFace` registration + `addExternalFont()`
 * 5. Status message with import summary
 *
 * @see photoshop-import.ts (main process)
 * @see asset-store.ts (brush/style import)
 * @see FontSelector.tsx (font registration)
 * @see PRESET-001: Photoshop preset auto-import
 */

import { useAssetStore } from './components/panels/asset-store';
import { addExternalFont } from './components/text-editor/FontSelector';
import { useAppStore } from './store';

// ── Type guard ───────────────────────────────────────────────────────────

/** Shape of a discovered file from the main process scan result. */
interface DiscoveredFile {
  filePath: string;
  type: 'asl' | 'abr' | 'font';
  data: ArrayBuffer | null;
  fontFamily?: string;
}

/** Shape of the scan result returned from the main process. */
interface PhotoshopImportResult {
  imported: DiscoveredFile[];
  skippedCount: number;
  errors: string[];
}

/** Type guard for the scan result. */
function isImportResult(value: unknown): value is PhotoshopImportResult {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.imported) && typeof obj.skippedCount === 'number';
}

// ── Electron API accessor ────────────────────────────────────────────────

function getElectronAPI(): {
  scanPhotoshopPresets?: () => Promise<unknown>;
} {
  return (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI ?? {};
}

// ── Auto-import runner ───────────────────────────────────────────────────

/** Guard to prevent running more than once per session. */
let hasRun = false;

/**
 * Run the automatic Photoshop preset import.
 * Safe to call multiple times — only executes once per session.
 *
 * @returns Summary counts, or null if the feature is unavailable.
 */
export async function runPhotoshopAutoImport(): Promise<{
  styles: number;
  brushes: number;
  fonts: number;
  skipped: number;
} | null> {
  if (hasRun) return null;
  hasRun = true;

  const api = getElectronAPI();
  if (!api.scanPhotoshopPresets) return null;

  let result: PhotoshopImportResult;
  try {
    const raw = await api.scanPhotoshopPresets();
    if (!isImportResult(raw)) return null;
    result = raw;
  } catch {
    return null;
  }

  if (result.imported.length === 0) return null;

  // Separate by type
  const aslFiles = result.imported.filter((f) => f.type === 'asl' && f.data);
  const abrFiles = result.imported.filter((f) => f.type === 'abr' && f.data);
  const fontFiles = result.imported.filter((f) => f.type === 'font' && f.data && f.fontFamily);

  const store = useAssetStore.getState();

  // Import ASL files (batch — no individual status messages)
  for (const file of aslFiles) {
    if (file.data) {
      store.batchImportAsl(file.data, path.basename(file.filePath));
    }
  }

  // Import ABR files (batch — no individual status messages)
  for (const file of abrFiles) {
    if (file.data) {
      store.batchImportAbr(file.data, path.basename(file.filePath));
    }
  }

  // Register fonts
  let fontCount = 0;
  for (const file of fontFiles) {
    if (file.data && file.fontFamily) {
      try {
        const fontFace = new FontFace(file.fontFamily, file.data);
        await fontFace.load();
        document.fonts.add(fontFace);
        addExternalFont(file.fontFamily);
        fontCount++;
      } catch {
        // Font load failed — skip silently
      }
    }
  }

  // Show summary status message
  const parts: string[] = [];
  if (aslFiles.length > 0) parts.push(`${aslFiles.length} styles`);
  if (abrFiles.length > 0) parts.push(`${abrFiles.length} brushes`);
  if (fontCount > 0) parts.push(`${fontCount} fonts`);

  if (parts.length > 0) {
    useAppStore.getState().setStatusMessage(
      `Auto-imported from Photoshop: ${parts.join(', ')}`,
    );
  }

  return {
    styles: aslFiles.length,
    brushes: abrFiles.length,
    fonts: fontCount,
    skipped: result.skippedCount,
  };
}

// ── Path utility (browser-safe) ──────────────────────────────────────────

/** Minimal path.basename for browser context. */
const path = {
  basename(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || filePath;
  },
};
