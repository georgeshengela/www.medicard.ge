/**
 * Admin V3 Command Center — #/overview only.
 * Real Tbilisi aggregates + Socket.IO live KPIs. No fake scores.
 */
(function commandCenterV3(global) {
  const V3 = () => global.AdminV3 || {};
  const STATUS_KA = {
    healthy: { label: 'ყველაფერი რიგზეა', summary: 'სერვერი, ბაზა და სერვისები ნორმალურად მუშაობს.' },
    attention: { label: 'საჭიროა ყურადღება', summary: 'რამდენიმე რამ საჭიროებს შემოწმებას — სია ქვემოთაა.' },
    degraded: { label: 'სისტემას პრობლემა აქვს', summary: 'სერვერი ან მონაცემთა ბაზა ნორმალურად არ მუშაობს.' },
  };
  const DEST = {
    '#/ai': 'Medi',
    '#/quality': 'ხარისხი',
    '#/push': 'Push & Brain',
    '#/settings': 'აპის რეჟიმი',
    '#/sms': 'SMS',
    '#/pharmacy': 'ფარმაცია',
    '#/health': 'ჯანმრთელობა',
    '#/users': 'მომხმარებლები',
  };

  let ccLive = { status: 'live', at: null, error: null };
  let ccLastUsers = null;
  let ccLastBalances = null;
  let geoMap = null;
  let geoMapboxP = null;
  let geoLast = null;
  let geoThemeObs = null;
  let geoMarkers = [];

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
    // The server repeats some of the checks above (SMS, pharmacy sync, AI). One row per problem:
    // a server item that points at a page already listed only adds its technical detail to that row.
    const byHref = new Map(items.filter((i) => ['sms', 'pharmacy-sync', 'push-failed', 'ai-errors'].includes(i.key)).map((i) => [i.href, i]));
    for (const raw of attention || []) {
      if (!raw?.title || raw.severity === 'info') continue;
      if (/AI შეცდომ/i.test(raw.title) && seen.has('ai-errors')) continue;
      const twin = raw.href && byHref.get(raw.href);
      if (twin) {
        if (raw.detail && /[A-Za-z]{4}/.test(raw.detail) && !/[ა-ჰ]/.test(raw.detail) && !twin.tech) twin.tech = raw.detail;
        continue;
      }
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
    if (global.AdminCharts) {
      return global.AdminCharts.line([{ points: points || [], tone, label }], {
        label, height, empty: 'ამ პერიოდში აქტივობა არ არის',
      });
    }
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

  async function renderCommandCenter(opts) {
    const gen = ++opsFetchGen;
    const root = $('tab-overview');
    destroyGeoMap();
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
        <div id="ops-status"><div class="v3-cc-skel-status" aria-hidden="true"></div></div>
        <div id="ops-attention"></div>
        <div id="ops-live-hero"><div class="v3-cc-skel-row is-hero" aria-hidden="true"></div></div>
        <div id="ops-online"></div>
        <div class="v3-cc-split is-wide">
          <div id="ops-activity">${skel('is-plot')}</div>
          <div id="ops-movement">${skel('is-strip')}</div>
        </div>
        <div id="ops-growth">${skel('is-plot')}</div>
        <div class="v3-cc-split">
          <div id="ops-retention">${skel('is-strip')}</div>
          <div id="ops-features">${skel('is-alert')}</div>
        </div>
        <div id="ops-notif">${skel('is-funnel')}</div>
        <div id="ops-infra">${skel('is-infra')}</div>
        <div id="ops-geo">${skel('is-map')}</div>
      </div>`;
    mountOnline();
    if (typeof bindOpsRange === 'function') bindOpsRange(renderCommandCenter);
    $('ops-refresh')?.addEventListener('click', () => {
      if ($('ops-refresh')?.classList.contains('is-loading')) return;
      renderCommandCenter({ fresh: true });
    });
    const refreshBtn = $('ops-refresh');
    if (refreshBtn) refreshBtn.classList.add('is-loading');

    const q = typeof opsQs === 'function' ? opsQs() : `range=${opsState.range}`;
    const grain = opsState.grain || 'dau';
    const freshQs = opts && opts.fresh === true ? '&fresh=1' : '';
    const [bundle, balances, flags] = await Promise.all([
      api(`/analytics/dashboard?${q}&grain=${grain}${freshQs}`).catch((err) => ({ error: err.message })),
      api('/balances').catch((err) => ({ error: err.message })),
      api('/manage/features').catch(() => null),
    ]);
    const overview = bundle.overview || { error: bundle.error };
    const users = bundle.users || { error: bundle.error };
    const features = bundle.features || { error: bundle.error };
    const retention = bundle.retention || { error: bundle.error };
    const notif = bundle.notifications || { error: bundle.error };
    const system = bundle.system || { error: bundle.error };
    const geo = bundle.geo || { error: bundle.error };
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
    paintStatus(root, resolved, system, overview, balances.error ? ccLastBalances : balances, flags?.features);
    paintAttention(root, resolved);
    paintInfra(root, overview, system, balances.error ? ccLastBalances : balances);
    paintBrain(root, notif);
    paintMovement(root, overview);
    paintActivity(root, users);
    paintGrowth(root, overview);
    paintRetention(root, retention);
    paintFeatures(root, features);
    paintGeo(root, geo);
    bindGo(root);
    applyLiveSnap();
  }


  /* ───────── Online now (owner 2026-10-06) ─────────
   * Who is in the app this minute: AppActivity heartbeat ≤ 90 s (phone ~15 s, web /app 15 s).
   * Socket `ops:online` every 10 s + on activity; HTTP /online-users when the socket is down.
   * Rows are keyed: newcomers slide in, leavers fade out, „N წმ წინ“ ticks every second. */
  const SCREEN_KA = {
    home: 'მთავარი', index: 'მთავარი', cycle: 'MEDICYCLE', assistant: 'Medi', medi: 'Medi', chat: 'Medi',
    scan: 'MEDISCAN', run: 'MEDIRUN', lab: 'MEDILAB', records: 'MEDILAB', record: 'MEDILAB',
    nutrition: 'MEDIFOOD', food: 'MEDIFOOD', medications: 'MEDIPILL', meds: 'MEDIPILL', medication: 'MEDIPILL',
    pets: 'MEDIVET', 'medi-quest': 'MEDIQUEST', quest: 'MEDIQUEST', rewards: 'MEDIQUEST', coach: 'MEDICOACH',
    trainer: 'MEDICOACH', profile: 'პროფილი', settings: 'პარამეტრები', water: 'წყალი', hydration: 'წყალი',
    steps: 'ნაბიჯები', weight: 'წონა', visits: 'ვიზიტები', news: 'სიახლეები', community: 'ქალების სივრცე',
    explore: 'აღმოჩენა', symptoms: 'სიმპტომები', pharmacy: 'აფთიაქი', notifications: 'შეტყობინებები',
    'sign-in': 'შესვლა', 'sign-up': 'რეგისტრაცია', 'profile-setup': 'რეგისტრაცია', assessment: 'რეგისტრაცია',
    onboarding: 'რეგისტრაცია', 'link-account': 'შესვლა', phone: 'შესვლა',
  };
  const PLATFORM_KA = { ios: 'iPhone', android: 'Android', web: 'ვებ' };
  let onlineEls = new Map();
  let onlineTick = null;
  let onlinePoll = null;
  let onlinePollBusy = false;

  function screenKa(screen) {
    const first = String(screen || '').split('/').filter(Boolean)[0];
    return first ? SCREEN_KA[first] || null : null;
  }
  function agoKa(iso) {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 20) return 'ახლა';
    if (s < 60) return `${s} წმ წინ`;
    return `${Math.floor(s / 60)} წთ წინ`;
  }
  function clockOf(iso) {
    const text = iso ? (V3().formatDate ? V3().formatDate(iso, 'datetime') : when(iso)) : '';
    return text.replace(/^დღეს, /, '');
  }
  function personInitials(name) {
    const clean = String(name || '').replace(/^\+/, '').trim();
    if (/^\d/.test(clean)) return '#';
    return typeof initials === 'function' ? initials(clean) : clean.slice(0, 1).toUpperCase();
  }
  // Story circles: the ring wears the colour of the module the person is in (mobile theme/moduleBrand.ts).
  const PLACE_TONE = {
    MEDIRUN: ['#0B4D47', '#0D9488', '#2DD4BF'], Medi: ['#0B4D47', '#0D9488', '#5EEAD4'], MEDICYCLE: ['#831843', '#C92A55', '#FF8FA8'],
    MEDIFOOD: ['#064E3B', '#059669', '#34D399'], MEDIPILL: ['#1E3A8A', '#1D4ED8', '#60A5FA'], MEDIQUEST: ['#3B0764', '#6D28D9', '#A78BFA'],
    MEDIVET: ['#0C4A6E', '#0284C7', '#38BDF8'], MEDICOACH: ['#1F2937', '#475569', '#94A3B8'], MEDISCAN: ['#083344', '#0891B2', '#22D3EE'],
    MEDILAB: ['#1E1B4B', '#4338CA', '#818CF8'], 'მთავარი': ['#0F766E', '#14B8A6', '#99F6E4'], 'ქალების სივრცე': ['#831843', '#DB2777', '#F9A8D4'],
    'რეგისტრაცია': ['#78350F', '#D97706', '#FCD34D'], 'შესვლა': ['#78350F', '#D97706', '#FCD34D'],
  };
  const NEUTRAL_TONE = ['#334155', '#64748B', '#CBD5E1'];
  const placeTone = (place) => PLACE_TONE[place] || NEUTRAL_TONE;
  function onlineTileHtml(u) {
    const name = u.name || u.contact || 'უსახელო';
    const first = String(u.name || '').trim().split(/\s+/)[0] || name;
    const isNew = u.joinedAt && Date.now() - new Date(u.joinedAt).getTime() < 24 * 3600 * 1000;
    const place = placeKa(u.screen);
    const device = [PLATFORM_KA[u.platform] || null, u.platform === 'web' ? null : u.appVersion].filter(Boolean).join(' · ');
    return `
      <span class="cc-st-ring${isNew ? ' is-new' : ''}" aria-hidden="true">
        <span class="cc-st-face${u.gender === 'FEMALE' ? ' is-f' : ''}">${esc(personInitials(name))}</span>
        <span class="cc-st-device" title="${esc(PLATFORM_KA[u.platform] || '')}">${ico(u.platform === 'web' ? 'globe' : 'phone')}</span>
      </span>
      <span class="cc-st-place">${esc(place)}</span>
      <span class="cc-st-name">${esc(first)}</span>
      <span class="cc-st-pop" role="tooltip">
        <b>${esc(name)}</b>${isNew ? ' <span class="s-badge is-accent is-plain">ახალი</span>' : ''}
        ${u.name && u.contact ? `<small>${esc(u.contact)}</small>` : ''}
        <span class="cc-st-pop-row"><i style="background:${placeTone(place)[1]}"></i>${esc(place)}${u.screen && u.screen.includes('/') ? ` <em>· ${esc(u.screen.split('/').slice(1).join('/'))}</em>` : ''}</span>
        ${device ? `<span class="cc-st-pop-row">${esc(device)}</span>` : ''}
        <span class="cc-st-pop-row">${u.firstAt ? `დღეს პირველად ${esc(clockOf(u.firstAt))} · ` : ''}<span data-ago="${esc(u.lastAt)}">${esc(agoKa(u.lastAt))}</span></span>
      </span>`;
  }
  // Many people online stays readable: a summary over everyone (where / which device), chips that filter
  // the list, a search box, and only the first ONLINE_PREVIEW rows until „ყველას ნახვა“.
  const ONLINE_PREVIEW = 24;
  const PLATFORM_ORDER = [['ios', 'iPhone'], ['android', 'Android'], ['web', 'ვებ'], ['unknown', 'უცნობი']];
  const onlineView = { filter: '', query: '', expanded: false, snap: null };
  const placeKa = (screen) => screenKa(screen) || 'სხვა';

  /** Server summary (all online, not just the listed 100) merged onto module names; older servers → from the list. */
  function onlineSummary(snap) {
    const users = snap.users || [];
    const raw = snap.summary || {
      screens: users.reduce((acc, u) => { const k = String(u.screen || '').split('/').filter(Boolean)[0] || ''; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
      platforms: users.reduce((acc, u) => { const k = u.platform || 'unknown'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
      newcomers: users.filter((u) => u.joinedAt && Date.now() - new Date(u.joinedAt).getTime() < 24 * 3600 * 1000).length,
    };
    const places = new Map();
    for (const [first, n] of Object.entries(raw.screens || {})) {
      const label = (first && SCREEN_KA[first]) || 'სხვა';
      places.set(label, (places.get(label) || 0) + Number(n || 0));
    }
    const sorted = [...places].sort((a, b) => (a[0] === 'სხვა') - (b[0] === 'სხვა') || b[1] - a[1]);
    return { places: sorted, platforms: raw.platforms || {}, newcomers: Number(raw.newcomers) || 0 };
  }

  function onlineSummaryHtml(snap, total) {
    const { places, platforms, newcomers } = onlineSummary(snap);
    const chips = [['', 'ყველა', total], ...places.map(([label, n]) => [label, label, n])]
      .map(([key, label, n]) => `<button type="button" role="tab" class="cc-on-chip" aria-selected="${onlineView.filter === key}" data-on-filter="${esc(key)}">${esc(label)}<i>${fmt(n)}</i></button>`).join('');
    const devices = PLATFORM_ORDER.map(([key, label]) => [key, label, Number(platforms[key]) || 0]).filter(([, , n]) => n > 0);
    const sum = devices.reduce((s, [, , n]) => s + n, 0) || 1;
    return `
      <div class="cc-on-places" role="tablist" aria-label="სად არიან">${chips}</div>
      <div class="cc-on-devices">
        <div class="cc-on-bar" role="img" aria-label="${esc(devices.map(([, l, n]) => `${l} ${n}`).join(', '))}">${devices.map(([key, , n]) => `<i class="is-${key}" style="width:${(n / sum) * 100}%"></i>`).join('')}</div>
        <div class="cc-on-legend">${devices.map(([key, label, n]) => `<span><i class="is-${key}"></i>${esc(label)} <b>${fmt(n)}</b> <em>${Math.round((n / sum) * 100)}%</em></span>`).join('')}${newcomers ? `<span class="cc-on-newcount"><span class="s-badge is-accent is-plain">ახალი</span> ${fmt(newcomers)} დღეს დარეგისტრირდა</span>` : ''}</div>
      </div>`;
  }

  function onlineMatches(u) {
    if (onlineView.filter && placeKa(u.screen) !== onlineView.filter) return false;
    const q = onlineView.query.trim().toLowerCase();
    if (!q) return true;
    const digits = q.replace(/\D/g, '');
    const hay = `${u.name || ''} ${u.contact || ''}`.toLowerCase();
    return hay.includes(q) || (digits.length >= 3 && String(u.contact || '').replace(/\D/g, '').includes(digits));
  }

  function paintOnline(snap) {
    const host = $('ops-online');
    if (!host) return;
    if (!host.querySelector('#ops-online-list')) {
      onlineEls = new Map();
      host.innerHTML = section({
        title: 'ვინ არის ახლა აპში',
        description: 'აპში ან ვებ-ვერსიაში ბოლო 90 წამში მყოფი ადამიანები, თავისით ახლდება. რგოლის ფერი და ბეჯი — სად არის ახლა; მოძრავი რგოლი — ახალი მომხმარებელი. ჩიპი ფილტრავს, წრე ხსნის პროფილს.',
        action: '<span class="cc-on-count" id="ops-online-count"><i class="v3-cc-pulse" aria-hidden="true"></i><b>—</b> ონლაინ</span>',
        content: `<div class="cc-on-summary" id="ops-online-summary"></div>
          <div class="cc-on-tools" id="ops-online-tools" hidden>
            <label class="cc-on-search">${ico('search')}<input type="search" id="ops-online-q" placeholder="სახელი ან ნომერი" autocomplete="off" aria-label="ონლაინ მომხმარებლის ძებნა"></label>
            <span class="cc-on-shown" id="ops-online-shown"></span>
          </div>
          <div class="cc-st-grid" id="ops-online-list" role="list" aria-live="polite"></div>`,
        mod: 'cc-on',
      });
      const list = host.querySelector('#ops-online-list');
      list.addEventListener('click', (e) => {
        const row = e.target.closest('[data-user]');
        if (row) location.hash = `#/users/${encodeURIComponent(row.dataset.user)}`;
      });
      list.addEventListener('keydown', (e) => {
        const row = e.target.closest('[data-user]');
        if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); row.click(); }
      });
      host.querySelector('#ops-online-summary').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-on-filter]');
        if (!chip) return;
        onlineView.filter = onlineView.filter === chip.dataset.onFilter ? '' : chip.dataset.onFilter;
        onlineView.expanded = false;
        paintOnline(onlineView.snap);
      });
      host.querySelector('#ops-online-q').addEventListener('input', (e) => {
        onlineView.query = e.target.value;
        paintOnline(onlineView.snap);
      });
      list.addEventListener('click', (e) => {
        if (!e.target.closest('[data-on-more]')) return;
        e.stopPropagation();
        onlineView.expanded = !onlineView.expanded;
        paintOnline(onlineView.snap);
        if (!onlineView.expanded) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, true);
    }
    const list = host.querySelector('#ops-online-list');
    const count = host.querySelector('#ops-online-count');
    if (!snap) {
      if (!list.children.length) list.innerHTML = '<div class="cc-on-empty">იტვირთება…</div>';
      return;
    }
    onlineView.snap = snap;
    // Stable order (who came first today stays put); the server list is newest-heartbeat first.
    const users = [...(snap.users || [])].sort((a, b) => String(b.firstAt || '').localeCompare(String(a.firstAt || '')) || String(a.id).localeCompare(String(b.id)));
    const total = Number(snap.count ?? users.length) || 0;
    if (count) {
      count.querySelector('b').textContent = fmt(total);
      count.classList.toggle('is-empty', !total);
    }
    // A filter whose place emptied out falls back to everyone.
    if (onlineView.filter && !users.some((u) => placeKa(u.screen) === onlineView.filter)) onlineView.filter = '';

    const summary = host.querySelector('#ops-online-summary');
    summary.hidden = !total;
    const summaryHtml = total ? onlineSummaryHtml(snap, total) : '';
    if (summary.dataset.html !== summaryHtml) { summary.innerHTML = summaryHtml; summary.dataset.html = summaryHtml; }

    const matching = users.filter(onlineMatches);
    const visible = onlineView.expanded ? matching : matching.slice(0, ONLINE_PREVIEW);
    const tools = host.querySelector('#ops-online-tools');
    tools.hidden = users.length <= ONLINE_PREVIEW && !onlineView.query;
    const shown = host.querySelector('#ops-online-shown');
    if (shown) {
      const filtered = onlineView.filter || onlineView.query.trim();
      shown.textContent = filtered ? `${fmt(matching.length)} ნაპოვნია` : (total > users.length ? `სიაში პირველი ${fmt(users.length)} · სულ ${fmt(total)}` : '');
    }

    list.querySelectorAll('.cc-on-empty, [data-on-more]').forEach((el) => el.remove());
    const online = new Set(users.map((u) => u.id));
    const keep = new Set(visible.map((u) => u.id));
    for (const [id, el] of onlineEls) {
      if (keep.has(id)) continue;
      onlineEls.delete(id);
      if (online.has(id)) { el.remove(); continue; }
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 380);
    }
    let prev = null;
    for (const u of visible) {
      let el = onlineEls.get(u.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'cc-st is-new';
        el.setAttribute('role', 'listitem');
        el.tabIndex = 0;
        el.dataset.user = u.id;
        onlineEls.set(u.id, el);
        setTimeout(() => el.classList.remove('is-new'), 700);
      }
      const html = onlineTileHtml(u);
      if (el.dataset.html !== html) {
        el.innerHTML = html;
        el.dataset.html = html;
        const [g1, g2, g3] = placeTone(placeKa(u.screen));
        el.style.setProperty('--st-1', g1);
        el.style.setProperty('--st-2', g2);
        el.style.setProperty('--st-3', g3);
        el.setAttribute('aria-label', `${u.name || u.contact || 'უსახელო'} — ${placeKa(u.screen)}`);
      }
      const anchor = prev ? prev.nextSibling : list.firstChild;
      if (el !== anchor) list.insertBefore(el, anchor);
      prev = el;
    }

    // „+N“ is the last circle; expanded, it folds the wall back.
    const hiddenRows = matching.length - visible.length;
    if (hiddenRows > 0 || (onlineView.expanded && matching.length > ONLINE_PREVIEW)) {
      list.insertAdjacentHTML('beforeend', `<button type="button" class="cc-st cc-st-more" data-on-more>
        <span class="cc-st-ring"><span class="cc-st-face">${onlineView.expanded ? ico('chevronLeft') : `+${fmt(hiddenRows)}`}</span></span>
        <span class="cc-st-name">${onlineView.expanded ? 'ნაკლები' : 'ყველა'}</span></button>`);
    }

    if (!total) {
      list.insertAdjacentHTML('beforeend', '<div class="cc-on-empty">ახლა აპში არავინაა. როგორც კი ვინმე შემოვა, აქ თავისით გამოჩნდება.</div>');
    } else if (!matching.length) {
      list.insertAdjacentHTML('beforeend', '<div class="cc-on-empty">ამ ფილტრით ახლა არავინაა.</div>');
    }
  }

  async function pollOnline() {
    if (onlinePollBusy || !$('ops-online-list')) return;
    onlinePollBusy = true;
    try { patchOnlineUsers(await api('/online-users')); } catch { /* the next poll or socket event repaints */ }
    finally { onlinePollBusy = false; }
  }

  function mountOnline() {
    paintOnline(global.__opsOnline || null);
    // The socket sends a list on connect; an admin who opens this page later gets one over HTTP at once.
    void pollOnline();
    if (!onlineTick) {
      onlineTick = setInterval(() => {
        const list = $('ops-online-list');
        if (!list) { clearInterval(onlineTick); onlineTick = null; return; }
        list.querySelectorAll('[data-ago]').forEach((el) => {
          const next = agoKa(el.dataset.ago);
          if (el.textContent !== next) el.textContent = next;
        });
      }, 1000);
    }
    if (!onlinePoll) {
      onlinePoll = setInterval(() => {
        if (!$('ops-online-list')) { clearInterval(onlinePoll); onlinePoll = null; return; }
        if (!global.__adminSocketConnected && !document.hidden) void pollOnline();
      }, 10_000);
    }
  }

  function patchOnlineUsers(snap) {
    if (!snap || !Array.isArray(snap.users)) return;
    global.__opsOnline = snap;
    paintOnline(snap);
    // The hero number and this list come from the same heartbeat window: keep them equal.
    if (typeof global.patchOpsLive === 'function') {
      global.patchOpsLive({ ...(global.__opsLiveSnap || {}), onlineNow: snap.count, refreshedAt: snap.refreshedAt });
    }
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
    const sp = (series, tone) => (global.AdminCharts && series?.length ? global.AdminCharts.spark(series, { tone }) : '');
    $('ops-live-hero').innerHTML = `
      <section class="v3-cc-hero" aria-label="ცოცხალი მდგომარეობა">
        <article class="v3-cc-online${Number(global.__opsLiveSnap?.onlineNow) > 0 ? '' : ' is-empty'}" data-ops-kpi="onlineNow" title="მომხმარებლები, რომელთა AppActivity lastAt ≤ 90 წამია. Socket.IO ops:live.">
          <div class="v3-cc-online-top">
            <span class="v3-cc-pulse" aria-hidden="true"></span>
            <span class="v3-cc-online-label">${ico('activity')} ახლა აპში</span>
            ${V3().infoButton ? V3().infoButton('overview.live') : ''}
          </div>
          <strong>${seedOnline()}</strong>
          <em>რეალურ დროში · ბოლო 90 წამი</em>
        </article>
        <div class="v3-cc-hero-grid">
          ${metric({ kpi: 'activeToday', icon: 'users', label: 'აქტიური დღეს', value: fmt(k.activeToday?.value), period: 'დღეს · თბილისი', tip: k.activeToday?.definition || 'უნიკალური აქტიური მომხმარებლები თბილისის დღეს.', go: 'users', hint: sp(overview.charts?.dau?.series, 'teal') })}
          ${metric({ kpi: 'newUsersToday', icon: 'user', label: 'ახალი დღეს', value: todayNew == null ? '—' : fmt(todayNew), period: 'დღეს · თბილისი', tip: 'რეგისტრაციები მხოლოდ დღეს.', go: 'users', hint: sp(overview.charts?.growth?.newUsers, 'blue') })}
          ${metric({ icon: 'globe', label: 'სულ მომხმარებელი', value: fmt(k.totalUsers?.value), period: 'ყველა დრო', tip: k.totalUsers?.definition || 'რეგისტრირებული ანგარიშები.', go: 'users', hint: sp(overview.charts?.growth?.cumulative, 'violet') })}
          ${metric({ icon: 'spark', label: 'AI შეცდომა', value: fmt(aiErr), period: 'ბოლო 24სთ', tip: 'Medi შეცდომები კედლის საათით.', go: 'ai', warn: aiErr > 0, hint: sp(system.ai?.series, 'rose') })}
        </div>
      </section>`;
  }

  function paintStatus(root, resolved, system, overview, balances, features) {
    const ka = STATUS_KA[resolved.level] || STATUS_KA.healthy;
    const env = system.environment || overview.environment;
    const apiOk = system.api?.ok !== false && !system.error;
    const dbOk = system.database?.ok !== false;
    const or = balances?.openrouter;
    const orTone = or?.tone === 'bad' ? 'is-bad' : or?.tone === 'warn' ? 'is-warn' : 'is-ok';
    const orChip = or && (or.remaining != null || or.error)
      ? `<button type="button" class="v3-cc-chip ${orTone}" data-scroll="ops-infra" title="OpenRouter-ის დარჩენილი ბალანსი — Medi-ს სურათების ანალიზი">${ico('wallet')} OpenRouter ${or.remaining != null ? esc(usd(or.remaining)) : 'ვერ შემოწმდა'}</button>`
      : '';
    // A paused module is a decision, not a fault: a reminder chip, the status level stays as it is.
    const paused = (features || []).filter((f) => f.enabled === false);
    const pausedChip = paused.length
      ? `<button type="button" class="v3-cc-chip is-warn" data-href="#/features" title="${esc(paused.map((f) => f.label).join(', '))}">${ico('lock')} შეჩერებულია: ${esc(paused.length > 2 ? `${paused.length} მოდული` : paused.map((f) => f.label).join(', '))}</button>`
      : '';
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
          ${orChip}
          ${env ? `<span class="v3-cc-chip${env === 'production' ? ' is-prod' : ''}" title="გარემო">${ico('globe')} ${env === 'production' ? 'წარმოება' : esc(env)}</span>` : ''}
          ${system.settings?.maintenanceMode ? `<span class="v3-cc-chip is-warn">${ico('lock')} ოფლაინ რეჟიმი</span>` : ''}
          ${system.settings?.forceUpdate ? `<span class="v3-cc-chip is-warn">${ico('download')} იძულებითი განახლება</span>` : ''}
          ${pausedChip}
        </div>
      </section>`;
    $('ops-status').querySelector('[data-scroll]')?.addEventListener('click', (e) => {
      $(e.currentTarget.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function paintAttention(root, resolved) {
    // Nothing to act on → the status band above already says so; no second "all good" card.
    if (!resolved.items.length) {
      $('ops-attention').innerHTML = '';
      return;
    }
    $('ops-attention').innerHTML = section({
      title: 'საჭიროებს ყურადღებას',
      helpKey: 'overview.attention',
      description: `${resolved.items.length === 1 ? '1 საკითხი' : `${resolved.items.length} საკითხი`} — დააჭირე სტრიქონს, გადაგიყვანს შესაბამის გვერდზე.`,
      content: `<div class="v3-cc-alerts">${resolved.items.map((item) => `
        <button type="button" class="v3-cc-alert is-${item.severity}" data-href="${esc(item.href || '#/quality')}">
          <span class="v3-cc-alert-ico" aria-hidden="true">${ico(alertIcon(item))}</span>
          <span class="v3-cc-alert-copy">
            <strong>${esc(item.title)}</strong>
            <span>${esc(item.detail || '')}</span>
            ${item.tech ? `<code class="v3-cc-alert-tech" title="${esc(item.tech)}">${esc(item.tech)}</code>` : ''}
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
            ${settings.forceUpdate ? `<span class="v3-cc-chip is-warn">${ico('download')} იძულებითი განახლება</span>` : ''}
            ${settings.maintenanceMode ? `<span class="v3-cc-chip is-warn">${ico('lock')} ტექნიკური სამუშაოები</span>` : ''}
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
          ${emd?.error ? `<p class="${emdTone === 'bad' ? 'v3-cc-infra-err' : 'v3-cc-infra-note'}">${esc(emd.error)}</p>` : ''}
          <a class="v3-cc-infra-link" href="${esc(emd?.dashboardUrl || 'https://evidencemd.ai/developers')}" target="_blank" rel="noreferrer">${ico('link')} დეშბორდი</a>
        </article>
        <article class="v3-cc-infra-card" title="AI ტელემეტრია ბოლო 24 საათში">
          <span class="v3-cc-infra-kicker">${ico('spark')} Medi · 24სთ</span>
          <strong class="v3-cc-infra-value">${fmt(system.ai?.last24h ?? 0)}</strong>
          <em>მოთხოვნა · შეცდომა ${fmt(system.ai?.errors24h ?? 0)} · ${system.ai?.errorRate24h != null ? `${system.ai.errorRate24h}%` : '—'}</em>
          <div class="v3-cc-infra-stats">
            <span><b>შეცდომა 7დ</b> ${fmt(system.ai?.errors7d ?? 0)}</span>
            <span><b>Push 24სთ</b> ${fmt(system.push?.sent24h ?? 0)}</span>
            <span><b>SMS შეცდომა</b> ${fmt(system.sms?.failed24h ?? 0)}</span>
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
        ${global.AdminCharts
          ? global.AdminCharts.line(
            [{ points: data.series || [], tone: 'teal', label: 'არჩეული პერიოდი' }]
              .concat(data.previousSeries?.length ? [{ points: data.previousSeries, tone: 'ink', label: 'წინა პერიოდი' }] : []),
            { label: grain.toUpperCase(), height: 260, empty: 'ამ პერიოდში აქტივობა არ არის' },
          )
          : lineChart(data.series, { label: grain.toUpperCase(), height: 240 })}
        <p class="v3-cc-plot-meta">${(() => {
          const series = data.series || [];
          const start = series.findIndex((d) => d.count > 0);
          const usable = start >= 0 ? series.slice(start) : [];
          const avg = usable.length
            ? Math.round(usable.reduce((sum, d) => sum + d.count, 0) / usable.length)
            : null;
          return [
            data.summary?.peak ? `პიკი ${global.AdminCharts?.dayLabel ? global.AdminCharts.dayLabel(data.summary.peak.day, true) : data.summary.peak.day} · ${fmt(data.summary.peak.count)}` : '',
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
      content: global.AdminCharts?.bars
        ? global.AdminCharts.bars(growthSeries, { label: 'ახალი მომხმარებელი', height: 200, tone: 'blue', empty: 'ამ პერიოდში ახალი რეგისტრაცია არ არის' })
        : lineChart(growthSeries, { label: 'ახალი მომხმარებელი', height: 200, tone: 'blue' }),
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

  function flagImg(code, cls = 'v3-cc-geo-flag') {
    const iso = String(code || '').toLowerCase();
    if (!/^[a-z]{2}$/.test(iso)) {
      return `<span class="v3-cc-geo-iso">${esc(String(code || '').toUpperCase())}</span>`;
    }
    return `<img class="${cls}" src="https://flagcdn.com/w80/${iso}.png" srcset="https://flagcdn.com/w40/${iso}.png 1x, https://flagcdn.com/w80/${iso}.png 2x" width="20" height="15" alt="" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'v3-cc-geo-iso',textContent:'${iso.toUpperCase()}'}))">`;
  }

  function destroyGeoMap() {
    clearGeoMarkers();
    if (geoMap) {
      try { geoMap.remove(); } catch (_) { /* already gone */ }
      geoMap = null;
    }
  }

  function clearGeoMarkers() {
    geoMarkers.forEach((marker) => { try { marker.remove(); } catch (_) { /* gone */ } });
    geoMarkers = [];
  }

  function loadMapboxGl() {
    if (global.mapboxgl) return Promise.resolve(global.mapboxgl);
    if (geoMapboxP) return geoMapboxP;
    geoMapboxP = new Promise((resolve, reject) => {
      if (!document.getElementById('mapbox-gl-css')) {
        const css = document.createElement('link');
        css.id = 'mapbox-gl-css';
        css.rel = 'stylesheet';
        css.href = 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css';
        document.head.appendChild(css);
      }
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js';
      script.onload = () => resolve(global.mapboxgl);
      script.onerror = () => {
        geoMapboxP = null;
        reject(new Error('Mapbox GL ვერ ჩაიტვირთა'));
      };
      document.head.appendChild(script);
    });
    return geoMapboxP;
  }

  function geoStyleUrl() {
    return document.documentElement.dataset.theme === 'dark'
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11';
  }

  function bindGeoTheme() {
    if (geoThemeObs) return;
    geoThemeObs = new MutationObserver(() => {
      if (!geoMap || !geoLast?.token) return;
      const next = geoStyleUrl();
      const current = geoMap.getStyle()?.sprite || '';
      if ((next.includes('dark-v11') && String(current).includes('dark-v11'))
        || (next.includes('light-v11') && String(current).includes('light-v11'))) return;
      geoMap.setStyle(next);
      geoMap.once('style.load', () => paintGeoLayers(geoMap, geoLast));
    });
    geoThemeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function paintGeoLayers(map, geo) {
    const countries = geo.countries || [];
    if (map.getLayer('geo-line')) map.removeLayer('geo-line');
    if (map.getLayer('geo-fill')) map.removeLayer('geo-fill');
    if (map.getSource('countries')) map.removeSource('countries');
    const codes = countries.map((row) => row.code);
    map.addSource('countries', {
      type: 'vector',
      url: 'mapbox://mapbox.country-boundaries-v1',
      promoteId: { country_boundaries: 'iso_3166_1' },
    });
    const lit = codes.length ? ['in', ['get', 'iso_3166_1'], ['literal', codes]] : ['==', ['get', 'iso_3166_1'], ''];
    map.addLayer({
      id: 'geo-fill',
      type: 'fill',
      source: 'countries',
      'source-layer': 'country_boundaries',
      filter: ['all', ['match', ['get', 'worldview'], ['all', 'US'], true, false], lit],
      paint: {
        'fill-color': [
          'interpolate', ['linear'], ['coalesce', ['feature-state', 'users'], 1],
          1, '#99F6E4',
          8, '#14B8A6',
          25, '#0D9488',
        ],
        'fill-opacity': 0.55,
      },
    });
    map.addLayer({
      id: 'geo-line',
      type: 'line',
      source: 'countries',
      'source-layer': 'country_boundaries',
      filter: ['all', ['match', ['get', 'worldview'], ['all', 'US'], true, false], lit],
      paint: {
        'line-color': '#14B8A6',
        'line-width': 1.15,
        'line-opacity': 0.9,
      },
    });
    for (const row of countries) {
      map.setFeatureState(
        { source: 'countries', sourceLayer: 'country_boundaries', id: row.code },
        { users: row.users },
      );
    }
    clearGeoMarkers();
    for (const row of countries) {
      if (row.lng == null || row.lat == null) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'v3-cc-geo-pin';
      el.setAttribute('aria-label', `${row.nameKa}: ${row.users}`);
      el.innerHTML = `${flagImg(row.code, 'v3-cc-geo-pin-flag')}<b>${fmt(row.users)}</b>`;
      const popup = new global.mapboxgl.Popup({ offset: 18, closeButton: false, className: 'v3-cc-geo-pop' })
        .setHTML(`<strong>${flagImg(row.code)} ${esc(row.nameKa)}</strong><span>${fmt(row.users)} მომხმარებელი</span>`);
      const marker = new global.mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([row.lng, row.lat])
        .setPopup(popup)
        .addTo(map);
      el.addEventListener('click', () => marker.togglePopup());
      geoMarkers.push(marker);
    }
  }

  function fitGeoMap(map, countries) {
    const pts = (countries || []).filter((c) => c.lng != null && c.lat != null);
    if (!pts.length) {
      map.jumpTo({ center: [43.5, 42], zoom: 3.2 });
      return;
    }
    if (pts.length === 1) {
      map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 4.6 });
      return;
    }
    const bounds = pts.reduce(
      (b, c) => b.extend([c.lng, c.lat]),
      new global.mapboxgl.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat]),
    );
    map.fitBounds(bounds, { padding: 56, maxZoom: 4.8, duration: 0 });
  }

  async function mountGeoMap(geo) {
    const host = $('ops-geo-map');
    if (!host || !geo?.token) return;
    try {
      const mapboxgl = await loadMapboxGl();
      if (!$('ops-geo-map')) return;
      mapboxgl.accessToken = geo.token;
      destroyGeoMap();
      geoMap = new mapboxgl.Map({
        container: host,
        style: geoStyleUrl(),
        center: [43.5, 42],
        zoom: 3.2,
        attributionControl: true,
        cooperativeGestures: true,
      });
      geoMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      geoMap.once('load', () => {
        geoMap.resize();
        paintGeoLayers(geoMap, geo);
        fitGeoMap(geoMap, geo.countries);
      });
      bindGeoTheme();
    } catch (err) {
      host.innerHTML = `<p class="muted">${esc(err.message || 'რუკა ვერ ჩაიტვირთა')}</p>`;
    }
  }

  function paintGeo(_root, geo) {
    const host = $('ops-geo');
    if (!host) return;
    if (geo.error) {
      host.innerHTML = section({
        title: 'ქვეყნები',
        helpKey: 'overview.geo',
        content: errBox('რუკა ვერ ჩაიტვირთა', geo.error, 'ops-retry-geo'),
      });
      $('ops-retry-geo')?.addEventListener('click', renderCommandCenter);
      return;
    }
    geoLast = geo;
    const countries = geo.countries || [];
    const located = Number(geo.located) || 0;
    const unknown = Number(geo.unknown) || 0;
    const list = countries.length
      ? '<ol class="v3-cc-geo-list">' + countries.map((row, i) => (
        `<li><button type="button" class="v3-cc-geo-item" data-geo-i="${i}">`
        + `${flagImg(row.code)}`
        + `<span class="v3-cc-geo-name">${esc(row.nameKa)}</span>`
        + `<strong>${fmt(row.users)}</strong></button></li>`
      )).join('')
        + (unknown ? `<li class="v3-cc-geo-unknown"><span>უცნობი ქვეყანა</span><strong>${fmt(unknown)}</strong></li>` : '')
        + '</ol>'
      : emptyBox(
        'ქვეყანა ჯერ არ ჩანს',
        unknown
          ? `${fmt(unknown)} მომხმარებელს მდებარეობა ჯერ არ აქვს — რუკა ინათება GPS ქვეყნის მოსვლისას.`
          : 'რუკა ინათება, როცა მომხმარებელი მდებარეობას დაუშვებს.',
      );
    const mapPane = geo.token
      ? '<div id="ops-geo-map" class="v3-cc-geo-map" role="img" aria-label="მომხმარებლების ქვეყნები"></div>'
      : `<div class="v3-cc-geo-missing">${emptyBox('Mapbox ტოკენი არ არის', 'დაამატეთ MAPBOX_PUBLIC_TOKEN (pk.*) სერვერის გარემოში — იგივე public ტოკენი, რაც მობილურ Run რუკაზეა.')}</div>`;
    host.innerHTML = section({
      title: 'ქვეყნები',
      helpKey: 'overview.geo',
      description: located
        ? `${fmt(countries.length)} ქვეყანა · ${fmt(located)} მომხმარებელი მდებარეობით` + (unknown ? ` · ${fmt(unknown)} უცნობი` : '') + '.'
        : 'ქვეყანა ინათება პირველი რეგისტრაციისას, როცა GPS ქვეყანა ცნობილია.',
      content: `<div class="v3-cc-geo">${mapPane}${list}</div>`,
    });
    host.querySelectorAll('[data-geo-i]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = countries[Number(btn.dataset.geoI)];
        if (!row || row.lng == null || !geoMap) return;
        geoMap.flyTo({ center: [row.lng, row.lat], zoom: 4.8, duration: 700 });
        host.querySelectorAll('.v3-cc-geo-item').forEach((el) => el.classList.toggle('is-on', el === btn));
      });
    });
    mountGeoMap(geo);
  }

  let ccPollBusy = false;
  let ccPollFails = 0;

  async function refreshCommandCenterLive() {
    if (ccPollBusy) return;
    if (global.__adminSocketConnected || global.adminSocketLive) return;
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
  global.patchOnlineUsers = patchOnlineUsers;
})(window);
