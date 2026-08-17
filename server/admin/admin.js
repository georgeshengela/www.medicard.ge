const API = '';
const TOKEN_KEY = 'medicard.admin.token';
const THEME_KEY = 'medicard.admin.theme';
const EMAIL_KEY = 'medicard.admin.email';
const TAB_KEY = 'medicard.admin.tab';
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
};

function icon(name, size = '') {
  return `<svg class="icon ${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.activity}</svg>`;
}

function iconTile(name, tone = '') {
  return `<div class="icon-tile ${tone}">${icon(name, 'md')}</div>`;
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
    const label = next === 'dark' ? 'ღია თემა' : 'მუქი თემა';
    btn.innerHTML = `${icon(btn.dataset.icon)}${label}`;
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
    if ($('admin-chip')) {
      $('admin-chip').innerHTML = `${icon('user')}${escapeHtml(admin.email || '')}`;
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
  $('drawer').classList.add('hidden');
  $('drawer').setAttribute('aria-hidden', 'true');
  $('drawer-body').innerHTML = '';
}

function openDrawer(html) {
  $('drawer-body').innerHTML = html;
  $('drawer').classList.remove('hidden');
  $('drawer').setAttribute('aria-hidden', 'false');
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
    return `<div class="quota"><span class="mono">∞ შეუზღუდავი</span><div class="quota-track"><span style="width:18%"></span></div></div>`;
  }
  const pct = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const tone = pct >= 100 ? 'full' : pct >= 70 ? 'warn' : '';
  return `<div class="quota"><span class="mono">${usage.used} / ${usage.unlimited ? '∞' : usage.limit} <span class="muted">/ თვე</span></span><div class="quota-track ${tone}"><span style="width:${pct}%"></span></div></div>`;
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

function formatUsd(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function providerCardsHtml(balances) {
  const or = balances?.openrouter;
  const emd = balances?.evidencemd;
  const fetched = balances?.fetchedAt ? fmtDate(balances.fetchedAt) : '';

  const orTone = or?.tone || (or?.ok ? 'ok' : 'bad');
  const emdTone = emd?.tone || (emd?.ok ? 'ok' : 'bad');

  return `
    <div class="provider-grid">
      <article class="card provider">
        <div class="card-head">
          ${iconTile('wallet', orTone)}
          <div>
            <h3>OpenRouter</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px">X-ray / CT / კანი · ${escapeHtml(or?.model || '—')}</p>
          </div>
          <span class="badge ${orTone === 'ok' ? 'ok' : orTone === 'warn' ? 'neutral' : 'bad'}">${or?.configured ? (orTone === 'bad' ? 'LOW' : or.ok ? 'LIVE' : 'შეცდომა') : 'OFF'}</span>
        </div>
        <div class="value">${formatUsd(or?.remaining)}</div>
        <div class="hint">დარჩენილი ბალანსი</div>
        <div class="detail-list">
          <div class="detail"><span>${icon('zap')} სულ შეძენილი</span><strong>${formatUsd(or?.total)}</strong></div>
          <div class="detail"><span>${icon('activity')} დახარჯული</span><strong>${formatUsd(or?.used)}</strong></div>
          <div class="detail"><span>${icon('calendar')} დღეს</span><strong>${formatUsd(or?.usedDaily)}</strong></div>
          <div class="detail"><span>${icon('layers')} თვე</span><strong>${formatUsd(or?.usedMonthly)}</strong></div>
        </div>
        ${or?.error ? `<p class="error" style="margin:10px 0 0">${escapeHtml(or.error)}</p>` : ''}
        <div class="quick" style="margin-top:14px">
          <a class="btn ghost" href="${or?.dashboardUrl || 'https://openrouter.ai/settings/credits'}" target="_blank" rel="noreferrer">${icon('link')} შევსება</a>
        </div>
      </article>

      <article class="card provider">
        <div class="card-head">
          ${iconTile('message', emdTone)}
          <div>
            <h3>EvidenceMD</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px">ჩატი / კლინიკური ანალიზი · ${escapeHtml(emd?.model || '—')}</p>
          </div>
          <span class="badge ${emdTone === 'ok' ? 'ok' : emdTone === 'warn' ? 'neutral' : 'bad'}">${emd?.configured ? (emd.ok ? 'LIVE' : 'შეცდომა') : 'OFF'}</span>
        </div>
        <div class="value">${emd?.remaining != null ? emd.remaining : '—'}</div>
        <div class="hint">${emd?.remaining != null ? 'დარჩენილი კრედიტი' : `საფულე API არ არის · ${emd?.creditsPerCall || 4} cr / call`}</div>
        <div class="detail-list">
          <div class="detail"><span>${icon('calendar')} ამ თვეში</span><strong>${emd?.usedThisMonth ?? 0} call · ~${emd?.estimatedCreditsThisMonth ?? 0} cr</strong></div>
          <div class="detail"><span>${icon('activity')} სულ</span><strong>${emd?.usedAll ?? 0} call</strong></div>
          <div class="detail"><span>${icon('shield')} API</span><strong>${emd?.ok ? 'ონლაინ' : 'გამორთული'}</strong></div>
        </div>
        ${emd?.error ? `<p class="muted" style="margin:10px 0 0;font-size:12px">${escapeHtml(emd.error)}</p>` : ''}
        <div class="quick" style="margin-top:14px">
          <a class="btn ghost" href="${emd?.dashboardUrl || 'https://evidencemd.ai/developers'}" target="_blank" rel="noreferrer">${icon('link')} EvidenceMD dashboard</a>
        </div>
      </article>
    </div>
    <div class="provider-meta">
      <span class="muted mono">${fetched ? `განახლდა ${fetched}` : ''}</span>
      <button class="btn tiny ghost" id="balances-refresh">${icon('refresh')} ბალანსის განახლება</button>
    </div>
  `;
}

function setLivePill(settings) {
  const pill = $('live-pill');
  if (!pill || !settings) return;
  if (settings.maintenanceMode) {
    pill.className = 'status-pill bad';
    pill.innerHTML = `${icon('alert')} OFFLINE / განახლება`;
  } else if (settings.forceUpdate) {
    pill.className = 'status-pill warn';
    pill.innerHTML = `${icon('zap')} FORCE UPDATE`;
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
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  $('drawer-backdrop').addEventListener('click', closeDrawer);
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
    const tab = ['overview', 'users', 'packages', 'push', 'settings'].includes(state.tab) ? state.tab : 'overview';
    await switchTab(tab);
  } catch (err) {
    if (err.status === 401 || err.status === 403) return;
    toast(err.message || 'სერვერთან კავშირი ვერ დამყარდა.', 'bad');
    const tab = ['overview', 'users', 'packages', 'push', 'settings'].includes(state.tab) ? state.tab : 'overview';
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
    overview: ['ოპერაციები', 'მიმოხილვა', 'რეალურ დროში — მომხმარებლები, პაკეტები და აპის რეჟიმი.'],
    users: ['რეესტრი', 'მომხმარებლები', 'ძებნა, სორტი, პაკეტის მინიჭება, ბლოკი და წაშლა. Ctrl/⌘+K — ძებნა.'],
    packages: ['კომერცია', 'პაკეტები', 'ყველა გეგმა თვიურია — AI ლიმიტი 30-დღიან პერიოდში.'],
    push: ['კომუნიკაცია', 'Push შეტყობინებები', 'გაუგზავნეთ broadcast მომხმარებლებს სეგმენტის მიხედვით.'],
    settings: ['კონტროლი', 'აპის რეჟიმი', 'Offline, იძულებითი განახლება და რეგისტრაციის კარიბჭე.'],
  };
  $('page-kicker').textContent = copy[tab][0];
  $('page-title').textContent = copy[tab][1];
  $('page-sub').textContent = copy[tab][2];

  if (tab === 'overview') await renderOverview();
  if (tab === 'users') await renderUsers();
  if (tab === 'packages') await renderPackages();
  if (tab === 'push') await renderPush();
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

  $('tab-overview').innerHTML = `
    ${providerCardsHtml(balances)}
    <div class="metrics">
      <article class="metric">
        <div class="metric-top">
          <div>
            <div class="label">მომხმარებლები</div>
            <div class="value">${stats.users.total}</div>
          </div>
          ${iconTile('users')}
        </div>
        <div class="hint">${stats.users.active} აქტიური · ${stats.users.blocked} დაბლოკილი</div>
      </article>
      <article class="metric">
        <div class="metric-top">
          <div>
            <div class="label">აქტიური</div>
            <div class="value">${stats.users.active}</div>
          </div>
          ${iconTile('unlock', 'ok')}
        </div>
        <div class="hint">შეუძლიათ შესვლა და აპის გამოყენება</div>
      </article>
      <article class="metric">
        <div class="metric-top">
          <div>
            <div class="label">დაბლოკილი</div>
            <div class="value">${stats.users.blocked}</div>
          </div>
          ${iconTile('lock', 'bad')}
        </div>
        <div class="hint">წვდომა შეჩერებულია ადმინის მიერ</div>
      </article>
      <article class="metric">
        <div class="metric-top">
          <div>
            <div class="label">ჩანაწერები</div>
            <div class="value">${stats.records}</div>
          </div>
          ${iconTile('file')}
        </div>
        <div class="hint">სამედიცინო ფაილები სისტემაში</div>
      </article>
      <article class="metric">
        <div class="metric-top">
          <div>
            <div class="label">ჩატები</div>
            <div class="value">${stats.chats}</div>
          </div>
          ${iconTile('message', 'std')}
        </div>
        <div class="hint">AI / ექიმის სესიები</div>
      </article>
      <article class="metric">
        <div class="metric-top">
          <div>
            <div class="label">პაკეტები</div>
            <div class="value">${assigned}</div>
          </div>
          ${iconTile('layers', 'ult')}
        </div>
        <div class="hint">${stats.packages.length} ტარიფი · აქტიურ ანგარიშებზე</div>
      </article>
    </div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-head">
          ${iconTile('layers')}
          <div>
            <h3>პაკეტების განაწილება</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px">აქტიური მომხმარებლები ტარიფის მიხედვით</p>
          </div>
          <button class="btn tiny ghost grow" data-go="packages">${icon('arrow')} ყველა</button>
        </div>
        <div class="pkg-minis">
          ${stats.packages.map((p) => `
            <div class="pkg-mini">
              ${iconTile('zap', pkgClass(p.code) === 'standard' ? 'std' : pkgClass(p.code) === 'ultimate' ? 'ult' : '')}
              <div>
                <strong>${escapeHtml(p.nameKa)}</strong>
                <div class="sub">${escapeHtml(p.code)} · ${p.users} მომხმარებელი</div>
                <div class="bar ${pkgClass(p.code)}" style="margin-top:8px"><span style="width:${Math.round((p.users / maxPkg) * 100)}%"></span></div>
              </div>
              <span class="mono">${Math.round((p.users / Math.max(1, assigned)) * 100)}%</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          ${iconTile(modeOk ? 'shield' : 'alert', modeOk ? 'ok' : 'warn')}
          <div>
            <h3>აპის რეჟიმი</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px">${modeOk ? 'ყველა სერვისი ღიაა' : 'საჭიროა ყურადღება'}</p>
          </div>
        </div>
        <div class="detail-list">
          <div class="detail"><span>${icon('globe')} Maintenance</span><strong>${s.maintenanceMode ? 'ON' : 'OFF'}</strong></div>
          <div class="detail"><span>${icon('zap')} Force update</span><strong>${s.forceUpdate ? 'ON' : 'OFF'}</strong></div>
          <div class="detail"><span>${icon('users')} რეგისტრაცია</span><strong>${s.allowRegistrations ? 'ღიაა' : 'დახურულია'}</strong></div>
          <div class="detail"><span>${icon('activity')} მინ. ვერსია</span><strong class="mono">${escapeHtml(s.minAppVersion)}</strong></div>
          <div class="detail"><span>${icon('mail')} Support</span><strong>${escapeHtml(s.supportEmail || '—')}</strong></div>
        </div>
        <div class="quick" style="margin-top:14px">
          <button class="btn ghost" data-go="settings">${icon('settings')} რეჟიმის შეცვლა</button>
          <button class="btn ghost" data-go="users">${icon('users')} მომხმარებლები</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-head">
        ${iconTile('user')}
        <div>
          <h3>ბოლო მომხმარებლები</h3>
          <p class="muted" style="margin:2px 0 0;font-size:12px">${recent.total} ანგარიში სულ · ბოლო 6 რეგისტრაცია</p>
        </div>
        <button class="btn tiny ghost grow" data-go="users">${icon('arrow')} რეესტრი</button>
      </div>
      ${(recent.users || []).length ? recent.users.map((u) => `
        <div class="recent-row" data-open="${u.id}">
          <div class="avatar">${escapeHtml(initials(u.fullName))}</div>
          <div class="grow">
            <strong>${escapeHtml(u.fullName)}</strong>
            <div class="sub muted">${escapeHtml(u.email)}</div>
          </div>
          ${pkgBadge(u.package)}
          ${statusBadge(u.status)}
          <div class="recent-meta muted mono">${fmtDateShort(u.createdAt)}</div>
        </div>
      `).join('') : '<p class="muted">ჯერ არავინ დარეგისტრირებულა.</p>'}
    </div>
  `;
  document.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.go));
  });
  document.querySelectorAll('[data-open]').forEach((row) => {
    row.addEventListener('click', () => editUser(row.dataset.open));
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

async function renderUsers() {
  const root = $('tab-users');
  root.innerHTML = `
    <div class="toolbar">
      <label class="search-field">
        ${icon('search')}
        <input id="user-q" placeholder="ძებნა სახელით, email-ით ან ტელეფონით" />
      </label>
      <select id="user-status">
        <option value="">ყველა სტატუსი</option>
        <option value="ACTIVE">აქტიური</option>
        <option value="BLOCKED">დაბლოკილი</option>
      </select>
      <select id="user-package">
        <option value="">ყველა პაკეტი</option>
        <option value="FREE">FREE</option>
        <option value="STANDARD">STANDARD</option>
        <option value="ULTIMATE">ULTIMATE</option>
      </select>
      <div class="toolbar-actions">
        <button class="btn ghost" id="user-reload">${icon('refresh')} განახლება</button>
        <button class="btn ghost" id="user-csv">${icon('download')} CSV</button>
        <span class="table-meta" id="user-meta"></span>
      </div>
    </div>
    <div class="table-card">
      <div class="table-wrap"><table class="users-table">
        <thead>
          <tr>
            <th data-sort="fullName">მომხმარებელი</th>
            <th data-sort="email">კონტაქტი</th>
            <th data-sort="package">პაკეტი</th>
            <th data-sort="used">თვიური ლიმიტი</th>
            <th data-sort="status">სტატუსი</th>
            <th data-sort="createdAt">რეგისტრაცია</th>
            <th>აქტივობა</th>
            <th class="col-actions">მოქმედება</th>
          </tr>
        </thead>
        <tbody id="users-tbody"><tr><td colspan="8"><div class="empty">იტვირთება…</div></td></tr></tbody>
      </table></div>
      <div class="pager">
        <button class="btn tiny ghost" id="prev-page">წინა</button>
        <span id="page-ind"></span>
        <button class="btn tiny ghost" id="next-page">შემდეგი</button>
      </div>
    </div>
  `;

  const load = async () => {
    const q = $('user-q').value.trim();
    const status = $('user-status').value;
    const pkg = $('user-package').value;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(state.offset) });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (pkg) params.set('package', pkg);
    const data = await api(`/users?${params.toString()}`);
    state.users = data.users;
    state.total = data.total;
    paintUsers();
  };

  const paintUsers = () => {
    const rows = sortUsers(state.users);
    $('user-meta').textContent = `${state.total} ჩანაწერი`;
    $('page-ind').textContent = state.total
      ? `${state.offset + 1}–${Math.min(state.offset + PAGE_SIZE, state.total)} / ${state.total}`
      : '0 / 0';
    const prev = $('prev-page');
    const next = $('next-page');
    if (prev) prev.disabled = state.offset === 0;
    if (next) next.disabled = state.offset + PAGE_SIZE >= state.total;
    document.querySelectorAll('th[data-sort]').forEach((th) => {
      th.classList.toggle('sort-asc', th.dataset.sort === state.sortKey && state.sortDir === 'asc');
      th.classList.toggle('sort-desc', th.dataset.sort === state.sortKey && state.sortDir === 'desc');
    });
    const body = $('users-tbody');
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="8"><div class="empty">${icon('users', 'lg')}<strong>მომხმარებელი ვერ მოიძებნა</strong><p>შეცვალე ძებნა ან ფილტრი</p></div></td></tr>`;
      return;
    }
    body.innerHTML = rows.map((u) => `
      <tr data-id="${u.id}" class="${state.selectedId === u.id ? 'selected' : ''}">
        <td>
          <div class="person">
            <div class="avatar">${escapeHtml(initials(u.fullName))}</div>
            <div>
              <strong>${escapeHtml(u.fullName)}</strong>
              <div class="sub mono">${escapeHtml(u.id.slice(0, 8))}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="stack">
            <div class="line">${icon('mail')}<span>${escapeHtml(u.email)}</span></div>
            <div class="line muted">${icon('phone')}<span>${escapeHtml(u.phone || 'ტელეფონი არ არის')}</span></div>
          </div>
        </td>
        <td>${pkgBadge(u.package)}${u.packageExpiresAt ? `<div class="sub muted">${u.packageStartedAt ? `${fmtDateShort(u.packageStartedAt)} → ` : ''}${fmtDateShort(u.packageExpiresAt)}</div>` : `<div class="sub muted">კალენდ. თვე</div>`}</td>
        <td>${quotaCell(u.usage)}</td>
        <td>${statusBadge(u.status)}</td>
        <td class="mono">${fmtDateShort(u.createdAt)}</td>
        <td>
          <div class="stat-pills">
            <span>${u.counts.records} ჩან.</span>
            <span>${u.counts.chats} ჩატი</span>
            <span>${u.counts.medications} მედ.</span>
          </div>
        </td>
        <td class="col-actions">
          <div class="actions">
            <button class="btn tiny ghost" data-edit="${u.id}">${icon('file')} დეტალი</button>
            <button class="btn tiny ghost" data-copy="${u.email}">${icon('mail')} კოპირება</button>
            ${u.status === 'BLOCKED'
              ? `<button class="btn tiny ghost" data-unblock="${u.id}">${icon('unlock')} განბლოკვა</button>`
              : `<button class="btn tiny danger" data-block="${u.id}">${icon('lock')} ბლოკი</button>`}
          </div>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        state.selectedId = tr.dataset.id;
        paintUsers();
      });
    });
    body.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => editUser(btn.dataset.edit)));
    body.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.copy);
      toast('ელ-ფოსტა დაკოპირდა');
    }));
    body.querySelectorAll('[data-block]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('დავბლოკოთ ეს მომხმარებელი?')) return;
      await api(`/users/${btn.dataset.block}/block`, { method: 'POST' });
      toast('ანგარიში დაიბლოკა');
      await load();
    }));
    body.querySelectorAll('[data-unblock]').forEach((btn) => btn.addEventListener('click', async () => {
      await api(`/users/${btn.dataset.unblock}/unblock`, { method: 'POST' });
      toast('ანგარიში განიბლოკა');
      await load();
    }));
  };

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      if (state.sortKey === th.dataset.sort) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = th.dataset.sort; state.sortDir = 'asc'; }
      paintUsers();
    });
  });
  $('user-reload').onclick = load;
  let searchTimer;
  $('user-q').oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.offset = 0; load(); }, 280);
  };
  $('user-q').onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(searchTimer); state.offset = 0; load(); } };
  $('user-status').onchange = () => { state.offset = 0; load(); };
  $('user-package').onchange = () => { state.offset = 0; load(); };
  $('prev-page').onclick = () => { state.offset = Math.max(0, state.offset - PAGE_SIZE); load(); };
  $('next-page').onclick = () => {
    if (state.offset + PAGE_SIZE < state.total) { state.offset += PAGE_SIZE; load(); }
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

async function editUser(id) {
  const [{ user }, { packages }] = await Promise.all([
    api(`/users/${id}`),
    api('/packages'),
  ]);
  const pkgOptions = packages.map((p) => {
    const limitLabel = p.unlimited ? 'შეუზღუდავი' : `${p.monthlyAiLimit} / თვე`;
    return `<option value="${p.code}" ${user.package?.code === p.code ? 'selected' : ''}>${p.code} — ${limitLabel}</option>`;
  }).join('');
  const isPaid = user.package?.code && user.package.code !== 'FREE';
  openDrawer(`
    <div class="card-head">${iconTile('user')}<p class="kicker" style="margin:0">პროფილი</p></div>
    <h3>${escapeHtml(user.fullName)}</h3>
    <p class="muted mono">${escapeHtml(user.id)}</p>
    <div class="actions" style="justify-content:flex-start">
      ${pkgBadge(user.package)} ${statusBadge(user.status)}
    </div>
    <div class="drawer-stats">
      <div class="drawer-stat"><div class="label">რეგისტრაცია</div><strong>${fmtDateShort(user.createdAt)}</strong></div>
      <div class="drawer-stat"><div class="label">განახლდა</div><strong>${fmtDateShort(user.updatedAt)}</strong></div>
      <div class="drawer-stat"><div class="label">აქტივობა</div><strong>${user.counts.records} ჩან. · ${user.counts.chats} ჩატი · ${user.counts.medications} მედ.</strong></div>
      <div class="drawer-stat"><div class="label">თვიური AI</div><strong>${user.usage?.unlimited ? '∞' : `${user.usage?.used ?? 0} / ${user.usage?.limit ?? '—'}`}</strong></div>
      <div class="drawer-stat"><div class="label">პერიოდი</div><strong>${user.usage?.periodStart ? `${fmtDateShort(user.usage.periodStart)} → ${fmtDateShort(user.usage.periodEnd)}` : '—'}</strong></div>
      <div class="drawer-stat"><div class="label">გამოწერა</div><strong>${isPaid ? (user.packageStartedAt ? fmtDateShort(user.packageStartedAt) : '—') : 'უფასო'}</strong></div>
    </div>

    <div class="field"><span>სახელი</span><input id="edit-name" value="${escapeAttr(user.fullName)}" /></div>
    <div class="field"><span>ელ-ფოსტა</span><input id="edit-email" type="email" value="${escapeAttr(user.email)}" /></div>
    <div class="field"><span>ტელეფონი</span><input id="edit-phone" type="tel" value="${escapeAttr(user.phone || '')}" /></div>
    <div class="field"><span>სტატუსი</span>
      <select id="edit-status">
        <option value="ACTIVE" ${user.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE — შეუძლია შესვლა</option>
        <option value="BLOCKED" ${user.status === 'BLOCKED' ? 'selected' : ''}>BLOCKED — დაბლოკილი</option>
      </select>
    </div>
    <div class="field"><span>თვიური პაკეტი</span>
      <select id="edit-package">${pkgOptions}</select>
      <p class="muted" style="margin:6px 0 0;font-size:12px">გადახდილი პაკეტის მინიჭება იწყებს ახალ 30-დღიან პერიოდს.</p>
    </div>
    <div class="field"><span>პაკეტის დაწყება</span>
      <input id="edit-started" type="date" value="${toDateInput(user.packageStartedAt)}" ${isPaid ? '' : 'disabled'} />
    </div>
    <div class="field"><span>პაკეტის ვადა</span>
      <input id="edit-expires" type="date" value="${toDateInput(user.packageExpiresAt)}" ${isPaid ? '' : 'disabled'} />
    </div>
    <div class="field"><span>ადმინ შენიშვნა</span>
      <textarea id="edit-note" rows="4">${escapeHtml(user.adminNote || '')}</textarea>
    </div>
    <div class="row">
      ${isPaid ? `<button class="btn ghost" id="drawer-renew">${icon('calendar')} +30 დღე</button>` : ''}
      <button class="btn danger" id="drawer-del">${icon('x')} წაშლა</button>
      <button class="btn ghost" id="drawer-cancel">დახურვა</button>
      <button class="btn primary" id="drawer-save">${icon('check')} შენახვა</button>
    </div>
  `);
  $('drawer-cancel').onclick = closeDrawer;
  $('edit-package').onchange = () => {
    const code = $('edit-package').value;
    const paid = code !== 'FREE';
    $('edit-started').disabled = !paid;
    $('edit-expires').disabled = !paid;
    if (!paid) {
      $('edit-started').value = '';
      $('edit-expires').value = '';
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
  };
  $('drawer-del').onclick = async () => {
    if (!confirm('სამუდამოდ წავშალოთ მომხმარებელი და მისი მონაცემები?')) return;
    await api(`/users/${id}`, { method: 'DELETE' });
    toast('მომხმარებელი წაიშალა', 'bad');
    closeDrawer();
    await renderUsers();
  };
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
  const [{ activeDevices, subscribedUsers, recentCampaigns }, { campaigns }] = await Promise.all([
    api('/push/stats'),
    api('/push/campaigns'),
  ]);

  const SEGMENTS = {
    ALL: 'ყველა მოწყობილობა',
    ACTIVE: 'აქტიური მომხმარებლები',
    FREE: 'უფასო პაკეტი',
    STANDARD: 'STANDARD',
    ULTIMATE: 'ULTIMATE',
  };

  function campaignStatus(c) {
    if (c.status === 'SENT') return '<span class="badge ok">გაგზავნილი</span>';
    if (c.status === 'FAILED') return '<span class="badge bad">შეცდომა</span>';
    if (c.status === 'SENDING') return '<span class="badge std">იგზავნება</span>';
    return `<span class="badge neutral">${escapeHtml(c.status)}</span>`;
  }

  $('tab-push').innerHTML = `
    <div class="metrics">
      <article class="metric">
        <div class="metric-top">
          <div>
            <div class="label">Push მოწყობილობები</div>
            <div class="value">${activeDevices}</div>
          </div>
          ${iconTile('bell', 'ok')}
        </div>
        <div class="hint">აქტიური Expo push token-ები</div>
      </article>
      <article class="metric">
        <div class="metric-top">
          <div>
            <div class="label">მომხმარებლები push-ით</div>
            <div class="value">${subscribedUsers}</div>
          </div>
          ${iconTile('users', 'std')}
        </div>
        <div class="hint">უნიკალური ანგარიშები შეტყობინებებით</div>
      </article>
      <article class="metric">
        <div class="metric-top">
          <div>
            <div class="label">კამპანიები</div>
            <div class="value">${campaigns.length}</div>
          </div>
          ${iconTile('send', 'ult')}
        </div>
        <div class="hint">ბოლო 50 broadcast</div>
      </article>
    </div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-head">${iconTile('send')}<div><h3>ახალი შეტყობინება</h3><p class="muted" style="margin:2px 0 0;font-size:12px">Broadcast Expo Push — მომენტალურად</p></div></div>
        <div class="field"><span>სათაური</span><input id="push-title" maxlength="120" placeholder="Medicard.GE" /></div>
        <div class="field"><span>ტექსტი</span><textarea id="push-body" rows="4" maxlength="500" placeholder="შეტყობინების ტექსტი..."></textarea></div>
        <div class="field"><span>სეგმენტი</span>
          <select id="push-segment">
            ${Object.entries(SEGMENTS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
          </select>
        </div>
        <div class="row" style="justify-content:flex-start;margin-top:4px">
          <button class="btn primary" id="push-send">${icon('send')} გაგზავნა</button>
        </div>
        <p class="muted" style="margin:10px 0 0;font-size:12px">გადახდილი პაკეტის სეგმენტი ითვალისწინებს ვადის გასვლას — ვადაგასული STANDARD/ULTIMATE → FREE.</p>
      </div>
      <div class="card">
        <div class="card-head">${iconTile('activity')}<h3>ბოლო კამპანიები</h3></div>
        <div class="detail-list">
          ${recentCampaigns.length ? recentCampaigns.map((c) => `
            <div class="detail">
              <span>${icon('bell')} ${escapeHtml(c.title)}</span>
              <strong>${c.sentCount}/${c.targetCount}</strong>
            </div>
          `).join('') : '<p class="muted">ჯერ არ გაგზავნილა.</p>'}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:12px;overflow:auto">
      <div class="card-head">${iconTile('bell')}<h3>ისტორია</h3></div>
      <table>
        <thead>
          <tr>
            <th>დრო</th>
            <th>სათაური</th>
            <th>სეგმენტი</th>
            <th>სტატუსი</th>
            <th>მიწოდება</th>
            <th>ადმინი</th>
          </tr>
        </thead>
        <tbody>
          ${campaigns.length ? campaigns.map((c) => `
            <tr>
              <td class="mono">${fmtDate(c.sentAt || c.createdAt)}</td>
              <td><strong>${escapeHtml(c.title)}</strong><div class="sub muted">${escapeHtml(c.body.slice(0, 80))}${c.body.length > 80 ? '…' : ''}</div></td>
              <td><span class="badge neutral">${SEGMENTS[c.segment] || c.segment}</span></td>
              <td>${campaignStatus(c)}</td>
              <td class="mono">${c.sentCount} ✓ · ${c.failedCount} ✗ / ${c.targetCount}</td>
              <td class="muted">${escapeHtml(c.createdBy?.fullName || c.createdBy?.email || '—')}</td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="muted">კამპანიები ჯერ არ არის.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

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
            <strong>Offline / განახლება</strong>
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
        <div class="field" style="margin-top:12px">
          <span>Maintenance შეტყობინება</span>
          <textarea id="set-msg" rows="3">${escapeHtml(settings.maintenanceMessage)}</textarea>
        </div>
        <div class="field">
          <span>მინიმალური აპის ვერსია</span>
          <input id="set-minver" value="${escapeAttr(settings.minAppVersion)}" />
        </div>
        <div class="field">
          <span>Support email</span>
          <input id="set-email" value="${escapeAttr(settings.supportEmail)}" />
        </div>
        <div class="row" style="justify-content:flex-start;margin-top:8px">
          <button class="btn primary" id="set-save">${icon('check')} შენახვა</button>
        </div>
      </div>
      <div class="card">
        <div class="card-head">${iconTile(settings.maintenanceMode ? 'alert' : 'shield', settings.maintenanceMode ? 'warn' : 'ok')}<h3>სტატუსი</h3></div>
        <div class="detail-list">
          <div class="detail"><span>${icon('globe')} Maintenance</span><strong>${settings.maintenanceMode ? 'ON' : 'OFF'}</strong></div>
          <div class="detail"><span>${icon('zap')} Force update</span><strong>${settings.forceUpdate ? 'ON' : 'OFF'}</strong></div>
          <div class="detail"><span>${icon('users')} რეგისტრაცია</span><strong>${settings.allowRegistrations ? 'ღიაა' : 'დახურულია'}</strong></div>
          <div class="detail"><span>${icon('activity')} მინ. ვერსია</span><strong class="mono">${escapeHtml(settings.minAppVersion)}</strong></div>
          <div class="detail"><span>${icon('mail')} Support</span><strong>${escapeHtml(settings.supportEmail || '—')}</strong></div>
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
        supportEmail: $('set-email').value.trim(),
      },
    });
    setLivePill(next.settings);
    toast('რეჟიმი შენახულია');
    await renderSettings();
  };
}

boot();
