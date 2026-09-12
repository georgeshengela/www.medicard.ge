import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env.API_URL || 'http://127.0.0.1:4000';
const email = process.env.QA_EMAIL || 'world.qa@medicard.test';
const password = process.env.QA_PASSWORD || 'Phase43WorldQa!';
const outDir = 'qa/medi-world-phase44';
mkdirSync(outDir, { recursive: true });

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

const auth = await req('/api/auth/login', { method: 'POST', body: { email, password } });
const token = auth.token;
const garden = await req('/api/medi-world/garden', { token });
const catalog = await req('/api/medi-world/garden/catalog', { token });
const profile = await req('/api/medi-world', { token });
const evidence = {
  userId: auth.user?.id,
  worldLevel: garden.worldLevel,
  unlocked: garden.plots.filter((p) => p.unlocked).length,
  atmosphere: garden.atmosphere,
  mediReaction: garden.mediReaction,
  careEnergy: garden.world?.profile?.careEnergy || profile.profile?.careEnergy,
  catalogKeys: catalog.items.map((i) => i.key),
};
writeFileSync(join(outDir, 'live-garden-get.json'), JSON.stringify({ garden: { ...garden, world: { profile: garden.world?.profile } }, catalog, evidence }, null, 2));
console.log('garden-get', evidence);

const empty = garden.plots.find((p) => p.unlocked && !p.plant);
const balances = evidence.careEnergy || {};
const plantable = catalog.items.find((item) => (balances[item.category] || 0) >= item.price);
if (empty && plantable) {
  const planted = await req(`/api/medi-world/garden/plots/${empty.index}/plant`, {
    method: 'POST',
    token,
    body: { catalogKey: plantable.key, idempotencyKey: `live-plant-${Date.now()}` },
  });
  writeFileSync(join(outDir, 'live-plant.json'), JSON.stringify({
    catalogKey: plantable.key,
    plotIndex: empty.index,
    applied: planted.applied,
    duplicate: planted.duplicate,
    before: balances,
    after: planted.world?.profile?.careEnergy,
    plant: planted.plant,
  }, null, 2));
  console.log('planted', plantable.key, planted.world?.profile?.careEnergy);
} else {
  console.log('no-plant-slot-or-energy', { empty: Boolean(empty), plantable: plantable?.key, balances });
}
