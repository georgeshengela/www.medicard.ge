/**
 * MediCard Admin V3 — Rewards Operations (major override of renderRewards).
 * URL: #/rewards?tab=overview|campaigns|partners|redemptions|codes&edit=new
 * Loaded after rewards-admin.js + admin-v3.js + AdminV3Shell.
 */
(function adminV3Rewards(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const TABS = [
    ['overview', 'მიმოხილვა'],
    ['campaigns', 'კამპანიები'],
    ['partners', 'პარტნიორები'],
    ['redemptions', 'გაცვლები'],
    ['codes', 'კოდების მარაგი'],
  ];
  const TAB_KEYS = new Set(TABS.map(([k]) => k));

  const STATUS_KA = global.STATUS_KA || {
    DRAFT: 'მონახაზი',
    ACTIVE: 'აქტიური',
    PAUSED: 'შეჩერებული',
    ARCHIVED: 'დაარქივებული',
    SCHEDULED: 'დაგეგმილი',
    ENDED: 'დასრულებული',
    ISSUED: 'გაცემული',
    USED: 'გამოყენებული',
    EXPIRED: 'ვადაგასული',
    CANCELLED: 'გაუქმებული',
    PENDING: 'მოლოდინში',
    OK: 'კარგი',
    LOW: 'დაბალი',
    OUT: 'ამოწურული',
    UNLIMITED: 'ულიმიტო',
  };
  const CATEGORY_KA = global.CATEGORY_KA || {
    PHARMACY: 'აფთიაქი',
    LAB: 'ლაბორატორია',
    FITNESS: 'ფიტნესი',
    WELLNESS: 'ველნესი',
    FOOD: 'კვება',
    RETAIL: 'რითეილი',
    INSURANCE: 'დაზღვევა',
    CLINIC: 'კლინიკა',
    OTHER: 'სხვა',
  };
  const FUNDING_KA = {
    PER_REDEMPTION: 'თითო გაცვლაზე',
    PER_USED: 'თითო გამოყენებაზე',
    SPONSORED_FIXED: 'სპონსორი · ფიქსი',
    AFFILIATE: 'აფილიატი',
    INTERNAL: 'შიდა',
  };

  function esc(v) {
    return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '');
  }
  function fmt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('ka-GE');
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function tile(name, tone) {
    return typeof iconTile === 'function'
      ? iconTile(name, tone)
      : `<span class="icon-tile ${tone || ''}">${ico(name)}</span>`;
  }

  async function apiRewards(path, options = {}) {
    if (typeof global.apiRewards === 'function') return global.apiRewards(path, options);
    return api(`/rewards${path}`, options);
  }

  function statusKa(s) {
    return STATUS_KA[s] || s || '—';
  }
  function statusTone(s) {
    if (s === 'ACTIVE' || s === 'ISSUED' || s === 'OK') return 'ok';
    if (s === 'PAUSED' || s === 'LOW' || s === 'SCHEDULED' || s === 'PENDING') return 'warn';
    if (s === 'ENDED' || s === 'EXPIRED' || s === 'OUT' || s === 'CANCELLED' || s === 'ARCHIVED') return 'bad';
    return 'neutral';
  }
  function statusPill(s) {
    return V().statusBadge
      ? V().statusBadge(s, { type: 'rewardStatus' })
      : `<span class="badge ${statusTone(s)}">${esc(statusKa(s))}</span>`;
  }
  function whenKa(iso) {
    if (V().formatDate) return V().formatDate(iso);
    return typeof fmtDate === 'function' ? fmtDate(iso) : iso || '—';
  }
  function dayKa(isoDay) {
    if (!isoDay) return '—';
    if (typeof adminDateParts !== 'function') return isoDay;
    const p = adminDateParts(`${isoDay}T12:00:00Z`);
    if (!p) return isoDay;
    return `${WEEKDAYS_KA_SHORT[p.weekday]}, ${p.day} ${MONTHS_KA[p.month]}`;
  }
  function sanitizeKey(v) {
    return String(v || '')
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
  }
  function intOrNull(v) {
    const s = String(v ?? '').trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  function toIsoOrNull(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }

  function readState() {
    const hs = Shell().hashParams?.() || new URLSearchParams();
    let tab = hs.get('tab') || 'overview';
    if (!TAB_KEYS.has(tab)) tab = 'overview';
    const edit = hs.get('edit') || '';
    return { tab, edit };
  }

  function writeState(updates) {
    Shell().writeModuleHash?.('rewards', updates);
  }

  function headerFor(tab, edit) {
    if (edit === 'new' || tab === 'campaigns') {
      return {
        tab: 'rewards',
        kicker: 'Commerce',
        title: edit === 'new' ? 'ახალი კამპანია' : 'კამპანიები',
        purpose: edit === 'new'
          ? 'ინახება მონახაზად. აპში გამოჩნდება მხოლოდ გააქტიურების შემდეგ.'
          : 'ჯილდოს კამპანიების შექმნა და სტატუსი.',
        helpKey: 'campaigns.page',
      };
    }
    const map = {
      overview: {
        title: 'ჯილდოების ოპერაციები',
        purpose: 'პარტნიორები, კამპანიები, კოდები და გაცვლები — მხოლოდ კომერციული მონაცემები.',
        helpKey: 'rewards.page',
      },
      partners: {
        title: 'პარტნიორები',
        purpose: 'ბიზნეს-ერთეულების რეესტრი.',
        helpKey: 'partners.page',
      },
      redemptions: {
        title: 'გაცვლები',
        purpose: 'ვინ გაცვალა ჯილდო და რა სტატუსი აქვს.',
        helpKey: 'redemptions.page',
      },
      codes: {
        title: 'კოდების მარაგი',
        purpose: 'იმპორტი და შენიღბული სია — სრული კოდები ბრაუზერში არ ჩანს.',
        helpKey: 'codes.page',
      },
    };
    const row = map[tab] || map.overview;
    return { tab: 'rewards', kicker: 'Commerce', ...row };
  }

  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
  }

  function emptyState(title, body, ctaHtml = '') {
    if (V().emptyState) return V().emptyState(title, body, ctaHtml);
    return `<div class="v3-rewards-empty">
      <span class="v3-rewards-empty-ico">${ico('layers')}</span>
      <strong>${esc(title)}</strong>
      ${body ? `<p>${esc(body)}</p>` : ''}
      ${ctaHtml}
    </div>`;
  }

  function kpiCell(icoName, label, value, hint, tone) {
    const toneClass = tone === 'warn' ? ' is-amber' : tone === 'bad' ? ' is-danger' : tone === 'ok' ? ' is-ok' : tone === 'soft' ? ' is-soft' : '';
    return `<article class="v3-rewards-kpi${toneClass}">
      <span class="v3-rewards-kpi-ico" aria-hidden="true">${ico(icoName || 'activity')}</span>
      <div class="v3-rewards-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${value}</strong>
        ${hint != null && hint !== '' ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function trendChart(trend) {
    const points = (trend || []).map((d) => ({ day: d.day, count: Number(d.redemptions) || 0 }));
    const hasData = points.some((p) => p.count > 0);
    if (!hasData) {
      return emptyState('ამ კვირაში გაცვლა არ არის', 'ტრენდი აქ გამოჩნდება პირველი გაცვლის შემდეგ.');
    }
    if (typeof opsLineChart === 'function') {
      return opsLineChart([{ points, tone: 'teal', label: 'გაცვლები' }], { label: 'გაცვლები · 7 დღე', height: 156 });
    }
    const max = Math.max(1, ...points.map((p) => p.count));
    return `<div class="v3-rewards-mini-bars">${points
      .map(
        (p) => `<div class="v3-rewards-mini-bar" title="${esc(dayKa(p.day))}: ${p.count}">
        <span style="height:${Math.max(4, Math.min(100, Math.round((p.count / max) * 100)))}%"></span>
        <em>${esc(String(p.day).slice(8))}</em>
      </div>`,
      )
      .join('')}</div>`;
  }

  function shellHtml(active, body) {
    const S = Shell();
    const nav = S.subnav ? S.subnav(TABS, active, 'data-rewards-sub') : '';
    const inner = `<div class="v3-tab-shell v3-rewards-shell">${nav}<div class="v3-rewards-pane">${body}</div></div>`;
    return S.workspace
      ? S.workspace(inner, 'v3-rewards')
      : `<div class="v3-workspace-wide v3-module v3-rewards rw-page dash-enter">${inner}</div>`;
  }

  function bindSubnav(root) {
    const S = Shell();
    if (S.bindSubnav) {
      S.bindSubnav(root, 'data-rewards-sub', async (key) => {
        if (V().dirty) {
          const ok = await V().confirmLeave?.();
          if (!ok) return;
        }
        V().setDirty?.(false);
        writeState({ tab: key, edit: null });
        void renderRewards();
      });
      return;
    }
    root.querySelectorAll('[data-rewards-sub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        writeState({ tab: btn.getAttribute('data-rewards-sub'), edit: null });
        void renderRewards();
      });
    });
  }

  function categoryOptions(selected) {
    return Object.entries(CATEGORY_KA)
      .map(([k, label]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(label)}</option>`)
      .join('');
  }

  async function mutate(action, { successMessage, pendingElement, refresh } = {}) {
    const run = V().runMutation;
    if (run) {
      return run({
        action,
        pendingElement,
        successMessage,
        refresh: refresh || (() => renderRewards()),
      });
    }
    try {
      const result = await action();
      if (successMessage && typeof toast === 'function') toast(successMessage, 'ok');
      if (refresh) await refresh(result);
      else await renderRewards();
      return { ok: true, result };
    } catch (err) {
      if (typeof toast === 'function') toast(err.message || 'შეცდომა', 'bad');
      return { ok: false, error: err };
    }
  }

  function confirmThen(opts) {
    const open = V().openConfirm;
    if (!open) {
      if (global.confirm?.(opts.message || opts.title)) void opts.onConfirm?.();
      return;
    }
    open(opts);
  }

  /* ── Overview ─────────────────────────────────────────── */

  async function renderOverview(root) {
    const data = await apiRewards('/overview');
    const k = data.kpis || {};
    const low = data.needsAttention?.lowStock || [];
    const ending = data.needsAttention?.endingSoon || [];
    const recent = data.recentActivity || [];
    const hasAttention = low.length > 0 || ending.length > 0;
    const totalAttention = low.length + ending.length;

    root.innerHTML = shellHtml(
      'overview',
      `
      <div class="v3-rewards-body" data-v3-rewards="overview">
        <div class="v3-rewards-toolbar">
          <div class="v3-rewards-toolbar-copy">
            <strong>ჯილდოების ობსერვატორია</strong>
            <span>კომერციული მეტრიკები მხოლოდ · ბოლო 7 დღე · ჯანმრთელობის მონაცემები აქ არ ჩანს</span>
          </div>
          <div class="v3-rewards-toolbar-actions">
            ${helpBtn('rewards.overview')}
            <button type="button" class="btn ghost compact" id="rw-refresh">${ico('refresh')} განახლება</button>
          </div>
        </div>

        <div class="v3-rewards-kpis" role="group" aria-label="ოპერაციული მდგომარეობა">
          ${kpiCell('layers', 'აქტიური კამპანია', fmt(k.activeCampaigns), `${fmt(k.partnersActive)} პარტნიორი`, 'soft')}
          ${kpiCell('zap', 'გაცვლა დღეს', fmt(k.redemptionsToday), 'დღევანდელი · თბილისი')}
          ${kpiCell('activity', 'გაცვლა 7 დღე', fmt(k.redemptions7d), 'ბოლო კვირა')}
          ${kpiCell('file', 'ხელმისაწვდომი კოდი', fmt(k.codesAvailable), 'მარაგი')}
          ${kpiCell('alert', 'დაბალი მარაგი', fmt(k.codesLowStock), k.codesLowStock > 0 ? 'საჭიროებს ყურადღებას' : 'ყველაფერი წესრიგშია', k.codesLowStock > 0 ? 'warn' : 'ok')}
          ${kpiCell('spark', 'დახარჯული Coins 7დ', fmt(k.coinsSpentOnRewards7d), 'Medi Coins')}
        </div>

        <div class="v3-rewards-split">
          <section class="v3-rewards-panel" data-v3-rewards="trend">
            <div class="v3-rewards-head">
              <div class="v3-rewards-head-copy">
                <div class="v3-title-row"><h3>გაცვლების ტრენდი</h3></div>
                <p class="muted">ბოლო 7 დღე · Asia/Tbilisi</p>
              </div>
            </div>
            <div class="v3-rewards-chart">${trendChart(data.trend7d)}</div>
          </section>

          <section class="v3-rewards-panel" data-v3-rewards="attention">
            <div class="v3-rewards-head">
              <div class="v3-rewards-head-copy">
                <div class="v3-title-row"><h3>საჭიროებს ყურადღებას</h3></div>
                <p class="muted">მარაგი და კამპანიის ვადები</p>
              </div>
              ${hasAttention ? `<span class="v3-rewards-att-count">${fmt(totalAttention)}</span>` : ''}
            </div>
            ${
              !hasAttention
                ? `<div class="v3-rewards-healthy"><span class="v3-rewards-healthy-ico">${ico('check')}</span><div><strong>ყველაფერი წესრიგშია</strong><p>ქმედება არ არის საჭირო.</p></div></div>`
                : `<div class="v3-rewards-attention">
                    ${
                      low.length
                        ? `<div class="v3-rewards-att-block">
                            <div class="v3-rewards-att-label"><span>დაბალი / ამოწურული მარაგი</span>
                              <button type="button" class="btn tiny ghost" data-rewards-go="codes">კოდები</button></div>
                            <ul>${low.map((x) => `<li>
                              <code>${esc(x.rewardKey)}</code>
                              ${statusPill(x.stockState)}
                              <strong>${fmt(x.available)}</strong>
                            </li>`).join('')}</ul>
                          </div>`
                        : ''
                    }
                    ${
                      ending.length
                        ? `<div class="v3-rewards-att-block">
                            <div class="v3-rewards-att-label"><span>მალე მთავრდება</span>
                              <button type="button" class="btn tiny ghost" data-rewards-go="campaigns">კამპანიები</button></div>
                            <ul>${ending.map((x) => `<li>
                              <strong>${esc(x.name)}</strong>
                              <span class="muted">${esc(x.partnerKey || '—')}</span>
                              <em>${esc(whenKa(x.endsAt))}</em>
                            </li>`).join('')}</ul>
                          </div>`
                        : ''
                    }
                  </div>`
            }
          </section>
        </div>

        <section class="v3-rewards-panel" data-v3-rewards="recent">
          <div class="v3-rewards-head">
            <div class="v3-rewards-head-copy">
              <div class="v3-title-row"><h3>ბოლო ოპერაციები</h3></div>
              <p class="muted">გაცვლის ჟურნალი — შენიღბული მომხმარებელი</p>
            </div>
            <button type="button" class="btn ghost compact" data-rewards-go="redemptions">${ico('activity')} ყველა გაცვლა</button>
          </div>
          ${
            recent.length === 0
              ? emptyState('ჯერ გაცვლა არ არის', 'პირველი გაცვლა აქ გამოჩნდება. წარმოებაში ფიქტიური პარტნიორები ნუ გაააქტიურებთ.')
              : `<div class="v3-rewards-table-wrap"><table class="v3-rewards-table">
                <thead><tr><th>ID</th><th>ჯილდო</th><th>კამპანია</th><th>სტატუსი</th><th>Coins</th><th>მომხმარებელი</th><th>დრო</th></tr></thead>
                <tbody>${recent
                  .map(
                    (r) => `<tr data-rewards-go="redemptions" data-red="${esc(r.id)}" class="is-click">
                    <td class="mono">${esc(String(r.id).slice(0, 8))}…</td>
                    <td><code>${esc(r.rewardKey || '—')}</code></td>
                    <td>${esc(r.campaignKey || '—')}</td>
                    <td>${statusPill(r.status)}</td>
                    <td class="num">${fmt(r.coinCost)}</td>
                    <td class="mono muted">${esc(r.maskedUserRef || '—')}</td>
                    <td class="muted">${esc(whenKa(r.redeemedAt))}</td>
                  </tr>`,
                  )
                  .join('')}</tbody></table></div>`
          }
        </section>
      </div>
    `,
    );
    bindSubnav(root);
    $('rw-refresh')?.addEventListener('click', () => void renderRewards());
    root.querySelectorAll('[data-rewards-go]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = el.getAttribute('data-rewards-go');
        if (!TAB_KEYS.has(tab)) return;
        writeState({ tab, edit: '' });
        void renderRewards();
      });
    });
  }

  /* ── Campaign create (full page, not drawer) ──────────── */

  function field(opts) {
    return V().field ? V().field(opts) : `<label class="field"><span>${esc(opts.label || '')}</span>${opts.control || ''}</label>`;
  }
  function input(opts) {
    return V().input ? V().input(opts) : `<input id="${esc(opts.id || '')}" type="${esc(opts.type || 'text')}" value="${esc(opts.value || '')}" placeholder="${esc(opts.placeholder || '')}" />`;
  }

  async function renderCampaignForm(root) {
    let partners = [];
    let defs = [];
    try {
      const [p, d] = await Promise.all([apiRewards('/partners'), apiRewards('/definitions')]);
      partners = p.items || [];
      defs = (d.items || []).filter((x) => x.type === 'PARTNER_VOUCHER' || x.type === 'COUPON_CODE' || x.partnerKey);
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || 'სია ვერ ჩაიტვირთა', 'bad');
      writeState({ tab: 'campaigns', edit: null });
      await renderCampaigns(root);
      return;
    }
    if (!partners.length) {
      if (typeof toast === 'function') toast('ჯერ შექმენით პარტნიორი', 'bad');
      writeState({ tab: 'partners', edit: null });
      await renderPartners(root);
      return;
    }

    const partnerOpts = partners.map((p) => [
      p.id,
      `${p.displayName} · ${p.key}${p.status !== 'ACTIVE' ? ' · არააქტიური' : ''}`,
    ]);
    const defOpts = [['', 'ახალი პარტნიორის ვაუჩერი']].concat(
      defs.map((x) => [x.id, `${x.key} · ${fmt(x.coinCost)} coins`]),
    );
    const fundingOpts = Object.entries(FUNDING_KA);

    const sticky = V().stickyActions
      ? V().stickyActions({
          dirty: false,
          cancel: `<button type="button" class="btn ghost" id="rw-c-cancel">გაუქმება</button>`,
          save: `<button type="button" class="btn primary" id="rw-c-save">შექმნა · მონახაზი</button>`,
        })
      : `<footer class="v3-sticky-actions" id="v3-sticky-actions">
          <div class="v3-sticky-actions-main">
            <button type="button" class="btn ghost" id="rw-c-cancel">გაუქმება</button>
            <button type="button" class="btn primary" id="rw-c-save">შექმნა · მონახაზი</button>
          </div>
        </footer>`;

    root.innerHTML = shellHtml(
      'campaigns',
      `
      <div class="v3-form-rail v3-campaign-form">
        <header class="rw-head">
          <div>
            <p class="muted">ინახება მონახაზად. აპში გამოჩნდება მხოლოდ გააქტიურების შემდეგ, როცა პარტნიორი აქტიურია და მარაგი მზადაა.
              ${V().infoButton ? V().infoButton('campaigns.form') : ''}</p>
          </div>
          <span class="badge neutral">მონახაზი</span>
        </header>
        <form id="rw-campaign-form" class="v3-panel" novalidate>
          <h4>კავშირი</h4>
          <div class="rw-partner-grid">
            ${field({
              id: 'rw-c-partner',
              label: 'პარტნიორი',
              required: true,
              control: input({ id: 'rw-c-partner', type: 'select', required: true, options: partnerOpts }),
            })}
            ${field({
              id: 'rw-c-reward',
              label: 'ჯილდო',
              control: input({ id: 'rw-c-reward', type: 'select', options: defOpts }),
            })}
          </div>
          <div id="rw-c-new-reward">
            <h4>ახალი ვაუჩერი</h4>
            <div class="rw-partner-grid">
              ${field({
                id: 'rw-c-rkey',
                label: 'ჯილდოს გასაღები',
                control: input({ id: 'rw-c-rkey', placeholder: 'AVERSI_10_VOUCHER' }),
              })}
              ${field({
                id: 'rw-c-cost',
                label: 'Coins',
                control: input({ id: 'rw-c-cost', type: 'number', value: '100' }),
              })}
              ${field({
                id: 'rw-c-inv',
                label: 'მარაგი',
                control: input({
                  id: 'rw-c-inv',
                  type: 'select',
                  value: 'CODE_POOL',
                  options: [
                    ['CODE_POOL', 'კოდების პული'],
                    ['FINITE', 'რაოდენობა'],
                    ['UNLIMITED', 'ულიმიტო'],
                  ],
                }),
              })}
              ${field({
                id: 'rw-c-rtitle',
                label: 'საჩვენებელი სახელი',
                control: input({ id: 'rw-c-rtitle', placeholder: 'Aversi 10%' }),
              })}
            </div>
          </div>
          <h4>კამპანია ${V().infoButton ? V().infoButton('campaigns.form') : ''}</h4>
          <div class="rw-partner-grid">
            ${field({
              id: 'rw-c-key',
              label: 'გასაღები',
              required: true,
              control: input({ id: 'rw-c-key', required: true, placeholder: 'AVERSI_10_CAMP' }),
            })}
            ${field({
              id: 'rw-c-name',
              label: 'სახელი',
              required: true,
              control: input({ id: 'rw-c-name', required: true, placeholder: 'Aversi 10% — სექტემბერი' }),
            })}
            ${field({
              id: 'rw-c-fund',
              label: 'დაფინანსება',
              control: input({ id: 'rw-c-fund', type: 'select', value: 'PER_REDEMPTION', options: fundingOpts }),
            })}
            ${field({
              id: 'rw-c-max',
              label: 'მაქს. გაცვლა',
              help: 'ცარიელი = ულიმიტო',
              control: input({ id: 'rw-c-max', type: 'number', placeholder: 'ცარიელი = ულიმიტო' }),
            })}
            ${field({
              id: 'rw-c-user',
              label: 'ლიმიტი მომხმარებელზე',
              control: input({ id: 'rw-c-user', type: 'number', placeholder: 'მაგ. 1' }),
            })}
            ${field({
              id: 'rw-c-value',
              label: 'ღირებულება (თეთრი)',
              help: '1500 = 15 ₾',
              control: input({ id: 'rw-c-value', type: 'number', placeholder: '1500 = 15 ₾' }),
            })}
            ${field({
              id: 'rw-c-ccy',
              label: 'ვალუტა',
              control: input({ id: 'rw-c-ccy', value: 'GEL' }),
            })}
            ${field({
              id: 'rw-c-low',
              label: 'დაბალი მარაგი',
              control: input({ id: 'rw-c-low', type: 'number', placeholder: '10' }),
            })}
            ${field({
              id: 'rw-c-start',
              label: 'დაწყება',
              control: input({ id: 'rw-c-start', type: 'datetime-local' }),
            })}
            ${field({
              id: 'rw-c-end',
              label: 'დასრულება',
              control: input({ id: 'rw-c-end', type: 'datetime-local' }),
            })}
          </div>
          <p id="rw-c-err" class="error hidden"></p>
        </form>
        ${sticky}
      </div>
    `,
    );
    bindSubnav(root);

    const keyEl = $('rw-c-key');
    const rkeyEl = $('rw-c-rkey');
    const errEl = $('rw-c-err');
    const newBox = $('rw-c-new-reward');
    const rewardSel = $('rw-c-reward');
    const form = $('rw-campaign-form');

    const syncNew = () => {
      if (newBox) newBox.hidden = Boolean(rewardSel?.value);
    };
    rewardSel?.addEventListener('change', syncNew);
    syncNew();
    keyEl?.addEventListener('input', () => {
      keyEl.value = sanitizeKey(keyEl.value);
    });
    rkeyEl?.addEventListener('input', () => {
      rkeyEl.value = sanitizeKey(rkeyEl.value);
    });
    V().setDirty?.(false);
    V().watchDirty?.(form);

    const leaveForm = async () => {
      if (V().dirty) {
        const ok = await V().confirmLeave?.();
        if (!ok) return;
      }
      V().setDirty?.(false);
      writeState({ tab: 'campaigns', edit: null });
      void renderRewards();
    };
    $('rw-c-cancel')?.addEventListener('click', () => void leaveForm());

    const save = async () => {
      const key = sanitizeKey(keyEl?.value);
      const name = ($('rw-c-name')?.value || '').trim();
      const partnerId = $('rw-c-partner')?.value || '';
      if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('hidden');
      }
      if (key.length < 3) {
        if (typeof toast === 'function') toast('გასაღები მინიმუმ 3 სიმბოლო', 'bad');
        return;
      }
      if (!name || !partnerId) {
        if (typeof toast === 'function') toast('სახელი და პარტნიორი სავალდებულოა', 'bad');
        return;
      }

      const btn = $('rw-c-save');
      const result = await mutate(
        async () => {
          let rewardDefinitionId = rewardSel?.value || '';
          if (!rewardDefinitionId) {
            const rkey = sanitizeKey(rkeyEl?.value);
            const coinCost = intOrNull($('rw-c-cost')?.value);
            const title = ($('rw-c-rtitle')?.value || '').trim() || name;
            if (rkey.length < 3 || !coinCost) {
              throw new Error('ჯილდოს გასაღები და Coins სავალდებულოა');
            }
            const created = await apiRewards('/definitions', {
              method: 'POST',
              body: {
                key: rkey,
                partnerId,
                title,
                coinCost,
                inventoryMode: $('rw-c-inv')?.value || 'CODE_POOL',
              },
            });
            rewardDefinitionId = created.definition?.id;
            if (!rewardDefinitionId) throw new Error('ჯილდო ვერ შეიქმნა');
          }
          const commercialCurrency = ($('rw-c-ccy')?.value || '').trim().toUpperCase() || null;
          return apiRewards('/campaigns', {
            method: 'POST',
            body: {
              key,
              name,
              partnerId,
              rewardDefinitionId,
              status: 'DRAFT',
              fundingModel: $('rw-c-fund')?.value || 'PER_REDEMPTION',
              maxRedemptions: intOrNull($('rw-c-max')?.value),
              perUserLimit: intOrNull($('rw-c-user')?.value),
              commercialValueMinor: intOrNull($('rw-c-value')?.value),
              commercialCurrency,
              lowStockThreshold: intOrNull($('rw-c-low')?.value),
              startsAt: toIsoOrNull($('rw-c-start')?.value),
              endsAt: toIsoOrNull($('rw-c-end')?.value),
            },
          });
        },
        {
          pendingElement: btn,
          successMessage: 'კამპანია შეიქმნა · მონახაზი',
          refresh: async () => {
            V().setDirty?.(false);
            writeState({ tab: 'campaigns', edit: null });
            await renderRewards();
          },
        },
      );
      if (!result.ok && errEl) {
        errEl.textContent = result.error?.message || 'შეცდომა';
        errEl.classList.remove('hidden');
      }
    };

    $('rw-c-save')?.addEventListener('click', () => void save());
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void save();
    });
    keyEl?.focus();
  }

  function openCampaignCreate() {
    writeState({ tab: 'campaigns', edit: 'new' });
    void renderRewards();
  }

  /* ── Campaigns list ───────────────────────────────────── */

  async function renderCampaigns(root) {
    const data = await apiRewards('/campaigns');
    const items = data.items || [];
    root.innerHTML = shellHtml(
      'campaigns',
      `
      <header class="rw-head">
        <div>
          <p class="muted">კამპანია აკონტროლებს ხილვადობას, ლიმიტებს და კომერციულ მეტამონაცემებს.
            ${V().infoButton ? V().infoButton('campaigns.status') : ''}</p>
        </div>
        <button type="button" class="btn primary sm" id="rw-campaign-create">${ico('zap')} ახალი კამპანიის შექმნა</button>
      </header>
      <section class="v3-panel rw-table-card">
        ${
          items.length === 0
            ? emptyState(
                'კამპანია ჯერ არ არის',
                'პარტნიორი → ჯილდოს განსაზღვრება → კამპანია → გააქტიურება მარაგის მზადყოფნისას.',
                `<button type="button" class="btn primary sm" id="rw-campaign-create-empty">ახალი კამპანიის შექმნა</button>`,
              )
            : `<div class="v3-table-wrap rw-table-wrap"><table class="v3-table table dense rw-table">
              <thead><tr>
                <th>კამპანია</th><th>პარტნიორი</th><th>სტატუსი</th><th>ჯილდო</th>
                <th>ღირებულება</th><th>მარაგი</th><th>გაცვლები</th><th></th>
              </tr></thead>
              <tbody>${items
                .map(
                  (c) => `<tr>
                  <td><strong>${esc(c.name)}</strong><div class="muted mono sm">${esc(c.key)}</div></td>
                  <td>${esc(c.partner?.displayName || '—')}</td>
                  <td>${statusPill(c.status)}</td>
                  <td><code>${esc(c.reward?.key || '—')}</code></td>
                  <td class="num">${c.reward?.coinCost != null ? fmt(c.reward.coinCost) : '—'}</td>
                  <td>${statusPill(c.inventory?.stockState || 'OK')}${
                    c.inventory?.available != null ? ` <span class="muted">${fmt(c.inventory.available)}</span>` : ''
                  }</td>
                  <td class="num">${fmt(c.redemptions ?? 0)}</td>
                  <td class="rw-actions">
                    ${c.status !== 'ACTIVE' ? `<button type="button" class="btn primary sm" data-act="${esc(c.id)}">გააქტიურება</button>` : ''}
                    ${c.status === 'ACTIVE' ? `<button type="button" class="btn ghost sm" data-pause="${esc(c.id)}">შეჩერება</button>` : ''}
                  </td>
                </tr>`,
                )
                .join('')}</tbody></table></div>`
        }
      </section>
    `,
    );
    bindSubnav(root);
    $('rw-campaign-create')?.addEventListener('click', openCampaignCreate);
    $('rw-campaign-create-empty')?.addEventListener('click', openCampaignCreate);

    root.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-act');
        confirmThen({
          title: 'კამპანიის გააქტიურება',
          message: 'კამპანია გამოჩნდება აპში, თუ პარტნიორი აქტიურია და მარაგი მზადაა.',
          confirmLabel: 'გააქტიურება',
          onConfirm: async () => {
            const r = await mutate(
              () => apiRewards(`/campaigns/${id}/activate`, { method: 'POST' }),
              { pendingElement: btn, successMessage: 'კამპანია გააქტიურდა' },
            );
            if (!r.ok) throw r.error || new Error('გააქტიურება ვერ მოხერხდა');
          },
        });
      });
    });
    root.querySelectorAll('[data-pause]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pause');
        confirmThen({
          title: 'კამპანიის შეჩერება',
          message: 'აქტიური კამპანია შეჩერდება და აღარ გამოჩნდება მაღაზიაში.',
          confirmLabel: 'შეჩერება',
          variant: 'warning',
          onConfirm: async () => {
            const r = await mutate(
              () => apiRewards(`/campaigns/${id}/pause`, { method: 'POST' }),
              { pendingElement: btn, successMessage: 'კამპანია შეჩერდა' },
            );
            if (!r.ok) throw r.error || new Error('შეცდომა');
          },
        });
      });
    });
  }

  /* ── Partners ─────────────────────────────────────────── */

  function openPartnerCreate() {
    if (typeof openDrawer !== 'function') {
      if (typeof toast === 'function') toast('ფორმა ვერ გაიხსნა', 'bad');
      return;
    }
    openDrawer(
      `
      <div class="umodal rw-partner-modal">
        <header class="umodal-hero">
          <div class="umodal-hero-copy">
            <p class="kicker">ჯილდოები</p>
            <h3>ახალი პარტნიორი</h3>
            <p class="muted">ინახება მონახაზად. მობილურ აპში არ გამოჩნდება გააქტიურებამდე.</p>
          </div>
          <button type="button" class="btn icon-only ghost umodal-close" id="drawer-cancel">${ico('x')}</button>
        </header>
        <div class="umodal-body">
          <form id="rw-partner-form" class="rw-partner-form">
            <h4>იდენტობა</h4>
            <div class="rw-partner-grid">
              <label class="field"><span>გასაღები</span>
                <input id="rw-p-key" required minlength="3" maxlength="64" placeholder="MEDI_PHARMACY_DEMO" autocomplete="off" />
              </label>
              <label class="field"><span>საჩვენებელი სახელი</span>
                <input id="rw-p-name" required maxlength="160" placeholder="მაგ. Aversi" />
              </label>
              <label class="field"><span>კატეგორია</span>
                <select id="rw-p-cat">${categoryOptions('OTHER')}</select>
              </label>
              <label class="field"><span>ქვეყანა</span>
                <input id="rw-p-country" maxlength="2" placeholder="GE" value="GE" />
              </label>
            </div>
            <h4>კონტაქტი</h4>
            <div class="rw-partner-grid">
              <label class="field span-2"><span>ვებსაიტი</span>
                <input id="rw-p-web" maxlength="300" placeholder="https://" />
              </label>
              <label class="field"><span>სახელი</span>
                <input id="rw-p-contact" maxlength="120" />
              </label>
              <label class="field"><span>ელ-ფოსტა</span>
                <input id="rw-p-email" type="email" maxlength="160" />
              </label>
            </div>
            <h4>შენიშვნა</h4>
            <label class="field"><span>მხოლოდ ადმინი — აპში არ ჩანს</span>
              <textarea id="rw-p-notes" rows="2" maxlength="2000"></textarea>
            </label>
            <p id="rw-p-err" class="error hidden"></p>
          </form>
        </div>
        <footer class="umodal-foot">
          <span class="badge neutral">მონახაზი</span>
          <div class="umodal-foot-right">
            <button class="btn ghost" id="rw-p-cancel" type="button">გაუქმება</button>
            <button class="btn primary" id="drawer-save" type="button">შექმნა</button>
          </div>
        </footer>
      </div>
    `,
      { modal: true },
    );
    const keyEl = $('rw-p-key');
    const nameEl = $('rw-p-name');
    const errEl = $('rw-p-err');
    keyEl?.addEventListener('input', () => {
      keyEl.value = keyEl.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    });
    $('drawer-cancel').onclick = closeDrawer;
    $('rw-p-cancel').onclick = closeDrawer;
    const save = async () => {
      const key = (keyEl?.value || '').trim();
      const displayName = (nameEl?.value || '').trim();
      if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('hidden');
      }
      if (key.length < 3) {
        if (typeof toast === 'function') toast('გასაღები მინიმუმ 3 სიმბოლო', 'bad');
        return;
      }
      if (!displayName) {
        if (typeof toast === 'function') toast('სახელი სავალდებულოა', 'bad');
        return;
      }
      const r = await mutate(
        () =>
          apiRewards('/partners', {
            method: 'POST',
            body: {
              key,
              displayName,
              status: 'DRAFT',
              category: $('rw-p-cat')?.value || 'OTHER',
              countryCode: ($('rw-p-country')?.value || '').trim().toUpperCase() || null,
              website: ($('rw-p-web')?.value || '').trim() || null,
              contactName: ($('rw-p-contact')?.value || '').trim() || null,
              contactEmail: ($('rw-p-email')?.value || '').trim() || null,
              notes: ($('rw-p-notes')?.value || '').trim() || null,
            },
          }),
        {
          pendingElement: $('drawer-save'),
          successMessage: 'პარტნიორი შეიქმნა',
          refresh: async () => {
            closeDrawer();
            await renderRewards();
          },
        },
      );
      if (!r.ok && errEl) {
        errEl.textContent = r.error?.message || 'შეცდომა';
        errEl.classList.remove('hidden');
      }
    };
    $('drawer-save').onclick = save;
    $('rw-partner-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void save();
    });
    keyEl?.focus();
  }

  async function renderPartners(root) {
    const data = await apiRewards('/partners');
    const items = data.items || [];
    root.innerHTML = shellHtml(
      'partners',
      `
      <header class="rw-head">
        <div>
          <p class="muted">კომერციული პარტნიორები — კონტაქტები და შენიშვნები მობილურზე არ ჩანს.</p>
        </div>
        <button type="button" class="btn primary sm" id="rw-partner-create">${ico('zap')} ახალი პარტნიორის შექმნა</button>
      </header>
      <section class="v3-panel rw-table-card">
        ${
          items.length === 0
            ? emptyState(
                'პარტნიორი ჯერ არ არის',
                'შექმენით პარტნიორი, შემდეგ კამპანია. წარმოებაში ფიქტიური აფთიაქები/ლაბები ნუ გაააქტიურებთ.',
                `<button type="button" class="btn primary sm" id="rw-partner-create-empty">ახალი პარტნიორის შექმნა</button>`,
              )
            : `<div class="v3-table-wrap rw-table-wrap"><table class="v3-table table dense rw-table">
              <thead><tr><th>პარტნიორი</th><th>სტატუსი</th><th>კატეგორია</th><th>ქვეყანა</th><th></th></tr></thead>
              <tbody>${items
                .map(
                  (p) => `<tr>
                  <td>
                    <strong>${esc(p.displayName)}</strong>
                    <div class="muted mono sm">${esc(p.key)}</div>
                  </td>
                  <td>${statusPill(p.status)}</td>
                  <td>${esc(CATEGORY_KA[p.category] || p.category || '—')}</td>
                  <td>${esc(p.countryCode || '—')}</td>
                  <td class="rw-actions">
                    <button type="button" class="btn ghost sm" data-pause-partner="${esc(p.id)}" data-status="${esc(p.status)}">
                      ${p.status === 'ACTIVE' ? 'შეჩერება' : 'გააქტიურება'}
                    </button>
                  </td>
                </tr>`,
                )
                .join('')}</tbody></table></div>`
        }
      </section>
    `,
    );
    bindSubnav(root);
    $('rw-partner-create')?.addEventListener('click', openPartnerCreate);
    $('rw-partner-create-empty')?.addEventListener('click', openPartnerCreate);
    root.querySelectorAll('[data-pause-partner]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pause-partner');
        const cur = btn.getAttribute('data-status');
        const status = cur === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        const activating = status === 'ACTIVE';
        confirmThen({
          title: activating ? 'პარტნიორის გააქტიურება' : 'პარტნიორის შეჩერება',
          message: activating
            ? 'პარტნიორი გახდება აქტიური. კამპანიები მაინც ცალკე უნდა გააქტიურდეს.'
            : 'პარტნიორი შეჩერდება და დაკავშირებული შეთავაზებები აღარ გამოჩნდება.',
          confirmLabel: activating ? 'გააქტიურება' : 'შეჩერება',
          variant: activating ? 'neutral' : 'warning',
          onConfirm: async () => {
            const r = await mutate(
              () => apiRewards(`/partners/${id}`, { method: 'PATCH', body: { status } }),
              {
                pendingElement: btn,
                successMessage: activating ? 'პარტნიორი აქტიურია' : 'პარტნიორი შეჩერებულია',
              },
            );
            if (!r.ok) throw r.error || new Error('შეცდომა');
          },
        });
      });
    });
  }

  /* ── Redemptions ──────────────────────────────────────── */

  async function renderRedemptions(root) {
    const data = await apiRewards('/redemptions?limit=50');
    const items = data.items || [];
    root.innerHTML = shellHtml(
      'redemptions',
      `
      <header class="rw-head">
        <p class="muted">ოპერაციული ჟურნალი — სრული პროფილი და ჯანმრთელობის მონაცემები არ ჩანს.</p>
      </header>
      <section class="v3-panel rw-table-card">
        ${
          items.length === 0
            ? emptyState('გაცვლები არ არის', 'როცა მომხმარებელი ჯილდოს გადაცვლის, ჩანაწერი აქ გამოჩნდება.')
            : `<div class="v3-table-wrap rw-table-wrap"><table class="v3-table table dense rw-table">
              <thead><tr>
                <th>ID</th><th>ჯილდო</th><th>პარტნიორი</th><th>სტატუსი</th>
                <th>Coins</th><th>კოდი</th><th>მომხმარებელი</th><th>დრო</th>
              </tr></thead>
              <tbody>${items
                .map(
                  (r) => `<tr>
                  <td class="mono"><button type="button" class="rw-link" data-red="${esc(r.id)}">${esc(String(r.id).slice(0, 8))}…</button></td>
                  <td><code>${esc(r.reward?.key || '—')}</code></td>
                  <td>${esc(r.partner?.displayName || r.partner?.key || '—')}</td>
                  <td>${statusPill(r.status)}</td>
                  <td class="num">${fmt(r.coinCost)}</td>
                  <td class="mono">${esc(r.codeMasked || r.codeState || '—')}</td>
                  <td class="mono muted">${esc(r.maskedUserRef || '—')}</td>
                  <td class="muted">${esc(whenKa(r.redeemedAt))}</td>
                </tr>`,
                )
                .join('')}</tbody></table></div>`
        }
      </section>
      <div id="rw-redemption-detail" class="rw-detail" hidden></div>
    `,
    );
    bindSubnav(root);
    root.querySelectorAll('[data-red]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const panel = $('rw-redemption-detail');
        if (!panel) return;
        panel.hidden = false;
        panel.innerHTML = `<div class="v3-panel"><p class="muted">იტვირთება…</p></div>`;
        try {
          const d = await apiRewards(`/redemptions/${btn.getAttribute('data-red')}`);
          panel.innerHTML = `<section class="v3-panel">
            <div class="card-head">${tile('file', 'ult')}<div>
              <h3>გაცვლის დეტალი</h3>
              <p class="muted mono">${esc(d.id)}</p>
            </div>
            <button type="button" class="btn ghost sm" id="rw-detail-close">დახურვა</button>
            </div>
            <div class="rw-detail-grid">
              <div><span class="muted">სტატუსი</span><strong>${statusPill(d.status)}</strong></div>
              <div><span class="muted">ჯილდო</span><strong><code>${esc(d.reward?.key || '—')}</code></strong></div>
              <div><span class="muted">Coins</span><strong>${fmt(d.coinCost)}</strong></div>
              <div><span class="muted">კოდი</span><strong class="mono">${esc(d.code?.codeMasked || '—')}</strong></div>
              <div><span class="muted">მომხმარებელი</span><strong class="mono">${esc(d.maskedUserRef || '—')}</strong></div>
              <div><span class="muted">დრო</span><strong>${esc(whenKa(d.redeemedAt))}</strong></div>
              <div><span class="muted">აუდიტის ჩანაწერი</span><strong>${fmt((d.audit || []).length)}</strong></div>
            </div>
          </section>`;
          $('rw-detail-close')?.addEventListener('click', () => {
            panel.hidden = true;
            panel.innerHTML = '';
          });
        } catch (e) {
          panel.innerHTML = `<div class="v3-panel"><p class="err">${esc(e.message || 'შეცდომა')}</p></div>`;
        }
      });
    });
  }

  /* ── Codes + import dialog ────────────────────────────── */

  function openCodeImport(definitionId) {
    const open = V().openDialog;
    if (!open) {
      if (typeof toast === 'function') toast('დიალოგი ვერ გაიხსნა', 'bad');
      return;
    }
    const dlg = open({
      title: 'კოდების იმპორტი',
      description: 'თითო ხაზზე ერთი კოდი. სრული სია ბრაუზერში არ რჩება — მხოლოდ რაოდენობები.',
      watchDirty: false,
      body: `
        <div class="v3-code-import">
          ${
            V().infoButton ? V().infoButton('codes.import') : ''
          }
          <label class="v3-field" for="rw-code-import-ta">
            <span class="v3-field-label">კოდები</span>
            <textarea id="rw-code-import-ta" class="v3-input" rows="10" placeholder="CODE001&#10;CODE002&#10;…"></textarea>
          </label>
          <p id="rw-code-import-err" class="error hidden"></p>
        </div>`,
      footer: `
        <button type="button" class="btn ghost" id="rw-import-cancel">გაუქმება</button>
        <button type="button" class="btn primary" id="rw-import-go">იმპორტი</button>`,
    });

    $('rw-import-cancel')?.addEventListener('click', () => void dlg?.close?.());
    $('rw-import-go')?.addEventListener('click', async () => {
      const raw = $('rw-code-import-ta')?.value || '';
      const codes = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const errEl = $('rw-code-import-err');
      if (!codes.length) {
        if (errEl) {
          errEl.textContent = 'ჩასვით მინიმუმ ერთი კოდი';
          errEl.classList.remove('hidden');
        }
        if (typeof toast === 'function') toast('ჩასვით მინიმუმ ერთი კოდი', 'bad');
        return;
      }
      if (errEl) errEl.classList.add('hidden');
      const btn = $('rw-import-go');
      const r = await mutate(
        () =>
          apiRewards(`/rewards/${definitionId}/codes/import`, {
            method: 'POST',
            body: { codes },
          }),
        {
          pendingElement: btn,
          successMessage: null,
          refresh: async (res) => {
            const report = res?.report || {};
            const msg = `მიღებულია ${report.accepted ?? 0} · დუბლიკატი ${report.duplicates ?? 0} · უარყოფილი ${report.invalid ?? report.rejected ?? 0}`;
            if (typeof toast === 'function') toast(msg, 'ok');
            else V().toast?.(msg, 'ok');
            await dlg?.close?.();
          },
        },
      );
      if (!r.ok && errEl) {
        errEl.textContent = r.error?.message || 'იმპორტი ვერ მოხერხდა';
        errEl.classList.remove('hidden');
      }
    });
  }

  async function renderCodes(root) {
    const defs = await apiRewards('/definitions');
    const pools = (defs.items || []).filter((d) => d.inventoryMode === 'CODE_POOL');
    root.innerHTML = shellHtml(
      'codes',
      `
      <header class="rw-head">
        <p class="muted">იმპორტი აბრუნებს მხოლოდ რაოდენობებს — სრული კოდების სია ბრაუზერში არ ჩანს.
          ${V().infoButton ? V().infoButton('codes.import') : ''}</p>
      </header>
      <section class="v3-panel rw-table-card">
        ${
          pools.length === 0
            ? emptyState('CODE_POOL ჯილდო არ არის', 'როცა კუპონის ტიპის ჯილდოს შექმნით, მარაგი აქ გამოჩნდება.')
            : `<div class="v3-table-wrap rw-table-wrap"><table class="v3-table table dense rw-table">
              <thead><tr><th>ჯილდო</th><th>სტატუსი</th><th>პარტნიორი</th><th></th></tr></thead>
              <tbody>${pools
                .map(
                  (d) => `<tr>
                  <td><code>${esc(d.key)}</code></td>
                  <td>${statusPill(d.status)}</td>
                  <td>${esc(d.partnerKey || '—')}</td>
                  <td class="rw-actions">
                    <button type="button" class="btn primary sm" data-import="${esc(d.id)}">იმპორტი</button>
                    <button type="button" class="btn ghost sm" data-list="${esc(d.id)}">შენიღბული სია</button>
                  </td>
                </tr>`,
                )
                .join('')}</tbody></table></div>`
        }
      </section>
      <div id="rw-codes-panel"></div>
    `,
    );
    bindSubnav(root);
    root.querySelectorAll('[data-import]').forEach((btn) => {
      btn.addEventListener('click', () => openCodeImport(btn.getAttribute('data-import')));
    });
    root.querySelectorAll('[data-list]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await apiRewards(`/rewards/${btn.getAttribute('data-list')}/codes?limit=25`);
          const panel = $('rw-codes-panel');
          if (!panel) return;
          panel.innerHTML = `<section class="v3-panel rw-table-card" style="margin-top:14px">
            <div class="card-head">${tile('lock', 'ult')}<div><h3>შენიღბული კოდები</h3><p class="muted">პირველი 25 ჩანაწერი</p></div></div>
            <div class="v3-table-wrap rw-table-wrap"><table class="v3-table table dense rw-table">
              <thead><tr><th>კოდი</th><th>სტატუსი</th><th>ვადა</th></tr></thead>
              <tbody>${(res.items || [])
                .map(
                  (c) => `<tr>
                  <td class="mono">${esc(c.codeMasked)}</td>
                  <td>${statusPill(c.status)}</td>
                  <td class="muted">${esc(whenKa(c.expiresAt))}</td>
                </tr>`,
                )
                .join('') || '<tr><td colspan="3" class="muted">ცარიელია</td></tr>'}</tbody>
            </table></div>
          </section>`;
        } catch (e) {
          if (typeof toast === 'function') toast(e.message || 'შეცდომა', 'bad');
        }
      });
    });
  }

  /* ── Entry ────────────────────────────────────────────── */

  async function renderRewards() {
    const root = $('tab-rewards');
    if (!root) return;

    const { tab, edit } = readState();

    Shell().mountHeader?.(headerFor(tab, edit));

    root.innerHTML = `<div class="v3-workspace-wide v3-module v3-rewards rw-page"><div class="rw-loading">${ico('refresh')}<span>იტვირთება…</span></div></div>`;
    // Persist tab without re-entry churn: only if URL lacks a valid tab
    try {
      const hs = Shell().hashParams?.() || new URLSearchParams();
      if (!TAB_KEYS.has(hs.get('tab') || '')) {
        const params = new URLSearchParams(hs);
        params.set('tab', tab);
        if (edit === 'new') params.set('edit', 'new');
        else params.delete('edit');
        const qs = params.toString();
        const next = qs ? `#/rewards?${qs}` : '#/rewards?tab=overview';
        if (location.hash !== next) history.replaceState({ tab: 'rewards' }, '', next);
      }
    } catch { /* ignore */ }
    try {
      if (edit === 'new') await renderCampaignForm(root);
      else if (tab === 'partners') await renderPartners(root);
      else if (tab === 'campaigns') await renderCampaigns(root);
      else if (tab === 'redemptions') await renderRedemptions(root);
      else if (tab === 'codes') await renderCodes(root);
      else await renderOverview(root);
    } catch (e) {
      root.innerHTML = shellHtml(
        tab,
        `<div class="rw-empty rw-empty-err"><strong>ჩატვირთვა ვერ მოხერხდა</strong><p>${esc(e.message || 'უცნობი შეცდომა')}</p>
        <button type="button" class="btn ghost sm" id="rw-retry">ხელახლა სცადე</button></div>`,
      );
      bindSubnav(root);
      $('rw-retry')?.addEventListener('click', () => void renderRewards());
    }
  }

  global.renderRewards = renderRewards;
  global.AdminRewardsV3 = {
    render: renderRewards,
    openCampaignCreate,
    openCodeImport,
    apiRewards,
  };
})(window);
