import { prisma } from './prisma.js';
import { extractLabFromText } from './labExtract.js';

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
  if (!key) return null;
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
  };
}

export function mergeLabPanelLists(current, incoming) {
  const byDate = new Map();
  for (const raw of [...asArray(current), ...asArray(incoming)]) {
    const panel = sanitizeLabPanel(raw);
    if (!panel) continue;
    const existing = byDate.get(panel.date);
    if (!existing) {
      byDate.set(panel.date, panel);
      continue;
    }
    const params = new Map(existing.parameters.map((item) => [item.key, item]));
    for (const item of panel.parameters) params.set(item.key, item);
    byDate.set(panel.date, {
      ...existing,
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
    weightLogs: mergeById(left.weightLogs, right.weightLogs, (row) => row.id, (a, b) => String(a.at ?? '') > String(b.at ?? '')).slice(0, MAX_LOGS),
    stepsGoal: pickNewer(left.stepsGoal, right.stepsGoal),
    stepsGoalHistory: mergeById(left.stepsGoalHistory, right.stepsGoalHistory, (row) => row.id, (a, b) => String(a.completedYmd ?? '') > String(b.completedYmd ?? '')).slice(0, MAX_STEPS_HISTORY),
    runHistory: mergeById(left.runHistory, right.runHistory, (row) => row.id, (a, b) => String(a.endedAt ?? '') > String(b.endedAt ?? '')).slice(0, MAX_RUNS),
    doseLogs: mergeById(
      left.doseLogs,
      right.doseLogs,
      (row) => `${row.medicationId}|${row.date}|${row.time}`,
      (a, b) => String(a.updatedAt ?? '') > String(b.updatedAt ?? ''),
    ).slice(0, MAX_LOGS),
    symptomHistory: mergeById(left.symptomHistory, right.symptomHistory, (row) => row.recordId, (a, b) => String(a.createdAt ?? '') > String(b.createdAt ?? '')).slice(0, MAX_SYMPTOMS),
    updatedAt: [left.updatedAt, right.updatedAt].filter(Boolean).sort().at(-1) ?? new Date().toISOString(),
  };
}

function pickNewer(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  const at = (row) => String(row.updatedAt ?? row.startedYmd ?? row.deadlineYmd ?? '');
  return at(a) >= at(b) ? a : b;
}

export async function loadAppState(userId) {
  const [profile, records] = await Promise.all([
    prisma.healthProfile.findUnique({ where: { userId } }),
    prisma.medicalRecord.findMany({
      where: { userId, type: 'LAB' },
      orderBy: { createdAt: 'asc' },
      take: MAX_PANELS,
    }),
  ]);
  const stored = storedState(extraOf(profile));
  const reconstructed = reconstructLabPanels(records);
  return {
    ...stored,
    labPanels: mergeLabPanelLists(stored.labPanels, reconstructed),
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
  const current = await loadAppState(userId);
  const next = mergeAppState(current, patch);
  next.updatedAt = new Date().toISOString();
  next.labPanels = persistablePanels(next.labPanels);

  const existing = await prisma.healthProfile.findUnique({ where: { userId } });
  const extra = extraOf(existing);
  const mergedExtra = {
    ...extra,
    labPanels: next.labPanels,
    appState: next,
  };

  await prisma.healthProfile.upsert({
    where: { userId },
    create: { userId, extraAnswers: mergedExtra },
    update: { extraAnswers: mergedExtra },
  });

  return next;
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
