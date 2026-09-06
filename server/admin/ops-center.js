/* MediCard Operations & Intelligence — real-data dashboards. No sample metrics. */
const _opsHashRange = new URLSearchParams((location.hash || '').split('?')[1] || '');
const opsState = {
  range: _opsHashRange.get('range') || sessionStorage.getItem('medicard.admin.range') || '7d',
  from: _opsHashRange.get('from') || sessionStorage.getItem('medicard.admin.rangeFrom') || '',
  to: _opsHashRange.get('to') || sessionStorage.getItem('medicard.admin.rangeTo') || '',
  grain: 'dau',
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
  const tab = (location.hash || '#/overview').replace(/^#\/?/, '').split('?')[0] || 'overview';
  const params = new URLSearchParams((location.hash || '').split('?')[1] || '');
  params.set('range', opsState.range);
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

function opsLineChart(seriesList, { label = 'ტრენდი', height = 220 } = {}) {
  const lists = (seriesList || []).filter((s) => s.points?.length);
  if (!lists.length) return '<div class="ops-empty"><strong>ამ პერიოდში მონაცემი არ არის.</strong></div>';
  const w = 720;
  const h = height;
  const padX = 40;
  const padY = 22;
  const n = Math.max(...lists.map((s) => s.points.length));
  const max = Math.max(1, ...lists.flatMap((s) => s.points.map((d) => d.count)));
  const step = n > 1 ? (w - padX * 2) / (n - 1) : 0;
  const grid = [0.25, 0.5, 0.75].map((p) => {
    const y = h - padY - p * (h - padY * 2);
    return `<line class="ops-gridline" x1="${padX}" x2="${w - 16}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" />`;
  }).join('');
  const paths = lists.map((s, idx) => {
    const line = s.points.map((d, i) => {
      const x = padX + i * step;
      const y = h - padY - (d.count / max) * (h - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const tone = s.tone || (idx === 0 ? 'teal' : 'ink');
    return `<polyline class="ops-line tone-${tone}" points="${line}" fill="none" stroke="currentColor" stroke-width="${idx === 0 ? 1.7 : 1.2}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  const ticks = lists[0].points.filter((_, i) => i === 0 || i === n - 1 || i === Math.floor(n / 2));
  const labels = ticks.map((d) => {
    const i = lists[0].points.indexOf(d);
    const x = padX + i * step;
    return `<text x="${x.toFixed(1)}" y="${h - 4}" class="ops-axis">${opsEscape(String(d.day).slice(5))}</text>`;
  }).join('');
  const hits = lists[0].points.map((d, i) => {
    const x = padX + i * step;
    const y = h - padY - (d.count / max) * (h - padY * 2);
    const prev = lists[1]?.points?.[i];
    const tip = prev
      ? `${d.day}: ${d.count} · წინა ${prev.count}`
      : `${d.day}: ${d.count}`;
    return `<circle class="ops-hit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"><title>${opsEscape(tip)}</title></circle>`;
  }).join('');
  return `<svg class="ops-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${opsEscape(label)}">${grid}${paths}${hits}${labels}<text x="${padX}" y="12" class="ops-axis">${opsFmt(max)}</text></svg>`;
}

function opsBarChart(items, { valueKey = 'count', labelKey = 'label' } = {}) {
  const rows = (items || []).filter((row) => !row.unavailable && Number(row[valueKey]) > 0);
  if (!rows.length) return '<div class="ops-empty">ამ პერიოდში აქტივობა არ არის.</div>';
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));
  return `<div class="ops-bars">${rows.map((row) => {
    const value = Number(row[valueKey]) || 0;
    const href = row.href
      ? ` data-go="${opsEscape(row.href.replace(/^#\/?/, '').split('?')[0])}" data-href="${opsEscape(row.href)}"`
      : '';
    const tag = row.href ? 'button type="button"' : 'div';
    const close = row.href ? 'button' : 'div';
    return `<${tag} class="ops-bar-row"${href}>
      <span class="ops-bar-label">${row.htmlLabel || opsEscape(row[labelKey] || row.key)}</span>
      <span class="ops-bar-track"><span style="width:${Math.max(4, Math.round((value / max) * 100))}%"></span></span>
      <strong>${opsFmt(value)}</strong>
    </${close}>`;
  }).join('')}</div>`;
}

function opsFunnel(steps) {
  const rows = (steps || []).filter((s) => s.value != null);
  if (!rows.length) return '<div class="ops-empty"><strong>ამ პერიოდში ძაბრის მდგომარეობა არ არის.</strong></div>';
  const max = Math.max(1, ...rows.map((s) => Number(s.value) || 0));
  return `<ol class="ops-funnel v25-funnel">${rows.map((s) => `
    <li class="${s.branch ? 'is-branch' : 'is-main'}">
      <div class="ops-funnel-meta"><span>${opsEscape(s.label)}</span><strong>${opsFmt(s.value)}</strong></div>
      <div class="ops-funnel-track"><span style="width:${Math.max(6, Math.round((Number(s.value) / max) * 100))}%"></span></div>
      ${s.note ? `<p class="muted">${opsEscape(s.note)}</p>` : ''}
    </li>
  `).join('')}</ol>`;
}

function opsHeatmap(grid) {
  if (!grid?.length) return '<div class="ops-empty">ამ პერიოდში აპის გახსნის დრო არ არის.</div>';
  const flat = grid.flat();
  const max = Math.max(1, ...flat);
  const days = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
  return `<div class="ops-heat">
    <div class="ops-heat-hours">${Array.from({ length: 24 }, (_, h) => `<span>${h}</span>`).join('')}</div>
    ${grid.map((row, d) => `<div class="ops-heat-row"><span>${days[d]}</span>${row.map((n, h) => {
      const t = n / max;
      const level = n === 0 ? 0 : t > 0.66 ? 3 : t > 0.33 ? 2 : 1;
      return `<i class="lv-${level}" title="${days[d]} ${h}:00 · ${n}"></i>`;
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

function opsRangeBar() {
  const presets = [
    ['today', 'დღეს'],
    ['7d', '7 დღე'],
    ['30d', '30 დღე'],
    ['90d', '90 დღე'],
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
    `<span id="ops-live-clock">ბოლო განახლება <time id="ops-live-at">${opsEscape(new Date(meta.refreshedAt).toLocaleString('ka-GE'))}</time></span>`,
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
    <div class="card-head">${opsTile('activity')}<div><h3>სისტემა</h3><p class="muted">ბოლო შემოწმება ${sys.refreshedAt ? new Date(sys.refreshedAt).toLocaleString('ka-GE') : '—'}</p></div>
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
  root.innerHTML = [
    '<div class="ops-page v25-health-page">',
    '<header class="ops-head"><div>',
    '<p class="kicker">ჯანმრთელობა</p>',
    '  <h3>ფუნქციების აქტივობა</h3>',
    '<p class="muted">მხოლოდ ჯამები. გაზომვები, ციკლის დეტალები და ჩანაწერები აქ არ ჩანს.</p>',
    '</div>',
    opsRangeBar(),
    '</header>',
    '<div id="health-body">' + opsSkeleton(6) + '</div>',
    '</div>',
  ].join('');
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

    const chips = usable.map((f) => {
      const users = Number(f.users) || 0;
      const hint = users === 0
        ? 'ამ პერიოდში არა'
        : (f.pctOfActive == null ? opsFmt(f.events) + ' ქმედება' : f.pctOfActive + '% აქტიურებიდან');
      const href = healthHref(explicit && f.key === feature ? '' : f.key);
      return '<button type="button" class="v25-health-chip' + (explicit && f.key === feature ? ' is-active' : '') + '" data-href="' + opsEscape(href) + '">'
        + '<span class="v25-health-chip-top"><span class="v25-health-ico">' + opsIco(healthFeatIco(f.key)) + '</span><span>' + opsEscape(f.label) + '</span></span>'
        + '<strong>' + opsFmt(users) + '</strong>'
        + '<em>' + opsEscape(hint) + '</em>'
        + '</button>';
    }).join('');

    const rank = usable.length
      ? '<div class="v25-health-bars">' + usable.map((f) => {
        const value = Number(f.users) || 0;
        const width = value ? Math.max(8, Math.round((value / maxUsers) * 100)) : 0;
        const on = selected && f.key === selected.key;
        const href = healthHref(explicit && f.key === feature ? '' : f.key);
        return '<button type="button" class="v25-health-bar' + (on ? ' is-active' : '') + (value === 0 ? ' is-zero' : '') + '" data-href="' + opsEscape(href) + '">'
          + '<span class="v25-health-bar-ico">' + opsIco(healthFeatIco(f.key)) + '</span>'
          + '<span class="v25-health-bar-label">' + opsEscape(f.label) + '</span>'
          + '<span class="v25-health-bar-track"><i style="width:' + width + '%"></i></span>'
          + '<strong>' + opsFmt(value) + '</strong>'
          + '</button>';
      }).join('') + '</div>'
      : opsEmpty('ამ პერიოდში აქტივობა არ არის', 'ფუნქციის გამოყენება აქ გამოჩნდება.');

    let focus;
    if (!selected) {
      focus = opsEmpty('ფუნქცია არ არის', 'გაზომვადი ფუნქციები აქ გამოჩნდება.');
    } else {
      const title = explicit ? opsEscape(selected.label) : ('წამყვანი · ' + opsEscape(selected.label));
      focus = '<section class="v25-panel v25-health-focus">'
        + '<div class="card-head">' + opsTile(healthFeatIco(selected.key), selected.users ? 'teal' : '') + '<div>'
        + '<h3>' + title + '</h3>'
        + '<p class="muted">' + opsEscape(selected.action || '') + '</p>'
        + '</div></div>'
        + '<div class="v25-health-focus-stats">'
        + '<div><span>მომხმარებლები</span><strong>' + opsFmt(selected.users) + '</strong></div>'
        + '<div><span>ქმედებები</span><strong>' + opsFmt(selected.events) + '</strong></div>'
        + '<div><span>აქტიურებიდან</span><strong>' + (selected.pctOfActive == null ? '—' : selected.pctOfActive + '%') + '</strong></div>'
        + '<div><span>წინა პერიოდი</span>' + opsDelta(selected.delta) + '</div>'
        + '</div>'
        + (selected.adoption != null ? '<p class="muted">დაყენებული: ' + opsFmt(selected.adoption) + '</p>' : '')
        + (selected.note ? '<p class="muted">' + opsEscape(selected.note) + '</p>' : '')
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
      const bar7 = row.return7Rate && !row.return7Rate.hidden && row.return7Rate.value != null ? row.return7Rate.value : 0;
      const bar30 = row.return30Rate && !row.return30Rate.hidden && row.return30Rate.value != null ? row.return30Rate.value : 0;
      return '<tr>'
        + '<td><span class="v25-health-ret-feat">' + opsIco(healthFeatIco(key)) + '<span>' + opsEscape(row.label) + '</span></span></td>'
        + '<td>' + opsFmt(row.once) + '</td>'
        + '<td><span class="v25-health-rate">' + r7 + (bar7 ? '<i style="width:' + bar7 + '%"></i>' : '') + '</span></td>'
        + '<td><span class="v25-health-rate">' + r30 + (bar30 ? '<i style="width:' + bar30 + '%"></i>' : '') + '</span></td>'
        + '</tr>';
    }).join('');

    const retBlock = retKeys.length
      ? '<section class="v25-panel v25-health-return">'
        + '<div class="card-head">' + opsTile('refresh') + '<div>'
        + '  <h3>დაბრუნება</h3>'
        + '<p class="muted">ერთხელ გამოიყენა, შემდეგ 7 და 30 დღეში დაბრუნდა. 7დ / 30დ ჩანს მხოლოდ საკმარის ნიმუშზე.</p>'
        + '</div></div>'
        + '<table class="v25-health-ret"><thead><tr><th>ფუნქცია</th><th>ერთხელ</th><th>7დ</th><th>30დ</th></tr></thead>'
        + '<tbody>' + retRows + '</tbody></table></section>'
      : '';

    const healthMeta = data.activeUsers
      ? opsFmt(data.activeUsers) + ' აქტიური ანგარიში · ' + opsFmt(live) + ' ფუნქცია ამ პერიოდში'
      : opsFmt(live) + ' ფუნქცია ამ პერიოდში';
    $('health-body').innerHTML = '<div class="v25-health">'
      + '<p class="v25-health-meta">' + healthMeta + '</p>'
      + '<div class="v25-health-adopt">' + chips + '</div>'
      + '<div class="v25-health-main">'
      + '<section class="v25-panel v25-health-rank">'
      + '<div class="card-head">' + opsTile('activity') + '<div><h3>შედარება</h3><p class="muted">მომხმარებლები ამ პერიოდში, ყველა გაზომვადი ფუნქცია.</p></div></div>'
      + rank
      + '</section>'
      + focus
      + '</div>'
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
  host.innerHTML = opsSkeleton();
  try {
    const [data, list] = await Promise.all([
      api('/analytics/notifications?' + opsQs()),
      api('/notifications/decisions?' + opsQs() + opsDecisionFilterQs() + '&limit=40'),
    ]);
    const noDec = !data.syncedDecisions;
    const noOut = !data.syncedOutcomes;
    const f = data.funnel || {};
    const cell = (label, value, extra) =>
      '<div class="v25-dec-cell' + (extra || '') + '"><span>' + label + '</span><strong>' + opsFmt(value) + '</strong></div>';
    const strip = '<div class="v25-dec-strip">'
      + cell("შეფასებული", f.evaluated)
      + cell("დაგეგმილი", f.scheduled)
      + cell("მიწოდება", f.delivered)
      + cell("გახსნილი", f.opened)
      + cell("ქმედება", f.actioned)
      + cell("დაბლოკილი", f.suppressed, ' is-warn')
      + cell("გაუქმებული", f.cancelled, ' is-muted')
      + '</div>';
    const note = (!noDec && noOut)
      ? '<div class="v25-dec-note">' + opsEmpty("ჯერ შედეგები არ არის", "შედეგების ტელემეტრია ხელმისაწვდომია აპის 24.0.0+ ვერსიიდან.") + '</div>'
      : '';
    const log = '<section class="v25-panel v25-dec-log">'
      + '<div class="card-head">' + opsTile('file') + '<div>'
      + '<h3>' + "გადაწყვეტილებები" + '</h3>'
      + '<p class="muted">' + "გასუფთავებული კვალი. სათაურები, ტექსტები და ჯანმრთელობის მნიშვნელობები არ არის." + '</p>'
      + '</div>'
      + '<label class="orders-search"><input id="dec-q" placeholder="' + "გადაწყვეტილების ID, ოჯახი, მიზეზი…" + '" /></label>'
      + '<button type="button" class="btn tiny ghost" id="dec-export">CSV</button>'
      + '</div>'
      + '<div class="table-wrap"><table class="admin-table v25-dec-table">'
      + '<thead><tr>'
      + '<th>' + "Decision ID" + '</th>'
      + '<th>' + "მომხმარებელი" + '</th>'
      + '<th>' + "ოჯახი" + '</th>'
      + '<th>' + "ქულა" + '</th>'
      + '<th>' + "შედეგი" + '</th>'
      + '<th>' + "მიზეზი" + '</th>'
      + '<th>' + "დრო" + '</th>'
      + '</tr></thead>'
      + '<tbody id="dec-body">' + decisionRows(list.decisions) + '</tbody>'
      + '</table></div></section>';
    const rates = '<div class="v25-dec-rates">'
      + '<div title="' + opsEscape(data.rateDefinitions?.delivery || '') + '"><span>' + "მიწოდება" + '</span><strong>' + opsRate(f.rates?.delivery) + '</strong></div>'
      + '<div title="' + opsEscape(data.rateDefinitions?.open || '') + '"><span>' + "გახსნა" + '</span><strong>' + opsRate(f.rates?.open) + '</strong></div>'
      + '<div title="' + opsEscape(data.rateDefinitions?.action || '') + '"><span>' + "ქმედება" + '</span><strong>' + opsRate(f.rates?.action) + '</strong></div>'
      + '<div title="' + opsEscape(data.rateDefinitions?.directAction || '') + '"><span>' + "პირდაპირი" + '</span><strong>' + opsRate(f.rates?.directAction) + '</strong></div>'
      + '<div title="' + opsEscape(data.rateDefinitions?.suppression || '') + '"><span>' + "დაბლოკვა" + '</span><strong>' + opsRate(f.rates?.suppression) + '</strong></div>'
      + '</div>';
    const funnelCard = '<section class="v25-panel v25-dec-funnel-card">'
      + '<div class="card-head">' + opsTile('activity') + '<div>'
      + '<h3>' + "წარმატების ძაბრი" + '</h3>'
      + '<p class="muted">' + opsEscape(data.funnelNote || '') + '</p>'
      + '</div></div>'
      + opsFunnel([
        { label: "შეფასებული", value: f.evaluated },
        { label: "შესაფერისი", value: f.eligible },
        { label: "დაგეგმილი", value: f.scheduled },
        { label: "დაკვირვებული მიწოდება", value: f.delivered },
        { label: "გახსნილი", value: f.opened },
        { label: "ქმედება", value: f.actioned },
        { label: "დაბლოკილი", value: f.suppressed, branch: true },
        { label: "გაუქმებული", value: f.cancelled, branch: true },
      ])
      + '<p class="muted">' + "დაბლოკილი და გაუქმებული ძირითად გზას გარეთაა. პირდაპირი ქმედება შეიძლება გახსნის გარეშე." + '</p>'
      + rates
      + '<p class="muted">' + "მედიანა მიწოდება→გახსნა" + ' ' + opsMs(data.latency?.deliveredToOpenedMedianMs) + ' ' + "· მიწოდება→ქმედება" + ' ' + opsMs(data.latency?.deliveredToActionedMedianMs) + '</p>'
      + '</section>';
    const suppressCard = '<section class="v25-panel">'
      + '<div class="card-head">' + opsTile('bell') + '<div>'
      + '<h3>' + "რატომ არ გაგზავნა Medi-მ" + '</h3>'
      + '<p class="muted">' + "დაბლოკვა წარმატებაა, თუ სიგნალი მოძველდა ან მომხმარებელმა უკვე იმოქმედა." + '</p>'
      + '</div></div>'
      + opsBarChart((data.suppressions || []).map((row) => ({ htmlLabel: suppressLabel(row.reason), count: row.count })))
      + '</section>';
    const fatigue = '<section class="v25-panel">'
      + '<div class="card-head">' + opsTile('users') + '<div>'
      + '<h3>' + "დაღლილობა და არჩევანი" + '</h3>'
      + '<p class="muted">' + opsEscape(data.fatigue?.note || '') + (data.fatigue?.sampleUsers != null ? " ნიმუში: " + opsFmt(data.fatigue.sampleUsers) + " მომხმარებელი სინქრონიზებული გადაწყვეტილებით." : '') + '</p>'
      + '</div></div>'
      + (data.fatigue?.sampleUsers
        ? '<div class="v25-fatigue">'
          + '<div class="v25-fatigue-col"><span>' + "ჩვეულებრივი" + '</span><strong>' + opsFmt(data.fatigue.distribution.normal) + '</strong><i style="height:' + (8 + Math.round((data.fatigue.distribution.normal / Math.max(1, data.fatigue.sampleUsers)) * 88)) + 'px"></i></div>'
          + '<div class="v25-fatigue-col is-mid"><span>' + "შემცირებული" + '</span><strong>' + opsFmt(data.fatigue.distribution.reduced) + '</strong><i style="height:' + (8 + Math.round((data.fatigue.distribution.reduced / Math.max(1, data.fatigue.sampleUsers)) * 88)) + 'px"></i></div>'
          + '<div class="v25-fatigue-col is-hi"><span>' + "ძლიერ შემცირებული" + '</span><strong>' + opsFmt(data.fatigue.distribution.highlyReduced) + '</strong><i style="height:' + (8 + Math.round((data.fatigue.distribution.highlyReduced / Math.max(1, data.fatigue.sampleUsers)) * 88)) + 'px"></i></div>'
          + '</div><p class="muted">' + "არჩეული სიხშირე მომხმარებლის არჩევანია. ადაპტაციური ლიმიტი Medi-ს დროებითი კორექტირებაა." + '</p>'
        : opsEmpty("დაღლილობის სურათი ჯერ არ არის", "ლიმიტები მოდის სინქრონიზებულ გადაწყვეტილებებთან."))
      + '</section>';
    const heat = '<section class="v25-panel v25-heat">'
      + '<div class="card-head">' + opsTile('calendar') + '<div>'
      + '<h3>' + "მომხმარებლის აქტივობა კვირის დღით და საათით" + '</h3>'
      + '<p class="muted">' + opsEscape(data.engagement?.source || '') + (data.engagement?.bestHour != null ? " ყველაზე ხშირი აპის გახსნა: " + data.engagement.bestHour + ":00 თბილისი." : '') + '</p>'
      + '</div></div>'
      + opsHeatmap(data.engagement?.heatmap)
      + '</section>';
    const outcomeSeries = [
      { points: data.charts?.observedDelivery || [], tone: 'teal' },
      { points: data.charts?.opened || [], tone: 'ink' },
      { points: data.charts?.actioned || [], tone: 'ink' },
    ].filter((s) => s.points.some((d) => d.count > 0));
    const blockSeries = [
      { points: data.charts?.suppressed || [], tone: 'ink' },
      { points: data.charts?.cancelled || [], tone: 'teal' },
    ].filter((s) => s.points.some((d) => d.count > 0));
    const charts = (outcomeSeries.length || blockSeries.length)
      ? '<section class="v25-panel v25-dec-charts">'
        + '<div class="card-head">' + opsTile('activity') + '<div><h3>' + "დროითი წარმადობა" + '</h3><p class="muted">' + "დაკვირვებული მიწოდება, გახსნა, ქმედება. დაბლოკვა და გაუქმება ცალკეა — წარმატების ძაბრში არ შედის." + '</p></div></div>'
        + (outcomeSeries.length ? opsLineChart(outcomeSeries, { label: "Brain შედეგები დროში" }) : '')
        + (blockSeries.length ? opsLineChart(blockSeries, { label: "დაბლოკვა და გაუქმება" }) : '')
        + '</section>'
      : '';
    const familyRows = (data.types || []).length
      ? data.types.map((row) => '<tr data-family="' + opsEscape(row.family) + '" class="users-row">'
        + '<td>' + opsEscape(row.family) + '</td>'
        + '<td>' + opsFmt(row.evaluated) + '</td>'
        + '<td>' + opsFmt(row.delivered) + '</td>'
        + '<td>' + opsFmt(row.opened) + '</td>'
        + '<td>' + opsFmt(row.actioned) + '</td>'
        + '<td>' + opsFmt(row.suppressed) + '</td>'
        + '<td><span class="v25-inlinebar"><i style="width:' + Math.max(0, Math.min(100, Number(row.openRate?.value) || 0)) + '%"></i></span> ' + opsRate(row.openRate) + '</td>'
        + '<td><span class="v25-inlinebar"><i style="width:' + Math.max(0, Math.min(100, Number(row.actionRate?.value) || 0)) + '%"></i></span> ' + opsRate(row.actionRate) + '</td>'
        + '<td>' + opsRate(row.directActionRate) + '</td>'
        + '</tr>').join('')
      : '<tr><td colspan="9">' + opsEmpty("ამ პერიოდში ოჯახი არ არის", "კლიენტები 23.0.3-ზე დაბლა Brain-ის გადაწყვეტილებებს არ ასინქრონებენ.") + '</td></tr>';
    const families = '<section class="v25-panel v25-dec-families">'
      + '<div class="card-head">' + opsTile('layers') + '<div><h3>' + "ოჯახები" + '</h3></div></div>'
      + '<div class="table-wrap ops-sticky"><table class="admin-table v25-dec-table">'
      + '<thead><tr>'
      + '<th>' + "ოჯახი" + '</th>'
      + '<th>' + "შეფასებული" + '</th>'
      + '<th>' + "მიწოდებული" + '</th>'
      + '<th>' + "გახსნილი" + '</th>'
      + '<th>' + "ქმედება" + '</th>'
      + '<th>' + "დაბლოკილი" + '</th>'
      + '<th>' + "გახსნა" + '</th>'
      + '<th>' + "ქმედება %" + '</th>'
      + '<th>' + "პირდაპირი" + '</th>'
      + '</tr></thead>'
      + '<tbody>' + familyRows + '</tbody></table></div></section>';
    const side = (data.fatigue?.sampleUsers || data.engagement?.heatmap?.length)
      ? '<div class="v25-dec-side">' + (data.fatigue?.sampleUsers ? fatigue : '') + (data.engagement?.heatmap?.length ? heat : '') + '</div>'
      : '';
    const familyBlock = (data.types || []).length ? families : '';
    const observatory = noDec
      ? ''
      : '<div class="v25-dec-main">' + funnelCard + suppressCard + '</div>' + side + charts + familyBlock;
    host.innerHTML = '<div class="ops-brain v25-brain v25-decisions">'
      + strip
      + note
      + log
      + observatory
      + '</div>';
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
        ${opsStripCell('shield', "ანალიტიკის მთლიანობა", versions.activeUsers ? Math.round(100 - (100 * (quality.usersMissingAppVersion || 0) / Math.max(1, versions.activeUsers))) + '%' : '\u2014', '')}
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
    { tab: 'packages', label: 'პაკეტები' },
    { tab: 'sms', label: 'SMS' },
    { tab: 'pharmacy', label: 'ფარმაცია' },
    { tab: 'settings', label: 'აპის რეჟიმი' },
  ];
  document.body.insertAdjacentHTML('beforeend', `
    <div id="ops-palette" class="ops-palette" role="dialog" aria-label="გადასვლა">
      <div class="ops-palette-scrim" id="ops-palette-scrim"></div>
      <div class="ops-palette-panel">
        <input id="ops-palette-q" type="search" placeholder="მომხმარებელი, შაბლონი, გადაწყვეტილება, სექცია…" autocomplete="off" />
        <div id="ops-palette-list" class="ops-palette-list">
          ${sections.map((s) => `<button type="button" data-tab="${s.tab}">${opsEscape(s.label)}</button>`).join('')}
        </div>
      </div>
    </div>
  `);
  const close = () => $('ops-palette')?.remove();
  $('ops-palette-scrim').onclick = close;
  $('ops-palette-q').focus();
  $('ops-palette-list').querySelectorAll('[data-tab]').forEach((btn) => {
    btn.onclick = () => { close(); switchTab(btn.dataset.tab); };
  });
  $('ops-palette-q').oninput = async () => {
    const q = $('ops-palette-q').value.trim();
    const list = $('ops-palette-list');
    const nav = sections.filter((s) => s.label.toLowerCase().includes(q.toLowerCase()));
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
    list.innerHTML = `${nav.map((s) => `<button type="button" data-tab="${s.tab}">${opsEscape(s.label)}</button>`).join('')}${extra}` || '<p class="muted">არაფერი მოიძებნა.</p>';
    list.querySelectorAll('[data-tab]').forEach((btn) => { btn.onclick = () => { close(); switchTab(btn.dataset.tab); }; });
    list.querySelectorAll('[data-user]').forEach((btn) => { btn.onclick = () => { close(); editUser(btn.dataset.user); }; });
    list.querySelectorAll('[data-decision]').forEach((btn) => { btn.onclick = () => { close(); switchTab('push'); openDecisionDrawer(btn.dataset.decision); }; });
  };
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

function patchOpsLive(snap) {
  if (!snap || !$('ops-kpis')) return;
  const setKpi = (key, value) => {
    if (value == null) return;
    const el = document.querySelector(`[data-ops-kpi="${key}"] strong`);
    if (!el) return;
    const next = opsFmt(value);
    if (el.textContent === next) return;
    el.textContent = next;
    el.classList.add('is-live-tick');
    setTimeout(() => el.classList.remove('is-live-tick'), 700);
  };
  setKpi('activeToday', snap.activeToday);
  if (opsState.range === 'today') setKpi('newUsers', snap.newUsersToday);
  const at = $('ops-live-at');
  if (at && snap.refreshedAt) at.textContent = new Date(snap.refreshedAt).toLocaleString('ka-GE');
}

window.patchOpsLive = patchOpsLive;
window.renderCommandCenter = renderCommandCenter;
window.renderHealthOps = renderHealthOps;
window.renderAuditLog = renderAuditLog;
window.renderPushBrainPanel = renderPushBrainPanel;
window.renderMediUsage = renderMediUsage;
window.renderCommandPalette = renderCommandPalette;
window.openDecisionDrawer = openDecisionDrawer;
