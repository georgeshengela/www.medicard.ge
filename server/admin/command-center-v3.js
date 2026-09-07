/**
 * Admin V3 Command Center — #/overview only.
 * Real Tbilisi aggregates + Socket.IO live KPIs. No fake scores.
 */
(function commandCenterV3(global) {
  const V3 = () => global.AdminV3 || {};
  const STATUS_KA = {
    healthy: { label: 'გამართული', summary: 'კრიტიკული წარმოების პრობლემა არ ჩანს.' },
    attention: { label: 'საჭიროა ყურადღება', summary: 'ქვემოთ ჩამოთვლილი სიგნალები საჭიროებს შემოწმებას.' },
    degraded: { label: 'დეგრადირებული', summary: 'სისტემა ან მონაცემთა ბაზა არ მუშაობს ნორმალურად.' },
  };
  const DEST = {
    '#/ai': 'Medi',
    '#/quality': 'ხარისხი',
    '#/push': 'Push & Brain',
    '#/settings': 'რეჟიმი',
    '#/sms': 'SMS',
    '#/pharmacy': 'ფარმაცია',
    '#/health': 'ჯანმრთელობა',
    '#/users': 'მომხმარებლები',
  };

  let ccLive = { status: 'live', at: null, error: null };
  let ccLastUsers = null;
  let ccLastBalances = null;

  function esc(value) {
    return typeof opsEscape === 'function' ? opsEscape(value) : String(value ?? '');
  }
  function fmt(n) {
    return typeof opsFmt === 'function' ? opsFmt(n) : String(n ?? '—');
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function usd(n) {
    return typeof formatUsd === 'function' ? formatUsd(n) : (n == null ? '—' : `$${n}`);
  }
  function when(iso) {
    if (V3().formatDate) return V3().formatDate(iso, 'exact');
    return typeof fmtDate === 'function' ? fmtDate(iso) : iso || '—';
  }
  function errBox(title, body, retryId) {
    return V3().errorState
      ? V3().errorState(title, body, retryId)
      : `<div class="v3-error" role="alert"><strong>${esc(title)}</strong><p>${esc(body || '')}</p></div>`;
  }
  function emptyBox(title, body) {
    return V3().emptyState ? V3().emptyState(title, body) : `<p class="muted">${esc(title)}</p>`;
  }
  function section(opts) {
    const html = V3().section
      ? V3().section(opts)
      : `<section><h3>${esc(opts.title || '')}</h3>${opts.content || ''}</section>`;
    return opts.mod ? html.replace('class="v3-section"', `class="v3-section ${opts.mod}"`) : html;
  }
  function badge(tone, label) {
    return V3().statusBadge
      ? V3().statusBadge(tone, { label, tone })
      : `<span class="v3-badge is-${tone}">${esc(label)}</span>`;
  }

  function destLabel(href) {
    if (!href) return '';
    const key = Object.keys(DEST).find((k) => href === k || href.startsWith(`${k}?`) || href.startsWith(`${k}/`));
    return DEST[key] || 'გახსნა';
  }

  function resolveStatus({ dbOk = true, apiOk = true, maintenanceMode = false, forceUpdate = false, aiErrors24h = 0, aiLast24h = 0, smsFailed24h = 0, lastSyncFailed = false, failedCampaigns24h = 0, attention = [] } = {}) {
    if (global.resolveCommandCenterStatus) {
      return global.resolveCommandCenterStatus({
        dbOk, apiOk, maintenanceMode, forceUpdate, aiErrors24h, aiLast24h,
        smsFailed24h, lastSyncFailed, failedCampaigns24h, attention,
      });
    }
    const items = [];
    const seen = new Set();
    const add = (item) => {
      if (!item?.key || seen.has(item.key)) return;
      seen.add(item.key);
      items.push(item);
    };
    if (dbOk === false) add({ key: 'db', severity: 'critical', title: 'ბაზა არ პასუხობს', detail: 'მონაცემთა ბაზის შემოწმება ჩაიშალა.', href: '#/quality' });
    if (apiOk === false) add({ key: 'api', severity: 'critical', title: 'API არ პასუხობს', detail: 'სისტემის ჯანმრთელობის შემოწმება ჩაიშალა.', href: '#/quality' });
    if (maintenanceMode) add({ key: 'maintenance', severity: 'critical', title: 'ტექნიკური რეჟიმი ჩართულია', detail: 'API უარყოფს არაადმინურ ტრაფიკს.', href: '#/settings' });
    if (forceUpdate) add({ key: 'force-update', severity: 'warning', title: 'იძულებითი განახლება ჩართულია', detail: 'ძველი აპის ვერსიები API-ს ვერ გამოიყენებს.', href: '#/settings' });
    if (Number(aiErrors24h) > 0) {
      const n = Number(aiErrors24h);
      const req = Number(aiLast24h) || 0;
      add({
        key: 'ai-errors',
        severity: 'warning',
        title: 'AI შეცდომები',
        detail: req ? `${n} შეცდომა ბოლო 24 საათში · ${req} მოთხოვნიდან.` : `${n} შეცდომა ბოლო 24 საათში.`,
        href: '#/ai',
        period: 'ბოლო 24სთ',
        value: n,
      });
    }
    if (Number(smsFailed24h) >= 3) add({ key: 'sms', severity: 'warning', title: 'SMS შეცდომები', detail: `${smsFailed24h} SMS ვერ გაიგზავნა ბოლო 24 საათში.`, href: '#/sms', period: 'ბოლო 24სთ' });
    if (lastSyncFailed) add({ key: 'pharmacy-sync', severity: 'warning', title: 'ფარმაციის ბოლო სინქი ჩაიშალა', detail: 'აფთიაქის სინქრონიზაცია წარუმატებელია.', href: '#/pharmacy' });
    if (Number(failedCampaigns24h) > 0) add({ key: 'push-failed', severity: 'warning', title: 'Push კამპანია ჩაიშალა', detail: `${failedCampaigns24h} კამპანია წარუმატებელია ბოლო 24 საათში.`, href: '#/push' });
    for (const raw of attention || []) {
      if (!raw?.title || raw.severity === 'info') continue;
      if (/AI შეცდომ/i.test(raw.title) && seen.has('ai-errors')) continue;
      const title = raw.metric?.orphanOutcomes != null ? 'შედეგები გადაწყვეტილების გარეშე' : raw.title;
      const detail = raw.metric?.orphanOutcomes != null
        ? `${raw.metric.orphanOutcomes} შეტყობინების შედეგს არ აქვს შესაბამისი გადაწყვეტილება.`
        : raw.detail;
      add({
        key: `${raw.href || ''}:${raw.title}`,
        severity: raw.severity === 'critical' ? 'critical' : 'warning',
        title,
        detail,
        href: raw.href || '#/quality',
        period: raw.period,
        value: raw.n,
      });
    }
    const rank = { critical: 0, warning: 1 };
    items.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
    const level = items.some((i) => i.severity === 'critical')
      ? 'degraded'
      : items.some((i) => i.severity === 'warning') ? 'attention' : 'healthy';
    return { level, items, reasons: items.slice(0, 4).map((i) => i.title) };
  }

  function liveChip() {
    const label = ccLive.status === 'failed'
      ? 'განახლება ვერ მოხერხდა'
      : ccLive.status === 'delayed'
        ? 'დაგვიანებული'
        : 'განახლებულია';
    const tone = ccLive.status === 'failed' ? 'danger' : ccLive.status === 'delayed' ? 'warn' : 'ok';
    return `<span class="v3-cc-fresh is-${tone}" id="ops-live-clock">${badge(tone, label)} <time id="ops-live-at">${esc(ccLive.at ? when(ccLive.at) : '—')}</time></span>`;
  }

  function metric(opts) {
    const interactive = Boolean(opts.go);
    const cls = `v3-cc-metric${opts.warn ? ' is-warn' : ''}${opts.mod ? ` ${opts.mod}` : ''}`;
    const open = interactive ? `button type="button" class="${cls}"` : `article class="${cls}"`;
    const close = interactive ? 'button' : 'article';
    return `<${open} ${opts.kpi ? `data-ops-kpi="${opts.kpi}"` : ''} ${opts.go ? `data-go="${esc(opts.go)}"` : ''} title="${esc(opts.tip || opts.label)}">
      <span class="v3-cc-metric-top">
        ${opts.icon ? `<span class="v3-cc-metric-ico" aria-hidden="true">${ico(opts.icon)}</span>` : ''}
        <span class="v3-cc-metric-label">${esc(opts.label)}</span>
      </span>
      <strong>${opts.value}</strong>
      <em>${esc(opts.period || '')}</em>
      ${opts.hint ? `<span class="v3-cc-metric-hint">${opts.hint}</span>` : ''}
    </${close}>`;
  }

  function alertIcon(item) {
    const key = item?.key || '';
    const href = item?.href || '';
    if (key === 'ai-errors' || href.includes('/ai')) return 'spark';
    if (key === 'db' || key === 'api') return 'activity';
    if (key === 'maintenance') return 'lock';
    if (key === 'force-update') return 'download';
    if (key === 'sms' || href.includes('/sms')) return 'send';
    if (key === 'pharmacy-sync' || href.includes('/pharmacy')) return 'pill';
    if (key === 'push-failed' || href.includes('/push')) return 'bell';
    if (href.includes('/settings')) return 'settings';
    if (href.includes('/quality')) return 'shield';
    if (href.includes('/users')) return 'users';
    return item?.severity === 'critical' ? 'zap' : 'alert';
  }

  function statusIcon(level) {
    if (level === 'degraded') return 'zap';
    if (level === 'attention') return 'alert';
    return 'check';
  }

  function growthWords(delta) {
    if (!delta || !delta.show) return { text: 'შედარება არ არის საკმარისი', cls: 'flat' };
    if (delta.abs > 0 && delta.pct == null) return { text: `${fmt(delta.abs)} ამ პერიოდში`, cls: 'flat' };
    if (delta.abs < 0 && delta.pct == null) return { text: `${fmt(delta.abs)} ამ პერიოდში`, cls: 'flat' };
    if (delta.abs > 0) return { text: `იზრდება · +${fmt(delta.abs)} · ${delta.pct}%`, cls: 'up' };
    if (delta.abs < 0) return { text: `მცირდება · ${fmt(delta.abs)} · ${delta.pct}%`, cls: 'down' };
    return { text: 'სტაბილური', cls: 'flat' };
  }

  function rateTip(rate, fallback) {
    if (!rate || rate.hidden || rate.value == null) return fallback || 'ნიმუში საკმარისი არ არის';
    return `${rate.value}% · ${fmt(rate.numerator)} / ${fmt(rate.denominator)}`;
  }

  function lineChart(points, { label = 'ტრენდი', height = 220, tone = 'teal' } = {}) {
    const rows = points || [];
    if (!rows.length || !rows.some((d) => d.count > 0)) {
      return emptyBox('ამ პერიოდში აქტივობა არ არის', 'წინა ცარიელი დღეები ნიშნავს გამოტოვებულ ტელემეტრიას, არა რეალურ ვარდნას ნულამდე.');
    }
    const first = rows.findIndex((d) => d.count > 0);
    const w = 960;
    const h = height;
    const padX = 40;
    const padY = 22;
    const usable = rows.slice(first);
    const n = Math.max(2, rows.length);
    const max = Math.max(1, ...usable.map((d) => d.count));
    const step = (w - padX * 2) / (n - 1);
    const xy = (d, i) => {
      const x = padX + i * step;
      const y = h - padY - (d.count / max) * (h - padY * 2);
      return { x, y };
    };
    const line = rows.map((d, i) => {
      if (i < first) return null;
      const p = xy(d, i);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).filter(Boolean).join(' ');
    const ticks = [first, Math.floor((first + n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i && v >= 0 && v < n);
    const labels = ticks.map((i) => {
      const p = xy(rows[i], i);
      return `<text x="${p.x.toFixed(1)}" y="${h - 4}" class="ops-axis">${esc(String(rows[i].day).slice(5))}</text>`;
    }).join('');
    const hits = rows.map((d, i) => {
      const p = xy(i < first ? { count: 0 } : d, i);
      const tip = i < first ? `${d.day}: მონაცემი არ არის` : `${d.day}: ${d.count}`;
      return `<circle class="ops-hit" cx="${p.x.toFixed(1)}" cy="${(i < first ? h - padY : p.y).toFixed(1)}" r="8"><title>${esc(tip)}</title></circle>`;
    }).join('');
    const grids = [0, 0.5, 1].map((t) => {
      const y = (h - padY - t * (h - padY * 2)).toFixed(1);
      return `<line class="v3-cc-grid" x1="${padX}" x2="${w - padX}" y1="${y}" y2="${y}" />`;
    }).join('');
    const last = line.split(' ').pop() || '';
    const lastX = last.split(',')[0] || String(w - padX);
    const area = line ? `<polygon class="v3-cc-area tone-${tone}" points="${padX},${h - padY} ${line} ${lastX},${h - padY}" />` : '';
    const dots = rows.map((d, i) => {
      if (i < first) return '';
      const p = xy(d, i);
      return `<circle class="v3-cc-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" />`;
    }).join('');
    return `<div class="v3-cc-plot tone-${tone}"><div class="v3-cc-chart-tip" hidden></div><svg class="ops-chart v3-cc-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${grids}${area}${line ? `<polyline class="ops-line tone-${tone}" points="${line}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>` : ''}${dots}${hits}${labels}<text x="${padX}" y="14" class="ops-axis">${fmt(max)}</text></svg></div>`;
  }

  function seedOnline() {
    const snap = global.__opsLiveSnap;
    return snap?.onlineNow != null ? fmt(snap.onlineNow) : '—';
  }

  function applyLiveSnap() {
    if (typeof global.patchOpsLive === 'function' && global.__opsLiveSnap) {
      global.patchOpsLive(global.__opsLiveSnap);
    }
  }

  function bindGo(root) {
    root.querySelectorAll('[data-go], [data-href]').forEach((btn) => {
      btn.onclick = () => {
        const href = btn.dataset.href;
        if (href && href.includes('?')) location.hash = href;
        else if (href) location.hash = href;
        else if (btn.dataset.go && typeof switchTab === 'function') switchTab(btn.dataset.go);
      };
    });
  }

  async function renderCommandCenter() {
    const gen = ++opsFetchGen;
    const root = $('tab-overview');
    const actions = $('page-header-actions');
    if (actions) {
      actions.innerHTML = V3().iconButton
        ? V3().iconButton({ id: 'ops-refresh', name: 'refresh', label: 'განახლება' })
        : '<button type="button" class="v3-icon-btn" id="ops-refresh" aria-label="განახლება" title="განახლება"></button>';
    }
    const skel = (mod) => `<section class="v3-section" aria-hidden="true"><div class="v3-section-head"><div class="v3-cc-skel-line"></div></div><div class="v3-section-body"><div class="v3-cc-skel-row${mod ? ' ' + mod : ''}"></div></div></section>`;
    root.innerHTML = `
      <div class="v3-cc" data-cc="v3">
        <div class="v3-cc-toolbar" id="ops-toolbar">
          ${typeof opsRangeBar === 'function' ? opsRangeBar() : ''}
          ${liveChip()}
        </div>
        <div id="ops-live-hero"><div class="v3-cc-skel-row is-hero" aria-hidden="true"></div></div>
        <div id="ops-status"><div class="v3-cc-skel-status" aria-hidden="true"></div></div>
        <div id="ops-attention">${skel('is-alert')}</div>
        <div id="ops-infra">${skel('is-infra')}</div>
        <div id="ops-notif">${skel('is-funnel')}</div>
        <div class="v3-cc-split is-wide">
          <div id="ops-activity">${skel('is-plot')}</div>
          <div id="ops-movement">${skel('is-strip')}</div>
        </div>
        <div id="ops-growth">${skel('is-plot')}</div>
        <div class="v3-cc-split">
          <div id="ops-retention">${skel('is-strip')}</div>
          <div id="ops-features">${skel('is-alert')}</div>
        </div>
      </div>`;
    if (typeof bindOpsRange === 'function') bindOpsRange(renderCommandCenter);
    $('ops-refresh')?.addEventListener('click', () => {
      if ($('ops-refresh')?.classList.contains('is-loading')) return;
      renderCommandCenter();
    });
    const refreshBtn = $('ops-refresh');
    if (refreshBtn) refreshBtn.classList.add('is-loading');

    const q = typeof opsQs === 'function' ? opsQs() : `range=${opsState.range}`;
    const grain = opsState.grain || 'dau';
    const [overview, users, features, retention, notif, system, balances] = await Promise.all([
      api(`/analytics/overview?${q}`).catch((err) => ({ error: err.message })),
      api(`/analytics/users?${q}&grain=${grain}`).catch((err) => ({ error: err.message })),
      api(`/analytics/features?${q}`).catch((err) => ({ error: err.message })),
      api(`/analytics/retention?${q}`).catch((err) => ({ error: err.message })),
      api(`/analytics/notifications?${q}`).catch((err) => ({ error: err.message })),
      api('/system/health').catch((err) => ({ error: err.message })),
      api('/balances').catch((err) => ({ error: err.message })),
    ]);
    if (gen !== opsFetchGen) return;
    if (refreshBtn) refreshBtn.classList.remove('is-loading');

    const failedAll = [overview, users, features, retention, notif, system].every((p) => p && p.error);
    ccLive = {
      status: failedAll ? 'failed' : 'live',
      at: overview.refreshedAt || system.refreshedAt || new Date().toISOString(),
      error: failedAll ? (overview.error || system.error) : null,
    };
    const freshHost = root.querySelector('#ops-live-clock');
    if (freshHost) freshHost.outerHTML = liveChip();

    if (!balances.error) ccLastBalances = balances;

    const settings = overview.settings || system.settings || {};
    const mergedAttention = [
      ...(Array.isArray(overview.attention) ? overview.attention : []),
      ...(Array.isArray(system.attention) ? system.attention : []),
    ];
    const resolved = resolveStatus({
      dbOk: system.error ? null : system.database?.ok !== false,
      apiOk: !system.error,
      maintenanceMode: settings.maintenanceMode,
      forceUpdate: settings.forceUpdate,
      aiErrors24h: system.ai?.errors24h ?? 0,
      aiLast24h: system.ai?.last24h ?? 0,
      smsFailed24h: system.sms?.failed24h ?? 0,
      lastSyncFailed: system.jobs?.lastSync?.status === 'FAILED',
      failedCampaigns24h: 0,
      attention: mergedAttention,
    });
    paintLiveHero(root, overview, system);
    paintStatus(root, resolved, system, overview);
    paintAttention(root, resolved);
    paintInfra(root, overview, system, balances.error ? ccLastBalances : balances);
    paintBrain(root, notif);
    paintMovement(root, overview);
    paintActivity(root, users);
    paintGrowth(root, overview);
    paintRetention(root, retention);
    paintFeatures(root, features);
    bindGo(root);
    applyLiveSnap();
  }

  function paintLiveHero(root, overview, system) {
    if (overview.error) {
      $('ops-live-hero').innerHTML = section({
        title: 'ცოცხალი მდგომარეობა',
        helpKey: 'overview.live',
        content: errBox('ცოცხალი მეტრიკები ვერ ჩაიტვირთა', overview.error, 'ops-retry-hero'),
      });
      $('ops-retry-hero')?.addEventListener('click', renderCommandCenter);
      return;
    }
    const k = overview.kpis || {};
    const todayNew = overview.todayMetrics?.newUsersToday
      ?? overview.charts?.growth?.newUsers?.find((d) => d.day === overview.today)?.count;
    const aiErr = system.ai?.errors24h ?? 0;
    $('ops-live-hero').innerHTML = `
      <section class="v3-cc-hero" aria-label="ცოცხალი მდგომარეობა">
        <article class="v3-cc-online${Number(global.__opsLiveSnap?.onlineNow) > 0 ? '' : ' is-empty'}" data-ops-kpi="onlineNow" title="მომხმარებლები, რომელთა AppActivity lastAt ≤ 90 წამია. Socket.IO ops:live.">
          <div class="v3-cc-online-top">
            <span class="v3-cc-pulse" aria-hidden="true"></span>
            <span class="v3-cc-online-label">${ico('activity')} ახლა აპში</span>
            ${V3().infoButton ? V3().infoButton('overview.live') : ''}
          </div>
          <strong>${seedOnline()}</strong>
          <em>რეალურ დროში · ბოლო 90 წმ · Socket.IO</em>
        </article>
        <div class="v3-cc-hero-grid">
          ${metric({ kpi: 'activeToday', icon: 'users', label: 'აქტიური დღეს', value: fmt(k.activeToday?.value), period: 'დღეს · თბილისი', tip: k.activeToday?.definition || 'უნიკალური აქტიური მომხმარებლები თბილისის დღეს.', go: 'users' })}
          ${metric({ kpi: 'newUsersToday', icon: 'user', label: 'ახალი დღეს', value: todayNew == null ? '—' : fmt(todayNew), period: 'დღეს · თბილისი', tip: 'რეგისტრაციები მხოლოდ დღეს.', go: 'users' })}
          ${metric({ icon: 'globe', label: 'სულ მომხმარებელი', value: fmt(k.totalUsers?.value), period: 'ყველა დრო', tip: k.totalUsers?.definition || 'რეგისტრირებული ანგარიშები.', go: 'users' })}
          ${metric({ icon: 'spark', label: 'AI შეცდომა', value: fmt(aiErr), period: 'ბოლო 24სთ', tip: 'Medi შეცდომები კედლის საათით.', go: 'ai', warn: aiErr > 0 })}
        </div>
      </section>`;
  }

  function paintStatus(root, resolved, system, overview) {
    const ka = STATUS_KA[resolved.level] || STATUS_KA.healthy;
    const env = system.environment || overview.environment;
    const apiOk = system.api?.ok !== false && !system.error;
    const dbOk = system.database?.ok !== false;
    $('ops-status').innerHTML = `
      <section class="v3-cc-status is-${resolved.level}" aria-label="საოპერაციო მდგომარეობა">
        <div class="v3-cc-status-main">
          <span class="v3-cc-status-ico" aria-hidden="true">${ico(statusIcon(resolved.level))}</span>
          <div class="v3-cc-status-copy">
            <div class="v3-title-row">
              <h3>${esc(ka.label)}</h3>
              ${V3().infoButton ? V3().infoButton('overview.status') : ''}
            </div>
            <p>${esc(ka.summary)}</p>
          </div>
        </div>
        <div class="v3-cc-sys" aria-label="სისტემა">
          <span class="v3-cc-chip ${apiOk ? 'is-ok' : 'is-warn'}">${ico(apiOk ? 'check' : 'alert')} API</span>
          <span class="v3-cc-chip ${dbOk ? 'is-ok' : 'is-warn'}">${ico(dbOk ? 'check' : 'alert')} ბაზა${system.database?.latencyMs != null ? ` · ${fmt(system.database.latencyMs)}ms` : ''}</span>
          ${env ? `<span class="v3-cc-chip${env === 'production' ? ' is-prod' : ''}" title="გარემო">${ico('globe')} ${env === 'production' ? 'წარმოება' : esc(env)}</span>` : ''}
          ${system.settings?.maintenanceMode ? `<span class="v3-cc-chip is-warn">${ico('lock')} ოფლაინ რეჟიმი</span>` : ''}
          ${system.settings?.forceUpdate ? `<span class="v3-cc-chip is-warn">${ico('download')} იძულებითი განახლება</span>` : ''}
        </div>
      </section>`;
  }

  function paintAttention(root, resolved) {
    if (!resolved.items.length) {
      $('ops-attention').innerHTML = section({
        title: 'საჭიროებს ყურადღებას',
        helpKey: 'overview.attention',
        content: `<div class="v3-cc-healthy-card"><span class="v3-cc-healthy-ico" aria-hidden="true">${ico('check')}</span><div><strong>ყველაფერი რიგზეა</strong><p>ქმედებას საჭირო სიგნალი არ არის.</p></div></div>`,
      });
      return;
    }
    $('ops-attention').innerHTML = section({
      title: 'საჭიროებს ყურადღებას',
      helpKey: 'overview.attention',
      description: `${resolved.items.length} სიგნალი საჭიროებს შემოწმებას — დააჭირე გადასასვლელად.`,
      content: `<div class="v3-cc-alerts">${resolved.items.map((item) => `
        <button type="button" class="v3-cc-alert is-${item.severity}" data-href="${esc(item.href || '#/quality')}">
          <span class="v3-cc-alert-ico" aria-hidden="true">${ico(alertIcon(item))}</span>
          <span class="v3-cc-alert-copy">
            <strong>${esc(item.title)}</strong>
            <span>${esc(item.detail || '')}</span>
            ${item.period ? `<small>${esc(item.period)}</small>` : ''}
          </span>
          <span class="v3-cc-alert-right">
            ${item.value != null ? `<em class="v3-cc-alert-val">${fmt(item.value)}</em>` : ''}
            <span class="v3-cc-alert-cta">${ico('arrow')}<span>${esc(destLabel(item.href))}</span></span>
          </span>
        </button>`).join('')}</div>`,
    });
  }

  function paintInfra(root, overview, system, balances) {
    const settings = overview.settings || system.settings || {};
    const appVer = overview.appVersion || system.appVersion || '—';
    const minVer = settings.minAppVersion || '—';
    const or = balances?.openrouter;
    const emd = balances?.evidencemd;
    const orTone = or?.tone || (or?.ok ? 'ok' : or?.error ? 'bad' : 'muted');
    const emdTone = emd?.tone || (emd?.ok ? 'ok' : emd?.error ? 'bad' : 'muted');
    const fetched = balances?.fetchedAt ? when(balances.fetchedAt) : '';

    $('ops-infra').innerHTML = section({
      title: 'პროექტი და პროვაიდერები',
      helpKey: 'overview.infra',
      description: 'მობილური აპის ვერსია, OpenRouter ბალანსი და EvidenceMD გამოყენება.',
      action: `<button type="button" class="btn ghost compact" id="cc-balances-refresh">${ico('refresh')} ბალანსის განახლება</button>`,
      content: `<div class="v3-cc-infra">
        <article class="v3-cc-infra-card" data-go="settings" title="აპის ვერსია mobile/app.json-დან">
          <span class="v3-cc-infra-kicker">${ico('phone')} მობილური აპი</span>
          <strong class="v3-cc-infra-value">${esc(appVer)}</strong>
          <em>მინ. ვერსია ${esc(minVer)}</em>
          <div class="v3-cc-infra-tags">
            <span class="v3-cc-chip${settings.allowRegistrations === false ? ' is-warn' : ' is-ok'}">${ico(settings.allowRegistrations === false ? 'lock' : 'check')} ${settings.allowRegistrations === false ? 'რეგისტრაცია დახურულია' : 'რეგისტრაცია ღიაა'}</span>
            ${settings.forceUpdate ? `<span class="v3-cc-chip is-warn">${ico('download')} Force update</span>` : ''}
            ${settings.maintenanceMode ? `<span class="v3-cc-chip is-warn">${ico('lock')} Maintenance</span>` : ''}
          </div>
        </article>
        <article class="v3-cc-infra-card is-${orTone}" title="OpenRouter კრედიტები">
          <span class="v3-cc-infra-kicker">${ico('wallet')} OpenRouter</span>
          <strong class="v3-cc-infra-value">${usd(or?.remaining)}</strong>
          <em>${esc(or?.model || 'X-ray / CT / კანი')} · დარჩენილი USD</em>
          <div class="v3-cc-infra-stats">
            <span><b>დღეს</b> ${usd(or?.usedDaily)}</span>
            <span><b>თვე</b> ${usd(or?.usedMonthly)}</span>
            <span><b>დახარჯული</b> ${usd(or?.used)}</span>
          </div>
          ${or?.error ? `<p class="v3-cc-infra-err">${esc(or.error)}</p>` : ''}
          <a class="v3-cc-infra-link" href="${esc(or?.dashboardUrl || 'https://openrouter.ai/settings/credits')}" target="_blank" rel="noreferrer">${ico('link')} შევსება</a>
        </article>
        <article class="v3-cc-infra-card is-${emdTone}" title="EvidenceMD — Medicard გამოყენება (საჯარო საფულე არ აქვთ)">
          <span class="v3-cc-infra-kicker">${ico('message')} EvidenceMD</span>
          <strong class="v3-cc-infra-value">${emd?.remaining != null ? fmt(emd.remaining) : '—'}</strong>
          <em>${emd?.remaining != null ? 'დარჩენილი კრედიტი' : `${emd?.creditsPerCall || 4} კრ. / გამოძახება`}</em>
          <div class="v3-cc-infra-stats">
            <span><b>ამ თვეში</b> ${fmt(emd?.usedThisMonth ?? 0)} გამ.</span>
            <span><b>~ კრ.</b> ${fmt(emd?.estimatedCreditsThisMonth ?? 0)}</span>
            <span><b>სულ</b> ${fmt(emd?.usedAll ?? 0)}</span>
          </div>
          ${emd?.error ? `<p class="v3-cc-infra-err">${esc(emd.error)}</p>` : ''}
          <a class="v3-cc-infra-link" href="${esc(emd?.dashboardUrl || 'https://evidencemd.ai/developers')}" target="_blank" rel="noreferrer">${ico('link')} დეშბორდი</a>
        </article>
        <article class="v3-cc-infra-card" title="AI ტელემეტრია ბოლო 24 საათში">
          <span class="v3-cc-infra-kicker">${ico('spark')} Medi · 24სთ</span>
          <strong class="v3-cc-infra-value">${fmt(system.ai?.last24h ?? 0)}</strong>
          <em>მოთხოვნა · შეცდომა ${fmt(system.ai?.errors24h ?? 0)} · ${system.ai?.errorRate24h != null ? `${system.ai.errorRate24h}%` : '—'}</em>
          <div class="v3-cc-infra-stats">
            <span><b>შეცდომა 7დ</b> ${fmt(system.ai?.errors7d ?? 0)}</span>
            <span><b>Push 24სთ</b> ${fmt(system.push?.sent24h ?? 0)}</span>
            <span><b>SMS fail</b> ${fmt(system.sms?.failed24h ?? 0)}</span>
          </div>
          <button type="button" class="v3-cc-infra-link" data-go="ai">${ico('arrow')} Medi გვერდი</button>
        </article>
      </div>
      <p class="v3-cc-infra-meta">${fetched ? `ბალანსი განახლდა ${esc(fetched)}` : 'ბალანსი ჯერ არ არის განახლებული'}</p>`,
    });

    $('cc-balances-refresh')?.addEventListener('click', async () => {
      const btn = $('cc-balances-refresh');
      if (btn) btn.disabled = true;
      try {
        const next = await api('/balances?fresh=1');
        ccLastBalances = next;
        paintInfra(root, overview, system, next);
        bindGo(root);
      } catch (err) {
        if (typeof toast === 'function') toast(err.message || 'ბალანსი ვერ განახლდა', 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  function paintBrain(root, notif) {
    if (notif.error) {
      $('ops-notif').innerHTML = section({
        title: 'შეტყობინებები',
        helpKey: 'overview.brain',
        action: '<button type="button" class="btn ghost compact" data-go="push">Push &amp; Brain</button>',
        content: errBox('Brain შეჯამება ვერ ჩაიტვირთა', notif.error, 'ops-retry-brain'),
      });
      $('ops-retry-brain')?.addEventListener('click', renderCommandCenter);
      return;
    }
    const f = notif.funnel || {};
    const rates = f.rates || {};
    if (!notif.syncedDecisions) {
      $('ops-notif').innerHTML = section({
        title: 'შეტყობინებები',
        helpKey: 'overview.brain',
        description: 'არჩეული პერიოდი · Brain გადაწყვეტილებები.',
        action: '<button type="button" class="btn ghost compact" data-go="push">Push &amp; Brain</button>',
        content: emptyBox('ამ პერიოდში Brain გადაწყვეტილებები არ არის', 'კლიენტები 23.0.3-ზე დაბლა გადაწყვეტილებებს არ ასინქრონებენ.'),
      });
      return;
    }
    const steps = [
      ['შეფასებული', f.evaluated, 'search'],
      ['შესაფერისი', f.eligible, 'check'],
      ['დაგეგმილი', f.scheduled, 'calendar'],
      ['მიწოდებული', f.delivered, 'send'],
      ['გახსნილი', f.opened, 'eye'],
      ['ქმედება', f.actioned, 'zap'],
    ];
    const maxStep = Math.max(1, ...steps.map(([, v]) => Number(v) || 0));
    $('ops-notif').innerHTML = section({
      title: 'შეტყობინებები',
      helpKey: 'overview.brain',
      description: 'არჩეული პერიოდი. დაგეგმილი ნიშნავს დაგეგმილს — არა მიწოდებას.',
      action: '<button type="button" class="btn ghost compact" data-go="push">Push &amp; Brain</button>',
      content: `<div class="v3-cc-funnel" role="list">
        ${steps.map(([lab, val, stepIcon], i, all) => {
          const prev = i ? Number(all[i - 1][1]) : 0;
          const thin = prev > 20 && Number(val) * 20 < prev;
          const pct = Math.max(8, Math.round((Number(val) / maxStep) * 100));
          return `<div role="listitem"${thin ? ' class="is-thin"' : ''}>
            <span class="v3-cc-funnel-lab">${ico(stepIcon)} ${lab}</span>
            <strong>${fmt(val)}</strong>
            <i class="v3-cc-funnel-bar" aria-hidden="true"><b style="width:${pct}%"></b></i>
          </div>`;
        }).join('')}
      </div>
      <p class="v3-cc-funnel-rates">
        <span title="${esc(rateTip(rates.delivery, 'მიწოდება = მიწოდებული / დაგეგმილი'))}">მიწოდება ${rateTip(rates.delivery)}</span>
        <span title="${esc(rateTip(rates.open, 'გახსნა = გახსნილი / მიწოდებული'))}">გახსნა ${rateTip(rates.open)}</span>
        <span title="${esc(rateTip(rates.action, 'ქმედება = ქმედება / მიწოდებული'))}">ქმედება ${rateTip(rates.action)}</span>
      </p>`,
    });
  }

  function paintMovement(root, overview) {
    if (overview.error) {
      $('ops-movement').innerHTML = section({ title: 'მომხმარებლების მოძრაობა', helpKey: 'overview.movement', content: errBox('მოძრაობა ვერ ჩაიტვირთა', overview.error, 'ops-retry-move') });
      $('ops-retry-move')?.addEventListener('click', renderCommandCenter);
      return;
    }
    const k = overview.kpis || {};
    const g = growthWords(k.newUsers?.delta);
    $('ops-movement').innerHTML = section({
      title: 'მომხმარებლების მოძრაობა',
      helpKey: 'overview.movement',
      description: `არჩეული პერიოდი · ${esc(overview.range?.label || '')}. DAU/WAU/MAU — უნიკალური აქტივობა, თბილისი.`,
      content: `<div class="v3-cc-strip is-four is-cards">
        ${metric({ icon: 'activity', label: 'DAU', value: fmt(k.activeToday?.value), period: 'დღეს', tip: k.activeToday?.definition, go: 'users' })}
        ${metric({ icon: 'users', label: 'WAU', value: fmt(k.wau?.value), period: 'ბოლო 7 დღე', tip: k.wau?.definition })}
        ${metric({ icon: 'globe', label: 'MAU', value: fmt(k.mau?.value), period: 'ბოლო 30 დღე', tip: k.mau?.definition })}
        ${metric({ icon: 'user', label: 'ახალი', value: fmt(k.newUsers?.value), period: 'არჩეული პერიოდი', tip: k.newUsers?.definition, hint: `<span class="v3-cc-delta is-${g.cls}">${esc(g.text)}</span>` })}
      </div>`,
    });
  }

  function paintActivity(root, users) {
    const host = $('ops-activity');
    if (users.error && !ccLastUsers) {
      host.innerHTML = section({
        title: 'აქტივობა',
        helpKey: 'overview.activity',
        content: errBox('აქტივობის სერია ვერ ჩაიტვირთა', users.error, 'ops-retry-grain'),
      });
      $('ops-retry-grain')?.addEventListener('click', renderCommandCenter);
      return;
    }
    const data = users.error ? ccLastUsers : users;
    if (!users.error) ccLastUsers = users;
    const grain = data.grain || opsState.grain || 'dau';
    host.innerHTML = section({
      title: 'აქტივობა',
      helpKey: 'overview.activity',
      description: 'უნიკალური აქტიური მომხმარებლები თბილისის დღეებზე.',
      action: `<div class="ops-range" role="group" aria-label="აქტივობის მარცვალი">${['dau', 'wau', 'mau'].map((g) =>
        `<button type="button" class="ops-range-btn${grain === g ? ' active' : ''}" data-ops-grain="${g}">${g.toUpperCase()}</button>`).join('')}</div>`,
      content: `${users.error ? errBox('განახლება ვერ მოხერხდა — ბოლო წარმატებული სერია რჩება', users.error, 'ops-retry-grain') : ''}
        ${lineChart(data.series, { label: grain.toUpperCase(), height: 240 })}
        <p class="v3-cc-plot-meta">${(() => {
          const series = data.series || [];
          const start = series.findIndex((d) => d.count > 0);
          const usable = start >= 0 ? series.slice(start) : [];
          const avg = usable.length
            ? Math.round(usable.reduce((sum, d) => sum + d.count, 0) / usable.length)
            : null;
          return [
            data.summary?.peak ? `პიკი ${data.summary.peak.day} · ${fmt(data.summary.peak.count)}` : '',
            avg != null ? `საშუალო ${fmt(avg)}` : '',
          ].filter(Boolean).join(' · ');
        })()}</p>`,
    });
    host.querySelectorAll('[data-ops-grain]').forEach((btn) => {
      btn.onclick = async () => {
        const prev = opsState.grain;
        opsState.grain = btn.dataset.opsGrain;
        if (typeof opsPersistRange === 'function') opsPersistRange();
        btn.classList.add('is-loading');
        const next = await api(`/analytics/users?${opsQs({ grain: opsState.grain })}`).catch((err) => ({ error: err.message }));
        btn.classList.remove('is-loading');
        if (next.error) {
          opsState.grain = prev;
          if (typeof opsPersistRange === 'function') opsPersistRange();
          paintActivity(root, { ...ccLastUsers, error: next.error });
          bindGo(root);
          return;
        }
        paintActivity(root, next);
        bindGo(root);
      };
    });
    $('ops-retry-grain')?.addEventListener('click', () => {
      const btn = host.querySelector(`[data-ops-grain="${opsState.grain || 'dau'}"]`);
      if (btn) btn.click();
      else renderCommandCenter();
    });
    const tip = host.querySelector('.v3-cc-chart-tip');
    host.querySelectorAll('.ops-hit').forEach((hit) => {
      hit.addEventListener('mouseenter', () => {
        if (!tip) return;
        tip.textContent = hit.querySelector('title')?.textContent || '';
        tip.hidden = !tip.textContent;
      });
      hit.addEventListener('mouseleave', () => { if (tip) tip.hidden = true; });
    });
  }

  function paintGrowth(root, overview) {
    if (overview.error) {
      $('ops-growth').innerHTML = '';
      return;
    }
    const series = overview.charts?.growth?.newUsers || overview.charts?.dau?.series;
    if (!series?.length) {
      $('ops-growth').innerHTML = '';
      return;
    }
    const growthSeries = overview.charts?.growth?.newUsers;
    if (!growthSeries?.length) {
      $('ops-growth').innerHTML = '';
      return;
    }
    $('ops-growth').innerHTML = section({
      title: 'ზრდა · ახალი მომხმარებლები',
      helpKey: 'overview.growth',
      description: 'არჩეული პერიოდი · ახალი რეგისტრაციები თბილისის დღეებზე.',
      content: `${lineChart(growthSeries, { label: 'ახალი', height: 200, tone: 'amber' })}`,
    });
    const tip = $('ops-growth')?.querySelector('.v3-cc-chart-tip');
    $('ops-growth')?.querySelectorAll('.ops-hit').forEach((hit) => {
      hit.addEventListener('mouseenter', () => {
        if (!tip) return;
        tip.textContent = hit.querySelector('title')?.textContent || '';
        tip.hidden = !tip.textContent;
      });
      hit.addEventListener('mouseleave', () => { if (tip) tip.hidden = true; });
    });
  }

  function paintRetention(root, retention) {
    if (retention.error) {
      $('ops-retention').innerHTML = section({ title: 'შენარჩუნება', helpKey: 'overview.retention', content: errBox('შენარჩუნება ვერ ჩაიტვირთა', retention.error, 'ops-retry-ret') });
      $('ops-retry-ret')?.addEventListener('click', renderCommandCenter);
      return;
    }
    const cell = (row, label) => {
      if (!row || row.available === false || row.rate == null) {
        return '<div class="v3-cc-ret"><span class="v3-cc-ret-lab">' + ico('users') + ' ' + label + '</span><strong>—</strong><em>ნიმუში საკმარისი არ არის' + (row?.eligible != null ? ' · n=' + fmt(row.eligible) : '') + '</em></div>';
      }
      const small = row.eligible < 20;
      return '<div class="v3-cc-ret' + (small ? ' is-small' : '') + '"><span class="v3-cc-ret-lab">' + ico('check') + ' ' + label + '</span><strong>' + row.rate + '%</strong><em>' + fmt(row.retained) + ' / ' + fmt(row.eligible) + (small ? ' · მცირე ნიმუში' : '') + '</em><i class="v3-cc-ret-bar" aria-hidden="true"><b style="width:' + Math.min(100, row.rate) + '%"></b></i></div>';
    };
    $('ops-retention').innerHTML = section({
      title: 'შენარჩუნება',
      helpKey: 'overview.retention',
      description: 'რეგისტრაციის კოჰორტები. D1/D7/D30 = აქტივობა +1 / +7 / +30 დღეზე.',
      content: !retention.available
        ? emptyBox('საკმარისი ისტორია არ არის', retention.reason || 'საჭიროა მინიმუმ 5 რეგისტრირებული მომხმარებელი.')
        : '<div class="v3-cc-ret-row">' + cell(retention.d1, 'D1') + cell(retention.d7, 'D7') + cell(retention.d30, 'D30') + '</div>',
    });
  }

  function paintFeatures(root, features) {
    const healthBtn = '<button type="button" class="btn ghost compact" data-go="health">ჯანმრთელობა</button>';
    if (features.error) {
      $('ops-features').innerHTML = section({
        title: 'პროდუქტის სიგნალები',
        helpKey: 'overview.features',
        action: healthBtn,
        content: errBox('ფუნქციები ვერ ჩაიტვირთა', features.error, 'ops-retry-feat'),
      });
      $('ops-retry-feat')?.addEventListener('click', renderCommandCenter);
      return;
    }
    const usable = (features.features || []).filter((f) => !f.unavailable).sort((a, b) => (b.users || 0) - (a.users || 0)).slice(0, 5);
    if (!usable.length) {
      $('ops-features').innerHTML = section({
        title: 'პროდუქტის სიგნალები',
        helpKey: 'overview.features',
        action: healthBtn,
        content: emptyBox('ამ პერიოდში ფუნქციის აქტივობა არ არის', 'დეტალური ანალიტიკა ჯანმრთელობის გვერდზეა.'),
      });
      return;
    }
    const featureIcon = (key) => {
      const map = {
        medi: 'spark', medications: 'pill', cycle: 'activity', hydration: 'activity',
        steps: 'activity', weight: 'activity', visits: 'calendar', weekly_report: 'file',
      };
      return map[key] || 'layers';
    };
    $('ops-features').innerHTML = section({
      title: 'პროდუქტის სიგნალები',
      helpKey: 'overview.features',
      description: 'არჩეული პერიოდი. წილი = ფუნქციის მომხმარებლები ∩ აქტიური.',
      action: healthBtn,
      content: '<div class="v3-cc-signals">' + usable.map((f) => {
        const pct = f.pctOfActive == null ? 0 : Math.min(100, Number(f.pctOfActive));
        return '<button type="button" class="v3-cc-signal" data-href="' + esc(f.href || '#/health') + '">'
        + '<span class="v3-cc-signal-lab">' + ico(featureIcon(f.key)) + '<span>' + esc(f.label) + '</span></span>'
        + '<strong>' + fmt(f.users) + '</strong>'
        + '<em>' + (f.pctOfActive == null ? 'აქტიური ბაზა არ არის' : f.pctOfActive + '% აქტიურებიდან') + '</em>'
        + '<span class="v3-cc-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'
        + '</button>';
      }).join('') + '</div>',
    });
  }

  let ccPollBusy = false;
  let ccPollFails = 0;

  async function refreshCommandCenterLive() {
    if (ccPollBusy) return;
    if ($('ops-refresh')?.classList.contains('is-loading')) return;
    if (!$('ops-status')) return;
    ccPollBusy = true;
    try {
      const system = await api('/system/health');
      ccPollFails = 0;
      ccLive = { status: 'live', at: system.refreshedAt || new Date().toISOString(), error: null };
      const host = document.querySelector('#ops-live-clock');
      if (host) host.outerHTML = liveChip();
      const aiCard = document.querySelector('#ops-live-hero .v3-cc-metric.is-warn strong, #ops-live-hero .v3-cc-hero-grid .v3-cc-metric:last-child strong');
      if (aiCard && system.ai?.errors24h != null) {
        const next = fmt(system.ai.errors24h);
        if (aiCard.textContent !== next) {
          aiCard.textContent = next;
          aiCard.parentElement?.classList.toggle('is-warn', Number(system.ai.errors24h) > 0);
        }
      }
    } catch (err) {
      ccPollFails += 1;
      ccLive = {
        status: ccPollFails >= 2 ? 'failed' : 'delayed',
        at: ccLive.at,
        error: err.message,
      };
      const host = document.querySelector('#ops-live-clock');
      if (host) host.outerHTML = liveChip();
    } finally {
      ccPollBusy = false;
    }
  }

  global.renderCommandCenter = renderCommandCenter;
  global.refreshCommandCenterLive = refreshCommandCenterLive;
})(window);
