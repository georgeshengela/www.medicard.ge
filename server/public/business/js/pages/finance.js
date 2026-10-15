// MEDIBOOK business panel — money: income from completed visits, expenses by hand, profit, methods, people,
// and a ledger with filters and pages.
import { h, mount, icon, button, segmented, pageHead, card, input, field, busy, openModal, confirmDialog } from '/app/js/ui.js';
import { lineChart, donut, meters } from '/app/js/charts.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, methodLabel, METHODS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, txCategoryLabel, dateText, when, emptyBox, fail, ok, MONTHS_SHORT, toIso, ymd, debounceFn } from '../shared.js';
import { dateField, select } from '../fields.js';
import { chips, filterBar, listState, pager, paginate, sortRows, sortableHead } from '../lists.js';

export default async function financePage(root, ctx) {
  const ls = listState('finance', { range: '30', kind: '', category: '', method: '', staff: '', sort: { key: 'at', dir: 'desc' }, size: 25 });
  const st = ls.state;
  if (ctx.query.range) st.range = ctx.query.range;
  let q = '';
  let page = 1;
  let data = null;
  let staff = [];
  const top = h('div');
  const ledger = h('div');
  const chipsHost = h('div');
  const count = h('span', { class: 'bz-filters-count' });

  async function load() {
    mount(top, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    mount(ledger);
    try {
      [data, { staff }] = await Promise.all([biz.get('/finance', { range: st.range }), biz.get('/staff')]);
      paintTop();
      page = 1;
      paintLedger();
    } catch (e) { mount(top, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  function paintTop() {
    const labels = data.series.map((d) => { const [, m, dd] = d.date.split('-'); return `${Number(dd)} ${MONTHS_SHORT[Number(m) - 1]}`; });
    const incomeN = data.transactions.filter((x) => x.kind === 'INCOME').length;
    const expenseN = data.transactions.filter((x) => x.kind === 'EXPENSE').length;
    mount(top,
      h('div', { class: 'bz-kpis' },
        kpi(t('შემოსავალი', 'Income'), gel(data.totals.income), t(`${incomeN} ჩანაწერი`, `${incomeN} entries`), true),
        kpi(t('ხარჯი', 'Expenses'), gel(data.totals.expense), t(`${expenseN} ჩანაწერი`, `${expenseN} entries`)),
        kpi(t('მოგება', 'Profit'), gel(data.totals.profit), data.totals.income ? t(`მარჟა ${Math.round((data.totals.profit / data.totals.income) * 100)}%`, `margin ${Math.round((data.totals.profit / data.totals.income) * 100)}%`) : ''),
        kpi(t('საშუალო ჩეკი', 'Average ticket'), data.totals.averageTicket == null ? '—' : gel(data.totals.averageTicket), data.totals.discountGiven ? t(`ფასდაკლება: ${gel(data.totals.discountGiven)}`, `discounts: ${gel(data.totals.discountGiven)}`) : '')),
      h('div', { class: 'bz-grid' },
        card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('შემოსავალი და ხარჯი დღეების მიხედვით', 'Income and expenses by day'))),
          data.series.some((d) => d.revenue || d.expense) ? lineChart({ labels, series: [{ name: t('შემოსავალი', 'Income'), values: data.series.map((d) => d.revenue), color: 'var(--c1)', area: true }, { name: t('ხარჯი', 'Expense'), values: data.series.map((d) => d.expense), color: 'var(--c3)' }], height: 220, fmt: (v) => gel(v) }) : emptyBox(t('ჯერ არაფერია', 'Nothing yet'), t('დასრულებული ვიზიტი თავისით იწერება შემოსავალში.', 'A completed visit writes itself into income.'))),
        h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
          card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('გადახდის მეთოდები', 'Payment methods')),
            Object.keys(data.methods).length ? h('div', { class: 'bz-inline', style: { gap: '18px' } }, donut({ parts: Object.entries(data.methods).map(([k, v], i) => ({ name: methodLabel(k === 'UNKNOWN' ? null : k), value: v, color: `var(--c${(i % 6) + 1})` })), size: 110, stroke: 14 }),
              h('div', { class: 'bz-src-legend' }, Object.entries(data.methods).map(([k, v], i) => h('div', { class: 'row' }, h('i', { style: { background: `var(--c${(i % 6) + 1})` } }), h('span', null, methodLabel(k === 'UNKNOWN' ? null : k)), h('b', null, gel(v)), h('small', null, data.totals.income ? `${Math.round((v / data.totals.income) * 100)}%` : ''))))) : h('p', { class: 'bz-sub' }, '—')),
          card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('შემოსავალი თანამშრომლებით', 'Income by person')),
            data.byStaff.some((s) => s.revenue) ? meters(data.byStaff.filter((s) => s.revenue).map((s) => ({ name: s.name, value: s.revenue, max: Math.max(...data.byStaff.map((x) => x.revenue)), right: gel(s.revenue), color: staff.find((p) => p.id === s.staffId)?.color || 'var(--c1)' }))) : h('p', { class: 'bz-sub' }, '—')),
          Object.keys(data.expenseByCategory).length ? card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('ხარჯი კატეგორიებით', 'Expenses by category')), meters(Object.entries(data.expenseByCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: txCategoryLabel(k), value: v, max: data.totals.expense, right: gel(v), color: 'var(--c3)' })))) : null)));
  }

  function paintLedger() {
    const term = q.trim().toLowerCase();
    const all = data.transactions;
    const sum = (list) => list.reduce((s, x) => s + x.amount, 0);
    mount(chipsHost, chips([
      ['', t('ყველა', 'All'), all.length],
      ['INCOME', t(`შემოსავალი · ${gel(sum(all.filter((x) => x.kind === 'INCOME')))}`, `Income · ${gel(sum(all.filter((x) => x.kind === 'INCOME')))}`), all.filter((x) => x.kind === 'INCOME').length],
      ['EXPENSE', t(`ხარჯი · ${gel(sum(all.filter((x) => x.kind === 'EXPENSE')))}`, `Expenses · ${gel(sum(all.filter((x) => x.kind === 'EXPENSE')))}`), all.filter((x) => x.kind === 'EXPENSE').length],
      ['MANUAL', t('ხელით დამატებული', 'Added by hand'), all.filter((x) => x.manual).length],
    ], st.kind, (v) => { ls.set({ kind: v }); page = 1; paintLedger(); }));
    let rows = all.filter((x) => {
      if (st.kind === 'MANUAL' ? !x.manual : st.kind && x.kind !== st.kind) return false;
      if (st.category && x.category !== st.category) return false;
      if (st.method && (x.method || 'UNKNOWN') !== st.method) return false;
      if (st.staff && x.staffId !== st.staff) return false;
      if (term && !`${x.clientName || ''} ${x.serviceName || ''} ${x.staffName || ''} ${x.note || ''} ${txCategoryLabel(x.category)}`.toLowerCase().includes(term)) return false;
      return true;
    });
    rows = sortRows(rows, st.sort, { at: (x) => x.at, amount: (x) => x.amount, category: (x) => txCategoryLabel(x.category) });
    const shown = sum(rows.filter((x) => x.kind === 'INCOME')) - sum(rows.filter((x) => x.kind === 'EXPENSE'));
    count.textContent = t(`${rows.length} ჩანაწერი · ბალანსი ${shown >= 0 ? '+' : '−'}${gel(Math.abs(shown))}`, `${rows.length} entries · net ${shown >= 0 ? '+' : '−'}${gel(Math.abs(shown))}`);
    if (!rows.length) { mount(ledger, card(emptyBox(t('ჩანაწერი არ არის', 'Nothing here'), t('შეცვალე ფილტრი ან პერიოდი.', 'Change the filter or the period.')))); return; }
    const pg = paginate(rows, page, st.size);
    const columns = [
      { key: 'at', label: t('თარიღი', 'Date') }, { label: t('რა', 'What') }, { key: 'category', label: t('კატეგორია', 'Category'), dir: 'asc' }, { label: t('მეთოდი', 'Method') }, { label: t('ვინ', 'Who') }, { key: 'amount', label: t('თანხა', 'Amount'), class: 'num' }, { label: '' },
    ];
    mount(ledger,
      card({ class: 'flush' },
        h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table bz-table-rows' },
          sortableHead(columns, st.sort, (sort) => { ls.set({ sort }); paintLedger(); }),
          h('tbody', null, pg.rows.map((x) => h('tr', null,
            h('td', null, h('b', null, dateText(x.at)), h('div', { class: 'faint' }, when(x.at).split(' · ')[1] || '')),
            h('td', null, h('div', { class: 'bz-cell-main' }, x.appointmentId ? [h('span', null, x.clientName || '—'), h('div', { class: 'faint' }, x.serviceName || '')] : h('span', null, x.note || txCategoryLabel(x.category)))),
            h('td', null, h('span', { class: `bz-tag ${x.kind === 'INCOME' ? 'bz-tag-ok' : ''}` }, txCategoryLabel(x.category))),
            h('td', null, methodLabel(x.method)),
            h('td', null, x.staffName ? h('span', { class: 'bz-inline' }, h('span', { class: 'bz-color-dot', style: { background: staff.find((p) => p.id === x.staffId)?.color || 'var(--bg3)' } }), x.staffName) : h('span', { class: 'bz-dim' }, '—')),
            h('td', { class: `num ${x.kind === 'INCOME' ? 'bz-ok' : 'bz-bad'}` }, h('b', null, `${x.kind === 'INCOME' ? '+' : '−'}${gel(x.amount)}`)),
            h('td', { class: 'num' }, h('div', { class: 'bz-row-actions' }, x.manual
              ? button('', { variant: 'ghost', size: 'sm', icon: 'trash', ariaLabel: t('წაშლა', 'Delete'), title: t('წაშლა', 'Delete'), class: 'bz-row-act is-bad', onClick: async () => { if (await confirmDialog({ title: t('წავშალო?', 'Delete?'), body: `${txCategoryLabel(x.category)} · ${gel(x.amount)}`, confirm: t('წაშლა', 'Delete'), danger: true })) { try { await biz.del(`/transactions/${x.id}`); load(); } catch (e) { fail(e); } } } })
              : h('span', { class: 'faint', title: t('ვიზიტიდან — იცვლება ჩანაწერში', 'From a visit — change it on the appointment') }, icon('calendarCheck', { size: 14 }))))))))),
        pager({ ...pg, size: st.size, onPage: (p) => { page = p; paintLedger(); ledger.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, onSize: (n) => { ls.set({ size: n }); page = 1; paintLedger(); } })));
  }

  const search = input({ type: 'search', placeholder: t('კლიენტი, სერვისი, შენიშვნა…', 'Client, service, note…'), class: 'input bz-search' });
  search.addEventListener('input', debounceFn(() => { q = search.value; page = 1; paintLedger(); }, 200));
  const cats = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].filter(([v], i, arr) => arr.findIndex(([x]) => x === v) === i);
  mount(root,
    pageHead(t('ფინანსები', 'Finance'), t('დასრულებული ვიზიტი თავისით იწერება შემოსავალში; ხარჯებს აქ ამატებ.', 'A completed visit writes itself into income; expenses go in here.'),
      button(t('ხარჯის დამატება', 'Add an expense'), { variant: 'ghost', icon: 'minus', onClick: () => txDialog('EXPENSE', load) }),
      button(t('შემოსავლის დამატება', 'Add income'), { icon: 'plus', onClick: () => txDialog('INCOME', load) })),
    h('div', { class: 'bz-toolbar' }, segmented([{ value: '7', label: t('7 დღე', '7 days') }, { value: '30', label: t('30 დღე', '30 days') }, { value: 'month', label: t('ეს თვე', 'This month') }, { value: '90', label: t('90 დღე', '90 days') }, { value: '365', label: t('წელი', 'Year') }], st.range, (v) => { ls.set({ range: v }); load(); })),
    top,
    h('h2', { class: 'bz-h2' }, t('ჩანაწერები', 'Ledger')),
    filterBar(
      h('div', { class: 'bz-filters-row' }, search,
        select([{ value: '', label: t('ყველა კატეგორია', 'Any category') }, ...cats.map(([value, label]) => ({ value, label }))], st.category, { onChange: (e) => { ls.set({ category: e.target.value }); page = 1; paintLedger(); }, style: { maxWidth: '180px' } }),
        select([{ value: '', label: t('ყველა მეთოდი', 'Any method') }, ...METHODS.map(([value, label]) => ({ value, label })), { value: 'UNKNOWN', label: t('მითითების გარეშე', 'Not set') }], st.method, { onChange: (e) => { ls.set({ method: e.target.value }); page = 1; paintLedger(); }, style: { maxWidth: '170px' } }),
        h('span', { class: 'bz-staff-select' }),
        h('span', { class: 'spacer' }), count),
      chipsHost),
    ledger);
  await load();
  const staffSel = root.querySelector('.bz-staff-select');
  if (staffSel) mount(staffSel, select([{ value: '', label: t('ყველა თანამშრომელი', 'Everyone') }, ...staff.map((s) => ({ value: s.id, label: s.name }))], st.staff, { onChange: (e) => { ls.set({ staff: e.target.value }); page = 1; paintLedger(); }, style: { maxWidth: '190px' } }));
}

function kpi(label, value, delta, accent) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}

function txDialog(kind, onSaved) {
  const cats = kind === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const category = select(cats.map(([value, label]) => ({ value, label })), cats[0][0]);
  const amount = input({ type: 'number', min: 0, step: '0.01', required: true, placeholder: '0.00' });
  const method = select(METHODS.map(([value, label]) => ({ value, label })), kind === 'EXPENSE' ? 'TRANSFER' : 'CASH');
  const at = dateField({ value: ymd() });
  const note = input({ placeholder: kind === 'EXPENSE' ? t('მაგ. ოქტომბრის ქირა, მასალები „ჯორჯიან ფარმიდან“', 'e.g. October rent, supplies from the wholesaler') : t('მაგ. სასაჩუქრე ბარათი', 'e.g. gift card') });
  const save = button(t('შენახვა', 'Save'));
  const m = openModal({
    title: kind === 'EXPENSE' ? t('ხარჯი', 'Expense') : t('შემოსავალი', 'Income'),
    size: 'sm',
    body: h('div', { class: 'form' }, h('div', { class: 'form-row' }, field(t('თანხა, ₾', 'Amount, ₾'), amount), field(t('თარიღი', 'Date'), at.el)), field(t('კატეგორია', 'Category'), category), field(t('მეთოდი', 'Method'), method), field(t('შენიშვნა', 'Note'), note)),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
  });
  setTimeout(() => amount.focus(), 60);
  save.addEventListener('click', () => busy(save, async () => {
    try {
      if (!(Number(amount.value) > 0)) throw new Error(t('ჩაწერე თანხა.', 'Enter an amount.'));
      await biz.post('/transactions', { kind, category: category.value, amount: Number(amount.value), method: method.value, note: note.value.trim() || undefined, at: toIso(at.get() || ymd(), '12:00') });
      m.close();
      ok(t('შენახულია', 'Saved'));
      onSaved?.();
    } catch (e) { fail(e); }
  }));
}

export { dateText };
