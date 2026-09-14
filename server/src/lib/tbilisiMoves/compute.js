import { createHash } from 'node:crypto';
import { rankDistricts, rankPeople } from './ranking.js';

export function rewardPolicyFromSnapshot(rules) {
  const rewards = rules && typeof rules.rewards === 'object' ? rules.rewards : null;
  if (!rewards) {
    return {
      awardsEligible: false,
      reason: 'NO_SNAPSHOT',
      enabled: false,
      leaderRecognitionEnabled: false,
      leaderRewardedRanks: 0,
      districtGoalBadgeEnabled: false,
    };
  }
  const ranks = Math.min(10, Math.max(1, Number(rewards.leaderRewardedRanks) || 3));
  const enabled = rewards.enabled !== false && rules.rewardsEnabled !== false;
  return {
    awardsEligible: enabled,
    reason: enabled ? null : 'REWARDS_DISABLED',
    enabled,
    leaderRecognitionEnabled: enabled && rewards.leaderRecognitionEnabled !== false,
    leaderRewardedRanks: ranks,
    districtGoalBadgeEnabled: enabled && rewards.districtGoalBadgeEnabled !== false,
  };
}

export function shouldIssueAwards({ policy, competitionPausedNow, competitionPausedAtOpen }) {
  if (!policy?.awardsEligible) {
    return { issue: false, reason: policy?.reason || 'NO_SNAPSHOT' };
  }
  if (competitionPausedNow || competitionPausedAtOpen) {
    return { issue: false, reason: 'COMPETITION_PAUSED' };
  }
  return { issue: true, reason: null };
}

export function awardIdentity(row) {
  return `${row.userId}:${row.date || ''}:${row.awardKey}:${row.districtId}`;
}

export function planAwards({
  date,
  rankedDistricts,
  peopleByDistrict,
  policy,
  issue,
}) {
  if (!issue || !policy) return [];
  const plan = [];
  for (const district of rankedDistricts) {
    const districtId = district.districtId || district.id;
    const people = peopleByDistrict[districtId] || [];
    if (policy.leaderRecognitionEnabled) {
      for (const person of people) {
        if (person.rank != null && person.rank >= 1 && person.rank <= policy.leaderRewardedRanks) {
          plan.push({
            userId: person.userId,
            date,
            districtId,
            awardKey: 'DISTRICT_LEADER',
            rank: person.rank,
            titleKa: `რაიონის ლიდერი · ${person.rank} ადგილი`,
            reasonKa: `${district.nameKa} · ${person.rank} ადგილი`,
            publicHandleSnapshot: person.publicHandle,
            publicAvatarIdSnapshot: person.publicAvatarId ?? null,
          });
        }
      }
    }
    const participationOk = !district.unranked && Number(district.contributorCount) > 0;
    if (policy.districtGoalBadgeEnabled && district.goalReached && participationOk) {
      for (const person of people) {
        if (Number(person.eligibleSteps) > 0) {
          plan.push({
            userId: person.userId,
            date,
            districtId,
            awardKey: 'DISTRICT_GOAL',
            rank: null,
            titleKa: 'რაიონის მიზანი',
            reasonKa: `${district.nameKa} · მიზანი შესრულდა`,
            publicHandleSnapshot: person.publicHandle,
            publicAvatarIdSnapshot: person.publicAvatarId ?? null,
          });
        }
      }
    }
  }
  return plan;
}

export function computeRoundResults({
  credits,
  districts,
  targets,
  rules,
  competitionPaused = false,
}) {
  const minParticipants = Math.max(1, Number(rules?.minParticipantsForRank) || 5);
  const defaultTarget = Number(rules?.defaultDailyTarget) || 0;
  const eligible = (credits || []).filter((row) => !row.excludedAt);
  const byDistrict = new Map();
  for (const credit of eligible) {
    const list = byDistrict.get(credit.districtId) || [];
    list.push(credit);
    byDistrict.set(credit.districtId, list);
  }

  const districtRows = (districts || []).map((district) => {
    const rows = byDistrict.get(district.id) || [];
    const positive = rows.filter((row) => Number(row.eligibleSteps) > 0);
    return {
      id: district.id,
      districtId: district.id,
      slug: district.slug,
      nameKa: district.nameKa,
      sortOrder: district.sortOrder ?? 0,
      status: district.status,
      target: Number(targets?.[district.id]) || defaultTarget,
      eligibleStepsSum: positive.reduce((sum, row) => sum + (Number(row.eligibleSteps) || 0), 0),
      contributorCount: positive.length,
      enrolledCount: district.enrolledCount || 0,
    };
  });

  const rankedDistricts = rankDistricts(districtRows, {
    minParticipantsForRank: minParticipants,
    competitionPaused,
  });

  const peopleByDistrict = {};
  for (const district of rankedDistricts) {
    const rows = (byDistrict.get(district.districtId) || []).map((row) => ({
      userId: row.userId,
      eligibleSteps: Number(row.eligibleSteps) || 0,
      publicHandle: row.publicHandleSnapshot || row.publicHandle,
      publicAvatarId: row.publicAvatarIdSnapshot ?? row.publicAvatarId ?? null,
      excludedAt: row.excludedAt || null,
    }));
    peopleByDistrict[district.districtId] = rankPeople(rows, { competitionPaused });
  }

  return {
    districts: rankedDistricts,
    peopleByDistrict,
    eligibleCreditCount: eligible.filter((row) => Number(row.eligibleSteps) > 0).length,
  };
}

export function publicDistrictResults(rankedDistricts) {
  return rankedDistricts.map((row) => ({
    id: row.districtId,
    slug: row.slug,
    nameKa: row.nameKa,
    target: row.target,
    eligibleSteps: row.eligibleStepsSum,
    goalRatio: row.goalRatio,
    participantCount: row.contributorCount,
    enrolledCount: row.enrolledCount || 0,
    rank: row.rank,
    unranked: row.unranked,
    goalReached: row.goalReached,
    contestActive: row.contestActive,
  }));
}

export function snapshotPeople(peopleByDistrict) {
  const out = {};
  for (const [districtId, people] of Object.entries(peopleByDistrict)) {
    out[districtId] = people.map((row) => ({
      userId: row.userId,
      publicHandle: row.publicHandle,
      publicAvatarId: row.publicAvatarId ?? null,
      eligibleSteps: row.eligibleSteps,
      rank: row.rank,
    }));
  }
  return out;
}

export function previewFingerprint({
  date,
  credits,
  targets,
  rules,
  policy,
  competitionPausedAtFinalize,
}) {
  const creditRows = [...(credits || [])]
    .map((row) => ({
      userId: row.userId,
      districtId: row.districtId,
      eligibleSteps: row.excludedAt ? 0 : Number(row.eligibleSteps) || 0,
      excluded: Boolean(row.excludedAt),
    }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
  const targetRows = Object.entries(targets || {})
    .map(([id, target]) => [id, Number(target) || 0])
    .sort((a, b) => a[0].localeCompare(b[0]));
  const body = JSON.stringify({
    date,
    credits: creditRows,
    targets: targetRows,
    minParticipantsForRank: Number(rules?.minParticipantsForRank) || 0,
    competitiveCap: Number(rules?.competitiveCap) || 0,
    defaultDailyTarget: Number(rules?.defaultDailyTarget) || 0,
    policy: {
      awardsEligible: Boolean(policy?.awardsEligible),
      leaderRecognitionEnabled: Boolean(policy?.leaderRecognitionEnabled),
      leaderRewardedRanks: Number(policy?.leaderRewardedRanks) || 0,
      districtGoalBadgeEnabled: Boolean(policy?.districtGoalBadgeEnabled),
    },
    competitionPausedAtFinalize: Boolean(competitionPausedAtFinalize),
  });
  return createHash('sha256').update(body).digest('hex');
}

export function awardCounts(plan) {
  const leader = plan.filter((row) => row.awardKey === 'DISTRICT_LEADER').length;
  const goal = plan.filter((row) => row.awardKey === 'DISTRICT_GOAL').length;
  return { total: plan.length, districtLeader: leader, districtGoal: goal };
}
