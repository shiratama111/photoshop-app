# Photoshop次フェーズ実装指示書（Effects / PSD / Text / Render）

## 目的
以下の実行案を、複数AIで競合を抑えて継続実装する。

- Phase 1: レイヤーエフェクト完成（PS-EFFECT-001〜005）
- Phase 2: PSD互換性強化（PS-PSD-001〜003）
- Phase 3: テキスト機能高度化（PS-TEXT-008〜010）
- Phase 4: 描画品質向上（PS-RENDER-001〜002）

## 運用ルール（必須）
- 1チケット = 1ブランチ
- ブランチ: `feat/{ticket-id-lowercase}-{short-description}`
- コミット: `{TICKET-ID}: {description}`
- 担当外パッケージを編集しない
- `packages/types` はロック済み（変更が必要ならチケットノートで申告）

## 優先順（実装順）
1. Phase 1（最優先）
2. Phase 2
3. Phase 3
4. Phase 4

## 依存関係
- `PS-EFFECT-001 -> PS-EFFECT-002 -> PS-EFFECT-003 -> PS-EFFECT-004`
- `PS-EFFECT-005` は上記と並列可能（UI先行可）
- `PS-PSD-001` と `PS-PSD-002` は並列可能（別ファイル）
- `PS-PSD-003` は独立して並列可能
- `PS-TEXT-008 -> PS-TEXT-009 -> PS-TEXT-010`（同一パッケージ競合回避のため順次推奨）
- `PS-RENDER-001 -> PS-RENDER-002`

## 各フェーズの完了条件
### Phase 1
- `inner-shadow / inner-glow / gradient-overlay / bevel-emboss` がレンダリングされる
- LayerStyleDialog が 8タブ（既存4 + 新規4）になる
- `pnpm --filter @photoshop-app/render test` と `pnpm --filter @photoshop-app/app test` が通過

### Phase 2
- PSD import/export で effect 情報が往復保持される
- ASL import で `IrSh, IrGl, ChFX, GrFl, BvlE` が LayerEffect へ変換される
- `pnpm --filter @photoshop-app/adapter-psd test` と `pnpm --filter @photoshop-app/adapter-asl test` が通過

### Phase 3
- リッチテキスト/ワープ/フォント管理の基盤が入る
- テキスト入力・確定・再編集の回帰がない
- `pnpm --filter @photoshop-app/app test` が通過

### Phase 4
- レイヤーマスクが有効化される
- Color Overlay がラスターにも適用される
- `pnpm --filter @photoshop-app/render test` が通過

## 既知の前提・確認ポイント
1. `PS-TEXT-008` は型拡張（`TextLayer.text` -> `TextRun[]`）が本来必要。
2. ただし `packages/types` はロック済みのため、以下のどちらかをコーディネータ判断で採用する。
   - A案（推奨）: `PS-TEXT-008` 実施時のみ `types` ロックを一時解除
   - B案（暫定）: app内の編集モデルを先行し、型本体変更は別チケット化
3. 本指示書では、`PS-TEXT-008` に上記「要確認」を明記して進行する。

## チケット一覧（本計画）
### Phase 1: Effects
1. [PS-EFFECT-001.md](./PS-EFFECT-001.md)
2. [PS-EFFECT-002.md](./PS-EFFECT-002.md)
3. [PS-EFFECT-003.md](./PS-EFFECT-003.md)
4. [PS-EFFECT-004.md](./PS-EFFECT-004.md)
5. [PS-EFFECT-005.md](./PS-EFFECT-005.md)

### Phase 2: PSD/ASL
6. [PS-PSD-001.md](./PS-PSD-001.md)
7. [PS-PSD-002.md](./PS-PSD-002.md)
8. [PS-PSD-003.md](./PS-PSD-003.md)

### Phase 3: Text
9. [PS-TEXT-008.md](./PS-TEXT-008.md)
10. [PS-TEXT-009.md](./PS-TEXT-009.md)
11. [PS-TEXT-010.md](./PS-TEXT-010.md)

### Phase 4: Render Quality
12. [PS-RENDER-001.md](./PS-RENDER-001.md)
13. [PS-RENDER-002.md](./PS-RENDER-002.md)

## Pre-PRチェック（全チケット共通）
1. `pnpm lint` が 0 error
2. 対象 package の `pnpm test` 通過
3. `git fetch origin && git rebase origin/main`
4. `powershell -File scripts/review.ps1 -ticket "TICKET-ID" -branch "your-branch"`
5. レビュー結果が `PASS` or `PASS_WITH_NOTES`
