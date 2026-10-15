// MEDIBOOK business panel — every booking as a table: filters (period, status, person, source, search),
// day groups, quick actions in the row, 25 a page.
import { h, mount, icon, button, segmented, pageHead, card, input, select, confirmDialog } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, ymd, addDays, fromYmd, STATUS, statusBadge, emptyBox, debounceFn, clock, dayLabel, gel, minutes, avatar, phoneText, fail, ok } from '../shared.js';
import { appointmentLine, loadContext, newAppointmentDialog, openAppointment } from '../appointment.js';
import { chips, filterBar, groupBy, listState, pager, paginate, sortRows, sortableHead } from '../lists.js';
import { dateField } from '../fields.js';
import { canManage } from '../state.js';

const SOURCE = { APP: [t('აპიდან', 'App'), 'smartphone'], WEB: [t('ვებიდან', 'Web'), 'link'], BUSINESS: [t('ხელით', 'Walk-in'), 'userPlus'] };

export default async function appointmentsPage(root, ctx) {
  const context = await loadContext();
  const ls = listState('appointments', { period: 'week', status: '', staff: '', source: '', sort: { key: 'time', dir: 'asc' }, size: 25, from: '', to: '' });
  const st = ls.state;
  if (ctx.query.period) st.period = ctx.query.period;
  if (ctx.query.status !== undefined) st.status = ctx.query.status;
  let q = '';
  let page = 1;
  let all = [];
  const host = h('div');
  const chipsHost = h('div');
  const count = h('span', { class: 'bz-filters-count' });

  const range = () => {
    const today = ymd();
    if (st.period === 'today') return { from: today, to: today };
    if (st.period === 'week') return { from: today, to: addDays(today, 7) };
    if (st.period === 'month') return { from: today, to: addDays(today, 30) };
    if (st.period === 'past') return { from: addDays(today, -90), to: addDays(today, -1) };
    if (st.period === 'custom') return { from: st.from || today, to: st.to || addDays(st.from || today, 7) };
    return { from: addDays(today, -30), to: addDays(today, 60) };
  };

  async function load() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const { from, to } = range();
      all = (await biz.get('/appointments', { from, to })).appointments;
      page = 1;
      paint();
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  function paint() {
    const term = q.trim().toLowerCase();
    const counts = {};
    for (const a of all) counts[a.status] = (counts[a.status] || 0) + 1;
    mount(chipsHost, chips([['', t('ყველა', 'All'), all.length], ...Object.entries(STATUS).map(([v, [label]]) => [v, label, counts[v] || 0])], st.status, (v) => { ls.set({ status: v }); page = 1; paint(); }));
    let rows = all.filter((a) => (!st.status || a.status === st.status) && (!st.staff || a.staffId === st.staff) && (!st.source || a.source === st.source)
      && (!term || `${a.clientName} ${a.clientPhone || ''} ${a.serviceName} ${a.staffName || ''} ${a.note || ''} ${a.internalNote || ''}`.toLowerCase().includes(term)));
    rows = sortRows(rows, st.sort, {
      time: (a) => a.startsAt,
      client: (a) => a.clientName,
      service: (a) => a.serviceName,
      staff: (a) => a.staffName || '',
      price: (a) => (a.price == null ? null : Number(a.price)),
      status: (a) => a.status,
    });
    count.textContent = t(`${rows.length} ჩანაწერი`, `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`);
    const pg = paginate(rows, page, st.size);
    if (!rows.length) { mount(host, card(emptyBox(t('ჩანაწერი არ არის', 'Nothing here'), t('შეცვალე პერიოდი, სტატუსი ან ძებნა.', 'Change the period, the status or the search.')))); return; }
    const groups = st.sort.key === 'time' ? groupBy(pg.rows, (a) => ymd(a.startsAt)) : [[null, pg.rows]];
    const columns = [
      { key: 'time', label: t('დრო', 'Time'), dir: 'asc' }, { key: 'client', label: t('კლიენტი', 'Client') }, { key: 'service', label: t('სერვისი', 'Service') },
      { key: 'staff', label: t('ვინ', 'Who') }, { key: 'price', label: t('ფასი', 'Price'), class: 'num' }, { key: 'status', label: t('სტატუსი', 'Status') }, { label: '' },
    ];
    mount(host,
      card({ class: 'flush' },
        h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table bz-table-rows' },
          sortableHead(columns, st.sort, (sort) => { ls.set({ sort }); paint(); }),
          h('tbody', null, groups.flatMap(([day, list]) => [
            day ? h('tr', { class: 'bz-day-row' }, h('td', { colspan: 7 }, h('b', null, dayLabel(fromYmd(day), { long: true })), h('span', null, t(`${list.length} ჩანაწერი`, `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`)))) : null,
            ...list.map((a) => row(a)),
          ])))),
        pager({ ...pg, size: st.size, onPage: (p) => { page = p; paint(); host.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, onSize: (n) => { ls.set({ size: n }); page = 1; paint(); } })));
  }

  function row(a) {
    const past = new Date(a.endsAt) < new Date();
    const color = a.staffColor || context.staff.find((s) => s.id === a.staffId)?.color || 'var(--bg3)';
    const src = SOURCE[a.source] || SOURCE.BUSINESS;
    const act = (label, ic, fn, cls = '') => button('', { variant: 'ghost', size: 'sm', icon: ic, ariaLabel: label, title: label, class: `bz-row-act ${cls}`, onClick: (e) => { e.stopPropagation(); fn(); } });
    const actions = [];
    if (a.status === 'PENDING') actions.push(act(t('დადასტურება', 'Confirm'), 'check', () => setStatus(a, 'CONFIRMED'), 'is-ok'));
    if (a.status === 'CONFIRMED' && past) actions.push(act(t('დასრულება', 'Complete'), 'calendarCheck', () => openAppointment(a, context, { onChange: load })));
    if (a.status === 'PENDING' || a.status === 'CONFIRMED') actions.push(act(t('გაუქმება', 'Cancel'), 'x', async () => { if (await confirmDialog({ title: t('ჯავშნის გაუქმება?', 'Cancel the booking?'), body: `${a.clientName} · ${a.serviceName} · ${clock(a.startsAt)}`, confirm: t('გაუქმება', 'Cancel booking'), danger: true })) setStatus(a, 'CANCELLED'); }, 'is-bad'));
    return h('tr', { class: `is-link${a.status === 'CANCELLED' ? ' is-muted' : ''}`, onClick: () => openAppointment(a, context, { onChange: load }) },
      h('td', { class: 'bz-cell-time' }, h('b', null, clock(a.startsAt)), h('div', { class: 'faint' }, `${clock(a.endsAt)} · ${minutes(a.durationMin)}`)),
      h('td', null, h('div', { class: 'bz-inline' }, avatar(a.clientName, a.clientUserId ? 'var(--book-2)' : 'var(--bg3)', 30), h('div', { class: 'bz-cell-main' }, h('b', null, a.clientName), h('div', { class: 'faint' }, a.clientPhone ? phoneText(a.clientPhone) : t('ტელეფონის გარეშე', 'No phone'))))),
      h('td', null, h('div', { class: 'bz-cell-main' }, h('span', null, a.serviceName), a.note ? h('div', { class: 'faint', title: a.note }, icon('message', { size: 12 }), ' ', a.note.length > 42 ? `${a.note.slice(0, 42)}…` : a.note) : null)),
      h('td', null, h('span', { class: 'bz-inline' }, h('span', { class: 'bz-color-dot', style: { background: color } }), a.staffName || t('ნებისმიერი', 'Anyone'))),
      h('td', { class: 'num' }, a.price == null ? h('span', { class: 'bz-dim' }, '—') : h('span', null, gel(a.price), a.discountAmount ? h('div', { class: 'faint' }, `−${gel(a.discountAmount)}`) : null)),
      h('td', null, h('div', { class: 'bz-inline', style: { gap: '6px' } }, statusBadge(a.status), h('span', { class: 'bz-src', title: src[0] }, icon(src[1], { size: 13 })))),
      h('td', { class: 'num' }, h('div', { class: 'bz-row-actions' }, actions)));
  }

  async function setStatus(a, status) {
    try { await biz.patch(`/appointments/${a.id}`, { status }); ok(t('შენახულია', 'Saved')); load(); } catch (e) { fail(e); }
  }

  const search = input({ type: 'search', placeholder: t('კლიენტი, ტელეფონი, სერვისი, შენიშვნა…', 'Client, phone, service, note…'), class: 'input bz-search' });
  search.addEventListener('input', debounceFn(() => { q = search.value; page = 1; paint(); }, 200));
  const customRange = h('div', { class: 'bz-inline', style: { display: st.period === 'custom' ? 'flex' : 'none' } });
  const fromF = dateField({ value: st.from || ymd(), onChange: (v) => { ls.set({ from: v }); if (st.to < v) { ls.set({ to: v }); toF.set(v); } load(); } });
  const toF = dateField({ value: st.to || addDays(ymd(), 7), onChange: (v) => { ls.set({ to: v }); load(); } });
  mount(customRange, fromF.el, h('span', { class: 'faint' }, '—'), toF.el);
  const periodSeg = segmented([
    { value: 'today', label: t('დღეს', 'Today') }, { value: 'week', label: t('7 დღე', '7 days') }, { value: 'month', label: t('30 დღე', '30 days') }, { value: 'past', label: t('წარსული', 'Past') }, { value: 'all', label: t('ყველა', 'All') }, { value: 'custom', label: t('პერიოდი', 'Range') },
  ], st.period, (v) => { ls.set({ period: v }); customRange.style.display = v === 'custom' ? 'flex' : 'none'; load(); });

  mount(root,
    pageHead(t('ჯავშნები', 'Bookings'), t('ყველა ჩანაწერი — აპიდან, ვებიდან და ხელით. ფილტრები ზემოთ, სწრაფი ქმედებები რიგში.', 'Every booking — from the app, the web and by hand. Filters above, quick actions in the row.'),
      button(t('ახალი ჩანაწერი', 'New booking'), { icon: 'plus', onClick: () => newAppointmentDialog(context, {}, { onCreated: load }) })),
    filterBar(
      h('div', { class: 'bz-filters-row' }, periodSeg, customRange, h('span', { class: 'spacer' }), count),
      h('div', { class: 'bz-filters-row' }, search,
        select([{ value: '', label: t('ყველა თანამშრომელი', 'Everyone') }, ...context.staff.map((s) => ({ value: s.id, label: s.name }))], st.staff, { onChange: (e) => { ls.set({ staff: e.target.value }); page = 1; paint(); }, style: { maxWidth: '200px' } }),
        select([{ value: '', label: t('ყველა წყარო', 'Any source') }, ...Object.entries(SOURCE).map(([value, [label]]) => ({ value, label }))], st.source, { onChange: (e) => { ls.set({ source: e.target.value }); page = 1; paint(); }, style: { maxWidth: '160px' } })),
      chipsHost),
    host);
  await load();
}

export { icon, appointmentLine, canManage };
