// MEDIBOOK business panel — every booking as a list: filter by status and period, search by client.
import { h, mount, icon, button, segmented, pageHead, card, input, select } from '/app/js/ui.js';
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
      const { appointments } = await biz.get('/appointments', { from, to, status: status || undefined });
      const term = q.trim().toLowerCase();
      let rows = appointments.filter((a) => !term || `${a.clientName} ${a.clientPhone || ''} ${a.serviceName} ${a.staffName || ''}`.toLowerCase().includes(term));
      if (period === 'past') rows = rows.reverse();
      count.textContent = t(`${rows.length} ჩანაწერი`, `${rows.length} entries`);
      mount(host, rows.length ? card(h('div', { class: 'bz-timeline' }, rows.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: paint }) })))) : card(emptyBox(t('ჩანაწერი არ არის', 'Nothing here'), t('შეცვალე პერიოდი ან სტატუსი.', 'Change the period or status.'))));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  const search = input({ type: 'search', placeholder: t('კლიენტი, ტელეფონი, სერვისი…', 'Client, phone, service…') });
  search.addEventListener('input', debounceFn(() => { q = search.value; paint(); }, 250));
  mount(root,
    pageHead(t('ჯავშნები', 'Bookings'), t('ყველა ჩანაწერი სიით — აპიდან, ვებიდან და ხელით დამატებული.', 'Every booking as a list — from the app, the web and by hand.'),
      button(t('ახალი ჩანაწერი', 'New booking'), { icon: 'plus', onClick: () => newAppointmentDialog(context, {}, { onCreated: paint }) })),
    h('div', { class: 'bz-toolbar' },
      segmented([
        { value: 'today', label: t('დღეს', 'Today') }, { value: 'week', label: t('7 დღე', '7 days') }, { value: 'month', label: t('30 დღე', '30 days') }, { value: 'past', label: t('წარსული', 'Past') }, { value: 'all', label: t('ყველა', 'All') },
      ], period, (v) => { period = v; paint(); }),
      select([{ value: '', label: t('ყველა სტატუსი', 'Any status') }, ...Object.entries(STATUS).map(([value, [label]]) => ({ value, label }))], status, { onChange: (e) => { status = e.target.value; paint(); }, style: { maxWidth: '200px' } }),
      search,
      h('span', { class: 'spacer' }),
      count),
    host);
  await paint();
}

export { icon };
