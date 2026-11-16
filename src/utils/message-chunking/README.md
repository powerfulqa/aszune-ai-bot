# Message Chunking Module

This module provides enhanced message chunking functionality with intelligent boundary handling.

## Structure

- **`index.js`** - Main module that coordinates all chunking functionality
- **`source-reference-processor.js`** - Handles collection and formatting of source references
- **`chunk-boundary-handler.js`** - Handles intelligent chunking to avoid breaking content

## Features

### Source Reference Processing

- Collects source references from text using multiple pattern matching
- Formats source references with proper markdown links
- Handles broken or incomplete source references

### Intelligent Chunking

- Preprocesses messages to fix formatting issues
- Avoids breaking content at inappropriate boundaries:
  - Mid-sentence
  - Incomplete URLs
  - Incomplete markdown links
  - Incomplete numbered lists
- Validates chunk boundaries

## Usage

```javascript
const { chunkMessage, processSourceReferences } = require('./message-chunking');

// Enhanced chunking with all features
const chunks = chunkMessage(longMessage, maxLength);

// Process source references only
const processedText = processSourceReferences(text);
```

## Error Handling

All functions include comprehensive error handling with:

- Structured error logging
- Graceful fallbacks
- Context-aware error messages
- Performance monitoring

## Configuration

Uses constants from `config.MESSAGE_LIMITS`:

- `DISCORD_MAX_LENGTH` - Maximum Discord message length
- `SAFE_CHUNK_OVERHEAD` - Safety buffer for chunking
- `EMBED_MAX_LENGTH` - Maximum embed description length
