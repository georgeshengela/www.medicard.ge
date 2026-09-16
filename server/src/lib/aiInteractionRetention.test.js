import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_PROMPT_REDACTED,
  aiInteractionRetentionPolicy,
  aiInteractionRetentionCutoffs,
  shouldDeleteAiInteraction,
  shouldRedactAiInteraction,
} from './aiInteractionRetention.js';

describe('AiInteraction retention policy', () => {
  it('defaults to 90-day redact and 365-day delete', () => {
    const policy = aiInteractionRetentionPolicy({});
    assert.equal(policy.redactAfterDays, 90);
    assert.equal(policy.deleteAfterDays, 365);
  });

  it('redacts old prompt bodies and skips already-redacted rows', () => {
    const now = new Date('2026-09-15T12:00:00.000Z');
    const cutoffs = aiInteractionRetentionCutoffs(now, { redactAfterDays: 90, deleteAfterDays: 365 });
    const old = { createdAt: new Date('2026-01-01T00:00:00.000Z'), userPrompt: 'secret', assistantReply: 'ok' };
    const fresh = { createdAt: new Date('2026-09-01T00:00:00.000Z'), userPrompt: 'secret', assistantReply: 'ok' };
    const done = { createdAt: old.createdAt, userPrompt: AI_PROMPT_REDACTED, assistantReply: AI_PROMPT_REDACTED };
    assert.equal(shouldRedactAiInteraction(old, cutoffs), true);
    assert.equal(shouldRedactAiInteraction(fresh, cutoffs), false);
    assert.equal(shouldRedactAiInteraction(done, cutoffs), false);
  });

  it('does not delete rows that still have eval results', () => {
    const now = new Date('2026-09-15T12:00:00.000Z');
    const cutoffs = aiInteractionRetentionCutoffs(now, { redactAfterDays: 90, deleteAfterDays: 180 });
    const old = { createdAt: new Date('2025-01-01T00:00:00.000Z'), evalResultCount: 2 };
    const empty = { createdAt: old.createdAt, evalResultCount: 0 };
    assert.equal(shouldDeleteAiInteraction(old, cutoffs), false);
    assert.equal(shouldDeleteAiInteraction(empty, cutoffs), true);
  });
});
