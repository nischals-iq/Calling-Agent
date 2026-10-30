import 'dotenv/config';

async function runLiveTest() {
  console.log('===============================================================');
  console.log(' SARVAM CONVERSATIONAL LLM LIVE INTEGRATION TEST ');
  console.log('===============================================================\n');

  // Check environment variable without logging value
  if (!process.env.SARVAM_API_KEY || !process.env.SARVAM_API_KEY.trim()) {
    console.error('[FAILED] Environment variable SARVAM_API_KEY is missing or empty in backend/.env.');
    process.exit(1);
  }

  console.log('[OK] SARVAM_API_KEY detected in environment.');

  // Import compiled SarvamLlmService from dist
  const { SarvamLlmService } = await import('./dist/modules/ai-calling/sarvam-llm.service.js');
  const service = new SarvamLlmService();

  const testPrompt = 'Hello, introduce yourself in Hindi.';
  console.log(`[TEST PROMPT]: "${testPrompt}"`);
  console.log('[REQUEST]: Sending chat completion request to Sarvam official API...');

  try {
    const result = await service.testConnection(testPrompt);

    console.log('\n--- LIVE TEST RESULTS ---');
    console.log(`Status:           ${result.success ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`HTTP Status Code: ${result.rawStatus}`);
    console.log(`Model Used:       ${result.model}`);
    console.log(`Response Time:    ${result.durationMs} ms`);
    if (result.usage) {
      console.log(`Token Usage:      Prompt: ${result.usage.promptTokens ?? 'N/A'}, Completion: ${result.usage.completionTokens ?? 'N/A'}, Total: ${result.usage.totalTokens ?? 'N/A'}`);
    }
    console.log('\n--- REAL LLM RESPONSE ---');
    console.log(result.content);
    console.log('-------------------------\n');

    if (!result.content || result.content.trim().length === 0) {
      console.error('[ERROR] Empty content received from LLM.');
      process.exit(1);
    }

    console.log('[PASS] Live Sarvam conversational LLM integration verified successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\n--- TEST FAILED ---');
    console.error(`Status:           FAILURE`);
    console.error(`Error Message:    ${error.message}`);
    process.exit(1);
  }
}

runLiveTest();
