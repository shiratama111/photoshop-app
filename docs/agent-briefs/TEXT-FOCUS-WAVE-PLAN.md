# Text Focus Wave Plan（2026-02）

## 背景
現状のテキスト機能は以下の観点で不足がある。

1. 入力開始導線の不統一
   - 単クリックで確実に編集開始できないケースがある
   - 既存テキスト編集と新規作成の分岐が直感的でない
2. 入力可視性の不具合
   - 文字は入力されるが、編集中または確定後に視認しづらい/見えないケースがある
3. 編集UIの基盤不足
   - ブラウザ標準の `textarea` 見た目に依存し、アプリ独自の編集体験として弱い
4. テキストを「画像同様に扱う」ための変形機能不足
   - テキストレイヤーに transform handles が出ない
   - ボックス変形時にフォントサイズが連動しない

## 目的
Photoshop準拠に近いテキスト編集体験を段階的に実装する。

- 単クリック中心の編集開始
- 日本語/英語入力時の可視性と安定性
- OS標準UI依存を減らしたアプリ内テキスト編集UI
- テキストレイヤーの変形とフォントサイズ自動スケーリング

## Wave構成

### Wave A（即時不具合修正）
- `PS-TEXT-004` クリック起点編集の統一 + 文字非表示バグ修正

### Wave B（編集UI基盤の刷新）
- `PS-TEXT-005` カスタムテキスト編集オーバーレイ（OSデフォルト見た目依存の排除）

### Wave C（テキストを画像同様に操作）
- `PS-TEXT-006` テキストレイヤーのTransform対応 + 変形時フォント自動拡縮

### Wave D（品質ゲート）
- `PS-TEXT-007` 回帰テスト/手動検証シナリオ強化と仕上げ

## 依存関係
`PS-TEXT-004 -> PS-TEXT-005 -> PS-TEXT-006 -> PS-TEXT-007`

## ブランチ提案
- `feat/ps-text-004-click-edit-visibility-fix`
- `feat/ps-text-005-custom-text-overlay`
- `feat/ps-text-006-text-transform-autoscale`
- `feat/ps-text-007-text-regression-gate`

## 完了定義（このText Focus一式）
1. 単クリックで新規/既存編集が直感どおりに動作する
2. `日本語 + English + 数字` の混在入力が編集中/確定後とも視認できる
3. テキスト編集UIがアプリ固有スタイルで統一される（OS標準見た目依存を排除）
4. テキストボックス変形でフォントサイズが自動連動し、Undo/Redo可能
5. `pnpm --filter @photoshop-app/app test` 通過
6. `pnpm lint`（error 0）通過

## AI依頼テンプレ（コピペ用）

### PS-TEXT-004
```
PS-TEXT-004 を実装してください。
指示書: docs/agent-briefs/PS-TEXT-004.md
ブランチ: feat/ps-text-004-click-edit-visibility-fix

単クリック編集導線の統一と、入力文字が表示されない不具合の修正を優先してください。
```

### PS-TEXT-005
```
PS-TEXT-005 を実装してください。
指示書: docs/agent-briefs/PS-TEXT-005.md
ブランチ: feat/ps-text-005-custom-text-overlay

OS標準見た目依存を避け、アプリ独自のテキスト編集オーバーレイへ置換してください。
```

### PS-TEXT-006
```
PS-TEXT-006 を実装してください。
指示書: docs/agent-briefs/PS-TEXT-006.md
ブランチ: feat/ps-text-006-text-transform-autoscale

テキストレイヤーをTransformHandles対象にし、変形時にフォントサイズが自動拡縮するよう実装してください。
```

### PS-TEXT-007
```
PS-TEXT-007 を実装してください。
指示書: docs/agent-briefs/PS-TEXT-007.md
ブランチ: feat/ps-text-007-text-regression-gate

テキスト機能の回帰テストと手動検証シナリオを整備し、品質ゲートを完成させてください。
```
