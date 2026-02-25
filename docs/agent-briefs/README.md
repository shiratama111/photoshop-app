# Photoshopアプリ マルチエージェント実装指示書

## 目的
以下の要件を、競合を最小化しつつ複数AIエージェントで並列実装する。

- テキスト入力強化
  - テキストツール選択時の I-Beam カーソル
  - 縦書き / 横書き切替
  - テキストのレイヤースタイル適用・色やサイズ変更の自由度向上
  - Photoshopにある重要機能を優先実装
- パン機能
  - スペースキー + マウスドラッグでパン
- 日本語対応
  - メニューや主要UIの日本語化
- ヒストリー改善
  - `Action 1/2/3` ではなく、何をしたか分かるアクション名表示

## 実装方針（Photoshop準拠）
- 一時的ハンドツール: `Space` 押下中のみパンモード化（現在ツールは保持）。
- テキスト: `横書き/縦書き` はレイヤー属性として保持し、描画・インライン編集・履歴に反映。
- 履歴: ユーザー行動ベースの説明（例: `テキストサイズを変更`, `レイヤーを追加`）。
- 日本語化: 表示文字列はベタ書きせず、キー管理へ段階移行。

## チケット一覧

### Wave 1（並列実装）
1. `PS-PAN-001` スペースキー・パン機能
2. `PS-HISTORY-001` 履歴アクション名の可視化
3. `PS-I18N-001` i18n基盤 + メニュー日本語化
4. `PS-TEXT-001` I-Beamカーソル + 縦書き/横書き

### Wave 2（Wave 1マージ後）
5. `PS-TEXT-002` テキストレイヤースタイル拡張 + 重要テキスト機能
6. `PS-I18N-002` 全UI日本語化の仕上げ

### Post-Wave 2（不足分修正）
7. `PS-PAN-002` SelectionOverlay配下でも `Space + Drag` パンを成立
8. `PS-TEXT-003` テキストツール単クリックで入力開始（日本語/英語対応）

### Text Focus Waves（テキスト重点フェーズ）
9. `PS-TEXT-004` クリック起点編集の統一 + 文字非表示バグ修正
10. `PS-TEXT-005` カスタムテキスト編集オーバーレイ
11. `PS-TEXT-006` テキストTransform対応 + 変形時フォント自動拡縮
12. `PS-TEXT-007` テキスト品質ゲート（回帰テスト + 手動検証）

## 担当分離ルール
- 各チケットは「編集可能ファイル」を厳守する。
- `packages/types` の変更が必要な場合は、変更点をPR説明に明記する。
- コミットメッセージは `TICKET-ID: 内容` 形式。
- ブランチは `feat/{ticket-id-lowercase}-{short}` 形式。

## 完了定義（全チケット共通）
- `pnpm lint` がエラー0
- 追加/変更機能のテストが通過
- 手動確認手順をPRに記載
- 既存機能の回帰なし

## 各チケット指示書
- [PS-PAN-001.md](./PS-PAN-001.md)
- [PS-HISTORY-001.md](./PS-HISTORY-001.md)
- [PS-I18N-001.md](./PS-I18N-001.md)
- [PS-TEXT-001.md](./PS-TEXT-001.md)
- [PS-TEXT-002.md](./PS-TEXT-002.md)
- [PS-I18N-002.md](./PS-I18N-002.md)
- [POST-WAVE2-GAP-PLAN.md](./POST-WAVE2-GAP-PLAN.md)
- [PS-PAN-002.md](./PS-PAN-002.md)
- [PS-TEXT-003.md](./PS-TEXT-003.md)
- [TEXT-FOCUS-WAVE-PLAN.md](./TEXT-FOCUS-WAVE-PLAN.md)
- [PS-TEXT-004.md](./PS-TEXT-004.md)
- [PS-TEXT-005.md](./PS-TEXT-005.md)
- [PS-TEXT-006.md](./PS-TEXT-006.md)
- [PS-TEXT-007.md](./PS-TEXT-007.md)

## 次フェーズ（Effects / PSD / Text / Render）
- 全体計画:
  - [PS-EFFECT-PSD-TEXT-RENDER-PLAN.md](./PS-EFFECT-PSD-TEXT-RENDER-PLAN.md)
- 運用資料:
  - [PS-EFFECT-PSD-TEXT-RENDER-ASSIGNMENT_PLAN.md](./PS-EFFECT-PSD-TEXT-RENDER-ASSIGNMENT_PLAN.md)
  - [PS-EFFECT-PSD-TEXT-RENDER-DISPATCH_MESSAGES.md](./PS-EFFECT-PSD-TEXT-RENDER-DISPATCH_MESSAGES.md)
- 個別チケット:
  - [PS-EFFECT-001.md](./PS-EFFECT-001.md)
  - [PS-EFFECT-002.md](./PS-EFFECT-002.md)
  - [PS-EFFECT-003.md](./PS-EFFECT-003.md)
  - [PS-EFFECT-004.md](./PS-EFFECT-004.md)
  - [PS-EFFECT-005.md](./PS-EFFECT-005.md)
  - [PS-PSD-001.md](./PS-PSD-001.md)
  - [PS-PSD-002.md](./PS-PSD-002.md)
  - [PS-PSD-003.md](./PS-PSD-003.md)
  - [PS-TEXT-008.md](./PS-TEXT-008.md)
  - [PS-TEXT-009.md](./PS-TEXT-009.md)
  - [PS-TEXT-010.md](./PS-TEXT-010.md)
  - [PS-RENDER-001.md](./PS-RENDER-001.md)
  - [PS-RENDER-002.md](./PS-RENDER-002.md)
