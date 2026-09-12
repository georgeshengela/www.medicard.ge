import { PrismaClient } from '@prisma/client';

const API = 'http://127.0.0.1:4000';
const db = new PrismaClient();

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
  if (!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const auth = await req('/api/auth/login', { method: 'POST', body: { email: 'world.qa@medicard.test', password: 'Phase43WorldQa!' } });
const token = auth.token;
await req('/api/medi-world/garden/qa/stage', {
  method: 'POST',
  token,
  body: { plantId: '6fb8a3b9-5a5c-4cb4-a078-e6015fe7563f', nurtureDays: 1 },
});
const g = await req('/api/medi-world/garden', { token });
for (const plot of g.plots.filter((row) => row.plant)) {
  await req(`/api/medi-world/garden/plants/${plot.plant.id}/store`, {
    method: 'POST',
    token,
    body: { idempotencyKey: `empty-${plot.plant.id}` },
  });
}
await db.careGarden.update({
  where: { userId: auth.user.id },
  data: { lastVisitAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
});
await db.$disconnect();
console.log('ok stored-all inactivity-set user', auth.user.id);
