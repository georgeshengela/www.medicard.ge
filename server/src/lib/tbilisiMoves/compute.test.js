import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  awardCounts,
  computeRoundResults,
  planAwards,
  previewFingerprint,
  publicDistrictResults,
  rewardPolicyFromSnapshot,
  shouldIssueAwards,
} from './compute.js';

const DISTRICTS = [
  { id: 'd1', slug: 'gldani', nameKa: 'გლდანი', sortOrder: 10 },
  { id: 'd2', slug: 'vake', nameKa: 'ვაკე', sortOrder: 30 },
];

function credits(rows) {
  return rows.map((row) => ({
    publicHandleSnapshot: row.publicHandle || row.userId,
    publicAvatarIdSnapshot: null,
    excludedAt: row.excludedAt || null,
    ...row,
  }));
}

const POLICY = {
  awardsEligible: true,
  enabled: true,
  leaderRecognitionEnabled: true,
  leaderRewardedRanks: 3,
  districtGoalBadgeEnabled: true,
};

describe('tbilisi moves reward snapshots', () => {
  it('issues no awards when the round has no rewards snapshot', () => {
    const policy = rewardPolicyFromSnapshot({ rewardsEnabled: true, minParticipantsForRank: 1 });
    assert.equal(policy.awardsEligible, false);
    assert.equal(policy.reason, 'NO_SNAPSHOT');
    const issuance = shouldIssueAwards({ policy, competitionPausedNow: false, competitionPausedAtOpen: false });
    assert.equal(issuance.issue, false);
  });

  it('skips awards when competition is paused at finalize or at open', () => {
    const policy = rewardPolicyFromSnapshot({
      rewardsEnabled: true,
      rewards: { enabled: true, leaderRecognitionEnabled: true, leaderRewardedRanks: 3, districtGoalBadgeEnabled: true },
    });
    assert.equal(shouldIssueAwards({ policy, competitionPausedNow: true, competitionPausedAtOpen: false }).reason, 'COMPETITION_PAUSED');
    assert.equal(shouldIssueAwards({ policy, competitionPausedNow: false, competitionPausedAtOpen: true }).reason, 'COMPETITION_PAUSED');
  });
});

describe('tbilisi moves final board compute', () => {
  it('produces an empty result instead of inventing winners', () => {
    const computed = computeRoundResults({
      credits: [],
      districts: DISTRICTS,
      targets: { d1: 100, d2: 100 },
      rules: { minParticipantsForRank: 1, defaultDailyTarget: 100 },
    });
    assert.equal(computed.eligibleCreditCount, 0);
    assert.ok(computed.districts.every((row) => row.eligibleStepsSum === 0));
    const awards = planAwards({
      date: '2026-09-13',
      rankedDistricts: computed.districts,
      peopleByDistrict: computed.peopleByDistrict,
      policy: POLICY,
      issue: true,
    });
    assert.equal(awards.length, 0);
  });

  it('excludes zero-credit people and unranked districts from goal badges', () => {
    const computed = computeRoundResults({
      credits: credits([
        { userId: 'a', districtId: 'd1', eligibleSteps: 200 },
        { userId: 'b', districtId: 'd1', eligibleSteps: 0 },
        { userId: 'c', districtId: 'd2', eligibleSteps: 50 },
      ]),
      districts: DISTRICTS,
      targets: { d1: 100, d2: 100 },
      rules: { minParticipantsForRank: 2, defaultDailyTarget: 100 },
    });
    const d1 = computed.districts.find((row) => row.id === 'd1');
    const d2 = computed.districts.find((row) => row.id === 'd2');
    assert.equal(d1.goalReached, true);
    assert.equal(d1.unranked, true);
    assert.equal(d2.unranked, true);
    const awards = planAwards({
      date: '2026-09-13',
      rankedDistricts: computed.districts,
      peopleByDistrict: computed.peopleByDistrict,
      policy: POLICY,
      issue: true,
    });
    assert.ok(awards.every((row) => row.awardKey !== 'DISTRICT_GOAL'));
    assert.equal(awards.filter((row) => row.awardKey === 'DISTRICT_LEADER').length, 2);
  });

  it('awards every person tied at a rewarded dense rank', () => {
    const people = credits(
      Array.from({ length: 6 }, (_, i) => ({
        userId: `u${i}`,
        districtId: 'd1',
        eligibleSteps: 9000,
        publicHandle: `H${i}`,
      })),
    );
    people.push({
      userId: 'low',
      districtId: 'd1',
      eligibleSteps: 10,
      publicHandleSnapshot: 'Low',
      publicAvatarIdSnapshot: null,
      excludedAt: null,
    });
    const computed = computeRoundResults({
      credits: people,
      districts: DISTRICTS,
      targets: { d1: 1000, d2: 1000 },
      rules: { minParticipantsForRank: 1, defaultDailyTarget: 1000 },
    });
    const awards = planAwards({
      date: '2026-09-13',
      rankedDistricts: computed.districts,
      peopleByDistrict: computed.peopleByDistrict,
      policy: { ...POLICY, leaderRewardedRanks: 1, districtGoalBadgeEnabled: false },
      issue: true,
    });
    const leaders = awards.filter((row) => row.awardKey === 'DISTRICT_LEADER');
    assert.equal(leaders.length, 6);
    assert.ok(leaders.every((row) => row.rank === 1));
  });

  it('gives a goal badge to every positive contributor when the district qualifies', () => {
    const computed = computeRoundResults({
      credits: credits([
        { userId: 'a', districtId: 'd1', eligibleSteps: 80 },
        { userId: 'b', districtId: 'd1', eligibleSteps: 30 },
        { userId: 'c', districtId: 'd1', eligibleSteps: 20 },
      ]),
      districts: DISTRICTS,
      targets: { d1: 100, d2: 100 },
      rules: { minParticipantsForRank: 2, defaultDailyTarget: 100 },
    });
    const d1 = computed.districts.find((row) => row.id === 'd1');
    assert.equal(d1.goalReached, true);
    assert.equal(d1.unranked, false);
    const awards = planAwards({
      date: '2026-09-13',
      rankedDistricts: computed.districts,
      peopleByDistrict: computed.peopleByDistrict,
      policy: POLICY,
      issue: true,
    });
    const goals = awards.filter((row) => row.awardKey === 'DISTRICT_GOAL');
    assert.equal(goals.length, 3);
  });

  it('does not count excluded credits toward ranking or awards', () => {
    const computed = computeRoundResults({
      credits: credits([
        { userId: 'a', districtId: 'd1', eligibleSteps: 9000, excludedAt: new Date() },
        { userId: 'b', districtId: 'd1', eligibleSteps: 100 },
      ]),
      districts: DISTRICTS,
      targets: { d1: 50, d2: 50 },
      rules: { minParticipantsForRank: 1, defaultDailyTarget: 50 },
    });
    assert.equal(computed.peopleByDistrict.d1.length, 1);
    assert.equal(computed.peopleByDistrict.d1[0].userId, 'b');
    assert.equal(computed.districts.find((row) => row.id === 'd1').eligibleStepsSum, 100);
  });

  it('changes the preview hash when a contribution is excluded', () => {
    const base = {
      date: '2026-09-13',
      targets: { d1: 100 },
      rules: { minParticipantsForRank: 1, competitiveCap: 10000, defaultDailyTarget: 100 },
      policy: POLICY,
      competitionPausedAtFinalize: false,
    };
    const open = credits([{ userId: 'a', districtId: 'd1', eligibleSteps: 40 }]);
    const excluded = credits([{ userId: 'a', districtId: 'd1', eligibleSteps: 40, excludedAt: new Date('2026-09-14') }]);
    assert.notEqual(previewFingerprint({ ...base, credits: open }), previewFingerprint({ ...base, credits: excluded }));
  });

  it('keeps public snapshots free of invented ranks for empty boards', () => {
    const computed = computeRoundResults({
      credits: [],
      districts: DISTRICTS,
      targets: { d1: 100, d2: 100 },
      rules: { minParticipantsForRank: 5, defaultDailyTarget: 100 },
    });
    const publicRows = publicDistrictResults(computed.districts);
    assert.ok(publicRows.every((row) => row.rank == null));
    assert.equal(awardCounts([]).total, 0);
  });
});
