// MEDIBOOK business panel — boot, router and shell (medicard.ge/business).
// Vanilla ES modules on the /app toolkit: api.js (same /api + Bearer token), ui.js, i18n.js, session.js.
import { h, mount, icon, iconButton, select } from '/app/js/ui.js';
import { getToken, onTokenChange } from '/app/js/api.js';
import { t, isEn, lang, setLang } from '/app/js/i18n.js';
import { loadSession, session, signOut, applyTheme, featureOn } from '/app/js/session.js';
import { state, loadState, switchBusiness, onState, clearState, canManage, currentId } from './state.js';
import { avatar, dayLabel } from './shared.js';

const BASE = '/business';

const ROUTES = [
  { path: '/', page: () => import('./pages/dashboard.js'), title: t('მიმოხილვა', 'Overview'), icon: 'home', nav: true },
  { path: '/calendar', page: () => import('./pages/calendar.js'), title: t('კალენდარი', 'Calendar'), icon: 'calendar', nav: true },
  { path: '/appointments', page: () => import('./pages/appointments.js'), title: t('ჯავშნები', 'Bookings'), icon: 'calendarCheck', nav: true },
  { path: '/clients', page: () => import('./pages/clients.js'), title: t('კლიენტები', 'Clients'), icon: 'users', nav: true },
  { path: '/clients/:id', page: () => import('./pages/clients.js'), title: t('კლიენტი', 'Client') },
  { path: '/services', page: () => import('./pages/services.js'), title: t('სერვისები', 'Services'), icon: 'grid', nav: true },
  { path: '/team', page: () => import('./pages/team.js'), title: t('გუნდი', 'Team'), icon: 'userPlus', nav: true },
  { path: '/discounts', page: () => import('./pages/discounts.js'), title: t('ფასდაკლებები', 'Discounts'), icon: 'gift', nav: true, manage: true },
  { path: '/finance', page: () => import('./pages/finance.js'), title: t('ფინანსები', 'Finance'), icon: 'wallet', nav: true, manage: true },
  { path: '/analytics', page: () => import('./pages/analytics.js'), title: t('ანალიტიკა', 'Analytics'), icon: 'trendUp', nav: true, manage: true },
  { path: '/reviews', page: () => import('./pages/reviews.js'), title: t('შეფასებები', 'Reviews'), icon: 'star', nav: true },
  { path: '/settings', page: () => import('./pages/settings.js'), title: t('პარამეტრები', 'Settings'), icon: 'settings', nav: true, manage: true },
  { path: '/start', page: () => import('./pages/start.js'), title: t('ბიზნესის დამატება', 'Add a business'), bare: true },
];
const MOBILE_NAV = ['/', '/calendar', '/clients', '/services', '/analytics'];

let cleanup = null;
let shellEl = null;
let contentEl = null;
let crumbEl = null;
let booted = false;

function match(path) {
  for (const r of ROUTES) {
    const keys = [];
    const re = new RegExp(`^${r.path.replace(/\/$/, '').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}/?$`);
    const m = (path === '' ? '/' : path).match(re);
    if (m) return { route: r, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

function currentPath() {
  const p = location.pathname.replace(/\/+$/, '');
  return p === BASE || p === '' ? '/' : p.startsWith(`${BASE}/`) ? p.slice(BASE.length) : '/';
}

export function navigate(to, opts = {}) {
  const url = to.startsWith(BASE) ? to : `${BASE}${to === '/' ? '' : to}`;
  if (opts.replace) history.replaceState({}, '', url || BASE);
  else history.pushState({}, '', url || BASE);
  route();
}
window.medicardNavigate = navigate;

document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const href = a.getAttribute('href');
  // Links out of the panel (the web app, legal pages, external sites) are left to the browser; everything
  // else routes inside /business. `/app` is matched as a path, never as a prefix (/appointments is ours).
  if (!href || /^https?:/.test(href) || href === '/app' || href.startsWith('/app/') || href.startsWith('/privacy') || href.startsWith('/terms')) return;
  e.preventDefault();
  navigate(href.startsWith(BASE) ? href.slice(BASE.length) || '/' : href);
});
window.addEventListener('popstate', () => route());

function langToggle() {
  const other = isEn ? 'ka' : 'en';
  return h('button', { type: 'button', class: 'lang-pill', title: isEn ? 'ქართულად' : 'Switch to English', onClick: () => setLang(other) },
    h('span', { class: lang === 'ka' ? 'on' : '' }, 'ქა'), h('span', { class: lang === 'en' ? 'on' : '' }, 'EN'));
}

function wordmark() {
  return h('span', { class: 'wordmark' }, 'MEDI', h('b', null, 'BOOK'));
}

/** One quiet line under the business name: a dot and the state, instead of a badge shouting in the sidebar. */
function statusLine(status) {
  if (status === 'CLAIMED') return h('span', { class: 'is-ok' }, h('i'), t('ჩართულია აპში', 'Live in the app'));
  if (status === 'PENDING') return h('span', { class: 'is-warn' }, h('i'), t('განიხილება', 'Under review'));
  if (status === 'HIDDEN') return h('span', null, h('i'), t('დამალულია', 'Hidden'));
  return h('span', null, h('i'), t('კატალოგში', 'Listed'));
}

function buildShell() {
  const nav = ROUTES.filter((r) => r.nav && (!r.manage || canManage()));
  const biz = state.current?.business;
  const switcher = state.memberships.length > 1
    ? h('div', { class: 'bz-switch' }, select(state.memberships.map((m) => ({ value: m.business.id, label: m.business.name })), currentId(), { onChange: (e) => { switchBusiness(e.target.value); rebuildShell(); route(); } }))
    : null;
  const side = h('aside', { class: 'side', 'aria-label': t('ნავიგაცია', 'Navigation') },
    h('a', { class: 'side-brand', href: '/', 'data-link': '' }, h('img', { src: '/icon.png', alt: '' }), h('span', null, wordmark(), h('small', null, t('ბიზნესის პანელი', 'Business panel')))),
    biz ? h('div', { class: 'bz-biz' }, avatar(biz.name, 'var(--book)', 34), h('div', { class: 'who' }, h('b', null, biz.name), statusLine(biz.status))) : null,
    switcher,
    h('nav', { class: 'side-nav' }, nav.map((r) => h('a', { class: 'nav-item', href: r.path, 'data-link': '', 'data-nav': r.path, title: r.title }, icon(r.icon, { size: 20 }), h('span', null, r.title)))),
    h('div', { class: 'side-foot' },
      h('a', { class: 'nav-item', href: '/start?new=1', 'data-link': '', title: t('ბიზნესის დამატება', 'Add a business') }, icon('plus', { size: 20 }), h('span', null, t('სხვა ბიზნესის დამატება', 'Add another business'))),
      h('a', { class: 'side-user', href: 'https://medicard.ge/app/profile', target: '_blank', rel: 'noopener' },
        avatar(session.user?.fullName || '', 'var(--brand)', 34),
        h('div', { class: 'who' }, h('b', null, session.user?.fullName || t('მომხმარებელი', 'User')), h('span', null, session.user?.phone || session.user?.email?.replace(/@phone\.medicard\.ge$/, '') || '')))));
  crumbEl = h('div', { class: 'crumb' });
  const themeBtn = iconButton(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', { title: t('თემის შეცვლა', 'Change theme'), onClick: () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    mount(themeBtn, icon(next === 'dark' ? 'sun' : 'moon', { size: 20 }));
  } });
  const top = h('div', { class: 'topbar' },
    h('a', { class: 'mobile-brand', href: '/', 'data-link': '' }, h('img', { src: '/icon.png', alt: '' }), wordmark()),
    crumbEl,
    h('span', { class: 'bz-today' }, dayLabel(new Date(), { long: true })),
    h('div', { class: 'spacer' }),
    themeBtn,
    langToggle(),
    iconButton('logout', { title: t('გასვლა', 'Sign out'), onClick: () => { signOut(); clearState(); navigate('/', { replace: true }); } }));
  contentEl = h('main', { class: 'content wide', id: 'main' });
  const bottom = h('nav', { class: 'bottom-nav', 'aria-label': t('ნავიგაცია', 'Navigation') },
    MOBILE_NAV.map((p) => ROUTES.find((r) => r.path === p)).filter((r) => r && (!r.manage || canManage())).map((r) => h('a', { href: r.path, 'data-link': '', 'data-nav': r.path }, icon(r.icon, { size: 22 }), r.title)));
  shellEl = h('div', { class: 'shell' }, side, h('div', { class: 'main' }, top, contentEl, bottom));
  mount(document.getElementById('root'), shellEl);
}

function rebuildShell() { shellEl = null; buildShell(); }

function markNav(path) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const p = a.getAttribute('data-nav');
    a.classList.toggle('on', p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`));
  });
}

async function renderLanding() {
  cleanup?.();
  cleanup = null;
  shellEl = null;
  const mod = await import('./pages/landing.js');
  mod.renderLanding(document.getElementById('root'), { onSignedIn: () => boot() });
}

async function renderBare(route, params, query) {
  cleanup?.();
  cleanup = null;
  shellEl = null;
  const root = document.getElementById('root');
  const top = h('div', { class: 'bz-land-top' },
    h('a', { href: '/', 'data-link': '', style: { display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 } }, h('img', { src: '/icon.png', alt: '', style: { width: '32px', height: '32px', borderRadius: '9px' } }), wordmark()),
    h('div', { class: 'right' }, langToggle(), iconButton('logout', { title: t('გასვლა', 'Sign out'), onClick: () => { signOut(); clearState(); navigate('/', { replace: true }); } })));
  const content = h('main', { id: 'main' });
  mount(root, h('div', { class: 'bz-landing' }, top, content));
  const mod = await route.page();
  cleanup = await mod.default(content, { params, query, navigate, state, session });
}

async function route() {
  const path = currentPath();
  const url = new URL(location.href);
  const query = Object.fromEntries(url.searchParams.entries());
  if (!getToken()) return renderLanding();
  if (!session.user) {
    try { await loadSession(); } catch (e) { if (e?.status === 401) { signOut(); clearState(); return renderLanding(); } }
  }
  if (!featureOn('book')) {
    mount(document.getElementById('root'), h('div', { class: 'boot' }, h('div', { class: 'card', style: { maxWidth: '460px', textAlign: 'center' } },
      h('h2', null, 'MEDIBOOK'), h('p', { class: 'muted', style: { marginTop: '8px' } }, session.featureMessages?.book || t('MEDIBOOK დროებით შეჩერებულია.', 'MEDIBOOK is paused for a moment.')))));
    return;
  }
  if (!state.loaded) {
    try { await loadState(); } catch (e) { if (e?.status === 401) { signOut(); clearState(); return renderLanding(); } }
  }
  const found = match(path) || { route: ROUTES[0], params: {} };
  if (found.route.bare) return renderBare(found.route, found.params, query);
  if (!state.current) return navigate('/start', { replace: true });
  if (found.route.manage && !canManage()) return navigate('/', { replace: true });
  if (!shellEl) buildShell();
  document.title = `${found.route.title} · MEDIBOOK`;
  if (crumbEl) mount(crumbEl, found.route.title);
  markNav(path);
  cleanup?.();
  cleanup = null;
  mount(contentEl, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' }), h('div', { class: 'sk', style: { width: '60%' } })));
  try {
    const mod = await found.route.page();
    const result = await mod.default(contentEl, { params: found.params, query, navigate, state, session, refreshShell: rebuildShell });
    cleanup = typeof result === 'function' ? result : null;
  } catch (e) {
    console.error(e);
    mount(contentEl, h('div', { class: 'card' }, h('h3', null, t('გვერდი ვერ ჩაიტვირთა', 'The page could not load')), h('p', { class: 'muted' }, e?.message || '')));
  }
}

async function boot() {
  applyTheme();
  shellEl = null;
  state.loaded = false;
  await route();
}

onTokenChange((token) => { if (!token && booted) { clearState(); renderLanding(); } });
onState(() => { if (shellEl) { /* the sidebar re-renders on navigation */ } });
booted = true;
boot();
