// MEDICARD web — MEDI module wordmarks (mobile src/theme/moduleBrand.ts + components/brand/ModuleWordmark.tsx).
// Upright „MEDI“ in ink + the module part in its signature colour, skewed −16°, Exo 2 ExtraBold. Used compactly
// in page headers only — never as a big banner and never for body copy.
import { h } from './ui.js';

export const MODULE_BRANDS = {
  run: { suffix: 'RUN', name: 'MEDIRUN' },
  cycle: { suffix: 'CYCLE', name: 'MEDICYCLE' },
  food: { suffix: 'FOOD', name: 'MEDIFOOD' },
  pill: { suffix: 'PILL', name: 'MEDIPILL' },
  quest: { suffix: 'QUEST', name: 'MEDIQUEST' },
  vet: { suffix: 'VET', name: 'MEDIVET' },
  coach: { suffix: 'COACH', name: 'MEDICOACH' },
  scan: { suffix: 'SCAN', name: 'MEDISCAN' },
  lab: { suffix: 'LAB', name: 'MEDILAB' },
};

/** A page title: the wordmark, read by screen readers as the module name. */
export function wordmark(id, { size } = {}) {
  const b = MODULE_BRANDS[id];
  if (!b) return null;
  return h('span', { class: `wm wm-${id}`, role: 'img', 'aria-label': b.name, style: size ? { fontSize: `${size}px` } : null },
    h('span', { class: 'wm-medi', 'aria-hidden': 'true' }, 'MEDI'),
    h('span', { class: 'wm-suffix', 'aria-hidden': 'true' }, b.suffix));
}
