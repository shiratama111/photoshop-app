/**
 * @module components/dialogs/CloseConfirmDialog
 * Save confirmation dialog shown when the user attempts to close
 * with unsaved changes.
 *
 * Options:
 * - Save: Save the document and then close
 * - Don't Save: Discard changes and close
 * - Cancel: Cancel the close action
 *
 * @see APP-008: Auto-save + finishing touches
 */

import React from 'react';
import { useAppStore } from '../../store';

/** CloseConfirmDialog prompts the user to save before closing. */
export function CloseConfirmDialog(): React.JSX.Element | null {
  const pendingClose = useAppStore((s) => s.pendingClose);
  const handleCloseConfirmation = useAppStore((s) => s.handleCloseConfirmation);

  if (!pendingClose) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">Unsaved Changes</div>
        <div className="dialog-body">
          <p>Do you want to save your changes before closing?</p>
          <p className="close-confirm-hint">Your changes will be lost if you don&apos;t save them.</p>
        </div>
        <div className="dialog-footer">
          <button
            className="dialog-btn"
            onClick={(): void => void handleCloseConfirmation('cancel')}
          >
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn--danger"
            onClick={(): void => void handleCloseConfirmation('discard')}
          >
            Don&apos;t Save
          </button>
          <button
            className="dialog-btn dialog-btn--primary"
            onClick={(): void => void handleCloseConfirmation('save')}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
