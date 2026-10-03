import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cycleAskMediQuestion, cycleAskMediRoute } from './cycleAskMedi.ts';

describe('ask Medi about the cycle', () => {
  it('opens the doctor consultation with the neutral question prefilled', () => {
    const route = cycleAskMediRoute();
    assert.ok(route.startsWith('/assistant?'), route);
    const params = new URLSearchParams(route.slice(route.indexOf('?') + 1));
    assert.equal(params.get('mode'), 'doctor');
    assert.equal(params.get('prefill'), cycleAskMediQuestion());
    assert.deepEqual([...params.keys()].sort(), ['mode', 'prefill']);
  });

  it('carries no health values: the question is the same fixed sentence for everyone', () => {
    const question = cycleAskMediQuestion();
    assert.equal(question, 'რა ხდება ჩემს ციკლში ახლა?');
    assert.doesNotMatch(question, /\d/);
    assert.equal(cycleAskMediRoute(), cycleAskMediRoute());
  });
});
