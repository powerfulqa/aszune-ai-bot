require('dotenv').config();
/**
 * Aszai Discord Bot - Main Entry Point
 *
 * A Discord bot that specializes in gaming lore, game logic, guides, and advice,
 * powered by the Perplexity API.
 */

// Increase max listeners to prevent warnings during testing (multiple signal handlers)
process.setMaxListeners(20);

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
let config;
try {
  config = require('./config/config');
} catch (error) {
  // Use direct stderr write as fallback since logger is not yet available
  process.stderr.write(`Failed to load configuration: ${error.message}\n`);
  process.exit(1);
}

// Set up logger early
const logger = require('./utils/logger');

// Helper function to get config inside functions to avoid circular dependencies
function getConfig() {
  return require('./config/config');
}

// Initialize Pi-specific optimizations if enabled
async function bootWithOptimizations() {
  const _currentConfig = getConfig();
  logger.info('Bot initialization started...');
  // Pi optimizations are now initialized at module load time in production mode
}

// Core dependencies
const handleChatMessage = require('./services/chat');
const commandHandler = require('./commands');
const ConversationManager = require('./utils/conversation');
const conversationManager = new ConversationManager();
conversationManager.initializeIntervals();

// Initialize reminder service
const reminderService = require('./services/reminder-service');

// Initialize instance tracker for license verification
const instanceTracker = require('./services/instance-tracker');
// Initialize metrics telemetry (syncs with instance tracker)
const telemetry = require('./utils/metrics/telemetry');
const analyticsCore = require('./utils/metrics/analytics-core');

// Set up reminder due handler
reminderService.on('reminderDue', async (reminder) => {
  try {
    // Send the reminder message to the channel
    const channel = await client.channels.fetch(reminder.channel_id);
    if (channel) {
      const embed = {
        color: 0x00ff00,
        title: '⏰ Reminder!',
        description: reminder.message,
        footer: {
          text: `Reminder set ${new Date(reminder.created_at).toLocaleDateString()} • Aszai Bot`,
        },
        timestamp: new Date().toISOString(),
      };

      // Send with user mention to trigger notification
      await channel.send({
        content: `<@${reminder.user_id}>`,
        embeds: [embed],
      });
      logger.info(`Sent reminder ${reminder.id} to channel ${reminder.channel_id}`);
    } else {
      logger.error(`Could not find channel ${reminder.channel_id} for reminder ${reminder.id}`);
    }
  } catch (error) {
    logger.error(`Failed to handle reminder due for ${reminder.id}:`, error);
  }
});

// Conditionally load optimizations - don't load in test environment for easier testing
const isProd = process.env.NODE_ENV === 'production';
const enablePiOptimizations = config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED;

// Only initialize in production to avoid affecting tests
if (isProd && enablePiOptimizations) {
  // Initialize Pi-specific optimizations
  logger.info('Initializing Pi optimizations');

  try {
    // Lazy-load optimization modules only when needed
    const { lazyLoad } = require('./utils/lazy-loader');

    // Initialize monitors directly with lazy loading
    lazyLoad(() => require('./utils/memory-monitor'))().initialize();
    lazyLoad(() => require('./utils/performance-monitor'))().initialize();
  } catch (error) {
    logger.warn('Failed to initialize Pi optimizations:', error);
  }
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/**
 * Register slash commands with Discord
 */
async function registerSlashCommands() {
  if (!client.user) {
    logger.error('Cannot register slash commands: Client not ready');
    return;
  }

  const commands = commandHandler.getSlashCommandsData();

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);

  try {
    logger.info(`Registering ${commands.length} slash commands`);

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

    logger.info('Slash commands registered successfully');
  } catch (error) {
    logger.error('Error registering slash commands:', error);
  }
}

// Initialize web dashboard service BEFORE Discord login
// This ensures the dashboard remains accessible even if Discord login fails
async function startWebDashboard() {
  try {
    // In test environment avoid multiple starts that cause EADDRINUSE
    if (process.env.NODE_ENV === 'test') {
      if (global.__WEB_DASHBOARD_STARTED__ || global.__WEB_DASHBOARD_SERVICE__) {
        logger.debug('Web dashboard already started or reserved (test env) - skipping');
        return;
      }
    }

    const webDashboardService = require('./services/web-dashboard');

    // Guard: prevent if service already initialized at module level
    if (global.__WEB_DASHBOARD_SERVICE__) {
      logger.debug('Web dashboard service already exists - skipping redundant start');
      return;
    }

    global.__WEB_DASHBOARD_SERVICE__ = true;
    await webDashboardService.start(3000);
    logger.info('Web dashboard service initialized on port 3000');

    if (process.env.NODE_ENV === 'test') {
      global.__WEB_DASHBOARD_STARTED__ = true;
    }
  } catch (error) {
    logger.error('Failed to initialize web dashboard service:', error);
  }
}

// Set up Discord event handlers
function _setupDiscordEventHandlers() {
  client.once('clientReady', async () => {
    logger.info(`Discord bot is online as ${client.user.tag}!`);
    logger.info(`Process ID: ${process.pid}`);

    // Verify instance with tracking server (license enforcement)
    const isVerified = await instanceTracker.initialize(client);

    // Sync verification state with analytics core
    if (isVerified) {
      analyticsCore.markVerified(instanceTracker.getStatus().instanceId);
    }

    // Also initialize telemetry (secondary verification path)
    await telemetry.initialize(client);

    if (!isVerified && instanceTracker.isVerificationRequired()) {
      logger.error('Instance verification required but failed - shutting down');
      client.destroy();
      process.exit(1);
    }

    // Log bot startup event
    const databaseService = require('./services/database');
    databaseService.logBotEvent('start', 0, 'Bot started successfully');

    // Initialize reminder service
    try {
      await reminderService.initialize();
      logger.info('Reminder service initialized');
    } catch (error) {
      logger.error('Failed to initialize reminder service:', error);
    }

    // Pass Discord client to dashboard for username resolution
    try {
      const webDashboardService = require('./services/web-dashboard');
      webDashboardService.setDiscordClient(client);
      logger.info('Discord client connected to web dashboard');
    } catch (error) {
      logger.error('Failed to connect Discord client to dashboard:', error);
    }

    // Initialize Pi optimizations after connection is established
    await bootWithOptimizations();
    await registerSlashCommands();
  });

  client.on('messageCreate', handleChatMessage);

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await commandHandler.handleSlashCommand(interaction);
  });

  client.on('error', (error) => {
    logger.error('Discord client error:', error);
  });

  client.on('warn', (info) => {
    logger.warn('Discord client warning:', info);
  });
}

// Set up process signal handlers
function _setupProcessSignalHandlers() {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', unhandledRejectionHandler);
  process.on('uncaughtException', uncaughtExceptionHandler);
}

// Flag to prevent multiple shutdown executions
let isShuttingDown = false;

// Centralized shutdown function
const shutdown = async (signal) => {
  // Prevent multiple simultaneous shutdown attempts
  if (isShuttingDown) {
    logger.info(`Shutdown already in progress. Ignoring additional ${signal} signal.`);
    return;
  }

  isShuttingDown = true;

  // DIAGNOSTIC: Log detailed signal information to help identify restart loop
  // Using ERROR level to ensure it shows even with PI_LOG_LEVEL=ERROR
  logger.error('========================================');
  logger.error(`SHUTDOWN TRIGGERED - Signal: ${signal}`);
  logger.error(`Process uptime: ${Math.floor(process.uptime())}s`);
  logger.error('Stack trace:');
  logger.error(new Error().stack);
  logger.error('========================================');

  logger.info(`Received ${signal}. Shutting down gracefully...`);

  // Log bot shutdown event
  const databaseService = require('./services/database');
  const uptimeSeconds = Math.floor(process.uptime());
  databaseService.logBotEvent('stop', uptimeSeconds, `Shutdown initiated by ${signal}`);

  // Safety timeout - force exit if shutdown takes too long (10 seconds)
  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timeout - forcing exit');
    process.exit(1);
  }, 10000);

  try {
    // Perform shutdown steps and collect errors
    const errors = await performShutdownSteps();

    // Handle shutdown completion
    handleShutdownCompletion(errors);
  } catch (error) {
    logger.error('Unexpected error during shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  } finally {
    clearTimeout(shutdownTimeout);
  }
};

// Shutdown step registry - maps step name to shutdown function
const shutdownSteps = [
  {
    name: 'instance tracker',
    handler: () => {
      instanceTracker.stop();
    },
  },
  {
    name: 'web dashboard service',
    handler: async () => {
      const webDashboardService = require('./services/web-dashboard');
      await webDashboardService.stop();
    },
  },
  {
    name: 'reminder service',
    handler: () => {
      reminderService.shutdown();
    },
  },
  {
    name: 'conversation manager',
    handler: async () => {
      await conversationManager.destroy();
    },
  },
  {
    name: 'Discord client',
    handler: async () => {
      await client.destroy();
    },
  },
];

async function _executeShutdownStep(step) {
  try {
    logger.debug(`Shutting down ${step.name}...`);
    await step.handler();
    logger.debug(`${step.name} shutdown successful`);
    return null;
  } catch (error) {
    logger.error(`Error shutting down ${step.name}:`, error);
    return error;
  }
}

async function performShutdownSteps() {
  const errors = [];
  for (const step of shutdownSteps) {
    const error = await _executeShutdownStep(step);
    if (error) errors.push(error);
  }
  return errors;
}

function handleShutdownCompletion(errors) {
  if (errors.length > 0) {
    errors.forEach((err, index) => {
      logger.error(`Shutdown error ${index + 1}/${errors.length}:`, err);
    });
    logger.error(`Shutdown completed with ${errors.length} error(s)`);
    // Don't exit in test environment
    if (process.env.NODE_ENV !== 'test') {
      // Force exit after timeout to ensure PM2 recognizes process termination
      setTimeout(() => {
        logger.warn('Force exiting due to shutdown timeout');
        process.exit(1);
      }, 2000);
      process.exit(1);
    }
  } else {
    logger.info('Shutdown complete.');
    // Don't exit in test environment
    if (process.env.NODE_ENV !== 'test') {
      // Force exit after timeout to ensure PM2 recognizes process termination
      setTimeout(() => {
        logger.warn('Force exiting after graceful shutdown');
        process.exit(0);
      }, 1000);
      process.exit(0);
    }
  }
}

// Handle unhandled promise rejections
function unhandledRejectionHandler(reason, promise) {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit here, just log
}

// Handle uncaught exceptions
function uncaughtExceptionHandler(error) {
  logger.error('Uncaught Exception:', error);
  // Always exit with error code on uncaught exceptions
  shutdown('uncaughtException');
}

// Helper function to handle Discord login with appropriate error handling
function _handleDiscordLogin(token, isTestMode = false) {
  return client
    .login(token)
    .then(() => {
      logger.info(`Logged in to Discord${isTestMode ? ' (test mode)' : ''}`);
    })
    .catch((error) => {
      logger.error('Failed to log in to Discord:', error);

      // Don't exit if it's a session limit error - keep dashboard running
      if (error.message && error.message.includes('Not enough sessions remaining')) {
        logger.warn(
          'Discord session limit reached. Dashboard will remain running. Discord will reconnect when limit resets.'
        );
        // Set up retry after the reset time if possible
        const resetMatch = error.message.match(/resets at (.+?)(?:\.|$)/);
        if (resetMatch) {
          logger.info(`Discord sessions will reset at: ${resetMatch[1]}`);
        }
      } else if (!isTestMode) {
        process.exit(1);
      }
    });
}

// Initialize startup sequence
async function _initializeBot() {
  // Set up event handlers before Discord login
  _setupDiscordEventHandlers();
  _setupProcessSignalHandlers();

  // Start web dashboard first, BEFORE Discord login
  await startWebDashboard();

  // Log in to Discord, with special handling for test environment
  if (process.env.NODE_ENV === 'test') {
    _handleDiscordLogin('test-token', true);
  } else {
    _handleDiscordLogin(config.DISCORD_BOT_TOKEN, false);
  }
}

// Initialize bot startup sequence
_initializeBot().catch((error) => {
  logger.error('Failed to initialize bot:', error);
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
});

// Export for testing
module.exports = {
  client,
  handleChatMessage,
  conversationManager,
  shutdown, // Export shutdown function for testing
  unhandledRejectionHandler, // Export for direct testing
  uncaughtExceptionHandler, // Export for direct testing
  bootWithOptimizations, // Export for branch coverage testing
  registerSlashCommands, // Export for branch coverage testing
};
