import { api } from '@/lib/api';
import { createWeightDraft, deadlineFromPace, draftToGoal, saveWeightGoal } from '@/lib/weightGoal';
import { lastPeriodValid, lastPeriodYmd, type AssessmentFormState } from '@/lib/assessmentForm';

/**
 * The goal-specific first step of onboarding (step 5), saved where the feature already reads it (one
 * source of truth). It runs before the final profile save of the questions, so when it fails the person
 * stays on the step with the error: Finish sends it again, Skip goes on without it. Nothing is dropped
 * without a word (the last period date used to be swallowed by a `.catch`). The medication goal saves
 * nothing here: a medicine needs a dose and times she has not given yet, so Home leads her to finish it.
 */
export async function saveOnboardingGoal(form: AssessmentFormState): Promise<void> {
  const confirmed = new Set(form.confirmedSteps ?? []);
  if (form.primaryGoal === 'nutrition' && confirmed.has('goal-weight')) {
    const draft = createWeightDraft(form.weightKg);
    draft.targetKg = form.targetWeightKg;
    draft.deadlineYmd = deadlineFromPace(form.weightKg, form.targetWeightKg, 'moderate');
    // Reminders are on (default); nothing is shown until notifications are granted in step 7, and the
    // reminder restore after that grant schedules them (a stored `false` used to keep them off forever).
    const goal = draftToGoal(draft);
    if (goal) await saveWeightGoal({ ...goal, updatedAt: new Date().toISOString() });
  }
  if (form.primaryGoal === 'cycle' && form.gender === 'FEMALE' && confirmed.has('goal-cycle') && lastPeriodValid(form)) {
    // Only the day she picked on the step; idempotent on the server, so a retry is safe.
    await api.cycle.setLastPeriod(lastPeriodYmd(form));
  }
}
