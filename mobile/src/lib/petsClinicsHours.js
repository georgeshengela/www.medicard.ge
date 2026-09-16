/** Open/closed from published hours in Asia/Tbilisi — not a live clinic feed. */

export const CLINICS_TIMEZONE = 'Asia/Tbilisi';

const WEEKDAY_BY_UTC = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function tbilisiClockParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINICS_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(map.weekday || ''));
  return {
    weekday: WEEKDAY_BY_UTC[weekdayIndex] || 'monday',
    minutes: Number(map.hour || 0) * 60 + Number(map.minute || 0),
  };
}

export function slotOpenAt(slot, minutes) {
  if (!slot) return { open: false, known: false };
  if (slot.closed) return { open: false, known: true };
  if (slot.allDay) return { open: true, known: true };
  const openMin = Number(slot.openMin);
  const closeMin = Number(slot.closeMin);
  if (!Number.isFinite(openMin) || !Number.isFinite(closeMin)) return { open: false, known: false };
  if (closeMin > openMin) return { open: minutes >= openMin && minutes < closeMin, known: true };
  if (closeMin < openMin) return { open: minutes >= openMin || minutes < closeMin, known: true };
  return { open: false, known: true };
}

export function clinicOpenState(clinic, now = new Date()) {
  const { weekday, minutes } = tbilisiClockParts(now);
  const hours = clinic?.hours && typeof clinic.hours === 'object' ? clinic.hours : {};
  const knownDays = Object.values(hours).some(Boolean);
  if (!knownDays) return { open: false, known: false, weekday, minutes };
  return { ...slotOpenAt(hours[weekday], minutes), weekday, minutes };
}
