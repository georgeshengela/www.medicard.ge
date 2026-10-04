/**
 * The standard Home's one big answer (owner 2026-10-04: „დღეს“ hero, the men's Home): the single most
 * useful thing to do right now, picked from what Home already loads. Pure — no I/O, no health scoring.
 *
 * Order: a dose that is due → a dose within the hour → steps still to walk → water still to drink →
 * the next dose later today → everything done → nothing tracked yet. Wording addresses the person as
 * შენ, never judges, and never turns a missed goal into a negative number.
 */
import { tx } from '../../i18n/locale.js';

export type TodayAnswerInput = {
  /** Pending doses today, sorted by time ("HH:MM"), with the medicine's name. */
  pendingDoses: { time: string; name: string }[];
  /** null = steps module off or no device data yet. */
  steps: { total: number; goal: number } | null;
  /** null = water module off. */
  water: { ml: number; goalMl: number } | null;
  now: Date;
};

export type TodayAnswer = {
  kind: 'dose_due' | 'dose_soon' | 'steps' | 'water' | 'dose_later' | 'done' | 'start';
  title: string;
  caption: string;
};

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map((part) => Number(part));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const group = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const litres = (ml: number) => (Math.round(ml / 100) / 10).toFixed(1);

export function todayAnswer({ pendingDoses, steps, water, now }: TodayAnswerInput): TodayAnswer {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const due = pendingDoses.find((dose) => minutesOf(dose.time) <= nowMin);
  if (due) {
    return {
      kind: 'dose_due',
      title: tx(`დროა: ${due.name}`, `Time for ${due.name}`),
      caption: tx(`${due.time} · მონიშნე ქვემოთ, როცა მიიღებ`, `${due.time} · tick it below once taken`),
    };
  }
  const next = pendingDoses[0];
  if (next && minutesOf(next.time) - nowMin <= 60) {
    return {
      kind: 'dose_soon',
      title: tx(`${next.time}-ზე: ${next.name}`, `${next.name} at ${next.time}`),
      caption: tx('შემდეგი წამალი საათის განმავლობაში', 'Your next medicine is within the hour'),
    };
  }
  const stepsLeft = steps && steps.goal > 0 ? steps.goal - steps.total : null;
  if (stepsLeft != null && stepsLeft > 0) {
    return {
      kind: 'steps',
      title: tx(`დარჩა ${group(stepsLeft)} ნაბიჯი`, `${group(stepsLeft)} steps to go`),
      caption: tx(`${group(steps!.total)} / ${group(steps!.goal)} · დღის მიზანი`, `${group(steps!.total)} / ${group(steps!.goal)} · daily goal`),
    };
  }
  const waterLeft = water && water.goalMl > 0 ? water.goalMl - water.ml : null;
  if (waterLeft != null && waterLeft > 0) {
    return {
      kind: 'water',
      title: tx(`დარჩა ${litres(waterLeft)} ლ წყალი`, `${litres(waterLeft)} L of water to go`),
      caption: tx(`${litres(water!.ml)} / ${litres(water!.goalMl)} ლ · ჭიქა ერთი შეხებით ემატება`, `${litres(water!.ml)} / ${litres(water!.goalMl)} L · add a glass with one tap`),
    };
  }
  if (next) {
    return {
      kind: 'dose_later',
      title: tx(`შემდეგი წამალი ${next.time}-ზე`, `Next medicine at ${next.time}`),
      caption: next.name,
    };
  }
  const tracked = Boolean((steps && steps.goal > 0) || (water && water.goalMl > 0));
  if (tracked) {
    return {
      kind: 'done',
      title: tx('დღის მიზნები შესრულდა', 'Today’s goals are done'),
      caption: tx('კარგი დღეა — ასე გააგრძელე', 'Good day — keep it going'),
    };
  }
  return {
    kind: 'start',
    title: tx('დავიწყოთ შენი დღე', 'Let’s start your day'),
    caption: tx('დააკავშირე ნაბიჯები ან დაამატე წამალი — აქ ყოველთვის დაგხვდება მთავარი', 'Connect your steps or add a medicine — the key thing will wait here'),
  };
}
