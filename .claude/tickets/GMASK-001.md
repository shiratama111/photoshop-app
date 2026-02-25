# GMASK-001: グラデーションマスク

## 目的
画像の一部をフェードアウトさせるグラデーションマスクを実装する。
サムネイルでテキストエリアを確保するための半透明グラデーション合成に必須。

## 対象パッケージ
- `packages/render`（グラデーションマスク描画ロジック）
- `packages/app`（UIのみ）

## 推奨ブランチ
- `feat/gmask-001-gradient-mask`

## 現状
- `GradientMaskDialog.tsx`: ダイアログが存在するが機能は基本的
- **レンダリング側のグラデーションマスク処理は未実装 or 限定的**

## 編集可能ファイル
- `packages/render/src/gradient-mask.ts` — **新規作成**
- `packages/render/src/gradient-mask.test.ts` — **新規作成**
- `packages/app/src/renderer/components/dialogs/GradientMaskDialog.tsx` — UI拡充

## 編集禁止ファイル
- `packages/render/src/compositor.ts`（CLIP-001の担当がWave 6で完了後のみ触れる）
- `packages/render/src/decorations.ts`（DECO-001の担当）
- `packages/app/src/renderer/store.ts`
- `packages/app/src/renderer/components/dialogs/BackgroundDialog.tsx`（BG-001の担当）
- `packages/core/` 配下全て

## 実装要件（Must）
1. **グラデーションマスク生成**（`gradient-mask.ts`）
   - 線形グラデーションマスク（方向: 上→下, 左→右, 斜め等）
   - 放射状グラデーションマスク（中心→外側にフェード）
   - 開始/終了位置の調整（0-100%）
   - マスクの反転

2. **マスク適用**
   - 指定レイヤーにグラデーションマスクを適用
   - マスクはアルファチャンネルとして機能（完全不透明→完全透明のグラデーション）
   - 非破壊適用（マスクの解除で元に戻せる）

3. **UI**（`GradientMaskDialog.tsx`拡充）
   - グラデーション方向の選択（8方向 + カスタム角度）
   - 開始/終了位置のスライダー
   - リアルタイムプレビュー
   - 線形/放射状の切り替え

## 実装要件（Should）
1. マスクのフェザリング（エッジの滑らかさ調整）
2. キャンバス上でのドラッグによるグラデーション方向設定

## 受け入れ基準
1. 線形グラデーションマスクが適用できる
2. 放射状グラデーションマスクが適用できる
3. マスクの方向・開始/終了位置が変更できる
4. マスクを解除して元に戻せる

## 必須テスト
- 線形グラデーションマスク生成テスト
- 放射状グラデーションマスク生成テスト
- マスク適用/解除テスト
- パラメータ変更テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/render test`
- `pnpm --filter @photoshop-app/app test`
- `pnpm lint`
