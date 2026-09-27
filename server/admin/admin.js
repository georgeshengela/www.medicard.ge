const API = '';
const TOKEN_KEY = 'medicard.admin.token';
const THEME_KEY = 'medicard.admin.theme';
const EMAIL_KEY = 'medicard.admin.email';
const TAB_KEY = 'medicard.admin.tab';
const USERS_PAGE_SIZE = 15;
const PAGE_SIZE = 25;
const ADMIN_TABS = ['overview', 'orders', 'users', 'push', 'sms', 'pharmacy', 'rewards', 'ai', 'health', 'audit', 'quality', 'testing', 'nutrition', 'community', 'medipulsi', 'poster-studio', 'settings', 'features', 'quests', 'funnel', 'email'];

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  admin: null,
  tab: sessionStorage.getItem(TAB_KEY) || 'overview',
  users: [],
  total: 0,
  offset: 0,
  sortKey: 'createdAt',
  sortDir: 'desc',
  selectedId: null,
  userPageId: null,
};

const $ = (id) => document.getElementById(id);

const ICONS = {
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15"/>',
  award: '<circle cx="12" cy="8" r="5"/><path d="m8 12-2 10 6-3 6 3-2-10"/>',

  layout: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  pill: '<path d="m10.5 20.5-8-8a5 5 0 0 1 7-7l8 8a5 5 0 0 1-7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  arrow: '<polyline points="9 18 15 12 9 6"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  link: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  spark: '<path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z"/><path d="M5 17l.8 2.8L8.6 21l-2.8.8L5 24l-.8-2.2L1.4 21l2.8-.8L5 17z"/>',
  gift: '<path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
};

function icon(name, size = '') {
  return `<svg class="icon ${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.activity}</svg>`;
}

function iconTile(name, tone = '') {
  return `<div class="icon-tile ${tone}">${icon(name, 'md')}</div>`;
}

function v25StripCell(iconName, label, value, hint, extra = '') {
  return `<article class="v25-strip-cell${extra}">
    <span class="v25-strip-top"><span class="v25-health-ico">${icon(iconName)}</span><span>${label}</span></span>
    <strong>${value}</strong>
    ${hint != null && hint !== '' ? `<em>${hint}</em>` : ''}
  </article>`;
}

function tableActionCell(innerHtml) {
  return `<td class="col-actions"><div class="row-actions">${innerHtml}</div></td>`;
}

function injectIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.querySelector('svg.icon')?.remove();
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });
}

function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  const btn = $('theme-toggle');
  if (btn) {
    btn.dataset.icon = next === 'dark' ? 'sun' : 'moon';
    btn.title = next === 'dark' ? 'ღია თემა' : 'მუქი თემა';
    btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = icon(btn.dataset.icon);
  }
}

applyTheme(localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

async function api(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
  };
  let res;
  try {
    res = await fetch(`${API}/api/admin${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkErr) {
    const err = new Error('სერვერთან კავშირი ვერ დამყარდა.');
    err.status = 0;
    err.cause = networkErr;
    throw err;
  }
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) {
    const retryRaw = res.headers.get('Retry-After');
    const retryAfterSeconds = Number(
      (Number.isFinite(Number(retryRaw)) && Number(retryRaw) >= 0 ? retryRaw : null) ??
        data.retryAfterSeconds ??
        60,
    );
    const err = new Error(data.error || 'შეცდომა');
    err.status = res.status;
    if (res.status === 429) {
      err.retryAfterSeconds = Math.max(1, Math.floor(retryAfterSeconds) || 60);
      err.code = data.code || 'RATE_LIMITED';
      adminRateLimitedUntil = Date.now() + err.retryAfterSeconds * 1000;
      err.message = `ძალიან ბევრი მოთხოვნა. გთხოვთ, დაელოდოთ ${err.retryAfterSeconds} წამს.`;
    }
    if ((res.status === 401 || res.status === 403) && path !== '/login' && state.token) {
      logout('სესია ამოიწურა. თავიდან შეხვიდე.');
    }
    throw err;
  }
  return data;
}

let adminRateLimitedUntil = 0;
let lastAdminRateToastAt = 0;

async function apiRetry(path, tries = 3) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await api(path);
    } catch (err) {
      last = err;
      if (err.status === 401 || err.status === 403 || err.status === 429) throw err;
      await new Promise((resolve) => setTimeout(resolve, 350 * (i + 1)));
    }
  }
  throw last;
}

function toast(message, kind = 'ok', opts) {
  if (kind === 'bad' && /ძალიან ბევრი მოთხოვნა/.test(String(message || ''))) {
    if (Date.now() - lastAdminRateToastAt < 8000) return;
    lastAdminRateToastAt = Date.now();
  }
  if (window.AdminV3?.toast) return window.AdminV3.toast(message, kind, opts);
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'bad' ? 'alert' : 'check')} ${escapeHtml(message)}`;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function show(view) {
  document.documentElement.dataset.ready = view;
  $('login-view').classList.toggle('hidden', view !== 'login');
  $('app-view').classList.toggle('hidden', view !== 'app');
}

function rememberAdmin(admin, token) {
  if (token) {
    state.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }
  if (admin) {
    state.admin = admin;
    localStorage.setItem(EMAIL_KEY, admin.email || '');
    const chip = $('admin-chip');
    if (chip) chip.innerHTML = `${icon('user')}${escapeHtml(admin.email || '')}`;
    const avatar = $('sidebar-avatar');
    if (avatar) {
      const seed = admin.fullName || admin.email || 'M';
      avatar.textContent = initials(seed).slice(0, 1) || 'M';
      avatar.title = admin.email || 'ადმინისტრატორი';
    }
  }
}

function logout(reason) {
  $('tab-poster-studio')?.replaceChildren();
  disconnectAdminRealtime();
  state.token = '';
  state.admin = null;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TAB_KEY);
  show('login');
  if (reason) toast(reason, 'bad');
}

function closeDrawer() {
  const drawer = $('drawer');
  drawer.classList.add('hidden');
  drawer.classList.remove('is-modal', 'is-wide');
  drawer.setAttribute('aria-hidden', 'true');
  $('drawer-body').innerHTML = '';
  document.body.classList.remove('modal-open');
  if (window.AdminV3) {
    window.AdminV3.setDirty(false);
    window.AdminV3.overlayMode = null;
    window.AdminV3.releaseFocus?.();
  }
}

function openDrawer(html, opts = {}) {
  const drawer = $('drawer');
  const panel = $('drawer-body');
  panel.innerHTML = html;
  drawer.classList.toggle('is-modal', Boolean(opts.modal));
  drawer.classList.toggle('is-wide', Boolean(opts.wide));
  drawer.classList.remove('hidden');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.toggle('modal-open', Boolean(opts.modal));
  if (window.AdminV3?.adaptLegacyDrawer) window.AdminV3.adaptLegacyDrawer(opts);
}

const MONTHS_KA = [
  'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
  'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი',
];
const MONTHS_KA_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const WEEKDAYS_KA = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const WEEKDAYS_KA_SHORT = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];

function adminDateParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const map = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const weekdayKey = String(map.weekday || '').slice(0, 2).toLowerCase();
  const weekday = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 }[weekdayKey];
  return {
    year: Number(map.year),
    month: Number(map.month) - 1,
    day: Number(map.day),
    hour: String(map.hour || '00').padStart(2, '0'),
    minute: String(map.minute || '00').padStart(2, '0'),
    weekday: weekday ?? 0,
  };
}

function fmtDate(value) {
  const p = adminDateParts(value);
  if (!p) return '—';
  return `${p.day} ${MONTHS_KA[p.month]}, ${p.year}, ${p.hour}:${p.minute}`;
}

function fmtDateShort(value) {
  const p = adminDateParts(value);
  if (!p) return '—';
  return `${p.day} ${MONTHS_KA[p.month]}, ${p.year}`;
}

function timelineDayKa(value) {
  if (!value) return 'უცნობია';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'უცნობია';
  const start = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((start(new Date()) - start(date)) / 86400000);
  if (diff === 0) return 'დღეს';
  if (diff === 1) return 'გუშინ';
  return fmtDateShort(value);
}

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function initials(name) {
  return String(name || '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function setPageHeader(tab, copy) {
  if (window.AdminV3?.syncHeader) {
    window.AdminV3.syncHeader(tab, copy);
    return;
  }
  const greetEl = $('page-greeting');
  const subEl = $('page-subtitle');
  if (greetEl) greetEl.textContent = copy[tab][1];
  if (subEl) subEl.textContent = copy[tab][2];
}

function statusBadge(status) {
  return status === 'BLOCKED'
    ? '<span class="badge bad">დაბლოკილი</span>'
    : '<span class="badge ok">შესვლა დაშვებულია</span>';
}

function fmtRelative(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 0) return fmtDateShort(value);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ახლახან';
  if (min < 60) return `${min} წთ წინ`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} სთ წინ`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'გუშინ';
  if (day < 7) return `${day} დღის წინ`;
  if (day < 30) return `${Math.floor(day / 7)} კვ. წინ`;
  return fmtDateShort(value);
}

function usersStatusCell(status) {
  const blocked = status === 'BLOCKED';
  return `<span class="users-live ${blocked ? 'is-blocked' : 'is-active'}"><i></i>${blocked ? 'დაბლოკილი' : 'შესვლა დაშვებულია'}</span>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}

function onOffLabel(on) {
  return on ? 'ჩართ.' : 'გამორთ.';
}

function formatUsd(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

let lastLiveSettings = null;
let adminSocketLive = null;

function liveCountLabel() {
  const n = window.__opsLiveSnap?.onlineNow;
  if (n == null || n === '') return 'ცოცხალი';
  const formatted = typeof opsFmt === 'function' ? opsFmt(n) : String(n);
  return `ცოცხალი · ${formatted}`;
}

function setLivePill(settings) {
  const pill = $('live-pill');
  if (!pill) return;
  if (settings) lastLiveSettings = settings;
  const s = settings || lastLiveSettings;
  if (s?.maintenanceMode) {
    pill.className = 'status-pill bad';
    pill.innerHTML = `${icon('alert')} ოფლაინი · განახლება`;
    return;
  }
  if (s?.forceUpdate) {
    pill.className = 'status-pill warn';
    pill.innerHTML = `${icon('zap')} იძულებითი განახლება`;
    return;
  }
  if (adminSocketLive === false) {
    pill.className = 'status-pill warn';
    pill.innerHTML = `${icon('alert')} კავშირი დაიკარგა`;
    return;
  }
  pill.className = 'status-pill ok';
  pill.innerHTML = `${icon('check')} ${liveCountLabel()}`;
}

async function boot() {
  injectIcons();
  const cachedEmail = localStorage.getItem(EMAIL_KEY);
  if (state.token && cachedEmail && $('admin-chip')) {
    $('admin-chip').innerHTML = `${icon('user')}${escapeHtml(cachedEmail)}`;
  }
  $('login-form').addEventListener('submit', onLogin);
  $('logout').addEventListener('click', () => logout());
  $('theme-toggle').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  document.querySelectorAll('.nav').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.body.classList.remove('sidebar-open');
      if (window.AdminV3?.dirty) {
        const ok = await window.AdminV3.confirmLeave();
        if (!ok) return;
        closeDrawer();
      }
      switchTab(btn.dataset.tab);
    });
  });
  window.addEventListener('beforeunload', (e) => {
    if (!window.AdminV3?.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
  window.addEventListener('hashchange', () => {
    if (unknownAdminRoute()) {
      showMissingRoute();
      return;
    }
    const tab = tabFromHash();
    const userId = userIdFromHash();
    if (!tab) return;
    if (tab !== state.tab) switchTab(tab, { skipHash: true });
    else if (tab === 'users' && userId !== state.userPageId) renderUsers();
    else if (tab === 'health' && typeof renderHealthOps === 'function') renderHealthOps();
    else if (tab === 'rewards' && typeof renderRewards === 'function') renderRewards();
    else if (tab === 'medipulsi' && typeof renderMedipulsi === 'function') renderMedipulsi();
  });
  $('drawer-backdrop').addEventListener('click', async () => {
    if (window.AdminV3?.requestCloseOverlay) {
      const ok = await window.AdminV3.requestCloseOverlay();
      if (!ok) return;
    }
    closeDrawer();
  });
  $('sidebar-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
  $('sidebar-scrim')?.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      if (window.AdminV3?.confirmOpen) return;
      if ($('ops-palette')) {
        $('ops-palette').remove();
        return;
      }
      if (window.AdminV3?.requestCloseOverlay) {
        const ok = await window.AdminV3.requestCloseOverlay();
        if (!ok) return;
      }
      closeDrawer();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (typeof renderCommandPalette === 'function') renderCommandPalette();
      else $('user-q')?.focus();
    }
  });

  if (!state.token) {
    show('login');
    return;
  }

  show('app');
  connectAdminRealtime();
  try {
    const me = await apiRetry('/me');
    rememberAdmin(me.admin);
    if (unknownAdminRoute()) showMissingRoute();
    else await switchTab(resolveAdminTab(), { skipHash: true });
  } catch (err) {
    if (err.status === 401 || err.status === 403) return;
    toast(err.message || 'სერვერთან კავშირი ვერ დამყარდა.', 'bad');
    try {
      if (unknownAdminRoute()) showMissingRoute();
      else await switchTab(resolveAdminTab(), { skipHash: true });
    } catch { /* keep chrome visible */ }
  }
}

function hashPath() {
  return (location.hash || '').replace(/^#\/?/, '').split('?')[0];
}

function tabFromHash() {
  const tab = hashPath().split('/')[0];
  return ADMIN_TABS.includes(tab) ? tab : null;
}

function unknownAdminRoute() {
  const path = hashPath();
  if (!path) return false;
  const tab = path.split('/')[0];
  return Boolean(tab) && !ADMIN_TABS.includes(tab);
}

function showMissingRoute() {
  state.tab = 'missing';
  document.querySelectorAll('.nav').forEach((btn) => btn.classList.remove('active'));
  document.querySelectorAll('.panel').forEach((panel) => {
    const on = panel.id === 'tab-missing';
    panel.classList.toggle('hidden', !on);
    panel.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  const greetEl = $('page-greeting');
  const subEl = $('page-subtitle');
  if (greetEl) greetEl.textContent = 'გვერდი ვერ მოიძებნა';
  if (subEl) subEl.textContent = 'ეს მისამართი ადმინ კონსოლში არ არსებობს.';
  const kicker = $('page-kicker');
  if (kicker) kicker.textContent = 'Admin';
}

function userIdFromHash() {
  const parts = hashPath().split('/').filter(Boolean);
  if (parts[0] === 'users' && parts[1]) return decodeURIComponent(parts[1]);
  return hashSearch().get('user');
}

function hashSearch() {
  return new URLSearchParams((location.hash || '').split('?')[1] || '');
}

function usersListHref() {
  const params = new URLSearchParams();
  if (typeof opsState !== 'undefined' && opsState.range) {
    params.set('range', opsState.range);
    if (opsState.range === 'custom') {
      if (opsState.from) params.set('from', opsState.from);
      if (opsState.to) params.set('to', opsState.to);
    }
  }
  const qs = params.toString();
  return qs ? `#/users?${qs}` : '#/users';
}

function userPageHref(id, profileTab) {
  const params = new URLSearchParams();
  if (typeof opsState !== 'undefined' && opsState.range) {
    params.set('range', opsState.range);
    if (opsState.range === 'custom') {
      if (opsState.from) params.set('from', opsState.from);
      if (opsState.to) params.set('to', opsState.to);
    }
  }
  if (profileTab) params.set('profileTab', profileTab);
  const qs = params.toString();
  return `#/users/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`;
}

function resolveAdminTab() {
  return tabFromHash() || (ADMIN_TABS.includes(state.tab) ? state.tab : 'overview');
}

function writeTabHash(tab, query) {
  const params = query instanceof URLSearchParams
    ? query
    : new URLSearchParams(query && typeof query === 'object' ? query : {});
  const inheritOpsRange = !['medipulsi', 'poster-studio'].includes(tab);
  if (inheritOpsRange && typeof opsState !== 'undefined' && opsState.range && !params.get('range')) {
    params.set('range', opsState.range);
    if (opsState.range === 'custom') {
      if (opsState.from) params.set('from', opsState.from);
      if (opsState.to) params.set('to', opsState.to);
    }
  }
  if (tab === 'overview' && typeof opsState !== 'undefined' && opsState.grain && !params.get('grain')) {
    params.set('grain', opsState.grain);
  }
  const qs = params.toString();
  const next = qs ? `#/${tab}?${qs}` : `#/${tab}`;
  if (location.hash !== next) history.replaceState({ tab }, '', next);
}

async function onLogin(e) {
  e.preventDefault();
  $('login-error').classList.add('hidden');
  try {
    const data = await api('/login', {
      method: 'POST',
      body: {
        email: $('login-email').value.trim(),
        password: $('login-password').value,
      },
    });
    rememberAdmin(data.admin, data.token);
    show('app');
    connectAdminRealtime();
    await switchTab('overview');
  } catch (err) {
    $('login-error').textContent = err.message;
    $('login-error').classList.remove('hidden');
  }
}

async function switchTab(tab, opts = {}) {
  if (!ADMIN_TABS.includes(tab) || !$(`tab-${tab}`)) tab = 'overview';
  $('tab-missing')?.classList.add('hidden');
  state.tab = tab;
  sessionStorage.setItem(TAB_KEY, tab);
  if (opts.hashQuery) writeTabHash(tab, opts.hashQuery);
  else if (!opts.skipHash || !tabFromHash()) writeTabHash(tab);
  document.querySelectorAll('.nav').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.panel').forEach((panel) => {
    const on = panel.id === `tab-${tab}`;
    panel.classList.toggle('hidden', !on);
    panel.setAttribute('aria-hidden', on ? 'false' : 'true');
  });

  const copy = {
    overview: ['Overview', 'ოპერაციები', 'რა საჭიროებს ყურადღებას ახლა?', 'overview.status'],
    health: ['Health & Medi', 'ჯანმრთელობა', 'რომელი ჯანმრთელობის ფიჩერები გამოიყენება და ინახება?', 'health.page'],
    audit: ['Production', 'აუდიტი', 'ვინ შეცვალა რა და როდის?', 'audit.page'],
    quality: ['Production', 'ხარისხი', 'ვერსიები, ტელემეტრია და მონაცემები სანდოა?', 'quality.page'],
    nutrition: ['Health', 'კვების დღიური', 'გამოყენება, ფოტოს შეფასება და სერვისის მართვა.', ''],
    community: ['Engagement', 'ქალების სივრცე', 'მოდერაცია, საჩივრები და წევრების უსაფრთხოება.', ''],
    testing: ['Production', 'ტესტირების სივრცე', 'ეტაპები, შედეგები და დაცული სქრინები.', 'quality.page'],
    'poster-studio': ['MEDICARD Studio', 'პოსტერების სტუდია', 'შეცვალე წარწერები და მოამზადე პოსტები სოციალური ქსელებისთვის.', ''],
    'medipulsi': ['Engagement', 'MEDIRUN', 'გასეირნება, მისიები, აღმოჩენები და ჯილდოების მართვა.', ''],
    orders: ['Operations', 'შეკვეთები', 'რა საჭიროებს ოპერაციულ დამუშავებას?', 'orders.page'],
    users: ['People', 'მომხმარებლები', 'ვინ არის ბაზაში, რა ანგარიშის მდგომარეობა აქვს და ვისი გამოძიება გჭირდება.', 'users.registry'],
    push: ['Engagement', 'Push & Brain', 'შეტყობინებები ფასდება, იგეგმება და მიეწოდება?', 'push.page'],
    sms: ['Operations', 'SMS', 'გაგზავნა, ბალანსი და ჟურნალი.', 'sms.page'],
    pharmacy: ['Operations', 'ფარმაცია', 'სინქი, მდგომარეობა და შეცდომები.', 'pharmacy.page'],
    rewards: ['Commerce', 'ჯილდოები', 'მუშაობს თუ არა ჯილდოების სისტემა ნორმალურად?', 'rewards.page'],
    ai: ['Health & Medi', 'Medi', 'მუშაობს თუ არა Medi საიმედოდ და უსაფრთხოდ?', 'medi.page'],
    settings: ['Production', 'აპის რეჟიმი', 'რა წარმოების ქცევაა ჩართული?', 'settings.page'],
    features: ['Production', 'მოდულები', 'რომელი მოდული მუშაობს და რომელი შეჩერებულია?', ''],
    quests: ['Engagement', 'Medi Quest', 'მისიები, სამიზნეები და Medi Coins ჯილდოები.', ''],
    funnel: ['Growth', 'ფუნელი', 'ინსტალაციიდან რეგისტრაციამდე, პირველ ქმედებამდე და დაბრუნებამდე.', ''],
    email: ['Engagement', 'ელფოსტა', 'სისტემური წერილები, კამპანიები და მიწოდება.', ''],
  };
  setPageHeader(tab, copy);

  const painted = tabPanelIsPainted(tab);
  if (tab === 'overview') {
    if (painted) {
      if (typeof window.refreshCommandCenterLive === 'function') void window.refreshCommandCenterLive();
    } else if (typeof renderCommandCenter === 'function') await renderCommandCenter();
    else if ($('tab-overview')) $('tab-overview').innerHTML = '<p role="alert">Command Center ვერ ჩაიტვირთა. განაახლე გვერდი.</p>';
  } else if (!painted) {
    if (tab === 'orders') await renderOrders();
    if (tab === 'users') await renderUsers();
    if (tab === 'push') await renderPush();
    if (tab === 'sms') await renderSms();
    if (tab === 'pharmacy') await renderPharmacy();
    if (tab === 'rewards' && typeof renderRewards === 'function') await renderRewards();
    if (tab === 'ai') await renderAi();
    if (tab === 'health' && typeof renderHealthOps === 'function') await renderHealthOps();
    if (tab === 'audit' && typeof renderAuditLog === 'function') await renderAuditLog();
    if (tab === 'quality' && typeof renderQualityOps === 'function') await renderQualityOps();
    if (tab === 'nutrition' && typeof renderNutrition === 'function') await renderNutrition();
    if (tab === 'community' && typeof renderCommunity === 'function') await renderCommunity();
    if (tab === 'testing' && typeof renderTesting === 'function') await renderTesting();
    if (tab === 'medipulsi' && typeof renderMedipulsi === 'function') await renderMedipulsi();
    if (tab === 'poster-studio') await window.renderPosterStudio();
    if (tab === 'settings') await renderSettings();
    if (tab === 'features' && typeof renderFeatures === 'function') await renderFeatures();
    if (tab === 'quests' && typeof renderQuests === 'function') await renderQuests();
    if (tab === 'funnel' && typeof renderFunnel === 'function') await renderFunnel();
    if (tab === 'email' && typeof renderEmailAdmin === 'function') await renderEmailAdmin();
  }
  startAdminLive();
}

function tabPanelIsPainted(tab) {
  const root = $(`tab-${tab}`);
  if (!root || !root.childElementCount) return false;
  if (tab === 'overview') return Boolean(root.querySelector('[data-cc="v3"], .ops-board, .ng-dash'));
  if (root.querySelector('[class*="skel"]')) return false;
  const empty = root.querySelector('.empty');
  if (empty && !root.querySelector('table, .v3-module, .v25-panel, form')) return false;
  return true;
}

let adminLiveTimer = null;
let adminLastScrollAt = 0;
const ADMIN_LIVE_MS = 8000;
document.addEventListener('scroll', () => { adminLastScrollAt = Date.now(); }, true);

function adminIsTyping() {
  const el = document.activeElement;
  return Boolean(el && el.matches?.('input, textarea, select, [contenteditable="true"]'));
}

function startAdminLive() {
  if (adminLiveTimer) return;
  adminLiveTimer = setInterval(() => {
    if (document.hidden || adminIsTyping() || !state.token) return;
    if (Date.now() < adminRateLimitedUntil) return;
    if (Date.now() - adminLastScrollAt < 4000) return;
    refreshAdminLive().catch((err) => {
      if (err?.status === 429) return;
    });
  }, ADMIN_LIVE_MS);
}

let adminSocket = null;

let lastLiveNewUsers = null;

function connectAdminRealtime() {
  if (!state.token || typeof io !== 'function') return;
  if (adminSocket) {
    adminSocket.auth = { token: state.token };
    if (!adminSocket.connected) adminSocket.connect();
    return;
  }
  adminSocket = io({
    path: '/socket.io',
    auth: { token: state.token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1200,
  });
  adminSocket.on('connect', () => {
    adminSocketLive = true;
    window.__adminSocketConnected = true;
    setLivePill();
  });
  adminSocket.on('disconnect', () => {
    adminSocketLive = false;
    window.__adminSocketConnected = false;
    setLivePill();
  });
  adminSocket.on('connect_error', () => {
    adminSocketLive = false;
    window.__adminSocketConnected = false;
    setLivePill();
  });
  adminSocket.on('ops:live', (snap) => {
    if (typeof window.patchOpsLive === 'function') window.patchOpsLive(snap);
    setLivePill();
    const next = Number(snap?.newUsersToday);
    if (
      state.tab === 'users'
      && Number.isFinite(next)
      && lastLiveNewUsers != null
      && next !== lastLiveNewUsers
      && typeof window.__reloadUsers === 'function'
    ) {
      window.__reloadUsers();
    }
    if (Number.isFinite(next)) lastLiveNewUsers = next;
  });
  adminSocket.on('community:changed', () => {
    if (location.hash.includes('/community') && !document.querySelector('dialog[open]')) window.renderCommunity?.();
  });
  adminSocket.on('brain:sync', () => {
    if (state.tab !== 'push' || pushStudioTab !== 'brain') return;
    if (document.hidden || adminIsTyping()) return;
    const drawer = $('drawer');
    if (drawer && !drawer.classList.contains('hidden')) return;
    if (brainSyncTimer) clearTimeout(brainSyncTimer);
    brainSyncTimer = setTimeout(() => {
      brainSyncTimer = null;
      if (typeof window.patchPushBrainLive === 'function') window.patchPushBrainLive();
    }, 600);
  });
}

let brainSyncTimer = null;

function disconnectAdminRealtime() {
  if (!adminSocket) return;
  adminSocket.disconnect();
  adminSocket = null;
  adminSocketLive = false;
  window.__adminSocketConnected = false;
  setLivePill();
}

async function refreshAdminLive() {
  const tab = state.tab;
  const socketLive = Boolean(adminSocketLive || window.__adminSocketConnected);
  if (tab === 'overview') {
    if (socketLive) return;
    if (typeof window.refreshCommandCenterLive === 'function') {
      await window.refreshCommandCenterLive();
    }
    return;
  }
  if (tab === 'users' && typeof window.__reloadUsers === 'function') {
    if (socketLive) return;
    await window.__reloadUsers();
    return;
  }
  if (tab === 'push') {
    // Numbers-only patch on compose-like tabs. History / devices / Brain are
    // updated by the `brain:sync` socket event — never rebuilt on a timer.
    if (pushStudioTab === 'compose' || pushStudioTab === 'copy' || pushStudioTab === 'engage') {
      await patchPushLiveStats();
    }
  }
}

async function patchPushLiveStats() {
  const stats = await api('/push/stats').catch(() => null);
  if (!stats) return;
  const devices = Number(stats.activeDevices || 0);
  const users = Number(stats.subscribedUsers || 0);
  const fmt = (n) => Number(n || 0).toLocaleString('ka-GE');
  const devicesEl = $('push-live-devices');
  const usersEl = $('push-live-users');
  if (devicesEl) devicesEl.textContent = fmt(devices);
  if (usersEl) {
    const reach = users ? Math.min(100, Math.round((devices / Math.max(users, 1)) * 100)) : null;
    usersEl.textContent = `${fmt(users)} მომხმარებელი${reach != null ? ` · ~${reach}% რამდენიმე მოწყობილობა` : ''}`;
  }
}

const DOCTOR_TYPE_KA = {
  GP: 'ოჯახის ექიმი',
  DENTIST: 'სტომატოლოგი',
  CARDIO: 'კარდიოლოგი',
  GYN: 'გინეკოლოგი',
  NEURO: 'ნევროლოგი',
  ORTHO: 'ორთოპედი',
  THERAPIST: 'თერაპევტი',
  OPHTHALMO: 'ოფთალმოლოგი',
  DERM: 'დერმატოლოგი',
  PED: 'პედიატრი',
  OTHER: 'სხვა',
};

function doctorLabel(type) {
  return DOCTOR_TYPE_KA[String(type || '').toUpperCase()] || type || 'ვიზიტი';
}

function doctorName(v) {
  const name = [v.doctorFirstName, v.doctorLastName].filter(Boolean).join(' ').trim();
  return name || doctorLabel(v.doctorType);
}

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '•';
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

async function renderOrders() {
  const root = $('tab-orders');
  root.innerHTML = '<div class="orders-page v25-orders"><div class="empty">' + "იტვირთება რიგი…" + '</div></div>';
  let data;
  try {
    data = await api('/orders');
  } catch (err) {
    root.innerHTML = '<div class="orders-page v25-orders"><div class="empty"><strong>' + "რიგი ვერ ჩაიტვირთა" + '</strong>' + escapeHtml(err.message || '') + '</div></div>';
    return;
  }

  const today = data.today;
  const visits = data.visits || [];
  const todayVisits = visits.filter((v) => v.visitDate === today);
  const laterVisits = visits.filter((v) => v.visitDate !== today);
  const k = data.kpis || {};
  const kpi = (iconName, label, value, hint, key) =>
    '<button type="button" class="v25-ord-kpi" data-orders-filter="' + key + '" aria-pressed="false">'
    + '<span class="v25-ord-kpi-top"><span class="v25-health-ico">' + icon(iconName) + '</span><span>' + label + '</span></span>'
    + '<strong>' + (value ?? 0) + '</strong>'
    + '<em>' + hint + '</em></button>';

  const paint = (filter = 'all', query = '') => {
    const q = query.trim().toLowerCase();
    const match = (text) => !q || String(text || '').toLowerCase().includes(q);
    const visFilter = (v) => {
      const hay = [v.user?.fullName, v.user?.email, doctorName(v), v.addressLabel, v.address, v.doctorType].join(' ');
      if (!match(hay)) return false;
      if (filter === 'today') return v.visitDate === today;
      if (filter === 'visits') return true;
      if (filter === 'meds' || filter === 'new') return false;
      return true;
    };
    const meds = (data.medications || []).filter((m) => {
      if (filter === 'visits' || filter === 'today') return false;
      if (filter === 'new') return false;
      return match([m.medName, m.user?.fullName, m.dosage].join(' '));
    });
    const signups = (data.signups || []).filter((u) => {
      if (filter === 'visits' || filter === 'today' || filter === 'meds') return false;
      return match([u.fullName, u.email, u.package?.nameKa].join(' '));
    });
    const shownToday = todayVisits.filter(visFilter);
    const shownLater = laterVisits.filter(visFilter);

    root.querySelector('#orders-today-list').innerHTML = shownToday.length
      ? shownToday.map((v) => orderVisitCard(v, 'today')).join('')
      : '<div class="orders-empty-col">' + "დღეს ვიზიტი არ არის" + '</div>';
    root.querySelector('#orders-later-list').innerHTML = shownLater.length
      ? shownLater.map((v) => orderVisitCard(v, 'soon')).join('')
      : '<div class="orders-empty-col">' + "მოახლოებული ვიზიტი არ არის" + '</div>';
    root.querySelector('#orders-meds-list').innerHTML = meds.length
      ? meds.map(orderMedCard).join('')
      : '<div class="orders-empty-col">' + "აქტიური მედიკამენტი არ ჩანს" + '</div>';
    root.querySelector('#orders-feed').innerHTML = signups.length
      ? signups.map(orderSignupRow).join('')
      : '<div class="orders-empty-col">' + "ახალი ანგარიში არ არის" + '</div>';
    const show = {
      today: filter === 'all' || filter === 'today' || filter === 'visits',
      later: filter === 'all' || filter === 'visits',
      meds: filter === 'all' || filter === 'meds',
      new: filter === 'all' || filter === 'new',
    };
    root.querySelectorAll('[data-orders-col]').forEach((el) => {
      el.hidden = !show[el.dataset.ordersCol];
    });
    const board = root.querySelector('.orders-board');
    if (board) board.dataset.cols = '1';
    root.querySelectorAll('[data-orders-filter]').forEach((btn) => {
      const on = btn.dataset.ordersFilter === filter;
      btn.classList.toggle('active', on);
      if (btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', String(on && filter !== 'all'));
      if (btn.getAttribute('role') === 'tab') btn.setAttribute('aria-selected', String(on));
    });
    bindOrderCards();
  };

  root.innerHTML = '<div class="orders-page v25-orders dash-enter">'
    + ((data.jobs || []).length
      ? '<div class="orders-live">' + icon('activity') + '<div><strong>' + "სინქი მიმდინარეობს" + '</strong><span>' + data.jobs.map((j) => escapeHtml(j.source)).join(' · ') + '</span></div><span class="orders-live-dot"></span></div>'
      : '')
    + '<div class="v25-ord-kpis">'
    + kpi('calendar', "დღეს", k.visitsToday, "ვიზიტი თბილისის დღეს", 'today')
    + kpi('activity', "7 დღე", k.visitsWeek, "მოახლოებული ვიზიტი", 'visits')
    + kpi('pill', "მედიკამენტები", k.activeMeds, "აქტიური გრაფიკი", 'meds')
    + kpi('zap', "ახალი", k.newUsersToday, "რეგისტრაცია დღეს", 'new')
    + '</div>'
    + '<div class="orders-toolbar">'
    + '<div class="orders-filters" role="tablist">'
    + '<button type="button" class="active" data-orders-filter="all" role="tab" aria-selected="true">' + "ყველა" + '</button>'
    + '<button type="button" data-orders-filter="today" role="tab" aria-selected="false">' + "დღეს" + '</button>'
    + '<button type="button" data-orders-filter="visits" role="tab" aria-selected="false">' + "ვიზიტები" + '</button>'
    + '<button type="button" data-orders-filter="meds" role="tab" aria-selected="false">' + "მედიკამენტები" + '</button>'
    + '<button type="button" data-orders-filter="new" role="tab" aria-selected="false">' + "ახალი ანგარიშები" + '</button>'
    + '</div>'
    + '<label class="orders-search"><span class="sr-only">' + "ძებნა" + '</span>' + icon('search')
    + '<input id="orders-q" type="search" placeholder="' + "სახელი, ექიმი, მედიკამენტი…" + '" autocomplete="off" /></label>'
    + '</div>'
    + '<div class="orders-board v3-orders-queue" data-cols="1">'
    + '<section class="orders-col v3-queue-section" data-orders-col="today"><header><span class="dot now"></span><h3>' + "დღეს" + '</h3><b>' + todayVisits.length + '</b></header><div id="orders-today-list" class="orders-col-body"></div></section>'
    + '<section class="orders-col v3-queue-section" data-orders-col="later"><header><span class="dot soon"></span><h3>' + "მოახლოებული" + '</h3><b>' + laterVisits.length + '</b></header><div id="orders-later-list" class="orders-col-body"></div></section>'
    + '<section class="orders-col v3-queue-section" data-orders-col="meds"><header><span class="dot med"></span><h3>' + "მედიკამენტები" + '</h3><b>' + (data.medications || []).length + '</b></header><div id="orders-meds-list" class="orders-col-body"></div></section>'
    + '<aside class="orders-col feed v3-queue-section" data-orders-col="new"><header><span class="dot new"></span><h3>' + "ახალი ანგარიშები" + '</h3><b>' + (data.signups || []).length + '</b></header><div id="orders-feed" class="orders-col-body"></div></aside>'
    + '</div></div>';

  let filter = 'all';
  let query = '';
  paint(filter, query);
  root.querySelectorAll('[data-orders-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filter = btn.dataset.ordersFilter;
      paint(filter, query);
    });
  });
  $('orders-q')?.addEventListener('input', (e) => {
    query = e.target.value;
    paint(filter, query);
  });
}

function orderVisitCard(v, tone) {
  const place = v.addressLabel || v.address || 'მისამართი არ არის';
  return `
    <button type="button" class="order-card visit ${tone}" data-open-user="${v.user?.id || ''}">
      <div class="order-card-top">
        <time>${escapeHtml(v.visitTime || '—')}</time>
        <span class="order-chip ${tone}">${tone === 'today' ? 'დღეს' : 'დაგეგმილი'}</span>
      </div>
      <strong>${escapeHtml(doctorName(v))}</strong>
      <p>${escapeHtml(doctorLabel(v.doctorType))}</p>
      <div class="order-card-who">
        <i>${escapeHtml(initialsOf(v.user?.fullName))}</i>
        <div>
          <b>${escapeHtml(v.user?.fullName || '—')}</b>
          <span>${escapeHtml(place)}</span>
        </div>
      </div>
    </button>`;
}

function orderMedCard(m) {
  return `
    <button type="button" class="order-card med" data-open-user="${m.user?.id || ''}">
      <div class="order-card-top">
        <time>${escapeHtml(fmtDateShort(m.createdAt))}</time>
        <span class="order-chip med">აქტიური</span>
      </div>
      <strong>${escapeHtml(m.medName)}</strong>
      <p>${escapeHtml(m.dosage || '—')} · ${escapeHtml(m.frequency || '')}</p>
      <div class="order-card-who">
        <i>${escapeHtml(initialsOf(m.user?.fullName))}</i>
        <div>
          <b>${escapeHtml(m.user?.fullName || '—')}</b>
          <span>${escapeHtml(m.user?.email || '')}</span>
        </div>
      </div>
    </button>`;
}

function orderSignupRow(u) {
  return `
    <button type="button" class="order-feed-row" data-open-user="${u.id}">
      <i>${escapeHtml(initialsOf(u.fullName))}</i>
      <div>
        <b>${escapeHtml(u.fullName)}</b>
        <span>${escapeHtml(u.email)}</span>
      </div>
    </button>`;
}

function bindOrderCards() {
  document.querySelectorAll('#tab-orders [data-open-user]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.openUser;
      if (id) editUser(id);
    });
  });
}

function sortUsers(list) {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  const key = state.sortKey;
  return [...list].sort((a, b) => {
    const va = key === 'used' ? a.usage?.used : a[key];
    const vb = key === 'used' ? b.usage?.used : b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (key === 'lastActiveAt' || key === 'createdAt') {
      const ta = new Date(va).getTime() || 0;
      const tb = new Date(vb).getTime() || 0;
      return (ta - tb) * dir;
    }
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), 'ka') * dir;
  });
}

function avatarTone(user) {
  return user.status === 'BLOCKED' ? 'muted' : 'free';
}

function freqKa(value) {
  return ({ often: 'ხშირად', balanced: 'დაბალანსებული', rare: 'იშვიათად' }[value] || value || 'უცნობია');
}
function permKa(value) {
  return ({ enabled: 'ჩართული', disabled: 'გამორთული', provisional: 'შეზღუდული', unknown: 'უცნობია' }[value] || value || 'უცნობია');
}
function fatigueKa(value) {
  return ({ normal: 'ჩვეულებრივი', reduced: 'შემცირებული', highly_reduced: 'მკვეთრად შემცირებული', unknown: 'უცნობია' }[value] || 'უცნობია');
}
function platformKa(value) {
  return ({ ios: 'iOS', android: 'Android', web: 'Web' }[value] || null);
}
function genderKa(value) {
  return ({ MALE: 'მამრობითი', FEMALE: 'მდედრობითი', OTHER: 'სხვა' }[String(value || '').toUpperCase()] || 'უცნობია');
}
window.genderKa = genderKa;
function yesNoKa(value) {
  if (value === true) return 'კი';
  if (value === false) return 'არა';
  return 'უცნობია';
}
function copyAdminValue(value, label) {
  if (!value) return;
  navigator.clipboard?.writeText(String(value));
  toast(`${label} დაკოპირდა`);
}

const USER_TABS = [
  ['overview', 'მიმოხილვა', 'layout'],
  ['activity', 'აქტივობა', 'activity'],
  ['product', 'პროდუქტის გამოყენება', 'layers'],
  ['notifications', 'შეტყობინებები', 'bell'],
  ['devices', 'მოწყობილობები', 'phone'],
  ['audit', 'აუდიტი', 'shield'],
];
const FEATURE_USAGE_LABELS = {
  medi: 'Medi · AI გამოყენება',
  assistant: 'მედი · შესრულებული მოქმედებები',
  consilium: 'AI კონსილიუმი',
  symptom_review: 'სიმპტომების განხილვა',
  lab: 'ლაბორატორიული ანალიზი',
  imaging: 'სამედიცინო გამოსახულება',
  skin: 'კანის შეფასება',
  skincare: 'კანის მოვლა',
  records: 'შენახული ჩანაწერები',
  pregnancy: 'ორსულობის აღრიცხვა',
  medirun: 'MEDIRUN · სესიები',
  quest: 'MEDI QUEST · დასრულებული მისიები',
  pets: 'ჩემი ცხოველები',
  medi_vet: 'Medi Vet · საუბრები',
  nutrition: 'კვების დღიური',
  community: 'ქალების სივრცე · გაწევრიანება',
  medications: 'მედიკამენტები',
  cycle: 'ციკლი',
  hydration: 'ჰიდრატაცია',
  step_tracking: 'ნაბიჯები',
  weight: 'წონა',
  visits: 'ვიზიტები',
  weekly_report: 'კვირის ანგარიში',
};
window.FEATURE_USAGE_LABELS = FEATURE_USAGE_LABELS;

const FEATURE_USAGE_ICONS = {
  assistant: 'spark', consilium: 'users', symptom_review: 'activity', lab: 'file',
  imaging: 'image', skin: 'image', skincare: 'heart', records: 'file',
  pregnancy: 'heart', medirun: 'map', quest: 'award', pets: 'heart',
  medi_vet: 'spark', community: 'users',
  medi: 'spark',
  medications: 'pill',
  cycle: 'calendar',
  hydration: 'activity',
  step_tracking: 'zap',
  weight: 'activity',
  visits: 'calendar',
  weekly_report: 'file',
};

function adminFlagImg(code) {
  const iso = String(code || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(iso)) return '';
  return `<img class="v3-user-flag" src="https://flagcdn.com/w40/${iso}.png" srcset="https://flagcdn.com/w80/${iso}.png 2x" width="20" height="15" alt="" decoding="async">`;
}

function adminPlaceOf(loc) {
  const row = loc && typeof loc === 'object' ? loc : {};
  const country = row.countryKa || row.countryCode || '';
  const city = row.cityKa || '';
  return {
    country: country || 'უცნობია',
    city: city || 'უცნობია',
    flag: adminFlagImg(row.countryCode),
    line: [city, country].filter(Boolean).join(', '),
  };
}
window.adminFlagImg = adminFlagImg;
window.adminPlaceOf = adminPlaceOf;

function renderUserInvestigationTabs(user, extra, pkgOptions, isPaid, activeTab) {
  const inv = extra.investigation || {};
  const ov = inv.overview || {};
  const usage = inv.productUsage || {};
  const notes = inv.notifications || extra.notifications || {};
  const tab = USER_TABS.some(([key]) => key === activeTab) ? activeTab : 'overview';
  const tel = ov.telemetry || notes.telemetry || {};
  const place = adminPlaceOf(ov.location);
  const row = (label, value, icoName) => `<div class="inv-row">${icoName ? `<span class="inv-row-ico">${icon(icoName)}</span>` : ''}<span>${label}</span><strong>${value}</strong></div>`;
  const sect = (title, icoName, body) => `<section class="inv-section"><h4>${icon(icoName)} ${title}</h4>${body}</section>`;
  const form = `
    <div class="umodal-form">
      <label class="field"><span>სახელი</span><input id="edit-name" value="${escapeAttr(user.fullName)}" /></label>
      <label class="field"><span>ელ-ფოსტა</span><input id="edit-email" type="email" value="${escapeAttr(user.email)}" /></label>
      <label class="field"><span>ტელეფონი</span><input id="edit-phone" type="tel" value="${escapeAttr(user.phone || '')}" placeholder="—" /></label>
      <label class="field"><span>სქესი</span>
        <select id="edit-gender">
          <option value="" ${!user.gender ? 'selected' : ''}>არ არის მითითებული</option>
          <option value="MALE" ${user.gender === 'MALE' ? 'selected' : ''}>მამრობითი</option>
          <option value="FEMALE" ${user.gender === 'FEMALE' ? 'selected' : ''}>მდედრობითი</option>
          <option value="OTHER" ${user.gender === 'OTHER' ? 'selected' : ''}>სხვა</option>
        </select>
      </label>
      <label class="field"><span>სტატუსი</span>
        <select id="edit-status">
          <option value="ACTIVE" ${user.status === 'ACTIVE' ? 'selected' : ''}>აქტიური — შეუძლია შესვლა</option>
          <option value="BLOCKED" ${user.status === 'BLOCKED' ? 'selected' : ''}>დაბლოკილი — შესვლა აკრძალულია</option>
        </select>
      </label>
      <label class="field span-2"><span>ადმინ შენიშვნა</span>
        <textarea id="edit-note" rows="3">${escapeHtml(user.adminNote || '')}</textarea>
      </label>
    </div>`;
  const overview = `
    <div class="user-overview">
    <div class="user-overview-facts">
    ${sect('ანგარიში', 'user', `<div class="inv-grid">
      ${row('User ID', `<button type="button" class="inv-copy" data-copy="${escapeAttr(user.id)}" data-copy-label="User ID">${escapeHtml(user.id)}</button>`, 'copy')}
      ${row('ანგარიშის სტატუსი', user.status === 'BLOCKED' ? 'დაბლოკილი' : 'შესვლა დაშვებულია', user.status === 'BLOCKED' ? 'lock' : 'check')}
      ${row('რეგისტრაცია', fmtDateShort(user.createdAt), 'calendar')}
      ${row('სქესი', genderKa(user.gender), 'user')}
      ${row('ქვეყანა', `${place.flag}<span>${escapeHtml(place.country)}</span>`, 'globe')}
      ${row('ქალაქი', escapeHtml(place.city), 'globe')}
    </div>`)}
    ${sect('აქტივობა', 'activity', `<div class="inv-grid">
      ${row('ბოლო აქტივობა', ov.lastActiveAt ? fmtDate(ov.lastActiveAt) : 'უცნობია', 'activity')}
      ${row('პლატფორმა', platformKa(ov.platform) || 'უცნობია', 'phone')}
      ${row('ბოლო აპის ვერსია', ov.appVersion || 'უცნობია', 'layers')}
      ${row('ნოტიფიკაციის ნებართვა', permKa(ov.notificationPermission), 'bell')}
    </div>`)}
    ${sect('პროდუქტის ათვისება', 'layers', `<p class="adoption-explainer">დადასტურებული გამოყენება შენახული ჩანაწერებით. თარიღი — ბოლო ჩანაწერია; მისი არქონა გვერდის არგახსნას არ ნიშნავს. კატეგორიები შეიძლება გადაიკვეთოს.</p><div class="v25-adopt">
      ${Object.entries(FEATURE_USAGE_LABELS).map(([key, label]) => {
        const feat = usage[key] || {};
        const icoName = FEATURE_USAGE_ICONS[key] || 'activity';
        const available = Object.hasOwn(usage, key) && feat.available !== false;
        const meta = !available ? 'მონაცემი მიუწვდომელია' : feat.used ? (feat.lastUsed ? fmtDateShort(feat.lastUsed) : 'გამოყენებულია') : 'ჯერ არ დაფიქსირებულა';
        return `<div class="v25-adopt-item${feat.used ? ' is-on' : ''}">
          <span class="v25-adopt-ico">${icon(icoName)}</span>
          <span class="v25-adopt-label">${escapeHtml(label)}</span>
          <span class="v25-adopt-state">${!available ? 'უცნობია' : feat.used ? 'გამოყენებულია' : 'ჩანაწერი არ არის'}</span>
          <strong class="v25-adopt-meta">${escapeHtml(meta)}</strong>
        </div>`;
      }).join('')}
    </div>`)}
    ${sect('შეტყობინების ქცევა', 'bell', `
    <div class="inv-fatigue">
      <div><span class="inv-fat-lab">${icon('user')} მომხმარებლის არჩევანი</span><strong>${escapeHtml(freqKa(ov.selectedFrequency))}</strong></div>
      <div><span class="inv-fat-lab">${icon('shield')} საბაზისო ლიმიტი</span><strong>${ov.baseDailyCap == null ? 'უცნობია' : `${ov.baseDailyCap} / დღე`}</strong></div>
      <div class="is-adapt"><span class="inv-fat-lab">${icon('spark')} Medi-ს მიმდინარე ადაპტაცია</span><strong>${ov.adaptiveDailyCap == null ? 'უცნობია' : `${ov.adaptiveDailyCap} / დღე`}</strong></div>
    </div>
    ${ov.capAdaptedByMedi || ov.capAdaptedNote ? `<p class="inv-note">Medi-მ დროებით შეამცირა სიხშირე ბოლო ჩართულობის მიხედვით. მომხმარებლის არჩევანი არ შეცვლილა.</p>` : ''}
    `)}
    </div>
    <section class="inv-section inv-edit user-overview-edit"><h4>${icon('settings')} ანგარიშის რედაქტირება</h4>
    ${form}
    </section>
    </div>`;
  const timelineGroups = [];
  for (const item of inv.timeline || []) {
    const day = timelineDayKa(item.at);
    const last = timelineGroups[timelineGroups.length - 1];
    if (!last || last.day !== day) timelineGroups.push({ day, items: [item] });
    else last.items.push(item);
  }
  const timeline = timelineGroups.length
    ? `<div class="inv-timeline">${timelineGroups.map((group) => `
      <div class="inv-day">${escapeHtml(group.day)}</div>
      ${group.items.map((item) => `
        <div class="inv-tl-item">
          <i></i>
          <time>${item.at ? new Date(item.at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' }) : '—'}</time>
          <strong>${escapeHtml(item.label)}</strong>
          <em>${platformKa(item.platform) || 'უცნობია'} · ${escapeHtml(item.appVersion || 'უცნობია')} · ${escapeHtml(item.source || '')}</em>
        </div>`).join('')}
    `).join('')}</div>`
    : '<p class="muted">ამ პერიოდში გასუფთავებული აქტივობა არ არის.</p>';
  const usageRows = Object.entries(FEATURE_USAGE_LABELS).map(([key, label]) => {
    const feat = usage[key] || {};
    const active = feat.used && feat.lastUsed && (Date.now() - new Date(feat.lastUsed).getTime() < 86400000 * 2);
    const available = Object.hasOwn(usage, key) && feat.available !== false;
    const status = !available ? 'მიუწვდომელია' : !feat.used ? 'ჯერ არ დაფიქსირებულა' : active ? 'აქტიური' : 'გამოყენებული';
    const statusClass = !feat.used ? ' is-off' : (feat.used ? ' is-on' : '');
    const icoName = FEATURE_USAGE_ICONS[key] || 'activity';
    return `<div class="v25-feat-row">
      <div class="v25-feat-name"><b>${icon(icoName)} ${escapeHtml(label)}</b></div>
      <div class="v25-feat-status-cell"><span class="v25-feat-status${statusClass}">${status}</span></div>
      <div class="v25-feat-date"><em>${feat.lastUsed ? fmtDateShort(feat.lastUsed) : '—'}</em></div>
      <div class="v25-feat-count"><em>${available ? (feat.periodCount ?? 0) : '—'}</em></div>
    </div>`;
  }).join('');
  const usageHead = `<div class="v25-feat-head" aria-hidden="true">
    <span>მოდული</span><span>სტატუსი</span><span>ბოლო ჩანაწერი</span><span>პერიოდში</span>
  </div>`;
  const decisionList = notes.recentDecisions || extra.decisions || [];
  const decisions = decisionList.map((item) => `
    <tr>
      <td><button type="button" class="inv-link" data-decision="${escapeAttr(item.decisionId)}">${escapeHtml(item.decisionId)}</button></td>
      <td>${escapeHtml(item.family || item.candidate || '—')}</td>
      <td><span class="badge result-${escapeAttr(item.result || 'unknown')}">${escapeHtml(item.result || '—')}</span></td>
      <td title="${escapeAttr(item.reason || '')}">${escapeHtml(item.reason || '—')}</td>
      <td>${fmtDate(item.createdAt)}</td>
    </tr>`).join('');
  const outcomes = (notes.recentOutcomes || []).map((item) => `
    <tr>
      <td><button type="button" class="inv-link" data-decision="${escapeAttr(item.decisionId)}">${escapeHtml(item.decisionId || '—')}</button></td>
      <td>${escapeHtml(item.outcome)}</td>
      <td>${escapeHtml(item.actionKey || '—')}</td>
      <td>${fmtDate(item.occurredAt)}</td>
    </tr>`).join('');
  const suppress = (notes.suppressionReasons || []).map((item) => `<tr><td>${escapeHtml(item.reason)}</td><td>${item.count}</td></tr>`).join('');
  const notif = `
    <div class="v25-brainbox">
      <div><span>${icon('user')} არჩევანი</span><strong>${freqKa(notes.preference?.selectedFrequency || ov.selectedFrequency)}</strong></div>
      <div class="is-adapt"><span>${icon('spark')} საბაზისო / ადაპტაცია</span><strong>${notes.brain?.baseDailyCap ?? ov.baseDailyCap ?? '—'} → ${notes.brain?.adaptiveDailyCap ?? ov.adaptiveDailyCap ?? '—'}</strong></div>
      <div><span>${icon('bell')} ნებართვა</span><strong>${permKa(notes.permission || ov.notificationPermission)}</strong></div>
      <div><span>${icon('activity')} ტელემეტრია</span><strong>Brain ${yesNoKa(tel.brainSync)} · Outcome ${yesNoKa(tel.outcomeSync)}</strong></div>
    </div>
    ${sect('Adaptive Brain', 'spark', `<div class="inv-fatigue">
      <div><span class="inv-fat-lab">${icon('shield')} საბაზისო ლიმიტი</span><strong>${notes.brain?.baseDailyCap ?? ov.baseDailyCap ?? 'უცნობია'} / დღე</strong></div>
      <div class="is-adapt"><span class="inv-fat-lab">${icon('spark')} Medi-ს ადაპტაცია</span><strong>${notes.brain?.adaptiveDailyCap ?? ov.adaptiveDailyCap ?? 'უცნობია'} / დღე</strong></div>
      <div><span class="inv-fat-lab">${icon('alert')} დაღლილობა</span><strong>${fatigueKa(notes.brain?.fatigueState || ov.fatigueState)}</strong></div>
    </div>`)}
    ${sect('ტელემეტრია', 'activity', `<div class="inv-grid">
      ${row('გახსნა / ქმედება', `${notes.opened ?? 0} / ${notes.actioned ?? 0}`, 'eye')}
    </div>
    ${tel.brainSync === false ? '<p class="inv-note">ამ კლიენტის ვერსია Brain-ის სინქრონიზაციას არ უჭერს მხარს.</p>' : ''}
    ${tel.outcomeSync === false ? '<p class="inv-note">ამ კლიენტის ვერსია შედეგების სინქრონიზაციას არ უჭერს მხარს.</p>' : ''}
    `)}
    ${sect('ბოლო გადაწყვეტილებები', 'file', `
      <div class="v3-user-decisions" data-page-size="10" data-total="${decisionList.length}">
        <div class="v3-user-decisions-scroll">
          <table class="inv-table" id="user-decisions-table">
            <thead><tr><th>Decision ID</th><th>ოჯახი</th><th>შედეგი</th><th>მიზეზი</th><th>დრო</th></tr></thead>
            <tbody id="user-decisions-tbody">${decisions || '<tr class="is-empty"><td colspan="5">გადაწყვეტილება ჯერ არ არის</td></tr>'}</tbody>
          </table>
        </div>
        <div class="v3-user-decisions-pager" id="user-decisions-pager" hidden></div>
      </div>`)}
    ${sect('ბოლო შედეგები', 'check', `<table class="inv-table"><thead><tr><th>Decision ID</th><th>შედეგი</th><th>ქმედება</th><th>დრო</th></tr></thead>
    <tbody>${outcomes || '<tr><td colspan="4">შედეგი ჯერ არ არის</td></tr>'}</tbody></table>`)}
    ${sect('დაბლოკვის მიზეზები', 'lock', `<table class="inv-table"><thead><tr><th>მიზეზი</th><th>რაოდენობა</th></tr></thead>
    <tbody>${suppress || '<tr><td colspan="2">დაბლოკვა არ არის</td></tr>'}</tbody></table>`)}`;

  const devices = (inv.devices || extra.devices || []).map((item) => `
    <article class="v25-device">
      <strong>${icon('phone')} ${platformKa(item.platform) || 'უცნობია'}</strong>
      <span>${escapeHtml(item.appVersion || 'უცნობია')}</span>
      <em>${item.firstSeen ? fmtDate(item.firstSeen) : '—'} → ${item.lastSeen ? fmtDate(item.lastSeen) : '—'}</em>
      <em>${permKa(item.notificationPermission)} · Brain ${yesNoKa(item.telemetry?.brainSync)} · Outcome ${yesNoKa(item.telemetry?.outcomeSync)}</em>
    </article>`).join('');
  const audit = (inv.audit || []).map((item) => `
    <div class="v25-audit-row">
      <time>${fmtDate(item.time)}</time>
      <div><b>${escapeHtml(item.admin || '—')}</b> · ${escapeHtml(item.action || '—')}</div>
      <details><summary>დეტალი</summary><pre>${escapeHtml(JSON.stringify({ previous: item.previous ?? null, next: item.next ?? null }))}</pre></details>
    </div>`).join('');
  return `
    <div class="user-tabs" role="tablist">
      ${USER_TABS.map(([key, label, icoName]) => `<button type="button" class="user-tab" role="tab" data-user-tab="${key}" aria-selected="${key === tab}">${icon(icoName || 'layout')} ${label}</button>`).join('')}
    </div>
    <div class="user-body">
      <div class="user-pane${tab === 'overview' ? ' is-on' : ''}" data-user-pane="overview">${overview}</div>
      <div class="user-pane${tab === 'activity' ? ' is-on' : ''}" data-user-pane="activity">${timeline}</div>
      <div class="user-pane${tab === 'product' ? ' is-on' : ''}" data-user-pane="product">
        <div class="v25-feat">${usageHead}${usageRows}</div>
      </div>
      <div class="user-pane${tab === 'notifications' ? ' is-on' : ''}" data-user-pane="notifications">${notif}</div>
      <div class="user-pane${tab === 'devices' ? ' is-on' : ''}" data-user-pane="devices">
        ${devices ? `<div class="v25-devices">${devices}</div>` : '<p class="muted">ცნობილი კლიენტი არ არის. მოწყობილობის სახელი არ იგულისხმება.</p>'}
      </div>
      <div class="user-pane${tab === 'audit' ? ' is-on' : ''}" data-user-pane="audit">
        ${audit ? `<div class="v25-audit">${audit}</div>` : '<p class="muted">ამ მომხმარებელზე ადმინ ქმედება არ არის.</p>'}
      </div>
    </div>`;
}

function bindUserInvestigation(userId) {
  document.querySelectorAll('[data-user-tab]').forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.userTab;
      document.querySelectorAll('[data-user-tab]').forEach((el) => el.setAttribute('aria-selected', String(el === btn)));
      document.querySelectorAll('[data-user-pane]').forEach((pane) => {
        pane.classList.toggle('is-on', pane.dataset.userPane === key);
      });
      if (userId) {
        const href = userPageHref(userId, key);
        if (location.hash !== href) history.replaceState({ tab: 'users' }, '', href);
      }
    };
  });
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.onclick = () => copyAdminValue(btn.dataset.copy, btn.dataset.copyLabel || 'ID');
  });
  document.querySelectorAll('[data-decision]').forEach((btn) => {
    btn.onclick = () => {
      if (typeof openDecisionDrawer === 'function') openDecisionDrawer(btn.dataset.decision);
    };
  });
  bindUserDecisionsPager();
}

function bindUserDecisionsPager() {
  const wrap = document.querySelector('.v3-user-decisions');
  if (!wrap) return;
  const tbody = wrap.querySelector('#user-decisions-tbody');
  const pager = wrap.querySelector('#user-decisions-pager');
  if (!tbody || !pager) return;
  const rows = [...tbody.querySelectorAll('tr')].filter((tr) => !tr.classList.contains('is-empty'));
  const pageSize = Math.max(1, Number(wrap.dataset.pageSize || 10) || 10);
  if (!rows.length) {
    pager.hidden = true;
    pager.innerHTML = '';
    return;
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  let page = 1;

  const paint = () => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    rows.forEach((tr, i) => {
      tr.hidden = i < start || i >= end;
    });
    if (totalPages <= 1) {
      pager.hidden = true;
      pager.innerHTML = '';
      return;
    }
    pager.hidden = false;
    const from = start + 1;
    const to = Math.min(end, rows.length);
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('…');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('…');
      pages.push(totalPages);
    }
    pager.innerHTML = `
      <span class="v3-user-decisions-meta">${from}–${to} / ${rows.length}</span>
      <div class="v3-user-decisions-nav">
        <button type="button" class="btn tiny ghost" data-dec-prev ${page <= 1 ? 'disabled' : ''}>${icon('chevronLeft')} წინა</button>
        <div class="v3-user-decisions-pages">
          ${pages.map((p) => (p === '…'
            ? '<span class="v3-users-page-gap">…</span>'
            : `<button type="button" class="v3-users-page${p === page ? ' is-active' : ''}" data-dec-page="${p}">${p}</button>`
          )).join('')}
        </div>
        <button type="button" class="btn tiny ghost" data-dec-next ${page >= totalPages ? 'disabled' : ''}>შემდეგი ${icon('arrow')}</button>
      </div>`;
    pager.querySelector('[data-dec-prev]')?.addEventListener('click', () => {
      if (page > 1) { page -= 1; paint(); }
    });
    pager.querySelector('[data-dec-next]')?.addEventListener('click', () => {
      if (page < totalPages) { page += 1; paint(); }
    });
    pager.querySelectorAll('[data-dec-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        page = Number(btn.dataset.decPage) || 1;
        paint();
      });
    });
  };
  paint();
}

function currentUserProfileTab() {
  return document.querySelector('[data-user-tab][aria-selected="true"]')?.dataset.userTab || hashSearch().get('profileTab') || 'overview';
}

function editUser(id, opts = {}) {
  if (!id) return;
  closeDrawer();
  const nextHash = userPageHref(id, opts.profileTab);
  if (location.hash === nextHash) {
    renderUserPage(id, opts);
    return;
  }
  location.hash = nextHash;
}

window.editUser = editUser;


let pushShowKeys = false;
let pushStudioTab = 'brain';
window.setPushStudioTab = (tab) => { pushStudioTab = tab; };
let pushCopyGroup = 'all';
let pushHistoryView = 'campaigns';
let pushProgressTimer = null;

// Broadcast audiences (server/src/lib/pushCampaigns.js). MEDICARD is free: package tiers are history-only labels.
const PUSH_SEGMENT_CHOICES = {
  ALL: 'ყველა',
  ACTIVE_7D: 'აქტიური 7 დღეში',
  ACTIVE_30D: 'აქტიური 30 დღეში',
  PLATFORM_IOS: 'iOS',
  PLATFORM_ANDROID: 'Android',
  GOAL_MEDICATIONS: 'მიზანი: მედიკამენტები',
  GOAL_NUTRITION: 'მიზანი: კვება და წონა',
  GOAL_CYCLE: 'მიზანი: ციკლი',
  GOAL_GENERAL: 'მიზანი: ზოგადი',
};
const PUSH_SEGMENT_LABELS = {
  ...PUSH_SEGMENT_CHOICES,
  ACTIVE: 'აქტიური მომხმარებლები (ძველი სეგმენტი)',
  FREE: 'უფასო პაკეტი (ძველი სეგმენტი)',
  STANDARD: 'STANDARD (ძველი სეგმენტი)',
  ULTIMATE: 'ULTIMATE (ძველი სეგმენტი)',
};
const PUSH_CAMPAIGN_LIVE = new Set(['QUEUED', 'SENDING']);

function pushCampaignStatusText(c) {
  if (c.status === 'SENT') return 'გაგზავნილი';
  if (c.status === 'FAILED' && !(c.targetCount > 0)) return 'მოწყობილობა არ იყო';
  if (c.status === 'FAILED') return 'შეცდომა';
  if (c.status === 'QUEUED') return 'რიგში';
  if (c.status === 'SENDING') {
    const done = (c.sentCount || 0) + (c.failedCount || 0);
    return c.targetCount ? `იგზავნება · ${Math.min(100, Math.round((done / c.targetCount) * 100))}%` : 'იგზავნება';
  }
  return c.status || '—';
}

function pushCampaignBadge(c) {
  const tone = c.status === 'SENT'
    ? 'ok'
    : c.status === 'FAILED' && c.targetCount > 0
      ? 'bad'
      : c.status === 'FAILED' || PUSH_CAMPAIGN_LIVE.has(c.status) ? 'std' : 'neutral';
  return `<span class="badge ${tone}" data-campaign-status>${escapeHtml(pushCampaignStatusText(c))}</span>`;
}

function pushDeliveryBarHtml(sent, target, failed = 0) {
  const pct = target ? Math.min(100, Math.round(((sent + failed) / target) * 100)) : 0;
  return `
      <div class="push-delivery">
        <div class="bar"><span style="width:${pct}%"></span></div>
        <span class="mono push-delivery-val">${sent} ✓ · ${failed} ✗ / ${target}</span>
      </div>
    `;
}

/** Polls queued/sending campaigns and patches their cards in place; re-renders once one finishes. */
function watchPushCampaigns(ids, onFinished) {
  if (pushProgressTimer) clearTimeout(pushProgressTimer);
  pushProgressTimer = null;
  let pending = [...new Set(ids)];
  if (!pending.length) return;
  const tick = async () => {
    pushProgressTimer = null;
    if (!document.getElementById('push-compose-form')) return; // left the push page
    const finished = [];
    await Promise.all(pending.map(async (id) => {
      try {
        const { campaign } = await api(`/push/campaigns/${encodeURIComponent(id)}`);
        document.querySelectorAll(`[data-campaign="${CSS.escape(id)}"]`).forEach((card) => {
          const badge = card.querySelector('[data-campaign-status]');
          if (badge) badge.outerHTML = pushCampaignBadge(campaign);
          const bar = card.querySelector('.push-delivery');
          if (bar) bar.outerHTML = pushDeliveryBarHtml(campaign.sentCount || 0, campaign.targetCount || 0, campaign.failedCount || 0);
        });
        if (!PUSH_CAMPAIGN_LIVE.has(campaign.status)) finished.push(id);
      } catch {
        /* keep polling; one failed admin API call should not freeze the view */
      }
    }));
    pending = pending.filter((id) => !finished.includes(id));
    if (finished.length && typeof onFinished === 'function') {
      onFinished();
      return;
    }
    if (pending.length) pushProgressTimer = setTimeout(tick, 3000);
  };
  pushProgressTimer = setTimeout(tick, 2000);
}

function pushPreviewCopy(text, vars = {}) {
  return String(text || '')
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
      const value = vars[key];
      return value == null || String(value).trim() === '' ? '' : String(value).trim();
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

function pushNowParts() {
  const p = adminDateParts(new Date());
  return {
    time: `${p.hour}:${p.minute}`,
    date: `${WEEKDAYS_KA[p.weekday]}, ${p.day} ${MONTHS_KA[p.month]}`,
  };
}

function pushPhoneHtml({ title, body, segmentLabel, reachHint }) {
  const { time } = pushNowParts();
  return `
    <div class="v3-notif-preview push-phone" aria-label="შეტყობინების გადახედვა">
      <div class="v3-notif-toast push-phone-toast">
        <div class="push-preview-row">
          <div class="push-preview-icon">${icon('bell')}</div>
          <div class="push-preview-meta">
            <span class="push-preview-app">Medicard.GE</span>
            <span class="push-preview-time" id="push-phone-time">${escapeHtml(time)}</span>
          </div>
        </div>
        <strong id="push-preview-title">${escapeHtml(title)}</strong>
        <p id="push-preview-body">${escapeHtml(body)}</p>
      </div>
      <p class="push-phone-reach" id="push-preview-seg">${escapeHtml(segmentLabel)}${reachHint ? ` · ${escapeHtml(reachHint)}` : ''}</p>
      <span id="push-phone-date" class="sr-only" hidden></span>
    </div>
  `;
}

async function renderPush() {
  const [stats, { campaigns }, templatesRes, eventsRes, segmentsRes] = await Promise.all([
    api('/push/stats'),
    api('/push/campaigns'),
    api('/push/templates').catch(() => ({ templates: [] })),
    api('/push/events').catch(() => ({ events: [] })),
    api('/push/segments').catch(() => ({ counts: null })),
  ]);
  const segmentCounts = segmentsRes.counts || null;
  const templates = templatesRes.templates || [];
  const events = eventsRes.events || [];
  const GROUP_LABELS = {
    med: 'მედიკამენტები',
    cycle: 'ციკლი',
    visit: 'ექიმთან ვიზიტი',
    activity: 'აქტივობა',
    admin: 'ადმინი · დისტანციური',
    engage: 'ჩართულობა · Medi',
  };
  const PLACEHOLDER_HELP = [
    ['name', 'მედიკამენტის სახელი'],
    ['dosage', 'დოზა'],
    ['days', 'დღეების რაოდენობა'],
    ['doctor', 'ექიმის სახელი'],
    ['time', 'ვიზიტის დრო'],
    ['place', 'ვიზიტის ადგილი'],
    ['steps', 'ნაბიჯების რაოდენობა'],
    ['kg', 'წონა'],
    ['firstName', 'სახელი'],
  ];
  const {
    activeDevices,
    subscribedUsers,
    recentCampaigns,
    devices = [],
    totalSent: statsSent,
    totalFailed: statsFailed,
    sentLast24h = 0,
    platforms = {},
  } = stats;

  const SEGMENTS = PUSH_SEGMENT_CHOICES;
  const SEGMENT_LABELS = PUSH_SEGMENT_LABELS;

  const totalSent = statsSent ?? campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
  const totalFailed = statsFailed ?? campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0);
  const totalTarget = stats.totalTarget ?? campaigns.reduce((sum, c) => sum + (c.targetCount || 0), 0);
  const lastCampaign = campaigns[0];
  const reachPct = subscribedUsers
    ? Math.min(100, Math.round((activeDevices / Math.max(subscribedUsers, 1)) * 100))
    : null;
  const deliveryAttempts = totalSent + totalFailed;
  const successPct = deliveryAttempts ? Math.round((totalSent / deliveryAttempts) * 100) : null;
  const customCount = templates.filter((t) => t.custom).length;
  const adminTpl = templates.find((t) => t.key === 'admin-push');
  const defaultTitle = adminTpl?.title || 'მე ვარ, Medi 💚';
  const defaultBody = adminTpl?.body || 'შენთვის პატარა ამბავი მაქვს.';
  const fmtN = (n) => Number(n || 0).toLocaleString('ka-GE');
  const segmentReach = (segment) => {
    const n = segmentCounts ? segmentCounts[segment] : segment === 'ALL' ? activeDevices : null;
    return n == null ? 'რაოდენობა უცნობია' : `${fmtN(n)} მოწყობილობა`;
  };
  const platformLabel = (platform) => {
    if (platform === 'ios') return 'iOS';
    if (platform === 'android') return 'Android';
    if (platform === 'web') return 'Web';
    return platform || '—';
  };
  const platformCount = (key) => Number(platforms[key] || 0);
  const eventSourceLabel = (source) => {
    if (source === 'qa') return 'QA';
    if (source === 'broadcast') return 'გაგზავნა';
    if (source === 'local') return 'ტელეფონი';
    return source || '—';
  };

  const campaignStatus = pushCampaignBadge;
  const deliveryBar = pushDeliveryBarHtml;

  const groupCounts = Object.fromEntries(
    ['med', 'cycle', 'visit', 'activity', 'admin'].map((group) => [
      group,
      templates.filter((t) => t.group === group).length,
    ]),
  );

  const pushStudioKpi = (iconName, label, value, hint) => `
    <article class="v25-push-kpi">
      <span class="v25-push-kpi-top"><span class="v25-health-ico">${icon(iconName)}</span><span>${label}</span></span>
      <strong>${value}</strong>
      <em>${hint}</em>
    </article>`;

  $('tab-push').innerHTML = `
    <div class="push-studio v25-push dash-enter">
      <header class="ops-head">
        <p class="muted">მყისიერი Expo Push და Medi ტექსტები. ლოკალური შეხსენებები აქ არ იგზავნება.</p>
        ${typeof opsRangeBar === 'function' ? opsRangeBar() : ''}
      </header>
      <div class="v25-push-kpis">
        ${pushStudioKpi('phone', 'მოწყობილობები', fmtN(activeDevices), 'აქტიური Expo token')}
        ${pushStudioKpi('users', 'მომხმარებლები', fmtN(subscribedUsers), reachPct != null ? `~${reachPct}% რამდენიმე მოწყობილობა` : 'უნიკალური ანგარიში')}
        ${pushStudioKpi('send', '24სთ', fmtN(sentLast24h), `${fmtN(totalSent)} სულ`)}
        ${pushStudioKpi('alert', 'ვერ მივიდა', fmtN(totalFailed), successPct == null ? 'მიწოდება ჯერ არ არის' : `${successPct}% წარმატება`)}
        ${pushStudioKpi('bell', 'კამპანიები', fmtN(campaigns.length), lastCampaign ? fmtDateShort(lastCampaign.sentAt || lastCampaign.createdAt) : 'ჯერ ცარიელია')}
        ${pushStudioKpi('layers', 'iOS / Android', `${fmtN(platformCount('ios'))} / ${fmtN(platformCount('android'))}`, platformCount('web') ? `${fmtN(platformCount('web'))} Web` : 'Expo ქსელი')}
      </div>

      <section class="card push-board">
        <nav class="push-tabs" role="tablist" aria-label="Push სტუდია">
          <button type="button" class="push-tab${pushStudioTab === 'compose' ? ' active' : ''}" data-push-tab="compose" role="tab" aria-selected="${pushStudioTab === 'compose'}">${icon('send')} გაგზავნა</button>
          <button type="button" class="push-tab${pushStudioTab === 'copy' ? ' active' : ''}" data-push-tab="copy" role="tab" aria-selected="${pushStudioTab === 'copy'}">${icon('message')} Medi ტექსტები <b>${templates.filter((t) => t.group !== 'engage').length}</b></button>
          <button type="button" class="push-tab${pushStudioTab === 'engage' ? ' active' : ''}" data-push-tab="engage" role="tab" aria-selected="${pushStudioTab === 'engage'}">${icon('bell')} ჩართულობა <b>${templates.filter((t) => t.group === 'engage').length}</b></button>
          <button type="button" class="push-tab${pushStudioTab === 'history' ? ' active' : ''}" data-push-tab="history" role="tab" aria-selected="${pushStudioTab === 'history'}">${icon('activity')} ისტორია <b>${campaigns.length + events.length}</b></button>
          <button type="button" class="push-tab${pushStudioTab === 'devices' ? ' active' : ''}" data-push-tab="devices" role="tab" aria-selected="${pushStudioTab === 'devices'}">${icon('phone')} მოწყობილობები <b>${activeDevices}</b></button>
          <button type="button" class="push-tab${pushStudioTab === 'brain' ? ' active' : ''}" data-push-tab="brain" role="tab" aria-selected="${pushStudioTab === 'brain'}">${icon('activity')} გადაწყვეტილებები</button>
        </nav>

        <div class="push-panel${pushStudioTab === 'compose' ? '' : ' hidden'}" data-push-panel="compose">
          <div class="push-compose-grid">
            <form class="push-compose-form" id="push-compose-form">
              <div class="push-compose-head">
                <p class="kicker">გაგზავნა</p>
                <h3>ახალი შეტყობინება</h3>
                <p class="muted">Expo Push არჩეულ სეგმენტში. კამპანია რიგში დგება და ფონურად იგზავნება; პროგრესი ქვემოთ ახლდება. ლოკალური შეხსენებები აქ არ იგზავნება — მათი ტექსტი „Medi ტექსტებშია“.</p>
              </div>
              <label class="field">
                <span>სათაური <em id="push-title-count">0 / 120</em></span>
                <input id="push-title" maxlength="120" placeholder="მე ვარ, Medi 💚" value="${escapeHtml(defaultTitle)}" />
              </label>
              <label class="field">
                <span>ტექსტი <em id="push-body-count">0 / 500</em></span>
                <textarea id="push-body" rows="5" maxlength="500" placeholder="შენთვის პატარა ამბავი მაქვს.">${escapeHtml(defaultBody)}</textarea>
              </label>
              <div class="field">
                <span>სეგმენტი</span>
                <div class="push-seg-grid" role="radiogroup" aria-label="სეგმენტი">
                  ${Object.entries(SEGMENTS).map(([value, label]) => `
                    <button type="button" class="push-seg${value === 'ALL' ? ' active' : ''}" data-seg="${value}" aria-pressed="${value === 'ALL'}">
                      <strong>${label}</strong>
                      <span>${segmentReach(value)}</span>
                    </button>
                  `).join('')}
                </div>
                <select id="push-segment" class="sr-only" aria-hidden="true" tabindex="-1">
                  ${Object.entries(SEGMENTS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
                </select>
              </div>
              <div id="push-confirm" class="push-confirm hidden">
                <div>
                  <strong>დავადასტუროთ გაგზავნა?</strong>
                  <p id="push-confirm-copy">ეს შეტყობინება წავა არჩეულ სეგმენტზე.</p>
                </div>
                <div class="push-confirm-actions">
                  <button type="button" class="btn ghost" id="push-confirm-no">გაუქმება</button>
                  <button type="button" class="btn primary" id="push-confirm-yes">${icon('send')} კი, გაგზავნა</button>
                </div>
              </div>
              <button type="button" class="btn primary wide ng-cta" id="push-send">${icon('send')} გაგზავნა</button>
              <p class="push-compose-note">Expo Go (SDK 53+) Android-ზე remote push-ს აღარ იძლევა.</p>
            </form>
            <aside class="push-phone-col v3-push-preview-col">
              <p class="push-preview-label">გადახედვა</p>
              ${pushPhoneHtml({ title: defaultTitle, body: defaultBody, segmentLabel: SEGMENTS.ALL, reachHint: segmentReach('ALL') })}
              <dl class="v3-send-summary" id="push-send-summary">
                <dt>სეგმენტი</dt><dd id="push-summary-seg">${escapeHtml(SEGMENTS.ALL)}</dd>
                <dt>მოწყობილობები</dt><dd id="push-summary-reach">${segmentReach('ALL')}</dd>
                <dt>სათაური</dt><dd id="push-summary-title-len">0 / 120</dd>
                <dt>ტექსტი</dt><dd id="push-summary-body-len">0 / 500</dd>
              </dl>
            </aside>
          </div>
          <div class="push-recent-wrap">
            <div class="push-recent-head">
              <h4>ბოლო გაშვებები</h4>
              <button type="button" class="btn tiny ghost" data-push-tab="history">${icon('activity')} სრული ისტორია</button>
            </div>
            ${recentCampaigns.length ? `
              <div class="push-recent-list">
                ${recentCampaigns.map((c) => `
                  <button type="button" class="push-recent-item" data-campaign="${c.id}">
                    <div class="push-recent-top">
                      <strong>${escapeHtml(c.title)}</strong>
                      ${campaignStatus(c)}
                    </div>
                    <div class="push-recent-meta">${SEGMENT_LABELS[c.segment] || c.segment} · ${fmtDateShort(c.sentAt || c.createdAt)}</div>
                    ${deliveryBar(c.sentCount || 0, c.targetCount || 0, c.failedCount || 0)}
                  </button>
                `).join('')}
              </div>
            ` : '<div class="empty push-empty"><strong>ჯერ არ გაგზავნილა</strong><p>პირველი გაგზავნა აქ გამოჩნდება.</p></div>'}
          </div>
        </div>

        <div class="push-panel${pushStudioTab === 'copy' ? '' : ' hidden'}" data-push-panel="copy">
          <div class="push-copy-toolbar">
            <div>
              <p class="kicker">Medi</p>
              <h3>შეხსენებების ტექსტები</h3>
              <p class="muted">შეცვლილი ტექსტი შემდეგ შესაბამის შეტყობინებაში გამოჩნდება. ზოგი შეხსენება ტელეფონზე იგეგმება და ლოგში შეიძლება არ გამოჩნდეს.</p>
            </div>
            <label class="push-advanced-toggle"><input type="checkbox" id="push-show-keys" ${pushShowKeys ? 'checked' : ''} /> დამატებითი</label>
          </div>
          <div class="push-copy-tools">
            <div class="push-group-pills" role="tablist" aria-label="ჯგუფი">
              <button type="button" class="push-group-pill${pushCopyGroup === 'all' ? ' active' : ''}" data-copy-group="all">ყველა <b>${templates.length}</b></button>
              ${['med', 'cycle', 'visit', 'activity', 'admin'].map((group) => `
                <button type="button" class="push-group-pill${pushCopyGroup === group ? ' active' : ''}" data-copy-group="${group}">${GROUP_LABELS[group]} <b>${groupCounts[group] || 0}</b></button>
              `).join('')}
            </div>
            <label class="push-tpl-search">
              <span class="sr-only">ძებნა</span>
              ${icon('search')}
              <input id="push-tpl-q" type="search" placeholder="მოძებნე ტექსტი…" autocomplete="off" />
            </label>
            <span class="users-os-pill ${customCount ? 'amber' : 'teal'}">${customCount ? `${customCount} შეცვლილი` : 'ნაგულისხმევი ტექსტები'}</span>
          </div>
          <details class="push-var-legend">
            <summary>ცვლადები — {name} {dosage} {kg}…</summary>
            <p>დააჭირე ჩიპს, რომ ჩასვა აქტიურ ველში. Medi მათ მონაცემებით ჩაანაცვლებს.</p>
            <ul>${PLACEHOLDER_HELP.map(([key, label]) => `<li><button type="button" class="push-ph-chip" data-ph-global="${key}">{${key}}</button> — ${escapeHtml(label)}</li>`).join('')}</ul>
          </details>
          <div class="push-templates">
            ${['med', 'cycle', 'visit', 'activity', 'admin'].map((group) => {
              const rows = templates.filter((t) => t.group === group);
              if (!rows.length) return '';
              return `
                <div class="push-tpl-group${pushCopyGroup !== 'all' && pushCopyGroup !== group ? ' hidden' : ''}" data-tpl-group="${group}">
                  <p class="push-device-heading">${GROUP_LABELS[group] || group}</p>
                  <div class="push-template-grid">
                    ${rows.map((t) => {
                      const preview = {
                        title: pushPreviewCopy(t.title, t.sample || {}),
                        body: pushPreviewCopy(t.body, t.sample || {}),
                      };
                      return `
                        <article class="push-template-card" data-template="${escapeHtml(t.key)}" data-tpl-label="${escapeAttr(t.label)}" data-tpl-group="${group}">
                          <header>
                            <strong>${escapeHtml(t.label)}</strong>
                            <span class="badge ${t.custom ? 'std' : 'neutral'}">${t.custom ? 'შეცვლილი' : 'ნაგულისხმევი'}</span>
                          </header>
                          <span class="push-template-key" ${pushShowKeys ? '' : 'hidden'}>${escapeHtml(t.key)}</span>
                          <div class="field"><span>სათაური</span><input data-tpl-title="${escapeHtml(t.key)}" maxlength="120" value="${escapeHtml(t.title)}" /></div>
                          <div class="field"><span>ტექსტი</span><textarea data-tpl-body="${escapeHtml(t.key)}" rows="4" maxlength="500">${escapeHtml(t.body)}</textarea></div>
                          ${t.placeholders?.length ? `<div class="push-ph">${t.placeholders.map((p) => `<button type="button" class="push-ph-chip" data-ph="${escapeHtml(p)}">{${escapeHtml(p)}}</button>`).join('')}</div>` : ''}
                          <div class="push-tpl-live">
                            <span>როგორც მივა</span>
                            <strong data-tpl-live-title="${escapeHtml(t.key)}">${escapeHtml(preview.title || t.title)}</strong>
                            <p data-tpl-live-body="${escapeHtml(t.key)}">${escapeHtml(preview.body || t.body)}</p>
                          </div>
                          <div class="push-template-actions">
                            <button type="button" class="btn tiny ghost" data-tpl-reset="${escapeHtml(t.key)}" ${t.custom ? '' : 'disabled'}>ნაგულისხმევის აღდგენა</button>
                            <button type="button" class="btn tiny primary" data-tpl-save="${escapeHtml(t.key)}">შენახვა</button>
                          </div>
                        </article>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="push-panel${pushStudioTab === 'engage' ? '' : ' hidden'}" data-push-panel="engage">
          <div class="push-copy-toolbar">
            <div>
              <p class="kicker">Medi შეტყობინებების Brain</p>
              <h3>ჩართულობის შეტყობინებები</h3>
              <p class="muted">კვირის ანგარიში „ჩემი კვირა Medi-სთან“, შესვლები, დაუსრულებელი მონახაზები და ხელახალი ჩართულობა. გაგზავნას ტელეფონი წყვეტს — აქ მხოლოდ ხმა იცვლება.</p>
            </div>
          </div>
          <div class="push-templates">
            <div class="push-tpl-group" data-tpl-group="engage">
              <div class="push-template-grid">
                ${templates.filter((t) => t.group === 'engage').map((t) => {
                  const preview = {
                    title: pushPreviewCopy(t.title, t.sample || {}),
                    body: pushPreviewCopy(t.body, t.sample || {}),
                  };
                  return `
                    <article class="push-template-card" data-template="${escapeHtml(t.key)}" data-tpl-label="${escapeAttr(t.label)}" data-tpl-group="engage">
                      <header>
                        <strong>${escapeHtml(t.label)}</strong>
                        <span class="badge ${t.custom ? 'std' : 'neutral'}">${t.custom ? 'შეცვლილი' : 'ნაგულისხმევი'}</span>
                      </header>
                      <span class="push-template-key" ${pushShowKeys ? '' : 'hidden'}>${escapeHtml(t.key)}</span>
                      <div class="field"><span>სათაური</span><input data-tpl-title="${escapeHtml(t.key)}" maxlength="120" value="${escapeHtml(t.title)}" /></div>
                      <div class="field"><span>ტექსტი</span><textarea data-tpl-body="${escapeHtml(t.key)}" rows="4" maxlength="500">${escapeHtml(t.body)}</textarea></div>
                      ${t.placeholders?.length ? `<div class="push-ph">${t.placeholders.map((p) => `<button type="button" class="push-ph-chip" data-ph="${escapeHtml(p)}">{${escapeHtml(p)}}</button>`).join('')}</div>` : ''}
                      <div class="push-tpl-live">
                        <span>როგორც მივა</span>
                        <strong data-tpl-live-title="${escapeHtml(t.key)}">${escapeHtml(preview.title || t.title)}</strong>
                        <p data-tpl-live-body="${escapeHtml(t.key)}">${escapeHtml(preview.body || t.body)}</p>
                      </div>
                      <div class="push-template-actions">
                        <button type="button" class="btn tiny ghost" data-tpl-reset="${escapeHtml(t.key)}" ${t.custom ? '' : 'disabled'}>ნაგულისხმევის აღდგენა</button>
                        <button type="button" class="btn tiny primary" data-tpl-save="${escapeHtml(t.key)}">შენახვა</button>
                      </div>
                    </article>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="push-panel${pushStudioTab === 'history' ? '' : ' hidden'}" data-push-panel="history">
          <div class="push-history-toolbar">
            <div class="push-group-pills" role="tablist" aria-label="ისტორია">
              <button type="button" class="push-group-pill${pushHistoryView === 'campaigns' ? ' active' : ''}" data-history-view="campaigns">კამპანიები <b>${campaigns.length}</b></button>
              <button type="button" class="push-group-pill${pushHistoryView === 'events' ? ' active' : ''}" data-history-view="events">ტელეფონზე მიღებული <b>${events.length}</b></button>
            </div>
            <label class="push-tpl-search">
              <span class="sr-only">ძებნა</span>
              ${icon('search')}
              <input id="push-history-q" type="search" placeholder="სათაური ან ტექსტი…" autocomplete="off" />
            </label>
          </div>
          <div class="push-history-pane${pushHistoryView === 'campaigns' ? '' : ' hidden'}" data-history-pane="campaigns">
            ${campaigns.length ? `
              <div class="push-history-list">
                ${campaigns.map((c) => `
                  <button type="button" class="push-history-card" data-campaign="${c.id}" data-history-text="${escapeAttr(`${c.title} ${c.body} ${c.segment}`)}">
                    <div class="push-recent-top">
                      <strong>${escapeHtml(c.title)}</strong>
                      ${campaignStatus(c)}
                    </div>
                    <p class="push-history-body">${escapeHtml((c.body || '').slice(0, 140))}${(c.body || '').length > 140 ? '…' : ''}</p>
                    <div class="push-recent-meta">${SEGMENT_LABELS[c.segment] || c.segment} · ${fmtDateShort(c.sentAt || c.createdAt)} · ${escapeHtml(c.createdBy?.fullName || '—')}</div>
                    ${deliveryBar(c.sentCount || 0, c.targetCount || 0, c.failedCount || 0)}
                  </button>
                `).join('')}
              </div>
            ` : '<div class="empty push-empty"><strong>კამპანიები ჯერ არ არის</strong><p>პირველი push broadcast აქ გამოჩნდება.</p></div>'}
          </div>
          <div class="push-history-pane${pushHistoryView === 'events' ? '' : ' hidden'}" data-history-pane="events">
            ${events.length ? `
              <div class="push-history-list">
                ${events.map((e) => `
                  <article class="push-history-card static" data-history-text="${escapeAttr(`${e.title} ${e.body} ${e.key} ${e.source}`)}">
                    <div class="push-recent-top">
                      <strong>${escapeHtml(e.title)}</strong>
                      <span class="badge ${e.source === 'qa' ? 'std' : e.source === 'broadcast' ? 'ok' : 'neutral'}">${escapeHtml(eventSourceLabel(e.source))}</span>
                    </div>
                    <p class="push-history-body">${escapeHtml((e.body || '').slice(0, 140))}${(e.body || '').length > 140 ? '…' : ''}</p>
                    <div class="push-recent-meta">${fmtDateShort(e.createdAt)} · ${escapeHtml(e.key)} · ${escapeHtml(e.user?.fullName || e.user?.email || '—')}</div>
                  </article>
                `).join('')}
              </div>
            ` : '<div class="empty push-empty"><strong>ჯერ არ მოსულა</strong><p>აპიდან Fire ან ნამდვილი შეხსენება აქ გამოჩნდება.</p></div>'}
          </div>
        </div>

        <div class="push-panel${pushStudioTab === 'devices' ? '' : ' hidden'}" data-push-panel="devices">
          <div class="push-device-stats">
            <article class="push-plat"><span>iOS</span><strong>${fmtN(platformCount('ios'))}</strong></article>
            <article class="push-plat android"><span>Android</span><strong>${fmtN(platformCount('android'))}</strong></article>
            <article class="push-plat web"><span>Web</span><strong>${fmtN(platformCount('web'))}</strong></article>
          </div>
          ${devices.length ? `
            <div class="push-device-grid">
              ${devices.map((d) => `
                <div class="push-device-row">
                  <span class="badge ${d.platform === 'ios' ? 'std' : d.platform === 'android' ? 'ok' : 'neutral'}">${escapeHtml(platformLabel(d.platform))}</span>
                  <div class="stack">
                    <strong>${escapeHtml(d.user?.fullName || '—')}</strong>
                    <span class="sub muted">${escapeHtml(d.user?.email || '')} · ${fmtDateShort(d.lastSeenAt)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="empty push-empty"><strong>მოწყობილობა არ არის</strong><p>ნებართვა საკმარისი არ არის — აპმა Expo token უნდა ატვირთოს შესვლის შემდეგ. Expo Go (SDK 53+) Android-ზე remote push-ს აღარ იძლევა. Store/dev build-ს სჭირდება Firebase FCM V1 და iOS APNs, შემდეგ ახალი native ინსტალაცია.</p></div>`}
        </div>
        <div class="push-panel${pushStudioTab === 'brain' ? '' : ' hidden'}" data-push-panel="brain">
          <div id="push-brain-host" class="ops-page"></div>
        </div>
      </section>
    </div>
  `;

  const setStudioTab = (tab) => {
    pushStudioTab = tab;
    document.querySelectorAll('[data-push-tab]').forEach((btn) => {
      const on = btn.dataset.pushTab === tab;
      btn.classList.toggle('active', on);
      if (btn.getAttribute('role') === 'tab') btn.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('[data-push-panel]').forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.pushPanel !== tab);
    });
    if (tab === 'compose') $('push-title')?.focus();
    if (tab === 'brain' && typeof renderPushBrainPanel === 'function') renderPushBrainPanel($('push-brain-host'));
  };

  document.querySelectorAll('[data-push-tab]').forEach((btn) => {
    btn.onclick = () => setStudioTab(btn.dataset.pushTab);
  });
  if (typeof bindOpsRange === 'function') bindOpsRange(renderPush);
  if (pushStudioTab === 'brain') setStudioTab('brain');

  const syncPreview = () => {
    const title = $('push-title').value.trim() || 'Medicard.GE';
    const body = $('push-body').value.trim() || 'შეტყობინების ტექსტი...';
    const segment = $('push-segment').value;
    const titleCount = $('push-title-count');
    const bodyCount = $('push-body-count');
    if (titleCount) titleCount.textContent = `${$('push-title').value.length} / 120`;
    if (bodyCount) bodyCount.textContent = `${$('push-body').value.length} / 500`;
    $('push-preview-title').textContent = title;
    $('push-preview-body').textContent = body;
    const reach = segmentReach(segment);
    $('push-preview-seg').textContent = `${SEGMENT_LABELS[segment] || segment} · ${reach}`;
    const clock = $('push-phone-time');
    const dateEl = $('push-phone-date');
    if (clock) {
      const parts = pushNowParts();
      clock.textContent = parts.time;
      if (dateEl) dateEl.textContent = parts.date;
    }
    const send = $('push-send');
    if (send) send.disabled = !($('push-title').value.trim() && $('push-body').value.trim());
  };

  const setSegment = (value) => {
    $('push-segment').value = value;
    document.querySelectorAll('.push-seg').forEach((btn) => {
      const on = btn.dataset.seg === value;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    syncPreview();
  };

  document.querySelectorAll('.push-seg').forEach((btn) => {
    btn.onclick = () => setSegment(btn.dataset.seg);
  });

  $('push-title').oninput = syncPreview;
  $('push-body').oninput = syncPreview;
  $('push-segment').onchange = syncPreview;
  syncPreview();

  const confirmBox = $('push-confirm');
  const hideConfirm = () => confirmBox?.classList.add('hidden');
  $('push-send').onclick = () => {
    const title = $('push-title').value.trim();
    const body = $('push-body').value.trim();
    const segment = $('push-segment').value;
    if (!title || !body) {
      toast('სათაური და ტექსტი სავალდებულოა', 'bad');
      return;
    }
    const copy = $('push-confirm-copy');
    if (copy) copy.textContent = `„${title}“ წავა სეგმენტზე: ${SEGMENT_LABELS[segment] || segment} (${segmentReach(segment)}).`;
    confirmBox?.classList.remove('hidden');
    $('push-confirm-yes')?.focus();
  };
  $('push-confirm-no').onclick = hideConfirm;
  $('push-confirm-yes').onclick = async () => {
    const title = $('push-title').value.trim();
    const body = $('push-body').value.trim();
    const segment = $('push-segment').value;
    hideConfirm();
    $('push-send').disabled = true;
    $('push-confirm-yes').disabled = true;
    try {
      const result = await api('/push/campaigns', {
        method: 'POST',
        body: { title, body, segment },
      });
      const target = result.campaign?.targetCount ?? 0;
      toast(`რიგში ჩადგა: ${fmtN(target)} მოწყობილობა. იგზავნება ფონურად.`, 'ok');
      pushStudioTab = 'compose';
      await renderPush();
    } catch (err) {
      toast(err.message || 'გაგზავნა ვერ მოხერხდა', 'bad');
      $('push-send').disabled = false;
      $('push-confirm-yes').disabled = false;
    }
  };

  document.querySelectorAll('[data-campaign]').forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation?.();
      viewPushCampaign(el.dataset.campaign);
    };
  });

  document.querySelectorAll('[data-copy-group]').forEach((btn) => {
    btn.onclick = () => {
      pushCopyGroup = btn.dataset.copyGroup;
      document.querySelectorAll('[data-copy-group]').forEach((el) => {
        el.classList.toggle('active', el.dataset.copyGroup === pushCopyGroup);
      });
      document.querySelectorAll('[data-tpl-group]').forEach((group) => {
        const show = pushCopyGroup === 'all' || group.dataset.tplGroup === pushCopyGroup;
        group.classList.toggle('hidden', !show);
      });
    };
  });

  const filterTemplates = () => {
    const q = ($('push-tpl-q')?.value || '').trim().toLowerCase();
    document.querySelectorAll('.push-template-card').forEach((card) => {
      const hay = `${card.dataset.tplLabel || ''} ${card.querySelector('[data-tpl-title]')?.value || ''} ${card.querySelector('[data-tpl-body]')?.value || ''}`.toLowerCase();
      card.classList.toggle('hidden', Boolean(q) && !hay.includes(q));
    });
  };
  $('push-tpl-q')?.addEventListener('input', filterTemplates);

  document.querySelectorAll('[data-history-view]').forEach((btn) => {
    btn.onclick = () => {
      pushHistoryView = btn.dataset.historyView;
      document.querySelectorAll('[data-history-view]').forEach((el) => {
        el.classList.toggle('active', el.dataset.historyView === pushHistoryView);
      });
      document.querySelectorAll('[data-history-pane]').forEach((pane) => {
        pane.classList.toggle('hidden', pane.dataset.historyPane !== pushHistoryView);
      });
    };
  });

  $('push-history-q')?.addEventListener('input', () => {
    const q = ($('push-history-q').value || '').trim().toLowerCase();
    document.querySelectorAll('[data-history-text]').forEach((card) => {
      card.classList.toggle('hidden', Boolean(q) && !(card.dataset.historyText || '').toLowerCase().includes(q));
    });
  });

  document.querySelectorAll('[data-tpl-save]').forEach((btn) => {
    btn.onclick = async () => {
      const key = btn.dataset.tplSave;
      const title = document.querySelector(`[data-tpl-title="${key}"]`)?.value.trim();
      const body = document.querySelector(`[data-tpl-body="${key}"]`)?.value.trim();
      if (!title || !body) {
        toast('სათაური და ტექსტი სავალდებულოა', 'bad');
        return;
      }
      btn.disabled = true;
      try {
        await api(`/push/templates/${encodeURIComponent(key)}`, { method: 'PUT', body: { title, body } });
        toast('შაბლონი შენახულია');
        pushStudioTab = 'copy';
        await renderPush();
      } catch (err) {
        toast(err.message || 'შენახვა ვერ მოხერხდა', 'bad');
        btn.disabled = false;
      }
    };
  });

  document.querySelectorAll('[data-tpl-reset]').forEach((btn) => {
    btn.onclick = async () => {
      const key = btn.dataset.tplReset;
      if (!confirm('ნაგულისხმევ Medi ტექსტზე დავაბრუნოთ?')) return;
      btn.disabled = true;
      try {
        await api(`/push/templates/${encodeURIComponent(key)}`, { method: 'DELETE' });
        toast('ნაგულისხმევი დაბრუნდა');
        pushStudioTab = 'copy';
        await renderPush();
      } catch (err) {
        toast(err.message || 'ვერ დაბრუნდა', 'bad');
        btn.disabled = false;
      }
    };
  });

  function insertAtCursor(field, text) {
    if (!field) return;
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    field.value = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
    field.focus();
    const cursor = start + text.length;
    field.selectionStart = field.selectionEnd = cursor;
    field.dispatchEvent(new Event('input'));
  }

  const refreshTplLive = (card) => {
    const key = card.dataset.template;
    const tpl = templates.find((t) => t.key === key);
    const title = card.querySelector('[data-tpl-title]')?.value || '';
    const body = card.querySelector('[data-tpl-body]')?.value || '';
    const liveTitle = card.querySelector('[data-tpl-live-title]');
    const liveBody = card.querySelector('[data-tpl-live-body]');
    if (liveTitle) liveTitle.textContent = pushPreviewCopy(title, tpl?.sample || {}) || title;
    if (liveBody) liveBody.textContent = pushPreviewCopy(body, tpl?.sample || {}) || body;
  };

  document.querySelectorAll('.push-template-card').forEach((card) => {
    let lastField = card.querySelector('[data-tpl-body]');
    card.querySelectorAll('[data-tpl-title], [data-tpl-body]').forEach((field) => {
      field.addEventListener('focus', () => { lastField = field; });
      field.addEventListener('input', () => refreshTplLive(card));
    });
    card.querySelectorAll('[data-ph]').forEach((chip) => {
      chip.onclick = () => insertAtCursor(lastField, `{${chip.dataset.ph}}`);
    });
  });

  document.querySelectorAll('[data-ph-global]').forEach((chip) => {
    chip.onclick = () => {
      const focused = document.activeElement;
      const field = focused?.matches?.('[data-tpl-title], [data-tpl-body]')
        ? focused
        : document.querySelector('.push-template-card:not(.hidden) [data-tpl-body]');
      insertAtCursor(field, `{${chip.dataset.phGlobal}}`);
    };
  });

  const showKeys = $('push-show-keys');
  if (showKeys) {
    showKeys.onchange = () => {
      pushShowKeys = showKeys.checked;
      document.querySelectorAll('.push-template-key').forEach((el) => {
        el.hidden = !pushShowKeys;
      });
    };
  }

  watchPushCampaigns(
    campaigns.filter((c) => PUSH_CAMPAIGN_LIVE.has(c.status)).map((c) => c.id),
    () => { if (document.getElementById('push-compose-form')) void renderPush(); },
  );
}

function pushDeliveryTone(pct) {
  if (pct == null) return 'neutral';
  if (pct >= 90) return 'ok';
  if (pct >= 70) return 'std';
  return 'bad';
}

function pushDeliveryRing(sent, target, caption, { compact = false } = {}) {
  const pct = target ? Math.round((sent / target) * 100) : null;
  const tone = pushDeliveryTone(pct);
  const display = pct == null ? '—' : pct;
  const ringPct = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  const wrapClass = compact ? 'ai-hero-score compact' : 'ai-hero-score';
  return `
    <div class="${wrapClass}">
      <div class="ai-score-ring ${tone}" style="--pct:${ringPct}">
        <div class="ai-score-inner">
          <span class="ai-score-val">${display}</span>
          <span class="ai-score-lbl">${pct == null ? '' : '%'}</span>
        </div>
      </div>
      ${caption ? `<p class="ai-score-caption">${caption}</p>` : ''}
    </div>
  `;
}

async function viewPushCampaign(id) {
  const { campaigns } = await api('/push/campaigns');
  const campaign = campaigns.find((c) => c.id === id);
  if (!campaign) {
    toast('კამპანია ვერ მოიძებნა', 'bad');
    return;
  }

  const SEGMENT_LABELS = PUSH_SEGMENT_LABELS;

  openDrawer(`
    <p class="kicker">Push კამპანია</p>
    <h3>${escapeHtml(campaign.title)}</h3>
    <p class="muted" style="font-size:13px;margin:6px 0 0">${escapeHtml((campaign.body || '').slice(0, 180))}${(campaign.body || '').length > 180 ? '…' : ''}</p>
    <p class="muted mono" style="font-size:11px">${escapeHtml(campaign.id)}</p>
    <div class="drawer-stats">
      <div class="drawer-stat"><div class="label">სეგმენტი</div><strong>${SEGMENT_LABELS[campaign.segment] || campaign.segment}</strong></div>
      <div class="drawer-stat"><div class="label">სტატუსი</div><strong>${escapeHtml(pushCampaignStatusText(campaign))}</strong></div>
      <div class="drawer-stat"><div class="label">მიწოდება</div><strong>${campaign.sentCount}/${campaign.targetCount}</strong></div>
      <div class="drawer-stat"><div class="label">შეცდომა</div><strong>${campaign.failedCount}</strong></div>
    </div>
    ${pushDeliveryRing(campaign.sentCount || 0, campaign.targetCount || 0, fmtDate(campaign.sentAt || campaign.createdAt), { compact: true })}
    <div class="field"><span>ტექსტი</span><div class="ai-drawer-block"><pre>${escapeHtml(campaign.body)}</pre></div></div>
    <div class="field"><span>ადმინი</span><div class="ai-drawer-block"><pre>${escapeHtml(campaign.createdBy?.fullName || '—')}${campaign.createdBy?.email ? `\n${campaign.createdBy.email}` : ''}</pre></div></div>
    ${Array.isArray(campaign.data?.deliveries) && campaign.data.deliveries.length ? `
      <div class="field"><span>მიწოდება მოწყობილობებზე${campaign.data?.progress ? ' (პირველი 50)' : ''}</span>
        <div class="push-device-list">
          ${campaign.data.deliveries.map((d) => `
            <div class="push-device-row">
              <span class="badge ${d.status === 'ok' ? 'ok' : 'bad'}">${d.status === 'ok' ? 'OK' : 'ERR'}</span>
              <div class="stack">
                <strong>${escapeHtml(d.tokenPreview || '—')}</strong>
                <span class="sub muted">${escapeHtml(d.ticketId || d.error || '')}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    <div class="row"><button class="btn ghost" id="drawer-cancel">დახურვა</button></div>
  `);
  $('drawer-cancel').onclick = closeDrawer;
}

const AI_MODE_LABELS = {
  DOCTOR: 'Medi',
  CONSILIUM: 'კონსილიუმი',
  LAB: 'ლაბორატორია',
  IMAGING: 'იმიჯინგი',
  SKIN: 'კანი',
  SKINCARE: 'სკინქეარი',
  MEDICATION: 'მედიკამენტები',
  CYCLE_WELLNESS: 'ციკლი',
  SYMPTOM_CHECKER: 'სიმპტომების შემოწმება',
};

function aiScoreTone(score) {
  if (score == null || score === '—') return 'neutral';
  const n = Number(score);
  if (n >= 80) return 'ok';
  if (n >= 72) return 'std';
  return 'bad';
}

function aiScoreRing(score, caption, { compact = false } = {}) {
  const tone = aiScoreTone(score);
  const pct = score == null ? 0 : Math.min(100, Math.max(0, Number(score)));
  const display = score == null ? '—' : score;
  const wrapClass = compact ? 'ai-hero-score compact' : 'ai-hero-score';
  return `
    <div class="${wrapClass}">
      <div class="ai-score-ring ${tone}" style="--pct:${pct}">
        <div class="ai-score-inner">
          <span class="ai-score-val">${display}</span>
          <span class="ai-score-lbl">/ 100</span>
        </div>
      </div>
      ${caption ? `<p class="ai-score-caption">${caption}</p>` : ''}
    </div>
  `;
}

function aiModeBars(byMode) {
  const rows = Array.isArray(byMode) ? byMode : [];
  if (!rows.length) {
    return typeof opsEmpty === 'function'
      ? opsEmpty('ამ პერიოდში მოდული არ არის', 'Medi გამოძახებები აქ გამოჩნდება.')
      : '<p class="muted">ჯერ მონაცემი არ არის.</p>';
  }
  const max = Math.max(1, ...rows.map((m) => Number(m.count) || 0));
  const total = rows.reduce((sum, m) => sum + (Number(m.count) || 0), 0) || 1;
  return `<div class="v3-medi-modes">${rows.map((m) => {
    const count = Number(m.count) || 0;
    const width = Math.max(6, Math.min(100, Math.round((count / max) * 100)));
    const share = Math.min(100, Math.round((count / total) * 100));
    return `<div class="v3-medi-mode">
      <span class="v3-medi-mode-label">${escapeHtml(AI_MODE_LABELS[m.mode] || m.mode)}</span>
      <span class="v3-medi-mode-track"><i style="width:${width}%"></i></span>
      <strong class="v3-medi-mode-val">${typeof opsFmt === 'function' ? opsFmt(count) : count}<em>${share}%</em></strong>
    </div>`;
  }).join('')}</div>`;
}

function aiInitials(name) {
  return (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

async function renderAi() {
  const root = $('tab-ai');
  const helpBtn = (key) => (typeof window.AdminV3?.infoButton === 'function' ? window.AdminV3.infoButton(key) : '');
  const fmt = (n) => (typeof opsFmt === 'function' ? opsFmt(n) : String(n ?? '—'));
  const deltaHtml = (d) => (typeof opsDelta === 'function' ? opsDelta(d) : '');

  root.innerHTML = `<div class="ai-page v25-ai v3-workspace-wide v3-module v3-medi">
    <div class="v3-medi-toolbar">
      <div class="v3-medi-toolbar-copy">
        <strong>Medi ობსერვატორია</strong>
        <span>საიმედოობა · შეცდომები · ხარისხი · თბილისი</span>
      </div>
      ${typeof opsRangeBar === 'function' ? opsRangeBar() : ''}
    </div>
    <div id="medi-body">${typeof opsSkeleton === 'function' ? opsSkeleton(6) : '…'}</div>
  </div>`;

  if (typeof bindOpsRange === 'function') bindOpsRange(renderAi);

  try {
    const [stats, list, evalRuns, usage] = await Promise.all([
      api('/ai/stats'),
      api('/ai/interactions?limit=25'),
      api('/ai/eval-runs'),
      typeof opsQs === 'function'
        ? api(`/analytics/medi?${opsQs()}`).catch(() => null)
        : Promise.resolve(null),
    ]);

    const interactions = list?.interactions || [];
    const total = list?.total ?? interactions.length;
    const runs = evalRuns?.runs || [];
    const lastEval = stats.lastEval;
    const fbTotal = (stats.feedback?.up || 0) + (stats.feedback?.down || 0);
    const fbPct = fbTotal ? Math.min(100, Math.round((stats.feedback.up / fbTotal) * 100)) : null;
    const k = usage?.kpis || {};
    const errRate = k.errorRate?.value;
    const errTone = errRate == null ? '' : errRate > 5 ? ' is-danger' : errRate > 0 ? ' is-amber' : ' is-ok';

    const kpi = (tone, ico, label, value, hint) =>
      `<article class="v3-medi-kpi${tone || ''}">
        <span class="v3-medi-kpi-ico" aria-hidden="true">${icon(ico)}</span>
        <div class="v3-medi-kpi-copy"><span>${label}</span><strong>${value}</strong>${hint ? `<em>${hint}</em>` : ''}</div>
      </article>`;

    const kpis = `<div class="v3-medi-kpis" role="group" aria-label="Medi მეტრიკები">
      ${kpi('', 'users', 'Medi მომხმარებლები', fmt(k.mediUsers?.value ?? '—'), deltaHtml(k.mediUsers?.delta) || 'პერიოდში')}
      ${kpi('', 'message', 'მოთხოვნები', fmt(k.messages?.value ?? stats.last7d), deltaHtml(k.messages?.delta) || `${fmt(stats.last24h)} · 24სთ`)}
      ${kpi('', 'layers', 'საუბრები', fmt(k.conversations?.value ?? '—'), deltaHtml(k.conversations?.delta) || (k.avgMessagesPerConversation?.value != null ? `საშ. ${k.avgMessagesPerConversation.value}/საუბარი` : ''))}
      ${kpi(errTone, 'alert', 'შეცდომის წილი', errRate == null ? '—' : `${Math.min(100, Number(errRate))}%`, `${fmt(k.errors?.value ?? stats.errors24h)} შეცდომა`)}
      ${kpi('', 'zap', 'დაყოვნება', k.avgLatencyMs?.value != null ? `${fmt(k.avgLatencyMs.value)} ms` : `${fmt(stats.avgLatencyMs)} ms`, 'საშუალო')}
      ${kpi(lastEval?.avgScore != null && lastEval.avgScore < 72 ? ' is-amber' : ' is-soft', 'spark', 'ბოლო სკანი', lastEval?.avgScore ?? '—', lastEval ? fmtDateShort(lastEval.finishedAt) : 'ჯერ არ გაშვებულა')}
    </div>`;

    const chartSeries = [];
    if (usage?.charts?.messages?.some((d) => d.count > 0)) {
      chartSeries.push({ points: usage.charts.messages, tone: 'teal', label: 'მოთხოვნები' });
    }
    if (usage?.charts?.errors?.some((d) => d.count > 0)) {
      chartSeries.push({ points: usage.charts.errors, tone: 'rose', label: 'შეცდომები' });
    }
    if (usage?.charts?.users?.some((d) => d.count > 0)) {
      chartSeries.push({ points: usage.charts.users, tone: 'blue', label: 'მომხმარებლები' });
    }
    const charts = `<section class="v3-medi-panel" data-v3-medi="usage">
      <div class="v3-medi-head"><div class="v3-medi-head-copy">
        <div class="v3-title-row"><h3>დროითი წარმადობა</h3>${helpBtn('medi.errors')}</div>
        <p class="muted">${escapeHtml(usage?.kpis?.estimatedCostNote || usage?.privacy || 'პირადი საუბრის ტექსტი აქედან არ ბრუნდება.')}${k.tokens?.total != null ? ` · ტოკენები: ${fmt(k.tokens.total)}` : ''}</p>
      </div></div>
      <div class="v3-medi-charts">
        ${chartSeries.length && typeof opsLineChart === 'function'
          ? opsLineChart(chartSeries, { label: 'Medi მოთხოვნები, შეცდომები და მომხმარებლები', height: 156 })
          : (typeof opsEmpty === 'function'
            ? opsEmpty('ამ პერიოდში Medi არ გამოიყენეს', 'ეს რეალური AI გამოძახებებია, არა ნიმუში.')
            : '<p class="muted">მონაცემი არ არის.</p>')}
      </div>
    </section>`;

    const opsStrip = `<div class="v3-medi-ops" role="group" aria-label="ოპერაციული სნეპშოტი">
      <article class="v3-medi-ops-item"><span>24 საათი</span><strong>${fmt(stats.last24h)}</strong><em>${fmt(stats.errors24h)} შეცდომა</em></article>
      <article class="v3-medi-ops-item"><span>7 დღე</span><strong>${fmt(stats.last7d)}</strong><em>საშ. ${fmt(stats.avgLatencyMs)} ms</em></article>
      <article class="v3-medi-ops-item"><span>უკუკავშირი</span><strong>${fmt(stats.feedback?.up)} ↑ ${fmt(stats.feedback?.down)} ↓</strong><em>${fbPct != null ? `${fbPct}% კარგი · ` : ''}${fmt(fbTotal)} შეფასება</em></article>
      <article class="v3-medi-ops-item"><span>დაბრუნებული</span><strong>${fmt(k.returningUsers?.value ?? '—')}</strong><em>წინა Medi მომხმარებლები</em></article>
    </div>`;

    const scanCard = `<section class="v3-medi-panel v3-medi-scan" data-v3-medi="quality">
      <div class="v3-medi-head"><div class="v3-medi-head-copy">
        <div class="v3-title-row"><h3>ხარისხის სკანი</h3>${helpBtn('medi.quality')}</div>
        <p class="muted">LLM-as-judge — ქართული, disclaimer, უსაფრთხოება, კლინიკური სიზუსტე</p>
      </div>
      ${lastEval?.avgScore != null ? `<div class="v3-medi-score ${aiScoreTone(lastEval.avgScore)}"><strong>${lastEval.avgScore}</strong><span>/100</span></div>` : ''}
      </div>
      <div class="v3-medi-scan-body">
        <div class="v3-medi-scan-form">
          <label class="v3-medi-field"><span>სინჯის ზომა (5–40)</span>
            <input id="ai-scan-size" type="number" min="5" max="40" value="20" />
          </label>
          <button type="button" class="btn primary" id="ai-scan-run">${icon('spark')} სკანის გაშვება</button>
        </div>
        ${lastEval?.summary
          ? `<div class="v3-medi-scan-summary">${escapeHtml(lastEval.summary)}</div>`
          : '<p class="v3-medi-foot muted">პირველი სკანი შეაფასებს ბოლო პასუხებს რუბრიკით 0–100.</p>'}
      </div>
    </section>`;

    const modeRows = (usage?.byMode?.length ? usage.byMode : stats.byMode) || [];
    const modulesCard = `<section class="v3-medi-panel" data-v3-medi="modules">
      <div class="v3-medi-head"><div class="v3-medi-head-copy">
        <div class="v3-title-row"><h3>მოდულები</h3></div>
        <p class="muted">${usage?.byMode?.length ? 'არჩეული პერიოდის AI გამოძახებები' : '7 დღის AI გამოძახებები'}</p>
      </div></div>
      <div class="v3-medi-modes-wrap">${aiModeBars(modeRows)}</div>
    </section>`;

    function feedbackCell(row) {
      const fb = row.feedback?.[0];
      if (!fb) return '<span class="muted">—</span>';
      return fb.rating > 0
        ? `<span class="badge ok">${icon('check')} კარგი</span>`
        : `<span class="badge bad">${icon('x')} ცუდი</span>`;
    }

    const logCard = `<section class="v3-medi-panel" data-v3-medi="interactions">
      <div class="v3-medi-head"><div class="v3-medi-head-copy">
        <div class="v3-title-row"><h3>ბოლო ურთიერთობები</h3>${helpBtn('medi.interactions')}</div>
        <p class="muted">${fmt(total)} ჩანაწერი სისტემაში · პირადი ტექსტი ცხრილში არ ჩანს</p>
      </div></div>
      <div class="v3-medi-table-wrap">
        <table class="v3-medi-table">
          <thead><tr><th>დრო</th><th>მომხმარებელი</th><th>მოდული</th><th>სტატუსი</th><th>დრო (ms)</th><th>უკუკავშირი</th><th class="col-actions">მოქმედება</th></tr></thead>
          <tbody>
            ${interactions.length ? interactions.map((row) => `
              <tr>
                <td class="mono">${fmtDateShort(row.createdAt)}</td>
                <td>
                  <div class="v3-medi-person">
                    <div class="v3-medi-avatar">${escapeHtml(aiInitials(row.user?.fullName))}</div>
                    <div class="v3-medi-person-copy">
                      <strong>${escapeHtml(row.user?.fullName || '—')}</strong>
                      <span>${escapeHtml(row.user?.email || row.user?.phone || '')}</span>
                    </div>
                  </div>
                </td>
                <td><span class="badge neutral">${escapeHtml(AI_MODE_LABELS[row.mode] || row.mode)}</span></td>
                <td>${row.status === 'OK' ? '<span class="badge ok">OK</span>' : '<span class="badge bad">შეცდომა</span>'}</td>
                <td class="mono">${row.latencyMs != null ? `${row.latencyMs} ms` : '—'}</td>
                <td>${feedbackCell(row)}</td>
                ${tableActionCell(`<button type="button" class="btn tiny ghost" data-ai-view="${row.id}">${icon('file')} ნახვა</button>`)}
              </tr>
            `).join('') : '<tr><td colspan="7"><div class="empty"><strong>ჩანაწერები ცარიელია</strong><p>AI გამოძახების შემდეგ აქ გამოჩნდება.</p></div></td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`;

    const historyCard = `<section class="v3-medi-panel" data-v3-medi="scans">
      <div class="v3-medi-head"><div class="v3-medi-head-copy">
        <div class="v3-title-row"><h3>სკანის ისტორია</h3>${helpBtn('medi.quality')}</div>
        <p class="muted">${fmt(runs.length)} გაშვება</p>
      </div></div>
      ${runs.length ? `<div class="v3-medi-runs">
        ${runs.map((run) => `
          <article class="v3-medi-run" data-run="${run.id}" role="button" tabindex="0">
            <div class="v3-medi-run-top">
              <div class="v3-medi-run-score ${aiScoreTone(run.avgScore)}">
                <strong>${run.avgScore ?? '—'}</strong><span>/100</span>
              </div>
              ${run.status === 'DONE' ? '<span class="badge ok">მზადა</span>' : run.status === 'FAILED' ? '<span class="badge bad">ჩავარდა</span>' : '<span class="badge std">მიმდ.</span>'}
            </div>
            <div class="v3-medi-run-meta">${fmtDate(run.finishedAt || run.createdAt)} · ${run.lowScoreCount}/${run.sampleSize} დაბალი</div>
            <p class="v3-medi-run-summary">${escapeHtml(run.summary || '—')}</p>
          </article>
        `).join('')}
      </div>` : '<div class="empty v3-medi-empty"><strong>სკანი ჯერ არ გაშვებულა</strong><p>გაუშვით ხარისხის სკანი ზემოთ.</p></div>'}
    </section>`;

    $('medi-body').innerHTML = `<div class="v3-medi-body">
      ${kpis}
      ${opsStrip}
      ${charts}
      <div class="v3-medi-split">${scanCard}${modulesCard}</div>
      ${logCard}
      ${historyCard}
    </div>`;

    $('ai-scan-run').onclick = async () => {
      const sampleSize = Number($('ai-scan-size').value) || 20;
      if (!confirm(`გავუშვათ ხარისხის სკანი (${sampleSize} პასუხი)? შეიძლება OpenRouter კრედიტი დაიხარჯოს.`)) return;
      $('ai-scan-run').disabled = true;
      try {
        const result = await api('/ai/scan', { method: 'POST', body: { sampleSize } });
        toast(`სკანი დასრულდა — საშუალო ${result.run.avgScore ?? '—'}/100`);
        await renderAi();
      } catch (err) {
        toast(err.message || 'სკანი ვერ დასრულდა', 'bad');
        const btn = $('ai-scan-run');
        if (btn) btn.disabled = false;
      }
    };

    document.querySelectorAll('[data-ai-view]').forEach((btn) => {
      btn.onclick = () => viewAiInteraction(btn.dataset.aiView);
    });
    document.querySelectorAll('[data-run]').forEach((el) => {
      el.onclick = () => viewEvalRun(el.dataset.run);
      el.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          viewEvalRun(el.dataset.run);
        }
      };
    });
  } catch (err) {
    $('medi-body').innerHTML = typeof opsError === 'function'
      ? opsError(err.message, 'medi-retry')
      : `<div class="empty"><strong>შეცდომა</strong><p>${escapeHtml(err.message)}</p></div>`;
    $('medi-retry')?.addEventListener('click', renderAi);
  }
}

async function viewAiInteraction(id) {
  const { interaction } = await api(`/ai/interactions/${id}`);
  const fb = interaction.feedback?.[0];
  openDrawer(`
    <p class="kicker">${AI_MODE_LABELS[interaction.mode] || interaction.mode}</p>
    <h3>AI ურთიერთობა</h3>
    <p class="muted mono" style="font-size:11px">${escapeHtml(interaction.id)}</p>
    <div class="drawer-stats">
      <div class="drawer-stat"><div class="label">მომხმარებელი</div><strong>${escapeHtml(interaction.user?.fullName || '—')}</strong></div>
      <div class="drawer-stat"><div class="label">სტატუსი</div><strong>${interaction.status === 'OK' ? '✓ წარმატებული' : '✗ შეცდომა'}</strong></div>
      <div class="drawer-stat"><div class="label">მოდელი</div><strong class="mono">${escapeHtml(interaction.reasoningModel || '—')}</strong></div>
      <div class="drawer-stat"><div class="label">Prompt</div><strong class="mono">v${escapeHtml(interaction.promptVersion)}</strong></div>
      <div class="drawer-stat"><div class="label">დრო (ms)</div><strong>${interaction.latencyMs ?? '—'} ms</strong></div>
    </div>
    ${fb ? `<span class="ai-pill ${fb.rating > 0 ? 'ok' : 'bad'}">${fb.rating > 0 ? '👍 კარგი' : '👎 ცუდი'}${fb.comment ? ` · ${escapeHtml(fb.comment)}` : ''}</span>` : ''}
    <div class="field"><span>შეკითხვა / კონტექსტი</span><div class="ai-drawer-block"><pre>${escapeHtml(interaction.userPrompt || '—')}</pre></div></div>
    <div class="field"><span>AI პასუხი</span><div class="ai-drawer-block"><pre>${escapeHtml(interaction.assistantReply || interaction.errorMessage || '—')}</pre></div></div>
    <div class="row"><button class="btn ghost" id="drawer-cancel">დახურვა</button></div>
  `);
  $('drawer-cancel').onclick = closeDrawer;
}

async function viewEvalRun(id) {
  const { run } = await api(`/ai/eval-runs/${id}`);
  openDrawer(`
    <p class="kicker">ხარისხის სკანი</p>
    <h3>სკანის დეტალები</h3>
    ${aiScoreRing(run.avgScore, `${run.lowScoreCount}/${run.sampleSize} დაბალი`, { compact: true })}
    <p class="muted">${escapeHtml(run.summary || '')}</p>
    <div class="detail-list" style="margin-top:14px">
      ${run.results.map((r) => `
        <div class="detail">
          <span>${AI_MODE_LABELS[r.mode] || r.mode}</span>
          <strong>${r.passed ? '✓' : '✗'} ${r.score}</strong>
        </div>
        ${r.notes ? `<p class="muted" style="margin:0 0 10px;font-size:12px;line-height:1.5">${escapeHtml(r.notes)}</p>` : ''}
      `).join('')}
    </div>
    <div class="row"><button class="btn ghost" id="drawer-cancel">დახურვა</button></div>
  `);
  $('drawer-cancel').onclick = closeDrawer;
}

async function renderSettings() {
  const { settings } = await api('/settings');
  setLivePill(settings);
  $('tab-settings').innerHTML = `
    <div class="v25-settings dash-enter">
      <div class="v25-strip v25-strip-n4">
        ${v25StripCell('globe', "ოფლაინი", onOffLabel(settings.maintenanceMode), '', settings.maintenanceMode ? ' is-warn' : ' is-ok')}
        ${v25StripCell('zap', "იძ. განახლება", onOffLabel(settings.forceUpdate), '', settings.forceUpdate ? ' is-warn' : '')}
        ${v25StripCell('users', "რეგისტრაცია", settings.allowRegistrations ? "ღიაა" : "დახურულია", '')}
        ${v25StripCell('shield', 'QA OTP', onOffLabel(settings.qaOtpEnabled), '', settings.qaOtpEnabled ? ' is-warn' : '')}
      </div>
      <div class="v25-settings-form">
      <section class="v25-set">
        <h3>${iconTile('settings')}აპის ქცევა</h3>
        <p class="lead">რეჟიმები, რომლებიც წყვეტენ ვინ შედის აპში.</p>
        <label class="toggle">
          <div>
            <strong>ოფლაინი / განახლება</strong>
            <p>აპი და API გაჩერდება მომხმარებლებისთვის. ადმინი რჩება ხელმისაწვდომი.</p>
          </div>
          <span class="switch"><input id="set-maint" type="checkbox" ${settings.maintenanceMode ? 'checked' : ''}/><i></i></span>
        </label>
        <label class="toggle">
          <div>
            <strong>იძულებითი განახლება</strong>
            <p>ძველი აპის ვერსია ვერ შევა სისტემაში.</p>
          </div>
          <span class="switch"><input id="set-force" type="checkbox" ${settings.forceUpdate ? 'checked' : ''}/><i></i></span>
        </label>
        <label class="toggle">
          <div>
            <strong>რეგისტრაცია</strong>
            <p>ახალი ანგარიშების გახსნა.</p>
          </div>
          <span class="switch"><input id="set-reg" type="checkbox" ${settings.allowRegistrations ? 'checked' : ''}/><i></i></span>
        </label>
        <label class="toggle">
          <div>
            <strong>QA OTP</strong>
            <p>ტესტის კოდი 0000 (ტელეფონი) და 000000 (ელ-ფოსტა) ყოველთვის მუშაობს. გამორთე ტესტის შემდეგ.</p>
          </div>
          <span class="switch"><input id="set-qa-otp" type="checkbox" ${settings.qaOtpEnabled ? 'checked' : ''}/><i></i></span>
        </label>
      </section>
      <section class="v25-set">
        <h3>${iconTile('zap')}ვერსიები და მხარდაჭერა</h3>
        <p class="lead">მინიმალური ვერსია და საკონტაქტო.</p>
        <div class="field" style="margin-top:4px">
          <span>ოფლაინის შეტყობინება</span>
          <textarea id="set-msg" rows="3">${escapeHtml(settings.maintenanceMessage)}</textarea>
        </div>
        <div class="field">
          <span>აპის ვერსია (mobile/app.json)</span>
          <input value="${escapeAttr(settings.mobileAppVersion || '—')}" readonly />
        </div>
        <div class="field">
          <span>მინიმალური აპის ვერსია (API)</span>
          <input id="set-minver" value="${escapeAttr(settings.minAppVersion)}" placeholder="${escapeAttr(settings.mobileAppVersion || '1.0.0')}" />
        </div>
        <div class="field">
          <span>მხარდაჭერის ელ-ფოსტა</span>
          <input id="set-email" value="${escapeAttr(settings.supportEmail)}" />
        </div>
        <div class="row v25-set-foot" style="justify-content:flex-end;margin-top:8px">
          <button class="btn primary" id="set-save">${icon('check')} შენახვა</button>
        </div>
      </section>
      </div>
    </div>
  `;
  const markSettingsDirty = () => {
    $('tab-settings')?.classList.add('is-dirty');
    const foot = document.querySelector('.v25-set-foot');
    if (foot && !foot.querySelector('.v25-unsaved')) {
      const hint = document.createElement('span');
      hint.className = 'v25-unsaved';
      hint.textContent = "შეცვლილია";
      foot.prepend(hint);
    }
  };
  document.querySelectorAll('#tab-settings input, #tab-settings textarea, #tab-settings select').forEach((el) => {
    el.addEventListener('input', markSettingsDirty);
    el.addEventListener('change', markSettingsDirty);
  });
  $('set-save').onclick = async () => {
    const next = await api('/settings', {
      method: 'PATCH',
      body: {
        maintenanceMode: $('set-maint').checked,
        maintenanceMessage: $('set-msg').value.trim(),
        minAppVersion: $('set-minver').value.trim(),
        forceUpdate: $('set-force').checked,
        allowRegistrations: $('set-reg').checked,
        qaOtpEnabled: $('set-qa-otp').checked,
        supportEmail: $('set-email').value.trim(),
      },
    });
    setLivePill(next.settings);
    toast("რეჟიმი შენახულია");
    await renderSettings();
  };
}

let pharmacyPollTimer = null;

function syncRunBadge(status) {
  if (status === 'DONE') return '<span class="badge ok">მზადა</span>';
  if (status === 'FAILED') return '<span class="badge bad">ჩავარდა</span>';
  if (status === 'RUNNING') return '<span class="badge std">მიმდ.</span>';
  return `<span class="badge neutral">${escapeHtml(status || '—')}</span>`;
}

function syncDuration(startedAt, finishedAt) {
  if (!startedAt) return '—';
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const sec = Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 1000));
  if (sec < 60) return `${sec}წ`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}წ ${rem}წ`;
}

function gel(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)} ₾`;
}

function pharmSourceTone(status) {
  if (status === 'DONE') return 'ok';
  if (status === 'FAILED') return 'bad';
  if (status === 'RUNNING') return 'std';
  return 'neutral';
}

function pharmSourceCard(src, catalog, sourceStatus, syncMeta) {
  const last = sourceStatus[src.id];
  const offers = catalog.offersBySource[src.id] || 0;
  const meta = syncMeta[src.id];
  const share = catalog.offers ? Math.round((offers / catalog.offers) * 100) : 0;
  const tone = pharmSourceTone(last?.status);
  const badge =
    last?.status === 'DONE'
      ? '<span class="badge ok">ონლაინ</span>'
      : last?.status === 'FAILED'
        ? '<span class="badge bad">ჩავარდა</span>'
        : last?.status === 'RUNNING'
          ? '<span class="badge std">სინქი</span>'
          : '<span class="badge neutral">გამორთ.</span>';

  return `
    <article class="pharm-source ${tone}">
      <div class="pharm-source-top">
        ${iconTile('pill', tone === 'ok' ? 'teal' : tone === 'bad' ? 'bad' : tone === 'std' ? 'std' : '')}
        <div class="pharm-source-copy">
          <strong>${escapeHtml(src.label)}</strong>
          <span class="muted">${meta ? `ბოლო · ${fmtDateShort(meta.finishedAt)}` : 'ჯერ არ გაუშვებულა'}</span>
        </div>
        ${badge}
      </div>
      <div class="pharm-source-balance">${offers.toLocaleString('ka-GE')}</div>
      <div class="pharm-source-meta">
        <span>შეთავაზება</span>
        <strong class="mono">${share}% კატალოგის</strong>
      </div>
      <div class="bar teal"><span style="width:${Math.max(share, 2)}%"></span></div>
      <div class="pharm-source-stats">
        <div><span>ჩატვირთული</span><strong class="mono">${last?.itemsFetched ?? '—'}</strong></div>
        <div><span>ხანგრძლ.</span><strong class="mono">${last ? syncDuration(last.startedAt, last.finishedAt) : '—'}</strong></div>
      </div>
      ${last?.error ? `<p class="pharm-source-error">${escapeHtml(last.error.slice(0, 140))}${last.error.length > 140 ? '…' : ''}</p>` : ''}
      ${
        last?.status === 'FAILED'
          ? `<button type="button" class="btn tiny ghost pharm-retry" data-source="${src.id}">${icon('refresh')} ხელახლა</button>`
          : ''
      }
    </article>
  `;
}

function pharmDealRow(deal, rank) {
  return `
    <div class="pharm-deal">
      <div class="pharm-deal-rank">${rank}</div>
      <div class="pharm-deal-body">
        <strong>${escapeHtml(deal.name.slice(0, 64))}${deal.name.length > 64 ? '…' : ''}</strong>
        <span class="muted">${deal.offerCount} აფთიაქი · საუკეთესო · ${escapeHtml(deal.bestSource)}</span>
      </div>
      <div class="pharm-deal-prices">
        <span class="pharm-deal-best mono">${gel(deal.bestPriceGel)}</span>
        <span class="pharm-deal-was mono muted">${gel(deal.maxPriceGel)}</span>
        <span class="pharm-deal-save">−${deal.savePct}%</span>
      </div>
    </div>
  `;
}

function pharmSyncPreview() {
  return `
    <div class="pharm-preview">
      <div class="pharm-preview-label">აპში გამოჩენა</div>
      <div class="pharm-preview-phone">
        <div class="pharm-preview-head">
          <span>ფასების შედარება</span>
          <span class="mono muted">3 აფთიაქი</span>
        </div>
        <div class="pharm-preview-product">
          <div class="pharm-preview-thumb">${icon('pill')}</div>
          <div>
            <strong>ამოქსიცილინი 500 მგ</strong>
            <span class="muted">20 ტაბლეტი</span>
          </div>
        </div>
        <div class="pharm-preview-rows">
          <div class="pharm-preview-row best">
            <span>ფარმადეპო</span>
            <strong class="mono">12.40 ₾</strong>
          </div>
          <div class="pharm-preview-row">
            <span>ავერსი</span>
            <strong class="mono">14.90 ₾</strong>
          </div>
          <div class="pharm-preview-row">
            <span>PSP</span>
            <strong class="mono">15.20 ₾</strong>
          </div>
        </div>
        <div class="pharm-preview-foot">
          <span class="pharm-preview-save">დაზოგავთ 2.80 ₾</span>
          <span class="muted">18% უფრო იაფი</span>
        </div>
      </div>
    </div>
  `;
}

async function renderPharmacy() {
  if (pharmacyPollTimer) {
    clearInterval(pharmacyPollTimer);
    pharmacyPollTimer = null;
  }

  const [{ catalog, syncMeta, running, sourceStatus, recentFailures, insights }, { runs, total }] = await Promise.all([
    api('/pharmacy/stats'),
    api('/pharmacy/sync-runs?limit=40'),
  ]);

  const sources = [
    { id: 'PHARMADEPOT', label: 'ფარმადეპო', tone: 'teal' },
    { id: 'AVERSI', label: 'ავერსი', tone: '' },
    { id: 'PSP', label: 'PSP', tone: '' },
  ];

  const comparedPct = catalog.products
    ? Math.round((catalog.comparedProducts / catalog.products) * 100)
    : 0;
  const triplePct = catalog.products
    ? Math.round((insights.tripleCompare / catalog.products) * 100)
    : 0;
  const stockPct = catalog.offers
    ? Math.round((insights.inStockOffers / catalog.offers) * 100)
    : 0;
  const ringTone = comparedPct >= 70 ? 'ok' : comparedPct >= 40 ? 'std' : catalog.products ? 'bad' : 'neutral';
  const runningSource = running?.source ? escapeHtml(running.source) : '';
  const runningDur = running ? syncDuration(running.startedAt, null) : '';

  $('tab-pharmacy').innerHTML = `
    <div class="pharm-page v25-pharm">
      ${running ? `
        <div class="pharm-live-banner">
          ${icon('activity')}
          <div>
            <strong>სინქრონიზაცია მიმდინარეობს</strong>
            <span>${runningSource} · ${runningDur} · ${running.itemsFetched ?? 0} ჩანაწერი</span>
          </div>
          <span class="pharm-live-dot" aria-hidden="true"></span>
        </div>
      ` : ''}

      <div class="v25-strip v25-strip-n4">
        ${v25StripCell('layers', "კატალოგი", catalog.products.toLocaleString('ka-GE'), "კანონიკური პროდუქტი")}
        ${v25StripCell('wallet', "შეთავაზებები", catalog.offers.toLocaleString('ka-GE'), insights.inStockOffers.toLocaleString('ka-GE') + ' ' + "მარაგში")}
        ${v25StripCell('globe', "2-წყარო+", catalog.comparedProducts.toLocaleString('ka-GE'), comparedPct + "% დაფარვა", ringTone === 'bad' ? ' is-warn' : ringTone === 'ok' ? ' is-ok' : '')}
        ${v25StripCell('check', "3-წყარო", insights.tripleCompare.toLocaleString('ka-GE'), triplePct + "% სრული შედარება")}
      </div>

      <div class="v25-panel pharm-sources-wrap">
        <div class="card-head">
          ${iconTile('globe', 'teal')}
          <div>
            <h3>აფთიაქის წყაროები</h3>
            <p class="muted">offer-ების წილი, ბოლო სინქი და სტატუსი თითო პროვაიდერზე</p>
          </div>
        </div>
        <div class="pharm-sources">
          ${sources.map((src) => pharmSourceCard(src, catalog, sourceStatus, syncMeta)).join('')}
        </div>
      </div>

      <div class="ai-split pharm-split">
        <div class="v25-panel pharm-sync-card">
          <div class="card-head">${iconTile('refresh', 'teal')}<div><h3>სინქრონიზაცია</h3><p class="muted" style="margin:2px 0 0;font-size:12px">CLI/cron-ის გარდა — ხელით გაშვება აქ · ავტო-refresh სინქის დროს</p></div></div>
          <div class="pharm-sync-body">
            <div class="pharm-sync-form">
              <div class="field"><span>წყარო</span>
                <select id="pharm-source">
                  <option value="ALL">ყველა (Pharmadepot + Aversi + PSP)</option>
                  <option value="PHARMADEPOT">Pharmadepot</option>
                  <option value="AVERSI">Aversi shop</option>
                  <option value="PSP">PSP</option>
                </select>
              </div>
              <div class="field"><span>მაქს. გვერდები</span><input id="pharm-pages" type="number" min="1" max="500" placeholder="ცარიელი = სრული კატალოგი" /></div>
              <button class="btn primary" id="pharm-sync" ${running ? 'disabled' : ''}>${icon('activity')} ${running ? 'სინქრონიზაცია მიმდინარეობს…' : 'სინქის გაშვება'}</button>
              <p class="pharm-sync-note">Pharmadepot ~3300 SKU · 30–90 წთ. Aversi/PSP შეიძლება bot-დაცვით დაბლოკილი იყოს.</p>
              <div class="pharm-sync-meta">
                <div><span>ბოლო ALL</span><strong class="mono">${syncMeta.ALL ? fmtDateShort(syncMeta.ALL.finishedAt) : '—'}</strong></div>
                <div><span>ჩატვირთული</span><strong class="mono">${syncMeta.ALL?.itemsFetched?.toLocaleString('ka-GE') ?? '—'}</strong></div>
              </div>
            </div>
            ${pharmSyncPreview()}
          </div>
        </div>

        <div class="v25-panel pharm-deals-card">
          <div class="card-head">${iconTile('wallet', 'ok')}<div><h3>ტოპ დაზოგვები</h3><p class="muted" style="margin:2px 0 0;font-size:12px">ყველაზე დიდი ფასის სpread მრავალწყარო პროდუქტებში</p></div></div>
          ${
            insights.topDeals.length
              ? `<div class="pharm-deals">${insights.topDeals.map((d, i) => pharmDealRow(d, i + 1)).join('')}</div>`
              : '<div class="empty"><strong>ჯერ არ არის შედარება</strong>გაუშვით სინქი — დაზოგვის ტოპი აქ გამოჩნდება.</div>'
          }
        </div>
      </div>

      ${
        recentFailures.length
          ? `
        <div class="pharm-alert-card">
          ${iconTile('alert', 'bad')}
          <div class="pharm-alert-copy">
            <strong>${recentFailures.length} ბოლო შეცდომა</strong>
            <p class="muted">გადახედეთ და გაუშვით ხელახლა დაბლოკილი წყარო</p>
          </div>
          <div class="pharm-alert-list">
            ${recentFailures
              .map(
                (r) => `
              <div class="pharm-alert-item">
                <span class="badge bad">${escapeHtml(r.source)}</span>
                <span class="mono muted">${fmtDateShort(r.startedAt)}</span>
                <span>${escapeHtml((r.error || '—').slice(0, 100))}${(r.error || '').length > 100 ? '…' : ''}</span>
              </div>`,
              )
              .join('')}
          </div>
        </div>`
          : ''
      }

      <div class="v25-panel pharm-log-card">
        <div class="card-head">
          ${iconTile('activity', 'teal')}
          <div>
            <h3>სინქის ისტორია</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px">${total.toLocaleString('ka-GE')} ჩანაწერი · ბოლო 40</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>წყარო</th><th>სტატუსი</th><th>ჩატვირთული</th><th>დაწყება</th><th>ხანგრძლ.</th><th>შეცდომა</th></tr>
            </thead>
            <tbody>
              ${
                runs.length
                  ? runs
                      .map((r) => {
                        const durSec = r.startedAt
                          ? Math.max(
                              0,
                              Math.round(
                                ((r.finishedAt ? new Date(r.finishedAt) : new Date()).getTime() -
                                  new Date(r.startedAt).getTime()) /
                                  1000,
                              ),
                            )
                          : 0;
                        const durPct = Math.min(100, Math.round((durSec / 3600) * 100));
                        return `
                <tr class="pharm-run-row ${r.status === 'RUNNING' ? 'running' : ''}">
                  <td><strong>${escapeHtml(r.source)}</strong></td>
                  <td>${syncRunBadge(r.status)}</td>
                  <td class="mono">${(r.itemsFetched ?? 0).toLocaleString('ka-GE')}</td>
                  <td class="mono">${fmtDateShort(r.startedAt)}</td>
                  <td>
                    <div class="pharm-dur">
                      <span class="mono">${syncDuration(r.startedAt, r.finishedAt)}</span>
                      <div class="bar teal"><span style="width:${durPct || 4}%"></span></div>
                    </div>
                  </td>
                  <td class="pharm-run-error">${escapeHtml((r.error || '—').slice(0, 80))}${(r.error || '').length > 80 ? '…' : ''}</td>
                </tr>`;
                      })
                      .join('')
                  : '<tr><td colspan="6"><div class="empty"><strong>სინქრონიზაციის ისტორია ჯერ არ არის</strong><p>პირველი სინქი აქ გამოჩნდება.</p></div></td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  $('pharm-sync')?.addEventListener('click', async () => {
    const source = $('pharm-source').value;
    const pagesRaw = $('pharm-pages').value.trim();
    const maxPages = pagesRaw ? parseInt(pagesRaw, 10) : undefined;
    if (pagesRaw && (Number.isNaN(maxPages) || maxPages < 1)) {
      toast('maxPages არასწორია', 'bad');
      return;
    }
    if (!confirm(`გაუშვებთ ${source} სინქს?${maxPages ? ` (max ${maxPages} გვ.)` : ' (სრული კატალოგი)'}`)) return;
    const btn = $('pharm-sync');
    btn.disabled = true;
    btn.textContent = 'იწყება…';
    try {
      await api('/pharmacy/sync', { method: 'POST', body: { source, ...(maxPages ? { maxPages } : {}) } });
      toast('სინქრონიზაცია დაიწყო — განახლება ავტომატურად', 'ok');
      await renderPharmacy();
    } catch (err) {
      toast(err.message || 'სინქი ვერ დაიწყო', 'bad');
      btn.disabled = false;
      btn.innerHTML = `${icon('activity')} სინქის გაშვება`;
    }
  });

  $('tab-pharmacy')?.querySelectorAll('.pharm-retry').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const source = btn.dataset.source;
      if (!source || !confirm(`${source} — ხელახლა გაუშვებთ სინქს?`)) return;
      btn.disabled = true;
      try {
        await api('/pharmacy/sync', { method: 'POST', body: { source } });
        toast(`${source} სინქი დაიწყო`, 'ok');
        await renderPharmacy();
      } catch (err) {
        toast(err.message || 'სინქი ვერ დაიწყო', 'bad');
        btn.disabled = false;
      }
    });
  });

  if (running) {
    pharmacyPollTimer = setInterval(() => {
      if (state.tab === 'pharmacy') renderPharmacy().catch(() => undefined);
    }, 8000);
  }
}

function fmtSmsDate(iso) {
  const p = adminDateParts(iso);
  if (!p) return '—';
  return `${p.day} ${MONTHS_KA_SHORT[p.month]}, ${p.hour}:${p.minute}`;
}

function smsStatusTone(status) {
  if (status === 'SENT') return 'ok';
  if (status === 'FAILED') return 'bad';
  return 'warn';
}

async function renderSms() {
  const [balance, stats, logs, users] = await Promise.all([
    api('/sms/balance'),
    api('/sms/stats'),
    api('/sms/logs?limit=40&offset=0'),
    api('/users?limit=200&offset=0').catch(() => ({ users: [] })),
  ]);

  const balNum = balance.balance;
  const balLabel = !balance.configured
    ? "API გასაღები არ არის"
    : balNum != null
      ? `${balNum.toLocaleString('ka-GE')} SMS`
      : balance.raw || '\u2014';
  const balTone = !balance.configured ? 'bad' : balNum != null && balNum < 50 ? 'warn' : 'ok';
  const successRate = stats.total ? Math.round((stats.sent / stats.total) * 100) : 100;

  $('tab-sms').innerHTML = `
    <div class="v25-sms dash-enter">
      <div class="v25-strip v25-strip-n6">
        ${v25StripCell('wallet', "ბალანსი", escapeHtml(balLabel), "OTP, ადმინისტრაციული გაგზავნა და სრული აუდიტი", balTone === 'ok' ? ' is-ok' : ' is-warn')}
        ${v25StripCell('activity', "24სთ", stats.last24h, '')}
        ${v25StripCell('check', "წარმატება", successRate + '%', '')}
        ${v25StripCell('file', "სულ ჩანაწერი", stats.total, stats.admin + ' ' + "ადმინი")}
        ${v25StripCell('shield', 'OTP', stats.otp, "ავტორიზაცია")}
        ${v25StripCell('alert', "შეცდომა", stats.failed, "ვერ გაიგზავნა", stats.failed ? ' is-warn' : '')}
      </div>
      <div class="v25-sms-grid">
        <section class="v25-panel sms-send-card">
          <div class="card-head">
            ${iconTile('send')}
            <div>
              <h3>${"ახალი SMS"}</h3>
              <p class="muted">${"გაგზავნა"}</p>
            </div>
            <button type="button" class="btn tiny ghost" id="sms-refresh-bal">${icon('refresh')} ${"განახლება"}</button>
          </div>
          <form id="sms-send-form" class="sms-send-form">
          <label class="field">
            <span>მიმღები (9955XXXXXXXX)</span>
            <input id="sms-destination" type="text" placeholder="995577123456" />
          </label>
          <label class="field">
            <span>ან მომხმარებელი</span>
            <select id="sms-user-id">
              <option value="">— ხელით ნომერი —</option>
              ${(users.users || [])
                .filter((u) => u.phone)
                .slice(0, 100)
                .map((u) => `<option value="${u.id}">${escapeHtml(u.fullName)} · ${escapeHtml(u.phone)}</option>`)
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>ტექსტი (მაქს. 1000)</span>
            <textarea id="sms-content" rows="3" maxlength="1000" placeholder="Medicard: ..."></textarea>
            <small class="muted"><span id="sms-char-count">0</span> / 1000</small>
          </label>
          <div class="sms-send-actions">
            <label class="check-inline">
              <input id="sms-urgent" type="checkbox" />
              <span>urgent (დაბლოკილი ნომრებზეც)</span>
            </label>
            <button type="submit" class="btn primary" data-icon="arrow">გაგზავნა</button>
          </div>
        </form>
        </section>
        <section class="v25-panel v25-sms-log">
          <div class="card-head">
            ${iconTile('file')}
            <div>
              <h3>${"გაგზავნილი SMS"}</h3>
              <p class="muted">${"ჟურნალი"}</p>
            </div>
            <button type="button" class="btn tiny ghost" id="sms-reload-logs">${icon('activity')}</button>
          </div>
          <div class="table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>${"დრო"}</th>
                  <th>${"ნომერი"}</th>
                  <th>${"ტექსტი"}</th>
                  <th>${"მიზანი"}</th>
                  <th>${"სტატუსი"}</th>
                </tr>
              </thead>
              <tbody>
                ${(logs.logs || [])
                .map(
                  (row) => `
                <tr>
                  <td>${fmtSmsDate(row.createdAt)}</td>
                  <td><code>${escapeHtml(row.destination)}</code></td>
                  <td class="clip">${escapeHtml(row.content)}</td>
                  <td><span class="pill sm">${escapeHtml(row.purpose)}</span></td>
                  <td><span class="status-pill ${smsStatusTone(row.status)}">${escapeHtml(row.status)}</span></td>
                </tr>`,
                )
                .join('') || '<tr><td colspan="5" class="empty">ჩანაწერი არ არის</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>`;


    const contentEl = $('sms-content');
  const countEl = $('sms-char-count');
  contentEl?.addEventListener('input', () => {
    if (countEl) countEl.textContent = String(contentEl.value.length);
  });

  $('sms-refresh-bal')?.addEventListener('click', () => renderSms().catch((e) => toast(e.message, 'bad')));
  $('sms-reload-logs')?.addEventListener('click', () => renderSms().catch((e) => toast(e.message, 'bad')));

  $('sms-send-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const destination = $('sms-destination').value.trim();
    const userId = $('sms-user-id').value || undefined;
    const content = $('sms-content').value.trim();
    const urgent = $('sms-urgent').checked;
    if (!content) return toast('შეიყვანეთ ტექსტი', 'bad');
    if (!userId && !destination) return toast('მიუთითეთ ნომერი ან მომხმარებელი', 'bad');
    try {
      await api('/sms/send', {
        method: 'POST',
        body: { destination: destination || undefined, content, userId, urgent },
      });
      toast('SMS გაგზავნილია', 'ok');
      $('sms-content').value = '';
      if (countEl) countEl.textContent = '0';
      await renderSms();
    } catch (err) {
      toast(err.message || 'გაგზავნა ვერ მოხერხდა', 'bad');
    }
  });
}

boot();
