# PS-PSD-003: ASLインポート拡張（残り5エフェクト）

## 目的
`adapter-asl/effect-mapper.ts` で未対応エフェクトを LayerEffect へ変換する。

## 対象パッケージ
- `packages/adapter-asl`

## 推奨ブランチ
- `feat/ps-psd-003-asl-effect-mapper`

## 対象キー
- `IrSh`（Inner Shadow）
- `IrGl`（Inner Glow）
- `ChFX`（Color Overlay）
- `GrFl`（Gradient Overlay）
- `BvlE`（Bevel & Emboss）

## 編集可能ファイル
- `packages/adapter-asl/src/effect-mapper.ts`
- `packages/adapter-asl/src/parse-asl.test.ts`

## 実装要件（Must）
1. 上記5キーを `SUPPORTED_EFFECTS` に追加する。
2. 各キーの mapper を実装し `LayerEffect` を返す。
3. 色・不透明度・角度・サイズなど主要パラメータを変換する。
4. 欠損値は Photoshop 近似のデフォルトにフォールバックする。
5. 既存対応（DrSh/OrGl/FrFX）の挙動を維持する。

## 実装要件（Should）
1. `mapEffect` の可読性維持のため switch を整理する。
2. 変換根拠が分かるように key 対応コメントを残す。

## 受け入れ基準
1. parseAsl結果で上記5キーが skipped されない。
2. effects 配列に正しい type が入る。
3. 既存テストを壊さない。

## 必須テスト
- 各キー単体の mapEffect テスト
- mixed effects の mapEffects テスト更新

## 実行コマンド
- `pnpm --filter @photoshop-app/adapter-asl test`
- `pnpm lint`

## 手動確認手順
1. 該当効果を含むASLを読み込む
2. skipped一覧が減っていることを確認

## 変更報告フォーマット
- 変更ファイル一覧
- 追加/変更テスト一覧
- 実行コマンドと結果
- 既知の未対応キー
