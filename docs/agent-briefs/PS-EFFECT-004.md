# PS-EFFECT-004: Bevel & Emboss 描画実装

## 目的
`bevel-emboss` を実装し、レイヤーに立体感（ハイライト/シャドウ）を与える。

## 対象パッケージ
- `packages/render`

## 推奨ブランチ
- `feat/ps-effect-004-bevel-emboss-render`

## 依存
- `PS-EFFECT-003` マージ後推奨（同一ファイル競合回避）

## 編集可能ファイル
- `packages/render/src/compositor.ts`
- `packages/render/src/compositor.test.ts`

## 実装方針
Canvas2Dでは Photoshop 完全再現は困難なため、実用優先の近似実装を行う。

## 実装要件（Must）
1. `renderEffectsInFront` で `bevel-emboss` を処理する。
2. `style` 5種（outer/inner/emboss/pillow/stroke）を受け取り描画分岐する。
3. `highlightColor/highlightOpacity` と `shadowColor/shadowOpacity` を反映する。
4. `angle/altitude/depth/size/soften/direction` を反映する。
5. text/raster の両方で破綻しない。

## 実装要件（Should）
1. 近似モデルの前提をコメントで明記する。
2. 極端値（size=0, depth大）で例外やNaNを出さない。

## 受け入れ基準
1. 光源角度変更でハイライト/シャドウ位置が変わる。
2. direction up/down で見え方が変わる。
3. style 切替で見た目差が出る。

## 必須テスト
- bevel-emboss の基本描画テスト
- angle/direction/style の分岐テスト
- disabled 時のスキップ

## 実行コマンド
- `pnpm --filter @photoshop-app/render test`
- `pnpm lint`

## 手動確認手順
1. テキスト/ラスター双方に bevel-emboss を適用
2. angle/altitude/depth を変更
3. style と direction の差分確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 既知の近似制約
