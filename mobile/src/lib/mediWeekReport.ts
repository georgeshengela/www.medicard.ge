import { addDaysYmd, dayTotalMl, loadHydrationGoalMl, loadHydrationLogs, todayYmd } from '@/lib/hydration';
import { getCachedHealthBundle } from '@/lib/healthDataSync';
import { loadDoseLogs } from '@/lib/medications.shared';
import { loadWeightLogs } from '@/lib/weightGoal';

export type WeekReport = {
  endYmd: string;
  startYmd: string;
  steps: { total: number; prev: number; deltaPct: number | null };
  hydration: { avgMl: number; goalMl: number; daysHit: number };
  weight: { start: number | null; end: number | null };
  meds: { taken: number; skipped: number };
  sleepAvg: number | null;
  loggedDays: number;
  insight: string;
};

function daysEnding(end: string, count: number, offset = 0): string[] {
  return Array.from({ length: count }, (_, i) => addDaysYmd(end, i - (count - 1) - offset));
}

export async function buildWeekReport(end = todayYmd()): Promise<WeekReport> {
  const startYmd = addDaysYmd(end, -6);
  const thisWeek = daysEnding(end, 7);
  const prevWeek = daysEnding(end, 7, 7);
  const [bundle, hydro, goalMl, doses, weights] = await Promise.all([
    getCachedHealthBundle(),
    loadHydrationLogs(),
    loadHydrationGoalMl(),
    loadDoseLogs(),
    loadWeightLogs(),
  ]);
  const daily = bundle?.daily ?? [];
  const stepsOf = (days: string[]) =>
    days.reduce((sum, day) => sum + (daily.find((row) => row.date === day)?.steps || 0), 0);
  const total = stepsOf(thisWeek);
  const prev = stepsOf(prevWeek);
  const hydroDays = thisWeek.map((day) => dayTotalMl(hydro, day));
  const daysHit = hydroDays.filter((ml) => ml >= goalMl).length;
  const avgMl = Math.round(hydroDays.reduce((a, b) => a + b, 0) / 7);
  const weekWeights = weights.filter((row) => row.date >= startYmd && row.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const sleepVals = thisWeek
    .map((day) => daily.find((row) => row.date === day)?.sleepHours)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  const loggedDays = thisWeek.filter((day) => {
    const row = daily.find((item) => item.date === day);
    return Boolean(row?.steps || row?.weightKg || row?.hydrationMl || row?.sleepHours || hydroDays[thisWeek.indexOf(day)]);
  }).length;
  const taken = doses.filter((row) => thisWeek.includes(row.date) && row.status === 'taken').length;
  const skipped = doses.filter((row) => thisWeek.includes(row.date) && row.status === 'skipped').length;
  let insight = 'ამ კვირაში მონაცემები ნელ-ნელა გროვდება. Medi აქაა, როცა კიდევ რამეს ჩაინიშნავ 💚';
  if (total > 0 && prev > 0 && total >= Math.round(prev * 1.15)) {
    insight = 'ნაბიჯები ამ კვირაში გაიზარდა. ეს პატარა, მაგრამ ნამდვილი ცვლილებაა — კარგი მიმართულებაა 👏';
  } else if (daysHit >= 4) {
    insight = 'წყალი ამ კვირაში ხშირად მიზანთან იყო. სხეული ამას გრძნობს 💧';
  } else if (taken >= 5 && skipped === 0) {
    insight = 'მედიკამენტების კვირა სუფთა გამოვიდა. ასეთი სიმშვიდე იშვიათია და ღირს 💚';
  } else if (loggedDays >= 5) {
    insight = 'ხუთი დღე ჩანაწერებით — ეს უკვე რიტუალია, არა იძულება. მიხარია, რომ ერთად ვართ.';
  }
  return {
    endYmd: end,
    startYmd,
    steps: { total, prev, deltaPct: prev > 0 ? Math.round(((total - prev) / prev) * 100) : null },
    hydration: { avgMl, goalMl, daysHit },
    weight: { start: weekWeights[0]?.kg ?? null, end: weekWeights[weekWeights.length - 1]?.kg ?? null },
    meds: { taken, skipped },
    sleepAvg: sleepVals.length ? Math.round((sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length) * 10) / 10 : null,
    loggedDays,
    insight,
  };
}
