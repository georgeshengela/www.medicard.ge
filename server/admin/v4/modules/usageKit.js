/**
 * MediCard Admin V4 — module-usage page kit (`window.AdminUsage`).
 * One shape for every „who uses this module and how“ page, first built for MEDIVET (#/pets, owner 2026-10-11:
 * „ზუსტად ეს მინდა … ყველა მოდულს ვხედავდე“): what the numbers say in sentences, key numbers, a ladder of
 * steps, a wall of cards with a usage track (the page's one bold element, in the module's own colour via
 * `--mod` on the tab), the 7/30/90-day period, detail cards and „როგორ ითვლება“. Data comes from
 * `/api/admin/…/overview?days=&team=` (server `adminUsageKit.js`). Team (@medicard.ge) accounts are left out
 * unless „გუნდის ჩათვლით“.
 */
(function adminUsageKit(global) {
  const doc = document;
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const num = (n, digits = 1) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE', { maximumFractionDigits: digits }) : '—');
  const pct = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : `${num(n)}%`);
  const share = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
  const when = (iso, mode = 'datetime') => (!iso ? '—' : V().formatDate ? V().formatDate(iso, mode) : String(iso).slice(0, 10));
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  const userHref = (id) => (typeof global.userPageHref === 'function' ? global.userPageHref(id) : `#/users/${encodeURIComponent(id)}`);
  const PERIODS = [7, 30, 90];

  /** Add stroke glyphs (24px family) and repaint sidebar buttons that use them. */
  function glyphs(map) {
    if (typeof ICONS !== 'object') return;
    Object.assign(ICONS, map);
    Object.keys(map).forEach((name) => doc.querySelectorAll(`[data-icon="${name}"]`).forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico(name));
    }));
  }

  const metric = (label, value, hint, tone = '') => `<div class="s-metric${tone ? ` is-${tone}` : ''}"><span>${esc(label)}</span><strong>${value}</strong>${hint ? `<small>${hint}</small>` : ''}</div>`;
  const metrics = (list) => `<div class="s-metrics">${list.join('')}</div>`;
  const empty = (text) => `<div class="s-empty">${ico('info')}<span>${esc(text)}</span></div>`;
  const note = (html) => `<p class="p2-note s-uw-note">${html}</p>`;
  const h4 = (text) => `<h4 class="p2-h s-uw-gap">${esc(text)}</h4>`;
  const card = (title, sub, body, { flush = false, action = '', cls = '' } = {}) => `<section class="s-card${cls ? ` ${cls}` : ''}">
    <header class="s-card-head"><div><h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${action}</header>
    <div class="s-card-body${flush ? ' is-flush' : ''}">${body}</div>
  </section>`;
  const facts = (rows) => `<dl class="p3-facts">${rows.filter(Boolean).map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`).join('')}</dl>`;
  const split = (...cards) => `<div class="p3-split s-uw-split">${cards.join('')}</div>`;
  const warn = (n) => (n ? `<span class="s-uw-warn">${fmt(n)}</span>` : '0');

  /** „ · დასრულდა 2 · გაუქმდა 1“ — only the parts that are not zero. */
  const extras = (parts) => {
    const list = parts.filter(([, n]) => n > 0).map(([label, n]) => `${label} ${fmt(n)}`);
    return list.length ? ` <small class="s-muted">· ${esc(list.join(' · '))}</small>` : '';
  };

  /** Ranked share rows (label · meter · count · %). `total` is the 100%. */
  function shares(rows, total) {
    const list = rows.filter(([, n]) => n > 0);
    if (!list.length) return '';
    return `<ul class="s-share-list">${list.map(([label, n]) => {
      const p = share(n, total) || 0;
      return `<li><span title="${esc(label)}">${esc(label)}</span><div class="s-meter"><i style="width:${Math.max(2, Math.min(100, p))}%"></i></div><b>${fmt(n)}</b><em>${pct(p)}</em></li>`;
    }).join('')}</ul>`;
  }

  /** Small count chips: [[label, n], …], zero rows dropped. */
  const chips = (rows) => {
    const list = rows.filter(([, n]) => n > 0);
    return list.length ? `<div class="s-uw-chips">${list.map(([label, n]) => `<span class="s-badge is-plain">${esc(label)} · ${fmt(n)}</span>`).join('')}</div>` : '';
  };

  /** „რას აჩვენებს მონაცემები“: rows of [tone ('info'|'warn'|'ok'|'muted'), html]. */
  function insights(rows) {
    const glyph = { info: 'info', warn: 'alert', ok: 'check', muted: 'users' };
    return `<section class="s-card s-uw-read">
      <header class="s-card-head"><div><h3>რას აჩვენებს მონაცემები</h3></div></header>
      <ul class="s-card-body s-uw-insights">${rows.filter(Boolean).map(([tone, html]) => `<li class="is-${tone}">${ico(glyph[tone] || 'info')}<p>${html}</p></li>`).join('')}</ul>
    </section>`;
  }

  /**
   * Steps from the first use to the deepest one. `steps` = [{ key, count, rate }]; bars are against the first step,
   * % (rate) against it too. Steps need not be nested.
   */
  function ladder(steps, labels, { first = 'ყველა', unit = '', emptyText = 'მონაცემი ჯერ არ არის.' } = {}) {
    const top = Math.max(1, steps[0]?.count || 0);
    if (!steps[0]?.count) return empty(emptyText);
    return `<ol class="s-funnel s-uw-ladder" style="--n:${steps.length}">${steps.map((s, i) => {
      const v = Math.max(s.count ? 3 : 0, Math.min(100, (s.count / top) * 100));
      return `<li class="s-funnel-step">
        <div class="s-funnel-head"><span>${esc(labels[s.key] || s.key)}</span><strong>${fmt(s.count)}</strong></div>
        <div class="s-funnel-bar" role="img" aria-label="${esc(`${labels[s.key] || s.key}: ${fmt(s.count)}`)}" style="--v:${v.toFixed(1)}%;--lost:0%"><b></b><i></i></div>
        <div class="s-funnel-foot">${i ? `<span class="s-badge is-plain">${pct(s.rate)}</span><span>${esc(unit)}</span>` : `<span>${esc(first)}</span>`}</div>
      </li>`;
    }).join('')}</ol>`;
  }

  /** Usage track: [{ fill: 0–100, title }] — lit = used. */
  const track = (segments) => `<div class="s-uw-track" style="--segs:${segments.length}" role="img" aria-label="${esc(segments.map((s) => s.title).join('; '))}">${segments.map((s) => `<i style="--fill:${Math.max(0, Math.min(100, s.fill))}%" title="${esc(s.title)}"></i>`).join('')}</div>`;
  const legend = (labels) => `<div class="s-uw-legend" style="--segs:${labels.length}" aria-hidden="true">${labels.map((l) => `<span>${esc(l)}</span>`).join('')}</div>`;

  /**
   * One wall card. `glyph` (icon name) or `mark` (short text, e.g. initials) fills the tile; `person` links to the
   * user page (omit it for anonymous cards); `foot` = [line1, line2] on the right.
   */
  /** Set by createWall while it renders one item: the card carries `data-focus` so exact links can find it. */
  let renderingKey = null;

  function itemCard({ glyph = '', mark = '', title, meta = '', badges = '', track: trackHtml = '', line = '', idle = false, person = null, personText = '', foot = [], dim = false }) {
    const who = person
      ? `<a class="s-uw-person" href="${esc(userHref(person.id))}" title="პროფილის გახსნა">
          <span class="s-uw-ava" aria-hidden="true">${esc(initials(person.name))}</span>
          <span><b>${esc(person.name || 'უსახელო')}</b><small>${esc(person.contact || '')}</small></span>
        </a>`
      : `<span class="s-uw-person is-plain">${personText}</span>`;
    return `<article class="s-uw-card${dim ? ' is-dim' : ''}"${renderingKey != null ? ` data-focus="${esc(renderingKey)}"` : ''}>
      <header class="s-uw-head">
        <span class="s-uw-glyph" aria-hidden="true">${glyph ? ico(glyph) : `<b>${esc(mark)}</b>`}</span>
        <div class="s-uw-id"><b title="${esc(title)}">${esc(title)}</b>${meta ? `<small title="${esc(meta)}">${esc(meta)}</small>` : ''}</div>
        ${badges}
      </header>
      ${trackHtml}
      ${line ? `<p class="s-uw-line${idle ? ' is-idle' : ''}">${esc(line)}</p>` : ''}
      <footer class="s-uw-foot">${who}<span class="s-uw-when">${foot.filter(Boolean).map(esc).join('<br>')}</span></footer>
    </article>`;
  }

  /**
   * The wall: a card with filters, search, paging. `filters` = [[key, label, match(item)]]. Paint with `wall.html()`
   * inside the page, then `wall.bind(root)` after the page is in the DOM. State survives re-paints of the page.
   */
  function createWall({ title, sub = '', legendLabels = [], filters, search = () => '', render, emptyText = {}, placeholder = 'ძებნა', page = 24, key = (it) => it.id }) {
    const state = { filter: filters[0][0], query: '', shown: page, items: [], capped: '' };
    const match = Object.fromEntries(filters.map(([k, , fn]) => [k, fn]));
    const list = () => {
      const q = state.query.trim().toLowerCase();
      return state.items.filter((it) => match[state.filter](it) && (!q || String(search(it)).toLowerCase().includes(q)));
    };
    const body = () => {
      const rows = list();
      if (!rows.length) return empty(state.query ? 'ამ ძებნით ვერაფერი მოიძებნა.' : emptyText[state.filter] || 'აქ ჯერ არაფერია.');
      const more = rows.length > state.shown
        ? `<div class="s-uw-more"><button type="button" class="btn compact" data-uw-more>კიდევ ${fmt(Math.min(page, rows.length - state.shown))} · ნაჩვენებია ${fmt(state.shown)} / ${fmt(rows.length)}</button></div>`
        : '';
      const cards = rows.slice(0, state.shown).map((it) => {
        renderingKey = key(it) ?? null;
        try { return render(it); } finally { renderingKey = null; }
      });
      return `<div class="s-uw-wall">${cards.join('')}</div>${more}`;
    };
    const paintBody = (root) => {
      const host = root.querySelector('[data-uw-wall]');
      if (!host) return;
      host.innerHTML = body();
      host.querySelector('[data-uw-more]')?.addEventListener('click', () => {
        state.shown += page;
        paintBody(root);
      });
    };
    return {
      set(items, { total } = {}) {
        state.items = items || [];
        state.capped = total && total > state.items.length ? ` ნაჩვენებია ${fmt(state.items.length)} ${fmt(total)}-დან.` : '';
      },
      html() {
        const counts = Object.fromEntries(filters.map(([k, , fn]) => [k, state.items.filter(fn).length]));
        const seg = `<div class="s-segment" role="tablist" aria-label="ფილტრი">${filters.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === state.filter}" data-uw-filter="${k}">${esc(label)}${counts[k] ? ` <i>${fmt(counts[k])}</i>` : ''}</button>`).join('')}</div>`;
        return `<section class="s-card s-uw-wallcard">
          <header class="s-card-head"><div><h3>${esc(title)}</h3>${sub || state.capped ? `<p>${sub}${state.capped}</p>` : ''}</div>${legendLabels.length ? legend(legendLabels) : ''}</header>
          <div class="s-uw-tools">${seg}
            <label class="p2-search">${ico('search')}<input type="search" data-uw-search placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" value="${esc(state.query)}"></label>
          </div>
          <div data-uw-wall>${body()}</div>
        </section>`;
      },
      /** Exact link: show the card with this key (right filter, no search, paged far enough) and light it up. */
      focus(root, id) {
        const item = state.items.find((it) => String(key(it)) === String(id));
        if (!item) return false;
        if (!match[state.filter](item)) state.filter = (filters.find(([, , fn]) => fn(item)) || filters[0])[0];
        state.query = '';
        const pos = list().indexOf(item);
        if (pos >= state.shown) state.shown = Math.ceil((pos + 1) / page) * page;
        root.querySelectorAll('[data-uw-filter]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.uwFilter === state.filter)));
        const input = root.querySelector('[data-uw-search]');
        if (input) input.value = '';
        paintBody(root);
        return Boolean(global.AdminFocus?.flash(root, String(id)));
      },
      bind(root) {
        // K.page calls this for an exact link (one handler per host, replaced on every paint).
        root.__uwFocus = (id) => this.focus(root, id);
        root.querySelectorAll('[data-uw-filter]').forEach((btn) => btn.addEventListener('click', () => {
          state.filter = btn.dataset.uwFilter;
          state.shown = page;
          root.querySelectorAll('[data-uw-filter]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
          paintBody(root);
        }));
        const input = root.querySelector('[data-uw-search]');
        input?.addEventListener('input', () => {
          state.query = input.value;
          state.shown = page;
          paintBody(root);
        });
        root.querySelector('[data-uw-more]')?.addEventListener('click', () => {
          state.shown += page;
          paintBody(root);
        });
      },
    };
  }

  /** Line chart of the period (AdminCharts). series = [{ label, tone, points }]. */
  const chart = (series, opts = {}) => (global.AdminCharts?.line ? global.AdminCharts.line(series, { height: 220, ...opts }) : '');

  /** „ბოლო N დღე · from – to“ with the 7/30/90 switch, then whatever the page puts under it. */
  const periodTitle = (period, days) => `<div class="s-section-title"><h3>ბოლო ${fmt(period.days)} დღე · ${esc(when(period.from, 'date'))} – ${esc(when(period.to, 'date'))}</h3>
      <div class="s-segment" role="tablist" aria-label="პერიოდი">${PERIODS.map((n) => `<button type="button" role="tab" aria-selected="${n === days}" data-uw-days="${n}">${n} დღე</button>`).join('')}</div></div>`;

  const flagCallout = (flag, html) => (flag && flag.effective === false ? `<div class="s-callout is-warn">${ico('alert')}<p>${html} <a href="#/features">მოდულების ჩართვა</a></p></div>` : '');

  const definitions = (paragraphs) => `<section class="s-card"><details class="s-details s-uw-defs"><summary>${ico('info')} როგორ ითვლება</summary><div>
      ${paragraphs.map((p) => `<p>${p}</p>`).join('')}
    </div></details></section>`;

  /**
   * A usage page: state (days, team), loading, errors, the team switch, refresh and period buttons.
   * paint(data, ctx) returns the page HTML (without the toolbar); after(root, data, ctx) binds extras (walls).
   */
  function page({ tab, path, capability = '', paint, after, teamToggle = true }) {
    const ctx = { days: 30, team: false, data: null };
    let ticket = 0;
    async function render({ keepScroll = false } = {}) {
      const root = doc.getElementById(`tab-${tab}`);
      if (!root) return;
      const host = root.querySelector('[data-uw-page]') || root;
      const mine = ++ticket;
      const y = global.scrollY;
      if (!ctx.data || !keepScroll) host.innerHTML = skel();
      let data;
      try {
        data = await global.api(`${path}?days=${ctx.days}${ctx.team ? '&team=1' : ''}`);
      } catch (err) {
        if (mine !== ticket) return;
        const denied = err?.status === 403;
        host.innerHTML = `<div class="s-card"><div class="s-empty" role="alert">${ico('alert')}<strong>მონაცემები ვერ ჩაიტვირთა</strong><span>${denied ? `შენს ანგარიშს არ აქვს ამ გვერდის ნახვის უფლება${capability ? ` (${esc(capability)})` : ''}.` : 'სერვერმა პასუხი ვერ დააბრუნა — სცადე ხელახლა.'}</span>${!denied && err?.message ? `<small>${esc(err.message)}</small>` : ''}<button type="button" class="btn compact" data-retry>ხელახლა ცდა</button></div></div>`;
        host.querySelector('[data-retry]').onclick = () => void render();
        return;
      }
      if (mine !== ticket) return;
      if (data?.installed === false) {
        host.innerHTML = `<div class="s-card"><div class="s-empty">${ico('info')}<strong>ამ მოდულის ცხრილები ბაზაში ჯერ არ არის</strong><span>სქემა შემდეგი დეპლოისას დაყენდება.</span></div></div>`;
        return;
      }
      ctx.data = data;
      const toolbar = `<div class="s-toolbar">
        ${teamToggle ? `<div class="s-segment" role="tablist" aria-label="ვინ ითვლება">
          <button type="button" role="tab" aria-selected="${!ctx.team}" data-uw-team="0">რეალური მომხმარებლები</button>
          <button type="button" role="tab" aria-selected="${ctx.team}" data-uw-team="1">გუნდის ჩათვლით</button>
        </div>` : '<span></span>'}
        <div class="s-funnel-tools">
          <span class="s-funnel-meta">განახლდა ${esc(when(data.generatedAt))}</span>
          <button type="button" class="btn ghost compact" data-uw-refresh>${ico('refresh')} განახლება</button>
        </div>
      </div>`;
      host.innerHTML = `<div class="s-stack v3-tab-shell s-uw-page">${toolbar}${paint(data, ctx)}</div>`;
      host.querySelectorAll('[data-uw-team]').forEach((btn) => btn.addEventListener('click', () => {
        const next = btn.dataset.uwTeam === '1';
        if (next === ctx.team) return;
        ctx.team = next;
        void render();
      }));
      host.querySelectorAll('[data-uw-days]').forEach((btn) => btn.addEventListener('click', () => {
        const next = Number(btn.dataset.uwDays) || 30;
        if (next === ctx.days) return;
        ctx.days = next;
        void render({ keepScroll: true });
      }));
      host.querySelector('[data-uw-refresh]')?.addEventListener('click', () => void render());
      host.__uwFocus = null;
      after?.(host, data, ctx);
      if (keepScroll) global.scrollTo({ top: y });
      // Exact link (AdminFocus.go): show that card. Not found with real users only → it may be a team account.
      const exact = ctx.focus || global.AdminFocus?.take(tab)?.get('focus') || null;
      ctx.focus = null;
      if (exact && host.__uwFocus) {
        if (host.__uwFocus(exact)) return;
        if (!ctx.team) {
          ctx.team = true;
          ctx.focus = exact;
          void render();
          return;
        }
        global.toast?.('ეს ჩანაწერი ამ გვერდზე ვეღარ მოიძებნა — შესაძლოა წაიშალა.', 'bad');
      }
    }
    return render;
  }

  /**
   * Page tabs for a page that already had its own work surface (#/nutrition, #/quests, #/trainers, #/ai): the usage
   * analysis gets one pane (`[data-uw-page]`, where K.page renders) and the old page another (`[data-uw-legacy]`, where
   * its renderer now writes). panes = [[key, label, render, 'page' | 'legacy']]. A pane renders the first time it is shown;
   * `show.select(key, { fresh })` switches (and re-renders) from code.
   */
  function hostTabs({ tab, label, panes }) {
    const st = { active: panes[0][0], painted: new Set() };
    const shell = () => {
      const root = doc.getElementById(`tab-${tab}`);
      if (!root) return null;
      if (!root.querySelector(':scope > .s-uw-host')) {
        root.innerHTML = `<div class="s-uw-host">
          <div class="s-tabbar s-uw-tabs"><nav class="v3-subnav" role="tablist" aria-label="${esc(label)}">${panes.map(([k, text]) => `<button type="button" role="tab" class="v3-subnav-btn" data-uw-pane-btn="${k}">${esc(text)}</button>`).join('')}</nav></div>
          ${panes.map(([k, , , kind]) => `<div data-uw-pane="${k}" ${kind === 'legacy' ? 'data-uw-legacy' : 'data-uw-page'} hidden></div>`).join('')}
        </div>`;
        st.painted.clear();
        // A pasted exact link (#/trainers?pane=manage…) opens its pane.
        const linked = global.AdminFocus?.parse(location.hash);
        if (linked?.tab === tab && panes.some((p) => p[0] === linked.params.get('pane'))) st.active = linked.params.get('pane');
        root.querySelectorAll('[data-uw-pane-btn]').forEach((b) => b.addEventListener('click', () => {
          if (b.dataset.uwPaneBtn === st.active) return;
          st.active = b.dataset.uwPaneBtn;
          // The pane lives in the hash, so a reload or a copied link reopens it (a feed focus does not survive a pane change).
          global.AdminV3Shell?.writeModuleHash?.(tab, { pane: st.active, focus: null });
          void show();
        }));
      }
      return root;
    };
    async function show({ fresh = false } = {}) {
      const root = shell();
      if (!root) return;
      root.querySelectorAll('[data-uw-pane-btn]').forEach((b) => {
        const on = b.dataset.uwPaneBtn === st.active;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      root.querySelectorAll('[data-uw-pane]').forEach((p) => { p.hidden = p.dataset.uwPane !== st.active; });
      if (fresh || !st.painted.has(st.active)) {
        st.painted.add(st.active);
        await panes.find((p) => p[0] === st.active)?.[2]?.();
      }
    }
    /** The pane the next render opens (exact links) — without rendering now. */
    show.prefer = (key) => {
      if (panes.some((p) => p[0] === key)) st.active = key;
    };
    show.select = (key, opts = {}) => {
      st.active = key;
      if (opts.fresh) st.painted.delete(key);
      return show(opts);
    };
    return show;
  }

  /** Where a page renders: its pane inside page tabs, or the tab itself. */
  const host = (tab, kind = 'legacy') => doc.querySelector(`#tab-${tab} [data-uw-${kind}]`) || doc.getElementById(`tab-${tab}`);

  /** The team sentence every page adds to its insights when team accounts were left out. */
  function teamInsight(data, what) {
    if (data.includeTeam || !data.team?.accounts) return null;
    return ['muted', `გუნდის ${fmt(data.team.accounts)} ანგარიში${what ? ` (${what})` : ''} აქ არ ითვლება — მათ შორის App Review-ს დემო. „გუნდის ჩათვლით“ მათაც აჩვენებს.`];
  }

  const hoursText = (h) => {
    if (h == null) return '—';
    if (h < 1) return `${Math.max(1, Math.round(h * 60))} წთ`;
    if (h < 48) return `${Math.round(h)} სთ`;
    return `${Math.round(h / 24)} დღე`;
  };

  global.AdminUsage = {
    esc, ico, fmt, num, pct, share, when, initials, userHref, hoursText, glyphs,
    metric, metrics, empty, note, h4, card, facts, split, warn, extras, shares, chips,
    insights, teamInsight, ladder, track, legend, itemCard, createWall, chart, periodTitle, flagCallout, definitions, page,
    hostTabs, host,
  };
})(window);
