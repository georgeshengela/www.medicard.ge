(function (global) {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (name) => (typeof icon === 'function' ? icon(name) : '');
  const V = () => global.AdminV3 || {};
  const request = (p, o) => api('/community' + p, o);
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  let section = 'PUBLISHED';
  let offset = 0;
  let generation = 0;
  let urls = [];
  // Posts publish directly, so the review queue (PENDING) only holds older rows: it goes last.
  const labels = {
    PUBLISHED: 'გამოქვეყნებული',
    reports: 'საჩივრები',
    HIDDEN: 'დამალული',
    members: 'წევრები',
    audit: 'ქმედებების ისტორია',
    PENDING: 'შესამოწმებელი',
  };
  const SECTION_NOTE = {
    PUBLISHED: 'აპში ხილული პოსტები და კომენტარები, უახლესი ზემოთ. დარღვევა დამალე ან წაშალე.',
    reports: 'წევრების საჩივრები. წაიკითხე ჩანაწერი, საჭიროებისას დამალე და მონიშნე განხილულად.',
    HIDDEN: 'დამალული ჩანაწერები აპში აღარ ჩანს. შეგიძლია ხელახლა გამოაქვეყნო ან სამუდამოდ წაშალო.',
    members: 'სივრცის წევრები, უახლესი ზემოთ. შეჩერებული წევრი ვეღარ წერს და ვერ აფასებს.',
    audit: 'მოდერაციის ყოველი გადაწყვეტილება და მისი მიზეზი, უახლესი ზემოთ.',
    PENDING: 'პოსტები პირდაპირ ქვეყნდება, ამიტომ ეს რიგი ჩვეულებრივ ცარიელია — აქ რჩება მხოლოდ ძველი, შეუმოწმებელი ჩანაწერი.',
  };
  const ACTIONS = {
    approve: { label: 'გამოქვეყნება', verb: 'გამოქვეყნდეს', tone: '' },
    hide: { label: 'დამალვა', verb: 'დაიმალოს', tone: '' },
    delete: { label: 'სამუდამოდ წაშლა', verb: 'სამუდამოდ წაიშალოს', tone: 'danger' },
    ban: { label: 'წევრის შეჩერება', verb: 'შეჩერდეს წევრის წვდომა', tone: 'danger' },
    unban: { label: 'წვდომის აღდგენა', verb: 'აღდგეს წევრის წვდომა', tone: '' },
  };
  // Which moderation actions make sense for a post or comment in each list.
  const STATUS_ACTIONS = { PENDING: ['approve', 'hide', 'delete'], PUBLISHED: ['hide', 'delete'], HIDDEN: ['approve', 'delete'] };
  const REPORT_REASONS = {
    harassment: 'შეურაცხყოფა',
    privacy: 'სხვისი პირადი ინფორმაცია',
    misinformation: 'მცდარი ინფორმაცია',
    spam: 'სპამი ან რეკლამა',
    other: 'სხვა მიზეზი',
  };
  const AUDIT_ACTIONS = {
    approve: 'ჩანაწერი გამოქვეყნდა',
    hide: 'ჩანაწერი დაიმალა',
    delete: 'ჩანაწერი სამუდამოდ წაიშალა',
    ban: 'წევრს წვდომა შეუჩერდა',
    unban: 'წევრს წვდომა აღუდგა',
    resolve: 'საჩივარი განხილულია',
    launch_open: 'სივრცე გაიხსნა',
    launch_close: 'სივრცე დაიხურა',
  };
  const when = (iso) => (V().formatDate ? V().formatDate(iso, 'datetime') : typeof fmtDate === 'function' ? fmtDate(iso) : String(iso || ''));
  const initials = (name) => String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const newestFirst = (rows) => [...rows].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

  /** The audit keeps admin ids only: name the signed-in admin, show other ids as a copyable detail. */
  function adminName(id) {
    const me = typeof state !== 'undefined' ? state.admin : null;
    if (me && id && id === me.id) return esc(me.fullName || me.email || 'შენ');
    return `სხვა ადმინი ${V().copyIdButton ? V().copyIdButton(id, 'ადმინის ID') : ''}`;
  }

  function feedback(error) {
    toast(error.message || 'მოქმედება ვერ შესრულდა.', 'bad');
  }

  /** Reason-required decision dialog shared by moderation and launch changes. */
  function reasonDialog({ title, description, confirmLabel, danger, minRows = 4, onSubmit }) {
    const dialog = V().openDialog?.({
      title,
      description,
      body: `<form id="community-reason-form" class="s-stack s-comm-form" novalidate>
        <label class="s-field"><span>მიზეზი</span>
          <textarea name="reason" required minlength="3" maxlength="500" rows="${minRows}" placeholder="მოკლედ აღწერე გადაწყვეტილება — ჩაიწერება ისტორიაში"></textarea>
          <small data-count>0 / 500</small></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert"></p>
        <button type="button" class="btn" data-cancel>გაუქმება</button>
        <button type="submit" class="btn ${danger ? 'danger' : 'primary'}" form="community-reason-form">${esc(confirmLabel || 'დადასტურება')}</button>`,
    });
    const form = document.getElementById('community-reason-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    panel.classList.add('s-comm-dialog');
    if (danger) panel.classList.add('is-danger');
    const area = form.querySelector('textarea');
    const count = form.querySelector('[data-count]');
    area.addEventListener('input', () => { count.textContent = `${area.value.length} / 500`; });
    area.focus();
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const alertEl = panel.querySelector('[role=alert]');
      if (area.value.trim().length < 3) { alertEl.textContent = 'მიზეზი მინიმუმ 3 სიმბოლო უნდა იყოს.'; area.focus(); return; }
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        await onSubmit(area.value.trim());
        V().setDirty?.(false);
        await dialog.close();
        await render();
      } catch (err) {
        alertEl.textContent = err.message || 'ვერ შესრულდა';
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  function moderate(kind, id, action, revision) {
    if (['approve', 'hide', 'delete'].includes(action) && revision === undefined) {
      feedback(new Error('გახსენით შესაბამისი ჩანაწერი გამოქვეყნებულ ან შესამოწმებელ სიაში და იქ მიიღეთ გადაწყვეტილება.'));
      return;
    }
    const meta = ACTIONS[action] || { label: action, verb: action };
    reasonDialog({
      title: `${meta.label}?`,
      description: `ჩანაწერი ${meta.verb}. გადაწყვეტილება ჩაიწერება მოდერაციის ისტორიაში.`,
      confirmLabel: meta.label,
      danger: meta.tone === 'danger',
      onSubmit: async (reason) => {
        await request(`/${kind}/${id}/moderate`, { method: 'POST', body: { action, revision, reason } });
        toast('გადაწყვეტილება შესრულდა', 'ok');
      },
    });
  }

  function toggleLaunch(open, ready) {
    reasonDialog({
      title: open ? 'სივრცის გახსნა' : 'სივრცის დახურვა',
      description: open
        ? `${ready ? '' : 'ყურადღება: გახსნის პირობა ჯერ არ შესრულებულა. '}ყველა აქტიური ქალი შეძლებს გაწევრიანებას.`
        : 'არსებული წევრები დარჩებიან. ახალი გაწევრიანება შეჩერდება და აპში შესასვლელი დაიმალება.',
      confirmLabel: open ? 'გახსნა' : 'დახურვა',
      danger: open && !ready,
      minRows: 3,
      onSubmit: async (reason) => {
        await request('/launch', { method: 'POST', body: { open, reason } });
        toast(open ? 'სივრცე გაიხსნა' : 'სივრცე დაიხურა', 'ok');
      },
    });
  }

  function launchCard(l, can) {
    const r = l.readiness || {};
    const pct = Math.max(0, Math.min(100, Math.round((r.progress || 0) * 100)));
    return `<section class="s-card s-launch${l.open ? ' is-open' : ''}" data-launch>
      <header class="s-card-head">
        <div>
          <h3 class="s-comm-launch-title">${l.open ? 'სივრცე ღიაა ყველა ქალისთვის' : 'დახურული რეჟიმი'}
            <span class="s-badge ${l.open ? 'is-ok' : 'is-warn'}">${l.open ? 'ღია' : 'დახურული'}</span></h3>
          <p>${l.open ? 'ნებისმიერ აქტიურ ქალს შეუძლია გაწევრიანება.' : 'შედიან მხოლოდ არსებული წევრები. ახალი გაწევრიანება შეჩერებულია, აპში შესასვლელიც დამალულია.'}${l.updatedAt ? ` · ბოლოს შეიცვალა ${esc(when(l.updatedAt))}` : ''}</p>
        </div>
        ${can ? `<button type="button" class="btn ${l.open ? '' : 'primary'}" data-launch-toggle="${l.open ? 'close' : 'open'}">${l.open ? 'დახურვა' : 'გახსნა'}</button>` : ''}
      </header>
      <div class="s-card-body s-comm-launch">
        <div class="s-comm-launch-stats">
          <span>აქტიური ქალები (30 დღე): <b>${fmt(r.activeWomen)}</b> / ${fmt(r.target)}</span>
          <span>მოდერატორები: <b>${fmt(r.moderators)}</b></span>
        </div>
        <div class="s-meter${r.ready ? '' : ' is-warn'}" role="progressbar" aria-label="გახსნის პირობის პროგრესი" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <small class="s-comm-launch-note">${r.ready ? 'გახსნის პირობა შესრულებულია: 300+ აქტიური ქალი და მოდერატორი.' : 'გახსნის პირობა: 300+ აქტიური ქალი და რეალური მოდერატორები რიგზე.'} ქალის ანგარიში: ${fmt(l.eligibleWomen)} · წევრი: ${fmt(l.members)}</small>
      </div>
    </section>`;
  }

  function actionButton(action, row, label) {
    return `<button type="button" class="btn compact ${ACTIONS[action].tone}" data-action="${action}" data-kind="${row.kind}" data-revision="${row.revision}" data-id="${row.id}">${label || ACTIONS[action].label}</button>`;
  }

  function rowHtml(row, can) {
    if (section === 'members') {
      return `<article class="s-feed-item"><span class="s-avatar">${esc(initials(row.alias))}</span><div>
        <header><b>${esc(row.alias)}</b>${row.banned ? '<span class="s-badge is-bad">შეჩერებული</span>' : '<span class="s-badge is-ok">აქტიური</span>'}${row.createdAt ? `<span>· შემოუერთდა ${esc(when(row.createdAt))}</span>` : ''}</header>
        ${can ? `<div class="s-feed-actions"><button type="button" class="btn compact ${row.banned ? '' : 'danger'}" data-action="${row.banned ? 'unban' : 'ban'}" data-kind="members" data-id="${row.id}">${row.banned ? 'წვდომის აღდგენა' : 'წვდომის შეჩერება'}</button></div>` : ''}
      </div></article>`;
    }
    if (section === 'audit') {
      const reason = row.action === 'resolve' && row.reason === 'Reviewed report' ? 'საჩივარი განხილულად მოინიშნა.' : row.reason;
      return `<article class="s-feed-item"><span class="s-avatar is-plain">${ico('file')}</span><div>
        <header><b>${esc(AUDIT_ACTIONS[row.action] || 'მოდერაციის ქმედება')}</b><span>· ${esc(when(row.createdAt))}</span><span>· ${adminName(row.adminId)}</span></header>
        <p class="s-feed-body">${esc(reason)}</p></div></article>`;
    }
    if (section === 'reports') {
      const kind = row.postId ? 'posts' : 'comments';
      const exists = row.body != null;
      return `<article class="s-feed-item"><span class="s-avatar is-warn">${ico('alert')}</span><div>
        <header><b>${esc(REPORT_REASONS[row.reason] || REPORT_REASONS.other)}</b><span class="s-badge is-plain">${kind === 'posts' ? 'პოსტი' : 'კომენტარი'}</span><span>${esc(when(row.createdAt))}</span></header>
        <p class="s-feed-body${exists ? '' : ' s-muted'}">${exists ? esc(row.body) : 'ჩანაწერი უკვე წაშლილია.'}</p>
        ${can ? `<div class="s-feed-actions"><button type="button" class="btn compact" data-resolve="${esc(row.id)}">განხილულია</button>
          ${exists ? `<button type="button" class="btn compact" data-action="hide" data-revision="${row.revision}" data-kind="${kind}" data-id="${esc(row.postId || row.commentId)}">ჩანაწერის დამალვა</button>` : ''}</div>` : ''}
      </div></article>`;
    }
    const status = row.status || section;
    const actions = [
      ...(STATUS_ACTIONS[status] || ['hide', 'delete']).map((a) => actionButton(a, row, a === 'approve' && status === 'HIDDEN' ? 'ხელახლა გამოქვეყნება' : '')),
      actionButton(row.banned ? 'unban' : 'ban', row),
    ].join('');
    return `<article class="s-feed-item"><span class="s-avatar">${esc(initials(row.author))}</span><div>
      <header><b>${esc(row.author)}</b><span class="s-badge is-plain">${row.kind === 'posts' ? 'პოსტი' : 'კომენტარი'}</span><span>${esc(when(row.createdAt))}</span>${row.banned ? '<span class="s-badge is-bad">წევრი შეჩერებულია</span>' : ''}</header>
      <p class="s-feed-body">${esc(row.body)}</p>
      ${row.hasImage ? `<img data-image="${esc(row.id)}" alt="პოსტის ფოტო">` : ''}
      ${can ? `<div class="s-feed-actions">${actions}</div>` : ''}
    </div></article>`;
  }

  function emptyHtml() {
    if (section === 'PENDING') return `<div class="s-empty">${ico('check')}<strong>შესამოწმებელი არაფერია</strong><span>პოსტები პირდაპირ ქვეყნდება — ეს რიგი ცარიელი უნდა იყოს.</span></div>`;
    if (section === 'reports') return `<div class="s-empty">${ico('check')}<strong>ღია საჩივარი არ არის</strong><span>ახალი საჩივარი აქ გამოჩნდება.</span></div>`;
    return `<div class="s-empty">${ico('check')}<strong>სია ცარიელია</strong><span>${offset ? 'ამ გვერდზე ჩანაწერი აღარ არის.' : 'ამ სიაში ჩანაწერი ჯერ არ არის.'}</span></div>`;
  }

  async function render() {
    const root = document.getElementById('tab-community');
    if (!root) return;
    const gen = ++generation;
    urls.forEach(URL.revokeObjectURL);
    urls = [];
    if (!root.querySelector('.s-stack')) root.innerHTML = `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
    try {
      const [summary, launch, list] = await Promise.all([
        request('/overview'),
        request('/launch'),
        request(section === 'members' ? '/members?offset=' + offset : section === 'reports' ? '/reports' : section === 'audit' ? '/audit' : '/content?status=' + section + '&offset=' + offset),
      ]);
      if (gen !== generation) return;
      const can = state.admin?.capabilities == null || state.admin.capabilities.includes('COMMUNITY_MANAGE');
      const counts = { PENDING: summary.pending, reports: summary.reports };
      const paged = !['audit', 'reports'].includes(section);
      const rows = newestFirst(list || []);
      const page = Math.floor(offset / 100) + 1;
      const r = launch.readiness || {};
      root.innerHTML = `<div class="s-stack v3-tab-shell s-comm">
        <div class="s-metrics">
          <div class="s-metric"><span>სივრცე</span><strong>${launch.open ? 'ღიაა' : 'დახურულია'}</strong><small>აქტიური ქალი: ${fmt(r.activeWomen)} / ${fmt(r.target)} · 30 დღე</small></div>
          <div class="s-metric"><span>წევრი</span><strong>${fmt(summary.members)}</strong><small>${fmt(launch.bannedMembers || 0)} შეჩერებული</small></div>
          <div class="s-metric${summary.reports ? ' is-bad' : ''}"><span>ღია საჩივარი</span><strong>${fmt(summary.reports)}</strong><small>${summary.reports ? 'განსახილველია' : 'ყველა განხილულია'}</small></div>
          <div class="s-metric${summary.failedPushes ? ' is-warn' : ''}"><span>პუშის შეცდომა</span><strong>${fmt(summary.failedPushes)}</strong><small>შეტყობინება ვერ მივიდა</small></div>
          ${summary.pending ? `<div class="s-metric is-warn"><span>შესამოწმებელი პოსტი</span><strong>${fmt(summary.pending)}</strong><small>ძველ რიგში დარჩენილი</small></div>` : ''}
        </div>
        <div class="s-toolbar">
          <div class="s-segment" role="tablist" aria-label="მოდერაციის სიები">${Object.entries(labels)
            .map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === section}" data-section="${k}">${l}${counts[k] ? `<i class="${k === 'reports' ? 'is-hot' : ''}">${fmt(counts[k])}</i>` : ''}</button>`)
            .join('')}</div>
          <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
        </div>
        <section class="s-card">
          <header class="s-card-head"><div><h3>${esc(labels[section])}</h3><p>${esc(SECTION_NOTE[section])}</p></div></header>
          <div class="s-card-body is-flush s-comm-list">
            ${rows.length ? rows.map((row) => rowHtml(row, can)).join('') : emptyHtml()}
          </div>
          ${paged ? `<footer class="s-pager"><span>გვერდი ${page}${rows.length ? ` · ${fmt(rows.length)} ჩანაწერი` : ''}</span><div>
            <button type="button" class="btn compact" data-page="-100" ${offset === 0 ? 'disabled' : ''}>${ico('chevronLeft')} წინა</button>
            <button type="button" class="btn compact" data-page="100" ${rows.length < 100 ? 'disabled' : ''}>შემდეგი ${ico('arrow')}</button></div></footer>` : ''}
        </section>
        ${launchCard(launch, can)}
      </div>`;
      root.querySelectorAll('[data-section]').forEach((b) => (b.onclick = () => { section = b.dataset.section; offset = 0; void render(); }));
      root.querySelector('[data-refresh]').onclick = () => void render();
      root.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => { offset += Number(b.dataset.page); void render(); }));
      root.querySelector('[data-launch-toggle]')?.addEventListener('click', (e) => toggleLaunch(e.currentTarget.dataset.launchToggle === 'open', !!launch.readiness?.ready));
      root.querySelectorAll('[data-action]').forEach((b) => (b.onclick = () => moderate(b.dataset.kind, b.dataset.id, b.dataset.action, b.dataset.revision === undefined ? undefined : Number(b.dataset.revision))));
      root.querySelectorAll('[data-resolve]').forEach((b) => (b.onclick = async () => {
        b.disabled = true;
        b.classList.add('is-loading');
        try {
          await request('/reports/' + b.dataset.resolve + '/resolve', { method: 'POST' });
          toast('საჩივარი განხილულია', 'ok');
          await render();
        } catch (e) {
          b.disabled = false;
          b.classList.remove('is-loading');
          feedback(e);
        }
      }));
      root.querySelectorAll('[data-image]').forEach(async (img) => {
        try {
          const response = await fetch('/api/admin/community/posts/' + img.dataset.image + '/image', { headers: { Authorization: 'Bearer ' + state.token }, cache: 'no-store' });
          if (!response.ok) throw new Error('ფოტო ვერ ჩაიტვირთა');
          const blob = await response.blob();
          if (gen !== generation) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          img.src = url;
        } catch {
          img.alt = 'ფოტო ვერ ჩაიტვირთა — არ გამოაქვეყნოთ შემოწმებამდე.';
        }
      });
    } catch (e) {
      if (gen !== generation) return;
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span data-msg></span><button type="button" class="btn">ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-msg]').textContent = e.message || '';
      root.querySelector('button').onclick = () => void render();
    }
  }
  global.renderCommunity = render;
})(window);
