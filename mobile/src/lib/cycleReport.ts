import type { CycleBundle } from '@/lib/api';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';

export function buildCycleReportHtml(bundle: CycleBundle): string {
  const s = bundle.summary;
  const trends = bundle.trends;
  const rows = (s?.topSymptoms ?? [])
    .map((t) => `<li>${t.key} (${t.count})</li>`)
    .join('');
  const moods = (s?.topMoods ?? [])
    .map((t) => `<li>${t.key} (${t.count})</li>`)
    .join('');
  const cycles = (trends?.cycleLengths ?? [])
    .map((c) => `<li>${formatCycleDateKa(c.start)} — ${c.length} დღე</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="ka">
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, sans-serif; padding: 32px; color: #1d1c1c; }
  h1 { font-size: 22px; color: #00668c; }
  h2 { font-size: 16px; margin-top: 24px; }
  p, li { font-size: 13px; line-height: 1.5; }
  .disclaimer { margin-top: 32px; font-size: 11px; color: #666; }
</style>
</head>
<body>
  <h1>Medicard.GE — ციკლის ანგარიში</h1>
  <p>გენერირებულია: ${new Date(s?.generatedAt ?? Date.now()).toLocaleString('ka-GE')}</p>
  <h2>ციკლი</h2>
  <ul>
    <li>რეჟიმი: ${s?.mode ?? '—'}</li>
    <li>საშუალო ციკლი: ${s?.avgCycleLength ?? '—'} დღე</li>
    <li>მენსტრუაცია: ${s?.avgPeriodLength ?? '—'} დღე</li>
    <li>შემდეგი მენსტრუაცია: ${s?.nextPeriodStart ? formatCycleDateKa(s.nextPeriodStart) : '—'}</li>
    <li>ოვულაცია: ${s?.ovulationDate ? formatCycleDateKa(s.ovulationDate) : '—'}</li>
  </ul>
  ${cycles ? `<h2>ციკლის სიგრძეები</h2><ul>${cycles}</ul>` : ''}
  ${rows ? `<h2>ტოპ სიმპტომები</h2><ul>${rows}</ul>` : ''}
  ${moods ? `<h2>ტოპ განწყობა</h2><ul>${moods}</ul>` : ''}
  <p class="disclaimer">ეს ანგარიში არ არის საბოლოო დიაგნოზი — მიმართეთ ექიმს საჭიროებისას.</p>
</body>
</html>`;
}
