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
import { t } from '../renderer/i18n/index';

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
            label: t('menu.app.name'),
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
      label: t('menu.file'),
      submenu: [
        {
          label: t('menu.file.new'),
          accelerator: 'CmdOrCtrl+N',
          click: (): void => {
            mainWindow.webContents.send('menu:new');
          },
        },
        {
          label: t('menu.file.open'),
          accelerator: 'CmdOrCtrl+O',
          click: (): void => {
            mainWindow.webContents.send('menu:open');
          },
        },
        { type: 'separator' },
        {
          label: t('menu.file.save'),
          accelerator: 'CmdOrCtrl+S',
          click: (): void => {
            mainWindow.webContents.send('menu:save');
          },
        },
        {
          label: t('menu.file.saveAs'),
          accelerator: 'CmdOrCtrl+Shift+S',
          click: (): void => {
            mainWindow.webContents.send('menu:saveAs');
          },
        },
        { type: 'separator' },
        {
          label: t('menu.file.export'),
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
      label: t('menu.edit'),
      submenu: [
        {
          label: t('menu.edit.undo'),
          accelerator: 'CmdOrCtrl+Z',
          click: (): void => {
            mainWindow.webContents.send('menu:undo');
          },
        },
        {
          label: t('menu.edit.redo'),
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: (): void => {
            mainWindow.webContents.send('menu:redo');
          },
        },
        { type: 'separator' },
        {
          label: t('menu.edit.fill'),
          accelerator: 'Shift+F5',
          click: (): void => {
            mainWindow.webContents.send('menu:fill');
          },
        },
      ],
    },

    // Select menu
    {
      label: t('menu.select'),
      submenu: [
        {
          label: t('menu.select.all'),
          accelerator: 'CmdOrCtrl+A',
          click: (): void => {
            mainWindow.webContents.send('menu:selectAll');
          },
        },
        {
          label: t('menu.select.deselect'),
          accelerator: 'CmdOrCtrl+D',
          click: (): void => {
            mainWindow.webContents.send('menu:deselect');
          },
        },
        { type: 'separator' },
        {
          label: t('menu.select.crop'),
          click: (): void => {
            mainWindow.webContents.send('menu:crop');
          },
        },
      ],
    },

    // Image menu
    {
      label: t('menu.image'),
      submenu: [
        {
          label: t('menu.image.adjustments'),
          submenu: [
            {
              label: t('menu.image.adjustments.brightnessContrast'),
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'brightness-contrast');
              },
            },
            {
              label: t('menu.image.adjustments.hueSaturation'),
              accelerator: 'CmdOrCtrl+U',
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'hue-saturation');
              },
            },
            {
              label: t('menu.image.adjustments.levels'),
              accelerator: 'CmdOrCtrl+L',
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'levels');
              },
            },
            {
              label: t('menu.image.adjustments.curves'),
              accelerator: 'CmdOrCtrl+M',
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'curves');
              },
            },
            {
              label: t('menu.image.adjustments.colorBalance'),
              accelerator: 'CmdOrCtrl+B',
              click: (): void => {
                mainWindow.webContents.send('menu:adjustment', 'color-balance');
              },
            },
            { type: 'separator' },
            {
              label: t('menu.image.adjustments.invert'),
              accelerator: 'CmdOrCtrl+I',
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'invert');
              },
            },
            {
              label: t('menu.image.adjustments.desaturate'),
              accelerator: 'CmdOrCtrl+Shift+U',
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'desaturate');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: t('menu.image.imageSize'),
          accelerator: 'CmdOrCtrl+Alt+I',
          click: (): void => {
            mainWindow.webContents.send('menu:imageSize');
          },
        },
        {
          label: t('menu.image.canvasSize'),
          accelerator: 'CmdOrCtrl+Alt+C',
          click: (): void => {
            mainWindow.webContents.send('menu:canvasSize');
          },
        },
        { type: 'separator' },
        {
          label: t('menu.image.rotation'),
          submenu: [
            {
              label: t('menu.image.rotation.180'),
              click: (): void => {
                mainWindow.webContents.send('menu:rotateCanvas', '180');
              },
            },
            {
              label: t('menu.image.rotation.90cw'),
              click: (): void => {
                mainWindow.webContents.send('menu:rotateCanvas', '90cw');
              },
            },
            {
              label: t('menu.image.rotation.90ccw'),
              click: (): void => {
                mainWindow.webContents.send('menu:rotateCanvas', '90ccw');
              },
            },
            { type: 'separator' },
            {
              label: t('menu.image.rotation.flipHorizontal'),
              click: (): void => {
                mainWindow.webContents.send('menu:flipCanvas', 'horizontal');
              },
            },
            {
              label: t('menu.image.rotation.flipVertical'),
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
      label: t('menu.filter'),
      submenu: [
        {
          label: t('menu.filter.blur'),
          submenu: [
            {
              label: t('menu.filter.blur.gaussian'),
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'gaussianBlur');
              },
            },
            {
              label: t('menu.filter.blur.motion'),
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'motionBlur');
              },
            },
          ],
        },
        {
          label: t('menu.filter.sharpen'),
          submenu: [
            {
              label: t('menu.filter.sharpen.sharpen'),
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'sharpen');
              },
            },
          ],
        },
        {
          label: t('menu.filter.noise'),
          submenu: [
            {
              label: t('menu.filter.noise.add'),
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'addNoise');
              },
            },
            {
              label: t('menu.filter.noise.reduce'),
              click: (): void => {
                mainWindow.webContents.send('menu:filter', 'reduceNoise');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: t('menu.filter.grayscale'),
          click: (): void => {
            mainWindow.webContents.send('menu:filter', 'grayscale');
          },
        },
        {
          label: t('menu.filter.sepia'),
          click: (): void => {
            mainWindow.webContents.send('menu:filter', 'sepia');
          },
        },
        {
          label: t('menu.filter.posterize'),
          click: (): void => {
            mainWindow.webContents.send('menu:filter', 'posterize');
          },
        },
        {
          label: t('menu.filter.threshold'),
          click: (): void => {
            mainWindow.webContents.send('menu:filter', 'threshold');
          },
        },
      ],
    },

    // View menu
    {
      label: t('menu.view'),
      submenu: [
        {
          label: t('menu.view.zoomIn'),
          accelerator: 'CmdOrCtrl+=',
          click: (): void => {
            mainWindow.webContents.send('menu:zoomIn');
          },
        },
        {
          label: t('menu.view.zoomOut'),
          accelerator: 'CmdOrCtrl+-',
          click: (): void => {
            mainWindow.webContents.send('menu:zoomOut');
          },
        },
        { type: 'separator' },
        {
          label: t('menu.view.fitToWindow'),
          accelerator: 'CmdOrCtrl+0',
          click: (): void => {
            mainWindow.webContents.send('menu:fitToWindow');
          },
        },
        {
          label: t('menu.view.actualSize'),
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
      label: t('menu.help'),
      submenu: [
        {
          label: t('menu.help.about'),
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

