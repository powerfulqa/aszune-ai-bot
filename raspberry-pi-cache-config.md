# Cache configuration optimized for Raspberry Pi 3

## Environment variables to use in your .env file:
# ASZUNE_MEMORY_CACHE_SIZE=100
# ASZUNE_MAX_CACHE_SIZE=2000
# ASZUNE_LRU_PRUNE_THRESHOLD=1800
# ASZUNE_LRU_PRUNE_TARGET=1500
# ASZUNE_CACHE_SAVE_INTERVAL_MS=600000

This file contains the recommended cache configuration settings for running
the bot on a Raspberry Pi 3:

1. Memory cache size: 100 items (reduced from 500)
   - Conserves RAM on the Pi's limited 1GB memory

2. Maximum cache size: 2,000 entries (reduced from 10,000)
   - Balances caching benefits with storage limitations

3. LRU pruning thresholds: 1,800/1,500 (reduced from 9,000/7,500)
   - More aggressive cache pruning to prevent excessive memory use

4. Save interval: 10 minutes (increased from 5 minutes)
   - Reduces SD card wear by decreasing write frequency

For Raspberry Pi 4 (4GB or 8GB), these values can be increased:
- ASZUNE_MEMORY_CACHE_SIZE: 250-500
- ASZUNE_MAX_CACHE_SIZE: 5000+
- ASZUNE_CACHE_SAVE_INTERVAL_MS: Can be reduced back to 300000 (5 minutes)
