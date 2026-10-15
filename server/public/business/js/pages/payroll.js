// MEDIBOOK business panel — payroll: pay rules per person, what each earned over a period, payouts.
import { h, mount, icon, button, pageHead, card, input, field, select, busy, openModal, confirmDialog, badge, segmented } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, pct, emptyBox, fail, ok, avatar, dateText, when, methodLabel, METHODS, ymd, addDays } from '../shared.js';
import { dateField } from '../fields.js';

export default async function payrollPage(root) {
  const host = h('div');
  const today = ymd();
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevEnd = addDays(monthStart, -1);
  const prevStart = `${prevEnd.slice(0, 7)}-01`;
  let mode = 'this';
  let from = monthStart;
  let to = today;
  const fromF = dateField({ value: from, onChange: (v) => { from = v; mode = 'custom'; paint(); } });
  const toF = dateField({ value: to, onChange: (v) => { to = v; mode = 'custom'; paint(); } });

  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const r = await biz.get('/payroll', { from, to });
      const periodBar = h('div', { class: 'bz-inline', style: { flexWrap: 'wrap', gap: '8px' } },
        segmented([{ value: 'this', label: t('ეს თვე', 'This month') }, { value: 'prev', label: t('წინა თვე', 'Last month') }, { value: 'custom', label: t('პერიოდი', 'Period') }], mode, (v) => {
          mode = v;
          if (v === 'this') { from = monthStart; to = today; } else if (v === 'prev') { from = prevStart; to = prevEnd; }
          fromF.set(from); toF.set(to);
          paint();
        }),
        mode === 'custom' ? h('div', { class: 'bz-inline' }, fromF.el, h('span', { class: 'faint' }, '–'), toF.el) : h('span', { class: 'faint' }, `${dateText(r.from)} – ${dateText(r.to)} · ${t(`${r.days} დღე`, `${r.days} days`)}`));
      const T = r.totals;
      const kpis = h('div', { class: 'bz-kpis' },
        kpi(t('დარიცხული', 'Earned'), gel(T.earned), t(`${T.visits} ვიზიტი · ${gel(T.serviceValue)}`, `${T.visits} visits · ${gel(T.serviceValue)}`), true),
        kpi(t('გადახდილი', 'Paid'), gel(T.paid), ''),
        kpi(t('დარჩენილი', 'Balance'), gel(T.balance), T.balance > 0 ? t('გადასახდელია', 'to pay') : ''),
        kpi(t('პროდუქტები', 'Products'), gel(T.productRevenue), t('გაყიდვები პერიოდში', 'sales in the period')));
      if (!r.staff.length) { mount(host, h('div', { class: 'bz-stack' }, periodBar, kpis, card(emptyBox(t('გუნდი ცარიელია', 'No team yet'), t('დაამატე თანამშრომლები „გუნდი“ გვერდზე, მერე აქ წესები და გადახდები.', 'Add people on the Team page, then rules and payouts here.'))))); return; }
      const table = card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
        h('thead', null, h('tr', null, h('th', null, t('თანამშრომელი', 'Person')), h('th', null, t('წესი', 'Rule')), h('th', { class: 'num' }, t('ვიზიტები', 'Visits')), h('th', { class: 'num' }, t('პროდუქტები', 'Products')), h('th', { class: 'num' }, t('დარიცხული', 'Earned')), h('th', { class: 'num' }, t('დარჩა', 'Balance')), h('th'))),
        h('tbody', null, r.staff.map((s) => h('tr', { class: s.active ? '' : 'is-muted' },
          h('td', null, h('div', { class: 'bz-inline' }, avatar(s.name, s.color || '#64748B', 30), h('div', null, h('b', null, s.name), s.title ? h('div', { class: 'faint' }, s.title) : null))),
          h('td', null, h('div', { class: 'bz-inline', style: { flexWrap: 'nowrap' } }, ruleText(s.pay), button('', { size: 'sm', variant: 'ghost', icon: 'edit', ariaLabel: t('წესის შეცვლა', 'Change the rule'), title: t('წესის შეცვლა', 'Change the rule'), onClick: () => rulesDialog(s) }))),
          h('td', { class: 'num' }, h('b', null, String(s.visits)), h('div', { class: 'faint' }, gel(s.serviceValue))),
          h('td', { class: 'num' }, s.productRevenue ? gel(s.productRevenue) : h('span', { class: 'bz-dim' }, '—')),
          h('td', { class: 'num' }, h('b', null, gel(s.earned.total)), h('div', { class: 'faint' }, [s.earned.fromServices ? t(`სერვ. ${gel(s.earned.fromServices)}`, `svc ${gel(s.earned.fromServices)}`) : null, s.earned.fromProducts ? t(`პროდ. ${gel(s.earned.fromProducts)}`, `prod ${gel(s.earned.fromProducts)}`) : null, s.earned.fixed ? t(`ფიქს. ${gel(s.earned.fixed)}`, `fixed ${gel(s.earned.fixed)}`) : null].filter(Boolean).join(' · '))),
          h('td', { class: `num ${s.balance > 0 ? 'bz-ok' : ''}` }, h('b', null, gel(s.balance)), h('div', { class: 'faint' }, t(`გადახდილი ${gel(s.paid)}`, `paid ${gel(s.paid)}`))),
          h('td', { class: 'num' }, button(t('გადახდა', 'Pay'), { size: 'sm', icon: 'wallet', onClick: () => payDialog(s, r) })))),
          h('tr', { class: 'is-total' }, h('td', null, h('b', null, t('სულ', 'Total'))), h('td'), h('td', { class: 'num' }, h('b', null, String(T.visits)), h('div', { class: 'faint' }, gel(T.serviceValue))), h('td', { class: 'num' }, gel(T.productRevenue)), h('td', { class: 'num' }, h('b', null, gel(T.earned))), h('td', { class: 'num' }, h('b', null, gel(T.balance)), h('div', { class: 'faint' }, t(`გადახდილი ${gel(T.paid)}`, `paid ${gel(T.paid)}`))), h('td'))))));
      const payouts = card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('გადახდები ამ პერიოდში', 'Payouts in this period')), h('div', { class: 'card-sub' }, t('ყოველი გადახდა ხარჯებშიც ჩანს (ხელფასი).', 'Every payout also shows in expenses (salaries).')))),
        r.payouts.length ? h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
          h('thead', null, h('tr', null, h('th', null, t('როდის', 'When')), h('th', null, t('ვის', 'To')), h('th', null, t('პერიოდი', 'Period')), h('th', null, t('მეთოდი', 'Method')), h('th', { class: 'num' }, t('თანხა', 'Amount')), h('th'))),
          h('tbody', null, r.payouts.map((p) => h('tr', null,
            h('td', { class: 'faint' }, when(p.createdAt)),
            h('td', null, r.staff.find((s) => s.id === p.staffId)?.name || p.staffName || '—', p.note ? h('div', { class: 'faint' }, p.note) : null),
            h('td', null, `${dateText(p.periodFrom)} – ${dateText(p.periodTo)}`),
            h('td', null, methodLabel(p.method)),
            h('td', { class: 'num' }, h('b', null, gel(p.amount))),
            h('td', { class: 'num' }, button('', { size: 'sm', variant: 'ghost', icon: 'trash', ariaLabel: t('წაშლა', 'Delete'), onClick: async () => { if (await confirmDialog({ title: t('გადახდის წაშლა?', 'Delete the payout?'), body: t(`${gel(p.amount)} ხარჯებიდანაც წაიშლება.`, `${gel(p.amount)} leaves the expenses too.`), confirm: t('წაშლა', 'Delete'), danger: true })) { try { await biz.del(`/payouts/${p.id}`); paint(); } catch (e) { fail(e); } } } })))))))
          : h('p', { class: 'bz-sub' }, t('ამ პერიოდში გადახდა არ ყოფილა.', 'No payouts in this period.')));
      mount(host, h('div', { class: 'bz-stack' }, periodBar, kpis, table, payouts));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  function ruleText(pay) {
    const parts = [];
    if (pay.servicePercent) parts.push(t(`${pay.servicePercent}% სერვ.`, `${pay.servicePercent}% svc`));
    if (pay.productPercent) parts.push(t(`${pay.productPercent}% პროდ.`, `${pay.productPercent}% prod`));
    if (pay.fixedMonthly) parts.push(t(`${gel(pay.fixedMonthly)}/თვე`, `${gel(pay.fixedMonthly)}/mo`));
    return h('span', { class: parts.length ? '' : 'bz-dim', style: { maxWidth: '200px', lineHeight: '1.35' } }, parts.join(' + ') || t('წესი არ არის', 'No rule'));
  }

  function rulesDialog(s) {
    const svc = input({ type: 'number', min: 0, max: 100, step: '1', value: s.pay.servicePercent });
    const prod = input({ type: 'number', min: 0, max: 100, step: '1', value: s.pay.productPercent });
    const fixed = input({ type: 'number', min: 0, step: '10', value: s.pay.fixedMonthly });
    const save = button(t('შენახვა', 'Save'));
    const m = openModal({
      title: t(`ანაზღაურების წესი — ${s.name}`, `Pay rule — ${s.name}`),
      size: 'sm',
      body: h('div', { class: 'form' },
        h('p', { class: 'muted' }, t('სერვისების ღირებულება = ფულით + ბარათით + აბონემენტით გადახდილი (ბონუსი არ ითვლება). ფიქსირებული თანხა დღეების მიხედვით ნაწილდება.', 'Service value = paid in money + gift card + membership (bonus excluded). The fixed amount is pro-rated by days.')),
        field(t('% სერვისების ღირებულებიდან', '% of service value'), svc),
        field(t('% პროდუქტების გაყიდვიდან', '% of product sales'), prod),
        field(t('ფიქსირებული თვეში, ₾', 'Fixed a month, ₾'), fixed)),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try { await biz.patch(`/staff/${s.id}/pay`, { servicePercent: Number(svc.value), productPercent: Number(prod.value), fixedMonthly: Number(fixed.value) }); m.close(); ok(t('შენახულია', 'Saved')); paint(); } catch (e) { fail(e); }
    }));
  }

  function payDialog(s, r) {
    const amount = input({ type: 'number', min: 0, step: '0.01', value: Math.max(0, s.balance) });
    const method = select(METHODS.map(([value, label]) => ({ value, label })), 'TRANSFER');
    const note = input({ placeholder: t('შენიშვნა', 'Note') });
    const save = button(t('გადახდა', 'Pay'), { icon: 'check' });
    const m = openModal({
      title: t(`გადახდა — ${s.name}`, `Payout — ${s.name}`),
      size: 'sm',
      body: h('div', { class: 'form' }, h('p', { class: 'muted' }, t(`პერიოდი ${dateText(r.from)} – ${dateText(r.to)}: დარიცხული ${gel(s.earned.total)}, გადახდილი ${gel(s.paid)}.`, `Period ${dateText(r.from)} – ${dateText(r.to)}: earned ${gel(s.earned.total)}, paid ${gel(s.paid)}.`)), h('div', { class: 'form-row' }, field(t('თანხა, ₾', 'Amount, ₾'), amount), field(t('მეთოდი', 'Method'), method)), field(t('შენიშვნა', 'Note'), note)),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try { await biz.post('/payouts', { staffId: s.id, periodFrom: r.from, periodTo: r.to, amount: Number(amount.value), method: method.value, note: note.value.trim() || undefined }); m.close(); ok(t('გადახდილია', 'Paid')); paint(); } catch (e) { fail(e); }
    }));
  }

  mount(root,
    pageHead(t('ხელფასები', 'Payroll'), t('წესი თითოეულს — პროცენტი სერვისებიდან, პროცენტი პროდუქტებიდან, ფიქსირებული; პერიოდის დარიცხვა, გადახდები, ნაშთი.', 'A rule per person — a share of services, a share of products, a fixed amount; what the period earned, payouts, the balance.')),
    host);
  await paint();
}

function kpi(label, value, delta, accent = false) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}

export { icon, badge, pct };
