#!/usr/bin/env node

/**
 * Model Context Protocol (MCP) Server for OpenCode Bridge
 * 
 * Provides an MCP stdio server over JSON-RPC 2.0 connecting Google Antigravity
 * to OpenCode subagents and models.
 * 
 * Zero external npm runtime dependencies.
 */

const readline = require('readline');
const { TOOL_DEFINITIONS, executeTool } = require('./tools');

const SERVER_NAME = 'agy-opencode-bridge-mcp';
const SERVER_VERSION = '1.0.0';
const PROTOCOL_VERSION = '2024-11-05';

/**
 * Sends a JSON-RPC 2.0 response strictly to stdout.
 * 
 * @param {object} message 
 */
function sendJsonRpc(message) {
  const json = JSON.stringify(message);
  process.stdout.write(json + '\n');
}

/**
 * Logs informational messages strictly to stderr so stdout remains pure JSON-RPC.
 * 
 * @param {string} msg 
 */
function logDebug(msg) {
  process.stderr.write(`[${SERVER_NAME}] ${msg}\n`);
}

/**
 * Handles incoming JSON-RPC 2.0 requests and notifications.
 * 
 * @param {object} req 
 */
async function handleRequest(req) {
  if (!req || typeof req !== 'object') {
    return;
  }

  const { id, method, params } = req;
  const isNotification = (id === undefined || id === null);

  logDebug(`Incoming RPC method: "${method}" (ID: ${id !== undefined ? id : 'notification'})`);

  try {
    switch (method) {
      case 'initialize': {
        const clientProtocol = params?.protocolVersion || PROTOCOL_VERSION;
        sendJsonRpc({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: clientProtocol,
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: SERVER_NAME,
              version: SERVER_VERSION
            }
          }
        });
        break;
      }

      case 'notifications/initialized': {
        // Notification received after client initialization handshake
        logDebug('Client initialized successfully');
        break;
      }

      case 'ping': {
        if (!isNotification) {
          sendJsonRpc({
            jsonrpc: '2.0',
            id,
            result: {}
          });
        }
        break;
      }

      case 'tools/list': {
        sendJsonRpc({
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOL_DEFINITIONS
          }
        });
        break;
      }

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (!toolName) {
          sendJsonRpc({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: "Missing parameter 'name' in tools/call"
            }
          });
          return;
        }

        logDebug(`Executing tool "${toolName}" with args: ${JSON.stringify(toolArgs)}`);

        try {
          const textOutput = await executeTool(toolName, toolArgs);
          sendJsonRpc({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: textOutput
                }
              ],
              isError: false
            }
          });
        } catch (toolError) {
          logDebug(`Tool "${toolName}" encountered error: ${toolError.message}`);
          sendJsonRpc({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Tool Execution Error [${toolName}]: ${toolError.message}`
                }
              ],
              isError: true
            }
          });
        }
        break;
      }

      default: {
        if (!isNotification) {
          sendJsonRpc({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          });
        }
        break;
      }
    }
  } catch (err) {
    logDebug(`Internal error handling method "${method}": ${err.message}`);
    if (!isNotification) {
      sendJsonRpc({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Internal error: ${err.message}`
        }
      });
    }
  }
}

/**
 * Initializes the stdio JSON-RPC loop.
 */
function main() {
  logDebug(`Starting ${SERVER_NAME} v${SERVER_VERSION}...`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed);
      handleRequest(parsed);
    } catch {
      logDebug(`Failed to parse incoming line as JSON: ${trimmed.slice(0, 100)}`);
      sendJsonRpc({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error: incoming message is not valid JSON'
        }
      });
    }
  });

  rl.on('close', () => {
    logDebug('Standard input closed. Exiting process.');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logDebug('Received SIGINT. Exiting.');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logDebug('Received SIGTERM. Exiting.');
    process.exit(0);
  });
}

if (require.main === module) {
  main();
}
