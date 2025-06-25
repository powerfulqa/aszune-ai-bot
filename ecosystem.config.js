module.exports = {
  apps: [
    {
      name: 'aszune-ai',
      script: 'src/index.js',
      watch: ['src'],
      ignore_watch: ['node_modules', 'data', 'coverage'],
      // Pass environment variables here so pm2 knows them
      env: {
        NODE_ENV: 'production',
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY
      },
      env_development: {
        NODE_ENV: 'development',
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY
      },
      // Error handling
      max_memory_restart: '256M',
      restart_delay: 3000,
      max_restarts: 10,
      // Logging
      out_file: 'logs/aszune-out.log',
      error_file: 'logs/aszune-error.log',
      merge_logs: true,
      time: true
    }
  ]
};
