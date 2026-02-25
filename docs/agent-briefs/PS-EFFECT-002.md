# PS-EFFECT-002: Inner Glow 描画実装

## 目的
`inner-glow` エフェクトを実装し、レイヤー境界の内側に光彩を描画できるようにする。

## 対象パッケージ
- `packages/render`

## 推奨ブランチ
- `feat/ps-effect-002-inner-glow-render`

## 依存
- `PS-EFFECT-001` マージ後推奨（同一ファイル競合回避）

## 編集可能ファイル
- `packages/render/src/compositor.ts`
- `packages/render/src/compositor.test.ts`

## 実装要件（Must）
1. `renderEffectsInFront` で `inner-glow` を処理する。
2. `renderInnerGlow` を追加する。
3. `source: 'center' | 'edge'` の両モードに対応する。
4. `size / choke / opacity / color` を反映する。
5. `raster` と `text` の両方に対応する。
6. glow はレイヤー内側のみ描画する。

## 実装要件（Should）
1. `outer-glow` の実装資産を流用し、内側クリップで差分化する。
2. center と edge の見た目差が明確になるようパラメータを調整する。

## 受け入れ基準
1. `source=edge` で境界側が強く発光する。
2. `source=center` で中心側寄りの発光になる。
3. 既存 effect 群に回帰がない。

## 必須テスト
- `inner-glow edge` の描画テスト
- `inner-glow center` の描画テスト
- disabled 時のスキップテスト

## 実行コマンド
- `pnpm --filter @photoshop-app/render test`
- `pnpm lint`

## 手動確認手順
1. 同一レイヤーで source を edge/center 切替
2. size/choke を変更
3. 視覚差が出ることを確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 未解決事項
