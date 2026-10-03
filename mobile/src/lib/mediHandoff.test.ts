import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MEDI_HANDOFF_PARAM,
  MEDI_HANDOFF_TTL_MS,
  MEDI_PREFILL_MAX,
  clearMediHandoff,
  mediPrefillRoute,
  stageMediPrefill,
  takeMediPrefill,
} from './mediHandoff.ts';

const ALERT = 'მენსტრუაცია 5 დღით აგვიანდება. ესაუბრე ექიმს.';

function query(route: string): URLSearchParams {
  assert.ok(route.startsWith('/assistant'), route);
  return new URLSearchParams(route.includes('?') ? route.slice(route.indexOf('?') + 1) : '');
}

describe('Medi hand-off — drafted question (W2-8b)', () => {
  it('is taken once by the account that staged it', () => {
    clearMediHandoff();
    assert.equal(stageMediPrefill('u1', ALERT, 1000), true);
    assert.equal(takeMediPrefill('u1', 1500), ALERT);
    assert.equal(takeMediPrefill('u1', 1600), null);
  });

  it('another account finds nothing and the draft is gone for the owner too', () => {
    stageMediPrefill('u1', ALERT, 0);
    assert.equal(takeMediPrefill('u2', 10), null);
    assert.equal(takeMediPrefill('u1', 20), null);
    stageMediPrefill('u1', ALERT, 0);
    assert.equal(takeMediPrefill(null, 10), null);
    assert.equal(takeMediPrefill('u1', 20), null);
  });

  it('expires after one minute', () => {
    stageMediPrefill('u1', ALERT, 0);
    assert.equal(takeMediPrefill('u1', MEDI_HANDOFF_TTL_MS + 1), null);
    stageMediPrefill('u1', ALERT, 0);
    assert.equal(takeMediPrefill('u1', MEDI_HANDOFF_TTL_MS), ALERT);
  });

  it('a new stage replaces the old one; empty text or no account clears it', () => {
    stageMediPrefill('u1', 'პირველი', 0);
    stageMediPrefill('u1', 'მეორე', 1);
    assert.equal(takeMediPrefill('u1', 2), 'მეორე');
    stageMediPrefill('u1', ALERT, 0);
    assert.equal(stageMediPrefill('u1', '   ', 1), false);
    assert.equal(takeMediPrefill('u1', 2), null);
    stageMediPrefill('u1', ALERT, 0);
    assert.equal(stageMediPrefill(null, ALERT, 1), false);
    assert.equal(takeMediPrefill('u1', 2), null);
  });

  it('trims and caps the draft', () => {
    stageMediPrefill('u1', `  ${'ა'.repeat(MEDI_PREFILL_MAX + 50)}  `, 0);
    assert.equal(takeMediPrefill('u1', 1)?.length, MEDI_PREFILL_MAX);
  });

  it('clearMediHandoff drops the draft', () => {
    stageMediPrefill('u1', ALERT, 0);
    clearMediHandoff();
    assert.equal(takeMediPrefill('u1', 1), null);
  });
});

describe('mediPrefillRoute — the route never carries the text', () => {
  it('stages the text and returns /assistant?mode=doctor&handoff=1', () => {
    clearMediHandoff();
    const route = mediPrefillRoute('u1', ALERT, 'doctor', 0);
    const q = query(route);
    assert.equal(q.get('mode'), 'doctor');
    assert.equal(q.get(MEDI_HANDOFF_PARAM), '1');
    assert.deepEqual([...q.keys()].sort(), ['handoff', 'mode']);
    assert.ok(!decodeURIComponent(route).includes('აგვიანდება'), route);
    assert.equal(takeMediPrefill('u1', 1), ALERT);
  });

  it('deep mode keeps its mode', () => {
    assert.equal(query(mediPrefillRoute('u1', ALERT, 'deep', 0)).get('mode'), 'deep');
    clearMediHandoff();
  });

  it('without an account or text: the plain mode route, no marker, nothing staged', () => {
    assert.equal(mediPrefillRoute(null, ALERT, 'doctor', 0), '/assistant?mode=doctor');
    assert.equal(mediPrefillRoute('u1', '', 'doctor', 0), '/assistant?mode=doctor');
    assert.equal(mediPrefillRoute('u1', null, 'doctor', 0), '/assistant?mode=doctor');
    assert.equal(takeMediPrefill('u1', 1), null);
  });
});
