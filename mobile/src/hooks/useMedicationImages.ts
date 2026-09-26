import { useEffect, useState } from 'react';
import { api, type Medication } from '@/lib/api';
import { parseMedicationConfig } from '@/lib/medications.shared';
import { getPreference, setPreference } from '@/lib/storage';

const CACHE_KEY = 'medicard.meds.imageCache.v1';

/** Resolved image per medication id; `null` means "looked, nothing found". */
const memory = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
let hydrated: Promise<void> | null = null;

function hydrate(): Promise<void> {
  if (!hydrated) {
    hydrated = getPreference(CACHE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, string | null>;
        for (const [id, url] of Object.entries(parsed)) if (!memory.has(id)) memory.set(id, url);
      })
      .catch(() => undefined);
  }
  return hydrated;
}

function persist() {
  const snapshot: Record<string, string | null> = {};
  for (const [id, url] of memory) snapshot[id] = url;
  void setPreference(CACHE_KEY, JSON.stringify(snapshot)).catch(() => undefined);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Only accept a catalog hit whose name clearly is the same product. */
function nameMatches(medName: string, productName: string) {
  const a = normalize(medName);
  const b = normalize(productName);
  if (!a || !b) return false;
  if (b.includes(a) || a.includes(b)) return true;
  const firstWord = a.split(' ')[0];
  return firstWord.length >= 4 && b.startsWith(firstWord);
}

async function resolve(med: Medication): Promise<string | null> {
  const cfg = parseMedicationConfig(med.config);
  if (cfg.imageUrl) return cfg.imageUrl;
  if (cfg.catalogProductId) {
    try {
      const { product } = await api.pharmacy.product(cfg.catalogProductId);
      if (product.imageUrl) return product.imageUrl;
    } catch {
      /* fall through to a name lookup */
    }
  }
  const query = med.medName.trim();
  if (query.length < 3) return null;
  try {
    const { products } = await api.pharmacy.products({ q: query, limit: 5 });
    const hit = products.find((p) => p.imageUrl && nameMatches(query, p.name));
    return hit?.imageUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Best-effort picture for each medication: the saved catalog image, else the
 * catalog product it was added from, else a confident name match. Read-only,
 * cached across screens and app launches.
 */
export function useMedicationImages(medications: Medication[]): Record<string, string | null> {
  const [images, setImages] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    for (const med of medications) {
      const cfg = parseMedicationConfig(med.config);
      if (cfg.imageUrl) initial[med.id] = cfg.imageUrl;
      else if (memory.has(med.id)) initial[med.id] = memory.get(med.id) ?? null;
    }
    return initial;
  });

  const key = medications.map((med) => med.id).join('|');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrate();
      const next: Record<string, string | null> = {};
      let changed = false;
      await Promise.all(
        medications.map(async (med) => {
          const cfg = parseMedicationConfig(med.config);
          if (cfg.imageUrl) {
            next[med.id] = cfg.imageUrl;
            return;
          }
          if (memory.has(med.id)) {
            next[med.id] = memory.get(med.id) ?? null;
            return;
          }
          let pending = inflight.get(med.id);
          if (!pending) {
            pending = resolve(med).then((url) => {
              memory.set(med.id, url);
              inflight.delete(med.id);
              return url;
            });
            inflight.set(med.id, pending);
          }
          next[med.id] = await pending;
          changed = true;
        }),
      );
      if (changed) persist();
      if (!cancelled) setImages(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return images;
}
