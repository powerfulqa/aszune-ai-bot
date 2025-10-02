/**
 * Tests for message chunker table formatting functionality
 */

const { formatTablesForDiscord } = require('../../src/utils/message-chunker');

describe('Message Chunker - Table Formatting', () => {
  describe('formatTablesForDiscord', () => {
    it('should return unchanged content when no tables are present', () => {
      const content = 'This is regular text content without any tables.';
      const result = formatTablesForDiscord(content);
      expect(result).toBe(content);
    });

    it('should format basic table into bullet points', () => {
      const content = `| Weapon Slot | Description | Notes |
|-------------|-------------|-------|
| Torgue Heavy Slot | Rocket and grenade launchers | Explosive ordinance-style weapons |
| No "Ordnance" Slot | No separate weapon slot named "Ordnance" | Explosive weapons are under heavy or other standard slots |`;

      const result = formatTablesForDiscord(content);
      
      expect(result).toContain('**Weapon Slot | Description | Notes:**');
      expect(result).toContain('• **Weapon Slot**: Torgue Heavy Slot');
      expect(result).toContain('*Description*: Rocket and grenade launchers');
      expect(result).toContain('*Notes*: Explosive ordinance-style weapons');
      expect(result).toContain('• **Weapon Slot**: No "Ordnance" Slot');
    });

    it('should handle tables with separator lines', () => {
      const content = `| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |`;

      const result = formatTablesForDiscord(content);
      
      expect(result).toContain('**Column 1 | Column 2:**');
      expect(result).toContain('• **Column 1**: Data 1');
      expect(result).toContain('*Column 2*: Data 2');
    });

    it('should handle mixed content with tables', () => {
      const content = `Here is some text before the table.

| Name | Value |
|------|-------|
| Test | 123   |

And some text after the table.`;

      const result = formatTablesForDiscord(content);
      
      expect(result).toContain('Here is some text before the table.');
      expect(result).toContain('**Name | Value:**');
      expect(result).toContain('• **Name**: Test');
      expect(result).toContain('*Value*: 123');
      expect(result).toContain('And some text after the table.');
    });

    it('should handle malformed table rows gracefully', () => {
      const content = `| Header 1 | Header 2 |
|----------|----------|
| Data 1   | Data 2   |
| Incomplete row |
| More | Data | Than | Headers |`;

      const result = formatTablesForDiscord(content);
      
      expect(result).toContain('**Header 1 | Header 2:**');
      expect(result).toContain('• **Header 1**: Data 1');
      // Incomplete row should be treated as regular text
      expect(result).toContain('| Incomplete row |');
      // Row with more columns than headers should start a new table
      expect(result).toContain('**More | Data | Than | Headers:**');
    });

    it('should handle empty input', () => {
      expect(formatTablesForDiscord('')).toBe('');
      expect(formatTablesForDiscord(null)).toBe(null);
      expect(formatTablesForDiscord(undefined)).toBe(undefined);
    });

    it('should handle tables with special characters', () => {
      const content = `| Feature | Status |
|---------|--------|
| Support é & ñ | ✅ Working |
| Unicode 🚀 | 💯 Perfect |`;

      const result = formatTablesForDiscord(content);
      
      expect(result).toContain('**Feature | Status:**');
      expect(result).toContain('• **Feature**: Support é & ñ');
      expect(result).toContain('*Status*: ✅ Working');
      expect(result).toContain('• **Feature**: Unicode 🚀');
      expect(result).toContain('*Status*: 💯 Perfect');
    });

    it('should handle single column tables', () => {
      const content = `| Single Column |
|---------------|
| Row 1 |
| Row 2 |`;

      const result = formatTablesForDiscord(content);
      
      expect(result).toContain('**Single Column:**');
      expect(result).toContain('• **Single Column**: Row 1');
      expect(result).toContain('• **Single Column**: Row 2');
    });

    it('should preserve non-table pipe characters', () => {
      const content = `This text has | pipe characters | but is not a table.
And this line too | has pipes | but no proper table format.`;

      const result = formatTablesForDiscord(content);
      
      // Should return unchanged since these aren't proper table rows
      expect(result).toBe(content);
    });
  });
});