// MEDIBOOK business panel — services: what can be booked, with price, duration and who performs it.
// Groups as cards with a header strip, one row per service: the duration as a lilac pill, the people as initials,
// the price bold, the online switch, actions on hover.
import { h, mount, icon, button, pageHead, card, input, textarea, field, busy, openModal, confirmDialog, toggle, badge } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, minutes, emptyBox, fail, ok, debounceFn, avatar } from '../shared.js';
import { canManage } from '../state.js';
import { chips, filterBar } from '../lists.js';

export default async function servicesPage(root) {
  const host = h('div');
  const chipsHost = h('div');
  const groupHost = h('div');
  const strip = h('div');
  const count = h('span', { class: 'bz-filters-count' });
  const manage = canManage();
  let q = '';
  let online = '';
  let group = '';
  let cache = null;

  async function paint(fresh = true) {
    if (fresh || !cache) {
      mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
      try { const [{ services }, { staff }, { resources }] = await Promise.all([biz.get('/services'), biz.get('/staff'), biz.get('/resources').catch(() => ({ resources: [] }))]); cache = { services, staff, resources: resources.filter((r) => r.active) }; } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); return; }
    }
    try {
      const { services, staff, resources } = cache;
      const resourceName = (id) => resources.find((r) => r.id === id)?.name;
      const people = staff.filter((p) => p.active);
      const everything = services.filter((s) => s.active);
      const term = q.trim().toLowerCase();
      const groupsAll = [...new Set(everything.map((s) => s.group || ''))].filter(Boolean);
      // The strip: how the shelf looks as a whole.
      const priced = everything.filter((s) => s.price != null);
      const avg = priced.length ? priced.reduce((sum, s) => sum + s.price, 0) / priced.length : null;
      const unbookable = everything.filter((s) => s.online && !people.some((p) => !p.serviceIds.length || p.serviceIds.includes(s.id))).length;
      mount(strip, everything.length ? h('div', { class: 'bz-kpis' },
        kpi(t('სერვისი', 'Services'), String(everything.length), groupsAll.length ? t(`${groupsAll.length} ჯგუფი`, `${groupsAll.length} groups`) : t('ჯგუფების გარეშე', 'No groups yet'), true),
        kpi(t('აპიდან იწერება', 'Bookable online'), String(everything.filter((s) => s.online).length), t(`${everything.filter((s) => !s.online).length} მხოლოდ ადგილზე`, `${everything.filter((s) => !s.online).length} on site only`)),
        kpi(t('საშუალო ფასი', 'Average price'), avg == null ? '—' : gel(avg), priced.length < everything.length ? t(`${everything.length - priced.length} ფასი ადგილზე`, `${everything.length - priced.length} priced on site`) : ''),
        kpi(t('საშუალო ხანგრძლივობა', 'Average duration'), minutes(Math.round(everything.reduce((sum, s) => sum + s.durationMin, 0) / everything.length)), unbookable ? h('span', { class: 'bz-bad' }, t(`${unbookable} სერვისს შემსრულებელი არ ჰყავს`, `${unbookable} with nobody to perform`)) : t('ყველას ჰყავს შემსრულებელი', 'Everyone covered'))) : null);
      mount(chipsHost, chips([['', t('ყველა', 'All'), everything.length], ['on', t('ონლაინ', 'Online'), everything.filter((s) => s.online).length], ['off', t('მხოლოდ ადგილზე', 'On site only'), everything.filter((s) => !s.online).length]], online, (v) => { online = v; paint(false); }));
      mount(groupHost, groupsAll.length > 1 ? chips([['', t('ყველა ჯგუფი', 'Every group')], ...groupsAll.map((g) => [g, g, everything.filter((s) => (s.group || '') === g).length])], group, (v) => { group = v; paint(false); }) : null);
      const active = everything.filter((s) => (online === 'on' ? s.online : online === 'off' ? !s.online : true) && (!group || (s.group || '') === group) && (!term || `${s.name} ${s.nameEn || ''} ${s.group || ''} ${s.description || ''}`.toLowerCase().includes(term)));
      count.textContent = t(`${active.length} სერვისი`, `${active.length} ${active.length === 1 ? 'service' : 'services'}`);
      if (!everything.length) { mount(host, card(emptyBox(t('სერვისები ჯერ არ არის', 'No services yet'), t('აპში სწორედ სერვისები ჩანს „ჩაწერა“-ს ღილაკით. დაამატე პირველი — სახელი, ხანგრძლივობა, ფასი.', 'Services are what the app shows with the Book button. Add the first one — name, duration, price.'), manage ? button(t('სერვისის დამატება', 'Add a service'), { icon: 'plus', onClick: () => serviceDialog(null, staff, paint, false, resources) }) : null, 'grid'))); return; }
      if (!active.length) { mount(host, card(emptyBox(t('ვერაფერი მოიძებნა', 'Nothing found'), t('შეცვალე ძებნა ან ფილტრი.', 'Change the search or the filter.'), null, 'search'))); return; }
      const groups = new Map();
      for (const s of active) groups.set(s.group || '', [...(groups.get(s.group || '') || []), s]);
      mount(host, h('div', { class: 'bz-stack' }, [...groups.entries()].map(([g, list]) => card({ class: 'flush bz-service-card' },
        h('div', { class: 'bz-service-head' },
          h('div', null, h('div', { class: 'card-title' }, g || t('სერვისები', 'Services')), h('div', { class: 'card-sub' }, t(`${list.length} სერვისი · ჯამში ${minutes(list.reduce((sum, s) => sum + s.durationMin, 0))}`, `${list.length} ${list.length === 1 ? 'service' : 'services'} · ${minutes(list.reduce((sum, s) => sum + s.durationMin, 0))} in all`))),
          manage ? button(t('დამატება', 'Add'), { size: 'sm', variant: 'ghost', icon: 'plus', onClick: () => serviceDialog({ group: g }, staff, paint, true, resources) }) : null),
        h('div', { class: 'bz-service-rows' }, list.map((s) => {
          const who = people.filter((p) => !p.serviceIds.length || p.serviceIds.includes(s.id));
          const everyone = who.length === people.length && people.length > 0;
          const needs = (s.resourceIds || []).map(resourceName).filter(Boolean);
          return h('div', { class: `bz-service-row${s.online ? '' : ' is-offline'}` },
            h('span', { class: 'bz-service-dur' }, minutes(s.durationMin), s.bufferMin ? h('small', null, `+${s.bufferMin}`) : null),
            h('div', { class: 'bz-service-main' },
              h('b', null, s.name),
              h('div', { class: 'faint' }, [s.nameEn && s.nameEn !== s.name ? s.nameEn : null, s.description].filter(Boolean).join(' · ') || (s.bufferMin ? t(`${s.bufferMin} წთ პაუზა შემდეგ`, `${s.bufferMin} min buffer after`) : '')),
              needs.length ? h('div', { class: 'bz-service-res', title: t(`სჭირდება: ${needs.join(', ')}`, `Needs: ${needs.join(', ')}`) }, icon('door', { size: 12 }), needs.join(' · ')) : null),
            h('div', { class: 'bz-service-who', title: everyone ? t('ყველა ასრულებს', 'Everyone performs it') : who.map((p) => p.name).join(', ') },
              who.length ? [who.slice(0, 4).map((p) => avatar(p.name, p.color || '#64748B', 26)), who.length > 4 ? h('span', { class: 'more' }, `+${who.length - 4}`) : null, everyone ? h('span', { class: 'faint' }, t('ყველა', 'Everyone')) : null]
                : h('span', { class: 'bz-bad' }, icon('alert', { size: 14 }), ' ', t('არავინ ასრულებს', 'Nobody performs it'))),
            h('div', { class: 'bz-service-price' }, s.price == null ? h('span', { class: 'bz-dim' }, t('ფასი ადგილზე', 'Price on site')) : s.priceTo ? `${gel(s.price)} – ${gel(s.priceTo)}` : gel(s.price)),
            h('div', { class: 'bz-service-online' }, manage ? toggle(s.online, async (on) => { try { await biz.patch(`/services/${s.id}`, { online: on }); s.online = on; ok(on ? t('ჩართულია აპში', 'On in the app') : t('გამორთულია აპში', 'Off in the app')); paint(false); } catch (e) { fail(e); paint(); } }) : badge(s.online ? t('ონლაინ', 'Online') : t('ადგილზე', 'On site'), s.online ? 'ok' : 'neutral')),
            manage ? h('div', { class: 'bz-row-actions' },
              button('', { variant: 'ghost', size: 'sm', icon: 'edit', ariaLabel: t('რედაქტირება', 'Edit'), onClick: () => serviceDialog(s, staff, paint, false, resources) }),
              button('', { variant: 'ghost', size: 'sm', icon: 'trash', ariaLabel: t('ამოღება', 'Retire'), onClick: async () => { if (await confirmDialog({ title: t('სერვისის ამოღება?', 'Retire the service?'), body: t(`„${s.name}“ აპიდან გაქრება; ძველი ჩანაწერები რჩება.`, `"${s.name}" leaves the app; past bookings stay.`), confirm: t('ამოღება', 'Retire'), danger: true })) { try { await biz.del(`/services/${s.id}`); ok(t('ამოღებულია', 'Retired')); paint(); } catch (e) { fail(e); } } } })) : null);
        }))))));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  const search = input({ type: 'search', placeholder: t('სერვისის სახელი, ჯგუფი…', 'Service name, group…'), class: 'input bz-search' });
  search.addEventListener('input', debounceFn(() => { q = search.value; paint(false); }, 200));
  mount(root,
    pageHead(t('სერვისები', 'Services'), t('სახელი, ხანგრძლივობა, ფასი და ვინ ასრულებს. „ონლაინ“ = კლიენტი აპიდან თავად იწერს.', 'Name, duration, price and who performs it. "Online" = the client books from the app.'),
      manage ? button(t('სერვისის დამატება', 'Add a service'), { icon: 'plus', onClick: async () => serviceDialog(null, (await biz.get('/staff')).staff, paint, false, cache?.resources || []) }) : null),
    h('div', { class: 'bz-stack' }, strip, filterBar(h('div', { class: 'bz-filters-row' }, search, chipsHost, h('span', { class: 'spacer' }), count), groupHost), host));
  await paint();
}

function kpi(label, value, delta, accent = false) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}

/** `preset` = true means `service` only carries defaults (the group) for a new one. `resources` = the live rooms / devices to pick from. */
function serviceDialog(service, staff, onSaved, preset = false, resources = []) {
  const existing = service && !preset ? service : null;
  // What the visit cannot happen without: while every unit of it is taken, the time is offered to nobody.
  const needChecks = resources.map((r) => h('label', { class: `bz-chip${existing?.resourceIds?.includes(r.id) ? ' on' : ''}`, style: { cursor: 'pointer' } },
    h('input', { type: 'checkbox', value: r.id, checked: Boolean(existing?.resourceIds?.includes(r.id)), onChange: (e) => e.target.parentElement.classList.toggle('on', e.target.checked) }),
    icon(r.kind === 'EQUIPMENT' ? 'zap' : 'door', { size: 13 }), r.name));
  const needs = resources.length
    ? field(t('სჭირდება', 'Needs'), h('div', { class: 'bz-chips', style: { marginTop: '2px' } }, needChecks), t('ოთახი ან აპარატურა, რომლის გარეშე ვიზიტი არ ჩატარდება. სანამ ყველა ერთეული დაკავებულია, დრო არავის ეთავაზება.', 'A room or device the visit cannot happen without. While every unit is taken, the time is offered to nobody.'))
    : field(t('სჭირდება', 'Needs'), h('p', { class: 'bz-note', style: { margin: 0 } }, t('ოთახები და აპარატურა ჯერ არ გაქვს — დაამატე გვერდზე „ოთახები“, მერე აქ მონიშნავ.', 'No rooms or equipment yet — add them under Rooms, then tick them here.')));
  const nameKa = input({ value: existing?.name || '', required: true, placeholder: t('მაგ. პროფესიული ჰიგიენა', 'e.g. Professional cleaning') });
  const name = input({ value: existing?.nameEn && existing.nameEn !== existing.name ? existing.nameEn : '', placeholder: t('ლათინურად (არასავალდებულო)', 'In Latin letters (optional)') });
  const group = input({ value: service?.group || '', placeholder: t('მაგ. თერაპია, მანიკური, მასაჟი', 'e.g. Therapy, Manicure, Massage') });
  const duration = input({ type: 'number', min: 5, max: 720, step: 5, value: existing?.durationMin ?? 30 });
  const buffer = input({ type: 'number', min: 0, max: 120, step: 5, value: existing?.bufferMin ?? 0 });
  const price = input({ type: 'number', min: 0, step: '0.01', value: existing?.price ?? '', placeholder: t('ცარიელი = ფასი ადგილზე', 'Empty = price on site') });
  const priceTo = input({ type: 'number', min: 0, step: '0.01', value: existing?.priceTo ?? '', placeholder: t('დიაპაზონისთვის', 'For a range') });
  const description = textarea({ rows: 2, value: existing?.description || '' });
  const online = h('input', { type: 'checkbox', checked: existing ? existing.online : true });
  const save = button(t('შენახვა', 'Save'));
  const m = openModal({
    title: existing ? t('სერვისის რედაქტირება', 'Edit service') : t('ახალი სერვისი', 'New service'),
    body: h('div', { class: 'form' },
      h('div', { class: 'form-row' }, field(t('სახელი ქართულად', 'Name in Georgian'), nameKa), field(t('სახელი ლათინურად', 'Name in Latin letters'), name)),
      field(t('ჯგუფი', 'Group'), group, t('აპში სერვისები ჯგუფებად ჩანს.', 'The app lists services by group.')),
      h('div', { class: 'form-row' }, field(t('ხანგრძლივობა, წთ', 'Duration, min'), duration), field(t('პაუზა შემდეგ, წთ', 'Buffer after, min'), buffer, t('გაწმენდა, მომზადება — ამ დროს სხვა ვერ ჩაიწერება.', 'Cleaning, preparation — nobody books this time.'))),
      h('div', { class: 'form-row' }, field(t('ფასი, ₾', 'Price, ₾'), price), field(t('ფასი … მდე, ₾', 'Price up to, ₾'), priceTo)),
      needs,
      field(t('აღწერა', 'Description'), description),
      h('label', { class: 'bz-inline', style: { fontSize: '14px' } }, online, t('ონლაინ ჯავშნა აპიდან', 'Bookable online from the app'))),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
  });
  save.addEventListener('click', () => busy(save, async () => {
    try {
      const body = { nameKa: nameKa.value.trim(), name: name.value.trim() || nameKa.value.trim(), group: group.value.trim() || null, durationMin: Number(duration.value), bufferMin: Number(buffer.value) || 0, price: price.value === '' ? null : Number(price.value), priceTo: priceTo.value === '' ? null : Number(priceTo.value), description: description.value.trim() || null, online: online.checked };
      if (resources.length) body.resourceIds = needChecks.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
      if (existing) await biz.patch(`/services/${existing.id}`, body); else await biz.post('/services', body);
      m.close();
      ok(t('შენახულია', 'Saved'));
      onSaved?.();
    } catch (e) { fail(e); }
  }));
}

export { icon };
