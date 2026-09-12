/**
 * Trace ka.ts keys added vs git HEAD. Read-only except writing this QA folder.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from '../../mobile/node_modules/typescript/lib/typescript.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'qa', 'georgian-l10n-phase3');
const KA = path.join(ROOT, 'mobile', 'src', 'i18n', 'ka.ts');
const require = createRequire(import.meta.url);
const GEO = /[\u10A0-\u10FF]/;
const PH = /(\{[A-Za-z0-9_]+\}|\$\{[^}]+\}|%[sdif])/g;
const DIRECT_RE =
  /(შენ |შენი |შენთვის|\bგინდა\b|სცადე[^თ]|შეამოწმე[^თ]|აღრიცხე[^თ]|დაამატე[^თწნ]|ჰკითხე|დალიე[^თ])/;
const FORMAL_RE =
  /(თქვენ|თქვენი|გსურთ|სცადეთ|შეამოწმეთ|აირჩიეთ|მიუთითეთ|დაამატეთ|შეინახეთ|დალიეთ|შეიყვანეთ)/;

function transpileKa(src, extraPrelude = '') {
  const stripped = src.replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '');
  const { outputText } = ts.transpileModule(stripped, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: false,
    },
    fileName: 'ka.ts',
  });
  const prelude = extraPrelude + '\n';
  const wrapped = `${prelude}${outputText}`;
  const m = { exports: {} };
  const fn = new Function('module', 'exports', 'require', wrapped);
  fn(m, m.exports, require);
  return m.exports.ka;
}

function flatten(obj, prefix = '', out = {}) {
  if (obj == null) {
    if (prefix) out[prefix] = String(obj);
    return out;
  }
  if (typeof obj === 'function') {
    out[prefix] = obj.toString();
    return out;
  }
  if (typeof obj !== 'object') {
    out[prefix] = String(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    const geo = obj.some((x) => typeof x === 'string' && GEO.test(x));
    if (geo || obj.every((x) => typeof x !== 'object' || x == null)) {
      out[prefix] = JSON.stringify(obj);
      return out;
    }
    obj.forEach((item, i) => flatten(item, `${prefix}.${i}`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

function voiceOf(text, dotted) {
  const t = String(text || '');
  const hasF = FORMAL_RE.test(t);
  const hasD = DIRECT_RE.test(t);
  if (hasF && hasD) return 'mixed';
  if (hasF) return 'formal';
  if (hasD) return 'direct';
  const labelish = /(title|Title|label|Label|placeholder|Placeholder|unit|hub|name|Name)$/.test(
    dotted.split('.').pop() || '',
  );
  return labelish ? 'label' : 'neutral';
}

function walkFiles(dir, acc = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
      walkFiles(p, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const SCREEN_HINTS = [
  ['app/(auth)/sign-in', 'Authentication / login'],
  ['app/(auth)/sign-up', 'Authentication / registration'],
  ['app/(auth)/phone', 'Authentication / phone OTP'],
  ['app/(auth)/forgot-password', 'Authentication / password recovery'],
  ['app/(auth)/assessment', 'Onboarding / assessment'],
  ['app/(auth)/profile-setup', 'Onboarding / profile setup'],
  ['app/(tabs)/home', 'Home'],
  ['app/(tabs)/index', 'Home'],
  ['components/home/', 'Home'],
  ['app/chat/', 'Medi chat'],
  ['components/chat/', 'Medi chat'],
  ['app/cycle/pregnancy', 'Pregnancy'],
  ['pregnancyCare', 'Pregnancy / care planner'],
  ['pregnancyTimeline', 'Pregnancy / timeline'],
  ['app/cycle/', 'Cycle'],
  ['components/cycle/', 'Cycle'],
  ['health-metrics/hydration', 'Hydration'],
  ['components/hydration', 'Hydration'],
  ['lib/hydration', 'Hydration'],
  ['components/medications', 'Medications'],
  ['app/medications', 'Medications'],
  ['app/(tabs)/meds', 'Medications'],
  ['medi-quest', 'Quest'],
  ['components/quest', 'Quest'],
  ['i18n/quest', 'Quest'],
  ['notification', 'Notifications'],
  ['pushCopy', 'Push / notifications'],
  ['pushTemplates', 'Push / backend'],
  ['app/(tabs)/profile', 'Profile'],
  ['app/profile', 'Profile / settings'],
  ['lib/companion', 'Medi companion'],
  ['lib/weather', 'Home / weather'],
  ['constants/cycle', 'Cycle constants'],
  ['constants/conditionCatalog', 'Health profile / conditions'],
];

function screenFor(paths) {
  const joined = paths.join(' ').replaceAll('\\', '/');
  for (const [needle, label] of SCREEN_HINTS) {
    if (joined.includes(needle)) return label;
  }
  return paths.length ? 'unresolved reference' : '—';
}

function loadSources() {
  const roots = [path.join(ROOT, 'mobile'), path.join(ROOT, 'server', 'src')];
  const blobs = [];
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      const rel = path.relative(ROOT, file).replaceAll('\\', '/');
      if (rel === 'mobile/src/i18n/ka.ts') continue;
      if (rel.endsWith('_trace_ka.mjs')) continue;
      try {
        blobs.push({ rel, text: fs.readFileSync(file, 'utf8') });
      } catch {
        /* ignore */
      }
    }
  }
  return blobs;
}

const DYNAMIC_PARENTS = new Set([
  'periTrendFamily',
  'pregnancyTrendFamily',
  'periTrendFlow',
  'pregnancyTrendFlow',
  'energyLevel',
  'trendGroup',
  'painType',
  'painSeverity',
  'formLabels',
  'dosageUnitLabels',
  'mealTiming',
]);

function findConsumers(dotted, blobs) {
  const parts = dotted.split('.');
  const leaf = parts[parts.length - 1];
  const parent = parts.length >= 2 ? parts[parts.length - 2] : '';
  const section = parts[0];
  const hits = [];
  const shortLeaf = leaf.length < 6 || /^(title|body|label|hint|empty|cta|open|add|save|note)$/i.test(leaf);

  for (const { rel, text } of blobs) {
    if (text.includes(`ka.${dotted}`)) {
      hits.push(rel);
      continue;
    }
    if (parts.length === 2 && text.includes(`ka.${section}.${leaf}`)) {
      hits.push(rel);
      continue;
    }
    if (dotted.startsWith('cycle.carePlan.')) {
      if (text.includes('ka.cycle.carePlan') && text.includes(`copy.${leaf}`)) {
        hits.push(rel);
        continue;
      }
      if (text.includes(`pregnancyCareCopy('${leaf}')`) || text.includes(`pregnancyCareCopy("${leaf}")`)) {
        hits.push(rel);
        continue;
      }
    }
    if (dotted.startsWith('cycle.timeline.')) {
      if (text.includes('ka.cycle.timeline') && text.includes(`copy.${leaf}`)) {
        hits.push(rel);
        continue;
      }
      if (text.includes('timelineCopy(') && (text.includes(`'${leaf}'`) || text.includes(`"${leaf}"`))) {
        hits.push(rel);
        continue;
      }
    }
    if (parent && !shortLeaf && text.includes(`ka.${section}.${parent}`)) {
      hits.push(rel);
      continue;
    }
    if (
      !shortLeaf &&
      (text.includes(`'${leaf}'`) || text.includes(`"${leaf}"`) || text.includes(`.${leaf}`))
    ) {
      if (
        text.includes(`ka.${section}`) ||
        (section === 'cycle' && text.includes('ka.cycle'))
      ) {
        hits.push(rel);
      }
    }
  }
  return [...new Set(hits)];
}

function classify(dotted, consumers, preview) {
  const parts = dotted.split('.');
  const leaf = parts[parts.length - 1];
  const parent = parts[parts.length - 2] || '';
  const uiConsumers = consumers.filter((c) => /\/(app|components)\//.test(c));
  const catalogOnly = consumers.length > 0 && consumers.every((c) => /i18n\//.test(c));

  if (DYNAMIC_PARENTS.has(parent) || /^hydration\.levels\./.test(dotted) || /^assessment\.steps\./.test(dotted)) {
    return 'generated dynamically';
  }
  if (/^cycle\.(carePlan|timeline)\.(care_|ms_|src_)/.test(dotted)) {
    return 'generated dynamically';
  }
  if (/^cycle\.timeline\.(past|current|upcoming)$/.test(dotted)) {
    return 'generated dynamically';
  }
  if (consumers.some((c) => /pushCopy|pushTemplates|notificationCatalog|notificationPlan/.test(c))) {
    return 'verified in push/backend usage';
  }
  if (uiConsumers.length) return 'verified in component';
  if (catalogOnly) return 'generated dynamically';
  if (!consumers.length) {
    if (typeof preview === 'string' && preview.includes('=>')) return 'generated dynamically';
    return 'unused';
  }
  if (consumers.some((c) => /\.(tsx|ts|js)$/.test(c) && !/i18n\//.test(c))) {
    return 'verified in component';
  }
  return 'unresolved reference';
}

function placeholdersOf(text) {
  const s = String(text || '');
  const found = s.match(PH) || [];
  // also capture template ${} inside function source
  return [...new Set(found)].join(', ');
}

function duplicateOf(dotted, preview, all) {
  const norm = String(preview).replace(/\s+/g, ' ').trim();
  if (norm.length < 12) return '';
  for (const [k, v] of Object.entries(all)) {
    if (k === dotted) continue;
    if (String(v).replace(/\s+/g, ' ').trim() === norm) return k;
  }
  return '';
}

const nowSrc = fs.readFileSync(KA, 'utf8');
const oldSrc = execSync('git show HEAD:mobile/src/i18n/ka.ts', { cwd: ROOT, encoding: 'utf8' });

const pregnancyCare = require(path.join(ROOT, 'mobile', 'src', 'i18n', 'cycle', 'pregnancyCare.js'));
const pregnancyTimeline = require(path.join(ROOT, 'mobile', 'src', 'i18n', 'cycle', 'pregnancyTimeline.js'));
const prelude = `
const { PREGNANCY_CARE_COPY_KA } = require(${JSON.stringify(path.join(ROOT, 'mobile', 'src', 'i18n', 'cycle', 'pregnancyCare.js'))});
const { PREGNANCY_TIMELINE_COPY_KA } = require(${JSON.stringify(path.join(ROOT, 'mobile', 'src', 'i18n', 'cycle', 'pregnancyTimeline.js'))});
`;

const nowKa = transpileKa(nowSrc, prelude);
const oldKa = transpileKa(oldSrc, '');
const nowFlat = flatten(nowKa);
const oldFlat = flatten(oldKa);
const added = Object.keys(nowFlat).filter((k) => !(k in oldFlat)).sort();
const changed = Object.keys(nowFlat)
  .filter((k) => k in oldFlat && String(nowFlat[k]) !== String(oldFlat[k]))
  .sort();

const blobs = loadSources();
const rows = added.map((key) => {
  const preview = nowFlat[key];
  const consumers = findConsumers(key, blobs);
  let status = classify(key, consumers, preview);
  // hydration numeric levels are indexed dynamically
  if (key.startsWith('hydration.levels.') && consumers.length === 0) {
    const hydra = blobs.filter((b) => /hydration/i.test(b.rel) && /levels/.test(b.text));
    if (hydra.length) {
      consumers.push(...hydra.map((h) => h.rel));
      status = 'generated dynamically';
    }
  }
  if (key.startsWith('assessment.steps.') && consumers.length === 0) {
    const hits = blobs.filter((b) => /assessment/i.test(b.rel) && /steps/.test(b.text)).map((h) => h.rel);
    if (hits.length) {
      consumers.push(...hits);
      status = 'generated dynamically';
    }
  }
  return {
    key,
    consumers: [...new Set(consumers)].sort(),
    screen: screenFor(consumers),
    voice: voiceOf(preview, key),
    placeholders: placeholdersOf(preview) || '—',
    status,
    duplicateOf: duplicateOf(key, preview, nowFlat),
    preview: String(preview).replace(/\s+/g, ' ').slice(0, 180),
  };
});

const counts = {};
for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;

const md = [];
md.push('# Phase 3 — added `ka.ts` key traceability');
md.push('');
md.push(`Generated: 2026-09-11`);
md.push(`HEAD: e518f9a`);
md.push(`HEAD keys: **${Object.keys(oldFlat).length}**`);
md.push(`Worktree keys: **${Object.keys(nowFlat).length}**`);
md.push(`Added keys: **${added.length}**`);
md.push(`Changed existing keys: **${changed.length}**`);
md.push('');
md.push('## Status counts');
for (const [k, v] of Object.entries(counts).sort()) md.push(`- ${k}: **${v}**`);
md.push(`- unclassified: **${added.length - rows.length}**`);
md.push('');
md.push('| Key | Consumer file(s) | Screen/state | Voice | Placeholder(s) | Status |');
md.push('| --- | ---------------- | ------------ | ----- | -------------- | ------ |');
for (const r of rows) {
  const cons = r.consumers.length ? r.consumers.map((c) => `\`${c}\``).join('<br>') : '—';
  const ph = r.placeholders === '—' ? '—' : `\`${r.placeholders}\``;
  md.push(`| \`${r.key}\` | ${cons} | ${r.screen} | ${r.voice} | ${ph} | ${r.status} |`);
}
md.push('');
md.push('## Unused added keys (not deleted)');
const unused = rows.filter((r) => r.status === 'unused');
md.push(`Count: **${unused.length}**`);
for (const r of unused) md.push(`- \`${r.key}\` — ${r.preview.slice(0, 100)}`);
md.push('');
md.push('## Duplicate text among added keys');
const dups = rows.filter((r) => r.duplicateOf);
md.push(`Count: **${dups.length}**`);
for (const r of dups) md.push(`- \`${r.key}\` same as \`${r.duplicateOf}\``);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'ka-added-keys.md'), md.join('\n'), 'utf8');
fs.writeFileSync(
  path.join(OUT, 'ka-added-keys.json'),
  JSON.stringify(
    {
      head: 'e518f9a',
      head_key_count: Object.keys(oldFlat).length,
      worktree_key_count: Object.keys(nowFlat).length,
      added_count: added.length,
      changed_existing_count: changed.length,
      changed_existing: changed,
      status_counts: counts,
      rows,
    },
    null,
    2,
  ),
  'utf8',
);
console.log(
  JSON.stringify(
    {
      added: added.length,
      changed: changed.length,
      head: Object.keys(oldFlat).length,
      now: Object.keys(nowFlat).length,
      counts,
      unused: unused.length,
    },
    null,
    2,
  ),
);
console.log('carePlan sample', added.filter((k) => k.includes('carePlan')).slice(0, 5));
console.log('cycle sample', added.filter((k) => k.startsWith('cycle.')).slice(0, 15));
