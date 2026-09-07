const API = '';
const TOKEN_KEY = 'medicard.admin.token';
const THEME_KEY = 'medicard.admin.theme';
const EMAIL_KEY = 'medicard.admin.email';
const TAB_KEY = 'medicard.admin.tab';
const USERS_PAGE_SIZE = 15;
const PAGE_SIZE = 25;
const ADMIN_TABS = ['overview', 'orders', 'users', 'packages', 'push', 'sms', 'pharmacy', 'rewards', 'ai', 'health', 'audit', 'quality', 'settings'];

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
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
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
    const err = new Error(data.error || 'შეცდომა');
    err.status = res.status;
    if ((res.status === 401 || res.status === 403) && path !== '/login' && state.token) {
      logout('სესია ამოიწურა. თავიდან შეხვიდე.');
    }
    throw err;
  }
  return data;
}

async function apiRetry(path, tries = 3) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await api(path);
    } catch (err) {
      last = err;
      if (err.status === 401 || err.status === 403) throw err;
      await new Promise((resolve) => setTimeout(resolve, 350 * (i + 1)));
    }
  }
  throw last;
}

function toast(message, kind = 'ok') {
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
}

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ka-GE', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDateShort(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ka-GE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timelineDayKa(value) {
  if (!value) return 'უცნობია';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'უცნობია';
  const start = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((start(new Date()) - start(date)) / 86400000);
  if (diff === 0) return 'დღეს';
  if (diff === 1) return 'გუშინ';
  return date.toLocaleDateString('ka-GE', { dateStyle: 'medium' });
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

function timeGreetingKa() {
  const h = new Date().getHours();
  if (h < 12) return 'დილა მშვიდობისა';
  if (h < 18) return 'გამარჯობა';
  return 'საღამო მშვიდობისა';
}

function adminGreetingName() {
  const email = state.admin?.email || localStorage.getItem(EMAIL_KEY) || '';
  const raw = state.admin?.fullName || email.split('@')[0] || 'ადმინ';
  return raw.split(' ')[0] || raw;
}

function ngSparkBars(tone) {
  const heights = [38, 62, 48, 78, 52, 70, 44, 66];
  return `<div class="ng-spark tone-${tone}" aria-hidden="true">${heights.map((h) => `<span style="--h:${h}%"></span>`).join('')}</div>`;
}

function ngSparkFromTrend(trend, tone) {
  const rows = (trend || []).slice(-8);
  if (!rows.length) return ngSparkBars(tone);
  const max = Math.max(1, ...rows.map((d) => d.count));
  return `<div class="ng-spark tone-${tone}" aria-hidden="true">${rows.map((d) => {
    const h = Math.max(10, Math.round((d.count / max) * 100));
    return `<span style="--h:${h}%"></span>`;
  }).join('')}</div>`;
}

function ngMetricCard({ label, value, hint, iconName, tone, spark }) {
  return `
    <article class="ng-metric tone-${tone}">
      <div class="ng-metric-icon">${icon(iconName)}</div>
      <div class="ng-metric-body">
        <span class="ng-metric-label">${label}</span>
        <strong class="ng-metric-value">${value}</strong>
        ${hint ? `<span class="ng-metric-hint">${hint}</span>` : ''}
      </div>
      ${spark ? ngSparkFromTrend(spark, tone) : ngSparkBars(tone)}
    </article>
  `;
}

function dashAreaChart(points, tone = 'teal') {
  const rows = Array.isArray(points) ? points : [];
  if (!rows.length) return '<p class="muted">მონაცემი არ არის.</p>';
  const w = 360;
  const h = 148;
  const padX = 10;
  const padY = 14;
  const max = Math.max(1, ...rows.map((d) => d.count));
  const step = rows.length > 1 ? (w - padX * 2) / (rows.length - 1) : 0;
  const coords = rows.map((d, i) => {
    const x = padX + i * step;
    const y = h - padY - (d.count / max) * (h - padY * 2);
    return { x: +x.toFixed(1), y: +y.toFixed(1), count: d.count, day: d.day };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${padX},${h - padY} ${line} ${coords[coords.length - 1].x},${h - padY}`;
  const last = coords[coords.length - 1];
  return `
    <svg class="dash-area tone-${tone}" viewBox="0 0 ${w} ${h}" role="img" aria-label="14 დღის ტრენდი">
      <defs>
        <linearGradient id="dash-area-${tone}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#dash-area-${tone})"/>
      <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      ${coords.filter((c) => c.count > 0).map((c) => `<circle cx="${c.x}" cy="${c.y}" r="2.4" fill="currentColor"/>`).join('')}
      <circle cx="${last.x}" cy="${last.y}" r="4.2" fill="currentColor"/>
    </svg>
  `;
}

function dashLineChart(series) {
  const lists = (series || []).filter((s) => s.points?.length);
  if (!lists.length) return '<p class="muted">მონაცემი არ არის.</p>';
  const w = 360;
  const h = 148;
  const padX = 10;
  const padY = 14;
  const max = Math.max(1, ...lists.flatMap((s) => s.points.map((d) => d.count)));
  const n = Math.max(...lists.map((s) => s.points.length));
  const step = n > 1 ? (w - padX * 2) / (n - 1) : 0;
  const paths = lists.map((s) => {
    const line = s.points.map((d, i) => {
      const x = padX + i * step;
      const y = h - padY - (d.count / max) * (h - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<polyline class="tone-${s.tone || 'teal'}" points="${line}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  return `<svg class="dash-lines" viewBox="0 0 ${w} ${h}" role="img">${paths}</svg>`;
}

function dashDonut(slices) {
  const list = (slices || []).filter((s) => s.count > 0);
  const total = list.reduce((sum, s) => sum + s.count, 0);
  if (!total) return '<p class="muted">მონაცემი არ არის.</p>';
  let acc = 0;
  const stops = list.map((s) => {
    const start = acc;
    acc += (s.count / total) * 100;
    return `${s.color} ${start.toFixed(2)}% ${acc.toFixed(2)}%`;
  }).join(', ');
  return `
    <div class="dash-donut-wrap">
      <div class="dash-donut" style="background: conic-gradient(${stops})"></div>
      <div class="dash-donut-legend">
        ${list.map((s) => `
          <div class="dash-donut-item">
            <i style="background:${s.color}"></i>
            <span>${s.label}</span>
            <strong>${s.count}</strong>
            <em>${Math.round((s.count / total) * 100)}%</em>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function setPageHeader(tab, copy) {
  const greetEl = $('page-greeting');
  const subEl = $('page-subtitle');
  if (greetEl) greetEl.textContent = copy[tab][1];
  if (subEl) subEl.textContent = copy[tab][2];
}

function pkgClass(code) {
  const key = String(code || '').toLowerCase();
  if (key === 'standard') return 'standard';
  if (key === 'ultimate') return 'ultimate';
  return 'free';
}

function pkgBadge(pkg) {
  if (!pkg) return '<span class="badge neutral">—</span>';
  return `<span class="badge ${pkgClass(pkg.code)}">${pkg.nameKa}</span>`;
}

function statusBadge(status) {
  return status === 'BLOCKED'
    ? '<span class="badge bad">დაბლოკილი</span>'
    : '<span class="badge ok">აქტიური</span>';
}

function quotaCell(usage) {
  if (!usage) return '—';
  if (usage.unlimited) {
    return `<div class="users-quota is-unlimited">
      <div class="users-quota-head"><strong>∞</strong><span>შეუზღუდავი</span></div>
      <div class="quota-track"><span style="width:100%"></span></div>
    </div>`;
  }
  const used = usage.used ?? 0;
  const limit = usage.limit ?? 0;
  const remaining = usage.remaining ?? Math.max(0, limit - used);
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 100 ? 'full' : pct >= 70 ? 'warn' : '';
  return `<div class="users-quota${tone ? ` is-${tone}` : ''}" title="დარჩა ${remaining}">
    <strong>${used}<span class="muted"> / ${limit}</span></strong>
    <div class="quota-track ${tone}"><span style="width:${pct}%"></span></div>
  </div>`;
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

function searchHotkeyLabel() {
  return /Mac|iPhone|iPad/i.test(`${navigator.platform} ${navigator.userAgent}`) ? '⌘K' : 'Ctrl+K';
}

function usersStatusCell(status) {
  const blocked = status === 'BLOCKED';
  return `<span class="users-live ${blocked ? 'is-blocked' : 'is-active'}"><i></i>${blocked ? 'დაბლოკილი' : 'აქტიური'}</span>`;
}

function usersActivityCell(user) {
  const counts = user.counts || {};
  const bits = [];
  if (counts.chats > 0) bits.push('<span title="Medi">Medi</span>');
  if (counts.medications > 0) bits.push('<span title="მედიკამენტები">მედ.</span>');
  if (user.hasCycle) bits.push('<span title="ციკლი">ციკლი</span>');
  if (user.notificationPermission === 'denied' || user.notificationPermission === 'disabled') {
    bits.push('<span class="is-off" title="შეტყობინება გამორთულია">ნოტიფი</span>');
  }
  return bits.length ? `<div class="users-feats">${bits.join('')}</div>` : '<span class="muted">—</span>';
}

function usersFilterMetric({ label, value, hint, iconName, tone, statusFilter, packageFilter, valueId }) {
  const status = statusFilter === undefined ? '' : ` data-status-filter="${statusFilter}"`;
  const pkg = packageFilter === undefined ? '' : ` data-package-filter="${packageFilter}"`;
  const pressable = statusFilter !== undefined || packageFilter !== undefined;
  const tag = pressable ? 'button type="button"' : 'article';
  const close = pressable ? 'button' : 'article';
  const valueAttr = valueId ? ` id="${valueId}"` : '';
  return `
    <${tag} class="orders-kpi users-os-kpi tone-${tone}${pressable ? ' users-metric-btn' : ''}"${status}${pkg}${pressable ? ' aria-pressed="false"' : ''}>
      <div class="users-os-kpi-top">
        <span class="users-os-kpi-ico tone-${tone}">${icon(iconName || 'users')}</span>
        <span>${label}</span>
      </div>
      <strong${valueAttr}>${value}</strong>
      ${hint ? `<em ${valueId ? `id="${valueId}-hint"` : ''}>${hint}</em>` : ''}
    </${close}>
  `;
}

function usersTrendHtml(trend) {
  const rows = Array.isArray(trend) ? trend : [];
  if (!rows.length) return '<p class="muted">რეგისტრაციები ჯერ არ არის.</p>';
  const max = Math.max(1, ...rows.map((d) => d.count));
  return `<div class="users-trend">${rows.map((d) => {
    const date = new Date(`${d.day}T00:00:00.000Z`);
    const short = date.toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' });
    const h = Math.max(8, Math.round((d.count / max) * 100));
    return `<div class="users-trend-col" title="${escapeAttr(short)}: ${d.count}">
      <span class="users-trend-val">${d.count || ''}</span>
      <span class="users-trend-track"><span class="users-trend-bar" style="height:${h}%"></span></span>
      <span class="users-trend-lbl">${escapeHtml(short)}</span>
    </div>`;
  }).join('')}</div>`;
}

function usersMixHtml(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return '<p class="muted">მონაცემი არ არის.</p>';
  const total = list.reduce((sum, i) => sum + (i.count || 0), 0) || 1;
  const max = Math.max(1, ...list.map((i) => i.count || 0));
  return list.map((i) => {
    const share = Math.round(((i.count || 0) / total) * 100);
    const barW = Math.round(((i.count || 0) / max) * 100);
    return `
      <div class="dash-pkg-row">
        <div class="dash-pkg-head">
          <span class="dash-pkg-label">${i.label}</span>
          <span class="badge ${i.tone || 'neutral'}">${i.count}</span>
        </div>
        <div class="bar ${i.bar || ''}"><span style="width:${barW}%"></span></div>
        <div class="dash-pkg-foot">
          <span class="mono">${i.count} მომხმარებელი</span>
          <span class="mono muted">${share}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function usersTrendSpark(trend) {
  const rows = (trend || []).slice(-8);
  if (!rows.length) return ngSparkBars('teal');
  const max = Math.max(1, ...rows.map((d) => d.count));
  return `<div class="ng-spark tone-teal" aria-hidden="true">${rows.map((d) => {
    const h = Math.max(12, Math.round((d.count / max) * 100));
    return `<span style="--h:${h}%"></span>`;
  }).join('')}</div>`;
}

function usersSkeletonHtml() {
  return Array.from({ length: 8 }, (_, i) => `
    <tr class="users-skel-row" style="--i:${i}" aria-hidden="true">
      <td class="col-user">
        <div class="users-person">
          <span class="sk av"></span>
          <div class="users-person-copy"><span class="sk ln w160"></span><span class="sk ln w90"></span></div>
        </div>
      </td>
      <td class="col-status"><span class="sk chip sm"></span></td>
      <td class="col-pkg"><span class="sk chip"></span></td>
      <td class="col-when"><span class="sk ln w90"></span></td>
      <td class="col-plat"><span class="sk chip sm"></span></td>
      <td class="col-stats"><span class="sk ln w100"></span></td>
    </tr>
  `).join('');
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

function providerBadge(label) {
  const map = {
    LIVE: 'ონლაინ',
    OFF: 'გამორთ.',
    LOW: 'დაბალი',
    ERR: 'შეცდომა',
  };
  return map[label] || label;
}

function formatUsd(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function dashHealthRing(active, total, caption) {
  const pct = total ? Math.round((active / total) * 100) : null;
  const tone = pct == null ? 'neutral' : pct >= 85 ? 'ok' : pct >= 60 ? 'std' : 'bad';
  const display = pct == null ? '—' : pct;
  const ringPct = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  return `
    <div class="ai-hero-score">
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

function dashPkgBars(packages, maxPkg, assigned) {
  if (!packages.length) return '<p class="muted">პაკეტები ჯერ არ არის.</p>';
  return packages
    .map((p) => {
      const cls = pkgClass(p.code);
      const share = assigned ? Math.round((p.users / assigned) * 100) : 0;
      const barW = maxPkg ? Math.round((p.users / maxPkg) * 100) : 0;
      return `
        <div class="dash-pkg-row">
          <div class="dash-pkg-head">
            <span class="dash-pkg-label">${escapeHtml(p.nameKa)}</span>
            <span class="badge ${cls}">${escapeHtml(p.code)}</span>
          </div>
          <div class="bar ${cls === 'standard' ? 'std' : cls === 'ultimate' ? 'ult' : ''}"><span style="width:${barW}%"></span></div>
          <div class="dash-pkg-foot">
            <span class="mono">${p.users} მომხმარებელი</span>
            <span class="mono muted">${share}%</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function dashProvidersHtml(balances) {
  const or = balances?.openrouter;
  const emd = balances?.evidencemd;
  const fetched = balances?.fetchedAt ? fmtDate(balances.fetchedAt) : '';
  const orTone = or?.tone || (or?.ok ? 'ok' : 'bad');
  const emdTone = emd?.tone || (emd?.ok ? 'ok' : 'bad');

  function providerCard(name, iconName, tone, badge, balance, hint, stats, dashboardUrl, dashboardLabel, error) {
    return `
      <article class="dash-provider ${tone}">
        <div class="dash-provider-top">
          ${iconTile(iconName, tone === 'ok' ? 'ok' : tone === 'warn' ? 'std' : tone === 'bad' ? 'bad' : '')}
          <div class="dash-provider-copy">
            <strong>${name}</strong>
            <span class="muted">${hint}</span>
          </div>
          <span class="badge ${tone === 'ok' ? 'ok' : tone === 'warn' ? 'neutral' : 'bad'}">${badge}</span>
        </div>
        <div class="dash-provider-balance">${balance}</div>
        <div class="dash-provider-stats">
          ${stats.map(([label, val]) => `<div class="dash-provider-stat"><span>${label}</span><strong>${val}</strong></div>`).join('')}
        </div>
        ${error ? `<p class="dash-provider-error">${escapeHtml(error)}</p>` : ''}
        <a class="btn tiny ghost dash-provider-link" href="${escapeAttr(dashboardUrl)}" target="_blank" rel="noreferrer">${icon('link')} ${dashboardLabel}</a>
      </article>
    `;
  }

  return `
    <div class="dash-providers-wrap">
      <div class="dash-providers">
        ${providerCard(
          'OpenRouter',
          'wallet',
          orTone,
          or?.configured ? providerBadge(orTone === 'bad' ? 'LOW' : or?.ok ? 'LIVE' : 'ERR') : providerBadge('OFF'),
          formatUsd(or?.remaining),
          escapeHtml(or?.model || 'X-ray / CT / კანი'),
          [
            ['შეძენილი', formatUsd(or?.total)],
            ['დახარჯული', formatUsd(or?.used)],
            ['დღეს', formatUsd(or?.usedDaily)],
            ['თვე', formatUsd(or?.usedMonthly)],
          ],
          or?.dashboardUrl || 'https://openrouter.ai/settings/credits',
          'შევსება',
          or?.error,
        )}
        ${providerCard(
          'EvidenceMD',
          'message',
          emdTone,
          emd?.configured ? providerBadge(emd?.ok ? 'LIVE' : 'ERR') : providerBadge('OFF'),
          emd?.remaining != null ? String(emd.remaining) : '—',
          emd?.remaining != null ? 'დარჩენილი კრედიტი' : `${emd?.creditsPerCall || 4} კრ. / გამოძახება · ${escapeHtml(emd?.model || 'ჩატი')}`,
          [
            ['ამ თვეში', `${emd?.usedThisMonth ?? 0} გამ.`],
            ['~ კრ.', String(emd?.estimatedCreditsThisMonth ?? 0)],
            ['სულ', `${emd?.usedAll ?? 0} გამ.`],
            ['API', emd?.ok ? 'ონლაინ' : 'გამორთული'],
          ],
          emd?.dashboardUrl || 'https://evidencemd.ai/developers',
          'დეშბორდი',
          emd?.error,
        )}
      </div>
      <div class="dash-providers-meta">
        <span class="muted mono">${fetched ? `განახლდა ${fetched}` : 'ბალანსი ჯერ არ არის განახლებული'}</span>
        <button class="btn tiny ghost" id="balances-refresh">${icon('refresh')} განახლება</button>
      </div>
    </div>
  `;
}

function providerCardsHtml(balances) {
  return dashProvidersHtml(balances);
}

function setLivePill(settings) {
  const pill = $('live-pill');
  if (!pill || !settings) return;
  if (settings.maintenanceMode) {
    pill.className = 'status-pill bad';
    pill.innerHTML = `${icon('alert')} ოფლაინი · განახლება`;
  } else if (settings.forceUpdate) {
    pill.className = 'status-pill warn';
    pill.innerHTML = `${icon('zap')} იძულებითი განახლება`;
  } else {
    pill.className = 'status-pill ok';
    pill.innerHTML = `${icon('check')} ცოცხალი`;
  }
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
    btn.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
      switchTab(btn.dataset.tab);
    });
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
  });
  $('drawer-backdrop').addEventListener('click', closeDrawer);
  $('sidebar-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
  $('sidebar-scrim')?.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
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
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.add('hidden'));
  $('tab-missing')?.classList.remove('hidden');
  const greetEl = $('page-greeting');
  const subEl = $('page-subtitle');
  if (greetEl) greetEl.textContent = 'გვერდი ვერ მოიძებნა';
  if (subEl) subEl.textContent = 'ეს მისამართი ადმინ კონსოლში არ არსებობს.';
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
  if (typeof opsState !== 'undefined' && opsState.range && !params.get('range')) {
    params.set('range', opsState.range);
    if (opsState.range === 'custom') {
      if (opsState.from) params.set('from', opsState.from);
      if (opsState.to) params.set('to', opsState.to);
    }
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
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.add('hidden'));
  $(`tab-${tab}`).classList.remove('hidden');

  const copy = {
    overview: ['ოპერაციები', 'ოპერაციები', 'მიმდინარე მდგომარეობა, პროდუქტის მოძრაობა და გამოკვლევა.'],
    health: ['ჯანმრთელობა', 'ჯანმრთელობა', 'აქტივობა რეალური ცხრილებიდან — ინდივიდუალური გაზომვები აქ არ ჩანს.'],
    audit: ['სისტემა', 'აუდიტი', 'ვინ შეცვალა შაბლონები, პარამეტრები ან მომხმარებლის სტატუსი.'],
    quality: ['სისტემა', 'ხარისხი', 'ანალიტიკის დიაგნოსტიკა — ვერსიები, ნებართვა, orphan outcomes.'],
    orders: ['რიგი', 'შეკვეთები', 'დღევანდელი ვიზიტები, მედიკამენტები და ახალი ანგარიშები — ერთ რიგში.'],
    users: ['რეესტრი', 'მომხმარებლები', 'საძიებო კონსოლი — ფილტრი, დახარისხება და პროფილი ერთ კლიკში.'],
    packages: ['კომერცია', 'პაკეტები', 'ყველა გეგმა თვიურია — AI ლიმიტი 30-დღიან პერიოდში.'],
    push: ['კომუნიკაცია', 'Push სტუდია', 'Medi ტექსტები, live გადახედვა და broadcast — ერთ სივრცეში.'],
    sms: ['კომუნიკაცია', 'SMS მენეჯმენტი', 'OTP, ბალანსი, გაგზავნა და გაგზავნილი მესიჯების ჟურნალი.'],
    pharmacy: ['კატალოგი', 'ფასების შედარება', 'აფთიაქების სინქრონიზაცია, პროდუქტები და სინქის ისტორია.'],
    rewards: ['კომერცია', 'ჯილდოების ოპერაციები', 'პარტნიორები, კამპანიები, კოდები და გაცვლები — მხოლოდ კომერციული მონაცემები.'],
    ai: ['AI', 'ხარისხის ანალიზი', 'ყველა AI პასუხი იწერება, შეფასდება და გაუმჯობესდება კონტროლირებულად.'],
    settings: ['კონტროლი', 'აპის რეჟიმი', 'ოფლაინი, იძულებითი განახლება და რეგისტრაციის კარიბჭე.'],
  };
  setPageHeader(tab, copy);

  if (tab === 'overview') {
    if (typeof renderCommandCenter === 'function') await renderCommandCenter();
    else await renderOverview();
  }
  if (tab === 'orders') await renderOrders();
  if (tab === 'users') await renderUsers();
  if (tab === 'packages') await renderPackages();
  if (tab === 'push') await renderPush();
  if (tab === 'sms') await renderSms();
  if (tab === 'pharmacy') await renderPharmacy();
  if (tab === 'rewards' && typeof renderRewards === 'function') await renderRewards();
  if (tab === 'ai') await renderAi();
  if (tab === 'health' && typeof renderHealthOps === 'function') await renderHealthOps();
  if (tab === 'audit' && typeof renderAuditLog === 'function') await renderAuditLog();
  if (tab === 'quality' && typeof renderQualityOps === 'function') await renderQualityOps();
  if (tab === 'settings') await renderSettings();
  startAdminLive();
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
    if (Date.now() - adminLastScrollAt < 4000) return;
    refreshAdminLive().catch(() => {});
  }, ADMIN_LIVE_MS);
}

let adminSocket = null;

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
    const pill = $('live-pill');
    if (pill && !pill.classList.contains('bad') && !pill.classList.contains('warn')) {
      pill.className = 'status-pill ok';
      pill.innerHTML = `${icon('check')} ცოცხალი`;
    }
  });
  adminSocket.on('ops:live', (snap) => {
    if (typeof window.patchOpsLive === 'function') window.patchOpsLive(snap);
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
}

async function refreshAdminLive() {
  const tab = state.tab;
  if (tab === 'overview') return;
  if (tab === 'users' && typeof window.__reloadUsers === 'function') {
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

function visitWhen(v) {
  return `${v.visitTime || '—'} · ${fmtDateShort(`${v.visitDate}T12:00:00`)}`;
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
    if (board) board.dataset.cols = String(Object.values(show).filter(Boolean).length);
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
    + '<div class="orders-board" data-cols="4">'
    + '<section class="orders-col" data-orders-col="today"><header><span class="dot now"></span><h3>' + "დღეს" + '</h3><b>' + todayVisits.length + '</b></header><div id="orders-today-list" class="orders-col-body"></div></section>'
    + '<section class="orders-col" data-orders-col="later"><header><span class="dot soon"></span><h3>' + "მოახლოებული" + '</h3><b>' + laterVisits.length + '</b></header><div id="orders-later-list" class="orders-col-body"></div></section>'
    + '<section class="orders-col" data-orders-col="meds"><header><span class="dot med"></span><h3>' + "მედიკამენტები" + '</h3><b>' + (data.medications || []).length + '</b></header><div id="orders-meds-list" class="orders-col-body"></div></section>'
    + '<aside class="orders-col feed" data-orders-col="new"><header><span class="dot new"></span><h3>' + "ახალი ანგარიშები" + '</h3><b>' + (data.signups || []).length + '</b></header><div id="orders-feed" class="orders-col-body"></div></aside>'
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
      ${pkgBadge(u.package)}
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

async function renderOverview(freshBalances = false) {
  const [stats, recent, balances] = await Promise.all([
    api('/stats'),
    api('/users?limit=6&offset=0'),
    api(freshBalances ? '/balances?fresh=1' : '/balances').catch(() => null),
  ]);
  setLivePill(stats.settings);
  const maxPkg = Math.max(1, ...stats.packages.map((p) => p.users));
  const assigned = stats.packages.reduce((sum, p) => sum + p.users, 0);
  const s = stats.settings;
  const modeOk = !s.maintenanceMode && !s.forceUpdate;
  const modeTone = s.maintenanceMode ? 'bad' : s.forceUpdate ? 'warn' : 'ok';
  const modeLabel = s.maintenanceMode ? 'ოფლაინი' : s.forceUpdate ? 'იძ. განახლება' : 'აქტიური';
  const activePct = stats.users.total ? Math.round((stats.users.active / stats.users.total) * 100) : null;
  const act = stats.activity || {};
  const trends = stats.trends || {};
  const signupTrend = trends.signups || stats.users.trend || [];
  const aiTrend = trends.ai || [];
  const chatTrend = trends.chats || [];
  const recordTrend = trends.records || [];
  const g = stats.users.gender || {};
  const weekSignups = signupTrend.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const prevWeekSignups = signupTrend.slice(0, 7).reduce((sum, d) => sum + d.count, 0);
  const weekDelta = weekSignups - prevWeekSignups;
  const pkgColors = { FREE: 'var(--teal)', STANDARD: 'var(--std)', ULTIMATE: 'var(--ult)' };

  $('tab-overview').innerHTML = `
    <div class="ai-page dash-page ng-dash dash-enter">
      <section class="dash-status card">
        <div class="dash-status-live">
          <span class="dash-status-dot ${modeTone}"></span>
          <div>
            <strong>${modeLabel === 'აქტიური' ? 'სისტემა აქტიურია' : modeLabel}</strong>
            <span>${stats.users.active} აქტიური ანგარიში</span>
          </div>
        </div>
        <div class="dash-status-stats">
          <div><em>სულ</em><b>${stats.users.total}</b></div>
          <div><em>დაბლოკილი</em><b>${stats.users.blocked}</b></div>
          <div><em>დღეს</em><b>+${stats.users.newToday}</b></div>
          <div><em>ჯანმრთელი</em><b>${activePct == null ? '—' : `${activePct}%`}</b></div>
        </div>
        <div class="dash-status-spark">${ngSparkFromTrend(signupTrend, 'teal')}</div>
        <button class="btn tiny primary" data-go="ai">${icon('spark')} AI</button>
      </section>

      <div class="dash-glance">
        <div class="dash-glance-item">
          <span>ახალი · 7 დღე</span>
          <strong>+${stats.users.newWeek}</strong>
          <em class="${weekDelta >= 0 ? 'up' : 'down'}">${weekDelta >= 0 ? '+' : ''}${weekDelta} წინა კვირასთან</em>
        </div>
        <div class="dash-glance-item">
          <span>AI · 24სთ</span>
          <strong>${act.aiLast24h ?? 0}</strong>
          <em>${act.aiErrors24h ? `${act.aiErrors24h} შეცდომა` : 'შეცდომა არ არის'}</em>
        </div>
        <div class="dash-glance-item">
          <span>SMS · 24სთ</span>
          <strong>${act.smsLast24h ?? 0}</strong>
          <em>${act.smsFailed ? `${act.smsFailed} წარუმატებელი სულ` : 'სტაბილური'}</em>
        </div>
        <div class="dash-glance-item">
          <span>Push გაგზავნილი</span>
          <strong>${act.pushSent ?? 0}</strong>
          <em>${act.pushLast24h ?? 0} ბოლო 24სთ · ${act.pushTokens ?? 0} მოწყობილობა</em>
        </div>
        <div class="dash-glance-item">
          <span>ფარმაცია</span>
          <strong>${act.catalogProducts ?? 0}</strong>
          <em>პროდუქტი კატალოგში</em>
        </div>
      </div>

      <div class="ng-metrics-row dash-metrics-6">
        ${ngMetricCard({
          label: 'მომხმარებლები',
          value: stats.users.total,
          hint: `+${stats.users.newToday} დღეს · ${stats.users.active} აქტიური`,
          iconName: 'users',
          tone: 'teal',
          spark: signupTrend,
        })}
        ${ngMetricCard({
          label: 'AI მოთხოვნა',
          value: act.aiTotal ?? 0,
          hint: `${act.aiLast24h ?? 0} დღეს · ${act.aiLast7d ?? 0} 7 დღეში`,
          iconName: 'spark',
          tone: 'cyan',
          spark: aiTrend,
        })}
        ${ngMetricCard({
          label: 'ჩანაწერები',
          value: stats.records,
          hint: 'სამედიცინო ფაილები',
          iconName: 'file',
          tone: 'rose',
          spark: recordTrend,
        })}
        ${ngMetricCard({
          label: 'AI ჩატები',
          value: stats.chats,
          hint: 'ექიმი · კონსილიუმი',
          iconName: 'message',
          tone: 'cyan',
          spark: chatTrend,
        })}
        ${ngMetricCard({
          label: 'მედიკამენტები',
          value: stats.medications,
          hint: `${act.visits ?? 0} ვიზიტი · ${act.cycleProfiles ?? 0} ციკლი`,
          iconName: 'pill',
          tone: 'amber',
        })}
        ${ngMetricCard({
          label: 'SMS',
          value: act.smsTotal ?? 0,
          hint: `${act.smsLast24h ?? 0} ბოლო 24სთ`,
          iconName: 'send',
          tone: 'teal',
        })}
      </div>

      <div class="dash-charts">
        <div class="card dash-pkg-card dash-chart-wide">
          <div class="card-head">
            ${iconTile('activity')}
            <div>
              <h3>რეგისტრაციები · 14 დღე</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">${stats.users.newMonth} ახალი ამ თვეში · +${stats.users.newWeek} კვირაში</p>
            </div>
            <button class="btn tiny ghost grow" data-go="users">${icon('arrow')} რეესტრი</button>
          </div>
          ${dashAreaChart(signupTrend, 'teal')}
        </div>
        <div class="card dash-pkg-card">
          <div class="card-head">
            ${iconTile('layers', 'ult')}
            <div>
              <h3>პაკეტები</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">${assigned} აქტიური ტარიფზე</p>
            </div>
          </div>
          ${dashDonut(stats.packages.map((p) => ({
            label: p.nameKa,
            count: p.users,
            color: pkgColors[p.code] || 'var(--muted)',
          })))}
        </div>
        <div class="card dash-pkg-card">
          <div class="card-head">
            ${iconTile('users')}
            <div>
              <h3>აუდიტორია</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">${stats.users.withPhone} ტელეფონით</p>
            </div>
          </div>
          ${usersMixHtml([
            { label: 'ქალი', count: g.female || 0, tone: 'standard', bar: 'std' },
            { label: 'კაცი', count: g.male || 0, tone: 'ok', bar: '' },
            { label: 'სხვა / უცნობი', count: (g.other || 0) + (g.unknown || 0), tone: 'neutral', bar: 'ult' },
          ])}
        </div>
      </div>

      <div class="dash-charts dash-charts-2">
        <div class="card dash-pkg-card">
          <div class="card-head">
            ${iconTile('spark', 'ult')}
            <div>
              <h3>აქტივობა · 14 დღე</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">AI მოთხოვნები და ჩატები</p>
            </div>
            <div class="dash-legend">
              <span class="dash-legend-item teal">AI</span>
              <span class="dash-legend-item cyan">ჩატი</span>
            </div>
          </div>
          ${dashLineChart([
            { tone: 'teal', points: aiTrend },
            { tone: 'cyan', points: chatTrend },
          ])}
        </div>
        <div class="card dash-pkg-card">
          <div class="card-head">
            ${iconTile('file')}
            <div>
              <h3>პლატფორმის მოცულობა</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">რა ინახება სისტემაში</p>
            </div>
          </div>
          ${usersMixHtml([
            { label: 'AI მოთხოვნა', count: act.aiTotal || 0, tone: 'ok', bar: '' },
            { label: 'ჩატები', count: stats.chats, tone: 'standard', bar: 'std' },
            { label: 'ჩანაწერები', count: stats.records, tone: 'neutral', bar: 'ult' },
            { label: 'მედიკამენტები', count: stats.medications, tone: 'ultimate', bar: 'ult' },
            { label: 'ვიზიტები', count: act.visits || 0, tone: 'neutral', bar: '' },
            { label: 'ციკლის პროფილი', count: act.cycleProfiles || 0, tone: 'standard', bar: 'std' },
          ])}
        </div>
      </div>

      <div class="ng-quick-row">
        <button class="btn ghost" data-go="users">${icon('users')} მომხმარებლები</button>
        <button class="btn ghost" data-go="sms">${icon('send')} SMS</button>
        <button class="btn ghost" data-go="push">${icon('bell')} Push</button>
        <button class="btn ghost" data-go="pharmacy">${icon('pill')} ფარმაცია</button>
        <button class="btn ghost" data-go="ai">${icon('spark')} AI ხარისხი</button>
      </div>

      ${dashProvidersHtml(balances)}

      <div class="ai-split" style="--i:5">
        <div class="card dash-pkg-card">
          <div class="card-head">
            ${iconTile('layers', 'ult')}
            <div>
              <h3>პაკეტების განაწილება</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">${assigned} აქტიური მომხმარებელი ტარიფის მიხედვით</p>
            </div>
            <button class="btn tiny ghost grow" data-go="packages">${icon('arrow')} ყველა</button>
          </div>
          ${dashPkgBars(stats.packages, maxPkg, assigned)}
        </div>

        <div class="card dash-mode-card">
          <div class="card-head">
            ${iconTile(modeOk ? 'shield' : 'alert', modeOk ? 'ok' : 'warn')}
            <div>
              <h3>აპის რეჟიმი</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">${modeOk ? 'ყველა სერვისი ღიაა' : 'საჭიროა ყურადღება'}</p>
            </div>
          </div>
          <div class="dash-mode-grid">
            <div class="dash-mode-item ${s.maintenanceMode ? 'on bad' : 'off'}">
              ${icon('globe')}
              <div>
                <strong>ოფლაინი / განახლება</strong>
                <span>${s.maintenanceMode ? 'ჩართ. — აპი გათიშულია' : 'გამორთ.'}</span>
              </div>
            </div>
            <div class="dash-mode-item ${s.forceUpdate ? 'on warn' : 'off'}">
              ${icon('zap')}
              <div>
                <strong>იძულებითი განახლება</strong>
                <span>${s.forceUpdate ? 'ჩართ. — სავალდებულო განახლება' : 'გამორთ.'}</span>
              </div>
            </div>
            <div class="dash-mode-item ${s.allowRegistrations ? 'on ok' : 'off'}">
              ${icon('users')}
              <div>
                <strong>რეგისტრაცია</strong>
                <span>${s.allowRegistrations ? 'ღიაა' : 'დახურულია'}</span>
              </div>
            </div>
            <div class="dash-mode-item">
              ${icon('activity')}
              <div>
                <strong>აპის ვერსია</strong>
                <span class="mono">${escapeHtml(s.mobileAppVersion || s.minAppVersion)}</span>
              </div>
            </div>
          </div>
          <div class="dash-mode-foot">
            <span class="muted mono">${escapeHtml(s.supportEmail || 'support@medicard.ge')}</span>
            <button class="btn tiny primary" data-go="settings">${icon('settings')} რეჟიმის შეცვლა</button>
          </div>
        </div>
      </div>

      <div class="table-card ai-log-card dash-users-card" style="--i:6">
        <div class="card-head">
          ${iconTile('users')}
          <div>
            <h3>ბოლო მომხმარებლები</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px">${recent.total} ანგარიში სულ · ბოლო რეგისტრაციები</p>
          </div>
          <button class="btn tiny ghost grow" data-go="users">${icon('arrow')} რეესტრი</button>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>მომხმარებელი</th>
                <th>კონტაქტი</th>
                <th>პაკეტი</th>
                <th>სტატუსი</th>
                <th>რეგისტრაცია</th>
                <th class="col-actions">მოქმედება</th>
              </tr>
            </thead>
            <tbody>
              ${(recent.users || []).length ? recent.users.map((u) => `
                <tr data-open="${u.id}">
                  <td>
                    <div class="ai-person">
                      <div class="avatar">${escapeHtml(initials(u.fullName))}</div>
                      <div class="stack">
                        <strong>${escapeHtml(u.fullName)}</strong>
                        <span class="sub muted mono">${escapeHtml(u.id.slice(0, 8))}…</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="stack">
                      <strong>${escapeHtml(u.email || '—')}</strong>
                      <span class="sub muted">${escapeHtml(u.phone || '')}</span>
                    </div>
                  </td>
                  <td>${pkgBadge(u.package)}</td>
                  <td>${statusBadge(u.status)}</td>
                  <td class="mono col-date">${fmtDateShort(u.createdAt)}</td>
                  ${tableActionCell(`<button class="btn tiny ghost" data-open-btn="${u.id}">${icon('file')} ნახვა</button>`)}
                </tr>
              `).join('') : '<tr><td colspan="6"><div class="empty"><strong>ჯერ არავინ დარეგისტრირებულა</strong>პირველი მომხმარებელი აქ გამოჩნდება.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.go));
  });
  document.querySelectorAll('[data-open], [data-open-btn]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation?.();
      editUser(el.dataset.open || el.dataset.openBtn);
    });
  });
  document.querySelectorAll('tr[data-open]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      editUser(row.dataset.open);
    });
  });
  $('balances-refresh')?.addEventListener('click', async () => {
    $('balances-refresh').disabled = true;
    try { await renderOverview(true); toast('ბალანსი განახლდა'); }
    catch (err) { toast(err.message, 'bad'); }
  });
}

function sortUsers(list) {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  const key = state.sortKey;
  return [...list].sort((a, b) => {
    const va = key === 'package' ? a.package?.code : key === 'used' ? a.usage?.used : a[key];
    const vb = key === 'package' ? b.package?.code : key === 'used' ? b.usage?.used : b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), 'ka') * dir;
  });
}

function usersCurrentPage() {
  return Math.floor(state.offset / USERS_PAGE_SIZE) + 1;
}

function usersTotalPages() {
  return Math.max(1, Math.ceil(state.total / USERS_PAGE_SIZE));
}

function avatarTone(user) {
  if (user.status === 'BLOCKED') return 'muted';
  return pkgClass(user.package?.code);
}

function paintUserPagination(onPage) {
  const wrap = $('user-pager-pages');
  if (!wrap) return;
  const totalPages = usersTotalPages();
  const current = usersCurrentPage();
  if (state.total === 0) {
    wrap.innerHTML = '';
    return;
  }

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('…');
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  wrap.innerHTML = pages
    .map((p) => (p === '…'
      ? '<span class="pager-ellipsis">…</span>'
      : `<button type="button" class="pager-page${p === current ? ' active' : ''}" data-page="${p}">${p}</button>`))
    .join('');

  wrap.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.offset = (Number(btn.dataset.page) - 1) * USERS_PAGE_SIZE;
      onPage();
    });
  });
}

async function renderUsers() {
  const userId = userIdFromHash();
  if (userId) {
    await renderUserPage(userId, { profileTab: hashSearch().get('profileTab') });
    return;
  }
  state.userPageId = null;
  const root = $('tab-users');
  const hotkey = searchHotkeyLabel();
  root.innerHTML = `
    <div class="users-page users-os v25-users dash-enter">
      <div class="orders-kpis users-os-kpis" id="users-metrics" style="--i:0">
        ${usersFilterMetric({ label: 'სულ', value: '—', hint: 'რეესტრში', iconName: 'users', tone: 'teal', statusFilter: '', valueId: 'users-stat-total' })}
        ${usersFilterMetric({ label: 'აქტიური', value: '—', hint: 'შეუძლია შესვლა', iconName: 'check', tone: 'cyan', statusFilter: 'ACTIVE', valueId: 'users-stat-active' })}
        ${usersFilterMetric({ label: 'დაბლოკილი', value: '—', hint: 'წვდომა შეზღუდულია', iconName: 'lock', tone: 'rose', statusFilter: 'BLOCKED', valueId: 'users-stat-blocked' })}
        ${usersFilterMetric({ label: 'პრემიუმი', value: '—', hint: 'STANDARD · ULTIMATE', iconName: 'layers', tone: 'amber', valueId: 'users-stat-premium' })}
      </div>

      <div class="users-os-insights" style="--i:1">
        <article class="users-os-insight users-os-trend-card">
          <header>
            <div>
              <h3>რეგისტრაციები</h3>
              <p>ბოლო 14 დღე · ახალი ანგარიშები</p>
            </div>
            <div class="users-os-live">
              <div id="users-pulse-ring" class="users-os-ring">${dashHealthRing(null, null, '')}</div>
              <div>
                <strong id="users-pulse-value">—</strong>
                <span id="users-pulse-hint">აქტიური ანგარიშები · დაბლოკილი · სულ</span>
              </div>
              <div id="users-pulse-spark">${ngSparkBars('teal')}</div>
            </div>
          </header>
          <div class="users-os-pills">
            <span class="users-os-pill teal">${icon('calendar')} <strong id="users-pill-week">—</strong> ამ კვირაში</span>
            <span class="users-os-pill amber">${icon('layers')} <strong id="users-pill-premium">—</strong> პრემიუმი</span>
          </div>
          <div id="users-trend-chart"><p class="muted">იტვირთება…</p></div>
        </article>
        <article class="users-os-insight">
          <header>
            <div>
              <h3>პაკეტები</h3>
              <p>აქტიური ტარიფები</p>
            </div>
          </header>
          <div id="users-pkg-chart"><p class="muted">იტვირთება…</p></div>
        </article>
        <article class="users-os-insight">
          <header>
            <div>
              <h3>პროფილი</h3>
              <p>სქესი და ტელეფონი</p>
            </div>
          </header>
          <div id="users-mix-chart"><p class="muted">იტვირთება…</p></div>
        </article>
      </div>

      <section class="table-card users-console users-os-board" style="--i:2">
        <div class="users-os-toolbar">
          <div class="users-os-toolbar-main">
            <label class="orders-search users-os-search">
              <span class="sr-only">ძებნა</span>
              ${icon('search')}
              <input id="user-q" type="search" placeholder="სახელი, ელ-ფოსტა ან ტელეფონი…" autocomplete="off" />
              <button type="button" id="user-q-clear" class="users-search-clear hidden" aria-label="ძებნის გასუფთავება">${icon('x')}</button>
              <kbd class="users-kbd">${hotkey}</kbd>
            </label>
            <span id="user-meta" class="users-meta-label">იტვირთება…</span>
            <button type="button" id="user-clear-filters" class="btn tiny ghost hidden">${icon('x')} გასუფთავება</button>
            <div class="users-toolbar-actions">
              <button class="btn tiny ghost" id="user-reload" type="button">${icon('refresh')} განახლება</button>
              <button class="btn tiny ghost" id="user-csv" type="button">${icon('download')} CSV</button>
            </div>
          </div>
          <div class="users-os-toolbar-filters">
          <div class="orders-filters users-os-filters" role="tablist" aria-label="სტატუსი">
            <button type="button" class="active" data-status-chip="" aria-pressed="true">ყველა</button>
            <button type="button" data-status-chip="ACTIVE" aria-pressed="false">აქტიური <b id="chip-active-n"></b></button>
            <button type="button" data-status-chip="BLOCKED" aria-pressed="false">დაბლოკილი <b id="chip-blocked-n"></b></button>
          </div>
          <div class="orders-filters users-os-filters users-os-pkg-filters" role="group" aria-label="პაკეტი">
            <button type="button" class="active" data-package-chip="" aria-pressed="true">ყველა ტარიფი</button>
            <button type="button" class="chip-free" data-package-chip="FREE" aria-pressed="false">FREE</button>
            <button type="button" class="chip-std" data-package-chip="STANDARD" aria-pressed="false">STANDARD</button>
            <button type="button" class="chip-ult" data-package-chip="ULTIMATE" aria-pressed="false">ULTIMATE</button>
          </div>
          <div class="orders-filters users-os-filters users-os-activity-filters" role="group" aria-label="აქტივობა">
            <button type="button" class="active" data-activity-chip="" aria-pressed="true">ყველა აქტივობა</button>
            <button type="button" data-activity-chip="today">აქტიური დღეს</button>
            <button type="button" data-activity-chip="inactive7">7+ დღე</button>
            <button type="button" data-activity-chip="inactive30">30+ დღე</button>
            <button type="button" data-activity-chip="medi">Medi</button>
            <button type="button" data-activity-chip="meds">მედიკამენტები</button>
            <button type="button" data-activity-chip="cycle">ციკლი</button>
            <button type="button" data-activity-chip="ios">iOS</button>
            <button type="button" data-activity-chip="android">Android</button>
            <button type="button" data-activity-chip="notif_disabled">ნოტიფი გამორთული</button>
            <button type="button" data-activity-chip="outdated">ძველი ვერსია</button>
          </div>
          </div>
          <select id="user-activity" class="sr-only" aria-hidden="true" tabindex="-1">
            <option value=""></option>
            <option value="today"></option>
            <option value="inactive7"></option>
            <option value="inactive30"></option>
            <option value="medi"></option>
            <option value="meds"></option>
            <option value="cycle"></option>
            <option value="ios"></option>
            <option value="android"></option>
            <option value="notif_disabled"></option>
            <option value="outdated"></option>
          </select>
          <select id="user-status" class="sr-only" aria-hidden="true" tabindex="-1">
            <option value="">ყველა სტატუსი</option>
            <option value="ACTIVE">აქტიური</option>
            <option value="BLOCKED">დაბლოკილი</option>
          </select>
          <select id="user-package" class="sr-only" aria-hidden="true" tabindex="-1">
            <option value="">ყველა პაკეტი</option>
            <option value="FREE">FREE</option>
            <option value="STANDARD">STANDARD</option>
            <option value="ULTIMATE">ULTIMATE</option>
          </select>
        </div>

        <div class="table-wrap users-table-wrap" id="users-table-wrap">
          <table class="users-table admin-table" aria-label="მომხმარებლების რეესტრი">
            <colgroup>
              <col class="col-user" />
              <col class="col-status" />
              <col class="col-pkg" />
              <col class="col-when" />
              <col class="col-plat" />
              <col class="col-stats" />
            </colgroup>
            <thead>
              <tr>
                <th class="col-user" data-sort="fullName">პირი</th>
                <th class="col-status" data-sort="status">სტატუსი</th>
                <th class="col-pkg" data-sort="package">პაკეტი</th>
                <th class="col-when" data-sort="lastCheckInDate">ბოლო აქტივობა</th>
                <th class="col-plat">პლატფორმა</th>
                <th class="col-stats">აქტივობა</th>
              </tr>
            </thead>
            <tbody id="users-tbody">${usersSkeletonHtml()}</tbody>
          </table>
        </div>
        <div class="table-pager users-pager">
          <div class="pager-info">
            <strong id="page-ind">0 / 0</strong>
            <span class="muted" id="page-size-label">· ${USERS_PAGE_SIZE} / გვერდი</span>
          </div>
          <div class="pager-controls">
            <button class="btn tiny ghost pager-nav" id="prev-page" type="button">${icon('arrow')} წინა</button>
            <div class="pager-pages" id="user-pager-pages"></div>
            <button class="btn tiny ghost pager-nav" id="next-page" type="button">შემდეგი ${icon('arrow')}</button>
          </div>
        </div>
      </section>
    </div>
  `;

  const syncFilters = () => {
    const status = $('user-status').value;
    const pkg = $('user-package').value;
    const q = $('user-q').value.trim();
    const activity = $('user-activity')?.value || '';
    document.querySelectorAll('[data-activity-chip]').forEach((btn) => {
      const on = btn.dataset.activityChip === activity;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('[data-status-filter]').forEach((btn) => {
      const on = Boolean(status) && btn.dataset.statusFilter === status;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('[data-status-chip]').forEach((btn) => {
      const on = btn.dataset.statusChip === status;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('[data-package-chip]').forEach((btn) => {
      const on = btn.dataset.packageChip === pkg;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    $('user-q-clear')?.classList.toggle('hidden', !q);
    $('user-clear-filters')?.classList.toggle('hidden', !(q || status || pkg || hashSearch().get('appVersion')));
  };

  const load = async () => {
    const q = $('user-q').value.trim();
    const status = $('user-status').value;
    const pkg = $('user-package').value;
    if (!$('user-activity')?.value && hashSearch().get('activity')) {
      $('user-activity').value = hashSearch().get('activity');
    }
    const activity = $('user-activity')?.value || '';
    const appVersion = hashSearch().get('appVersion') || '';
    const wrap = $('users-table-wrap');
    const body = $('users-tbody');
    wrap?.classList.add('is-loading');
    if (!state.users.length && body) body.innerHTML = usersSkeletonHtml();
    syncFilters();
    const params = new URLSearchParams({ limit: String(USERS_PAGE_SIZE), offset: String(state.offset) });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (pkg) params.set('package', pkg);
    if (activity) params.set('activity', activity);
    if (appVersion) params.set('appVersion', appVersion);
    try {
      const [data, stats] = await Promise.all([
        api(`/users?${params.toString()}`),
        api('/stats').catch(() => null),
      ]);
      state.users = data.users;
      state.total = data.total;
      if (stats?.users) {
        const u = stats.users;
        const fmt = (n) => Number(n || 0).toLocaleString('ka-GE');
        const premium = (stats.packages || [])
          .filter((p) => String(p.code).toUpperCase() !== 'FREE')
          .reduce((sum, p) => sum + (p.users || 0), 0);
        const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
        setText('users-stat-total', fmt(u.total));
        setText('users-stat-active', fmt(u.active));
        setText('users-stat-blocked', fmt(u.blocked));
        setText('users-stat-premium', fmt(premium));
        setText('users-pulse-value', fmt(u.active));
        setText('users-pulse-hint', `${fmt(u.active)} აქტიური · ${fmt(u.blocked)} დაბლოკილი · ${fmt(u.total)} სულ`);
        setText('users-pill-week', fmt(u.newWeek));
        setText('users-pill-premium', fmt(premium));
        const chipA = $('chip-active-n');
        const chipB = $('chip-blocked-n');
        if (chipA) chipA.textContent = u.active;
        if (chipB) chipB.textContent = u.blocked;
        const ring = $('users-pulse-ring');
        if (ring) ring.innerHTML = dashHealthRing(u.active, u.total, 'აქტიური ანგარიშები');
        const spark = $('users-pulse-spark');
        if (spark) spark.innerHTML = usersTrendSpark(u.trend);
        const trendEl = $('users-trend-chart');
        if (trendEl) trendEl.innerHTML = usersTrendHtml(u.trend);
        const pkgEl = $('users-pkg-chart');
        if (pkgEl) {
          const assigned = (stats.packages || []).reduce((sum, p) => sum + (p.users || 0), 0);
          const maxPkg = Math.max(1, ...(stats.packages || []).map((p) => p.users || 0));
          pkgEl.innerHTML = dashPkgBars(stats.packages || [], maxPkg, assigned);
        }
        const mixEl = $('users-mix-chart');
        if (mixEl) {
          const g = u.gender || {};
          const phone = u.withPhone || 0;
          mixEl.innerHTML = `
            ${usersMixHtml([
              { label: 'ქალი', count: g.female || 0, tone: 'ultimate', bar: 'ult' },
              { label: 'კაცი', count: g.male || 0, tone: 'standard', bar: 'std' },
              { label: 'სხვა / უცნობი', count: (g.other || 0) + (g.unknown || 0), tone: 'free' },
            ])}
            <div class="users-mix-sep"></div>
            ${usersMixHtml([
              { label: 'ტელეფონი აქვს', count: phone, tone: 'ok', bar: '' },
              { label: 'ტელეფონი არ აქვს', count: Math.max(0, (u.total || 0) - phone), tone: 'neutral' },
            ])}
          `;
        }
        const hintWeek = $('users-stat-total-hint');
        if (hintWeek && u.newWeek != null) hintWeek.textContent = `${fmt(u.newWeek)} ახალი ამ კვირაში`;
      }
      paintUsers();
    } catch (err) {
      toast(err.message, 'bad');
      if (body) {
        body.innerHTML = `<tr><td colspan="6"><div class="empty users-empty">${icon('alert', 'lg')}<strong>ჩატვირთვა ვერ მოხერხდა</strong><p>${escapeHtml(err.message)}</p></div></td></tr>`;
      }
    } finally {
      wrap?.classList.remove('is-loading');
    }
  };

  const paintUsers = () => {
    const rows = sortUsers(state.users);
    const from = state.total ? state.offset + 1 : 0;
    const to = state.total ? Math.min(state.offset + USERS_PAGE_SIZE, state.total) : 0;
    const filtered = Boolean($('user-q').value.trim() || $('user-status').value || $('user-package').value || hashSearch().get('appVersion'));
    const versionHint = hashSearch().get('appVersion');
    $('user-meta').textContent = state.total
      ? `${from}–${to}  ·  ${state.total.toLocaleString('ka-GE')} ანგარიში${versionHint ? ` · აპი ${versionHint}` : ''}`
      : (filtered ? 'ფილტრს არ ემთხვევა' : 'ჩანაწერი არ არის');
    $('page-ind').textContent = state.total ? `${from}–${to} / ${state.total.toLocaleString('ka-GE')}` : '0 / 0';
    const prev = $('prev-page');
    const next = $('next-page');
    if (prev) prev.disabled = state.offset === 0;
    if (next) next.disabled = state.offset + USERS_PAGE_SIZE >= state.total;
    paintUserPagination(load);
    document.querySelectorAll('.users-table th[data-sort]').forEach((th) => {
      th.classList.toggle('sort-asc', th.dataset.sort === state.sortKey && state.sortDir === 'asc');
      th.classList.toggle('sort-desc', th.dataset.sort === state.sortKey && state.sortDir === 'desc');
    });
    const body = $('users-tbody');
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6"><div class="empty users-empty">${icon('users', 'lg')}<strong>მომხმარებლები ვერ მოიძებნა</strong><p>${filtered ? 'შეცვალე ძებნა ან გაასუფთავე ფილტრი' : 'პირველი ანგარიში აქ გამოჩნდება'}</p>${filtered ? `<button type="button" class="btn tiny ghost" id="users-empty-clear">${icon('x')} გასუფთავება</button>` : ''}</div></td></tr>`;
      $('users-empty-clear')?.addEventListener('click', () => {
        $('user-q').value = '';
        $('user-status').value = '';
        $('user-package').value = '';
        state.offset = 0;
        load();
      });
      return;
    }
    body.innerHTML = rows.map((u) => `
      <tr data-id="${u.id}" class="users-row ${state.selectedId === u.id ? 'selected' : ''} ${u.status === 'BLOCKED' ? 'row-blocked' : ''}" tabindex="0">
        <td class="col-user">
          <div class="person users-person">
            <div class="users-avatar-wrap ${u.status === 'BLOCKED' ? 'is-blocked' : 'is-active'}">
              <div class="avatar avatar-${avatarTone(u)}">${escapeHtml(initials(u.fullName))}</div>
            </div>
            <div class="users-person-copy">
              <strong>${escapeHtml(u.fullName)}</strong>
              <span class="sub users-email-sub" title="${escapeAttr(u.email)}${u.phone ? ` · ${escapeAttr(u.phone)}` : ''}">${escapeHtml(u.email)}</span>
            </div>
          </div>
        </td>
        <td class="col-status">${usersStatusCell(u.status)}</td>
        <td class="col-pkg">
          <div class="stack users-pkg-stack">
            <div class="users-pkg-badge">${pkgBadge(u.package)}</div>
          </div>
        </td>
        <td class="col-when">
          <div class="users-when">
            <strong>${u.lastActiveAt ? fmtRelative(u.lastActiveAt) : '—'}</strong>
            <span>${u.lastActiveAt ? fmtDateShort(u.lastActiveAt) : ''}</span>
          </div>
        </td>
        <td class="col-plat">
          <div class="users-client">
            <strong>${platformKa(u.platform) || '—'}</strong>
            <span>${u.appVersion ? escapeHtml(u.appVersion) : ''}</span>
          </div>
        </td>
        <td class="col-stats">${usersActivityCell(u)}</td>
      </tr>
    `).join('');

    body.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        editUser(tr.dataset.id);
      });
      tr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          editUser(tr.dataset.id);
        }
      });
    });
  };

  document.querySelectorAll('.users-table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      if (state.sortKey === th.dataset.sort) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = th.dataset.sort; state.sortDir = 'asc'; }
      paintUsers();
    });
  });
  const applyStatus = (value) => {
    $('user-status').value = value;
    state.offset = 0;
    load();
  };
  const applyPackage = (value) => {
    $('user-package').value = value;
    state.offset = 0;
    load();
  };
  document.querySelectorAll('[data-status-filter]').forEach((btn) => {
    btn.addEventListener('click', () => applyStatus(btn.dataset.statusFilter));
  });
  document.querySelectorAll('[data-status-chip]').forEach((btn) => {
    btn.addEventListener('click', () => applyStatus(btn.dataset.statusChip));
  });
  document.querySelectorAll('[data-package-chip]').forEach((btn) => {
    btn.addEventListener('click', () => applyPackage(btn.dataset.packageChip));
  });
  document.querySelectorAll('[data-activity-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if ($('user-activity')) $('user-activity').value = btn.dataset.activityChip;
      state.offset = 0;
      load();
    });
  });
  $('user-reload').onclick = load;
  window.__reloadUsers = load;
  let searchTimer;
  $('user-q').oninput = () => {
    $('user-q-clear').classList.toggle('hidden', !$('user-q').value);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.offset = 0; load(); }, 280);
  };
  $('user-q').onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(searchTimer); state.offset = 0; load(); } };
  $('user-q-clear').onclick = () => {
    $('user-q').value = '';
    state.offset = 0;
    load();
    $('user-q').focus();
  };
  $('user-clear-filters').onclick = () => {
    $('user-q').value = '';
    $('user-status').value = '';
    $('user-package').value = '';
    if ($('user-activity')) $('user-activity').value = '';
    writeTabHash('users');
    state.offset = 0;
    load();
  };
  $('prev-page').onclick = () => { state.offset = Math.max(0, state.offset - USERS_PAGE_SIZE); load(); };
  $('next-page').onclick = () => {
    if (state.offset + USERS_PAGE_SIZE < state.total) { state.offset += USERS_PAGE_SIZE; load(); }
  };
  $('user-csv').onclick = () => {
    const params = new URLSearchParams();
    const q = $('user-q').value.trim();
    const appVersion = hashSearch().get('appVersion') || '';
    if (q) params.set('q', q);
    if (appVersion) params.set('appVersion', appVersion);
    if (typeof opsDownload === 'function') {
      opsDownload(`/export/users?${params.toString()}`, 'users.csv');
      return;
    }
    const header = ['id', 'fullName', 'email', 'phone', 'status', 'package', 'used', 'limit', 'createdAt'];
    const lines = [header.join(',')].concat(state.users.map((u) => [
      u.id, `"${u.fullName}"`, u.email, u.phone || '', u.status, u.package?.code || '',
      u.usage?.used ?? '', u.usage?.unlimited ? 'unlimited' : (u.usage?.limit ?? ''), u.createdAt,
    ].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'medicard-users.csv';
    a.click();
    toast('CSV გადმოწერილია');
  };
  await load();
}

async function confirmDeleteUser(id, name, email) {
  const label = name || email || id;
  const ok = confirm(
    `სამუდამოდ წავშალოთ „${label}"?\n\n` +
      'წაიშლება პროფილი, ჯანმრთელობის მონაცემები, ჩანაწერები, ჩატები და მედიკამენტები.\n' +
      'ეს ქმედება შეუქცევადია.',
  );
  if (!ok) return false;
  await api(`/users/${id}`, { method: 'DELETE' });
  toast('მომხმარებელი სამუდამოდ წაიშალა', 'bad');
  if (state.selectedId === id) state.selectedId = null;
  return true;
}

function invUnknown(value) {
  return value ? escapeHtml(String(value)) : '<span class="unknown">უცნობია</span>';
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
  ['overview', 'მიმოხილვა'],
  ['activity', 'აქტივობა'],
  ['product', 'პროდუქტის გამოყენება'],
  ['notifications', 'შეტყობინებები'],
  ['devices', 'მოწყობილობები'],
  ['audit', 'აუდიტი'],
];
const FEATURE_USAGE_LABELS = {
  medi: 'Medi',
  medications: 'მედიკამენტები',
  cycle: 'ციკლი',
  hydration: 'ჰიდრატაცია',
  steps: 'ნაბიჯები',
  weight: 'წონა',
  visits: 'ვიზიტები',
  weekly_report: 'კვირის ანგარიში',
};

function renderUserInvestigationTabs(user, extra, pkgOptions, isPaid, activeTab) {
  const inv = extra.investigation || {};
  const ov = inv.overview || {};
  const usage = inv.productUsage || {};
  const notes = inv.notifications || extra.notifications || {};
  const tab = USER_TABS.some(([key]) => key === activeTab) ? activeTab : 'overview';
  const tel = ov.telemetry || notes.telemetry || {};
  const row = (label, value) => `<div class="inv-row"><span>${label}</span><strong>${value}</strong></div>`;
  const form = `
    <div class="umodal-form">
      <label class="field"><span>სახელი</span><input id="edit-name" value="${escapeAttr(user.fullName)}" /></label>
      <label class="field"><span>ელ-ფოსტა</span><input id="edit-email" type="email" value="${escapeAttr(user.email)}" /></label>
      <label class="field"><span>ტელეფონი</span><input id="edit-phone" type="tel" value="${escapeAttr(user.phone || '')}" placeholder="—" /></label>
      <label class="field"><span>სტატუსი</span>
        <select id="edit-status">
          <option value="ACTIVE" ${user.status === 'ACTIVE' ? 'selected' : ''}>აქტიური — შეუძლია შესვლა</option>
          <option value="BLOCKED" ${user.status === 'BLOCKED' ? 'selected' : ''}>დაბლოკილი — შესვლა აკრძალულია</option>
        </select>
      </label>
      <label class="field"><span>თვიური პაკეტი</span>
        <select id="edit-package">${pkgOptions}</select>
      </label>
      <p class="muted umodal-hint">გადახდილი პაკეტის მინიჭება იწყებს ახალ 30-დღიან პერიოდს.</p>
      <label class="field"><span>პაკეტის დაწყება</span>
        <input id="edit-started" type="date" value="${toDateInput(user.packageStartedAt)}" ${isPaid ? '' : 'disabled'} />
      </label>
      <label class="field"><span>პაკეტის ვადა</span>
        <input id="edit-expires" type="date" value="${toDateInput(user.packageExpiresAt)}" ${isPaid ? '' : 'disabled'} />
      </label>
      <label class="field span-2"><span>ადმინ შენიშვნა</span>
        <textarea id="edit-note" rows="3">${escapeHtml(user.adminNote || '')}</textarea>
      </label>
    </div>`;
  const overview = `
    <div class="user-overview">
    <div class="user-overview-facts">
    <section class="inv-section"><h4>ანგარიში</h4>
    <div class="inv-grid">
      ${row('User ID', `<button type="button" class="inv-copy" data-copy="${escapeAttr(user.id)}" data-copy-label="User ID">${escapeHtml(user.id)}</button>`)}
      ${row('ანგარიშის სტატუსი', user.status === 'BLOCKED' ? 'დაბლოკილი' : 'აქტიური')}
      ${row('რეგისტრაცია', fmtDateShort(user.createdAt))}
    </div></section>
    <section class="inv-section"><h4>აქტივობა</h4>
    <div class="inv-grid">
      ${row('ბოლო აქტივობა', ov.lastActiveAt ? fmtDate(ov.lastActiveAt) : 'უცნობია')}
      ${row('პლატფორმა', platformKa(ov.platform) || 'უცნობია')}
      ${row('ბოლო აპის ვერსია', ov.appVersion || 'უცნობია')}
      ${row('ნოტიფიკაციის ნებართვა', permKa(ov.notificationPermission))}
    </div></section>
    <section class="inv-section"><h4>პროდუქტის ათვისება</h4>
    <div class="v25-adopt">
      ${Object.entries(FEATURE_USAGE_LABELS).map(([key, label]) => {
        const feat = usage[key] || {};
        const featIco = { medi: 'spark', medications: 'pill', cycle: 'calendar', hydration: 'activity', steps: 'activity', weight: 'activity', visits: 'calendar', weekly_report: 'file' };
        return `<div class="v25-adopt-item${feat.used ? ' is-on' : ''}">${icon(featIco[key] || 'activity')}<span>${label}</span><strong>${feat.used ? (feat.lastUsed ? fmtDateShort(feat.lastUsed) : 'კი') : '—'}</strong></div>`;
      }).join('')}
    </div></section>
    <section class="inv-section"><h4>შეტყობინების ქცევა</h4>
    <div class="inv-fatigue">
      <div><span>მომხმარებლის არჩევანი</span><strong>${escapeHtml(freqKa(ov.selectedFrequency))}</strong></div>
      <div><span>საბაზისო ლიმიტი</span><strong>${ov.baseDailyCap == null ? 'უცნობია' : `${ov.baseDailyCap} / დღე`}</strong></div>
      <div class="is-adapt"><span>Medi-ს მიმდინარე ადაპტაცია</span><strong>${ov.adaptiveDailyCap == null ? 'უცნობია' : `${ov.adaptiveDailyCap} / დღე`}</strong></div>
    </div>
    ${ov.capAdaptedByMedi || ov.capAdaptedNote ? `<p class="inv-note">Medi-მ დროებით შეამცირა სიხშირე ბოლო ჩართულობის მიხედვით. მომხმარებლის არჩევანი არ შეცვლილა.</p>` : ''}
    </section>
    </div>
    <section class="inv-section inv-edit user-overview-edit"><h4>ანგარიშის რედაქტირება</h4>
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
    const status = !feat.used ? 'არ გამოუყენებია' : active ? 'აქტიური' : 'გამოყენებული';
    const featIco = { medi: 'spark', medications: 'pill', cycle: 'calendar', hydration: 'activity', steps: 'activity', weight: 'activity', visits: 'calendar', weekly_report: 'file' };
    return `<div class="v25-feat-row">
      <b>${icon(featIco[key] || 'activity')} ${escapeHtml(label)}</b>
      <span class="v25-feat-status${feat.used ? ' is-on' : ''}">${status}</span>
      <em>${feat.lastUsed ? fmtDateShort(feat.lastUsed) : '—'}</em>
      <em>${feat.periodCount ?? 0}</em>
    </div>`;
  }).join('');
  const decisions = (notes.recentDecisions || extra.decisions || []).map((item) => `
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
      <div><span>არჩევანი</span><strong>${freqKa(notes.preference?.selectedFrequency || ov.selectedFrequency)}</strong></div>
      <div class="is-adapt"><span>საბაზისო / ადაპტაცია</span><strong>${notes.brain?.baseDailyCap ?? ov.baseDailyCap ?? '—'} → ${notes.brain?.adaptiveDailyCap ?? ov.adaptiveDailyCap ?? '—'}</strong></div>
      <div><span>ნებართვა</span><strong>${permKa(notes.permission || ov.notificationPermission)}</strong></div>
      <div><span>ტელემეტრია</span><strong>Brain ${yesNoKa(tel.brainSync)} · Outcome ${yesNoKa(tel.outcomeSync)}</strong></div>
    </div>
    <section class="inv-section"><h4>Adaptive Brain</h4>
    <div class="inv-fatigue">
      <div><span>საბაზისო ლიმიტი</span><strong>${notes.brain?.baseDailyCap ?? ov.baseDailyCap ?? 'უცნობია'} / დღე</strong></div>
      <div class="is-adapt"><span>Medi-ს ადაპტაცია</span><strong>${notes.brain?.adaptiveDailyCap ?? ov.adaptiveDailyCap ?? 'უცნობია'} / დღე</strong></div>
      <div><span>დაღლილობა</span><strong>${fatigueKa(notes.brain?.fatigueState || ov.fatigueState)}</strong></div>
    </div></section>
    <section class="inv-section"><h4>ტელემეტრია</h4>
    <div class="inv-grid">
      ${row('გახსნა / ქმედება', `${notes.opened ?? 0} / ${notes.actioned ?? 0}`)}
    </div>
    ${tel.brainSync === false ? '<p class="inv-note">ამ კლიენტის ვერსია Brain-ის სინქრონიზაციას არ უჭერს მხარს.</p>' : ''}
    ${tel.outcomeSync === false ? '<p class="inv-note">ამ კლიენტის ვერსია შედეგების სინქრონიზაციას არ უჭერს მხარს.</p>' : ''}
    </section>
    <section class="inv-section"><h4>ბოლო გადაწყვეტილებები</h4>
    <table class="inv-table"><thead><tr><th>Decision ID</th><th>ოჯახი</th><th>შედეგი</th><th>მიზეზი</th><th>დრო</th></tr></thead>
    <tbody>${decisions || '<tr><td colspan="5">გადაწყვეტილება ჯერ არ არის</td></tr>'}</tbody></table></section>
    <section class="inv-section"><h4>ბოლო შედეგები</h4>
    <table class="inv-table"><thead><tr><th>Decision ID</th><th>შედეგი</th><th>ქმედება</th><th>დრო</th></tr></thead>
    <tbody>${outcomes || '<tr><td colspan="4">შედეგი ჯერ არ არის</td></tr>'}</tbody></table></section>
    <section class="inv-section"><h4>დაბლოკვის მიზეზები</h4>
    <table class="inv-table"><thead><tr><th>მიზეზი</th><th>რაოდენობა</th></tr></thead>
    <tbody>${suppress || '<tr><td colspan="2">დაბლოკვა არ არის</td></tr>'}</tbody></table></section>`;

  const devices = (inv.devices || extra.devices || []).map((item) => `
    <article class="v25-device">
      <strong>${platformKa(item.platform) || 'უცნობია'}</strong>
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
      ${USER_TABS.map(([key, label]) => `<button type="button" class="user-tab" role="tab" data-user-tab="${key}" aria-selected="${key === tab}">${label}</button>`).join('')}
    </div>
    <div class="user-body">
      <div class="user-pane${tab === 'overview' ? ' is-on' : ''}" data-user-pane="overview">${overview}</div>
      <div class="user-pane${tab === 'activity' ? ' is-on' : ''}" data-user-pane="activity">${timeline}</div>
      <div class="user-pane${tab === 'product' ? ' is-on' : ''}" data-user-pane="product">
        <div class="v25-feat">${usageRows}</div>
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

async function renderUserPage(id, opts = {}) {
  const root = $('tab-users');
  if (!root) return;
  state.selectedId = id;
  state.userPageId = id;
  state.tab = 'users';
  sessionStorage.setItem(TAB_KEY, 'users');
  document.querySelectorAll('.nav').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === 'users');
  });
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.add('hidden'));
  root.classList.remove('hidden');
  if (hashSearch().get('user') && !hashPath().includes('/')) {
    history.replaceState({ tab: 'users' }, '', userPageHref(id, opts.profileTab));
  }

  root.innerHTML = `
    <div class="user-page">
      <div class="user-page-loading">${icon('refresh')}<span>პროფილი იტვირთება…</span></div>
    </div>`;
  setPageHeader('users', {
    users: ["რეესტრი", "პროფილი იტვირთება…", ""],
  });

  let user;
  let packages;
  let profileExtra;
  try {
    const rangeQs = typeof opsQs === 'function' ? opsQs() : 'range=30d';
    const data = await Promise.all([
      api(`/users/${id}?${rangeQs}`),
      api('/packages'),
    ]);
    user = data[0].user;
    packages = data[1].packages;
    profileExtra = data[0];
  } catch (err) {
    toast(err.message, 'bad');
    location.hash = usersListHref();
    return;
  }

  const pkgOptions = packages.map((p) => {
    const limitLabel = p.unlimited ? "შეუზღუდავი" : `${p.monthlyAiLimit} / თვე`;
    return `<option value="${p.code}" ${user.package?.code === p.code ? 'selected' : ''}>${p.code} — ${limitLabel}</option>`;
  }).join('');
  const isPaid = user.package?.code && user.package.code !== 'FREE';
  const aiLabel = user.usage?.unlimited
    ? "∞ შეუზღუდავი"
    : `${user.usage?.used ?? 0} / ${user.usage?.limit ?? '—'} · დარჩა ${user.usage?.remaining ?? '—'}`;
  const lastActive = profileExtra.activity?.lastActiveAt
    ? fmtDateShort(profileExtra.activity.lastActiveAt)
    : "უცნობია";

  setPageHeader('users', {
    users: ["რეესტრი", user.fullName, user.email],
  });

  root.innerHTML = `
    <div class="user-page">
      <a class="user-back" id="user-page-back" href="${usersListHref()}">${icon('chevronLeft')}<span>რეესტრი</span></a>

      <header class="user-hero">
        <div class="user-hero-top">
          <div class="users-avatar-wrap ${user.status === 'BLOCKED' ? 'is-blocked' : 'is-active'} user-avatar-wrap">
            <div class="avatar avatar-${avatarTone(user)} user-avatar">${escapeHtml(initials(user.fullName))}</div>
          </div>
          <div class="user-hero-copy">
            <h3>${escapeHtml(user.fullName)}</h3>
            <p class="user-hero-meta">
              <button type="button" class="users-copy-link" id="user-copy-email" title="კოპირება">${icon('copy')}<span>${escapeHtml(user.email)}</span></button>
              ${user.phone ? `<span class="user-hero-phone">${escapeHtml(user.phone)}</span>` : ''}
            </p>
            <button type="button" class="user-hero-id inv-copy" data-copy="${escapeAttr(user.id)}" data-copy-label="User ID">${escapeHtml(user.id)}</button>
          </div>
          <div class="user-hero-pills">
            ${pkgBadge(user.package)}
            ${usersStatusCell(user.status)}
          </div>
        </div>
        <div class="user-stats">
          <div class="user-stat"><span>რეგისტრაცია</span><strong>${fmtDateShort(user.createdAt)}</strong></div>
          <div class="user-stat"><span>ბოლო აქტივობა</span><strong>${lastActive}</strong></div>
          <div class="user-stat"><span>პლატფორმა</span><strong>${platformKa(profileExtra.activity?.platform || user.platform) || "უცნობია"}</strong></div>
          <div class="user-stat"><span>აპი</span><strong>${escapeHtml(profileExtra.activity?.appVersion || "უცნობია")}</strong></div>
          <div class="user-stat"><span>AI თვე</span><strong>${aiLabel}</strong></div>
        </div>
      </header>

      <div class="user-workspace">
        ${renderUserInvestigationTabs(user, profileExtra, pkgOptions, isPaid, opts.profileTab || 'overview')}
      </div>

      <footer class="user-actions">
        <button class="btn danger" id="user-del" type="button">${icon('trash')} წაშლა</button>
        <div class="user-actions-right">
          <button class="btn ghost" id="user-reset-usage" type="button">${icon('refresh')} ლიმიტის განულება</button>
          ${isPaid ? `<button class="btn ghost" id="user-renew" type="button">${icon('calendar')} +30 დღე</button>` : ''}
          <button class="btn primary" id="user-save" type="button">${icon('check')} შენახვა</button>
        </div>
      </footer>
    </div>
  `;

  bindUserInvestigation(id);
  $('user-page-back')?.addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = usersListHref();
  });
  $('user-copy-email')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(user.email);
    toast("ელ-ფოსტა დაკოპირდა");
  });
  $('edit-package').onchange = () => {
    const paid = $('edit-package').value !== 'FREE';
    $('edit-started').disabled = !paid;
    $('edit-expires').disabled = !paid;
    if (!paid) {
      $('edit-started').value = '';
      $('edit-expires').value = '';
    }
  };
  $('user-reset-usage').onclick = async () => {
    if (!confirm("განულდეს ამ მომხმარებლის AI ლიმიტი? ამ პერიოდის გამოყენება გახდება 0.")) return;
    try {
      await api(`/users/${id}/reset-usage`, { method: 'POST' });
      toast("AI ლიმიტი განულდა");
      await renderUserPage(id, { profileTab: currentUserProfileTab() });
    } catch (err) {
      toast(err.message, 'bad');
    }
  };
  const renewBtn = $('user-renew');
  if (renewBtn) {
    renewBtn.onclick = async () => {
      if (!confirm("განახლდეს გამოწერა? AI ლიმიტის 30-დღიანი პერიოდი დაიწყება თავიდან.")) return;
      await api(`/users/${id}/renew`, { method: 'POST' });
      toast("გამოწერა განახლდა — ახალი 30-დღიანი პერიოდი");
      await renderUserPage(id, { profileTab: currentUserProfileTab() });
    };
  }
  $('user-save').onclick = async () => {
    const expiresRaw = $('edit-expires').value.trim();
    const startedRaw = $('edit-started').value.trim();
    const packageCode = $('edit-package').value;
    try {
      await api(`/users/${id}`, {
        method: 'PATCH',
        body: {
          fullName: $('edit-name').value.trim(),
          email: $('edit-email').value.trim(),
          phone: $('edit-phone').value.trim() || null,
          status: $('edit-status').value,
          packageCode,
          packageStartedAt: startedRaw ? new Date(`${startedRaw}T00:00:00.000Z`).toISOString() : undefined,
          packageExpiresAt: expiresRaw ? new Date(`${expiresRaw}T23:59:59.000Z`).toISOString() : null,
          adminNote: $('edit-note').value.trim() || null,
        },
      });
      toast("პროფილი განახლდა");
      await renderUserPage(id, { profileTab: currentUserProfileTab() });
    } catch (err) {
      toast(err.message, 'bad');
    }
  };
  $('user-del').onclick = async () => {
    const deleted = await confirmDeleteUser(id, user.fullName, user.email);
    if (deleted) location.hash = usersListHref();
  };
}

window.editUser = editUser;

const FEATURE_LABELS = {
  doctorChat: 'ექიმის ჩატი',
  consilium: 'კონსილიუმი',
  labAnalysis: 'ლაბორატორია',
  imaging: 'რენტგენი / CT',
  skin: 'კანი',
  skincare: 'სკინქეარი',
  medicationReview: 'მედიკამენტები',
  prioritySupport: 'პრიორიტეტული მხარდაჭერა',
};

async function renderPackages() {
  const { packages } = await api('/packages');
  const totalUsers = packages.reduce((sum, p) => sum + (p.userCount || 0), 0);
  $('tab-packages').innerHTML = '<div class="v25-pkg dash-enter">'
    + '<div class="v25-strip" style="grid-template-columns:repeat(' + Math.max(1, packages.length) + ',minmax(0,1fr))">'
    + packages.map((p) => v25StripCell(
      pkgClass(p.code) === 'ultimate' ? 'zap' : pkgClass(p.code) === 'standard' ? 'layers' : 'users',
      p.code,
      p.userCount ?? 0,
      (p.priceGel != null ? p.priceGel.toFixed(2) + ' GEL' : '') + (p.unlimited ? ' · \u221e AI' : (p.monthlyAiLimit != null ? ' · AI ' + p.monthlyAiLimit : '')),
    )).join('')
    + '</div>'
    + '<section class="v25-panel">'
    + '<div class="card-head">' + iconTile('layers') + '<div><h3>' + "პაკეტები" + '</h3><p class="muted">' + "ყველა გადახდილი პაკეტი — 30-დღიანი პერიოდი · AI ლიმიტი იხარჯება ამ პერიოდის განმავლობაში · უფასო — კალენდარული თვე" + '</p></div></div>'
    + '<div class="pkg-grid">'
    + packages.map((p) => '<article class="pkg">'
      + iconTile(pkgClass(p.code) === 'ultimate' ? 'zap' : pkgClass(p.code) === 'standard' ? 'layers' : 'users', pkgClass(p.code) === 'standard' ? 'std' : pkgClass(p.code) === 'ultimate' ? 'ult' : '')
      + '<div class="pkg-copy"><span class="badge ' + pkgClass(p.code) + '">' + escapeHtml(p.code) + '</span><h3>' + escapeHtml(p.nameKa) + '</h3></div>'
      + '<strong class="price">' + p.priceGel.toFixed(2) + ' <span>GEL</span></strong>'
      + '<span class="mono">' + (p.userCount ?? 0) + (totalUsers ? ' / ' + totalUsers : '') + '</span>'
      + '<span class="mono">' + (p.unlimited ? '\u221e' : p.monthlyAiLimit) + ' AI</span>'
      + '<div class="actions"><button class="btn tiny ghost" data-pkg="' + p.code + '">' + icon('settings') + ' ' + "რედაქტირება" + '</button></div>'
      + '</article>').join('')
    + '</div></section>'
    + '<section class="v25-panel">'
    + '<div class="card-head">' + iconTile('layers') + '<div><h3>' + "შედარება" + '</h3></div></div>'
    + '<div class="table-wrap"><table class="admin-table v25-pkg-table">'
    + '<thead><tr><th>' + "ფუნქცია" + '</th>' + packages.map((p) => '<th>' + escapeHtml(p.code) + '</th>').join('') + '</tr></thead><tbody>'
    + '<tr><td>' + "ფასი" + '</td>' + packages.map((p) => '<td class="mono">' + p.priceGel.toFixed(2) + ' ' + "₾" + '</td>').join('') + '</tr>'
    + '<tr><td>' + "თვიური AI" + '</td>' + packages.map((p) => '<td class="mono">' + (p.unlimited ? '\u221e' : p.monthlyAiLimit) + '</td>').join('') + '</tr>'
    + '<tr><td>' + "გამოწერა" + '</td>' + packages.map(() => '<td class="mono">' + "30 დღე" + '</td>').join('') + '</tr>'
    + Object.entries(FEATURE_LABELS).map(([key, label]) => '<tr><td>' + label + '</td>' + packages.map((p) => '<td>' + (p.features?.[key] ? '\u2713' : '\u2014') + '</td>').join('') + '</tr>').join('')
    + '</tbody></table></div></section></div>';
  document.querySelectorAll('[data-pkg]').forEach((btn) => {
    btn.addEventListener('click', () => editPackage(packages.find((p) => p.code === btn.dataset.pkg)));
  });
}

function editPackage(pkg) {
  openDrawer(`
    <p class="kicker">${pkg.code}</p>
    <h3>${escapeHtml(pkg.nameKa)}</h3>
    <div class="field"><span>სახელი (KA)</span><input id="pkg-name-ka" value="${escapeAttr(pkg.nameKa)}" /></div>
    <div class="field"><span>სახელი (EN)</span><input id="pkg-name-en" value="${escapeAttr(pkg.nameEn)}" /></div>
    <div class="field"><span>აღწერა</span><textarea id="pkg-desc" rows="3">${escapeHtml(pkg.descriptionKa)}</textarea></div>
    <div class="field"><span>თვიური AI ლიმიტი (-1 = შეუზღუდავი)</span><input id="pkg-limit" type="number" value="${pkg.monthlyAiLimit}" /></div>
    <div class="field"><span>ფასი (₾)</span><input id="pkg-price" type="number" step="0.01" value="${pkg.priceGel}" /></div>
    <label class="toggle" style="border:0;padding:8px 0">
      <div><strong>აქტიური პაკეტი</strong><p>გამორთვისას ახალ მომხმარებელს აღარ მიენიჭება</p></div>
      <span class="switch"><input id="pkg-active" type="checkbox" ${pkg.active ? 'checked' : ''}/><i></i></span>
    </label>
    <div class="row">
      <button class="btn ghost" id="drawer-cancel">დახურვა</button>
      <button class="btn primary" id="drawer-save">შენახვა</button>
    </div>
  `);
  $('drawer-cancel').onclick = closeDrawer;
  $('drawer-save').onclick = async () => {
    await api(`/packages/${pkg.code}`, {
      method: 'PATCH',
      body: {
        nameKa: $('pkg-name-ka').value.trim(),
        nameEn: $('pkg-name-en').value.trim(),
        descriptionKa: $('pkg-desc').value.trim(),
        monthlyAiLimit: Number($('pkg-limit').value),
        priceGel: Number($('pkg-price').value),
        active: $('pkg-active').checked,
      },
    });
    toast('პაკეტი განახლდა');
    closeDrawer();
    await renderPackages();
  };
}

let pushShowKeys = false;
let pushStudioTab = 'compose';
window.setPushStudioTab = (tab) => { pushStudioTab = tab; };
let pushCopyGroup = 'all';
let pushHistoryView = 'campaigns';

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
  const now = new Date();
  return {
    time: now.toLocaleTimeString('ka-GE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tbilisi',
    }),
    date: now.toLocaleDateString('ka-GE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Tbilisi',
    }),
  };
}

function pushPhoneHtml({ title, body, segmentLabel, reachHint }) {
  const { time, date } = pushNowParts();
  return `
    <div class="push-phone" aria-hidden="true">
      <div class="push-phone-bezel">
        <div class="push-phone-screen">
          <div class="push-phone-glow"></div>
          <div class="push-phone-island"></div>
          <div class="push-phone-lock">
            <p class="push-phone-time" id="push-phone-time">${escapeHtml(time)}</p>
            <p class="push-phone-date" id="push-phone-date">${escapeHtml(date)}</p>
          </div>
          <div class="push-phone-toast">
            <div class="push-preview-row">
              <div class="push-preview-icon">${icon('bell')}</div>
              <div class="push-preview-meta">
                <span class="push-preview-app">Medicard.GE</span>
                <span class="push-preview-time">ახლა</span>
              </div>
            </div>
            <strong id="push-preview-title">${escapeHtml(title)}</strong>
            <p id="push-preview-body">${escapeHtml(body)}</p>
          </div>
          <p class="push-phone-reach" id="push-preview-seg">${escapeHtml(segmentLabel)}${reachHint ? ` · ${escapeHtml(reachHint)}` : ''}</p>
        </div>
      </div>
    </div>
  `;
}

async function renderPush() {
  const [stats, { campaigns }, templatesRes, eventsRes] = await Promise.all([
    api('/push/stats'),
    api('/push/campaigns'),
    api('/push/templates').catch(() => ({ templates: [] })),
    api('/push/events').catch(() => ({ events: [] })),
  ]);
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

  const SEGMENTS = {
    ALL: 'ყველა მოწყობილობა',
    ACTIVE: 'აქტიური მომხმარებლები',
    FREE: 'უფასო პაკეტი',
    STANDARD: 'STANDARD',
    ULTIMATE: 'ULTIMATE',
  };

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

  function campaignStatus(c) {
    if (c.status === 'SENT') return '<span class="badge ok">გაგზავნილი</span>';
    if (c.status === 'FAILED') return '<span class="badge bad">შეცდომა</span>';
    if (c.status === 'SENDING') return '<span class="badge std">იგზავნება</span>';
    return `<span class="badge neutral">${escapeHtml(c.status)}</span>`;
  }

  function deliveryBar(sent, target, failed = 0) {
    const pct = target ? Math.round((sent / target) * 100) : 0;
    return `
      <div class="push-delivery">
        <div class="bar"><span style="width:${pct}%"></span></div>
        <span class="mono push-delivery-val">${sent} ✓ · ${failed} ✗ / ${target}</span>
      </div>
    `;
  }

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
                <p class="muted">მყისიერი Expo Push არჩეულ სეგმენტში. ლოკალური შეხსენებები აქ არ იგზავნება — მათი ტექსტი „Medi ტექსტებშია“.</p>
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
                      <span>${value === 'ALL' ? `${fmtN(activeDevices)} მოწყობილობა` : value === 'ACTIVE' ? `${fmtN(subscribedUsers)} ანგარიში` : 'პაკეტის მიხედვით'}</span>
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
              <p class="push-compose-note">ვადაგასული STANDARD / ULTIMATE თავისუფალ პაკეტში ითვლება. Expo Go (SDK 53+) Android-ზე remote push-ს აღარ იძლევა.</p>
            </form>
            <aside class="push-phone-col">
              <p class="push-preview-label">დაბლოკვის ეკრანი</p>
              ${pushPhoneHtml({ title: defaultTitle, body: defaultBody, segmentLabel: SEGMENTS.ALL, reachHint: `${fmtN(activeDevices)} მოწყობილობა` })}
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
                    <div class="push-recent-meta">${SEGMENTS[c.segment] || c.segment} · ${fmtDateShort(c.sentAt || c.createdAt)}</div>
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
                    <div class="push-recent-meta">${SEGMENTS[c.segment] || c.segment} · ${fmtDateShort(c.sentAt || c.createdAt)} · ${escapeHtml(c.createdBy?.fullName || '—')}</div>
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
    const reach = segment === 'ALL'
      ? `${fmtN(activeDevices)} მოწყობილობა`
      : segment === 'ACTIVE'
        ? `${fmtN(subscribedUsers)} ანგარიში`
        : 'პაკეტის სეგმენტი';
    $('push-preview-seg').textContent = `${SEGMENTS[segment] || segment} · ${reach}`;
    const clock = $('push-phone-time');
    const dateEl = $('push-phone-date');
    if (clock && dateEl) {
      const parts = pushNowParts();
      clock.textContent = parts.time;
      dateEl.textContent = parts.date;
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
    if (copy) copy.textContent = `„${title}“ წავა სეგმენტზე: ${SEGMENTS[segment] || segment}.`;
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
      toast(`გაგზავნილია ${result.delivery?.sent ?? result.campaign?.sentCount ?? 0} მოწყობილობაზე`);
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

  const SEGMENTS = {
    ALL: 'ყველა მოწყობილობა',
    ACTIVE: 'აქტიური მომხმარებლები',
    FREE: 'უფასო პაკეტი',
    STANDARD: 'STANDARD',
    ULTIMATE: 'ULTIMATE',
  };

  openDrawer(`
    <p class="kicker">Push კამპანია</p>
    <h3>${escapeHtml(campaign.title)}</h3>
    <p class="muted" style="font-size:13px;margin:6px 0 0">${escapeHtml((campaign.body || '').slice(0, 180))}${(campaign.body || '').length > 180 ? '…' : ''}</p>
    <p class="muted mono" style="font-size:11px">${escapeHtml(campaign.id)}</p>
    <div class="drawer-stats">
      <div class="drawer-stat"><div class="label">სეგმენტი</div><strong>${SEGMENTS[campaign.segment] || campaign.segment}</strong></div>
      <div class="drawer-stat"><div class="label">სტატუსი</div><strong>${campaign.status === 'SENT' ? 'გაგზავნილი' : campaign.status === 'FAILED' ? 'შეცდომა' : campaign.status === 'SENDING' ? 'იგზავნება' : escapeHtml(campaign.status)}</strong></div>
      <div class="drawer-stat"><div class="label">მიწოდება</div><strong>${campaign.sentCount}/${campaign.targetCount}</strong></div>
      <div class="drawer-stat"><div class="label">შეცდომა</div><strong>${campaign.failedCount}</strong></div>
    </div>
    ${pushDeliveryRing(campaign.sentCount || 0, campaign.targetCount || 0, fmtDate(campaign.sentAt || campaign.createdAt), { compact: true })}
    <div class="field"><span>ტექსტი</span><div class="ai-drawer-block"><pre>${escapeHtml(campaign.body)}</pre></div></div>
    <div class="field"><span>ადმინი</span><div class="ai-drawer-block"><pre>${escapeHtml(campaign.createdBy?.fullName || '—')}${campaign.createdBy?.email ? `\n${campaign.createdBy.email}` : ''}</pre></div></div>
    ${Array.isArray(campaign.data?.deliveries) && campaign.data.deliveries.length ? `
      <div class="field"><span>მიწოდება მოწყობილობებზე</span>
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
  DOCTOR: 'AI ექიმი',
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
  if (!byMode.length) return '<p class="muted">ჯერ მონაცემი არ არის.</p>';
  const max = Math.max(1, ...byMode.map((m) => m.count));
  return byMode
    .map(
      (m) => `
    <div class="ai-mode-row">
      <span class="ai-mode-label">${AI_MODE_LABELS[m.mode] || m.mode}</span>
      <div class="bar"><span style="width:${Math.round((m.count / max) * 100)}%"></span></div>
      <span class="mono ai-mode-count">${m.count}</span>
    </div>
  `,
    )
    .join('');
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
  const [stats, { interactions, total }, { runs }] = await Promise.all([
    api('/ai/stats'),
    api('/ai/interactions?limit=25'),
    api('/ai/eval-runs'),
  ]);

  function scoreBadge(score) {
    if (score == null) return '<span class="badge neutral">—</span>';
    if (score >= 80) return `<span class="badge ok">${score}</span>`;
    if (score >= 72) return `<span class="badge std">${score}</span>`;
    return `<span class="badge bad">${score}</span>`;
  }

  function feedbackCell(row) {
    const fb = row.feedback?.[0];
    if (!fb) return '<span class="muted">—</span>';
    return fb.rating > 0
      ? `<span class="badge ok">${icon('check')} კარგი</span>`
      : `<span class="badge bad">${icon('x')} ცუდი</span>`;
  }

  const lastEval = stats.lastEval;
  const errorTone = stats.errorRate24h > 5 ? 'bad' : stats.errorRate24h > 0 ? 'warn' : 'ok';
  const fbTotal = stats.feedback.up + stats.feedback.down;
  const fbPct = fbTotal ? Math.round((stats.feedback.up / fbTotal) * 100) : null;

  $('tab-ai').innerHTML = `
    <div class="ai-page v25-ai">
      <section class="card ops-card" id="medi-usage-host"></section>
            <div class="ai-kpi-grid">
        <article class="ai-kpi tone-teal">
          <div class="label">24 საათი</div>
          <div class="value">${stats.last24h}</div>
          <div class="hint">${stats.errors24h} შეცდომა</div>
        </article>
        <article class="ai-kpi">
          <div class="label">7 დღე</div>
          <div class="value">${stats.last7d}</div>
          <div class="hint">საშ. ${stats.avgLatencyMs} ms</div>
        </article>
        <article class="ai-kpi">
          <div class="label">უკუკავშირი</div>
          <div class="value">${stats.feedback.up}<span style="font-size:16px;color:var(--muted)"> ↑</span> ${stats.feedback.down}<span style="font-size:16px;color:var(--muted)"> ↓</span></div>
          <div class="hint">${fbTotal} შეფასება</div>
        </article>
        <article class="ai-kpi">
          <div class="label">ბოლო სკანი</div>
          <div class="value">${lastEval?.avgScore ?? '\u2014'}</div>
          <div class="hint">${lastEval ? fmtDateShort(lastEval.finishedAt) : '\u2014'}</div>
        </article>
      </div>

      <div class="ai-split">
        <div class="card ai-scan-card">
          <div class="card-head">${iconTile('spark', 'ult')}<div><h3>ხარისხის სკანი</h3><p class="muted" style="margin:2px 0 0;font-size:12px">LLM-as-judge — ქართული, disclaimer, უსაფრთხოება, კლინიკური სიზუსტე</p></div></div>
          <div class="ai-scan-body">
            <div class="ai-scan-form">
              <div class="field">
                <span>სინჯის ზომა (5–40)</span>
                <input id="ai-scan-size" type="number" min="5" max="40" value="20" />
              </div>
              <button class="btn primary" id="ai-scan-run">${icon('spark')} სკანის გაშვება</button>
              ${lastEval?.summary ? `<div class="ai-scan-summary">${escapeHtml(lastEval.summary)}</div>` : '<p class="muted" style="margin:0;font-size:13px">პირველი სკანი შეაფასებს ბოლო პასუხებს რუბრიკით 0–100.</p>'}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">${iconTile('layers')}<div><h3>მოდულები</h3><p class="muted" style="margin:2px 0 0;font-size:12px">7 დღის AI გამოძახებები</p></div></div>
          ${aiModeBars(stats.byMode)}
        </div>
      </div>

      <div class="table-card ai-log-card">
        <div class="card-head">
          ${iconTile('activity')}
          <div>
            <h3>ბოლო ურთიერთობები</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px">${total} ჩანაწერი სისტემაში</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead><tr><th>დრო</th><th>მომხმარებელი</th><th>მოდული</th><th>სტატუსი</th><th>დრო (ms)</th><th>უკუკავშირი</th><th class="col-actions">მოქმედება</th></tr></thead>
            <tbody>
              ${interactions.length ? interactions.map((row) => `
                <tr>
                  <td class="mono">${fmtDateShort(row.createdAt)}</td>
                  <td>
                    <div class="ai-person">
                      <div class="avatar">${escapeHtml(aiInitials(row.user?.fullName))}</div>
                      <div class="stack">
                        <strong>${escapeHtml(row.user?.fullName || '—')}</strong>
                        <span class="sub muted">${escapeHtml(row.user?.email || row.user?.phone || '')}</span>
                      </div>
                    </div>
                  </td>
                  <td><span class="badge neutral">${AI_MODE_LABELS[row.mode] || row.mode}</span></td>
                  <td>${row.status === 'OK' ? '<span class="badge ok">OK</span>' : '<span class="badge bad">შეცდომა</span>'}</td>
                  <td class="mono">${row.latencyMs != null ? `${row.latencyMs} ms` : '—'}</td>
                  <td>${feedbackCell(row)}</td>
                  ${tableActionCell(`<button class="btn tiny ghost" data-ai-view="${row.id}">${icon('file')} ნახვა</button>`)}
                </tr>
              `).join('') : '<tr><td colspan="7"><div class="empty"><strong>ჩანაწერები ცარიელია</strong>AI გამოძახების შემდეგ აქ გამოჩნდება.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head">${iconTile('calendar')}<div><h3>სკანის ისტორია</h3><p class="muted" style="margin:2px 0 0;font-size:12px">${runs.length} გაშვება</p></div></div>
        ${runs.length ? `
          <div class="ai-run-grid">
            ${runs.map((run) => `
              <article class="ai-run-card" data-run="${run.id}">
                <div class="ai-run-top">
                  <div>
                    <strong>${run.avgScore ?? '—'}</strong>
                    <span style="color:var(--muted);font-size:14px;font-weight:600"> / 100</span>
                  </div>
                  ${run.status === 'DONE' ? '<span class="badge ok">მზადა</span>' : run.status === 'FAILED' ? '<span class="badge bad">ჩავარდა</span>' : '<span class="badge std">მიმდ.</span>'}
                </div>
                <div class="ai-run-meta">${fmtDate(run.finishedAt || run.createdAt)} · ${run.lowScoreCount}/${run.sampleSize} დაბალი</div>
                <p class="ai-run-summary">${escapeHtml(run.summary || '—')}</p>
              </article>
            `).join('')}
          </div>
        ` : '<div class="empty"><strong>სკანი ჯერ არ გაშვებულა</strong>გაუშვით ხარისხის სკანი ზემოთ.</div>'}
      </div>
    </div>
  `;

  if (typeof renderMediUsage === 'function') renderMediUsage($('medi-usage-host'));

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
      $('ai-scan-run').disabled = false;
    }
  };

  document.querySelectorAll('[data-ai-view]').forEach((btn) => {
    btn.onclick = () => viewAiInteraction(btn.dataset.aiView);
  });

  document.querySelectorAll('[data-run]').forEach((tr) => {
    tr.onclick = () => viewEvalRun(tr.dataset.run);
  });
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
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ka-GE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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
        body: { destination: destination || '995500000000', content, userId, urgent },
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
