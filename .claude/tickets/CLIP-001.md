# CLIP-001: クリッピングマスク

## 目的
レイヤーのクリッピングマスク機能を実装する。
上のレイヤーを下のレイヤーの不透明領域で切り抜く、Photoshop同等の基本機能。

## 対象パッケージ
- `packages/core`（レイヤーモデルにclippingプロパティ追加）
- `packages/render`（クリッピング描画ロジック）

## 推奨ブランチ
- `feat/clip-001-clipping-mask`

## 現状
- `Layer` 型に `clippingMask` プロパティなし（`packages/types/src/layer.ts` は locked）
- `core/src/layer-tree.ts`: レイヤーツリー操作
- `render/src/compositor.ts`: レイヤー合成（ブレンドモード・エフェクト対応済み）
- **クリッピングマスクは未実装**

## 編集可能ファイル
- `packages/core/src/layer-tree.ts` — クリッピングマスク関連のユーティリティ関数追加
- `packages/core/src/layer-tree.test.ts` — テスト追加（新規 or 既存に追加）
- `packages/render/src/compositor.ts` — クリッピングマスク描画ロジック追加
- `packages/render/src/compositor.test.ts` — テスト追加

## 編集禁止ファイル
- `packages/types/` 配下（locked — 型追加が必要な場合はチケットノートに記載）
- `packages/core/src/procedural.ts`（DECO-001の担当）
- `packages/render/src/decorations.ts`（DECO-001の担当）
- `packages/app/` 配下全て

## types パッケージへの要求事項
> `packages/types` は locked のため、以下の型変更をコーディネーターに報告すること:
>
> `Layer` 型に `clippingMask: boolean` プロパティ追加（デフォルト: `false`）
>
> 暫定対応として `core/layer-tree.ts` 内にローカル型拡張を定義してもよい。

## 実装要件（Must）
1. **クリッピングマスクプロパティ**
   - レイヤーに `clippingMask: boolean` フラグ（UIからトグル）
   - `clippingMask: true` のレイヤーは、直下の `clippingMask: false` レイヤーの不透明領域でクリップされる
   - 連続する複数のクリッピングレイヤーがすべて同じベースレイヤーにクリップされる

2. **レイヤーツリーユーティリティ**（`layer-tree.ts`に追加）
   - `getClippingBase(layer, siblings)`: クリッピングのベースレイヤーを返す
   - `getClippedLayers(baseLayer, siblings)`: ベースレイヤーにクリップされているレイヤー一覧を返す
   - `toggleClippingMask(layerId)`: クリッピングマスクのオン/オフ切替

3. **クリッピング描画**（`compositor.ts`に追加）
   - ベースレイヤーのアルファチャンネルをクリッピングマスクとして使用
   - `globalCompositeOperation = 'source-atop'` or 明示的なアルファマスク処理
   - クリッピングされたレイヤーのエフェクトはクリッピング後に適用
   - クリッピンググループ全体のブレンドモードはベースレイヤーに従う

4. **PSD互換性**
   - PSD読込時に `clipping` フラグを `clippingMask` プロパティに反映
   - PSD書出時に `clippingMask` を `clipping` フラグとして出力

## 実装要件（Should）
1. レイヤーパネルでのクリッピング表示（インデント or 矢印アイコン）
2. Alt+クリックでクリッピングマスクをトグル（Photoshop互換ショートカット）

## 受け入れ基準
1. クリッピングマスクが設定できる
2. 上のレイヤーが下のレイヤーの形に切り抜かれて描画される
3. 連続クリッピングレイヤーが正しく動作する
4. エフェクト付きレイヤーでクリッピングが正しく描画される
5. 既存のレイヤー操作・描画に回帰がない

## 必須テスト
- クリッピングマスク設定/解除テスト
- クリッピング描画テスト（ベースレイヤーの形に切り抜かれる）
- 連続クリッピングテスト（3レイヤー以上）
- エフェクト付きクリッピングテスト
- PSD読込/書出のクリッピングフラグテスト

## 実行コマンド
- `pnpm --filter @photoshop-app/core test`
- `pnpm --filter @photoshop-app/render test`
- `pnpm lint`
