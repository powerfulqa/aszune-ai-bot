const { chunkMessage } = require('../../src/utils/message-chunking');

describe('chunkMessage keeps links and numbers intact', () => {
  it('does not strip the dot from bare-domain source links', () => {
    const text =
      'Cults everywhere [1][2].\n\n*Sources: [1] [updatecrazy.com](https://updatecrazy.com/x) · ' +
      '[2] [steamcommunity.com](https://steamcommunity.com/sharedfiles/filedetails/?id=3031244234)*';
    const out = chunkMessage(text).join('\n');
    expect(out).toContain('(https://updatecrazy.com/x)');
    expect(out).toContain('(https://steamcommunity.com/sharedfiles/filedetails/?id=3031244234)');
  });

  it('does not put a space inside version numbers', () => {
    const out = chunkMessage('Hotfix 9.0.2 replaced patch 8.1 on 30 September.').join('\n');
    expect(out).toContain('Hotfix 9.0.2 replaced patch 8.1 on 30 September.');
  });
});
