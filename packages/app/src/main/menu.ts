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
        { type: 'separator' },
        {
          label: 'Fill...',
          accelerator: 'Shift+F5',
          click: (): void => {
            mainWindow.webContents.send('menu:fill');
          },
        },
      ],
    },

    // Select menu
    {
      label: 'Select',
      submenu: [
        {
          label: 'All',
          accelerator: 'CmdOrCtrl+A',
          click: (): void => {
            mainWindow.webContents.send('menu:selectAll');
          },
        },
        {
          label: 'Deselect',
          accelerator: 'CmdOrCtrl+D',
          click: (): void => {
            mainWindow.webContents.send('menu:deselect');
          },
        },
        { type: 'separator' },
        {
          label: 'Crop',
          click: (): void => {
            mainWindow.webContents.send('menu:crop');
          },
        },
      ],
    },

    // Image menu
    {
      label: 'Image',
      submenu: [
        {
          label: 'Adjustments',
          submenu: [
            {
              label: 'Brightness/Contrast...',
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'brightness-contrast');
              },
            },
            {
              label: 'Hue/Saturation...',
              accelerator: 'CmdOrCtrl+U',
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'hue-saturation');
              },
            },
            {
              label: 'Levels...',
              accelerator: 'CmdOrCtrl+L',
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'levels');
              },
            },
            {
              label: 'Curves...',
              accelerator: 'CmdOrCtrl+M',
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'curves');
              },
            },
            {
              label: 'Color Balance...',
              accelerator: 'CmdOrCtrl+B',
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'color-balance');
              },
            },
            { type: 'separator' },
            {
              label: 'Invert',
              accelerator: 'CmdOrCtrl+I',
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'invert');
              },
            },
            {
              label: 'Desaturate',
              accelerator: 'CmdOrCtrl+Shift+U',
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'desaturate');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Image Size...',
          accelerator: 'CmdOrCtrl+Alt+I',
          click: (): void => {
            mainWindow.webContents.send('menu:imageSize');
          },
        },
        {
          label: 'Canvas Size...',
          accelerator: 'CmdOrCtrl+Alt+C',
          click: (): void => {
            mainWindow.webContents.send('menu:canvasSize');
          },
        },
        { type: 'separator' },
        {
          label: 'Image Rotation',
          submenu: [
            {
              label: '180 Degrees',
              click: (): void => {
                mainWindow.webContents.send('menu:rotateCanvas', '180');
              },
            },
            {
              label: '90 Degrees Clockwise',
              click: (): void => {
                mainWindow.webContents.send('menu:rotateCanvas', '90cw');
              },
            },
            {
              label: '90 Degrees Counter-Clockwise',
              click: (): void => {
                mainWindow.webContents.send('menu:rotateCanvas', '90ccw');
              },
            },
            { type: 'separator' },
            {
              label: 'Flip Canvas Horizontal',
              click: (): void => {
                mainWindow.webContents.send('menu:flipCanvas', 'horizontal');
              },
            },
            {
              label: 'Flip Canvas Vertical',
              click: (): void => {
                mainWindow.webContents.send('menu:flipCanvas', 'vertical');
              },
            },
          ],
        },
      ],
    },

    // Filter menu
    {
      label: 'Filter',
      submenu: [
        {
          label: 'Blur',
          submenu: [
            {
              label: 'Gaussian Blur...',
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'gaussianBlur');
              },
            },
            {
              label: 'Motion Blur...',
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'motionBlur');
              },
            },
          ],
        },
        {
          label: 'Sharpen',
          submenu: [
            {
              label: 'Sharpen',
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'sharpen');
              },
            },
          ],
        },
        {
          label: 'Noise',
          submenu: [
            {
              label: 'Add Noise...',
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'addNoise');
              },
            },
            {
              label: 'Reduce Noise...',
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'reduceNoise');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Grayscale',
          click: (): void => {
            mainWindow.webContents.send('menu:filter', 'grayscale');
          },
        },
        {
          label: 'Sepia',
          click: (): void => {
            mainWindow.webContents.send('menu:filter', 'sepia');
          },
        },
        {
          label: 'Posterize...',
          click: (): void => {
            mainWindow.webContents.send('menu:filter', 'posterize');
          },
        },
        {
          label: 'Threshold...',
          click: (): void => {
            mainWindow.webContents.send('menu:filter', 'threshold');
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

