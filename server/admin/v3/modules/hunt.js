/**
 * MediCard Admin V3 — Medi Hunt operations.
 * URL: #/hunt
 */
(function adminV3Hunt(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  function esc(v) {
    return typeof escapeHtml === 'function'
      ? escapeHtml(v)
      : String(v ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function fmt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('ka-GE');
  }
  function onOff(on) {
    return typeof onOffLabel === 'function' ? onOffLabel(on) : on ? 'ჩართულია' : 'გამორთულია';
  }

  async function apiHunt(path, options = {}) {
    return api(`/hunt${path}`, options);
  }

  function numInput(id, label, value, step) {
    return `<label class="field"><span>${esc(label)}</span><input id="${id}" type="number" step="${step || '1'}" value="${esc(value)}" /></label>`;
  }

  function statusKa(s) {
    return (
      {
        preparing: 'მზადება',
        active: 'აქტიური',
        paused: 'პაუზა',
        encounter: 'შეხვედრა',
        completed: 'დასრულდა',
        ended: 'შეწყდა',
        expired: 'ვადა',
        unavailable: 'მიუწვდომელი',
      }[s] || s
    );
  }

  async function renderHunt() {
    const root = $('tab-hunt');
    if (!root) return;
    const Sh = Shell();
    Sh.mountHeader?.({
      tab: 'hunt',
      kicker: 'Play',
      title: 'Medi Hunt',
      purpose: 'ქუჩის ნადირობის წესები, სესიები და QA — ჯილდოები მხოლოდ სერვერის ლეჯერზე.',
      helpKey: 'hunt.page',
    });
    root.classList.add('v3-workspace-wide', 'v3-module', 'v3-hunt');
    root.innerHTML = `<div class="v3-settings-body dash-enter"><div class="v3-settings-toolbar"><strong>Medi Hunt</strong><span>იტვირთება…</span></div></div>`;

    let overview;
    try {
      overview = await apiHunt('/overview');
    } catch (err) {
      root.innerHTML = `<div class="v3-settings-empty is-err">
        <strong>Hunt ვერ ჩაიტვირთა</strong>
        <p>${esc(err.message || 'სქემა ჯერ არ არის გამოყენებული ამ ბაზაზე.')}</p>
        <button type="button" class="btn ghost compact" id="hunt-retry">${ico('refresh')} ხელახლა</button>
      </div>`;
      $('hunt-retry')?.addEventListener('click', () => void renderHunt());
      return;
    }

    const c = overview.config || {};
    const m = overview.metrics || {};
    const [sessions, captures, suspicious, qa, audit] = await Promise.all([
      apiHunt('/sessions?take=20').catch(() => ({ items: [], total: 0 })),
      apiHunt('/captures?take=20').catch(() => ({ items: [], total: 0 })),
      apiHunt('/suspicious?take=20').catch(() => ({ items: [], total: 0 })),
      apiHunt('/qa').catch(() => ({ items: [] })),
      apiHunt('/audit?take=20').catch(() => ({ entries: [], total: 0 })),
    ]);

    root.innerHTML = `
      <div class="v3-settings-body dash-enter">
        <div class="v3-settings-toolbar">
          <div class="v3-settings-toolbar-copy">
            <strong>Medi Hunt კონსოლი</strong>
            <span>სნეპშოტი იწერება სესიის დაწყებაზე · ცოცხალი გამორთვა მაინც მოქმედებს</span>
          </div>
          <div class="v3-settings-toolbar-actions">
            <button type="button" class="btn ghost compact" id="hunt-refresh">${ico('refresh')} განახლება</button>
          </div>
        </div>
        <div class="v3-settings-kpis" role="group">
          <article class="v3-settings-kpi"><strong>${onOff(c.enabled)}</strong><span>თამაში</span></article>
          <article class="v3-settings-kpi"><strong>${onOff(c.rewardsEnabled)}</strong><span>ჯილდოები</span></article>
          <article class="v3-settings-kpi"><strong>${fmt(m.active)}</strong><span>აქტიური სესია</span></article>
          <article class="v3-settings-kpi"><strong>${fmt(m.captures)}</strong><span>დაჭერა</span></article>
          <article class="v3-settings-kpi"><strong>${fmt(m.suspicious)}</strong><span>საეჭვო</span></article>
        </div>

        <form id="hunt-config" class="v3-settings-form" style="display:grid;gap:12px;margin-top:16px">
          <h3>წესები</h3>
          <label class="field"><span>თამაში ჩართულია</span><input id="h-enabled" type="checkbox" ${c.enabled ? 'checked' : ''} /></label>
          <label class="field"><span>ჯილდოები ჩართულია</span><input id="h-rewards" type="checkbox" ${c.rewardsEnabled ? 'checked' : ''} /></label>
          <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
            ${numInput('h-play', 'ზონა (მ)', c.playAreaM)}
            ${numInput('h-capR', 'დაჭერის რადიუსი (მ)', c.captureRadiusM, '0.1')}
            ${numInput('h-acc', 'GPS სიზუსტე (მ)', c.accuracyMaxM, '0.1')}
            ${numInput('h-enemies', 'მტრები', c.enemyCount)}
            ${numInput('h-capsules', 'კაფსულები', c.capsuleCount)}
            ${numInput('h-hunt', 'ნადირობა (წმ)', c.huntDurationSec)}
            ${numInput('h-stack', 'ნადირობის მაქს (წმ)', c.huntMaxStackedSec)}
            ${numInput('h-chaser', 'მდევარი მ/წმ', c.chaserSpeedMps, '0.05')}
            ${numInput('h-inter', 'შემხვედრი მ/წმ', c.interceptorSpeedMps, '0.05')}
            ${numInput('h-patrol', 'პატრული მ/წმ', c.patrollerSpeedMps, '0.05')}
            ${numInput('h-flee', 'გაქცევა მ/წმ', c.fleeSpeedMps, '0.05')}
            ${numInput('h-sessCap', 'სესიის მონეტები', c.coins?.sessionCap)}
            ${numInput('h-dayCap', 'დღიური მონეტები', c.coins?.dailyCap)}
            ${numInput('h-capCoin', 'დაჭერის მონეტა', c.coins?.capture)}
            ${numInput('h-sessCoin', 'სესიის დასრულება', c.coins?.sessionComplete)}
            ${numInput('h-missCoin', 'მისიის მონეტა', c.coins?.dailyMission)}
            ${numInput('h-qualM', 'სესია მეტრი', c.qualify?.meters)}
            ${numInput('h-qualG', 'რბილი მეტრი', c.qualify?.gentleMeters)}
            ${numInput('h-sessMin', 'სესია წთ', c.sessionMinutesDefault)}
            ${numInput('h-gentleMin', 'რბილი წთ', c.sessionMinutesGentle)}
          </div>
          <label class="field"><span>Overpass HTTPS URL</span><input id="h-overpass" type="url" value="${esc(c.overpassUrl || '')}" /></label>
          <label class="field"><span>გამორიცხული უბნები (JSON: south,west,north,east)</span>
            <textarea id="h-excl" rows="3">${esc(JSON.stringify(c.exclusions || [], null, 2))}</textarea>
          </label>
          <p class="muted">მოდელი: ${(overview.models || []).map((x) => esc(x.key)).join(', ') || 'virus_1'} — ატვირთვა არ არის, მხოლოდ bundled კატალოგი.</p>
          <button type="submit" class="btn primary">შენახვა</button>
        </form>

        <h3 style="margin-top:22px">სესიები (${fmt(sessions.total)})</h3>
        <table class="table"><thead><tr><th>ID</th><th>მომხმარებელი</th><th>სტატუსი</th><th>სიმ.</th><th>დაჭერა</th><th></th></tr></thead>
        <tbody>${(sessions.items || [])
          .map(
            (s) => `<tr>
              <td>${esc(String(s.id).slice(0, 8))}</td>
              <td>${esc(s.userId).slice(0, 8)}</td>
              <td>${esc(statusKa(s.status))}</td>
              <td>${s.simulation ? 'სიმულაცია' : '—'}</td>
              <td>${fmt(s.captures)}</td>
              ${typeof tableActionCell === 'function' ? tableActionCell(`<button type="button" class="btn ghost compact hunt-kill" data-id="${esc(s.id)}">შეწყვეტა</button>`) : `<td><button type="button" class="btn ghost compact hunt-kill" data-id="${esc(s.id)}">შეწყვეტა</button></td>`}
            </tr>`,
          )
          .join('')}</tbody></table>

        <h3 style="margin-top:22px">დაჭერები (${fmt(captures.total)})</h3>
        <table class="table"><thead><tr><th>სესია</th><th>მტერი</th><th>დრო</th></tr></thead>
        <tbody>${(captures.items || [])
          .map((x) => `<tr><td>${esc(String(x.sessionId).slice(0, 8))}</td><td>${esc(x.enemyId)}</td><td>${esc(x.createdAt)}</td></tr>`)
          .join('')}</tbody></table>

        <h3 style="margin-top:22px">საეჭვო მოვლენები (${fmt(suspicious.total)})</h3>
        <table class="table"><thead><tr><th>მიზეზი</th><th>მომხმარებელი</th><th>დრო</th></tr></thead>
        <tbody>${(suspicious.items || [])
          .map((x) => `<tr><td>${esc(x.reason)}</td><td>${esc(String(x.userId).slice(0, 8))}</td><td>${esc(x.createdAt)}</td></tr>`)
          .join('')}</tbody></table>

        <h3 style="margin-top:22px">QA სიმულაცია</h3>
        <form id="hunt-qa" class="row" style="display:flex;gap:8px;align-items:flex-end">
          <label class="field"><span>userId</span><input id="h-qa-user" type="text" /></label>
          <button type="submit" class="btn">ნებართვა</button>
        </form>
        <ul>${(qa.items || []).map((g) => `<li>${esc(g.userId)} <button type="button" class="btn ghost compact hunt-qa-rev" data-id="${esc(g.userId)}">გაუქმება</button></li>`).join('')}</ul>

        <h3 style="margin-top:22px">აუდიტი (${fmt(audit.total)})</h3>
        <table class="table"><thead><tr><th>ქმედება</th><th>ადმინი</th><th>დრო</th></tr></thead>
        <tbody>${(audit.entries || [])
          .map((x) => `<tr><td>${esc(x.action)}</td><td>${esc(x.adminEmail)}</td><td>${esc(x.createdAt)}</td></tr>`)
          .join('')}</tbody></table>
      </div>`;

    $('hunt-refresh')?.addEventListener('click', () => void renderHunt());
    $('hunt-config')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      let exclusions = [];
      try {
        exclusions = JSON.parse($('h-excl').value || '[]');
      } catch {
        toast('გამორიცხვების JSON არასწორია.', 'error');
        return;
      }
      try {
        await apiHunt('/config', {
          method: 'PUT',
          body: {
            enabled: $('h-enabled').checked,
            rewardsEnabled: $('h-rewards').checked,
            playAreaM: Number($('h-play').value),
            captureRadiusM: Number($('h-capR').value),
            accuracyMaxM: Number($('h-acc').value),
            enemyCount: Number($('h-enemies').value),
            capsuleCount: Number($('h-capsules').value),
            huntDurationSec: Number($('h-hunt').value),
            huntMaxStackedSec: Number($('h-stack').value),
            chaserSpeedMps: Number($('h-chaser').value),
            interceptorSpeedMps: Number($('h-inter').value),
            patrollerSpeedMps: Number($('h-patrol').value),
            fleeSpeedMps: Number($('h-flee').value),
            coins: {
              sessionCap: Number($('h-sessCap').value),
              dailyCap: Number($('h-dayCap').value),
              capture: Number($('h-capCoin').value),
              sessionComplete: Number($('h-sessCoin').value),
              dailyMission: Number($('h-missCoin').value),
            },
            qualify: {
              meters: Number($('h-qualM').value),
              gentleMeters: Number($('h-qualG').value),
            },
            sessionMinutesDefault: Number($('h-sessMin').value),
            sessionMinutesGentle: Number($('h-gentleMin').value),
            overpassUrl: $('h-overpass').value.trim(),
            exclusions,
          },
        });
        if (typeof toast === 'function') toast('Hunt წესები შენახულია.');
        void renderHunt();
      } catch (err) {
        if (typeof toast === 'function') toast(err.message || 'შენახვა ვერ მოხერხდა', 'error');
      }
    });
    root.querySelectorAll('.hunt-kill').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiHunt(`/sessions/${btn.dataset.id}/terminate`, { method: 'POST' });
          void renderHunt();
        } catch (err) {
          if (typeof toast === 'function') toast(err.message, 'error');
        }
      });
    });
    $('hunt-qa')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await apiHunt('/qa', { method: 'POST', body: { userId: $('h-qa-user').value.trim() } });
        void renderHunt();
      } catch (err) {
        if (typeof toast === 'function') toast(err.message, 'error');
      }
    });
    root.querySelectorAll('.hunt-qa-rev').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await apiHunt(`/qa/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
        void renderHunt();
      });
    });
  }

  global.renderHunt = renderHunt;
})(window);
