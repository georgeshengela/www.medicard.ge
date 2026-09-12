import { randomUUID } from 'node:crypto';

function uniqueError(target) {
  const error = new Error(`Unique constraint failed on ${target}`);
  error.code = 'P2002';
  error.meta = { target };
  return error;
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function matchWhere(row, where = {}) {
  if (!where || Object.keys(where).length === 0) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (key === 'OR') {
      if (!expected.some((clause) => matchWhere(row, clause))) return false;
      continue;
    }
    if (key === 'AND') {
      if (!expected.every((clause) => matchWhere(row, clause))) return false;
      continue;
    }
    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
      if ('in' in expected) {
        if (!expected.in.includes(actual)) return false;
        continue;
      }
      if ('not' in expected) {
        if (actual === expected.not) return false;
        continue;
      }
      if ('gte' in expected && actual < expected.gte) return false;
      if ('gt' in expected && actual <= expected.gt) return false;
      if ('lte' in expected && actual > expected.lte) return false;
      if ('lt' in expected && actual >= expected.lt) return false;
      continue;
    }
    if (actual instanceof Date && expected instanceof Date) {
      if (actual.getTime() !== expected.getTime()) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function applyData(row, data) {
  const next = { ...row };
  for (const [key, value] of Object.entries(data || {})) {
    if (value && typeof value === 'object' && 'increment' in value) {
      next[key] = (next[key] || 0) + value.increment;
    } else if (value && typeof value === 'object' && 'decrement' in value) {
      next[key] = (next[key] || 0) - value.decrement;
    } else {
      next[key] = value;
    }
  }
  next.updatedAt = new Date();
  return next;
}

function withInclude(row, include, state) {
  if (!row || !include) return clone(row);
  const out = clone(row);
  if (include.template) {
    out.template = clone(state.questTemplate.get(row.templateId) || null);
  }
  if (include.userQuest) {
    const uq = clone(state.userQuest.get(row.userQuestId) || null);
    if (uq && include.userQuest.include?.template) {
      uq.template = clone(state.questTemplate.get(uq.templateId) || null);
    }
    out.userQuest = uq;
  }
  if (include.completions) {
    out.completions = [...state.questCompletion.values()].filter((item) => item.userQuestId === row.id).map(clone);
  }
  if (include.slots) {
    out.slots = [...state.mediWorldAdventureSlot.values()].filter((item) => item.adventureId === row.id).map(clone);
  }
  if (include.swaps) {
    out.swaps = [...state.mediWorldAdventureSwap.values()].filter((item) => item.adventureId === row.id).map(clone);
  }
  if (include.partner) {
    out.partner = row.partnerId ? clone(state.rewardPartner.get(row.partnerId) || null) : null;
  }
  if (include.reward) {
    const reward = clone(state.rewardDefinition.get(row.rewardId) || null);
    if (reward && include.reward.include?.partner) {
      reward.partner = reward.partnerId ? clone(state.rewardPartner.get(reward.partnerId) || null) : null;
    }
    out.reward = reward;
  }
  if (include.code) {
    out.code = row.codeId ? clone(state.rewardCode.get(row.codeId) || null) : null;
  }
  if (include.entitlements) {
    out.entitlements = [...state.userRewardEntitlement.values()]
      .filter((item) => item.rewardRedemptionId === row.id)
      .map(clone);
  }
  return out;
}

function compareValues(av, bv) {
  if (av instanceof Date || bv instanceof Date) {
    const at = av instanceof Date ? av.getTime() : Date.parse(av);
    const bt = bv instanceof Date ? bv.getTime() : Date.parse(bv);
    if (at === bt) return 0;
    if (Number.isNaN(at)) return -1;
    if (Number.isNaN(bt)) return 1;
    return at > bt ? 1 : -1;
  }
  if (av === bv) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  return av > bv ? 1 : -1;
}

function sortRows(rows, orderBy) {
  const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  if (!orders.length) return rows;
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const [key, dir] = Object.entries(order)[0];
      const cmp = compareValues(a[key], b[key]);
      if (cmp === 0) continue;
      return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

function modelApi(state, name, { uniques, idField = 'id', defaults }) {
  const table = () => state[name];

  function findByUnique(where = {}) {
    if (where[idField] && table().has(where[idField])) return table().get(where[idField]);
    for (const unique of uniques) {
      const compound = where[unique.name];
      if (compound && typeof compound === 'object') {
        return [...table().values()].find((row) => unique.fields.every((field) => row[field] === compound[field]));
      }
      if (unique.fields.length === 1 && where[unique.fields[0]] != null) {
        return [...table().values()].find((row) => row[unique.fields[0]] === where[unique.fields[0]]);
      }
    }
    return [...table().values()].find((row) => matchWhere(row, where)) || null;
  }

  function assertUnique(row, ignoreId) {
    for (const unique of uniques) {
      if (unique.fields.some((field) => row[field] == null)) continue;
      const clash = [...table().values()].find(
        (existing) =>
          existing[idField] !== ignoreId && unique.fields.every((field) => existing[field] === row[field]),
      );
      if (clash) throw uniqueError(unique.fields);
    }
  }

  return {
    async findUnique({ where, include } = {}) {
      state.queryCount += 1;
      state.queryByModel[name] = (state.queryByModel[name] || 0) + 1;
      return withInclude(findByUnique(where), include, state);
    },
    async findMany({ where, include, orderBy, take, skip } = {}) {
      state.queryCount += 1;
      state.queryByModel[name] = (state.queryByModel[name] || 0) + 1;
      let rows = [...table().values()].filter((row) => matchWhere(row, where));
      rows = sortRows(rows, orderBy);
      if (skip) rows = rows.slice(skip);
      if (take) rows = rows.slice(0, take);
      return rows.map((row) => withInclude(row, include, state));
    },
    async findFirst({ where, include, orderBy } = {}) {
      const rows = await this.findMany({ where, include, orderBy, take: 1 });
      return rows[0] || null;
    },
    async count({ where } = {}) {
      return [...table().values()].filter((row) => matchWhere(row, where)).length;
    },
    async create({ data, include } = {}) {
      const row = {
        [idField]: data[idField] || randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...defaults?.(data),
        ...data,
      };
      assertUnique(row);
      table().set(row[idField], row);
      return withInclude(row, include, state);
    },
    async update({ where, data, include } = {}) {
      const current = findByUnique(where);
      if (!current) {
        const error = new Error('Record not found');
        error.code = 'P2025';
        throw error;
      }
      const next = applyData(current, data);
      assertUnique(next, current[idField]);
      table().set(current[idField], next);
      return withInclude(next, include, state);
    },
    async updateMany({ where, data } = {}) {
      let count = 0;
      for (const row of table().values()) {
        if (!matchWhere(row, where)) continue;
        table().set(row[idField], applyData(row, data));
        count += 1;
      }
      return { count };
    },
    async upsert({ where, create, update, include } = {}) {
      const existing = findByUnique(where);
      if (existing) return this.update({ where, data: update, include });
      return this.create({ data: create, include });
    },
  };
}

export function createQuestFakeDb(seed = {}) {
  const state = {
    questTemplate: new Map(),
    userQuest: new Map(),
    questCompletion: new Map(),
    rewardLedger: new Map(),
    userQuestProfile: new Map(),
    healthMetricDaily: new Map(),
    hydrationPreference: new Map(),
    hydrationIntakeEvent: new Map(),
    stepTrackingCapability: new Map(),
    aiInteraction: new Map(),
    medicationDoseEvent: new Map(),
    medicationSchedule: new Map(),
    achievementDefinition: new Map(),
    userAchievement: new Map(),
    rewardPartner: new Map(),
    rewardDefinition: new Map(),
    rewardRedemption: new Map(),
    rewardCode: new Map(),
    rewardInventoryAdjustment: new Map(),
    userRewardEntitlement: new Map(),
    rewardRedemptionAudit: new Map(),
    mediCompanionProfile: new Map(),
    mediJourneyUnlock: new Map(),
    mediWorldProfile: new Map(),
    mediWorldLedger: new Map(),
    mediCompanionWorldStageUnlock: new Map(),
    mediCompanionBondEvent: new Map(),
    mediCompanionCosmeticOwn: new Map(),
    mediWorldAdventurePreference: new Map(),
    mediWorldDailyAdventure: new Map(),
    mediWorldAdventureSlot: new Map(),
    mediWorldAdventureSwap: new Map(),
    worldMovementPreference: new Map(),
    worldMovementSession: new Map(),
    careGarden: new Map(),
    careGardenPlant: new Map(),
    careGardenNurtureEvent: new Map(),
    careGardenEvent: new Map(),
    careGardenMutation: new Map(),
    queryCount: 0,
    queryByModel: {},
  };

  const db = {
    questTemplate: modelApi(state, 'questTemplate', {
      uniques: [{ name: 'key', fields: ['key'] }],
    }),
    userQuest: modelApi(state, 'userQuest', {
      uniques: [{ name: 'userId_templateId_periodKey', fields: ['userId', 'templateId', 'periodKey'] }],
      defaults: () => ({ progress: 0, status: 'ACTIVE', metadata: {} }),
    }),
    questCompletion: modelApi(state, 'questCompletion', {
      uniques: [{ name: 'userQuestId', fields: ['userQuestId'] }],
    }),
    rewardLedger: modelApi(state, 'rewardLedger', {
      uniques: [
        {
          name: 'userId_currency_sourceType_sourceId',
          fields: ['userId', 'currency', 'sourceType', 'sourceId'],
        },
      ],
    }),
    userQuestProfile: modelApi(state, 'userQuestProfile', {
      idField: 'userId',
      uniques: [{ name: 'userId', fields: ['userId'] }],
      defaults: () => ({
        currentLevel: 1,
        totalXp: 0,
        cachedCoinBalance: 0,
        currentStreak: 0,
        longestStreak: 0,
        timezone: null,
        lastDailyAssignPeriodKey: null,
        lastDailyAssignAt: null,
      }),
    }),
    healthMetricDaily: modelApi(state, 'healthMetricDaily', {
      uniques: [{ name: 'userId_date', fields: ['userId', 'date'] }],
    }),
    hydrationPreference: modelApi(state, 'hydrationPreference', {
      idField: 'userId',
      uniques: [{ name: 'userId', fields: ['userId'] }],
    }),
    hydrationIntakeEvent: modelApi(state, 'hydrationIntakeEvent', {
      uniques: [{ name: 'userId_clientEventId', fields: ['userId', 'clientEventId'] }],
    }),
    stepTrackingCapability: modelApi(state, 'stepTrackingCapability', {
      idField: 'userId',
      uniques: [{ name: 'userId', fields: ['userId'] }],
    }),
    aiInteraction: modelApi(state, 'aiInteraction', {
      uniques: [{ name: 'id', fields: ['id'] }],
    }),
    medicationDoseEvent: modelApi(state, 'medicationDoseEvent', {
      uniques: [
        {
          name: 'userId_medicationId_date_time',
          fields: ['userId', 'medicationId', 'date', 'time'],
        },
      ],
    }),
    medicationSchedule: modelApi(state, 'medicationSchedule', {
      uniques: [],
    }),
    achievementDefinition: modelApi(state, 'achievementDefinition', {
      uniques: [{ name: 'key', fields: ['key'] }],
    }),
    userAchievement: modelApi(state, 'userAchievement', {
      uniques: [{ name: 'userId_achievementId', fields: ['userId', 'achievementId'] }],
      defaults: () => ({ status: 'UNLOCKED', claimedAt: null, progressAtUnlock: 0 }),
    }),
    rewardPartner: modelApi(state, 'rewardPartner', {
      uniques: [{ name: 'key', fields: ['key'] }],
    }),
    rewardDefinition: modelApi(state, 'rewardDefinition', {
      uniques: [{ name: 'key', fields: ['key'] }],
      defaults: () => ({
        status: 'DRAFT',
        inventoryMode: 'UNLIMITED',
        featured: false,
        sortOrder: 0,
        metadata: {},
      }),
    }),
    rewardRedemption: modelApi(state, 'rewardRedemption', {
      uniques: [
        { name: 'userId_idempotencyKey', fields: ['userId', 'idempotencyKey'] },
        { name: 'codeId', fields: ['codeId'] },
      ],
      defaults: () => ({ status: 'ISSUED' }),
    }),
    rewardCode: modelApi(state, 'rewardCode', {
      uniques: [{ name: 'rewardId_code', fields: ['rewardId', 'code'] }],
      defaults: () => ({ status: 'AVAILABLE' }),
    }),
    rewardInventoryAdjustment: modelApi(state, 'rewardInventoryAdjustment', {
      uniques: [],
    }),
    userRewardEntitlement: modelApi(state, 'userRewardEntitlement', {
      uniques: [],
      defaults: () => ({ status: 'ACTIVE' }),
    }),
    rewardRedemptionAudit: modelApi(state, 'rewardRedemptionAudit', {
      uniques: [],
    }),
    mediCompanionProfile: modelApi(state, 'mediCompanionProfile', {
      uniques: [{ name: 'userId', fields: ['userId'] }],
      defaults: () => ({
        selectedCosmetics: {},
        selectedEnvironmentKey: 'env.day',
        displayName: null,
        worldStageKey: 'spark',
        bondPoints: 0,
        lastWorldVisitPeriodKey: null,
        lastCareMomentPeriodKey: null,
        lastCareMomentKey: null,
        lastSeenAt: null,
        equippedAuraKey: 'aura_teal_origin',
        equippedTrailKey: null,
        equippedCharmKey: null,
        equippedAccentKey: null,
      }),
    }),
    mediJourneyUnlock: modelApi(state, 'mediJourneyUnlock', {
      uniques: [{ name: 'userId_milestoneKey', fields: ['userId', 'milestoneKey'] }],
    }),
    mediCompanionWorldStageUnlock: modelApi(state, 'mediCompanionWorldStageUnlock', {
      uniques: [{ name: 'userId_stageKey', fields: ['userId', 'stageKey'] }],
      defaults: () => ({ rulesetVersion: 1, unlockedAt: new Date() }),
    }),
    mediCompanionBondEvent: modelApi(state, 'mediCompanionBondEvent', {
      uniques: [
        { name: 'idempotencyKey', fields: ['idempotencyKey'] },
        { name: 'userId_idempotencyKey', fields: ['userId', 'idempotencyKey'] },
      ],
      defaults: () => ({ points: 0, rulesetVersion: 1, periodKey: null }),
    }),
    mediCompanionCosmeticOwn: modelApi(state, 'mediCompanionCosmeticOwn', {
      uniques: [{ name: 'userId_catalogKey', fields: ['userId', 'catalogKey'] }],
      defaults: () => ({ catalogVersion: 1, debitLedgerId: null, unlockedAt: new Date() }),
    }),
    mediWorldAdventurePreference: modelApi(state, 'mediWorldAdventurePreference', {
      idField: 'userId',
      uniques: [{ name: 'userId', fields: ['userId'] }],
      defaults: () => ({
        intensity: 'gentle',
        enabledCategories: ['movement', 'hydration', 'care'],
        allowVariety: true,
        preferredRestWeekdays: [],
        reducedPressureLanguage: true,
        showTargets: false,
        movementMode: 'default',
      }),
    }),
    mediWorldDailyAdventure: modelApi(state, 'mediWorldDailyAdventure', {
      uniques: [{ name: 'userId_periodKey', fields: ['userId', 'periodKey'] }],
      defaults: () => ({
        restDay: false,
        restDayActivatedAt: null,
        status: 'available',
        swapCount: 0,
        reasonCodes: [],
        narrativeKey: 'open.ready',
        storyEventKey: null,
        companionReactionKey: null,
        rulesetVersion: 'medi-world-adventure-v1',
        completedAt: null,
      }),
    }),
    mediWorldAdventureSlot: modelApi(state, 'mediWorldAdventureSlot', {
      uniques: [{ name: 'adventureId_slotKey_optionKey', fields: ['adventureId', 'slotKey', 'optionKey'] }],
      defaults: () => ({
        optionKey: 'a',
        status: 'available',
        selected: true,
        required: true,
        swappedFromKey: null,
        userQuestId: null,
      }),
    }),
    mediWorldAdventureSwap: modelApi(state, 'mediWorldAdventureSwap', {
      uniques: [{ name: 'adventureId_idempotencyKey', fields: ['adventureId', 'idempotencyKey'] }],
    }),
    mediWorldProfile: modelApi(state, 'mediWorldProfile', {
      idField: 'userId',
      uniques: [{ name: 'userId', fields: ['userId'] }],
      defaults: () => ({
        rulesetVersion: 2,
        foundationXp: 0,
        foundationLevel: 1,
        energyMovement: 0,
        energyHydration: 0,
        energyCalm: 0,
        energyCare: 0,
        energyConnection: 0,
        companionProfileId: null,
        coarseCommunityKey: null,
      }),
    }),
    mediWorldLedger: modelApi(state, 'mediWorldLedger', {
      uniques: [
        { name: 'idempotencyKey', fields: ['idempotencyKey'] },
        { name: 'userId_idempotencyKey', fields: ['userId', 'idempotencyKey'] },
      ],
      defaults: () => ({
        energyAmount: 0,
        foundationXp: 0,
        completionRatioBps: 0,
        rulesetVersion: 2,
        transactionType: 'CREDIT',
        reasonCode: null,
        periodKey: null,
        logicalEventId: null,
        intentFingerprint: null,
      }),
    }),
    worldMovementPreference: modelApi(state, 'worldMovementPreference', {
      idField: 'userId',
      uniques: [{ name: 'userId', fields: ['userId'] }],
      defaults: () => ({
        movementMode: 'walk',
        targetMinutes: 10,
      }),
    }),
    worldMovementSession: modelApi(state, 'worldMovementSession', {
      uniques: [{ name: 'userId_startIdempotencyKey', fields: ['userId', 'startIdempotencyKey'] }],
      defaults: () => ({
        acceptedDurationSec: 0,
        activeWallDurationSec: 0,
        pausedDurationSec: 0,
        acceptedSegmentCount: 0,
        rejectedSegmentCount: 0,
        lastSequence: 0,
        distanceBand: 'none',
        accuracyQuality: 'unknown',
        mockLocationRisk: false,
        motorizedRisk: false,
        completionRatioBps: 0,
        verificationStatus: 'pending',
        rulesetVersion: 'medi-world-movement-v1',
        rewardLedgerId: null,
        lastSegmentIdempotencyKey: null,
        lastSegmentReason: null,
        pausedAt: null,
        completedAt: null,
        expiredAt: null,
      }),
    }),
    careGarden: modelApi(state, 'careGarden', {
      idField: 'userId',
      uniques: [{ name: 'userId', fields: ['userId'] }],
      defaults: () => ({
        rulesetVersion: 'medi-world-garden-v1',
        catalogVersion: 'medi-world-garden-v1',
        lastVisitAt: null,
        lastSeenUnlockLevel: 1,
      }),
    }),
    careGardenPlant: modelApi(state, 'careGardenPlant', {
      uniques: [
        { name: 'plantIdempotencyKey', fields: ['plantIdempotencyKey'] },
        { name: 'gardenUserId_plotIndex', fields: ['gardenUserId', 'plotIndex'] },
      ],
      defaults: () => ({
        plotIndex: null,
        stage: 'seed',
        nurtureDays: 0,
        storedAt: null,
        plantIdempotencyKey: null,
        debitLedgerId: null,
        plantedAt: new Date(),
      }),
    }),
    careGardenNurtureEvent: modelApi(state, 'careGardenNurtureEvent', {
      uniques: [{ name: 'plantId_periodKey', fields: ['plantId', 'periodKey'] }],
      defaults: () => ({
        creditLedgerId: null,
      }),
    }),
    careGardenEvent: modelApi(state, 'careGardenEvent', {
      uniques: [{ name: 'gardenUserId_uniqueKey', fields: ['gardenUserId', 'uniqueKey'] }],
    }),
    careGardenMutation: modelApi(state, 'careGardenMutation', {
      uniques: [{ name: 'gardenUserId_idempotencyKey', fields: ['gardenUserId', 'idempotencyKey'] }],
      defaults: () => ({
        plantId: null,
      }),
    }),
    _txTail: Promise.resolve(),
    async $executeRaw() {
      return 0;
    },
    async $queryRaw() {
      return [];
    },
    async $transaction(fn, _opts) {
      if (Array.isArray(fn)) return Promise.all(fn);
      const run = this._txTail.then(async () => {
      const snap = {
        questTemplate: clone([...state.questTemplate.entries()]),
        userQuest: clone([...state.userQuest.entries()]),
        questCompletion: clone([...state.questCompletion.entries()]),
        rewardLedger: clone([...state.rewardLedger.entries()]),
        userQuestProfile: clone([...state.userQuestProfile.entries()]),
        healthMetricDaily: clone([...state.healthMetricDaily.entries()]),
        hydrationPreference: clone([...state.hydrationPreference.entries()]),
        hydrationIntakeEvent: clone([...state.hydrationIntakeEvent.entries()]),
        stepTrackingCapability: clone([...state.stepTrackingCapability.entries()]),
        aiInteraction: clone([...state.aiInteraction.entries()]),
        medicationDoseEvent: clone([...state.medicationDoseEvent.entries()]),
        medicationSchedule: clone([...state.medicationSchedule.entries()]),
        achievementDefinition: clone([...state.achievementDefinition.entries()]),
        userAchievement: clone([...state.userAchievement.entries()]),
        rewardPartner: clone([...state.rewardPartner.entries()]),
        rewardDefinition: clone([...state.rewardDefinition.entries()]),
        rewardRedemption: clone([...state.rewardRedemption.entries()]),
        rewardCode: clone([...state.rewardCode.entries()]),
        rewardInventoryAdjustment: clone([...state.rewardInventoryAdjustment.entries()]),
        userRewardEntitlement: clone([...state.userRewardEntitlement.entries()]),
        rewardRedemptionAudit: clone([...state.rewardRedemptionAudit.entries()]),
        mediCompanionProfile: clone([...state.mediCompanionProfile.entries()]),
        mediJourneyUnlock: clone([...state.mediJourneyUnlock.entries()]),
        mediWorldProfile: clone([...state.mediWorldProfile.entries()]),
        mediWorldLedger: clone([...state.mediWorldLedger.entries()]),
        mediCompanionWorldStageUnlock: clone([...state.mediCompanionWorldStageUnlock.entries()]),
        mediCompanionBondEvent: clone([...state.mediCompanionBondEvent.entries()]),
        mediCompanionCosmeticOwn: clone([...state.mediCompanionCosmeticOwn.entries()]),
        mediWorldAdventurePreference: clone([...state.mediWorldAdventurePreference.entries()]),
        mediWorldDailyAdventure: clone([...state.mediWorldDailyAdventure.entries()]),
        mediWorldAdventureSlot: clone([...state.mediWorldAdventureSlot.entries()]),
        mediWorldAdventureSwap: clone([...state.mediWorldAdventureSwap.entries()]),
        worldMovementPreference: clone([...state.worldMovementPreference.entries()]),
        worldMovementSession: clone([...state.worldMovementSession.entries()]),
        careGarden: clone([...state.careGarden.entries()]),
        careGardenPlant: clone([...state.careGardenPlant.entries()]),
        careGardenNurtureEvent: clone([...state.careGardenNurtureEvent.entries()]),
        careGardenEvent: clone([...state.careGardenEvent.entries()]),
        careGardenMutation: clone([...state.careGardenMutation.entries()]),
      };
      try {
        return await fn(db);
      } catch (error) {
        state.questTemplate = new Map(snap.questTemplate);
        state.userQuest = new Map(snap.userQuest);
        state.questCompletion = new Map(snap.questCompletion);
        state.rewardLedger = new Map(snap.rewardLedger);
        state.userQuestProfile = new Map(snap.userQuestProfile);
        state.healthMetricDaily = new Map(snap.healthMetricDaily);
        state.hydrationPreference = new Map(snap.hydrationPreference);
        state.hydrationIntakeEvent = new Map(snap.hydrationIntakeEvent);
        state.stepTrackingCapability = new Map(snap.stepTrackingCapability);
        state.aiInteraction = new Map(snap.aiInteraction);
        state.medicationDoseEvent = new Map(snap.medicationDoseEvent);
        state.medicationSchedule = new Map(snap.medicationSchedule);
        state.achievementDefinition = new Map(snap.achievementDefinition);
        state.userAchievement = new Map(snap.userAchievement);
        state.rewardPartner = new Map(snap.rewardPartner);
        state.rewardDefinition = new Map(snap.rewardDefinition);
        state.rewardRedemption = new Map(snap.rewardRedemption);
        state.rewardCode = new Map(snap.rewardCode);
        state.rewardInventoryAdjustment = new Map(snap.rewardInventoryAdjustment);
        state.userRewardEntitlement = new Map(snap.userRewardEntitlement);
        state.rewardRedemptionAudit = new Map(snap.rewardRedemptionAudit);
        state.mediCompanionProfile = new Map(snap.mediCompanionProfile);
        state.mediJourneyUnlock = new Map(snap.mediJourneyUnlock);
        state.mediWorldProfile = new Map(snap.mediWorldProfile);
        state.mediWorldLedger = new Map(snap.mediWorldLedger);
        state.mediCompanionWorldStageUnlock = new Map(snap.mediCompanionWorldStageUnlock);
        state.mediCompanionBondEvent = new Map(snap.mediCompanionBondEvent);
        state.mediCompanionCosmeticOwn = new Map(snap.mediCompanionCosmeticOwn);
        state.mediWorldAdventurePreference = new Map(snap.mediWorldAdventurePreference);
        state.mediWorldDailyAdventure = new Map(snap.mediWorldDailyAdventure);
        state.mediWorldAdventureSlot = new Map(snap.mediWorldAdventureSlot);
        state.mediWorldAdventureSwap = new Map(snap.mediWorldAdventureSwap);
        state.worldMovementPreference = new Map(snap.worldMovementPreference);
        state.worldMovementSession = new Map(snap.worldMovementSession);
        state.careGarden = new Map(snap.careGarden);
        state.careGardenPlant = new Map(snap.careGardenPlant);
        state.careGardenNurtureEvent = new Map(snap.careGardenNurtureEvent);
        state.careGardenEvent = new Map(snap.careGardenEvent);
        state.careGardenMutation = new Map(snap.careGardenMutation);
        throw error;
      }
      });
      this._txTail = run.catch(() => {});
      return run;
    },
    _state: state,
  };

  for (const [name, rows] of Object.entries(seed)) {
    for (const row of rows || []) {
      state[name].set(row.id || row.userId, { ...row });
    }
  }

  return db;
}
