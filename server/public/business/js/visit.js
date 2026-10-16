// MEDIBOOK business panel — the visit card: one booking on one screen with everything the desk needs — when and
// with whom (the time as the hero, with where the visit stands right now), the services and the money, the
// client's card at a glance (warnings, numbers, last visits, this visit's photos), the booking's own history,
// the internal note, moving it, and the decisions in the footer. Opened from the calendar, the lists and the
// client card; `onChange(appointment)` fires after every edit.
import { h, mount, icon, iconButton, button, busy, field, input, textarea, badge, openModal, confirmDialog, debounce } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, statusBadge, methodLabel, METHODS, gel, minutes, clock, ymd, toIso, fail, ok, avatar, dayLabel, phoneText, WEEKDAYS, MONTHS, MONTHS_SHORT } from './shared.js';
import { canManage } from './state.js';
import { dateField, timeField, select } from './fields.js';
import { saleDialog } from './sale.js';

const SOURCE = { APP: ['აპიდან', 'From the app'], WEB: ['ვებიდან', 'From the web'], BUSINESS: ['პანელიდან', 'From the panel'] };
const CLIENT_SOURCE = { APP: ['აპიდან', 'the app'], WALK_IN: ['შემოიარა', 'walk-in'], PHONE: ['ტელეფონით', 'by phone'], INSTAGRAM: ['Instagram', 'Instagram'], FACEBOOK: ['Facebook', 'Facebook'], REFERRAL: ['რეკომენდაციით', 'referral'], OTHER: ['სხვა', 'other'] };
const DOT = { PENDING: 'var(--warn)', CONFIRMED: 'var(--book)', COMPLETED: 'var(--ok)', NO_SHOW: 'var(--danger)', CANCELLED: 'var(--text3)' };
const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
const OPEN = ['PENDING', 'CONFIRMED'];
const n2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const shift = (v) => new Date(new Date(v).getTime() + 4 * 3600e3);
const staffOf = (ctx, id) => ctx.staff.find((s) => s.id === id) || null;
const nameTone = (name) => { let x = 0; for (const ch of String(name || '')) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[x % PALETTE.length]; };

/** „ხუთშაბათი, 16 ოქტომბერი“ (+ the year when it is another year). */
function longDay(v) {
  const d = shift(v);
  const y = d.getUTCFullYear() === shift(new Date()).getUTCFullYear() ? '' : ` ${d.getUTCFullYear()}`;
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${y}`;
}
/** „16 ოქტ, 14:02“ */
function stamp(v) { const d = shift(v); return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}, ${clock(v)}`; }
function spanText(ms) {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 60) return t(`${m} წთ`, `${m} min`);
  const hh = Math.floor(m / 60); const mm = m % 60;
  if (m < 48 * 60) return mm && hh < 6 ? t(`${hh} სთ ${mm} წთ`, `${hh} h ${mm} min`) : t(`${hh} სთ`, `${hh} h`);
  const d = Math.round(m / 1440); return t(`${d} დღე`, `${d} ${d === 1 ? 'day' : 'days'}`);
}
function inText(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return t(`${Math.max(1, m)} წუთში`, `in ${Math.max(1, m)} min`);
  if (m < 36 * 60) { const hh = Math.round(m / 60); return t(`${hh} საათში`, `in ${hh} h`); }
  const d = Math.round(m / 1440); return t(`${d} დღეში`, `in ${d} ${d === 1 ? 'day' : 'days'}`);
}
function agoText(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return t(`${Math.max(1, m)} წუთის წინ`, `${Math.max(1, m)} min ago`);
  if (m < 36 * 60) { const hh = Math.round(m / 60); return t(`${hh} საათის წინ`, `${hh} h ago`); }
  const d = Math.round(m / 1440); return t(`${d} დღის წინ`, `${d} ${d === 1 ? 'day' : 'days'} ago`);
}
/** Where the visit stands right now: the words and how full the rail is. */
function phase(a) {
  const now = Date.now(); const s = new Date(a.startsAt).getTime(); const e = new Date(a.endsAt).getTime();
  if (a.status === 'CANCELLED') return { text: t('გაუქმებულია', 'Cancelled'), pct: 0, tone: 'off' };
  if (a.status === 'NO_SHOW') return { text: t('კლიენტი არ მოვიდა', 'The client did not come'), pct: 100, tone: 'off' };
  if (a.status === 'COMPLETED') return { text: t('დასრულებულია', 'Completed'), pct: 100, tone: 'ok' };
  if (now < s) return { text: t(`იწყება ${inText(s - now)}`, `Starts ${inText(s - now)}`), pct: 0, tone: '' };
  if (now < e) return { text: t(`მიმდინარეობს · დარჩა ${spanText(e - now)}`, `In progress · ${spanText(e - now)} left`), pct: Math.max(4, Math.round(((now - s) / (e - s)) * 100)), tone: 'live' };
  return { text: t(`დასრულდა ${agoText(now - e)}`, `Ended ${agoText(now - e)}`) + (a.status === 'CONFIRMED' ? t(' · დახურვას ელოდება', ' · waiting to be closed') : ''), pct: 100, tone: 'due' };
}
/** A birthday (YYYY-MM-DD) within the next two weeks, today included. */
function birthdaySoon(birthday) {
  if (!birthday) return false;
  const [, mm, dd] = String(birthday).split('-').map(Number);
  const today = ymd();
  const y = Number(today.slice(0, 4));
  for (const year of [y, y + 1]) {
    const next = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const days = Math.round((Date.parse(next) - Date.parse(today)) / 86_400_000);
    if (days >= 0 && days <= 14) return true;
  }
  return false;
}

export function openAppointment(appt, ctx, { onChange } = {}) {
  let a = appt;
  let profile = null;
  let profileFor = null;
  const urls = [];
  const bodyHost = h('div', { class: 'bz-visit' });
  const footHost = h('div', { class: 'bz-visit-foot' });
  const clientHost = h('aside', { class: 'bz-visit-col bz-visit-client' });
  const tlHost = h('div', { class: 'bz-visit-block' });
  const m = openModal({ size: 'xl', body: bodyHost, footer: footHost, onClose: () => { for (const u of urls) URL.revokeObjectURL(u); } });
  m.el.classList.add('bz-visit-modal');
  const close = m.close;
  // The modal focuses the first text field; a card is read first, so the focus goes to the close button instead.
  setTimeout(() => { if (document.activeElement && bodyHost.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') m.el.querySelector('.bz-visit-badges .icon-btn')?.focus({ preventScroll: true }); }, 40);

  function paint() {
    mount(bodyHost, header(), h('div', { class: 'bz-visit-grid' }, visitColumn(), clientHost));
    mount(footHost, ...actions());
    loadProfile();
  }

  /* ── the hero: the day, the time, where the visit stands, the person ─────────────── */
  function header() {
    const s = staffOf(ctx, a.staffId);
    const color = a.staffColor || s?.color || '#64748B';
    const p = phase(a);
    const rel = dayLabel(a.startsAt);
    const isRel = [t('დღეს', 'Today'), t('ხვალ', 'Tomorrow'), t('გუშინ', 'Yesterday')].includes(rel);
    return h('header', { class: 'bz-visit-head' },
      h('div', { class: 'bz-visit-badges' },
        statusBadge(a.status),
        badge(SOURCE[a.source] ? t(...SOURCE[a.source]) : a.source, a.source === 'BUSINESS' ? 'neutral' : 'brand'),
        a.classId ? badge(t(`ჯგუფური კლასი · ${a.classBooked ?? '?'} / ${a.classSeats ?? '?'} ადგილი`, `Group class · ${a.classBooked ?? '?'} / ${a.classSeats ?? '?'} seats`), 'neutral') : null,
        a.reviewed ? badge(t('შეფასებულია', 'Reviewed'), 'ok') : null,
        h('span', { class: 'spacer' }),
        iconButton('x', { title: t('დახურვა', 'Close'), onClick: () => close() })),
      h('div', { class: 'bz-visit-hero' },
        h('div', { class: 'when' },
          h('div', { class: 'day' }, longDay(a.startsAt), isRel ? h('em', null, rel) : null),
          h('div', { class: 'time' }, h('b', null, clock(a.startsAt)), h('i', null, '–'), h('b', null, clock(a.endsAt)), h('span', null, minutes(a.durationMin))),
          h('div', { class: `bz-visit-phase${p.tone ? ` is-${p.tone}` : ''}` }, h('i', { class: 'rail' }, h('s', { style: { width: `${p.pct}%` } })), h('span', null, p.text))),
        h('div', { class: 'bz-visit-who' },
          avatar(a.staffName || t('ნებისმიერი', 'Anyone'), color, 46),
          h('div', { style: { minWidth: 0 } },
            h('b', null, a.staffName || t('ნებისმიერი თანამშრომელი', 'Anyone on the team')),
            h('small', null, s?.title || t('თანამშრომელი', 'Team member'))),
          a.resources?.length ? h('div', { class: 'bz-tags' }, a.resources.map((r) => h('span', { class: 'bz-tag' }, icon(r.kind === 'EQUIPMENT' ? 'zap' : 'door', { size: 12 }), r.name))) : null)));
  }

  /* ── the visit: services, money, notes, history, moving ─────────────────────────── */
  function visitColumn() {
    const services = a.services?.length ? a.services : [{ name: a.serviceName, durationMin: a.durationMin, price: a.price, discountAmount: a.discountAmount }];
    // An item's price is what the client pays for it; discountAmount is what came off that (the list price is the sum).
    const gross = services.some((x) => x.price != null) ? services.reduce((sum, x) => sum + n2(x.price) + n2(x.discountAmount), 0) : null;
    const disc = n2(a.discountAmount);
    const list = h('ul', { class: 'bz-visit-svcs' }, services.map((x) => h('li', null,
      h('span', { class: 'n' }, x.name),
      h('span', { class: 'd' }, minutes(x.durationMin)),
      h('span', { class: 'p' }, x.price == null ? '—' : [x.discountAmount ? h('s', null, gel(n2(x.price) + n2(x.discountAmount))) : null, gel(x.price)]))));
    const pp = a.paidParts || {};
    const paidState = a.status === 'COMPLETED' ? (a.paidAmount != null ? 'paid' : 'unpaid') : a.status === 'CANCELLED' || a.status === 'NO_SHOW' ? 'none' : 'later';
    const row = (label, value, cls = '') => h('div', { class: cls }, h('span', null, label), h('b', null, value));
    const money = h('div', { class: 'bz-visit-money' },
      gross != null && disc ? row(t('სერვისები', 'Services'), gel(gross)) : null,
      disc ? row(t('ფასდაკლება', 'Discount'), `−${gel(disc)}`) : null,
      pp.membershipAmount ? row(t('აბონემენტით', 'By membership'), `−${gel(pp.membershipAmount)}`) : null,
      pp.giftAmount ? row(h('span', null, t('სასაჩუქრე ბარათით', 'By gift card'), pp.giftCode ? h('span', { class: 'how' }, pp.giftCode) : null), `−${gel(pp.giftAmount)}`) : null,
      pp.bonusAmount ? row(t('ბონუსით', 'In bonus'), `−${gel(pp.bonusAmount)}`) : null,
      h('div', { class: `total${paidState === 'unpaid' ? ' is-unpaid' : ''}` },
        h('span', null, paidState === 'paid' ? t('გადახდილია', 'Paid') : paidState === 'unpaid' ? t('გადაუხდელია', 'Unpaid') : t('ფასი', 'Price'), paidState === 'paid' && a.paidMethod ? h('span', { class: 'how' }, methodLabel(a.paidMethod)) : null),
        h('b', null, paidState === 'paid' ? gel(a.paidAmount) : a.price == null ? t('შეთანხმებით', 'On request') : gel(a.price))),
      pp.bonusEarned ? row(t('კლიენტს დაერიცხა', 'The client earned'), `+${gel(pp.bonusEarned)}`, 'earn') : null,
      paidState === 'later' ? h('div', { class: 'hint' }, h('span', null, t('გადახდა ვიზიტის დასრულებისას ჩაიწერება.', 'The payment is written when the visit is completed.'))) : null);
    const quote = a.note ? h('blockquote', { class: 'bz-visit-quote' }, icon('messageText', { size: 16 }), h('div', null, h('small', null, t('კლიენტის შენიშვნა ჯავშნიდან', 'The client wrote with the booking')), a.note)) : null;
    const cancel = a.status === 'CANCELLED' ? h('div', { class: 'bz-visit-cancel' }, icon('x', { size: 16 }), h('div', null, h('b', null, a.cancelledBy === 'CLIENT' ? t('კლიენტმა გააუქმა', 'Cancelled by the client') : t('გაუქმებულია', 'Cancelled')), a.cancelReason ? h('div', null, a.cancelReason) : null)) : null;
    mount(tlHost, ...timeline());
    return h('section', { class: 'bz-visit-col' },
      h('div', { class: 'bz-visit-block' }, h('h4', null, services.length > 1 ? t(`${services.length} სერვისი`, `${services.length} services`) : t('სერვისი', 'Service')), list, money),
      quote, cancel,
      noteEditor(),
      tlHost,
      moveEditor());
  }

  function noteEditor() {
    const ta = textarea({ rows: 2, value: a.internalNote || '', placeholder: t('მაგ. საღებავის ფორმულა, რა უყვარს, რას ერიდება…', 'e.g. the colour formula, what they like, what to avoid…') });
    const saved = h('span', { class: 'saved' });
    const save = debounce(async () => {
      try { a = (await biz.patch(`/appointments/${a.id}`, { internalNote: ta.value })).appointment; mount(saved, icon('check', { size: 13 }), t('შენახულია', 'Saved')); saved.classList.add('is-ok'); onChange?.(a); } catch (e) { mount(saved); fail(e); }
    }, 600);
    ta.addEventListener('input', () => { saved.classList.remove('is-ok'); mount(saved, t('ინახება…', 'Saving…')); save(); });
    return h('div', { class: 'bz-visit-block bz-visit-note' },
      h('h4', null, t('შიდა შენიშვნა', 'Internal note')),
      ta,
      h('div', { class: 'under' }, h('span', { class: 'bz-note' }, t('ინახება თავისით · კლიენტი ვერ ხედავს', 'Saves by itself · the client never sees it')), saved));
  }

  /** What happened to this booking, in order: booked, reminded, completed / cancelled / missed, rated. */
  function timeline() {
    const items = [];
    const s = new Date(a.startsAt).getTime();
    const src = SOURCE[a.source] ? t(...SOURCE[a.source]) : a.source;
    items.push({ at: a.createdAt, label: t(`ჩაიწერა ${src}`, `Booked ${String(src).toLowerCase()}`) });
    const r = a.reminders || {};
    const open = OPEN.includes(a.status);
    const dayAt = new Date(s - 24 * 3600e3).toISOString();
    const soonAt = new Date(s - 3600e3).toISOString();
    const channels = (push, sms) => [push ? t('აპში', 'in the app') : null, sms ? 'SMS' : null].filter(Boolean).join(' · ');
    if (r.pushDay || r.smsDay) items.push({ at: dayAt, approx: true, label: t('შეხსენება წინა დღეს', 'Reminder the day before'), sub: channels(r.pushDay, r.smsDay), tone: 'ok' });
    else if (open && a.clientUserId && Date.now() < s - 24 * 3600e3) items.push({ at: dayAt, approx: true, label: t('შეხსენება წინა დღეს', 'Reminder the day before'), sub: t('გაიგზავნება აპში', 'will go to the app'), tone: 'plan' });
    if (r.pushSoon || r.smsSoon) items.push({ at: soonAt, approx: true, label: t('შეხსენება ერთი საათით ადრე', 'Reminder an hour before'), sub: channels(r.pushSoon, r.smsSoon), tone: 'ok' });
    else if (open && a.clientUserId && Date.now() < s - 3600e3) items.push({ at: soonAt, approx: true, label: t('შეხსენება ერთი საათით ადრე', 'Reminder an hour before'), sub: t('გაიგზავნება აპში', 'will go to the app'), tone: 'plan' });
    if (a.completedAt) items.push({ at: a.completedAt, label: t('ვიზიტი დასრულდა', 'Visit completed'), sub: a.paidAmount != null ? `${gel(a.paidAmount)} · ${methodLabel(a.paidMethod)}` : null, tone: 'ok' });
    if (a.cancelledAt) items.push({ at: a.cancelledAt, label: a.cancelledBy === 'CLIENT' ? t('კლიენტმა გააუქმა', 'Cancelled by the client') : t('გაუქმდა', 'Cancelled'), sub: a.cancelReason, tone: 'bad' });
    if (a.status === 'NO_SHOW') items.push({ at: a.updatedAt || a.endsAt, label: t('მონიშნულია „არ მოვიდა“', 'Marked as a no-show'), tone: 'bad' });
    const review = profile?.reviews?.find((x) => x.appointmentId === a.id);
    if (review || a.reviewedAt) items.push({ at: review?.createdAt || a.reviewedAt, label: review ? t(`კლიენტმა შეაფასა ${'★'.repeat(review.rating)}`, `Rated ${'★'.repeat(review.rating)}`) : t('კლიენტმა შეაფასა', 'Rated by the client'), sub: review?.text || null, tone: 'ok' });
    else if (a.reviewAsked) items.push({ at: a.endsAt, approx: true, label: t('შეფასება ვთხოვეთ', 'Asked for a review'), tone: 'plan' });
    items.sort((x, y) => new Date(x.at) - new Date(y.at));
    return [h('h4', null, t('ისტორია', 'History')),
      h('ol', { class: 'bz-visit-timeline' }, items.map((it) => h('li', { class: it.tone ? `is-${it.tone}` : '' }, h('i', { class: 'dot' }), h('div', null, h('b', null, it.label), h('small', null, [`${it.approx ? '≈ ' : ''}${stamp(it.at)}`, it.sub].filter(Boolean).join(' · '))))))];
  }

  function moveEditor() {
    if (a.status === 'CANCELLED' || a.status === 'COMPLETED') return null;
    if (a.classId) return h('p', { class: 'bz-note' }, t('ეს ადგილი ჯგუფურ კლასშია — დრო და მწვრთნელი მთელ კლასს ერთად ეცვლება. სხვა კლასში გადასაყვანად გააუქმე და ჩაწერე თავიდან.', 'This seat belongs to a group class — time and trainer change for the whole class. To move one person, cancel and book them into another class.'));
    const who = select([{ value: '', label: t('ნებისმიერი', 'Anyone') }, ...ctx.staff.map((s) => ({ value: s.id, label: s.name }))], a.staffId || '');
    const svc = select(ctx.services.map((s) => ({ value: s.id, label: `${s.name} · ${minutes(s.durationMin)}` })), a.serviceId || '');
    const time = timeField({ value: clock(a.startsAt) });
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
    const apply = button(t('გადატანა', 'Move'), { size: 'sm', variant: 'secondary', icon: 'repeat', onClick: async () => {
      await busy(apply, async () => {
        try {
          if (!date.get() || !time.get()) throw new Error(t('აირჩიე დღე და დრო.', 'Pick a day and a time.'));
          const patch = { startsAt: toIso(date.get(), time.get()), staffId: who.value || null };
          if (svc.value && svc.value !== a.serviceId) patch.serviceId = svc.value;
          const res = await biz.patch(`/appointments/${a.id}`, patch);
          a = res.appointment;
          ok(res.waitlistOffered ? t(`გადატანილია · ძველი დრო მოლოდინის სიიდან ${res.waitlistOffered} კლიენტს შევთავაზეთ`, `Moved · the old time was offered to ${res.waitlistOffered} waiting ${res.waitlistOffered === 1 ? 'client' : 'clients'}`) : t('გადატანილია. კლიენტს შეტყობინება მივა.', 'Moved. The client is notified.'));
          paint();
          onChange?.(a);
        } catch (e) { fail(e); }
      });
    } });
    return h('details', { class: 'bz-move bz-visit-move' },
      h('summary', null, icon('repeat', { size: 15 }), t('დროის, თანამშრომლის ან სერვისის შეცვლა', 'Change the time, the person or the service')),
      h('div', { class: 'form' },
        h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date.el), field(t('დრო', 'Time'), time.el)),
        h('div', { class: 'form-row' }, field(t('თანამშრომელი', 'Person'), who), ctx.services.length ? field(t('სერვისი', 'Service'), svc) : null),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, apply)));
  }

  /* ── the client: who, warnings, numbers, last visits, this visit's photos ─────────── */
  async function loadProfile() {
    if (!a.clientId) { profile = null; profileFor = null; paintClient(); return; }
    if (profileFor === a.clientId && profile) { paintClient(); return; }
    profileFor = a.clientId;
    profile = null;
    paintClient();
    try {
      const [p, loyalty] = await Promise.all([biz.get(`/clients/${a.clientId}`), biz.get(`/clients/${a.clientId}/loyalty`).catch(() => null)]);
      if (profileFor !== a.clientId) return;
      profile = { ...p, loyalty };
      paintClient();
      mount(tlHost, ...timeline());
    } catch { if (profileFor === a.clientId) { profile = { missing: true }; paintClient(); } }
  }

  function paintClient() {
    const c = profile?.client || null;
    const st = profile?.stats || null;
    const name = c?.name || a.clientName;
    const phone = c?.phone || a.clientPhone;
    const person = h('div', { class: 'bz-visit-person' },
      avatar(name, nameTone(name), 52),
      h('div', { class: 'id' },
        a.clientId ? h('a', { class: 'name', href: `/business/clients/${a.clientId}`, 'data-link': '', onClick: () => close() }, name) : h('span', { class: 'name' }, name),
        h('div', { class: 'meta' },
          phone ? h('a', { href: `tel:${phone}` }, phoneText(phone)) : h('span', { class: 'bz-note' }, t('ტელეფონი არ არის', 'No phone')),
          a.clientUserId || c?.inApp ? badge(t('აპის მომხმარებელი', 'App user'), 'brand') : null,
          st && !st.visits && a.status !== 'COMPLETED' ? badge(t('პირველი ვიზიტი', 'First visit'), 'neutral') : null,
          c?.birthday && birthdaySoon(c.birthday) ? badge(t('დაბადების დღე მალე', 'Birthday soon'), 'ok') : null,
          st?.overdue ? badge(t('დიდი ხანია არ ყოფილა', 'Overdue'), 'warn') : null)),
      phone ? h('a', { class: 'btn btn-ghost call', href: `tel:${phone}`, title: t('დარეკვა', 'Call') }, icon('phone', { size: 18 })) : null);
    if (!a.clientId) { mount(clientHost, person, h('p', { class: 'bz-visit-empty' }, t('ამ ჩანაწერს კლიენტის ბარათი არ აქვს.', 'This booking has no client card.'))); return; }
    if (!profile) { mount(clientHost, person, h('div', { class: 'bz-visit-skel' }, h('i', { style: { width: '70%' } }), h('i'), h('i', { style: { width: '55%' } }))); return; }
    if (profile.missing) { mount(clientHost, person, h('p', { class: 'bz-visit-empty' }, t('ბარათი ვერ ჩაიტვირთა.', 'The card could not load.'))); return; }
    const card = c.card || {};
    const warn = [card.allergies ? t(`ალერგია: ${card.allergies}`, `Allergy: ${card.allergies}`) : null, card.contraindications ? t(`უკუჩვენება: ${card.contraindications}`, `Contraindication: ${card.contraindications}`) : null].filter(Boolean);
    const num = (value, label, cls = '') => h('div', { class: cls }, h('b', null, value), h('small', null, label));
    const nums = h('div', { class: 'bz-visit-nums' },
      num(st.visits, t('ვიზიტი', 'visits')),
      num(st.noShows, t('გაცდენა', 'no-shows'), st.noShows ? 'is-bad' : ''),
      num(st.daysSinceLast == null ? '—' : t(`${st.daysSinceLast} დღე`, `${st.daysSinceLast} d`), t('ბოლო ვიზიტიდან', 'since last visit'), st.overdue ? 'is-warn' : ''),
      num(gel(st.avgCheck), t('საშ. ჩეკი', 'avg. check')),
      num(gel(st.totalSpent), t('სულ გადაიხადა', 'spent in all')),
      num(profile.loyalty ? gel(profile.loyalty.bonusBalance) : '—', t('ბონუსი', 'bonus')));
    const habits = [
      st.cadenceDays ? t(`ჩვეულებრივ ყოველ ~${st.cadenceDays} დღეში`, `usually every ~${st.cadenceDays} days`) : null,
      st.favouriteService && st.favouriteService.count > 1 ? t(`ყველაზე ხშირად: ${st.favouriteService.name}`, `most often: ${st.favouriteService.name}`) : null,
      c.preferredStaffName ? t(`ურჩევნია ${c.preferredStaffName}`, `prefers ${c.preferredStaffName}`) : st.favouriteStaff && st.favouriteStaff.name !== a.staffName && st.favouriteStaff.count > 1 ? t(`ჩვეულებრივ ${st.favouriteStaff.name}-თან`, `usually with ${st.favouriteStaff.name}`) : null,
      c.source && CLIENT_SOURCE[c.source] ? t(`მოვიდა: ${CLIENT_SOURCE[c.source][0]}`, `came via ${CLIENT_SOURCE[c.source][1]}`) : null,
    ].filter(Boolean);
    const memberships = (profile.loyalty?.memberships || []).filter((x) => x.status === 'ACTIVE' || x.active);
    const tags = [...(c.tags || []).map((x) => h('span', { class: 'bz-tag' }, x)), ...memberships.map((x) => h('span', { class: 'bz-tag bz-tag-app' }, icon('badgeCheck', { size: 12 }), `${x.title}${x.kind === 'VISITS' ? t(` · დარჩა ${x.visitsLeft}`, ` · ${x.visitsLeft} left`) : x.amountLeft != null ? ` · ${gel(x.amountLeft)}` : ''}`))];
    const lastNote = (profile.notes || []).find((n) => n.text);
    const others = (profile.appointments || []).filter((x) => x.id !== a.id).slice(0, 5);
    const hist = others.length ? h('ul', { class: 'bz-visit-hist' }, others.map((x) => h('li', { onClick: () => { a = x; paint(); }, title: t('გახსნა', 'Open') },
      h('i', { style: { background: DOT[x.status] || 'var(--text3)' } }),
      h('div', { style: { minWidth: 0 } }, h('b', null, x.serviceName), h('small', null, [`${dayLabel(x.startsAt)} ${clock(x.startsAt)}`, x.staffName].filter(Boolean).join(' · '))),
      h('span', { class: 'amt' }, x.status === 'CANCELLED' ? t('გაუქმდა', 'cancelled') : x.status === 'NO_SHOW' ? t('არ მოვიდა', 'no-show') : x.status === 'PENDING' ? t('ელოდება', 'pending') : x.paidAmount != null ? gel(x.paidAmount) : x.price != null ? gel(x.price) : '')))) : h('p', { class: 'bz-visit-empty' }, t('სხვა ვიზიტი არ ჰქონია.', 'No other visits yet.'));
    const next = st.nextAt && new Date(st.nextAt).getTime() !== new Date(a.startsAt).getTime() ? h('p', { class: 'bz-note' }, t(`შემდეგი ვიზიტი: ${dayLabel(st.nextAt)} ${clock(st.nextAt)}`, `Next visit: ${dayLabel(st.nextAt)} ${clock(st.nextAt)}`)) : null;
    const photos = (profile.files || []).filter((f) => f.appointmentId === a.id).slice(0, 4);
    const photoGrid = photos.length ? h('div', { class: 'bz-visit-photos' }, photos.map((f) => {
      const img = h('img', { alt: f.caption || '', title: f.caption || '' });
      import('./client-card.js').then(({ blobUrl }) => blobUrl(biz.path(`/clients/${c.id}/files/${f.id}/image`))).then((u) => { urls.push(u); img.src = u; }).catch(() => {});
      return img;
    })) : null;
    const counts = [profile.files?.length ? t(`${profile.files.length} ფოტო`, `${profile.files.length} photos`) : null, profile.notes?.length ? t(`${profile.notes.length} ჩანაწერი`, `${profile.notes.length} notes`) : null].filter(Boolean).join(' · ');
    mount(clientHost,
      person,
      warn.length ? h('div', { class: 'bz-visit-warn' }, icon('alert', { size: 15 }), h('span', null, warn.join(' · '))) : null,
      c.notes ? h('div', { class: 'bz-visit-pin' }, icon('info', { size: 15 }), h('span', null, c.notes)) : null,
      nums,
      habits.length || tags.length ? h('div', { class: 'bz-visit-block' }, habits.length ? h('p', { class: 'bz-visit-habits' }, habits.join(' · ')) : null, tags.length ? h('div', { class: 'bz-tags' }, tags) : null) : null,
      lastNote ? h('div', { class: 'bz-visit-lastnote' }, h('small', null, [t('ბოლო ჩანაწერი', 'Latest note'), lastNote.byName, stamp(lastNote.createdAt)].filter(Boolean).join(' · ')), h('span', null, lastNote.text)) : null,
      photoGrid ? h('div', { class: 'bz-visit-block' }, h('h4', null, t('ამ ვიზიტის ფოტოები', 'Photos from this visit')), photoGrid) : null,
      h('div', { class: 'bz-visit-block' }, h('h4', null, t('ვიზიტები', 'Visits')), hist, next),
      h('div', { class: 'bz-inline', style: { justifyContent: 'space-between' } },
        button(t('სრული ბარათი', 'Full card'), { variant: 'ghost', size: 'sm', icon: 'user', href: `/business/clients/${a.clientId}`, onClick: () => close() }),
        counts ? h('span', { class: 'bz-note' }, counts) : null));
  }

  /* ── decisions ──────────────────────────────────────────────────────────────────── */
  async function setStatus(status, extra = {}) {
    try {
      const res = await biz.patch(`/appointments/${a.id}`, { status, ...extra });
      a = res.appointment;
      ok(res.waitlistOffered ? t(`შენახულია · მოლოდინის სიიდან ${res.waitlistOffered} კლიენტს დრო შევთავაზეთ`, `Saved · ${res.waitlistOffered} waiting ${res.waitlistOffered === 1 ? 'client was' : 'clients were'} offered the time`) : t('შენახულია', 'Saved'));
      if (profileFor === a.clientId) profile = null; // the card's numbers changed with the visit
      paint();
      onChange?.(a);
    } catch (e) { fail(e); }
  }

  /**
   * Completing: the price, then what covers it besides money — a membership the client holds, a gift-card code,
   * bonus from the client card (up to the business's share) — and the money that is left, editable.
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
    function parts() {
      let left = price;
      const mm = opts?.memberships.find((x) => x.id === member.value) || null;
      let membershipAmount = 0;
      if (mm && left > 0) { membershipAmount = mm.kind === 'VISITS' ? left : Math.min(left, n2(mm.amountLeft)); left = n2(left - membershipAmount); }
      let giftAmount = 0;
      if (gift && left > 0) { giftAmount = Math.min(left, n2(gift.balance)); left = n2(left - giftAmount); }
      const cap = opts ? Math.min(n2(opts.maxBonus), left) : 0;
      const bonusAmount = Math.min(n2(bonus.value), cap);
      left = n2(left - bonusAmount);
      return { membershipAmount, giftAmount, bonusAmount, cap, rest: left, m: mm };
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
    const dlg = openModal({
      title: t('ვიზიტის დასრულება', 'Complete the visit'),
      size: 'sm',
      body: h('div', { class: 'form' },
        a.clientId ? field(t('აბონემენტი', 'Membership'), member) : null,
        field(t('სასაჩუქრე ბარათი', 'Gift card'), giftCode), giftInfo,
        a.clientId ? [field(t('ბონუსით, ₾', 'With bonus, ₾'), h('div', { class: 'bz-inline' }, bonus, allBonus)), bonusInfo] : null,
        h('div', { class: 'form-row' }, field(t('ფულით, ₾', 'In money, ₾'), cash), field(t('გადახდის მეთოდი', 'Payment method'), method)),
        summary, err),
      footer: (c) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => c() }), complete],
    });
    complete.addEventListener('click', () => busy(complete, async () => {
      err.hidden = true;
      const x = parts();
      const payment = {};
      if (gift) payment.giftCode = gift.code;
      if (x.bonusAmount > 0) payment.bonusAmount = x.bonusAmount;
      if (x.m) payment.clientMembershipId = x.m.id;
      dlg.close();
      await setStatus('COMPLETED', { paidAmount: cash.value === '' ? null : Number(cash.value), paidMethod: method.value, payment });
    }));
    biz.get(`/appointments/${a.id}/payment-options`).then((o) => {
      opts = o;
      member.setOptions([{ value: '', label: t('არ გამოიყენო', 'Do not use') }, ...o.memberships.map((x) => ({ value: x.id, label: `${x.title} · ${x.kind === 'VISITS' ? t(`დარჩა ${x.visitsLeft}`, `${x.visitsLeft} left`) : gel(x.amountLeft)}` }))]);
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
      footer: (c) => [button(t('უკან', 'Back'), { variant: 'ghost', onClick: () => c() }), button(t('გაუქმება', 'Cancel booking'), { variant: 'danger', onClick: async () => { c(); await setStatus('CANCELLED', { cancelReason: reason.value.trim() }); } })],
    });
  }

  function actions() {
    const left = [];
    let primary = null;
    const manage = canManage();
    if (a.status === 'PENDING') primary = button(t('დადასტურება', 'Confirm'), { icon: 'check', onClick: () => setStatus('CONFIRMED') });
    if (a.status === 'CONFIRMED') {
      primary = button(t('დასრულება', 'Complete'), { icon: 'check', onClick: completeDialog });
      left.push(button(t('არ მოვიდა', 'No-show'), { variant: 'ghost', icon: 'userMinus', onClick: async () => { if (await confirmDialog({ title: t('არ მოვიდა?', 'No-show?'), body: t('კლიენტის ბარათზე გაცდენა ჩაიწერება.', 'A no-show is written on the client card.'), confirm: t('მონიშვნა', 'Mark') })) setStatus('NO_SHOW'); } }));
    }
    if (OPEN.includes(a.status)) left.push(button(t('გაუქმება', 'Cancel'), { variant: 'ghost', class: 'bz-bad', icon: 'x', onClick: cancelDialog }));
    if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') primary = button(t('აღდგენა', 'Restore'), { variant: 'secondary', icon: 'undo', onClick: () => setStatus('CONFIRMED') });
    if (a.status === 'CONFIRMED' || a.status === 'COMPLETED') left.push(button(t('პროდუქტი', 'Product'), { variant: 'ghost', icon: 'archive', title: t('პროდუქტის გაყიდვა ამ კლიენტზე', 'Sell a product to this client'), onClick: () => saleDialog({ clientId: a.clientId, clientName: a.clientName, appointmentId: a.id, staffId: a.staffId || '' }) }));
    if (a.status === 'COMPLETED' && manage) left.push(button(t('დასრულების გაუქმება', 'Undo completion'), { variant: 'ghost', icon: 'undo', onClick: () => setStatus('CONFIRMED') }));
    return [...left, h('span', { class: 'spacer' }), primary].filter(Boolean);
  }

  paint();
  return { close, el: m.el };
}
