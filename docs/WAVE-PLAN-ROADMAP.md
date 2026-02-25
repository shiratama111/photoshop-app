# Roadmap チケット Wave計画

> ROADMAP.md の Phase 0〜4 を並列実行可能なチケットに分割した計画書。
> 各 Wave 内のチケットは **ファイルオーナーシップが重複しない** ため、全て並列実行可能。

## 前提: 完了済み

| Phase | タスク | 状態 |
|:------|:-------|:-----|
| Phase 0 | システムフォント列挙 | 完了（font-list.ts + FontSelector.tsx） |
| Phase 0 | カスタムフォント読込 | 完了（FontFace API + D&D + localStorage永続化） |
| Phase 0 | レイヤーエフェクト8種実装 | 完了（compositor.ts） |
| Phase 2 | Editor Action API | 完了（editor-actions/） |
| Phase 2 | Canvas Snapshot | 完了（editor-actions/snapshot.ts） |
| Phase 2 | MCP Server | 完了（packages/mcp/） |
| — | テキストスタイルプリセット定義 | 完了（text-style-presets.ts、8プリセット） |
| — | テンプレート store | 完了（template-store.ts、localStorage保存） |

---

## Wave 5: Phase 0 — Quality Hardening（4チケット並列）

基盤品質を「サムネイル制作に耐えるレベル」に引き上げる。
全チケットが **新規ファイルのみ作成** or **テストファイルのみ追加** のため安全に並列実行可能。

| ID | タイトル | Package | 主な成果物 |
|:---|:---------|:--------|:-----------|
| FONT-001 | Google Fonts統合 | app | GoogleFontsBrowser.tsx（新規）, google-fonts.ts（新規） |
| QUALITY-001 | エフェクト品質テストスイート | render | effect-quality.test.ts（新規） |
| EXPORT-001 | エクスポート品質検証 | app | export-quality.test.ts（新規） |
| PERF-001 | パフォーマンスベンチマーク | render | benchmarks/（新規ディレクトリ） |

---

## Wave 6: Phase 1a — Templates & Presets（4チケット並列）

手動でのサムネイル制作フローを確立する。各チケットは **異なるファイル群** を所有。

| ID | タイトル | Package | 主な成果物 |
|:---|:---------|:--------|:-----------|
| TMPL-001 | テンプレートファイルI/O (.psxp) | app | template-store.ts, TemplateDialog.tsx |
| PRESET-001 | テキストスタイルプリセットUI | app | TextStylePresetsPanel.tsx（新規）, text-style-presets.ts |
| DECO-001 | 集中線・放射線エフェクト | core + render | core/src/procedural.ts（集中線追加）, render/src/decorations.ts（新規） |
| CLIP-001 | クリッピングマスク | core + render | core/src/layer-tree.ts（clipping追加）, render/src/compositor.ts（clipping描画追加） |

### Wave 6 ファイル衝突マップ
```
TMPL-001  → template-store.ts, TemplateDialog.tsx
PRESET-001 → text-style-presets.ts, TextStylePresetsPanel.tsx(new)
DECO-001  → core/procedural.ts, render/decorations.ts(new)
CLIP-001  → core/layer-tree.ts, render/compositor.ts
→ 衝突なし ✓
```

---

## Wave 7: Phase 1b — Advanced Features（3チケット並列）

サムネイル制作の残りパーツ。Wave 6完了後に着手。

| ID | タイトル | Package | 主な成果物 |
|:---|:---------|:--------|:-----------|
| BG-001 | パターンオーバーレイ・背景拡充 | app | PatternDialog.tsx, background-presets.ts |
| GMASK-001 | グラデーションマスク | render + app | render/src/gradient-mask.ts（新規）, GradientMaskDialog.tsx |
| SMART-001 | スマートオブジェクト（簡易版） | core | core/src/smart-object.ts（新規）, core/src/commands/（SmartObjectCommand追加） |

---

## Wave 8: Phase 2 — AI Control Completion（2チケット並列）

AIがエディタを「言語的に」操作できる層を完成させる。

| ID | タイトル | Package | 主な成果物 |
|:---|:---------|:--------|:-----------|
| STYLE-001 | スタイル分析エンジン | app | editor-actions/style-analyzer.ts（新規） |
| MCP-002 | MCPツール拡充 | mcp | mcp/src/tools.ts（ツール追加） |

---

## Wave 9: Phase 3 — AI Generation（3チケット、一部順序依存）

「こういう雰囲気のサムネを作って」で完成品を出す。

| ID | タイトル | Package | Depends |
|:---|:---------|:--------|:--------|
| THUMB-001 | サムネイル設計AI | app | STYLE-001 |
| AIFONT-001 | フォント自動選択AI | app | FONT-001 |
| PIPE-001 | E2E自動生成パイプライン | app + mcp | THUMB-001, AIFONT-001 |

> THUMB-001 と AIFONT-001 は並列実行可能。PIPE-001 は両方の完了後。

---

## Wave 10: Phase 4 — Reference Reproduction（3チケット、一部順序依存）

「この画像と同じようなサムネを作って」で再現する。

| ID | タイトル | Package | Depends |
|:---|:---------|:--------|:--------|
| ANALYZE-001 | サムネイル解析AI | app + ai | STYLE-001 |
| TRANSFER-001 | スタイル転写エンジン | app | ANALYZE-001, PIPE-001 |
| BATCH-001 | AI画像生成統合・バッチ生成 | app | PIPE-001 |

> ANALYZE-001 と BATCH-001 は並列実行可能。TRANSFER-001 は ANALYZE-001 完了後。

---

## 依存グラフ

```
Wave 1-4 (完了)
    ↓
Wave 5: FONT-001 | QUALITY-001 | EXPORT-001 | PERF-001
    ↓
Wave 6: TMPL-001 | PRESET-001 | DECO-001 | CLIP-001
    ↓
Wave 7: BG-001 | GMASK-001 | SMART-001
    ↓
Wave 8: STYLE-001 | MCP-002
    ↓
Wave 9: THUMB-001 + AIFONT-001 → PIPE-001
    ↓
Wave 10: ANALYZE-001 + BATCH-001 → TRANSFER-001
```

## チケットの所在

- `.claude/tickets/` — 各チケットの詳細定義
- `docs/WAVE-PLAN-ROADMAP.md` — 本ファイル（Wave計画）
