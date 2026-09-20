const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '..');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const full = path.resolve(root, file); if (cache.has(full)) return cache.get(full);
    const exports = {}; cache.set(full, exports);
    const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, { exports, require: name => {
      if (name in mocks) return mocks[name];
      const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(full), name) : null;
      if (base) { const resolved = [base, base + '.ts', base + '.js'].find(p => fs.existsSync(p) && fs.statSync(p).isFile()); if (resolved) return load(resolved); }
      throw Error('Unmocked dependency: ' + name);
    }, console, Date, Promise, Map, Set, setTimeout, clearTimeout }, { filename: full });
    return exports;
  }
  return load;
}
const load = loader({ react: { useSyncExternalStore: () => {} } });
const views = load('src/lib/symptomBodyGeometry.ts').ANATOMICAL_BODY_VIEWS;

for (const gender of ['MALE', 'FEMALE']) {
  test(`${gender}: abdomen selection never highlights thigh, shin, hand or decorative contour`, () => {
    const view = views[gender].front;
    const abs = view.paths.filter(p => p.selectable && p.partId === 'abs');
    assert.ok(abs.length >= 4);
    const lowestAbdomen = Math.max(...abs.map(p => p.maxY));
    assert.ok(lowestAbdomen < view.h * 0.54, 'abdomen must end before legs');
    assert.ok(abs.every(p => p.minY > view.h * 0.20));
    const thighIds = gender === 'MALE' ? [12, 13, 19, 20] : [26, 27, 34, 35];
    for (const index of thighIds) assert.equal(view.paths.find(p => p.sourceIndex === index).partId, 'upper-leg');
    assert.ok(view.paths.filter(p => p.fill === 'none').every(p => !p.selectable));
  });
  test(`${gender}: all four limb groups have valid bounds inside the illustration`, () => {
    for (const side of ['front', 'back']) {
      const view = views[gender][side];
      for (const p of view.paths.filter(p => p.selectable)) {
        assert.ok(Number.isFinite(p.cx) && Number.isFinite(p.cy));
        // Bezier control points can sit outside the silhouette; the label anchor must not.
        assert.ok(p.cx >= 0 && p.cx <= view.w && p.cy >= 0 && p.cy <= view.h, `${side}:${p.sourceIndex}`);
      }
      assert.ok(view.paths.some(p => p.partId === 'hand' && p.selectable));
      assert.ok(view.paths.some(p => p.partId === 'neck' && p.selectable));
    }
  });
  test(`${gender}: posterior neck and trapezius do not share a selectable area`, () => {
    const paths = views[gender].back.paths.filter(p => p.clip);
    assert.equal(paths.length, 2); assert.equal(paths[0].partId, 'neck'); assert.equal(paths[1].partId, 'trap');
    assert.equal(paths[0].clip.y + paths[0].clip.height, paths[1].clip.y);
    assert.equal(paths[0].maxY, paths[1].minY);
  });
}
test('SVG H/V coordinate bounds do not stretch female hand into the face', () => {
  const hand = views.FEMALE.front.paths.find(p => p.sourceIndex === 58);
  assert.equal(hand.partId, 'hand'); assert.ok(hand.minY > 150);
});

const store = load('src/lib/symptomCheckerStore.ts');
test('removing the primary symptom repairs the primary and clears it when empty', () => {
  store.resetSymptomChecker(); store.addSymptom('Pain'); store.addSymptom('Nausea');
  store.removeSymptom(' PAIN '); assert.equal(store.getSymptomCheckerState().primarySymptom, 'Nausea');
  store.removeSymptom('nausea'); assert.equal(store.getSymptomCheckerState().primarySymptom, null);
});
test('symptoms deduplicate case-insensitively, trim, and enforce the API count and length limits', () => {
  store.resetSymptomChecker(); store.addSymptom(' Pain '); store.addSymptom('pain');
  assert.equal(store.getSymptomCheckerState().symptoms.length, 1);
  for (let i = 1; i < 16; i++) assert.equal(store.addSymptom(`Symptom ${i}`), true);
  assert.equal(store.addSymptom('Excess'), false); assert.equal(store.getSymptomCheckerState().symptoms.length, 16);
  store.resetSymptomChecker(); store.addSymptom('a'.repeat(120)); assert.equal(store.getSymptomCheckerState().symptoms[0].length, 80);
});
test('switching anatomy mode clears old selection but preserves an explicitly restored organ', () => {
  store.resetSymptomChecker(); store.updateSymptomChecker({ selectedPartId: 'abs' });
  store.updateSymptomChecker({ mode: 'organ' }); assert.equal(store.getSymptomCheckerState().selectedPartId, null);
  store.resetSymptomChecker(); store.updateSymptomChecker({ mode: 'organ', selectedOrganId: 'heart' });
  assert.equal(store.getSymptomCheckerState().selectedOrganId, 'heart'); assert.equal(store.getSymptomCheckerState().selectedPartId, null);
});
const build = load('src/lib/symptomRequest.ts').buildSymptomRequest;
test('manual request does not retain a prior organ, body region, or organ mode', () => {
  store.resetSymptomChecker(); store.addSymptom('Nausea');
  store.updateSymptomChecker({ mode: 'organ', selectedOrganId: 'heart' }); store.updateSymptomChecker({ method: 'manual' });
  const request = build(store.getSymptomCheckerState());
  assert.equal(request.mode, 'search'); assert.equal(request.organId, undefined); assert.equal(request.bodyPartId, undefined);
});
test('request preserves primary symptom and explicit profile preference, with bounded notes and immutable symptoms', () => {
  store.resetSymptomChecker(); store.addSymptom('Pain'); store.addSymptom('Nausea');
  store.updateSymptomChecker({ primarySymptom: 'Nausea', shareToNightingale: true, pastConditions: 'a'.repeat(800), notes: 'b'.repeat(300) });
  const state = store.getSymptomCheckerState(), request = build(state);
  assert.equal(request.primarySymptom, 'Nausea'); assert.equal(request.includeHealthProfile, true); assert.ok(request.notes.length <= 1200);
  state.symptoms.push('Later'); assert.equal(request.symptoms.length, 2);
});
test('new account clears the entire in-memory medical draft and result', () => {
  const load = loader({ react: { useSyncExternalStore: () => {} }, '@/lib/storage': {} });
  const accounts = load('src/lib/localAccount.ts'), state = load('src/lib/symptomCheckerStore.ts');
  accounts.setLocalAccountId('A'); state.addSymptom('Private'); state.updateSymptomChecker({ notes: 'Private notes', result: { conditions: [] } });
  accounts.setLocalAccountId('B'); assert.equal(state.getSymptomCheckerState().symptoms.length, 0); assert.equal(state.getSymptomCheckerState().result, null); assert.equal(state.getSymptomCheckerState().notes, '');
});
test('history rejects malformed records and a late read cannot cross accounts', async () => {
  let owner = 'A', release;
  const load = loader({ '@/lib/localAccount': { localAccountId: () => owner }, '@/lib/storage': { getPreference: () => new Promise(r => { release = r; }) } });
  const history = load('src/lib/symptomResultStorage.ts');
  let pending = history.loadSymptomHistory(); release(JSON.stringify([null, { recordId: 'bad', symptoms: [] }, { recordId: 'ok', symptoms: ['a'], result: { conditions: [] } }]));
  assert.equal((await pending).length, 1);
  pending = history.loadSymptomHistory(); owner = 'B'; release(JSON.stringify([{ recordId: 'A', symptoms: ['a'], result: { conditions: [] } }]));
  assert.equal((await pending).length, 0);
});

test('concurrent history writes retain both results and storage failure permits retry', async () => {
  const values = new Map(); let fail = false;
  const load = loader({ '@/lib/localAccount': { localAccountId: () => 'A' }, '@/lib/storage': {
    getPreference: async key => values.get(key) || null,
    setPreferenceStrict: async (key, value) => { if (fail) throw new Error('disk unavailable'); values.set(key, value); },
  } });
  const history = load('src/lib/symptomResultStorage.ts');
  const session = id => ({ recordId: id, createdAt: new Date().toISOString(), symptoms: ['Synthetic'], result: { conditions: [] } });
  await Promise.all([history.saveSymptomSession(session('first')), history.saveSymptomSession(session('second'))]);
  assert.equal((await history.loadSymptomHistory()).length, 2);
  fail = true;
  await assert.rejects(() => history.saveSymptomSession(session('third')), /disk unavailable/);
  fail = false;
  await history.saveSymptomSession(session('third'));
  assert.equal((await history.loadSymptomHistory()).length, 3);
});
