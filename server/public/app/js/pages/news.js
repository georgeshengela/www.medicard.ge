// MEDICARD web — Home news („სიახლეები“): cards for Home and the /news/:id detail page.
// Same endpoints and rules as the app (mobile/src/lib/announcements.ts, app/news/[id].tsx).
import { h, mount, icon, button, empty, skeleton, errorBox, fmtDate } from '../ui.js';
import { get, post, ApiError } from '../api.js';
import { featureOn } from '../session.js';

const CSS = '/app/css/news.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

const TONES = new Set(['teal', 'violet', 'amber', 'rose', 'blue', 'green', 'sky']);
const toneOf = (t) => (TONES.has(t) ? t : 'teal');

/* ── Receipts: view / click / dismiss, at most once per card and kind per page load. Never throws. ── */
const sent = new Set();
export function trackAnnouncement(id, type) {
  const key = `${type}:${id}`;
  if (!id || sent.has(key)) return;
  sent.add(key);
  post(`/api/announcements/${encodeURIComponent(id)}/events`, { type }).catch(() => sent.delete(key));
}

/* ── Routes: the admin picks an allow-listed app route; the web opens its own page when one exists. ── */
const ROUTE_ROOTS = [
  '(tabs)', 'assistant', 'cycle', 'nutrition', 'pets', 'medipulsi', 'run', 'medi-quest', 'community',
  'pharmacy', 'trainer', 'visits', 'lab', 'symptoms', 'health-metrics', 'medications', 'record',
  'profile', 'explore', 'weather', 'week', 'module', 'news',
];
const ROUTE_RE = /^\/[A-Za-z0-9()_\-/]*(\?[A-Za-z0-9_\-=&%.]*)?$/;

function isAllowedAppRoute(target) {
  const value = String(target || '').trim();
  if (!ROUTE_RE.test(value) || value.includes('//')) return false;
  return ROUTE_ROOTS.includes(value.slice(1).split(/[/?]/)[0]);
}

const FEATURE_OF = { '/medi': 'medi', '/cycle': 'cycle', '/nutrition': 'nutrition', '/pets': 'pets', '/quest': 'quest', '/news': 'news' };

/** App route → web route (or null when the web has no such page). */
export function webRouteFor(target) {
  if (!isAllowedAppRoute(target)) return null;
  const [path] = String(target).split('?');
  const parts = path.split('/').filter(Boolean);
  const root = parts[0];
  let out = null;
  switch (root) {
    case '(tabs)': {
      const tab = parts[1] || 'home';
      out = { home: '/', profile: '/profile', medications: '/medications', records: '/records', card: '/records' }[tab] || null;
      break;
    }
    case 'assistant': out = '/medi'; break;
    case 'cycle': out = '/cycle'; break;
    case 'nutrition': out = '/nutrition'; break;
    case 'medi-quest': out = '/quest'; break;
    case 'visits': out = '/visits'; break;
    case 'lab': out = '/lab'; break;
    case 'health-metrics': out = '/health'; break;
    case 'profile': out = '/profile'; break;
    case 'record': out = '/records'; break;
    case 'medications': out = parts[1] && /^[\w-]{8,}$/.test(parts[1]) ? `/medications/${parts[1]}` : '/medications'; break;
    case 'pets': out = parts[1] && /^[0-9a-f-]{36}$/i.test(parts[1]) ? `/pets/${parts[1]}` : '/pets'; break;
    case 'news': out = parts[1] ? `/news/${encodeURIComponent(parts[1])}` : null; break;
    default: out = null;
  }
  if (!out) return null;
  const feature = FEATURE_OF[`/${out.split('/')[1]}`];
  if (feature && !featureOn(feature)) return null;
  return out;
}

/** The button is shown only when it can actually go somewhere. */
function usableCta(card) {
  const cta = card?.cta;
  if (!cta?.label || !cta.target) return null;
  if (cta.kind === 'route') {
    const href = webRouteFor(cta.target);
    return href ? { label: cta.label, href, external: false } : null;
  }
  if (cta.kind === 'url') {
    try {
      const u = new URL(cta.target);
      return u.protocol === 'https:' ? { label: cta.label, href: u.href, external: true } : null;
    } catch { return null; }
  }
  return null;
}

/** Server paths (`/api/announcements/image/…`) and https URLs only. The image route is public. */
function imageSrc(image) {
  if (!image) return null;
  if (image.startsWith('/api/announcements/image/')) return image;
  return image.startsWith('https://') ? image : null;
}

function detailParagraphs(card) {
  const text = String(card.details || card.body || '').replace(/\r\n/g, '\n').trim();
  return text ? text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];
}

function go(href) {
  if (typeof window.medicardNavigate === 'function') window.medicardNavigate(href);
  else location.assign(`/app${href === '/' ? '' : href}`);
}

function openCta(card, cta) {
  trackAnnouncement(card.id, 'click');
  if (cta.external) window.open(cta.href, '_blank', 'noopener');
  else go(cta.href);
}

/* ── Home ─────────────────────────────────────────── */
const listCache = { list: null };
const dismissed = new Set();

/** Live Home cards for the signed-in person (same endpoint as the app). Never throws. */
export async function loadNews() {
  if (!featureOn('news')) return [];
  try {
    const res = await get('/api/announcements', { placement: 'home' });
    const list = Array.isArray(res?.announcements) ? res.announcements : [];
    listCache.list = list;
    return list.filter((a) => !dismissed.has(a.id)).slice(0, 5);
  } catch {
    return [];
  }
}

/** Up to 5 news cards. Flat surface cards; the admin's tone only tints badge, tile and button. */
export function newsCards(list) {
  ensureCss();
  const items = (list || []).filter((a) => a && !dismissed.has(a.id)).slice(0, 5);
  const wrap = h('div', { class: `news-cards ${items.length > 1 ? 'many' : ''}` });
  const hideIfEmpty = () => {
    if (wrap.children.length) return;
    const sec = wrap.closest('.hub-section');
    (sec || wrap).remove();
  };
  for (const item of items) {
    const el = newsCard(item, () => {
      dismissed.add(item.id);
      trackAnnouncement(item.id, 'dismiss');
      el.remove();
      hideIfEmpty();
    });
    wrap.appendChild(el);
  }
  return wrap;
}

function newsCard(item, onDismiss) {
  const tone = toneOf(item.tone);
  const src = imageSrc(item.image);
  const cta = usableCta(item);
  const openDetails = () => { trackAnnouncement(item.id, 'click'); go(`/news/${encodeURIComponent(item.id)}`); };

  const img = src ? h('img', { class: 'news-img', src, alt: '', loading: 'lazy', onError: () => { img.remove(); tileSlot.hidden = false; } }) : null;
  const tileSlot = h('span', { class: `tile ink-${tone} news-tile`, hidden: Boolean(src) }, icon('megaphone', { size: 20 }));

  const el = h('article', { class: 'card news-card hover', role: 'link', tabindex: '0', 'aria-label': `${item.badge || 'სიახლე'}. ${item.title}`,
    onClick: (e) => { if (!e.target.closest('button,a')) openDetails(); },
    onKeydown: (e) => { if (e.key === 'Enter' && e.target === el) openDetails(); } },
  img,
  h('div', { class: 'news-body' },
    h('div', { class: 'news-head' },
      tileSlot,
      h('div', { class: 'news-text' },
        h('span', { class: `news-badge ink-${tone}` }, item.badge || 'სიახლე'),
        h('h3', { class: 'news-title' }, item.title),
        item.body ? h('p', { class: 'news-sub' }, item.body) : null)),
    h('button', { type: 'button', class: `news-cta ink-${tone}`, onClick: (e) => { e.stopPropagation(); if (cta) openCta(item, cta); else openDetails(); } },
      h('span', null, cta ? cta.label : 'დეტალურად'), icon(cta?.external ? 'externalLink' : 'arrowRight', { size: 16 }))),
  item.dismissible ? h('button', { type: 'button', class: `news-close ${src ? 'on-image' : ''}`, 'aria-label': 'სიახლის დამალვა', title: 'დამალვა', onClick: (e) => { e.stopPropagation(); onDismiss(); } }, icon('x', { size: 16 })) : null);

  // First sighting counts as a view, like the app's card mount.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { trackAnnouncement(item.id, 'view'); io.disconnect(); }
    });
    requestAnimationFrame(() => io.observe(el));
  } else {
    trackAnnouncement(item.id, 'view');
  }
  return el;
}

/* ── /news/:id ────────────────────────────────────── */
export default async function newsPage(root, ctx) {
  ensureCss();
  const id = String(ctx.params.id || '');
  const peek = listCache.list?.find((a) => a.id === id) || null;
  const body = h('div', { class: 'news-page' });
  mount(root,
    h('a', { class: 'back', href: '/', 'data-link': '' }, icon('chevronLeft', { size: 16 }), 'მთავარი'),
    body);

  if (peek) render(peek);
  else mount(body, skeleton(5));

  try {
    const res = await get(`/api/announcements/${encodeURIComponent(id)}`);
    if (res?.announcement) render(res.announcement);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) gone(true);
    else if (!peek) mount(body, errorBox(e, () => newsPage(root, ctx)));
  }

  function gone(isGone) {
    mount(body, h('div', { class: 'card' }, empty(
      isGone ? 'ეს სიახლე აღარ არის აქტიური' : 'სიახლე ვერ ჩაიტვირთა',
      isGone ? 'ღონისძიება დასრულდა ან სიახლე მოიხსნა.' : 'შეამოწმე ინტერნეტი და სცადე ხელახლა.',
      button('მთავარზე დაბრუნება', { href: '/' }))));
  }

  function render(card) {
    ctx.setTitle?.(card.title || 'სიახლე');
    const tone = toneOf(card.tone);
    const src = imageSrc(card.image);
    const cta = usableCta(card);
    const dates = [
      card.publishedAt ? fmtDate(card.publishedAt, { year: true }) : '',
      card.endsAt ? `აქტიურია ${fmtDate(card.endsAt, { year: true })}-მდე` : '',
    ].filter(Boolean).join(' · ');
    const img = src ? h('img', { class: 'news-hero', src, alt: '', onError: () => img.remove() }) : null;
    mount(body,
      h('article', { class: 'card pad-lg news-detail' },
        img,
        h('div', { class: 'stack', style: { gap: '10px' } },
          h('span', { class: `news-badge ink-${tone}` }, card.badge || 'სიახლე'),
          h('h1', { class: 'news-detail-title' }, card.title),
          dates ? h('div', { class: 'faint', style: { fontSize: '13px' } }, dates) : null),
        card.details && card.body ? h('p', { class: 'news-lead' }, card.body) : null,
        detailParagraphs(card).map((p) => h('p', { class: 'news-para' }, p)),
        cta ? h('div', { class: 'news-actions' },
          h('button', { type: 'button', class: `btn btn-primary btn-lg news-main-cta ink-${tone}`, onClick: () => openCta(card, cta) },
            h('span', null, cta.label), icon(cta.external ? 'externalLink' : 'arrowRight', { size: 18 }))) : null));
  }
}
