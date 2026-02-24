/**
 * @module components/dialogs/AboutDialog
 * Basic about modal for Help -> About menu action.
 */

import React from 'react';
import { useAppStore } from '../../store';

/** AboutDialog shows app information and closes on backdrop/cancel click. */
export function AboutDialog(): React.JSX.Element | null {
  const showAbout = useAppStore((s) => s.showAbout);
  const toggleAbout = useAppStore((s) => s.toggleAbout);

  if (!showAbout) return null;

  return (
    <div className="dialog-overlay" onClick={toggleAbout}>
      <div className="dialog" onClick={(e): void => e.stopPropagation()}>
        <div className="dialog-header">About Photoshop App</div>
        <div className="dialog-body">
          <p>Photoshop App</p>
          <p>Local-first image editor prototype built with Electron, React, and Canvas.</p>
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn dialog-btn--primary" onClick={toggleAbout}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
