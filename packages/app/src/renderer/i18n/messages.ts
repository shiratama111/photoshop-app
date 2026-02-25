/**
 * @module i18n/messages
 * Locale message definitions for the application.
 *
 * Each locale is a flat Record<string, string> keyed by dot-delimited
 * message IDs.  Adding a new language only requires a new entry here
 * and registering it in {@link ./index.ts}.
 *
 * Vocabulary follows Adobe Photoshop Japanese UI conventions.
 */

/** Message catalog type – every locale must satisfy this shape. */
export type MessageCatalog = Record<string, string>;

/** Japanese (ja) message catalog. */
export const ja: MessageCatalog = {
  'menu.app.name': 'Photoshop App',

  // ── File menu ──────────────────────────────────────
  'menu.file': 'ファイル',
  'menu.file.new': '新規',
  'menu.file.open': '開く...',
  'menu.file.save': '保存',
  'menu.file.saveAs': '別名で保存...',
  'menu.file.export': '書き出し...',
  'menu.file.quit': '終了',

  // ── Edit menu ──────────────────────────────────────
  'menu.edit': '編集',
  'menu.edit.undo': '取り消し',
  'menu.edit.redo': 'やり直し',
  'menu.edit.fill': '塗りつぶし...',

  // ── Select menu ────────────────────────────────────
  'menu.select': '選択範囲',
  'menu.select.all': 'すべてを選択',
  'menu.select.deselect': '選択を解除',
  'menu.select.crop': '切り抜き',

  // ── Image menu ─────────────────────────────────────
  'menu.image': 'イメージ',
  'menu.image.adjustments': '色調補正',
  'menu.image.adjustments.brightnessContrast': '明るさ・コントラスト...',
  'menu.image.adjustments.hueSaturation': '色相・彩度...',
  'menu.image.adjustments.levels': 'レベル補正...',
  'menu.image.adjustments.curves': 'トーンカーブ...',
  'menu.image.adjustments.colorBalance': 'カラーバランス...',
  'menu.image.adjustments.invert': '階調の反転',
  'menu.image.adjustments.desaturate': '彩度を下げる',
  'menu.image.imageSize': '画像解像度...',
  'menu.image.canvasSize': 'カンバスサイズ...',
  'menu.image.rotation': 'カンバスの回転',
  'menu.image.rotation.180': '180°',
  'menu.image.rotation.90cw': '90°（時計回り）',
  'menu.image.rotation.90ccw': '90°（反時計回り）',
  'menu.image.rotation.flipHorizontal': 'カンバスを左右に反転',
  'menu.image.rotation.flipVertical': 'カンバスを上下に反転',

  // ── Filter menu ────────────────────────────────────
  'menu.filter': 'フィルター',
  'menu.filter.blur': 'ぼかし',
  'menu.filter.blur.gaussian': 'ぼかし（ガウス）...',
  'menu.filter.blur.motion': 'ぼかし（移動）...',
  'menu.filter.sharpen': 'シャープ',
  'menu.filter.sharpen.sharpen': 'シャープ',
  'menu.filter.noise': 'ノイズ',
  'menu.filter.noise.add': 'ノイズを加える...',
  'menu.filter.noise.reduce': 'ノイズを軽減...',
  'menu.filter.grayscale': 'グレースケール',
  'menu.filter.sepia': 'セピア',
  'menu.filter.posterize': 'ポスタリゼーション...',
  'menu.filter.threshold': '2階調化...',

  // ── View menu ──────────────────────────────────────
  'menu.view': '表示',
  'menu.view.zoomIn': 'ズームイン',
  'menu.view.zoomOut': 'ズームアウト',
  'menu.view.fitToWindow': 'ウィンドウサイズに合わせる',
  'menu.view.actualSize': '100%表示',

  // ── Help menu ──────────────────────────────────────
  'menu.help': 'ヘルプ',
  'menu.help.about': 'Photoshop App について',
};

/** English (en) message catalog — used as fallback. */
export const en: MessageCatalog = {
  'menu.app.name': 'Photoshop App',

  // ── File menu ──────────────────────────────────────
  'menu.file': 'File',
  'menu.file.new': 'New',
  'menu.file.open': 'Open...',
  'menu.file.save': 'Save',
  'menu.file.saveAs': 'Save As...',
  'menu.file.export': 'Export...',
  'menu.file.quit': 'Quit',

  // ── Edit menu ──────────────────────────────────────
  'menu.edit': 'Edit',
  'menu.edit.undo': 'Undo',
  'menu.edit.redo': 'Redo',
  'menu.edit.fill': 'Fill...',

  // ── Select menu ────────────────────────────────────
  'menu.select': 'Select',
  'menu.select.all': 'All',
  'menu.select.deselect': 'Deselect',
  'menu.select.crop': 'Crop',

  // ── Image menu ─────────────────────────────────────
  'menu.image': 'Image',
  'menu.image.adjustments': 'Adjustments',
  'menu.image.adjustments.brightnessContrast': 'Brightness/Contrast...',
  'menu.image.adjustments.hueSaturation': 'Hue/Saturation...',
  'menu.image.adjustments.levels': 'Levels...',
  'menu.image.adjustments.curves': 'Curves...',
  'menu.image.adjustments.colorBalance': 'Color Balance...',
  'menu.image.adjustments.invert': 'Invert',
  'menu.image.adjustments.desaturate': 'Desaturate',
  'menu.image.imageSize': 'Image Size...',
  'menu.image.canvasSize': 'Canvas Size...',
  'menu.image.rotation': 'Image Rotation',
  'menu.image.rotation.180': '180 Degrees',
  'menu.image.rotation.90cw': '90 Degrees Clockwise',
  'menu.image.rotation.90ccw': '90 Degrees Counter-Clockwise',
  'menu.image.rotation.flipHorizontal': 'Flip Canvas Horizontal',
  'menu.image.rotation.flipVertical': 'Flip Canvas Vertical',

  // ── Filter menu ────────────────────────────────────
  'menu.filter': 'Filter',
  'menu.filter.blur': 'Blur',
  'menu.filter.blur.gaussian': 'Gaussian Blur...',
  'menu.filter.blur.motion': 'Motion Blur...',
  'menu.filter.sharpen': 'Sharpen',
  'menu.filter.sharpen.sharpen': 'Sharpen',
  'menu.filter.noise': 'Noise',
  'menu.filter.noise.add': 'Add Noise...',
  'menu.filter.noise.reduce': 'Reduce Noise...',
  'menu.filter.grayscale': 'Grayscale',
  'menu.filter.sepia': 'Sepia',
  'menu.filter.posterize': 'Posterize...',
  'menu.filter.threshold': 'Threshold...',

  // ── View menu ──────────────────────────────────────
  'menu.view': 'View',
  'menu.view.zoomIn': 'Zoom In',
  'menu.view.zoomOut': 'Zoom Out',
  'menu.view.fitToWindow': 'Fit to Window',
  'menu.view.actualSize': 'Actual Size',

  // ── Help menu ──────────────────────────────────────
  'menu.help': 'Help',
  'menu.help.about': 'About Photoshop App',
};

/** All available locale catalogs, keyed by BCP-47 tag. */
export const localeCatalogs: Record<string, MessageCatalog> = { ja, en };
