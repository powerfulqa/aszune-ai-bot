describe('Message flow', () => {
  it('adds user and assistant messages to conversationHistory', () => {
    const conversationHistory = {};
    const userId = '123';
    const userMsg = 'Hello!';
    const botReply = 'Hi there! 👋';

    if (!conversationHistory[userId]) {
      conversationHistory[userId] = [];
    }

    conversationHistory[userId].push({ role: 'user', content: userMsg });
    conversationHistory[userId].push({ role: 'assistant', content: botReply });

    expect(conversationHistory[userId].length).toBe(2);
    expect(conversationHistory[userId][0]).toEqual({ role: 'user', content: userMsg });
    expect(conversationHistory[userId][1]).toEqual({ role: 'assistant', content: botReply });
  });
});
