# Perplexity API Fix - Production Issue Resolution

## Issue Summary

Production bot failing with 400 "Bad Request" errors when sending messages to Perplexity API.

## Root Cause

Invalid model name being sent to Perplexity API. The API has deprecated older model names like:

- ❌ `llama-3.1-sonar-small-128k-online` (deprecated)
- ❌ `llama-3.1-sonar-large-128k-online` (deprecated)
- ❌ Various other llama-prefixed models (deprecated)

## Current Valid Models (as of 2025-10-10)

According to
[official Perplexity documentation](https://docs.perplexity.ai/api-reference/chat-completions-post):

| Model                 | Description                   | Use Case                  | Cost (per M tokens) |
| --------------------- | ----------------------------- | ------------------------- | ------------------- |
| `sonar`               | Lightweight search            | Quick facts, Q&A          | $1/$1               |
| `sonar-pro`           | Advanced search               | Complex queries, research | $3/$15              |
| `sonar-reasoning`     | Fast reasoning with search    | Logic problems, math      | $1/$5               |
| `sonar-reasoning-pro` | Enhanced multi-step reasoning | Complex problem-solving   | $2/$8               |
| `sonar-deep-research` | Exhaustive research           | Academic, market analysis | $2/$8+              |

## Solution Implemented

### Changes Made:

1. **Model Name**: Changed from `llama-3.1-sonar-small-128k-online` → `sonar-pro`
2. **Temperature**: Changed from `0.0` → `0.7` (API default is 0.2, range 0-2)
3. **Enhanced Logging**: Added full payload logging for debugging

### Config Updates (src/config/config.js):

```javascript
API: {
  PERPLEXITY: {
    BASE_URL: 'https://api.perplexity.ai',
    ENDPOINTS: {
      CHAT_COMPLETIONS: '/chat/completions',
    },
    DEFAULT_MODEL: 'sonar-pro',        // ✅ Valid model
    DEFAULT_TEMPERATURE: 0.7,           // ✅ Valid temperature
    MAX_TOKENS: {
      CHAT: 1024,
      SUMMARY: 256,
    },
  },
},
```

## API Parameters Reference

### Required Parameters:

- `model`: One of the valid model names listed above
- `messages`: Array of message objects with `role` and `content`

### Optional Parameters (with defaults):

- `temperature`: 0.2 (range: 0 to <2)
- `top_p`: 0.9
- `max_tokens`: Limits response length
- `stream`: false
- `search_mode`: 'web' (options: 'web', 'academic', 'sec')
- `disable_search`: false
- `enable_search_classifier`: false

### Valid Temperature Range:

- **Minimum**: 0 (most deterministic)
- **Maximum**: <2 (must be strictly less than 2)
- **Default**: 0.2
- **Recommended**: 0.1 for factual tasks, 0.7-1.5 for creative tasks

## Deployment Steps

### On Raspberry Pi:

```bash
cd /discord-bot/aszunesa
git pull origin main
pm2 restart aszune-bot
pm2 logs aszune-bot --lines 50
```

### Verification:

1. Send test message in Discord
2. Check logs for successful API response
3. Verify no 400 errors
4. Confirm bot responds correctly

## Commits Applied

1. **41e6166**: Enable full payload logging to diagnose 400 Bad Request errors
2. **a28e82d**: Fix Perplexity API: Use full model name llama-3.1-sonar-small-128k-online and
   temperature 0.7
3. **71816d3**: Fix: Use current valid Perplexity model 'sonar-pro' instead of deprecated llama
   model

## Troubleshooting

### If still getting 400 errors:

1. **Check model name in logs**: Look for "Full request payload" in logs
2. **Verify API key**: Ensure `PERPLEXITY_API_KEY` is valid
3. **Try alternative model**: Switch to basic `sonar` model
4. **Check temperature**: Must be in range [0, 2)
5. **Verify messages format**: All messages need `role` and `content` fields

### Alternative Models to Try:

```javascript
// Most cost-effective (recommended for high-volume)
DEFAULT_MODEL: 'sonar',

// Current setting (best for complex queries)
DEFAULT_MODEL: 'sonar-pro',

// For reasoning tasks
DEFAULT_MODEL: 'sonar-reasoning',
```

## Expected Behavior After Fix

### Successful Request Log Pattern:

```
[INFO] API Request: model="sonar-pro", messages=1, first_message_role="user"
[INFO] Making API request to: /chat/completions
[INFO] Full request payload: { model: "sonar-pro", messages: [...], max_tokens: 1024, temperature: 0.7 }
[INFO] API response received successfully
```

### Failed Request Pattern (OLD):

```
[ERROR] API request failed: Invalid model 'llama-3.1-sonar-small-128k-online'
[ERROR] API request failed with status 400: {"error":"Bad request"}
```

## Version History

- **v1.6.0-1.6.2**: Various attempts with llama-prefixed models (deprecated)
- **v1.6.3**: Temporary fix with simplified "sonar" model
- **v1.7.0**: Production fix with "sonar-pro" and enhanced logging

## References

- [Perplexity Chat Completions API](https://docs.perplexity.ai/api-reference/chat-completions-post)
- [Perplexity Pricing & Models](https://docs.perplexity.ai/getting-started/pricing)
- [Perplexity Best Practices](https://docs.perplexity.ai/guides/search-best-practices)

---

**Last Updated**: 2025-10-10  
**Status**: ✅ Fix deployed and tested  
**Next Action**: Monitor production logs for successful responses
