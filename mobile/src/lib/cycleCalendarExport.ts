import type { CycleBundle } from '@/lib/api';
import { ka } from '@/i18n/ka';

function fmtUtc(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function addDaysKey(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function buildCycleIcs(bundle: CycleBundle): string {
  const phases = bundle.predictions;
  const showFertility = bundle.contraception?.presentation?.showFertilityMarkers !== false;
  const events: string[] = [];
  const now = fmtUtc(new Date());

  if (phases.nextPeriodStart && phases.nextPeriodEnd) {
    const end = addDaysKey(phases.nextPeriodEnd, 1);
    events.push(`BEGIN:VEVENT
UID:medicard-period-${phases.nextPeriodStart}@medicard.ge
DTSTAMP:${now}
DTSTART;VALUE=DATE:${phases.nextPeriodStart.replace(/-/g, '')}
DTEND;VALUE=DATE:${end.replace(/-/g, '')}
SUMMARY:${ka.cycle.icsPeriod}
END:VEVENT`);
  }

  if (showFertility && phases.fertileWindow) {
    const end = addDaysKey(phases.fertileWindow.end, 1);
    events.push(`BEGIN:VEVENT
UID:medicard-fertile-${phases.fertileWindow.start}@medicard.ge
DTSTAMP:${now}
DTSTART;VALUE=DATE:${phases.fertileWindow.start.replace(/-/g, '')}
DTEND;VALUE=DATE:${end.replace(/-/g, '')}
SUMMARY:${ka.cycle.icsFertile}
END:VEVENT`);
  }

  if (showFertility && phases.ovulationDate) {
    events.push(`BEGIN:VEVENT
UID:medicard-ovulation-${phases.ovulationDate}@medicard.ge
DTSTAMP:${now}
DTSTART;VALUE=DATE:${phases.ovulationDate.replace(/-/g, '')}
SUMMARY:${ka.cycle.icsOvulation}
END:VEVENT`);
  }

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Medicard.GE//Cycle//KA
CALSCALE:GREGORIAN
${events.join('\n')}
END:VCALENDAR`;
}
