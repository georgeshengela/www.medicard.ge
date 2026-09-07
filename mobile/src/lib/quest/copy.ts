import { questCopy } from '@/i18n/quest/catalog.js';
import {
  displayQuestProgress,
  formatQuestNumber,
  formatQuestPercent,
  homeQuestMood,
  pickStableVariant,
  questKind,
  questLocaleFromTag,
  rankLabel,
} from './logic.js';
import { movementContextState, smartContextSeed, whyTargetKind } from './smartContext.js';
import type { QuestDashboard, QuestItem } from './api';

/** Safe weather inputs for the movement context line (from Weather Wellness). */
export type QuestWeatherContext = {
  category: string;
  severity: 'calm' | 'caution' | 'avoid';
  stale?: boolean;
  bestOutdoorWindow: { start: string; end: string } | null;
} | null;

export function useQuestLocale() {
  return questLocaleFromTag('ka');
}

export function q(locale = 'ka') {
  return questCopy(locale);
}

export function moodLine(mood: string, seed: string, locale = 'ka') {
  const copy = questCopy(locale);
  const variants = (copy.mood as Record<string, string[]>)[mood] || copy.mood.fresh_day;
  return pickStableVariant(variants, seed);
}

export function dashboardMood(dashboard: QuestDashboard | null) {
  return homeQuestMood({
    dailyTotal: dashboard?.summary.dailyTotal,
    dailyCompleted: dashboard?.summary.dailyCompleted,
    dailyClaimable: dashboard?.summary.dailyClaimable,
    nearCompletion: dashboard?.daily.quests.some((quest) => quest.status === 'ACTIVE' && quest.progressPercent >= 80),
  });
}

export function questTitles(quest: QuestItem, locale = 'ka') {
  const copy = questCopy(locale);
  const kind = questKind(quest);
  if (kind === 'hydration') return { kind, title: copy.hydroTitle, body: copy.hydroBody };
  if (kind === 'medi') return { kind, title: copy.mediTitle, body: copy.mediBody };
  if (kind === 'weekly') return { kind, title: copy.weeklySteps, body: copy.stepsBody };
  return { kind, title: copy.stepsTitle, body: copy.stepsBody };
}

export function questHelper(quest: QuestItem, locale = 'ka') {
  const copy = questCopy(locale);
  const kind = questKind(quest);
  if (quest.claimable) return copy.completed;
  if (quest.status === 'CLAIMED') return copy.claimed;
  if (kind === 'movement' && quest.progress <= 0) return copy.stepsZero;
  if (kind === 'movement' && quest.progressPercent >= 80) return copy.stepsNear;
  return questTitles(quest, locale).body;
}

/**
 * Phase 5 — ONE contextual Medi line for an ACTIVE movement quest.
 * Deterministic priority + per-day stable copy rotation live in smartContext.js.
 * Weather/time only change the copy — never the target or reward.
 */
export function movementContextLine(
  quest: QuestItem,
  extras: { now?: Date; weather?: QuestWeatherContext; loggedPain?: boolean } = {},
  locale = 'ka',
): string | null {
  const state = movementContextState({
    kind: questKind(quest),
    status: quest.status,
    reasonKey: quest.reasonKey ?? null,
    targetSource: quest.targetSource ?? null,
    progressPercent: quest.progressPercent ?? 0,
    hour: (extras.now ?? new Date()).getHours(),
    weather: extras.weather ?? null,
    loggedPain: Boolean(extras.loggedPain),
  });
  if (!state) return null;
  const copy = questCopy(locale);
  const seed = smartContextSeed(quest.id, quest.periodKey, state.key);
  if (state.key === 'GOOD_WEATHER_WINDOW' && state.window) {
    return pickStableVariant(copy.smartWindow(state.window.start, state.window.end), seed);
  }
  const variants = (copy.smart as Record<string, string[]>)[state.key];
  return variants ? pickStableVariant(variants, seed) : null;
}

/** Why-this-target sheet copy from the safe targetSource. */
export function whyTargetCopy(quest: QuestItem, locale = 'ka') {
  const copy = questCopy(locale);
  const kind = whyTargetKind(quest.targetSource ?? null) as 'personalized' | 'comeback' | 'default';
  return { title: copy.whyTarget.title, button: copy.whyTarget.button, body: copy.whyTarget[kind] };
}

export function progressLabel(quest: QuestItem, locale = 'ka') {
  const kind = questKind(quest);
  if (kind === 'hydration') return `${formatQuestPercent(quest.progressPercent ?? quest.progress)}%`;
  if (kind === 'medi') return quest.progress >= 1 ? '1 / 1' : '0 / 1';
  const shown = displayQuestProgress(quest);
  return `${formatQuestNumber(shown.progress, locale)} / ${formatQuestNumber(shown.target, locale)}`;
}

export function levelRank(dashboard: QuestDashboard, locale = 'ka') {
  return rankLabel(dashboard.profile?.rankKey, locale);
}
