# AIエージェント割り振り表（実行用）

## 前提
- 既存指示書:
  - `docs/agent-briefs/PS-PAN-001.md`
  - `docs/agent-briefs/PS-HISTORY-001.md`
  - `docs/agent-briefs/PS-I18N-001.md`
  - `docs/agent-briefs/PS-TEXT-001.md`
  - `docs/agent-briefs/PS-TEXT-002.md`
  - `docs/agent-briefs/PS-I18N-002.md`
- ブランチ命名: `feat/{ticket-id-lowercase}-{short}`
- コミットメッセージ: `{TICKET-ID}: {summary}`

## 推奨体制（4実装 + 1統合）

| 役割 | 担当チケット | ブランチ | 着手条件 |
|---|---|---|---|
| Agent-A | PS-PAN-001 | `feat/ps-pan-001-space-pan` | 即着手 |
| Agent-B | PS-HISTORY-001 | `feat/ps-history-001-readable-history` | 即着手 |
| Agent-C | PS-I18N-001 | `feat/ps-i18n-001-menu-japanese` | 即着手 |
| Agent-D | PS-TEXT-001 | `feat/ps-text-001-writing-mode-ibeam` | 即着手 |
| Integrator | Wave1統合、Wave2開始判定 | `main` | Wave1完了後 |

## Wave進行

### Wave 1（並列）
- PS-PAN-001
- PS-HISTORY-001
- PS-I18N-001
- PS-TEXT-001

### Wave 2（順次）
- Agent-D: PS-TEXT-002（`PS-TEXT-001` マージ後）
- Agent-C: PS-I18N-002（Wave1すべてマージ後）

## 競合回避ルール（厳守）
- Agent-Aは `CanvasView` / `styles.css` 周辺のみ。
- Agent-Bは `HistoryPanel` / `store` / `core commands` 周辺のみ。
- Agent-Cは `main/menu.ts` と `renderer/i18n` に限定（Wave1）。
- Agent-Dは `types/layer` + `core layer-factory` + `render/compositor` + `text-editor` 周辺。
- `package.json` や共通設定の変更は原則禁止（必要時はIntegratorに相談）。

## Integratorチェックリスト
1. 各PRで `pnpm lint` / 対象テスト通過を確認。
2. 依存の弱い順でマージ: `PAN -> HISTORY -> I18N-001 -> TEXT-001`。
3. Wave1後に動作確認:
   - Space+ドラッグパン
   - History名称
   - メニュー日本語
   - I-Beam + 縦横切替
4. Wave2を開始。
5. 最終で総合確認:
   - パン回帰なし
   - テキスト編集回帰なし
   - 日本語UI崩れなし
   - ヒストリー内容可読

## 各エージェントへのコピペ依頼文

### Agent-A（PS-PAN-001）
```
あなたの担当は PS-PAN-001 です。
指示書: docs/agent-briefs/PS-PAN-001.md
ブランチ: feat/ps-pan-001-space-pan

要件を満たす実装とテスト追加まで行い、完了後は変更ファイル一覧・テスト結果・既知課題を報告してください。
他チケット領域のファイルは編集しないでください。
```

### Agent-B（PS-HISTORY-001）
```
あなたの担当は PS-HISTORY-001 です。
指示書: docs/agent-briefs/PS-HISTORY-001.md
ブランチ: feat/ps-history-001-readable-history

要件を満たす実装とテスト追加まで行い、完了後は変更ファイル一覧・テスト結果・既知課題を報告してください。
他チケット領域のファイルは編集しないでください。
```

### Agent-C（PS-I18N-001）
```
あなたの担当は PS-I18N-001 です。
指示書: docs/agent-briefs/PS-I18N-001.md
ブランチ: feat/ps-i18n-001-menu-japanese

要件を満たす実装とテスト追加まで行い、完了後は変更ファイル一覧・テスト結果・既知課題を報告してください。
他チケット領域のファイルは編集しないでください。
```

### Agent-D（PS-TEXT-001）
```
あなたの担当は PS-TEXT-001 です。
指示書: docs/agent-briefs/PS-TEXT-001.md
ブランチ: feat/ps-text-001-writing-mode-ibeam

要件を満たす実装とテスト追加まで行い、完了後は変更ファイル一覧・テスト結果・既知課題を報告してください。
他チケット領域のファイルは編集しないでください。
```

## Wave2用コピペ依頼文

### Agent-D（PS-TEXT-002）
```
Wave1マージ後、PS-TEXT-002 を実装してください。
指示書: docs/agent-briefs/PS-TEXT-002.md
ブランチ: feat/ps-text-002-text-style-extension

PS-TEXT-001 実装との差分に集中し、回帰防止テストを含めて報告してください。
```

### Agent-C（PS-I18N-002）
```
Wave1マージ後、PS-I18N-002 を実装してください。
指示書: docs/agent-briefs/PS-I18N-002.md
ブランチ: feat/ps-i18n-002-full-ja-ui

既存のi18n基盤を使い、英語ベタ書きを減らして主要UIを日本語化してください。
```

## 補足（あなた向け運用）
- まずWave1を4体同時に走らせる。
- Integratorはレビュー順を固定し、1本ずつ `main` に統合。
- Wave2はWave1安定後に開始（同時に進めると競合率が上がる）。
