import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { goToGoalStarted, openWeightGoalWizard, startWeightGoalWizard } from './weightNav.ts';

function fakeRouter() {
  const calls: string[] = [];
  return {
    calls,
    push: (href: string) => calls.push('push ' + href),
    replace: (href: string) => calls.push('replace ' + href),
    dismissTo: (href: string) => calls.push('dismissTo ' + href),
  };
}

describe('one weight goal wizard', () => {
  it('returns to the feature that opened it after the goal is saved', () => {
    const r = fakeRouter();
    openWeightGoalWizard(r as never, '/nutrition/goal');
    assert.deepEqual(r.calls, ['push /health-metrics/weight/goal/target']);
    goToGoalStarted(r as never);
    assert.equal(r.calls.at(-1), 'dismissTo /nutrition/goal');
  });

  it('the return is used once; a normal save still lands on the goal progress page', () => {
    const r = fakeRouter();
    goToGoalStarted(r as never);
    assert.ok(r.calls.includes('push /health-metrics/weight/goal'));
    assert.ok(!r.calls.some((c) => c.includes('/nutrition/goal')));
  });

  it('an abandoned wizard does not hijack a later save from the weight hub', () => {
    const r = fakeRouter();
    openWeightGoalWizard(r as never, '/nutrition/goal');
    startWeightGoalWizard(r as never); // person backed out, later started from the hub
    goToGoalStarted(r as never);
    assert.ok(!r.calls.some((c) => c.includes('/nutrition/goal')));
  });

  it('the return point expires', () => {
    openWeightGoalWizard(fakeRouter() as never, '/nutrition/goal', Date.now() - 31 * 60 * 1000);
    const r = fakeRouter();
    goToGoalStarted(r as never);
    assert.ok(!r.calls.some((c) => c.includes('/nutrition/goal')));
  });
});
