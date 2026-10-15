/**
 * MEDIBOOK segment profiles: the business type (its catalogue category) decides which modules the panel shows,
 * how it talks (კლიენტი / პაციენტი / წევრი) and what the ready-made starter kit contains — services with prices and
 * durations, the supplies those services use (norms), the rooms and equipment they need. Businesses may override
 * the module set in Settings (`settings.modules`, sparse: only the keys they touched are stored). The kits live in
 * server/src/data/medibook-starter-kits.json and are applied by name, so a re-run only adds what is missing.
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../prisma.js';
import { bookError, MODULE_KEYS, normalizeModules, normalizeSettings } from './catalog.js';
import * as store from './store.js';
import * as supplies from './supplies.js';
import * as resources from './resources.js';

export { MODULE_KEYS, normalizeModules };

const KITS = JSON.parse(readFileSync(new URL('../../data/medibook-starter-kits.json', import.meta.url), 'utf8'));
delete KITS._format;

const VOCAB = Object.freeze({
  client: { client: ['კლიენტი', 'Client'], clients: ['კლიენტები', 'Clients'], newClient: ['ახალი კლიენტი', 'New client'] },
  patient: { client: ['პაციენტი', 'Patient'], clients: ['პაციენტები', 'Patients'], newClient: ['ახალი პაციენტი', 'New patient'] },
  member: { client: ['წევრი', 'Member'], clients: ['წევრები', 'Members'], newClient: ['ახალი წევრი', 'New member'] },
});

export const categoryOf = (c) => (KITS[String(c ?? '').toUpperCase()] ? String(c).toUpperCase() : 'OTHER');

/** The profile of a category: default modules, vocabulary words (ka/en pairs) and what the kit holds. */
export function profileFor(category) {
  const key = categoryOf(category);
  const kit = KITS[key];
  return {
    category: key,
    modules: { ...kit.modules },
    vocab: VOCAB[kit.vocab] || VOCAB.client,
    kit: { services: kit.services.length, supplies: kit.supplies.length, resources: kit.resources.length, groups: [...new Set(kit.services.map((s) => s[0]))].length },
  };
}

/** The modules a business actually has: the category's defaults under its own overrides. */
export function effectiveModules(settings, category) {
  const base = profileFor(category).modules;
  const own = normalizeModules(normalizeSettings(settings).modules);
  const out = {};
  for (const k of MODULE_KEYS) out[k] = own[k] ?? base[k] ?? true;
  return out;
}

/** The kit itself, in the shape the panel can show before applying it. */
export function kitFor(category) {
  const kit = KITS[categoryOf(category)];
  return {
    services: kit.services.map(([group, nameKa, name, durationMin, price, uses, needs]) => ({ group, nameKa, name, durationMin, price, uses: uses || [], needs: needs || [] })),
    supplies: kit.supplies.map(([name, unit, cost, lowStock]) => ({ name, unit, cost, lowStock })),
    resources: kit.resources.map(([nameKa, name, kind, capacity]) => ({ nameKa, name, kind, capacity: capacity || 1 })),
  };
}

/**
 * Apply the category's kit to a business by name: missing services, supplies and resources are created; norms and
 * resource needs are set only for services that have none. Returns what was added.
 */
export async function applyStarterKit(businessId, { category = null } = {}, db = prisma) {
  const row = await store.businessRow(businessId, db);
  if (!row) throw bookError(404, 'ბიზნესი ვერ მოიძებნა.', 'BUSINESS_NOT_FOUND', 'Business not found.');
  const kit = kitFor(category || row.category);
  const added = { services: 0, supplies: 0, resources: 0, norms: 0, needs: 0 };

  const existingServices = await db.$queryRaw`SELECT id, name, "nameKa" FROM "BookService" WHERE "businessId" = ${businessId} AND active`;
  const serviceByName = new Map(existingServices.flatMap((s) => [[norm(s.nameKa), s.id], [norm(s.name), s.id]]).filter(([k]) => k));
  const existingSupplies = await supplies.listSupplies(businessId, { all: true }, db);
  const supplyByName = new Map(existingSupplies.map((s) => [norm(s.name), s.id]));
  const existingResources = await resources.listResources(businessId, { all: true }, db);
  const resourceByName = new Map(existingResources.map((r) => [norm(r.name), r.id]));

  for (const s of kit.supplies) {
    if (supplyByName.has(norm(s.name))) continue;
    const created = await supplies.createSupply(businessId, { name: s.name, unit: s.unit, cost: s.cost, stock: 0, lowStock: s.lowStock }, db);
    supplyByName.set(norm(s.name), created.id);
    added.supplies += 1;
  }
  for (const r of kit.resources) {
    if (resourceByName.has(norm(r.nameKa))) continue;
    const created = await resources.createResource(businessId, { name: r.nameKa, kind: r.kind, capacity: r.capacity }, db);
    if (created) { resourceByName.set(norm(r.nameKa), created.id); added.resources += 1; }
  }
  const normsNow = await db.$queryRaw`SELECT DISTINCT "serviceId" FROM "BookServiceSupply" WHERE "businessId" = ${businessId}`;
  const hasNorm = new Set(normsNow.map((n) => n.serviceId));
  const needsNow = await db.$queryRaw`SELECT DISTINCT "serviceId" FROM "BookServiceResource" WHERE "serviceId" IN (SELECT id FROM "BookService" WHERE "businessId" = ${businessId})`;
  const hasNeed = new Set(needsNow.map((n) => n.serviceId));
  let order = existingServices.length;
  for (const s of kit.services) {
    let id = serviceByName.get(norm(s.nameKa)) || serviceByName.get(norm(s.name));
    if (!id) {
      const created = await store.createService(businessId, { group: s.group, name: s.name, nameKa: s.nameKa, durationMin: s.durationMin, price: s.price, online: true, sortOrder: order++ }, db);
      id = created.id;
      serviceByName.set(norm(s.nameKa), id);
      added.services += 1;
    }
    if (s.uses.length && !hasNorm.has(id)) {
      const items = s.uses.map(([name, qty]) => ({ productId: supplyByName.get(norm(name)), qty })).filter((i) => i.productId);
      if (items.length) { await supplies.setNorms({ businessId, serviceId: id, items }, db); added.norms += 1; }
    }
    if (s.needs.length && !hasNeed.has(id)) {
      const ids = s.needs.map((name) => resourceByName.get(norm(name))).filter(Boolean);
      if (ids.length) { await resources.setServiceResources({ businessId, serviceId: id, resourceIds: ids }, db); added.needs += 1; }
    }
  }
  return added;
}

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** For tests and the admin: every kit's norms and needs point at names the same kit defines. */
export function kitProblems() {
  const problems = [];
  for (const [cat, kit] of Object.entries(KITS)) {
    const supplyNames = new Set(kit.supplies.map(([n]) => n));
    const resourceNames = new Set(kit.resources.map(([n]) => n));
    for (const [, nameKa, , , , uses = [], needs = []] of kit.services) {
      for (const [n] of uses) if (!supplyNames.has(n)) problems.push(`${cat}: „${nameKa}“ uses unknown supply „${n}“`);
      for (const n of needs) if (!resourceNames.has(n)) problems.push(`${cat}: „${nameKa}“ needs unknown resource „${n}“`);
    }
    for (const k of MODULE_KEYS) if (typeof kit.modules[k] !== 'boolean') problems.push(`${cat}: module ${k} missing`);
  }
  return problems;
}
