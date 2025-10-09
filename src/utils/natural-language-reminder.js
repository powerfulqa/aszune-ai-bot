const chrono = require('chrono-node');
const timeParser = require('./time-parser');
const reminderService = require('../services/reminder-service');
const logger = require('./logger');

/**
 * Natural Language Reminder Processor
 * Detects reminder requests in natural language and handles them automatically
 */
class NaturalLanguageReminderProcessor {
  constructor() {
    // Patterns to detect reminder requests
    this.reminderPatterns = [
      // Direct reminder requests
      /\b(remind me|set a reminder|create a reminder|schedule a reminder)\b/i,
      /\b(when|what time|when will|when does)\b.*\b(come out|release|launch|be released|be available)\b/i,
      /\b(let me know|notify me|tell me)\b.*\b(when|what time)\b/i,
      /\b(remind me about|remind me when)\b/i,

      // Future event inquiries that might imply reminders
      /\b(when is|when will|what's the date for|when does)\b.*\b(release|launch|come out|be out)\b/i,
    ];

    // Patterns to extract event names/topics
    this.eventExtractionPatterns = [
      // "when does X come out" or "when will X be released"
      /\b(when|what time)\s+(?:does|will|is)\s+(.+?)\s+(?:come out|be released|be available|launch|get released|release|be out)\b/i,
      // "remind me when/about X comes out"
      /\b(remind me)\s+(?:when|about)\s+(.+?)\s+(?:comes out|is released|will be released|launches|releases|comes|is|will be)\b/i,
      // "can you remind me about X"
      /\b(can you )?(remind me|let me know|notify me)\s+(?:when|about|of)\s+(.+?)\s*(?:\?|next|$)/i,
      // "set a reminder for X"
      /\b(set a reminder|create a reminder|schedule a reminder)\s+(?:for|about)\s+(.+?)\s*(?:\?|tomorrow|next|$)/i,
      // "when is X released/coming out"
      /\b(when is|when will|what's the date for)\s+(.+?)\s+(?:released?|coming out|launching|available|out)\b/i,
    ];

    // Patterns to detect if user wants a reminder set
    this.explicitReminderPatterns = [
      /\b(remind me|set a reminder|create a reminder|schedule a reminder)\b/i,
      /\b(let me know|notify me|tell me)\b.*\b(when|what time)\b/i,
    ];
  }

  /**
   * Check if a message contains a reminder request
   * @param {string} message - The user's message
   * @returns {boolean} - Whether this looks like a reminder request
   */
  isReminderRequest(message) {
    return this.reminderPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Extract the event/topic from a reminder request
   * @param {string} message - The user's message
   * @returns {string|null} - The extracted event name or null if not found
   */
  extractEvent(message) {
    for (const pattern of this.eventExtractionPatterns) {
      const match = message.match(pattern);
      if (match) {
        // Return the captured group (usually the event name)
        const event = match[match.length - 1];
        if (event && event.trim().length > 0) {
          // Clean up the extracted event name
          return this.cleanEventName(event.trim());
        }
      }
    }
    return null;
  }

  /**
   * Clean up extracted event names by removing common articles and prepositions
   * @param {string} eventName - Raw extracted event name
   * @returns {string} - Cleaned event name
   */
  cleanEventName(eventName) {
    // Remove common leading articles and prepositions
    const cleaned = eventName
      .replace(/^(the|a|an)\s+/i, '') // Remove leading articles
      .replace(/\s+(will|is|be|come|get)\s+/gi, ' ') // Remove common verbs
      .trim();

    return cleaned;
  }

  /**
   * Check if the user explicitly wants a reminder set
   * @param {string} message - The user's message
   * @returns {boolean} - Whether user wants an explicit reminder
   */
  wantsExplicitReminder(message) {
    return this.explicitReminderPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Extract dates from AI response text
   * @param {string} responseText - The AI's response
   * @returns {Array} - Array of parsed date objects with context
   */
  extractDatesFromResponse(responseText) {
    const dates = [];

    // Look for various date formats in the response
    const datePatterns = [
      // Explicit dates like "January 15, 2025" or "Jan 15, 2025"
      /\b((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})\b/gi,
      // ISO dates like "2025-01-15"
      /\b(\d{4}-\d{2}-\d{2})\b/g,
      // Dates with month names like "15 January 2025"
      /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\b/gi,
      // Quarter references like "Q1 2025" or "first quarter 2025"
      /\b((?:Q[1-4]|first|second|third|fourth)\s+quarter\s+\d{4})\b/gi,
      // Year references like "2025"
      /\b(20\d{2})\b/g,
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(responseText)) !== null) {
        const dateText = match[1];
        const context = this.getContextAroundMatch(responseText, match.index, 100);

        dates.push({
          text: dateText,
          context: context,
          index: match.index,
          type: this.classifyDateType(dateText),
        });
      }
    }

    return dates;
  }

  /**
   * Get context around a match position
   * @param {string} text - Full text
   * @param {number} position - Position of match
   * @param {number} contextLength - Length of context to extract
   * @returns {string} - Context string
   */
  getContextAroundMatch(text, position, contextLength) {
    const start = Math.max(0, position - contextLength / 2);
    const end = Math.min(text.length, position + contextLength / 2);
    return text.substring(start, end).trim();
  }

  /**
   * Classify the type of date found
   * @param {string} dateText - The date text
   * @returns {string} - Date type classification
   */
  classifyDateType(dateText) {
    if (/\d{4}-\d{2}-\d{2}/.test(dateText)) return 'iso';
    if (
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)/i.test(
        dateText
      )
    )
      return 'full';
    if (/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(dateText)) return 'abbreviated';
    if (/Q[1-4]/i.test(dateText) || /quarter/i.test(dateText)) return 'quarter';
    if (/^\d{4}$/.test(dateText)) return 'year';
    return 'unknown';
  }

  /**
   * Convert extracted date to a usable Date object
   * @param {Object} dateInfo - Date info from extractDatesFromResponse
   * @returns {Date|null} - Parsed Date object or null if unparseable
   */
  parseExtractedDate(dateInfo) {
    try {
      // Try to parse the date using chrono-node
      const results = chrono.parse(dateInfo.text, new Date(), { forwardDate: true });
      if (results.length > 0) {
        return results[0].date();
      }

      // Fallback: try to parse as ISO date
      if (dateInfo.type === 'iso') {
        const date = new Date(dateInfo.text + 'T00:00:00Z');
        if (!isNaN(date.getTime())) return date;
      }

      // Fallback: try to parse year-only dates
      if (dateInfo.type === 'year') {
        const year = parseInt(dateInfo.text);
        if (year >= 2024 && year <= 2030) {
          // Assume January 1st of that year
          return new Date(year, 0, 1);
        }
      }

      return null;
    } catch (error) {
      logger.warn(`Failed to parse extracted date "${dateInfo.text}":`, error.message);
      return null;
    }
  }

  /**
   * Process a natural language reminder request
   * @param {string} message - User's message
   * @param {string} userId - Discord user ID
   * @param {string} channelId - Discord channel ID
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>} - Processing result
   */
  async processReminderRequest(message, userId, channelId, serverId) {
    try {
      // Extract the event/topic
      const event = this.extractEvent(message);
      if (!event) {
        return {
          success: false,
          reason: 'Could not extract event from message',
          response:
            "I couldn't understand what event you want to be reminded about. Please try rephrasing your request.",
        };
      }

      logger.info(`Processing reminder request for event: "${event}" from user ${userId}`);

      // Check if this is an explicit reminder request
      const wantsReminder = this.wantsExplicitReminder(message);

      // For now, we'll assume all detected requests want reminders
      // In the future, we could ask for confirmation for implicit requests

      return {
        success: true,
        event: event,
        wantsReminder: wantsReminder || true, // Default to true for detected requests
        message: message,
        userId: userId,
        channelId: channelId,
        serverId: serverId,
      };
    } catch (error) {
      logger.error('Error processing reminder request:', error);
      return {
        success: false,
        reason: 'Processing error',
        response:
          'Sorry, I encountered an error while processing your reminder request. Please try again.',
      };
    }
  }

  /**
   * Look up event information and set reminder if date found
   * @param {Object} requestData - Data from processReminderRequest
   * @returns {Promise<Object>} - Result of the lookup and reminder setting
   */
  async lookupAndSetReminder(requestData) {
    const { event, userId, channelId, serverId } = requestData;

    try {
      const aiResponse = await this.lookupEventDate(event, userId);
      const extractedDates = this.extractDatesFromResponse(aiResponse);
      const bestDate = this.findBestDate(extractedDates);

      if (!bestDate) {
        return this.createNoDateFoundResponse(event, aiResponse);
      }

      return await this.createReminderForDate(event, bestDate, userId, channelId, serverId);
    } catch (error) {
      logger.error(`Error looking up and setting reminder for ${event}:`, error);
      return {
        success: false,
        reason: 'Lookup error',
        response: `Sorry, I encountered an error while looking up information about "${event}". Please try again later.`,
      };
    }
  }

  /**
   * Look up the release date for an event using AI
   * @param {string} event - Event name
   * @param {string} userId - User ID for conversation context
   * @returns {Promise<string>} - AI response
   */
  async lookupEventDate(event, userId) {
    const perplexityService = require('../services/perplexity-secure');
    const query = `When will ${event} be released or come out? Please provide the exact release date if known.`;

    const ConversationManager = require('./conversation');
    const conversationManager = new ConversationManager();
    const history = conversationManager.getHistory(userId);
    const lookupHistory = [...history, { role: 'user', content: query }];

    logger.info(`Looking up release date for: ${event}`);
    return await perplexityService.generateChatResponse(lookupHistory);
  }

  /**
   * Find the best (earliest future) date from extracted dates
   * @param {Array} extractedDates - Array of extracted date objects
   * @returns {Date|null} - Best date or null
   */
  findBestDate(extractedDates) {
    let bestDate = null;

    for (const dateInfo of extractedDates) {
      const parsedDate = this.parseExtractedDate(dateInfo);
      if (parsedDate && parsedDate > new Date()) {
        if (!bestDate || parsedDate < bestDate) {
          bestDate = parsedDate;
        }
      }
    }

    return bestDate;
  }

  /**
   * Create response when no date is found
   * @param {string} event - Event name
   * @param {string} aiResponse - AI response text
   * @returns {Object} - Response object
   */
  createNoDateFoundResponse(event, aiResponse) {
    logger.info(`No valid future dates found for event: ${event}`);
    return {
      success: false,
      reason: 'No valid future dates',
      response: `I found some date information for "${event}", but couldn't identify a valid future release date. Here's what I found:\n\n${aiResponse.substring(0, 500)}${aiResponse.length > 500 ? '...' : ''}`,
    };
  }

  /**
   * Create a reminder for the found date
   * @param {string} event - Event name
   * @param {Date} date - Release date
   * @param {string} userId - User ID
   * @param {string} channelId - Channel ID
   * @param {string} serverId - Server ID
   * @returns {Promise<Object>} - Result object
   */
  async createReminderForDate(event, date, userId, channelId, serverId) {
    // Ensure reminder service is initialized
    if (!reminderService.isInitialized) {
      await reminderService.initialize();
    }

    const reminder = await reminderService.createReminder(
      userId,
      `Release of ${event}`,
      date.toISOString(),
      'UTC',
      channelId,
      serverId
    );

    logger.info(`Set reminder for ${event} on ${date.toISOString()} (ID: ${reminder.id})`);

    const relativeTime = timeParser.getRelativeTime(date);
    const formattedTime = timeParser.formatTime(date, 'UTC');

    return {
      success: true,
      reminderId: reminder.id,
      event: event,
      date: date,
      response: `✅ **Reminder Set!**\n\nI'll remind you when **${event}** is released.\n\n**Release Date:** ${formattedTime}\n**Time Until Release:** ${relativeTime}\n\n*Based on the latest available information.*`,
    };
  }
}

const naturalLanguageReminderProcessor = new NaturalLanguageReminderProcessor();
module.exports = naturalLanguageReminderProcessor;
module.exports.NaturalLanguageReminderProcessor = NaturalLanguageReminderProcessor;
module.exports.default = naturalLanguageReminderProcessor;
