# Run all tests across packages
Write-Host "Running lint..."
pnpm lint
if ($LASTEXITCODE -ne 0) { Write-Host "Lint failed!" -ForegroundColor Red; exit 1 }

Write-Host "Running build..."
pnpm build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

Write-Host "Running tests..."
pnpm test
if ($LASTEXITCODE -ne 0) { Write-Host "Tests failed!" -ForegroundColor Red; exit 1 }

Write-Host "All checks passed!" -ForegroundColor Green
