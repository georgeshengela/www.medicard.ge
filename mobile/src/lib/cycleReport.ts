import type { CycleBundle } from '@/lib/api';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { ka } from '@/i18n/ka';

export function buildCycleReportHtml(bundle: CycleBundle): string {
  const s = bundle.summary;
  const trends = bundle.trends;
  const rows = (s?.topSymptoms ?? [])
    .map((t) => `<li>${cycleChipLabel(t.key)} (${t.count})</li>`)
    .join('');
  const moods = (s?.topMoods ?? [])
    .map((t) => `<li>${cycleChipLabel(t.key)} (${t.count})</li>`)
    .join('');
  const cycles = (trends?.cycleLengths ?? [])
    .map((c) => `<li>${formatCycleDateKa(c.start)} — ${c.length} დღე</li>`)
    .join('');
  const starts = (bundle.inferred.periodStarts ?? trends?.periodStarts ?? [])
    .map((d) => `<li>${formatCycleDateKa(d)}</li>`)
    .join('');

  const confidence =
    (bundle.predictions.confidence ?? s?.confidence) === 'high'
      ? ka.cycle.confidenceHigh
      : (bundle.predictions.confidence ?? s?.confidence) === 'medium'
        ? ka.cycle.confidenceMedium
        : ka.cycle.confidenceLow;
  const usedCycle = bundle.averages?.usedCycleLength ?? s?.avgCycleLength;
  const usedPeriod = bundle.averages?.usedPeriodLength ?? s?.avgPeriodLength;
  const forecastSource = bundle.averages?.source ?? 'default';

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
  <h2>${ka.cycle.reportEstimatedTitle}</h2>
  <ul>
    <li>რეჟიმი: ${s?.mode ?? '—'}</li>
    <li>საშუალო ციკლი (შეფასება): ${usedCycle ?? '—'} დღე · წყარო: ${forecastSource}</li>
    <li>მენსტრუაცია (შეფასება): ${usedPeriod ?? '—'} დღე</li>
    <li>${ka.cycle.shortestCycle}: ${s?.shortestCycle ?? '—'} დღე</li>
    <li>${ka.cycle.longestCycle}: ${s?.longestCycle ?? '—'} დღე</li>
    <li>${ka.cycle.cycleVariability}: ${s?.variability ?? '—'} დღე</li>
    <li>${ka.cycle.estimatedNextPeriod}: ${s?.nextPeriodStart ? formatCycleDateKa(s.nextPeriodStart) : '—'}</li>
    ${
      bundle.contraception?.presentation.showOvulationDate === false
        ? ''
        : `<li>${ka.cycle.estimatedOvulationTitle}: ${s?.ovulationDate ? formatCycleDateKa(s.ovulationDate) : '—'}</li>`
    }
    ${
      bundle.contraception?.method
        ? `<li>${ka.cycle.reportContraception}: ${ka.cycle.contraceptionMethod[bundle.contraception.method]}${bundle.contraception.startedAt ? ` · ${formatCycleDateKa(bundle.contraception.startedAt)}` : ''}</li>`
        : ''
    }
    <li>${s?.cycleCount ? ka.cycle.basedOnCycles(s.cycleCount) : ka.cycle.confidenceLow} — ${confidence}</li>
  </ul>
  ${(() => {
    const h = bundle.analytics ?? bundle.summary?.historical;
    if (!h) return '';
    const lengths = bundle.analytics?.cycleLengthStats ?? bundle.summary?.historical?.cycleLengthStats;
    const bleed = bundle.analytics?.bleedDurations ?? bundle.summary?.historical?.bleedDurations;
    const pain = (bundle.analytics?.painPatterns ?? bundle.summary?.historical?.painPatterns ?? [])
      .map((p) => `<li>${ka.cycle.painType[p.painType as keyof typeof ka.cycle.painType] ?? p.painType}: ${p.cyclesWithObservation}/${p.eligibleCycles}</li>`)
      .join('');
    const symptoms = (bundle.analytics?.symptomPatterns ?? bundle.summary?.historical?.symptomPatterns ?? [])
      .map((p) => `<li>${cycleChipLabel(p.key)}: ${p.cyclesWithObservation}/${p.eligibleCycles}</li>`)
      .join('');
    const coverageLow = (bundle.analytics?.insightDataQuality ?? bundle.summary?.historical?.insightDataQuality) === 'LOW';
    return `<h2>${ka.cycle.reportHistoricalTitle}</h2>
    <p>${ka.cycle.reportBasedOnRecorded}${coverageLow ? ` ${ka.cycle.reportCoverageLow}` : ''}</p>
    <ul>
      <li>${ka.cycle.basedOnCycles(bundle.analytics?.completedCycleCount ?? bundle.summary?.historical?.completedCycleCount ?? 0)}</li>
      ${lengths?.average != null ? `<li>${ka.cycle.trendsCycleLength}: ${lengths.average} (${lengths.shortest}–${lengths.longest})</li>` : ''}
      ${bleed?.average != null ? `<li>${ka.cycle.loggedBleedDuration}: ${bleed.average} (${bleed.shortest}–${bleed.longest})</li>` : ''}
    </ul>
    ${pain ? `<h2>${ka.cycle.reportPain}</h2><ul>${pain}</ul>` : ''}
    ${symptoms ? `<h2>${ka.cycle.trendsSymptoms}</h2><ul>${symptoms}</ul>` : ''}`;
  })()}
  ${starts ? `<h2>${ka.cycle.reportLoggedTitle} · ${ka.cycle.periodHistory}</h2><ul>${starts}</ul>` : ''}
  ${cycles ? `<h2>ციკლის სიგრძეები</h2><ul>${cycles}</ul>` : ''}
  ${rows ? `<h2>ტოპ სიმპტომები</h2><ul>${rows}</ul>` : ''}
  ${moods ? `<h2>ტოპ განწყობა</h2><ul>${moods}</ul>` : ''}
  ${(() => {
    const tests = (s as { fertilityTests?: { ovulationTests?: { date: string; result: string }[]; pregnancyTests?: { date: string; result: string }[] } } | undefined)?.fertilityTests
      ?? { ovulationTests: bundle.logs.filter((l) => l.ovulationTest).map((l) => ({ date: l.date, result: String(l.ovulationTest) })), pregnancyTests: bundle.logs.filter((l) => l.pregnancyTest).map((l) => ({ date: l.date, result: String(l.pregnancyTest) })) };
    const opk = (tests.ovulationTests ?? [])
      .map((t) => `<li>${formatCycleDateKa(t.date)} — ${ka.cycle.reportOpk}: ${ka.cycle.testResult[t.result as 'negative' | 'positive' | 'unclear'] ?? t.result}</li>`)
      .join('');
    const preg = (tests.pregnancyTests ?? [])
      .map((t) => `<li>${formatCycleDateKa(t.date)} — ${ka.cycle.reportPreg}: ${ka.cycle.testResult[t.result as 'negative' | 'positive' | 'unclear'] ?? t.result}</li>`)
      .join('');
    if (!opk && !preg) return '';
    return `<h2>${ka.cycle.trendsTests}</h2><ul>${opk}${preg}</ul>`;
  })()}
  ${(() => {
    const pain = (s as { painObservations?: { date: string; type: string; severity: string }[] } | undefined)?.painObservations
      ?? [];
    if (!pain.length) return '';
    const items = pain
      .slice(0, 20)
      .map((p) => `<li>${formatCycleDateKa(p.date)} — ${ka.cycle.painType[p.type as keyof typeof ka.cycle.painType] ?? p.type} · ${ka.cycle.painSeverity[p.severity as keyof typeof ka.cycle.painSeverity] ?? p.severity}</li>`)
      .join('');
    return `<h2>${ka.cycle.reportPain}</h2><ul>${items}</ul>`;
  })()}
  <p class="disclaimer">${ka.cycle.reportDisclaimer}</p>
  <p class="disclaimer">${ka.cycle.contraceptionDisclaimer}</p>
</body>
</html>`;
}
