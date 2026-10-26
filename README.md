<div align="center">

# 🌉 AGY-OpenCode Bridge MCP
### *Zero-Config, Zero-Ban Subagent Bridge Connecting Google Antigravity to OpenCode's 75+ Providers & Free DeepSeek V4.1 Flash*

<p align="center">
  <b>Empower Gemini 4 Argon to autonomously orchestrate OpenCode tasks, leverage $0 free-tier models, and bypass CLI friction — with 100% local, ToS-compliant architecture.</b>
</p>

[![Protocol](https://img.shields.io/badge/Protocol-MCP_2025%2F2026-0052CC?style=for-the-badge&logo=json&logoColor=white)](https://modelcontextprotocol.io)
[![Primary Conductor](https://img.shields.io/badge/Conductor-Google_Antigravity_%2F_Gemini_4_Argon-8E24AA?style=for-the-badge&logo=googlegemini&logoColor=white)](https://aistudio.google.com/learn/gemini-4-argon-developer-guide)
[![Default Subagent](https://img.shields.io/badge/Subagent-DeepSeek_V4.1_Flash_Free-4D6BFE?style=for-the-badge&logo=deepseek&logoColor=white)](https://deepseek.com)
[![Auto-Daemon](https://img.shields.io/badge/Auto--Daemon-opencode_serve-FF6F00?style=for-the-badge&logo=gnubash&logoColor=white)](https://github.com/opencode-ai/opencode)
[![Safety](https://img.shields.io/badge/Safety-100%25_ToS_Compliant_%E2%80%A2_Zero_Ban_Risk-00C853?style=for-the-badge&logo=shield&logoColor=white)](#-why-this-exists)
[![License: MIT](https://img.shields.io/badge/License-MIT-FBC02D?style=for-the-badge)](./LICENSE)

<br/>

| 💸 **$0 Free Model Tier** | 🛡️ **100% Zero Ban Risk** | ⚙️ **Autonomous Server Lifecycle** |
| :---: | :---: | :---: |
| Default `opencode/deepseek-v4.1-flash-free` with **$0 input / $0 output** eliminates token anxiety for bulk edits | Pure local OpenAPI 3.1 bridge. Zero OAuth reverse-proxy hacks, zero token tampering, zero account suspensions | Spawns `opencode serve` in the background, extracts ephemeral auth tokens on the fly, and reuses sessions |

</div>

---

## 💡 Why This Exists (The Problem & The Solution)

Developers using **Google Antigravity** (powered by Gemini 4 Argon) often face two critical dilemmas when trying to offload repetitive code implementation, test generation, and refactoring:

### 1. The Risk of Unofficial OAuth Reverse-Proxies (and Why This Bridge Is 100% Safe)
Some experimental community tools attempt to bridge OpenCode and Google Antigravity by reverse-proxying Google OAuth tokens or spoofing internal Google Cloud endpoints. Such approaches violate Google Terms of Service and trigger automated abuse detection (often resulting in `403 Forbidden` errors or Google account restrictions).

> [!NOTE]
> **🛡️ Zero Ban Risk & 100% Legitimate by Design:**  
> **AGY-OpenCode Bridge MCP does NOT touch, spoof, or proxy your Google account credentials or tokens.**  
> - **Antigravity** runs natively inside its authorized environment (with your legitimate Gemini account).  
> - **OpenCode** runs entirely locally on your machine via its own official HTTP server, using standard local provider keys or OpenCode's **free DeepSeek V4.1 Flash tier**.  
> - All communication occurs purely over local `127.0.0.1` JSON-RPC and REST. There is zero Google ToS violation and **zero risk to your Google account**.

### 2. Fragile CLI Subprocess Spawners (`opencode run`)
Other tools attempt to invoke `opencode run` via raw command-line child processes. This approach is notoriously fragile:
- **TTY Hangs & Deadlocks:** Interactive permission requests, telemetry prompts, and ANSI escapes freeze headless agent executions.
- **Cold-Start Latency:** Spawning a fresh Node/Go runtime on every prompt creates 3–8 second initialization penalties.
- **Lost Context:** Spawning ad-hoc processes prevents seamless multi-turn session continuation and persistent workspace state.

---

### The Solution: Native OpenAPI 3.1 Stdio MCP Bridge

`agy-opencode-bridge-mcp` resolves both dilemmas once and for all:

1. **100% Official Local Architecture:** It connects Google Antigravity to OpenCode's native, official v2 HTTP server (`/api/session`, `/api/model`, `/api/config`) via local JSON-RPC over stdio.
2. **Autonomous Background Daemon (`opencode serve`):** When Antigravity requests a subagent task, the bridge automatically checks if an OpenCode server is already active on localhost. If not, it autonomously launches `opencode serve`, intercepts its ephemeral stdout password in milliseconds, authenticates via Basic Auth, and maintains a persistent, zero-latency HTTP pool.
3. **Zero Ban Risk & Full Compliance:** Antigravity remains the master architect using your legitimate Gemini 4 Argon account, while OpenCode operates as an isolated subagent engine using standard API keys or OpenCode's **100% free DeepSeek V4.1 Flash tier**.

---

### 📊 Architectural Comparison

| Capability / Trait | 🌉 **AGY-OpenCode Bridge MCP** <br/> *(This Repository)* | Risky OAuth Proxy Hacks <br/> *(e.g., `opencode-antigravity-auth`)* | CLI Subprocess Wrappers <br/> *(e.g., `opencode run`)* |
| :--- | :---: | :---: | :---: |
| **Account Safety & ToS** | 🟢 **100% Safe & Compliant** (Official local API) | 🔴 **High Ban Risk** (ToS violation, 403 blocks) | 🟡 Safe (Standard CLI) |
| **Setup Friction** | 🟢 **Zero-Config** (Auto-spawns & auto-authenticates) | 🔴 Complex OAuth extraction & browser hijacking | 🟡 Manual terminal commands |
| **Protocol** | 🟢 **Standard Model Context Protocol (MCP)** | 🔴 Unofficial HTTP reverse proxy | 🔴 Brittle Stdin/Stdout terminal pipe |
| **Server Lifecycle** | 🟢 **Autonomous Daemon Management** | 🔴 Manual background service | 🔴 Cold process spawned per turn |
| **Authentication Flow** | 🟢 **Auto-captured ephemeral password token** | 🔴 Fake Google tokens | 🟡 OpenCode CLI login |
| **Interactive TTY Issues** | 🟢 **Zero TTY dependency** (Direct REST v2) | 🔴 Unstable proxy drops | 🔴 Frequent TTY freezes & prompt blocks |
| **Multi-Turn Sessions** | 🟢 **Native Session IDs** (`/api/session`) | ❌ Stateless / Flaky | ❌ Hard to maintain across child processes |
| **Provider Support** | 🟢 **75+ Providers** (OpenCode, OpenRouter, Ollama, etc.) | 🔴 Limited to hijacked endpoint | 🟡 OpenCode CLI defaults |

---

## 🏗️ Architecture & Autonomous Server Flow

The diagram below illustrates how Google Antigravity coordinates with OpenCode through the Bridge MCP:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                           USER / DEVELOPER                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ User Prompt
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   GOOGLE ANTIGRAVITY (CONDUCTOR)                       │
│                        Gemini 4 Argon Engine                           │
│                                                                        │
│  • System Architecture & High-Level Task Decomposition                 │
│  • Anti-Rationalization & Contract Enforcement                         │
│  • Subagent Dispatch via Model Context Protocol (MCP)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Stdio JSON-RPC Communication
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    AGY-OPENCODE-BRIDGE-MCP SERVER                      │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               Autonomous Server Lifecycle Manager              │   │
│   │                                                                │   │
│   │  1. Health Check (GET http://127.0.0.1:4096/api/session)       │   │
│   │  2. If inactive -> Spawn `opencode serve --port 4096`          │   │
│   │  3. Intercept stdout: "server password <token>"                │   │
│   │  4. Cache ephemeral token in memory for Basic Auth             │   │
│   │  5. Maintain connection pool & handle graceful teardown        │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ Authenticated Local HTTP v2
                                    │ (Basic Auth: opencode:<token>)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       OPENCODE v2 HTTP ENGINE                          │
│                          (opencode serve)                              │
│                                                                        │
│   Endpoints:                                                           │
│   • POST /api/session (Create session, send prompt, stream diffs)     │
│   • GET  /api/model   (Query models, context limits, & variants)       │
│   • POST /api/session/:id/cancel (Abort running task)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       Routing to Configured AI Provider (Default: Zero Cost Tier)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      75+ SUPPORTED AI PROVIDERS                        │
│                                                                        │
│  ┌───────────────────────────┐         ┌───────────────────────────┐   │
│  │     OPENCODE FREE TIER    │         │     OPENROUTER / NIM      │   │
│  │ deepseek-v4.1-flash-free  │         │ claude-3-7-sonnet-thought │   │
│  │      ($0 in / $0 out)     │         │ gpt-5-codex / llama-3.3   │   │
│  └───────────────────────────┘         └───────────────────────────┘   │
│  ┌───────────────────────────┐         ┌───────────────────────────┐   │
│  │     LOCAL OFFLINE AI      │         │   COMMERCIAL PROVIDERS    │   │
│  │  Ollama / LM Studio / vLLM│         │ Anthropic / OpenAI / Groq │   │
│  │ qwen2.5-coder / deepseek  │         │ mistral-large / gemini    │   │
│  └───────────────────────────┘         └───────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Autonomous Server Lifecycle Deep-Dive

When an MCP tool call is received, the bridge executes an automatic 5-phase handshake:

```text
[Antigravity Prompt] 
         │
         ▼
[Phase 1: Ping] ────> Is http://127.0.0.1:4096 responding?
         │
         ├─ YES ──> Reuse active session & credentials.
         │
         └─ NO ───> [Phase 2: Spawn] Launch `opencode serve --port 4096` in background.
                           │
                           ▼
                    [Phase 3: Intercept] Stream process stdout in real-time:
                           ├─ Match: "server listening on http://127.0.0.1:4096"
                           └─ Match: "server password ([A-Za-z0-9-_]+)"
                           │
                           ▼
                    [Phase 4: Authenticate] Build Basic Auth header:
                           `Authorization: Basic base64("opencode:<password>")`
                           │
                           ▼
                    [Phase 5: Execute] Dispatch payload to `/api/session` and stream output.
```

> [!TIP]
> **Zero Manual Setup Required:** You never need to open a separate terminal tab to run `opencode serve`. The bridge manages the background process automatically, recovers if the server is killed, and prevents port collisions.

---

## 🎛️ Dynamic Model, Provider & Reasoning Effort Selection

The bridge gives Google Antigravity full access to any model and provider configured in OpenCode, spanning cloud APIs, free inference tiers, and local offline models.

### Interactive Triage & Default Values

If your prompt does not specify a target model or provider, Google Antigravity (Gemini 4 Argon) interacts with you dynamically:
1. **Presents the Zero-Cost Default:** Proposes running the task on `opencode/deepseek-v4.1-flash-free` at zero cost.
2. **Offers Provider Alternatives:** Lets you choose OpenRouter, Ollama, OpenAI, Anthropic, or any connected provider.
3. **Selects Reasoning Effort:** Configures how deeply the subagent ponders edge cases before outputting code.

| Setting | Default Value | Available Alternatives |
| :--- | :--- | :--- |
| **Provider** | `opencode` | `openrouter`, `nvidia`, `orcarouter`, `ollama`, `lmstudio`, `groq`, `mistral`, `anthropic`, `openai` |
| **Model** | `deepseek-v4.1-flash-free` | `deepseek-r1`, `claude-3-7-sonnet`, `gemini-2.5-pro`, `qwen-2.5-coder-32b`, `llama-3.3-70b` |
| **Effort (`variant`)** | `default` | `low` (ultra-fast), `high` (multi-turn self-audit), `max` (deep chain-of-thought), `thinking` |
| **Session Mode** | `ephemeral` | `persistent` (continue via existing `session_id`) |

### Popular Model Profiles

| Profile Name | Provider | Model Identifier | Input / Output Cost | Best Used For |
| :--- | :--- | :--- | :--- | :--- |
| ⚡ **Free Flash Workhorse** *(Default)* | `opencode` | `deepseek-v4.1-flash-free` | **$0.00 / $0.00** | Boilerplate code, unit test generation, leaf module edits, documentation |
| 🧠 **Free Deep Reasoner** | `opencode` | `deepseek-r1-free` | **$0.00 / $0.00** | Complex algorithms, concurrency debugging, state-machine design |
| 🔒 **100% Offline / Air-Gapped** | `ollama` | `qwen2.5-coder:32b` | **$0.00 (Local Hardware)** | Proprietary codebases, air-gapped environments, zero data egress |
| 🚀 **Ultra-Fast Speedster** | `groq` | `llama-3.3-70b-versatile` | Pay-per-token (Standard) | High-speed migrations, rapid AST sweeps, lint auto-fixes |
| 👑 **Frontier Co-Pilot** | `openrouter` | `anthropic/claude-3.7-sonnet` | Pay-per-token (Standard) | Mission-critical refactoring, architectural parity reviews |

---

## 🛠️ MCP Tools Reference Table

The bridge registers 3 primary tools with Google Antigravity over the Model Context Protocol:

| Tool Name | Scope & Purpose | Input Parameters | Return Value |
| :--- | :--- | :--- | :--- |
| [`opencode_delegate_task`](#opencode_delegate_task) | Executes a code generation, refactoring, or analysis task via OpenCode | `prompt` *(req)*, `provider`, `model`, `variant`, `directory`, `session_id` | JSON containing session output, generated files, diffs, and execution status |
| [`opencode_list_models`](#opencode_list_models) | Discovers all available models, providers, context windows, and pricing | `provider` *(opt)*, `refresh` *(opt)* | Structured list of models, aliases, providers, and capabilities |
| [`opencode_server_control`](#opencode_server_control) | Inspects or manually manages the local `opencode serve` daemon process | `action` *(req: status, start, restart, stop)*, `port` *(opt)* | Server PID, port, uptime, memory status, and health metrics |

---

### Detailed Tool Specifications

#### 1. `opencode_delegate_task`

Dispatches instructions to an OpenCode subagent. If no server is running, launches the daemon automatically.

```json
{
  "name": "opencode_delegate_task",
  "description": "Delegate a coding, refactoring, or file editing subtask to OpenCode.",
  "parameters": {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "The exact instructions and interface contract for the subagent."
      },
      "provider": {
        "type": "string",
        "description": "The target AI provider (e.g. 'opencode', 'openrouter', 'ollama'). Defaults to 'opencode'.",
        "default": "opencode"
      },
      "model": {
        "type": "string",
        "description": "The model identifier. Defaults to 'deepseek-v4.1-flash-free'.",
        "default": "deepseek-v4.1-flash-free"
      },
      "variant": {
        "type": "string",
        "enum": ["default", "low", "high", "max", "thinking"],
        "description": "Reasoning effort / model variant. Defaults to 'default'.",
        "default": "default"
      },
      "session_id": {
        "type": "string",
        "description": "Existing session ID to continue a multi-turn conversation."
      },
      "directory": {
        "type": "string",
        "description": "Working directory for OpenCode. Defaults to current workspace."
      }
    },
    "required": ["prompt"]
  }
}
```

#### 2. `opencode_list_models`

Fetches all installed or remotely accessible models from the OpenCode v2 registry.

```json
{
  "name": "opencode_list_models",
  "description": "List all models and providers supported by the running OpenCode instance.",
  "parameters": {
    "type": "object",
    "properties": {
      "provider": {
        "type": "string",
        "description": "Optional provider filter (e.g., 'opencode', 'openrouter')."
      },
      "refresh": {
        "type": "boolean",
        "description": "Force cache invalidation and query upstream providers directly.",
        "default": false
      }
    }
  }
}
```

#### 3. `opencode_server_control`

Provides explicit control over the background daemon lifecycle.

```json
{
  "name": "opencode_server_control",
  "description": "Inspect or manage the local OpenCode v2 background daemon.",
  "parameters": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["status", "start", "restart", "stop"],
        "description": "Lifecycle action to perform."
      },
      "port": {
        "type": "integer",
        "description": "Port number to bind or inspect. Defaults to 4096.",
        "default": 4096
      }
    },
    "required": ["action"]
  }
}
```

---

## 🚀 Quick Installation

Choose your preferred installation method:

### Option 1: AI Prompt-Based *(Zero Terminal / Antigravity Native)*

Paste this single prompt directly into your **Google Antigravity** chat:

```text
Please install and register the agy-opencode-bridge-mcp server into my Antigravity MCP configuration from https://github.com/ali0zdas/agy-opencode-bridge-mcp.git. Verify that `opencode` is available in PATH, start the bridge server in stdio mode, and test connectivity by listing models.
```

---

### Option 2: Windows PowerShell One-Liner

Open PowerShell and execute:

```powershell
irm https://raw.githubusercontent.com/ali0zdas/agy-opencode-bridge-mcp/main/install.ps1 | iex
```

Or clone and run locally:

```powershell
git clone https://github.com/ali0zdas/agy-opencode-bridge-mcp.git
cd "agy-opencode-bridge-mcp"
.\install.ps1
```

---

### Option 3: Linux / macOS / WSL One-Liner

Open your shell and execute:

```bash
curl -fsSL https://raw.githubusercontent.com/ali0zdas/agy-opencode-bridge-mcp/main/install.sh | bash
```

Or clone and run locally:

```bash
git clone https://github.com/ali0zdas/agy-opencode-bridge-mcp.git
cd "agy-opencode-bridge-mcp"
chmod +x install.sh && ./install.sh
```

---

### Option 4: Manual MCP Configuration

Add the server to your Antigravity MCP configuration file:
- **Windows:** `%USERPROFILE%\.gemini\antigravity\mcp_config.json`
- **macOS / Linux:** `~/.gemini/antigravity/mcp_config.json`

```json
{
  "mcpServers": {
    "agy-opencode-bridge": {
      "command": "node",
      "args": [
        "G:/Github/agy-opencode bridge mcp/dist/index.js"
      ],
      "env": {
        "OPENCODE_PORT": "4096",
        "OPENCODE_AUTO_SERVE": "true",
        "OPENCODE_DEFAULT_PROVIDER": "opencode",
        "OPENCODE_DEFAULT_MODEL": "deepseek-v4.1-flash-free",
        "OPENCODE_DEFAULT_VARIANT": "default"
      }
    }
  }
}
```

*(If running with Python/uvx or direct binary, simply adjust the `command` and `args` to point to your executable).*

---

## 💻 Real-World Usage Examples

### Example 1: Interactive Delegation with Zero-Cost Default

You ask Gemini 4 Argon to implement a set of repetitive unit tests without burning primary tokens:

```text
User: "Generate complete unit test suites for all 6 auth route handlers in src/routes/auth/*.ts."
```

**Gemini 4 Argon Interaction:**
> *"I will delegate the generation of the 6 unit test files to our OpenCode subagent. By default, I will use **`opencode/deepseek-v4.1-flash-free` ($0 input / $0 output)** with reasoning effort set to `default`. Would you like to use this zero-cost model, or switch to another provider such as Claude 3.7 or local Ollama?"*

**Execution:**
```json
{
  "tool": "opencode_delegate_task",
  "arguments": {
    "prompt": "Create Jest test suites for all route handlers in src/routes/auth/*.ts. Mock the database pool and verify 200, 400, and 401 scenarios.",
    "provider": "opencode",
    "model": "deepseek-v4.1-flash-free",
    "variant": "default"
  }
}
```

---

### Example 2: Direct High-Effort Reasoning Override

You need deep algorithmic thinking and self-auditing for complex concurrency logic:

```text
User: "Use OpenCode with DeepSeek V4.1 Flash Free on max effort to refactor the distributed lock manager in src/cache/lock.ts to prevent deadlock cascades under high contention."
```

**Gemini 4 Argon Dispatches:**
```json
{
  "tool": "opencode_delegate_task",
  "arguments": {
    "prompt": "Refactor src/cache/lock.ts. Implement exponential backoff jitter and automatic lease renewal heartbeats. Ensure all promise rejection branches release acquired redis keys.",
    "provider": "opencode",
    "model": "deepseek-v4.1-flash-free",
    "variant": "max"
  }
}
```

*OpenCode engages extended chain-of-thought analysis (`variant: "max"`), evaluates race conditions, writes tests, and returns clean code diffs to Gemini 4 Argon for final sign-off.*

---

### Example 3: Multi-Turn Session Continuation & Autonomous Daemon

You work on an extensive feature across multiple steps while maintaining state:

```text
# Turn 1: Initial migration
User: "Delegate task to OpenCode to scaffold the Postgres schema migrations for user multi-tenancy."
-> Bridge auto-starts `opencode serve`, extracts auth token, creates session `sess_01J8K9...`

# Turn 2: Follow-up iteration on existing session
User: "Now update the repository layer to filter queries by tenant_id using the session from the previous turn."
```

**Antigravity Dispatches Turn 2:**
```json
{
  "tool": "opencode_delegate_task",
  "arguments": {
    "prompt": "Inject tenant_id where-clauses into all queries inside src/repositories/user.repository.ts based on the migrations just created.",
    "session_id": "sess_01J8K9..."
  }
}
```

*OpenCode retains context from Turn 1, modifies repository files, and returns diffs seamlessly without restarting the server or losing working memory.*

---

## 🛡️ Security, Privacy & Compliance

- **No Unauthorized Google Reverse-Proxies:** Does NOT intercept, tamper with, or replay Google Cloud or Antigravity authentication cookies.
- **Strictly Localhost Communication:** The daemon binds to `127.0.0.1`. No external ports or public tunnels are ever opened.
- **Ephemeral Credentials:** The server password changes each time `opencode serve` launches; passwords are kept strictly in-memory by the bridge process and are never logged or committed to disk.
- **Air-Gapped Ready:** When paired with local providers like `ollama` or `lmstudio`, code never leaves your local machine.

---

## 📄 License & Attribution

- Distributed under the **[MIT License](./LICENSE)**.
- Created with ❤️ by **[Ali Özdaş](https://github.com/ali0zdas)**.
- Connects **[Google Antigravity](https://aistudio.google.com/learn/gemini-4-argon-developer-guide)** and **[OpenCode](https://github.com/opencode-ai/opencode)** via the **[Model Context Protocol (MCP)](https://modelcontextprotocol.io)**.
