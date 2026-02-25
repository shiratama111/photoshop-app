# Wave2不足分 実装計画（PAN/TEXT）

## 背景
Wave2マージ後の手動確認で、以下2点が未達です。

1. パン機能: `Space + 左ドラッグ` が一部ケースで発火しない
2. テキスト機能: テキストツール選択後にキャンバスクリックしても入力開始できない

## 原因整理（現状コード）
- パン:
  - `CanvasView` には `Space + drag` 実装がある
  - ただし `SelectionOverlay` が `select/crop` 時に `mousedown` を `stopPropagation` しており、Canvas側にイベントが届かない経路がある
- テキスト:
  - `CanvasView` は「既存テキストへのダブルクリック編集」のみ
  - 「テキストツール中の単クリック新規入力開始」が未実装
  - `addTextLayer` は位置指定不可で、クリック位置起点の入力開始ができない

## 実装チケット分割

| Ticket | ブランチ | 目的 | 依存 |
|---|---|---|---|
| PS-PAN-002 | `feat/ps-pan-002-overlay-space-pan` | Space+dragパンの実運用修正（overlay経由でも必ず動作） | なし |
| PS-TEXT-003 | `feat/ps-text-003-click-to-type` | テキストツール単クリックで新規入力開始（日本語/英語入力対応） | PS-PAN-002後推奨 |

注記:
- `PS-PAN-002` と `PS-TEXT-003` はどちらも `CanvasView.tsx` を触るため、競合回避の観点で順次実装を推奨します。

## 実装順（推奨）
1. `PS-PAN-002` 実装・テスト・マージ
2. `PS-TEXT-003` 実装・テスト・マージ
3. Electron手動確認（パン回帰 + テキスト入力）

## 詳細タスク

### 1) PS-PAN-002
- `SelectionOverlay` 側で「Space押下中」は選択開始ロジックを実行せず、イベントをCanvasに委譲
- `Space押下状態` を `SelectionOverlay` から参照可能にする（共有stateまたは安全な判定関数）
- `Space+drag` 中は選択/描画処理を抑止
- 既存ミドルクリックパンを回帰させない

### 2) PS-TEXT-003
- `text` ツール時の単クリックで入力開始
  - クリック位置に新規テキストレイヤー作成
  - 直ちに `editingTextLayerId` を設定
- 新規テキストレイヤー作成APIを位置指定対応に拡張
- 入力ボックス初期サイズをフォントサイズ（ポイント）に連動させる
- 既存テキストをクリックした場合は新規作成せず既存編集を開始
- 日本語/英語混在文字列が崩れず入力・確定できることを担保

## リスクと対策
- リスク: `select/crop` の既存ドラッグ選択が壊れる
  - 対策: `Space押下中` のみバイパスし、非押下時の既存挙動を保持する
- リスク: テキスト単クリックと既存ダブルクリック編集の競合
  - 対策: `text` ツール時は単クリック起点を優先し、他ツール時のダブルクリック編集は維持
- リスク: IME入力中のイベント干渉
  - 対策: `textarea` 標準挙動を優先し、Space/Enter/Escapeの扱いをIME合成状態で分岐

## 完了条件（Wave2不足分）
- `PS-PAN-002` / `PS-TEXT-003` の受け入れ基準を満たす
- `pnpm lint` がエラー0
- `pnpm --filter @photoshop-app/app test` が通過
- Electron手動確認で下記を確認
  1. `Space + 左ドラッグ` で確実にパンできる（`select/crop/brush/text` 含む）
  2. テキストツール単クリックで入力ボックスが表示され、日本語/英語の入力が可能
  3. Undo/Redoで新規テキスト作成と編集が追跡できる

## AI依頼テンプレ（コピペ用）

### PS-PAN-002
```
PS-PAN-002 を実装してください。
指示書: docs/agent-briefs/PS-PAN-002.md
ブランチ: feat/ps-pan-002-overlay-space-pan

Space+drag のパンが SelectionOverlay 上でも必ず動作するように修正し、回帰テストまで完了してください。
```

### PS-TEXT-003
```
PS-TEXT-003 を実装してください。
指示書: docs/agent-briefs/PS-TEXT-003.md
ブランチ: feat/ps-text-003-click-to-type

テキストツール選択後の単クリックで、クリック位置に入力ボックスを出して日本語/英語入力可能な状態を作ってください。
```
