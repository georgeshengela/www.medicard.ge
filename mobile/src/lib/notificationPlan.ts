/** Monday=0 … Sunday=6 → Expo weekday (1=Sunday … 7=Saturday). */
export function expoWeekdayFromMonday(mondayIndex: number): number {
  return mondayIndex === 6 ? 1 : mondayIndex + 2;
}

export function isEveryWeekday(days: number[] | undefined): boolean {
  if (!days?.length) return true;
  const unique = [...new Set(days.filter((d) => d >= 0 && d <= 6))];
  return unique.length === 7;
}

export type MedReminderSlot = {
  identifier: string;
  hour: number;
  minute: number;
  /** Expo weekday when this is a weekly slot. */
  weekday?: number;
  /** A finite course uses a one-off local date, never an endless repeating trigger. */
  date?: Date;
};

/** One daily slot, or one weekly slot per selected Monday-index day. */
export function planMedicationReminderSlots(
  medicationId: string,
  time: string,
  daysOfWeek?: number[],
  course?: { startDate?: string; endDate?: string },
  now = new Date(),
): MedReminderSlot[] {
  const [hour, minute] = time.split(':').map(Number);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
  if (course?.startDate || course?.endDate) {
    const civilDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const [y, m, d] = value.split('-').map(Number), date = new Date(y, m - 1, d, 12);
      return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
    };
    const start = course.startDate ? civilDate(course.startDate) : new Date(now);
    const end = course.endDate ? civilDate(course.endDate) : null;
    if (!start || (course.endDate && !end)) return [];
    start.setHours(0, 0, 0, 0); end?.setHours(23, 59, 59, 999);
    const cursor = new Date(now); cursor.setHours(0, 0, 0, 0);
    if (start > cursor) cursor.setTime(start.getTime());
    const slots: MedReminderSlot[] = [];
    // Upcoming dates are replenished when the app loads medications. Never schedule past course end.
    for (let day = 0; day < 60 && (!end || cursor <= end); day++, cursor.setDate(cursor.getDate() + 1)) {
      const date = new Date(cursor); date.setHours(hour, minute, 0, 0);
      const mondayIndex = (date.getDay() + 6) % 7;
      if (date <= now || (!isEveryWeekday(daysOfWeek) && !daysOfWeek?.includes(mondayIndex))) continue;
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
      slots.push({ identifier: medicationId + ':' + time + ':' + key, hour, minute, date });
    }
    return slots;
  }

  if (isEveryWeekday(daysOfWeek)) {
    return [{ identifier: `${medicationId}:${time}`, hour, minute }];
  }

  return [...new Set(daysOfWeek)]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((day) => ({
      identifier: `${medicationId}:${time}:${day}`,
      hour,
      minute,
      weekday: expoWeekdayFromMonday(day),
    }));
}

export function engageDestination(
  family: string,
  extra?: {
    visitId?: string;
    chatMode?: string;
    chatId?: string;
    insight?: 'steps' | 'cycle' | 'meds';
  },
): string {
  switch (family) {
    case 'weekly':
    case 'feature':
      return '/week';
    case 'hydration':
      return '/health-metrics/hydration';
    case 'stepsQuiet':
      return '/health-metrics/steps';
    case 'insight':
      if (extra?.insight === 'cycle') return '/cycle/trends';
      if (extra?.insight === 'meds') return '/medications/reminders';
      if (extra?.insight === 'steps') return '/health-metrics/steps';
      return '/week';
    case 'visitFollowup':
      return extra?.visitId ? `/visits/editor?id=${encodeURIComponent(extra.visitId)}` : '/visits';
    case 'question':
      return '/(tabs)/profile?action=question';
    case 'chat':
    case 'checkin':
    case 'sleep':
    case 'reengage':
    case 'morning': {
      const mode = extra?.chatMode === 'CONSILIUM' ? 'CONSILIUM' : 'DOCTOR';
      return extra?.chatId ? `/chat/${mode}?sessionId=${encodeURIComponent(extra.chatId)}` : `/chat/${mode}`;
    }
    case 'unfinished':
      return '/medications/add';
    case 'cycle':
      return '/cycle';
    case 'birthday':
      return '/(tabs)/home';
    case 'weatherWellness':
      return '/weather?from=push';
    case 'questSmart':
      return '/medi-quest?from=push';
    default:
      return '/(tabs)/home';
  }
}

export function routeFromNotificationData(data: Record<string, unknown> | undefined | null): string | null {
  if (!data || typeof data !== 'object') return null;

  const explicit = data.route;
  if (typeof explicit === 'string' && explicit.startsWith('/')) return explicit;

  switch (data.type) {
    case 'medication':
      return typeof data.medicationId === 'string' && data.medicationId
        ? `/medications/${data.medicationId}`
        : '/medications';
    case 'weight-goal':
      return '/health-metrics/weight';
    case 'steps-goal':
      return '/health-metrics/steps';
    case 'visit_reminder':
      return typeof data.visitId === 'string' && data.visitId
        ? `/visits/editor?id=${encodeURIComponent(data.visitId)}`
        : '/visits';
    case 'quota_reset':
      return '/chat/DOCTOR';
    case 'cycle_reminder':
    case 'cycle_tip':
      return '/cycle';
    case 'pregnancy_care_plan':
      return typeof data.route === 'string' && data.route.startsWith('/')
        ? data.route
        : '/cycle/pregnancy/care-plan';
    case 'pet_care':
      return typeof data.route === 'string' && data.route.startsWith('/')
        ? data.route
        : typeof data.petId === 'string'
          ? `/pets/${data.petId}/care`
          : '/pets';
    case 'medi_engage':
      return engageDestination(typeof data.family === 'string' ? data.family : '');
    default:
      return null;
  }
}

export function prefixForNotificationId(id: string): 'med' | 'cycle' | 'visit' | 'steps' | 'weight' | 'engage' | 'quota' | 'qa' | 'pets' | 'other' {
  if (id.startsWith('med:')) return 'med';
  if (id.startsWith('cycle:')) return 'cycle';
  if (id.startsWith('visit:')) return 'visit';
  if (id.startsWith('steps:')) return 'steps';
  if (id.startsWith('weight:')) return 'weight';
  if (id.startsWith('engage:')) return 'engage';
  if (id.startsWith('quota:')) return 'quota';
  if (id.startsWith('qa:')) return 'qa';
  if (id.startsWith('pets:')) return 'pets';
  return 'other';
}

/** Course limits apply to the dose list as well as notification scheduling. */
export function medicationCourseIncludesDate(config: { startDate?: string; endDate?: string }, date: string): boolean {
  return (!config.startDate || date >= config.startDate) && (!config.endDate || date <= config.endDate);
}
