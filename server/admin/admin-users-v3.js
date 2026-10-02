/**
 * MediCard Admin — users registry (#/users) and the user profile (#/users/:id).
 * Loaded after admin.js and overrides renderUsers / renderUserPage. The profile's tabs are rendered by
 * renderUserInvestigationTabs() in admin.js.
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
  const ico = (name) => (typeof icon === 'function' ? icon(name) : '');
  const when = (value, mode = 'datetime') => (V3().formatDate ? V3().formatDate(value, mode) : String(value || '—'));
  const relative = (value) => (typeof fmtRelative === 'function' ? fmtRelative(value) : when(value));

  function fmtKa(n) {
    if (n == null) return '—';
    return Number(n).toLocaleString('ka-GE');
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

  function accountStatusBadge(status) {
    return `<span class="s-badge ${status === 'BLOCKED' ? 'is-bad' : 'is-ok'}">${accountStatusLabel(status)}</span>`;
  }

  function setUsersHeader(title, subtitle, helpKey) {
    if (typeof setPageHeader === 'function') setPageHeader('users', { users: ['ადამიანები', title, subtitle, helpKey] });
  }

  function usersFilterParamsFromHash() {
    const hs = typeof hashSearch === 'function' ? hashSearch() : new URLSearchParams();
    return {
      q: hs.get('q') || '',
      status: hs.get('status') || '',
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
      activity: $('user-activity')?.value || '',
      appVersion: hashSearch().get('appVersion') || '',
      page: Math.floor((state.offset || 0) / PAGE) + 1,
    };
  }

  /** Every value of the server's `activity` filter, grouped the way people think about them. */
  const ACTIVITY_GROUPS = [
    ['აქტივობა', [['today', 'აპში დღეს'], ['inactive7', '7+ დღე არ შემოსულა'], ['inactive30', '30+ დღე არ შემოსულა']]],
    ['მოდული', [['medi', 'Medi'], ['meds', 'მედიკამენტები'], ['cycle', 'ციკლი']]],
    ['აპი', [['ios', 'iOS'], ['android', 'Android'], ['notif_disabled', 'შეტყობინებები გამორთულია'], ['outdated', 'ძველი ვერსია']]],
    ['გადასახედი', [['under18', '18 წლამდე']]],
  ];
  const ACTIVITY_LABELS = Object.fromEntries(ACTIVITY_GROUPS.flatMap(([, items]) => items));

  function activityLabelKa(key) {
    return ACTIVITY_LABELS[key] || key;
  }

  function activeFilterChips(f) {
    const chips = [];
    if (f.q) chips.push(['q', `ძებნა: „${f.q}“`]);
    if (f.status) chips.push(['status', f.status === 'ACTIVE' || f.status === 'BLOCKED' ? accountStatusLabel(f.status) : f.status]);
    if (f.activity) chips.push(['activity', activityLabelKa(f.activity)]);
    if (f.appVersion) chips.push(['appVersion', `აპის ვერსია ${f.appVersion}`]);
    return chips;
  }

  /** Last app use → relative words plus a tone for the dot: today, this week, this month, older. */
  function activityState(value) {
    const at = value ? new Date(value).getTime() : NaN;
    if (!Number.isFinite(at)) return { label: 'არასდროს', tone: 'none', title: 'აპში ჯერ არ შემოსულა' };
    const days = (Date.now() - at) / 86400000;
    const tone = days < 1 ? 'live' : days < 7 ? 'ok' : days < 30 ? 'warn' : 'idle';
    return { label: relative(value), tone, title: when(value) };
  }

  function featureBadges(user) {
    const counts = user.counts || {};
    const bits = [];
    if (counts.chats > 0) bits.push('<span class="s-badge is-plain">Medi</span>');
    if (counts.medications > 0) bits.push('<span class="s-badge is-plain">მედიკამენტები</span>');
    if (user.hasCycle) bits.push('<span class="s-badge is-plain">ციკლი</span>');
    if (user.notificationPermission === 'denied' || user.notificationPermission === 'disabled') {
      bits.push('<span class="s-badge is-warn is-plain">შეტყობინებები გამორთულია</span>');
    }
    return bits.length ? `<span class="s-users-feats">${bits.join('')}</span>` : '';
  }

  /** Phone and Apple sign-ups log in with a synthetic …@phone/@apple.medicard.ge address: show the real contact once. */
  function contactLine(user) {
    const email = String(user.email || '');
    const synthetic = /@(phone|apple)\.medicard\.ge$/i.test(email);
    const shown = synthetic ? (typeof aiContact === 'function' ? aiContact(user) : '') : email;
    const digits = (v) => String(v).replace(/\D/g, '');
    const seen = new Map();
    [shown, user.phone].filter(Boolean).forEach((p) => { if (!seen.has(digits(p) || p)) seen.set(digits(p) || p, p); });
    return [...seen.values()].join(' · ');
  }

  function personInitials(user) {
    return typeof initials === 'function' ? initials(user.fullName || user.email) : '?';
  }

  function userRow(u) {
    const act = activityState(u.lastActiveAt);
    const blocked = u.status === 'BLOCKED';
    const platform = (typeof platformKa === 'function' && platformKa(u.platform)) || '';
    const contact = contactLine(u);
    return `
      <tr class="is-click${blocked ? ' is-blocked' : ''}" data-id="${escA(u.id)}" tabindex="0">
        <td>
          <div class="s-users-person">
            <span class="s-avatar${blocked ? ' is-muted' : ''}" aria-hidden="true">${esc(personInitials(u))}</span>
            <span class="s-users-name">
              <b>${esc(u.fullName || contactLine(u) || '—')}</b>
              <small>${esc(contact || 'კონტაქტი არ არის')}</small>
              <code>${esc(String(u.id).slice(0, 8))}…</code>
              ${blocked ? '<span class="s-badge is-bad s-users-narrow">დაბლოკილი</span>' : ''}
            </span>
          </div>
        </td>
        <td>${blocked ? accountStatusBadge('BLOCKED') : '<span class="s-users-ok">დაშვებულია</span>'}</td>
        <td>
          <div class="s-users-act">
            <span class="s-users-when is-${act.tone}" title="${escA(act.title)}"><i aria-hidden="true"></i>${esc(act.label)}</span>
            ${featureBadges(u)}
          </div>
        </td>
        <td><span class="s-users-app">${platform ? esc(platform) : '<span class="s-muted">—</span>'}<small>${u.appVersion ? esc(u.appVersion) : 'ვერსია უცნობია'}</small></span></td>
        <td class="s-users-date" title="${escA(when(u.createdAt, 'tz'))}">${esc(when(u.createdAt))}</td>
        <td class="s-users-go" aria-hidden="true">${ico('arrow')}</td>
      </tr>`;
  }

  async function renderUsersV3() {
    const userId = typeof userIdFromHash === 'function' ? userIdFromHash() : null;
    if (userId) {
      await renderUserPageV3(userId, { profileTab: hashSearch().get('profileTab') });
      return;
    }
    state.userPageId = null;
    const root = $('tab-users');
    if (!root) return;
    const initial = usersFilterParamsFromHash();
    state.offset = (initial.page - 1) * PAGE;

    const V = V3();
    setUsersHeader('მომხმარებლები', 'ყველა ანგარიში: ძებნა, ფილტრები და პროფილის გამოძიება.', 'users.registry');
    V.setHeaderActions?.(`
      <button type="button" class="btn ghost compact" id="user-reload">${ico('refresh')} განახლება</button>
      <button type="button" class="btn compact" id="user-csv">${ico('download')} CSV</button>
    `);

    const chip = (val, label) => `<button type="button" class="s-users-chip" data-activity-chip="${escA(val)}" aria-pressed="${(initial.activity || '') === val}">${esc(label)}</button>`;

    root.innerHTML = `
      <div class="s-stack v3-tab-shell s-users">
        <div class="s-metrics" id="users-kpis" aria-label="რეესტრის მაჩვენებლები">
          <div class="s-metric"><span>სულ ანგარიში</span><strong id="users-kpi-total">—</strong><small>მთელი ბაზა</small></div>
          <div class="s-metric"><span>შესვლა დაშვებულია</span><strong id="users-kpi-active">—</strong><small>აქტიური ანგარიში</small></div>
          <div class="s-metric"><span>დაბლოკილი</span><strong id="users-kpi-blocked">—</strong><small>აპში ვერ შედის</small></div>
          <div class="s-metric"><span>ახალი · 7 დღე</span><strong id="users-kpi-week">—</strong><small id="users-kpi-today-hint">დღეს —</small></div>
        </div>

        <section class="s-card s-users-board">
          <header class="s-card-head">
            <div>
              <h3 class="s-users-title">რეესტრი ${V.infoButton ? V.infoButton('users.table') : ''}</h3>
              <p>ახალი ანგარიშები პირველად · გვერდზე ${PAGE}.</p>
            </div>
            <span id="user-meta" class="s-users-meta" aria-live="polite">იტვირთება…</span>
          </header>

          <div class="s-users-controls">
            <div class="s-users-bar">
              <label class="s-users-search">
                <span class="sr-only">ძებნა</span>
                ${ico('search')}
                <input id="user-q" type="search" placeholder="სახელი, ელ-ფოსტა, ტელეფონი ან ID…" value="${escA(initial.q)}" autocomplete="off" />
                <button type="button" id="user-q-clear" class="s-users-clear${initial.q ? '' : ' hidden'}" aria-label="ძებნის გასუფთავება">${ico('x')}</button>
              </label>
              <div class="s-segment" id="users-status-chips" role="tablist" aria-label="ანგარიშის სტატუსი">
                <button type="button" role="tab" data-status-chip="" aria-selected="${!initial.status}">ყველა</button>
                <button type="button" role="tab" data-status-chip="ACTIVE" aria-selected="${initial.status === 'ACTIVE'}">შესვლა დაშვებულია</button>
                <button type="button" role="tab" data-status-chip="BLOCKED" aria-selected="${initial.status === 'BLOCKED'}">დაბლოკილი</button>
              </div>
            </div>

            <div class="s-users-facets" role="group" aria-label="ფილტრი აპის გამოყენებით">
              ${chip('', 'ყველა')}
              ${ACTIVITY_GROUPS.map(([group, items]) => `
                <span class="s-users-group"><span class="s-users-group-label">${esc(group)}</span>${items.map(([val, label]) => chip(val, label)).join('')}</span>
              `).join('')}
              ${V.infoButton ? V.infoButton('users.activityFilter', 'ფილტრის ახსნა') : ''}
            </div>

            <div id="users-filter-summary" class="s-users-active" hidden></div>
          </div>

          <select id="user-status" class="sr-only" aria-hidden="true" tabindex="-1">
            <option value=""></option><option value="ACTIVE"${initial.status === 'ACTIVE' ? ' selected' : ''}></option><option value="BLOCKED"${initial.status === 'BLOCKED' ? ' selected' : ''}></option>
          </select>
          <select id="user-activity" class="sr-only" aria-hidden="true" tabindex="-1">
            <option value=""></option>
            ${Object.keys(ACTIVITY_LABELS).map((val) => `<option value="${escA(val)}"${(initial.activity || '') === val ? ' selected' : ''}></option>`).join('')}
          </select>

          <div class="s-table-wrap" id="users-table-wrap">
            <table class="s-table s-users-table" aria-label="მომხმარებლების რეესტრი">
              <thead>
                <tr>
                  <th scope="col">ადამიანი</th>
                  <th scope="col">ანგარიში</th>
                  <th scope="col">ბოლო აქტივობა</th>
                  <th scope="col">აპი</th>
                  <th scope="col" aria-sort="descending">რეგისტრაცია ${ico('arrow')}</th>
                  <th scope="col" class="s-users-go"><span class="sr-only">გახსნა</span></th>
                </tr>
              </thead>
              <tbody id="users-tbody"><tr><td colspan="6"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></td></tr></tbody>
            </table>
          </div>

          <div class="s-pager">
            <span id="page-ind">0 / 0</span>
            <div class="s-users-pager-nav">
              <button class="btn ghost compact" id="prev-page" type="button">${ico('chevronLeft')} წინა</button>
              <span id="user-pager-pages" class="s-users-pages"></span>
              <button class="btn ghost compact" id="next-page" type="button">შემდეგი ${ico('arrow')}</button>
            </div>
          </div>
        </section>
      </div>`;

    const syncChipUi = () => {
      const f = readFiltersFromUi();
      document.querySelectorAll('[data-status-chip]').forEach((btn) => {
        btn.setAttribute('aria-selected', String((btn.dataset.statusChip || '') === (f.status || '')));
      });
      document.querySelectorAll('[data-activity-chip]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String((btn.dataset.activityChip || '') === (f.activity || '')));
      });
    };

    const paintSummary = () => {
      const f = readFiltersFromUi();
      const chips = activeFilterChips(f);
      const host = $('users-filter-summary');
      if (!host) return;
      host.hidden = !chips.length;
      host.innerHTML = chips.length
        ? `<span class="s-users-active-count">${chips.length === 1 ? 'ფილტრი' : `${chips.length} ფილტრი`}</span>
          ${chips.map(([key, label]) => `<button type="button" class="s-users-active-chip" data-clear-filter="${escA(key)}" title="ფილტრის მოხსნა">${esc(label)}${ico('x')}</button>`).join('')}
          <button type="button" id="user-clear-filters" class="btn ghost compact">ყველას გასუფთავება</button>`
        : '';
      host.querySelectorAll('[data-clear-filter]').forEach((btn) => btn.addEventListener('click', () => clearOne(btn.dataset.clearFilter)));
      $('user-clear-filters')?.addEventListener('click', clearAll);
      syncChipUi();
    };

    const paintPagerPages = () => {
      const wrap = $('user-pager-pages');
      if (!wrap) return;
      const totalPages = Math.max(1, Math.ceil((state.total || 0) / PAGE));
      const current = Math.floor((state.offset || 0) / PAGE) + 1;
      if (!state.total || totalPages <= 1) {
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
        ? '<span class="s-users-gap" aria-hidden="true">…</span>'
        : `<button type="button" class="s-users-page" data-page="${p}"${p === current ? ' aria-current="page"' : ''}>${p}</button>`
      )).join('');
      wrap.querySelectorAll('[data-page]').forEach((btn) => {
        btn.onclick = () => {
          state.offset = (Number(btn.dataset.page) - 1) * PAGE;
          load();
        };
      });
    };

    const paintKpis = (kpis) => {
      if (!kpis) return;
      const set = (id, val) => { const el = $(id); if (el) el.textContent = fmtKa(val); };
      set('users-kpi-total', kpis.total);
      set('users-kpi-active', kpis.active);
      set('users-kpi-blocked', kpis.blocked);
      set('users-kpi-week', kpis.newWeek);
      const hint = $('users-kpi-today-hint');
      if (hint) hint.textContent = `დღეს ${fmtKa(kpis.newToday)}`;
    };

    const load = async () => {
      // Live refreshes call this through window.__reloadUsers; on a profile page the list is gone.
      if (!$('users-tbody')) return;
      const f = readFiltersFromUi();
      writeUsersHash(f);
      paintSummary();
      const wrap = $('users-table-wrap');
      const body = $('users-tbody');
      wrap?.setAttribute('aria-busy', 'true');
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(state.offset) });
      if (f.q) params.set('q', f.q);
      if (f.status) params.set('status', f.status);
      if (f.activity) params.set('activity', f.activity);
      if (f.appVersion) params.set('appVersion', f.appVersion);
      try {
        const data = await api(`/users?${params.toString()}`);
        state.users = data.users;
        state.total = data.total;
        paintKpis(data.kpis);
        paintTable();
      } catch (err) {
        if (body && $('users-tbody') === body) {
          body.innerHTML = `<tr><td colspan="6"><div class="s-empty" role="alert">${ico('alert')}<strong>რეესტრი ვერ ჩაიტვირთა</strong><span>სერვერმა პასუხი ვერ დააბრუნა — სცადე ხელახლა.</span>${err.message ? `<small>${esc(err.message)}</small>` : ''}<button type="button" class="btn compact" id="users-retry">ხელახლა ცდა</button></div></td></tr>`;
          $('users-retry')?.addEventListener('click', load);
          if ($('user-meta')) $('user-meta').textContent = '';
          if ($('prev-page')) $('prev-page').disabled = true;
          if ($('next-page')) $('next-page').disabled = true;
        }
      } finally {
        wrap?.removeAttribute('aria-busy');
      }
    };

    const paintTable = () => {
      const rows = state.users || [];
      const from = state.total ? state.offset + 1 : 0;
      const to = state.total ? Math.min(state.offset + PAGE, state.total) : 0;
      const filtered = activeFilterChips(readFiltersFromUi()).length > 0;
      const metaEl = $('user-meta');
      const pageEl = $('page-ind');
      // Guard: list paint can finish after navigating to #/users/:id
      if (!metaEl || !pageEl || !$('users-tbody')) return;
      metaEl.textContent = state.total
        ? `${fmtKa(state.total)} ანგარიში${filtered ? ' ფილტრით' : ''}`
        : (filtered ? 'ფილტრს არაფერი ემთხვევა' : 'ჩანაწერი არ არის');
      pageEl.textContent = state.total ? `${fmtKa(from)}–${fmtKa(to)} / ${fmtKa(state.total)}` : '0 / 0';
      if ($('prev-page')) $('prev-page').disabled = state.offset === 0;
      if ($('next-page')) $('next-page').disabled = state.offset + PAGE >= state.total;
      paintPagerPages();

      const body = $('users-tbody');
      if (!rows.length) {
        body.innerHTML = `<tr><td colspan="6"><div class="s-empty">${ico('users')}
          <strong>${filtered ? 'ფილტრს არაფერი ემთხვევა' : 'მომხმარებლები ჯერ არ არის'}</strong>
          <span>${filtered ? 'შეცვალე ძებნა ან მოხსენი ფილტრები.' : 'პირველი ანგარიში რეგისტრაციისთანავე აქ გამოჩნდება.'}</span>
          ${filtered ? '<button type="button" class="btn compact" id="users-empty-clear">ფილტრების გასუფთავება</button>' : ''}
        </div></td></tr>`;
        $('users-empty-clear')?.addEventListener('click', clearAll);
        return;
      }
      body.innerHTML = rows.map(userRow).join('');
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
      $('user-q-clear')?.classList.add('hidden');
      if ($('user-status')) $('user-status').value = '';
      if ($('user-activity')) $('user-activity').value = '';
      state.offset = 0;
      writeUsersHash({ q: '', status: '', activity: '', appVersion: '', page: 1 });
      load();
    };

    const clearOne = (key) => {
      if (key === 'q') {
        if ($('user-q')) $('user-q').value = '';
        $('user-q-clear')?.classList.add('hidden');
      }
      if (key === 'status' && $('user-status')) $('user-status').value = '';
      if (key === 'activity' && $('user-activity')) $('user-activity').value = '';
      state.offset = 0;
      if (key === 'appVersion') writeUsersHash({ ...readFiltersFromUi(), appVersion: '', page: 1 });
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
      $('user-q-clear').classList.add('hidden');
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
    document.querySelectorAll('[data-activity-chip]').forEach((btn) => {
      btn.addEventListener('click', () => setSelectAndLoad('user-activity', btn.dataset.activityChip));
    });

    $('user-reload').onclick = load;
    window.__reloadUsers = load;
    $('prev-page').onclick = () => { state.offset = Math.max(0, state.offset - PAGE); load(); };
    $('next-page').onclick = () => {
      if (state.offset + PAGE < state.total) { state.offset += PAGE; load(); }
    };
    $('user-csv').onclick = async () => {
      const f = readFiltersFromUi();
      const params = new URLSearchParams();
      if (f.q) params.set('q', f.q);
      if (f.status) params.set('status', f.status);
      if (f.activity) params.set('activity', f.activity);
      if (f.appVersion) params.set('appVersion', f.appVersion);
      if (typeof opsDownload !== 'function') {
        toast('CSV ექსპორტი მიუწვდომელია', 'warn');
        return;
      }
      const btn = $('user-csv');
      btn?.classList.add('is-loading');
      try {
        await opsDownload(`/export/users?${params.toString()}`, 'users.csv');
      } catch {
        toast('CSV ფაილი ვერ ჩამოიტვირთა. სცადე ხელახლა.', 'bad');
      } finally {
        btn?.classList.remove('is-loading');
      }
    };
    await load();
  }

  /* ─────────────── Profile ─────────────── */

  function renderProfileError(root, id, err, backHref) {
    const missing = err?.status === 404;
    setUsersHeader(missing ? 'მომხმარებელი ვერ მოიძებნა' : 'პროფილი ვერ ჩაიტვირთა', '', 'users.investigation');
    root.innerHTML = `
      <div class="v3-user-page s-user s-stack">
        <div class="s-user-nav"><a class="btn ghost compact" id="user-page-back" href="${escA(backHref)}">${ico('chevronLeft')} რეესტრი</a></div>
        <section class="s-card">
          <div class="s-empty" role="alert">
            ${ico('alert')}
            <strong>${missing ? 'ეს ანგარიში ვერ მოიძებნა' : 'პროფილი ვერ ჩაიტვირთა'}</strong>
            <span>${missing ? 'შესაძლოა წაიშალა ან ბმული არასწორია. მოძებნე ადამიანი რეესტრში.' : 'სერვერმა პასუხი ვერ დააბრუნა. სცადე ხელახლა.'}</span>
            ${!missing && err?.message ? `<small>${esc(err.message)}</small>` : ''}
            <div class="s-user-err-actions">
              <button type="button" class="btn ${missing ? 'ghost ' : ''}compact" id="user-retry">${ico('refresh')} ხელახლა ცდა</button>
              <a class="btn ${missing ? '' : 'ghost '}compact" href="${escA(backHref)}">რეესტრში დაბრუნება</a>
            </div>
          </div>
        </section>
      </div>`;
    $('user-retry')?.addEventListener('click', () => renderUserPageV3(id, { profileTab: hashSearch().get('profileTab') }));
  }

  async function renderUserPageV3(id, opts = {}) {
    const root = $('tab-users');
    if (!root) return;
    state.selectedId = id;
    state.userPageId = id;
    state.tab = 'users';
    const V = V3();
    const backHref = typeof usersListHref === 'function' ? usersListHref() : '#/users';
    setUsersHeader('პროფილი იტვირთება…', '', 'users.investigation');
    V.setHeaderActions?.('');
    root.innerHTML = `<div class="v3-user-page s-user s-stack"><section class="s-card s-user-loading" aria-busy="true"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(5)}</div><span class="sr-only">პროფილი იტვირთება…</span></section></div>`;

    let user;
    let profileExtra;
    try {
      const rangeQs = typeof opsQs === 'function' ? opsQs() : 'range=30d';
      const data = await api(`/users/${id}?${rangeQs}`);
      user = data.user;
      profileExtra = data;
    } catch (err) {
      if (state.userPageId === id) renderProfileError(root, id, err, backHref);
      return;
    }
    // The admin may have gone back to the list (or to another profile) while this one loaded.
    if (state.userPageId !== id) return;

    const period = typeof userRangeLabel === 'function' ? userRangeLabel() : '';
    const name = user.fullName || user.email || 'მომხმარებელი';
    setUsersHeader(name, `მომხმარებლის პროფილი · მონაცემები: ${period}`, 'users.investigation');
    V.setHeaderActions?.(`<button type="button" class="btn ghost compact" id="user-header-reload">${ico('refresh')} განახლება</button>`);

    const ov = profileExtra.investigation?.overview || {};
    const usageMap = profileExtra.investigation?.productUsage || {};
    const notes = profileExtra.investigation?.notifications || profileExtra.notifications || {};
    const featureKeys = Object.keys(typeof FEATURE_USAGE_LABELS === 'object' ? FEATURE_USAGE_LABELS : {});
    const featUsed = featureKeys.filter((key) => usageMap[key]?.available !== false && usageMap[key]?.used).length;
    const featUnknown = featureKeys.filter((key) => !Object.hasOwn(usageMap, key) || usageMap[key]?.available === false).length;
    const featTotal = featureKeys.length || 8;
    const lastActiveAt = profileExtra.activity?.lastActiveAt || ov.lastActiveAt || null;
    const platform = (typeof platformKa === 'function'
      ? platformKa(profileExtra.activity?.platform || ov.platform || user.platform)
      : null) || '';
    const appVer = profileExtra.activity?.appVersion || ov.appVersion || user.appVersion || '';
    const perm = ov.notificationPermission || notes.permission || user.notificationPermission;
    const freq = ov.selectedFrequency || notes.preference?.selectedFrequency;
    const medi = usageMap.medi || {};
    const mediPeriod = medi.available === false ? null : (medi.periodCount ?? 0);
    const mediTotal = ov.medi?.requests;
    const blocked = user.status === 'BLOCKED';
    const contact = contactLine(user);
    const place = typeof adminPlaceOf === 'function' ? adminPlaceOf(ov.location) : { line: '', flag: '' };
    const genderAge = [
      user.gender && typeof genderKa === 'function' ? genderKa(user.gender) : null,
      user.age != null ? `${user.age} წლის` : null,
    ].filter(Boolean).join(' · ');

    const hero = `
      <section class="s-card v3-user-hero s-user-hero${blocked ? ' is-blocked' : ''}">
        <span class="s-avatar s-user-avatar${blocked ? ' is-muted' : ''}" aria-hidden="true">${esc(personInitials(user))}</span>
        <div class="s-user-ident">
          <div class="s-user-title"><h2>${esc(name)}</h2>${accountStatusBadge(user.status)}</div>
          <p class="s-user-contact">${esc(contact || 'კონტაქტი არ არის მითითებული')}</p>
          <ul class="s-user-meta">
            <li><button type="button" class="s-user-idchip" data-copy="${escA(user.id)}" data-copy-label="მომხმარებლის ID" title="${escA(user.id)} — დააჭირე კოპირებისთვის" aria-label="მომხმარებლის ID-ის კოპირება">${ico('copy')}<code>${esc(String(user.id).slice(0, 8))}…</code></button></li>
            <li>${place.line ? `${place.flag || ico('globe')}<span>${esc(place.line)}</span>` : `${ico('globe')}<span>ადგილი უცნობია</span>`}</li>
            <li>${ico('calendar')}<span>რეგისტრაცია: ${esc(when(user.createdAt, 'date'))}</span></li>
            <li>${ico('user')}<span>${esc(genderAge || 'სქესი და ასაკი უცნობია')}</span></li>
          </ul>
        </div>
      </section>`;

    const callouts = [
      blocked
        ? `<div class="s-callout is-bad" role="status">${ico('lock')}<div><p><b>ანგარიში დაბლოკილია</b> — ადამიანი აპში ვერ შედის. აღსადგენად შეცვალე „ანგარიშის სტატუსი“ და შეინახე.</p>${user.adminNote ? `<p>შენიშვნა: ${esc(user.adminNote)}</p>` : ''}</div></div>`
        : '',
      user.age != null && user.age < 18
        ? `<div class="s-callout is-warn">${ico('alert')}<p><b>${esc(user.age)} წლის</b> — ანგარიში 18+ წესამდე შეიქმნა და შენს განხილვას ელოდება.</p></div>`
        : '',
    ].join('');

    const kpis = `
      <div class="s-metrics s-user-kpis" aria-label="მთავარი მაჩვენებლები">
        <div class="s-metric">
          <span>ბოლო აქტივობა</span>
          <strong>${esc(lastActiveAt ? relative(lastActiveAt) : 'არასდროს')}</strong>
          <small>${esc(lastActiveAt ? [when(lastActiveAt), [platform, appVer].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : 'აპში ჯერ არ შემოსულა')}</small>
        </div>
        <div class="s-metric">
          <span>Medi მოთხოვნები</span>
          <strong>${mediPeriod == null ? '—' : fmtKa(mediPeriod)}</strong>
          <small>${esc(period)}${mediTotal != null ? ` · სულ ${fmtKa(mediTotal)}` : ''} · ${fmtKa(user.counts?.chats ?? 0)} საუბარი</small>
        </div>
        <div class="s-metric">
          <span>მედიკამენტები</span>
          <strong>${fmtKa(user.counts?.medications ?? 0)}</strong>
          <small>ანგარიშში შენახული</small>
        </div>
        <div class="s-metric">
          <span>გამოყენებული მოდული</span>
          <strong>${fmtKa(featUsed)}<em class="s-user-den"> / ${fmtKa(featTotal)}</em></strong>
          <small>${featUnknown ? `${fmtKa(featUnknown)} მოდულზე მონაცემი არ არის` : 'ყველა დროის მანძილზე'}</small>
        </div>
        <div class="s-metric${perm === 'disabled' ? ' is-warn' : ''}">
          <span>შეტყობინებები</span>
          <strong>${esc(typeof permKa === 'function' ? permKa(perm) : (perm || '—'))}</strong>
          <small>სიხშირე: ${esc(typeof freqKa === 'function' ? freqKa(freq) : (freq || '—'))}</small>
        </div>
      </div>`;

    const opt = (value, label, current) => `<option value="${value}"${current === value ? ' selected' : ''}>${label}</option>`;
    const editCard = `
      <section class="s-card s-user-edit" aria-labelledby="user-edit-title">
        <header class="s-card-head">
          <div>
            <h3 id="user-edit-title" class="s-user-h3">ანგარიშის რედაქტირება ${V.infoButton ? V.infoButton('users.accountStatus') : ''}</h3>
            <p>ცვლილების შემდეგ ქვემოთ გამოჩნდება შენახვის ზოლი.</p>
          </div>
        </header>
        <div class="s-card-body">
          <div class="s-user-form" id="user-edit-form">
            <label class="s-field" for="edit-name"><span>სახელი</span><input id="edit-name" value="${escA(user.fullName || '')}" autocomplete="off" /></label>
            <label class="s-field" for="edit-email"><span>ელ-ფოსტა</span><input id="edit-email" type="email" value="${escA(user.email || '')}" autocomplete="off" /></label>
            <label class="s-field" for="edit-phone"><span>ტელეფონი</span><input id="edit-phone" type="tel" value="${escA(user.phone || '')}" placeholder="—" autocomplete="off" /></label>
            <label class="s-field" for="edit-gender"><span>სქესი</span>
              <select id="edit-gender">
                ${opt('', 'არ არის მითითებული', user.gender || '')}
                ${opt('MALE', 'მამრობითი', user.gender)}
                ${opt('FEMALE', 'მდედრობითი', user.gender)}
                ${opt('OTHER', 'სხვა', user.gender)}
              </select>
              <small>ციკლის მოდული მხოლოდ მდედრობითზე ჩანს.</small>
            </label>
            <label class="s-field" for="edit-status"><span>ანგარიშის სტატუსი</span>
              <select id="edit-status">
                ${opt('ACTIVE', 'შესვლა დაშვებულია', user.status)}
                ${opt('BLOCKED', 'დაბლოკილი', user.status)}
              </select>
              <small>„დაბლოკილი“ — ადამიანი აპში ვერ შედის. ეს არ არის აპის აქტივობა.</small>
            </label>
            <label class="s-field" for="edit-note"><span>ადმინის შენიშვნა</span>
              <textarea id="edit-note" rows="3">${esc(user.adminNote || '')}</textarea>
              <small>ჩანს მხოლოდ ადმინებს.</small>
            </label>
          </div>
        </div>
        <div class="s-user-danger">
          <div><b>ანგარიშის წაშლა</b><small>შეუქცევადია: იშლება პროფილი და ყველა დაკავშირებული მონაცემი.</small></div>
          <button class="btn danger compact" id="user-del" type="button">${ico('trash')} წაშლა</button>
        </div>
      </section>`;

    const tabsHtml = typeof renderUserInvestigationTabs === 'function'
      ? renderUserInvestigationTabs(user, profileExtra, '', false, opts.profileTab || 'overview')
      : '';

    const sticky = V.stickyActions
      ? V.stickyActions({
        dirty: false,
        cancel: `<button type="button" class="btn ghost" id="user-cancel-nav">${ico('chevronLeft')} უკან</button>`,
        save: `<button type="button" class="btn primary" id="user-save">${ico('check')} შენახვა</button>`,
        danger: '',
      }).replace('class="v3-sticky-actions', 'class="v3-sticky-actions v3-user-sticky')
      : '<footer class="user-actions"><button class="btn primary" id="user-save">შენახვა</button></footer>';

    root.innerHTML = `
      <div class="v3-user-page s-user s-stack">
        <div class="s-user-nav">
          <a class="btn ghost compact" id="user-page-back" href="${escA(backHref)}">${ico('chevronLeft')} რეესტრი</a>
        </div>
        ${hero}
        ${callouts}
        ${kpis}
        <div class="s-user-layout">
          <section class="s-card v3-user-board s-user-board" id="user-inv-host" aria-label="პროფილის დეტალები">${tabsHtml}</section>
          <aside class="s-user-side">
            ${editCard}
            <div id="user-insights-host" class="s-insights-host"></div>
          </aside>
        </div>
        ${sticky}
      </div>`;

    if (typeof bindUserInvestigation === 'function') bindUserInvestigation(id);
    V.watchDirty?.(root.querySelector('#user-edit-form'));
    V.setDirty?.(false);
    global.AdminV4Manage?.mountUserInsights(id);

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

    $('user-save')?.addEventListener('click', async () => {
      const body = {
        fullName: $('edit-name')?.value.trim(),
        email: $('edit-email')?.value.trim(),
        phone: $('edit-phone')?.value.trim() || null,
        gender: $('edit-gender')?.value || null,
        status: $('edit-status')?.value,
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

  global.renderUsers = renderUsersV3;
  global.renderUserPage = renderUserPageV3;
  // Keep status cell honest if legacy paint still used
  global.usersStatusCell = accountStatusBadge;
})(window);
