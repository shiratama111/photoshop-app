# PS-EFFECT-001: Inner Shadow 描画実装

## 目的
`inner-shadow` エフェクトを Canvas2D compositor に実装し、レイヤー内側に影を描画できるようにする。

## 対象パッケージ
- `packages/render`

## 推奨ブランチ
- `feat/ps-effect-001-inner-shadow-render`

## 現状
- 型定義（`InnerShadowEffect`）は存在
- `compositor.ts` は `drop-shadow / outer-glow / stroke / color-overlay` のみ実装

## 編集可能ファイル
- `packages/render/src/compositor.ts`
- `packages/render/src/compositor.test.ts`

## 実装要件（Must）
1. `renderEffectsInFront` で `inner-shadow` を処理する。
2. `renderInnerShadow` を追加する。
3. 影はレイヤーの内側だけに出る（外側へは漏らさない）。
4. `angle / distance / blur / choke / opacity / color` を反映する。
5. `raster` と `text` の両方に対応する。
6. `effect.enabled === false` の場合は描画しない。

## 実装要件（Should）
1. 既存の `drop-shadow` とロジックを共有しつつ、内側クリップだけ差分化する。
2. 描画コスト増を抑える（不要な offscreen 生成を避ける）。

## 受け入れ基準
1. テキストレイヤーで内側影が確認できる。
2. ラスターレイヤーで内側影が確認できる。
3. `renderEffects=false` で描画されない。
4. 既存効果（drop/outer/stroke/color-overlay）の回帰がない。

## 必須テスト
- `inner-shadow` が描画されるテスト（text/raster）
- `enabled=false` でスキップされるテスト
- 既存 effect テストが通ること

## 実行コマンド
- `pnpm --filter @photoshop-app/render test`
- `pnpm lint`

## 手動確認手順
1. テキストに Inner Shadow をON
2. 角度・距離・ぼかしを変更
3. 影が内側のみで変化することを確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 未解決事項
