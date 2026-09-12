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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('fail', method, path, res.status, json);
    throw new Error(`${method} ${path} ${res.status}`);
  }
  return json;
}

const auth = await req('/api/auth/login', { method: 'POST', body: { email, password } });
const token = auth.token;
const garden = await req('/api/medi-world/garden', { token });
const extraOrbit = garden.plots.find((p) => p.plant?.id === 'f17b57d7-6d33-4ef5-97c7-71e90dfc8e10')?.plant
  || garden.plots.find((p) => p.index === 5)?.plant;
const firstOrbit = garden.plots.find((p) => p.index === 1)?.plant;
const fern = garden.plots.find((p) => p.plant?.catalogKey === 'pulse_fern')?.plant;

const moved = await req(`/api/medi-world/garden/plants/${extraOrbit.id}/move`, {
  method: 'POST',
  token,
  body: { plotIndex: 2, idempotencyKey: `qa-move-${Date.now()}` },
});
console.log('moved', extraOrbit.id, 'to', 2, moved.plots.find((p) => p.plant?.id === extraOrbit.id)?.index);

const stored = await req(`/api/medi-world/garden/plants/${firstOrbit.id}/store`, {
  method: 'POST',
  token,
  body: { idempotencyKey: `qa-store-${Date.now()}` },
});
console.log('stored', firstOrbit.id, stored.stored.map((p) => p.catalogKey));

writeFileSync('qa/medi-world-phase44/live-move-store.json', JSON.stringify({
  movedPlantId: extraOrbit.id,
  storedPlantId: firstOrbit.id,
  storedStage: stored.stored.find((p) => p.id === firstOrbit.id),
  energy: stored.world?.profile?.careEnergy,
  plots: stored.plots.map((p) => ({ i: p.index, key: p.plant?.catalogKey, stage: p.plant?.stage })),
  stored: stored.stored.map((p) => ({ id: p.id, key: p.catalogKey, stage: p.stage, days: p.nurtureDays })),
}, null, 2));

if (fern) {
  const bloom = await req('/api/medi-world/garden/qa/stage', {
    method: 'POST',
    token,
    body: { plantId: fern.id, stage: 'bloom' },
  });
  writeFileSync('qa/medi-world-phase44/live-qa-bloom.json', JSON.stringify(bloom, null, 2));
  console.log('qa bloom', bloom);
}
