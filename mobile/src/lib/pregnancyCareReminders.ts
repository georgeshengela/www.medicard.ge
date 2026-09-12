import { parseDateKey } from '@/lib/cyclePhase';
import { bumpOutOfQuiet } from '@/lib/mediEngageModel';
import { loadEngagePrefs } from '@/lib/mediEngagePrefs';
import {
  CYCLE_REMINDER_HOUR,
  CYCLE_REMINDER_MINUTE,
} from '@/lib/cycleNotificationContract.js';
import {
  cancelPregnancyCareReminders,
  schedulePregnancyCareDateNotification,
} from '@/lib/notifications';
import { pregnancyCareCopy } from '@/i18n/cycle/pregnancyCare.js';
import {
  REMINDER_MODE,
  buildPregnancyCareReminderCandidates,
  pregnancyCareReminderCopy,
  revalidatePregnancyCareReminder,
} from '@/lib/pregnancyCareReminderContract.js';
import type { CyclePregnancyCarePlan } from '@/lib/api';

function reminderDate(ymd: string, quietStart: string, quietEnd: string): Date {
  const { y, m, d } = parseDateKey(ymd);
  const atNine = new Date(y, m, d, CYCLE_REMINDER_HOUR, CYCLE_REMINDER_MINUTE, 0, 0);
  return bumpOutOfQuiet(atNine, quietStart, quietEnd);
}

export async function syncPregnancyCareReminders(opts: {
  plan: CyclePregnancyCarePlan | null;
  userId: string;
  mode: string;
  today: string;
  now?: Date;
  privacyEnabled?: boolean;
}): Promise<number> {
  await cancelPregnancyCareReminders();
  const plan = opts.plan;
  if (!plan?.available || !plan.pregnancyEpisodeId) return 0;

  const engage = await loadEngagePrefs().catch(() => null);
  const now = opts.now || new Date();
  const candidates = buildPregnancyCareReminderCandidates({
    userId: opts.userId,
    episodeId: plan.pregnancyEpisodeId,
    mode: opts.mode,
    pregnancyActive: plan.pregnancyActive,
    episodeStatus: 'ACTIVE',
    items: plan.items,
    today: opts.today,
    now,
  });

  let count = 0;
  for (const candidate of candidates) {
    const check = revalidatePregnancyCareReminder(candidate, {
      userId: opts.userId,
      mode: opts.mode,
      pregnancyActive: plan.pregnancyActive,
      episodeStatus: 'ACTIVE',
      episodeId: plan.pregnancyEpisodeId,
      items: plan.items,
      today: opts.today,
      now,
    });
    if (!check.ok) continue;
    const exact = candidate.reminderMode === REMINDER_MODE.EXACT_TIME;
    const date = exact
      ? new Date(candidate.fireAtMs)
      : reminderDate(candidate.eventDate, engage?.quietStart ?? '22:00', engage?.quietEnd ?? '08:00');
    if (date.getTime() <= Date.now()) continue;
    const itemTitle = pregnancyCareCopy(
      plan.items.find((row) => row.id === candidate.careItemId)?.titleKey || '',
    );
    const copy = pregnancyCareReminderCopy({
      offset: candidate.offset,
      itemTitle,
      reminderMode: candidate.reminderMode,
    });
    const ok = await schedulePregnancyCareDateNotification({
      identifier: candidate.candidateId,
      title: copy.title,
      body: copy.body,
      date,
      privacyEnabled: Boolean(opts.privacyEnabled),
      data: {
        candidateId: candidate.candidateId,
        careItemId: candidate.careItemId,
        episodeId: candidate.episodeId,
        userId: candidate.userId,
        plannedDate: candidate.plannedDate,
        plannedTime: candidate.plannedTime,
        offset: candidate.offset,
        reminderMode: candidate.reminderMode,
        eventDate: candidate.eventDate,
        fireClock: candidate.fireClock,
        route: candidate.route,
        templateKey: candidate.templateKey,
      },
    });
    if (ok) count += 1;
  }
  return count;
}
