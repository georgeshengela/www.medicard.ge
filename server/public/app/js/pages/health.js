// MEDICARD web — „მაჩვენებლები“: weight, steps and water.
// Mirrors mobile/app/health-metrics/** (weight, steps, hydration) and the same endpoints:
//   GET  /api/health-metrics/daily            daily rows (steps, weightKg, hydrationMl) — synced by the phone
//   POST /api/health-metrics/sync             ONLY on an explicit user action (weight entry, water tap), exactly
//                                             like the app's logManualHealthMetric / syncHydrationEvent. Never
//                                             from a timer, a listener or a re-render (2026-09-29 loop incident).
//   GET/PUT /api/health-metrics/hydration/goal
//   GET  /api/health-metrics/steps/capability
//   GET/PUT /api/account/app-state            weightLogs, weightGoal, stepsGoal (merge endpoint)
//   PUT  /api/health-profile                  current weight (same as the app)
import { get, post, put } from '../api.js';
import {
  h, mount, icon, tile, pageHead, section, card, button, busy, badge, empty, skeleton, errorBox,
  progress, segmented, field, input, select, toast, formModal, fmtDate, fmtNum, ymd, addDays, parseDate,
  KA_MONTHS_SHORT,
} from '../ui.js';
import { lineChart, barChart, ring, rings, sparkline } from '../charts.js';
import { session, setProfile, featureOn } from '../session.js';
import { t, isEn } from '../i18n.js';
import { stepsGoalFromDaily } from '../stepsGoal.js';

const CSS = '/app/css/health.css';
const APP_STORE = 'https://apps.apple.com/app/id6812517519';
const WATER_DEFAULT_ML = 2000;
const PACE_KG = { slow: 0.25, moderate: 0.5, fast: 0.75 };
const PACE_LABEL = isEn ? { slow: 'Gentle', moderate: 'Moderate', fast: 'Fast' } : { slow: 'მშვიდი', moderate: 'ზომიერი', fast: 'სწრაფი' };
const KG = t('კგ', 'kg');
const ML = t('მლ', 'ml');
const LOAD_DAYS = 90;

function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

/* ── Pure helpers (ported from mobile weightGoal.shared / bmi / hydration) ── */
const round1 = (n) => Math.round(n * 10) / 10;
export const clampKg = (v) => Math.min(250, Math.max(30, Math.round(v * 10) / 10));
const rand = () => Math.random().toString(36).slice(2, 7);
const shortDay = (key) => { const d = parseDate(key); return `${d.getDate()} ${KA_MONTHS_SHORT[d.getMonth()]}`; };
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86_400_000);
const addDaysYmd = (key, n) => ymd(addDays(parseDate(key), n));

function rangeKeys(days, end = ymd()) {
  return Array.from({ length: days }, (_, i) => addDaysYmd(end, i - days + 1));
}

function bmiOf(kg, heightCm) {
  if (!kg || !heightCm) return null;
  const m = heightCm / 100;
  return round1(kg / (m * m));
}
function bmiCategory(bmi) {
  if (bmi < 18.5) return { key: 'under', label: t('ნორმაზე ნაკლები', 'Below the healthy range'), tone: 'sky' };
  if (bmi < 25) return { key: 'normal', label: t('ჯანსაღ დიაპაზონში', 'In the healthy range'), tone: 'teal' };
  if (bmi < 30) return { key: 'over', label: t('ნორმაზე მეტი', 'Above the healthy range'), tone: 'amber' };
  return { key: 'obese', label: t('მნიშვნელოვნად მეტი', 'Well above the healthy range'), tone: 'rose' };
}

/** One row per day: the person's own log wins; the phone's daily sync fills the rest. */
function weightHistory(daily, logs) {
  const byDate = new Map();
  for (const d of daily) if (d.weightKg != null) byDate.set(d.date, { date: d.date, kg: Number(d.weightKg), at: null });
  const sorted = [...(logs || [])]
    .filter((l) => l && l.date && Number.isFinite(Number(l.kg)))
    .sort((a, b) => String(a.at || a.date).localeCompare(String(b.at || b.date)));
  for (const l of sorted) byDate.set(l.date, { date: l.date, kg: Number(l.kg), at: l.at || null });
  return [...byDate.values()].filter((p) => p.date <= ymd()).sort((a, b) => a.date.localeCompare(b.date));
}

function goalProgress(goal, current, now = ymd()) {
  const total = Math.abs(goal.startKg - goal.targetKg) || 0.1;
  const moved = Math.abs(goal.startKg - current);
  const toward = (goal.targetKg < goal.startKg && current <= goal.startKg) || (goal.targetKg > goal.startKg && current >= goal.startKg);
  const percent = Math.round(Math.min(100, Math.max(0, (toward ? moved : 0) / total) * 100));
  const remaining = round1(Math.abs(current - goal.targetKg));
  const daysLeft = Math.max(0, daysBetween(now, goal.deadlineYmd));
  const expected = (daysBetween(goal.startedYmd, now) / 7) * (goal.paceKgPerWeek || 0.5);
  return { percent, remaining, daysLeft, completed: remaining <= 0.15, onTrack: toward && moved + 0.2 >= expected };
}

function deadlineFromPace(startKg, targetKg, pace) {
  const weeks = Math.max(1, Math.ceil(Math.abs(startKg - targetKg) / PACE_KG[pace]));
  return addDaysYmd(ymd(), weeks * 7);
}

function fmtKg(v) { return v == null ? '—' : fmtNum(v, 1); }
function fmtMl(ml) { return ml >= 1000 ? `${fmtNum(ml / 1000, 2)} ${t('ლ', 'L')}` : `${fmtNum(ml)} ${ML}`; }
function signed(v, digits = 1, unit = '') {
  if (v == null || Number.isNaN(v)) return '—';
  const r = Number(v.toFixed(digits));
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${fmtNum(Math.abs(r), digits)}${unit}`;
}

/* ── Writes (each one only from a click) ─────────────────── */

/** Same three writes as the app's weight sheet: daily row, account weight log, profile weight. */
async function logWeight(kg) {
  const date = ymd();
  const at = new Date().toISOString();
  const entry = { id: `wlog-${Date.now()}-${rand()}`, kg, at, date };
  const { state } = await put('/api/account/app-state', { weightLogs: [entry] });
  await post('/api/health-metrics/sync', { daily: [{ date, weightKg: kg }], stepLogs: [] })
    .catch((e) => console.warn('[health] weight sync failed', e));
  try {
    const res = await put('/api/health-profile', { weightKg: kg, extraAnswers: { firstHealthMetricLogged: true } });
    if (res?.profile) setProfile(res.profile);
  } catch (e) { console.warn('[health] profile weight failed', e); }
  return state;
}

/** One hydration event, idempotent by clientEventId — the app's syncHydrationEvent. */
async function addWater(ml, date = ymd()) {
  const id = `web-${Date.now()}-${rand()}`;
  await post('/api/health-metrics/sync', { daily: [], stepLogs: [], hydrationEvents: [{ clientEventId: id, date, deltaMl: ml }] });
  return { id, date, ml };
}
async function undoWater(ev) {
  await post('/api/health-metrics/sync', { daily: [], stepLogs: [], hydrationEvents: [{ clientEventId: `del-${ev.id}`, date: ev.date, deltaMl: -ev.ml }] });
}

async function readToday() {
  const today = ymd();
  const { daily } = await get('/api/health-metrics/daily', { from: today, to: today });
  return daily?.[0] || null;
}

/* ── Page ─────────────────────────────────────────────── */
export default async function healthPage(root, ctx) {
  ensureCss();
  let range = [7, 30, 90].includes(Number(ctx?.query?.range)) ? Number(ctx.query.range) : 30;
  const state = { daily: [], app: null, waterGoal: WATER_DEFAULT_ML, capability: null };
  let alive = true;

  const rangeSeg = segmented(
    [{ value: 7, label: t('7 დღე', '7 days') }, { value: 30, label: t('30 დღე', '30 days') }, { value: 90, label: t('90 დღე', '90 days') }],
    range,
    (v) => { range = v; render(); },
  );
  const body = h('div', { class: 'hm-page' });
  mount(root,
    pageHead(t('მაჩვენებლები', 'Metrics'), t('წონა, ნაბიჯები და წყალი — ტენდენციები დროში.', 'Weight, steps and water — trends over time.'), rangeSeg),
    body);

  async function load() {
    mount(body, h('div', { class: 'grid grid-3' }, skeleton(3), skeleton(3), skeleton(3)), h('div', { style: { height: '16px' } }), skeleton(6));
    try {
      const from = addDaysYmd(ymd(), -(LOAD_DAYS - 1));
      const [daily, app, goal, capability] = await Promise.all([
        get('/api/health-metrics/daily', { from, to: ymd() }),
        get('/api/account/app-state').catch(() => ({ state: null })),
        get('/api/health-metrics/hydration/goal').catch(() => null),
        get('/api/health-metrics/steps/capability').catch(() => null),
      ]);
      if (!alive) return;
      state.daily = daily?.daily || [];
      state.app = app?.state || null;
      state.waterGoal = goal?.goalMl && goal.goalMl >= 250 ? goal.goalMl : WATER_DEFAULT_ML;
      state.capability = capability;
      render();
    } catch (e) {
      if (alive) mount(body, errorBox(e, load));
    }
  }

  function upsertDaily(row) {
    if (!row) return;
    const i = state.daily.findIndex((d) => d.date === row.date);
    if (i >= 0) state.daily[i] = row; else state.daily.push(row);
    state.daily.sort((a, b) => a.date.localeCompare(b.date));
  }

  function render() {
    if (!alive) return;
    const keys = rangeKeys(range);
    const byDate = new Map(state.daily.map((d) => [d.date, d]));
    const history = weightHistory(state.daily, state.app?.weightLogs);
    // Daily step goal = the person's own typical day (same rule as the app: stepsGoal.js).
    const stepsGoal = stepsGoalFromDaily(state.daily);
    // Each tracker can be paused from admin „მოდულები“; the page shows the ones that run.
    mount(body,
      overview(history, byDate, stepsGoal),
      featureOn('weight') ? section(t('წონა', 'Weight'), weightSection(history, keys), { action: button(t('წონის ჩაწერა', 'Log weight'), { size: 'sm', icon: 'plus', onClick: openWeightLog }) }) : null,
      featureOn('steps') ? section(t('ნაბიჯები', 'Steps'), stepsSection(byDate, keys, stepsGoal)) : null,
      featureOn('hydration') ? section(t('წყალი', 'Water'), waterSection(byDate, keys), { action: button(t('მიზანი', 'Goal'), { size: 'sm', variant: 'ghost', icon: 'target', onClick: openWaterGoal }) }) : null);
  }

  /* KPI row */
  function overview(history, byDate, stepsGoal) {
    const today = ymd();
    const current = history.at(-1)?.kg ?? session.profile?.weightKg ?? null;
    const steps = Number(byDate.get(today)?.steps) || 0;
    const water = Math.max(0, Number(byDate.get(today)?.hydrationMl) || 0);
    const last14 = rangeKeys(14);
    const kpi = (ic, ink, label, value, unit, sub, spark, target) => h('button', {
      type: 'button', class: 'card hover hm-kpi', onClick: () => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
    h('div', { class: 'between' }, h('div', { class: 'hstack' }, tile(ic, ink, 36), h('span', { class: 'stat-label' }, label)), spark),
    h('div', { class: 'stat-value' }, value, unit ? h('small', null, ` ${unit}`) : null),
    h('div', { class: 'stat-delta' }, sub));
    return h('div', { class: 'grid grid-3 hm-kpis' },
      !featureOn('weight') ? null : kpi('scale', 'violet', t('წონა', 'Weight'), fmtKg(current), current != null ? KG : '', history.length ? t(`ბოლო ჩანაწერი: ${fmtDate(history.at(-1).date)}`, `Last entry: ${fmtDate(history.at(-1).date)}`) : t('ჯერ არ ჩაგიწერია', 'Nothing logged yet'),
        sparkline(history.slice(-14).map((p) => p.kg), { width: 90, height: 30, color: 'var(--ink-violet)' }), 'hm-weight'),
      !featureOn('steps') ? null : kpi('footprints', 'green', t('ნაბიჯი დღეს', 'Steps today'), fmtNum(steps), '', t(`მიზანი ${fmtNum(stepsGoal)}`, `Goal ${fmtNum(stepsGoal)}`),
        sparkline(last14.map((k) => Number(byDate.get(k)?.steps) || 0), { width: 90, height: 30, color: 'var(--ink-green)' }), 'hm-steps'),
      !featureOn('hydration') ? null : kpi('droplet', 'sky', t('წყალი დღეს', 'Water today'), fmtMl(water), '', t(`მიზანი ${fmtMl(state.waterGoal)}`, `Goal ${fmtMl(state.waterGoal)}`),
        sparkline(last14.map((k) => Math.max(0, Number(byDate.get(k)?.hydrationMl) || 0)), { width: 90, height: 30, color: 'var(--ink-sky)' }), 'hm-water'));
  }

  /* ── Weight ── */
  function weightSection(history, keys) {
    const goal = state.app?.weightGoal || null;
    const inRange = history.filter((p) => p.date >= keys[0]);
    const current = history.at(-1)?.kg ?? session.profile?.weightKg ?? null;
    const heightCm = session.profile?.heightCm || null;
    const wrap = h('div', { class: 'grid grid-main', id: 'hm-weight' });

    // Chart card
    let chartBody;
    if (!inRange.length) {
      chartBody = empty(
        history.length ? t(`ბოლო ${range} დღეში ჩანაწერი არ არის`, `No entries in the last ${range} days`) : t('ჯერ წონა არ ჩაგიწერია', 'You haven’t logged your weight yet'),
        history.length ? t(`ბოლოს ჩაწერე ${fmtDate(history.at(-1).date)}. აირჩიე უფრო გრძელი პერიოდი ან ჩაწერე დღევანდელი.`, `Your last entry was ${fmtDate(history.at(-1).date)}. Choose a longer period or log today’s weight.`) : t('კვირაში ერთი ჩანაწერიც საკმარისია ტენდენციისთვის — უმჯობესია დილით.', 'One entry a week is enough to see a trend — mornings are best.'),
        button(t('წონის ჩაწერა', 'Log weight'), { icon: 'plus', onClick: openWeightLog }));
    } else {
      const first = inRange[0].kg;
      const last = inRange.at(-1).kg;
      const avg = round1(inRange.reduce((s, p) => s + p.kg, 0) / inRange.length);
      const delta = inRange.length > 1 ? last - first : null;
      chartBody = h('div', { class: 'stack', style: { gap: '16px' } },
        h('div', { class: 'hm-mini-stats' },
          miniStat(t('მიმდინარე', 'Current'), `${fmtKg(current)} ${KG}`),
          miniStat(t(`ცვლილება · ${range} დღე`, `Change · ${range} days`), delta == null ? '—' : `${signed(delta, 1)} ${KG}`, delta == null ? '' : trendTone(delta, goal)),
          miniStat(t('საშუალო', 'Average'), `${fmtKg(avg)} ${KG}`),
          miniStat(t('ჩანაწერი', 'Entries'), fmtNum(inRange.length))),
        lineChart({
          labels: inRange.map((p) => shortDay(p.date)),
          tipLabels: inRange.map((p) => fmtDate(p.date)),
          series: [{ name: t('წონა', 'Weight'), values: inRange.map((p) => p.kg), color: 'var(--ink-violet)', dots: inRange.length <= 31 }],
          goal: goal?.targetKg ?? null,
          goalLabel: goal ? t(`მიზანი ${fmtKg(goal.targetKg)} ${KG}`, `Goal ${fmtKg(goal.targetKg)} ${KG}`) : null,
          unit: KG,
          zero: false,
          fmt: (v) => fmtNum(v, 1),
          height: 240,
          ariaLabel: t('წონის დინამიკა', 'Weight trend'),
        }));
    }
    wrap.append(card({ class: 'pad-lg' }, chartBody));

    // Side: goal, BMI, recent logs
    const side = h('div', { class: 'stack', style: { gap: '16px' } });
    side.append(goalCard(goal, current));
    side.append(bmiCard(current, heightCm));
    if (history.length) {
      side.append(card(
        h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('ბოლო ჩანაწერები', 'Recent entries'))),
        h('div', { class: 'list' }, history.slice(-6).reverse().map((p, i) => {
          const prev = history[history.length - 2 - i];
          const d = prev ? p.kg - prev.kg : null;
          return h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, `${fmtKg(p.kg)} ${KG}`), h('div', { class: 'row-sub' }, fmtDate(p.date))),
            h('div', { class: 'row-trail' }, d == null || Math.abs(d) < 0.05 ? h('span', { class: 'faint' }, '—') : h('span', { class: `hm-delta ${trendTone(d, goal)}` }, `${signed(d, 1)} ${KG}`)));
        }))));
    }
    wrap.append(side);
    return wrap;
  }

  function goalCard(goal, current) {
    if (!goal || current == null) {
      return card({ class: 'hm-goal' },
        h('div', { class: 'hstack', style: { marginBottom: '10px' } }, tile('target', 'violet', 38), h('div', null, h('div', { class: 'card-title' }, t('წონის მიზანი', 'Weight goal')), h('div', { class: 'card-sub' }, t('შენი ტემპით, უსაფრთხოდ', 'At your own pace, safely')))),
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, current == null ? t('ჯერ ჩაწერე მიმდინარე წონა — შემდეგ მიზანს დააყენებ.', 'Log your current weight first — then you can set a goal.') : t('დააყენე სამიზნე წონა — გრაფიკზე მიზნის ხაზი და პროგრესი გამოჩნდება.', 'Set a target weight — a goal line and your progress will appear on the chart.')),
        button(current == null ? t('წონის ჩაწერა', 'Log weight') : t('მიზნის დაყენება', 'Set a goal'), { variant: 'secondary', size: 'sm', onClick: current == null ? openWeightLog : () => openWeightGoal(goal, current), class: 'hm-mt' }));
    }
    const p = goalProgress(goal, current);
    return card({ class: 'hm-goal' },
      h('div', { class: 'between', style: { marginBottom: '12px' } },
        h('div', { class: 'hstack' }, tile('target', 'violet', 38), h('div', null, h('div', { class: 'card-title' }, t('წონის მიზანი', 'Weight goal')), h('div', { class: 'card-sub' }, `${fmtKg(goal.startKg)} → ${fmtKg(goal.targetKg)} ${KG}`))),
        button(t('შეცვლა', 'Change'), { variant: 'ghost', size: 'sm', onClick: () => openWeightGoal(goal, current) })),
      p.completed
        ? h('p', { class: 'hm-goal-done' }, icon('check', { size: 16 }), t('მიზანი მიღწეულია — გილოცავ!', 'Goal reached — congratulations!'))
        : h('div', { class: 'stack', style: { gap: '8px' } },
          h('div', { class: 'between' }, h('b', { class: 'hm-big' }, `${p.percent}%`), h('span', { class: 'muted', style: { fontSize: '13px' } }, t(`დარჩა ${fmtKg(p.remaining)} ${KG}`, `${fmtKg(p.remaining)} ${KG} to go`))),
          progress(p.percent, 100, { ink: 'violet' }),
          h('div', { class: 'between', style: { fontSize: '12.5px' } },
            h('span', { class: 'faint' }, t(`ორიენტირი: ${fmtDate(goal.deadlineYmd, { year: true })}`, `Target date: ${fmtDate(goal.deadlineYmd, { year: true })}`)),
            p.onTrack ? badge(t('გეგმის მიხედვით', 'On track'), 'ok') : badge(t(`${p.daysLeft} დღე დარჩა`, `${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'} left`), 'neutral'))),
      h('p', { class: 'disclaimer', style: { marginTop: '12px' } }, t('ეს ორიენტირია, არა ექიმის დანიშნულება.', 'This is a guide, not a doctor’s prescription.')));
  }

  function bmiCard(kg, heightCm) {
    const bmi = bmiOf(kg, heightCm);
    if (bmi == null) {
      return card(
        h('div', { class: 'hstack' }, tile('activity', 'teal', 38), h('div', null, h('div', { class: 'card-title' }, t('სხეულის მასის ინდექსი', 'Body mass index')), h('div', { class: 'card-sub' }, heightCm ? t('ჩაწერე წონა და ინდექსი დაითვლება.', 'Log your weight and your BMI will be calculated.') : t('პროფილში მიუთითე სიმაღლე — ინდექსი ავტომატურად დაითვლება.', 'Add your height in Profile — your BMI will be calculated automatically.')))),
        heightCm ? null : h('a', { class: 'link hm-mt', href: '/profile', 'data-link': '' }, t('პროფილის გახსნა', 'Open Profile'), icon('chevronRight', { size: 16 })));
    }
    const cat = bmiCategory(bmi);
    const m = heightCm / 100;
    const lo = round1(18.5 * m * m);
    const hi = round1(24.9 * m * m);
    const pos = Math.min(1, Math.max(0, (bmi - 15) / 25));
    return card(
      h('div', { class: 'between', style: { marginBottom: '12px' } },
        h('div', { class: 'hstack' }, tile('activity', cat.tone, 38), h('div', null, h('div', { class: 'card-title' }, t('სხეულის მასის ინდექსი', 'Body mass index')), h('div', { class: 'card-sub' }, t(`სიმაღლე ${fmtNum(heightCm)} სმ`, `Height ${fmtNum(heightCm)} cm`)))),
        h('b', { class: 'hm-big' }, fmtNum(bmi, 1))),
      h('div', { class: 'hm-bmi-scale', 'aria-hidden': 'true' }, h('i', { style: { left: `${pos * 100}%` } })),
      h('div', { class: 'hm-bmi-ticks' }, h('span', null, '15'), h('span', null, '18.5'), h('span', null, '25'), h('span', null, '30'), h('span', null, '40')),
      h('p', { class: 'muted', style: { fontSize: '13px', marginTop: '10px' } }, t(`${cat.label}. შენი სიმაღლისთვის ჯანსაღი დიაპაზონი ≈ ${fmtKg(lo)}–${fmtKg(hi)} კგ.`, `${cat.label}. A healthy range for your height is ≈ ${fmtKg(lo)}–${fmtKg(hi)} kg.`)),
      h('p', { class: 'disclaimer', style: { marginTop: '8px' } }, t('ინდექსი ზოგადი ორიენტირია — კუნთის მასას და სხეულის აგებულებას არ ითვალისწინებს.', 'BMI is a general guide — it doesn’t account for muscle mass or body build.')));
  }

  function openWeightLog() {
    const history = weightHistory(state.daily, state.app?.weightLogs);
    const last = history.at(-1)?.kg ?? session.profile?.weightKg ?? '';
    formModal({
      title: t('წონის ჩაწერა', 'Log weight'),
      size: 'sm',
      submit: t('შენახვა', 'Save'),
      fields: [
        field(t('წონა (კგ)', 'Weight (kg)'), input({ name: 'kg', type: 'number', inputmode: 'decimal', step: '0.1', min: '30', max: '250', value: last === '' ? '' : String(last), required: true, placeholder: t('მაგ: 68.4', 'e.g. 68.4') }), t('დღევანდელი ჩანაწერი ჩაანაცვლებს დღის წინა მნიშვნელობას.', 'Today’s entry replaces any earlier value for today.')),
      ],
      onSubmit: async (v, close) => {
        const n = Number(String(v.kg).replace(',', '.'));
        if (!Number.isFinite(n) || n < 30 || n > 250) throw new Error(t('შეიყვანე წონა 30–250 კგ-ს შორის.', 'Enter a weight between 30 and 250 kg.'));
        const kg = clampKg(n);
        const next = await logWeight(kg);
        if (next) state.app = next;
        upsertDaily({ ...(state.daily.find((d) => d.date === ymd()) || { date: ymd() }), weightKg: kg });
        close();
        toast(t('წონა შენახულია', 'Weight saved'));
        render();
      },
    });
  }

  function openWeightGoal(goal, current) {
    const start = current ?? goal?.startKg ?? 70;
    const targetIn = input({ name: 'target', type: 'number', inputmode: 'decimal', step: '0.1', min: '30', max: '250', required: true, value: String(goal?.targetKg ?? clampKg(start - 3)) });
    const paceSel = select([
      { value: 'slow', label: t(`მშვიდი · ${PACE_KG.slow} კგ კვირაში`, `Gentle · ${PACE_KG.slow} kg a week`) },
      { value: 'moderate', label: t(`ზომიერი · ${PACE_KG.moderate} კგ კვირაში`, `Moderate · ${PACE_KG.moderate} kg a week`) },
      { value: 'fast', label: t(`სწრაფი · ${PACE_KG.fast} კგ კვირაში`, `Fast · ${PACE_KG.fast} kg a week`) },
    ], goal?.pace || 'moderate', { name: 'pace' });
    const preview = h('p', { class: 'muted', style: { fontSize: '13px' } });
    const update = () => {
      const target = Number(String(targetIn.value).replace(',', '.'));
      if (!Number.isFinite(target)) { preview.textContent = ''; return; }
      const hold = Math.abs(target - start) < 0.2;
      preview.textContent = hold
        ? t('შენარჩუნების მიზანი: მიმდინარე წონის შენარჩუნება.', 'Maintenance goal: keep your current weight.')
        : t(`${target < start ? 'კლება' : 'მატება'} ${fmtKg(Math.abs(target - start))} კგ · ორიენტირი ${fmtDate(deadlineFromPace(start, target, hold ? 'slow' : paceSel.value), { year: true })}`, `${target < start ? 'Lose' : 'Gain'} ${fmtKg(Math.abs(target - start))} kg · target date ${fmtDate(deadlineFromPace(start, target, hold ? 'slow' : paceSel.value), { year: true })}`);
    };
    targetIn.addEventListener('input', update);
    paceSel.addEventListener('change', update);
    update();
    formModal({
      title: goal ? t('წონის მიზნის შეცვლა', 'Change weight goal') : t('წონის მიზანი', 'Weight goal'),
      size: 'sm',
      fields: [
        h('div', { class: 'hm-goal-from' }, h('span', { class: 'faint' }, t('ახლა', 'Now')), h('b', null, `${fmtKg(start)} ${KG}`)),
        field(t('სამიზნე წონა (კგ)', 'Target weight (kg)'), targetIn),
        field(t('ტემპი', 'Pace'), paceSel, t('ნელი ცვლილების შენარჩუნება უფრო ადვილია. მომატებისას ან ქრონიკული მდგომარეობისას აირჩიე მშვიდი ტემპი.', 'Slow change is easier to keep. When gaining weight or living with a chronic condition, choose the gentle pace.')),
        preview,
        h('p', { class: 'disclaimer' }, t('ეს ორიენტირია, არა ექიმის დანიშნულება. თუ კვების გეგმა გაქვს, მიზნის შეცვლის შემდეგ გეგმასაც გადაამოწმებ.', 'This is a guide, not a doctor’s prescription. If you have a meal plan, review it after changing your goal.')),
      ],
      onSubmit: async (v, close) => {
        const target = Number(String(v.target).replace(',', '.'));
        if (!Number.isFinite(target) || target < 30 || target > 250) throw new Error(t('სამიზნე წონა 30–250 კგ-ს შორის უნდა იყოს.', 'The target weight must be between 30 and 250 kg.'));
        const targetKg = clampKg(target);
        const hold = Math.abs(targetKg - start) < 0.2;
        const pace = hold ? 'slow' : targetKg > start && v.pace === 'fast' ? 'moderate' : v.pace;
        const next = {
          id: `wgoal-${Date.now()}`,
          targetKg,
          startKg: clampKg(start),
          startedYmd: ymd(),
          deadlineYmd: deadlineFromPace(start, targetKg, hold ? 'slow' : pace),
          paceKgPerWeek: PACE_KG[pace],
          pace,
          reminderEnabled: goal?.reminderEnabled ?? false,
          reminderDays: goal?.reminderDays ?? [1, 3, 4],
          reminderHour: goal?.reminderHour ?? 12,
          reminderMinute: goal?.reminderMinute ?? 0,
          completedSeen: false,
          updatedAt: new Date().toISOString(),
        };
        const res = await put('/api/account/app-state', { weightGoal: next });
        state.app = res?.state || { ...(state.app || {}), weightGoal: next };
        close();
        toast(pace !== v.pace ? t(`მიზანი შენახულია · ტემპი: ${PACE_LABEL[pace]}`, `Goal saved · pace: ${PACE_LABEL[pace]}`) : t('მიზანი შენახულია', 'Goal saved'));
        render();
      },
    });
  }

  /* ── Steps ── */
  function stepsSection(byDate, keys, goal) {
    const today = ymd();
    const values = keys.map((k) => Math.max(0, Number(byDate.get(k)?.steps) || 0));
    const anySteps = state.daily.some((d) => Number(d.steps) > 0);
    const wrap = h('div', { class: 'grid grid-main', id: 'hm-steps' });
    const todaySteps = Math.max(0, Number(byDate.get(today)?.steps) || 0);
    const syncedAt = byDate.get(today)?.syncedAt || [...state.daily].reverse().find((d) => d.steps != null)?.syncedAt;

    if (!anySteps) {
      wrap.append(card({ class: 'pad-lg' }, empty(t('ნაბიჯები ჯერ არ სინქრონდება', 'Steps aren’t syncing yet'),
        t('ნაბიჯებს ტელეფონი ითვლის — MEDICARD აპი მათ Apple Health-იდან ან Health Connect-იდან აქ გადმოიტანს.', 'Your phone counts your steps — the MEDICARD app brings them here from Apple Health or Health Connect.'),
        button(t('აპის ჩამოტვირთვა', 'Download the app'), { href: APP_STORE, external: true, variant: 'secondary', icon: 'smartphone' }))));
      wrap.append(stepsGoalCard(byDate));
      return wrap;
    }

    const withData = values.filter((v) => v > 0);
    const avg = withData.length ? Math.round(withData.reduce((a, b) => a + b, 0) / withData.length) : 0;
    const best = Math.max(0, ...values);
    const bestIdx = values.indexOf(best);
    const reached = values.filter((v) => v >= goal).length;
    const total = values.reduce((a, b) => a + b, 0);
    wrap.append(card({ class: 'pad-lg' },
      h('div', { class: 'hm-mini-stats' },
        miniStat(t('დღეს', 'Today'), fmtNum(todaySteps)),
        miniStat(t(`საშუალო · ${range} დღე`, `Average · ${range} days`), fmtNum(avg)),
        miniStat(t('საუკეთესო დღე', 'Best day'), best ? `${fmtNum(best)}` : '—', '', best && bestIdx >= 0 ? fmtDate(keys[bestIdx]) : ''),
        miniStat(t('მიზანი შესრულდა', 'Goal reached'), t(`${reached} დღე`, `${reached} ${reached === 1 ? 'day' : 'days'}`))),
      barChart({
        labels: keys.map(shortDay),
        tipLabels: keys.map((k) => fmtDate(k)),
        values,
        goal,
        goalLabel: `${fmtNum(goal)}`,
        color: 'var(--ink-green)',
        unit: t('ნაბიჯი', 'steps'),
        fmt: (v) => fmtNum(v),
        height: 240,
      }),
      h('div', { class: 'between hm-foot' },
        h('span', { class: 'faint' }, t(`სულ ${fmtNum(total)} ნაბიჯი · ≈ ${fmtNum(total * 0.000762, 1)} კმ`, `${fmtNum(total)} steps in total · ≈ ${fmtNum(total * 0.000762, 1)} km`)),
        h('span', { class: 'faint hstack', style: { gap: '6px' } }, icon('smartphone', { size: 14 }), syncedAt ? t(`სინქრონი აპიდან · ${fmtDate(syncedAt)}`, `Synced from the app · ${fmtDate(syncedAt)}`) : t('სინქრონდება აპიდან', 'Synced from the app')))));

    const side = h('div', { class: 'stack', style: { gap: '16px' } });
    const pct = Math.min(100, Math.round((todaySteps / goal) * 100));
    side.append(card(
      h('div', { class: 'hstack', style: { gap: '18px' } },
        ring({ value: todaySteps, max: goal, size: 112, stroke: 11, color: 'var(--ink-green)', label: `${pct}%`, sub: t('დღეს', 'Today') }),
        h('div', { class: 'stack', style: { gap: '4px' } },
          h('div', { class: 'card-title' }, stepsStatus(todaySteps, goal)),
          h('div', { class: 'card-sub' }, todaySteps >= goal ? t(`${fmtNum(todaySteps - goal)} ნაბიჯით მეტი`, `${fmtNum(todaySteps - goal)} steps over`) : t(`დარჩა ${fmtNum(goal - todaySteps)} ნაბიჯი`, `${fmtNum(goal - todaySteps)} steps to go`)),
          h('div', { class: 'card-sub' }, t(`≈ ${fmtNum(todaySteps * 0.000762, 1)} კმ · ≈ ${fmtNum(Math.round(todaySteps / 100))} აქტიური წუთი`, `≈ ${fmtNum(todaySteps * 0.000762, 1)} km · ≈ ${fmtNum(Math.round(todaySteps / 100))} active minutes`))))));
    side.append(stepsGoalCard(byDate));
    wrap.append(side);
    return wrap;
  }

  function stepsGoalCard(byDate) {
    const goal = state.app?.stepsGoal || null;
    if (!goal) {
      return card(
        h('div', { class: 'hstack', style: { marginBottom: '10px' } }, tile('trophy', 'green', 38), h('div', null, h('div', { class: 'card-title' }, t('ნაბიჯების მიზანი', 'Step goal')), h('div', { class: 'card-sub' }, t('დაისახე მიზანი და ვადა', 'Set a goal and a deadline')))),
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('მიზნის ნაბიჯები ითვლება დაწყების დღიდან, ტელეფონის სინქრონით.', 'Goal steps count from the start day, synced from your phone.')),
        button(t('მიზნის დაყენება', 'Set a goal'), { variant: 'secondary', size: 'sm', class: 'hm-mt', onClick: () => openStepsGoal(null) }));
    }
    let current = 0;
    for (const [date, row] of byDate) if (date >= goal.startedYmd && date <= ymd()) current += Math.max(0, Number(row.steps) || 0);
    const pct = Math.min(100, Math.round((current / Math.max(goal.targetSteps, 1)) * 100));
    const done = current >= goal.targetSteps;
    const daysLeft = Math.max(0, daysBetween(ymd(), goal.deadlineYmd));
    return card(
      h('div', { class: 'between', style: { marginBottom: '12px' } },
        h('div', { class: 'hstack' }, tile('trophy', 'green', 38), h('div', null, h('div', { class: 'card-title' }, t('ნაბიჯების მიზანი', 'Step goal')), h('div', { class: 'card-sub' }, t(`${fmtNum(goal.targetSteps)} ნაბიჯი · ${fmtDate(goal.deadlineYmd)}-მდე`, `${fmtNum(goal.targetSteps)} steps · by ${fmtDate(goal.deadlineYmd)}`)))),
        button(done ? t('ახალი', 'New') : t('შეცვლა', 'Change'), { variant: 'ghost', size: 'sm', onClick: () => openStepsGoal(goal) })),
      h('div', { class: 'between', style: { marginBottom: '8px' } }, h('b', { class: 'hm-big' }, fmtNum(current)), h('span', { class: 'muted', style: { fontSize: '13px' } }, done ? t('მიზანი მიღწეულია', 'Goal reached') : t(`დარჩა ${fmtNum(goal.targetSteps - current)}`, `${fmtNum(goal.targetSteps - current)} to go`))),
      progress(pct, 100, { ink: 'green' }),
      h('div', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, done ? t('გილოცავ! დაისახე შემდეგი მიზანი.', 'Congratulations! Set your next goal.') : t(`${daysLeft} დღე დარჩა · დაიწყო ${fmtDate(goal.startedYmd)}`, `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left · started ${fmtDate(goal.startedYmd)}`)));
  }

  function openStepsGoal(goal) {
    const deadline = goal && daysBetween(ymd(), goal.deadlineYmd) > 0 ? goal.deadlineYmd : addDaysYmd(ymd(), 21);
    formModal({
      title: t('ნაბიჯების მიზანი', 'Step goal'),
      size: 'sm',
      fields: [
        field(t('ნაბიჯების რაოდენობა', 'Number of steps'), input({ name: 'target', type: 'number', min: '500', max: '100000', step: '100', required: true, value: String(goal?.targetSteps || 5000) }), t('ითვლება დღეიდან ვადამდე ჯამში.', 'Counted in total from today until the deadline.')),
        field(t('ვადა', 'Deadline'), input({ name: 'deadline', type: 'date', required: true, min: addDaysYmd(ymd(), 1), max: addDaysYmd(ymd(), 365), value: deadline })),
        h('p', { class: 'disclaimer' }, t('შეხსენებებს ტელეფონზე MEDICARD აპი აგზავნის.', 'The MEDICARD app sends reminders to your phone.')),
      ],
      onSubmit: async (v, close) => {
        const target = Math.round(Number(v.target) / 100) * 100;
        if (!Number.isFinite(target) || target < 500 || target > 100_000) throw new Error(t('მიზანი 500–100 000 ნაბიჯი უნდა იყოს.', 'The goal must be 500–100,000 steps.'));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v.deadline) || v.deadline <= ymd()) throw new Error(t('აირჩიე მომავალი თარიღი.', 'Choose a future date.'));
        const next = {
          id: `goal-${Date.now()}`,
          targetSteps: target,
          deadlineYmd: v.deadline,
          startedYmd: ymd(),
          reminderEnabled: goal?.reminderEnabled ?? true,
          reminderDays: goal?.reminderDays ?? [1, 3, 5],
          reminderHour: goal?.reminderHour ?? 10,
          reminderMinute: goal?.reminderMinute ?? 0,
          updatedAt: new Date().toISOString(),
        };
        const res = await put('/api/account/app-state', { stepsGoal: next });
        state.app = res?.state || { ...(state.app || {}), stepsGoal: next };
        close();
        toast(t('მიზანი შენახულია', 'Goal saved'));
        render();
      },
    });
  }

  /* ── Water ── */
  function waterSection(byDate, keys) {
    const today = ymd();
    const goalMl = state.waterGoal;
    const values = keys.map((k) => Math.max(0, Number(byDate.get(k)?.hydrationMl) || 0));
    const todayMl = Math.max(0, Number(byDate.get(today)?.hydrationMl) || 0);
    const wrap = h('div', { class: 'grid grid-main hm-water-grid', id: 'hm-water' });

    const withData = values.filter((v) => v > 0);
    const avg = withData.length ? Math.round(withData.reduce((a, b) => a + b, 0) / withData.length) : 0;
    const reached = values.filter((v) => v >= goalMl).length;
    const best = Math.max(0, ...values);
    wrap.append(card({ class: 'pad-lg' },
      h('div', { class: 'hm-mini-stats' },
        miniStat(t(`საშუალო · ${range} დღე`, `Average · ${range} days`), withData.length ? fmtMl(avg) : '—'),
        miniStat(t('მიზანი შესრულდა', 'Goal reached'), t(`${reached} დღე`, `${reached} ${reached === 1 ? 'day' : 'days'}`)),
        miniStat(t('საუკეთესო დღე', 'Best day'), best ? fmtMl(best) : '—'),
        miniStat(t('დღის მიზანი', 'Daily goal'), fmtMl(goalMl))),
      withData.length
        ? barChart({ labels: keys.map(shortDay), tipLabels: keys.map((k) => fmtDate(k)), values, goal: goalMl, goalLabel: fmtMl(goalMl), color: 'var(--ink-sky)', unit: ML, fmt: (v) => fmtNum(v), height: 240 })
        : empty(t('წყლის ჩანაწერი ჯერ არ არის', 'No water logged yet'), t('დაამატე ჭიქა აქ ან აპში — ორივე ერთ დღიურში ჩაიწერება.', 'Add a glass here or in the app — both go into the same log.'))));

    // Spotlight: today
    const pct = goalMl ? Math.min(100, Math.round((todayMl / goalMl) * 100)) : 0;
    const spot = card({ class: 'spotlight hero-card hm-water-today' },
      h('div', { class: 'between' }, h('div', null, h('div', { class: 'card-title' }, t('დღეს', 'Today')), h('div', { class: 'card-sub' }, todayMl >= goalMl ? t('დღის მიზანი შესრულებულია', 'Daily goal reached') : t(`დარჩა ${fmtMl(goalMl - todayMl)}`, `${fmtMl(goalMl - todayMl)} to go`))), tile('droplet', 'sky', 38)),
      h('div', { class: 'hm-water-ring' },
        ring({ value: todayMl, max: goalMl, size: 150, stroke: 13, color: '#38bdf8', track: 'rgba(255,255,255,.12)', label: fmtMl(todayMl), labelScale: 0.15, sub: `${pct}% · ${fmtMl(goalMl)}` })),
      h('div', { class: 'hm-water-actions' },
        waterBtn(250), waterBtn(500),
        button(t('სხვა', 'Other'), { variant: 'light', size: 'sm', icon: 'glass', onClick: openWaterCustom })),
      h('p', { class: 'hm-water-note' }, t('ჭიქა აპშიც მაშინვე გამოჩნდება.', 'The glass shows up in the app right away.')));
    wrap.append(spot);
    return wrap;
  }

  function waterBtn(ml) {
    const b = button(`+${ml} ${ML}`, { variant: 'light', size: 'sm', icon: 'plus' });
    b.addEventListener('click', () => busy(b, () => doAddWater(ml)));
    return b;
  }

  async function doAddWater(ml) {
    try {
      const ev = await addWater(ml);
      await refreshToday();
      toast(t(`+${ml} მლ ჩაიწერა`, `+${ml} ml logged`), 'ok', { action: { label: t('გაუქმება', 'Undo'), onClick: () => { undoWater(ev).then(refreshToday).then(() => toast(t('გაუქმდა', 'Undone'), 'info')).catch((e) => toast(e.message, 'error')); } } });
    } catch (e) { toast(e.message || t('ვერ ჩაიწერა.', 'Couldn’t log it.'), 'error'); }
  }

  async function refreshToday() {
    try { const row = await readToday(); if (row) upsertDaily(row); } catch { /* last value stays */ }
    render();
  }

  function openWaterCustom() {
    formModal({
      title: t('წყლის დამატება', 'Add water'),
      size: 'sm',
      submit: t('დამატება', 'Add'),
      fields: [
        h('div', { class: 'chips hm-chips' }, [200, 350, 700].map((ml) => h('button', { type: 'button', class: 'chip', onClick: (e) => { e.currentTarget.closest('form').querySelector('[name=ml]').value = String(ml); } }, `${ml} ${ML}`))),
        field(t('რაოდენობა (მლ)', 'Amount (ml)'), input({ name: 'ml', type: 'number', min: '10', max: '3000', step: '10', required: true, value: '300' })),
      ],
      onSubmit: async (v, close) => {
        const ml = Math.round(Number(v.ml));
        if (!Number.isFinite(ml) || ml < 10 || ml > 3000) throw new Error(t('შეიყვანე 10–3000 მლ.', 'Enter 10–3000 ml.'));
        const ev = await addWater(ml);
        close();
        await refreshToday();
        toast(t(`+${ml} მლ ჩაიწერა`, `+${ml} ml logged`), 'ok', { action: { label: t('გაუქმება', 'Undo'), onClick: () => { undoWater(ev).then(refreshToday).catch((e) => toast(e.message, 'error')); } } });
      },
    });
  }

  function openWaterGoal() {
    formModal({
      title: t('წყლის დღიური მიზანი', 'Daily water goal'),
      size: 'sm',
      fields: [
        field(t('მიზანი (მლ)', 'Goal (ml)'), input({ name: 'ml', type: 'number', min: '250', max: '8000', step: '50', required: true, value: String(state.waterGoal) }), t('უმეტესობისთვის 1.5–2.5 ლიტრი საკმარისია; სიცხეში და ვარჯიშისას მეტი.', 'For most people 1.5–2.5 liters is enough; more in hot weather and when exercising.')),
      ],
      onSubmit: async (v, close) => {
        const ml = Math.round(Number(v.ml));
        if (!Number.isFinite(ml) || ml < 250 || ml > 8000) throw new Error(t('მიზანი 250–8000 მლ უნდა იყოს.', 'The goal must be 250–8000 ml.'));
        const res = await put('/api/health-metrics/hydration/goal', { goalMl: ml });
        state.waterGoal = res?.goalMl || ml;
        close();
        toast(t('მიზანი შენახულია', 'Goal saved'));
        render();
      },
    });
  }

  load();
  return () => { alive = false; };
}

/* ── Small pieces ── */
function miniStat(label, value, tone = '', sub = '') {
  return h('div', { class: 'hm-mini' }, h('span', null, label), h('b', { class: tone }, value), sub ? h('small', null, sub) : null);
}

/** Toward the goal is good; without a goal a change is neutral. */
function trendTone(delta, goal) {
  if (!goal || Math.abs(delta) < 0.05) return '';
  const want = goal.targetKg - goal.startKg;
  if (Math.abs(want) < 0.2) return Math.abs(delta) <= 0.5 ? 'good' : '';
  return Math.sign(delta) === Math.sign(want) ? 'good' : 'bad';
}

function stepsStatus(steps, goal) {
  const r = steps / goal;
  if (r >= 1) return t('დღიური მიზანი უკვე მიღწეულია', 'Daily goal already reached');
  if (r >= 0.75) return t('მიზანთან ახლოს ხარ', 'You’re close to your goal');
  if (r >= 0.4) return t('ჩვეულებრივზე უფრო აქტიური ხარ', 'You’re more active than usual');
  return t('დღეს ნაკლები აქტიურობაა', 'Less activity today');
}

/* ── Home card: today's steps + water rings, quick water, latest weight ── */
export function homeActivityCard() {
  ensureCss();
  const el = card({ class: 'hm-home' }, skeleton(3));
  let goalMl = WATER_DEFAULT_ML;
  let daily = [];

  const paint = () => {
    const today = ymd();
    const row = daily.find((d) => d.date === today) || {};
    const steps = Math.max(0, Number(row.steps) || 0);
    const water = Math.max(0, Number(row.hydrationMl) || 0);
    const stepsGoal = stepsGoalFromDaily(daily);
    const weights = daily.filter((d) => d.weightKg != null);
    const lastKg = weights.at(-1)?.weightKg ?? session.profile?.weightKg ?? null;
    const add = button(t('+250 მლ', '+250 ml'), { variant: 'secondary', size: 'sm', icon: 'droplet' });
    add.addEventListener('click', () => busy(add, async () => {
      try {
        const ev = await addWater(250);
        const fresh = await readToday().catch(() => null);
        if (fresh) { const i = daily.findIndex((d) => d.date === fresh.date); if (i >= 0) daily[i] = fresh; else daily.push(fresh); }
        else { const i = daily.findIndex((d) => d.date === today); if (i >= 0) daily[i] = { ...daily[i], hydrationMl: (Number(daily[i].hydrationMl) || 0) + 250 }; else daily.push({ date: today, hydrationMl: 250 }); }
        paint();
        toast(t('+250 მლ ჩაიწერა', '+250 ml logged'), 'ok', { action: { label: t('გაუქმება', 'Undo'), onClick: () => { undoWater(ev).then(() => readToday()).then((r) => { if (r) { const i = daily.findIndex((d) => d.date === r.date); if (i >= 0) daily[i] = r; } paint(); }).catch((e) => toast(e.message, 'error')); } } });
      } catch (e) { toast(e.message || t('ვერ ჩაიწერა.', 'Couldn’t log it.'), 'error'); }
    }));
    // Paused trackers (admin „მოდულები“) leave the card; the rest stay as they are.
    const showSteps = featureOn('steps'), showWater = featureOn('hydration');
    const ringItems = [
      showSteps ? { value: steps, max: stepsGoal, color: 'var(--c6)', name: t('ნაბიჯი', 'Steps') } : null,
      showWater ? { value: water, max: goalMl, color: 'var(--c5)', name: t('წყალი', 'Water') } : null,
    ].filter(Boolean);
    mount(el,
      !ringItems.length ? null : h('div', { class: 'hm-home-top' },
        rings(ringItems, { size: 124, stroke: 12, gap: 5 }),
        h('div', { class: 'stack hm-home-legend', style: { gap: '12px' } },
          !showSteps ? null : h('a', { class: 'hm-home-metric', href: '/health', 'data-link': '' },
            h('i', { style: { background: 'var(--c6)' } }),
            h('div', null, h('span', null, t('ნაბიჯი', 'Steps')), h('b', null, fmtNum(steps), h('small', null, ` / ${fmtNum(stepsGoal)}`)))),
          !showWater ? null : h('a', { class: 'hm-home-metric', href: '/health', 'data-link': '' },
            h('i', { style: { background: 'var(--c5)' } }),
            h('div', null, h('span', null, t('წყალი', 'Water')), h('b', null, fmtNum(water), h('small', null, ` / ${fmtNum(goalMl)} ${ML}`)))),
          showWater ? add : null)),
      !featureOn('weight') ? null : h('a', { class: 'hm-home-weight', href: '/health', 'data-link': '' },
        tile('scale', 'violet', 34),
        h('div', { class: 'row-main' },
          h('div', { class: 'row-sub' }, t('წონა', 'Weight')),
          h('div', { class: 'row-title' }, lastKg != null ? `${fmtKg(lastKg)} ${KG}` : t('ჯერ არ ჩაგიწერია', 'Nothing logged yet'))),
        weights.length > 1 ? sparkline(weights.map((d) => Number(d.weightKg)), { width: 96, height: 30, color: 'var(--ink-violet)' }) : null,
        icon('chevronRight', { size: 18, className: 'row-chev' })));
  };

  const loadCard = async () => {
    mount(el, skeleton(3));
    try {
      const [d, g] = await Promise.all([
        get('/api/health-metrics/daily', { from: addDaysYmd(ymd(), -29), to: ymd() }),
        get('/api/health-metrics/hydration/goal').catch(() => null),
      ]);
      daily = d?.daily || [];
      goalMl = g?.goalMl && g.goalMl >= 250 ? g.goalMl : WATER_DEFAULT_ML;
      paint();
    } catch (e) {
      mount(el, errorBox(e, loadCard));
    }
  };
  loadCard().catch(() => {});
  return el;
}
