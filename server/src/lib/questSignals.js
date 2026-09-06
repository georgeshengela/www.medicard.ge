/**
 * Quest signal router.
 *
 * DOMAIN SIGNAL → relevant progress types → authoritative recalculation.
 * Domain handlers call refreshQuestProgressForUser and must not compute Quest math.
 */
export const QuestSignal = Object.freeze({
  STEPS_CHANGED: 'STEPS_CHANGED',
  HYDRATION_CHANGED: 'HYDRATION_CHANGED',
  MEDI_USED: 'MEDI_USED',
  QUEST_DASHBOARD_REFRESH: 'QUEST_DASHBOARD_REFRESH',
  TIMEZONE_CHANGED: 'TIMEZONE_CHANGED',
});

export const SIGNAL_PROGRESS_TYPES = Object.freeze({
  [QuestSignal.STEPS_CHANGED]: ['STEPS'],
  [QuestSignal.HYDRATION_CHANGED]: ['HYDRATION_GOAL_PERCENT'],
  [QuestSignal.MEDI_USED]: ['MEDI_DAILY_USE'],
  [QuestSignal.QUEST_DASHBOARD_REFRESH]: ['STEPS', 'HYDRATION_GOAL_PERCENT', 'MEDI_DAILY_USE'],
  [QuestSignal.TIMEZONE_CHANGED]: ['STEPS', 'HYDRATION_GOAL_PERCENT', 'MEDI_DAILY_USE'],
});

export function progressTypesForSignal(signal) {
  return SIGNAL_PROGRESS_TYPES[signal] || null;
}

export async function refreshQuestProgressForUser(userId, signal, options = {}) {
  const types = progressTypesForSignal(signal);
  if (!types) {
    console.warn('[quest] unknown signal', signal);
    return [];
  }
  try {
    const { updateQuestProgress } = await import('./quest.js');
    return await updateQuestProgress(userId, {}, {
      ...options,
      signals: types,
      source: options.source || 'sync',
    });
  } catch (error) {
    console.warn('[quest] signal refresh failed', signal, error?.message);
    return [];
  }
}
