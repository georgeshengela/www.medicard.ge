import type { PharmacySourcePrice } from '@/lib/api';
import { PHARMACY_SOURCES } from '@/constants/pharmacyVisuals';

export function sourceColor(sourceId: string) {
  return PHARMACY_SOURCES.find((s) => s.id === sourceId)?.color ?? '#26A69A';
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
  return slot.isBest || (bestPrice != null && slot.priceGel === bestPrice);
}

export function compareStats(slots: PharmacySourcePrice[], bestPrice: number | null) {
  const available = slots.filter((s) => s.priceGel != null);
  const maxPrice = available.length ? Math.max(...available.map((s) => s.priceGel!)) : null;
  const savingsGel = maxPrice != null && bestPrice != null && maxPrice > bestPrice ? maxPrice - bestPrice : null;
  return { available, maxPrice, savingsGel };
}
