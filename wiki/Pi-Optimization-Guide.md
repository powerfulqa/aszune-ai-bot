# Raspberry Pi Optimisation Guide

## Overview

The Aszune Discord bot comes with built-in optimisations for Raspberry Pi hardware that
automatically adjust based on the Pi model and available resources. The primary deployment target is
Raspberry Pi 5, while remaining compatible with Pi 3 and Pi 4.

## Automatic Model Detection

The bot includes a Pi detection system that:

1. Automatically detects what Raspberry Pi model you're running on
2. Measures available RAM and CPU resources
3. Applies appropriate optimisations for your specific hardware
4. Allows manual overrides through environment variables

## Pi Model-Specific Optimisations

### Raspberry Pi 3

For Pi 3, which has more limited resources, the bot applies the most conservative optimisations:

- Reduced concurrent API connections (1 max)
- Increased debounce timings (500ms)
- Low CPU mode enabled
- Compact mode enabled
- Disabled streaming responses
- Aggressive memory limits (150MB threshold, 180MB critical)
- Limited emoji reactions (3 max)

### Raspberry Pi 4

Optimisations are adjusted based on available RAM:

- **1GB RAM**: Similar to Pi 3 but with slightly higher memory thresholds
- **2GB RAM**: Increased concurrent connections (3 max), higher memory thresholds
- **4GB RAM**: Compact mode disabled, increased connections (5 max), reduced debouncing

### Raspberry Pi 5

The Pi 5 receives the lightest optimisations due to its improved performance:

- **4GB RAM**: Up to 8 concurrent connections, compact mode disabled, minimal debouncing
- **8GB RAM**: Full performance mode, up to 10 concurrent connections, no debouncing, increased
  cache size

## Environment Variable Overrides

You can manually override any optimisation setting using environment variables:

| Environment Variable      | Description                                                           | Default         |
| ------------------------- | --------------------------------------------------------------------- | --------------- |
| `ENABLE_PI_OPTIMIZATIONS` | Master switch to enable/disable all Pi optimisations                  | `false`         |
| `PI_LOW_CPU_MODE`         | Enables low CPU usage mode                                            | Varies by model |
| `PI_COMPACT_MODE`         | Enables memory-saving compact mode                                    | Varies by model |
| `PI_CACHE_ENABLED`        | Enables response caching                                              | `true`          |
| `PI_MAX_CONNECTIONS`      | Maximum number of concurrent API connections                          | Varies by model |
| `PI_DEBOUNCE_MS`          | Milliseconds to debounce rapid requests                               | Varies by model |
| `PI_REACTION_LIMIT`       | Maximum number of emoji reactions                                     | Varies by model |
| `PI_STREAM_RESPONSES`     | Whether to stream responses (more responsive but uses more resources) | Varies by model |
| `PI_MEMORY_LIMIT`         | Memory threshold in MB for optimisation triggers                      | Varies by model |
| `PI_MEMORY_CRITICAL`      | Critical memory threshold in MB                                       | Varies by model |
| `PI_LOG_LEVEL`            | Log level for Pi-specific logs                                        | `ERROR`         |

## How to Enable Pi Optimisations

The Pi detection and optimisation system is enabled by default when running on Raspberry Pi
hardware. However, if you want to explicitly enable or disable it, you can set the
`ENABLE_PI_OPTIMIZATIONS` environment variable:

```bash
# Enable Pi optimisations
export ENABLE_PI_OPTIMIZATIONS=true

# Start the bot
npm start
```

## Testing Pi Optimisations

To verify that Pi optimisations are working correctly:

1. Start the bot with `ENABLE_PI_OPTIMIZATIONS=true`
2. Check the logs for messages like:
   - "Detected pi4 with 4.0GB RAM and 4 cores"
   - "Applied optimizations: {optimizations object}"
3. The bot should now be running with settings optimised for your specific Pi model.

## Running with PM2 for Pi Optimisations

To run the bot with PM2 and ensure all Pi optimisations are applied, use the startup script (it
loads `.env`, exports Pi settings, and starts PM2 using `ecosystem.config.js`):

```bash
sudo ./start-pi-optimized.sh

pm2 startup
pm2 save
```

This will keep your bot running and automatically restart it after a reboot, with all Pi-specific
optimisations enabled. The main bot process name in PM2 is `aszune-ai`.

## Troubleshooting

If you're experiencing issues with Pi optimisations:

- Check that the `ENABLE_PI_OPTIMIZATIONS` environment variable is set to `true`
- Verify that your bot has permissions to read system files like `/proc/cpuinfo`
- If detection fails, you can manually specify settings using the environment variables listed above
- For persistent issues, you can disable Pi optimisations by setting `ENABLE_PI_OPTIMIZATIONS=false`

## Future-Proofing

The optimisation system is designed to be future-proof and will work with upcoming Raspberry Pi
models. As new Pi models are released, the detection system will apply sensible defaults even if it
doesn't explicitly recognize the new hardware.
