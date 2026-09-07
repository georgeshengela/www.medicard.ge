import { api } from '@/lib/api';

export type CompanionEquipSlot = 'accent' | 'accessory' | 'background' | 'decoration';

export type CompanionStage =
  | 'STAGE_1'
  | 'STAGE_2'
  | 'STAGE_3'
  | 'STAGE_4'
  | 'STAGE_5'
  | 'STAGE_6'
  | 'STAGE_7';

export type CompanionMoodKey =
  | 'CALM'
  | 'CHEERFUL'
  | 'PROUD'
  | 'CURIOUS'
  | 'FOCUSED'
  | 'RESTING'
  | 'EXCITED'
  | 'WELCOME_BACK';

export type CompanionDaypart = 'morning' | 'day' | 'evening' | 'night';

export type CompanionState = {
  level: number;
  stage: CompanionStage;
  moodKey: CompanionMoodKey;
  poseKey: string;
  environmentKey: string;
  messageKey: string;
  daypart: CompanionDaypart;
  reducedMotion: boolean;
};

export type JourneyMilestone = {
  key: string;
  at: number;
  chapterKey: string;
  titleKey: string;
  descriptionKey: string;
  major: boolean;
  unlocked: boolean;
  cosmeticKey: string | null;
};

export type CompanionJourney = {
  units: number;
  chapterKey: string;
  currentMilestoneKey: string | null;
  nextMilestoneKey: string | null;
  nextAt: number | null;
  milestones: JourneyMilestone[];
  newlyUnlockedKeys: string[];
  aggregateUnlockCount: number;
};

export type CompanionCosmetic = {
  key: string;
  type: string;
  styleTier: string;
  assetKey: string;
  titleKey: string;
  descriptionKey: string;
  slot: CompanionEquipSlot;
  unlocked: boolean;
};

export type CompanionEquipment = Record<CompanionEquipSlot, string | null>;

export type CompanionOverview = {
  companion: CompanionState;
  journey: CompanionJourney;
  equipment: CompanionEquipment;
  collection: CompanionCosmetic[];
  recentUnlocks: Array<{ kind: string; key: string }>;
};

export type CompanionJourneyResponse = {
  companion: Pick<CompanionState, 'level' | 'stage' | 'moodKey'>;
  journey: CompanionJourney;
};

export type CompanionCollectionResponse = {
  equipment: CompanionEquipment;
  collection: CompanionCosmetic[];
};

export type CompanionOverviewQuery = {
  weatherKey?: string | null;
  isComeback?: boolean;
  recentEventKey?: string | null;
  reducedMotion?: boolean;
};

export const companionApi = {
  overview: (query?: CompanionOverviewQuery) => api.mediCompanion.overview(query),
  journey: () => api.mediCompanion.journey(),
  collection: () => api.mediCompanion.collection(),
  putEquipment: (patch: Partial<CompanionEquipment>) => api.mediCompanion.putEquipment(patch),
  reconcile: () => api.mediCompanion.reconcile(),
};
