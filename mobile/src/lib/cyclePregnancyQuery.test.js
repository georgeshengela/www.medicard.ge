import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREGNANCY_FETCH_ERROR,
  PREGNANCY_FETCH_IDLE,
  PREGNANCY_FETCH_LOADING,
  PREGNANCY_FETCH_READY,
  applyPregnancyFailure,
  applyPregnancySuccess,
  beginPregnancyFetch,
  emptyPregnancyQueryState,
  pregnancyEmptyCopyAllowed,
  pregnancyQueryPending,
  scopePregnancyQueryToUser,
  shouldFetchCyclePregnancy,
  stopPregnancyQuery,
} from './cyclePregnancyQuery.js';

describe('Pregnancy query enablement', () => {
  it('does not fetch before auth is hydrated even if a user id exists', () => {
    assert.equal(
      shouldFetchCyclePregnancy({
        authReady: false,
        authenticated: true,
        mode: 'PREGNANCY',
      }),
      false,
    );
  });

  it('fetches when hydrated, authenticated, PREGNANCY, and reachable', () => {
    assert.equal(
      shouldFetchCyclePregnancy({
        authReady: true,
        authenticated: true,
        mode: 'PREGNANCY',
        reachable: true,
      }),
      true,
    );
  });

  it('does not fetch TRACK_PERIOD, TTC, or PERIMENOPAUSE', () => {
    assert.equal(
      shouldFetchCyclePregnancy({
        authReady: true,
        authenticated: true,
        mode: 'TRACK_PERIOD',
      }),
      false,
    );
    assert.equal(
      shouldFetchCyclePregnancy({
        authReady: true,
        authenticated: true,
        mode: 'TRY_TO_CONCEIVE',
      }),
      false,
    );
    assert.equal(
      shouldFetchCyclePregnancy({
        authReady: true,
        authenticated: true,
        mode: 'PERIMENOPAUSE',
      }),
      false,
    );
  });

  it('does not fetch logged-out or offline', () => {
    assert.equal(
      shouldFetchCyclePregnancy({
        authReady: true,
        authenticated: false,
        mode: 'PREGNANCY',
      }),
      false,
    );
    assert.equal(
      shouldFetchCyclePregnancy({
        authReady: true,
        authenticated: true,
        mode: 'PREGNANCY',
        reachable: false,
      }),
      false,
    );
  });
});

describe('Pregnancy empty vs pending vs error', () => {
  it('forbids empty copy until a successful pregnancy response', () => {
    assert.equal(pregnancyEmptyCopyAllowed(PREGNANCY_FETCH_IDLE), false);
    assert.equal(pregnancyEmptyCopyAllowed(PREGNANCY_FETCH_LOADING), false);
    assert.equal(pregnancyEmptyCopyAllowed(PREGNANCY_FETCH_ERROR), false);
    assert.equal(pregnancyEmptyCopyAllowed(PREGNANCY_FETCH_READY), true);
    assert.equal(pregnancyQueryPending(PREGNANCY_FETCH_IDLE), true);
    assert.equal(pregnancyQueryPending(PREGNANCY_FETCH_LOADING), true);
  });

  it('does not convert a 401 into an empty pregnancy payload', () => {
    const loading = beginPregnancyFetch(emptyPregnancyQueryState('u1'), { userId: 'u1' });
    const failed = applyPregnancyFailure(loading, {
      error: { status: 401 },
      userId: 'u1',
    });
    assert.equal(failed.status, PREGNANCY_FETCH_ERROR);
    assert.equal(failed.errorKind, 'auth');
    assert.equal(failed.data, null);
    assert.equal(pregnancyEmptyCopyAllowed(failed.status), false);
  });

  it('keeps previous pregnancy data on a later network error', () => {
    const ready = applyPregnancySuccess(emptyPregnancyQueryState('u1'), {
      payload: { estimatedGestationalAge: { week: 8, day: 3 } },
      userId: 'u1',
    });
    const failed = applyPregnancyFailure(ready, {
      error: { status: 0 },
      userId: 'u1',
    });
    assert.equal(failed.errorKind, 'network');
    assert.equal(failed.data.estimatedGestationalAge.week, 8);
  });

  it('clears pregnancy data on user switch and logout', () => {
    const ready = applyPregnancySuccess(emptyPregnancyQueryState('u1'), {
      payload: { episode: { id: 'ep-a' } },
      userId: 'u1',
    });
    const switched = scopePregnancyQueryToUser(ready, 'u2');
    assert.equal(switched.data, null);
    assert.equal(switched.userId, 'u2');
    const loggedOut = stopPregnancyQuery(ready);
    assert.equal(loggedOut.data, null);
  });
});
