'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { getWorldLocale, setWorldLocale } = require('./worldLocale.js');

describe('Medi World locale store', () => {
  beforeEach(() => {
    setWorldLocale('ka');
  });

  it('defaults to Georgian and ignores unknown values', () => {
    assert.equal(getWorldLocale(), 'ka');
    setWorldLocale('en');
    assert.equal(getWorldLocale(), 'en');
    setWorldLocale('fr');
    assert.equal(getWorldLocale(), 'ka');
  });
});
