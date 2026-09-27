/**
 * MediCard Admin V4 — management modules backed by /api/admin/manage:
 *   #/features  მოდულები — kill switches with a user-facing message
 *   #/quests    Medi Quest — template targets, rewards, priority, on/off
 *   user profile card — Medi Coins balance + grant/revoke, quests, AI consent, data export
 */
(function adminV4Manage(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const when = (iso) => (iso ? (typeof global.fmtDate === 'function' ? global.fmtDate(iso) : new Date(iso).toLocaleString('ka-GE')) : '—');
  const api = (path, opts) => global.api(`/manage${path}`, opts);
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const fail = (root, err, retry) => {
    root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
    root.querySelector('[data-retry]').onclick = retry;
  };

  /* ═════════ მოდულები (kill switches) ═════════ */
  async function renderFeatures() {
    const root = $('tab-features');
    if (!root) return;
    root.innerHTML = skel();
    let data;
    try { data = await api('/features'); } catch (err) { fail(root, err, renderFeatures); return; }
    const list = data.features || [];
    const off = list.filter((f) => !f.enabled).length;
    root.innerHTML = `<div class="s-stack v3-tab-shell">
      <div class="s-callout ${off ? 'is-warn' : 'is-ok'}">${ico(off ? 'alert' : 'check')}<p>${off
        ? `<b>${off} მოდული შეჩერებულია.</b> მომხმარებლები ხედავენ ქვემოთ მითითებულ შეტყობინებას; ისტორია და სხვა ფუნქციები მუშაობს.`
        : '<b>ყველა მოდული ჩართულია.</b> გამორთვა გამოიყენე ავარიისას — მაგალითად, AI პროვაიდერის შეფერხების, ხარჯის ზრდის ან ბოროტად გამოყენების დროს.'}</p></div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>მოდულების გადამრთველები</h3>
          <p>გამორთვა მოქმედებს დაუყოვნებლივ (≤15 წამი), დეპლოის გარეშე. იბლოკება მხოლოდ ახალი მოქმედებები — წაკითხვა და ისტორია ხელმისაწვდომი რჩება. ყოველი ცვლილება იწერება აუდიტში.</p></div></header>
        <div class="s-card-body is-flush">${list.map((f) => `
          <div class="s-flag${f.enabled ? '' : ' is-off'}" data-flag="${esc(f.key)}">
            <div class="s-flag-main">
              <div class="s-flag-title"><b>${esc(f.label)}</b>${f.enabled ? '<span class="s-badge is-ok">ჩართულია</span>' : '<span class="s-badge is-bad">შეჩერებულია</span>'}</div>
              <p>${esc(f.description)}</p>
              ${f.updatedAt ? `<small>ბოლოს შეცვალა ${esc(f.updatedBy || 'ადმინი')} · ${esc(when(f.updatedAt))}</small>` : ''}
              <label class="s-field s-flag-msg"><span>შეტყობინება მომხმარებლისთვის, როცა გამორთულია</span>
                <input type="text" maxlength="240" value="${esc(f.message)}" data-msg></label>
            </div>
            <input class="s-switch" type="checkbox" role="switch" aria-label="${esc(f.label)}" ${f.enabled ? 'checked' : ''} data-toggle>
          </div>`).join('')}</div>
      </section>
    </div>`;
    root.querySelectorAll('[data-flag]').forEach((row) => {
      const key = row.dataset.flag;
      const toggle = row.querySelector('[data-toggle]');
      const msg = row.querySelector('[data-msg]');
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
          message: `მომხმარებლები ნახავენ: „${msg.value}“. შეგიძლია ნებისმიერ დროს ხელახლა ჩართო.`,
          confirmLabel: 'შეჩერება',
          variant: 'danger',
          onConfirm: () => save(false),
        });
      });
      msg.addEventListener('change', () => { void api(`/features/${encodeURIComponent(key)}`, { method: 'PUT', body: { enabled: toggle.checked, message: msg.value } }).then(() => global.toast?.('შეტყობინება შენახულია', 'ok')).catch((e) => global.toast?.(e.message, 'bad')); });
    });
  }

  /* ═════════ Medi Quest ═════════ */
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
    root.innerHTML = `<div class="s-stack v3-tab-shell">
      <div class="s-metrics">
        <div class="s-metric"><span>აქტიური მისია</span><strong>${t.filter((q) => q.isActive).length} / ${t.length}</strong></div>
        <div class="s-metric"><span>მაქს. coin დღეში</span><strong>${fmt(daily)}</strong><small>ყველა დღიური მისიით</small></div>
        <div class="s-metric"><span>იდეალური კვირა</span><strong>${fmt(daily * 7 + weekly)}</strong><small>coin</small></div>
        <div class="s-metric"><span>დასრულება · 7 დღე</span><strong>${assigned ? Math.round((completed / assigned) * 100) : 0}%</strong><small>${fmt(completed)} / ${fmt(assigned)} მისია</small></div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>მისიების შაბლონები</h3>
          <p>სამიზნე, ჯილდო და რიგი მოქმედებს ახლად მინიჭებულ მისიებზე (ხვალინდელი დღიური / მომდევნო კვირის). ლიმიტები: დღიური ≤250 coin და ≤250 XP, კვირის ≤1000. შეცვლილი შაბლონი დეპლოიმ აღარ გადაწეროს — ის ადმინის მართვაშია.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table is-edit">
          <thead><tr><th>მისია</th><th>ტიპი</th><th class="num">სამიზნე</th><th class="num">Coin</th><th class="num">XP</th><th class="num">რიგი</th><th>7 დღე</th><th>აქტიური</th><th></th></tr></thead>
          <tbody>${t.map((q) => `<tr data-quest="${esc(q.key)}">
            <td><b>${esc(q.label)}</b><div class="s-muted" style="font-size:12px">${esc(q.key)}${q.adminManaged ? ' · <span class="s-badge is-accent is-plain">ადმინის მართვაში</span>' : ''}</div></td>
            <td>${esc(CADENCE[q.cadence] || q.cadence)}</td>
            <td class="num"><input type="number" min="1" data-f="defaultTarget" value="${q.defaultTarget}" style="width:96px"><div class="s-muted" style="font-size:11.5px">${esc(UNIT[q.progressType] || '')}</div></td>
            <td class="num"><input type="number" min="0" data-f="rewardCoins" value="${q.rewardCoins}" style="width:80px"></td>
            <td class="num"><input type="number" min="0" data-f="rewardXp" value="${q.rewardXp}" style="width:80px"></td>
            <td class="num"><input type="number" min="0" data-f="priority" value="${q.priority}" style="width:70px"></td>
            <td><span class="s-muted" style="font-size:12.5px">${fmt(q.stats7d.completed)} / ${fmt(q.stats7d.assigned)}</span></td>
            <td><input class="s-switch" type="checkbox" role="switch" data-f="isActive" ${q.isActive ? 'checked' : ''} aria-label="აქტიური"></td>
            <td class="num"><button type="button" class="btn compact primary" data-save disabled>შენახვა</button></td>
          </tr>`).join('')}</tbody></table></div></div>
      </section>
      <div class="s-callout">${ico('info')}<p>Medi Coins-ს ფულადი ღირებულება არ აქვს. ჯილდოს შემცირება არ ცვლის უკვე მიღებულ coin-ებს. მისიის გამორთვა ახალ მინიჭებას აჩერებს; მიმდინარე მისია ბოლომდე გრძელდება.</p></div>
    </div>`;
    root.querySelectorAll('[data-quest]').forEach((row) => {
      const btn = row.querySelector('[data-save]');
      const read = () => Object.fromEntries([...row.querySelectorAll('[data-f]')].map((el) => [el.dataset.f, el.type === 'checkbox' ? el.checked : Number(el.value)]));
      const initial = JSON.stringify(read());
      row.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('input', () => { btn.disabled = JSON.stringify(read()) === initial; }));
      row.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('change', () => { btn.disabled = JSON.stringify(read()) === initial; }));
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
  const shortVer = (v) => { const t = String(v || ''); return t.length > 16 ? `${t.slice(0, 10)}…` : t; };
  const SOURCE = { QUEST: 'მისია', ACHIEVEMENT: 'მიღწევა', SYSTEM: 'ადმინი / სისტემა', REFERRAL: 'მოწვევა', REWARD_REDEMPTION: 'ჯილდოზე გაცვლა' };

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
    const [cLabel, cTone] = consent ? (DECISION[consent.decision] || [consent.decision, '']) : ['არ აურჩევია', ''];
    host.innerHTML = `
      <div class="v3-user-card s-insights">
        <h3>${ico('gift')} Medi Coins და Quest</h3>
        <div class="s-insight-stats">
          <div><span>ბალანსი</span><strong>${fmt(e.coins)}</strong></div>
          <div><span>დონე · XP</span><strong>${fmt(e.level)}</strong><small>${fmt(e.xp)} XP</small></div>
          <div><span>სერია</span><strong>${fmt(e.streak)}</strong><small>მაქს. ${fmt(e.longestStreak)}</small></div>
        </div>
        <div class="s-insight-actions">
          <button type="button" class="btn compact" data-coins="grant">${ico('plus')} დარიცხვა</button>
          <button type="button" class="btn compact danger" data-coins="revoke">ჩამოჭრა</button>
        </div>
        <details class="s-details"><summary>ოპერაციები (${e.ledger.length})</summary><div>
          ${e.ledger.length ? `<ul class="s-ledger">${e.ledger.map((r) => `<li><span class="s-ledger-amt ${r.amount < 0 ? 'is-neg' : ''}">${r.amount > 0 ? '+' : ''}${fmt(r.amount)} ${r.currency === 'XP' ? 'XP' : 'coin'}</span>
            <span>${esc(SOURCE[r.source] || r.source)}${r.reason ? ` — ${esc(r.reason)}` : ''}<small>${esc(when(r.createdAt))}${r.adminEmail ? ` · ${esc(r.adminEmail)}` : ''}</small></span></li>`).join('')}</ul>` : '<p class="s-muted">ოპერაცია ჯერ არ არის.</p>'}
        </div></details>
        <details class="s-details"><summary>მისიები (${d.quests.length})</summary><div>
          ${d.quests.length ? `<ul class="s-ledger">${d.quests.map((q) => `<li><span class="s-badge ${q.status === 'CLAIMED' || q.status === 'COMPLETED' ? 'is-ok' : q.status === 'ACTIVE' ? 'is-info' : ''}">${esc(q.status)}</span>
            <span>${esc(q.label)} · ${fmt(q.progress)}/${fmt(q.target)}<small>${esc(q.periodKey)}</small></span></li>`).join('')}</ul>` : '<p class="s-muted">მისია არ მინიჭებია.</p>'}
        </div></details>
      </div>
      <div class="v3-user-card s-insights">
        <h3>${ico('shield')} AI თანხმობა</h3>
        <p class="s-insight-consent"><span class="s-badge ${cTone}">${esc(cLabel)}</span>${consent ? `<span class="s-muted" title="${esc(consent.version)}">ვერსია ${esc(shortVer(consent.version))} · ${esc(when(consent.updatedAt))}</span>` : ''}</p>
        ${d.consent.events.length ? `<details class="s-details"><summary>ისტორია (${d.consent.events.length})</summary><div><ul class="s-ledger">${d.consent.events.map((ev) => `<li><span class="s-badge ${(DECISION[ev.decision] || [])[1] || ''}">${esc((DECISION[ev.decision] || [ev.decision])[0])}</span><span title="${esc(ev.version)}">ვერსია ${esc(shortVer(ev.version))}<small>${esc(when(ev.createdAt))}</small></span></li>`).join('')}</ul></div></details>` : ''}
        <h3 style="margin-top:18px">${ico('download')} მონაცემების ექსპორტი</h3>
        <p class="s-muted" style="margin:4px 0 10px;font-size:12.5px">ადამიანის მოთხოვნით (წვდომის უფლება) — JSON ფაილი პროფილით, ჯანმრთელობის ჩანაწერებით, თანხმობებითა და ოპერაციებით. ქმედება იწერება აუდიტში.</p>
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
      description: `მიმდინარე ბალანსი: ${fmt(balance)} coin. ოპერაცია ჩაიწერება ადამიანის ისტორიასა და აუდიტში.`,
      body: `<form id="coins-form" class="s-stack" style="gap:14px" novalidate>
        <label class="s-field"><span>რაოდენობა</span><input type="number" min="1" max="${grant ? 5000 : Math.max(1, balance)}" step="1" name="amount" required placeholder="მაგ. 100"></label>
        <label class="s-field"><span>მიზეზი</span><input type="text" name="reason" minlength="3" maxlength="200" required placeholder="${grant ? 'მაგ. ტექნიკური ხარვეზის კომპენსაცია' : 'მაგ. მოწვევის თაღლითობა'}"></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert" style="margin-right:auto"></p><button type="button" class="btn" data-cancel>გაუქმება</button>
        <button type="submit" class="btn ${grant ? 'primary' : 'danger'}" form="coins-form">${grant ? 'დარიცხვა' : 'ჩამოჭრა'}</button>`,
    });
    const form = $('coins-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
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
        global.toast?.(`ახალი ბალანსი: ${fmt(r.balance)} coin`, 'ok');
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
