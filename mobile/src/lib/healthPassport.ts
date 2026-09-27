import { PASSPORT_COPY, type PassportLocale } from '../i18n/healthPassport.ts';

/**
 * Health passport (Phase 3.3, 2026-09-27): one printable page a person can hand to a doctor.
 * Built entirely on the device from data they already saved — nothing is sent to AI.
 * Pure: takes plain data, returns an HTML document for expo-print.
 */
export type PassportData = {
  person: { name?: string | null; sex?: string | null; birthDate?: string | null; heightCm?: number | null; weightKg?: number | null; bloodType?: string | null };
  allergies: string[];
  conditions: string[];
  medications: Array<{ name: string; dose?: string | null; schedule?: string | null }>;
  labs: { date: string; rows: Array<{ name: string; value: string; unit?: string | null; refLow?: number | null; refHigh?: number | null; flag?: string | null }> } | null;
  visits: Array<{ date: string; doctor: string; notes?: string | null }>;
  /** Optional, only when the person chose to include it: inner HTML of the cycle report. */
  cycleHtml?: string | null;
  generatedOn: string; // YYYY-MM-DD
};

export const PASSPORT_LIMITS = { labs: 40, visits: 5, medications: 30 } as const;

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function ageOn(birthDate: string | null | undefined, onYmd: string): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return null;
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number);
  const [y, m, d] = onYmd.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function range(low?: number | null, high?: number | null) {
  if (low != null && high != null) return `${low}–${high}`;
  if (high != null) return `≤ ${high}`;
  if (low != null) return `≥ ${low}`;
  return '—';
}

/** Cycle report HTML is a full document; keep only what is inside <body>. */
export function bodyOf(html: string): string {
  const match = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return match ? match[1] : html;
}

export function buildHealthPassportHtml(data: PassportData, locale: PassportLocale = 'ka'): string {
  const t = PASSPORT_COPY[locale];
  const p = data.person;
  const age = ageOn(p.birthDate, data.generatedOn);
  const facts: Array<[string, string]> = [
    [t.name, p.name || '—'],
    [t.sex, p.sex ? t.sexLabel[p.sex] ?? p.sex : '—'],
    [t.age, age != null ? t.years(age) : '—'],
    [t.birthDate, p.birthDate ? p.birthDate.slice(0, 10) : '—'],
    [t.height, p.heightCm ? `${Math.round(p.heightCm)} cm` : '—'],
    [t.weight, p.weightKg ? `${Math.round(p.weightKg * 10) / 10} kg` : '—'],
    [t.bloodType, p.bloodType || '—'],
  ];
  const list = (items: string[], empty: string) =>
    items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p class="muted">${esc(empty)}</p>`;
  const meds = data.medications.slice(0, PASSPORT_LIMITS.medications);
  const labRows = data.labs?.rows.slice(0, PASSPORT_LIMITS.labs) ?? [];
  const visits = data.visits.slice(0, PASSPORT_LIMITS.visits);
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"/><title>${esc(t.title)}</title>
<style>
  body{font-family:-apple-system,"Noto Sans Georgian","Segoe UI",Roboto,sans-serif;color:#111827;margin:28px;font-size:12.5px;line-height:1.5}
  h1{font-size:22px;margin:0 0 2px;color:#0F766E} h2{font-size:14px;margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid #D1D5DB;color:#0F766E}
  .muted{color:#6B7280} table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #E5E7EB;vertical-align:top}
  th{font-size:11px;color:#374151;background:#F3F4F6} .facts td:first-child{width:38%;color:#4B5563} .flag-H,.flag-L{color:#B91C1C;font-weight:600}
  ul{margin:0;padding-left:18px} .footer{margin-top:26px;font-size:10.5px;color:#6B7280;border-top:1px solid #E5E7EB;padding-top:8px}
  .pagebreak{page-break-before:always}
</style></head><body>
<h1>${esc(t.title)}</h1><p class="muted">${esc(t.generated(data.generatedOn))}</p>
<h2>${esc(t.person)}</h2><table class="facts">${facts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
<h2>${esc(t.allergies)}</h2>${list(data.allergies, t.noAllergies)}
<h2>${esc(t.conditions)}</h2>${list(data.conditions, t.noConditions)}
<h2>${esc(t.medications)}</h2>${meds.length
    ? `<table><tr><th>${esc(t.medName)}</th><th>${esc(t.dose)}</th><th>${esc(t.schedule)}</th></tr>${meds.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.dose || '—')}</td><td>${esc(m.schedule || '—')}</td></tr>`).join('')}</table>`
    : `<p class="muted">${esc(t.noMedications)}</p>`}
<h2>${esc(t.labs)}</h2>${labRows.length
    ? `<p class="muted">${esc(t.labDate(data.labs!.date))}</p><table><tr><th>${esc(t.parameter)}</th><th>${esc(t.result)}</th><th>${esc(t.reference)}</th><th></th></tr>${labRows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.value)}${r.unit ? ' ' + esc(r.unit) : ''}</td><td>${esc(range(r.refLow, r.refHigh))}</td><td class="flag-${esc(r.flag || 'U')}">${esc(t.flag[r.flag || 'U'] ?? '')}</td></tr>`).join('')}</table>`
    : `<p class="muted">${esc(t.noLabs)}</p>`}
<h2>${esc(t.visits)}</h2>${visits.length
    ? `<table><tr><th>${esc(t.visitDate)}</th><th>${esc(t.doctor)}</th><th>${esc(t.notes)}</th></tr>${visits.map((v) => `<tr><td>${esc(v.date)}</td><td>${esc(v.doctor)}</td><td>${esc(v.notes || '—')}</td></tr>`).join('')}</table>`
    : `<p class="muted">${esc(t.noVisits)}</p>`}
${data.cycleHtml ? `<div class="pagebreak"></div><h2>${esc(t.cycle)}</h2>${bodyOf(data.cycleHtml)}` : ''}
<p class="footer">${esc(t.footer)}</p>
</body></html>`;
}
