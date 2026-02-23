/**
 * @module menu
 * Application menu builder for the Electron main process.
 *
 * Menu structure:
 * - File: New, Open, Save, Save As, Export, Quit
 * - Edit: Undo, Redo
 * - View: Zoom In, Zoom Out, Fit to Window, Actual Size
 * - Help: About
 */

import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';

/**
 * Build and set the application menu.
 * @param mainWindow - The main BrowserWindow for sending IPC messages.
 */
export function buildMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Photoshop App',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: (): void => {
            mainWindow.webContents.send('menu:new');
          },
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: (): void => {
            mainWindow.webContents.send('menu:open');
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: (): void => {
            mainWindow.webContents.send('menu:save');
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: (): void => {
            mainWindow.webContents.send('menu:saveAs');
          },
        },
        { type: 'separator' },
        {
          label: 'Export...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: (): void => {
            mainWindow.webContents.send('menu:export');
          },
        },
        { type: 'separator' },
        ...(isMac ? [] : [{ role: 'quit' as const }]),
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: (): void => {
            mainWindow.webContents.send('menu:undo');
          },
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: (): void => {
            mainWindow.webContents.send('menu:redo');
          },
        },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: (): void => {
            mainWindow.webContents.send('menu:zoomIn');
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: (): void => {
            mainWindow.webContents.send('menu:zoomOut');
          },
        },
        { type: 'separator' },
        {
          label: 'Fit to Window',
          accelerator: 'CmdOrCtrl+0',
          click: (): void => {
            mainWindow.webContents.send('menu:fitToWindow');
          },
        },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+1',
          click: (): void => {
            mainWindow.webContents.send('menu:actualSize');
          },
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Photoshop App',
          click: (): void => {
            mainWindow.webContents.send('menu:about');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
