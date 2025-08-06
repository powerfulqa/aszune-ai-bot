# Aszai Bot v1.3.4 Release Notes

## Bug Fixes

### Fixed Source Link Formatting
- Enhanced message chunker now properly handles various source reference formats:
  - Standard format with parentheses `(1) (http://example.com)`
  - No space between number and URL `(1)(http://example.com)`
  - Space but no parentheses around URL `(1) http://example.com`
  - Format with square brackets `([1][http://example.com])`
  - YouTube links in the format `([n][www.youtube.com])`
- Improved regex patterns to correctly identify and format source links as Markdown links

### Fixed Sentence Truncation
- Further reduced maximum message length to prevent truncation (from 1700 to 1600 characters)
- Added enhanced logic to ensure no chunk ends mid-sentence
- Added additional checks to keep entire sentences together in the same chunk
- Implemented detection and handling of sentences that might be split across message boundaries

### Markdown Link Preservation
- Added specific handling to ensure Markdown links `[text](url)` are not split between chunks
- Improved detection of partial URLs at chunk boundaries

## Technical Improvements
- Refactored source reference processing into more focused functions:
  - `collectSourceReferences`: Identifies and extracts all source references
  - `formatSourceReferences`: Formats each source reference as a proper Markdown link
- Added more robust regex patterns to handle a wider variety of link formats
- Added a safety margin to chunk lengths to ensure proper formatting fits

## Other Changes
- Updated version to 1.3.4
- Enhanced documentation in code comments
