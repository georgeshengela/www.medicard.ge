export type CareEnergyType = 'movement' | 'hydration' | 'calm' | 'care' | 'connection';

export type CareEnergyBalances = Record<CareEnergyType, number>;

export type MediWorldFoundation = {
  level: number;
  xp: number;
  worldXp: number;
  worldLevel: number;
  levelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpRequiredForNextLevel: number;
  xpNeededForNextLevel: number;
  progressBps: number;
  progressPercent: number;
  atCap: boolean;
};

export type MediWorldTodayCap = {
  used: number;
  cap: number;
  remaining: number;
};

export type MediWorldProfile = {
  userId: string | null;
  rulesetId?: string;
  rulesetVersion: number;
  currentRulesetVersion: number;
  worldLevel: number;
  worldXp: number;
  foundation: MediWorldFoundation;
  careEnergy: CareEnergyBalances;
  companionRef: { owned: boolean; profileId: string | null };
  coarseCommunityKey: null;
  unlocks: {
    liveMap: boolean;
    healthTree: boolean;
    social: boolean;
    storms: boolean;
    shop: boolean;
    pois: boolean;
  };
  awakening: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MediWorldProfileResponse = {
  enabled: boolean;
  awakening: boolean;
  unlocks: MediWorldProfile['unlocks'];
  profile: MediWorldProfile;
  economy?: { rulesetId: string; rulesetVersion: number };
  today?: {
    periodKey: string;
    timezone: string;
    category: Record<CareEnergyType, MediWorldTodayCap>;
    worldXp: MediWorldTodayCap;
  };
  latestReward?: {
    reasonCode: string | null;
    energyType: CareEnergyType;
    energyAmount: number;
    worldXp: number;
    sourceType: string;
    createdAt: string;
  } | null;
};

export type MediWorldLedgerItem = {
  id: string;
  sourceType: string;
  sourceId: string;
  adapterId: string;
  energyType: CareEnergyType;
  transactionType: 'CREDIT' | 'DEBIT';
  energyAmount: number;
  worldXp: number;
  foundationXp: number;
  progressState: string;
  completionRatioBps: number;
  rulesetVersion: number;
  reasonCode: string;
  periodKey: string | null;
  displayParams: {
    energyType: string | null;
    energyGranted: number;
    worldXpGranted: number;
    periodKey: string | null;
  };
  createdAt: string;
};

export type CompanionWorldState = {
  companion: {
    id: string;
    displayName: string;
    worldStageKey: string;
    presentation: {
      key: string;
      presentationKey: string;
      figureSize: number;
      auraIntensity: number;
    };
    bond: {
      bondPoints: number;
      bondLevel: number;
      pointsIntoLevel: number;
      pointsRequiredForNextLevel: number;
      pointsNeededForNextLevel: number;
      progressPercent: number;
      atCap: boolean;
    };
    equipment: {
      aura: string;
      trail: string | null;
      charm: string | null;
      care_space_accent: string | null;
    };
    careMoment: {
      canComplete: boolean;
      completedKey: string | null;
      periodKey: string;
    };
  };
  world: {
    worldLevel: number;
    worldXp: number;
    careEnergy: CareEnergyBalances;
  };
  evolution: {
    stages: Array<{
      key: string;
      worldLevel: number;
      presentationKey: string;
      unlocked: boolean;
      selected: boolean;
    }>;
    newlyUnlocked: string[];
  };
  catalog: Array<{
    key: string;
    slot: 'aura' | 'trail' | 'charm' | 'care_space_accent';
    energyType: CareEnergyType | null;
    price: number;
    worldLevel: number;
    owned: boolean;
    eligible: boolean;
    active: boolean;
    nameKey: string;
    descriptionKey: string;
    fallbackLabel: string;
  }>;
  dialogue: { key: string };
  unlock?: {
    applied: boolean;
    alreadyOwned: boolean;
    charged: boolean;
    energyType?: CareEnergyType;
    amount?: number;
    resultingBalance?: number;
  };
};

export type AdventureSlotStatus =
  | 'available'
  | 'selected'
  | 'in_progress'
  | 'completed'
  | 'swapped'
  | 'expired'
  | 'rest_day'
  | 'unavailable';

export type AdventureSlot = {
  slotKey: 'anchor' | 'balance' | 'choice';
  optionKey: 'a' | 'b';
  capabilityKey: string;
  energyType: CareEnergyType | null;
  locKey: string;
  status: AdventureSlotStatus;
  selected: boolean;
  required: boolean;
  userQuestId: string | null;
  progress: number;
  target: number | null;
  hasProgress: boolean;
  href: string;
};

export type AdventurePreferences = {
  intensity: 'gentle' | 'balanced' | 'active';
  enabledCategories: CareEnergyType[];
  allowVariety: boolean;
  preferredRestWeekdays: number[];
  reducedPressureLanguage: boolean;
  showTargets: boolean;
  movementMode: 'default' | 'wheelchair' | 'low_mobility';
};

export type DailyAdventurePayload = {
  enabled: boolean;
  rulesetId: string;
  periodKey: string;
  timezone: string;
  status: string;
  restDay: boolean;
  swapCount: number;
  swapsRemaining: number;
  narrativeKey: string;
  companionReactionKey: string;
  completion: {
    complete: boolean;
    requiredCount: number;
    requiredCompleted: number;
    completedAt: string | null;
  };
  slots: AdventureSlot[];
  worldLevel: number;
  companionStageKey: string;
    stale?: boolean;
    expired?: boolean;
  };

export type AdventureResponse = {
  enabled: boolean;
  adventure: DailyAdventurePayload;
  preferences: AdventurePreferences;
};

export type AdventurePreferencesResponse = {
  enabled: boolean;
  preferences: AdventurePreferences;
};

export type ExploreSpark = {
  spawnId: string;
  category: CareEnergyType | string;
  locKey: string;
  expiresAt: string;
  collected: boolean;
};

export type ExplorePlace = {
  id: string;
  name: string;
  nameKa: string;
  nameEn: string;
  placeType: string;
  publicLat: number;
  publicLng: number;
  coarseAreaKey: string;
  accessibility: 'unknown' | 'partial' | 'accessible' | string;
  accessibilityNote: string | null;
  safeHoursPolicy: string | null;
  developmentFixture: boolean;
  spark: ExploreSpark | null;
};

export type ExploreConfigResponse = {
  enabled: boolean;
  rulesetId: string;
  collectionRadiusM: number;
  accuracyMaxM: number;
  freshnessMs: number;
  dailyCap: number;
  developmentFixtures: boolean;
  discoveryCount: number;
  foregroundOnly: boolean;
  mapUnavailable?: boolean;
};

export type ExploreAreaResponse = {
  enabled: boolean;
  rulesetId: string;
  coarseAreaKey: string;
  stale?: boolean;
  places: ExplorePlace[];
};

export type ExploreCollectResponse = {
  enabled: boolean;
  rulesetId: string;
  outcome: string;
  collected?: boolean;
  already?: boolean;
  spawnId?: string;
  placeId?: string;
  discoveryCount?: number;
  narrativeKey?: string;
  reactionKey?: string;
  distanceBand?: string;
  accuracyBand?: string;
  dailyCap?: number;
};

export type ExploreCollectionItem = {
  id: string;
  spawnId: string;
  placeId: string;
  placeNameKa?: string;
  placeNameEn?: string;
  placeType?: string;
  collectedAt: string;
  coarseAreaKey: string;
  distanceBand: string;
  accuracyBand: string;
  periodKey: string;
  rulesetVersion: string;
  narrativeKey: string;
  reactionKey: string;
};

export type ExploreCollectionsResponse = {
  enabled: boolean;
  discoveryCount: number;
  nextCursor: string | null;
  items: ExploreCollectionItem[];
};

export type MovementMode = 'walk' | 'run' | 'gentle_move';

export type MovementSession = {
  id: string;
  movementMode: MovementMode;
  targetDurationSec: number;
  status: 'created' | 'active' | 'paused' | 'completed' | 'abandoned' | 'expired' | 'verification_failed';
  acceptedDurationSec: number;
  activeWallDurationSec: number;
  pausedDurationSec: number;
  acceptedSegmentCount: number;
  rejectedSegmentCount: number;
  lastSequence: number;
  distanceBand: string;
  accuracyQuality: string;
  mockLocationRisk: boolean;
  motorizedRisk: boolean;
  completionRatioBps: number;
  verificationStatus: string;
  periodKey: string;
  rulesetVersion: string;
  lastSegmentReason?: string | null;
  continuationToken?: string;
  outcome?: string;
  mediKey?: string;
  reward?: {
    applied?: boolean;
    duplicate?: boolean;
    reasonCode?: string | null;
    energyAmount?: number;
    worldXp?: number;
  } | null;
};

export type MovementSessionResponse = {
  enabled: boolean;
  rulesetId: string;
  outcome?: string;
  mediKey?: string;
  reward?: MovementSession['reward'];
  world?: MediWorldProfileResponse | null;
  session: MovementSession | null;
};

export type MovementPreferencesResponse = {
  enabled: boolean;
  rulesetId: string;
  movementMode: MovementMode;
  targetMinutes: number;
  targetDurationSec: number;
};

export type MovementHistoryResponse = {
  enabled: boolean;
  rulesetId: string;
  nextCursor: string | null;
  items: MovementSession[];
};

export type GardenStage = 'seed' | 'sprout' | 'bloom' | 'radiant';

export type GardenPlant = {
  id: string;
  catalogKey: string;
  category: CareEnergyType;
  stage: GardenStage;
  nurtureDays: number;
  nextQualifyingDays: number;
  plotIndex: number | null;
  stored: boolean;
  plantedAt: string;
  catalogVersion: string;
  presentationKey: string;
  stagePresentationKey: string;
};

export type GardenPlot = {
  index: number;
  unlocked: boolean;
  unlockLevel: number;
  plant: GardenPlant | null;
};

export type GardenCatalogItem = {
  key: string;
  category: CareEnergyType;
  price: number;
  active: boolean;
  catalogVersion: string;
  presentationKey: string;
  nameKey: string;
  descriptionKey: string;
  a11yKey: string;
  growthPresentation: Record<GardenStage, string>;
};

export type GardenResponse = {
  enabled: boolean;
  rulesetId: string;
  catalogVersion: string;
  atmosphere: string;
  mediReaction: { key: string };
  worldLevel: number;
  plots: GardenPlot[];
  stored: GardenPlant[];
  world?: MediWorldProfileResponse | null;
  plant?: GardenPlant;
  applied?: boolean;
  duplicate?: boolean;
  stale?: boolean;
};

export type GardenCatalogResponse = {
  enabled: boolean;
  rulesetId: string;
  catalogVersion: string;
  items: GardenCatalogItem[];
};

export type GardenHistoryResponse = {
  enabled: boolean;
  rulesetId: string;
  nextCursor: string | null;
  items: Array<{
    id: string;
    type: string;
    catalogKey: string | null;
    plantId: string | null;
    fromPlot: number | null;
    toPlot: number | null;
    stage: string | null;
    createdAt: string;
  }>;
};

