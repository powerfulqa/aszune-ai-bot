# Aszai Bot v1.3.5 Release Notes

## Bug Fixes

### Advanced Source Link Formatting
- Fixed issues with YouTube links showing duplicate text like `([3][www.youtube.com]www.youtube.com)`
- Enhanced URL handling to properly format links in square bracket notation `([n][url])`
- Added pre-processing step to detect and clean up duplicate URL occurrences

### URL Integrity Improvements
- Fixed issue where domain names could be split with periods (e.g., `fractalsoftworks.com` becoming `fractalsoftworks.` and `com`)
- Added special handling for domain TLDs (com, org, net, etc.) to ensure they stay connected
- Improved detection of URLs broken across message chunks

### Prevented Message Truncation
- Further reduced maximum message length from 1600 to 1400 characters to ensure complete messages
- Enhanced sentence boundary detection to better handle special cases
- Added additional domain-specific handling for long URLs

## Technical Improvements
- Added special cleanup for broken URLs caused by line breaks
- Enhanced regex patterns for more comprehensive source reference detection
- Improved algorithm to preserve complete sentences across chunks
