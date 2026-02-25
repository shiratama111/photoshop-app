/**
 * @module components/dialogs/NewDocumentDialog
 * Dialog for creating a new document with configurable name, preset, and dimensions.
 *
 * @see APP-017: New Document dialog, artboard/pasteboard, default background layer
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store';

/** Preset group for optgroup rendering. */
interface PresetGroup {
  label: string;
  presets: readonly { label: string; width: number; height: number }[];
}

/** Preset dimensions organised by category. */
const PRESET_GROUPS: readonly PresetGroup[] = [
  {
    label: 'Social Media',
    presets: [
      { label: 'YouTube Thumbnail (1280×720)', width: 1280, height: 720 },
      { label: 'Twitter Header (1500×500)', width: 1500, height: 500 },
      { label: 'Twitter Post (1200×675)', width: 1200, height: 675 },
      { label: 'Instagram Square (1080×1080)', width: 1080, height: 1080 },
      { label: 'Instagram Story (1080×1920)', width: 1080, height: 1920 },
    ],
  },
  {
    label: 'Standard',
    presets: [
      { label: 'Full HD (1920×1080)', width: 1920, height: 1080 },
      { label: '4K (3840×2160)', width: 3840, height: 2160 },
      { label: 'Small (800×600)', width: 800, height: 600 },
    ],
  },
] as const;

/** Flat preset list: Custom entry + all group presets. */
const PRESETS: readonly { label: string; width: number; height: number }[] = [
  { label: 'Custom', width: 0, height: 0 },
  ...PRESET_GROUPS.flatMap((g) => g.presets),
];

/** Default preset index — YouTube Thumbnail (index 1). */
const DEFAULT_PRESET_INDEX = 1;

const MIN_SIZE = 1;
const MAX_SIZE = 16384;

function clampSize(value: number): number {
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(value)));
}

/** NewDocumentDialog allows the user to configure and create a new document. */
export function NewDocumentDialog(): React.JSX.Element | null {
  const show = useAppStore((s) => s.showNewDocumentDialog);
  const closeDialog = useAppStore((s) => s.closeNewDocumentDialog);
  const newDocument = useAppStore((s) => s.newDocument);

  const [name, setName] = useState('Untitled');
  const [width, setWidth] = useState(PRESETS[DEFAULT_PRESET_INDEX].width);
  const [height, setHeight] = useState(PRESETS[DEFAULT_PRESET_INDEX].height);
  const [presetIndex, setPresetIndex] = useState(DEFAULT_PRESET_INDEX);

  // Reset state when dialog opens
  useEffect(() => {
    if (show) {
      setName('Untitled');
      setWidth(PRESETS[DEFAULT_PRESET_INDEX].width);
      setHeight(PRESETS[DEFAULT_PRESET_INDEX].height);
      setPresetIndex(DEFAULT_PRESET_INDEX);
    }
  }, [show]);

  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    const idx = Number(e.target.value);
    setPresetIndex(idx);
    const preset = PRESETS[idx];
    if (preset.width > 0 && preset.height > 0) {
      setWidth(preset.width);
      setHeight(preset.height);
    }
  }, []);

  const handleWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = Number(e.target.value);
    if (!Number.isNaN(v)) {
      setWidth(v);
      setPresetIndex(0); // Switch to Custom
    }
  }, []);

  const handleHeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = Number(e.target.value);
    if (!Number.isNaN(v)) {
      setHeight(v);
      setPresetIndex(0); // Switch to Custom
    }
  }, []);

  const isValid = width >= MIN_SIZE && width <= MAX_SIZE && height >= MIN_SIZE && height <= MAX_SIZE;

  const handleCreate = useCallback((): void => {
    if (!isValid) return;
    const w = clampSize(width);
    const h = clampSize(height);
    const docName = name.trim() || 'Untitled';
    newDocument(docName, w, h);
    closeDialog();
  }, [isValid, width, height, name, newDocument, closeDialog]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter' && isValid) {
        e.preventDefault();
        handleCreate();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
      }
    },
    [isValid, handleCreate, closeDialog],
  );

  if (!show) return null;

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div
        className="dialog new-document-dialog"
        onClick={(e): void => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="dialog-header">New Document</div>
        <div className="dialog-body">
          <div className="new-document-field">
            <label className="new-document-label">Name</label>
            <input
              className="new-document-input new-document-input--wide"
              type="text"
              value={name}
              onChange={(e): void => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="new-document-field">
            <label className="new-document-label">Preset</label>
            <select
              className="new-document-select"
              value={presetIndex}
              onChange={handlePresetChange}
            >
              <option value={0}>Custom</option>
              {PRESET_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.presets.map((p) => {
                    const idx = PRESETS.indexOf(p);
                    return (
                      <option key={p.label} value={idx}>
                        {p.label}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="new-document-field">
            <label className="new-document-label">Width</label>
            <input
              className="new-document-input"
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={width}
              onChange={handleWidthChange}
            />
            <span className="new-document-unit">px</span>
          </div>
          <div className="new-document-field">
            <label className="new-document-label">Height</label>
            <input
              className="new-document-input"
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={height}
              onChange={handleHeightChange}
            />
            <span className="new-document-unit">px</span>
          </div>
          {!isValid && (
            <div className="new-document-error">
              Size must be between {MIN_SIZE} and {MAX_SIZE} px.
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn" onClick={closeDialog}>
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn--primary"
            onClick={handleCreate}
            disabled={!isValid}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
