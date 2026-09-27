(function (global) {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (name) => (typeof icon === 'function' ? icon(name) : '');
  const V = () => global.AdminV3 || {};
  const request = (p, o) => api('/community' + p, o);
  let section = 'PUBLISHED';
  let offset = 0;
  let generation = 0;
  let urls = [];
  const labels = {
    PENDING: 'შესამოწმებელი',
    PUBLISHED: 'გამოქვეყნებული',
    HIDDEN: 'დამალული',
    reports: 'საჩივრები',
    members: 'წევრები',
    audit: 'ქმედებების ისტორია',
  };
  const ACTIONS = {
    approve: { label: 'გამოქვეყნება', verb: 'გამოქვეყნდეს', tone: 'primary' },
    hide: { label: 'დამალვა', verb: 'დაიმალოს', tone: '' },
    delete: { label: 'სამუდამოდ წაშლა', verb: 'სამუდამოდ წაიშალოს', tone: 'danger' },
    ban: { label: 'წევრის შეჩერება', verb: 'შეჩერდეს წევრის წვდომა', tone: 'danger' },
    unban: { label: 'წვდომის აღდგენა', verb: 'აღდგეს წევრის წვდომა', tone: '' },
  };
  const when = (iso) => (typeof fmtDate === 'function' ? fmtDate(iso) : new Date(iso).toLocaleString('ka-GE'));
  const initials = (name) => String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  function feedback(error) {
    toast(error.message || 'მოქმედება ვერ შესრულდა.', 'bad');
  }

  /** Reason-required decision dialog shared by moderation and launch changes. */
  function reasonDialog({ title, description, confirmLabel, danger, minRows = 4, onSubmit }) {
    const dialog = V().openDialog?.({
      title,
      description,
      body: `<form id="community-reason-form" class="s-stack" style="gap:10px" novalidate>
        <label class="s-field"><span>მიზეზი</span>
          <textarea name="reason" required minlength="3" maxlength="500" rows="${minRows}" placeholder="მოკლედ აღწერე გადაწყვეტილება — ჩაიწერება ისტორიაში"></textarea>
          <small data-count>0 / 500</small></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert" style="margin-right:auto"></p>
        <button type="button" class="btn" data-cancel>გაუქმება</button>
        <button type="submit" class="btn ${danger ? 'danger' : 'primary'}" form="community-reason-form">${esc(confirmLabel || 'დადასტურება')}</button>`,
    });
    const form = document.getElementById('community-reason-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
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
          <h3 style="display:flex;align-items:center;gap:8px">${l.open ? 'სივრცე ღიაა ყველა ქალისთვის' : 'დახურული რეჟიმი'}
            <span class="s-badge ${l.open ? 'is-ok' : 'is-warn'}">${l.open ? 'ღია' : 'დახურული'}</span></h3>
          <p>${l.open ? 'ნებისმიერ აქტიურ ქალს შეუძლია გაწევრიანება.' : 'შედიან მხოლოდ არსებული წევრები. ახალი გაწევრიანება შეჩერებულია, აპში შესასვლელიც დამალულია.'}${l.updatedAt ? ` · ბოლოს შეიცვალა ${esc(when(l.updatedAt))}` : ''}</p>
        </div>
        ${can ? `<button type="button" class="btn ${l.open ? '' : 'primary'}" data-launch-toggle="${l.open ? 'close' : 'open'}">${l.open ? 'დახურვა' : 'გახსნა'}</button>` : ''}
      </header>
      <div class="s-card-body" style="display:grid;gap:8px">
        <div class="s-toolbar" style="font-size:13px;color:var(--s-text-2)">
          <span>აქტიური ქალები (30 დღე): <b style="color:var(--s-ink)">${esc(r.activeWomen)}</b> / ${esc(r.target)}</span>
          <span>მოდერატორები: <b style="color:var(--s-ink)">${esc(r.moderators)}</b></span>
        </div>
        <div class="s-meter${r.ready ? '' : ' is-warn'}" role="progressbar" aria-label="გახსნის პირობის პროგრესი" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <small class="s-muted" style="font-size:12px">${r.ready ? 'გახსნის პირობა შესრულებულია: 300+ აქტიური ქალი და მოდერატორი.' : 'გახსნის პირობა: 300+ აქტიური ქალი და რეალური მოდერატორები რიგზე.'} ქალის ანგარიში: ${esc(l.eligibleWomen)} · წევრი: ${esc(l.members)}</small>
      </div>
    </section>`;
  }

  function rowHtml(row, can) {
    if (section === 'members') {
      return `<article class="s-feed-item"><span class="s-avatar">${esc(initials(row.alias))}</span><div>
        <header><b>${esc(row.alias)}</b>${row.banned ? '<span class="s-badge is-bad">შეჩერებული</span>' : '<span class="s-badge is-ok">აქტიური</span>'}</header>
        ${can ? `<div class="s-feed-actions"><button type="button" class="btn compact ${row.banned ? '' : 'danger'}" data-action="${row.banned ? 'unban' : 'ban'}" data-kind="members" data-id="${row.id}">${row.banned ? 'წვდომის აღდგენა' : 'წვდომის შეჩერება'}</button></div>` : ''}
      </div></article>`;
    }
    if (section === 'audit') {
      return `<article class="s-feed-item"><span class="s-avatar" style="background:var(--s-sunken);color:var(--s-muted)">${ico('file')}</span><div>
        <header><b>${esc(row.action)}</b><span>· ${esc(when(row.createdAt))}</span><span>· ${esc(row.adminId)}</span></header>
        <p class="s-feed-body">${esc(row.reason)}</p></div></article>`;
    }
    if (section === 'reports') {
      return `<article class="s-feed-item"><span class="s-avatar" style="background:var(--s-warn-soft);color:var(--s-warn)">${ico('alert')}</span><div>
        <header><b>${esc(row.reason)}</b><span class="s-badge is-warn">საჩივარი</span></header>
        <p class="s-feed-body">${esc(row.body)}</p>
        ${can ? `<div class="s-feed-actions"><button type="button" class="btn compact primary" data-resolve="${esc(row.id)}">განხილულია</button>
          <button type="button" class="btn compact" data-action="hide" data-revision="${row.revision}" data-kind="${row.postId ? 'posts' : 'comments'}" data-id="${esc(row.postId || row.commentId)}">ჩანაწერის დამალვა</button></div>` : ''}
      </div></article>`;
    }
    const actions = [['approve'], ['hide'], ['delete'], [row.banned ? 'unban' : 'ban']]
      .map(([a]) => `<button type="button" class="btn compact ${ACTIONS[a].tone}" data-action="${a}" data-kind="${row.kind}" data-revision="${row.revision}" data-id="${row.id}">${ACTIONS[a].label}</button>`)
      .join('');
    return `<article class="s-feed-item"><span class="s-avatar">${esc(initials(row.author))}</span><div>
      <header><b>${esc(row.author)}</b><span class="s-badge is-plain">${row.kind === 'posts' ? 'პოსტი' : 'კომენტარი'}</span><span>${esc(when(row.createdAt))}</span>${row.banned ? '<span class="s-badge is-bad">წევრი შეჩერებულია</span>' : ''}</header>
      <p class="s-feed-body">${esc(row.body)}</p>
      ${row.hasImage ? `<img data-image="${esc(row.id)}" alt="პოსტის ფოტო">` : ''}
      ${can ? `<div class="s-feed-actions">${actions}</div>` : ''}
    </div></article>`;
  }

  async function render() {
    const root = document.getElementById('tab-community');
    if (!root) return;
    const gen = ++generation;
    urls.forEach(URL.revokeObjectURL);
    urls = [];
    if (!root.querySelector('.s-stack')) root.innerHTML = `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
    try {
      const [summary, launch, rows] = await Promise.all([
        request('/overview'),
        request('/launch'),
        request(section === 'members' ? '/members?offset=' + offset : section === 'reports' ? '/reports' : section === 'audit' ? '/audit' : '/content?status=' + section + '&offset=' + offset),
      ]);
      if (gen !== generation) return;
      const can = state.admin?.capabilities == null || state.admin.capabilities.includes('COMMUNITY_MANAGE');
      const counts = { PENDING: summary.pending, reports: summary.reports };
      const paged = !['audit', 'reports'].includes(section);
      root.innerHTML = `<div class="s-stack v3-tab-shell">
        ${launchCard(launch, can)}
        <div class="s-metrics">
          <div class="s-metric"><span>წევრი</span><strong>${esc(summary.members)}</strong></div>
          <div class="s-metric${summary.pending ? ' is-warn' : ''}"><span>პოსტი ელოდება</span><strong>${esc(summary.pending)}</strong></div>
          <div class="s-metric${summary.reports ? ' is-bad' : ''}"><span>ღია საჩივარი</span><strong>${esc(summary.reports)}</strong></div>
          <div class="s-metric${summary.failedPushes ? ' is-warn' : ''}"><span>პუშის შეცდომა</span><strong>${esc(summary.failedPushes)}</strong></div>
        </div>
        <div class="s-callout">${ico('shield')}<p>ანონიმურ პოსტებზე ვინაობა დაფარულია. პოსტები და კომენტარები პირდაპირ ქვეყნდება — განიხილე საჩივრები და საჭიროებისას დამალე დარღვევები. ჯანმრთელობის პირადი მონაცემები არ გადაიტანო მიმოწერაში.</p></div>
        <section class="s-card">
          <header class="s-card-head" style="align-items:center">
            <div class="s-segment" role="tablist" aria-label="მოდერაციის სიები">${Object.entries(labels)
              .map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === section}" data-section="${k}">${l}${counts[k] ? `<i class="${k === 'reports' ? 'is-hot' : ''}">${counts[k]}</i>` : ''}</button>`)
              .join('')}</div>
            <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
          </header>
          <div class="s-card-body is-flush" style="border-top:1px solid var(--s-line-soft)">
            ${rows.length ? rows.map((row) => rowHtml(row, can)).join('') : `<div class="s-empty">${ico('check')}<strong>სია ცარიელია</strong><span>ამ სიაში ჩანაწერი არ არის.</span></div>`}
          </div>
          ${paged ? `<footer class="s-pager"><span>${rows.length ? `${offset + 1}–${offset + rows.length}` : '0'}</span><div>
            <button type="button" class="btn compact" data-page="-100" ${offset === 0 ? 'disabled' : ''}>${ico('chevronLeft')} წინა</button>
            <button type="button" class="btn compact" data-page="100" ${rows.length < 100 ? 'disabled' : ''}>შემდეგი ${ico('arrow')}</button></div></footer>` : ''}
        </section>
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
