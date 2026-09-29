/**
 * MediCard Admin V4 — #/errors შეცდომები (/api/admin/errors).
 * App crashes / JS errors and server 500s grouped by fingerprint (server/src/lib/errorMonitor.js):
 * period + source segments, totals, a table of groups and a detail dialog with the hourly chart,
 * the scrubbed stack and the latest 50 events.
 */
(function adminV4Errors(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const num = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;

  const PERIODS = [[1, '1 სთ'], [24, '24 სთ'], [168, '7 დღე']];
  const SOURCES = [['all', 'ყველა'], ['app', 'აპი'], ['server', 'სერვერი']];
  const KIND = { crash: 'ავარია', error: 'შეცდომა', unhandled_rejection: 'Promise', render: 'ეკრანის რენდერი' };
  const SOURCE = { app: 'აპი', server: 'სერვერი' };

  let hours = 24;
  let source = 'all';
  let refreshTimer = null;

  if (typeof ICONS === 'object') {
    ICONS.bug = '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M12 20v-9M8 11H4M20 11h-4M8 16H5M19 16h-3M9 6l-2-3M15 6l2-3"/>';
    doc.querySelectorAll('[data-icon="bug"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('bug'));
    });
  }

  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  /** 24-hour Tbilisi time; built by hand because browsers often lack ka-GE locale data. */
  const tbilisiTime = (iso, withDay = true) => {
    if (!iso) return '—';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tbilisi', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric',
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    const time = `${parts.hour}:${parts.minute}`;
    return withDay ? `${parts.day} ${MONTHS[Number(parts.month) - 1]}, ${time}` : time;
  };
  const ago = (iso) => {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 1) return 'ახლახან';
    if (min < 60) return `${min} წთ წინ`;
    if (min < 48 * 60) return `${Math.round(min / 60)} სთ წინ`;
    return `${Math.round(min / 1440)} დღის წინ`;
  };

  function badges(g) {
    const out = [`<span class="s-badge">${esc(SOURCE[g.source] || g.source)}</span>`];
    if (g.kind === 'crash' || g.fatal) out.push(`<span class="s-badge is-bad">${g.kind === 'crash' ? 'ავარია' : 'ფატალური'}</span>`);
    else out.push(`<span class="s-badge is-warn">${esc(KIND[g.kind] || g.kind)}</span>`);
    if (new Date(g.firstSeen).getTime() >= Date.now() - hours * 3600_000) out.push('<span class="s-badge is-info">ახალი</span>');
    return out.join(' ');
  }

  function metric(label, value, small, tone = '') {
    return `<div class="s-metric ${tone}"><span>${esc(label)}</span><strong>${num(value)}</strong><small>${small || ''}</small></div>`;
  }

  function paint(root, d) {
    const groups = d.groups || [];
    const t = d.totals || {};
    root.innerHTML = `<div class="s-stack v3-tab-shell">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="პერიოდი">${PERIODS.map(([h, label]) => `<button type="button" role="tab" aria-selected="${h === hours}" data-hours="${h}">${label}</button>`).join('')}</div>
        <div class="s-segment" role="tablist" aria-label="წყარო">${SOURCES.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === source}" data-source="${k}">${label}</button>`).join('')}</div>
        <span class="s-muted" style="font-size:12px">ახლდება ყოველ წუთს</span>
        <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
      </div>
      ${d.installed === false ? `<div class="s-callout is-warn">${ico('alert')}<p><b>ErrorEvent ცხრილი ჯერ არ არის.</b> შეიქმნება შემდეგი deploy-ისას (npm run db:install → install-errors). ჩაწერა ამის შემდეგ დაიწყება.</p></div>` : ''}
      ${d.recording === false ? `<div class="s-callout">${ico('info')}<p>ამ სერვერზე ჩაწერა გამორთულია (ლოკალური სერვერი ან ERROR_MONITOR=off). ცხრილში ჩანს production-ის ჩანაწერები.</p></div>` : ''}

      <div class="s-metrics">
        ${metric('შემთხვევა', t.events, 'ყველა ჩანაწერი პერიოდში', t.events ? 'is-warn' : '')}
        ${metric('ჯგუფი', t.groups, `ახალი: ${num(t.newGroups)}`)}
        ${metric('ადამიანი', t.users, 'ვისაც შეეხო (ანონიმურად)')}
        ${metric('ავარია / ფატალური', t.fatal, 'აპის ავარია ან სერვერის გაჩერება', t.fatal ? 'is-bad' : '')}
      </div>

      <section class="s-card">
        <header class="s-card-head"><div><h3>შეცდომების ჯგუფები</h3><p>ერთი ჯგუფი = ერთი და იგივე შეცდომა (იგივე ტიპი, ტექსტი და კოდის ადგილი). დააჭირე სტრიქონს დეტალებისთვის.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>შეცდომა</th><th>ტიპი</th><th class="num">რაოდენობა</th><th class="num">ადამიანი</th><th>პლატფორმა / ვერსია</th><th>ბოლოს</th></tr></thead>
          <tbody>${groups.length ? groups.map((g) => `<tr data-fp="${esc(g.fingerprint)}" tabindex="0" style="cursor:pointer">
            <td><b>${esc(g.name)}</b><div class="s-muted" style="font-size:12.5px;overflow-wrap:anywhere">${esc(g.message || '—')}</div>${g.sampleRoute ? `<div class="s-muted" style="font-size:12px"><code>${esc(g.sampleRoute)}</code></div>` : ''}</td>
            <td>${badges(g)}</td>
            <td class="num">${num(g.count)}</td>
            <td class="num">${num(g.users)}</td>
            <td>${esc((g.platforms || []).join(', ') || '—')}${g.versions?.length ? `<div class="s-muted" style="font-size:12px">${g.versions.map((v) => `${esc(v.version)} (${num(v.count)})`).join(' · ')}</div>` : ''}</td>
            <td>${esc(ago(g.lastSeen))}<div class="s-muted" style="font-size:12px">პირველად: ${esc(tbilisiTime(g.firstSeen))}</div></td>
          </tr>`).join('') : `<tr><td colspan="6"><div class="s-empty">${ico('check')}<strong>ამ პერიოდში შეცდომა არ ყოფილა</strong></div></td></tr>`}</tbody>
        </table></div></div>
      </section>
    </div>`;

    root.querySelectorAll('[data-hours]').forEach((btn) => btn.addEventListener('click', () => {
      hours = Number(btn.dataset.hours) || 24;
      void renderErrorsAdmin();
    }));
    root.querySelectorAll('[data-source]').forEach((btn) => btn.addEventListener('click', () => {
      source = btn.dataset.source || 'all';
      void renderErrorsAdmin();
    }));
    root.querySelector('[data-refresh]')?.addEventListener('click', () => void renderErrorsAdmin());
    root.querySelectorAll('tr[data-fp]').forEach((tr) => {
      const group = groups.find((g) => g.fingerprint === tr.dataset.fp);
      const open = () => void openGroup(group);
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  async function openGroup(group) {
    if (!group) return;
    const V = global.AdminV3;
    let d;
    try {
      d = await global.api(`/errors/${encodeURIComponent(group.fingerprint)}?hours=${Math.max(24, hours)}`);
    } catch (err) {
      global.toast?.(err?.message || 'ვერ ჩაიტვირთა', 'bad');
      return;
    }
    const events = d.events || [];
    const stack = events.find((e) => e.stackTop)?.stackTop || group.sampleStack;
    const points = (d.hourly || []).map((h) => ({ day: tbilisiTime(h.hour, (d.hours || 24) > 24), count: h.count }));
    const chart = global.AdminCharts?.line
      ? global.AdminCharts.line([{ label: 'შემთხვევა / სთ', tone: 'bad', points }], { label: 'შემთხვევები საათობრივად', height: 180, empty: 'ამ პერიოდში შემთხვევა არ არის' })
      : '';
    V?.openDialog?.({
      title: `${group.name}: ${group.message || ''}`.slice(0, 140),
      description: `${SOURCE[group.source] || group.source} · ${KIND[group.kind] || group.kind} · ${num(group.count)} შემთხვევა · ${num(group.users)} ადამიანი · პირველად ${tbilisiTime(group.firstSeen)}`,
      wide: true,
      watchDirty: false,
      body: `<div class="s-stack">
        <section class="s-card"><header class="s-card-head"><div><h3>შემთხვევები საათობრივად</h3><p>ბოლო ${esc(d.hours >= 168 ? '7 დღე' : `${d.hours} საათი`)}, თბილისის დროით.</p></div></header><div class="s-card-body">${chart}</div></section>
        <section class="s-card"><header class="s-card-head"><div><h3>სტეკი</h3><p>კოდის ბოლო ${esc(stack ? stack.split('\n').length : 0)} ნაბიჯი — ფუნქცია (ფაილი:ხაზი). სრული მისამართები და პირადი მონაცემები მოშორებულია.</p></div></header>
          <div class="s-card-body">${stack ? `<pre class="s-preview-text">${esc(stack)}</pre>` : '<div class="s-empty">სტეკი არ მოსულა.</div>'}</div></section>
        <section class="s-card"><header class="s-card-head"><div><h3>ბოლო შემთხვევები</h3><p>ბოლო 50 ჩანაწერი. „×N“ — 10 წამში განმეორებული იგივე შეცდომა ერთ ჩანაწერად.</p></div></header>
          <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
            <thead><tr><th>დრო</th><th>მისამართი</th><th>პლატფორმა</th><th>ვერსია</th><th>ადამიანი</th><th class="num">რაოდ.</th></tr></thead>
            <tbody>${events.length ? events.map((e) => `<tr><td>${esc(tbilisiTime(e.createdAt))}</td><td><code>${esc(e.route || '—')}</code></td><td>${esc(e.platform || '—')}</td><td>${esc(e.appVersion || '—')}</td><td>${e.userHash ? `<code>${esc(e.userHash.slice(0, 8))}</code>` : '<span class="s-muted">სტუმარი</span>'}</td><td class="num">×${num(e.count)}</td></tr>`).join('') : '<tr><td colspan="6"><div class="s-empty">ჩანაწერი არ არის.</div></td></tr>'}</tbody>
          </table></div></div></section>
        <p class="s-muted" style="font-size:12px;margin:0">ანაბეჭდი (fingerprint): <code>${esc(group.fingerprint)}</code></p>
      </div>`,
    });
    global.AdminCharts?.hydrate?.();
  }

  async function renderErrorsAdmin({ silent = false } = {}) {
    const root = $('tab-errors');
    if (!root) return;
    if (!silent) root.innerHTML = skel();
    let data;
    try {
      data = await global.api(`/errors?hours=${hours}&source=${source}`);
    } catch (err) {
      if (silent) return;
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = () => renderErrorsAdmin();
      return;
    }
    paint(root, data);
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const panel = $('tab-errors');
      if (panel && !panel.classList.contains('hidden') && doc.visibilityState === 'visible' && !$('v3-dialog')) void renderErrorsAdmin({ silent: true });
    }, 60_000);
  }

  global.renderErrorsAdmin = renderErrorsAdmin;
  global.AdminV4Errors = { renderErrorsAdmin };
})(window);
