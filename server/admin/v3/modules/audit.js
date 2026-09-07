/**
 * MediCard Admin V3 — Audit journal observatory (full override of renderAuditLog).
 * Search + action filter + pagination. URL range/grain are unused by audit APIs.
 */
(function adminV3Audit(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const ACTION_OPTS = [
    ['', 'ყველა ქმედება'],
    ['user.status', 'მომხმარებლის სტატუსი'],
    ['settings.update', 'პარამეტრები'],
    ['push.template.save', 'Push შაბლონი · შენახვა'],
    ['push.template.reset', 'Push შაბლონი · reset'],
    ['PARTNER_CREATED', 'პარტნიორი · შექმნა'],
    ['PARTNER_UPDATED', 'პარტნიორი · განახლება'],
    ['CAMPAIGN_CREATED', 'კამპანია · შექმნა'],
    ['CAMPAIGN_UPDATED', 'კამპანია · განახლება'],
    ['CAMPAIGN_STATUS_CHANGED', 'კამპანია · სტატუსი'],
    ['INVENTORY_ADJUSTED', 'მარაგი'],
    ['CODE_IMPORTED', 'კოდების იმპორტი'],
    ['REDEMPTION_STATUS_CHANGED', 'გაცვლის სტატუსი'],
  ];

  const ACTION_KA = Object.fromEntries(ACTION_OPTS.filter(([k]) => k));

  let state = { q: '', action: '', offset: 0, limit: 40 };
  let lastRows = [];

  function esc(v) {
    if (typeof opsEscape === 'function') return opsEscape(v);
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
  function escA(v) {
    return typeof escapeAttr === 'function' ? escapeAttr(v) : esc(v).replaceAll("'", '&#39;');
  }
  function fmt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('ka-GE');
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
  }
  function shortDate(iso) {
    if (typeof fmtDateShort === 'function') return fmtDateShort(iso);
    return iso || '—';
  }
  function fullDate(iso) {
    if (typeof fmtDate === 'function') return fmtDate(iso);
    return iso || '—';
  }
  function actionLabel(action) {
    return ACTION_KA[action] || action || '—';
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
    if (!keys.length) return actionLabel(row.action);
    return keys.map((key) => `${key}: ${compactAuditVal(prev[key])} → ${compactAuditVal(next[key])}`).join(' · ');
  }

  function readHashState() {
    const params = Shell().hashParams ? Shell().hashParams() : new URLSearchParams(location.hash.split('?')[1] || '');
    state.q = (params.get('q') || '').trim();
    state.action = (params.get('action') || '').trim();
    const off = Number(params.get('offset') || 0);
    state.offset = Number.isFinite(off) && off > 0 ? off : 0;
  }

  function writeHashState() {
    Shell().writeModuleHash?.('audit', {
      q: state.q || null,
      action: state.action || null,
      offset: state.offset > 0 ? String(state.offset) : null,
    });
  }

  function kpiCell(icoName, label, value, hint, tone) {
    const toneClass =
      tone === 'warn'
        ? ' is-amber'
        : tone === 'ok'
          ? ' is-ok'
          : tone === 'soft'
            ? ' is-soft'
            : '';
    return `<article class="v3-audit-kpi${toneClass}">
      <span class="v3-audit-kpi-ico" aria-hidden="true">${ico(icoName || 'shield')}</span>
      <div class="v3-audit-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${value}</strong>
        ${hint != null && hint !== '' ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function openAuditDetail(row) {
    if (!row || typeof openDrawer !== 'function') return;
    const prev = row.previousValue || {};
    const next = row.newValue || {};
    const keys = [...new Set([...Object.keys(prev), ...Object.keys(next)])];
    const changes = keys.length
      ? keys
          .map(
            (key) => `<div class="v3-audit-diff">
              <code>${esc(key)}</code>
              <strong>${esc(compactAuditVal(prev[key]))} → ${esc(compactAuditVal(next[key]))}</strong>
            </div>`,
          )
          .join('')
      : '<p class="muted v3-audit-empty-note">ცვლილების დეტალი არ არის.</p>';

    const rawPrev = JSON.stringify(prev, null, 2);
    const rawNext = JSON.stringify(next, null, 2);

    openDrawer(
      `
      <div class="umodal v3-audit-modal">
        <header class="umodal-hero v3-audit-modal-hero">
          <div class="umodal-hero-copy">
            <p class="kicker">აუდიტი</p>
            <h3>${esc(actionLabel(row.action))}</h3>
            <p class="muted">${esc(row.adminEmail || '—')} · ${esc(fullDate(row.createdAt))}</p>
          </div>
          <button type="button" class="btn icon-only ghost umodal-close" id="drawer-cancel" aria-label="დახურვა" title="დახურვა">${ico('x') || '×'}</button>
        </header>
        <div class="umodal-body v3-audit-modal-body">
          <section class="v3-audit-block">
            <h4>ობიექტი</h4>
            <div class="v3-audit-meta">
              <div><span>ტიპი</span><strong>${esc(row.targetType || '—')}</strong></div>
              <div><span>ID</span><strong class="mono">${esc(row.targetId || '—')}</strong></div>
              <div><span>ქმედება</span><strong class="mono">${esc(row.action || '—')}</strong></div>
            </div>
          </section>
          <section class="v3-audit-block">
            <h4>ცვლილება</h4>
            <div class="v3-audit-diffs">${changes}</div>
          </section>
          <details class="v3-audit-raw">
            <summary>ტექნიკური JSON</summary>
            <div class="v3-audit-raw-split">
              <div>
                <span>წინა</span>
                <pre>${esc(rawPrev)}</pre>
              </div>
              <div>
                <span>ახალი</span>
                <pre>${esc(rawNext)}</pre>
              </div>
            </div>
          </details>
        </div>
      </div>
    `,
      { modal: true, wide: true },
    );
    $('drawer-cancel')?.addEventListener('click', () => {
      if (typeof closeDrawer === 'function') closeDrawer();
    });
  }

  function logsQuery() {
    const qs = new URLSearchParams();
    qs.set('limit', String(state.limit));
    qs.set('offset', String(state.offset));
    if (state.q) qs.set('q', state.q);
    if (state.action) qs.set('action', state.action);
    return qs.toString();
  }

  function tableRowsHtml(rows) {
    if (!rows.length) {
      return `<tr><td colspan="5"><div class="v3-audit-empty-inline">
        <strong>ჩანაწერი არ არის</strong>
        <p>შაბლონის, პარამეტრების ან სტატუსის შენახვა აქ გამოჩნდება.</p>
      </div></td></tr>`;
    }
    return rows
      .map(
        (row, i) => `<tr class="is-click" data-audit="${i}" tabindex="0">
        <td class="muted">${esc(shortDate(row.createdAt))}</td>
        <td>${esc(row.adminEmail || '—')}</td>
        <td><span class="v3-audit-pill">${esc(actionLabel(row.action))}</span></td>
        <td class="mono">${esc([row.targetType, row.targetId].filter(Boolean).join(' · ') || '—')}</td>
        <td class="v3-audit-clip muted">${esc(summarizeAudit(row))}</td>
      </tr>`,
      )
      .join('');
  }

  function bindRows(host, rows) {
    host.querySelectorAll('tr[data-audit]').forEach((tr) => {
      const open = () => openAuditDetail(rows[Number(tr.dataset.audit)]);
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  async function loadJournal() {
    const tbody = $('audit-log-body');
    const meta = $('audit-log-meta');
    const kpis = $('audit-kpis');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5"><div class="v3-audit-empty-inline">იტვირთება…</div></td></tr>`;
    writeHashState();

    try {
      const data = await api(`/audit?${logsQuery()}`);
      const rows = data.entries || [];
      lastRows = rows;
      const total = Number(data.total) || 0;
      const admins = new Set(rows.map((r) => r.adminEmail).filter(Boolean)).size;
      const actions = new Set(rows.map((r) => r.action).filter(Boolean)).size;
      const shownEnd = Math.min(state.offset + rows.length, total);

      tbody.innerHTML = tableRowsHtml(rows);
      bindRows(tbody, rows);

      if (meta) {
        meta.textContent = total
          ? `${fmt(state.offset + (rows.length ? 1 : 0))}–${fmt(shownEnd)} / ${fmt(total)}`
          : '0 ჩანაწერი';
      }
      if (kpis) {
        kpis.innerHTML = `
          ${kpiCell('file', 'სულ ჩანაწერი', fmt(total), state.q || state.action ? 'ფილტრის მიხედვით' : 'ყველა', 'soft')}
          ${kpiCell('activity', 'ამ გვერდზე', fmt(rows.length), `ლიმიტი ${state.limit}`, '')}
          ${kpiCell('users', 'ადმინები', fmt(admins), 'ამ გვერდზე', admins ? 'ok' : '')}
          ${kpiCell('layers', 'ქმედებები', fmt(actions), 'უნიკალური ამ გვერდზე', 'soft')}
        `;
      }

      const prev = $('audit-log-prev');
      const next = $('audit-log-next');
      if (prev) prev.disabled = state.offset <= 0;
      if (next) next.disabled = state.offset + state.limit >= total;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="v3-audit-empty-inline is-err">
        <strong>აუდიტი ვერ ჩაიტვირთა</strong>
        <p>${esc(err.message || 'შეცდომა')}</p>
        <button type="button" class="btn ghost compact" id="audit-retry">${ico('refresh')} ხელახლა ცდა</button>
      </div></td></tr>`;
      $('audit-retry')?.addEventListener('click', () => void loadJournal());
    }
  }

  async function renderAuditLogV3() {
    const root = $('tab-audit');
    if (!root) return;
    const Sh = Shell();

    readHashState();

    Sh.mountHeader?.({
      tab: 'audit',
      kicker: 'Production',
      title: 'აუდიტი',
      purpose: 'ვინ შეცვალა შაბლონები, პარამეტრები ან სტატუსი — და როდის.',
      helpKey: 'audit.page',
    });

    root.classList.add('v3-workspace-wide', 'v3-module', 'v3-audit');
    root.innerHTML = `
      <div class="v3-audit-body dash-enter" data-v3-audit="page">
        <div class="v3-audit-toolbar">
          <div class="v3-audit-toolbar-copy">
            <strong>აუდიტის ობსერვატორია</strong>
            <span>ადმინისტრაციული ცვლილებები · საიდუმლოებები დამალულია · პერიოდის ფილტრი არ გამოიყენება</span>
          </div>
          <div class="v3-audit-toolbar-actions">
            ${helpBtn('audit.page')}
            <button type="button" class="btn ghost compact" id="audit-export">${ico('file')} CSV</button>
            <button type="button" class="btn ghost compact" id="audit-refresh">${ico('refresh')} განახლება</button>
          </div>
        </div>

        <div class="v3-audit-kpis" id="audit-kpis" role="group" aria-label="აუდიტის მდგომარეობა">
          ${kpiCell('file', 'სულ ჩანაწერი', '…', '', 'soft')}
          ${kpiCell('activity', 'ამ გვერდზე', '…', '', '')}
          ${kpiCell('users', 'ადმინები', '…', '', '')}
          ${kpiCell('layers', 'ქმედებები', '…', '', '')}
        </div>

        <section class="v3-audit-panel" data-v3-audit="journal">
          <div class="v3-audit-head">
            <div class="v3-audit-head-copy">
              <div class="v3-title-row"><h3>აუდიტის ჟურნალი</h3></div>
              <p class="muted"><span id="audit-log-meta">იტვირთება…</span></p>
            </div>
          </div>

          <div class="v3-audit-filters">
            <select id="audit-action" aria-label="ქმედება">
              ${ACTION_OPTS.map(
                ([val, label]) =>
                  `<option value="${escA(val)}"${state.action === val ? ' selected' : ''}>${esc(label)}</option>`,
              ).join('')}
            </select>
            <label class="v3-audit-search">
              <span class="sr-only">ძებნა</span>
              ${ico('search')}
              <input id="audit-q" type="search" placeholder="ადმინი, ქმედება, ობიექტი…" value="${escA(state.q)}" autocomplete="off" />
            </label>
            <button type="button" class="btn secondary compact" id="audit-search">ძებნა</button>
          </div>

          <div class="v3-audit-table-wrap">
            <table class="v3-audit-table">
              <thead>
                <tr>
                  <th>დრო</th>
                  <th>ადმინი</th>
                  <th>ქმედება</th>
                  <th>ობიექტი</th>
                  <th>ცვლილება</th>
                </tr>
              </thead>
              <tbody id="audit-log-body"></tbody>
            </table>
          </div>

          <div class="v3-audit-pager">
            <button type="button" class="btn ghost compact" id="audit-log-prev" disabled>წინა</button>
            <button type="button" class="btn ghost compact" id="audit-log-next" disabled>შემდეგი</button>
          </div>
        </section>
      </div>
    `;

    let qTimer = null;
    const applySearch = () => {
      state.q = ($('audit-q')?.value || '').trim();
      state.action = $('audit-action')?.value || '';
      state.offset = 0;
      void loadJournal();
    };

    $('audit-refresh')?.addEventListener('click', () => void loadJournal());
    $('audit-search')?.addEventListener('click', applySearch);
    $('audit-action')?.addEventListener('change', applySearch);
    $('audit-q')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applySearch();
    });
    $('audit-q')?.addEventListener('input', () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(applySearch, 320);
    });
    $('audit-log-prev')?.addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - state.limit);
      void loadJournal();
    });
    $('audit-log-next')?.addEventListener('click', () => {
      state.offset += state.limit;
      void loadJournal();
    });
    $('audit-export')?.addEventListener('click', () => {
      const qs = new URLSearchParams();
      if (state.q) qs.set('q', state.q);
      else if (state.action) qs.set('q', state.action);
      const path = `/export/audit${qs.toString() ? `?${qs}` : ''}`;
      if (typeof opsDownload === 'function') void opsDownload(path, 'audit.csv');
    });

    await loadJournal();
  }

  global.renderAuditLog = renderAuditLogV3;
})(window);
