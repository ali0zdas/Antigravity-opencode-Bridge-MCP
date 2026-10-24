---
name: opencode-bridge
description: Delegate tasks to OpenCode subagents (any provider/model including free DeepSeek V4.1 Flash Free) via the agy-opencode-bridge-mcp server, with automatic background daemon management and reasoning effort control.
---

# OpenCode Bridge Subagent Skill

The `opencode-bridge` skill enables Google Antigravity to autonomously orchestrate, spawn, and collaborate with **OpenCode subagents**. By delegating code generation, extensive refactoring, exploratory spikes, or debugging runs to OpenCode, the Antigravity primary agent can execute tasks concurrently, harness specialized LLM providers, and optimize token expenditure.

---

## 1. Mandatory Model, Provider & Effort Protocol

> [!IMPORTANT]
> The Antigravity primary agent **MUST** follow this interactive gate whenever delegating a task to OpenCode.

### Universal Provider Support
OpenCode natively supports over 75+ AI model providers, including:
- **`opencode`** (Native OpenCode Zen services)
- **`openrouter`** (OpenRouter multi-model aggregation)
- **`nvidia`** (NVIDIA NIM APIs)
- **`orcarouter`** (OrcaRouter)
- **`ollama`** (Local offline inference)
- **`anthropic`**, **`openai`**, **`google`**, **`groq`**, **`mistral`**, etc.

### Default Configuration (Free Tier)
When no specific paid or external model is requested, OpenCode provides a native **100% free tier**:
- **Provider**: `opencode`
- **Model**: `deepseek-v4.1-flash-free`
- **Effort (`variant`)**: `default` (Supported levels: `low`, `high`, `max`, `default`)

### Decision Gate Matrix

```text
User Request Received
       │
       ▼
Did user specify provider, model, or effort?
(e.g., "Use deepseek-v4.1-flash-free", "use default", "with high effort", "via openrouter/claude-3-7-sonnet")
       │
       ├──► YES ──► IMMEDIATELY invoke `opencode_delegate_task` with requested params.
       │            (Zero unnecessary questions or delays).
       │
       └──► NO  ──► PROMPT USER CONCISELY:
                    "Which provider, model, and reasoning effort would you like to use?
                     (Reply **'default'** to use **`opencode / deepseek-v4.1-flash-free (default effort)`**)."
                    Wait for user response before delegating.
```

#### Example Prompt to User
```text
I am ready to delegate this task to an OpenCode subagent. 
Which provider, model, and reasoning effort would you like to use?
(Reply **"default"** to use **`opencode / deepseek-v4.1-flash-free (default effort)`**).
```

---

## 2. Autonomous Daemon Management (`opencode serve`)

The `agy-opencode-bridge-mcp` server features a built-in **Auto-Lifecycle Process Manager**.

- **Zero Manual Setup**: The user does **never** need to open a separate terminal to run `opencode serve`.
- **Automatic Health Check**: When `opencode_delegate_task` is called, the bridge checks if the OpenCode daemon is alive at `http://127.0.0.1:4096/api/info`.
- **Auto-Spawn**: If the daemon is not running, the bridge automatically spawns `opencode serve --port 4096 --hostname 127.0.0.1` in the background, waits for the HTTP health check to succeed, and proceeds with the task.
- **Manual Control (Optional)**: If the agent needs to diagnose or reset the daemon, use `opencode_server_control`:
  - `action: "status"` — Checks whether the daemon is active, PID, port, and version.
  - `action: "start"` — Explicitly spins up the background daemon.
  - `action: "restart"` — Restarts the daemon (useful if OpenCode state becomes stale).
  - `action: "stop"` — Cleanly shuts down the daemon process.

---

## 3. MCP Tools Reference

The `opencode-bridge` MCP server provides the following core tools:

### `opencode_delegate_task`
Dispatches a coding task, instruction, or query to an OpenCode subagent.

**Parameters:**
- `prompt` (*string, required*): Detailed prompt describing the task, files to edit, acceptance criteria, and constraints.
- `provider` (*string, optional*): AI provider ID (e.g. `'opencode'`, `'openrouter'`, `'nvidia'`, `'orcarouter'`, `'ollama'`). Defaults to `"opencode"`.
- `model` (*string, optional*): Model name (e.g. `'deepseek-v4.1-flash-free'`, `'deepseek-v4-pro'`). Defaults to `"deepseek-v4.1-flash-free"`.
- `effort` (*string, optional*): Reasoning effort variant: `'default'`, `'none'`, `'low'`, `'medium'`, `'high'`, `'xhigh'`, `'max'`, `'thinking'` (default: `"default"`).
- `session_id` (*string, optional*): Existing session ID for multi-turn conversations. If omitted, a fresh session is initialized.
- `directory` (*string, optional*): Working directory for the OpenCode agent. Defaults to the active workspace.
- `title` (*string, optional*): Short descriptive title for the session.

### `opencode_list_models`
Queries available models and reasoning effort variants directly from OpenCode.

**Parameters:**
- `provider` (*string, optional*): Filter by provider ID (e.g. `'opencode'`, `'openrouter'`, `'nvidia'`, `'ollama'`).
- `query` (*string, optional*): Search keyword matching model ID, name, or family (e.g. `'deepseek'`, `'free'`, `'claude'`).
- `free_only` (*boolean, optional*): If true, filters only for 100% free models.

### `opencode_server_control`
Manages the lifecycle of the local `opencode serve` process.

**Parameters:**
- `action` (*string, required*): `'status'` | `'start'` | `'restart'` | `'stop'` (default: `'status'`).

---

## 4. Multi-Turn Session Continuity

When an OpenCode subagent completes a step, `opencode_delegate_task` returns:
```json
{
  "session_id": "ses_019294a8-6b82-7fd1-9f21-99884511ab22",
  "status": "completed",
  "response": "Refactoring complete. 3 files updated, 12 unit tests passing.",
  "model": "deepseek-v4.1-flash-free",
  "provider": "opencode",
  "effort": "default"
}
```

### Continuing Follow-Up Turns
To ask follow-up questions, request adjustments, or run consecutive pipeline phases in the same workspace context:
1. Retain the `session_id`.
2. Pass `session_id: "ses_..."` in subsequent `opencode_delegate_task` calls.
3. OpenCode retains complete conversational memory, previously inspected ASTs, and context files across all turns within that session.

---

## 5. Execution Workflow & Best Practices

1. **Task Scoping**: When delegating to OpenCode, provide explicit file paths, exact acceptance requirements, and verification commands (e.g., `npm test`, `pytest`).
2. **Autonomous Tool Approval**: Ensure `auto_approve: true` is maintained so OpenCode can read files, write diffs, and run verification tests without blocking on interactive TTY prompts.
3. **Review & Integration**: Once OpenCode finishes, inspect the modified files in Antigravity, run lint/tests to verify compliance, and report concise results to the user.
4. **Git Safety Rule**: The Antigravity primary agent and OpenCode subagents must **NEVER** run `git commit` or `git push` autonomously. Always request user confirmation before committing.
