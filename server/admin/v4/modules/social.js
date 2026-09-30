/**
 * MediCard Admin V4 — #/social სოციალური ქსელები (/api/admin/social).
 * The social-media campaign log (server/src/lib/socialPosts.js): every post / story the operator
 * scheduled in Metricool — when (Asia/Tbilisi), where, the caption, the media — and the exact history
 * ("SocialPostEvent"). Read-only; rows are recorded with `node server/scripts/social-log.mjs`.
 * Tabs: კალენდარი (month grid) · ჩამონათვალი (table) · ისტორია (event feed); a drawer shows one post.
 */
(function adminV4Social(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const num = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;

  if (typeof ICONS === 'object') {
    ICONS.share = '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>';
    ICONS.play = ICONS.play || '<polygon points="7 4 20 12 7 20 7 4"/>';
    ICONS.external = ICONS.external || '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>';
    ICONS.edit = ICONS.edit || '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
    doc.querySelectorAll('[data-icon="share"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('share'));
    });
  }

  const VIEWS = [['calendar', 'კალენდარი'], ['list', 'ჩამონათვალი'], ['history', 'ისტორია']];
  const NETWORKS = { facebook: ['FB', 'Facebook'], instagram: ['IG', 'Instagram'], linkedin: ['in', 'LinkedIn'] };
  const NET_FILTERS = [['all', 'ყველა'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn']];
  const STATUS = {
    PLANNED: ['გეგმაში', ''],
    SCHEDULED: ['დაგეგმილი', 'is-info'],
    PUBLISHED: ['გამოქვეყნდა', 'is-ok'],
    FAILED: ['ვერ გამოქვეყნდა', 'is-bad'],
    CANCELED: ['გაუქმდა', 'is-warn'],
  };
  const STATUS_FILTERS = [['all', 'ყველა'], ['upcoming', 'დაგეგმილი'], ['PUBLISHED', 'გამოქვეყნებული'], ['FAILED', 'შეცდომა'], ['CANCELED', 'გაუქმებული']];
  const EVENT = {
    CREATED: ['შეიქმნა', 'is-accent', 'plus'],
    SCHEDULED: ['დაიგეგმა Metricool-ში', 'is-info', 'clock'],
    UPDATED: ['შეიცვალა', '', 'edit'],
    PUBLISHED: ['გამოქვეყნდა', 'is-ok', 'check'],
    FAILED: ['ვერ გამოქვეყნდა', 'is-bad', 'alert'],
    CANCELED: ['გაუქმდა', 'is-warn', 'x'],
    SYNCED: ['სინქრონიზაცია', '', 'refresh'],
  };
  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  const MONTHS_LONG = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const WEEKDAYS = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
  const VIEW_KEY = 'medicard.admin.social.view';

  const st = {
    view: (() => { try { return sessionStorage.getItem(VIEW_KEY) || 'calendar'; } catch { return 'calendar'; } })(),
    month: null,
    network: 'all',
    status: 'all',
    data: null,
  };

  /* ─────────────── Time (always Asia/Tbilisi, 24 h; built by hand — browsers often lack ka-GE data) ─────────────── */
  const partsFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  function tp(iso) {
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
    return { y: Number(p.year), m: Number(p.month), d: Number(p.day), time: `${p.hour}:${p.minute}`, key: `${p.year}-${p.month}-${p.day}`, month: `${p.year}-${p.month}` };
  }
  const when = (iso, { year = false } = {}) => {
    const p = iso && tp(iso);
    return p ? `${p.d} ${MONTHS[p.m - 1]}${year ? ` ${p.y}` : ''}, ${p.time}` : '—';
  };
  const weekdayOf = (key) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0

  /* ─────────────── Small pieces ─────────────── */
  const nets = (list) => `<span class="s-nets">${(list || []).map((n) => `<span class="s-net is-${esc(n)}" title="${esc(NETWORKS[n]?.[1] || n)}">${esc(NETWORKS[n]?.[0] || n)}</span>`).join('')}</span>`;
  const statusBadge = (s) => `<span class="s-badge ${STATUS[s]?.[1] || ''}">${esc(STATUS[s]?.[0] || s)}</span>`;
  const kindBadge = (k) => `<span class="s-badge is-plain">${esc(k)}</span>`;
  const isVideo = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url || '');
  function thumb(post, size = 44) {
    const url = post.mediaUrls?.[0];
    if (!url) return '<span class="s-muted">—</span>';
    const more = post.mediaUrls.length > 1 ? `<i class="s-social-more">+${post.mediaUrls.length - 1}</i>` : '';
    if (isVideo(url)) return `<span class="s-social-thumb is-video" style="width:${size}px;height:${size}px">${ico('play')}${more}</span>`;
    return `<span class="s-social-thumb" style="width:${size}px;height:${size}px"><img src="${esc(url)}" alt="" loading="lazy" decoding="async">${more}</span>`;
  }
  function metric(label, valueHtml, smallHtml, tone = '') {
    return `<div class="s-metric ${tone}"><span>${esc(label)}</span><strong>${valueHtml}</strong><small>${smallHtml || ''}</small></div>`;
  }

  function filtered(posts) {
    return posts.filter((p) => {
      if (st.network !== 'all' && !(p.networks || []).includes(st.network)) return false;
      if (st.status === 'upcoming') return p.status === 'PLANNED' || p.status === 'SCHEDULED';
      if (st.status !== 'all') return p.status === st.status;
      return true;
    });
  }

  function defaultMonth(d) {
    const pick = d.summary?.next?.scheduledAt || d.summary?.campaign?.firstAt || d.posts?.[0]?.scheduledAt || new Date().toISOString();
    return tp(pick).month;
  }
  function shiftMonth(month, delta) {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /* ─────────────── Views ─────────────── */
  function calendarView(posts) {
    const [y, m] = st.month.split('-').map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = weekdayOf(`${st.month}-01`);
    const todayKey = tp(new Date()).key;
    const byDay = new Map();
    posts.forEach((p) => {
      const t = tp(p.scheduledAt);
      if (!t || t.month !== st.month) return;
      if (!byDay.has(t.key)) byDay.set(t.key, []);
      byDay.get(t.key).push({ p, t });
    });
    const inMonth = [...byDay.values()].reduce((a, list) => a + list.length, 0);
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push('<div class="s-cal-day is-out" aria-hidden="true"></div>');
    for (let day = 1; day <= days; day += 1) {
      const key = `${st.month}-${String(day).padStart(2, '0')}`;
      const items = (byDay.get(key) || []).sort((a, b) => a.t.time.localeCompare(b.t.time));
      cells.push(`<div class="s-cal-day${key === todayKey ? ' is-today' : ''}${items.length ? '' : ' is-empty'}">
        <span class="s-cal-num">${day}<em>${WEEKDAYS[weekdayOf(key)]}</em></span>
        ${items.map(({ p, t }) => `<button type="button" class="s-cal-item is-${esc(p.status.toLowerCase())}" data-post="${esc(p.id)}" title="${esc(`${t.time} · ${p.title}`)}">
          <span class="s-cal-row"><b>${esc(t.time)}</b>${nets(p.networks)}<span class="s-cal-kind">${esc(p.kind)}</span></span>
          <span class="s-cal-title">${esc(p.title)}</span>
        </button>`).join('')}
      </div>`);
    }
    while (cells.length % 7) cells.push('<div class="s-cal-day is-out" aria-hidden="true"></div>');
    return `<section class="s-card">
      <header class="s-card-head s-cal-head">
        <div><h3>${esc(MONTHS_LONG[m - 1])} ${y}</h3><p>${num(inMonth)} ერთეული ამ თვეში · თბილისის დროით. დააჭირე პოსტს დეტალებისთვის.</p></div>
        <div class="s-cal-nav">
          <button type="button" class="btn ghost compact" data-month="-1" aria-label="წინა თვე">‹</button>
          <button type="button" class="btn ghost compact" data-month="0">დღეს</button>
          <button type="button" class="btn ghost compact" data-month="1" aria-label="შემდეგი თვე">›</button>
        </div>
      </header>
      <div class="s-card-body"><div class="s-cal" role="grid">
        ${WEEKDAYS.map((w) => `<div class="s-cal-wd" role="columnheader">${w}</div>`).join('')}
        ${cells.join('')}
      </div></div>
    </section>`;
  }

  function listView(posts) {
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>ყველა პოსტი და სთორი</h3><p>ჯერ მომავალი (უახლოესი პირველი), შემდეგ უკვე გასული (ბოლო პირველი). დრო — თბილისის.</p></div></header>
      <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
        <thead><tr><th>თარიღი / დრო</th><th>ქსელები</th><th>ტიპი</th><th>რუბრიკა</th><th>სათაური</th><th>სტატუსი</th><th>მედია</th></tr></thead>
        <tbody>${posts.length ? posts.map((p) => `<tr data-post="${esc(p.id)}" tabindex="0" style="cursor:pointer">
          <td style="white-space:nowrap">${esc(when(p.scheduledAt))}</td>
          <td>${nets(p.networks)}</td>
          <td>${kindBadge(p.kind)}</td>
          <td>${esc(p.pillar || '—')}</td>
          <td><b>${esc(p.title)}</b><div class="s-muted" style="font-size:12px"><code>${esc(p.slot)}</code></div></td>
          <td>${statusBadge(p.status)}</td>
          <td>${thumb(p)}</td>
        </tr>`).join('') : `<tr><td colspan="7"><div class="s-empty">${ico('share')}<strong>ამ ფილტრში ცარიელია</strong></div></td></tr>`}</tbody>
      </table></div></div>
    </section>`;
  }

  function historyView(events) {
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>ისტორია</h3><p>ყოველი ჩაწერა, ცვლილება და სტატუსი — ბოლო პირველი (მაქს. 300). დააჭირე სათაურს პოსტის გასახსნელად.</p></div></header>
      <div class="s-card-body is-flush">${events.length ? events.map((e) => {
        const [label, tone, iconName] = EVENT[e.type] || [e.type, '', 'info'];
        return `<article class="s-feed-item">
          <span class="s-avatar">${ico(iconName)}</span>
          <div>
            <header><button type="button" class="s-link" data-post="${esc(e.postId)}"><b>${esc(e.title || e.slot)}</b></button>${nets(e.networks)}<span class="s-badge ${tone}">${esc(label)}</span><span>${esc(when(e.at, { year: true }))}</span></header>
            ${e.detail ? `<p class="s-feed-body">${esc(e.detail)}</p>` : ''}
          </div>
        </article>`;
      }).join('') : `<div class="s-empty">${ico('clock')}<strong>ისტორია ჯერ ცარიელია</strong></div>`}</div>
    </section>`;
  }

  /* ─────────────── Page ─────────────── */
  function paint(root) {
    const d = st.data;
    const s = d.summary || {};
    const posts = filtered(d.posts || []);
    const next = s.next;
    const camp = s.campaign;
    const failed = s.status?.FAILED || 0;
    const empty = !(d.posts || []).length;

    const body = st.view === 'list' ? listView(posts) : st.view === 'history' ? historyView(d.events || []) : calendarView(posts);
    root.innerHTML = `<div class="s-stack v3-tab-shell s-social">
      ${d.installed === false ? `<div class="s-callout is-warn">${ico('alert')}<p><b>SocialPost ცხრილი ჯერ არ არის.</b> შეიქმნება შემდეგი deploy-ისას (npm run db:install → install-social). ჩანაწერები ამის შემდეგ გამოჩნდება.</p></div>` : ''}

      <div class="s-metrics">
        ${metric('დაგეგმილი', num(s.planned || 0), `გეგმაში ${num(s.status?.PLANNED || 0)} · Metricool-ში ${num(s.status?.SCHEDULED || 0)}`)}
        ${metric('გამოქვეყნებული', num(s.published || 0), failed ? `<span style="color:var(--s-bad)">ვერ გამოქვეყნდა: ${num(failed)}</span>` : (s.lastPublished ? `ბოლო: ${esc(when(s.lastPublished.publishedAt || s.lastPublished.scheduledAt))}` : 'ჯერ არაფერი'), failed ? 'is-warn' : '')}
        ${metric('შემდეგი პოსტი', next ? esc(when(next.scheduledAt)) : '—', next ? `${nets(next.networks)} ${esc(next.kind)} · ${esc(next.title)}` : 'დაგეგმილი პოსტი არ არის')}
        ${metric('კამპანიის დღე', camp ? `${num(camp.day)} <small style="font-weight:500;color:var(--s-muted)">/ ${num(camp.length)}</small>` : '—', camp ? (camp.day ? `${esc(camp.campaign)} · დაიწყო ${esc(when(camp.firstAt))}` : `${esc(camp.campaign)} · იწყება ${esc(when(camp.firstAt))}`) : 'კამპანია არ არის')}
      </div>

      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="ხედი">${VIEWS.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === st.view}" data-view="${k}">${label}${k === 'history' ? ` <i>${num((d.events || []).length)}</i>` : ''}</button>`).join('')}</div>
        ${st.view === 'history' ? '<span></span>' : `<div class="s-toolbar" style="justify-content:flex-end">
          <div class="s-segment" role="tablist" aria-label="ქსელი">${NET_FILTERS.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === st.network}" data-network="${k}">${label}</button>`).join('')}</div>
          <div class="s-segment" role="tablist" aria-label="სტატუსი">${STATUS_FILTERS.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === st.status}" data-status="${k}">${label}</button>`).join('')}</div>
        </div>`}
        <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
      </div>

      ${empty && d.installed !== false ? `<div class="s-callout">${ico('info')}<p>ჯერ პოსტი არ ჩაწერილა. ოპერატორი ჩაწერს ყველა დაგეგმილ პოსტს: <code>node server/scripts/social-log.mjs upsert posts.json</code>, სტატუსს კი — <code>… status status.json</code>.</p></div>` : ''}
      ${body}
    </div>`;

    root.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => {
      st.view = btn.dataset.view;
      try { sessionStorage.setItem(VIEW_KEY, st.view); } catch { /* private mode */ }
      paint(root);
    }));
    root.querySelectorAll('[data-network]').forEach((btn) => btn.addEventListener('click', () => { st.network = btn.dataset.network; paint(root); }));
    root.querySelectorAll('[data-status]').forEach((btn) => btn.addEventListener('click', () => { st.status = btn.dataset.status; paint(root); }));
    root.querySelectorAll('[data-month]').forEach((btn) => btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.month);
      st.month = delta ? shiftMonth(st.month, delta) : tp(new Date()).month;
      paint(root);
    }));
    root.querySelector('[data-refresh]')?.addEventListener('click', () => void renderSocialAdmin());
    root.querySelectorAll('[data-post]').forEach((el) => {
      const open = () => void openPost(el.dataset.post);
      el.addEventListener('click', open);
      if (el.tagName === 'TR') el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  /* ─────────────── Drawer: one post ─────────────── */
  function media(urls) {
    if (!urls?.length) return '<div class="s-empty">მედია არ არის მიბმული.</div>';
    return `<div class="s-social-media">${urls.map((url) => (isVideo(url)
      ? `<video src="${esc(url)}" controls preload="metadata" playsinline></video>`
      : `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="სრული ზომით გახსნა"><img src="${esc(url)}" alt="" loading="lazy" decoding="async"></a>`)).join('')}</div>`;
  }
  const fact = (label, value) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;

  async function openPost(id) {
    if (!id || typeof global.openDrawer !== 'function') return;
    let d;
    try {
      d = await global.api(`/social/${encodeURIComponent(id)}`);
    } catch (err) {
      global.toast?.(err?.message || 'ვერ ჩაიტვირთა', 'bad');
      return;
    }
    const p = d.post;
    const events = d.events || [];
    const safeHref = /^https:\/\//i.test(p.externalUrl || '') ? p.externalUrl : null;
    global.openDrawer(`<div class="s-stack s-social-drawer">
      <div>
        <p class="kicker" style="text-transform:none">${esc(p.campaign)} · <code>${esc(p.slot)}</code></p>
        <h3 style="margin:2px 0 8px">${esc(p.title)}</h3>
        <div class="s-chips">${statusBadge(p.status)} ${kindBadge(p.kind)} ${p.pillar ? `<span class="s-badge is-accent">${esc(p.pillar)}</span>` : ''} ${nets(p.networks)}</div>
      </div>
      <dl class="s-social-facts">
        ${fact('დაგეგმილი დრო (თბილისი)', esc(when(p.scheduledAt, { year: true })))}
        ${fact('ქსელები', esc((p.networks || []).map((n) => NETWORKS[n]?.[1] || n).join(', ') || '—'))}
        ${fact('სტატუსი', esc(STATUS[p.status]?.[0] || p.status))}
        ${fact('Metricool id', p.metricoolId ? `<code>${esc(p.metricoolId)}</code>` : '—')}
        ${fact('გამოქვეყნდა', esc(when(p.publishedAt, { year: true })))}
        ${fact('ბოლო სინქრონიზაცია', esc(when(p.lastSyncedAt, { year: true })))}
      </dl>
      ${safeHref ? `<a class="btn ghost compact" href="${esc(safeHref)}" target="_blank" rel="noopener noreferrer" style="justify-self:start">${ico('external')} ქსელში გახსნა</a>` : ''}
      <section><h4 class="s-social-h">მედია (${num((p.mediaUrls || []).length)})</h4>${media(p.mediaUrls)}</section>
      <section><h4 class="s-social-h">ტექსტი · ქართული</h4><div class="s-social-caption">${esc(p.text)}</div></section>
      ${p.textEn ? `<section><h4 class="s-social-h">ტექსტი · English</h4><div class="s-social-caption" lang="en">${esc(p.textEn)}</div></section>` : ''}
      ${p.notes ? `<section><h4 class="s-social-h">შენიშვნა</h4><div class="s-social-caption">${esc(p.notes)}</div></section>` : ''}
      <section><h4 class="s-social-h">ისტორია (${num(events.length)})</h4>
        <ol class="s-social-timeline">${events.map((e) => {
          const [label, tone] = EVENT[e.type] || [e.type, ''];
          return `<li><span class="s-badge ${tone}">${esc(label)}</span><time>${esc(when(e.at, { year: true }))}</time>${e.detail ? `<p>${esc(e.detail)}</p>` : ''}</li>`;
        }).join('') || '<li class="s-muted">ჩანაწერი არ არის.</li>'}</ol>
      </section>
      <p class="s-muted" style="font-size:12px;margin:0">ჩაწერილია ${esc(when(p.createdAt, { year: true }))} · განახლდა ${esc(when(p.updatedAt, { year: true }))}</p>
      <div class="row"><button type="button" class="btn ghost" id="drawer-cancel">დახურვა</button></div>
    </div>`, { wide: true });
    $('drawer-cancel')?.addEventListener('click', () => global.closeDrawer?.());
  }

  /* ─────────────── Load ─────────────── */
  async function renderSocialAdmin() {
    const root = $('tab-social');
    if (!root) return;
    if (!st.data) root.innerHTML = skel();
    let summary; let list; let events;
    try {
      [summary, list, events] = await Promise.all([
        global.api('/social/summary'),
        global.api('/social'),
        global.api('/social/events?limit=300'),
      ]);
    } catch (err) {
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = () => renderSocialAdmin();
      return;
    }
    st.data = {
      installed: summary.installed !== false && list.installed !== false,
      summary,
      posts: list.posts || [],
      events: events.events || [],
    };
    if (!st.month) st.month = defaultMonth(st.data);
    paint(root);
  }

  global.renderSocialAdmin = renderSocialAdmin;
  global.AdminV4Social = { renderSocialAdmin, openPost };
})(window);
