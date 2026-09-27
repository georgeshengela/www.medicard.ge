/**
 * MediCard Admin V4 — operator experience layer.
 * Loads last. Adds the pieces a modern console is expected to have without
 * touching module code:
 *   ⌘K / Ctrl+K / "/" command palette (pages, sub-pages, actions, live user search, recents)
 *   keyboard shortcuts (g + letter navigation, ? cheat sheet, [ compact sidebar, ⇧D theme, ⇧A activity, ⇧R reload)
 *   activity + system health sheet (audit feed, unread dot)
 *   breadcrumbs, per-page header icon, scroll shadow, top progress bar
 *   exit animations for dialogs, confirms, drawers, palette and toasts; dismissible toasts
 *   table density preference
 */
(function adminV4Experience(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const reduced = () => global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = isMac ? '⌘' : 'Ctrl';
  const RECENT_KEY = 'medicard.admin.recent';
  const DENSITY_KEY = 'medicard.admin.density';
  const SEEN_KEY = 'medicard.admin.activitySeen';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (name) => (typeof global.icon === 'function' ? global.icon(name) : '');
  const call = (fn, ...args) => (typeof global[fn] === 'function' ? global[fn](...args) : undefined);
  const read = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };
  // admin.js keeps `state` as a script-level const (not on window).
  const adminState = () => (typeof state !== 'undefined' ? state : null);
  const loggedIn = () => doc.documentElement.dataset.ready === 'app' && Boolean(adminState()?.token);

  // Extra glyphs used by this layer (same 24px stroke family as admin.js ICONS).
  if (typeof ICONS === 'object') {
    Object.assign(ICONS, {
      command: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>',
      keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
      clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
      corner: '<polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
      rows: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h5"/>',
      server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    });
  }

  /* ─────────────── Registry (derived from the sidebar, the single source) ─────────────── */
  const NAV_KEYS = {
    overview: 'o', users: 'u', push: 'p', 'poster-studio': 'i', nutrition: 'n', community: 'c', medipulsi: 'm',
    health: 'h', ai: 'd', rewards: 'r', orders: 'e', sms: 'x', pharmacy: 'f', quality: 'q', testing: 't', audit: 'a', settings: 's', quests: 'k', features: 'l',
  };
  const SUBPAGES = [
    ['push', 'brain', 'გადაწყვეტილებები', 'Brain decisions'],
    ['push', 'compose', 'ახალი Push გაგზავნა', 'compose send campaign'],
    ['push', 'copy', 'Medi ტექსტები', 'templates copy'],
    ['push', 'engage', 'ჩართულობა', 'engagement'],
    ['push', 'history', 'Push ისტორია', 'history campaigns'],
    ['push', 'devices', 'მოწყობილობები', 'devices tokens'],
    ['rewards', 'campaigns', 'კამპანიები', 'campaigns'],
    ['rewards', 'partners', 'პარტნიორები', 'partners'],
    ['rewards', 'redemptions', 'გაცვლები', 'redemptions vouchers'],
    ['rewards', 'codes', 'კოდების მარაგი', 'codes inventory'],
    ['rewards', 'referrals', 'მოწვევები', 'referrals invite'],
  ];

  function pages() {
    const out = [];
    doc.querySelectorAll('.v3-sidebar [data-nav-group]').forEach((group) => {
      const groupLabel = group.querySelector('.v3-nav-group-toggle')?.textContent.trim() || '';
      group.querySelectorAll('.nav[data-tab]').forEach((btn) => {
        const tab = btn.dataset.tab;
        out.push({ tab, label: btn.querySelector('.nav-label')?.textContent.trim() || tab, group: groupLabel, icon: btn.dataset.icon || 'layout', key: NAV_KEYS[tab] });
      });
    });
    return out;
  }
  const pageOf = (tab) => pages().find((p) => p.tab === tab);

  /* ─────────────── Exit animations ─────────────── */
  const nativeRemove = Element.prototype.remove;
  function leave(node, ms = 180) {
    if (!node || node.__sLeaving) return;
    if (reduced() || !node.isConnected) { nativeRemove.call(node); return; }
    node.__sLeaving = true;
    node.removeAttribute('id');
    node.querySelectorAll('[id]').forEach((child) => child.removeAttribute('id'));
    node.classList.add('s-leaving');
    setTimeout(() => nativeRemove.call(node), ms);
  }
  function animateOnRemove(node, ms) {
    if (node.__sPatched) return;
    node.__sPatched = true;
    node.remove = () => leave(node, ms);
  }

  function enhanceToast(node) {
    if (!(node instanceof HTMLElement) || !node.classList.contains('toast') || node.__sPatched) return;
    const bad = node.matches('.bad, .is-bad, .is-error');
    const ms = bad ? 7000 : 3600;
    node.insertAdjacentHTML('beforeend', `<button type="button" class="s-toast-x" aria-label="დახურვა">${ico('x')}</button><i class="s-toast-bar" style="animation-duration:${ms}ms"></i>`);
    node.querySelector('.s-toast-x').addEventListener('click', () => leave(node, 200));
    node.__sPatched = true;
    node.remove = () => {
      if (node.matches(':hover')) {
        node.addEventListener('mouseleave', () => setTimeout(() => leave(node, 200), 900), { once: true });
        return;
      }
      leave(node, 200);
    };
  }

  const overlayObserver = new MutationObserver((records) => {
    records.forEach((rec) => rec.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains('toast')) enhanceToast(node);
      else if (node.classList.contains('v3-overlay') || node.id === 'ops-palette') animateOnRemove(node, 170);
    }));
  });

  function wrapDrawerClose() {
    const original = global.closeDrawer;
    if (typeof original !== 'function' || original.__sWrapped) return;
    const wrapped = function closeDrawerAnimated(...args) {
      const drawer = $('drawer');
      if (drawer && !drawer.classList.contains('hidden') && !reduced()) {
        const ghost = drawer.cloneNode(true);
        ghost.removeAttribute('id');
        ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
        ghost.setAttribute('aria-hidden', 'true');
        ghost.classList.add('s-leaving');
        doc.body.appendChild(ghost);
        setTimeout(() => nativeRemove.call(ghost), 220);
      }
      return original.apply(this, args);
    };
    wrapped.__sWrapped = true;
    global.closeDrawer = wrapped;
  }

  /* ─────────────── Progress bar around route loads ─────────────── */
  let bar;
  function progress(on) {
    if (!bar) {
      bar = doc.createElement('div');
      bar.className = 's-progress';
      doc.body.appendChild(bar);
    }
    if (on) {
      bar.classList.remove('is-done');
      void bar.offsetWidth;
      bar.classList.add('is-on');
    } else {
      bar.classList.remove('is-on');
      bar.classList.add('is-done');
    }
  }
  function wrapSwitchTab() {
    const original = global.switchTab;
    if (typeof original !== 'function' || original.__sWrapped) return;
    const wrapped = async function switchTabTracked(tab, ...rest) {
      const painted = typeof global.tabPanelIsPainted === 'function' && global.tabPanelIsPainted(tab);
      if (!painted) progress(true);
      try { return await original.call(this, tab, ...rest); } finally {
        progress(false);
        rememberPage();
        syncChrome();
      }
    };
    wrapped.__sWrapped = true;
    global.switchTab = wrapped;
  }

  /** Same-page hash changes (#/push?tab=copy) must switch the module's sub-tab too. */
  function syncSubTab() {
    const tab = currentTab();
    const want = new URLSearchParams(location.hash.split('?')[1] || '').get('tab');
    if (!want) return;
    const attr = { push: 'data-v3-sub', rewards: 'data-rewards-sub' }[tab];
    if (!attr) return;
    const btn = doc.querySelector(`#tab-${tab} [${attr}="${CSS.escape(want)}"]`);
    if (btn && !btn.classList.contains('is-active') && btn.getAttribute('aria-selected') !== 'true') btn.click();
  }

  /* ─────────────── Header chrome: breadcrumb, icon, tools ─────────────── */
  function currentTab() {
    return adminState()?.tab || 'overview';
  }
  function subLabel(tab) {
    const params = typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || '');
    const sub = params.get('tab');
    const hit = SUBPAGES.find(([t, key]) => t === tab && key === sub);
    if (hit) return hit[2];
    if (tab === 'users' && /^#\/users\/[^?]+/.test(location.hash)) return 'პროფილი';
    return '';
  }
  function syncChrome() {
    const tab = currentTab();
    const page = pageOf(tab);
    const copy = doc.querySelector('.v3-page-header .topbar-copy');
    if (copy && page) {
      let crumb = copy.querySelector('.s-crumb');
      if (!crumb) {
        crumb = doc.createElement('p');
        crumb.className = 's-crumb';
        copy.prepend(crumb);
      }
      const sub = subLabel(tab);
      crumb.innerHTML = `<b>${esc(page.group)}</b><i>/</i><span>${esc(page.label)}</span>${sub ? `<i>/</i><span>${esc(sub)}</span>` : ''}`;
      const greet = $('page-greeting');
      if (greet) greet.title = $('page-subtitle')?.textContent || '';
      const mark = $('page-mark');
      if (mark) mark.innerHTML = ico(page.icon);
      doc.title = `${page.label} · Medicard ადმინი`;
    }
  }

  function mountTools() {
    const status = doc.querySelector('.v3-page-header-status');
    if (!status || status.querySelector('.s-top-tools')) return;
    status.insertAdjacentHTML('afterbegin', `
      <div class="s-top-tools">
        <button type="button" class="s-top-search" data-s="palette" aria-label="ძებნა და ბრძანებები (${MOD}+K)">
          ${ico('search')}<span>ძებნა ან ბრძანება…</span><kbd class="s-kbd">${MOD} K</kbd>
        </button>
        <button type="button" class="s-guide-btn" data-s="guide" aria-label="ამ გვერდის გზამკვლევი" title="გზამკვლევი — როგორ მუშაობს ეს გვერდი">${ico('book')}<span>გზამკვლევი</span></button>
        <button type="button" class="s-icon-btn" data-s="activity" aria-label="აქტივობა და სისტემა" title="აქტივობა და სისტემა (⇧A)">${ico('bell')}</button>
        <button type="button" class="s-icon-btn" data-s="keys" aria-label="კლავიატურის მალსახმობები" title="მალსახმობები (?)">${ico('keyboard')}</button>
      </div>`);
    status.querySelector('[data-s="palette"]').addEventListener('click', () => openPalette());
    status.querySelector('[data-s="activity"]').addEventListener('click', () => openActivity());
    status.querySelector('[data-s="guide"]').addEventListener('click', () => openGuide());
    status.querySelector('[data-s="keys"]').addEventListener('click', () => openKeys());
    $('live-pill')?.addEventListener('click', () => openActivity());
    if ($('live-pill')) { $('live-pill').style.cursor = 'pointer'; $('live-pill').title = 'სისტემის მდგომარეობა'; }

    const side = doc.querySelector('.admin-nav-search');
    if (side && !side.querySelector('.s-side-search')) {
      side.innerHTML = `<button type="button" class="s-side-search" aria-label="ძებნა (${MOD}+K)">${ico('search')}<span>ძებნა…</span><kbd class="s-kbd">${MOD} K</kbd></button>`;
      side.firstElementChild.addEventListener('click', () => { doc.body.classList.remove('sidebar-open'); openPalette(); });
    }
    const avatar = $('sidebar-avatar');
    if (avatar && !avatar.dataset.sMenu) {
      avatar.dataset.sMenu = '1';
      avatar.setAttribute('role', 'button');
      avatar.setAttribute('tabindex', '0');
      avatar.setAttribute('aria-haspopup', 'menu');
      avatar.setAttribute('aria-label', 'ანგარიშის მენიუ');
      avatar.addEventListener('click', openMenu);
      avatar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(); } });
    }
    doc.querySelectorAll('.v3-sidebar .nav[data-tab]').forEach((btn) => {
      const key = NAV_KEYS[btn.dataset.tab];
      if (key && !btn.querySelector('.s-nav-kbd')) btn.insertAdjacentHTML('beforeend', `<kbd class="s-kbd s-nav-kbd" aria-hidden="true">G ${key.toUpperCase()}</kbd>`);
    });
  }

  /* ─────────────── Recents ─────────────── */
  function recents() { return read(RECENT_KEY, []); }
  function pushRecent(item) {
    const list = recents().filter((r) => r.key !== item.key);
    list.unshift({ ...item, at: Date.now() });
    write(RECENT_KEY, list.slice(0, 8));
  }
  function rememberPage() {
    const tab = currentTab();
    const userMatch = location.hash.match(/^#\/users\/([^?]+)/);
    if (userMatch) {
      const id = decodeURIComponent(userMatch[1]);
      setTimeout(() => {
        const name = doc.querySelector('#tab-users :is(.user-hero h2, .user-hero h1, .v3-user-hero h2, .user-hero-name, h2)')?.textContent.trim();
        pushRecent({ key: `user:${id}`, kind: 'user', id, label: name || 'მომხმარებელი', hint: id.slice(0, 8) });
      }, 1400);
      return;
    }
    const page = pageOf(tab);
    if (!page) return;
    const sub = subLabel(tab);
    pushRecent({ key: `page:${location.hash.split('&range')[0]}`, kind: 'page', tab, hash: location.hash, icon: page.icon, label: sub ? `${page.label} · ${sub}` : page.label, hint: page.group });
  }

  /* ─────────────── Command palette ─────────────── */
  let palette = null;

  function actions() {
    const dark = doc.documentElement.dataset.theme === 'dark';
    const compact = doc.documentElement.dataset.density === 'compact';
    return [
      { id: 'compose', label: 'ახალი Push კამპანია', hint: 'Push & Brain', icon: 'plus', kw: 'new push send notification campaign', run: () => { location.hash = '#/push?tab=compose'; } },
      { id: 'theme', label: dark ? 'ღია თემაზე გადასვლა' : 'მუქ თემაზე გადასვლა', icon: dark ? 'sun' : 'moon', keys: ['⇧', 'D'], kw: 'theme dark light თემა', run: toggleTheme },
      { id: 'density', label: compact ? 'ცხრილები: კომფორტული' : 'ცხრილები: კომპაქტური', icon: 'rows', kw: 'density compact rows სიმჭიდროვე', run: toggleDensity },
      { id: 'sidebar', label: 'მენიუს შეკუმშვა / გაშლა', icon: 'layout', keys: ['['], kw: 'sidebar compact menu', run: toggleSidebar },
      { id: 'reload', label: 'მიმდინარე გვერდის განახლება', icon: 'refresh', keys: ['⇧', 'R'], kw: 'refresh reload', run: reloadPage },
      { id: 'activity', label: 'აქტივობა და სისტემის მდგომარეობა', icon: 'bell', keys: ['⇧', 'A'], kw: 'activity audit health status', run: openActivity },
      { id: 'export-users', label: 'მომხმარებლების ექსპორტი (CSV)', icon: 'download', kw: 'export csv users download', run: () => call('opsDownload', '/export/users', 'users.csv') },
      { id: 'export-audit', label: 'აუდიტის ექსპორტი (CSV)', icon: 'download', kw: 'export csv audit', run: () => call('opsDownload', '/export/audit', 'audit.csv') },
      { id: 'copy-link', label: 'გვერდის ბმულის კოპირება', icon: 'copy', kw: 'copy link url share', run: copyLink },
      { id: 'guide', label: 'ამ გვერდის გზამკვლევი', icon: 'book', keys: ['⇧', 'G'], kw: 'guide help how გზამკვლევი დახმარება', run: () => openGuide() },
      { id: 'keys', label: 'კლავიატურის მალსახმობები', icon: 'keyboard', keys: ['?'], kw: 'shortcuts keyboard help', run: openKeys },
      { id: 'help', label: 'როგორ მუშაობს ადმინი', icon: 'info', kw: 'help guide', run: () => global.AdminV3?.openHelp?.('global.howAdminWorks', $('admin-help-global')) },
      { id: 'logout', label: 'გასვლა', icon: 'logout', kw: 'logout sign out', run: confirmLogout },
    ];
  }

  function norm(s) { return String(s || '').toLocaleLowerCase('ka-GE'); }
  function score(text, q) {
    const t = norm(text);
    if (!q) return 1;
    const i = t.indexOf(q);
    if (i === 0) return 100 - t.length / 100;
    if (i > 0) return (t[i - 1] === ' ' ? 80 : 60) - i / 100;
    let ti = 0;
    for (const ch of q) { ti = t.indexOf(ch, ti); if (ti < 0) return 0; ti += 1; }
    return 20;
  }
  function highlight(label, q) {
    if (!q) return esc(label);
    const i = norm(label).indexOf(q);
    if (i < 0) return esc(label);
    return `${esc(label.slice(0, i))}<mark>${esc(label.slice(i, i + q.length))}</mark>${esc(label.slice(i + q.length))}`;
  }
  const kbds = (keys) => (keys || []).map((k) => `<kbd class="s-kbd">${esc(k)}</kbd>`).join('');

  function buildStatic(q) {
    const groups = [];
    const qn = norm(q.trim());
    if (!qn) {
      const rec = recents().slice(0, 5);
      if (rec.length) {
        groups.push({ title: 'ბოლოს ნანახი', items: rec.map((r) => ({
          label: r.label, hint: r.hint, icon: r.kind === 'user' ? null : (r.icon || 'clock'), avatar: r.kind === 'user' ? initials(r.label) : null,
          meta: ico('clock'), run: () => { location.hash = r.kind === 'user' ? call('userPageHref', r.id) || `#/users/${r.id}` : r.hash; },
        })) });
      }
    }
    const nav = pages().map((p) => ({ label: p.label, hint: p.group, icon: p.icon, keys: p.key ? ['G', p.key.toUpperCase()] : null, s: Math.max(score(p.label, qn), score(`${p.group} ${p.tab}`, qn) * 0.7), run: () => go(p.tab) }))
      .concat(SUBPAGES.map(([tab, key, label, kw]) => {
        const parent = pageOf(tab);
        return { label, hint: parent ? `${parent.label} / ${label}` : tab, icon: parent?.icon || 'layers', s: qn ? Math.max(score(label, qn), score(`${kw} ${parent?.label || ''}`, qn) * 0.7) : 0, run: () => { location.hash = `#/${tab}?tab=${key}`; } };
      }))
      .filter((i) => i.s > 0).sort((a, b) => b.s - a.s);
    if (nav.length) groups.push({ title: 'გვერდები', items: qn ? nav.slice(0, 8) : nav });
    const acts = actions().map((a) => ({ ...a, s: qn ? Math.max(score(a.label, qn), score(a.kw, qn) * 0.8) : 1 })).filter((a) => a.s > 0).sort((a, b) => b.s - a.s);
    if (acts.length) groups.push({ title: 'ქმედებები', items: qn ? acts.slice(0, 6) : acts });
    return groups;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  function renderPalette() {
    if (!palette) return;
    const { q, userGroup } = palette;
    const qn = norm(q.trim());
    const groups = buildStatic(q);
    if (userGroup?.items.length) groups.splice(qn ? 0 : groups.length, 0, userGroup);
    palette.flat = [];
    const html = groups.map((g) => `<div class="s-palette-group">${esc(g.title)}</div>${g.items.map((item) => {
      const idx = palette.flat.push(item) - 1;
      const lead = item.avatar != null
        ? `<span class="s-pi-ico">${esc(item.avatar)}</span>`
        : `<span class="s-pi-ico">${ico(item.icon || 'arrow')}</span>`;
      return `<button type="button" class="s-palette-item" role="option" data-i="${idx}" id="s-pi-${idx}">
        ${lead}<span class="s-pi-copy"><b>${highlight(item.label, qn)}</b>${item.hint ? `<small>${esc(item.hint)}</small>` : ''}</span>
        <span class="s-pi-meta">${item.meta || ''}${kbds(item.keys)}</span>
        <svg class="icon s-pi-go" viewBox="0 0 24 24" aria-hidden="true">${ICONS?.corner || ''}</svg>
      </button>`;
    }).join('')}`).join('');
    const list = palette.el.querySelector('.s-palette-list');
    list.innerHTML = html || `<div class="s-palette-empty">${palette.busy ? 'ვეძებ…' : `„${esc(q)}“ — ვერაფერი მოიძებნა`}</div>`;
    palette.active = Math.min(palette.active, Math.max(0, palette.flat.length - 1));
    paintActive(false);
  }

  function paintActive(scroll = true) {
    if (!palette) return;
    const items = palette.el.querySelectorAll('.s-palette-item');
    items.forEach((n) => n.classList.toggle('is-active', Number(n.dataset.i) === palette.active));
    const cur = palette.el.querySelector(`.s-palette-item[data-i="${palette.active}"]`);
    palette.el.querySelector('input').setAttribute('aria-activedescendant', cur ? cur.id : '');
    if (scroll) cur?.scrollIntoView({ block: 'nearest' });
  }

  let searchTimer = null;
  let searchSeq = 0;
  function searchUsers(q) {
    clearTimeout(searchTimer);
    const query = q.trim();
    if (query.length < 2) { palette.userGroup = null; palette.busy = false; palette.el.querySelector('.s-palette').classList.remove('is-busy'); renderPalette(); return; }
    palette.busy = true;
    palette.el.querySelector('.s-palette').classList.add('is-busy');
    const seq = ++searchSeq;
    searchTimer = setTimeout(async () => {
      let items = [];
      if (/^notif_dec_/i.test(query)) {
        items.push({ label: `გადაწყვეტილება ${query}`, hint: 'Brain', icon: 'bell', run: () => { location.hash = '#/push?tab=brain'; call('openDecisionDrawer', query); } });
      } else {
        try {
          const data = await global.api(`/users?q=${encodeURIComponent(query)}&limit=6`);
          items = (data.users || []).map((u) => ({
            label: u.fullName || u.email || u.id,
            hint: [u.email, u.phone].filter(Boolean).join(' · '),
            avatar: initials(u.fullName || u.email),
            meta: u.status === 'BLOCKED' ? '<span class="s-status-dot is-bad"></span> დაბლოკილი' : (u.platform ? esc(u.platform) : ''),
            run: () => {
              pushRecent({ key: `user:${u.id}`, kind: 'user', id: u.id, label: u.fullName || u.email, hint: u.email || '' });
              location.hash = call('userPageHref', u.id) || `#/users/${u.id}`;
            },
          }));
          if ((data.total || 0) > items.length) {
            items.push({ label: `ყველა შედეგი (${data.total})`, hint: 'მომხმარებლების რეესტრში', icon: 'users', run: () => openUsersSearch(query) });
          }
        } catch { /* keep static results */ }
      }
      if (!palette || seq !== searchSeq) return;
      palette.busy = false;
      palette.el.querySelector('.s-palette').classList.remove('is-busy');
      palette.userGroup = items.length ? { title: 'მომხმარებლები', items } : null;
      renderPalette();
    }, 180);
  }

  function openUsersSearch(query) {
    go('users').then(() => {
      setTimeout(() => {
        const input = doc.querySelector('#tab-users input[type="search"], #tab-users #user-q, #tab-users input[placeholder*="სახელი"]');
        if (!input) return;
        input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }, 450);
    });
  }

  function openPalette(initial = '') {
    if (!loggedIn()) return;
    if (palette) { palette.el.querySelector('input').focus(); return; }
    closeSheet();
    const layer = doc.createElement('div');
    layer.className = 's-layer';
    layer.id = 'ops-palette';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', 'ძებნა და ბრძანებები');
    layer.innerHTML = `
      <div class="s-scrim"></div>
      <div class="s-palette">
        <div class="s-palette-top">${ico('search')}
          <input type="text" role="combobox" aria-expanded="true" aria-controls="s-palette-list" autocomplete="off" spellcheck="false"
            placeholder="მოძებნე მომხმარებელი, გვერდი ან ქმედება…" value="${esc(initial)}">
          <span class="s-palette-spin" aria-hidden="true"></span>
          <kbd class="s-kbd">Esc</kbd>
        </div>
        <div class="s-palette-list" id="s-palette-list" role="listbox"></div>
        <div class="s-palette-foot">
          <span><kbd class="s-kbd">↑</kbd><kbd class="s-kbd">↓</kbd> არჩევა</span>
          <span><kbd class="s-kbd">↵</kbd> გახსნა</span>
          <span><kbd class="s-kbd">G</kbd>+ასო სწრაფი გადასვლა</span>
          <span style="margin-left:auto"><kbd class="s-kbd">?</kbd> მალსახმობები</span>
        </div>
      </div>`;
    doc.body.appendChild(layer);
    palette = { el: layer, q: initial, active: 0, flat: [], userGroup: null, busy: false, lastFocus: doc.activeElement };
    const closeMe = () => closePalette();
    layer.remove = () => { if (palette?.el === layer) palette = null; leave(layer, 170); };
    const input = layer.querySelector('input');
    layer.querySelector('.s-scrim').addEventListener('click', closeMe);
    input.addEventListener('input', () => { palette.q = input.value; palette.active = 0; renderPalette(); searchUsers(input.value); });
    input.addEventListener('keydown', (e) => {
      if (!palette) return;
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); palette.active = (palette.active + 1) % Math.max(1, palette.flat.length); paintActive(); }
      else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); palette.active = (palette.active - 1 + palette.flat.length) % Math.max(1, palette.flat.length); paintActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); runItem(palette.flat[palette.active]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMe(); }
    });
    layer.querySelector('.s-palette-list').addEventListener('mousemove', (e) => {
      const item = e.target.closest('.s-palette-item');
      if (!item || Number(item.dataset.i) === palette.active) return;
      palette.active = Number(item.dataset.i);
      paintActive(false);
    });
    layer.querySelector('.s-palette-list').addEventListener('click', (e) => {
      const item = e.target.closest('.s-palette-item');
      if (item) runItem(palette.flat[Number(item.dataset.i)]);
    });
    renderPalette();
    if (initial) searchUsers(initial);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function closePalette() {
    if (!palette) return;
    const { el, lastFocus } = palette;
    palette = null;
    leave(el, 170);
    try { lastFocus?.focus?.(); } catch { /* ignore */ }
  }

  function runItem(item) {
    if (!item) return;
    closePalette();
    setTimeout(() => item.run?.(), 10);
  }

  async function go(tab) {
    doc.body.classList.remove('sidebar-open');
    if (global.AdminV3?.dirty) {
      const ok = await global.AdminV3.confirmLeave();
      if (!ok) return;
      call('closeDrawer');
    }
    await global.switchTab(tab);
  }

  /* ─────────────── Actions ─────────────── */
  function toggleTheme() {
    const next = doc.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => call('applyTheme', next);
    if (doc.startViewTransition && !reduced()) doc.startViewTransition(apply); else apply();
  }
  function applyDensity(value) {
    doc.documentElement.dataset.density = value === 'compact' ? 'compact' : 'comfortable';
  }
  function toggleDensity() {
    const next = doc.documentElement.dataset.density === 'compact' ? 'comfortable' : 'compact';
    applyDensity(next);
    write(DENSITY_KEY, next);
    call('toast', next === 'compact' ? 'ცხრილები კომპაქტურია' : 'ცხრილები კომფორტულია', 'info');
  }
  function toggleSidebar() { $('sidebar-compact')?.click(); }
  async function reloadPage() {
    const tab = currentTab();
    const panel = $(`tab-${tab}`);
    if (tab === 'overview' && typeof global.refreshCommandCenterLive === 'function') {
      progress(true);
      try { await global.refreshCommandCenterLive(); } finally { progress(false); }
      call('toast', 'განახლდა', 'ok');
      return;
    }
    if (panel && tab !== 'poster-studio') panel.innerHTML = '';
    await global.switchTab(tab, { skipHash: true });
    call('toast', 'განახლდა', 'ok');
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(location.href); call('toast', 'ბმული დაკოპირდა', 'ok'); } catch { call('toast', 'კოპირება ვერ მოხერხდა', 'bad'); }
  }
  function confirmLogout() {
    global.AdminV3?.openConfirm?.({
      title: 'გასვლა კონსოლიდან?',
      message: 'სესია ამ ბრაუზერში დასრულდება.',
      confirmLabel: 'გასვლა',
      variant: 'danger',
      onConfirm: () => call('logout'),
    });
  }

  /* ─────────────── Right sheets (activity, shortcuts) ─────────────── */
  let sheet = null;
  function openSheet({ title, sub, body, foot, key }) {
    if (sheet?.key === key) { closeSheet(); return null; }
    closeSheet();
    const layer = doc.createElement('div');
    layer.className = 's-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', title);
    layer.innerHTML = `
      <div class="s-scrim"></div>
      <aside class="s-sheet">
        <header class="s-sheet-head"><div><h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}</div>
          <button type="button" class="s-icon-btn" data-close aria-label="დახურვა">${ico('x')}</button></header>
        <div class="s-sheet-body">${body}</div>
        ${foot ? `<footer class="s-sheet-foot">${foot}</footer>` : ''}
      </aside>`;
    doc.body.appendChild(layer);
    sheet = { el: layer, key, lastFocus: doc.activeElement };
    layer.querySelector('.s-scrim').addEventListener('click', closeSheet);
    layer.querySelector('[data-close]').addEventListener('click', closeSheet);
    layer.querySelector('[data-close]').focus();
    return layer;
  }
  function closeSheet() {
    if (!sheet) return false;
    const { el, lastFocus } = sheet;
    sheet = null;
    leave(el, 210);
    try { lastFocus?.focus?.(); } catch { /* ignore */ }
    return true;
  }

  function openGuide(tab = currentTab()) {
    const page = pageOf(tab);
    const body = global.AdminGuides ? global.AdminGuides.render(tab) : '<p class="s-muted">გზამკვლევი ვერ ჩაიტვირთა.</p>';
    openSheet({ key: `guide:${tab}`, title: `გზამკვლევი · ${page?.label || tab}`, sub: 'რისთვისაა გვერდი, როგორ შეასრულო ამოცანები და რას ნიშნავს ტერმინები.', body });
  }

  const SHORTCUTS = () => [
    ['ზოგადი', [
      ['ძებნა და ბრძანებები', [MOD, 'K']],
      ['ძებნა', ['/']],
      ['მალსახმობების სია', ['?']],
      ['დახურვა', ['Esc']],
    ]],
    ['გადასვლა', pages().filter((p) => p.key).map((p) => [p.label, ['G', p.key.toUpperCase()]])],
    ['ინტერფეისი', [
      ['თემის შეცვლა', ['⇧', 'D']],
      ['მენიუს შეკუმშვა', ['[']],
      ['აქტივობა და სისტემა', ['⇧', 'A']],
      ['გვერდის გზამკვლევი', ['⇧', 'G']],
      ['გვერდის განახლება', ['⇧', 'R']],
    ]],
  ];
  function openKeys() {
    const body = `<div class="s-keys">${SHORTCUTS().map(([title, rows]) => `
      <section><h4>${esc(title)}</h4><dl>${rows.map(([label, keys]) => `<div><dt>${esc(label)}</dt><dd>${kbds(keys)}</dd></div>`).join('')}</dl></section>`).join('')}</div>`;
    openSheet({ key: 'keys', title: 'კლავიატურის მალსახმობები', sub: 'ყველაფერი მაუსის გარეშე — სწრაფად.', body });
  }

  const ACTION_WORDS = [
    [/CREATED|\.create$/i, 'შექმნა', 'plus'],
    [/UPDATED|\.update$|\.save$/i, 'განახლება', 'refresh'],
    [/DELETED|\.delete$|REMOVED/i, 'წაშლა', 'trash'],
    [/STATUS_CHANGED|user\.status/i, 'სტატუსის ცვლილება', 'shield'],
    [/IMPORTED/i, 'იმპორტი', 'download'],
    [/ADJUSTED/i, 'კორექტირება', 'activity'],
    [/reset/i, 'საწყისზე დაბრუნება', 'refresh'],
    [/BLOCK/i, 'დაბლოკვა', 'lock'],
    [/LAUNCH|OPEN/i, 'გაშვება', 'zap'],
  ];
  const TARGETS = {
    rewardDefinition: 'ჯილდო', rewardPartner: 'პარტნიორი', rewardCampaign: 'კამპანია', rewardInventory: 'მარაგი', redemption: 'გაცვლა',
    user: 'მომხმარებელი', settings: 'პარამეტრები', pushTemplate: 'Push შაბლონი', community: 'ქალების სივრცე', medipulsi: 'MEDIRUN',
  };
  function humanAction(entry) {
    const action = String(entry.action || '');
    const hit = ACTION_WORDS.find(([re]) => re.test(action));
    const target = TARGETS[entry.targetType] || String(entry.targetType || action.split(/[._]/)[0] || '').replace(/([a-z])([A-Z])/g, '$1 $2');
    return { text: `${target}${hit ? ` · ${hit[1]}` : ''}`, icon: hit ? hit[2] : 'file', danger: /DELETE|BLOCK/i.test(action) };
  }
  function dayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'დღეს';
    if (d.toDateString() === y.toDateString()) return 'გუშინ';
    return typeof global.fmtDateShort === 'function' ? global.fmtDateShort(iso) : d.toLocaleDateString('ka-GE');
  }
  function timeOf(iso) {
    return typeof global.fmtRelative === 'function' ? global.fmtRelative(iso) : new Date(iso).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
  }

  async function openActivity() {
    if (!loggedIn()) return;
    const layer = openSheet({
      key: 'activity',
      title: 'აქტივობა',
      sub: 'სისტემის მდგომარეობა და ბოლო ადმინისტრაციული ცვლილებები.',
      body: `<div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div>`,
      foot: '<a class="btn" href="#/audit" data-close-sheet>სრული აუდიტი</a><a class="btn" href="#/quality" data-close-sheet>ხარისხი</a>',
    });
    if (!layer) return;
    layer.querySelectorAll('[data-close-sheet]').forEach((a) => a.addEventListener('click', () => closeSheet()));
    const seenAt = Number(read(SEEN_KEY, 0)) || 0;
    const [health, audit] = await Promise.allSettled([global.api('/system/health'), global.api('/audit?limit=30')]);
    if (sheet?.el !== layer) return;
    const h = health.status === 'fulfilled' ? health.value : null;
    const entries = audit.status === 'fulfilled' ? (audit.value.entries || []) : [];
    const cell = (label, value, tone) => `<div class="s-health-cell"><span><i class="s-status-dot ${tone ? `is-${tone}` : ''}"></i>${esc(label)}</span><strong>${value}</strong></div>`;
    const healthHtml = h ? `<div class="s-health-grid">
        ${cell('API', h.api?.ok ? 'მუშაობს' : 'შეფერხება', h.api?.ok ? '' : 'bad')}
        ${cell('მონაცემთა ბაზა', h.database?.ok ? `${esc(h.database.latencyMs)} ms` : 'შეცდომა', h.database?.ok ? (h.database.latencyMs > 250 ? 'warn' : '') : 'bad')}
        ${cell('Medi · 24სთ', `${esc(h.ai?.last24h ?? 0)} <small style="font-weight:500;color:var(--s-muted)">/ ${esc(h.ai?.errors24h ?? 0)} შეცდ.</small>`, h.ai?.errors24h ? 'warn' : '')}
        ${cell('Push · 24სთ', `${esc(h.push?.sent24h ?? 0)} <small style="font-weight:500;color:var(--s-muted)">/ ${esc(h.push?.failed24h ?? 0)} ვერ</small>`, h.push?.failed24h ? 'warn' : '')}
        ${cell('აპის ვერსია', esc(h.appVersion || '—'))}
        ${cell('რეჟიმი', h.settings?.maintenanceMode ? 'ტექ. სამუშაოები' : 'ჩვეულებრივი', h.settings?.maintenanceMode ? 'warn' : '')}
      </div>${(h.attention || []).map((a) => `<div class="s-attn">${ico('alert')}<span>${esc(a.message || a.title || a)}</span></div>`).join('')}`
      : '<p class="muted">სისტემის მდგომარეობა ვერ ჩაიტვირთა.</p>';
    let feed = '';
    let lastDay = '';
    entries.forEach((entry) => {
      const day = dayLabel(entry.createdAt);
      if (day !== lastDay) { feed += `${lastDay ? '</ul>' : ''}<div class="s-feed-day">${esc(day)}</div><ul class="s-feed">`; lastDay = day; }
      const act = humanAction(entry);
      const fresh = new Date(entry.createdAt).getTime() > seenAt;
      feed += `<li class="${fresh ? 'is-new' : ''} ${act.danger ? 'is-danger' : ''}"><span class="s-feed-ico">${ico(act.icon)}</span>
        <div><b>${esc(act.text)}</b><small>${esc(entry.adminEmail || 'სისტემა')} · ${esc(timeOf(entry.createdAt))}</small></div></li>`;
    });
    if (feed) feed += '</ul>';
    layer.querySelector('.s-sheet-body').innerHTML = `${healthHtml}${feed || '<div class="v3-empty"><strong>ჯერ აქტივობა არ არის</strong></div>'}`;
    if (entries[0]) write(SEEN_KEY, new Date(entries[0].createdAt).getTime());
    doc.querySelector('.s-icon-btn[data-s="activity"]')?.removeAttribute('data-dot');
  }

  async function checkUnread() {
    if (!loggedIn() || doc.hidden) return;
    try {
      const data = await global.api('/audit?limit=1');
      const latest = data.entries?.[0];
      const seenAt = Number(read(SEEN_KEY, 0)) || 0;
      const btn = doc.querySelector('.s-icon-btn[data-s="activity"]');
      if (!btn) return;
      if (!seenAt && latest) { write(SEEN_KEY, new Date(latest.createdAt).getTime()); return; }
      btn.toggleAttribute('data-dot', Boolean(latest && new Date(latest.createdAt).getTime() > seenAt && latest.adminEmail !== adminState()?.admin?.email));
    } catch { /* quiet */ }
  }

  /* ─────────────── Account menu (sidebar avatar) ─────────────── */
  let menu = null;
  function closeMenu() {
    if (!menu) return;
    const node = menu;
    menu = null;
    doc.removeEventListener('pointerdown', onMenuOutside, true);
    leave(node, 140);
  }
  function onMenuOutside(e) {
    if (menu && !menu.contains(e.target) && !e.target.closest('#sidebar-avatar')) closeMenu();
  }
  function openMenu() {
    if (menu) { closeMenu(); return; }
    const anchor = $('sidebar-avatar');
    if (!anchor) return;
    const admin = adminState()?.admin || {};
    const dark = doc.documentElement.dataset.theme === 'dark';
    const compact = doc.documentElement.dataset.density === 'compact';
    const item = (id, iconName, label, keys) => `<button type="button" role="menuitem" data-m="${id}">${ico(iconName)}<span>${esc(label)}</span>${kbds(keys)}</button>`;
    menu = doc.createElement('div');
    menu.className = 's-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <div class="s-menu-who"><span class="s-avatar">${esc(initials(admin.fullName || admin.email || 'M'))}</span>
        <div><b>${esc(admin.fullName || 'ადმინისტრატორი')}</b><small>${esc(admin.email || localStorage.getItem('medicard.admin.email') || '')}</small></div></div>
      <div class="s-menu-sep"></div>
      ${item('theme', dark ? 'sun' : 'moon', dark ? 'ღია თემა' : 'მუქი თემა', ['⇧', 'D'])}
      ${item('density', 'rows', compact ? 'კომფორტული ცხრილები' : 'კომპაქტური ცხრილები')}
      ${item('keys', 'keyboard', 'მალსახმობები', ['?'])}
      ${item('activity', 'bell', 'აქტივობა და სისტემა', ['⇧', 'A'])}
      <div class="s-menu-sep"></div>
      ${item('logout', 'logout', 'გასვლა')}`;
    doc.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, r.left)}px`;
    menu.style.bottom = `${Math.max(8, innerHeight - r.top + 8)}px`;
    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-m]');
      if (!btn) return;
      const run = { theme: toggleTheme, density: toggleDensity, keys: openKeys, activity: openActivity, logout: confirmLogout }[btn.dataset.m];
      closeMenu();
      run?.();
    });
    menu.addEventListener('keydown', (e) => {
      const items = [...menu.querySelectorAll('[role="menuitem"]')];
      const i = items.indexOf(doc.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); anchor.focus(); }
    });
    doc.addEventListener('pointerdown', onMenuOutside, true);
    menu.querySelector('[role="menuitem"]')?.focus();
  }

  /* ─────────────── Keyboard ─────────────── */
  let chord = null;
  let chordHint = null;
  function showChord() {
    chordHint?.remove();
    chordHint = doc.createElement('div');
    chordHint.className = 's-chord';
    chordHint.innerHTML = `<kbd class="s-kbd">G</kbd> გადასვლა… <span style="opacity:.7">U მომხმარებლები · P Push · A აუდიტი</span>`;
    doc.body.appendChild(chordHint);
  }
  function endChord() {
    chord = null;
    if (chordHint) { const n = chordHint; chordHint = null; leave(n, 150); }
  }
  function typing(target) {
    return target?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
  }
  function overlayOpen() {
    return Boolean(palette || global.AdminV3?.confirmOpen || $('v3-dialog') || ($('drawer') && !$('drawer').classList.contains('hidden')));
  }

  // Physical keys (e.code) so shortcuts also work on the Georgian keyboard layout.
  function letterOf(e) {
    const m = /^Key([A-Z])$/.exec(e.code || '');
    return m ? m[1].toLowerCase() : String(e.key || '').toLowerCase();
  }

  function onKey(e) {
    if (!loggedIn()) return;
    const letter = letterOf(e);
    if ((e.metaKey || e.ctrlKey) && !e.altKey && letter === 'k') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (palette) closePalette(); else openPalette();
      return;
    }
    if (e.key === 'Escape' && sheet && !palette) { e.preventDefault(); e.stopImmediatePropagation(); closeSheet(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || palette) return;
    if (chord === 'g') {
      e.preventDefault();
      const hit = pages().find((p) => p.key === letter);
      endChord();
      if (hit) go(hit.tab);
      return;
    }
    if (overlayOpen() || sheet) return;
    const slash = e.code === 'Slash' || e.key === '/' || e.key === '?';
    if (slash && (e.shiftKey || e.key === '?')) { e.preventDefault(); openKeys(); }
    else if (slash) { e.preventDefault(); openPalette(); }
    else if (letter === 'g' && !e.shiftKey && !e.metaKey) { chord = 'g'; showChord(); setTimeout(() => { if (chord === 'g') endChord(); }, 1400); }
    else if (e.code === 'BracketLeft' || e.key === '[') { e.preventDefault(); toggleSidebar(); }
    else if (e.shiftKey && letter === 'd') { e.preventDefault(); toggleTheme(); }
    else if (e.shiftKey && letter === 'a') { e.preventDefault(); openActivity(); }
    else if (e.shiftKey && letter === 'r') { e.preventDefault(); reloadPage(); }
    else if (e.shiftKey && letter === 'g') { e.preventDefault(); openGuide(); }
  }

  /* ─────────────── Boot ─────────────── */
  function boot() {
    applyDensity(read(DENSITY_KEY, 'comfortable'));
    overlayObserver.observe(doc.body, { childList: true, subtree: false });
    if ($('v3-confirm-root')) overlayObserver.observe($('v3-confirm-root'), { childList: true });
    if ($('toasts')) overlayObserver.observe($('toasts'), { childList: true });
    wrapDrawerClose();
    wrapSwitchTab();
    global.renderCommandPalette = () => openPalette();
    if (global.AdminV3?.syncHeader && !global.AdminV3.syncHeader.__sWrapped) {
      const original = global.AdminV3.syncHeader;
      global.AdminV3.syncHeader = function syncHeaderWithCrumb(...args) {
        const out = original.apply(this, args);
        syncChrome();
        return out;
      };
      global.AdminV3.syncHeader.__sWrapped = true;
    }
    mountTools();
    syncChrome();
    doc.addEventListener('keydown', onKey, true);
    global.addEventListener('hashchange', () => { syncSubTab(); syncChrome(); setTimeout(rememberPage, 60); });
    const onScroll = () => {
      const y = (doc.scrollingElement?.scrollTop || 0) + (doc.querySelector('.workspace')?.scrollTop || 0);
      doc.body.classList.toggle('s-scrolled', y > 4);
    };
    global.addEventListener('scroll', onScroll, { passive: true, capture: true });
    setTimeout(checkUnread, 2500);
    setInterval(checkUnread, 60000);
    global.AdminV4 = { openPalette, closePalette, openActivity, openKeys, openGuide, toggleTheme, toggleDensity, reloadPage };
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
