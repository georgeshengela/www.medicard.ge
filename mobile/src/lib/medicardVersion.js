/** Public Medicard version: Instagram-style `G.0.0.B.R` (currently 1.0.0.7.80). */

const FIVE = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
const THREE = /^(\d+)\.(\d+)\.(\d+)$/;

const DEFAULT_FIVE = '1.0.0.7.80';

/**
 * @param {unknown} raw
 * @returns {{
 *   raw: string,
 *   generation: number,
 *   reservedMinor: number,
 *   reservedPatch: number,
 *   train: number,
 *   revision: number,
 *   kind: 'five' | 'three',
 * } | null}
 */
export function parseMedicardVersion(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  const five = text.match(FIVE);
  if (five) {
    return {
      raw: `${five[1]}.${five[2]}.${five[3]}.${five[4]}.${five[5]}`,
      generation: Number(five[1]),
      reservedMinor: Number(five[2]),
      reservedPatch: Number(five[3]),
      train: Number(five[4]),
      revision: Number(five[5]),
      kind: 'five',
    };
  }
  const three = text.match(THREE);
  if (!three) return null;
  return {
    raw: `${three[1]}.${three[2]}.${three[3]}`,
    generation: Number(three[1]),
    reservedMinor: Number(three[2]),
    reservedPatch: Number(three[3]),
    train: 0,
    revision: Number(three[3]),
    kind: 'three',
  };
}

/** In-app / Android / API identity. Five-part stays five-part; unknown falls back. */
export function formatMedicardVersion(raw, fallback = DEFAULT_FIVE) {
  const parsed = parseMedicardVersion(raw);
  if (!parsed) return fallback;
  return parsed.raw;
}

/**
 * Apple `CFBundleShortVersionString` — three numbers only.
 * Compress `G.0.0.B.R` → `G.B.R` (1.0.0.7.66 → 1.7.66).
 */
export function iosMarketingVersion(raw, fallback = '1.7.78') {
  const parsed = parseMedicardVersion(raw);
  if (!parsed) return fallback;
  return `${parsed.generation}.${parsed.train}.${parsed.revision}`;
}

export function versionLegend(raw) {
  const parsed = parseMedicardVersion(raw);
  if (!parsed) return null;
  return {
    generation: parsed.generation,
    train: parsed.train,
    revision: parsed.revision,
  };
}

export { DEFAULT_FIVE as DEFAULT_MEDICARD_VERSION };
