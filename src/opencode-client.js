/**
 * OpenCode v2 HTTP Client & Autonomous Server Manager
 * 
 * Provides zero-config CLI resolution, background daemon lifecycle management,
 * model discovery, and robust subagent task execution with reasoning stream support.
 * 
 * Zero external npm dependencies — built on Node.js standard libraries.
 */

const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const STATE_FILE_PATH = path.join(os.tmpdir(), 'agy-opencode-bridge-state.json');

/**
 * Resolves the OpenCode CLI executable automatically across platforms and install locations.
 * 
 * Resolution order:
 * 1. process.env.OPENCODE_BIN
 * 2. %APPDATA%\ai.opencode.desktop\cli\<latest>\opencode-cli.exe (descending sort)
 * 3. %LOCALAPPDATA%\Programs\@opencodedesktop\resources\opencode-cli.exe
 * 4. %APPDATA%\npm\opencode.cmd / opencode
 * 5. Fallback to 'opencode' on system PATH
 * 
 * @returns {string} Path or command to invoke opencode CLI
 */
function resolveOpenCodeBinary() {
  // 1. Environment variable override
  if (process.env.OPENCODE_BIN && fs.existsSync(process.env.OPENCODE_BIN)) {
    return process.env.OPENCODE_BIN;
  }

  // 2. OpenCode Desktop AppData CLI directory
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const cliBaseDir = path.join(appData, 'ai.opencode.desktop', 'cli');
  if (fs.existsSync(cliBaseDir)) {
    try {
      const entries = fs.readdirSync(cliBaseDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

      for (const entry of entries) {
        const candidate = path.join(cliBaseDir, entry, 'opencode-cli.exe');
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    } catch {
      // Proceed to next resolution candidate
    }
  }

  // 3. OpenCode Desktop Local AppData installation
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const candidateResources = path.join(localAppData, 'Programs', '@opencodedesktop', 'resources', 'opencode-cli.exe');
  if (fs.existsSync(candidateResources)) {
    return candidateResources;
  }

  // 4. Global npm install location
  const npmCmd = path.join(appData, 'npm', 'opencode.cmd');
  if (fs.existsSync(npmCmd)) {
    return npmCmd;
  }
  const npmBin = path.join(appData, 'npm', 'opencode');
  if (fs.existsSync(npmBin)) {
    return npmBin;
  }

  // 5. Fallback to system PATH
  return process.platform === 'win32' ? 'opencode.exe' : 'opencode';
}

/**
 * Executes an HTTP request using the Node.js built-in http module.
 * 
 * @param {object} options
 * @param {string} [options.method='GET']
 * @param {string} options.url Base URL (e.g. "http://127.0.0.1:4096")
 * @param {string} [options.path=''] Path and query string (e.g. "/api/info")
 * @param {object} [options.headers={}] Request headers
 * @param {object|string} [options.body=null] JSON-serializable body
 * @param {number} [options.timeout=30000] Timeout in milliseconds
 * @returns {Promise<{ statusCode: number, headers: object, data: any }>}
 */
function makeHttpRequest({ method = 'GET', url, path: reqPath = '', headers = {}, body = null, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(reqPath, url);
      const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

      const requestHeaders = { ...headers };
      if (postData) {
        if (!requestHeaders['Content-Type']) {
          requestHeaders['Content-Type'] = 'application/json';
        }
        requestHeaders['Content-Length'] = Buffer.byteLength(postData);
      }

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: method.toUpperCase(),
        headers: requestHeaders,
        timeout
      };

      const req = http.request(options, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsedData = null;
          try {
            parsedData = JSON.parse(raw);
          } catch {
            parsedData = raw;
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            data: parsedData
          });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`HTTP request timed out after ${timeout}ms: ${method} ${parsedUrl.href}`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates Basic Auth header for OpenCode API authentication.
 * 
 * @param {string} password 
 * @returns {object} Authorization header object
 */
function getAuthHeader(password) {
  if (!password) return {};
  const encoded = Buffer.from(`opencode:${password}`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
}

/**
 * Checks if the OpenCode server is responding to GET /api/info.
 * 
 * @param {string} url Base URL
 * @param {string} password Server password
 * @param {number} [timeout=3000] Timeout in ms
 * @returns {Promise<{ healthy: boolean, info: any }>}
 */
async function checkServerHealth(url, password, timeout = 3000) {
  try {
    const res = await makeHttpRequest({
      method: 'GET',
      url,
      path: '/api/info',
      headers: getAuthHeader(password),
      timeout
    });
    if (res.statusCode === 200 && res.data) {
      return { healthy: true, info: res.data };
    }
    return { healthy: false, info: null };
  } catch {
    return { healthy: false, info: null };
  }
}

/**
 * Finds a free TCP port on localhost starting from a candidate port.
 * 
 * @param {number} [startPort=4096] 
 * @returns {Promise<number>}
 */
function findFreePort(startPort = 4096) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const server = net.createServer();
      server.unref();
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
      server.listen(port, '127.0.0.1', () => {
        server.close((closeErr) => {
          if (closeErr) return reject(closeErr);
          resolve(port);
        });
      });
    }
    tryPort(startPort);
  });
}

/**
 * Reads cached server state from temporary file.
 * 
 * @returns {object|null}
 */
function readState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // Ignore corrupt or unreadable state file
  }
  return null;
}

/**
 * Writes server state to temporary file.
 * 
 * @param {object} state 
 */
function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error(`[OpenCodeClient] Failed to write state file: ${err.message}`);
  }
}

/**
 * Cleans up temporary state file.
 */
function clearState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      fs.unlinkSync(STATE_FILE_PATH);
    }
  } catch {
    // Ignore error
  }
}

/**
 * Ensures an OpenCode server is running and returns connection details.
 * 
 * Checks environment variables first, then cached state, and spawns
 * a new background daemon if no healthy server exists.
 * 
 * @returns {Promise<{ url: string, port: number, password: string, pid: number|null, autoManaged: boolean, version?: string }>}
 */
async function ensureServer() {
  // 1. Check explicit environment variables
  if (process.env.OPENCODE_SERVER_URL && process.env.OPENCODE_PASSWORD) {
    const envUrl = process.env.OPENCODE_SERVER_URL.replace(/\/+$/, '');
    const envPass = process.env.OPENCODE_PASSWORD;
    const health = await checkServerHealth(envUrl, envPass);
    if (health.healthy) {
      const parsedUrl = new URL(envUrl);
      return {
        url: envUrl,
        port: parseInt(parsedUrl.port, 10) || (parsedUrl.protocol === 'https:' ? 443 : 80),
        password: envPass,
        pid: health.info?.pid || null,
        autoManaged: false,
        version: health.info?.version
      };
    }
  }

  // 2. Check cached state from previous spawn
  const cached = readState();
  if (cached && cached.url && cached.password) {
    const health = await checkServerHealth(cached.url, cached.password);
    if (health.healthy) {
      return {
        url: cached.url,
        port: cached.port,
        password: cached.password,
        pid: cached.pid || health.info?.pid || null,
        autoManaged: true,
        version: health.info?.version
      };
    }
    // Stale server, clean up state file
    clearState();
  }

  // 3. Autonomous background spawn
  const bin = resolveOpenCodeBinary();
  const port = await findFreePort(4096);

  return new Promise((resolve, reject) => {
    let capturedUrl = null;
    let capturedPassword = null;
    let isSettled = false;
    let accumulatedOutput = '';

    const spawnArgs = ['serve', '--port', String(port), '--hostname', '127.0.0.1'];
    console.error(`[OpenCodeClient] Spawning background server: "${bin}" ${spawnArgs.join(' ')}`);

    const child = spawn(bin, spawnArgs, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try {
          if (child.pid) process.kill(child.pid);
        } catch {}
        reject(new Error(`Timeout (15s) waiting for OpenCode server startup. Output:\n${accumulatedOutput}`));
      }
    }, 15000);

    function checkCaptured() {
      if (capturedUrl && capturedPassword && !isSettled) {
        isSettled = true;
        clearTimeout(timeoutTimer);

        // Resume stdout/stderr so buffers don't fill, then unref process
        if (child.stdout) {
          if (child.stdout.unref) child.stdout.unref();
          child.stdout.resume();
        }
        if (child.stderr) {
          if (child.stderr.unref) child.stderr.unref();
          child.stderr.resume();
        }
        child.unref();

        const state = {
          url: capturedUrl,
          port,
          password: capturedPassword,
          pid: child.pid,
          autoManaged: true
        };
        writeState(state);

        // Verify server health via GET /api/info
        checkServerHealth(capturedUrl, capturedPassword).then(health => {
          resolve({
            ...state,
            version: health.info?.version
          });
        }).catch(() => {
          resolve(state);
        });
      }
    }

    function handleData(chunk) {
      const text = chunk.toString();
      accumulatedOutput += text;

      if (!capturedUrl) {
        const urlMatch = text.match(/server listening on (http:\/\/[^\s]+)/i);
        if (urlMatch) capturedUrl = urlMatch[1];
      }
      if (!capturedPassword) {
        const passMatch = text.match(/server password ([^\s]+)/i);
        if (passMatch) capturedPassword = passMatch[1];
      }
      checkCaptured();
    }

    if (child.stdout) child.stdout.on('data', handleData);
    if (child.stderr) child.stderr.on('data', handleData);

    child.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeoutTimer);
        reject(new Error(`Failed to launch OpenCode binary ("${bin}"): ${err.message}`));
      }
    });

    child.on('exit', (code, signal) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeoutTimer);
        reject(new Error(`OpenCode server exited unexpectedly (code: ${code}, signal: ${signal}). Output:\n${accumulatedOutput}`));
      }
    });
  });
}

/**
 * Stops the managed background OpenCode server if running.
 * 
 * @returns {Promise<{ success: boolean, killed: boolean, message: string }>}
 */
async function stopServer() {
  const state = readState();
  let killed = false;

  if (state && state.pid) {
    try {
      const pidNum = parseInt(state.pid, 10);
      if (Number.isInteger(pidNum) && pidNum > 0) {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', String(pidNum), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true
          });
        } else {
          process.kill(pidNum, 'SIGTERM');
        }
        killed = true;
      }
    } catch {
      // Process may already have terminated
    }
  }

  clearState();

  return {
    success: true,
    killed,
    message: killed
      ? `OpenCode background server (PID ${state?.pid}) successfully stopped.`
      : 'No active managed OpenCode server found or already stopped.'
  };
}

/**
 * Queries current server status.
 * 
 * @returns {Promise<{ running: boolean, url: string|null, port: number|null, pid: number|null, version: string|null, autoManaged: boolean }>}
 */
async function getServerStatus() {
  let url = null;
  let port = null;
  let password = null;
  let pid = null;
  let autoManaged = false;

  if (process.env.OPENCODE_SERVER_URL && process.env.OPENCODE_PASSWORD) {
    url = process.env.OPENCODE_SERVER_URL.replace(/\/+$/, '');
    password = process.env.OPENCODE_PASSWORD;
    const parsed = new URL(url);
    port = parseInt(parsed.port, 10) || (parsed.protocol === 'https:' ? 443 : 80);
    autoManaged = false;
  } else {
    const state = readState();
    if (state) {
      url = state.url;
      port = state.port;
      password = state.password;
      pid = state.pid;
      autoManaged = !!state.autoManaged;
    }
  }

  if (url && password) {
    const health = await checkServerHealth(url, password);
    if (health.healthy) {
      return {
        running: true,
        url,
        port,
        pid: pid || health.info?.pid || null,
        version: health.info?.version || null,
        autoManaged
      };
    }
  }

  return {
    running: false,
    url: null,
    port: null,
    pid: null,
    version: null,
    autoManaged: false
  };
}

/**
 * Lists available AI models and supported reasoning variants from OpenCode.
 * 
 * @param {object} [filter]
 * @param {string} [filter.query] Search string matching id, name, or family
 * @param {string} [filter.provider] Filter by providerID (e.g. "opencode", "openrouter")
 * @param {boolean} [filter.free_only] Filter only free models (cost === 0)
 * @returns {Promise<Array<{ id: string, providerID: string, name: string, variants: string[], isFree: boolean, contextLimit?: number, status?: string }>>}
 */
async function listModels({ query, provider, free_only } = {}) {
  const server = await ensureServer();
  const res = await makeHttpRequest({
    method: 'GET',
    url: server.url,
    path: '/api/model',
    headers: getAuthHeader(server.password)
  });

  if (res.statusCode !== 200) {
    throw new Error(`Failed to list models from OpenCode (HTTP ${res.statusCode}): ${JSON.stringify(res.data)}`);
  }

  let rawList = Array.isArray(res.data) ? res.data : (res.data?.data || []);

  if (provider) {
    const provLower = provider.toLowerCase();
    rawList = rawList.filter(m => (m.providerID || '').toLowerCase() === provLower);
  }

  if (query) {
    const q = query.toLowerCase();
    rawList = rawList.filter(m =>
      (m.id && m.id.toLowerCase().includes(q)) ||
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.family && m.family.toLowerCase().includes(q))
    );
  }

  const mapped = rawList.map(m => {
    const isFree = (Array.isArray(m.cost) && m.cost[0]?.input === 0 && m.cost[0]?.output === 0) ||
                   (m.cost === 0) ||
                   (m.id && m.id.includes('free')) ||
                   (m.name && m.name.toLowerCase().includes('free'));
    return {
      id: m.id,
      providerID: m.providerID,
      name: m.name,
      variants: (m.variants || []).map(v => (typeof v === 'string' ? v : v.id || v.name)),
      isFree,
      contextLimit: m.limit?.context,
      status: m.status
    };
  });

  if (free_only) {
    return mapped.filter(m => m.isFree);
  }

  return mapped;
}

/**
 * Normalizes a model identifier for a given provider.
 * 
 * Strips duplicate provider prefixes (e.g. "opencode/deepseek-v4.1-flash-free" -> "deepseek-v4.1-flash-free").
 * 
 * @param {string} modelID 
 * @param {string} providerID 
 * @returns {string} Normalized model ID
 */
function normalizeModelId(modelID, providerID) {
  if (!modelID) return 'deepseek-v4.1-flash-free';
  const prefix = `${providerID}/`;
  if (modelID.toLowerCase().startsWith(prefix.toLowerCase())) {
    return modelID.slice(prefix.length);
  }
  return modelID;
}

/**
 * Delegates a coding or reasoning task to an OpenCode subagent.
 * 
 * Automatically manages session creation, prompt dispatch, and real-time polling
 * until task completion. Aggregates response text, reasoning tokens, and tool calls.
 * 
 * @param {object} params
 * @param {string} params.prompt Detailed task instructions
 * @param {string} [params.providerID='opencode'] Provider ID
 * @param {string} [params.modelID='deepseek-v4.1-flash-free'] Model ID
 * @param {string} [params.effort='default'] Reasoning effort variant ('default', 'none', 'low', 'medium', 'high', 'xhigh', 'max', 'thinking')
 * @param {string|null} [params.sessionID=null] Existing session ID for multi-turn execution
 * @param {string} [params.title='antigravity-subagent-task'] Session title
 * @param {string|null} [params.directory=null] Target workspace directory
 * @param {number} [params.timeoutMs=180000] Maximum poll timeout in ms (default 3m)
 * @returns {Promise<{ sessionID: string, model: { providerID: string, modelID: string, effort: string }, responseText: string, reasoningText: string, tokens: object, cost: number, toolCalls?: any[] }>}
 */
async function runSubagentPrompt({
  prompt,
  providerID = 'opencode',
  modelID = 'deepseek-v4.1-flash-free',
  effort = 'default',
  sessionID = null,
  title = 'antigravity-subagent-task',
  directory = null,
  timeoutMs = 180000
}) {
  const server = await ensureServer();
  const normalizedModelId = normalizeModelId(modelID, providerID);

  let activeSessionId = sessionID;

  // 1. Create session if no existing session was provided
  if (!activeSessionId) {
    const sessionPayload = {
      title,
      model: {
        id: normalizedModelId,
        providerID: providerID,
        ...(effort && effort !== 'default' ? { variant: effort } : {})
      },
      ...(directory ? { location: { directory } } : {})
    };

    const sessionRes = await makeHttpRequest({
      method: 'POST',
      url: server.url,
      path: '/api/session',
      headers: getAuthHeader(server.password),
      body: sessionPayload
    });

    if (sessionRes.statusCode !== 200) {
      throw new Error(`Failed to create OpenCode session (HTTP ${sessionRes.statusCode}): ${JSON.stringify(sessionRes.data)}`);
    }

    activeSessionId = sessionRes.data?.data?.id || sessionRes.data?.id;
    if (!activeSessionId) {
      throw new Error(`Unexpected session creation response: ${JSON.stringify(sessionRes.data)}`);
    }
  }

  // 2. Track existing messages to isolate this turn's response
  const existingMessageIds = new Set();
  try {
    const historyRes = await makeHttpRequest({
      method: 'GET',
      url: server.url,
      path: `/api/session/${activeSessionId}/message`,
      headers: getAuthHeader(server.password)
    });
    if (historyRes.statusCode === 200) {
      const msgs = historyRes.data?.data || historyRes.data || [];
      for (const m of msgs) {
        if (m.id) existingMessageIds.add(m.id);
      }
    }
  } catch {
    // Non-fatal if session is freshly created
  }

  // 3. Dispatch user prompt
  const promptRes = await makeHttpRequest({
    method: 'POST',
    url: server.url,
    path: `/api/session/${activeSessionId}/prompt`,
    headers: getAuthHeader(server.password),
    body: { text: prompt }
  });

  if (promptRes.statusCode !== 200) {
    throw new Error(`Failed to dispatch prompt to session ${activeSessionId} (HTTP ${promptRes.statusCode}): ${JSON.stringify(promptRes.data)}`);
  }

  const userMessageId = promptRes.data?.data?.id || promptRes.data?.id;
  if (userMessageId) {
    existingMessageIds.add(userMessageId);
  }

  // 4. Poll messages until completion
  const pollIntervalMs = 1500;
  const startTime = Date.now();
  let completed = false;
  let outcome = 'unknown';
  let finalMessages = [];

  while (!completed && (Date.now() - startTime) < timeoutMs) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const pollRes = await makeHttpRequest({
      method: 'GET',
      url: server.url,
      path: `/api/session/${activeSessionId}/message`,
      headers: getAuthHeader(server.password)
    });

    if (pollRes.statusCode !== 200) {
      continue;
    }

    const messages = pollRes.data?.data || pollRes.data || [];
    finalMessages = messages;

    if (messages.length > 0) {
      const topMsg = messages[0];

      // Condition A: Top message is 'idle' state (newest message)
      if (topMsg?.type === 'idle') {
        outcome = topMsg.outcome || 'succeeded';
        completed = true;
        break;
      }

      // Condition B: Assistant message finished with stop code and completed timestamp
      const completedAssistant = messages.find(m =>
        !existingMessageIds.has(m.id) &&
        m.type === 'assistant' &&
        (m.finish === 'stop' || m.rawFinish === 'stop') &&
        m.time?.completed
      );

      if (completedAssistant) {
        outcome = 'succeeded';
        completed = true;
        break;
      }
    }
  }

  if (!completed) {
    throw new Error(`OpenCode subagent execution timed out after ${timeoutMs}ms (Session ID: ${activeSessionId})`);
  }

  // 5. Aggregate assistant responses and reasoning
  const newAssistantMessages = finalMessages
    .filter(m => !existingMessageIds.has(m.id) && m.type === 'assistant')
    .sort((a, b) => (a.time?.created || 0) - (b.time?.created || 0));

  const responseTextParts = [];
  const reasoningTextParts = [];
  const toolCalls = [];
  const aggregateTokens = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } };
  let aggregateCost = 0;
  let finalModel = { providerID, modelID: normalizedModelId, effort };

  for (const msg of newAssistantMessages) {
    if (msg.model) {
      finalModel = {
        providerID: msg.model.providerID || providerID,
        modelID: msg.model.id || normalizedModelId,
        effort: msg.model.variant || effort
      };
    }

    if (typeof msg.cost === 'number') {
      aggregateCost += msg.cost;
    }

    if (msg.tokens) {
      if (typeof msg.tokens.input === 'number') aggregateTokens.input += msg.tokens.input;
      if (typeof msg.tokens.output === 'number') aggregateTokens.output += msg.tokens.output;
      if (typeof msg.tokens.reasoning === 'number') aggregateTokens.reasoning += msg.tokens.reasoning;
      if (msg.tokens.cache) {
        if (typeof msg.tokens.cache.read === 'number') aggregateTokens.cache.read += msg.tokens.cache.read;
        if (typeof msg.tokens.cache.write === 'number') aggregateTokens.cache.write += msg.tokens.cache.write;
      }
    }

    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (!part) continue;
        if (part.type === 'text' && typeof part.text === 'string') {
          responseTextParts.push(part.text);
        } else if ((part.type === 'reasoning' || part.type === 'thought' || part.type === 'thinking') && typeof part.text === 'string') {
          reasoningTextParts.push(part.text);
        } else if (part.type === 'tool' || part.type === 'tool_use' || part.type === 'tool_call') {
          toolCalls.push(part);
        }
      }
    }

    if (msg.text && typeof msg.text === 'string' && responseTextParts.length === 0) {
      responseTextParts.push(msg.text);
    }
  }

  // Handle failure message fallback
  if (responseTextParts.length === 0 && outcome === 'failed') {
    const topMsg = finalMessages[0];
    const failureDetail = topMsg?.payload?.error || topMsg?.error || 'Subagent execution failed without textual output.';
    responseTextParts.push(`Subagent Error: ${typeof failureDetail === 'object' ? JSON.stringify(failureDetail) : failureDetail}`);
  }

  return {
    sessionID: activeSessionId,
    model: finalModel,
    responseText: responseTextParts.join('\n\n').trim(),
    reasoningText: reasoningTextParts.join('\n\n').trim(),
    tokens: aggregateTokens,
    cost: aggregateCost,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined
  };
}

module.exports = {
  resolveOpenCodeBinary,
  makeHttpRequest,
  checkServerHealth,
  findFreePort,
  ensureServer,
  stopServer,
  getServerStatus,
  listModels,
  runSubagentPrompt
};
