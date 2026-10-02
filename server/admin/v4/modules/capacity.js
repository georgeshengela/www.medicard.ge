/**
 * MediCard Admin V4 — #/capacity სერვერის დატვირთვა (/api/admin/capacity).
 * Fleet CPU / memory / latency / errors per minute, current level with reasons, the Render step to
 * take (scale out / bigger plan / "scaling will not help") and the Telegram alert history.
 */
(function adminV4Capacity(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE', { maximumFractionDigits: d }) : '—');
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const RENDER_SCALING = 'https://dashboard.render.com/web/srv-da12dkvlk1mc7392fj00/scaling';
  const RENDER_METRICS = 'https://dashboard.render.com/web/srv-da12dkvlk1mc7392fj00/metrics';

  const PERIODS = [[1, '1 სთ'], [6, '6 სთ'], [24, '24 სთ'], [168, '7 დღე']];
  const LEVEL = {
    ok: { badge: 'is-ok', text: 'ნორმაშია', title: 'სერვერი ნორმაშია' },
    warn: { badge: 'is-warn', text: 'დატვირთვა იზრდება', title: 'დატვირთვა იზრდება — მოემზადე გასაზრდელად' },
    critical: { badge: 'is-bad', text: 'ზღვარზეა', title: 'სერვერი ზღვარზეა — გაზარდე ახლა' },
    recovered: { badge: 'is-ok', text: 'ნორმას დაუბრუნდა', title: '' },
    // No samples yet (tables missing or the monitor just started): never claim "normal".
    none: { badge: 'is-plain', text: 'გაზომვა არ არის', title: 'სერვერის მდგომარეობა ჯერ უცნობია' },
  };
  // Georgian names by rule key: the server's own labels still carry English words ("Event loop").
  const RULE_LABEL = {
    cpu: 'CPU',
    memory: 'მეხსიერება',
    latency: 'პასუხის დრო (p95)',
    loop: 'Node-ის დაყოვნება (p95)',
    errors: 'სერვერის შეცდომები (5xx)',
    db: 'ბაზის პინგი',
  };
  const SCALE_HELP = { instances: 'ინსტანსების დამატება', plan: 'უფრო დიდი გეგმა (RAM)', database: 'Neon compute (Render არა)', none: 'ლოგების ნახვა, შემდეგ გასწორება' };
  const ruleLabel = (r) => RULE_LABEL[r?.key] || r?.label || '—';
  /** "94,6%" / "3 241 ms"; percentages keep one decimal. */
  const withUnit = (v, unit, digits) => (v === null || v === undefined || !Number.isFinite(Number(v))
    ? '—'
    : `${num(v, digits ?? (unit === '%' ? 1 : 0))}${unit === '%' ? '%' : ' ms'}`);

  let hours = 6;
  let refreshTimer = null;

  if (typeof ICONS === 'object') {
    ICONS.gauge = '<path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/><circle cx="12" cy="14" r="1.2"/>';
    doc.querySelectorAll('[data-icon="gauge"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('gauge'));
    });
  }

  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  /** 24-hour Tbilisi time for chart axes; built by hand because browsers often lack ka-GE locale data (→ "PM"). */
  const tbilisiTime = (iso, withDay) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tbilisi', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric',
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    const time = `${parts.hour}:${parts.minute}`;
    return withDay ? `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1]}, ${time}` : time;
  };
  const when = (iso) => (global.AdminV3?.formatDate ? global.AdminV3.formatDate(iso, 'datetime') : tbilisiTime(iso, true));
  /** "45 წთ" · "2 სთ 14 წთ" · "3 დღე 4 სთ". */
  const duration = (min) => {
    const m = Math.max(0, Math.round(Number(min) || 0));
    if (m < 60) return `${m} წთ`;
    if (m < 1440) return `${Math.floor(m / 60)} სთ${m % 60 ? ` ${m % 60} წთ` : ''}`;
    const h = Math.floor((m % 1440) / 60);
    return `${Math.floor(m / 1440)} დღე${h ? ` ${h} სთ` : ''}`;
  };

  /** Keeps charts readable: at most ~120 points, each the worst value of its slot. */
  function downsample(series, key, reducer = Math.max) {
    const slot = Math.max(1, Math.ceil(series.length / 120));
    const out = [];
    for (let i = 0; i < series.length; i += slot) {
      const chunk = series.slice(i, i + slot);
      const vals = chunk.map((s) => s[key]).filter(Number.isFinite);
      out.push({ day: tbilisiTime(chunk[0].at, hours > 24), count: vals.length ? Math.round(reducer(...vals) * 10) / 10 : 0 });
    }
    return out;
  }
  const sum = (...v) => v.reduce((a, b) => a + b, 0);

  function metric(label, value, unit, rule, small) {
    const v = Number(value);
    const tone = rule && Number.isFinite(v) ? (v >= rule.critical ? 'is-bad' : v >= rule.warn ? 'is-warn' : '') : '';
    return `<div class="s-metric ${tone}"><span>${esc(label)}</span><strong>${Number.isFinite(v) ? `${num(v, unit === '%' ? 1 : 0)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}` : '—'}</strong><small>${small || ''}</small></div>`;
  }

  function chartCard(title, note, lines, opts) {
    const html = global.AdminCharts?.line ? global.AdminCharts.line(lines, { label: title, height: 200, empty: 'ამ პერიოდში გაზომვა ჯერ არ არის', ...opts }) : '';
    return `<section class="s-card"><header class="s-card-head"><div><h3>${esc(title)}</h3><p>${note}</p></div></header><div class="s-card-body">${html}</div></section>`;
  }

  function reasonChips(reasons) {
    if (!reasons?.length) return '<span class="s-muted">—</span>';
    return `<span class="p3-reasons">${reasons.map((r) => `<span class="p3-reason"><b>${esc(ruleLabel(r))}</b> ${esc(withUnit(r.value, r.unit))}<small>ზღვარი ${esc(withUnit(r.threshold, r.unit, 0))}</small></span>`).join('')}</span>`;
  }

  function paint(root, d) {
    const rules = Object.fromEntries((d.rules || []).map((r) => [r.key, r]));
    const series = d.series || [];
    const last = series.at(-1) || {};
    const levelKey = series.length ? d.current?.level || 'ok' : 'none';
    const level = LEVEL[levelKey] || LEVEL.ok;
    const reasons = d.current?.reasons || [];
    const steps = d.steps || [];
    const tg = d.telegram || {};
    const peak = (k) => Math.max(0, ...series.map((s) => Number(s[k]) || 0));

    root.innerHTML = `<div class="s-stack v3-tab-shell">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="პერიოდი">${PERIODS.map(([h, label]) => `<button type="button" role="tab" aria-selected="${h === hours}" data-hours="${h}">${label}</button>`).join('')}</div>
        <div class="p3-tools">
          <span class="p3-meta">ახლდება ყოველ წუთს</span>
          <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
          <button type="button" class="btn ghost compact" data-test>${ico('send')} სატესტო გაფრთხილება</button>
        </div>
      </div>
      ${d.installed === false ? `<div class="s-callout is-warn">${ico('alert')}<p><b>მონიტორის ცხრილები ჯერ არ არის.</b> ისინი შეიქმნება სერვერის შემდეგი განახლებისას — გაზომვა ამის შემდეგ დაიწყება.</p></div>` : ''}
      ${d.installed !== false && !series.length ? `<div class="s-callout">${ico('info')}<p>გაზომვები ჯერ არ მოსულა. სერვერი პირველ ჩანაწერს ჩართვიდან ერთ წუთში აკეთებს, შემდეგ — ყოველ წუთს.</p></div>` : ''}
      ${!tg.configured || !tg.paired ? `<div class="s-callout is-warn">${ico('alert')}<p><b>Telegram-ის გაფრთხილება არ მოგივა:</b> ${!tg.configured ? 'სერვერზე Telegram-ის ბოტი არ არის დაყენებული.' : 'დირექტორის ბოტი შენს ჩატთან ჯერ არ არის დაკავშირებული — დააკავშირე „დირექტორი“ გვერდზე.'} გაფრთხილებები მაინც ჩაიწერება ქვემოთ, ისტორიაში.</p></div>` : ''}

      <section class="s-card p3-level ${{ critical: 'is-bad', warn: 'is-warn', none: 'is-none' }[levelKey] || ''}">
        <header class="s-card-head"><div><h3>${esc(level.title)}</h3><p>ინსტანსები ახლა: <b>${num(d.instances)}</b> · ბოლო გაზომვა: ${last.at ? esc(when(last.at)) : '—'}</p></div>
          <span class="s-badge ${level.badge}">${esc(level.text)}</span></header>
        <div class="s-card-body">
          ${reasons.length
            ? `<ul class="p3-list">${reasons.map((r) => `<li><b>${esc(ruleLabel(r))}</b>: ${esc(withUnit(r.value, r.unit))} — ზღვარი ${esc(withUnit(r.threshold, r.unit, 0))}, ${esc(num(r.minutes))} წუთი ზედიზედ</li>`).join('')}</ul>`
            : `<p class="p3-note">${levelKey === 'none' ? 'ზღვრები შემოწმდება, როგორც კი პირველი გაზომვები მოვა.' : 'არც ერთი ზღვარი არ არის გადაცილებული.'}</p>`}
          ${steps.length ? `<h4 class="p3-h">რა გააკეთო</h4><ol class="p3-list">${steps.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>` : ''}
          <div class="p3-actions">
            <a class="btn ${levelKey === 'warn' || levelKey === 'critical' ? '' : 'ghost'} compact" href="${RENDER_SCALING}" target="_blank" rel="noopener">${ico('link')} Render → Scaling</a>
            <a class="btn ghost compact" href="${RENDER_METRICS}" target="_blank" rel="noopener">${ico('link')} Render → Metrics</a>
          </div>
        </div>
      </section>

      <div class="s-metrics">
        ${metric('CPU (საშუალო)', last.cpuPct, '%', rules.cpu, series.length ? `პიკი პერიოდში: ${num(peak('cpuPct'), 1)}%` : '')}
        ${metric('მეხსიერება', last.memPct, '%', rules.memory, last.memMb ? `${num(last.memMb)} MB · პიკი ${num(peak('memPct'), 1)}%` : '')}
        ${metric('პასუხის დრო (p95)', last.p95Ms, 'ms', rules.latency, 'AI და ატვირთვები არ ითვლება')}
        ${metric('მოთხოვნა / წთ', last.requests, '', null, Number.isFinite(last.errorPct) ? `სერვერის შეცდომა (5xx): ${num(last.errorPct, 1)}%` : '')}
        ${metric('ბაზის პინგი', last.dbOk === false ? NaN : last.dbMs, 'ms', rules.db, last.dbOk === false ? '<b>ბაზა არ პასუხობს</b>' : 'ბაზის პასუხის დრო')}
        ${metric('Node-ის დაყოვნება (p95)', last.loopP95Ms, 'ms', rules.loop, Number.isFinite(last.inflightMax) ? `ერთდროულად: ${num(last.inflightMax)} მოთხოვნამდე` : '')}
      </div>

      ${chartCard('CPU და მეხსიერება', `წილი ინსტანსის ლიმიტიდან. გაფრთხილება: CPU ≥ ${num(rules.cpu?.warn)}%, მეხსიერება ≥ ${num(rules.memory?.warn)}%.`, [
        { label: 'CPU', tone: 'teal', points: downsample(series, 'cpuPct') },
        { label: 'მეხსიერება', tone: 'blue', points: downsample(series, 'memPct') },
      ], { unit: '%' })}
      ${chartCard('პასუხის დრო', `95% მოთხოვნა ამაზე სწრაფად სრულდება (AI და ატვირთვები არ ითვლება). გაფრთხილება: ≥ ${num(rules.latency?.warn)} ms.`, [
        { label: 'პასუხის დრო (p95)', tone: 'teal', points: downsample(series, 'p95Ms') },
        { label: 'Node-ის დაყოვნება (p95)', tone: 'violet', points: downsample(series, 'loopP95Ms') },
      ], { unit: 'ms' })}
      ${chartCard('ტრაფიკი', 'API მოთხოვნები წუთში (ყველა ინსტანსი ერთად) და სერვერის შეცდომები (5xx).', [
        { label: 'მოთხოვნა წუთში', tone: 'teal', points: downsample(series, 'requests', (...v) => Math.round(sum(...v) / v.length)) },
        { label: 'შეცდომა (5xx) წუთში', tone: 'bad', points: downsample(series, 'errors5xx') },
      ])}

      <section class="s-card">
        <header class="s-card-head"><div><h3>ინსტანსები ახლა</h3><p>ბოლო 3 წუთში გაზომილი სერვერები. განახლებისას წამიერად ორი ჩანს — ეს ნორმაა.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>ინსტანსი</th><th class="num">CPU</th><th class="num">მეხსიერება</th><th class="num">პასუხი (p95)</th><th class="num">მოთხოვნა / წთ</th><th class="num">ჩართულია</th></tr></thead>
          <tbody>${(d.live || []).length ? d.live.map((i) => `<tr><td><code>${esc(i.instance)}</code></td><td class="num">${num(i.cpuPct, 1)}%</td><td class="num">${num(i.memMb)} / ${num(i.memLimitMb)} MB</td><td class="num">${num(i.p95Ms)} ms</td><td class="num">${num(i.requests)}</td><td class="num">${esc(duration(i.uptimeMin))}</td></tr>`).join('') : '<tr><td colspan="6"><div class="s-empty">ბოლო 3 წუთში გაზომვა არ მოსულა.</div></td></tr>'}</tbody>
        </table></div></div>
      </section>

      <section class="s-card">
        <header class="s-card-head"><div><h3>გაფრთხილებების ისტორია</h3><p>რა გაიგზავნა Telegram-ზე. ზრდა მაშინვე იგზავნება; იგივე დონე მეორდება 30 წთ (კრიტიკული) ან 2 სთ (გაფრთხილება) შემდეგ.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>დრო</th><th>დონე</th><th>მიზეზი</th><th>Telegram</th></tr></thead>
          <tbody>${(d.events || []).length ? d.events.map((e) => `<tr><td class="p3-nowrap">${esc(when(e.at))}</td><td><span class="s-badge ${(LEVEL[e.level] || LEVEL.ok).badge}">${esc((LEVEL[e.level] || LEVEL.ok).text)}</span></td><td>${reasonChips(e.reasons)}</td><td class="p3-nowrap">${e.delivered ? 'გაიგზავნა' : '<span class="s-muted">არ გაიგზავნა</span>'}</td></tr>`).join('') : '<tr><td colspan="4"><div class="s-empty">გაფრთხილება ჯერ არ ყოფილა.</div></td></tr>'}</tbody>
        </table></div></div>
      </section>

      <section class="s-card">
        <header class="s-card-head"><div><h3>ზღვრები</h3><p>გაფრთხილება ირთვება, როცა მნიშვნელობა მითითებული წუთები ზედიზედ ზღვარს ზემოთაა — წამიერი პიკი არ ითვლება.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>მაჩვენებელი</th><th class="num">გაფრთხილება</th><th class="num">კრიტიკული</th><th class="num">წუთი ზედიზედ</th><th>რა შველის</th></tr></thead>
          <tbody>${(d.rules || []).map((r) => `<tr><td>${esc(ruleLabel(r))}</td><td class="num">${esc(withUnit(r.warn, r.unit, 0))}</td><td class="num">${esc(withUnit(r.critical, r.unit, 0))}</td><td class="num">${num(r.minutes)}</td><td>${esc(SCALE_HELP[r.scale] || '')}</td></tr>`).join('')}</tbody>
        </table></div></div>
      </section>
    </div>`;

    root.querySelectorAll('[data-hours]').forEach((btn) => btn.addEventListener('click', () => {
      hours = Number(btn.dataset.hours) || 6;
      void renderCapacity();
    }));
    root.querySelector('[data-refresh]')?.addEventListener('click', () => void renderCapacity());
    root.querySelector('[data-test]')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        const res = await global.api('/capacity/test', { method: 'POST' });
        global.toast?.(res.delivered ? 'სატესტო გაფრთხილება გაიგზავნა Telegram-ზე.' : 'Telegram არ არის დაკავშირებული — შეტყობინება მხოლოდ დირექტორის ისტორიაში ჩაიწერა.', res.delivered ? 'ok' : 'warn');
      } catch (err) {
        global.toast?.(`სატესტო გაფრთხილება ვერ გაიგზავნა.${err?.message ? ` (${err.message})` : ''}`, 'bad');
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function renderCapacity({ silent = false } = {}) {
    const root = $('tab-capacity');
    if (!root) return;
    if (!silent) root.innerHTML = skel();
    let data;
    try {
      data = await global.api(`/capacity?hours=${hours}`);
    } catch (err) {
      if (silent) return;
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>სერვერის მონაცემები ვერ ჩაიტვირთა</strong><span>შეამოწმე კავშირი და სცადე ხელახლა.</span>${err?.message ? `<small class="p3-raw">${esc(err.message)}</small>` : ''}<button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = () => renderCapacity();
      return;
    }
    paint(root, data);
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const panel = $('tab-capacity');
      if (panel && !panel.classList.contains('hidden') && doc.visibilityState === 'visible') void renderCapacity({ silent: true });
    }, 60_000);
  }

  global.renderCapacity = renderCapacity;
  global.AdminV4Capacity = { renderCapacity };
})(window);
