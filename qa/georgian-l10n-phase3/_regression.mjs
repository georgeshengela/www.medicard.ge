/**
 * Phase 3 localization regression: parse, placeholders, push lockstep, Cyrillic-in-Georgian.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from '../../mobile/node_modules/typescript/lib/typescript.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const GEO = /[\u10A0-\u10FF]/;
const CYR = /[\u0400-\u04FF]/;
const PH = /\{[A-Za-z0-9_]+\}/g;

function transpileKa(src, extraPrelude = '') {
  const stripped = src.replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '');
  const { outputText } = ts.transpileModule(stripped, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: 'ka.ts',
  });
  const m = { exports: {} };
  const fn = new Function('module', 'exports', 'require', extraPrelude + '\n' + outputText);
  fn(m, m.exports, require);
  return m.exports.ka;
}

function flatten(obj, prefix = '', out = {}) {
  if (obj == null) return out;
  if (typeof obj === 'function') {
    out[prefix] = obj.toString();
    return out;
  }
  if (typeof obj !== 'object') {
    out[prefix] = String(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    out[prefix] = JSON.stringify(obj);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

const prelude = `
const { PREGNANCY_CARE_COPY_KA } = require(${JSON.stringify(path.join(ROOT, 'mobile/src/i18n/cycle/pregnancyCare.js'))});
const { PREGNANCY_TIMELINE_COPY_KA } = require(${JSON.stringify(path.join(ROOT, 'mobile/src/i18n/cycle/pregnancyTimeline.js'))});
`;
const kaSrc = fs.readFileSync(path.join(ROOT, 'mobile/src/i18n/ka.ts'), 'utf8');
const ka = transpileKa(kaSrc, prelude);
if (!ka || !ka.auth || !ka.auth.networkError) throw new Error('ka.ts failed to parse or missing auth.networkError');
const flat = flatten(ka);
console.log('PARSE_OK keys', Object.keys(flat).length);

const headSrc = execSync('git show HEAD:mobile/src/i18n/ka.ts', { cwd: ROOT, encoding: 'utf8' });
const headKa = transpileKa(headSrc, '');
const headFlat = flatten(headKa);
const shared = Object.keys(headFlat).filter((k) => k in flat);
const changedPh = [];
for (const k of shared) {
  const a = String(headFlat[k]).match(PH) || [];
  const b = String(flat[k]).match(PH) || [];
  const sa = [...new Set(a)].sort().join(',');
  const sb = [...new Set(b)].sort().join(',');
  if (sa !== sb) changedPh.push({ k, head: sa, now: sb });
}
console.log('PLACEHOLDER_CHANGED_SHARED', changedPh.length);
if (changedPh.length) console.log(JSON.stringify(changedPh.slice(0, 20), null, 2));

function cyrInGeoToken(text) {
  const hits = [];
  const tokens = String(text).split(/(\s+)/);
  for (const t of tokens) {
    if (GEO.test(t) && CYR.test(t)) hits.push(t);
  }
  return hits;
}
let cyrHits = 0;
for (const [k, v] of Object.entries(flat)) {
  const hits = cyrInGeoToken(v);
  if (hits.length) {
    cyrHits += hits.length;
    console.log('CYR', k, hits.slice(0, 3).join(' | '));
  }
}
console.log('CYRILLIC_IN_GEO_TOKEN', cyrHits);

const mobilePush = fs.readFileSync(path.join(ROOT, 'mobile/src/lib/pushCopy.ts'), 'utf8');
const serverPush = fs.readFileSync(path.join(ROOT, 'server/src/lib/pushTemplates.js'), 'utf8');
const mFall = [...mobilePush.matchAll(/^\s+'([^']+)':\s*\{[\s\S]*?title:\s*'((?:\\'|[^'])*)'[\s\S]*?body:\s*'((?:\\'|[^'])*)'/gm)];
console.log('MOBILE_PUSH_FALLBACKS_PARSED', mFall.length);
let mismatch = 0;
for (const [, key, title, body] of mFall) {
  const tRe = new RegExp(`${key}[\\s\\S]{0,400}title:\\s*'${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`);
  const bRe = new RegExp(`body:\\s*'${body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`);
  // simpler: both files should contain the exact title and body strings
  if (!serverPush.includes(title) || !serverPush.includes(body)) {
    mismatch += 1;
    console.log('PUSH_MISMATCH', key);
  }
}
console.log('PUSH_TEXT_MISMATCHES', mismatch);

if (!flat['auth.retry'] || !String(flat['auth.networkError']).includes('შეამოწმეთ')) {
  throw new Error('formal auth keys missing');
}
if (!String(flat['hydration.levels.1.title']).includes('ძალიან დაბალია')) {
  throw new Error('hydration level 1 title missing');
}
console.log('AUTH_FORMAL_OK', flat['auth.retry'], '|', flat['auth.networkError']);
console.log('HYDRATION_L1', flat['hydration.levels.1.title'], '|', flat['hydration.levels.1.body']);
console.log('HYDRATION_L2', flat['hydration.levels.2.title'], '|', flat['hydration.levels.2.body']);
console.log('COMMON_RETRY_UNCHANGED', flat['common.retry']);
