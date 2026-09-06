import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';
export type { EngageFrequency, EngageOutcome, EngageTopic, MediEngagePrefs } from './mediEngageModel';
export {
  DEFAULT_ENGAGE_PREFS,
  bumpOutOfQuiet,
  dailyEngageCap,
  computeEngageFatigue,
  fatigueAdjustedCap,
  fatigueFromOutcomes,
  isQuietAt,
  parseHm,
  preferredHourFromOpens,
} from './mediEngageModel';
import { DEFAULT_ENGAGE_PREFS, type EngageOutcome, type EngageTopic, type MediEngagePrefs } from './mediEngageModel';
import type { EngageTrace, UnfinishedDraft } from './mediNotificationBrain.shared';

export const ENGAGE_TOPICS: EngageTopic[] = [
  'hydration',
  'stepsSmart',
  'weight',
  'cycle',
  'dailyLog',
  'checkin',
  'insight',
  'weekly',
  'achievement',
  'chatFollowup',
  'reengage',
  'feature',
  'question',
  'birthday',
  'sleep',
  'morning',
  'unfinished',
  'visitFollowup',
  'weather',
];

const PREFS_KEY = 'medicard.engage.prefs.v1';
const LAST_OPEN_KEY = 'medicard.engage.lastOpenAt';
const SENT_KEY = 'medicard.engage.sent.v1';
const SEEN_KEY = 'medicard.engage.seen.v1';
const OUTCOMES_KEY = 'medicard.engage.outcomes.v1';
const OPENS_KEY = 'medicard.engage.opens.v1';
const TRACE_KEY = 'medicard.engage.trace.v1';
const DRAFTS_KEY = 'medicard.engage.drafts.v1';
const SIGNALS_KEY = 'medicard.engage.signals.v1';
const DECISIONS_KEY = 'medicard.engage.decisions.v1';

function mergePrefs(raw: unknown): MediEngagePrefs {
  const parsed = raw && typeof raw === 'object' ? (raw as Partial<MediEngagePrefs>) : {};
  return {
    discreet: Boolean(parsed.discreet),
    quietStart: typeof parsed.quietStart === 'string' ? parsed.quietStart : DEFAULT_ENGAGE_PREFS.quietStart,
    quietEnd: typeof parsed.quietEnd === 'string' ? parsed.quietEnd : DEFAULT_ENGAGE_PREFS.quietEnd,
    frequency:
      parsed.frequency === 'rare' || parsed.frequency === 'often' || parsed.frequency === 'balanced'
        ? parsed.frequency
        : 'balanced',
    topics: {
      ...DEFAULT_ENGAGE_PREFS.topics,
      ...(parsed.topics && typeof parsed.topics === 'object' ? parsed.topics : {}),
    },
  };
}

export async function loadEngagePrefs(): Promise<MediEngagePrefs> {
  const raw = await getScopedPreference(PREFS_KEY);
  if (!raw) return DEFAULT_ENGAGE_PREFS;
  try {
    return mergePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_ENGAGE_PREFS;
  }
}

export async function saveEngagePrefs(prefs: MediEngagePrefs): Promise<void> {
  await setScopedPreference(PREFS_KEY, JSON.stringify(mergePrefs(prefs)));
}

export async function markEngageAppOpen(at = Date.now()): Promise<void> {
  await setScopedPreference(LAST_OPEN_KEY, String(at));
  await recordEngageAppOpenHour(at);
}

export async function loadEngageLastOpenAt(): Promise<number | null> {
  const raw = await getScopedPreference(LAST_OPEN_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type EngageSentRow = { key: string; family: string; at: number; ymd: string };

export async function loadEngageSent(): Promise<EngageSentRow[]> {
  const raw = await getScopedPreference(SENT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as EngageSentRow[];
    const cutoff = Date.now() - 45 * 86_400_000;
    return Array.isArray(parsed) ? parsed.filter((row) => row?.at > cutoff) : [];
  } catch {
    return [];
  }
}

export async function recordEngageSent(row: EngageSentRow): Promise<void> {
  const next = [...(await loadEngageSent()).filter((item) => item.key !== row.key || item.ymd !== row.ymd), row];
  await setScopedPreference(SENT_KEY, JSON.stringify(next.slice(-80)));
}

export async function loadEngageSeen(): Promise<Record<string, boolean>> {
  const raw = await getScopedPreference(SEEN_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function markEngageSeen(flag: string): Promise<void> {
  const seen = await loadEngageSeen();
  seen[flag] = true;
  await setScopedPreference(SEEN_KEY, JSON.stringify(seen));
  if (flag === 'weekly') {
    void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh());
  }
}

export async function loadEngageOutcomes(): Promise<EngageOutcome[]> {
  const raw = await getScopedPreference(OUTCOMES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as EngageOutcome[];
    const cutoff = Date.now() - 45 * 86_400_000;
    return Array.isArray(parsed) ? parsed.filter((row) => row?.sentAt > cutoff) : [];
  } catch {
    return [];
  }
}

export async function recordEngageOutcome(row: EngageOutcome): Promise<void> {
  const next = [...(await loadEngageOutcomes()).filter((item) => item.key !== row.key || item.sentAt !== row.sentAt), row];
  await setScopedPreference(OUTCOMES_KEY, JSON.stringify(next.slice(-40)));
}

export async function markEngageOpened(family: string, key: string, action?: string): Promise<void> {
  const rows = await loadEngageOutcomes();
  const hit = [...rows].reverse().find((row) => row.key === key || row.family === family);
  if (!hit) {
    await recordEngageOutcome({ key, family, sentAt: Date.now(), openedAt: Date.now(), action });
    return;
  }
  hit.openedAt = Date.now();
  if (action) hit.action = action;
  await setScopedPreference(OUTCOMES_KEY, JSON.stringify(rows.slice(-40)));
}

export async function loadEngageOpenAt(): Promise<number[]> {
  const raw = await getScopedPreference(OPENS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as number[];
    const cutoff = Date.now() - 30 * 86_400_000;
    return Array.isArray(parsed) ? parsed.filter((at) => at > cutoff) : [];
  } catch {
    return [];
  }
}

export async function recordEngageAppOpenHour(at = Date.now()): Promise<void> {
  const next = [...(await loadEngageOpenAt()).filter((item) => item > Date.now() - 30 * 86_400_000), at];
  await setScopedPreference(OPENS_KEY, JSON.stringify(next.slice(-120)));
}

export async function saveEngageTrace(trace: EngageTrace): Promise<void> {
  await setScopedPreference(TRACE_KEY, JSON.stringify(trace));
}

export async function loadEngageTrace(): Promise<EngageTrace | null> {
  const raw = await getScopedPreference(TRACE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EngageTrace;
  } catch {
    return null;
  }
}

export async function loadUnfinishedDrafts(): Promise<UnfinishedDraft[]> {
  const raw = await getScopedPreference(DRAFTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as UnfinishedDraft[];
    return Array.isArray(parsed) ? parsed.filter((row) => row?.kind && row.route) : [];
  } catch {
    return [];
  }
}

export async function saveUnfinishedDraft(draft: UnfinishedDraft): Promise<void> {
  const next = [...(await loadUnfinishedDrafts()).filter((row) => row.kind !== draft.kind), draft];
  await setScopedPreference(DRAFTS_KEY, JSON.stringify(next));
}

export async function clearUnfinishedDraft(kind: UnfinishedDraft['kind']): Promise<void> {
  const next = (await loadUnfinishedDrafts()).filter((row) => row.kind !== kind);
  await setScopedPreference(DRAFTS_KEY, JSON.stringify(next));
  void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh());
}

export type CachedEngageSignals = {
  hydrationMl: number;
  hydrationGoal: number;
  loggedPain: boolean;
  seenWeekly: boolean;
  unfinished: UnfinishedDraft | null;
  lastOpenAt: number | null;
  missingProfileField: string | null;
  recentVisitId: string | null;
  medMissedWeek: number;
  todaySteps: number | null;
  prevWeekSteps: number;
};

export async function saveEngageSignals(signals: CachedEngageSignals): Promise<void> {
  await setScopedPreference(SIGNALS_KEY, JSON.stringify(signals));
}

export async function loadEngageSignals(): Promise<CachedEngageSignals | null> {
  const raw = await getScopedPreference(SIGNALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedEngageSignals;
  } catch {
    return null;
  }
}

export async function appendEngageDecisions(rows: EngageTrace['decisions']): Promise<void> {
  const raw = await getScopedPreference(DECISIONS_KEY);
  let prev: EngageTrace['decisions'] = [];
  try {
    prev = raw ? (JSON.parse(raw) as EngageTrace['decisions']) : [];
  } catch {
    prev = [];
  }
  const next = [...prev, ...rows].slice(-80);
  await setScopedPreference(DECISIONS_KEY, JSON.stringify(next));
}

export async function patchEngageDecision(id: string, patch: Partial<EngageTrace['decisions'][number]>): Promise<void> {
  const raw = await getScopedPreference(DECISIONS_KEY);
  if (!raw) return;
  try {
    const rows = JSON.parse(raw) as EngageTrace['decisions'];
    const next = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
    await setScopedPreference(DECISIONS_KEY, JSON.stringify(next));
    const updated = next.find((row) => row.id === id);
    if (updated) {
      void import('@/lib/api').then(({ api }) =>
        api.push.syncDecisions({
          decisions: [{
            id: updated.id,
            candidate: updated.candidate,
            family: updated.family,
            score: updated.score,
            decision: updated.decision,
            reason: updated.reason,
            blocked: updated.blocked,
            template: updated.template,
            route: updated.route,
            createdAt: updated.createdAt,
            scheduledAt: updated.scheduledAt,
            fireAt: updated.fireAt,
            revalidatedAt: updated.revalidatedAt,
          }],
        }).catch(() => undefined),
      );
    }
  } catch {
    /* keep */
  }
}
