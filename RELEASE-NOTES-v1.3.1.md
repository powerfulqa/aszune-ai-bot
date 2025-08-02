# Release Notes: Message Chunking Feature (v1.3.1)

## Overview

Added automatic message chunking to prevent long responses from being truncated by Discord's character limit. The bot now intelligently splits long messages into multiple sequential messages while preserving formatting and context.

## New Features

### Message Chunking

- **Automatic Detection**: Bot now detects when a response exceeds Discord's character limits
- **Smart Chunking**: Splits messages at logical break points (paragraphs, sentences) to maintain context
- **Clear Numbering**: Adds "[1/3]", "[2/3]", etc. prefixes to indicate message sequence
- **Optimized Delivery**: Sends multi-part responses with appropriate timing between messages
- **Seamless Experience**: End users receive complete responses without truncation

### Technical Implementation

- Added new utility `message-chunker.js` with the `chunkMessage()` function
- Refactored message handling in `chat.js` to use chunking when needed
- Added comprehensive unit tests to verify chunking functionality
- Default max length set to 2000 characters (Discord's approximate limit)

## Bug Fixes

- Fixed issue where long responses would be cut off mid-sentence
- Addressed problem where complex formatting would break at message boundaries

## Developer Notes

The chunking algorithm prioritizes preserving paragraph structure and sentence integrity. For extremely long single paragraphs, it will fall back to breaking at sentence boundaries. If individual sentences exceed the limit, it will split at word boundaries as a last resort.

All changes are backward compatible with existing functionality.
