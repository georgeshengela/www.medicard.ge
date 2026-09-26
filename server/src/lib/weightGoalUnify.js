import { shiftCivil } from './nutritionProgram.js';

/**
 * One weight goal (Phase 2.3, 2026-09-27). `appState.weightGoal` is the single source of truth;
 * the nutrition program only links to it (`goalLink`) and recalculates calories from it.
 * These helpers read both historic places so no existing goal is lost:
 * - an old nutrition program saved before the canonical write existed still carries its target;
 * - an old program without `goalLink` must still notice when the weight goal moved.
 */

const ymd = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Mirrors saveNutritionProgram's pace/horizon so a derived goal matches a freshly saved one. */
export function goalFromProgram(program) {
  const config = program?.config;
  if (!config || !Number.isFinite(config.targetKg) || !Number.isFinite(config.weightKg)) return null;
  const startedYmd = ymd(program.startedOn) || ymd(program.updatedAt) || ymd(program.createdAt);
  if (!startedYmd) return null;
  const pace = config.mode === 'gain' ? 0.2 : config.pace === 'gentle' ? 0.25 : 0.4;
  const weeks = Math.abs(config.targetKg - config.weightKg) / pace;
  return {
    id: `nutrition-${startedYmd}`,
    startKg: config.weightKg,
    targetKg: config.targetKg,
    startedYmd,
    deadlineYmd: shiftCivil(startedYmd, Math.max(28, Math.ceil(weeks * 7))),
    paceKgPerWeek: pace,
    pace: pace <= 0.25 ? 'slow' : 'moderate',
    reminderEnabled: false,
    reminderDays: [],
    reminderHour: 9,
    reminderMinute: 0,
    completedSeen: false,
    // Older than any real edit, so a goal the person sets later always wins the merge.
    updatedAt: `${startedYmd}T00:00:00.000Z`,
  };
}

/** The canonical goal wins; a program-only goal is recovered instead of disappearing. */
export function unifiedWeightGoal(weightGoal, program) {
  if (weightGoal && Number.isFinite(weightGoal.targetKg)) return weightGoal;
  if (program && program.active === false) return weightGoal ?? null;
  return goalFromProgram(program) ?? weightGoal ?? null;
}

/** True when the nutrition plan's calories were computed for a different goal than today's. */
export function programGoalChanged(program, weightGoal) {
  if (!program) return false;
  if (program.goalLink) {
    return program.goalLink.id !== weightGoal?.id || program.goalLink.targetKg !== weightGoal?.targetKg;
  }
  const target = program.config?.targetKg;
  return !!weightGoal && Number.isFinite(target) && weightGoal.targetKg !== target;
}
