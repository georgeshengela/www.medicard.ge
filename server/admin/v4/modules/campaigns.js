/**
 * MediCard Admin V4 — #/campaigns კამპანიები (/api/admin/campaigns + /api/admin/social).
 * Admin-only campaign material (owner request 2026-10-02): nothing here is on the public site.
 *   გეგმა            the campaign plan document (server/private/press/<slug>/plan.html) inside the page
 *   პოსტები და ტექსტები  every post and story of the campaign by day, with the exact caption and a copy button
 *   ბეჭდვა           print PDFs with previews
 * Files under /press/<private campaign>/ open only with the HttpOnly media cookie that
 * POST /campaigns/media-session sets (lib/campaignMedia.js); #/social uses the same session for its thumbnails.
 */
(function adminV4Campaigns(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const num = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const say = (err, fallback) => (/[ა-ჿ]/.test(err?.message || '') ? err.message : fallback);
  const skel = () => '<div class="p4-skel" aria-busy="true" aria-label="იტვირთება"><i class="is-bar"></i><i class="is-tiles"></i><i class="is-block"></i></div>';
  const failHtml = (err) => `<section class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(say(err, 'სცადე ხელახლა.'))}</span><button type="button" class="btn" data-retry>${ico('refresh')} ხელახლა ცდა</button></div></section>`;

  if (typeof ICONS === 'object') {
    ICONS.flag = ICONS.flag || '<path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/>';
    ICONS.copy = ICONS.copy || '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>';
    ICONS.external = ICONS.external || '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>';
    ICONS.x = ICONS.x || '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
    ICONS.rows = ICONS.rows || '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
    ICONS.download = ICONS.download || '<path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 21h14"/>';
  }

  const SUBS = [['plan', 'გეგმა'], ['posts', 'პოსტები და ტექსტები'], ['print', 'ბეჭდვა']];
  const KIND = { POST: 'პოსტი', STORY: 'სთორი', REEL: 'რილსი', CAROUSEL: 'კარუსელი' };
  const STATUS = { PLANNED: ['გეგმაში', 'is-plain'], SCHEDULED: ['დაგეგმილი', 'is-info'], PUBLISHED: ['გამოქვეყნდა', 'is-ok'], FAILED: ['ვერ გამოქვეყნდა', 'is-bad'], CANCELED: ['გაუქმდა', 'is-warn'] };
  const NET = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn' };
  const FILTERS = [['upcoming', 'მომავალი'], ['all', 'ყველა'], ['done', 'გამოქვეყნებული']];
  const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const MONTHS_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  const WEEKDAYS = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];

  const st = { sub: 'plan', filter: 'upcoming', campaigns: null, campaign: null, posts: null, frameObs: null, posters: [], texts: new Map() };

  /* ─────────────── Media session (shared with #/social) ─────────────── */
  let session = null;
  /** Opens /press/<private campaign>/… for this browser for 2 h; renewed after 90 min. */
  function ensureMedia() {
    if (session && Date.now() - session.at < 90 * 60_000) return session.promise;
    const promise = global.api('/campaigns/media-session', { method: 'POST' }).catch((err) => { session = null; throw err; });
    session = { at: Date.now(), promise };
    return promise;
  }
  function endMedia() {
    session = null;
    return global.api('/campaigns/media-session', { method: 'DELETE' }).catch(() => {});
  }
  /** Campaign media recorded with the full site address loads from this admin's own origin (cookie included). */
  const local = (url) => String(url || '').replace(/^https:\/\/(?:www\.)?medicard\.ge(?=\/press\/)/, '');

  /* ─────────────── Time (Asia/Tbilisi) ─────────────── */
  const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  function tp(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
    return { key: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
  }
  const todayKey = () => tp(new Date().toISOString()).key;
  const dayN = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  const shortDay = (key) => { const [, m, d] = key.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]}`; };
  function longDay(key) {
    const [y, m, d] = key.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]}, ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
  }
  function phase(c) {
    const today = todayKey();
    const length = dayN(c.start, c.end) + 1;
    if (today < c.start) { const left = dayN(today, c.start); return { tone: 'is-info', label: left === 1 ? 'იწყება ხვალ' : `იწყება ${num(left)} დღეში`, day: 0, length }; }
    if (today > c.end) return { tone: 'is-plain', label: 'დასრულდა', day: length, length };
    const day = dayN(c.start, today) + 1;
    return { tone: 'is-ok', label: `მიმდინარე · დღე ${num(day)} / ${num(length)}`, day, length };
  }

  /* ─────────────── Hash state ─────────────── */
  const hashParams = () => (typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || ''));
  function writeSub(sub) {
    const params = hashParams();
    params.set('tab', sub);
    const next = `#/campaigns?${params.toString()}`;
    if (location.hash !== next) history.replaceState({ tab: 'campaigns' }, '', next);
  }

  /* ═════════ Shell ═════════ */
  async function renderCampaignsAdmin() {
    const root = $('tab-campaigns');
    if (!root) return;
    const want = hashParams().get('tab');
    if (SUBS.some(([k]) => k === want)) st.sub = want;
    root.innerHTML = `<div class="s-stack v3-tab-shell cp-page">${skel()}</div>`;
    try {
      const [list, social] = await Promise.all([
        global.api('/campaigns'),
        global.api('/social?campaign=medirun-glow-2026&limit=2000').catch(() => ({ installed: false, posts: [] })),
        ensureMedia(),
      ]);
      st.campaigns = list.campaigns || [];
      st.campaign = st.campaigns[0] || null;
      st.posts = (social.posts || []).slice().sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    } catch (err) {
      root.innerHTML = `<div class="s-stack v3-tab-shell cp-page">${failHtml(err)}</div>`;
      root.querySelector('[data-retry]')?.addEventListener('click', () => void renderCampaignsAdmin());
      return;
    }
    const c = st.campaign;
    if (!c) {
      root.innerHTML = `<div class="s-stack v3-tab-shell cp-page"><section class="s-card"><div class="s-empty">${ico('flag')}<strong>კამპანია ჯერ არ არის</strong><span>როცა ახალი კამპანიის მასალა დაემატება, აქ გამოჩნდება.</span></div></section></div>`;
      return;
    }
    root.innerHTML = `<div class="s-stack v3-tab-shell cp-page">
      ${heroHtml(c)}
      ${metricsHtml(c)}
      <div class="s-tabbar">
        <nav class="v3-subnav" role="tablist" aria-label="კამპანიის განყოფილებები">${SUBS.map(([k, l]) => `<button type="button" role="tab" class="v3-subnav-btn${k === st.sub ? ' is-active' : ''}" data-cp-sub="${k}" aria-selected="${k === st.sub}">${l}</button>`).join('')}</nav>
      </div>
      <div id="cp-pane"></div>
    </div>`;
    root.querySelectorAll('[data-cp-sub]').forEach((btn) => btn.addEventListener('click', () => {
      st.sub = btn.dataset.cpSub;
      writeSub(st.sub);
      root.querySelectorAll('[data-cp-sub]').forEach((b) => { const on = b === btn; b.setAttribute('aria-selected', String(on)); b.classList.toggle('is-active', on); });
      paintSub();
    }));
    paintSub();
  }

  function heroHtml(c) {
    const p = phase(c);
    return `<section class="s-card cp-hero">
      <div class="cp-hero-id">
        <span class="cp-brand">MEDIRUN</span>
        <h2>${esc(c.name)}</h2>
        <p>${esc(shortDay(c.start))} – ${esc(shortDay(c.end))} 2026 · თბილისი. ქალაქში დამალული ყუთები Medi Coins-ით, ფინალში წითელი iPhone 18 Pro Max მათთვის, ვინც თბილისის 1% გაანათა.</p>
      </div>
      <div class="cp-hero-side">
        <span class="s-badge ${p.tone}">${esc(p.label)}</span>
        <div class="cp-links">
          <a class="btn ghost compact" href="#/social">${ico('share')}<span>სოციალური ქსელები</span></a>
          <a class="btn ghost compact" href="#/medipulsi">${ico('route')}<span>MEDIRUN</span></a>
          <a class="btn ghost compact" href="${esc(c.rulesUrl)}" target="_blank" rel="noopener">${ico('external')}<span>წესები (საჯარო)</span></a>
        </div>
      </div>
    </section>`;
  }

  function metricsHtml(c) {
    const p = phase(c);
    const posts = st.posts || [];
    const done = posts.filter((x) => x.status === 'PUBLISHED').length;
    const failed = posts.filter((x) => x.status === 'FAILED').length;
    const manual = posts.filter((x) => x.status === 'PLANNED' && Date.parse(x.scheduledAt) >= Date.now()).length;
    const next = posts.find((x) => Date.parse(x.scheduledAt) >= Date.now() && x.status !== 'CANCELED');
    const when = (iso) => V().formatDate?.(iso, 'datetime') || '—';
    const m = (label, value, small, tone = '') => `<div class="s-metric ${tone}"><span>${esc(label)}</span><strong>${value}</strong><small>${small}</small></div>`;
    return `<div class="s-metrics">
      ${m('კამპანიის დღე', p.day ? `${num(p.day)} / ${num(p.length)}` : `0 / ${num(p.length)}`, esc(p.label))}
      ${m('პოსტები', `${num(done)} / ${num(posts.length)}`, failed ? `<span class="s-badge is-bad">${num(failed)} ვერ გამოქვეყნდა</span>` : 'გამოქვეყნდა / სულ', failed ? 'is-bad' : '')}
      ${m('შემდეგი პოსტი', next ? esc(tp(next.scheduledAt).time) : '—', next ? esc(`${when(next.scheduledAt).split(',')[0]} · ${next.title || KIND[next.kind] || ''}`) : 'დაგეგმილი აღარაფერია')}
      ${m('ხელით გამოსაქვეყნებელი', num(manual), 'შაბათის „მპოვნელები“ და მსგავსი', manual ? 'is-warn' : '')}
    </div>`;
  }

  function paintSub() {
    const pane = $('cp-pane');
    if (!pane) return;
    closeViewer();
    st.frameObs?.disconnect();
    st.frameObs = null;
    if (st.sub === 'posts') paintPosts(pane);
    else if (st.sub === 'print') paintPrint(pane);
    else paintPlan(pane);
  }

  /* ─────────────── გეგმა: the plan document, theme-synced, grown to its full height ─────────────── */
  function paintPlan(pane) {
    const c = st.campaign;
    if (!c.planUrl) {
      pane.innerHTML = `<section class="s-card"><div class="s-empty">${ico('book')}<strong>გეგმის ფაილი არ არის</strong><span>გაუშვი brand/medirun/glow-campaign/build_gallery.py.</span></div></section>`;
      return;
    }
    pane.innerHTML = `<section class="s-card cp-doc">
      <div class="s-card-head cp-doc-head"><div><h3>კამპანიის გეგმა</h3><p>სტატუსი, კალენდარი, კვირის რიტმი, დონეები, მართვა და ხარჯი.</p></div>
        <a class="btn ghost compact" href="${esc(c.planUrl)}" target="_blank" rel="noopener">${ico('external')}<span>ცალკე გახსნა</span></a></div>
      <iframe class="cp-frame" title="კამპანიის გეგმა" src="${esc(c.planUrl)}" loading="lazy"></iframe>
    </section>`;
    st.posters = collectPosters();
    if (st.posters.length) {
      pane.insertAdjacentHTML('afterbegin', `<section class="s-card cp-strip">
        <div class="s-card-head cp-doc-head"><div><h3>პოსტერები და სთორები · ${num(st.posters.length)}</h3><p>დააჭირე და სრული ზომით ნახავ. შემდეგზე ისრებით გადახვალ (← →), დახურვა Esc.</p></div></div>
        <div class="cp-strip-row">${st.posters.map((x, k) => `<button type="button" class="cp-strip-item${x.story ? ' is-story' : ''}" data-poster="${k}" title="${esc(x.caption)}"><img src="${esc(x.src)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>
      </section>`);
    }
    const frame = pane.querySelector('iframe');
    frame.addEventListener('load', () => {
      let d;
      try { d = frame.contentDocument; } catch { return; }
      if (!d?.documentElement) return;
      const sync = () => { d.documentElement.dataset.theme = doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; };
      d.documentElement.classList.add('embed');
      sync();
      // Every picture in the plan opens in the admin viewer, with the plan's other pictures one arrow away.
      const imgs = [...d.querySelectorAll('img')].filter((im) => !im.closest('nav, .hero'));
      imgs.forEach((im, i) => {
        im.style.cursor = 'zoom-in';
        im.addEventListener('click', (e) => { e.preventDefault(); openViewer(imgs.map((x) => ({ src: x.currentSrc || x.src, caption: x.alt || '' })), i); });
      });
      const fit =() => { frame.style.height = `${Math.max(400, d.documentElement.scrollHeight + 2)}px`; };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(d.body);
      const mo = new MutationObserver(sync);
      mo.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      st.frameObs = { disconnect() { ro.disconnect(); mo.disconnect(); } };
    });
    pane.querySelectorAll('[data-poster]').forEach((b) => b.addEventListener('click', () => openViewer(st.posters, Number(b.dataset.poster))));
  }

  /** Every poster and story of the campaign once, in calendar order, captioned with the post that uses it. */
  function collectPosters() {
    const seen = new Map();
    for (const p of st.posts || []) {
      for (const u of (p.mediaUrls || []).map(local)) {
        if (/\.(mp4|mov|webm)$/i.test(u) || seen.has(u)) continue;
        seen.set(u, { src: u, caption: postCaption(p), story: p.kind === 'STORY' });
      }
    }
    return [...seen.values()];
  }
  function postCaption(p) {
    const t = tp(p.scheduledAt);
    return [t ? `${shortDay(t.key)}, ${t.time}` : '', KIND[p.kind] || '', p.kind === 'STORY' ? '' : p.title || ''].filter(Boolean).join(' · ');
  }

  /* ─────────────── Viewer: any campaign picture full size, ← → between them, Esc closes ─────────────── */
  let viewer = null;
  function openViewer(items, index = 0) {
    if (!items?.length) return;
    closeViewer();
    let i = Math.min(Math.max(0, index), items.length - 1);
    const el = doc.createElement('div');
    el.className = 'cp-viewer';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'სურათის ნახვა');
    el.innerHTML = `<div class="cp-viewer-scrim" data-close></div>
      <figure class="cp-viewer-stage"><img alt=""><figcaption><span class="cp-viewer-cap"></span><span class="cp-viewer-count"></span></figcaption></figure>
      <div class="cp-viewer-bar">
        <a class="btn ghost compact" data-open target="_blank" rel="noopener">${ico('external')}<span>სრული ზომით</span></a>
        <a class="btn ghost compact" data-dl download>${ico('download')}<span>ჩამოტვირთვა</span></a>
        <button type="button" class="btn ghost compact" data-close>${ico('x')}<span>დახურვა</span></button>
      </div>
      ${items.length > 1 ? '<button type="button" class="cp-viewer-nav is-prev" data-step="-1" aria-label="წინა">‹</button><button type="button" class="cp-viewer-nav is-next" data-step="1" aria-label="შემდეგი">›</button>' : ''}`;
    const img = el.querySelector('img');
    const show = () => {
      const it = items[i];
      img.src = it.src;
      img.alt = it.caption || '';
      el.querySelector('.cp-viewer-cap').textContent = it.caption || '';
      el.querySelector('.cp-viewer-count').textContent = items.length > 1 ? `${i + 1} / ${items.length}` : '';
      el.querySelector('[data-open]').href = it.href || it.src;
      el.querySelector('[data-open] span').textContent = it.href ? 'PDF-ის გახსნა' : 'სრული ზომით';
      el.querySelector('[data-dl]').href = it.href || it.src;
    };
    const step = (d) => { i = (i + d + items.length) % items.length; show(); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeViewer(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    };
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { closeViewer(); return; }
      const s = e.target.closest('[data-step]');
      if (s) step(Number(s.dataset.step));
    });
    doc.addEventListener('keydown', onKey, true);
    doc.body.appendChild(el);
    viewer = { el, onKey, back: doc.activeElement };
    show();
    el.querySelector('button[data-close]').focus();
  }
  function closeViewer() {
    if (!viewer) return;
    doc.removeEventListener('keydown', viewer.onKey, true);
    viewer.el.remove();
    try { viewer.back?.focus?.(); } catch { /* element gone */ }
    viewer = null;
  }

  /* ─────────────── პოსტები და ტექსტები: one compact row per post; the full text opens on demand ─────────────── */
  const isVideo = (u) => /\.(mp4|mov|webm)$/i.test(u);
  function postRow(p) {
    const t = tp(p.scheduledAt);
    const [sl, stone] = STATUS[p.status] || [p.status, 'is-plain'];
    const story = p.kind === 'STORY';
    const manual = p.status === 'PLANNED';
    const urls = (p.mediaUrls || []).map(local);
    const first = urls.find((u) => !isVideo(u));
    const text = story ? String(p.text || '').replace(/^სთორი:\s*/, '') : String(p.text || '');
    // The caption usually opens with the title line; the preview starts after it.
    const body = p.title && text.startsWith(p.title) ? text.slice(p.title.length).replace(/^\s+/, '') : text;
    const preview = manual && p.notes ? p.notes : body;
    st.texts.set(p.id, text);
    const thumb = first
      ? `<button type="button" class="cp-thumb${story ? ' is-story' : ''}" data-view="${esc(p.id)}" title="სურათის ნახვა"><img src="${esc(first)}" alt="" loading="lazy" decoding="async">${urls.length > 1 ? `<i>${urls.length}</i>` : ''}</button>`
      : `<span class="cp-thumb is-empty">${ico(urls.length ? 'play' : 'image')}</span>`;
    const canCopy = text && !story;
    return `<article class="cp-row${manual ? ' is-manual' : ''}">
      ${thumb}
      <div class="cp-row-main">
        <div class="cp-row-meta"><b>${esc(t?.time || '')}</b><span class="s-badge is-plain">${esc(KIND[p.kind] || p.kind || '')}</span><span class="s-badge ${manual ? 'is-warn' : stone}">${esc(manual ? 'ხელით' : sl)}</span><span class="cp-nets">${esc((p.networks || []).map((n) => NET[n] || n).join(' · '))}</span></div>
        ${p.title && !story ? `<h4>${esc(p.title)}</h4>` : ''}
        ${preview ? `<p class="cp-row-text">${esc(preview)}</p>` : ''}
        ${canCopy ? `<div class="cp-row-actions">
          <button type="button" class="cp-link" data-copy="${esc(p.id)}">${ico('copy')}<span>კოპირება</span></button>
          <button type="button" class="cp-link" data-more aria-expanded="false">${ico('rows')}<span>მთლიანი ტექსტი</span></button>
        </div>` : ''}
      </div>
    </article>`;
  }

  function paintPosts(pane) {
    const all = st.posts || [];
    const now = Date.now();
    st.texts = new Map();
    const upcoming = (p) => Date.parse(p.scheduledAt) >= now - 30 * 60_000 && p.status !== 'CANCELED';
    const list = all.filter((p) => (st.filter === 'all' ? true : st.filter === 'done' ? p.status === 'PUBLISHED' : upcoming(p)));
    const days = [];
    for (const p of list) {
      const key = tp(p.scheduledAt)?.key;
      if (!key) continue;
      if (!days.length || days[days.length - 1][0] !== key) days.push([key, []]);
      days[days.length - 1][1].push(p);
    }
    const months = [...new Set(days.map(([k]) => k.slice(0, 7)))];
    const counts = { upcoming: all.filter(upcoming).length, all: all.length, done: all.filter((p) => p.status === 'PUBLISHED').length };
    pane.innerHTML = `<div class="s-stack cp-posts">
      <div class="cp-toolbar">
        <div class="s-segment" role="tablist" aria-label="ფილტრი">${FILTERS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === st.filter}" data-cp-filter="${k}">${l} <i>${num(counts[k])}</i></button>`).join('')}</div>
        ${months.length > 1 ? `<div class="s-segment" aria-label="თვეზე გადასვლა">${months.map((m) => `<button type="button" data-cp-month="${m}">${MONTHS[Number(m.slice(5)) - 1]}</button>`).join('')}</div>` : ''}
      </div>
      ${days.length ? `<div class="cp-days">${days.map(([key, items]) => `<section class="s-card cp-day" data-month="${key.slice(0, 7)}">
        <header class="cp-day-head"><h3>${esc(longDay(key))}</h3>${key === todayKey() ? '<span class="s-badge is-info">დღეს</span>' : ''}<span class="cp-day-n">${num(items.length)}</span></header>
        <div class="cp-rows">${items.map(postRow).join('')}</div>
      </section>`).join('')}</div>` : `<section class="s-card"><div class="s-empty">${ico('share')}<strong>${all.length ? 'ამ ფილტრით პოსტი არ არის' : 'პოსტები ჯერ არ არის ჩაწერილი'}</strong><span>${all.length ? 'აირჩიე „ყველა“.' : 'პოსტები #/social-ში social-log.mjs-ით ემატება.'}</span></div></section>`}
    </div>`;
    pane.querySelectorAll('[data-cp-filter]').forEach((b) => b.addEventListener('click', () => { st.filter = b.dataset.cpFilter; paintPosts(pane); }));
    pane.querySelectorAll('[data-cp-month]').forEach((b) => b.addEventListener('click', () => pane.querySelector(`.cp-day[data-month="${b.dataset.cpMonth}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
    pane.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      const p = list.find((x) => x.id === b.dataset.view);
      if (!p) return;
      const cap = postCaption(p);
      const pics = (p.mediaUrls || []).map(local).filter((u) => !isVideo(u));
      openViewer(pics.map((src, k) => ({ src, caption: pics.length > 1 ? `${cap} · ${k + 1}` : cap })), 0);
    }));
    pane.querySelectorAll('[data-more]').forEach((b) => b.addEventListener('click', () => {
      const row = b.closest('.cp-row');
      const open = row.classList.toggle('is-open');
      b.setAttribute('aria-expanded', String(open));
      b.querySelector('span').textContent = open ? 'დაკეცვა' : 'მთლიანი ტექსტი';
    }));
    pane.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      const label = b.querySelector('span');
      try {
        await navigator.clipboard.writeText(st.texts.get(b.dataset.copy) || '');
        label.textContent = 'დაკოპირდა ✓';
        setTimeout(() => { label.textContent = 'კოპირება'; }, 1500);
      } catch {
        const row = b.closest('.cp-row');
        row.classList.add('is-open');
        const r = doc.createRange();
        r.selectNodeContents(row.querySelector('.cp-row-text'));
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        global.toast?.('ტექსტი მოინიშნა: დააკოპირე Ctrl+C-ით.');
      }
    }));
  }

  /* ─────────────── ბეჭდვა ─────────────── */
  function paintPrint(pane) {
    const prints = st.campaign.prints || [];
    const mb = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024)).toLocaleString('ka-GE')} კბ` : `${(b / 1048576).toLocaleString('ka-GE', { maximumFractionDigits: 1 })} მბ`);
    pane.innerHTML = prints.length ? `<div class="cp-print">${prints.map((p, k) => `<article class="s-card cp-print-item">
        <button type="button" class="cp-print-img" data-print="${k}" title="სურათის ნახვა"><img src="${esc(p.preview)}" alt="" decoding="async"></button>
        <div class="cp-print-body"><h4>${esc(p.name)}</h4><p>${esc(p.spec)} · PDF, ${esc(mb(p.bytes))}</p></div>
        <div class="cp-print-actions">
          <a class="btn compact" href="${esc(p.pdf)}" target="_blank" rel="noopener">${ico('external')}<span>PDF</span></a>
          <a class="btn ghost compact" href="${esc(p.pdf)}" download>${ico('download')}<span>ჩამოტვირთვა</span></a>
        </div>
      </article>`).join('')}</div>`
      : `<section class="s-card"><div class="s-empty">${ico('image')}<strong>ბეჭდვის ფაილები არ არის</strong><span>გაუშვი render.py და build_gallery.py.</span></div></section>`;
    const items = prints.map((p) => ({ src: p.preview, href: p.pdf, caption: `${p.name} · ${p.spec}` }));
    pane.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => openViewer(items, Number(b.dataset.print))));
  }

  global.renderCampaignsAdmin = renderCampaignsAdmin;
  global.AdminCampaignMedia = { ensure: ensureMedia, end: endMedia, local };
})(window);
