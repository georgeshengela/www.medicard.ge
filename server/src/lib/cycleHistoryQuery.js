/**
 * Cycle history windows.
 * CALCULATION: 5 civil years of date+flow (segmentation + averages + LMP).
 * DISPLAY: latest 400 full rows (calendar overlay, AI last-7, partner today).
 * AI: still last 7 days from the display slice.
 *
 * The old take:400 on all rows dropped older period starts whenever the user
 * logged densely (symptoms every day ≈ 400 days).
 */

import { addDays } from './cycle.js';

export const CYCLE_ENGINE_HISTORY_DAYS = 365 * 5;
export const CYCLE_DISPLAY_LOG_LIMIT = 400;

export function engineHistoryCutoff(today) {
  return addDays(today, -CYCLE_ENGINE_HISTORY_DAYS);
}

export function filterLogsForEngine(logs, today) {
  const cutoff = engineHistoryCutoff(today);
  return (logs || []).filter((log) => log?.date >= cutoff);
}

/** What the previous take:400 query kept — newest rows, any flow. */
export function naiveRecentWindow(logs, limit = CYCLE_DISPLAY_LOG_LIMIT) {
  return [...(logs || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export function engineLogWhere(userId, today) {
  return {
    userId,
    date: { gte: engineHistoryCutoff(today) },
  };
}
