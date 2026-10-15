/**
 * MediCard Admin V4 — #/book MEDIBOOK (/api/admin/book).
 * The claims queue (owners proving a listed place is theirs, new registrations), the catalogue (search,
 * list / hide, edit, add a place) and the numbers: how many places, how many claimed, bookings, favourites,
 * what people do with listings. Only public business facts and counts — never a client's note.
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
  const VIEWS = [['claims', 'განაცხადები'], ['catalog', 'კატალოგი'], ['numbers', 'რიცხვები']];
  let view = 'claims';
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
        await render();
      } catch (err) {
        alertEl.textContent = err.message || 'შეცდომა';
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  function claimCard(c) {
    const proof = c.proof || {};
    const lines = [
      `<span>${esc(KIND[c.kind] || c.kind)}</span>`,
      proof.position ? `<span>როლი: ${esc(POSITION[proof.position] || proof.position)}</span>` : '',
      proof.phone ? `<span>ტელ.: ${esc(proof.phone)}</span>` : '',
      proof.website ? `<span>${esc(proof.website)}</span>` : '',
      proof.externalRef ? '<span class="s-badge is-plain">რუკიდან</span>' : '',
    ].filter(Boolean).join('');
    const actions = c.status === 'PENDING'
      ? `<button type="button" class="btn compact" data-act="approve">${ico('check')} დადასტურება</button><button type="button" class="btn ghost compact" data-act="reject">უარყოფა</button>`
      : `<small class="s-muted">${esc(c.reviewedBy || '')} · ${when(c.reviewedAt)}</small>`;
    return `<article class="s-card" data-claim="${esc(c.id)}">
      <header class="s-card-head"><div>
        <h3 style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${esc(c.business.name)} ${badge(CLAIM, c.status)} ${badge(STATUS, c.business.status)}</h3>
        <p>${catDot(c.business.category)}${esc(catLabel(c.business.category))}${c.business.address ? ` · ${esc(c.business.address)}` : ''}${c.business.city ? `, ${esc(c.business.city)}` : ''}${c.business.phone ? ` · ${esc(c.business.phone)}` : ''}${c.business.website ? ` · ${esc(c.business.website)}` : ''}</p>
      </div><div class="s-card-actions">${actions}</div></header>
      <div class="s-card-body">
        <div class="s-meta-row" style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--s-text-2)">${lines}</div>
        <div class="s-meta-row" style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;margin-top:8px">
          <span>განმცხადებელი: <a href="#/users/${esc(c.user.id)}"><b>${esc(c.user.name || '—')}</b></a></span>
          ${c.user.phone ? `<span>${esc(c.user.phone)}</span>` : '<span class="s-badge is-warn">ტელეფონი არ აქვს</span>'}
          ${c.user.email ? `<span>${esc(c.user.email)}</span>` : ''}
          <span class="s-muted">ანგარიში ${when(c.user.since, 'date')}-დან</span>
          <span class="s-muted">განაცხადი ${when(c.createdAt)}</span>
        </div>
        ${c.note ? `<p style="margin-top:10px">${ico('message')} ${esc(c.note)}</p>` : ''}
        ${c.reviewNote ? `<p class="s-muted" style="margin-top:6px">პასუხი: ${esc(c.reviewNote)}</p>` : ''}
      </div>
    </article>`;
  }

  async function renderClaims(host) {
    host.innerHTML = skel();
    const [{ claims }, all] = await Promise.all([api(`/claims?status=${claimStatus}`), api('/claims?status=ALL')]);
    const counts = {};
    for (const c of all.claims) counts[c.status] = (counts[c.status] || 0) + 1;
    host.innerHTML = `<div class="s-toolbar">${segment('სტატუსი', [['PENDING', 'განსახილველი', counts.PENDING], ['APPROVED', 'დადასტურებული', counts.APPROVED], ['REJECTED', 'უარყოფილი', counts.REJECTED], ['ALL', 'ყველა']], claimStatus, 'data-claim-status')}<span class="spacer"></span><button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button></div>
      <p class="s-flags-note">${ico('info')}<span>დადასტურებამდე შეამოწმე: ემთხვევა თუ არა განმცხადებლის ტელეფონი ბიზნესის ნომერს, არის თუ არა ანგარიში ახალი, აქვს თუ არა ბიზნესს ვებსაიტი/Instagram იმავე კონტაქტით. ეჭვის შემთხვევაში დაურეკე ბიზნესის ნომერზე.</span></p>
      ${claims.length ? `<div class="s-stack">${claims.map(claimCard).join('')}</div>` : emptyCard(claimStatus === 'PENDING' ? 'განსახილველი განაცხადი არ არის' : 'ამ სტატუსით არაფერია', claimStatus === 'PENDING' ? 'ახალი განაცხადი აქ გამოჩნდება; მფლობელი medicard.ge/business-იდან აგზავნის.' : '')}`;
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
        await render();
      } catch (err) {
        alertEl.textContent = err.message || 'შეცდომა';
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  async function setStatus(b, status) {
    try {
      await api(`/businesses/${encodeURIComponent(b.id)}`, { method: 'PATCH', body: { status } });
      toast(`${b.name}: ${STATUS[status][0]}`, 'ok');
      await render();
    } catch (err) { toast(err.message || 'შეცდომა', 'error'); }
  }

  let catTimer = null;
  async function renderCatalog(host) {
    host.innerHTML = skel();
    const data = await api(`/businesses?status=${catStatus}&limit=150${catCategory ? `&category=${encodeURIComponent(catCategory)}` : ''}${catQuery ? `&q=${encodeURIComponent(catQuery)}` : ''}`);
    host.innerHTML = `<div class="s-toolbar s-flags-tools">
        <label class="sx-search">${ico('search')}<span class="sr-only">ძებნა</span><input type="search" placeholder="სახელი, მისამართი, უბანი…" value="${esc(catQuery)}" data-cat-q autocomplete="off"></label>
        <select class="s-select" data-cat-category><option value="">ყველა კატეგორია</option>${categories.map((c) => `<option value="${esc(c.id)}" ${c.id === catCategory ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select>
        ${segment('სტატუსი', [['ALL', 'ყველა'], ['CLAIMED', 'დადასტურებული'], ['PENDING', 'განიხილება'], ['LISTED', 'კატალოგში'], ['HIDDEN', 'დამალული']], catStatus, 'data-cat-status')}
        <span class="spacer"></span>
        <span class="s-funnel-meta">${fmt(data.total)} ადგილი</span>
        <button type="button" class="btn compact" data-add>${ico('plus')} დამატება</button>
      </div>
      ${data.businesses.length ? `<div class="s-card"><div class="s-card-body is-flush"><table class="s-table"><thead><tr><th>ბიზნესი</th><th>კატეგორია</th><th>ქალაქი</th><th>სტატუსი</th><th>მფლობელი</th><th class="num">სერვისი</th><th class="num">გუნდი</th><th class="num">ჯავშანი 30 დღე</th><th class="num">ნახვა</th><th>წყარო</th><th></th></tr></thead><tbody>
        ${data.businesses.map((b) => `<tr data-biz="${esc(b.id)}">
          <td><b>${esc(b.name)}</b>${b.nameEn && b.nameEn !== b.name ? `<br><small class="s-muted">${esc(b.nameEn)}</small>` : ''}${b.address ? `<br><small class="s-muted">${esc(b.address)}</small>` : ''}</td>
          <td>${catDot(b.category)}${esc(catLabel(b.category))}</td>
          <td>${esc(b.city || '—')}${b.district ? `<br><small class="s-muted">${esc(b.district)}</small>` : ''}</td>
          <td>${badge(STATUS, b.status)}${b.ratingCount ? `<br><small class="s-muted">★ ${Number(b.ratingAvg).toFixed(1)} · ${fmt(b.ratingCount)}</small>` : ''}</td>
          <td>${b.ownerName ? `${esc(b.ownerName)}${b.ownerPhone ? `<br><small class="s-muted">${esc(b.ownerPhone)}</small>` : ''}` : '<span class="s-muted">—</span>'}</td>
          <td class="num">${fmt(b.services)}</td><td class="num">${fmt(b.staff)}</td><td class="num">${fmt(b.appointments30)}</td><td class="num">${fmt(b.viewCount)}</td>
          <td><small>${esc(SOURCE[b.source] || b.source)}</small></td>
          <td class="num"><div style="display:flex;gap:4px;justify-content:flex-end">
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
      row.querySelector('[data-edit]').onclick = () => editBusiness(b);
      row.querySelector('[data-status]')?.addEventListener('click', (e) => setStatus(b, e.currentTarget.dataset.status));
    });
  }

  async function renderNumbers(host, overview) {
    const o = overview;
    const cats = Object.entries(o.byCategory || {}).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...cats.map(([, n]) => n));
    host.innerHTML = `<div class="s-card"><header class="s-card-head"><div><h3>კატალოგი</h3><p>რამდენი ადგილია და რამდენი დაადასტურა მფლობელმა.</p></div></header>
      <div class="s-card-body"><div class="s-metrics">
        ${metric('კატალოგში', fmt(o.businesses.listed), 'საჯარო წყაროებიდან')}
        ${metric('დადასტურებული', fmt(o.businesses.claimed), 'მფლობელი მართავს, ონლაინ ჯავშნა')}
        ${metric('განიხილება', fmt(o.businesses.pending), `${fmt(o.claims.pending)} განსახილველი განაცხადი`)}
        ${metric('დამალული', fmt(o.businesses.hidden), '')}
      </div></div></div>
      <div class="s-card"><header class="s-card-head"><div><h3>ჯავშნები</h3><p>ყველა დადასტურებული ბიზნესის ჯამი.</p></div></header>
      <div class="s-card-body"><div class="s-metrics">
        ${metric('სულ', fmt(o.appointments.total), `${fmt(o.appointments.week)} ამ კვირაში`)}
        ${metric('მომავალი', fmt(o.appointments.upcoming), '')}
        ${metric('დასრულებული', fmt(o.appointments.completed), `${fmt(o.appointments.noShow)} არ მოვიდა · ${fmt(o.appointments.cancelled)} გაუქმდა`)}
        ${metric('ადამიანი ჯავშნით', fmt(o.appointments.people), `${fmt(o.favorites.people)} ადამიანს აქვს რჩეული (${fmt(o.favorites.n)})`)}
      </div></div></div>
      <div class="s-card"><header class="s-card-head"><div><h3>აპიდან · 7 დღე</h3><p>რას აკეთებენ ადამიანები ბიზნესის გვერდზე.</p></div></header>
      <div class="s-card-body"><div class="s-metrics">${metric('გვერდი გაიხსნა', fmt(o.week.views), '')}${metric('დარეკვა', fmt(o.week.calls), '')}${metric('მარშრუტი', fmt(o.week.routes), '')}</div></div></div>
      <div class="s-card"><header class="s-card-head"><div><h3>კატეგორიები</h3><p>კატალოგი + დადასტურებული, კატეგორიებით.</p></div></header>
      <div class="s-card-body">${cats.length ? cats.map(([id, n]) => `<div class="s-meter"><div class="s-meter-top"><span>${catDot(id)}${esc(catLabel(id))}</span><b>${fmt(n)}</b></div><div class="s-meter-track"><span style="width:${Math.round((n / max) * 100)}%;background:${esc(categories.find((c) => c.id === id)?.color || 'var(--s-accent)')}"></span></div></div>`).join('') : '<p class="s-muted">კატალოგი ცარიელია — გაუშვი server/scripts/medibook-crawl.mjs და დეპლოი.</p>'}</div></div>
      ${o.recent?.length ? `<div class="s-card"><header class="s-card-head"><div><h3>ბოლო ჯავშნები</h3><p>სერვისი და ადგილი — კლიენტის სახელი აქ არ ჩანს.</p></div></header><div class="s-card-body is-flush"><table class="s-table"><thead><tr><th>როდის</th><th>ბიზნესი</th><th>სერვისი</th><th>სტატუსი</th><th>წყარო</th><th>შეიქმნა</th></tr></thead><tbody>
        ${o.recent.map((r) => `<tr><td>${when(r.startsAt)}</td><td>${esc(r.businessName)}</td><td>${esc(r.serviceName)}</td><td>${esc(APPT[r.status] || r.status)}</td><td>${r.source === 'APP' ? 'აპი' : r.source === 'WEB' ? 'ვები' : 'ხელით'}</td><td class="s-muted">${when(r.createdAt)}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}`;
  }

  async function render() {
    const root = $('tab-book');
    if (!root) return;
    if (!root.querySelector('[data-book-page]')) root.innerHTML = skel();
    let overview;
    try { overview = await api('/overview'); } catch (err) {
      root.innerHTML = `<div class="s-card"><div class="s-empty" role="alert">${ico('alert')}<strong>მონაცემები ვერ ჩაიტვირთა</strong><span>${esc(err?.status === 403 ? 'შენს ანგარიშს არ აქვს ამ გვერდის ნახვის უფლება (BOOK_VIEW).' : err.message || 'სერვერმა პასუხი ვერ დააბრუნა.')}</span><button type="button" class="btn compact" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = () => void render();
      return;
    }
    if (overview.installed === false) { root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('info')}<strong>MEDIBOOK-ის ცხრილები ბაზაში ჯერ არ არის</strong><span>სქემა შემდეგი დეპლოისას დაყენდება (install-medibook.mjs).</span></div></div>`; return; }
    categories = overview.categories || [];
    root.innerHTML = `<div class="s-stack v3-tab-shell" data-book-page>
      ${overview.claims.pending ? `<div class="s-callout is-warn">${ico('alert')}<p><b>${fmt(overview.claims.pending)} განაცხადი ელოდება განხილვას.</b> მფლობელი პანელს ხედავს, მაგრამ კატალოგში დადასტურებამდე არ ჩანს.</p></div>` : ''}
      <div class="s-tabbar">${segment('ხედი', VIEWS.map(([k, l]) => [k, l, k === 'claims' ? overview.claims.pending : 0]), view, 'data-book-view')}</div>
      <div data-book-host></div>
    </div>`;
    root.querySelectorAll('[data-book-view]').forEach((b) => { b.onclick = () => { view = b.dataset.bookView; render(); }; });
    const host = root.querySelector('[data-book-host]');
    if (view === 'claims') await renderClaims(host);
    else if (view === 'catalog') await renderCatalog(host);
    else await renderNumbers(host, overview);
  }

  global.renderBookAdmin = render;
})(window);
