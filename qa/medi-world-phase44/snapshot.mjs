import { writeFileSync } from 'node:fs';

const API = 'http://127.0.0.1:4000';
const email = 'world.qa@medicard.test';
const password = 'Phase43WorldQa!';

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(`${method} ${path} ${res.status}`);
    err.body = json;
    throw err;
  }
  return json;
}

const auth = await req('/api/auth/login', { method: 'POST', body: { email, password } });
const token = auth.token;
const garden = await req('/api/medi-world/garden', { token });
const energy = garden.world?.profile?.careEnergy;
writeFileSync('qa/medi-world-phase44/live-android-plant-balance.json', JSON.stringify({
  energy,
  plots: garden.plots.map((p) => ({ index: p.index, unlocked: p.unlocked, plant: p.plant ? { id: p.plant.id, key: p.plant.catalogKey, stage: p.plant.stage, days: p.plant.nurtureDays } : null })),
  stored: garden.stored,
  atmosphere: garden.atmosphere,
  reaction: garden.mediReaction,
}, null, 2));
console.log('energy', energy);
console.log('plants', garden.plots.filter((p) => p.plant).map((p) => p.plant.catalogKey + ':' + p.plant.stage));
