// MEDIBOOK business panel — a group class: the drawer (seats, the attendees with came / no-show / restore, a walk-in
// attendee, move, cancel) and the dialogs that plan classes — one class from the calendar, the weekly timetable
// („განრიგი“) from the services page. A seat is a normal booking row; the class is the block around them.
import { h, mount, icon, button, busy, field, input, textarea, badge, openModal, confirmDialog } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { openDrawer } from './drawer.js';
import { biz, statusBadge, gel, minutes, when, clock, ymd, addDays, toIso, fail, ok, avatar, WEEKDAYS, WEEKDAYS_SHORT } from './shared.js';
import { canManage } from './state.js';
import { dateField, timeField, select } from './fields.js';
import { newAppointmentDialog, openAppointment } from './appointment.js';

const staffColor = (ctx, id) => ctx.staff.find((s) => s.id === id)?.color || '#64748B';
export const seatsLabel = (n) => t(`${n} ადგილი`, `${n} ${n === 1 ? 'seat' : 'seats'}`);
export const seatsLeftLabel = (n) => t(`${n} ადგილი დარჩა`, `${n} ${n === 1 ? 'seat' : 'seats'} left`);

/** The seats line: „7 / 15“ big, a thin bar in the trainer's colour under it. */
export function seatsBlock(cls, color) {
  const share = cls.seats ? Math.min(100, Math.round((cls.booked / cls.seats) * 100)) : 0;
  return h('div', { class: `bz-class-seats${cls.seatsLeft === 0 ? ' is-full' : ''}` },
    h('div', { class: 'num' }, h('b', null, String(cls.booked)), h('span', null, ` / ${cls.seats}`), h('small', null, cls.status === 'CANCELLED' ? t('გაუქმებული', 'Cancelled') : cls.seatsLeft === 0 ? t('სავსეა', 'Full') : seatsLeftLabel(cls.seatsLeft))),
    h('div', { class: 'bz-class-bar' }, h('i', { style: { width: `${share}%`, background: color || 'var(--book)' } })));
}

/**
 * Opens a class in the drawer. `onChange(cls)` fires after every edit (the calendar repaints).
 */
export function openClass(initial, ctx, { onChange } = {}) {
  let cls = initial;
  const color = () => cls.staffColor || staffColor(ctx, cls.staffId);
  // The drawer renders at once, so everything render() reads is defined above this line.
  const d = openDrawer({ title: cls.serviceName, body: () => render(), footer: () => actions() });

  async function reload(message) {
    try {
      cls = (await biz.get(`/classes/${cls.id}`)).class;
      if (message) ok(message);
      d.setBody(render());
      d.setFooter(actions());
      onChange?.(cls);
    } catch (e) { fail(e); }
  }

  function render() {
    const live = (cls.attendees || []).filter((a) => a.status !== 'CANCELLED');
    const gone = (cls.attendees || []).filter((a) => a.status === 'CANCELLED');
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('div', { class: 'bz-inline' }, badge(t('ჯგუფური კლასი', 'Group class'), 'brand'), cls.status === 'CANCELLED' ? statusBadge('CANCELLED') : new Date(cls.endsAt) < new Date() ? badge(t('ჩატარდა', 'Held'), 'neutral') : null),
      seatsBlock(cls, color()),
      h('dl', { class: 'bz-kv' },
        h('dt', null, t('როდის', 'When')), h('dd', null, h('b', null, when(cls.startsAt)), ` – ${clock(cls.endsAt)} · ${minutes(cls.durationMin)}`),
        h('dt', null, t('მწვრთნელი', 'Trainer')), h('dd', null, h('span', { class: 'bz-inline' }, h('span', { class: 'bz-color-dot', style: { background: color() } }), cls.staffName || '—')),
        cls.resources && cls.resources.length ? [h('dt', null, t('სად', 'Where')), h('dd', null, h('span', { class: 'bz-tags' }, cls.resources.map((r) => h('span', { class: 'bz-tag' }, icon(r.kind === 'EQUIPMENT' ? 'zap' : 'door', { size: 12 }), r.name))))] : null,
        cls.servicePrice != null ? [h('dt', null, t('ფასი', 'Price')), h('dd', null, `${gel(cls.servicePrice)} ${t('ერთ ადგილზე', 'per seat')}`)] : null,
        cls.note ? [h('dt', null, t('შენიშვნა', 'Note')), h('dd', null, cls.note)] : null,
        cls.cancelReason ? [h('dt', null, t('გაუქმების მიზეზი', 'Cancel reason')), h('dd', null, cls.cancelReason)] : null),
      h('div', null,
        h('div', { class: 'bz-class-head' }, h('b', null, t('მონაწილეები', 'Attendees')), h('span', { class: 'bz-sub' }, live.length ? t(`${live.filter((a) => a.status === 'COMPLETED').length} მოვიდა · ${live.filter((a) => a.status === 'NO_SHOW').length} არ მოვიდა`, `${live.filter((a) => a.status === 'COMPLETED').length} came · ${live.filter((a) => a.status === 'NO_SHOW').length} no-show`) : '')),
        live.length ? h('div', { class: 'bz-attendees' }, live.map(attendeeRow)) : h('p', { class: 'bz-note' }, t('ჯერ არავინ ჩაწერილა. აპიდან ამ დროს ვინც ჩაიწერება, აქ გამოჩნდება.', 'Nobody yet. Whoever books this time from the app appears here.')),
        gone.length ? h('details', { class: 'bz-class-gone' }, h('summary', null, t(`გაუქმებული · ${gone.length}`, `Cancelled · ${gone.length}`)), h('div', { class: 'bz-attendees' }, gone.map(attendeeRow))) : null));
  }

  function attendeeRow(a) {
    const name = a.clientId ? h('a', { class: 'bz-link', href: `/business/clients/${a.clientId}`, 'data-link': '' }, a.clientName) : h('span', null, a.clientName);
    const quick = [];
    if (cls.status !== 'CANCELLED') {
      if (a.status === 'PENDING') quick.push(button(t('დადასტურება', 'Confirm'), { size: 'sm', onClick: () => patch(a, { status: 'CONFIRMED' }, t('დადასტურდა', 'Confirmed')) }));
      if (a.status === 'CONFIRMED') {
        quick.push(button(t('მოვიდა', 'Came'), { size: 'sm', icon: 'check', onClick: () => came(a) }));
        quick.push(button(t('არ მოვიდა', 'No-show'), { size: 'sm', variant: 'ghost', onClick: () => patch(a, { status: 'NO_SHOW' }, t('მონიშნულია: არ მოვიდა', 'Marked as no-show')) }));
      }
      if (a.status === 'COMPLETED' || a.status === 'NO_SHOW' || a.status === 'CANCELLED') quick.push(button('', { size: 'sm', variant: 'ghost', icon: 'undo', ariaLabel: t('აღდგენა', 'Restore'), title: t('აღდგენა', 'Restore'), onClick: () => patch(a, { status: 'CONFIRMED' }, t('აღდგენილია', 'Restored')) }));
    }
    quick.push(button('', { size: 'sm', variant: 'ghost', icon: 'moreH', ariaLabel: t('ჩანაწერის გახსნა', 'Open the booking'), title: t('ჩანაწერი — ფასი, გადახდა, შენიშვნა', 'The booking — price, payment, note'), onClick: () => openAppointment(a, ctx, { onChange: () => reload() }) }));
    return h('div', { class: `bz-attendee is-${a.status.toLowerCase()}` },
      avatar(a.clientName, '#64748B', 32),
      h('div', { class: 'who' }, h('b', null, name, a.source === 'APP' || a.source === 'WEB' ? h('span', { class: 'bz-tag bz-tag-app' }, t('აპი', 'App')) : null), h('span', { class: 'bz-sub' }, [a.clientPhone, a.paidAmount != null ? t(`გადახდილი ${gel(a.paidAmount)}`, `paid ${gel(a.paidAmount)}`) : a.price != null ? gel(a.price) : null].filter(Boolean).join(' · '))),
      statusBadge(a.status),
      h('div', { class: 'acts' }, quick));
  }

  async function patch(a, body, message) {
    try { await biz.patch(`/appointments/${a.id}`, body); await reload(message); } catch (e) { fail(e); }
  }

  /** „მოვიდა“ in one tap: the visit completes at the seat's price; a membership the client holds covers it first. */
  async function came(a) {
    try {
      const body = { status: 'COMPLETED', payment: {} };
      let covered = false;
      try {
        const o = await biz.get(`/appointments/${a.id}/payment-options`);
        if (o.memberships?.[0]) { body.payment.clientMembershipId = o.memberships[0].id; covered = true; }
      } catch { /* no options: plain price */ }
      if (!covered && a.price != null) body.paidAmount = a.price;
      await biz.patch(`/appointments/${a.id}`, body);
      await reload(covered ? t('მოვიდა ✓ · აბონემენტით', 'Came ✓ · by membership') : t('მოვიდა ✓', 'Came ✓'));
    } catch (e) { fail(e); }
  }

  function moveDialog() {
    const date = dateField({ value: ymd(cls.startsAt) });
    const time = timeField({ value: clock(cls.startsAt), from: '06:00', to: '23:45' });
    const who = select(ctx.staff.map((s) => ({ value: s.id, label: s.name })), cls.staffId || '');
    const seats = input({ type: 'number', min: Math.max(2, cls.booked), max: 200, value: cls.seats });
    const note = input({ value: cls.note || '', placeholder: t('მაგ. მოიტანეთ ხალიჩა', 'e.g. bring a mat') });
    const force = h('input', { type: 'checkbox' });
    const save = button(t('შენახვა', 'Save'));
    const m = openModal({ title: t('კლასის შეცვლა', 'Change the class'), size: 'sm',
      body: h('div', { class: 'form' },
        h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date.el), field(t('დრო', 'Time'), time.el)),
        field(t('მწვრთნელი', 'Trainer'), who),
        field(t('ადგილები', 'Seats'), seats, cls.booked ? t(`უკვე ${cls.booked} მონაწილეა — ნაკლები ვერ იქნება.`, `${cls.booked} already in — cannot go below.`) : undefined),
        field(t('შენიშვნა', 'Note'), note),
        h('label', { class: 'bz-inline', style: { fontSize: '13px', color: 'var(--text2)' } }, force, t('გადაიტანე მაინც, თუ დრო დაკავებულია', 'Move anyway even if the time is taken')),
        h('p', { class: 'bz-note' }, t('გადატანისას ყველა მონაწილეს შეტყობინება მიუვა (აპი ან SMS).', 'On a move every attendee is notified (app or SMS).'))),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save] });
    save.addEventListener('click', () => busy(save, async () => {
      try {
        if (!date.get() || !time.get()) throw new Error(t('აირჩიე დღე და დრო.', 'Pick a day and a time.'));
        const body = { startsAt: toIso(date.get(), time.get()), staffId: who.value, seats: Number(seats.value) || cls.seats, note: note.value.trim() || null, force: force.checked };
        const res = await biz.patch(`/classes/${cls.id}`, body);
        m.close();
        await reload(res.waitlistOffered ? t(`შენახულია · ძველი დრო მოლოდინის სიიდან ${res.waitlistOffered} კლიენტს შევთავაზეთ`, `Saved · the old time was offered to ${res.waitlistOffered} waiting`) : t('შენახულია', 'Saved'));
      } catch (e) { fail(e); }
    }));
  }

  function cancelDialog() {
    const reason = input({ placeholder: t('მიზეზი (მონაწილეები ნახავენ)', 'Reason (the attendees see it)') });
    const live = (cls.attendees || []).filter((a) => a.status === 'PENDING' || a.status === 'CONFIRMED').length;
    openModal({ title: t('კლასის გაუქმება', 'Cancel the class'), size: 'sm',
      body: h('div', { class: 'form' }, h('p', { class: 'muted' }, live ? t(`${live} მონაწილეს ჯავშანი გაუუქმდება და შეტყობინება მიუვა მიზეზთან ერთად.`, `${live} attendees lose their booking and are told, with the reason.`) : t('კლასში მონაწილე არ არის.', 'The class has no attendees.')), field(t('მიზეზი', 'Reason'), reason)),
      footer: (close) => [button(t('უკან', 'Back'), { variant: 'ghost', onClick: () => close() }), button(t('კლასის გაუქმება', 'Cancel class'), { variant: 'danger', onClick: async () => { close(); try { const res = await biz.patch(`/classes/${cls.id}`, { status: 'CANCELLED', cancelReason: reason.value.trim() }); await reload(res.waitlistOffered ? t(`გაუქმდა · მოლოდინის სიიდან ${res.waitlistOffered} კლიენტს დრო შევთავაზეთ`, `Cancelled · ${res.waitlistOffered} waiting were offered the time`) : t('კლასი გაუქმდა', 'Class cancelled')); } catch (e) { fail(e); } } })] });
  }

  function actions() {
    const out = [];
    const manage = canManage();
    if (cls.status !== 'CANCELLED') {
      out.push(button(t('მონაწილის დამატება', 'Add attendee'), { icon: 'userPlus', onClick: () => newAppointmentDialog(ctx, { date: ymd(cls.startsAt), time: clock(cls.startsAt), staffId: cls.staffId || '', serviceIds: [cls.serviceId] }, { onCreated: () => reload(t('ჩაწერილია', 'Booked')) }) }));
      if (manage) out.push(button(t('შეცვლა', 'Change'), { variant: 'ghost', icon: 'edit', onClick: moveDialog }));
      if (manage) out.push(button(t('გაუქმება', 'Cancel'), { variant: 'ghost', class: 'bz-bad', onClick: cancelDialog }));
    }
    if (manage && !cls.booked) out.push(button('', { variant: 'ghost', icon: 'trash', ariaLabel: t('წაშლა', 'Delete'), title: t('ცარიელი კლასის წაშლა', 'Delete the empty class'), onClick: async () => { if (await confirmDialog({ title: t('კლასის წაშლა?', 'Delete the class?'), body: t('ცარიელი კლასი კალენდრიდან გაქრება.', 'The empty class leaves the calendar.'), confirm: t('წაშლა', 'Delete'), danger: true })) { try { await biz.del(`/classes/${cls.id}`); ok(t('წაშლილია', 'Deleted')); d.close(); onChange?.(null); } catch (e) { fail(e); } } } }));
    return out;
  }
  return d;
}

/** The services with seats > 1 — the only ones a class can be planned for. */
export const classServices = (ctx) => ctx.services.filter((s) => Number(s.seats) > 1);

/**
 * Plan one class from the calendar. `preset` = { date, time, staffId, serviceId }.
 */
export function classDialog(ctx, preset = {}, { onCreated } = {}) {
  const options = classServices(ctx);
  if (!options.length) {
    openModal({ title: t('ახალი კლასი', 'New class'), size: 'sm', body: h('p', { class: 'muted' }, t('ჯერ არც ერთ სერვისს არ აქვს 2 ან მეტი ადგილი. სერვისების გვერდზე სერვისს „ადგილები“ შეუვსე — მაგ. იოგა, 15 — და აქ კლასს დაგეგმავ.', 'No service has 2 or more seats yet. On the Services page give a service "Seats" — e.g. Yoga, 15 — and plan classes here.')), footer: (close) => [button(t('გასაგებია', 'Got it'), { onClick: () => close() })] });
    return null;
  }
  const svc = select(options.map((s) => ({ value: s.id, label: `${s.name} · ${minutes(s.durationMin)} · ${seatsLabel(s.seats)}` })), preset.serviceId && options.some((s) => s.id === preset.serviceId) ? preset.serviceId : options[0].id);
  const eligible = () => ctx.staff.filter((p) => !p.serviceIds?.length || p.serviceIds.includes(svc.value));
  const who = select(eligible().map((s) => ({ value: s.id, label: s.name })), preset.staffId && eligible().some((s) => s.id === preset.staffId) ? preset.staffId : eligible()[0]?.id || '');
  const seats = input({ type: 'number', min: 2, max: 200, value: options.find((s) => s.id === svc.value)?.seats || 10 });
  svc.addEventListener('change', () => { who.setOptions(eligible().map((s) => ({ value: s.id, label: s.name })), eligible()[0]?.id || ''); seats.value = options.find((s) => s.id === svc.value)?.seats || seats.value; });
  const date = dateField({ value: preset.date || ymd() });
  const time = timeField({ value: preset.time || '18:00', from: '06:00', to: '23:45' });
  const note = input({ placeholder: t('არასავალდებულო', 'Optional') });
  const err = h('div', { class: 'form-error', hidden: true });
  const save = button(t('დაგეგმვა', 'Plan'), { icon: 'calendarPlus' });
  const m = openModal({ title: t('ახალი კლასი', 'New class'),
    body: h('div', { class: 'form' },
      field(t('სერვისი', 'Service'), svc),
      field(t('მწვრთნელი', 'Trainer'), who),
      h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date.el), field(t('დრო', 'Time'), time.el)),
      field(t('ადგილები', 'Seats'), seats),
      field(t('შენიშვნა', 'Note'), note),
      h('p', { class: 'bz-note' }, t('ცარიელი კლასი კალენდარზე „0 / N“-ით ჩანს; კლიენტები აპიდან ადგილებს იკავებენ. რამდენიმე კვირის წინ დასაგეგმად სერვისების გვერდზე „განრიგი“ გამოიყენე.', 'An empty class shows as "0 / N" on the calendar; clients take seats from the app. To plan weeks ahead use "Timetable" on the Services page.')),
      err),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save] });
  save.addEventListener('click', () => busy(save, async () => {
    err.hidden = true;
    try {
      if (!who.value) throw new Error(t('ამ სერვისს არავინ ასრულებს — ჯერ გუნდში მონიშნე.', 'Nobody performs this service — tick it on a team member first.'));
      if (!date.get() || !time.get()) throw new Error(t('აირჩიე დღე და დრო.', 'Pick a day and a time.'));
      const res = await biz.post('/classes', { serviceId: svc.value, staffId: who.value, startsAt: toIso(date.get(), time.get()), seats: Number(seats.value) || undefined, note: note.value.trim() || undefined });
      m.close();
      ok(t('კლასი დაგეგმილია', 'Class planned'));
      onCreated?.(res.class);
    } catch (e) { err.textContent = e?.message || t('ვერ შეიქმნა.', 'Could not create.'); err.hidden = false; }
  }));
  return m;
}

/**
 * „განრიგი“: a weekly template for one class service → the next weeks' classes. Reopens with the saved template.
 */
export function scheduleDialog(service, staff, { onDone } = {}) {
  const saved = service.classSchedule && typeof service.classSchedule === 'object' ? service.classSchedule : null;
  const people = staff.filter((p) => p.active !== false && (!p.serviceIds?.length || p.serviceIds.includes(service.id)));
  const who = select(people.map((s) => ({ value: s.id, label: s.name })), saved?.staffId && people.some((p) => p.id === saved.staffId) ? saved.staffId : people[0]?.id || '');
  const weeks = select([1, 2, 4, 8, 12].map((n) => ({ value: String(n), label: t(`${n} კვირა`, `${n} ${n === 1 ? 'week' : 'weeks'}`) })), String(saved?.weeks || 4));
  const seats = input({ type: 'number', min: 2, max: 200, value: service.seats > 1 ? service.seats : 10 });
  const rows = (saved?.weekly?.length ? saved.weekly : [{ weekday: 1, time: '18:00' }]).map((r) => ({ ...r }));
  const rowsHost = h('div', { class: 'bz-sched-rows' });
  const ahead = h('p', { class: 'bz-note' });
  const result = h('div', { class: 'bz-sched-result', hidden: true });
  const err = h('div', { class: 'form-error', hidden: true });
  const weekdayOptions = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: WEEKDAYS[d] }));
  function paintRows() {
    mount(rowsHost, rows.map((r, i) => {
      const day = select(weekdayOptions, String(r.weekday), { onChange: (e) => { r.weekday = Number(e.target.value); } });
      const time = timeField({ value: r.time, from: '06:00', to: '23:45', onChange: (v) => { r.time = v; } });
      return h('div', { class: 'bz-sched-row' }, day, time.el, button('', { variant: 'ghost', size: 'sm', icon: 'x', ariaLabel: t('ამოღება', 'Remove'), onClick: () => { rows.splice(i, 1); if (!rows.length) rows.push({ weekday: 1, time: '18:00' }); paintRows(); } }));
    }), h('div', null, button(t('კიდევ ერთი დრო', 'Another time'), { variant: 'ghost', size: 'sm', icon: 'plus', onClick: () => { const last = rows[rows.length - 1]; rows.push({ weekday: last ? (last.weekday + 2) % 7 : 1, time: last?.time || '18:00' }); paintRows(); } })));
  }
  paintRows();
  const today = ymd();
  biz.get('/classes', { from: today, to: addDays(today, 84), serviceId: service.id }).then(({ classes }) => {
    const open = classes.filter((c) => c.status !== 'CANCELLED');
    ahead.textContent = open.length ? t(`წინ უკვე ${open.length} კლასია დაგეგმილი (${open.reduce((s, c) => s + c.booked, 0)} ადგილი დაკავებული). იგივე დღე და დრო მეორედ არ შეიქმნება.`, `${open.length} classes are already planned ahead (${open.reduce((s, c) => s + c.booked, 0)} seats taken). The same day and time is never created twice.`) : t('წინ კლასი ჯერ არ არის დაგეგმილი. სანამ განრიგი არ გაქვს, კლიენტები ნებისმიერ თავისუფალ დროს იწერებიან და პირველი ჯავშანი ქმნის კლასს.', 'No class is planned ahead yet. Without a timetable clients book any free time and the first booking forms the class.');
  }).catch(() => { ahead.textContent = ''; });
  const save = button(t('კლასების შექმნა', 'Create the classes'), { icon: 'repeat' });
  const m = openModal({ title: t(`განრიგი — ${service.name}`, `Timetable — ${service.name}`),
    body: h('div', { class: 'form' },
      h('p', { class: 'muted', style: { margin: 0 } }, t('კვირის დღეები და საათები, რომლებზეც ეს კლასი ტარდება. ღილაკი მომდევნო კვირების კლასებს ცარიელ კლასებად ქმნის — კლიენტები აპიდან ადგილებს იკავებენ. განრიგის მქონე სერვისი აპში მხოლოდ ამ დროებს აჩვენებს.', 'The weekdays and times this class runs. The button creates the coming weeks as empty classes — clients take seats from the app. A service with a timetable shows only these times in the app.')),
      field(t('მწვრთნელი', 'Trainer'), who),
      field(t('როდის', 'When'), rowsHost),
      h('div', { class: 'form-row' }, field(t('რამდენი კვირა წინ', 'How many weeks ahead'), weeks), field(t('ადგილები', 'Seats'), seats)),
      ahead, result, err),
    footer: (close) => [button(t('დახურვა', 'Close'), { variant: 'ghost', onClick: () => close() }), save] });
  save.addEventListener('click', () => busy(save, async () => {
    err.hidden = true;
    result.hidden = true;
    try {
      if (!who.value) throw new Error(t('ამ სერვისს არავინ ასრულებს — ჯერ გუნდში მონიშნე.', 'Nobody performs this service — tick it on a team member first.'));
      if (rows.some((r) => !r.time)) throw new Error(t('ყველა სტრიქონს დრო სჭირდება.', 'Every row needs a time.'));
      const res = await biz.post('/classes/schedule', { serviceId: service.id, staffId: who.value, weekly: rows.map((r) => ({ weekday: Number(r.weekday), time: r.time })), weeks: Number(weeks.value), seats: Number(seats.value) || undefined });
      const dup = res.skipped.filter((s) => s.code === 'CLASS_EXISTS').length;
      const busyOnes = res.skipped.filter((s) => s.code !== 'CLASS_EXISTS');
      mount(result,
        h('div', { class: 'ok' }, icon('check', { size: 14 }), ' ', t(`შეიქმნა ${res.created.length} კლასი${dup ? ` · ${dup} უკვე იყო` : ''}`, `${res.created.length} classes created${dup ? ` · ${dup} already existed` : ''}`)),
        busyOnes.length ? h('div', { class: 'skipped' }, h('b', null, t(`გამოტოვებულია ${busyOnes.length}:`, `Skipped ${busyOnes.length}:`)), h('ul', null, busyOnes.slice(0, 8).map((s) => h('li', null, `${s.date} ${s.time} — ${s.message}`)), busyOnes.length > 8 ? h('li', null, '…') : null)) : null);
      result.hidden = false;
      ok(t(`შეიქმნა ${res.created.length} კლასი`, `${res.created.length} classes created`));
      onDone?.(res);
    } catch (e) { err.textContent = e?.message || t('ვერ შეიქმნა.', 'Could not create.'); err.hidden = false; }
  }));
  return m;
}

export { WEEKDAYS_SHORT, textarea };
