# AIエージェント送信用メッセージ（Effects / PSD / Text / Render）

## 共通テンプレ
```
担当チケット: {TICKET-ID}
ブランチ: feat/{ticket-id-lowercase}-{short-description}
指示書: docs/agent-briefs/{TICKET-ID}.md

要件を満たす実装とテスト追加まで実施してください。
完了時に以下を必ず報告してください。
1. 変更ファイル一覧
2. 実行したテストコマンドと結果
3. 手動確認手順と結果
4. 既知の未解決事項（あれば）

制約:
- 他チケット領域のファイルは編集しない
- コミットメッセージは `{TICKET-ID}: ...` 形式
```

## Wave 1
### Agent-R1（PS-EFFECT-001）
```
担当チケット: PS-EFFECT-001
ブランチ: feat/ps-effect-001-inner-shadow-render
指示書: docs/agent-briefs/PS-EFFECT-001.md

Inner Shadow を compositor に実装し、render テストを追加してください。
```

### Agent-A1（PS-EFFECT-005）
```
担当チケット: PS-EFFECT-005
ブランチ: feat/ps-effect-005-layer-style-tabs
指示書: docs/agent-briefs/PS-EFFECT-005.md

LayerStyleDialog を8タブへ拡張し、新規4エフェクトUIを追加してください。
```

## Wave 2
### Agent-R1（PS-EFFECT-002）
```
担当チケット: PS-EFFECT-002
ブランチ: feat/ps-effect-002-inner-glow-render
指示書: docs/agent-briefs/PS-EFFECT-002.md

Inner Glow（center/edge）を compositor に実装し、テストを追加してください。
```

### Agent-R1（PS-EFFECT-003）
```
担当チケット: PS-EFFECT-003
ブランチ: feat/ps-effect-003-gradient-overlay-render
指示書: docs/agent-briefs/PS-EFFECT-003.md

Gradient Overlay（linear/radial, scale, reverse）を実装し、テストを追加してください。
```

## Wave 3
### Agent-R1（PS-EFFECT-004）
```
担当チケット: PS-EFFECT-004
ブランチ: feat/ps-effect-004-bevel-emboss-render
指示書: docs/agent-briefs/PS-EFFECT-004.md

Bevel & Emboss を近似描画で実装し、回帰テストを追加してください。
```

## Wave 4（並列）
### Agent-P1（PS-PSD-001）
```
担当チケット: PS-PSD-001
ブランチ: feat/ps-psd-001-import-effects
指示書: docs/agent-briefs/PS-PSD-001.md

PSD import で layer.effects を LayerEffect[] にマップしてください。
```

### Agent-P1（PS-PSD-002）
```
担当チケット: PS-PSD-002
ブランチ: feat/ps-psd-002-export-effects
指示書: docs/agent-briefs/PS-PSD-002.md

PSD export で LayerEffect[] を ag-psd effects 形式へ逆変換してください。
```

### Agent-A2（PS-PSD-003）
```
担当チケット: PS-PSD-003
ブランチ: feat/ps-psd-003-asl-effect-mapper
指示書: docs/agent-briefs/PS-PSD-003.md

ASL effect mapper に IrSh/IrGl/ChFX/GrFl/BvlE を追加してください。
```

## Wave 5（順次）
### Agent-T1（PS-TEXT-008）
```
担当チケット: PS-TEXT-008
ブランチ: feat/ps-text-008-rich-text-runs
指示書: docs/agent-briefs/PS-TEXT-008.md

リッチテキスト（TextRun）基盤を導入してください。
注: typesロックに関する要確認事項を先に確認してから着手してください。
```

### Agent-T1（PS-TEXT-009）
```
担当チケット: PS-TEXT-009
ブランチ: feat/ps-text-009-text-warp
指示書: docs/agent-briefs/PS-TEXT-009.md

テキストワープ（アーチ優先）を近似実装してください。
```

### Agent-T1（PS-TEXT-010）
```
担当チケット: PS-TEXT-010
ブランチ: feat/ps-text-010-font-management
指示書: docs/agent-briefs/PS-TEXT-010.md

フォント管理（システムフォント・プレビュー・最近使用）を実装してください。
```

## Wave 6
### Agent-R1（PS-RENDER-001）
```
担当チケット: PS-RENDER-001
ブランチ: feat/ps-render-001-layer-mask
指示書: docs/agent-briefs/PS-RENDER-001.md

レイヤーマスクの alpha 乗算を実装してください。
```

### Agent-R1（PS-RENDER-002）
```
担当チケット: PS-RENDER-002
ブランチ: feat/ps-render-002-raster-color-overlay
指示書: docs/agent-briefs/PS-RENDER-002.md

Color Overlay のラスターレイヤー対応を実装してください。
```
