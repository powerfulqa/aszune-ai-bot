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
async function detectPiModel() {
  try {
    // Default values if detection fails
    let result = {
      isPi: false,
      model: 'unknown',
      ram: os.totalmem() / (1024 * 1024 * 1024), // RAM in GB
      cores: os.cpus().length,
      cpuInfo: {},
    };

    // Look for Raspberry Pi specific files using multiple indicators
    try {
      // Try to read cpuinfo on Linux
      if (os.platform() === 'linux') {
        const cpuInfo = await fs.readFile('/proc/cpuinfo', 'utf8');

        // Combine multiple indicators for more robust detection
        const isPiByHardware =
          cpuInfo.includes('Raspberry Pi') ||
          cpuInfo.includes('BCM27') ||
          cpuInfo.includes('BCM28');

        const isPiByModel =
          cpuInfo.includes('Pi 3') || cpuInfo.includes('Pi 4') || cpuInfo.includes('Pi 5');

        const isPiByRevision = cpuInfo.match(/Revision\s+:\s+[0-9a-f]+/);

        // Check if this is a Pi using multiple methods
        if (isPiByHardware || isPiByModel || isPiByRevision) {
          result.isPi = true;

          // Multi-factor model detection
          // Use CPU model, RAM size, and revision code for more accurate detection
          const modelIndicators = {
            // Pi 3 indicators
            pi3: [
              cpuInfo.includes('BCM2835'),
              cpuInfo.includes('Pi 3'),
              result.ram < 2 && result.cores <= 4,
            ],

            // Pi 4 indicators
            pi4: [
              cpuInfo.includes('BCM2711'),
              cpuInfo.includes('Pi 4'),
              result.cores >= 4 && result.ram >= 1 && result.ram <= 8,
            ],

            // Pi 5 indicators
            pi5: [
              cpuInfo.includes('BCM2712'),
              cpuInfo.includes('Pi 5'),
              result.cores >= 4 && result.ram >= 4,
            ],
          };

          // Count positive indicators for each model
          const pi3Score = modelIndicators.pi3.filter(Boolean).length;
          const pi4Score = modelIndicators.pi4.filter(Boolean).length;
          const pi5Score = modelIndicators.pi5.filter(Boolean).length;

          // Choose model with highest score
          if (pi5Score >= Math.max(pi3Score, pi4Score)) {
            result.model = 'pi5';
          } else if (pi4Score >= pi3Score) {
            result.model = 'pi4';
          } else if (pi3Score > 0) {
            result.model = 'pi3';
          }

          // Store CPU frequency
          const freqMatch = cpuInfo.match(/CPU max MHz:\\s+([0-9.]+)/);
          if (freqMatch && freqMatch[1]) {
            result.cpuInfo.maxFrequency = parseFloat(freqMatch[1]);
          }

          // Get temperature capability
          try {
            // Check if we can read temperature
            const tempCommand = 'vcgencmd measure_temp';
            // Intentionally ignore the output; this is just a capability check to see if
            // temperature can be read
            execSync(tempCommand, { encoding: 'utf8' });
            result.cpuInfo.canReadTemp = true;
          } catch (e) {
            result.cpuInfo.canReadTemp = false;
          }
        }
      }
    } catch (error) {
      // Ignore errors in detection, we'll use defaults
    }

    return result;
  } catch (error) {
    logger.error('Error detecting Pi model:', error);
    return {
      isPi: false,
      model: 'unknown',
      ram: os.totalmem() / (1024 * 1024 * 1024),
      cores: os.cpus().length,
    };
  }
}

/**
 * Generate optimized configuration based on detected Pi model
 * @param {Object} detectedPi - Pi detection results
 * @returns {Object} Optimized configuration settings
 */
function generateOptimizedConfig(detectedPi) {
  // Base configuration that works for all models
  const config = {
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

  // Model-specific optimizations
  if (!detectedPi.isPi) {
    // Not a Pi, use minimal optimizations for compatibility
    config.COMPACT_MODE = false;
    config.LOW_CPU_MODE = false;
    config.MAX_CONNECTIONS = 10;
    config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 500;
    config.MEMORY_LIMITS.RAM_CRITICAL_MB = 800;
    config.DEBOUNCE_MS = 100;
    config.CACHE_MAX_ENTRIES = 500;
    config.REACTION_LIMIT = 10;
    return config;
  }

  // Apply model-specific optimizations
  switch (detectedPi.model) {
  case 'pi3':
    // Pi 3 has limited resources, be very conservative
    config.LOW_CPU_MODE = true;
    config.DEBOUNCE_MS = 500;
    config.MAX_CONNECTIONS = 1;
    config.STREAM_RESPONSES = false;
    config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 150;
    config.MEMORY_LIMITS.RAM_CRITICAL_MB = 180;
    break;

  case 'pi4':
    // Pi 4 is more capable but still needs some constraints
    if (detectedPi.ram < 2) {
      // Pi 4 with 1GB
      config.LOW_CPU_MODE = true;
      config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 300;
      config.MEMORY_LIMITS.RAM_CRITICAL_MB = 400;
    } else if (detectedPi.ram < 4) {
      // Pi 4 with 2GB
      config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 500;
      config.MEMORY_LIMITS.RAM_CRITICAL_MB = 700;
      config.MAX_CONNECTIONS = 3;
    } else {
      // Pi 4 with 4GB+
      config.COMPACT_MODE = false; // No need for compact mode
      config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 1000;
      config.MEMORY_LIMITS.RAM_CRITICAL_MB = 1500;
      config.MAX_CONNECTIONS = 5;
      config.DEBOUNCE_MS = 100;
    }
    break;

  case 'pi5':
    // Pi 5 is much more powerful
    if (detectedPi.ram < 5) {
      // Pi 5 with 4GB
      config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 1000;
      config.MEMORY_LIMITS.RAM_CRITICAL_MB = 1500;
      config.MAX_CONNECTIONS = 8;
      config.DEBOUNCE_MS = 100;
      config.COMPACT_MODE = false;
    } else {
      // Pi 5 with 8GB
      config.ENABLED = true; // Still keep optimizations on, but much lighter
      config.LOW_CPU_MODE = false;
      config.COMPACT_MODE = false;
      config.MEMORY_LIMITS.RAM_THRESHOLD_MB = 2000;
      config.MEMORY_LIMITS.RAM_CRITICAL_MB = 3000;
      config.MAX_CONNECTIONS = 10;
      config.DEBOUNCE_MS = 0; // No debouncing needed
      config.CACHE_MAX_ENTRIES = 1000;
      config.REACTION_LIMIT = 10;
    }
    break;

  default:
    // Unknown Pi model, use safe defaults
    config.LOW_CPU_MODE = true;
    config.DEBOUNCE_MS = 300;
  }

  return config;
}

/**
 * Initialize Pi-specific optimizations
 * @returns {Promise<Object>} The configuration object
 */
async function initPiOptimizations() {
  try {
    // Detect the Pi model
    const piInfo = await detectPiModel();

    // Generate optimized configuration
    const optimizedConfig = generateOptimizedConfig(piInfo);

    // Override with environment variables if specified
    const envOverrides = {
      ENABLED: process.env.ENABLE_PI_OPTIMIZATIONS === 'true',
      LOW_CPU_MODE: process.env.PI_LOW_CPU_MODE === 'true',
      COMPACT_MODE: process.env.PI_COMPACT_MODE === 'true',
      CACHE_ENABLED: process.env.PI_CACHE_ENABLED === 'true',
      MAX_CONNECTIONS: parseInt(process.env.PI_MAX_CONNECTIONS) || optimizedConfig.MAX_CONNECTIONS,
      DEBOUNCE_MS: parseInt(process.env.PI_DEBOUNCE_MS) || optimizedConfig.DEBOUNCE_MS,
      REACTION_LIMIT: parseInt(process.env.PI_REACTION_LIMIT) || optimizedConfig.REACTION_LIMIT,
      STREAM_RESPONSES: process.env.PI_STREAM_RESPONSES === 'true',
    };

    // Only apply environment overrides if they're actually set
    Object.keys(envOverrides).forEach((key) => {
      if (
        process.env[`PI_${key}`] !== undefined ||
        (key === 'ENABLED' && process.env.ENABLE_PI_OPTIMIZATIONS !== undefined)
      ) {
        optimizedConfig[key] = envOverrides[key];
      }
    });

    // Log the configuration
    if (optimizedConfig.ENABLED) {
      logger.info(
        `Detected ${piInfo.model} with ${piInfo.ram.toFixed(1)}GB RAM and ${piInfo.cores} cores`
      );
      logger.info(`Applied optimizations: ${JSON.stringify(optimizedConfig)}`);
    }

    return {
      ...optimizedConfig,
      PI_INFO: piInfo,
    };
  } catch (error) {
    logger.error('Error initializing Pi optimizations:', error);

    // Return safe defaults if initialization fails
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
}

module.exports = {
  detectPiModel,
  generateOptimizedConfig,
  initPiOptimizations,
};
