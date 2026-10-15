// MEDIBOOK business panel — rooms and equipment (ოთახები): the treatment rooms, chairs, lasers and devices a visit
// needs. A service names what it needs; while every unit of it is taken, that time is offered to nobody — not in
// the app, not in the calendar. One card per resource: today's load ring, the services that need it, edit / retire.
import { h, mount, icon, button, pageHead, card, input, field, busy, openModal, confirmDialog } from '/app/js/ui.js';
import { select } from '../fields.js';
import { t } from '/app/js/i18n.js';
import { ring } from '/app/js/charts.js';
import { biz, minutes, emptyBox, fail, ok } from '../shared.js';
import { chips, filterBar } from '../lists.js';
import { canManage } from '../state.js';

export const KINDS = [['ROOM', t('ოთახი', 'Room'), 'door'], ['EQUIPMENT', t('აპარატურა', 'Equipment'), 'zap']];
export const kindLabel = (k) => KINDS.find(([v]) => v === k)?.[1] || k;
export const kindIcon = (k) => KINDS.find(([v]) => v === k)?.[2] || 'door';

export default async function resourcesPage(root) {
  const host = h('div');
  const chipsHost = h('div');
  const count = h('span', { class: 'bz-filters-count' });
  const manage = canManage();
  let only = '';
  let cache = null;

  async function paint(fresh = true) {
    if (fresh || !cache) {
      mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
      try { cache = (await biz.get('/resources', { all: 1 })).resources; } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); return; }
    }
    const everything = cache.filter((r) => r.active);
    const rooms = everything.filter((r) => r.kind === 'ROOM');
    const devices = everything.filter((r) => r.kind === 'EQUIPMENT');
    mount(chipsHost, chips([['', t('ყველა', 'All'), everything.length], ['ROOM', t('ოთახები', 'Rooms'), rooms.length], ['EQUIPMENT', t('აპარატურა', 'Equipment'), devices.length]], only, (v) => { only = v; paint(false); }));
    const active = everything.filter((r) => !only || r.kind === only);
    count.textContent = t(`${active.length} ერთეული`, `${active.length} ${active.length === 1 ? 'item' : 'items'}`);
    if (!everything.length) {
      mount(host, card(emptyBox(t('ოთახები და აპარატურა ჯერ არ არის', 'No rooms or equipment yet'),
        t('კაბინეტი, სავარძელი, ლაზერი, რენტგენი — დაამატე და სერვისს მიუწერე, რა სჭირდება. სანამ ყველა ერთეული დაკავებულია, ეს დრო არც აპში ჩანს და არც კალენდარში იწერება.', 'A treatment room, a chair, a laser, an X-ray unit — add them and tell each service what it needs. While every unit is taken, that time is offered to nobody — not in the app, not in the calendar.'),
        manage ? button(t('პირველი ოთახი', 'First room'), { icon: 'plus', onClick: () => resourceDialog(null) }) : null, 'door')));
      return;
    }
    if (!active.length) { mount(host, card(emptyBox(t('ვერაფერი მოიძებნა', 'Nothing found'), t('შეცვალე ფილტრი.', 'Change the filter.'), null, 'search'))); return; }
    const unused = everything.filter((r) => !r.services.length).length;
    mount(host, h('div', { class: 'bz-stack' },
      unused && manage ? h('div', { class: 'bz-banner is-info', style: { margin: 0 } }, icon('info', { size: 20 }), h('p', null,
        h('b', null, t(`${unused} ერთეულს სერვისი არ აქვს მიწერილი`, `${unused} ${unused === 1 ? 'item has' : 'items have'} no service yet`)),
        t('გახსენი სერვისი, მონიშნე „სჭირდება“ — და კალენდარი ამ ოთახს თავისით დაიცავს.', 'Open a service and tick what it needs under "Needs" — the calendar then guards the room by itself.'))) : null,
      h('div', { class: 'bz-rooms' }, active.map(roomCard))));
  }

  function roomCard(r) {
    const td = r.today;
    const open = Boolean(td?.workingMinutes);
    const stat = (v, l) => h('span', { class: 'bz-person-stat' }, h('b', null, v), h('small', null, l));
    const shown = r.services.slice(0, 4);
    return h('div', { class: 'bz-room' },
      h('div', { class: 'bz-room-head' },
        h('span', { class: `bz-room-ic is-${r.kind.toLowerCase()}` }, icon(kindIcon(r.kind), { size: 22 })),
        h('div', { class: 'who' }, h('b', null, r.name), h('span', null, [kindLabel(r.kind), r.capacity > 1 ? t(`${r.capacity} ვიზიტი ერთდროულად`, `${r.capacity} visits at once`) : null, r.note].filter(Boolean).join(' · ')))),
      h('div', { class: 'bz-room-load', title: open ? t(`${minutes(td.bookedMinutes)} / ${minutes(td.workingMinutes)}`, `${minutes(td.bookedMinutes)} of ${minutes(td.workingMinutes)}`) : '' },
        ring({ value: td?.bookedMinutes ?? 0, max: open ? td.workingMinutes : Math.max(1, td?.bookedMinutes ?? 0), size: 64, stroke: 6, color: 'var(--book)', label: open ? `${td.load}%` : '—', labelScale: 0.22 }),
        h('div', { class: 'bz-person-stats' },
          stat(String(td?.appointments ?? 0), t('ჩანაწერი დღეს', 'bookings today')),
          stat(minutes(td?.bookedMinutes ?? 0), open ? t(`${minutes(td.workingMinutes)}-დან`, `of ${minutes(td.workingMinutes)}`) : t('დაკავებული', 'booked'))),
        h('span', { class: 'cap' }, open ? t('დატვირთვა დღეს · სამუშაო საათებიდან', 'Load today · of the open hours') : t('დღეს დახურულია', 'Closed today'))),
      h('div', { class: 'bz-room-row' },
        h('span', { class: 'lbl' }, t('სჭირდება', 'Needed by')),
        r.services.length
          ? h('span', { class: 'bz-tags' }, [...shown.map((s) => h('span', { class: 'bz-tag' }, s.name)), r.services.length > shown.length ? h('span', { class: 'bz-tag is-more', title: r.services.slice(4).map((s) => s.name).join(', ') }, `+${r.services.length - shown.length}`) : null])
          : h('span', { class: 'bz-sub', style: { paddingTop: '3px' } }, t('ჯერ არცერთ სერვისს', 'No service yet'))),
      manage ? h('div', { class: 'bz-room-foot' },
        button(t('რედაქტირება', 'Edit'), { size: 'sm', variant: 'ghost', icon: 'edit', onClick: () => resourceDialog(r) }),
        button(t('ამოღება', 'Retire'), { size: 'sm', variant: 'ghost', icon: 'trash', onClick: async () => {
          if (await confirmDialog({ title: t(`${r.name} — ამოღება?`, `Retire ${r.name}?`), body: t('სერვისებს აღარ დასჭირდება; ძველი ჩანაწერები რჩება.', 'Services will no longer need it; past bookings stay.'), confirm: t('ამოღება', 'Retire'), danger: true })) {
            try { await biz.del(`/resources/${r.id}`); ok(t('ამოღებულია', 'Retired')); paint(); } catch (e) { fail(e); }
          }
        } })) : null);
  }

  function resourceDialog(r) {
    const name = input({ value: r?.name || '', required: true, placeholder: t('მაგ. კაბინეტი 2, ლაზერი, სავარძელი A', 'e.g. Room 2, Laser, Chair A') });
    const kind = select(KINDS.map(([value, label]) => ({ value, label })), r?.kind || 'ROOM');
    const capacity = input({ type: 'number', min: 1, max: 50, step: 1, value: r?.capacity ?? 1 });
    const note = input({ value: r?.note || '', placeholder: t('მაგ. მეორე სართული (არასავალდებულო)', 'e.g. Second floor (optional)') });
    const save = button(t('შენახვა', 'Save'));
    const m = openModal({
      title: r ? t('რედაქტირება', 'Edit') : t('ახალი ოთახი ან აპარატი', 'New room or device'),
      size: 'sm',
      body: h('div', { class: 'form' },
        field(t('სახელი', 'Name'), name),
        h('div', { class: 'form-row' }, field(t('რა არის', 'What it is'), kind), field(t('ერთდროულად', 'At once'), capacity, t('რამდენი ვიზიტი ეტევა ერთდროულად. ჩვეულებრივ 1.', 'How many visits fit at the same time. Usually 1.'))),
        field(t('შენიშვნა', 'Note'), note),
        h('p', { class: 'bz-note' }, t('რომელ სერვისს სჭირდება — სერვისის რედაქტირებაში, „სჭირდება“.', 'Which service needs it — when editing the service, under "Needs".'))),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try {
        const body = { name: name.value.trim(), kind: kind.value, capacity: Number(capacity.value) || 1, note: note.value.trim() || null };
        if (r) await biz.patch(`/resources/${r.id}`, body); else await biz.post('/resources', body);
        m.close();
        ok(t('შენახულია', 'Saved'));
        paint();
      } catch (e) { fail(e); }
    }));
  }

  mount(root,
    pageHead(t('ოთახები', 'Rooms'), t('კაბინეტები და აპარატურა, რომლის გარეშე ვიზიტი ვერ ჩატარდება. სანამ დაკავებულია, დრო არავის ეთავაზება.', 'Treatment rooms and equipment a visit cannot happen without. While one is taken, the time is offered to nobody.'),
      manage ? button(t('დამატება', 'Add'), { icon: 'plus', onClick: () => resourceDialog(null) }) : null),
    h('div', { class: 'bz-stack' }, filterBar(h('div', { class: 'bz-filters-row' }, chipsHost, h('span', { class: 'spacer' }), count)), host));
  await paint();
}
