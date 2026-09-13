import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiTrafficKey,
  authWriteKey,
  clientIp,
  isAuthWriteRequest,
  rateLimitPublicMessage,
} from './rateLimitKey.js';

const JWT_A =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload-aaa.signature-aaa-aaaaaaaaaaaa';
const JWT_B =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload-bbb.signature-bbb-bbbbbbbbbbbb';

describe('rateLimitKey', () => {
  it('does not put two authenticated users in the same API bucket even when JWT headers match', () => {
    const a = apiTrafficKey({
      headers: { authorization: `Bearer ${JWT_A}` },
      ip: '1.1.1.1',
    });
    const b = apiTrafficKey({
      headers: { authorization: `Bearer ${JWT_B}` },
      ip: '1.1.1.1',
    });
    assert.notEqual(a, b);
    assert.match(a, /^user:/);
    assert.equal(a.includes('eyJhbGciOi'), false);
  });

  it('does not use the shared JWT header prefix as the bucket', () => {
    const key = apiTrafficKey({
      headers: { authorization: `Bearer ${JWT_A}` },
      ip: '8.8.8.8',
    });
    assert.equal(key.startsWith('user:eyJ'), false);
    assert.equal(key.length > 10, true);
  });

  it('keeps guests on IP so two home Wi-Fi phones still share only the guest bucket', () => {
    const req = { headers: {}, ip: '10.0.0.8', socket: { remoteAddress: '10.0.0.8' } };
    assert.equal(apiTrafficKey(req), 'ip:10.0.0.8');
    assert.equal(authWriteKey(req), 'auth:10.0.0.8');
  });

  it('strips IPv4-mapped IPv6', () => {
    assert.equal(clientIp({ ip: '::ffff:192.168.1.10' }), '192.168.1.10');
  });

  it('treats register/login/otp writes as auth-write and leaves ordinary reads out', () => {
    assert.equal(isAuthWriteRequest({ method: 'POST', originalUrl: '/api/auth/register' }), true);
    assert.equal(isAuthWriteRequest({ method: 'POST', originalUrl: '/api/auth/login' }), true);
    assert.equal(isAuthWriteRequest({ method: 'POST', originalUrl: '/api/auth/phone/start' }), true);
    assert.equal(isAuthWriteRequest({ method: 'GET', originalUrl: '/api/auth/me' }), false);
    assert.equal(isAuthWriteRequest({ method: 'GET', originalUrl: '/api/admin/stats' }), false);
    assert.equal(isAuthWriteRequest({ method: 'PUT', originalUrl: '/api/health-profile' }), false);
  });

  it('does not hard-code a one-minute wait in the public error', () => {
    assert.match(rateLimitPublicMessage(12).error, /12 წამს/);
    assert.equal(rateLimitPublicMessage(12).error.includes('ერთ წუთს'), false);
    assert.equal(rateLimitPublicMessage(12).code, 'RATE_LIMITED');
  });
});
