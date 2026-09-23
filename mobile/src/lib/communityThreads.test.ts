import test from 'node:test';
import assert from 'node:assert/strict';
import { communityThreads } from './communityThreads.ts';

test('replies follow their parent and are chronological even on newest-first pages', () => {
  const rows = [
    { id: 'new', parentId: 'parent', createdAt: '2026-09-24T12:00:00Z' },
    { id: 'old', parentId: 'parent', createdAt: '2026-09-24T11:00:00Z' },
    { id: 'parent', parentId: null, createdAt: '2026-09-24T10:00:00Z' },
  ];
  assert.deepEqual(communityThreads(rows).map(r => [r.item.id, r.depth]), [['parent', 0], ['old', 1], ['new', 1]]);
});
test('missing parents and cycles preserve each comment exactly once', () => {
  const rows = [{ id: 'a', parentId: 'b', createdAt: '' }, { id: 'b', parentId: 'a', createdAt: '' }, { id: 'c', parentId: 'missing', createdAt: '' }];
  assert.equal(new Set(communityThreads(rows).map(r => r.item.id)).size, 3);
});
