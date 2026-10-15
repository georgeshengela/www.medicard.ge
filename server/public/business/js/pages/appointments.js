// MEDIBOOK business panel — every booking as a list: filter by status and period, search by client.
import { h, mount, icon, button, segmented, pageHead, card, input } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, ymd, addDays, STATUS, emptyBox, debounceFn } from '../shared.js';
import { appointmentLine, loadContext, newAppointmentDialog, openAppointment } from '../appointment.js';

export default async function appointmentsPage(root, ctx) {
  const context = await loadContext();
  let period = ctx.query.period || 'week';
  let status = ctx.query.status || '';
  let q = '';
  const host = h('div');
  const count = h('span', { class: 'bz-sub' });

  const range = () => {
    const today = ymd();
    if (period === 'today') return { from: today, to: today };
    if (period === 'week') return { from: today, to: addDays(today, 7) };
    if (period === 'month') return { from: today, to: addDays(today, 30) };
    if (period === 'past') return { from: addDays(today, -60), to: addDays(today, -1) };
    return { from: addDays(today, -7), to: addDays(today, 60) };
  };

  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const { from, to } = range();
      const { appointments } = await biz.get('/appointments', { from, to });
      const term = q.trim().toLowerCase();
      const counts = {};
      for (const a of appointments) counts[a.status] = (counts[a.status] || 0) + 1;
      mount(chips, [['', t('ყველა', 'All'), appointments.length], ...Object.entries(STATUS).map(([value, [label]]) => [value, label, counts[value] || 0])].map(([value, label, n]) =>
        h('button', { type: 'button', class: `bz-chip${status === value ? ' on' : ''}`, onClick: () => { status = value; paint(); } }, label, h('i', { class: 'n' }, String(n)))));
      let rows = appointments.filter((a) => (!status || a.status === status) && (!term || `${a.clientName} ${a.clientPhone || ''} ${a.serviceName} ${a.staffName || ''}`.toLowerCase().includes(term)));
      if (period === 'past') rows = rows.reverse();
      count.textContent = t(`${rows.length} ჩანაწერი`, `${rows.length} entries`);
      mount(host, rows.length ? card(h('div', { class: 'bz-timeline' }, rows.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: paint }) })))) : card(emptyBox(t('ჩანაწერი არ არის', 'Nothing here'), t('შეცვალე პერიოდი ან სტატუსი.', 'Change the period or status.'))));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  const chips = h('div', { class: 'bz-chips', style: { marginBottom: '12px' } });
  const search = input({ type: 'search', placeholder: t('კლიენტი, ტელეფონი, სერვისი…', 'Client, phone, service…') });
  search.addEventListener('input', debounceFn(() => { q = search.value; paint(); }, 250));
  mount(root,
    pageHead(t('ჯავშნები', 'Bookings'), t('ყველა ჩანაწერი სიით — აპიდან, ვებიდან და ხელით დამატებული.', 'Every booking as a list — from the app, the web and by hand.'),
      button(t('ახალი ჩანაწერი', 'New booking'), { icon: 'plus', onClick: () => newAppointmentDialog(context, {}, { onCreated: paint }) })),
    h('div', { class: 'bz-toolbar' },
      segmented([
        { value: 'today', label: t('დღეს', 'Today') }, { value: 'week', label: t('7 დღე', '7 days') }, { value: 'month', label: t('30 დღე', '30 days') }, { value: 'past', label: t('წარსული', 'Past') }, { value: 'all', label: t('ყველა', 'All') },
      ], period, (v) => { period = v; paint(); }),
      search,
      h('span', { class: 'spacer' }),
      count),
    chips,
    host);
  await paint();
}

export { icon };
