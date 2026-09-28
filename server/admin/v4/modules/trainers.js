/**
 * MediCard Admin V4 — #/trainers ტრენერები (MEDI COACH, /api/admin/trainers).
 * Verify trainer applications (profile, phone, account age, certificate photos), suspend/restore,
 * and curate the Georgian gym directory (approve trainer-proposed gyms, hide, add).
 * Admins never see clients' health data here — only counts.
 */
(function adminV4Trainers(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const when = (iso) => (iso ? new Date(iso).toLocaleString('ka-GE', { dateStyle: 'medium', timeStyle: 'short', hour12: false }) : '—');
  const ageDays = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : null);
  const api = (path, opts) => global.api(`/trainers${path}`, opts);
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const toast = (m, t) => global.toast?.(m, t);

  const STATUS = { PENDING: ['განიხილება', 'is-warn'], VERIFIED: ['დადასტურებული', 'is-ok'], REJECTED: ['უარყოფილი', 'is-bad'], SUSPENDED: ['შეჩერებული', 'is-bad'] };
  const GYM_STATUS = { ACTIVE: ['აქტიური', 'is-ok'], PROPOSED: ['შემოთავაზებული', 'is-warn'], HIDDEN: ['დამალული', ''] };
  let view = 'trainers';
  let status = 'PENDING';
  let gymStatus = 'PROPOSED';
  let gymQuery = '';

  if (typeof ICONS === 'object') {
    ICONS.coach = '<path d="M6.5 6.5 17.5 17.5"/><path d="M3 10l4-4 1.5 1.5L4.5 11.5z"/><path d="M13 20l4-4 1.5 1.5-4 4z"/><path d="M10 3l4 4"/><path d="M17 10l4 4"/>';
    doc.querySelectorAll('[data-icon="coach"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('coach'));
    });
  }

  const badge = (map, key) => `<span class="s-badge ${(map[key] || ['', ''])[1]}">${esc((map[key] || [key])[0])}</span>`;

  async function openCertificate(file, title) {
    const dialog = V().openDialog?.({ title: title || 'სერტიფიკატი', description: 'ფაილი ჩანს მხოლოდ ადმინებს. კლიენტები ხედავენ დასახელებას, გამცემს და წელს.', body: '<div class="s-empty">იტვირთება…</div>', wide: true });
    try {
      const res = await fetch(`${API}/api/admin/trainers/certificates/${encodeURIComponent(file)}`, { headers: { Authorization: `Bearer ${state.token}` } });
      if (!res.ok) throw new Error(res.status === 404 ? 'ფაილი ვერ მოიძებნა (შესაძლოა სერვერის დისკიდან წაიშალა).' : 'ფაილი ვერ ჩაიტვირთა.');
      const url = URL.createObjectURL(await res.blob());
      const body = doc.querySelector('#v3-dialog .v3-overlay-body');
      if (body) body.innerHTML = `<img src="${url}" alt="${esc(title)}" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;border-radius:12px">`;
    } catch (err) {
      const body = doc.querySelector('#v3-dialog .v3-overlay-body');
      if (body) body.innerHTML = `<div class="s-empty">${ico('alert')}<span>${esc(err.message)}</span></div>`;
    }
    return dialog;
  }

  function review(t, action) {
    const copy = {
      approve: ['დადასტურება', `${t.displayName} გახდება დადასტურებული ტრენერი: მიიღებს კოდს, გამოჩნდება ძებნაში და შეძლებს კლიენტების ჩაწერას.`, 'primary'],
      reject: ['უარყოფა', 'ტრენერი ნახავს მიზეზს და შეძლებს გასწორებას და ხელახლა გაგზავნას.', 'danger'],
      suspend: ['შეჩერება', 'ყველა კლიენტთან კავშირი მაშინვე დასრულდება და მომავალი ვარჯიშები გაუქმდება.', 'danger'],
      restore: ['აღდგენა', 'პროფილი ისევ დადასტურებული გახდება. ძველი კავშირები თავისით არ აღდგება.', 'primary'],
    }[action];
    const needsNote = action === 'reject' || action === 'suspend';
    const dialog = V().openDialog?.({
      title: `${copy[0]} · ${t.displayName}`,
      description: copy[1],
      body: `<form id="trainer-review" class="s-stack" style="gap:14px" novalidate>
        <label class="s-field"><span>${needsNote ? 'მიზეზი (ტრენერი ნახავს)' : 'შენიშვნა (არასავალდებულო)'}</span>
          <textarea name="note" rows="3" maxlength="500" ${needsNote ? 'required' : ''} placeholder="${action === 'reject' ? 'მაგ. სერტიფიკატის ფოტო ბუნდოვანია — ატვირთე მკაფიო ფოტო' : ''}"></textarea></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert" style="margin-right:auto"></p><button type="button" class="btn" data-cancel>გაუქმება</button>
        <button type="submit" class="btn ${copy[2]}" form="trainer-review">${copy[0]}</button>`,
    });
    const form = $('trainer-review');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    if (copy[2] === 'danger') panel.classList.add('is-danger');
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const note = form.note.value.trim();
      const alertEl = panel.querySelector('[role=alert]');
      if (needsNote && note.length < 3) { alertEl.textContent = 'მიზეზი სავალდებულოა.'; return; }
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        await api(`/${encodeURIComponent(t.userId)}/review`, { method: 'POST', body: { action, note } });
        V().setDirty?.(false);
        await dialog.close();
        toast(`${copy[0]}: ${t.displayName}`, 'ok');
        await renderTrainers();
      } catch (err) {
        alertEl.textContent = err.message || 'შეცდომა';
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  function trainerRow(t) {
    const days = ageDays(t.accountCreatedAt);
    const actions = {
      PENDING: `<button class="btn primary compact" data-act="approve">${ico('check')} დადასტურება</button><button class="btn ghost compact" data-act="reject">უარყოფა</button>`,
      VERIFIED: `<button class="btn ghost compact" data-act="suspend">შეჩერება</button>`,
      REJECTED: `<button class="btn ghost compact" data-act="approve">დადასტურება</button>`,
      SUSPENDED: `<button class="btn ghost compact" data-act="restore">აღდგენა</button>`,
    }[t.status] || '';
    return `<article class="s-card" data-trainer="${esc(t.userId)}">
      <header class="s-card-head"><div>
        <h3>${esc(t.displayName)} ${badge(STATUS, t.status)}</h3>
        <p>${esc(t.fullName || '')} · ${t.phoneVerified ? `${ico('check')} ტელეფონი ${esc(t.phone)}` : '<span class="s-badge is-bad">ტელეფონი არ არის</span>'}${t.email ? ` · ${esc(t.email)}` : ''} · ანგარიში ${days != null ? `${fmt(days)} დღის` : '—'}${t.accountStatus !== 'ACTIVE' ? ' · <span class="s-badge is-bad">დაბლოკილი</span>' : ''}</p>
      </div><div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></header>
      <div class="s-card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
        <div><small class="s-muted">შესახებ</small><p style="margin:4px 0 0;white-space:pre-wrap">${esc(t.bio || '—')}</p>
          <p style="margin:8px 0 0">${t.specialties.map((s) => `<span class="s-badge is-plain">${esc(s)}</span>`).join(' ') || ''}</p>
          <p class="s-muted" style="margin:8px 0 0">${t.experienceYears != null ? `${fmt(t.experienceYears)} წლის გამოცდილება` : 'გამოცდილება არ არის მითითებული'}${t.instagram ? ` · <a href="https://instagram.com/${encodeURIComponent(t.instagram)}" target="_blank" rel="noopener noreferrer">@${esc(t.instagram)}</a>` : ''}</p></div>
        <div><small class="s-muted">დარბაზები</small>${t.gyms.map((g) => `<p style="margin:4px 0 0">${esc(g.brand)} · ${esc(g.name)}, ${esc(g.city)} ${g.status === 'PROPOSED' ? badge(GYM_STATUS, 'PROPOSED') : ''}</p>`).join('') || '<p>—</p>'}</div>
        <div><small class="s-muted">სერტიფიკატები</small>${t.certificates.length ? t.certificates.map((c) => `<p style="margin:4px 0 0"><button type="button" class="btn ghost compact" data-cert="${esc(c.file)}" data-title="${esc(c.title)}">${ico('eye')} ${esc(c.title)}</button> <span class="s-muted">${esc([c.issuer, c.year].filter(Boolean).join(' · '))}</span></p>`).join('') : '<p><span class="s-badge is-warn">სერტიფიკატი არ არის</span></p>'}</div>
        <div><small class="s-muted">აქტივობა</small><p style="margin:4px 0 0">${fmt(t.clients)} აქტიური კლიენტი</p>
          <p class="s-muted" style="margin:4px 0 0">გაგზავნა: ${esc(when(t.submittedAt))}</p>
          ${t.reviewedAt ? `<p class="s-muted" style="margin:4px 0 0">განხილვა: ${esc(t.reviewedBy || '')} · ${esc(when(t.reviewedAt))}</p>` : ''}
          ${t.reviewNote ? `<p style="margin:4px 0 0">„${esc(t.reviewNote)}“</p>` : ''}</div>
      </div>
    </article>`;
  }

  function paintTrainers(root, data) {
    const c = data.counts || {};
    const list = data.trainers || [];
    root.querySelector('[data-body]').innerHTML = `
      <div class="s-metrics">
        <div class="s-metric"><span>განსახილველი</span><strong>${fmt(c.pending)}</strong><small>ელოდება დადასტურებას</small></div>
        <div class="s-metric"><span>დადასტურებული</span><strong>${fmt(c.verified)}</strong><small>შეჩერებული ${fmt(c.suspended)} · უარყოფილი ${fmt(c.rejected)}</small></div>
        <div class="s-metric"><span>აქტიური კავშირი</span><strong>${fmt(c.activeLinks)}</strong><small>ტრენერი ↔ კლიენტი</small></div>
        <div class="s-metric"><span>ვარჯიშები</span><strong>${fmt(c.upcomingSessions)}</strong><small>დაგეგმილი · ჩატარდა ${fmt(c.doneSessions)}</small></div>
      </div>
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="სტატუსი">${['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'ALL'].map((k) => `<button type="button" role="tab" aria-selected="${k === status}" data-status="${k}">${k === 'ALL' ? 'ყველა' : STATUS[k][0]}</button>`).join('')}</div>
        <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
      </div>
      ${list.length ? list.map(trainerRow).join('') : `<div class="s-card"><div class="s-empty">${ico('check')}<strong>${status === 'PENDING' ? 'განსახილველი განაცხადი არ არის' : 'სია ცარიელია'}</strong></div></div>`}
      <div class="s-callout">${ico('shield')}<p>შეამოწმე: რეალური სახელი (ემთხვევა სერტიფიკატს), დადასტურებული ტელეფონი, ანგარიშის ასაკი, სერტიფიკატის ფოტო და დარბაზი. საეჭვოს შემთხვევაში დაურეკე ან სთხოვე დამატებითი დოკუმენტი — უარყოფის მიზეზს ტრენერი ნახავს. კლიენტების ჯანმრთელობის მონაცემი აქ არ ჩანს.</p></div>`;
    root.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => { status = b.dataset.status; void renderTrainers(); }));
    root.querySelector('[data-refresh]')?.addEventListener('click', () => void renderTrainers());
    root.querySelectorAll('[data-trainer]').forEach((card) => {
      const t = list.find((x) => x.userId === card.dataset.trainer);
      card.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => review(t, b.dataset.act)));
      card.querySelectorAll('[data-cert]').forEach((b) => b.addEventListener('click', () => void openCertificate(b.dataset.cert, b.dataset.title)));
    });
  }

  function gymDialog() {
    const dialog = V().openDialog?.({
      title: 'დარბაზის დამატება',
      description: 'ახალი ფილიალი მაშინვე გამოჩნდება ტრენერების სიაში.',
      body: `<form id="gym-add" class="s-stack" style="gap:14px" novalidate>
        <label class="s-field"><span>ბრენდი / კომპანია</span><input name="brand" required maxlength="80" placeholder="მაგ. Oktopus"></label>
        <label class="s-field"><span>ფილიალი</span><input name="name" maxlength="80" placeholder="მაგ. ვაკე"></label>
        <label class="s-field"><span>ქალაქი</span><input name="city" required maxlength="40" value="თბილისი"></label>
        <label class="s-field"><span>მისამართი</span><input name="address" maxlength="160"></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert" style="margin-right:auto"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary" form="gym-add">დამატება</button>`,
    });
    const form = $('gym-add');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const body = { brand: form.brand.value.trim(), name: form.name.value.trim() || undefined, city: form.city.value.trim(), address: form.address.value.trim() || undefined };
      if (body.brand.length < 2 || body.city.length < 2) { panel.querySelector('[role=alert]').textContent = 'ბრენდი და ქალაქი სავალდებულოა.'; return; }
      try {
        await api('/gyms', { method: 'POST', body });
        V().setDirty?.(false);
        await dialog.close();
        toast('დარბაზი დაემატა', 'ok');
        await renderTrainers();
      } catch (err) {
        panel.querySelector('[role=alert]').textContent = err.message || 'შეცდომა';
      }
    };
  }

  function paintGyms(root, gyms) {
    const q = gymQuery.trim().toLowerCase();
    const shown = gyms.filter((g) => !q || `${g.brand} ${g.name} ${g.city} ${g.address || ''}`.toLowerCase().includes(q));
    root.querySelector('[data-body]').innerHTML = `
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="სტატუსი">${['PROPOSED', 'ACTIVE', 'HIDDEN', 'ALL'].map((k) => `<button type="button" role="tab" aria-selected="${k === gymStatus}" data-gstatus="${k}">${k === 'ALL' ? 'ყველა' : GYM_STATUS[k][0]}</button>`).join('')}</div>
        <label class="s-field" style="min-width:260px;margin:0"><span class="sr-only">ძებნა</span><input type="search" placeholder="ძებნა: ბრენდი, ქალაქი, მისამართი" value="${esc(gymQuery)}" data-gq></label>
        <button type="button" class="btn primary compact" data-add>${ico('plus')} დარბაზის დამატება</button>
      </div>
      <section class="s-card"><div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table">
        <thead><tr><th>ბრენდი</th><th>ფილიალი</th><th>ქალაქი</th><th>მისამართი</th><th class="num">ტრენერი</th><th>სტატუსი</th><th>წყარო</th><th></th></tr></thead>
        <tbody>${shown.length ? shown.map((g) => `<tr data-gym="${esc(g.id)}">
          <td><b>${esc(g.brand)}</b>${g.brandKa ? `<br><small class="s-muted">${esc(g.brandKa)}</small>` : ''}</td>
          <td>${esc(g.name)}</td><td>${esc(g.city)}</td><td>${esc(g.address || '—')}</td>
          <td class="num">${fmt(g.trainers)}</td><td>${badge(GYM_STATUS, g.status)}</td>
          <td>${g.source && /^https?:/.test(g.source) ? `<a href="${esc(g.source)}" target="_blank" rel="noopener noreferrer">წყარო</a>` : esc(g.source === 'trainer' ? 'ტრენერმა შემოგვთავაზა' : g.source || '—')}</td>
          <td style="white-space:nowrap">${g.status !== 'ACTIVE' ? `<button class="btn ghost compact" data-gset="ACTIVE">${g.status === 'PROPOSED' ? 'დადასტურება' : 'ჩვენება'}</button>` : ''}${g.status !== 'HIDDEN' ? `<button class="btn ghost compact" data-gset="HIDDEN">დამალვა</button>` : ''}</td>
        </tr>`).join('') : '<tr><td colspan="8"><div class="s-empty">ჩანაწერი არ არის.</div></td></tr>'}</tbody></table></div></div></section>
      <div class="s-callout">${ico('info')}<p>სია აწყობილია საჯარო წყაროებიდან (ოფიციალური საიტები, fitpass.ge, yell.ge, kompas.ge; 2026-09-28). დაბალი სანდოობის ფილიალები დამალულია, სანამ არ დაადასტურებ. დამალული დარბაზი ტრენერის პროფილიდან არ იშლება.</p></div>`;
    root.querySelectorAll('[data-gstatus]').forEach((b) => b.addEventListener('click', () => { gymStatus = b.dataset.gstatus; void renderTrainers(); }));
    const input = root.querySelector('[data-gq]');
    input?.addEventListener('input', () => { gymQuery = input.value; paintGyms(root, gyms); const again = root.querySelector('[data-gq]'); again?.focus(); again?.setSelectionRange(again.value.length, again.value.length); });
    root.querySelector('[data-add]')?.addEventListener('click', gymDialog);
    root.querySelectorAll('[data-gym]').forEach((row) => row.querySelectorAll('[data-gset]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await api(`/gyms/${encodeURIComponent(row.dataset.gym)}`, { method: 'PATCH', body: { status: b.dataset.gset } });
        toast(b.dataset.gset === 'ACTIVE' ? 'დარბაზი აქტიურია' : 'დარბაზი დაიმალა', 'ok');
        await renderTrainers();
      } catch (err) { toast(err.message, 'bad'); b.disabled = false; }
    })));
  }

  async function renderTrainers() {
    const root = $('tab-trainers');
    if (!root) return;
    if (!root.querySelector('[data-body]')) {
      root.innerHTML = `<div class="s-stack v3-tab-shell">
        <div class="s-segment" role="tablist" aria-label="განყოფილება"><button type="button" role="tab" data-view="trainers">ტრენერები</button><button type="button" role="tab" data-view="gyms">დარბაზები</button></div>
        <div class="s-stack" data-body>${skel()}</div></div>`;
      root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; void renderTrainers(); }));
    }
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    const body = root.querySelector('[data-body]');
    try {
      if (view === 'trainers') paintTrainers(root, await api(`?status=${status}`));
      else paintGyms(root, (await api(`/gyms?status=${gymStatus}`)).gyms || []);
    } catch (err) {
      body.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.status === 403 ? 'შენს ანგარიშს არ აქვს TRAINER_VIEW უფლება.' : err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      body.querySelector('[data-retry]').onclick = renderTrainers;
    }
  }

  global.renderTrainersAdmin = renderTrainers;
  global.AdminV4Trainers = { renderTrainers };
})(window);
