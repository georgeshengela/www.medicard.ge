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
  const KIND = { crash: 'ავარია', error: 'შეცდომა', unhandled_rejection: 'დაუმუშავებელი შეცდომა', render: 'ეკრანის შეცდომა' };
  const SOURCE = { app: 'აპი', server: 'სერვერი' };
  const PLATFORM = { ios: 'iOS', android: 'Android', web: 'ვები' };
  const platformLabel = (p) => PLATFORM[p] || p || '—';

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
  /** Tbilisi date parts; built by hand because browsers often lack ka-GE locale data. */
  const tbilisiParts = (iso) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const when = (iso) => {
    if (!iso) return '—';
    if (global.AdminV3?.formatDate) return global.AdminV3.formatDate(iso, 'datetime');
    const p = tbilisiParts(iso);
    return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]}, ${p.hour}:${p.minute}`;
  };
  const ago = (iso) => {
    if (typeof global.fmtRelative === 'function') return global.fmtRelative(iso);
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 1) return 'ახლახან';
    if (min < 60) return `${min} წთ წინ`;
    if (min < 48 * 60) return `${Math.round(min / 60)} სთ წინ`;
    return `${Math.round(min / 1440)} დღის წინ`;
  };

  function badges(g) {
    const out = [`<span class="s-badge is-plain">${esc(SOURCE[g.source] || g.source)}</span>`];
    if (g.kind === 'crash' || g.fatal) out.push(`<span class="s-badge is-bad">${g.kind === 'crash' ? 'ავარია' : 'ფატალური'}</span>`);
    else out.push(`<span class="s-badge is-warn">${esc(KIND[g.kind] || g.kind)}</span>`);
    if (new Date(g.firstSeen).getTime() >= Date.now() - hours * 3600_000) out.push('<span class="s-badge is-info">ახალი</span>');
    return `<span class="p3-badges">${out.join('')}</span>`;
  }

  function metric(label, value, small, tone = '') {
    return `<div class="s-metric ${tone}"><span>${esc(label)}</span><strong>${num(value)}</strong><small>${small || ''}</small></div>`;
  }

  function paint(root, d) {
    const groups = d.groups || [];
    const t = d.totals || {};
    root.innerHTML = `<div class="s-stack v3-tab-shell">
      <div class="s-toolbar">
        <div class="p3-tools">
          <div class="s-segment" role="tablist" aria-label="პერიოდი">${PERIODS.map(([h, label]) => `<button type="button" role="tab" aria-selected="${h === hours}" data-hours="${h}">${label}</button>`).join('')}</div>
          <div class="s-segment" role="tablist" aria-label="წყარო">${SOURCES.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === source}" data-source="${k}">${label}</button>`).join('')}</div>
        </div>
        <div class="p3-tools">
          <span class="p3-meta">ახლდება ყოველ წუთს</span>
          <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
        </div>
      </div>
      ${d.installed === false ? `<div class="s-callout is-warn">${ico('alert')}<p><b>შეცდომების ცხრილი ჯერ არ არის.</b> ის შეიქმნება სერვერის შემდეგი განახლებისას — ჩაწერა ამის შემდეგ დაიწყება.</p></div>` : ''}
      ${d.recording === false ? `<div class="s-callout">${ico('info')}<p>ეს სერვერი ახალ შეცდომებს არ იწერს (ლოკალური სერვერი ან ჩაწერა გამორთულია). ცხრილში ჩანს მთავარი სერვერის ჩანაწერები.</p></div>` : ''}

      <div class="s-metrics">
        ${metric('შემთხვევა', t.events, 'ყველა ჩანაწერი პერიოდში')}
        ${metric('ჯგუფი', t.groups, `ახალი: ${num(t.newGroups)}`)}
        ${metric('ადამიანი', t.users, 'ვისაც შეეხო (ანონიმურად)')}
        ${metric('ავარია / ფატალური', t.fatal, 'აპის ავარია ან სერვერის გაჩერება', t.fatal ? 'is-bad' : '')}
      </div>

      <section class="s-card">
        <header class="s-card-head"><div><h3>შეცდომების ჯგუფები</h3><p>ერთი ჯგუფი = ერთი და იგივე შეცდომა (ტიპი, ტექსტი და კოდის ადგილი). დააჭირე სტრიქონს დეტალებისთვის.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
          <thead><tr><th>შეცდომა</th><th>ტიპი</th><th class="num">რაოდენობა</th><th class="num">ადამიანი</th><th>პლატფორმა / ვერსია</th><th>ბოლოს</th></tr></thead>
          <tbody>${groups.length ? groups.map((g) => `<tr class="is-click" data-fp="${esc(g.fingerprint)}" tabindex="0">
            <td class="p3-err-cell"><b>${esc(g.name)}</b><span class="p3-sub">${esc(g.message || '—')}</span>${g.sampleRoute ? `<span class="p3-sub"><code>${esc(g.sampleRoute)}</code></span>` : ''}</td>
            <td>${badges(g)}</td>
            <td class="num">${num(g.count)}</td>
            <td class="num">${num(g.users)}</td>
            <td>${esc((g.platforms || []).map(platformLabel).join(', ') || '—')}${g.versions?.length ? `<span class="p3-sub">${g.versions.map((v) => `<span class="p3-nowrap">${esc(v.version)} (${num(v.count)})</span>`).join(' · ')}</span>` : ''}</td>
            <td class="p3-nowrap">${esc(ago(g.lastSeen))}<span class="p3-sub">პირველად: ${esc(when(g.firstSeen))}</span></td>
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

  /**
   * Counts per bucket → columns. A day of hourly columns gets "14:00" labels; over 7 days the 168 hourly
   * buckets are summed per Tbilisi day, because hour labels with dates do not fit under ~3px columns.
   */
  function hourlyChart(d) {
    const rows = d.hourly || [];
    const long = (d.hours || 24) > 24;
    let points;
    if (long) {
      const byDay = new Map();
      rows.forEach((h) => {
        const p = tbilisiParts(h.hour);
        const key = `${p.year}-${p.month}-${p.day}`;
        byDay.set(key, (byDay.get(key) || 0) + (Number(h.count) || 0));
      });
      points = [...byDay].map(([day, count]) => ({ day, count }));
    } else {
      points = rows.map((h) => {
        const p = tbilisiParts(h.hour);
        return { day: `${p.hour}:00`, count: h.count };
      });
    }
    const chart = global.AdminCharts?.bars
      ? global.AdminCharts.bars(points, { label: long ? 'შემთხვევა დღეში' : 'შემთხვევა საათში', height: 180, tone: 'bad', empty: 'ამ პერიოდში შემთხვევა არ არის' })
      : '';
    return { long, chart };
  }

  async function openGroup(group) {
    if (!group) return;
    const V = global.AdminV3;
    let d;
    try {
      d = await global.api(`/errors/${encodeURIComponent(group.fingerprint)}?hours=${Math.max(24, hours)}`);
    } catch (err) {
      global.toast?.(`შეცდომის დეტალები ვერ ჩაიტვირთა.${err?.message ? ` (${err.message})` : ''}`, 'bad');
      return;
    }
    const events = d.events || [];
    const stack = events.find((e) => e.stackTop)?.stackTop || group.sampleStack;
    const { long, chart } = hourlyChart(d);
    const kind = group.kind === 'crash' ? 'ავარია' : group.fatal ? `${KIND[group.kind] || group.kind} · ფატალური` : (KIND[group.kind] || group.kind);
    V?.openDialog?.({
      title: group.name || 'შეცდომა',
      description: group.message || '',
      wide: true,
      watchDirty: false,
      body: `<div class="s-stack p3-err-detail">
        <dl class="p3-facts">
          <div><dt>წყარო</dt><dd>${esc(SOURCE[group.source] || group.source)}</dd></div>
          <div><dt>ტიპი</dt><dd>${esc(kind)}</dd></div>
          <div><dt>შემთხვევა</dt><dd>${num(group.count)}</dd></div>
          <div><dt>ადამიანი</dt><dd>${num(group.users)}</dd></div>
          <div><dt>პირველად</dt><dd>${esc(when(group.firstSeen))}</dd></div>
          <div><dt>ბოლოს</dt><dd>${esc(when(group.lastSeen))}</dd></div>
        </dl>
        <section class="s-card"><header class="s-card-head"><div><h3>${long ? 'შემთხვევები დღეების მიხედვით' : 'შემთხვევები საათობრივად'}</h3><p>ბოლო ${esc(d.hours >= 168 ? '7 დღე' : `${d.hours} საათი`)}, თბილისის დროით.</p></div></header><div class="s-card-body">${chart}</div></section>
        <section class="s-card"><header class="s-card-head"><div><h3>სტეკი</h3><p>კოდის ბოლო ${esc(stack ? stack.split('\n').length : 0)} ნაბიჯი — ფუნქცია (ფაილი:ხაზი). მისამართები და პირადი მონაცემები მოშორებულია.</p></div></header>
          <div class="s-card-body">${stack ? `<pre class="s-preview-text">${esc(stack)}</pre>` : '<div class="s-empty">სტეკი არ მოსულა.</div>'}</div></section>
        <section class="s-card"><header class="s-card-head"><div><h3>ბოლო შემთხვევები</h3><p>ბოლო 50 ჩანაწერი. „×N“ — 10 წამში განმეორებული იგივე შეცდომა ერთ ჩანაწერად.</p></div></header>
          <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
            <thead><tr><th>დრო</th><th>მისამართი</th><th>პლატფორმა</th><th>ვერსია</th><th>ადამიანი</th><th class="num">რაოდ.</th></tr></thead>
            <tbody>${events.length ? events.map((e) => `<tr><td class="p3-nowrap">${esc(when(e.createdAt))}</td><td><code>${esc(e.route || '—')}</code></td><td>${esc(platformLabel(e.platform))}</td><td>${esc(e.appVersion || '—')}</td><td>${e.userHash ? `<code>${esc(e.userHash.slice(0, 8))}</code>` : '<span class="s-muted">სტუმარი</span>'}</td><td class="num">×${num(e.count)}</td></tr>`).join('') : '<tr><td colspan="6"><div class="s-empty">ჩანაწერი არ არის.</div></td></tr>'}</tbody>
          </table></div></div></section>
        <p class="p3-foot">ჯგუფის ანაბეჭდი: ${V?.copyIdButton ? V.copyIdButton(group.fingerprint, 'ანაბეჭდი') : `<code>${esc(group.fingerprint)}</code>`}</p>
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
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>შეცდომების სია ვერ ჩაიტვირთა</strong><span>შეამოწმე კავშირი და სცადე ხელახლა.</span>${err?.message ? `<small class="p3-raw">${esc(err.message)}</small>` : ''}<button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
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
