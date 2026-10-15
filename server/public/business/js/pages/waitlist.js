// MEDIBOOK business panel — the waiting list: who wants a time that is not free yet, for what, when;
// offer a time, book them straight in, add a walk-in by hand.
import { h, mount, icon, button, pageHead, card, input, field, select, busy, openModal, confirmDialog, badge, textarea, debounce } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, minutes, emptyBox, fail, ok, when, dateText, relative, phoneText, avatar, ymd, addDays, toIso, WEEKDAYS_SHORT } from '../shared.js';
import { chips, filterBar, pager, paginate, listState } from '../lists.js';
import { dateField, timeField } from '../fields.js';
import { loadContext, newAppointmentDialog } from '../appointment.js';
import { canManage } from '../state.js';

const PARTS = [['MORNING', t('დილა', 'Morning')], ['AFTERNOON', t('დღე', 'Afternoon')], ['EVENING', t('საღამო', 'Evening')]];
const partLabel = (p) => PARTS.find(([k]) => k === p)?.[1] || p;
const STATUS = {
  WAITING: [t('ელოდება', 'Waiting'), 'brand'],
  OFFERED: [t('შეთავაზებულია', 'Offered'), 'warn'],
  BOOKED: [t('ჩაიწერა', 'Booked'), 'ok'],
  CANCELLED: [t('გაუქმდა', 'Cancelled'), 'neutral'],
  EXPIRED: [t('ვადა გავიდა', 'Expired'), 'neutral'],
};
const statusBadge = (s) => badge(STATUS[s]?.[0] || s, STATUS[s]?.[1] || 'neutral');
const rangeText = (e) => (e.fromDate === e.toDate ? dateText(e.fromDate) : `${dateText(e.fromDate)} – ${dateText(e.toDate)}`);

export default async function waitlistPage(root) {
  const host = h('div');
  const st = listState('waitlist', { status: 'open', q: '', page: 1, size: 25 });
  let ctx = null;
  let data = null;

  async function load() {
    const status = st.state.status;
    const [list, c] = await Promise.all([biz.get('/waitlist', { status: status === 'open' ? 'open' : status === 'all' ? 'all' : status }), ctx ? Promise.resolve(ctx) : loadContext()]);
    ctx = c;
    data = list;
  }

  function rows() {
    const { q } = st.state;
    const term = q.trim().toLowerCase();
    return (data?.entries || []).filter((e) => !term || `${e.clientName} ${e.clientPhone || ''} ${e.serviceName} ${e.staffName || ''} ${e.note || ''}`.toLowerCase().includes(term));
  }

  function paint() {
    if (!data) { mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' }))); return; }
    const s = st.state;
    const list = rows();
    const open = (data.entries || []).filter((e) => e.status === 'WAITING' || e.status === 'OFFERED').length;
    const bar = filterBar(
      chips([
        ['open', t('ღია', 'Open'), s.status === 'open' ? open : undefined],
        ['OFFERED', t('შეთავაზებული', 'Offered')],
        ['BOOKED', t('ჩაწერილი', 'Booked')],
        ['all', t('ყველა', 'All')],
      ], s.status, (v) => { st.set({ status: v, page: 1 }); refresh(); }),
      input({ class: 'input', placeholder: t('ძებნა — სახელი, ტელეფონი, სერვისი…', 'Search — name, phone, service…'), value: s.q, onInput: debounce((e) => { st.set({ q: e.target.value, page: 1 }); paint(); }, 200) }));
    if (!list.length) {
      mount(host, bar, card(emptyBox(
        s.status === 'open' ? t('მოლოდინის სია ცარიელია', 'The waiting list is empty') : t('აქ არაფერია', 'Nothing here'),
        t('როცა კლიენტი აპში თავისუფალ დროს ვერ იპოვის, აქ ეწერება; გათავისუფლებულ დროზე თავისით ვატყობინებთ. ვიზიტორი ხელითაც დაემატება.', 'When a client finds no free time in the app, they end up here; we tell them by ourselves when a time opens up. A walk-in can be added by hand.'),
        button(t('დამატება ხელით', 'Add by hand'), { icon: 'plus', onClick: () => addDialog() }))));
      return;
    }
    const pg = paginate(list, s.page, s.size);
    mount(host, bar, card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table bz-wait' },
      h('thead', null, h('tr', null, h('th', null, t('კლიენტი', 'Client')), h('th', null, t('სერვისი', 'Service')), h('th', null, t('როდის უნდა', 'Wanted')), h('th', null, t('სტატუსი', 'Status')), h('th'))),
      h('tbody', null, pg.rows.map((e) => row(e))))),
      pager({ ...pg, size: s.size, onPage: (p) => { st.set({ page: p }); paint(); }, onSize: (n) => { st.set({ size: n, page: 1 }); paint(); } })));
  }

  function row(e) {
    const openEntry = e.status === 'WAITING' || e.status === 'OFFERED';
    const acts = [];
    if (openEntry) {
      acts.push(button(t('შეთავაზება', 'Offer a time'), { size: 'sm', variant: 'secondary', icon: 'bellRing', onClick: () => offerDialog(e) }));
      acts.push(button(t('ჩაწერა', 'Book'), { size: 'sm', icon: 'calendarPlus', onClick: () => bookNow(e) }));
      acts.push(button('', { size: 'sm', variant: 'ghost', icon: 'x', ariaLabel: t('ამოღება', 'Remove'), onClick: async () => {
        if (await confirmDialog({ title: t('ამოვიღო სიიდან?', 'Remove from the list?'), body: `${e.clientName} · ${e.serviceName}`, confirm: t('ამოღება', 'Remove') })) {
          try { await biz.patch(`/waitlist/${e.id}`, { status: 'CANCELLED' }); ok(t('ამოღებულია', 'Removed')); refresh(); } catch (err) { fail(err); }
        }
      } }));
    } else if (canManage()) {
      acts.push(button('', { size: 'sm', variant: 'ghost', icon: 'trash', ariaLabel: t('წაშლა', 'Delete'), onClick: async () => {
        if (await confirmDialog({ title: t('წავშალო?', 'Delete?'), body: `${e.clientName} · ${e.serviceName}`, confirm: t('წაშლა', 'Delete'), danger: true })) {
          try { await biz.del(`/waitlist/${e.id}`); refresh(); } catch (err) { fail(err); }
        }
      } }));
    }
    const client = e.clientId ? h('a', { class: 'bz-link', href: `/business/clients/${e.clientId}`, 'data-link': '' }, e.clientName) : h('span', null, e.clientName);
    return h('tr', { class: openEntry ? '' : 'is-muted' },
      h('td', null, h('div', { class: 'bz-cell-main' }, h('div', { class: 'bz-inline' }, avatar(e.clientName, '#64748B', 28), h('div', null, h('b', null, client), h('div', { class: 'faint' }, [e.clientPhone ? phoneText(e.clientPhone) : null, e.source === 'BUSINESS' ? t('ხელით', 'By hand') : t('აპიდან', 'From the app')].filter(Boolean).join(' · ')))))),
      h('td', null, h('span', null, e.serviceName), h('div', { class: 'faint' }, e.staffName ? h('span', { class: 'bz-inline' }, h('span', { class: 'bz-color-dot', style: { background: e.staffColor || '#64748B' } }), e.staffName) : t('ნებისმიერი თანამშრომელი', 'Anyone')), e.note ? h('div', { class: 'faint', title: e.note }, e.note.length > 60 ? `${e.note.slice(0, 60)}…` : e.note) : null),
      h('td', null, h('b', { style: { whiteSpace: 'nowrap' } }, rangeText(e)), h('div', { class: 'faint' }, e.dayParts.length ? e.dayParts.map(partLabel).join(', ') : t('დღის ნებისმიერ დროს', 'Any time of day'))),
      h('td', null, statusBadge(e.status), e.status === 'OFFERED' && e.offeredStartsAt ? h('div', { class: 'faint' }, `${when(e.offeredStartsAt)}${e.offeredStaffName ? ` · ${e.offeredStaffName}` : ''}`) : e.status === 'BOOKED' && e.appointmentId ? h('div', { class: 'faint' }, t('ჯავშანი შექმნილია', 'Booking made')) : null, h('div', { class: 'faint', title: when(e.createdAt) }, t(`დაემატა ${relative(e.createdAt)}`, `added ${relative(e.createdAt)}`))),
      h('td', { class: 'num' }, h('div', { class: 'bz-row-actions' }, acts)));
  }

  /** A time by hand: day + time (free ones tinted for the bundle), one push to the client. */
  function offerDialog(e) {
    const who = select([{ value: '', label: t('ნებისმიერი', 'Anyone') }, ...ctx.staff.map((s) => ({ value: s.id, label: s.name }))], e.staffId || '');
    const time = timeField({ value: '' });
    const date = dateField({ value: e.fromDate >= ymd() ? e.fromDate : ymd(), onChange: () => refreshFree() });
    const hint = h('div', { class: 'bz-note' });
    async function refreshFree() {
      try {
        const r = await biz.get('/availability', { serviceIds: e.serviceIds.join(','), date: date.get(), staffId: who.value || undefined });
        time.configure({ free: new Set(r.slots.map((s) => s.time)) });
        mount(hint, r.slots.length ? t(`${r.slots.length} თავისუფალი დრო ამ დღეს`, `${r.slots.length} free times this day`) : t('ამ დღეს თავისუფალი დრო არ ჩანს — დრო მაინც შეგიძლია შესთავაზო.', 'No free time this day — a time can still be offered.'));
      } catch { time.configure({ free: null }); }
    }
    who.addEventListener('change', refreshFree);
    refreshFree();
    const send = button(t('შეთავაზება', 'Offer'), { icon: 'send' });
    const m = openModal({
      title: t('დროის შეთავაზება', 'Offer a time'),
      size: 'sm',
      body: h('div', { class: 'form' },
        h('p', { class: 'muted' }, e.clientUserId ? t(`${e.clientName}-ს აპში შეტყობინება მივა ამ დროით და ერთი შეხებით დაჯავშნის.`, `${e.clientName} gets a notification with this time and books it with one tap.`) : t(`${e.clientName}-ს აპი არ აქვს — დრო ჩაიწერება შეთავაზებულად, დაურეკე თავად.`, `${e.clientName} has no app — the time is noted as offered; call them yourself.`)),
        h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date.el), field(t('დრო', 'Time'), time.el)),
        field(t('თანამშრომელი', 'Person'), who), hint),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), send],
    });
    send.addEventListener('click', () => busy(send, async () => {
      try {
        if (!date.get() || !time.get()) throw new Error(t('აირჩიე დღე და დრო.', 'Pick a day and a time.'));
        const r = await biz.patch(`/waitlist/${e.id}`, { offer: { startsAt: toIso(date.get(), time.get()), staffId: who.value || null } });
        m.close();
        ok(r.notified ? t('შეთავაზებულია — კლიენტს შეტყობინება მივიდა', 'Offered — the client was notified') : t('შეთავაზებულია', 'Offered'));
        refresh();
      } catch (err) { fail(err); }
    }));
  }

  /** The new-booking dialog, pre-filled from the entry; the entry closes when the booking is made. */
  function bookNow(e) {
    newAppointmentDialog(ctx, { clientId: e.clientId, clientName: e.clientName, clientPhone: e.clientPhone, staffId: e.staffId || '', serviceIds: e.serviceIds, date: e.fromDate >= ymd() ? e.fromDate : ymd() }, {
      onCreated: async (a) => { try { await biz.patch(`/waitlist/${e.id}`, { status: 'BOOKED', appointmentId: a.id }); } catch { /* the sweep catches it */ } refresh(); },
    });
  }

  /** A walk-in by hand: client, services, person, range, parts of the day, note. */
  function addDialog() {
    const clientQ = input({ placeholder: t('კლიენტის სახელი ან ტელეფონი…', 'Client name or phone…'), autocomplete: 'off' });
    const clientList = h('div', { class: 'bz-geo-list' });
    const clientPhone = input({ type: 'tel', placeholder: t('ტელეფონი', 'Phone') });
    let clientId = null;
    const picked = h('div', { class: 'bz-note' });
    const searchClients = debounce(async () => {
      const term = clientQ.value.trim();
      clientId = null;
      picked.textContent = '';
      if (term.length < 2) { mount(clientList); return; }
      try {
        const { clients } = await biz.get('/clients', { q: term, limit: 6 });
        mount(clientList, clients.map((c) => h('button', { type: 'button', onClick: () => { clientId = c.id; clientQ.value = c.name; clientPhone.value = c.phone || ''; picked.textContent = t('არსებული კლიენტი არჩეულია', 'Existing client selected'); mount(clientList); } }, icon('user', { size: 14 }), ` ${c.name}`, c.phone ? h('span', { class: 'faint' }, ` · ${c.phone}`) : null)));
      } catch { mount(clientList); }
    }, 250);
    clientQ.addEventListener('input', searchClients);
    const checks = ctx.services.map((s, i) => h('label', { class: `bz-chip${i === 0 ? ' on' : ''}`, style: { cursor: 'pointer' } }, h('input', { type: 'checkbox', value: s.id, checked: i === 0, onChange: (ev) => ev.target.parentElement.classList.toggle('on', ev.target.checked) }), `${s.name} · ${minutes(s.durationMin)}`));
    const who = select([{ value: '', label: t('ნებისმიერი', 'Anyone') }, ...ctx.staff.map((s) => ({ value: s.id, label: s.name }))], '');
    const from = dateField({ value: ymd() });
    const to = dateField({ value: addDays(ymd(), 14) });
    const parts = PARTS.map(([k, label]) => h('label', { class: 'bz-chip', style: { cursor: 'pointer' } }, h('input', { type: 'checkbox', value: k, onChange: (ev) => ev.target.parentElement.classList.toggle('on', ev.target.checked) }), label));
    const note = textarea({ rows: 2, placeholder: t('შენიშვნა (არასავალდებულო)', 'Note (optional)') });
    const save = button(t('სიაში დამატება', 'Add to the list'), { icon: 'plus' });
    const m = openModal({
      title: t('მოლოდინის სიაში დამატება', 'Add to the waiting list'),
      body: h('div', { class: 'form' },
        field(t('კლიენტი', 'Client'), clientQ), clientList, picked,
        field(t('ტელეფონი', 'Phone'), clientPhone),
        field(t('სერვისები', 'Services'), h('div', { class: 'bz-chips' }, checks)),
        field(t('თანამშრომელი', 'Person'), who),
        h('div', { class: 'form-row' }, field(t('დღიდან', 'From'), from.el), field(t('დღემდე', 'Until'), to.el)),
        field(t('დღის ნაწილი (ცარიელი = ნებისმიერი)', 'Part of the day (empty = any)'), h('div', { class: 'bz-chips' }, parts)),
        field(t('შენიშვნა', 'Note'), note)),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try {
        const serviceIds = checks.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
        if (!serviceIds.length) throw new Error(t('აირჩიე სერვისი.', 'Pick a service.'));
        if (!clientId && !clientQ.value.trim()) throw new Error(t('მიუთითე კლიენტის სახელი.', 'Enter the client name.'));
        await biz.post('/waitlist', { clientId: clientId || undefined, clientName: clientQ.value.trim() || undefined, clientPhone: clientPhone.value.trim() || undefined, serviceIds, staffId: who.value || null, fromDate: from.get(), toDate: to.get(), dayParts: parts.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value), note: note.value.trim() || undefined });
        m.close();
        ok(t('დამატებულია', 'Added'));
        refresh();
      } catch (err) { fail(err); }
    }));
  }

  async function refresh() {
    try { await load(); paint(); } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  mount(root,
    pageHead(t('მოლოდინის სია', 'Waiting list'), t('ვინც თავისუფალ დროს ელოდება. გაუქმებული ან გადატანილი ჯავშანი, მოხსნილი დასვენება — ყველა გათავისუფლებული დრო თავისით ეთავაზება პირველ შესაფერის კლიენტს.', 'Who is waiting for a free time. A cancelled or moved booking, removed time off — every freed time is offered by itself to the first fitting client.'),
      button(t('დამატება ხელით', 'Add by hand'), { icon: 'plus', onClick: async () => { if (!ctx) ctx = await loadContext(); addDialog(); } })),
    host);
  paint();
  await refresh();
}

export { gel, WEEKDAYS_SHORT };
