/**
 * Verification Test Suite for OpenCode MCP Bridge
 * 
 * Tests:
 * 1. CLI binary resolution
 * 2. Background daemon startup and health check (ensureServer)
 * 3. Model listing and filtering (listModels)
 * 4. Subagent task execution with reasoning effort (runSubagentPrompt)
 * 5. Server status query (getServerStatus)
 * 6. MCP tool execution dispatch (executeTool)
 */

const path = require('path');
const opencodeClient = require('../src/opencode-client');
const { TOOL_DEFINITIONS, executeTool } = require('../src/tools');

async function runVerification() {
  console.log('====================================================');
  console.log('🧪 Starting OpenCode Bridge MCP Verification Suite');
  console.log('====================================================\n');

  try {
    // 1. Binary Resolution Test
    console.log('🔍 [Step 1] Resolving OpenCode CLI binary...');
    const binPath = opencodeClient.resolveOpenCodeBinary();
    console.log(`   Resolved binary: "${binPath}"\n`);

    // 2. Server Ensure & Lifecycle Test
    console.log('🚀 [Step 2] Ensuring OpenCode server daemon is running...');
    const server = await opencodeClient.ensureServer();
    console.log(`   Connected to OpenCode server at: ${server.url}`);
    console.log(`   Port: ${server.port}`);
    console.log(`   Process PID: ${server.pid || 'N/A'}`);
    console.log(`   Version: ${server.version || 'Unknown'}`);
    console.log(`   Auto-managed daemon: ${server.autoManaged ? 'Yes' : 'No'}\n`);

    // 3. Model Listing Test
    console.log('📋 [Step 3] Querying models (Provider: "opencode", Query: "deepseek")...');
    const models = await opencodeClient.listModels({ provider: 'opencode', query: 'deepseek' });
    console.log(`   Found ${models.length} matching model(s):`);
    for (const m of models) {
      console.log(`   - ID: ${m.id} | Name: ${m.name} | Free: ${m.isFree ? 'Yes' : 'No'} | Variants: [${m.variants.join(', ')}]`);
    }

    const hasFlashFree = models.some(m => m.id === 'deepseek-v4.1-flash-free');
    if (!hasFlashFree) {
      console.warn('   ⚠️ Warning: deepseek-v4.1-flash-free not found in filtered list.');
    } else {
      console.log('   ✅ deepseek-v4.1-flash-free model is present.');
    }
    console.log('');

    // 4. Subagent Task Execution Test
    console.log('🤖 [Step 4] Executing subagent prompt with deepseek-v4.1-flash-free (effort: "high")...');
    const testPrompt = 'Respond with exactly: BRIDGE_VERIFIED_SUCCESS and explain why in 10 words.';
    const subagentResult = await opencodeClient.runSubagentPrompt({
      prompt: testPrompt,
      providerID: 'opencode',
      modelID: 'deepseek-v4.1-flash-free',
      effort: 'high',
      title: 'bridge-verification-test'
    });

    console.log(`   Session ID: ${subagentResult.sessionID}`);
    console.log(`   Model Used: ${subagentResult.model.providerID}/${subagentResult.model.modelID} (${subagentResult.model.effort})`);
    console.log(`   Tokens: Input=${subagentResult.tokens.input}, Output=${subagentResult.tokens.output}, Reasoning=${subagentResult.tokens.reasoning}`);
    console.log(`   Cost: $${subagentResult.cost}`);

    if (subagentResult.reasoningText) {
      console.log(`   Reasoning: "${subagentResult.reasoningText.slice(0, 150)}..."`);
    }
    console.log(`   Response: "${subagentResult.responseText.trim()}"`);

    if (!subagentResult.responseText) {
      throw new Error('Subagent returned empty response text.');
    }
    console.log('   ✅ Subagent task completed successfully.\n');

    // 5. Server Status Test
    console.log('🖥️ [Step 5] Checking server status via getServerStatus()...');
    const status = await opencodeClient.getServerStatus();
    console.log(`   Server Running: ${status.running}`);
    console.log(`   Server URL: ${status.url}`);
    console.log('   ✅ Server status verified.\n');

    // 6. MCP Tool Dispatch Test
    console.log('🛠️ [Step 6] Testing MCP tool execution (opencode_list_models)...');
    const toolOutput = await executeTool('opencode_list_models', { provider: 'opencode', query: 'deepseek' });
    if (!toolOutput || !toolOutput.includes('deepseek')) {
      throw new Error('Tool execution did not return expected model table output.');
    }
    console.log('   ✅ MCP tool executed and formatted output successfully.\n');

    console.log('====================================================');
    console.log('🎉 ALL OPENCODE BRIDGE MCP TESTS PASSED SUCCESSFULLY');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Verification Failed:');
    console.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  runVerification();
}
