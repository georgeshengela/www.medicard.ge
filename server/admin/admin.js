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
  spark: '<path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z"/><path d="M5 17l.8 2.8L8.6 21l-2.8.8L5 24l-.8-2.2L1.4 21l2.8-.8L5 17z"/>',
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
          or?.configured ? (orTone === 'bad' ? 'LOW' : or?.ok ? 'LIVE' : 'ERR') : 'OFF',
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
          emd?.configured ? (emd?.ok ? 'LIVE' : 'ERR') : 'OFF',
          emd?.remaining != null ? String(emd.remaining) : '—',
          emd?.remaining != null ? 'დარჩენილი კრედიტი' : `${emd?.creditsPerCall || 4} cr / call · ${escapeHtml(emd?.model || 'ჩატი')}`,
          [
            ['ამ თვეში', `${emd?.usedThisMonth ?? 0} call`],
            ['~ cr', String(emd?.estimatedCreditsThisMonth ?? 0)],
            ['სულ', `${emd?.usedAll ?? 0} call`],
            ['API', emd?.ok ? 'ონლაინ' : 'გამორთული'],
          ],
          emd?.dashboardUrl || 'https://evidencemd.ai/developers',
          'Dashboard',
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
    const tab = ['overview', 'users', 'packages', 'push', 'pharmacy', 'ai', 'settings'].includes(state.tab) ? state.tab : 'overview';
    await switchTab(tab);
  } catch (err) {
    if (err.status === 401 || err.status === 403) return;
    toast(err.message || 'სერვერთან კავშირი ვერ დამყარდა.', 'bad');
    const tab = ['overview', 'users', 'packages', 'push', 'pharmacy', 'ai', 'settings'].includes(state.tab) ? state.tab : 'overview';
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
    pharmacy: ['კატალოგი', 'ფასების შედარება', 'აფთიაქების სინქრონიზაცია, პროდუქტები და სინქის ისტორია.'],
    ai: ['AI Engine', 'ხარისხის ანალიზი', 'ყველა AI პასუხი იწერება, შეფასდება და გაუმჯობესდება კონტროლირებულად.'],
    settings: ['კონტროლი', 'აპის რეჟიმი', 'Offline, იძულებითი განახლება და რეგისტრაციის კარიბჭე.'],
  };
  $('page-kicker').textContent = copy[tab][0];
  $('page-title').textContent = copy[tab][1];
  $('page-sub').textContent = copy[tab][2];

  if (tab === 'overview') await renderOverview();
  if (tab === 'users') await renderUsers();
  if (tab === 'packages') await renderPackages();
  if (tab === 'push') await renderPush();
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
  const modeLabel = s.maintenanceMode ? 'OFFLINE' : s.forceUpdate ? 'FORCE UPDATE' : 'აქტიური';
  const activePct = stats.users.total ? Math.round((stats.users.active / stats.users.total) * 100) : null;

  $('tab-overview').innerHTML = `
    <div class="ai-page dash-page">
      <section class="ai-hero dash-hero">
        <div class="ai-hero-copy">
          <p class="kicker" style="margin:0 0 8px">ოპერაციები</p>
          <h3>მიმოხილვა</h3>
          <p>რეალურ დროში — მომხმარებლები, პაკეტები, AI პროვაიდერები და აპის რეჟიმი ერთ ეკრანზე.</p>
          <div class="ai-hero-meta">
            <span class="ai-pill teal">${icon('users')} მომხმარებლები <strong>${stats.users.total}</strong></span>
            <span class="ai-pill ok">${icon('unlock')} აქტიური <strong>${stats.users.active}</strong></span>
            ${stats.users.blocked ? `<span class="ai-pill bad">${icon('lock')} დაბლოკილი <strong>${stats.users.blocked}</strong></span>` : ''}
            <span class="ai-pill">${icon('file')} ჩანაწერები <strong>${stats.records}</strong></span>
            <span class="ai-pill ${modeTone}">${icon(modeOk ? 'shield' : 'alert')} ${modeLabel}</span>
          </div>
          <div class="dash-quick">
            <button class="btn tiny ghost" data-go="users">${icon('users')} მომხმარებლები</button>
            <button class="btn tiny ghost" data-go="packages">${icon('layers')} პაკეტები</button>
            <button class="btn tiny ghost" data-go="ai">${icon('spark')} AI Engine</button>
            <button class="btn tiny ghost" data-go="settings">${icon('settings')} რეჟიმი</button>
          </div>
        </div>
        ${dashHealthRing(stats.users.active, stats.users.total, activePct != null ? `${stats.users.active} აქტიური · ${stats.users.blocked} დაბლოკილი` : '—')}
      </section>

      <div class="ai-kpi-grid">
        <article class="ai-kpi">
          <div class="label">მომხმარებლები</div>
          <div class="value">${stats.users.total}</div>
          <div class="hint">${stats.users.active} აქტიური · ${stats.users.blocked} დაბლოკილი</div>
        </article>
        <article class="ai-kpi">
          <div class="label">ჩანაწერები</div>
          <div class="value">${stats.records}</div>
          <div class="hint">სამედიცინო ფაილები</div>
        </article>
        <article class="ai-kpi">
          <div class="label">AI ჩატები</div>
          <div class="value">${stats.chats}</div>
          <div class="hint">ექიმი / კონსილიუმი / მოდულები</div>
        </article>
        <article class="ai-kpi">
          <div class="label">პაკეტები</div>
          <div class="value">${assigned}</div>
          <div class="hint">${stats.packages.length} ტარიფი · აქტიურ ანგარიშებზე</div>
        </article>
      </div>

      ${dashProvidersHtml(balances)}

      <div class="ai-split">
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
                <strong>Maintenance</strong>
                <span>${s.maintenanceMode ? 'ON — აპი გათიშულია' : 'OFF'}</span>
              </div>
            </div>
            <div class="dash-mode-item ${s.forceUpdate ? 'on warn' : 'off'}">
              ${icon('zap')}
              <div>
                <strong>Force update</strong>
                <span>${s.forceUpdate ? 'ON — სავალდებულო განახლება' : 'OFF'}</span>
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
                <strong>მინ. ვერსია</strong>
                <span class="mono">${escapeHtml(s.minAppVersion)}</span>
              </div>
            </div>
          </div>
          <div class="dash-mode-foot">
            <span class="muted mono">${escapeHtml(s.supportEmail || 'support@medicard.ge')}</span>
            <button class="btn tiny primary" data-go="settings">${icon('settings')} რეჟიმის შეცვლა</button>
          </div>
        </div>
      </div>

      <div class="table-card ai-log-card dash-users-card">
        <div class="card-head">
          ${iconTile('users')}
          <div>
            <h3>ბოლო მომხმარებლები</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px">${recent.total} ანგარიში სულ · ბოლო რეგისტრაციები</p>
          </div>
          <button class="btn tiny ghost grow" data-go="users">${icon('arrow')} რეესტრი</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>მომხმარებელი</th>
                <th>კონტაქტი</th>
                <th>პაკეტი</th>
                <th>სტატუსი</th>
                <th>რეგისტრაცია</th>
                <th></th>
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
                  <td class="mono">${fmtDateShort(u.createdAt)}</td>
                  <td class="actions"><button class="btn tiny ghost" data-open-btn="${u.id}">${icon('file')} ნახვა</button></td>
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

  const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
  const totalFailed = campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0);
  const totalTarget = campaigns.reduce((sum, c) => sum + (c.targetCount || 0), 0);
  const deliveryPct = totalTarget ? Math.round((totalSent / totalTarget) * 100) : null;
  const lastCampaign = campaigns[0];
  const reachPct = subscribedUsers
    ? Math.min(100, Math.round((activeDevices / Math.max(subscribedUsers, 1)) * 100))
    : null;

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
      <section class="ai-hero">
        <div class="ai-hero-copy">
          <p class="kicker" style="margin:0 0 8px">კომუნიკაცია</p>
          <h3>Push შეტყობინებები</h3>
          <p>Expo Push broadcast მომხმარებლების სეგმენტებში — ერთი გაგზავნით, ცოცხალი მიწოდების სტატისტიკით.</p>
          <div class="ai-hero-meta">
            <span class="ai-pill teal">${icon('bell')} მოწყობილობები <strong>${activeDevices}</strong></span>
            <span class="ai-pill">მომხმარებლები <strong>${subscribedUsers}</strong></span>
            <span class="ai-pill ${deliveryPct != null && deliveryPct >= 90 ? 'ok' : deliveryPct != null && deliveryPct >= 70 ? 'warn' : deliveryPct != null ? 'bad' : ''}">მიწოდება <strong>${deliveryPct != null ? `${deliveryPct}%` : '—'}</strong></span>
            <span class="ai-pill">კამპანიები <strong>${campaigns.length}</strong></span>
          </div>
        </div>
        ${pushDeliveryRing(
          totalSent,
          totalTarget,
          lastCampaign
            ? `ბოლო · ${escapeHtml(lastCampaign.title.slice(0, 28))}${lastCampaign.title.length > 28 ? '…' : ''}`
            : 'ჯერ არ გაგზავნილა',
        )}
      </section>

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
          <div class="hint">${totalFailed} ვერ მივიდა</div>
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
              <p class="push-compose-note">გადახდილი პაკეტის სეგმენტი ითვალისწინებს ვადის გასვლას — ვადაგასული STANDARD/ULTIMATE → FREE.</p>
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
          ` : '<div class="empty"><strong>ჯერ არ გაგზავნილა</strong>პირველი broadcast ზემოთ შექმენით.</div>'}
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
          <table>
            <thead>
              <tr>
                <th>დრო</th>
                <th>შეტყობინება</th>
                <th>სეგმენტი</th>
                <th>სტატუსი</th>
                <th>მიწოდება</th>
                <th>ადმინი</th>
                <th></th>
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
                  <td class="actions"><button class="btn tiny ghost" data-push-view="${c.id}">${icon('file')} ნახვა</button></td>
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
      <section class="ai-hero">
        <div class="ai-hero-copy">
          <p class="kicker" style="margin:0 0 8px">AI Improvement Engine</p>
          <h3>ხარისხის ანალიზი</h3>
          <p>ყველა AI გამოძახება იწერება, შეფასდება LLM-as-judge სკანით და მომხმარებლის feedback-ით — კონტროლირებადი გაუმჯობესება.</p>
          <div class="ai-hero-meta">
            <span class="ai-pill teal">${icon('spark')} Prompt <strong>v${escapeHtml(stats.promptVersion)}</strong></span>
            <span class="ai-pill">ჯამი <strong>${stats.total}</strong></span>
            <span class="ai-pill ${errorTone}">24სთ შეცდომა <strong>${stats.errorRate24h}%</strong></span>
            ${fbPct != null ? `<span class="ai-pill ok">👍 ${fbPct}%</span>` : ''}
          </div>
        </div>
        ${aiScoreRing(
          lastEval?.avgScore ?? null,
          lastEval
            ? `${lastEval.lowScoreCount} დაბალი · ${lastEval.sampleSize} სინჯი`
            : 'სკანი ჯერ არ გაშვებულა',
        )}
      </section>

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
          <div class="label">Feedback</div>
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
            ${aiScoreRing(lastEval?.avgScore ?? null, 'ბოლო შედეგი')}
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
          <table>
            <thead><tr><th>დრო</th><th>მომხმარებელი</th><th>მოდული</th><th>სტატუსი</th><th>Latency</th><th>Feedback</th><th></th></tr></thead>
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
                  <td>${row.status === 'OK' ? '<span class="badge ok">OK</span>' : '<span class="badge bad">ERR</span>'}</td>
                  <td class="mono">${row.latencyMs != null ? `${row.latencyMs} ms` : '—'}</td>
                  <td>${feedbackCell(row)}</td>
                  <td class="actions"><button class="btn tiny ghost" data-ai-view="${row.id}">${icon('file')} ნახვა</button></td>
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
                  ${run.status === 'DONE' ? '<span class="badge ok">DONE</span>' : run.status === 'FAILED' ? '<span class="badge bad">FAIL</span>' : '<span class="badge std">…</span>'}
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
      <div class="drawer-stat"><div class="label">სტატუსი</div><strong>${interaction.status === 'OK' ? '✓ OK' : '✗ ERR'}</strong></div>
      <div class="drawer-stat"><div class="label">Prompt</div><strong class="mono">v${escapeHtml(interaction.promptVersion)}</strong></div>
      <div class="drawer-stat"><div class="label">Latency</div><strong>${interaction.latencyMs ?? '—'} ms</strong></div>
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

let pharmacyPollTimer = null;

function syncRunBadge(status) {
  if (status === 'DONE') return '<span class="badge ok">DONE</span>';
  if (status === 'FAILED') return '<span class="badge bad">FAILED</span>';
  if (status === 'RUNNING') return '<span class="badge std">RUNNING</span>';
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
      ? '<span class="badge ok">LIVE</span>'
      : last?.status === 'FAILED'
        ? '<span class="badge bad">FAILED</span>'
        : last?.status === 'RUNNING'
          ? '<span class="badge std">SYNC</span>'
          : '<span class="badge neutral">OFF</span>';

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

      <section class="pharm-hero ai-hero">
        <div class="ai-hero-copy">
          <p class="kicker">კატალოგი · Pharmadepot · Aversi · PSP</p>
          <h3>ფასების შედარება</h3>
          <p>სამი აფთიაქის ერთიანი კატალოგი — ავტომატური მატჩინგი, საუკეთესო ფასის გამოთვლა და მობილურ აპში ცოცხალი შედარება.</p>
          <div class="ai-hero-meta">
            <span class="ai-pill teal">${icon('pill')} პროდუქტი <strong>${catalog.products.toLocaleString('ka-GE')}</strong></span>
            <span class="ai-pill">${icon('layers')} offer <strong>${catalog.offers.toLocaleString('ka-GE')}</strong></span>
            <span class="ai-pill ok">${icon('check')} 2+ წყარო <strong>${catalog.comparedProducts.toLocaleString('ka-GE')}</strong></span>
            <span class="ai-pill ${insights.tripleCompare ? 'teal' : ''}">${icon('spark')} 3-გზიანი <strong>${insights.tripleCompare.toLocaleString('ka-GE')}</strong></span>
            <span class="ai-pill ${running ? 'std' : recentFailures.length ? 'warn' : 'ok'}">${running ? icon('activity') : icon('shield')} ${running ? 'სინქი…' : recentFailures.length ? `${recentFailures.length} შეცდომა` : 'სტაბილური'}</span>
          </div>
        </div>
        <div class="ai-hero-score">
          <div class="ai-score-ring ${ringTone}" style="--pct:${Math.min(100, comparedPct)}">
            <div class="ai-score-inner">
              <span class="ai-score-val">${catalog.products ? comparedPct : '—'}</span>
              <span class="ai-score-lbl">${catalog.products ? '%' : ''}</span>
            </div>
          </div>
          <p class="ai-score-caption">${catalog.products ? `${comparedPct}% შედარებადი · ${triplePct}% სამივეში` : 'კატალოგი ცარიელია'}</p>
        </div>
      </section>

      <div class="pharm-funnel">
        <div class="pharm-funnel-step">
          <span class="pharm-funnel-num">1</span>
          <div>
            <strong>კატალოგი</strong>
            <span>${catalog.products.toLocaleString('ka-GE')} SKU</span>
          </div>
        </div>
        <div class="pharm-funnel-line"></div>
        <div class="pharm-funnel-step">
          <span class="pharm-funnel-num">2</span>
          <div>
            <strong>შეთავაზებები</strong>
            <span>${catalog.offers.toLocaleString('ka-GE')} offer · ${stockPct}% stock</span>
          </div>
        </div>
        <div class="pharm-funnel-line"></div>
        <div class="pharm-funnel-step on">
          <span class="pharm-funnel-num">3</span>
          <div>
            <strong>შედარება</strong>
            <span>${catalog.comparedProducts.toLocaleString('ka-GE')} მრავალწყარო</span>
          </div>
        </div>
      </div>

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

  if (running) {
    pharmacyPollTimer = setInterval(() => {
      if (state.tab === 'pharmacy') renderPharmacy().catch(() => undefined);
    }, 8000);
  }
}

boot();
