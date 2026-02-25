import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

let capturedTemplate: MenuItemConstructorOptions[] = [];

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: vi.fn((template: MenuItemConstructorOptions[]) => {
      capturedTemplate = template;
      return {} as unknown;
    }),
    setApplicationMenu: vi.fn(),
  },
}));

import { buildMenu } from './menu';

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as BrowserWindow;
}

function findTopMenu(label: string): MenuItemConstructorOptions | undefined {
  return capturedTemplate.find((item) => item.label === label);
}

function getSubmenu(menu: MenuItemConstructorOptions): MenuItemConstructorOptions[] {
  return Array.isArray(menu.submenu) ? (menu.submenu as MenuItemConstructorOptions[]) : [];
}

describe('buildMenu', () => {
  beforeEach(() => {
    capturedTemplate = [];
    vi.clearAllMocks();
  });

  it('renders top-level menus in Japanese', () => {
    buildMenu(createMockWindow());

    expect(findTopMenu('ファイル')).toBeDefined();
    expect(findTopMenu('編集')).toBeDefined();
    expect(findTopMenu('選択範囲')).toBeDefined();
    expect(findTopMenu('イメージ')).toBeDefined();
    expect(findTopMenu('フィルター')).toBeDefined();
    expect(findTopMenu('表示')).toBeDefined();
    expect(findTopMenu('ヘルプ')).toBeDefined();
  });

  it('renders key submenu labels in Japanese', () => {
    buildMenu(createMockWindow());

    const file = findTopMenu('ファイル');
    const edit = findTopMenu('編集');
    const image = findTopMenu('イメージ');
    const view = findTopMenu('表示');

    expect(file).toBeDefined();
    expect(edit).toBeDefined();
    expect(image).toBeDefined();
    expect(view).toBeDefined();

    expect(getSubmenu(file!).some((item) => item.label === '新規')).toBe(true);
    expect(getSubmenu(file!).some((item) => item.label === '開く...')).toBe(true);
    expect(getSubmenu(edit!).some((item) => item.label === '取り消し')).toBe(true);
    expect(getSubmenu(image!).some((item) => item.label === '色調補正')).toBe(true);
    expect(getSubmenu(view!).some((item) => item.label === 'ズームイン')).toBe(true);
  });

  it('keeps existing keyboard shortcuts', () => {
    buildMenu(createMockWindow());

    const file = findTopMenu('ファイル');
    const edit = findTopMenu('編集');
    const view = findTopMenu('表示');

    expect(file).toBeDefined();
    expect(edit).toBeDefined();
    expect(view).toBeDefined();

    const fileItems = getSubmenu(file!);
    const editItems = getSubmenu(edit!);
    const viewItems = getSubmenu(view!);

    expect(fileItems.find((item) => item.label === '新規')?.accelerator).toBe('CmdOrCtrl+N');
    expect(fileItems.find((item) => item.label === '保存')?.accelerator).toBe('CmdOrCtrl+S');
    expect(editItems.find((item) => item.label === '取り消し')?.accelerator).toBe('CmdOrCtrl+Z');
    expect(viewItems.find((item) => item.label === 'ズームイン')?.accelerator).toBe('CmdOrCtrl+=');
  });
});
