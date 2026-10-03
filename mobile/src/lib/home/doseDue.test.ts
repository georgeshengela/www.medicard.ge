import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueState, minuteOf, spanLabel } from './doseDue.ts';

test('minutes after midnight', () => {
  assert.equal(minuteOf('09:30'), 570);
  assert.equal(minuteOf('00:00'), 0);
});

test('due state: late after half an hour, now within five minutes, else soon', () => {
  assert.deepEqual(dueState(600, 700), { kind: 'late', minutes: 100 });
  assert.deepEqual(dueState(600, 620), { kind: 'now' });
  assert.deepEqual(dueState(600, 597), { kind: 'now' });
  assert.deepEqual(dueState(720, 600), { kind: 'soon', minutes: 120 });
});

test('span labels', () => {
  assert.equal(spanLabel(40, false), '40 წთ');
  assert.equal(spanLabel(135, false), '2 სთ 15 წთ');
  assert.equal(spanLabel(200, true), '3 h');
  assert.equal(spanLabel(120, true), '2 h');
});
