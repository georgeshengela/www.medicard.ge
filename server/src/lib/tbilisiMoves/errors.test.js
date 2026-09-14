import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isTbilisiMovesSchemaMissing } from './errors.js';

describe('tbilisi moves schema missing detection', () => {
  it('treats Phase 4 column P2022 as unavailable even without TbilisiMoves in the message', () => {
    assert.equal(
      isTbilisiMovesSchemaMissing({
        code: 'P2022',
        meta: { column: 'leaderRecognitionEnabled' },
        message: 'The column `leaderRecognitionEnabled` does not exist in the current database.',
      }),
      true,
    );
    assert.equal(
      isTbilisiMovesSchemaMissing({
        code: 'P2022',
        meta: { modelName: 'TbilisiMovesConfig', column: 'leaderRewardedRanks' },
        message: 'The column `leaderRewardedRanks` does not exist in the current database.',
      }),
      true,
    );
    assert.equal(
      isTbilisiMovesSchemaMissing({
        code: 'P2021',
        meta: { modelName: 'TbilisiMovesResultRevision', table: 'TbilisiMovesResultRevision' },
        message: 'The table `public.TbilisiMovesResultRevision` does not exist in the current database.',
      }),
      true,
    );
  });

  it('does not treat unrelated missing tables as Tbilisi Moves schema gaps', () => {
    assert.equal(
      isTbilisiMovesSchemaMissing({
        code: 'P2021',
        meta: { modelName: 'Pet', table: 'Pet' },
        message: 'The table `public.Pet` does not exist in the current database.',
      }),
      false,
    );
  });
});
