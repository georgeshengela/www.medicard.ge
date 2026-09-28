/**
 * MediCard Admin V4 — #/support მხარდაჭერა (/api/admin/support).
 *   შემოსული   threads for mail to support@medicard.ge (and any @medicard.ge): filters, search,
 *              thread view (sandboxed HTML / text), attachments, linked account, status, assignee,
 *              reply composer (snippets, preview) and internal notes
 *   შაბლონები  canned replies (SupportSnippet CRUD)
 * Inbound HTML is sanitized on the server and shown only inside <iframe sandbox> with a
 * `default-src 'none'` CSP — never inserted into this page. Sidebar badge: unread threads, polled
 * every 60 s. No health data is shown; a linked account links to #/users/:id.
 */
(function adminV4Support(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const when = (iso) => (iso ? (typeof global.fmtDate === 'function' ? global.fmtDate(iso) : new Date(iso).toLocaleString('ka-GE')) : '—');
  const api = (path, opts) => global.api(`/support${path}`, opts);
  const toast = (m, k) => global.toast?.(m, k);
  const adminState = () => (typeof state !== 'undefined' ? state : null);
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const failHtml = (err) => `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;

  if (typeof ICONS === 'object') {
    if (!ICONS.inbox) ICONS.inbox = '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>';
    if (!ICONS.paperclip) ICONS.paperclip = '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>';
    if (!ICONS.edit) ICONS.edit = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
    if (!ICONS.plus) ICONS.plus = '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';
  }

  const SUBS = [['inbox', 'შემოსული'], ['snippets', 'შაბლონები']];
  const STATUS = { new: ['ახალი', 'is-accent'], open: ['ღია', 'is-info'], waiting: ['ელოდება პასუხს', 'is-warn'], closed: ['დახურული', 'is-plain'] };
  const FILTERS = [['active', 'აქტიური'], ['new', 'ახალი'], ['open', 'ღია'], ['waiting', 'ელოდება'], ['closed', 'დახურული'], ['all', 'ყველა']];
  const BODY_NOTE = {
    pending: 'ტექსტი იტვირთება Resend-იდან…',
    restricted: 'ტექსტი ვერ წავიკითხეთ: Resend-ის გასაღებს მხოლოდ გაგზავნის უფლება აქვს. დაამატე RESEND_INBOUND_API_KEY (Full access) Render-ში — ახალ წერილებს და ბოლო 30 დღისას თავად ჩამოტვირთავს.',
    failed: 'ტექსტი ვერ ჩამოიტვირთა რამდენიმე ცდის შემდეგ.',
  };
  const badge = (key) => { const [label, tone] = STATUS[key] || [key, 'is-plain']; return `<span class="s-badge ${tone}">${esc(label)}</span>`; };
  const person = (t) => (t.counterpartName ? `${t.counterpartName} <${t.counterpartEmail}>` : t.counterpartEmail);

  const st = { sub: 'inbox', filter: { status: 'active', mine: false, unread: false, q: '', offset: 0 }, threadId: null, config: null, composeMode: 'reply', snippets: null };

  function params() {
    return typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || '');
  }
  function writeHash() {
    const p = params();
    p.set('tab', st.sub);
    if (st.threadId && st.sub === 'inbox') p.set('thread', st.threadId); else p.delete('thread');
    const next = `#/support?${p.toString()}`;
    if (location.hash !== next) history.replaceState({ tab: 'support' }, '', next);
  }

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
    root.innerHTML = `<div class="s-stack v3-tab-shell">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="მხარდაჭერის განყოფილებები">${SUBS.map(([k, l]) => `<button type="button" role="tab" data-support-sub="${k}" aria-selected="${k === st.sub}" class="${k === st.sub ? 'is-active' : ''}">${l}</button>`).join('')}</div>
        <button type="button" class="btn ghost compact" data-support-refresh>${ico('refresh')} განახლება</button>
      </div>
      <div id="support-callouts"></div>
      <div id="support-pane"></div>
    </div>`;
    root.querySelectorAll('[data-support-sub]').forEach((btn) => btn.addEventListener('click', () => {
      st.sub = btn.dataset.supportSub;
      writeHash();
      root.querySelectorAll('[data-support-sub]').forEach((b) => { const on = b === btn; b.setAttribute('aria-selected', String(on)); b.classList.toggle('is-active', on); });
      void paintSub();
    }));
    root.querySelector('[data-support-refresh]').onclick = () => { void paintCallouts(); void paintSub(); void refreshBadge(); };
    void paintCallouts();
    await paintSub();
  }

  async function paintCallouts() {
    const box = $('support-callouts');
    if (!box) return;
    try {
      const c = await api('/config');
      st.config = c;
      const h = c.health || {};
      const out = [];
      if (h.installed === false) out.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>მხარდაჭერის ცხრილები ჯერ არ არის დაყენებული.</b> შეიქმნება შემდეგი დეპლოისას (db:install → install-support).</p></div>`);
      if (!c.webhookConfigured) out.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>Webhook არ არის მორგებული</b> (RESEND_WEBHOOK_SECRET) — შემოსული წერილები აქ ვერ მოვა.</p></div>`);
      if (!c.inboundKeyConfigured && (h.restricted30 > 0 || h.inboundKeyNeeded)) out.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>მხოლოდ მეტამონაცემები.</b> ხედავ გამგზავნს, სათაურს და ფაილების სახელებს, მაგრამ არა ტექსტს: მიმდინარე RESEND_API_KEY „Sending access“ გასაღებია და მიღებულ წერილს ვერ კითხულობს. შექმენი Resend-ში „Full access“ გასაღები და ჩაწერე Render-ში როგორც RESEND_INBOUND_API_KEY.</p></div>`);
      if (c.emailEnabled === false) out.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>ელფოსტა გამორთულია</b> (კილ-სვიჩი) — პასუხები არ გაიგზავნება. ჩართე #/email → მიმოხილვა.</p></div>`);
      if (h.installed !== false) {
        const yes = (ok) => `<span class="s-badge ${ok ? 'is-ok' : 'is-warn'}">${ok ? 'კი' : 'არა'}</span>`;
        out.push(`<div class="s-metrics" aria-label="შემოსული ფოსტის მდგომარეობა">
          <div class="s-metric"><span>ბოლო შემოსული</span><strong>${esc(h.lastReceivedAt ? when(h.lastReceivedAt) : '—')}</strong><small>email.received მოდის: ${yes(h.eventsArriving)}</small></div>
          <div class="s-metric"><span>7 დღე</span><strong>${fmt(h.count7)}</strong><small>30 დღე: ${fmt(h.count30)}</small></div>
          <div class="s-metric"><span>წაუკითხავი</span><strong>${fmt(h.unread)}</strong><small>ღია საუბრებში</small></div>
          <div class="s-metric"><span>ტექსტის წაკითხვა</span><strong>${h.inboundKeyConfigured ? 'სრული' : h.inboundKeyNeeded ? 'მეტამონაცემი' : 'გამგზავნის გასაღებით'}</strong><small>RESEND_INBOUND_API_KEY: ${yes(h.inboundKeyConfigured)}${h.failed30 ? ` · ვერ ჩამოიტვირთა: ${fmt(h.failed30)}` : ''}</small></div>
        </div>`);
      }
      box.innerHTML = out.length ? `<div class="s-stack">${out.join('')}</div>` : '';
    } catch (err) {
      box.innerHTML = err?.status === 403 ? `<div class="s-callout is-warn">${ico('shield')}<p>შენს ანგარიშს არ აქვს SUPPORT_VIEW უფლება.</p></div>` : '';
    }
  }

  async function paintSub() {
    const pane = $('support-pane');
    if (!pane) return;
    pane.innerHTML = skel();
    try {
      if (st.sub === 'snippets') await paintSnippets(pane);
      else await paintInbox(pane);
    } catch (err) {
      pane.innerHTML = failHtml(err);
      pane.querySelector('[data-retry]').onclick = () => void paintSub();
    }
  }

  /* ═════════ შემოსული ═════════ */
  async function paintInbox(pane) {
    pane.innerHTML = `<div class="s-inbox">
      <section class="s-card s-inbox-list" aria-label="საუბრები"><div id="support-list">${skel()}</div></section>
      <section class="s-card s-inbox-thread" aria-label="საუბარი" id="support-thread"></section>
    </div>`;
    await Promise.all([paintList(), paintThread()]);
  }

  async function paintList() {
    const box = $('support-list');
    if (!box) return;
    const f = st.filter;
    const q = new URLSearchParams({ status: f.status, offset: String(f.offset || 0), limit: '40' });
    if (f.mine) q.set('mine', '1');
    if (f.unread) q.set('unread', '1');
    if (f.q) q.set('q', f.q);
    const d = await api(`/threads?${q}`);
    const c = d.counts || {};
    const countOf = (k) => (k === 'active' ? (c.new || 0) + (c.open || 0) + (c.waiting || 0) : k === 'all' ? Object.values(c).reduce((s, n) => s + n, 0) : c[k] || 0);
    const off = f.offset || 0;
    const threads = d.threads || [];
    const adminName = (id) => (d.admins || []).find((a) => a.id === id)?.name || '';
    box.innerHTML = `
      <header class="s-card-head"><div><h3>შემოსული</h3><p>წერილები support@medicard.ge-ზე და ნებისმიერ @medicard.ge მისამართზე.</p></div></header>
      <div class="s-card-body s-stack">
        <div class="s-segment s-segment-wrap" role="tablist" aria-label="სტატუსი">${FILTERS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === f.status}" data-filter-status="${k}">${l} <i>${fmt(countOf(k))}</i></button>`).join('')}</div>
        <div class="s-inbox-filters">
          <label class="s-field"><span class="sr-only">ძებნა</span><input type="search" data-filter-q placeholder="ძებნა: მისამართი, სახელი, სათაური" value="${esc(f.q)}"></label>
          <label class="s-check"><input type="checkbox" data-filter-mine ${f.mine ? 'checked' : ''}> ჩემზე მიბმული</label>
          <label class="s-check"><input type="checkbox" data-filter-unread ${f.unread ? 'checked' : ''}> წაუკითხავი</label>
        </div>
      </div>
      <div class="s-card-body is-flush"><ul class="s-thread-list" role="list">${threads.length ? threads.map((t) => `
        <li><button type="button" class="s-thread-row${t.id === st.threadId ? ' is-active' : ''}${t.unread ? ' is-unread' : ''}" data-thread="${esc(t.id)}">
          <span class="s-thread-top"><b>${esc(t.counterpartName || t.counterpartEmail)}</b><time>${esc(when(t.lastMessageAt))}</time></span>
          <span class="s-thread-subject">${t.unread ? '<i class="s-dot" aria-label="წაუკითხავი"></i>' : ''}${esc(t.subject || '(უსათაურო)')}</span>
          <span class="s-thread-meta">${badge(t.status)}${t.messageCount > 1 ? `<span class="s-muted">${fmt(t.messageCount)} წერილი</span>` : ''}${t.assignedAdminId ? `<span class="s-muted">→ ${esc(adminName(t.assignedAdminId) || 'ადმინი')}</span>` : ''}${t.userId ? '<span class="s-badge is-plain">მომხმარებელი</span>' : ''}</span>
        </button></li>`).join('') : '<li><div class="s-empty">წერილი არ მოიძებნა.</div></li>'}</ul>
        <div class="s-pager"><span>${fmt(d.total ? off + 1 : 0)}–${fmt(Math.min(off + threads.length, d.total))} / ${fmt(d.total)}</span>
          <div><button type="button" class="btn compact" data-prev ${off ? '' : 'disabled'}>წინა</button><button type="button" class="btn compact" data-next ${off + threads.length < d.total ? '' : 'disabled'}>შემდეგი</button></div></div>
      </div>`;
    box.querySelectorAll('[data-filter-status]').forEach((b) => b.addEventListener('click', () => { st.filter = { ...st.filter, status: b.dataset.filterStatus, offset: 0 }; void paintList(); }));
    box.querySelector('[data-filter-mine]').addEventListener('change', (e) => { st.filter = { ...st.filter, mine: e.target.checked, offset: 0 }; void paintList(); });
    box.querySelector('[data-filter-unread]').addEventListener('change', (e) => { st.filter = { ...st.filter, unread: e.target.checked, offset: 0 }; void paintList(); });
    let timer = null;
    box.querySelector('[data-filter-q]').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => { st.filter = { ...st.filter, q: e.target.value.trim(), offset: 0 }; void paintList().then(() => { const i = box.querySelector('[data-filter-q]'); if (i) { i.focus(); i.selectionStart = i.selectionEnd = i.value.length; } }); }, 350);
    });
    box.querySelector('[data-prev]').onclick = () => { st.filter.offset = Math.max(0, off - 40); void paintList(); };
    box.querySelector('[data-next]').onclick = () => { st.filter.offset = off + 40; void paintList(); };
    box.querySelectorAll('[data-thread]').forEach((b) => b.addEventListener('click', () => guardDiscard(() => {
      st.threadId = b.dataset.thread;
      st.composeMode = 'reply';
      writeHash();
      box.querySelectorAll('[data-thread]').forEach((x) => x.classList.toggle('is-active', x === b));
      b.classList.remove('is-unread');
      b.querySelector('.s-dot')?.remove();
      void paintThread().then(refreshBadge);
    })));
  }

  /** Unsent composer text is never dropped silently. */
  function guardDiscard(proceed) {
    const ta = doc.querySelector('#support-thread [data-compose-body]');
    if (!ta || !ta.value.trim()) { proceed(); return; }
    V().openConfirm?.({ title: 'დაუგზავნელი ტექსტი დაიკარგება', message: 'სხვა საუბარზე გადასვლისას ახლანდელი ტექსტი წაიშლება.', confirmLabel: 'გადასვლა', variant: 'warning', onConfirm: proceed });
  }

  /** srcdoc for a sanitized body: no scripts can run (sandbox), nothing remote can load (CSP). */
  function frameDoc(html) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><base target="_blank"><style>body{margin:12px;font:14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${html}</body></html>`;
  }

  function messageHtml(m) {
    const kind = m.direction === 'note' ? 'is-note' : m.direction === 'outbound' ? 'is-out' : 'is-in';
    const who = m.direction === 'inbound'
      ? `<b>${esc(m.fromName || m.fromEmail || '—')}</b>${m.fromName ? ` <span class="s-muted">&lt;${esc(m.fromEmail)}&gt;</span>` : ''}`
      : m.direction === 'outbound' ? `<b>${esc(m.author || 'ადმინი')}</b> <span class="s-muted">→ ${esc((m.toEmails || []).join(', '))}</span>` : `<b>${esc(m.author || m.fromName || 'ადმინი')}</b>`;
    const tag = m.direction === 'note' ? '<span class="s-badge is-warn is-plain">შიდა შენიშვნა</span>' : m.direction === 'outbound' ? '<span class="s-badge is-ok is-plain">პასუხი</span>' : '';
    const hasHtml = Boolean(m.htmlBody);
    const body = m.bodyStatus === 'pending' || m.bodyStatus === 'restricted' || m.bodyStatus === 'failed'
      ? `<p class="s-callout${m.bodyStatus === 'pending' ? '' : ' is-warn'}">${esc(BODY_NOTE[m.bodyStatus])}${m.bodyStatus !== 'pending' ? ` <button type="button" class="btn compact ghost" data-refetch="${esc(m.id)}">ხელახლა ცდა</button>` : ''}</p>`
      : `${hasHtml ? `<div class="s-segment" role="tablist" aria-label="ხედი"><button type="button" role="tab" aria-selected="true" data-view="html">HTML</button><button type="button" role="tab" aria-selected="false" data-view="text">ტექსტი</button></div>
          <iframe class="s-mail-frame" title="წერილის ტექსტი" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" data-frame></iframe>` : ''}
        <pre class="s-feed-body" data-text ${hasHtml ? 'hidden' : ''}>${esc(m.textBody || '(ცარიელი)')}</pre>`;
    const atts = (m.attachments || []).length
      ? `<div class="s-att-list">${m.attachments.map((a) => `<button type="button" class="btn compact ghost" data-att="${esc(a.id)}" data-msg="${esc(m.id)}" data-name="${esc(a.filename)}">${ico('paperclip')} ${esc(a.filename)}${a.size ? ` <small class="s-muted">${fmt(Math.ceil(a.size / 1024))} KB</small>` : ''}</button>`).join('')}</div>`
      : '';
    return `<article class="s-feed-item s-mail ${kind}" data-message="${esc(m.id)}">
      <header>${who}${tag}${m.isAuto ? '<span class="s-badge is-plain">ავტომატური</span>' : ''}<span class="s-muted" style="margin-left:auto">${esc(when(m.createdAt))}</span></header>
      ${body}${atts}</article>`;
  }

  async function paintThread() {
    const box = $('support-thread');
    if (!box) return;
    if (!st.threadId) {
      box.innerHTML = `<div class="s-empty">${ico('inbox')}<strong>აირჩიე საუბარი</strong><span>მარცხნივ სიიდან გახსენი წერილი, რომ წაიკითხო და უპასუხო.</span></div>`;
      return;
    }
    box.innerHTML = skel();
    let d;
    try {
      d = await api(`/threads/${encodeURIComponent(st.threadId)}`);
    } catch (err) {
      if (err?.status === 404) { st.threadId = null; writeHash(); return paintThread(); }
      box.innerHTML = failHtml(err);
      box.querySelector('[data-retry]').onclick = () => void paintThread();
      return;
    }
    const t = d.thread;
    const admins = d.admins || [];
    const u = d.user;
    box.innerHTML = `
      <header class="s-card-head s-thread-head"><div>
        <h3>${esc(t.subject || '(უსათაურო)')}</h3>
        <p>${esc(person(t))}${t.mailbox ? ` → ${esc(t.mailbox)}` : ''} · დაიწყო ${esc(when(t.createdAt))}</p></div>
        <div class="s-thread-controls">
          <label class="s-field"><span>სტატუსი</span><select data-status>${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="s-field"><span>პასუხისმგებელი</span><select data-assign><option value="">—</option>${admins.map((a) => `<option value="${esc(a.id)}" ${a.id === t.assignedAdminId ? 'selected' : ''}>${esc(a.name)}${a.id === d.me ? ' (მე)' : ''}</option>`).join('')}</select></label>
          <button type="button" class="btn compact ghost" data-mark-unread>წაუკითხავად</button>
        </div>
      </header>
      <div class="s-card-body s-stack">
        <div class="s-user-card">${u
          ? `${ico('user')}<div><b>${esc(u.fullName || 'მომხმარებელი')}</b><small>ანგარიში · ${esc(u.status || '')} · რეგისტრაცია ${esc(when(u.createdAt))}</small></div><a class="btn compact" href="#/users/${encodeURIComponent(u.id)}">პროფილი</a>`
          : `${ico('user')}<div><b>ანგარიში ვერ მოიძებნა</b><small>ამ მისამართით მედიქარდის ანგარიში არ არის (ან სხვა ელფოსტით არის დარეგისტრირებული).</small></div>`}</div>
        ${d.suppressed ? `<div class="s-callout is-warn">${ico('alert')}<p>ეს მისამართი დაბლოკილია (bounce ან საჩივარი) — პასუხი არ გაიგზავნება. შეამოწმე #/email → მიმოხილვა → „მისამართის შემოწმება“.</p></div>` : ''}
        <div class="s-mail-list">${(d.messages || []).map(messageHtml).join('')}</div>
      </div>
      <div class="s-card-body s-composer" data-composer></div>`;

    // Bodies: set srcdoc after insertion (never through innerHTML of this page).
    const byId = Object.fromEntries((d.messages || []).map((m) => [m.id, m]));
    box.querySelectorAll('[data-message]').forEach((el) => {
      const m = byId[el.dataset.message];
      const frame = el.querySelector('[data-frame]');
      if (frame && m?.htmlBody) frame.srcdoc = frameDoc(m.htmlBody);
      el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
        el.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        const html = b.dataset.view === 'html';
        if (frame) frame.hidden = !html;
        el.querySelector('[data-text]').hidden = html;
      }));
    });
    box.querySelectorAll('[data-refetch]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/messages/${encodeURIComponent(b.dataset.refetch)}/refetch`, { method: 'POST' }); toast('ხელახლა ვცდი — განაახლე წუთში', 'ok'); } catch (e) { toast(e.message, 'bad'); }
    }));
    box.querySelectorAll('[data-att]').forEach((b) => b.addEventListener('click', () => void downloadAttachment(b)));
    box.querySelector('[data-status]').addEventListener('change', (e) => void patchThread({ status: e.target.value }, 'სტატუსი შეიცვალა'));
    box.querySelector('[data-assign]').addEventListener('change', (e) => void patchThread({ assignedAdminId: e.target.value || null }, 'პასუხისმგებელი შეიცვალა'));
    box.querySelector('[data-mark-unread]').onclick = async () => { await patchThread({ unread: true }, 'მოინიშნა წაუკითხავად'); st.threadId = null; writeHash(); void paintThread(); };
    paintComposer(box.querySelector('[data-composer]'), t, d);
    const list = box.querySelector('.s-mail-list');
    list?.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  }

  async function patchThread(body, okMsg) {
    try {
      await api(`/threads/${encodeURIComponent(st.threadId)}`, { method: 'PATCH', body });
      toast(okMsg, 'ok');
      void paintList();
      void refreshBadge();
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

  async function paintComposer(box, thread, d) {
    if (!box) return;
    const snippets = await loadSnippets();
    const note = st.composeMode === 'note';
    const blocked = d.suppressed;
    box.innerHTML = `<div class="s-stack">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="რას წერ"><button type="button" role="tab" aria-selected="${!note}" data-mode="reply">პასუხი</button><button type="button" role="tab" aria-selected="${note}" data-mode="note">შიდა შენიშვნა</button></div>
        ${note ? '' : `<label class="s-field s-inline"><span>შაბლონი</span><select data-snippet><option value="">— ჩასმა —</option>${snippets.map((s) => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('')}</select></label>`}
      </div>
      <label class="s-field"><span>${note ? 'შენიშვნა (ჩანს მხოლოდ ადმინებს, არ იგზავნება)' : `პასუხი → ${esc(thread.counterpartEmail)} · „Re: ${esc(thread.subject || '')}“`}</span>
        <textarea data-compose-body rows="8" maxlength="${note ? 5000 : 20000}" placeholder="${note ? 'მაგ.: ვამოწმებ Android 14-ზე' : 'გამარჯობა!\n\nმადლობა, რომ მოგვწერე…'}"></textarea>
        ${note ? '' : '<small>აბზაცი — ცარიელი ხაზი. **მუქი**, სია „- “-ით, ბმული [ტექსტი](https://…). წერილი წავა მედიქარდის დიზაინით, support@medicard.ge-დან, იმავე Gmail-ის ძაფში.</small>'}</label>
      <div class="s-composer-actions">
        ${note ? '' : `<label class="s-field s-inline"><span>გაგზავნის შემდეგ</span><select data-after>${['waiting', 'open', 'closed'].map((k) => `<option value="${k}" ${k === 'waiting' ? 'selected' : ''}>${STATUS[k][0]}</option>`).join('')}</select></label>`}
        <div style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap">
          ${note ? '' : '<button type="button" class="btn compact" data-preview>გადახედვა</button>'}
          <button type="button" class="btn primary compact" data-send ${!note && blocked ? 'disabled' : ''}>${note ? 'შენიშვნის შენახვა' : `${ico('send')} გაგზავნა`}</button>
        </div>
      </div>
    </div>`;
    const ta = box.querySelector('[data-compose-body]');
    box.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.mode === st.composeMode) return;
      const text = ta.value;
      st.composeMode = b.dataset.mode;
      void paintComposer(box, thread, d).then(() => { const next = box.querySelector('[data-compose-body]'); if (next) next.value = text; });
    }));
    box.querySelector('[data-snippet]')?.addEventListener('change', (e) => {
      const s = snippets.find((x) => x.id === e.target.value);
      e.target.value = '';
      if (!s) return;
      const at = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, at) + s.body + ta.value.slice(ta.selectionEnd ?? at);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = at + s.body.length;
    });
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
    box.querySelector('[data-send]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const text = ta.value.trim();
      if (!text) { toast(note ? 'შენიშვნა ცარიელია' : 'პასუხი ცარიელია', 'warn'); ta.focus(); return; }
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
    });
  }

  /* ═════════ შაბლონები ═════════ */
  async function paintSnippets(pane) {
    const list = await loadSnippets(true);
    pane.innerHTML = `<section class="s-card">
      <header class="s-card-head"><div><h3>სწრაფი პასუხები</h3><p>ხშირი პასუხების შაბლონები. პასუხის წერისას „შაბლონი“ სიიდან ჩაისმება კურსორთან, შემდეგ შეგიძლია შეცვალო.</p></div>
        <button type="button" class="btn primary compact" data-new>${ico('plus')} ახალი შაბლონი</button></header>
      <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
        <thead><tr><th>სათაური</th><th>ტექსტი</th><th>ბოლო ცვლილება</th><th></th></tr></thead>
        <tbody>${list.length ? list.map((s) => `<tr data-snip="${esc(s.id)}">
          <td><b>${esc(s.title)}</b></td>
          <td class="s-muted" style="max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.body)}</td>
          <td class="s-muted">${esc(when(s.updatedAt))}</td>
          <td class="num"><button type="button" class="btn compact" data-edit>${ico('edit')} რედაქტირება</button> <button type="button" class="btn compact danger" data-del>წაშლა</button></td>
        </tr>`).join('') : '<tr><td colspan="4"><div class="s-empty">შაბლონი ჯერ არ არის. შექმენი პირველი — მაგ. „მადლობა, ვამოწმებთ“.</div></td></tr>'}</tbody></table></div></div>
    </section>`;
    pane.querySelector('[data-new]').onclick = () => openSnippetDialog(null);
    pane.querySelectorAll('[data-snip]').forEach((row) => {
      const s = list.find((x) => x.id === row.dataset.snip);
      row.querySelector('[data-edit]').onclick = () => openSnippetDialog(s);
      row.querySelector('[data-del]').onclick = () => V().openConfirm?.({
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
      title: s ? 'შაბლონის რედაქტირება' : 'ახალი შაბლონი',
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
        toast('შაბლონი შენახულია', 'ok');
        await paintSub();
      } catch (e) { $('snip-msg').textContent = e.message; }
    };
  }

  global.renderSupportAdmin = renderSupportAdmin;
  global.AdminV4Support = { renderSupportAdmin, refreshBadge };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', startBadge); else startBadge();
})(window);
