import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeExternalHref } from './safeExternalHref.js';

describe('isSafeExternalHref', () => {
  it('allows http and https only', () => {
    assert.equal(isSafeExternalHref('https://pubmed.ncbi.nlm.nih.gov/1'), true);
    assert.equal(isSafeExternalHref('http://example.com/x'), true);
    assert.equal(isSafeExternalHref('HTTPS://example.com'), true);
  });

  it('rejects javascript, data, file, mailto, and relative paths', () => {
    assert.equal(isSafeExternalHref('javascript:alert(1)'), false);
    assert.equal(isSafeExternalHref('data:text/html,hi'), false);
    assert.equal(isSafeExternalHref('file:///etc/passwd'), false);
    assert.equal(isSafeExternalHref('mailto:a@b.c'), false);
    assert.equal(isSafeExternalHref('/privacy'), false);
    assert.equal(isSafeExternalHref(''), false);
    assert.equal(isSafeExternalHref('not a url'), false);
  });
});
