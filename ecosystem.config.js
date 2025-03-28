module.exports = {
  apps: [
    {
      name: 'aszune-ai',
      script: 'index.js',
      // Pass environment variables here so pm2 knows them
      env: {
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY
      }
    }
  ]
};
