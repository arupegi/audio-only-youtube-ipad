param(
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl
)

$ErrorActionPreference = "Stop"

# Move to the project root (one level above this script folder).
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git was not found. Install Git for Windows and try again."
    exit 1
}

Write-Host "Project root: $ProjectRoot"
Write-Host "Repository:   $RepoUrl"

if (-not (Test-Path ".git")) {
    git init
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

git add .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Check whether the repository already has a commit.
git rev-parse --verify HEAD *> $null
$HasHead = ($LASTEXITCODE -eq 0)

if ($HasHead) {
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "No changes to commit."
    } else {
        git commit -m "Update Audio Only YouTube Codemagic build"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
} else {
    git commit -m "Initial Codemagic build"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Commit failed. If Git asks for your identity, run:"
        Write-Host '  git config --global user.name "YOUR_NAME"'
        Write-Host '  git config --global user.email "YOUR_EMAIL"'
        exit $LASTEXITCODE
    }
}

git branch -M main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$ExistingRemotes = @(git remote)
if ($ExistingRemotes -contains "origin") {
    git remote set-url origin $RepoUrl
} else {
    git remote add origin $RepoUrl
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Pushing to GitHub..."
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed. Complete GitHub authentication if prompted, then run this script again."
    exit $LASTEXITCODE
}

Write-Host "Push completed successfully."
