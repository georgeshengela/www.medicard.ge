/**
 * MediCard Admin V4 — #/funnel ფუნელი (product funnel, /api/admin/funnel).
 * install/source → signup → onboarding → first health action → D1, split by the goal picked at sign-up
 * ("door", primaryGoal) and by source; onboarding step drop-off; D1/D7/D30 from the existing retention analytics.
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
  const dayLabel = (day) => (global.AdminCharts?.dayLabel ? global.AdminCharts.dayLabel(day) : String(day || ''));
  const when = (iso) => (global.AdminV3?.formatDate ? global.AdminV3.formatDate(iso, 'datetime') : String(iso || ''));

  const PERIODS = [7, 30, 90];
  const GOALS = { medications: 'წამლები', nutrition: 'კვება და წონა', cycle: 'ციკლი', general: 'ზოგადი', unknown: 'არ აირჩია' };
  const STEPS = {
    'o1-gender': 'სქესი', 'o2-goal': 'მთავარი მიზანი', 'o3-birthdate': 'დაბადების თარიღი', 'o4-body': 'სიმაღლე და წონა',
    'o5-medication': 'პირველი წამალი', 'o5-weight': 'სამიზნე წონა', 'o5-cycle': 'ბოლო მენსტრუაცია',
    privacy: 'კონფიდენციალობა', 'ai-privacy': 'AI თანხმობა', notifications: 'შეტყობინებები', 'home-layout': 'მთავარი გვერდის არჩევა',
  };
  const ACTIONS = { medication: 'წამალი', meal: 'კვება', cycle: 'ციკლი', weight: 'წონა', visit: 'ვიზიტი', record: 'ჩანაწერი', checkin_manual: 'მაჩვენებელი ხელით' };
  const FEATURES = {
    price_alert_opened: 'ფასის კლების შეტყობინება გახსნეს', health_passport_created: 'ჯანმრთელობის პასპორტი შექმნეს', referral_shared: 'მოწვევა გააზიარეს',
    home_layout_picker_opened: 'მთავარი გვერდის არჩევა გაიხსნა', home_layout_changed: 'მთავარი გვერდი შეიცვალა', home_layout_offer_answered: 'ქალის გვერდის შეთავაზებაზე პასუხი',
    cycle_log_saved: 'ციკლის დღე აღირიცხა', cycle_period_started: 'მენსტრუაციის დაწყება მოინიშნა', cycle_explain_opened: 'ციკლის ახსნა გაიხსნა',
  };
  // Per-value counts the server sends for some events (FEATURE_BREAKDOWN in src/lib/funnel.js). Never show the raw enum.
  const BREAKDOWN = {
    home_layout_changed: { standard: 'სტანდარტული', women: 'ქალის ჯანმრთელობა', active: 'აქტიური', weight: 'კვება და წონა' },
    home_layout_offer_answered: { tried: 'სცადა', dismissed: 'უარი თქვა', other: 'სხვა აირჩია' },
    // Cycle events say only where it happened — never what was logged (server CYCLE_* enums).
    cycle_log_saved: { quick: 'სწრაფი აღრიცხვა', full: 'სრული ჩანაწერი', home: 'მთავარი გვერდი', day_sheet: 'დღის ფანჯარა' },
    cycle_period_started: { hero: 'ციკლის გვერდი', home: 'მთავარი გვერდი', strip: 'დღეების ზოლი', day_sheet: 'დღის ფანჯარა', widget: 'ვიჯეტი' },
    cycle_explain_opened: {
      ring: 'ციკლის რგოლი', fertile: 'ნაყოფიერი დღეები', stats: 'ჩემი ციკლი', deviation: 'გადახრები',
      learn_more: 'გაიგე მეტი', ttc_signal: 'ნაყოფიერების ნიშნები', tracking: 'მხოლოდ აღრიცხვა',
    },
  };
  const breakdownBadges = (f) => {
    const names = BREAKDOWN[f.name] || {};
    const entries = Object.entries(f.breakdown || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    return entries.length
      ? `<span class="s-funnel-badges">${entries.map(([k, n]) => `<span class="s-badge is-plain">${esc(names[k] || 'უცნობი')} · ${fmt(n)}</span>`).join('')}</span>`
      : '';
  };
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

  const rateTone = (rate) => (rate >= 50 ? 'is-ok' : rate >= 20 ? 'is-warn' : 'is-bad');
  const rateBadge = (rate, title) => (rate == null ? '' : `<span class="s-badge is-plain ${rateTone(rate)}" title="${esc(title)}">${pct(rate)}</span>`);
  const retentionMetric = (label, r) => `<div class="s-metric"><span>${label}</span><strong>${r && r.available ? pct(r.rate) : '—'}</strong><small>${r && r.available ? `${fmt(r.retained)} / ${fmt(r.eligible)} ადამიანი` : 'საკმარისი მონაცემი ჯერ არ არის'}</small></div>`;
  const empty = (text) => `<div class="s-empty">${ico('info')}<span>${esc(text)}</span></div>`;

  function periodText(p) {
    if (!p?.from || !p?.to) return '';
    const year = String(new Date().getFullYear());
    const tail = String(p.to).slice(0, 4) === year ? '' : `, ${String(p.to).slice(0, 4)}`;
    return `${dayLabel(p.from)} – ${dayLabel(p.to)}${tail}`;
  }

  /** Horizontal funnel: one column per step, the bar shows who is left and (lighter) who dropped since the step before. */
  function funnelSteps(steps) {
    if (!steps.length) return empty('ამ პერიოდში ფუნელის მოვლენები ჯერ არ არის.');
    const top = Math.max(1, ...steps.map((s) => s.count || 0));
    const share = (n) => Math.max(0, Math.min(100, ((Number(n) || 0) / top) * 100));
    return `<ol class="s-funnel" style="--n:${steps.length}">${steps.map((s, i) => {
      const prev = i ? steps[i - 1].count || 0 : s.count || 0;
      const kept = share(s.count);
      const lost = i ? Math.max(0, share(prev) - kept) : 0;
      const foot = i
        ? `${rateBadge(s.fromPrevious, 'წინა ნაბიჯიდან')}<span>წინა ნაბიჯიდან</span>`
        : '<span>საწყისი ნაბიჯი</span>';
      return `<li class="s-funnel-step">
        <div class="s-funnel-head"><span>${esc(s.label)}</span><strong>${fmt(s.count)}</strong></div>
        <div class="s-funnel-bar" role="img" aria-label="${esc(`${s.label}: ${fmt(s.count)}`)}" style="--v:${kept.toFixed(1)}%;--lost:${lost.toFixed(1)}%"><b></b><i></i></div>
        <div class="s-funnel-foot">${foot}${s.key === 'd1' && s.eligible != null ? `<small>ვადაში ${fmt(s.eligible)} ადამიანი</small>` : ''}</div>
      </li>`;
    }).join('')}</ol>`;
  }

  function meterRow(label, count, max, extra) {
    const w = max > 0 && count ? Math.max(2, Math.round((count / max) * 100)) : 0;
    return `<div class="s-funnel-row">
      <span>${esc(label)}</span>
      <div class="s-meter" role="img" aria-label="${esc(label)}: ${fmt(count)}"><i style="width:${w}%"></i></div>
      <span class="s-funnel-row-val"><b>${fmt(count)}</b>${extra || ''}</span>
    </div>`;
  }

  function paint(root, d) {
    const steps = d.steps || [];
    const signup = steps.find((s) => s.key === 'signup');
    const onboarded = steps.find((s) => s.key === 'onboarding_completed');
    const activated = steps.find((s) => s.key === 'first_health_action');
    const install = steps.find((s) => s.key === 'install');
    const ret = d.retention || {};
    const onb = d.onboarding || [];
    const onbTop = Math.max(1, ...onb.map((s) => s.viewed || 0));
    const goals = d.goals || [];
    const sources = d.sources || [];
    const features = d.features || [];
    const trend = d.trend || {};
    const chart = global.AdminCharts?.line
      ? global.AdminCharts.line([
        { label: 'ინსტალაცია', tone: 'teal', points: trend.installs || [] },
        { label: 'რეგისტრაცია', tone: 'blue', points: trend.signups || [] },
        { label: 'პირველი ქმედება', tone: 'orange', points: trend.activated || [] },
      ], { label: 'დღიური ტრენდი', height: 220, empty: 'ამ პერიოდში მოვლენები არ არის' })
      : '';

    root.innerHTML = `<div class="s-stack v3-tab-shell s-funnel-page">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="პერიოდი">${PERIODS.map((p) => `<button type="button" role="tab" aria-selected="${p === days}" data-days="${p}">${p} დღე</button>`).join('')}</div>
        <div class="s-funnel-tools">
          ${d.refreshedAt ? `<span class="s-funnel-meta">განახლდა ${esc(when(d.refreshedAt))}</span>` : ''}
          <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
        </div>
      </div>
      ${d.installed === false ? `<div class="s-callout is-warn">${ico('alert')}<p><b>ფუნელის ცხრილი ჯერ არ არის შექმნილი.</b> ის შეიქმნება შემდეგი დეპლოისას. მანამდე აქ მხოლოდ დაბრუნების მაჩვენებლები ჩანს.</p></div>` : ''}
      ${d.installed !== false && !d.hasData ? `<div class="s-callout">${ico('info')}<p>ამ პერიოდში ფუნელის მოვლენები ჯერ არ მოსულა. მოვლენებს აგზავნის აპის ახალი ვერსია — ძველი ვერსიები აქ არ ჩანს.</p></div>` : ''}
      <div class="s-metrics">
        <div class="s-metric"><span>ინსტალაცია</span><strong>${fmt(install?.count)}</strong><small>პირველი გახსნა ამ პერიოდში</small></div>
        <div class="s-metric"><span>რეგისტრაცია</span><strong>${fmt(signup?.count)}</strong><small>ბაზაში ახალი ანგარიში: ${fmt(d.newAccounts)}</small></div>
        <div class="s-metric"><span>ონბორდინგი დაასრულა</span><strong>${pct(onboarded?.fromSignup)}</strong><small>${fmt(onboarded?.count)} რეგისტრაციიდან</small></div>
        <div class="s-metric"><span>პირველი ქმედება</span><strong>${pct(activated?.fromSignup)}</strong><small>${fmt(activated?.count)} რეგისტრაციიდან</small></div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>ფუნელი · ${esc(periodText(d.period))}</h3>
          <p>ამ პერიოდში დარეგისტრირებულთა გზა. ღია ფერი — ვინც წინა ნაბიჯის შემდეგ დაიკარგა.</p></div></header>
        <div class="s-card-body">${funnelSteps(steps)}</div>
      </section>
      <section class="s-card">
        <header class="s-card-head"><div><h3>დღიური ტრენდი</h3><p>ინსტალაციები, რეგისტრაციები და პირველი ჯანმრთელობის ქმედებები, თბილისის დღეების მიხედვით.</p></div></header>
        <div class="s-card-body">${chart}</div>
      </section>
      <div class="s-section-title"><h3>დაბრუნება · ბოლო 90 დღის კოჰორტა</h3><span class="s-funnel-meta">პერიოდის არჩევანზე არ იცვლება</span></div>
      <div class="s-metrics">
        ${retentionMetric('D1 დაბრუნება', ret.d1)}
        ${retentionMetric('D7 დაბრუნება', ret.d7)}
        ${retentionMetric('D30 დაბრუნება', ret.d30)}
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>მიზანი რეგისტრაციისას</h3><p>რომელი მიზნით შემოსულები იწყებენ გამოყენებას და ბრუნდებიან. მხოლოდ ონბორდინგდასრულებულები.</p></div></header>
        <div class="s-card-body is-flush">${goals.length ? `<div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>მიზანი</th><th class="num">ადამიანი</th><th class="num">პირველი ქმედება</th><th class="num">D1</th><th class="num">D7</th><th>რით დაიწყეს</th></tr></thead>
          <tbody>${goals.map((g) => `<tr>
            <td><b>${esc(GOALS[g.goal] || g.goal)}</b></td>
            <td class="num">${fmt(g.users)}</td>
            <td class="num">${pct(g.activationRate)}</td>
            <td class="num">${pct(g.d1Rate)}</td>
            <td class="num">${pct(g.d7Rate)}</td>
            <td><span class="s-funnel-badges">${Object.entries(g.actions || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="s-badge is-plain">${esc(ACTIONS[k] || k)} · ${fmt(n)}</span>`).join('') || '<span class="s-muted">—</span>'}</span></td>
          </tr>`).join('')}</tbody></table></div>` : empty('ამ პერიოდში ონბორდინგი ჯერ არავის დაუსრულებია.')}</div>
      </section>
      <section class="s-card">
        <header class="s-card-head"><div><h3>წყარო</h3><p>საიდან მოვიდა ინსტალაცია: მოწვევის ბმული, UTM კამპანია თუ ორგანული. „უცნობი“ — რეგისტრაცია ინსტალაციის მოვლენის გარეშე.</p></div></header>
        <div class="s-card-body is-flush">${sources.length ? `<div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>წყარო</th><th class="num">ინსტალაცია</th><th class="num">რეგისტრაცია</th><th class="num">ინსტ. → რეგ.</th><th class="num">ონბორდინგი</th><th class="num">პირველი ქმედება</th><th class="num">D1</th></tr></thead>
          <tbody>${sources.map((s) => `<tr>
            <td><b>${esc(sourceLabel(s.key))}</b></td>
            <td class="num">${fmt(s.installs)}</td>
            <td class="num">${fmt(s.signups)}</td>
            <td class="num">${pct(s.signupRate)}</td>
            <td class="num">${fmt(s.onboarded)}</td>
            <td class="num">${fmt(s.activated)} <span class="s-muted">(${pct(s.activationRate)})</span></td>
            <td class="num">${pct(s.d1Rate)}</td>
          </tr>`).join('')}</tbody></table></div>` : empty('ამ პერიოდში წყაროს მონაცემი არ არის.')}</div>
      </section>
      <section class="s-card">
        <header class="s-card-head"><div><h3>ონბორდინგის ნაბიჯები</h3><p>რამდენმა ნახა თითო ნაბიჯი და რამდენმა გაიარა. სადაც % მკვეთრად ეცემა, იქ იკარგებიან.</p></div></header>
        <div class="s-card-body is-flush">${onb.length
          ? `<div class="s-funnel-rows">${onb.map((s) => meterRow(STEPS[s.stepKey] || s.stepKey, s.viewed, onbTop, `${rateBadge(s.completionRate, 'გაიარა / ნახა')}<small>გაიარა ${fmt(s.completed)}</small>`)).join('')}</div>`
          : empty('ამ პერიოდში ონბორდინგის ნაბიჯები ჯერ არავის უნახავს.')}</div>
      </section>
      ${features.length ? `<div class="s-section-title"><h3>სხვა მოვლენები</h3></div>
      <div class="s-metrics">${features.map((f) => `<div class="s-metric"><span>${esc(FEATURES[f.name] || f.name)}</span>${f.anonymous ? `<strong>${fmt(f.events)}</strong><small>ჯერ · ანონიმური, ადამიანები არ ითვლება</small>` : `<strong>${fmt(f.users)}</strong><small>ადამიანი · ${fmt(f.events)} ჯერ</small>`}${breakdownBadges(f)}</div>`).join('')}</div>` : ''}
    </div>`;

    root.querySelectorAll('[data-days]').forEach((btn) => btn.addEventListener('click', () => {
      days = Number(btn.dataset.days) || 30;
      root.querySelectorAll('[data-days]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
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
      root.innerHTML = `<div class="s-card"><div class="s-empty" role="alert">${ico('alert')}<strong>ფუნელი ვერ ჩაიტვირთა</strong><span>სერვერმა პასუხი ვერ დააბრუნა — სცადე ხელახლა.</span>${err?.message ? `<small>${esc(err.message)}</small>` : ''}<button type="button" class="btn compact" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = renderFunnel;
      return;
    }
    paint(root, data);
  }

  global.renderFunnel = renderFunnel;
  global.AdminV4Funnel = { renderFunnel };
})(window);
