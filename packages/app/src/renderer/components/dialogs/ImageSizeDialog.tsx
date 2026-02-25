import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';

function normalizeDimension(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

export const ImageSizeDialog: React.FC = () => {
  const { showImageSizeDialog, document, resizeDocument, closeImageSizeDialog } = useAppStore();

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [constrainProportions, setConstrainProportions] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    if (showImageSizeDialog && document) {
      setWidth(document.canvas.size.width);
      setHeight(document.canvas.size.height);
      setAspectRatio(document.canvas.size.width / document.canvas.size.height);
    }
  }, [showImageSizeDialog, document]);

  if (!showImageSizeDialog || !document) {
    return null;
  }

  const calculateMegapixels = (w: number, h: number): string => {
    return ((w * h) / 1_000_000).toFixed(2);
  };

  const handleWidthChange = (newWidth: number): void => {
    const normalizedWidth = normalizeDimension(newWidth);
    setWidth(normalizedWidth);
    if (constrainProportions && aspectRatio > 0) {
      setHeight(normalizeDimension(normalizedWidth / aspectRatio));
    }
  };

  const handleHeightChange = (newHeight: number): void => {
    const normalizedHeight = normalizeDimension(newHeight);
    setHeight(normalizedHeight);
    if (constrainProportions && aspectRatio > 0) {
      setWidth(normalizeDimension(normalizedHeight * aspectRatio));
    }
  };

  const handleOk = (): void => {
    if (width > 0 && height > 0) {
      resizeDocument(width, height, { mode: 'image' });
      closeImageSizeDialog();
    }
  };

  const handleCancel = (): void => {
    closeImageSizeDialog();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter') {
      handleOk();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog" onKeyDown={handleKeyDown}>
        <div className="dialog-header">
          <h2>Image Size</h2>
        </div>

        <div className="dialog-body">
          <div className="new-document-field">
            <label className="new-document-label">Current Size:</label>
            <div>
              {document.canvas.size.width} x {document.canvas.size.height} px ({calculateMegapixels(document.canvas.size.width, document.canvas.size.height)} MP)
            </div>
          </div>

          <div className="new-document-field">
            <label className="new-document-label" htmlFor="width">Width:</label>
            <input
              id="width"
              type="number"
              className="new-document-input"
              value={width}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              min={1}
            />
            <span className="new-document-unit">px</span>
          </div>

          <div className="new-document-field">
            <label className="new-document-label" htmlFor="height">Height:</label>
            <input
              id="height"
              type="number"
              className="new-document-input"
              value={height}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              min={1}
            />
            <span className="new-document-unit">px</span>
          </div>

          <div className="new-document-field">
            <label className="new-document-label">
              <input
                type="checkbox"
                checked={constrainProportions}
                onChange={(e) => setConstrainProportions(e.target.checked)}
              />
              Constrain Proportions
            </label>
          </div>

          <div className="new-document-field">
            <label className="new-document-label">New Size:</label>
            <div>
              {width} x {height} px ({calculateMegapixels(width, height)} MP)
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button className="dialog-btn dialog-btn--primary" onClick={handleOk} disabled={width <= 0 || height <= 0}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
