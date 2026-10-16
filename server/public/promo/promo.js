/**
 * MEDICARD პრომო — influencer portal (medicard.ge/promo). Vanilla ES module; API /api/promo with an httpOnly
 * session cookie. Views: landing, sign-up, sign-in, password reset, dashboard. Every string in Georgian + English.
 * DOM is built with textContent only (no HTML from data).
 */

/* ───────────── language ───────────── */
const LANG_KEY = 'medicard.lang';
const params = new URLSearchParams(location.search);
let lang = 'ka';
try {
  if (params.get('lang') === 'en' || params.get('lang') === 'ka') localStorage.setItem(LANG_KEY, params.get('lang'));
  lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ka';
} catch {
  lang = params.get('lang') === 'en' ? 'en' : 'ka';
}
document.documentElement.lang = lang;
const t = (ka, en) => (lang === 'en' ? en : ka);
const locale = () => (lang === 'en' ? 'en-US' : 'ka-GE');

/* ───────────── tiny DOM kit ───────────── */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const SVG_NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid) el.append(kid);
  return el;
}
const app = document.getElementById('app');
const nav = document.getElementById('bar-nav');
const foot = document.getElementById('foot');

function mount(...nodes) {
  app.replaceChildren(...nodes);
  app.focus({ preventScroll: true });
}

let toastTimer = null;
function toast(text, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

const gel = (tetri) => `${(Math.round(Number(tetri) || 0) / 100).toFixed(2)} ₾`;
const num = (n) => { const v = Math.round(Number(n || 0)).toLocaleString('en-US'); return lang === 'en' ? v : v.replace(/,/g, ' '); };
const MONTHS_KA = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
function day(iso, withYear = false) {
  if (!iso) return '—';
  if (lang !== 'en') {
    const d = new Date(new Date(iso).getTime() + 4 * 3600000);
    return `${d.getUTCDate()} ${MONTHS_KA[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ''}`;
  }
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'Asia/Tbilisi' }).format(new Date(iso));
}

/* ───────────── API ───────────── */
class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.field = body?.field;
    this.code = body?.code;
  }
}
async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'X-Medicard-Lang': lang };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api/promo${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(t('კავშირი ვერ დამყარდა. შეამოწმე ინტერნეტი და სცადე ხელახლა.', 'Could not connect. Check your internet and try again.'), 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || t('რაღაც ვერ გამოვიდა. სცადე ხელახლა.', 'Something went wrong. Try again.'), res.status, data);
  return data;
}

/* ───────────── state + routing ───────────── */
const state = { program: null, me: null };
const ROUTES = ['', 'signup', 'signin', 'forgot', 'dashboard'];
function route() {
  const r = location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(r) ? r : '';
}
function go(r) {
  if (route() === r) render();
  else location.hash = r ? `#${r}` : '#';
}
window.addEventListener('hashchange', () => render());
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-go]');
  if (!a) return;
  e.preventDefault();
  go(a.getAttribute('data-go'));
});

/* ───────────── the bulb sign ───────────── */
// 5×7 lamp font for the code alphabet (A–Z, 2–9).
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'], H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'], J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], N: ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], 3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};
let signSeq = 0;
function bulbSign(code, { caption, sweep = true } = {}) {
  const chars = String(code || '------').toUpperCase().slice(0, 6).padEnd(6, ' ').split('');
  const pitch = 10;
  const cols = chars.length * 5 + (chars.length - 1) + 2;
  const rows = 9;
  const id = `bulb-glow-${(signSeq += 1)}`;
  const off = s('g');
  const on = s('g', { filter: `url(#${id})` });
  chars.forEach((ch, ci) => {
    const glyph = FONT[ch];
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        const col = 1 + ci * 6 + c;
        const cx = col * pitch + pitch / 2;
        const cy = (r + 1) * pitch + pitch / 2;
        const lit = glyph && glyph[r][c] === '1';
        off.append(s('circle', { cx, cy, r: 3.1, class: 'bulb-off' }));
        if (lit) on.append(s('circle', { cx, cy, r: 3.4, class: 'bulb-on', style: `--d:${(col * 0.028).toFixed(3)}s` }));
      }
    }
  });
  const defs = s('defs', null, s('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' },
    s('feGaussianBlur', { stdDeviation: '2.2', result: 'b' }),
    s('feMerge', null, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))));
  const svg = s('svg', { viewBox: `0 0 ${cols * pitch} ${rows * pitch}`, role: 'img', 'aria-label': t(`კოდი: ${chars.join(' ')}`, `Code: ${chars.join(' ')}`) }, defs, off, on);
  return h('div', { class: `sign${sweep ? ' is-sweeping' : ''}` }, svg, caption || null);
}

/* ───────────── status badges ───────────── */
function badge(key, cls = 'badge') {
  const k = String(key || 'SPARK');
  const gid = `g-${k}-${(signSeq += 1)}`;
  if (k === 'SPARK') {
    return s('svg', { viewBox: '0 0 64 64', class: cls, 'aria-hidden': 'true' },
      s('defs', null, s('radialGradient', { id: gid }, s('stop', { offset: '0', 'stop-color': '#fff3d6' }), s('stop', { offset: '0.45', 'stop-color': '#ffb648' }), s('stop', { offset: '1', 'stop-color': '#ffb648', 'stop-opacity': '0' }))),
      s('circle', { cx: 32, cy: 32, r: 30, fill: `url(#${gid})`, opacity: '0.55' }),
      s('path', { d: 'M32 14 C36 24 42 27 42 36 a10 10 0 0 1 -20 0 C22 29 28 26 32 14 Z', fill: '#ffb648' }),
      s('path', { d: 'M32 27 C34 32 37 34 37 38 a5 5 0 0 1 -10 0 C27 34 30 32 32 27 Z', fill: '#fff3d6' }));
  }
  if (k === 'STAR') {
    return s('svg', { viewBox: '0 0 64 64', class: cls, 'aria-hidden': 'true' },
      s('defs', null, s('radialGradient', { id: gid }, s('stop', { offset: '0', 'stop-color': '#ffffff' }), s('stop', { offset: '0.5', 'stop-color': '#b9d2ff' }), s('stop', { offset: '1', 'stop-color': '#b9d2ff', 'stop-opacity': '0' }))),
      s('circle', { cx: 32, cy: 32, r: 30, fill: `url(#${gid})`, opacity: '0.45' }),
      s('path', { d: 'M32 6 L37 27 L58 32 L37 37 L32 58 L27 37 L6 32 L27 27 Z', fill: '#dfe9ff' }),
      s('circle', { cx: 32, cy: 32, r: 4, fill: '#ffffff' }));
  }
  const rays = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (i * Math.PI) / 6;
    const long = i % 2 === 0;
    rays.push(s('line', { x1: 32 + Math.cos(a) * 12, y1: 32 + Math.sin(a) * 12, x2: 32 + Math.cos(a) * (long ? 29 : 22), y2: 32 + Math.sin(a) * (long ? 29 : 22), stroke: long ? '#ff6fae' : '#ffd27a', 'stroke-width': long ? 3 : 2, 'stroke-linecap': 'round' }));
  }
  return s('svg', { viewBox: '0 0 64 64', class: cls, 'aria-hidden': 'true' },
    s('defs', null, s('radialGradient', { id: gid }, s('stop', { offset: '0', 'stop-color': '#fff3d6' }), s('stop', { offset: '0.5', 'stop-color': '#ff6fae' }), s('stop', { offset: '1', 'stop-color': '#ff6fae', 'stop-opacity': '0' }))),
    s('circle', { cx: 32, cy: 32, r: 30, fill: `url(#${gid})`, opacity: '0.5' }), ...rays,
    s('circle', { cx: 32, cy: 32, r: 9, fill: '#ffd27a' }), s('circle', { cx: 32, cy: 32, r: 4.5, fill: '#fff8ea' }));
}
const tierName = (tier) => (tier ? t(tier.ka, tier.en) : '');
function tierChip(tier) {
  return h('span', { class: `tier-chip ${tier?.key || 'SPARK'}` }, badge(tier?.key), tierName(tier));
}

/* ───────────── shared pieces ───────────── */
function langSwitch() {
  const set = (value) => {
    try { localStorage.setItem(LANG_KEY, value); } catch { /* private mode */ }
    location.reload();
  };
  return h('div', { class: 'lang', role: 'group', 'aria-label': t('ენა', 'Language') },
    h('button', { type: 'button', 'aria-pressed': String(lang === 'ka'), onclick: () => set('ka') }, 'ქა'),
    h('button', { type: 'button', 'aria-pressed': String(lang === 'en'), onclick: () => set('en') }, 'EN'));
}

function paintNav() {
  const signedIn = Boolean(state.me);
  nav.replaceChildren(
    langSwitch(),
    signedIn
      ? h('button', { class: 'btn small', type: 'button', onclick: signOut }, t('გასვლა', 'Sign out'))
      : h('span', { style: { display: 'contents' } }, h('a', { class: 'btn quiet small', href: '#signin', 'data-go': 'signin' }, t('შესვლა', 'Sign in')),
        h('a', { class: 'btn lamp small', href: '#signup', 'data-go': 'signup' }, t('რეგისტრაცია', 'Join'))),
  );
  foot.replaceChildren(
    h('span', null, t('MEDICARD — უფასო ჯანმრთელობის აპი. ინფლუენსერებს ვუხდით, მომხმარებლისთვის აპი ყოველთვის უფასოა.', 'MEDICARD is a free health app. We pay influencers; the app stays free for everyone.')),
    h('span', null, t('კითხვები: ', 'Questions: '), h('a', { href: 'mailto:support@medicard.ge' }, 'support@medicard.ge'), ' · ', h('a', { href: '/privacy' }, t('კონფიდენციალურობა', 'Privacy'))),
  );
}

async function signOut() {
  await api('/signout', { method: 'POST' }).catch(() => null);
  state.me = null;
  go('');
}

function rulesList(p) {
  const hold = p?.holdDays ?? 14;
  const win = p?.entryWindowDays ?? 7;
  const min = p?.minPayout ?? 2000;
  return [
    t(`ითვლება ახალი ანგარიში, რომელმაც შენი კოდი რეგისტრაციიდან ${win} დღეში შეიყვანა.`, `A new account that enters your code within ${win} days of signing up counts.`),
    t('ანგარიშს დადასტურებული ტელეფონის ნომერი აქვს და მფლობელი 18 წლისაა ან მეტის.', 'The account has a verified phone number and its owner is 18 or older.'),
    t('ერთ ანგარიშს ერთი კოდი აქვს და მერე აღარ იცვლება; ერთი ტელეფონიდან — ერთი რეგისტრაცია.', 'One account, one code — it never changes afterwards. One phone, one registration.'),
    t(`რეგისტრაცია ${hold} დღის შემდეგ ჩაითვლება. თუ ამ დროში ანგარიში წაიშალა ან დაიბლოკა, არ ითვლება.`, `A registration counts after ${hold} days. If the account is deleted or blocked before that, it doesn't count.`),
    t('საკუთარი კოდის შეყვანა, ყალბი ანგარიშები და ერთი ქსელიდან ბევრი რეგისტრაცია მოწმდება; დარღვევა ანგარიშის დაბლოკვას იწვევს.', 'Entering your own code, fake accounts and many sign-ups from one network get checked; abuse gets the account blocked.'),
    t(`თანხის გატანა ${gel(min)}-დან, შენს სახელზე ან შენს კომპანიაზე გახსნილ საბანკო ანგარიშზე.`, `Payouts from ${gel(min)}, to a bank account in your name or your company's.`),
  ];
}

function openDialog(build) {
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    opener?.focus?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const opener = document.activeElement;
  const box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' });
  const backdrop = h('div', { class: 'dialog-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } }, box);
  box.append(...[build(close)].flat());
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  (box.querySelector('input, button') || box).focus();
  return close;
}

function openRules() {
  openDialog((close) => [
    h('h2', null, t('პროგრამის წესები', 'Program rules')),
    h('div', { class: 'terms-text' },
      h('h3', null, t('ანაზღაურება', 'Pay')),
      h('p', null, ladderSentence(state.program?.tiers)),
      h('h3', null, t('რა ითვლება რეგისტრაციად', 'What counts as a registration')),
      h('ul', null, rulesList(state.program).map((r) => h('li', null, r))),
      h('h3', null, t('ჩვენ ვიტოვებთ უფლებას', 'We may')),
      h('ul', null,
        h('li', null, t('შევაჩეროთ ან დავბლოკოთ ანგარიში და არ ჩავთვალოთ საეჭვო რეგისტრაციები;', 'pause or block an account and not count suspicious registrations;')),
        h('li', null, t('შევცვალოთ ტარიფები — ცვლილება მოქმედებს მომავალ რეგისტრაციებზე, უკვე დათვლილი თანხა არ იცვლება;', 'change the rates — changes apply to future registrations; money already counted stays;')),
        h('li', null, t('გადარიცხვამდე გადავამოწმოთ ანგარიშის მფლობელის მონაცემები.', "check the account holder's details before a transfer.")),
      ),
      h('h3', null, t('მონაცემები', 'Data')),
      h('p', null, t('შენს პორტალზე ჩანს მხოლოდ რაოდენობები და თარიღები — მომხმარებლების სახელები, კონტაქტები და ჯანმრთელობის მონაცემები არასდროს. შენი საჯარო სახელი და ფოტო ჩანს მოწვევის გვერდზე (medicard.ge/i/შენი-კოდი) და აპში კოდის შეყვანისას.', 'Your portal shows counts and dates only — never people’s names, contacts or health data. Your public name and photo appear on your invite page (medicard.ge/i/your-code) and in the app when someone enters your code.')),
    ),
    h('div', { class: 'actions' }, h('button', { class: 'btn lamp', type: 'button', onclick: close }, t('გასაგებია', 'Got it'))),
  ]);
}

function ladderSentence(tiers) {
  const list = tiers || [];
  if (!list.length) return '';
  const parts = list.map((tier, i) => {
    const next = list[i + 1];
    const range = next
      ? t(`${num(tier.from + 1)}–${num(next.from)}`, `${num(tier.from + 1)}–${num(next.from)}`)
      : t(`${num(tier.from + 1)}-დან`, `${num(tier.from + 1)} and up`);
    return t(`${range} რეგისტრაცია — ${gel(tier.rate)} თითოზე`, `registrations ${range}: ${gel(tier.rate)} each`);
  });
  return t(`თითო ჩათვლილ რეგისტრაციაზე: ${parts.join('; ')}. ტარიფი მოქმედებს ზღვრის შემდეგ მოსულ რეგისტრაციებზე.`, `Per counted registration: ${parts.join('; ')}. Each rate applies to the registrations after its threshold.`);
}

/* ───────────── landing ───────────── */
function landing() {
  const p = state.program || {};
  const tiers = p.tiers || [{ key: 'SPARK', ka: 'ნაპერწკალი', en: 'Spark', from: 0, rate: 25 }, { key: 'STAR', ka: 'ვარსკვლავი', en: 'Star', from: 1000, rate: 28 }, { key: 'SUPERNOVA', ka: 'სუპერნოვა', en: 'Supernova', from: 5000, rate: 35 }];
  const first = tiers[0]?.rate ?? 25;
  const top = tiers[tiers.length - 1]?.rate ?? 35;
  const closed = state.program && !state.program.signupOpen;
  mount(
    h('div', { class: 'wrap' },
      h('section', { class: 'hero' },
        h('div', null,
          h('h1', null, t('მოიყვანე ხალხი MEDICARD-ში და მიიღე ანაზღაურება ყოველ რეგისტრაციაზე', 'Bring people to MEDICARD and get paid for every sign-up')),
          h('p', { class: 'lead' }, t(
            `MEDICARD უფასო ჯანმრთელობის აპია — წამლები, ციკლი, ანალიზები და Medi ერთ ადგილას. შენი მიმდევრები აპში შენს კოდს შეიყვანენ, შენ კი თითო რეგისტრაციაზე ${gel(first)}-დან ${gel(top)}-მდე მიიღებ.`,
            `MEDICARD is a free health app — medications, cycle, lab results and Medi in one place. Your followers enter your code in the app, and you earn ${gel(first)} to ${gel(top)} for each sign-up.`)),
          h('div', { class: 'hero-actions' },
            closed
              ? h('p', { class: 'hero-note' }, t('ახალი რეგისტრაცია ახლა დახურულია. უკვე გაქვს ანგარიში? შედი.', 'New sign-ups are closed right now. Already have an account? Sign in.'))
              : h('a', { class: 'btn lamp', href: '#signup', 'data-go': 'signup' }, t('გახდი პარტნიორი', 'Become a partner')),
            h('a', { class: 'btn', href: '#signin', 'data-go': 'signin' }, t('უკვე მაქვს ანგარიში', 'I have an account'))),
          h('p', { class: 'hero-note' }, t('რეგისტრაციისთვის საჭიროა Instagram, TikTok და შენი ფოტო. 18+', 'You need Instagram, TikTok and a photo of you to join. 18+'))),
        bulbSign('NINO25', { caption: h('div', { class: 'sign-caption' }, h('span', null, t('შენი კოდი შეიძლება ასე გამოიყურებოდეს', 'Your code could look like this')), h('b', null, 'medicard.ge/i/NINO25')) }))),
    h('section', { class: 'section' },
      h('div', { class: 'wrap' },
        h('h2', null, t('რაც მეტს მოიყვან, მით მეტს იღებ თითოზე', 'The more you bring, the more each one pays')),
        h('p', { class: 'sub' }, t('სტატუსი ჩათვლილი რეგისტრაციების რაოდენობით იზრდება და ავტომატურად იცვლება.', 'Your status grows with counted registrations and changes on its own.')),
        h('div', { class: 'ladder', style: { '--n': String(tiers.length) } }, tiers.map((tier) => h('div', { class: 'rung' },
          badge(tier.key),
          h('h3', null, t(tier.ka, tier.en)),
          h('p', { class: 'from' }, tier.from ? t(`${num(tier.from)} რეგისტრაციის შემდეგ`, `after ${num(tier.from)} registrations`) : t('პირველივე რეგისტრაციიდან', 'from the first registration')),
          h('div', { class: 'rate' }, gel(tier.rate), h('small', null, t('თითოზე', 'each')))))),
        h('p', { class: 'ladder-note' }, ladderSentence(tiers)))),
    h('section', { class: 'section' },
      h('div', { class: 'wrap' },
        h('h2', null, t('როგორ მუშაობს', 'How it works')),
        h('ol', { class: 'steps' },
          h('li', null, h('b', null, t('დარეგისტრირდი', 'Sign up')), h('span', null, t('მიუთითე Instagram და TikTok, ატვირთე ფოტო. ანგარიშს გუნდი გადახედავს.', 'Add your Instagram and TikTok and a photo. Our team reviews the account.'))),
          h('li', null, h('b', null, t('აირჩიე კოდი', 'Pick your code')), h('span', null, t('კოდს მაშინვე მიიღებ — ან შექმენი საკუთარი, მაგ. NINO25.', 'You get a code at once — or make your own, like NINO25.'))),
          h('li', null, h('b', null, t('გაუზიარე', 'Share it')), h('span', null, t('მიმდევარი აპს ჩამოტვირთავს და პროფილში → „ვინ მოგიწვია?“ შენს კოდს შეიყვანს.', 'Followers install the app and enter your code in Profile → “Who invited you?”.'))),
          h('li', null, h('b', null, t('მიიღე თანხა', 'Get paid')), h('span', null, t(`${p.holdDays ?? 14} დღეში რეგისტრაცია ჩაითვლება და ბალანსზე გადავა. გაიტანე ბანკის ანგარიშზე.`, `After ${p.holdDays ?? 14} days a registration counts and moves to your balance. Withdraw to your bank account.`)))))),
    h('section', { class: 'section' },
      h('div', { class: 'wrap' },
        h('h2', null, t('რა ითვლება რეგისტრაციად', 'What counts')),
        h('p', { class: 'sub' }, t('ვიხდით რეალურ ადამიანებზე. ეს წესები შენს შემოსავალსაც იცავს და ჩვენს მომხმარებლებსაც.', 'We pay for real people. These rules protect your earnings and our users.')),
        h('ul', { class: 'rules' }, rulesList(p).map((r) => h('li', null, r))))),
    h('section', { class: 'section' },
      h('div', { class: 'wrap' },
        h('div', { class: 'cta-band' },
          h('p', null, t('შენი კოდი შეიძლება დღესვე ანთოს.', 'Your code could light up today.')),
          closed ? h('a', { class: 'btn', href: '#signin', 'data-go': 'signin' }, t('შესვლა', 'Sign in')) : h('a', { class: 'btn lamp', href: '#signup', 'data-go': 'signup' }, t('რეგისტრაცია', 'Join'))))),
  );
}

/* ───────────── forms ───────────── */
function field({ name, label, type = 'text', required = false, placeholder = '', value = '', autocomplete, note, prefix, inputmode, maxlength }) {
  const input = h('input', { name, id: `f-${name}`, type, placeholder, value, autocomplete, inputmode, maxlength, required: required || null, 'aria-describedby': `e-${name}` });
  return h('label', { class: 'field', 'data-field': name, for: `f-${name}` },
    h('span', null, label, required ? h('em', null, ' *') : null),
    prefix ? h('div', { class: 'with-prefix' }, h('i', null, prefix), input) : input,
    note ? h('small', { class: 'note' }, note) : null,
    h('small', { class: 'err', id: `e-${name}`, role: 'alert' }));
}

function clearErrors(form) {
  form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
  form.querySelectorAll('.err').forEach((el) => { el.textContent = ''; });
  const msg = form.querySelector('.form-msg');
  if (msg) msg.textContent = '';
}

function showError(form, err) {
  const box = err.field ? form.querySelector(`[data-field="${err.field}"]`) : null;
  if (box) {
    box.classList.add('has-error');
    const slot = box.querySelector('.err');
    if (slot) slot.textContent = err.message;
    (box.querySelector('input, select') || box).focus?.();
  } else {
    const msg = form.querySelector('.form-msg');
    if (msg) msg.textContent = err.message;
  }
}

async function busy(button, fn) {
  button.classList.add('is-busy');
  button.disabled = true;
  try {
    return await fn();
  } finally {
    button.classList.remove('is-busy');
    button.disabled = false;
  }
}

function signupView() {
  if (state.program && !state.program.signupOpen) {
    mount(h('div', { class: 'wrap' }, h('div', { class: 'panel narrow' },
      h('h1', null, t('რეგისტრაცია დახურულია', 'Sign-ups are closed')),
      h('p', { class: 'sub' }, t('ახალი ინფლუენსერების მიღება დროებით შეჩერებულია. მოგვწერე support@medicard.ge-ზე და შეგატყობინებთ, როცა გაიხსნება.', 'We are not taking new influencers right now. Write to support@medicard.ge and we’ll let you know when it opens.')),
      h('a', { class: 'btn', href: '#signin', 'data-go': 'signin' }, t('შესვლა', 'Sign in')))));
    return;
  }
  let file = null;
  const preview = h('span', { class: 'plus', 'aria-hidden': 'true' }, '+');
  const frame = h('label', { class: 'frame', for: 'f-photo', title: t('ფოტოს არჩევა', 'Choose a photo') }, preview,
    h('input', { type: 'file', id: 'f-photo', name: 'photo', accept: 'image/jpeg,image/png,image/webp,image/heic', 'aria-describedby': 'e-photo', onchange: (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 12 * 1024 * 1024) { toast(t('ფოტო 12 მბ-ზე ნაკლები უნდა იყოს.', 'The photo must be under 12 MB.'), 'bad'); return; }
      file = f;
      const img = h('img', { alt: '' });
      img.src = URL.createObjectURL(f);
      frame.replaceChild(img, frame.firstChild);
      photoBox.classList.remove('has-error');
      photoBox.querySelector('.err').textContent = '';
    } }));
  const photoBox = h('div', { class: 'photo-pick', 'data-field': 'photo' }, frame,
    h('div', { class: 'copy' },
      h('b', null, t('შენი ფოტო', 'Your photo'), h('em', { style: { fontStyle: 'normal', color: 'var(--lamp)' } }, ' *')),
      h('span', null, t('სახის მკაფიო ფოტო. ის გამოჩნდება შენს მოწვევის გვერდზე, როცა ანგარიშს დავადასტურებთ.', 'A clear photo of your face. It shows on your invite page once we approve your account.')),
      h('small', { class: 'err', id: 'e-photo', role: 'alert' })));
  const submit = h('button', { class: 'btn lamp wide', type: 'submit' }, t('ანგარიშის შექმნა', 'Create account'));
  const form = h('form', { novalidate: true },
    photoBox,
    h('fieldset', { class: 'form-section' },
      h('legend', null, t('შენ შესახებ', 'About you')),
      h('div', { class: 'grid-2' },
        field({ name: 'fullName', label: t('სახელი და გვარი', 'Full name'), required: true, autocomplete: 'name', placeholder: t('ნინო ბერიძე', 'Nino Beridze') }),
        field({ name: 'displayName', label: t('საჯარო სახელი', 'Public name'), placeholder: t('ნინო ან @nino.be', 'Nino or @nino.be'), note: t('ასე დაგინახავენ მიმდევრები', 'What your followers see') })),
      h('div', { class: 'grid-2' },
        field({ name: 'email', label: t('ელფოსტა', 'Email'), type: 'email', required: true, autocomplete: 'email', inputmode: 'email' }),
        field({ name: 'phone', label: t('ტელეფონი', 'Phone'), type: 'tel', required: true, autocomplete: 'tel', inputmode: 'tel', placeholder: '555 12 34 56' }))),
    h('fieldset', { class: 'form-section' },
      h('legend', null, t('სოციალური ქსელები', 'Social accounts')),
      h('p', { class: 'hint' }, t('Instagram და TikTok სავალდებულოა — ჩაწერე სახელი ან პროფილის ბმული.', 'Instagram and TikTok are required — a handle or the profile link.')),
      h('div', { class: 'grid-2' },
        field({ name: 'instagram', label: 'Instagram', required: true, prefix: '@', placeholder: 'nino.be', autocomplete: 'off' }),
        field({ name: 'tiktok', label: 'TikTok', required: true, prefix: '@', placeholder: 'nino.be', autocomplete: 'off' })),
      h('div', { class: 'grid-2' },
        field({ name: 'facebook', label: 'Facebook', placeholder: 'facebook.com/…', autocomplete: 'off' }),
        field({ name: 'youtube', label: 'YouTube', placeholder: '@channel', autocomplete: 'off' })),
      field({ name: 'other', label: t('სხვა ბმული', 'Another link'), placeholder: 'linktr.ee/…', autocomplete: 'off' })),
    h('fieldset', { class: 'form-section' },
      h('legend', null, t('პაროლი', 'Password')),
      field({ name: 'password', label: t('პაროლი', 'Password'), type: 'password', required: true, autocomplete: 'new-password', note: t('მინიმუმ 8 სიმბოლო', 'At least 8 characters') })),
    h('label', { class: 'check', 'data-field': 'adult' }, h('input', { type: 'checkbox', name: 'adult', value: '1' }), h('span', null, t('18 წლის ან მეტის ვარ', 'I am 18 or older'))),
    h('label', { class: 'check', 'data-field': 'terms' }, h('input', { type: 'checkbox', name: 'terms', value: '1' }),
      h('span', null, t('წავიკითხე და ვეთანხმები ', 'I have read and accept the '), h('a', { href: '#', onclick: (e) => { e.preventDefault(); openRules(); } }, t('პროგრამის წესებს', 'program rules')))),
    h('p', { class: 'form-msg', role: 'alert' }),
    submit,
    h('div', { class: 'form-foot' }, h('span', null, t('უკვე გაქვს ანგარიში? ', 'Already have an account? '), h('a', { href: '#signin', 'data-go': 'signin' }, t('შესვლა', 'Sign in')))));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    photoBox.classList.remove('has-error');
    const data = new FormData(form);
    const local = [];
    if (!file) local.push({ field: 'photo', message: t('ატვირთე შენი ფოტო.', 'Add a photo of you.') });
    for (const name of ['fullName', 'email', 'phone', 'instagram', 'tiktok', 'password']) {
      if (!String(data.get(name) || '').trim()) local.push({ field: name, message: t('სავალდებულოა.', 'Required.') });
    }
    if (!data.get('adult')) local.push({ field: 'adult', message: '' });
    if (!data.get('terms')) local.push({ field: 'terms', message: '' });
    if (local.length) {
      local.forEach((err) => {
        const box = form.querySelector(`[data-field="${err.field}"]`);
        box?.classList.add('has-error');
        const slot = box?.querySelector('.err');
        if (slot) slot.textContent = err.message;
      });
      form.querySelector('.form-msg').textContent = t('შეავსე მონიშნული ველები.', 'Fill in the marked fields.');
      form.querySelector('.has-error input')?.focus();
      return;
    }
    data.set('photo', file);
    data.set('lang', lang);
    await busy(submit, async () => {
      try {
        await api('/signup', { method: 'POST', form: data });
        await loadMe();
        toast(t('ანგარიში შეიქმნა', 'Account created'));
        go('dashboard');
      } catch (err) {
        showError(form, err);
      }
    });
  });
  mount(h('div', { class: 'wrap' }, h('div', { class: 'panel' },
    h('h1', null, t('გახდი MEDICARD-ის პარტნიორი', 'Become a MEDICARD partner')),
    h('p', { class: 'sub' }, t('ორ წუთში შეავსებ. კოდს მაშინვე მიიღებ, გატანა გაიხსნება ანგარიშის დადასტურების შემდეგ.', 'Takes two minutes. You get your code at once; payouts open once your account is approved.')),
    form)));
}

function signinView() {
  const submit = h('button', { class: 'btn lamp wide', type: 'submit' }, t('შესვლა', 'Sign in'));
  const form = h('form', { novalidate: true },
    field({ name: 'email', label: t('ელფოსტა', 'Email'), type: 'email', required: true, autocomplete: 'email', inputmode: 'email' }),
    field({ name: 'password', label: t('პაროლი', 'Password'), type: 'password', required: true, autocomplete: 'current-password' }),
    h('p', { class: 'form-msg', role: 'alert' }),
    submit,
    h('div', { class: 'form-foot' },
      h('a', { href: '#forgot', 'data-go': 'forgot' }, t('დაგავიწყდა პაროლი?', 'Forgot your password?')),
      h('span', null, t('ანგარიში არ გაქვს? ', 'No account? '), h('a', { href: '#signup', 'data-go': 'signup' }, t('რეგისტრაცია', 'Join')))));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const data = Object.fromEntries(new FormData(form).entries());
    await busy(submit, async () => {
      try {
        await api('/signin', { method: 'POST', body: data });
        await loadMe();
        go('dashboard');
      } catch (err) {
        showError(form, err);
      }
    });
  });
  mount(h('div', { class: 'wrap' }, h('div', { class: 'panel narrow' },
    h('h1', null, t('შესვლა', 'Sign in')),
    h('p', { class: 'sub' }, t('შენი კოდი, სტატუსი და ბალანსი.', 'Your code, status and balance.')),
    form)));
}

function forgotView() {
  let email = '';
  const askForm = () => {
    const submit = h('button', { class: 'btn lamp wide', type: 'submit' }, t('კოდის გაგზავნა', 'Send the code'));
    const form = h('form', { novalidate: true },
      field({ name: 'email', label: t('ელფოსტა', 'Email'), type: 'email', required: true, autocomplete: 'email', inputmode: 'email' }),
      h('p', { class: 'form-msg', role: 'alert' }), submit);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      email = String(new FormData(form).get('email') || '').trim();
      if (!email) return showError(form, { field: 'email', message: t('ჩაწერე ელფოსტა.', 'Enter your email.') });
      await busy(submit, async () => {
        try {
          await api('/password/forgot', { method: 'POST', body: { email } });
          paint(resetForm());
        } catch (err) {
          showError(form, err);
        }
      });
    });
    return [h('h1', null, t('პაროლის აღდგენა', 'Reset your password')), h('p', { class: 'sub' }, t('ელფოსტაზე 6-ნიშნა კოდს გამოგიგზავნით.', 'We’ll email you a 6-digit code.')), form];
  };
  const resetForm = () => {
    const submit = h('button', { class: 'btn lamp wide', type: 'submit' }, t('პაროლის შეცვლა', 'Change password'));
    const form = h('form', { novalidate: true },
      field({ name: 'code', label: t('კოდი ელფოსტიდან', 'Code from the email'), required: true, inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6' }),
      field({ name: 'password', label: t('ახალი პაროლი', 'New password'), type: 'password', required: true, autocomplete: 'new-password', note: t('მინიმუმ 8 სიმბოლო', 'At least 8 characters') }),
      h('p', { class: 'form-msg', role: 'alert' }), submit);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      const data = Object.fromEntries(new FormData(form).entries());
      await busy(submit, async () => {
        try {
          await api('/password/reset', { method: 'POST', body: { email, ...data } });
          await loadMe();
          toast(t('პაროლი შეიცვალა', 'Password changed'));
          go('dashboard');
        } catch (err) {
          showError(form, err);
        }
      });
    });
    return [h('h1', null, t('ჩაწერე კოდი', 'Enter the code')), h('p', { class: 'sub' }, t(`თუ ${email}-ზე ანგარიში არსებობს, კოდი უკვე გზაშია. კოდი 15 წუთი მოქმედებს.`, `If ${email} has an account, the code is on its way. It works for 15 minutes.`)), form];
  };
  const panel = h('div', { class: 'panel narrow' });
  const paint = (nodes) => { panel.replaceChildren(...nodes); panel.querySelector('input')?.focus(); };
  paint(askForm());
  mount(h('div', { class: 'wrap' }, panel));
}

/* ───────────── dashboard ───────────── */
async function loadMe() {
  try {
    state.me = await api('/me');
  } catch (err) {
    if (err.status === 401 || err.status === 403) state.me = null;
    else throw err;
  }
  return state.me;
}

function copy(text, done) {
  const ok = () => toast(done);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(ok, () => toast(text));
  else toast(text);
}

const STATUS_PILL = {
  REQUESTED: ['warn', t('მოთხოვნილია', 'Requested')],
  APPROVED: ['warn', t('დამტკიცებულია', 'Approved')],
  PAID: ['ok', t('ჩარიცხულია', 'Paid')],
  REJECTED: ['bad', t('უარყოფილია', 'Declined')],
};

function photoUrl() {
  return `/api/promo/me/photo?v=${encodeURIComponent(state.me?.influencer?.id || '')}${state.photoBust || ''}`;
}

function dashboardView() {
  const d = state.me;
  if (!d) return go('signin');
  const inf = d.influencer;
  const code = d.code || '------';
  const link = `https://medicard.ge/i/${code}`;
  const tier = d.tier;
  const notices = [];
  if (inf.status === 'PENDING') {
    notices.push(h('div', { class: 'notice warn' }, h('p', null, t('ანგარიში განხილვაშია. კოდი უკვე მუშაობს და რეგისტრაციები ითვლება — თანხის გატანა დადასტურების შემდეგ გაიხსნება.', 'Your account is under review. Your code already works and registrations count — payouts open once it is approved.'))));
  } else if (inf.status === 'SUSPENDED') {
    notices.push(h('div', { class: 'notice bad' }, h('p', null, t('ანგარიში შეჩერებულია: კოდი ახალ რეგისტრაციებს არ იღებს და გატანა შეჩერებულია.', 'Your account is paused: your code takes no new registrations and payouts are on hold.'), inf.statusReason ? ` ${t('მიზეზი', 'Reason')}: ${inf.statusReason}` : '', ' ', t('დაგვიკავშირდი: support@medicard.ge', 'Contact us: support@medicard.ge'))));
  }
  if (d.program && !d.program.on) {
    notices.push(h('div', { class: 'notice bad' }, h('p', null, t('პროგრამა დროებით შეჩერებულია: ახალი კოდები აპში ახლა არ მიიღება. უკვე დათვლილი თანხა შენახულია.', 'The program is paused for now: codes are not accepted in the app. Money already counted is safe.'))));
  }

  const nextLabel = tier.next
    ? t(`შემდეგ სტატუსამდე („${tierName(tier.next)}“) დარჩა ${num(tier.next.remaining)} რეგისტრაცია`, `${num(tier.next.remaining)} registrations to ${tierName(tier.next)}`)
    : t('უმაღლეს სტატუსზე ხარ', 'You are at the top status');
  const meterCls = tier.key === 'STAR' ? 'meter star' : tier.key === 'SPARK' ? 'meter' : 'meter nova';
  const minPayout = d.rules?.minPayout ?? 2000;
  const open = d.payouts.find((p) => p.status === 'REQUESTED' || p.status === 'APPROVED');
  let whyNot = '';
  if (!d.canRequestPayout) {
    if (inf.status === 'PENDING') whyNot = t('გატანა ანგარიშის დადასტურების შემდეგ გაიხსნება.', 'Payouts open once your account is approved.');
    else if (inf.status !== 'ACTIVE') whyNot = t('ანგარიში შეჩერებულია.', 'Your account is paused.');
    else if (open) whyNot = t('წინა მოთხოვნა მუშავდება.', 'Your previous request is being processed.');
    else whyNot = t(`გატანა ${gel(minPayout)}-დან. აკლია ${gel(minPayout - d.balance.available)}.`, `Payouts start at ${gel(minPayout)}. ${gel(minPayout - d.balance.available)} to go.`);
  }
  const maxN = Math.max(1, ...d.series.map((x) => x.n));
  const share = async () => {
    const text = t(`ჩამოტვირთე MEDICARD — უფასო ჯანმრთელობის აპი. რეგისტრაციის შემდეგ პროფილში → „ვინ მოგიწვია?“ შეიყვანე ჩემი კოდი ${code}`, `Get MEDICARD — a free health app. After you sign up, enter my code ${code} in Profile → “Who invited you?”`);
    if (navigator.share) {
      try { await navigator.share({ text, url: link }); } catch { /* dismissed */ }
    } else copy(`${text}\n${link}`, t('ტექსტი და ბმული დაკოპირდა', 'Text and link copied'));
  };

  mount(h('div', { class: 'wrap dash' },
    h('div', { class: 'who' },
      inf.hasPhoto ? h('img', { class: 'avatar', src: photoUrl(), alt: '' }) : h('div', { class: 'avatar' }),
      h('div', null, h('h1', null, inf.displayName), h('p', null, inf.email)),
      tierChip(tier)),
    notices,
    h('section', { class: 'code-hero', 'aria-label': t('შენი კოდი', 'Your code') },
      bulbSign(code, { caption: h('div', { class: 'sign-caption' }, h('span', null, t('შენი კოდი', 'Your code')), h('b', null, code)) }),
      h('div', { class: 'code-tools' },
        h('h2', null, t('გაუზიარე კოდი — ყოველი შეყვანა ერთი ნათურაა შენს ბალანსზე', 'Share your code — every entry is one more light on your balance')),
        h('p', null, t('მიმდევარს მიეცი კოდი ან ბმული. ბმული ხსნის აპს და კოდს თავად ავსებს.', 'Give followers the code or the link. The link opens the app and fills the code in.')),
        h('div', { class: 'row' },
          h('button', { class: 'btn lamp', type: 'button', onclick: () => copy(code, t('კოდი დაკოპირდა', 'Code copied')) }, t('კოდის კოპირება', 'Copy code')),
          h('button', { class: 'btn', type: 'button', onclick: () => copy(link, t('ბმული დაკოპირდა', 'Link copied')) }, t('ბმულის კოპირება', 'Copy link')),
          h('button', { class: 'btn quiet', type: 'button', onclick: share }, t('გაზიარება', 'Share'))),
        h('div', { class: 'code-link' }, h('b', null, link.replace('https://', ''))),
        h('div', { class: 'path', 'aria-label': t('სად შეჰყავთ კოდი', 'Where followers enter it') },
          t('აპში:', 'In the app:'), h('span', null, t('პროფილი', 'Profile')), h('span', null, t('ვინ მოგიწვია?', 'Who invited you?')), h('span', null, code)))),
    h('div', { class: 'split' },
      h('section', { class: 'block' },
        h('h2', null, t('სტატუსი', 'Status')),
        h('p', { class: 'sub' }, t('იზრდება ჩათვლილი რეგისტრაციებით', 'Grows with counted registrations')),
        h('div', { class: 'tier-now' }, badge(tier.key),
          h('div', null, h('h3', null, tierName(tier)), h('p', null, t(`ახლა თითო რეგისტრაცია: ${gel(tier.rate)}`, `Each registration now: ${gel(tier.rate)}`)))),
        h('div', { class: meterCls, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(tier.progress * 100)), 'aria-label': nextLabel },
          h('i', { style: { width: `${Math.max(2, Math.round(tier.progress * 100))}%` } })),
        h('div', { class: 'meter-text' }, h('span', null, nextLabel), tier.next ? h('b', null, t(`შემდეგ ${gel(tier.next.rate)}`, `then ${gel(tier.next.rate)}`)) : null)),
      h('section', { class: 'block' },
        h('h2', null, t('ბალანსი', 'Balance')),
        h('p', { class: 'sub' }, t('ჩათვლილი რეგისტრაციების თანხა', 'Money from counted registrations')),
        h('div', { class: 'money' }, h('div', { class: 'big' }, (d.balance.available / 100).toFixed(2), h('small', null, '₾')), h('div', { class: 'label' }, t('გასატანად ხელმისაწვდომი', 'Available to withdraw'))),
        h('div', { class: 'facts' },
          h('div', null, h('b', null, `≈ ${gel(d.pendingAmount)}`), h('span', null, t('მოლოდინში', 'On hold'))),
          h('div', null, h('b', null, gel(d.balance.inProcess)), h('span', null, t('დამუშავებაში', 'Processing'))),
          h('div', null, h('b', null, gel(d.balance.paid)), h('span', null, t('სულ გატანილი', 'Paid out')))),
        h('button', { class: 'btn lamp', type: 'button', disabled: !d.canRequestPayout || null, onclick: openPayout }, t('თანხის გატანა', 'Withdraw')),
        whyNot ? h('p', { class: 'why' }, whyNot) : null)),
    h('section', { class: 'block', style: { marginBottom: 'clamp(18px, 3vw, 32px)' } },
      h('h2', null, t('რეგისტრაციები', 'Registrations')),
      h('p', { class: 'sub' }, t(`ჩანს მხოლოდ რაოდენობები. რეგისტრაცია ${d.rules?.holdDays ?? 14} დღის მოლოდინის შემდეგ ჩაითვლება.`, `Counts only. A registration counts after a ${d.rules?.holdDays ?? 14}-day hold.`)),
      h('div', { class: 'counts' },
        h('div', null, h('b', null, num(d.counts.credited)), h('span', null, t('ჩაითვალა', 'Counted'))),
        h('div', null, h('b', null, num(d.counts.pending + d.counts.flagged)), h('span', null, t('მოლოდინში', 'On hold'))),
        h('div', null, h('b', null, num(d.counts.thisMonth)), h('span', null, t('ამ თვეში', 'This month'))),
        h('div', null, h('b', null, num(d.counts.notCounted)), h('span', null, t('არ ჩაითვალა', 'Not counted')))),
      h('div', { class: 'chart', role: 'img', 'aria-label': t('რეგისტრაციები ბოლო 30 დღეში', 'Registrations in the last 30 days') },
        d.series.map((x) => h('i', { class: x.n ? '' : 'zero', style: { height: `${Math.max(3, Math.round((x.n / maxN) * 100))}%` }, title: `${day(x.day)}: ${num(x.n)}` }))),
      h('div', { class: 'chart-axis' }, h('span', null, day(d.series[0]?.day)), h('span', null, t('ბოლო 30 დღე', 'Last 30 days')), h('span', null, t('დღეს', 'Today'))),
      d.nextCreditAt ? h('p', { class: 'why' }, t(`მომდევნო ჩათვლა: ${day(d.nextCreditAt)}`, `Next to count: ${day(d.nextCreditAt)}`)) : null),
    h('div', { class: 'split' },
      codeBlock(d),
      payoutsBlock(d)),
    profileBlock(d),
    h('p', { class: 'why', style: { textAlign: 'center', marginTop: '28px' } }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); openRules(); } }, t('პროგრამის წესები', 'Program rules'))),
  ));
}

function codeBlock(d) {
  const input = h('input', { name: 'code', id: 'f-code', maxlength: '6', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'NINO25', 'aria-describedby': 'code-state' });
  const stateLine = h('div', { class: 'code-state', id: 'code-state', role: 'status' });
  const save = h('button', { class: 'btn lamp', type: 'submit', disabled: true }, t('შენახვა', 'Save'));
  let timer = null;
  let lastOk = '';
  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    save.disabled = true;
    stateLine.className = 'code-state';
    stateLine.textContent = '';
    clearTimeout(timer);
    if (input.value.length < 6) return;
    timer = setTimeout(async () => {
      try {
        const r = await api(`/code/check?code=${encodeURIComponent(input.value)}`);
        if (r.code !== input.value) return;
        stateLine.className = `code-state ${r.ok ? 'ok' : 'bad'}`;
        stateLine.textContent = r.ok ? t('თავისუფალია', 'Available') : r.message;
        save.disabled = !r.ok;
        lastOk = r.ok ? r.code : '';
      } catch (err) {
        stateLine.className = 'code-state bad';
        stateLine.textContent = err.message;
      }
    }, 320);
  });
  const form = h('form', { class: 'code-form', novalidate: true },
    h('label', { class: 'field', for: 'f-code' }, h('span', { class: 'sr-only' }, t('ახალი კოდი', 'New code')), input), save);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!lastOk) return;
    await busy(save, async () => {
      try {
        await api('/code', { method: 'POST', body: { code: lastOk } });
        toast(t('ახალი კოდი მზადაა', 'Your new code is ready'));
        await loadMe();
        render();
      } catch (err) {
        stateLine.className = 'code-state bad';
        stateLine.textContent = err.message;
      }
    });
    save.disabled = true;
  });
  return h('section', { class: 'block' },
    h('h2', null, t('საკუთარი კოდი', 'Your own code')),
    h('p', { class: 'sub' }, t('6 ნიშანი: ლათინური ასოები და 2–9. ძველი კოდებიც აგრძელებს მუშაობას. შეცვლა — 30 დღეში ერთხელ.', '6 characters: Latin letters and 2–9. Older codes keep working. You can change it once every 30 days.')),
    form, stateLine,
    h('div', { class: 'codes-list', 'aria-label': t('შენი კოდები', 'Your codes') }, d.codes.map((c) => h('span', { class: c.primary ? 'primary' : '', title: c.primary ? t('მთავარი კოდი', 'Main code') : t('ესეც მუშაობს', 'This one works too') }, c.code))));
}

function payoutsBlock(d) {
  return h('section', { class: 'block' },
    h('h2', null, t('გატანები', 'Payouts')),
    h('p', { class: 'sub' }, t('მოთხოვნას გუნდი ამუშავებს; ჩარიცხვისას ელფოსტით შეგატყობინებთ.', 'Our team processes each request; we email you when the money is sent.')),
    d.payouts.length
      ? h('table', { class: 'table' },
        h('thead', null, h('tr', null, h('th', null, t('თარიღი', 'Date')), h('th', { class: 'hide-sm' }, t('ანგარიში', 'Account')), h('th', null, t('სტატუსი', 'Status')), h('th', { class: 'num' }, t('თანხა', 'Amount')))),
        h('tbody', null, d.payouts.map((p) => {
          const [cls, label] = STATUS_PILL[p.status] || ['', p.status];
          return h('tr', null,
            h('td', null, day(p.requestedAt, true)),
            h('td', { class: 'hide-sm' }, p.account?.iban || '—'),
            h('td', null, h('span', { class: `pill ${cls}` }, label), p.status === 'REJECTED' && p.rejectReason ? h('div', { class: 'why' }, p.rejectReason) : null, p.status === 'PAID' && p.reference ? h('div', { class: 'why' }, p.reference) : null),
            h('td', { class: 'num' }, gel(p.amount)));
        })))
      : h('p', { class: 'empty' }, t('გატანა ჯერ არ მოგითხოვია.', 'No payouts yet.')));
}

async function openPayout() {
  const d = state.me;
  let saved = null;
  try { saved = (await api('/payout-details')).details; } catch { saved = null; }
  openDialog((close) => {
    const submit = h('button', { class: 'btn lamp', type: 'submit' }, t(`${gel(d.balance.available)}-ის გატანა`, `Withdraw ${gel(d.balance.available)}`));
    const type = saved?.payeeType || 'PERSON';
    const radio = (value, label) => h('label', null, h('input', { type: 'radio', name: 'payeeType', value, checked: value === type || null }), label);
    const idLabel = h('span', null, type === 'COMPANY' ? t('საიდენტიფიკაციო კოდი', 'Company ID') : t('პირადი ნომერი', 'Personal ID number'), h('em', null, ' *'));
    const bankInput = h('input', { name: 'bank', id: 'f-bank', value: saved?.bank || '', placeholder: t('ავტომატურად IBAN-იდან', 'Filled from the IBAN') });
    const ibanInput = h('input', { name: 'iban', id: 'f-iban', value: saved?.iban || '', placeholder: 'GE00 TB00 0000 0000 0000 00', autocomplete: 'off', spellcheck: 'false' });
    const BANKS = { TB: 'თიბისი ბანკი', BG: 'საქართველოს ბანკი', LB: 'ლიბერთი ბანკი', BS: 'ბაზისბანკი', PC: 'პროკრედიტ ბანკი', VT: 'ვითიბი ბანკი', HS: 'ხალიკ ბანკი', CR: 'ქართუ ბანკი', CD: 'კრედო ბანკი' };
    ibanInput.addEventListener('input', () => {
      const v = ibanInput.value.toUpperCase().replace(/\s/g, '');
      const bank = BANKS[v.slice(4, 6)];
      if (bank && (!bankInput.value || Object.values(BANKS).includes(bankInput.value))) bankInput.value = bank;
    });
    const wrap = (name, label, input, note) => h('label', { class: 'field', 'data-field': name, for: input.id }, label, input, note ? h('small', { class: 'note' }, note) : null, h('small', { class: 'err', role: 'alert' }));
    const form = h('form', { novalidate: true },
      h('div', { class: 'field', 'data-field': 'payeeType' }, h('span', null, t('ვის ერიცხება', 'Who receives it')),
        h('div', { class: 'seg', role: 'radiogroup' }, radio('PERSON', t('ფიზიკური პირი', 'Individual')), radio('ENTREPRENEUR', t('ინდ. მეწარმე', 'Sole proprietor')), radio('COMPANY', t('კომპანია', 'Company'))),
        h('small', { class: 'err', role: 'alert' })),
      wrap('iban', h('span', null, 'IBAN', h('em', null, ' *')), ibanInput),
      wrap('holder', h('span', null, t('ანგარიშის მფლობელი', 'Account holder'), h('em', null, ' *')), h('input', { name: 'holder', id: 'f-holder', value: saved?.holder || d.influencer.fullName || '', autocomplete: 'name' }), t('სახელი და გვარი ბანკის მიხედვით', 'Name as the bank has it')),
      h('div', { class: 'grid-2' },
        wrap('idCode', idLabel, h('input', { name: 'idCode', id: 'f-idCode', value: saved?.idCode || '', inputmode: 'numeric', autocomplete: 'off' })),
        wrap('bank', h('span', null, t('ბანკი', 'Bank'), h('em', null, ' *')), bankInput)),
      h('p', { class: 'why' }, t('თანხა ერიცხება მხოლოდ შენს სახელზე ან შენს კომპანიაზე გახსნილ ანგარიშზე. გადარიცხვამდე მონაცემებს გადავამოწმებთ.', 'Money goes only to an account in your name or your company’s. We check the details before the transfer.')),
      h('p', { class: 'form-msg', role: 'alert' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: close }, t('გაუქმება', 'Cancel')), submit));
    form.addEventListener('change', (e) => {
      if (e.target.name === 'payeeType') idLabel.firstChild.textContent = e.target.value === 'COMPANY' ? t('საიდენტიფიკაციო კოდი', 'Company ID') : t('პირადი ნომერი', 'Personal ID number');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      const data = Object.fromEntries(new FormData(form).entries());
      await busy(submit, async () => {
        try {
          await api('/payouts', { method: 'POST', body: data });
          close();
          toast(t('მოთხოვნა გაიგზავნა', 'Request sent'));
          await loadMe();
          render();
        } catch (err) {
          showError(form, err);
        }
      });
    });
    return [h('h2', null, t('თანხის გატანა', 'Withdraw')), h('p', { class: 'sub' }, t(`გაიტან მთელ ხელმისაწვდომ ბალანსს: ${gel(d.balance.available)}.`, `You’ll withdraw your whole available balance: ${gel(d.balance.available)}.`)), form];
  });
}

function profileBlock(d) {
  const inf = d.influencer;
  const so = inf.socials || {};
  const save = h('button', { class: 'btn lamp', type: 'submit' }, t('შენახვა', 'Save'));
  const form = h('form', { novalidate: true },
    h('div', { class: 'grid-2' },
      field({ name: 'displayName', label: t('საჯარო სახელი', 'Public name'), value: inf.displayName, required: true }),
      field({ name: 'phone', label: t('ტელეფონი', 'Phone'), type: 'tel', value: inf.phone, required: true })),
    h('div', { class: 'grid-2' },
      field({ name: 'instagram', label: 'Instagram', value: so.instagram || '', required: true, prefix: '@' }),
      field({ name: 'tiktok', label: 'TikTok', value: so.tiktok || '', required: true, prefix: '@' })),
    h('div', { class: 'grid-2' },
      field({ name: 'facebook', label: 'Facebook', value: so.facebook || '' }),
      field({ name: 'youtube', label: 'YouTube', value: so.youtube || '' })),
    field({ name: 'other', label: t('სხვა ბმული', 'Another link'), value: so.other || '' }),
    h('p', { class: 'form-msg', role: 'alert' }), save);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const data = Object.fromEntries(new FormData(form).entries());
    await busy(save, async () => {
      try {
        await api('/me', { method: 'PATCH', body: data });
        toast(t('შენახულია', 'Saved'));
        await loadMe();
      } catch (err) {
        showError(form, err);
      }
    });
  });
  const photoInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic', class: 'sr-only', id: 'f-newphoto', onchange: async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set('photo', f);
    try {
      await api('/me/photo', { method: 'POST', form: fd });
      state.photoBust = `&t=${Date.now()}`;
      toast(t('ფოტო განახლდა', 'Photo updated'));
      await loadMe();
      render();
    } catch (err) {
      toast(err.message, 'bad');
    }
  } });
  const pwSave = h('button', { class: 'btn', type: 'submit' }, t('პაროლის შეცვლა', 'Change password'));
  const pwForm = h('form', { novalidate: true },
    h('div', { class: 'grid-2' },
      field({ name: 'current', label: t('ახლანდელი პაროლი', 'Current password'), type: 'password', autocomplete: 'current-password' }),
      field({ name: 'password', label: t('ახალი პაროლი', 'New password'), type: 'password', autocomplete: 'new-password' })),
    h('p', { class: 'form-msg', role: 'alert' }), pwSave);
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(pwForm);
    const data = Object.fromEntries(new FormData(pwForm).entries());
    await busy(pwSave, async () => {
      try {
        await api('/me/password', { method: 'POST', body: data });
        pwForm.reset();
        toast(t('პაროლი შეიცვალა', 'Password changed'));
      } catch (err) {
        showError(pwForm, err);
      }
    });
  });
  return h('section', { class: 'block' },
    h('h2', null, t('პროფილი', 'Profile')),
    h('p', { class: 'sub' }, t('სახელი, ფოტო და სოციალური ქსელები ჩანს ადმინისტრაციისთვის; საჯარო სახელი და ფოტო — მოწვევის გვერდზე.', 'Name, photo and socials are visible to our team; your public name and photo show on your invite page.')),
    h('div', { class: 'who', style: { marginBottom: '22px' } },
      inf.hasPhoto ? h('img', { class: 'avatar', src: photoUrl(), alt: '' }) : h('div', { class: 'avatar' }),
      h('label', { class: 'btn small', for: 'f-newphoto', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoInput.click(); } } }, t('ფოტოს შეცვლა', 'Change photo')), photoInput),
    form,
    h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '28px', paddingTop: '24px' } }, h('h2', { style: { fontSize: '16px', margin: '0 0 14px' } }, t('პაროლი', 'Password')), pwForm));
}

/* ───────────── boot ───────────── */
async function render() {
  paintNav();
  const r = route();
  window.scrollTo({ top: 0 });
  if (r === 'dashboard') return dashboardView();
  if (state.me && (r === '' || r === 'signin' || r === 'signup')) return go('dashboard');
  if (r === 'signup') return signupView();
  if (r === 'signin') return signinView();
  if (r === 'forgot') return forgotView();
  return landing();
}

(async function boot() {
  try {
    state.program = await api('/program');
  } catch {
    state.program = null;
  }
  await loadMe().catch(() => null);
  render();
})();
