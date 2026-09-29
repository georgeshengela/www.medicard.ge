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
import { withAiConsent } from '../aiConsent.js';

const CSS = '/app/css/medications.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

/* ── Constants (same values as the app) ──────────────── */
const FORM_LABELS = { pills: 'ტაბლეტი', capsules: 'კაფსულა', liquid: 'სითხე', injection: 'ინექცია' };
const MEAL_LABELS = { any: 'ნებისმიერ დროს', before: 'ჭამამდე', after: 'ჭამის შემდეგ', with: 'ჭამასთან ერთად' };
const DAY_LETTERS = ['ო', 'ს', 'ო', 'ხ', 'პ', 'შ', 'კ']; // Monday-first, like the app (0 = Monday)
const DAY_FULL = ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა'];
const PILL_COLORS = ['#14B8A6', '#1E3A8A', '#E5E7EB', '#F43F5E', '#F97316', '#22C55E', '#0EA5E9', '#6366F1', '#334155', '#111827'];
const MAX_TIMES = 8; // server: 1–8 doses a day
const DUE_GRACE_MIN = 60; // a dose is "due" for an hour after its time, then "missed"
const STATUS = {
  taken: { label: 'მიღებული', tone: 'ok' },
  skipped: { label: 'გამოტოვებული', tone: 'warn' },
  missed: { label: 'გაცდენილი', tone: 'danger' },
  due: { label: 'ახლა', tone: 'brand' },
  upcoming: { label: 'მოლოდინში', tone: 'neutral' },
};
const APP_STORE = 'https://apps.apple.com/app/id6812517519';

/* ── Pure helpers ────────────────────────────────────── */
export function parseConfig(raw) { return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; }
export function parseTimes(freq) { return String(freq || '').split(',').map((t) => t.trim()).filter(Boolean); }
const dow = (date) => (parseDate(date).getDay() + 6) % 7;
const minutes = (t) => { const [a, b] = String(t).split(':').map(Number); return (a || 0) * 60 + (b || 0); };
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const shortDay = (date) => { const d = parseDate(date); return `${d.getDate()}/${d.getMonth() + 1}`; };

function daysSummary(days) {
  if (!Array.isArray(days) || !days.length || days.length === 7) return 'ყოველდღე';
  return days.slice().sort((a, b) => a - b).map((d) => DAY_FULL[d]).filter(Boolean).join(', ');
}

function scheduleLine(med) {
  const times = parseTimes(med.frequency);
  const n = times.length;
  const per = n === 1 ? 'დღეში ერთხელ' : `დღეში ${n}-ჯერ`;
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
    if (!status) {
      if (date < today) status = 'missed';
      else if (date > today) status = 'upcoming';
      else {
        const m = minutes(d.time);
        status = nowMin < m ? 'upcoming' : nowMin - m <= DUE_GRACE_MIN ? 'due' : 'missed';
      }
    }
    return { ...d, date, status, log };
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
    toast(status === 'taken' ? `${med.medName} — მიღებულია` : `${med.medName} — გამოტოვებულია`, 'ok', {
      ms: 6000,
      action: {
        label: 'დაბრუნება',
        onClick: async () => {
          try {
            const back = await writeDose(med.id, date, time, 'pending');
            if (back.logs) setLogs(bundle, back.logs); else setLogs(bundle, [...bundle.logs, back.entry]);
            rerender();
          } catch (e) { toast(e?.message || 'ვერ დაბრუნდა.', 'error'); }
        },
      },
    });
  } catch (e) {
    toast(e?.message || 'ვერ შეინახა. სცადე ხელახლა.', 'error');
  }
}

function doseButtons(bundle, dose, rerender, opts = {}) {
  if (dose.status === 'taken' || dose.status === 'skipped') {
    return h('div', { class: 'med-dose-actions' }, badge(STATUS[dose.status].label, STATUS[dose.status].tone));
  }
  const take = button(opts.compact ? null : 'მივიღე', { size: 'sm', icon: 'check', ariaLabel: `${dose.med.medName} ${dose.time} — მივიღე` });
  const skip = button(opts.compact ? null : 'გამოვტოვე', { size: 'sm', variant: 'ghost', icon: opts.compact ? 'x' : null, ariaLabel: `${dose.med.medName} ${dose.time} — გამოვტოვე` });
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
          h('div', { class: 'card-title' }, 'მედიკამენტები ჯერ არ დაგიმატებია'),
          h('div', { class: 'card-sub' }, 'დაამატე პრეპარატი და დღის გრაფიკი აქ გამოჩნდება.')),
        button('დამატება', { icon: 'plus', size: 'sm', href: '/medications?add=1' })));
      return;
    }
    const t = todaySummary(bundle, now);
    const upcoming = t.open.filter((d) => d.status !== 'missed').slice(0, 3);
    const missedCount = t.open.filter((d) => d.status === 'missed').length;
    const list = upcoming.length ? upcoming : t.open.slice(0, 2);
    mount(box,
      h('div', { class: 'hstack', style: { gap: '16px', alignItems: 'center' } },
        ring({ value: t.taken, max: t.total || 1, size: 74, stroke: 8, label: t.total ? `${t.taken}/${t.total}` : '—', labelScale: 0.22 }),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { class: 'card-title' }, t.total === 0 ? 'დღეს მიღება დაგეგმილი არ არის' : t.open.length === 0 ? 'ყველა დოზა მიღებულია' : `${t.taken}/${t.total} მიღებული`),
          h('div', { class: 'card-sub' }, t.next ? `შემდეგი ${t.next.time} · ${t.next.med.medName}` : t.total ? 'კარგი დღეა — ასე გააგრძელე.' : 'შენი მედიკამენტები სხვა დღეებზეა.'),
          missedCount ? h('div', { style: { marginTop: '6px' } }, badge(`${missedCount} გაცდენილი`, 'danger')) : null)),
      list.length ? h('div', { class: 'stack', style: { gap: '8px', marginTop: '16px' } }, list.map((d) => h('div', { class: 'med-dose' },
        pillBadge(parseConfig(d.med.config).pillColor, 36),
        h('div', { class: 'med-dose-main' },
          h('div', { class: 'med-dose-title' }, d.med.medName),
          h('div', { class: 'med-dose-sub' }, `${d.time} · ${d.med.dosage}`)),
        doseButtons(bundle, d, render, { noSkip: true })))) : null,
      h('div', { style: { marginTop: '14px' } }, h('a', { class: 'link', href: '/medications', 'data-link': '' }, 'დღის გრაფიკი', icon('chevronRight', { size: 16 }))));
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
  const countSel = select(Array.from({ length: MAX_TIMES }, (_, i) => ({ value: i + 1, label: i === 0 ? 'დღეში ერთხელ' : `დღეში ${i + 1}-ჯერ` })), times.length, { name: 'timesPerDay' });
  const renderTimes = () => {
    mount(timesBox, times.map((t, i) => input({ type: 'time', value: t, required: true, 'aria-label': `მიღების დრო ${i + 1}`, onInput: (e) => { times[i] = e.target.value; } })));
  };
  countSel.addEventListener('change', () => {
    const n = Number(countSel.value);
    const defs = defaultTimes(n);
    times = defs.map((t, i) => times[i] ?? t);
    renderTimes();
  });
  renderTimes();

  const daysSummaryEl = h('div', { class: 'med-form-sub' });
  const daysBox = h('div', { class: 'med-days', role: 'group', 'aria-label': 'მიღების დღეები' });
  const renderDays = () => {
    mount(daysBox, DAY_LETTERS.map((l, i) => h('button', {
      type: 'button', class: `med-day ${days.includes(i) ? 'on' : ''}`, title: DAY_FULL[i], 'aria-label': DAY_FULL[i], 'aria-pressed': days.includes(i) ? 'true' : 'false',
      onClick: () => { days = days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b); renderDays(); },
    }, l)));
    daysSummaryEl.textContent = days.length ? daysSummary(days) : 'აირჩიე მინიმუმ ერთი დღე';
  };
  renderDays();

  const colorsBox = h('div', { class: 'med-colors', role: 'radiogroup', 'aria-label': 'ფერი' });
  const renderColors = () => mount(colorsBox, PILL_COLORS.map((c) => h('button', {
    type: 'button', class: `med-color ${c === color ? 'on' : ''}`, role: 'radio', 'aria-checked': c === color ? 'true' : 'false', 'aria-label': c,
    onClick: () => { color = c; renderColors(); },
  }, h('span', { style: { background: c } }))));
  renderColors();

  const refillFields = h('div', { class: 'form-row' },
    field('შევსების ზღვარი', input({ name: 'refillThreshold', type: 'number', min: 1, max: 999, value: cfg.refillThreshold ?? 12 }), 'შეგახსენებ, როცა დარჩენილი ამ რაოდენობას მიაღწევს'),
    field('დარჩენილი რაოდენობა', input({ name: 'remainingCount', type: 'number', min: 0, max: 9999, value: cfg.remainingCount ?? '', placeholder: 'არასავალდებულო' })));
  refillFields.hidden = !refillOn;

  const startIn = input({ name: 'startDate', type: 'date', value: cfg.startDate || today, required: true });
  const endIn = input({ name: 'endDate', type: 'date', value: cfg.endDate || ymd(addDays(parseDate(cfg.startDate || today), 365)) });
  startIn.addEventListener('change', () => { if (endIn.value && endIn.value < startIn.value) endIn.value = ymd(addDays(parseDate(startIn.value), 365)); endIn.min = startIn.value; });
  endIn.min = startIn.value;

  const fields = () => h('div', { class: 'stack', style: { gap: '16px' } },
    field('დასახელება', input({ name: 'medName', required: true, minlength: 2, maxlength: 120, value: existing?.medName || '', placeholder: 'მაგ. ამოქსიცილინი', autocomplete: 'off' })),
    h('div', { class: 'form-row' },
      field('რაოდენობა ერთ მიღებაზე', input({ name: 'amount', type: 'number', min: 0.25, max: 100, step: 0.25, required: true, value: cfg.amount ?? 1 }), 'ერთ ჯერზე — არა მთლიანი შეკვრა'),
      field('ფორმა', select(Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label })), cfg.form || 'pills', { name: 'form' }))),
    h('div', { class: 'form-row' },
      field('სიძლიერე', input({ name: 'strength', maxlength: 40, value: cfg.strength || '', placeholder: 'მაგ. 500 მგ' })),
      field('ჭამასთან', select(Object.entries(MEAL_LABELS).map(([value, label]) => ({ value, label })), cfg.mealTiming || 'any', { name: 'mealTiming' }))),
    field('სიხშირე', countSel),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'მიღების დრო'), timesBox),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'მიღების დღეები'), daysBox, daysSummaryEl),
    h('div', { class: 'form-row' }, field('დაწყების თარიღი', startIn), field('დასრულების თარიღი', endIn)),
    h('div', { class: 'field' },
      toggle(refillOn, (v) => { refillOn = v; refillFields.hidden = !v; }, 'შევსების შეხსენება'),
      h('span', { class: 'field-hint' }, 'შეხსენებას MEDICARD აპი გამოგიგზავნის.')),
    refillFields,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'ფერი'), colorsBox),
    field('შენიშვნა', textarea({ name: 'notes', maxlength: 300, rows: 2, value: existing?.notes || '', placeholder: 'მაგ. ჭამის შემდეგ, უხვი წყლით' })));

  formModal({
    title: existing ? 'მედიკამენტის რედაქტირება' : 'მედიკამენტის დამატება',
    size: 'md',
    submit: existing ? 'შენახვა' : 'დამატება',
    fields,
    onSubmit: async (v, close) => {
      const medName = String(v.medName || '').trim();
      if (medName.length < 2) throw new Error('მიუთითე მედიკამენტის დასახელება');
      const amount = Number(v.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('მიუთითე რაოდენობა');
      const clean = times.map((t) => String(t || '').slice(0, 5));
      if (clean.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new Error('დრო უნდა იყოს ფორმატში 09:00');
      const unique = [...new Set(clean)].sort();
      if (unique.length !== clean.length) throw new Error('მიღების დროები არ უნდა მეორდებოდეს');
      if (!days.length) throw new Error('აირჩიე მინიმუმ ერთი დღე');
      if (!v.startDate) throw new Error('მიუთითე დაწყების თარიღი');
      if (v.endDate && v.endDate < v.startDate) throw new Error('დასრულების თარიღი ვერ იქნება დაწყების თარიღზე ადრე');
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
      toast(existing ? 'ცვლილებები შენახულია' : `${medName} დაემატა`, 'ok');
      onSaved?.(res?.medication);
    },
  });
}

async function setActive(med, active, onDone) {
  try {
    await patch(`/api/medications/${med.id}`, { active });
    toast(active ? `${med.medName} — განახლდა` : `${med.medName} — შეჩერდა`, 'ok');
  } catch (e) { toast(e?.message || 'ვერ შეიცვალა.', 'error'); }
  onDone?.();
}

async function removeMed(med, onDone) {
  const ok = await confirmDialog({ title: 'წაშლა განრიგიდან', body: `ნამდვილად გსურს „${med.medName}“-ის წაშლა? მიღების ისტორია სტატისტიკიდანაც გაქრება.`, confirm: 'წაშლა', danger: true });
  if (!ok) return;
  try {
    await del(`/api/medications/${med.id}`);
    toast('მედიკამენტი წაიშალა', 'ok');
    onDone?.();
  } catch (e) { toast(e?.message || 'ვერ წაიშალა.', 'error'); }
}

/* ── Interaction check (AI: Medi reviews the active list) ── */
function openInteraction(bundle) {
  const active = bundle.medications.filter((m) => m.active);
  const result = h('div');
  const run = button('შეამოწმე ურთიერთქმედებები', { icon: 'shield', disabled: active.length === 0 });
  run.addEventListener('click', () => busy(run, async () => {
    mount(result, skeleton(4));
    try {
      const res = await withAiConsent(() => post('/api/ai/medication-review', {}, { timeoutMs: 120_000 }));
      if (res?.declined) { clear(result); return; }
      mount(result,
        h('div', { class: 'hub-section-head', style: { marginTop: '8px' } }, h('h2', { style: { fontSize: '16px' } }, 'Medi-ს დასკვნა')),
        h('div', { class: 'card', style: { background: 'var(--bg)' } }, markdown(res?.analysis || '')),
        h('p', { class: 'disclaimer' }, icon('info', { size: 14 }),
          'მიმოხილვა AI-ით (Medi) არის შექმნილი შენი წამლების სიიდან — შეიძლება რამე გამოტოვოს და ეს დიაგნოზი ან დანიშნულება არ არის. წამლის შეცვლამდე ჰკითხე ექიმს ან ფარმაცევტს.'));
    } catch (e) {
      mount(result, errorBox(e instanceof ApiError ? e : new Error(e?.message || 'შემოწმება ვერ შესრულდა.')));
    }
  }));
  openModal({
    title: 'მედიკამენტების ურთიერთქმედება',
    size: 'lg',
    body: h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'hstack', style: { gap: '14px', alignItems: 'flex-start' } },
        tile('shield', 'violet', 46),
        h('p', { class: 'muted', style: { flex: 1 } }, 'Medi შენს აქტიურ მედიკამენტებს შესაძლო ურთიერთქმედებებისა და რისკების გამოსავლენად გადაამოწმებს. ეს უსაფრთხოებას არ ადასტურებს — საბოლოო სიტყვა ექიმისაა.')),
      h('div', null,
        h('div', { class: 'field-label', style: { marginBottom: '8px' } }, 'შემოწმდება'),
        active.length
          ? h('div', { class: 'chips' }, active.map((m) => h('span', { class: 'chip' }, m.medName)))
          : h('p', { class: 'muted' }, 'აქტიური მედიკამენტები ჯერ არ გაქვს — ჯერ დაამატე.')),
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
      h('h2', null, 'თვალი ადევნე მნიშვნელოვან მედიკამენტებს'),
      h('p', { class: 'muted' }, 'დაამატე პრეპარატები, დააყენე მიღების დრო და აკონტროლე მიღება ერთ ადგილას — აქაც და MEDICARD აპშიც.'),
      h('div', { style: { marginTop: '20px' } }, button('პირველი მედიკამენტის დამატება', { icon: 'plus', size: 'lg', onClick: onAdd }))),
    h('div', { class: 'med-empty-points' },
      point('clock', 'amber', 'დღის გრაფიკი', 'ყოველი დოზა თავის დროზე — ერთი დაჭერით მონიშნავ მიღებას.'),
      point('activity', 'teal', 'მიღების სტატისტიკა', 'ნახე, რამდენად რეგულარულად იღებ — კვირის და თვის ჭრილში.'),
      point('shield', 'violet', 'ურთიერთქმედების შემოწმება', 'Medi გადაამოწმებს, როგორ ერგება შენი წამლები ერთმანეთს.'),
      point('bell', 'rose', 'შეხსენებები აპში', 'შეტყობინებებს MEDICARD აპი გამოგიგზავნის შენს ტელეფონზე.'))));
}

function timelineCard(bundle, rerender, onAdd) {
  const t = todaySummary(bundle);
  if (!t.total) {
    return card(empty('დღეს მიღება არ გაქვს', bundle.medications.some((m) => m.active) ? 'შენი მედიკამენტები სხვა დღეებზეა დაგეგმილი.' : 'ყველა მედიკამენტი შეჩერებულია.', button('დამატება', { variant: 'ghost', icon: 'plus', onClick: onAdd })));
  }
  const slots = new Map();
  for (const d of t.doses) { if (!slots.has(d.time)) slots.set(d.time, []); slots.get(d.time).push(d); }
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
          h('div', { class: 'med-dose-sub' }, [d.med.dosage, meal, d.status === 'missed' ? 'გაცდენილი' : d.status === 'due' ? 'ახლა დროა' : null].filter(Boolean).join(' · '))),
        doseButtons(bundle, d, rerender));
    }))))));
}

function spotlight(bundle) {
  const t = todaySummary(bundle);
  const title = t.total === 0 ? 'დღეს მიღება დაგეგმილი არ არის' : t.open.length === 0 ? 'ყველა დოზა მიღებულია' : `${t.taken}/${t.total} მიღებული`;
  const body = t.total === 0 ? 'დაამატე პრეპარატები და მიიღე შეხსენებები' : t.next ? `შემდეგი ${t.next.time} · ${t.next.med.medName}` : 'დღევანდელი გრაფიკი შესრულებულია.';
  return card({ class: 'spotlight med-hero' },
    ring({ value: t.taken, max: t.total || 1, size: 84, stroke: 8, color: '#99F6E4', track: 'rgba(255,255,255,.16)', label: t.total ? `${t.taken}/${t.total}` : '—', labelScale: 0.22 }),
    h('div', { style: { minWidth: 0 } }, h('h3', null, title), h('p', { class: 'muted' }, body)));
}

function statsCard(bundle) {
  if (!bundle.logsOk) {
    return card(h('div', { class: 'hstack', style: { gap: '12px' } }, icon('info', { size: 18 }), h('p', { class: 'muted' }, 'მიღების ისტორია ახლა ვერ ჩაიტვირთა. სცადე გვერდის განახლება.')));
  }
  const now = new Date();
  const w = sumAdherence(history(bundle, 7, now));
  const m = sumAdherence(history(bundle, 30, now));
  const answered = m.taken + m.skipped;
  const ringFor = (a, cap, color) => h('div', null,
    ring({ value: a.pct ?? 0, max: 100, size: 118, stroke: 11, color, label: a.pct == null ? '—' : `${a.pct}%`, sub: a.planned ? `${a.taken}/${a.planned}` : 'მონაცემი არაა' }),
    h('div', { class: 'med-ring-cap' }, cap));
  return card(
    h('div', { class: 'med-rings' }, ringFor(w, 'ბოლო 7 დღე', 'var(--brand)'), ringFor(m, 'ბოლო 30 დღე', 'var(--c2)')),
    h('div', { class: 'med-mini-stats' },
      stat('სერია', String(streak(bundle, now)), { unit: 'დღე', icon: 'flame' }),
      stat('დროულად', answered ? `${pct(m.taken, answered)}` : '—', { unit: answered ? '%' : '', icon: 'check' }),
      stat('აქტიური', String(bundle.medications.filter((x) => x.active).length), { icon: 'pill' })),
    h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '14px' } }, 'ითვლება მხოლოდ მონიშნული მიღებები — აქ ან აპში. დაგეგმილი, მაგრამ უპასუხო დოზა გაცდენილად ითვლება.'));
}

let trendDays = 14; // kept across re-renders
function trendCard(bundle, medId = null) {
  let days = trendDays;
  const chartBox = h('div');
  const legend = h('div', { class: 'legend med-legend' },
    h('span', null, h('i', { style: { background: 'var(--ok)' } }), 'მიღებული'),
    h('span', null, h('i', { style: { background: 'var(--warn)' } }), 'გამოტოვებული'),
    h('span', null, h('i', { style: { background: 'var(--danger)' } }), 'გაცდენილი'));
  const draw = () => {
    const rows = history(bundle, days, new Date(), medId);
    if (!rows.some((r) => r.planned)) {
      mount(chartBox, empty('ჯერ მონაცემი არაა', 'მონიშნე მიღებები და აქ დღიური დინამიკა გამოჩნდება.'));
      return;
    }
    mount(chartBox, barChart({
      labels: rows.map((r) => shortDay(r.date)),
      tipLabels: rows.map((r) => `${fmtDate(r.date)} · ${r.planned ? `${pct(r.taken, r.planned)}%` : 'გეგმა არ იყო'}`),
      stacked: [
        { name: 'მიღებული', values: rows.map((r) => r.taken), color: 'var(--ok)' },
        { name: 'გამოტოვებული', values: rows.map((r) => r.skipped), color: 'var(--warn)' },
        { name: 'გაცდენილი', values: rows.map((r) => r.missed), color: 'var(--danger)' },
      ],
      height: 220,
      fmt: (v) => String(Math.round(v)),
    }));
  };
  draw();
  return card(
    h('div', { class: 'card-head' },
      h('div', null, h('div', { class: 'card-title' }, 'დოზები დღეების მიხედვით'), h('div', { class: 'card-sub' }, 'მიღებული, გამოტოვებული და გაცდენილი')),
      segmented([{ value: 14, label: '14 დღე' }, { value: 30, label: '30 დღე' }], days, (v) => { days = v; trendDays = v; draw(); })),
    chartBox, legend);
}

function heatCard(bundle) {
  const now = new Date();
  const rows = history(bundle, 12 * 7 + 7, now);
  const data = rows.filter((r) => r.planned).map((r) => ({ date: r.date, value: pct(r.taken, r.planned), label: `${fmtDate(r.date)} · ${r.taken}/${r.planned}` }));
  return card(
    h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, 'ბოლო 12 კვირა'), h('div', { class: 'card-sub' }, 'რაც უფრო მუქია, მით მეტი დოზაა მიღებული'))),
    data.length ? heatmap({ days: data, weeks: 12, max: 100, fmt: (v) => `${v}%` }) : h('p', { class: 'muted' }, 'ისტორია ჯერ ცარიელია.'));
}

function medCard(med, reload) {
  const cfg = parseConfig(med.config);
  const times = parseTimes(med.frequency);
  const refill = cfg.remainingCount != null
    ? badge(`${cfg.remainingCount} დარჩა`, cfg.refillReminder && cfg.remainingCount <= (cfg.refillThreshold ?? 12) ? 'warn' : 'neutral')
    : null;
  const tog = toggle(med.active, (v) => setActive(med, v, reload), null);
  tog.title = med.active ? 'შეჩერება' : 'განახლება';
  tog.setAttribute('aria-label', `${med.medName}: ${med.active ? 'აქტიური' : 'შეჩერებული'}`);
  return card({ class: `hover med-card ${med.active ? '' : 'paused'}` },
    h('div', { class: 'med-card-top' },
      h('a', { href: `/medications/${med.id}`, 'data-link': '' },
        pillBadge(cfg.pillColor, 46),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'med-card-name' }, med.medName), h('div', { class: 'med-card-sub' }, knownAs(med) || med.dosage))),
      tog),
    h('div', { class: 'med-times' }, times.map((t) => h('span', { class: 'med-time-chip' }, t))),
    h('div', { class: 'med-card-foot' },
      h('span', null, daysSummary(cfg.daysOfWeek).length > 40 ? `${cfg.daysOfWeek.length} დღე კვირაში` : daysSummary(cfg.daysOfWeek), cfg.endDate ? ` · ${fmtDate(cfg.endDate, { short: true })}-მდე` : ''),
      refill || (med.active ? null : badge('შეჩერებული', 'neutral'))));
}

async function listPage(root, ctx) {
  const addBtn = button('დამატება', { icon: 'plus' });
  const interBtn = button('ურთიერთქმედება', { icon: 'shield', variant: 'ghost' });
  const body = h('div');
  mount(root, pageHead('მედიკამენტები', 'დღის გრაფიკი, მიღების სტატისტიკა და ურთიერთქმედება', interBtn, addBtn), body);
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
          section('დღევანდელი გრაფიკი', h('div', { class: 'stack', style: { gap: '12px' } }, spotlight(bundle), timelineCard(bundle, render, onAdd)))),
        h('div', null,
          section('მიღების სტატისტიკა', statsCard(bundle)),
          bundle.logsOk ? section('აქტივობის რუკა', heatCard(bundle)) : null)),
      bundle.logsOk ? section('დინამიკა', trendCard(bundle)) : null,
      section('ჩემი მედიკამენტები', active.length
        ? h('div', { class: 'grid grid-auto' }, active.map((m) => medCard(m, reload)))
        : card(h('p', { class: 'muted' }, 'აქტიური მედიკამენტი არ გაქვს — ჩართე შეჩერებული ან დაამატე ახალი.')),
      { action: button('დამატება', { size: 'sm', variant: 'ghost', icon: 'plus', onClick: onAdd }) }),
      paused.length ? section('შეჩერებული', h('div', { class: 'grid grid-auto' }, paused.map((m) => medCard(m, reload)))) : null,
      section(null, card({ class: 'hover' }, h('div', { class: 'hstack', style: { gap: '16px', alignItems: 'center', flexWrap: 'wrap' } },
        tile('shield', 'violet', 46),
        h('div', { style: { flex: 1, minWidth: '200px' } },
          h('div', { class: 'card-title' }, 'მედიკამენტების ურთიერთქმედება'),
          h('div', { class: 'card-sub' }, 'შეამოწმე, როგორ ურთიერთქმედებს შენი მედიკამენტები ერთმანეთთან.')),
        button('შემოწმება', { variant: 'secondary', icon: 'arrowRight', onClick: () => openInteraction(bundle) })))),
      h('p', { class: 'disclaimer' }, icon('bell', { size: 14 }),
        h('span', null, 'მიღების შეხსენებებს ტელეფონზე MEDICARD აპი გამოგიგზავნის. ', h('a', { class: 'link', href: APP_STORE, target: '_blank', rel: 'noopener' }, 'ჩამოტვირთე აპი'))));
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
  mount(root, h('a', { class: 'back', href: '/medications', 'data-link': '' }, icon('chevronLeft', { size: 16 }), 'მედიკამენტები'), body);
  let bundle = null;

  const render = () => {
    const med = bundle.medications.find((m) => m.id === id);
    if (!med) {
      mount(body, card(empty('მედიკამენტი ვერ მოიძებნა', 'შესაძლოა წაიშალა ან სხვა ანგარიშს ეკუთვნის.', button('მედიკამენტებზე დაბრუნება', { href: '/medications' }))));
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

    const editBtn = button('რედაქტირება', { icon: 'edit', variant: 'ghost', onClick: () => openMedForm(med, () => reload()) });
    const pauseBtn = button(med.active ? 'შეჩერება' : 'განახლება', { icon: med.active ? 'pause' : 'play', variant: 'ghost' });
    pauseBtn.addEventListener('click', () => busy(pauseBtn, () => setActive(med, !med.active, reload)));
    const delBtn = iconButton('trash', { title: 'წაშლა განრიგიდან', onClick: () => removeMed(med, () => ctx.navigate('/medications')) });

    const info = [
      ['pill', 'teal', 'რაოდენობა ერთ მიღებაზე', `${cfg.amount ?? 1} ${FORM_LABELS[cfg.form || 'pills']}`],
      cfg.strength ? ['zap', 'sky', 'სიძლიერე', cfg.strength] : null,
      ['clock', 'amber', 'მიღების დრო', parseTimes(med.frequency).join(', ')],
      ['calendar', 'blue', 'მიღების დღეები', daysSummary(cfg.daysOfWeek)],
      cfg.startDate || cfg.endDate ? ['calendarCheck', 'violet', 'კურსი', `${cfg.startDate ? fmtDate(cfg.startDate) : '…'} – ${cfg.endDate ? fmtDate(cfg.endDate) : '…'}`] : null,
      cfg.mealTiming && cfg.mealTiming !== 'any' ? ['utensils', 'amber', 'ჭამასთან', MEAL_LABELS[cfg.mealTiming]] : null,
      cfg.remainingCount != null ? ['folder', 'sky', 'დარჩენილი', `${cfg.remainingCount} დარჩა`] : null,
      ['bell', 'rose', 'შევსების შეხსენება', cfg.refillReminder ? `კი · ზღვარი ${cfg.refillThreshold ?? 12}` : 'არა'],
      med.notes ? ['file', 'neutral', 'შენიშვნა', med.notes] : null,
      ['plus', 'green', 'დამატებულია', fmtDate(med.createdAt)],
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
          section('დღეს', card(
            h('div', { class: 'med-detail-hero', style: { marginBottom: todays.length ? '16px' : 0 } },
              pillBadge(cfg.pillColor, 64),
              h('div', { style: { minWidth: 0, flex: 1 } },
                h('div', { class: 'hstack', style: { gap: '8px', flexWrap: 'wrap' } },
                  med.active ? badge('აქტიური', 'ok') : badge('შეჩერებული', 'neutral'),
                  cfg.mealTiming && cfg.mealTiming !== 'any' ? badge(MEAL_LABELS[cfg.mealTiming], 'warn') : null),
                h('p', { class: 'muted', style: { marginTop: '6px' } }, scheduleLine(med)))),
            todays.length
              ? h('div', { class: 'stack', style: { gap: '8px' } }, todays.map((d) => h('div', { class: `med-dose ${d.status === 'taken' || d.status === 'skipped' ? 'done' : ''}` },
                h('span', { class: `med-dot ${d.status}`, style: { boxShadow: 'none' } }),
                h('div', { class: 'med-dose-main' }, h('div', { class: 'med-dose-title' }, d.time), h('div', { class: 'med-dose-sub' }, STATUS[d.status].label)),
                doseButtons(bundle, d, render))))
              : h('p', { class: 'muted' }, med.active ? 'დღეს ამ მედიკამენტის მიღება დაგეგმილი არ არის.' : 'მედიკამენტი შეჩერებულია — განაახლე, რომ გრაფიკში დაბრუნდეს.'))),
          bundle.logsOk ? section('დინამიკა', trendCard(bundle, id)) : null,
          section('მიღების ისტორია', card(logged.length
            ? h('div', null, logged.map(({ date, ds }) => h('div', { class: 'med-history-day' },
              h('div', { class: 'med-history-date' }, relDayShort(date), h('span', null, KA_DAYS_SHORT[parseDate(date).getDay()])),
              h('div', { class: 'med-history-items' }, ds.map((d) => badge(`${d.time} · ${STATUS[d.status].label}`, STATUS[d.status].tone))))))
            : empty('ისტორია ჯერ ცარიელია', 'როცა მიღებას მონიშნავ, აქ გამოჩნდება.')))),
        h('div', null,
          bundle.logsOk ? section('მიღება', card(
            h('div', { class: 'med-rings' },
              h('div', null, ring({ value: a30.pct ?? 0, max: 100, size: 128, stroke: 12, label: a30.pct == null ? '—' : `${a30.pct}%`, sub: a30.planned ? `${a30.taken}/${a30.planned}` : 'მონაცემი არაა' }), h('div', { class: 'med-ring-cap' }, 'ბოლო 30 დღე'))),
            h('div', { class: 'med-mini-stats' },
              stat('7 დღე', a7.pct == null ? '—' : String(a7.pct), { unit: a7.pct == null ? '' : '%' }),
              stat('სერია', String(streak(bundle, now, id)), { unit: 'დღე' }),
              stat('გაცდენილი', String(a30.missed), { unit: '30დ' })))) : null,
          section('დეტალები', card({ class: 'flush' }, h('div', { class: 'list med-info', style: { padding: '6px 12px' } },
            info.map(([ic, ink, label, value]) => h('div', { class: 'row' }, tile(ic, ink, 36),
              h('div', { class: 'row-main' }, h('div', { class: 'row-sub', style: { marginTop: 0 } }, label), h('div', { class: 'row-title', style: { whiteSpace: 'normal' } }, value))))))),
          section(null, card({ class: 'hover' }, h('div', { class: 'feature' },
            tile('shield', 'violet', 42),
            h('h3', null, 'ურთიერთქმედების შემოწმება'),
            h('p', null, 'Medi გადაამოწმებს ამ და შენს სხვა აქტიურ მედიკამენტებს ერთად.'),
            button('შემოწმება', { variant: 'secondary', size: 'sm', icon: 'arrowRight', onClick: () => openInteraction(bundle) })))))));
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
  if (diff === 0) return 'დღეს';
  if (diff === 1) return 'გუშინ';
  return fmtDate(date, { short: true });
}

/* ── Entry ───────────────────────────────────────────── */
export default async function medicationsPage(root, ctx) {
  ensureCss();
  return ctx.params?.id ? detailPage(root, ctx) : listPage(root, ctx);
}
