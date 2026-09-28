/**
 * MediCard Admin V4 — #/support მხარდაჭერა (/api/admin/support).
 * A three-pane inbox for mail to support@medicard.ge (and any @medicard.ge):
 *   left    conversation list — search, status chips, "mine" / "unread", avatar + preview per row
 *   middle  conversation — subject bar with status/assignee, chat-style timeline (mail left, our
 *           replies right, internal notes as tinted cards), day separators, sticky composer
 *   right   person — linked account (basic facts only, never health data), details, earlier threads
 * Inbound HTML is sanitized on the server and shown only inside <iframe sandbox> with a
 * `default-src 'none'` CSP — never inserted into this page. Sidebar badge: unread threads, polled
 * every 60 s. Keys: j / k next / previous, r reply, n note, e close / reopen, Ctrl+Enter send.
 */
(function adminV4Support(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const api = (path, opts) => global.api(`/support${path}`, opts);
  const toast = (m, k) => global.toast?.(m, k);
  const adminState = () => (typeof state !== 'undefined' ? state : null);

  if (typeof ICONS === 'object') {
    const add = (k, v) => { if (!ICONS[k]) ICONS[k] = v; };
    add('inbox', '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>');
    add('paperclip', '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>');
    add('edit', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>');
    add('plus', '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>');
    add('lock', '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>');
    add('mail', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>');
    add('back', '<path d="M15 18l-6-6 6-6"/>');
    add('check', '<path d="M20 6 9 17l-5-5"/>');
    add('undo', '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>');
    add('copy', '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>');
    add('eye', '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>');
    add('zap', '<path d="M13 2 3 14h9l-1 8 10-12h-9Z"/>');
  }

  const SUBS = [['inbox', 'შემოსული'], ['snippets', 'სწრაფი პასუხები']];
  const STATUS = { new: ['ახალი', 'is-accent'], open: ['ღია', 'is-info'], waiting: ['ელოდება პასუხს', 'is-warn'], closed: ['დახურული', 'is-plain'] };
  const FILTERS = [['active', 'აქტიური'], ['new', 'ახალი'], ['open', 'ღია'], ['waiting', 'ელოდება'], ['closed', 'დახურული'], ['all', 'ყველა']];
  const BODY_NOTE = {
    pending: 'ტექსტი იტვირთება Resend-იდან…',
    restricted: 'ტექსტი ვერ წავიკითხეთ: Resend-ის გასაღებს მხოლოდ გაგზავნის უფლება აქვს. დაამატე RESEND_INBOUND_API_KEY (Full access) Render-ში.',
    failed: 'ტექსტი ვერ ჩამოიტვირთა რამდენიმე ცდის შემდეგ.',
  };
  const INKS = ['#0F766E', '#1D4ED8', '#7C3AED', '#BE185D', '#B45309', '#15803D', '#0369A1'];
  const badge = (key) => { const [label, tone] = STATUS[key] || [key, 'is-plain']; return `<span class="s-badge ${tone}">${esc(label)}</span>`; };
  const nameOf = (t) => t.counterpartName || t.counterpartEmail || '—';
  const ACCOUNT_STATUS = { ACTIVE: 'აქტიური', BLOCKED: 'დაბლოკილი', DELETED: 'წაშლილი', PENDING: 'მოლოდინში' };

  const st = { sub: 'inbox', filter: { status: 'active', mine: false, unread: false, q: '', offset: 0 }, threadId: null, config: null, composeMode: 'reply', snippets: null, list: [], thread: null, sideOpen: false };

  /* ═════════ Helpers ═════════ */
  function hash(s) { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
  function initials(s) {
    const clean = String(s || '?').replace(/<.*>/, '').trim();
    const parts = clean.includes('@') ? [clean.split('@')[0]] : clean.split(/\s+/);
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2);
    return letters.toUpperCase();
  }
  function avatar(seed, label, size = '') {
    return `<span class="sx-av ${size}" style="--av:${INKS[hash(seed) % INKS.length]}" aria-hidden="true">${esc(initials(label || seed))}</span>`;
  }
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  function dayLabel(iso) {
    const d = new Date(iso);
    const now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (dayKey(d) === dayKey(now)) return 'დღეს';
    if (dayKey(d) === dayKey(y)) return 'გუშინ';
    return d.toLocaleDateString('ka-GE', { day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }
  const clock = (iso) => new Date(iso).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', hour12: false });
  function shortWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (dayKey(d) === dayKey(now)) return clock(iso);
    const label = dayLabel(iso);
    return label === 'გუშინ' ? 'გუშინ' : d.toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' });
  }
  const fullWhen = (iso) => (iso ? `${dayLabel(iso)}, ${clock(iso)}` : '—');
  function params() { return typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || ''); }
  function writeHash() {
    const p = params();
    p.set('tab', st.sub);
    if (st.threadId && st.sub === 'inbox') p.set('thread', st.threadId); else p.delete('thread');
    const next = `#/support?${p.toString()}`;
    if (location.hash !== next) history.replaceState({ tab: 'support' }, '', next);
  }
  const typing = () => { const a = doc.activeElement; return a && (a.matches?.('input, textarea, select, [contenteditable="true"]')); };
  const isVisible = () => { const r = $('tab-support'); return r && !r.classList.contains('hidden') && r.offsetParent !== null; };

  /* ═════════ Sidebar badge ═════════ */
  let badgeTimer = null;
  let badgeDenied = false;
  function navButton() { return doc.querySelector('.v3-sidebar .nav[data-tab="support"]'); }
  function paintBadge(n) {
    const btn = navButton();
    if (!btn) return;
    let el = btn.querySelector('.s-nav-count');
    if (!el) { el = doc.createElement('span'); el.className = 's-nav-count'; btn.appendChild(el); }
    el.hidden = !n;
    el.textContent = n > 99 ? '99+' : String(n || '');
    btn.setAttribute('aria-label', n ? `მხარდაჭერა — ${n} წაუკითხავი` : 'მხარდაჭერა');
  }
  async function refreshBadge() {
    if (badgeDenied || doc.hidden) return;
    if (doc.documentElement.dataset.ready !== 'app' || !adminState()?.token) return;
    try {
      const r = await api('/summary');
      paintBadge(Number(r.unread) || 0);
    } catch (err) {
      if (err?.status === 403) { badgeDenied = true; paintBadge(0); }
    }
  }
  function startBadge() {
    if (badgeTimer) return;
    const btn = navButton();
    if (btn && typeof global.icon === 'function') { btn.querySelector('svg.icon')?.remove(); btn.insertAdjacentHTML('afterbegin', global.icon('inbox')); }
    setTimeout(refreshBadge, 3000);
    badgeTimer = setInterval(refreshBadge, 60_000);
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden) void refreshBadge(); });
  }

  /* ═════════ Shell ═════════ */
  async function renderSupportAdmin() {
    const root = $('tab-support');
    if (!root) return;
    const p = params();
    st.sub = SUBS.some(([k]) => k === p.get('tab')) ? p.get('tab') : st.sub || 'inbox';
    st.threadId = p.get('thread') || st.threadId;
    root.innerHTML = `<div class="sx v3-tab-shell">
      <div class="sx-top">
        <div class="s-segment" role="tablist" aria-label="მხარდაჭერის განყოფილებები">${SUBS.map(([k, l]) => `<button type="button" role="tab" data-support-sub="${k}" aria-selected="${k === st.sub}">${l}</button>`).join('')}</div>
        <div class="sx-health" id="support-health" aria-live="polite"></div>
        <button type="button" class="btn ghost compact" data-support-refresh title="განახლება">${ico('refresh')}<span>განახლება</span></button>
      </div>
      <div id="support-callouts"></div>
      <div id="support-pane"></div>
    </div>`;
    root.querySelectorAll('[data-support-sub]').forEach((btn) => btn.addEventListener('click', () => {
      st.sub = btn.dataset.supportSub;
      writeHash();
      root.querySelectorAll('[data-support-sub]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      void paintSub();
    }));
    root.querySelector('[data-support-refresh]').onclick = () => { void paintCallouts(); void paintSub(); void refreshBadge(); };
    void paintCallouts();
    await paintSub();
  }

  async function paintCallouts() {
    const box = $('support-callouts');
    const chips = $('support-health');
    if (!box) return;
    try {
      const c = await api('/config');
      st.config = c;
      const h = c.health || {};
      const out = [];
      if (h.installed === false) out.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>მხარდაჭერის ცხრილები ჯერ არ არის დაყენებული.</b> შეიქმნება შემდეგი დეპლოისას (db:install).</p></div>`);
      if (!c.webhookConfigured) out.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>Webhook არ არის მორგებული</b> (RESEND_WEBHOOK_SECRET) — შემოსული წერილები აქ ვერ მოვა.</p></div>`);
      if (!c.inboundKeyConfigured && (h.restricted30 > 0 || h.inboundKeyNeeded)) out.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>ჩანს მხოლოდ გამგზავნი და სათაური.</b> ტექსტის წასაკითხად Render-ში დაამატე RESEND_INBOUND_API_KEY (Resend-ის Full access გასაღები).</p></div>`);
      if (c.emailEnabled === false) out.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>ელფოსტა გამორთულია</b> — პასუხები არ გაიგზავნება. ჩართე #/email → მიმოხილვა.</p></div>`);
      box.innerHTML = out.length ? `<div class="s-stack sx-callouts">${out.join('')}</div>` : '';
      if (chips && h.installed !== false) {
        const dot = (ok) => `<i class="sx-dot ${ok ? 'is-ok' : 'is-warn'}"></i>`;
        chips.innerHTML = `
          <span class="sx-chip" title="ბოლო შემოსული წერილი">${dot(h.eventsArriving)}${h.lastReceivedAt ? `ბოლო: ${esc(fullWhen(h.lastReceivedAt))}` : 'ჯერ არაფერი მოსულა'}</span>
          <span class="sx-chip" title="შემოსული წერილები">7 დღე · <b>${fmt(h.count7)}</b></span>
          <span class="sx-chip" title="30 დღე">30 დღე · <b>${fmt(h.count30)}</b></span>
          <span class="sx-chip" title="ტექსტის წაკითხვა">${dot(h.inboundKeyConfigured || !h.inboundKeyNeeded)}${h.inboundKeyConfigured ? 'სრული ტექსტი' : h.inboundKeyNeeded ? 'მხოლოდ მეტამონაცემი' : 'ტექსტი იკითხება'}</span>`;
      }
    } catch (err) {
      box.innerHTML = err?.status === 403 ? `<div class="s-callout is-warn">${ico('shield')}<p>შენს ანგარიშს არ აქვს SUPPORT_VIEW უფლება.</p></div>` : '';
      if (chips) chips.innerHTML = '';
    }
  }

  async function paintSub() {
    const pane = $('support-pane');
    if (!pane) return;
    pane.innerHTML = '<div class="sx-shell is-loading"><div class="v3-skel" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>';
    try {
      if (st.sub === 'snippets') await paintSnippets(pane);
      else await paintInbox(pane);
    } catch (err) {
      pane.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      pane.querySelector('[data-retry]').onclick = () => void paintSub();
    }
  }

  /* ═════════ Inbox ═════════ */
  async function paintInbox(pane) {
    pane.innerHTML = `<div class="sx-shell${st.threadId ? ' has-thread' : ''}${st.sideOpen ? ' side-open' : ''}" id="support-shell">
      <aside class="sx-list" aria-label="საუბრები">
        <div class="sx-list-head">
          <label class="sx-search">${ico('search')}<span class="sr-only">ძებნა</span><input type="search" data-filter-q placeholder="ძებნა: სახელი, მისამართი, სათაური" value="${esc(st.filter.q)}"></label>
          <div class="sx-filters" role="tablist" aria-label="სტატუსი" id="support-filters"></div>
          <div class="sx-toggles">
            <button type="button" class="sx-toggle" data-toggle="mine" aria-pressed="${st.filter.mine}">${ico('user')}ჩემი</button>
            <button type="button" class="sx-toggle" data-toggle="unread" aria-pressed="${st.filter.unread}"><i class="sx-dot is-accent"></i>წაუკითხავი</button>
          </div>
        </div>
        <ul class="sx-rows" role="list" id="support-list"></ul>
        <div class="sx-list-foot" id="support-pager"></div>
      </aside>
      <section class="sx-conv" aria-label="საუბარი" id="support-thread"></section>
      <aside class="sx-side" aria-label="კონტაქტი" id="support-side"></aside>
    </div>`;
    const head = pane.querySelector('.sx-list-head');
    let timer = null;
    head.querySelector('[data-filter-q]').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => { st.filter = { ...st.filter, q: e.target.value.trim(), offset: 0 }; void paintList(); }, 300);
    });
    head.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.toggle;
      st.filter = { ...st.filter, [k]: !st.filter[k], offset: 0 };
      b.setAttribute('aria-pressed', String(st.filter[k]));
      void paintList();
    }));
    await Promise.all([paintList(), paintThread()]);
  }

  async function paintList() {
    const box = $('support-list');
    const filters = $('support-filters');
    const pager = $('support-pager');
    if (!box) return;
    const f = st.filter;
    const q = new URLSearchParams({ status: f.status, offset: String(f.offset || 0), limit: '40' });
    if (f.mine) q.set('mine', '1');
    if (f.unread) q.set('unread', '1');
    if (f.q) q.set('q', f.q);
    if (!box.childElementCount) box.innerHTML = '<li class="sx-rows-skel"><i></i><i></i><i></i></li>';
    const d = await api(`/threads?${q}`);
    const c = d.counts || {};
    const countOf = (k) => (k === 'active' ? (c.new || 0) + (c.open || 0) + (c.waiting || 0) : k === 'all' ? Object.values(c).reduce((s, n) => s + n, 0) : c[k] || 0);
    const off = f.offset || 0;
    const threads = d.threads || [];
    st.list = threads;
    st.admins = d.admins || [];
    st.me = d.me;
    if (filters) {
      filters.innerHTML = FILTERS.map(([k, l]) => `<button type="button" role="tab" class="sx-filter" aria-selected="${k === f.status}" data-filter-status="${k}">${l}<i>${fmt(countOf(k))}</i></button>`).join('');
      filters.querySelectorAll('[data-filter-status]').forEach((b) => b.addEventListener('click', () => { st.filter = { ...st.filter, status: b.dataset.filterStatus, offset: 0 }; void paintList(); }));
    }
    box.innerHTML = threads.length ? threads.map((t) => {
      const pv = t.preview;
      const pvText = pv ? (pv.pending ? 'ტექსტი იტვირთება…' : pv.text || '(ცარიელი)') : '';
      return `<li><button type="button" class="sx-row${t.id === st.threadId ? ' is-active' : ''}${t.unread ? ' is-unread' : ''}" data-thread="${esc(t.id)}">
        ${avatar(t.counterpartEmail, nameOf(t))}
        <span class="sx-row-main">
          <span class="sx-row-top"><b>${esc(nameOf(t))}</b><time datetime="${esc(t.lastMessageAt)}">${esc(shortWhen(t.lastMessageAt))}</time></span>
          <span class="sx-row-subject">${esc(t.subject || '(უსათაურო)')}</span>
          ${pvText ? `<span class="sx-row-preview">${pv?.direction === 'outbound' ? `${ico('undo')}<em>შენ:</em> ` : ''}${esc(pvText)}</span>` : ''}
          <span class="sx-row-meta">${badge(t.status)}${t.messageCount > 1 ? `<span>${fmt(t.messageCount)} წერილი</span>` : ''}${t.userId ? '<span class="sx-tag">მომხმარებელი</span>' : ''}</span>
        </span>
        ${t.unread ? '<i class="sx-unread" aria-label="წაუკითხავი"></i>' : ''}
      </button></li>`;
    }).join('') : `<li class="sx-rows-empty">${ico('inbox')}<b>${f.q || f.mine || f.unread ? 'ვერაფერი მოიძებნა' : 'შემოსული ცარიელია'}</b><span>${f.q || f.mine || f.unread ? 'სცადე სხვა ფილტრი ან ძებნა.' : 'ახალი წერილები support@medicard.ge-ზე აქ გამოჩნდება.'}</span></li>`;
    if (pager) {
      pager.innerHTML = d.total > 40
        ? `<span>${fmt(d.total ? off + 1 : 0)}–${fmt(Math.min(off + threads.length, d.total))} / ${fmt(d.total)}</span><div><button type="button" class="btn compact ghost" data-prev ${off ? '' : 'disabled'} aria-label="წინა">${ico('back')}</button><button type="button" class="btn compact ghost" data-next ${off + threads.length < d.total ? '' : 'disabled'} aria-label="შემდეგი" style="transform:scaleX(-1)">${ico('back')}</button></div>`
        : `<span>${fmt(d.total)} საუბარი</span><span class="sx-keys" title="კლავიატურა"><kbd>j</kbd><kbd>k</kbd> ნავიგაცია · <kbd>r</kbd> პასუხი</span>`;
      pager.querySelector('[data-prev]')?.addEventListener('click', () => { st.filter.offset = Math.max(0, off - 40); void paintList(); });
      pager.querySelector('[data-next]')?.addEventListener('click', () => { st.filter.offset = off + 40; void paintList(); });
    }
    box.querySelectorAll('[data-thread]').forEach((b) => b.addEventListener('click', () => openThread(b.dataset.thread)));
  }

  function openThread(id) {
    guardDiscard(() => {
      st.threadId = id;
      st.composeMode = 'reply';
      writeHash();
      doc.querySelectorAll('#support-list [data-thread]').forEach((x) => {
        const on = x.dataset.thread === id;
        x.classList.toggle('is-active', on);
        if (on) { x.classList.remove('is-unread'); x.querySelector('.sx-unread')?.remove(); x.scrollIntoView({ block: 'nearest' }); }
      });
      $('support-shell')?.classList.add('has-thread');
      void paintThread().then(refreshBadge);
    });
  }

  /** Unsent composer text is never dropped silently. */
  function guardDiscard(proceed) {
    const ta = doc.querySelector('#support-thread [data-compose-body]');
    if (ta && ta.value.trim()) {
      V().openConfirm?.({ title: 'დაუსრულებელი პასუხი', message: 'დაწერილი ტექსტი დაიკარგება. გავაგრძელო?', confirmLabel: 'გაგრძელება', variant: 'danger', onConfirm: proceed });
      if (!V().openConfirm) proceed();
      return;
    }
    proceed();
  }

  function frameDoc(html) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><base target="_blank"><style>html,body{margin:0}body{padding:2px 2px 8px;font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:transparent;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}a{color:#0f766e}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #e2e8f0;color:#64748b}</style></head><body>${html}</body></html>`;
  }

  function messageHtml(m, t) {
    if (m.direction === 'note') {
      return `<article class="sx-note" data-message="${esc(m.id)}">
        <header>${ico('lock')}<b>${esc(m.author || 'ადმინი')}</b><span>შიდა შენიშვნა · მხოლოდ ადმინები ხედავენ</span><time>${esc(clock(m.createdAt))}</time></header>
        <pre class="sx-text" data-text>${esc(m.textBody || '')}</pre>
      </article>`;
    }
    const out = m.direction === 'outbound';
    const name = out ? (m.author || 'ადმინი') : (m.fromName || m.fromEmail || nameOf(t));
    const hasHtml = Boolean(m.htmlBody);
    const pending = ['pending', 'restricted', 'failed'].includes(m.bodyStatus);
    const body = pending
      ? `<div class="sx-body-note${m.bodyStatus === 'pending' ? '' : ' is-warn'}">${ico(m.bodyStatus === 'pending' ? 'refresh' : 'alert')}<span>${esc(BODY_NOTE[m.bodyStatus])}</span>${m.bodyStatus !== 'pending' ? `<button type="button" class="btn compact ghost" data-refetch="${esc(m.id)}">ხელახლა ცდა</button>` : ''}</div>`
      : `${hasHtml ? `<iframe class="sx-frame" title="წერილის ტექსტი" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" data-frame></iframe>` : ''}
         <pre class="sx-text" data-text ${hasHtml ? 'hidden' : ''}>${esc(m.textBody || '(ცარიელი)')}</pre>`;
    const atts = (m.attachments || []).length
      ? `<div class="sx-atts">${m.attachments.map((a) => `<button type="button" class="sx-att" data-att="${esc(a.id)}" data-msg="${esc(m.id)}" data-name="${esc(a.filename)}">${ico('paperclip')}<span>${esc(a.filename)}</span>${a.size ? `<small>${fmt(Math.ceil(a.size / 1024))} KB</small>` : ''}</button>`).join('')}</div>`
      : '';
    const failed = out && m.sendStatus && !['sent', 'delivered', 'queued'].includes(m.sendStatus) ? `<span class="s-badge is-bad">${esc(m.sendStatus)}</span>` : '';
    return `<article class="sx-msg ${out ? 'is-out' : 'is-in'}" data-message="${esc(m.id)}">
      ${out ? '' : avatar(m.fromEmail || t.counterpartEmail, name)}
      <div class="sx-bubble">
        <header>
          <b>${esc(name)}</b>
          ${out ? `<span class="sx-muted">→ ${esc((m.toEmails || []).join(', ') || t.counterpartEmail)}</span>` : m.fromName ? `<span class="sx-muted">${esc(m.fromEmail)}</span>` : ''}
          ${m.isAuto ? '<span class="sx-tag">ავტომატური</span>' : ''}${failed}
          <span class="sx-bubble-tools">
            ${hasHtml && !pending ? `<button type="button" class="sx-mini" data-view-toggle aria-pressed="false" title="ჩვეულებრივი ტექსტი">${ico('eye')}<span>ტექსტი</span></button>` : ''}
            <time title="${esc(fullWhen(m.createdAt))}">${esc(clock(m.createdAt))}</time>
          </span>
        </header>
        ${body}${atts}
      </div>
    </article>`;
  }

  function timelineHtml(messages, t) {
    let last = '';
    return messages.map((m) => {
      const k = dayKey(new Date(m.createdAt));
      const sep = k !== last ? `<div class="sx-day"><span>${esc(dayLabel(m.createdAt))}</span></div>` : '';
      last = k;
      return sep + messageHtml(m, t);
    }).join('');
  }

  async function paintThread() {
    const box = $('support-thread');
    const side = $('support-side');
    if (!box) return;
    if (!st.threadId) {
      box.innerHTML = `<div class="sx-empty">${ico('mail')}<b>აირჩიე საუბარი</b><span>მარცხენა სიიდან გახსენი წერილი, წაიკითხე და უპასუხე — პასუხი წავა support@medicard.ge-დან, იმავე ძაფში.</span></div>`;
      if (side) side.innerHTML = '';
      $('support-shell')?.classList.remove('has-thread');
      return;
    }
    box.innerHTML = '<div class="sx-conv-skel"><i></i><i></i><i></i></div>';
    let d;
    try {
      d = await api(`/threads/${encodeURIComponent(st.threadId)}`);
    } catch (err) {
      if (err?.status === 404) { st.threadId = null; writeHash(); return paintThread(); }
      box.innerHTML = `<div class="sx-empty">${ico('alert')}<b>ვერ ჩაიტვირთა</b><span>${esc(err?.message || '')}</span><button type="button" class="btn compact" data-retry>ხელახლა ცდა</button></div>`;
      box.querySelector('[data-retry]').onclick = () => void paintThread();
      return;
    }
    st.thread = d;
    const t = d.thread;
    const admins = d.admins || [];
    const closed = t.status === 'closed';
    box.innerHTML = `
      <header class="sx-conv-head">
        <button type="button" class="sx-icon-btn sx-back" data-back aria-label="სიაში დაბრუნება">${ico('back')}</button>
        <div class="sx-conv-title">
          <h2>${esc(t.subject || '(უსათაურო)')}</h2>
          <p>${esc(nameOf(t))}${t.counterpartName ? ` · ${esc(t.counterpartEmail)}` : ''} · ${fmt(t.messageCount)} წერილი</p>
        </div>
        <div class="sx-conv-actions">
          <label class="sx-select" title="სტატუსი">${badge(t.status)}<select data-status aria-label="სტატუსი">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="sx-select" title="პასუხისმგებელი">${ico('user')}<span>${esc(admins.find((a) => a.id === t.assignedAdminId)?.name || 'მიუბმელი')}</span><select data-assign aria-label="პასუხისმგებელი"><option value="">მიუბმელი</option>${admins.map((a) => `<option value="${esc(a.id)}" ${a.id === t.assignedAdminId ? 'selected' : ''}>${esc(a.name)}${a.id === d.me ? ' (მე)' : ''}</option>`).join('')}</select></label>
          <button type="button" class="btn compact ${closed ? '' : 'primary'}" data-close-toggle title="კლავიში e">${ico(closed ? 'undo' : 'check')}${closed ? 'ხელახლა გახსნა' : 'დახურვა'}</button>
          <button type="button" class="sx-icon-btn" data-mark-unread title="წაუკითხავად მონიშვნა" aria-label="წაუკითხავად მონიშვნა">${ico('mail')}</button>
          <button type="button" class="sx-icon-btn sx-side-btn" data-side aria-label="კონტაქტის ინფორმაცია" title="კონტაქტი">${ico('user')}</button>
        </div>
      </header>
      ${d.suppressed ? `<div class="sx-banner is-warn">${ico('alert')}<span>ეს მისამართი დაბლოკილია (bounce ან საჩივარი) — პასუხი არ გაიგზავნება. შეამოწმე #/email → „მისამართის შემოწმება“.</span></div>` : ''}
      <div class="sx-timeline" data-timeline>${timelineHtml(d.messages || [], t)}</div>
      <footer class="sx-composer" data-composer></footer>`;

    const byId = Object.fromEntries((d.messages || []).map((m) => [m.id, m]));
    box.querySelectorAll('[data-message]').forEach((el) => {
      const m = byId[el.dataset.message];
      const frame = el.querySelector('[data-frame]');
      if (frame && m?.htmlBody) {
        frame.srcdoc = frameDoc(m.htmlBody);
        // The sandbox (no same-origin) hides the frame's real height, so size it from the text.
        const text = String(m.textBody || m.htmlBody.replace(/<[^>]+>/g, ' '));
        const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 90)), 0);
        const media = /<(img|table)\b/i.test(m.htmlBody) ? 240 : 0;
        frame.style.height = `${Math.min(640, Math.max(34, 12 + lines * 23 + media))}px`;
      }
      el.querySelector('[data-view-toggle]')?.addEventListener('click', (e) => {
        const b = e.currentTarget;
        const showText = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(showText));
        b.querySelector('span').textContent = showText ? 'HTML' : 'ტექსტი';
        if (frame) frame.hidden = showText;
        el.querySelector('[data-text]').hidden = !showText;
      });
    });
    box.querySelectorAll('[data-refetch]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/messages/${encodeURIComponent(b.dataset.refetch)}/refetch`, { method: 'POST' }); toast('ხელახლა ვცდი — განაახლე წუთში', 'ok'); } catch (e) { toast(e.message, 'bad'); }
    }));
    box.querySelectorAll('[data-att]').forEach((b) => b.addEventListener('click', () => void downloadAttachment(b)));
    box.querySelector('[data-status]').addEventListener('change', (e) => void patchThread({ status: e.target.value }, 'სტატუსი შეიცვალა'));
    box.querySelector('[data-assign]').addEventListener('change', (e) => void patchThread({ assignedAdminId: e.target.value || null }, 'პასუხისმგებელი შეიცვალა'));
    box.querySelector('[data-close-toggle]').onclick = () => void patchThread({ status: closed ? 'open' : 'closed' }, closed ? 'საუბარი ხელახლა გაიხსნა' : 'საუბარი დაიხურა');
    box.querySelector('[data-mark-unread]').onclick = async () => {
      await patchThread({ unread: true }, 'მოინიშნა წაუკითხავად', true);
      st.threadId = null; writeHash(); void paintThread(); void paintList();
    };
    box.querySelector('[data-back]').onclick = () => guardDiscard(() => { st.threadId = null; writeHash(); void paintThread(); });
    box.querySelector('[data-side]').onclick = () => { st.sideOpen = !st.sideOpen; $('support-shell')?.classList.toggle('side-open', st.sideOpen); };
    paintSide(d);
    await paintComposer(box.querySelector('[data-composer]'), t, d);
    const tl = box.querySelector('[data-timeline]');
    if (tl) tl.scrollTop = tl.scrollHeight;
  }

  function paintSide(d) {
    const side = $('support-side');
    if (!side) return;
    const t = d.thread;
    const u = d.user;
    const history = d.history || [];
    side.innerHTML = `
      <div class="sx-person">
        ${avatar(t.counterpartEmail, nameOf(t), 'is-lg')}
        <b>${esc(t.counterpartName || t.counterpartEmail)}</b>
        <button type="button" class="sx-copy" data-copy="${esc(t.counterpartEmail)}" title="კოპირება">${esc(t.counterpartEmail)}${ico('copy')}</button>
      </div>
      <section class="sx-side-sec">
        <h4>ანგარიში</h4>
        ${u ? `<div class="sx-account">
            <div><b>${esc(u.fullName || 'მომხმარებელი')}</b><span>${esc(ACCOUNT_STATUS[u.status] || u.status || '')} · რეგისტრაცია ${esc(dayLabel(u.createdAt))}</span></div>
            <a class="btn compact" href="#/users/${encodeURIComponent(u.id)}">პროფილი</a>
          </div>`
          : '<p class="sx-muted">ამ მისამართით მედიქარდის ანგარიში არ არის (ან სხვა ელფოსტით არის დარეგისტრირებული).</p>'}
      </section>
      <section class="sx-side-sec">
        <h4>დეტალები</h4>
        <dl class="sx-dl">
          <dt>მისამართზე</dt><dd title="${esc(t.mailbox || 'support@medicard.ge')}">${esc(t.mailbox || 'support@medicard.ge')}</dd>
          <dt>დაიწყო</dt><dd>${esc(fullWhen(t.createdAt))}</dd>
          <dt>ბოლო შემოსული</dt><dd>${esc(fullWhen(t.lastInboundAt || t.lastMessageAt))}</dd>
          <dt>წერილები</dt><dd>${fmt(t.messageCount)}</dd>
          <dt>სტატუსი</dt><dd>${badge(t.status)}</dd>
        </dl>
      </section>
      <section class="sx-side-sec">
        <h4>წინა საუბრები${history.length ? ` <i>${fmt(history.length)}</i>` : ''}</h4>
        ${history.length ? `<ul class="sx-history">${history.map((h) => `<li><button type="button" data-open-thread="${esc(h.id)}"><span>${esc(h.subject || '(უსათაურო)')}</span><small>${badge(h.status)} ${esc(shortWhen(h.lastMessageAt))}</small></button></li>`).join('')}</ul>` : '<p class="sx-muted">ეს პირველი საუბარია ამ ადამიანთან.</p>'}
      </section>`;
    side.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(e.currentTarget.dataset.copy); toast('მისამართი დაკოპირდა', 'ok'); } catch { /* clipboard blocked */ }
    });
    side.querySelectorAll('[data-open-thread]').forEach((b) => b.addEventListener('click', () => openThread(b.dataset.openThread)));
  }

  async function patchThread(body, okMsg, quiet) {
    try {
      await api(`/threads/${encodeURIComponent(st.threadId)}`, { method: 'PATCH', body });
      toast(okMsg, 'ok');
      void refreshBadge();
      if (!quiet) { await paintList(); await paintThread(); }
    } catch (e) {
      toast(e.message, 'bad');
      void paintThread();
    }
  }

  async function downloadAttachment(btn) {
    const token = adminState()?.token;
    const base = typeof API !== 'undefined' ? API : '';
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      const res = await fetch(`${base}/api/admin/support/messages/${encodeURIComponent(btn.dataset.msg)}/attachments/${encodeURIComponent(btn.dataset.att)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        let msg = `შეცდომა ${res.status}`;
        try { msg = (await res.json()).error || msg; } catch { /* not json */ }
        throw new Error(msg);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = doc.createElement('a');
      a.href = url;
      a.download = btn.dataset.name || 'attachment';
      doc.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      toast(e.message, 'bad');
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }

  async function loadSnippets(force) {
    if (!st.snippets || force) st.snippets = (await api('/snippets').catch(() => ({ snippets: [] }))).snippets || [];
    return st.snippets;
  }

  /* ═════════ Composer ═════════ */
  async function paintComposer(box, thread, d) {
    if (!box) return;
    const snippets = await loadSnippets();
    const note = st.composeMode === 'note';
    const blocked = d.suppressed;
    box.classList.toggle('is-note', note);
    box.innerHTML = `
      <div class="sx-compose-top">
        <div class="sx-modes" role="tablist" aria-label="რას წერ">
          <button type="button" role="tab" aria-selected="${!note}" data-mode="reply">${ico('undo')}პასუხი</button>
          <button type="button" role="tab" aria-selected="${note}" data-mode="note">${ico('lock')}შიდა შენიშვნა</button>
        </div>
        <span class="sx-compose-to">${note ? 'ჩანს მხოლოდ ადმინებს, არ იგზავნება' : `→ ${esc(thread.counterpartEmail)}`}</span>
        ${note || !snippets.length ? '' : `<div class="sx-snip"><button type="button" class="sx-mini" data-snip-open aria-haspopup="menu" aria-expanded="false">${ico('zap')}<span>სწრაფი პასუხი</span></button>
          <div class="sx-snip-menu" role="menu" hidden>${snippets.map((s) => `<button type="button" role="menuitem" data-snippet="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.body.slice(0, 90))}</span></button>`).join('')}</div></div>`}
      </div>
      <textarea class="sx-input" data-compose-body rows="3" maxlength="${note ? 5000 : 20000}" placeholder="${note ? 'მაგ.: ვამოწმებ Android 14-ზე, ხვალ დავუკავშირდები' : 'დაწერე პასუხი… (აბზაცი — ცარიელი ხაზი, **მუქი**, სია „- “-ით)'}"></textarea>
      <div class="sx-compose-foot">
        <span class="sx-keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> ${note ? 'შენახვა' : 'გაგზავნა'}</span>
        ${note ? '' : `<label class="sx-after">გაგზავნის შემდეგ<select data-after>${['waiting', 'open', 'closed'].map((k) => `<option value="${k}" ${k === 'waiting' ? 'selected' : ''}>${STATUS[k][0]}</option>`).join('')}</select></label>
          <button type="button" class="btn compact ghost" data-preview>${ico('eye')}გადახედვა</button>`}
        <button type="button" class="btn primary compact" data-send ${!note && blocked ? 'disabled' : ''}>${note ? `${ico('lock')}შენახვა` : `${ico('send')}გაგზავნა`}</button>
      </div>`;
    const ta = box.querySelector('[data-compose-body]');
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(320, Math.max(84, ta.scrollHeight + 2))}px`; };
    ta.addEventListener('input', grow);
    box.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.mode === st.composeMode) return;
      const text = ta.value;
      st.composeMode = b.dataset.mode;
      void paintComposer(box, thread, d).then(() => { const next = box.querySelector('[data-compose-body]'); if (next) { next.value = text; next.dispatchEvent(new Event('input')); next.focus(); } });
    }));
    const menu = box.querySelector('.sx-snip-menu');
    const opener = box.querySelector('[data-snip-open]');
    opener?.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; opener.setAttribute('aria-expanded', String(open)); });
    box.querySelectorAll('[data-snippet]').forEach((b) => b.addEventListener('click', () => {
      const s = snippets.find((x) => x.id === b.dataset.snippet);
      menu.hidden = true;
      if (!s) return;
      const at = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, at) + s.body + ta.value.slice(ta.selectionEnd ?? at);
      grow();
      ta.focus();
      ta.selectionStart = ta.selectionEnd = at + s.body.length;
    }));
    box.querySelector('[data-preview]')?.addEventListener('click', async () => {
      try {
        const r = await api(`/threads/${encodeURIComponent(thread.id)}/preview`, { method: 'POST', body: { body: ta.value } });
        V().openDialog?.({
          title: 'პასუხის გადახედვა',
          description: `${r.from} → ${r.to} · ${r.subject}`,
          body: '<iframe class="s-preview-frame" title="პასუხის გადახედვა" sandbox="" id="support-preview-frame"></iframe>',
          wide: true,
          watchDirty: false,
        });
        const frame = $('support-preview-frame');
        if (frame) frame.srcdoc = r.html;
      } catch (e) { toast(e.message, 'bad'); }
    });
    const send = async () => {
      const btn = box.querySelector('[data-send]');
      const text = ta.value.trim();
      if (!text) { toast(note ? 'შენიშვნა ცარიელია' : 'პასუხი ცარიელია', 'warn'); ta.focus(); return; }
      if (btn.disabled) return;
      btn.disabled = true;
      btn.classList.add('is-loading');
      try {
        if (note) {
          await api(`/threads/${encodeURIComponent(thread.id)}/notes`, { method: 'POST', body: { body: text } });
          toast('შენიშვნა შენახულია', 'ok');
        } else {
          await api(`/threads/${encodeURIComponent(thread.id)}/reply`, { method: 'POST', body: { body: text, status: box.querySelector('[data-after]').value } });
          toast('პასუხი გაიგზავნა', 'ok');
        }
        ta.value = '';
        st.composeMode = 'reply';
        await Promise.all([paintThread(), paintList()]);
      } catch (err) {
        toast(err.message, 'bad');
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
    box.querySelector('[data-send]').addEventListener('click', () => void send());
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void send(); } });
  }

  /* ═════════ Keyboard & outside clicks ═════════ */
  doc.addEventListener('click', (e) => {
    if (e.target.closest?.('.sx-snip')) return;
    doc.querySelectorAll('.sx-snip-menu:not([hidden])').forEach((m) => {
      m.hidden = true;
      m.parentElement?.querySelector('[data-snip-open]')?.setAttribute('aria-expanded', 'false');
    });
  });
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') doc.querySelectorAll('.sx-snip-menu:not([hidden])').forEach((m) => { m.hidden = true; });
    if (e.ctrlKey || e.metaKey || e.altKey || typing() || !isVisible() || st.sub !== 'inbox') return;
    const ids = st.list.map((t) => t.id);
    const at = ids.indexOf(st.threadId);
    if (e.key === 'j' || e.key === 'k') {
      if (!ids.length) return;
      e.preventDefault();
      const next = e.key === 'j' ? Math.min(ids.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
      if (ids[next] && ids[next] !== st.threadId) openThread(ids[next]);
    } else if ((e.key === 'r' || e.key === 'n') && st.threadId) {
      e.preventDefault();
      const want = e.key === 'n' ? 'note' : 'reply';
      const box = doc.querySelector('#support-thread [data-composer]');
      if (st.composeMode !== want && box && st.thread) {
        st.composeMode = want;
        void paintComposer(box, st.thread.thread, st.thread).then(() => box.querySelector('[data-compose-body]')?.focus());
      } else box?.querySelector('[data-compose-body]')?.focus();
    } else if (e.key === 'e' && st.threadId) {
      e.preventDefault();
      doc.querySelector('#support-thread [data-close-toggle]')?.click();
    }
  });

  /* ═════════ Quick replies ═════════ */
  async function paintSnippets(pane) {
    const list = await loadSnippets(true);
    pane.innerHTML = `<section class="s-card">
      <header class="s-card-head"><div><h3>სწრაფი პასუხები</h3><p>ხშირი პასუხების შაბლონები. პასუხის წერისას „სწრაფი პასუხი“ ჩასვამს ტექსტს კურსორთან — შემდეგ შეგიძლია შეცვალო.</p></div>
        <button type="button" class="btn primary compact" data-new>${ico('plus')} ახალი</button></header>
      <div class="s-card-body">${list.length ? `<div class="sx-snip-grid">${list.map((s) => `<article class="sx-snip-card" data-snip="${esc(s.id)}">
          <header><b>${esc(s.title)}</b><time>${esc(shortWhen(s.updatedAt))}</time></header>
          <p>${esc(s.body)}</p>
          <footer><button type="button" class="btn compact ghost" data-edit>${ico('edit')} რედაქტირება</button><button type="button" class="btn compact ghost danger" data-del>წაშლა</button></footer>
        </article>`).join('')}</div>`
        : `<div class="sx-empty is-inline">${ico('zap')}<b>სწრაფი პასუხი ჯერ არ არის</b><span>შექმენი პირველი — მაგ. „მადლობა, ვამოწმებთ და მალე მოგწერთ“.</span></div>`}</div>
    </section>`;
    pane.querySelector('[data-new]').onclick = () => openSnippetDialog(null);
    pane.querySelectorAll('[data-snip]').forEach((card) => {
      const s = list.find((x) => x.id === card.dataset.snip);
      card.querySelector('[data-edit]').onclick = () => openSnippetDialog(s);
      card.querySelector('[data-del]').onclick = () => V().openConfirm?.({
        title: `„${s.title}“ — წაშლა?`,
        message: 'შაბლონი წაიშლება. უკვე გაგზავნილ პასუხებზე გავლენა არ აქვს.',
        confirmLabel: 'წაშლა',
        variant: 'danger',
        onConfirm: async () => { await api(`/snippets/${encodeURIComponent(s.id)}`, { method: 'DELETE' }); toast('შაბლონი წაიშალა', 'warn'); await paintSub(); },
      });
    });
  }

  function openSnippetDialog(s) {
    const dlg = V().openDialog?.({
      title: s ? 'სწრაფი პასუხის რედაქტირება' : 'ახალი სწრაფი პასუხი',
      description: 'სათაური ჩანს მხოლოდ ადმინში. ტექსტი ჩაისმება პასუხში.',
      body: `<div class="s-stack">
        <label class="s-field"><span>სათაური</span><input type="text" id="snip-title" maxlength="80" value="${esc(s?.title || '')}"></label>
        <label class="s-field"><span>ტექსტი</span><textarea id="snip-body" rows="10" maxlength="20000">${esc(s?.body || '')}</textarea><small>**მუქი**, სია „- “-ით, ბმული [ტექსტი](https://…).</small></label>
        <p class="s-form-msg" id="snip-msg" role="status"></p></div>`,
      footer: '<button type="button" class="btn secondary" id="snip-cancel">გაუქმება</button><button type="button" class="btn primary" id="snip-save">შენახვა</button>',
    });
    $('snip-title')?.focus();
    $('snip-cancel').onclick = () => dlg?.close();
    $('snip-save').onclick = async () => {
      const body = { title: $('snip-title').value, body: $('snip-body').value };
      try {
        if (s) await api(`/snippets/${encodeURIComponent(s.id)}`, { method: 'PUT', body });
        else await api('/snippets', { method: 'POST', body });
        V().setDirty?.(false);
        dlg?.close();
        toast('შენახულია', 'ok');
        await paintSub();
      } catch (e) { $('snip-msg').textContent = e.message; }
    };
  }

  global.renderSupportAdmin = renderSupportAdmin;
  global.AdminV4Support = { renderSupportAdmin, refreshBadge };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', startBadge); else startBadge();
})(window);
