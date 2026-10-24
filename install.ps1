<#
.SYNOPSIS
    Installs and registers agy-opencode-bridge-mcp for Google Antigravity on Windows.
.DESCRIPTION
    1. Validates Node.js and OpenCode CLI prerequisites.
    2. Registers the 'opencode-bridge' MCP server in Antigravity's mcp_config.json.
    3. Copies the 'opencode-bridge' skill to Antigravity global and workspace skill directories.
    4. Copies the '/opencode' slash command to Antigravity commands directories.
#>

[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> " -ForegroundColor Cyan -NoNewline
    Write-Host $Message -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "  [X] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

$RepoRoot = $PSScriptRoot
if (-not $RepoRoot) {
    $RepoRoot = (Get-Location).Path
}

$ServerEntry = Join-Path $RepoRoot "src\index.js"
$SkillSource = Join-Path $RepoRoot "skills\opencode-bridge"
$CommandSource = Join-Path $RepoRoot "commands\opencode.md"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   agy-opencode-bridge-mcp - Antigravity Windows Installer" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Repository Path: $RepoRoot"

# ---------------------------------------------------------------------------
# 1. Prerequisite Checks
# ---------------------------------------------------------------------------
Write-Step "Checking environment prerequisites..."

$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCmd) {
    $NodeVersion = & node -v
    Write-Success "Node.js detected: $NodeVersion ($($NodeCmd.Source))"
} else {
    Write-ErrorMsg "Node.js is not installed or not in PATH. Please install Node.js (v18+) from https://nodejs.org/"
    exit 1
}

$OpenCodeCmd = Get-Command opencode -ErrorAction SilentlyContinue
if ($OpenCodeCmd) {
    try {
        $OpenCodeVersion = & opencode --version 2>&1
        Write-Success "OpenCode CLI detected: $OpenCodeVersion ($($OpenCodeCmd.Source))"
    } catch {
        Write-Success "OpenCode CLI detected at: $($OpenCodeCmd.Source)"
    }
} else {
    Write-Warn "OpenCode CLI was not detected in PATH."
    Write-Warn "You can install OpenCode CLI via npm or official installer:"
    Write-Host "       npm install -g opencode-ai" -ForegroundColor DarkGray
    Write-Host "       or visit: https://opencode.ai" -ForegroundColor DarkGray
    Write-Warn "The bridge can still be configured and will function once OpenCode is installed."
}

# ---------------------------------------------------------------------------
# 2. Register MCP Server in mcp_config.json
# ---------------------------------------------------------------------------
Write-Step "Configuring Antigravity MCP Server registration..."

$CandidateConfigs = @(
    (Join-Path $env:USERPROFILE ".gemini\antigravity\mcp_config.json"),
    (Join-Path $env:USERPROFILE ".gemini\config\mcp_config.json")
)

$TargetConfigFile = $null

foreach ($Candidate in $CandidateConfigs) {
    if (Test-Path $Candidate) {
        $Item = Get-Item $Candidate
        if ($Item.LinkType -and $Item.Target) {
            $Resolved = $Item.Target
            if (Test-Path $Resolved) {
                $TargetConfigFile = $Resolved
                break
            }
        }
        $TargetConfigFile = $Candidate
        break
    }
}

if (-not $TargetConfigFile) {
    $TargetConfigFile = Join-Path $env:USERPROFILE ".gemini\antigravity\mcp_config.json"
    $ParentDir = Split-Path $TargetConfigFile -Parent
    if (-not (Test-Path $ParentDir)) {
        New-Item -ItemType Directory -Path $ParentDir -Force | Out-Null
    }
    "{`"mcpServers`": {}}" | Out-File -FilePath $TargetConfigFile -Encoding utf8
}

Write-Host "Target MCP Config File: $TargetConfigFile" -ForegroundColor Gray

# Parse JSON safely
$RawJson = "{}"
if (Test-Path $TargetConfigFile) {
    $RawJson = Get-Content -Path $TargetConfigFile -Raw -Encoding utf8
}

$ConfigObject = $null
try {
    if ($RawJson.Trim().Length -gt 0) {
        $ConfigObject = $RawJson | ConvertFrom-Json
    }
} catch {
    Write-Warn "Existing mcp_config.json could not be parsed as JSON. Creating backup."
    Copy-Item $TargetConfigFile "$TargetConfigFile.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"
    $ConfigObject = $null
}

if (-not $ConfigObject) {
    $ConfigObject = [PSCustomObject]@{
        mcpServers = [PSCustomObject]@{}
    }
}

if (-not $ConfigObject.PSObject.Properties["mcpServers"]) {
    $ConfigObject | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value ([PSCustomObject]@{})
}

# Update or insert 'opencode-bridge'
$ServerEntryConfig = [PSCustomObject]@{
    command = "node"
    args = @($ServerEntry)
}

if ($ConfigObject.mcpServers.PSObject.Properties["opencode-bridge"]) {
    $ConfigObject.mcpServers."opencode-bridge" = $ServerEntryConfig
    Write-Success "Updated existing 'opencode-bridge' registration in mcp_config.json"
} else {
    $ConfigObject.mcpServers | Add-Member -MemberType NoteProperty -Name "opencode-bridge" -Value $ServerEntryConfig
    Write-Success "Added 'opencode-bridge' registration to mcp_config.json"
}

$UpdatedJson = $ConfigObject | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($TargetConfigFile, $UpdatedJson, [System.Text.Encoding]::UTF8)
Write-Success "Saved MCP configuration to $TargetConfigFile"

# ---------------------------------------------------------------------------
# 3. Install Antigravity Skill
# ---------------------------------------------------------------------------
Write-Step "Installing Antigravity Skill (skills/opencode-bridge)..."

$GlobalSkillDir = Join-Path $env:USERPROFILE ".gemini\antigravity\skills\opencode-bridge"
if (-not (Test-Path $GlobalSkillDir)) {
    New-Item -ItemType Directory -Path $GlobalSkillDir -Force | Out-Null
}

if (Test-Path $SkillSource) {
    Copy-Item -Path "$SkillSource\*" -Destination $GlobalSkillDir -Recurse -Force
    Write-Success "Installed global skill: $GlobalSkillDir"
} else {
    Write-Warn "Skill source directory not found: $SkillSource"
}

$WorkspaceSkillDir = Join-Path (Get-Location).Path ".agents\skills\opencode-bridge"
if (Test-Path (Join-Path (Get-Location).Path ".agents")) {
    if (-not (Test-Path $WorkspaceSkillDir)) {
        New-Item -ItemType Directory -Path $WorkspaceSkillDir -Force | Out-Null
    }
    Copy-Item -Path "$SkillSource\*" -Destination $WorkspaceSkillDir -Recurse -Force
    Write-Success "Installed workspace skill: $WorkspaceSkillDir"
}

# ---------------------------------------------------------------------------
# 4. Install Slash Command (/opencode)
# ---------------------------------------------------------------------------
Write-Step "Installing Slash Command (/opencode)..."

$GlobalCommandDir = Join-Path $env:USERPROFILE ".gemini\antigravity\commands"
if (-not (Test-Path $GlobalCommandDir)) {
    New-Item -ItemType Directory -Path $GlobalCommandDir -Force | Out-Null
}

if (Test-Path $CommandSource) {
    Copy-Item -Path $CommandSource -Destination (Join-Path $GlobalCommandDir "opencode.md") -Force
    Write-Success "Installed global slash command: $(Join-Path $GlobalCommandDir 'opencode.md')"
}

$WorkspaceCommandDir = Join-Path (Get-Location).Path ".agents\commands"
if (Test-Path (Join-Path (Get-Location).Path ".agents")) {
    if (-not (Test-Path $WorkspaceCommandDir)) {
        New-Item -ItemType Directory -Path $WorkspaceCommandDir -Force | Out-Null
    }
    Copy-Item -Path $CommandSource -Destination (Join-Path $WorkspaceCommandDir "opencode.md") -Force
    Write-Success "Installed workspace slash command: $(Join-Path $WorkspaceCommandDir 'opencode.md')"
}

# ---------------------------------------------------------------------------
# Installation Summary
# ---------------------------------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "   Installation Complete! Ready to use in Antigravity." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "To use OpenCode in Antigravity:"
Write-Host "  1. Restart Antigravity or reload MCP servers."
Write-Host "  2. Use the slash command: /opencode <your task>"
Write-Host "  3. Or ask the agent: 'Delegate this refactoring to OpenCode subagent'"
Write-Host "  4. Default free tier: opencode / deepseek-v4.1-flash-free"
Write-Host "==========================================================`n" -ForegroundColor Green
