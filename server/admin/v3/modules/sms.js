/**
 * MediCard Admin V3 — SMS (full override of renderSms).
 * Balance, manual send and the journal. URL range/grain are unused by SMS APIs.
 */
(function adminV3Sms(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const PURPOSE_KA = {
    OTP: 'კოდი (OTP)',
    ADMIN: 'ადმინი',
    MARKETING: 'მარკეტინგი',
    TEST: 'ტესტი',
  };
  const STATUS = {
    SENT: ['გაიგზავნა', 'ok'],
    FAILED: ['ვერ გაიგზავნა', 'bad'],
    QUEUED: ['რიგში', 'warn'],
  };
  /** SMSOffice and transport failures (SmsLog.providerMsg) → what happened, in Georgian. */
  const REASON_KA = [
    [/not configured/i, 'SMS გასაღები არ არის დაყენებული'],
    [/timeout|timed out|aborted/i, 'პროვაიდერმა დროულად არ უპასუხა'],
    [/not a valid mobile number|invalid (mobile )?number|invalid destination/i, 'ნომერი არასწორია'],
    [/not delivered/i, 'ოპერატორმა ვერ მიაწოდა'],
    [/balance|insufficient|credit/i, 'SMS ბალანსი არ კმარა'],
    [/fetch failed|network|ECONN|ENOTFOUND|socket/i, 'პროვაიდერთან კავშირი ვერ დამყარდა'],
  ];

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
  function when(iso) {
    if (!iso) return '—';
    return V().formatDate ? V().formatDate(iso, 'datetime') : String(iso);
  }
  function fmtPhone(raw) {
    const d = String(raw || '').replace(/\D/g, '');
    if (/^9955\d{8}$/.test(d)) return `+995 ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
    return raw ? String(raw) : '—';
  }
  function reasonKa(msg) {
    const raw = String(msg || '').trim();
    if (!raw) return '';
    if (/\p{Script=Georgian}/u.test(raw)) return raw;
    return REASON_KA.find(([re]) => re.test(raw))?.[1] || '';
  }
  /** OTP codes never reach the journal (the server stores and returns them masked); mask again here as a safety net. */
  function maskCodes(text) {
    return String(text || '').replace(/\d{4,8}/g, (m) => '•'.repeat(m.length));
  }
  function statusBadge(status) {
    const [label, tone] = STATUS[status] || [status || '—', ''];
    return `<span class="s-badge${tone ? ` is-${tone}` : ''}">${esc(label)}</span>`;
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
      return `<tr><td colspan="5"><div class="s-empty p2-empty-sm">${ico('message')}<span>ამ ფილტრით SMS არ მოიძებნა</span></div></td></tr>`;
    }
    return logs
      .map((row, i) => {
        const text = row.purpose === 'OTP' ? maskCodes(row.content) : String(row.content || '');
        const failed = row.status === 'FAILED';
        const ka = failed ? reasonKa(row.providerMsg) : '';
        const raw = failed && row.providerMsg && ka !== row.providerMsg
          ? `${row.providerMsg}${row.providerCode != null ? ` (${row.providerCode})` : ''}`
          : '';
        return `<tr>
        <td class="s-muted p2-nowrap">${esc(when(row.createdAt))}</td>
        <td class="mono p2-nowrap">${esc(fmtPhone(row.destination))}</td>
        <td class="p2-sms-cell">
          <div class="p2-sms-line">
            <div class="p2-sms-text" data-sms-text="${i}" title="${esc(text)}">${esc(text)}</div>
          </div>
        </td>
        <td><span class="s-badge is-plain">${esc(PURPOSE_KA[row.purpose] || row.purpose || '—')}</span></td>
        <td>${statusBadge(row.status)}${failed ? `<small class="p2-sub">${esc(ka || 'პროვაიდერმა უარი თქვა')}</small>${raw ? `<small class="p2-raw">${esc(raw)}</small>` : ''}` : ''}</td>
      </tr>`;
      })
      .join('');
  }

  function metaText(total, shown) {
    if (!total) return '0 ჩანაწერი';
    const from = logState.offset + 1;
    const to = Math.min(logState.offset + shown, total);
    return `${fmt(from)}–${fmt(to)} / ${fmt(total)}`;
  }

  function bindLogRows() {
    const body = $('sms-log-body');
    if (!body) return;
    body.querySelectorAll('[data-sms-text]').forEach((cell) => {
      cell.addEventListener('click', () => cell.classList.toggle('is-open'));
    });
  }

  function bindSendForm(users) {
    const contentEl = $('sms-content');
    const countEl = $('sms-char-count');
    contentEl?.addEventListener('input', () => {
      if (countEl) countEl.textContent = String(contentEl.value.length);
    });

    const userSel = $('sms-user-id');
    const destEl = $('sms-destination');
    const userQ = $('sms-user-q');
    const hint = $('sms-user-hint');
    const optionsFor = (list) => `<option value="">— ხელით ჩაწერილი ნომერი —</option>${list
      .map((u) => `<option value="${esc(u.id)}" data-phone="${esc(u.phone)}">${esc(u.fullName || 'სახელი არ აქვს')} · ${esc(fmtPhone(u.phone))}</option>`)
      .join('')}`;
    userQ?.addEventListener('input', () => {
      const q = userQ.value.trim().toLowerCase();
      const digits = q.replace(/\D/g, '');
      const keep = userSel?.value || '';
      const list = (users || []).filter((u) => !q
        || String(u.fullName || '').toLowerCase().includes(q)
        || (digits && String(u.phone || '').replace(/\D/g, '').includes(digits)));
      if (userSel) {
        userSel.innerHTML = optionsFor(list);
        if (keep && list.some((u) => u.id === keep)) userSel.value = keep;
      }
      if (hint) hint.textContent = q ? `${fmt(list.length)} შედეგი` : `${fmt((users || []).length)} მომხმარებელი ტელეფონით`;
    });
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
      const msgEl = $('sms-send-msg');
      const fail = (msg, el) => {
        if (msgEl) msgEl.textContent = msg;
        el?.focus();
        toastMsg(msg, 'bad');
      };
      if (msgEl) msgEl.textContent = '';
      if (!content) return fail('ჩაწერე SMS-ის ტექსტი.', $('sms-content'));
      if (!userId && !destination) return fail('მიუთითე ნომერი ან აირჩიე მომხმარებელი.', $('sms-destination'));

      let dest = destination;
      if (!dest && userId) {
        const u = (users || []).find((x) => x.id === userId);
        dest = u?.phone || '';
      }
      if (!dest) return fail('მიუთითე ნომერი ან აირჩიე მომხმარებელი.', $('sms-destination'));

      const btn = $('sms-send-btn');
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }
      try {
        await api('/sms/send', {
          method: 'POST',
          body: { destination: dest, content, userId, urgent },
        });
        toastMsg('SMS გაიგზავნა', 'ok');
        if ($('sms-content')) $('sms-content').value = '';
        if (countEl) countEl.textContent = '0';
        logState.offset = 0;
        await renderSmsV3();
      } catch (err) {
        const raw = String(err?.message || '');
        const ka = reasonKa(raw);
        fail(ka && ka !== raw ? `SMS ვერ გაიგზავნა: ${ka} (${raw})` : raw || 'SMS ვერ გაიგზავნა — სცადე თავიდან.');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('is-loading');
        }
      }
    });
  }

  async function reloadLogsOnly() {
    const tbody = document.querySelector('#sms-log-body');
    const meta = document.querySelector('#sms-log-meta');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5"><div class="s-empty p2-empty-sm"><span>იტვირთება…</span></div></td></tr>`;
    try {
      const logs = await api(`/sms/logs?${logsQuery()}`);
      tbody.innerHTML = logRowsHtml(logs.logs || []);
      bindLogRows();
      const total = Number(logs.total) || 0;
      const shown = (logs.logs || []).length;
      if (meta) meta.textContent = metaText(total, shown);
      const prev = $('sms-log-prev');
      const next = $('sms-log-next');
      if (prev) prev.disabled = logState.offset <= 0;
      if (next) next.disabled = logState.offset + logState.limit >= total;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="s-callout is-bad">${ico('alert')}<p>ჟურნალი ვერ ჩაიტვირთა: ${esc(e.message || 'შეცდომა')}</p></div></td></tr>`;
    }
  }

  async function renderSmsV3() {
    Shell().mountHeader?.({
      tab: 'sms',
      kicker: 'Operations',
      title: 'SMS',
      purpose: 'ბალანსი, ხელით გაგზავნა და ყველა SMS-ის ჟურნალი.',
      helpKey: 'sms.page',
      actionsHtml: `<button type="button" class="btn ghost compact" id="sms-refresh">${ico('refresh')} განახლება</button>`,
    });
    $('sms-refresh')?.addEventListener('click', () => void renderSmsV3());

    const root = $('tab-sms');
    if (!root) return;

    root.classList.add('v3-workspace-wide', 'v3-sms');
    root.innerHTML = `<div class="s-stack v3-tab-shell p2-ops" data-v3-sms="loading">${V().skeleton ? V().skeleton(6) : ''}</div>`;

    let balance;
    let stats;
    let logs;
    let users = { users: [] };
    try {
      [balance, stats, logs, users] = await Promise.all([
        api('/sms/balance'),
        api('/sms/stats'),
        api(`/sms/logs?${logsQuery()}`),
        api('/users?limit=200&offset=0').catch(() => ({ users: [], failed: true })),
      ]);
    } catch (e) {
      root.innerHTML = `<div class="s-stack v3-tab-shell p2-ops" data-v3-sms="error">
        <div class="s-card"><div class="s-empty">${ico('alert')}<strong>SMS-ის მონაცემები ვერ ჩაიტვირთა</strong><span>${esc(e.message || 'უცნობი შეცდომა')}</span>
          <button type="button" class="btn compact" id="sms-retry">${ico('refresh')} ხელახლა ცდა</button></div></div>
      </div>`;
      $('sms-retry')?.addEventListener('click', () => void renderSmsV3());
      return;
    }

    const balNum = balance.balance;
    const balLabel = !balance.configured
      ? '—'
      : balNum != null
        ? `${fmt(balNum)} SMS`
        : esc(balance.raw || '—');
    const lowBalance = balance.configured && balNum != null && balNum < 50;
    const successRate = stats.total ? Math.round((stats.sent / stats.total) * 100) : 100;
    const phoneUsers = (users.users || []).filter((u) => u.phone);
    const logTotal = Number(logs.total) || 0;
    const logShown = (logs.logs || []).length;
    const alert = !balance.configured
      ? `<div class="s-callout is-bad">${ico('alert')}<p><b>SMS გასაღები არ არის დაყენებული.</b> SMS არ იგზავნება — შესვლის კოდებიც. დაამატე SMS_OFFICE_API_KEY Render-ში.</p></div>`
      : lowBalance
        ? `<div class="s-callout is-warn">${ico('alert')}<p><b>SMS ბალანსი თითქმის ამოიწურა — დარჩა ${fmt(balNum)}.</b> შეავსე SMSOffice-ში, თორემ შესვლის კოდები აღარ გაიგზავნება.</p></div>`
        : '';
    const usersHint = users.failed
      ? '<small class="p2-err">მომხმარებლების სია ვერ ჩაიტვირთა — ჩაწერე ნომერი ხელით.</small>'
      : `<small id="sms-user-hint">${fmt(phoneUsers.length)} მომხმარებელი ტელეფონით</small>`;

    root.innerHTML = `
      <div class="s-stack v3-tab-shell p2-ops" data-v3-sms="page">
        ${alert}
        <div class="s-metrics" role="group" aria-label="SMS მდგომარეობა">
          <div class="s-metric${!balance.configured ? ' is-bad' : lowBalance ? ' is-warn' : ''}"><span>ბალანსი</span><strong>${balLabel}</strong><small>${!balance.configured ? 'API გასაღები არ არის' : 'დარჩენილი SMS'}</small></div>
          <div class="s-metric"><span>ბოლო 24 საათი</span><strong>${fmt(stats.last24h)}</strong><small>გაგზავნის მცდელობა</small></div>
          <div class="s-metric${successRate < 80 ? ' is-warn' : ''}"><span>მიწოდება</span><strong>${successRate}%</strong><small>${fmt(stats.sent)} / ${fmt(stats.total)} · ყველა დრო</small></div>
          <div class="s-metric"><span>ვერ გაიგზავნა</span><strong>${fmt(stats.failed)}</strong><small>ყველა დრო</small></div>
          <div class="s-metric"><span>შესვლის კოდები (OTP)</span><strong>${fmt(stats.otp)}</strong><small>ადმინის SMS: ${fmt(stats.admin)}</small></div>
        </div>

        <section class="s-card" data-v3-sms="send">
          <header class="s-card-head">
            <div><h3>ახალი SMS</h3><p>ჩაწერე ნომერი ან აირჩიე მომხმარებელი, შემდეგ ტექსტი.</p></div>
            ${helpBtn('sms.send')}
          </header>
          <div class="s-card-body">
            <form id="sms-send-form" class="s-stack p2-form p2-sms-form" novalidate>
              <div class="s-form-grid">
                <label class="s-field" for="sms-destination">
                  <span>ნომერი</span>
                  <input id="sms-destination" type="text" inputmode="tel" placeholder="995 5XX XX XX XX" autocomplete="tel" />
                  <small>ფორმატი: 9955XXXXXXXX</small>
                </label>
                <div class="s-field">
                  <span>ან მომხმარებელი</span>
                  <div class="p2-user-pick">
                    <label class="p2-search">
                      <span class="sr-only">მომხმარებლის ძებნა</span>
                      ${ico('search')}
                      <input id="sms-user-q" type="search" placeholder="სახელი ან ნომერი…" autocomplete="off"${users.failed ? ' disabled' : ''} />
                    </label>
                    <select id="sms-user-id" aria-label="მომხმარებელი"${users.failed ? ' disabled' : ''}>
                      <option value="">— ხელით ჩაწერილი ნომერი —</option>
                      ${phoneUsers
                        .map((u) => `<option value="${esc(u.id)}" data-phone="${esc(u.phone)}">${esc(u.fullName || 'სახელი არ აქვს')} · ${esc(fmtPhone(u.phone))}</option>`)
                        .join('')}
                    </select>
                  </div>
                  ${usersHint}
                </div>
              </div>
              <label class="s-field" for="sms-content">
                <span>ტექსტი</span>
                <textarea id="sms-content" rows="3" maxlength="1000" placeholder="Medicard: …"></textarea>
                <small><span id="sms-char-count">0</span> / 1000 სიმბოლო</small>
              </label>
              <p id="sms-send-msg" class="s-form-msg" role="alert"></p>
              <div class="p2-form-foot">
                <label class="s-check p2-check">
                  <input id="sms-urgent" type="checkbox" />
                  <span>სასწრაფო — დაბლოკილ ნომრებზეც გაიგზავნოს</span>
                </label>
                <button type="submit" class="btn primary" id="sms-send-btn">${ico('send')} გაგზავნა</button>
              </div>
            </form>
          </div>
        </section>

        <section class="s-card" data-v3-sms="logs">
          <header class="s-card-head">
            <div><h3>გაგზავნილი SMS</h3><p>ყველა SMS, შესვლის კოდების ჩათვლით. კოდი დაფარულია — თვალის ხატულა აჩენს.</p></div>
            <div class="p2-row-end">
              ${helpBtn('sms.logs')}
              <button type="button" class="btn ghost compact icon-only" id="sms-reload-logs" title="ჟურნალის განახლება" aria-label="ჟურნალის განახლება">${ico('refresh')}</button>
            </div>
          </header>
          <div class="p2-card-tools">
            <select id="sms-filter-status" aria-label="სტატუსი">
              <option value="ALL"${logState.status === 'ALL' ? ' selected' : ''}>ყველა სტატუსი</option>
              <option value="SENT"${logState.status === 'SENT' ? ' selected' : ''}>გაიგზავნა</option>
              <option value="FAILED"${logState.status === 'FAILED' ? ' selected' : ''}>ვერ გაიგზავნა</option>
              <option value="QUEUED"${logState.status === 'QUEUED' ? ' selected' : ''}>რიგში</option>
            </select>
            <select id="sms-filter-purpose" aria-label="მიზანი">
              <option value="ALL"${logState.purpose === 'ALL' ? ' selected' : ''}>ყველა ტიპი</option>
              <option value="OTP"${logState.purpose === 'OTP' ? ' selected' : ''}>კოდი (OTP)</option>
              <option value="ADMIN"${logState.purpose === 'ADMIN' ? ' selected' : ''}>ადმინი</option>
              <option value="MARKETING"${logState.purpose === 'MARKETING' ? ' selected' : ''}>მარკეტინგი</option>
              <option value="TEST"${logState.purpose === 'TEST' ? ' selected' : ''}>ტესტი</option>
            </select>
            <label class="p2-search">
              <span class="sr-only">ძებნა</span>
              ${ico('search')}
              <input id="sms-filter-q" type="search" placeholder="ნომერი ან ტექსტი…" value="${esc(logState.q)}" autocomplete="off" />
            </label>
          </div>
          <div class="s-table-wrap">
            <table class="s-table p2-sms-table">
              <thead>
                <tr>
                  <th>დრო</th>
                  <th>ნომერი</th>
                  <th>ტექსტი</th>
                  <th>ტიპი</th>
                  <th>სტატუსი</th>
                </tr>
              </thead>
              <tbody id="sms-log-body">${logRowsHtml(logs.logs || [])}</tbody>
            </table>
          </div>
          <div class="s-pager">
            <span id="sms-log-meta">${metaText(logTotal, logShown)}</span>
            <div>
              <button type="button" class="btn ghost compact" id="sms-log-prev" ${logState.offset <= 0 ? 'disabled' : ''}>წინა</button>
              <button type="button" class="btn ghost compact" id="sms-log-next" ${logState.offset + logState.limit >= logTotal ? 'disabled' : ''}>შემდეგი</button>
            </div>
          </div>
        </section>
      </div>
    `;

    bindLogRows();
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
})(window);
