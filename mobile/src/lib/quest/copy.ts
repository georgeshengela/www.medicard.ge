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
import type { QuestDashboard, QuestItem } from './api';

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

export function progressLabel(quest: QuestItem, locale = 'ka') {
  const kind = questKind(quest);
  if (kind === 'hydration') return `${formatQuestPercent(quest.progressPercent ?? quest.progress)}%`;
  if (kind === 'medi') return quest.progress >= 1 ? '1 / 1' : '0 / 1';
  const shown = displayQuestProgress(quest);
  return `${formatQuestNumber(shown.progress, locale)} / ${formatQuestNumber(shown.target, locale)}`;
}

export function levelRank(dashboard: QuestDashboard, locale = 'ka') {
  return rankLabel(dashboard.profile.rankKey, locale);
}
