/**
 * @module components/dialogs/RecoveryDialog
 * Crash recovery dialog shown on startup when auto-save files are found.
 *
 * Displays a list of recoverable documents and lets the user:
 * - Recover a document (opens the most recent auto-save)
 * - Discard all recovery files
 *
 * @see APP-008: Auto-save + finishing touches
 */

import React from 'react';
import { useAppStore } from '../../store';

/** RecoveryDialog prompts the user to recover or discard auto-saved documents. */
export function RecoveryDialog(): React.JSX.Element | null {
  const recoveryEntries = useAppStore((s) => s.recoveryEntries);
  const recoverDocument = useAppStore((s) => s.recoverDocument);
  const discardRecovery = useAppStore((s) => s.discardRecovery);

  if (recoveryEntries.length === 0) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog recovery-dialog">
        <div className="dialog-header">Recover Unsaved Work</div>
        <div className="dialog-body">
          <p className="recovery-description">
            The application found auto-saved files from a previous session.
            Would you like to recover them?
          </p>
          <div className="recovery-list">
            {recoveryEntries.map((entry) => (
              <div key={entry.documentId} className="recovery-item">
                <div className="recovery-item__info">
                  <span className="recovery-item__name">{entry.documentName}</span>
                  <span className="recovery-item__date">
                    {new Date(entry.savedAt).toLocaleString()}
                  </span>
                </div>
                <button
                  className="dialog-btn dialog-btn--primary"
                  onClick={(): void => void recoverDocument(entry.documentId)}
                >
                  Recover
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="dialog-footer">
          <button
            className="dialog-btn"
            onClick={(): void => void discardRecovery()}
          >
            Discard All
          </button>
        </div>
      </div>
    </div>
  );
}
