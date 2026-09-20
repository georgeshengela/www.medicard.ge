import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPatientProfile } from './patient.js';

test('profile block is the account holder, not the person in this message', () => {
  const block = buildPatientProfile({
    fullName: 'გიორგი ბერიძე',
    gender: 'MALE',
    birthDate: '1996-01-15',
  });
  assert.match(block, /ანგარიშის მფლობელის პროფილი/);
  assert.doesNotMatch(block, /გიორგი|ბერიძე|1996-01-15/);
  assert.match(block, /ასაკი:/);
  assert.match(block, /ბავშვზე, შვილზე/);
  assert.doesNotMatch(block, /პაციენტის სქესი და ასაკი ნორმის საზღვრების/);
});
