/**
 * MediCard Admin V4 — management modules backed by /api/admin/manage:
 *   #/features  მოდულები — kill switches with a user-facing message
 *   #/quests    MEDIQUEST — template targets, rewards, priority, on/off
 *   user profile cards — Medi Coins balance + grant/revoke, quests, AI consent, data export
 */
(function adminV4Manage(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const when = (iso) => (iso ? (V().formatDate ? V().formatDate(iso, 'datetime') : typeof global.fmtDate === 'function' ? global.fmtDate(iso) : String(iso)) : '—');
  const api = (path, opts) => global.api(`/manage${path}`, opts);
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const fail = (root, err, retry) => {
    root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
    root.querySelector('[data-retry]').onclick = retry;
  };

  /* ═════════ მოდულები (kill switches) ═════════ */
  // Display sections by what people use (the server `group` stays as is). A child always sits under its parent;
  // a key missing here falls back by its server group, so a new switch never disappears.
  const FEATURE_SECTIONS = [
    ['health', 'ჯანმრთელობის ბარათი', 'წამლები, ვიზიტები, ჩანაწერები და ანალიზები. შეჩერებისას ტელეფონზე უკვე დაყენებული შეხსენებები გრძელდება.', ['medications', 'visits', 'records', 'labs']],
    ['daily', 'ყოველდღიური აღრიცხვა', 'წყალი, ნაბიჯები, წონა, კვება და ციკლი.', ['hydration', 'steps', 'weight', 'nutrition', 'cycle']],
    ['medi', 'Medi და AI', 'Medi-ს შეჩერება მის ყველა ხელსაწყოს აჩერებს; თითოეული ცალკეც ითიშება.', ['medi']],
    ['play', 'მოძრაობა და ჯილდოები', 'MEDIRUN, მისიები, ჯილდოები და მეგობრის მოწვევა.', ['medirun', 'medirunDecor', 'medirunPartners', 'quest', 'invites']],
    ['more', 'სხვა სივრცეები', 'ცალკე მიმართულებები და დამატებითი გვერდები.', ['pets', 'coach', 'community', 'pharmacy', 'news', 'homeLayouts', 'weather', 'weeklyReport', 'healthPassport']],
    ['system', 'ფონური სისტემები', 'ეკრანის გარეშე მომუშავე პროცესები.', ['email']],
  ];
  const FALLBACK_SECTION = { module: 'more', ai: 'medi', system: 'system' };
  // Switches that have a twin elsewhere in the admin.
  const RELATED = {
    nutritionAi: 'იგივე შეფასებას აჩერებს <a href="#/nutrition">კვების დღიური</a> → „AI კალორიის შეფასება“ — შეფასება მუშაობს, როცა ორივე ჩართულია.',
    email: 'იგივე გადამრთველი ჩანს <a href="#/email">ელფოსტის</a> გვერდზეც.',
  };
  // Kept across re-renders (a toggle re-renders the page).
  const featureView = { q: '', onlyOff: false };

  async function renderFeatures() {
    const root = $('tab-features');
    if (!root) return;
    if (!root.querySelector('[data-flag]')) root.innerHTML = skel();
    let data;
    try { data = await api('/features'); } catch (err) { fail(root, err, renderFeatures); return; }
    const list = data.features || [];
    const byKey = new Map(list.map((f) => [f.key, f]));
    const labelOf = (key) => byKey.get(key)?.label || key;
    const off = list.filter((f) => !f.enabled);
    const paused = list.filter((f) => f.effective === false);
    const isTop = (f) => !f.parent || !byKey.has(f.parent);
    const listed = new Set(FEATURE_SECTIONS.flatMap(([, , , keys]) => keys));
    const topsOf = ([id, , , keys]) => [
      ...keys.map((k) => byKey.get(k)).filter((f) => f && isTop(f)),
      ...list.filter((f) => isTop(f) && !listed.has(f.key) && (FALLBACK_SECTION[f.group] || 'more') === id),
    ];
    const flagRow = (f, nested) => `
          <div class="s-flag${f.effective === false ? ' is-off' : ''}${nested ? ' is-child' : ''}" data-flag="${esc(f.key)}"${nested ? ` data-parent="${esc(f.parent)}"` : ''}>
            <div class="s-flag-main">
              <div class="s-flag-title"><b>${esc(f.label)}</b>${!f.enabled
                ? '<span class="s-badge is-bad">შეჩერებულია</span>'
                : f.blockedBy ? `<span class="s-badge is-warn">შეჩერებულია „${esc(labelOf(f.blockedBy))}“-ით</span>` : '<span class="s-badge is-ok">ჩართულია</span>'}</div>
              <p>${esc(f.description)}</p>
              ${RELATED[f.key] ? `<p class="s-flag-rel">${ico('link')}<span>${RELATED[f.key]}</span></p>` : ''}
              <small data-updated>${f.updatedAt ? `ბოლოს შეცვალა ${esc(f.updatedBy || 'ადმინი')} · ${esc(when(f.updatedAt))}` : ''}</small>
              <details class="s-flag-more"${f.enabled ? '' : ' open'}>
                <summary>${ico('message')}<span>შეტყობინება ადამიანისთვის</span></summary>
                <div class="s-flag-msg">
                  <label class="s-field"><span>ჩანს აპში, როცა გამორთულია</span>
                    <input type="text" maxlength="240" value="${esc(f.message)}" data-msg></label>
                  <button type="button" class="btn compact" data-msg-save disabled>შენახვა</button>
                  <small class="s-flag-dirty" data-msg-state aria-live="polite"></small>
                </div>
              </details>
            </div>
            <input class="s-switch" type="checkbox" role="switch" aria-label="${esc(f.label)}" ${f.enabled ? 'checked' : ''} data-toggle>
          </div>`;
    // Board: a parent with its child switches takes a full row; the rest pair up in two columns on wide
    // screens (a single one waits for the next single, so no cell is left empty; a last single goes wide).
    const sectionRows = (section) => {
      const cells = [];
      let single = null;
      for (const p of topsOf(section)) {
        const kids = list.filter((c) => c.parent === p.key);
        if (kids.length) {
          cells.push({ p, kids, wide: true });
        } else if (single) {
          cells.splice(cells.indexOf(single) + 1, 0, { p, kids, wide: false });
          single = null;
        } else {
          single = { p, kids, wide: false };
          cells.push(single);
        }
      }
      if (single) single.wide = true;
      return cells.map(({ p, kids, wide }) => `<div class="s-flag-group${wide ? ' is-wide' : ''}">${flagRow(p, false)}${kids.length
        ? `<div class="s-flag-kids">${kids.map((c) => flagRow(c, true)).join('')}</div>` : ''}</div>`).join('');
    };
    root.innerHTML = `<div class="s-stack v3-tab-shell s-flags">
      ${off.length ? `<div class="s-callout is-warn">${ico('alert')}<p><b>შეჩერებულია: ${off.map((f) => `<a href="#/features" data-jump="${esc(f.key)}">${esc(f.label)}</a>`).join(', ')}.</b> ადამიანები ხედავენ შენს შეტყობინებას; ისტორია და სხვა ფუნქციები მუშაობს.</p></div>` : ''}
      <div class="s-toolbar s-flags-tools">
        <label class="sx-search">${ico('search')}<span class="sr-only">მოდულის ძებნა</span><input type="search" placeholder="მოძებნე: ვიზიტები, Medi, წყალი…" value="${esc(featureView.q)}" data-flag-q autocomplete="off"></label>
        <div class="s-segment" role="tablist" aria-label="ჩვენება">
          <button type="button" role="tab" aria-selected="${!featureView.onlyOff}" data-only-off="0">ყველა <i>${list.length}</i></button>
          <button type="button" role="tab" aria-selected="${featureView.onlyOff}" data-only-off="1">შეჩერებული <i${paused.length ? ' class="is-hot"' : ''}>${paused.length}</i></button>
        </div>
      </div>
      <p class="s-flags-note">${ico('info')}<span>ცვლილება მოქმედებს 15 წამში, ბილდისა და დეპლოის გარეშე: ძველ ვერსიაშიც ჩერდება ჩაწერა და ჩანს შენი შეტყობინება, ახალ ვერსიაში მოდული იმალება. ყოველი ცვლილება იწერება აუდიტში.</span></p>
      ${FEATURE_SECTIONS.map((section) => {
        const [id, title, note] = section;
        const rows = sectionRows(section);
        if (!rows) return '';
        return `<section class="s-card" data-flag-section="${esc(id)}">
        <header class="s-card-head"><div><h3>${esc(title)}</h3><p>${esc(note)}</p></div></header>
        <div class="s-card-body is-flush s-flag-board">${rows}</div>
      </section>`;
      }).join('')}
      <div class="s-card" data-flag-none hidden><div class="s-empty">${ico('search')}<strong>ვერაფერი მოიძებნა</strong><span>სცადე სხვა სიტყვა ან აირჩიე „ყველა“.</span></div></div>
    </div>`;

    // Search + „შეჩერებული“: a parent stays visible while one of its children matches.
    const applyView = () => {
      const q = featureView.q.trim().toLowerCase();
      const own = (f) => (!featureView.onlyOff || f.effective === false)
        && (!q || `${f.label} ${f.description} ${f.key}`.toLowerCase().includes(q));
      const show = (f) => own(f) || list.some((c) => c.parent === f.key && own(c));
      let any = false;
      root.querySelectorAll('[data-flag-section]').forEach((section) => {
        let count = 0;
        section.querySelectorAll('.s-flag-group').forEach((group) => {
          let rows = 0;
          group.querySelectorAll('[data-flag]').forEach((row) => {
            const f = byKey.get(row.dataset.flag);
            const visibleRow = Boolean(f) && (row.dataset.parent ? own(f) : show(f));
            row.hidden = !visibleRow;
            if (visibleRow) rows += 1;
          });
          group.hidden = rows === 0;
          count += rows;
        });
        section.hidden = count === 0;
        if (count) any = true;
      });
      // While filtering the results read as one list (two columns would leave holes).
      root.querySelector('.s-flags').classList.toggle('is-filtered', Boolean(q) || featureView.onlyOff);
      root.querySelector('[data-flag-none]').hidden = any;
    };
    const qInput = root.querySelector('[data-flag-q]');
    qInput.addEventListener('input', () => { featureView.q = qInput.value; applyView(); });
    root.querySelectorAll('[data-only-off]').forEach((btn) => btn.addEventListener('click', () => {
      featureView.onlyOff = btn.dataset.onlyOff === '1';
      root.querySelectorAll('[data-only-off]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      applyView();
    }));
    root.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      featureView.q = '';
      qInput.value = '';
      applyView();
      const row = root.querySelector(`[data-flag="${CSS.escape(a.dataset.jump)}"]`);
      if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.remove('is-flash');
      void row.offsetWidth;
      row.classList.add('is-flash');
    }));
    applyView();

    root.querySelectorAll('[data-flag]').forEach((row) => {
      const key = row.dataset.flag;
      const toggle = row.querySelector('[data-toggle]');
      const msg = row.querySelector('[data-msg]');
      const msgSave = row.querySelector('[data-msg-save]');
      const msgState = row.querySelector('[data-msg-state]');
      let savedMsg = msg.value;
      const save = async (enabled) => {
        await api(`/features/${encodeURIComponent(key)}`, { method: 'PUT', body: { enabled, message: msg.value } });
        global.toast?.(enabled ? 'მოდული ჩაირთო' : 'მოდული შეჩერდა', enabled ? 'ok' : 'warn');
        await renderFeatures();
      };
      toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        toggle.checked = !enabled;
        if (enabled) { void save(true).catch((e) => global.toast?.(e.message, 'bad')); return; }
        V().openConfirm?.({
          title: `${row.querySelector('b').textContent} — შეჩერება?`,
          message: `ადამიანები ნახავენ: „${msg.value}“.${(() => {
            const kids = list.filter((f) => f.parent === key).map((f) => f.label);
            return kids.length ? ` ასევე შეჩერდება: ${kids.join(', ')}.` : '';
          })()} შეგიძლია ნებისმიერ დროს ხელახლა ჩართო.`,
          confirmLabel: 'შეჩერება',
          variant: 'danger',
          onConfirm: () => save(false),
        });
      });
      const syncMsg = () => {
        const dirty = msg.value !== savedMsg;
        msgSave.disabled = !dirty;
        msgSave.classList.toggle('primary', dirty);
        msgState.textContent = dirty ? 'შეუნახავი ცვლილება' : '';
        row.classList.toggle('is-dirty', dirty);
      };
      msg.addEventListener('input', syncMsg);
      msg.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || msgSave.disabled) return;
        e.preventDefault();
        msgSave.click();
      });
      msgSave.onclick = async () => {
        msgSave.disabled = true;
        msgSave.classList.add('is-loading');
        try {
          const res = await api(`/features/${encodeURIComponent(key)}`, { method: 'PUT', body: { enabled: toggle.checked, message: msg.value } });
          savedMsg = msg.value;
          const f = res?.feature;
          if (f?.updatedAt) row.querySelector('[data-updated]').textContent = `ბოლოს შეცვალა ${f.updatedBy || 'ადმინი'} · ${when(f.updatedAt)}`;
          global.toast?.('შეტყობინება შენახულია', 'ok');
        } catch (e) {
          global.toast?.(e.message, 'bad');
        } finally {
          msgSave.classList.remove('is-loading');
          syncMsg();
        }
      };
    });
  }

  /* ═════════ MEDIQUEST ═════════ */
  const CADENCE = { DAILY: 'დღიური', WEEKLY: 'კვირის', EVENT: 'ღონისძიება' };
  const UNIT = { STEPS: 'ნაბიჯი', HYDRATION_GOAL_PERCENT: '% წყლის მიზნიდან', MEDI_DAILY_USE: 'საუბარი', COUNT: 'ჯერ' };

  async function renderQuests() {
    const root = $('tab-quests');
    if (!root) return;
    root.innerHTML = skel();
    let data;
    try { data = await api('/quests/templates'); } catch (err) { fail(root, err, renderQuests); return; }
    const t = data.templates || [];
    const daily = t.filter((q) => q.isActive && q.cadence === 'DAILY').reduce((s, q) => s + q.rewardCoins, 0);
    const weekly = t.filter((q) => q.isActive && q.cadence === 'WEEKLY').reduce((s, q) => s + q.rewardCoins, 0);
    const assigned = t.reduce((s, q) => s + q.stats7d.assigned, 0);
    const completed = t.reduce((s, q) => s + q.stats7d.completed, 0);
    const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
    root.innerHTML = `<div class="s-stack v3-tab-shell s-quests">
      <div class="s-metrics">
        <div class="s-metric"><span>აქტიური მისია</span><strong>${t.filter((q) => q.isActive).length} / ${t.length}</strong><small>ჩართული შაბლონი</small></div>
        <div class="s-metric"><span>მაქს. Medi Coins დღეში</span><strong>${fmt(daily)}</strong><small>ყველა დღიური მისიით</small></div>
        <div class="s-metric"><span>იდეალური კვირა</span><strong>${fmt(daily * 7 + weekly)}</strong><small>Coins, ყველა მისიის შესრულებით</small></div>
        <div class="s-metric"><span>შესრულება · 7 დღე</span><strong>${pct(completed, assigned)}%</strong><small>${fmt(completed)} / ${fmt(assigned)} მისია</small></div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>მისიების შაბლონები</h3>
          <p>სამიზნე, ჯილდო და რიგი მოქმედებს ახლად მინიჭებულ მისიებზე. ლიმიტი: დღიური ≤250, კვირის ≤1000 Coins და XP.</p></div></header>
        <div class="s-card-body is-flush s-quest-body"><div class="s-table-wrap"><table class="s-table is-edit s-quest-table">
          <thead><tr><th>მისია</th><th>სიხშირე</th><th class="num">სამიზნე</th><th class="num">ჯილდო · Coins</th><th class="num">ჯილდო · XP</th><th class="num">რიგი</th><th class="num">შესრულება · 7 დღე</th><th>აქტიური</th><th></th></tr></thead>
          <tbody>${t.map((q) => `<tr data-quest="${esc(q.key)}">
            <td><b title="${esc(q.key)}">${esc(q.label)}</b><small class="s-quest-meta">${q.adminManaged ? '<span class="s-badge is-accent is-plain">ადმინის მართვაში</span>' : ''}${q.updatedAt ? `<span>შეიცვალა ${esc(when(q.updatedAt))}</span>` : ''}</small></td>
            <td>${esc(CADENCE[q.cadence] || 'სხვა')}</td>
            <td class="num"><input type="number" min="1" data-f="defaultTarget" value="${q.defaultTarget}" aria-label="სამიზნე"><small class="s-quest-meta">${esc(UNIT[q.progressType] || '')}</small></td>
            <td class="num"><input type="number" min="0" data-f="rewardCoins" value="${q.rewardCoins}" aria-label="ჯილდო Coins"></td>
            <td class="num"><input type="number" min="0" data-f="rewardXp" value="${q.rewardXp}" aria-label="ჯილდო XP"></td>
            <td class="num"><input type="number" min="0" data-f="priority" value="${q.priority}" aria-label="რიგი"></td>
            <td class="num"><b>${pct(q.stats7d.completed, q.stats7d.assigned)}%</b><small class="s-quest-meta">${fmt(q.stats7d.completed)} / ${fmt(q.stats7d.assigned)}</small></td>
            <td><input class="s-switch" type="checkbox" role="switch" data-f="isActive" ${q.isActive ? 'checked' : ''} aria-label="აქტიური"></td>
            <td class="num"><button type="button" class="btn compact" data-save disabled>შენახვა</button></td>
          </tr>`).join('')}</tbody></table></div></div>
        <footer class="s-card-foot"><span class="s-foot-note">Medi Coins-ს ფულადი ღირებულება არ აქვს. ჯილდოს შემცირება უკვე მიღებულ Coins-ს არ ცვლის; გამორთვა ახალ მინიჭებას აჩერებს.</span></footer>
      </section>
    </div>`;
    root.querySelectorAll('[data-quest]').forEach((row) => {
      const btn = row.querySelector('[data-save]');
      const read = () => Object.fromEntries([...row.querySelectorAll('[data-f]')].map((el) => [el.dataset.f, el.type === 'checkbox' ? el.checked : Number(el.value)]));
      const initial = JSON.stringify(read());
      const sync = () => {
        const dirty = JSON.stringify(read()) !== initial;
        btn.disabled = !dirty;
        btn.classList.toggle('primary', dirty);
        row.classList.toggle('is-dirty', dirty);
      };
      row.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('input', sync));
      row.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('change', sync));
      btn.onclick = async () => {
        btn.disabled = true;
        btn.classList.add('is-loading');
        try {
          await api(`/quests/templates/${encodeURIComponent(row.dataset.quest)}`, { method: 'PATCH', body: read() });
          global.toast?.('მისია შენახულია', 'ok');
          await renderQuests();
        } catch (e) {
          global.toast?.(e.message || 'ვერ შეინახა', 'bad');
          btn.disabled = false;
        } finally { btn.classList.remove('is-loading'); }
      };
    });
  }

  /* ═════════ User profile: coins, quests, consent, export ═════════ */
  const DECISION = { accepted: ['მიცემული', 'is-ok'], declined: ['უარი', 'is-warn'], revoked: ['გაუქმებული', 'is-bad'] };
  const QUEST_STATUS = { ACTIVE: ['მიმდინარე', 'is-info'], COMPLETED: ['შესრულდა', 'is-ok'], CLAIMED: ['ჯილდო აღებულია', 'is-ok'], EXPIRED: ['ვადა გავიდა', 'is-plain'], CANCELLED: ['გაუქმდა', 'is-plain'] };
  const SOURCE = { QUEST: 'მისია', ACHIEVEMENT: 'მიღწევა', SYSTEM: 'ადმინი / სისტემა', REFERRAL: 'მოწვევა', REWARD_REDEMPTION: 'ჯილდოზე გაცვლა', MEDIRUN: 'MEDIRUN' };
  const shortVer = (v) => { const t = String(v || ''); return t.length > 16 ? `${t.slice(0, 10)}…` : t; };
  /** Quest periods are a Tbilisi day (2026-10-02) or an ISO week (2026-W40). */
  function periodLabel(key) {
    const text = String(key || '');
    const week = /^(\d{4})-W(\d{1,2})$/.exec(text);
    if (week) {
      const n = Number(week[2]);
      return `${n === 1 ? '1-ლი' : `მე-${n}`} კვირა, ${week[1]}`;
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && global.AdminCharts?.dayLabel ? global.AdminCharts.dayLabel(text, true) : text;
  }

  async function mountUserInsights(userId) {
    const host = $('user-insights-host');
    if (!host) return;
    host.innerHTML = `<div class="v3-user-card s-insights"><div class="v3-skel" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
    let d;
    try { d = await api(`/users/${encodeURIComponent(userId)}/insights`); } catch (err) {
      host.innerHTML = `<div class="v3-user-card s-insights"><p class="s-muted">მონაცემები ვერ ჩაიტვირთა: ${esc(err.message)}</p></div>`;
      return;
    }
    if ($('user-insights-host') !== host) return;
    const e = d.economy;
    const consent = d.consent.current;
    const [cLabel, cTone] = consent ? (DECISION[consent.decision] || ['უცნობი', '']) : ['არ აურჩევია', ''];
    host.innerHTML = `
      <div class="v3-user-card s-insights">
        <h3>${ico('gift')} Medi Coins და Quest</h3>
        <div class="s-insight-stats">
          <div><span>ბალანსი</span><strong>${fmt(e.coins)}</strong><small>Coins</small></div>
          <div><span>დონე · XP</span><strong>${fmt(e.level)}</strong><small>${fmt(e.xp)} XP</small></div>
          <div><span>სერია</span><strong>${fmt(e.streak)}</strong><small>მაქს. ${fmt(e.longestStreak)}</small></div>
        </div>
        <div class="s-insight-actions">
          <button type="button" class="btn compact" data-coins="grant">${ico('plus')} დარიცხვა</button>
          <button type="button" class="btn compact danger" data-coins="revoke">ჩამოჭრა</button>
        </div>
        <details class="s-details"><summary>ოპერაციები (${e.ledger.length})</summary><div>
          ${e.ledger.length ? `<ul class="s-ledger">${e.ledger.map((r) => `<li><span class="s-ledger-amt ${r.amount < 0 ? 'is-neg' : ''}">${r.amount > 0 ? '+' : ''}${fmt(r.amount)} ${r.currency === 'XP' ? 'XP' : 'Coins'}</span>
            <span>${esc(SOURCE[r.source] || 'სხვა')}${r.reason ? ` — ${esc(r.reason)}` : ''}<small>${esc(when(r.createdAt))}${r.adminEmail ? ` · ${esc(r.adminEmail)}` : ''}</small></span></li>`).join('')}</ul>` : '<p class="s-muted">ოპერაცია ჯერ არ არის.</p>'}
        </div></details>
        <details class="s-details"><summary>მისიები (${d.quests.length})</summary><div>
          ${d.quests.length ? `<ul class="s-ledger">${d.quests.map((q) => {
            const [label, tone] = QUEST_STATUS[q.status] || ['სხვა', 'is-plain'];
            return `<li><span class="s-badge ${tone}">${esc(label)}</span>
            <span>${esc(q.label)} · ${fmt(q.progress)}/${fmt(q.target)}<small>${esc(periodLabel(q.periodKey))}</small></span></li>`;
          }).join('')}</ul>` : '<p class="s-muted">მისია არ მინიჭებია.</p>'}
        </div></details>
      </div>
      <div class="v3-user-card s-insights">
        <h3>${ico('shield')} AI თანხმობა</h3>
        <p class="s-insight-consent"><span class="s-badge ${cTone}">${esc(cLabel)}</span>${consent ? `<span class="s-muted" title="${esc(consent.version)}">ვერსია ${esc(shortVer(consent.version))} · ${esc(when(consent.updatedAt))}</span>` : ''}</p>
        ${d.consent.events.length ? `<details class="s-details"><summary>ისტორია (${d.consent.events.length})</summary><div><ul class="s-ledger">${d.consent.events.map((ev) => `<li><span class="s-badge ${(DECISION[ev.decision] || [])[1] || ''}">${esc((DECISION[ev.decision] || ['უცნობი'])[0])}</span><span title="${esc(ev.version)}">ვერსია ${esc(shortVer(ev.version))}<small>${esc(when(ev.createdAt))}</small></span></li>`).join('')}</ul></div></details>` : ''}
      </div>
      <div class="v3-user-card s-insights">
        <h3>${ico('download')} მონაცემების ექსპორტი</h3>
        <p class="s-insight-note">ადამიანის მოთხოვნით (წვდომის უფლება) — JSON ფაილი პროფილით, ჯანმრთელობის ჩანაწერებით, თანხმობებითა და ოპერაციებით. ქმედება იწერება აუდიტში.</p>
        <button type="button" class="btn compact" data-export>${ico('download')} JSON ექსპორტი</button>
      </div>`;
    host.querySelectorAll('[data-coins]').forEach((b) => b.addEventListener('click', () => coinsDialog(userId, b.dataset.coins, e.coins)));
    host.querySelector('[data-export]').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.classList.add('is-loading');
      try { await global.opsDownload?.(`/manage/users/${encodeURIComponent(userId)}/export`, `medicard-user-${userId.slice(0, 8)}.json`); } finally { btn.classList.remove('is-loading'); }
    });
  }

  function coinsDialog(userId, mode, balance) {
    const grant = mode === 'grant';
    const dialog = V().openDialog?.({
      title: grant ? 'Medi Coins-ის დარიცხვა' : 'Medi Coins-ის ჩამოჭრა',
      description: `მიმდინარე ბალანსი: ${fmt(balance)} Coins. ოპერაცია ჩაიწერება ადამიანის ისტორიასა და აუდიტში.`,
      body: `<form id="coins-form" class="s-stack s-coins-form" novalidate>
        <label class="s-field"><span>რაოდენობა</span><input type="number" min="1" max="${grant ? 5000 : Math.max(1, balance)}" step="1" name="amount" required placeholder="მაგ. 100"></label>
        <label class="s-field"><span>მიზეზი</span><input type="text" name="reason" minlength="3" maxlength="200" required placeholder="${grant ? 'მაგ. ტექნიკური ხარვეზის კომპენსაცია' : 'მაგ. მოწვევის თაღლითობა'}"></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button>
        <button type="submit" class="btn ${grant ? 'primary' : 'danger'}" form="coins-form">${grant ? 'დარიცხვა' : 'ჩამოჭრა'}</button>`,
    });
    const form = $('coins-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    panel.classList.add('s-coins-dialog');
    if (!grant) panel.classList.add('is-danger');
    form.querySelector('[name=amount]').focus();
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const amount = Math.floor(Number(form.amount.value));
      const reason = form.reason.value.trim();
      const alertEl = panel.querySelector('[role=alert]');
      if (!(amount > 0)) { alertEl.textContent = 'მიუთითე დადებითი რაოდენობა.'; return; }
      if (reason.length < 3) { alertEl.textContent = 'მიზეზი სავალდებულოა.'; return; }
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        const r = await api(`/users/${encodeURIComponent(userId)}/coins`, { method: 'POST', body: { amount: grant ? amount : -amount, reason } });
        V().setDirty?.(false);
        await dialog.close();
        global.toast?.(`ახალი ბალანსი: ${fmt(r.balance)} Coins`, 'ok');
        void mountUserInsights(userId);
      } catch (e) {
        alertEl.textContent = e.message || 'ვერ შესრულდა';
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  global.renderFeatures = renderFeatures;
  global.renderQuests = renderQuests;
  global.AdminV4Manage = { renderFeatures, renderQuests, mountUserInsights };
})(window);
