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
import { session, setProfile } from '../session.js';

const CSS = '/app/css/health.css';
const APP_STORE = 'https://apps.apple.com/app/id6812517519';
/** Same daily reference as the app (constants/figmaStepsLayout DEFAULT_STEPS_GOAL). */
const STEPS_DAY_GOAL = 10_000;
const WATER_DEFAULT_ML = 2000;
const PACE_KG = { slow: 0.25, moderate: 0.5, fast: 0.75 };
const PACE_LABEL = { slow: 'მშვიდი', moderate: 'ზომიერი', fast: 'სწრაფი' };
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
  if (bmi < 18.5) return { key: 'under', label: 'ნორმაზე ნაკლები', tone: 'sky' };
  if (bmi < 25) return { key: 'normal', label: 'ჯანსაღ დიაპაზონში', tone: 'teal' };
  if (bmi < 30) return { key: 'over', label: 'ნორმაზე მეტი', tone: 'amber' };
  return { key: 'obese', label: 'მნიშვნელოვნად მეტი', tone: 'rose' };
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
function fmtMl(ml) { return ml >= 1000 ? `${fmtNum(ml / 1000, 2)} ლ` : `${fmtNum(ml)} მლ`; }
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
    [{ value: 7, label: '7 დღე' }, { value: 30, label: '30 დღე' }, { value: 90, label: '90 დღე' }],
    range,
    (v) => { range = v; render(); },
  );
  const body = h('div', { class: 'hm-page' });
  mount(root,
    pageHead('მაჩვენებლები', 'წონა, ნაბიჯები და წყალი — ტენდენციები დროში.', rangeSeg),
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
    mount(body,
      overview(history, byDate),
      section('წონა', weightSection(history, keys), { action: button('წონის ჩაწერა', { size: 'sm', icon: 'plus', onClick: openWeightLog }) }),
      section('ნაბიჯები', stepsSection(byDate, keys)),
      section('წყალი', waterSection(byDate, keys), { action: button('მიზანი', { size: 'sm', variant: 'ghost', icon: 'target', onClick: openWaterGoal }) }));
  }

  /* KPI row */
  function overview(history, byDate) {
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
      kpi('scale', 'violet', 'წონა', fmtKg(current), current != null ? 'კგ' : '', history.length ? `ბოლო ჩანაწერი: ${fmtDate(history.at(-1).date)}` : 'ჯერ არ ჩაგიწერია',
        sparkline(history.slice(-14).map((p) => p.kg), { width: 90, height: 30, color: 'var(--ink-violet)' }), 'hm-weight'),
      kpi('footprints', 'green', 'ნაბიჯი დღეს', fmtNum(steps), '', `მიზანი ${fmtNum(STEPS_DAY_GOAL)}`,
        sparkline(last14.map((k) => Number(byDate.get(k)?.steps) || 0), { width: 90, height: 30, color: 'var(--ink-green)' }), 'hm-steps'),
      kpi('droplet', 'sky', 'წყალი დღეს', fmtMl(water), '', `მიზანი ${fmtMl(state.waterGoal)}`,
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
        history.length ? `ბოლო ${range} დღეში ჩანაწერი არ არის` : 'ჯერ წონა არ ჩაგიწერია',
        history.length ? `ბოლოს ჩაწერე ${fmtDate(history.at(-1).date)}. აირჩიე უფრო გრძელი პერიოდი ან ჩაწერე დღევანდელი.` : 'კვირაში ერთი ჩანაწერიც საკმარისია ტენდენციისთვის — უმჯობესია დილით.',
        button('წონის ჩაწერა', { icon: 'plus', onClick: openWeightLog }));
    } else {
      const first = inRange[0].kg;
      const last = inRange.at(-1).kg;
      const avg = round1(inRange.reduce((s, p) => s + p.kg, 0) / inRange.length);
      const delta = inRange.length > 1 ? last - first : null;
      chartBody = h('div', { class: 'stack', style: { gap: '16px' } },
        h('div', { class: 'hm-mini-stats' },
          miniStat('მიმდინარე', `${fmtKg(current)} კგ`),
          miniStat(`ცვლილება · ${range} დღე`, delta == null ? '—' : `${signed(delta, 1)} კგ`, delta == null ? '' : trendTone(delta, goal)),
          miniStat('საშუალო', `${fmtKg(avg)} კგ`),
          miniStat('ჩანაწერი', fmtNum(inRange.length))),
        lineChart({
          labels: inRange.map((p) => shortDay(p.date)),
          tipLabels: inRange.map((p) => fmtDate(p.date)),
          series: [{ name: 'წონა', values: inRange.map((p) => p.kg), color: 'var(--ink-violet)', dots: inRange.length <= 31 }],
          goal: goal?.targetKg ?? null,
          goalLabel: goal ? `მიზანი ${fmtKg(goal.targetKg)} კგ` : null,
          unit: 'კგ',
          zero: false,
          fmt: (v) => fmtNum(v, 1),
          height: 240,
          ariaLabel: 'წონის დინამიკა',
        }));
    }
    wrap.append(card({ class: 'pad-lg' }, chartBody));

    // Side: goal, BMI, recent logs
    const side = h('div', { class: 'stack', style: { gap: '16px' } });
    side.append(goalCard(goal, current));
    side.append(bmiCard(current, heightCm));
    if (history.length) {
      side.append(card(
        h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'ბოლო ჩანაწერები')),
        h('div', { class: 'list' }, history.slice(-6).reverse().map((p, i) => {
          const prev = history[history.length - 2 - i];
          const d = prev ? p.kg - prev.kg : null;
          return h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, `${fmtKg(p.kg)} კგ`), h('div', { class: 'row-sub' }, fmtDate(p.date))),
            h('div', { class: 'row-trail' }, d == null || Math.abs(d) < 0.05 ? h('span', { class: 'faint' }, '—') : h('span', { class: `hm-delta ${trendTone(d, goal)}` }, `${signed(d, 1)} კგ`)));
        }))));
    }
    wrap.append(side);
    return wrap;
  }

  function goalCard(goal, current) {
    if (!goal || current == null) {
      return card({ class: 'hm-goal' },
        h('div', { class: 'hstack', style: { marginBottom: '10px' } }, tile('target', 'violet', 38), h('div', null, h('div', { class: 'card-title' }, 'წონის მიზანი'), h('div', { class: 'card-sub' }, 'შენი ტემპით, უსაფრთხოდ'))),
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, current == null ? 'ჯერ ჩაწერე მიმდინარე წონა — შემდეგ მიზანს დააყენებ.' : 'დააყენე სამიზნე წონა — გრაფიკზე მიზნის ხაზი და პროგრესი გამოჩნდება.'),
        button(current == null ? 'წონის ჩაწერა' : 'მიზნის დაყენება', { variant: 'secondary', size: 'sm', onClick: current == null ? openWeightLog : () => openWeightGoal(goal, current), class: 'hm-mt' }));
    }
    const p = goalProgress(goal, current);
    return card({ class: 'hm-goal' },
      h('div', { class: 'between', style: { marginBottom: '12px' } },
        h('div', { class: 'hstack' }, tile('target', 'violet', 38), h('div', null, h('div', { class: 'card-title' }, 'წონის მიზანი'), h('div', { class: 'card-sub' }, `${fmtKg(goal.startKg)} → ${fmtKg(goal.targetKg)} კგ`))),
        button('შეცვლა', { variant: 'ghost', size: 'sm', onClick: () => openWeightGoal(goal, current) })),
      p.completed
        ? h('p', { class: 'hm-goal-done' }, icon('check', { size: 16 }), 'მიზანი მიღწეულია — გილოცავ!')
        : h('div', { class: 'stack', style: { gap: '8px' } },
          h('div', { class: 'between' }, h('b', { class: 'hm-big' }, `${p.percent}%`), h('span', { class: 'muted', style: { fontSize: '13px' } }, `დარჩა ${fmtKg(p.remaining)} კგ`)),
          progress(p.percent, 100, { ink: 'violet' }),
          h('div', { class: 'between', style: { fontSize: '12.5px' } },
            h('span', { class: 'faint' }, `ორიენტირი: ${fmtDate(goal.deadlineYmd, { year: true })}`),
            p.onTrack ? badge('გეგმის მიხედვით', 'ok') : badge(`${p.daysLeft} დღე დარჩა`, 'neutral'))),
      h('p', { class: 'disclaimer', style: { marginTop: '12px' } }, 'ეს ორიენტირია, არა ექიმის დანიშნულება.'));
  }

  function bmiCard(kg, heightCm) {
    const bmi = bmiOf(kg, heightCm);
    if (bmi == null) {
      return card(
        h('div', { class: 'hstack' }, tile('activity', 'teal', 38), h('div', null, h('div', { class: 'card-title' }, 'სხეულის მასის ინდექსი'), h('div', { class: 'card-sub' }, heightCm ? 'ჩაწერე წონა და ინდექსი დაითვლება.' : 'პროფილში მიუთითე სიმაღლე — ინდექსი ავტომატურად დაითვლება.'))),
        heightCm ? null : h('a', { class: 'link hm-mt', href: '/profile', 'data-link': '' }, 'პროფილის გახსნა', icon('chevronRight', { size: 16 })));
    }
    const cat = bmiCategory(bmi);
    const m = heightCm / 100;
    const lo = round1(18.5 * m * m);
    const hi = round1(24.9 * m * m);
    const t = Math.min(1, Math.max(0, (bmi - 15) / 25));
    return card(
      h('div', { class: 'between', style: { marginBottom: '12px' } },
        h('div', { class: 'hstack' }, tile('activity', cat.tone, 38), h('div', null, h('div', { class: 'card-title' }, 'სხეულის მასის ინდექსი'), h('div', { class: 'card-sub' }, `სიმაღლე ${fmtNum(heightCm)} სმ`))),
        h('b', { class: 'hm-big' }, fmtNum(bmi, 1))),
      h('div', { class: 'hm-bmi-scale', 'aria-hidden': 'true' }, h('i', { style: { left: `${t * 100}%` } })),
      h('div', { class: 'hm-bmi-ticks' }, h('span', null, '15'), h('span', null, '18.5'), h('span', null, '25'), h('span', null, '30'), h('span', null, '40')),
      h('p', { class: 'muted', style: { fontSize: '13px', marginTop: '10px' } }, `${cat.label}. შენი სიმაღლისთვის ჯანსაღი დიაპაზონი ≈ ${fmtKg(lo)}–${fmtKg(hi)} კგ.`),
      h('p', { class: 'disclaimer', style: { marginTop: '8px' } }, 'ინდექსი ზოგადი ორიენტირია — კუნთის მასას და სხეულის აგებულებას არ ითვალისწინებს.'));
  }

  function openWeightLog() {
    const history = weightHistory(state.daily, state.app?.weightLogs);
    const last = history.at(-1)?.kg ?? session.profile?.weightKg ?? '';
    formModal({
      title: 'წონის ჩაწერა',
      size: 'sm',
      submit: 'შენახვა',
      fields: [
        field('წონა (კგ)', input({ name: 'kg', type: 'number', inputmode: 'decimal', step: '0.1', min: '30', max: '250', value: last === '' ? '' : String(last), required: true, placeholder: 'მაგ: 68.4' }), 'დღევანდელი ჩანაწერი ჩაანაცვლებს დღის წინა მნიშვნელობას.'),
      ],
      onSubmit: async (v, close) => {
        const n = Number(String(v.kg).replace(',', '.'));
        if (!Number.isFinite(n) || n < 30 || n > 250) throw new Error('შეიყვანე წონა 30–250 კგ-ს შორის.');
        const kg = clampKg(n);
        const next = await logWeight(kg);
        if (next) state.app = next;
        upsertDaily({ ...(state.daily.find((d) => d.date === ymd()) || { date: ymd() }), weightKg: kg });
        close();
        toast('წონა შენახულია');
        render();
      },
    });
  }

  function openWeightGoal(goal, current) {
    const start = current ?? goal?.startKg ?? 70;
    const targetIn = input({ name: 'target', type: 'number', inputmode: 'decimal', step: '0.1', min: '30', max: '250', required: true, value: String(goal?.targetKg ?? clampKg(start - 3)) });
    const paceSel = select([
      { value: 'slow', label: `მშვიდი · ${PACE_KG.slow} კგ კვირაში` },
      { value: 'moderate', label: `ზომიერი · ${PACE_KG.moderate} კგ კვირაში` },
      { value: 'fast', label: `სწრაფი · ${PACE_KG.fast} კგ კვირაში` },
    ], goal?.pace || 'moderate', { name: 'pace' });
    const preview = h('p', { class: 'muted', style: { fontSize: '13px' } });
    const update = () => {
      const target = Number(String(targetIn.value).replace(',', '.'));
      if (!Number.isFinite(target)) { preview.textContent = ''; return; }
      const hold = Math.abs(target - start) < 0.2;
      preview.textContent = hold
        ? 'შენარჩუნების მიზანი: მიმდინარე წონის შენარჩუნება.'
        : `${target < start ? 'კლება' : 'მატება'} ${fmtKg(Math.abs(target - start))} კგ · ორიენტირი ${fmtDate(deadlineFromPace(start, target, hold ? 'slow' : paceSel.value), { year: true })}`;
    };
    targetIn.addEventListener('input', update);
    paceSel.addEventListener('change', update);
    update();
    formModal({
      title: goal ? 'წონის მიზნის შეცვლა' : 'წონის მიზანი',
      size: 'sm',
      fields: [
        h('div', { class: 'hm-goal-from' }, h('span', { class: 'faint' }, 'ახლა'), h('b', null, `${fmtKg(start)} კგ`)),
        field('სამიზნე წონა (კგ)', targetIn),
        field('ტემპი', paceSel, 'ნელი ცვლილების შენარჩუნება უფრო ადვილია. მომატებისას ან ქრონიკული მდგომარეობისას აირჩიე მშვიდი ტემპი.'),
        preview,
        h('p', { class: 'disclaimer' }, 'ეს ორიენტირია, არა ექიმის დანიშნულება. თუ კვების გეგმა გაქვს, მიზნის შეცვლის შემდეგ გეგმასაც გადაამოწმებ.'),
      ],
      onSubmit: async (v, close) => {
        const target = Number(String(v.target).replace(',', '.'));
        if (!Number.isFinite(target) || target < 30 || target > 250) throw new Error('სამიზნე წონა 30–250 კგ-ს შორის უნდა იყოს.');
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
        toast(pace !== v.pace ? `მიზანი შენახულია · ტემპი: ${PACE_LABEL[pace]}` : 'მიზანი შენახულია');
        render();
      },
    });
  }

  /* ── Steps ── */
  function stepsSection(byDate, keys) {
    const today = ymd();
    const values = keys.map((k) => Math.max(0, Number(byDate.get(k)?.steps) || 0));
    const anySteps = state.daily.some((d) => Number(d.steps) > 0);
    const wrap = h('div', { class: 'grid grid-main', id: 'hm-steps' });
    const todaySteps = Math.max(0, Number(byDate.get(today)?.steps) || 0);
    const syncedAt = byDate.get(today)?.syncedAt || [...state.daily].reverse().find((d) => d.steps != null)?.syncedAt;

    if (!anySteps) {
      wrap.append(card({ class: 'pad-lg' }, empty('ნაბიჯები ჯერ არ სინქრონდება',
        'ნაბიჯებს ტელეფონი ითვლის — MEDICARD აპი მათ Apple Health-იდან ან Health Connect-იდან აქ გადმოიტანს.',
        button('აპის ჩამოტვირთვა', { href: APP_STORE, external: true, variant: 'secondary', icon: 'smartphone' }))));
      wrap.append(stepsGoalCard(byDate));
      return wrap;
    }

    const withData = values.filter((v) => v > 0);
    const avg = withData.length ? Math.round(withData.reduce((a, b) => a + b, 0) / withData.length) : 0;
    const best = Math.max(0, ...values);
    const bestIdx = values.indexOf(best);
    const reached = values.filter((v) => v >= STEPS_DAY_GOAL).length;
    const total = values.reduce((a, b) => a + b, 0);
    wrap.append(card({ class: 'pad-lg' },
      h('div', { class: 'hm-mini-stats' },
        miniStat('დღეს', fmtNum(todaySteps)),
        miniStat(`საშუალო · ${range} დღე`, fmtNum(avg)),
        miniStat('საუკეთესო დღე', best ? `${fmtNum(best)}` : '—', '', best && bestIdx >= 0 ? fmtDate(keys[bestIdx]) : ''),
        miniStat('მიზანი შესრულდა', `${reached} დღე`)),
      barChart({
        labels: keys.map(shortDay),
        tipLabels: keys.map((k) => fmtDate(k)),
        values,
        goal: STEPS_DAY_GOAL,
        goalLabel: `${fmtNum(STEPS_DAY_GOAL)}`,
        color: 'var(--ink-green)',
        unit: 'ნაბიჯი',
        fmt: (v) => fmtNum(v),
        height: 240,
      }),
      h('div', { class: 'between hm-foot' },
        h('span', { class: 'faint' }, `სულ ${fmtNum(total)} ნაბიჯი · ≈ ${fmtNum(total * 0.000762, 1)} კმ`),
        h('span', { class: 'faint hstack', style: { gap: '6px' } }, icon('smartphone', { size: 14 }), syncedAt ? `სინქრონი აპიდან · ${fmtDate(syncedAt)}` : 'სინქრონდება აპიდან'))));

    const side = h('div', { class: 'stack', style: { gap: '16px' } });
    const pct = Math.min(100, Math.round((todaySteps / STEPS_DAY_GOAL) * 100));
    side.append(card(
      h('div', { class: 'hstack', style: { gap: '18px' } },
        ring({ value: todaySteps, max: STEPS_DAY_GOAL, size: 112, stroke: 11, color: 'var(--ink-green)', label: `${pct}%`, sub: 'დღეს' }),
        h('div', { class: 'stack', style: { gap: '4px' } },
          h('div', { class: 'card-title' }, stepsStatus(todaySteps)),
          h('div', { class: 'card-sub' }, todaySteps >= STEPS_DAY_GOAL ? `${fmtNum(todaySteps - STEPS_DAY_GOAL)} ნაბიჯით მეტი` : `დარჩა ${fmtNum(STEPS_DAY_GOAL - todaySteps)} ნაბიჯი`),
          h('div', { class: 'card-sub' }, `≈ ${fmtNum(todaySteps * 0.000762, 1)} კმ · ≈ ${fmtNum(Math.round(todaySteps / 100))} აქტიური წუთი`)))));
    side.append(stepsGoalCard(byDate));
    wrap.append(side);
    return wrap;
  }

  function stepsGoalCard(byDate) {
    const goal = state.app?.stepsGoal || null;
    if (!goal) {
      return card(
        h('div', { class: 'hstack', style: { marginBottom: '10px' } }, tile('trophy', 'green', 38), h('div', null, h('div', { class: 'card-title' }, 'ნაბიჯების მიზანი'), h('div', { class: 'card-sub' }, 'დაისახე მიზანი და ვადა'))),
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'მიზნის ნაბიჯები ითვლება დაწყების დღიდან, ტელეფონის სინქრონით.'),
        button('მიზნის დაყენება', { variant: 'secondary', size: 'sm', class: 'hm-mt', onClick: () => openStepsGoal(null) }));
    }
    let current = 0;
    for (const [date, row] of byDate) if (date >= goal.startedYmd && date <= ymd()) current += Math.max(0, Number(row.steps) || 0);
    const pct = Math.min(100, Math.round((current / Math.max(goal.targetSteps, 1)) * 100));
    const done = current >= goal.targetSteps;
    const daysLeft = Math.max(0, daysBetween(ymd(), goal.deadlineYmd));
    return card(
      h('div', { class: 'between', style: { marginBottom: '12px' } },
        h('div', { class: 'hstack' }, tile('trophy', 'green', 38), h('div', null, h('div', { class: 'card-title' }, 'ნაბიჯების მიზანი'), h('div', { class: 'card-sub' }, `${fmtNum(goal.targetSteps)} ნაბიჯი · ${fmtDate(goal.deadlineYmd)}-მდე`))),
        button(done ? 'ახალი' : 'შეცვლა', { variant: 'ghost', size: 'sm', onClick: () => openStepsGoal(goal) })),
      h('div', { class: 'between', style: { marginBottom: '8px' } }, h('b', { class: 'hm-big' }, fmtNum(current)), h('span', { class: 'muted', style: { fontSize: '13px' } }, done ? 'მიზანი მიღწეულია' : `დარჩა ${fmtNum(goal.targetSteps - current)}`)),
      progress(pct, 100, { ink: 'green' }),
      h('div', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, done ? 'გილოცავ! დაისახე შემდეგი მიზანი.' : `${daysLeft} დღე დარჩა · დაიწყო ${fmtDate(goal.startedYmd)}`));
  }

  function openStepsGoal(goal) {
    const deadline = goal && daysBetween(ymd(), goal.deadlineYmd) > 0 ? goal.deadlineYmd : addDaysYmd(ymd(), 21);
    formModal({
      title: 'ნაბიჯების მიზანი',
      size: 'sm',
      fields: [
        field('ნაბიჯების რაოდენობა', input({ name: 'target', type: 'number', min: '500', max: '100000', step: '100', required: true, value: String(goal?.targetSteps || 5000) }), 'ითვლება დღეიდან ვადამდე ჯამში.'),
        field('ვადა', input({ name: 'deadline', type: 'date', required: true, min: addDaysYmd(ymd(), 1), max: addDaysYmd(ymd(), 365), value: deadline })),
        h('p', { class: 'disclaimer' }, 'შეხსენებებს ტელეფონზე MEDICARD აპი აგზავნის.'),
      ],
      onSubmit: async (v, close) => {
        const target = Math.round(Number(v.target) / 100) * 100;
        if (!Number.isFinite(target) || target < 500 || target > 100_000) throw new Error('მიზანი 500–100 000 ნაბიჯი უნდა იყოს.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v.deadline) || v.deadline <= ymd()) throw new Error('აირჩიე მომავალი თარიღი.');
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
        toast('მიზანი შენახულია');
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
        miniStat(`საშუალო · ${range} დღე`, withData.length ? fmtMl(avg) : '—'),
        miniStat('მიზანი შესრულდა', `${reached} დღე`),
        miniStat('საუკეთესო დღე', best ? fmtMl(best) : '—'),
        miniStat('დღის მიზანი', fmtMl(goalMl))),
      withData.length
        ? barChart({ labels: keys.map(shortDay), tipLabels: keys.map((k) => fmtDate(k)), values, goal: goalMl, goalLabel: fmtMl(goalMl), color: 'var(--ink-sky)', unit: 'მლ', fmt: (v) => fmtNum(v), height: 240 })
        : empty('წყლის ჩანაწერი ჯერ არ არის', 'დაამატე ჭიქა აქ ან აპში — ორივე ერთ დღიურში ჩაიწერება.')));

    // Spotlight: today
    const pct = goalMl ? Math.min(100, Math.round((todayMl / goalMl) * 100)) : 0;
    const spot = card({ class: 'spotlight hero-card hm-water-today' },
      h('div', { class: 'between' }, h('div', null, h('div', { class: 'card-title' }, 'დღეს'), h('div', { class: 'card-sub' }, todayMl >= goalMl ? 'დღის მიზანი შესრულებულია' : `დარჩა ${fmtMl(goalMl - todayMl)}`)), tile('droplet', 'sky', 38)),
      h('div', { class: 'hm-water-ring' },
        ring({ value: todayMl, max: goalMl, size: 150, stroke: 13, color: '#38bdf8', track: 'rgba(255,255,255,.12)', label: fmtMl(todayMl), labelScale: 0.15, sub: `${pct}% · ${fmtMl(goalMl)}` })),
      h('div', { class: 'hm-water-actions' },
        waterBtn(250), waterBtn(500),
        button('სხვა', { variant: 'light', size: 'sm', icon: 'glass', onClick: openWaterCustom })),
      h('p', { class: 'hm-water-note' }, 'ჭიქა აპშიც მაშინვე გამოჩნდება.'));
    wrap.append(spot);
    return wrap;
  }

  function waterBtn(ml) {
    const b = button(`+${ml} მლ`, { variant: 'light', size: 'sm', icon: 'plus' });
    b.addEventListener('click', () => busy(b, () => doAddWater(ml)));
    return b;
  }

  async function doAddWater(ml) {
    try {
      const ev = await addWater(ml);
      await refreshToday();
      toast(`+${ml} მლ ჩაიწერა`, 'ok', { action: { label: 'გაუქმება', onClick: () => { undoWater(ev).then(refreshToday).then(() => toast('გაუქმდა', 'info')).catch((e) => toast(e.message, 'error')); } } });
    } catch (e) { toast(e.message || 'ვერ ჩაიწერა.', 'error'); }
  }

  async function refreshToday() {
    try { const row = await readToday(); if (row) upsertDaily(row); } catch { /* last value stays */ }
    render();
  }

  function openWaterCustom() {
    formModal({
      title: 'წყლის დამატება',
      size: 'sm',
      submit: 'დამატება',
      fields: [
        h('div', { class: 'chips hm-chips' }, [200, 350, 700].map((ml) => h('button', { type: 'button', class: 'chip', onClick: (e) => { e.currentTarget.closest('form').querySelector('[name=ml]').value = String(ml); } }, `${ml} მლ`))),
        field('რაოდენობა (მლ)', input({ name: 'ml', type: 'number', min: '10', max: '3000', step: '10', required: true, value: '300' })),
      ],
      onSubmit: async (v, close) => {
        const ml = Math.round(Number(v.ml));
        if (!Number.isFinite(ml) || ml < 10 || ml > 3000) throw new Error('შეიყვანე 10–3000 მლ.');
        const ev = await addWater(ml);
        close();
        await refreshToday();
        toast(`+${ml} მლ ჩაიწერა`, 'ok', { action: { label: 'გაუქმება', onClick: () => { undoWater(ev).then(refreshToday).catch((e) => toast(e.message, 'error')); } } });
      },
    });
  }

  function openWaterGoal() {
    formModal({
      title: 'წყლის დღიური მიზანი',
      size: 'sm',
      fields: [
        field('მიზანი (მლ)', input({ name: 'ml', type: 'number', min: '250', max: '8000', step: '50', required: true, value: String(state.waterGoal) }), 'უმეტესობისთვის 1.5–2.5 ლიტრი საკმარისია; სიცხეში და ვარჯიშისას მეტი.'),
      ],
      onSubmit: async (v, close) => {
        const ml = Math.round(Number(v.ml));
        if (!Number.isFinite(ml) || ml < 250 || ml > 8000) throw new Error('მიზანი 250–8000 მლ უნდა იყოს.');
        const res = await put('/api/health-metrics/hydration/goal', { goalMl: ml });
        state.waterGoal = res?.goalMl || ml;
        close();
        toast('მიზანი შენახულია');
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

function stepsStatus(steps) {
  const r = steps / STEPS_DAY_GOAL;
  if (r >= 1) return 'დღიური მიზანი უკვე მიღწეულია';
  if (r >= 0.75) return 'მიზანთან ახლოს ხარ';
  if (r >= 0.4) return 'ჩვეულებრივზე უფრო აქტიური ხარ';
  return 'დღეს ნაკლები აქტიურობაა';
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
    const weights = daily.filter((d) => d.weightKg != null);
    const lastKg = weights.at(-1)?.weightKg ?? session.profile?.weightKg ?? null;
    const add = button('+250 მლ', { variant: 'secondary', size: 'sm', icon: 'droplet' });
    add.addEventListener('click', () => busy(add, async () => {
      try {
        const ev = await addWater(250);
        const fresh = await readToday().catch(() => null);
        if (fresh) { const i = daily.findIndex((d) => d.date === fresh.date); if (i >= 0) daily[i] = fresh; else daily.push(fresh); }
        else { const i = daily.findIndex((d) => d.date === today); if (i >= 0) daily[i] = { ...daily[i], hydrationMl: (Number(daily[i].hydrationMl) || 0) + 250 }; else daily.push({ date: today, hydrationMl: 250 }); }
        paint();
        toast('+250 მლ ჩაიწერა', 'ok', { action: { label: 'გაუქმება', onClick: () => { undoWater(ev).then(() => readToday()).then((r) => { if (r) { const i = daily.findIndex((d) => d.date === r.date); if (i >= 0) daily[i] = r; } paint(); }).catch((e) => toast(e.message, 'error')); } } });
      } catch (e) { toast(e.message || 'ვერ ჩაიწერა.', 'error'); }
    }));
    mount(el,
      h('div', { class: 'hm-home-top' },
        rings([
          { value: steps, max: STEPS_DAY_GOAL, color: 'var(--c6)', name: 'ნაბიჯი' },
          { value: water, max: goalMl, color: 'var(--c5)', name: 'წყალი' },
        ], { size: 124, stroke: 12, gap: 5 }),
        h('div', { class: 'stack hm-home-legend', style: { gap: '12px' } },
          h('a', { class: 'hm-home-metric', href: '/health', 'data-link': '' },
            h('i', { style: { background: 'var(--c6)' } }),
            h('div', null, h('span', null, 'ნაბიჯი'), h('b', null, fmtNum(steps), h('small', null, ` / ${fmtNum(STEPS_DAY_GOAL)}`)))),
          h('a', { class: 'hm-home-metric', href: '/health', 'data-link': '' },
            h('i', { style: { background: 'var(--c5)' } }),
            h('div', null, h('span', null, 'წყალი'), h('b', null, fmtNum(water), h('small', null, ` / ${fmtNum(goalMl)} მლ`)))),
          add)),
      h('a', { class: 'hm-home-weight', href: '/health', 'data-link': '' },
        tile('scale', 'violet', 34),
        h('div', { class: 'row-main' },
          h('div', { class: 'row-sub' }, 'წონა'),
          h('div', { class: 'row-title' }, lastKg != null ? `${fmtKg(lastKg)} კგ` : 'ჯერ არ ჩაგიწერია')),
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
