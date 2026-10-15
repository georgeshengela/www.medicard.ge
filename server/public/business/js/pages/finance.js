// MEDIBOOK business panel — money: income from completed visits, expenses by hand, profit, methods, people.
import { h, mount, icon, button, segmented, pageHead, card, input, field, select, busy, openModal, confirmDialog } from '/app/js/ui.js';
import { lineChart, donut, meters } from '/app/js/charts.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, methodLabel, METHODS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, txCategoryLabel, dateText, when, emptyBox, fail, ok, MONTHS_SHORT, toIso, ymd } from '../shared.js';

export default async function financePage(root, ctx) {
  let range = ctx.query.range || '30';
  const host = h('div');
  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const [data, { staff }] = await Promise.all([biz.get('/finance', { range }), biz.get('/staff')]);
      const labels = data.series.map((d) => { const [, m, dd] = d.date.split('-'); return `${Number(dd)} ${MONTHS_SHORT[Number(m) - 1]}`; });
      mount(host,
        h('div', { class: 'bz-kpis' },
          kpi(t('შემოსავალი', 'Income'), gel(data.totals.income), t(`${data.transactions.filter((x) => x.kind === 'INCOME').length} ჩანაწერი`, `${data.transactions.filter((x) => x.kind === 'INCOME').length} entries`), true),
          kpi(t('ხარჯი', 'Expenses'), gel(data.totals.expense), t(`${data.transactions.filter((x) => x.kind === 'EXPENSE').length} ჩანაწერი`, `${data.transactions.filter((x) => x.kind === 'EXPENSE').length} entries`)),
          kpi(t('მოგება', 'Profit'), gel(data.totals.profit), data.totals.income ? t(`მარჟა ${Math.round((data.totals.profit / data.totals.income) * 100)}%`, `margin ${Math.round((data.totals.profit / data.totals.income) * 100)}%`) : ''),
          kpi(t('საშუალო ჩეკი', 'Average ticket'), data.totals.averageTicket == null ? '—' : gel(data.totals.averageTicket), data.totals.discountGiven ? t(`ფასდაკლება: ${gel(data.totals.discountGiven)}`, `discounts: ${gel(data.totals.discountGiven)}`) : '')),
        h('div', { class: 'bz-grid' },
          card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('შემოსავალი და ხარჯი დღეების მიხედვით', 'Income and expenses by day'))),
            data.series.some((d) => d.revenue || d.expense) ? lineChart({ labels, series: [{ name: t('შემოსავალი', 'Income'), values: data.series.map((d) => d.revenue), color: 'var(--c1)', area: true }, { name: t('ხარჯი', 'Expenses'), values: data.series.map((d) => d.expense), color: 'var(--c3)' }], height: 240, unit: '₾' }) : emptyBox(t('ამ პერიოდში ფულადი ჩანაწერი არ არის', 'No money movements in this period'), t('დასრულებული ვიზიტი თავისით ჩაიწერება შემოსავალში.', 'A completed visit writes itself into income.'))),
          h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
            card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('გადახდის მეთოდები', 'Payment methods')),
              Object.keys(data.methods).length ? h('div', { class: 'bz-inline', style: { gap: '18px' } }, donut({ parts: Object.entries(data.methods).map(([k, v], i) => ({ name: methodLabel(k === 'UNKNOWN' ? null : k), value: v, color: `var(--c${(i % 6) + 1})` })), size: 120, stroke: 14 }), h('div', null, Object.entries(data.methods).map(([k, v], i) => h('div', { class: 'bz-inline', style: { fontSize: '13.5px', padding: '2px 0' } }, h('span', { class: 'bz-color-dot', style: { background: `var(--c${(i % 6) + 1})` } }), `${methodLabel(k === 'UNKNOWN' ? null : k)} — ${gel(v)}`)))) : h('p', { class: 'bz-sub' }, t('მეთოდი ვიზიტის დასრულებისას ინიშნება.', 'The method is chosen when a visit is completed.'))),
            card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('შემოსავალი თანამშრომლებით', 'Income by person')),
              data.byStaff.some((s) => s.revenue) ? meters(data.byStaff.filter((s) => s.revenue).map((s) => ({ name: s.name, value: s.revenue, max: Math.max(...data.byStaff.map((x) => x.revenue)), right: gel(s.revenue), color: staff.find((p) => p.id === s.staffId)?.color || 'var(--book)' }))) : h('p', { class: 'bz-sub' }, t('დასრულებული ვიზიტების შემდეგ.', 'After completed visits.'))),
            Object.keys(data.expenseByCategory).length ? card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('ხარჯი კატეგორიებით', 'Expenses by category')), meters(Object.entries(data.expenseByCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: txCategoryLabel(k), value: v, max: data.totals.expense, right: gel(v), color: 'var(--c3)' })))) : null)),
        card({ class: 'flush', style: { marginTop: '16px' } },
          h('div', { class: 'card-head', style: { padding: '16px 18px 0' } }, h('div', { class: 'card-title' }, t('ჩანაწერები', 'Ledger')), h('span', { class: 'bz-sub' }, t(`${data.transactions.length} ჩანაწერი`, `${data.transactions.length} entries`))),
          data.transactions.length ? h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
            h('thead', null, h('tr', null, h('th', null, t('თარიღი', 'Date')), h('th', null, t('რა', 'What')), h('th', null, t('კატეგორია', 'Category')), h('th', null, t('მეთოდი', 'Method')), h('th', { class: 'num' }, t('თანხა', 'Amount')), h('th'))),
            h('tbody', null, data.transactions.map((x) => h('tr', null,
              h('td', null, when(x.at)),
              h('td', null, x.appointmentId ? `${x.clientName || ''} · ${x.serviceName || ''}${x.staffName ? ` · ${x.staffName}` : ''}` : (x.note || txCategoryLabel(x.category))),
              h('td', null, txCategoryLabel(x.category)),
              h('td', null, methodLabel(x.method)),
              h('td', { class: `num ${x.kind === 'INCOME' ? 'bz-ok' : 'bz-bad'}` }, `${x.kind === 'INCOME' ? '+' : '−'}${gel(x.amount)}`),
              h('td', { class: 'num' }, x.manual ? button('', { variant: 'ghost', size: 'sm', icon: 'trash', ariaLabel: t('წაშლა', 'Delete'), onClick: async () => { if (await confirmDialog({ title: t('წავშალო?', 'Delete?'), body: `${txCategoryLabel(x.category)} · ${gel(x.amount)}`, confirm: t('წაშლა', 'Delete'), danger: true })) { try { await biz.del(`/transactions/${x.id}`); paint(); } catch (e) { fail(e); } } } }) : h('span', { class: 'faint', title: t('ვიზიტიდან — იცვლება ჩანაწერში', 'From a visit — change it on the appointment') }, icon('calendarCheck', { size: 14 })))))))) : h('div', { style: { padding: '8px 18px 18px' } }, h('p', { class: 'bz-sub' }, t('ჯერ არაფერია.', 'Nothing yet.')))));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }
  mount(root,
    pageHead(t('ფინანსები', 'Finance'), t('დასრულებული ვიზიტი თავისით იწერება შემოსავალში; ხარჯებს აქ ამატებ.', 'A completed visit writes itself into income; expenses go in here.'),
      button(t('ხარჯის დამატება', 'Add an expense'), { variant: 'ghost', icon: 'minus', onClick: () => txDialog('EXPENSE', paint) }),
      button(t('შემოსავლის დამატება', 'Add income'), { icon: 'plus', onClick: () => txDialog('INCOME', paint) })),
    h('div', { class: 'bz-toolbar' }, segmented([{ value: '7', label: t('7 დღე', '7 days') }, { value: '30', label: t('30 დღე', '30 days') }, { value: 'month', label: t('ეს თვე', 'This month') }, { value: '90', label: t('90 დღე', '90 days') }, { value: '365', label: t('წელი', 'Year') }], range, (v) => { range = v; paint(); })),
    host);
  await paint();
}

function kpi(label, value, delta, accent) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}

function txDialog(kind, onSaved) {
  const cats = kind === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const category = select(cats.map(([value, label]) => ({ value, label })), cats[0][0]);
  const amount = input({ type: 'number', min: 0, step: '0.01', required: true, placeholder: '0.00' });
  const method = select(METHODS.map(([value, label]) => ({ value, label })), 'CASH');
  const at = input({ type: 'date', value: ymd() });
  const note = input({ placeholder: t('შენიშვნა', 'Note') });
  const save = button(t('შენახვა', 'Save'));
  const m = openModal({
    title: kind === 'EXPENSE' ? t('ხარჯი', 'Expense') : t('შემოსავალი', 'Income'),
    size: 'sm',
    body: h('div', { class: 'form' }, h('div', { class: 'form-row' }, field(t('თანხა, ₾', 'Amount, ₾'), amount), field(t('თარიღი', 'Date'), at)), field(t('კატეგორია', 'Category'), category), field(t('მეთოდი', 'Method'), method), field(t('შენიშვნა', 'Note'), note)),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
  });
  save.addEventListener('click', () => busy(save, async () => {
    try {
      await biz.post('/transactions', { kind, category: category.value, amount: Number(amount.value), method: method.value, note: note.value.trim() || undefined, at: toIso(at.value, '12:00') });
      m.close();
      ok(t('შენახულია', 'Saved'));
      onSaved?.();
    } catch (e) { fail(e); }
  }));
}

export { dateText };
