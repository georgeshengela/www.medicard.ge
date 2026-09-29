#!/usr/bin/env node
/**
 * Signed-in latency check for the owner to run (2026-09-29). Claude never types passwords, so the
 * owner runs this with a dedicated TEST account:
 *
 *   MEDICARD_EMAIL=test@example.com MEDICARD_PASSWORD=... node scripts/load-test-auth.mjs
 *   (PowerShell: $env:MEDICARD_EMAIL="..."; $env:MEDICARD_PASSWORD="..."; node scripts/load-test-auth.mjs)
 *
 * One account is capped at 600 requests/min by the loop guard (user-ceiling), so this cannot and
 * does not try to overload the server. It walks the main read screens at ~6 requests/second for
 * 60 s and reports p50/p95/max per endpoint plus any errors — the signal that tells whether the
 * signed-in paths are fast. Read-only GETs only (it never logs meals, doses or cycle days).
 */
const BASE = process.env.MEDICARD_API || 'https://medicard.ge';
const EMAIL = process.env.MEDICARD_EMAIL;
const PASSWORD = process.env.MEDICARD_PASSWORD;
const SECONDS = Number(process.env.SECONDS || 60);
const RPS = Math.min(8, Number(process.env.RPS || 6));

const ENDPOINTS = [
  '/api/app/status?version=1.0.0.17.19',
  '/api/medications',
  '/api/nutrition/program/dashboard',
  '/api/announcements?placement=home',
  '/api/quests',
  '/api/achievements',
  '/api/health-metrics/daily?from=2026-09-01&to=2026-09-30',
  '/api/records',
  '/api/chats',
  '/api/cycle',
];

if (!EMAIL || !PASSWORD) {
  console.error('Set MEDICARD_EMAIL and MEDICARD_PASSWORD for a TEST account (see the comment at the top).');
  process.exit(1);
}

const headers = (token) => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-Medicard-Platform': 'load-test',
  'X-Medicard-App-Version': 'load-test',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: headers(), body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
if (!login.ok) {
  console.error('Login failed:', login.status, (await login.text()).slice(0, 200));
  process.exit(1);
}
const { token } = await login.json();

const results = new Map(ENDPOINTS.map((e) => [e, { times: [], errors: {} }]));
const deadline = Date.now() + SECONDS * 1000;
let i = 0;
const inflight = new Set();

while (Date.now() < deadline) {
  const path = ENDPOINTS[i % ENDPOINTS.length];
  i += 1;
  const started = performance.now();
  const p = fetch(`${BASE}${path}`, { headers: headers(token), signal: AbortSignal.timeout(20_000) })
    .then(async (res) => {
      await res.arrayBuffer();
      const r = results.get(path);
      if (res.ok) r.times.push(performance.now() - started);
      else r.errors[res.status] = (r.errors[res.status] || 0) + 1;
    })
    .catch((err) => {
      const r = results.get(path);
      r.errors[err.name || 'network'] = (r.errors[err.name || 'network'] || 0) + 1;
    })
    .finally(() => inflight.delete(p));
  inflight.add(p);
  await new Promise((r) => setTimeout(r, 1000 / RPS));
}
await Promise.all(inflight);

const pct = (arr, q) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))]);
};
console.log(`\n${i} requests in ${SECONDS}s (${RPS}/s) against ${BASE}\n`);
console.table(
  ENDPOINTS.map((e) => {
    const r = results.get(e);
    return { endpoint: e, ok: r.times.length, p50_ms: pct(r.times, 0.5), p95_ms: pct(r.times, 0.95), max_ms: pct(r.times, 1), errors: JSON.stringify(r.errors) };
  }),
);
console.log('Healthy: p95 under ~800 ms, no 5xx. 404 on an endpoint just means that screen uses another path.');
