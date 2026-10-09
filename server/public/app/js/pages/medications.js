// MEDICARD web — Medications (/medications, /medications/:id) + Home „შემდეგი მიღება“ card.
// Same data as the app: GET/POST/PATCH/DELETE /api/medications (schedule) and the dose log
// that the app keeps in the account state (PUT /api/account/app-state { doseLogs: [entry] },
// merged server-side by updatedAt) plus the domain event POST /api/push/dose-events.
import {
  h, mount, clear, icon, tile, pageHead, section, card, button, iconButton, busy, badge, stat, empty,
  skeleton, errorBox, segmented, field, input, textarea, select, toggle, toast, openModal, confirmDialog,
  formModal, markdown, fmtDate, ymd, addDays, parseDate, KA_DAYS_SHORT,
} from '../ui.js';
import { get, put, post, patch, del, ApiError } from '../api.js';
import { ring, barChart, heatmap } from '../charts.js';
import { withAiConsent, aiDeclinedSlot } from '../aiConsent.js';
import { t, isEn } from '../i18n.js';
import { wordmark } from '../brand.js';

const CSS = '/app/css/medications.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

/* ── Constants (same values as the app) ──────────────── */
const FORM_LABELS = isEn
  ? { pills: 'tablet', capsules: 'capsule', liquid: 'liquid', injection: 'injection' }
  : { pills: 'ტაბლეტი', capsules: 'კაფსულა', liquid: 'სითხე', injection: 'ინექცია' };
const MEAL_LABELS = isEn
  ? { any: 'Any time', before: 'Before meals', after: 'After meals', with: 'With meals' }
  : { any: 'ნებისმიერ დროს', before: 'ჭამამდე', after: 'ჭამის შემდეგ', with: 'ჭამასთან ერთად' };
const DAY_LETTERS = isEn ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['ო', 'ს', 'ო', 'ხ', 'პ', 'შ', 'კ']; // Monday-first, like the app (0 = Monday)
const DAY_FULL = isEn
  ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  : ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა'];
const PILL_COLORS = ['#14B8A6', '#1E3A8A', '#E5E7EB', '#F43F5E', '#F97316', '#22C55E', '#0EA5E9', '#6366F1', '#334155', '#111827'];
const MAX_TIMES = 8; // server: 1–8 doses a day
const DUE_GRACE_MIN = 60; // a dose is "due" for an hour after its time, then "missed"
// Skipped and missed doses are amber („look here“), never red: red stays for deleting and real
// alerts (owner 2026-10-08). `amber` is the AA ink badge; in charts a missed dose is a paler amber.
const STATUS = {
  taken: { label: t('მიღებული', 'Taken'), tone: 'ok' },
  skipped: { label: t('გამოტოვებული', 'Skipped'), tone: 'amber' },
  missed: { label: t('გაცდენილი', 'Missed'), tone: 'amber' },
  due: { label: t('ახლა', 'Now'), tone: 'brand' },
  upcoming: { label: t('მოლოდინში', 'Upcoming'), tone: 'neutral' },
};
const MISSED_FILL = 'var(--med-missed)'; // medications.css: a paler amber beside the skipped one
const APP_STORE = 'https://apps.apple.com/app/id6812517519';

/* ── Pure helpers ────────────────────────────────────── */
export function parseConfig(raw) { return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; }
export function parseTimes(freq) { return String(freq || '').split(',').map((t) => t.trim()).filter(Boolean); }
const dow = (date) => (parseDate(date).getDay() + 6) % 7;
const minutes = (t) => { const [a, b] = String(t).split(':').map(Number); return (a || 0) * 60 + (b || 0); };
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const movedTime = (log) => (log && log.status === 'pending' && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(log.rescheduledTo || '')) ? log.rescheduledTo : null);
const shortDay = (date) => { const d = parseDate(date); return `${d.getDate()}/${d.getMonth() + 1}`; };

function daysSummary(days) {
  if (!Array.isArray(days) || !days.length || days.length === 7) return t('ყოველდღე', 'Every day');
  return days.slice().sort((a, b) => a - b).map((d) => DAY_FULL[d]).filter(Boolean).join(', ');
}

function scheduleLine(med) {
  const times = parseTimes(med.frequency);
  const n = times.length;
  const per = n === 1 ? t('დღეში ერთხელ', 'Once a day') : t(`დღეში ${n}-ჯერ`, `${n} times a day`);
  return `${per} · ${times.join(', ')}`;
}

function knownAs(med) {
  const cfg = parseConfig(med.config);
  return [cfg.strength, med.dosage, cfg.genericName && cfg.genericName !== med.medName ? cfg.genericName : null].filter(Boolean).join(' · ');
}

function pillBadge(color, size = 44) {
  const c = color || PILL_COLORS[0];
  return h('span', { class: `med-pill ${c.toUpperCase() === '#E5E7EB' ? 'light' : ''}`, style: { width: `${size}px`, height: `${size}px`, '--pill': c } }, h('i'));
}

function logIndex(logs) {
  const m = new Map();
  for (const l of Array.isArray(logs) ? logs : []) {
    if (!l || typeof l !== 'object' || !l.medicationId || !l.date || !l.time) continue;
    const k = `${l.medicationId}|${l.date}|${l.time}`;
    const prev = m.get(k);
    if (!prev || String(l.updatedAt || '') > String(prev.updatedAt || '')) m.set(k, l);
  }
  return m;
}

function plannedOn(med, date, today) {
  if (!med.active) return false;
  const cfg = parseConfig(med.config);
  if (cfg.startDate && date < cfg.startDate) return false;
  if (cfg.endDate && date > cfg.endDate) return false;
  if (Array.isArray(cfg.daysOfWeek) && cfg.daysOfWeek.length && !cfg.daysOfWeek.includes(dow(date))) return false;
  // History: a medication cannot have been due before it was added.
  if (date < today && med.createdAt && date < ymd(med.createdAt)) return false;
  return true;
}

/**
 * The one "what was / is due on a date" view (Home card, Today timeline, stats, detail).
 * Planned = active medications on that day (course, weekdays); logged doses of known medications
 * (rescheduled or since paused) are included too. Status: taken | skipped | missed | due | upcoming.
 */
export function dosesForDate(bundle, date, now = new Date(), medId = null) {
  const today = ymd(now);
  const idx = bundle.index || (bundle.index = logIndex(bundle.logs));
  const byId = bundle.byId || (bundle.byId = new Map(bundle.medications.map((m) => [m.id, m])));
  const out = new Map();
  for (const med of bundle.medications) {
    if (medId && med.id !== medId) continue;
    if (!plannedOn(med, date, today)) continue;
    for (const t of parseTimes(med.frequency)) out.set(`${med.id}|${t}`, { med, time: t });
  }
  for (const l of idx.values()) {
    if (l.date !== date || (medId && l.medicationId !== medId) || !byId.has(l.medicationId)) continue;
    if (l.status !== 'taken' && l.status !== 'skipped') continue;
    const k = `${l.medicationId}|${l.time}`;
    if (!out.has(k)) out.set(k, { med: byId.get(l.medicationId), time: l.time });
  }
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return [...out.values()].map((d) => {
    const log = idx.get(`${d.med.id}|${date}|${d.time}`);
    let status = log && (log.status === 'taken' || log.status === 'skipped') ? log.status : null;
    // The app's „გადატანა“ keeps the dose open on its own slot and moves it to a later time that day.
    const movedTo = !status ? movedTime(log) : null;
    if (!status) {
      if (date < today) status = 'missed';
      else if (date > today) status = 'upcoming';
      else {
        const m = minutes(movedTo || d.time);
        status = nowMin < m ? 'upcoming' : nowMin - m <= DUE_GRACE_MIN ? 'due' : 'missed';
      }
    }
    return { ...d, date, status, log, movedTo };
  }).sort((a, b) => a.time.localeCompare(b.time) || a.med.medName.localeCompare(b.med.medName, 'ka'));
}

export function todaySummary(bundle, now = new Date()) {
  const doses = dosesForDate(bundle, ymd(now), now);
  const taken = doses.filter((d) => d.status === 'taken').length;
  const open = doses.filter((d) => d.status !== 'taken' && d.status !== 'skipped');
  const next = open.find((d) => d.status === 'due') || open.find((d) => d.status === 'upcoming') || open[0] || null;
  return { doses, taken, total: doses.length, open, next };
}

/** Per-day counts; only doses whose time has passed (or that were logged) count as planned. */
function dayStats(bundle, date, now, medId) {
  const doses = dosesForDate(bundle, date, now, medId);
  const s = { date, planned: 0, taken: 0, skipped: 0, missed: 0, open: 0 };
  for (const d of doses) {
    if (d.status === 'upcoming' || d.status === 'due') { s.open += 1; continue; }
    s.planned += 1;
    s[d.status] += 1;
  }
  return s;
}

function history(bundle, days, now = new Date(), medId = null) {
  return Array.from({ length: days }, (_, i) => dayStats(bundle, ymd(addDays(now, i - days + 1)), now, medId));
}

function sumAdherence(rows) {
  const t = rows.reduce((a, r) => a + r.taken, 0);
  const p = rows.reduce((a, r) => a + r.planned, 0);
  return { taken: t, planned: p, pct: pct(t, p), skipped: rows.reduce((a, r) => a + r.skipped, 0), missed: rows.reduce((a, r) => a + r.missed, 0) };
}

/** Consecutive fully-taken days (days without a plan neither count nor break it). */
function streak(bundle, now = new Date(), medId = null) {
  const meds = bundle.medications.filter((m) => !medId || m.id === medId);
  const first = meds.map((m) => (m.createdAt ? ymd(m.createdAt) : null)).filter(Boolean).sort()[0];
  let n = 0;
  for (let i = 0; i < 120; i++) {
    const date = ymd(addDays(now, -i));
    if (first && date < first) break;
    const s = dayStats(bundle, date, now, medId);
    if (i === 0) {
      if (s.skipped || s.missed) return 0;
      if (s.planned && !s.open) n += 1;
      continue;
    }
    if (!s.planned) continue;
    if (s.taken === s.planned) n += 1; else break;
  }
  return n;
}

/* ── Data ────────────────────────────────────────────── */
export async function loadMeds() {
  const [list, app] = await Promise.all([
    get('/api/medications'),
    get('/api/account/app-state').catch(() => null),
  ]);
  return {
    medications: Array.isArray(list?.medications) ? list.medications : [],
    logs: Array.isArray(app?.state?.doseLogs) ? app.state.doseLogs : [],
    logsOk: Boolean(app),
  };
}

function setLogs(bundle, logs) {
  if (!Array.isArray(logs)) return;
  bundle.logs = logs;
  bundle.index = null;
}

/** Records a dose exactly like the app: account state (merged by updatedAt) + the domain dose event. */
async function writeDose(medicationId, date, time, status) {
  const entry = { medicationId, date, time, status, updatedAt: new Date().toISOString() };
  const res = await put('/api/account/app-state', { doseLogs: [entry] });
  if (status === 'taken' || status === 'skipped') {
    post('/api/push/dose-events', { events: [{ medicationId, date, time, status, source: 'app', occurredAt: entry.updatedAt }] }).catch(() => {});
  }
  return { entry, logs: res?.state?.doseLogs };
}

/**
 * One-click „მივიღე“ / „გამოვტოვე“ with an undo toast. Undo writes status 'pending'
 * (the app's own "not answered" state) with a newer timestamp, so every device agrees.
 */
async function markDose(bundle, dose, status, rerender) {
  const { med, date, time } = dose;
  try {
    const { entry, logs } = await writeDose(med.id, date, time, status);
    if (logs) setLogs(bundle, logs); else setLogs(bundle, [...bundle.logs, entry]);
    rerender();
    toast(status === 'taken' ? t(`${med.medName} — მიღებულია`, `${med.medName} — taken`) : t(`${med.medName} — გამოტოვებულია`, `${med.medName} — skipped`), 'ok', {
      ms: 6000,
      action: {
        label: t('დაბრუნება', 'Undo'),
        onClick: async () => {
          try {
            const back = await writeDose(med.id, date, time, 'pending');
            if (back.logs) setLogs(bundle, back.logs); else setLogs(bundle, [...bundle.logs, back.entry]);
            rerender();
          } catch (e) { toast(e?.message || t('ვერ დაბრუნდა.', 'Couldn’t undo.'), 'error'); }
        },
      },
    });
  } catch (e) {
    toast(e?.message || t('ვერ შეინახა. სცადე ხელახლა.', 'Couldn’t save. Please try again.'), 'error');
  }
}

function doseButtons(bundle, dose, rerender, opts = {}) {
  if (dose.status === 'taken' || dose.status === 'skipped') {
    return h('div', { class: 'med-dose-actions' }, badge(STATUS[dose.status].label, STATUS[dose.status].tone));
  }
  const take = button(opts.compact ? null : t('მივიღე', 'Taken'), { size: 'sm', icon: 'check', ariaLabel: t(`${dose.med.medName} ${dose.time} — მივიღე`, `${dose.med.medName} ${dose.time} — taken`) });
  const skip = button(opts.compact ? null : t('გამოვტოვე', 'Skip'), { size: 'sm', variant: 'ghost', icon: opts.compact ? 'x' : null, ariaLabel: t(`${dose.med.medName} ${dose.time} — გამოვტოვე`, `${dose.med.medName} ${dose.time} — skip`) });
  take.addEventListener('click', () => busy(take, () => markDose(bundle, dose, 'taken', rerender)));
  skip.addEventListener('click', () => busy(skip, () => markDose(bundle, dose, 'skipped', rerender)));
  return h('div', { class: 'med-dose-actions' }, opts.noSkip ? null : skip, take);
}

/* ── Home card ───────────────────────────────────────── */
export function homeCard() {
  ensureCss();
  const box = card({ class: 'med-home' }, skeleton(3));
  let bundle = null;
  const render = () => {
    const now = new Date();
    if (!bundle.medications.some((m) => m.active)) {
      mount(box, h('div', { class: 'hstack', style: { gap: '14px', alignItems: 'center', flexWrap: 'wrap' } },
        tile('pill', 'teal', 46),
        h('div', { style: { flex: 1, minWidth: '180px' } },
          h('div', { class: 'card-title' }, t('მედიკამენტები ჯერ არ დაგიმატებია', 'You haven’t added any medications yet')),
          h('div', { class: 'card-sub' }, t('დაამატე პრეპარატი და დღის გრაფიკი აქ გამოჩნდება.', 'Add a medication and your daily schedule will appear here.'))),
        button(t('დამატება', 'Add'), { icon: 'plus', size: 'sm', href: '/medications?add=1' })));
      return;
    }
    const sum = todaySummary(bundle, now);
    const upcoming = sum.open.filter((d) => d.status !== 'missed').slice(0, 3);
    const missedCount = sum.open.filter((d) => d.status === 'missed').length;
    const list = upcoming.length ? upcoming : sum.open.slice(0, 2);
    mount(box,
      h('div', { class: 'hstack', style: { gap: '16px', alignItems: 'center' } },
        ring({ value: sum.taken, max: sum.total || 1, size: 74, stroke: 8, label: sum.total ? `${sum.taken}/${sum.total}` : '—', labelScale: 0.22 }),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { class: 'card-title' }, sum.total === 0 ? t('დღეს მიღება დაგეგმილი არ არის', 'No doses planned for today') : sum.open.length === 0 ? t('ყველა დოზა მიღებულია', 'All doses taken') : t(`${sum.taken}/${sum.total} მიღებული`, `${sum.taken}/${sum.total} taken`)),
          h('div', { class: 'card-sub' }, sum.next ? t(`შემდეგი ${sum.next.time} · ${sum.next.med.medName}`, `Next ${sum.next.time} · ${sum.next.med.medName}`) : sum.total ? t('კარგი დღეა — ასე გააგრძელე.', 'Great day — keep it up.') : t('შენი მედიკამენტები სხვა დღეებზეა.', 'Your medications are scheduled for other days.')),
          missedCount ? h('div', { style: { marginTop: '6px' } }, badge(t(`${missedCount} გაცდენილი`, `${missedCount} missed`), STATUS.missed.tone)) : null)),
      list.length ? h('div', { class: 'stack', style: { gap: '8px', marginTop: '16px' } }, list.map((d) => h('div', { class: 'med-dose' },
        pillBadge(parseConfig(d.med.config).pillColor, 36),
        h('div', { class: 'med-dose-main' },
          h('div', { class: 'med-dose-title' }, d.med.medName),
          h('div', { class: 'med-dose-sub' }, `${d.time} · ${d.med.dosage}`)),
        doseButtons(bundle, d, render, { noSkip: true })))) : null,
      h('div', { style: { marginTop: '14px' } }, h('a', { class: 'link', href: '/medications', 'data-link': '' }, t('დღის გრაფიკი', 'Daily schedule'), icon('chevronRight', { size: 16 }))));
  };
  loadMeds().then((b) => { bundle = b; render(); }).catch((e) => mount(box, errorBox(e)));
  return box;
}

/* ── Add / edit form ─────────────────────────────────── */
function defaultTimes(count) {
  if (count === 1) return ['08:00'];
  if (count === 2) return ['08:00', '20:00'];
  if (count === 3) return ['08:00', '14:00', '20:00'];
  const start = 7 * 60; const step = (14 * 60) / count;
  return Array.from({ length: count }, (_, i) => {
    const total = Math.round(start + step * i + step / 2);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${total % 60 >= 30 ? '30' : '00'}`;
  });
}

function openMedForm(existing, onSaved) {
  const cfg = parseConfig(existing?.config);
  const today = ymd();
  let times = existing ? parseTimes(existing.frequency) : ['08:00'];
  let days = Array.isArray(cfg.daysOfWeek) && cfg.daysOfWeek.length ? [...cfg.daysOfWeek] : [0, 1, 2, 3, 4, 5, 6];
  let color = cfg.pillColor || PILL_COLORS[0];
  let refillOn = cfg.refillReminder !== undefined ? Boolean(cfg.refillReminder) : true;

  const timesBox = h('div', { class: 'med-times-grid' });
  const countSel = select(Array.from({ length: MAX_TIMES }, (_, i) => ({ value: i + 1, label: i === 0 ? t('დღეში ერთხელ', 'Once a day') : t(`დღეში ${i + 1}-ჯერ`, `${i + 1} times a day`) })), times.length, { name: 'timesPerDay' });
  const renderTimes = () => {
    mount(timesBox, times.map((tm, i) => input({ type: 'time', value: tm, required: true, 'aria-label': t(`მიღების დრო ${i + 1}`, `Dose time ${i + 1}`), onInput: (e) => { times[i] = e.target.value; } })));
  };
  countSel.addEventListener('change', () => {
    const n = Number(countSel.value);
    const defs = defaultTimes(n);
    times = defs.map((t, i) => times[i] ?? t);
    renderTimes();
  });
  renderTimes();

  const daysSummaryEl = h('div', { class: 'med-form-sub' });
  const daysBox = h('div', { class: 'med-days', role: 'group', 'aria-label': t('მიღების დღეები', 'Dose days') });
  const renderDays = () => {
    mount(daysBox, DAY_LETTERS.map((l, i) => h('button', {
      type: 'button', class: `med-day ${days.includes(i) ? 'on' : ''}`, title: DAY_FULL[i], 'aria-label': DAY_FULL[i], 'aria-pressed': days.includes(i) ? 'true' : 'false',
      onClick: () => { days = days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b); renderDays(); },
    }, l)));
    daysSummaryEl.textContent = days.length ? daysSummary(days) : t('აირჩიე მინიმუმ ერთი დღე', 'Choose at least one day');
  };
  renderDays();

  const colorsBox = h('div', { class: 'med-colors', role: 'radiogroup', 'aria-label': t('ფერი', 'Color') });
  const renderColors = () => mount(colorsBox, PILL_COLORS.map((c) => h('button', {
    type: 'button', class: `med-color ${c === color ? 'on' : ''}`, role: 'radio', 'aria-checked': c === color ? 'true' : 'false', 'aria-label': c,
    onClick: () => { color = c; renderColors(); },
  }, h('span', { style: { background: c } }))));
  renderColors();

  const refillFields = h('div', { class: 'form-row' },
    field(t('შევსების ზღვარი', 'Refill threshold'), input({ name: 'refillThreshold', type: 'number', min: 1, max: 999, value: cfg.refillThreshold ?? 12 }), t('შეგახსენებ, როცა დარჩენილი ამ რაოდენობას მიაღწევს', 'We’ll remind you when what’s left reaches this amount')),
    field(t('დარჩენილი რაოდენობა', 'Amount left'), input({ name: 'remainingCount', type: 'number', min: 0, max: 9999, value: cfg.remainingCount ?? '', placeholder: t('არასავალდებულო', 'Optional') })));
  refillFields.hidden = !refillOn;

  const startIn = input({ name: 'startDate', type: 'date', value: cfg.startDate || today, required: true });
  const endIn = input({ name: 'endDate', type: 'date', value: cfg.endDate || ymd(addDays(parseDate(cfg.startDate || today), 365)) });
  startIn.addEventListener('change', () => { if (endIn.value && endIn.value < startIn.value) endIn.value = ymd(addDays(parseDate(startIn.value), 365)); endIn.min = startIn.value; });
  endIn.min = startIn.value;

  const fields = () => h('div', { class: 'stack', style: { gap: '16px' } },
    field(t('დასახელება', 'Name'), input({ name: 'medName', required: true, minlength: 2, maxlength: 120, value: existing?.medName || '', placeholder: t('მაგ. ამოქსიცილინი', 'e.g. Amoxicillin'), autocomplete: 'off' })),
    h('div', { class: 'form-row' },
      field(t('რაოდენობა ერთ მიღებაზე', 'Amount per dose'), input({ name: 'amount', type: 'number', min: 0.25, max: 100, step: 0.25, required: true, value: cfg.amount ?? 1 }), t('ერთ ჯერზე — არა მთლიანი შეკვრა', 'For one dose — not the whole pack')),
      field(t('ფორმა', 'Form'), select(Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label })), cfg.form || 'pills', { name: 'form' }))),
    h('div', { class: 'form-row' },
      field(t('სიძლიერე', 'Strength'), input({ name: 'strength', maxlength: 40, value: cfg.strength || '', placeholder: t('მაგ. 500 მგ', 'e.g. 500 mg') })),
      field(t('ჭამასთან', 'With food'), select(Object.entries(MEAL_LABELS).map(([value, label]) => ({ value, label })), cfg.mealTiming || 'any', { name: 'mealTiming' }))),
    field(t('სიხშირე', 'Frequency'), countSel),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('მიღების დრო', 'Dose time')), timesBox),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('მიღების დღეები', 'Dose days')), daysBox, daysSummaryEl),
    h('div', { class: 'form-row' }, field(t('დაწყების თარიღი', 'Start date'), startIn), field(t('დასრულების თარიღი', 'End date'), endIn)),
    h('div', { class: 'field' },
      toggle(refillOn, (v) => { refillOn = v; refillFields.hidden = !v; }, t('შევსების შეხსენება', 'Refill reminder')),
      h('span', { class: 'field-hint' }, t('შეხსენებას MEDICARD აპი გამოგიგზავნის.', 'The MEDICARD app sends the reminder.'))),
    refillFields,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('ფერი', 'Color')), colorsBox),
    field(t('შენიშვნა', 'Note'), textarea({ name: 'notes', maxlength: 300, rows: 2, value: existing?.notes || '', placeholder: t('მაგ. ჭამის შემდეგ, უხვი წყლით', 'e.g. after meals, with plenty of water') })));

  formModal({
    title: existing ? t('მედიკამენტის რედაქტირება', 'Edit medication') : t('მედიკამენტის დამატება', 'Add medication'),
    size: 'md',
    submit: existing ? t('შენახვა', 'Save') : t('დამატება', 'Add'),
    fields,
    onSubmit: async (v, close) => {
      const medName = String(v.medName || '').trim();
      if (medName.length < 2) throw new Error(t('მიუთითე მედიკამენტის დასახელება', 'Enter the medication name'));
      const amount = Number(v.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error(t('მიუთითე რაოდენობა', 'Enter the amount'));
      const clean = times.map((t) => String(t || '').slice(0, 5));
      if (clean.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new Error(t('დრო უნდა იყოს ფორმატში 09:00', 'Time must be in the format 09:00'));
      const unique = [...new Set(clean)].sort();
      if (unique.length !== clean.length) throw new Error(t('მიღების დროები არ უნდა მეორდებოდეს', 'Dose times can’t repeat'));
      if (!days.length) throw new Error(t('აირჩიე მინიმუმ ერთი დღე', 'Choose at least one day'));
      if (!v.startDate) throw new Error(t('მიუთითე დაწყების თარიღი', 'Enter a start date'));
      if (v.endDate && v.endDate < v.startDate) throw new Error(t('დასრულების თარიღი ვერ იქნება დაწყების თარიღზე ადრე', 'The end date can’t be before the start date'));
      const form = FORM_LABELS[v.form] ? v.form : 'pills';
      const threshold = Math.max(1, Math.round(Number(v.refillThreshold) || 12));
      const remaining = v.remainingCount === '' || v.remainingCount == null ? undefined : Math.max(0, Math.round(Number(v.remainingCount)));
      const config = {
        ...cfg,
        form,
        amount,
        timesPerDay: unique.length,
        frequencyKind: cfg.frequencyKind || 'daily',
        daysOfWeek: days,
        startDate: v.startDate,
        endDate: v.endDate || undefined,
        pillColor: color,
        pillShape: cfg.pillShape || 'diamond',
        refillReminder: refillOn,
        refillThreshold: threshold,
        mealTiming: v.mealTiming || 'any',
        strength: String(v.strength || '').trim() || undefined,
        remainingCount: Number.isFinite(remaining) ? remaining : undefined,
      };
      const body = {
        medName,
        dosage: `${amount} ${FORM_LABELS[form]}`,
        frequency: unique.join(', '),
        notes: existing ? String(v.notes || '').trim() : String(v.notes || '').trim() || undefined,
        config: JSON.parse(JSON.stringify(config)),
      };
      const res = existing ? await patch(`/api/medications/${existing.id}`, body) : await post('/api/medications', { ...body, active: true });
      close();
      toast(existing ? t('ცვლილებები შენახულია', 'Changes saved') : t(`${medName} დაემატა`, `${medName} added`), 'ok');
      onSaved?.(res?.medication);
    },
  });
}

async function setActive(med, active, onDone) {
  try {
    await patch(`/api/medications/${med.id}`, { active });
    toast(active ? t(`${med.medName} — განახლდა`, `${med.medName} — resumed`) : t(`${med.medName} — შეჩერდა`, `${med.medName} — paused`), 'ok');
  } catch (e) { toast(e?.message || t('ვერ შეიცვალა.', 'Couldn’t change it.'), 'error'); }
  onDone?.();
}

async function removeMed(med, onDone) {
  const ok = await confirmDialog({ title: t('წაშლა განრიგიდან', 'Remove from schedule'), body: t(`ნამდვილად გსურს „${med.medName}“-ის წაშლა? მიღების ისტორია სტატისტიკიდანაც გაქრება.`, `Delete “${med.medName}”? Its dose history will also disappear from your stats.`), confirm: t('წაშლა', 'Delete'), danger: true });
  if (!ok) return;
  try {
    await del(`/api/medications/${med.id}`);
    toast(t('მედიკამენტი წაიშალა', 'Medication deleted'), 'ok');
    onDone?.();
  } catch (e) { toast(e?.message || t('ვერ წაიშალა.', 'Couldn’t delete.'), 'error'); }
}

/* ── Interaction check (AI: Medi reviews the active list) ── */
function openInteraction(bundle) {
  const active = bundle.medications.filter((m) => m.active);
  const result = h('div');
  const run = button(t('შეამოწმე ურთიერთქმედებები', 'Check interactions'), { icon: 'shield', disabled: active.length === 0 });
  run.addEventListener('click', () => busy(run, async () => {
    mount(result, skeleton(4));
    try {
      const res = await withAiConsent(() => post('/api/ai/medication-review', {}, { timeoutMs: 120_000 }));
      // Declined / closed the AI disclosure: a calm note with „ხელახლა ცდა“, not an error.
      if (res?.declined) { const note = aiDeclinedSlot(); mount(result, note); note.show(() => run.click()); return; }
      mount(result,
        h('div', { class: 'hub-section-head', style: { marginTop: '8px' } }, h('h2', { style: { fontSize: '16px' } }, t('Medi-ს დასკვნა', 'Medi’s review'))),
        h('div', { class: 'card', style: { background: 'var(--bg)' } }, markdown(res?.analysis || '')),
        h('p', { class: 'disclaimer' }, icon('info', { size: 14 }),
          t('მიმოხილვა AI-ით (Medi) არის შექმნილი შენი წამლების სიიდან — შეიძლება რამე გამოტოვოს და ეს დიაგნოზი ან დანიშნულება არ არის. წამლის შეცვლამდე ჰკითხე ექიმს ან ფარმაცევტს.', 'This review was created by AI (Medi) from your medication list — it may miss something, and it is not a diagnosis or a prescription. Ask your doctor or pharmacist before changing any medication.')));
    } catch (e) {
      mount(result, errorBox(e instanceof ApiError ? e : new Error(e?.message || t('შემოწმება ვერ შესრულდა.', 'The check couldn’t be completed.'))));
    }
  }));
  openModal({
    title: t('მედიკამენტების ურთიერთქმედება', 'Medication interactions'),
    size: 'lg',
    body: h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'hstack', style: { gap: '14px', alignItems: 'flex-start' } },
        tile('shield', 'violet', 46),
        h('p', { class: 'muted', style: { flex: 1 } }, t('Medi შენს აქტიურ მედიკამენტებს შესაძლო ურთიერთქმედებებისა და რისკების გამოსავლენად გადაამოწმებს. ეს უსაფრთხოებას არ ადასტურებს — საბოლოო სიტყვა ექიმისაა.', 'Medi checks your active medications for possible interactions and risks. This doesn’t confirm they’re safe — your doctor has the final word.'))),
      h('div', null,
        h('div', { class: 'field-label', style: { marginBottom: '8px' } }, t('შემოწმდება', 'Will be checked')),
        active.length
          ? h('div', { class: 'chips' }, active.map((m) => h('span', { class: 'chip' }, m.medName)))
          : h('p', { class: 'muted' }, t('აქტიური მედიკამენტები ჯერ არ გაქვს — ჯერ დაამატე.', 'You don’t have any active medications yet — add one first.'))),
      h('div', null, run),
      result),
  });
}

/* ── List page ───────────────────────────────────────── */
function emptyHero(onAdd) {
  const point = (ic, ink, title, body) => h('div', { class: 'med-empty-point' }, tile(ic, ink, 38), h('div', null, h('b', null, title), h('span', null, body)));
  return card({ class: 'pad-lg' }, h('div', { class: 'med-empty' },
    h('div', null,
      h('span', { class: 'tile ink-teal med-empty-art' }, icon('pill', { size: 36 })),
      h('h2', null, t('თვალი ადევნე მნიშვნელოვან მედიკამენტებს', 'Keep track of the medications that matter')),
      h('p', { class: 'muted' }, t('დაამატე პრეპარატები, დააყენე მიღების დრო და აკონტროლე მიღება ერთ ადგილას — აქაც და MEDICARD აპშიც.', 'Add medications, set dose times and track every dose in one place — here and in the MEDICARD app.')),
      h('div', { style: { marginTop: '20px' } }, button(t('პირველი მედიკამენტის დამატება', 'Add your first medication'), { icon: 'plus', size: 'lg', onClick: onAdd }))),
    h('div', { class: 'med-empty-points' },
      point('clock', 'amber', t('დღის გრაფიკი', 'Daily schedule'), t('ყოველი დოზა თავის დროზე — ერთი დაჭერით მონიშნავ მიღებას.', 'Every dose on time — mark it taken with one tap.')),
      point('activity', 'teal', t('მიღების სტატისტიკა', 'Dose stats'), t('ნახე, რამდენად რეგულარულად იღებ — კვირის და თვის ჭრილში.', 'See how regularly you take them — by week and by month.')),
      point('shield', 'violet', t('ურთიერთქმედების შემოწმება', 'Interaction check'), t('Medi გადაამოწმებს, როგორ ერგება შენი წამლები ერთმანეთს.', 'Medi checks how your medications work together.')),
      point('bell', 'rose', t('შეხსენებები აპში', 'Reminders in the app'), t('შეტყობინებებს MEDICARD აპი გამოგიგზავნის შენს ტელეფონზე.', 'The MEDICARD app sends notifications to your phone.')))));
}

function timelineCard(bundle, rerender, onAdd) {
  const sum = todaySummary(bundle);
  if (!sum.total) {
    return card(empty(t('დღეს მიღება არ გაქვს', 'No doses today'), bundle.medications.some((m) => m.active) ? t('შენი მედიკამენტები სხვა დღეებზეა დაგეგმილი.', 'Your medications are scheduled for other days.') : t('ყველა მედიკამენტი შეჩერებულია.', 'All medications are paused.'), button(t('დამატება', 'Add'), { variant: 'ghost', icon: 'plus', onClick: onAdd })));
  }
  const slots = new Map();
  for (const d of sum.doses) { if (!slots.has(d.time)) slots.set(d.time, []); slots.get(d.time).push(d); }
  const worst = (list) => ['due', 'missed', 'upcoming', 'skipped', 'taken'].find((s) => list.some((d) => d.status === s));
  return card(h('div', { class: 'med-timeline' }, [...slots.entries()].map(([time, list]) => h('div', { class: 'med-slot' },
    h('div', { class: 'med-slot-time' }, h('b', null, time), h('span', { class: `med-dot ${worst(list)}` })),
    h('div', { class: 'med-slot-doses' }, list.map((d) => {
      const cfg = parseConfig(d.med.config);
      const meal = cfg.mealTiming && cfg.mealTiming !== 'any' ? MEAL_LABELS[cfg.mealTiming] : null;
      return h('div', { class: `med-dose ${d.status === 'taken' || d.status === 'skipped' ? 'done' : ''}` },
        pillBadge(cfg.pillColor, 38),
        h('div', { class: 'med-dose-main' },
          h('a', { href: `/medications/${d.med.id}`, 'data-link': '' }, h('div', { class: 'med-dose-title' }, d.med.medName)),
          h('div', { class: 'med-dose-sub' }, [d.movedTo ? t(`გადატანილია ${d.movedTo}-ზე`, `Moved to ${d.movedTo}`) : null, d.med.dosage, meal, d.status === 'missed' ? t('გაცდენილი', 'Missed') : d.status === 'due' ? t('ახლა დროა', 'Time to take') : null].filter(Boolean).join(' · '))),
        doseButtons(bundle, d, rerender));
    }))))));
}

function spotlight(bundle) {
  const sum = todaySummary(bundle);
  const title = sum.total === 0 ? t('დღეს მიღება დაგეგმილი არ არის', 'No doses planned for today') : sum.open.length === 0 ? t('ყველა დოზა მიღებულია', 'All doses taken') : t(`${sum.taken}/${sum.total} მიღებული`, `${sum.taken}/${sum.total} taken`);
  const body = sum.total === 0 ? t('დაამატე პრეპარატები და მიიღე შეხსენებები', 'Add medications and get reminders') : sum.next ? t(`შემდეგი ${sum.next.time} · ${sum.next.med.medName}`, `Next ${sum.next.time} · ${sum.next.med.medName}`) : t('დღევანდელი გრაფიკი შესრულებულია.', 'Today’s schedule is done.');
  return card({ class: 'spotlight med-hero' },
    ring({ value: sum.taken, max: sum.total || 1, size: 84, stroke: 8, color: '#99F6E4', track: 'rgba(255,255,255,.16)', label: sum.total ? `${sum.taken}/${sum.total}` : '—', labelScale: 0.22 }),
    h('div', { style: { minWidth: 0 } }, h('h3', null, title), h('p', { class: 'muted' }, body)));
}

function statsCard(bundle) {
  if (!bundle.logsOk) {
    return card(h('div', { class: 'hstack', style: { gap: '12px' } }, icon('info', { size: 18 }), h('p', { class: 'muted' }, t('მიღების ისტორია ახლა ვერ ჩაიტვირთა. სცადე გვერდის განახლება.', 'Couldn’t load your dose history right now. Try refreshing the page.'))));
  }
  const now = new Date();
  const w = sumAdherence(history(bundle, 7, now));
  const m = sumAdherence(history(bundle, 30, now));
  const answered = m.taken + m.skipped;
  const ringFor = (a, cap, color) => h('div', null,
    ring({ value: a.pct ?? 0, max: 100, size: 118, stroke: 11, color, label: a.pct == null ? '—' : `${a.pct}%`, sub: a.planned ? `${a.taken}/${a.planned}` : t('მონაცემი არაა', 'No data') }),
    h('div', { class: 'med-ring-cap' }, cap));
  return card(
    h('div', { class: 'med-rings' }, ringFor(w, t('ბოლო 7 დღე', 'Last 7 days'), 'var(--brand)'), ringFor(m, t('ბოლო 30 დღე', 'Last 30 days'), 'var(--c2)')),
    h('div', { class: 'med-mini-stats' },
      stat(t('სერია', 'Streak'), String(streak(bundle, now)), { unit: t('დღე', 'days'), icon: 'flame' }),
      stat(t('დროულად', 'On time'), answered ? `${pct(m.taken, answered)}` : '—', { unit: answered ? '%' : '', icon: 'check' }),
      stat(t('აქტიური', 'Active'), String(bundle.medications.filter((x) => x.active).length), { icon: 'pill' })),
    h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '14px' } }, t('ითვლება მხოლოდ მონიშნული მიღებები — აქ ან აპში. დაგეგმილი, მაგრამ უპასუხო დოზა გაცდენილად ითვლება.', 'Only doses you mark count — here or in the app. A planned dose left unanswered counts as missed.')));
}

let trendDays = 14; // kept across re-renders
function trendCard(bundle, medId = null) {
  let days = trendDays;
  const chartBox = h('div');
  const legend = h('div', { class: 'legend med-legend' },
    h('span', null, h('i', { style: { background: 'var(--ok)' } }), t('მიღებული', 'Taken')),
    h('span', null, h('i', { style: { background: 'var(--warn)' } }), t('გამოტოვებული', 'Skipped')),
    h('span', null, h('i', { style: { background: MISSED_FILL } }), t('გაცდენილი', 'Missed')));
  const draw = () => {
    const rows = history(bundle, days, new Date(), medId);
    if (!rows.some((r) => r.planned)) {
      mount(chartBox, empty(t('ჯერ მონაცემი არაა', 'No data yet'), t('მონიშნე მიღებები და აქ დღიური დინამიკა გამოჩნდება.', 'Mark your doses and the daily trend will appear here.')));
      return;
    }
    mount(chartBox, barChart({
      labels: rows.map((r) => shortDay(r.date)),
      tipLabels: rows.map((r) => `${fmtDate(r.date)} · ${r.planned ? `${pct(r.taken, r.planned)}%` : t('გეგმა არ იყო', 'Nothing planned')}`),
      stacked: [
        { name: t('მიღებული', 'Taken'), values: rows.map((r) => r.taken), color: 'var(--ok)' },
        { name: t('გამოტოვებული', 'Skipped'), values: rows.map((r) => r.skipped), color: 'var(--warn)' },
        { name: t('გაცდენილი', 'Missed'), values: rows.map((r) => r.missed), color: MISSED_FILL },
      ],
      height: 220,
      fmt: (v) => String(Math.round(v)),
    }));
  };
  draw();
  return card(
    h('div', { class: 'card-head' },
      h('div', null, h('div', { class: 'card-title' }, t('დოზები დღეების მიხედვით', 'Doses by day')), h('div', { class: 'card-sub' }, t('მიღებული, გამოტოვებული და გაცდენილი', 'Taken, skipped and missed'))),
      segmented([{ value: 14, label: t('14 დღე', '14 days') }, { value: 30, label: t('30 დღე', '30 days') }], days, (v) => { days = v; trendDays = v; draw(); })),
    chartBox, legend);
}

function heatCard(bundle) {
  const now = new Date();
  const rows = history(bundle, 12 * 7 + 7, now);
  const data = rows.filter((r) => r.planned).map((r) => ({ date: r.date, value: pct(r.taken, r.planned), label: `${fmtDate(r.date)} · ${r.taken}/${r.planned}` }));
  return card(
    h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('ბოლო 12 კვირა', 'Last 12 weeks')), h('div', { class: 'card-sub' }, t('რაც უფრო მუქია, მით მეტი დოზაა მიღებული', 'The darker the square, the more doses taken')))),
    data.length ? heatmap({ days: data, weeks: 12, max: 100, fmt: (v) => `${v}%` }) : h('p', { class: 'muted' }, t('ისტორია ჯერ ცარიელია.', 'No history yet.')));
}

function medCard(med, reload) {
  const cfg = parseConfig(med.config);
  const times = parseTimes(med.frequency);
  const refill = cfg.remainingCount != null
    ? badge(t(`${cfg.remainingCount} დარჩა`, `${cfg.remainingCount} left`), cfg.refillReminder && cfg.remainingCount <= (cfg.refillThreshold ?? 12) ? 'warn' : 'neutral')
    : null;
  const tog = toggle(med.active, (v) => setActive(med, v, reload), null);
  tog.title = med.active ? t('შეჩერება', 'Pause') : t('განახლება', 'Resume');
  tog.setAttribute('aria-label', `${med.medName}: ${med.active ? t('აქტიური', 'active') : t('შეჩერებული', 'paused')}`);
  return card({ class: `hover med-card ${med.active ? '' : 'paused'}` },
    h('div', { class: 'med-card-top' },
      h('a', { href: `/medications/${med.id}`, 'data-link': '' },
        pillBadge(cfg.pillColor, 46),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'med-card-name' }, med.medName), h('div', { class: 'med-card-sub' }, knownAs(med) || med.dosage))),
      tog),
    h('div', { class: 'med-times' }, times.map((t) => h('span', { class: 'med-time-chip' }, t))),
    h('div', { class: 'med-card-foot' },
      h('span', null, daysSummary(cfg.daysOfWeek).length > 40 ? t(`${cfg.daysOfWeek.length} დღე კვირაში`, `${cfg.daysOfWeek.length} days a week`) : daysSummary(cfg.daysOfWeek), cfg.endDate ? t(` · ${fmtDate(cfg.endDate, { short: true })}-მდე`, ` · until ${fmtDate(cfg.endDate, { short: true })}`) : ''),
      refill || (med.active ? null : badge(t('შეჩერებული', 'Paused'), 'neutral'))));
}

async function listPage(root, ctx) {
  const addBtn = button(t('დამატება', 'Add'), { icon: 'plus' });
  const interBtn = button(t('ურთიერთქმედება', 'Interactions'), { icon: 'shield', variant: 'ghost' });
  const body = h('div');
  mount(root, pageHead(wordmark('pill'), t('მედიკამენტები · დღის გრაფიკი, მიღების სტატისტიკა და ურთიერთქმედება', 'Medications · daily schedule, dose stats and interactions'), interBtn, addBtn), body);
  let bundle = null;
  const onAdd = () => openMedForm(null, () => reload());
  addBtn.addEventListener('click', onAdd);
  interBtn.addEventListener('click', () => bundle && openInteraction(bundle));

  const render = () => {
    if (!bundle.medications.length) {
      interBtn.hidden = true;
      mount(body, emptyHero(onAdd));
      return;
    }
    interBtn.hidden = false;
    const active = bundle.medications.filter((m) => m.active);
    const paused = bundle.medications.filter((m) => !m.active);
    mount(body,
      h('div', { class: 'grid grid-main' },
        h('div', null,
          section(t('დღევანდელი გრაფიკი', 'Today’s schedule'), h('div', { class: 'stack', style: { gap: '12px' } }, spotlight(bundle), timelineCard(bundle, render, onAdd)))),
        h('div', null,
          section(t('მიღების სტატისტიკა', 'Dose stats'), statsCard(bundle)),
          bundle.logsOk ? section(t('აქტივობის რუკა', 'Activity map'), heatCard(bundle)) : null)),
      bundle.logsOk ? section(t('დინამიკა', 'Trend'), trendCard(bundle)) : null,
      section(t('ჩემი მედიკამენტები', 'My medications'), active.length
        ? h('div', { class: 'grid grid-auto' }, active.map((m) => medCard(m, reload)))
        : card(h('p', { class: 'muted' }, t('აქტიური მედიკამენტი არ გაქვს — ჩართე შეჩერებული ან დაამატე ახალი.', 'You have no active medications — resume a paused one or add a new one.'))),
      { action: button(t('დამატება', 'Add'), { size: 'sm', variant: 'ghost', icon: 'plus', onClick: onAdd }) }),
      paused.length ? section(t('შეჩერებული', 'Paused'), h('div', { class: 'grid grid-auto' }, paused.map((m) => medCard(m, reload)))) : null,
      section(null, card({ class: 'hover' }, h('div', { class: 'hstack', style: { gap: '16px', alignItems: 'center', flexWrap: 'wrap' } },
        tile('shield', 'violet', 46),
        h('div', { style: { flex: 1, minWidth: '200px' } },
          h('div', { class: 'card-title' }, t('მედიკამენტების ურთიერთქმედება', 'Medication interactions')),
          h('div', { class: 'card-sub' }, t('შეამოწმე, როგორ ურთიერთქმედებს შენი მედიკამენტები ერთმანეთთან.', 'Check how your medications interact with each other.'))),
        button(t('შემოწმება', 'Check'), { variant: 'secondary', icon: 'arrowRight', onClick: () => openInteraction(bundle) })))),
      h('p', { class: 'disclaimer' }, icon('bell', { size: 14 }),
        h('span', null, t('მიღების შეხსენებებს ტელეფონზე MEDICARD აპი გამოგიგზავნის. ', 'The MEDICARD app sends dose reminders to your phone. '), h('a', { class: 'link', href: APP_STORE, target: '_blank', rel: 'noopener' }, t('ჩამოტვირთე აპი', 'Download the app')))));
  };

  async function reload() {
    try {
      bundle = await loadMeds();
      render();
    } catch (e) {
      mount(body, errorBox(e, () => { mount(body, skeletonPage()); reload(); }));
    }
  }

  mount(body, skeletonPage());
  await reload();
  if (ctx.query?.add === '1') {
    history_replace('/medications');
    onAdd();
  }

  // Keep "due / missed" honest while the tab stays open.
  const timer = setInterval(() => { if (bundle && !document.hidden && !document.querySelector('.modal-wrap')) render(); }, 60_000);
  return () => clearInterval(timer);
}

function history_replace(path) {
  try { window.history.replaceState({}, '', `/app${path}`); } catch { /* ignore */ }
}

function skeletonPage() {
  return h('div', { class: 'grid grid-main' }, h('div', { class: 'stack', style: { gap: '12px' } }, skeleton(3), skeleton(5)), h('div', null, skeleton(5)));
}

/* ── Detail page ─────────────────────────────────────── */
async function detailPage(root, ctx) {
  const id = ctx.params.id;
  const body = h('div');
  mount(root, h('a', { class: 'back', href: '/medications', 'data-link': '' }, icon('chevronLeft', { size: 16 }), t('მედიკამენტები', 'Medications')), body);
  let bundle = null;

  const render = () => {
    const med = bundle.medications.find((m) => m.id === id);
    if (!med) {
      mount(body, card(empty(t('მედიკამენტი ვერ მოიძებნა', 'Medication not found'), t('შესაძლოა წაიშალა ან სხვა ანგარიშს ეკუთვნის.', 'It may have been deleted or belong to another account.'), button(t('მედიკამენტებზე დაბრუნება', 'Back to medications'), { href: '/medications' }))));
      return;
    }
    ctx.setTitle(med.medName);
    const cfg = parseConfig(med.config);
    const now = new Date();
    const today = ymd(now);
    const todays = dosesForDate(bundle, today, now, id);
    const h30 = history(bundle, 30, now, id);
    const a30 = sumAdherence(h30);
    const a7 = sumAdherence(h30.slice(-7));

    const editBtn = button(t('რედაქტირება', 'Edit'), { icon: 'edit', variant: 'ghost', onClick: () => openMedForm(med, () => reload()) });
    const pauseBtn = button(med.active ? t('შეჩერება', 'Pause') : t('განახლება', 'Resume'), { icon: med.active ? 'pause' : 'play', variant: 'ghost' });
    pauseBtn.addEventListener('click', () => busy(pauseBtn, () => setActive(med, !med.active, reload)));
    const delBtn = iconButton('trash', { title: t('წაშლა განრიგიდან', 'Remove from schedule'), onClick: () => removeMed(med, () => ctx.navigate('/medications')) });

    const info = [
      ['pill', 'teal', t('რაოდენობა ერთ მიღებაზე', 'Amount per dose'), `${cfg.amount ?? 1} ${FORM_LABELS[cfg.form || 'pills']}`],
      cfg.strength ? ['zap', 'sky', t('სიძლიერე', 'Strength'), cfg.strength] : null,
      ['clock', 'amber', t('მიღების დრო', 'Dose time'), parseTimes(med.frequency).join(', ')],
      ['calendar', 'blue', t('მიღების დღეები', 'Dose days'), daysSummary(cfg.daysOfWeek)],
      cfg.startDate || cfg.endDate ? ['calendarCheck', 'violet', t('კურსი', 'Course'), `${cfg.startDate ? fmtDate(cfg.startDate) : '…'} – ${cfg.endDate ? fmtDate(cfg.endDate) : '…'}`] : null,
      cfg.mealTiming && cfg.mealTiming !== 'any' ? ['utensils', 'amber', t('ჭამასთან', 'With food'), MEAL_LABELS[cfg.mealTiming]] : null,
      cfg.remainingCount != null ? ['folder', 'sky', t('დარჩენილი', 'Left'), t(`${cfg.remainingCount} დარჩა`, `${cfg.remainingCount} left`)] : null,
      ['bell', 'rose', t('შევსების შეხსენება', 'Refill reminder'), cfg.refillReminder ? t(`კი · ზღვარი ${cfg.refillThreshold ?? 12}`, `Yes · at ${cfg.refillThreshold ?? 12}`) : t('არა', 'No')],
      med.notes ? ['file', 'neutral', t('შენიშვნა', 'Note'), med.notes] : null,
      ['plus', 'green', t('დამატებულია', 'Added'), fmtDate(med.createdAt)],
    ].filter(Boolean);

    const logged = [];
    for (let i = 0; i < 30; i++) {
      const date = ymd(addDays(now, -i));
      const ds = dosesForDate(bundle, date, now, id).filter((d) => d.status !== 'upcoming' && d.status !== 'due');
      if (ds.length) logged.push({ date, ds });
    }

    mount(body,
      pageHead(med.medName, knownAs(med) || med.dosage, editBtn, pauseBtn, delBtn),
      h('div', { class: 'grid grid-main' },
        h('div', null,
          section(t('დღეს', 'Today'), card(
            h('div', { class: 'med-detail-hero', style: { marginBottom: todays.length ? '16px' : 0 } },
              pillBadge(cfg.pillColor, 64),
              h('div', { style: { minWidth: 0, flex: 1 } },
                h('div', { class: 'hstack', style: { gap: '8px', flexWrap: 'wrap' } },
                  med.active ? badge(t('აქტიური', 'Active'), 'ok') : badge(t('შეჩერებული', 'Paused'), 'neutral'),
                  cfg.mealTiming && cfg.mealTiming !== 'any' ? badge(MEAL_LABELS[cfg.mealTiming], 'warn') : null),
                h('p', { class: 'muted', style: { marginTop: '6px' } }, scheduleLine(med)))),
            todays.length
              ? h('div', { class: 'stack', style: { gap: '8px' } }, todays.map((d) => h('div', { class: `med-dose ${d.status === 'taken' || d.status === 'skipped' ? 'done' : ''}` },
                h('span', { class: `med-dot ${d.status}`, style: { boxShadow: 'none' } }),
                h('div', { class: 'med-dose-main' }, h('div', { class: 'med-dose-title' }, d.time), h('div', { class: 'med-dose-sub' }, STATUS[d.status].label)),
                doseButtons(bundle, d, render))))
              : h('p', { class: 'muted' }, med.active ? t('დღეს ამ მედიკამენტის მიღება დაგეგმილი არ არის.', 'No doses of this medication planned for today.') : t('მედიკამენტი შეჩერებულია — განაახლე, რომ გრაფიკში დაბრუნდეს.', 'This medication is paused — resume it to bring it back to your schedule.')))),
          bundle.logsOk ? section(t('დინამიკა', 'Trend'), trendCard(bundle, id)) : null,
          section(t('მიღების ისტორია', 'Dose history'), card(logged.length
            ? h('div', null, logged.map(({ date, ds }) => h('div', { class: 'med-history-day' },
              h('div', { class: 'med-history-date' }, relDayShort(date), h('span', null, KA_DAYS_SHORT[parseDate(date).getDay()])),
              h('div', { class: 'med-history-items' }, ds.map((d) => badge(`${d.time} · ${STATUS[d.status].label}`, STATUS[d.status].tone))))))
            : empty(t('ისტორია ჯერ ცარიელია', 'No history yet'), t('როცა მიღებას მონიშნავ, აქ გამოჩნდება.', 'Doses you mark will appear here.'))))),
        h('div', null,
          bundle.logsOk ? section(t('მიღება', 'Adherence'), card(
            h('div', { class: 'med-rings' },
              h('div', null, ring({ value: a30.pct ?? 0, max: 100, size: 128, stroke: 12, label: a30.pct == null ? '—' : `${a30.pct}%`, sub: a30.planned ? `${a30.taken}/${a30.planned}` : t('მონაცემი არაა', 'No data') }), h('div', { class: 'med-ring-cap' }, t('ბოლო 30 დღე', 'Last 30 days')))),
            h('div', { class: 'med-mini-stats' },
              stat(t('7 დღე', '7 days'), a7.pct == null ? '—' : String(a7.pct), { unit: a7.pct == null ? '' : '%' }),
              stat(t('სერია', 'Streak'), String(streak(bundle, now, id)), { unit: t('დღე', 'days') }),
              stat(t('გაცდენილი', 'Missed'), String(a30.missed), { unit: t('30დ', '30d') })))) : null,
          section(t('დეტალები', 'Details'), card({ class: 'flush' }, h('div', { class: 'list med-info', style: { padding: '6px 12px' } },
            info.map(([ic, ink, label, value]) => h('div', { class: 'row' }, tile(ic, ink, 36),
              h('div', { class: 'row-main' }, h('div', { class: 'row-sub', style: { marginTop: 0 } }, label), h('div', { class: 'row-title', style: { whiteSpace: 'normal' } }, value))))))),
          section(null, card({ class: 'hover' }, h('div', { class: 'feature' },
            tile('shield', 'violet', 42),
            h('h3', null, t('ურთიერთქმედების შემოწმება', 'Interaction check')),
            h('p', null, t('Medi გადაამოწმებს ამ და შენს სხვა აქტიურ მედიკამენტებს ერთად.', 'Medi checks this medication together with your other active ones.')),
            button(t('შემოწმება', 'Check'), { variant: 'secondary', size: 'sm', icon: 'arrowRight', onClick: () => openInteraction(bundle) })))))));
  };

  async function reload() {
    try {
      bundle = await loadMeds();
      render();
    } catch (e) {
      mount(body, errorBox(e, () => { mount(body, skeletonPage()); reload(); }));
    }
  }

  mount(body, skeletonPage());
  await reload();
  const timer = setInterval(() => { if (bundle && !document.hidden && !document.querySelector('.modal-wrap')) render(); }, 60_000);
  return () => clearInterval(timer);
}

function relDayShort(date) {
  const diff = Math.round((parseDate(ymd()) - parseDate(date)) / 86400000);
  if (diff === 0) return t('დღეს', 'Today');
  if (diff === 1) return t('გუშინ', 'Yesterday');
  return fmtDate(date, { short: true });
}

/* ── Entry ───────────────────────────────────────────── */
export default async function medicationsPage(root, ctx) {
  ensureCss();
  return ctx.params?.id ? detailPage(root, ctx) : listPage(root, ctx);
}
