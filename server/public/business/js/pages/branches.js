// MEDIBOOK business panel — branches: the chain's locations, add one from this business, link another, copy services, compare.
import { h, mount, icon, button, pageHead, card, input, field, busy, openModal, confirmDialog, badge, segmented, toggle, debounce } from '/app/js/ui.js';
import { get } from '/app/js/api.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, pct, emptyBox, fail, ok, avatar, phoneText } from '../shared.js';
import { state, loadState, switchBusiness, isOwner } from '../state.js';

const STATUS = { CLAIMED: [t('ჩართულია', 'Live'), 'ok'], PENDING: [t('განიხილება', 'Under review'), 'warn'], LISTED: [t('კატალოგში', 'Listed'), 'neutral'], HIDDEN: [t('დამალულია', 'Hidden'), 'neutral'] };

export default async function branchesPage(root, ctx) {
  const host = h('div');
  let range = '30';

  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const data = await biz.get('/branches');
      const me = state.current?.business?.id;
      const others = data.branches.filter((b) => b.id !== me);
      const owner = isOwner();
      const linkable = state.memberships.filter((m) => m.role === 'OWNER' && m.business.id !== me && !data.branches.some((b) => b.id === m.business.id));
      const actions = owner ? [button(t('ფილიალის დამატება', 'Add a branch'), { icon: 'plus', onClick: addDialog }), linkable.length ? button(t('არსებულის მიბმა', 'Link an existing one'), { variant: 'secondary', icon: 'link', onClick: () => linkDialog(linkable) }) : null] : [];
      if (!others.length) {
        mount(host, card(emptyBox(t('ჯერ ერთი ლოკაციაა', 'One location so far'),
          t('მეორე ფილიალი ერთი ღილაკით — კონტაქტი, კატეგორია, საათები და სერვისები აქედან გადადის, აპში მაშინვე ჩანს. თითოეულ ფილიალს თავისი კალენდარი, გუნდი და ფული აქვს; აქ ერთად ადარებ.', 'A second branch with one button — contacts, category, hours and services carry over and it is live in the app at once. Every branch keeps its own calendar, team and money; here you compare them.'),
          actions.length ? h('div', { class: 'bz-inline' }, actions) : null)));
        return;
      }
      const cards = h('div', { class: 'bz-branches' }, data.branches.map((b) => h('div', { class: `bz-branch${b.id === me ? ' is-current' : ''}` },
        h('div', { class: 'bz-inline' }, avatar(b.name, 'var(--brand)', 36), h('div', { style: { flex: 1, minWidth: 0 } }, h('b', null, b.name), h('div', { class: 'faint' }, [b.address, b.phone ? phoneText(b.phone) : null].filter(Boolean).join(' · ') || '—')), badge(STATUS[b.status]?.[0] || b.status, STATUS[b.status]?.[1] || 'neutral')),
        h('div', { class: 'bz-branch-foot' },
          b.id === me ? h('span', { class: 'faint' }, t('ეს ფილიალი ღიაა', 'This branch is open')) : button(t('გახსნა', 'Open'), { size: 'sm', variant: 'secondary', onClick: () => { switchBusiness(b.id); ctx.refreshShell?.(); ctx.navigate('/'); } }),
          h('span', { class: 'spacer' }),
          b.id !== me ? button(t('სერვისები აქედან', 'Copy services here'), { size: 'sm', variant: 'ghost', icon: 'copy', title: t('ამ ბიზნესის სერვისები ფილიალში გადავა (ახალი სახელები)', 'This business\'s services go to the branch (new names only)'), onClick: async () => { try { const r = await biz.post(`/branches/${b.id}/copy-services`, {}); ok(t(`${r.copied} სერვისი გადავიდა`, `${r.copied} services copied`)); } catch (e) { fail(e); } } }) : null,
          b.id !== me && owner ? button('', { size: 'sm', variant: 'ghost', icon: 'x', ariaLabel: t('ქსელიდან გათიშვა', 'Unlink'), onClick: async () => { if (await confirmDialog({ title: t('ქსელიდან გათიშვა?', 'Unlink from the chain?'), body: t(`${b.name} ცალკე ბიზნესად დარჩება — არაფერი იშლება.`, `${b.name} stays a separate business — nothing is deleted.`), confirm: t('გათიშვა', 'Unlink') })) { try { await biz.del(`/branches/${b.id}`); await loadState(); ctx.refreshShell?.(); paint(); } catch (e) { fail(e); } } } }) : null))));
      const compare = h('div');
      const paintCompare = async () => {
        mount(compare, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' })));
        try {
          const a = await biz.get('/branches/analytics', { range });
          mount(compare, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
            h('thead', null, h('tr', null, h('th', null, t('ფილიალი', 'Branch')), h('th', { class: 'num' }, t('ჯავშნები', 'Bookings')), h('th', { class: 'num' }, t('დასრულდა', 'Completed')), h('th', { class: 'num' }, t('გაცდენა', 'No-show')), h('th', { class: 'num' }, t('დატვირთვა', 'Utilisation')), h('th', { class: 'num' }, t('შემოსავალი', 'Revenue')), h('th', { class: 'num' }, t('საშ. ჩეკი', 'Avg ticket')), h('th', { class: 'num' }, t('ახალი კლიენტი', 'New clients')), h('th', { class: 'num' }, t('შეფასება', 'Rating')))),
            h('tbody', null, a.branches.map((b) => h('tr', { class: b.id === me ? 'is-strong' : '' },
              h('td', null, h('b', null, b.name)),
              h('td', { class: 'num' }, String(b.bookings)), h('td', { class: 'num' }, String(b.completed)), h('td', { class: 'num' }, pct(b.noShowRate)), h('td', { class: 'num' }, b.utilisation == null ? '—' : pct(b.utilisation)),
              h('td', { class: 'num' }, h('b', null, gel(b.revenue))), h('td', { class: 'num' }, b.averageTicket == null ? '—' : gel(b.averageTicket)), h('td', { class: 'num' }, String(b.newClients)), h('td', { class: 'num' }, b.reviews == null ? '—' : String(b.reviews)))),
              h('tr', { class: 'is-total' }, h('td', null, h('b', null, t('სულ', 'Total'))), h('td', { class: 'num' }, String(a.totals.bookings)), h('td', { class: 'num' }, String(a.totals.completed)), h('td', { class: 'num' }, ''), h('td', { class: 'num' }, ''), h('td', { class: 'num' }, h('b', null, gel(a.totals.revenue))), h('td', { class: 'num' }, ''), h('td', { class: 'num' }, String(a.totals.newClients)), h('td', { class: 'num' }, ''))))));
        } catch (e) { mount(compare, h('p', { class: 'bz-sub' }, e?.message || '')); }
      };
      mount(host, h('div', { class: 'bz-stack' },
        h('div', { class: 'bz-inline', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' } }, h('div', { class: 'faint' }, t(`${data.branches.length} ფილიალი · ${data.group?.name || ''}`, `${data.branches.length} branches · ${data.group?.name || ''}`)), h('div', { class: 'bz-inline' }, actions)),
        cards,
        card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('ფილიალები ერთმანეთის გვერდით', 'Branches side by side')), h('div', { class: 'card-sub' }, t('ერთი პერიოდი, ყველა ლოკაცია.', 'One period, every location.'))),
          segmented([{ value: '7', label: t('7 დღე', '7 days') }, { value: '30', label: t('30 დღე', '30 days') }, { value: '90', label: t('90 დღე', '90 days') }], range, (v) => { range = v; paintCompare(); })),
          compare)));
      paintCompare();
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  /** A new location from this one: name, phone, the address found on the map, what to copy. */
  function addDialog() {
    const cur = state.current?.business;
    const nameKa = input({ value: cur ? `${cur.name} — ` : '', placeholder: t('მაგ. ლილე — ვაკე', 'e.g. Lile — Vake') });
    const name = input({ placeholder: t('ლათინურად (არასავალდებულო)', 'In Latin letters (optional)') });
    const phone = input({ type: 'tel', placeholder: t('ფილიალის ტელეფონი', 'Branch phone') });
    const address = input({ placeholder: t('ქუჩა და ნომერი — რუკაზე მოიძებნება', 'Street and number — found on the map'), autocomplete: 'off' });
    const geoList = h('div', { class: 'bz-geo-list' });
    const found = h('div', { class: 'bz-note' });
    let place = null;
    const geocode = debounce(async () => {
      const term = address.value.trim();
      place = null;
      found.textContent = '';
      if (term.length < 4) { mount(geoList); return; }
      try {
        const { results } = await get('/api/business/geocode', { q: term });
        mount(geoList, results.slice(0, 5).map((r) => h('button', { type: 'button', onClick: () => { place = r; address.value = r.label; found.textContent = t(`მოიძებნა: ${r.label}${r.city ? ` · ${r.city}` : ''}`, `Found: ${r.label}${r.city ? ` · ${r.city}` : ''}`); mount(geoList); } }, icon('mapPin', { size: 14 }), ' ', r.label)));
      } catch { mount(geoList); }
    }, 350);
    address.addEventListener('input', geocode);
    let copyServices = true;
    let copyHours = true;
    const err = h('div', { class: 'form-error', hidden: true });
    const create = button(t('ფილიალის შექმნა', 'Create the branch'), { icon: 'check' });
    const m = openModal({
      title: t('ახალი ფილიალი', 'New branch'),
      body: h('div', { class: 'form' },
        h('p', { class: 'muted' }, t('კატეგორია, აღწერა, კონტაქტები და პარამეტრები აქედან გადადის; ფილიალი აპში მაშინვე ჩანს. პინი და საათები მერე პარამეტრებში დააზუსტე.', 'Category, description, contacts and settings carry over; the branch is live in the app at once. Refine the pin and hours in its Settings afterwards.')),
        field(t('სახელი ქართულად', 'Name in Georgian'), nameKa), field(t('სახელი ლათინურად', 'Name in Latin letters'), name),
        field(t('ტელეფონი', 'Phone'), phone),
        field(t('მისამართი', 'Address'), address), geoList, found,
        h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, t('სერვისების კოპირება', 'Copy the services')), h('div', { class: 'faint' }, t('ფასებითა და ხანგრძლივობით', 'With prices and durations'))), toggle(true, (on) => { copyServices = on; })),
        h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, t('სამუშაო საათების კოპირება', 'Copy the opening hours'))), toggle(true, (on) => { copyHours = on; })),
        err),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), create],
    });
    create.addEventListener('click', () => busy(create, async () => {
      err.hidden = true;
      if (!nameKa.value.trim()) { err.textContent = t('მიუთითე სახელი.', 'Enter the name.'); err.hidden = false; return; }
      if (!place) { err.textContent = t('აირჩიე მისამართი სიიდან — რუკაზე ასე დადგება.', 'Pick the address from the list — that places it on the map.'); err.hidden = false; return; }
      try {
        const r = await biz.post('/branches', { nameKa: nameKa.value.trim(), name: name.value.trim() || undefined, phone: phone.value.trim() || undefined, address: place.label, city: place.city || undefined, district: place.district || undefined, lat: place.lat, lng: place.lng, copyServices, copyHours });
        m.close();
        ok(t('ფილიალი შეიქმნა', 'Branch created'));
        await loadState();
        switchBusiness(r.business.id);
        ctx.refreshShell?.();
        ctx.navigate('/settings');
      } catch (e) { err.textContent = e?.message || t('ვერ შეიქმნა.', 'Could not create it.'); err.hidden = false; }
    }));
  }

  function linkDialog(linkable) {
    const list = h('div', { class: 'bz-geo-list' }, linkable.map((mm) => h('button', { type: 'button', onClick: async () => { try { await biz.post('/branches/link', { businessId: mm.business.id }); dlg.close(); ok(t('მიბმულია', 'Linked')); await loadState(); ctx.refreshShell?.(); paint(); } catch (e) { fail(e); } } }, icon('store', { size: 14 }), ' ', mm.business.name)));
    const dlg = openModal({ title: t('არსებული ბიზნესის მიბმა', 'Link an existing business'), size: 'sm', body: h('div', { class: 'form' }, h('p', { class: 'muted' }, t('შენი სხვა ბიზნესები — აირჩიე, რომელიც ამ ქსელის ფილიალია.', 'Your other businesses — pick the one that is a branch of this chain.')), list), footer: (close) => [button(t('დახურვა', 'Close'), { variant: 'ghost', onClick: () => close() })] });
  }

  mount(root,
    pageHead(t('ფილიალები', 'Branches'), t('ერთი ბრენდი, რამდენიმე ლოკაცია: თითოეულს თავისი კალენდარი, გუნდი და ფული აქვს, აპში კლიენტი უახლოესს ხედავს.', 'One brand, several locations: each keeps its own calendar, team and money; in the app the client sees the nearest.')),
    host);
  await paint();
}
