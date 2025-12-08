module.exports = {
  apps: [
    {
      name: 'aszune-ai',
      script: 'src/index.js',
      watch: false,
      ignore_watch: [
        'node_modules',
        'data',
        'logs',
        'coverage',
        '*.sqlite',
        '*.json',
        '*.log',
        '.git',
      ],
      // Pass environment variables here so pm2 knows them
      env: {
        NODE_ENV: 'production',
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
        INSTANCE_TRACKING_SERVER: 'http://localhost:3001/api/beacon',
        INSTANCE_TRACKING_ENABLED: 'true',
        REQUIRE_VERIFICATION: 'false',
      },
      env_development: {
        NODE_ENV: 'development',
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
        INSTANCE_TRACKING_ENABLED: 'false',
      },
      // Error handling
      max_memory_restart: '2G',
      restart_delay: 3000,
      max_restarts: 10,
      // Logging
      out_file: 'logs/aszune-out.log',
      error_file: 'logs/aszune-error.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'instance-tracker',
      script: 'scripts/tracking-server.js',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        TRACKING_ADMIN_KEY: process.env.TRACKING_ADMIN_KEY || 'change-this-secret-key',
      },
      // Lightweight - minimal resources
      max_memory_restart: '100M',
      restart_delay: 5000,
      max_restarts: 5,
      // Logging
      out_file: 'logs/tracker-out.log',
      error_file: 'logs/tracker-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
