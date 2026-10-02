/**
 * MediCard Admin V4 — #/email ელფოსტა (/api/admin/email).
 *   მიმოხილვა   delivery numbers, trend, setup state (booleans only), kill switch
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
  const pct = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : `${Number(n).toLocaleString('ka-GE', { maximumFractionDigits: 1 })}%`);
  const when = (iso, mode = 'datetime') => {
    if (!iso) return '—';
    return typeof V().formatDate === 'function' ? V().formatDate(iso, mode) : String(iso);
  };
  const api = (path, opts) => global.api(`/email${path}`, opts);
  const toast = (m, k) => global.toast?.(m, k);
  const skel = () => '<div class="p4-skel" aria-busy="true" aria-label="იტვირთება"><i class="is-bar"></i><i class="is-tiles"></i><i class="is-block"></i></div>';
  const failHtml = (err) => `<section class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || 'სცადე ხელახლა.')}</span><button type="button" class="btn" data-retry>${ico('refresh')} ხელახლა ცდა</button></div></section>`;

  const SUBS = [['overview', 'მიმოხილვა'], ['templates', 'შაბლონები'], ['campaigns', 'კამპანიები'], ['log', 'ჟურნალი']];
  const SEGMENTS = {
    ALL_OPTED_IN: 'ყველა, ვინც თანხმობა მისცა', ACTIVE_30D: 'აქტიური ბოლო 30 დღეში',
    GOAL_MEDICATIONS: 'მიზანი: წამლები', GOAL_NUTRITION: 'მიზანი: კვება და წონა', GOAL_CYCLE: 'მიზანი: ციკლი', GOAL_GENERAL: 'მიზანი: ზოგადი ჯანმრთელობა',
    PLATFORM_IOS: 'iPhone', PLATFORM_ANDROID: 'Android',
  };
  const CAMPAIGN_STATUS = { draft: ['მონახაზი', 'is-plain'], queued: ['რიგში', 'is-accent'], sending: ['იგზავნება', 'is-accent'], sent: ['გაგზავნილია', 'is-ok'], failed: ['ვერ გაიგზავნა', 'is-bad'], cancelled: ['გაუქმდა', 'is-warn'] };
  const LOG_STATUS = {
    queued: ['რიგში', 'is-plain'], sent: ['გაიგზავნა', 'is-accent'], delayed: ['დაგვიანება', 'is-warn'], delivered: ['მიწოდებულია', 'is-ok'],
    opened: ['გახსნილია', 'is-ok'], clicked: ['დაკლიკებულია', 'is-ok'], bounced: ['დაბრუნდა', 'is-bad'], complained: ['საჩივარი', 'is-bad'],
    failed: ['შეცდომა', 'is-bad'], suppressed: ['დაბლოკილი მისამართი', 'is-warn'],
  };
  const TEMPLATE_NAMES = {
    welcome: 'მისალმება', password_reset: 'პაროლის აღდგენა', account_deleted: 'ანგარიშის წაშლა',
    support_reply: 'მხარდაჭერის პასუხი', support_notice: 'შეტყობინება ახალ წერილზე', campaign: 'კამპანია',
  };
  /** [field, label, control, max length, hint] */
  const FIELDS = [
    ['subject', 'თემა', 'input', 200, 'ჩანს შემოსულების სიაში.'],
    ['preheader', 'წინასიტყვა', 'input', 250, 'მოკლე ტექსტი, რომელიც შემოსულებში თემის გვერდით ჩანს.'],
    ['heading', 'სათაური წერილში', 'input', 200, ''],
    ['body', 'ტექსტი', 'textarea', 8000, ''],
    ['ctaLabel', 'ღილაკის ტექსტი', 'input', 60, 'ცარიელი — წერილი ღილაკის გარეშე.'],
    ['ctaUrl', 'ღილაკის ბმული', 'input', 500, 'https://… ან {{appUrl}}'],
  ];
  // Glyphs this module needs that admin.js does not ship (same 24px stroke family).
  if (typeof ICONS === 'object') {
    if (!ICONS.edit) ICONS.edit = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
    if (!ICONS.plus) ICONS.plus = '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';
  }
  const badge = (map, key) => { const [label, tone] = map[key] || [key, 'is-plain']; return `<span class="s-badge ${tone}">${esc(label)}</span>`; };
  /** Server trigger copy names API routes in brackets — the owner needs the event, not the route. */
  const plainTrigger = (s) => String(s || '').replace(/\s*\((?:[A-Z]+\s+)?\/[^)]*\)/g, '').replace(/\s+([.,])/g, '$1').trim();
  const isActive = (c) => c.status === 'queued' || c.status === 'sending';
  const tabVisible = () => { const r = $('tab-email'); return Boolean(r) && !r.classList.contains('hidden'); };

  /** EmailLog.error holds provider codes and English bounce text; the raw text stays in the tooltip. */
  function errorLabel(raw, status) {
    const e = String(raw || '').trim();
    if (!e) return '';
    if (e === 'SUPPRESSED') return 'არ გაიგზავნა';
    if (/^RATE_LIMITED|\b429\b/i.test(e)) return 'Resend-ის სიხშირის ლიმიტი';
    if (/^NETWORK|timeout|aborted/i.test(e)) return 'Resend-თან კავშირი ვერ დამყარდა';
    if (/^NOT_CONFIGURED/i.test(e)) return 'Resend-ის გასაღები არ არის';
    if (/^EMAIL_DISABLED/i.test(e)) return 'ელფოსტა გამორთული იყო';
    if (/^TEMPLATE_DISABLED/i.test(e)) return 'ეს წერილი გამორთული იყო';
    if (/Resend 5\d\d/i.test(e)) return 'Resend დროებით მიუწვდომელი იყო';
    if (/does not exist|no such user|unknown user|user unknown|invalid recipient|address rejected/i.test(e)) return 'მისამართი არ არსებობს';
    if (/mailbox (is )?full|over quota|quota exceeded/i.test(e)) return 'საფოსტო ყუთი სავსეა';
    if (/unavailable|disabled|inactive|suspended/i.test(e)) return 'საფოსტო ყუთი მიუწვდომელია';
    if (status === 'bounced') return 'წერილი დაბრუნდა';
    if (status === 'complained') return 'სპამად მონიშნა';
    if (status === 'failed') return 'გაგზავნა ვერ მოხერხდა';
    return 'დეტალი';
  }

  const st = { sub: 'overview', days: 30, editTemplate: null, editCampaign: null, log: { offset: 0 }, poll: null, campaigns: [], optIn: null };

  function hashParams() {
    return typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || '');
  }
  function subFromHash() {
    const want = hashParams().get('tab');
    return SUBS.some(([k]) => k === want) ? want : null;
  }
  function writeSub(sub) {
    const params = hashParams();
    params.set('tab', sub);
    const next = `#/email?${params.toString()}`;
    if (location.hash !== next) history.replaceState({ tab: 'email' }, '', next);
  }
  function daysFromHash() {
    const r = hashParams().get('range');
    return r === '7d' ? 7 : r === '30d' ? 30 : null;
  }
  function writeDays(days) {
    const params = hashParams();
    params.set('range', `${days}d`);
    const next = `#/email?${params.toString()}`;
    if (location.hash !== next) history.replaceState({ tab: 'email' }, '', next);
  }
  function stopPoll() { if (st.poll) { clearTimeout(st.poll); st.poll = null; } }

  /** Unsaved editor text is never dropped silently (Back, a sub-tab, „განახლება“). */
  function guardLeave(proceed) {
    if (!V().dirty || typeof V().confirmLeave !== 'function') { proceed(); return; }
    void V().confirmLeave().then((ok) => { if (ok) proceed(); });
  }

  /* ═════════ Shell ═════════ */
  async function renderEmailAdmin() {
    const root = $('tab-email');
    if (!root) return;
    st.sub = subFromHash() || st.sub || 'overview';
    root.innerHTML = `<div class="s-stack v3-tab-shell em-page">
      <div class="p4-tabs">
        <nav class="v3-subnav" role="tablist" aria-label="ელფოსტის განყოფილებები">${SUBS.map(([k, l]) => `<button type="button" role="tab" class="v3-subnav-btn${k === st.sub ? ' is-active' : ''}" data-email-sub="${k}" aria-selected="${k === st.sub}">${l}</button>`).join('')}</nav>
        <button type="button" class="btn ghost compact" data-email-refresh title="განახლება">${ico('refresh')}<span>განახლება</span></button>
      </div>
      <div id="email-pane"></div>
    </div>`;
    root.querySelectorAll('[data-email-sub]').forEach((btn) => btn.addEventListener('click', () => guardLeave(() => {
      st.sub = btn.dataset.emailSub;
      st.editTemplate = null;
      st.editCampaign = null;
      writeSub(st.sub);
      root.querySelectorAll('[data-email-sub]').forEach((b) => { const on = b === btn; b.setAttribute('aria-selected', String(on)); b.classList.toggle('is-active', on); });
      void paintSub();
    })));
    root.querySelector('[data-email-refresh]').onclick = () => guardLeave(() => void paintSub());
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
  const okBadge = (ok, yes, no, tone = 'is-bad') => `<span class="s-badge ${ok ? 'is-ok' : tone}">${esc(ok ? yes : no)}</span>`;

  /** Support inbox health (booleans and counts only — see /api/admin/support). */
  function inboundRows(h) {
    if (h.installed === false) {
      return `<div class="s-switch-row"><div><b>შემოსული ფოსტა (მხარდაჭერა)</b><small>ჯერ არ არის ჩართული სერვერზე — ჩაირთვება შემდეგი დეპლოისას.</small></div></div>`;
    }
    const readable = h.inboundKeyConfigured || !h.inboundKeyNeeded;
    return `<div class="s-switch-row"><div><b>შემოსული ფოსტა (მხარდაჭერა)</b>
        <small>${okBadge(h.eventsArriving, 'მოდის', 'ბოლო 30 დღეში არაფერი', 'is-warn')}<span>ბოლო: ${esc(h.lastReceivedAt ? when(h.lastReceivedAt) : 'ჯერ არაფერი')} · 7 დღეში ${fmt(h.count7)} · 30 დღეში ${fmt(h.count30)}</span></small></div>
        <a class="btn compact" href="#/support">გახსნა</a></div>
      <div class="s-switch-row"><div><b>შემოსული წერილების ტექსტი</b>
        <small>${okBadge(readable, 'იკითხება', 'ჩანს მხოლოდ სათაური', 'is-warn')}<span>${readable
          ? 'წერილის ტექსტი და მიმაგრებული ფაილები მხარდაჭერის გვერდზე ჩანს.'
          : 'დაამატე Render-ში ცვლადი RESEND_INBOUND_API_KEY (Resend-ის Full access გასაღები).'}</span></small></div></div>`;
  }

  async function paintOverview(pane) {
    st.days = daysFromHash() || st.days;
    const d = await api(`/overview?days=${st.days}`);
    const t = d.totals || {};
    const cfg = d.config || {};
    const share = (n) => (t.sent ? (Number(n || 0) / t.sent) * 100 : null);
    const attempts = Number(t.sent || 0) + Number(t.failed || 0);
    const failShare = attempts ? (Number(t.failed || 0) / attempts) * 100 : 0;
    const bounceShare = share(Number(t.bounced || 0) + Number(t.complained || 0)) || 0;
    const tone = (v, warn, bad) => (v >= bad ? ' is-bad' : v >= warn ? ' is-warn' : '');
    const chart = global.AdminCharts?.line
      ? global.AdminCharts.line([
        { label: 'გაგზავნილი', tone: 'teal', points: d.trend?.sent || [] },
        { label: 'მიწოდებული', tone: 'blue', points: d.trend?.delivered || [] },
        { label: 'შეცდომა / დაბრუნება', tone: 'bad', points: d.trend?.failed || [] },
      ], { label: 'წერილები დღეში', height: 220, empty: 'ამ პერიოდში წერილი არ გაგზავნილა' })
      : '';
    const callouts = [
      d.installed === false && 'ელფოსტის ჟურნალი სერვერზე ჯერ არ არის ჩართული (ჩაირთვება შემდეგი დეპლოისას). წერილები იგზავნება, მაგრამ ჟურნალი და შაბლონების რედაქტირება მანამდე არ მუშაობს.',
      !d.enabled && '<b>ელფოსტა გამორთულია.</b> არცერთი წერილი არ იგზავნება, პაროლის აღდგენაც კი. ჩართე ქვემოთ, „მდგომარეობაში“.',
      !cfg.resendConfigured && '<b>წერილები არ იგზავნება: Resend-ის გასაღები არ არის.</b> დაამატე Render-ში ცვლადი RESEND_API_KEY. მანამდე პაროლის აღდგენის კოდი მხოლოდ სერვერის ლოგში ჩანს.',
    ].filter(Boolean);
    pane.innerHTML = `<div class="s-stack">
      ${callouts.map((c) => `<div class="s-callout is-warn">${ico('alert')}<p>${c}</p></div>`).join('')}
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="პერიოდი">${[7, 30].map((p) => `<button type="button" role="tab" aria-selected="${p === st.days}" data-days="${p}">${p} დღე</button>`).join('')}</div>
      </div>
      <div class="s-metrics">
        <div class="s-metric"><span>გაგზავნილი</span><strong>${fmt(t.sent)}</strong><small>Resend-მა მიიღო · ${fmt(d.days)} დღე</small></div>
        <div class="s-metric"><span>მიწოდებული</span><strong>${pct(share(t.delivered))}</strong><small>${cfg.webhookConfigured === false ? 'მიწოდების სტატუსი არ მოდის' : `${fmt(t.delivered)} წერილი`}</small></div>
        <div class="s-metric${tone(bounceShare, 2, 5)}"><span>დაბრუნებული</span><strong>${fmt(t.bounced)}</strong><small>${pct(share(t.bounced))} · საჩივარი ${fmt(t.complained)}</small></div>
        <div class="s-metric${tone(failShare, 2, 10)}"><span>ვერ გაიგზავნა</span><strong>${fmt(t.failed)}</strong><small>დაბლოკილ მისამართზე გამოტოვდა ${fmt(t.suppressed)}</small></div>
        <div class="s-metric"><span>თანხმობა სიახლეებზე</span><strong>${fmt(d.optIn?.optedIn)}</strong><small>${pct(d.optIn?.rate)} · ${fmt(d.optIn?.reachable)} ანგარიშიდან ელფოსტით</small></div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>წერილები დღეში</h3><p>გაგზავნილი, მიწოდებული და ვერ გაგზავნილი ან დაბრუნებული წერილები.</p></div></header>
        <div class="s-card-body">${chart}</div>
      </section>
      <section class="s-card">
        <header class="s-card-head"><div><h3>მდგომარეობა</h3><p>გასაღებები აქ არასდროს ჩანს — მხოლოდ ის, მუშაობს თუ არა.</p></div></header>
        <div class="s-card-body s-status-rows em-status">
          <div class="s-switch-row"><div><b>ელფოსტა ჩართულია</b><small>გამორთვა 15 წამში აჩერებს ყველა წერილს, პაროლის აღდგენის ჩათვლით. ჩაიწერება აუდიტში.</small></div>
            <input class="s-switch" type="checkbox" role="switch" aria-label="ელფოსტა ჩართულია" ${d.enabled ? 'checked' : ''} data-kill></div>
          <div class="s-switch-row"><div><b>Resend-ის გასაღები</b><small>${okBadge(cfg.resendConfigured, 'დაყენებულია', 'არ არის')}<span>${cfg.resendConfigured ? 'წერილებს Resend აგზავნის.' : 'დაამატე Render-ში ცვლადი RESEND_API_KEY.'}</span></small></div></div>
          <div class="s-switch-row"><div><b>მიწოდების სტატუსები</b><small>${okBadge(cfg.webhookConfigured, 'მოდის', 'არ მოდის', 'is-warn')}<span>${cfg.webhookConfigured
            ? 'Resend გვატყობინებს მიწოდებას, გახსნას, დაბრუნებას და საჩივარს.'
            : 'დაამატე Render-ში ცვლადი RESEND_WEBHOOK_SECRET და Resend-ში მისამართი https://medicard.ge/api/email/webhook.'}</span></small></div></div>
          <div class="s-switch-row"><div><b>გამგზავნი</b><small><span>${esc(cfg.from || '—')} · პასუხები მიდის: ${esc(cfg.replyTo || '—')}</span></small></div></div>
          ${d.inbound ? inboundRows(d.inbound) : ''}
          <div class="s-switch-row"><div><b>დაბლოკილი მისამართები · ${fmt(d.suppressions)}</b><small><span>მისამართი არ არსებობს ან წერილი სპამად მონიშნეს. მათზე აღარაფერი იგზავნება, სერვისული წერილიც.</span></small></div>
            <button type="button" class="btn compact" data-suppress>${ico('search')} მისამართის შემოწმება</button></div>
        </div>
        <footer class="s-card-foot"><span class="s-foot-note">${ico('shield')} ჟურნალში ინახება მხოლოდ დაფარული მისამართი (მაგ. g***@gmail.com), ${fmt(d.retentionDays)} დღე. წერილის ტექსტი და კოდი არ ინახება.</span></footer>
      </section>
    </div>`;
    pane.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { st.days = Number(b.dataset.days) || 30; writeDays(st.days); void paintSub(); }));
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
      description: 'მოწმდება, დაიბლოკა თუ არა მისამართი დაბრუნებული წერილის ან საჩივრის გამო. მისამართი არსად ინახება.',
      body: '<div class="s-stack"><label class="s-field"><span>ელფოსტა</span><input type="email" id="email-sup-to" autocomplete="off" placeholder="name@example.com"></label><p class="s-form-msg" id="email-sup-msg" role="status"></p></div>',
      footer: '<button type="button" class="btn secondary" id="email-sup-check">შემოწმება</button><button type="button" class="btn danger" id="email-sup-remove" disabled>ბლოკის მოხსნა</button>',
      watchDirty: false,
    });
    const input = $('email-sup-to');
    const msg = $('email-sup-msg');
    const removeBtn = $('email-sup-remove');
    const say = (text, ok) => { msg.textContent = text; msg.classList.toggle('is-ok', Boolean(ok)); };
    input?.focus();
    $('email-sup-check').onclick = async () => {
      try {
        const r = await api('/suppressions/check', { method: 'POST', body: { to: input.value } });
        say(r.suppressed ? `დაბლოკილია: ${r.reason === 'complaint' ? 'სპამად მონიშნა' : 'მისამართი არ არსებობს (წერილი დაბრუნდა)'} · ${when(r.since)}` : 'არ არის დაბლოკილი.', !r.suppressed);
        removeBtn.disabled = !r.suppressed;
      } catch (e) { say(e.message); }
    };
    removeBtn.onclick = async () => {
      try {
        const r = await api('/suppressions/remove', { method: 'POST', body: { to: input.value } });
        toast(r.removed ? 'ბლოკი მოიხსნა' : 'მისამართი დაბლოკილი არ იყო', 'ok');
        dlg?.close();
      } catch (e) { say(e.message); }
    };
  }

  /* ═════════ Editor (shared by templates and campaigns) ═════════ */
  function editorForm(values, vars) {
    return `<div class="s-stack em-form">${FIELDS.map(([key, label, kind, max, hint]) => `<label class="s-field"><span>${label}</span>${kind === 'textarea'
      ? `<textarea class="is-code" data-field="${key}" maxlength="${max}" rows="14">${esc(values[key] || '')}</textarea><small>აბზაცი — ცარიელი ხაზი. **მუქი**, სია „- “-ით, ბმული [ტექსტი](https://…).${vars.includes('code') ? ' {{code}} ცალკე აბზაცად — კოდის ყუთი.' : ''}</small>`
      : `<input type="text" data-field="${key}" maxlength="${max}" value="${esc(values[key] || '')}">${hint ? `<small>${esc(hint)}</small>` : ''}`}</label>`).join('')}
      <div class="s-field"><span>ცვლადები</span><div class="s-chips">${vars.map((v) => `<button type="button" class="s-badge is-plain s-var-chip" data-var="${esc(v)}">{{${esc(v)}}}</button>`).join('')}</div>
        <small>დააკლიკე — ჩაისმება კურსორთან. სხვა ცვლადი არ მუშაობს; ჯანმრთელობის მონაცემი წერილში არასდროს იწერება.</small></div>
      <p class="s-form-msg" data-vars-msg role="status"></p>
    </div>`;
  }

  const previewPane = () => `<div class="s-preview em-preview">
    <div class="em-preview-head"><span>გადახედვა · სანიმუშო მნიშვნელობებით</span>
      <div class="s-segment" role="tablist" aria-label="გადახედვის ხედი"><button type="button" role="tab" aria-selected="true" data-pv-mode="html">დიზაინით</button><button type="button" role="tab" aria-selected="false" data-pv-mode="text">ტექსტური ვერსია</button></div></div>
    <div class="s-preview-meta"><b data-pv-subject>…</b><span data-pv-pre></span></div>
    <iframe class="s-preview-frame em-frame" title="წერილის გადახედვა" sandbox="" data-pv-frame></iframe>
    <pre class="s-preview-text em-text" data-pv-text hidden></pre>
  </div>`;

  function readFields(scope) {
    return Object.fromEntries([...scope.querySelectorAll('[data-field]')].map((el) => [el.dataset.field, el.value]));
  }

  /** Wires chips, debounced live preview and the design/text toggle. */
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
        scope.querySelector('[data-pv-subject]').textContent = r.subject || '(თემა ცარიელია)';
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
    // openDialog resets the page's unsaved flag; the editor behind the dialog keeps its edits.
    const editorDirty = Boolean(V().dirty);
    const dlg = V().openDialog?.({
      title: 'ტესტის გაგზავნა',
      description: 'წერილი წავა ამ მისამართზე სანიმუშო მნიშვნელობებით (სახელი, კოდი) და თემით „[ტესტი]“.',
      body: '<div class="s-stack"><label class="s-field"><span>ელფოსტა</span><input type="email" id="email-test-to" autocomplete="email" placeholder="name@example.com"></label><p class="s-form-msg" id="email-test-msg" role="status"></p></div>',
      footer: `<button type="button" class="btn secondary" id="email-test-cancel">გაუქმება</button><button type="button" class="btn primary" id="email-test-send">${ico('send')} გაგზავნა</button>`,
      watchDirty: false,
      onClose: () => { if (editorDirty) V().setDirty?.(true); },
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
    pane.innerHTML = `<section class="s-card">
        <header class="s-card-head"><div><h3>სისტემური წერილები</h3><p>იგზავნება თავისით, მოვლენისას, თანხმობის გარეშე. გამორთული წერილი არ იგზავნება.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table em-table">
          <thead><tr><th>წერილი</th><th>როდის იგზავნება</th><th>ბოლო ცვლილება</th><th>ჩართული</th><th></th></tr></thead>
          <tbody>${list.length ? list.map((t) => `<tr data-tpl="${esc(t.key)}">
            <td><div class="em-name"><b title="${esc(t.key)}">${esc(t.name)}</b>${t.overridden ? '<span class="s-badge is-accent is-plain">შეცვლილია</span>' : ''}${t.category === 'marketing' ? '<span class="s-badge is-warn is-plain">მარკეტინგი</span>' : ''}</div></td>
            <td class="s-muted em-wrap">${esc(plainTrigger(t.trigger))}</td>
            <td>${t.updatedAt ? `<div class="em-when">${esc(when(t.updatedAt))}<small>${esc(t.updatedBy || 'ადმინი')}</small></div>` : '<span class="s-muted">ნაგულისხმევი ტექსტი</span>'}</td>
            <td><input class="s-switch" type="checkbox" role="switch" aria-label="${esc(t.name)} ჩართულია" ${t.enabled ? 'checked' : ''} data-toggle></td>
            <td class="num"><button type="button" class="btn compact" data-edit>${ico('edit')} რედაქტირება</button></td>
          </tr>`).join('') : '<tr><td colspan="5"><div class="s-empty">შაბლონი ვერ მოიძებნა.</div></td></tr>'}</tbody></table></div></div>
      </section>`;
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
    V().setDirty?.(false);
    pane.innerHTML = `<div class="s-stack">
      <div class="s-toolbar">
        <button type="button" class="btn ghost compact" data-back>${ico('chevronLeft')} შაბლონები</button>
        <div class="p4-actions">
          <button type="button" class="btn compact" data-reset ${t.overridden ? '' : 'disabled'}>ნაგულისხმევზე დაბრუნება</button>
          <button type="button" class="btn compact" data-test>${ico('send')} ტესტის გაგზავნა</button>
          <button type="button" class="btn primary compact" data-save>შენახვა</button>
        </div>
      </div>
      <section class="s-card" data-editor-card>
        <header class="s-card-head"><div><h3 title="${esc(t.key)}">${esc(t.name)}</h3><p>${esc(plainTrigger(t.trigger))}</p></div></header>
        <div class="s-card-body"><div class="s-split" data-editor>${editorForm(t, t.vars || [])}${previewPane()}</div></div>
      </section>
    </div>`;
    const scope = pane.querySelector('[data-editor]');
    wireEditor(scope, `/templates/${encodeURIComponent(key)}/preview`);
    V().watchDirty?.(pane.querySelector('[data-editor-card]'));
    pane.querySelector('[data-back]').onclick = () => guardLeave(() => { st.editTemplate = null; void paintSub(); });
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
      onConfirm: async () => { await api(`/templates/${encodeURIComponent(key)}/reset`, { method: 'POST' }); V().setDirty?.(false); toast('დაბრუნდა ნაგულისხმევზე', 'ok'); await paintSub(); },
    });
    pane.querySelector('[data-test]').onclick = () => openTestDialog((to) => api(`/templates/${encodeURIComponent(key)}/test`, { method: 'POST', body: { to, fields: readFields(scope) } }));
  }

  /* ═════════ კამპანიები ═════════ */
  const campaignSig = (c) => [c.status, c.sentCount, c.failedCount, c.skipped, c.targetCount].join('|');

  function progressCell(c) {
    if (c.status === 'draft') return '<span class="s-muted">—</span>';
    const done = Number(c.sentCount || 0) + Number(c.failedCount || 0);
    const w = c.targetCount ? Math.min(100, Math.round((done / c.targetCount) * 100)) : 0;
    const meterTone = c.status === 'failed' ? ' is-bad' : c.status === 'cancelled' ? ' is-warn' : '';
    return `<div class="s-meter${meterTone}" role="img" aria-label="${w}%"><i style="width:${w}%"></i></div>
      <small class="s-muted" data-progress-text>${fmt(c.sentCount)} / ${fmt(c.targetCount)}${c.failedCount ? ` · შეცდომა ${fmt(c.failedCount)}` : ''}${c.skipped ? ` · გამოტოვდა ${fmt(c.skipped)}` : ''}</small>`;
  }
  function actionsCell(c) {
    return `<div class="p4-actions is-end">
      ${c.status === 'draft' ? `<button type="button" class="btn compact" data-open>${ico('edit')} გახსნა</button>` : ''}
      ${['queued', 'sending', 'draft'].includes(c.status) ? '<button type="button" class="btn compact danger" data-cancel>გაუქმება</button>' : ''}
      ${c.status !== 'draft' ? '<button type="button" class="btn compact ghost" data-logs>ჟურნალი</button>' : ''}
    </div>`;
  }
  const campaignCells = (c) => `
    <td><b>${esc(c.subject)}</b></td>
    <td>${esc(SEGMENTS[c.segment] || c.segment)}</td>
    <td data-status-cell>${badge(CAMPAIGN_STATUS, c.status)}</td>
    <td class="em-progress" data-progress-cell>${progressCell(c)}</td>
    <td class="s-muted em-nowrap">${esc(when(c.createdAt))}</td>
    <td class="num">${actionsCell(c)}</td>`;
  const campaignRow = (c) => `<tr data-camp="${esc(c.id)}" data-sig="${esc(campaignSig(c))}">${campaignCells(c)}</tr>`;
  const findCampaign = (id) => st.campaigns.find((x) => x.id === id);

  function bindCampaignRow(row) {
    const id = row.dataset.camp;
    const open = row.querySelector('[data-open]');
    if (open) open.onclick = () => { st.editCampaign = id; void paintSub(); };
    const cancel = row.querySelector('[data-cancel]');
    if (cancel) cancel.onclick = () => {
      const c = findCampaign(id) || {};
      V().openConfirm?.({
        title: 'კამპანიის გაუქმება?',
        message: c.status === 'draft' ? 'მონახაზი გაუქმდება.' : `უკვე გაგზავნილი ${fmt(c.sentCount)} წერილი ვერ დაბრუნდება; დანარჩენები აღარ გაიგზავნება.`,
        confirmLabel: 'გაუქმება',
        variant: 'danger',
        onConfirm: async () => { await api(`/campaigns/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); toast('კამპანია გაუქმდა', 'warn'); await paintSub(); },
      });
    };
    const logs = row.querySelector('[data-logs]');
    if (logs) logs.onclick = () => {
      st.sub = 'log';
      st.log = { offset: 0, campaignId: id, campaignLabel: findCampaign(id)?.subject || '' };
      writeSub('log');
      void renderEmailAdmin();
    };
  }

  /** Live progress while something is queued or sending: only the changed cells are touched. */
  function updateCampaignRows(pane, list) {
    const body = pane.querySelector('[data-camp-body]');
    if (!body) return;
    st.campaigns = list;
    const rows = new Map([...body.querySelectorAll('tr[data-camp]')].map((r) => [r.dataset.camp, r]));
    if (list.length !== rows.size || list.some((c) => !rows.has(c.id))) {
      body.innerHTML = list.map(campaignRow).join('');
      body.querySelectorAll('tr[data-camp]').forEach(bindCampaignRow);
      return;
    }
    list.forEach((c) => {
      const row = rows.get(c.id);
      const sig = campaignSig(c);
      if (row.dataset.sig === sig) return;
      const statusChanged = row.dataset.sig.split('|')[0] !== c.status;
      row.dataset.sig = sig;
      if (statusChanged) {
        row.innerHTML = campaignCells(c);
        bindCampaignRow(row);
        return;
      }
      const meter = row.querySelector('[data-progress-cell] .s-meter');
      const label = row.querySelector('[data-progress-text]');
      if (!meter || !label) { row.querySelector('[data-progress-cell]').innerHTML = progressCell(c); return; }
      const fresh = doc.createElement('div');
      fresh.innerHTML = progressCell(c);
      meter.setAttribute('aria-label', fresh.querySelector('.s-meter').getAttribute('aria-label'));
      meter.querySelector('i').style.width = fresh.querySelector('.s-meter > i').style.width;
      label.textContent = fresh.querySelector('[data-progress-text]').textContent;
    });
  }

  function scheduleCampaignPoll(pane) {
    stopPoll();
    if (!st.campaigns.some(isActive)) return;
    st.poll = setTimeout(async () => {
      st.poll = null;
      if (st.sub !== 'campaigns' || st.editCampaign || $('email-pane') !== pane || !pane.isConnected) return;
      // Hidden tab: no requests, but keep the loop so progress resumes when the owner comes back.
      if (!tabVisible() || doc.hidden) { scheduleCampaignPoll(pane); return; }
      try {
        const d = await api('/campaigns');
        if (st.sub !== 'campaigns' || st.editCampaign || $('email-pane') !== pane) return;
        updateCampaignRows(pane, d.campaigns || []);
      } catch { /* keep the last numbers */ }
      scheduleCampaignPoll(pane);
    }, 4000);
  }

  async function paintCampaigns(pane) {
    if (st.editCampaign) return paintCampaignEditor(pane, st.editCampaign);
    const [d, overview] = await Promise.all([api('/campaigns'), api('/overview?days=7').catch(() => null)]);
    const list = d.campaigns || [];
    st.campaigns = list;
    st.optIn = overview?.optIn?.optedIn ?? null;
    pane.innerHTML = `<section class="s-card">
        <header class="s-card-head"><div><h3>კამპანიები</h3><p>მიდის მხოლოდ მათთან, ვინც სიახლეებზე თანხმობა მისცა — ახლა ${st.optIn == null ? '—' : `<b>${fmt(st.optIn)}</b>`} ადამიანი. გაგზავნილს ვერ დააბრუნებ.</p></div>
          <button type="button" class="btn primary compact" data-new>${ico('plus')} ახალი კამპანია</button></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table em-table">
          <thead><tr><th>თემა</th><th>მიმღებები</th><th>სტატუსი</th><th>პროგრესი</th><th>შექმნა</th><th></th></tr></thead>
          <tbody data-camp-body>${list.length ? list.map(campaignRow).join('') : '<tr><td colspan="6"><div class="s-empty">კამპანია ჯერ არ შექმნილა. „ახალი კამპანია“ — მოამზადე პირველი.</div></td></tr>'}</tbody></table></div></div>
      </section>`;
    pane.querySelector('[data-new]').onclick = () => { st.editCampaign = 'new'; void paintSub(); };
    pane.querySelectorAll('tr[data-camp]').forEach(bindCampaignRow);
    scheduleCampaignPoll(pane);
  }

  async function paintCampaignEditor(pane, id) {
    const [segs, existing] = await Promise.all([
      api('/segments').catch(() => ({ segments: Object.keys(SEGMENTS), counts: {} })),
      id === 'new' ? Promise.resolve(null) : api(`/campaigns/${encodeURIComponent(id)}`).then((r) => r.campaign),
    ]);
    const c = existing || { subject: '', preheader: '', heading: 'გამარჯობა, {{name}}!', body: '', ctaLabel: 'გახსენი მედიქარდი', ctaUrl: '{{appUrl}}', segment: 'ALL_OPTED_IN' };
    const counts = segs.counts || {};
    V().setDirty?.(false);
    pane.innerHTML = `<div class="s-stack">
      <div class="s-toolbar">
        <button type="button" class="btn ghost compact" data-back>${ico('chevronLeft')} კამპანიები</button>
        <div class="p4-actions">
          <button type="button" class="btn compact" data-test>${ico('send')} ტესტის გაგზავნა</button>
          <button type="button" class="btn compact" data-save>მონახაზად შენახვა</button>
          <button type="button" class="btn primary compact" data-queue>${ico('send')} გაგზავნა…</button>
        </div>
      </div>
      <section class="s-card" data-editor-card>
        <header class="s-card-head"><div><h3>${existing ? 'კამპანიის რედაქტირება' : 'ახალი კამპანია'}</h3><p>მარკეტინგული წერილი, მხოლოდ თანხმობით. დაწერე მოკლედ, შენობით; ჯანმრთელობის მონაცემი ან პერსონალური რჩევა არ ჩაწერო.</p></div></header>
        <div class="s-card-body">
          <label class="s-field em-segment"><span>მიმღებები</span><select data-segment>${(segs.segments || Object.keys(SEGMENTS)).map((s) => `<option value="${esc(s)}" ${s === c.segment ? 'selected' : ''}>${esc(SEGMENTS[s] || s)} · ${fmt(counts[s] ?? 0)}</option>`).join('')}</select><small>რიცხვი — ვინც თანხმობა მისცა, აქტიურია და მისამართი არ არის დაბლოკილი.</small></label>
        </div>
        <div class="s-card-body"><div class="s-split" data-editor>${editorForm(c, ['name', 'appUrl', 'supportEmail'])}${previewPane()}</div></div>
      </section>
    </div>`;
    const scope = pane.querySelector('[data-editor]');
    const segSel = pane.querySelector('[data-segment]');
    const body = () => ({ ...readFields(scope), segment: segSel.value });
    wireEditor(scope, '/campaigns/preview', () => ({ segment: segSel.value }));
    V().watchDirty?.(pane.querySelector('[data-editor-card]'));
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
    pane.querySelector('[data-back]').onclick = () => guardLeave(() => { st.editCampaign = null; void paintSub(); });
    pane.querySelector('[data-save]').onclick = async () => { try { await save(); toast('მონახაზი შენახულია', 'ok'); } catch (e) { toast(e.message, 'bad'); } };
    pane.querySelector('[data-test]').onclick = () => openTestDialog((to) => api('/campaigns/test', { method: 'POST', body: { to, fields: body() } }));
    pane.querySelector('[data-queue]').onclick = async () => {
      let saved;
      try { saved = await save(); } catch (e) { toast(e.message, 'bad'); return; }
      const n = counts[segSel.value];
      V().openConfirm?.({
        title: 'კამპანიის გაგზავნა?',
        message: `„${saved.subject}“ — ${SEGMENTS[saved.segment] || saved.segment}: დაახლოებით ${fmt(n)} ადამიანი. დაწყების შემდეგ გაგზავნილს ვერ დააბრუნებ (გაუქმება აჩერებს დარჩენილს).`,
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
    const filtered = ['template', 'status', 'from', 'to', 'userId', 'campaignId'].some((k) => f[k]);
    pane.innerHTML = `<section class="s-card">
        <header class="s-card-head"><div><h3>ჟურნალი</h3><p>ყოველი გაგზავნის მცდელობა. მისამართი დაფარულია, ტექსტი არ ინახება.</p></div></header>
        <div class="s-card-body"><form class="s-form-grid em-filter-grid" data-filter>
          <label class="s-field"><span>წერილი</span><select name="template"><option value="">ყველა</option>${Object.entries(TEMPLATE_NAMES).map(([k, l]) => `<option value="${k}" ${f.template === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="s-field"><span>სტატუსი</span><select name="status"><option value="">ყველა</option>${Object.entries(LOG_STATUS).map(([k, [l]]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="s-field"><span>დან</span><input type="date" name="from" value="${esc(f.from || '')}"></label>
          <label class="s-field"><span>მდე</span><input type="date" name="to" value="${esc(f.to || '')}"></label>
          <label class="s-field"><span>მომხმარებლის ID</span><input type="text" name="userId" value="${esc(f.userId || '')}" placeholder="ჩასვი პროფილიდან"></label>
        </form>${f.campaignId ? `<div class="em-filter-chip"><span>კამპანია: „${esc(f.campaignLabel || 'არჩეული კამპანია')}“</span><button type="button" class="btn compact ghost" data-clear-campaign>${ico('x')} ფილტრის მოხსნა</button></div>` : ''}</div>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table em-table">
          <thead><tr><th>დრო</th><th>მიმღები</th><th>წერილი</th><th>სტატუსი</th><th>თემა</th><th>შენიშვნა</th><th></th></tr></thead>
          <tbody>${logs.length ? logs.map((l) => `<tr>
            <td class="s-muted em-nowrap">${esc(when(l.createdAt))}</td>
            <td><code class="em-addr">${esc(l.toMasked)}</code></td>
            <td class="em-nowrap">${esc(TEMPLATE_NAMES[l.templateKey] || l.templateKey)}</td>
            <td>${badge(LOG_STATUS, l.status)}</td>
            <td class="em-subject">${esc(l.subject)}</td>
            <td class="s-muted em-note"${l.error ? ` title="${esc(l.error)}"` : ''}>${esc(errorLabel(l.error, l.status))}</td>
            <td class="num">${l.userId ? `<a class="em-link" href="#/users/${encodeURIComponent(l.userId)}" title="${esc(l.userId)}">პროფილი</a>` : ''}</td>
          </tr>`).join('') : `<tr><td colspan="7"><div class="s-empty">${filtered ? 'ამ ფილტრით ჩანაწერი არ მოიძებნა.' : 'ჟურნალი ჯერ ცარიელია.'}</div></td></tr>`}</tbody></table></div>
          <div class="s-pager"><span>${fmt(d.total ? off + 1 : 0)}–${fmt(Math.min(off + logs.length, d.total))} / ${fmt(d.total)}</span>
            <div><button type="button" class="btn compact" data-prev ${off ? '' : 'disabled'}>წინა</button><button type="button" class="btn compact" data-next ${off + logs.length < d.total ? '' : 'disabled'}>შემდეგი</button></div></div>
        </div>
      </section>`;
    const form = pane.querySelector('[data-filter]');
    form.addEventListener('change', () => {
      const data = Object.fromEntries(new FormData(form).entries());
      st.log = { ...data, campaignId: st.log.campaignId, campaignLabel: st.log.campaignLabel, offset: 0 };
      void paintSub();
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    pane.querySelector('[data-clear-campaign]')?.addEventListener('click', () => { st.log = { ...st.log, campaignId: '', campaignLabel: '', offset: 0 }; void paintSub(); });
    pane.querySelector('[data-prev]').onclick = () => { st.log.offset = Math.max(0, off - 50); void paintSub(); };
    pane.querySelector('[data-next]').onclick = () => { st.log.offset = off + 50; void paintSub(); };
  }

  global.renderEmailAdmin = renderEmailAdmin;
  global.AdminV4Email = { renderEmailAdmin };
})(window);
