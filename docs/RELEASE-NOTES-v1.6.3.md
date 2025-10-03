# Release Notes v1.6.3 - Perplexity API Model Compatibility Fix

**Release Date:** October 3, 2025  
**Type:** Critical Bug Fix Release  
**Breaking Changes:** None  
**Migration Required:** None  

## 🚀 Overview

Version 1.6.3 addresses a critical Perplexity API model compatibility issue where the summarise command was failing with "Invalid model" errors. Perplexity has updated their model naming scheme from long descriptive names to simplified categorical names.

## 🐛 Critical Fixes

### Perplexity API Model Update

**Issue**: Summarise command (`!summerise`, `!summarise`) was failing with API 400 errors:
- Error: "Invalid model 'llama-3.1-sonar-small-128k-chat'"
- Message: "Permitted models can be found in the documentation"

**Root Cause**: Perplexity changed their model naming scheme from descriptive format to simplified categorical names.

**Solution**: Updated to use Perplexity's current model naming convention.

#### Model Configuration Changes
- **Old Model Name**: `llama-3.1-sonar-small-128k-chat` ❌ (Deprecated)
- **New Model Name**: `sonar` ✅ (Current active model)

#### API Compatibility
- **Model Type**: Basic search model optimized for quick searches and summarization
- **Context Length**: 128K tokens
- **Features**: Real-time web search, citation support, optimized for speed and cost
- **Use Case**: Perfect for text summarization and quick factual queries

## 📊 Technical Implementation

### Configuration Updates

```javascript
// Previous configuration (v1.6.2)
API: {
  PERPLEXITY: {
    DEFAULT_MODEL: 'llama-3.1-sonar-small-128k-chat', // ❌ Invalid
  }
}

// Updated configuration (v1.6.3)
API: {
  PERPLEXITY: {
    DEFAULT_MODEL: 'sonar', // ✅ Current model
  }
}
```

### Model Capabilities
According to Perplexity documentation, the `sonar` model provides:
- **Non-reasoning model**: Optimized for straightforward tasks
- **Quick searches**: Ideal for rapid information retrieval
- **128K context**: Sufficient for large text summarization
- **Cost-effective**: Balanced performance and pricing
- **Real-time search**: Web-based answers with citations

## 🎯 Verified Functionality

### Summarise Command Testing
- ✅ **Text Summarization**: Successfully processes and summarizes complex text
- ✅ **Multi-topic Support**: Handles diverse topics (novels, TV shows, organizations)
- ✅ **Response Quality**: Maintains detailed, structured summaries
- ✅ **Error Handling**: Proper error responses when content unavailable
- ✅ **Performance**: Quick response times with new model

### Example Working Commands
```
!summerise foundation
!summarise [any text content]
@Aszai summerise [topic]
```

## 🔧 Deployment Notes

### For Production Environments
1. **Update Required**: Pull latest changes to get v1.6.3
2. **Restart Needed**: Restart bot process to load new configuration
3. **No Migration**: No data migration or additional setup required

### For Raspberry Pi Deployments
```bash
cd ~/aszune-ai-bot
git pull origin main
pm2 restart aszune-ai
pm2 list  # Verify version shows 1.6.3
```

### Version Verification
Check that your deployment shows:
- **Package.json**: `"version": "1.6.3"`
- **PM2 Status**: Version display updated
- **Git Tag**: `v1.6.3` available

## 📚 API Evolution Context

### Model Name History
This is the second Perplexity model name change requiring updates:

1. **v1.6.0-1.6.1**: Various model attempts during initial API integration
2. **v1.6.2**: `llama-3.1-sonar-small-128k-chat` (working temporarily)
3. **v1.6.3**: `sonar` (current simplified naming scheme)

### Future-Proofing
- **Monitoring**: Actively monitor Perplexity model availability
- **Fallback Strategy**: Error handling gracefully reports API issues
- **Documentation**: Keep model references updated with API changes

## 🚨 Known Issues Resolved

### Fixed in v1.6.3
- ❌ "Invalid model" API 400 errors → ✅ Working API calls
- ❌ "Service temporarily unavailable" messages → ✅ Proper responses
- ❌ Summarise command failures → ✅ Full functionality restored

### Error Prevention
- **Proactive Monitoring**: Track Perplexity API model changes
- **Quick Response**: Faster deployment of model compatibility fixes
- **User Communication**: Clear error messages when API issues occur

## 📈 Performance Impact

### Improvements in v1.6.3
- **Response Time**: Faster API responses with optimized `sonar` model
- **Cost Efficiency**: More cost-effective model for summarization tasks
- **Reliability**: Stable API connection with current model naming
- **User Experience**: Consistent command functionality restored

## 🔄 Upgrade Path

### From v1.6.2
1. Pull repository changes: `git pull origin main`
2. Restart application: `pm2 restart aszune-ai` or equivalent
3. Test summarise functionality: `!summerise test`

### From Earlier Versions
Follow standard upgrade process - no special migration needed for model change.

## 📋 Testing Checklist

Before deploying v1.6.3, verify:
- [ ] Summarise commands respond without API errors
- [ ] Model configuration updated to `'sonar'`
- [ ] Version shows 1.6.3 in package.json
- [ ] PM2/process manager reflects new version
- [ ] No breaking changes to other bot functionality

## 🎯 Success Metrics

A successful v1.6.3 deployment should show:
- ✅ Zero "Invalid model" errors in logs
- ✅ Functional `!summerise` and `!summarise` commands
- ✅ Proper text summarization responses
- ✅ Maintained response quality and speed
- ✅ No impact on other bot features

---

**Summary**: v1.6.3 fixes critical Perplexity API compatibility by updating to their current `sonar` model naming scheme, restoring full summarise command functionality with improved performance and reliability.