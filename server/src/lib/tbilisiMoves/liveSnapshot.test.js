import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TBILISI_MOVES_LIVE_EVENT, notifyTbilisiMovesLive } from './liveSnapshot.js';

describe('tbilisiMoves live snapshot', () => {
  it('uses a dedicated admin socket event', () => {
    assert.equal(TBILISI_MOVES_LIVE_EVENT, 'tbilisi-moves:live');
  });

  it('notify does not throw without a socket server', () => {
    assert.doesNotThrow(() => notifyTbilisiMovesLive());
  });
});
