import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { displayGeorgianMobile, formatGeorgianMobile, georgianLocalDigits, isGeorgianMobile, toE164Georgian } from './phoneFormat.ts';

describe('Georgian mobile formatting', () => {
  it('formats as it grows', () => {
    assert.equal(formatGeorgianMobile('5'), '5');
    assert.equal(formatGeorgianMobile('5551'), '555 1');
    assert.equal(formatGeorgianMobile('555123'), '555 12 3');
    assert.equal(formatGeorgianMobile('555123456'), '555 12 34 56');
  });
  it('accepts pasted numbers with country code and punctuation', () => {
    assert.equal(georgianLocalDigits('+995 (555) 12-34-56'), '555123456');
    assert.equal(georgianLocalDigits('995555123456'), '555123456');
    assert.equal(georgianLocalDigits('555 12 34 56 78'), '555123456');
    // Typed one key at a time: +, 9, 9, 5, 5 …
    assert.equal(georgianLocalDigits('9955'), '5');
    assert.equal(georgianLocalDigits('99559912345'), '59912345');
  });
  it('validates and converts', () => {
    assert.equal(isGeorgianMobile('555 12 34 56'), true);
    assert.equal(isGeorgianMobile('455123456'), false);
    assert.equal(isGeorgianMobile('55512345'), false);
    assert.equal(toE164Georgian('555 12 34 56'), '+995555123456');
    assert.equal(displayGeorgianMobile('555123456'), '+995 555 12 34 56');
  });
});
