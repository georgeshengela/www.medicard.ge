import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { jwtSubject } from './jwtSubject.js';

describe('jwtSubject', () => {
  it('reads sub and ignores a mismatched snapshot identity', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'user-b', email: 'b@x' })).toString('base64url');
    const token = `eyJhbGciOiJub25l.${payload}.sig`;
    assert.equal(jwtSubject(token), 'user-b');
    assert.equal(jwtSubject('not-a-jwt'), null);
    assert.notEqual(jwtSubject(token), 'user-a');
  });
});
