/**
 * MediCard Admin V4 — #/email ელფოსტა (/api/admin/email).
 *   მიმოხილვა   delivery counts, trend, opt-in, Resend/webhook configured (booleans only), kill switch
 *   შაბლონები   enable switches + editor with live preview (real layout, sample values) and test send
 *   კამპანიები  marketing campaigns to opted-in people: compose, preview, test, queue, progress, cancel
 *   ჟურნალი     EmailLog with masked addresses only
 * Emails never carry health data; logs never hold a full address.
 */
(function adminV4Email(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const pct = (n) => (n == null ? '—' : `${Number(n).toLocaleString('ka-GE', { maximumFractionDigits: 1 })}%`);
  const when = (iso) => (iso ? (typeof global.fmtDate === 'function' ? global.fmtDate(iso) : new Date(iso).toLocaleString('ka-GE')) : '—');
  const api = (path, opts) => global.api(`/email${path}`, opts);
  const toast = (m, k) => global.toast?.(m, k);
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const failHtml = (err) => `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;

  const SUBS = [['overview', 'მიმოხილვა'], ['templates', 'შაბლონები'], ['campaigns', 'კამპანიები'], ['log', 'ჟურნალი']];
  const SEGMENTS = {
    ALL_OPTED_IN: 'ყველა თანხმობით', ACTIVE_30D: 'აქტიური · 30 დღე',
    GOAL_MEDICATIONS: 'კარი: წამლები', GOAL_NUTRITION: 'კარი: კვება და წონა', GOAL_CYCLE: 'კარი: ციკლი', GOAL_GENERAL: 'კარი: ზოგადი',
    PLATFORM_IOS: 'iPhone', PLATFORM_ANDROID: 'Android',
  };
  const CAMPAIGN_STATUS = { draft: ['მონახაზი', 'is-plain'], queued: ['რიგში', 'is-accent'], sending: ['იგზავნება', 'is-accent'], sent: ['გაგზავნილია', 'is-ok'], failed: ['ვერ გაიგზავნა', 'is-bad'], cancelled: ['გაუქმდა', 'is-warn'] };
  const LOG_STATUS = {
    queued: ['რიგში', 'is-plain'], sent: ['გაიგზავნა', 'is-accent'], delayed: ['დაგვიანება', 'is-warn'], delivered: ['მიწოდებულია', 'is-ok'],
    opened: ['გახსნილია', 'is-ok'], clicked: ['დაკლიკებულია', 'is-ok'], bounced: ['დაბრუნდა', 'is-bad'], complained: ['საჩივარი', 'is-bad'],
    failed: ['შეცდომა', 'is-bad'], suppressed: ['დაბლოკილი მისამართი', 'is-warn'],
  };
  const TEMPLATE_NAMES = { welcome: 'მისალმება', password_reset: 'პაროლის აღდგენა', account_deleted: 'ანგარიშის წაშლა', campaign: 'კამპანია' };
  const FIELDS = [
    ['subject', 'სათაური (Subject)', 'input', 200],
    ['preheader', 'წინასიტყვა (ჩანს Inbox-ში სათაურის გვერდით)', 'input', 250],
    ['heading', 'სათაური წერილში', 'input', 200],
    ['body', 'ტექსტი', 'textarea', 8000],
    ['ctaLabel', 'ღილაკის ტექსტი (ცარიელი = ღილაკის გარეშე)', 'input', 60],
    ['ctaUrl', 'ღილაკის ბმული (https://…)', 'input', 500],
  ];
  // Glyphs this module needs that admin.js does not ship (same 24px stroke family).
  if (typeof ICONS === 'object') {
    if (!ICONS.edit) ICONS.edit = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
    if (!ICONS.plus) ICONS.plus = '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';
  }
  const badge = (map, key) => { const [label, tone] = map[key] || [key, 'is-plain']; return `<span class="s-badge ${tone}">${esc(label)}</span>`; };

  const st = { sub: 'overview', days: 30, editTemplate: null, editCampaign: null, log: { offset: 0 }, poll: null };

  function subFromHash() {
    const params = typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || '');
    const want = params.get('tab');
    return SUBS.some(([k]) => k === want) ? want : null;
  }
  function writeSub(sub) {
    const params = typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || '');
    params.set('tab', sub);
    const next = `#/email?${params.toString()}`;
    if (location.hash !== next) history.replaceState({ tab: 'email' }, '', next);
  }
  function stopPoll() { if (st.poll) { clearTimeout(st.poll); st.poll = null; } }

  /* ═════════ Shell ═════════ */
  async function renderEmailAdmin() {
    const root = $('tab-email');
    if (!root) return;
    st.sub = subFromHash() || st.sub || 'overview';
    root.innerHTML = `<div class="s-stack v3-tab-shell">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="ელფოსტის განყოფილებები">${SUBS.map(([k, l]) => `<button type="button" role="tab" data-email-sub="${k}" aria-selected="${k === st.sub}" class="${k === st.sub ? 'is-active' : ''}">${l}</button>`).join('')}</div>
        <button type="button" class="btn ghost compact" data-email-refresh>${ico('refresh')} განახლება</button>
      </div>
      <div id="email-pane"></div>
    </div>`;
    root.querySelectorAll('[data-email-sub]').forEach((btn) => btn.addEventListener('click', () => {
      st.sub = btn.dataset.emailSub;
      st.editTemplate = null;
      st.editCampaign = null;
      writeSub(st.sub);
      root.querySelectorAll('[data-email-sub]').forEach((b) => { const on = b === btn; b.setAttribute('aria-selected', String(on)); b.classList.toggle('is-active', on); });
      void paintSub();
    }));
    root.querySelector('[data-email-refresh]').onclick = () => void paintSub();
    await paintSub();
  }

  async function paintSub() {
    stopPoll();
    const pane = $('email-pane');
    if (!pane) return;
    pane.innerHTML = skel();
    const run = { overview: paintOverview, templates: paintTemplates, campaigns: paintCampaigns, log: paintLog }[st.sub] || paintOverview;
    try {
      await run(pane);
    } catch (err) {
      pane.innerHTML = failHtml(err);
      pane.querySelector('[data-retry]').onclick = () => void paintSub();
    }
  }

  /* ═════════ მიმოხილვა ═════════ */
  async function paintOverview(pane) {
    const d = await api(`/overview?days=${st.days}`);
    const t = d.totals || {};
    const rate = (n) => (t.sent ? pct((n / t.sent) * 100) : '—');
    const chart = global.AdminCharts?.line
      ? global.AdminCharts.line([
        { label: 'გაგზავნილი', tone: 'teal', points: d.trend?.sent || [] },
        { label: 'მიწოდებული', tone: 'blue', points: d.trend?.delivered || [] },
        { label: 'შეცდომა / დაბრუნება', tone: 'red', points: d.trend?.failed || [] },
      ], { label: 'დღიური ტრენდი', height: 220, empty: 'ამ პერიოდში წერილი არ გაგზავნილა' })
      : '';
    const yes = (ok, label) => `<span class="s-badge ${ok ? 'is-ok' : 'is-bad'}">${ok ? 'კი' : 'არა'}</span> <span>${esc(label)}</span>`;
    pane.innerHTML = `<div class="s-stack">
      ${d.installed === false ? `<div class="s-callout is-warn">${ico('alert')}<p><b>ელფოსტის ცხრილები ჯერ არ არის დაყენებული.</b> ისინი შეიქმნება შემდეგი დეპლოისას (release → install-email). მანამდე წერილები იგზავნება, მაგრამ ჟურნალი და შაბლონების რედაქტირება არ მუშაობს.</p></div>` : ''}
      ${!d.enabled ? `<div class="s-callout is-warn">${ico('alert')}<p><b>ელფოსტა გამორთულია.</b> არცერთი წერილი არ იგზავნება — პაროლის აღდგენაც კი. ჩართე ქვემოთ.</p></div>` : ''}
      ${!d.config?.resendConfigured ? `<div class="s-callout is-warn">${ico('alert')}<p><b>RESEND_API_KEY არ არის დაყენებული.</b> წერილები არ იგზავნება (პაროლის კოდი მხოლოდ სერვერის ლოგში ჩანს). დაამატე Render-ის env-ში.</p></div>` : ''}
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="პერიოდი">${[7, 30].map((p) => `<button type="button" role="tab" aria-selected="${p === st.days}" data-days="${p}">${p} დღე</button>`).join('')}</div>
      </div>
      <div class="s-metrics">
        <div class="s-metric"><span>გაგზავნილი</span><strong>${fmt(t.sent)}</strong><small>Resend-მა მიიღო · ${d.days} დღე</small></div>
        <div class="s-metric"><span>მიწოდებული</span><strong>${rate(t.delivered)}</strong><small>${fmt(t.delivered)} წერილი</small></div>
        <div class="s-metric"><span>დაბრუნებული</span><strong>${fmt(t.bounced)}</strong><small>${rate(t.bounced)} · საჩივარი ${fmt(t.complained)}</small></div>
        <div class="s-metric"><span>შეცდომა</span><strong>${fmt(t.failed)}</strong><small>დაბლოკილ მისამართზე გამოტოვდა: ${fmt(t.suppressed)}</small></div>
        <div class="s-metric"><span>თანხმობა სიახლეებზე</span><strong>${fmt(d.optIn?.optedIn)}</strong><small>${pct(d.optIn?.rate)} · ${fmt(d.optIn?.reachable)} ელფოსტიანი ანგარიშიდან</small></div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>დღიური ტრენდი</h3><p>„მიწოდებული“ და „დაბრუნება“ ჩანს მხოლოდ მაშინ, როცა Resend-ის webhook მორგებულია.</p></div></header>
        <div class="s-card-body">${chart}</div>
      </section>
      <section class="s-card">
        <header class="s-card-head"><div><h3>მდგომარეობა</h3><p>გასაღებები აქ არასდროს ჩანს — მხოლოდ ის, დაყენებულია თუ არა.</p></div></header>
        <div class="s-card-body is-flush">
          <div class="s-switch-row"><div><b>ელფოსტა ჩართულია</b><small>გამორთვა აჩერებს ყველა წერილს დაუყოვნებლივ (≤15 წამი), პაროლის აღდგენის ჩათვლით. იწერება აუდიტში.</small></div>
            <input class="s-switch" type="checkbox" role="switch" aria-label="ელფოსტა ჩართულია" ${d.enabled ? 'checked' : ''} data-kill></div>
          <div class="s-switch-row"><div><b>Resend API გასაღები</b><small>${yes(d.config?.resendConfigured, 'RESEND_API_KEY')}</small></div></div>
          <div class="s-switch-row"><div><b>Webhook (მიწოდება, bounce, საჩივარი)</b><small>${yes(d.config?.webhookConfigured, 'RESEND_WEBHOOK_SECRET')} · https://medicard.ge/api/email/webhook</small></div></div>
          <div class="s-switch-row"><div><b>გამგზავნი</b><small>${esc(d.config?.from || '—')} · პასუხი: ${esc(d.config?.replyTo || '—')}</small></div></div>
          <div class="s-switch-row"><div><b>დაბლოკილი მისამართები</b><small>${fmt(d.suppressions)} — hard bounce ან „სპამი“. მათზე არაფერი იგზავნება, სერვისული წერილებიც არა.</small></div>
            <button type="button" class="btn compact" data-suppress>${ico('search')} მისამართის შემოწმება</button></div>
        </div>
      </section>
      <div class="s-callout">${ico('shield')}<p>ჟურნალი ინახავს მხოლოდ დაშიფრულ (sha256) და დაფარულ მისამართს (მაგ. g***@gmail.com), არა წერილის ტექსტს ან კოდს. ${fmt(d.retentionDays)} დღეზე ძველი ჩანაწერები ავტომატურად იშლება. წერილებში ჯანმრთელობის მონაცემი არასდროს იგზავნება.</p></div>
    </div>`;
    pane.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { st.days = Number(b.dataset.days) || 30; void paintSub(); }));
    const kill = pane.querySelector('[data-kill]');
    kill.addEventListener('change', () => {
      const enabled = kill.checked;
      kill.checked = !enabled;
      const save = async () => {
        await global.api('/manage/features/email', { method: 'PUT', body: { enabled } });
        toast(enabled ? 'ელფოსტა ჩაირთო' : 'ელფოსტა გამოირთო', enabled ? 'ok' : 'warn');
        await paintSub();
      };
      if (enabled) { void save().catch((e) => toast(e.message, 'bad')); return; }
      V().openConfirm?.({ title: 'ყველა წერილის შეჩერება?', message: 'შეჩერდება მისალმება, პაროლის აღდგენა, ანგარიშის წაშლის დადასტურება და კამპანიები. პაროლის აღდგენისას ადამიანი შეცდომას ნახავს.', confirmLabel: 'შეჩერება', variant: 'danger', onConfirm: save });
    });
    pane.querySelector('[data-suppress]').onclick = openSuppressionDialog;
  }

  function openSuppressionDialog() {
    const dlg = V().openDialog?.({
      title: 'მისამართის შემოწმება',
      description: 'მოწმდება, არის თუ არა მისამართი დაბლოკილი bounce-ის ან საჩივრის გამო. მისამართი არსად ინახება.',
      body: `<div class="s-stack"><label class="s-field"><span>ელფოსტა</span><input type="email" id="email-sup-to" autocomplete="off" placeholder="name@example.com"></label><p class="s-form-msg" id="email-sup-msg" role="status"></p></div>`,
      footer: `<button type="button" class="btn secondary" id="email-sup-check">შემოწმება</button><button type="button" class="btn danger" id="email-sup-remove" disabled>ბლოკის მოხსნა</button>`,
      watchDirty: false,
    });
    const input = $('email-sup-to');
    const msg = $('email-sup-msg');
    const removeBtn = $('email-sup-remove');
    input?.focus();
    $('email-sup-check').onclick = async () => {
      try {
        const r = await api('/suppressions/check', { method: 'POST', body: { to: input.value } });
        msg.style.color = '';
        msg.textContent = r.suppressed ? `დაბლოკილია (${r.reason === 'complaint' ? 'საჩივარი' : 'hard bounce'}) · ${when(r.since)}` : 'არ არის დაბლოკილი.';
        removeBtn.disabled = !r.suppressed;
      } catch (e) { msg.textContent = e.message; }
    };
    removeBtn.onclick = async () => {
      try {
        const r = await api('/suppressions/remove', { method: 'POST', body: { to: input.value } });
        toast(r.removed ? 'ბლოკი მოიხსნა' : 'მისამართი დაბლოკილი არ იყო', 'ok');
        dlg?.close();
      } catch (e) { msg.textContent = e.message; }
    };
  }

  /* ═════════ Editor (shared by templates and campaigns) ═════════ */
  function editorForm(values, vars) {
    return `<div class="s-stack">${FIELDS.map(([key, label, kind, max]) => `<label class="s-field"><span>${label}</span>${kind === 'textarea'
      ? `<textarea class="is-code" data-field="${key}" maxlength="${max}" rows="14">${esc(values[key] || '')}</textarea><small>აბზაცი — ცარიელი ხაზი. **მუქი**, სია „- “-ით, ბმული [ტექსტი](https://…).${vars.includes('code') ? ' {{code}} ცალკე აბზაცად = კოდის ყუთი.' : ''}</small>`
      : `<input type="text" data-field="${key}" maxlength="${max}" value="${esc(values[key] || '')}">`}</label>`).join('')}
      <div class="s-field"><span>ცვლადები (დააკლიკე — ჩაისმება კურსორთან)</span><div class="s-chips">${vars.map((v) => `<button type="button" class="s-badge is-plain s-var-chip" data-var="${esc(v)}">{{${esc(v)}}}</button>`).join('')}</div>
        <small>მხოლოდ ეს ცვლადებია დაშვებული. ჯანმრთელობის მონაცემი წერილში არასდროს იწერება.</small></div>
      <p class="s-form-msg" data-vars-msg role="status"></p>
    </div>`;
  }

  const previewPane = () => `<div class="s-preview">
    <div class="s-preview-meta"><b data-pv-subject>…</b><span data-pv-pre></span></div>
    <div class="s-segment" role="tablist" aria-label="ხედი"><button type="button" role="tab" aria-selected="true" data-pv-mode="html">HTML</button><button type="button" role="tab" aria-selected="false" data-pv-mode="text">ტექსტური ვერსია</button></div>
    <iframe class="s-preview-frame" title="წერილის გადახედვა" sandbox="" data-pv-frame></iframe>
    <pre class="s-preview-text" data-pv-text hidden></pre>
  </div>`;

  function readFields(scope) {
    return Object.fromEntries([...scope.querySelectorAll('[data-field]')].map((el) => [el.dataset.field, el.value]));
  }

  /** Wires chips, debounced live preview and the HTML/text toggle. */
  function wireEditor(scope, previewPath, extraBody = () => ({})) {
    let lastFocus = scope.querySelector('[data-field="body"]');
    scope.querySelectorAll('[data-field]').forEach((el) => el.addEventListener('focus', () => { lastFocus = el; }));
    scope.querySelectorAll('[data-var]').forEach((chip) => chip.addEventListener('click', () => {
      const el = lastFocus;
      if (!el) return;
      const token = `{{${chip.dataset.var}}}`;
      const s = el.selectionStart ?? el.value.length;
      el.value = el.value.slice(0, s) + token + el.value.slice(el.selectionEnd ?? s);
      el.focus();
      el.selectionStart = el.selectionEnd = s + token.length;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    const frame = scope.querySelector('[data-pv-frame]');
    const text = scope.querySelector('[data-pv-text]');
    scope.querySelectorAll('[data-pv-mode]').forEach((b) => b.addEventListener('click', () => {
      scope.querySelectorAll('[data-pv-mode]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      const html = b.dataset.pvMode === 'html';
      frame.hidden = !html;
      text.hidden = html;
    }));
    let timer = null;
    let seq = 0;
    const refresh = async () => {
      const mine = (seq += 1);
      try {
        const r = await api(previewPath, { method: 'POST', body: { ...readFields(scope), ...extraBody() } });
        if (mine !== seq) return;
        frame.srcdoc = r.html;
        text.textContent = r.text;
        scope.querySelector('[data-pv-subject]').textContent = r.subject || '(სათაური ცარიელია)';
        scope.querySelector('[data-pv-pre]').textContent = r.preheader || '';
        const msg = scope.querySelector('[data-vars-msg]');
        const parts = [];
        if (r.vars?.unknown?.length) parts.push(`უცნობი ცვლადი: ${r.vars.unknown.map((v) => `{{${v}}}`).join(', ')}`);
        if (r.vars?.missing?.length) parts.push(`აუცილებელი ცვლადი აკლია: ${r.vars.missing.map((v) => `{{${v}}}`).join(', ')}`);
        msg.textContent = parts.join(' · ');
        scope.dispatchEvent(new CustomEvent('email-preview', { detail: r }));
      } catch (e) {
        scope.querySelector('[data-vars-msg]').textContent = e.message;
      }
    };
    scope.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 350); });
    scope.addEventListener('change', () => { clearTimeout(timer); timer = setTimeout(refresh, 150); });
    void refresh();
    return refresh;
  }

  function openTestDialog(send) {
    const dlg = V().openDialog?.({
      title: 'ტესტის გაგზავნა',
      description: 'წერილი წავა ამ მისამართზე სანიმუშო მნიშვნელობებით და სათაურით „[ტესტი]“. კოდი და სახელი — სანიმუშო.',
      body: `<div class="s-stack"><label class="s-field"><span>ელფოსტა</span><input type="email" id="email-test-to" autocomplete="email" placeholder="name@example.com"></label><p class="s-form-msg" id="email-test-msg" role="status"></p></div>`,
      footer: `<button type="button" class="btn secondary" id="email-test-cancel">გაუქმება</button><button type="button" class="btn primary" id="email-test-send">${ico('send')} გაგზავნა</button>`,
      watchDirty: false,
    });
    const input = $('email-test-to');
    try { input.value = localStorage.getItem('medicard.admin.emailTestTo') || ''; } catch { /* private mode */ }
    input.focus();
    $('email-test-cancel').onclick = () => dlg?.close();
    $('email-test-send').onclick = async () => {
      const btn = $('email-test-send');
      btn.disabled = true;
      btn.classList.add('is-loading');
      try {
        await send(input.value.trim());
        try { localStorage.setItem('medicard.admin.emailTestTo', input.value.trim()); } catch { /* ignore */ }
        toast('ტესტი გაიგზავნა', 'ok');
        dlg?.close();
      } catch (e) {
        $('email-test-msg').textContent = e.message;
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
  }

  /* ═════════ შაბლონები ═════════ */
  async function paintTemplates(pane) {
    if (st.editTemplate) return paintTemplateEditor(pane, st.editTemplate);
    const d = await api('/templates');
    const list = d.templates || [];
    pane.innerHTML = `<div class="s-stack">
      <section class="s-card">
        <header class="s-card-head"><div><h3>სისტემური წერილები</h3><p>ყოველი წერილი იგზავნება რეალური მოვლენით. გამორთული შაბლონი არ იგზავნება; ტექსტის შეცვლა მოქმედებს ≤30 წამში. შეცვლილი შაბლონი ყოველთვის შეიძლება დააბრუნო ნაგულისხმევზე.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>წერილი</th><th>როდის იგზავნება</th><th>ტიპი</th><th>ბოლო ცვლილება</th><th>ჩართული</th><th></th></tr></thead>
          <tbody>${list.map((t) => `<tr data-tpl="${esc(t.key)}">
            <td><b>${esc(t.name)}</b><div class="s-muted" style="font-size:12px">${esc(t.key)}${t.overridden ? ' · <span class="s-badge is-accent is-plain">შეცვლილია</span>' : ''}</div></td>
            <td class="s-muted">${esc(t.trigger || '')}</td>
            <td>${t.category === 'marketing' ? '<span class="s-badge is-warn">მარკეტინგი</span>' : '<span class="s-badge is-plain">სერვისული</span>'}</td>
            <td class="s-muted">${t.updatedAt ? `${esc(t.updatedBy || 'ადმინი')} · ${esc(when(t.updatedAt))}` : '—'}</td>
            <td><input class="s-switch" type="checkbox" role="switch" aria-label="${esc(t.name)} ჩართულია" ${t.enabled ? 'checked' : ''} data-toggle></td>
            <td class="num"><button type="button" class="btn compact" data-edit>${ico('edit')} რედაქტირება</button></td>
          </tr>`).join('')}</tbody></table></div></div>
      </section>
      <div class="s-callout">${ico('info')}<p>„მისალმება“ იგზავნება ერთხელ ანგარიშზე, მხოლოდ ელფოსტით რეგისტრაციისას (ტელეფონით შექმნილ ანგარიშს ელფოსტა არ აქვს). „ანგარიშის წაშლა“ — წაშლის დასრულების შემდეგ. სერვისულ წერილებს თანხმობა არ სჭირდება; მარკეტინგულს — სჭირდება.</p></div>
    </div>`;
    pane.querySelectorAll('[data-tpl]').forEach((row) => {
      const key = row.dataset.tpl;
      const t = list.find((x) => x.key === key);
      row.querySelector('[data-edit]').onclick = () => { st.editTemplate = key; void paintSub(); };
      const toggle = row.querySelector('[data-toggle]');
      toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        toggle.checked = !enabled;
        const save = async () => {
          await api(`/templates/${encodeURIComponent(key)}`, { method: 'PUT', body: { enabled } });
          toast(enabled ? 'შაბლონი ჩაირთო' : 'შაბლონი გამოირთო', enabled ? 'ok' : 'warn');
          await paintSub();
        };
        if (enabled) { void save().catch((e) => toast(e.message, 'bad')); return; }
        V().openConfirm?.({
          title: `${t.name} — გამორთვა?`,
          message: key === 'password_reset' ? 'პაროლის აღდგენა შეწყვეტს მუშაობას: ადამიანი შეცდომას ნახავს და კოდს ვერ მიიღებს.' : 'ეს წერილი აღარ გაიგზავნება, სანამ ხელახლა არ ჩართავ.',
          confirmLabel: 'გამორთვა',
          variant: 'danger',
          onConfirm: save,
        });
      });
    });
  }

  async function paintTemplateEditor(pane, key) {
    const d = await api('/templates');
    const t = (d.templates || []).find((x) => x.key === key);
    if (!t) { st.editTemplate = null; return paintTemplates(pane); }
    pane.innerHTML = `<div class="s-stack">
      <div class="s-toolbar">
        <button type="button" class="btn ghost compact" data-back>${ico('chevronLeft')} შაბლონები</button>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn compact" data-reset ${t.overridden ? '' : 'disabled'}>ნაგულისხმევზე დაბრუნება</button>
          <button type="button" class="btn compact" data-test>${ico('send')} ტესტის გაგზავნა</button>
          <button type="button" class="btn primary compact" data-save>შენახვა</button>
        </div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>${esc(t.name)} <span class="s-muted" style="font-weight:400">· ${esc(t.key)}</span></h3><p>${esc(t.trigger || '')} გადახედვა იყენებს ნამდვილ დიზაინს და სანიმუშო მნიშვნელობებს (სახელი: ნინო).</p></div></header>
        <div class="s-card-body"><div class="s-split" data-editor>${editorForm(t, t.vars || [])}${previewPane()}</div></div>
      </section>
    </div>`;
    const scope = pane.querySelector('[data-editor]');
    wireEditor(scope, `/templates/${encodeURIComponent(key)}/preview`);
    pane.querySelector('[data-back]').onclick = () => { st.editTemplate = null; void paintSub(); };
    pane.querySelector('[data-save]').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.classList.add('is-loading');
      try {
        await api(`/templates/${encodeURIComponent(key)}`, { method: 'PUT', body: readFields(scope) });
        V().setDirty?.(false);
        toast('შაბლონი შენახულია', 'ok');
        await paintSub();
      } catch (err) {
        toast(err.message, 'bad');
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
    pane.querySelector('[data-reset]').onclick = () => V().openConfirm?.({
      title: 'ნაგულისხმევ ტექსტზე დაბრუნება?',
      message: 'შენი ცვლილებები წაიშლება და დაბრუნდება კოდში ჩაწერილი ტექსტი. ჩართვა/გამორთვა არ იცვლება.',
      confirmLabel: 'დაბრუნება',
      variant: 'warning',
      onConfirm: async () => { await api(`/templates/${encodeURIComponent(key)}/reset`, { method: 'POST' }); toast('დაბრუნდა ნაგულისხმევზე', 'ok'); await paintSub(); },
    });
    pane.querySelector('[data-test]').onclick = () => openTestDialog((to) => api(`/templates/${encodeURIComponent(key)}/test`, { method: 'POST', body: { to, fields: readFields(scope) } }));
  }

  /* ═════════ კამპანიები ═════════ */
  async function paintCampaigns(pane) {
    if (st.editCampaign) return paintCampaignEditor(pane, st.editCampaign);
    const [d, overview] = await Promise.all([api('/campaigns'), api('/overview?days=7').catch(() => null)]);
    const list = d.campaigns || [];
    const active = list.some((c) => c.status === 'queued' || c.status === 'sending');
    pane.innerHTML = `<div class="s-stack">
      <div class="s-callout">${ico('shield')}<p>კამპანია მიდის <b>მხოლოდ</b> მათთან, ვინც აპში ჩართო „სიახლეები და რჩევები ელფოსტით“ (კანონი 3144 — წინასწარი თანხმობა), არ არის დაბლოკილი და მისი მისამართი არ დაბრუნებულა. ყოველ წერილს აქვს ერთი დაკლიკებით გამოწერის გაუქმება. თანხმობით ახლა: <b>${fmt(overview?.optIn?.optedIn)}</b>.</p></div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>კამპანიები</h3><p>გაგზავნა მიდის ფონურად, 100 წერილი ერთ მოთხოვნაში, ~1.5 მოთხოვნა/წამში. სერვერის გადატვირთვისას გრძელდება იქიდან, სადაც გაჩერდა; არავის მიუვა ორჯერ.</p></div>
          <button type="button" class="btn primary compact" data-new>${ico('plus')} ახალი კამპანია</button></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>სათაური</th><th>სეგმენტი</th><th>სტატუსი</th><th>პროგრესი</th><th>შექმნა</th><th></th></tr></thead>
          <tbody>${list.length ? list.map((c) => {
            const done = c.sentCount + c.failedCount;
            const w = c.targetCount ? Math.min(100, Math.round((done / c.targetCount) * 100)) : 0;
            return `<tr data-camp="${esc(c.id)}">
              <td><b>${esc(c.subject)}</b></td>
              <td>${esc(SEGMENTS[c.segment] || c.segment)}</td>
              <td>${badge(CAMPAIGN_STATUS, c.status)}</td>
              <td style="min-width:180px">${c.status === 'draft' ? '<span class="s-muted">—</span>' : `<div class="s-meter" role="img" aria-label="${w}%"><i style="width:${w}%"></i></div><small class="s-muted">${fmt(c.sentCount)} / ${fmt(c.targetCount)}${c.failedCount ? ` · შეცდომა ${fmt(c.failedCount)}` : ''}${c.skipped ? ` · გამოტოვდა ${fmt(c.skipped)}` : ''}</small>`}</td>
              <td class="s-muted">${esc(when(c.createdAt))}</td>
              <td class="num">${c.status === 'draft' ? `<button type="button" class="btn compact" data-open>${ico('edit')} გახსნა</button>` : ''}
                ${['queued', 'sending', 'draft'].includes(c.status) ? `<button type="button" class="btn compact danger" data-cancel>გაუქმება</button>` : ''}
                ${!['draft'].includes(c.status) ? '<button type="button" class="btn compact ghost" data-logs>ჟურნალი</button>' : ''}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="6"><div class="s-empty">კამპანია ჯერ არ შექმნილა.</div></td></tr>'}</tbody></table></div></div>
      </section>
    </div>`;
    pane.querySelector('[data-new]').onclick = () => { st.editCampaign = 'new'; void paintSub(); };
    pane.querySelectorAll('[data-camp]').forEach((row) => {
      const id = row.dataset.camp;
      const c = list.find((x) => x.id === id);
      const open = row.querySelector('[data-open]');
      if (open) open.onclick = () => { st.editCampaign = id; void paintSub(); };
      const cancel = row.querySelector('[data-cancel]');
      if (cancel) cancel.onclick = () => V().openConfirm?.({
        title: 'კამპანიის გაუქმება?',
        message: c.status === 'draft' ? 'მონახაზი გაუქმდება.' : `უკვე გაგზავნილი ${fmt(c.sentCount)} წერილი ვერ დაბრუნდება; დანარჩენები აღარ გაიგზავნება.`,
        confirmLabel: 'გაუქმება',
        variant: 'danger',
        onConfirm: async () => { await api(`/campaigns/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); toast('კამპანია გაუქმდა', 'warn'); await paintSub(); },
      });
      const logs = row.querySelector('[data-logs]');
      if (logs) logs.onclick = () => { st.sub = 'log'; st.log = { offset: 0, campaignId: id }; writeSub('log'); void renderEmailAdmin(); };
    });
    // Live progress while something is sending (no skeleton flash; stops when the tab is left).
    if (active) {
      st.poll = setTimeout(() => {
        st.poll = null;
        const visible = !$('tab-email')?.classList.contains('hidden');
        if (visible && st.sub === 'campaigns' && !st.editCampaign && $('email-pane') === pane) void paintCampaigns(pane).catch(() => null);
      }, 4000);
    }
  }

  async function paintCampaignEditor(pane, id) {
    const [segs, existing] = await Promise.all([
      api('/segments').catch(() => ({ segments: Object.keys(SEGMENTS), counts: {} })),
      id === 'new' ? Promise.resolve(null) : api(`/campaigns/${encodeURIComponent(id)}`).then((r) => r.campaign),
    ]);
    const c = existing || { subject: '', preheader: '', heading: 'გამარჯობა, {{name}}!', body: '', ctaLabel: 'გახსენი მედიქარდი', ctaUrl: '{{appUrl}}', segment: 'ALL_OPTED_IN' };
    const counts = segs.counts || {};
    pane.innerHTML = `<div class="s-stack">
      <div class="s-toolbar">
        <button type="button" class="btn ghost compact" data-back>${ico('chevronLeft')} კამპანიები</button>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn compact" data-test>${ico('send')} ტესტის გაგზავნა</button>
          <button type="button" class="btn compact" data-save>მონახაზად შენახვა</button>
          <button type="button" class="btn primary compact" data-queue>${ico('send')} გაგზავნა…</button>
        </div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>${existing ? 'კამპანიის რედაქტირება' : 'ახალი კამპანია'}</h3><p>მარკეტინგული წერილი — მხოლოდ თანხმობით გამოწერილებს. დაწერე მოკლედ, შენობით. ჯანმრთელობის მონაცემი, დიაგნოზი ან პერსონალური რჩევა წერილში არ უნდა იყოს.</p></div></header>
        <div class="s-card-body">
          <label class="s-field" style="max-width:420px"><span>მიმღებები</span><select data-segment>${(segs.segments || Object.keys(SEGMENTS)).map((s) => `<option value="${esc(s)}" ${s === c.segment ? 'selected' : ''}>${esc(SEGMENTS[s] || s)} · ${fmt(counts[s] ?? 0)}</option>`).join('')}</select><small>რიცხვი — თანხმობით გამოწერილი, აქტიური და დაუბლოკავი მისამართები.</small></label>
        </div>
        <div class="s-card-body"><div class="s-split" data-editor>${editorForm(c, ['name', 'appUrl', 'supportEmail'])}${previewPane()}</div></div>
      </section>
    </div>`;
    const scope = pane.querySelector('[data-editor]');
    const segSel = pane.querySelector('[data-segment]');
    const body = () => ({ ...readFields(scope), segment: segSel.value });
    wireEditor(scope, '/campaigns/preview', () => ({ segment: segSel.value }));
    segSel.addEventListener('change', () => scope.dispatchEvent(new Event('change')));
    let currentId = existing?.id || null;
    const save = async () => {
      const r = currentId
        ? await api(`/campaigns/${encodeURIComponent(currentId)}`, { method: 'PUT', body: body() })
        : await api('/campaigns', { method: 'POST', body: body() });
      currentId = r.campaign.id;
      st.editCampaign = currentId;
      V().setDirty?.(false);
      return r.campaign;
    };
    pane.querySelector('[data-back]').onclick = () => { st.editCampaign = null; void paintSub(); };
    pane.querySelector('[data-save]').onclick = async () => { try { await save(); toast('მონახაზი შენახულია', 'ok'); } catch (e) { toast(e.message, 'bad'); } };
    pane.querySelector('[data-test]').onclick = () => openTestDialog((to) => api('/campaigns/test', { method: 'POST', body: { to, fields: body() } }));
    pane.querySelector('[data-queue]').onclick = async () => {
      let saved;
      try { saved = await save(); } catch (e) { toast(e.message, 'bad'); return; }
      const n = counts[segSel.value];
      V().openConfirm?.({
        title: 'კამპანიის გაგზავნა?',
        message: `„${saved.subject}“ — ${SEGMENTS[saved.segment] || saved.segment}: დაახლოებით ${fmt(n)} ადამიანი. გაგზავნის დაწყების შემდეგ უკვე გაგზავნილს ვერ დააბრუნებ (გაუქმება აჩერებს დარჩენილს).`,
        confirmLabel: 'გაგზავნა',
        variant: 'warning',
        onConfirm: async () => {
          await api(`/campaigns/${encodeURIComponent(saved.id)}/queue`, { method: 'POST' });
          toast('კამპანია რიგშია — იგზავნება ფონურად', 'ok');
          st.editCampaign = null;
          await paintSub();
        },
      });
    };
  }

  /* ═════════ ჟურნალი ═════════ */
  async function paintLog(pane) {
    const f = st.log;
    const q = new URLSearchParams({ offset: String(f.offset || 0), limit: '50' });
    for (const k of ['template', 'status', 'from', 'to', 'userId', 'campaignId']) if (f[k]) q.set(k, f[k]);
    const d = await api(`/logs?${q}`);
    const logs = d.logs || [];
    const off = f.offset || 0;
    pane.innerHTML = `<div class="s-stack">
      <section class="s-card">
        <header class="s-card-head"><div><h3>ჟურნალი</h3><p>ყოველი მცდელობა. მისამართი დაფარულია; სრული მისამართი და ტექსტი არ ინახება. სტატუსი ახლდება webhook-ით (მიწოდება, გახსნა, დაბრუნება).</p></div></header>
        <div class="s-card-body"><form class="s-form-grid" data-filter>
          <label class="s-field"><span>წერილი</span><select name="template"><option value="">ყველა</option>${Object.entries(TEMPLATE_NAMES).map(([k, l]) => `<option value="${k}" ${f.template === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="s-field"><span>სტატუსი</span><select name="status"><option value="">ყველა</option>${Object.entries(LOG_STATUS).map(([k, [l]]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="s-field"><span>დან</span><input type="date" name="from" value="${esc(f.from || '')}"></label>
          <label class="s-field"><span>მდე</span><input type="date" name="to" value="${esc(f.to || '')}"></label>
          <label class="s-field"><span>მომხმარებლის ID</span><input type="text" name="userId" value="${esc(f.userId || '')}" placeholder="uuid"></label>
        </form>${f.campaignId ? `<p class="s-muted" style="margin:10px 0 0">ფილტრი: კამპანია ${esc(f.campaignId.slice(0, 8))}… <button type="button" class="btn compact ghost" data-clear-campaign>მოხსნა</button></p>` : ''}</div>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>დრო</th><th>მიმღები</th><th>წერილი</th><th>სტატუსი</th><th>სათაური</th><th>შენიშვნა</th><th>მომხმარებელი</th></tr></thead>
          <tbody>${logs.length ? logs.map((l) => `<tr>
            <td class="s-muted" style="white-space:nowrap">${esc(when(l.createdAt))}</td>
            <td><code>${esc(l.toMasked)}</code></td>
            <td>${esc(TEMPLATE_NAMES[l.templateKey] || l.templateKey)}</td>
            <td>${badge(LOG_STATUS, l.status)}</td>
            <td>${esc(l.subject)}</td>
            <td class="s-muted" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(l.error || '')}">${esc(l.error || '')}</td>
            <td>${l.userId ? `<a href="#/users/${encodeURIComponent(l.userId)}">${esc(l.userId.slice(0, 8))}…</a>` : '<span class="s-muted">—</span>'}</td>
          </tr>`).join('') : '<tr><td colspan="7"><div class="s-empty">ჩანაწერი არ მოიძებნა.</div></td></tr>'}</tbody></table></div>
          <div class="s-pager"><span>${fmt(d.total ? off + 1 : 0)}–${fmt(Math.min(off + logs.length, d.total))} / ${fmt(d.total)}</span>
            <div><button type="button" class="btn compact" data-prev ${off ? '' : 'disabled'}>წინა</button><button type="button" class="btn compact" data-next ${off + logs.length < d.total ? '' : 'disabled'}>შემდეგი</button></div></div>
        </div>
      </section>
    </div>`;
    const form = pane.querySelector('[data-filter]');
    form.addEventListener('change', () => {
      const data = Object.fromEntries(new FormData(form).entries());
      st.log = { ...data, campaignId: st.log.campaignId, offset: 0 };
      void paintSub();
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    pane.querySelector('[data-clear-campaign]')?.addEventListener('click', () => { st.log = { ...st.log, campaignId: '', offset: 0 }; void paintSub(); });
    pane.querySelector('[data-prev]').onclick = () => { st.log.offset = Math.max(0, off - 50); void paintSub(); };
    pane.querySelector('[data-next]').onclick = () => { st.log.offset = off + 50; void paintSub(); };
  }

  global.renderEmailAdmin = renderEmailAdmin;
  global.AdminV4Email = { renderEmailAdmin };
})(window);
