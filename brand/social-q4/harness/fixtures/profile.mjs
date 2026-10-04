// Profile-tab extras and small boot-time writes.
// Shapes: mobile/src/lib/api.ts (pets.list, rewards.entitlements, checkIn session),
// server/src/routes/pets.routes.js, rewards.routes.js, check-in.routes.js.

export function init(state) {
  state.pets = [];
}

export const routes = [
  // Home/Profile "session" ping (check-in streak bookkeeping): the real route answers { ok: true }.
  { method: 'POST', path: '/api/check-in/session', handler: () => ({ ok: true }) },
  { method: 'GET', path: '/api/pets', handler: (rq) => ({ schemaReady: true, pets: rq.state.pets }) },
  { method: 'GET', path: '/api/rewards/entitlements', handler: () => ({ items: [] }) },
];
