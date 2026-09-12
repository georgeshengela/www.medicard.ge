/**
 * Phase 15 — doctor-summary locale helpers and HTML renderer.
 * Server payload stays language-neutral. Inclusion is not locale-driven.
 */

import {
  DOCTOR_SUMMARY_COPY,
  DOCTOR_SUMMARY_LOCALES,
} from '../i18n/cycle/doctorSummary.js';

const INTL_TAG = {
  ka: 'ka-GE',
  en: 'en-GB',
  fr: 'fr-FR',
  ru: 'ru-RU',
};

export function resolveDoctorSummaryLocale(tag) {
  const raw = String(tag || '').toLowerCase();
  if (raw.startsWith('ka')) return 'ka';
  if (raw.startsWith('fr')) return 'fr';
  if (raw.startsWith('ru')) return 'ru';
  if (raw.startsWith('en')) return 'en';
  return 'ka';
}

export function doctorSummaryCopy(locale) {
  const loc = resolveDoctorSummaryLocale(locale);
  return DOCTOR_SUMMARY_COPY[loc] || DOCTOR_SUMMARY_COPY.ka;
}

export function doctorSummaryEnumLabel(group, key, locale) {
  if (key == null || key === '') return null;
  const copy = doctorSummaryCopy(locale);
  const table = copy[group];
  if (!table || typeof table !== 'object') return null;
  const label = table[key];
  if (typeof label !== 'string' || !label) return null;
  return label;
}

const KA_MONTHS = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];

export function formatDoctorCivilDate(ymd, locale) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
  const [year, month, day] = ymd.split('-').map(Number);
  const loc = resolveDoctorSummaryLocale(locale);
  if (loc === 'ka') {
    return `${day} ${KA_MONTHS[month - 1]} ${year}`;
  }
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat(INTL_TAG[loc], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function escDoctorHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function list(items) {
  return items.map((item) => `<li>${item}</li>`).join('');
}

function labeledDate(copy, locale, date, text) {
  if (!text) return null;
  return `${escDoctorHtml(formatDoctorCivilDate(date, locale))} — ${text}`;
}

/**
 * Same allowed fact IDs regardless of locale. Localization must not filter inclusion.
 */
export function doctorReportFactIds(summary) {
  const ctx = summary?.pregnancyContext || null;
  const peri = summary?.perimenopauseContext || null;
  const pp = summary?.postpartumContext || null;
  return {
    episodeStarts: (summary?.menstrualHistory?.episodes || []).map((e) => e.start),
    spottingDates: [...(summary?.menstrualHistory?.spottingDates || [])],
    cycleLengths: (summary?.menstrualHistory?.cycleLengths || []).map((c) => c.lengthDays),
    painTypes: (summary?.pain?.aggregates || []).map((p) => p.type),
    symptomKeys: (summary?.symptoms?.rows || []).map((r) => r.key),
    energyDates: (summary?.wellness?.energy || []).map((r) => r.date),
    sleepDates: (summary?.wellness?.sleep || []).map((r) => r.date),
    stressDates: (summary?.wellness?.stress || []).map((r) => r.date),
    contraception: summary?.contraception?.method || null,
    opkDates: (summary?.fertilityObservations?.ovulationTests || []).map((t) => t.date),
    bbtDates: (summary?.fertilityObservations?.bbt || []).map((t) => t.date),
    mucusDates: (summary?.fertilityObservations?.cervicalMucus || []).map((t) => t.date),
    pregDates: (summary?.fertilityObservations?.pregnancyTests || []).map((t) => t.date),
    sexualKeys: (summary?.privateObservations?.sexual || []).map((r) => r.key),
    noteDates: (summary?.privateObservations?.notes || []).map((r) => r.date),
    pregnancyCurrent: ctx?.current === true,
    pregnancyTrackingMode: ctx?.trackingMode || null,
    pregnancyReferenceDate: ctx?.referenceDate || null,
    pregnancyReferenceType: ctx?.referenceType || null,
    pregnancyReviewRequired: ctx ? Boolean(ctx.reviewRequired) : null,
    pregnancyWeek: ctx?.estimatedGestationalAge?.week ?? null,
    pregnancyDay: ctx?.estimatedGestationalAge?.day ?? null,
    pregnancyDueDate: ctx?.estimatedDueDate?.date || null,
    perimenopauseCurrent: peri?.current === true,
    perimenopauseTrackingMode: peri?.trackingMode || null,
    perimenopauseUserSelected: peri?.userSelected === true,
    perimenopauseIntervalCount: peri?.variability?.intervalCount ?? null,
    perimenopauseShortestDays: peri?.variability?.shortestDays ?? null,
    perimenopauseLongestDays: peri?.variability?.longestDays ?? null,
    perimenopauseSourceWindow: peri?.variability?.sourceWindow || null,
    postpartumCurrent: pp?.current === true,
    postpartumTrackingMode: pp?.trackingMode || null,
    postpartumReferenceDate: pp?.referenceDate || null,
    postpartumElapsedWeek: pp?.elapsed?.week ?? null,
    postpartumElapsedDay: pp?.elapsed?.day ?? null,
  };
}

export function formatDoctorGestationalAge(age, locale) {
  if (!age || !Number.isFinite(age.week) || !Number.isFinite(age.day)) return '';
  const copy = doctorSummaryCopy(locale);
  return `${copy.weeks(age.week)} + ${copy.days(age.day)}`;
}

export function formatDoctorPregnancyReference(ctx, locale) {
  if (!ctx) return '';
  const copy = doctorSummaryCopy(locale);
  const date = ctx.referenceDate ? formatDoctorCivilDate(ctx.referenceDate, locale) : '';
  const type =
    doctorSummaryEnumLabel('pregnancyReference', ctx.referenceType, locale) ||
    (ctx.referenceDate ? copy.pregnancyRefGeneric : null);
  if (type && date) return `${type} — ${date}`;
  return type || date || '';
}

function pregnancyContextHtml(summary, loc, copy) {
  const ctx = summary?.pregnancyContext;
  if (!ctx) return '';
  const rows = [];
  rows.push(
    `<dt>${escDoctorHtml(copy.pregnancyTrackingMode)}</dt><dd>${escDoctorHtml(copy.pregnancyTrackingModeValue)}</dd>`,
  );
  const reference = formatDoctorPregnancyReference(ctx, loc);
  if (reference) {
    rows.push(
      `<dt>${escDoctorHtml(copy.pregnancyDatingReference)}</dt><dd>${escDoctorHtml(reference)}</dd>`,
    );
  }
  if (ctx.reviewRequired) {
    rows.push(`<dt>${escDoctorHtml(copy.pregnancyReviewRequired)}</dt><dd></dd>`);
  } else {
    if (ctx.estimatedGestationalAge) {
      const ageLabel =
        ctx.referenceType === 'LMP' ? copy.pregnancyEstimatedAgeLmp : copy.pregnancyEstimatedAge;
      rows.push(
        `<dt>${escDoctorHtml(ageLabel)}</dt><dd>${escDoctorHtml(formatDoctorGestationalAge(ctx.estimatedGestationalAge, loc))}</dd>`,
      );
    }
    if (ctx.estimatedDueDate?.date) {
      rows.push(
        `<dt>${escDoctorHtml(copy.pregnancyEstimatedDue)}</dt><dd>${escDoctorHtml(formatDoctorCivilDate(ctx.estimatedDueDate.date, loc))}</dd>`,
      );
    }
  }
  return `<h2>${escDoctorHtml(copy.pregnancyContextTitle)}</h2>
    <dl class="preg-ctx">${rows.join('')}</dl>`;
}

function perimenopauseContextHtml(summary, loc, copy) {
  const ctx = summary?.perimenopauseContext;
  if (!ctx) return '';
  const rows = [];
  rows.push(
    `<dt>${escDoctorHtml(copy.perimenopauseTrackingMode)}</dt><dd>${escDoctorHtml(copy.perimenopauseTrackingModeValue)}</dd>`,
  );
  const v = ctx.variability;
  if (v && Number.isFinite(v.shortestDays) && Number.isFinite(v.longestDays) && v.intervalCount >= 2) {
    rows.push(
      `<dt>${escDoctorHtml(copy.perimenopauseIntervalRangeLabel)}</dt><dd>${escDoctorHtml(copy.perimenopauseIntervalRange(v.shortestDays, v.longestDays))}</dd>`,
    );
    rows.push(
      `<dt>${escDoctorHtml(copy.perimenopauseIntervalCountLabel)}</dt><dd>${escDoctorHtml(copy.perimenopauseIntervalCount(v.intervalCount))}</dd>`,
    );
  }
  return `<h2>${escDoctorHtml(copy.perimenopauseContextTitle)}</h2>
    <dl class="preg-ctx">${rows.join('')}</dl>
    <p>${escDoctorHtml(copy.perimenopauseCurrentNote)}</p>`;
}

function postpartumContextHtml(summary, loc, copy) {
  const ctx = summary?.postpartumContext;
  if (!ctx) return '';
  const rows = [];
  rows.push(
    `<dt>${escDoctorHtml(copy.postpartumTrackingMode)}</dt><dd>${escDoctorHtml(copy.postpartumTrackingModeValue)}</dd>`,
  );
  rows.push(
    `<dt>${escDoctorHtml(copy.postpartumReferenceLabel)}</dt><dd>${escDoctorHtml(
      ctx.referenceDate ? formatDoctorCivilDate(ctx.referenceDate, loc) : copy.postpartumReferenceMissing,
    )}</dd>`,
  );
  if (ctx.elapsed && Number.isFinite(ctx.elapsed.week) && Number.isFinite(ctx.elapsed.day)) {
    rows.push(
      `<dt>${escDoctorHtml(copy.postpartumElapsedLabel)}</dt><dd>${escDoctorHtml(formatDoctorGestationalAge(ctx.elapsed, loc))}</dd>`,
    );
  }
  return `<h2>${escDoctorHtml(copy.postpartumContextTitle)}</h2>
    <dl class="preg-ctx">${rows.join('')}</dl>
    <p>${escDoctorHtml(copy.postpartumCurrentNote)}</p>`;
}

export function buildCycleReportHtmlFromSummary(summary, locale = 'ka') {
  const loc = resolveDoctorSummaryLocale(locale);
  const copy = doctorSummaryCopy(loc);
  const m = summary?.menstrualHistory;
  const episodes = (m?.episodes ?? [])
    .map((e) => {
      const flow = (e.flowSequence || [])
        .map((id) => doctorSummaryEnumLabel('flow', id, loc))
        .filter(Boolean)
        .join(' → ');
      return `<tr><td>${escDoctorHtml(formatDoctorCivilDate(e.start, loc))}</td><td>${escDoctorHtml(formatDoctorCivilDate(e.end, loc))}</td><td>${escDoctorHtml(copy.days(e.durationDays))}</td><td>${escDoctorHtml(flow || '—')}</td></tr>`;
    })
    .join('');
  const lengths = (m?.cycleLengths ?? []).map((c) => `${c.lengthDays}`).join(', ');
  const spotting = (m?.spottingDates ?? []).map((d) => formatDoctorCivilDate(d, loc));
  const painAgg = (summary?.pain?.aggregates ?? [])
    .map((p) => {
      const type = doctorSummaryEnumLabel('painType', p.type, loc);
      if (!type) return null;
      const mode = p.severityMode
        ? ` · ${copy.mostly} ${doctorSummaryEnumLabel('painSeverity', p.severityMode, loc) || ''}`.trim()
        : '';
      return `${escDoctorHtml(type)}: ${escDoctorHtml(copy.loggedDays(p.dayCount))}${escDoctorHtml(mode)}`;
    })
    .filter(Boolean);
  const painRows = (summary?.pain?.rows ?? [])
    .slice(0, 24)
    .map((p) => {
      const type = doctorSummaryEnumLabel('painType', p.type, loc);
      if (!type) return null;
      const sev = p.severity ? doctorSummaryEnumLabel('painSeverity', p.severity, loc) : null;
      return labeledDate(copy, loc, p.date, escDoctorHtml(sev ? `${type} · ${sev}` : type));
    })
    .filter(Boolean);
  const symptoms = (summary?.symptoms?.rows ?? [])
    .map((row) => {
      const label = doctorSummaryEnumLabel('symptom', row.key, loc);
      if (!label) return null;
      return `${escDoctorHtml(label)}: ${escDoctorHtml(copy.loggedDays(row.dayCount))}`;
    })
    .filter(Boolean);
  const energy = (summary?.wellness?.energy ?? [])
    .map((r) => {
      const label = doctorSummaryEnumLabel('energy', r.value, loc);
      return label ? labeledDate(copy, loc, r.date, escDoctorHtml(label)) : null;
    })
    .filter(Boolean);
  const sleep = (summary?.wellness?.sleep ?? [])
    .map((r) => {
      const label = doctorSummaryEnumLabel('sleep', r.value, loc);
      return label ? labeledDate(copy, loc, r.date, escDoctorHtml(label)) : null;
    })
    .filter(Boolean);
  const stress = (summary?.wellness?.stress ?? [])
    .map((r) => {
      const label = doctorSummaryEnumLabel('stress', r.value, loc);
      return label ? labeledDate(copy, loc, r.date, escDoctorHtml(label)) : null;
    })
    .filter(Boolean);
  const fert = summary?.fertilityObservations;
  const opk = (fert?.ovulationTests ?? [])
    .map((t) => {
      const result = doctorSummaryEnumLabel('testResult', t.result, loc);
      return result ? labeledDate(copy, loc, t.date, `${escDoctorHtml(copy.opk)}: ${escDoctorHtml(result)}`) : null;
    })
    .filter(Boolean);
  const preg = (fert?.pregnancyTests ?? [])
    .map((t) => {
      const result = doctorSummaryEnumLabel('testResult', t.result, loc);
      return result
        ? labeledDate(copy, loc, t.date, `${escDoctorHtml(copy.pregnancyTest)}: ${escDoctorHtml(result)}`)
        : null;
    })
    .filter(Boolean);
  const bbt = (fert?.bbt ?? []).map((t) =>
    labeledDate(copy, loc, t.date, `${escDoctorHtml(copy.bbt)}: ${escDoctorHtml(t.temperature)} °C`),
  );
  const mucus = (fert?.cervicalMucus ?? [])
    .map((t) => {
      const label = doctorSummaryEnumLabel('mucus', t.value, loc);
      return label ? labeledDate(copy, loc, t.date, `${escDoctorHtml(copy.mucusLabel)}: ${escDoctorHtml(label)}`) : null;
    })
    .filter(Boolean);
  const sexual = (summary?.privateObservations?.sexual ?? [])
    .map((r) => {
      const label = doctorSummaryEnumLabel('sexual', r.key, loc);
      if (!label) return null;
      const extra = r.value != null ? ` ${escDoctorHtml(String(r.value))}` : '';
      return labeledDate(copy, loc, r.date, `${escDoctorHtml(label)}${extra}`);
    })
    .filter(Boolean);
  const notes = (summary?.privateObservations?.notes ?? []).map((r) =>
    labeledDate(copy, loc, r.date, escDoctorHtml(r.text)),
  );

  const contraceptionLabel = summary?.contraception
    ? doctorSummaryEnumLabel('contraception', summary.contraception.method, loc)
    : null;

  return `<!DOCTYPE html>
<html lang="${copy.htmlLang}">
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Georgian", sans-serif; padding: 32px; color: #1d1c1c; }
  h1 { font-size: 22px; color: #1f2937; }
  h2 { font-size: 16px; margin-top: 24px; page-break-after: avoid; }
  p, li, td, th { font-size: 13px; line-height: 1.5; }
  table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; word-wrap: break-word; overflow-wrap: anywhere; white-space: normal; }
  h1, h2 { overflow-wrap: break-word; }
  .preg-ctx { margin: 0 0 8px; }
  .preg-ctx dt { font-size: 12px; color: #4b5563; margin-top: 10px; font-weight: 600; }
  .preg-ctx dd { margin: 2px 0 0; font-size: 13px; }
  .disclaimer { margin-top: 32px; font-size: 11px; color: #666; }
</style>
</head>
<body>
  <h1>Medicard.GE — ${escDoctorHtml(copy.reportTitle)}</h1>
  <p>${escDoctorHtml(copy.range)}: ${escDoctorHtml(formatDoctorCivilDate(summary.range.from, loc))} – ${escDoctorHtml(formatDoctorCivilDate(summary.range.to, loc))}</p>
  ${
    summary?.generatedAt
      ? `<p>${escDoctorHtml(copy.generatedOn)}: ${escDoctorHtml(formatDoctorCivilDate(String(summary.generatedAt).slice(0, 10), loc))}</p>`
      : ''
  }
  ${pregnancyContextHtml(summary, loc, copy)}
  ${perimenopauseContextHtml(summary, loc, copy)}
  ${postpartumContextHtml(summary, loc, copy)}
  ${
    episodes
      ? `<h2>${escDoctorHtml(copy.menstrualOn)}</h2>
    <table><thead><tr><th>${escDoctorHtml(copy.start)}</th><th>${escDoctorHtml(copy.end)}</th><th>${escDoctorHtml(copy.duration)}</th><th>${escDoctorHtml(copy.flowHeading)}</th></tr></thead><tbody>${episodes}</tbody></table>
    ${lengths ? `<p>${escDoctorHtml(copy.cycleLengths)}: ${escDoctorHtml(lengths)}</p>` : ''}
    ${spotting.length ? `<p>${escDoctorHtml(copy.spotting)}: ${escDoctorHtml(spotting.join(', '))}</p>` : ''}`
      : ''
  }
  ${contraceptionLabel ? `<p>${escDoctorHtml(copy.contraceptionTitle)}: ${escDoctorHtml(contraceptionLabel)}</p>` : ''}
  ${painAgg.length ? `<h2>${escDoctorHtml(copy.pain)}</h2><ul>${list(painAgg)}</ul><ul>${list(painRows)}</ul>` : ''}
  ${symptoms.length ? `<h2>${escDoctorHtml(copy.symptoms)}</h2><ul>${list(symptoms)}</ul>` : ''}
  ${energy.length ? `<h2>${escDoctorHtml(copy.energyTitle)}</h2><ul>${list(energy)}</ul>` : ''}
  ${sleep.length ? `<h2>${escDoctorHtml(copy.sleepTitle)}</h2><ul>${list(sleep)}</ul>` : ''}
  ${stress.length ? `<h2>${escDoctorHtml(copy.stressTitle)}</h2><ul>${list(stress)}</ul>` : ''}
  ${opk.length || preg.length || bbt.length || mucus.length ? `<h2>${escDoctorHtml(copy.fertility)}</h2><ul>${list([...opk, ...preg, ...bbt, ...mucus])}</ul>` : ''}
  ${sexual.length ? `<h2>${escDoctorHtml(copy.sexualTitle)}</h2><ul>${list(sexual)}</ul>` : ''}
  ${notes.length ? `<h2>${escDoctorHtml(copy.notes)}</h2><ul>${list(notes)}</ul>` : ''}
  <p class="disclaimer">${escDoctorHtml(copy.historyDisclaimer)}</p>
  ${summary?.pregnancyContext ? `<p class="disclaimer">${escDoctorHtml(copy.pregnancyTimingDisclaimer)}</p>` : ''}
  ${summary?.perimenopauseContext ? `<p class="disclaimer">${escDoctorHtml(copy.perimenopauseDisclaimer)}</p>` : ''}
  ${summary?.postpartumContext ? `<p class="disclaimer">${escDoctorHtml(copy.postpartumDisclaimer)}</p>` : ''}
  <p class="disclaimer">${escDoctorHtml(copy.medicalDisclaimer)}</p>
</body>
</html>`;
}

export function buildCycleReportHtml(bundle) {
  return buildCycleReportHtmlFromSummary(bundle.summary);
}

export { DOCTOR_SUMMARY_LOCALES };
