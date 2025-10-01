/**
 * Enhanced Conversation Context - Advanced conversation state management
 * Enterprise-grade conversation context handling and state management
 */

const logger = require('./logger');

class EnhancedConversationContext {
  constructor(userId) {
    this.userId = userId;
    this.history = [];
    this.metadata = {
      startTime: Date.now(),
      messageCount: 0,
      lastActivity: Date.now(),
      topics: new Set(),
      sentiment: 'neutral'
    };
    this.settings = {
      maxHistory: 50,
      contextWindow: 10,
      autoCleanup: true
    };
  }
  
  /**
   * Adds a message to conversation context
   * @param {Object} message - Message to add
   * @param {string} message.role - User or assistant
   * @param {string} message.content - Message content
   * @param {Object} metadata - Additional metadata
   */
  addMessage(message, metadata = {}) {
    try {
      const contextMessage = {
        ...message,
        timestamp: Date.now(),
        id: this._generateMessageId(),
        metadata: {
          ...metadata,
          wordCount: message.content.split(' ').length,
          sentiment: this._analyzeSentiment(message.content)
        }
      };
      
      this.history.push(contextMessage);
      this.metadata.messageCount++;
      this.metadata.lastActivity = Date.now();
      
      // Extract topics
      this._extractTopics(message.content);
      
      // Auto-cleanup if enabled
      if (this.settings.autoCleanup && this.history.length > this.settings.maxHistory) {
        this._cleanupHistory();
      }
      
      return contextMessage;
    } catch (error) {
      logger.error('Error adding message to context:', error);
      throw error;
    }
  }
  
  /**
   * Gets conversation context for AI processing
   * @param {number} messageLimit - Number of recent messages
   * @returns {Array} - Context messages
   */
  getContext(messageLimit = null) {
    const limit = messageLimit || this.settings.contextWindow;
    const recentMessages = this.history.slice(-limit);
    
    return recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }));
  }
  
  /**
   * Gets conversation summary statistics
   * @returns {Object} - Conversation statistics
   */
  getConversationSummary() {
    const duration = Date.now() - this.metadata.startTime;
    const avgWordsPerMessage = this._calculateAverageWords();
    const dominantSentiment = this._getDominantSentiment();
    
    return {
      userId: this.userId,
      duration: Math.round(duration / 1000), // seconds
      messageCount: this.metadata.messageCount,
      averageWordsPerMessage: avgWordsPerMessage,
      topics: Array.from(this.metadata.topics).slice(0, 5),
      dominantSentiment,
      lastActivity: new Date(this.metadata.lastActivity).toISOString()
    };
  }
  
  /**
   * Analyzes conversation patterns
   * @returns {Object} - Pattern analysis
   */
  analyzeConversationPatterns() {
    if (this.history.length < 3) {
      return {
        pattern: 'insufficient_data',
        engagement: 'unknown',
        complexity: 'unknown'
      };
    }
    
    const pattern = this._identifyConversationPattern();
    const engagement = this._calculateEngagementLevel();
    const complexity = this._assessConversationComplexity();
    
    return {
      pattern,
      engagement,
      complexity,
      recommendations: this._generateContextRecommendations(pattern, engagement)
    };
  }
  
  /**
   * Clears conversation context
   */
  clearContext() {
    this.history = [];
    this.metadata.messageCount = 0;
    this.metadata.topics.clear();
    this.metadata.lastActivity = Date.now();
    logger.info(`Conversation context cleared for user: ${this.userId}`);
  }
  
  /**
   * Generates unique message ID
   * @returns {string} - Unique ID
   * @private
   */
  _generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Basic sentiment analysis
   * @param {string} content - Message content
   * @returns {string} - Sentiment
   * @private
   */
  _analyzeSentiment(content) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];
    
    const words = content.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
  
  /**
   * Extracts topics from message content
   * @param {string} content - Message content
   * @private
   */
  _extractTopics(content) {
    const topics = ['ai', 'bot', 'help', 'question', 'problem', 'code', 'programming'];
    const words = content.toLowerCase().split(/\s+/);
    
    topics.forEach(topic => {
      if (words.includes(topic)) {
        this.metadata.topics.add(topic);
      }
    });
  }
  
  /**
   * Cleans up old messages from history
   * @private
   */
  _cleanupHistory() {
    const keepCount = Math.floor(this.settings.maxHistory * 0.8); // Keep 80%
    this.history = this.history.slice(-keepCount);
    logger.info(`Cleaned up conversation history for user: ${this.userId}`);
  }
  
  /**
   * Calculates average words per message
   * @returns {number} - Average word count
   * @private
   */
  _calculateAverageWords() {
    if (this.history.length === 0) return 0;
    
    const totalWords = this.history.reduce((sum, msg) => {
      return sum + (msg.metadata?.wordCount || 0);
    }, 0);
    
    return Math.round(totalWords / this.history.length);
  }
  
  /**
   * Gets dominant sentiment from conversation
   * @returns {string} - Dominant sentiment
   * @private
   */
  _getDominantSentiment() {
    const sentiments = this.history.map(msg => msg.metadata?.sentiment).filter(Boolean);
    const counts = sentiments.reduce((acc, sentiment) => {
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'neutral');
  }
  
  /**
   * Identifies conversation pattern
   * @returns {string} - Pattern type
   * @private
   */
  _identifyConversationPattern() {
    const recentMessages = this.history.slice(-5);
    const avgLength = recentMessages.reduce((sum, msg) => sum + msg.content.length, 0) / recentMessages.length;
    
    if (avgLength > 200) return 'detailed_discussion';
    if (avgLength < 50) return 'quick_questions';
    return 'casual_conversation';
  }
  
  /**
   * Calculates engagement level
   * @returns {string} - Engagement level
   * @private
   */
  _calculateEngagementLevel() {
    const messageFrequency = this.metadata.messageCount / ((Date.now() - this.metadata.startTime) / 60000); // per minute
    
    if (messageFrequency > 2) return 'high';
    if (messageFrequency > 0.5) return 'medium';
    return 'low';
  }
  
  /**
   * Assesses conversation complexity
   * @returns {string} - Complexity level
   * @private
   */
  _assessConversationComplexity() {
    const avgWords = this._calculateAverageWords();
    const topicCount = this.metadata.topics.size;
    
    if (avgWords > 100 && topicCount > 3) return 'high';
    if (avgWords > 50 || topicCount > 2) return 'medium';
    return 'low';
  }
  
  /**
   * Generates context-based recommendations
   * @param {string} pattern - Conversation pattern
   * @param {string} engagement - Engagement level
   * @returns {Array} - Recommendations
   * @private
   */
  _generateContextRecommendations(pattern, engagement) {
    const recommendations = [];
    
    if (engagement === 'low') {
      recommendations.push('Consider more engaging responses to increase interaction');
    }
    
    if (pattern === 'detailed_discussion') {
      recommendations.push('User prefers detailed explanations');
    } else if (pattern === 'quick_questions') {
      recommendations.push('User prefers concise, direct answers');
    }
    
    if (this.metadata.topics.size > 5) {
      recommendations.push('Conversation covers multiple topics, consider summarizing');
    }
    
    return recommendations;
  }
}

module.exports = EnhancedConversationContext;
module.exports.EnhancedConversationContext = EnhancedConversationContext;
module.exports.default = EnhancedConversationContext;