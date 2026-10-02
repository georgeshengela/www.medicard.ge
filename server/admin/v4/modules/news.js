/**
 * MediCard Admin V4 — #/news სიახლეები (/api/admin/announcements).
 * News cards on the app's Home, above the nutrition section: list with reach / taps / CTR,
 * an editor with a live phone preview (light + dark), picture upload (resized in the browser),
 * one button to an app page or an https link, audience (gender, platform) and a schedule.
 */
(function adminV4News(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const toast = (m, k) => global.toast?.(m, k);
  /** The server's message when it is Georgian; otherwise our sentence (the raw English stays out of the owner's way). */
  const say = (err, fallback) => (/[ა-ჿ]/.test(err?.message || '') ? err.message : fallback);
  const api = (path, opts) => global.api(`/announcements${path}`, opts);
  const manageApi = (path, opts) => global.api(`/manage${path}`, opts);
  /** Placeholder in the page's own shape (KPI strip + list), so nothing jumps when the data lands. */
  const skel = () => `<div class="s-stack v3-tab-shell" aria-busy="true" aria-label="იტვირთება…">
    <div class="s-metrics">${'<div class="s-metric p1-skel-kpi"><i></i><i></i><i></i></div>'.repeat(4)}</div>
    <section class="s-card"><div class="p1-skel-rows">${'<i></i>'.repeat(6)}</div></section>
  </div>`;

  if (typeof ICONS === 'object') {
    ICONS['arrow-left'] = ICONS['arrow-left'] || '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>';
    ICONS.upload = ICONS.upload || '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>';
    ICONS.edit = ICONS.edit || '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
    ICONS.more = ICONS.more || '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>';
    ICONS.archive = ICONS.archive || '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><line x1="10" y1="12" x2="14" y2="12"/>';
    ICONS.megaphone = '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>';
    doc.querySelectorAll('[data-icon="megaphone"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('megaphone'));
    });
  }

  /** Same inks as the app's Home hub (mobile/src/theme/hub.ts). */
  const TONES = {
    teal: ['ფირუზი', '#0F766E', '#5EEAD4'],
    violet: ['იისფერი', '#6B50A0', '#C4B5FD'],
    amber: ['ქარვა', '#B45309', '#FCD34D'],
    rose: ['ვარდისფერი', '#BE185D', '#F9A8D4'],
    blue: ['ლურჯი', '#1D4ED8', '#93C5FD'],
    green: ['მწვანე', '#15803D', '#86EFAC'],
    sky: ['ცისფერი', '#0369A1', '#7DD3FC'],
  };
  /** App pages a button may open (server allow-list: ROUTE_ROOTS in lib/announcements.js). */
  const ROUTES = [
    ['/run', 'MEDIRUN'],
    ['/medi-quest', 'MEDI QUEST'],
    ['/medi-quest/rewards', 'MEDI QUEST — ჯილდოები'],
    ['/nutrition', 'კვება'],
    ['/nutrition/diary', 'კვების დღიური'],
    ['/nutrition/fasting', 'მარხვის ტაიმერი'],
    ['/assistant', 'Medi'],
    ['/assistant?mode=deep', 'ღრმა ანალიზი'],
    ['/symptoms', 'სიმპტომები'],
    ['/lab', 'ლაბორატორია'],
    ['/(tabs)/medications', 'წამლები'],
    ['/visits', 'ვიზიტები'],
    ['/health-metrics', 'მაჩვენებლები'],
    ['/health-metrics/steps', 'ნაბიჯები'],
    ['/health-metrics/weight', 'წონა და მიზანი'],
    ['/health-metrics/hydration', 'წყალი'],
    ['/cycle', 'ციკლი (ქალებისთვის)'],
    ['/community', 'ქალების სივრცე'],
    ['/pets', 'ჩემი ცხოველები'],
    ['/pharmacy', 'აფთიაქი'],
    ['/trainer', 'ჩემი ტრენერი'],
    ['/profile/invite', 'მეგობრის მოწვევა'],
    ['/profile/complete', 'პროფილის დასრულება'],
    ['/explore', 'ყველა ფუნქცია'],
  ];
  const PHASE = {
    LIVE: ['is-ok', 'აქტიური'],
    SCHEDULED: ['is-info', 'დაგეგმილი'],
    DRAFT: ['', 'დრაფტი'],
    ENDED: ['is-plain', 'დასრულდა'],
    ARCHIVED: ['is-plain', 'არქივი'],
  };
  const FILTERS = [['all', 'ყველა'], ['LIVE', 'აქტიური'], ['SCHEDULED', 'დაგეგმილი'], ['DRAFT', 'დრაფტი'], ['ENDED', 'დასრულებული'], ['ARCHIVED', 'არქივი']];
  /** How many cards the app's Home shows at once (by „რიგი“). */
  const HOME_MAX = 5;

  const st = { filter: 'all', editing: null, list: [], newsFlag: true };

  const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—');
  /** "დღეს, 14:05" · "28 სექ, 18:30" · "28 სექ 2025, 18:30" — Tbilisi time, like every other admin table. */
  const when = (iso) => (iso ? V().formatDate?.(iso, 'datetime') || '' : '');
  /** ISO → value for <input type="datetime-local"> in the browser's zone (the owner works in Tbilisi). */
  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
  const imgSrc = (path) => (path && path.startsWith('/') ? `${typeof API === 'string' ? API : ''}${path}` : path || '');
  const audienceText = (a = {}) => {
    const g = { FEMALE: 'ქალები', MALE: 'კაცები' }[a.gender] || 'ყველა';
    const p = Array.isArray(a.platforms) && a.platforms.length ? ` · ${a.platforms.map((x) => (x === 'ios' ? 'iOS' : 'Android')).join(', ')}` : '';
    return g + p;
  };
  const toneStyle = (tone) => {
    const [, light, dark] = TONES[tone] || TONES.teal;
    return `--tone:${light};--tone-dk:${dark}`;
  };

  /* ═════════ list ═════════ */
  async function renderNews() {
    const root = $('tab-news');
    if (!root) return;
    closeRowMenu();
    if (st.editing) return renderEditor(root, st.editing);
    root.innerHTML = skel();
    let data;
    try {
      const [list, flags] = await Promise.all([
        api(`/?archived=${st.filter === 'ARCHIVED' ? '1' : '0'}`),
        manageApi('/features').catch(() => null),
      ]);
      data = list;
      const flag = flags?.features?.find((f) => f.key === 'news');
      st.newsFlag = flag ? flag.effective !== false : true;
    } catch (err) {
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>სიახლეები ვერ ჩაიტვირთა</strong><span>${esc(say(err, 'სერვერმა პასუხი ვერ დააბრუნა. სცადე ხელახლა.'))}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = () => renderNews();
      return;
    }
    st.list = data.announcements || [];
    // The archive filter loads archived cards too: every number on the page counts the cards outside the archive.
    const current = st.list.filter((a) => a.phase !== 'ARCHIVED');
    const inPhase = (phase) => current.filter((a) => a.phase === phase);
    const live = inPhase('LIVE').length;
    const nextStart = inPhase('SCHEDULED').map((a) => a.startsAt).filter(Boolean).sort()[0];
    const views = current.reduce((s, a) => s + (a.stats?.views || 0), 0);
    const clicks = current.reduce((s, a) => s + (a.stats?.clicks || 0), 0);
    const counts = {
      all: current.length,
      LIVE: live,
      SCHEDULED: inPhase('SCHEDULED').length,
      DRAFT: inPhase('DRAFT').length,
      ENDED: inPhase('ENDED').length,
      ARCHIVED: st.filter === 'ARCHIVED' ? st.list.length - current.length : null,
    };
    const rows = st.filter === 'all' ? current : st.list.filter((a) => a.phase === st.filter);

    root.innerHTML = `<div class="s-stack v3-tab-shell p1-news">
      ${st.newsFlag ? '' : `<div class="s-callout is-warn">${ico('alert')}<p><b>სიახლეები გამორთულია „მოდულებში“.</b> აპში არცერთი ბარათი არ ჩანს, სანამ <a href="#/features">მოდულები → სიახლეები</a> ისევ არ ჩაირთვება.</p></div>`}
      <div class="s-metrics">
        <div class="s-metric${live > HOME_MAX ? ' is-warn' : ''}"><span>ახლა აპში</span><strong>${fmt(live)}</strong><small>${live > HOME_MAX ? `ჩანს მხოლოდ პირველი ${HOME_MAX} (რიგით)` : `ერთდროულად ჩანს მაქს. ${HOME_MAX}`}</small></div>
        <div class="s-metric"><span>დაგეგმილი</span><strong>${fmt(counts.SCHEDULED)}</strong><small>${nextStart ? `უახლოესი: ${esc(when(nextStart))}` : 'დაგეგმილი ბარათი არ არის'}</small></div>
        <div class="s-metric"><span>ნახვა</span><strong>${fmt(views)}</strong><small>უნიკალური ადამიანები · არქივის გარეშე</small></div>
        <div class="s-metric"><span>დაჭერა</span><strong>${fmt(clicks)}</strong><small>CTR ${pct(clicks, views)}</small></div>
      </div>
      <div class="s-toolbar">
        <div class="s-segment s-segment-wrap" role="tablist" aria-label="სტატუსის ფილტრი">${FILTERS.map(([k, l]) => `<button type="button" role="tab" data-filter="${k}" aria-selected="${k === st.filter}">${l}${counts[k] == null ? '' : ` <i>${fmt(counts[k])}</i>`}</button>`).join('')}</div>
        <button type="button" class="btn primary" data-new>${ico('plus')} ახალი სიახლე</button>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>სიახლის ბარათები</h3>
          <p>აპის მთავარ გვერდზე, კვების ზემოთ · აპის 1.0.0.16.2-დან</p></div></header>
        <div class="s-card-body is-flush">${rows.length ? `<div class="s-table-wrap"><table class="s-table p1-news-table">
          <thead><tr><th>სიახლე</th><th>სტატუსი</th><th>აუდიტორია</th><th>ჩვენების დრო</th><th class="num" title="უნიკალური ადამიანები, ვინც ბარათი დაინახა">ნახვა</th><th class="num" title="ვინც ბარათს დააჭირა; ქვემოთ — CTR">დაჭერა</th><th class="num" title="ვინც ბარათი X-ით დახურა — მას ის აღარ გამოუჩნდება">დამალა</th><th class="num" title="ნაკლები რიცხვი = პირველი">რიგი</th><th aria-label="მოქმედებები"></th></tr></thead>
          <tbody>${rows.map(rowHtml).join('')}</tbody></table></div>`
          : `<div class="s-empty">${ico('megaphone')}<strong>${st.filter === 'all' ? 'ჯერ სიახლე არ გაქვს' : 'ამ ფილტრში სიახლე არ არის'}</strong><span>${st.filter === 'all' ? 'მაგალითად: „მოიარე ლისი და მოიგე PS5“ — სურათი, მოკლე ტექსტი და ღილაკი MEDIRUN-ზე.' : 'აირჩიე სხვა სტატუსი ან „ყველა“.'}</span></div>`}</div>
      </section>
    </div>`;

    root.querySelector('[data-new]').onclick = () => openEditor(null);
    root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { st.filter = b.dataset.filter; void renderNews(); }));
    root.querySelectorAll('[data-row]').forEach((tr) => {
      const item = st.list.find((a) => a.id === tr.dataset.row);
      if (!item) return;
      if (tr.classList.contains('is-click')) {
        tr.addEventListener('click', (e) => { if (!e.target.closest('button, a')) openEditor(item); });
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === tr) { e.preventDefault(); openEditor(item); } });
      }
      tr.querySelector('[data-toggle-live]')?.addEventListener('click', (e) => togglePublish(item, e.currentTarget));
      tr.querySelector('[data-archive]')?.addEventListener('click', () => archive(item, item.status !== 'ARCHIVED'));
      tr.querySelector('[data-more]')?.addEventListener('click', (e) => openRowMenu(e.currentTarget, item));
    });
  }

  function rowHtml(a) {
    const [badge, label] = PHASE[a.phase] || ['', a.phase];
    const archived = a.status === 'ARCHIVED';
    const published = a.status === 'PUBLISHED';
    const views = a.stats?.views || 0;
    const clicks = a.stats?.clicks || 0;
    const thumb = a.image
      ? `<img class="p1-news-thumb" src="${esc(imgSrc(a.image))}" alt="" loading="lazy" decoding="async">`
      : `<span class="p1-news-thumb is-tile" style="${toneStyle(a.tone)}">${ico('megaphone')}</span>`;
    const span = [a.startsAt ? `<span>${esc(when(a.startsAt))}-დან</span>` : '', a.endsAt ? `<span>${esc(when(a.endsAt))}-მდე</span>` : ''].join('');
    return `<tr data-row="${esc(a.id)}"${archived ? '' : ' class="is-click" tabindex="0"'}>
      <td data-label="სიახლე"><div class="p1-news-item">${thumb}<div><b>${esc(a.title)}</b><span>${esc(a.body || a.details || '')}</span></div></div></td>
      <td data-label="სტატუსი"><span class="s-badge ${badge}">${esc(label)}</span></td>
      <td data-label="აუდიტორია">${esc(audienceText(a.audience))}</td>
      <td data-label="ჩვენების დრო"><div class="p1-news-when">${span || '<span class="s-muted">უვადოდ</span>'}</div></td>
      <td class="num" data-label="ნახვა">${fmt(views)}</td>
      <td class="num" data-label="დაჭერა">${fmt(clicks)}<small class="p1-sub">${pct(clicks, views)}</small></td>
      <td class="num" data-label="დამალა">${fmt(a.stats?.dismissals)}</td>
      <td class="num" data-label="რიგი">${fmt(a.priority)}</td>
      <td class="p1-row-actions">${archived
        ? '<button type="button" class="btn compact" data-archive>აღდგენა</button>'
        : `<button type="button" class="btn compact" data-toggle-live>${published ? 'შეჩერება' : 'გამოქვეყნება'}</button><button type="button" class="btn compact ghost icon-only" data-more aria-haspopup="menu" aria-expanded="false" aria-label="სხვა მოქმედებები" title="სხვა მოქმედებები">${ico('more')}</button>`}
      </td></tr>`;
  }

  /* Row menu: the rarer actions of a card (edit, copy, archive) behind „⋯“. */
  let rowMenu = null;
  function closeRowMenu(focusAnchor = false) {
    if (!rowMenu) return;
    const { node, anchor } = rowMenu;
    rowMenu = null;
    doc.removeEventListener('pointerdown', onMenuOutside, true);
    doc.removeEventListener('scroll', onMenuScroll, true);
    global.removeEventListener('resize', onMenuScroll);
    global.removeEventListener('hashchange', onMenuLeave);
    anchor.setAttribute('aria-expanded', 'false');
    node.classList.add('s-leaving');
    setTimeout(() => node.remove(), 140);
    if (focusAnchor && anchor.isConnected) anchor.focus();
  }
  function onMenuOutside(e) {
    if (rowMenu && !rowMenu.node.contains(e.target) && !rowMenu.anchor.contains(e.target)) closeRowMenu();
  }
  /** The menu is fixed-positioned: it follows its „⋯“ button while the page scrolls and closes once the row leaves the screen. */
  function placeRowMenu() {
    if (!rowMenu) return;
    const { node, anchor } = rowMenu;
    const r = anchor.getBoundingClientRect();
    if (!anchor.isConnected || !anchor.offsetParent || r.bottom < 0 || r.top > innerHeight) { closeRowMenu(); return; }
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    node.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.right - w))}px`;
    node.style.top = `${r.bottom + 6 + h <= innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`;
  }
  function onMenuScroll() { placeRowMenu(); }
  function onMenuLeave() { closeRowMenu(); }
  function openRowMenu(anchor, item) {
    const again = rowMenu?.anchor === anchor;
    closeRowMenu();
    if (again) return;
    const node = doc.createElement('div');
    node.className = 's-menu p1-row-menu';
    node.setAttribute('role', 'menu');
    node.setAttribute('aria-label', item.title || 'სიახლე');
    node.innerHTML = `<button type="button" role="menuitem" data-m="edit">${ico('edit')}<span>რედაქტირება</span></button>
      <button type="button" role="menuitem" data-m="dup">${ico('copy')}<span>ასლის შექმნა</span></button>
      <div class="s-menu-sep"></div>
      <button type="button" role="menuitem" data-m="archive" class="is-danger">${ico('archive')}<span>არქივში გადატანა</span></button>`;
    doc.body.appendChild(node);
    rowMenu = { node, anchor };
    placeRowMenu();
    if (!rowMenu) return;
    anchor.setAttribute('aria-expanded', 'true');
    node.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-m]');
      if (!btn) return;
      closeRowMenu();
      if (btn.dataset.m === 'edit') openEditor(item);
      else if (btn.dataset.m === 'dup') openEditor({ ...item, id: null, status: 'DRAFT', title: `${item.title} (ასლი)` });
      else if (btn.dataset.m === 'archive') void archive(item, true);
    });
    node.addEventListener('keydown', (e) => {
      const items = [...node.querySelectorAll('[role="menuitem"]')];
      const i = items.indexOf(doc.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRowMenu(true); }
      else if (e.key === 'Tab') closeRowMenu();
    });
    doc.addEventListener('pointerdown', onMenuOutside, true);
    doc.addEventListener('scroll', onMenuScroll, true);
    global.addEventListener('resize', onMenuScroll);
    global.addEventListener('hashchange', onMenuLeave);
    node.querySelector('[role="menuitem"]')?.focus();
  }

  const payloadOf = (a, status) => ({
    status,
    placement: a.placement || 'home',
    title: a.title,
    body: a.body || '',
    details: a.details || '',
    badge: a.badge || '',
    tone: TONES[a.tone] ? a.tone : 'teal',
    imageId: a.imageId || null,
    imageUrl: a.imageId ? null : a.imageUrl || null,
    ctaLabel: a.ctaLabel || '',
    ctaKind: a.ctaKind || 'none',
    ctaTarget: a.ctaTarget || '',
    audience: { gender: a.audience?.gender || 'ALL', platforms: a.audience?.platforms || [] },
    priority: Number(a.priority ?? 100),
    dismissible: a.dismissible !== false,
    startsAt: a.startsAt ? new Date(a.startsAt).toISOString() : null,
    endsAt: a.endsAt ? new Date(a.endsAt).toISOString() : null,
  });

  async function togglePublish(a, btn) {
    const next = a.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    const run = async () => {
      btn.disabled = true;
      try {
        await api(`/${encodeURIComponent(a.id)}`, { method: 'PUT', body: payloadOf(a, next) });
        toast(next === 'PUBLISHED' ? 'სიახლე გამოქვეყნდა' : 'სიახლე შეჩერდა', next === 'PUBLISHED' ? 'ok' : 'warn');
        await renderNews();
      } catch (e) {
        toast(say(e, 'სტატუსი ვერ შეიცვალა. სცადე ხელახლა.'), 'bad');
        btn.disabled = false;
      }
    };
    if (next === 'PUBLISHED') {
      V().openConfirm?.({
        title: `„${a.title}“ — გამოქვეყნება?`,
        message: `ბარათი გამოჩნდება მთავარ გვერდზე (${audienceText(a.audience)}) ≤1 წუთში.`,
        confirmLabel: 'გამოქვეყნება',
        onConfirm: run,
      });
    } else await run();
  }

  async function archive(a, archived) {
    const run = async () => {
      try {
        await api(`/${encodeURIComponent(a.id)}/archive`, { method: 'POST', body: { archived } });
        toast(archived ? 'არქივში გადავიდა' : 'აღდგა დრაფტად', 'ok');
        await renderNews();
      } catch (e) { toast(say(e, archived ? 'არქივში ვერ გადავიდა. სცადე ხელახლა.' : 'ვერ აღდგა. სცადე ხელახლა.'), 'bad'); }
    };
    if (!archived) return run();
    V().openConfirm?.({
      title: `„${a.title}“ — არქივში გადატანა?`,
      message: 'ბარათი აპიდან მაშინვე გაქრება. სტატისტიკა შენახული რჩება და ნებისმიერ დროს შეგიძლია აღადგინო.',
      confirmLabel: 'არქივში',
      variant: 'danger',
      onConfirm: run,
    });
  }

  function openEditor(item) {
    st.editing = item ? { ...item } : {
      id: null, status: 'DRAFT', title: '', body: '', details: '', badge: 'სიახლე', tone: 'teal', imageId: null, imageUrl: null, image: null,
      ctaKind: 'none', ctaLabel: '', ctaTarget: '', audience: { gender: 'ALL', platforms: [] }, priority: 100, dismissible: true, startsAt: null, endsAt: null,
    };
    void renderNews();
  }

  function closeEditor() {
    st.editing = null;
    V().setDirty?.(false);
    void renderNews();
  }

  /* ═════════ editor ═════════ */
  function renderEditor(root, a) {
    const custom = a.ctaKind === 'route' && a.ctaTarget && !ROUTES.some(([r]) => r === a.ctaTarget);
    const isLive = a.id && a.status === 'PUBLISHED';
    const [phaseBadge, phaseLabel] = a.id ? PHASE[a.phase] || ['', ''] : ['', 'ახალი'];
    root.innerHTML = `<div class="s-stack v3-tab-shell p1-news">
      <div class="s-toolbar">
        <div class="p1-toolbar-group">
          <button type="button" class="btn ghost" data-back>${ico('arrow-left')} ყველა სიახლე</button>
          ${phaseLabel ? `<span class="s-badge ${phaseBadge}">${esc(phaseLabel)}</span>` : ''}
        </div>
        <div class="p1-toolbar-group">
          <p class="s-form-msg p1-form-msg" role="alert" data-msg></p>
          ${isLive ? '' : '<button type="button" class="btn" data-save-draft>დრაფტად შენახვა</button>'}
          <button type="button" class="btn primary" data-save-live>${isLive ? 'ცვლილებების შენახვა' : 'გამოქვეყნება'}</button>
        </div>
      </div>
      <div class="s-split">
        <form class="s-stack" data-form novalidate>
          <section class="s-card"><header class="s-card-head"><div><h3>შინაარსი</h3><p>მოკლე და კონკრეტული: რა ხდება და რას იღებს ადამიანი.</p></div></header>
            <div class="s-card-body s-stack">
              <label class="s-field"><span>სათაური *</span><input data-f="title" maxlength="80" required value="${esc(a.title)}" placeholder="მოიარე ლისი და მოიგე PlayStation 5"><small data-count="title"></small></label>
              <label class="s-field"><span>მოკლე ტექსტი ბარათზე</span><textarea data-f="body" maxlength="220" rows="3" placeholder="MEDIRUN-ის შემოდგომის ღონისძიება: 1–15 ოქტომბერი. ყველა, ვინც ლისის ტბას შემოუვლის, მონაწილეობს გათამაშებაში.">${esc(a.body)}</textarea><small data-count="body"></small></label>
              <div class="s-form-grid">
                <label class="s-field"><span>ნიშანი (ბეჯი)</span><input data-f="badge" maxlength="24" value="${esc(a.badge)}" placeholder="სიახლე / ღონისძიება / საჩუქარი"><small>ცარიელზე ჩანს „სიახლე“.</small></label>
                <div class="s-field"><span>ფერი</span><div class="s-chips p1-swatches" role="radiogroup" aria-label="ფერი">${Object.entries(TONES).map(([k, [label, hex]]) => `<button type="button" role="radio" class="p1-swatch" style="--swatch:${hex}" aria-checked="${a.tone === k}" data-tone="${k}" title="${label}" aria-label="${label}"></button>`).join('')}</div></div>
              </div>
              <div class="s-field"><span>სურათი (არასავალდებულო)</span>
                <div class="p1-upload">
                  <label class="btn compact">${ico('upload')} ატვირთვა<input type="file" accept="image/jpeg,image/png,image/webp" data-file hidden></label>
                  <button type="button" class="btn compact ghost" data-remove-image ${a.image || a.imageUrl ? '' : 'hidden'}>სურათის მოშორება</button>
                  <span class="p1-upload-state" data-image-state></span>
                </div>
                <small>საუკეთესოა ჰორიზონტალური 16:9 (მაგ. 1600×900). ბრაუზერი თვითონ შეამცირებს ≤1600px-მდე.</small></div>
              <label class="s-field"><span>დეტალური ტექსტი (იხსნება ბარათზე დაჭერით)</span><textarea data-f="details" maxlength="4000" rows="7" placeholder="წესები, თარიღები, როგორ მივიღო მონაწილეობა, პრიზის გადაცემა…">${esc(a.details)}</textarea><small>ცარიელი ხაზი = ახალი აბზაცი.</small></label>
            </div></section>

          <section class="s-card"><header class="s-card-head"><div><h3>ღილაკი</h3><p>ერთი მოქმედება. აპის გვერდი იხსნება აპშივე; ბმული — ბრაუზერში.</p></div></header>
            <div class="s-card-body s-stack">
              <div class="s-segment" role="tablist" aria-label="ღილაკის ტიპი">${[['none', 'ღილაკის გარეშე'], ['route', 'აპის გვერდი'], ['url', 'ვებ-ბმული']].map(([k, l]) => `<button type="button" role="tab" data-cta-kind="${k}" aria-selected="${a.ctaKind === k}">${l}</button>`).join('')}</div>
              <div class="s-form-grid" data-cta-fields ${a.ctaKind === 'none' ? 'hidden' : ''}>
                <label class="s-field"><span>ღილაკის ტექსტი *</span><input data-f="ctaLabel" maxlength="32" value="${esc(a.ctaLabel)}" placeholder="დაიწყე სირბილი"></label>
                <label class="s-field" data-route-pick ${a.ctaKind === 'route' ? '' : 'hidden'}><span>აპის გვერდი *</span><select data-route-select>
                  ${ROUTES.map(([r, l]) => `<option value="${esc(r)}" ${a.ctaTarget === r ? 'selected' : ''}>${esc(l)} — ${esc(r)}</option>`).join('')}
                  <option value="__custom" ${custom ? 'selected' : ''}>სხვა გვერდი (ხელით)…</option></select></label>
                <label class="s-field" data-target-field ${a.ctaKind === 'url' || custom ? '' : 'hidden'}><span>${a.ctaKind === 'url' ? 'ბმული (https://) *' : 'გვერდი (/…) *'}</span><input data-f="ctaTarget" maxlength="500" value="${esc(a.ctaTarget)}" placeholder="${a.ctaKind === 'url' ? 'https://medicard.ge/lisi' : '/nutrition/recipes'}"></label>
              </div>
            </div></section>

          <section class="s-card"><header class="s-card-head"><div><h3>ვინ და როდის ხედავს</h3><p>დრო თბილისის დროით. დასრულების შემდეგ ბარათი თავისით ქრება.</p></div></header>
            <div class="s-card-body s-stack">
              <div class="s-form-grid">
                <label class="s-field"><span>სქესი</span><select data-f="gender">${[['ALL', 'ყველა'], ['FEMALE', 'მხოლოდ ქალები'], ['MALE', 'მხოლოდ კაცები']].map(([k, l]) => `<option value="${k}" ${(a.audience?.gender || 'ALL') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
                <div class="s-field"><span>პლატფორმა</span><div class="s-chips">${[['ios', 'iOS'], ['android', 'Android']].map(([k, l]) => `<label class="s-chip-check"><input type="checkbox" data-platform="${k}" ${(a.audience?.platforms || []).includes(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div><small>არცერთი მონიშნული = ორივე.</small></div>
              </div>
              <div class="s-form-grid">
                <label class="s-field"><span>დაწყება</span><input type="datetime-local" data-f="startsAt" value="${esc(toLocalInput(a.startsAt))}"><small>ცარიელი = გამოქვეყნებისთანავე.</small></label>
                <label class="s-field"><span>დასრულება</span><input type="datetime-local" data-f="endsAt" value="${esc(toLocalInput(a.endsAt))}"><small>ცარიელი = სანამ ხელით არ შეაჩერებ.</small></label>
                <label class="s-field"><span>რიგი</span><input type="number" min="0" max="1000" data-f="priority" value="${esc(a.priority ?? 100)}"><small>ნაკლები = პირველი (რამდენიმე ბარათისას).</small></label>
              </div>
              <label class="s-switch-row"><span><b>ადამიანს შეუძლია დამალოს (X)</b><small>გამორთე მხოლოდ მნიშვნელოვან ცნობაზე.</small></span><input class="s-switch" type="checkbox" role="switch" data-f="dismissible" ${a.dismissible !== false ? 'checked' : ''}></label>
            </div></section>
        </form>

        <div class="s-preview">
          <div class="s-toolbar"><b class="p1-preview-title">აპში ასე გამოჩნდება</b>
            <div class="s-segment" role="tablist" aria-label="თემა"><button type="button" role="tab" data-pv-theme="light" aria-selected="true">ნათელი</button><button type="button" role="tab" data-pv-theme="dark" aria-selected="false">მუქი</button></div></div>
          <div data-phone></div>
          <p class="p1-preview-note">ბარათზე დაჭერით იხსნება დეტალური გვერდი: სურათი, სათაური, დეტალური ტექსტი და ღილაკი.</p>
        </div>
      </div>
    </div>`;

    const form = root.querySelector('[data-form]');
    const msg = root.querySelector('[data-msg]');
    let theme = 'light';
    const field = (name) => form.querySelector(`[data-f="${name}"]`);

    const read = () => {
      const kind = root.querySelector('[data-cta-kind][aria-selected="true"]')?.dataset.ctaKind || 'none';
      const routeSel = root.querySelector('[data-route-select]')?.value;
      a.title = field('title').value.trim();
      a.body = field('body').value.trim();
      a.details = field('details').value.trim();
      a.badge = field('badge').value.trim();
      a.ctaKind = kind;
      a.ctaLabel = field('ctaLabel').value.trim();
      a.ctaTarget = kind === 'route' && routeSel !== '__custom' ? routeSel : field('ctaTarget').value.trim();
      a.audience = {
        gender: field('gender').value,
        platforms: [...form.querySelectorAll('[data-platform]:checked')].map((el) => el.dataset.platform),
      };
      a.startsAt = fromLocalInput(field('startsAt').value);
      a.endsAt = fromLocalInput(field('endsAt').value);
      a.priority = Number(field('priority').value || 100);
      a.dismissible = field('dismissible').checked;
      return a;
    };

    const counts = () => {
      root.querySelector('[data-count="title"]').textContent = `${field('title').value.length} / 80`;
      root.querySelector('[data-count="body"]').textContent = `${field('body').value.length} / 220 · ბარათზე ჩანს დაახლ. 3 ხაზი`;
    };

    const paint = () => {
      read();
      counts();
      root.querySelector('[data-phone]').innerHTML = phonePreview(a, theme);
      root.querySelector('[data-remove-image]').hidden = !(a.image || a.imageUrl);
    };

    root.querySelector('[data-back]').onclick = async () => {
      if (V().confirmLeave && !(await V().confirmLeave())) return;
      closeEditor();
    };
    form.addEventListener('input', paint);
    form.addEventListener('change', paint);
    form.addEventListener('submit', (e) => e.preventDefault());
    root.querySelectorAll('[data-tone]').forEach((b) => b.addEventListener('click', () => {
      a.tone = b.dataset.tone;
      root.querySelectorAll('[data-tone]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      V().setDirty?.(true);
      paint();
    }));
    root.querySelectorAll('[data-cta-kind]').forEach((b) => b.addEventListener('click', () => {
      const kind = b.dataset.ctaKind;
      root.querySelectorAll('[data-cta-kind]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      root.querySelector('[data-cta-fields]').hidden = kind === 'none';
      root.querySelector('[data-route-pick]').hidden = kind !== 'route';
      const custom = root.querySelector('[data-route-select]').value === '__custom';
      const targetField = root.querySelector('[data-target-field]');
      targetField.hidden = !(kind === 'url' || (kind === 'route' && custom));
      targetField.querySelector('span').textContent = kind === 'url' ? 'ბმული (https://) *' : 'გვერდი (/…) *';
      field('ctaTarget').placeholder = kind === 'url' ? 'https://medicard.ge/lisi' : '/nutrition/recipes';
      if (kind === 'url' && !/^https:\/\//.test(field('ctaTarget').value)) field('ctaTarget').value = '';
      V().setDirty?.(true);
      paint();
    }));
    root.querySelector('[data-route-select]').addEventListener('change', (e) => {
      const custom = e.target.value === '__custom';
      root.querySelector('[data-target-field]').hidden = !custom;
      if (custom && !field('ctaTarget').value.startsWith('/')) field('ctaTarget').value = '';
    });
    root.querySelectorAll('[data-pv-theme]').forEach((b) => b.addEventListener('click', () => {
      theme = b.dataset.pvTheme;
      root.querySelectorAll('[data-pv-theme]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      paint();
    }));
    root.querySelector('[data-remove-image]').onclick = () => {
      a.imageId = null;
      a.imageUrl = null;
      a.image = null;
      root.querySelector('[data-image-state]').textContent = '';
      V().setDirty?.(true);
      paint();
    };
    root.querySelector('[data-file]').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const state = root.querySelector('[data-image-state]');
      state.textContent = 'მზადდება…';
      try {
        const resized = await resizeImage(file);
        state.textContent = 'იტვირთება…';
        const r = await api('/images', { method: 'POST', body: resized });
        a.imageId = r.image.id;
        a.imageUrl = null;
        a.image = r.image.url;
        state.textContent = `ატვირთულია · ${resized.width}×${resized.height}`;
        V().setDirty?.(true);
        paint();
      } catch (err) {
        state.textContent = '';
        toast(say(err, 'სურათი ვერ აიტვირთა. სცადე სხვა ფაილი ან ხელახლა.'), 'bad');
      }
    });

    const save = async (status, btn) => {
      read();
      msg.textContent = '';
      if (!a.title) { msg.textContent = 'სათაური სავალდებულოა.'; field('title').focus(); return; }
      if (a.ctaKind !== 'none' && !a.ctaLabel) { msg.textContent = 'ღილაკს სახელი სჭირდება.'; field('ctaLabel').focus(); return; }
      const body = payloadOf(a, status);
      const run = async () => {
        btn.disabled = true;
        btn.classList.add('is-loading');
        try {
          await (a.id
            ? api(`/${encodeURIComponent(a.id)}`, { method: 'PUT', body })
            : api('/', { method: 'POST', body }));
          V().setDirty?.(false);
          toast(status === 'PUBLISHED' ? (a.id && a.status === 'PUBLISHED' ? 'ცვლილებები შენახულია' : 'სიახლე გამოქვეყნდა') : 'დრაფტი შენახულია', 'ok');
          st.editing = null;
          await renderNews();
        } catch (err) {
          msg.textContent = err.fields?.map?.((f) => f.message).join(' · ') || say(err, 'ვერ შეინახა. შეამოწმე ველები და სცადე ხელახლა.');
        } finally {
          btn.disabled = false;
          btn.classList.remove('is-loading');
        }
      };
      if (status === 'PUBLISHED' && !(a.id && a.status === 'PUBLISHED')) {
        V().openConfirm?.({
          title: 'გამოქვეყნება?',
          message: `„${a.title}“ გამოჩნდება მთავარ გვერდზე (${audienceText(a.audience)})${a.startsAt ? `, ${when(a.startsAt)}-დან` : ' ≤1 წუთში'}.`,
          confirmLabel: 'გამოქვეყნება',
          onConfirm: run,
        });
      } else await run();
    };
    root.querySelector('[data-save-draft]')?.addEventListener('click', (e) => save('DRAFT', e.currentTarget));
    root.querySelector('[data-save-live]').addEventListener('click', (e) => save('PUBLISHED', e.currentTarget));
    V().watchDirty?.(form);
    paint();
  }

  /** Phone-width mock of the Home card — mirrors mobile/src/components/home/HomeNewsSection.tsx. */
  function phonePreview(a, theme) {
    const dark = theme === 'dark';
    const [, lightInk, darkInk] = TONES[a.tone] || TONES.teal;
    const img = a.image || a.imageUrl;
    const x = a.dismissible !== false ? `<span class="p1-phone-x${img ? ' is-on-image' : ''}" aria-hidden="true">×</span>` : '';
    const tile = img ? '' : `<span class="p1-phone-tile">${ico('megaphone')}</span>`;
    return `<div class="p1-phone${dark ? ' is-dark' : ''}" style="--ph-ink:${dark ? darkInk : lightInk}">
      <div class="p1-phone-screen">
        <div class="p1-phone-bar"></div>
        <div class="p1-phone-h">სიახლეები</div>
        <div class="p1-phone-card">
          ${img ? `<img class="p1-phone-img" src="${esc(imgSrc(img))}" alt="">` : ''}
          ${x}
          <div class="p1-phone-body">
            <div class="p1-phone-row">${tile}<div class="p1-phone-copy${img || a.dismissible === false ? '' : ' has-x'}">
              <div><span class="p1-phone-badge">${esc(a.badge || 'სიახლე')}</span></div>
              <div class="p1-phone-title">${esc(a.title || 'სათაური')}</div>
              ${a.body ? `<div class="p1-phone-text">${esc(a.body)}</div>` : ''}
            </div></div>
            <div class="p1-phone-cta"><span>${esc(a.ctaKind !== 'none' && a.ctaLabel ? a.ctaLabel : 'დეტალურად')}</span><span aria-hidden="true">↗</span></div>
          </div>
        </div>
        <div class="p1-phone-h is-next">კვება</div>
        <div class="p1-phone-ghost"></div>
      </div></div>`;
  }

  /** Shrinks to ≤1600 px on the long edge and re-encodes as JPEG ≤ ~1 MB. */
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error('სურათი უნდა იყოს JPEG, PNG ან WebP.')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = doc.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 1_500_000 && quality > 0.5) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve({ dataUrl, width, height });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('სურათი ვერ წავიკითხე.')); };
      img.src = url;
    });
  }

  global.renderNews = renderNews;
  global.AdminV4News = { renderNews };
})(window);
