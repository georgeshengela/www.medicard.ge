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

  const st = { sub: 'plan', filter: 'upcoming', campaigns: null, campaign: null, posts: null, frameObs: null };

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
    const frame = pane.querySelector('iframe');
    frame.addEventListener('load', () => {
      let d;
      try { d = frame.contentDocument; } catch { return; }
      if (!d?.documentElement) return;
      const sync = () => { d.documentElement.dataset.theme = doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; };
      d.documentElement.classList.add('embed');
      sync();
      const fit = () => { frame.style.height = `${Math.max(400, d.documentElement.scrollHeight + 2)}px`; };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(d.body);
      const mo = new MutationObserver(sync);
      mo.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      st.frameObs = { disconnect() { ro.disconnect(); mo.disconnect(); } };
    });
  }

  /* ─────────────── პოსტები და ტექსტები ─────────────── */
  function postCard(p) {
    const t = tp(p.scheduledAt);
    const [sl, stone] = STATUS[p.status] || [p.status, 'is-plain'];
    const story = p.kind === 'STORY';
    const manual = p.status === 'PLANNED';
    const urls = (p.mediaUrls || []).map(local);
    const text = String(p.text || '');
    const media = urls.length
      ? `<div class="cp-media${urls.length > 1 ? ' is-many' : ''}">${urls.map((u) => (/\.(mp4|mov|webm)$/i.test(u)
        ? `<video src="${esc(u)}" controls preload="metadata" playsinline></video>`
        : `<a href="${esc(u)}" target="_blank" rel="noopener" title="სრული ზომით გახსნა"><img src="${esc(u)}" alt="" loading="lazy" decoding="async"></a>`)).join('')}</div>`
      : '';
    const body = story
      ? `<p class="cp-note">${esc(text.replace(/^სთორი:\s*/, '') || p.title || '')}</p>`
      : `${p.title ? `<h4>${esc(p.title)}</h4>` : ''}${manual && p.notes ? `<p class="cp-note">${esc(p.notes)}</p>` : ''}${text ? `<pre class="cp-text">${esc(text)}</pre><button type="button" class="btn ghost compact cp-copy" data-copy>${ico('copy')}<span>ტექსტის კოპირება</span></button>` : ''}`;
    return `<article class="cp-post${manual ? ' is-manual' : ''}${story ? ' is-story' : ''}">
      <header><b>${esc(t?.time || '')}</b><span class="s-badge is-plain">${esc(KIND[p.kind] || p.kind || '')}</span><span class="s-badge ${stone}">${esc(manual ? 'ხელით' : sl)}</span><span class="cp-nets">${esc((p.networks || []).map((n) => NET[n] || n).join(' · '))}</span></header>
      ${media}${body}
    </article>`;
  }

  function paintPosts(pane) {
    const all = st.posts || [];
    const now = Date.now();
    const list = all.filter((p) => (st.filter === 'all' ? true : st.filter === 'done' ? p.status === 'PUBLISHED' : Date.parse(p.scheduledAt) >= now - 30 * 60_000 && p.status !== 'CANCELED'));
    const days = [];
    for (const p of list) {
      const key = tp(p.scheduledAt)?.key;
      if (!key) continue;
      if (!days.length || days[days.length - 1][0] !== key) days.push([key, []]);
      days[days.length - 1][1].push(p);
    }
    const months = [...new Set(days.map(([k]) => k.slice(0, 7)))];
    const counts = { upcoming: all.filter((p) => Date.parse(p.scheduledAt) >= now - 30 * 60_000 && p.status !== 'CANCELED').length, all: all.length, done: all.filter((p) => p.status === 'PUBLISHED').length };
    pane.innerHTML = `<div class="s-stack cp-posts">
      <div class="cp-toolbar">
        <div class="s-segment" role="tablist" aria-label="ფილტრი">${FILTERS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === st.filter}" data-cp-filter="${k}">${l} <i>${num(counts[k])}</i></button>`).join('')}</div>
        ${months.length > 1 ? `<div class="cp-jump">${months.map((m) => `<button type="button" class="btn ghost compact" data-cp-month="${m}">${MONTHS[Number(m.slice(5)) - 1]}</button>`).join('')}</div>` : ''}
      </div>
      ${days.length ? days.map(([key, items]) => `<section class="cp-day" data-month="${key.slice(0, 7)}">
        <h3>${esc(longDay(key))}${key === todayKey() ? ' <span class="s-badge is-info">დღეს</span>' : ''}</h3>
        <div class="cp-grid">${items.map(postCard).join('')}</div>
      </section>`).join('') : `<section class="s-card"><div class="s-empty">${ico('share')}<strong>${all.length ? 'ამ ფილტრით პოსტი არ არის' : 'პოსტები ჯერ არ არის ჩაწერილი'}</strong><span>${all.length ? 'აირჩიე „ყველა“.' : 'პოსტები #/social-ში social-log.mjs-ით ემატება.'}</span></div></section>`}
    </div>`;
    pane.querySelectorAll('[data-cp-filter]').forEach((b) => b.addEventListener('click', () => { st.filter = b.dataset.cpFilter; paintPosts(pane); }));
    pane.querySelectorAll('[data-cp-month]').forEach((b) => b.addEventListener('click', () => pane.querySelector(`.cp-day[data-month="${b.dataset.cpMonth}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
    pane.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      const pre = b.previousElementSibling;
      const label = b.querySelector('span');
      try {
        await navigator.clipboard.writeText(pre.textContent);
        label.textContent = 'დაკოპირდა';
        setTimeout(() => { label.textContent = 'ტექსტის კოპირება'; }, 1500);
      } catch {
        const r = doc.createRange();
        r.selectNodeContents(pre);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
        global.toast?.('ტექსტი მოინიშნა: დააკოპირე Ctrl+C-ით.');
      }
    }));
  }

  /* ─────────────── ბეჭდვა ─────────────── */
  function paintPrint(pane) {
    const prints = st.campaign.prints || [];
    const mb = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024)).toLocaleString('ka-GE')} კბ` : `${(b / 1048576).toLocaleString('ka-GE', { maximumFractionDigits: 1 })} მბ`);
    pane.innerHTML = prints.length ? `<div class="cp-print">${prints.map((p) => `<article class="s-card cp-print-item">
        <a class="cp-print-img" href="${esc(p.pdf)}" target="_blank" rel="noopener" title="PDF-ის გახსნა"><img src="${esc(p.preview)}" alt="" decoding="async"></a>
        <div class="cp-print-body"><h4>${esc(p.name)}</h4><p>${esc(p.spec)} · PDF, ${esc(mb(p.bytes))}</p></div>
        <div class="cp-print-actions">
          <a class="btn compact" href="${esc(p.pdf)}" target="_blank" rel="noopener">${ico('external')}<span>გახსნა</span></a>
          <a class="btn ghost compact" href="${esc(p.pdf)}" download>${ico('download')}<span>ჩამოტვირთვა</span></a>
        </div>
      </article>`).join('')}</div>`
      : `<section class="s-card"><div class="s-empty">${ico('image')}<strong>ბეჭდვის ფაილები არ არის</strong><span>გაუშვი render.py და build_gallery.py.</span></div></section>`;
  }

  global.renderCampaignsAdmin = renderCampaignsAdmin;
  global.AdminCampaignMedia = { ensure: ensureMedia, end: endMedia, local };
})(window);
