export const CONFIG_BOUNDS = Object.freeze({
  defaultDailyTarget: { min: 1_000, max: 50_000_000 },
  competitiveCap: { min: 1_000, max: 50_000 },
  cooldownDays: { min: 1, max: 365 },
  minParticipantsForRank: { min: 1, max: 10_000 },
  lateSyncGraceHours: { min: 1, max: 24 },
  sanityMaxRawSteps: { min: 20_000, max: 200_000 },
  correctionDropFlagPct: { min: 10, max: 90 },
  leaderRewardedRanks: { min: 1, max: 10 },
});

export const CONFIG_DEFAULTS = Object.freeze({
  id: 'default',
  featureEnabled: false,
  enrollmentOpen: false,
  ingestionPaused: false,
  competitionPaused: false,
  rewardsEnabled: true,
  leaderRecognitionEnabled: true,
  leaderRewardedRanks: 3,
  districtGoalBadgeEnabled: true,
  pilotMode: true,
  defaultDailyTarget: 100_000,
  competitiveCap: 10_000,
  cooldownDays: 30,
  minParticipantsForRank: 5,
  lateSyncGraceHours: 8,
  sanityMaxRawSteps: 80_000,
  correctionDropFlagPct: 40,
  geometryAssetVersion: null,
  revision: 1,
});

/** Immediate operational flags — take effect on the next request. */
export const OPERATIONAL_FIELDS = Object.freeze([
  'featureEnabled',
  'enrollmentOpen',
  'ingestionPaused',
  'competitionPaused',
  'sanityMaxRawSteps',
  'correctionDropFlagPct',
]);

/** Scoring fields snapshotted when a round first opens. Existing rounds stay frozen. */
export const SCORING_FIELDS = Object.freeze([
  'defaultDailyTarget',
  'competitiveCap',
  'cooldownDays',
  'minParticipantsForRank',
  'lateSyncGraceHours',
  'rewardsEnabled',
  'leaderRecognitionEnabled',
  'leaderRewardedRanks',
  'districtGoalBadgeEnabled',
]);

export const MEMBERSHIP_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  LEFT: 'LEFT',
});

export const DISTRICT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
});

export const ROUND_STATUS = Object.freeze({
  PROVISIONAL: 'PROVISIONAL',
  FINALIZED: 'FINALIZED',
});
