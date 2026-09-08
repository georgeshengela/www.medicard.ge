/**
 * MediCard Admin V3 Step 4 — Users registry + investigation workspace.
 * Loaded after admin.js. Overrides renderUsers / renderUserPage.
 */
(function adminUsersV3(global) {
  const V3 = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);
  const PAGE = 20;

  function esc(v) {
    return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '');
  }
  function escA(v) {
    return typeof escapeAttr === 'function' ? escapeAttr(v) : esc(v);
  }

  /** Asia/Tbilisi calendar YMD for date inputs (not UTC midnight). */
  function toDateInputTbilisi(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tbilisi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  /** Persist package calendar day in Tbilisi (+04), not browser UTC midnight. */
  function packageDateToIso(ymd, endOfDay = false) {
    const raw = String(ymd || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const suffix = endOfDay ? 'T23:59:59.999+04:00' : 'T00:00:00.000+04:00';
    const dt = new Date(`${raw}${suffix}`);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }

  global.AdminUsersV3 = { toDateInputTbilisi, packageDateToIso };

  // Override legacy UTC toDateInput for package fields
  if (typeof global.toDateInput === 'function' || typeof toDateInput === 'function') {
    global.toDateInput = toDateInputTbilisi;
  }
  try {
    // eslint-disable-next-line no-global-assign
    toDateInput = toDateInputTbilisi;
  } catch {
    /* ignore */
  }

  function accountStatusLabel(status) {
    return status === 'BLOCKED' ? 'დაბლოკილი' : 'შესვლა დაშვებულია';
  }

  function accountStatusCell(status) {
    const blocked = status === 'BLOCKED';
    return `<span class="v3-acct${blocked ? ' is-blocked' : ''}"><i></i>${accountStatusLabel(status)}</span>`;
  }

  function usersFilterParamsFromHash() {
    const hs = typeof hashSearch === 'function' ? hashSearch() : new URLSearchParams();
    return {
      q: hs.get('q') || '',
      status: hs.get('status') || '',
      package: hs.get('package') || '',
      activity: hs.get('activity') || '',
      appVersion: hs.get('appVersion') || '',
      page: Math.max(1, Number(hs.get('page') || 1) || 1),
    };
  }

  let lastListHash = '#/users';

  function writeUsersHash(filters) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status) params.set('status', filters.status);
    if (filters.package) params.set('package', filters.package);
    if (filters.activity) params.set('activity', filters.activity);
    if (filters.appVersion) params.set('appVersion', filters.appVersion);
    if (filters.page && filters.page > 1) params.set('page', String(filters.page));
    if (typeof writeTabHash === 'function') writeTabHash('users', params);
    else {
      const qs = params.toString();
      const next = qs ? `#/users?${qs}` : '#/users';
      if (location.hash !== next) history.replaceState({ tab: 'users' }, '', next);
    }
    if (!String(location.hash || '').startsWith('#/users/')) {
      lastListHash = location.hash || '#/users';
    }
  }

  global.usersListHref = function usersListHrefV3() {
    return lastListHash && lastListHash.startsWith('#/users') && !lastListHash.startsWith('#/users/')
      ? lastListHash
      : '#/users';
  };

  function readFiltersFromUi() {
    return {
      q: ($('user-q')?.value || '').trim(),
      status: $('user-status')?.value || '',
      package: $('user-package')?.value || '',
      activity: $('user-activity')?.value || '',
      appVersion: hashSearch().get('appVersion') || '',
      page: Math.floor((state.offset || 0) / PAGE) + 1,
    };
  }

  function activeFilterChips(f) {
    const chips = [];
    if (f.q) chips.push(['q', `ძებნა: ${f.q}`]);
    if (f.status === 'ACTIVE') chips.push(['status', 'შესვლა დაშვებულია']);
    if (f.status === 'BLOCKED') chips.push(['status', 'დაბლოკილი']);
    if (f.package) chips.push(['package', f.package]);
    if (f.activity === 'today') chips.push(['activity', 'აპში დღეს']);
    if (f.activity === 'inactive7') chips.push(['activity', '7+ დღე უქმე']);
    if (f.activity === 'inactive30') chips.push(['activity', '30+ დღე უქმე']);
    if (f.activity && !['today', 'inactive7', 'inactive30'].includes(f.activity)) {
      chips.push(['activity', f.activity]);
    }
    if (f.appVersion) chips.push(['appVersion', `აპი ${f.appVersion}`]);
    return chips;
  }

  function activityBucket(user) {
    const at = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
    if (!at) return { label: 'არასდროს', tone: 'mute' };
    const days = Math.floor((Date.now() - at) / 86400000);
    if (days <= 0) return { label: 'დღეს', tone: 'live' };
    if (days < 7) return { label: `${days}დ წინ`, tone: 'ok' };
    if (days < 30) return { label: `${Math.floor(days / 7)}კვ წინ`, tone: 'warn' };
    return {
      label: typeof fmtDateShort === 'function' ? fmtDateShort(user.lastActiveAt) : String(user.lastActiveAt),
      tone: 'mute',
    };
  }

  function activityLabelKa(key) {
    const map = {
      today: 'აპში დღეს',
      inactive7: '7+ დღე უქმე',
      inactive30: '30+ დღე უქმე',
      medi: 'Medi',
      meds: 'მედიკამენტები',
      cycle: 'ციკლი',
      ios: 'iOS',
      android: 'Android',
      notif_disabled: 'ნოტიფი გამორთული',
      outdated: 'ძველი ვერსია',
    };
    return map[key] || key;
  }

  function featureChips(user) {
    const counts = user.counts || {};
    const bits = [];
    if (counts.chats > 0) bits.push(`<span class="v3-users-feat" title="Medi ჩატი">${typeof icon === 'function' ? icon('spark') : ''} Medi</span>`);
    if (counts.medications > 0) bits.push(`<span class="v3-users-feat" title="მედიკამენტები">${typeof icon === 'function' ? icon('pill') : ''} მედ.</span>`);
    if (user.hasCycle) bits.push(`<span class="v3-users-feat" title="ციკლი">${typeof icon === 'function' ? icon('activity') : ''} ციკლი</span>`);
    if (user.notificationPermission === 'denied' || user.notificationPermission === 'disabled') {
      bits.push(`<span class="v3-users-feat is-off" title="შეტყობინება გამორთულია">${typeof icon === 'function' ? icon('bell') : ''} ნოტიფი</span>`);
    }
    return bits.length ? `<div class="v3-users-feats">${bits.join('')}</div>` : '';
  }

  function platformIco(platform) {
    const p = String(platform || '').toLowerCase();
    if (p.includes('ios') || p === 'iphone') return 'phone';
    if (p.includes('android')) return 'phone';
    if (p.includes('web')) return 'globe';
    return 'globe';
  }

  function sortHeader(key, label) {
    const active = state.sortKey === key;
    const dir = active ? (state.sortDir === 'asc' ? 'asc' : 'desc') : '';
    return `<th class="is-sort${active ? ' is-active' : ''}" data-sort="${escA(key)}" aria-sort="${active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}" tabindex="0" role="columnheader">
      <span>${esc(label)}</span>${active ? `<i class="v3-users-sort is-${dir}" aria-hidden="true"></i>` : ''}
    </th>`;
  }

  function fmtKa(n) {
    if (n == null) return '—';
    return Number(n).toLocaleString('ka-GE');
  }

  async function renderUsersV3() {
    const userId = typeof userIdFromHash === 'function' ? userIdFromHash() : null;
    if (userId) {
      await renderUserPageV3(userId, { profileTab: hashSearch().get('profileTab') });
      return;
    }
    state.userPageId = null;
    if (!state.sortKey) state.sortKey = 'createdAt';
    if (!state.sortDir) state.sortDir = 'desc';
    const root = $('tab-users');
    if (!root) return;
    const initial = usersFilterParamsFromHash();
    state.offset = (initial.page - 1) * PAGE;
    const ico = (name) => (typeof icon === 'function' ? icon(name) : '');

    const V = V3();
    if (typeof setPageHeader === 'function') {
      setPageHeader('users', {
        users: ['People', 'მომხმარებლები', 'რეესტრი, ფილტრები და გამოძიება — ნამდვილი ანგარიშები, უსაფრთხო ველები.', 'users.registry'],
      });
    }
    V.setHeaderActions?.(`
      <button type="button" class="btn ghost compact" id="user-reload">${ico('refresh')} განახლება</button>
      <button type="button" class="btn primary compact" id="user-csv">${ico('download')} CSV</button>
    `);

    const activityChips = [
      ['', 'ყველა'],
      ['today', 'აპში დღეს'],
      ['inactive7', '7+ დღე'],
      ['inactive30', '30+ დღე'],
      ['medi', 'Medi'],
      ['meds', 'მედიკამენტები'],
      ['cycle', 'ციკლი'],
      ['ios', 'iOS'],
      ['android', 'Android'],
      ['notif_disabled', 'ნოტიფი გამორთული'],
      ['outdated', 'ძველი ვერსია'],
    ];

    root.innerHTML = `
      <div class="v3-users v3-workspace-wide">
        <div class="v3-users-kpis" id="users-kpis" aria-label="რეესტრის მაჩვენებლები">
          <button type="button" class="v3-users-kpi" data-kpi-status="" aria-pressed="${!initial.status && !initial.package ? 'true' : 'false'}">
            <span class="v3-users-kpi-ico">${ico('users')}</span>
            <span class="v3-users-kpi-copy"><span>სულ</span><strong id="users-kpi-total">—</strong><em>რეესტრში</em></span>
          </button>
          <button type="button" class="v3-users-kpi is-ok" data-kpi-status="ACTIVE" aria-pressed="${initial.status === 'ACTIVE' ? 'true' : 'false'}">
            <span class="v3-users-kpi-ico">${ico('check')}</span>
            <span class="v3-users-kpi-copy"><span>შესვლა დაშვებულია</span><strong id="users-kpi-active">—</strong><em>აქტიური ანგარიში</em></span>
          </button>
          <button type="button" class="v3-users-kpi is-danger" data-kpi-status="BLOCKED" aria-pressed="${initial.status === 'BLOCKED' ? 'true' : 'false'}">
            <span class="v3-users-kpi-ico">${ico('lock')}</span>
            <span class="v3-users-kpi-copy"><span>დაბლოკილი</span><strong id="users-kpi-blocked">—</strong><em>წვდომა შეზღუდულია</em></span>
          </button>
          <button type="button" class="v3-users-kpi is-amber" data-kpi-package="ULTIMATE" aria-pressed="${initial.package === 'ULTIMATE' ? 'true' : 'false'}">
            <span class="v3-users-kpi-ico">${ico('layers')}</span>
            <span class="v3-users-kpi-copy"><span>ULTIMATE</span><strong id="users-kpi-ultimate">—</strong><em>აქტიური ტარიფი</em></span>
          </button>
          <article class="v3-users-kpi is-soft" aria-label="ახალი რეგისტრაციები">
            <span class="v3-users-kpi-ico">${ico('calendar')}</span>
            <span class="v3-users-kpi-copy"><span>ახალი · 7დ</span><strong id="users-kpi-week">—</strong><em id="users-kpi-today-hint">დღეს —</em></span>
          </article>
        </div>

        <section class="v3-users-board">
          <div class="v3-users-toolbar">
            <label class="v3-users-search">
              <span class="sr-only">ძებნა</span>
              ${ico('search')}
              <input id="user-q" type="search" placeholder="სახელი, ელ-ფოსტა, ტელეფონი ან ID…" value="${escA(initial.q)}" autocomplete="off" />
              <button type="button" id="user-q-clear" class="v3-icon-btn v3-users-clear${initial.q ? '' : ' hidden'}" aria-label="ძებნის გასუფთავება">${ico('x')}</button>
            </label>
            <div class="v3-users-filters" role="group" aria-label="ანგარიში და პაკეტი">
              <div class="v3-users-chips" id="users-status-chips" role="tablist" aria-label="ანგარიში">
                <button type="button" class="v3-users-chip${!initial.status ? ' is-active' : ''}" data-status-chip="" aria-pressed="${!initial.status}">ყველა</button>
                <button type="button" class="v3-users-chip${initial.status === 'ACTIVE' ? ' is-active' : ''}" data-status-chip="ACTIVE" aria-pressed="${initial.status === 'ACTIVE'}">აქტიური</button>
                <button type="button" class="v3-users-chip${initial.status === 'BLOCKED' ? ' is-active' : ''}" data-status-chip="BLOCKED" aria-pressed="${initial.status === 'BLOCKED'}">დაბლოკილი</button>
              </div>
              <div class="v3-users-chips" id="users-package-chips" role="group" aria-label="პაკეტი">
                <button type="button" class="v3-users-chip${!initial.package ? ' is-active' : ''}" data-package-chip="" aria-pressed="${!initial.package}">ყველა ტარიფი</button>
                <button type="button" class="v3-users-chip is-free${initial.package === 'FREE' ? ' is-active' : ''}" data-package-chip="FREE" aria-pressed="${initial.package === 'FREE'}">FREE</button>
                <button type="button" class="v3-users-chip is-std${initial.package === 'STANDARD' ? ' is-active' : ''}" data-package-chip="STANDARD" aria-pressed="${initial.package === 'STANDARD'}">STANDARD</button>
                <button type="button" class="v3-users-chip is-ult${initial.package === 'ULTIMATE' ? ' is-active' : ''}" data-package-chip="ULTIMATE" aria-pressed="${initial.package === 'ULTIMATE'}">ULTIMATE</button>
              </div>
              <button type="button" id="user-clear-filters" class="btn tiny ghost${activeFilterChips(initial).length ? '' : ' hidden'}">${ico('x')} გასუფთავება</button>
            </div>
            <span id="user-meta" class="v3-users-meta">იტვირთება…</span>
          </div>

          <div class="v3-users-activity" role="group" aria-label="აპის აქტივობა">
            ${activityChips.map(([val, lab]) => `
              <button type="button" class="v3-users-chip${(initial.activity || '') === val ? ' is-active' : ''}" data-activity-chip="${escA(val)}" aria-pressed="${(initial.activity || '') === val}">${esc(lab)}</button>
            `).join('')}
          </div>

          <select id="user-status" class="sr-only" aria-hidden="true" tabindex="-1">
            <option value=""></option><option value="ACTIVE"${initial.status === 'ACTIVE' ? ' selected' : ''}></option><option value="BLOCKED"${initial.status === 'BLOCKED' ? ' selected' : ''}></option>
          </select>
          <select id="user-package" class="sr-only" aria-hidden="true" tabindex="-1">
            <option value=""></option><option value="FREE"${initial.package === 'FREE' ? ' selected' : ''}></option><option value="STANDARD"${initial.package === 'STANDARD' ? ' selected' : ''}></option><option value="ULTIMATE"${initial.package === 'ULTIMATE' ? ' selected' : ''}></option>
          </select>
          <select id="user-activity" class="sr-only" aria-hidden="true" tabindex="-1">
            ${activityChips.map(([val]) => `<option value="${escA(val)}"${(initial.activity || '') === val ? ' selected' : ''}></option>`).join('')}
          </select>

          <div id="users-filter-summary" class="v3-users-active"></div>

          <div class="v3-users-table-head">
            <div class="v3-title-row">
              <h3>რეესტრი</h3>
              ${V.infoButton ? V.infoButton('users.table') : ''}
              ${V.infoButton ? V.infoButton('users.activityFilter', 'აქტივობის ფილტრის ახსნა') : ''}
            </div>
            <span class="v3-users-page-size">${PAGE} / გვერდი</span>
          </div>

          <div class="v3-table-wrap" id="users-table-wrap">
            <table class="v3-table is-clickable v3-users-table" aria-label="მომხმარებლების რეესტრი">
              <thead>
                <tr>
                  ${sortHeader('fullName', 'პირი')}
                  ${sortHeader('status', 'ანგარიში')}
                  ${sortHeader('lastActiveAt', 'აქტივობა')}
                  ${sortHeader('package', 'პაკეტი')}
                  ${sortHeader('platform', 'აპი')}
                  ${sortHeader('createdAt', 'რეგისტრაცია')}
                  <th class="col-go" aria-label="გახსნა"></th>
                </tr>
              </thead>
              <tbody id="users-tbody"><tr><td colspan="7" class="v3-users-skel">${Array.from({ length: 6 }, () => '<div class="v3-users-skel-row" aria-hidden="true"></div>').join('')}</td></tr></tbody>
            </table>
          </div>

          <div class="v3-users-pager">
            <strong id="page-ind">0 / 0</strong>
            <div class="v3-users-pager-nav">
              <button class="btn tiny ghost" id="prev-page" type="button">${ico('chevronLeft')} წინა</button>
              <div id="user-pager-pages" class="v3-users-pages"></div>
              <button class="btn tiny ghost" id="next-page" type="button">შემდეგი ${ico('arrow')}</button>
            </div>
          </div>
        </section>
      </div>`;

    const syncChipUi = () => {
      const f = readFiltersFromUi();
      document.querySelectorAll('[data-status-chip]').forEach((btn) => {
        const on = (btn.dataset.statusChip || '') === (f.status || '');
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      document.querySelectorAll('[data-package-chip]').forEach((btn) => {
        const on = (btn.dataset.packageChip || '') === (f.package || '');
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      document.querySelectorAll('[data-activity-chip]').forEach((btn) => {
        const on = (btn.dataset.activityChip || '') === (f.activity || '');
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      document.querySelectorAll('[data-kpi-status]').forEach((btn) => {
        const want = btn.dataset.kpiStatus || '';
        const on = want === ''
          ? !f.status && !f.package
          : f.status === want && !f.package;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.classList.toggle('is-pressed', on);
      });
      document.querySelectorAll('[data-kpi-package]').forEach((btn) => {
        const on = f.package === (btn.dataset.kpiPackage || '');
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.classList.toggle('is-pressed', on);
      });
    };

    const paintSummary = () => {
      const f = readFiltersFromUi();
      const chips = activeFilterChips(f).map(([key, label]) => {
        if (key === 'activity' && f.activity) return [key, activityLabelKa(f.activity)];
        return [key, label];
      });
      const host = $('users-filter-summary');
      if (!host) return;
      host.innerHTML = chips.length
        ? `<span class="v3-users-active-count">${chips.length} ფილტრი</span>${chips.map(([, label]) => `<span class="v3-users-active-chip">${esc(label)}</span>`).join('')}`
        : '';
      $('user-clear-filters')?.classList.toggle('hidden', !chips.length);
      syncChipUi();
    };

    const paintPagerPages = () => {
      const wrap = $('user-pager-pages');
      if (!wrap) return;
      const totalPages = Math.max(1, Math.ceil((state.total || 0) / PAGE));
      const current = Math.floor((state.offset || 0) / PAGE) + 1;
      if (!state.total) {
        wrap.innerHTML = '';
        return;
      }
      const pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (current > 3) pages.push('…');
        for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) pages.push(i);
        if (current < totalPages - 2) pages.push('…');
        pages.push(totalPages);
      }
      wrap.innerHTML = pages.map((p) => (p === '…'
        ? '<span class="v3-users-page-gap">…</span>'
        : `<button type="button" class="v3-users-page${p === current ? ' is-active' : ''}" data-page="${p}">${p}</button>`
      )).join('');
      wrap.querySelectorAll('[data-page]').forEach((btn) => {
        btn.onclick = () => {
          state.offset = (Number(btn.dataset.page) - 1) * PAGE;
          load();
        };
      });
    };

    const paintKpis = (stats) => {
      if (!stats?.users) return;
      const u = stats.users;
      const set = (id, val) => { const el = $(id); if (el) el.textContent = fmtKa(val); };
      set('users-kpi-total', u.total);
      set('users-kpi-active', u.active);
      set('users-kpi-blocked', u.blocked);
      const ultimate = (stats.packages || []).find((p) => p.code === 'ULTIMATE')?.users ?? 0;
      set('users-kpi-ultimate', ultimate);
      set('users-kpi-week', u.newWeek);
      const hint = $('users-kpi-today-hint');
      if (hint) hint.textContent = `დღეს ${fmtKa(u.newToday)}`;
    };

    const load = async () => {
      const f = readFiltersFromUi();
      writeUsersHash(f);
      paintSummary();
      const wrap = $('users-table-wrap');
      const body = $('users-tbody');
      wrap?.classList.add('is-loading');
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(state.offset) });
      if (f.q) params.set('q', f.q);
      if (f.status) params.set('status', f.status);
      if (f.package) params.set('package', f.package);
      if (f.activity) params.set('activity', f.activity);
      if (f.appVersion) params.set('appVersion', f.appVersion);
      try {
        const [data, stats] = await Promise.all([
          api(`/users?${params.toString()}`),
          api('/stats').catch(() => null),
        ]);
        state.users = data.users;
        state.total = data.total;
        if (stats) paintKpis(stats);
        paintTable();
      } catch (err) {
        toast(err.message, 'bad');
        if (body) {
          body.innerHTML = `<tr><td colspan="7">${V.errorState ? V.errorState('ჩატვირთვა ვერ მოხერხდა', err.message, 'users-retry') : esc(err.message)}</td></tr>`;
          $('users-retry')?.addEventListener('click', load);
        }
      } finally {
        wrap?.classList.remove('is-loading');
      }
    };

    const paintTable = () => {
      const rows = typeof sortUsers === 'function' ? sortUsers(state.users) : state.users;
      const from = state.total ? state.offset + 1 : 0;
      const to = state.total ? Math.min(state.offset + PAGE, state.total) : 0;
      const f = readFiltersFromUi();
      const filtered = activeFilterChips(f).length > 0;
      const metaEl = $('user-meta');
      const pageEl = $('page-ind');
      // Guard: list paint can finish after navigating to #/users/:id
      if (!metaEl || !pageEl || !$('users-tbody')) return;
      metaEl.textContent = state.total
        ? `${from}–${to} · ${fmtKa(state.total)} ანგარიში`
        : (filtered ? 'ფილტრს არ ემთხვევა' : 'ჩანაწერი არ არის');
      pageEl.textContent = state.total ? `${from}–${to} / ${fmtKa(state.total)}` : '0 / 0';
      if ($('prev-page')) $('prev-page').disabled = state.offset === 0;
      if ($('next-page')) $('next-page').disabled = state.offset + PAGE >= state.total;
      paintPagerPages();

      // Refresh sort header marks
      document.querySelectorAll('.v3-users-table thead th[data-sort]').forEach((th) => {
        const key = th.dataset.sort;
        const active = state.sortKey === key;
        th.classList.toggle('is-active', active);
        th.setAttribute('aria-sort', active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
        const mark = th.querySelector('.v3-users-sort');
        if (active) {
          if (!mark) th.insertAdjacentHTML('beforeend', `<i class="v3-users-sort is-${state.sortDir}" aria-hidden="true"></i>`);
          else mark.className = `v3-users-sort is-${state.sortDir}`;
        } else if (mark) mark.remove();
      });

      const body = $('users-tbody');
      if (!rows.length) {
        body.innerHTML = `<tr><td colspan="7"><div class="v3-empty v3-users-empty">${ico('users')}
          <strong>${filtered ? 'ფილტრს არ ემთხვევა' : 'მომხმარებლები ჯერ არ არის'}</strong>
          <p>${filtered ? 'გაასუფთავე ფილტრები ან შეცვალე ძებნა.' : 'პირველი ანგარიში აქ გამოჩნდება.'}</p>
          ${filtered ? '<button type="button" class="btn tiny ghost" id="users-empty-clear">გასუფთავება</button>' : ''}
        </div></td></tr>`;
        $('users-empty-clear')?.addEventListener('click', clearAll);
        return;
      }
      body.innerHTML = rows.map((u) => {
        const act = activityBucket(u);
        const created = typeof fmtDateShort === 'function' ? fmtDateShort(u.createdAt) : '';
        return `
        <tr data-id="${escA(u.id)}" class="${u.status === 'BLOCKED' ? 'row-blocked' : ''}" tabindex="0">
          <td>
            <div class="v3-users-person">
              <div class="avatar avatar-${typeof avatarTone === 'function' ? avatarTone(u) : 'teal'}">${esc(typeof initials === 'function' ? initials(u.fullName) : '?')}</div>
              <div class="v3-users-person-copy">
                <strong>${esc(u.fullName || '—')}</strong>
                <span class="sub">${esc(u.email || '')}${u.phone ? ` · ${esc(u.phone)}` : ''}</span>
                <span class="v3-users-id">${esc(String(u.id).slice(0, 8))}…</span>
              </div>
            </div>
          </td>
          <td>${accountStatusCell(u.status)}</td>
          <td>
            <div class="v3-users-act">
              <strong class="v3-users-act-badge is-${act.tone}">${esc(act.label)}</strong>
              <span class="sub">${u.lastActiveAt && typeof fmtRelative === 'function' ? fmtRelative(u.lastActiveAt) : '—'}</span>
              ${featureChips(u)}
            </div>
          </td>
          <td>
            <div class="v3-users-pkg">
              ${typeof pkgBadge === 'function' ? pkgBadge(u.package) : esc(u.package?.code || '—')}
              ${typeof quotaCell === 'function' ? quotaCell(u.usage) : ''}
            </div>
          </td>
          <td>
            <div class="v3-users-app">
              <strong>${ico(platformIco(u.platform))} ${typeof platformKa === 'function' ? (platformKa(u.platform) || '—') : (u.platform || '—')}</strong>
              <span class="sub">${u.appVersion ? esc(u.appVersion) : 'ვერსია უცნობია'}</span>
            </div>
          </td>
          <td>
            <strong class="v3-users-created">${esc(created || '—')}</strong>
          </td>
          <td class="col-go"><span class="v3-users-go" aria-hidden="true">${ico('arrow')}</span></td>
        </tr>`;
      }).join('');
      body.querySelectorAll('tr[data-id]').forEach((tr) => {
        const open = () => {
          if (typeof editUser === 'function') editUser(tr.dataset.id);
          else location.hash = `#/users/${encodeURIComponent(tr.dataset.id)}`;
        };
        tr.addEventListener('click', open);
        tr.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        });
      });
    };

    const clearAll = () => {
      if ($('user-q')) $('user-q').value = '';
      if ($('user-status')) $('user-status').value = '';
      if ($('user-package')) $('user-package').value = '';
      if ($('user-activity')) $('user-activity').value = '';
      state.offset = 0;
      writeUsersHash({ q: '', status: '', package: '', activity: '', appVersion: '', page: 1 });
      load();
    };

    let searchTimer;
    $('user-q').oninput = () => {
      $('user-q-clear')?.classList.toggle('hidden', !$('user-q').value);
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.offset = 0; load(); }, 280);
    };
    $('user-q-clear').onclick = () => {
      $('user-q').value = '';
      state.offset = 0;
      load();
      $('user-q').focus();
    };

    const setSelectAndLoad = (id, value) => {
      if ($(id)) $(id).value = value || '';
      state.offset = 0;
      load();
    };

    document.querySelectorAll('[data-status-chip]').forEach((btn) => {
      btn.addEventListener('click', () => setSelectAndLoad('user-status', btn.dataset.statusChip));
    });
    document.querySelectorAll('[data-package-chip]').forEach((btn) => {
      btn.addEventListener('click', () => setSelectAndLoad('user-package', btn.dataset.packageChip));
    });
    document.querySelectorAll('[data-activity-chip]').forEach((btn) => {
      btn.addEventListener('click', () => setSelectAndLoad('user-activity', btn.dataset.activityChip));
    });
    document.querySelectorAll('[data-kpi-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if ($('user-package')) $('user-package').value = '';
        setSelectAndLoad('user-status', btn.dataset.kpiStatus);
      });
    });
    document.querySelectorAll('[data-kpi-package]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if ($('user-status')) $('user-status').value = '';
        setSelectAndLoad('user-package', btn.dataset.kpiPackage);
      });
    });

    document.querySelectorAll('.v3-users-table thead th[data-sort]').forEach((th) => {
      const toggle = () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else {
          state.sortKey = key;
          state.sortDir = key === 'fullName' ? 'asc' : 'desc';
        }
        paintTable();
      };
      th.addEventListener('click', toggle);
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });

    $('user-clear-filters').onclick = clearAll;
    $('user-reload').onclick = load;
    window.__reloadUsers = load;
    $('prev-page').onclick = () => { state.offset = Math.max(0, state.offset - PAGE); load(); };
    $('next-page').onclick = () => {
      if (state.offset + PAGE < state.total) { state.offset += PAGE; load(); }
    };
    $('user-csv').onclick = () => {
      const f = readFiltersFromUi();
      const params = new URLSearchParams();
      if (f.q) params.set('q', f.q);
      if (f.status) params.set('status', f.status);
      if (f.package) params.set('package', f.package);
      if (f.activity) params.set('activity', f.activity);
      if (f.appVersion) params.set('appVersion', f.appVersion);
      if (typeof opsDownload === 'function') {
        opsDownload(`/export/users?${params.toString()}`, 'users.csv');
        return;
      }
      toast('CSV ექსპორტი მიუწვდომელია', 'warn');
    };
    await load();
  }

  async function renderUserPageV3(id, opts = {}) {
    // Delegate structure to legacy renderer then enhance chrome — full rewrite for reliability
    if (typeof renderUserPage === 'function' && renderUserPage !== renderUserPageV3) {
      // Fall through: we replace renderUserPage below by assigning this function
    }
    const root = $('tab-users');
    if (!root) return;
    state.selectedId = id;
    state.userPageId = id;
    state.tab = 'users';
    const V = V3();
    if (typeof setPageHeader === 'function') {
      setPageHeader('users', {
        users: ['People', 'პროფილი იტვირთება…', '', 'users.investigation'],
      });
    }
    V.setHeaderActions?.('');
    root.innerHTML = `<div class="v3-user-page"><div class="user-page-loading">${typeof icon === 'function' ? icon('refresh') : ''}<span>პროფილი იტვირთება…</span></div></div>`;

    let user;
    let packages;
    let profileExtra;
    try {
      const rangeQs = typeof opsQs === 'function' ? opsQs() : 'range=30d';
      const data = await Promise.all([api(`/users/${id}?${rangeQs}`), api('/packages')]);
      user = data[0].user;
      packages = data[1].packages;
      profileExtra = data[0];
    } catch (err) {
      toast(err.message, 'bad');
      location.hash = typeof usersListHref === 'function' ? usersListHref() : '#/users';
      return;
    }

    if (typeof setPageHeader === 'function') {
      setPageHeader('users', {
        users: [
          'People',
          user.fullName || user.email || 'მომხმარებელი',
          (user.email || '') + (user.phone ? ` · ${user.phone}` : ''),
          'users.investigation',
        ],
      });
    }
    V.setHeaderActions?.(`
      ${V.copyIdButton ? V.copyIdButton(user.id, 'User ID') : ''}
      <button type="button" class="btn ghost compact" id="user-header-reload">${typeof icon === 'function' ? icon('refresh') : ''} განახლება</button>
    `);

    const ico = (name) => (typeof icon === 'function' ? icon(name) : '');
    const ov = profileExtra.investigation?.overview || {};
    const usageMap = profileExtra.investigation?.productUsage || {};
    const notes = profileExtra.investigation?.notifications || profileExtra.notifications || {};
    const featUsed = Object.values(usageMap).filter((f) => f?.used).length;
    const featTotal = Object.keys(typeof FEATURE_USAGE_LABELS === 'object' ? FEATURE_USAGE_LABELS : {}).length || 8;
    const lastActiveAt = profileExtra.activity?.lastActiveAt || ov.lastActiveAt || null;
    const lastActive = lastActiveAt
      ? (typeof fmtDateShort === 'function' ? fmtDateShort(lastActiveAt) : lastActiveAt)
      : '—';
    const lastActiveRel = lastActiveAt && typeof fmtRelative === 'function'
      ? fmtRelative(lastActiveAt)
      : '';
    const actBucket = activityBucket({ lastActiveAt });
    const platformLabel = (typeof platformKa === 'function'
      ? platformKa(profileExtra.activity?.platform || ov.platform || user.platform)
      : null) || '—';
    const appVer = profileExtra.activity?.appVersion || ov.appVersion || user.appVersion || '';
    const notifPerm = typeof permKa === 'function'
      ? permKa(ov.notificationPermission || notes.permission || user.notificationPermission)
      : (ov.notificationPermission || '—');
    const createdLabel = typeof fmtDateShort === 'function' ? fmtDateShort(user.createdAt) : esc(user.createdAt);
    const tone = typeof avatarTone === 'function' ? avatarTone(user) : 'teal';
    const init = typeof initials === 'function' ? initials(user.fullName || user.email) : '?';
    const subLine = [user.email, user.phone].filter(Boolean).join(' · ');
    const place = (typeof adminPlaceOf === 'function' ? adminPlaceOf(ov.location) : { line: '', country: 'უცნობია', city: 'უცნობია', flag: '' });
    const placeMeta = place.line
      ? `<span class="v3-user-place">${place.flag || ico('globe')} ${esc(place.line)}</span>`
      : `<span class="v3-user-place is-unknown">${ico('globe')} ქვეყანა უცნობია</span>`;

    const pkgOptions = packages.map((p) => {
      const limitLabel = p.unlimited ? 'შეუზღუდავი' : `${p.monthlyAiLimit} / თვე`;
      return `<option value="${escA(p.code)}" ${user.package?.code === p.code ? 'selected' : ''}>${esc(p.code)} — ${esc(limitLabel)}</option>`;
    }).join('');
    const isPaid = user.package?.code && user.package.code !== 'FREE';
    const aiLabel = user.usage?.unlimited
      ? '∞'
      : `${user.usage?.used ?? 0} / ${user.usage?.limit ?? '—'}`;
    const aiSub = user.usage?.unlimited
      ? 'შეუზღუდავი'
      : (user.usage?.remaining != null ? `${user.usage.remaining} დარჩა` : 'თვიური ლიმიტი');

    const formHtml = `
      <div class="v3-user-edit-form" id="user-edit-form">
        ${V.field ? V.field({ id: 'edit-name', label: 'სახელი', control: V.input({ id: 'edit-name', value: user.fullName }) }) : ''}
        ${V.field ? V.field({ id: 'edit-email', label: 'ელ-ფოსტა', control: V.input({ id: 'edit-email', type: 'email', value: user.email }) }) : ''}
        ${V.field ? V.field({ id: 'edit-phone', label: 'ტელეფონი', control: V.input({ id: 'edit-phone', type: 'tel', value: user.phone || '' }) }) : ''}
        ${V.field ? V.field({
          id: 'edit-gender',
          label: 'სქესი',
          help: 'ციკლის მოდული მხოლოდ მდედრობითზე ჩანს',
          control: `<select id="edit-gender" class="v3-input">
            <option value="" ${!user.gender ? 'selected' : ''}>არ არის მითითებული</option>
            <option value="MALE" ${user.gender === 'MALE' ? 'selected' : ''}>მამრობითი</option>
            <option value="FEMALE" ${user.gender === 'FEMALE' ? 'selected' : ''}>მდედრობითი</option>
            <option value="OTHER" ${user.gender === 'OTHER' ? 'selected' : ''}>სხვა</option>
          </select>`,
        }) : ''}
        ${V.field ? V.field({
          id: 'edit-status',
          label: 'ანგარიშის სტატუსი',
          help: 'შესვლა დაშვებულია ≠ აპის აქტივობა',
          control: `<select id="edit-status" class="v3-input">
            <option value="ACTIVE" ${user.status === 'ACTIVE' ? 'selected' : ''}>შესვლა დაშვებულია</option>
            <option value="BLOCKED" ${user.status === 'BLOCKED' ? 'selected' : ''}>დაბლოკილი</option>
          </select>`,
        }) : ''}
        ${V.field ? V.field({
          id: 'edit-package',
          label: 'თვიური პაკეტი',
          control: `<select id="edit-package" class="v3-input">${pkgOptions}</select>`,
          help: 'გადახდილი პაკეტი იწყებს ახალ პერიოდს',
        }) : ''}
        <div class="v3-user-edit-spacer" aria-hidden="true"></div>
        ${V.field ? V.field({
          id: 'edit-started',
          label: 'პაკეტის დაწყება',
          help: 'თბილისის კალენდარული დღე',
          control: `<input id="edit-started" class="v3-input" type="date" value="${toDateInputTbilisi(user.packageStartedAt)}" ${isPaid ? '' : 'disabled'} />`,
        }) : ''}
        ${V.field ? V.field({
          id: 'edit-expires',
          label: 'პაკეტის ვადა',
          help: 'თბილისის კალენდარული დღე',
          control: `<input id="edit-expires" class="v3-input" type="date" value="${toDateInputTbilisi(user.packageExpiresAt)}" ${isPaid ? '' : 'disabled'} />`,
        }) : ''}
        ${V.field ? `<div class="v3-user-edit-full">${V.field({
          id: 'edit-note',
          label: 'ადმინ შენიშვნა',
          control: `<textarea id="edit-note" class="v3-input" rows="3">${esc(user.adminNote || '')}</textarea>`,
        })}</div>` : ''}
        <div class="v3-destructive-zone v3-user-edit-full">
          <h4>საშიში ქმედება</h4>
          <p class="muted">წაშლა შეუქცევადია და შლის პროფილსა და დაკავშირებულ მონაცემებს.</p>
          <button class="btn danger" id="user-del" type="button">${ico('trash')} წაშლა</button>
        </div>
      </div>`;

    const tabsHtml = typeof renderUserInvestigationTabs === 'function'
      ? renderUserInvestigationTabs(user, profileExtra, pkgOptions, isPaid, opts.profileTab || 'overview')
      : '';

    root.innerHTML = `
      <div class="v3-user-page v3-workspace-wide">
        <div class="v3-user-nav">
          <a class="v3-user-back" id="user-page-back" href="${typeof usersListHref === 'function' ? usersListHref() : '#/users'}">${ico('chevronLeft')} რეესტრი</a>
          <span class="v3-user-nav-hint">გამოძიება · უსაფრთხო ველები</span>
        </div>

        <section class="v3-user-hero${user.status === 'BLOCKED' ? ' is-blocked' : ''}">
          <div class="v3-user-hero-main">
            <div class="avatar avatar-${escA(tone)} v3-user-avatar">${esc(init)}</div>
            <div class="v3-user-hero-copy">
              <div class="v3-user-hero-title">
                <h2>${esc(user.fullName || user.email || 'მომხმარებელი')}</h2>
                ${accountStatusCell(user.status)}
                ${typeof pkgBadge === 'function' ? pkgBadge(user.package) : `<span class="badge">${esc(user.package?.code || '—')}</span>`}
              </div>
              <p class="v3-user-hero-sub">${esc(subLine || 'კონტაქტი არ არის')}</p>
              <div class="v3-user-hero-meta">
                <button type="button" class="v3-user-idchip inv-copy" data-copy="${escA(user.id)}" data-copy-label="User ID" title="User ID კოპირება">
                  ${ico('file')} ${esc(String(user.id).slice(0, 8))}…
                </button>
                ${placeMeta}
                <span>${ico('calendar')} ${esc(createdLabel)}</span>
                <span>${ico(platformIco(platformLabel))} ${esc(platformLabel)}${appVer ? ` · ${esc(appVer)}` : ''}</span>
              </div>
            </div>
          </div>
          <div class="v3-user-hero-actions">
            <button type="button" class="btn ghost compact" id="user-reset-usage">${ico('refresh')} ლიმიტის განულება</button>
            ${isPaid ? `<button type="button" class="btn ghost compact" id="user-renew">${ico('calendar')} +30 დღე</button>` : ''}
          </div>
        </section>

        <div class="v3-user-kpis" aria-label="ოპერაციული მაჩვენებლები">
          <article class="v3-user-kpi is-live">
            <span class="v3-user-kpi-ico">${ico('activity')}</span>
            <span class="v3-user-kpi-copy">
              <span>აქტივობა</span>
              <strong class="v3-users-act-badge is-${actBucket.tone}">${esc(actBucket.label)}</strong>
              <em>${esc(lastActiveRel || lastActive)}</em>
            </span>
          </article>
          <article class="v3-user-kpi">
            <span class="v3-user-kpi-ico">${ico('spark')}</span>
            <span class="v3-user-kpi-copy">
              <span>AI · თვე</span>
              <strong>${esc(aiLabel)}</strong>
              <em>${esc(aiSub)}</em>
            </span>
          </article>
          <article class="v3-user-kpi">
            <span class="v3-user-kpi-ico">${ico('layers')}</span>
            <span class="v3-user-kpi-copy">
              <span>პროდუქტი</span>
              <strong>${featUsed}<span class="v3-user-kpi-den"> / ${featTotal}</span></strong>
              <em>მოდული გამოყენებული</em>
            </span>
          </article>
          <article class="v3-user-kpi">
            <span class="v3-user-kpi-ico">${ico('bell')}</span>
            <span class="v3-user-kpi-copy">
              <span>შეტყობინება</span>
              <strong>${esc(notifPerm)}</strong>
              <em>${esc(typeof freqKa === 'function' ? freqKa(ov.selectedFrequency || notes.preference?.selectedFrequency) : (ov.selectedFrequency || '—'))}</em>
            </span>
          </article>
          <article class="v3-user-kpi">
            <span class="v3-user-kpi-ico">${ico('message')}</span>
            <span class="v3-user-kpi-copy">
              <span>ჩანაწერები</span>
              <strong>${fmtKa(user.counts?.chats ?? 0)} · ${fmtKa(user.counts?.medications ?? 0)}</strong>
              <em>Medi ჩატი · მედიკამენტები</em>
            </span>
          </article>
        </div>

        <div class="v3-user-workspace">
          <div class="v3-user-main user-workspace v3-user-board" id="user-inv-host">${tabsHtml}</div>
          <aside class="v3-user-side">
            <div class="v3-user-card v3-user-edit-card">
              <div class="v3-title-row">
                <h3>${ico('settings')} ანგარიშის რედაქტირება</h3>
                ${V.infoButton ? V.infoButton('users.accountStatus') : ''}
              </div>
              <p class="v3-user-edit-lead">სტატუსი, პაკეტი და შენიშვნა — ვადები თბილისის კალენდარული დღით.</p>
              ${formHtml}
            </div>
          </aside>
        </div>

        ${V.stickyActions ? V.stickyActions({
          dirty: false,
          cancel: `<button type="button" class="btn ghost" id="user-cancel-nav">${ico('chevronLeft')} უკან</button>`,
          save: `<button type="button" class="btn primary" id="user-save">${ico('check')} შენახვა</button>`,
          danger: '',
        }).replace('class="v3-sticky-actions', 'class="v3-sticky-actions v3-user-sticky') : `<footer class="user-actions"><button class="btn primary" id="user-save">შენახვა</button></footer>`}
      </div>`;

    // Hide duplicate edit form inside overview tab if present
    root.querySelector('.user-overview-edit')?.remove();

    if (typeof bindUserInvestigation === 'function') bindUserInvestigation(id);
    // Copy chips in hero (bindUserInvestigation also covers [data-copy] in tabs)
    root.querySelectorAll('.v3-user-hero [data-copy]').forEach((btn) => {
      btn.onclick = () => {
        if (typeof copyAdminValue === 'function') copyAdminValue(btn.dataset.copy, btn.dataset.copyLabel || 'ID');
      };
    });
    V.watchDirty?.(root.querySelector('#user-edit-form'));
    V.setDirty?.(false);

    $('user-page-back')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (V.dirty && V.confirmLeave) {
        const ok = await V.confirmLeave();
        if (!ok) return;
      }
      location.hash = typeof usersListHref === 'function' ? usersListHref() : '#/users';
    });
    $('user-cancel-nav')?.addEventListener('click', () => $('user-page-back')?.click());
    $('user-header-reload')?.addEventListener('click', () => {
      renderUserPageV3(id, { profileTab: typeof currentUserProfileTab === 'function' ? currentUserProfileTab() : 'overview' });
    });

    $('edit-package')?.addEventListener('change', () => {
      const paid = $('edit-package').value !== 'FREE';
      if ($('edit-started')) $('edit-started').disabled = !paid;
      if ($('edit-expires')) $('edit-expires').disabled = !paid;
      if (!paid) {
        if ($('edit-started')) $('edit-started').value = '';
        if ($('edit-expires')) $('edit-expires').value = '';
      }
    });

    $('user-reset-usage')?.addEventListener('click', () => {
      V.openConfirm?.({
        title: 'AI ლიმიტის განულება',
        message: 'ამ პერიოდის გამოყენება გახდება 0.',
        confirmLabel: 'განულება',
        onConfirm: async () => {
          await api(`/users/${id}/reset-usage`, { method: 'POST' });
          toast('AI ლიმიტი განულდა');
          await renderUserPageV3(id, { profileTab: typeof currentUserProfileTab === 'function' ? currentUserProfileTab() : 'overview' });
        },
      });
    });

    $('user-renew')?.addEventListener('click', () => {
      const exp = toDateInputTbilisi(user.packageExpiresAt) || '—';
      V.openConfirm?.({
        title: 'გამოწერის განახლება (+30 დღე)',
        message: `განახლდება გამოწერის პერიოდი და AI ლიმიტის ფანჯარა. მიმდინარე ვადა: ${exp}.`,
        confirmLabel: '+30 დღე',
        onConfirm: async () => {
          if (V.runMutation) {
            const out = await V.runMutation({
              action: () => api(`/users/${id}/renew`, { method: 'POST' }),
              successMessage: 'გამოწერა განახლდა',
            });
            if (!out?.ok) return;
          } else {
            await api(`/users/${id}/renew`, { method: 'POST' });
            toast('გამოწერა განახლდა');
          }
          await renderUserPageV3(id, { profileTab: typeof currentUserProfileTab === 'function' ? currentUserProfileTab() : 'overview' });
        },
      });
    });

    $('user-save')?.addEventListener('click', async () => {
      const packageCode = $('edit-package')?.value;
      const expiresRaw = $('edit-expires')?.value.trim() || '';
      const startedRaw = $('edit-started')?.value.trim() || '';
      const body = {
        fullName: $('edit-name')?.value.trim(),
        email: $('edit-email')?.value.trim(),
        phone: $('edit-phone')?.value.trim() || null,
        gender: $('edit-gender')?.value || null,
        status: $('edit-status')?.value,
        packageCode,
        packageStartedAt: packageCode === 'FREE'
          ? null
          : (startedRaw ? packageDateToIso(startedRaw, false) : undefined),
        packageExpiresAt: packageCode === 'FREE'
          ? null
          : (expiresRaw ? packageDateToIso(expiresRaw, true) : null),
        adminNote: $('edit-note')?.value.trim() || null,
      };
      const btn = $('user-save');
      try {
        if (V.runMutation) {
          const out = await V.runMutation({
            action: () => api(`/users/${id}`, { method: 'PATCH', body }),
            pendingElement: btn,
            successMessage: 'პროფილი განახლდა',
          });
          if (!out?.ok) return;
        } else {
          await api(`/users/${id}`, { method: 'PATCH', body });
          toast('პროფილი განახლდა');
        }
        V.setDirty?.(false);
        await renderUserPageV3(id, { profileTab: typeof currentUserProfileTab === 'function' ? currentUserProfileTab() : 'overview' });
      } catch (err) {
        toast(err.message, 'bad');
      }
    });

    $('user-del')?.addEventListener('click', () => {
      V.openConfirm?.({
        title: 'მომხმარებლის წაშლა',
        message: `სამუდამოდ წავშალოთ „${user.fullName || user.email}"? წაიშლება პროფილი და დაკავშირებული მონაცემები. შეუქცევადია.`,
        confirmLabel: 'წაშლა',
        variant: 'danger',
        onConfirm: async () => {
          await api(`/users/${id}`, { method: 'DELETE' });
          toast('მომხმარებელი წაიშალა', 'bad');
          location.hash = typeof usersListHref === 'function' ? usersListHref() : '#/users';
        },
      });
    });
  }

  // Patch telemetry empty presentation inside legacy tabs after bind
  const _legacyTabs = global.renderUserInvestigationTabs;
  if (typeof _legacyTabs === 'function') {
    global.renderUserInvestigationTabs = function patchedTabs(user, extra, pkgOptions, isPaid, activeTab) {
      let html = _legacyTabs(user, extra, pkgOptions, isPaid, activeTab);
      const ov = extra.investigation?.overview || {};
      const notes = extra.investigation?.notifications || extra.notifications || {};
      const tel = ov.telemetry || notes.telemetry || {};
      const missing = [];
      if (tel.brainSync == null) missing.push('Brain სინქი');
      if (tel.outcomeSync == null) missing.push('Outcome სინქი');
      if (!ov.platform && !extra.activity?.platform) missing.push('პლატფორმა');
      if (!ov.appVersion && !extra.activity?.appVersion) missing.push('აპის ვერსია');
      if (missing.length >= 2) {
        const box = `<div class="v3-telem-empty"><div class="v3-title-row"><strong>კლიენტის ტელემეტრია</strong>${V3().infoButton ? V3().infoButton('users.telemetry') : ''}</div><p>ბოლო კლიენტის ტელემეტრია მიუწვდომელია. ეს ხშირად ნორმალურია — არა აუცილებლად შეცდომა.</p><p class="muted">უცნობი: ${missing.map(esc).join(' · ')}</p></div>`;
        html = html.replace(
          /<section class="inv-section"><h4>ტელემეტრია<\/h4>/,
          `${box}<section class="inv-section"><h4>ტელემეტრია</h4>`,
        );
      }
      html = html.replace(
        /(<div class="user-pane[^"]*" data-user-pane="notifications">)/,
        `$1<div class="v3-title-row" style="margin:4px 0 10px"><strong>შეტყობინებები</strong>${V3().infoButton ? V3().infoButton('users.notifications', 'შეტყობინებების ახსნა') : ''}</div>`,
      );
      // Fix account status wording in overview
      html = html.replaceAll('>აქტიური</strong>', '>შესვლა დაშვებულია</strong>');
      html = html.replaceAll(
        'აქტიური — შეუძლია შესვლა',
        'შესვლა დაშვებულია',
      );
      html = html.replaceAll(
        'დაბლოკილი — შესვლა აკრძალულია',
        'დაბლოკილი',
      );
      return html;
    };
  }

  global.renderUsers = renderUsersV3;
  global.renderUserPage = renderUserPageV3;
  // Keep status cell honest if legacy paint still used
  global.usersStatusCell = accountStatusCell;
})(window);
