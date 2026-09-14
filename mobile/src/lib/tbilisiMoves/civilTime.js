/** Georgia has no DST. Must match server `adminAnalyticsRange.js` / tbilisiMoves/time.js. */
export const TBILISI_TZ = 'Asia/Tbilisi';
export const TBILISI_OFFSET = '+04:00';

export function tbilisiYmd(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TBILISI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function tbilisiMidnight(ymd) {
  return new Date(`${ymd}T00:00:00.000${TBILISI_OFFSET}`);
}

export function addDaysYmd(ymd, days) {
  const start = tbilisiMidnight(ymd);
  const shifted = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return tbilisiYmd(shifted);
}

/**
 * One competition date only. Never returns an interval that crosses Tbilisi midnight.
 */
export function competitionInterval(ymd, now = new Date()) {
  const start = tbilisiMidnight(ymd);
  const dayEnd = tbilisiMidnight(addDaysYmd(ymd, 1));
  const capped = Math.min(now.getTime(), dayEnd.getTime());
  const end = new Date(Math.max(capped, start.getTime() + 1000));
  return {
    start,
    end,
    dayEnd,
    tbilisiDate: ymd,
    crossedMidnight: tbilisiYmd(now) !== ymd && now.getTime() >= dayEnd.getTime(),
  };
}

export function datesToCollect({ serverDate, graceHours, now = new Date() }) {
  const dates = [serverDate];
  const graceHoursNum = Number(graceHours);
  if (!Number.isFinite(graceHoursNum) || graceHoursNum <= 0) return dates;
  const graceEnd = new Date(tbilisiMidnight(serverDate).getTime() + graceHoursNum * 60 * 60 * 1000);
  if (now.getTime() < graceEnd.getTime()) {
    dates.push(addDaysYmd(serverDate, -1));
  }
  return dates;
}

export function intervalSpansTwoCompetitionDates(start, end) {
  return tbilisiYmd(start) !== tbilisiYmd(new Date(end.getTime() - 1));
}
