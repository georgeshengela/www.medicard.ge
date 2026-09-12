import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { privateFileFilename, privateFileRequestPath, privateFileImageSource } from './privateFile.js';

const FILE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';

describe('privateFile client mapping', () => {
  it('maps stored /uploads keys to /api/files with a Bearer header', () => {
    assert.equal(privateFileFilename(`/uploads/${FILE}`), FILE);
    assert.equal(privateFileRequestPath(`/uploads/${FILE}`), `/api/files/${FILE}`);
    const source = privateFileImageSource(`/uploads/${FILE}`, 'tok', 'https://medicard.ge');
    assert.deepEqual(source, {
      uri: `https://medicard.ge/api/files/${FILE}`,
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('does not send pharmacy/CDN URLs through the private file route', () => {
    assert.equal(privateFileFilename('https://cdn.example/pill.png'), null);
    assert.equal(privateFileImageSource(`/uploads/${FILE}`, null, 'https://medicard.ge'), null);
  });
});
