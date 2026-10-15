// MEDIBOOK business panel — the calendar: a day with a column per person, or a week with a column per day.
import { h, mount, icon, button, segmented, pageHead, openModal, field, input, select, busy } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { state, canManage } from '../state.js';
import { biz, ymd, addDays, weekdayOf, minutesOf, clock, WEEKDAYS_SHORT, WEEKDAYS, MONTHS, MONTHS_SHORT, fail, ok, toIso, emptyBox } from '../shared.js';
import { loadContext, newAppointmentDialog, openAppointment } from '../appointment.js';

const HOUR_H = 56;
/** h() assigns style objects with Object.assign, which ignores custom properties — set them by hand. */
function vars(el, map) { for (const [k, v] of Object.entries(map)) el.style.setProperty(k, String(v)); return el; }

export default async function calendarPage(root, ctx) {
  const context = await loadContext();
  const business = (await biz.get('')).business;
  const staffCols = context.staff.filter((s) => s.bookable || true);
  let mode = ctx.query.mode || (staffCols.length > 1 ? 'day' : 'week');
  let anchor = ctx.query.date && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date) ? ctx.query.date : ymd();
  let filterStaff = '';
  const host = h('div');
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
      const [{ appointments }, { timeOff }] = await Promise.all([biz.get('/appointments', { from, to, staffId: filterStaff || undefined }), biz.get('/time-off', { from, to })]);
      mount(host, grid(appointments, timeOff, from, to));
    } catch (e) { mount(host, emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message)); }
  }

  function grid(appointments, timeOff, from, to) {
    const { start, end } = hoursRange();
    const hours = [];
    for (let hh = start; hh < end; hh += 1) hours.push(hh);
    const cols = mode === 'day'
      ? (filterStaff ? staffCols.filter((s) => s.id === filterStaff) : staffCols.length ? staffCols : [{ id: null, name: t('გუნდი', 'Team'), color: '#A21CAF' }]).map((s) => ({ key: s.id ?? 'all', label: s.name, sub: s.title || '', color: s.color, date: anchor, staffId: s.id }))
      : Array.from({ length: 7 }, (_, i) => { const d = addDays(from, i); return { key: d, label: `${WEEKDAYS_SHORT[weekdayOf(d)]} ${Number(d.slice(8, 10))}`, sub: MONTHS_SHORT[Number(d.slice(5, 7)) - 1], date: d, staffId: null, today: d === ymd() }; });
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
      for (const a of sorted) {
        const top = ((minutesOf(a.startsAt) - start * 60) / 60) * HOUR_H;
        const height = Math.max(26, ((new Date(a.endsAt) - new Date(a.startsAt)) / 60000 / 60) * HOUR_H - 2);
        const color = a.staffColor || staffCols.find((s) => s.id === a.staffId)?.color || '#A21CAF';
        const width = 100 / laneCount;
        el.appendChild(vars(h('div', {
          class: `bz-cal-event${a.status === 'PENDING' ? ' is-pending' : ''}${a.status === 'CANCELLED' ? ' is-cancelled' : ''}${a.status === 'COMPLETED' || a.status === 'NO_SHOW' ? ' is-done' : ''}`,
          style: { top: `${top}px`, height: `${height}px`, left: `calc(${a._lane * width}% + 4px)`, right: `calc(${(laneCount - a._lane - 1) * width}% + 4px)` },
          title: `${clock(a.startsAt)}–${clock(a.endsAt)} · ${a.clientName} · ${a.serviceName}`,
          onClick: (e) => { e.stopPropagation(); openAppointment(a, context, { onChange: paint }); },
        }, h('b', null, `${clock(a.startsAt)} ${a.clientName}`), h('span', null, mode === 'week' && a.staffName ? `${a.serviceName} · ${a.staffName}` : a.serviceName)), { '--c': color }));
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
          h('div', { class: 'bz-cal-cols' }, h('div'), cols.map((c) => h('div', { class: `bz-cal-col-head${c.today ? ' today' : ''}` }, c.color ? h('span', { class: 'bz-color-dot', style: { background: c.color } }) : null, h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.label), c.sub ? h('small', null, c.sub) : null))),
          h('div', { class: 'bz-cal-body' },
            h('div', { class: 'bz-cal-hours' }, hours.map((hh) => h('div', { class: 'bz-cal-hour' }, `${String(hh).padStart(2, '0')}:00`))),
            cols.map(colEl))), { '--cols': cols.length, '--hour-h': `${HOUR_H}px` })),
      h('div', { class: 'bz-legend', style: { padding: '10px 14px 12px' } },
        h('span', null, h('i', { style: { background: 'var(--book)' } }), t('დადასტურებული', 'Confirmed')),
        h('span', null, h('i', { style: { background: 'repeating-linear-gradient(135deg, var(--book) 0 3px, transparent 3px 6px)' } }), t('დასადასტურებელი', 'To confirm')),
        h('span', null, h('i', { style: { background: 'var(--bg3)' } }), t('დახურული / დასვენება', 'Closed / time off')),
        h('span', { class: 'spacer' }),
        h('span', { class: 'faint' }, t('დააჭირე თავისუფალ ადგილს — ახალი ჩანაწერი', 'Click an empty spot for a new booking'))));
  }

  function timeOffDialog() {
    const who = select([{ value: '', label: t('მთელი ბიზნესი (დახურული დღე)', 'Whole business (closed)') }, ...staffCols.map((s) => ({ value: s.id, label: s.name }))], '');
    const from = input({ type: 'datetime-local', value: `${anchor}T09:00` });
    const to = input({ type: 'datetime-local', value: `${anchor}T19:00` });
    const reason = input({ placeholder: t('მიზეზი (არასავალდებულო)', 'Reason (optional)') });
    const save = button(t('შენახვა', 'Save'));
    const m = openModal({ title: t('დასვენება / დახურული საათები', 'Time off / closed hours'), size: 'sm', body: h('div', { class: 'form' }, field(t('ვისთვის', 'Who'), who), field(t('დან', 'From'), from), field(t('მდე', 'To'), to), field(t('მიზეზი', 'Reason'), reason)),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save] });
    save.addEventListener('click', () => busy(save, async () => {
      try { await biz.post('/time-off', { staffId: who.value || null, startsAt: toIso(from.value.slice(0, 10), from.value.slice(11, 16)), endsAt: toIso(to.value.slice(0, 10), to.value.slice(11, 16)), reason: reason.value.trim() || undefined }); m.close(); ok(t('შენახულია', 'Saved')); paint(); } catch (e) { fail(e); }
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
      button(t('ახალი ჩანაწერი', 'New booking'), { icon: 'plus', onClick: () => newAppointmentDialog(context, { date: anchor }, { onCreated: paint }) })),
    nav, host);
  await paint();
  timer = setInterval(() => { if (document.contains(host)) paint(); }, 90_000);
  return () => clearInterval(timer);
}

export { state, icon, toIso };
