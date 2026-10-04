/**
 * MEDIRUN leaderboard reads, shared by the hub's „კვირის რბოლა“ card and the full panel (one cache entry per
 * period + board). The server (`economy.js`) counts a Tbilisi calendar week — Monday 00:00 to Sunday 24:00 —
 * or the season (the campaign dates); `leaderboardWindow` spells the same window out for the person, so a box
 * opened before Monday never looks like it went missing (owner 2026-10-05).
 */
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { FRESH } from '@/lib/queryClient';
import { formatYmd } from '@/lib/format';
import { tx } from '@/i18n/locale';
import { pulseApi } from './client';
import type { Leaderboard } from './types';

export type LeaderboardPeriod = 'week' | 'season';
export type LeaderboardBoard = 'boxes' | 'meters';

export const LEADERBOARD_KEY = ['medirun', 'leaderboard'] as const;

export function useLeaderboard(period: LeaderboardPeriod, board: LeaderboardBoard, enabled = true) {
  return useAccountQuery<Leaderboard>({
    key: [...LEADERBOARD_KEY, period, board],
    fetch: () => pulseApi<Leaderboard>(`/leaderboard?period=${period}&board=${board}`),
    staleTime: FRESH.SHORT,
    enabled,
  });
}

const DAY = 86400_000;
const TBILISI = 4 * 3600_000;
const ymdAt = (ms: number) => new Date(ms + TBILISI).toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The Tbilisi Monday that starts the week `now` falls in (same rule as the server's `weekStart`). */
export function tbilisiMonday(now = Date.now()): string {
  const today = ymdAt(now);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, -((dow + 6) % 7));
}

/** „5 ოქტ“ — day and a short month. */
export function shortDay(ymd: string): string {
  const [d, ...month] = formatYmd(ymd).split(' ');
  return `${d} ${month.join(' ').slice(0, 3)}`;
}

/** First and last counted day (Tbilisi) of a period: the calendar week, or the campaign for the season. */
export function leaderboardWindow(period: LeaderboardPeriod, campaign: { start: string; end: string } | null | undefined, now = Date.now()) {
  if (period === 'week') {
    const from = tbilisiMonday(now);
    return { from, to: addDays(from, 6) };
  }
  if (campaign) return { from: campaign.start, to: campaign.end };
  return { from: addDays(ymdAt(now), -89), to: ymdAt(now) };
}

/** One line under the switches: what is counted and since when. */
export function leaderboardWindowText(period: LeaderboardPeriod, campaign: { start: string; end: string } | null | undefined, now = Date.now()) {
  const w = leaderboardWindow(period, campaign, now);
  const range = `${shortDay(w.from)} – ${shortDay(w.to)}`;
  return period === 'week'
    ? tx(`${range} · ორშაბათს 00:00-ზე თავიდან იწყება`, `${range} · restarts Monday 00:00`)
    : campaign
      ? tx(`${range} · მთელი კამპანია`, `${range} · the whole campaign`)
      : tx(`${range} · ბოლო 90 დღე`, `${range} · the last 90 days`);
}
