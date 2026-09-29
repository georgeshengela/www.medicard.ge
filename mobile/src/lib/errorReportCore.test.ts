import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createErrorQueue, scrubRoute, scrubText, toErrorEvent } from './errorReportCore.ts';

describe('error report scrubbing', () => {
  it('removes emails, numbers, tokens and ids', () => {
    const out = scrubText('user nino@gmail.com phone +995 555 12 34 56 jwt eyJhbGc.eyJzdWIi.sig id 3f2b8c1e-1234-4abc-9def-0123456789ab');
    assert.doesNotMatch(out, /gmail|555|eyJ|3f2b8c1e/);
    assert.match(out, /\[email\].*\[num\].*\[token\].*:id/);
  });
  it('strips ids and query from routes', () => {
    assert.equal(scrubRoute('pets/ckz9x2abcdefghij0123456789/chat?x=1'), 'pets/:id/chat');
    assert.equal(scrubRoute('cycle/log'), 'cycle/log');
  });
  it('builds a bounded event from any thrown value', () => {
    const long = new Error('word '.repeat(200));
    const e = toErrorEvent('error', long, { now: 0 });
    assert.equal(e.message.length, 300);
    assert.equal(toErrorEvent('unhandled_rejection', 'plain string').message, 'plain string');
    assert.equal(toErrorEvent('crash', new TypeError('boom'), { fatal: true }).name, 'TypeError');
  });
});

describe('error queue', () => {
  it('sends a looping error once per window and stays bounded', () => {
    let t = 0;
    const q = createErrorQueue({ maxQueue: 3, repeatWindowMs: 1000, now: () => t });
    const ev = toErrorEvent('error', new Error('same 1'));
    assert.equal(q.add(ev), true);
    assert.equal(q.add(toErrorEvent('error', new Error('same 2'))), false); // digits normalized
    t = 1001;
    assert.equal(q.add(ev), true);
    for (let i = 0; i < 5; i += 1) q.add(toErrorEvent('error', new Error(`other ${'x'.repeat(i)}`)));
    assert.equal(q.size(), 3);
    assert.equal(q.take(2).length, 2);
    assert.equal(q.size(), 1);
  });
});
