param(
    [Parameter(Mandatory=$true)][string]$ticket,
    [Parameter(Mandatory=$true)][string]$branch
)

$reviewDir = ".claude/reviews"
if (!(Test-Path $reviewDir)) { New-Item -ItemType Directory -Path $reviewDir -Force }

$outputFile = "$reviewDir/$ticket-review.md"

# Get changed files relative to main
$changedFiles = git diff --name-only main...$branch

Write-Host "Reviewing ticket: $ticket"
Write-Host "Branch: $branch"
Write-Host "Changed files:"
$changedFiles | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# Run Codex review
codex exec --full-auto -m o3 -o $outputFile @"
You are reviewing code for ticket $ticket on branch $branch.

Changed files:
$changedFiles

Instructions:
1. Read the review checklist at .claude/review-checklist.md
2. Read each changed file
3. Check against ALL checklist items
4. Read the ticket definition at .claude/tickets/$ticket.md for acceptance criteria
5. Output a structured review report in the format specified in the checklist

Be strict but fair. Flag real issues, not style preferences.
"@

Write-Host ""
Write-Host "Review complete: $outputFile"
Write-Host "---"
Get-Content $outputFile | Select-Object -First 10
