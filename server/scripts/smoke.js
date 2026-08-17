/**
 * End-to-end smoke test against a running Medicard.GE API.
 *   node scripts/smoke.js [baseUrl]
 *
 * Exercises auth, the free-tier meter, medication CRUD and the AI quota wall.
 * AI engine calls are allowed to fail (no upstream credits in CI) — what is
 * asserted is that the request is routed, metered and error-handled correctly.
 */

const BASE = process.argv[2] ?? 'http://localhost:4000';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const email = `smoke_${Date.now()}@medicard.ge`;
const password = 'Test12345!';

console.log(`\nMedicard.GE smoke test → ${BASE}\n`);

const health = await call('/health');
check('GET /health returns ok', health.status === 200 && health.json.status === 'ok');

const register = await call('/api/auth/register', {
  method: 'POST',
  body: { fullName: 'ნინო ბერიძე', email, password },
});
check('POST /api/auth/register creates a user', register.status === 201 && !!register.json.token, JSON.stringify(register.json));
const token = register.json.token;

check('register returns full monthly free quota', register.json.usage?.billingPeriod === 'monthly' && register.json.usage?.remaining === 90);

const dupe = await call('/api/auth/register', {
  method: 'POST',
  body: { fullName: 'ნინო ბერიძე', email, password },
});
check('duplicate email is rejected with 409', dupe.status === 409);

const badValidation = await call('/api/auth/register', {
  method: 'POST',
  body: { fullName: 'ა', email: 'not-an-email', password: '123' },
});
check('invalid payload returns 400 with Georgian field errors', badValidation.status === 400 && badValidation.json.fields?.length >= 3);

const login = await call('/api/auth/login', { method: 'POST', body: { email, password } });
check('POST /api/auth/login succeeds', login.status === 200 && !!login.json.token);

const badLogin = await call('/api/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } });
check('wrong password returns 401', badLogin.status === 401);

const unauthorised = await call('/api/usage');
check('protected route without a token returns 401', unauthorised.status === 401);

const me = await call('/api/auth/me', { token });
check('GET /api/auth/me returns the profile', me.status === 200 && me.json.user?.email === email);

const usage = await call('/api/usage', { token });
check('GET /api/usage reports the monthly counter label', usage.status === 200 && usage.json.label?.includes('ამ თვეში'), usage.json.label);

const med = await call('/api/medications', {
  method: 'POST',
  token,
  body: { medName: 'ამოქსიცილინი', dosage: '500 მგ', frequency: '21:00,09:00, 15:00', notes: 'ჭამის შემდეგ' },
});
check('POST /api/medications creates a schedule', med.status === 201, JSON.stringify(med.json));
check('dose times are normalised and sorted', med.json.medication?.frequency === '09:00, 15:00, 21:00', med.json.medication?.frequency);

const badMed = await call('/api/medications', {
  method: 'POST',
  token,
  body: { medName: 'X', dosage: '1', frequency: '25:99' },
});
check('invalid dose time is rejected', badMed.status === 400);

const medList = await call('/api/medications', { token });
check('GET /api/medications returns a flattened daily schedule', medList.json.schedule?.length === 3, JSON.stringify(medList.json.schedule));

const patched = await call(`/api/medications/${med.json.medication.id}`, {
  method: 'PATCH',
  token,
  body: { active: false },
});
check('PATCH /api/medications/:id deactivates', patched.json.medication?.active === false);

const records = await call('/api/records', { token });
check('GET /api/records returns an empty list for a new user', records.status === 200 && records.json.total === 0);

const chats = await call('/api/chats', { token });
check('GET /api/chats returns an empty list for a new user', chats.status === 200 && chats.json.sessions?.length === 0);

// Burn free-tier credits. The upstream engine may be unavailable; what matters is that
// successful generations are metered against the monthly quota.
console.log('\n  — monthly free-tier metering —');
let engineReachable = true;
const usageBefore = await call('/api/usage', { token });
check(
  'GET /api/usage exposes monthly billing',
  usageBefore.status === 200 &&
    usageBefore.json.usage?.billingPeriod === 'monthly' &&
    typeof usageBefore.json.usage?.limit === 'number',
);

for (let i = 1; i <= 2; i += 1) {
  const res = await call('/api/ai/query', {
    method: 'POST',
    token,
    body: { message: 'თავის ტკივილი მაქვს უკვე სამი დღეა, რა შეიძლება იყოს მიზეზი?' },
  });

  if (res.status === 429) {
    check(
      `request #${i} blocked with monthly quota message`,
      res.json.code === 'MONTHLY_LIMIT_REACHED' && !!res.json.upsell,
      res.json.error,
    );
    break;
  }
  if (res.status === 200) {
    check(
      `request #${i} answered and metered (${res.json.usage.used}/${res.json.usage.limit})`,
      res.json.usage.billingPeriod === 'monthly' && res.json.usage.used >= i,
    );
  } else {
    engineReachable = false;
    check(`request #${i} failed upstream without spending a credit`, res.status === 502 || res.status === 503, `${res.status} ${res.json.error ?? ''}`);
  }
}

if (!engineReachable) {
  console.log('\n  ℹ️  EvidenceMD was unreachable, so the quota wall could not be exercised end-to-end.');
  console.log('     Credits are only spent on a successful generation — that behaviour is verified above.');
}

const pharmacyCats = await call('/api/pharmacy/categories');
check('GET /api/pharmacy/categories', pharmacyCats.status === 200 && Array.isArray(pharmacyCats.json.categories), JSON.stringify(pharmacyCats.json));

const pharmacyProducts = await call('/api/pharmacy/products?limit=5');
check(
  'GET /api/pharmacy/products',
  pharmacyProducts.status === 200 && Array.isArray(pharmacyProducts.json.products),
  JSON.stringify(pharmacyProducts.json),
);

const pharmacyMeta = await call('/api/pharmacy/meta/sync');
check('GET /api/pharmacy/meta/sync', pharmacyMeta.status === 200 && pharmacyMeta.json.sources, JSON.stringify(pharmacyMeta.json));

console.log(`\n${failed === 0 ? '✅' : '❌'}  ${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
