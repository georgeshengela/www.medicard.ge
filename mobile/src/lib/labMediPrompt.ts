import type { LabFlag, LabPanel, LabParameter } from '../types/lab.ts';

const FLAG_KA: Record<LabFlag, string> = { H: 'მაღალი', L: 'დაბალი', U: 'შეუფასებელი', N: 'ნორმაში' };
const MAX_ROWS = 25;

function range(p: LabParameter): string {
  if (p.refLow != null && p.refHigh != null) return ` (ნორმა ${p.refLow}–${p.refHigh})`;
  if (p.refHigh != null) return ` (ნორმა ≤${p.refHigh})`;
  if (p.refLow != null) return ` (ნორმა ≥${p.refLow})`;
  return '';
}

/**
 * Draft question for Medi built from the newest saved lab day. It only prefills the composer:
 * nothing leaves the device until the person reviews it and presses send (AI consent still applies).
 * Out-of-range values come first; the list is capped so the draft stays readable.
 */
export function labMediPrompt(panels: LabPanel[]): string | null {
  if (!panels.length) return null;
  const latest = panels.reduce((a, b) => (b.date > a.date ? b : a)).date;
  const rows = panels.filter((p) => p.date === latest).flatMap((p) => p.parameters);
  if (!rows.length) return null;
  const rank = (f: LabFlag) => (f === 'H' || f === 'L' ? 0 : f === 'U' ? 1 : 2);
  const sorted = [...rows].sort((a, b) => rank(a.flag) - rank(b.flag));
  const shown = sorted.slice(0, MAX_ROWS);
  const lines = shown.map((p) => `• ${p.nameKa || p.nameEn}: ${p.display}${p.unit ? ' ' + p.unit : ''}${range(p)} — ${FLAG_KA[p.flag]}`);
  const more = rows.length > shown.length ? `\n…და კიდევ ${rows.length - shown.length} მაჩვენებელი.` : '';
  return `გამიანალიზე ჩემი ლაბორატორიული შედეგები (${latest}).\n${lines.join('\n')}${more}\nრას ნიშნავს ეს ჩემთვის და რა უნდა ვკითხო ექიმს?`;
}
