/**
 * MCP Tool Definitions and Handlers for OpenCode Bridge
 * 
 * Exposes tools for delegating subagent tasks, listing available models,
 * and controlling the background server lifecycle.
 */

const opencodeClient = require('./opencode-client');

const TOOL_DEFINITIONS = [
  {
    name: 'opencode_delegate_task',
    description: "Delegate a coding, refactoring, debugging, research, or reasoning task to an OpenCode subagent. IMPORTANT: If the user has not specified the model, provider, or reasoning effort, ask the user first while offering the default ('opencode' provider, 'deepseek-v4.1-flash-free' model, 'default' effort). If the user confirms defaults or specifies parameters, call this tool.",
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed task instructions and context for the subagent.'
        },
        provider: {
          type: 'string',
          description: "Provider ID (e.g. 'opencode', 'openrouter', 'nvidia', 'orcarouter', 'ollama'). Defaults to 'opencode'.",
          default: 'opencode'
        },
        model: {
          type: 'string',
          description: "Model ID (e.g. 'deepseek-v4.1-flash-free', 'deepseek-v4-pro', 'flint-40b-free'). Defaults to 'deepseek-v4.1-flash-free'.",
          default: 'deepseek-v4.1-flash-free'
        },
        effort: {
          type: 'string',
          description: "Reasoning effort / variant ('default', 'none', 'low', 'medium', 'high', 'xhigh', 'max', 'thinking'). Defaults to 'default'.",
          enum: ['default', 'none', 'low', 'medium', 'high', 'xhigh', 'max', 'thinking'],
          default: 'default'
        },
        session_id: {
          type: 'string',
          description: 'Existing OpenCode session ID to continue a multi-turn conversation or task.'
        },
        directory: {
          type: 'string',
          description: 'Target project workspace directory path.'
        },
        title: {
          type: 'string',
          description: 'Short descriptive title for the session.'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'opencode_list_models',
    description: "List available models and supported reasoning effort variants in OpenCode. Can filter by provider (e.g. 'opencode', 'openrouter', 'nvidia') or search query (e.g. 'deepseek', 'free').",
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          description: "Filter models by provider ID (e.g. 'opencode', 'openrouter', 'nvidia', 'orcarouter', 'ollama')."
        },
        query: {
          type: 'string',
          description: "Search keyword matching model id, name, or family (e.g. 'deepseek', 'free', 'qwen', 'claude')."
        },
        free_only: {
          type: 'boolean',
          description: 'If true, only returns models that have zero input and output cost.',
          default: false
        }
      }
    }
  },
  {
    name: 'opencode_server_control',
    description: "Manage the background 'opencode serve' daemon directly from Antigravity. Supports 'status', 'start' (auto-spawns if stopped), 'restart', and 'stop'.",
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: "The lifecycle action to perform ('status', 'start', 'restart', 'stop').",
          enum: ['status', 'start', 'restart', 'stop'],
          default: 'status'
        }
      }
    }
  }
];

/**
 * Dispatches and executes an MCP tool by name.
 * 
 * @param {string} name Tool name
 * @param {object} args Arguments passed to the tool
 * @returns {Promise<string>} Textual representation of result
 */
async function executeTool(name, args = {}) {
  switch (name) {
    case 'opencode_delegate_task': {
      if (!args.prompt) {
        throw new Error("Missing required parameter: 'prompt'");
      }

      const result = await opencodeClient.runSubagentPrompt({
        prompt: args.prompt,
        providerID: args.provider || 'opencode',
        modelID: args.model || 'deepseek-v4.1-flash-free',
        effort: args.effort || 'default',
        sessionID: args.session_id || null,
        title: args.title || 'antigravity-subagent-task',
        directory: args.directory || null
      });

      const sections = [];
      sections.push(`### 🤖 OpenCode Subagent Response`);
      sections.push(`- **Session ID:** \`${result.sessionID}\``);
      sections.push(`- **Model:** \`${result.model.providerID}/${result.model.modelID}\` (Effort: \`${result.model.effort}\`)`);
      
      const tokenParts = [];
      if (result.tokens) {
        if (result.tokens.input) tokenParts.push(`Input: ${result.tokens.input}`);
        if (result.tokens.output) tokenParts.push(`Output: ${result.tokens.output}`);
        if (result.tokens.reasoning) tokenParts.push(`Reasoning: ${result.tokens.reasoning}`);
        if (result.tokens.cache?.read) tokenParts.push(`Cache Read: ${result.tokens.cache.read}`);
      }
      sections.push(`- **Tokens:** ${tokenParts.length > 0 ? tokenParts.join(', ') : 'N/A'}`);
      sections.push(`- **Cost:** $${Number(result.cost || 0).toFixed(4)}`);

      if (result.reasoningText && result.reasoningText.trim().length > 0) {
        sections.push(`\n#### 🧠 Reasoning Process:\n${result.reasoningText.trim()}`);
      }

      sections.push(`\n#### 💬 Final Output:\n${result.responseText || '_No textual output returned._'}`);

      if (result.toolCalls && result.toolCalls.length > 0) {
        sections.push(`\n#### 🛠️ Tool Invocations (${result.toolCalls.length}):`);
        sections.push('```json\n' + JSON.stringify(result.toolCalls, null, 2) + '\n```');
      }

      return sections.join('\n');
    }

    case 'opencode_list_models': {
      const models = await opencodeClient.listModels({
        provider: args.provider,
        query: args.query,
        free_only: args.free_only
      });

      if (models.length === 0) {
        return `No models matched the specified criteria (Provider: ${args.provider || 'any'}, Query: "${args.query || ''}", Free Only: ${!!args.free_only}).`;
      }

      const lines = [
        `### 📋 Available Models (${models.length} found)`,
        '',
        '| Provider | Model ID | Name | Free | Context Limit | Reasoning Variants |',
        '|---|---|---|---|---|---|'
      ];

      for (const m of models) {
        const variantsStr = (m.variants && m.variants.length > 0) ? m.variants.join(', ') : 'none';
        const freeBadge = m.isFree ? '✅ Free' : 'Paid';
        const contextStr = m.contextLimit ? `${Math.round(m.contextLimit / 1024)}k` : 'N/A';
        lines.push(`| \`${m.providerID}\` | \`${m.id}\` | ${m.name} | ${freeBadge} | ${contextStr} | ${variantsStr} |`);
      }

      return lines.join('\n');
    }

    case 'opencode_server_control': {
      const action = (args.action || 'status').toLowerCase();

      if (action === 'status') {
        const status = await opencodeClient.getServerStatus();
        return [
          `### 🖥️ OpenCode Server Status`,
          `- **Running:** ${status.running ? '🟢 Online' : '🔴 Offline'}`,
          `- **URL:** ${status.url ? `\`${status.url}\`` : 'N/A'}`,
          `- **Port:** ${status.port || 'N/A'}`,
          `- **PID:** ${status.pid || 'N/A'}`,
          `- **Version:** ${status.version || 'Unknown'}`,
          `- **Auto-Managed Daemon:** ${status.autoManaged ? 'Yes' : 'No'}`
        ].join('\n');
      }

      if (action === 'start') {
        const server = await opencodeClient.ensureServer();
        return [
          `### 🚀 OpenCode Server Started / Verified`,
          `- **Status:** 🟢 Online`,
          `- **URL:** \`${server.url}\``,
          `- **Port:** ${server.port}`,
          `- **PID:** ${server.pid || 'N/A'}`,
          `- **Version:** ${server.version || 'Unknown'}`,
          `- **Auto-Managed Daemon:** ${server.autoManaged ? 'Yes' : 'No'}`
        ].join('\n');
      }

      if (action === 'stop') {
        const stopResult = await opencodeClient.stopServer();
        return [
          `### 🛑 OpenCode Server Stop`,
          `- **Message:** ${stopResult.message}`,
          `- **Process Terminated:** ${stopResult.killed ? 'Yes' : 'No'}`
        ].join('\n');
      }

      if (action === 'restart') {
        await opencodeClient.stopServer();
        const server = await opencodeClient.ensureServer();
        return [
          `### 🔄 OpenCode Server Restarted`,
          `- **Status:** 🟢 Online`,
          `- **URL:** \`${server.url}\``,
          `- **Port:** ${server.port}`,
          `- **PID:** ${server.pid || 'N/A'}`,
          `- **Version:** ${server.version || 'Unknown'}`,
          `- **Auto-Managed Daemon:** ${server.autoManaged ? 'Yes' : 'No'}`
        ].join('\n');
      }

      throw new Error(`Unsupported server control action: "${action}". Valid actions: 'status', 'start', 'restart', 'stop'.`);
    }

    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  executeTool
};
