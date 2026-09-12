import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiTrafficKey, authWriteKey, clientIp } from './rateLimitKey.js';

describe('rateLimitKey', () => {
  it('does not put two authenticated users in the same API bucket', () => {
    const a = apiTrafficKey({
      headers: { authorization: 'Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      ip: '1.1.1.1',
    });
    const b = apiTrafficKey({
      headers: { authorization: 'Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ip: '1.1.1.1',
    });
    assert.notEqual(a, b);
    assert.match(a, /^user:/);
  });

  it('keeps guests on IP so two home Wi-Fi phones still share only the guest bucket', () => {
    const req = { headers: {}, ip: '10.0.0.8', socket: { remoteAddress: '10.0.0.8' } };
    assert.equal(apiTrafficKey(req), 'ip:10.0.0.8');
    assert.equal(authWriteKey(req), 'auth:10.0.0.8');
  });

  it('strips IPv4-mapped IPv6', () => {
    assert.equal(clientIp({ ip: '::ffff:192.168.1.10' }), '192.168.1.10');
  });
});
