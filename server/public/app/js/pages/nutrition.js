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
import { withAiConsent, aiDeclinedSlot } from '../aiConsent.js';
import { featureOn } from '../session.js';
import { t } from '../i18n.js';
import { wordmark } from '../brand.js';

const CSS = '/app/css/nutrition.css';
const APP_STORE = 'https://apps.apple.com/app/id6812517519';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS = { breakfast: t('საუზმე', 'Breakfast'), lunch: t('სადილი', 'Lunch'), dinner: t('ვახშამი', 'Dinner'), snack: t('წახემსება', 'Snacks') };
const MEAL_ICON = { breakfast: ['sun', 'amber'], lunch: ['utensils', 'teal'], dinner: ['moon', 'violet'], snack: ['apple', 'rose'] };
const SOURCE_LABELS = {
  manual: t('ხელით', 'Manual'), photo: t('ფოტოდან', 'From photo'), plan: t('რაციონიდან', 'From meal plan'), text: t('აღწერიდან', 'From description'), voice: t('ხმით', 'By voice'),
  label: t('ეტიკეტიდან', 'From label'), barcode: t('შტრიხკოდით', 'By barcode'), search: t('ბაზიდან', 'From database'), saved: t('შენახულიდან', 'From saved'),
};
const MACRO = {
  protein: { name: t('ცილა', 'Protein'), short: t('ც', 'P'), color: 'var(--c2)', kcal: 4 },
  carbs: { name: t('ნახშირწყალი', 'Carbs'), short: t('ნ', 'C'), color: 'var(--c3)', kcal: 4 },
  fat: { name: t('ცხიმი', 'Fat'), short: t('ცხ', 'F'), color: 'var(--c4)', kcal: 9 },
};
const UNCERTAINTY = {
  low: t('შეფასება საკმაოდ ზუსტია', 'The estimate is fairly precise'),
  medium: t('შეფასება მიახლოებითია', 'The estimate is approximate'),
  high: t('პორცია განსაკუთრებით ყურადღებით გადაამოწმე', 'Check the portion especially carefully'),
};
const AI_NOTE = t('AI შეფასებას შენახვამდე ყოველთვის გადაამოწმებ — არაფერი ინახება შენ გარეშე.', 'You always review the AI estimate before saving — nothing is saved without you.');

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
  const tot = foodTotals(items);
  if (tot.calories <= 0) return null;
  const grams = items.reduce((s, i) => s + i.grams, 0) || 1;
  const proteinShare = (tot.protein * 4) / tot.calories;
  const fatShare = (tot.fat * 9) / tot.calories;
  const density = tot.calories / grams;
  let score = 6;
  score += Math.min(2, proteinShare * 6);
  if (fatShare > 0.45) score -= (fatShare - 0.45) * 5;
  if (density > 2.5) score -= Math.min(2, (density - 2.5) * 1.2);
  else if (density < 1.2) score += 0.5;
  if (tot.fiber != null) score += Math.min(1.5, (tot.fiber / tot.calories) * 400);
  if (tot.sugar != null) { const s = (tot.sugar * 4) / tot.calories; if (s > 0.15) score -= Math.min(2.5, (s - 0.15) * 10); }
  if (tot.sodium != null) { const p = tot.sodium / tot.calories; if (p > 1.2) score -= Math.min(2, (p - 1.2) * 1.5); }
  return Math.max(1, Math.min(10, Math.round(score)));
}
function scoreBadge(score) {
  if (score == null) return null;
  const tone = score >= 8 ? 'ok' : score >= 5 ? 'warn' : 'danger';
  const label = score >= 8 ? t('დაბალანსებული', 'Balanced') : score >= 5 ? t('საშუალო', 'Moderate') : t('მძიმე კერძი', 'Heavy meal');
  return h('span', { class: `badge badge-${tone}`, title: t(`კერძის ბალანსი ${score}/10 — ${label}`, `Meal balance ${score}/10 — ${label}`) }, `${score}/10`);
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
  const out = { name: String(i.name || '').trim().slice(0, 120) || t('საკვები', 'Food'), grams: Math.min(10000, Math.max(0.1, round1(Number(i.grams) || 0))) };
  for (const k of ['calories', 'protein', 'carbs', 'fat']) out[k] = Math.min(10000, Math.max(0, round1(Number(i[k]) || 0)));
  for (const k of ['fiber', 'sugar', 'sodium']) if (Number.isFinite(Number(i[k])) && i[k] !== null && i[k] !== '') out[k] = Math.max(0, round1(Number(i[k])));
  return out;
}
const KCAL = t('კკალ', 'kcal');
const G = t('გ', 'g');
const kcal = (n) => `${fmtNum(Math.round(Number(n) || 0))} ${KCAL}`;
const g = (n) => `${fmtNum(round1(Number(n) || 0), 1)} ${G}`;
function macroLine(tot) {
  return t(`ც ${fmtNum(tot.protein, 0)} · ნ ${fmtNum(tot.carbs, 0)} · ცხ ${fmtNum(tot.fat, 0)} გ`, `P ${fmtNum(tot.protein, 0)} · C ${fmtNum(tot.carbs, 0)} · F ${fmtNum(tot.fat, 0)} g`);
}
function dayLabel(key) {
  const r = relDay(key);
  return r === fmtDate(key) ? fmtDate(key, { year: parseDate(key).getFullYear() !== new Date().getFullYear() }) : `${r} · ${fmtDate(key)}`;
}
function hoursLabel(min) { const hh = Math.floor(min / 60); const mm = min % 60; return mm ? t(`${hh} სთ ${mm} წთ`, `${hh} h ${mm} min`) : t(`${hh} სთ`, `${hh} h`); }

/* ── Page ─────────────────────────────────────────────── */
export default async function nutritionPage(root, ctx) {
  ensureCss();
  const today = ymd();
  const S = {
    day: /^\d{4}-\d{2}-\d{2}$/.test(ctx?.query?.date || '') && ctx.query.date <= today ? ctx.query.date : today,
    dash: null, meals: [], activities: [], kinds: null, settings: null, fasting: null,
  };
  let alive = true;
  let fastTimer = null;
  let daySeq = 0;

  // Only the server's own photoEnabled: false is a pause; an unread or failed settings read is not.
  const aiOn = () => S.settings?.photoEnabled !== false && featureOn('nutritionAi');

  const settingsBtn = iconButton('settings', { title: t('ბიუჯეტის პარამეტრები', 'Budget settings'), onClick: () => openPreferences() });
  const addBtn = button(t('კვების დამატება', 'Add a meal'), { icon: 'plus', onClick: () => openMealEditor({ type: S.day === today ? mealTypeForHour() : 'lunch' }) });
  const dayBar = h('div', { class: 'nu-daybar' });
  const left = h('div', { class: 'nu-col' });
  const right = h('div', { class: 'nu-col' });
  mount(root,
    pageHead(wordmark('food'), t('კვება · ჩაწერე, გადაამოწმე, გაიგე.', 'Nutrition · log it, check it, understand it.'), settingsBtn, addBtn),
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
        get('/api/nutrition/settings').catch(() => null),
        get('/api/nutrition/fasting').catch(() => null),
        loadDay(false),
      ]);
      if (!alive) return;
      S.dash = dash; if (settings) S.settings = settings; S.fasting = fasting;
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
    } catch (e) { toast(e.message || t('განახლება ვერ მოხერხდა.', 'Couldn’t refresh.'), 'error'); }
  }

  function setDay(key) {
    if (key > today) return;
    S.day = key;
    renderDayBar();
    try { history.replaceState(history.state, '', key === today ? location.pathname : `${location.pathname}?date=${key}`); } catch { /* ignore */ }
    loadDay(true).catch((e) => mount(right, errorBox(e, () => setDay(S.day))));
  }

  function renderDayBar() {
    const picker = input({ type: 'date', value: S.day, max: today, class: 'input nu-datepick', 'aria-label': t('თარიღის არჩევა', 'Choose a date'), onChange: (e) => { if (e.target.value) setDay(e.target.value); } });
    mount(dayBar,
      iconButton('chevronLeft', { title: t('წინა დღე', 'Previous day'), onClick: () => setDay(shiftDay(S.day, -1)) }),
      h('div', { class: 'nu-daylabel' }, h('b', null, dayLabel(S.day)), picker),
      h('button', { class: 'icon-btn', type: 'button', title: t('შემდეგი დღე', 'Next day'), 'aria-label': t('შემდეგი დღე', 'Next day'), disabled: S.day >= today, onClick: () => setDay(shiftDay(S.day, 1)) }, icon('chevronRight', { size: 20 })),
      S.day !== today ? button(t('დღეს', 'Today'), { variant: 'ghost', size: 'sm', onClick: () => setDay(today) }) : null);
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
        h('div', { class: 'stack', style: { gap: '4px', flex: 1 } }, h('div', { class: 'card-title' }, t('გეგმა გადასამოწმებელია', 'Your plan needs a review')), h('p', { class: 'muted', style: { fontSize: '13.5px' } }, d.reasons.join(' ')),
          h('a', { class: 'link', href: APP_STORE, target: '_blank', rel: 'noopener' }, t('გეგმას MEDICARD აპში გადაამოწმებ', 'Review your plan in the MEDICARD app'), icon('externalLink', { size: 14 }))))));
    }
    const fast = fastingCard();
    if (fast) nodes.push(section(t('ინტერვალური შიმშილი', 'Intermittent fasting'), fast));
    nodes.push(section(t('ეს კვირა', 'This week'), weekCard(d)));
    nodes.push(h('div', { class: 'grid grid-2' }, streakCard(d), projectionCard(d)));
    nodes.push(section(t('სხეულის ზომები', 'Body measurements'), measurementsCard(d), { action: button(t('ჩაწერა', 'Log'), { size: 'sm', variant: 'ghost', icon: 'plus', onClick: openMeasurement }) }));
    nodes.push(h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), t('კალორიები და მაკროები მიახლოებითია. ეს ორიენტირია, არა ექიმის ან დიეტოლოგის დანიშნულება.', 'Calories and macros are approximate. This is a guide, not a prescription from a doctor or dietitian.')));
    mount(left, nodes);
    scheduleFastTick();
  }

  function balanceCard(f) {
    const eaten = Math.round(f.eaten?.calories || 0);
    const cap = f.budget || f.target;
    let headline;
    let sub;
    if (!cap) {
      headline = f.isToday ? t(`დღეს ${kcal(eaten)}`, `${kcal(eaten)} today`) : t(`${kcal(eaten)} ჩაწერილი`, `${kcal(eaten)} logged`);
      sub = S.dash?.program
        ? (S.dash.needsReview ? t('გეგმა გადასამოწმებელია — სამიზნე დროებით არ ითვლება.', 'Your plan needs a review — the target isn’t counted for now.') : t('ამ დღის სამიზნე არ არის შენახული.', 'No target was saved for this day.'))
        : t('დღის სამიზნე ჯერ არ გაქვს. კვების გეგმას MEDICARD აპში შეადგენ.', 'You don’t have a daily target yet. Set up a meal plan in the MEDICARD app.');
    } else if (f.remaining >= 0) {
      headline = f.isToday ? t(`კიდევ ${kcal(f.remaining)} შეგიძლია დღეს`, `${kcal(f.remaining)} left for today`) : t(`სამიზნეზე ${kcal(f.remaining)}-ით ნაკლები`, `${kcal(f.remaining)} under target`);
      sub = null;
    } else {
      headline = f.isToday ? t(`დღის ბიუჯეტზე ${kcal(Math.abs(f.remaining))}-ით მეტი`, `${kcal(Math.abs(f.remaining))} over today’s budget`) : t(`სამიზნეზე ${kcal(Math.abs(f.remaining))}-ით მეტი`, `${kcal(Math.abs(f.remaining))} over target`);
      sub = f.isToday ? t('ხვალ ახალი დღეა.', 'Tomorrow is a new day.') : null;
    }
    const d = S.dash;
    const formula = f.isToday && d?.targets?.calories && d.budget
      ? `${t('სამიზნე', 'Target')} ${fmtNum(d.targets.calories)}${d.burned?.counted > 0 ? ` + ${t('დამწვარი', 'burned')} ${fmtNum(d.burned.counted)}` : ''}${d.rollover > 0 ? ` + ${t('გუშინდელი', 'from yesterday')} ${fmtNum(d.rollover)}` : ''} = ${fmtNum(d.budget)} ${KCAL}`
      : cap ? `${t('სამიზნე', 'Target')} ${fmtNum(cap)} ${KCAL}` : null;
    const over = cap && eaten > cap;
    return card({ class: 'spotlight hero-card nu-balance' },
      h('div', { class: 'between' }, h('div', null, h('div', { class: 'card-title' }, t('დღის ბალანსი', 'Daily balance')), h('div', { class: 'card-sub' }, dayLabel(S.day))), tile('flame', 'teal', 38)),
      h('div', { class: 'nu-balance-body' },
        ring({ value: eaten, max: cap || Math.max(eaten, 1), size: 150, stroke: 13, color: over ? '#fbbf24' : '#2dd4bf', track: 'rgba(255,255,255,.12)', label: fmtNum(eaten), labelScale: 0.19, sub: cap ? `/ ${fmtNum(cap)} ${KCAL}` : KCAL }),
        h('div', { class: 'stack', style: { gap: '6px', minWidth: 0 } },
          h('b', { class: 'nu-headline' }, headline),
          sub ? h('p', { class: 'muted', style: { fontSize: '13px' } }, sub) : null,
          formula ? h('p', { class: 'nu-formula' }, formula) : null,
          !cap && !S.dash?.program ? h('a', { class: 'nu-spot-link', href: APP_STORE, target: '_blank', rel: 'noopener' }, t('MEDICARD აპი', 'MEDICARD app'), icon('externalLink', { size: 14 })) : null)));
  }

  function macroCard(f) {
    const tot = f.eaten || { protein: 0, carbs: 0, fat: 0 };
    const tg = f.targets;
    const parts = Object.entries(MACRO).map(([k, m]) => ({ name: m.name, value: (Number(tot[k]) || 0) * m.kcal, color: m.color }));
    const total = parts.reduce((s, p) => s + p.value, 0);
    return card({ class: 'nu-macros' },
      h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('მაკროები', 'Macros')), h('div', { class: 'card-sub' }, tg?.split ? t(`შენი განაწილება ${tg.split.protein}/${tg.split.carbs}/${tg.split.fat}`, `Your split ${tg.split.protein}/${tg.split.carbs}/${tg.split.fat}`) : tg ? t('გეგმის მიხედვით', 'Based on your plan') : t('დღის სამიზნე არ არის', 'No daily target')))),
      h('div', { class: 'nu-macro-body' },
        donut({ parts, size: 116, stroke: 14, center: h('div', null, h('strong', { style: { fontSize: '17px' } }, total ? `${Math.round(((tot.protein * 4) / total) * 100)}%` : '—'), h('span', null, t('ცილა', 'Protein'))) }),
        meters(Object.entries(MACRO).map(([k, m]) => ({
          name: m.name,
          value: Number(tot[k]) || 0,
          max: tg?.[k] || Math.max((Number(tot.protein) || 0) + (Number(tot.carbs) || 0) + (Number(tot.fat) || 0), 1),
          color: m.color,
          right: tg?.[k] ? `${fmtNum(tot[k], 0)} / ${fmtNum(tg[k])} ${G}` : `${fmtNum(tot[k], 0)} ${G}`,
        })))),
      micros(tot));
  }

  function micros(tot) {
    const list = [
      tot.fiber != null ? `${t('ბოჭკო', 'Fiber')} ${g(tot.fiber)}` : null,
      tot.sugar != null ? `${t('შაქარი', 'Sugar')} ${g(tot.sugar)}` : null,
      tot.sodium != null ? `${t('ნატრიუმი', 'Sodium')} ${fmtNum(Math.round(tot.sodium))} ${t('მგ', 'mg')}` : null,
    ].filter(Boolean);
    return list.length ? h('div', { class: 'nu-micros' }, list.map((x) => h('span', null, x))) : null;
  }

  function dayTiles(d) {
    const tileCard = (ic, ink, value, label, href) => h(href ? 'a' : 'div', { class: 'card nu-tile hover', href, 'data-link': href ? '' : undefined },
      tile(ic, ink, 34), h('div', null, h('b', null, value), h('span', null, label)));
    const water = d.water || { ml: 0, goalMl: null };
    return h('div', { class: 'nu-tiles' },
      tileCard('droplet', 'sky', water.goalMl ? `${fmtNum(water.ml / 1000, 1)} / ${fmtNum(water.goalMl / 1000, 1)} ${t('ლ', 'L')}` : `${fmtNum(water.ml / 1000, 1)} ${t('ლ', 'L')}`, t('წყალი', 'Water'), '/health'),
      tileCard('footprints', 'green', fmtNum(d.steps || 0), t('ნაბიჯი', 'Steps'), '/health'),
      tileCard('zap', 'amber', `${fmtNum(d.burned?.total || 0)} ${KCAL}`, d.preferences?.addBurned ? t('დამწვარი · ბიუჯეტში', 'Burned · in budget') : t('დამწვარი', 'Burned')),
      tileCard('flame', 'rose', t(`${d.streak?.current || 0} დღე`, `${d.streak?.current || 0} ${(d.streak?.current || 0) === 1 ? 'day' : 'days'}`), t('სერია', 'Streak')));
  }

  function weekCard(d) {
    const days = d.days || [];
    if (!days.length) return card(empty(t('კვირის მონაცემები ჯერ არ არის', 'No data for this week yet'), t('ჩაწერე კვება და აქ კვირის სურათი გამოჩნდება.', 'Log your meals and your week will show up here.')));
    const target = d.targets?.calories || days.map((x) => x.target?.calories).filter(Boolean).at(-1) || null;
    const w = d.week || {};
    return card({ class: 'pad-lg' },
      h('div', { class: 'nu-week-stats' },
        wstat(t('საშუალო დღეში', 'Daily average'), w.averageCalories != null ? kcal(w.averageCalories) : '—'),
        wstat(t('ჩაწერილი დღე', 'Days logged'), `${w.recordedDays || 0} / 7`),
        wstat(t('სამიზნის ფარგლებში', 'On target'), w.targetDays ? `${w.onTargetDays} / ${w.targetDays}` : '—'),
        wstat(t('ბალანსი', 'Balance'), w.balanceCalories != null ? `${w.balanceCalories > 0 ? '+' : w.balanceCalories < 0 ? '−' : ''}${fmtNum(Math.abs(w.balanceCalories))} ${KCAL}` : '—')),
      barChart({
        labels: days.map((x) => `${KA_DAYS_SHORT[parseDate(x.date).getDay()]} ${parseDate(x.date).getDate()}`),
        tipLabels: days.map((x) => `${fmtDate(x.date)}${x.target?.calories ? ` · ${t('სამიზნე', 'target')} ${fmtNum(x.target.calories)}` : ''}`),
        stacked: [
          { name: MACRO.protein.name, values: days.map((x) => Math.round((x.totals?.protein || 0) * 4)), color: MACRO.protein.color },
          { name: MACRO.carbs.name, values: days.map((x) => Math.round((x.totals?.carbs || 0) * 4)), color: MACRO.carbs.color },
          { name: MACRO.fat.name, values: days.map((x) => Math.round((x.totals?.fat || 0) * 9)), color: MACRO.fat.color },
        ],
        goal: target,
        goalLabel: target ? `${t('სამიზნე', 'Target')} ${fmtNum(target)}` : null,
        fmt: (v) => `${fmtNum(v)} ${KCAL}`,
        height: 210,
      }),
      h('div', { class: 'legend', style: { marginTop: '12px' } }, Object.values(MACRO).map((m) => h('span', null, h('i', { style: { background: m.color } }), `${m.name} (${KCAL})`))),
      w.averageProtein != null ? h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, t(`საშუალოდ ${fmtNum(w.averageProtein)} გ ცილა ჩაწერილ დღეს.`, `On average ${fmtNum(w.averageProtein)} g of protein per logged day.`)) : null);
  }
  const wstat = (label, value) => h('div', { class: 'nu-wstat' }, h('span', null, label), h('b', null, value));

  function streakCard(d) {
    const s = d.streak || { current: 0, best: 0 };
    const text = s.loggedToday
      ? (s.nextMilestone ? t(`დღეს ჩაწერილია. შემდეგი ნიშნული ${s.nextMilestone} დღეა.`, `Logged today. Next milestone: ${s.nextMilestone} days.`) : t('დღეს ჩაწერილია. ყველა ნიშნული აღებულია!', 'Logged today. Every milestone reached!'))
      : s.current > 0 ? t('დღეს ერთი ჩანაწერი — და სერია გრძელდება.', 'One entry today and your streak continues.') : t('პირველი ჩანაწერით სერია იწყება. გამოტოვება ვალს არ ქმნის.', 'Your streak starts with your first entry. Skipping a day doesn’t put you in debt.');
    return card(
      h('div', { class: 'hstack', style: { marginBottom: '10px' } }, tile('flame', 'rose', 38), h('div', null, h('div', { class: 'card-title' }, t('სერია', 'Streak')), h('div', { class: 'card-sub' }, t(`რეკორდი ${s.best || 0} დღე`, `Best: ${s.best || 0} ${(s.best || 0) === 1 ? 'day' : 'days'}`)))),
      h('div', { class: 'nu-big' }, fmtNum(s.current || 0), h('small', null, t(' დღე ზედიზედ', (s.current || 0) === 1 ? ' day in a row' : ' days in a row'))),
      h('p', { class: 'muted', style: { fontSize: '13px', marginTop: '6px' } }, text),
      s.reached?.length ? h('div', { class: 'chips', style: { marginTop: '10px' } }, s.reached.map((m) => h('span', { class: 'badge badge-brand' }, t(`${m} დღე`, `${m} days`)))) : null);
  }

  function projectionCard(d) {
    const p = d.projection || {};
    const goal = d.facts?.weightGoal;
    const hist = d.facts?.weightHistory || [];
    const current = d.facts?.current?.kg ?? p.current ?? null;
    const headRow = h('div', { class: 'between', style: { marginBottom: '10px' } },
      h('div', { class: 'hstack' }, tile('scale', 'violet', 38), h('div', null, h('div', { class: 'card-title' }, t('წონის მიზანი', 'Weight goal')), h('div', { class: 'card-sub' }, goal ? t('პროგნოზი ჩანაწერებიდან', 'Forecast from your entries') : t('მიზანი არ არის დაყენებული', 'No goal set')))),
      h('a', { class: 'link', href: '/health', 'data-link': '' }, t('წონა', 'Weight'), icon('chevronRight', { size: 16 })));
    if (!goal || current == null) {
      return card(headRow, h('p', { class: 'muted', style: { fontSize: '13px' } }, current == null ? t('ჩაწერე წონა „მაჩვენებლებში“ — აქ პროგნოზი გამოჩნდება.', 'Log your weight in “Health metrics” and a forecast will appear here.') : t('წონის მიზანს „მაჩვენებლებში“ დააყენებ.', 'Set a weight goal in “Health metrics”.')));
    }
    const text = p.direction === 'reached'
      ? t('მიზანი მიღწეულია — გილოცავ!', 'Goal reached — congratulations!')
      : p.trendEta ? t(`მიმდინარე ტემპით მიზანს დაახლოებით ${fmtDate(p.trendEta, { year: true })}-ს მიაღწევ.`, `At your current pace you’ll reach your goal around ${fmtDate(p.trendEta, { year: true })}.`)
        : p.planEta ? t(`გეგმის ტემპით ორიენტირი: ${fmtDate(p.planEta, { year: true })}.`, `At your plan’s pace, roughly: ${fmtDate(p.planEta, { year: true })}.`)
          : t('წონას როცა რამდენჯერმე ჩაწერ, პროგნოზიც გამოჩნდება.', 'Once you’ve logged your weight a few times, a forecast will appear.');
    return card(headRow,
      h('div', { class: 'nu-kg' }, h('b', null, fmtNum(current, 1)), h('span', null, '→'), h('b', { class: 'brand' }, fmtNum(goal.targetKg, 1)), h('small', null, t('კგ', 'kg'))),
      hist.length >= 2 ? lineChart({ labels: hist.map((x) => fmtDate(x.date, { short: true })), series: [{ name: t('წონა', 'Weight'), values: hist.map((x) => x.weightKg), color: 'var(--ink-violet)' }], goal: goal.targetKg, zero: false, unit: t('კგ', 'kg'), fmt: (v) => fmtNum(v, 1), height: 110 }) : null,
      h('p', { class: 'muted', style: { fontSize: '13px', marginTop: '8px' } }, text),
      p.trendKgPerWeek != null ? h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t(`ტენდენცია: ${p.trendKgPerWeek > 0 ? '+' : ''}${fmtNum(p.trendKgPerWeek, 2)} კგ კვირაში`, `Trend: ${p.trendKgPerWeek > 0 ? '+' : ''}${fmtNum(p.trendKgPerWeek, 2)} kg per week`)) : null);
  }

  function measurementsCard(d) {
    const list = d.measurements || [];
    if (!list.length) return card(empty(t('ზომები ჯერ არ არის', 'No measurements yet'), t('წელი, თეძო, მკერდი — სასწორის გარდა ცვლილების კიდევ ერთი საზომი.', 'Waist, hips, chest — another way to see change besides the scale.'), button(t('ზომების ჩაწერა', 'Log measurements'), { variant: 'secondary', size: 'sm', icon: 'ruler', onClick: openMeasurement })));
    const [last, prev] = list;
    const keys = [['waistCm', t('წელი', 'Waist')], ['hipsCm', t('თეძო', 'Hips')], ['chestCm', t('მკერდი', 'Chest')], ['armCm', t('მკლავი', 'Arm')], ['thighCm', t('ბარძაყი', 'Thigh')]];
    return card(
      h('div', { class: 'card-sub', style: { marginBottom: '12px' } }, t(`ბოლო ჩანაწერი: ${fmtDate(last.date)}`, `Last entry: ${fmtDate(last.date)}`)),
      h('div', { class: 'nu-measure' }, keys.filter(([k]) => last[k] != null).map(([k, label]) => {
        const diff = prev?.[k] != null ? round1(last[k] - prev[k]) : null;
        return h('div', { class: 'nu-wstat' }, h('span', null, label), h('b', null, `${fmtNum(last[k], 1)} ${t('სმ', 'cm')}`),
          diff ? h('small', { class: 'faint' }, `${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff), 1)} ${t('სმ', 'cm')}`) : null);
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
        const endBtn = button(t('დასრულება', 'End'), { variant: 'secondary', size: 'sm' });
        endBtn.addEventListener('click', async () => {
          const ok = await confirmDialog({ title: t('შიმშილის დასრულება?', 'End your fast?'), body: pct >= 1 ? t('მიზანი შესრულებულია. ჩანაწერი ისტორიაში შეინახება.', 'Goal reached. The entry will be saved to your history.') : t(`ჯერ ${hoursLabel(mins)} გავიდა. ჩანაწერი ისტორიაში მაინც შეინახება.`, `Only ${hoursLabel(mins)} so far. The entry will still be saved to your history.`), confirm: t('დასრულება', 'End') });
          if (!ok) return;
          await busy(endBtn, async () => {
            try { await post(`/api/nutrition/fasting/${active.id}/end`, {}); toast(t('შიმშილი დასრულდა', 'Fast ended')); refresh(); } catch (e) { toast(e.message, 'error'); }
          });
        });
        mount(el,
          h('div', { class: 'hstack', style: { gap: '18px', flexWrap: 'nowrap' } },
            ring({ value: mins, max: active.targetMinutes, size: 96, stroke: 10, color: 'var(--ink-violet)', label: `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`, labelScale: 0.2, sub: t('სთ', 'h') }),
            h('div', { class: 'stack', style: { gap: '4px', flex: 1, minWidth: 0 } },
              h('div', { class: 'card-title' }, pct >= 1 ? t('მიზანი შესრულდა', 'Goal reached') : t(`მიზანი ${fmtTime(active.goalAt)}-ზე`, `Goal at ${fmtTime(active.goalAt)}`)),
              h('div', { class: 'card-sub' }, t(`დაიწყო ${relDay(active.startedAt)}, ${fmtTime(active.startedAt)} · ${hoursLabel(active.targetMinutes)} ფანჯარა`, `Started ${relDay(active.startedAt)}, ${fmtTime(active.startedAt)} · ${hoursLabel(active.targetMinutes)} window`)),
              h('div', { class: 'hstack', style: { marginTop: '6px' } }, endBtn))));
      };
      paint();
      el._paint = paint;
      return el;
    }
    const elig = fs?.eligibility;
    if (elig?.eligible && fs?.settings) {
      const startBtn = button(`${t('დაწყება', 'Start')} · ${fs.settings.protocol === 'custom' ? hoursLabel(fs.settings.targetMinutes) : fs.settings.protocol}`, { variant: 'secondary', size: 'sm', icon: 'play' });
      startBtn.addEventListener('click', () => busy(startBtn, async () => {
        try {
          await post('/api/nutrition/fasting/start', { id: uuid(), protocol: fs.settings.protocol, targetMinutes: fs.settings.targetMinutes });
          toast(t('შიმშილის ტაიმერი ჩაირთო', 'Fasting timer started'));
          refresh();
        } catch (e) { toast(e.message, 'error'); }
      }));
      const st = fs.stats || {};
      return card(h('div', { class: 'hstack', style: { alignItems: 'flex-start' } }, tile('timer', 'violet', 38),
        h('div', { class: 'stack', style: { gap: '4px', flex: 1 } },
          h('div', { class: 'card-title' }, t('შიმშილის ტაიმერი', 'Fasting timer')),
          h('div', { class: 'card-sub' }, st.week?.count ? t(`ამ კვირაში ${st.week.completed} / ${st.week.count} მიზანი შესრულდა`, `${st.week.completed} / ${st.week.count} goals reached this week`) : t('დღიური კვების ფანჯარა, შენი რეჟიმით', 'A daily eating window, on your schedule')),
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
    const byType = Object.fromEntries(MEAL_TYPES.map((mt) => [mt, []]));
    for (const m of [...S.meals].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))) (byType[m.type] || byType.snack).push(m);
    const total = foodTotals(S.meals.flatMap((m) => m.items || []));
    const nodes = [
      h('div', { class: 'between nu-diary-head' },
        h('div', null, h('h2', null, t('დღიური', 'Diary')), h('span', { class: 'faint' }, S.meals.length ? t(`${S.meals.length} ჩანაწერი · ${kcal(total.calories)}`, `${S.meals.length} ${S.meals.length === 1 ? 'entry' : 'entries'} · ${kcal(total.calories)}`) : t('ჯერ ცარიელია', 'Empty so far'))),
        S.day !== today && S.meals.length ? button(t('დღეს გამეორება', 'Repeat today'), { variant: 'ghost', size: 'sm', icon: 'copy', onClick: (e) => copyToToday(S.meals, e.currentTarget) }) : null),
    ];
    for (const mt of MEAL_TYPES) nodes.push(mealTypeCard(mt, byType[mt]));
    nodes.push(section(t('ვარჯიში და ენერგია', 'Exercise and energy'), activitiesCard(), { action: button(t('დამატება', 'Add'), { size: 'sm', variant: 'ghost', icon: 'plus', onClick: openActivity }) }));
    mount(right, nodes);
  }

  function mealTypeCard(type, meals) {
    const [ic, ink] = MEAL_ICON[type];
    const tot = foodTotals(meals.flatMap((m) => m.items || []));
    return card({ class: 'nu-meal' },
      h('div', { class: 'between' },
        h('div', { class: 'hstack' }, tile(ic, ink, 36), h('div', null, h('div', { class: 'card-title' }, MEAL_LABELS[type]), h('div', { class: 'card-sub' }, meals.length ? `${kcal(tot.calories)} · ${macroLine(tot)}` : t('ჯერ არაფერი', 'Nothing yet')))),
        iconButton('plus', { title: t(`${MEAL_LABELS[type]} — დამატება`, `Add to ${MEAL_LABELS[type].toLowerCase()}`), onClick: () => openMealEditor({ type }) })),
      meals.length ? h('div', { class: 'nu-entries' }, meals.map((m) => mealEntry(m))) : null);
  }

  function mealEntry(m) {
    const tot = m.totals || foodTotals(m.items || []);
    const names = (m.items || []).map((i) => i.name);
    const edit = iconButton('edit', { title: t('რედაქტირება', 'Edit'), size: 18, onClick: () => openMealEditor({ meal: m }) });
    const remove = iconButton('trash', { title: t('წაშლა', 'Delete'), size: 18, onClick: () => removeMeal(m) });
    return h('div', { class: 'nu-entry' },
      h('button', { type: 'button', class: 'nu-entry-main', onClick: () => openMealEditor({ meal: m }) },
        h('div', { class: 'nu-entry-title' }, m.title || names.join(' · ') || t('კვება', 'Meal')),
        h('div', { class: 'nu-entry-sub' },
          h('span', null, `${kcal(tot.calories)} · ${macroLine(tot)}`),
          SOURCE_LABELS[m.source] ? h('span', { class: 'faint' }, ` · ${SOURCE_LABELS[m.source]}`) : null),
        m.title && names.length ? h('div', { class: 'nu-entry-items' }, names.join(', ')) : null),
      h('div', { class: 'nu-entry-side' }, scoreBadge(m.healthScore ?? healthScore(m.items || [])), h('div', { class: 'nu-entry-actions' }, edit, remove)));
  }

  async function removeMeal(m) {
    const ok = await confirmDialog({ title: t('ჩანაწერის წაშლა?', 'Delete this entry?'), body: t('ეს კვება დღიურიდან წაიშლება.', 'This meal will be removed from your diary.'), confirm: t('წაშლა', 'Delete'), danger: true });
    if (!ok) return;
    try {
      await del(`/api/nutrition/meals/${m.id}`);
      toast(t('წაიშალა', 'Deleted'));
      refresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function copyToToday(meals, btn) {
    const ok = await confirmDialog({ title: t('დღეს გამეორება?', 'Repeat today?'), body: t(`${meals.length === 1 ? 'ეს კვება' : `${meals.length} კვება`} დღევანდელ დღიურში დაკოპირდება.`, `${meals.length === 1 ? 'This meal' : `${meals.length} meals`} will be copied to today’s diary.`), confirm: t('გამეორება', 'Repeat') });
    if (!ok) return;
    await busy(btn, async () => {
      try {
        const res = await post('/api/nutrition/meals/copy', { date: today, copies: meals.slice(0, 25).map((m) => ({ fromId: m.id, id: uuid() })) });
        toast(res?.meals?.length === 1 ? t('კვება დაკოპირდა', 'Meal copied') : t(`${res?.meals?.length || 0} კვება დაკოპირდა`, `${res?.meals?.length || 0} meals copied`), 'ok', { action: { label: t('ნახვა', 'View'), onClick: () => setDay(today) } });
        refresh();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  function activitiesCard() {
    const list = S.activities || [];
    const label = (k) => S.kinds?.[k]?.label || k;
    if (!list.length) {
      return card(h('div', { class: 'hstack' }, tile('zap', 'amber', 36),
        h('div', null, h('div', { class: 'card-title' }, t('ვარჯიში ჯერ არ არის', 'No exercise yet')), h('div', { class: 'card-sub' }, S.dash?.preferences?.addBurned ? t('დამწვარი კალორიები ბიუჯეტს დაემატება.', 'Burned calories will be added to your budget.') : t('სირბილი, ძალოვანი, სიარული — დამწვარი ენერგიის შეფასებით.', 'Running, strength, walking — with an estimate of energy burned.')))));
    }
    return card(h('div', { class: 'list' }, list.map((a) => h('div', { class: 'row' },
      tile('zap', 'amber', 34),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, label(a.kind)), h('div', { class: 'row-sub' }, `${a.minutes} ${t('წთ', 'min')} · ≈ ${kcal(a.kcal)}${a.note ? ` · ${a.note}` : ''}`)),
      h('div', { class: 'row-trail' }, iconButton('trash', { title: t('წაშლა', 'Delete'), size: 18, onClick: async () => {
        if (!(await confirmDialog({ title: t('ვარჯიშის წაშლა?', 'Delete this workout?'), body: `${label(a.kind)} · ${a.minutes} ${t('წთ', 'min')}`, confirm: t('წაშლა', 'Delete'), danger: true }))) return;
        try { await del(`/api/nutrition/activities/${a.id}`); toast(t('წაიშალა', 'Deleted')); refresh(); } catch (e) { toast(e.message, 'error'); }
      } }))))),
    h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '8px' } }, t('კალორიები MET ფორმულით შეფასებულია — ორიენტირია, არა გაზომვა.', 'Calories are estimated with the MET formula — a guide, not a measurement.')));
  }

  function openActivity() {
    const kinds = S.kinds || { walk: { label: t('სიარული', 'Walking') }, run: { label: t('სირბილი', 'Running') }, cycle: { label: t('ველოსიპედი', 'Cycling') }, strength: { label: t('ძალოვანი ვარჯიში', 'Strength training') }, other: { label: t('სხვა აქტივობა', 'Other activity') } };
    formModal({
      title: t('ვარჯიშის დამატება', 'Add a workout'),
      size: 'sm',
      fields: [
        h('p', { class: 'faint', style: { fontSize: '13px' } }, dayLabel(S.day)),
        field(t('ვარჯიში', 'Workout'), select(Object.entries(kinds).map(([value, k]) => ({ value, label: k.label })), 'walk', { name: 'kind' })),
        h('div', { class: 'form-row' },
          field(t('ხანგრძლივობა (წთ)', 'Duration (min)'), input({ name: 'minutes', type: 'number', min: '1', max: '600', required: true, value: '30' })),
          field(t('კალორია (არასავალდებულო)', 'Calories (optional)'), input({ name: 'kcal', type: 'number', min: '0', max: '5000', placeholder: t('ავტომატურად', 'Automatic') }))),
        field(t('შენიშვნა', 'Note'), input({ name: 'note', maxlength: '200', placeholder: t('არასავალდებულო', 'Optional') })),
      ],
      onSubmit: async (v, close) => {
        const minutes = Math.round(Number(v.minutes));
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) throw new Error(t('ხანგრძლივობა 1–600 წუთი უნდა იყოს.', 'Duration must be 1–600 minutes.'));
        const k = v.kcal === '' ? null : Math.round(Number(v.kcal));
        if (k != null && (!Number.isFinite(k) || k < 0 || k > 5000)) throw new Error(t('კალორია 0–5000 უნდა იყოს.', 'Calories must be 0–5000.'));
        const res = await put(`/api/nutrition/activities/${uuidFor('act')}`, { id: uuidFor('act'), date: S.day, kind: v.kind, minutes, kcal: k, note: String(v.note || '').trim().slice(0, 200) });
        resetUuid('act');
        close();
        toast(res?.estimated ? t(`ჩაიწერა · ≈ ${kcal(res.activity?.kcal)}`, `Logged · ≈ ${kcal(res.activity?.kcal)}`) : t('ჩაიწერა', 'Logged'));
        refresh();
      },
    });
  }

  function openMeasurement() {
    const last = S.dash?.measurements?.[0] || {};
    const num = (name, label, min, max) => field(label, input({ name, type: 'number', step: '0.1', min: String(min), max: String(max), inputmode: 'decimal', placeholder: last[name] != null ? String(last[name]) : '' }));
    formModal({
      title: t('სხეულის ზომები', 'Body measurements'),
      size: 'sm',
      fields: [
        h('p', { class: 'faint', style: { fontSize: '13px' } }, t(`დღეს · ${fmtDate(today)} · სანტიმეტრებში`, `Today · ${fmtDate(today)} · in centimeters`)),
        h('div', { class: 'form-row' }, num('waistCm', t('წელი', 'Waist'), 30, 250), num('hipsCm', t('თეძო', 'Hips'), 30, 250)),
        h('div', { class: 'form-row' }, num('chestCm', t('მკერდი', 'Chest'), 30, 250), num('armCm', t('მკლავი', 'Arm'), 10, 100)),
        num('thighCm', t('ბარძაყი', 'Thigh'), 20, 150),
      ],
      onSubmit: async (v, close) => {
        const body = {};
        const bounds = { waistCm: [30, 250], hipsCm: [30, 250], chestCm: [30, 250], armCm: [10, 100], thighCm: [20, 150] };
        for (const [k, [lo, hi]] of Object.entries(bounds)) {
          const raw = String(v[k] || '').replace(',', '.').trim();
          if (!raw) { body[k] = null; continue; }
          const n = Number(raw);
          if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(t(`მნიშვნელობა ${lo}–${hi} სმ-ის ფარგლებში უნდა იყოს.`, `Values must be between ${lo} and ${hi} cm.`));
          body[k] = round1(n);
        }
        if (Object.values(body).every((x) => x == null)) throw new Error(t('მიუთითე მინიმუმ ერთი ზომა.', 'Enter at least one measurement.'));
        await put(`/api/nutrition/measurements/${today}`, body);
        close();
        toast(t('ზომები შენახულია', 'Measurements saved'));
        refresh();
      },
    });
  }

  function openPreferences() {
    const p = { rollover: false, addBurned: false, countSteps: true, ...(S.dash?.preferences || {}) };
    const next = { rollover: p.rollover, addBurned: p.addBurned, countSteps: p.countSteps };
    const rowT = (key, title, sub) => h('div', { class: 'between nu-pref' }, h('div', null, h('div', { class: 'row-title' }, title), h('div', { class: 'row-sub' }, sub)), toggle(next[key], (v) => { next[key] = v; }));
    openModal({
      title: t('დღის ბიუჯეტი', 'Daily budget'),
      size: 'sm',
      body: h('div', { class: 'stack', style: { gap: '16px' } },
        rowT('addBurned', t('დამწვარი კალორიები ბიუჯეტში', 'Add burned calories to budget'), t('ვარჯიშისა და ნაბიჯების ენერგია დღის ბიუჯეტს დაემატება.', 'Energy from workouts and steps is added to your daily budget.')),
        rowT('countSteps', t('ნაბიჯების ჩათვლა', 'Count steps'), t('ნაბიჯებიც დამწვარ ენერგიაში ჩაითვლება.', 'Steps also count toward energy burned.')),
        rowT('rollover', t('გუშინდელის გადატანა', 'Roll over from yesterday'), t('გუშინ გამოუყენებელი კალორიები (მაქს. 200) დღევანდელს დაემატება. დეფიციტი ვალად არ გადადის.', 'Calories you didn’t use yesterday (max 200) are added to today. A deficit never carries over as debt.')),
        h('p', { class: 'disclaimer' }, t('შეხსენებებს, მაკროების განაწილებას და Health-თან კავშირს MEDICARD აპში შეცვლი.', 'Change reminders, your macro split and the Health connection in the MEDICARD app.'))),
      footer: (close) => {
        const save = button(t('შენახვა', 'Save'));
        save.addEventListener('click', () => busy(save, async () => {
          try { await put('/api/nutrition/preferences', next); close(); toast(t('შენახულია', 'Saved')); refresh(); } catch (e) { toast(e.message, 'error'); }
        }));
        return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save];
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
    const saveBtn = button(meal ? t('შენახვა', 'Save') : t('დღიურში შენახვა', 'Save to diary'), { icon: 'check' });
    const titleIn = input({ value: draft.title, maxlength: '120', placeholder: t('მაგ: ქათმის სალათი', 'e.g. Chicken salad'), onInput: (e) => { draft.title = e.target.value; } });

    const typeSeg = segmented(MEAL_TYPES.map((mt) => ({ value: mt, label: MEAL_LABELS[mt] })), draft.type, (v) => { draft.type = v; });
    const tabs = [
      { value: 'search', label: t('ძიება', 'Search') },
      { value: 'saved', label: t('შენახული', 'Saved') },
      ...(aiOn() ? [{ value: 'describe', label: t('აღწერა · AI', 'Describe · AI') }, { value: 'photo', label: t('ფოტო · AI', 'Photo · AI') }] : []),
      { value: 'manual', label: t('ხელით', 'Manual') },
    ];
    const tabSeg = h('div', { class: 'nu-tabs' });
    const paintTabs = () => mount(tabSeg, segmented(tabs, tab, (v) => { tab = v; editIndex = null; paintPanel(); }));

    const m = openModal({
      title: meal ? t('კვების რედაქტირება', 'Edit meal') : t('კვების დამატება', 'Add a meal'),
      size: 'lg',
      body: h('div', { class: 'stack nu-editor', style: { gap: '16px' } },
        h('div', { class: 'nu-editor-head' },
          h('div', { class: 'nu-type' }, typeSeg),
          h('span', { class: 'faint', style: { fontSize: '13px' } }, dayLabel(draft.date))),
        field(t('სახელი (არასავალდებულო)', 'Name (optional)'), titleIn),
        itemsBox,
        totalsBox,
        estimateBox,
        h('div', { class: 'nu-add' }, h('div', { class: 'nu-add-title' }, icon('plus', { size: 16 }), t('საკვების დამატება', 'Add food')), tabSeg, panel),
        aiOn() ? h('p', { class: 'disclaimer' }, icon('sparkles', { size: 14 }), AI_NOTE) : null),
      footer: (close) => {
        saveBtn.addEventListener('click', () => busy(saveBtn, () => saveDraft(close)));
        return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), saveBtn];
      },
      onClose: () => { if (photoUrl) URL.revokeObjectURL(photoUrl); },
    });

    function paintItems() {
      if (!draft.items.length) {
        mount(itemsBox, h('div', { class: 'nu-items-empty' }, icon('utensils', { size: 18 }), t('ჯერ ცარიელია — დაამატე საკვები ქვემოთ.', 'Empty so far — add food below.')));
      } else {
        mount(itemsBox, draft.items.map((it, idx) => {
          const gramsIn = input({ type: 'number', min: '1', max: '10000', step: '1', value: String(it.grams), class: 'input nu-grams', 'aria-label': t(`${it.name} — გრამი`, `${it.name} — grams`) });
          gramsIn.addEventListener('change', () => {
            const n = Number(gramsIn.value);
            if (!Number.isFinite(n) || n <= 0 || n > 10000) { gramsIn.value = String(it.grams); return; }
            draft.items[idx] = scaleItem(it, n);
            paintItems();
          });
          const star = iconButton('star', { title: t('შენახულ საკვებში დამატება', 'Add to saved foods'), size: 16 });
          star.addEventListener('click', () => busy(star, async () => {
            try { await post('/api/nutrition/foods/from-item', { item: cleanItem(it), favorite: true }); star.classList.add('on'); toast(t('შენახულ საკვებში დაემატა', 'Added to saved foods')); } catch (e) { toast(e.message, 'error'); }
          }));
          return h('div', { class: 'nu-item' },
            h('div', { class: 'nu-item-main' },
              h('div', { class: 'nu-item-name' }, it.name),
              h('div', { class: 'nu-item-sub' }, `${kcal(it.calories)} · ${macroLine(it)}`)),
            h('label', { class: 'nu-item-grams' }, gramsIn, h('span', null, G)),
            h('div', { class: 'nu-item-actions' },
              star,
              iconButton('edit', { title: t('რედაქტირება', 'Edit'), size: 16, onClick: () => { editIndex = idx; tab = 'manual'; paintTabs(); paintPanel(); } }),
              iconButton('x', { title: t('ამოღება', 'Remove'), size: 16, onClick: () => { draft.items.splice(idx, 1); if (!draft.items.length) estimate = null; paintAll(); } })));
        }));
      }
      const tot = foodTotals(draft.items);
      mount(totalsBox, draft.items.length
        ? [h('div', null, h('b', null, kcal(tot.calories)), h('span', { class: 'faint' }, ` · ${macroLine(tot)}`)), scoreBadge(healthScore(draft.items))]
        : null);
      totalsBox.hidden = !draft.items.length;
      saveBtn.disabled = !draft.items.length;
    }

    function paintEstimate() {
      if (!estimate || !draft.items.length) { clear(estimateBox); return; }
      const fixIn = input({ placeholder: t('მაგ: ნახევარი პორცია იყო, სოუსის გარეშე', 'e.g. It was half a portion, no sauce'), maxlength: '500' });
      const fixBtn = button(t('შესწორება', 'Correct'), { variant: 'secondary', size: 'sm', icon: 'sparkles' });
      const err = h('div', { class: 'form-error', hidden: true });
      // Declined / closed the AI disclosure: a calm note with „ხელახლა ცდა“, never the red error.
      const declined = aiDeclinedSlot();
      const run = () => busy(fixBtn, async () => {
        err.hidden = true;
        declined.hide();
        const text = fixIn.value.trim();
        if (text.length < 2) { err.textContent = t('დაწერე, რა უნდა შესწორდეს.', 'Write what should be corrected.'); err.hidden = false; return; }
        try {
          const res = await estimateRequest('fix', { correction: text, description: draft.note, previous: draft.items.map(cleanItem) }, photo);
          if (res?.declined) { declined.show(run); return; }
          applyEstimate(res, draft.source, true);
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      });
      fixBtn.addEventListener('click', run);
      fixIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      mount(estimateBox, h('div', { class: 'nu-estimate' },
        h('div', { class: 'hstack' }, icon('sparkles', { size: 16 }), h('b', null, UNCERTAINTY[estimate.uncertainty] || UNCERTAINTY.medium)),
        estimate.explanation ? h('p', null, estimate.explanation) : null,
        h('div', { class: 'nu-fix' }, fixIn, fixBtn),
        declined,
        err));
    }

    function paintAll() { paintItems(); paintEstimate(); }

    function addItems(items, source, title) {
      if (draft.items.length + items.length > 25) { toast(t('ერთ კვებაში მაქსიმუმ 25 საკვებია.', 'A meal can have up to 25 foods.'), 'error'); return false; }
      if (!draft.items.length) draft.source = source;
      draft.items.push(...items.map(cleanItem));
      if (title && !draft.title) { draft.title = title.slice(0, 120); titleIn.value = draft.title; }
      paintAll();
      return true;
    }

    function applyEstimate(result, source, replace) {
      if (!result?.foodDetected || !result.items?.length) {
        throw new Error(source === 'label' ? t('ეტიკეტი მკაფიოდ ვერ წავიკითხე. სცადე უფრო ახლოდან ან შეიყვანე ხელით.', 'I couldn’t read the label clearly. Try a closer photo or enter it by hand.') : source === 'text' ? t('აღწერიდან საკვები ვერ ამოვიცანი. სცადე უფრო კონკრეტულად.', 'I couldn’t recognize food in the description. Try being more specific.') : t('საკვები მკაფიოდ ვერ ამოვიცანი. სცადე სხვა ფოტო ან დაამატე ხელით.', 'I couldn’t clearly recognize the food. Try another photo or add it by hand.'));
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
        toast(meal ? t('ცვლილება შენახულია', 'Changes saved') : t('კვება შენახულია', 'Meal saved'));
        refresh();
      } catch (e) { toast(e.message || t('ვერ შეინახა.', 'Couldn’t save.'), 'error'); }
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
      const quick = [serving ? { g: serving.grams, label: `${serving.label || t('პორცია', 'Portion')} · ${fmtNum(serving.grams)} ${G}` } : null, { g: 100, label: `100 ${G}` }, serving ? { g: serving.grams * 2, label: `2 × ${serving.label || t('პორცია', 'Portion')}` } : { g: 200, label: `200 ${G}` }].filter(Boolean);
      const addB = button(t('დამატება', 'Add'), { size: 'sm', icon: 'plus' });
      addB.addEventListener('click', () => {
        const n = Number(gramsIn.value);
        if (!Number.isFinite(n) || n <= 0 || n > 10000) { toast(t('შეიყვანე გრამი 1–10000.', 'Enter 1–10000 grams.'), 'error'); return; }
        if (food.kind === 'saved' && food.id) usedFoodIds.add(food.id);
        if (addItems([portionFromFood(food, n)], source)) { toast(t(`${food.name} დაემატა`, `${food.name} added`)); back(); }
      });
      mount(panel, h('div', { class: 'nu-portion' },
        h('button', { type: 'button', class: 'back', onClick: back }, icon('chevronLeft', { size: 16 }), t('უკან', 'Back')),
        h('div', { class: 'nu-portion-name' }, h('b', null, food.name), food.brand ? h('span', { class: 'faint' }, ` · ${food.brand}`) : null),
        h('div', { class: 'faint', style: { fontSize: '12.5px' } }, `100 ${G}: ${kcal(food.per100?.calories)} · ${macroLine(food.per100 || {})}${food.quality === 'estimate' ? ` · ${t('მიახლოებითი', 'approximate')}` : ''}`),
        h('div', { class: 'chips' }, quick.map((q) => h('button', { type: 'button', class: 'chip', onClick: () => { gramsIn.value = String(q.g); upd(); } }, q.label))),
        h('div', { class: 'nu-portion-row' }, field(t('რაოდენობა (გ)', 'Amount (g)'), gramsIn), preview),
        h('div', null, addB)));
      gramsIn.focus();
    }

    function foodRow(food, onPick) {
      return h('button', { type: 'button', class: 'nu-food', onClick: onPick },
        h('div', { class: 'nu-food-main' },
          h('div', { class: 'nu-food-name' }, food.name, food.brand ? h('span', { class: 'faint' }, ` · ${food.brand}`) : null),
          h('div', { class: 'nu-food-sub' }, `${kcal(food.per100?.calories)} / 100 ${G}${food.serving?.grams ? ` · ${food.serving.label || t('პორცია', 'Portion')} ${fmtNum(food.serving.grams)} ${G}` : ''}`)),
        food.favorite ? icon('star', { size: 14, className: 'nu-fav' }) : null,
        icon('plus', { size: 18, className: 'nu-food-add' }));
    }

    let lastQuery = '';
    let searchSeq = 0;
    const searchCache = new Map();
    function paintSearch() {
      const q = input({ type: 'search', placeholder: t('მაგ: ხაჭაპური, ბრინჯი, მაწონი…', 'e.g. khachapuri, rice, yogurt…'), value: lastQuery, 'aria-label': t('საკვების ძიება', 'Search foods'), maxlength: '80' });
      const results = h('div', { class: 'nu-results' });
      const runSearch = debounce(async (text) => {
        const seq = ++searchSeq;
        if (text.length < 2) { mount(results, h('p', { class: 'faint nu-hint' }, t('ჩაწერე მინიმუმ 2 ასო. ჯერ შენს შენახულს ვეძებთ, შემდეგ ქართულ კატალოგს და პროდუქტების ბაზას.', 'Type at least 2 letters. We search your saved foods first, then the Georgian catalog and the product database.'))); return; }
        if (!searchCache.has(text)) mount(results, h('p', { class: 'faint nu-hint' }, t('ვეძებ…', 'Searching…')));
        try {
          const res = searchCache.get(text) || await get('/api/nutrition/foods/search', { q: text });
          searchCache.set(text, res);
          if (seq !== searchSeq) return;
          const groups = [
            [t('შენი შენახული', 'Your saved foods'), res.saved || []],
            [t('ქართული კატალოგი', 'Georgian catalog'), res.catalog || []],
            [t('პროდუქტები', 'Products'), res.products || []],
          ].filter(([, list]) => list.length);
          if (!groups.length) { mount(results, h('p', { class: 'faint nu-hint' }, t('ვერაფერი მოიძებნა. სცადე სხვა სიტყვა ან დაამატე ხელით.', 'Nothing found. Try another word or add it by hand.'))); return; }
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
        if (!meals.length && !foods.length) { mount(panel, h('p', { class: 'faint nu-hint' }, t('ჯერ შენახული საკვები არ გაქვს. დამატებულ საკვებს ვარსკვლავით შეინახავ.', 'You don’t have saved foods yet. Save a food you’ve added with the star.'))); return; }
        mount(panel, h('div', { class: 'nu-results' },
          meals.length ? h('div', { class: 'nu-group' }, h('div', { class: 'nu-group-title' }, t('ბოლო კვებები', 'Recent meals')),
            meals.map((rm) => {
              const tot = foodTotals(rm.items || []);
              return h('button', { type: 'button', class: 'nu-food', onClick: () => { if (addItems(rm.items || [], 'saved', rm.title)) toast(t('დაემატა', 'Added')); } },
                h('div', { class: 'nu-food-main' },
                  h('div', { class: 'nu-food-name' }, rm.title || (rm.items || []).map((i) => i.name).join(' · ')),
                  h('div', { class: 'nu-food-sub' }, `${kcal(tot.calories)} · ${MEAL_LABELS[rm.type] || ''} · ${fmtDate(rm.date)}`)),
                icon('plus', { size: 18, className: 'nu-food-add' }));
            })) : null,
          foods.length ? h('div', { class: 'nu-group' }, h('div', { class: 'nu-group-title' }, t('შენახული საკვები', 'Saved foods')),
            foods.map((food) => foodRow({ ...food, kind: 'saved' }, () => portionPicker({ ...food, kind: 'saved' }, paintSaved, 'saved')))) : null));
      } catch (e) { mount(panel, h('div', { class: 'form-error' }, e.message)); }
    }

    function paintDescribe() {
      const ta = textarea({ placeholder: t('მაგ: ორი ხინკალი, ქართული სალათი და ჭიქა ლიმონათი', 'e.g. Two khinkali, a Georgian salad and a glass of lemonade'), maxlength: '500', rows: 3, value: draft.note || '' });
      const go = button(t('შეფასება', 'Estimate'), { icon: 'sparkles', size: 'sm' });
      const err = h('div', { class: 'form-error', hidden: true });
      const declined = aiDeclinedSlot();
      go.addEventListener('click', () => busy(go, async () => {
        err.hidden = true;
        declined.hide();
        const text = ta.value.trim();
        if (text.length < 3) { err.textContent = t('აღწერე რა მიირთვი — მაგ. „ორი ხინკალი და სალათი“.', 'Describe what you ate — e.g. “two khinkali and a salad”.'); err.hidden = false; return; }
        try {
          const res = await estimateRequest('text', { description: text });
          if (res?.declined) { declined.show(() => go.click()); return; }
          applyEstimate(res, 'text', !draft.items.length);
          if (!draft.note) draft.note = text.slice(0, 500);
          toast(t('შეფასება მზადაა — გადაამოწმე და შეინახე', 'Estimate ready — check it and save'));
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      }));
      mount(panel, h('div', { class: 'stack', style: { gap: '10px' } },
        h('p', { class: 'faint nu-hint' }, t('აღწერე სიტყვებით — Medi შეაფასებს პორციას და კალორიებს. რაოდენობა თუ იცი, მიუთითე.', 'Describe it in words — Medi will estimate the portion and calories. Add amounts if you know them.')),
        ta, h('div', { class: 'hstack' }, go), declined, err));
      ta.focus();
    }

    function paintPhoto() {
      const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', hidden: true });
      const note = input({ placeholder: photoMode === 'label' ? t('რამდენი მიირთვი? მაგ: ნახევარი შეკვრა', 'How much did you eat? e.g. half a pack') : t('შენიშვნა (არასავალდებულო): მაგ. ზეთის გარეშე', 'Note (optional): e.g. no oil'), maxlength: '500', value: draft.note || '' });
      const err = h('div', { class: 'form-error', hidden: true });
      const declined = aiDeclinedSlot();
      const go = button(t('შეფასება', 'Estimate'), { icon: 'sparkles', size: 'sm', disabled: !photo });
      const drop = h('div', { class: 'dropzone nu-drop', tabindex: '0', role: 'button', 'aria-label': t('ფოტოს არჩევა', 'Choose a photo') });
      const paintDrop = () => mount(drop, photoUrl
        ? h('div', { class: 'nu-photo' }, h('img', { src: photoUrl, alt: t('არჩეული ფოტო', 'Selected photo') }), h('span', { class: 'faint' }, t('სხვა ფოტოს ასარჩევად დააჭირე', 'Click to choose another photo')))
        : h('div', { class: 'stack', style: { alignItems: 'center', gap: '6px' } }, icon('camera', { size: 26 }), h('b', null, t('აირჩიე ან ჩააგდე ფოტო', 'Choose or drop a photo')), h('span', { class: 'faint', style: { fontSize: '12.5px' } }, t('JPEG, PNG, HEIC · 12 MB-მდე', 'JPEG, PNG, HEIC · up to 12 MB'))));
      const take = (file) => {
        err.hidden = true;
        if (!file) return;
        if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) { err.textContent = t('აირჩიე სურათი.', 'Choose an image.'); err.hidden = false; return; }
        if (file.size > 12 * 1024 * 1024) { err.textContent = t('ფოტო 12 MB-ზე ნაკლები უნდა იყოს.', 'The photo must be under 12 MB.'); err.hidden = false; return; }
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
        declined.hide();
        if (!photo) return;
        try {
          const text = note.value.trim().slice(0, 500);
          const res = await estimateRequest(photoMode, { description: text }, photo);
          if (res?.declined) { declined.show(() => go.click()); return; }
          applyEstimate(res, photoMode === 'label' ? 'label' : 'photo', !draft.items.length);
          if (text && !draft.note) draft.note = text;
          toast(t('შეფასება მზადაა — გადაამოწმე და შეინახე', 'Estimate ready — check it and save'));
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      }));
      paintDrop();
      mount(panel, h('div', { class: 'stack', style: { gap: '10px' } },
        segmented([{ value: 'photo', label: t('კერძი', 'Meal') }, { value: 'label', label: t('კვებითი ეტიკეტი', 'Nutrition label') }], photoMode, (v) => { photoMode = v; note.placeholder = v === 'label' ? t('რამდენი მიირთვი? მაგ: ნახევარი შეკვრა', 'How much did you eat? e.g. half a pack') : t('შენიშვნა (არასავალდებულო): მაგ. ზეთის გარეშე', 'Note (optional): e.g. no oil'); }),
        drop, fileIn, note, h('div', { class: 'hstack' }, go), declined, err,
        h('p', { class: 'faint', style: { fontSize: '12px' } }, t('გადაეცემა მხოლოდ არჩეული ფოტო და შენიშვნა. ფოტო სერვერზე არ ინახება.', 'Only the selected photo and note are sent. The photo isn’t stored on the server.'))));
    }

    function paintManual() {
      const it = editIndex != null ? draft.items[editIndex] : null;
      const f = (name, label, attrs = {}) => field(label, input({ name, type: 'number', min: '0', max: '10000', step: '0.1', inputmode: 'decimal', value: it?.[name] != null ? String(it[name]) : '', ...attrs }));
      const nameIn = input({ name: 'name', maxlength: '120', required: true, value: it?.name || '', placeholder: t('მაგ: შემწვარი კვერცხი', 'e.g. Fried egg') });
      const err = h('div', { class: 'form-error', hidden: true });
      const form = h('form', { class: 'form', onSubmit: (e) => {
        e.preventDefault();
        err.hidden = true;
        const fd = new FormData(form);
        const num = (k) => { const raw = String(fd.get(k) ?? '').replace(',', '.').trim(); return raw === '' ? null : Number(raw); };
        const name = String(fd.get('name') || '').trim();
        const grams = num('grams');
        const vals = { calories: num('calories'), protein: num('protein') ?? 0, carbs: num('carbs') ?? 0, fat: num('fat') ?? 0 };
        if (!name) { err.textContent = t('ჩაწერე საკვების სახელი.', 'Enter the food’s name.'); err.hidden = false; return; }
        if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) { err.textContent = t('რაოდენობა 1–10000 გრამი უნდა იყოს.', 'The amount must be 1–10000 grams.'); err.hidden = false; return; }
        if (!Number.isFinite(vals.calories) || Object.values(vals).some((v) => !Number.isFinite(v) || v < 0 || v > 10000)) { err.textContent = t('შეიყვანე კალორია და მაკროები (0 ან მეტი).', 'Enter calories and macros (0 or more).'); err.hidden = false; return; }
        const item = cleanItem({ ...(it || {}), name, grams, ...vals });
        if (it) { draft.items[editIndex] = item; editIndex = null; paintAll(); paintManual(); toast(t('შესწორდა', 'Updated')); }
        else if (addItems([item], 'manual')) { form.reset(); nameIn.focus(); toast(t(`${name} დაემატა`, `${name} added`)); }
      } },
      field(t('სახელი', 'Name'), nameIn),
      h('div', { class: 'nu-manual-grid' }, f('grams', t('გრამი', 'Grams'), { min: '1', step: '1', required: true }), f('calories', KCAL, { required: true }), f('protein', t('ცილა (გ)', 'Protein (g)')), f('carbs', t('ნახშირწყ. (გ)', 'Carbs (g)')), f('fat', t('ცხიმი (გ)', 'Fat (g)'))),
      err,
      h('div', { class: 'hstack' },
        button(it ? t('შესწორება', 'Update') : t('დამატება', 'Add'), { type: 'submit', size: 'sm', icon: it ? 'check' : 'plus' }),
        it ? button(t('გაუქმება', 'Cancel'), { variant: 'ghost', size: 'sm', onClick: () => { editIndex = null; paintManual(); } }) : null));
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
      const tot = d?.today || { protein: 0, carbs: 0, fat: 0 };
      const text = !cap
        ? (d?.mealCount ? t(`${d.mealCount} ჩანაწერი დღეს`, `${d.mealCount} ${d.mealCount === 1 ? 'entry' : 'entries'} today`) : t('დღეს ჯერ არაფერი ჩაგიწერია', 'Nothing logged yet today'))
        : d.remaining >= 0 ? t(`კიდევ ${kcal(d.remaining)} შეგიძლია დღეს`, `${kcal(d.remaining)} left for today`) : t(`ბიუჯეტზე ${kcal(Math.abs(d.remaining))}-ით მეტი`, `${kcal(Math.abs(d.remaining))} over budget`);
      mount(el,
        h('div', { class: 'nu-home-top' },
          ring({ value: eaten, max: cap || Math.max(eaten, 1), size: 116, stroke: 11, color: cap && eaten > cap ? 'var(--c3)' : 'var(--brand)', label: fmtNum(eaten), labelScale: 0.2, sub: cap ? `/ ${fmtNum(cap)}` : KCAL }),
          h('div', { class: 'stack', style: { gap: '10px', flex: 1, minWidth: '160px' } },
            h('b', { class: 'nu-home-head' }, text),
            meters(Object.entries(MACRO).map(([k, m]) => ({
              name: m.name, value: Number(tot[k]) || 0, max: tg?.[k] || Math.max((Number(tot.protein) || 0) + (Number(tot.carbs) || 0) + (Number(tot.fat) || 0), 1), color: m.color,
              right: tg?.[k] ? `${fmtNum(tot[k], 0)} / ${fmtNum(tg[k])} ${G}` : `${fmtNum(tot[k], 0)} ${G}`,
            }))))),
        h('div', { class: 'between nu-home-foot' },
          h('span', { class: 'faint' }, d?.streak?.current ? t(`სერია ${d.streak.current} დღე`, `${d.streak.current}-day streak`) : (cap ? t(`ბიუჯეტი ${fmtNum(cap)} კკალ`, `Budget ${fmtNum(cap)} kcal`) : t('სამიზნე აპში დგება', 'Set your target in the app'))),
          h('a', { class: 'link', href: '/nutrition', 'data-link': '' }, d?.mealCount ? t('დღიური', 'Diary') : t('კვების ჩაწერა', 'Log a meal'), icon('chevronRight', { size: 16 }))));
    } catch (e) {
      mount(el, errorBox(e, loadCard));
    }
  };
  loadCard().catch(() => {});
  return el;
}
