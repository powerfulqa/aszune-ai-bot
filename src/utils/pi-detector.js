/**
 * Raspberry Pi detection and automatic optimization utility
 *
 * This module detects the Raspberry Pi model and available resources,
 * then sets appropriate optimization settings automatically.
 */
const os = require('os');
const fs = require('fs').promises;
const { execSync } = require('child_process');
const logger = require('./logger');

/**
 * Detect Raspberry Pi model and resources
 * @returns {Object} Information about the Pi hardware
 */
/**
 * Helper function to create default Pi detection result
 * @returns {Object} Default detection result
 */
function createDefaultResult() {
  return {
    isPi: false,
    model: 'unknown',
    ram: os.totalmem() / (1024 * 1024 * 1024), // RAM in GB
    cores: os.cpus().length,
    cpuInfo: {},
  };
}

/**
 * Helper function to check if system is a Raspberry Pi
 * @param {string} cpuInfo - CPU info from /proc/cpuinfo
 * @returns {boolean} True if system is a Pi
 */
function isRaspberryPi(cpuInfo) {
  const isPiByHardware =
    cpuInfo.includes('Raspberry Pi') || cpuInfo.includes('BCM27') || cpuInfo.includes('BCM28');

  const isPiByModel =
    cpuInfo.includes('Pi 3') || cpuInfo.includes('Pi 4') || cpuInfo.includes('Pi 5');

  const isPiByRevision = cpuInfo.match(/Revision\s+:\s+[0-9a-f]+/);

  return isPiByHardware || isPiByModel || isPiByRevision;
}

/**
 * Helper function to determine Pi model based on indicators
 * @param {string} cpuInfo - CPU info from /proc/cpuinfo
 * @param {Object} result - Current detection result
 * @returns {string} Detected Pi model
 */
function determinePiModel(cpuInfo, result) {
  const modelIndicators = {
    // Pi 3 indicators
    pi3: [
      cpuInfo.includes('BCM2835'),
      cpuInfo.includes('BCM2837'),
      cpuInfo.includes('Pi 3'),
      cpuInfo.includes('Raspberry Pi 3'),
      result.ram < 2 && result.cores <= 4,
    ],

    // Pi 4 indicators
    pi4: [
      cpuInfo.includes('BCM2711'),
      cpuInfo.includes('Pi 4'),
      cpuInfo.includes('Raspberry Pi 4'),
      result.cores >= 4 && result.ram >= 1 && result.ram <= 8,
    ],

    // Pi 5 indicators  
    pi5: [
      cpuInfo.includes('BCM2712'),
      cpuInfo.includes('Pi 5'),
      cpuInfo.includes('Raspberry Pi 5'),
      cpuInfo.includes('Cortex-A76'),
      result.cores >= 4 && result.ram >= 4,
    ],
  };

  // Count positive indicators for each model
  const pi3Score = modelIndicators.pi3.filter(Boolean).length;
  const pi4Score = modelIndicators.pi4.filter(Boolean).length;
  const pi5Score = modelIndicators.pi5.filter(Boolean).length;

  // Choose model with highest score
  if (pi5Score >= Math.max(pi3Score, pi4Score)) {
    return 'pi5';
  } else if (pi4Score >= pi3Score) {
    return 'pi4';
  } else if (pi3Score > 0) {
    return 'pi3';
  }

  return 'unknown';
}

/**
 * Helper function to extract CPU frequency from cpuinfo
 * @param {string} cpuInfo - CPU info from /proc/cpuinfo
 * @returns {number|null} CPU frequency in MHz or null
 */
function extractCpuFrequency(cpuInfo) {
  const freqMatch = cpuInfo.match(/CPU max MHz:\s*([0-9.]+)/);
  return freqMatch && freqMatch[1] ? parseFloat(freqMatch[1]) : null;
}

/**
 * Helper function to check temperature reading capability
 * @returns {boolean} True if temperature can be read
 */
function checkTemperatureCapability() {
  try {
    const tempCommand = 'vcgencmd measure_temp';
    execSync(tempCommand, { encoding: 'utf8' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Helper function to process Linux Pi detection
 * @param {Object} result - Detection result object to modify
 * @returns {Promise<Object>} Modified result object
 */
async function processLinuxPiDetection(result) {
  const cpuInfo = await fs.readFile('/proc/cpuinfo', 'utf8');

  // Check if this is a Pi using multiple methods
  if (!isRaspberryPi(cpuInfo)) {
    return result;
  }

  result.isPi = true;
  result.model = determinePiModel(cpuInfo, result);

  // Store CPU frequency
  const frequency = extractCpuFrequency(cpuInfo);
  if (frequency) {
    result.cpuInfo.maxFrequency = frequency;
  }

  // Get temperature capability
  result.cpuInfo.canReadTemp = checkTemperatureCapability();

  return result;
}

async function detectPiModel() {
  try {
    let result = createDefaultResult();

    // Look for Raspberry Pi specific files using multiple indicators
    if (os.platform() === 'linux') {
      result = await processLinuxPiDetection(result);
    }

    return result;
  } catch (error) {
    logger.error('Error detecting Pi model:', error);
    return createDefaultResult();
  }
}

/**
 * Generate optimized configuration based on detected Pi model
 * @param {Object} detectedPi - Pi detection results
 * @returns {Object} Optimized configuration settings
 */
/**
 * Helper function to create base configuration
 * @returns {Object} Base configuration object
 */
function createBaseConfig() {
  return {
    ENABLED: true,
    COMPACT_MODE: true,
    CACHE_ENABLED: true,
    CACHE_MAX_ENTRIES: 100,
    MAX_CONNECTIONS: 2,
    DEBOUNCE_MS: 300,
    LOW_CPU_MODE: false,
    STREAM_RESPONSES: true,
    REACTION_LIMIT: 3,
    MEMORY_LIMITS: {
      RAM_THRESHOLD_MB: 200,
      RAM_CRITICAL_MB: 250,
    },
  };
}

/**
 * Helper function to configure for non-Pi systems
 * @param {Object} config - Configuration object to modify
 * @returns {Object} Modified configuration
 */
function configureNonPi(config) {
  config.ENABLED = false;
  config.COMPACT_MODE = false;
  config.LOW_CPU_MODE = false;
  config.MAX_CONNECTIONS = 10;
  config.MAX_HISTORY = 50;
  config.CACHE_SIZE = 500;
  config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 500;
  config.MEMORY_LIMITS.RAM_CRITICAL_MB = 800;
  config.DEBOUNCE_MS = 100;
  config.CACHE_MAX_ENTRIES = 500;
  config.REACTION_LIMIT = 10;
  return config;
}

/**
 * Helper function to configure Pi 3 settings
 * @param {Object} config - Configuration object to modify
 * @returns {Object} Modified configuration
 */
function configurePi3(config) {
  config.COMPACT_MODE = true;
  config.LOW_CPU_MODE = true;
  config.DEBOUNCE_MS = 400;
  config.MAX_CONNECTIONS = 3;
  config.MAX_HISTORY = 10;
  config.CACHE_SIZE = 50;
  config.STREAM_RESPONSES = false;
  config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 400;
  config.MEMORY_LIMITS.RAM_CRITICAL_MB = 500;
  return config;
}

/**
 * Helper function to configure Pi 4 settings based on RAM
 * @param {Object} config - Configuration object to modify
 * @param {number} ram - RAM size in GB
 * @returns {Object} Modified configuration
 */
function configurePi4(config, ram) {
  const ramGB = ram; // ram is already in GB
  if (ramGB < 2) {
    // Pi 4 with 1GB
    config.COMPACT_MODE = true;
    config.LOW_CPU_MODE = true;
    config.MAX_CONNECTIONS = 4;
    config.MAX_HISTORY = 15;
    config.CACHE_SIZE = 75;
    config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 600;
    config.MEMORY_LIMITS.RAM_CRITICAL_MB = 800;
  } else if (ramGB < 4) {
    // Pi 4 with 2GB
    config.COMPACT_MODE = false;
    config.MAX_CONNECTIONS = 6;
    config.MAX_HISTORY = 20;
    config.CACHE_SIZE = 100;
    config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 1000;
    config.MEMORY_LIMITS.RAM_CRITICAL_MB = 1500;
  } else {
    // Pi 4 with 4GB+
    config.COMPACT_MODE = false;
    config.MAX_CONNECTIONS = 10;
    config.MAX_HISTORY = 30;
    config.CACHE_SIZE = 200;
    config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 2000;
    config.MEMORY_LIMITS.RAM_CRITICAL_MB = 3000;
    config.DEBOUNCE_MS = 100;
  }
  return config;
}

/**
 * Helper function to configure Pi 5 settings based on RAM
 * @param {Object} config - Configuration object to modify
 * @param {number} ram - RAM size in GB
 * @returns {Object} Modified configuration
 */
function configurePi5(config, ram) {
  const ramGB = ram; // ram is already in GB
  if (ramGB < 5) {
    // Pi 5 with 4GB
    config.COMPACT_MODE = false;
    config.MAX_CONNECTIONS = 6;
    config.MAX_HISTORY = 25;
    config.CACHE_SIZE = 150;
    config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 1000;
    config.MEMORY_LIMITS.RAM_CRITICAL_MB = 1500;
    config.DEBOUNCE_MS = 100;
  } else {
    // Pi 5 with 8GB
    config.COMPACT_MODE = false;
    config.MAX_CONNECTIONS = 8;
    config.MAX_HISTORY = 30;
    config.CACHE_SIZE = 200;
    config.LOW_CPU_MODE = false;
    config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 2000;
    config.MEMORY_LIMITS.RAM_CRITICAL_MB = 3000;
    config.DEBOUNCE_MS = 0;
    config.CACHE_MAX_ENTRIES = 1000;
    config.REACTION_LIMIT = 10;
  }
  return config;
}

function generateOptimizedConfig(detectedPi) {
  const config = createBaseConfig();

  // Model-specific optimizations
  if (!detectedPi.isPi) {
    return configureNonPi(config);
  }

  // Apply model-specific optimizations
  switch (detectedPi.model) {
  case 'pi3':
    return configurePi3(config);

  case 'pi4':
    return configurePi4(config, detectedPi.ram);

  case 'pi5':
    return configurePi5(config, detectedPi.ram);

  default:
    // Unknown Pi model, use safe defaults
    config.COMPACT_MODE = true;
    config.MAX_CONNECTIONS = 2;
    config.MAX_HISTORY = 10;
    config.CACHE_SIZE = 50;
    config.LOW_CPU_MODE = true;
    config.DEBOUNCE_MS = 300;
    return config;
  }
}

/**
 * Initialize Pi-specific optimizations
 * @returns {Promise<Object>} The configuration object
 */
/**
 * Helper function to create environment overrides
 * @param {Object} optimizedConfig - Base optimized configuration
 * @returns {Object} Environment variable overrides
 */
function createEnvOverrides(optimizedConfig) {
  return {
    ENABLED:
      process.env.PI_OPTIMIZATIONS_ENABLED !== undefined
        ? process.env.PI_OPTIMIZATIONS_ENABLED === 'true'
        : process.env.ENABLE_PI_OPTIMIZATIONS !== undefined
          ? process.env.ENABLE_PI_OPTIMIZATIONS === 'true'
          : optimizedConfig.ENABLED,
    LOW_CPU_MODE:
      process.env.PI_LOW_CPU_MODE !== undefined
        ? process.env.PI_LOW_CPU_MODE === 'true'
        : optimizedConfig.LOW_CPU_MODE,
    COMPACT_MODE:
      process.env.PI_OPTIMIZATIONS_COMPACT_MODE !== undefined
        ? process.env.PI_OPTIMIZATIONS_COMPACT_MODE === 'true'
        : process.env.PI_COMPACT_MODE !== undefined
          ? process.env.PI_COMPACT_MODE === 'true'
          : optimizedConfig.COMPACT_MODE,
    CACHE_ENABLED:
      process.env.PI_CACHE_ENABLED !== undefined
        ? process.env.PI_CACHE_ENABLED === 'true'
        : optimizedConfig.CACHE_ENABLED,
    MAX_CONNECTIONS:
      process.env.PI_OPTIMIZATIONS_MAX_CONNECTIONS !== undefined
        ? parseInt(process.env.PI_OPTIMIZATIONS_MAX_CONNECTIONS)
        : process.env.PI_MAX_CONNECTIONS !== undefined
          ? parseInt(process.env.PI_MAX_CONNECTIONS)
          : optimizedConfig.MAX_CONNECTIONS,
    DEBOUNCE_MS:
      process.env.PI_DEBOUNCE_MS !== undefined
        ? parseInt(process.env.PI_DEBOUNCE_MS)
        : optimizedConfig.DEBOUNCE_MS,
    REACTION_LIMIT:
      process.env.PI_REACTION_LIMIT !== undefined
        ? parseInt(process.env.PI_REACTION_LIMIT)
        : optimizedConfig.REACTION_LIMIT,
    STREAM_RESPONSES:
      process.env.PI_STREAM_RESPONSES !== undefined
        ? process.env.PI_STREAM_RESPONSES === 'true'
        : optimizedConfig.STREAM_RESPONSES,
  };

  // Handle memory limits separately to preserve structure
  if (process.env.PI_MEMORY_LIMIT || process.env.PI_MEMORY_CRITICAL) {
    overrides.MEMORY_LIMITS = {
      RAM_THRESHOLD_MB: process.env.PI_MEMORY_LIMIT
        ? parseInt(process.env.PI_MEMORY_LIMIT)
        : optimizedConfig.MEMORY_LIMITS.RAM_THRESHOLD_MB,
      RAM_CRITICAL_MB: process.env.PI_MEMORY_CRITICAL
        ? parseInt(process.env.PI_MEMORY_CRITICAL)
        : optimizedConfig.MEMORY_LIMITS.RAM_CRITICAL_MB,
    };
  }

  return overrides;
}

/**
 * Helper function to apply environment overrides to configuration
 * @param {Object} optimizedConfig - Configuration to modify
 * @param {Object} envOverrides - Environment variable overrides
 */
function applyEnvOverrides(optimizedConfig, envOverrides) {
  Object.keys(envOverrides).forEach((key) => {
    optimizedConfig[key] = envOverrides[key];
  });
}

/**
 * Helper function to log configuration information
 * @param {Object} optimizedConfig - Configuration to log
 * @param {Object} piInfo - Pi detection information
 */
function logConfiguration(optimizedConfig, piInfo) {
  if (optimizedConfig.ENABLED) {
    logger.info(
      `Detected ${piInfo.model} with ${piInfo.ram.toFixed(1)}GB RAM and ${piInfo.cores} cores`
    );
    logger.info(`Applied optimizations: ${JSON.stringify(optimizedConfig)}`);
  }
}

/**
 * Helper function to create safe default configuration
 * @returns {Object} Safe default configuration
 */
function createSafeDefaults() {
  return {
    ENABLED: process.env.ENABLE_PI_OPTIMIZATIONS === 'true' || false,
    COMPACT_MODE: process.env.PI_COMPACT_MODE === 'true' || false,
    LOW_CPU_MODE: process.env.PI_LOW_CPU_MODE === 'true' || false,
    CACHE_ENABLED: true,
    CACHE_MAX_ENTRIES: 100,
    MAX_CONNECTIONS: parseInt(process.env.PI_MAX_CONNECTIONS) || 2,
    DEBOUNCE_MS: parseInt(process.env.PI_DEBOUNCE_MS) || 300,
    REACTION_LIMIT: parseInt(process.env.PI_REACTION_LIMIT) || 3,
    STREAM_RESPONSES: process.env.PI_STREAM_RESPONSES === 'true' || true,
    MEMORY_LIMITS: {
      RAM_THRESHOLD_MB: 200,
      RAM_CRITICAL_MB: 250,
    },
    PI_INFO: {
      isPi: false,
      model: 'unknown',
      ram: os.totalmem() / (1024 * 1024 * 1024),
      cores: os.cpus().length,
    },
  };
}

async function initPiOptimizations() {
  try {
    // Detect the Pi model
    const piInfo = await detectPiModel();

    // Check if Pi detection failed (returned default result)
    if (!piInfo.isPi && piInfo.model === 'unknown') {
      logger.error('Error initializing Pi optimizations: Pi detection failed');
      // Even if detection failed, check for environment variables
      const safeDefaults = createSafeDefaults();
      const envOverrides = createEnvOverrides(safeDefaults);
      applyEnvOverrides(safeDefaults, envOverrides);
      return safeDefaults;
    }

    // Generate optimized configuration
    const optimizedConfig = generateOptimizedConfig(piInfo);

    // Override with environment variables if specified
    const envOverrides = createEnvOverrides(optimizedConfig);
    applyEnvOverrides(optimizedConfig, envOverrides);

    // Log the configuration
    logConfiguration(optimizedConfig, piInfo);

    return {
      ...optimizedConfig,
      PI_INFO: piInfo,
    };
  } catch (error) {
    logger.error('Error initializing Pi optimizations:', error);
    return createSafeDefaults();
  }
}

module.exports = {
  detectPiModel,
  generateOptimizedConfig,
  initPiOptimizations,
};
