/**
 * Phase 8 — Rewards Operations (MediCard Admin V2).
 * Georgian UI · commercial data only · no health fields.
 * Depends on admin.js (api, toast, escapeHtml, $, icon, iconTile) and ops-center.js charts.
 */
(function rewardsAdminPanel(global) {
  const R = { subtab: 'overview' };
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (v) => String(v ?? '');
  const fmt = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('ka-GE');
  };
  const ico = (name) => (typeof icon === 'function' ? icon(name) : '');
  const tile = (name, tone) =>
    typeof iconTile === 'function' ? iconTile(name, tone) : `<span class="icon-tile ${tone || ''}">${ico(name)}</span>`;

  const STATUS_KA = {
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
  const CATEGORY_KA = {
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
  const TABS = [
    ['overview', 'მიმოხილვა'],
    ['campaigns', 'კამპანიები'],
    ['partners', 'პარტნიორები'],
    ['redemptions', 'გაცვლები'],
    ['codes', 'კოდების მარაგი'],
  ];

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
    return `<span class="badge ${statusTone(s)}">${esc(statusKa(s))}</span>`;
  }
  function whenKa(iso) {
    return typeof fmtDate === 'function' ? fmtDate(iso) : iso || '—';
  }
  function dayKa(isoDay) {
    if (!isoDay) return '—';
    if (typeof adminDateParts !== 'function') return isoDay;
    const p = adminDateParts(`${isoDay}T12:00:00Z`);
    if (!p) return isoDay;
    return `${WEEKDAYS_KA_SHORT[p.weekday]}, ${p.day} ${MONTHS_KA[p.month]}`;
  }

  async function apiRewards(path, options = {}) {
    return api(`/rewards${path}`, options);
  }

  function subnav(active) {
    return `<nav class="rw-seg" aria-label="ჯილდოების სექციები">${TABS.map(
      ([id, label]) =>
        `<button type="button" class="rw-seg-btn${active === id ? ' is-active' : ''}" data-rewards-sub="${id}">${label}</button>`,
    ).join('')}</nav>`;
  }

  function bindSubnav(root) {
    root.querySelectorAll('[data-rewards-sub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        R.subtab = btn.getAttribute('data-rewards-sub');
        void renderRewards();
      });
    });
  }

  function shell(active, body) {
    return `<div class="rw-page dash-enter">${subnav(active)}${body}</div>`;
  }

  function emptyState(title, body, ctaHtml = '') {
    return `<div class="rw-empty">
      <span class="rw-empty-ico">${ico('layers')}</span>
      <strong>${esc(title)}</strong>
      ${body ? `<p>${esc(body)}</p>` : ''}
      ${ctaHtml}
    </div>`;
  }

  function kpiCell(label, value, hint, tone) {
    return `<article class="ops-kpi${tone ? ` is-${tone}` : ''}">
      <div class="ops-kpi-top"><span>${esc(label)}</span></div>
      <strong>${value}</strong>
      ${hint != null && hint !== '' ? `<div class="ops-kpi-foot"><span class="muted">${esc(hint)}</span></div>` : ''}
    </article>`;
  }

  function trendChart(trend) {
    const points = (trend || []).map((d) => ({ day: d.day, count: Number(d.redemptions) || 0 }));
    if (typeof opsLineChart === 'function') {
      return opsLineChart([{ points, tone: 'teal' }], { label: 'გაცვლების ტრენდი', height: 200 });
    }
    const max = Math.max(1, ...points.map((p) => p.count));
    return `<div class="rw-mini-bars">${points
      .map(
        (p) => `<div class="rw-mini-bar" title="${esc(dayKa(p.day))}: ${p.count}">
        <span style="height:${Math.max(4, Math.round((p.count / max) * 100))}%"></span>
        <em>${esc(String(p.day).slice(8))}</em>
      </div>`,
      )
      .join('')}</div>`;
  }

  async function renderOverview(root) {
    const data = await apiRewards('/overview');
    const k = data.kpis || {};
    const low = data.needsAttention?.lowStock || [];
    const ending = data.needsAttention?.endingSoon || [];
    const recent = data.recentActivity || [];
    const hasAttention = low.length > 0 || ending.length > 0;

    root.innerHTML = shell(
      'overview',
      `
      <header class="rw-head">
        <p class="muted">კომერციული მეტრიკები მხოლოდ — ჯანმრთელობის მონაცემები აქ არ ჩანს.</p>
        <button type="button" class="btn ghost sm" id="rw-refresh">${ico('refresh')} განახლება</button>
      </header>

      <section class="ops-level" aria-label="ძირითადი მაჩვენებლები">
        <div class="ops-kpis ops-kpis-6">
          ${kpiCell('აქტიური კამპანია', fmt(k.activeCampaigns), `${fmt(k.partnersActive)} პარტნიორი`)}
          ${kpiCell('გაცვლა დღეს', fmt(k.redemptionsToday), 'დღევანდელი')}
          ${kpiCell('გაცვლა 7 დღე', fmt(k.redemptions7d), 'ბოლო კვირა')}
          ${kpiCell('ხელმისაწვდომი კოდი', fmt(k.codesAvailable), 'CODE_POOL')}
          ${kpiCell('დაბალი მარაგი', fmt(k.codesLowStock), 'გაფრთხილება', k.codesLowStock > 0 ? 'warn' : '')}
          ${kpiCell('დახარჯული Coins 7დ', fmt(k.coinsSpentOnRewards7d), 'Medi Coins')}
        </div>
      </section>

      <section class="rw-grid-2">
        <section class="card ops-card">
          <div class="card-head">${tile('activity', 'ult')}<div><h3>გაცვლების ტრენდი</h3><p class="muted">ბოლო 7 დღე</p></div></div>
          <div class="rw-chart">${trendChart(data.trend7d)}</div>
        </section>
        <section class="card ops-card">
          <div class="card-head">${tile(hasAttention ? 'alert' : 'shield', hasAttention ? 'warn' : 'ok')}<div><h3>საჭიროებს ყურადღებას</h3><p class="muted">მარაგი და ვადები</p></div></div>
          ${
            !hasAttention
              ? `<p class="rw-healthy">ყველაფერი წესრიგშია. ქმედება არ არის საჭირო.</p>`
              : `<div class="rw-attention">
                  ${
                    low.length
                      ? `<div class="rw-att-block"><span class="rw-att-label">დაბალი / ამოწურული მარაგი</span>
                    <ul>${low.map((x) => `<li><code>${esc(x.rewardKey)}</code> · ${statusPill(x.stockState)} · ${fmt(x.available)}</li>`).join('')}</ul></div>`
                      : ''
                  }
                  ${
                    ending.length
                      ? `<div class="rw-att-block"><span class="rw-att-label">მალე მთავრდება</span>
                    <ul>${ending.map((x) => `<li><strong>${esc(x.name)}</strong> · ${esc(x.partnerKey || '—')} · ${esc(whenKa(x.endsAt))}</li>`).join('')}</ul></div>`
                      : ''
                  }
                </div>`
          }
        </section>
      </section>

      <section class="card ops-card rw-table-card">
        <div class="card-head">${tile('file', 'ult')}<div><h3>ბოლო ოპერაციები</h3><p class="muted">გაცვლის ჟურნალი — შენიღბული მომხმარებელი</p></div></div>
        ${
          recent.length === 0
            ? emptyState('ჯერ გაცვლა არ არის', 'პირველი გაცვლა აქ გამოჩნდება. წარმოებაში ფიქტიური პარტნიორები ნუ გაააქტიურებთ.')
            : `<div class="rw-table-wrap"><table class="table dense rw-table">
              <thead><tr><th>ID</th><th>ჯილდო</th><th>კამპანია</th><th>სტატუსი</th><th>Coins</th><th>მომხმარებელი</th><th>დრო</th></tr></thead>
              <tbody>${recent
                .map(
                  (r) => `<tr>
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
    `,
    );
    bindSubnav(root);
    $('rw-refresh')?.addEventListener('click', () => void renderRewards());
  }

  function categoryOptions(selected) {
    return Object.entries(CATEGORY_KA)
      .map(([k, label]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(label)}</option>`)
      .join('');
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

  const FUNDING_KA = {
    PER_REDEMPTION: 'თითო გაცვლაზე',
    PER_USED: 'თითო გამოყენებაზე',
    SPONSORED_FIXED: 'სპონსორი · ფიქსი',
    AFFILIATE: 'აფილიატი',
    INTERNAL: 'შიდა',
  };

  function openPartnerCreate() {
    if (typeof openDrawer !== 'function') {
      toast('ფორმა ვერ გაიხსნა', 'bad');
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
        toast('გასაღები მინიმუმ 3 სიმბოლო', 'bad');
        return;
      }
      if (!displayName) {
        toast('სახელი სავალდებულოა', 'bad');
        return;
      }
      try {
        $('drawer-save').disabled = true;
        await apiRewards('/partners', {
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
        });
        closeDrawer();
        toast('პარტნიორი შეიქმნა', 'ok');
        void renderRewards();
      } catch (e) {
        if (errEl) {
          errEl.textContent = e.message || 'შეცდომა';
          errEl.classList.remove('hidden');
        }
        toast(e.message || 'შეცდომა', 'bad');
        $('drawer-save').disabled = false;
      }
    };
    $('drawer-save').onclick = save;
    $('rw-partner-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void save();
    });
    keyEl?.focus();
  }

  async function openCampaignCreate() {
    if (typeof openDrawer !== 'function') {
      toast('ფორმა ვერ გაიხსნა', 'bad');
      return;
    }
    let partners = [];
    let defs = [];
    try {
      const [p, d] = await Promise.all([apiRewards('/partners'), apiRewards('/definitions')]);
      partners = p.items || [];
      defs = (d.items || []).filter((x) => x.type === 'PARTNER_VOUCHER' || x.type === 'COUPON_CODE' || x.partnerKey);
    } catch (e) {
      toast(e.message || 'სია ვერ ჩაიტვირთა', 'bad');
      return;
    }
    if (!partners.length) {
      toast('ჯერ შექმენით პარტნიორი', 'bad');
      R.subtab = 'partners';
      void renderRewards();
      return;
    }
    const partnerOpts = partners
      .map(
        (p) =>
          `<option value="${esc(p.id)}">${esc(p.displayName)} · ${esc(p.key)}${
            p.status !== 'ACTIVE' ? ' · არააქტიური' : ''
          }</option>`,
      )
      .join('');
    const defOpts = [`<option value="">ახალი პარტნიორის ვაუჩერი</option>`]
      .concat(defs.map((x) => `<option value="${esc(x.id)}">${esc(x.key)} · ${fmt(x.coinCost)} coins</option>`))
      .join('');
    const fundingOpts = Object.entries(FUNDING_KA)
      .map(([k, label]) => `<option value="${k}"${k === 'PER_REDEMPTION' ? ' selected' : ''}>${esc(label)}</option>`)
      .join('');
    openDrawer(
      `
      <div class="umodal rw-partner-modal">
        <header class="umodal-hero">
          <div class="umodal-hero-copy">
            <p class="kicker">ჯილდოები</p>
            <h3>ახალი კამპანია</h3>
            <p class="muted">ინახება მონახაზად. აპში გამოჩნდება მხოლოდ გააქტიურების შემდეგ, როცა პარტნიორი აქტიურია და მარაგი მზადაა.</p>
          </div>
          <button type="button" class="btn icon-only ghost umodal-close" id="drawer-cancel">${ico('x')}</button>
        </header>
        <div class="umodal-body">
          <form id="rw-campaign-form" class="rw-partner-form">
            <h4>კავშირი</h4>
            <div class="rw-partner-grid">
              <label class="field"><span>პარტნიორი</span>
                <select id="rw-c-partner" required>${partnerOpts}</select>
              </label>
              <label class="field"><span>ჯილდო</span>
                <select id="rw-c-reward">${defOpts}</select>
              </label>
            </div>
            <div id="rw-c-new-reward">
              <h4>ახალი ვაუჩერი</h4>
              <div class="rw-partner-grid">
                <label class="field"><span>ჯილდოს გასაღები</span>
                  <input id="rw-c-rkey" maxlength="64" placeholder="AVERSI_10_VOUCHER" autocomplete="off" />
                </label>
                <label class="field"><span>Coins</span>
                  <input id="rw-c-cost" type="number" min="1" step="1" value="100" />
                </label>
                <label class="field"><span>მარაგი</span>
                  <select id="rw-c-inv">
                    <option value="CODE_POOL" selected>კოდების პული</option>
                    <option value="FINITE">რაოდენობა</option>
                    <option value="UNLIMITED">ულიმიტო</option>
                  </select>
                </label>
                <label class="field"><span>საჩვენებელი სახელი</span>
                  <input id="rw-c-rtitle" maxlength="200" placeholder="Aversi 10%" />
                </label>
              </div>
            </div>
            <h4>კამპანია</h4>
            <div class="rw-partner-grid">
              <label class="field"><span>გასაღები</span>
                <input id="rw-c-key" required minlength="3" maxlength="64" placeholder="AVERSI_10_CAMP" autocomplete="off" />
              </label>
              <label class="field"><span>სახელი</span>
                <input id="rw-c-name" required maxlength="200" placeholder="Aversi 10% — სექტემბერი" />
              </label>
              <label class="field"><span>დაფინანსება</span>
                <select id="rw-c-fund">${fundingOpts}</select>
              </label>
              <label class="field"><span>მაქს. გაცვლა</span>
                <input id="rw-c-max" type="number" min="1" step="1" placeholder="ცარიელი = ულიმიტო" />
              </label>
              <label class="field"><span>ლიმიტი მომხმარებელზე</span>
                <input id="rw-c-user" type="number" min="1" step="1" placeholder="მაგ. 1" />
              </label>
              <label class="field"><span>ღირებულება (თეთრი)</span>
                <input id="rw-c-value" type="number" min="0" step="1" placeholder="1500 = 15 ₾" />
              </label>
              <label class="field"><span>ვალუტა</span>
                <input id="rw-c-ccy" maxlength="3" value="GEL" />
              </label>
              <label class="field"><span>დაბალი მარაგი</span>
                <input id="rw-c-low" type="number" min="0" step="1" placeholder="10" />
              </label>
              <label class="field"><span>დაწყება</span>
                <input id="rw-c-start" type="datetime-local" />
              </label>
              <label class="field"><span>დასრულება</span>
                <input id="rw-c-end" type="datetime-local" />
              </label>
            </div>
            <p id="rw-c-err" class="error hidden"></p>
          </form>
        </div>
        <footer class="umodal-foot">
          <span class="badge neutral">მონახაზი</span>
          <div class="umodal-foot-right">
            <button class="btn ghost" id="rw-c-cancel" type="button">გაუქმება</button>
            <button class="btn primary" id="drawer-save" type="button">შექმნა</button>
          </div>
        </footer>
      </div>
    `,
      { modal: true },
    );
    const keyEl = $('rw-c-key');
    const rkeyEl = $('rw-c-rkey');
    const errEl = $('rw-c-err');
    const newBox = $('rw-c-new-reward');
    const rewardSel = $('rw-c-reward');
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
    $('drawer-cancel').onclick = closeDrawer;
    $('rw-c-cancel').onclick = closeDrawer;
    const save = async () => {
      const key = sanitizeKey(keyEl?.value);
      const name = ($('rw-c-name')?.value || '').trim();
      const partnerId = $('rw-c-partner')?.value || '';
      if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('hidden');
      }
      if (key.length < 3) {
        toast('გასაღები მინიმუმ 3 სიმბოლო', 'bad');
        return;
      }
      if (!name || !partnerId) {
        toast('სახელი და პარტნიორი სავალდებულოა', 'bad');
        return;
      }
      try {
        $('drawer-save').disabled = true;
        let rewardDefinitionId = rewardSel?.value || '';
        if (!rewardDefinitionId) {
          const rkey = sanitizeKey(rkeyEl?.value);
          const coinCost = intOrNull($('rw-c-cost')?.value);
          const title = ($('rw-c-rtitle')?.value || '').trim() || name;
          if (rkey.length < 3 || !coinCost) {
            toast('ჯილდოს გასაღები და Coins სავალდებულოა', 'bad');
            $('drawer-save').disabled = false;
            return;
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
        await apiRewards('/campaigns', {
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
        closeDrawer();
        toast('კამპანია შეიქმნა · მონახაზი', 'ok');
        void renderRewards();
      } catch (e) {
        if (errEl) {
          errEl.textContent = e.message || 'შეცდომა';
          errEl.classList.remove('hidden');
        }
        toast(e.message || 'შეცდომა', 'bad');
        $('drawer-save').disabled = false;
      }
    };
    $('drawer-save').onclick = save;
    $('rw-campaign-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void save();
    });
    keyEl?.focus();
  }

  async function renderPartners(root) {
    const data = await apiRewards('/partners');
    const items = data.items || [];
    root.innerHTML = shell(
      'partners',
      `
      <header class="rw-head">
        <div>
          <p class="muted">კომერციული პარტნიორები — კონტაქტები და შენიშვნები მობილურზე არ ჩანს.</p>
        </div>
        <button type="button" class="btn primary sm" id="rw-partner-create">${ico('zap')} ახალი პარტნიორის შექმნა</button>
      </header>
      <section class="card ops-card rw-table-card">
        ${
          items.length === 0
            ? emptyState(
                'პარტნიორი ჯერ არ არის',
                'შექმენით პარტნიორი, შემდეგ კამპანია. წარმოებაში ფიქტიური აფთიაქები/ლაბები ნუ გაააქტიურებთ.',
                `<button type="button" class="btn primary sm" id="rw-partner-create-empty">ახალი პარტნიორის შექმნა</button>`,
              )
            : `<div class="rw-table-wrap"><table class="table dense rw-table">
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
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-pause-partner');
        const cur = btn.getAttribute('data-status');
        const status = cur === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        try {
          await apiRewards(`/partners/${id}`, { method: 'PATCH', body: { status } });
          toast(status === 'ACTIVE' ? 'პარტნიორი აქტიურია' : 'პარტნიორი შეჩერებულია', 'ok');
          void renderRewards();
        } catch (e) {
          toast(e.message || 'შეცდომა', 'bad');
        }
      });
    });
  }

  async function renderCampaigns(root) {
    const data = await apiRewards('/campaigns');
    const items = data.items || [];
    root.innerHTML = shell(
      'campaigns',
      `
      <header class="rw-head">
        <div>
          <p class="muted">კამპანია აკონტროლებს ხილვადობას, ლიმიტებს და კომერციულ მეტამონაცემებს.</p>
        </div>
        <button type="button" class="btn primary sm" id="rw-campaign-create">${ico('zap')} ახალი კამპანიის შექმნა</button>
      </header>
      <section class="card ops-card rw-table-card">
        ${
          items.length === 0
            ? emptyState(
                'კამპანია ჯერ არ არის',
                'პარტნიორი → ჯილდოს განსაზღვრება → კამპანია → გააქტიურება მარაგის მზადყოფნისას.',
                `<button type="button" class="btn primary sm" id="rw-campaign-create-empty">ახალი კამპანიის შექმნა</button>`,
              )
            : `<div class="rw-table-wrap"><table class="table dense rw-table">
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
    $('rw-campaign-create')?.addEventListener('click', () => void openCampaignCreate());
    $('rw-campaign-create-empty')?.addEventListener('click', () => void openCampaignCreate());
    root.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiRewards(`/campaigns/${btn.getAttribute('data-act')}/activate`, { method: 'POST' });
          toast('კამპანია გააქტიურდა', 'ok');
          void renderRewards();
        } catch (e) {
          toast(e.message || 'გააქტიურება ვერ მოხერხდა', 'bad');
        }
      });
    });
    root.querySelectorAll('[data-pause]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiRewards(`/campaigns/${btn.getAttribute('data-pause')}/pause`, { method: 'POST' });
          toast('კამპანია შეჩერდა', 'ok');
          void renderRewards();
        } catch (e) {
          toast(e.message || 'შეცდომა', 'bad');
        }
      });
    });
  }

  async function renderRedemptions(root) {
    const data = await apiRewards('/redemptions?limit=50');
    const items = data.items || [];
    root.innerHTML = shell(
      'redemptions',
      `
      <header class="rw-head">
        <p class="muted">ოპერაციული ჟურნალი — სრული პროფილი და ჯანმრთელობის მონაცემები არ ჩანს.</p>
      </header>
      <section class="card ops-card rw-table-card">
        ${
          items.length === 0
            ? emptyState('გაცვლები არ არის', 'როცა მომხმარებელი ჯილდოს გადაცვლის, ჩანაწერი აქ გამოჩნდება.')
            : `<div class="rw-table-wrap"><table class="table dense rw-table">
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
        panel.innerHTML = `<div class="card ops-card"><p class="muted">იტვირთება…</p></div>`;
        try {
          const d = await apiRewards(`/redemptions/${btn.getAttribute('data-red')}`);
          panel.innerHTML = `<section class="card ops-card">
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
          panel.innerHTML = `<div class="card ops-card"><p class="err">${esc(e.message || 'შეცდომა')}</p></div>`;
        }
      });
    });
  }

  async function renderCodes(root) {
    const defs = await apiRewards('/definitions');
    const pools = (defs.items || []).filter((d) => d.inventoryMode === 'CODE_POOL');
    root.innerHTML = shell(
      'codes',
      `
      <header class="rw-head">
        <p class="muted">იმპორტი აბრუნებს მხოლოდ რაოდენობებს — სრული კოდების სია ბრაუზერში არ ჩანს.</p>
      </header>
      <section class="card ops-card rw-table-card">
        ${
          pools.length === 0
            ? emptyState('CODE_POOL ჯილდო არ არის', 'როცა კუპონის ტიპის ჯილდოს შექმნით, მარაგი აქ გამოჩნდება.')
            : `<div class="rw-table-wrap"><table class="table dense rw-table">
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
      btn.addEventListener('click', () => {
        // Legacy path retained only as dead fallback; V3 owns codes import UI.
        if (typeof toast === 'function') toast('გამოიყენეთ კოდის იმპორტის ფორმა (Admin V3).', 'warn');
      });
    });
    root.querySelectorAll('[data-list]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await apiRewards(`/rewards/${btn.getAttribute('data-list')}/codes?limit=25`);
          const panel = $('rw-codes-panel');
          if (!panel) return;
          panel.innerHTML = `<section class="card ops-card rw-table-card" style="margin-top:14px">
            <div class="card-head">${tile('lock', 'ult')}<div><h3>შენიღბული კოდები</h3><p class="muted">პირველი 25 ჩანაწერი</p></div></div>
            <div class="rw-table-wrap"><table class="table dense rw-table">
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
          toast(e.message || 'შეცდომა', 'bad');
        }
      });
    });
  }

  async function renderRewards() {
    const root = $('tab-rewards');
    if (!root) return;
    root.innerHTML = `<div class="rw-page"><div class="rw-loading">${ico('refresh')}<span>იტვირთება…</span></div></div>`;
    try {
      if (R.subtab === 'partners') await renderPartners(root);
      else if (R.subtab === 'campaigns') await renderCampaigns(root);
      else if (R.subtab === 'redemptions') await renderRedemptions(root);
      else if (R.subtab === 'codes') await renderCodes(root);
      else await renderOverview(root);
    } catch (e) {
      root.innerHTML = shell(
        R.subtab,
        `<div class="rw-empty rw-empty-err"><strong>ჩატვირთვა ვერ მოხერხდა</strong><p>${esc(e.message || 'უცნობი შეცდომა')}</p>
        <button type="button" class="btn ghost sm" id="rw-retry">ხელახლა ცდა</button></div>`,
      );
      bindSubnav(root);
      $('rw-retry')?.addEventListener('click', () => void renderRewards());
    }
  }

  global.renderRewards = renderRewards;
  global.STATUS_KA = STATUS_KA;
  global.CATEGORY_KA = CATEGORY_KA;
})(window);
