import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import express from 'express';
import { aiFeatureGates, assistantFeatureGates, healthMetricsFeatureGates } from './featureGates.js';
import { primeFeatureFlagsForTests, requireFeature, resetFeatureFlagCacheForTests } from './featureFlags.js';

// The same mounts as server.js, with a stub instead of each router.
const app = express();
app.use(express.json());
const ok = (req, res) => res.json({ ok: true });
app.use('/api/ai', ...aiFeatureGates, ok);
app.use('/api/assistant', ...assistantFeatureGates, ok);
app.use('/api/health-metrics', ...healthMetricsFeatureGates, ok);
app.use('/api/visits', requireFeature('visits'), ok);

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const off = (...keys) => primeFeatureFlagsForTests(keys.map((key) => ({ key, enabled: false })));
async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

describe('feature gates (admin „მოდულები“)', () => {
  beforeEach(() => resetFeatureFlagCacheForTests());

  it('lets everything through while nothing is paused', async () => {
    off();
    for (const [method, path, body] of [
      ['POST', '/api/ai/query', { mode: 'DOCTOR' }], ['POST', '/api/ai/extract-lab'], ['POST', '/api/assistant/transcribe'],
      ['PUT', '/api/health-metrics/hydration/goal'], ['POST', '/api/visits'],
    ]) assert.equal((await call(method, path, body)).status, 200, path);
  });

  it('pauses one Medi mode by the request body, not the other', async () => {
    off('mediDoctor');
    const doctor = await call('POST', '/api/ai/query', { mode: 'DOCTOR' });
    assert.equal(doctor.status, 503);
    assert.equal(doctor.body.code, 'FEATURE_DISABLED');
    assert.equal(doctor.body.feature, 'mediDoctor');
    assert.equal((await call('POST', '/api/ai/query', { mode: 'CONSILIUM' })).status, 200);
    assert.equal((await call('GET', '/api/ai/history')).status, 200);
  });

  it('pausing Medi stops its tools but keeps feedback open', async () => {
    off('medi');
    assert.equal((await call('POST', '/api/ai/symptom-check')).status, 503);
    assert.equal((await call('POST', '/api/assistant/plan')).status, 503);
    assert.equal((await call('POST', '/api/ai/feedback')).status, 200);
  });

  it('matches each tool on its own path', async () => {
    off('labs', 'symptoms', 'skin', 'weight', 'medications');
    for (const [path, feature] of [
      ['/api/ai/extract-lab', 'labs'], ['/api/ai/explain-lab', 'labs'], ['/api/ai/align-lab', 'labs'],
      ['/api/ai/symptom-check', 'symptoms'], ['/api/ai/skincare', 'skin'],
      ['/api/ai/weight-advice', 'weight'], ['/api/ai/medication-review', 'medications'],
    ]) {
      const res = await call('POST', path);
      assert.equal(res.status, 503, path);
      assert.equal(res.body.feature, feature, path);
    }
    assert.equal((await call('POST', '/api/ai/query', { mode: 'DOCTOR' })).status, 200);
  });

  it('pauses voice without pausing typed Medi', async () => {
    off('voice');
    assert.equal((await call('POST', '/api/assistant/transcribe')).status, 503);
    assert.equal((await call('POST', '/api/assistant/speak')).status, 503);
    assert.equal((await call('POST', '/api/assistant/plan')).status, 200);
  });

  it('never blocks device syncs while a tracker is paused', async () => {
    off('hydration', 'steps', 'weight');
    assert.equal((await call('PUT', '/api/health-metrics/hydration/goal')).status, 503);
    assert.equal((await call('POST', '/api/health-metrics/sync', { daily: [] })).status, 200);
  });

  it('pauses visit writes with the admin message and keeps reading', async () => {
    primeFeatureFlagsForTests([{ key: 'visits', enabled: false, message: 'ვიზიტები მალე დაბრუნდება.' }]);
    const res = await call('POST', '/api/visits', { visitDate: '2026-10-10' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'ვიზიტები მალე დაბრუნდება.');
    assert.equal((await call('GET', '/api/visits')).status, 200);
  });
});
