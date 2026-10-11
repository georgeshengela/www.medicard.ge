/**
 * MediCard Admin V4 — the bell's live feed (owner 2026-10-11: „ვიღაცამ დაამატა ცხოველი, ვიღაცამ დაამატა წამალი …
 * რეალ თაიმში“). History from GET /api/admin/feed, new events over the admin socket (`ops:feed`, admin.js re-sends
 * them as the `admin:feed` window event). Paints the „აპში“ pane of the activity sheet (experience.js), keeps the
 * bell's unread count, and toasts what someone has to act on (a letter, a report, a prize claim…).
 * No health values ever arrive here; MEDICYCLE events come without a person.
 */
(function adminLiveFeed(global) {
  const doc = document;
  const SEEN_KEY = 'medicard.admin.feedSeen';
  const NOTIFY_KEY = 'medicard.admin.feedNotify';
  const KEEP = 300;
  const PAGE = 60;
  const GROUP_MS = 30 * 60 * 1000;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => Number(n || 0).toLocaleString('ka-GE');
  const read = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, String(value)); } catch { /* private mode */ } };

  /** Module → label and sidebar glyph (the colour comes from CSS: .s-live.is-m-<module>). */
  const MODULES = {
    account: ['ანგარიშები', 'users'],
    pets: ['MEDIVET', 'paw'],
    pills: ['MEDIPILL', 'capsule'],
    cycle: ['MEDICYCLE', 'cycle'],
    sleep: ['MEDISLEEP', 'sleep'],
    food: ['MEDIFOOD', 'apple'],
    lab: ['MEDILAB', 'microscope'],
    medi: ['Medi', 'spark'],
    health: ['ჯანმრთელობა', 'pulse'],
    quest: ['MEDIQUEST', 'target'],
    run: ['MEDIRUN', 'route'],
    community: ['ქალების სივრცე', 'heart'],
    coach: ['MEDICOACH', 'coach'],
    support: ['მხარდაჭერა', 'inbox'],
  };
  const ORDER = Object.keys(MODULES);

  const st = { events: [], loaded: false, more: true, filter: 'all', host: null, onNavigate: null, unread: 0, arriving: new Set() };

  const seenAt = () => Number(read(SEEN_KEY, 0)) || 0;
  const time = (iso) => new Date(iso).getTime();

  function merge(list) {
    const known = new Set(st.events.map((e) => e.id));
    const fresh = (list || []).filter((e) => e && e.id && !known.has(e.id));
    st.events = [...fresh, ...st.events].sort((a, b) => time(b.at) - time(a.at)).slice(0, KEEP);
    return fresh;
  }

  /* ─────────────── Bell ─────────────── */
  function paintBell() {
    const btn = doc.querySelector('.s-icon-btn[data-s="activity"]');
    if (!btn) return;
    if (st.unread > 0) btn.setAttribute('data-count', st.unread > 99 ? '99+' : String(st.unread));
    else btn.removeAttribute('data-count');
    const tab = st.host?.closest('.s-sheet')?.querySelector('[data-act-tab="app"] i');
    if (tab) tab.textContent = st.unread ? fmt(st.unread) : '';
  }

  function markSeen() {
    const newest = st.events[0];
    if (newest) write(SEEN_KEY, time(newest.at));
    st.unread = 0;
    paintBell();
  }

  /** Bell count without the socket (boot and once a minute): events newer than the last time the pane was seen. */
  async function refreshUnread() {
    if (st.host) return;
    try {
      const data = await global.api(`/feed?limit=100`);
      const events = data.events || [];
      merge(events);
      const seen = seenAt();
      if (!seen) { if (events[0]) write(SEEN_KEY, time(events[0].at)); st.unread = 0; }
      else st.unread = events.filter((e) => time(e.at) > seen).length;
      paintBell();
    } catch { /* quiet: the bell just keeps its last state */ }
  }

  /* ─────────────── Live events ─────────────── */
  const who = (e) => e.user?.name || e.who || '';
  function notify(e) {
    const label = `${who(e) ? `${who(e)} — ` : ''}${e.text}`;
    if (typeof global.toast === 'function') global.toast(label, 'ok');
    if (read(NOTIFY_KEY, '0') === '1' && doc.hidden && 'Notification' in global && Notification.permission === 'granted') {
      try { new Notification(`MEDICARD · ${MODULES[e.module]?.[0] || 'აქტივობა'}`, { body: label, tag: e.id }); } catch { /* ignore */ }
    }
  }

  function ingest(list) {
    const fresh = merge(list);
    if (!fresh.length) return;
    const seen = seenAt();
    const visible = Boolean(st.host && !st.host.hidden && st.host.isConnected);
    if (visible) {
      fresh.forEach((e) => st.arriving.add(e.id));
      paint();
      markSeen();
    } else {
      st.unread += fresh.filter((e) => time(e.at) > seen).length;
      paintBell();
    }
    fresh.filter((e) => e.attention).slice(0, 3).forEach(notify);
  }

  global.addEventListener('admin:feed', (ev) => ingest(ev.detail?.events || []));

  /* ─────────────── Pane ─────────────── */
  function dayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'დღეს';
    if (d.toDateString() === y.toDateString()) return 'გუშინ';
    return global.AdminV3?.formatDate ? global.AdminV3.formatDate(iso, 'date') : d.toISOString().slice(0, 10);
  }
  function clock(iso) {
    const ago = Date.now() - time(iso);
    if (ago < 60_000) return 'ახლა';
    if (ago < 3_600_000) return `${Math.floor(ago / 60_000)} წთ წინ`;
    const d = new Date(time(iso) + 4 * 3600_000);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }

  /** Consecutive rows of the same person doing the same thing within half an hour fold into one „×N“ row. */
  function groups(list) {
    const out = [];
    for (const e of list) {
      const last = out[out.length - 1];
      const key = `${e.module}|${e.text}|${e.user?.id || e.who || ''}`;
      if (last && last.key === key && time(last.oldest.at) - time(e.at) <= GROUP_MS && dayLabel(last.oldest.at) === dayLabel(e.at)) {
        last.count += 1;
        last.oldest = e;
        last.ids.push(e.id);
      } else out.push({ key, head: e, oldest: e, count: 1, ids: [e.id] });
    }
    return out;
  }

  function rowHtml(g, seen) {
    const e = g.head;
    const [label, glyph] = MODULES[e.module] || ['აქტივობა', 'activity'];
    const isNew = time(e.at) > seen;
    const arrive = g.ids.some((id) => st.arriving.has(id));
    const name = e.user ? `<b>${esc(e.user.name || 'უსახელო')}</b> ` : e.who ? `<b>${esc(e.who)}</b> ` : '';
    const badges = `${g.count > 1 ? `<span class="s-live-x">×${fmt(g.count)}</span>` : ''}${e.attention ? '<span class="s-badge is-warn">საჭიროებს ყურადღებას</span>' : ''}${e.user?.team ? '<span class="s-badge is-plain">გუნდი</span>' : ''}`;
    const sub = [label, e.meta].filter(Boolean).join(' · ');
    const inner = `<span class="s-live-ico" aria-hidden="true">${ico(glyph)}</span>
      <div class="s-live-text"><p>${name}${esc(e.text)}${badges}</p><small>${esc(sub)}${e.user?.contact ? ` · ${esc(e.user.contact)}` : ''}</small></div>
      <time datetime="${esc(e.at)}">${esc(clock(e.at))}</time>`;
    const cls = `s-live is-m-${esc(e.module)}${isNew ? ' is-new' : ''}${arrive ? ' is-arrive' : ''}${e.attention ? ' is-attn' : ''}`;
    return `<li class="${cls}">${e.href ? `<a href="${esc(e.href)}" data-live-go>${inner}</a>` : `<div>${inner}</div>`}</li>`;
  }

  function paint() {
    const host = st.host;
    if (!host) return;
    const seen = seenAt();
    const counts = {};
    st.events.forEach((e) => { counts[e.module] = (counts[e.module] || 0) + 1; });
    const attention = st.events.filter((e) => e.attention).length;
    const chips = [['all', 'ყველა', st.events.length], ...(attention ? [['attention', 'ყურადღება', attention]] : []), ...ORDER.filter((m) => counts[m]).map((m) => [m, MODULES[m][0], counts[m]])];
    if (!chips.some(([k]) => k === st.filter)) st.filter = 'all';
    const list = st.events.filter((e) => st.filter === 'all' || (st.filter === 'attention' ? e.attention : e.module === st.filter));
    const live = global.__adminSocketConnected
      ? '<span class="s-live-status is-on"><i></i>ცოცხლად — ახალი მოვლენა რამდენიმე წამში ჩნდება</span>'
      : '<span class="s-live-status"><i></i>კავშირი აღდგება — სია ახლდება წუთში ერთხელ</span>';
    let body = '';
    let day = '';
    groups(list).forEach((g) => {
      const d = dayLabel(g.head.at);
      if (d !== day) { body += `${day ? '</ul>' : ''}<div class="s-feed-day">${esc(d)}</div><ul class="s-live-list">`; day = d; }
      body += rowHtml(g, seen);
    });
    if (body) body += '</ul>';
    const notifyOn = read(NOTIFY_KEY, '0') === '1' && 'Notification' in global && Notification.permission === 'granted';
    host.innerHTML = `<div class="s-live-top">${live}
        <label class="s-live-notify" title="როცა ადმინი სხვა ჩანართშია: წერილი, საჩივარი, პრიზის მოთხოვნა, ტრენერის განაცხადი, Medi-ს შეცდომა">
          <input type="checkbox" class="s-switch" data-live-notify ${notifyOn ? 'checked' : ''} ${'Notification' in global ? '' : 'disabled'}> ბრაუზერის შეტყობინება</label></div>
      <div class="s-live-chips" role="tablist" aria-label="მოდული">${chips.map(([k, label, n]) => `<button type="button" role="tab" class="s-live-chip${k === 'attention' ? ' is-attn' : ''}" aria-selected="${k === st.filter}" data-live-filter="${esc(k)}">${esc(label)} <i>${fmt(n)}</i></button>`).join('')}</div>
      ${body || `<div class="v3-empty"><strong>${st.loaded ? 'ჯერ არაფერი მომხდარა' : 'იტვირთება…'}</strong>${st.loaded ? '<span>ახალი რეგისტრაცია, ცხოველი, წამალი, კვება და სხვა აქ გამოჩნდება მაშინვე.</span>' : ''}</div>`}
      ${st.loaded && st.more && st.filter === 'all' && st.events.length ? '<div class="s-live-more"><button type="button" class="btn compact" data-live-more>ადრინდელის ჩვენება</button></div>' : ''}`;
    st.arriving.clear();
    host.querySelectorAll('[data-live-filter]').forEach((b) => b.addEventListener('click', () => { st.filter = b.dataset.liveFilter; paint(); }));
    // The exact place (v4/focus.js): that pet, claim, letter, conversation… — rendered fresh even if the page is open.
    host.querySelectorAll('[data-live-go]').forEach((a) => a.addEventListener('click', (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1 || !global.AdminFocus) return;
      ev.preventDefault();
      st.onNavigate?.();
      global.AdminFocus.go(a.getAttribute('href'));
    }));
    host.querySelector('[data-live-more]')?.addEventListener('click', loadOlder);
    host.querySelector('[data-live-notify]')?.addEventListener('change', async (ev) => {
      const box = ev.currentTarget;
      if (!box.checked) { write(NOTIFY_KEY, '0'); return; }
      // The browser asks once, from this click.
      const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      write(NOTIFY_KEY, result === 'granted' ? '1' : '0');
      box.checked = result === 'granted';
      if (result !== 'granted' && typeof global.toast === 'function') global.toast('ბრაუზერმა შეტყობინებები არ დაუშვა — ჩართე საიტის პარამეტრებში.', 'bad');
    });
  }

  async function loadOlder(ev) {
    const btn = ev?.currentTarget;
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
    try {
      const last = st.events[st.events.length - 1];
      const data = await global.api(`/feed?limit=${PAGE}&before=${encodeURIComponent(last.at)}`);
      const events = data.events || [];
      st.more = events.length >= PAGE;
      const known = new Set(st.events.map((e) => e.id));
      st.events = [...st.events, ...events.filter((e) => !known.has(e.id))];
      paint();
    } catch {
      if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
    }
  }

  /** Paint the „აპში“ pane into `host` and keep it live until unmount(). */
  async function mount(host, { onNavigate } = {}) {
    st.host = host;
    st.onNavigate = onNavigate || null;
    paint();
    try {
      const data = await global.api(`/feed?limit=${PAGE}`);
      merge(data.events || []);
      st.loaded = true;
      st.more = (data.events || []).length >= PAGE;
    } catch {
      st.loaded = true;
    }
    if (st.host !== host) return;
    paint();
    if (!host.hidden) markSeen();
  }

  function unmount() {
    st.host = null;
    st.onNavigate = null;
  }

  global.AdminLiveFeed = { mount, unmount, markSeen, refreshUnread, ingest, unread: () => st.unread };
})(window);
