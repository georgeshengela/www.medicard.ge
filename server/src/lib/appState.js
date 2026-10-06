import { prisma } from './prisma.js';
import { extractLabFromText, isLabMetadataRow } from './labExtract.js';
import { unifiedWeightGoal } from './weightGoalUnify.js';

const MAX_PANELS = 200;
const MAX_PARAMS = 200;
const MAX_LOGS = 400;
const MAX_RUNS = 60;
const MAX_SYMPTOMS = 24;
const MAX_STEPS_HISTORY = 30;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function trimStr(value, max) {
  const text = String(value ?? '').trim();
  return text.slice(0, max);
}

function sanitizeParameter(row) {
  if (!row || typeof row !== 'object') return null;
  const key = trimStr(row.key, 80);
  if (!key || isLabMetadataRow(row)) return null;
  const value = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : Number(row.value);
  return {
    key,
    nameKa: trimStr(row.nameKa, 160) || key,
    nameEn: trimStr(row.nameEn, 160) || key,
    value: Number.isFinite(value) ? value : 0,
    display: trimStr(row.display, 40) || String(row.value ?? ''),
    unit: trimStr(row.unit, 40),
    refLow: typeof row.refLow === 'number' && Number.isFinite(row.refLow) ? row.refLow : null,
    refHigh: typeof row.refHigh === 'number' && Number.isFinite(row.refHigh) ? row.refHigh : null,
    flag: ['N', 'H', 'L', 'U'].includes(row.flag) ? row.flag : 'U',
  };
}

export function sanitizeLabPanel(row) {
  if (!row || typeof row !== 'object') return null;
  const date = trimStr(row.date, 12);
  const id = trimStr(row.id, 80);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parameters = asArray(row.parameters).map(sanitizeParameter).filter(Boolean).slice(0, MAX_PARAMS);
  if (!parameters.length) return null;
  return {
    id,
    date,
    createdAt: trimStr(row.createdAt, 40) || `${date}T00:00:00.000Z`,
    recordIds: asArray(row.recordIds).map((id) => trimStr(id, 80)).filter(Boolean).slice(0, 20),
    analysis: trimStr(row.analysis, 8_000),
    visionNotes: row.visionNotes ? trimStr(row.visionNotes, 8_000) : undefined,
    parameters,
    ...(row.auto === true ? { auto: true } : {}),
  };
}

/**
 * Server-made panels (extract-lab, rebuilt from a record) carry `auto`; older ones are recognised by
 * their `lab-<date>-<recordId>` id. The app's own panel (the date the person saw or chose) wins.
 */
export function isAutoLabPanel(panel) {
  if (panel?.auto === true) return true;
  const ids = asArray(panel?.recordIds);
  return ids.length === 1 && panel?.id === `lab-${panel?.date}-${ids[0]}`;
}

/**
 * One lab record is one panel. The same record under another date (a guessed date, an OCR date, the
 * date the person picked) used to show the same values two or three times in MEDILAB and its charts.
 * Later input wins among equals; the app's panels win over server-made ones; same-date copies stay
 * and are merged by date.
 */
export function dedupeLabPanelsByRecord(panels) {
  const list = asArray(panels);
  const claimed = new Map();
  const keep = new Array(list.length).fill(true);
  for (const auto of [false, true]) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const panel = list[i];
      if (!panel || isAutoLabPanel(panel) !== auto) continue;
      const ids = asArray(panel.recordIds);
      if (ids.some((id) => claimed.has(id) && claimed.get(id) !== panel.date)) {
        keep[i] = false;
        continue;
      }
      for (const id of ids) if (!claimed.has(id)) claimed.set(id, panel.date);
    }
  }
  return list.filter((_, i) => keep[i]);
}

export function mergeLabPanelLists(current, incoming) {
  const byDate = new Map();
  const sanitized = [...asArray(current), ...asArray(incoming)].map(sanitizeLabPanel).filter(Boolean);
  for (const panel of dedupeLabPanelsByRecord(sanitized)) {
    const existing = byDate.get(panel.date);
    if (!existing) {
      byDate.set(panel.date, panel);
      continue;
    }
    const params = new Map(existing.parameters.map((item) => [item.key, item]));
    for (const item of panel.parameters) params.set(item.key, item);
    const auto = existing.auto === true && panel.auto === true;
    const { auto: _auto, ...base } = existing;
    byDate.set(panel.date, {
      ...base,
      // A panel the app saved must not keep a server-made id, or it would read as server-made later.
      id: !auto && isAutoLabPanel(existing) && !isAutoLabPanel(panel) ? panel.id : existing.id,
      ...(auto ? { auto: true } : {}),
      createdAt: existing.createdAt || panel.createdAt,
      recordIds: [...new Set([...existing.recordIds, ...panel.recordIds])],
      analysis: existing.analysis || panel.analysis,
      visionNotes: existing.visionNotes || panel.visionNotes,
      parameters: [...params.values()],
    });
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_PANELS);
}

function mergeById(current, incoming, idOf, newer) {
  const map = new Map();
  for (const row of [...asArray(current), ...asArray(incoming)]) {
    if (!row || typeof row !== 'object') continue;
    const id = idOf(row);
    if (!id) continue;
    const prev = map.get(id);
    if (!prev || newer(row, prev)) map.set(id, row);
  }
  return [...map.values()];
}

function panelFromRecord(record) {
  const extract = extractLabFromText(record.aiAnalysis);
  if (!extract?.parameters?.length) return null;
  const created = record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt ?? '');
  const date = extract.date || created.slice(0, 10);
  return sanitizeLabPanel({
    id: `lab-${date}-${record.id}`,
    date,
    createdAt: created,
    recordIds: [record.id],
    analysis: '',
    visionNotes: record.aiAnalysis,
    parameters: extract.parameters,
    auto: true,
  });
}

export function reconstructLabPanels(records) {
  return mergeLabPanelLists(
    [],
    asArray(records).map(panelFromRecord).filter(Boolean),
  );
}

export function emptyAppState() {
  return {
    labPanels: [],
    weightGoal: null,
    weightLogs: [],
    stepsGoal: null,
    stepsGoalHistory: [],
    runHistory: [],
    doseLogs: [],
    symptomHistory: [],
    updatedAt: null,
  };
}

function extraOf(profile) {
  return asObject(profile?.extraAnswers);
}

function storedState(extra) {
  const state = asObject(extra.appState);
  return {
    ...emptyAppState(),
    ...state,
    labPanels: asArray(extra.labPanels?.length ? extra.labPanels : state.labPanels),
  };
}

export function mergeAppState(local, remote) {
  const left = { ...emptyAppState(), ...asObject(local) };
  const right = { ...emptyAppState(), ...asObject(remote) };
  return {
    labPanels: mergeLabPanelLists(left.labPanels, right.labPanels),
    weightGoal: pickNewer(left.weightGoal, right.weightGoal),
    // Newest first before the cap: otherwise a full list keeps its oldest rows and drops every new one.
    weightLogs: newestFirst(mergeById(left.weightLogs, right.weightLogs, (row) => row.id, (a, b) => String(a.at ?? '') > String(b.at ?? '')), (row) => String(row.at ?? '')).slice(0, MAX_LOGS),
    stepsGoal: pickNewer(left.stepsGoal, right.stepsGoal),
    stepsGoalHistory: mergeById(left.stepsGoalHistory, right.stepsGoalHistory, (row) => row.id, (a, b) => String(a.completedYmd ?? '') > String(b.completedYmd ?? '')).slice(0, MAX_STEPS_HISTORY),
    runHistory: mergeById(left.runHistory, right.runHistory, (row) => row.id, (a, b) => String(a.endedAt ?? '') > String(b.endedAt ?? '')).slice(0, MAX_RUNS),
    doseLogs: mergeById(
      left.doseLogs,
      right.doseLogs,
      (row) => `${row.medicationId}|${row.date}|${row.time}`,
      (a, b) => String(a.updatedAt ?? '') > String(b.updatedAt ?? ''),
    ).sort((a, b) => doseKey(b).localeCompare(doseKey(a))).slice(0, MAX_LOGS),
    symptomHistory: mergeById(left.symptomHistory, right.symptomHistory, (row) => row.recordId, (a, b) => String(a.createdAt ?? '') > String(b.createdAt ?? '')).slice(0, MAX_SYMPTOMS),
    updatedAt: [left.updatedAt, right.updatedAt].filter(Boolean).sort().at(-1) ?? new Date().toISOString(),
  };
}

function newestFirst(rows, key) {
  return rows.sort((a, b) => key(b).localeCompare(key(a)));
}

function doseKey(row) {
  return `${row.date ?? ''} ${row.time ?? ''}`;
}

function pickNewer(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  const at = (row) => String(row.updatedAt ?? row.startedYmd ?? row.deadlineYmd ?? '');
  return at(a) >= at(b) ? a : b;
}

/**
 * Legacy goal source: a nutrition plan saved before `appState.weightGoal` was written.
 * Columns must match prisma/20260924-nutrition-program.sql — the table has no "createdAt"
 * (selecting it 500'd every GET/PUT /api/account/app-state from 2026-09-27 to 2026-09-28).
 */
async function readProgramGoalSource(userId, db) {
  if (typeof db.$queryRaw !== 'function') return null;
  // Probe first: a failing statement would abort saveAppState's surrounding transaction.
  const [probe] = await db.$queryRaw`SELECT to_regclass('"NutritionProgram"') IS NOT NULL AS ok`;
  if (!probe?.ok) return null;
  const [row] = await db.$queryRaw`SELECT config,"startedOn","updatedAt",active FROM "NutritionProgram" WHERE "userId"=${userId}`;
  return row ?? null;
}

export async function loadAppState(userId, db = prisma) {
  const [profile, records] = await Promise.all([
    db.healthProfile.findUnique({ where: { userId } }),
    db.medicalRecord.findMany({
      where: { userId, type: 'LAB' },
      orderBy: { createdAt: 'asc' },
      take: MAX_PANELS,
    }),
  ]);
  const stored = storedState(extraOf(profile));
  const reconstructed = reconstructLabPanels(records);
  return {
    ...stored,
    weightGoal: stored.weightGoal ? stored.weightGoal : unifiedWeightGoal(null, await readProgramGoalSource(userId, db)),
    // Stored panels come last so they win over the copy rebuilt from the record's current text.
    labPanels: mergeLabPanelLists(reconstructed, stored.labPanels),
  };
}

function persistablePanels(panels) {
  return asArray(panels).map((panel) => {
    const next = { ...panel };
    delete next.visionNotes;
    return next;
  });
}

export async function saveAppState(userId, patch) {
  return prisma.$transaction(async tx => {
    await tx.healthProfile.upsert({where:{userId},create:{userId},update:{}});
    await tx.$queryRaw`SELECT "userId" FROM "HealthProfile" WHERE "userId"=${userId} FOR UPDATE`;
    const current = await loadAppState(userId, tx);
    const next = mergeAppState(current, patch);
    next.updatedAt = new Date().toISOString();
    next.labPanels = persistablePanels(next.labPanels);
    const existing = await tx.healthProfile.findUnique({where:{userId}});
    await tx.healthProfile.update({where:{userId},data:{extraAnswers:{...extraOf(existing),labPanels:next.labPanels,appState:next}}});
    return next;
  }, {timeout:15000});
}

export async function persistLabExtract(userId, extract, record) {
  const created = record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt ?? '');
  const date = extract?.date || created.slice(0, 10);
  const panel = sanitizeLabPanel({
    id: `lab-${date}-${record.id}`,
    date,
    createdAt: created,
    recordIds: [record.id],
    analysis: '',
    visionNotes: record.aiAnalysis,
    parameters: extract?.parameters?.length ? extract.parameters : extractLabFromText(record.aiAnalysis).parameters,
    auto: true,
  });
  if (!panel) return null;
  return saveAppState(userId, { labPanels: [panel] });
}

/** Keep bulky lab blobs off /api/auth/me. */
export function publicExtraAnswers(extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra ?? {};
  const { appState: _appState, labPanels, ...rest } = extra;
  return rest;
}
