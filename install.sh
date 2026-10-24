#!/usr/bin/env bash
# ==============================================================================
# agy-opencode-bridge-mcp — Cross-Platform Installer for Linux, macOS & WSL
# Registers OpenCode MCP Bridge and installs Antigravity Skills and Slash Commands.
# ==============================================================================

set -euo pipefail

# ANSI Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

log_step() {
    printf "\n${CYAN}==>${NC} %s\n" "$1"
}

log_success() {
    printf "  ${GREEN}[OK]${NC} %s\n" "$1"
}

log_warn() {
    printf "  ${YELLOW}[!]${NC} %s\n" "$1"
}

log_error() {
    printf "  ${RED}[X]${NC} %s\n" "$1"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ENTRY="${SCRIPT_DIR}/src/index.js"
SKILL_SOURCE="${SCRIPT_DIR}/skills/opencode-bridge"
COMMAND_SOURCE="${SCRIPT_DIR}/commands/opencode.md"

echo -e "${CYAN}==========================================================${NC}"
echo -e "${CYAN}   agy-opencode-bridge-mcp — Unix / macOS / WSL Installer ${NC}"
echo -e "${CYAN}==========================================================${NC}"
echo -e "Repository Path: ${SCRIPT_DIR}"

# ------------------------------------------------------------------------------
# 1. Prerequisite Checks
# ------------------------------------------------------------------------------
log_step "Checking environment prerequisites..."

if command -v node >/dev/null 2>&1; then
    NODE_VERSION="$(node -v)"
    log_success "Node.js detected: ${NODE_VERSION} ($(command -v node))"
else
    log_error "Node.js is not installed or not in PATH."
    log_error "Please install Node.js (v18+) via your package manager or https://nodejs.org/"
    exit 1
fi

if command -v opencode >/dev/null 2>&1; then
    OPENCODE_VERSION="$(opencode --version 2>&1 || true)"
    log_success "OpenCode CLI detected: ${OPENCODE_VERSION} ($(command -v opencode))"
else
    log_warn "OpenCode CLI was not detected in PATH."
    log_warn "You can install OpenCode CLI via npm or official installer:"
    echo -e "       ${GRAY}npm install -g opencode-ai${NC}"
    echo -e "       ${GRAY}or: curl -fsSL https://opencode.ai/install.sh | bash${NC}"
    log_warn "The bridge will function once OpenCode is installed."
fi

# ------------------------------------------------------------------------------
# 2. Register MCP Server in mcp_config.json
# ------------------------------------------------------------------------------
log_step "Configuring Antigravity MCP Server registration..."

TARGET_CONFIG_DIR="${HOME}/.gemini/antigravity"
TARGET_CONFIG_FILE="${TARGET_CONFIG_DIR}/mcp_config.json"

# Check alternative location ~/.gemini/config/mcp_config.json
ALT_CONFIG_FILE="${HOME}/.gemini/config/mcp_config.json"
if [ -f "${ALT_CONFIG_FILE}" ] && [ ! -f "${TARGET_CONFIG_FILE}" ]; then
    TARGET_CONFIG_FILE="${ALT_CONFIG_FILE}"
fi

# If target is a symlink, resolve real target
if [ -L "${TARGET_CONFIG_FILE}" ]; then
    RESOLVED_TARGET="$(readlink -f "${TARGET_CONFIG_FILE}" 2>/dev/null || readlink "${TARGET_CONFIG_FILE}")"
    if [ -n "${RESOLVED_TARGET}" ] && [ -f "${RESOLVED_TARGET}" ]; then
        TARGET_CONFIG_FILE="${RESOLVED_TARGET}"
    fi
fi

echo -e "Target MCP Config File: ${GRAY}${TARGET_CONFIG_FILE}${NC}"

# Ensure parent directory exists
mkdir -p "$(dirname "${TARGET_CONFIG_FILE}")"

# Use Node.js for safe, atomic JSON mutation
node - <<EOF
const fs = require('fs');
const path = require('path');

const configPath = '${TARGET_CONFIG_FILE}';
const serverEntry = '${SERVER_ENTRY}';

let config = { mcpServers: {} };

if (fs.existsSync(configPath)) {
    try {
        const raw = fs.readFileSync(configPath, 'utf8').trim();
        if (raw.length > 0) {
            config = JSON.parse(raw);
        }
    } catch (err) {
        console.warn('  [!] Existing mcp_config.json could not be parsed. Creating backup.');
        fs.copyFileSync(configPath, configPath + '.bak.' + Date.now());
    }
}

if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    config.mcpServers = {};
}

config.mcpServers['opencode-bridge'] = {
    command: 'node',
    args: [serverEntry]
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
console.log('  [OK] Successfully registered opencode-bridge in ' + configPath);
EOF

# ------------------------------------------------------------------------------
# 3. Install Antigravity Skill
# ------------------------------------------------------------------------------
log_step "Installing Antigravity Skill (skills/opencode-bridge)..."

GLOBAL_SKILL_DIR="${HOME}/.gemini/antigravity/skills/opencode-bridge"
mkdir -p "${GLOBAL_SKILL_DIR}"

if [ -d "${SKILL_SOURCE}" ]; then
    cp -r "${SKILL_SOURCE}/." "${GLOBAL_SKILL_DIR}/"
    log_success "Installed global skill: ${GLOBAL_SKILL_DIR}"
else
    log_warn "Skill source directory not found: ${SKILL_SOURCE}"
fi

# Workspace-level skill if .agents exists
if [ -d ".agents" ]; then
    WORKSPACE_SKILL_DIR=".agents/skills/opencode-bridge"
    mkdir -p "${WORKSPACE_SKILL_DIR}"
    cp -r "${SKILL_SOURCE}/." "${WORKSPACE_SKILL_DIR}/"
    log_success "Installed workspace skill: ${WORKSPACE_SKILL_DIR}"
fi

# ------------------------------------------------------------------------------
# 4. Install Slash Command (/opencode)
# ------------------------------------------------------------------------------
log_step "Installing Slash Command (/opencode)..."

GLOBAL_COMMAND_DIR="${HOME}/.gemini/antigravity/commands"
mkdir -p "${GLOBAL_COMMAND_DIR}"

if [ -f "${COMMAND_SOURCE}" ]; then
    cp "${COMMAND_SOURCE}" "${GLOBAL_COMMAND_DIR}/opencode.md"
    log_success "Installed global slash command: ${GLOBAL_COMMAND_DIR}/opencode.md"
fi

if [ -d ".agents" ]; then
    WORKSPACE_COMMAND_DIR=".agents/commands"
    mkdir -p "${WORKSPACE_COMMAND_DIR}"
    cp "${COMMAND_SOURCE}" "${WORKSPACE_COMMAND_DIR}/opencode.md"
    log_success "Installed workspace slash command: ${WORKSPACE_COMMAND_DIR}/opencode.md"
fi

# ------------------------------------------------------------------------------
# Installation Summary
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}==========================================================${NC}"
echo -e "${GREEN}   Installation Complete! Ready to use in Antigravity.    ${NC}"
echo -e "${GREEN}==========================================================${NC}"
echo -e "To use OpenCode in Antigravity:"
echo -e "  1. Restart Antigravity or reload MCP servers."
echo -e "  2. Use the slash command: /opencode <your task>"
echo -e "  3. Or ask the agent: 'Delegate this refactoring to OpenCode subagent'"
echo -e "  4. Default free tier: opencode / deepseek-v4.1-flash-free"
echo -e "${GREEN}==========================================================${NC}\n"
