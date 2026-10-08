# Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
# SPDX-License-Identifier: MIT
#
# Sudarshan AI installer for Windows. In PowerShell:
#   irm https://raw.githubusercontent.com/ankurpandey27/sudarshan-ai/master/install.ps1 | iex
# Installs Node.js if needed (winget), puts Sudarshan AI in %LOCALAPPDATA%\Sudarshan AI, adds a "Sudarshan AI" shortcut on
# the Desktop and starts it. Run it again any time to update. Your data stays in %USERPROFILE%\.job-apply-agent.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repo = if ($env:SUDARSHAN_REPO) { $env:SUDARSHAN_REPO } else { 'https://github.com/ankurpandey27/sudarshan-ai.git' }
$Zip = 'https://github.com/ankurpandey27/sudarshan-ai/archive/refs/heads/master.zip'
$Dir = if ($env:SUDARSHAN_HOME) { $env:SUDARSHAN_HOME } else { Join-Path $env:LOCALAPPDATA 'Sudarshan AI' }

function Say([string]$Text) { Write-Host "  $Text" }
function Test-Node {
  try {
    $parts = ((& node -v) -replace '^v', '').Split('.')
    return ([int]$parts[0] -gt 22) -or ([int]$parts[0] -eq 22 -and [int]$parts[1] -ge 13)
  } catch { return $false }
}
function Update-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

Write-Host ''
Say 'Sudarshan AI - goes out, finishes the task, returns.'
Write-Host ''

# 1. Node.js 22.13 or newer.
if (-not (Test-Node)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Say 'Installing Node.js (LTS)...'
    winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements | Out-Null
    Update-Path
  }
  if (-not (Test-Node)) {
    Say 'Sudarshan AI needs Node.js 22.13 or newer. Install the LTS from https://nodejs.org, then run this again.'
    return
  }
}
Say "Node.js $(node -v) - ok"

# 2. The code: a git clone keeps itself up to date; without git, a ZIP (run this again to update).
if (Test-Path (Join-Path $Dir '.git')) {
  Say "Updating $Dir..."
  git -C $Dir pull --ff-only --quiet
} elseif (Get-Command git -ErrorAction SilentlyContinue) {
  Say "Downloading Sudarshan AI to $Dir..."
  git clone --depth 1 --quiet $Repo $Dir
} else {
  Say "Downloading Sudarshan AI to $Dir (no Git found - using the ZIP)..."
  $tmp = Join-Path $env:TEMP "sudarshan-$([guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force $tmp | Out-Null
  Invoke-WebRequest $Zip -OutFile (Join-Path $tmp 'sudarshan.zip') -UseBasicParsing
  Expand-Archive (Join-Path $tmp 'sudarshan.zip') -DestinationPath $tmp -Force
  New-Item -ItemType Directory -Force $Dir | Out-Null
  Copy-Item (Join-Path $tmp 'sudarshan-ai-master\*') $Dir -Recurse -Force
  Remove-Item $tmp -Recurse -Force
}
if (Test-Path (Join-Path $Dir '.git')) { New-Item -ItemType File -Force (Join-Path $Dir '.sudarshan-auto-update') | Out-Null }

# 3. A shortcut on the Desktop.
$desktop = if ($env:SUDARSHAN_SHORTCUT_DIR) { $env:SUDARSHAN_SHORTCUT_DIR } else { [Environment]::GetFolderPath('Desktop') }
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut((Join-Path $desktop 'Sudarshan AI.lnk'))
$link.TargetPath = $env:ComSpec
$link.Arguments = "/k cd /d `"$Dir`" && npm start"
$link.WorkingDirectory = $Dir
$link.IconLocation = (Join-Path $Dir 'apps\web\public\sudarshan.ico')
$link.Description = 'Sudarshan AI - job application agent'
$link.Save()
Say "Shortcut added: $(Join-Path $desktop 'Sudarshan AI.lnk')"

# 4. Start it (the first start installs and builds - a few minutes).
if ($env:SUDARSHAN_NO_START -ne '1') {
  Say 'Starting Sudarshan AI - it opens in your browser when ready. Next time, use the Sudarshan AI shortcut.'
  Set-Location $Dir
  npm start
}
