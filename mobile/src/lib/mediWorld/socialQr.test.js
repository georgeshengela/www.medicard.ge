'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const {
  buildSocialFriendQrPayload,
  parseSocialFriendQrPayload,
} = require('./socialQr.js');

const CODE = 'ABCDE-FGHJK';

describe('Social friend-code QR payload', () => {
  it('builds a Medicard deep link and independently encodes then decodes it', async () => {
    const payload = buildSocialFriendQrPayload(CODE);
    assert.equal(payload, 'medicard://medi-world/social/add?code=ABCDE-FGHJK');
    const png = await QRCode.toBuffer(payload, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 256,
      color: { dark: '#111827', light: '#FFFFFF' },
    });
    const image = PNG.sync.read(png);
    const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
    assert.ok(decoded);
    assert.equal(decoded.data, payload);
    assert.deepEqual(parseSocialFriendQrPayload(decoded.data), {
      ok: true,
      code: CODE,
      payload,
    });
  });

  it('normalizes lowercase input and rejects tokens, missing codes, and malformed payloads', () => {
    assert.equal(parseSocialFriendQrPayload('medicard://medi-world/social/add?code=abcde-fghjk').code, CODE);
    assert.equal(parseSocialFriendQrPayload('medicard://medi-world/social/add?code=ABCDE-FGHJK&token=secret').ok, false);
    assert.equal(parseSocialFriendQrPayload('medicard://medi-world/social/add').reason, 'missing');
    assert.equal(parseSocialFriendQrPayload('https://example.com/?code=ABCDE-FGHJK').ok, false);
    assert.equal(parseSocialFriendQrPayload('').reason, 'missing');
    assert.equal(buildSocialFriendQrPayload('not-a-code'), null);
  });
});
