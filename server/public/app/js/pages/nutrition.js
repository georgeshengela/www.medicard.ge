// MEDICARD web — „კვება“: day dashboard (left) and diary (right).
// Mirrors mobile/app/nutrition*.tsx, components/nutrition/NutritionHub and docs/NUTRITION.md.
// Endpoints (same as the app):
//   GET  /api/nutrition/program/dashboard     today: targets, budget (target + burned + rollover, computed by the server),
//                                             macros, week, streak, water, steps, projection, fasting, measurements
//   GET  /api/nutrition/meals?from&to          diary rows ·  PUT/DELETE /api/nutrition/meals/:id  ·  POST /meals/copy
//   GET  /api/nutrition/settings               photoEnabled (AI estimate kill switch)
//   GET  /api/nutrition/foods/search?q         saved → Georgian catalog → Open Food Facts / USDA (through our server)
//   GET  /api/nutrition/foods/recent · POST /foods/used · POST /foods/from-item
//   POST /api/nutrition/estimate               mode=text|photo|label|fix — always inside withAiConsent; the result stays
//                                             an unsaved draft until the person presses „შენახვა“
//   GET/PUT/DELETE /api/nutrition/activities · PUT /api/nutrition/preferences · PUT /api/nutrition/measurements/:date
//   GET  /api/nutrition/fasting · POST /fasting/start · POST /fasting/:id/end (server enforces every safety guard)
import { get, post, put, del, request } from '../api.js';
import {
  h, mount, clear, icon, tile, pageHead, section, card, button, iconButton, busy, badge, empty, skeleton, errorBox,
  segmented, field, input, textarea, select, toggle, toast, openModal, formModal, confirmDialog,
  fmtDate, fmtTime, fmtNum, ymd, addDays, parseDate, relDay, debounce, KA_DAYS_SHORT,
} from '../ui.js';
import { ring, donut, meters, barChart, lineChart } from '../charts.js';
import { withAiConsent } from '../aiConsent.js';
import { featureOn } from '../session.js';

const CSS = '/app/css/nutrition.css';
const APP_STORE = 'https://apps.apple.com/app/id6812517519';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS = { breakfast: 'საუზმე', lunch: 'სადილი', dinner: 'ვახშამი', snack: 'წახემსება' };
const MEAL_ICON = { breakfast: ['sun', 'amber'], lunch: ['utensils', 'teal'], dinner: ['moon', 'violet'], snack: ['apple', 'rose'] };
const SOURCE_LABELS = {
  manual: 'ხელით', photo: 'ფოტოდან', plan: 'რაციონიდან', text: 'აღწერიდან', voice: 'ხმით',
  label: 'ეტიკეტიდან', barcode: 'შტრიხკოდით', search: 'ბაზიდან', saved: 'შენახულიდან',
};
const MACRO = {
  protein: { name: 'ცილა', short: 'ც', color: 'var(--c2)', kcal: 4 },
  carbs: { name: 'ნახშირწყალი', short: 'ნ', color: 'var(--c3)', kcal: 4 },
  fat: { name: 'ცხიმი', short: 'ცხ', color: 'var(--c4)', kcal: 9 },
};
const UNCERTAINTY = {
  low: 'შეფასება საკმაოდ ზუსტია',
  medium: 'შეფასება მიახლოებითია',
  high: 'პორცია განსაკუთრებით ყურადღებით გადაამოწმე',
};
const AI_NOTE = 'AI შეფასებას შენახვამდე ყოველთვის გადაამოწმებ — არაფერი ინახება შენ გარეშე.';

function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

/* ── Pure helpers (ported from mobile/src/lib/nutrition.ts and server lib/nutrition.js) ── */
const round1 = (n) => Math.round(n * 10) / 10;
const shiftDay = (key, n) => ymd(addDays(parseDate(key), n));
export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
function mealTypeForHour(hour = new Date().getHours()) {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack';
}
export function foodTotals(items) {
  const micro = (k) => {
    const known = items.filter((i) => Number.isFinite(i[k]));
    return known.length && known.length === items.length ? round1(known.reduce((s, i) => s + i[k], 0)) : null;
  };
  return {
    calories: Math.round(items.reduce((s, i) => s + (Number(i.calories) || 0), 0)),
    protein: round1(items.reduce((s, i) => s + (Number(i.protein) || 0), 0)),
    carbs: round1(items.reduce((s, i) => s + (Number(i.carbs) || 0), 0)),
    fat: round1(items.reduce((s, i) => s + (Number(i.fat) || 0), 0)),
    fiber: micro('fiber'), sugar: micro('sugar'), sodium: micro('sodium'),
  };
}
/** Deterministic 1–10 heuristic, identical to the server's healthScore (never AI, never a diagnosis). */
function healthScore(items) {
  if (!items?.length) return null;
  const t = foodTotals(items);
  if (t.calories <= 0) return null;
  const grams = items.reduce((s, i) => s + i.grams, 0) || 1;
  const proteinShare = (t.protein * 4) / t.calories;
  const fatShare = (t.fat * 9) / t.calories;
  const density = t.calories / grams;
  let score = 6;
  score += Math.min(2, proteinShare * 6);
  if (fatShare > 0.45) score -= (fatShare - 0.45) * 5;
  if (density > 2.5) score -= Math.min(2, (density - 2.5) * 1.2);
  else if (density < 1.2) score += 0.5;
  if (t.fiber != null) score += Math.min(1.5, (t.fiber / t.calories) * 400);
  if (t.sugar != null) { const s = (t.sugar * 4) / t.calories; if (s > 0.15) score -= Math.min(2.5, (s - 0.15) * 10); }
  if (t.sodium != null) { const p = t.sodium / t.calories; if (p > 1.2) score -= Math.min(2, (p - 1.2) * 1.5); }
  return Math.max(1, Math.min(10, Math.round(score)));
}
function scoreBadge(score) {
  if (score == null) return null;
  const tone = score >= 8 ? 'ok' : score >= 5 ? 'warn' : 'danger';
  const label = score >= 8 ? 'დაბალანსებული' : score >= 5 ? 'საშუალო' : 'მძიმე კერძი';
  return h('span', { class: `badge badge-${tone}`, title: `კერძის ბალანსი ${score}/10 — ${label}` }, `${score}/10`);
}
function scaleItem(item, grams) {
  const r = grams / item.grams;
  const next = { ...item, grams: round1(grams), calories: round1(item.calories * r), protein: round1(item.protein * r), carbs: round1(item.carbs * r), fat: round1(item.fat * r) };
  for (const k of ['fiber', 'sugar', 'sodium']) if (Number.isFinite(item[k])) next[k] = round1(item[k] * r);
  return next;
}
/** Per-100 g facts → one portion (the server's foodToItem). */
function portionFromFood(food, grams) {
  const r = grams / 100;
  const name = food.brand ? `${food.name} · ${food.brand}` : food.name;
  const item = { name: name.slice(0, 120), grams: round1(grams) };
  for (const k of ['calories', 'protein', 'carbs', 'fat']) item[k] = round1((Number(food.per100?.[k]) || 0) * r);
  for (const k of ['fiber', 'sugar', 'sodium']) if (Number.isFinite(food.per100?.[k])) item[k] = round1(food.per100[k] * r);
  return item;
}
/** Only the keys the server's strict foodItem schema accepts. */
function cleanItem(i) {
  const out = { name: String(i.name || '').trim().slice(0, 120) || 'საკვები', grams: Math.min(10000, Math.max(0.1, round1(Number(i.grams) || 0))) };
  for (const k of ['calories', 'protein', 'carbs', 'fat']) out[k] = Math.min(10000, Math.max(0, round1(Number(i[k]) || 0)));
  for (const k of ['fiber', 'sugar', 'sodium']) if (Number.isFinite(Number(i[k])) && i[k] !== null && i[k] !== '') out[k] = Math.max(0, round1(Number(i[k])));
  return out;
}
const kcal = (n) => `${fmtNum(Math.round(Number(n) || 0))} კკალ`;
const g = (n) => `${fmtNum(round1(Number(n) || 0), 1)} გ`;
function macroLine(t) {
  return `ც ${fmtNum(t.protein, 0)} · ნ ${fmtNum(t.carbs, 0)} · ცხ ${fmtNum(t.fat, 0)} გ`;
}
function dayLabel(key) {
  const r = relDay(key);
  return r === fmtDate(key) ? fmtDate(key, { year: parseDate(key).getFullYear() !== new Date().getFullYear() }) : `${r} · ${fmtDate(key)}`;
}
function hoursLabel(min) { const hh = Math.floor(min / 60); const mm = min % 60; return mm ? `${hh} სთ ${mm} წთ` : `${hh} სთ`; }

/* ── Page ─────────────────────────────────────────────── */
export default async function nutritionPage(root, ctx) {
  ensureCss();
  const today = ymd();
  const S = {
    day: /^\d{4}-\d{2}-\d{2}$/.test(ctx?.query?.date || '') && ctx.query.date <= today ? ctx.query.date : today,
    dash: null, meals: [], activities: [], kinds: null, settings: { photoEnabled: false }, fasting: null,
  };
  let alive = true;
  let fastTimer = null;
  let daySeq = 0;

  const aiOn = () => Boolean(S.settings?.photoEnabled) && featureOn('nutritionAi');

  const settingsBtn = iconButton('settings', { title: 'ბიუჯეტის პარამეტრები', onClick: () => openPreferences() });
  const addBtn = button('კვების დამატება', { icon: 'plus', onClick: () => openMealEditor({ type: S.day === today ? mealTypeForHour() : 'lunch' }) });
  const dayBar = h('div', { class: 'nu-daybar' });
  const left = h('div', { class: 'nu-col' });
  const right = h('div', { class: 'nu-col' });
  mount(root,
    pageHead('კვება', 'ჩაწერე, გადაამოწმე, გაიგე.', settingsBtn, addBtn),
    dayBar,
    h('div', { class: 'grid nu-layout' }, left, right));

  /* ── Loading ── */
  async function loadAll() {
    mount(left, skeleton(5), h('div', { style: { height: '16px' } }), skeleton(4));
    mount(right, skeleton(4), h('div', { style: { height: '16px' } }), skeleton(3));
    renderDayBar();
    try {
      const [dash, settings, fasting] = await Promise.all([
        get('/api/nutrition/program/dashboard'),
        get('/api/nutrition/settings').catch(() => ({ photoEnabled: false })),
        get('/api/nutrition/fasting').catch(() => null),
        loadDay(false),
      ]);
      if (!alive) return;
      S.dash = dash; S.settings = settings || { photoEnabled: false }; S.fasting = fasting;
      renderAll();
    } catch (e) {
      if (!alive) return;
      mount(left, errorBox(e, loadAll));
      clear(right);
    }
  }

  async function loadDay(paint = true) {
    const seq = ++daySeq;
    if (paint) mount(right, skeleton(4), h('div', { style: { height: '16px' } }), skeleton(3));
    const [m, a] = await Promise.all([
      get('/api/nutrition/meals', { from: S.day, to: S.day }),
      get('/api/nutrition/activities', { from: S.day, to: S.day }).catch(() => null),
    ]);
    if (!alive || seq !== daySeq) return;
    S.meals = m?.meals || [];
    S.activities = a?.activities || [];
    S.kinds = a?.kinds || S.kinds;
    if (paint) renderAll();
  }

  /** After a write: one re-read of the dashboard and the day — never on a timer. */
  async function refresh() {
    try {
      const [dash, fasting] = await Promise.all([
        get('/api/nutrition/program/dashboard'),
        get('/api/nutrition/fasting').catch(() => S.fasting),
        loadDay(false),
      ]);
      if (!alive) return;
      S.dash = dash; S.fasting = fasting;
      renderAll();
    } catch (e) { toast(e.message || 'განახლება ვერ მოხერხდა.', 'error'); }
  }

  function setDay(key) {
    if (key > today) return;
    S.day = key;
    renderDayBar();
    try { history.replaceState(history.state, '', key === today ? location.pathname : `${location.pathname}?date=${key}`); } catch { /* ignore */ }
    loadDay(true).catch((e) => mount(right, errorBox(e, () => setDay(S.day))));
  }

  function renderDayBar() {
    const picker = input({ type: 'date', value: S.day, max: today, class: 'input nu-datepick', 'aria-label': 'თარიღის არჩევა', onChange: (e) => { if (e.target.value) setDay(e.target.value); } });
    mount(dayBar,
      iconButton('chevronLeft', { title: 'წინა დღე', onClick: () => setDay(shiftDay(S.day, -1)) }),
      h('div', { class: 'nu-daylabel' }, h('b', null, dayLabel(S.day)), picker),
      h('button', { class: 'icon-btn', type: 'button', title: 'შემდეგი დღე', 'aria-label': 'შემდეგი დღე', disabled: S.day >= today, onClick: () => setDay(shiftDay(S.day, 1)) }, icon('chevronRight', { size: 20 })),
      S.day !== today ? button('დღეს', { variant: 'ghost', size: 'sm', onClick: () => setDay(today) }) : null);
  }

  function renderAll() { renderLeft(); renderRight(); }

  /* ── Left: dashboard ── */
  function dayFacts() {
    const d = S.dash;
    if (S.day === today && d) {
      return { eaten: d.today, target: d.targets?.calories || null, budget: d.budget, remaining: d.remaining, targets: d.targets, isToday: true };
    }
    const eaten = foodTotals(S.meals.flatMap((m) => m.items || []));
    const row = d?.days?.find((x) => x.date === S.day);
    const target = row?.target?.calories || null;
    return { eaten, target, budget: target, remaining: target ? target - eaten.calories : null, targets: row?.target || null, isToday: false };
  }

  function renderLeft() {
    if (!S.dash) return;
    const d = S.dash;
    const f = dayFacts();
    const nodes = [];
    nodes.push(h('div', { class: 'grid grid-2 nu-top' }, balanceCard(f), macroCard(f)));
    if (f.isToday) nodes.push(dayTiles(d));
    if (d.needsReview && d.reasons?.length) {
      nodes.push(card({ class: 'nu-review' }, h('div', { class: 'hstack', style: { alignItems: 'flex-start' } }, tile('info', 'amber', 36),
        h('div', { class: 'stack', style: { gap: '4px', flex: 1 } }, h('div', { class: 'card-title' }, 'გეგმა გადასამოწმებელია'), h('p', { class: 'muted', style: { fontSize: '13.5px' } }, d.reasons.join(' ')),
          h('a', { class: 'link', href: APP_STORE, target: '_blank', rel: 'noopener' }, 'გეგმას MEDICARD აპში გადაამოწმებ', icon('externalLink', { size: 14 }))))));
    }
    const fast = fastingCard();
    if (fast) nodes.push(section('ინტერვალური შიმშილი', fast));
    nodes.push(section('ეს კვირა', weekCard(d)));
    nodes.push(h('div', { class: 'grid grid-2' }, streakCard(d), projectionCard(d)));
    nodes.push(section('სხეულის ზომები', measurementsCard(d), { action: button('ჩაწერა', { size: 'sm', variant: 'ghost', icon: 'plus', onClick: openMeasurement }) }));
    nodes.push(h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), 'კალორიები და მაკროები მიახლოებითია. ეს ორიენტირია, არა ექიმის ან დიეტოლოგის დანიშნულება.'));
    mount(left, nodes);
    scheduleFastTick();
  }

  function balanceCard(f) {
    const eaten = Math.round(f.eaten?.calories || 0);
    const cap = f.budget || f.target;
    let headline;
    let sub;
    if (!cap) {
      headline = f.isToday ? `დღეს ${kcal(eaten)}` : `${kcal(eaten)} ჩაწერილი`;
      sub = S.dash?.program
        ? (S.dash.needsReview ? 'გეგმა გადასამოწმებელია — სამიზნე დროებით არ ითვლება.' : 'ამ დღის სამიზნე არ არის შენახული.')
        : 'დღის სამიზნე ჯერ არ გაქვს. კვების გეგმას MEDICARD აპში შეადგენ.';
    } else if (f.remaining >= 0) {
      headline = f.isToday ? `კიდევ ${kcal(f.remaining)} შეგიძლია დღეს` : `სამიზნეზე ${kcal(f.remaining)}-ით ნაკლები`;
      sub = null;
    } else {
      headline = f.isToday ? `დღის ბიუჯეტზე ${kcal(Math.abs(f.remaining))}-ით მეტი` : `სამიზნეზე ${kcal(Math.abs(f.remaining))}-ით მეტი`;
      sub = f.isToday ? 'ხვალ ახალი დღეა.' : null;
    }
    const d = S.dash;
    const formula = f.isToday && d?.targets?.calories && d.budget
      ? `სამიზნე ${fmtNum(d.targets.calories)}${d.burned?.counted > 0 ? ` + დამწვარი ${fmtNum(d.burned.counted)}` : ''}${d.rollover > 0 ? ` + გუშინდელი ${fmtNum(d.rollover)}` : ''} = ${fmtNum(d.budget)} კკალ`
      : cap ? `სამიზნე ${fmtNum(cap)} კკალ` : null;
    const over = cap && eaten > cap;
    return card({ class: 'spotlight hero-card nu-balance' },
      h('div', { class: 'between' }, h('div', null, h('div', { class: 'card-title' }, 'დღის ბალანსი'), h('div', { class: 'card-sub' }, dayLabel(S.day))), tile('flame', 'teal', 38)),
      h('div', { class: 'nu-balance-body' },
        ring({ value: eaten, max: cap || Math.max(eaten, 1), size: 150, stroke: 13, color: over ? '#fbbf24' : '#2dd4bf', track: 'rgba(255,255,255,.12)', label: fmtNum(eaten), labelScale: 0.19, sub: cap ? `/ ${fmtNum(cap)} კკალ` : 'კკალ' }),
        h('div', { class: 'stack', style: { gap: '6px', minWidth: 0 } },
          h('b', { class: 'nu-headline' }, headline),
          sub ? h('p', { class: 'muted', style: { fontSize: '13px' } }, sub) : null,
          formula ? h('p', { class: 'nu-formula' }, formula) : null,
          !cap && !S.dash?.program ? h('a', { class: 'nu-spot-link', href: APP_STORE, target: '_blank', rel: 'noopener' }, 'MEDICARD აპი', icon('externalLink', { size: 14 })) : null)));
  }

  function macroCard(f) {
    const t = f.eaten || { protein: 0, carbs: 0, fat: 0 };
    const tg = f.targets;
    const parts = Object.entries(MACRO).map(([k, m]) => ({ name: m.name, value: (Number(t[k]) || 0) * m.kcal, color: m.color }));
    const total = parts.reduce((s, p) => s + p.value, 0);
    return card({ class: 'nu-macros' },
      h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, 'მაკროები'), h('div', { class: 'card-sub' }, tg?.split ? `შენი განაწილება ${tg.split.protein}/${tg.split.carbs}/${tg.split.fat}` : tg ? 'გეგმის მიხედვით' : 'დღის სამიზნე არ არის'))),
      h('div', { class: 'nu-macro-body' },
        donut({ parts, size: 116, stroke: 14, center: h('div', null, h('strong', { style: { fontSize: '17px' } }, total ? `${Math.round(((t.protein * 4) / total) * 100)}%` : '—'), h('span', null, 'ცილა')) }),
        meters(Object.entries(MACRO).map(([k, m]) => ({
          name: m.name,
          value: Number(t[k]) || 0,
          max: tg?.[k] || Math.max((Number(t.protein) || 0) + (Number(t.carbs) || 0) + (Number(t.fat) || 0), 1),
          color: m.color,
          right: tg?.[k] ? `${fmtNum(t[k], 0)} / ${fmtNum(tg[k])} გ` : `${fmtNum(t[k], 0)} გ`,
        })))),
      micros(t));
  }

  function micros(t) {
    const list = [
      t.fiber != null ? `ბოჭკო ${g(t.fiber)}` : null,
      t.sugar != null ? `შაქარი ${g(t.sugar)}` : null,
      t.sodium != null ? `ნატრიუმი ${fmtNum(Math.round(t.sodium))} მგ` : null,
    ].filter(Boolean);
    return list.length ? h('div', { class: 'nu-micros' }, list.map((x) => h('span', null, x))) : null;
  }

  function dayTiles(d) {
    const tileCard = (ic, ink, value, label, href) => h(href ? 'a' : 'div', { class: 'card nu-tile hover', href, 'data-link': href ? '' : undefined },
      tile(ic, ink, 34), h('div', null, h('b', null, value), h('span', null, label)));
    const water = d.water || { ml: 0, goalMl: null };
    return h('div', { class: 'nu-tiles' },
      tileCard('droplet', 'sky', water.goalMl ? `${fmtNum(water.ml / 1000, 1)} / ${fmtNum(water.goalMl / 1000, 1)} ლ` : `${fmtNum(water.ml / 1000, 1)} ლ`, 'წყალი', '/health'),
      tileCard('footprints', 'green', fmtNum(d.steps || 0), 'ნაბიჯი', '/health'),
      tileCard('zap', 'amber', `${fmtNum(d.burned?.total || 0)} კკალ`, d.preferences?.addBurned ? 'დამწვარი · ბიუჯეტში' : 'დამწვარი'),
      tileCard('flame', 'rose', `${d.streak?.current || 0} დღე`, 'სერია'));
  }

  function weekCard(d) {
    const days = d.days || [];
    if (!days.length) return card(empty('კვირის მონაცემები ჯერ არ არის', 'ჩაწერე კვება და აქ კვირის სურათი გამოჩნდება.'));
    const target = d.targets?.calories || days.map((x) => x.target?.calories).filter(Boolean).at(-1) || null;
    const w = d.week || {};
    return card({ class: 'pad-lg' },
      h('div', { class: 'nu-week-stats' },
        wstat('საშუალო დღეში', w.averageCalories != null ? kcal(w.averageCalories) : '—'),
        wstat('ჩაწერილი დღე', `${w.recordedDays || 0} / 7`),
        wstat('სამიზნის ფარგლებში', w.targetDays ? `${w.onTargetDays} / ${w.targetDays}` : '—'),
        wstat('ბალანსი', w.balanceCalories != null ? `${w.balanceCalories > 0 ? '+' : w.balanceCalories < 0 ? '−' : ''}${fmtNum(Math.abs(w.balanceCalories))} კკალ` : '—')),
      barChart({
        labels: days.map((x) => `${KA_DAYS_SHORT[parseDate(x.date).getDay()]} ${parseDate(x.date).getDate()}`),
        tipLabels: days.map((x) => `${fmtDate(x.date)}${x.target?.calories ? ` · სამიზნე ${fmtNum(x.target.calories)}` : ''}`),
        stacked: [
          { name: 'ცილა', values: days.map((x) => Math.round((x.totals?.protein || 0) * 4)), color: MACRO.protein.color },
          { name: 'ნახშირწყალი', values: days.map((x) => Math.round((x.totals?.carbs || 0) * 4)), color: MACRO.carbs.color },
          { name: 'ცხიმი', values: days.map((x) => Math.round((x.totals?.fat || 0) * 9)), color: MACRO.fat.color },
        ],
        goal: target,
        goalLabel: target ? `სამიზნე ${fmtNum(target)}` : null,
        fmt: (v) => `${fmtNum(v)} კკალ`,
        height: 210,
      }),
      h('div', { class: 'legend', style: { marginTop: '12px' } }, Object.values(MACRO).map((m) => h('span', null, h('i', { style: { background: m.color } }), `${m.name} (კკალ)`))),
      w.averageProtein != null ? h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, `საშუალოდ ${fmtNum(w.averageProtein)} გ ცილა ჩაწერილ დღეს.`) : null);
  }
  const wstat = (label, value) => h('div', { class: 'nu-wstat' }, h('span', null, label), h('b', null, value));

  function streakCard(d) {
    const s = d.streak || { current: 0, best: 0 };
    const text = s.loggedToday
      ? (s.nextMilestone ? `დღეს ჩაწერილია. შემდეგი ნიშნული ${s.nextMilestone} დღეა.` : 'დღეს ჩაწერილია. ყველა ნიშნული აღებულია!')
      : s.current > 0 ? 'დღეს ერთი ჩანაწერი — და სერია გრძელდება.' : 'პირველი ჩანაწერით სერია იწყება. გამოტოვება ვალს არ ქმნის.';
    return card(
      h('div', { class: 'hstack', style: { marginBottom: '10px' } }, tile('flame', 'rose', 38), h('div', null, h('div', { class: 'card-title' }, 'სერია'), h('div', { class: 'card-sub' }, `რეკორდი ${s.best || 0} დღე`))),
      h('div', { class: 'nu-big' }, fmtNum(s.current || 0), h('small', null, ' დღე ზედიზედ')),
      h('p', { class: 'muted', style: { fontSize: '13px', marginTop: '6px' } }, text),
      s.reached?.length ? h('div', { class: 'chips', style: { marginTop: '10px' } }, s.reached.map((m) => h('span', { class: 'badge badge-brand' }, `${m} დღე`))) : null);
  }

  function projectionCard(d) {
    const p = d.projection || {};
    const goal = d.facts?.weightGoal;
    const hist = d.facts?.weightHistory || [];
    const current = d.facts?.current?.kg ?? p.current ?? null;
    const headRow = h('div', { class: 'between', style: { marginBottom: '10px' } },
      h('div', { class: 'hstack' }, tile('scale', 'violet', 38), h('div', null, h('div', { class: 'card-title' }, 'წონის მიზანი'), h('div', { class: 'card-sub' }, goal ? 'პროგნოზი ჩანაწერებიდან' : 'მიზანი არ არის დაყენებული'))),
      h('a', { class: 'link', href: '/health', 'data-link': '' }, 'წონა', icon('chevronRight', { size: 16 })));
    if (!goal || current == null) {
      return card(headRow, h('p', { class: 'muted', style: { fontSize: '13px' } }, current == null ? 'ჩაწერე წონა „მაჩვენებლებში“ — აქ პროგნოზი გამოჩნდება.' : 'წონის მიზანს „მაჩვენებლებში“ დააყენებ.'));
    }
    const text = p.direction === 'reached'
      ? 'მიზანი მიღწეულია — გილოცავ!'
      : p.trendEta ? `მიმდინარე ტემპით მიზანს დაახლოებით ${fmtDate(p.trendEta, { year: true })}-ს მიაღწევ.`
        : p.planEta ? `გეგმის ტემპით ორიენტირი: ${fmtDate(p.planEta, { year: true })}.`
          : 'წონას როცა რამდენჯერმე ჩაწერ, პროგნოზიც გამოჩნდება.';
    return card(headRow,
      h('div', { class: 'nu-kg' }, h('b', null, fmtNum(current, 1)), h('span', null, '→'), h('b', { class: 'brand' }, fmtNum(goal.targetKg, 1)), h('small', null, 'კგ')),
      hist.length >= 2 ? lineChart({ labels: hist.map((x) => fmtDate(x.date, { short: true })), series: [{ name: 'წონა', values: hist.map((x) => x.weightKg), color: 'var(--ink-violet)' }], goal: goal.targetKg, zero: false, unit: 'კგ', fmt: (v) => fmtNum(v, 1), height: 110 }) : null,
      h('p', { class: 'muted', style: { fontSize: '13px', marginTop: '8px' } }, text),
      p.trendKgPerWeek != null ? h('p', { class: 'faint', style: { fontSize: '12.5px' } }, `ტენდენცია: ${p.trendKgPerWeek > 0 ? '+' : ''}${fmtNum(p.trendKgPerWeek, 2)} კგ კვირაში`) : null);
  }

  function measurementsCard(d) {
    const list = d.measurements || [];
    if (!list.length) return card(empty('ზომები ჯერ არ არის', 'წელი, თეძო, მკერდი — სასწორის გარდა ცვლილების კიდევ ერთი საზომი.', button('ზომების ჩაწერა', { variant: 'secondary', size: 'sm', icon: 'ruler', onClick: openMeasurement })));
    const [last, prev] = list;
    const keys = [['waistCm', 'წელი'], ['hipsCm', 'თეძო'], ['chestCm', 'მკერდი'], ['armCm', 'მკლავი'], ['thighCm', 'ბარძაყი']];
    return card(
      h('div', { class: 'card-sub', style: { marginBottom: '12px' } }, `ბოლო ჩანაწერი: ${fmtDate(last.date)}`),
      h('div', { class: 'nu-measure' }, keys.filter(([k]) => last[k] != null).map(([k, label]) => {
        const diff = prev?.[k] != null ? round1(last[k] - prev[k]) : null;
        return h('div', { class: 'nu-wstat' }, h('span', null, label), h('b', null, `${fmtNum(last[k], 1)} სმ`),
          diff ? h('small', { class: 'faint' }, `${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff), 1)} სმ`) : null);
      })));
  }

  /* ── Fasting (only an active fast, or a start button when the server says the person is eligible) ── */
  function fastingCard() {
    const fs = S.fasting;
    const active = fs?.active || S.dash?.fasting?.active || null;
    if (active) {
      const el = card({ class: 'nu-fast' });
      const paint = () => {
        const mins = Math.max(0, Math.round((Date.now() - new Date(active.startedAt).getTime()) / 60000));
        const pct = Math.min(1, mins / active.targetMinutes);
        const endBtn = button('დასრულება', { variant: 'secondary', size: 'sm' });
        endBtn.addEventListener('click', async () => {
          const ok = await confirmDialog({ title: 'შიმშილის დასრულება?', body: pct >= 1 ? 'მიზანი შესრულებულია. ჩანაწერი ისტორიაში შეინახება.' : `ჯერ ${hoursLabel(mins)} გავიდა. ჩანაწერი ისტორიაში მაინც შეინახება.`, confirm: 'დასრულება' });
          if (!ok) return;
          await busy(endBtn, async () => {
            try { await post(`/api/nutrition/fasting/${active.id}/end`, {}); toast('შიმშილი დასრულდა'); refresh(); } catch (e) { toast(e.message, 'error'); }
          });
        });
        mount(el,
          h('div', { class: 'hstack', style: { gap: '18px', flexWrap: 'nowrap' } },
            ring({ value: mins, max: active.targetMinutes, size: 96, stroke: 10, color: 'var(--ink-violet)', label: `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`, labelScale: 0.2, sub: 'სთ' }),
            h('div', { class: 'stack', style: { gap: '4px', flex: 1, minWidth: 0 } },
              h('div', { class: 'card-title' }, pct >= 1 ? 'მიზანი შესრულდა' : `მიზანი ${fmtTime(active.goalAt)}-ზე`),
              h('div', { class: 'card-sub' }, `დაიწყო ${relDay(active.startedAt)}, ${fmtTime(active.startedAt)} · ${hoursLabel(active.targetMinutes)} ფანჯარა`),
              h('div', { class: 'hstack', style: { marginTop: '6px' } }, endBtn))));
      };
      paint();
      el._paint = paint;
      return el;
    }
    const elig = fs?.eligibility;
    if (elig?.eligible && fs?.settings) {
      const startBtn = button(`დაწყება · ${fs.settings.protocol === 'custom' ? hoursLabel(fs.settings.targetMinutes) : fs.settings.protocol}`, { variant: 'secondary', size: 'sm', icon: 'play' });
      startBtn.addEventListener('click', () => busy(startBtn, async () => {
        try {
          await post('/api/nutrition/fasting/start', { id: uuid(), protocol: fs.settings.protocol, targetMinutes: fs.settings.targetMinutes });
          toast('შიმშილის ტაიმერი ჩაირთო');
          refresh();
        } catch (e) { toast(e.message, 'error'); }
      }));
      const st = fs.stats || {};
      return card(h('div', { class: 'hstack', style: { alignItems: 'flex-start' } }, tile('timer', 'violet', 38),
        h('div', { class: 'stack', style: { gap: '4px', flex: 1 } },
          h('div', { class: 'card-title' }, 'შიმშილის ტაიმერი'),
          h('div', { class: 'card-sub' }, st.week?.count ? `ამ კვირაში ${st.week.completed} / ${st.week.count} მიზანი შესრულდა` : 'დღიური კვების ფანჯარა, შენი რეჟიმით'),
          h('div', { class: 'hstack', style: { marginTop: '6px' } }, startBtn))));
    }
    return null;
  }

  function scheduleFastTick() {
    clearInterval(fastTimer);
    fastTimer = null;
    const el = left.querySelector('.nu-fast');
    if (el?._paint) fastTimer = setInterval(() => { if (document.body.contains(el)) el._paint(); }, 30_000);
  }

  /* ── Right: diary ── */
  function renderRight() {
    const byType = Object.fromEntries(MEAL_TYPES.map((t) => [t, []]));
    for (const m of [...S.meals].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))) (byType[m.type] || byType.snack).push(m);
    const total = foodTotals(S.meals.flatMap((m) => m.items || []));
    const nodes = [
      h('div', { class: 'between nu-diary-head' },
        h('div', null, h('h2', null, 'დღიური'), h('span', { class: 'faint' }, S.meals.length ? `${S.meals.length} ჩანაწერი · ${kcal(total.calories)}` : 'ჯერ ცარიელია')),
        S.day !== today && S.meals.length ? button('დღეს გამეორება', { variant: 'ghost', size: 'sm', icon: 'copy', onClick: (e) => copyToToday(S.meals, e.currentTarget) }) : null),
    ];
    for (const t of MEAL_TYPES) nodes.push(mealTypeCard(t, byType[t]));
    nodes.push(section('ვარჯიში და ენერგია', activitiesCard(), { action: button('დამატება', { size: 'sm', variant: 'ghost', icon: 'plus', onClick: openActivity }) }));
    mount(right, nodes);
  }

  function mealTypeCard(type, meals) {
    const [ic, ink] = MEAL_ICON[type];
    const t = foodTotals(meals.flatMap((m) => m.items || []));
    return card({ class: 'nu-meal' },
      h('div', { class: 'between' },
        h('div', { class: 'hstack' }, tile(ic, ink, 36), h('div', null, h('div', { class: 'card-title' }, MEAL_LABELS[type]), h('div', { class: 'card-sub' }, meals.length ? `${kcal(t.calories)} · ${macroLine(t)}` : 'ჯერ არაფერი'))),
        iconButton('plus', { title: `${MEAL_LABELS[type]} — დამატება`, onClick: () => openMealEditor({ type }) })),
      meals.length ? h('div', { class: 'nu-entries' }, meals.map((m) => mealEntry(m))) : null);
  }

  function mealEntry(m) {
    const t = m.totals || foodTotals(m.items || []);
    const names = (m.items || []).map((i) => i.name);
    const edit = iconButton('edit', { title: 'რედაქტირება', size: 18, onClick: () => openMealEditor({ meal: m }) });
    const remove = iconButton('trash', { title: 'წაშლა', size: 18, onClick: () => removeMeal(m) });
    return h('div', { class: 'nu-entry' },
      h('button', { type: 'button', class: 'nu-entry-main', onClick: () => openMealEditor({ meal: m }) },
        h('div', { class: 'nu-entry-title' }, m.title || names.join(' · ') || 'კვება'),
        h('div', { class: 'nu-entry-sub' },
          h('span', null, `${kcal(t.calories)} · ${macroLine(t)}`),
          SOURCE_LABELS[m.source] ? h('span', { class: 'faint' }, ` · ${SOURCE_LABELS[m.source]}`) : null),
        m.title && names.length ? h('div', { class: 'nu-entry-items' }, names.join(', ')) : null),
      h('div', { class: 'nu-entry-side' }, scoreBadge(m.healthScore ?? healthScore(m.items || [])), h('div', { class: 'nu-entry-actions' }, edit, remove)));
  }

  async function removeMeal(m) {
    const ok = await confirmDialog({ title: 'ჩანაწერის წაშლა?', body: 'ეს კვება დღიურიდან წაიშლება.', confirm: 'წაშლა', danger: true });
    if (!ok) return;
    try {
      await del(`/api/nutrition/meals/${m.id}`);
      toast('წაიშალა');
      refresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function copyToToday(meals, btn) {
    const ok = await confirmDialog({ title: 'დღეს გამეორება?', body: `${meals.length === 1 ? 'ეს კვება' : `${meals.length} კვება`} დღევანდელ დღიურში დაკოპირდება.`, confirm: 'გამეორება' });
    if (!ok) return;
    await busy(btn, async () => {
      try {
        const res = await post('/api/nutrition/meals/copy', { date: today, copies: meals.slice(0, 25).map((m) => ({ fromId: m.id, id: uuid() })) });
        toast(res?.meals?.length === 1 ? 'კვება დაკოპირდა' : `${res?.meals?.length || 0} კვება დაკოპირდა`, 'ok', { action: { label: 'ნახვა', onClick: () => setDay(today) } });
        refresh();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  function activitiesCard() {
    const list = S.activities || [];
    const label = (k) => S.kinds?.[k]?.label || k;
    if (!list.length) {
      return card(h('div', { class: 'hstack' }, tile('zap', 'amber', 36),
        h('div', null, h('div', { class: 'card-title' }, 'ვარჯიში ჯერ არ არის'), h('div', { class: 'card-sub' }, S.dash?.preferences?.addBurned ? 'დამწვარი კალორიები ბიუჯეტს დაემატება.' : 'სირბილი, ძალოვანი, სიარული — დამწვარი ენერგიის შეფასებით.'))));
    }
    return card(h('div', { class: 'list' }, list.map((a) => h('div', { class: 'row' },
      tile('zap', 'amber', 34),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, label(a.kind)), h('div', { class: 'row-sub' }, `${a.minutes} წთ · ≈ ${kcal(a.kcal)}${a.note ? ` · ${a.note}` : ''}`)),
      h('div', { class: 'row-trail' }, iconButton('trash', { title: 'წაშლა', size: 18, onClick: async () => {
        if (!(await confirmDialog({ title: 'ვარჯიშის წაშლა?', body: `${label(a.kind)} · ${a.minutes} წთ`, confirm: 'წაშლა', danger: true }))) return;
        try { await del(`/api/nutrition/activities/${a.id}`); toast('წაიშალა'); refresh(); } catch (e) { toast(e.message, 'error'); }
      } }))))),
    h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '8px' } }, 'კალორიები MET ფორმულით შეფასებულია — ორიენტირია, არა გაზომვა.'));
  }

  function openActivity() {
    const kinds = S.kinds || { walk: { label: 'სიარული' }, run: { label: 'სირბილი' }, cycle: { label: 'ველოსიპედი' }, strength: { label: 'ძალოვანი ვარჯიში' }, other: { label: 'სხვა აქტივობა' } };
    formModal({
      title: 'ვარჯიშის დამატება',
      size: 'sm',
      fields: [
        h('p', { class: 'faint', style: { fontSize: '13px' } }, dayLabel(S.day)),
        field('ვარჯიში', select(Object.entries(kinds).map(([value, k]) => ({ value, label: k.label })), 'walk', { name: 'kind' })),
        h('div', { class: 'form-row' },
          field('ხანგრძლივობა (წთ)', input({ name: 'minutes', type: 'number', min: '1', max: '600', required: true, value: '30' })),
          field('კალორია (არასავალდებულო)', input({ name: 'kcal', type: 'number', min: '0', max: '5000', placeholder: 'ავტომატურად' }))),
        field('შენიშვნა', input({ name: 'note', maxlength: '200', placeholder: 'არასავალდებულო' })),
      ],
      onSubmit: async (v, close) => {
        const minutes = Math.round(Number(v.minutes));
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) throw new Error('ხანგრძლივობა 1–600 წუთი უნდა იყოს.');
        const k = v.kcal === '' ? null : Math.round(Number(v.kcal));
        if (k != null && (!Number.isFinite(k) || k < 0 || k > 5000)) throw new Error('კალორია 0–5000 უნდა იყოს.');
        const res = await put(`/api/nutrition/activities/${uuidFor('act')}`, { id: uuidFor('act'), date: S.day, kind: v.kind, minutes, kcal: k, note: String(v.note || '').trim().slice(0, 200) });
        resetUuid('act');
        close();
        toast(res?.estimated ? `ჩაიწერა · ≈ ${kcal(res.activity?.kcal)}` : 'ჩაიწერა');
        refresh();
      },
    });
  }

  function openMeasurement() {
    const last = S.dash?.measurements?.[0] || {};
    const num = (name, label, min, max) => field(label, input({ name, type: 'number', step: '0.1', min: String(min), max: String(max), inputmode: 'decimal', placeholder: last[name] != null ? String(last[name]) : '' }));
    formModal({
      title: 'სხეულის ზომები',
      size: 'sm',
      fields: [
        h('p', { class: 'faint', style: { fontSize: '13px' } }, `დღეს · ${fmtDate(today)} · სანტიმეტრებში`),
        h('div', { class: 'form-row' }, num('waistCm', 'წელი', 30, 250), num('hipsCm', 'თეძო', 30, 250)),
        h('div', { class: 'form-row' }, num('chestCm', 'მკერდი', 30, 250), num('armCm', 'მკლავი', 10, 100)),
        num('thighCm', 'ბარძაყი', 20, 150),
      ],
      onSubmit: async (v, close) => {
        const body = {};
        const bounds = { waistCm: [30, 250], hipsCm: [30, 250], chestCm: [30, 250], armCm: [10, 100], thighCm: [20, 150] };
        for (const [k, [lo, hi]] of Object.entries(bounds)) {
          const raw = String(v[k] || '').replace(',', '.').trim();
          if (!raw) { body[k] = null; continue; }
          const n = Number(raw);
          if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`მნიშვნელობა ${lo}–${hi} სმ-ის ფარგლებში უნდა იყოს.`);
          body[k] = round1(n);
        }
        if (Object.values(body).every((x) => x == null)) throw new Error('მიუთითე მინიმუმ ერთი ზომა.');
        await put(`/api/nutrition/measurements/${today}`, body);
        close();
        toast('ზომები შენახულია');
        refresh();
      },
    });
  }

  function openPreferences() {
    const p = { rollover: false, addBurned: false, countSteps: true, ...(S.dash?.preferences || {}) };
    const next = { rollover: p.rollover, addBurned: p.addBurned, countSteps: p.countSteps };
    const rowT = (key, title, sub) => h('div', { class: 'between nu-pref' }, h('div', null, h('div', { class: 'row-title' }, title), h('div', { class: 'row-sub' }, sub)), toggle(next[key], (v) => { next[key] = v; }));
    openModal({
      title: 'დღის ბიუჯეტი',
      size: 'sm',
      body: h('div', { class: 'stack', style: { gap: '16px' } },
        rowT('addBurned', 'დამწვარი კალორიები ბიუჯეტში', 'ვარჯიშისა და ნაბიჯების ენერგია დღის ბიუჯეტს დაემატება.'),
        rowT('countSteps', 'ნაბიჯების ჩათვლა', 'ნაბიჯებიც დამწვარ ენერგიაში ჩაითვლება.'),
        rowT('rollover', 'გუშინდელის გადატანა', 'გუშინ გამოუყენებელი კალორიები (მაქს. 200) დღევანდელს დაემატება. დეფიციტი ვალად არ გადადის.'),
        h('p', { class: 'disclaimer' }, 'შეხსენებებს, მაკროების განაწილებას და Health-თან კავშირს MEDICARD აპში შეცვლი.')),
      footer: (close) => {
        const save = button('შენახვა');
        save.addEventListener('click', () => busy(save, async () => {
          try { await put('/api/nutrition/preferences', next); close(); toast('შენახულია'); refresh(); } catch (e) { toast(e.message, 'error'); }
        }));
        return [button('გაუქმება', { variant: 'ghost', onClick: () => close() }), save];
      },
    });
  }

  /* Stable ids per pending write, so a retry after a network error reuses the same row. */
  const pendingIds = {};
  function uuidFor(key) { pendingIds[key] = pendingIds[key] || uuid(); return pendingIds[key]; }
  function resetUuid(key) { delete pendingIds[key]; }

  /* ── Meal editor: draft → confirm → save ── */
  function openMealEditor({ meal, type }) {
    const draft = meal
      ? { id: meal.id, date: meal.date, type: meal.type, items: (meal.items || []).map((i) => ({ ...i })), note: meal.note || '', title: meal.title || '', source: meal.source || 'manual' }
      : { id: uuid(), date: S.day, type: type || mealTypeForHour(), items: [], note: '', title: '', source: 'manual' };
    const usedFoodIds = new Set();
    let estimate = null;
    let photo = null;
    let photoUrl = null;
    let photoMode = 'photo';
    let tab = aiOn() && !meal ? 'describe' : 'search';
    let editIndex = null;

    const itemsBox = h('div', { class: 'nu-items' });
    const totalsBox = h('div', { class: 'nu-draft-totals' });
    const estimateBox = h('div');
    const panel = h('div', { class: 'nu-panel' });
    const saveBtn = button(meal ? 'შენახვა' : 'დღიურში შენახვა', { icon: 'check' });
    const titleIn = input({ value: draft.title, maxlength: '120', placeholder: 'მაგ: ქათმის სალათი', onInput: (e) => { draft.title = e.target.value; } });

    const typeSeg = segmented(MEAL_TYPES.map((t) => ({ value: t, label: MEAL_LABELS[t] })), draft.type, (v) => { draft.type = v; });
    const tabs = [
      { value: 'search', label: 'ძიება' },
      { value: 'saved', label: 'შენახული' },
      ...(aiOn() ? [{ value: 'describe', label: 'აღწერა · AI' }, { value: 'photo', label: 'ფოტო · AI' }] : []),
      { value: 'manual', label: 'ხელით' },
    ];
    const tabSeg = h('div', { class: 'nu-tabs' });
    const paintTabs = () => mount(tabSeg, segmented(tabs, tab, (v) => { tab = v; editIndex = null; paintPanel(); }));

    const m = openModal({
      title: meal ? 'კვების რედაქტირება' : 'კვების დამატება',
      size: 'lg',
      body: h('div', { class: 'stack nu-editor', style: { gap: '16px' } },
        h('div', { class: 'nu-editor-head' },
          h('div', { class: 'nu-type' }, typeSeg),
          h('span', { class: 'faint', style: { fontSize: '13px' } }, dayLabel(draft.date))),
        field('სახელი (არასავალდებულო)', titleIn),
        itemsBox,
        totalsBox,
        estimateBox,
        h('div', { class: 'nu-add' }, h('div', { class: 'nu-add-title' }, icon('plus', { size: 16 }), 'საკვების დამატება'), tabSeg, panel),
        aiOn() ? h('p', { class: 'disclaimer' }, icon('sparkles', { size: 14 }), AI_NOTE) : null),
      footer: (close) => {
        saveBtn.addEventListener('click', () => busy(saveBtn, () => saveDraft(close)));
        return [button('გაუქმება', { variant: 'ghost', onClick: () => close() }), saveBtn];
      },
      onClose: () => { if (photoUrl) URL.revokeObjectURL(photoUrl); },
    });

    function paintItems() {
      if (!draft.items.length) {
        mount(itemsBox, h('div', { class: 'nu-items-empty' }, icon('utensils', { size: 18 }), 'ჯერ ცარიელია — დაამატე საკვები ქვემოთ.'));
      } else {
        mount(itemsBox, draft.items.map((it, idx) => {
          const gramsIn = input({ type: 'number', min: '1', max: '10000', step: '1', value: String(it.grams), class: 'input nu-grams', 'aria-label': `${it.name} — გრამი` });
          gramsIn.addEventListener('change', () => {
            const n = Number(gramsIn.value);
            if (!Number.isFinite(n) || n <= 0 || n > 10000) { gramsIn.value = String(it.grams); return; }
            draft.items[idx] = scaleItem(it, n);
            paintItems();
          });
          const star = iconButton('star', { title: 'შენახულ საკვებში დამატება', size: 16 });
          star.addEventListener('click', () => busy(star, async () => {
            try { await post('/api/nutrition/foods/from-item', { item: cleanItem(it), favorite: true }); star.classList.add('on'); toast('შენახულ საკვებში დაემატა'); } catch (e) { toast(e.message, 'error'); }
          }));
          return h('div', { class: 'nu-item' },
            h('div', { class: 'nu-item-main' },
              h('div', { class: 'nu-item-name' }, it.name),
              h('div', { class: 'nu-item-sub' }, `${kcal(it.calories)} · ${macroLine(it)}`)),
            h('label', { class: 'nu-item-grams' }, gramsIn, h('span', null, 'გ')),
            h('div', { class: 'nu-item-actions' },
              star,
              iconButton('edit', { title: 'რედაქტირება', size: 16, onClick: () => { editIndex = idx; tab = 'manual'; paintTabs(); paintPanel(); } }),
              iconButton('x', { title: 'ამოღება', size: 16, onClick: () => { draft.items.splice(idx, 1); if (!draft.items.length) estimate = null; paintAll(); } })));
        }));
      }
      const t = foodTotals(draft.items);
      mount(totalsBox, draft.items.length
        ? [h('div', null, h('b', null, kcal(t.calories)), h('span', { class: 'faint' }, ` · ${macroLine(t)}`)), scoreBadge(healthScore(draft.items))]
        : null);
      totalsBox.hidden = !draft.items.length;
      saveBtn.disabled = !draft.items.length;
    }

    function paintEstimate() {
      if (!estimate || !draft.items.length) { clear(estimateBox); return; }
      const fixIn = input({ placeholder: 'მაგ: ნახევარი პორცია იყო, სოუსის გარეშე', maxlength: '500' });
      const fixBtn = button('შესწორება', { variant: 'secondary', size: 'sm', icon: 'sparkles' });
      const err = h('div', { class: 'form-error', hidden: true });
      const run = () => busy(fixBtn, async () => {
        err.hidden = true;
        const text = fixIn.value.trim();
        if (text.length < 2) { err.textContent = 'დაწერე, რა უნდა შესწორდეს.'; err.hidden = false; return; }
        try {
          const res = await estimateRequest('fix', { correction: text, description: draft.note, previous: draft.items.map(cleanItem) }, photo);
          if (res?.declined) return;
          applyEstimate(res, draft.source, true);
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      });
      fixBtn.addEventListener('click', run);
      fixIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      mount(estimateBox, h('div', { class: 'nu-estimate' },
        h('div', { class: 'hstack' }, icon('sparkles', { size: 16 }), h('b', null, UNCERTAINTY[estimate.uncertainty] || UNCERTAINTY.medium)),
        estimate.explanation ? h('p', null, estimate.explanation) : null,
        h('div', { class: 'nu-fix' }, fixIn, fixBtn),
        err));
    }

    function paintAll() { paintItems(); paintEstimate(); }

    function addItems(items, source, title) {
      if (draft.items.length + items.length > 25) { toast('ერთ კვებაში მაქსიმუმ 25 საკვებია.', 'error'); return false; }
      if (!draft.items.length) draft.source = source;
      draft.items.push(...items.map(cleanItem));
      if (title && !draft.title) { draft.title = title.slice(0, 120); titleIn.value = draft.title; }
      paintAll();
      return true;
    }

    function applyEstimate(result, source, replace) {
      if (!result?.foodDetected || !result.items?.length) {
        throw new Error(source === 'label' ? 'ეტიკეტი მკაფიოდ ვერ წავიკითხე. სცადე უფრო ახლოდან ან შეიყვანე ხელით.' : source === 'text' ? 'აღწერიდან საკვები ვერ ამოვიცანი. სცადე უფრო კონკრეტულად.' : 'საკვები მკაფიოდ ვერ ამოვიცანი. სცადე სხვა ფოტო ან დაამატე ხელით.');
      }
      const items = result.items.map(cleanItem);
      draft.source = replace ? source : draft.items.length ? draft.source : source;
      draft.items = replace ? items : [...draft.items, ...items].slice(0, 25);
      const dish = String(result.dishName || '').slice(0, 120);
      draft.title = replace ? dish || draft.title : draft.title || dish;
      titleIn.value = draft.title;
      estimate = { explanation: result.explanation || '', uncertainty: result.uncertainty || 'medium' };
      paintAll();
    }

    async function saveDraft(close) {
      if (!draft.items.length) return;
      try {
        const body = {
          id: draft.id, date: draft.date, type: draft.type,
          items: draft.items.map(cleanItem),
          note: String(draft.note || '').trim().slice(0, 500),
          title: String(draft.title || '').trim().slice(0, 120),
          source: draft.source || 'manual',
        };
        await put(`/api/nutrition/meals/${draft.id}`, body);
        if (usedFoodIds.size) post('/api/nutrition/foods/used', { ids: [...usedFoodIds].slice(0, 25) }).catch(() => {});
        close();
        toast(meal ? 'ცვლილება შენახულია' : 'კვება შენახულია');
        refresh();
      } catch (e) { toast(e.message || 'ვერ შეინახა.', 'error'); }
    }

    /* Panels */
    function paintPanel() {
      if (tab === 'search') return paintSearch();
      if (tab === 'saved') return paintSaved();
      if (tab === 'describe') return paintDescribe();
      if (tab === 'photo') return paintPhoto();
      return paintManual();
    }

    function portionPicker(food, back, source) {
      const serving = food.serving?.grams ? food.serving : null;
      const gramsIn = input({ type: 'number', min: '1', max: '10000', step: '1', value: String(serving?.grams || 100), class: 'input' });
      const preview = h('div', { class: 'nu-portion-preview' });
      const upd = () => {
        const n = Number(gramsIn.value);
        mount(preview, Number.isFinite(n) && n > 0 ? (() => { const it = portionFromFood(food, n); return [h('b', null, kcal(it.calories)), h('span', { class: 'faint' }, ` · ${macroLine(it)}`)]; })() : '—');
      };
      gramsIn.addEventListener('input', upd);
      upd();
      const quick = [serving ? { g: serving.grams, label: `${serving.label || 'პორცია'} · ${fmtNum(serving.grams)} გ` } : null, { g: 100, label: '100 გ' }, serving ? { g: serving.grams * 2, label: `2 × ${serving.label || 'პორცია'}` } : { g: 200, label: '200 გ' }].filter(Boolean);
      const addB = button('დამატება', { size: 'sm', icon: 'plus' });
      addB.addEventListener('click', () => {
        const n = Number(gramsIn.value);
        if (!Number.isFinite(n) || n <= 0 || n > 10000) { toast('შეიყვანე გრამი 1–10000.', 'error'); return; }
        if (food.kind === 'saved' && food.id) usedFoodIds.add(food.id);
        if (addItems([portionFromFood(food, n)], source)) { toast(`${food.name} დაემატა`); back(); }
      });
      mount(panel, h('div', { class: 'nu-portion' },
        h('button', { type: 'button', class: 'back', onClick: back }, icon('chevronLeft', { size: 16 }), 'უკან'),
        h('div', { class: 'nu-portion-name' }, h('b', null, food.name), food.brand ? h('span', { class: 'faint' }, ` · ${food.brand}`) : null),
        h('div', { class: 'faint', style: { fontSize: '12.5px' } }, `100 გ: ${kcal(food.per100?.calories)} · ${macroLine(food.per100 || {})}${food.quality === 'estimate' ? ' · მიახლოებითი' : ''}`),
        h('div', { class: 'chips' }, quick.map((q) => h('button', { type: 'button', class: 'chip', onClick: () => { gramsIn.value = String(q.g); upd(); } }, q.label))),
        h('div', { class: 'nu-portion-row' }, field('რაოდენობა (გ)', gramsIn), preview),
        h('div', null, addB)));
      gramsIn.focus();
    }

    function foodRow(food, onPick) {
      return h('button', { type: 'button', class: 'nu-food', onClick: onPick },
        h('div', { class: 'nu-food-main' },
          h('div', { class: 'nu-food-name' }, food.name, food.brand ? h('span', { class: 'faint' }, ` · ${food.brand}`) : null),
          h('div', { class: 'nu-food-sub' }, `${kcal(food.per100?.calories)} / 100 გ${food.serving?.grams ? ` · ${food.serving.label || 'პორცია'} ${fmtNum(food.serving.grams)} გ` : ''}`)),
        food.favorite ? icon('star', { size: 14, className: 'nu-fav' }) : null,
        icon('plus', { size: 18, className: 'nu-food-add' }));
    }

    let lastQuery = '';
    let searchSeq = 0;
    const searchCache = new Map();
    function paintSearch() {
      const q = input({ type: 'search', placeholder: 'მაგ: ხაჭაპური, ბრინჯი, მაწონი…', value: lastQuery, 'aria-label': 'საკვების ძიება', maxlength: '80' });
      const results = h('div', { class: 'nu-results' });
      const runSearch = debounce(async (text) => {
        const seq = ++searchSeq;
        if (text.length < 2) { mount(results, h('p', { class: 'faint nu-hint' }, 'ჩაწერე მინიმუმ 2 ასო. ჯერ შენს შენახულს ვეძებთ, შემდეგ ქართულ კატალოგს და პროდუქტების ბაზას.')); return; }
        if (!searchCache.has(text)) mount(results, h('p', { class: 'faint nu-hint' }, 'ვეძებ…'));
        try {
          const res = searchCache.get(text) || await get('/api/nutrition/foods/search', { q: text });
          searchCache.set(text, res);
          if (seq !== searchSeq) return;
          const groups = [
            ['შენი შენახული', res.saved || []],
            ['ქართული კატალოგი', res.catalog || []],
            ['პროდუქტები', res.products || []],
          ].filter(([, list]) => list.length);
          if (!groups.length) { mount(results, h('p', { class: 'faint nu-hint' }, 'ვერაფერი მოიძებნა. სცადე სხვა სიტყვა ან დაამატე ხელით.')); return; }
          mount(results, groups.map(([title, list]) => h('div', { class: 'nu-group' }, h('div', { class: 'nu-group-title' }, title),
            list.map((food) => foodRow(food, () => portionPicker(food, paintSearch, food.kind === 'saved' ? 'saved' : 'search'))))));
        } catch (e) {
          if (seq === searchSeq) mount(results, h('div', { class: 'form-error' }, e.message));
        }
      }, 400);
      q.addEventListener('input', () => { lastQuery = q.value.trim(); runSearch(lastQuery); });
      mount(panel, h('div', { class: 'nu-search' }, h('div', { class: 'nu-search-in' }, icon('search', { size: 18 }), q), results));
      runSearch(lastQuery);
      q.focus();
    }

    let recent = null;
    async function paintSaved() {
      mount(panel, skeleton(3));
      try {
        if (!recent) recent = await get('/api/nutrition/foods/recent');
        if (tab !== 'saved') return;
        const meals = (recent.meals || []).slice(0, 8);
        const foods = recent.foods || [];
        if (!meals.length && !foods.length) { mount(panel, h('p', { class: 'faint nu-hint' }, 'ჯერ შენახული საკვები არ გაქვს. დამატებულ საკვებს ვარსკვლავით შეინახავ.')); return; }
        mount(panel, h('div', { class: 'nu-results' },
          meals.length ? h('div', { class: 'nu-group' }, h('div', { class: 'nu-group-title' }, 'ბოლო კვებები'),
            meals.map((rm) => {
              const t = foodTotals(rm.items || []);
              return h('button', { type: 'button', class: 'nu-food', onClick: () => { if (addItems(rm.items || [], 'saved', rm.title)) toast('დაემატა'); } },
                h('div', { class: 'nu-food-main' },
                  h('div', { class: 'nu-food-name' }, rm.title || (rm.items || []).map((i) => i.name).join(' · ')),
                  h('div', { class: 'nu-food-sub' }, `${kcal(t.calories)} · ${MEAL_LABELS[rm.type] || ''} · ${fmtDate(rm.date)}`)),
                icon('plus', { size: 18, className: 'nu-food-add' }));
            })) : null,
          foods.length ? h('div', { class: 'nu-group' }, h('div', { class: 'nu-group-title' }, 'შენახული საკვები'),
            foods.map((food) => foodRow({ ...food, kind: 'saved' }, () => portionPicker({ ...food, kind: 'saved' }, paintSaved, 'saved')))) : null));
      } catch (e) { mount(panel, h('div', { class: 'form-error' }, e.message)); }
    }

    function paintDescribe() {
      const ta = textarea({ placeholder: 'მაგ: ორი ხინკალი, ქართული სალათი და ჭიქა ლიმონათი', maxlength: '500', rows: 3, value: draft.note || '' });
      const go = button('შეფასება', { icon: 'sparkles', size: 'sm' });
      const err = h('div', { class: 'form-error', hidden: true });
      go.addEventListener('click', () => busy(go, async () => {
        err.hidden = true;
        const text = ta.value.trim();
        if (text.length < 3) { err.textContent = 'აღწერე რა მიირთვი — მაგ. „ორი ხინკალი და სალათი“.'; err.hidden = false; return; }
        try {
          const res = await estimateRequest('text', { description: text });
          if (res?.declined) return;
          applyEstimate(res, 'text', !draft.items.length);
          if (!draft.note) draft.note = text.slice(0, 500);
          toast('შეფასება მზადაა — გადაამოწმე და შეინახე');
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      }));
      mount(panel, h('div', { class: 'stack', style: { gap: '10px' } },
        h('p', { class: 'faint nu-hint' }, 'აღწერე სიტყვებით — Medi შეაფასებს პორციას და კალორიებს. რაოდენობა თუ იცი, მიუთითე.'),
        ta, h('div', { class: 'hstack' }, go), err));
      ta.focus();
    }

    function paintPhoto() {
      const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', hidden: true });
      const note = input({ placeholder: photoMode === 'label' ? 'რამდენი მიირთვი? მაგ: ნახევარი შეკვრა' : 'შენიშვნა (არასავალდებულო): მაგ. ზეთის გარეშე', maxlength: '500', value: draft.note || '' });
      const err = h('div', { class: 'form-error', hidden: true });
      const go = button('შეფასება', { icon: 'sparkles', size: 'sm', disabled: !photo });
      const drop = h('div', { class: 'dropzone nu-drop', tabindex: '0', role: 'button', 'aria-label': 'ფოტოს არჩევა' });
      const paintDrop = () => mount(drop, photoUrl
        ? h('div', { class: 'nu-photo' }, h('img', { src: photoUrl, alt: 'არჩეული ფოტო' }), h('span', { class: 'faint' }, 'სხვა ფოტოს ასარჩევად დააჭირე'))
        : h('div', { class: 'stack', style: { alignItems: 'center', gap: '6px' } }, icon('camera', { size: 26 }), h('b', null, 'აირჩიე ან ჩააგდე ფოტო'), h('span', { class: 'faint', style: { fontSize: '12.5px' } }, 'JPEG, PNG, HEIC · 12 MB-მდე')));
      const take = (file) => {
        err.hidden = true;
        if (!file) return;
        if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) { err.textContent = 'აირჩიე სურათი.'; err.hidden = false; return; }
        if (file.size > 12 * 1024 * 1024) { err.textContent = 'ფოტო 12 MB-ზე ნაკლები უნდა იყოს.'; err.hidden = false; return; }
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        photo = file;
        photoUrl = URL.createObjectURL(file);
        go.disabled = false;
        paintDrop();
      };
      drop.addEventListener('click', () => fileIn.click());
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer?.files?.[0]); });
      fileIn.addEventListener('change', () => take(fileIn.files?.[0]));
      go.addEventListener('click', () => busy(go, async () => {
        err.hidden = true;
        if (!photo) return;
        try {
          const text = note.value.trim().slice(0, 500);
          const res = await estimateRequest(photoMode, { description: text }, photo);
          if (res?.declined) return;
          applyEstimate(res, photoMode === 'label' ? 'label' : 'photo', !draft.items.length);
          if (text && !draft.note) draft.note = text;
          toast('შეფასება მზადაა — გადაამოწმე და შეინახე');
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      }));
      paintDrop();
      mount(panel, h('div', { class: 'stack', style: { gap: '10px' } },
        segmented([{ value: 'photo', label: 'კერძი' }, { value: 'label', label: 'კვებითი ეტიკეტი' }], photoMode, (v) => { photoMode = v; note.placeholder = v === 'label' ? 'რამდენი მიირთვი? მაგ: ნახევარი შეკვრა' : 'შენიშვნა (არასავალდებულო): მაგ. ზეთის გარეშე'; }),
        drop, fileIn, note, h('div', { class: 'hstack' }, go), err,
        h('p', { class: 'faint', style: { fontSize: '12px' } }, 'გადაეცემა მხოლოდ არჩეული ფოტო და შენიშვნა. ფოტო სერვერზე არ ინახება.')));
    }

    function paintManual() {
      const it = editIndex != null ? draft.items[editIndex] : null;
      const f = (name, label, attrs = {}) => field(label, input({ name, type: 'number', min: '0', max: '10000', step: '0.1', inputmode: 'decimal', value: it?.[name] != null ? String(it[name]) : '', ...attrs }));
      const nameIn = input({ name: 'name', maxlength: '120', required: true, value: it?.name || '', placeholder: 'მაგ: შემწვარი კვერცხი' });
      const err = h('div', { class: 'form-error', hidden: true });
      const form = h('form', { class: 'form', onSubmit: (e) => {
        e.preventDefault();
        err.hidden = true;
        const fd = new FormData(form);
        const num = (k) => { const raw = String(fd.get(k) ?? '').replace(',', '.').trim(); return raw === '' ? null : Number(raw); };
        const name = String(fd.get('name') || '').trim();
        const grams = num('grams');
        const vals = { calories: num('calories'), protein: num('protein') ?? 0, carbs: num('carbs') ?? 0, fat: num('fat') ?? 0 };
        if (!name) { err.textContent = 'ჩაწერე საკვების სახელი.'; err.hidden = false; return; }
        if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) { err.textContent = 'რაოდენობა 1–10000 გრამი უნდა იყოს.'; err.hidden = false; return; }
        if (!Number.isFinite(vals.calories) || Object.values(vals).some((v) => !Number.isFinite(v) || v < 0 || v > 10000)) { err.textContent = 'შეიყვანე კალორია და მაკროები (0 ან მეტი).'; err.hidden = false; return; }
        const item = cleanItem({ ...(it || {}), name, grams, ...vals });
        if (it) { draft.items[editIndex] = item; editIndex = null; paintAll(); paintManual(); toast('შესწორდა'); }
        else if (addItems([item], 'manual')) { form.reset(); nameIn.focus(); toast(`${name} დაემატა`); }
      } },
      field('სახელი', nameIn),
      h('div', { class: 'nu-manual-grid' }, f('grams', 'გრამი', { min: '1', step: '1', required: true }), f('calories', 'კკალ', { required: true }), f('protein', 'ცილა (გ)'), f('carbs', 'ნახშირწყ. (გ)'), f('fat', 'ცხიმი (გ)')),
      err,
      h('div', { class: 'hstack' },
        button(it ? 'შესწორება' : 'დამატება', { type: 'submit', size: 'sm', icon: it ? 'check' : 'plus' }),
        it ? button('გაუქმება', { variant: 'ghost', size: 'sm', onClick: () => { editIndex = null; paintManual(); } }) : null));
      mount(panel, form);
      nameIn.focus();
    }

    paintTabs();
    paintAll();
    paintPanel();
    return m;
  }

  loadAll();
  return () => { alive = false; clearInterval(fastTimer); };
}

/** POST /api/nutrition/estimate inside the AI consent gate. JSON for text/fix, multipart when a photo travels. */
function estimateRequest(mode, { description = '', correction = '', previous = [] } = {}, photo = null) {
  return withAiConsent(() => {
    if (photo && mode !== 'text') {
      const fd = new FormData();
      fd.append('photo', photo, photo.name || 'meal.jpg');
      fd.append('mode', mode);
      fd.append('description', description);
      fd.append('correction', correction);
      fd.append('previous', JSON.stringify(previous));
      return request('/api/nutrition/estimate', { method: 'POST', body: fd, timeoutMs: 60_000 });
    }
    return post('/api/nutrition/estimate', { mode, description, correction, previous }, { timeoutMs: 60_000 });
  });
}

/* ── Home card: calories vs budget ring + macro meters ── */
export function homeCard() {
  ensureCss();
  const el = card({ class: 'nu-home' }, skeleton(3));
  const loadCard = async () => {
    mount(el, skeleton(3));
    try {
      const d = await get('/api/nutrition/program/dashboard');
      const eaten = Math.round(d?.today?.calories || 0);
      const cap = d?.budget || d?.targets?.calories || null;
      const tg = d?.targets;
      const t = d?.today || { protein: 0, carbs: 0, fat: 0 };
      const text = !cap
        ? (d?.mealCount ? `${d.mealCount} ჩანაწერი დღეს` : 'დღეს ჯერ არაფერი ჩაგიწერია')
        : d.remaining >= 0 ? `კიდევ ${kcal(d.remaining)} შეგიძლია დღეს` : `ბიუჯეტზე ${kcal(Math.abs(d.remaining))}-ით მეტი`;
      mount(el,
        h('div', { class: 'nu-home-top' },
          ring({ value: eaten, max: cap || Math.max(eaten, 1), size: 116, stroke: 11, color: cap && eaten > cap ? 'var(--c3)' : 'var(--brand)', label: fmtNum(eaten), labelScale: 0.2, sub: cap ? `/ ${fmtNum(cap)}` : 'კკალ' }),
          h('div', { class: 'stack', style: { gap: '10px', flex: 1, minWidth: '160px' } },
            h('b', { class: 'nu-home-head' }, text),
            meters(Object.entries(MACRO).map(([k, m]) => ({
              name: m.name, value: Number(t[k]) || 0, max: tg?.[k] || Math.max((Number(t.protein) || 0) + (Number(t.carbs) || 0) + (Number(t.fat) || 0), 1), color: m.color,
              right: tg?.[k] ? `${fmtNum(t[k], 0)} / ${fmtNum(tg[k])} გ` : `${fmtNum(t[k], 0)} გ`,
            }))))),
        h('div', { class: 'between nu-home-foot' },
          h('span', { class: 'faint' }, d?.streak?.current ? `სერია ${d.streak.current} დღე` : (cap ? `ბიუჯეტი ${fmtNum(cap)} კკალ` : 'სამიზნე აპში დგება')),
          h('a', { class: 'link', href: '/nutrition', 'data-link': '' }, d?.mealCount ? 'დღიური' : 'კვების ჩაწერა', icon('chevronRight', { size: 16 }))));
    } catch (e) {
      mount(el, errorBox(e, loadCard));
    }
  };
  loadCard().catch(() => {});
  return el;
}
