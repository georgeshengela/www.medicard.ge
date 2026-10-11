// What Medi reads from MEDISLEEP: the plan, the last two weeks of nights and the analytics summary. Owner-scoped,
// numbers and factor names only — never the sounds she listens to. Fails soft (null) so a missing table or a
// test double never breaks an answer.
import { prisma } from './prisma.js';
import { SLEEP_FACTORS, SLEEP_QUALITY_LABELS, localParts, publicNight, publicPlan } from './sleep.js';
import { sleepSummary } from './sleepInsights.js';
import { listSleepNights, readSleepPlan } from './sleepStore.js';

const DAY_MS = 86_400_000;
const hhmm = (minutes) => (minutes == null ? null : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
const hours = (minutes) => (minutes == null ? null : `${Math.floor(minutes / 60)}სთ ${String(Math.round(minutes % 60)).padStart(2, '0')}წთ`);

export async function loadSleepAiContext(userId, db = prisma, { today, timeZone = 'Asia/Tbilisi' } = {}) {
  try {
    const end = today || localParts(new Date(), timeZone).date;
    const from = new Date(Date.parse(`${end}T00:00:00Z`) - 60 * DAY_MS).toISOString().slice(0, 10);
    const [planRow, rows] = await Promise.all([readSleepPlan(userId, db), listSleepNights(userId, { from }, db)]);
    if (!planRow && !rows.length) return null;
    const plan = publicPlan(planRow);
    const summary = sleepSummary(rows, { plan, timeZone, today: end, days: 7 });
    const recent = rows.map(publicNight).filter((n) => n.night >= new Date(Date.parse(`${end}T00:00:00Z`) - 13 * DAY_MS).toISOString().slice(0, 10));
    return {
      source: 'MEDISLEEP: her sleep plan and logged nights. Times come from sleep mode taps, her own entry or Apple Health / Health Connect (timesSource). Quality is her own 1–5 morning rating. Not a diagnosis; phone data cannot detect sleep disorders.',
      plan,
      nights: recent.map((n) => ({
        night: n.night,
        bedtime: n.bedAt ? hhmm(localParts(n.bedAt, timeZone).minutes) : null,
        wake: n.wakeAt ? hhmm(localParts(n.wakeAt, timeZone).minutes) : null,
        sleptMinutes: n.sleptMinutes, inBedMinutes: n.inBedMinutes, stages: n.stages,
        quality: n.quality, wakeups: n.wakeups, latencyMinutes: n.latencyMinutes, factors: n.factors, timesSource: n.timesSource,
      })),
      week: {
        nightsLogged: summary.nightsLogged, avgSleptMinutes: summary.avgSleptMinutes, goalMinutes: summary.goalMinutes,
        avgBedtime: hhmm(summary.avgBedtime), avgWake: hhmm(summary.avgWake), regularitySpreadMinutes: summary.regularity.spreadMinutes,
        debtMinutes: summary.debtMinutes, socialJetlagMinutes: summary.socialJetlagMinutes, avgQuality: summary.avgQuality,
        avgWakeups: summary.avgWakeups, avgLatencyMinutes: summary.avgLatencyMinutes,
        factorEffects: summary.factorEffects.slice(0, 4), bestBedtime: summary.bestBedtime ? hhmm(summary.bestBedtime.bedtime) : null,
      },
    };
  } catch {
    return null;
  }
}

/** Georgian block for Medi's clinical answer (patient.js). Null when there is nothing logged. */
export function buildSleepBlock(ctx) {
  if (!ctx || !ctx.nights?.length) return null;
  const w = ctx.week;
  const lines = ['MEDISLEEP — ძილი (შენახული ღამეები, ბოლო 7 ღამის შეჯამება; ეს არ არის დიაგნოზი):'];
  const facts = [];
  if (w.avgSleptMinutes != null) facts.push(`საშუალოდ ${hours(w.avgSleptMinutes)} (მიზანი ${hours(w.goalMinutes)})`);
  if (w.avgBedtime) facts.push(`დაწოლა ~${w.avgBedtime}`);
  if (w.avgWake) facts.push(`ადგომა ~${w.avgWake}`);
  if (w.regularitySpreadMinutes != null) facts.push(`რეგულარულობა ±${w.regularitySpreadMinutes}წთ`);
  if (w.debtMinutes) facts.push(`დეფიციტი ${hours(w.debtMinutes)}`);
  if (w.socialJetlagMinutes != null && w.socialJetlagMinutes >= 60) facts.push(`შაბათ-კვირას ${w.socialJetlagMinutes}წთ-ით გადაწეული რიტმი`);
  if (w.avgQuality != null) facts.push(`დილის შეფასება ${w.avgQuality}/5`);
  if (w.avgLatencyMinutes != null) facts.push(`ჩაძინებას ~${w.avgLatencyMinutes}წთ`);
  if (w.avgWakeups != null) facts.push(`ღამის გაღვიძება ~${w.avgWakeups}`);
  if (facts.length) lines.push(`- ${facts.join(', ')} (${w.nightsLogged} ღამე)`);
  for (const e of w.factorEffects || []) {
    const label = SLEEP_FACTORS[e.factor]?.[0] || e.factor;
    lines.push(`- ${label}: ${e.sleptDiff > 0 ? '+' : ''}${e.sleptDiff}წთ ძილი${e.qualityDiff != null ? `, შეფასება ${e.qualityDiff > 0 ? '+' : ''}${e.qualityDiff}` : ''} (${e.nightsWith} ღამე)`);
  }
  for (const n of ctx.nights.slice(-5)) {
    const bits = [n.night];
    if (n.bedtime && n.wake) bits.push(`${n.bedtime}–${n.wake}`);
    if (n.sleptMinutes != null) bits.push(hours(n.sleptMinutes));
    if (n.quality != null) bits.push(SLEEP_QUALITY_LABELS[n.quality]?.[0] || '');
    if (n.factors?.length) bits.push(n.factors.map((f) => SLEEP_FACTORS[f]?.[0] || f).join(', '));
    lines.push(`- ${bits.filter(Boolean).join(', ')}`);
  }
  return lines.join('\n');
}
