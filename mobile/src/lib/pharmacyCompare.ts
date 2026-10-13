import type { PharmacySourcePrice } from '@/lib/api';
import { PHARMACY_SOURCES } from '@/constants/pharmacyVisuals';

export function sourceColor(sourceId: string) {
  return PHARMACY_SOURCES.find((s) => s.id === sourceId)?.color ?? '#14B8A6';
}

export function sourceLabel(sourceId: string) {
  return PHARMACY_SOURCES.find((s) => s.id === sourceId)?.label ?? sourceId;
}

const EMPTY_SLOT = (sourceId: string, label: string): PharmacySourcePrice => ({
  sourceId,
  nameKa: label,
  logoUrl: null,
  priceGel: null,
  oldPriceGel: null,
  inStock: false,
  isBest: false,
  sourceUrl: null,
  priceDiffGel: null,
});

export function buildCompareSlots(prices: PharmacySourcePrice[]): PharmacySourcePrice[] {
  if (prices.length >= 3) return prices;
  return PHARMACY_SOURCES.map(
    (src) => prices.find((p) => p.sourceId === src.id) ?? EMPTY_SLOT(src.id, src.label),
  );
}

export function isBestSlot(slot: PharmacySourcePrice, bestPrice: number | null) {
  if (slot.stale || !slot.inStock) return false;
  return slot.isBest || (bestPrice != null && slot.priceGel === bestPrice);
}

/** One line of the comparison: a pharmacy, or Pharmadepot and GPC together when their prices agree. */
export type CompareRow = PharmacySourcePrice & { sourceIds: string[]; logos: { sourceId: string; logoUrl: string | null }[] };

/**
 * Pharmadepot and GPC are one company (GEPHA) with one price list: when both sell the box at the same
 * price they are one line („ფარმადეპო · ჯიპისი“), so two identical prices never look like two offers.
 * Rows with a price come first, cheapest first.
 */
export function compareRows(slots: PharmacySourcePrice[]): CompareRow[] {
  const rows: CompareRow[] = slots.map((s) => ({ ...s, sourceIds: [s.sourceId], logos: [{ sourceId: s.sourceId, logoUrl: s.logoUrl }] }));
  const pd = rows.find((r) => r.sourceId === 'PHARMADEPOT');
  const gpc = rows.find((r) => r.sourceId === 'GPC');
  if (pd && gpc && pd.priceGel === gpc.priceGel && pd.inStock === gpc.inStock && Boolean(pd.stale) === Boolean(gpc.stale)) {
    const merged: CompareRow = {
      ...pd,
      nameKa: `${pd.nameKa} · ${gpc.nameKa}`,
      isBest: pd.isBest || gpc.isBest,
      sourceIds: ['PHARMADEPOT', 'GPC'],
      logos: [...pd.logos, ...gpc.logos],
    };
    rows.splice(rows.indexOf(pd), 1, merged);
    rows.splice(rows.indexOf(gpc), 1);
  }
  return rows.sort((a, b) => (a.priceGel ?? Infinity) - (b.priceGel ?? Infinity));
}

/** The pharmacies disagree on where the box is made (one sells the German Concor, another the Turkish). */
export function countriesDiffer(slots: PharmacySourcePrice[]) {
  return new Set(slots.filter((s) => s.priceGel != null && s.country).map((s) => s.country)).size > 1;
}

export function compareStats(slots: PharmacySourcePrice[], bestPrice: number | null) {
  const available = slots.filter((s) => s.priceGel != null);
  // Savings only between offers that are confirmed and orderable right now.
  const comparable = available.filter((s) => s.inStock && !s.stale);
  const maxPrice = comparable.length ? Math.max(...comparable.map((s) => s.priceGel!)) : null;
  const savingsGel = maxPrice != null && bestPrice != null && maxPrice > bestPrice ? maxPrice - bestPrice : null;
  return { available, maxPrice, savingsGel };
}
