import { writeFileSync } from 'node:fs';

const API = 'http://127.0.0.1:4000';
const email = `garden.l1.${Date.now()}@medicard.test`;
const password = 'Phase44GardenL1!';

const register = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fullName: 'Garden Level One',
    email,
    password,
  }),
});
const auth = await register.json();
if (!register.ok) {
  console.error(auth);
  process.exit(1);
}
const garden = await fetch(`${API}/api/medi-world/garden`, {
  headers: { Authorization: `Bearer ${auth.token}` },
}).then((res) => res.json());
const evidence = {
  email,
  userId: auth.user?.id,
  worldLevel: garden.worldLevel,
  plots: garden.plots.map((p) => ({
    index: p.index,
    unlocked: p.unlocked,
    unlockLevel: p.unlockLevel,
    plant: p.plant?.catalogKey || null,
  })),
  unlockedCount: garden.plots.filter((p) => p.unlocked).length,
  atmosphere: garden.atmosphere,
  reaction: garden.mediReaction,
};
writeFileSync('qa/medi-world-phase44/live-l1-garden.json', JSON.stringify(evidence, null, 2));
console.log(evidence);
