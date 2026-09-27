/**
 * MediCard Admin V4 — #/funnel ფუნელი (product funnel, /api/admin/funnel).
 * install/source → signup → onboarding → first health action → D1, split by "door" (primaryGoal)
 * and by source; onboarding step drop-off; D1/D7/D30 from the existing retention analytics.
 * Events carry names and small enums only — no health values.
 */
(function adminV4Funnel(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const pct = (n) => (n == null ? '—' : `${Number(n).toLocaleString('ka-GE', { maximumFractionDigits: 1 })}%`);
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;

  const PERIODS = [7, 30, 90];
  const GOALS = { medications: 'წამლები', nutrition: 'კვება და წონა', cycle: 'ციკლი', general: 'ზოგადი', unknown: 'არ აირჩია' };
  const STEPS = {
    'o1-gender': 'სქესი', 'o2-goal': 'მთავარი მიზანი (კარი)', 'o3-birthdate': 'დაბადების თარიღი', 'o4-body': 'სიმაღლე და წონა',
    'o5-medication': 'პირველი წამალი', 'o5-weight': 'სამიზნე წონა', 'o5-cycle': 'ბოლო მენსტრუაცია',
    privacy: 'კონფიდენციალობა', 'ai-privacy': 'AI თანხმობა', notifications: 'შეტყობინებები',
  };
  const ACTIONS = { medication: 'წამალი', meal: 'კვება', cycle: 'ციკლი', weight: 'წონა', visit: 'ვიზიტი', record: 'ჩანაწერი', checkin_manual: 'მაჩვენებელი ხელით' };
  const FEATURES = { price_alert_opened: 'ფასის კლების შეტყობინება გახსნეს', health_passport_created: 'ჯანმრთელობის პასპორტი შექმნეს', referral_shared: 'მოწვევა გააზიარეს' };
  const SOURCES = { organic: 'ორგანული', invite: 'მოწვევის ბმული', deeplink: 'სხვა ბმული', unknown: 'უცნობი' };
  const sourceLabel = (key) => (String(key).startsWith('utm:') ? `UTM · ${key.slice(4)}` : SOURCES[key] || key);

  let days = 30;

  // Sidebar glyph (same 24px stroke family). admin.js may have injected icons already: refresh ours.
  if (typeof ICONS === 'object') {
    ICONS.funnel = '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z"/>';
    doc.querySelectorAll('[data-icon="funnel"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('funnel'));
    });
  }

  function meterRow(label, count, max, extra) {
    const w = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
    return `<div style="display:grid;grid-template-columns:minmax(140px,220px) 1fr auto;gap:14px;align-items:center;padding:10px 18px;border-top:1px solid var(--s-line-soft)">
      <span style="font-size:13px">${esc(label)}</span>
      <div class="s-meter" role="img" aria-label="${esc(label)}: ${fmt(count)}"><i style="width:${count ? w : 0}%"></i></div>
      <span style="display:flex;gap:8px;align-items:center;justify-content:flex-end;min-width:150px"><b style="font-variant-numeric:tabular-nums">${fmt(count)}</b>${extra || ''}</span>
    </div>`;
  }

  const rateBadge = (rate, title) => (rate == null ? '' : `<span class="s-badge ${rate >= 50 ? 'is-ok' : rate >= 20 ? 'is-warn' : 'is-bad'} is-plain" title="${esc(title)}">${pct(rate)}</span>`);
  const retentionMetric = (label, r) => `<div class="s-metric"><span>${label}</span><strong>${r && r.available ? pct(r.rate) : '—'}</strong><small>${r && r.available ? `${fmt(r.retained)} / ${fmt(r.eligible)} ადამიანი` : 'საკმარისი მონაცემი ჯერ არ არის'}</small></div>`;

  function paint(root, d) {
    const steps = d.steps || [];
    const top = Math.max(1, ...steps.map((s) => s.count || 0));
    const signup = steps.find((s) => s.key === 'signup');
    const onboarded = steps.find((s) => s.key === 'onboarding_completed');
    const activated = steps.find((s) => s.key === 'first_health_action');
    const install = steps.find((s) => s.key === 'install');
    const ret = d.retention || {};
    const onb = d.onboarding || [];
    const onbTop = Math.max(1, ...onb.map((s) => s.viewed || 0));
    const trend = d.trend || {};
    const chart = global.AdminCharts?.line
      ? global.AdminCharts.line([
        { label: 'ინსტალაცია', tone: 'teal', points: trend.installs || [] },
        { label: 'რეგისტრაცია', tone: 'blue', points: trend.signups || [] },
        { label: 'პირველი ქმედება', tone: 'orange', points: trend.activated || [] },
      ], { label: 'დღიური ტრენდი', height: 220, empty: 'ამ პერიოდში მოვლენები არ არის' })
      : '';

    root.innerHTML = `<div class="s-stack v3-tab-shell">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="პერიოდი">${PERIODS.map((p) => `<button type="button" role="tab" aria-selected="${p === days}" data-days="${p}">${p} დღე</button>`).join('')}</div>
        <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
      </div>
      ${d.installed === false ? `<div class="s-callout is-warn">${ico('alert')}<p><b>ფუნელის ცხრილი ჯერ არ არის დაყენებული.</b> ის შეიქმნება შემდეგი დეპლოისას (release → install-funnel). მანამდე ქვემოთ მხოლოდ ბაზის რეტენშენი ჩანს.</p></div>` : ''}
      ${d.installed !== false && !d.hasData ? `<div class="s-callout">${ico('info')}<p>ამ პერიოდში ფუნელის მოვლენები ჯერ არ მოსულა. მოვლენებს აგზავნის აპის ახალი ვერსია — ძველი ვერსიები აქ არ ჩანს.</p></div>` : ''}
      <div class="s-metrics">
        <div class="s-metric"><span>ინსტალაცია</span><strong>${fmt(install?.count)}</strong><small>პირველი გახსნა ამ პერიოდში</small></div>
        <div class="s-metric"><span>რეგისტრაცია</span><strong>${fmt(signup?.count)}</strong><small>ბაზაში ახალი ანგარიში: ${fmt(d.newAccounts)}</small></div>
        <div class="s-metric"><span>ონბორდინგი დაასრულა</span><strong>${pct(onboarded?.fromSignup)}</strong><small>${fmt(onboarded?.count)} რეგისტრაციიდან</small></div>
        <div class="s-metric"><span>პირველი ქმედება</span><strong>${pct(activated?.fromSignup)}</strong><small>${fmt(activated?.count)} რეგისტრაციიდან</small></div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>ფუნელი · ${esc(d.period?.from || '')} – ${esc(d.period?.to || '')}</h3>
          <p>რეგისტრაციის შემდეგი ნაბიჯები ითვლება ამ პერიოდში დარეგისტრირებულ ადამიანებზე (კოჰორტა). % — წინა ნაბიჯიდან გადასვლა. D1 ითვლება მხოლოდ მათზე, ვისთვისაც მეორე დღე უკვე დადგა.</p></div></header>
        <div class="s-card-body is-flush">${steps.map((s, i) => meterRow(s.label, s.count, top, i ? rateBadge(s.fromPrevious, 'წინა ნაბიჯიდან') + (s.key === 'd1' ? `<small class="s-muted">${fmt(s.eligible)} ვადაში</small>` : '') : '')).join('')}</div>
      </section>
      <section class="s-card">
        <header class="s-card-head"><div><h3>დღიური ტრენდი</h3><p>უნიკალური ინსტალაციები, რეგისტრაციები და პირველი ჯანმრთელობის ქმედებები თბილისის დღეების მიხედვით.</p></div></header>
        <div class="s-card-body">${chart}</div>
      </section>
      <div class="s-metrics">
        ${retentionMetric('D1 დაბრუნება', ret.d1)}
        ${retentionMetric('D7 დაბრუნება', ret.d7)}
        ${retentionMetric('D30 დაბრუნება', ret.d30)}
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>კარი — მთავარი მიზანი</h3><p>რომელი მიზნით შემოსულები იწყებენ რეალურად გამოყენებას და ბრუნდებიან. მხოლოდ ონბორდინგდასრულებული ადამიანები ამ პერიოდის კოჰორტიდან.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>კარი</th><th class="num">ადამიანი</th><th class="num">პირველი ქმედება</th><th class="num">D1</th><th class="num">D7</th><th>პირველი ქმედების ტიპი</th></tr></thead>
          <tbody>${(d.goals || []).map((g) => `<tr>
            <td><b>${esc(GOALS[g.goal] || g.goal)}</b></td>
            <td class="num">${fmt(g.users)}</td>
            <td class="num">${pct(g.activationRate)}</td>
            <td class="num">${pct(g.d1Rate)}</td>
            <td class="num">${pct(g.d7Rate)}</td>
            <td>${Object.entries(g.actions || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="s-badge is-plain">${esc(ACTIONS[k] || k)} · ${fmt(n)}</span>`).join(' ') || '<span class="s-muted">—</span>'}</td>
          </tr>`).join('')}</tbody></table></div></div>
      </section>
      <section class="s-card">
        <header class="s-card-head"><div><h3>წყარო</h3><p>საიდან მოვიდა ინსტალაცია: მოწვევის ბმული, UTM კამპანია (utm_source / utm_campaign) ან ორგანული. „უცნობი“ — რეგისტრაცია ინსტალაციის მოვლენის გარეშე (მაგ. ძველი ვერსია).</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>წყარო</th><th class="num">ინსტალაცია</th><th class="num">რეგისტრაცია</th><th class="num">ინსტ. → რეგ.</th><th class="num">ონბორდინგი</th><th class="num">პირველი ქმედება</th><th class="num">D1</th></tr></thead>
          <tbody>${(d.sources || []).length ? d.sources.map((s) => `<tr>
            <td><b>${esc(sourceLabel(s.key))}</b></td>
            <td class="num">${fmt(s.installs)}</td>
            <td class="num">${fmt(s.signups)}</td>
            <td class="num">${pct(s.signupRate)}</td>
            <td class="num">${fmt(s.onboarded)}</td>
            <td class="num">${fmt(s.activated)} <span class="s-muted">(${pct(s.activationRate)})</span></td>
            <td class="num">${pct(s.d1Rate)}</td>
          </tr>`).join('') : '<tr><td colspan="7"><div class="s-empty">ამ პერიოდში წყაროს მონაცემი არ არის.</div></td></tr>'}</tbody></table></div></div>
      </section>
      <section class="s-card">
        <header class="s-card-head"><div><h3>ონბორდინგის ნაბიჯები</h3><p>რამდენმა ნახა თითო ნაბიჯი და რამდენმა გაიარა. სადაც „გაიარა“ მკვეთრად ეცემა, იქ იკარგებიან ადამიანები. მიზნის ნაბიჯი (o5) ჩანს მხოლოდ შესაბამისი კარის ადამიანებზე.</p></div></header>
        <div class="s-card-body is-flush">${onb.map((s) => meterRow(STEPS[s.stepKey] || s.stepKey, s.viewed, onbTop, `${rateBadge(s.completionRate, 'გაიარა / ნახა')}<small class="s-muted">გაიარა ${fmt(s.completed)}</small>`)).join('')}</div>
      </section>
      <div class="s-metrics">${(d.features || []).map((f) => `<div class="s-metric"><span>${esc(FEATURES[f.name] || f.name)}</span><strong>${fmt(f.users)}</strong><small>ადამიანი · ${fmt(f.events)} ჯერ</small></div>`).join('')}</div>
      <div class="s-callout">${ico('shield')}<p>ფუნელი ინახავს მხოლოდ მოვლენის სახელს და მოკლე კატეგორიას (ნაბიჯი, მიზანი, ქმედების ტიპი, წყარო, პლატფორმა, ვერსია). ჯანმრთელობის მნიშვნელობები, სახელები და ტექსტი არ იგზავნება; ინსტალაციის ID ინახება მხოლოდ ჰეშად.</p></div>
    </div>`;

    root.querySelectorAll('[data-days]').forEach((btn) => btn.addEventListener('click', () => {
      days = Number(btn.dataset.days) || 30;
      void renderFunnel();
    }));
    root.querySelector('[data-refresh]')?.addEventListener('click', () => void renderFunnel());
  }

  async function renderFunnel() {
    const root = $('tab-funnel');
    if (!root) return;
    root.innerHTML = skel();
    let data;
    try {
      data = await global.api(`/funnel?days=${days}`);
    } catch (err) {
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = renderFunnel;
      return;
    }
    paint(root, data);
  }

  global.renderFunnel = renderFunnel;
  global.AdminV4Funnel = { renderFunnel };
})(window);
