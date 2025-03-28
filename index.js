require('dotenv').config();
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');

// Ensure you have PERPLEXITY_API_KEY and DISCORD_BOT_TOKEN in your .env file
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const MAX_HISTORY = 10; // Maximum conversation history
let conversationHistory = {}; // Initialize conversation history
let isDirty = false; // Flag for dirty data

client.on('ready', () => {
  console.log('Discord bot is online!');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Handle clear history command
  if (message.content === '!clearhistory') {
    const userId = message.author.id;
    conversationHistory[userId] = [];
    isDirty = true;
    return message.reply('Your conversation history has been cleared.');
  }

  // Existing commands (voice commands, etc.) and chat handling below...
  if (message.content.startsWith('!')) return; // Ignore commands starting with '!'

  const userId = message.author.id;

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [];
  }

  conversationHistory[userId].push({ role: 'user', content: message.content });

  // Limit history to the last MAX_HISTORY interactions (user + assistant messages)
  if (conversationHistory[userId].length > MAX_HISTORY * 2) {
    conversationHistory[userId] = conversationHistory[userId].slice(-MAX_HISTORY * 2);
  }

  isDirty = true;
  message.channel.sendTyping();

  try {
    // Use Mistral-7B-Instruct model for chat completions
// Use Sonar model for chat completions
const response = await axios.post('https://api.perplexity.ai/chat/completions', {
  model: 'sonar',  // Changed from mistral-7b-instruct to sonar
  messages: [
    {
      role: 'system',
      content: 'Aszune AI is a friendly bot that specializes in gaming lore, game logic, guides, and advice.',
    },
    ...conversationHistory[userId],
  ],
  max_tokens: 1024,
  temperature: 0.0,
}, {
  headers: {
    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json',
  }
});
    let reply = response.data.choices[0].message.content;

    // Append relevant emojis based on keywords in the reply
    const emojiMap = {
      happy: '😊',
      love: '❤️',
      sad: '😢',
      congratulations: '🎉',
      thanks: '🙏',
      awesome: '😎',
      help: '🆘',
      welcome: '👋',
    };
    for (const [keyword, emoji] of Object.entries(emojiMap)) {
      if (reply.toLowerCase().includes(keyword)) {
        reply += ` ${emoji}`;
      }
    }

    conversationHistory[userId].push({ role: 'assistant', content: reply });
    isDirty = true;

    const embed = {
      color: parseInt('0099ff', 16),
      description: reply,
      footer: { text: 'Powered by Mistral-7B-Instruct' },
    };

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Mistral-7B-Instruct Error:', error);
    message.reply('There was an error processing your request.');
  }

  // Reaction feature remains unchanged or can be refined as needed
  const reactions = {
    hello: '👋',
    funny: '😂',
    sad: '😢',
    awesome: '😎',
    love: '❤️',
  };
  for (const [keyword, reactionEmoji] of Object.entries(reactions)) {
    if (message.content.toLowerCase().includes(keyword)) {
      try {
        await message.react(reactionEmoji);
      } catch (err) {
        console.error(`Error reacting with ${reactionEmoji}:`, err);
      }
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
