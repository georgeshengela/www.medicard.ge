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
  const api = (path, opts) => global.api(`/announcements${path}`, opts);
  const manageApi = (path, opts) => global.api(`/manage${path}`, opts);
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;

  if (typeof ICONS === 'object') {
    ICONS['arrow-left'] = ICONS['arrow-left'] || '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>';
    ICONS.upload = ICONS.upload || '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>';
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
    SCHEDULED: ['is-accent', 'დაგეგმილი'],
    DRAFT: ['', 'დრაფტი'],
    ENDED: ['is-warn', 'დასრულდა'],
    ARCHIVED: ['', 'არქივი'],
  };
  const FILTERS = [['all', 'ყველა'], ['LIVE', 'აქტიური'], ['SCHEDULED', 'დაგეგმილი'], ['DRAFT', 'დრაფტი'], ['ENDED', 'დასრულებული'], ['ARCHIVED', 'არქივი']];

  const st = { filter: 'all', editing: null, list: [], newsFlag: true };

  const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—');
  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  /** "10 ოქტ, 22:18" in Tbilisi time — built by hand because browsers often lack ka-GE locale data. */
  const when = (iso) => {
    if (!iso) return '';
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tbilisi', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric',
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    return `${p.day} ${MONTHS[Number(p.month) - 1]}, ${p.hour}:${p.minute}`;
  };
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

  /* ═════════ list ═════════ */
  async function renderNews() {
    const root = $('tab-news');
    if (!root) return;
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
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = () => renderNews();
      return;
    }
    st.list = data.announcements || [];
    const all = st.list;
    const live = all.filter((a) => a.phase === 'LIVE');
    const views = all.reduce((s, a) => s + (a.stats?.views || 0), 0);
    const clicks = all.reduce((s, a) => s + (a.stats?.clicks || 0), 0);
    const rows = all.filter((a) => st.filter === 'all' ? a.phase !== 'ARCHIVED' : a.phase === st.filter);

    root.innerHTML = `<div class="s-stack v3-tab-shell">
      ${st.newsFlag ? '' : `<div class="s-callout is-warn">${ico('alert')}<p><b>სიახლეები გამორთულია „მოდულებში“.</b> აპში არცერთი ბარათი არ ჩანს, სანამ <a href="#/features">მოდულები → სიახლეები</a> ისევ არ ჩაირთვება.</p></div>`}
      <div class="s-metrics">
        <div class="s-metric"><span>ახლა აპში</span><strong>${fmt(live.length)}</strong><small>ერთდროულად ჩანს მაქს. 5</small></div>
        <div class="s-metric"><span>დაგეგმილი</span><strong>${fmt(all.filter((a) => a.phase === 'SCHEDULED').length)}</strong></div>
        <div class="s-metric"><span>ნახვა (უნიკალური)</span><strong>${fmt(views)}</strong><small>ყველა სიახლე</small></div>
        <div class="s-metric"><span>დაჭერა</span><strong>${fmt(clicks)}</strong><small>CTR ${pct(clicks, views)}</small></div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>სიახლის ბარათები</h3>
          <p>ბარათი ჩანს აპის მთავარ გვერდზე, კვების სექციის ზემოთ. დაჭერისას იხსნება დეტალური გვერდი. ჩანს აპის 1.0.0.16.2 და უფრო ახალ ვერსიაში.</p></div>
          <button type="button" class="btn primary" data-new>${ico('plus')} ახალი სიახლე</button></header>
        <div class="s-card-body" style="padding-bottom:0"><div class="s-segment s-segment-wrap" role="tablist" aria-label="ფილტრი">${FILTERS.map(([k, l]) => `<button type="button" role="tab" data-filter="${k}" aria-selected="${k === st.filter}">${l}</button>`).join('')}</div></div>
        <div class="s-card-body is-flush">${rows.length ? `<div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>სიახლე</th><th>სტატუსი</th><th>აუდიტორია</th><th>დრო</th><th class="num">ნახვა</th><th class="num">დაჭერა</th><th class="num">დამალა</th><th class="num">რიგი</th><th></th></tr></thead>
          <tbody>${rows.map(rowHtml).join('')}</tbody></table></div>`
          : `<div class="s-empty">${ico('megaphone')}<strong>${st.filter === 'all' ? 'ჯერ სიახლე არ გაქვს' : 'ამ ფილტრში ცარიელია'}</strong><span>მაგალითად: „მოიარე ლისი და მოიგე PS5“ — სურათი, მოკლე ტექსტი და ღილაკი MEDIRUN-ზე.</span></div>`}</div>
      </section>
      <div class="s-callout">${ico('info')}<p>სიახლე ჯანმრთელობის მონაცემს არ შეიცავს და არ იყენებს. ნახვა ითვლება ერთხელ ადამიანზე. „დამალა“ — ვინც ბარათი X-ით დახურა; მას ის აღარ გამოუჩნდება არცერთ მოწყობილობაზე.</p></div>
    </div>`;

    root.querySelector('[data-new]').onclick = () => openEditor(null);
    root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { st.filter = b.dataset.filter; void renderNews(); }));
    root.querySelectorAll('[data-row]').forEach((tr) => {
      const item = st.list.find((a) => a.id === tr.dataset.row);
      tr.querySelector('[data-edit]')?.addEventListener('click', () => openEditor(item));
      tr.querySelector('[data-dup]')?.addEventListener('click', () => openEditor({ ...item, id: null, status: 'DRAFT', title: `${item.title} (ასლი)` }));
      tr.querySelector('[data-toggle-live]')?.addEventListener('click', (e) => togglePublish(item, e.currentTarget));
      tr.querySelector('[data-archive]')?.addEventListener('click', () => archive(item, item.status !== 'ARCHIVED'));
    });
  }

  function rowHtml(a) {
    const [badge, label] = PHASE[a.phase] || ['', a.phase];
    const thumb = a.image
      ? `<img src="${esc(imgSrc(a.image))}" alt="" style="width:64px;height:36px;object-fit:cover;border-radius:6px;flex:none">`
      : `<span style="width:64px;height:36px;border-radius:6px;flex:none;display:grid;place-items:center;background:${TONES[a.tone]?.[1] || '#0F766E'}1f;color:${TONES[a.tone]?.[1] || '#0F766E'}">${ico('megaphone')}</span>`;
    const window = [a.startsAt ? `${when(a.startsAt)}-დან` : '', a.endsAt ? `${when(a.endsAt)}-მდე` : ''].filter(Boolean).join(' ') || 'უვადო';
    const published = a.status === 'PUBLISHED';
    return `<tr data-row="${esc(a.id)}">
      <td><div style="display:flex;gap:12px;align-items:center;min-width:260px">${thumb}<div style="min-width:0"><b>${esc(a.title)}</b><div class="s-muted" style="font-size:12px;max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.body || a.details || '')}</div></div></div></td>
      <td><span class="s-badge ${badge}">${label}</span></td>
      <td>${esc(audienceText(a.audience))}</td>
      <td style="font-size:12.5px">${esc(window)}</td>
      <td class="num">${fmt(a.stats?.views)}</td>
      <td class="num">${fmt(a.stats?.clicks)}<div class="s-muted" style="font-size:11.5px">${pct(a.stats?.clicks || 0, a.stats?.views || 0)}</div></td>
      <td class="num">${fmt(a.stats?.dismissals)}</td>
      <td class="num">${fmt(a.priority)}</td>
      <td class="num" style="white-space:nowrap">
        ${a.status === 'ARCHIVED'
          ? '<button type="button" class="btn compact" data-archive>აღდგენა</button>'
          : `<button type="button" class="btn compact" data-edit>რედაქტირება</button>
             <button type="button" class="btn compact ${published ? '' : 'primary'}" data-toggle-live>${published ? 'შეჩერება' : 'გამოქვეყნება'}</button>
             <button type="button" class="btn compact ghost" data-dup title="ასლის შექმნა">ასლი</button>
             <button type="button" class="btn compact ghost" data-archive title="არქივში გადატანა">არქივი</button>`}
      </td></tr>`;
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
        toast(e.message, 'bad');
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
      } catch (e) { toast(e.message, 'bad'); }
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
    root.innerHTML = `<div class="s-stack v3-tab-shell">
      <div class="s-toolbar">
        <button type="button" class="btn ghost" data-back>${ico('arrow-left')} ყველა სიახლე</button>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isLive ? '' : '<button type="button" class="btn" data-save-draft>დრაფტად შენახვა</button>'}
          <button type="button" class="btn primary" data-save-live>${isLive ? 'ცვლილებების შენახვა' : 'გამოქვეყნება'}</button>
        </div>
      </div>
      <p class="s-form-msg" role="alert" data-msg></p>
      <div class="s-split">
        <form class="s-stack" data-form novalidate>
          <section class="s-card"><header class="s-card-head"><div><h3>შინაარსი</h3><p>მოკლე და კონკრეტული: რა ხდება და რას იღებს ადამიანი.</p></div></header>
            <div class="s-card-body s-stack">
              <label class="s-field"><span>სათაური *</span><input data-f="title" maxlength="80" required value="${esc(a.title)}" placeholder="მოიარე ლისი და მოიგე PlayStation 5"><small data-count="title"></small></label>
              <label class="s-field"><span>მოკლე ტექსტი ბარათზე</span><textarea data-f="body" maxlength="220" rows="3" placeholder="MEDIRUN-ის შემოდგომის ღონისძიება: 1–15 ოქტომბერი. ყველა, ვინც ლისის ტბას შემოუვლის, მონაწილეობს გათამაშებაში.">${esc(a.body)}</textarea><small data-count="body"></small></label>
              <div class="s-form-grid">
                <label class="s-field"><span>ნიშანი (ბეჯი)</span><input data-f="badge" maxlength="24" value="${esc(a.badge)}" placeholder="სიახლე / ღონისძიება / საჩუქარი"><small>ცარიელზე ჩანს „სიახლე“.</small></label>
                <div class="s-field"><span>ფერი</span><div class="s-chips" role="radiogroup" aria-label="ფერი">${Object.entries(TONES).map(([k, [label, hex]]) => `<button type="button" role="radio" aria-checked="${a.tone === k}" data-tone="${k}" title="${label}" aria-label="${label}" style="width:30px;height:30px;border-radius:50%;border:2px solid ${a.tone === k ? 'var(--s-ink)' : 'transparent'};background:${hex};box-shadow:inset 0 0 0 2px var(--s-surface);cursor:pointer"></button>`).join('')}</div></div>
              </div>
              <div class="s-field"><span>სურათი (არასავალდებულო)</span>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                  <label class="btn compact" style="cursor:pointer">${ico('upload')} ატვირთვა<input type="file" accept="image/jpeg,image/png,image/webp" data-file hidden></label>
                  <button type="button" class="btn compact ghost" data-remove-image ${a.image || a.imageUrl ? '' : 'hidden'}>სურათის მოშორება</button>
                  <span class="s-muted" style="font-size:12px" data-image-state></span>
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
              <label class="s-switch-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><span><b style="font-size:13.5px">ადამიანს შეუძლია დამალოს (X)</b><br><small class="s-muted">გამორთე მხოლოდ მნიშვნელოვან ცნობაზე.</small></span><input class="s-switch" type="checkbox" role="switch" data-f="dismissible" ${a.dismissible !== false ? 'checked' : ''}></label>
            </div></section>
        </form>

        <div class="s-preview">
          <div class="s-toolbar"><b style="font-size:13px">აპში ასე გამოჩნდება</b>
            <div class="s-segment" role="tablist" aria-label="თემა"><button type="button" role="tab" data-pv-theme="light" aria-selected="true">ნათელი</button><button type="button" role="tab" data-pv-theme="dark" aria-selected="false">მუქი</button></div></div>
          <div data-phone></div>
          <p class="s-muted" style="font-size:12px;margin:0">ბარათზე დაჭერით იხსნება დეტალური გვერდი: სურათი, სათაური, დეტალური ტექსტი და ღილაკი.</p>
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
      root.querySelectorAll('[data-tone]').forEach((x) => {
        x.setAttribute('aria-checked', String(x === b));
        x.style.borderColor = x === b ? 'var(--s-ink)' : 'transparent';
      });
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
        toast(err.message || 'სურათი ვერ აიტვირთა', 'bad');
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
          msg.textContent = err.fields?.map?.((f) => f.message).join(' · ') || err.message;
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
    const ink = dark ? darkInk : lightInk;
    const c = dark
      ? { bg: '#030712', surface: '#111827', text1: '#FFFFFF', text2: '#D1D5DB', rule: '#374151', link: '#99F6E4' }
      : { bg: '#F3F5F6', surface: '#FFFFFF', text1: '#111827', text2: '#4B5563', rule: '#E5E7EB', link: '#0F766E' };
    const img = a.image || a.imageUrl;
    const x = a.dismissible !== false
      ? `<span style="position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:14px;display:grid;place-items:center;background:${img ? 'rgba(0,0,0,.45)' : 'transparent'};color:${img ? '#fff' : c.text2};font-size:16px">×</span>` : '';
    const cta = a.ctaKind !== 'none' && a.ctaLabel
      ? `<div style="display:flex;align-items:center;gap:8px;border-top:1px solid ${c.rule};padding-top:12px;margin-top:14px;color:${ink};font:600 13px/20px 'Noto Sans Georgian',sans-serif"><span style="flex:1">${esc(a.ctaLabel)}</span><span>↗</span></div>`
      : `<div style="display:flex;align-items:center;gap:8px;border-top:1px solid ${c.rule};padding-top:12px;margin-top:14px;color:${ink};font:600 13px/20px 'Noto Sans Georgian',sans-serif"><span style="flex:1">დეტალურად</span><span>↗</span></div>`;
    const badge = `<span style="display:inline-block;padding:3px 9px;border-radius:99px;background:${ink}${dark ? '26' : '14'};color:${ink};font:600 11px/16px 'Noto Sans Georgian',sans-serif">${esc(a.badge || 'სიახლე')}</span>`;
    const tile = img ? '' : `<span style="width:42px;height:42px;border-radius:14px;flex:none;display:grid;place-items:center;background:${ink}${dark ? '26' : '14'};color:${ink}">${ico('megaphone')}</span>`;
    return `<div style="width:360px;max-width:100%;margin:0 auto;border-radius:36px;padding:14px;background:${dark ? '#1f2937' : '#d9dee2'}">
      <div style="border-radius:26px;background:${c.bg};padding:18px 20px 22px;font-family:'Noto Sans Georgian',sans-serif">
        <div style="height:10px;border-radius:6px;background:${c.surface};opacity:.6;margin-bottom:22px"></div>
        <div style="font:700 17px/24px 'Noto Sans Georgian',sans-serif;color:${c.text1};margin-bottom:12px">სიახლეები</div>
        <div style="position:relative;border-radius:22px;background:${c.surface};overflow:hidden">
          ${img ? `<img src="${esc(imgSrc(img))}" alt="" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover">` : ''}
          ${x}
          <div style="padding:18px">
            <div style="display:flex;gap:14px;align-items:flex-start">${tile}<div style="min-width:0;flex:1;display:grid;gap:6px;${img || a.dismissible === false ? '' : 'padding-right:22px'}">
              <div>${badge}</div>
              <div style="font:600 16px/23px 'Noto Sans Georgian',sans-serif;color:${c.text1}">${esc(a.title || 'სათაური')}</div>
              ${a.body ? `<div style="font:400 13px/20px 'Noto Sans Georgian',sans-serif;color:${c.text2};display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(a.body)}</div>` : ''}
            </div></div>
            ${cta}
          </div>
        </div>
        <div style="font:700 17px/24px 'Noto Sans Georgian',sans-serif;color:${c.text1};margin:26px 0 12px">კვება</div>
        <div style="height:92px;border-radius:22px;background:${c.surface};opacity:.7"></div>
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
