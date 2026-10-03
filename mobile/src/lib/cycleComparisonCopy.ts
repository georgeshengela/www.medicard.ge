/**
 * „ბოლო ციკლები“ — cycle-to-cycle comparison (W3-4, brief §9 „მერე“ item 7; Clue's „enhanced Cycle View“).
 *
 * The server sends `bundle.cycleComparison` (the last ≤ 6 completed, not hidden cycles — the same cycles
 * as the stats card and Home's „ჩემი ციკლი“ bars — with their logged period days, and the latest cycle
 * vs the median of the ones before it). This file turns it into rows and one factual sentence: her own
 * usual only, never population norms, never a verdict. Plain module so node tests load it.
 */
import { tx } from '../i18n/locale.js';

export type CycleComparisonInput = {
  cycles: Array<{ start: string; end?: string; length: number; periodDays: number; latest?: boolean }>;
  latestDays: number;
  usualDays: number | null;
  diffDays: number | null;
} | null | undefined;

export type CycleComparisonRow = {
  start: string;
  length: number;
  periodDays: number;
  /** Bar length against the longest cycle shown (0…1]. */
  widthRatio: number;
  /** Share of the bar that is logged period days (0…1). */
  periodRatio: number;
  latest: boolean;
};

const MONTHS_SHORT_KA = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const MONTHS_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** „8 სექ“ / "8 Sep" — the day a cycle started. */
export function comparisonStartLabel(ymd: string): string {
  const [, m, d] = String(ymd).split('-').map(Number);
  if (!m || !d) return '';
  return tx(`${d} ${MONTHS_SHORT_KA[m - 1]}`, `${d} ${MONTHS_SHORT_EN[m - 1]}`);
}

/** Newest first; widths on one scale (the longest cycle fills the track). Empty below 2 cycles. */
export function comparisonRows(cmp: CycleComparisonInput, limit = 6): CycleComparisonRow[] {
  const cycles = (cmp?.cycles ?? []).filter((c) => Number.isFinite(c.length) && c.length > 0).slice(-limit);
  if (cycles.length < 2) return [];
  const max = Math.max(...cycles.map((c) => c.length));
  return cycles
    .map((c, i) => ({
      start: c.start,
      length: c.length,
      periodDays: Math.max(0, Math.min(c.length, Math.round(c.periodDays || 0))),
      widthRatio: c.length / max,
      periodRatio: Math.max(0, Math.min(1, (c.periodDays || 0) / c.length)),
      latest: i === cycles.length - 1,
    }))
    .reverse();
}

function days(n: number): string {
  return tx(`${n} დღით`, n === 1 ? '1 day' : `${n} days`);
}

/**
 * „ბოლო ციკლი 31 დღე იყო — შენს ჩვეულზე (28) 3 დღით გრძელი“. Before there are two earlier cycles to
 * compare with, only the length and when the comparison will appear. Null without data.
 */
export function comparisonLine(cmp: CycleComparisonInput): string | null {
  if (!cmp || !Number.isFinite(cmp.latestDays) || (cmp.cycles?.length ?? 0) < 2) return null;
  const latest = cmp.latestDays;
  const usual = cmp.usualDays;
  if (usual == null) {
    return tx(
      `ბოლო ციკლი ${latest} დღე იყო. შენს ჩვეულს 3 ციკლიდან შევადარებთ.`,
      `Your last cycle was ${latest} days. We compare it with your usual from 3 cycles on.`,
    );
  }
  const diff = latest - usual;
  if (diff === 0) {
    return tx(
      `ბოლო ციკლი ${latest} დღე იყო — შენი ჩვეულის (${usual}) ტოლი`,
      `Your last cycle was ${latest} days — the same as your usual (${usual})`,
    );
  }
  const n = Math.abs(diff);
  return diff > 0
    ? tx(
        `ბოლო ციკლი ${latest} დღე იყო — შენს ჩვეულზე (${usual}) ${days(n)} გრძელი`,
        `Your last cycle was ${latest} days — ${days(n)} longer than your usual (${usual})`,
      )
    : tx(
        `ბოლო ციკლი ${latest} დღე იყო — შენს ჩვეულზე (${usual}) ${days(n)} მოკლე`,
        `Your last cycle was ${latest} days — ${days(n)} shorter than your usual (${usual})`,
      );
}

/** What „ჩვეული“ means, in one quiet line under the sentence. */
export function comparisonUsualHint(): string {
  return tx('ჩვეული — შენი წინა ციკლების შუა მნიშვნელობა (მედიანა)', 'Usual = the middle value of your earlier cycles (median)');
}

/** Screen-reader summary of the bars (newest first). */
export function comparisonA11y(rows: CycleComparisonRow[]): string {
  return rows
    .map((r) =>
      tx(
        `${comparisonStartLabel(r.start)}: ${r.length} დღე, მენსტრუაცია ${r.periodDays} დღე`,
        `${comparisonStartLabel(r.start)}: ${r.length} days, period ${r.periodDays} days`,
      ),
    )
    .join('; ');
}
