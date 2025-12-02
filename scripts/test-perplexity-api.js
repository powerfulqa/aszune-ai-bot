#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Test script to verify Perplexity API connection
 * Run with: node test-perplexity-api.js
 */

require('dotenv').config();
const { request } = require('undici');

async function testPerplexityAPI() {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.error('❌ PERPLEXITY_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('✅ API Key found (length:', apiKey.length, ')');
  console.log('🔑 API Key starts with:', apiKey.substring(0, 10) + '...');

  const payload = {
    model: 'sonar',
    messages: [
      {
        role: 'user',
        content: 'Hi, say hello!',
      },
    ],
    max_tokens: 100,
    temperature: 0.2,
  };

  console.log('\n📤 Sending request to Perplexity API...');
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await request('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('\n📊 Response Status:', response.statusCode);
    console.log('Response Headers:', response.headers);

    const body = await response.body.json();

    if (response.statusCode === 200) {
      console.log('\n✅ SUCCESS! API is working!');
      console.log('Response:', JSON.stringify(body, null, 2));
    } else {
      console.log('\n❌ API Error:', response.statusCode);
      console.log('Error Response:', JSON.stringify(body, null, 2));
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    console.error('Error details:', error);
  }
}

testPerplexityAPI();
