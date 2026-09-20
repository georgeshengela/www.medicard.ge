import assert from 'node:assert/strict';
import test from 'node:test';
import { petFocusScrollOffset, petKeyboardOverlap } from './petKeyboardLayout.ts';

test('iPhone: different native header heights leave the footer at the same keyboard edge', () => {
  // iPhone 15 Pro Max, including safe area and a 336pt software keyboard.
  for (const header of [0, 103, 115, 159]) {
    const height = 932 - header;
    const inset = petKeyboardOverlap(header, height, 596);
    assert.equal(inset, 336);
    assert.equal(header + height - inset, 596);
  }
});

test('containers ending above the home indicator only subtract actual overlap', () => {
  assert.equal(petKeyboardOverlap(103, 795, 596), 302);
});

test('a closed keyboard and an already resized window never reserve a second empty area', () => {
  assert.equal(petKeyboardOverlap(103, 829, null), 0);
  assert.equal(petKeyboardOverlap(103, 829, 932), 0);
  assert.equal(petKeyboardOverlap(80, 400, 480), 0);
  assert.equal(petKeyboardOverlap(80, 300, 480), 0);
});

test('taller keyboards move the footer without depending on a fixed keyboard size', () => {
  assert.equal(petKeyboardOverlap(103, 829, 562), 370);
  assert.equal(petKeyboardOverlap(103, 829, 630), 302);
});

test('name input hidden below actions scrolls fully into the reduced viewport', () => {
  const next = petFocusScrollOffset(0, 103, 330, 430, 44);
  assert.equal(next, 57);
  assert.equal(430 + 44 - next, 103 + 330 - 16);
});

test('moving between inputs preserves scroll position when the field and label already fit', () => {
  assert.equal(petFocusScrollOffset(180, 103, 330, 170, 44), 180);
});

test('switching back to a field above the viewport reveals its label without negative scrolling', () => {
  assert.equal(petFocusScrollOffset(200, 103, 330, 80, 44), 141);
  assert.equal(petFocusScrollOffset(0, 103, 330, 110, 44), 0);
});

test('a tall notes field aligns at the top instead of repeatedly jumping between its ends', () => {
  const next = petFocusScrollOffset(0, 103, 200, 200, 260);
  assert.equal(next, 61);
  assert.equal(petFocusScrollOffset(next, 103, 200, 139, 260), next);
  assert.equal(petFocusScrollOffset(70, 103, 0, 200, 44), 70);
});
