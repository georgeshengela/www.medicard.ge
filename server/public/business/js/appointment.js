// MEDIBOOK business panel — one appointment: the drawer (status, move, money, notes) and the new-booking dialog.
import { h, mount, icon, button, busy, field, input, textarea, select, badge, openModal, confirmDialog, debounce } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { openDrawer } from './drawer.js';
import { biz, statusBadge, methodLabel, METHODS, gel, minutes, when, clock, ymd, addDays, toIso, fail, ok, avatar, dayLabel, WEEKDAYS_SHORT, MONTHS_SHORT } from './shared.js';
import { canManage } from './state.js';

/** The staff + services lists most dialogs need. */
export async function loadContext() {
  const [{ staff }, { services }] = await Promise.all([biz.get('/staff'), biz.get('/services')]);
  return { staff: staff.filter((s) => s.active), services: services.filter((s) => s.active) };
}

const staffName = (ctx, id) => ctx.staff.find((s) => s.id === id)?.name || t('ნებისმიერი', 'Anyone');
const staffColor = (ctx, id) => ctx.staff.find((s) => s.id === id)?.color || '#A21CAF';

/**
 * Opens an appointment in the drawer. `onChange(appointment)` fires after every edit.
 */
export function openAppointment(appt, ctx, { onChange } = {}) {
  let a = appt;
  const d = openDrawer({ title: a.serviceName, body: () => render(), footer: () => actions() });

  function render() {
    const client = a.clientId
      ? h('a', { class: 'bz-link', href: `/business/clients/${a.clientId}`, 'data-link': '' }, a.clientName)
      : h('span', null, a.clientName);
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('div', { class: 'bz-inline' }, statusBadge(a.status), a.source === 'APP' ? badge(t('აპიდან', 'From the app'), 'brand') : a.source === 'WEB' ? badge(t('ვებიდან', 'From the web'), 'brand') : badge(t('ხელით', 'Walk-in'), 'neutral')),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, avatar(a.clientName, '#64748B', 44),
        h('div', null, h('div', { style: { fontWeight: 700, fontSize: '16px' } }, client), a.clientPhone ? h('a', { class: 'bz-sub', href: `tel:${a.clientPhone}` }, a.clientPhone) : h('span', { class: 'bz-sub' }, t('ტელეფონი არ არის', 'No phone')))),
      h('dl', { class: 'bz-kv' },
        h('dt', null, t('როდის', 'When')), h('dd', null, h('b', null, when(a.startsAt)), ` – ${clock(a.endsAt)} · ${minutes(a.durationMin)}`),
        h('dt', null, t('ვინ', 'Who')), h('dd', null, h('span', { class: 'bz-inline' }, h('span', { class: 'bz-color-dot', style: { background: a.staffColor || staffColor(ctx, a.staffId) } }), a.staffName || t('ნებისმიერი', 'Anyone'))),
        h('dt', null, t('ფასი', 'Price')), h('dd', null, gel(a.price), a.discountAmount ? h('span', { class: 'bz-sub' }, t(` (ფასდაკლება −${gel(a.discountAmount)})`, ` (discount −${gel(a.discountAmount)})`)) : null),
        a.paidAmount != null ? [h('dt', null, t('გადახდილი', 'Paid')), h('dd', null, `${gel(a.paidAmount)} · ${methodLabel(a.paidMethod)}`)] : null,
        a.note ? [h('dt', null, t('კლიენტის შენიშვნა', 'Client note')), h('dd', null, a.note)] : null,
        a.cancelReason ? [h('dt', null, t('გაუქმების მიზეზი', 'Cancel reason')), h('dd', null, a.cancelReason)] : null,
        h('dt', null, t('შეიქმნა', 'Created')), h('dd', { class: 'bz-sub' }, when(a.createdAt))),
      noteEditor(),
      moveEditor());
  }

  function noteEditor() {
    const ta = textarea({ rows: 2, value: a.internalNote || '', placeholder: t('შიდა შენიშვნა — კლიენტი არ ხედავს', 'Internal note — the client never sees it') });
    const save = debounce(async () => { try { a = (await biz.patch(`/appointments/${a.id}`, { internalNote: ta.value })).appointment; onChange?.(a); } catch (e) { fail(e); } }, 600);
    ta.addEventListener('input', save);
    return field(t('შიდა შენიშვნა', 'Internal note'), ta);
  }

  function moveEditor() {
    if (a.status === 'CANCELLED' || a.status === 'COMPLETED') return null;
    const date = input({ type: 'date', value: ymd(a.startsAt) });
    const time = input({ type: 'time', value: clock(a.startsAt), step: 300 });
    const who = select([{ value: '', label: t('ნებისმიერი', 'Anyone') }, ...ctx.staff.map((s) => ({ value: s.id, label: s.name }))], a.staffId || '');
    const svc = select(ctx.services.map((s) => ({ value: s.id, label: `${s.name} · ${minutes(s.durationMin)}` })), a.serviceId || '');
    const apply = button(t('გადატანა', 'Move'), { size: 'sm', variant: 'secondary', onClick: async () => {
      await busy(apply, async () => {
        try {
          const patch = { startsAt: toIso(date.value, time.value), staffId: who.value || null };
          if (svc.value && svc.value !== a.serviceId) patch.serviceId = svc.value;
          a = (await biz.patch(`/appointments/${a.id}`, patch)).appointment;
          ok(t('გადატანილია. კლიენტს შეტყობინება მივა.', 'Moved. The client is notified.'));
          d.setTitle(a.serviceName);
          d.setBody(render());
          d.setFooter(actions());
          onChange?.(a);
        } catch (e) { fail(e); }
      });
    } });
    return h('details', { class: 'bz-move' }, h('summary', { style: { cursor: 'pointer', fontWeight: 600, fontSize: '14px' } }, t('დროის, თანამშრომლის ან სერვისის შეცვლა', 'Change time, person or service')),
      h('div', { class: 'form', style: { marginTop: '10px' } }, h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date), field(t('დრო', 'Time'), time)), field(t('თანამშრომელი', 'Person'), who), ctx.services.length ? field(t('სერვისი', 'Service'), svc) : null, h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, apply)));
  }

  async function setStatus(status, extra = {}) {
    try {
      a = (await biz.patch(`/appointments/${a.id}`, { status, ...extra })).appointment;
      ok(t('შენახულია', 'Saved'));
      d.setBody(render());
      d.setFooter(actions());
      onChange?.(a);
    } catch (e) { fail(e); }
  }

  function completeDialog() {
    const price = input({ type: 'number', step: '0.01', min: 0, value: a.price ?? '' });
    const method = select(METHODS.map(([value, label]) => ({ value, label })), a.paidMethod || 'CASH');
    openModal({
      title: t('ვიზიტის დასრულება', 'Complete the visit'),
      size: 'sm',
      body: h('div', { class: 'form' }, h('p', { class: 'muted' }, t('თანხა შემოსავალში ჩაიწერება და კლიენტის ისტორიაში დაემატება.', 'The amount goes into income and onto the client history.')), field(t('გადახდილი თანხა, ₾', 'Amount paid, ₾'), price), field(t('გადახდის მეთოდი', 'Payment method'), method)),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), button(t('დასრულება', 'Complete'), { onClick: async () => { close(); await setStatus('COMPLETED', { paidAmount: price.value === '' ? null : Number(price.value), paidMethod: method.value }); } })],
    });
  }

  function cancelDialog() {
    const reason = input({ placeholder: t('მიზეზი (კლიენტი ნახავს)', 'Reason (the client sees it)') });
    openModal({
      title: t('ჯავშნის გაუქმება', 'Cancel the booking'),
      size: 'sm',
      body: h('div', { class: 'form' }, h('p', { class: 'muted' }, a.clientUserId ? t('კლიენტს აპში შეტყობინება მივა მიზეზთან ერთად.', 'The client gets a notification in the app with the reason.') : t('ვიზიტორს თავად დაუკავშირდი.', 'Reach the walk-in yourself.')), field(t('მიზეზი', 'Reason'), reason)),
      footer: (close) => [button(t('უკან', 'Back'), { variant: 'ghost', onClick: () => close() }), button(t('გაუქმება', 'Cancel booking'), { variant: 'danger', onClick: async () => { close(); await setStatus('CANCELLED', { cancelReason: reason.value.trim() }); } })],
    });
  }

  function actions() {
    const out = [];
    const manage = canManage();
    if (a.status === 'PENDING') out.push(button(t('დადასტურება', 'Confirm'), { icon: 'check', onClick: () => setStatus('CONFIRMED') }));
    if (a.status === 'CONFIRMED') {
      out.push(button(t('დასრულება', 'Complete'), { icon: 'check', onClick: completeDialog }));
      out.push(button(t('არ მოვიდა', 'No-show'), { variant: 'ghost', onClick: async () => { if (await confirmDialog({ title: t('არ მოვიდა?', 'No-show?'), body: t('კლიენტის ბარათზე გაცდენა ჩაიწერება.', 'A no-show is written on the client card.'), confirm: t('მონიშვნა', 'Mark') })) setStatus('NO_SHOW'); } }));
    }
    if (a.status === 'PENDING' || a.status === 'CONFIRMED') out.push(button(t('გაუქმება', 'Cancel'), { variant: 'ghost', class: 'bz-bad', onClick: cancelDialog }));
    if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') out.push(button(t('აღდგენა', 'Restore'), { variant: 'secondary', onClick: () => setStatus('CONFIRMED') }));
    if (a.status === 'COMPLETED' && manage) out.push(button(t('დასრულების გაუქმება', 'Undo completion'), { variant: 'ghost', onClick: () => setStatus('CONFIRMED') }));
    return out;
  }
  return d;
}

/**
 * New booking by the business: client (existing or new), service, person, day and a free time.
 * `preset` = { date, time, staffId, clientId, clientName, clientPhone }.
 */
export function newAppointmentDialog(ctx, preset = {}, { onCreated } = {}) {
  const err = h('div', { class: 'form-error', hidden: true });
  const clientQ = input({ placeholder: t('კლიენტის სახელი ან ტელეფონი…', 'Client name or phone…'), autocomplete: 'off', value: preset.clientName || '' });
  const clientList = h('div', { class: 'bz-geo-list' });
  const clientPhone = input({ type: 'tel', placeholder: t('ტელეფონი (არასავალდებულო)', 'Phone (optional)'), value: preset.clientPhone || '' });
  let clientId = preset.clientId || null;
  const picked = h('div', { class: 'bz-note' }, clientId ? t('არსებული კლიენტი არჩეულია', 'Existing client selected') : '');
  const searchClients = debounce(async () => {
    const term = clientQ.value.trim();
    clientId = null;
    picked.textContent = '';
    if (term.length < 2) { mount(clientList); return; }
    try {
      const { clients } = await biz.get('/clients', { q: term, limit: 6 });
      mount(clientList, clients.map((c) => h('button', { type: 'button', onClick: () => { clientId = c.id; clientQ.value = c.name; clientPhone.value = c.phone || ''; picked.textContent = t(`არსებული კლიენტი · ${c.visits} ვიზიტი`, `Existing client · ${c.visits} visits`); mount(clientList); } }, icon('user', { size: 14 }), ` ${c.name}`, c.phone ? h('span', { class: 'faint' }, ` · ${c.phone}`) : null)));
    } catch { mount(clientList); }
  }, 250);
  clientQ.addEventListener('input', searchClients);

  const svc = select(ctx.services.map((s) => ({ value: s.id, label: `${s.name} · ${minutes(s.durationMin)}${s.price != null ? ` · ${gel(s.price)}` : ''}` })), ctx.services[0]?.id || '');
  const who = select([{ value: '', label: t('ნებისმიერი', 'Anyone') }, ...ctx.staff.map((s) => ({ value: s.id, label: s.name }))], preset.staffId || '');
  const date = input({ type: 'date', value: preset.date || ymd() });
  const time = input({ type: 'time', value: preset.time || '', step: 300 });
  const slots = h('div', { class: 'bz-slots' });
  const note = textarea({ rows: 2, placeholder: t('შიდა შენიშვნა', 'Internal note') });
  const force = h('input', { type: 'checkbox' });
  let chosenIso = preset.date && preset.time ? toIso(preset.date, preset.time) : null;

  async function loadSlots() {
    if (!svc.value || !date.value) { mount(slots); return; }
    mount(slots, h('span', { class: 'faint' }, t('ვეძებ თავისუფალ დროებს…', 'Looking for free times…')));
    try {
      const r = await biz.get('/availability', { serviceId: svc.value, date: date.value, staffId: who.value || undefined });
      if (!r.slots.length) { mount(slots, h('span', { class: 'faint' }, r.reason === 'closed' ? t('ამ დღეს დახურულია — დროის ხელით ჩაწერა მაინც შეიძლება.', 'Closed this day — you can still type a time.') : t('თავისუფალი დრო არ არის — ჩაწერე ხელით და მონიშნე „მაინც“.', 'No free time — type one and tick "anyway".'))); return; }
      mount(slots, r.slots.map((s) => h('button', { type: 'button', class: chosenIso === s.startsAt ? 'on' : '', onClick: (e) => { chosenIso = s.startsAt; time.value = s.time; slots.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, s.time)));
    } catch (e) { mount(slots, h('span', { class: 'faint' }, e?.message || '')); }
  }
  [svc, who, date].forEach((el) => el.addEventListener('change', loadSlots));
  time.addEventListener('change', () => { chosenIso = date.value && time.value ? toIso(date.value, time.value) : null; slots.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === time.value)); });
  loadSlots();

  const submit = button(t('ჩაწერა', 'Book'), { type: 'submit' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    const startsAt = date.value && time.value ? toIso(date.value, time.value) : chosenIso;
    if (!startsAt) { err.textContent = t('აირჩიე დრო.', 'Pick a time.'); err.hidden = false; return; }
    if (!clientId && !clientQ.value.trim()) { err.textContent = t('მიუთითე კლიენტის სახელი.', 'Enter the client name.'); err.hidden = false; return; }
    await busy(submit, async () => {
      try {
        const res = await biz.post('/appointments', { serviceId: svc.value, staffId: who.value || null, startsAt, clientId: clientId || undefined, clientName: clientQ.value.trim() || undefined, clientPhone: clientPhone.value.trim() || undefined, internalNote: note.value.trim() || undefined, force: force.checked });
        close();
        ok(t('ჩაწერილია', 'Booked'));
        onCreated?.(res.appointment);
      } catch (e2) { err.textContent = e2?.message || t('ვერ ჩაიწერა.', 'Could not book.'); err.hidden = false; }
    });
  } },
  field(t('კლიენტი', 'Client'), clientQ, picked.textContent ? undefined : t('ჩაწერე სახელი — არსებული კლიენტი თავისით ამოვა.', 'Type a name — an existing client comes up by itself.')), clientList, picked,
  field(t('ტელეფონი', 'Phone'), clientPhone),
  field(t('სერვისი', 'Service'), svc),
  field(t('თანამშრომელი', 'Person'), who),
  h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date), field(t('დრო', 'Time'), time)),
  field(t('თავისუფალი დროები', 'Free times'), slots),
  field(t('შენიშვნა', 'Note'), note),
  h('label', { class: 'bz-inline', style: { fontSize: '13px', color: 'var(--text2)' } }, force, t('მაინც ჩაწერე, თუ დრო დაკავებულია (ორმაგი ჩანაწერი)', 'Book anyway even if the time is taken (double-booking)')),
  err, h('button', { type: 'submit', hidden: true }));
  let close = () => {};
  const m = openModal({ title: t('ახალი ჩანაწერი', 'New booking'), body: form, footer: (c) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => c() }), submit] });
  close = m.close;
  submit.addEventListener('click', (e) => { if (submit.type !== 'submit') { e.preventDefault(); form.requestSubmit(); } });
  return m;
}

/** A compact appointment line for lists. */
export function appointmentLine(a, ctx, { onOpen, onChange } = {}) {
  const color = a.staffColor || staffColor(ctx, a.staffId);
  return h('div', { class: `bz-slot${a.status === 'CANCELLED' ? ' is-cancelled' : ''}`, style: { cursor: 'pointer' }, onClick: () => (onOpen ? onOpen(a) : openAppointment(a, ctx, { onChange })) },
    h('div', { class: 'time' }, clock(a.startsAt), h('small', null, dayLabel(a.startsAt))),
    h('span', { class: 'bar', style: { background: color } }),
    h('div', { class: 'main' }, h('b', null, `${a.clientName} · ${a.serviceName}`), h('span', null, [a.staffName || staffName(ctx, a.staffId), minutes(a.durationMin), a.price != null ? gel(a.price) : null].filter(Boolean).join(' · '))),
    statusBadge(a.status));
}

export { dayLabel, addDays };
