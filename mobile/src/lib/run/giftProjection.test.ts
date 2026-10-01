import test from 'node:test';
import assert from 'node:assert/strict';
import { projectGift } from './giftProjection.ts';

const W = 390, H = 844;
test('a gift straight ahead sits in the middle column, a little below the centre (it lies on the ground)', () => {
  const p = projectGift({ east: 0, north: 10 }, 0, 90, W, H);
  assert.ok(Math.abs(p.x - W / 2) < 1);
  assert.ok(p.y > H / 2 && p.y < H * 0.7);
  assert.equal(p.visible, true);
});
test('turning the phone moves the gift the other way and finally out of the frame, with the right arrow', () => {
  const right = projectGift({ east: 0, north: 10 }, -15, 90, W, H);     // phone turned left → gift to the right
  assert.ok(right.x > W / 2 && right.visible);
  const away = projectGift({ east: 0, north: 10 }, 90, 90, W, H);       // facing east, gift is to the north (left)
  assert.equal(away.visible, false);
  assert.equal(away.side, 'left');
  assert.equal(projectGift({ east: 0, north: 10 }, -90, 90, W, H).side, 'right');
});
test('looking down at the pavement brings the gift up in the frame', () => {
  const upright = projectGift({ east: 0, north: 6 }, 0, 90, W, H);
  const down = projectGift({ east: 0, north: 6 }, 0, 55, W, H);
  assert.ok(down.y < upright.y);
});
test('closer gifts are bigger; the box never shrinks below a tappable size', () => {
  const near = projectGift({ east: 0, north: 4 }, 0, 90, W, H), far = projectGift({ east: 0, north: 18 }, 0, 90, W, H);
  assert.ok(near.size > far.size);
  assert.ok(far.size >= 70);
});
test('heading wraps across north', () => {
  const p = projectGift({ east: -1, north: 10 }, 355, 90, W, H);          // gift at ~354°, phone at 355°
  assert.ok(p.visible && Math.abs(p.x - W / 2) < 20);
});
