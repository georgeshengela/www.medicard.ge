// MEDICARD web — MEDIHOROSCOPE (/horoscope): the app module on the web, same API (/api/horoscope) and the same
// look — a night sky with falling stars, the brass astrolabe with the real planets, readings for today /
// tomorrow / week / month / year, the Oracle (AI-consent path), the birth chart, tarot, compatibility,
// numerology, the Chinese sign, dreams and the sky calendar. Mirrors mobile app/horoscope/*.
import { h, mount, clear, card, button, skeleton, errorBox, segmented, input, field, toast } from '../ui.js';
import { get, put, stream, ApiError, invalidate } from '../api.js';
import { t, isEn } from '../i18n.js';
import { withAiConsent, aiDeclinedSlot } from '../aiConsent.js';
import { ASTRO_GLYPHS } from '../astroGlyphs.js';

const CSS = '/app/css/horoscope.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const SIGN = {
  aries: ['ვერძი', 'ვერძში', 'Aries'], taurus: ['კურო', 'კუროში', 'Taurus'], gemini: ['ტყუპები', 'ტყუპებში', 'Gemini'], cancer: ['კირჩხიბი', 'კირჩხიბში', 'Cancer'],
  leo: ['ლომი', 'ლომში', 'Leo'], virgo: ['ქალწული', 'ქალწულში', 'Virgo'], libra: ['სასწორი', 'სასწორში', 'Libra'], scorpio: ['მორიელი', 'მორიელში', 'Scorpio'],
  sagittarius: ['მშვილდოსანი', 'მშვილდოსანში', 'Sagittarius'], capricorn: ['თხის რქა', 'თხის რქაში', 'Capricorn'], aquarius: ['მერწყული', 'მერწყულში', 'Aquarius'], pisces: ['თევზები', 'თევზებში', 'Pisces'],
};
const signName = (s) => (isEn ? SIGN[s][2] : SIGN[s][0]);
const signIn = (s) => (isEn ? `in ${SIGN[s][2]}` : SIGN[s][1]);
const PLANET = { sun: ['მზე', 'Sun'], moon: ['მთვარე', 'Moon'], mercury: ['მერკური', 'Mercury'], venus: ['ვენერა', 'Venus'], mars: ['მარსი', 'Mars'], jupiter: ['იუპიტერი', 'Jupiter'], saturn: ['სატურნი', 'Saturn'], uranus: ['ურანი', 'Uranus'], neptune: ['ნეპტუნი', 'Neptune'], pluto: ['პლუტონი', 'Pluto'], asc: ['ასცენდენტი', 'Ascendant'], mc: ['ზენიტი', 'Midheaven'] };
const planetName = (p) => (PLANET[p] ? t(PLANET[p][0], PLANET[p][1]) : p);
const ASPECT = { conjunction: ['შეერთება', 'conjunction'], sextile: ['სექსტილი', 'sextile'], square: ['კვადრატი', 'square'], trine: ['ტრიგონი', 'trine'], opposition: ['ოპოზიცია', 'opposition'] };
const aspectName = (a) => t(ASPECT[a][0], ASPECT[a][1]);
const PHASE = { new: ['ახალი მთვარე', 'New Moon'], waxing_crescent: ['მზარდი ნამგალი', 'Waxing Crescent'], first_quarter: ['პირველი მეოთხედი', 'First Quarter'], waxing_gibbous: ['მზარდი მთვარე', 'Waxing Gibbous'], full: ['სავსე მთვარე', 'Full Moon'], waning_gibbous: ['კლებადი მთვარე', 'Waning Gibbous'], last_quarter: ['ბოლო მეოთხედი', 'Last Quarter'], waning_crescent: ['კლებადი ნამგალი', 'Waning Crescent'] };
const phaseName = (k) => t(PHASE[k][0], PHASE[k][1]);
const MONTHS = t(['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
const dayMonth = (ymd) => { const [, m, d] = ymd.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const NOTE = () => t('ჰოროსკოპი გასართობი და თვითშემეცნების საშუალებაა — არ არის სამედიცინო, ფინანსური ან ფსიქოლოგიური რჩევა. პლანეტების მდებარეობა ასტრონომიულად ზუსტია.', 'Horoscopes are for fun and reflection — not medical, financial or psychological advice. Planet positions are astronomically exact.');
const SVG = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  for (const k of kids.flat()) if (k) el.appendChild(k);
  return el;
}
function glyphAt(key, x, y, size, fill) {
  const g = ASTRO_GLYPHS[key];
  if (!g) return null;
  const [vx, vy, vw] = g.vb.split(' ').map(Number);
  return svgEl('g', { transform: `translate(${x - size / 2} ${y - size / 2}) scale(${size / vw}) translate(${-vx} ${-vy})` }, svgEl('path', { d: g.d, fill, 'fill-rule': g.evenOdd ? 'evenodd' : 'nonzero' }));
}
function glyph(key, size = 20, color = 'currentColor') {
  const g = ASTRO_GLYPHS[key];
  if (!g) return null;
  return svgEl('svg', { width: size, height: size, viewBox: g.vb, 'aria-hidden': 'true', class: 'hz-glyph' }, svgEl('path', { d: g.d, fill: color, 'fill-rule': g.evenOdd ? 'evenodd' : 'nonzero' }));
}
function moonPath(cx, cy, r, angle) {
  const waxing = angle < 180;
  const k = (1 - Math.cos((angle * Math.PI) / 180)) / 2;
  const rx = Math.max(0.01, r * Math.abs(1 - 2 * k));
  const term = waxing ? (k > 0.5 ? 1 : 0) : (k > 0.5 ? 0 : 1);
  return `M${cx} ${cy - r}A${r} ${r} 0 0 ${waxing ? 1 : 0} ${cx} ${cy + r}A${rx} ${r} 0 0 ${term} ${cx} ${cy - r}Z`;
}
function moonIcon(angle, size = 44) {
  return svgEl('svg', { width: size, height: size, viewBox: '0 0 52 52', 'aria-hidden': 'true' }, svgEl('circle', { cx: 26, cy: 26, r: 24, fill: '#1F2A55' }), svgEl('path', { d: moonPath(26, 26, 24, angle), fill: '#E8EDF7' }));
}

/** The brass astrolabe (same geometry as mobile components/horoscope/SkyWheel.tsx). */
function wheel({ size, mode, bodies, highlight, chart, moonAngle }) {
  const c = size / 2;
  const R = size / 2 - 2;
  const asc = chart?.angles?.asc.lon ?? 0;
  const top = highlight ? SIGNS.indexOf(highlight) * 30 + 15 : 0;
  const rot = (lon) => (mode === 'chart' && chart?.angles ? 180 + (lon - asc) : 90 + (lon - top));
  const pt = (lon, r) => { const a = (rot(lon) * Math.PI) / 180; return [c + r * Math.cos(a), c - r * Math.sin(a)]; };
  const BRASS = '#E9C77E';
  const FAINT = 'rgba(233,199,126,0.28)';
  const HAIR = 'rgba(233,199,126,0.5)';
  const rTick = R * 0.7;
  const rPl = R * 0.565;
  const rIn = mode === 'chart' ? R * 0.4 : R * 0.36;
  const gSize = size * 0.064;
  const svg = svgEl('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'hz-wheel', 'aria-hidden': 'true' });
  svg.append(svgEl('circle', { cx: c, cy: c, r: R, fill: 'none', stroke: HAIR }), svgEl('circle', { cx: c, cy: c, r: rTick, fill: 'none', stroke: HAIR }), svgEl('circle', { cx: c, cy: c, r: rIn, fill: 'none', stroke: FAINT }));
  if (highlight) {
    const i = SIGNS.indexOf(highlight);
    const [x0, y0] = pt(i * 30, R); const [x1, y1] = pt(i * 30 + 30, R); const [x2, y2] = pt(i * 30 + 30, rTick); const [x3, y3] = pt(i * 30, rTick);
    svg.append(svgEl('path', { d: `M${x0} ${y0}A${R} ${R} 0 0 0 ${x1} ${y1}L${x2} ${y2}A${rTick} ${rTick} 0 0 1 ${x3} ${y3}Z`, fill: 'rgba(233,199,126,0.14)' }));
  }
  SIGNS.forEach((s, i) => {
    const [x0, y0] = pt(i * 30, R); const [x1, y1] = pt(i * 30, rTick);
    svg.append(svgEl('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: HAIR }));
    const [gx, gy] = pt(i * 30 + 15, (R + rTick) / 2);
    svg.append(glyphAt(s, gx, gy, size * (s === highlight ? 0.07 : 0.058), s === highlight ? BRASS : 'rgba(233,199,126,0.62)'));
  });
  for (let d = 0; d < 360; d++) {
    const len = d % 10 === 0 ? 0.05 : d % 5 === 0 ? 0.032 : 0.016;
    const [x0, y0] = pt(d, rTick); const [x1, y1] = pt(d, rTick - R * len);
    svg.append(svgEl('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: d % 5 ? FAINT : HAIR, 'stroke-width': d % 10 ? 0.6 : 1 }));
  }
  if (mode === 'chart' && chart?.houses) {
    chart.houses.forEach((hse, i) => {
      const [x0, y0] = pt(hse.lon, rTick - R * 0.05); const [x1, y1] = pt(hse.lon, rIn);
      svg.append(svgEl('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: i % 3 === 0 ? BRASS : FAINT, 'stroke-width': i % 3 === 0 ? 1.4 : 0.8 }));
      const next = chart.houses[(i + 1) % 12].lon;
      const [nx, ny] = pt(hse.lon + ((((next - hse.lon) % 360) + 360) % 360) / 2, rIn + R * 0.06);
      svg.append(svgEl('text', { x: nx, y: ny + size * 0.009, 'font-size': size * 0.026, fill: 'rgba(233,199,126,0.55)', 'text-anchor': 'middle' }, document.createTextNode(ROMAN[i])));
    });
    const lon = Object.fromEntries(bodies.map((b) => [b.key, b.lon]));
    lon.asc = chart.angles.asc.lon; lon.mc = chart.angles.mc.lon;
    for (const a of chart.aspects) {
      if (a.aspect === 'conjunction' || lon[a.a] == null || lon[a.b] == null) continue;
      const [x0, y0] = pt(lon[a.a], rIn); const [x1, y1] = pt(lon[a.b], rIn);
      svg.append(svgEl('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: a.aspect === 'trine' || a.aspect === 'sextile' ? 'rgba(143,179,255,.78)' : 'rgba(240,138,154,.78)', 'stroke-width': a.orb < 2 ? 1.2 : 0.7 }));
    }
  }
  const minGap = (gSize * 1.25) / rPl / (Math.PI / 180);
  const placed = bodies.map((b) => ({ ...b, disp: b.lon })).sort((x, y) => x.lon - y.lon);
  for (let it = 0; it < 80 && placed.length > 1; it++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i]; const q = placed[(i + 1) % placed.length];
      const gap = (((q.disp - p.disp) % 360) + 360) % 360;
      if (gap < minGap) { const push = (minGap - gap) / 2; p.disp -= push; q.disp += push; moved = true; }
    }
    if (!moved) break;
  }
  for (const p of placed) {
    const [tx, ty] = pt(p.lon, rTick); const [tx2, ty2] = pt(p.lon, rTick - R * 0.07);
    svg.append(svgEl('line', { x1: tx, y1: ty, x2: tx2, y2: ty2, stroke: BRASS, 'stroke-width': 1.2 }));
    if (Math.abs(p.disp - p.lon) > 1.5) { const [mx, my] = pt(p.disp, rPl + gSize * 0.62); svg.append(svgEl('line', { x1: tx2, y1: ty2, x2: mx, y2: my, stroke: 'rgba(233,199,126,.45)', 'stroke-width': 0.8 })); }
    const [gx, gy] = pt(p.disp, rPl);
    svg.append(glyphAt(p.key, gx, gy, gSize, '#FBF3E0'));
    if (p.retro) { const [dx, dy] = pt(p.disp, rPl - R * 0.075); svg.append(svgEl('text', { x: dx, y: dy + size * 0.008, 'font-size': size * 0.024, fill: 'rgba(240,138,154,.9)', 'text-anchor': 'middle' }, document.createTextNode('R'))); }
  }
  if (moonAngle != null) {
    const mr = rIn * 0.5;
    svg.append(svgEl('circle', { cx: c, cy: c, r: mr * 1.8, fill: 'rgba(232,237,247,0.06)' }), svgEl('circle', { cx: c, cy: c, r: mr, fill: 'rgba(255,255,255,0.06)' }), svgEl('path', { d: moonPath(c, c, mr, moonAngle), fill: '#E8EDF7' }));
  }
  return svg;
}

/** Fixed sky behind the page: CSS star layers + a shooting star every few seconds (none with reduced motion). */
function sky() {
  const el = h('div', { class: 'hz-sky', 'aria-hidden': 'true' }, h('i', { class: 'hz-stars s1' }), h('i', { class: 'hz-stars s2' }), h('i', { class: 'hz-shoot' }));
  return el;
}

const dots = (n) => h('span', { class: 'hz-dots', 'aria-label': `${n}/5` }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= n ? 'on' : '' })));

function readingView(r) {
  const areas = [['love', t('სიყვარული', 'Love')], ['money', t('საქმე და ფული', 'Work & money')], ['mood', t('განწყობა', 'Mood')]];
  return h('div', { class: 'hz-stack' },
    card({ class: 'hz-card' }, h('p', { class: 'hz-body' }, r.general)),
    card({ class: 'hz-card hz-areas' }, areas.map(([k, label]) => h('div', { class: 'hz-area' },
      h('div', { class: 'hz-area-head' }, h('b', null, label), r.scores ? dots(r.scores[k]) : null), h('p', null, r[k])))),
    r.keyDates?.length ? card({ class: 'hz-card' }, h('b', { class: 'hz-kicker' }, t('მთავარი დღეები', 'Key dates')), r.keyDates.map((d) => h('p', { class: 'hz-line' }, h('b', null, dayMonth(d.date)), ' — ', d.text))) : null,
    r.highlights?.length ? card({ class: 'hz-card' }, h('b', { class: 'hz-kicker' }, t('წლის მთავარი თვეები', 'Key months')), r.highlights.map((d) => h('p', { class: 'hz-line' }, h('b', null, MONTHS[Number(d.month.slice(5)) - 1]), ' — ', d.text))) : null,
    card({ class: 'hz-card hz-tip' }, h('b', { class: 'hz-kicker' }, t('რჩევა', 'Tip')), h('p', { class: 'hz-serif' }, r.tip)));
}

const TABS = () => [
  ['', t('დღეს', 'Today')], ['oracle', t('ორაკული', 'Oracle')], ['chart', t('ჩემი რუკა', 'My chart')], ['tarot', t('ტარო', 'Tarot')],
  ['compat', t('თავსებადობა', 'Compatibility')], ['more', t('მეტი', 'More')],
];

export default async function horoscopePage(root, ctx) {
  ensureCss();
  const sectionKey = ctx?.params?.section || '';
  const body = h('div', { class: 'hz-main' }, skeleton(6));
  mount(root, h('div', { class: 'hz-page' }, sky(),
    h('header', { class: 'hz-head' },
      h('h1', null, h('span', { class: 'wm wm-horo', role: 'img', 'aria-label': 'MEDIHOROSCOPE' }, h('span', { class: 'wm-medi', 'aria-hidden': 'true' }, 'MEDI'), h('span', { class: 'wm-suffix', 'aria-hidden': 'true' }, 'HOROSCOPE'))),
      h('nav', { class: 'hz-tabs', 'aria-label': 'MEDIHOROSCOPE' }, TABS().map(([k, label]) => h('a', { href: k ? `/horoscope/${k}` : '/horoscope', 'data-link': '', class: k === sectionKey ? 'on' : '' }, label)))),
    body));
  const pages = { '': hub, oracle, chart, tarot, compat, more };
  await (pages[sectionKey] || hub)(body, ctx);
}

async function hub(slot) {
  let viewing = null;
  let period = 'today';
  const render = async () => {
    let d;
    try { d = await get('/api/horoscope', viewing ? { sign: viewing } : undefined); } catch (e) { mount(slot, card(errorBox(e, render))); return; }
    const shown = viewing || d.sign?.key;
    const today = d.readings?.today;
    const reading = d.readings?.[period];
    const size = Math.min(380, slot.clientWidth || 380);
    mount(slot,
      h('div', { class: 'hz-hero' },
        wheel({ size, mode: 'sky', bodies: d.sky.bodies, highlight: shown, moonAngle: d.sky.moon.angle }),
        h('p', { class: 'hz-meta' }, `${phaseName(d.sky.moon.key)} ${Math.round(d.sky.moon.illumination * 100)}% · ${t('მთვარე', 'Moon')} ${signIn(d.sky.moon.sign)}`),
        shown ? h('p', { class: 'hz-signline' }, glyph(shown, 20, '#E9C77E'), h('b', null, signName(shown))) : null,
        today ? h('h2', { class: 'hz-headline' }, today.headline) : null,
        today?.scores ? h('div', { class: 'hz-scores' }, [['love', t('სიყვარული', 'Love')], ['money', t('საქმე', 'Work')], ['mood', t('განწყობა', 'Mood')]].map(([k, l]) => h('div', null, h('span', null, l), dots(today.scores[k])))) : null),
      h('div', { class: 'hz-signs' }, SIGNS.map((s) => h('button', { type: 'button', class: s === shown ? 'on' : '', 'aria-pressed': String(s === shown), onClick: () => { viewing = s === d.sign?.key ? null : s; render(); } }, glyph(s, 18, s === shown ? '#E9C77E' : '#C9CDE4'), h('span', null, signName(s))))),
      d.needBirthDate ? card({ class: 'hz-card' }, h('p', null, t('შენი ნიშანი დაბადების თარიღიდან ითვლება — დაამატე პროფილში.', 'Your sign comes from your birth date — add it in your profile.')), button(t('პროფილი', 'Profile'), { href: '/profile' })) : null,
      segmented([['today', t('დღეს', 'Today')], ['tomorrow', t('ხვალ', 'Tomorrow')], ['week', t('კვირა', 'Week')], ['month', t('თვე', 'Month')], ['year', d.today.slice(0, 4)]].map(([value, label]) => ({ value, label })), period, (v) => { period = v; render(); }),
      reading ? h('div', { class: 'hz-stack' }, period !== 'today' ? h('h3', { class: 'hz-sub' }, reading.headline) : null, readingView(reading))
        : card({ class: 'hz-card' }, h('p', { class: 'muted' }, t('ვარსკვლავები ამ ჰოროსკოპს ჯერ წერენ — ცოტა ხანში დაბრუნდი.', 'The stars are still writing this one — check back soon.'))),
      d.oracle?.enabled ? card({ class: 'hz-card hz-oracle-card' },
        h('img', { src: '/app/img/oracle.png', alt: '', class: 'hz-oracle-img' }),
        h('div', null, h('b', { class: 'hz-kicker violet' }, d.oracle.name), h('h3', { class: 'hz-sub' }, t('ჰკითხე ვარსკვლავებს', 'Ask the stars')),
          h('p', { class: 'muted' }, t('რუკას, ტაროს და სიზმრებს ერთად წავიკითხავთ.', 'We’ll read your chart, tarot and dreams together.')),
          button(t('საუბრის დაწყება', 'Start a conversation'), { href: '/horoscope/oracle' }))) : null,
      d.personal?.transits?.length ? h('section', { class: 'hz-sec' }, h('h2', null, t('შენი დღე შენს რუკაზე', 'Your day on your chart')),
        card({ class: 'hz-card' }, d.personal.transits.slice(0, 3).map((x) => h('div', { class: 'hz-row' }, h('span', { class: 'hz-tile' }, glyph(x.transit, 20, '#E9C77E')),
          h('div', null, h('b', null, x.title || `${planetName(x.transit)} · ${aspectName(x.aspect)} · ${t('შენი', 'your')} ${planetName(x.natal)}`), x.text ? h('p', { class: 'muted' }, x.text) : null))))) : null,
      h('section', { class: 'hz-sec' }, h('h2', null, t('ცა ახლა', 'The sky now')),
        card({ class: 'hz-card' },
          h('div', { class: 'hz-row' }, moonIcon(d.sky.moon.angle), h('div', null, h('b', null, phaseName(d.sky.moon.key)), h('p', { class: 'muted' }, `${t('მთვარე', 'Moon')} ${signIn(d.sky.moon.sign)} · ${t(`მთვარის მე-${d.sky.moon.lunarDay} დღე`, `lunar day ${d.sky.moon.lunarDay}`)}`))),
          d.sky.moon.text ? h('p', { class: 'muted' }, d.sky.moon.text) : null,
          d.sky.retrograde.length ? h('div', { class: 'hz-chips' }, d.sky.retrograde.map((p) => h('span', { class: 'hz-chip' }, glyph(p, 13, '#E9C77E'), `${planetName(p)} · ${t('რეტრო', 'retro')}`))) : null)),
      h('p', { class: 'hz-note' }, NOTE()));
  };
  await render();
}

async function oracle(slot) {
  let sessionId;
  let busy = false;
  let thread = { name: t('ორაკული', 'Oracle'), messages: [] };
  try { thread = await get('/api/horoscope/oracle'); sessionId = thread.sessionId || undefined; } catch { /* starts empty */ }
  const list = h('div', { class: 'hz-chat' });
  const declined = aiDeclinedSlot();
  const ta = h('textarea', { class: 'input hz-input', rows: 2, placeholder: t('ჰკითხე ვარსკვლავებს…', 'Ask the stars…'), maxlength: 2000 });
  const sendBtn = button(t('გაგზავნა', 'Send'), { icon: 'send' });
  const turn = (role, text, cards) => {
    const el = h('div', { class: `hz-turn ${role}` });
    if (cards?.length) el.append(h('div', { class: 'hz-cards' }, cards.map((c) => tarotCard({ roman: c.roman, name: isEn ? c.en : c.ka, glyph: c.glyph }))));
    el._text = h('p', null, text || '');
    el.append(el._text);
    list.append(el);
    el.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return el;
  };
  for (const m of thread.messages || []) if (m.content) turn(m.role, m.content, m.cards);
  if (!(thread.messages || []).length) {
    list.append(h('div', { class: 'hz-welcome' }, h('img', { src: '/app/img/oracle.png', alt: '', class: 'hz-oracle-big' }), h('h2', { class: 'hz-headline' }, t('ვარსკვლავები გისმენენ', 'The stars are listening')),
      h('p', { class: 'muted' }, t(`მე ვარ ${thread.name}. შენს რუკას, დღევანდელ ცას, ტაროს და სიზმრებს ერთად წავიკითხავთ.`, `I am the ${thread.name}. Together we’ll read your chart, today’s sky, the tarot and your dreams.`)),
      h('div', { class: 'hz-asks' }, [t('რა მელის დღეს?', 'What does today hold for me?'), t('ამომიღე ტაროს კარტი', 'Draw me a tarot card'), t('ამიხსენი ჩემი რუკა მარტივად', 'Explain my chart simply')].map((q) => h('button', { type: 'button', onClick: () => { ta.value = q; send(); } }, q)))));
  }
  async function send() {
    const message = ta.value.trim();
    if (message.length < 2 || busy) return;
    busy = true; sendBtn.disabled = true; declined.hide();
    list.querySelector('.hz-welcome')?.remove();
    turn('user', message);
    ta.value = '';
    const answer = turn('assistant', t('ვარსკვლავებს ვეკითხები…', 'Asking the stars…'));
    let text = '';
    try {
      const result = await withAiConsent(async () => {
        let final = null; let failed = null;
        await stream('/api/horoscope/oracle/query', { message, sessionId, clientRequestId: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, stream: true }, (type, data) => {
          const ev = typeof data === 'object' && data ? data : {};
          if (ev.type === 'start') { sessionId = ev.sessionId; if (ev.cards?.length) answer.prepend(h('div', { class: 'hz-cards' }, ev.cards.map((c) => tarotCard({ roman: c.roman, name: isEn ? c.en : c.ka, glyph: c.glyph })))); }
          else if (ev.type === 'delta') { text += ev.text; answer._text.textContent = text.replace(/\*\*(.+?)\*\*/g, '$1'); }
          else if (ev.type === 'done') final = ev;
          else if (ev.type === 'error') failed = ev;
        });
        if (failed) throw new ApiError(failed.error, failed.status || 502, failed);
        return final;
      });
      if (result?.declined) { answer.remove(); declined.show(() => { ta.value = message; send(); }); return; }
      if (result?.answer?.content) answer._text.textContent = result.answer.content.replace(/\*\*(.+?)\*\*/g, '$1');
    } catch (e) {
      answer._text.textContent = e?.message || t('ორაკულმა ვერ გიპასუხა — სცადე თავიდან.', 'The Oracle could not answer — try again.');
    } finally { busy = false; sendBtn.disabled = false; }
  }
  sendBtn.addEventListener('click', send);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  mount(slot, h('div', { class: 'hz-stack' }, list, declined, h('div', { class: 'hz-composer' }, ta, sendBtn),
    h('p', { class: 'hz-note' }, t('ორაკული გასართობია და ჯანმრთელობაზე რჩევას არ იძლევა — ამისთვის Medi გყავს.', 'The Oracle is for fun and gives no health advice — Medi is there for that.'))));
}

function tarotCard(c, { flip = true } = {}) {
  const face = h('div', { class: 'hz-tcard-face' }, h('span', { class: 'hz-roman' }, c.roman), h('span', { class: 'hz-medal' }, glyph(c.glyph, 44, '#FBF3E0')), h('span', { class: 'hz-tname' }, c.name));
  const back = h('div', { class: 'hz-tcard-back' }, glyph('moon', 34, '#E9C77E'));
  const el = h('div', { class: 'hz-tcard', role: 'img', 'aria-label': `${c.roman} ${c.name}` }, h('div', { class: 'hz-tcard-in' }, back, face));
  if (flip) setTimeout(() => el.classList.add('open'), 450); else el.classList.add('open');
  return el;
}

async function chart(slot) {
  let d;
  try { d = await get('/api/horoscope/chart'); } catch (e) { mount(slot, card(errorBox(e, () => chart(slot)))); return; }
  if (d.needBirthDate || !d.chart) { mount(slot, card({ class: 'hz-card' }, h('p', null, t('რუკა დაბადების თარიღიდან ითვლება — დაამატე პროფილში.', 'The chart is cast from your birth date — add it in your profile.')), button(t('პროფილი', 'Profile'), { href: '/profile' }))); return; }
  const ch = d.chart;
  const size = Math.min(420, slot.clientWidth || 420);
  const time = input({ value: d.profile.birthTime || '', placeholder: '14:30', inputmode: 'numeric', maxlength: 5 });
  const q = input({ placeholder: t('ქალაქი ან სოფელი', 'City or town'), value: d.profile.placeName || '' });
  const results = h('div', { class: 'hz-places' });
  let place = null;
  q.addEventListener('input', async () => {
    const v = q.value.trim();
    if (v.length < 2) { clear(results); return; }
    try {
      const r = await get('/api/horoscope/places', { q: v });
      mount(results, r.places.map((p) => h('button', { type: 'button', onClick: () => { place = p; q.value = `${p.name}, ${p.detail}`; clear(results); } }, h('b', null, p.name), h('span', null, p.detail))));
    } catch { clear(results); }
  });
  const save = button(t('შენახვა', 'Save'), { icon: 'check' });
  save.addEventListener('click', async () => {
    const tm = time.value.trim();
    if (tm && !/^([01]\d|2[0-3]):[0-5]\d$/.test(tm)) { toast(t('დრო ჩაწერე ასე: 14:30', 'Write the time like 14:30'), 'bad'); return; }
    try {
      await put('/api/horoscope/profile', { birthTime: tm || null, ...(place ? { place: { name: place.name, detail: place.detail, lat: place.lat, lon: place.lon, tz: place.tz } } : {}) });
      invalidate('/api/horoscope');
      toast(t('შენახულია', 'Saved'));
      chart(slot);
    } catch (e) { toast(e?.message || t('ვერ შეინახა', 'Could not save'), 'bad'); }
  });
  mount(slot,
    h('div', { class: 'hz-hero' }, wheel({ size, mode: ch.angles ? 'chart' : 'sky', bodies: ch.bodies, highlight: ch.angles ? null : ch.bodies[0].sign, chart: ch.angles ? ch : null }),
      h('p', { class: 'hz-meta' }, [dayMonth(ch.birth.date) + ` ${ch.birth.date.slice(0, 4)}`, ch.birth.time, ch.birth.placeName].filter(Boolean).join(' · '))),
    h('div', { class: 'hz-big3' }, [[t('მზე', 'Sun'), ch.bodies[0]], [t('მთვარე', 'Moon'), ch.bodies[1]], ...(ch.angles ? [[t('ასცენდენტი', 'Ascendant'), ch.angles.asc]] : [])].map(([label, b]) =>
      h('div', { class: 'hz-card' }, h('span', { class: 'muted' }, label), h('b', null, glyph(b.sign, 16, '#E9C77E'), ' ', signName(b.sign)), h('span', { class: 'muted' }, `${b.degree}°${String(b.minute).padStart(2, '0')}′`)))),
    card({ class: 'hz-card' }, h('b', { class: 'hz-kicker' }, t('დაბადების დრო და ადგილი', 'Birth time and place')),
      h('div', { class: 'hz-form' }, field(t('დრო', 'Time'), time), field(t('ადგილი', 'Place'), q), results, save)),
    h('section', { class: 'hz-sec' }, h('h2', null, t('პლანეტები', 'Planets')),
      card({ class: 'hz-card' }, ch.bodies.map((b) => h('details', { class: 'hz-detail' },
        h('summary', null, h('span', { class: 'hz-tile' }, glyph(b.key, 18, '#E9C77E')), h('b', null, `${planetName(b.key)} ${signIn(b.sign)}`), h('span', { class: 'muted' }, `${b.house ? `${ROMAN[b.house - 1]} · ` : ''}${b.degree}°${b.retro ? ' ℞' : ''}`)),
        [b.planetText, b.signText, b.houseText, b.retroText].filter(Boolean).map((x) => h('p', { class: 'muted' }, x)))))),
    ch.aspects.length ? h('section', { class: 'hz-sec' }, h('h2', null, t('ასპექტები', 'Aspects')),
      card({ class: 'hz-card' }, ch.aspects.map((a) => h('details', { class: 'hz-detail' }, h('summary', null, h('b', null, `${planetName(a.a)} · ${aspectName(a.aspect)} · ${planetName(a.b)}`), h('span', { class: 'muted' }, `${a.orb.toFixed(1)}°`)), a.text ? h('p', { class: 'muted' }, a.text) : null)))) : null,
    h('p', { class: 'hz-note' }, t('რუკა ასტრონომიულად ზუსტადაა გამოთვლილი; განმარტებები გასართობი და თვითშემეცნებისთვისაა.', 'The chart is astronomically exact; the meanings are for fun and reflection.')));
}

async function tarot(slot) {
  let d;
  try { d = await get('/api/horoscope/tarot'); } catch (e) { mount(slot, card(errorBox(e, () => tarot(slot)))); return; }
  const spreadSlot = h('div');
  const showSpread = () => mount(spreadSlot, h('div', { class: 'hz-cards' }, d.spread.map((c) => tarotCard(c))),
    d.spread.map((c, i) => card({ class: 'hz-card' }, h('b', { class: 'hz-kicker' }, `${[t('წარსული', 'Past'), t('აწმყო', 'Present'), t('მომავალი', 'Future')][i]} · ${c.roman} ${c.name}`), h('p', { class: 'muted' }, c.text || ''))));
  mount(slot, h('div', { class: 'hz-stack hz-center' },
    h('p', { class: 'muted' }, t('დღის კარტი — ერთი მთელი დღისთვის', 'Card of the day — one for the whole day')),
    tarotCard(d.card),
    h('h2', { class: 'hz-headline' }, d.card.name),
    d.card.keywords?.length ? h('p', { class: 'hz-meta' }, d.card.keywords.join(' · ')) : null,
    card({ class: 'hz-card' }, h('p', { class: 'hz-body' }, d.card.text || t('კარტის განმარტება მალე დაემატება.', 'The meaning will be added soon.'))),
    d.card.advice ? card({ class: 'hz-card hz-tip' }, h('b', { class: 'hz-kicker' }, t('რჩევა', 'Advice')), h('p', { class: 'hz-serif' }, d.card.advice)) : null,
    h('h2', null, t('სამი კარტი', 'Three cards')),
    spreadSlot,
    button(t('კარტების გაშლა', 'Lay out the cards'), { onClick: (e) => { e.currentTarget.remove(); showSpread(); } })));
}

async function compat(slot) {
  let a = null;
  let b = 'libra';
  try { const hub = await get('/api/horoscope'); a = hub.sign?.key || 'aries'; } catch { a = 'aries'; }
  const out = h('div');
  const pick = (which) => h('div', { class: 'hz-signs' }, SIGNS.map((s) => h('button', { type: 'button', class: (which === 'a' ? a : b) === s ? 'on' : '', onClick: () => { if (which === 'a') a = s; else b = s; draw(); } }, glyph(s, 18, '#E9C77E'), h('span', null, signName(s)))));
  async function draw() {
    let d;
    try { d = await get('/api/horoscope/compat', { a, b }); } catch (e) { mount(out, card(errorBox(e, draw))); return; }
    mount(slot, h('div', { class: 'hz-stack' },
      card({ class: 'hz-card hz-compat' }, h('div', null, glyph(a, 40, '#E9C77E'), h('b', null, signName(a))), h('div', { class: 'hz-score' }, h('strong', null, String(d.score))), h('div', null, glyph(b, 40, '#E9C77E'), h('b', null, signName(b)))),
      h('p', { class: 'muted' }, t('პირველი ნიშანი', 'First sign')), pick('a'), h('p', { class: 'muted' }, t('მეორე ნიშანი', 'Second sign')), pick('b'),
      d.headline ? h('h2', { class: 'hz-headline' }, d.headline) : null,
      card({ class: 'hz-card' }, h('p', { class: 'hz-body' }, d.text || t('ამ წყვილის აღწერა ჯერ იწერება.', 'This pair is still being written.'))),
      d.loveText ? card({ class: 'hz-card hz-areas' }, [['love', t('სიყვარული', 'Love'), d.loveText], ['friendship', t('მეგობრობა', 'Friendship'), d.friendText], ['work', t('საქმე', 'Work'), d.workText]].map(([k, l, txt]) => h('div', { class: 'hz-area' }, h('div', { class: 'hz-area-head' }, h('b', null, l), typeof d[k] === 'number' ? dots(d[k]) : null), h('p', null, txt || '')))) : null));
  }
  await draw();
}

async function more(slot) {
  const [num, cn, skyPage, dreams] = await Promise.all([
    get('/api/horoscope/numerology').catch(() => null), get('/api/horoscope/chinese').catch(() => null),
    get('/api/horoscope/sky').catch(() => null), get('/api/horoscope/dreams').catch(() => null),
  ]);
  const dreamOut = h('div');
  const dq = input({ placeholder: t('რა ნახე სიზმარში? მაგ. წყალი', 'What did you dream of? e.g. water') });
  dq.addEventListener('input', async () => {
    const v = dq.value.trim();
    if (v.length < 2) { clear(dreamOut); return; }
    try { const r = await get('/api/horoscope/dreams', { q: v }); mount(dreamOut, (r.results || []).map((x) => card({ class: 'hz-card' }, h('b', null, x.word), h('p', { class: 'muted' }, x.text || '')))); } catch { clear(dreamOut); }
  });
  const cal = skyPage?.calendar;
  mount(slot, h('div', { class: 'hz-stack' },
    num && !num.needBirthDate ? h('section', { class: 'hz-sec' }, h('h2', null, t('ნუმეროლოგია', 'Numerology')),
      card({ class: 'hz-card hz-num' }, h('div', null, h('span', { class: 'muted' }, t('ცხოვრების გზა', 'Life path')), h('strong', null, String(num.lifePath)), h('b', null, num.lifePathText?.title || '')),
        h('div', null, h('span', { class: 'muted' }, t('წლის რიცხვი', 'Year')), h('strong', null, String(num.personalYear))), h('div', null, h('span', { class: 'muted' }, t('დღის რიცხვი', 'Day')), h('strong', null, String(num.personalDay)))),
      num.lifePathText?.text ? card({ class: 'hz-card' }, h('p', { class: 'hz-body' }, num.lifePathText.text)) : null) : null,
    cn && !cn.needBirthDate ? h('section', { class: 'hz-sec' }, h('h2', null, t('ჩინური ჰოროსკოპი', 'Chinese horoscope')),
      card({ class: 'hz-card' }, h('h3', { class: 'hz-sub' }, `${cn.year} · ${cn.animal}`), cn.profile?.text ? h('p', { class: 'hz-body' }, cn.profile.text) : null, cn.yearForecast?.text ? h('p', { class: 'muted' }, cn.yearForecast.text) : null)) : null,
    cal ? h('section', { class: 'hz-sec' }, h('h2', null, `${t('მთვარის კალენდარი', 'Moon calendar')} · ${MONTHS[Number(cal.month.slice(5)) - 1]}`),
      card({ class: 'hz-card hz-cal' }, cal.days.map((day) => h('div', { class: day.date === skyPage.today ? 'on' : '', title: `${dayMonth(day.date)} · ${phaseName(day.key)}` }, moonIcon(day.angle, 22), h('span', null, String(Number(day.date.slice(8))))))) ) : null,
    dreams ? h('section', { class: 'hz-sec' }, h('h2', null, t('სიზმრების ახსნა', 'Dream meanings')), dq, dreamOut) : null,
    h('p', { class: 'hz-note' }, NOTE())));
}


