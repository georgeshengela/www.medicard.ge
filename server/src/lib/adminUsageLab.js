/**
 * Admin #/usage/lab — MEDILAB + MEDISCAN: who reads lab sheets, imaging („გამოსახულება“) and skin photos,
 * who asks „ამიხსენი“, who keeps tests in MEDILAB and comes back.
 *
 * Sources (no screen tracking for MEDISCAN):
 * - MedicalRecord LAB / XRAY / CT_MRI / SKIN / SKINCARE — a saved result. A lab sheet read (/api/ai/extract-lab)
 *   leaves ONLY this row: it writes no AiInteraction, and an unreadable sheet (422) leaves nothing at all.
 * - AiInteraction LAB („ამიხსენი“ = /api/ai/explain-lab), LAB_ALIGN (MEDILAB „სახელების გასწორება“), IMAGING, SKIN,
 *   SKINCARE — every AI call with its status, latency and cost. ERROR_REVIEWED = an error the admin has looked at.
 * - HealthProfile.extraAnswers.labPanels — the tests MEDILAB keeps (one panel = one test date).
 * A question typed after a MEDISCAN result goes to Medi (DOCTOR) without a marker, so it is counted on the Medi
 * page, not here. SYMPTOM records belong to the Medi page too.
 *
 * Privacy: the response carries names, contacts and counts only — never values, test dates, findings, AI text,
 * images or image keys. Panels are reduced in SQL to counts + test keys; a test name or an imaging body region is
 * named only when at least LAB_K_ANON different people share it, everything else folds into „სხვა“.
 */
import { prisma } from './prisma.js';
import { addDaysYmd, createdAtToTbilisiYmd, rateSafe, tbilisiMidnight, tbilisiYmd } from './adminAnalyticsRange.js';
import { activityTracker, bump, daySeries, flagState, iso, loadPeople, loadTeamUserIds, median, missingTable, ms, percentile, personSummary, USAGE_PERIODS, usageWindow } from './adminUsageKit.js';
import { listFeatureFlags } from './featureFlags.js';

/** The wall lists at most this many people (newest activity first); every count still covers all of them. */
export const LAB_USAGE_LIST_MAX = 400;
/** A test name or a body region is shown only when this many different people share it. */
export const LAB_K_ANON = 3;
export const LAB_RECORD_TYPES = Object.freeze(['LAB', 'XRAY', 'CT_MRI', 'SKIN', 'SKINCARE', 'PRESCRIPTION']);
export const LAB_AI_MODES = Object.freeze(['LAB', 'LAB_ALIGN', 'IMAGING', 'SKIN', 'SKINCARE']);
const ERROR_STATUSES = new Set(['ERROR', 'ERROR_REVIEWED']);

/** Body regions offered by MEDISCAN (mobile ka.modules.imaging.regions): the English label in the log → id. */
const REGION_BY_EN = {
  'hip / femur': 'hip-femur',
  knee: 'knee',
  'tibia / fibula / leg': 'tibia-fibula',
  'ankle / foot': 'ankle-foot',
  pelvis: 'pelvis',
  spine: 'spine',
  chest: 'chest',
  abdomen: 'abdomen',
  shoulder: 'shoulder',
  'humerus / elbow / forearm': 'arm',
  'wrist / hand': 'hand',
  'skull / cervical spine': 'head-neck',
};
export const IMAGING_REGION_KEYS = Object.freeze([...Object.values(REGION_BY_EN), 'other']);

export function imagingRegionKey(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  return REGION_BY_EN[t] || 'other';
}

/** Lab sheet keys that mean the same test (OCR / French / long names) → one key. */
const TEST_ALIASES = {
  hematocrit: 'hct', hematocrite: 'hct', platelets: 'plt', bilirubin_total: 'bilirubin', total_bilirubin: 'bilirubin',
  alkaline_phosphatase: 'alp', alkaline_phosphatase_alp: 'alp', thyroid_stimulating_hormone: 'tsh', hdl_cholesterol: 'hdl',
  ldl_cholesterol: 'ldl', total_cholesterol: 'cholesterol', total_testosterone: 'testosterone', prothrombin_time: 'pt_time',
  prothrombin_index: 'pt_percent', estrogen: 'estradiol', sgpt: 'alt', sgot: 'ast', hb: 'hemoglobin', hgb: 'hemoglobin',
  leukocytes: 'wbc', erythrocytes: 'rbc', vitamin_d3: 'vitamin_d', b12: 'vitamin_b12', ft4: 'free_t4', ft3: 'free_t3',
};
/** Georgian names of the tests the page may name (only these are ever listed one by one). */
export const LAB_TEST_NAMES = Object.freeze({
  hemoglobin: 'ჰემოგლობინი', hct: 'ჰემატოკრიტი', rbc: 'ერითროციტები', wbc: 'ლეიკოციტები', plt: 'თრომბოციტები',
  mcv: 'ერითროციტის მოცულობა (MCV)', mch: 'ჰემოგლობინი ერითროციტში (MCH)', mchc: 'MCHC', rdw: 'RDW', mpv: 'MPV',
  neutrophils: 'ნეიტროფილები', lymphocytes: 'ლიმფოციტები', monocytes: 'მონოციტები', eosinophils: 'ეოზინოფილები', basophils: 'ბაზოფილები',
  esr: 'ედს', glucose: 'გლუკოზა', hba1c: 'გლიკირებული ჰემოგლობინი', insulin: 'ინსულინი', fructosamine: 'ფრუქტოზამინი',
  creatinine: 'კრეატინინი', urea: 'შარდოვანა', egfr: 'eGFR', uric_acid: 'შარდმჟავა', alt: 'ALT', ast: 'AST', ggt: 'გამა-გტ',
  alp: 'ტუტე ფოსფატაზა', ldh: 'LDH', bilirubin: 'ბილირუბინი', bilirubin_direct: 'პირდაპირი ბილირუბინი',
  total_protein: 'საერთო ცილა', albumin: 'ალბუმინი', amylase: 'ამილაზა', lipase: 'ლიპაზა', cpk: 'CPK', ck_mb: 'CK-MB',
  crp: 'C-რეაქტიული ცილა', sodium: 'ნატრიუმი', potassium: 'კალიუმი', chloride: 'ქლორიდი', calcium: 'კალციუმი',
  phosphorus: 'ფოსფორი', magnesium: 'მაგნიუმი', cholesterol: 'ქოლესტერინი', hdl: 'HDL', ldl: 'LDL',
  triglycerides: 'ტრიგლიცერიდები', apob: 'აპოლიპოპროტეინი B', tsh: 'TSH', free_t4: 'თავისუფალი T4', free_t3: 'თავისუფალი T3',
  t3: 'T3', t4: 'T4', vitamin_d: 'ვიტამინი D', vitamin_b12: 'ვიტამინი B12', folate: 'ფოლიუმის მჟავა', iron: 'რკინა',
  ferritin: 'ფერიტინი', transferrin: 'ტრანსფერინი', tsat: 'ტრანსფერინის სატურაცია', zinc: 'თუთია',
  testosterone: 'ტესტოსტერონი', free_testosterone: 'თავისუფალი ტესტოსტერონი', estradiol: 'ესტრადიოლი',
  progesterone: 'პროგესტერონი', prolactin: 'პროლაქტინი', cortisol: 'კორტიზოლი', shbg: 'SHBG', lh: 'LH', fsh: 'FSH',
  inr: 'INR', pt_time: 'პროთრომბინის დრო', pt_percent: 'პროთრომბინის ინდექსი', fibrinogen: 'ფიბრინოგენი',
  d_dimer: 'D-დიმერი', aptt: 'APTT', psa: 'PSA', troponin: 'ტროპონინი', homocysteine: 'ჰომოცისტეინი',
});
const GROUP_OF = {};
for (const [group, keys] of Object.entries({
  cbc: ['hemoglobin', 'hct', 'rbc', 'wbc', 'plt', 'mcv', 'mch', 'mchc', 'rdw', 'mpv', 'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils', 'nlr', 'esr'],
  biochem: ['creatinine', 'urea', 'egfr', 'uric_acid', 'alt', 'ast', 'ggt', 'alp', 'ldh', 'bilirubin', 'bilirubin_direct', 'total_protein', 'albumin', 'amylase', 'lipase', 'cpk', 'ck_mb', 'crp', 'sodium', 'potassium', 'chloride', 'calcium', 'phosphorus', 'magnesium'],
  sugar: ['glucose', 'hba1c', 'insulin', 'fructosamine'],
  lipids: ['cholesterol', 'hdl', 'ldl', 'triglycerides', 'apob', 'remnant_cholesterol'],
  thyroid: ['tsh', 'free_t4', 'free_t3', 't3', 't4'],
  vitamins: ['vitamin_d', 'vitamin_b12', 'folate', 'iron', 'ferritin', 'transferrin', 'tsat', 'zinc'],
  hormones: ['testosterone', 'free_testosterone', 'estradiol', 'progesterone', 'prolactin', 'cortisol', 'shbg', 'lh', 'fsh'],
  coagulation: ['inr', 'pt_time', 'pt_percent', 'fibrinogen', 'd_dimer', 'aptt'],
})) for (const key of keys) GROUP_OF[key] = group;
export const LAB_TEST_GROUPS = Object.freeze(['cbc', 'biochem', 'sugar', 'lipids', 'thyroid', 'vitamins', 'hormones', 'coagulation', 'other']);

/** One sheet key → the test it names (`neutrophils_pct` and `neutrophils_abs` are both „ნეიტროფილები“). */
export function canonicalTestKey(raw) {
  let key = String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) return null;
  key = TEST_ALIASES[key] || key;
  if (/_ratio$/.test(key)) return key.includes('hdl') || key.includes('ldl') || key.includes('cholesterol') || key.includes('triglycerides') ? 'lipid_ratio' : key;
  const base = key.replace(/_(pct|percent|abs|absolute|count)$/, '');
  return TEST_ALIASES[base] || base;
}

export function testGroup(key) {
  if (key === 'lipid_ratio') return 'lipids';
  return GROUP_OF[key] || 'other';
}

const validMs = (value) => {
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ''));
  return Number.isFinite(t) ? t : 0;
};
const ymdOf = (value) => (validMs(value) ? createdAtToTbilisiYmd(new Date(validMs(value))) : null);
const costOf = (row) => {
  const c = Number(row?.cost ?? row?.tokenUsage?.cost);
  return Number.isFinite(c) ? c : 0;
};
const round4 = (n) => Math.round(n * 10000) / 10000;

function aiStats(rows) {
  const ok = rows.filter((r) => r.status === 'OK');
  const latencies = ok.map((r) => Number(r.latencyMs)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  return {
    calls: rows.length,
    ok: ok.length,
    errors: rows.filter((r) => r.status === 'ERROR').length,
    reviewed: rows.filter((r) => r.status === 'ERROR_REVIEWED').length,
    users: new Set(rows.map((r) => r.userId)).size,
    avgMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    p95Ms: percentile(latencies, 95),
    costUsd: round4(rows.reduce((sum, r) => sum + costOf(r), 0)),
    lastAt: rows.reduce((max, r) => Math.max(max, ms(r.createdAt)), 0) || null,
  };
}

/**
 * Pure: raw rows (all accounts) → the page payload. `raw` comes from loadLabUsageRaw (or a test fixture).
 * @param {object} raw
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildLabUsage(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const win = usageWindow(days, now);
  const teamIds = new Set(raw.teamUserIds || []);
  const keep = (row) => includeTeam || !teamIds.has(row.userId);

  const allRecords = (raw.records || []).filter((r) => LAB_RECORD_TYPES.includes(r.type));
  const allAi = (raw.ai || []).filter((r) => LAB_AI_MODES.includes(r.mode));
  const allPanels = raw.panels || [];
  const records = allRecords.filter(keep);
  const ai = allAi.filter(keep);
  const feedback = (raw.feedback || []).filter(keep);
  const people = new Map((raw.people || []).map((u) => [u.id, u]));

  // A panel whose lab uploads were all deleted leaves MEDILAB with them (appState.withoutDeletedRecords).
  const labIds = new Set(allRecords.filter((r) => r.type === 'LAB' && r.id).map((r) => r.id));
  const panels = allPanels.filter(keep).filter((p) => !(p.recordIds || []).length || p.recordIds.some((id) => labIds.has(id)));

  // ── reads per kind: the AI log when the person has it (it survives a deleted result), else the saved record ──
  const okAi = (mode) => ai.filter((r) => r.mode === mode && r.status === 'OK');
  function readEvents(mode, types) {
    const fromAi = new Map();
    for (const r of okAi(mode)) {
      if (!fromAi.has(r.userId)) fromAi.set(r.userId, []);
      fromAi.get(r.userId).push(r);
    }
    const fromRecords = new Map();
    for (const r of records.filter((x) => types.includes(x.type))) {
      if (!fromRecords.has(r.userId)) fromRecords.set(r.userId, []);
      fromRecords.get(r.userId).push(r);
    }
    const out = [];
    for (const userId of new Set([...fromAi.keys(), ...fromRecords.keys()])) out.push(...(fromAi.get(userId) || fromRecords.get(userId) || []));
    return out;
  }
  const labSheets = records.filter((r) => r.type === 'LAB');
  const explains = okAi('LAB');
  const aligns = okAi('LAB_ALIGN');
  const imaging = readEvents('IMAGING', ['CT_MRI', 'XRAY']);
  const skin = readEvents('SKIN', ['SKIN']);
  const skincare = readEvents('SKINCARE', ['SKINCARE']);
  const failures = ai.filter((r) => ERROR_STATUSES.has(r.status));

  // ── per person ──────────────────────────────────────────────────────────
  const tracker = activityTracker();
  const per = new Map();
  const person = (userId) => {
    if (!per.has(userId)) {
      per.set(userId, { userId, lab: 0, explain: 0, panels: 0, panelDates: new Set(), panelsExplained: 0, imaging: 0, skin: 0, skincare: 0, align: 0, failed: 0, firstAt: 0, lastAt: 0 });
    }
    return per.get(userId);
  };
  const touch = (userId, at, field) => {
    const p = person(userId);
    if (field) p[field] += 1;
    const t = validMs(at);
    if (!t) return;
    p.firstAt = p.firstAt ? Math.min(p.firstAt, t) : t;
    p.lastAt = Math.max(p.lastAt, t);
    tracker.act(userId, new Date(t));
  };
  for (const r of labSheets) touch(r.userId, r.createdAt, 'lab');
  for (const r of explains) touch(r.userId, r.createdAt, 'explain');
  for (const r of aligns) touch(r.userId, r.createdAt, 'align');
  for (const r of imaging) touch(r.userId, r.createdAt, 'imaging');
  for (const r of skin) touch(r.userId, r.createdAt, 'skin');
  for (const r of skincare) touch(r.userId, r.createdAt, 'skincare');
  for (const r of failures) touch(r.userId, r.createdAt, 'failed');
  for (const p of panels) {
    const row = person(p.userId);
    row.panels += 1;
    if (p.date) row.panelDates.add(String(p.date));
    if (p.explained) row.panelsExplained += 1;
    touch(p.userId, p.createdAt);
  }
  const list = [...per.values()];
  const users = list.length;
  const count = (fn) => list.filter(fn).length;
  const didRead = (p) => p.lab + p.imaging + p.skin + p.explain + p.panels > 0;
  const testDates = (p) => Math.max(p.panelDates.size, p.panels ? 1 : 0);

  const ladder = [
    { key: 'used', count: users },
    { key: 'read', count: count(didRead) },
    { key: 'explained', count: count((p) => p.explain > 0) },
    { key: 'saved', count: count((p) => p.panels > 0) },
    { key: 'twoTests', count: count((p) => testDates(p) >= 2) },
    { key: 'returned', count: count((p) => tracker.days(p.userId) >= 2) },
  ].map((step) => ({ ...step, rate: rateSafe(step.count, users) }));

  const accounts = Math.max(0, (raw.accountsTotal || 0) - (includeTeam ? 0 : teamIds.size));

  // ── after the first use: app return, timing from sign-up ──────────────────
  const appDays = new Map();
  for (const a of raw.appActivity || []) {
    if (!appDays.has(a.userId)) appDays.set(a.userId, new Set());
    appDays.get(a.userId).add(String(a.date).slice(0, 10));
  }
  const appReturned = count((p) => {
    const first = ymdOf(p.firstAt);
    return Boolean(first) && [...(appDays.get(p.userId) || [])].some((d) => d > first);
  });
  const timing = { sameDay: 0, week: 0, later: 0 };
  const hoursToFirst = [];
  for (const p of list) {
    const u = people.get(p.userId);
    if (!u?.createdAt || !p.firstAt) continue;
    const hours = Math.max(0, (p.firstAt - ms(u.createdAt)) / 3_600_000);
    hoursToFirst.push(hours);
    if (hours < 24) timing.sameDay += 1;
    else if (hours < 24 * 7) timing.week += 1;
    else timing.later += 1;
  }

  // ── lab tests: values per sheet, age of the sheet, which tests (k-anonymous) ──
  const paramCounts = panels.map((p) => Number(p.params) || 0).filter((n) => n > 0);
  const testAge = { fresh: 0, year: 0, older: 0, unknown: 0 };
  for (const p of panels) {
    const taken = /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || '')) ? Date.parse(`${p.date}T00:00:00Z`) : 0;
    const saved = validMs(p.createdAt);
    if (!taken || !saved) { testAge.unknown += 1; continue; }
    const daysOld = (saved - taken) / 86_400_000;
    if (daysOld <= 31) testAge.fresh += 1;
    else if (daysOld <= 366) testAge.year += 1;
    else testAge.older += 1;
  }
  const testPeople = new Map();
  const groupPeople = new Map();
  for (const p of panels) {
    for (const raw0 of p.keys || []) {
      const key = canonicalTestKey(raw0);
      if (!key) continue;
      if (!testPeople.has(key)) testPeople.set(key, new Set());
      testPeople.get(key).add(p.userId);
      const g = testGroup(key);
      if (!groupPeople.has(g)) groupPeople.set(g, new Set());
      groupPeople.get(g).add(p.userId);
    }
  }
  const tests = [...testPeople]
    .filter(([key, set]) => set.size >= LAB_K_ANON && LAB_TEST_NAMES[key])
    .map(([key, set]) => ({ key, label: LAB_TEST_NAMES[key], people: set.size }))
    .sort((a, b) => b.people - a.people || a.label.localeCompare(b.label))
    .slice(0, 16);
  const otherGroup = new Set(groupPeople.get('other') || []);
  const groups = [];
  for (const [key, set] of groupPeople) {
    if (key === 'other') continue;
    if (set.size >= LAB_K_ANON) groups.push({ key, people: set.size });
    else for (const id of set) otherGroup.add(id);
  }
  groups.sort((a, b) => b.people - a.people);
  if (otherGroup.size) groups.push({ key: 'other', people: otherGroup.size });
  const labPeople = new Set([...labSheets.map((r) => r.userId), ...panels.map((p) => p.userId)]);

  // ── imaging regions (k-anonymous) ────────────────────────────────────────
  // Reads without a region in the log (an old record, a prompt cut before the region) count as „not known“.
  const regionPeople = new Map();
  const regionReads = new Map();
  let regionKnown = 0;
  for (const r of imaging) {
    const key = imagingRegionKey(r.region);
    if (!key) continue;
    regionKnown += 1;
    if (!regionPeople.has(key)) regionPeople.set(key, new Set());
    regionPeople.get(key).add(r.userId);
    regionReads.set(key, (regionReads.get(key) || 0) + 1);
  }
  const regions = [];
  let regionOtherReads = 0;
  const regionOtherPeople = new Set();
  for (const [key, set] of regionPeople) {
    if (key !== 'other' && set.size >= LAB_K_ANON) regions.push({ key, people: set.size, reads: regionReads.get(key) });
    else {
      regionOtherReads += regionReads.get(key);
      for (const id of set) regionOtherPeople.add(id);
    }
  }
  regions.sort((a, b) => b.reads - a.reads);
  if (regionOtherReads) regions.push({ key: 'other', people: regionOtherPeople.size, reads: regionOtherReads });

  // ── AI quality per kind ──────────────────────────────────────────────────
  const fb = (mode) => feedback.filter((f) => !mode || f.mode === mode);
  const quality = LAB_AI_MODES.map((mode) => {
    const stats = aiStats(ai.filter((r) => r.mode === mode));
    return { mode, ...stats, lastAt: iso(stats.lastAt), up: fb(mode).filter((f) => f.rating > 0).length, down: fb(mode).filter((f) => f.rating < 0).length };
  });
  const allStats = aiStats(ai);
  const lastError = failures.reduce((max, r) => Math.max(max, ms(r.createdAt)), 0);

  // ── period ───────────────────────────────────────────────────────────────
  const inP = (r) => win.inPeriod(r.createdAt);
  const reads = [...labSheets, ...imaging, ...skin];
  const signups = (raw.signups || []).filter((u) => (includeTeam || !teamIds.has(u.id)) && win.inPeriod(u.createdAt));
  const signupsUsed = signups.filter((u) => per.has(u.id));
  const periodFailures = failures.filter(inP);

  // ── the wall ─────────────────────────────────────────────────────────────
  const items = list
    .map((p) => ({
      id: p.userId,
      person: personSummary(people.get(p.userId) || { id: p.userId }, { teamIds }),
      usage: {
        lab: p.lab,
        explain: p.explain,
        panels: p.panels,
        testDates: testDates(p),
        panelsExplained: p.panelsExplained,
        imaging: p.imaging,
        skin: p.skin,
        skincare: p.skincare,
        align: p.align,
        failed: p.failed,
      },
      days: tracker.days(p.userId),
      firstAt: p.firstAt ? new Date(p.firstAt).toISOString() : null,
      lastAt: p.lastAt ? new Date(p.lastAt).toISOString() : null,
    }))
    .sort((a, b) => ms(b.lastAt) - ms(a.lastAt));

  const teamOf = (rows) => rows.filter((r) => teamIds.has(r.userId));
  const teamUsers = new Set([...teamOf(allRecords.filter((r) => r.type !== 'PRESCRIPTION')), ...teamOf(allAi), ...teamOf(allPanels)].map((r) => r.userId));

  return {
    installed: true,
    generatedAt: now.toISOString(),
    includeTeam,
    team: { accounts: teamIds.size, users: teamUsers.size, labSheets: teamOf(allRecords).filter((r) => r.type === 'LAB').length },
    flags: { labs: flagState(raw.flags, 'labs'), imaging: flagState(raw.flags, 'imaging'), skin: flagState(raw.flags, 'skin'), records: flagState(raw.flags, 'records') },
    totals: {
      accounts,
      users,
      userRate: rateSafe(users, accounts),
      labSheets: labSheets.length,
      labUsers: new Set(labSheets.map((r) => r.userId)).size,
      explanations: explains.length,
      explainUsers: count((p) => p.explain > 0),
      panels: panels.length,
      panelUsers: count((p) => p.panels > 0),
      twoTests: count((p) => testDates(p) >= 2),
      imaging: imaging.length,
      imagingUsers: count((p) => p.imaging > 0),
      skin: skin.length,
      skinUsers: count((p) => p.skin > 0),
      skincare: skincare.length,
      skincareUsers: count((p) => p.skincare > 0),
      aligns: aligns.length,
      failed: failures.length,
      failedOpen: failures.filter((r) => r.status === 'ERROR').length,
      failedUsers: count((p) => p.failed > 0),
      returned: count((p) => tracker.days(p.userId) >= 2),
      appReturned,
      legacy: { xray: records.filter((r) => r.type === 'XRAY').length, prescription: records.filter((r) => r.type === 'PRESCRIPTION').length },
    },
    ladder,
    firstUse: { ...timing, medianHours: median(hoursToFirst) },
    period: {
      days: win.days,
      from: win.from,
      to: win.to,
      activeUsers: tracker.activeIn(win.from, win.to),
      newUsers: count((p) => win.inPeriod(p.firstAt ? new Date(p.firstAt) : null)),
      labSheets: labSheets.filter(inP).length,
      labUsers: new Set(labSheets.filter(inP).map((r) => r.userId)).size,
      explanations: explains.filter(inP).length,
      imaging: imaging.filter(inP).length,
      skin: skin.filter(inP).length,
      skincare: skincare.filter(inP).length,
      failed: periodFailures.length,
      signups: signups.length,
      signupsUsed: signupsUsed.length,
      signupUseRate: rateSafe(signupsUsed.length, signups.length),
      trend: {
        reads: daySeries(win.dayKeys, reads),
        active: tracker.activeByDay(win.dayKeys),
        explanations: daySeries(win.dayKeys, explains),
      },
    },
    lab: {
      sheets: labSheets.length,
      people: labPeople.size,
      panels: panels.length,
      panelsExplained: panels.filter((p) => p.explained).length,
      explainRate: rateSafe(count((p) => p.explain > 0 && (p.lab > 0 || p.panels > 0)), count((p) => p.lab > 0 || p.panels > 0)),
      valuesMedian: median(paramCounts),
      valuesMax: paramCounts.length ? Math.max(...paramCounts) : null,
      testAge,
      groups,
      tests,
      namedPeople: labPeople.size,
      kAnon: LAB_K_ANON,
    },
    imaging: {
      reads: imaging.length,
      people: count((p) => p.imaging > 0),
      regions,
      regionUnknown: imaging.length - regionKnown,
      skinReads: skin.length,
      skinPeople: count((p) => p.skin > 0),
      skincare: skincare.length,
      skincarePeople: count((p) => p.skincare > 0),
    },
    ai: {
      ...allStats,
      lastAt: iso(allStats.lastAt),
      lastErrorAt: lastError ? new Date(lastError).toISOString() : null,
      up: fb().filter((f) => f.rating > 0).length,
      down: fb().filter((f) => f.rating < 0).length,
      byMode: quality,
    },
    items: items.slice(0, LAB_USAGE_LIST_MAX),
    itemsTotal: items.length,
  };
}

/** Every row the page needs, for all accounts (the builder drops team accounts). Read-only. */
export async function loadLabUsageRaw(db = prisma, { now = new Date() } = {}) {
  const since = tbilisiMidnight(addDaysYmd(tbilisiYmd(now), -(Math.max(...USAGE_PERIODS) - 1)));
  const [teamUserIds, accountsTotal, records, aiRows, regionRows, panels, feedback, signups, flags] = await Promise.all([
    loadTeamUserIds(db),
    db.user.count(),
    // Never the image key or the analysis text: only what kind of result and when.
    db.medicalRecord.findMany({ where: { type: { in: [...LAB_RECORD_TYPES] } }, select: { id: true, userId: true, type: true, createdAt: true } }),
    db.aiInteraction.findMany({ where: { mode: { in: [...LAB_AI_MODES] } }, select: { id: true, userId: true, mode: true, status: true, latencyMs: true, tokenUsage: true, createdAt: true } }),
    // The body region the person picked rides in the logged prompt; only the region label leaves the database.
    db.$queryRaw`SELECT id, substring("userPrompt" from 'AUTHORITATIVE BODY REGION[^:]*: ([^(]+?) [(]') AS region
      FROM "AiInteraction" WHERE mode = 'IMAGING' AND "userPrompt" IS NOT NULL`,
    // MEDILAB tests reduced in SQL to counts + test keys: no value, unit, range or write-up leaves the database.
    db.$queryRaw`SELECT hp."userId" AS "userId", p->>'date' AS date, p->>'createdAt' AS "createdAt",
        length(coalesce(p->>'analysis', '')) > 0 AS explained,
        CASE WHEN jsonb_typeof(p->'parameters') = 'array' THEN jsonb_array_length(p->'parameters') ELSE 0 END AS params,
        CASE WHEN jsonb_typeof(p->'recordIds') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p->'recordIds')) ELSE ARRAY[]::text[] END AS "recordIds",
        CASE WHEN jsonb_typeof(p->'parameters') = 'array'
          THEN ARRAY(SELECT DISTINCT x->>'key' FROM jsonb_array_elements(p->'parameters') x WHERE jsonb_typeof(x) = 'object' AND x ? 'key')
          ELSE ARRAY[]::text[] END AS keys
      FROM "HealthProfile" hp
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(hp."extraAnswers"->'labPanels') = 'array' AND jsonb_array_length(hp."extraAnswers"->'labPanels') > 0 THEN hp."extraAnswers"->'labPanels'
          WHEN jsonb_typeof(hp."extraAnswers"->'appState'->'labPanels') = 'array' THEN hp."extraAnswers"->'appState'->'labPanels'
          ELSE '[]'::jsonb
        END) p
      WHERE jsonb_typeof(p) = 'object'`,
    db.aiFeedback.findMany({ where: { interaction: { mode: { in: [...LAB_AI_MODES] } } }, select: { userId: true, rating: true, interaction: { select: { mode: true } } } }),
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } }),
    listFeatureFlags(db).catch(() => []),
  ]);
  const region = new Map(regionRows.map((r) => [r.id, r.region || null]));
  const ai = aiRows.map(({ id, tokenUsage, ...r }) => ({ ...r, cost: costOf({ tokenUsage }), ...(r.mode === 'IMAGING' ? { region: region.get(id) || null } : {}) }));
  const ids = new Set([...records.filter((r) => r.type !== 'PRESCRIPTION'), ...ai, ...panels].map((r) => r.userId));
  const { people, appDays } = await loadPeople([...ids], db);
  return {
    teamUserIds,
    accountsTotal,
    records,
    ai,
    panels: panels.map((p) => ({ ...p, params: Number(p.params) || 0, keys: p.keys || [], recordIds: p.recordIds || [] })),
    feedback: feedback.map((f) => ({ userId: f.userId, rating: f.rating, mode: f.interaction?.mode || null })),
    signups,
    people,
    appActivity: appDays,
    flags,
  };
}

export async function loadLabUsage({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    const raw = await loadLabUsageRaw(db, { now });
    return buildLabUsage(raw, { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
