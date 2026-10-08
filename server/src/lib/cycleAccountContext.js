import { serializeCycleLogForAi } from './cycleAiContext.js';
import { cycleModeForPatientAiContext } from './cycleModes.js';

export const MEDI_RECORD_CONTEXT_RULES = `Account records are refreshed for this request; prefer their dated facts over older conversation claims. Read supplied cycle.logs before saying symptoms are missing. When recorded symptoms answer the question, name those symptoms and their dates; do not ask the person to enter them again. A recorded symptom is not a diagnosis or evidence of pregnancy. Ask only for information actually missing for the question. unavailable/withheld/not_requested means you cannot access that source, NOT that no records exist. An empty or partial date window does not mean no symptoms or no history. Never infer excluded private fields. Only apply the account holder's records when the question concerns that person.`;

/** One privacy/allowlist boundary for both the planner and the clinical answer. No cache or writes. */
export async function loadCycleAccountContext(userId, db, { today, allowed = true } = {}) {
  if (!allowed) return { status: 'withheld', locked: true, instruction: 'This client has not allowed cycle context for this request. It may be an older app or a privacy choice. Do not read or reconstruct it, and do not claim the diary is empty. If relevant, explain that access is unavailable here and suggest checking the app version and cycle privacy settings.' };
  try {
    const profile = await db.cycleProfile.findUnique({ where: { userId }, select: {
      mode: true, avgCycleLength: true, avgPeriodLength: true, lastPeriodStart: true,
      dueDate: true, isIrregular: true, privacyEnabled: true, reminderPrefs: true,
    } });
    if (profile?.privacyEnabled || profile?.reminderPrefs?.maskNotifications === true) {
      return { status: 'withheld', locked: true, instruction: 'Cycle privacy is enabled. Do not read/write cycle through Medi or infer its mode or symptoms. Records may exist but are not available here.' };
    }
    if (!profile) return { status: 'not_configured', logs: [], instruction: 'No cycle profile is available. This is not evidence of no symptoms.' };
    const rows = await db.cycleLog.findMany({ where: { userId, ...(today ? { date: { lte: today } } : {}) }, take: 45, orderBy: { date: 'desc' }, select: {
      date: true, flow: true, symptoms: true, moods: true, painEntries: true, sleepQuality: true, stressLevel: true,
    } });
    const safeProfile = { mode: cycleModeForPatientAiContext(profile.mode), avgCycleLength: profile.avgCycleLength,
      avgPeriodLength: profile.avgPeriodLength, lastPeriodStart: profile.lastPeriodStart,
      isIrregular: profile.isIrregular, ...(profile.mode === 'PREGNANCY' ? { dueDate: profile.dueDate } : {}) };
    return { status: 'available', asOf: today, profile: safeProfile,
      // No raw diary notes, tests, sex, private keys, excluded-field diagnostics or identifiers.
      logs: rows.map(row => ({ date: row.date, line: serializeCycleLogForAi({ ...row, flow: row.flow || 'not_recorded' }).line })),
      coverage: { maxEntries: 45, returned: rows.length, newest: rows[0]?.date || null, oldest: rows.at(-1)?.date || null },
      instruction: 'Saved cycle diary, newest first, at most 45 entries through asOf. Use dated symptoms and pain from these lines. — and not_recorded mean not recorded/shared, never a confirmed absence. Dates are historical unless equal to asOf. Calendar estimates and self-reported symptoms are not diagnoses.' };
  } catch {
    return { status: 'unavailable', instruction: 'The cycle diary could not be loaded now. Explain temporary unavailability if relevant; never claim there are no symptoms. Do not reconstruct private data from prior turns.' };
  }
}

export function cycleAccountContextText(context, max = 3800) {
  if (!context) return null;
  const { logs = [], ...meta } = context;
  const header = `Saved cycle diary / შენახული ციკლის დღიური:\n${JSON.stringify(meta)}`;
  let text = header, shown = 0;
  for (const row of logs) {
    if (text.length + row.line.length + 80 > max) break;
    text += `\n${row.line}`; shown++;
  }
  if (shown < logs.length) text += `\nOnly ${shown} of ${logs.length} loaded entries fit here; older entries are omitted, not absent.`;
  return text;
}
