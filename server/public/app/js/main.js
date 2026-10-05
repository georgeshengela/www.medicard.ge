// MEDICARD web — boot, router and app shell.
import { h, mount, icon, clear, iconButton, toast, openModal } from './ui.js';
import { getToken, onTokenChange } from './api.js';
import { t, isEn, lang, setLang } from './i18n.js';
import {
  session, loadSession, signOut, featureOn, isFemale, isTrainer, initials, onSession, applyTheme, getThemePref, needsOnboarding,
} from './session.js';

const BASE = '/app';

/**
 * iPhone / iPad: offer the app once the signed-in shell is up (/app-promo.js decides whether and
 * how often). The line under it says how to sign in there, so the app opens this same account
 * instead of creating a second one (2026-10-05 duplicate accounts).
 */
function offerAppOnIphone() {
  const u = session.user || {};
  const phone = typeof u.phone === 'string' && /^\+995\d{9}$/.test(u.phone) ? u.phone.replace(/^(\+995)(\d{3})\d{3}(\d{3})$/, '$1 $2 *** $3') : null;
  const email = typeof u.email === 'string' && !/@(phone|apple)\.medicard\.ge$/.test(u.email) ? u.email : null;
  const hint = phone
    ? t(`აპში შედი იმავე ნომრით (${phone}) — იქ ეს ანგარიში დაგხვდება.`, `In the app, sign in with the same number (${phone}) — this account will be there.`)
    : email
      ? t(`აპში შედი იმავე ელ-ფოსტით (${email}) — იქ ეს ანგარიში დაგხვდება.`, `In the app, sign in with the same email (${email}) — this account will be there.`)
      : t('აპში შედი იმავე გზით, რითაც აქ შეხვედი — იქ ეს ანგარიში დაგხვდება.', 'In the app, sign in the same way you did here — this account will be there.');
  window.MedicardAppPromo?.show({ mode: 'sheet', hint, delayMs: 1500 });
}

/* Route table. `page` is a lazy module whose default export is
   async (root, ctx) => cleanup?  ctx = { params, query, navigate, setTitle } */
/** The metrics page is open while any of its trackers is (admin „მოდულები“ pauses each one). */
const TRACKERS = ['weight', 'steps', 'hydration'];
/** MEDISCAN is open while any of its three readings is (labs / imaging / skin). */
const SCAN_KINDS = ['labs', 'imaging', 'skin'];

const ROUTES = [
  { path: '/', page: () => import('./pages/home.js'), title: t('მთავარი', 'Home') },
  { path: '/medi', page: () => import('./pages/medi.js'), title: 'Medi', feature: 'medi' },
  { path: '/medications', page: () => import('./pages/medications.js'), title: t('მედიკამენტები', 'Medications'), feature: 'medications' },
  { path: '/medications/:id', page: () => import('./pages/medications.js'), title: t('მედიკამენტი', 'Medication'), feature: 'medications' },
  { path: '/records', page: () => import('./pages/records.js'), title: t('ჩანაწერები', 'Records'), feature: 'records' },
  { path: '/records/:id', page: () => import('./pages/records.js'), title: t('ჩანაწერი', 'Record'), feature: 'records' },
  { path: '/lab', page: () => import('./pages/lab.js'), title: t('ანალიზები', 'Lab results'), feature: 'labs' },
  { path: '/scan', page: () => import('./pages/scan.js'), title: 'MEDISCAN', anyOf: SCAN_KINDS },
  { path: '/visits', page: () => import('./pages/visits.js'), title: t('ვიზიტები', 'Visits'), feature: 'visits' },
  { path: '/health', page: () => import('./pages/health.js'), title: t('მაჩვენებლები', 'Health metrics'), anyOf: TRACKERS },
  { path: '/nutrition', page: () => import('./pages/nutrition.js'), title: t('კვება', 'Nutrition'), feature: 'nutrition' },
  { path: '/cycle', page: () => import('./pages/cycle.js'), title: t('ციკლი', 'Cycle'), feature: 'cycle' },
  { path: '/quest', page: () => import('./pages/quest.js'), title: 'MEDIQUEST', feature: 'quest' },
  { path: '/run', page: () => import('./pages/run.js'), title: 'MEDIRUN', feature: 'medirun' },
  { path: '/pets', page: () => import('./pages/pets.js'), title: t('ჩემი ცხოველები', 'My pets'), feature: 'pets' },
  { path: '/pets/:id', page: () => import('./pages/pets.js'), title: t('ცხოველი', 'Pet'), feature: 'pets' },
  { path: '/news/:id', page: () => import('./pages/news.js'), title: t('სიახლე', 'News'), feature: 'news' },
  { path: '/trainer', page: () => import('./pages/trainer.js'), title: t('ჩემი ტრენერი', 'My trainer'), feature: 'coach' },
  { path: '/trainer/:section', page: () => import('./pages/trainer.js'), title: t('ჩემი ტრენერი', 'My trainer'), feature: 'coach' },
  { path: '/trainer/:section/:id', page: () => import('./pages/trainer.js'), title: t('ჩემი ტრენერი', 'My trainer'), feature: 'coach' },
  { path: '/coach', page: () => import('./pages/coach.js'), title: t('ტრენერის სივრცე', 'Trainer workspace'), feature: 'coach' },
  { path: '/coach/:section', page: () => import('./pages/coach.js'), title: t('ტრენერის სივრცე', 'Trainer workspace'), feature: 'coach' },
  { path: '/coach/:section/:id', page: () => import('./pages/coach.js'), title: t('ტრენერის სივრცე', 'Trainer workspace'), feature: 'coach' },
  { path: '/profile', page: () => import('./pages/profile.js'), title: t('პროფილი', 'Profile') },
];

const NAV = [
  { group: null, items: [
    { href: '/', label: t('მთავარი', 'Home'), icon: 'home' },
    { href: '/medi', label: 'Medi', icon: 'sparkles', feature: 'medi' },
  ] },
  { group: t('ჯანმრთელობა', 'Health'), items: [
    { href: '/medications', label: t('მედიკამენტები', 'Medications'), icon: 'pill', feature: 'medications' },
    { href: '/lab', label: t('ანალიზები', 'Lab results'), icon: 'flask', feature: 'labs' },
    { href: '/scan', label: 'MEDISCAN', icon: 'scanLine', anyOf: SCAN_KINDS },
    { href: '/records', label: t('ჩანაწერები', 'Records'), icon: 'folder', feature: 'records' },
    { href: '/visits', label: t('ვიზიტები', 'Visits'), icon: 'stethoscope', feature: 'visits' },
    { href: '/health', label: t('მაჩვენებლები', 'Health metrics'), icon: 'activity', anyOf: TRACKERS },
  ] },
  { group: t('ცხოვრების წესი', 'Lifestyle'), items: [
    { href: '/nutrition', label: t('კვება', 'Nutrition'), icon: 'apple', feature: 'nutrition' },
    { href: '/cycle', label: t('ციკლი', 'Cycle'), icon: 'flower', feature: 'cycle', female: true },
    { href: '/quest', label: 'MEDIQUEST', icon: 'trophy', feature: 'quest' },
    { href: '/run', label: 'MEDIRUN', icon: 'mapPin', feature: 'medirun' },
    { href: '/pets', label: t('ჩემი ცხოველები', 'My pets'), icon: 'paw', feature: 'pets' },
    { href: '/trainer', label: t('ჩემი ტრენერი', 'My trainer'), icon: 'dumbbell', feature: 'coach' },
    { href: '/coach', label: t('ტრენერის სივრცე', 'Trainer workspace'), icon: 'users', feature: 'coach', trainer: true },
  ] },
];

const BOTTOM = [
  { href: '/', label: t('მთავარი', 'Home'), icon: 'home' },
  { href: '/medications', label: t('წამლები', 'Meds'), icon: 'pill', feature: 'medications' },
  { href: '/medi', label: 'Medi', icon: 'sparkles', feature: 'medi' },
  { href: '/lab', label: t('ანალიზები', 'Labs'), icon: 'flask', feature: 'labs' },
  { menu: true, label: t('მენიუ', 'Menu'), icon: 'grid' },
];

/** Phone: every section in one sheet (the bottom bar only fits five). */
function openMenu() {
  const items = [...NAV.flatMap((g) => g.items), { href: '/profile', label: t('პროფილი', 'Profile'), icon: 'user' }].filter(visible);
  const m = openModal({
    title: t('ყველა სივრცე', 'Everything'),
    size: 'sm',
    body: h('div', { class: 'menu-grid' }, items.map((it) => h('a', {
      href: it.href, 'data-link': '', class: 'menu-tile',
      onClick: () => setTimeout(() => m.close(), 0),
    }, icon(it.icon, { size: 22 }), h('span', null, it.label)))),
  });
}

const root = document.getElementById('root');
let shell = null;
let cleanup = null;
let renderSeq = 0;

function stripBase(pathname) {
  let p = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function match(path) {
  for (const r of ROUTES) {
    const a = r.path.split('/').filter(Boolean);
    const b = path.split('/').filter(Boolean);
    if (a.length !== b.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
      else if (a[i] !== b[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

export function navigate(to, opts = {}) {
  const url = to.startsWith('/app') ? to : `${BASE}${to === '/' ? '' : to}`;
  if (opts.replace) history.replaceState({}, '', url || BASE);
  else history.pushState({}, '', url || BASE);
  route();
}
window.medicardNavigate = navigate;

// Intercept in-app links: <a href="/medications" data-link>
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const href = a.getAttribute('href');
  if (!href || /^https?:/.test(href)) return;
  e.preventDefault();
  navigate(href);
});
window.addEventListener('popstate', () => route());

/** Admin „მოდულები“: an item is shown while its module runs (`anyOf`: while one of several does). */
function featureAllows(item) {
  if (item.anyOf) return item.anyOf.some((key) => featureOn(key));
  return !item.feature || featureOn(item.feature);
}

function visible(item) {
  if (!featureAllows(item)) return false;
  if (item.female && !isFemale()) return false;
  if (item.trainer && !isTrainer()) return false;
  return true;
}

function buildShell() {
  const side = h('aside', { class: 'side', 'aria-label': t('ნავიგაცია', 'Navigation') },
    h('a', { class: 'side-brand', href: '/', 'data-link': '' },
      h('img', { src: '/icon.png', alt: '' }),
      h('span', null, t('მედიქარდი', 'MEDICARD'), h('small', null, t('ჩემი ჯანმრთელობა', 'My health')))),
    h('nav', { class: 'side-nav' }, NAV.map((g) => [
      g.group ? h('div', { class: 'side-group' }, g.group) : null,
      g.items.filter(visible).map((it) => h('a', { class: 'nav-item', href: it.href, 'data-link': '', 'data-nav': it.href, title: it.label }, icon(it.icon, { size: 20 }), h('span', null, it.label))),
    ])),
    h('div', { class: 'side-foot' },
      h('a', { class: 'nav-item', href: '/profile', 'data-link': '', 'data-nav': '/profile', title: t('პროფილი', 'Profile') }, icon('settings', { size: 20 }), h('span', null, t('პროფილი და პარამეტრები', 'Profile and settings'))),
      h('a', { class: 'side-user', href: '/profile', 'data-link': '' },
        avatarEl(),
        h('div', { class: 'who' }, h('b', null, session.user?.fullName || t('მომხმარებელი', 'User')), h('span', null, session.user?.phone || session.user?.email?.replace(/@phone\.medicard\.ge$/, '') || '')))));

  const crumb = h('div', { class: 'crumb' });
  const themeBtn = iconButton(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', { title: t('თემის შეცვლა', 'Change theme'), onClick: () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    mount(themeBtn, icon(next === 'dark' ? 'sun' : 'moon', { size: 20 }));
  } });
  const top = h('div', { class: 'topbar' },
    h('a', { class: 'mobile-brand', href: '/', 'data-link': '' }, h('img', { src: '/icon.png', alt: '' }), t('მედიქარდი', 'MEDICARD')),
    crumb,
    h('div', { class: 'spacer' }),
    themeBtn,
    langToggle(),
    iconButton('logout', { title: t('გასვლა', 'Sign out'), onClick: () => { signOut(); navigate('/', { replace: true }); } }));
  const content = h('main', { class: 'content', id: 'main' });
  const bottom = h('nav', { class: 'bottom-nav', 'aria-label': t('ნავიგაცია', 'Navigation') },
    BOTTOM.filter(visible).map((it) => (it.menu
      ? h('a', { href: '#', role: 'button', onClick: (e) => { e.preventDefault(); openMenu(); } }, icon(it.icon, { size: 22 }), it.label)
      : h('a', { href: it.href, 'data-link': '', 'data-nav': it.href }, icon(it.icon, { size: 22 }), it.label))));
  const el = h('div', { class: 'shell' }, side, h('div', { class: 'main' }, top, content), bottom);
  return { el, content, crumb };
}

/** Top bar: one tap switches ქა ↔ EN (the page reloads in the other language). */
function langToggle() {
  const other = isEn ? 'ka' : 'en';
  return h('button', {
    type: 'button',
    class: 'lang-pill',
    lang: other,
    title: isEn ? 'ქართულად' : 'Switch to English',
    'aria-label': isEn ? 'ენის შეცვლა: ქართული' : 'Change language: English',
    onClick: () => setLang(other),
  }, h('span', { class: lang === 'ka' ? 'on' : '' }, 'ქა'), h('span', { class: lang === 'en' ? 'on' : '' }, 'EN'));
}

function avatarEl() {
  const a = h('span', { class: 'avatar' }, initials());
  return a;
}

function markNav(path) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const href = a.getAttribute('data-nav');
    const on = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

async function route() {
  const seq = ++renderSeq;
  const path = stripBase(location.pathname);
  const query = Object.fromEntries(new URLSearchParams(location.search));

  if (!getToken()) {
    shell = null;
    if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
    cleanup = null;
    const mod = await import('./auth.js');
    if (seq !== renderSeq) return;
    mod.renderAuth(root, { query, onDone: () => boot() });
    return;
  }

  if (!session.user) { await boot(); return; }

  if (needsOnboarding() && path !== '/profile') {
    shell = null;
    const mod = await import('./onboarding.js');
    if (seq !== renderSeq) return;
    mod.renderOnboarding(root, { onDone: () => { navigate('/', { replace: true }); } });
    return;
  }

  if (!shell) {
    shell = buildShell();
    mount(root, shell.el);
    offerAppOnIphone();
  }

  const m = match(path);
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;
  markNav(path);

  if (!m || !featureAllows(m.route)) {
    mount(shell.crumb, '');
    mount(shell.content, h('div', { class: 'page' }, h('div', { class: 'empty', style: { paddingTop: '80px' } },
      h('div', { class: 'empty-art' }, icon(m ? 'lock' : 'search', { size: 26 })),
      h('h3', null, m ? t('ეს სივრცე დროებით შეჩერებულია', 'This section is paused for now') : t('გვერდი ვერ მოიძებნა', 'Page not found')),
      h('p', null, m ? ((!isEn && session.featureMessages?.[m.route.feature || m.route.anyOf?.[0]]) || t('მალე ისევ ჩაირთვება.', 'It will be back soon.')) : t('შეამოწმე მისამართი ან დაბრუნდი მთავარზე.', 'Check the address or go back home.')),
      h('a', { class: 'btn btn-primary', href: '/', 'data-link': '' }, t('მთავარზე დაბრუნება', 'Back to home')))));
    return;
  }

  document.title = `${m.route.title} — ${t('მედიქარდი', 'MEDICARD')}`;
  mount(shell.crumb, m.route.title);
  const page = h('div', { class: 'page' });
  mount(shell.content, page);
  window.scrollTo({ top: 0 });
  try {
    const mod = await m.route.page();
    if (seq !== renderSeq) return;
    const result = await mod.default(page, {
      params: m.params,
      query,
      navigate,
      setTitle: (title) => { mount(shell.crumb, title); document.title = `${title} — ${t('მედიქარდი', 'MEDICARD')}`; },
    });
    if (seq !== renderSeq) { if (typeof result === 'function') result(); return; }
    cleanup = result;
  } catch (err) {
    console.error(err);
    if (seq !== renderSeq) return;
    mount(page, h('div', { class: 'error-box' }, icon('alert'), h('div', null, h('strong', null, t('გვერდი ვერ ჩაიტვირთა', 'Couldn’t load this page')), h('p', null, err?.message || ''))));
  }
}

async function boot() {
  applyTheme(getThemePref());
  if (!getToken()) { route(); return; }
  try {
    await loadSession();
  } catch (err) {
    if (!getToken()) { route(); return; }
    mount(root, h('div', { class: 'boot' }, h('div', { class: 'empty' },
      h('div', { class: 'empty-art' }, icon('alert', { size: 26 })),
      h('h3', null, t('კავშირი ვერ დამყარდა', 'Couldn’t connect')),
      h('p', null, err?.message || t('სცადე ხელახლა.', 'Please try again.')),
      h('button', { class: 'btn btn-primary', onClick: () => boot() }, t('ხელახლა', 'Retry')))));
    return;
  }
  shell = null;
  route();
}

onTokenChange((tok) => {
  if (!tok && session.user) {
    Object.assign(session, { user: null, profile: null });
    toast(t('სესია დასრულდა. შედი ხელახლა.', 'Your session ended. Please sign in again.'), 'info');
    shell = null;
    route();
  }
});

let lastName = '';
onSession(() => {
  // Rebuild the shell when name/gender change (nav + user card).
  const key = `${session.user?.fullName}|${session.user?.gender}|${isTrainer()}`;
  if (shell && lastName && key !== lastName) {
    const path = stripBase(location.pathname);
    const content = shell.content.firstChild;
    shell = buildShell();
    mount(root, shell.el);
    if (content) shell.content.appendChild(content);
    markNav(path);
  }
  lastName = key;
});

// Wake-up refresh: back to the tab after a while re-reads the session (flags, check-in).
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (getToken() && session.user && Date.now() - hiddenAt > 5 * 60_000) loadSession().catch(() => {});
});

clear(root);
root.appendChild(h('div', { class: 'boot' }, h('img', { class: 'boot-mark', src: '/icon.png', alt: t('მედიქარდი', 'MEDICARD') })));
boot();
