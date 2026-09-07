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
  if (include.completions) {
    out.completions = [...state.questCompletion.values()].filter((item) => item.userQuestId === row.id).map(clone);
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

function sortRows(rows, orderBy) {
  const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  if (!orders.length) return rows;
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const [key, dir] = Object.entries(order)[0];
      const av = a[key];
      const bv = b[key];
      if (av === bv) continue;
      const cmp = av > bv ? 1 : -1;
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
    _txTail: Promise.resolve(),
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
