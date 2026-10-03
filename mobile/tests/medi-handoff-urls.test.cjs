const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

// W2-8b — „no health text in URLs“ (AGENTS: web app + Medi rules). A screen that opens Medi with a
// drafted question built from her data (a cycle alert or tip, the doctor summary, lab values,
// symptoms) stages it in memory (`mediPrefillRoute`, mediHandoff.ts) and navigates with `handoff=1`.
// A `prefill` route param may only carry fixed copy (push routes, neutral chip questions).

const root = join(__dirname, '..');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return /\.(tsx|ts|js)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const rel = (file) => relative(root, file).split('\\').join('/');
const ALL = [join(root, 'app'), join(root, 'src')].flatMap(sources);
const CYCLE = ALL.filter((file) => {
  const r = rel(file);
  return r.startsWith('app/cycle/') || r.startsWith('src/components/cycle/') || /^src\/lib\/cycle[^/]*$/.test(r)
    || r.startsWith('src/components/home/sections/');
});

/** `mediRoute({ … prefill: X })` values that are fixed copy or a pass-through of a fixed-copy route. */
const FIXED_PREFILL = new Map([
  ['src/lib/cycleAskMedi.ts', ['cycleAskMediQuestion()']],
  // Legacy /chat/<mode>?prefill=… redirect: forwards whatever the old route carried, adds nothing.
  ['app/chat/[mode].tsx', ['params.prefill']],
  // The legacy-route parser in the same pure module.
  ['src/lib/mediModes.ts', ["params.get('prefill')"]],
]);

function offenders(files) {
  const out = [];
  for (const file of files) {
    const r = rel(file);
    const src = readFileSync(file, 'utf8');
    // 1. A template-literal route with an interpolated prefill.
    if (/['"`]\/(assistant|chat\/)[^'"`]*prefill=\$\{/.test(src)) out.push(`${r}: template /assistant?…prefill=\${…}`);
    // 2. An object route `{ pathname: '/assistant' | '/chat/…', params: { … prefill … } }`.
    for (const m of src.matchAll(/pathname:\s*['"`]\/(assistant|chat\/[^'"`]*)['"`]/g)) {
      const tail = src.slice(m.index, m.index + 240);
      const end = tail.indexOf('}');
      if (/\bprefill\b/.test(end >= 0 ? tail.slice(0, end + 1) : tail)) {
        out.push(`${r}: { pathname: '/${m[1]}', params: { prefill } }`);
      }
    }
    // 3. mediRoute({ prefill: <anything but fixed copy> }).
    for (const m of src.matchAll(/mediRoute\(\{[^}]*\bprefill:\s*([^,}]+?)\s*[,}]/g)) {
      const value = m[1].trim();
      if (!(FIXED_PREFILL.get(r) ?? []).includes(value)) out.push(`${r}: mediRoute({ prefill: ${value} })`);
    }
  }
  return out;
}

test('cycle files never build an /assistant route with a variable prefill', () => {
  assert.ok(CYCLE.length > 20, `expected the cycle sources, found ${CYCLE.length}`);
  assert.deepEqual(offenders(CYCLE), []);
});

test('no mobile screen puts drafted health text into an /assistant or /chat/ route', () => {
  assert.deepEqual(offenders(ALL), []);
});

test('the guard catches the patterns it is meant to catch', () => {
  const { writeFileSync, mkdtempSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'medi-handoff-'));
  try {
    const bad = join(dir, 'bad.tsx');
    writeFileSync(bad, [
      "router.push(`/assistant?mode=doctor&prefill=${encodeURIComponent(top.messageKa)}`);",
      "router.push({ pathname: '/assistant', params: { mode: 'doctor', prefill: plan.chatPrefill! } });",
      "router.push(mediRoute({ mode: 'doctor', prefill: question }));",
    ].join('\n'));
    assert.equal(offenders([bad]).length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the drafted-question entry points stage the text in memory', () => {
  const users = {
    'src/components/cycle/CycleAlertsBanner.tsx': /mediPrefillRoute\(user\?\.id, top\.messageKa\)/,
    'src/components/cycle/CycleInsightDetailSheet.tsx': /mediPrefillRoute\(user\?\.id, text\)/,
    'app/cycle/summary.tsx': /mediPrefillRoute\(user\?\.id, chatContext\)/,
    'src/lib/cycleAskMediLaunch.ts': /mediPrefillRoute\(owner, question, 'doctor'\)/,
    'app/lab/index.tsx': /mediPrefillRoute\(localAccountId\(\), labMediPrompt\(panels\)\)/,
    'app/symptoms/results.tsx': /mediPrefillRoute\(user\?\.id, state\.symptoms\.join/,
    'app/symptoms/condition/[id].tsx': /mediPrefillRoute\(localAccountId\(\),/,
  };
  for (const [file, pattern] of Object.entries(users)) {
    assert.match(readFileSync(join(root, ...file.split('/')), 'utf8'), pattern, file);
  }
  // The consultation takes the draft once, only for `handoff=1`, and still accepts a plain prefill.
  const consult = readFileSync(join(root, 'src', 'components', 'chat', 'MediConsultation.tsx'), 'utf8');
  assert.match(consult, /handoff \? takeMediPrefill\(user\.id\) : null/);
  assert.match(consult, /useState\(typeof params\.prefill === 'string' \? params\.prefill : ''\)/);
  const screen = readFileSync(join(root, 'app', 'assistant.tsx'), 'utf8');
  assert.match(screen, /handoff=\{requestedOn && params\.handoff === '1'\}/);
});
