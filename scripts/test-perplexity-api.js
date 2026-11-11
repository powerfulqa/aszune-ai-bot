#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Smoke test for the Perplexity Agent API connection, using the bot's own
 * client and configuration. This makes ONE real, billable request.
 * Run with: node scripts/test-perplexity-api.js
 */

async function testPerplexityAPI() {
  let config;
  try {
    config = require('../src/config/config');
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
  const { ApiClient } = require('../src/services/api-client');
  const client = new ApiClient(config.PERPLEXITY_API_KEY, config.API.PERPLEXITY.BASE_URL);

  const payload = client.buildRequestPayload([{ role: 'user', content: 'Hi, say hello!' }], {
    maxTokens: 200,
  });
  console.log(`📤 POST ${client.getChatEndpoint()} with effort "${payload.effort}"...`);

  try {
    const body = await client.makeRequest(client.getChatEndpoint(), payload);
    console.log('✅ SUCCESS! API is working.');
    console.log('Model:', body.model);
    console.log('Answer:', body.choices[0].message.content);
    console.log('Usage:', body.usage);
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    process.exit(1);
  }
}

testPerplexityAPI();
