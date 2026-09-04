const API = '';
const TOKEN_KEY = 'medicard.admin.token';
const THEME_KEY = 'medicard.admin.theme';
const EMAIL_KEY = 'medicard.admin.email';
const TAB_KEY = 'medicard.admin.tab';
const USERS_PAGE_SIZE = 15;
const PAGE_SIZE = 25;

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
  drawer.classList.remove('is-modal');
  drawer.setAttribute('aria-hidden', 'true');
  $('drawer-body').innerHTML = '';
  document.body.classList.remove('modal-open');
}

function openDrawer(html, opts = {}) {
  const drawer = $('drawer');
  const panel = $('drawer-body');
  panel.innerHTML = html;
  drawer.classList.toggle('is-modal', Boolean(opts.modal));
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
  if (greetEl) {
    greetEl.textContent = tab === 'overview'
      ? `${timeGreetingKa()}, ${adminGreetingName()}!`
      : copy[tab][1];
  }
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
  return `<div class="users-quota">
    <div class="users-quota-head">
      <strong>${used}<span class="muted"> / ${limit}</span></strong>
      <span class="users-quota-pct ${tone}">${pct}%</span>
    </div>
    <div class="quota-track ${tone}"><span style="width:${pct}%"></span></div>
    <span class="users-quota-left muted">დარჩა ${remaining}</span>
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

function usersActivityCell(counts) {
  return `<div class="users-activity">
    <span title="ჩანაწერები">${icon('file')}<b>${counts.records}</b></span>
    <span title="AI ჩატები">${icon('message')}<b>${counts.chats}</b></span>
    <span title="მედიკამენტები">${icon('pill')}<b>${counts.medications}</b></span>
  </div>`;
}

function usersFilterMetric({ label, value, hint, iconName, tone, statusFilter, packageFilter, valueId }) {
  const status = statusFilter === undefined ? '' : ` data-status-filter="${statusFilter}"`;
  const pkg = packageFilter === undefined ? '' : ` data-package-filter="${packageFilter}"`;
  const pressable = statusFilter !== undefined || packageFilter !== undefined;
  const tag = pressable ? 'button type="button"' : 'article';
  const close = pressable ? 'button' : 'article';
  const valueAttr = valueId ? ` id="${valueId}"` : '';
  return `
    <${tag} class="ng-metric tone-${tone}${pressable ? ' users-metric-btn' : ''}"${status}${pkg}${pressable ? ' aria-pressed="false"' : ''}>
      <div class="ng-metric-icon">${icon(iconName)}</div>
      <div class="ng-metric-body">
        <span class="ng-metric-label">${label}</span>
        <strong class="ng-metric-value"${valueAttr}>${value}</strong>
        ${hint ? `<span class="ng-metric-hint" ${valueId ? `id="${valueId}-hint"` : ''}>${hint}</span>` : ''}
      </div>
      ${ngSparkBars(tone)}
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
      <td>
        <div class="users-person">
          <span class="sk av"></span>
          <div class="users-person-copy"><span class="sk ln w160"></span><span class="sk ln w90"></span></div>
        </div>
      </td>
      <td><span class="sk chip"></span></td>
      <td><span class="sk bar"></span></td>
      <td><span class="sk chip sm"></span></td>
      <td><span class="sk ln w100"></span></td>
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
    pill.innerHTML = `${icon('check')} სისტემა აქტიურია`;
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
      const q = $('user-q');
      if (q) q.focus();
    }
  });

  if (!state.token) {
    show('login');
    return;
  }

  show('app');
  try {
    const me = await apiRetry('/me');
    rememberAdmin(me.admin);
    const tab = ['overview', 'users', 'packages', 'push', 'sms', 'pharmacy', 'ai', 'settings'].includes(state.tab) ? state.tab : 'overview';
    await switchTab(tab);
  } catch (err) {
    if (err.status === 401 || err.status === 403) return;
    toast(err.message || 'სერვერთან კავშირი ვერ დამყარდა.', 'bad');
    const tab = ['overview', 'users', 'packages', 'push', 'sms', 'pharmacy', 'ai', 'settings'].includes(state.tab) ? state.tab : 'overview';
    try { await switchTab(tab); } catch { /* keep chrome visible */ }
  }
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
    await switchTab('overview');
  } catch (err) {
    $('login-error').textContent = err.message;
    $('login-error').classList.remove('hidden');
  }
}

async function switchTab(tab) {
  state.tab = tab;
  sessionStorage.setItem(TAB_KEY, tab);
  document.querySelectorAll('.nav').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.add('hidden'));
  $(`tab-${tab}`).classList.remove('hidden');

  const copy = {
    overview: ['ოპერაციები', 'მიმოხილვა', 'რეალურ დროში — რეგისტრაციები, AI, პაკეტები და პლატფორმის პულსი.'],
    users: ['რეესტრი', 'მომხმარებლები', 'რეალურ დროში — რეგისტრაციები, პაკეტები, სქესი და სრული რეესტრი.'],
    packages: ['კომერცია', 'პაკეტები', 'ყველა გეგმა თვიურია — AI ლიმიტი 30-დღიან პერიოდში.'],
    push: ['კომუნიკაცია', 'Push შეტყობინებები', 'გაუგზავნეთ push შეტყობინება მომხმარებლებს სეგმენტის მიხედვით.'],
    sms: ['კომუნიკაცია', 'SMS მენეჯმენტი', 'OTP, ბალანსი, გაგზავნა და გაგზავნილი მესიჯების ჟურნალი.'],
    pharmacy: ['კატალოგი', 'ფასების შედარება', 'აფთიაქების სინქრონიზაცია, პროდუქტები და სინქის ისტორია.'],
    ai: ['AI', 'ხარისხის ანალიზი', 'ყველა AI პასუხი იწერება, შეფასდება და გაუმჯობესდება კონტროლირებულად.'],
    settings: ['კონტროლი', 'აპის რეჟიმი', 'ოფლაინი, იძულებითი განახლება და რეგისტრაციის კარიბჭე.'],
  };
  setPageHeader(tab, copy);

  if (tab === 'overview') await renderOverview();
  if (tab === 'users') await renderUsers();
  if (tab === 'packages') await renderPackages();
  if (tab === 'push') await renderPush();
  if (tab === 'sms') await renderSms();
  if (tab === 'pharmacy') await renderPharmacy();
  if (tab === 'ai') await renderAi();
  if (tab === 'settings') await renderSettings();
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
  const root = $('tab-users');
  const hotkey = searchHotkeyLabel();
  root.innerHTML = `
    <div class="users-page ai-page dash-page ng-dash dash-enter">
      <section class="ng-pulse card" style="--i:0">
        <div class="ng-pulse-main">
          <div class="ng-pulse-icon">${icon('users')}</div>
          <div class="ng-pulse-copy">
            <span class="ng-metric-label">რეესტრის პულსი</span>
            <strong class="ng-pulse-value" id="users-pulse-value">—</strong>
            <span class="ng-metric-hint" id="users-pulse-hint">აქტიური ანგარიშები · დაბლოკილი · სულ</span>
          </div>
          <div id="users-pulse-spark">${ngSparkBars('teal')}</div>
        </div>
        <div class="ng-pulse-side">
          <div id="users-pulse-ring">${dashHealthRing(null, null, 'აქტიური ანგარიშები')}</div>
          <div class="ng-pulse-pills" id="users-pulse-pills">
            <span class="ai-pill teal">${icon('calendar')} <strong id="users-pill-week">—</strong> ამ კვირაში</span>
            <span class="ai-pill ok">${icon('layers')} <strong id="users-pill-premium">—</strong> პრემიუმი</span>
          </div>
        </div>
      </section>

      <div class="ng-metrics-row" id="users-metrics" style="--i:1">
        ${usersFilterMetric({ label: 'სულ', value: '—', hint: 'რეესტრში', iconName: 'users', tone: 'teal', statusFilter: '', valueId: 'users-stat-total' })}
        ${usersFilterMetric({ label: 'აქტიური', value: '—', hint: 'შეუძლია შესვლა', iconName: 'check', tone: 'cyan', statusFilter: 'ACTIVE', valueId: 'users-stat-active' })}
        ${usersFilterMetric({ label: 'დაბლოკილი', value: '—', hint: 'წვდომა შეზღუდულია', iconName: 'lock', tone: 'rose', statusFilter: 'BLOCKED', valueId: 'users-stat-blocked' })}
        ${usersFilterMetric({ label: 'პრემიუმი', value: '—', hint: 'STANDARD · ULTIMATE', iconName: 'layers', tone: 'amber', valueId: 'users-stat-premium' })}
      </div>

      <div class="users-charts" style="--i:2">
        <div class="card dash-pkg-card users-chart-card">
          <div class="card-head">
            ${iconTile('activity', 'teal')}
            <div>
              <h3>რეგისტრაციები</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">ბოლო 14 დღე · ახალი ანგარიშები</p>
            </div>
          </div>
          <div id="users-trend-chart"><p class="muted">იტვირთება…</p></div>
        </div>
        <div class="card dash-pkg-card users-chart-card">
          <div class="card-head">
            ${iconTile('layers', 'ult')}
            <div>
              <h3>პაკეტები</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">აქტიური მომხმარებლები ტარიფის მიხედვით</p>
            </div>
          </div>
          <div id="users-pkg-chart"><p class="muted">იტვირთება…</p></div>
        </div>
        <div class="card dash-pkg-card users-chart-card">
          <div class="card-head">
            ${iconTile('user', 'std')}
            <div>
              <h3>პროფილი</h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">სქესი და ტელეფონის დაფარვა</p>
            </div>
          </div>
          <div id="users-mix-chart"><p class="muted">იტვირთება…</p></div>
        </div>
      </div>

      <div class="table-card users-console" style="--i:3">
        <div class="users-console-bar">
          <label class="search-field users-search">
            ${icon('search')}
            <input id="user-q" placeholder="სახელი, ელ-ფოსტა ან ტელეფონი…" autocomplete="off" />
            <button type="button" id="user-q-clear" class="users-search-clear hidden" aria-label="ძებნის გასუფთავება">${icon('x')}</button>
            <kbd class="users-kbd">${hotkey}</kbd>
          </label>
          <div class="users-chips" role="group" aria-label="სტატუსი">
            <button type="button" class="users-chip active" data-status-chip="" aria-pressed="true">ყველა</button>
            <button type="button" class="users-chip" data-status-chip="ACTIVE" aria-pressed="false">აქტიური <b id="chip-active-n"></b></button>
            <button type="button" class="users-chip" data-status-chip="BLOCKED" aria-pressed="false">დაბლოკილი <b id="chip-blocked-n"></b></button>
          </div>
          <div class="users-chips users-pkg-chips" role="group" aria-label="პაკეტი">
            <button type="button" class="users-chip active" data-package-chip="" aria-pressed="true">ყველა ტარიფი</button>
            <button type="button" class="users-chip chip-free" data-package-chip="FREE" aria-pressed="false">FREE</button>
            <button type="button" class="users-chip chip-std" data-package-chip="STANDARD" aria-pressed="false">STANDARD</button>
            <button type="button" class="users-chip chip-ult" data-package-chip="ULTIMATE" aria-pressed="false">ULTIMATE</button>
          </div>
          <div class="users-toolbar-actions">
            <button class="btn ghost" id="user-reload" type="button">${icon('refresh')} განახლება</button>
            <button class="btn ghost" id="user-csv" type="button">${icon('download')} CSV</button>
          </div>
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

        <div class="users-table-meta">
          <span id="user-meta" class="users-meta-label">იტვირთება…</span>
          <button type="button" id="user-clear-filters" class="btn tiny ghost hidden">${icon('x')} ფილტრის გასუფთავება</button>
        </div>
        <div class="table-wrap users-table-wrap" id="users-table-wrap">
          <table class="users-table admin-table" aria-label="მომხმარებლების რეესტრი">
            <colgroup>
              <col class="col-user" />
              <col class="col-pkg" />
              <col class="col-quota" />
              <col class="col-status" />
              <col class="col-stats" />
            </colgroup>
            <thead>
              <tr>
                <th data-sort="fullName">მომხმარებელი</th>
                <th data-sort="package">პაკეტი</th>
                <th data-sort="used">AI ლიმიტი</th>
                <th data-sort="status">სტატუსი</th>
                <th>აქტივობა</th>
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
      </div>
    </div>
  `;

  const syncFilters = () => {
    const status = $('user-status').value;
    const pkg = $('user-package').value;
    const q = $('user-q').value.trim();
    document.querySelectorAll('[data-status-filter]').forEach((btn) => {
      const on = btn.dataset.statusFilter === status;
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
    $('user-clear-filters')?.classList.toggle('hidden', !(q || status || pkg));
  };

  const load = async () => {
    const q = $('user-q').value.trim();
    const status = $('user-status').value;
    const pkg = $('user-package').value;
    const wrap = $('users-table-wrap');
    const body = $('users-tbody');
    wrap?.classList.add('is-loading');
    if (!state.users.length && body) body.innerHTML = usersSkeletonHtml();
    syncFilters();
    const params = new URLSearchParams({ limit: String(USERS_PAGE_SIZE), offset: String(state.offset) });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (pkg) params.set('package', pkg);
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
        body.innerHTML = `<tr><td colspan="5"><div class="empty users-empty">${icon('alert', 'lg')}<strong>ჩატვირთვა ვერ მოხერხდა</strong><p>${escapeHtml(err.message)}</p></div></td></tr>`;
      }
    } finally {
      wrap?.classList.remove('is-loading');
    }
  };

  const paintUsers = () => {
    const rows = sortUsers(state.users);
    const from = state.total ? state.offset + 1 : 0;
    const to = state.total ? Math.min(state.offset + USERS_PAGE_SIZE, state.total) : 0;
    const filtered = Boolean($('user-q').value.trim() || $('user-status').value || $('user-package').value);
    $('user-meta').textContent = state.total
      ? `${from}–${to}  ·  ${state.total.toLocaleString('ka-GE')} ანგარიში`
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
      body.innerHTML = `<tr><td colspan="5"><div class="empty users-empty">${icon('users', 'lg')}<strong>მომხმარებელი ვერ მოიძებნა</strong><p>${filtered ? 'შეცვალე ძებნა ან გაასუფთავე ფილტრი' : 'პირველი ანგარიში აქ გამოჩნდება'}</p>${filtered ? `<button type="button" class="btn tiny ghost" id="users-empty-clear">${icon('x')} გასუფთავება</button>` : ''}</div></td></tr>`;
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
        <td>
          <div class="person users-person">
            <div class="users-avatar-wrap ${u.status === 'BLOCKED' ? 'is-blocked' : 'is-active'}">
              <div class="avatar avatar-${avatarTone(u)}">${escapeHtml(initials(u.fullName))}</div>
            </div>
            <div class="users-person-copy">
              <strong>${escapeHtml(u.fullName)}</strong>
              <span class="sub users-email-sub" title="${escapeAttr(u.email)}">${escapeHtml(u.email)}</span>
            </div>
          </div>
        </td>
        <td>
          <div class="stack users-pkg-stack">
            <div class="users-pkg-badge">${pkgBadge(u.package)}</div>
          </div>
        </td>
        <td>${quotaCell(u.usage)}</td>
        <td>${usersStatusCell(u.status)}</td>
        <td>
          <div class="users-row-end">
            ${usersActivityCell(u.counts)}
            <span class="users-open-hint" aria-hidden="true">${icon('arrow')}</span>
          </div>
        </td>
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
  $('user-reload').onclick = load;
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
    state.offset = 0;
    load();
  };
  $('prev-page').onclick = () => { state.offset = Math.max(0, state.offset - USERS_PAGE_SIZE); load(); };
  $('next-page').onclick = () => {
    if (state.offset + USERS_PAGE_SIZE < state.total) { state.offset += USERS_PAGE_SIZE; load(); }
  };
  $('user-csv').onclick = () => {
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

async function editUser(id) {
  state.selectedId = id;
  openDrawer(`
    <div class="umodal">
      <button type="button" class="btn icon-only ghost umodal-close" id="drawer-cancel" aria-label="დახურვა">${icon('x')}</button>
      <div class="umodal-loading">${icon('refresh')}<span>პროფილი იტვირთება…</span></div>
    </div>
  `, { modal: true });
  $('drawer-cancel').onclick = closeDrawer;

  let user;
  let packages;
  try {
    const data = await Promise.all([
      api(`/users/${id}`),
      api('/packages'),
    ]);
    user = data[0].user;
    packages = data[1].packages;
  } catch (err) {
    closeDrawer();
    toast(err.message, 'bad');
    return;
  }

  const pkgOptions = packages.map((p) => {
    const limitLabel = p.unlimited ? 'შეუზღუდავი' : `${p.monthlyAiLimit} / თვე`;
    return `<option value="${p.code}" ${user.package?.code === p.code ? 'selected' : ''}>${p.code} — ${limitLabel}</option>`;
  }).join('');
  const isPaid = user.package?.code && user.package.code !== 'FREE';
  const aiLabel = user.usage?.unlimited
    ? '∞ შეუზღუდავი'
    : `${user.usage?.used ?? 0} / ${user.usage?.limit ?? '—'} · დარჩა ${user.usage?.remaining ?? '—'}`;

  $('drawer-body').innerHTML = `
    <div class="umodal">
      <header class="umodal-hero">
        <div class="users-avatar-wrap ${user.status === 'BLOCKED' ? 'is-blocked' : 'is-active'} umodal-avatar-wrap">
          <div class="avatar avatar-${avatarTone(user)} umodal-avatar">${escapeHtml(initials(user.fullName))}</div>
        </div>
        <div class="umodal-hero-copy">
          <p class="kicker">პროფილი</p>
          <h3>${escapeHtml(user.fullName)}</h3>
          <p class="umodal-hero-mail">
            <button type="button" class="users-copy-link" id="umodal-copy-email" title="კოპირება">${icon('copy')}<span>${escapeHtml(user.email)}</span></button>
          </p>
          <div class="umodal-pills">
            ${pkgBadge(user.package)}
            ${usersStatusCell(user.status)}
          </div>
        </div>
        <button type="button" class="btn icon-only ghost umodal-close" id="drawer-cancel" aria-label="დახურვა">${icon('x')}</button>
      </header>

      <div class="umodal-stats">
        <div class="umodal-stat"><span>რეგისტრაცია</span><strong>${fmtDateShort(user.createdAt)}</strong></div>
        <div class="umodal-stat"><span>განახლდა</span><strong>${fmtDateShort(user.updatedAt)}</strong></div>
        <div class="umodal-stat"><span>AI თვე</span><strong>${aiLabel}</strong></div>
        <div class="umodal-stat"><span>აქტივობა</span><strong>${user.counts.records} · ${user.counts.chats} · ${user.counts.medications}</strong></div>
      </div>

      <div class="umodal-body">
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
        </div>
      </div>

      <footer class="umodal-foot">
        <button class="btn danger" id="drawer-del" type="button">${icon('trash')} წაშლა</button>
        <div class="umodal-foot-right">
          <button class="btn ghost" id="drawer-reset-usage" type="button">${icon('refresh')} ლიმიტის განულება</button>
          ${isPaid ? `<button class="btn ghost" id="drawer-renew" type="button">${icon('calendar')} +30 დღე</button>` : ''}
          <button class="btn ghost" id="drawer-cancel-2" type="button">დახურვა</button>
          <button class="btn primary" id="drawer-save" type="button">${icon('check')} შენახვა</button>
        </div>
      </footer>
    </div>
  `;

  const closeBtns = [$('drawer-cancel'), $('drawer-cancel-2')];
  closeBtns.forEach((btn) => { if (btn) btn.onclick = closeDrawer; });
  $('umodal-copy-email')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(user.email);
    toast('ელ-ფოსტა დაკოპირდა');
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
  $('drawer-reset-usage').onclick = async () => {
    if (!confirm('განულდეს ამ მომხმარებლის AI ლიმიტი? ამ პერიოდის გამოყენება გახდება 0.')) return;
    try {
      await api(`/users/${id}/reset-usage`, { method: 'POST' });
      toast('AI ლიმიტი განულდა');
      closeDrawer();
      await renderUsers();
    } catch (err) {
      toast(err.message, 'bad');
    }
  };
  const renewBtn = $('drawer-renew');
  if (renewBtn) {
    renewBtn.onclick = async () => {
      if (!confirm('განახლდეს გამოწერა? AI ლიმიტის 30-დღიანი პერიოდი დაიწყება თავიდან.')) return;
      await api(`/users/${id}/renew`, { method: 'POST' });
      toast('გამოწერა განახლდა — ახალი 30-დღიანი პერიოდი');
      closeDrawer();
      await renderUsers();
    };
  }
  $('drawer-save').onclick = async () => {
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
      toast('პროფილი განახლდა');
      closeDrawer();
      await renderUsers();
    } catch (err) {
      toast(err.message, 'bad');
    }
  };
  $('drawer-del').onclick = async () => {
    const deleted = await confirmDeleteUser(id, user.fullName, user.email);
    if (deleted) {
      closeDrawer();
      await renderUsers();
    }
  };
  $('edit-name')?.focus();
}

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
  $('tab-packages').innerHTML = `
    <div class="ai-page ng-dash dash-enter">
    <div class="card" style="margin-bottom:12px">
      <div class="card-head">${iconTile('calendar', 'std')}<div><h3>თვიური გამოწერა</h3><p class="muted" style="margin:2px 0 0;font-size:12px">ყველა გადახდილი პაკეტი — 30-დღიანი პერიოდი · AI ლიმიტი იხარჯება ამ პერიოდის განმავლობაში · უფასო — კალენდარული თვე</p></div></div>
    </div>
    <div class="pkg-grid">
      ${packages.map((p) => `
        <article class="pkg">
          <div class="card-head">
            ${iconTile('zap', pkgClass(p.code) === 'standard' ? 'std' : pkgClass(p.code) === 'ultimate' ? 'ult' : '')}
            <span class="badge ${pkgClass(p.code)}">${p.code}</span>
          </div>
          <h3>${escapeHtml(p.nameKa)}</h3>
          <p class="muted">${escapeHtml(p.descriptionKa)}</p>
          <div class="price">${p.priceGel.toFixed(2)} <span>GEL / თვე</span></div>
          <p class="mono">AI თვეში: ${p.unlimited ? 'შეუზღუდავი' : p.monthlyAiLimit} · ${p.userCount} მომხმარებელი</p>
          <div class="feat">
            ${Object.entries(FEATURE_LABELS).map(([key, label]) => {
              const on = Boolean(p.features?.[key]);
              return `<div class="${on ? '' : 'off'}">${icon(on ? 'check' : 'x')} ${label}</div>`;
            }).join('')}
          </div>
          <div class="actions">
            <button class="btn tiny ghost" data-pkg="${p.code}">${icon('settings')} რედაქტირება</button>
          </div>
        </article>
      `).join('')}
    </div>
    <div class="card" style="margin-top:12px;overflow:auto">
      <div class="card-head">${iconTile('layers')}<h3>შედარება</h3></div>
      <table>
        <thead><tr><th>ფუნქცია</th>${packages.map((p) => `<th>${p.code}</th>`).join('')}</tr></thead>
        <tbody>
          <tr><td>ფასი</td>${packages.map((p) => `<td class="mono">${p.priceGel.toFixed(2)} ₾</td>`).join('')}</tr>
          <tr><td>თვიური AI</td>${packages.map((p) => `<td class="mono">${p.unlimited ? '∞' : p.monthlyAiLimit}</td>`).join('')}</tr>
          <tr><td>გამოწერა</td>${packages.map(() => `<td class="mono">30 დღე</td>`).join('')}</tr>
          ${Object.entries(FEATURE_LABELS).map(([key, label]) => `
            <tr><td>${label}</td>${packages.map((p) => `<td>${p.features?.[key] ? '✓' : '—'}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    </div>
  `;
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

async function renderPush() {
  const [stats, { campaigns }] = await Promise.all([
    api('/push/stats'),
    api('/push/campaigns'),
  ]);
  const {
    activeDevices,
    subscribedUsers,
    recentCampaigns,
    devices = [],
    totalSent: statsSent,
    totalFailed: statsFailed,
    sentLast24h = 0,
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
  const totalTarget = campaigns.reduce((sum, c) => sum + (c.targetCount || 0), 0);
  const lastCampaign = campaigns[0];
  const reachPct = subscribedUsers
    ? Math.min(100, Math.round((activeDevices / Math.max(subscribedUsers, 1)) * 100))
    : null;
  const platformLabel = (platform) => {
    if (platform === 'ios') return 'iOS';
    if (platform === 'android') return 'Android';
    if (platform === 'web') return 'Web';
    return platform || '—';
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

  $('tab-push').innerHTML = `
    <div class="ai-page push-page">
      <div class="ai-kpi-grid">
        <article class="ai-kpi">
          <div class="label">Push მოწყობილობები</div>
          <div class="value">${activeDevices}</div>
          <div class="hint">აქტიური Expo token-ები</div>
        </article>
        <article class="ai-kpi">
          <div class="label">მომხმარებლები</div>
          <div class="value">${subscribedUsers}</div>
          <div class="hint">${reachPct != null ? `~${reachPct}% რამდენიმე მოწყობილობა` : 'უნიკალური ანგარიში'}</div>
        </article>
        <article class="ai-kpi">
          <div class="label">გაგზავნილი</div>
          <div class="value">${totalSent}</div>
          <div class="hint">${sentLast24h} ბოლო 24სთ · ${totalFailed} ვერ მივიდა</div>
        </article>
        <article class="ai-kpi">
          <div class="label">ბოლო კამპანია</div>
          <div class="value">${lastCampaign?.sentCount ?? '—'}</div>
          <div class="hint">${lastCampaign ? fmtDateShort(lastCampaign.sentAt || lastCampaign.createdAt) : '—'}</div>
        </article>
      </div>

      <div class="ai-split">
        <div class="card push-compose-card">
          <div class="card-head">${iconTile('send', 'ult')}<div><h3>ახალი შეტყობინება</h3><p class="muted" style="margin:2px 0 0;font-size:12px">Broadcast — მყისიერი გაგზავნა არჩეულ სეგმენტში</p></div></div>
          <div class="push-compose-body">
            <div class="push-compose-form">
              <div class="field"><span>სათაური</span><input id="push-title" maxlength="120" placeholder="Medicard.GE" value="Medicard.GE" /></div>
              <div class="field"><span>ტექსტი</span><textarea id="push-body" rows="4" maxlength="500" placeholder="შეტყობინების ტექსტი..."></textarea></div>
              <div class="field"><span>სეგმენტი</span>
                <select id="push-segment">
                  ${Object.entries(SEGMENTS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
                </select>
              </div>
              <button class="btn primary" id="push-send">${icon('send')} გაგზავნა</button>
              <p class="push-compose-note">ადგილობრივი შეხსენებები (მედიკამენტი, ციკლი, ნაბიჯები) აქ არ ითვლება — მხოლოდ ამ გვერდიდან გაგზავნილი broadcast. ვადაგასული STANDARD/ULTIMATE → FREE.</p>
            </div>
            <div class="push-preview">
              <div class="push-preview-label">გადახედვა</div>
              <div class="push-preview-device">
                <div class="push-preview-toast">
                  <div class="push-preview-row">
                    <div class="push-preview-icon">${icon('bell')}</div>
                    <div class="push-preview-meta">
                      <span class="push-preview-app">Medicard.GE</span>
                      <span class="push-preview-time">ახლა</span>
                    </div>
                  </div>
                  <strong id="push-preview-title">Medicard.GE</strong>
                  <p id="push-preview-body">შეტყობინების ტექსტი...</p>
                </div>
              </div>
              <p class="push-preview-seg muted" id="push-preview-seg">${SEGMENTS.ALL}</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">${iconTile('activity')}<div><h3>ბოლო კამპანიები</h3><p class="muted" style="margin:2px 0 0;font-size:12px">${recentCampaigns.length} ბოლო გაშვება</p></div></div>
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
          ` : '<div class="empty"><strong>ჯერ არ გაგზავნილა</strong>პირველი push broadcast ზემოთ შექმენით.</div>'}
          ${devices.length ? `
            <div class="push-device-list">
              <p class="push-device-heading">დარეგისტრირებული მოწყობილობები</p>
              ${devices.map((d) => `
                <div class="push-device-row">
                  <span class="badge neutral">${escapeHtml(platformLabel(d.platform))}</span>
                  <div class="stack">
                    <strong>${escapeHtml(d.user?.fullName || '—')}</strong>
                    <span class="sub muted">${escapeHtml(d.user?.email || '')} · ${fmtDateShort(d.lastSeenAt)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <div class="table-card ai-log-card push-log-card">
        <div class="card-head">
          ${iconTile('bell')}
          <div>
            <h3>კამპანიების ისტორია</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px">${campaigns.length} ჩანაწერი · ${totalSent} მიწოდებული</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>დრო</th>
                <th>შეტყობინება</th>
                <th>სეგმენტი</th>
                <th>სტატუსი</th>
                <th>მიწოდება</th>
                <th>ადმინი</th>
                <th class="col-actions">მოქმედება</th>
              </tr>
            </thead>
            <tbody>
              ${campaigns.length ? campaigns.map((c) => `
                <tr data-campaign="${c.id}">
                  <td class="mono">${fmtDateShort(c.sentAt || c.createdAt)}</td>
                  <td>
                    <div class="stack">
                      <strong>${escapeHtml(c.title)}</strong>
                      <span class="sub muted">${escapeHtml(c.body.slice(0, 90))}${c.body.length > 90 ? '…' : ''}</span>
                    </div>
                  </td>
                  <td><span class="badge neutral">${SEGMENTS[c.segment] || c.segment}</span></td>
                  <td>${campaignStatus(c)}</td>
                  <td>${deliveryBar(c.sentCount || 0, c.targetCount || 0, c.failedCount || 0)}</td>
                  <td>
                    <div class="ai-person">
                      <div class="avatar">${escapeHtml(aiInitials(c.createdBy?.fullName))}</div>
                      <div class="stack">
                        <strong>${escapeHtml(c.createdBy?.fullName || '—')}</strong>
                        <span class="sub muted">${escapeHtml(c.createdBy?.email || '')}</span>
                      </div>
                    </div>
                  </td>
                  ${tableActionCell(`<button class="btn tiny ghost" data-push-view="${c.id}">${icon('file')} ნახვა</button>`)}
                </tr>
              `).join('') : '<tr><td colspan="7"><div class="empty"><strong>კამპანიები ჯერ არ არის</strong>პირველი push broadcast ზემოთ შექმენით.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const syncPreview = () => {
    const title = $('push-title').value.trim() || 'Medicard.GE';
    const body = $('push-body').value.trim() || 'შეტყობინების ტექსტი...';
    const segment = $('push-segment').value;
    $('push-preview-title').textContent = title;
    $('push-preview-body').textContent = body;
    $('push-preview-seg').textContent = SEGMENTS[segment] || segment;
  };

  $('push-title').oninput = syncPreview;
  $('push-body').oninput = syncPreview;
  $('push-segment').onchange = syncPreview;
  syncPreview();

  $('push-send').onclick = async () => {
    const title = $('push-title').value.trim();
    const body = $('push-body').value.trim();
    const segment = $('push-segment').value;
    if (!title || !body) {
      toast('სათაური და ტექსტი სავალდებულოა', 'bad');
      return;
    }
    if (!confirm(`გავუგზავნოთ „${title}" სეგმენტს: ${SEGMENTS[segment]}?`)) return;
    $('push-send').disabled = true;
    try {
      const result = await api('/push/campaigns', {
        method: 'POST',
        body: { title, body, segment },
      });
      toast(`გაგზავნილია ${result.delivery?.sent ?? result.campaign?.sentCount ?? 0} მოწყობილობაზე`);
      await renderPush();
    } catch (err) {
      toast(err.message || 'გაგზავნა ვერ მოხერხდა', 'bad');
      $('push-send').disabled = false;
    }
  };

  document.querySelectorAll('[data-push-view], [data-campaign]').forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation?.();
      viewPushCampaign(el.dataset.pushView || el.dataset.campaign);
    };
  });

  document.querySelectorAll('tr[data-campaign]').forEach((row) => {
    row.onclick = (e) => {
      if (e.target.closest('button')) return;
      viewPushCampaign(row.dataset.campaign);
    };
  });
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
    <div class="ai-page">
      <div class="ai-kpi-grid">
        <article class="ai-kpi">
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
          <div class="value">${lastEval?.avgScore ?? '—'}</div>
          <div class="hint">${lastEval ? fmtDateShort(lastEval.finishedAt) : '—'}</div>
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
    <div class="settings-grid">
      <div class="card">
        <div class="card-head">${iconTile('settings')}<h3>რეჟიმები</h3></div>
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
        <div class="field" style="margin-top:12px">
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
        <div class="row" style="justify-content:flex-start;margin-top:8px">
          <button class="btn primary" id="set-save">${icon('check')} შენახვა</button>
        </div>
      </div>
      <div class="card">
        <div class="card-head">${iconTile(settings.maintenanceMode ? 'alert' : 'shield', settings.maintenanceMode ? 'warn' : 'ok')}<h3>სტატუსი</h3></div>
        <div class="detail-list">
          <div class="detail"><span>${icon('globe')} ოფლაინი</span><strong>${onOffLabel(settings.maintenanceMode)}</strong></div>
          <div class="detail"><span>${icon('zap')} იძ. განახლება</span><strong>${onOffLabel(settings.forceUpdate)}</strong></div>
          <div class="detail"><span>${icon('users')} რეგისტრაცია</span><strong>${settings.allowRegistrations ? 'ღიაა' : 'დახურულია'}</strong></div>
          <div class="detail"><span>${icon('shield')} QA OTP</span><strong>${onOffLabel(settings.qaOtpEnabled)}</strong></div>
          <div class="detail"><span>${icon('activity')} აპის ვერსია</span><strong class="mono">${escapeHtml(settings.mobileAppVersion || '—')}</strong></div>
          <div class="detail"><span>${icon('zap')} მინ. ვერსია</span><strong class="mono">${escapeHtml(settings.minAppVersion)}</strong></div>
          <div class="detail"><span>${icon('mail')} მხარდაჭერა</span><strong>${escapeHtml(settings.supportEmail || '—')}</strong></div>
          <div class="detail"><span>${icon('calendar')} განახლდა</span><strong class="mono">${fmtDate(settings.updatedAt)}</strong></div>
        </div>
      </div>
    </div>
  `;
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
    toast('რეჟიმი შენახულია');
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
    <div class="pharm-page">
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

      <div class="ai-kpi-grid">
        <article class="ai-kpi tone-teal">
          <div class="label">კატალოგი</div>
          <div class="value">${catalog.products.toLocaleString('ka-GE')}</div>
          <div class="hint">კანონიკური პროდუქტი</div>
        </article>
        <article class="ai-kpi">
          <div class="label">შეთავაზებები</div>
          <div class="value">${catalog.offers.toLocaleString('ka-GE')}</div>
          <div class="hint">${insights.inStockOffers.toLocaleString('ka-GE')} მარაგში</div>
        </article>
        <article class="ai-kpi">
          <div class="label">2-წყარო+</div>
          <div class="value">${catalog.comparedProducts.toLocaleString('ka-GE')}</div>
          <div class="hint">${comparedPct}% დაფარვა</div>
        </article>
        <article class="ai-kpi">
          <div class="label">3-წყარო</div>
          <div class="value">${insights.tripleCompare.toLocaleString('ka-GE')}</div>
          <div class="hint">${triplePct}% სრული შედარება</div>
        </article>
      </div>

      <div class="pharm-sources-wrap">
        <div class="pharm-section-head">
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
        <div class="card pharm-sync-card">
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

        <div class="card pharm-deals-card">
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

      <div class="table-card pharm-log-card">
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
                  : '<tr><td colspan="6" class="muted">სინქი ჯერ არ გაუშვებულა — დაიწყეთ ზემოთ.</td></tr>'
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
    ? 'API გასაღები არ არის'
    : balNum != null
      ? `${balNum.toLocaleString('ka-GE')} SMS`
      : balance.raw || '—';
  const balTone = !balance.configured ? 'bad' : balNum != null && balNum < 50 ? 'warn' : 'ok';
  const successRate = stats.total ? Math.round((stats.sent / stats.total) * 100) : 100;

  $('tab-sms').innerHTML = `
    <div class="ai-page dash-page ng-dash dash-enter">
      <section class="ng-pulse card sms-hero">
        <div class="ng-pulse-main">
          <div class="ng-pulse-icon">${icon('send')}</div>
          <div class="ng-pulse-copy">
            <span class="ng-metric-label">SMSOffice.ge · MEDICARD</span>
            <strong class="ng-pulse-value">${escapeHtml(balLabel)}</strong>
            <span class="ng-metric-hint">OTP, ადმინისტრაციული გაგზავნა და სრული აუდიტი</span>
          </div>
          ${ngSparkBars('teal')}
        </div>
        <div class="ng-pulse-side">
          <div class="ng-pulse-pills">
            <span class="ai-pill ${balTone === 'ok' ? 'ok' : balTone === 'warn' ? 'warn' : 'bad'}">${icon('wallet')} <strong>ბალანსი</strong></span>
            <span class="ai-pill teal">${icon('activity')} <strong>${stats.last24h}</strong> 24სთ</span>
            <span class="ai-pill ok">${icon('check')} <strong>${successRate}%</strong> წარმატება</span>
          </div>
          <button type="button" class="btn primary ng-cta" id="sms-refresh-bal">${icon('refresh')} განახლება</button>
        </div>
      </section>

      <div class="ng-metrics-row">
        ${ngMetricCard({ label: 'სულ ჩანაწერი', value: stats.total, hint: 'ყველა SMS', iconName: 'file', tone: 'teal' })}
        ${ngMetricCard({ label: 'OTP', value: stats.otp, hint: 'ავტორიზაცია', iconName: 'shield', tone: 'cyan' })}
        ${ngMetricCard({ label: 'ადმინი', value: stats.admin, hint: 'ხელით გაგზავნა', iconName: 'users', tone: 'amber' })}
        ${ngMetricCard({ label: 'შეცდომა', value: stats.failed, hint: 'ვერ გაიგზავნა', iconName: 'alert', tone: 'rose' })}
      </div>

      <section class="card sms-send-card" style="--i:2">
        <div class="card-head">
          <div>
            <p class="kicker">გაგზავნა</p>
            <h4>ახალი SMS</h4>
          </div>
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

      <section class="card" style="--i:3">
        <div class="card-head">
          <div>
            <p class="kicker">ჟურნალი</p>
            <h4>გაგზავნილი SMS</h4>
          </div>
          <button type="button" class="btn ghost sm" id="sms-reload-logs">${icon('activity')}</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>დრო</th>
                <th>ნომერი</th>
                <th>ტექსტი</th>
                <th>მიზანი</th>
                <th>სტატუსი</th>
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
