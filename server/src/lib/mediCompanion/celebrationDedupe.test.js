import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/** Mirrors mobile/src/lib/companion/journeyCelebration.ts dedupe rules. */
function createDedupe() {
  const seen = new Set();
  let pending = [];
  let timer = null;
  const listeners = new Set();

  function identity(key, at) {
    return `${key}:${at || 'na'}`;
  }

  function mark(key, at) {
    const id = identity(key, at);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }

  function present(keys, at) {
    const fresh = keys.filter((k) => mark(k, at));
    if (!fresh.length) return;
    pending.push(...fresh);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const batch = [...new Set(pending)];
      pending = [];
      timer = null;
      listeners.forEach((fn) => fn({ count: batch.length, keys: batch }));
    }, 20);
  }

  return {
    mark,
    present,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    flush() {
      return new Promise((r) => setTimeout(r, 40));
    },
  };
}

describe('phase 9.1 multi-unlock dedupe', () => {
  it('aggregates and ignores socket echoes of the same keys', async () => {
    const d = createDedupe();
    const seen = [];
    d.subscribe((p) => seen.push(p));
    d.present(['MILESTONE_01', 'MILESTONE_02', 'MILESTONE_03'], 't1');
    d.present(['MILESTONE_01'], 't1'); // echo
    d.present(['MILESTONE_02'], 't1'); // echo
    await d.flush();
    assert.equal(seen.length, 1);
    assert.equal(seen[0].count, 3);
    assert.deepEqual(seen[0].keys.sort(), ['MILESTONE_01', 'MILESTONE_02', 'MILESTONE_03']);
  });

  it('mark returns false for duplicates', () => {
    const d = createDedupe();
    assert.equal(d.mark('M1', 'a'), true);
    assert.equal(d.mark('M1', 'a'), false);
    assert.equal(d.mark('M1', 'b'), true);
  });
});
