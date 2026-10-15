// MEDIBOOK business panel — the stock room (საწყობი): supplies a visit uses up (gloves, napkins, colour, anaesthetic),
// norms per service (what one visit uses — written off by itself when the visit is completed), deliveries,
// write-offs, counts, and the ledger that explains every number.
import { h, mount, icon, button, pageHead, card, input, field, busy, openModal, confirmDialog, debounce } from '/app/js/ui.js';
import { select } from '../fields.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, emptyBox, fail, ok, when } from '../shared.js';
import { chips, filterBar, pager, paginate, listState, groupBy } from '../lists.js';
import { canManage } from '../state.js';

const UNITS = [['pc', t('ცალი', 'pc')], ['pair', t('წყვილი', 'pair')], ['ml', t('მლ', 'ml')], ['g', t('გ', 'g')], ['set', t('ნაკრები', 'set')], ['pack', t('შეკვრა', 'pack')]];
const unitOf = (u) => UNITS.find(([k]) => k === u)?.[1] || u || '';
const num = (q) => { const n = Number(q) || 0; return n % 1 ? String(Math.round(n * 100) / 100) : String(n); };
const qtyText = (q, u) => `${num(q)} ${unitOf(u)}`;
const REASON = {
  USE: [t('ვიზიტი', 'Visit'), 'is-use', 'scissors'],
  RESTOCK: [t('მიღება', 'Delivery'), 'is-in', 'download'],
  WRITE_OFF: [t('ჩამოწერა', 'Write-off'), 'is-out', 'minus'],
  COUNT: [t('დათვლა', 'Count'), 'is-count', 'ruler'],
  ADJUST: [t('კორექცია', 'Correction'), 'is-count', 'edit'],
};

export default async function suppliesPage(root) {
  const host = h('div');
  let tab = 'stock';
  let cache = [];
  const st = listState('supplies', { q: '', page: 1, size: 25, product: '' });
  const manage = canManage();

  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const o = await biz.get('/supplies/overview');
      const tabs = chips([['stock', t('მარაგი', 'Stock'), o.supplies || undefined], ['norms', t('ნორმები', 'Norms')], ['moves', t('მოძრაობა', 'Ledger')]], tab, (v) => { tab = v; st.set({ page: 1 }); paint(); });
      const kpis = h('div', { class: 'bz-kpis' },
        kpi(t('მასალა', 'Supplies'), String(o.supplies), o.low ? t(`${o.low} იწურება`, `${o.low} running low`) : o.supplies ? t('ყველაფერი ადგილზეა', 'All stocked') : '', true),
        kpi(t('მარაგი თვითღირებულებით', 'Stock at cost'), gel(o.stockValue), ''),
        kpi(t('30 დღეში დაიხარჯა', 'Used in 30 days'), gel(o.use30Cost), o.use30Visits ? t(`${o.use30Visits} ვიზიტიდან`, `across ${o.use30Visits} visits`) : t('ვიზიტები თავისით ჩამოწერენ', 'visits write off by themselves')),
        kpi(t('შესაკვეთია', 'To order'), String(o.toOrder.length), o.toOrder.length ? t('სია ქვემოთ', 'the list is below') : t('არაფერი', 'nothing')));
      const actions = h('div', { class: 'bz-inline' },
        manage ? button(t('მიღება', 'Delivery'), { icon: 'download', variant: 'secondary', onClick: () => restockDialog(null) }) : null,
        manage ? button(t('ახალი მასალა', 'New supply'), { icon: 'plus', onClick: () => supplyDialog(null) }) : null);
      const body = tab === 'stock' ? await stockView(o) : tab === 'norms' ? await normsView() : await movesView();
      mount(host, h('div', { class: 'bz-stack' }, kpis, h('div', { class: 'bz-toolbar' }, tabs, actions), body));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  // ── stock ──
  async function stockView(o) {
    const { supplies } = await biz.get('/supplies', { all: 1 });
    cache = supplies;
    if (!supplies.length) {
      return card(emptyBox(t('მასალა ჯერ არ არის', 'No supplies yet'),
        t('ხელთათმანი, სალფეთქი, საღებავი, ანესთეზია — დაამატე რაოდენობით და „მცირე“ ზღვარით. ვიზიტის დასრულებისას ნორმით თავისით ჩამოიწერება.', 'Gloves, napkins, colour, anaesthetic — add them with a stock and a low mark. Completing a visit writes the norms off by itself.'),
        manage ? button(t('პირველი მასალა', 'First supply'), { icon: 'plus', onClick: () => supplyDialog(null) }) : null, 'flask'));
    }
    const term = st.state.q.trim().toLowerCase();
    const rows = supplies.filter((s) => !term || `${s.name} ${s.sku || ''} ${s.category || ''}`.toLowerCase().includes(term));
    const search = input({ class: 'input', placeholder: t('ძებნა — სახელი, კოდი, კატეგორია…', 'Search — name, code, category…'), value: st.state.q, onInput: debounce((e) => { st.set({ q: e.target.value, page: 1 }); paint(); }, 250) });
    const pg = paginate(rows, st.state.page, st.state.size);
    const head = h('thead', null, h('tr', null,
      h('th', null, t('მასალა', 'Supply')), h('th', null, t('მარაგი', 'Stock')), h('th', { class: 'num' }, t('30 დღეში', 'In 30 days')),
      h('th', { class: 'num' }, t('ერთ. ფასი', 'Unit cost')), h('th', null, t('სად იხმარება', 'Used by')), h('th')));
    const body = h('tbody', null, pg.rows.map((s) => h('tr', { class: `${s.active ? '' : 'is-muted'}${s.low ? ' is-low' : ''}` },
      h('td', null, h('b', null, s.name), h('div', { class: 'faint' }, [s.category, s.sku].filter(Boolean).join(' · ') || unitOf(s.unit))),
      h('td', null, stockCell(s)),
      h('td', { class: 'num' }, s.use30 ? [h('b', null, qtyText(s.use30, s.unit)), h('div', { class: 'faint' }, gel(s.use30Cost))] : h('span', { class: 'bz-dim' }, '—')),
      h('td', { class: 'num' }, s.cost == null ? h('span', { class: 'bz-dim' }, '—') : gel(s.cost)),
      h('td', null, s.usedBy
        ? h('button', { type: 'button', class: 'bz-link', onClick: () => { tab = 'norms'; paint(); } }, t(`${s.usedBy} სერვისი`, `${s.usedBy} ${s.usedBy === 1 ? 'service' : 'services'}`))
        : h('span', { class: 'bz-dim' }, t('ნორმა არ აქვს', 'No norm'))),
      h('td', { class: 'num' }, rowActions(s)))));
    const table = card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' }, head, body)),
      pager({ ...pg, size: st.state.size, onPage: (pp) => { st.set({ page: pp }); paint(); }, onSize: (n) => { st.set({ size: n, page: 1 }); paint(); } }));
    return h('div', { class: 'bz-stack is-tight' }, o.toOrder.length ? orderCard(o) : null, search, table);
  }

  function rowActions(s) {
    return h('div', { class: 'bz-row-actions' },
      manage ? button(t('მიღება', 'Delivery'), { size: 'sm', variant: 'ghost', icon: 'download', onClick: () => restockDialog(s) }) : null,
      button('', { size: 'sm', variant: 'ghost', icon: 'minus', ariaLabel: t('ჩამოწერა', 'Write off'), title: t('ჩამოწერა', 'Write off'), onClick: () => writeOffDialog(s) }),
      manage ? button('', { size: 'sm', variant: 'ghost', icon: 'ruler', ariaLabel: t('დათვლა', 'Count'), title: t('დათვლა', 'Count'), onClick: () => countDialog(s) }) : null,
      manage ? button('', { size: 'sm', variant: 'ghost', icon: 'edit', ariaLabel: t('რედაქტირება', 'Edit'), onClick: () => supplyDialog(s) }) : null,
      manage && s.active ? button('', { size: 'sm', variant: 'ghost', icon: 'trash', ariaLabel: t('ამოღება', 'Retire'), onClick: async () => {
        if (await confirmDialog({ title: t('მასალის ამოღება?', 'Retire the supply?'), body: t(`${s.name} — ნორმებიდან ამოვარდება, ისტორია რჩება.`, `${s.name} leaves the norms; the history stays.`), confirm: t('ამოღება', 'Retire') })) { try { await biz.del(`/supplies/${s.id}`); paint(); } catch (e) { fail(e); } }
      } }) : null);
  }

  /** Stock as a short bar (full = four low marks or the stock itself), the days it lasts, amber when low, red below zero. */
  function stockCell(s) {
    const neg = s.stock != null && s.stock < 0;
    const cap = Math.max(1, s.stock ?? 0, (s.lowStock || 0) * 4);
    return h('div', { class: `bz-stock${s.low ? ' is-low' : ''}${neg ? ' is-neg' : ''}` },
      h('div', { class: 'top' },
        h('b', { class: neg ? 'bz-bad' : '' }, qtyText(s.stock ?? 0, s.unit)),
        neg ? h('span', { class: 'bz-tag bz-tag-warn' }, t('დასათვლელია', 'Count it')) : s.low ? h('span', { class: 'bz-tag bz-tag-warn' }, t('მცირე', 'Low')) : s.lowStock ? h('small', null, t(`ზღვარი ${num(s.lowStock)}`, `min ${num(s.lowStock)}`)) : null,
        s.daysLeft != null ? h('small', { class: 'days' }, t(`~${s.daysLeft} დღე`, `~${s.daysLeft} days`)) : null),
      h('i', null, h('b', { style: { width: `${Math.round((Math.max(0, s.stock ?? 0) / cap) * 100)}%` } })));
  }

  /** What to order, with the quantity the recent pace suggests; one click receives it. */
  function orderCard(o) {
    const text = () => o.toOrder.map((x) => `${x.name} — ${num(x.toOrder)} ${unitOf(x.unit)}`).join('\n');
    return card({ class: 'bz-order' },
      h('div', { class: 'card-head' },
        h('div', null, h('div', { class: 'card-title' }, t('შესაკვეთია', 'To order')), h('div', { class: 'card-sub' }, t('ორი კვირის მარაგი ბოლო 30 დღის ტემპით, მინიმუმ სამი „მცირე“ ზღვარი.', 'Two weeks at the last 30 days\' pace, at least three low marks.'))),
        button(t('სიის კოპირება', 'Copy the list'), { size: 'sm', variant: 'ghost', icon: 'copy', onClick: async () => { try { await navigator.clipboard.writeText(text()); ok(t('დაკოპირდა', 'Copied')); } catch { /* no clipboard */ } } })),
      h('div', { class: 'bz-order-rows' }, o.toOrder.map((x) => h('div', { class: 'bz-order-row' },
        h('span', { class: 'ic' }, icon('alert', { size: 15 })),
        h('div', { class: 'who' }, h('b', null, x.name), h('span', null, `${t('მარაგში', 'In stock')} ${qtyText(x.stock ?? 0, x.unit)}${x.daysLeft != null ? ` · ${t(`~${x.daysLeft} დღე`, `~${x.daysLeft} days`)}` : ''}`)),
        h('div', { class: 'qty' }, h('b', null, `+${qtyText(x.toOrder, x.unit)}`), x.cost != null ? h('span', null, `≈ ${gel(x.toOrder * x.cost)}`) : null),
        manage ? button(t('მიღება', 'Delivery'), { size: 'sm', variant: 'secondary', icon: 'download', onClick: () => restockDialog(cache.find((s) => s.id === x.id) || x, x.toOrder) }) : null))));
  }

  // ── norms ──
  async function normsView() {
    const [{ services }, { supplies }] = await Promise.all([biz.get('/supplies/norms'), biz.get('/supplies')]);
    cache = supplies;
    if (!services.length) return card(emptyBox(t('სერვისი ჯერ არ არის', 'No services yet'), t('ჯერ სერვისები დაამატე — მერე თითოეულს ნორმას მიუწერ.', 'Add services first — then give each one its norm.'), null, 'grid'));
    if (!supplies.length) return card(emptyBox(t('მასალა ჯერ არ არის', 'No supplies yet'), t('ნორმა სერვისს მასალებს უკავშირებს — ჯერ „მარაგი“ ჩანართში დაამატე.', 'A norm links a service to its supplies — add them under Stock first.'), manage ? button(t('ახალი მასალა', 'New supply'), { icon: 'plus', onClick: () => supplyDialog(null) }) : null, 'flask'));
    const withNorm = services.filter((s) => s.items.length).length;
    const groups = groupBy(services, (s) => s.group || '');
    return h('div', { class: 'bz-stack' },
      h('div', { class: 'bz-banner is-info', style: { margin: 0 } }, icon('info', { size: 20 }), h('p', null, h('b', null, t(`${withNorm} სერვისს ნორმა აქვს · ${services.length - withNorm} გარეშე`, `${withNorm} ${withNorm === 1 ? 'service has' : 'services have'} a norm · ${services.length - withNorm} without`)),
        t('ნორმა = რა იხარჯება ერთ ვიზიტზე. ვიზიტის დასრულებისას მარაგიდან თავისით ჩამოიწერება და ვიზიტის თვითღირებულებაც ჩანს.', 'A norm is what one visit uses. Completing the visit writes it off by itself, and the visit\'s material cost shows.'))),
      ...groups.map(([name, list]) => card({ class: 'bz-service-card' },
        h('div', { class: 'bz-service-head' }, h('div', null, h('div', { class: 'card-title' }, name || t('სერვისები', 'Services')), h('div', { class: 'card-sub' }, t(`${list.length} სერვისი`, `${list.length} ${list.length === 1 ? 'service' : 'services'}`)))),
        h('div', { class: 'bz-norm-rows' }, list.map(normRow)))));
  }

  function normRow(s) {
    return h('button', { type: 'button', class: `bz-norm-row${s.items.length ? '' : ' is-empty'}`, disabled: !manage, onClick: () => normsDialog(s) },
      h('div', { class: 'bz-norm-main' }, h('b', null, s.name), h('span', { class: 'faint' }, `${s.price != null ? `${gel(s.price)} · ` : ''}${s.durationMin} ${t('წთ', 'min')}`)),
      h('div', { class: 'bz-norm-items' }, s.items.length
        ? s.items.map((i) => h('span', { class: `bz-tag${i.active ? '' : ' is-off'}` }, `${i.name} · ${qtyText(i.qty, i.unit)}`))
        : h('span', { class: 'bz-dim' }, manage ? t('ნორმა არ არის — დააჭირე და მიუწერე', 'No norm yet — click to add one') : t('ნორმა არ არის', 'No norm yet'))),
      h('div', { class: 'bz-norm-cost' }, s.items.length ? [h('b', null, gel(s.costPerVisit)), h('small', null, s.costShare != null ? t(`${s.costShare}% ფასიდან`, `${s.costShare}% of the price`) : t('ვიზიტზე', 'per visit'))] : null),
      manage ? icon('chevronRight', { size: 16, class: 'chev' }) : null);
  }

  function normsDialog(s) {
    const lines = s.items.map((i) => ({ productId: i.productId, qty: i.qty }));
    const options = cache.filter((x) => x.active || lines.some((l) => l.productId === x.id)).map((x) => ({ value: x.id, label: `${x.name} (${unitOf(x.unit)})` }));
    const host = h('div', { class: 'bz-sale-lines' });
    const total = h('div', { class: 'bz-pay-summary' });
    function paintTotal() {
      const cost = lines.reduce((sum, l) => { const p = cache.find((x) => x.id === l.productId); return sum + (p && p.cost != null ? p.cost * (l.qty || 0) : 0); }, 0);
      mount(total, h('div', { class: 'total' }, h('span', null, t('მასალა ერთ ვიზიტზე', 'Materials per visit')), h('b', null, gel(cost))),
        s.price ? h('div', null, h('span', null, t('სერვისის ფასიდან', 'Of the service price')), h('span', null, `${Math.round((cost / s.price) * 1000) / 10}%`)) : null);
    }
    function paintLines() {
      mount(host, lines.map((l, i) => {
        const sel = select(options, l.productId, { onChange: (e) => { l.productId = e.target.value; paintTotal(); } });
        const qty = input({ type: 'number', min: 0, step: '0.01', value: l.qty, style: { width: '96px' }, onInput: (e) => { l.qty = Number(e.target.value) || 0; paintTotal(); } });
        return h('div', { class: 'bz-sale-line' }, sel, qty, button('', { variant: 'ghost', size: 'sm', icon: 'x', ariaLabel: t('ამოღება', 'Remove'), onClick: () => { lines.splice(i, 1); paintLines(); } }));
      }), h('button', { type: 'button', class: 'bz-add-line', onClick: () => { lines.push({ productId: options[0]?.value, qty: 1 }); paintLines(); } }, icon('plus', { size: 14 }), ' ', t('კიდევ მასალა', 'Another supply')));
      paintTotal();
    }
    if (!lines.length && options[0]) lines.push({ productId: options[0].value, qty: 1 });
    paintLines();
    const save = button(t('შენახვა', 'Save'));
    const m = openModal({
      title: t(`ნორმა — ${s.name}`, `Norm — ${s.name}`),
      body: h('div', { class: 'form' },
        h('p', { class: 'muted' }, t('რა იხარჯება ამ სერვისის ერთ ვიზიტზე. დასრულებისას მარაგიდან თავისით ჩამოიწერება; ცარიელი სია ნორმას შლის.', 'What one visit of this service uses. Written off by itself when the visit is completed; an empty list removes the norm.')),
        field(t('მასალები', 'Supplies'), host), total),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try { await biz.put(`/supplies/norms/${s.id}`, { items: lines.filter((l) => l.productId && l.qty > 0) }); m.close(); ok(t('შენახულია', 'Saved')); paint(); } catch (e) { fail(e); }
    }));
  }

  // ── ledger ──
  async function movesView() {
    const [{ moves }, { supplies }] = await Promise.all([biz.get('/supplies/moves', st.state.product ? { productId: st.state.product } : {}), biz.get('/supplies', { all: 1 })]);
    cache = supplies;
    const filter = select([{ value: '', label: t('ყველა მასალა', 'Every supply') }, ...supplies.map((s) => ({ value: s.id, label: s.name }))], st.state.product, { onChange: (e) => { st.set({ product: e.target.value, page: 1 }); paint(); }, style: { maxWidth: '260px' } });
    if (!moves.length) return h('div', { class: 'bz-stack is-tight' }, filterBar(filter), card(emptyBox(t('მოძრაობა ჯერ არ არის', 'No movement yet'), t('მიღება, ვიზიტის ჩამოწერა, დათვლა — ყველაფერი აქ ჩაიწერება.', 'Deliveries, visit write-offs, counts — everything is recorded here.'), null, 'history')));
    const pg = paginate(moves, st.state.page, st.state.size);
    const head = h('thead', null, h('tr', null, h('th', null, t('როდის', 'When')), h('th', null, t('მასალა', 'Supply')), h('th', null, t('რა', 'What')), h('th', { class: 'num' }, t('რაოდ.', 'Qty')), h('th', { class: 'num' }, t('ღირებ.', 'Value')), h('th', null, t('ვინ', 'Who'))));
    const body = h('tbody', null, pg.rows.map((m) => {
      const [label, cls, ic] = REASON[m.reason] || [m.reason, '', 'history'];
      const detail = m.reason === 'USE' ? [m.serviceName, m.clientName].filter(Boolean).join(' · ') : m.note || '';
      return h('tr', null,
        h('td', { class: 'faint' }, when(m.at)),
        h('td', null, h('b', null, m.productName)),
        h('td', null, h('div', { class: 'bz-ledger' }, h('span', { class: `ic ${cls}` }, icon(ic, { size: 15 })), h('div', null, label, detail ? h('div', { class: 'faint' }, detail) : null))),
        h('td', { class: `num ${m.delta < 0 ? 'bz-bad' : 'bz-ok'}` }, h('b', null, `${m.delta > 0 ? '+' : '−'}${qtyText(Math.abs(m.delta), m.unit)}`)),
        h('td', { class: 'num' }, m.value == null ? h('span', { class: 'bz-dim' }, '—') : gel(m.value)),
        h('td', { class: 'faint' }, m.staffName || m.byName || '—'));
    }));
    const table = card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' }, head, body)),
      pager({ ...pg, size: st.state.size, onPage: (pp) => { st.set({ page: pp }); paint(); }, onSize: (n) => { st.set({ size: n, page: 1 }); paint(); } }));
    return h('div', { class: 'bz-stack is-tight' }, filterBar(filter), table);
  }

  // ── dialogs ──
  function supplyDialog(s) {
    const name = input({ value: s?.name || '', placeholder: t('მაგ. ნიტრილის ხელთათმანი M', 'e.g. Nitrile gloves M') });
    const sku = input({ value: s?.sku || '', placeholder: t('კოდი / შტრიხკოდი', 'Code / barcode') });
    const category = input({ value: s?.category || '', placeholder: t('მაგ. ერთჯერადი, საღებავი', 'e.g. Disposables, Colour') });
    const unit = select(UNITS.map(([v, l]) => ({ value: v, label: l })), s?.unit || 'pc');
    const cost = input({ type: 'number', min: 0, step: '0.01', value: s?.cost ?? '', placeholder: t('ერთეულის ფასი', 'per unit') });
    const stock = input({ type: 'number', step: '0.01', value: s ? s.stock ?? 0 : '', placeholder: t('ახლა რამდენია', 'how many now') });
    const lowStock = input({ type: 'number', min: 0, step: '1', value: s?.lowStock ?? 5 });
    const save = button(t('შენახვა', 'Save'));
    const m = openModal({
      title: s ? t('მასალის რედაქტირება', 'Edit supply') : t('ახალი მასალა', 'New supply'),
      body: h('div', { class: 'form' },
        field(t('სახელი', 'Name'), name),
        h('div', { class: 'form-row' }, field(t('კატეგორია', 'Category'), category), field(t('კოდი', 'Code'), sku)),
        h('div', { class: 'form-row' }, field(t('ერთეული', 'Unit'), unit), field(t('თვითღირებულება ერთეულზე, ₾', 'Cost per unit, ₾'), cost)),
        h('div', { class: 'form-row' }, s ? null : field(t('მარაგი ახლა', 'Stock now'), stock), field(t('„მცირე“ ზღვარი', 'Low-stock mark'), lowStock)),
        s ? h('p', { class: 'bz-note' }, t('მარაგს „მიღებით“, „ჩამოწერით“ ან „დათვლით“ შეცვლი — ისე ყველა ცვლილება მოძრაობაში რჩება.', 'Change the stock with a delivery, a write-off or a count, so every change stays in the ledger.')) : null),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try {
        const body = { name: name.value.trim(), sku: sku.value.trim() || null, category: category.value.trim() || null, unit: unit.value, cost: cost.value === '' ? null : Number(cost.value), lowStock: Number(lowStock.value) || 0 };
        if (s) await biz.patch(`/supplies/${s.id}`, body); else await biz.post('/supplies', { ...body, stock: stock.value === '' ? 0 : Number(stock.value) });
        m.close();
        ok(t('შენახულია', 'Saved'));
        paint();
      } catch (e) { fail(e); }
    }));
  }

  /** A delivery: which supply (when opened from the toolbar), how many, the unit cost, and whether the money goes into expenses. */
  function restockDialog(s, suggested) {
    let target = s;
    const picker = s ? null : select(cache.filter((x) => x.active).map((x) => ({ value: x.id, label: `${x.name} · ${qtyText(x.stock ?? 0, x.unit)}` })), cache.find((x) => x.active)?.id || '', { onChange: (e) => { target = cache.find((x) => x.id === e.target.value) || null; syncCost(); } });
    if (!s) target = cache.find((x) => x.active) || null;
    if (!target) { fail(new Error(t('ჯერ მასალა დაამატე.', 'Add a supply first.'))); return; }
    const qty = input({ type: 'number', min: 0, step: '0.01', value: suggested || 10 });
    const cost = input({ type: 'number', min: 0, step: '0.01', value: target.cost ?? '', placeholder: t('ერთეულის ფასი', 'per unit') });
    const note = input({ placeholder: t('მომწოდებელი, ზედნადები…', 'Supplier, invoice…') });
    const expense = h('input', { type: 'checkbox', checked: true });
    const sum = h('div', { class: 'bz-pay-summary' });
    const syncCost = () => { cost.value = target?.cost ?? ''; paintSum(); };
    const paintSum = () => {
      const total = (Number(qty.value) || 0) * (Number(cost.value) || 0);
      mount(sum, h('div', { class: 'total' }, h('span', null, t('სულ', 'Total')), h('b', null, gel(total))));
    };
    qty.addEventListener('input', paintSum); cost.addEventListener('input', paintSum);
    paintSum();
    const save = button(t('მიღება', 'Receive'), { icon: 'check' });
    const m = openModal({
      title: s ? t(`მიღება — ${s.name}`, `Delivery — ${s.name}`) : t('მასალის მიღება', 'Receive supplies'),
      size: 'sm',
      body: h('div', { class: 'form' },
        picker ? field(t('მასალა', 'Supply'), picker) : null,
        h('div', { class: 'form-row' }, field(t('რაოდენობა', 'Quantity'), qty), field(t('ფასი ერთეულზე, ₾', 'Cost per unit, ₾'), cost)),
        field(t('შენიშვნა', 'Note'), note), sum,
        h('label', { class: 'bz-inline', style: { fontSize: '14px' } }, expense, t('ხარჯებში ჩაწერა (მასალები)', 'Record as an expense (supplies)'))),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try {
        await biz.post(`/supplies/${target.id}/restock`, { qty: Number(qty.value), cost: cost.value === '' ? undefined : Number(cost.value), note: note.value.trim() || undefined, expense: expense.checked && cost.value !== '' });
        m.close(); ok(t('მიღებულია', 'Received')); paint();
      } catch (e) { fail(e); }
    }));
  }

  function writeOffDialog(s) {
    const qty = input({ type: 'number', min: 0, step: '0.01', value: 1 });
    const note = input({ placeholder: t('რატომ', 'Why') });
    const presets = h('div', { class: 'bz-chips' }, [t('დაიღვარა', 'Spilled'), t('ვადა გაუვიდა', 'Expired'), t('დაზიანდა', 'Damaged'), t('ვიზიტის გარეშე გამოიყენეს', 'Used outside a visit')].map((x) => h('button', { type: 'button', class: 'bz-chip', onClick: () => { note.value = x; } }, x)));
    const save = button(t('ჩამოწერა', 'Write off'), { icon: 'check' });
    const m = openModal({
      title: t(`ჩამოწერა — ${s.name}`, `Write off — ${s.name}`),
      size: 'sm',
      body: h('div', { class: 'form' }, h('p', { class: 'muted' }, t(`მარაგშია ${qtyText(s.stock ?? 0, s.unit)}.`, `${qtyText(s.stock ?? 0, s.unit)} in stock.`)),
        field(t(`რაოდენობა, ${unitOf(s.unit)}`, `Quantity, ${unitOf(s.unit)}`), qty), field(t('მიზეზი', 'Reason'), note), presets),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try { await biz.post(`/supplies/${s.id}/write-off`, { qty: Number(qty.value), note: note.value.trim() || undefined }); m.close(); ok(t('ჩამოიწერა', 'Written off')); paint(); } catch (e) { fail(e); }
    }));
  }

  function countDialog(s) {
    const counted = input({ type: 'number', min: 0, step: '0.01', value: s.stock ?? 0 });
    const diff = h('p', { class: 'bz-note' });
    const paintDiff = () => { const d = Math.round(((Number(counted.value) || 0) - (s.stock ?? 0)) * 100) / 100; diff.textContent = d ? t(`სხვაობა ${d > 0 ? '+' : ''}${num(d)} ${unitOf(s.unit)} — მოძრაობაში „დათვლად“ ჩაიწერება.`, `Difference ${d > 0 ? '+' : ''}${num(d)} ${unitOf(s.unit)} — recorded as a count.`) : t('ემთხვევა — ჩანაწერი არ დაემატება.', 'Matches — nothing to record.'); };
    counted.addEventListener('input', paintDiff); paintDiff();
    const note = input({ placeholder: t('შენიშვნა', 'Note') });
    const save = button(t('დათვლა', 'Count'), { icon: 'check' });
    const m = openModal({
      title: t(`დათვლა — ${s.name}`, `Count — ${s.name}`),
      size: 'sm',
      body: h('div', { class: 'form' }, h('p', { class: 'muted' }, t(`სისტემაში ${qtyText(s.stock ?? 0, s.unit)}. ჩაწერე, რამდენია თაროზე.`, `The system says ${qtyText(s.stock ?? 0, s.unit)}. Enter what is on the shelf.`)),
        field(t(`დათვლილი, ${unitOf(s.unit)}`, `Counted, ${unitOf(s.unit)}`), counted), diff, field(t('შენიშვნა', 'Note'), note)),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try { await biz.post(`/supplies/${s.id}/count`, { counted: Number(counted.value), note: note.value.trim() || undefined }); m.close(); ok(t('დათვლილია', 'Counted')); paint(); } catch (e) { fail(e); }
    }));
  }

  mount(root,
    pageHead(t('საწყობი', 'Stock room'), t('რასაც ვიზიტები ხარჯავს — ხელთათმანი, სალფეთქი, საღებავი, ანესთეზია. ნორმა სერვისზე, ავტომატური ჩამოწერა, მიღება, დათვლა.', 'What visits use up — gloves, napkins, colour, anaesthetic. A norm per service, automatic write-off, deliveries, counts.')),
    host);
  await paint();
}

function kpi(label, value, delta, accent = false) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}
