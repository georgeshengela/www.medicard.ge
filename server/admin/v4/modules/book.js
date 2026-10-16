/**
 * MediCard Admin V4 — #/book MEDIBOOK (/api/admin/book).
 * Three panes on the module-usage kit (usageKit.js): „გამოყენება“ — who uses MEDIBOOK and how (insights, numbers,
 * the ladder from the catalogue to a live business, one card per business with its setup / bookings track, the period
 * trend, categories and cities, what claimed places still lack); „განაცხადები“ — the claims queue (owners proving a
 * listed place is theirs, new registrations); „კატალოგი“ — search, list / hide, edit, add a place. Only public
 * business facts and counts, the owner as the user page shows them — never a client's note or phone.
 */
(function adminV4Book(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const when = (iso, mode = 'datetime') => (!iso ? '—' : V().formatDate ? V().formatDate(iso, mode) : String(iso));
  const api = (path, opts) => global.api(`/book${path}`, opts);
  const toast = (m, t) => global.toast?.(m, t);
  const skel = () => `<div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div>`;

  const STATUS = { LISTED: ['კატალოგში', 'is-plain'], PENDING: ['განიხილება', 'is-warn'], CLAIMED: ['დადასტურებული', 'is-ok'], HIDDEN: ['დამალული', 'is-bad'] };
  const CLAIM = { PENDING: ['განიხილება', 'is-warn'], APPROVED: ['დადასტურებული', 'is-ok'], REJECTED: ['უარყოფილი', 'is-bad'] };
  const KIND = { CLAIM: 'კატალოგის ბიზნესის დადასტურება', REGISTER: 'ახალი რეგისტრაცია' };
  const POSITION = { owner: 'მფლობელი', director: 'დირექტორი / მენეჯერი', admin: 'ადმინისტრატორი', other: 'სხვა' };
  const SOURCE = { MAPBOX: 'რუკის მონაცემები', OSM: 'OpenStreetMap', OWNER: 'მფლობელმა დაარეგისტრირა', ADMIN: 'ადმინმა დაამატა' };
  const APPT = { PENDING: 'დასადასტურებელი', CONFIRMED: 'დადასტურებული', COMPLETED: 'დასრულებული', CANCELLED: 'გაუქმებული', NO_SHOW: 'არ მოვიდა' };
  let claimStatus = 'PENDING';
  let catStatus = 'ALL';
  let catCategory = '';
  let catQuery = '';
  let categories = [];

  const badge = (map, key) => `<span class="s-badge ${(map[key] || ['', ''])[1]}">${esc((map[key] || [key])[0])}</span>`;
  const catLabel = (id) => categories.find((c) => c.id === id)?.label || id || '—';
  const catDot = (id) => `<span class="s-dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(categories.find((c) => c.id === id)?.color || '#64748B')};margin-right:6px"></span>`;
  const segment = (label, items, current, attr) => `<div class="s-segment" role="tablist" aria-label="${esc(label)}">${items.map(([key, text, count]) => `<button type="button" role="tab" aria-selected="${key === current}" ${attr}="${esc(key)}">${esc(text)}${count ? ` <i${key === 'PENDING' ? ' class="is-hot"' : ''}>${fmt(count)}</i>` : ''}</button>`).join('')}</div>`;
  const emptyCard = (title, text) => `<div class="s-card"><div class="s-empty">${ico('check')}<strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}</div></div>`;
  const metric = (label, value, sub) => `<div class="s-metric"><span class="s-metric-label">${esc(label)}</span><b class="s-metric-value">${esc(value)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;

  function reviewClaim(c, action) {
    const approve = action === 'approve';
    const dialog = V().openDialog?.({
      title: `${approve ? 'დადასტურება' : 'უარყოფა'} · ${c.business.name}`,
      description: approve
        ? `${c.user.name} გახდება ბიზნესის მფლობელი: ბიზნესი კატალოგში და აპის რუკაზე „დადასტურებული“ გამოჩნდება, ჩაირთვება ონლაინ ჯავშნა. ადამიანს აპში და ელფოსტაზე შეტყობინება მივა.`
        : 'ადამიანი ნახავს მიზეზს აპში და ელფოსტაზე. რეგისტრირებული ბიზნესი პანელში რჩება, კატალოგში არ გამოჩნდება.',
      body: `<form id="book-claim-review" class="s-stack" novalidate>
        <label class="s-field"><span>${approve ? 'შენიშვნა (არასავალდებულო)' : 'მიზეზი (მფლობელი ნახავს)'}</span>
          <textarea name="note" rows="3" maxlength="500" ${approve ? '' : 'required'} placeholder="${approve ? '' : 'მაგ. ვერ დავადასტურეთ, რომ ბიზნესს წარმოადგენთ — მოგვწერეთ ოფიციალური ელფოსტიდან'}"></textarea></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button>
        <button type="submit" class="btn ${approve ? 'primary' : 'danger'}" form="book-claim-review">${approve ? 'დადასტურება' : 'უარყოფა'}</button>`,
    });
    const form = $('book-claim-review');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    if (!approve) panel.classList.add('is-danger');
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const note = form.note.value.trim();
      const alertEl = panel.querySelector('[role=alert]');
      if (!approve && note.length < 3) { alertEl.textContent = 'მიზეზი სავალდებულოა.'; return; }
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        await api(`/claims/${encodeURIComponent(c.id)}/review`, { method: 'POST', body: { action, note } });
        V().setDirty?.(false);
        await dialog.close();
        toast(`${approve ? 'დადასტურდა' : 'უარყოფილია'}: ${c.business.name}`, 'ok');
        await refreshAll();
      } catch (err) {
        alertEl.textContent = err.message || 'შეცდომა';
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  /** One claim, with room to breathe: the place on the left, the applicant on the right, the note under, actions in the footer. */
  function claimCard(c) {
    const proof = c.proof || {};
    const b = c.business;
    const u = c.user;
    const dash = '<span class="s-muted">—</span>';
    const facts = (rows) => `<dl class="p3-facts s-claim-facts">${rows.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`).join('')}</dl>`;
    const site = b.website ? `<a href="${esc(/^https?:/i.test(b.website) ? b.website : `https://${b.website}`)}" target="_blank" rel="noopener">${esc(String(b.website).replace(/^https?:\/\//i, ''))}</a>` : dash;
    const place = facts([
      ['კატეგორია', `${catDot(b.category)}${esc(catLabel(b.category))}`],
      ['მისამართი', b.address ? esc(b.address) : dash],
      ['ქალაქი', b.city ? esc(b.city) : dash],
      ['ბიზნესის ტელეფონი', b.phone ? esc(b.phone) : dash],
      ['ვებსაიტი', site],
      ['სტატუსი აპში', badge(STATUS, b.status)],
    ]);
    const person = facts([
      ['ვინ', `<a href="#/users/${esc(u.id)}">${esc(u.name || '—')}</a>`],
      ['ტელეფონი', u.phone ? esc(u.phone) : '<span class="s-badge is-warn">არ აქვს</span>'],
      ['ელფოსტა', u.email ? esc(u.email) : dash],
      ['ანგარიში', `${when(u.since, 'date')}-დან`],
      ['როლი ბიზნესში', proof.position ? esc(POSITION[proof.position] || proof.position) : dash],
      ['განაცხადში მიუთითა', [proof.phone, proof.website].filter(Boolean).length ? esc([proof.phone, proof.website].filter(Boolean).join(' · ')) : dash],
    ]);
    const match = u.phone && b.phone && u.phone.replace(/\D/g, '').slice(-9) === b.phone.replace(/\D/g, '').slice(-9);
    const hint = c.status !== 'PENDING' ? '' : match
      ? `<span class="s-claim-hint is-ok">${ico('check')} განმცხადებლის ტელეფონი ბიზნესის ნომერს ემთხვევა</span>`
      : `<span class="s-claim-hint">${ico('info')} ტელეფონები არ ემთხვევა — ეჭვისას დაურეკე ბიზნესის ნომერზე</span>`;
    const actions = c.status === 'PENDING'
      ? `${hint}<span class="spacer"></span><button type="button" class="btn ghost" data-act="reject">უარყოფა</button><button type="button" class="btn primary" data-act="approve">${ico('check')} დადასტურება</button>`
      : `<span class="s-claim-hint">${esc(CLAIM[c.status]?.[0] || c.status)}${c.reviewedBy ? ` · ${esc(c.reviewedBy)}` : ''}${c.reviewedAt ? ` · ${when(c.reviewedAt)}` : ''}</span>`;
    return `<article class="s-card s-claim" data-claim="${esc(c.id)}">
      <header class="s-card-head"><div>
        <h3>${esc(b.name)}</h3>
        <p>${esc(KIND[c.kind] || c.kind)} · ${when(c.createdAt)}${proof.externalRef ? ' · რუკის ჩანაწერიდან' : ''}</p>
      </div><div class="s-card-actions">${badge(CLAIM, c.status)}</div></header>
      <div class="s-card-body s-claim-body">
        <section class="s-claim-col"><h4>ბიზნესი</h4>${place}</section>
        <section class="s-claim-col"><h4>განმცხადებელი</h4>${person}</section>
        ${c.note ? `<blockquote class="s-claim-note">${ico('message')}<span>${esc(c.note)}</span></blockquote>` : ''}
        ${c.reviewNote ? `<p class="s-claim-review"><b>პასუხი მფლობელს:</b> ${esc(c.reviewNote)}</p>` : ''}
      </div>
      <footer class="s-claim-foot">${actions}</footer>
    </article>`;
  }

  async function renderClaims(host) {
    host.innerHTML = skel();
    const [{ claims }, all] = await Promise.all([api(`/claims?status=${claimStatus}`), api('/claims?status=ALL')]);
    const counts = {};
    for (const c of all.claims) counts[c.status] = (counts[c.status] || 0) + 1;
    host.innerHTML = `<div class="s-stack s-claims">
      <div class="s-toolbar">${segment('სტატუსი', [['PENDING', 'განსახილველი', counts.PENDING], ['APPROVED', 'დადასტურებული', counts.APPROVED], ['REJECTED', 'უარყოფილი', counts.REJECTED], ['ALL', 'ყველა']], claimStatus, 'data-claim-status')}<span class="spacer"></span><button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button></div>
      ${claimStatus === 'PENDING' && claims.length ? `<div class="s-callout is-info">${ico('info')}<p><b>დადასტურებამდე შეამოწმე:</b> ემთხვევა თუ არა განმცხადებლის ტელეფონი ბიზნესის ნომერს, არის თუ არა ანგარიში ახალი, აქვს თუ არა ბიზნესს ვებსაიტი ან Instagram იმავე კონტაქტით. ეჭვის შემთხვევაში დაურეკე ბიზნესის ნომერზე. დადასტურებისთანავე მფლობელი პანელს მართავს და ბიზნესი აპში ჩნდება.</p></div>` : ''}
      ${claims.length ? `<div class="s-stack s-claims-list">${claims.map(claimCard).join('')}</div>` : emptyCard(claimStatus === 'PENDING' ? 'განსახილველი განაცხადი არ არის' : 'ამ სტატუსით არაფერია', claimStatus === 'PENDING' ? 'ახალი განაცხადი აქ გამოჩნდება; მფლობელი medicard.ge/business-იდან აგზავნის.' : '')}
    </div>`;
    host.querySelectorAll('[data-claim-status]').forEach((b) => { b.onclick = () => { claimStatus = b.dataset.claimStatus; renderClaims(host); }; });
    host.querySelector('[data-refresh]').onclick = () => renderClaims(host);
    host.querySelectorAll('[data-claim]').forEach((card) => {
      const c = claims.find((x) => x.id === card.dataset.claim);
      card.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => reviewClaim(c, b.dataset.act); });
    });
  }

  function editBusiness(b) {
    const dialog = V().openDialog?.({
      title: b ? `რედაქტირება · ${b.name}` : 'ადგილის დამატება',
      description: b ? 'ცვლილება აპში მაშინვე ჩანს. დადასტურებული ბიზნესის პანელი მფლობელს აქვს — აქ მხოლოდ გადაუდებელი შესწორება.' : 'კატალოგის ჩანაწერი, რომელსაც მფლობელი შემდეგ დაადასტურებს.',
      wide: true,
      body: `<form id="book-biz-form" class="s-stack" novalidate>
        <div class="s-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label class="s-field"><span>სახელი ქართულად</span><input name="nameKa" value="${esc(b?.name ?? '')}" required></label>
          <label class="s-field"><span>სახელი ლათინურად</span><input name="name" value="${esc(b?.nameEn ?? b?.name ?? '')}"></label>
          <label class="s-field"><span>კატეგორია</span><select name="category">${categories.map((c) => `<option value="${esc(c.id)}" ${c.id === (b?.category || 'DENTAL') ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
          <label class="s-field"><span>სტატუსი</span><select name="status">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === (b?.status || 'LISTED') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <label class="s-field"><span>ტელეფონი</span><input name="phone" value="${esc(b?.phone ?? '')}"></label>
          <label class="s-field"><span>ვებსაიტი</span><input name="website" value="${esc(b?.website ?? '')}"></label>
          <label class="s-field"><span>მისამართი</span><input name="addressKa" value="${esc(b?.address ?? '')}"></label>
          <label class="s-field"><span>ქალაქი</span><input name="city" value="${esc(b?.city ?? '')}"></label>
          <label class="s-field"><span>განედი (lat)</span><input name="lat" type="number" step="any" value="${esc(b?.lat ?? '')}" ${b ? '' : 'required'}></label>
          <label class="s-field"><span>გრძედი (lng)</span><input name="lng" type="number" step="any" value="${esc(b?.lng ?? '')}" ${b ? '' : 'required'}></label>
        </div>
        <label class="s-field"><span>აღწერა</span><textarea name="descriptionKa" rows="3" maxlength="2000">${esc(b?.description ?? '')}</textarea></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary" form="book-biz-form">შენახვა</button>`,
    });
    const form = $('book-biz-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const alertEl = panel.querySelector('[role=alert]');
      const data = Object.fromEntries(new FormData(form).entries());
      const body = { nameKa: data.nameKa.trim(), name: data.name.trim() || data.nameKa.trim(), category: data.category, status: data.status, phone: data.phone.trim(), website: data.website.trim(), addressKa: data.addressKa.trim(), address: data.addressKa.trim(), city: data.city.trim(), descriptionKa: data.descriptionKa.trim(), description: data.descriptionKa.trim() };
      if (data.lat && data.lng) { body.lat = Number(data.lat); body.lng = Number(data.lng); }
      if (!body.nameKa) { alertEl.textContent = 'სახელი სავალდებულოა.'; return; }
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        if (b) await api(`/businesses/${encodeURIComponent(b.id)}`, { method: 'PATCH', body });
        else await api('/businesses', { method: 'POST', body });
        V().setDirty?.(false);
        await dialog.close();
        toast(b ? 'შენახულია' : 'დაემატა', 'ok');
        await refreshAll();
      } catch (err) {
        alertEl.textContent = err.message || 'შეცდომა';
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  const ROLE = { OWNER: 'მფლობელი', MANAGER: 'მენეჯერი', STAFF: 'თანამშრომელი' };
  const DAYS = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
  /** One place in full: status, contact, hours, who has the panel, services and the team — read-only, edit beside it. */
  async function showBusiness(row) {
    let data;
    try { data = await api(`/businesses/${encodeURIComponent(row.id)}`); } catch (err) { toast(err.message || 'შეცდომა', 'error'); return; }
    const b = data.business || {};
    const members = data.members || [];
    const images = data.images || [];
    const hours = b.hours || {};
    const hoursLine = [1, 2, 3, 4, 5, 6, 0].map((d) => `${DAYS[d]} ${(hours[String(d)] || []).map((r) => `${r.from}–${r.to}`).join(', ') || '—'}`).join(' · ');
    const dialog = V().openDialog?.({
      title: b.name || row.name,
      wide: true,
      description: `${catLabel(b.category)}${b.address ? ` · ${b.address}` : ''}${b.city ? `, ${b.city}` : ''}`,
      body: `<div id="book-biz-detail" class="s-stack">
        <div class="s-metrics">
          ${metric('სტატუსი', (STATUS[b.status] || [b.status])[0], b.claimed ? 'მფლობელი მართავს' : 'მფლობელი არ არის')}
          ${metric('სერვისი', fmt((b.services || []).length), (b.services || []).filter((s) => s.online).length ? `${fmt((b.services || []).filter((s) => s.online).length)} ონლაინ` : '')}
          ${metric('გუნდი', fmt((b.staff || []).length), (b.staff || []).filter((p) => p.bookable).length ? `${fmt((b.staff || []).filter((p) => p.bookable).length)} იწერება` : '')}
          ${metric('შეფასება', b.rating != null ? Number(b.rating).toFixed(1) : '—', b.ratingCount ? `${fmt(b.ratingCount)} შეფასება` : 'ჯერ არ არის')}
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px">
          ${b.phone ? `<span>${ico('phone')} ${esc(b.phone)}</span>` : ''}${b.website ? `<span>${esc(b.website)}</span>` : ''}${b.instagram ? `<span>@${esc(b.instagram)}</span>` : ''}
          <span class="s-muted">აპში: medicard.ge/app/book/${esc(b.slug || '')}</span><span class="s-muted">${fmt(images.length)} სურათი</span>
        </div>
        <p class="s-muted" style="font-size:12.5px">${esc(hoursLine)}</p>
        ${members.length ? `<div><h4 style="margin:0 0 6px">პანელზე წვდომა</h4><table class="s-table"><tbody>${members.map((m) => `<tr><td><b>${esc(m.name || '—')}</b></td><td>${esc(ROLE[m.role] || m.role)}</td><td class="s-muted">${esc([m.phone, m.email].filter(Boolean).join(' · '))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="s-muted">პანელზე ჯერ არავის აქვს წვდომა — მფლობელი medicard.ge/business-იდან დაადასტურებს.</p>'}
        ${(b.services || []).length ? `<div><h4 style="margin:0 0 6px">სერვისები</h4><table class="s-table"><tbody>${b.services.slice(0, 12).map((s) => `<tr><td>${esc(s.name)}</td><td class="s-muted">${esc(s.group || '')}</td><td class="num">${fmt(s.durationMin)} წთ</td><td class="num">${s.price != null ? `${fmt(s.price)} ₾` : '—'}</td></tr>`).join('')}</tbody></table>${b.services.length > 12 ? `<p class="s-muted">… და კიდევ ${fmt(b.services.length - 12)}</p>` : ''}</div>` : ''}
        ${(b.staff || []).length ? `<p><b>გუნდი:</b> ${b.staff.map((p) => esc(p.name + (p.title ? ` (${p.title})` : ''))).join(', ')}</p>` : ''}
        ${b.description ? `<p class="s-muted">${esc(b.description)}</p>` : ''}
      </div>`,
      footer: '<button type="button" class="btn" data-cancel>დახურვა</button><button type="button" class="btn primary" data-edit>რედაქტირება</button>',
    });
    const panel = $('book-biz-detail')?.closest('.v3-dialog-panel');
    if (!panel) return;
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    panel.querySelector('[data-edit]').onclick = async () => { await dialog.close(); editBusiness(row); };
  }

  async function setStatus(b, status) {
    try {
      await api(`/businesses/${encodeURIComponent(b.id)}`, { method: 'PATCH', body: { status } });
      toast(`${b.name}: ${STATUS[status][0]}`, 'ok');
      await refreshAll();
    } catch (err) { toast(err.message || 'შეცდომა', 'error'); }
  }

  let catTimer = null;
  async function renderCatalog(host) {
    host.innerHTML = skel();
    const data = await api(`/businesses?status=${catStatus}&limit=150${catCategory ? `&category=${encodeURIComponent(catCategory)}` : ''}${catQuery ? `&q=${encodeURIComponent(catQuery)}` : ''}`);
    host.innerHTML = `<div class="s-stack s-cat-tools">
        <div class="s-toolbar">
          <label class="sx-search">${ico('search')}<span class="sr-only">ძებნა</span><input type="search" placeholder="სახელი, მისამართი, უბანი…" value="${esc(catQuery)}" data-cat-q autocomplete="off"></label>
          <select class="s-select" data-cat-category><option value="">ყველა კატეგორია</option>${categories.map((c) => `<option value="${esc(c.id)}" ${c.id === catCategory ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select>
          <span class="spacer"></span>
          <span class="s-funnel-meta">${fmt(data.total)} ადგილი</span>
          <button type="button" class="btn compact" data-add>${ico('plus')} დამატება</button>
        </div>
        <div class="s-toolbar">${segment('სტატუსი', [['ALL', 'ყველა'], ['CLAIMED', 'დადასტურებული'], ['PENDING', 'განიხილება'], ['LISTED', 'კატალოგში'], ['HIDDEN', 'დამალული']], catStatus, 'data-cat-status')}</div>
      </div>
      ${data.businesses.length ? `<div class="s-card"><div class="s-card-body is-flush"><table class="s-table"><thead><tr><th>ბიზნესი</th><th>კატეგორია</th><th>ქალაქი</th><th>სტატუსი</th><th>მფლობელი</th><th class="num">სერვისი</th><th class="num">გუნდი</th><th class="num">ჯავშანი 30 დღე</th><th class="num">ნახვა</th><th>წყარო</th><th></th></tr></thead><tbody>
        ${data.businesses.map((b) => `<tr data-biz="${esc(b.id)}">
          <td><b class="s-link" data-view-name style="cursor:pointer">${esc(b.name)}</b>${b.nameEn && b.nameEn !== b.name ? `<br><small class="s-muted">${esc(b.nameEn)}</small>` : ''}${b.address ? `<br><small class="s-muted">${esc(b.address)}</small>` : ''}</td>
          <td>${catDot(b.category)}${esc(catLabel(b.category))}</td>
          <td>${esc(b.city || '—')}${b.district ? `<br><small class="s-muted">${esc(b.district)}</small>` : ''}</td>
          <td>${badge(STATUS, b.status)}${b.ratingCount ? `<br><small class="s-muted">★ ${Number(b.ratingAvg).toFixed(1)} · ${fmt(b.ratingCount)}</small>` : ''}</td>
          <td>${b.ownerName ? `${esc(b.ownerName)}${b.ownerPhone ? `<br><small class="s-muted">${esc(b.ownerPhone)}</small>` : ''}` : '<span class="s-muted">—</span>'}</td>
          <td class="num">${fmt(b.services)}</td><td class="num">${fmt(b.staff)}</td><td class="num">${fmt(b.appointments30)}</td><td class="num">${fmt(b.viewCount)}</td>
          <td><small>${esc(SOURCE[b.source] || b.source)}</small></td>
          <td class="num"><div style="display:flex;gap:4px;justify-content:flex-end">
            <button type="button" class="btn ghost compact" data-view title="დეტალები">${ico('info')}</button>
            <button type="button" class="btn ghost compact" data-edit title="რედაქტირება">${ico('edit')}</button>
            ${b.status === 'HIDDEN' ? `<button type="button" class="btn ghost compact" data-status="LISTED" title="კატალოგში დაბრუნება">${ico('eye')}</button>` : b.status === 'LISTED' ? `<button type="button" class="btn ghost compact" data-status="HIDDEN" title="დამალვა">${ico('eyeOff')}</button>` : ''}
          </div></td>
        </tr>`).join('')}
      </tbody></table></div></div>` : emptyCard('ვერაფერი მოიძებნა', 'სცადე სხვა სიტყვა, კატეგორია ან სტატუსი.')}`;
    const q = host.querySelector('[data-cat-q]');
    q.oninput = () => { clearTimeout(catTimer); catTimer = setTimeout(() => { catQuery = q.value.trim(); renderCatalog(host).then(() => host.querySelector('[data-cat-q]')?.focus()); }, 320); };
    host.querySelector('[data-cat-category]').onchange = (e) => { catCategory = e.target.value; renderCatalog(host); };
    host.querySelectorAll('[data-cat-status]').forEach((b) => { b.onclick = () => { catStatus = b.dataset.catStatus; renderCatalog(host); }; });
    host.querySelector('[data-add]').onclick = () => editBusiness(null);
    host.querySelectorAll('[data-biz]').forEach((row) => {
      const b = data.businesses.find((x) => x.id === row.dataset.biz);
      row.querySelector('[data-view]').onclick = () => showBusiness(b);
      row.querySelector('[data-view-name]').onclick = () => showBusiness(b);
      row.querySelector('[data-edit]').onclick = () => editBusiness(b);
      row.querySelector('[data-status]')?.addEventListener('click', (e) => setStatus(b, e.currentTarget.dataset.status));
    });
  }

  /* ═════════════ გამოყენება — the usage page on the module kit ═════════════ */
  const K = global.AdminUsage;
  const { metrics, card, facts, shares, extras, empty, note, h4, warn, pct, share } = K;
  const LADDER = { catalogue: 'კატალოგშია', claimed: 'მფლობელი ჰყავს', ready: 'სერვისები და გუნდი აქვს', booked: 'ჯავშანი მიუღია', active: 'ჯავშანი ამ პერიოდში' };
  const PEOPLE = { viewed: 'გვერდი ნახა', booked: 'დაჯავშნა', came: 'მივიდა', returned: 'მეორედ დაჯავშნა' };
  const TRACK = [['services', 'სერვისები'], ['staff', 'გუნდი'], ['photos', 'ფოტო'], ['bookings', 'ჯავშნები'], ['reviews', 'შეფასებები'], ['modules', 'მოდულები']];
  const MODULES = { products: 'პროდუქტები', supplies: 'საწყობი', resources: 'ოთახები', memberships: 'აბონემენტები', cashback: 'ქეშბექი', sms: 'SMS' };
  const BIZ_SOURCE = { MAPBOX: 'რუკიდან', OSM: 'OpenStreetMap', OWNER: 'მფლობელმა დაარეგისტრირა', ADMIN: 'ადმინმა დაამატა', OTHER: 'სხვა' };
  const APPT_SOURCE = { APP: 'აპიდან', WEB: 'ვებიდან', BUSINESS: 'ბიზნესმა ჩაწერა' };
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';

  function bizCard(b) {
    const s = b.setup;
    const p = b.period;
    const l = b.lifetime;
    const seg = (n, title, max = 1) => ({ fill: n ? Math.max(18, Math.min(100, Math.round((n / max) * 100))) : 0, title });
    const modsOn = Object.entries(b.modules).filter(([k, v]) => v && MODULES[k]).map(([k]) => MODULES[k]);
    const parts = [
      p.bookings ? `${fmt(p.bookings)} ჯავშანი` : null,
      p.completed ? `${fmt(p.completed)} დასრულდა` : null,
      p.noShow ? `${fmt(p.noShow)} არ მოვიდა` : null,
      p.clients ? `${fmt(p.clients)} კლიენტი` : null,
      p.views ? `${fmt(p.views)} ნახვა${p.calls ? ` · ${fmt(p.calls)} ზარი` : ''}` : null,
    ].filter(Boolean);
    const idleLine = b.status === 'PENDING' ? 'ელოდება დადასტურებას — პანელი უკვე მუშაობს' : b.status === 'CLAIMED' ? (s.services ? 'ამ პერიოდში ჯავშანი არ ყოფილა' : 'სერვისები ჯერ არ დაუმატებია') : 'კატალოგშია — მფლობელი ჯერ არ არის';
    return K.itemCard({
      mark: initials(b.name),
      title: b.name,
      meta: [catLabel(b.category), b.city].filter(Boolean).join(' · '),
      badges: `${badge(STATUS, b.status)}${b.team ? '<span class="s-badge is-info">გუნდი</span>' : ''}${l.rating != null ? `<span class="s-badge is-plain">★ ${l.rating.toFixed(1)} · ${fmt(l.reviews)}</span>` : ''}`,
      track: K.track([
        seg(s.services, `სერვისი: ${fmt(s.services)}`, 8),
        seg(s.staff, `გუნდი: ${fmt(s.staff)} · ფოტო: ${fmt(s.photos)}`, 4),
        seg(s.photos, `ფოტო: ${fmt(s.photos)}`, 6),
        seg(p.bookings, `ჯავშანი ამ პერიოდში: ${fmt(p.bookings)} · სულ ${fmt(l.bookings)}`, 20),
        seg(l.reviews, `შეფასება: ${fmt(l.reviews)}${l.rating != null ? ` · ★ ${l.rating.toFixed(1)}` : ''}`, 10),
        seg(b.modulesOn, modsOn.length ? `მოდულები: ${modsOn.join(', ')}` : 'დამატებითი მოდული არ იყენებს', 6),
      ]),
      line: parts.length ? parts.join(' · ') : idleLine,
      idle: !parts.length,
      person: b.owner,
      personText: b.status === 'LISTED' ? `${esc(BIZ_SOURCE[b.source] || 'კატალოგი')}` : 'მფლობელი არ არის',
      foot: [b.claimedAt ? `დაადასტურა ${when(b.claimedAt, 'date')}` : `კატალოგში ${when(b.createdAt, 'date')}`, l.lastBookingAt ? `ბოლო ჯავშანი ${when(l.lastBookingAt, 'date')}` : 'ჯავშანი ჯერ არ ყოფილა'],
      dim: b.status === 'HIDDEN',
    });
  }

  const wall = K.createWall({
    title: 'ბიზნესები და რას აკეთებენ',
    sub: 'თითო ბარათი ერთი ბიზნესია. ზოლი აჩვენებს, რა აქვს მოწყობილი და რა ხდება: ანთებული — არის, ჩამქრალი — ჯერ არა. ჯერ დასადასტურებლები, მერე დადასტურებულები, ბოლოს კატალოგიდან ის, ვისაც ყურადღება მიაქცია.',
    legendLabels: TRACK.map(([, label]) => label),
    filters: [
      ['all', 'ყველა', (b) => b.status !== 'HIDDEN'],
      ['claimed', 'დადასტურებული', (b) => b.status === 'CLAIMED'],
      ['active', 'ჯავშნით', (b) => b.period.bookings > 0],
      ['idle', 'ჯავშნის გარეშე', (b) => b.status === 'CLAIMED' && !b.period.bookings],
      ['pending', 'განიხილება', (b) => b.status === 'PENDING'],
      ['listed', 'კატალოგი', (b) => b.status === 'LISTED'],
    ],
    search: (b) => `${b.name} ${b.city || ''} ${b.owner?.name || ''} ${b.owner?.contact || ''} ${catLabel(b.category)}`,
    placeholder: 'ბიზნესი, ქალაქი, კატეგორია ან მფლობელი',
    render: bizCard,
    emptyText: {
      all: 'ბიზნესი ჯერ არ არის.', claimed: 'დადასტურებული ბიზნესი ჯერ არ არის.', active: 'ამ პერიოდში ჯავშანი არავის მიუღია.',
      idle: 'ყველა დადასტურებულს ჰქონდა ჯავშანი — კარგია.', pending: 'განსახილველი ბიზნესი არ არის.', listed: 'კატალოგის ადგილებს ამ პერიოდში ყურადღება არ მიუქცევიათ.',
    },
    key: (b) => b.id,
  });

  function usageInsights(d) {
    const t = d.totals;
    const p = d.period;
    const q = d.quality;
    const rows = [];
    if (!t.inCatalogue && !t.pending) rows.push(['info', 'კატალოგი ცარიელია — ბიზნესები crawler-ით ან ხელით ემატება.']);
    else rows.push(['info', `კატალოგში <b>${fmt(t.inCatalogue)} ადგილია</b>, აქედან <b>${fmt(t.claimed)}</b> მფლობელმა დაადასტურა (${pct(share(t.claimed, t.inCatalogue))})${t.pending ? `, ${fmt(t.pending)} რეგისტრაცია განიხილება` : ''}.`]);
    if (t.claimsPending) rows.push(['warn', `<b>${fmt(t.claimsPending)} განაცხადი ელოდება</b> — მფლობელი პანელს ხედავს, მაგრამ აპში ბიზნესი ჯერ არ ჩანს. <a href="#/book?pane=claims" data-book-go="claims">განხილვა</a>.`]);
    if (p.bookings) rows.push(['ok', `ბოლო ${fmt(p.days)} დღეში <b>${fmt(p.bookings)} ჯავშანი</b> ${fmt(p.businesses)} ბიზნესში, ${fmt(p.people)} ადამიანისგან (${fmt(p.newClients)} პირველად). დასრულდა ${pct(share(p.completed, p.bookings))}, არ მოვიდა ${pct(share(p.noShow, p.bookings))}.`]);
    else rows.push(['warn', `ბოლო ${fmt(p.days)} დღეში ჯავშანი არ ყოფილა.`]);
    if (p.views) rows.push([p.bookings ? 'info' : 'warn', `აპში ბიზნესის გვერდი <b>${fmt(p.views)}-ჯერ</b> გაიხსნა${p.calls ? `, ${fmt(p.calls)} დარეკვა` : ''}${p.routes ? `, ${fmt(p.routes)} მარშრუტი` : ''}; აპიდან ${fmt(p.sources.APP || 0)} ჯავშანი მოვიდა${p.sources.WEB ? `, ვებიდან ${fmt(p.sources.WEB)}` : ''}.`]);
    if (t.claimed && t.idle) rows.push([share(t.idle, t.claimed) >= 50 ? 'warn' : 'info', `<b>${fmt(t.idle)} დადასტურებულ ბიზნესს</b> (${pct(share(t.idle, t.claimed))}) ამ პერიოდში ჯავშანი არ ჰქონია${q.noServices ? ` — ${fmt(q.noServices)}-ს სერვისი არც აქვს` : ''}.`]);
    if (q.claimed && (q.noPhotos || q.noHours)) rows.push(['info', `მოსაწყობია: ${[q.noPhotos ? `${fmt(q.noPhotos)}-ს ფოტო არ აქვს` : null, q.noHours ? `${fmt(q.noHours)}-ს სამუშაო საათები` : null, q.onlineOff ? `${fmt(q.onlineOff)}-ს ონლაინ ჯავშნა გამორთული აქვს` : null].filter(Boolean).join(', ')}.`]);
    if (!d.includeTeam && d.team.businesses) rows.push(['muted', `გუნდის ${fmt(d.team.accounts)} ანგარიშის ${fmt(d.team.businesses)} ბიზნესი (მათ შორის დემო კლინიკა) აქ არ ითვლება. „გუნდის ჩათვლით“ აჩვენებს.`]);
    return K.insights(rows);
  }

  function claimsBlock(d) {
    if (!d.claimsPending.length) return '';
    const rows = d.claimsPending.map((c) => `<li><span class="s-badge ${c.kind === 'REGISTER' ? 'is-info' : 'is-plain'}">${esc(KIND[c.kind] || c.kind)}</span><b>${esc(c.businessName)}</b><span class="s-muted">${esc(c.userName || '')}</span><span class="s-muted">${c.waitingDays ? `${fmt(c.waitingDays)} დღე ელოდება` : 'დღეს'}</span></li>`).join('');
    return card('ელოდება განხილვას', 'მფლობელი ჩანაწერს ხედავს, აპში ბიზნესი დადასტურებამდე არ ჩანს.', `<ul class="s-book-claims">${rows}</ul>
      <div class="s-book-claims-foot"><button type="button" class="btn compact" data-book-go="claims">${ico('check')} განაცხადების განხილვა</button></div>`);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    const src = Object.entries(p.sources || {}).map(([k, n]) => [APPT_SOURCE[k] || k, n]);
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('ჯავშანი', fmt(p.bookings), `${fmt(p.businesses)} ბიზნესში · ${fmt(p.cancelled)} გაუქმდა`),
        metric('დასრულდა', fmt(p.completed), p.bookings ? `${pct(share(p.completed, p.bookings))} · არ მოვიდა ${fmt(p.noShow)}` : '—', p.bookings && share(p.noShow, p.bookings) >= 20 ? 'warn' : ''),
        metric('ადამიანი ჯავშნით', fmt(p.people), `${fmt(p.newClients)} პირველად`),
        metric('გვერდის ნახვა აპში', fmt(p.views), `${fmt(p.calls)} დარეკვა · ${fmt(p.routes)} მარშრუტი`),
      ])}
      ${card('დღიური ტრენდი', 'ჯავშნები შექმნის დღით, დასრულებული ვიზიტები და ბიზნესის გვერდის ნახვები აპში.', K.chart([
        { label: 'ჯავშანი', tone: 'violet', points: p.trend.bookings },
        { label: 'დასრულდა', tone: 'teal', points: p.trend.completed },
        { label: 'ნახვა', tone: 'blue', points: p.trend.views },
      ], { label: 'MEDIBOOK დღეების მიხედვით', empty: 'ამ პერიოდში ჯავშანი და ნახვა არ ყოფილა.' }) + (src.length ? `${h4('საიდან მოდის ჯავშანი')}${shares(src, p.bookings)}` : ''))}`;
  }

  function compositionCard(d) {
    const c = d.composition;
    const total = d.totals.inCatalogue;
    if (!total) return card('კატალოგი', '', empty('კატალოგი ცარიელია.'));
    const cats = c.categories.map((x) => [`${catLabel(x.id)}${x.claimed ? ` · ${fmt(x.claimed)} დადასტურებული` : ''}`, x.count]);
    return card('კატალოგი', `${fmt(total)} ადგილი კატეგორიებით და ქალაქებით; „დადასტურებული“ — მფლობელი მართავს.`, `
      ${h4('კატეგორიები')}${shares(cats, total)}
      ${h4('ქალაქები')}${c.cities.length ? shares(c.cities.map((x) => [`${x.name}${x.claimed ? ` · ${fmt(x.claimed)} დადასტურებული` : ''}`, x.count]), total) : empty('ქალაქი არცერთ ადგილს არ აქვს.')}
      ${h4('საიდან არის კატალოგში')}${shares(c.sources.map((x) => [BIZ_SOURCE[x.id] || x.id, x.count]), total)}`);
  }

  function qualityCard(d) {
    const q = d.quality;
    const m = q.modules;
    if (!q.claimed) return card('დადასტურებული ბიზნესების მოწყობა', '', empty('დადასტურებული ბიზნესი ჯერ არ არის.'));
    const row = (label, n, good) => [label, n ? warn(n) : `<span class="s-ok">0</span>`, good];
    return card('დადასტურებული ბიზნესების მოწყობა', `${fmt(q.claimed)} ბიზნესი, რომელსაც მფლობელი მართავს — რა აკლია და რომელ მოდულს იყენებს.`, `
      ${h4('რა აკლია')}
      ${facts([
        ['სერვისი არ აქვს', q.noServices ? warn(q.noServices) : '0'],
        ['გუნდი არ ჰყავს', q.noStaff ? warn(q.noStaff) : '0'],
        ['ფოტო არ აქვს', q.noPhotos ? warn(q.noPhotos) : '0'],
        ['სამუშაო საათები არ აქვს', q.noHours ? warn(q.noHours) : '0'],
        ['ონლაინ ჯავშნა გამორთულია', q.onlineOff ? warn(q.onlineOff) : '0'],
        ['კატალოგში ქალაქის გარეშე', fmt(q.catalogueNoCity)],
      ])}
      ${h4('რომელ მოდულს იყენებს')}
      ${shares(Object.entries(MODULES).map(([k, label]) => [label, m[k] || 0]), q.claimed) || note('დამატებით მოდულს ჯერ არავინ იყენებს.')}
      ${note('მოდული „გამოყენებულია“, როცა ბიზნესს შესაბამისი ჩანაწერი აქვს: პროდუქტი, მასალა, ოთახი, აბონემენტი, ჩართული ქეშბექი ან SMS.')}`);
  }

  function paintUsage(d, ctx) {
    const t = d.totals;
    categories = d.categories || categories;
    wall.set(d.businesses, { total: d.businessesTotal });
    return `${K.flagCallout(d.flags.book, '<b>MEDIBOOK შეჩერებულია.</b> აპში კატალოგი და ჯავშნა არ ჩანს.')}
      ${usageInsights(d)}
      ${metrics([
        metric('კატალოგში', fmt(t.inCatalogue), `${fmt(t.listed)} საჯარო წყაროდან · ${fmt(t.hidden)} დამალული`),
        metric('დადასტურებული', fmt(t.claimed), `${fmt(t.owners)} მფლობელი · ${fmt(t.pending)} განიხილება`, t.claimsPending ? 'warn' : ''),
        metric(`ჯავშანი · ${fmt(d.period.days)} დღე`, fmt(d.period.bookings), `${fmt(d.period.businesses)} ბიზნესში`, true),
        metric('აქტიური ბიზნესი', fmt(t.active), t.claimed ? `დადასტურებულთა ${pct(share(t.active, t.claimed))} · ${fmt(t.idle)} ჯავშნის გარეშე` : '—'),
      ])}
      ${claimsBlock(d)}
      ${K.split(
        card('კატალოგიდან ცოცხალ ბიზნესამდე', 'რამდენი ადგილი გადის თითო საფეხურს.', K.ladder(d.ladder, LADDER, { first: 'ყველა ადგილი', unit: 'კატალოგიდან', emptyText: 'კატალოგი ცარიელია.' })),
        card('ადამიანი: ნახვიდან დაბრუნებამდე', `ბოლო ${fmt(d.period.days)} დღე — ვინც აპში გვერდი ნახა, დაჯავშნა, მივიდა და მეორედაც ჩაეწერა.`, K.ladder(d.peopleLadder, PEOPLE, { first: 'ვინც გვერდი ნახა', unit: 'ნახვიდან', emptyText: 'ამ პერიოდში აპში ბიზნესის გვერდი არავის უნახავს.' })),
      )}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(compositionCard(d), qualityCard(d))}
      ${K.definitions([
        '<b>კატალოგში</b> — საჯარო წყაროებიდან (რუკა, OpenStreetMap) ან ადმინის დამატებული ადგილები, რომლებიც აპში ჩანს. <b>დადასტურებული</b> — მფლობელმა განაცხადით დაადასტურა ან თვითონ დაარეგისტრირა და ადმინმა დაამოწმა; მხოლოდ მათ აქვთ ონლაინ ჯავშნა.',
        '<b>ჯავშანი</b> ითვლება შექმნის დღით (აპიდან, ვებიდან ან ბიზნესის პანელიდან), გაუქმებულები ცალკე. <b>მივიდა</b> — ვიზიტი დასრულებულად მოინიშნა. <b>მეორედ დაჯავშნა</b> — ამ პერიოდში დაჯავშნა და სულ ორი ჯავშანი მაინც აქვს.',
        '<b>გვერდი ნახა</b> — აპში ბიზნესის გვერდის გახსნა (ანონიმური ნახვის ჰეში, ანგარიში არ ინახება); დარეკვა და მარშრუტი — იმავე გვერდის ღილაკები.',
        '<b>გუნდი</b> — ბიზნესები, რომელთა მფლობელი ზუსტად @medicard.ge ანგარიშით შედის (დემო კლინიკა და თანამშრომლები). კლიენტების სახელები, შენიშვნები და ტელეფონები აქ არასდროს ჩანს.',
      ])}`;
  }

  function afterUsage(root, d) {
    wall.bind(root);
    root.querySelectorAll('[data-book-go]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); void global.renderBookHost?.select(b.dataset.bookGo, { fresh: true }); }));
    const claimsBtn = document.querySelector('#tab-book [data-uw-pane-btn="claims"]');
    if (claimsBtn) claimsBtn.innerHTML = `განაცხადები${d.totals.claimsPending ? ` <span class="s-badge is-warn">${fmt(d.totals.claimsPending)}</span>` : ''}`;
  }

  const renderBookUsage = K.page({ tab: 'book', path: '/book/usage', capability: 'BOOK_VIEW', paint: paintUsage, after: afterUsage });

  /* ═════════════ page tabs ═════════════ */
  const pane = (key) => document.querySelector(`#tab-book [data-uw-pane="${key}"]`);
  async function ensureCategories() {
    if (categories.length) return;
    try { categories = (await api('/overview')).categories || []; } catch { categories = []; }
  }
  async function refreshAll() {
    const host = global.renderBookHost;
    if (!host) return;
    await host.select(host.active?.() || 'claims', { fresh: true });
    void renderBookUsage({ keepScroll: true });
  }
  global.renderBookHost = K.hostTabs({
    tab: 'book',
    label: 'MEDIBOOK-ის განყოფილებები',
    panes: [
      ['usage', 'გამოყენება', renderBookUsage, 'page'],
      ['claims', 'განაცხადები', async () => { await ensureCategories(); const h = pane('claims'); if (h) await renderClaims(h); }, 'legacy'],
      ['catalog', 'კატალოგი', async () => { await ensureCategories(); const h = pane('catalog'); if (h) await renderCatalog(h); }, 'legacy'],
    ],
  });
  global.renderBookAdmin = () => global.renderBookHost();
  global.renderBookUsage = renderBookUsage;
})(window);
