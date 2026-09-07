/* MediCard Operations & Intelligence — real-data dashboards. No sample metrics. */
const _opsHashRange = new URLSearchParams((location.hash || '').split('?')[1] || '');
const opsState = {
  range: _opsHashRange.get('range') || sessionStorage.getItem('medicard.admin.range') || '7d',
  from: _opsHashRange.get('from') || sessionStorage.getItem('medicard.admin.rangeFrom') || '',
  to: _opsHashRange.get('to') || sessionStorage.getItem('medicard.admin.rangeTo') || '',
  grain: _opsHashRange.get('grain') || sessionStorage.getItem('medicard.admin.grain') || 'dau',
  decisionFilter: null,
};
let opsFetchGen = 0;

function opsDecisionFilterQs() {
  const filter = opsState.decisionFilter || {};
  const params = new URLSearchParams();
  if (filter.family) params.set('family', filter.family);
  if (filter.reason) params.set('reason', filter.reason);
  if (filter.userId) params.set('userId', filter.userId);
  const qs = params.toString();
  return qs ? `&${qs}` : '';
}

function applyDecisionFilter(filter) {
  opsState.decisionFilter = filter;
  if (typeof window.setPushStudioTab === 'function') window.setPushStudioTab('brain');
  closeDrawer();
  switchTab('push');
}

function opsQs(extra = {}) {
  const params = new URLSearchParams();
  const range = extra.range || opsState.range;
  params.set('range', range);
  if (range === 'custom') {
    if (extra.from || opsState.from) params.set('from', extra.from || opsState.from);
    if (extra.to || opsState.to) params.set('to', extra.to || opsState.to);
  }
  if (extra.grain) params.set('grain', extra.grain);
  return params.toString();
}

function opsPersistRange() {
  sessionStorage.setItem('medicard.admin.range', opsState.range);
  sessionStorage.setItem('medicard.admin.rangeFrom', opsState.from);
  sessionStorage.setItem('medicard.admin.rangeTo', opsState.to);
  if (opsState.grain) sessionStorage.setItem('medicard.admin.grain', opsState.grain);
  const tab = (location.hash || '#/overview').replace(/^#\/?/, '').split('?')[0] || 'overview';
  const params = new URLSearchParams((location.hash || '').split('?')[1] || '');
  params.set('range', opsState.range);
  params.set('grain', opsState.grain || 'dau');
  if (opsState.range === 'custom') {
    if (opsState.from) params.set('from', opsState.from);
    if (opsState.to) params.set('to', opsState.to);
  } else {
    params.delete('from');
    params.delete('to');
  }
  const next = `#/${tab}?${params}`;
  if (location.hash !== next) history.replaceState({ tab }, '', next);
}

function opsFmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('ka-GE');
}

function opsRate(rate) {
  if (!rate || rate.hidden || rate.value == null) return '—';
  return `${rate.value}%`;
}

function opsMs(ms) {
  if (ms == null) return '—';
  if (ms < 60000) return `${Math.round(ms / 1000)} წმ`;
  return `${Math.round(ms / 60000)} წთ`;
}

function opsEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function opsDelta(delta) {
  if (!delta || !delta.show) return '<span class="ops-delta muted">—</span>';
  const abs = delta.abs;
  const cls = abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat';
  const sign = abs > 0 ? '+' : '';
  const pct = delta.pct == null ? '' : ` · ${sign}${delta.pct}%`;
  return `<span class="ops-delta ${cls}">${sign}${opsFmt(abs)}${pct}</span>`;
}

function opsSpark(points) {
  const rows = (points || []).slice(-24);
  if (!rows.length || !rows.some((d) => d.count > 0)) {
    return '<span class="ops-spark empty" aria-hidden="true"></span>';
  }
  const w = 72;
  const h = 22;
  const max = Math.max(1, ...rows.map((d) => d.count));
  const step = rows.length > 1 ? w / (rows.length - 1) : 0;
  const line = rows.map((d, i) => `${(i * step).toFixed(1)},${(h - (d.count / max) * (h - 2) - 1).toFixed(1)}`).join(' ');
  return `<svg class="ops-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

const OPS_CHART_TONES = {
  teal: '#0D9488',
  blue: '#2563EB',
  green: '#059669',
  amber: '#D97706',
  rose: '#E11D48',
  muted: '#6B7280',
  ink: '#374151',
};

function opsToneColor(tone, idx = 0) {
  const fallback = ['teal', 'blue', 'green', 'amber', 'muted'];
  return OPS_CHART_TONES[tone] || OPS_CHART_TONES[fallback[idx % fallback.length]] || OPS_CHART_TONES.teal;
}

function opsLineChart(seriesList, { label = 'ტრენდი', height = 152 } = {}) {
  const lists = (seriesList || []).filter((s) => s.points?.length);
  if (!lists.length) return '<div class="ops-empty v3-chart-empty"><strong>ამ პერიოდში მონაცემი არ არის.</strong></div>';
  const w = 640;
  const h = height;
  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const n = Math.max(...lists.map((s) => s.points.length));
  const max = Math.max(1, ...lists.flatMap((s) => s.points.map((d) => Number(d.count) || 0)));
  const step = n > 1 ? plotW / (n - 1) : 0;
  const yAt = (count) => padT + plotH - (Number(count) / max) * plotH;
  const xAt = (i) => padL + i * step;

  const grid = [0, 0.5, 1].map((p) => {
    const y = padT + plotH - p * plotH;
    const val = Math.round(max * p);
    return `<line class="ops-gridline" x1="${padL}" x2="${w - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" />`
      + `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" class="ops-axis ops-axis-y" text-anchor="end">${opsFmt(val)}</text>`;
  }).join('');

  const areas = lists.slice(0, 1).map((s, idx) => {
    const color = opsToneColor(s.tone, idx);
    const pts = s.points.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.count).toFixed(1)}`).join(' ');
    const base = `${xAt(s.points.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} ${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)}`;
    return `<polygon class="v3-chart-area" points="${pts} ${base}" fill="${color}" fill-opacity="0.12" stroke="none"/>`;
  }).join('');

  const paths = lists.map((s, idx) => {
    const color = opsToneColor(s.tone, idx);
    const line = s.points.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.count).toFixed(1)}`).join(' ');
    return `<polyline class="ops-line" points="${line}" fill="none" stroke="${color}" stroke-width="${idx === 0 ? 2.2 : 1.7}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');

  const tickIdx = n <= 5
    ? Array.from({ length: n }, (_, i) => i)
    : [0, Math.floor((n - 1) / 2), n - 1];
  const labels = tickIdx.map((i) => {
    const d = lists[0].points[i];
    if (!d) return '';
    return `<text x="${xAt(i).toFixed(1)}" y="${h - 4}" class="ops-axis" text-anchor="middle">${opsEscape(String(d.day).slice(5))}</text>`;
  }).join('');

  const hits = lists[0].points.map((d, i) => {
    const tipParts = lists.map((s) => {
      const pt = s.points[i];
      const name = s.label || s.tone || 'სერია';
      return `${name}: ${opsFmt(pt?.count)}`;
    });
    return `<circle class="ops-hit" cx="${xAt(i).toFixed(1)}" cy="${yAt(d.count).toFixed(1)}" r="8"><title>${opsEscape(`${d.day} · ${tipParts.join(' · ')}`)}</title></circle>`;
  }).join('');

  const legend = lists.map((s, idx) => {
    const color = opsToneColor(s.tone, idx);
    const name = opsEscape(s.label || s.tone || `სერია ${idx + 1}`);
    const last = s.points[s.points.length - 1];
    return `<span class="v3-chart-leg"><i style="background:${color}"></i>${name}<em>${opsFmt(last?.count)}</em></span>`;
  }).join('');

  return `<figure class="v3-chart">
    <figcaption class="v3-chart-cap"><strong>${opsEscape(label)}</strong><div class="v3-chart-legend">${legend}</div></figcaption>
    <svg class="ops-chart v3-chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${opsEscape(label)}">${grid}${areas}${paths}${hits}${labels}</svg>
  </figure>`;
}

function opsBarChart(items, { valueKey = 'count', labelKey = 'label' } = {}) {
  const rows = (items || []).filter((row) => !row.unavailable && Number(row[valueKey]) > 0)
    .sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0));
  if (!rows.length) return '<div class="ops-empty v3-chart-empty">ამ პერიოდში აქტივობა არ არის.</div>';
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));
  const total = rows.reduce((sum, row) => sum + (Number(row[valueKey]) || 0), 0) || 1;
  return `<div class="ops-bars v3-bars">${rows.map((row) => {
    const value = Number(row[valueKey]) || 0;
    const pct = Math.round((value / max) * 100);
    const share = Math.round((value / total) * 100);
    const href = row.href
      ? ` data-go="${opsEscape(row.href.replace(/^#\/?/, '').split('?')[0])}" data-href="${opsEscape(row.href)}"`
      : '';
    const tag = row.href ? 'button type="button"' : 'button type="button"';
    const close = 'button';
    return `<${tag} class="ops-bar-row v3-bar-row"${href}>
      <span class="ops-bar-label v3-bar-label">${row.htmlLabel || opsEscape(row[labelKey] || row.key)}</span>
      <span class="ops-bar-track v3-bar-track"><span style="width:${Math.max(4, pct)}%"></span></span>
      <strong class="v3-bar-val">${opsFmt(value)}<em>${share}%</em></strong>
    </${close}>`;
  }).join('')}</div>`;
}

function opsFunnel(steps) {
  const rows = (steps || []).filter((s) => s.value != null);
  if (!rows.length) return '<div class="ops-empty v3-chart-empty"><strong>ამ პერიოდში ძაბრის მდგომარეობა არ არის.</strong></div>';
  const max = Math.max(1, ...rows.map((s) => Number(s.value) || 0));
  let prevMain = null;
  return `<ol class="ops-funnel v25-funnel v3-brain-funnel">${rows.map((s, idx) => {
    const value = Number(s.value) || 0;
    const width = Math.max(6, Math.round((value / max) * 100));
    let conv = '';
    if (!s.branch && prevMain != null && prevMain > 0) {
      conv = `<em class="v3-funnel-conv">${Math.round((value / prevMain) * 100)}%</em>`;
    }
    if (!s.branch) prevMain = value;
    const stepNo = s.branch ? '↳' : String(idx + 1);
    return `<li class="${s.branch ? 'is-branch' : 'is-main'}">
      <span class="v3-funnel-idx" aria-hidden="true">${stepNo}</span>
      <div class="v3-funnel-body">
        <div class="ops-funnel-meta"><span>${opsEscape(s.label)}</span><strong>${opsFmt(value)}${conv}</strong></div>
        <div class="ops-funnel-track"><span style="width:${width}%"></span></div>
        ${s.note ? `<p class="muted">${opsEscape(s.note)}</p>` : ''}
      </div>
    </li>`;
  }).join('')}</ol>`;
}

function opsHeatmap(grid) {
  if (!grid?.length) return '<div class="ops-empty v3-chart-empty">ამ პერიოდში აპის გახსნის დრო არ არის.</div>';
  const flat = grid.flat();
  const max = Math.max(1, ...flat);
  const days = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
  return `<div class="ops-heat v3-heat">
    <div class="v3-heat-legend"><span>დაბალი</span><i class="lv-0"></i><i class="lv-1"></i><i class="lv-2"></i><i class="lv-3"></i><span>მაღალი</span></div>
    <div class="ops-heat-hours"><span></span>${Array.from({ length: 24 }, (_, h) =>
      `<span class="${h % 3 === 0 ? 'is-mark' : 'is-dot'}">${h % 3 === 0 ? h : ''}</span>`).join('')}</div>
    ${grid.map((row, d) => `<div class="ops-heat-row"><span>${days[d]}</span>${row.map((n, h) => {
      const t = n / max;
      const level = n === 0 ? 0 : t > 0.66 ? 3 : t > 0.33 ? 2 : 1;
      return `<i class="lv-${level}" title="${days[d]} ${String(h).padStart(2, '0')}:00 · ${n}"></i>`;
    }).join('')}</div>`).join('')}
  </div>`;
}

function opsIco(name) {
  return typeof icon === 'function' ? icon(name) : '';
}

function opsTile(name, tone = '') {
  return typeof iconTile === 'function' ? iconTile(name, tone) : `<span class="icon-tile ${tone}">${opsIco(name)}</span>`;
}

function opsStripCell(ico, label, value, hint, extra) {
  return '<article class="v25-strip-cell' + (extra || '') + '">'
    + '<span class="v25-strip-top"><span class="v25-health-ico">' + opsIco(ico) + '</span><span>' + label + '</span></span>'
    + '<strong>' + value + '</strong>'
    + (hint != null && hint !== '' ? '<em>' + hint + '</em>' : '')
    + '</article>';
}

function opsEmpty(title, body, ico = 'activity') {
  return `<div class="ops-empty"><span class="ops-empty-ico">${opsIco(ico)}</span><strong>${opsEscape(title)}</strong>${body ? `<p>${opsEscape(body)}</p>` : ''}</div>`;
}

function opsError(message, retryId) {
  return `<div class="ops-empty ops-error"><strong>მონაცემების ჩატვირთვა ვერ მოხერხდა.</strong><p>${opsEscape(message)}</p>${retryId ? `<button type="button" class="btn tiny ghost" id="${retryId}">ხელახლა ცდა</button>` : ''}</div>`;
}

const SUPPRESS_KA = {
  quiet_hours: 'მშვიდი საათები',
  recent_activity: 'ბოლო აქტივობა',
  fatigue: 'დაღლილობა',
  hydration_target_reached: 'ჰიდრატაციის მიზანი მიღწეულია',
  cooldown: 'შესვენება',
  weekly_already_sent: 'კვირის ანგარიში უკვე გაიგზავნა',
  already_opened: 'უკვე გაიხსნა',
  daily_cap: 'დღიური ლიმიტი',
  privacy: 'კონფიდენციალურობა',
};

function suppressLabel(code) {
  const key = String(code || '');
  const ka = SUPPRESS_KA[key];
  return ka ? `${ka}<small>${opsEscape(key)}</small>` : opsEscape(key);
}

function opsSkeleton(rows = 4) {
  return `<div class="ops-skel">${Array.from({ length: rows }, () => '<span></span>').join('')}</div>`;
}

window.SUPPRESS_KA = SUPPRESS_KA;

function opsRangeBar() {
  if (window.AdminV3?.filterBar) return window.AdminV3.filterBar();
  const presets = [
    ['today', 'დღეს'],
    ['7d', '7დ'],
    ['30d', '30დ'],
    ['90d', '90დ'],
    ['custom', 'მითითებული'],
  ];
  return `
    <div class="ops-range" role="group" aria-label="პერიოდი">
      ${presets.map(([value, label]) => `
        <button type="button" class="ops-range-btn${opsState.range === value ? ' active' : ''}" data-ops-range="${value}">${label}</button>
      `).join('')}
      <label class="ops-range-custom${opsState.range === 'custom' ? '' : ' hidden'}">
        <input type="date" id="ops-from" value="${opsEscape(opsState.from)}" />
        <span>→</span>
        <input type="date" id="ops-to" value="${opsEscape(opsState.to)}" />
        <button type="button" class="btn tiny" id="ops-custom-apply">გამოყენება</button>
      </label>
    </div>
  `;
}

function bindOpsRange(onChange) {
  document.querySelectorAll('[data-ops-range]').forEach((btn) => {
    btn.onclick = () => {
      opsState.range = btn.dataset.opsRange;
      opsPersistRange();
      onChange();
    };
  });
  $('ops-custom-apply')?.addEventListener('click', () => {
    opsState.from = $('ops-from').value;
    opsState.to = $('ops-to').value;
    opsState.range = 'custom';
    opsPersistRange();
    onChange();
  });
  $('ops-range-clear')?.addEventListener('click', () => {
    opsState.range = '7d';
    opsState.from = '';
    opsState.to = '';
    opsPersistRange();
    onChange();
  });
}

function opsTip(text) {
  return `<button type="button" class="ops-tip" title="${opsEscape(text)}" aria-label="${opsEscape(text)}">?</button>`;
}

async function renderCommandCenter() {
  const gen = ++opsFetchGen;
  const root = $('tab-overview');
  root.innerHTML = `
    <div class="ops-page v25-overview dash-enter">
      <header class="ops-head">
        <p class="muted" id="ops-meta">ცოცხალი მონაცემები იტვირთება…</p>
        ${opsRangeBar()}
      </header>
      <section class="ops-level" aria-label="მიმდინარე მდგომარეობა">
        <div id="ops-kpis" class="ops-kpis ops-kpis-6">${opsSkeleton(6)}</div>
      </section>
      <section class="ops-level ops-level-2">
        <section class="card ops-card ops-card-hero" id="ops-activity">${opsSkeleton()}</section>
        <div class="ops-stack">
          <section class="card ops-card" id="ops-growth">${opsSkeleton()}</section>
          <section class="card ops-card" id="ops-features">${opsSkeleton()}</section>
        </div>
      </section>
      <section class="ops-level ops-level-3">
        <section class="card ops-card" id="ops-notif">${opsSkeleton()}</section>
        <div class="ops-stack">
          <section class="card ops-card" id="ops-attention">${opsSkeleton(2)}</section>
          <section class="card ops-card" id="ops-system">${opsSkeleton(2)}</section>
        </div>
      </section>
      <section class="ops-grid ops-level-ops">
        <section class="card ops-card" id="ops-medi">${opsSkeleton()}</section>
        <section class="card ops-card" id="ops-retention">${opsSkeleton()}</section>
      </section>
    </div>
  `;
  bindOpsRange(renderCommandCenter);

  const q = opsQs();
  const [overview, users, features, retention, medi, notif, system] = await Promise.all([
    api(`/analytics/overview?${q}`).catch((err) => ({ error: err.message })),
    api(`/analytics/users?${q}&grain=${opsState.grain}`).catch((err) => ({ error: err.message })),
    api(`/analytics/features?${q}`).catch((err) => ({ error: err.message })),
    api(`/analytics/retention?${q}`).catch((err) => ({ error: err.message })),
    api(`/analytics/medi?${q}`).catch((err) => ({ error: err.message })),
    api(`/analytics/notifications?${q}`).catch((err) => ({ error: err.message })),
    api('/system/health').catch((err) => ({ error: err.message })),
  ]);
  if (gen !== opsFetchGen) return;

  if (overview.error) {
    root.querySelector('#ops-kpis').innerHTML = opsError(overview.error, 'ops-retry');
    $('ops-retry')?.addEventListener('click', renderCommandCenter);
    return;
  }

  const meta = overview;
  $('ops-meta').innerHTML = [
    `<span id="ops-live-clock">ბოლო განახლება <time id="ops-live-at">${opsEscape(fmtDate(meta.refreshedAt))}</time></span>`,
    meta.environment,
    meta.appVersion ? `აპი ${meta.appVersion}` : null,
    `${meta.range?.label || ''} · ${meta.range?.timezone}`,
  ].filter(Boolean).join(' · ');
  if (typeof setLivePill === 'function' && meta.settings) setLivePill(meta.settings);

  const attention = (system.attention || overview.attention || []);
  $('ops-attention').innerHTML = attention.length
        ? `<div class="card-head">${opsTile('alert', 'warn')}<div><h3>საჭიროებს ყურადღებას</h3></div></div>
        ${attention.map((item) => `
          <button type="button" class="ops-alert ${item.severity || 'neutral'}" data-href="${opsEscape(item.href || '#/quality')}">
            <strong><span class="ops-sev">${opsEscape(item.severity || 'info')}</span> ${opsEscape(item.title)}</strong>
            <span>${opsEscape(item.detail)}</span>
            <em>${[item.period, item.threshold ? `ზღვარი ${item.threshold}` : '', item.n != null ? `n=${item.n}` : ''].filter(Boolean).join(' · ')}</em>
            <span class="ops-alert-cta">გამოკვლევა</span>
          </button>
        `).join('')}`
    : `<div class="card-head">${opsTile('shield', 'ok')}<div><h3>საჭიროებს ყურადღებას</h3></div></div><p class="ops-healthy">ყველაფერი ჯანსაღად გამოიყურება. ქმედება არ არის საჭირო.</p>`;
  document.querySelectorAll('#ops-attention [data-href]').forEach((btn) => {
    btn.onclick = () => { if (btn.dataset.href) location.hash = btn.dataset.href; };
  });

  const k = overview.kpis || {};
  const kpi = (key, label, row, spark, go, ico) => `
    <article class="ops-kpi${row.tone ? ` is-${row.tone}` : ''}" data-ops-kpi="${key}" data-go="${go || ''}" title="${opsEscape(row.definition || label)}">
      <div class="ops-kpi-top"><span class="ops-kpi-ico">${opsIco(ico)}</span><span>${label}</span>${opsTip(row.definition || label)}</div>
      <strong>${opsFmt(row.value)}</strong>
      <div class="ops-kpi-foot">${opsDelta(row.delta)}${spark && spark.some((d) => d.count > 0) ? opsSpark(spark) : ''}</div>
    </article>`;
  $('ops-kpis').innerHTML = [
    kpi('activeToday', 'აქტიური', k.activeToday || {}, overview.charts?.dau?.series, 'users', 'users'),
    kpi('newUsers', 'ახალი', k.newUsers || {}, k.newUsers?.spark, 'users', 'zap'),
    kpi('medi', 'Medi', k.mediRequests || k.mediConversations || {}, medi.charts?.messages, 'ai', 'spark'),
    kpi('health', 'ჯანმრთელობა', k.healthLogs || {}, null, 'health', 'activity'),
    kpi('brain', 'Brain ქმედება', { value: notif.funnel?.actioned, definition: 'NotificationOutcome actioned არჩეულ პერიოდში.' }, null, 'push', 'bell'),
    kpi('errors', 'შეცდომები', { value: system.ai?.errors24h, definition: 'AI შეცდომები ბოლო 24 საათში.', delta: null, tone: system.ai?.errors24h > 0 ? 'warn' : '' }, null, 'quality', 'alert'),
  ].join('');

  const sys = system || {};
  $('ops-system').innerHTML = `
    <div class="card-head">${opsTile('activity')}<div><h3>სისტემა</h3><p class="muted">ბოლო შემოწმება ${sys.refreshedAt ? fmtDate(sys.refreshedAt) : '—'}</p></div>
    <button class="btn tiny ghost" data-go="quality">ხარისხი</button></div>
    <div class="ops-sys">
      ${[
        ['API', sys.api?.ok, null],
        ['Database', sys.database?.ok, sys.database?.latencyMs != null ? `${opsFmt(sys.database.latencyMs)} ms` : null],
        ['Medi AI', (sys.ai?.errors24h || 0) < 5, sys.ai?.errorRate24h?.value != null ? `${sys.ai.errorRate24h.value}%` : (sys.ai?.errors24h != null ? `${opsFmt(sys.ai.errors24h)} / 24სთ` : null)],
        ['Push', !(sys.push?.failed24h > 0), sys.push?.failed24h != null ? `${opsFmt(sys.push.failed24h)} წარუმატებელი` : null],
        ['SMS', !(sys.sms?.failed24h > 0), sys.sms?.failed24h != null ? `${opsFmt(sys.sms.failed24h)} წარუმატებელი` : null],
        ['Pharmacy sync', sys.jobs?.lastSync?.status !== 'FAILED', sys.jobs?.lastSync?.status || null],
      ].map(([name, ok, meta]) => `
        <div class="ops-sys-item ${ok ? 'ok' : 'warn'}">
          <i aria-hidden="true"></i>
          <span>${name}</span>
          <strong>${ok ? 'ჯანსაღია' : 'ყურადღება'}</strong>
          <em>${meta ? opsEscape(String(meta)) : ''}</em>
        </div>
      `).join('')}
    </div>
    ${sys.ai?.series?.some((d) => d.count > 0) ? opsLineChart([{ points: sys.ai.series, tone: 'ink' }], { label: 'AI შეცდომები', height: 96 }) : ''}
  `;

  const activityEl = $('ops-activity');
  if (users.error) {
    activityEl.innerHTML = opsError(users.error);
  } else {
    activityEl.innerHTML = `
      <div class="card-head">
        ${opsTile('users', 'teal')}
        <div>
          <h3>აქტიური მომხმარებლები</h3>
          <p class="muted">${opsEscape(users.definition || '')}</p>
        </div>
        <div class="ops-range">
          ${['dau', 'wau', 'mau'].map((g) => `<button type="button" class="ops-range-btn${(users.grain || 'dau') === g ? ' active' : ''}" data-ops-grain="${g}">${g.toUpperCase()}</button>`).join('')}
        </div>
      </div>
      ${users.series?.some((d) => d.count > 0)
        ? `${opsLineChart(
          [{ points: users.series, tone: 'teal' }].concat(users.previousSeries?.length ? [{ points: users.previousSeries, tone: 'ink' }] : []),
          { label: 'აქტიური მომხმარებლები', height: 300 },
        )}<p class="muted ops-footnote">${[
          users.summary?.peak ? `პიკი ${users.summary.peak.day} · ${opsFmt(users.summary.peak.count)}` : '',
          users.summary?.average != null ? `საშუალო ${opsFmt(users.summary.average)}` : '',
          users.summary?.lowest ? `დაბალი ${users.summary.lowest.day} · ${opsFmt(users.summary.lowest.count)}` : '',
        ].filter(Boolean).join(' · ')}</p>`
        : opsEmpty('კანონიკური აქტივობის ისტორია ჯერ არ არის', 'აქტივობის აღრიცხვა იწყება AppActivity-ის დეპლოის შემდეგ.')}
    `;
    activityEl.querySelectorAll('[data-ops-grain]').forEach((btn) => {
      btn.onclick = async () => {
        opsState.grain = btn.dataset.opsGrain;
        const next = await api(`/analytics/users?${opsQs({ grain: opsState.grain })}`).catch((err) => ({ error: err.message }));
        if (next.error) return;
        activityEl.querySelector('.ops-chart')?.replaceWith();
        const chartHost = activityEl.querySelector('.ops-empty') || activityEl.querySelector('.ops-chart');
        const html = next.series?.some((d) => d.count > 0)
          ? opsLineChart(
            [{ points: next.series, tone: 'teal' }].concat(next.previousSeries?.length ? [{ points: next.previousSeries, tone: 'ink' }] : []),
            { label: 'აქტიური მომხმარებლები', height: 300 },
          )
          : opsEmpty('კანონიკური აქტივობის ისტორია ჯერ არ არის', 'აქტივობის აღრიცხვა იწყება AppActivity-ის დეპლოის შემდეგ.');
        if (chartHost) chartHost.outerHTML = html;
        else activityEl.insertAdjacentHTML('beforeend', html);
        activityEl.querySelectorAll('[data-ops-grain]').forEach((b) => b.classList.toggle('active', b.dataset.opsGrain === next.grain));
      };
    });
  }

  const growthEl = $('ops-growth');
  const growth = overview.charts?.growth;
  const growthMode = { value: 'new' };
  const paintGrowth = () => {
    const points = growthMode.value === 'new' ? growth?.newUsers : growth?.cumulative;
    growthEl.innerHTML = `
      <div class="card-head">${opsTile('zap')}<div><h3>ზრდა</h3><p class="muted">ახალი ${opsFmt(k.newUsers?.value)} · სულ ${opsFmt(k.totalUsers?.value)} ${opsDelta(k.newUsers?.delta)}</p></div>
        <div class="ops-range">
          <button type="button" class="ops-range-btn${growthMode.value === 'new' ? ' active' : ''}" data-growth="new">ახალი</button>
          <button type="button" class="ops-range-btn${growthMode.value === 'cum' ? ' active' : ''}" data-growth="cum">ჯამური</button>
        </div>
      </div>
      ${points?.some((d) => d.count > 0)
        ? opsLineChart([{ points, tone: 'teal' }], { label: growthMode.value === 'new' ? 'ახალი მომხმარებლები' : 'ჯამური მომხმარებლები' })
        : opsEmpty('ამ პერიოდში ახალი მომხმარებელი არ არის', 'ზრდა ითვლება რეგისტრაციის თარიღით.')}
    `;
    growthEl.querySelectorAll('[data-growth]').forEach((btn) => {
      btn.onclick = () => { growthMode.value = btn.dataset.growth; paintGrowth(); };
    });
  };
  paintGrowth();

  const featEl = $('ops-features');
  if (features.error) {
    featEl.innerHTML = opsError(features.error);
  } else {
    const usable = (features.features || []).filter((f) => !f.unavailable).sort((a, b) => (b.users || 0) - (a.users || 0));
    featEl.innerHTML = `
      <div class="card-head">${opsTile('activity')}<div><h3>ფუნქციების გამოყენება</h3><p class="muted">${opsFmt(features.activeUsers)} აქტიური. აბსოლუტი და % აქტიურებიდან.</p></div>
      <button class="btn tiny ghost" data-go="health">ჯანმრთელობა</button></div>
      ${opsBarChart(usable.map((f) => ({ ...f, count: f.users, label: `${f.label}${f.pctOfActive != null ? ` · ${f.pctOfActive}%` : ''}${f.delta?.show ? ` · ${f.delta.abs > 0 ? '+' : ''}${f.delta.abs}` : ''}`, href: `#/health?feature=${encodeURIComponent(f.key || '')}` })))}
      <p class="muted ops-footnote">${(features.features || []).filter((f) => f.unavailable).map((f) => f.note).join(' ')}</p>
    `;
  }

  const retEl = $('ops-retention');
  if (retention.error) {
    retEl.innerHTML = opsError(retention.error);
  } else if (!retention.available) {
    retEl.innerHTML = `<div class="card-head">${opsTile('users')}<div><h3>შენარჩუნება</h3></div></div>${opsEmpty('საკმარისი ისტორია არ არის', retention.reason || 'საჭიროა მინიმუმ 5 მომხმარებელი D1-ისთვის და დღიური შესვლები.', 'users')}`;
  } else {
    const cell = (row, label) => `<div class="ops-ret"><span>${label}</span><strong>${row.rate == null ? '—' : `${row.rate}%`}</strong><em>${opsFmt(row.retained)} / ${opsFmt(row.eligible)}</em></div>`;
    const cohorts = (retention.cohorts || []).filter((row) => row.size >= 3);
    const cohortTable = cohorts.length
      ? `<div class="table-wrap"><table class="admin-table"><thead><tr><th>კვირა</th><th>N</th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th></tr></thead><tbody>${
        cohorts.map((row) => `<tr><td>${opsEscape(row.weekStart)}</td><td>${opsFmt(row.size)}</td>${
          (row.cells || []).map((c) => `<td>${c.rate == null ? '—' : `${c.rate}%`}</td>`).join('')
        }</tr>`).join('')
      }</tbody></table></div>`
      : '';
    retEl.innerHTML = `
      <div class="card-head">${opsTile('users')}<div><h3>შენარჩუნება</h3><p class="muted">რეგისტრაციის დღე თბილისის კალენდრით და შესვლა +1 / +7 / +30 დღეზე. კოჰორტისთვის საჭიროა მინიმუმ 3 რეგისტრაცია. მომავალი კვირები და პატარა N არ ჩანს.</p></div></div>
      <div class="ops-ret-row">${cell(retention.d1, 'D1')}${cell(retention.d7, 'D7')}${cell(retention.d30, 'D30')}</div>
      ${cohortTable}
    `;
  }

  const mediEl = $('ops-medi');
  if (medi.error) {
    mediEl.innerHTML = opsError(medi.error);
  } else {
    mediEl.innerHTML = `
      <div class="card-head">${opsTile('spark', 'ult')}<div><h3>Medi</h3><p class="muted">საუბრის ტექსტი აქ არ იტვირთება — მხოლოდ რაოდენობები.</p></div>
      <button class="btn tiny ghost" data-go="ai">გახსენი Medi</button></div>
      <div class="ops-stat-row">
        <div><span>მომხმარებლები</span><strong>${opsFmt(medi.kpis?.mediUsers?.value)}</strong></div>
        <div><span>საუბრები</span><strong>${opsFmt(medi.kpis?.conversations?.value)}</strong></div>
        <div><span>მოთხოვნები</span><strong>${opsFmt(medi.kpis?.messages?.value)}</strong></div>
        <div><span>შეცდომები</span><strong>${opsFmt(medi.kpis?.errors?.value)}</strong></div>
      </div>
      ${medi.charts?.messages?.some((d) => d.count > 0)
        ? opsLineChart([{ points: medi.charts.messages, tone: 'teal' }], { label: 'Medi მოთხოვნები' })
        : opsEmpty('ამ პერიოდში Medi-ს მოთხოვნა არ არის', 'ითვლება AI გამოძახებები.')}
    `;
  }

  const notifEl = $('ops-notif');
  if (notif.error) {
    notifEl.innerHTML = opsError(notif.error);
  } else {
    notifEl.innerHTML = `
      <div class="card-head">${opsTile('bell')}<div><h3>Notification Brain</h3><p class="muted">${opsEscape(notif.funnelNote || '')}</p></div>
      <button class="btn tiny ghost" data-go="push">სრული Brain</button></div>
      ${notif.syncedDecisions
        ? `<div class="ops-stat-row">
            <div><span>შეფასებული</span><strong>${opsFmt(notif.funnel?.evaluated)}</strong></div>
            <div><span>გაგზავნილი</span><strong>${opsFmt(notif.funnel?.scheduled)}</strong></div>
            <div><span>დაბლოკილი</span><strong>${opsFmt(notif.funnel?.suppressed)}</strong></div>
            <div><span>გაუქმებული</span><strong>${opsFmt(notif.funnel?.cancelled)}</strong></div>
            <div><span>გახსნილი</span><strong>${opsFmt(notif.funnel?.opened)}</strong></div>
            <div><span>ქმედება</span><strong>${opsFmt(notif.funnel?.actioned)}</strong></div>
          </div>
          <p class="muted">${[
            notif.funnel?.rates?.action ? `ქმედების წილი ${opsRate(notif.funnel.rates.action)}` : '',
            notif.highlights?.topFamily ? `საუკეთესო ოჯახი: ${notif.highlights.topFamily.family}` : '',
            notif.highlights?.topReason ? `დაბლოკვის მიზეზი: ${notif.highlights.topReason.reason}` : '',
          ].filter(Boolean).join(' · ') || 'საკმარისი ნიმუში ოჯახის შედარებისთვის ჯერ არ არის.'}</p>`
        : opsEmpty('ამ პერიოდში Brain გადაწყვეტილებები არ არის', 'კლიენტები 23.0.3-ზე დაბლა Brain-ის გადაწყვეტილებებს არ ასინქრონებენ.')}
    `;
  }

  root.querySelectorAll('[data-go]').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.href && btn.dataset.href.includes('?')) location.hash = btn.dataset.href;
      else switchTab(btn.dataset.go);
    };
  });
}

function healthHref(feature) {
  const params = new URLSearchParams((location.hash || '').split('?')[1] || '');
  params.set('range', opsState.range);
  if (opsState.range === 'custom') {
    if (opsState.from) params.set('from', opsState.from);
    if (opsState.to) params.set('to', opsState.to);
  } else {
    params.delete('from');
    params.delete('to');
  }
  if (feature) params.set('feature', feature);
  else params.delete('feature');
  return '#/health?' + params.toString();
}

function healthFeatIco(key) {
  return ({
    medi: 'spark',
    medications: 'pill',
    cycle: 'calendar',
    hydration: 'globe',
    steps: 'zap',
    weight: 'layers',
    visits: 'user',
    weekly_report: 'file',
  })[key] || 'activity';
}

async function renderHealthOps() {
  const root = $('tab-health');
  const helpBtn = (key) => (typeof window.AdminV3?.infoButton === 'function' ? window.AdminV3.infoButton(key) : '');
  root.innerHTML = '<div class="ops-page v25-health-page v3-workspace-wide v3-module v3-health">'
    + '<div class="v3-health-toolbar">'
    + '<div class="v3-health-toolbar-copy"><strong>ფუნქციების ობსერვატორია</strong>'
    + '<span>მხოლოდ ჯამები · გაზომვები და ციკლის დეტალები აქ არ ჩანს · თბილისი</span></div>'
    + opsRangeBar()
    + '</div>'
    + '<div id="health-body">' + opsSkeleton(6) + '</div>'
    + '</div>';
  bindOpsRange(renderHealthOps);
  try {
    const [data, retention] = await Promise.all([
      api('/analytics/features?' + opsQs()),
      api('/analytics/feature-retention?' + opsQs()).catch(() => null),
    ]);
    const feature = new URLSearchParams((location.hash || '').split('?')[1] || '').get('feature');
    const usable = (data.features || []).filter((f) => !f.unavailable).sort((a, b) => (b.users || 0) - (a.users || 0));
    const explicit = Boolean(feature && usable.some((f) => f.key === feature));
    const selected = (explicit ? usable.find((f) => f.key === feature) : usable[0]) || null;
    const live = usable.filter((f) => (f.users || 0) > 0).length;
    const maxUsers = Math.max(1, ...usable.map((f) => Number(f.users) || 0));
    const totalEvents = usable.reduce((sum, f) => sum + (Number(f.events) || 0), 0);
    const top = usable[0] || null;

    const kpi = (tone, ico, label, value, hint) =>
      '<article class="v3-health-kpi' + (tone || '') + '">'
      + '<span class="v3-health-kpi-ico" aria-hidden="true">' + opsIco(ico) + '</span>'
      + '<div class="v3-health-kpi-copy"><span>' + label + '</span><strong>' + value + '</strong>'
      + (hint ? '<em>' + hint + '</em>' : '')
      + '</div></article>';

    const kpis = '<div class="v3-health-kpis" role="group" aria-label="ჯანმრთელობის მეტრიკები">'
      + kpi('', 'users', 'აქტიური ანგარიში', opsFmt(data.activeUsers), 'აპის აქტივობა პერიოდში')
      + kpi(' is-ok', 'activity', 'ცოცხალი ფუნქცია', opsFmt(live), opsFmt(usable.length) + ' გაზომვადი')
      + kpi(' is-soft', healthFeatIco(top?.key), 'წამყვანი', top ? opsEscape(top.label) : '—', top ? opsFmt(top.users) + ' მომხმარებელი' : 'აქტივობა არ არის')
      + kpi('', 'zap', 'ქმედებები', opsFmt(totalEvents), 'ყველა ფუნქცია ერთად')
      + kpi(top?.pctOfActive != null ? ' is-amber' : '', 'layers', 'აქტიურებიდან', top?.pctOfActive != null ? Math.min(100, Number(top.pctOfActive)) + '%' : '—', top ? opsEscape(top.label) : '')
      + '</div>';

    const chips = usable.map((f) => {
      const users = Number(f.users) || 0;
      const hint = users === 0
        ? 'ამ პერიოდში არა'
        : (f.pctOfActive == null ? opsFmt(f.events) + ' ქმედება' : Math.min(100, Number(f.pctOfActive)) + '% აქტიურებიდან');
      const href = healthHref(explicit && f.key === feature ? '' : f.key);
      const on = explicit && f.key === feature;
      return '<button type="button" class="v3-health-chip' + (on ? ' is-active' : '') + (users === 0 ? ' is-zero' : '') + '" data-href="' + opsEscape(href) + '">'
        + '<span class="v3-health-chip-ico">' + opsIco(healthFeatIco(f.key)) + '</span>'
        + '<span class="v3-health-chip-copy"><span>' + opsEscape(f.label) + '</span>'
        + '<strong>' + opsFmt(users) + '</strong>'
        + '<em>' + opsEscape(hint) + '</em></span>'
        + '</button>';
    }).join('');

    const chipBlock = '<section class="v3-health-panel" data-v3-health="usage">'
      + '<div class="v3-health-head"><div class="v3-health-head-copy">'
      + '<div class="v3-title-row"><h3>გამოყენება</h3>' + helpBtn('health.usage') + '</div>'
      + '<p class="muted">აირჩიე ფუნქცია ფოკუსისთვის. ხელახალი დაჭერა აშორებს ფილტრს.</p>'
      + '</div></div>'
      + '<div class="v3-health-chips">' + (chips || opsEmpty('ფუნქცია არ არის', 'გაზომვადი ფუნქციები აქ გამოჩნდება.')) + '</div>'
      + '</section>';

    const rankBars = usable.length
      ? '<div class="v3-health-bars">' + usable.map((f, idx) => {
        const value = Number(f.users) || 0;
        const width = value ? Math.max(6, Math.min(100, Math.round((value / maxUsers) * 100))) : 0;
        const share = data.activeUsers ? Math.min(100, Math.round((value / Math.max(1, data.activeUsers)) * 100)) : null;
        const on = selected && f.key === selected.key;
        const href = healthHref(explicit && f.key === feature ? '' : f.key);
        return '<button type="button" class="v3-health-bar' + (on ? ' is-active' : '') + (value === 0 ? ' is-zero' : '') + '" data-href="' + opsEscape(href) + '">'
          + '<span class="v3-health-bar-rank">' + (idx + 1) + '</span>'
          + '<span class="v3-health-bar-ico">' + opsIco(healthFeatIco(f.key)) + '</span>'
          + '<span class="v3-health-bar-main">'
          + '<span class="v3-health-bar-label">' + opsEscape(f.label)
          + (share != null ? '<em>' + share + '% აქტიურებიდან</em>' : '')
          + '</span>'
          + '<span class="v3-health-bar-track"><i style="width:' + width + '%"></i></span>'
          + '</span>'
          + '<strong class="v3-health-bar-val">' + opsFmt(value)
          + '<em>' + opsFmt(f.events) + ' ქმედ.</em></strong>'
          + '</button>';
      }).join('') + '</div>'
      : opsEmpty('ამ პერიოდში აქტივობა არ არის', 'ფუნქციის გამოყენება აქ გამოჩნდება.');

    const rankCard = '<section class="v3-health-panel" data-v3-health="rank">'
      + '<div class="v3-health-head"><div class="v3-health-head-copy">'
      + '<div class="v3-title-row"><h3>შედარება</h3>' + helpBtn('health.usage') + '</div>'
      + '<p class="muted">მომხმარებლები ამ პერიოდში — ყველა გაზომვადი ფუნქცია.</p>'
      + '</div></div>'
      + rankBars
      + '</section>';

    let focusCard;
    if (!selected) {
      focusCard = '<section class="v3-health-panel" data-v3-health="focus">'
        + opsEmpty('ფუნქცია არ არის', 'გაზომვადი ფუნქციები აქ გამოჩნდება.')
        + '</section>';
    } else {
      const title = explicit ? opsEscape(selected.label) : ('წამყვანი · ' + opsEscape(selected.label));
      const pct = selected.pctOfActive == null ? null : Math.min(100, Number(selected.pctOfActive) || 0);
      focusCard = '<section class="v3-health-panel v3-health-focus" data-v3-health="focus">'
        + '<div class="v3-health-head"><div class="v3-health-head-copy">'
        + '<div class="v3-title-row"><h3>' + title + '</h3>' + helpBtn('health.usage') + '</div>'
        + '<p class="muted">' + opsEscape(selected.action || '') + '</p>'
        + '</div>'
        + '<span class="v3-health-focus-mark">' + opsIco(healthFeatIco(selected.key)) + '</span>'
        + '</div>'
        + '<div class="v3-health-focus-stats">'
        + '<div><span>მომხმარებლები</span><strong>' + opsFmt(selected.users) + '</strong></div>'
        + '<div><span>ქმედებები</span><strong>' + opsFmt(selected.events) + '</strong></div>'
        + '<div><span>აქტიურებიდან</span><strong>' + (pct == null ? '—' : pct + '%') + '</strong></div>'
        + '<div><span>წინა პერიოდი</span><strong class="v3-health-delta">' + opsDelta(selected.delta) + '</strong></div>'
        + '</div>'
        + (pct != null
          ? '<div class="v3-health-focus-meter" aria-hidden="true"><span>აქტიურებიდან</span><div class="v3-health-bar-track"><i style="width:' + pct + '%"></i></div><em>' + pct + '%</em></div>'
          : '')
        + (selected.adoption != null ? '<p class="v3-health-foot muted">დაყენებული: ' + opsFmt(selected.adoption) + '</p>' : '')
        + (selected.note ? '<p class="v3-health-foot muted">' + opsEscape(selected.note) + '</p>' : '')
        + '</section>';
    }

    const retMap = retention && retention.features ? retention.features : {};
    const retKeys = [...new Set([
      ...usable.map((f) => f.key).filter((k) => retMap[k]),
      ...Object.keys(retMap),
    ])];
    const retRows = retKeys.map((key) => {
      const row = retMap[key];
      const r7 = opsRate(row.return7Rate);
      const r30 = opsRate(row.return30Rate);
      const bar7 = row.return7Rate && !row.return7Rate.hidden && row.return7Rate.value != null
        ? Math.min(100, Number(row.return7Rate.value) || 0) : 0;
      const bar30 = row.return30Rate && !row.return30Rate.hidden && row.return30Rate.value != null
        ? Math.min(100, Number(row.return30Rate.value) || 0) : 0;
      return '<tr data-href="' + opsEscape(healthHref(key)) + '">'
        + '<td><span class="v3-health-ret-feat">' + opsIco(healthFeatIco(key)) + '<span>' + opsEscape(row.label) + '</span></span></td>'
        + '<td>' + opsFmt(row.once) + '</td>'
        + '<td><span class="v3-health-rate">' + r7 + (bar7 ? '<i style="width:' + bar7 + '%"></i>' : '') + '</span></td>'
        + '<td><span class="v3-health-rate">' + r30 + (bar30 ? '<i style="width:' + bar30 + '%"></i>' : '') + '</span></td>'
        + '</tr>';
    }).join('');

    const retBlock = retKeys.length
      ? '<section class="v3-health-panel" data-v3-health="retention">'
        + '<div class="v3-health-head"><div class="v3-health-head-copy">'
        + '<div class="v3-title-row"><h3>დაბრუნება</h3>' + helpBtn('health.retention') + '</div>'
        + '<p class="muted">ერთხელ გამოიყენა, შემდეგ 7 და 30 დღეში დაბრუნდა. პროცენტები ჩანს მხოლოდ საკმარის ნიმუშზე.</p>'
        + '</div></div>'
        + '<div class="v3-health-table-wrap"><table class="v3-health-table">'
        + '<thead><tr><th>ფუნქცია</th><th>ერთხელ</th><th>7დ</th><th>30დ</th></tr></thead>'
        + '<tbody>' + retRows + '</tbody></table></div></section>'
      : '';

    $('health-body').innerHTML = '<div class="v3-health-body">'
      + kpis
      + chipBlock
      + '<div class="v3-health-split">' + rankCard + focusCard + '</div>'
      + retBlock
      + '</div>';

    document.querySelectorAll('#health-body [data-href]').forEach((btn) => {
      btn.onclick = () => { if (btn.dataset.href) location.hash = btn.dataset.href; };
    });
  } catch (err) {
    $('health-body').innerHTML = opsError(err.message, 'health-retry');
    $('health-retry')?.addEventListener('click', renderHealthOps);
  }
}

async function renderAuditLog() {
  const root = $('tab-audit');
  root.innerHTML = `
    <div class="ops-page v25-audit-page">
      <section class="v25-panel v25-dec-log">
        <div class="card-head">
          ${opsTile('file')}
          <div>
            <h3>${"აუდიტის ჟურნალი"}</h3>
            <p class="muted">${"შაბლონების, პარამეტრების და სტატუსის ცვლილებები. საიდუმლოებები დამალულია."}</p>
          </div>
          <label class="orders-search"><input id="audit-q" type="search" placeholder="${"ადმინი, ქმედება, ობიექტი…"}" /></label>
          <button type="button" class="btn tiny ghost" id="audit-export">CSV</button>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead><tr><th>${"დრო"}</th><th>${"ადმინი"}</th><th>${"ქმედება"}</th><th>${"ობიექტი"}</th><th>${"ცვლილება"}</th></tr></thead>
            <tbody id="audit-body"><tr><td colspan="5">${opsSkeleton(3)}</td></tr></tbody>
          </table>
        </div>
      </section>
    </div>
  `;
  const load = async () => {
    try {
      const q = $('audit-q')?.value.trim();
      const data = await api(`/audit?limit=80${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      const rows = data.entries || [];
      $('audit-body').innerHTML = rows.length
        ? rows.map((row, i) => `
          <tr data-audit="${i}">
            <td>${fmtDateShort(row.createdAt)}</td>
            <td>${opsEscape(row.adminEmail)}</td>
            <td>${opsEscape(row.action)}</td>
            <td>${opsEscape([row.targetType, row.targetId].filter(Boolean).join(' · '))}</td>
            <td class="muted">${opsEscape(summarizeAudit(row))}</td>
          </tr>
        `).join('')
        : `<tr><td colspan="5">${opsEmpty('არჩეულ პერიოდში ადმინისტრაციული ცვლილებები არ დაფიქსირდა', 'შაბლონის, პარამეტრების ან სტატუსის შენახვა აქ გამოჩნდება.')}</td></tr>`;
      $('audit-body').querySelectorAll('tr[data-audit]').forEach((tr) => {
        tr.onclick = () => openAuditDrawer(rows[Number(tr.dataset.audit)]);
      });
    } catch (err) {
      $('audit-body').innerHTML = `<tr><td colspan="5">${opsError(err.message)}</td></tr>`;
    }
  };
  $('audit-q').onkeydown = (e) => { if (e.key === 'Enter') load(); };
  $('audit-export')?.addEventListener('click', () => {
    const q = $('audit-q')?.value.trim() || '';
    opsDownload(`/export/audit${q ? `?q=${encodeURIComponent(q)}` : ''}`, 'audit.csv');
  });
  await load();
}

function compactAuditVal(value) {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'კი' : 'არა';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.length > 42 ? `${value.slice(0, 42)}…` : value;
  if (Array.isArray(value)) return `${value.length} ელემენტი`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return keys.length ? keys.slice(0, 3).join(', ') : '{}';
  }
  return String(value);
}

function summarizeAudit(row) {
  const prev = row.previousValue || {};
  const next = row.newValue || {};
  const keys = [...new Set([...Object.keys(prev), ...Object.keys(next)])].slice(0, 3);
  if (!keys.length) return row.action || '—';
  return keys.map((key) => `${key}: ${compactAuditVal(prev[key])} → ${compactAuditVal(next[key])}`).join(' · ');
}

function openAuditDrawer(row) {
  if (!row || typeof openDrawer !== 'function') return;
  const prev = row.previousValue || {};
  const next = row.newValue || {};
  const keys = [...new Set([...Object.keys(prev), ...Object.keys(next)])];
  const changes = keys.length
    ? keys.map((key) => `<div class="inv-row"><span class="mono">${opsEscape(key)}</span><strong>${opsEscape(compactAuditVal(prev[key]))} → ${opsEscape(compactAuditVal(next[key]))}</strong></div>`).join('')
    : '<p class="muted">ცვლილების დეტალი არ არის.</p>';
  openDrawer(`
    <div class="umodal">
      <header class="umodal-hero">
        <div class="umodal-hero-copy">
          <p class="kicker">აუდიტი</p>
          <h3>${opsEscape(row.action || 'ცვლილება')}</h3>
          <p class="muted">${opsEscape(row.adminEmail || '—')} · ${row.createdAt ? fmtDate(row.createdAt) : '—'}</p>
        </div>
        <button type="button" class="btn icon-only ghost umodal-close" id="drawer-cancel">${icon('x')}</button>
      </header>
      <div class="umodal-body">
        <section class="dec-section">
          <h4>ობიექტი</h4>
          <div class="inv-grid">
            <div class="inv-row"><span>targetType</span><strong>${opsEscape(row.targetType || '—')}</strong></div>
            <div class="inv-row"><span>targetId</span><strong class="mono">${opsEscape(row.targetId || '—')}</strong></div>
          </div>
        </section>
        <section class="dec-section">
          <h4>ცვლილება</h4>
          <div class="inv-grid">${changes}</div>
        </section>
      </div>
    </div>
  `, { modal: true });
  $('drawer-cancel').onclick = closeDrawer;
}

async function renderPushBrainPanel(host) {
  if (!host) return;
  host.innerHTML = opsSkeleton(6);
  try {
    const [data, list] = await Promise.all([
      api('/analytics/notifications?' + opsQs()),
      api('/notifications/decisions?' + opsQs() + opsDecisionFilterQs() + '&limit=40'),
    ]);
    const noDec = !data.syncedDecisions;
    const noOut = !data.syncedOutcomes;
    const f = data.funnel || {};
    const helpBtn = (key) => (typeof window.AdminV3?.infoButton === 'function' ? window.AdminV3.infoButton(key) : '');

    const kpi = (label, value, tone, ico) =>
      `<article class="v3-brain-kpi v25-dec-cell${tone || ''}">`
      + `<span class="v3-brain-kpi-ico" aria-hidden="true">${opsIco(ico)}</span>`
      + `<div class="v3-brain-kpi-copy"><span>${label}</span><strong>${opsFmt(value)}</strong></div>`
      + `</article>`;

    const strip = '<div class="v3-brain-kpis v25-dec-strip" role="group" aria-label="Brain ძაბრის მეტრიკები">'
      + kpi('შეფასებული', f.evaluated, '', 'activity')
      + kpi('დაგეგმილი', f.scheduled, '', 'calendar')
      + kpi('მიწოდება', f.delivered, '', 'bell')
      + kpi('გახსნილი', f.opened, '', 'eye')
      + kpi('ქმედება', f.actioned, ' is-ok', 'check')
      + kpi('დაბლოკილი', f.suppressed, ' is-warn', 'shield')
      + kpi('გაუქმებული', f.cancelled, ' is-muted', 'x')
      + '</div>';

    const note = (!noDec && noOut)
      ? '<div class="v3-brain-note v25-dec-note">' + opsEmpty('ჯერ შედეგები არ არის', 'შედეგების ტელემეტრია ხელმისაწვდომია აპის 24.0.0+ ვერსიიდან.') + '</div>'
      : '';

    const toolbar = '<div class="v3-brain-toolbar">'
      + '<div class="v3-brain-toolbar-copy"><strong>Brain ობსერვატორია</strong><span>პერიოდი · Asia/Tbilisi</span></div>'
      + opsRangeBar()
      + '</div>';

    const log = '<section class="v3-brain-panel v25-panel v25-dec-log" data-v3-brain="decisions">'
      + '<div class="v3-brain-head">'
      + '<div class="v3-brain-head-copy"><div class="v3-title-row"><h3>გადაწყვეტილებები</h3>' + helpBtn('brain.decisions') + '</div>'
      + '<p class="muted">გასუფთავებული კვალი — სათაურები, ტექსტები და ჯანმრთელობის მნიშვნელობები არ არის.</p></div>'
      + '<div class="v3-brain-head-actions">'
      + '<label class="v3-brain-search"><span class="sr-only">ძიება</span><input id="dec-q" placeholder="Decision ID, ოჯახი, მიზეზი…" /></label>'
      + '<button type="button" class="btn compact ghost" id="dec-export">CSV</button>'
      + '</div></div>'
      + '<div class="v3-brain-table-wrap table-wrap"><table class="admin-table v25-dec-table v3-brain-table">'
      + '<thead><tr>'
      + '<th>Decision ID</th><th>მომხმარებელი</th><th>ოჯახი</th><th>ქულა</th><th>შედეგი</th><th>მიზეზი</th><th>დრო</th>'
      + '</tr></thead>'
      + '<tbody id="dec-body">' + decisionRows(list.decisions) + '</tbody>'
      + '</table></div></section>';

    const rates = '<div class="v3-brain-rates v25-dec-rates">'
      + '<div title="' + opsEscape(data.rateDefinitions?.delivery || '') + '"><span>მიწოდება</span><strong>' + opsRate(f.rates?.delivery) + '</strong></div>'
      + '<div title="' + opsEscape(data.rateDefinitions?.open || '') + '"><span>გახსნა</span><strong>' + opsRate(f.rates?.open) + '</strong></div>'
      + '<div title="' + opsEscape(data.rateDefinitions?.action || '') + '"><span>ქმედება</span><strong>' + opsRate(f.rates?.action) + '</strong></div>'
      + '<div title="' + opsEscape(data.rateDefinitions?.directAction || '') + '"><span>პირდაპირი</span><strong>' + opsRate(f.rates?.directAction) + '</strong></div>'
      + '<div title="' + opsEscape(data.rateDefinitions?.suppression || '') + '"><span>დაბლოკვა</span><strong>' + opsRate(f.rates?.suppression) + '</strong></div>'
      + '</div>';

    const funnelCard = '<section class="v3-brain-panel v25-panel v25-dec-funnel-card" data-v3-brain="funnel">'
      + '<div class="v3-brain-head"><div class="v3-brain-head-copy">'
      + '<div class="v3-title-row"><h3>წარმატების ძაბრი</h3>' + helpBtn('brain.funnel') + '</div>'
      + '<p class="muted">' + opsEscape(data.funnelNote || 'შეფასებიდან ქმედებამდე — დაბლოკვა/გაუქმება გვერდითაა.') + '</p>'
      + '</div></div>'
      + opsFunnel([
        { label: 'შეფასებული', value: f.evaluated },
        { label: 'შესაფერისი', value: f.eligible },
        { label: 'დაგეგმილი', value: f.scheduled },
        { label: 'დაკვირვებული მიწოდება', value: f.delivered },
        { label: 'გახსნილი', value: f.opened },
        { label: 'ქმედება', value: f.actioned },
        { label: 'დაბლოკილი', value: f.suppressed, branch: true },
        { label: 'გაუქმებული', value: f.cancelled, branch: true },
      ])
      + rates
      + '<p class="v3-brain-foot muted">მედიანა მიწოდება→გახსნა ' + opsMs(data.latency?.deliveredToOpenedMedianMs)
      + ' · მიწოდება→ქმედება ' + opsMs(data.latency?.deliveredToActionedMedianMs) + '</p>'
      + '</section>';

    const suppressCard = '<section class="v3-brain-panel v25-panel" data-v3-brain="suppress">'
      + '<div class="v3-brain-head"><div class="v3-brain-head-copy">'
      + '<div class="v3-title-row"><h3>რატომ არ გაგზავნა Medi-მ</h3>' + helpBtn('brain.suppression') + '</div>'
      + '<p class="muted">დაბლოკვა წარმატებაა, თუ სიგნალი მოძველდა ან მომხმარებელმა უკვე იმოქმედა.</p>'
      + '</div></div>'
      + opsBarChart((data.suppressions || []).map((row) => ({ htmlLabel: suppressLabel(row.reason), count: row.count })))
      + '</section>';

    const fatigueSample = Math.max(1, Number(data.fatigue?.sampleUsers) || 0);
    const fatDist = data.fatigue?.distribution || {};
    const fatRow = (cls, label, count) => {
      const n = Number(count) || 0;
      const pct = Math.round((n / fatigueSample) * 100);
      return `<div class="v3-fatigue-row ${cls}"><div class="v3-fatigue-meta"><span>${label}</span><strong>${opsFmt(n)}<em>${pct}%</em></strong></div>`
        + `<div class="v3-fatigue-track"><i style="width:${Math.max(n ? 4 : 0, pct)}%"></i></div></div>`;
    };
    const fatigue = '<section class="v3-brain-panel v25-panel" data-v3-brain="fatigue">'
      + '<div class="v3-brain-head"><div class="v3-brain-head-copy">'
      + '<div class="v3-title-row"><h3>დაღლილობა და არჩევანი</h3></div>'
      + '<p class="muted">' + opsEscape(data.fatigue?.note || '')
      + (data.fatigue?.sampleUsers != null ? ' ნიმუში: ' + opsFmt(data.fatigue.sampleUsers) + ' მომხმარებელი.' : '')
      + '</p></div></div>'
      + (data.fatigue?.sampleUsers
        ? '<div class="v3-fatigue v25-fatigue">'
          + fatRow('is-ok', 'ჩვეულებრივი', fatDist.normal)
          + fatRow('is-mid', 'შემცირებული', fatDist.reduced)
          + fatRow('is-hi', 'ძლიერ შემცირებული', fatDist.highlyReduced)
          + '</div><p class="v3-brain-foot muted">არჩეული სიხშირე მომხმარებლის არჩევანია. ადაპტაციური ლიმიტი Medi-ს დროებითი კორექტირებაა.</p>'
        : opsEmpty('დაღლილობის სურათი ჯერ არ არის', 'ლიმიტები მოდის სინქრონიზებულ გადაწყვეტილებებთან.'))
      + '</section>';

    const heat = '<section class="v3-brain-panel v25-panel v25-heat" data-v3-brain="heat">'
      + '<div class="v3-brain-head"><div class="v3-brain-head-copy">'
      + '<div class="v3-title-row"><h3>აქტივობა კვირის დღით და საათით</h3></div>'
      + '<p class="muted">' + opsEscape(data.engagement?.source || '')
      + (data.engagement?.bestHour != null ? ' პიკი: ' + data.engagement.bestHour + ':00 თბილისი.' : '')
      + '</p></div></div>'
      + opsHeatmap(data.engagement?.heatmap)
      + '</section>';

    const outcomeSeries = [
      { points: data.charts?.observedDelivery || [], tone: 'teal', label: 'მიწოდება' },
      { points: data.charts?.opened || [], tone: 'blue', label: 'გახსნა' },
      { points: data.charts?.actioned || [], tone: 'green', label: 'ქმედება' },
    ].filter((s) => s.points.some((d) => d.count > 0));
    const blockSeries = [
      { points: data.charts?.suppressed || [], tone: 'amber', label: 'დაბლოკვა' },
      { points: data.charts?.cancelled || [], tone: 'muted', label: 'გაუქმება' },
    ].filter((s) => s.points.some((d) => d.count > 0));

    const charts = (outcomeSeries.length || blockSeries.length)
      ? '<section class="v3-brain-panel v25-panel v25-dec-charts" data-v3-brain="charts">'
        + '<div class="v3-brain-head"><div class="v3-brain-head-copy">'
        + '<div class="v3-title-row"><h3>დროითი წარმადობა</h3></div>'
        + '<p class="muted">მიწოდება · გახსნა · ქმედება. დაბლოკვა/გაუქმება ცალკე — წარმატების ძაბრში არ შედის.</p>'
        + '</div></div>'
        + '<div class="v3-brain-charts">'
        + (outcomeSeries.length ? opsLineChart(outcomeSeries, { label: 'შედეგები დროში', height: 148 }) : '')
        + (blockSeries.length ? opsLineChart(blockSeries, { label: 'დაბლოკვა და გაუქმება', height: 148 }) : '')
        + '</div></section>'
      : '';

    const familyRows = (data.types || []).length
      ? data.types.map((row) => '<tr data-family="' + opsEscape(row.family) + '" class="users-row">'
        + '<td><strong class="v3-brain-family">' + opsEscape(row.family) + '</strong></td>'
        + '<td>' + opsFmt(row.evaluated) + '</td>'
        + '<td>' + opsFmt(row.delivered) + '</td>'
        + '<td>' + opsFmt(row.opened) + '</td>'
        + '<td>' + opsFmt(row.actioned) + '</td>'
        + '<td>' + opsFmt(row.suppressed) + '</td>'
        + '<td><span class="v25-inlinebar v3-inlinebar"><i style="width:' + Math.max(0, Math.min(100, Number(row.openRate?.value) || 0)) + '%"></i></span> ' + opsRate(row.openRate) + '</td>'
        + '<td><span class="v25-inlinebar v3-inlinebar"><i style="width:' + Math.max(0, Math.min(100, Number(row.actionRate?.value) || 0)) + '%"></i></span> ' + opsRate(row.actionRate) + '</td>'
        + '<td>' + opsRate(row.directActionRate) + '</td>'
        + '</tr>').join('')
      : '<tr><td colspan="9">' + opsEmpty('ამ პერიოდში ოჯახი არ არის', 'კლიენტები 23.0.3-ზე დაბლა Brain-ის გადაწყვეტილებებს არ ასინქრონებენ.') + '</td></tr>';

    const families = '<section class="v3-brain-panel v25-panel v25-dec-families" data-v3-brain="families">'
      + '<div class="v3-brain-head"><div class="v3-brain-head-copy"><div class="v3-title-row"><h3>ოჯახები</h3></div>'
      + '<p class="muted">შეტყობინების ტიპების შედარება — დააწკაპუნე ფილტრზე ლოგში.</p></div></div>'
      + '<div class="v3-brain-table-wrap table-wrap ops-sticky"><table class="admin-table v25-dec-table v3-brain-table">'
      + '<thead><tr>'
      + '<th>ოჯახი</th><th>შეფასებული</th><th>მიწოდებული</th><th>გახსნილი</th><th>ქმედება</th><th>დაბლოკილი</th>'
      + '<th>გახსნა %</th><th>ქმედება %</th><th>პირდაპირი</th>'
      + '</tr></thead><tbody>' + familyRows + '</tbody></table></div></section>';

    const observatory = noDec
      ? '<div class="v3-brain-empty">' + opsEmpty('Brain გადაწყვეტილებები ჯერ არ სინქრონდება', 'კლიენტები 23.0.3+ აქ აგზავნიან კვალს.') + '</div>'
      : '<div class="v3-brain-split v25-dec-main">' + funnelCard + suppressCard + '</div>'
        + ((data.fatigue?.sampleUsers || data.engagement?.heatmap?.length)
          ? '<div class="v3-brain-split v25-dec-side">'
            + (data.fatigue?.sampleUsers ? fatigue : '')
            + (data.engagement?.heatmap?.length ? heat : '')
            + '</div>'
          : '')
        + charts
        + ((data.types || []).length ? families : '');

    host.innerHTML = '<div class="ops-brain v25-brain v25-decisions v3-brain">'
      + toolbar
      + strip
      + note
      + log
      + observatory
      + '</div>';

    if (typeof bindOpsRange === 'function') {
      bindOpsRange(() => renderPushBrainPanel(host));
    }

    host.querySelectorAll('#dec-body tr[data-id]').forEach((tr) => {
      tr.onclick = () => openDecisionDrawer(tr.dataset.id);
    });
    host.querySelectorAll('tr[data-family]').forEach((tr) => {
      tr.onclick = async () => {
        const next = await api(`/notifications/decisions?${opsQs()}&limit=40&family=${encodeURIComponent(tr.dataset.family)}`);
        $('dec-body').innerHTML = decisionRows(next.decisions);
        host.querySelectorAll('#dec-body tr[data-id]').forEach((row) => {
          row.onclick = () => openDecisionDrawer(row.dataset.id);
        });
      };
    });
    host.querySelectorAll('.ops-bar-row').forEach((row) => {
      const reason = row.querySelector('.ops-bar-label')?.textContent;
      if (!reason) return;
      row.style.cursor = 'pointer';
      row.onclick = async () => {
        const next = await api(`/notifications/decisions?${opsQs()}&limit=40&q=${encodeURIComponent(reason)}`);
        $('dec-body').innerHTML = decisionRows(next.decisions);
        host.querySelectorAll('#dec-body tr[data-id]').forEach((tr) => {
          tr.onclick = () => openDecisionDrawer(tr.dataset.id);
        });
      };
    });
    if ($('dec-q') && opsState.decisionFilter) {
      $('dec-q').value = opsState.decisionFilter.reason || opsState.decisionFilter.family || '';
    }
    $('dec-export')?.addEventListener('click', () => opsDownload(`/export/decisions?${opsQs()}`, 'decisions.csv'));
    $('dec-q')?.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      const q = e.target.value.trim();
      const next = await api(`/notifications/decisions?${opsQs()}&limit=40&q=${encodeURIComponent(q)}`);
      $('dec-body').innerHTML = decisionRows(next.decisions);
      host.querySelectorAll('#dec-body tr[data-id]').forEach((tr) => {
        tr.onclick = () => openDecisionDrawer(tr.dataset.id);
      });
    });
  } catch (err) {
    host.innerHTML = opsError(err.message);
  }
}

/* Real-time patch: updates Brain numbers + log in place (no skeleton, no rebuild).
   Called from admin.js on the `brain:sync` socket event. */
async function patchPushBrainLive() {
  const host = document.getElementById('push-brain-host');
  if (!host || !host.querySelector('.v25-dec-strip, .v3-brain-kpis')) return;
  try {
    const [data, list] = await Promise.all([
      api('/analytics/notifications?' + opsQs()),
      api('/notifications/decisions?' + opsQs() + opsDecisionFilterQs() + '&limit=40'),
    ]);
    const f = data.funnel || {};
    const strip = host.querySelector('.v25-dec-strip, .v3-brain-kpis');
    if (strip) {
      const vals = [f.evaluated, f.scheduled, f.delivered, f.opened, f.actioned, f.suppressed, f.cancelled];
      strip.querySelectorAll('.v25-dec-cell strong, .v3-brain-kpi strong').forEach((el, i) => {
        if (i >= vals.length) return;
        const next = opsFmt(vals[i]);
        if (el.textContent !== next) el.textContent = next;
      });
    }
    const rates = host.querySelector('.v25-dec-rates, .v3-brain-rates');
    if (rates) {
      const rvals = [f.rates?.delivery, f.rates?.open, f.rates?.action, f.rates?.directAction, f.rates?.suppression];
      rates.querySelectorAll('strong').forEach((el, i) => {
        if (i < rvals.length) el.textContent = opsRate(rvals[i]);
      });
    }
    // Refresh the log only when the operator isn't mid-search / mid-filter.
    const q = document.getElementById('dec-q');
    const searching = Boolean((q && q.value.trim()) || opsState.decisionFilter);
    const body = document.getElementById('dec-body');
    if (body && !searching) {
      body.innerHTML = decisionRows(list.decisions);
      body.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.onclick = () => openDecisionDrawer(tr.dataset.id);
      });
    }
  } catch {
    /* silent — next socket event retries */
  }
}
window.patchPushBrainLive = patchPushBrainLive;

function decisionRows(rows) {
  if (!rows?.length) return `<tr><td colspan="7">${opsEmpty('ამ პერიოდში შეტყობინების გადაწყვეტილება არ არის.', 'Brain წერს კვალს ტელეფონზე; 23.0.3+ აქ სინქრონდება.')}</td></tr>`;
  return rows.map((row) => `
    <tr data-id="${opsEscape(row.decisionId)}" class="users-row">
      <td class="mono">${opsEscape(row.decisionId)}</td>
      <td>${opsEscape(row.userName || row.userId)}</td>
      <td>${opsEscape(row.family || row.candidate)}</td>
      <td>${opsFmt(row.score)}</td>
      <td><span class="badge result-${opsEscape(row.result || 'unknown')}">${opsEscape(row.result)}</span></td>
      <td title="${opsEscape(row.reason || '')}">${opsEscape(row.reason || '—')}</td>
      <td>${fmtDateShort(row.createdAt)}</td>
    </tr>
  `).join('');
}

function decUnknown(value) {
  return value ? opsEscape(String(value)) : '<span class="unknown">უცნობია</span>';
}

function decLifeLabel(key) {
  return {
    created: 'შეიქმნა',
    evaluated: 'შეფასდა',
    blocked: 'BLOCKED',
    scheduled: 'დაიგეგმა',
    revalidated: 'ხელახლა შემოწმდა',
    delivered: 'დაკვირვებული მიწოდება',
    opened: 'გაიხსნა',
    actioned: 'ქმედება',
    snoozed: 'გადაიდო',
    cancelled: 'CANCELLED',
    cancelled_by_revalidation: 'გაუქმდა ხელახალი გადამოწმებისას',
  }[key] || key;
}

function contextSourceKa(source) {
  if (source === 'notification_outcome') return 'NotificationOutcome';
  if (source === 'nearest_app_activity') return 'უახლოესი AppActivity';
  if (source === 'latest_app_activity_before') return 'ბოლო AppActivity გადაწყვეტილებამდე';
  return 'ამ გადაწყვეტილებასთან შესაბამისი AppActivity/Outcome ჩანაწერი ვერ მოიძებნა.';
}

function filterLabelKa(tag) {
  return {
    quiet_hours: 'მშვიდი საათები',
    cooldown: 'შესვენება',
    daily_cap: 'დღიური ლიმიტი / დაღლილობა',
    recent_activity: 'ბოლო აქტივობა',
    privacy: 'კონფიდენციალურობა',
  }[tag] || tag;
}

function outcomeFlag(outcomes, kind) {
  const hit = (outcomes || []).find((row) => row.outcome === kind);
  return hit ? fmtDate(hit.occurredAt) : 'არ მოხდა';
}

async function openDecisionDrawer(id) {
  try {
    const { decision } = await api(`/notifications/decisions/${encodeURIComponent(id)}`);
    const client = decision.client || {};
    const tel = decision.telemetry || {};
    const outcomes = decision.outcomes || [];
    const life = decision.lifecycle || [];
    const filters = decision.filters || [];
    const platform = client.platform ? ({ ios: 'iOS', android: 'Android', web: 'Web' }[client.platform] || client.platform) : null;
    openDrawer(`
      <div class="umodal dec-inspector">
        <header class="umodal-hero">
          <div class="umodal-hero-copy">
            <p class="kicker">შეტყობინების გადაწყვეტილება</p>
            <h3 class="mono">${opsEscape(decision.decisionId)}</h3>
            <p class="muted">${opsEscape(decision.userName || decision.userId || 'უცნობია')} · ${opsEscape(decision.result || 'უცნობია')}</p>
          </div>
          <button type="button" class="btn icon-only ghost umodal-close" id="drawer-cancel">${icon('x')}</button>
        </header>
        <div class="umodal-body">
          <div class="dec-life">
            ${life.map((step, i) => `<div class="dec-life-step${step.key === 'blocked' || step.key === 'cancelled' ? ' is-block' : ''}"><strong>${opsEscape(decLifeLabel(step.key))}</strong>${step.at ? `<em>${fmtDate(step.at)}</em>` : ''}</div>${i < life.length - 1 ? '<i class="dec-life-arrow" aria-hidden="true">↓</i>' : ''}`).join('')}
          </div>
          <section class="dec-section">
            <h4>გადაწყვეტილება</h4>
            <div class="inv-grid">
              <div class="inv-row"><span>Decision ID</span><strong><button type="button" class="inv-copy" data-copy="${opsEscape(decision.decisionId)}" data-copy-label="Decision ID">${opsEscape(decision.decisionId)}</button></strong></div>
              <div class="inv-row"><span>ოჯახი</span><strong>${decUnknown(decision.family)}</strong></div>
              <div class="inv-row"><span>ქულა</span><strong>${opsFmt(decision.score)}</strong></div>
              <div class="inv-row"><span>შეიქმნა</span><strong>${decision.createdAt ? fmtDate(decision.createdAt) : 'უცნობია'}</strong></div>
              <div class="inv-row"><span>დაიგეგმა</span><strong>${decision.scheduledAt ? fmtDate(decision.scheduledAt) : 'უცნობია'}</strong></div>
            </div>
          </section>
          <section class="dec-section">
            <h4>კლიენტი</h4>
            <div class="inv-grid">
              <div class="inv-row"><span>მომხმარებელი</span><strong><button type="button" class="inv-link" id="dec-open-user">${opsEscape(decision.userName || decision.userId || 'უცნობია')}</button></strong></div>
              <div class="inv-row"><span>User ID</span><strong><button type="button" class="inv-copy" data-copy="${opsEscape(decision.userId || '')}" data-copy-label="User ID">${decUnknown(decision.userId)}</button></strong></div>
              <div class="inv-row"><span>პლატფორმა</span><strong>${platform || '<span class="unknown">უცნობია</span>'}</strong></div>
              <div class="inv-row"><span>აპის ვერსია</span><strong>${decUnknown(client.appVersion)}</strong></div>
              <div class="inv-row"><span>Brain sync</span><strong>${tel.brainSync === true ? 'კი' : tel.brainSync === false ? 'არა' : 'უცნობია'}</strong></div>
              <div class="inv-row"><span>Outcome sync</span><strong>${tel.outcomeSync === true ? 'კი' : tel.outcomeSync === false ? 'არა' : 'უცნობია'}</strong></div>
            </div>
            ${tel.brainSync === false ? '<p class="inv-note">ამ კლიენტის ვერსია Brain-ის სინქრონიზაციას არ უჭერს მხარს.</p>' : ''}
            ${tel.outcomeSync === false ? '<p class="inv-note">ამ კლიენტის ვერსია შედეგების სინქრონიზაციას არ უჭერს მხარს.</p>' : ''}
          </section>
          <section class="dec-section">
            <h4>შეფასება</h4>
            <p><strong>მიზეზები</strong><br>${decUnknown(decision.reason)}</p>
            <p><strong>კანდიდატი</strong> ${decUnknown(decision.candidate)} · <strong>ქულა</strong> ${opsFmt(decision.score)}</p>
          </section>
          <section class="dec-section">
            <h4>ფილტრები</h4>
            <div class="inv-grid">
              <div class="inv-row"><span>მშვიდი საათები</span><strong>${filters.includes('quiet_hours') ? 'დიახ' : 'უცნობია'}</strong></div>
              <div class="inv-row"><span>ბოლო აქტივობა</span><strong>${filters.includes('recent_activity') ? 'დიახ' : 'უცნობია'}</strong></div>
              <div class="inv-row"><span>შესვენება</span><strong>${filters.includes('cooldown') ? 'დიახ' : 'უცნობია'}</strong></div>
              <div class="inv-row"><span>დღიური ლიმიტი</span><strong>${filters.includes('daily_cap') ? 'დიახ' : 'უცნობია'}</strong></div>
              <div class="inv-row"><span>დაღლილობა</span><strong>${filters.includes('daily_cap') ? 'დიახ' : 'უცნობია'}</strong></div>
              <div class="inv-row"><span>კონფიდენციალურობა</span><strong>${filters.includes('privacy') ? 'დიახ' : 'უცნობია'}</strong></div>
            </div>
            ${filters.length ? `<p class="muted">${filters.map(filterLabelKa).map(opsEscape).join(' · ')}</p>` : '<p class="muted">ფილტრის მიზეზი ამ ჩანაწერიდან არ იკითხება.</p>'}
          </section>
          <section class="dec-section">
            <h4>Revalidation</h4>
            <p>დრო: ${decision.revalidatedAt ? fmtDate(decision.revalidatedAt) : 'უცნობია'}<br>
               შედეგი: ${decUnknown(decision.result)}<br>
               მიზეზი: ${decUnknown(decision.reason)}</p>
          </section>
          <section class="dec-section">
            <h4>Outcome</h4>
            <div class="inv-grid">
              <div class="inv-row"><span>delivered</span><strong>${outcomeFlag(outcomes, 'delivered')}</strong></div>
              <div class="inv-row"><span>opened</span><strong>${outcomeFlag(outcomes, 'opened')}</strong></div>
              <div class="inv-row"><span>actioned</span><strong>${outcomeFlag(outcomes, 'actioned')}</strong></div>
              <div class="inv-row"><span>snoozed</span><strong>${outcomeFlag(outcomes, 'snoozed')}</strong></div>
              <div class="inv-row"><span>cancelled</span><strong>${outcomeFlag(outcomes, 'cancelled_by_revalidation')}</strong></div>
            </div>
          </section>
          <section class="dec-section">
            <h4>დანიშნულება</h4>
            <p>შაბლონი: <button type="button" class="inv-copy" data-copy="${opsEscape(decision.templateKey || '')}" data-copy-label="შაბლონი">${decUnknown(decision.templateKey)}</button><br>
               მარშრუტი: <button type="button" class="inv-copy" data-copy="${opsEscape(decision.route || '')}" data-copy-label="მარშრუტი">${decUnknown(decision.route)}</button></p>
          </section>
          <section class="dec-section">
            <h4>კონტექსტი</h4>
            <p>პლატფორმა და ვერსია ამ გადაწყვეტილების სტრიქონზე არ ინახება.<br>${opsEscape(contextSourceKa(client.contextSource))}</p>
          </section>
          <div class="inv-actions">
            <button type="button" class="btn tiny ghost" id="dec-open-user-2">მომხმარებლის გახსნა</button>
            <button type="button" class="btn tiny ghost" id="dec-filter-family">იგივე ოჯახი</button>
            <button type="button" class="btn tiny ghost" id="dec-filter-reason">იგივე მიზეზი</button>
          </div>
        </div>
      </div>
    `, { modal: true, wide: true });
    $('drawer-cancel').onclick = closeDrawer;
    document.querySelectorAll('#drawer-body [data-copy]').forEach((btn) => {
      btn.onclick = () => {
        if (!btn.dataset.copy) return;
        navigator.clipboard?.writeText(btn.dataset.copy);
        if (typeof toast === 'function') toast(`${btn.dataset.copyLabel || 'ID'} დაკოპირდა`);
      };
    });
    const openUser = () => {
      if (!decision.userId) return;
      closeDrawer();
      if (typeof editUser === 'function') editUser(decision.userId, { profileTab: 'notifications' });
    };
    $('dec-open-user')?.addEventListener('click', openUser);
    $('dec-open-user-2')?.addEventListener('click', openUser);
    $('dec-filter-family')?.addEventListener('click', () => applyDecisionFilter({ family: decision.family }));
    $('dec-filter-reason')?.addEventListener('click', () => applyDecisionFilter({ reason: decision.reason }));
  } catch (err) {
    toast(err.message, 'bad');
  }
}

async function renderMediUsage(host) {
  if (!host) return;
  try {
    const data = await api(`/analytics/medi?${opsQs()}`);
    host.innerHTML = `
      <div class="ops-stat-row">
        <div><span>Medi მომხმარებლები</span><strong>${opsFmt(data.kpis?.mediUsers?.value)}</strong></div>
        <div><span>საუბრები</span><strong>${opsFmt(data.kpis?.conversations?.value)}</strong></div>
        <div><span>მოთხოვნები</span><strong>${opsFmt(data.kpis?.messages?.value)}</strong></div>
        <div><span>შეცდომის წილი</span><strong>${data.kpis?.errorRate?.value == null ? '—' : `${data.kpis.errorRate.value}%`}</strong></div>
        <div><span>საშუალო დაყოვნება</span><strong>${data.kpis?.avgLatencyMs?.value == null ? '—' : `${opsFmt(data.kpis.avgLatencyMs.value)} ms`}</strong></div>
        <div><span>ტოკენები</span><strong>${opsFmt(data.kpis?.tokens?.total)}</strong></div>
      </div>
      <p class="muted">${opsEscape(data.kpis?.estimatedCostNote || data.privacy)}</p>
      ${data.charts?.messages?.some((d) => d.count > 0)
        ? opsLineChart([
            { points: data.charts.messages, tone: 'teal' },
            { points: data.charts.errors, tone: 'ink' },
          ], { label: 'Medi მოთხოვნები და შეცდომები' })
        : opsEmpty('ამ პერიოდში Medi არ გამოიყენეს', 'ეს რეალური AI გამოძახებებია, არა ნიმუში.')}
    `;
  } catch (err) {
    host.innerHTML = opsError(err.message);
  }
}

async function opsDownload(path, filename) {
  const token = (typeof state !== 'undefined' && state.token) || localStorage.getItem('medicard.admin.token');
  const res = await fetch(`/api/admin${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) throw new Error('ექსპორტი ვერ ჩაიტვირთა');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function renderQualityOps() {
  const root = $('tab-quality');
  if (!root) return;
  root.innerHTML = `
    <div class="ops-page">
      <header class="ops-head">
        <p class="muted">ოპერაციული დიაგნოსტიკა — ვერსია, ტელემეტრია, ნებართვა, ანალიტიკის მთლიანობა.</p>
        ${opsRangeBar()}
      </header>
      <div id="quality-body">${opsSkeleton(6)}</div>
    </div>
  `;
  bindOpsRange(renderQualityOps);
  try {
    const [quality, versions, permissions, extra] = await Promise.all([
      api('/analytics/quality'),
      api(`/analytics/versions?${opsQs()}`),
      api('/analytics/permissions'),
      api(`/analytics/outcomes-extra?${opsQs()}`),
    ]);
    const issue = (label, count, href, sev = 'neutral') => `
      <button type="button" class="ops-issue ${sev}" data-href="${opsEscape(href || '#/quality')}">
        <span>${label}</span><strong>${opsFmt(count)}</strong>
        <em>ნახვა</em>
      </button>`;
    const coverage = (label, value) => `<div><span>${label}</span><strong>${value == null ? '—' : `${value}%`}</strong></div>`;
    $('quality-body').innerHTML = `
      <div class="v25-quality">
      <div class="v25-strip v25-strip-n4">
        ${opsStripCell('layers', "ვერსიის დაფარვა", versions.activeUsers ? Math.round(100 * ((versions.activeUsers - (versions.missingVersion || 0)) / versions.activeUsers)) + '%' : '\u2014', '')}
        ${opsStripCell('activity', "ტელემეტრიის დაფარვა", versions.belowOutcomeSync?.rate?.hidden ? '\u2014' : (versions.belowOutcomeSync?.rate?.value == null ? '\u2014' : Math.max(0, 100 - versions.belowOutcomeSync.rate.value) + '%'), '')}
        ${opsStripCell('bell', "ნებართვის დაფარვა", permissions.enabledRate?.hidden ? '\u2014' : (permissions.enabledRate?.value == null ? '\u2014' : permissions.enabledRate.value + '%'), '')}
        ${opsStripCell('shield', "ვერსიის დაფარვა", quality.versionCoverageRate != null ? `${quality.versionCoverageRate}%` : (quality.activeUsersSampled ? Math.round(100 - (100 * (quality.usersMissingAppVersion || 0) / Math.max(1, quality.activeUsersSampled))) + '%' : '\u2014'), quality.usersMissingAppVersion ? `${quality.usersMissingAppVersion} აკლია ვერსია` : '')}
      </div>
      <section class="v25-policy">
        <div><span>${"რეკომენდებული"}</span><strong class="mono">${opsEscape(versions.policy?.currentRecommendedVersion || '—')}</strong></div>
        <div><span>${"მინ. Brain sync"}</span><strong class="mono">${opsEscape(versions.policy?.minimumBrainSyncVersion || '23.0.3')}</strong></div>
        <div><span>${"მინ. Outcome sync"}</span><strong class="mono">${opsEscape(versions.policy?.minimumOutcomeSyncVersion || '24.0.0')}</strong></div>
        <div><span>${"მინ. მხარდაჭერილი"}</span><strong class="mono">${opsEscape(versions.policy?.minimumSupportedVersion || '—')}</strong></div>
        <div><span>${"Force update"}</span><strong class="mono">${opsEscape(versions.policy?.forceUpdateVersion || 'off')}</strong></div>
      </section>
      <section class="v25-panel v25-quality-issues">
        <div class="card-head">${opsTile('alert')}<div><h3>${"ოპერაციული დიაგნოსტიკა"}</h3></div></div>
        <div class="v25-quality-groups">
          <div class="v25-quality-group">
            <h4>${"მონაცემები"}</h4>
            ${issue('ვერსია არ არის', quality.usersMissingAppVersion, '#/users', quality.usersMissingAppVersion > 0 ? 'warning' : 'neutral')}
          ${issue('პლატფორმა არ არის', quality.usersMissingPlatform, '#/users', quality.usersMissingPlatform > 0 ? 'warning' : 'neutral')}
          ${issue('orphan outcomes', quality.orphanOutcomes, '#/push', quality.orphanOutcomes >= 10 ? 'warning' : 'neutral')}
          ${issue('დუბლიკატი ID', quality.duplicateDecisionIds, '#/push', quality.duplicateDecisionIds > 0 ? 'warning' : 'neutral')}
          </div>
          <div class="v25-quality-group">
            <h4>${"შეტყობინებები"}</h4>
            ${issue('არასწორი route', quality.invalidRoutes, '#/push', quality.invalidRoutes > 0 ? 'warning' : 'neutral')}
          ${issue('უცნობი action', quality.unknownActionKeys, '#/push', quality.unknownActionKeys > 0 ? 'warning' : 'neutral')}
          ${issue('რევალიდაცია არ არის', quality.decisionsMissingRevalidation, '#/push')}
          </div>
          <div class="v25-quality-group">
            <h4>${"კლიენტები"}</h4>
            ${issue(`${versions.policy?.minimumOutcomeSyncVersion || '24.0.0'}-ზე დაბლა`, versions.belowOutcomeSync?.users, '#/users?activity=outdated', versions.belowOutcomeSync?.rate?.value >= 15 ? 'warning' : 'neutral')}
          ${issue(`${versions.policy?.minimumBrainSyncVersion || '23.0.3'}-ზე დაბლა`, versions.belowBrainSync?.users, '#/users?activity=outdated', versions.belowBrainSync?.rate?.value >= 15 ? 'warning' : 'neutral')}
          </div>
        </div>
      </section>
      <section class="v25-panel">
        <div class="card-head">${opsTile('layers')}<div><h3>${"ვერსიები"}</h3></div></div>
        <div class="v25-quality-versions">
          <p class="muted">${opsEscape(versions.definition || '')}</p>
          ${opsBarChart((versions.versions || []).map((row) => ({ label: row.version, count: row.users, href: `#/users?appVersion=${encodeURIComponent(row.version)}` })))}
          <p class="muted">iOS ${opsFmt(versions.platformUsers?.ios)} · Android ${opsFmt(versions.platformUsers?.android)} · უცნობი ${opsFmt(versions.platformUsers?.unknown)}</p>
        </div>
      </section>
      <section class="v25-panel v25-quality-extra">
        <div class="card-head">${opsTile('bell')}<div><h3>${"ნებართვა"}</h3></div></div>
      <div class="v25-strip v25-strip-n4">
        ${opsStripCell('bell', "ჩართული", opsFmt(permissions.enabled), '')}${opsStripCell('x', "გამორთული", opsFmt(permissions.disabled), '')}${opsStripCell('shield', "შეზღუდული", opsFmt(permissions.provisional), '')}${opsStripCell('users', "უცნობი", opsFmt(permissions.unknown), '')}
      </div>
      </section>
      <section class="v25-panel v25-quality-extra">
        <div class="card-head">${opsTile('file')}<div><h3>${"კვირა / ინსაითი / მედიკამენტი"}</h3></div></div>
      <div class="v25-strip v25-strip-n7">
        ${opsStripCell('file', "ანგარიში შეიქმნა", opsFmt(extra.weekly?.generated), '')}${opsStripCell('bell', "Brain weekly", opsFmt(extra.weekly?.sent), '')}${opsStripCell('check', "ანგარიში გაიხსნა", opsFmt(extra.weekly?.opened), '')}${opsStripCell('activity', "გახსნის წილი", opsRate(extra.weekly?.openRate), '')}${opsStripCell('layers', "ინსაითი", opsFmt(extra.insights?.generated), '')}${opsStripCell('pill', "მიღება ნოტიფით", opsFmt(extra.medications?.takenViaNotification), '')}${opsStripCell('users', "მიღება აპში", opsFmt(extra.medications?.takenInApp), '')}
      </div>
      </section>
      </div>
    `;
    document.querySelectorAll('#quality-body [data-go], #quality-body [data-href]').forEach((btn) => {
      btn.onclick = () => {
        if (btn.dataset.href) location.hash = btn.dataset.href;
        else if (btn.dataset.go) switchTab(btn.dataset.go);
      };
    });
  } catch (err) {
    $('quality-body').innerHTML = opsError(err.message, 'quality-retry');
    $('quality-retry')?.addEventListener('click', renderQualityOps);
  }
}

function renderCommandPalette() {
  if ($('ops-palette')) {
    $('ops-palette-q')?.focus();
    return;
  }
  const sections = [
    { tab: 'overview', label: 'ოპერაციები' },
    { tab: 'users', label: 'მომხმარებლები' },
    { tab: 'ai', label: 'Medi' },
    { tab: 'health', label: 'ჯანმრთელობა' },
    { tab: 'push', label: 'შეტყობინებები / Push' },
    { tab: 'quality', label: 'ხარისხი / სისტემა' },
    { tab: 'push', label: 'Brain' },
    { tab: 'audit', label: 'აუდიტი' },
    { tab: 'orders', label: 'შეკვეთები' },
    { tab: 'rewards', label: 'ჯილდოები' },
    { tab: 'packages', label: 'პაკეტები' },
    { tab: 'sms', label: 'SMS' },
    { tab: 'pharmacy', label: 'ფარმაცია' },
    { tab: 'settings', label: 'აპის რეჟიმი' },
  ];
  document.body.insertAdjacentHTML('beforeend', `
    <div id="ops-palette" class="ops-palette" role="dialog" aria-modal="true" aria-label="გადასვლა">
      <div class="ops-palette-scrim" id="ops-palette-scrim"></div>
      <div class="ops-palette-panel">
        <input id="ops-palette-q" type="search" placeholder="მომხმარებელი, შაბლონი, გადაწყვეტილება, სექცია…" autocomplete="off" />
        <div id="ops-palette-list" class="ops-palette-list">
          ${window.AdminV3?.renderPaletteList ? window.AdminV3.renderPaletteList('') : sections.map((s) => `<button type="button" data-tab="${s.tab}">${opsEscape(s.label)}</button>`).join('')}
        </div>
      </div>
    </div>
  `);
  const bindPaletteNav = (root) => {
    root.querySelectorAll('button[data-v3-help]').forEach((btn) => {
      btn.onclick = () => {
        close();
        window.AdminV3?.openHelp?.(btn.getAttribute('data-v3-help'), btn);
      };
    });
    root.querySelectorAll('button[data-hash]').forEach((btn) => {
      btn.onclick = () => {
        close();
        location.hash = btn.getAttribute('data-hash');
      };
    });
    root.querySelectorAll('button[data-tab]:not([data-hash]):not([data-v3-help])').forEach((btn) => {
      btn.onclick = () => { close(); switchTab(btn.dataset.tab); };
    });
    root.querySelectorAll('[data-user]').forEach((btn) => { btn.onclick = () => { close(); editUser(btn.dataset.user); }; });
    root.querySelectorAll('[data-decision]').forEach((btn) => {
      btn.onclick = () => { close(); location.hash = '#/push?tab=brain'; openDecisionDrawer(btn.dataset.decision); };
    });
  };
  const close = () => $('ops-palette')?.remove();
  $('ops-palette-scrim').onclick = close;
  $('ops-palette-q').focus();
  bindPaletteNav($('ops-palette-list'));
  $('ops-palette-q').oninput = async () => {
    const q = $('ops-palette-q').value.trim();
    const list = $('ops-palette-list');
    const navHtml = window.AdminV3?.renderPaletteList
      ? window.AdminV3.renderPaletteList(q)
      : sections.filter((s) => `${s.label} ${s.group || ''}`.toLowerCase().includes(q.toLowerCase()))
        .map((s) => `<button type="button" data-tab="${s.tab}">${opsEscape(s.label)}</button>`).join('');
    let extra = '';
    if (q.startsWith('notif_dec_')) {
      extra += `<button type="button" data-decision="${opsEscape(q)}">გადაწყვეტილება ${opsEscape(q)}</button>`;
    }
    if (q.length >= 2 && !q.startsWith('notif_dec_')) {
      try {
        const data = await api(`/users?q=${encodeURIComponent(q)}&limit=8`);
        extra += (data.users || []).map((u) => `<button type="button" data-user="${u.id}">${opsEscape(u.fullName)} · ${opsEscape(u.email)}</button>`).join('');
      } catch { /* keep nav */ }
    }
    list.innerHTML = `${navHtml}${extra}` || '<p class="muted">არაფერი მოიძებნა.</p>';
    bindPaletteNav(list);
  };
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

function patchOpsLive(snap) {
  if (!snap) return;
  window.__opsLiveSnap = snap;
  const setKpi = (key, value) => {
    if (value == null) return;
    document.querySelectorAll(`[data-ops-kpi="${key}"]`).forEach((card) => {
      const el = card.matches('strong') ? card : card.querySelector('strong');
      if (!el) return;
      const next = opsFmt(value);
      if (el.textContent === next) return;
      el.textContent = next;
      el.classList.add('is-live-tick');
      card.classList?.add('is-live-tick');
      setTimeout(() => {
        el.classList.remove('is-live-tick');
        card.classList?.remove('is-live-tick');
      }, 700);
    });
  };
  setKpi('onlineNow', snap.onlineNow);
  setKpi('activeToday', snap.activeToday);
  setKpi('newUsersToday', snap.newUsersToday);
  if (opsState.range === 'today') setKpi('newUsers', snap.newUsersToday);
  const at = $('ops-live-at');
  if (at && snap.refreshedAt) {
    at.textContent = typeof fmtDate === 'function' ? fmtDate(snap.refreshedAt) : snap.refreshedAt;
  }
  const onlineCard = document.querySelector('[data-ops-kpi="onlineNow"]');
  if (onlineCard) {
    onlineCard.classList.toggle('is-empty', !(Number(snap.onlineNow) > 0));
  }
}

window.patchOpsLive = patchOpsLive;
window.renderCommandCenter = renderCommandCenter;
window.renderHealthOps = renderHealthOps;
window.renderAuditLog = renderAuditLog;
window.renderPushBrainPanel = renderPushBrainPanel;
window.renderMediUsage = renderMediUsage;
window.renderCommandPalette = renderCommandPalette;
window.openDecisionDrawer = openDecisionDrawer;
