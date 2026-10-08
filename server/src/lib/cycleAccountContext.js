import { serializeCycleLogForAi, summarizeCycleLogsForAi } from './cycleAiContext.js';
import { cycleModeForPatientAiContext } from './cycleModes.js';

export const CYCLE_DIARY_MAX_ENTRIES = 45;
/** Older days are not listed one by one; they are counted over this window. */
export const CYCLE_HISTORY_DAYS = 365;

/**
 * Rules for every Medi answer that carries account records (planner and clinical model alike).
 * The 2026-10-08 incident: the diary held that day's symptoms, the clinical model never received it
 * and told her „შენს ჩანაწერებში სიმპტომები არ ჩანს“.
 */
export const MEDI_RECORD_CONTEXT_RULES = `Account records are re-read from the database for this request; prefer their dated facts over older conversation claims.
Before saying symptoms, results or history are missing, read every supplied block (cycle diary, symptom checks, lab values, records, visits, metrics, this conversation). When saved entries answer the question, name them with their dates and use them; never ask the person to type in again what is already saved. Ask only for what is genuinely missing (for example how it feels right now, onset, severity) — and say what you already see first.
A logged symptom is the person's own entry, not a diagnosis and not evidence of pregnancy. Dates other than today are history, not today's state.
A block marked withheld or unavailable means you cannot see that source here — never „there are no entries“. A source that is absent was not loaded or is empty: never call that a negative finding. Never reconstruct excluded private fields (sex, tests, temperature, notes).
Apply the account holder's records only when the question is about that person.
ქართულად: თუ ჩანაწერებში სიმპტომები წერია, არასოდეს თქვა „შენს ჩანაწერებში სიმპტომები არ ჩანს“ — დაასახელე ისინი თარიღით („8 ოქტომბერს ჩაინიშნე თავის ტკივილი და შებერილობა…“) და მათზე დაყრდნობით უპასუხე.`;

const WITHHELD_DEVICE = 'Cycle diary withheld by the person’s privacy choices: the cycle Face ID/PIN lock, masked or discreet notifications, an older app version or the person removed the cycle context. Do not read, guess or reconstruct it, and never say the diary is empty. If cycle symptoms matter, say in one short clause that the cycle entries are protected and ask how she feels. Saving a NEW cycle entry the person explicitly asks for is still allowed (the save path checks its own permissions).';
const WITHHELD_PROFILE = 'Cycle privacy is on for this account. Do not read, write or infer cycle data, mode or symptoms through Medi; entries may exist but are not available here. Point to the cycle screen when relevant.';
const UNAVAILABLE = 'The cycle diary could not be loaded right now. If relevant, say it is temporarily unavailable; never claim there are no symptoms and do not reconstruct it from earlier turns.';

/**
 * One loader and one privacy boundary for the planner and the clinical answer. Owner-scoped, read
 * fresh on every request, no cache, no writes. Returns null when the account has no cycle profile at
 * all (men, women who never opened the cycle) — no block, no noise.
 * Only `serializeCycleLogForAi` decides what a day says (registry allow-list: no sex, BBT, tests,
 * mucus, notes, tags, observations bag); the query selects nothing else.
 */
export async function loadCycleAccountContext(userId, db, { today, allowed = true } = {}) {
  let profile;
  try {
    profile = await db.cycleProfile.findUnique({ where: { userId }, select: {
      mode: true, avgCycleLength: true, avgPeriodLength: true, lastPeriodStart: true, dueDate: true,
      isIrregular: true, conditions: true, privacyEnabled: true, reminderPrefs: true,
    } });
  } catch {
    return { status: 'unavailable', instruction: UNAVAILABLE };
  }
  if (!profile) return null;
  if (profile.privacyEnabled) return { status: 'withheld', reason: 'privacy', instruction: WITHHELD_PROFILE };
  if (!allowed || profile.reminderPrefs?.maskNotifications === true) {
    return { status: 'withheld', reason: 'device', instruction: WITHHELD_DEVICE };
  }
  try {
    const floor = today ? shiftDay(today, -CYCLE_HISTORY_DAYS) : null;
    const all = await db.cycleLog.findMany({
      where: { userId, ...(today ? { date: { lte: today, ...(floor ? { gte: floor } : {}) } } : {}) },
      take: CYCLE_HISTORY_DAYS,
      orderBy: { date: 'desc' },
      select: { date: true, flow: true, symptoms: true, moods: true, painEntries: true, sleepQuality: true, stressLevel: true },
    });
    const rows = all.slice(0, CYCLE_DIARY_MAX_ENTRIES);
    const older = all.slice(CYCLE_DIARY_MAX_ENTRIES);
    const mode = cycleModeForPatientAiContext(profile.mode);
    const conditions = Array.isArray(profile.conditions) ? profile.conditions.map(String).filter(Boolean).slice(0, 8) : [];
    return {
      status: 'available',
      asOf: today || null,
      profile: {
        ...(mode ? { mode } : {}),
        avgCycleLength: profile.avgCycleLength,
        avgPeriodLength: profile.avgPeriodLength,
        lastPeriodStart: isoDay(profile.lastPeriodStart),
        isIrregular: Boolean(profile.isIrregular),
        ...(conditions.length ? { conditions } : {}),
        ...(profile.mode === 'PREGNANCY' && profile.dueDate ? { dueDate: isoDay(profile.dueDate) } : {}),
      },
      // A missing flow is „not recorded“, never „none“ (= she logged no bleeding).
      logs: rows.map(row => ({ date: row.date, line: serializeCycleLogForAi({ ...row, flow: row.flow || 'not_recorded' }).line })),
      // Everything older inside the year, counted with the same allow-list, so long-running patterns show.
      ...(older.length ? { older: { from: older.at(-1).date, to: older[0].date, ...summarizeCycleLogsForAi(older) } } : {}),
      instruction: 'Saved cycle diary, newest first. Use the dated symptoms, moods, pain and flow. „—“ and not_recorded mean nothing was logged for that field, never a confirmed absence. Days without a line were not logged. Calendar estimates and self-logged symptoms are not diagnoses.',
    };
  } catch {
    return { status: 'unavailable', instruction: UNAVAILABLE };
  }
}

function shiftDay(ymd, days) {
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoDay(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/** Readable block for the clinical model. Newest days are kept when the budget runs out. */
export function cycleAccountContextText(context, max = 4000) {
  if (!context) return null;
  if (context.status !== 'available') {
    return `ციკლის დღიური / cycle diary: ${context.status}.\n${context.instruction}`;
  }
  const p = context.profile || {};
  const facts = [
    p.mode ? `რეჟიმი ${p.mode}` : null,
    p.avgCycleLength ? `საშუალო ციკლი ${p.avgCycleLength} დღე` : null,
    p.avgPeriodLength ? `მენსტრუაცია ${p.avgPeriodLength} დღე` : null,
    p.lastPeriodStart ? `ბოლო მენსტრუაციის დაწყება ${p.lastPeriodStart}` : null,
    p.isIrregular ? 'არარეგულარული ციკლი' : null,
    p.conditions?.length ? `მითითებული მდგომარეობები: ${p.conditions.join(', ')}` : null,
    p.dueDate ? `სავარაუდო მშობიარობა ${p.dueDate}` : null,
  ].filter(Boolean);
  const head = [
    `ციკლის დღიური — შენახული ჩანაწერები, უახლესი პირველი${context.asOf ? ` (დღეს = ${context.asOf})` : ''}:`,
    facts.length ? facts.join('; ') : null,
    context.instruction,
  ].filter(Boolean).join('\n');
  const logs = context.logs || [];
  if (!logs.length) return `${head}\nბოლო ${CYCLE_DIARY_MAX_ENTRIES} დღეში შენახული დღიური ჩანაწერი არ არის.`;
  let text = head, shown = 0;
  for (const row of logs) {
    const line = context.asOf && row.date === context.asOf ? `- ${row.line} ← დღეს` : `- ${row.line}`;
    if (text.length + line.length + 90 > max) break;
    text += `\n${line}`; shown++;
  }
  if (shown < logs.length) text += `\n(${logs.length - shown} older entries did not fit here: omitted, not absent.)`;
  const o = context.older;
  if (o?.loggedDays) {
    text += `
უფრო ძველი ჩანაწერები (${o.from} – ${o.to}, ${o.loggedDays} ჩაწერილი დღე, მათგან სისხლდენით ${o.bleedingDays}):`;
    if (o.symptoms.length) text += `
- სიმპტომები: ${o.symptoms.join(', ')}`;
    if (o.pain.length) text += `
- ტკივილი: ${o.pain.join(', ')}`;
    if (o.moods.length) text += `
- განწყობა: ${o.moods.join(', ')}`;
  }
  return text;
}
