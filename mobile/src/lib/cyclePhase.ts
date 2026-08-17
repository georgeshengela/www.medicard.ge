import type { CycleDayMark, CycleLog, CycleMode } from '@/lib/api';

export type CyclePhaseKind = 'period' | 'fertile' | 'ovulation' | 'follicular' | 'luteal' | 'unknown';

export type CyclePhaseInfo = {
  day: number | null;
  phase: CyclePhaseKind;
  phaseKa: string;
};

export type CycleDayPrediction = {
  id: string;
  tone: 'period' | 'fertile' | 'ovulation' | 'calm' | 'energy' | 'care' | 'mood' | 'log';
  title: string;
  body: string;
};

export function addDaysToKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m: m - 1, d };
}

export function daysBetween(fromKey: string, toKey: string) {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  const ms = Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d);
  return Math.round(ms / 86_400_000);
}

export function cycleDayForDate(
  lastPeriodStart: string | null,
  targetDate: string,
  avgCycleLength: number,
): number | null {
  if (!lastPeriodStart) return null;
  const offset = daysBetween(lastPeriodStart, targetDate);
  if (offset < 0) return null;
  return ((offset % avgCycleLength) + 1);
}

export function detectCyclePhaseForDate({
  lastPeriodStart,
  targetDate,
  avgCycleLength = 28,
  avgPeriodLength = 5,
}: {
  lastPeriodStart: string | null;
  targetDate: string;
  avgCycleLength?: number;
  avgPeriodLength?: number;
}): CyclePhaseInfo {
  if (!lastPeriodStart) {
    return { day: null, phase: 'unknown', phaseKa: 'უცნობი ფაზა' };
  }
  const cycleDay = cycleDayForDate(lastPeriodStart, targetDate, avgCycleLength);
  if (cycleDay == null) {
    return { day: null, phase: 'unknown', phaseKa: 'უცნობი ფაზა' };
  }
  const ovulation = avgCycleLength - 14;
  if (cycleDay <= avgPeriodLength) {
    return { day: cycleDay, phase: 'period', phaseKa: 'მენსტრუაცია' };
  }
  if (cycleDay >= ovulation - 5 && cycleDay <= ovulation + 1) {
    return {
      day: cycleDay,
      phase: cycleDay === ovulation ? 'ovulation' : 'fertile',
      phaseKa: cycleDay === ovulation ? 'ოვულაცია' : 'ნაყოფიერი ფანჯარა',
    };
  }
  if (cycleDay > ovulation + 1) {
    return { day: cycleDay, phase: 'luteal', phaseKa: 'ლუთეალური ფაზა' };
  }
  return { day: cycleDay, phase: 'follicular', phaseKa: 'ფოლიკულური ფაზა' };
}

export function buildDayPredictions({
  date,
  today,
  mark,
  phase,
  mode,
  log,
  nextPeriodStart,
  ovulationDate,
}: {
  date: string;
  today: string;
  mark?: CycleDayMark;
  phase: CyclePhaseInfo;
  mode: CycleMode;
  log?: CycleLog | null;
  nextPeriodStart?: string | null;
  ovulationDate?: string | null;
}): CycleDayPrediction[] {
  const cards: CycleDayPrediction[] = [];
  const isToday = date === today;
  const isFuture = date > today;
  const dayLabel = isToday ? 'დღეს' : isFuture ? 'ამ დღეს' : 'ამ დღეს';

  if (mark?.ovulation) {
    cards.push({
      id: 'ovulation',
      tone: 'ovulation',
      title: 'ოვულაციის დღე',
      body: isFuture
        ? 'პროგნოზის მიხედვით ამ დღეს სავარაუდოდ ოვულაციაა — ყველაზე მაღალი ნაყოფიერობის პერიოდი.'
        : 'ოვულაციის დღე — ორგანიზმი ამოიწურავს LH ჰორმონის პიკს. მოუსმინეთ სხეულის სიგნალებს.',
    });
  } else if (mark?.fertile) {
    cards.push({
      id: 'fertile',
      tone: 'fertile',
      title: 'ნაყოფიერი ფანჯარა',
      body:
        mode === 'TRY_TO_CONCEIVE'
          ? 'ნაყოფიერობის მაღალი პერიოდი — TTC რეჟიმში ეს დღეები ყველაზე მნიშვნელოვანია.'
          : 'ამ დღეებში ნაყოფიერობა მაღალია. კონტრაციის მეთოდის არჩევანი თქვენზეა დამოკიდებული.',
    });
  } else if (mark?.period) {
    cards.push({
      id: 'period',
      tone: 'period',
      title: mark.predicted ? 'პროგნოზი · მენსტრუაცია' : 'მენსტრუაცია',
      body: mark.predicted
        ? `${dayLabel} სავარაუდოდ მენსტრუაციის დღეა. მოამზადეთ საშუალებები და დაისვენეთ საჭიროებისამებრ.`
        : `${dayLabel} მენსტრუაციის ფაზაა — სითბო, ჰიდრატაცია და მსუბუქი მოძრაობა ხშირად ეხმარება.`,
    });
  }

  if (phase.day != null && !mark?.ovulation && !mark?.fertile && !mark?.period) {
    if (phase.phase === 'follicular') {
      cards.push({
        id: 'follicular',
        tone: 'energy',
        title: phase.phaseKa,
        body: `${dayLabel} ციკლის ${phase.day}-ე დღეა. ესტროგენი იზრდება — ხშირად ენერგია და კონცენტრაცია უკეთესია.`,
      });
    } else if (phase.phase === 'luteal') {
      cards.push({
        id: 'luteal',
        tone: 'calm',
        title: phase.phaseKa,
        body: `${dayLabel} ციკლის ${phase.day}-ე დღეა. პროგესტერონის ფაზა — შესაძლოა შებერილობა ან განწყობის ცვლა.`,
      });
    } else {
      cards.push({
        id: 'phase',
        tone: 'calm',
        title: phase.phaseKa,
        body:
          phase.day != null
            ? `${dayLabel} ციკლის ${phase.day}-ე დღეა (${phase.phaseKa}). მოუსმინეთ სხეულს და აღრიცხეთ სიმპტომები.`
            : 'მონიშნეთ ბოლო მენსტრუაციის დასაწყისი უფრო ზუსტი პროგნოზებისთვის.',
      });
    }
  }

  if (nextPeriodStart && mode !== 'PREGNANCY' && !mark?.period) {
    const until = daysBetween(date, nextPeriodStart);
    if (until > 0 && until <= 3) {
      cards.unshift({
        id: 'period_prep',
        tone: 'care',
        title: 'მოემზადეთ მენსტრუაციისთვის',
        body: 'ჰიგიენური საშუალებები, ტკივილგამაყუჩებელი, წყალი, დასვენება — მომდევნო დღეებში სავარაუდოდ დაიწყება.',
      });
    }
    if (until > 3 && until <= 7) {
      cards.push({
        id: 'period_soon',
        tone: 'care',
        title: `მენსტრუაცია ~${until} დღეში`,
        body: 'პროგნოზის მიხედვით მენსტრუაცია ახლოვდება — დაისვენეთ და მოამზადეთ საშუალებები.',
      });
    }
  }

  if (ovulationDate && mode === 'TRY_TO_CONCEIVE' && !mark?.ovulation && !mark?.fertile) {
    const untilOv = daysBetween(date, ovulationDate);
    if (untilOv > 0 && untilOv <= 3) {
      cards.push({
        id: 'ovulation_soon',
        tone: 'fertile',
        title: `ოვულაცია ~${untilOv} დღეში`,
        body: 'ოვულაცია ახლოვდება — BBT, ლორწო და სიმპტომების აღრიცხვა ზუსტობას ზრდის.',
      });
    }
  }

  if (log) {
    const bits: string[] = [];
    if (log.flow && log.flow !== 'none') bits.push(`გამონადენი: ${log.flow}`);
    if (log.symptoms?.length) bits.push(`სიმპტომები: ${log.symptoms.length}`);
    if (log.moods?.length) bits.push(`განწყობა: ${log.moods.length}`);
    cards.unshift({
      id: 'logged',
      tone: 'log',
      title: isToday ? 'დღევანდელი ჩანაწერი' : 'აღრიცხულია',
      body: bits.length ? bits.join(' · ') : 'ამ დღის ჩანაწერი შენახულია.',
    });
  } else if (isToday) {
    cards.push({
      id: 'log_today',
      tone: 'mood',
      title: 'დღის აღრიცხვა',
      body: 'დღეს ჯერ არაფერი არ არის აღრიცხული — დაამატეთ გამონადენი, სიმპტომები ან განწყობა.',
    });
  }

  return cards.slice(0, 4);
}
