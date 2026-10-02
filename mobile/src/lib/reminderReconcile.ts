import { getScopedPreference, localAccountId, setScopedPreference } from '@/lib/localAccount';

/**
 * Puts every scheduled-reminder family back on the device after sign-in, reinstall or a new phone, and
 * keeps them topped up on every return to the app (owner 2026-10-02: reminders must always arrive).
 * Before this, visits, meals, steps and weight were scheduled only when their own screen was opened,
 * so sign-out (which cancels everything) or a goal restored from the server left them silent.
 * Medications are kept by useMedications (Home), cycle/pregnancy by reconcileCycleReminders and pets by
 * reconcilePetCareReminders — each runs on the same triggers. Throttled (loop-guard rules, AGENTS.md).
 */
const MIN_GAP_MS = 10 * 60_000;
const DEFAULTS_ON_KEY = 'medicard.reminders.defaultsOn.v1';
let lastRunAt = 0;
let running: Promise<void> | null = null;

async function step(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch {
    /* one family failing must not stop the others; the next foreground retries */
  }
}

/** Once per account: old builds created steps/weight goals and cycle prefs with reminders off by default. */
async function applyDefaultsOnOnce(owner: string): Promise<void> {
  if (await getScopedPreference(DEFAULTS_ON_KEY)) return;
  await step(async () => {
    const { loadStepsGoal, saveStepsGoal } = await import('@/lib/stepsGoal');
    const goal = await loadStepsGoal();
    if (goal && !goal.reminderEnabled) {
      await saveStepsGoal({ ...goal, reminderEnabled: true, reminderDays: goal.reminderDays?.length ? goal.reminderDays : [1, 3, 5] });
    }
  });
  await step(async () => {
    const { loadWeightGoal, saveWeightGoal } = await import('@/lib/weightGoal');
    const goal = await loadWeightGoal();
    if (goal && !goal.reminderEnabled) {
      await saveWeightGoal({ ...goal, reminderEnabled: true, reminderDays: goal.reminderDays?.length ? goal.reminderDays : [1, 3, 4] });
    }
  });
  await step(async () => {
    const { CYCLE_REMINDER_KEYS } = await import('@/lib/cycleReminderPrefs');
    const { getPreference, setPreference } = await import('@/lib/storage');
    if ((await getPreference(CYCLE_REMINDER_KEYS.enabled)) === '0') await setPreference(CYCLE_REMINDER_KEYS.enabled, '1');
  });
  if (localAccountId() === owner) await setScopedPreference(DEFAULTS_ON_KEY, String(Date.now()));
}

export function reconcileAllLocalReminders(opts: { force?: boolean } = {}): Promise<void> {
  const owner = localAccountId();
  if (!owner) return Promise.resolve();
  if (running) return running;
  if (!opts.force && Date.now() - lastRunAt < MIN_GAP_MS) return Promise.resolve();
  lastRunAt = Date.now();
  running = (async () => {
    await applyDefaultsOnOnce(owner);
    const { api } = await import('@/lib/api');
    await step(async () => {
      const { syncVisitReminders } = await import('@/lib/visitNotifications');
      const { visits } = await api.visits.list();
      if (localAccountId() === owner) await syncVisitReminders(visits);
    });
    await step(async () => {
      const { syncNutritionReminders } = await import('@/lib/notifications');
      const { preferences } = await api.nutrition.preferences.get();
      await syncNutritionReminders(preferences.reminders, owner);
    });
    await step(async () => {
      const { loadStepsGoal, syncStepsGoalReminders } = await import('@/lib/stepsGoal');
      const goal = await loadStepsGoal();
      if (goal && localAccountId() === owner) await syncStepsGoalReminders(goal);
    });
    await step(async () => {
      const { loadWeightGoal, syncWeightGoalReminders } = await import('@/lib/weightGoal');
      const goal = await loadWeightGoal();
      if (goal && localAccountId() === owner) await syncWeightGoalReminders(goal);
    });
  })().finally(() => {
    running = null;
  });
  return running;
}
