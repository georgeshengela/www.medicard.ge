/**
 * MediCard Admin V4 — #/home-sections „მთავარი გვერდი“ (/api/admin/manage/home, owner 2026-10-13).
 * Per Home layout (ქალის · აქტიური · წონა და კვება · სტანდარტული): which sections show and in which order.
 * Every switch or move saves at once and reaches the apps live (socket `app:config` → the app re-reads
 * /api/app/status). The phone on the right is a sketch of the result; module switches (#/features) still hide a
 * paused module on top of this. The greeting and the disclaimer are fixed.
 */
(function adminV4HomeSections(global) {
  const doc = document;
  const toast = (m, k) => global.toast?.(m, k);
  const api = (path, opts) => global.api(`/manage/home${path}`, opts);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = (iso) => (iso && global.AdminV3?.formatDate ? global.AdminV3.formatDate(iso, 'datetime') : '');
  const say = (err, fallback) => (/[ა-ჿ]/.test(err?.message || '') ? err.message : fallback);

  if (typeof global.ICONS === 'object') {
    // A phone with stacked blocks — the Home page.
    global.ICONS.homeLayout = '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 7h6M9 10.5h6M9 14h3.5"/>';
  }

  const MOD = {
    medi: ['Medi', '#0D9488', '#2DD4BF'], pill: ['MEDIPILL', '#1D4ED8', '#93C5FD'], coach: ['MEDICOACH', '#475569', '#CBD5E1'],
    cycle: ['MEDICYCLE', '#C92A55', '#FF8FA8'], sleep: ['MEDISLEEP', '#8A35C2', '#D9A8FF'], horo: ['MEDIHOROSCOPE', '#8A6414', '#E9C77E'],
    run: ['MEDIRUN', '#0D9488', '#2DD4BF'], scan: ['MEDISCAN', '#0891B2', '#67E8F9'], food: ['MEDIFOOD', '#047857', '#34D399'],
    quest: ['MEDIQUEST', '#6D28D9', '#C4B5FD'],
  };
  const SIZE_PT = { s: 76, m: 190, l: 330 }; // rough height on a phone, for „≈ N ეკრანი“
  const SIZE_PX = { s: 18, m: 34, l: 56 }; // the sketch
  const FEMALE_ONLY = new Set(['cycle', 'cycleHero', 'cycleAhead', 'cycleTips', 'cycleStats', 'community']);

  const S = { data: null, layout: 'women', order: [], hidden: new Set(), saving: null, drag: null, dirty: 0 };

  const root = () => doc.getElementById('tab-home-sections');
  const isLocked = (id) => S.data.locked.includes(id);
  const defaults = () => S.data.defaults[S.layout];
  const sameOrder = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  function loadLayout(layout) {
    S.layout = layout;
    const cfg = S.data.config.layouts[layout] || {};
    S.order = cfg.order ? [...cfg.order] : [...defaults()];
    S.hidden = new Set(cfg.hidden || []);
  }

  /* ───────────── render ───────────── */
  function render() {
    const el = root();
    if (!el) return;
    const d = S.data;
    const counts = d.counts || {};
    const isDefault = sameOrder(S.order, defaults()) && S.hidden.size === 0;
    const isRecommended = sameOrder(S.order, d.recommended[S.layout]);
    el.innerHTML = `
      <div class="hs">
        <div class="hs-top">
          <div class="s-segment" role="tablist" aria-label="მთავარი გვერდის ვარიანტი">
            ${d.layouts.map((k) => `<button type="button" role="tab" data-layout="${k}" aria-selected="${k === S.layout}">${esc(d.labels[k])}<i title="ამდენმა აირჩია">${counts[k] ?? 0}</i></button>`).join('')}
          </div>
          <div class="hs-live" aria-live="polite">
            <span class="hs-dot${S.saving ? ' is-saving' : ''}"></span>
            <span>${S.saving ? 'ინახება…' : 'ცოცხლად — ცვლილება აპებში მაშინვე ჩანს'}</span>
            ${d.updatedAt ? `<small>ბოლოს: ${esc(when(d.updatedAt))}</small>` : ''}
          </div>
        </div>
        ${!isRecommended ? `
        <div class="hs-tip">
          <div><b>რეკომენდებული განლაგება</b><span>${esc(tipFor(S.layout))}</span></div>
          <button type="button" class="btn primary" data-act="recommend">ნახვა და გამოყენება</button>
        </div>` : ''}
        <div class="hs-grid">
          <section class="s-card hs-list" aria-label="სექციები">
            <header class="s-card-head">
              <div><h3>${esc(d.labels[S.layout])} — სექციები</h3>
                <p>გადაათრიე ⋮⋮-ით ან ისრებით; გამორთული სექცია იმალება მხოლოდ ამ ვარიანტში.${counts.unset ? ` ${counts.unset} ადამიანს ვარიანტი არ აურჩევია — მათ საწყისი გვერდი ჩანს.` : ''}</p></div>
              <div class="hs-actions">
                <button type="button" class="btn secondary" data-act="reset" ${isDefault ? 'disabled' : ''}>ნაგულისხმევი</button>
              </div>
            </header>
            <ol class="hs-rows">${S.order.map((id, i) => row(id, i)).join('')}</ol>
          </section>
          <aside class="hs-phone-wrap" aria-label="გვერდის ესკიზი">${phone()}</aside>
        </div>
      </div>`;
    bind(el);
  }

  function tipFor(layout) {
    return ({
      women: 'ძილი „შენი დღის“ შემდეგ, ჰოროსკოპი MEDISCAN-ის ქვემოთ — ციკლი და მისი ბარათები რჩება ზემოთ.',
      active: 'MEDIRUN პირველ ეკრანზე, ძილი მისიების შემდეგ, ჰოროსკოპი ბოლოსკენ.',
      weight: 'კვების ბირთვი ზემოთ, ძილი წყლისა და ნაბიჯების შემდეგ, ჰოროსკოპი ბოლოსკენ.',
      standard: 'გამოწვევები და MEDISCAN ძილზე მაღლა, სიახლეები და ჰოროსკოპი ბოლოსკენ.',
    })[layout] || '';
  }

  function row(id, i) {
    const meta = S.data.sections[id] || { label: id, size: 's' };
    const locked = isLocked(id);
    const on = !S.hidden.has(id);
    const mod = meta.module && MOD[meta.module];
    const off = meta.feature && S.data.features[meta.feature] === false;
    const tags = [
      off ? '<span class="s-badge is-warn">მოდული გამორთულია</span>' : '',
      FEMALE_ONLY.has(id) && S.layout !== 'women' ? '<span class="s-badge is-plain">მხოლოდ ქალებს</span>' : '',
      locked ? '<span class="s-badge is-plain">ფიქსირებული</span>' : '',
    ].join('');
    return `
      <li class="hs-row${on ? '' : ' is-off'}${locked ? ' is-locked' : ''}" data-id="${esc(id)}" ${locked ? '' : 'draggable="true"'} style="--hs-mod:${mod ? mod[1] : 'var(--s-line-strong, #94a3b8)'};--hs-mod-d:${mod ? mod[2] : 'var(--s-line-strong, #94a3b8)'}">
        <span class="hs-grip" aria-hidden="true">${locked ? '<svg viewBox="0 0 24 24"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/></svg>' : '⋮⋮'}</span>
        <span class="hs-n">${i + 1}</span>
        <span class="hs-chip" aria-hidden="true"></span>
        <span class="hs-text"><b>${esc(meta.label)}</b><small>${esc(meta.hint || '')}</small></span>
        <span class="hs-tags">${tags}</span>
        ${locked ? '<span class="hs-move"></span>' : `<span class="hs-move">
          <button type="button" class="hs-arrow" data-move="-1" aria-label="${esc(meta.label)} — ზემოთ" ${i <= 1 ? 'disabled' : ''}>↑</button>
          <button type="button" class="hs-arrow" data-move="1" aria-label="${esc(meta.label)} — ქვემოთ" ${i >= S.order.length - 2 ? 'disabled' : ''}>↓</button></span>`}
        ${locked ? '<span class="hs-switch-slot"></span>' : `<input class="s-switch" type="checkbox" role="switch" aria-label="${esc(meta.label)} — ჩანს" ${on ? 'checked' : ''} data-toggle>`}
      </li>`;
  }

  function phone() {
    const shown = S.order.filter((id) => !S.hidden.has(id));
    const pt = shown.reduce((n, id) => n + (SIZE_PT[S.data.sections[id]?.size] || 76), 0);
    const screens = Math.max(1, pt / 700);
    const blocks = shown.map((id) => {
      const meta = S.data.sections[id] || { label: id, size: 's' };
      const mod = meta.module && MOD[meta.module];
      const off = meta.feature && S.data.features[meta.feature] === false;
      return `<div class="hs-block is-${meta.size || 's'}${off ? ' is-ghost' : ''}${mod ? ' is-mod' : ''}" style="--hs-mod:${mod ? mod[1] : 'transparent'};--hs-mod-d:${mod ? mod[2] : 'transparent'};height:${SIZE_PX[meta.size] || 18}px" title="${esc(meta.label)}${off ? ' — მოდული გამორთულია' : ''}"><span>${esc(meta.label)}</span></div>`;
    }).join('');
    return `
      <div class="hs-phone">
        <div class="hs-island"></div>
        <div class="hs-screen">${blocks}</div>
      </div>
      <p class="hs-phone-note"><b>${shown.length}</b> სექცია · ≈ ${screens.toFixed(1).replace('.', ',')} ეკრანი გადახვევით</p>
      <p class="hs-phone-note is-soft">ესკიზია: ცარიელი სექციები (დოზა არ არის, ტრენერი არ ჰყავს, პროფილი სრულია) აპში თავისით იმალება.</p>`;
  }

  /* ───────────── actions ───────────── */
  function bind(el) {
    el.querySelectorAll('[data-layout]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.layout === S.layout) return;
      loadLayout(b.dataset.layout);
      render();
    }));
    el.querySelector('[data-act="reset"]')?.addEventListener('click', resetLayout);
    el.querySelector('[data-act="recommend"]')?.addEventListener('click', recommend);
    el.querySelectorAll('.hs-row').forEach((li) => {
      const id = li.dataset.id;
      li.querySelector('[data-toggle]')?.addEventListener('change', (e) => {
        if (e.target.checked) S.hidden.delete(id); else S.hidden.add(id);
        save();
        refreshView();
      });
      li.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => move(id, Number(b.dataset.move))));
      if (li.getAttribute('draggable') === 'true') {
        li.addEventListener('dragstart', (e) => {
          S.drag = id;
          li.classList.add('is-dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', id);
        });
        li.addEventListener('dragend', () => { S.drag = null; li.classList.remove('is-dragging'); el.querySelectorAll('.is-over').forEach((x) => x.classList.remove('is-over')); });
      }
      li.addEventListener('dragover', (e) => {
        if (!S.drag || S.drag === id || isLocked(id)) return;
        e.preventDefault();
        el.querySelectorAll('.is-over').forEach((x) => x !== li && x.classList.remove('is-over'));
        li.classList.add('is-over');
      });
      li.addEventListener('dragleave', () => li.classList.remove('is-over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('is-over');
        const from = S.drag;
        if (!from || from === id || isLocked(id)) return;
        const order = S.order.filter((x) => x !== from);
        const at = order.indexOf(id) + (S.order.indexOf(from) < S.order.indexOf(id) ? 1 : 0);
        order.splice(at, 0, from);
        S.order = order;
        save();
        render();
        flash(from);
      });
    });
  }

  function move(id, dir) {
    const i = S.order.indexOf(id);
    const j = i + dir;
    if (j < 1 || j > S.order.length - 2 || isLocked(S.order[j])) return;
    const order = [...S.order];
    [order[i], order[j]] = [order[j], order[i]];
    S.order = order;
    save();
    render();
    flash(id);
    root()?.querySelector(`.hs-row[data-id="${CSS.escape(id)}"] [data-move="${dir}"]`)?.focus();
  }

  function flash(id) {
    const li = root()?.querySelector(`.hs-row[data-id="${CSS.escape(id)}"]`);
    if (!li) return;
    li.classList.add('is-moved');
    setTimeout(() => li.classList.remove('is-moved'), 900);
  }

  /** Switch changes only repaint the row and the phone (keeps focus on the switch). */
  function refreshView() {
    const el = root();
    if (!el) return;
    el.querySelectorAll('.hs-row').forEach((li) => li.classList.toggle('is-off', S.hidden.has(li.dataset.id)));
    const wrap = el.querySelector('.hs-phone-wrap');
    if (wrap) wrap.innerHTML = phone();
    const reset = el.querySelector('[data-act="reset"]');
    if (reset) reset.disabled = sameOrder(S.order, defaults()) && S.hidden.size === 0;
  }

  let timer = null;
  function save({ reset = false } = {}) {
    S.saving = S.layout;
    paintLive();
    clearTimeout(timer);
    const layout = S.layout;
    const body = reset ? { layout, reset: true } : { layout, order: S.order, hidden: [...S.hidden] };
    timer = setTimeout(async () => {
      try {
        const res = await api('', { method: 'PUT', body });
        S.data.config = res.config;
        S.data.version = res.version;
        S.data.updatedAt = res.updatedAt;
        S.saving = null;
        paintLive();
        toast('შენახულია — აპებში უკვე ჩანს', 'ok');
      } catch (err) {
        S.saving = null;
        toast(say(err, 'ვერ შეინახა. სცადე თავიდან.'), 'bad');
        await load();
      }
    }, reset ? 0 : 450);
  }

  function paintLive() {
    const live = root()?.querySelector('.hs-live');
    if (!live) return;
    live.querySelector('.hs-dot')?.classList.toggle('is-saving', Boolean(S.saving));
    const label = live.querySelector('span:not(.hs-dot)');
    if (label) label.textContent = S.saving ? 'ინახება…' : 'ცოცხლად — ცვლილება აპებში მაშინვე ჩანს';
    const small = live.querySelector('small');
    if (small && S.data.updatedAt) small.textContent = `ბოლოს: ${when(S.data.updatedAt)}`;
  }

  async function resetLayout() {
    const ok = await confirmDialog('ნაგულისხმევზე დაბრუნება', `${S.data.labels[S.layout]} ვარიანტი დაუბრუნდება აპის საწყის თანმიმდევრობას და ყველა სექცია გამოჩნდება.`, 'დაბრუნება');
    if (!ok) return;
    S.order = [...defaults()];
    S.hidden = new Set();
    save({ reset: true });
    render();
  }

  async function recommend() {
    const rec = S.data.recommended[S.layout];
    const moved = rec.filter((id, i) => S.order.indexOf(id) !== i && !isLocked(id)).map((id) => S.data.sections[id]?.label || id);
    const ok = await confirmDialog(
      'რეკომენდებული განლაგება',
      `${tipFor(S.layout)}${moved.length ? ` ადგილს იცვლის: ${moved.slice(0, 6).join(', ')}${moved.length > 6 ? ` და კიდევ ${moved.length - 6}` : ''}.` : ''} დამალული სექციები დამალული დარჩება.`,
      'გამოყენება',
    );
    if (!ok) return;
    S.order = [...rec];
    save();
    render();
  }

  function confirmDialog(title, message, confirmLabel) {
    const open = global.AdminV3?.openConfirm;
    if (!open) return Promise.resolve(true);
    return new Promise((resolve) => {
      open({ title, message, confirmLabel, cancelLabel: 'გაუქმება', onConfirm: () => resolve(true), onCancel: () => resolve(false) });
    });
  }

  /* ───────────── load ───────────── */
  async function load() {
    const el = root();
    if (!el) return;
    if (!S.data) el.innerHTML = `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
    try {
      S.data = await api('');
      if (!S.data.layouts.includes(S.layout)) S.layout = S.data.layouts[0];
      loadLayout(S.layout);
      render();
    } catch (err) {
      el.innerHTML = `<div class="s-card"><div class="s-empty"><strong>ვერ ჩაიტვირთა</strong><span>${esc(say(err, 'სერვერი არ პასუხობს. სცადე ცოტა ხანში.'))}</span></div></div>`;
    }
  }

  global.renderHomeSections = load;
})(window);
