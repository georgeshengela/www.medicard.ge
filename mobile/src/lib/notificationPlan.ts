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
      const mode = extra?.chatMode === 'CONSILIUM' ? 'deep' : 'doctor';
      return extra?.chatId ? `/assistant?mode=${mode}&sessionId=${encodeURIComponent(extra.chatId)}` : `/assistant?mode=${mode}`;
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

/**
 * Top-level screens a notification may open (mirrors mobile/app; a test keeps them in sync).
 * A mistyped route from an admin broadcast falls back instead of opening a "not found" page.
 */
export const NOTIFICATION_ROUTE_ROOTS = [
  '(tabs)', 'assistant', 'chat', 'community', 'cycle', 'explore', 'health-metrics', 'invite', 'lab',
  'medi-companion', 'medi-quest', 'medications', 'medipulsi', 'module', 'nutrition', 'package', 'pets',
  'pharmacy', 'profile', 'record', 'run', 'share', 'symptoms', 'visits', 'weather', 'week', 'trainer', 'coach', 'c',
] as const;

export function isNotificationRoute(route: unknown): route is string {
  if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//')) return false;
  const root = route.slice(1).split(/[/?#]/, 1)[0];
  return (NOTIFICATION_ROUTE_ROOTS as readonly string[]).includes(root);
}

export function routeFromNotificationData(data: Record<string, unknown> | undefined | null): string | null {
  if (!data || typeof data !== 'object') return null;

  if (isNotificationRoute(data.route)) return data.route;

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
      return '/assistant?mode=doctor';
    case 'cycle_reminder':
    case 'cycle_tip':
      return '/cycle';
    case 'pregnancy_care_plan':
      return '/cycle/pregnancy/care-plan';
    case 'pet_care':
      return typeof data.petId === 'string'
          ? `/pets/${data.petId}/care`
          : '/pets';
    case 'medi_engage':
      return engageDestination(typeof data.family === 'string' ? data.family : '');
    default:
      // An unknown or mistyped route still opens the app on Home rather than nowhere.
      return data.route !== undefined ? '/(tabs)/home' : null;
  }
}

/** One tap, one key: on a cold start the launch response and the listener both report the same tap. */
export function notificationResponseKey(response: {
  actionIdentifier?: string;
  notification: { date?: number; request: { identifier?: string } };
}): string {
  const { notification } = response;
  return `${notification.request.identifier ?? ''}|${notification.date ?? ''}|${response.actionIdentifier ?? ''}`;
}

/**
 * A tapped notification may navigate only once the signed-in app shell is on screen.
 * expo-router wraps app/_layout in its own internal root stack. Until our Stack mounts
 * (AuthGate is still restoring the session), a push has no inner navigator to land in and
 * pushes another copy of the whole root layout instead. The copy re-read the same launch
 * response and pushed again: an endless remount loop on the splash with a flickering
 * status bar. Hold the route until this is true, and handle each tap once.
 */
export function canOpenNotificationRoute(state: {
  appReady: boolean;
  signedIn: boolean;
  segments: readonly string[];
}): boolean {
  return (
    state.appReady &&
    state.signedIn &&
    // [] means our Stack is not mounted yet or the index route is still redirecting.
    state.segments.length > 0 &&
    state.segments[0] !== '(auth)'
  );
}

export function prefixForNotificationId(id: string): 'med' | 'cycle' | 'visit' | 'steps' | 'weight' | 'engage' | 'quota' | 'qa' | 'pets' | 'nutrition' | 'other' {
  if (id.startsWith('med:')) return 'med';
  if (id.startsWith('cycle:')) return 'cycle';
  if (id.startsWith('visit:')) return 'visit';
  if (id.startsWith('steps:')) return 'steps';
  if (id.startsWith('weight:')) return 'weight';
  if (id.startsWith('engage:')) return 'engage';
  if (id.startsWith('quota:')) return 'quota';
  if (id.startsWith('qa:')) return 'qa';
  if (id.startsWith('pets:')) return 'pets';
  if (id.startsWith('nutrition:') || id.startsWith('fasting:')) return 'nutrition';
  return 'other';
}

/** Course limits apply to the dose list as well as notification scheduling. */
export function medicationCourseIncludesDate(config: { startDate?: string; endDate?: string }, date: string): boolean {
  return (!config.startDate || date >= config.startDate) && (!config.endDate || date <= config.endDate);
}
