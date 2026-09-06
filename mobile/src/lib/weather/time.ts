/** Wall-clock helpers in the forecast timezone — never assume Asia/Tbilisi. */

export type ZonedParts = {
  ymd: string;
  hour: number;
  minute: number;
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const bag = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    ymd: `${bag.year}-${bag.month}-${bag.day}`,
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

/** Open-Meteo local ISO (`2026-09-06T16:00`) — hour in the forecast timezone. */
export function localHourFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const match = String(iso).match(/T(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  return Number.isFinite(hour) ? hour : null;
}

export function localYmdFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ymd = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

export function formatHourRange(startIso: string, endIso: string): { start: string; end: string } {
  const startH = localHourFromIso(startIso) ?? 0;
  const endH = localHourFromIso(endIso) ?? startH + 1;
  return {
    start: `${String(startH).padStart(2, '0')}:00`,
    end: `${String(endH).padStart(2, '0')}:00`,
  };
}

export function addLocalHours(iso: string, hours: number): string {
  const ymd = localYmdFromIso(iso);
  const hour = localHourFromIso(iso);
  if (!ymd || hour == null) return iso;
  const next = hour + hours;
  if (next >= 0 && next < 24) {
    return `${ymd}T${String(next).padStart(2, '0')}:00`;
  }
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.floor(next / 24));
  const wrap = ((next % 24) + 24) % 24;
  const nextYmd = date.toISOString().slice(0, 10);
  return `${nextYmd}T${String(wrap).padStart(2, '0')}:00`;
}

export function weatherAgeMs(updatedAt: string | null | undefined, now = Date.now()): number {
  if (!updatedAt) return Number.POSITIVE_INFINITY;
  const at = new Date(updatedAt).getTime();
  return Number.isFinite(at) ? Math.max(0, now - at) : Number.POSITIVE_INFINITY;
}
