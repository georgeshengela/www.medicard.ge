/**
 * MediCard Admin V4 — #/trainers ტრენერები (MEDI COACH, /api/admin/trainers).
 * Verify trainer applications (profile, phone, account age, certificate photos), suspend/restore,
 * curate the Georgian gym directory (approve trainer-proposed gyms, hide, add) and review the
 * reports clients and trainers send about each other.
 * Admins never see clients' health data here — only counts.
 */
(function adminV4Trainers(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const when = (iso) => (!iso ? '—' : V().formatDate ? V().formatDate(iso, 'datetime') : String(iso));
  const ageDays = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : null);
  const api = (path, opts) => global.api(`/trainers${path}`, opts);
  const skel = () => `<div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div>`;
  const toast = (m, t) => global.toast?.(m, t);

  const STATUS = { PENDING: ['განიხილება', 'is-warn'], VERIFIED: ['დადასტურებული', 'is-ok'], REJECTED: ['უარყოფილი', 'is-bad'], SUSPENDED: ['შეჩერებული', 'is-bad'] };
  const GYM_STATUS = { ACTIVE: ['აქტიური', 'is-ok'], PROPOSED: ['შემოთავაზებული', 'is-warn'], HIDDEN: ['დამალული', ''] };
  const GYM_SOURCE = { trainer: 'ტრენერმა შემოგვთავაზა', admin: 'დაამატა ადმინმა' };
  const VIEWS = [['trainers', 'ტრენერები'], ['gyms', 'დარბაზები'], ['reports', 'შეტყობინებები']];
  let view = 'trainers';
  let status = 'PENDING';
  let gymStatus = 'PROPOSED';
  let gymQuery = '';
  let reportStatus = 'open';

  if (typeof ICONS === 'object') {
    ICONS.coach = '<path d="M6.5 6.5 17.5 17.5"/><path d="M3 10l4-4 1.5 1.5L4.5 11.5z"/><path d="M13 20l4-4 1.5 1.5-4 4z"/><path d="M10 3l4 4"/><path d="M17 10l4 4"/>';
    doc.querySelectorAll('[data-icon="coach"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('coach'));
    });
  }

  const badge = (map, key) => `<span class="s-badge ${(map[key] || ['', ''])[1]}">${esc((map[key] || [key])[0])}</span>`;
  const emptyCard = (title, text) => `<div class="s-card"><div class="s-empty">${ico('check')}<strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}</div></div>`;
  const segment = (label, items, current, attr) => `<div class="s-segment" role="tablist" aria-label="${esc(label)}">${items.map(([key, text, count]) => `<button type="button" role="tab" aria-selected="${key === current}" ${attr}="${esc(key)}">${esc(text)}${count ? ` <i${key === 'PENDING' || key === 'open' ? ' class="is-hot"' : ''}>${fmt(count)}</i>` : ''}</button>`).join('')}</div>`;
  const refreshBtn = `<button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>`;

  async function openCertificate(file, title) {
    const dialog = V().openDialog?.({ title: title || 'სერტიფიკატი', description: 'ფაილი ჩანს მხოლოდ ადმინებს. კლიენტები ხედავენ დასახელებას, გამცემს და წელს.', body: '<div class="s-empty">იტვირთება…</div>', wide: true });
    try {
      const res = await fetch(`${API}/api/admin/trainers/certificates/${encodeURIComponent(file)}`, { headers: { Authorization: `Bearer ${state.token}` } });
      if (!res.ok) throw new Error(res.status === 404 ? 'ფაილი ვერ მოიძებნა (შესაძლოა სერვერის დისკიდან წაიშალა).' : 'ფაილი ვერ ჩაიტვირთა.');
      const url = URL.createObjectURL(await res.blob());
      const body = doc.querySelector('#v3-dialog .v3-overlay-body');
      if (body) body.innerHTML = `<img class="s-coach-cert-img" src="${url}" alt="${esc(title)}">`;
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
      body: `<form id="trainer-review" class="s-stack s-coach-form" novalidate>
        <label class="s-field"><span>${needsNote ? 'მიზეზი (ტრენერი ნახავს)' : 'შენიშვნა (არასავალდებულო)'}</span>
          <textarea name="note" rows="3" maxlength="500" ${needsNote ? 'required' : ''} placeholder="${action === 'reject' ? 'მაგ. სერტიფიკატის ფოტო ბუნდოვანია — ატვირთე მკაფიო ფოტო' : ''}"></textarea></label>
      </form>`,
      footer: `<p class="s-form-msg s-coach-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button>
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

  function trainerCard(t) {
    const days = ageDays(t.accountCreatedAt);
    const actions = {
      PENDING: `<button type="button" class="btn compact" data-act="approve">${ico('check')} დადასტურება</button><button type="button" class="btn ghost compact" data-act="reject">უარყოფა</button>`,
      VERIFIED: '<button type="button" class="btn ghost compact" data-act="suspend">შეჩერება</button>',
      REJECTED: '<button type="button" class="btn ghost compact" data-act="approve">დადასტურება</button>',
      SUSPENDED: '<button type="button" class="btn ghost compact" data-act="restore">აღდგენა</button>',
    }[t.status] || '';
    const meta = [
      t.fullName ? `<span>${esc(t.fullName)}</span>` : '',
      t.phoneVerified ? `<span class="is-ok">${ico('check')} ტელეფონი ${esc(t.phone)}</span>` : '<span class="s-badge is-bad">დადასტურებული ტელეფონი არ აქვს</span>',
      t.email ? `<span>${esc(t.email)}</span>` : '',
      `<span>ანგარიში ${days != null ? `${fmt(days)} დღის` : '—'}</span>`,
      t.accountStatus !== 'ACTIVE' ? '<span class="s-badge is-bad">ანგარიში დაბლოკილია</span>' : '',
    ].filter(Boolean).join('');
    const specialties = (t.specialties || []).map((s) => `<span class="s-badge is-plain">${esc(s)}</span>`).join('');
    const gyms = (t.gyms || []).map((g) => `<li>${esc(g.brand)} · ${esc(g.name)}, ${esc(g.city)} ${g.status === 'PROPOSED' ? badge(GYM_STATUS, 'PROPOSED') : ''}</li>`).join('');
    const certs = (t.certificates || []).map((c) => `<li>
      <button type="button" class="s-coach-cert" data-cert="${esc(c.file)}" data-title="${esc(c.title)}">${ico('eye')} ${esc(c.title)}</button>
      ${c.issuer || c.year ? `<span class="s-muted">${esc([c.issuer, c.year].filter(Boolean).join(' · '))}</span>` : ''}
    </li>`).join('');
    return `<article class="s-card s-coach-card" data-trainer="${esc(t.userId)}">
      <header class="s-card-head">
        <div>
          <h3 class="s-coach-title">${esc(t.displayName)} ${badge(STATUS, t.status)}</h3>
          <p class="s-coach-meta">${meta}</p>
        </div>
        <div class="s-coach-actions">${actions}</div>
      </header>
      <div class="s-card-body s-coach-grid">
        <section>
          <h4>შესახებ</h4>
          <p class="s-coach-bio">${esc(t.bio || '—')}</p>
          ${specialties ? `<div class="s-chips s-coach-chips">${specialties}</div>` : ''}
          <p class="s-coach-sub">${t.experienceYears != null ? `${fmt(t.experienceYears)} წლის გამოცდილება` : 'გამოცდილება არ არის მითითებული'}${t.instagram ? ` · <a href="https://instagram.com/${encodeURIComponent(t.instagram)}" target="_blank" rel="noopener noreferrer">@${esc(t.instagram)}</a>` : ''}</p>
        </section>
        <section>
          <h4>დარბაზები</h4>
          ${gyms ? `<ul class="s-coach-list">${gyms}</ul>` : '<p class="s-muted">არ არის მითითებული</p>'}
        </section>
        <section>
          <h4>სერტიფიკატები</h4>
          ${certs ? `<ul class="s-coach-list">${certs}</ul>` : '<span class="s-badge is-warn">სერტიფიკატი არ არის</span>'}
        </section>
        <section>
          <h4>აქტივობა</h4>
          <dl class="s-coach-dl">
            <div><dt>კლიენტი</dt><dd>${fmt(t.clients)} აქტიური</dd></div>
            <div><dt>გაგზავნა</dt><dd>${esc(when(t.submittedAt))}</dd></div>
            ${t.reviewedAt ? `<div><dt>განხილვა</dt><dd>${esc(when(t.reviewedAt))}${t.reviewedBy ? ` · ${esc(t.reviewedBy)}` : ''}</dd></div>` : ''}
          </dl>
          ${t.reviewNote ? `<p class="s-coach-note">„${esc(t.reviewNote)}“</p>` : ''}
        </section>
      </div>
    </article>`;
  }

  function paintTrainers(body, data) {
    const c = data.counts || {};
    const list = data.trainers || [];
    const counts = { PENDING: c.pending, VERIFIED: c.verified, REJECTED: c.rejected, SUSPENDED: c.suspended };
    body.innerHTML = `
      <div class="s-metrics">
        <div class="s-metric${c.pending ? ' is-warn' : ''}"><span>განსახილველი</span><strong>${fmt(c.pending)}</strong><small>ელოდება შენს გადაწყვეტილებას</small></div>
        <div class="s-metric"><span>დადასტურებული</span><strong>${fmt(c.verified)}</strong><small>შეჩერებული ${fmt(c.suspended)} · უარყოფილი ${fmt(c.rejected)}</small></div>
        <div class="s-metric"><span>აქტიური კავშირი</span><strong>${fmt(c.activeLinks)}</strong><small>ტრენერი ↔ კლიენტი</small></div>
        <div class="s-metric"><span>ვარჯიშები</span><strong>${fmt(c.upcomingSessions)}</strong><small>დაგეგმილი · ჩატარდა ${fmt(c.doneSessions)}</small></div>
      </div>
      <div class="s-toolbar">
        ${segment('განაცხადის სტატუსი', [...['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'].map((k) => [k, STATUS[k][0], counts[k]]), ['ALL', 'ყველა']], status, 'data-status')}
        ${refreshBtn}
      </div>
      <div class="s-stack" data-list>${list.length
        ? list.map(trainerCard).join('')
        : emptyCard(status === 'PENDING' ? 'განსახილველი განაცხადი არ არის' : 'ამ სტატუსით ტრენერი არ არის', status === 'PENDING' ? 'ახალი განაცხადი აქ გამოჩნდება.' : '')}</div>`;
    body.querySelectorAll('[data-trainer]').forEach((card) => {
      const t = list.find((x) => x.userId === card.dataset.trainer);
      card.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => review(t, b.dataset.act)));
      card.querySelectorAll('[data-cert]').forEach((b) => b.addEventListener('click', () => void openCertificate(b.dataset.cert, b.dataset.title)));
    });
  }

  function gymDialog() {
    const dialog = V().openDialog?.({
      title: 'დარბაზის დამატება',
      description: 'ახალი ფილიალი მაშინვე გამოჩნდება ტრენერების სიაში.',
      body: `<form id="gym-add" class="s-stack s-coach-form" novalidate>
        <label class="s-field"><span>ბრენდი / კომპანია</span><input name="brand" required maxlength="80" placeholder="მაგ. Oktopus"></label>
        <label class="s-field"><span>ფილიალი</span><input name="name" maxlength="80" placeholder="მაგ. ვაკე"></label>
        <label class="s-field"><span>ქალაქი</span><input name="city" required maxlength="40" value="თბილისი"></label>
        <label class="s-field"><span>მისამართი</span><input name="address" maxlength="160"></label>
      </form>`,
      footer: '<p class="s-form-msg s-coach-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary" form="gym-add">დამატება</button>',
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

  function gymSource(src) {
    if (src && /^https?:/.test(src)) {
      let host = 'წყარო';
      try { host = new URL(src).hostname.replace(/^www\./, ''); } catch { /* keep the generic label */ }
      return `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a>`;
    }
    return esc(GYM_SOURCE[src] || (src ? 'სხვა' : '—'));
  }

  function paintGyms(body, gyms) {
    body.innerHTML = `
      <div class="s-toolbar">
        <div class="s-coach-facets">
          ${segment('დარბაზის სტატუსი', [...['PROPOSED', 'ACTIVE', 'HIDDEN'].map((k) => [k, GYM_STATUS[k][0]]), ['ALL', 'ყველა']], gymStatus, 'data-gstatus')}
          <label class="s-coach-search"><span class="sr-only">ძებნა</span><input type="search" placeholder="ძებნა: ბრენდი, ქალაქი, მისამართი" value="${esc(gymQuery)}" data-gq></label>
        </div>
        <button type="button" class="btn primary compact" data-add>${ico('plus')} დარბაზის დამატება</button>
      </div>
      <section class="s-card"><div class="s-card-body is-flush" data-list><div class="s-table-wrap"><table class="s-table s-coach-table">
        <thead><tr><th>ბრენდი</th><th>ფილიალი</th><th>ქალაქი</th><th>მისამართი</th><th class="num">ტრენერი</th><th>სტატუსი</th><th>წყარო</th><th><span class="sr-only">ქმედება</span></th></tr></thead>
        <tbody data-gym-rows></tbody>
      </table></div></div></section>`;

    const tbody = body.querySelector('[data-gym-rows]');
    const paintRows = () => {
      const q = gymQuery.trim().toLowerCase();
      const shown = gyms.filter((g) => !q || `${g.brand} ${g.name} ${g.city} ${g.address || ''}`.toLowerCase().includes(q));
      tbody.innerHTML = shown.length ? shown.map((g) => `<tr data-gym="${esc(g.id)}">
          <td><b>${esc(g.brand)}</b>${g.brandKa ? `<small class="s-coach-sub2">${esc(g.brandKa)}</small>` : ''}</td>
          <td>${esc(g.name)}</td><td>${esc(g.city)}</td><td>${esc(g.address || '—')}</td>
          <td class="num">${fmt(g.trainers)}</td><td>${badge(GYM_STATUS, g.status)}</td>
          <td>${gymSource(g.source)}</td>
          <td class="s-coach-row-actions">${g.status !== 'ACTIVE' ? `<button type="button" class="btn ghost compact" data-gset="ACTIVE">${g.status === 'PROPOSED' ? 'დადასტურება' : 'ჩვენება'}</button>` : ''}${g.status !== 'HIDDEN' ? '<button type="button" class="btn ghost compact" data-gset="HIDDEN">დამალვა</button>' : ''}</td>
        </tr>`).join('')
        : `<tr><td colspan="8"><div class="s-empty">${ico('search')}<span>${q ? 'ძებნას არაფერი ემთხვევა.' : gymStatus === 'PROPOSED' ? 'ტრენერებს ახალი დარბაზი არ შემოუთავაზებიათ.' : 'ამ სტატუსით დარბაზი არ არის.'}</span></div></td></tr>`;
      tbody.querySelectorAll('[data-gym]').forEach((row) => row.querySelectorAll('[data-gset]').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          await api(`/gyms/${encodeURIComponent(row.dataset.gym)}`, { method: 'PATCH', body: { status: b.dataset.gset } });
          toast(b.dataset.gset === 'ACTIVE' ? 'დარბაზი აქტიურია' : 'დარბაზი დაიმალა', 'ok');
          await renderTrainers();
        } catch (err) { toast(err.message, 'bad'); b.disabled = false; }
      })));
    };
    paintRows();
    const input = body.querySelector('[data-gq]');
    input?.addEventListener('input', () => { gymQuery = input.value; paintRows(); });
    body.querySelector('[data-add]')?.addEventListener('click', gymDialog);
  }

  function resolveDialog(report) {
    const dialog = V().openDialog?.({
      title: 'შეტყობინების განხილვა',
      description: `${report.reporterName || '—'} → ${report.subjectName || '—'} · ${report.reasonLabel || ''}`,
      body: `<form id="report-resolve" class="s-stack s-coach-form" novalidate>
        <label class="s-field"><span>შენიშვნა (არასავალდებულო)</span>
          <textarea name="note" rows="3" maxlength="500" placeholder="მაგ. ტრენერს დავუკავშირდით, გაფრთხილება მიეცა"></textarea>
          <small>ჩანს მხოლოდ ადმინებს, ამ შეტყობინებასთან.</small></label>
      </form>`,
      footer: '<p class="s-form-msg s-coach-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary" form="report-resolve">განხილულად მონიშვნა</button>',
    });
    const form = $('report-resolve');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    form.note.focus();
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const note = form.note.value.trim();
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        await api(`/reports/${encodeURIComponent(report.id)}/resolve`, { method: 'POST', body: { note } });
        V().setDirty?.(false);
        await dialog.close();
        toast('განხილულად მოინიშნა', 'ok');
        await renderTrainers();
      } catch (err) {
        panel.querySelector('[role=alert]').textContent = err.message || 'შეცდომა';
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  function paintReports(body, data) {
    const rows = data.reports || [];
    body.innerHTML = `
      <div class="s-toolbar">
        ${segment('შეტყობინების სტატუსი', [['open', 'განსახილველი', data.open], ['resolved', 'განხილული'], ['all', 'ყველა']], reportStatus, 'data-rstatus')}
        ${refreshBtn}
      </div>
      <section class="s-card"><div class="s-card-body is-flush" data-list>${rows.length ? `<div class="s-table-wrap"><table class="s-table s-coach-table">
        <thead><tr><th>როდის</th><th>ვინ</th><th>ვისზე</th><th>მიზეზი</th><th>დეტალები</th><th>დაბლოკა</th><th><span class="sr-only">სტატუსი</span></th></tr></thead>
        <tbody>${rows.map((r) => `<tr data-report="${esc(r.id)}">
          <td class="s-coach-nowrap">${esc(when(r.createdAt))}</td>
          <td><b>${esc(r.reporterName || '—')}</b><small class="s-coach-sub2">${r.reporterRole === 'CLIENT' ? 'კლიენტი' : 'ტრენერი'}</small></td>
          <td>${esc(r.subjectName || '—')}</td>
          <td>${esc(r.reasonLabel || '—')}</td>
          <td class="s-coach-details">${esc(r.details || '—')}${r.status !== 'open' && r.resolvedNote ? `<small class="s-coach-sub2">შენიშვნა: ${esc(r.resolvedNote)}</small>` : ''}</td>
          <td>${r.blocked ? '<span class="s-badge is-warn">დაბლოკა</span>' : '<span class="s-muted">—</span>'}</td>
          <td class="s-coach-row-actions">${r.status === 'open'
            ? '<button type="button" class="btn compact" data-resolve>განხილვა…</button>'
            : `<span class="s-badge is-ok" title="${esc(r.resolvedAt ? when(r.resolvedAt) : '')}">განხილულია</span>`}</td>
        </tr>`).join('')}</tbody></table></div>`
        : `<div class="s-empty">${ico('check')}<span>${reportStatus === 'open' ? 'განსახილველი შეტყობინება არ არის.' : 'შეტყობინება არ არის.'}</span></div>`}</div></section>`;
    body.querySelectorAll('[data-report] [data-resolve]').forEach((b) => b.addEventListener('click', () => {
      const report = rows.find((x) => x.id === b.closest('[data-report]').dataset.report);
      if (report) resolveDialog(report);
    }));
  }

  /** `loading`: 'view' replaces the whole body with a skeleton; 'list' only the list under the toolbar. */
  async function renderTrainers({ loading } = {}) {
    const root = $('tab-trainers');
    if (!root) return;
    if (!root.querySelector('[data-body]')) {
      root.innerHTML = `<div class="s-stack v3-tab-shell s-coach">
        <div class="v3-tabs s-coach-tabs" role="tablist" aria-label="განყოფილება">${VIEWS.map(([key, label]) => `<button type="button" class="v3-tab" role="tab" data-view="${key}">${label}</button>`).join('')}</div>
        <div class="s-stack" data-body>${skel()}</div></div>`;
      root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
        if (view === b.dataset.view) return;
        view = b.dataset.view;
        void renderTrainers({ loading: 'view' });
      }));
    }
    root.querySelectorAll('[data-view]').forEach((b) => {
      const on = b.dataset.view === view;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    const body = root.querySelector('[data-body]');
    if (loading === 'view') body.innerHTML = skel();
    const list = body.querySelector('[data-list]');
    if (loading === 'list' && list) list.innerHTML = skel();
    body.setAttribute('aria-busy', 'true');
    try {
      if (view === 'trainers') paintTrainers(body, await api(`?status=${status}`));
      else if (view === 'reports') paintReports(body, await api(`/reports?status=${reportStatus}`));
      else paintGyms(body, (await api(`/gyms?status=${gymStatus}`)).gyms || []);
      bindToolbar(body);
    } catch (err) {
      const denied = err?.status === 403;
      body.innerHTML = `<div class="s-card"><div class="s-empty" role="alert">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${denied ? 'შენს ანგარიშს არ აქვს ტრენერების ნახვის უფლება (TRAINER_VIEW).' : 'სერვერმა პასუხი ვერ დააბრუნა — სცადე ხელახლა.'}</span>${!denied && err?.message ? `<small>${esc(err.message)}</small>` : ''}<button type="button" class="btn compact" data-retry>ხელახლა ცდა</button></div></div>`;
      body.querySelector('[data-retry]').onclick = () => void renderTrainers({ loading: 'view' });
    } finally {
      body.removeAttribute('aria-busy');
    }
  }

  /** Status filters and refresh: mark the choice at once, show a skeleton in the list while it loads. */
  function bindToolbar(body) {
    const filter = (attr, set) => body.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => {
      set(b.getAttribute(attr));
      b.closest('[role=tablist]').querySelectorAll('[role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      void renderTrainers({ loading: 'list' });
    }));
    filter('data-status', (v) => { status = v; });
    filter('data-gstatus', (v) => { gymStatus = v; });
    filter('data-rstatus', (v) => { reportStatus = v; });
    body.querySelector('[data-refresh]')?.addEventListener('click', () => void renderTrainers({ loading: 'list' }));
  }

  global.renderTrainersAdmin = renderTrainers;
  global.AdminV4Trainers = { renderTrainers };
})(window);
