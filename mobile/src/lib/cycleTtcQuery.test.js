import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TTC_FETCH_ERROR,
  TTC_FETCH_IDLE,
  TTC_FETCH_LOADING,
  TTC_FETCH_READY,
  applyTtcFailure,
  applyTtcSuccess,
  beginTtcFetch,
  emptyTtcQueryState,
  scopeTtcQueryToUser,
  shouldFetchCycleTtc,
  stopTtcQuery,
  ttcEmptyCopyAllowed,
  ttcQueryPending,
} from './cycleTtcQuery.js';

describe('TTC query enablement', () => {
  it('does not fetch before auth is hydrated even if a user id exists', () => {
    assert.equal(
      shouldFetchCycleTtc({
        authReady: false,
        authenticated: true,
        mode: 'TRY_TO_CONCEIVE',
      }),
      false,
    );
  });

  it('fetches when hydrated, authenticated, TTC, and reachable', () => {
    assert.equal(
      shouldFetchCycleTtc({
        authReady: true,
        authenticated: true,
        mode: 'TRY_TO_CONCEIVE',
        reachable: true,
      }),
      true,
    );
  });

  it('does not fetch TRACK_PERIOD', () => {
    assert.equal(
      shouldFetchCycleTtc({
        authReady: true,
        authenticated: true,
        mode: 'TRACK_PERIOD',
      }),
      false,
    );
  });

  it('does not fetch PREGNANCY or PERIMENOPAUSE', () => {
    assert.equal(
      shouldFetchCycleTtc({
        authReady: true,
        authenticated: true,
        mode: 'PREGNANCY',
      }),
      false,
    );
    assert.equal(
      shouldFetchCycleTtc({
        authReady: true,
        authenticated: true,
        mode: 'PERIMENOPAUSE',
      }),
      false,
    );
  });

  it('does not fetch logged-out', () => {
    assert.equal(
      shouldFetchCycleTtc({
        authReady: true,
        authenticated: false,
        mode: 'TRY_TO_CONCEIVE',
      }),
      false,
    );
  });

  it('does not fetch while Cycle is unreachable/offline', () => {
    assert.equal(
      shouldFetchCycleTtc({
        authReady: true,
        authenticated: true,
        mode: 'TRY_TO_CONCEIVE',
        reachable: false,
      }),
      false,
    );
  });

  it('enables TTC fetch after TRACK → TTC once server mode is known', () => {
    assert.equal(
      shouldFetchCycleTtc({
        authReady: true,
        authenticated: true,
        mode: 'TRACK_PERIOD',
      }),
      false,
    );
    assert.equal(
      shouldFetchCycleTtc({
        authReady: true,
        authenticated: true,
        mode: 'TRY_TO_CONCEIVE',
      }),
      true,
    );
  });
});

describe('TTC empty vs pending vs error', () => {
  it('forbids empty copy until a successful TTC response', () => {
    assert.equal(ttcEmptyCopyAllowed(TTC_FETCH_IDLE), false);
    assert.equal(ttcEmptyCopyAllowed(TTC_FETCH_LOADING), false);
    assert.equal(ttcEmptyCopyAllowed(TTC_FETCH_ERROR), false);
    assert.equal(ttcEmptyCopyAllowed(TTC_FETCH_READY), true);
    assert.equal(ttcQueryPending(TTC_FETCH_IDLE), true);
    assert.equal(ttcQueryPending(TTC_FETCH_LOADING), true);
    assert.equal(ttcQueryPending(TTC_FETCH_READY), false);
  });

  it('treats a real empty payload as ready, not pending', () => {
    const next = applyTtcSuccess(emptyTtcQueryState('u1'), {
      payload: { timeline: [], bbtHistory: [] },
      userId: 'u1',
    });
    assert.equal(next.status, TTC_FETCH_READY);
    assert.equal(next.data.timeline.length, 0);
    assert.equal(ttcEmptyCopyAllowed(next.status), true);
  });

  it('does not convert a 401 into an empty TTC payload', () => {
    const loading = beginTtcFetch(emptyTtcQueryState('u1'), { userId: 'u1' });
    const failed = applyTtcFailure(loading, {
      error: { status: 401 },
      userId: 'u1',
    });
    assert.equal(failed.status, TTC_FETCH_ERROR);
    assert.equal(failed.errorKind, 'auth');
    assert.equal(failed.data, null);
    assert.equal(ttcEmptyCopyAllowed(failed.status), false);
  });

  it('keeps previous TTC data on a later network error', () => {
    const ready = applyTtcSuccess(emptyTtcQueryState('u1'), {
      payload: { timeline: [{ date: '2026-09-09' }] },
      userId: 'u1',
    });
    const failed = applyTtcFailure(ready, {
      error: { status: 0 },
      userId: 'u1',
    });
    assert.equal(failed.status, TTC_FETCH_ERROR);
    assert.equal(failed.errorKind, 'network');
    assert.equal(failed.data.timeline[0].date, '2026-09-09');
  });
});

describe('TTC generation and isolation', () => {
  it('ignores a stale 401 that finishes after a newer 200', () => {
    const first = beginTtcFetch(emptyTtcQueryState('u1'), {
      generation: 1,
      currentGeneration: 2,
      userId: 'u1',
    });
    assert.equal(first.status, TTC_FETCH_IDLE);
    const ready = applyTtcSuccess(emptyTtcQueryState('u1'), {
      generation: 2,
      currentGeneration: 2,
      payload: { timeline: [{ date: '2026-09-09' }] },
      userId: 'u1',
    });
    const stale = applyTtcFailure(ready, {
      generation: 1,
      currentGeneration: 2,
      error: { status: 401 },
      userId: 'u1',
    });
    assert.equal(stale.status, TTC_FETCH_READY);
    assert.equal(stale.data.timeline.length, 1);
  });

  it('clears user A data when scoping to user B', () => {
    const a = applyTtcSuccess(emptyTtcQueryState('user-a'), {
      payload: { timeline: [{ date: '2026-09-01' }] },
      userId: 'user-a',
    });
    const b = scopeTtcQueryToUser(a, 'user-b');
    assert.equal(b.userId, 'user-b');
    assert.equal(b.data, null);
    assert.equal(b.status, TTC_FETCH_IDLE);
  });

  it('clears TTC data on logout', () => {
    const a = applyTtcSuccess(emptyTtcQueryState('user-a'), {
      payload: { timeline: [{ date: '2026-09-01' }] },
      userId: 'user-a',
    });
    const loggedOut = scopeTtcQueryToUser(a, null);
    assert.equal(loggedOut.data, null);
    assert.equal(loggedOut.userId, null);
  });

  it('does not invent a refresh-token retry loop', () => {
    const failed = applyTtcFailure(emptyTtcQueryState('u1'), {
      error: { status: 401 },
      userId: 'u1',
    });
    assert.equal(failed.errorKind, 'auth');
    assert.equal(shouldFetchCycleTtc({
      authReady: true,
      authenticated: false,
      mode: 'TRY_TO_CONCEIVE',
    }), false);
  });

  it('stops requesting after TTC → TRACK', () => {
    const ready = applyTtcSuccess(emptyTtcQueryState('u1'), {
      payload: { timeline: [] },
      userId: 'u1',
    });
    const stopped = stopTtcQuery(ready);
    assert.equal(stopped.data, null);
    assert.equal(
      shouldFetchCycleTtc({
        authReady: true,
        authenticated: true,
        mode: 'TRACK_PERIOD',
      }),
      false,
    );
  });
});
