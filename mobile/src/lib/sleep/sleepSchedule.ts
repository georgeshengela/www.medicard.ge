/** MEDISLEEP reminder schedule maths (pure — node tests load it; sleepReminders.ts schedules from it). */
import { plannedBedtimeMinutes } from './sleepTime.ts';
import type { SleepPlan } from './sleepTypes';

/** Monday-first weekday index (0 = Monday) of a JS date. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Wind-down slots for a week: for each morning weekday, the bedtime that leads into it minus the wind-down.
 * Pure — the tests call it. Returns the evening's weekday (0 = Monday) and the clock time.
 */
export function windDownSlots(plan: SleepPlan): { weekday: number; minutes: number }[] {
  const slots: { weekday: number; minutes: number }[] = [];
  // A reference week starting on a Monday (2026-10-12 is a Monday).
  for (let i = 0; i < 7; i++) {
    const morning = new Date(2026, 9, 12 + i, 12, 0, 0);
    const bed = plannedBedtimeMinutes(plan, morning);
    // Before noon → it is after midnight of that morning; otherwise the evening before.
    let minutes = bed - plan.windDownMinutes;
    let weekday = bed < 12 * 60 ? mondayIndex(morning) : (mondayIndex(morning) + 6) % 7;
    if (minutes < 0) {
      minutes += 1440;
      weekday = (weekday + 6) % 7;
    }
    slots.push({ weekday, minutes });
  }
  return slots;
}

