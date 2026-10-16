// MEDIBOOK business panel — the new-booking dialog and the compact appointment line; the visit card itself is visit.js.
import { h, mount, icon, button, busy, field, input, textarea, openModal, debounce } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, statusBadge, gel, minutes, clock, ymd, addDays, toIso, ok, dayLabel } from './shared.js';
import { dateField, timeField, select } from './fields.js';

/** The staff + services lists most dialogs need. */
export async function loadContext() {
  const [{ staff }, { services }] = await Promise.all([biz.get('/staff'), biz.get('/services')]);
  return { staff: staff.filter((s) => s.active), services: services.filter((s) => s.active) };
}

const staffName = (ctx, id) => ctx.staff.find((s) => s.id === id)?.name || t('ნებისმიერი', 'Anyone');
const staffColor = (ctx, id) => ctx.staff.find((s) => s.id === id)?.color || '#64748B';

export { openAppointment } from './visit.js';

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

  // Services: one is the rule, but a visit can hold several (haircut + colour) — they follow one another with
  // the same person, so the dialog books one block of time for all of them.
  const chosen = [];
  const presetIds = (preset.serviceIds || []).filter((id) => ctx.services.some((s) => s.id === id));
  if (presetIds.length) chosen.push(...presetIds);
  else if (ctx.services[0]) chosen.push(ctx.services[0].id);
  const svcList = h('div', { class: 'bz-svc-pick' });
  const svcTotal = h('div', { class: 'bz-svc-total' });
  const svc = { get value() { return chosen[0] || ''; }, get values() { return [...chosen]; }, addEventListener(type, fn) { if (type === 'change') svcList.addEventListener('svc-change', fn); } };
  const isClass = (s) => Number(s?.seats) > 1;
  function paintServices() {
    const total = chosen.map((id) => ctx.services.find((s) => s.id === id)).filter(Boolean);
    mount(svcList, ctx.services.map((s) => {
      const on = chosen.includes(s.id);
      return h('label', { class: `bz-svc-row${on ? ' on' : ''}` },
        h('input', { type: 'checkbox', checked: on, onChange: () => {
          // A group class is booked on its own — one seat, no other service in the same visit.
          if (chosen.includes(s.id)) { if (chosen.length > 1) chosen.splice(chosen.indexOf(s.id), 1); } else if (isClass(s) || total.some(isClass)) chosen.splice(0, chosen.length, s.id); else if (chosen.length < 8) chosen.push(s.id);
          paintServices(); svcList.dispatchEvent(new Event('svc-change'));
        } }),
        h('span', { class: 'name' }, s.name, isClass(s) ? h('span', { class: 'bz-tag bz-tag-app' }, t(`${s.seats} ადგილი`, `${s.seats} seats`)) : null),
        h('span', { class: 'meta' }, [minutes(s.durationMin), s.price != null ? gel(s.price) : null].filter(Boolean).join(' · ')));
    }));
    const mins = total.reduce((sum, s) => sum + Number(s.durationMin), 0);
    const price = total.some((s) => s.price != null) ? total.reduce((sum, s) => sum + Number(s.price ?? 0), 0) : null;
    mount(svcTotal, total.length > 1
      ? [h('b', null, t(`${total.length} სერვისი`, `${total.length} services`)), h('span', null, [minutes(mins), price != null ? gel(price) : null].filter(Boolean).join(' · '))]
      : total.length && isClass(total[0]) ? h('span', { class: 'bz-sub' }, t(`ჯგუფური კლასი — ერთ დროს ${total[0].seats} ადგილი; ეს ჩანაწერი ერთ ადგილს იკავებს.`, `Group class — ${total[0].seats} seats at one time; this booking takes one seat.`))
        : total.length ? h('span', { class: 'bz-sub' }, t('მონიშნე კიდევ ერთი, თუ ვიზიტი რამდენიმე სერვისს მოიცავს.', 'Tick another one when the visit holds several services.')) : null);
  }
  paintServices();
  const who = select([{ value: '', label: t('ნებისმიერი', 'Anyone') }, ...ctx.staff.map((s) => ({ value: s.id, label: s.name }))], preset.staffId || '');
  const time = timeField({ value: preset.time || '', onChange: () => { chosenIso = null; paintQuick(); } });
  const date = dateField({ value: preset.date || ymd(), onChange: () => loadSlots() });
  const quick = h('div', { class: 'bz-quick' });
  const classNote = h('div', { class: 'bz-note bz-class-note', hidden: true });
  const note = textarea({ rows: 2, placeholder: t('შიდა შენიშვნა', 'Internal note') });
  const force = h('input', { type: 'checkbox' });
  let chosenIso = preset.date && preset.time ? toIso(preset.date, preset.time) : null;
  let freeSlots = [];
  let scheduled = false;

  // Under the day/time row: how many free times there are and the first few as one-tap chips; the full grid
  // (free times tinted) opens from the time field itself. For a class, every chip says how many seats are left
  // and the chosen time names its class.
  function paintQuick() {
    const classy = isClass(ctx.services.find((s) => s.id === svc.value));
    const at = time.get() ? freeSlots.find((s) => s.time === time.get()) : null;
    classNote.hidden = !(classy && time.get());
    if (classy && time.get()) {
      mount(classNote, at?.classId
        ? t(`ამ დროს კლასი უკვე არის — ${at.booked} / ${at.seats} ადგილი დაკავებულია, ${at.seatsLeft} თავისუფალი. ეს ჩანაწერი მასში ჩაიწერება.`, `A class already runs at this time — ${at.booked} / ${at.seats} seats taken, ${at.seatsLeft} free. This booking joins it.`)
        : at ? t('ამ დროს კლასი ჯერ არ არის — ეს ჩანაწერი ახალ კლასს გახსნის, დანარჩენი ადგილები აპიდან შეივსება.', 'No class at this time yet — this booking opens a new one; the other seats fill from the app.')
          : scheduled ? t('ეს დრო განრიგში არ არის. კლასი მხოლოდ განრიგის დროებზე იწერება — ან მონიშნე „მაინც“ და ახალი კლასი შეიქმნება.', 'This time is not on the timetable. Seats are booked only at timetable times — or tick "anyway" to open a new class.')
            : t('ამ დროს კლასი სავსეა ან დრო დაკავებულია.', 'The class at this time is full or the time is taken.'));
    }
    if (!freeSlots.length) return;
    mount(quick,
      h('span', null, classy ? t(`${freeSlots.length} კლასი / დრო`, `${freeSlots.length} ${freeSlots.length === 1 ? 'class / time' : 'classes / times'}`) : t(`${freeSlots.length} თავისუფალი დრო`, `${freeSlots.length} free ${freeSlots.length === 1 ? 'time' : 'times'}`)),
      freeSlots.slice(0, 7).map((s) => h('button', { type: 'button', class: time.get() === s.time ? 'on' : '', title: s.classId ? t(`კლასი · ${s.seatsLeft} ადგილი დარჩა`, `Class · ${s.seatsLeft} seats left`) : undefined, onClick: () => { time.set(s.time); chosenIso = s.startsAt; paintQuick(); } }, s.time, s.classId ? h('small', null, ` · ${s.seatsLeft}`) : null)),
      freeSlots.length > 7 ? h('button', { type: 'button', class: 'more', onClick: () => time.button.click() }, t('ყველა…', 'All…')) : null);
  }
  async function loadSlots() {
    freeSlots = [];
    scheduled = false;
    if (!svc.value || !date.get()) { time.configure({ free: null }); mount(quick); classNote.hidden = true; return; }
    mount(quick, h('span', null, t('ვეძებ თავისუფალ დროებს…', 'Looking for free times…')));
    try {
      const r = await biz.get('/availability', { serviceIds: svc.values.join(','), date: date.get(), staffId: who.value || undefined });
      freeSlots = r.slots;
      scheduled = Boolean(r.scheduled);
      time.configure({ free: new Set(r.slots.map((s) => s.time)) });
      if (!r.slots.length) { mount(quick, h('span', null, r.reason === 'closed' ? t('ამ დღეს დახურულია — დროის არჩევა მაინც შეიძლება.', 'Closed this day — a time can still be picked.') : scheduled ? t('ამ დღეს განრიგში კლასი არ არის.', 'No class on the timetable this day.') : t('თავისუფალი დრო არ არის — აირჩიე მაინც და მონიშნე „მაინც“.', 'No free time — pick one anyway and tick "anyway".'))); paintQuick(); return; }
      paintQuick();
    } catch (e) { mount(quick, h('span', null, e?.message || '')); }
  }
  [svc, who].forEach((el) => el.addEventListener('change', loadSlots));
  loadSlots();

  // The button lives in the modal footer, outside the form, so it submits the form by hand.
  const submit = button(t('ჩაწერა', 'Book'), { icon: 'check' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    const startsAt = date.get() && time.get() ? toIso(date.get(), time.get()) : chosenIso;
    if (!startsAt) { err.textContent = t('აირჩიე დრო.', 'Pick a time.'); err.hidden = false; return; }
    if (!clientId && !clientQ.value.trim()) { err.textContent = t('მიუთითე კლიენტის სახელი.', 'Enter the client name.'); err.hidden = false; return; }
    await busy(submit, async () => {
      try {
        const res = await biz.post('/appointments', { serviceIds: svc.values, staffId: who.value || null, startsAt, clientId: clientId || undefined, clientName: clientQ.value.trim() || undefined, clientPhone: clientPhone.value.trim() || undefined, internalNote: note.value.trim() || undefined, force: force.checked });
        close();
        ok(t('ჩაწერილია', 'Booked'));
        onCreated?.(res.appointment);
      } catch (e2) { err.textContent = e2?.message || t('ვერ ჩაიწერა.', 'Could not book.'); err.hidden = false; }
    });
  } },
  field(t('კლიენტი', 'Client'), clientQ, picked.textContent ? undefined : t('ჩაწერე სახელი — არსებული კლიენტი თავისით ამოვა.', 'Type a name — an existing client comes up by itself.')), clientList, picked,
  field(t('ტელეფონი', 'Phone'), clientPhone),
  field(t('სერვისი', 'Service'), h('div', null, svcList, svcTotal)),
  field(t('თანამშრომელი', 'Person'), who),
  h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date.el), field(t('დრო', 'Time'), time.el)),
  quick,
  classNote,
  field(t('შენიშვნა', 'Note'), note),
  h('label', { class: 'bz-inline', style: { fontSize: '13px', color: 'var(--text2)' } }, force, t('მაინც ჩაწერე, თუ დრო დაკავებულია (ორმაგი ჩანაწერი)', 'Book anyway even if the time is taken (double-booking)')),
  err, h('button', { type: 'submit', hidden: true }));
  let close = () => {};
  const m = openModal({ title: t('ახალი ჩანაწერი', 'New booking'), body: form, footer: (c) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => c() }), submit] });
  close = m.close;
  submit.addEventListener('click', (e) => { e.preventDefault(); form.requestSubmit(); });
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
