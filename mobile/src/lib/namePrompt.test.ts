import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { namePromptDue } from './namePrompt.ts';

describe('namePromptDue', () => {
  const done = { completedAt: '2026-10-01T10:00:00Z', extraAnswers: {} };

  it('asks an older account without a first and last name', () => {
    assert.equal(namePromptDue({ fullName: 'Medicard მომხმარებელი' }, done), true);
    assert.equal(namePromptDue({ fullName: 'გიორგი' }, done), true);
  });

  it('never asks twice, never someone with a full name, never during registration', () => {
    assert.equal(namePromptDue({ fullName: 'გიორგი' }, { ...done, extraAnswers: { namePromptAt: '2026-10-11T18:00:00Z' } }), false);
    assert.equal(namePromptDue({ fullName: 'გიორგი მაისურაძე' }, done), false);
    assert.equal(namePromptDue({ fullName: 'Medicard მომხმარებელი' }, { ...done, extraAnswers: { legalName: 'ნინო ბერიძე' } }), false);
    assert.equal(namePromptDue({ fullName: 'Medicard მომხმარებელი' }, { completedAt: null, extraAnswers: {} }), false);
    assert.equal(namePromptDue(null, done), false);
  });
});
