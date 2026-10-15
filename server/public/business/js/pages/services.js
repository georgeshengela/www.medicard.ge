// MEDIBOOK business panel — services: what can be booked, with price, duration and who performs it.
import { h, mount, icon, button, pageHead, card, input, textarea, field, busy, openModal, confirmDialog, toggle, badge } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, minutes, emptyBox, fail, ok, debounceFn } from '../shared.js';
import { canManage } from '../state.js';
import { chips, filterBar } from '../lists.js';

export default async function servicesPage(root) {
  const host = h('div');
  const chipsHost = h('div');
  const groupHost = h('div');
  const count = h('span', { class: 'bz-filters-count' });
  const manage = canManage();
  let q = '';
  let online = '';
  let group = '';
  let cache = null;

  async function paint(fresh = true) {
    if (fresh || !cache) {
      mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
      try { const [{ services }, { staff }] = await Promise.all([biz.get('/services'), biz.get('/staff')]); cache = { services, staff }; } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); return; }
    }
    try {
      const { services, staff } = cache;
      const everything = services.filter((s) => s.active);
      const term = q.trim().toLowerCase();
      const groupsAll = [...new Set(everything.map((s) => s.group || ''))].filter(Boolean);
      mount(chipsHost, chips([['', t('ყველა', 'All'), everything.length], ['on', t('ონლაინ', 'Online'), everything.filter((s) => s.online).length], ['off', t('მხოლოდ ადგილზე', 'On site only'), everything.filter((s) => !s.online).length]], online, (v) => { online = v; paint(false); }));
      mount(groupHost, groupsAll.length > 1 ? chips([['', t('ყველა ჯგუფი', 'Every group')], ...groupsAll.map((g) => [g, g, everything.filter((s) => (s.group || '') === g).length])], group, (v) => { group = v; paint(false); }) : null);
      const active = everything.filter((s) => (online === 'on' ? s.online : online === 'off' ? !s.online : true) && (!group || (s.group || '') === group) && (!term || `${s.name} ${s.nameEn || ''} ${s.group || ''} ${s.description || ''}`.toLowerCase().includes(term)));
      count.textContent = t(`${active.length} სერვისი`, `${active.length} ${active.length === 1 ? 'service' : 'services'}`);
      if (!everything.length) { mount(host, card(emptyBox(t('სერვისები ჯერ არ არის', 'No services yet'), t('აპში სწორედ სერვისები ჩანს „ჩაწერა“-ს ღილაკით. დაამატე პირველი — სახელი, ხანგრძლივობა, ფასი.', 'Services are what the app shows with a Book button. Add the first — name, duration, price.'), manage ? button(t('სერვისის დამატება', 'Add a service'), { icon: 'plus', onClick: () => serviceDialog(null, staff, paint) }) : null))); return; }
      if (!active.length) { mount(host, card(emptyBox(t('ვერაფერი მოიძებნა', 'Nothing found'), t('შეცვალე ძებნა ან ფილტრი.', 'Change the search or the filter.')))); return; }
      const groups = new Map();
      for (const s of active) groups.set(s.group || '', [...(groups.get(s.group || '') || []), s]);
      mount(host, [...groups.entries()].map(([group, list]) => card({ class: 'flush' },
        group ? h('div', { class: 'card-head', style: { padding: '14px 18px 0' } }, h('div', { class: 'card-title' }, group)) : null,
        h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
          h('thead', null, h('tr', null, h('th', null, t('სერვისი', 'Service')), h('th', null, t('ხანგრძლივობა', 'Duration')), h('th', { class: 'num' }, t('ფასი', 'Price')), h('th', null, t('ვინ ასრულებს', 'Who performs')), h('th', null, t('ონლაინ', 'Online')), manage ? h('th') : null)),
          h('tbody', null, list.map((s) => {
            const who = staff.filter((p) => p.active && (!p.serviceIds.length || p.serviceIds.includes(s.id)));
            return h('tr', null,
              h('td', null, h('b', null, s.name), s.nameEn && s.nameEn !== s.name ? h('div', { class: 'faint' }, s.nameEn) : null, s.description ? h('div', { class: 'faint' }, s.description) : null),
              h('td', null, minutes(s.durationMin), s.bufferMin ? h('span', { class: 'faint' }, t(` +${s.bufferMin} წთ პაუზა`, ` +${s.bufferMin} min buffer`)) : null),
              h('td', { class: 'num' }, s.price == null ? h('span', { class: 'bz-dim' }, t('ადგილზე', 'On site')) : s.priceTo ? `${gel(s.price)} – ${gel(s.priceTo)}` : gel(s.price)),
              h('td', null, who.length === staff.filter((p) => p.active).length ? t('ყველა', 'Everyone') : who.map((p) => p.name).join(', ') || h('span', { class: 'bz-bad' }, t('არავინ — ვერ დაიჯავშნება', 'Nobody — cannot be booked'))),
              h('td', null, manage ? toggle(s.online, async (on) => { try { await biz.patch(`/services/${s.id}`, { online: on }); ok(on ? t('ჩართულია აპში', 'On in the app') : t('გამორთულია აპში', 'Off in the app')); } catch (e) { fail(e); paint(); } }) : badge(s.online ? t('კი', 'Yes') : t('არა', 'No'), s.online ? 'ok' : 'neutral')),
              manage ? h('td', { class: 'num' }, h('div', { class: 'bz-inline', style: { justifyContent: 'flex-end' } }, button('', { variant: 'ghost', size: 'sm', icon: 'edit', ariaLabel: t('რედაქტირება', 'Edit'), onClick: () => serviceDialog(s, staff, paint) }), button('', { variant: 'ghost', size: 'sm', icon: 'trash', ariaLabel: t('მოხსნა', 'Remove'), onClick: async () => { if (await confirmDialog({ title: t('სერვისის მოხსნა?', 'Remove the service?'), body: t('არსებული ჯავშნები რჩება; ახალი ვეღარ გაკეთდება.', 'Existing bookings stay; no new ones can be made.'), confirm: t('მოხსნა', 'Remove'), danger: true })) { try { await biz.del(`/services/${s.id}`); paint(); } catch (e) { fail(e); } } } }))) : null);
          })))))));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  const search = input({ type: 'search', placeholder: t('სერვისის სახელი, ჯგუფი…', 'Service name, group…'), class: 'input bz-search' });
  search.addEventListener('input', debounceFn(() => { q = search.value; paint(false); }, 200));
  mount(root,
    pageHead(t('სერვისები', 'Services'), t('სახელი, ხანგრძლივობა, ფასი და ვინ ასრულებს. „ონლაინ“ = კლიენტი აპიდან თავად იწერს.', 'Name, duration, price and who performs it. "Online" = clients book it from the app themselves.'),
      manage ? button(t('სერვისის დამატება', 'Add a service'), { icon: 'plus', onClick: async () => serviceDialog(null, (await biz.get('/staff')).staff, paint) }) : null),
    filterBar(h('div', { class: 'bz-filters-row' }, search, chipsHost, h('span', { class: 'spacer' }), count), groupHost),
    host);
  await paint();
}

function serviceDialog(service, staff, onSaved) {
  const nameKa = input({ value: service?.name || '', required: true, placeholder: t('მაგ. პროფესიული ჰიგიენა', 'e.g. Professional cleaning') });
  const name = input({ value: service?.nameEn && service.nameEn !== service.name ? service.nameEn : '', placeholder: t('ლათინურად (არასავალდებულო)', 'In Latin letters (optional)') });
  const group = input({ value: service?.group || '', placeholder: t('მაგ. თერაპია, მანიკური, მასაჟი', 'e.g. Therapy, Manicure, Massage') });
  const duration = input({ type: 'number', min: 5, max: 720, step: 5, value: service?.durationMin ?? 30 });
  const buffer = input({ type: 'number', min: 0, max: 120, step: 5, value: service?.bufferMin ?? 0 });
  const price = input({ type: 'number', min: 0, step: '0.01', value: service?.price ?? '', placeholder: t('ცარიელი = ფასი ადგილზე', 'Empty = price on site') });
  const priceTo = input({ type: 'number', min: 0, step: '0.01', value: service?.priceTo ?? '', placeholder: t('დიაპაზონისთვის', 'For a range') });
  const description = textarea({ rows: 2, value: service?.description || '' });
  const online = h('input', { type: 'checkbox', checked: service ? service.online : true });
  const save = button(t('შენახვა', 'Save'));
  const m = openModal({
    title: service ? t('სერვისის რედაქტირება', 'Edit service') : t('ახალი სერვისი', 'New service'),
    body: h('div', { class: 'form' },
      h('div', { class: 'form-row' }, field(t('სახელი ქართულად', 'Name in Georgian'), nameKa), field(t('სახელი ლათინურად', 'Name in Latin letters'), name)),
      field(t('ჯგუფი', 'Group'), group, t('აპში სერვისები ჯგუფებად ჩანს.', 'The app lists services by group.')),
      h('div', { class: 'form-row' }, field(t('ხანგრძლივობა, წთ', 'Duration, min'), duration), field(t('პაუზა შემდეგ, წთ', 'Buffer after, min'), buffer, t('გაწმენდა, მომზადება — ამ დროს სხვა ვერ ჩაიწერება.', 'Cleaning, set-up — nobody books into it.'))),
      h('div', { class: 'form-row' }, field(t('ფასი, ₾', 'Price, ₾'), price), field(t('ფასი … მდე, ₾', 'Price up to, ₾'), priceTo)),
      field(t('აღწერა', 'Description'), description),
      h('label', { class: 'bz-inline', style: { fontSize: '14px' } }, online, t('ონლაინ ჯავშნა აპიდან', 'Bookable online from the app'))),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
  });
  save.addEventListener('click', () => busy(save, async () => {
    try {
      const body = { nameKa: nameKa.value.trim(), name: name.value.trim() || nameKa.value.trim(), group: group.value.trim() || null, durationMin: Number(duration.value), bufferMin: Number(buffer.value) || 0, price: price.value === '' ? null : Number(price.value), priceTo: priceTo.value === '' ? null : Number(priceTo.value), description: description.value.trim() || null, online: online.checked };
      if (service) await biz.patch(`/services/${service.id}`, body); else await biz.post('/services', body);
      m.close();
      ok(t('შენახულია', 'Saved'));
      onSaved?.();
    } catch (e) { fail(e); }
  }));
}

export { icon };
