// MEDIHOROSCOPE generator: turns the real sky of a day / week / month / year into a sun-sign
// reading per sign (Georgian + English) through the content model. No account data goes in.
import {
  SIGNS, PLANETS, ASPECTS, angleDiff, longitude, positions, moonPhase, lunarDay, signOf,
  skyEvents, zonedToUtc, civilDate,
} from './astro.js';
import { SIGN_INFO, PLANET_NAMES, HOUSE_THEMES, MOON_PHASE_NAMES, LUCKY_COLORS } from './signs.js';
import { askJson } from './llm.js';

export const TZ = 'Asia/Tbilisi';
export const KINDS = ['day', 'week', 'month', 'year'];
const DAY_MS = 86400000;

// ── Periods ─────────────────────────────────────────────────────────────

const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Monday (YYYY-MM-DD) of the week holding a civil date. */
export function weekKey(ymd) {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(ymd, dow === 0 ? -6 : 1 - dow);
}

/** Period keys that should exist at a moment (Tbilisi calendar). */
export function currentPeriodKeys(now = new Date()) {
  const today = civilDate(now, TZ);
  return {
    day: today,
    tomorrow: addDays(today, 1),
    week: weekKey(today),
    month: today.slice(0, 7),
    year: today.slice(0, 4),
  };
}

export function periodWindow(kind, key) {
  if (kind === 'day') return { from: zonedToUtc(key, '00:00', TZ), to: zonedToUtc(addDays(key, 1), '00:00', TZ) };
  if (kind === 'week') return { from: zonedToUtc(key, '00:00', TZ), to: zonedToUtc(addDays(key, 7), '00:00', TZ) };
  if (kind === 'month') {
    const [y, m] = key.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return { from: zonedToUtc(`${key}-01`, '00:00', TZ), to: zonedToUtc(next, '00:00', TZ) };
  }
  if (kind === 'year') return { from: zonedToUtc(`${key}-01-01`, '00:00', TZ), to: zonedToUtc(`${Number(key) + 1}-01-01`, '00:00', TZ) };
  throw new Error(`Unknown period kind ${kind}`);
}

export function isValidPeriodKey(kind, key) {
  if (kind === 'day' || kind === 'week') return /^\d{4}-\d{2}-\d{2}$/.test(key) && (kind === 'day' || weekKey(key) === key);
  if (kind === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
  if (kind === 'year') return /^\d{4}$/.test(key);
  return false;
}

// ── Exact aspects inside a window ───────────────────────────────────────

const ASPECT_TARGETS = ASPECTS.flatMap((a) => (a.angle === 0 || a.angle === 180 ? [[a.key, a.angle]] : [[a.key, a.angle], [a.key, -a.angle]]));

/** Moments when two bodies form an exact aspect between `from` and `to`. */
export function exactAspects(from, to, { bodies = PLANETS, stepMs = DAY_MS / 4, moon = false } = {}) {
  const keys = bodies.filter((k) => moon || k !== 'moon');
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      if (!moon && (a === 'moon' || b === 'moon')) continue;
      const step = a === 'moon' || b === 'moon' ? DAY_MS / 24 : stepMs;
      const sep = (t) => angleDiff(longitude(a, new Date(t)), longitude(b, new Date(t)));
      let t0 = from.getTime();
      let s0 = sep(t0);
      for (let t = t0 + step; t <= to.getTime(); t += step) {
        const s1 = sep(t);
        for (const [key, target] of ASPECT_TARGETS) {
          const d0 = target === 180 ? Math.abs(s0) - 180 : s0 - target;
          const d1 = target === 180 ? Math.abs(s1) - 180 : s1 - target;
          if (Math.sign(d0) !== Math.sign(d1) && Math.abs(s1 - s0) < 90) {
            let lo = t - step;
            let hi = t;
            for (let k = 0; k < 30; k++) {
              const mid = (lo + hi) / 2;
              const sm = sep(mid);
              const dm = target === 180 ? Math.abs(sm) - 180 : sm - target;
              if (Math.sign(dm) === Math.sign(d0)) lo = mid; else hi = mid;
            }
            if (target === 180 && Math.abs(Math.abs(sep(hi)) - 180) > 1) continue;
            out.push({ a, b, aspect: key, at: new Date((lo + hi) / 2).toISOString() });
          }
        }
        t0 = t;
        s0 = s1;
      }
    }
  }
  return out.sort((x, y) => x.at.localeCompare(y.at));
}

