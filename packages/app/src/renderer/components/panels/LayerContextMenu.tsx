/**
 * @module components/panels/LayerContextMenu
 * Right-click context menu for layer operations.
 *
 * Positioned at the click coordinates using a portal.
 * Closes on click outside or Escape key.
 *
 * Actions:
 * - Duplicate Layer
 * - Delete Layer
 * - Rename Layer (triggers inline edit)
 * - Add Layer Above
 * - Add Group
 *
 * @see APP-002: Layer panel right-click menu
 */

import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store';

/** Context menu item definition. */
interface MenuItem {
  /** Display label. */
  label: string;
  /** Action callback. */
  action: () => void;
  /** Whether this item is destructive (shown in red). */
  danger?: boolean;
  /** Whether this item is disabled. */
  disabled?: boolean;
}

/** LayerContextMenu renders a positioned context menu for layer operations. */
export function LayerContextMenu(): React.JSX.Element | null {
  const contextMenu = useAppStore((s) => s.contextMenu);
  const hideContextMenu = useAppStore((s) => s.hideContextMenu);
  const duplicateLayer = useAppStore((s) => s.duplicateLayer);
  const removeLayer = useAppStore((s) => s.removeLayer);
  const addRasterLayer = useAppStore((s) => s.addRasterLayer);
  const addLayerGroup = useAppStore((s) => s.addLayerGroup);

  const menuRef = useRef<HTMLDivElement>(null);

  /** Close menu on click outside. */
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    };

    // Delay to avoid catching the right-click itself
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleEscape);
    }, 0);

    return (): void => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu, hideContextMenu]);

  if (!contextMenu) return null;

  const { x, y, layerId } = contextMenu;

  const items: MenuItem[] = [
    {
      label: 'Duplicate Layer',
      action: (): void => {
        duplicateLayer(layerId);
        hideContextMenu();
      },
    },
    {
      label: 'Add Layer Above',
      action: (): void => {
        addRasterLayer();
        hideContextMenu();
      },
    },
    {
      label: 'Add Group',
      action: (): void => {
        addLayerGroup();
        hideContextMenu();
      },
    },
    {
      label: 'Delete Layer',
      action: (): void => {
        removeLayer(layerId);
        hideContextMenu();
      },
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          className={`context-menu-item ${item.danger ? 'context-menu-item--danger' : ''}`}
          onClick={item.action}
          disabled={item.disabled}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
