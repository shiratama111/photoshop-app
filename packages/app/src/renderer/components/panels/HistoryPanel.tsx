import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store';

interface HistoryEntry {
  id: number;
  revision: number;
  label: string;
}

export function HistoryPanel(): React.JSX.Element | null {
  const activeDocument = useAppStore((state) => state.document);
  const revision = useAppStore((state) => state.revision);
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);

  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([
    { id: 0, revision: 0, label: 'Original' }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!activeDocument) {
      setHistoryEntries([{ id: 0, revision: 0, label: 'Original' }]);
      setCurrentIndex(0);
      return;
    }

    setHistoryEntries((prev) => {
      const lastEntry = prev[prev.length - 1];

      if (revision > lastEntry.revision) {
        const newEntry: HistoryEntry = {
          id: prev.length,
          revision,
          label: `Action ${prev.length}`
        };
        const newHistory = [...prev, newEntry];
        setCurrentIndex(newHistory.length - 1);
        return newHistory;
      }

      const currentIdx = prev.findIndex((entry) => entry.revision === revision);
      if (currentIdx !== -1) {
        setCurrentIndex(currentIdx);
      }

      return prev;
    });
  }, [revision, activeDocument]);

  const handleEntryClick = (index: number) => {
    const diff = index - currentIndex;

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
        {historyEntries.map((entry, index) => (
          <div
            key={entry.id}
            className={`history-item ${index === currentIndex ? 'history-item--active' : ''}`}
            onClick={() => handleEntryClick(index)}
            style={{ cursor: 'pointer' }}
          >
            {entry.label}
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
