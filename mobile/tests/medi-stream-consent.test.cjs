const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Medi chat F2 (2026-10-08): the phone remembers an accepted AI consent for 15 minutes. When the server
// refused a streamed Medi / MEDISCAN question with 403 AI_CONSENT_REQUIRED (revoked on the web or another
// phone, or a new consent version), the stream kept that memory: every „ხელახლა ცდა“ skipped the
// disclosure and hit the same 403 until the 15 minutes ran out. A 503 FEATURE_DISABLED kept the switch on.
// The stream now reads server errors the way every other request does (noteApiErrorSignals).

const root = path.resolve(__dirname, '..');

/** tests/helpers/loadTs.cjs plus `module` (rateLimitCopy.js is CommonJS) and the network globals the real api.ts request path needs. */
function loader(mocks, globals) {
  const cache = new Map();
  function load(file) {
    const full = path.resolve(root, file);
    if (cache.has(full)) return cache.get(full);
    const module = { exports: {} };
    cache.set(full, module.exports);
    const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, {
      module, exports: module.exports,
      require: (name) => {
        if (name in mocks) return mocks[name];
        const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(full), name) : null;
        if (base) {
          const found = [base, base + '.ts', base + '.js'].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
          if (found) return load(found);
        }
        throw Error('Unmocked dependency: ' + name);
      },
      console, Date, Promise, Map, Set, setTimeout, clearTimeout, ...globals,
    }, { filename: full });
    cache.set(full, module.exports); // CommonJS files (rateLimitCopy.js) replace module.exports
    return module.exports;
  }
  return load;
}

const json = (status, body) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (key) => (String(key).toLowerCase() === 'content-type' ? 'application/json' : null) },
  text: async () => JSON.stringify(body),
});
const sse = (events) => ({
  ok: true, status: 200,
  headers: { get: (key) => (String(key).toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
  text: async () => events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
  body: null,
});

function harness() {
  const calls = { stream: [], consent: [], sheets: [], paused: [] };
  const replies = { stream: [], consentStatus: { accepted: false, version: 'v2' }, decision: false };
  const locale = { tx: (ka) => ka, appLang: () => 'ka', isEn: () => false };
  const routes = { current: null };
  const mocks = {
    'expo-constants': { default: { expoConfig: { version: '1.0.0.21.21' } } },
    'expo-file-system/legacy': {},
    'react-native': { Platform: { OS: 'ios' } },
    '@/i18n/ka': { ka: { common: { error: 'შეცდომა', networkError: 'კავშირი', requestTimeout: 'დრო' }, upload: { failed: 'ატვირთვა' } } },
    '@/i18n/locale': locale,
    '../i18n/locale.js': locale,
    './storage': { getToken: async () => 'token-u1' },
    '@/lib/storage': { getToken: async () => 'token-u1', getPreferenceStrict: async () => null },
    './jwtSubject': { jwtSubject: () => 'u1' },
    './uploadDeadline': { UploadTimeoutError: class extends Error {}, uploadWithDeadline: async () => ({}) },
    './authConnection': { withAuthConnectionRetry: (perform) => perform() },
    './reachability': { markReachable() {}, markUnreachable() {} },
    '@/lib/reachability': { markReachable() {}, markUnreachable() {} },
    './featureFlags': { noteFeatureDisabled: (feature, message) => calls.paused.push([feature, message]) },
    './requestBreaker': { createRequestBreaker: () => ({ check: () => ({ ok: true }) }) },
    './queryInvalidation': { invalidateAfterWrite() {} },
    '@/lib/localAccount': { localAccountId: () => 'u1', scopedPrefKey: (key) => key },
    '@/lib/mediCycleAccess': { mediCycleAccess: async () => false },
    // The real disclosure sheet (a React store): record that it opened and answer like the person would.
    '@/lib/aiSharingConsent': {
      isAiSharingRequest: (...args) => routes.current.isAiSharingRequest(...args),
      needsAiConsentPrompt: (...args) => routes.current.needsAiConsentPrompt(...args),
      requestAiSharingPrompt: async (owner, status, save) => {
        calls.sheets.push(status.version);
        if (!replies.decision) return false;
        await save('accepted', status.version);
        return true;
      },
    },
    'expo/fetch': { fetch: async (url, init) => { calls.stream.push(JSON.parse(init.body)); return replies.stream.shift(); } },
  };
  const fetch = async (url, init = {}) => {
    calls.consent.push([init.method || 'GET', String(url).replace(/^.*\/api/, '/api')]);
    if (init.method === 'PUT') { replies.consentStatus = { accepted: true, version: 'v2' }; return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify(replies.consentStatus) }; }
    return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify(replies.consentStatus) };
  };
  const load = loader(mocks, { fetch, AbortController, TextDecoder, URL, process: { env: {} } });
  routes.current = load('src/lib/aiSharingRoutes.js');
  const stream = load('src/lib/aiQueryStream.js');
  const api = load('src/lib/api.ts');
  return { calls, replies, routes: routes.current, stream, api };
}

const REVOKED = { error: 'AI დამუშავების ნებართვა საჭიროა.', code: 'AI_CONSENT_REQUIRED' };

test('a server-side „no consent“ forgets the phone memory, so the next try opens the real disclosure', async () => {
  const h = harness();
  h.routes.rememberAiConsent('u1', { accepted: true, version: 'v1' });
  h.replies.stream.push(json(403, REVOKED));
  await assert.rejects(h.stream.streamAiQuery({ message: 'თავი მტკივა', mode: 'DOCTOR' }), (error) => error.code === 'AI_CONSENT_REQUIRED' && error.status === 403);
  assert.equal(h.calls.stream.length, 1);
  assert.equal(h.calls.sheets.length, 0, 'the 403 itself never opens or answers the sheet');
  assert.equal(h.routes.hasFreshAiConsent('u1'), false, 'the 15-minute memory is gone');

  // „ხელახლა ცდა“: the real consent path asks the server and opens the disclosure. Declining sends nothing.
  await assert.rejects(h.stream.streamAiQuery({ message: 'თავი მტკივა', mode: 'DOCTOR' }), (error) => error.code === 'AI_CONSENT_DECLINED');
  assert.deepEqual(h.calls.sheets, ['v2']);
  assert.equal(h.calls.stream.length, 1, 'nothing reached /api/ai/query after the decline');

  // Accepting in the sheet records the choice on the server first, then the question goes out once.
  h.replies.decision = true;
  h.replies.stream.push(sse([{ type: 'delta', text: 'პასუხი' }, { type: 'done', answer: 'პასუხი', sessionId: 's1' }]));
  const done = await h.stream.streamAiQuery({ message: 'თავი მტკივა', mode: 'DOCTOR' });
  assert.equal(done.answer, 'პასუხი');
  assert.deepEqual(h.calls.sheets, ['v2', 'v2']);
  assert.ok(h.calls.consent.some(([method]) => method === 'PUT'), 'the acceptance was saved on the server');
  assert.equal(h.calls.stream.length, 2);
});

test('a paused Medi mode answered on the stream hides its switch at once', async () => {
  const h = harness();
  h.routes.rememberAiConsent('u1', { accepted: true, version: 'v1' });
  h.replies.stream.push(json(503, { error: 'კონსილიუმი დროებით შეჩერებულია.', code: 'FEATURE_DISABLED', feature: 'mediDeep' }));
  await assert.rejects(h.stream.streamAiQuery({ message: 'კითხვა', mode: 'CONSILIUM' }), (error) => error.code === 'FEATURE_DISABLED');
  assert.deepEqual(h.calls.paused, [['mediDeep', 'კონსილიუმი დროებით შეჩერებულია.']]);
  assert.equal(h.routes.hasFreshAiConsent('u1'), true, 'consent memory is untouched by other errors');
});

test('JSON requests and the stream share one error reader', () => {
  const h = harness();
  h.routes.rememberAiConsent('u1', { accepted: true, version: 'v1' });
  h.api.noteApiErrorSignals(403, { code: 'SOMETHING_ELSE' }, 'x');
  assert.equal(h.routes.hasFreshAiConsent('u1'), true);
  h.api.noteApiErrorSignals(403, REVOKED, REVOKED.error);
  assert.equal(h.routes.hasFreshAiConsent('u1'), false);
  const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
  assert.match(api.slice(api.indexOf('function parseJsonBody')), /noteApiErrorSignals\(status, payload, serverError\)/);
  assert.match(fs.readFileSync(path.join(root, 'src/lib/aiQueryStream.js'), 'utf8'), /noteApiErrorSignals\(status, payload, message\);\s*throw new ApiError/);
});
