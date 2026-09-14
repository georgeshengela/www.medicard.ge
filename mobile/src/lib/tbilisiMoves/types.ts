export type TbilisiMovesProvider = 'APPLE_HEALTH' | 'HEALTH_CONNECT';

export type TbilisiMovesClock = {
  timezone: string;
  serverNow: string;
  date: string;
  dayStart: string;
  dayEnd: string;
  nextMidnight: string;
};

export type TbilisiMovesStatus = {
  schemaReady: boolean;
  featureEnabled: boolean;
  enrollmentOpen: boolean;
  ingestionPaused: boolean;
  competitionPaused: boolean;
  pilotMode: boolean;
  date: string;
  serverNow: string;
  timezone?: string;
  dayStart?: string;
  dayEnd?: string;
  nextMidnight?: string;
  clock?: TbilisiMovesClock;
  cooldownDays: number | null;
  competitiveCap: number | null;
  defaultDailyTarget: number | null;
  minParticipantsForRank: number | null;
  lateSyncGraceHours: number | null;
  ingestEligible?: boolean;
  resultsReady?: boolean;
  visualQaFixture?: boolean;
  sync?: {
    schemaReady: boolean;
    featureEnabled: boolean;
    enrollmentOpen: boolean;
    ingestionPaused: boolean;
    competitionPaused: boolean;
    ingestEligible: boolean;
  };
};

export type TbilisiMovesDistrict = {
  id: string;
  slug: string;
  nameKa: string;
  sortOrder?: number;
  status?: string;
  target: number;
  eligibleSteps?: number;
  goalRatio?: number;
  participantCount?: number;
  enrolledCount?: number;
  rank?: number | null;
  unranked?: boolean;
  goalReached?: boolean;
  contestActive?: boolean;
};

export type TbilisiMovesMembership = {
  enrolled: boolean;
  status: string | null;
  districtId: string | null;
  district?: { id: string; slug: string; nameKa: string } | null;
  pendingDistrictId: string | null;
  pendingDistrict?: { id: string; slug: string; nameKa: string } | null;
  pendingEffectiveDate: string | null;
  pendingActivationAt: string | null;
  lockUntilDate: string | null;
  nextChangeEligibleOn: string | null;
  changeLocked: boolean;
  publicHandle: string | null;
  publicAvatarId: string | null;
  enrolledAt?: string | null;
  optedInAt?: string | null;
};

export type TbilisiMovesCredit = {
  date?: string;
  districtId: string;
  rawObservedSteps: number;
  eligibleSteps: number;
  capSnapshot: number;
  provider?: string;
  lastRecordedAt?: string;
  flagged?: boolean;
  flagReason?: string | null;
  provisional?: boolean;
};

export type TbilisiMovesOverview = {
  date: string;
  pilotMode: boolean;
  competitionPaused: boolean;
  ingestionPaused: boolean;
  round: {
    date: string | null;
    status: string;
    provisional: boolean;
    ingestOpen: boolean;
    graceEndsAt: string | null;
    lastObservationAt: string | null;
    rules: {
      competitiveCap: number;
      defaultDailyTarget: number;
      minParticipantsForRank: number;
      lateSyncGraceHours: number;
      pilotMode: boolean;
    };
  };
  membership: {
    enrolled: boolean;
    districtId?: string | null;
    districtNameKa?: string | null;
    pendingDistrictId?: string | null;
    pendingDistrictNameKa?: string | null;
    pendingEffectiveDate?: string | null;
    lockUntilDate?: string | null;
    publicHandle?: string | null;
    publicAvatarId?: string | null;
  };
  you: {
    districtId: string;
    eligibleSteps: number;
    rawObservedSteps: number | null;
    capSnapshot: number;
    lastRecordedAt?: string;
  } | null;
  yourDistrict: TbilisiMovesDistrict | null;
  lastObservationAt: string | null;
  clock?: TbilisiMovesClock;
};

export type TbilisiMovesMe = {
  date: string;
  clock?: TbilisiMovesClock;
  config: {
    enrollmentOpen: boolean;
    ingestionPaused: boolean;
    competitionPaused: boolean;
    pilotMode: boolean;
    cooldownDays: number;
    competitiveCap: number;
    defaultDailyTarget: number;
    minParticipantsForRank?: number;
    lateSyncGraceHours?: number;
  };
  sync?: TbilisiMovesStatus['sync'];
  membership: TbilisiMovesMembership;
  overview: TbilisiMovesOverview;
};

export type TbilisiMovesCatalog = {
  date: string;
  pilotMode: boolean;
  enrollmentOpen: boolean;
  competitionPaused: boolean;
  cooldownDays: number;
  defaultDailyTarget: number;
  competitiveCap: number;
  districts: TbilisiMovesDistrict[];
};

export type TbilisiMovesPerson = {
  publicHandle: string;
  publicAvatarId: string | null;
  eligibleSteps: number;
  rank: number | null;
};

export type TbilisiMovesPeopleBoard = {
  date: string;
  provisional?: boolean;
  ingestOpen?: boolean;
  district: {
    id: string;
    slug: string;
    nameKa: string;
    target: number;
    eligibleSteps: number;
    participantCount: number;
  };
  offset: number;
  limit: number;
  total: number;
  people: TbilisiMovesPerson[];
  you: TbilisiMovesPerson & { onPage: boolean; unranked?: boolean } | null;
};

export type TbilisiMovesDistrictBoard = {
  date: string;
  provisional?: boolean;
  ingestOpen?: boolean;
  competitionPaused?: boolean;
  lifecycle?: string;
  source?: 'live' | 'published';
  corrected?: boolean;
  resultRevision?: number;
  targetDefault: number;
  participantCount: number;
  lastObservationAt: string | null;
  districts: TbilisiMovesDistrict[];
};

export type TbilisiMovesObservationBody = {
  clientObservationId: string;
  provider: TbilisiMovesProvider;
  sourceInstallationId: string;
  tbilisiDate: string;
  intervalStart: string;
  intervalEnd: string;
  cumulativeSteps: number;
  recordedAt: string;
  clientSequence?: number;
};

export type TbilisiMovesAward = {
  id: string;
  date: string;
  districtId: string;
  districtNameKa: string | null;
  awardKey: 'DISTRICT_LEADER' | 'DISTRICT_GOAL' | string;
  rank: number | null;
  status: 'ACTIVE' | 'REVOKED' | string;
  titleKa: string;
  reasonKa: string;
  entitledAt?: string;
  revokedAt?: string | null;
};

export type TbilisiMovesHistoryItem = {
  date: string;
  status: string;
  lifecycle: string;
  provisional: boolean;
  resultRevision: number;
  corrected: boolean;
  graceEndsAt?: string | null;
  finalizedAt?: string | null;
  yourEligibleSteps: number | null;
  awardCount: number;
};

export type TbilisiMovesHistory = {
  date: string;
  items: TbilisiMovesHistoryItem[];
  nextCursor: string | null;
};

export type TbilisiMovesDayResults = TbilisiMovesDistrictBoard & {
  source?: 'live' | 'published';
  lifecycle?: string;
  corrected?: boolean;
  resultRevision?: number;
  you?: {
    districtId?: string | null;
    eligibleSteps: number;
    rank: number | null;
    rawObservedSteps?: number | null;
    capSnapshot?: number | null;
  } | null;
  people?: TbilisiMovesPeopleBoard | null;
  awards?: TbilisiMovesAward[];
};

export type SensorReadKind =
  | 'ok'
  | 'zero'
  | 'empty'
  | 'manual_only'
  | 'unsupported'
  | 'permission'
  | 'unavailable'
  | 'error';

export type SensorReading = {
  kind: SensorReadKind;
  steps?: number;
  provider?: TbilisiMovesProvider;
  origin?: string;
  intervalStart: string;
  intervalEnd: string;
  tbilisiDate: string;
  recordedAt: string;
  note?: string;
};
