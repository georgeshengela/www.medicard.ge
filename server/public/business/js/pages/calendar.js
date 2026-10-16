// MEDIBOOK business panel — the calendar: a day with a column per person, or a week with a column per day.
import { h, mount, icon, button, segmented, pageHead, openModal, field, input, busy } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { state, canManage } from '../state.js';
import { biz, ymd, addDays, weekdayOf, minutesOf, clock, WEEKDAYS_SHORT, WEEKDAYS, MONTHS, MONTHS_SHORT, fail, ok, toIso, emptyBox } from '../shared.js';
import { loadContext, newAppointmentDialog, openAppointment } from '../appointment.js';
import { classDialog, classServices, openClass, seatsLabel } from '../class.js';
import { dateField, timeField, select } from '../fields.js';
import { chips } from '../lists.js';

const HOUR_H = 64;
/** h() assigns style objects with Object.assign, which ignores custom properties — set them by hand. */
function vars(el, map) { for (const [k, v] of Object.entries(map)) el.style.setProperty(k, String(v)); return el; }

export default async function calendarPage(root, ctx) {
  const context = await loadContext();
  const business = (await biz.get('')).business;
  // The rooms / devices of the business: the day view can show one room's bookings alone.
  const resources = (await biz.get('/resources').catch(() => ({ resources: [] }))).resources.filter((r) => r.active);
  const staffCols = context.staff.filter((s) => s.bookable || true);
  let mode = ctx.query.mode || (staffCols.length > 1 ? 'day' : 'week');
  let anchor = ctx.query.date && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date) ? ctx.query.date : ymd();
  let filterStaff = '';
  let filterResource = '';
  const host = h('div');
  const resHost = h('div', { class: 'bz-cal-res' });
  const title = h('h2');
  let timer = null;

  const rangeOf = () => {
    if (mode === 'day') return { from: anchor, to: anchor };
    const monday = addDays(anchor, -((weekdayOf(anchor) + 6) % 7));
    return { from: monday, to: addDays(monday, 6) };
  };

  const hoursRange = () => {
    let min = 24; let max = 0;
    for (let i = 0; i < 7; i += 1) for (const r of business.hours?.[String(i)] || []) { min = Math.min(min, Number(r.from.split(':')[0])); max = Math.max(max, Math.ceil(Number(r.to.split(':')[0]) + (r.to.endsWith(':00') ? 0 : 1))); }
    if (min >= max) { min = 8; max = 21; }
    return { start: Math.max(0, min - 1), end: Math.min(24, max + 1) };
  };

  async function paint() {
    const { from, to } = rangeOf();
    title.textContent = mode === 'day'
      ? `${WEEKDAYS[weekdayOf(anchor)]}, ${Number(anchor.slice(8, 10))} ${MONTHS[Number(anchor.slice(5, 7)) - 1]}`
      : `${Number(from.slice(8, 10))} ${MONTHS_SHORT[Number(from.slice(5, 7)) - 1]} – ${Number(to.slice(8, 10))} ${MONTHS_SHORT[Number(to.slice(5, 7)) - 1]} ${to.slice(0, 4)}`;
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const [{ appointments: all }, { timeOff }, { classes }] = await Promise.all([
        biz.get('/appointments', { from, to, staffId: filterStaff || undefined }),
        biz.get('/time-off', { from, to }),
        biz.get('/classes', { from, to, staffId: filterStaff || undefined }).catch(() => ({ classes: [] })),
      ]);
      // A group class is one block with „7 / 15“; its attendees' rows are inside it, not beside it.
      const classIds = new Set(classes.map((c) => c.id));
      const singles = all.filter((a) => !a.classId || !classIds.has(a.classId));
      const blocks = [...singles.map((a) => ({ kind: 'appt', ref: a, startsAt: a.startsAt, endsAt: a.endsAt, staffId: a.staffId, staffName: a.staffName, staffColor: a.staffColor, status: a.status, durationMin: a.durationMin, resourceIds: a.resourceIds, resources: a.resources })),
        ...classes.map((c) => ({ kind: 'class', ref: c, startsAt: c.startsAt, endsAt: c.endsAt, staffId: c.staffId, staffName: c.staffName, staffColor: c.staffColor, status: c.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED', durationMin: c.durationMin, resourceIds: c.resourceIds, resources: c.resources }))];
      // One chip per room / device in the day view, with that day's count; a chosen one shows only its bookings.
      const holds = (a, id) => Array.isArray(a.resourceIds) && a.resourceIds.includes(id);
      if (mode === 'day' && resources.length) {
        if (filterResource && !resources.some((r) => r.id === filterResource)) filterResource = '';
        mount(resHost, chips([['', t('ყველა ოთახი', 'Every room')], ...resources.map((r) => [r.id, r.name, blocks.filter((a) => a.status !== 'CANCELLED' && holds(a, r.id)).length])], filterResource, (v) => { filterResource = v; paint(); }));
      } else mount(resHost);
      mount(host, grid(mode === 'day' && filterResource ? blocks.filter((a) => holds(a, filterResource)) : blocks, timeOff, from, to));
    } catch (e) { mount(host, emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message)); }
  }

  function grid(appointments, timeOff, from, to) {
    const { start, end } = hoursRange();
    const hours = [];
    for (let hh = start; hh < end; hh += 1) hours.push(hh);
    const cols = mode === 'day'
      ? (filterStaff ? staffCols.filter((s) => s.id === filterStaff) : staffCols.length ? staffCols : [{ id: null, name: t('გუნდი', 'Team'), color: '#64748B' }]).map((s) => ({ key: s.id ?? 'all', label: s.name, sub: s.title || '', color: s.color, date: anchor, staffId: s.id }))
      : Array.from({ length: 7 }, (_, i) => { const d = addDays(from, i); return { key: d, label: `${WEEKDAYS_SHORT[weekdayOf(d)]} ${Number(d.slice(8, 10))}`, sub: MONTHS_SHORT[Number(d.slice(5, 7)) - 1], date: d, staffId: null, today: d === ymd() }; });
    const toMin = (s2) => { const [hh, mm] = String(s2).split(':').map(Number); return hh * 60 + mm; };
    const workingOf = (col) => {
      const dayIdx = weekdayOf(col.date);
      const open = business.hours?.[String(dayIdx)] || [];
      const scheduleOf = (person) => (person && Object.values(person.schedule || {}).some((l) => l.length) ? (person.schedule[String(dayIdx)] || []) : open);
      const sum = (ranges) => ranges.reduce((acc, r) => acc + ((r.to === '24:00' ? 1440 : toMin(r.to)) - toMin(r.from)), 0);
      if (col.staffId) return sum(scheduleOf(staffCols.find((s) => s.id === col.staffId)));
      return staffCols.length ? staffCols.reduce((acc, p) => acc + sum(scheduleOf(p)), 0) : sum(open);
    };
    const occupancy = (col) => {
      const working = workingOf(col);
      // A class counts once for the time (its attendees sit inside it) and once for the count.
      const mine = appointments.filter((a) => ymd(a.startsAt) === col.date && a.status !== 'CANCELLED' && (mode === 'week' || !col.staffId || a.staffId === col.staffId));
      const booked = mine.reduce((acc, a) => acc + Number(a.durationMin || 0), 0);
      const share = working ? Math.min(100, Math.round((booked / working) * 100)) : 0;
      return h('span', { class: 'occ', title: working ? t(`${mine.length} ჩანაწერი · ${Math.round(booked / 6) / 10} სთ ${working ? `/ ${Math.round(working / 6) / 10} სთ` : ''}`, `${mine.length} bookings · ${Math.round(booked / 6) / 10} h of ${Math.round(working / 6) / 10} h`) : '' }, h('span', { style: { width: `${share}%`, background: col.color || 'var(--book)' } }));
    };
    const colEl = (col) => {
      const dayIdx = weekdayOf(col.date);
      const open = business.hours?.[String(dayIdx)] || [];
      const el = h('div', { class: `bz-cal-col${open.length ? '' : ' closed'}`, style: { height: `${hours.length * HOUR_H}px` } });
      // Grey out the hours outside the shift (business hours; a person's own schedule when the column is theirs).
      const person = col.staffId ? staffCols.find((s) => s.id === col.staffId) : null;
      const schedule = person && Object.values(person.schedule || {}).some((l) => l.length) ? (person.schedule[String(dayIdx)] || []) : open;
      if (open.length || schedule.length) {
        let cursor = start * 60;
        for (const r of [...schedule].sort((a, b) => a.from.localeCompare(b.from))) {
          const a = Number(r.from.split(':')[0]) * 60 + Number(r.from.split(':')[1]);
          const b = r.to === '24:00' ? 1440 : Number(r.to.split(':')[0]) * 60 + Number(r.to.split(':')[1]);
          if (a > cursor) el.appendChild(h('div', { class: 'bz-cal-off', style: { top: `${((cursor - start * 60) / 60) * HOUR_H}px`, height: `${((a - cursor) / 60) * HOUR_H}px` } }));
          cursor = Math.max(cursor, b);
        }
        if (cursor < end * 60) el.appendChild(h('div', { class: 'bz-cal-off', style: { top: `${((cursor - start * 60) / 60) * HOUR_H}px`, height: `${((end * 60 - cursor) / 60) * HOUR_H}px` } }));
      }
      for (const off of timeOff) {
        if (off.staffId && col.staffId && off.staffId !== col.staffId) continue;
        if (mode === 'week' && off.staffId) continue;
        if (ymd(off.startsAt) > col.date || ymd(off.endsAt) < col.date) continue;
        const a = ymd(off.startsAt) === col.date ? minutesOf(off.startsAt) : start * 60;
        const b = ymd(off.endsAt) === col.date ? minutesOf(off.endsAt) : end * 60;
        el.appendChild(h('div', { class: 'bz-cal-off', title: off.reason || t('დასვენება', 'Time off'), style: { top: `${((a - start * 60) / 60) * HOUR_H}px`, height: `${((b - a) / 60) * HOUR_H}px`, opacity: .9 } }));
      }
      const mine = appointments.filter((a) => ymd(a.startsAt) === col.date && (mode === 'week' || !col.staffId || a.staffId === col.staffId || (!a.staffId && staffCols.length <= 1)));
      // Side-by-side for overlaps in the same column.
      const sorted = [...mine].sort((x, y) => new Date(x.startsAt) - new Date(y.startsAt));
      const lanes = [];
      for (const a of sorted) {
        const s = new Date(a.startsAt).getTime(); const e = new Date(a.endsAt).getTime();
        let lane = lanes.findIndex((end2) => end2 <= s);
        if (lane === -1) { lanes.push(e); lane = lanes.length - 1; } else lanes[lane] = e;
        a._lane = lane;
      }
      const laneCount = Math.max(1, lanes.length);
      for (const b of sorted) {
        const top = ((minutesOf(b.startsAt) - start * 60) / 60) * HOUR_H;
        const height = Math.max(26, ((new Date(b.endsAt) - new Date(b.startsAt)) / 60000 / 60) * HOUR_H - 2);
        const color = b.staffColor || staffCols.find((s) => s.id === b.staffId)?.color || '#64748B';
        const width = 100 / laneCount;
        const place = { top: `${top}px`, height: `${height}px`, left: `calc(${b._lane * width}% + 4px)`, right: `calc(${(laneCount - b._lane - 1) * width}% + 4px)` };
        const rooms = mode === 'day' && !filterResource && b.resources?.length ? b.resources.map((r) => r.name).join(', ') : null;
        if (b.kind === 'class') {
          const c = b.ref;
          const past = new Date(c.endsAt) < new Date();
          el.appendChild(vars(h('div', {
            class: `bz-cal-event is-class${c.status === 'CANCELLED' ? ' is-cancelled' : ''}${past && c.status !== 'CANCELLED' ? ' is-done' : ''}${c.seatsLeft === 0 ? ' is-full' : ''}`,
            style: place,
            title: [`${clock(c.startsAt)}–${clock(c.endsAt)} · ${c.serviceName} · ${c.label} ${seatsLabel(c.seats).replace(/^\d+ /, '')}`, c.staffName, rooms].filter(Boolean).join(' · '),
            onClick: (e) => { e.stopPropagation(); openClass(c, context, { onChange: paint }); },
          }, h('b', null, `${clock(c.startsAt)} ${c.serviceName}`), h('em', { class: 'seats' }, c.label), h('span', null, [t(`${c.booked} / ${c.seats} ადგილი`, `${c.booked} / ${c.seats} seats`), mode === 'week' && c.staffName ? c.staffName : null, rooms].filter(Boolean).join(' · ')),
          h('i', { class: 'fill', style: { width: `${c.seats ? Math.min(100, Math.round((c.booked / c.seats) * 100)) : 0}%` } })), { '--c': color }));
          continue;
        }
        const a = b.ref;
        el.appendChild(vars(h('div', {
          class: `bz-cal-event${a.status === 'PENDING' ? ' is-pending' : ''}${a.status === 'CANCELLED' ? ' is-cancelled' : ''}${a.status === 'COMPLETED' || a.status === 'NO_SHOW' ? ' is-done' : ''}`,
          style: place,
          title: [`${clock(a.startsAt)}–${clock(a.endsAt)} · ${a.clientName} · ${a.serviceName}`, a.resources?.length ? a.resources.map((r) => r.name).join(', ') : null].filter(Boolean).join(' · '),
          onClick: (e) => { e.stopPropagation(); openAppointment(a, context, { onChange: paint }); },
        }, h('b', null, `${clock(a.startsAt)} ${a.clientName}`), h('span', null, [mode === 'week' && a.staffName ? `${a.serviceName} · ${a.staffName}` : a.serviceName, rooms].filter(Boolean).join(' · '))), { '--c': color }));
      }
      if (col.date === ymd()) {
        const m = minutesOf(new Date());
        if (m >= start * 60 && m <= end * 60) el.appendChild(h('div', { class: 'bz-cal-now', style: { top: `${((m - start * 60) / 60) * HOUR_H}px` } }));
      }
      el.addEventListener('click', (e) => {
        const rect = el.getBoundingClientRect();
        const minutesAt = start * 60 + ((e.clientY - rect.top) / HOUR_H) * 60;
        const snapped = Math.floor(minutesAt / 15) * 15;
        const time = `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`;
        newAppointmentDialog(context, { date: col.date, time, staffId: col.staffId || '' }, { onCreated: paint });
      });
      return el;
    };
    return h('div', { class: 'bz-cal' },
      h('div', { class: 'bz-cal-scroll' },
        vars(h('div', { class: 'bz-cal-grid' },
          h('div', { class: 'bz-cal-cols' }, h('div'), cols.map((c) => h('div', { class: `bz-cal-col-head${c.today ? ' today' : ''}` }, c.color ? h('span', { class: 'bz-color-dot', style: { background: c.color } }) : null, h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.label), c.sub ? h('small', null, c.sub) : null, occupancy(c)))),
          h('div', { class: 'bz-cal-body' },
            h('div', { class: 'bz-cal-hours' }, hours.map((hh) => h('div', { class: 'bz-cal-hour' }, `${String(hh).padStart(2, '0')}:00`))),
            cols.map(colEl))), { '--cols': cols.length, '--hour-h': `${HOUR_H}px` })),
      h('div', { class: 'bz-legend' },
        h('span', null, h('i', { style: { background: 'var(--book)' } }), t('დადასტურებული', 'Confirmed')),
        h('span', null, h('i', { style: { background: 'repeating-linear-gradient(135deg, var(--book) 0 3px, transparent 3px 6px)' } }), t('დასადასტურებელი', 'To confirm')),
        classServices(context).length ? h('span', null, h('i', { style: { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--book)' } }), t('ჯგუფური კლასი · დაკავებული / ადგილები', 'Group class · taken / seats')) : null,
        h('span', null, h('i', { style: { background: 'var(--bg3)' } }), t('დახურული / დასვენება', 'Closed / time off')),
        h('span', { class: 'spacer' }),
        h('span', { class: 'faint' }, t('დააჭირე თავისუფალ ადგილს — ახალი ჩანაწერი', 'Click an empty spot for a new booking'))));
  }

  function timeOffDialog() {
    const who = select([{ value: '', label: t('მთელი ბიზნესი (დახურული დღე)', 'Whole business (closed)') }, ...staffCols.map((s) => ({ value: s.id, label: s.name }))], '');
    const fromDay = dateField({ value: anchor, onChange: (v) => { if (toDay.get() < v) toDay.set(v); } });
    const fromTime = timeField({ value: '09:00', from: '00:00', to: '23:45' });
    const toDay = dateField({ value: anchor });
    const toTime = timeField({ value: '19:00', from: '00:00', to: '24:00' });
    const reason = input({ placeholder: t('მიზეზი (არასავალდებულო)', 'Reason (optional)') });
    const save = button(t('შენახვა', 'Save'));
    const m = openModal({ title: t('დასვენება / დახურული საათები', 'Time off / closed hours'),
      body: h('div', { class: 'form' },
        field(t('ვისთვის', 'Who'), who),
        h('div', { class: 'form-row' }, field(t('დღიდან', 'From day'), fromDay.el), field(t('საათიდან', 'From time'), fromTime.el)),
        h('div', { class: 'form-row' }, field(t('დღემდე', 'To day'), toDay.el), field(t('საათამდე', 'To time'), toTime.el)),
        field(t('მიზეზი', 'Reason'), reason),
        h('p', { class: 'bz-note' }, t('ამ დროს ონლაინ ჩაწერა არ იქნება; არსებული ჯავშნები რჩება.', 'No online booking in this window; existing bookings stay.'))),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save] });
    save.addEventListener('click', () => busy(save, async () => {
      try {
        if (!fromDay.get() || !toDay.get() || !fromTime.get() || !toTime.get()) throw new Error(t('აირჩიე დღეები და საათები.', 'Pick the days and times.'));
        const startsAt = toIso(fromDay.get(), fromTime.get());
        const endsAt = toTime.get() === '24:00' ? toIso(addDays(toDay.get(), 1), '00:00') : toIso(toDay.get(), toTime.get());
        if (endsAt <= startsAt) throw new Error(t('დასასრული დასაწყისზე ადრეა.', 'The end is before the start.'));
        await biz.post('/time-off', { staffId: who.value || null, startsAt, endsAt, reason: reason.value.trim() || undefined });
        m.close(); ok(t('შენახულია', 'Saved')); paint();
      } catch (e) { fail(e); }
    }));
  }

  const nav = h('div', { class: 'bz-cal-head' },
    button('', { variant: 'ghost', icon: 'chevronLeft', ariaLabel: t('წინა', 'Previous'), onClick: () => { anchor = addDays(anchor, mode === 'day' ? -1 : -7); paint(); } }),
    button(t('დღეს', 'Today'), { variant: 'ghost', size: 'sm', onClick: () => { anchor = ymd(); paint(); } }),
    button('', { variant: 'ghost', icon: 'chevronRight', ariaLabel: t('შემდეგი', 'Next'), onClick: () => { anchor = addDays(anchor, mode === 'day' ? 1 : 7); paint(); } }),
    title,
    h('span', { class: 'spacer', style: { flex: 1 } }),
    staffCols.length > 1 && mode === 'week' ? select([{ value: '', label: t('ყველა თანამშრომელი', 'Everyone') }, ...staffCols.map((s) => ({ value: s.id, label: s.name }))], filterStaff, { onChange: (e) => { filterStaff = e.target.value; paint(); }, style: { maxWidth: '220px' } }) : null,
    segmented([{ value: 'day', label: t('დღე', 'Day') }, { value: 'week', label: t('კვირა', 'Week') }], mode, (v) => { mode = v; paint(); }));

  mount(root,
    pageHead(t('კალენდარი', 'Calendar'), t('ონლაინ ჯავშნები თავისით ჩნდება; თავისუფალ ადგილზე დაჭერით ვიზიტორს ამატებ.', 'Online bookings appear by themselves; click an empty spot to add a walk-in.'),
      canManage() ? button(t('დასვენება', 'Time off'), { variant: 'ghost', icon: 'moon', onClick: timeOffDialog }) : null,
      canManage() && classServices(context).length ? button(t('კლასი', 'Class'), { variant: 'ghost', icon: 'users', title: t('ჯგუფური კლასის დაგეგმვა', 'Plan a group class'), onClick: () => classDialog(context, { date: anchor }, { onCreated: paint }) }) : null,
      button(t('ახალი ჩანაწერი', 'New booking'), { icon: 'plus', onClick: () => newAppointmentDialog(context, { date: anchor }, { onCreated: paint }) })),
    nav, resHost, host);
  await paint();
  timer = setInterval(() => { if (document.contains(host)) paint(); }, 90_000);
  return () => clearInterval(timer);
}

export { state, icon, toIso };
