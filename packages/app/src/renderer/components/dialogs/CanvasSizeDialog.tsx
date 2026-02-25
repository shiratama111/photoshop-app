import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';

type AnchorPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

function parseDimensionInput(value: string): number {
  return Math.max(1, Number.parseInt(value, 10) || 0);
}

export const CanvasSizeDialog: React.FC = () => {
  const {
    showCanvasSizeDialog,
    document,
    resizeDocument,
    closeCanvasSizeDialog
  } = useAppStore();

  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [anchor, setAnchor] = useState<AnchorPosition>('center');

  useEffect(() => {
    if (document && showCanvasSizeDialog) {
      setWidth(document.canvas.size.width);
      setHeight(document.canvas.size.height);
      setAnchor('center');
    }
  }, [document, showCanvasSizeDialog]);

  if (!showCanvasSizeDialog || !document) {
    return null;
  }

  const handleOk = (): void => {
    if (width > 0 && height > 0) {
      resizeDocument(width, height, { mode: 'canvas', anchor });
      closeCanvasSizeDialog();
    }
  };

  const handleCancel = (): void => {
    closeCanvasSizeDialog();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter') {
      handleOk();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const anchorPositions: AnchorPosition[] = [
    'top-left', 'top-center', 'top-right',
    'middle-left', 'center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right'
  ];

  return (
    <div className="dialog-overlay" onClick={handleCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="dialog-header">
          <h2>Canvas Size</h2>
        </div>

        <div className="dialog-body">
          <div className="new-document-field">
            <label className="new-document-label">Current Size:</label>
            <div style={{ marginLeft: '10px' }}>
              {document.canvas.size.width} x {document.canvas.size.height} px
            </div>
          </div>

          <div className="new-document-field">
            <label className="new-document-label" htmlFor="canvas-width">
              Width:
            </label>
            <input
              id="canvas-width"
              type="number"
              className="new-document-input"
              value={width}
              onChange={(e) => setWidth(parseDimensionInput(e.target.value))}
              min={1}
              autoFocus
            />
            <span className="new-document-unit">px</span>
          </div>

          <div className="new-document-field">
            <label className="new-document-label" htmlFor="canvas-height">
              Height:
            </label>
            <input
              id="canvas-height"
              type="number"
              className="new-document-input"
              value={height}
              onChange={(e) => setHeight(parseDimensionInput(e.target.value))}
              min={1}
            />
            <span className="new-document-unit">px</span>
          </div>

          <div className="new-document-field" style={{ marginTop: '20px' }}>
            <label className="new-document-label">Anchor:</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 32px)',
              gap: '4px',
              marginLeft: '10px'
            }}>
              {anchorPositions.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setAnchor(pos)}
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '2px solid #666',
                    backgroundColor: anchor === pos ? '#4a90e2' : '#2a2a2a',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                  title={pos}
                  aria-label={pos}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn--primary"
            onClick={handleOk}
            disabled={width <= 0 || height <= 0}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
