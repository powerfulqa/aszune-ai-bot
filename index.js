require('dotenv').config();
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');

// Check for required environment variables
if (!process.env.PERPLEXITY_API_KEY || !process.env.DISCORD_BOT_TOKEN) {
  console.error('Missing PERPLEXITY_API_KEY or DISCORD_BOT_TOKEN in .env');
  process.exit(1);
}

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const MAX_HISTORY = 20; // Increased from 10 to 20
let conversationHistory = {};
const RATE_LIMIT_WINDOW = 5000; // 5 seconds
let lastMessageTimestamps = {}; // userId: timestamp

async function handleMessage(message) {
  if (message.author.bot) return;

  // Rate limiting per user
  const userId = message.author.id;
  const now = Date.now();
  if (
    lastMessageTimestamps[userId] &&
    now - lastMessageTimestamps[userId] < RATE_LIMIT_WINDOW
  ) {
    return message.reply('Please wait a few seconds before sending another message.');
  }
  lastMessageTimestamps[userId] = now;

  // Handle !clearhistory command
  if (message.content === '!clearhistory') {
    conversationHistory[userId] = [];
    return message.reply('Your conversation history has been cleared.');
  }

  // Handle !help command
  if (message.content === '!help') {
    return message.reply(
      "**Aszai Bot Commands:**\n" +
      "`!help` - Show this help message\n" +
      "`!clearhistory` - Clear your conversation history\n" +
      "`!summary` - Summarise your current conversation\n" +
      "Simply chat as normal to talk to the bot!"
    );
  }

  // Handle !summary command
  if (message.content === '!summary') {
    if (!conversationHistory[userId] || conversationHistory[userId].length === 0) {
      return message.reply('No conversation history to summarise.');
    }
    message.channel.sendTyping();
    try {
      const summaryResponse = await axios.post('https://api.perplexity.ai/chat/completions', {
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Summarise the following conversation between a user and an AI assistant in a concise paragraph, using UK English.',
          },
          ...conversationHistory[userId],
        ],
        max_tokens: 256,
        temperature: 0.2,
      }, {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        }
      });
      const summary = summaryResponse.data.choices[0].message.content;
      return message.reply({ embeds: [{
        color: parseInt('0099ff', 16),
        title: 'Conversation Summary',
        description: summary,
        footer: { text: 'Powered by Sonar' }
      }]});
    } catch (error) {
      console.error('Summary Error:', error?.response?.data || error.message || error);
      return message.reply('There was an error generating the summary.');
    }
  }

  // Ignore other commands starting with '!'
  if (message.content.startsWith('!')) return;

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [];
  }

  conversationHistory[userId].push({ role: 'user', content: message.content });

  if (conversationHistory[userId].length > MAX_HISTORY * 2) {
    conversationHistory[userId] = conversationHistory[userId].slice(-MAX_HISTORY * 2);
  }

  message.channel.sendTyping();

  try {
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'Aszai is a bot that specialises in gaming lore, game logic, guides, and advice. If you do not know the answer to a question, clearly say "I don\'t know" rather than attempting to make up an answer.',
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

    const embed = {
      color: parseInt('0099ff', 16),
      description: reply,
      footer: { text: 'Powered by Sonar' },
    };

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Perplexity API Error:', error?.response?.data || error.message || error);
    message.reply('There was an error processing your request. Please try again later.');
  }

  // Reaction feature
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
}

client.on('messageCreate', handleMessage);

client.on('ready', () => {
  console.log('Discord bot is online!');
});

client.login(process.env.DISCORD_BOT_TOKEN);

module.exports = { handleMessage, conversationHistory, lastMessageTimestamps };
