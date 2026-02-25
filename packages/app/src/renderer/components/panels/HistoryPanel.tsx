import React from 'react';
import { useAppStore } from '../../store';

export function HistoryPanel(): React.JSX.Element | null {
  const activeDocument = useAppStore((state) => state.document);
  const historyEntries = useAppStore((state) => state.historyEntries);
  const historyIndex = useAppStore((state) => state.historyIndex);
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);

  const handleEntryClick = (index: number): void => {
    const diff = index - historyIndex;

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        redo();
      }
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        undo();
      }
    }
  };

  if (!activeDocument) {
    return null;
  }

  return (
    <div className="history-panel">
      <div className="sidebar-header">
        <span>History</span>
      </div>

      <div className="history-list">
        {historyEntries.map((label, index) => (
          <div
            key={index}
            className={`history-item ${index === historyIndex ? 'history-item--active' : ''}`}
            onClick={() => handleEntryClick(index)}
            style={{ cursor: 'pointer' }}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="history-actions" style={{ padding: '8px', display: 'flex', gap: '8px' }}>
        <button
          className="layer-action-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
        >
          ↶ Undo
        </button>
        <button
          className="layer-action-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
        >
          ↷ Redo
        </button>
      </div>
    </div>
  );
}
