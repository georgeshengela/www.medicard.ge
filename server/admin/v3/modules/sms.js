/**
 * MediCard Admin V3 — SMS observatory (full override of renderSms).
 * Send + balance + journal. URL range/grain are unused by SMS APIs.
 */
(function adminV3Sms(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const PURPOSE_KA = {
    OTP: 'OTP',
    ADMIN: 'ადმინი',
    MARKETING: 'მარკეტინგი',
    TEST: 'ტესტი',
  };
  const STATUS_KA = {
    SENT: 'გაგზავნილი',
    FAILED: 'შეცდომა',
    QUEUED: 'რიგში',
  };

  let logState = { status: 'ALL', purpose: 'ALL', q: '', offset: 0, limit: 40 };

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
  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
  }
  function toastMsg(msg, tone) {
    if (typeof toast === 'function') toast(msg, tone);
  }
  function fmtSmsDate(iso) {
    if (typeof global.fmtSmsDate === 'function') return global.fmtSmsDate(iso);
    if (typeof adminDateParts === 'function' && typeof MONTHS_KA_SHORT !== 'undefined') {
      const p = adminDateParts(iso);
      if (!p) return '—';
      return `${p.day} ${MONTHS_KA_SHORT[p.month]}, ${p.hour}:${p.minute}`;
    }
    return iso || '—';
  }
  function statusTone(status) {
    if (typeof smsStatusTone === 'function') return smsStatusTone(status);
    if (status === 'SENT') return 'ok';
    if (status === 'FAILED') return 'bad';
    return 'warn';
  }
  function purposeLabel(p) {
    return PURPOSE_KA[p] || p || '—';
  }
  function statusLabel(s) {
    return STATUS_KA[s] || s || '—';
  }

  function kpiCell(icoName, label, value, hint, tone) {
    const toneClass =
      tone === 'warn'
        ? ' is-amber'
        : tone === 'bad'
          ? ' is-danger'
          : tone === 'ok'
            ? ' is-ok'
            : tone === 'soft'
              ? ' is-soft'
              : '';
    return `<article class="v3-sms-kpi${toneClass}">
      <span class="v3-sms-kpi-ico" aria-hidden="true">${ico(icoName || 'activity')}</span>
      <div class="v3-sms-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${value}</strong>
        ${hint != null && hint !== '' ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function logsQuery() {
    const qs = new URLSearchParams();
    qs.set('limit', String(logState.limit));
    qs.set('offset', String(logState.offset));
    if (logState.status && logState.status !== 'ALL') qs.set('status', logState.status);
    if (logState.purpose && logState.purpose !== 'ALL') qs.set('purpose', logState.purpose);
    if (logState.q) qs.set('q', logState.q);
    return qs.toString();
  }

  function logRowsHtml(logs) {
    if (!logs.length) {
      return `<tr><td colspan="5"><div class="v3-sms-empty-inline">ჩანაწერი არ არის</div></td></tr>`;
    }
    return logs
      .map(
        (row) => `<tr>
        <td class="muted">${esc(fmtSmsDate(row.createdAt))}</td>
        <td><code>${esc(row.destination)}</code></td>
        <td class="v3-sms-clip" title="${esc(row.content)}">${esc(row.content)}</td>
        <td><span class="v3-sms-pill">${esc(purposeLabel(row.purpose))}</span></td>
        <td><span class="status-pill ${statusTone(row.status)}">${esc(statusLabel(row.status))}</span></td>
      </tr>`,
      )
      .join('');
  }

  function bindSendForm(users) {
    const contentEl = $('sms-content');
    const countEl = $('sms-char-count');
    contentEl?.addEventListener('input', () => {
      if (countEl) countEl.textContent = String(contentEl.value.length);
    });

    const userSel = $('sms-user-id');
    const destEl = $('sms-destination');
    userSel?.addEventListener('change', () => {
      const opt = userSel.selectedOptions?.[0];
      const phone = opt?.getAttribute('data-phone') || '';
      if (phone && destEl && !destEl.value.trim()) destEl.value = phone;
    });

    $('sms-send-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const destination = ($('sms-destination')?.value || '').trim();
      const userId = $('sms-user-id')?.value || undefined;
      const content = ($('sms-content')?.value || '').trim();
      const urgent = !!$('sms-urgent')?.checked;
      if (!content) return toastMsg('შეიყვანეთ ტექსტი', 'bad');
      if (!userId && !destination) return toastMsg('მიუთითეთ ნომერი ან მომხმარებელი', 'bad');

      let dest = destination;
      if (!dest && userId) {
        const u = (users || []).find((x) => x.id === userId);
        dest = u?.phone || '';
      }
      if (!dest) return toastMsg('მიუთითეთ ნომერი ან მომხმარებელი', 'bad');

      try {
        await api('/sms/send', {
          method: 'POST',
          body: { destination: dest, content, userId, urgent },
        });
        toastMsg('SMS გაგზავნილია', 'ok');
        if ($('sms-content')) $('sms-content').value = '';
        if (countEl) countEl.textContent = '0';
        logState.offset = 0;
        await renderSmsV3();
      } catch (err) {
        toastMsg(err.message || 'გაგზავნა ვერ მოხერხდა', 'bad');
      }
    });
  }

  async function reloadLogsOnly() {
    const tbody = document.querySelector('#sms-log-body');
    const meta = document.querySelector('#sms-log-meta');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5"><div class="v3-sms-empty-inline">იტვირთება…</div></td></tr>`;
    try {
      const logs = await api(`/sms/logs?${logsQuery()}`);
      tbody.innerHTML = logRowsHtml(logs.logs || []);
      const total = Number(logs.total) || 0;
      const shown = (logs.logs || []).length;
      if (meta) {
        meta.textContent = total
          ? `${fmt(Math.min(logState.offset + shown, total))} / ${fmt(total)}`
          : '0 ჩანაწერი';
      }
      const prev = $('sms-log-prev');
      const next = $('sms-log-next');
      if (prev) prev.disabled = logState.offset <= 0;
      if (next) next.disabled = logState.offset + logState.limit >= total;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="v3-sms-empty-inline is-err">${esc(e.message || 'შეცდომა')}</div></td></tr>`;
    }
  }

  async function renderSmsV3() {
    Shell().mountHeader?.({
      tab: 'sms',
      kicker: 'Operations',
      title: 'SMS მენეჯმენტი',
      purpose: 'გაგზავნა, ბალანსი და ჟურნალი — მიმღები სავალდებულოა.',
      helpKey: 'sms.page',
    });

    const root = $('tab-sms');
    if (!root) return;

    root.classList.add('v3-workspace-wide', 'v3-module', 'v3-sms');
    root.innerHTML = `<div class="v3-sms-body dash-enter" data-v3-sms="loading">
      <div class="v3-sms-toolbar">
        <div class="v3-sms-toolbar-copy">
          <strong>SMS ობსერვატორია</strong>
          <span>იტვირთება…</span>
        </div>
      </div>
    </div>`;

    let balance;
    let stats;
    let logs;
    let users = { users: [] };
    try {
      [balance, stats, logs, users] = await Promise.all([
        api('/sms/balance'),
        api('/sms/stats'),
        api(`/sms/logs?${logsQuery()}`),
        api('/users?limit=200&offset=0').catch(() => ({ users: [] })),
      ]);
    } catch (e) {
      root.innerHTML = `<div class="v3-sms-body" data-v3-sms="error">
        <div class="v3-sms-empty is-err">
          <strong>ჩატვირთვა ვერ მოხერხდა</strong>
          <p>${esc(e.message || 'უცნობი შეცდომა')}</p>
          <button type="button" class="btn ghost compact" id="sms-retry">${ico('refresh')} ხელახლა სცადე</button>
        </div>
      </div>`;
      $('sms-retry')?.addEventListener('click', () => void renderSmsV3());
      return;
    }

    const balNum = balance.balance;
    const balLabel = !balance.configured
      ? 'API გასაღები არ არის'
      : balNum != null
        ? `${fmt(balNum)} SMS`
        : balance.raw || '—';
    const balTone = !balance.configured ? 'bad' : balNum != null && balNum < 50 ? 'warn' : 'ok';
    const successRate = stats.total ? Math.round((stats.sent / stats.total) * 100) : 100;
    const phoneUsers = (users.users || []).filter((u) => u.phone).slice(0, 100);
    const logTotal = Number(logs.total) || 0;
    const logShown = (logs.logs || []).length;

    root.innerHTML = `
      <div class="v3-sms-body dash-enter" data-v3-sms="page">
        <div class="v3-sms-toolbar">
          <div class="v3-sms-toolbar-copy">
            <strong>SMS ობსერვატორია</strong>
            <span>ბალანსი · გაგზავნა · ჟურნალი · მიმღები სავალდებულოა</span>
          </div>
          <div class="v3-sms-toolbar-actions">
            ${helpBtn('sms.page')}
            <button type="button" class="btn ghost compact" id="sms-refresh">${ico('refresh')} განახლება</button>
          </div>
        </div>

        <div class="v3-sms-kpis" role="group" aria-label="SMS მდგომარეობა">
          ${kpiCell('wallet', 'ბალანსი', esc(balLabel), 'OTP და ადმინისტრაციული გაგზავნა', balTone)}
          ${kpiCell('activity', '24სთ', fmt(stats.last24h), 'ბოლო 24 საათი', 'soft')}
          ${kpiCell('check', 'წარმატება', `${successRate}%`, `${fmt(stats.sent)} / ${fmt(stats.total)}`, successRate >= 95 ? 'ok' : successRate < 80 ? 'warn' : '')}
          ${kpiCell('file', 'სულ ჩანაწერი', fmt(stats.total), `${fmt(stats.admin)} ადმინი`)}
          ${kpiCell('shield', 'OTP', fmt(stats.otp), 'ავტორიზაცია', 'soft')}
          ${kpiCell('alert', 'შეცდომა', fmt(stats.failed), 'ვერ გაიგზავნა', stats.failed ? 'warn' : 'ok')}
        </div>

        <div class="v3-sms-split">
          <section class="v3-sms-panel" data-v3-sms="send">
            <div class="v3-sms-head">
              <div class="v3-sms-head-copy">
                <div class="v3-title-row"><h3>ახალი SMS</h3>${helpBtn('sms.send')}</div>
                <p class="muted">ნომერი ან მომხმარებელი · მაქს. 1000 სიმბოლო</p>
              </div>
            </div>
            <form id="sms-send-form" class="v3-sms-form" novalidate>
              <label class="v3-sms-field">
                <span>მიმღები (9955XXXXXXXX)</span>
                <input id="sms-destination" type="text" inputmode="tel" placeholder="995577123456" autocomplete="tel" />
              </label>
              <label class="v3-sms-field">
                <span>ან მომხმარებელი</span>
                <select id="sms-user-id">
                  <option value="">— ხელით ნომერი —</option>
                  ${phoneUsers
                    .map(
                      (u) =>
                        `<option value="${esc(u.id)}" data-phone="${esc(u.phone)}">${esc(u.fullName)} · ${esc(u.phone)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
              <label class="v3-sms-field">
                <span>ტექსტი (მაქს. 1000)</span>
                <textarea id="sms-content" rows="4" maxlength="1000" placeholder="Medicard: ..."></textarea>
                <small class="v3-sms-count"><span id="sms-char-count">0</span> / 1000</small>
              </label>
              <div class="v3-sms-actions">
                <label class="v3-sms-check">
                  <input id="sms-urgent" type="checkbox" />
                  <span>სასწრაფო · დაბლოკილ ნომრებზეც</span>
                </label>
                <button type="submit" class="btn primary">${ico('send')} გაგზავნა</button>
              </div>
            </form>
          </section>

          <section class="v3-sms-panel" data-v3-sms="logs">
            <div class="v3-sms-head">
              <div class="v3-sms-head-copy">
                <div class="v3-title-row"><h3>გაგზავნილი SMS</h3>${helpBtn('sms.logs')}</div>
                <p class="muted">ჟურნალი · <span id="sms-log-meta">${logTotal ? `${fmt(Math.min(logState.offset + logShown, logTotal))} / ${fmt(logTotal)}` : '0 ჩანაწერი'}</span></p>
              </div>
              <button type="button" class="btn ghost compact" id="sms-reload-logs">${ico('activity')} განახლება</button>
            </div>

            <div class="v3-sms-log-filters">
              <select id="sms-filter-status" aria-label="სტატუსი">
                <option value="ALL"${logState.status === 'ALL' ? ' selected' : ''}>ყველა სტატუსი</option>
                <option value="SENT"${logState.status === 'SENT' ? ' selected' : ''}>გაგზავნილი</option>
                <option value="FAILED"${logState.status === 'FAILED' ? ' selected' : ''}>შეცდომა</option>
                <option value="QUEUED"${logState.status === 'QUEUED' ? ' selected' : ''}>რიგში</option>
              </select>
              <select id="sms-filter-purpose" aria-label="მიზანი">
                <option value="ALL"${logState.purpose === 'ALL' ? ' selected' : ''}>ყველა მიზანი</option>
                <option value="OTP"${logState.purpose === 'OTP' ? ' selected' : ''}>OTP</option>
                <option value="ADMIN"${logState.purpose === 'ADMIN' ? ' selected' : ''}>ადმინი</option>
                <option value="MARKETING"${logState.purpose === 'MARKETING' ? ' selected' : ''}>მარკეტინგი</option>
                <option value="TEST"${logState.purpose === 'TEST' ? ' selected' : ''}>ტესტი</option>
              </select>
              <label class="v3-sms-search">
                <span class="sr-only">ძებნა</span>
                ${ico('search')}
                <input id="sms-filter-q" type="search" placeholder="ნომერი ან ტექსტი…" value="${esc(logState.q)}" autocomplete="off" />
              </label>
            </div>

            <div class="v3-sms-table-wrap">
              <table class="v3-sms-table">
                <thead>
                  <tr>
                    <th>დრო</th>
                    <th>ნომერი</th>
                    <th>ტექსტი</th>
                    <th>მიზანი</th>
                    <th>სტატუსი</th>
                  </tr>
                </thead>
                <tbody id="sms-log-body">${logRowsHtml(logs.logs || [])}</tbody>
              </table>
            </div>

            <div class="v3-sms-pager">
              <button type="button" class="btn ghost compact" id="sms-log-prev" ${logState.offset <= 0 ? 'disabled' : ''}>წინა</button>
              <button type="button" class="btn ghost compact" id="sms-log-next" ${logState.offset + logState.limit >= logTotal ? 'disabled' : ''}>შემდეგი</button>
            </div>
          </section>
        </div>
      </div>
    `;

    $('sms-refresh')?.addEventListener('click', () => void renderSmsV3());
    $('sms-reload-logs')?.addEventListener('click', () => void reloadLogsOnly());

    let qTimer = null;
    $('sms-filter-status')?.addEventListener('change', (e) => {
      logState.status = e.target.value || 'ALL';
      logState.offset = 0;
      void reloadLogsOnly();
    });
    $('sms-filter-purpose')?.addEventListener('change', (e) => {
      logState.purpose = e.target.value || 'ALL';
      logState.offset = 0;
      void reloadLogsOnly();
    });
    $('sms-filter-q')?.addEventListener('input', (e) => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        logState.q = (e.target.value || '').trim();
        logState.offset = 0;
        void reloadLogsOnly();
      }, 280);
    });
    $('sms-log-prev')?.addEventListener('click', () => {
      logState.offset = Math.max(0, logState.offset - logState.limit);
      void reloadLogsOnly();
    });
    $('sms-log-next')?.addEventListener('click', () => {
      logState.offset += logState.limit;
      void reloadLogsOnly();
    });

    bindSendForm(phoneUsers);
  }

  global.renderSms = renderSmsV3;
  // keep helpers available for legacy callers
  if (typeof global.fmtSmsDate !== 'function' && typeof fmtSmsDate === 'function') {
    /* already global from admin.js */
  }
})(window);
