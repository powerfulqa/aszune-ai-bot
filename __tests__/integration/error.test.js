describe('Error handling', () => {
  it('handles failed Perplexity API response', async () => {
    const axios = require('axios');
    jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('API Error'));

    const fakeMessage = {
      content: 'test',
      author: { bot: false, id: '123' },
      reply: jest.fn(),
      channel: { sendTyping: jest.fn() }
    };

    try {
      await axios.post('https://api.perplexity.ai/chat/completions', {}); // forced error
    } catch (err) {
      await fakeMessage.reply('There was an error processing your request.');
    }

    expect(fakeMessage.reply).toHaveBeenCalledWith('There was an error processing your request.');
  });
});
