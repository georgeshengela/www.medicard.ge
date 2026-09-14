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
      if ('lt' in expected && actual < expected.lt) return false;
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
    if (value && typeof value === 'object' && 'increment' in value) next[key] = (next[key] || 0) + value.increment;
    else if (value && typeof value === 'object' && 'decrement' in value) next[key] = (next[key] || 0) - value.decrement;
    else next[key] = value;
  }
  next.updatedAt = new Date();
  return next;
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
        (existing) => existing[idField] !== ignoreId && unique.fields.every((field) => existing[field] === row[field]),
      );
      if (clash) throw uniqueError(unique.fields);
    }
  }
  return {
    async findUnique({ where, include } = {}) {
      return clone(findByUnique(where));
    },
    async findFirst({ where } = {}) {
      return clone([...table().values()].find((row) => matchWhere(row, where)) || null);
    },
    async findMany({ where, orderBy, take, skip } = {}) {
      let rows = [...table().values()].filter((row) => matchWhere(row, where));
      if (orderBy?.createdAt === 'desc') rows.sort((a, b) => b.createdAt - a.createdAt);
      if (orderBy?.createdAt === 'asc') rows.sort((a, b) => a.createdAt - a.createdAt);
      if (skip) rows = rows.slice(skip);
      if (take) rows = rows.slice(0, take);
      return rows.map(clone);
    },
    async count({ where } = {}) {
      return [...table().values()].filter((row) => matchWhere(row, where)).length;
    },
    async create({ data }) {
      const row = { id: data.id || randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...(defaults?.() || {}), ...data };
      assertUnique(row);
      table().set(row[idField], row);
      return clone(row);
    },
    async update({ where, data }) {
      const existing = findByUnique(where);
      if (!existing) {
        const error = new Error('not found');
        error.code = 'P2025';
        throw error;
      }
      const next = applyData(existing, data);
      assertUnique(next, existing[idField]);
      table().set(next[idField], next);
      return clone(next);
    },
    async upsert({ where, create, update }) {
      const existing = findByUnique(where);
      if (existing) return this.update({ where, data: update });
      return this.create({ data: create });
    },
    async deleteMany({ where } = {}) {
      let count = 0;
      for (const [id, row] of table()) {
        if (matchWhere(row, where)) {
          table().delete(id);
          count += 1;
        }
      }
      return { count };
    },
  };
}

export function createHuntFakeDb() {
  const state = {
    huntConfig: new Map(),
    huntSession: new Map(),
    huntCapture: new Map(),
    huntQaGrant: new Map(),
    huntProgress: new Map(),
    huntGraphCache: new Map(),
    huntSuspicious: new Map(),
    rewardLedger: new Map(),
    userQuestProfile: new Map(),
  };
  const db = {
    huntConfig: modelApi(state, 'huntConfig', { idField: 'id', uniques: [{ name: 'id', fields: ['id'] }] }),
    huntSession: modelApi(state, 'huntSession', { uniques: [] }),
    huntCapture: modelApi(state, 'huntCapture', {
      uniques: [{ name: 'sessionId_enemyId', fields: ['sessionId', 'enemyId'] }],
    }),
    huntQaGrant: modelApi(state, 'huntQaGrant', { idField: 'userId', uniques: [{ name: 'userId', fields: ['userId'] }] }),
    huntProgress: modelApi(state, 'huntProgress', { idField: 'userId', uniques: [{ name: 'userId', fields: ['userId'] }] }),
    huntGraphCache: modelApi(state, 'huntGraphCache', { idField: 'cellKey', uniques: [{ name: 'cellKey', fields: ['cellKey'] }] }),
    huntSuspicious: modelApi(state, 'huntSuspicious', { uniques: [] }),
    rewardLedger: modelApi(state, 'rewardLedger', {
      uniques: [{ name: 'userId_currency_sourceType_sourceId', fields: ['userId', 'currency', 'sourceType', 'sourceId'] }],
    }),
    userQuestProfile: modelApi(state, 'userQuestProfile', {
      idField: 'userId',
      uniques: [{ name: 'userId', fields: ['userId'] }],
      defaults: () => ({ currentLevel: 1, totalXp: 0, cachedCoinBalance: 0 }),
    }),
    async $transaction(fn) {
      if (Array.isArray(fn)) return Promise.all(fn);
      const snap = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, clone([...v.entries()])]));
      try {
        return await fn(db);
      } catch (error) {
        for (const [k, entries] of Object.entries(snap)) {
          state[k] = new Map(entries);
        }
        throw error;
      }
    },
  };
  return db;
}
