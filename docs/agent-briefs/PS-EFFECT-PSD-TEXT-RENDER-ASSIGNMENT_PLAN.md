# AIエージェント割り振り表（Effects / PSD / Text / Render）

## 前提
- 指示書: `docs/agent-briefs/PS-EFFECT-PSD-TEXT-RENDER-PLAN.md`
- 各チケットの個別指示書を優先
- ブランチ/コミット規約は `AGENTS.md` 準拠

## 推奨体制（5実装 + 1統合）
| 役割 | 主担当 | 連続担当チケット | ブランチ例 |
|---|---|---|---|
| Agent-R1 | render/effects | PS-EFFECT-001〜004 | `feat/ps-effect-001-inner-shadow-render` など |
| Agent-A1 | app/dialog | PS-EFFECT-005 | `feat/ps-effect-005-layer-style-tabs` |
| Agent-P1 | adapter-psd | PS-PSD-001〜002 | `feat/ps-psd-001-import-effects` など |
| Agent-A2 | adapter-asl | PS-PSD-003 | `feat/ps-psd-003-asl-effect-mapper` |
| Agent-T1 | app/text | PS-TEXT-008〜010 | `feat/ps-text-008-rich-text-runs` など |
| Integrator | 統合・検証 | Phase統合と最終確認 | `main` |

## 実行順（推奨）
### Wave 1
- PS-EFFECT-001
- PS-EFFECT-005（並列可）

### Wave 2
- PS-EFFECT-002
- PS-EFFECT-003

### Wave 3
- PS-EFFECT-004

### Wave 4（並列）
- PS-PSD-001
- PS-PSD-002
- PS-PSD-003

### Wave 5（順次）
- PS-TEXT-008
- PS-TEXT-009
- PS-TEXT-010

### Wave 6（順次）
- PS-RENDER-001
- PS-RENDER-002

## 競合回避ルール
- `packages/render/src/compositor.ts` は同時編集禁止（1チケットずつ）
- `packages/app/src/renderer/components/text-editor/*` は同時編集禁止
- `packages/adapter-psd/src/layer-mapper.ts` と `layer-exporter.ts` は分離運用
- `packages/types` は変更禁止（必要時はノート化してIntegratorへ報告）

## Integratorチェックリスト
1. チケットごとに変更ファイルが担当範囲内か
2. 依存順を守っているか
3. package単位テストと `pnpm lint` が通っているか
4. 手動確認項目が報告されているか
5. PSD往復互換・テキスト回帰・エフェクト描画を最終確認したか
