/**
 * Phase 8 — Rewards Operations admin panel (MediCard Admin V2).
 * Loaded after admin.js; expects api(), toast(), escapeHtml(), state.token.
 */
(function rewardsAdminPanel(global) {
  const R = {
    subtab: 'overview',
  };

  // admin.js exposes escapeHtml (not esc) as a classic script global.
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (v) => String(v ?? '');

  async function apiRewards(path, options = {}) {
    // api() already prefixes `${API}/api/admin`
    return api(`/rewards${path}`, options);
  }

  function subnav(active) {
    const tabs = [
      ['overview', 'Overview'],
      ['campaigns', 'Campaigns'],
      ['partners', 'Partners'],
      ['redemptions', 'Redemptions'],
      ['codes', 'Code Inventory'],
    ];
    return `<div class="v25-seg" style="margin-bottom:16px;flex-wrap:wrap;gap:8px">
      ${tabs
        .map(
          ([id, label]) =>
            `<button type="button" class="btn ${active === id ? 'primary' : 'ghost'} sm" data-rewards-sub="${id}">${label}</button>`,
        )
        .join('')}
    </div>`;
  }

  function bindSubnav(root) {
    root.querySelectorAll('[data-rewards-sub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        R.subtab = btn.getAttribute('data-rewards-sub');
        void renderRewards();
      });
    });
  }

  async function renderOverview(root) {
    const data = await apiRewards('/overview');
    const k = data.kpis || {};
    root.innerHTML = `
      ${subnav('overview')}
      <div class="page-head">
        <div>
          <p class="kicker">Rewards Operations</p>
          <h3>Partner & first-party loyalty spend</h3>
          <p class="muted">Commercial metrics only — no health data.</p>
        </div>
      </div>
      <div class="kpi-strip">
        <div class="kpi"><span class="muted">Active campaigns</span><strong>${k.activeCampaigns ?? 0}</strong></div>
        <div class="kpi"><span class="muted">Redeemed today</span><strong>${k.redemptionsToday ?? 0}</strong></div>
        <div class="kpi"><span class="muted">Redeemed 7d</span><strong>${k.redemptions7d ?? 0}</strong></div>
        <div class="kpi"><span class="muted">Codes available</span><strong>${k.codesAvailable ?? 0}</strong></div>
        <div class="kpi"><span class="muted">Low stock</span><strong>${k.codesLowStock ?? 0}</strong></div>
        <div class="kpi"><span class="muted">Coins spent 7d</span><strong>${k.coinsSpentOnRewards7d ?? 0}</strong></div>
      </div>
      <div class="grid-2" style="gap:16px;margin-top:16px">
        <section class="card">
          <h4>Redemption trend (7d)</h4>
          <table class="table dense"><thead><tr><th>Day</th><th>Count</th></tr></thead>
          <tbody>${(data.trend7d || [])
            .map((d) => `<tr><td>${esc(d.day)}</td><td>${d.redemptions}</td></tr>`)
            .join('') || '<tr><td colspan="2" class="muted">No data</td></tr>'}</tbody></table>
        </section>
        <section class="card">
          <h4>Needs attention</h4>
          <p class="muted sm">Low stock</p>
          <ul>${(data.needsAttention?.lowStock || [])
            .map((x) => `<li>${esc(x.rewardKey)} — ${esc(x.stockState)} (${x.available})</li>`)
            .join('') || '<li class="muted">None</li>'}</ul>
          <p class="muted sm">Ending soon</p>
          <ul>${(data.needsAttention?.endingSoon || [])
            .map((x) => `<li>${esc(x.name)} (${esc(x.partnerKey || '—')})</li>`)
            .join('') || '<li class="muted">None</li>'}</ul>
        </section>
      </div>
      <section class="card" style="margin-top:16px">
        <h4>Recent activity</h4>
        <table class="table dense"><thead><tr><th>ID</th><th>Reward</th><th>Status</th><th>Coins</th><th>User</th></tr></thead>
        <tbody>${(data.recentActivity || [])
          .map(
            (r) =>
              `<tr><td class="mono">${esc(String(r.id).slice(0, 8))}…</td><td>${esc(r.rewardKey || '')}</td><td>${esc(r.status)}</td><td>${r.coinCost}</td><td>${esc(r.maskedUserRef || '')}</td></tr>`,
          )
          .join('') || '<tr><td colspan="5" class="muted">No partner campaigns yet.</td></tr>'}</tbody></table>
      </section>`;
    bindSubnav(root);
  }

  async function renderPartners(root) {
    const data = await apiRewards('/partners');
    const items = data.items || [];
    root.innerHTML = `
      ${subnav('partners')}
      <div class="page-head row-between">
        <div><p class="kicker">Partners</p><h3>Commercial partners</h3></div>
        <button type="button" class="btn primary" id="rw-partner-create">Create partner</button>
      </div>
      ${
        items.length === 0
          ? `<div class="empty card"><p>No partner campaigns yet.</p><p class="muted">Create a partner, then a campaign. Do not seed fake production partners.</p></div>`
          : `<table class="table dense"><thead><tr><th>Partner</th><th>Status</th><th>Category</th><th>Country</th><th></th></tr></thead>
        <tbody>${items
          .map(
            (p) =>
              `<tr><td><strong>${esc(p.displayName)}</strong><div class="muted mono sm">${esc(p.key)}</div></td><td>${esc(p.status)}</td><td>${esc(p.category || '—')}</td><td>${esc(p.countryCode || '—')}</td>
              <td><button type="button" class="btn ghost sm" data-pause-partner="${esc(p.id)}" data-status="${esc(p.status)}">${p.status === 'ACTIVE' ? 'Pause' : 'Activate'}</button></td></tr>`,
          )
          .join('')}</tbody></table>`
      }`;
    bindSubnav(root);
    $('rw-partner-create')?.addEventListener('click', async () => {
      const key = prompt('Partner key (e.g. MEDI_PHARMACY_DEMO)');
      if (!key) return;
      const displayName = prompt('Display name', key) || key;
      try {
        await apiRewards('/partners', {
          method: 'POST',
          body: { key, displayName, status: 'DRAFT', category: 'OTHER' },
        });
        toast('Partner created', 'ok');
        void renderRewards();
      } catch (e) {
        toast(e.message || 'Failed', 'err');
      }
    });
    root.querySelectorAll('[data-pause-partner]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-pause-partner');
        const cur = btn.getAttribute('data-status');
        const status = cur === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        try {
          await apiRewards(`/partners/${id}`, { method: 'PATCH', body: { status } });
          toast(`Partner ${status}`, 'ok');
          void renderRewards();
        } catch (e) {
          toast(e.message || 'Failed', 'err');
        }
      });
    });
  }

  async function renderCampaigns(root) {
    const data = await apiRewards('/campaigns');
    const items = data.items || [];
    root.innerHTML = `
      ${subnav('campaigns')}
      <div class="page-head"><p class="kicker">Campaigns</p><h3>Reward campaigns</h3></div>
      ${
        items.length === 0
          ? `<div class="empty card"><p>No partner campaigns yet.</p><p class="muted">Create partner → attach reward definition → activate when inventory is ready.</p></div>`
          : `<table class="table dense"><thead><tr><th>Campaign</th><th>Partner</th><th>Status</th><th>Reward</th><th>Cost</th><th>Inventory</th><th>Redeemed</th><th></th></tr></thead>
        <tbody>${items
          .map(
            (c) => `<tr>
            <td><strong>${esc(c.name)}</strong><div class="muted mono sm">${esc(c.key)}</div></td>
            <td>${esc(c.partner?.displayName || '')}</td>
            <td>${esc(c.status)}</td>
            <td>${esc(c.reward?.key || '')}</td>
            <td>${c.reward?.coinCost ?? '—'}</td>
            <td>${esc(c.inventory?.stockState || '—')} ${c.inventory?.available != null ? `(${c.inventory.available})` : ''}</td>
            <td>${c.redemptions ?? 0}</td>
            <td class="row-actions">
              ${c.status !== 'ACTIVE' ? `<button type="button" class="btn primary sm" data-act="${esc(c.id)}">Activate</button>` : ''}
              ${c.status === 'ACTIVE' ? `<button type="button" class="btn ghost sm" data-pause="${esc(c.id)}">Pause</button>` : ''}
            </td>
          </tr>`,
          )
          .join('')}</tbody></table>`
      }`;
    bindSubnav(root);
    root.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiRewards(`/campaigns/${btn.getAttribute('data-act')}/activate`, { method: 'POST' });
          toast('Activated', 'ok');
          void renderRewards();
        } catch (e) {
          toast(e.message || 'Activation failed', 'err');
        }
      });
    });
    root.querySelectorAll('[data-pause]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiRewards(`/campaigns/${btn.getAttribute('data-pause')}/pause`, { method: 'POST' });
          toast('Paused', 'ok');
          void renderRewards();
        } catch (e) {
          toast(e.message || 'Failed', 'err');
        }
      });
    });
  }

  async function renderRedemptions(root) {
    const data = await apiRewards('/redemptions?limit=50');
    const items = data.items || [];
    root.innerHTML = `
      ${subnav('redemptions')}
      <div class="page-head"><p class="kicker">Redemptions</p><h3>Operational ledger</h3></div>
      <table class="table dense"><thead><tr><th>ID</th><th>Reward</th><th>Partner</th><th>Status</th><th>Coins</th><th>Code</th><th>User</th><th>When</th></tr></thead>
      <tbody>${items
        .map(
          (r) => `<tr>
          <td class="mono"><button type="button" class="link" data-red="${esc(r.id)}">${esc(String(r.id).slice(0, 8))}…</button></td>
          <td>${esc(r.reward?.key || '')}</td>
          <td>${esc(r.partner?.displayName || r.partner?.key || '—')}</td>
          <td>${esc(r.status)}</td>
          <td>${r.coinCost}</td>
          <td>${esc(r.codeMasked || r.codeState || '—')}</td>
          <td>${esc(r.maskedUserRef || '')}</td>
          <td>${esc(String(r.redeemedAt || '').slice(0, 19))}</td>
        </tr>`,
        )
        .join('') || '<tr><td colspan="8" class="muted">No redemptions</td></tr>'}</tbody></table>`;
    bindSubnav(root);
    root.querySelectorAll('[data-red]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const detail = await apiRewards(`/redemptions/${btn.getAttribute('data-red')}`);
          alert(
            JSON.stringify(
              {
                id: detail.id,
                status: detail.status,
                reward: detail.reward?.key,
                codeMasked: detail.code?.codeMasked,
                audit: (detail.audit || []).length,
              },
              null,
              2,
            ),
          );
        } catch (e) {
          toast(e.message || 'Failed', 'err');
        }
      });
    });
  }

  async function renderCodes(root) {
    const defs = await apiRewards('/definitions');
    const pools = (defs.items || []).filter((d) => d.inventoryMode === 'CODE_POOL');
    root.innerHTML = `
      ${subnav('codes')}
      <div class="page-head"><p class="kicker">Code Inventory</p><h3>CODE_POOL rewards</h3>
      <p class="muted">Import returns counts only — plaintext codes are never listed in bulk.</p></div>
      <table class="table dense"><thead><tr><th>Reward</th><th>Status</th><th>Partner</th><th></th></tr></thead>
      <tbody>${pools
        .map(
          (d) => `<tr><td class="mono">${esc(d.key)}</td><td>${esc(d.status)}</td><td>${esc(d.partnerKey || '—')}</td>
        <td><button type="button" class="btn ghost sm" data-import="${esc(d.id)}">Import codes</button>
        <button type="button" class="btn ghost sm" data-list="${esc(d.id)}">View masked</button></td></tr>`,
        )
        .join('') || '<tr><td colspan="4" class="muted">No CODE_POOL rewards</td></tr>'}</tbody></table>
      <div id="rw-codes-panel"></div>`;
    bindSubnav(root);
    root.querySelectorAll('[data-import]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const raw = prompt('Paste codes (one per line)');
        if (!raw) return;
        const codes = raw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        try {
          const res = await apiRewards(`/rewards/${btn.getAttribute('data-import')}/codes/import`, {
            method: 'POST',
            body: { codes },
          });
          toast(`Imported: ${JSON.stringify(res.report)}`, 'ok');
        } catch (e) {
          toast(e.message || 'Import failed', 'err');
        }
      });
    });
    root.querySelectorAll('[data-list]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await apiRewards(`/rewards/${btn.getAttribute('data-list')}/codes?limit=25`);
          const panel = $('rw-codes-panel');
          if (!panel) return;
          panel.innerHTML = `<table class="table dense"><thead><tr><th>Masked</th><th>Status</th><th>Expiry</th></tr></thead>
            <tbody>${(res.items || [])
              .map(
                (c) =>
                  `<tr><td class="mono">${esc(c.codeMasked)}</td><td>${esc(c.status)}</td><td>${esc(String(c.expiresAt || '—').slice(0, 19))}</td></tr>`,
              )
              .join('')}</tbody></table>`;
        } catch (e) {
          toast(e.message || 'Failed', 'err');
        }
      });
    });
  }

  async function renderRewards() {
    const root = $('tab-rewards');
    if (!root) return;
    root.innerHTML = '<div class="empty">იტვირთება…</div>';
    try {
      if (R.subtab === 'partners') await renderPartners(root);
      else if (R.subtab === 'campaigns') await renderCampaigns(root);
      else if (R.subtab === 'redemptions') await renderRedemptions(root);
      else if (R.subtab === 'codes') await renderCodes(root);
      else await renderOverview(root);
    } catch (e) {
      root.innerHTML = `${subnav(R.subtab)}<div class="empty err">${esc(e.message || 'Failed to load Rewards')}</div>`;
      bindSubnav(root);
    }
  }

  global.renderRewards = renderRewards;
})(window);
