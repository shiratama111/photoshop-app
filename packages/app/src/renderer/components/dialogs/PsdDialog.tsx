/**
 * @module PsdDialog
 * Compatibility report dialog shown when importing a PSD file with issues.
 * @see APP-004: PSD open/save integration
 */

import React from 'react';
import { useAppStore } from '../../store';

/** PSD compatibility report dialog. */
export function PsdDialog(): React.JSX.Element | null {
  const pendingPsdImport = useAppStore((s) => s.pendingPsdImport);
  const acceptPsdImport = useAppStore((s) => s.acceptPsdImport);
  const cancelPsdImport = useAppStore((s) => s.cancelPsdImport);

  if (!pendingPsdImport) return null;

  const { report } = pendingPsdImport;
  const hasErrors = report.issues.some((i) => i.severity === 'error');

  return (
    <div className="dialog-overlay" onClick={cancelPsdImport}>
      <div className="dialog" onClick={(e): void => e.stopPropagation()}>
        <div className="dialog-header">PSD Compatibility Report</div>
        <div className="dialog-body">
          <div className="psd-summary">
            {report.layerCount} layers processed, {report.affectedLayerCount} with issues
          </div>

          {hasErrors && (
            <div className="psd-error-notice">
              Some features could not be converted. The result may differ from the original.
            </div>
          )}

          <div className="psd-issues-list">
            {report.issues.map((issue, idx) => (
              <div key={idx} className={`psd-issue psd-issue--${issue.severity}`}>
                <span className="psd-issue-badge">{issue.severity}</span>
                {issue.layerName && <strong>{issue.layerName}: </strong>}
                {issue.message}
              </div>
            ))}
          </div>
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn" onClick={cancelPsdImport}>
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn--primary"
            onClick={acceptPsdImport}
            disabled={!report.canProceed}
          >
            Open Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
