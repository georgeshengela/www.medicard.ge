import { randomUUID } from 'node:crypto';

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function match(row, where = {}) {
  if (!where || Object.keys(where).length === 0) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (key === 'in' || expected == null) continue;
    if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
      if ('in' in expected && !expected.in.includes(row[key])) return false;
      if ('lte' in expected && row[key] > expected.lte) return false;
      continue;
    }
    if (row[key] !== expected) return false;
  }
  return true;
}

function model(map, uniqueKeys = []) {
  return {
    async findUnique({ where }) {
      if (where.id) return clone(map.get(where.id) || null);
      if (where.placeId_windowKey) {
        for (const row of map.values()) {
          if (row.placeId === where.placeId_windowKey.placeId && row.windowKey === where.placeId_windowKey.windowKey) {
            return clone(row);
          }
        }
      }
      return null;
    },
    async findFirst({ where } = {}) {
      for (const row of map.values()) {
        if (match(row, where)) return clone(row);
      }
      return null;
    },
    async findMany({ where, take, include, orderBy } = {}) {
      let rows = [...map.values()].filter((row) => match(row, where));
      if (orderBy) {
        const keys = Array.isArray(orderBy) ? orderBy : [orderBy];
        rows.sort((a, b) => {
          for (const spec of keys) {
            const [field, dir] = Object.entries(spec)[0];
            if (a[field] < b[field]) return dir === 'desc' ? 1 : -1;
            if (a[field] > b[field]) return dir === 'desc' ? -1 : 1;
          }
          return 0;
        });
      }
      if (take) rows = rows.slice(0, take);
      if (include?.place || include?.spawn) {
        rows = rows.map((row) => ({ ...clone(row), place: null, spawn: null }));
      }
      return rows.map((row) => clone(row));
    },
    async create({ data }) {
      const row = { id: data.id || randomUUID(), ...data };
      map.set(row.id, row);
      return clone(row);
    },
    async upsert({ where, create, update }) {
      const existing = await this.findUnique({ where });
      if (!existing) return this.create({ data: create });
      const next = { ...existing, ...update };
      map.set(existing.id, next);
      return clone(next);
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const [id, row] of map) {
        if (match(row, where)) {
          map.set(id, { ...row, ...data });
          count += 1;
        }
      }
      return { count };
    },
    async count({ where } = {}) {
      return [...map.values()].filter((row) => match(row, where)).length;
    },
  };
}

export function createExploreFakeDb() {
  const worldPlace = new Map();
  const careSparkDefinition = new Map();
  const careSparkSpawn = new Map();
  const careSparkCollection = new Map();
  const mediWorldLedger = new Map();
  const mediCompanionBondEvent = new Map();
  const mediWorldProfile = new Map();

  const db = {
    worldPlace: model(worldPlace),
    careSparkDefinition: model(careSparkDefinition),
    careSparkSpawn: model(careSparkSpawn),
    careSparkCollection: {
      ...model(careSparkCollection),
      async findMany(args = {}) {
        const rows = await model(careSparkCollection).findMany(args);
        return rows.map((row) => ({
          ...row,
          place: args.include?.place ? clone(worldPlace.get(row.placeId)) : undefined,
          spawn: args.include?.spawn ? clone(careSparkSpawn.get(row.spawnId)) : undefined,
        }));
      },
    },
    mediWorldLedger: model(mediWorldLedger),
    mediCompanionBondEvent: model(mediCompanionBondEvent),
    mediWorldProfile: model(mediWorldProfile),
    async $transaction(fn) {
      return fn(db);
    },
  };
  return db;
}
