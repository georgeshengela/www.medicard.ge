/** Fields that must never land in quest rows, metadata, or API payloads. */
export const QUEST_FORBIDDEN_KEYS = Object.freeze([
  'notes',
  'healthNotes',
  'medicationName',
  'medName',
  'medicationNames',
  'doctorName',
  'doctor',
  'symptoms',
  'symptom',
  'cycle',
  'cycleDetails',
  'chat',
  'chatContent',
  'message',
  'diagnosis',
  'hydrationInterpretation',
  'interpretation',
  'bbt',
  'mucus',
  'journal',
  'aiInsights',
]);

const FORBIDDEN = new Set(QUEST_FORBIDDEN_KEYS.map((key) => key.toLowerCase()));

function isForbiddenKey(key) {
  return FORBIDDEN.has(String(key || '').toLowerCase());
}

export function sanitizeQuestJson(value, depth = 0) {
  if (value == null || depth > 6) return value == null ? {} : undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeQuestJson(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 80) return undefined;
    return value;
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (isForbiddenKey(key)) continue;
    const next = sanitizeQuestJson(item, depth + 1);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

export function assertQuestRecordIsPrivate(record) {
  const blob = JSON.stringify(record ?? {});
  for (const key of QUEST_FORBIDDEN_KEYS) {
    if (new RegExp(`"${key}"\\s*:`, 'i').test(blob)) {
      const error = new Error(`Quest record leaked forbidden field: ${key}`);
      error.status = 500;
      throw error;
    }
  }
  return record;
}

export function questProgressPercent(progress, target) {
  const t = Number(target) || 0;
  if (t <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(progress) || 0) / t * 100)));
}

export function publicQuest(row, extras = {}) {
  if (!row) return null;
  const template = row.template || {};
  const paid = extras.claimedSourceIds instanceof Set
    ? extras.claimedSourceIds.has(row.id)
    : Boolean(row.claimedAt);
  return {
    id: row.id,
    key: template.key || row.templateKey || null,
    category: template.category || row.category || null,
    cadence: template.cadence || row.cadence || null,
    titleKey: template.titleKey || null,
    descriptionKey: template.descriptionKey || null,
    progressType: template.progressType || null,
    target: row.target,
    progress: row.progress,
    progressPercent: questProgressPercent(row.progress, row.target),
    status: row.status,
    periodKey: row.periodKey,
    assignedAt: row.assignedAt instanceof Date ? row.assignedAt.toISOString() : row.assignedAt,
    completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : row.completedAt,
    claimedAt: row.claimedAt instanceof Date ? row.claimedAt.toISOString() : row.claimedAt,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
    rewardCoins: template.rewardCoins ?? 0,
    rewardXp: template.rewardXp ?? 0,
    claimable: row.status === 'COMPLETED' && !paid,
    // Phase 5 — safe Smart Quest presentation metadata only. Raw baseline,
    // completion ratios, and the decision trace never leave the server.
    targetSource: row.metadata?.smart?.targetSource ?? null,
    difficulty: row.metadata?.smart?.difficulty ?? null,
    reasonKey: row.metadata?.smart?.reasonKey ?? null,
  };
}

export function publicRewardRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    currency: row.currency,
    amount: row.amount,
    transactionType: row.transactionType,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}
