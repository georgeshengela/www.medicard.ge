import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPasswordStrongEnough, scorePassword } from './passwordStrength.ts';

describe('isPasswordStrongEnough', () => {
  it('accepts ordinary 8+ character passwords the server accepts', () => {
    for (const password of ['nino1990', 'giorgi123', 'abcdefgh', '12345678', 'tbilisi2026']) {
      assert.equal(isPasswordStrongEnough(password), true, password);
    }
  });
  it('rejects only passwords shorter than 8 characters', () => {
    for (const password of ['', 'a', 'nino199', 'Ab1!xyz']) {
      assert.equal(isPasswordStrongEnough(password), false, password);
    }
  });
  it('never blocks a password the meter calls weak', () => {
    assert.equal(scorePassword('nino1990').level, 'weak');
    assert.equal(isPasswordStrongEnough('nino1990'), true);
  });
});

describe('scorePassword', () => {
  it('stays advice: longer and mixed passwords score higher', () => {
    assert.equal(scorePassword('').level, 'empty');
    assert.equal(scorePassword('nino1990').level, 'weak');
    assert.equal(scorePassword('Nino1990').level, 'fair');
    assert.equal(scorePassword('Nino1990!tbilisi').level, 'strong');
  });
});
