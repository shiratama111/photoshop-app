# SMART-001: スマートオブジェクト（簡易版）

## 目的
非破壊でのリサイズ・フィルタ適用を可能にするスマートオブジェクト機能の簡易版を実装する。
元画像のピクセルデータを保持し、拡大縮小しても品質が劣化しないレイヤータイプ。

## 対象パッケージ
- `packages/core`

## 推奨ブランチ
- `feat/smart-001-smart-objects`

## 現状
- ラスターレイヤーはピクセル直接操作 → リサイズで不可逆劣化
- **スマートオブジェクトは未実装**

## 編集可能ファイル
- `packages/core/src/smart-object.ts` — **新規作成**
- `packages/core/src/smart-object.test.ts` — **新規作成**
- `packages/core/src/layer-factory.ts` — `createSmartObjectLayer()` 追加
- `packages/core/src/commands/` — SmartObjectコマンド追加（新規ファイル）

## 編集禁止ファイル
- `packages/types/`（locked — 型変更が必要な場合はチケットノートに記載）
- `packages/core/src/layer-tree.ts`（CLIP-001の担当がWave 6で完了後のみ）
- `packages/core/src/procedural.ts`（DECO-001の担当）
- `packages/render/` 配下全て
- `packages/app/` 配下全て

## types パッケージへの要求事項
> `packages/types` は locked のため、以下の型変更をコーディネーターに報告すること:
>
> - `Layer` のユニオンに `SmartObjectLayer` 型を追加
> - `SmartObjectLayer` = `BaseLayer & { type: 'smart-object'; sourceData: ArrayBuffer; transform: Transform; appliedFilters: FilterConfig[] }`
>
> 暫定対応として `core/src/smart-object.ts` 内にローカル型定義してもよい。

## 実装要件（Must）
1. **SmartObjectLayer データモデル**
   - `sourceData`: 元画像のピクセルデータ（フル解像度）を保持
   - `transform`: 現在の拡大率・回転角・位置
   - `displayData`: 現在のtransformでリサンプリングしたピクセルデータ（キャッシュ）

2. **スマートオブジェクト生成**
   - 既存ラスターレイヤー → スマートオブジェクトに変換
   - 画像ファイル読込 → スマートオブジェクトとして配置

3. **非破壊リサイズ**
   - スマートオブジェクトの拡大/縮小時にsourceDataからリサンプリング
   - 50%→200%→100% の操作で元画像と同等品質に戻る
   - リサンプリングアルゴリズム: バイリニア or Lanczos

4. **コマンド対応**
   - `ConvertToSmartObjectCommand`: ラスター→スマートオブジェクト変換（Undo対応）
   - `TransformSmartObjectCommand`: 変形操作（Undo対応）
   - `RasterizeSmartObjectCommand`: スマートオブジェクト→ラスターに戻す（Undo対応）

## 実装要件（Should）
1. 非破壊フィルタ適用（フィルタスタックとして保持、順序変更・削除可能）
2. スマートオブジェクトの中身を「編集」モード（別キャンバスで開く）

## 受け入れ基準
1. ラスターレイヤーをスマートオブジェクトに変換できる
2. スマートオブジェクトを拡大/縮小してもsourceDataが劣化しない
3. 100%に戻したとき元画像と同等品質
4. Undo/Redoが正しく動作する
5. 既存のラスターレイヤー操作に回帰がない

## 必須テスト
- ラスター→スマートオブジェクト変換テスト
- リサイズ後のピクセル品質テスト（50%縮小→200%拡大→元に戻す）
- Undo/Redoテスト
- ラスタライズ（スマートオブジェクト→ラスター）テスト

## 実行コマンド
- `pnpm --filter @photoshop-app/core test`
- `pnpm lint`
