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

  const GENDER_FILTER = [['', 'ყველა'], ['FEMALE', 'ქალი'], ['MALE', 'კაცი']];
  function usersFilterParamsFromHash() {
    const hs = typeof hashSearch === 'function' ? hashSearch() : new URLSearchParams();
    return {
      q: hs.get('q') || '',
      status: hs.get('status') || '',
      gender: hs.get('gender') || '',
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
    if (filters.gender) params.set('gender', filters.gender);
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
      gender: $('user-gender')?.value || '',
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
    if (f.gender) chips.push(['gender', f.gender === 'FEMALE' ? 'ქალები' : f.gender === 'MALE' ? 'კაცები' : 'სქესი: სხვა']);
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

  /** Registration number cell: #1 = first account; every hundredth (and #1) stands out. */
  function signupCell(n) {
    if (!n) return '<td class="s-users-no"><span class="s-muted">—</span></td>';
    const milestone = n === 1 || n % 100 === 0;
    return `<td class="s-users-no"><span class="s-users-no-pill${milestone ? ' is-milestone' : ''}" title="${escA(`${fmtKa(n)}-ე დარეგისტრირებული`)}">#${esc(fmtKa(n))}</span></td>`;
  }

  const COUNTRY_SOURCE_KA = { location: 'გაზიარებული მდებარეობით', phone: 'ტელეფონის კოდით', timezone: 'ტელეფონის საათის სარტყლით' };
  function countryTitle(c) {
    return [c.cityKa, c.nameKa].filter(Boolean).join(', ') + (COUNTRY_SOURCE_KA[c.source] ? ` · ${COUNTRY_SOURCE_KA[c.source]}` : '');
  }

  function userRow(u) {
    const act = activityState(u.lastActiveAt);
    const blocked = u.status === 'BLOCKED';
    const platform = (typeof platformKa === 'function' && platformKa(u.platform)) || '';
    const contact = contactLine(u);
    return `
      <tr class="is-click${blocked ? ' is-blocked' : ''}" data-id="${escA(u.id)}" tabindex="0">
        ${signupCell(u.signupNo)}
        <td>
          <div class="s-users-person">
            <span class="s-avatar s-users-ava${blocked ? ' is-muted' : ''}${u.gender === 'FEMALE' ? ' is-f' : ''}" aria-hidden="true">${esc(personInitials(u))}${typeof adminAvatarImg === 'function' ? adminAvatarImg(u) : ''}${u.country?.code && typeof adminFlagImg === 'function' ? `<span class="s-users-flag" title="${escA(countryTitle(u.country))}">${adminFlagImg(u.country.code)}</span>` : ''}</span>
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
          <div class="s-metric s-users-gender" id="users-kpi-gender"><span>ქალი და კაცი</span><strong>—</strong><small>მთელი ბაზა</small></div>
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
                <input id="user-q" type="search" placeholder="სახელი, ელ-ფოსტა, ტელეფონი, ID ან #100…" value="${escA(initial.q)}" autocomplete="off" />
                <button type="button" id="user-q-clear" class="s-users-clear${initial.q ? '' : ' hidden'}" aria-label="ძებნის გასუფთავება">${ico('x')}</button>
              </label>
              <div class="s-segment" id="users-status-chips" role="tablist" aria-label="ანგარიშის სტატუსი">
                <button type="button" role="tab" data-status-chip="" aria-selected="${!initial.status}">ყველა</button>
                <button type="button" role="tab" data-status-chip="ACTIVE" aria-selected="${initial.status === 'ACTIVE'}">შესვლა დაშვებულია</button>
                <button type="button" role="tab" data-status-chip="BLOCKED" aria-selected="${initial.status === 'BLOCKED'}">დაბლოკილი</button>
              </div>
              <div class="s-segment s-users-gender-seg" id="users-gender-chips" role="tablist" aria-label="სქესი">
                ${GENDER_FILTER.map(([v, l]) => `<button type="button" role="tab" data-gender-chip="${v}" aria-selected="${(initial.gender || '') === v}">${v ? `<i class="s-users-gdot is-${v === 'FEMALE' ? 'f' : 'm'}" aria-hidden="true"></i>` : ''}${l}</button>`).join('')}
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
          <select id="user-gender" class="sr-only" aria-hidden="true" tabindex="-1">
            ${GENDER_FILTER.map(([v]) => `<option value="${v}"${(initial.gender || '') === v ? ' selected' : ''}></option>`).join('')}
          </select>
          <select id="user-activity" class="sr-only" aria-hidden="true" tabindex="-1">
            <option value=""></option>
            ${Object.keys(ACTIVITY_LABELS).map((val) => `<option value="${escA(val)}"${(initial.activity || '') === val ? ' selected' : ''}></option>`).join('')}
          </select>

          <div class="s-table-wrap" id="users-table-wrap">
            <table class="s-table s-users-table" aria-label="მომხმარებლების რეესტრი">
              <thead>
                <tr>
                  <th scope="col" class="s-users-no" title="რეგისტრაციის რიგითი ნომერი — #1 პირველი დარეგისტრირებულია">#</th>
                  <th scope="col">ადამიანი</th>
                  <th scope="col">ანგარიში</th>
                  <th scope="col">ბოლო აქტივობა</th>
                  <th scope="col">აპი</th>
                  <th scope="col" aria-sort="descending">რეგისტრაცია ${ico('arrow')}</th>
                  <th scope="col" class="s-users-go"><span class="sr-only">გახსნა</span></th>
                </tr>
              </thead>
              <tbody id="users-tbody"><tr><td colspan="7"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></td></tr></tbody>
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
      document.querySelectorAll('[data-gender-chip]').forEach((btn) => {
        btn.setAttribute('aria-selected', String((btn.dataset.genderChip || '') === (f.gender || '')));
      });
      document.querySelectorAll('[data-gender-pick]').forEach((el) => el.classList.toggle('is-on', el.dataset.genderPick === f.gender));
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
      const g = kpis.gender;
      const gHost = $('users-kpi-gender');
      if (g && gHost) {
        const female = Number(g.FEMALE) || 0;
        const male = Number(g.MALE) || 0;
        const rest = (Number(g.OTHER) || 0) + (Number(g.UNKNOWN) || 0);
        const all = female + male + rest || 1;
        const pct = (n) => Math.round((n / all) * 100);
        gHost.innerHTML = `<span>ქალი და კაცი</span>
          <div class="s-users-gender-row">
            <button type="button" class="is-f${$('user-gender')?.value === 'FEMALE' ? ' is-on' : ''}" data-gender-pick="FEMALE" title="მხოლოდ ქალების ჩვენება"><strong>${fmtKa(female)}</strong><small>ქალი · ${pct(female)}%</small></button>
            <button type="button" class="is-m${$('user-gender')?.value === 'MALE' ? ' is-on' : ''}" data-gender-pick="MALE" title="მხოლოდ კაცების ჩვენება"><strong>${fmtKa(male)}</strong><small>კაცი · ${pct(male)}%</small></button>
          </div>
          <div class="s-users-gender-bar" role="img" aria-label="ქალი ${female}, კაცი ${male}, სხვა ან უცნობი ${rest}"><i class="is-f" style="width:${(female / all) * 100}%"></i><i class="is-m" style="width:${(male / all) * 100}%"></i>${rest ? `<i class="is-o" style="width:${(rest / all) * 100}%"></i>` : ''}</div>
          <small>${rest ? `სხვა ან არ მიუთითებია: ${fmtKa(rest)}` : 'მთელი ბაზა'}</small>`;
      }
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
      if (f.gender) params.set('gender', f.gender);
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
          body.innerHTML = `<tr><td colspan="7"><div class="s-empty" role="alert">${ico('alert')}<strong>რეესტრი ვერ ჩაიტვირთა</strong><span>სერვერმა პასუხი ვერ დააბრუნა — სცადე ხელახლა.</span>${err.message ? `<small>${esc(err.message)}</small>` : ''}<button type="button" class="btn compact" id="users-retry">ხელახლა ცდა</button></div></td></tr>`;
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
        body.innerHTML = `<tr><td colspan="7"><div class="s-empty">${ico('users')}
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
      if ($('user-gender')) $('user-gender').value = '';
      if ($('user-activity')) $('user-activity').value = '';
      state.offset = 0;
      writeUsersHash({ q: '', status: '', gender: '', activity: '', appVersion: '', page: 1 });
      load();
    };

    const clearOne = (key) => {
      if (key === 'q') {
        if ($('user-q')) $('user-q').value = '';
        $('user-q-clear')?.classList.add('hidden');
      }
      if (key === 'status' && $('user-status')) $('user-status').value = '';
      if (key === 'gender' && $('user-gender')) $('user-gender').value = '';
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
    document.querySelectorAll('[data-gender-chip]').forEach((btn) => {
      btn.addEventListener('click', () => setSelectAndLoad('user-gender', btn.dataset.genderChip));
    });
    // The halves of the „ქალი და კაცი“ card filter too (a second click clears).
    $('users-kpi-gender')?.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-gender-pick]');
      if (!pick) return;
      setSelectAndLoad('user-gender', $('user-gender')?.value === pick.dataset.genderPick ? '' : pick.dataset.genderPick);
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
      if (f.gender) params.set('gender', f.gender);
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

  // Module tiles on the profile wear the module's colour (mobile theme/moduleBrand.ts).
  const FEATURE_TONE = {
    medi: '#0D9488', assistant: '#0D9488', consilium: '#0D9488', symptom_review: '#0D9488',
    lab: '#4F46E5', records: '#4F46E5', imaging: '#0891B2', skin: '#0891B2', skincare: '#0891B2',
    medirun: '#14B8A6', step_tracking: '#14B8A6', quest: '#7C3AED', pets: '#0284C7', medi_vet: '#0284C7',
    nutrition: '#059669', hydration: '#0EA5E9', weight: '#059669', medications: '#1D4ED8',
    cycle: '#E11D48', pregnancy: '#E11D48', community: '#DB2777', visits: '#64748B', weekly_report: '#64748B',
  };

  /** Edit form in a dialog (it used to fill the side column). */
  function openUserEditDialog(user, onSaved) {
    const V = V3();
    const opt = (value, label, current) => `<option value="${value}"${current === value ? ' selected' : ''}>${label}</option>`;
    const dialog = V.openDialog?.({
      title: 'ანგარიშის რედაქტირება',
      description: user.fullName || user.email || '',
      body: `<form id="user-edit-form" class="s-user-form" novalidate>
        <label class="s-field" for="edit-name"><span>სახელი</span><input id="edit-name" value="${escA(user.fullName || '')}" autocomplete="off" /></label>
        <div class="s-user-form-row">
          <label class="s-field" for="edit-email"><span>ელ-ფოსტა</span><input id="edit-email" type="email" value="${escA(user.email || '')}" autocomplete="off" /></label>
          <label class="s-field" for="edit-phone"><span>ტელეფონი</span><input id="edit-phone" type="tel" value="${escA(user.phone || '')}" placeholder="—" autocomplete="off" /></label>
        </div>
        <div class="s-user-form-row">
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
            <small>„დაბლოკილი“ — ადამიანი აპში ვერ შედის.</small>
          </label>
        </div>
        <label class="s-field" for="edit-note"><span>ადმინის შენიშვნა</span>
          <textarea id="edit-note" rows="3">${esc(user.adminNote || '')}</textarea>
          <small>ჩანს მხოლოდ ადმინებს.</small>
        </label>
      </form>`,
      footer: `<button type="button" class="btn ghost" data-cancel>გაუქმება</button>
        <button type="submit" class="btn primary" form="user-edit-form">${ico('check')} შენახვა</button>`,
    });
    const form = $('user-edit-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        fullName: $('edit-name').value.trim(),
        email: $('edit-email').value.trim(),
        phone: $('edit-phone').value.trim() || null,
        gender: $('edit-gender').value || null,
        status: $('edit-status').value,
        adminNote: $('edit-note').value.trim() || null,
      };
      const submit = panel.querySelector('[type=submit]');
      const out = await V.runMutation({
        action: () => api(`/users/${user.id}`, { method: 'PATCH', body }),
        pendingElement: submit,
        successMessage: 'პროფილი განახლდა',
      });
      if (!out?.ok) return;
      V.setDirty?.(false);
      await dialog.close();
      onSaved?.();
    };
  }

  /** Full-size look at the profile picture: dark scrim, the image, the name; click, × or Esc closes. */
  function openAvatarLightbox(src, title, caption) {
    document.querySelector('.s-ava-lightbox')?.remove();
    const box = document.createElement('div');
    box.className = 's-ava-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', title);
    box.innerHTML = `<figure><img src="${escA(src)}" alt="${escA(title)}"><figcaption><b>${esc(title)}</b><span>${esc(caption)}</span></figcaption></figure>
      <button type="button" class="s-ava-lightbox-x" aria-label="დახურვა">${ico('x')}</button>`;
    const prev = document.activeElement;
    const close = () => {
      box.classList.add('is-leaving');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => box.remove(), 160);
      prev?.focus?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    box.addEventListener('click', (e) => { if (!e.target.closest('img')) close(); });
    box.querySelector('.s-ava-lightbox-x').addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(box);
    box.querySelector('.s-ava-lightbox-x').focus();
  }

  /** Small action menu next to the hero buttons (export, block/unblock, delete). */
  function openUserMenu(anchor, items) {
    document.querySelector('.s-menu.s-user-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 's-menu s-user-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map((it) => (it === '-' ? '<div class="s-menu-sep"></div>'
      : `<button type="button" role="menuitem" class="${it.danger ? 'is-danger' : ''}" data-act="${escA(it.key)}">${ico(it.icon)}<span>${esc(it.label)}</span></button>`)).join('');
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 6)}px`;
    menu.style.left = `${Math.round(Math.max(12, r.right - 260))}px`;
    menu.style.transformOrigin = 'top right';
    const close = () => { menu.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', onKey, true); };
    const outside = (e) => { if (!menu.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); anchor.focus(); } };
    setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', onKey, true); }, 0);
    menu.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = () => { close(); items.find((it) => it.key === btn.dataset.act)?.run(); };
    });
    menu.querySelector('button')?.focus();
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

    const reload = () => renderUserPageV3(id, { profileTab: typeof currentUserProfileTab === 'function' ? currentUserProfileTab() : 'activity' });
    const period = typeof userRangeLabel === 'function' ? userRangeLabel() : '';
    const name = user.fullName || user.email || 'მომხმარებელი';
    setUsersHeader(name, `მომხმარებლის პროფილი · მონაცემები: ${period}`, 'users.investigation');
    V.setHeaderActions?.(`<button type="button" class="btn ghost compact" id="user-header-reload">${ico('refresh')} განახლება</button>`);

    const inv = profileExtra.investigation || {};
    const ov = inv.overview || {};
    const usageMap = inv.productUsage || {};
    const notes = inv.notifications || profileExtra.notifications || {};
    const timeline = inv.timeline || [];
    const devices = inv.devices || profileExtra.devices || [];
    const features = typeof userFeatureRows === 'function' ? userFeatureRows(usageMap) : [];
    const used = features.filter((f) => f.used).sort((a, b) => b.lastMs - a.lastMs);
    // Tiles only for what they used in this period (busiest first); earlier use folds into chips.
    const inPeriod = used.filter((f) => Number(f.periodCount) > 0).sort((a, b) => Number(b.periodCount) - Number(a.periodCount) || b.lastMs - a.lastMs);
    const earlier = used.filter((f) => !(Number(f.periodCount) > 0));
    const unused = features.filter((f) => f.available && !f.used);
    const lastActiveAt = profileExtra.activity?.lastActiveAt || ov.lastActiveAt || null;
    const platform = (typeof platformKa === 'function' ? platformKa(profileExtra.activity?.platform || ov.platform || user.platform) : null) || '';
    const appVer = profileExtra.activity?.appVersion || ov.appVersion || user.appVersion || '';
    const perm = ov.notificationPermission || notes.permission || user.notificationPermission;
    const freq = ov.selectedFrequency || notes.preference?.selectedFrequency;
    const medi = usageMap.medi || {};
    const mediPeriod = medi.available === false ? null : (medi.periodCount ?? 0);
    const mediTotal = ov.medi?.requests;
    const blocked = user.status === 'BLOCKED';
    let place = typeof adminPlaceOf === 'function' ? adminPlaceOf(ov.location) : { line: '', flag: '' };
    // No shared location → the country we can tell from the phone code or time zone (same as the map).
    if (!ov.location?.countryCode && user.country?.code) {
      place = {
        line: [user.country.cityKa, user.country.nameKa].filter(Boolean).join(', '),
        flag: typeof adminFlagImg === 'function' ? adminFlagImg(user.country.code) : '',
        note: COUNTRY_SOURCE_KA[user.country.source] || '',
      };
    }
    const genderAge = [
      user.gender && typeof genderKa === 'function' ? genderKa(user.gender) : null,
      user.age != null ? `${user.age} წლის` : null,
    ].filter(Boolean).join(' · ');
    const isNewUser = user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 7 * 86400000;
    // In the app this minute? The admin home keeps the live list in __opsOnline.
    const live = (global.__opsOnline?.users || []).find((u) => u.id === id);
    const liveWhere = live ? (typeof userScreenKa === 'function' ? userScreenKa(live.screen) : null) : null;
    const synthetic = /@(phone|apple)\.medicard\.ge$/i.test(user.email || '');
    const phoneDigits = String(user.phone || '').replace(/\D/g, '');
    const phoneText = phoneDigits
      ? (phoneDigits.length === 12 && phoneDigits.startsWith('995') ? `+995 ${phoneDigits.slice(3, 6)} ${phoneDigits.slice(6, 8)} ${phoneDigits.slice(8, 10)} ${phoneDigits.slice(10)}` : `+${phoneDigits}`)
      : (/@phone\./i.test(user.email || '') && typeof aiContact === 'function' ? aiContact(user) : '');
    const copyChip = (value, label, iconName, text) => `<button type="button" class="s-user-copy" data-copy="${escA(value)}" data-copy-label="${escA(label)}" title="${escA(value)} — დააჭირე კოპირებისთვის">${ico(iconName)}<span>${esc(text || value)}</span>${ico('copy')}</button>`;
    const badge = (cls, html) => `<span class="s-badge ${cls}">${html}</span>`;

    const statusBadges = [
      blocked ? badge('is-bad', `${ico('lock')} დაბლოკილი`) : '',
      live
        ? `<span class="s-user-live"><i aria-hidden="true"></i>ახლა აპშია${liveWhere ? ` · ${esc(liveWhere)}` : ''}</span>`
        : `<span class="s-user-seen">${ico('activity')} ${esc(lastActiveAt ? `ბოლოს ${relative(lastActiveAt)}` : 'აპში არ შემოსულა')}</span>`,
      isNewUser ? badge('is-accent is-plain', 'ახალი') : '',
      user.signupNo ? `<span class="s-users-no-pill${user.signupNo === 1 || user.signupNo % 100 === 0 ? ' is-milestone' : ''}" title="რეგისტრაციის რიგითი ნომერი">#${esc(fmtKa(user.signupNo))}</span>` : '',
    ].join('');

    const hero = `
      <section class="s-card s-user-hero2${blocked ? ' is-blocked' : ''}${live ? ' is-live' : ''}">
        <div class="s-user-hero2-main">
          ${user.avatar
            ? `<button type="button" class="s-user-ava is-zoomable${user.gender === 'FEMALE' ? ' is-f' : ''}${blocked ? ' is-muted' : ''}" id="user-ava-zoom" aria-label="სურათის გადიდება" title="სურათის გადიდება"><span class="s-user-ava-in">${esc(personInitials(user))}${typeof adminAvatarImg === 'function' ? adminAvatarImg(user) : ''}</span>${live ? '<i></i>' : ''}<span class="s-user-ava-zoom" aria-hidden="true">${ico('search')}</span></button>`
            : `<span class="s-user-ava${user.gender === 'FEMALE' ? ' is-f' : ''}${blocked ? ' is-muted' : ''}" aria-hidden="true"><span class="s-user-ava-in">${esc(personInitials(user))}</span>${live ? '<i></i>' : ''}</span>`}
          <div class="s-user-hero2-copy">
            <div class="s-user-hero2-title"><h2>${esc(name)}</h2>${statusBadges}<div class="s-user-hero2-actions">
                <button type="button" class="btn compact" id="user-edit">${ico('settings')} რედაქტირება</button>
                <button type="button" class="btn compact" id="user-coins">${ico('gift')} Coins</button>
                <button type="button" class="btn compact icon-only" id="user-more" aria-haspopup="menu" aria-label="სხვა მოქმედებები" title="სხვა მოქმედებები">${ico('menu')}</button>
              </div></div>
            <div class="s-user-hero2-contacts">
              ${phoneText ? copyChip(phoneText.replace(/\s/g, ''), 'ტელეფონი', 'phone', phoneText) : ''}
              ${user.email && !synthetic ? copyChip(user.email, 'ელ-ფოსტა', 'mail') : ''}
              ${/@apple\./i.test(user.email || '') ? `<span class="s-user-fact">${ico('lock')} Apple-ით შესული</span>` : ''}
              ${copyChip(user.id, 'მომხმარებლის ID', 'user', `${String(user.id).slice(0, 8)}…`)}
            </div>
            <ul class="s-user-hero2-facts">
              <li>${place.line ? `${place.flag || ico('globe')}<span>${esc(place.line)}${place.note ? ` <span class="s-muted" title="როგორ დადგინდა">· ${esc(place.note)}</span>` : ''}</span>` : `${ico('globe')}<span class="s-muted">ადგილი უცნობია</span>`}</li>
              <li>${ico('user')}<span>${esc(genderAge || 'სქესი და ასაკი უცნობია')}</span></li>
              <li>${ico('calendar')}<span>რეგისტრაცია ${esc(when(user.createdAt, 'date'))}</span></li>
              ${platform || appVer ? `<li>${ico('phone')}<span>${esc([platform, appVer].filter(Boolean).join(' '))}</span></li>` : ''}
            </ul>
          </div>

        </div>
        ${user.adminNote ? `<button type="button" class="s-user-note" id="user-note">${ico('file')}<span><b>ადმინის შენიშვნა</b>${esc(user.adminNote)}</span></button>` : ''}
      </section>`;

    const callouts = [
      blocked ? `<div class="s-callout is-bad" role="status">${ico('lock')}<p><b>ანგარიში დაბლოკილია</b> — ადამიანი აპში ვერ შედის. აღდგენა: მენიუ ${ico('menu')} → „განბლოკვა“.</p></div>` : '',
      user.age != null && user.age < 18 ? `<div class="s-callout is-warn">${ico('alert')}<p><b>${esc(user.age)} წლის</b> — ანგარიში 18+ წესამდე შეიქმნა და შენს განხილვას ელოდება.</p></div>` : '',
    ].join('');

    const kpis = `
      <div class="s-metrics s-user-kpis" aria-label="მთავარი მაჩვენებლები">
        <div class="s-metric"><span>ბოლო აქტივობა</span><strong>${esc(live ? 'ახლა' : lastActiveAt ? relative(lastActiveAt) : 'არასდროს')}</strong>
          <small>${esc(lastActiveAt ? when(lastActiveAt) : 'აპში ჯერ არ შემოსულა')}</small></div>
        <div class="s-metric"><span>Medi მოთხოვნები</span><strong>${mediPeriod == null ? '—' : fmtKa(mediPeriod)}</strong>
          <small>${esc(period)}${mediTotal != null ? ` · სულ ${fmtKa(mediTotal)}` : ''}</small></div>
        <div class="s-metric" id="user-kpi-coins"><span>Medi Coins</span><strong>—</strong><small>იტვირთება…</small></div>
        <div class="s-metric"><span>მოდულები</span><strong>${fmtKa(used.length)}<em class="s-user-den"> / ${fmtKa(features.length)}</em></strong>
          <small>${used.length ? `ბოლოს: ${esc(used[0].label)}` : 'ჯერ არცერთი'}</small></div>
        <div class="s-metric${perm === 'disabled' ? ' is-warn' : ''}"><span>შეტყობინებები</span><strong>${esc(typeof permKa === 'function' ? permKa(perm) : (perm || '—'))}</strong>
          <small>სიხშირე: ${esc(typeof freqKa === 'function' ? freqKa(freq) : (freq || '—'))}</small></div>
      </div>`;

    const tile = (f) => `<button type="button" class="s-user-mod${f.active ? ' is-active' : ''}" data-user-goto="product" style="--mod:${FEATURE_TONE[f.key] || '#64748B'}">
        <span class="s-user-mod-top"><i aria-hidden="true"></i><b>${esc(f.label)}</b>${f.active ? '<em>აქტიური</em>' : ''}</span>
        <strong>${f.periodCount == null ? '—' : fmtKa(f.periodCount)}<small>${esc(period)}</small></strong>
        <span class="s-user-mod-last">ბოლოს ${esc(f.lastUsed ? userWhen(f.lastUsed, 'date') : '—')}</span>
      </button>`;
    const modulesCard = `
      <section class="s-card s-user-card">
        <header class="s-card-head"><div><h3>რას იყენებს</h3><p>${inPeriod.length ? `${esc(period)}: ${fmtKa(inPeriod.length)} მოდული, ყველაზე აქტიური პირველია. „აქტიური“ — ბოლო 2 დღეში.` : used.length ? `${esc(period)} არაფერი გამოუყენებია.` : 'მოდულის გამოყენება ჯერ არ დაფიქსირებულა.'}</p></div></header>
        <div class="s-card-body">
          ${inPeriod.length ? `<div class="s-user-mods">${inPeriod.map(tile).join('')}</div>` : `<div class="s-empty">${ico('layers')}<span>${used.length ? 'ამ პერიოდში ჩანაწერი არ არის.' : 'ჩანაწერი ჯერ არ არის.'}</span></div>`}
          ${earlier.length ? `<p class="s-user-unused"><span>ადრე გამოუყენებია:</span> ${earlier.map((f) => `<span class="s-user-unused-chip is-earlier" style="--mod:${FEATURE_TONE[f.key] || '#64748B'}" title="ბოლოს ${escA(f.lastUsed ? userWhen(f.lastUsed, 'date') : '—')}">${esc(f.label)}</span>`).join('')}</p>` : ''}
          ${unused.length ? `<p class="s-user-unused"><span>არასდროს:</span> ${unused.map((f) => `<span class="s-user-unused-chip">${esc(f.label)}</span>`).join('')}</p>` : ''}
        </div>
      </section>`;

    const clock = (value) => {
      const p = value && typeof adminDateParts === 'function' ? adminDateParts(value) : null;
      return p ? `${p.hour}:${p.minute}` : '';
    };
    const recent = timeline.slice(0, 7);
    const recentCard = `
      <section class="s-card s-user-card">
        <header class="s-card-head"><div><h3>ბოლო აქტივობა</h3><p>${timeline.length ? `${fmtKa(timeline.length)} მოვლენა · ${esc(period)}` : `${esc(period)} — აქტივობა არ ჩაწერილა`}</p></div>
          ${timeline.length > recent.length ? `<button type="button" class="btn ghost compact" data-user-goto="activity">სრული ქრონოლოგია ${ico('arrow')}</button>` : ''}</header>
        <div class="s-card-body">${recent.length ? `<ol class="s-user-recent">${recent.map((item) => `<li>
            <span class="s-user-recent-dot" aria-hidden="true"></span>
            <div><b>${esc(typeof userTimelineLabel === 'function' ? userTimelineLabel(item) : item.label || '—')}</b>
              <small>${esc([typeof timelineDayKa === 'function' ? timelineDayKa(item.at) : '', clock(item.at), typeof platformKa === 'function' ? platformKa(item.platform) : ''].filter(Boolean).join(' · '))}</small></div>
          </li>`).join('')}</ol>` : `<div class="s-empty">${ico('activity')}<span>ამ პერიოდში აქტივობა არ ჩაწერილა.</span></div>`}</div>
      </section>`;

    const tabKey = !opts.profileTab || opts.profileTab === 'overview' ? 'activity' : opts.profileTab;
    const tabsHtml = typeof renderUserInvestigationTabs === 'function'
      ? renderUserInvestigationTabs(user, profileExtra, '', false, tabKey, { skipOverview: true })
      : '';

    const row = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
    const accountCard = `
      <section class="s-card s-user-card">
        <header class="s-card-head"><div><h3>ანგარიში</h3></div></header>
        <div class="s-card-body"><dl class="s-user-facts">
          ${row('სტატუსი', blocked ? badge('is-bad', 'დაბლოკილი') : badge('is-ok', 'აქტიური'))}
          ${row('რეგისტრაცია', `${esc(when(user.createdAt, 'date'))}${user.signupNo ? ` <span class="s-muted">· #${esc(fmtKa(user.signupNo))}</span>` : ''}`)}
          ${row('შესვლა', esc(/@apple\./i.test(user.email || '') ? 'Apple' : /@phone\./i.test(user.email || '') ? 'ტელეფონი' : user.email ? 'ელ-ფოსტა' : '—'))}
          ${row('AI თანხმობა', '<span id="user-consent" class="s-muted">იტვირთება…</span>')}
          ${row('ჩანაწერები', `${fmtKa(user.counts?.records ?? 0)} <span class="s-muted">· საუბარი ${fmtKa(user.counts?.chats ?? 0)} · წამალი ${fmtKa(user.counts?.medications ?? 0)}</span>`)}
          ${row('ციკლი', user.hasCycle ? badge('is-plain', 'აწარმოებს') : '<span class="s-muted">არა</span>')}
          ${row('მოწყობილობები', devices.length ? devices.map((d) => `<span class="s-user-dev">${esc([typeof platformKa === 'function' ? platformKa(d.platform) : d.platform, d.appVersion].filter(Boolean).join(' '))}</span>`).join('') : '<span class="s-muted">—</span>')}
        </dl></div>
      </section>`;

    root.innerHTML = `
      <div class="v3-user-page s-user s-stack">
        <div class="s-user-nav">
          <a class="btn ghost compact" id="user-page-back" href="${escA(backHref)}">${ico('chevronLeft')} რეესტრი</a>
        </div>
        ${hero}
        ${callouts}
        ${kpis}
        <div class="s-user-layout">
          <div class="s-user-main">
            ${modulesCard}
            ${recentCard}
            <section class="s-card v3-user-board s-user-board" id="user-inv-host" aria-label="დეტალები">${tabsHtml}</section>
          </div>
          <aside class="s-user-side">
            ${accountCard}
            <div id="user-insights-host" class="s-insights-host"></div>
          </aside>
        </div>
      </div>`;

    if (typeof bindUserInvestigation === 'function') bindUserInvestigation(id);
    // Tiles and „სრული ქრონოლოგია“ jump to a tab below: bring it into view too.
    root.querySelectorAll('.s-user-main > .s-user-card [data-user-goto]').forEach((btn) => {
      btn.addEventListener('click', () => $('user-inv-host')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    });
    V.setDirty?.(false);
    global.AdminV4Manage?.mountUserInsights(id);

    $('user-page-back')?.addEventListener('click', (e) => {
      e.preventDefault();
      location.hash = typeof usersListHref === 'function' ? usersListHref() : '#/users';
    });
    $('user-header-reload')?.addEventListener('click', reload);
    $('user-edit')?.addEventListener('click', () => openUserEditDialog(user, reload));
    $('user-ava-zoom')?.addEventListener('click', (e) => {
      const src = e.currentTarget.querySelector('.adm-ava')?.src;
      if (src) openAvatarLightbox(src, name, user.avatar?.kind === 'preset' ? 'აპის მზა ავატარი' : 'საკუთარი ფოტო');
    });
    $('user-note')?.addEventListener('click', () => openUserEditDialog(user, reload));
    $('user-coins')?.addEventListener('click', () => global.AdminV4Manage?.coinsDialog?.(id, 'grant'));
    $('user-more')?.addEventListener('click', (e) => {
      const setStatus = (status) => V.runMutation({
        action: () => api(`/users/${id}`, { method: 'PATCH', body: { status } }),
        successMessage: status === 'BLOCKED' ? 'ანგარიში დაიბლოკა' : 'ანგარიში განიბლოკა',
      }).then((out) => { if (out?.ok) reload(); });
      openUserMenu(e.currentTarget, [
        { key: 'revoke', icon: 'wallet', label: 'Coins-ის ჩამოჭრა', run: () => global.AdminV4Manage?.coinsDialog?.(id, 'revoke') },
        { key: 'export', icon: 'download', label: 'მონაცემების ექსპორტი (JSON)', run: () => global.AdminV4Manage?.exportUser?.(id) },
        '-',
        blocked
          ? { key: 'unblock', icon: 'unlock', label: 'განბლოკვა', run: () => setStatus('ACTIVE') }
          : { key: 'block', icon: 'lock', label: 'დაბლოკვა', run: () => V.openConfirm?.({
            title: 'ანგარიშის დაბლოკვა', message: `„${name}“ აპში ვეღარ შევა, სანამ არ განბლოკავ.`, confirmLabel: 'დაბლოკვა', variant: 'danger',
            onConfirm: () => setStatus('BLOCKED'),
          }) },
        { key: 'delete', icon: 'trash', label: 'ანგარიშის წაშლა', danger: true, run: () => V.openConfirm?.({
          title: 'მომხმარებლის წაშლა',
          message: `სამუდამოდ წავშალოთ „${name}"? წაიშლება პროფილი და დაკავშირებული მონაცემები. შეუქცევადია.`,
          confirmLabel: 'წაშლა',
          variant: 'danger',
          onConfirm: async () => {
            await api(`/users/${id}`, { method: 'DELETE' });
            toast('მომხმარებელი წაიშალა', 'bad');
            location.hash = typeof usersListHref === 'function' ? usersListHref() : '#/users';
          },
        }) },
      ]);
    });
  }

  global.renderUsers = renderUsersV3;
  global.renderUserPage = renderUserPageV3;
  // Keep status cell honest if legacy paint still used
  global.usersStatusCell = accountStatusBadge;
})(window);
