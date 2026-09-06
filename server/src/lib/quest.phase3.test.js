import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createQuestFakeDb } from './questFakeDb.js';
import { assignDailyQuests, assignWeeklyQuests } from './quest.js';
import { QUEST_TIMEZONE } from './questTime.js';
import { isUsableStepCapability } from './stepCapability.js';

const NOW = new Date('2026-09-06T12:00:00+04:00');
const USER = 'user-quest-3';

describe('phase 3 step capability eligibility', () => {
  it('does not assign movement quests when capability is unknown', async () => {
    const db = createQuestFakeDb();
    const assigned = await assignDailyQuests(USER, '2026-09-06', { db, now: NOW, timezone: QUEST_TIMEZONE });
    const keys = assigned.map((row) => row.template.key).sort();
    assert.deepEqual(keys, ['daily_medi']);
    assert.equal(isUsableStepCapability('UNKNOWN'), false);
  });

  it('does not assign movement quests when permission is denied', async () => {
    const db = createQuestFakeDb();
    await db.stepTrackingCapability.create({
      data: { userId: USER, status: 'PERMISSION_DENIED', source: 'HEALTH_CONNECT' },
    });
    const daily = await assignDailyQuests(USER, '2026-09-06', { db, now: NOW, timezone: QUEST_TIMEZONE });
    const weekly = await assignWeeklyQuests(USER, '2026-W36', { db, now: NOW, timezone: QUEST_TIMEZONE });
    assert.ok(!daily.some((row) => row.template.progressType === 'STEPS'));
    assert.equal(weekly.length, 0);
  });

  it('assigns movement quests only when capability is available', async () => {
    const db = createQuestFakeDb();
    await db.stepTrackingCapability.create({
      data: { userId: USER, status: 'AVAILABLE', source: 'APPLE_HEALTH' },
    });
    const daily = await assignDailyQuests(USER, '2026-09-06', { db, now: NOW, timezone: QUEST_TIMEZONE });
    const weekly = await assignWeeklyQuests(USER, '2026-W36', { db, now: NOW, timezone: QUEST_TIMEZONE });
    assert.ok(daily.some((row) => row.template.key === 'daily_steps'));
    assert.ok(weekly.some((row) => row.template.key === 'weekly_steps'));
  });
});
