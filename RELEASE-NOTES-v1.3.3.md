# Release Notes: Source Link Enhancement and Truncation Fix (v1.3.3)

## Overview

This release addresses two key issues with message formatting in the bot:

1. Properly formatting source links (especially YouTube URLs) so they appear as clickable links in
   Discord
2. Fixing truncation issues where the last sentence of a message would sometimes get cut off

## Bug Fixes

- **Source Link Formatting:** Source references like (1), (2) now properly link to their
  corresponding URLs using Discord markdown format
- **YouTube Link Handling:** YouTube links are now properly formatted as clickable links instead of
  appearing as raw text
- **Message Truncation Prevention:** Reduced the maximum message length to ensure all content is
  delivered without truncation
- **URL Boundary Protection:** Added protection to prevent URLs from being split across chunk
  boundaries

## Technical Implementation

- **Enhanced Message Chunker:** Created a specialized message chunker that properly handles source
  references
- **Source Link Processing:** Added pre-processing step that formats numbered sources as markdown
  links
- **Boundary Detection:** Improved algorithm to detect and protect URLs at chunk boundaries
- **Lower Size Limit:** Reduced the maximum message size from 1800 to 1700 characters to provide
  additional buffer for formatting

## Developer Notes

The enhanced source link formatting provides a much better user experience, allowing users to click
on source links directly rather than having to copy and paste URLs. This is especially important for
YouTube videos and other media references that appear in responses.

The algorithm now includes three improvements:

1. Pre-processes text to identify numbered sources and their corresponding URLs
2. Formats these sources as proper markdown links: `[(1)](https://example.com)`
3. Ensures URLs are not split across chunk boundaries

This change is fully backward compatible with existing functionality.
