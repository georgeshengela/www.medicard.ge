import type { CycleBundle } from '@/lib/api';

function fmtUtc(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function addDaysKey(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function buildCycleIcs(bundle: CycleBundle): string {
  const phases = bundle.predictions;
  const events: string[] = [];
  const now = fmtUtc(new Date());

  if (phases.nextPeriodStart && phases.nextPeriodEnd) {
    const end = addDaysKey(phases.nextPeriodEnd, 1);
    events.push(`BEGIN:VEVENT
UID:medicard-period-${phases.nextPeriodStart}@medicard.ge
DTSTAMP:${now}
DTSTART;VALUE=DATE:${phases.nextPeriodStart.replace(/-/g, '')}
DTEND;VALUE=DATE:${end.replace(/-/g, '')}
SUMMARY:მენსტრუაცია (პროგნოზი)
END:VEVENT`);
  }

  if (phases.fertileWindow) {
    const end = addDaysKey(phases.fertileWindow.end, 1);
    events.push(`BEGIN:VEVENT
UID:medicard-fertile-${phases.fertileWindow.start}@medicard.ge
DTSTAMP:${now}
DTSTART;VALUE=DATE:${phases.fertileWindow.start.replace(/-/g, '')}
DTEND;VALUE=DATE:${end.replace(/-/g, '')}
SUMMARY:ნაყოფიერი ფანჯარა
END:VEVENT`);
  }

  if (phases.ovulationDate) {
    events.push(`BEGIN:VEVENT
UID:medicard-ovulation-${phases.ovulationDate}@medicard.ge
DTSTAMP:${now}
DTSTART;VALUE=DATE:${phases.ovulationDate.replace(/-/g, '')}
SUMMARY:ოვულაცია (პროგნოზი)
END:VEVENT`);
  }

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Medicard.GE//Cycle//KA
CALSCALE:GREGORIAN
${events.join('\n')}
END:VCALENDAR`;
}
