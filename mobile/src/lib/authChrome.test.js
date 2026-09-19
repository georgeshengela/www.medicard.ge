import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_KEYBOARD_OPEN_PX,
  AUTH_SCREEN_GUTTER,
  authFooterBottomPad,
  authScrollTopPad,
} from './authChrome.js';

describe('auth chrome keyboard gutters', () => {
  it('uses the same gutter below the status bar and above the IME', () => {
    const top = authScrollTopPad(59);
    const bottom = authFooterBottomPad(320, 34);
    assert.equal(top, 59 + AUTH_SCREEN_GUTTER);
    assert.equal(bottom, 320 + AUTH_SCREEN_GUTTER);
    assert.equal(top - 59, bottom - 320);
  });

  it('keeps the home indicator only when the keyboard is closed', () => {
    assert.equal(authFooterBottomPad(0, 34), 34 + AUTH_SCREEN_GUTTER);
    assert.equal(authFooterBottomPad(AUTH_KEYBOARD_OPEN_PX, 34), 34 + AUTH_SCREEN_GUTTER);
    assert.equal(authFooterBottomPad(AUTH_KEYBOARD_OPEN_PX + 1, 34), AUTH_KEYBOARD_OPEN_PX + 1 + AUTH_SCREEN_GUTTER);
  });
});
