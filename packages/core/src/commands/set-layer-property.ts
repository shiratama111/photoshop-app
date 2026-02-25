/**
 * @module commands/set-layer-property
 * Generic command for changing any property on a layer.
 *
 * @see CORE-002: SetLayerPropertyCommand
 */

import type { Command, Layer } from '@photoshop-app/types';

/** Japanese labels for common layer property names. */
const PROPERTY_LABELS: Record<string, string> = {
  opacity: '不透明度',
  visible: '表示',
  blendMode: '描画モード',
  name: '名前',
  locked: 'ロック',
  position: '位置',
  effects: 'エフェクト',
  fontSize: '文字サイズ',
  fontFamily: 'フォント',
  text: 'テキスト',
  writingMode: '文字方向',
};

/**
 * Sets a single property on a layer, capturing the old value for undo.
 *
 * @typeParam K - The property key being modified.
 */
export class SetLayerPropertyCommand<K extends keyof Layer> implements Command {
  readonly description: string;
  private readonly layer: Layer;
  private readonly key: K;
  private readonly oldValue: Layer[K];
  private readonly newValue: Layer[K];

  /**
   * @param layer    - The layer to modify.
   * @param key      - Property name to change.
   * @param newValue - The new value for the property.
   */
  constructor(layer: Layer, key: K, newValue: Layer[K]) {
    this.layer = layer;
    this.key = key;
    this.oldValue = layer[key];
    this.newValue = newValue;
    const label = PROPERTY_LABELS[key as string] ?? String(key);
    this.description = `「${layer.name}」の${label}を変更`;
  }

  /** Apply the new value. */
  execute(): void {
    (this.layer as unknown as Record<string, unknown>)[this.key as string] = this.newValue;
  }

  /** Restore the old value. */
  undo(): void {
    (this.layer as unknown as Record<string, unknown>)[this.key as string] = this.oldValue;
  }
}
