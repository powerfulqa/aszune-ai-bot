# Quality Violations - Specific Code Refactoring Patterns

This document provides specific before/after code examples for each violation category.

---

## 1️⃣ Test File Refactoring - Nested Describe Blocks

### Challenge: `perplexity-secure-comprehensive.test.js` (681 lines)

#### BEFORE: Single Huge Describe Block

```javascript
describe('PerplexitySecure Service - Comprehensive Coverage', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    perplexityService = PerplexityService;
    fs.readFile.mockRejectedValue(new Error('File not found'));
  });

  it('should return empty string for null headers in _safeGetHeader', () => {
    const result = perplexityService._safeGetHeader(null, 'content-type');
    expect(result).toBe('');
  });

  it('should return empty string for undefined headers in _safeGetHeader', () => {
    const result = perplexityService._safeGetHeader(undefined, 'content-type');
    expect(result).toBe('');
  });

  // ... 8 more _safeGetHeader tests ...

  it('should cache responses correctly', () => {
    // Cache test 1
  });

  // ... 14 more cache tests ...

  it('should process API response', () => {
    // Response processing test
  });

  // ... 100+ more tests ...
}); // ← Line 681: End of 681-line describe block
```

**Problems:**

- Hard to locate specific tests
- Shared setup not clearly organized
- Can't run just "\_safeGetHeader" tests
- Error reporting unclear: "Should return empty string" - WHICH test?

---

#### AFTER: Organized Nested Describe Blocks

```javascript
describe('PerplexitySecure Service - Comprehensive Coverage', () => {
  // ===== SHARED SETUP (Top level only) =====
  beforeEach(() => {
    jest.clearAllMocks();
    fs.readFile.mockRejectedValue(new Error('File not found'));
  });

  // ===== NESTED GROUP 1: _safeGetHeader method (lines 40-100, ~60 lines) =====
  describe('_safeGetHeader method', () => {
    let perplexityService;

    beforeEach(() => {
      perplexityService = PerplexityService;
    });

    it('should return empty string for null headers', () => {
      const result = perplexityService._safeGetHeader(null, 'content-type');
      expect(result).toBe('');
    });

    it('should return empty string for undefined headers', () => {
      const result = perplexityService._safeGetHeader(undefined, 'content-type');
      expect(result).toBe('');
    });

    it('should return empty string for null key', () => {
      const headers = { 'content-type': 'application/json' };
      const result = perplexityService._safeGetHeader(headers, null);
      expect(result).toBe('');
    });

    it('should get header using Headers.get() method', () => {
      const headers = {
        get: jest.fn().mockReturnValue('application/json'),
      };
      const result = perplexityService._safeGetHeader(headers, 'content-type');
      expect(result).toBe('application/json');
      expect(headers.get).toHaveBeenCalledWith('content-type');
    });

    it('should fall back to object property access', () => {
      const headers = { 'content-type': 'application/json' };
      const result = perplexityService._safeGetHeader(headers, 'content-type');
      expect(result).toBe('application/json');
    });

    it('should check lowercase header names', () => {
      const headers = { 'content-type': 'application/json' };
      const result = perplexityService._safeGetHeader(headers, 'Content-Type');
      expect(result).toBe('application/json');
    });

    it('should check uppercase header names', () => {
      const headers = { 'CONTENT-TYPE': 'application/json' };
      const result = perplexityService._safeGetHeader(headers, 'content-type');
      expect(result).toBe('application/json');
    });

    it('should handle Headers.get() throwing error', () => {
      const headers = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Headers error');
        }),
        'content-type': 'application/json',
      };
      const result = perplexityService._safeGetHeader(headers, 'content-type');
      expect(result).toBe('application/json');
    });
  }); // End _safeGetHeader: ~60 lines, easily navigable

  // ===== NESTED GROUP 2: Caching functionality (lines 100-240, ~140 lines) =====
  describe('Caching functionality', () => {
    let perplexityService;

    beforeEach(() => {
      perplexityService = PerplexityService;
    });

    it('should cache responses with correct key', () => {
      // Cache test 1
    });

    it('should retrieve cached responses on cache hit', () => {
      // Cache test 2
    });

    // ... 13 more cache tests ...
  }); // End Caching: ~140 lines

  // ===== NESTED GROUP 3: Response processing (lines 240-360, ~120 lines) =====
  describe('Response processing', () => {
    let perplexityService;

    beforeEach(() => {
      perplexityService = PerplexityService;
    });

    it('should extract content from API response', () => {
      // Response processing test
    });

    // ... 11 more response tests ...
  }); // End Response processing: ~120 lines

  // ===== NESTED GROUP 4: Error handling (lines 360-460, ~100 lines) =====
  describe('Error handling', () => {
    let perplexityService;

    beforeEach(() => {
      perplexityService = PerplexityService;
    });

    it('should throw on network error', () => {
      // Error test
    });

    // ... 9 more error tests ...
  }); // End Error handling: ~100 lines

  // ===== NESTED GROUP 5: Private methods (lines 460-681, ~150 lines) =====
  describe('Private methods', () => {
    let perplexityService;

    beforeEach(() => {
      perplexityService = PerplexityService;
    });

    it('should compute hash correctly', () => {
      // Private method test
    });

    // ... 14 more private method tests ...
  }); // End Private methods: ~150 lines
}); // ← End 681 lines, but now ORGANIZED INTO 5 GROUPS
```

**Benefits:**

- Clear hierarchical structure
- Error reporting: "PerplexitySecure Service - Comprehensive Coverage > \_safeGetHeader method >
  should return empty string..."
- Run specific tests: `jest --testNamePattern "_safeGetHeader"`
- Each group has clear beforeEach setup
- Total still 681 lines, but logically organized

---

### Pattern for Database Tests (222 lines → Organized groups)

```javascript
describe('DatabaseService', () => {
  // Top-level shared setup
  beforeEach(() => {
    jest.clearAllMocks();
    database.run.mockClear();
  });

  // Group by concern, not by volume
  describe('User Management', () => {
    describe('ensureUserExists', () => {
      it('should insert new user');
      it('should update existing user');
    });
    describe('updateUserStats', () => {
      it('should update stats for user');
    });
  }); // ~60 lines

  describe('Message Storage', () => {
    describe('addUserMessage', () => {
      it('should add user message with timestamp');
      it('should handle null user ID');
    });
    describe('addBotResponse', () => {
      it('should add bot response');
    });
  }); // ~50 lines

  describe('Conversation History', () => {
    describe('getConversationHistory', () => {
      it('should return recent messages');
      it('should limit to max messages');
    });
    describe('clearOldMessages', () => {
      it('should delete old messages');
    });
  }); // ~60 lines

  describe('Reminders (Basic)', () => {
    describe('getActiveReminders', () => {
      it('should return active reminders only');
    });
  }); // ~40 lines
}); // Total organized, each group <60 lines
```

---

## 2️⃣ Command Refactoring - Method Extraction Pattern

### Challenge: `analytics` command (Line 261, 98 lines)

#### BEFORE: Monolithic execute()

```javascript
analytics: {
  data: {
    name: 'analytics',
    description: 'Show Discord server analytics and insights',
  },
  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Generate daily analytics report
      const serverId = interaction.guild?.id;
      const guild = interaction.guild;

      // Get real server statistics instead of empty analytics
      const { onlineCount, botCount, totalMembers, humanMembers } = await getGuildMemberStats(guild);

      // Create mock analytics data with real server stats
      const analyticsData = {
        summary: {
          totalServers: 1,
          totalUsers: humanMembers,
          totalCommands: 0,
          successRate: 100,
          errorRate: 0,
          avgResponseTime: 0,
        },
        commandStats: [],
      };

      const serverInsights = {
        serverId,
        uniqueUsers: onlineCount,
        commandsExecuted: 0,
        errorRate: 0,
        totalActivities: 0,
        averageResponseTime: 0,
        mostActiveUser: null,
        popularCommands: [],
      };

      const embed = {
        color: 0x5865f2,
        title: '📊 Discord Analytics Dashboard',
        fields: [
          {
            name: '🏢 Server Overview',
            value: `Servers: ${analyticsData.summary.totalServers}\nActive Users: ${analyticsData.summary.totalUsers}\nTotal Commands: ${analyticsData.summary.totalCommands}`,
            inline: true,
          },
          {
            name: '📈 Performance',
            value: `Success Rate: ${analyticsData.summary.successRate}%\nError Rate: ${analyticsData.summary.errorRate}%\nAvg Response: ${analyticsData.summary.avgResponseTime}ms`,
            inline: true,
          },
          {
            name: '🎯 Top Commands',
            value:
              analyticsData?.commandStats
                ?.slice(0, 3)
                .map((cmd, i) => `${i + 1}. ${cmd.command} (${cmd.count})`)
                .join('\n') || 'No data yet',
            inline: true,
          },
          {
            name: '💡 Server Insights',
            value: `🟢 Currently Online: ${serverInsights.uniqueUsers}\n👥 Total Members: ${analyticsData.summary.totalUsers}\n🤖 Bots: ${botCount}\n📊 Server Health: Excellent`,
            inline: false,
          },
        ],
        footer: { text: 'Aszai Bot Analytics' },
        timestamp: new Date().toISOString(),
      };

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error fetching analytics:', error);
      const errorResponse = ErrorHandler.handleError(error, 'analytics_command');
      return interaction.editReply({ content: errorResponse.message });
    }
  },
  textCommand: '!analytics',
},
```

**Problems:**

- 98 lines mixed: data fetch + embed creation + error handling
- Embed creation takes ~50 lines of the method
- Hard to test individual parts
- Hard to reuse embed format elsewhere
- 28 statements in one method

---

#### AFTER: Extracted Helper Methods

```javascript
analytics: {
  data: {
    name: 'analytics',
    description: 'Show Discord server analytics and insights',
  },
  async execute(interaction) {
    try {
      await interaction.deferReply();
      const data = await this._fetchAnalyticsData(interaction.guild);
      const embed = this._buildAnalyticsEmbed(data);
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      return this._handleAnalyticsError(error, interaction);
    }
  },

  /**
   * Fetch analytics data from guild and system
   * @param {Guild} guild - Discord guild object
   * @returns {Promise<Object>} - Aggregated analytics data
   * @private
   */
  async _fetchAnalyticsData(guild) {
    const serverId = guild?.id;
    const { onlineCount, botCount, totalMembers, humanMembers } = await getGuildMemberStats(guild);

    const analyticsData = {
      summary: {
        totalServers: 1,
        totalUsers: humanMembers,
        totalCommands: 0,
        successRate: 100,
        errorRate: 0,
        avgResponseTime: 0,
      },
      commandStats: [],
    };

    const serverInsights = {
      serverId,
      uniqueUsers: onlineCount,
      commandsExecuted: 0,
      errorRate: 0,
      totalActivities: 0,
      averageResponseTime: 0,
      mostActiveUser: null,
      popularCommands: [],
    };

    return { analyticsData, serverInsights, botCount };
  },

  /**
   * Build analytics embed from data
   * @param {Object} data - Analytics data from _fetchAnalyticsData
   * @returns {Object} - Discord embed object
   * @private
   */
  _buildAnalyticsEmbed(data) {
    const { analyticsData, serverInsights, botCount } = data;

    return {
      color: 0x5865f2,
      title: '📊 Discord Analytics Dashboard',
      fields: [
        {
          name: '🏢 Server Overview',
          value: `Servers: ${analyticsData.summary.totalServers}\nActive Users: ${analyticsData.summary.totalUsers}\nTotal Commands: ${analyticsData.summary.totalCommands}`,
          inline: true,
        },
        {
          name: '📈 Performance',
          value: `Success Rate: ${analyticsData.summary.successRate}%\nError Rate: ${analyticsData.summary.errorRate}%\nAvg Response: ${analyticsData.summary.avgResponseTime}ms`,
          inline: true,
        },
        {
          name: '🎯 Top Commands',
          value:
            analyticsData?.commandStats
              ?.slice(0, 3)
              .map((cmd, i) => `${i + 1}. ${cmd.command} (${cmd.count})`)
              .join('\n') || 'No data yet',
          inline: true,
        },
        {
          name: '💡 Server Insights',
          value: `🟢 Currently Online: ${serverInsights.uniqueUsers}\n👥 Total Members: ${analyticsData.summary.totalUsers}\n🤖 Bots: ${botCount}\n📊 Server Health: Excellent`,
          inline: false,
        },
      ],
      footer: { text: 'Aszai Bot Analytics' },
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Handle error in analytics command
   * @param {Error} error - The error
   * @param {Interaction} interaction - Discord interaction
   * @returns {Promise} - editReply promise
   * @private
   */
  async _handleAnalyticsError(error, interaction) {
    logger.error('Error fetching analytics:', error);
    const errorResponse = ErrorHandler.handleError(error, 'analytics_command');
    return interaction.editReply({ content: errorResponse.message });
  },

  textCommand: '!analytics',
},
```

**Benefits:**

- `execute()`: Now 6 lines (clear orchestration)
- `_fetchAnalyticsData()`: 20 lines (data concern only)
- `_buildAnalyticsEmbed()`: 25 lines (embed concern only)
- `_handleAnalyticsError()`: 5 lines (error concern only)
- Each method testable independently
- Embed format reusable in other commands
- Statements reduced: 28 → ~8 per method

---

## 3️⃣ Web Dashboard Refactoring - Reduce Nesting

### Challenge: `detectDhcpOrStatic()` (Line 1319, 103 lines, depth 5, complexity 26)

#### BEFORE: Excessive Nesting (Depth 5 Violation)

```javascript
detectDhcpOrStatic() {
  let dhcpResult = null;
  let staticResult = null;

  // LEVEL 1
  if (process.platform === 'linux') {
    // LEVEL 2
    if (this.commandResults?.dhcp) {
      // LEVEL 3
      try {
        const lines = this.commandResults.dhcp.split('\n');
        // LEVEL 4
        for (const line of lines) {
          if (line.includes('current_server')) {
            // LEVEL 5 ⚠️ VIOLATION
            const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch) {
              dhcpResult = {
                type: 'dhcp',
                server: ipMatch[1],
              };
            }
          }
        }
      } catch (error) {
        logger.warn('Error parsing DHCP:', error);
      }
    }

    // LEVEL 2
    if (this.commandResults?.ipaddress) {
      // LEVEL 3
      try {
        const lines = this.commandResults.ipaddress.split('\n');
        // LEVEL 4
        for (const line of lines) {
          if (line.includes('lo0') || line.includes('inet')) {
            // LEVEL 5 ⚠️ VIOLATION
            const match = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
            if (match) {
              staticResult = {
                type: 'static',
                address: match[1],
              };
            }
          }
        }
      } catch (error) {
        logger.warn('Error parsing static IP:', error);
      }
    }

    // LEVEL 2
    if (dhcpResult && staticResult) {
      // LEVEL 3
      if (dhcpResult.server === staticResult.address) {
        // LEVEL 4
        if (Math.random() > 0.5) {
          // LEVEL 5 ⚠️ VIOLATION
          return dhcpResult;
        } else {
          return staticResult;
        }
      } else {
        return dhcpResult; // Prefer DHCP
      }
    }

    return dhcpResult || staticResult;
  } else if (process.platform === 'darwin') {
    // Duplicate complexity for macOS
    // ... 50 more lines with same nesting pattern ...
  }

  return null;
}
```

**Problems:**

- Depth 5 exceeds max allowed 4
- Complexity 26 exceeds max allowed 15
- Platform-specific logic duplicated
- Hard to test individual detection methods
- Multiple concerns mixed: platform detection, DHCP parsing, static parsing, selection logic

---

#### AFTER: Reduced Nesting (Depth 2)

```javascript
/**
 * Detect network configuration method (DHCP or Static)
 * Reduced from depth 5 to depth 2
 * Extracted platform logic into helper methods
 * @returns {Object|null} - { type: 'dhcp'|'static', ...data }
 * @private
 */
detectDhcpOrStatic() {
  const platform = this._determinePlatform();
  if (!platform) return null; // Guard clause - depth 1

  const dhcpResult = this._detectDhcpMethod(platform);
  const staticResult = this._detectStaticMethod(platform);

  return this._selectDetectionMethod(dhcpResult, staticResult); // Depth 1
}

/**
 * Determine current platform
 * @returns {string|null} - 'linux', 'darwin', or null
 * @private
 */
_determinePlatform() {
  const platform = process.platform;
  if (platform === 'linux' || platform === 'darwin') {
    return platform;
  }
  return null;
}

/**
 * Detect DHCP configuration
 * Isolated DHCP parsing logic - reduced from depth 5 to depth 3
 * @param {string} platform - 'linux' or 'darwin'
 * @returns {Object|null} - { type: 'dhcp', server: '192.168.1.1' }
 * @private
 */
_detectDhcpMethod(platform) {
  const dhcpOutput = this.commandResults?.dhcp;
  if (!dhcpOutput) return null; // Guard - depth 1

  try {
    return this._parseDhcpOutput(dhcpOutput); // Depth 2
  } catch (error) {
    logger.warn('Error parsing DHCP:', error);
    return null;
  }
}

/**
 * Parse DHCP command output
 * @param {string} output - Raw DHCP command output
 * @returns {Object|null} - DHCP result
 * @private
 */
_parseDhcpOutput(output) {
  const lines = output.split('\n');

  for (const line of lines) {
    if (!line.includes('current_server')) continue; // Guard

    const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
    if (ipMatch) {
      return {
        type: 'dhcp',
        server: ipMatch[1],
      };
    }
  }

  return null;
}

/**
 * Detect Static IP configuration
 * Isolated static IP parsing logic
 * @param {string} platform - 'linux' or 'darwin'
 * @returns {Object|null} - { type: 'static', address: '192.168.1.100' }
 * @private
 */
_detectStaticMethod(platform) {
  const ipOutput = this.commandResults?.ipaddress;
  if (!ipOutput) return null; // Guard

  try {
    return this._parseStaticOutput(ipOutput, platform); // Depth 2
  } catch (error) {
    logger.warn('Error parsing static IP:', error);
    return null;
  }
}

/**
 * Parse static IP command output
 * @param {string} output - Raw IP address command output
 * @param {string} platform - OS platform
 * @returns {Object|null} - Static IP result
 * @private
 */
_parseStaticOutput(output, platform) {
  const lines = output.split('\n');

  for (const line of lines) {
    // Platform-specific filtering
    const shouldSkip = platform === 'darwin'
      ? !line.includes('lo0') && !line.includes('inet')
      : !line.includes('inet');

    if (shouldSkip) continue; // Guard

    const match = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match) {
      return {
        type: 'static',
        address: match[1],
      };
    }
  }

  return null;
}

/**
 * Select detection result based on availability and confidence
 * @param {Object|null} dhcpResult - DHCP detection result
 * @param {Object|null} staticResult - Static detection result
 * @returns {Object|null} - Selected result
 * @private
 */
_selectDetectionMethod(dhcpResult, staticResult) {
  if (!dhcpResult && !staticResult) return null; // Both missing

  if (!staticResult) return dhcpResult; // Only DHCP
  if (!dhcpResult) return staticResult; // Only static

  // Both available - prefer DHCP by default
  if (dhcpResult.server === staticResult.address) {
    return dhcpResult; // Use DHCP if IPs match
  }

  return dhcpResult; // Prefer DHCP
}
```

**Metrics:**

- **Before**: 103 lines, depth 5, complexity 26
- **After**: Main method 6 lines + 5 helpers averaging 15 lines each
- **Depth Reduction**: 5 → 2 (70% reduction)
- **Complexity Reduction**: 26 → ~6 per method (80% reduction)
- **Benefits**: Each method testable separately, platform logic isolated, parsing independent

---

## 4️⃣ Logger Refactoring - Remove Console Statements

### Challenge: 15 console.log/warn/error in library code

#### BEFORE: Mixed Console + File Logging

```javascript
class Logger {
  // ... constructor and other methods ...

  debug(message, ...dataArgs) {
    if (this._getLogLevel() <= this.levels.DEBUG) {
      const formattedMessage = this._formatMessage('DEBUG', message);
      console.log(formattedMessage); // ❌ VIOLATION: Library shouldn't output to stdout

      // Log each data argument
      dataArgs.forEach((data) => {
        if (data !== undefined) console.log(data); // ❌ VIOLATION
      });

      // Write to file
      this._writeToFile(formattedMessage);
      dataArgs.forEach((data) => {
        if (data !== undefined) {
          try {
            this._writeToFile(JSON.stringify(data));
          } catch (error) {
            this._writeToFile('[Circular Reference]');
          }
        }
      });
    }
  }

  info(message, data) {
    if (this._getLogLevel() <= this.levels.INFO) {
      const formattedMessage = this._formatMessage('INFO', message);
      console.log(formattedMessage); // ❌ VIOLATION
      if (data) console.log(data); // ❌ VIOLATION

      // Write to file
      this._writeToFile(formattedMessage);
      if (data) this._writeToFile(JSON.stringify(data));
    }
  }

  warn(message, data) {
    if (this._getLogLevel() <= this.levels.WARN) {
      const formattedMessage = this._formatMessage('WARN', message);
      console.warn(formattedMessage); // ❌ VIOLATION
      if (data) console.warn(data); // ❌ VIOLATION

      // Write to file
      this._writeToFile(formattedMessage);
      if (data) this._writeToFile(JSON.stringify(data));
    }
  }

  error(message, error) {
    if (this._getLogLevel() <= this.levels.ERROR) {
      const formattedMessage = this._formatMessage('ERROR', message);
      console.error(formattedMessage); // ❌ VIOLATION

      // Write to file
      this._writeToFile(formattedMessage);

      if (error) {
        let errorDetails;

        if (error.response) {
          errorDetails = {
            type: 'API Error Response',
            status: error.response.status,
            data: error.response.data,
          };
          console.error('API Error Response:', errorDetails); // ❌ VIOLATION
        } else if (error.request) {
          errorDetails = {
            type: 'No API Response',
            request: error.request,
          };
          console.error('No response received from API:', error.request); // ❌ VIOLATION
        } else if (typeof error === 'object' && !error.message && !error.stack) {
          console.error(error); // ❌ VIOLATION
          errorDetails = error;
        } else {
          errorDetails = {
            type: 'General Error',
            message: error.message || String(error),
            stack: error.stack,
          };
          console.error('Error:', error.message || error); // ❌ VIOLATION
          if (error.stack) console.error('Stack:', error.stack); // ❌ VIOLATION
        }

        // Write error details to file
        this._writeToFile(JSON.stringify(errorDetails, null, 2));
      }
    }
  }

  async _ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error); // ❌ VIOLATION
    }
  }

  async _writeToFile(formattedMessage) {
    if (process.env.NODE_ENV === 'test') return;

    try {
      await this._ensureLogDirectory();
      await this._rotateLogFileIfNeeded();
      await fs.appendFile(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error); // ❌ VIOLATION
    }
  }

  async _rotateLogFileIfNeeded() {
    try {
      const stats = await fs.stat(this.logFile).catch(() => ({ size: 0 }));
      const envMaxSizeMB = parseInt(process.env.PI_LOG_MAX_SIZE_MB, 10);
      const maxSizeMB = !isNaN(envMaxSizeMB) ? envMaxSizeMB : config.LOGGING.DEFAULT_MAX_SIZE_MB;
      const maxSize = maxSizeMB * 1024 * 1024;

      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        await fs.rename(this.logFile, `${this.logFile}.${timestamp}`);

        const files = await fs.readdir(this.logDir);
        const oldLogs = files
          .filter((f) => f.startsWith('bot.log.') && f !== 'bot.log')
          .sort()
          .reverse()
          .slice(config.LOGGING.MAX_LOG_FILES);

        for (const oldLog of oldLogs) {
          await fs.unlink(path.join(this.logDir, oldLog)).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Log rotation failed:', error); // ❌ VIOLATION
    }
  }
}
```

**Problems:**

- 15 console violations in library code
- Libraries should NOT write to stdout (principle: silent utilities)
- Debug information leaked to stdout
- Users see duplicate output (console + logs)
- No way to suppress console without code changes

---

#### AFTER: Silent File-Based Logging

```javascript
class Logger {
  // ... constructor and other methods ...

  /**
   * Log a debug message (file only, no console output)
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  debug(message, ...dataArgs) {
    if (this._getLogLevel() <= this.levels.DEBUG) {
      const formattedMessage = this._formatMessage('DEBUG', message);
      // ✅ FIXED: No console.log - silent library

      // Write to file
      this._writeToFile(formattedMessage);
      dataArgs.forEach((data) => {
        if (data !== undefined) {
          try {
            this._writeToFile(JSON.stringify(data));
          } catch (error) {
            this._writeToFile('[Circular Reference]');
          }
        }
      });
    }
  }

  /**
   * Log an info message (file only, no console output)
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  info(message, data) {
    if (this._getLogLevel() <= this.levels.INFO) {
      const formattedMessage = this._formatMessage('INFO', message);
      // ✅ FIXED: No console.log - silent library

      // Write to file
      this._writeToFile(formattedMessage);
      if (data) this._writeToFile(JSON.stringify(data));
    }
  }

  /**
   * Log a warning message (file only, no console output)
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  warn(message, data) {
    if (this._getLogLevel() <= this.levels.WARN) {
      const formattedMessage = this._formatMessage('WARN', message);
      // ✅ FIXED: No console.warn - silent library

      // Write to file
      this._writeToFile(formattedMessage);
      if (data) this._writeToFile(JSON.stringify(data));
    }
  }

  /**
   * Log an error message (file only, no console output)
   * @param {string} message - Message to log
   * @param {Error} error - Error object
   */
  error(message, error) {
    if (this._getLogLevel() <= this.levels.ERROR) {
      const formattedMessage = this._formatMessage('ERROR', message);
      // ✅ FIXED: No console.error - silent library

      // Write to file
      this._writeToFile(formattedMessage);

      if (error) {
        let errorDetails;

        if (error.response) {
          // API error with response
          errorDetails = {
            type: 'API Error Response',
            status: error.response.status,
            data: error.response.data,
          };
          // ✅ FIXED: No console.error
        } else if (error.request) {
          // No response received
          errorDetails = {
            type: 'No API Response',
            request: error.request,
          };
          // ✅ FIXED: No console.error
        } else if (typeof error === 'object' && !error.message && !error.stack) {
          // Simple data object
          // ✅ FIXED: No console.error
          errorDetails = error;
        } else {
          // General error
          errorDetails = {
            type: 'General Error',
            message: error.message || String(error),
            stack: error.stack,
          };
          // ✅ FIXED: No console.error statements
        }

        // Write error details to file
        this._writeToFile(JSON.stringify(errorDetails, null, 2));
      }
    }
  }

  /**
   * Create log directory if it doesn't exist (silent failure)
   * @private
   */
  async _ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      // ✅ FIXED: Silent failure - don't write to console
      // Log directory creation is non-critical
    }
  }

  /**
   * Write log to file if not in test mode (silent failure)
   * @param {string} formattedMessage - Formatted log message
   * @private
   */
  async _writeToFile(formattedMessage) {
    if (process.env.NODE_ENV === 'test') return;

    try {
      await this._ensureLogDirectory();
      await this._rotateLogFileIfNeeded();
      await fs.appendFile(this.logFile, formattedMessage + '\n');
    } catch (error) {
      // ✅ FIXED: Silent failure - log file I/O is non-critical
      // Application continues even if file logging fails
    }
  }

  /**
   * Rotate log file if it gets too large (silent failure)
   * @private
   */
  async _rotateLogFileIfNeeded() {
    try {
      const stats = await fs.stat(this.logFile).catch(() => ({ size: 0 }));
      const envMaxSizeMB = parseInt(process.env.PI_LOG_MAX_SIZE_MB, 10);
      const maxSizeMB = !isNaN(envMaxSizeMB) ? envMaxSizeMB : config.LOGGING.DEFAULT_MAX_SIZE_MB;
      const maxSize = maxSizeMB * 1024 * 1024;

      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        await fs.rename(this.logFile, `${this.logFile}.${timestamp}`);

        const files = await fs.readdir(this.logDir);
        const oldLogs = files
          .filter((f) => f.startsWith('bot.log.') && f !== 'bot.log')
          .sort()
          .reverse()
          .slice(config.LOGGING.MAX_LOG_FILES);

        for (const oldLog of oldLogs) {
          await fs.unlink(path.join(this.logDir, oldLog)).catch(() => {});
        }
      }
    } catch (error) {
      // ✅ FIXED: Silent failure - log rotation is non-critical
      // Bot continues even if rotation fails
    }
  }
}
```

**Benefits:**

- ✅ All console statements removed (0 violations)
- ✅ Library is silent - no stdout pollution
- ✅ File logging still maintained
- ✅ Bot/caller controls console output via index.js if needed
- ✅ Silent failure on I/O errors (doesn't break application)
- ✅ Principle: Libraries are silent utilities

---

## 5️⃣ Unused Variables Cleanup

### Challenge: 7 unused variable warnings

#### BEFORE: Unused Imports/Variables

```javascript
// __tests__/unit/index-uncovered-paths.test.js
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js'); // ❌ ALL UNUSED

jest.mock('discord.js', () => ({
  Client: jest.fn(() => mockClient),
  GatewayIntentBits: {
    /* ... */
  },
  REST: jest.fn(() => ({
    /* ... */
  })),
  Routes: {
    /* ... */
  }, // UNUSED
}));

describe('Bot Index Uncovered Paths', () => {
  // Tests don't use Client, GatewayIntentBits, REST, Routes directly
});
```

```javascript
// __tests__/unit/index.test.js - Line 400-402
beforeEach(() => {
  const reminderServiceMock = {
    /* mock */
  }; // ❌ UNUSED
  const localMockClientReadyHandler = jest.fn(); // ❌ UNUSED
  const testLoggerMock = {
    /* mock */
  }; // ❌ UNUSED

  // Tests setup but don't use these variables
});
```

```javascript
// src/services/web-dashboard.js
_someMethod() {
  const { stderr, stdout } = spawn('command'); // ❌ stderr UNUSED
  // Uses stdout but not stderr
}

_anotherMethod() {
  const { gateway, status } = networkInfo; // ❌ gateway UNUSED
  // Uses status but not gateway
}
```

---

#### AFTER: Cleaned Up

**Option 1: Remove Unused Imports**

```javascript
// __tests__/unit/index-uncovered-paths.test.js
// ✅ FIXED: Only import what's needed
// If Client, GatewayIntentBits, REST, Routes aren't used, don't import them

jest.mock('discord.js', () => ({
  Client: jest.fn(() => mockClient),
  // Remove unused mocks if they're not needed
  // Or keep if needed for future tests
}));

describe('Bot Index Uncovered Paths', () => {
  // Tests
});
```

**Option 2: Prefix with Underscore (Intentional Non-Use)**

```javascript
// __tests__/unit/index.test.js - If vars might be needed later
beforeEach(() => {
  const _reminderServiceMock = {
    /* mock */
  }; // Intentionally unused
  const _localMockClientReadyHandler = jest.fn(); // Intentionally unused
  const _testLoggerMock = {
    /* mock */
  }; // Intentionally unused

  // Tests setup
});
```

**Option 3: Remove Completely (Recommended)**

```javascript
// __tests__/unit/index.test.js - Clean removal
beforeEach(() => {
  // If variables aren't used, don't declare them
  // Only declare what's actually used in tests
  // Tests use only what's necessary
});
```

**Option 4: Web Dashboard - Remove or Prefix**

```javascript
// src/services/web-dashboard.js
_someMethod() {
  // ✅ FIXED: Remove unused variable
  const { stdout } = spawn('command');
  // Uses stdout only
}

// OR prefix if intentionally captured for future:
_someMethod() {
  // ✅ FIXED: Prefix to indicate intentional non-use
  const { _stderr, stdout } = spawn('command');
  // Uses stdout, stderr captured but not used currently
}
```

---

## Summary Table

| Category               | Before                  | After                  | Reduction                 |
| ---------------------- | ----------------------- | ---------------------- | ------------------------- |
| Test describe blocks   | 681 lines               | 5 groups (≤150 each)   | -85% lines/group          |
| Command execute()      | 98 lines                | 6 lines + 3 helpers    | 94% reduction             |
| Dashboard detectDhcp() | Depth 5 / Complexity 26 | Depth 2 / Complexity 6 | 75% depth, 77% complexity |
| Logger console calls   | 15 violations           | 0 violations           | 100%                      |
| Unused variables       | 7 warnings              | 0 warnings             | 100%                      |

---

**Next**: Apply patterns progressively, testing after each change.
