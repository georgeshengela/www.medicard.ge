import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  POSTPARTUM_FETCH_ERROR,
  POSTPARTUM_FETCH_IDLE,
  POSTPARTUM_FETCH_LOADING,
  POSTPARTUM_FETCH_READY,
  applyPostpartumFailure,
  applyPostpartumSuccess,
  beginPostpartumFetch,
  emptyPostpartumQueryState,
  postpartumEmptyCopyAllowed,
  postpartumQueryPending,
  scopePostpartumQueryToUser,
  shouldFetchCyclePostpartum,
  stopPostpartumQuery,
} from './cyclePostpartumQuery.js';

describe('Postpartum query enablement', () => {
  it('does not fetch before auth is hydrated', () => {
    assert.equal(
      shouldFetchCyclePostpartum({
        authReady: false,
        authenticated: true,
        mode: 'POSTPARTUM',
      }),
      false,
    );
  });

  it('fetches when hydrated, authenticated, POSTPARTUM, and reachable', () => {
    assert.equal(
      shouldFetchCyclePostpartum({
        authReady: true,
        authenticated: true,
        mode: 'POSTPARTUM',
        reachable: true,
      }),
      true,
    );
  });

  it('does not fetch TRACK / TTC / Pregnancy / Peri', () => {
    for (const mode of ['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PREGNANCY', 'PERIMENOPAUSE']) {
      assert.equal(
        shouldFetchCyclePostpartum({
          authReady: true,
          authenticated: true,
          mode,
        }),
        false,
        mode,
      );
    }
  });

  it('401 is not treated as empty', () => {
    const next = applyPostpartumFailure(emptyPostpartumQueryState('u1'), {
      error: { status: 401 },
      userId: 'u1',
    });
    assert.equal(next.status, POSTPARTUM_FETCH_ERROR);
    assert.equal(next.errorKind, 'auth');
    assert.equal(postpartumEmptyCopyAllowed(next.status), false);
    assert.equal(postpartumQueryPending(POSTPARTUM_FETCH_IDLE), true);
    assert.equal(postpartumQueryPending(POSTPARTUM_FETCH_LOADING), true);
    assert.equal(postpartumQueryPending(POSTPARTUM_FETCH_READY), false);
  });

  it('cross-user scope drops the previous user payload', () => {
    const prev = applyPostpartumSuccess(emptyPostpartumQueryState('a'), {
      payload: { active: true },
      userId: 'a',
    });
    const scoped = scopePostpartumQueryToUser(prev, 'b');
    assert.equal(scoped.userId, 'b');
    assert.equal(scoped.data, null);
    assert.equal(stopPostpartumQuery(prev).data, null);
    assert.equal(beginPostpartumFetch(prev, { userId: 'b' }).data, null);
  });
});
