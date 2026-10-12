// The child record Medi reads on every turn (isolated: never the parent's own health context, never
// EvidenceMD). Built from saved rows only; a missing entry is said to be „not recorded“, never „none“.
import { ageInfo, growthView, sickDayView, vaccineView } from './view.js';
import { foodList, milestoneGuide } from './guide.js';
import { publicHealthItem } from './store.js';

export const CHILD_RECORD_CHAR_MAX = 6000;

const fmtTime = (iso) => new Date(iso).toISOString().slice(0, 16).replace('T', ' ');

export function buildChildRecord({ member, doses, measurements, logs, health, foods, milestones, todayYmd, nowMs = Date.now() }) {
  const lines = [];
  const age = ageInfo(member, todayYmd, 'en');
  const sex = member.sex === 'MALE' ? 'boy' : 'girl';
  lines.push(`Child: ${member.name}, ${sex}. Born ${String(member.birthDate instanceof Date ? member.birthDate.toISOString().slice(0, 10) : member.birthDate).slice(0, 10)}. Today ${todayYmd}.`);
  lines.push(`Age: ${age.label} (${age.days} days)${age.preterm ? `; born at ${member.gestationWeeks} weeks — corrected age ${age.correctedLabel || age.label} (${age.correctedDays} days), used for growth and development until 2 years` : ''}.`);
  if (member.birthWeightG || member.birthLengthCm) lines.push(`Birth: ${member.birthWeightG ? `${member.birthWeightG} g` : 'weight not recorded'}${member.birthLengthCm ? `, ${Number(member.birthLengthCm)} cm` : ''}.`);
  if (member.bloodGroup) lines.push(`Blood group: ${member.bloodGroup}.`);
  if (member.feedingMode) lines.push(`Milk feeding: ${member.feedingMode.toLowerCase()}.`);

  const items = health.map(publicHealthItem).filter((i) => i.active);
  const list = (kind) => items.filter((i) => i.kind === kind).map((i) => `${i.name}${i.severity ? ` (${i.severity.toLowerCase()})` : ''}${i.detail ? ` — ${i.detail}` : ''}`);
  lines.push(`Allergies: ${list('ALLERGY').join('; ') || 'none recorded (not the same as none)'}.`);
  lines.push(`Long-term conditions: ${list('CONDITION').join('; ') || 'none recorded'}.`);
  lines.push(`Regular medicines: ${list('MEDICATION').join('; ') || 'none recorded'}.`);

  const growth = growthView(member, measurements, todayYmd, 'en', { curves: false });
  if (growth.last) {
    const parts = [];
    const describe = (key, label, unit) => {
      const p = growth.indicators[key]?.latest;
      if (p) parts.push(`${label} ${p.value} ${unit} (WHO z ${p.z}, ${p.percentile}th percentile, ${p.status.replace(/_/g, ' ')}; measured ${p.on})`);
    };
    describe('wfa', 'weight', 'kg');
    describe('lhfa', age.days < 731 ? 'length' : 'height', 'cm');
    describe('hcfa', 'head circumference', 'cm');
    describe('bfa', 'BMI', 'kg/m²');
    lines.push(`Growth: ${parts.join('; ')}.`);
    const trends = Object.entries(growth.indicators).filter(([, v]) => v.trend && v.trend.direction !== 'steady').map(([k, v]) => `${k} ${v.trend.direction} by ${v.trend.delta} z over ${v.trend.sinceDays} days`);
    if (trends.length) lines.push(`Growth line changes: ${trends.join('; ')}.`);
    if (growth.daysSinceLast > 60) lines.push(`Last measurement was ${growth.daysSinceLast} days ago — current weight may differ.`);
  } else {
    lines.push('Growth: no measurements recorded.');
  }

  const vaccines = vaccineView(member, doses, todayYmd, 'en');
  const s = vaccines.summary;
  const by = (status) => vaccines.items.filter((i) => i.status === status).map((i) => `${i.abbr} dose ${i.dose}${i.status === 'overdue' || i.status === 'due' ? ` (due ${i.dueOn})` : ''}`);
  lines.push(`Vaccines (Georgian national calendar): ${s.doneForAge} of ${s.totalForAge} due by now are recorded as given.`);
  if (by('overdue').length) lines.push(`Overdue: ${by('overdue').join(', ')}.`);
  if (by('due').length) lines.push(`Due now: ${by('due').join(', ')}.`);
  if (s.next && !['overdue', 'due'].includes(s.next.status)) lines.push(`Next: ${s.nextVisit.map((id) => vaccines.items.find((i) => i.id === id)?.abbr).join(', ')} on ${s.next.dueOn}.`);
  if (by('expired').length) lines.push(`Not given and past the age limit: ${by('expired').join(', ')}.`);
  if (vaccines.extras.length) lines.push(`Other vaccines recorded: ${vaccines.extras.slice(0, 8).map((e) => `${e.name}${e.givenOn ? ` ${e.givenOn}` : ''}`).join(', ')}.`);
  const reactions = doses.filter((d) => d.reaction).slice(0, 5).map((d) => `${d.code} ${d.dose}: ${d.reaction}`);
  if (reactions.length) lines.push(`Reactions after vaccines (parent's words): ${reactions.join('; ')}.`);

  const sick = sickDayView(logs, nowMs);
  if (sick.temps.length) lines.push(`Temperatures last 72 h: ${sick.temps.slice(0, 8).map((t) => `${t.c} °C at ${fmtTime(t.at)} UTC`).join('; ')}.${sick.feverDays ? ` Fever stretch: ${sick.feverDays} day(s).` : ''}`);
  if (sick.symptoms.length) lines.push(`Symptoms logged last 72 h: ${sick.symptoms.slice(0, 8).map((l) => `${(l.data?.labels || l.data?.ids || []).join(', ')}${l.data?.note ? ` (${String(l.data.note).slice(0, 120)})` : ''} at ${fmtTime(l.at)} UTC`).join('; ')}.`);
  if (sick.meds.length) lines.push(`Medicines given last 72 h (as recorded by the parent): ${sick.meds.slice(0, 8).map((l) => `${l.data?.name || 'medicine'}${l.data?.amount ? ` ${l.data.amount}` : ''} at ${fmtTime(l.at)} UTC`).join('; ')}.`);

  if (age.days < 1095) {
    const foodsAll = foodList(foods, 'en');
    const tried = foodsAll.filter((f) => f.status && f.status !== 'AVOID').map((f) => f.name);
    const reacted = foodsAll.filter((f) => f.status === 'REACTION').map((f) => `${f.name}${f.note ? ` (${f.note})` : ''}`);
    const avoid = foodsAll.filter((f) => f.status === 'AVOID').map((f) => f.name);
    if (tried.length || reacted.length || avoid.length) lines.push(`Foods introduced: ${tried.join(', ') || 'none recorded'}.${reacted.length ? ` Reactions: ${reacted.join('; ')}.` : ''}${avoid.length ? ` Avoided on advice: ${avoid.join(', ')}.` : ''}`);
  }
  if (age.days >= 45 && age.days < 6 * 365) {
    const g = milestoneGuide(age.correctedDays, milestones, 'en');
    if (g.current) {
      const notYet = g.current.items.filter((i) => i.status === 'NOT_YET').map((i) => i.text);
      lines.push(`Milestones (${g.current.months}-month checklist): ${g.current.done} of ${g.current.total} marked done.${notYet.length ? ` Marked „not yet“: ${notYet.join('; ')}.` : ''}`);
    }
  }
  if (member.notes) lines.push(`Parent's notes: ${String(member.notes).slice(0, 300)}`);
  return lines.join('\n').slice(0, CHILD_RECORD_CHAR_MAX);
}
