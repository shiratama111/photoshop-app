# TEST-001: ゴールデンPSDラウンドトリップテスト
- **Package**: tests/integration
- **Depends**: PSD-001, PSD-002, RENDER-001
- **Complexity**: M

## Description
10+ test PSDs (raster, text, groups, blend modes, effects, hidden layers, etc.). Import -> render -> pixel compare with reference PNG. Round-trip verification.

## Acceptance Criteria
- Pixel diff under 1%
- Round-trip diff under 2%
- Runs in CI (headless)
