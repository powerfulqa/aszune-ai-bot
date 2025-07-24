#!/bin/bash

echo "🔄 Rolling back to tagged safe version..."
cd "/root/discord-bot/aszuneai" || { echo "❌ Failed to find bot directory."; exit 1; }

echo "🛑 Stopping bot..."
pm2 stop aszune-ai

echo "⬅️ Checking out 'safe-version' tag..."
git checkout safe-version

echo "🚀 Restarting bot..."
pm2 start ecosystem.config.js

echo "✅ Rollback complete. Bot is running on the safe version."
