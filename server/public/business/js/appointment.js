// MEDIBOOK business panel — one appointment: the drawer (status, move, money, notes) and the new-booking dialog.
import { h, mount, icon, button, busy, field, input, textarea, select, badge, openModal, confirmDialog, debounce } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { openDrawer } from './drawer.js';
import { biz, statusBadge, methodLabel, METHODS, gel, minutes, when, clock, ymd, addDays, toIso, fail, ok, avatar, dayLabel, WEEKDAYS_SHORT, MONTHS_SHORT } from './shared.js';
import { canManage } from './state.js';
import { dateField, timeField } from './fields.js';

/** The staff + services lists most dialogs need. */
export async function loadContext() {
  const [{ staff }, { services }] = await Promise.all([biz.get('/staff'), biz.get('/services')]);
  return { staff: staff.filter((s) => s.active), services: services.filter((s) => s.active) };
}

const staffName = (ctx, id) => ctx.staff.find((s) => s.id === id)?.name || t('ნებისმიერი', 'Anyone');
const staffColor = (ctx, id) => ctx.staff.find((s) => s.id === id)?.color || '#64748B';

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
        a.services && a.services.length > 1 ? [h('dt', null, t('სერვისები', 'Services')), h('dd', null, h('ul', { class: 'bz-svc-list' }, a.services.map((x) => h('li', null, h('span', null, x.name), h('span', { class: 'bz-sub' }, [minutes(x.durationMin), x.price != null ? gel(x.price) : null].filter(Boolean).join(' · '))))))] : null,
        h('dt', null, t('ფასი', 'Price')), h('dd', null, gel(a.price), a.discountAmount ? h('span', { class: 'bz-sub' }, t(` (ფასდაკლება −${gel(a.discountAmount)})`, ` (discount −${gel(a.discountAmount)})`)) : null),
        a.paidParts && (a.paidParts.giftAmount || a.paidParts.bonusAmount || a.paidParts.membershipAmount) ? [h('dt', null, t('როგორ გადაიხადა', 'How it was paid')), h('dd', { class: 'bz-sub' }, [a.paidParts.cashAmount ? t(`${gel(a.paidParts.cashAmount)} ფულით`, `${gel(a.paidParts.cashAmount)} in money`) : null, a.paidParts.membershipAmount ? t(`${gel(a.paidParts.membershipAmount)} აბონემენტით`, `${gel(a.paidParts.membershipAmount)} by membership`) : null, a.paidParts.giftAmount ? t(`${gel(a.paidParts.giftAmount)} ბარათით ${a.paidParts.giftCode || ''}`, `${gel(a.paidParts.giftAmount)} by gift card ${a.paidParts.giftCode || ''}`) : null, a.paidParts.bonusAmount ? t(`${gel(a.paidParts.bonusAmount)} ბონუსით`, `${gel(a.paidParts.bonusAmount)} in bonus`) : null, a.paidParts.bonusEarned ? t(`დაერიცხა +${gel(a.paidParts.bonusEarned)}`, `earned +${gel(a.paidParts.bonusEarned)}`) : null].filter(Boolean).join(' · '))] : null,
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
    const who = select([{ value: '', label: t('ნებისმიერი', 'Anyone') }, ...ctx.staff.map((s) => ({ value: s.id, label: s.name }))], a.staffId || '');
    const svc = select(ctx.services.map((s) => ({ value: s.id, label: `${s.name} · ${minutes(s.durationMin)}` })), a.serviceId || '');
    const time = timeField({ value: clock(a.startsAt) });
    // Free times for the chosen day / person / service tint the time grid.
    const refresh = async () => {
      try {
        const r = await biz.get('/availability', { serviceId: svc.value || a.serviceId, date: date.get(), staffId: who.value || undefined });
        time.configure({ free: new Set(r.slots.map((s) => s.time)) });
      } catch { time.configure({ free: null }); }
    };
    const date = dateField({ value: ymd(a.startsAt), onChange: refresh });
    who.addEventListener('change', refresh);
    svc.addEventListener('change', refresh);
    refresh();
    const apply = button(t('გადატანა', 'Move'), { size: 'sm', variant: 'secondary', onClick: async () => {
      await busy(apply, async () => {
        try {
          if (!date.get() || !time.get()) throw new Error(t('აირჩიე დღე და დრო.', 'Pick a day and a time.'));
          const patch = { startsAt: toIso(date.get(), time.get()), staffId: who.value || null };
          if (svc.value && svc.value !== a.serviceId) patch.serviceId = svc.value;
          const res = await biz.patch(`/appointments/${a.id}`, patch);
          a = res.appointment;
          ok(res.waitlistOffered ? t(`გადატანილია · ძველი დრო მოლოდინის სიიდან ${res.waitlistOffered} კლიენტს შევთავაზეთ`, `Moved · the old time was offered to ${res.waitlistOffered} waiting ${res.waitlistOffered === 1 ? 'client' : 'clients'}`) : t('გადატანილია. კლიენტს შეტყობინება მივა.', 'Moved. The client is notified.'));
          d.setTitle(a.serviceName);
          d.setBody(render());
          d.setFooter(actions());
          onChange?.(a);
        } catch (e) { fail(e); }
      });
    } });
    return h('details', { class: 'bz-move' }, h('summary', { style: { cursor: 'pointer', fontWeight: 600, fontSize: '14px' } }, t('დროის, თანამშრომლის ან სერვისის შეცვლა', 'Change time, person or service')),
      h('div', { class: 'form', style: { marginTop: '10px' } }, h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date.el), field(t('დრო', 'Time'), time.el)), field(t('თანამშრომელი', 'Person'), who), ctx.services.length ? field(t('სერვისი', 'Service'), svc) : null, h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, apply)));
  }

  async function setStatus(status, extra = {}) {
    try {
      const res = await biz.patch(`/appointments/${a.id}`, { status, ...extra });
      a = res.appointment;
      ok(res.waitlistOffered ? t(`შენახულია · მოლოდინის სიიდან ${res.waitlistOffered} კლიენტს დრო შევთავაზეთ`, `Saved · ${res.waitlistOffered} waiting ${res.waitlistOffered === 1 ? 'client was' : 'clients were'} offered the time`) : t('შენახულია', 'Saved'));
      d.setBody(render());
      d.setFooter(actions());
      onChange?.(a);
    } catch (e) { fail(e); }
  }

  /**
   * Completing: the price, then what covers it besides money — a membership the client holds, a gift-card code,
   * bonus from the client card (up to the business's share) — and the money that is left, editable. Cashback the
   * client earns is shown before the button.
   */
  function completeDialog() {
    const price = Number(a.price ?? 0);
    const err = h('div', { class: 'form-error', hidden: true });
    const member = select([{ value: '', label: t('არ გამოიყენო', 'Do not use') }], '');
    const giftCode = input({ placeholder: t('მაგ. AB12-CD34', 'e.g. AB12-CD34'), style: { textTransform: 'uppercase' }, autocomplete: 'off' });
    const giftInfo = h('div', { class: 'bz-note' });
    const bonus = input({ type: 'number', min: 0, step: '0.5', value: 0 });
    const bonusInfo = h('div', { class: 'bz-note' });
    const cash = input({ type: 'number', step: '0.01', min: 0, value: a.paidAmount ?? (a.price ?? '') });
    const method = select(METHODS.map(([value, label]) => ({ value, label })), a.paidMethod || 'CASH');
    const summary = h('div', { class: 'bz-pay-summary' });
    let opts = null;
    let gift = null;
    let cashTouched = false;
    cash.addEventListener('input', () => { cashTouched = true; paintSummary(); });
    const n2 = (v) => Math.round(Number(v || 0) * 100) / 100;
    function parts() {
      let left = price;
      const m = opts?.memberships.find((x) => x.id === member.value) || null;
      let membershipAmount = 0;
      if (m && left > 0) { membershipAmount = m.kind === 'VISITS' ? left : Math.min(left, n2(m.amountLeft)); left = n2(left - membershipAmount); }
      let giftAmount = 0;
      if (gift && left > 0) { giftAmount = Math.min(left, n2(gift.balance)); left = n2(left - giftAmount); }
      const cap = opts ? Math.min(n2(opts.maxBonus), left) : 0;
      const bonusAmount = Math.min(n2(bonus.value), cap);
      left = n2(left - bonusAmount);
      return { membershipAmount, giftAmount, bonusAmount, cap, rest: left, m };
    }
    function paintSummary() {
      const x = parts();
      bonus.max = String(x.cap);
      if (!cashTouched) cash.value = x.rest;
      const pct = opts?.loyalty?.cashbackPercent || 0;
      const earn = pct > 0 ? n2(Number(cash.value || 0) * pct / 100) + (opts?.firstVisit ? n2(opts.loyalty.welcomeBonus || 0) : 0) : 0;
      mount(summary,
        h('div', null, h('span', null, t('ფასი', 'Price')), h('b', null, gel(price))),
        x.membershipAmount ? h('div', null, h('span', null, t('აბონემენტი', 'Membership')), h('b', null, `−${gel(x.membershipAmount)}`)) : null,
        x.giftAmount ? h('div', null, h('span', null, t('სასაჩუქრე ბარათი', 'Gift card')), h('b', null, `−${gel(x.giftAmount)}`)) : null,
        x.bonusAmount ? h('div', null, h('span', null, t('ბონუსი', 'Bonus')), h('b', null, `−${gel(x.bonusAmount)}`)) : null,
        h('div', { class: 'total' }, h('span', null, t('ფულით', 'In money')), h('b', null, gel(Number(cash.value || 0)))),
        earn > 0 ? h('div', { class: 'earn' }, h('span', null, t('კლიენტს დაერიცხება', 'The client earns')), h('b', null, `+${gel(earn)}`)) : null);
    }
    const checkGift = debounce(async () => {
      const code = giftCode.value.trim();
      gift = null;
      if (code.length < 8) { mount(giftInfo); paintSummary(); return; }
      try {
        const r = await biz.get('/gift-cards/find', { code });
        if (!r.giftCard) mount(giftInfo, h('span', { class: 'bz-bad' }, t('ასეთი ბარათი არ არის.', 'No such card.')));
        else if (r.giftCard.status !== 'ACTIVE' || r.giftCard.balance <= 0) mount(giftInfo, h('span', { class: 'bz-bad' }, t('ბარათი აქტიური არ არის.', 'The card is not active.')));
        else { gift = r.giftCard; mount(giftInfo, t(`ბალანსი ${gel(gift.balance)}${gift.recipientName ? ` · ${gift.recipientName}` : ''}`, `Balance ${gel(gift.balance)}${gift.recipientName ? ` · ${gift.recipientName}` : ''}`)); }
      } catch (e) { mount(giftInfo, h('span', { class: 'bz-bad' }, e?.message || '')); }
      paintSummary();
    }, 300);
    giftCode.addEventListener('input', checkGift);
    bonus.addEventListener('input', paintSummary);
    member.addEventListener('change', paintSummary);
    const allBonus = button(t('ყველა', 'All'), { size: 'sm', variant: 'ghost', onClick: () => { bonus.value = parts().cap; paintSummary(); } });
    const complete = button(t('დასრულება', 'Complete'));
    const m = openModal({
      title: t('ვიზიტის დასრულება', 'Complete the visit'),
      size: 'sm',
      body: h('div', { class: 'form' },
        a.clientId ? field(t('აბონემენტი', 'Membership'), member) : null,
        field(t('სასაჩუქრე ბარათი', 'Gift card'), giftCode), giftInfo,
        a.clientId ? [field(t('ბონუსით, ₾', 'With bonus, ₾'), h('div', { class: 'bz-inline' }, bonus, allBonus)), bonusInfo] : null,
        h('div', { class: 'form-row' }, field(t('ფულით, ₾', 'In money, ₾'), cash), field(t('გადახდის მეთოდი', 'Payment method'), method)),
        summary, err),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), complete],
    });
    complete.addEventListener('click', () => busy(complete, async () => {
      err.hidden = true;
      const x = parts();
      const payment = {};
      if (gift) payment.giftCode = gift.code;
      if (x.bonusAmount > 0) payment.bonusAmount = x.bonusAmount;
      if (x.m) payment.clientMembershipId = x.m.id;
      m.close();
      await setStatus('COMPLETED', { paidAmount: cash.value === '' ? null : Number(cash.value), paidMethod: method.value, payment });
    }));
    biz.get(`/appointments/${a.id}/payment-options`).then((o) => {
      opts = o;
      mount(member, [h('option', { value: '' }, t('არ გამოიყენო', 'Do not use')), ...o.memberships.map((x) => h('option', { value: x.id }, `${x.title} · ${x.kind === 'VISITS' ? t(`დარჩა ${x.visitsLeft}`, `${x.visitsLeft} left`) : gel(x.amountLeft)}`))]);
      if (o.memberships.length) member.value = o.memberships[0].id;
      mount(bonusInfo, o.bonusBalance > 0 ? t(`კლიენტს აქვს ${gel(o.bonusBalance)} ბონუსი; ამ ვიზიტზე მაქს. ${gel(o.maxBonus)}`, `The client has ${gel(o.bonusBalance)} in bonus; at most ${gel(o.maxBonus)} on this visit`) : t('ბონუსი არ აქვს.', 'No bonus yet.'));
      paintSummary();
    }).catch(() => { opts = { memberships: [], bonusBalance: 0, maxBonus: 0, loyalty: { cashbackPercent: 0 } }; paintSummary(); });
    paintSummary();
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

  // Services: one is the rule, but a visit can hold several (haircut + colour) — they follow one another with
  // the same person, so the dialog books one block of time for all of them.
  const chosen = [];
  const presetIds = (preset.serviceIds || []).filter((id) => ctx.services.some((s) => s.id === id));
  if (presetIds.length) chosen.push(...presetIds);
  else if (ctx.services[0]) chosen.push(ctx.services[0].id);
  const svcList = h('div', { class: 'bz-svc-pick' });
  const svcTotal = h('div', { class: 'bz-svc-total' });
  const svc = { get value() { return chosen[0] || ''; }, get values() { return [...chosen]; }, addEventListener(type, fn) { if (type === 'change') svcList.addEventListener('svc-change', fn); } };
  function paintServices() {
    const total = chosen.map((id) => ctx.services.find((s) => s.id === id)).filter(Boolean);
    mount(svcList, ctx.services.map((s) => {
      const on = chosen.includes(s.id);
      return h('label', { class: `bz-svc-row${on ? ' on' : ''}` },
        h('input', { type: 'checkbox', checked: on, onChange: () => { if (chosen.includes(s.id)) { if (chosen.length > 1) chosen.splice(chosen.indexOf(s.id), 1); } else if (chosen.length < 8) chosen.push(s.id); paintServices(); svcList.dispatchEvent(new Event('svc-change')); } }),
        h('span', { class: 'name' }, s.name),
        h('span', { class: 'meta' }, [minutes(s.durationMin), s.price != null ? gel(s.price) : null].filter(Boolean).join(' · ')));
    }));
    const mins = total.reduce((sum, s) => sum + Number(s.durationMin), 0);
    const price = total.some((s) => s.price != null) ? total.reduce((sum, s) => sum + Number(s.price ?? 0), 0) : null;
    mount(svcTotal, total.length > 1
      ? [h('b', null, t(`${total.length} სერვისი`, `${total.length} services`)), h('span', null, [minutes(mins), price != null ? gel(price) : null].filter(Boolean).join(' · '))]
      : total.length ? h('span', { class: 'bz-sub' }, t('მონიშნე კიდევ ერთი, თუ ვიზიტი რამდენიმე სერვისს მოიცავს.', 'Tick another one when the visit holds several services.')) : null);
  }
  paintServices();
  const who = select([{ value: '', label: t('ნებისმიერი', 'Anyone') }, ...ctx.staff.map((s) => ({ value: s.id, label: s.name }))], preset.staffId || '');
  const time = timeField({ value: preset.time || '', onChange: () => { chosenIso = null; paintQuick(); } });
  const date = dateField({ value: preset.date || ymd(), onChange: () => loadSlots() });
  const quick = h('div', { class: 'bz-quick' });
  const note = textarea({ rows: 2, placeholder: t('შიდა შენიშვნა', 'Internal note') });
  const force = h('input', { type: 'checkbox' });
  let chosenIso = preset.date && preset.time ? toIso(preset.date, preset.time) : null;
  let freeSlots = [];

  // Under the day/time row: how many free times there are and the first few as one-tap chips; the full grid
  // (free times tinted) opens from the time field itself.
  function paintQuick() {
    if (!freeSlots.length) return;
    mount(quick,
      h('span', null, t(`${freeSlots.length} თავისუფალი დრო`, `${freeSlots.length} free ${freeSlots.length === 1 ? 'time' : 'times'}`)),
      freeSlots.slice(0, 7).map((s) => h('button', { type: 'button', class: time.get() === s.time ? 'on' : '', onClick: () => { time.set(s.time); chosenIso = s.startsAt; paintQuick(); } }, s.time)),
      freeSlots.length > 7 ? h('button', { type: 'button', class: 'more', onClick: () => time.button.click() }, t('ყველა…', 'All…')) : null);
  }
  async function loadSlots() {
    freeSlots = [];
    if (!svc.value || !date.get()) { time.configure({ free: null }); mount(quick); return; }
    mount(quick, h('span', null, t('ვეძებ თავისუფალ დროებს…', 'Looking for free times…')));
    try {
      const r = await biz.get('/availability', { serviceIds: svc.values.join(','), date: date.get(), staffId: who.value || undefined });
      freeSlots = r.slots;
      time.configure({ free: new Set(r.slots.map((s) => s.time)) });
      if (!r.slots.length) { mount(quick, h('span', null, r.reason === 'closed' ? t('ამ დღეს დახურულია — დროის არჩევა მაინც შეიძლება.', 'Closed this day — a time can still be picked.') : t('თავისუფალი დრო არ არის — აირჩიე მაინც და მონიშნე „მაინც“.', 'No free time — pick one anyway and tick "anyway".'))); return; }
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
