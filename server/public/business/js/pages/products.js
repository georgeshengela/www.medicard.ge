// MEDIBOOK business panel — products and sales: the shelf (price, cost, stock), restocking, every sale, refunds.
import { h, mount, icon, button, pageHead, card, input, field, select, busy, openModal, confirmDialog, badge, debounce } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, emptyBox, fail, ok, when, dateText, methodLabel, phoneText } from '../shared.js';
import { chips, filterBar, pager, paginate, listState } from '../lists.js';
import { saleDialog } from '../sale.js';
import { canManage } from '../state.js';

export default async function productsPage(root) {
  const host = h('div');
  let tab = 'products';
  const st = listState('products', { q: '', page: 1, size: 25 });

  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const o = await biz.get('/products/overview');
      const tabs = chips([['products', t('პროდუქტები', 'Products'), o.products || undefined], ['sales', t('გაყიდვები', 'Sales'), o.sales30 || undefined]], tab, (v) => { tab = v; st.set({ page: 1 }); paint(); });
      const kpis = h('div', { class: 'bz-kpis' },
        kpi(t('გაყიდვები 30 დღეში', 'Sales in 30 days'), String(o.sales30), t(`${gel(o.revenue30)} შემოსავალი`, `${gel(o.revenue30)} revenue`), true),
        kpi(t('მარჟა 30 დღეში', 'Margin in 30 days'), gel(o.margin30), o.revenue30 ? t(`თვითღირებულება ${gel(o.cost30)}`, `cost ${gel(o.cost30)}`) : ''),
        kpi(t('მარაგი თვითღირებულებით', 'Stock at cost'), gel(o.stockValue), t(`${o.products} პროდუქტი`, `${o.products} products`)),
        kpi(t('მცირე მარაგი', 'Low stock'), String(o.low), o.low ? t('შეავსე', 'Restock soon') : t('ყველაფერი რიგზეა', 'All fine')));
      const body = tab === 'products' ? await productsView() : await salesView();
      const toolbar = h('div', { class: 'bz-toolbar' }, tabs, h('div', { class: 'bz-inline' }, button(t('გაყიდვა', 'Sell'), { icon: 'plus', onClick: () => saleDialog({}, { onCreated: () => { tab = 'sales'; paint(); } }) }), canManage() ? button(t('ახალი პროდუქტი', 'New product'), { variant: 'secondary', icon: 'plus', onClick: () => productDialog(null) }) : null));
      mount(host, h('div', { class: 'bz-stack' }, kpis, toolbar, body));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  async function productsView() {
    const { products } = await biz.get('/products', { all: 1 });
    const term = st.state.q.trim().toLowerCase();
    const rows = products.filter((p) => !term || `${p.name} ${p.sku || ''} ${p.category || ''}`.toLowerCase().includes(term));
    const search = input({ class: 'input', placeholder: t('ძებნა — სახელი, კოდი, კატეგორია…', 'Search — name, code, category…'), value: st.state.q, onInput: debounce((e) => { st.set({ q: e.target.value, page: 1 }); paint(); }, 250) });
    if (!products.length) return card(emptyBox(t('პროდუქტი ჯერ არ არის', 'No products yet'), t('შამპუნი, კრემი, ნიღაბი — დაამატე ფასით და მარაგით; გაყიდვა შემოსავალში და კლიენტის ბარათზე ჩაიწერება.', 'Shampoo, a cream, a mask — add them with a price and stock; a sale lands in income and on the client card.'), canManage() ? button(t('პროდუქტის დამატება', 'Add a product'), { icon: 'plus', onClick: () => productDialog(null) }) : null));
    const pg = paginate(rows, st.state.page, st.state.size);
    return h('div', { class: 'bz-stack is-tight' }, search,
      card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
        h('thead', null, h('tr', null, h('th', null, t('პროდუქტი', 'Product')), h('th', null, t('კატეგორია', 'Category')), h('th', { class: 'num' }, t('ფასი', 'Price')), h('th', { class: 'num' }, t('თვითღ.', 'Cost')), h('th', { class: 'num' }, t('მარაგი', 'Stock')), h('th', { class: 'num' }, t('გაიყიდა 30დ', 'Sold 30d')), h('th'))),
        h('tbody', null, pg.rows.map((p) => h('tr', { class: p.active ? '' : 'is-muted' },
          h('td', null, h('b', null, p.name), p.sku ? h('div', { class: 'faint' }, p.sku) : null),
          h('td', null, p.category || h('span', { class: 'bz-dim' }, '—')),
          h('td', { class: 'num' }, gel(p.price)),
          h('td', { class: 'num' }, p.cost == null ? '—' : gel(p.cost)),
          h('td', { class: 'num' }, p.stock == null ? h('span', { class: 'bz-dim', title: t('მარაგი არ ითვლება', 'Stock not tracked') }, '—') : h('span', { class: p.low ? 'bz-bad' : '' }, `${p.stock} ${p.unit}`), p.low ? badge(t('მცირე', 'Low'), 'warn') : null),
          h('td', { class: 'num' }, String(p.sold30 ?? 0)),
          h('td', { class: 'num' }, h('div', { class: 'bz-row-actions' },
            canManage() ? button(t('მიღება', 'Stock in'), { size: 'sm', variant: 'ghost', icon: 'download', onClick: () => restockDialog(p) }) : null,
            canManage() ? button('', { size: 'sm', variant: 'ghost', icon: 'edit', ariaLabel: t('რედაქტირება', 'Edit'), onClick: () => productDialog(p) }) : null,
            canManage() && p.active ? button('', { size: 'sm', variant: 'ghost', icon: 'trash', ariaLabel: t('ამოღება', 'Retire'), onClick: async () => { if (await confirmDialog({ title: t('პროდუქტის ამოღება?', 'Retire the product?'), body: p.name, confirm: t('ამოღება', 'Retire') })) { try { await biz.del(`/products/${p.id}`); paint(); } catch (e) { fail(e); } } } }) : null))))))),
        pager({ ...pg, size: st.state.size, onPage: (pp) => { st.set({ page: pp }); paint(); }, onSize: (n) => { st.set({ size: n, page: 1 }); paint(); } })));
  }

  async function salesView() {
    const { sales } = await biz.get('/sales', { limit: 500 });
    if (!sales.length) return card(emptyBox(t('გაყიდვა ჯერ არ არის', 'No sales yet'), t('„გაყიდვა“ ღილაკით — პროდუქტი, რაოდენობა, კლიენტი, ვინ გაყიდა.', 'With the Sell button — product, quantity, client, who sold.')));
    const pg = paginate(sales, st.state.page, st.state.size);
    return h('div', { class: 'bz-stack is-tight' }, card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
      h('thead', null, h('tr', null, h('th', null, t('როდის', 'When')), h('th', null, t('რა', 'What')), h('th', null, t('კლიენტი', 'Client')), h('th', null, t('ვინ გაყიდა', 'Sold by')), h('th', null, t('გადახდა', 'Payment')), h('th', { class: 'num' }, t('სულ', 'Total')), h('th'))),
      h('tbody', null, pg.rows.map((s) => h('tr', { class: s.status === 'REFUNDED' ? 'is-muted' : '' },
        h('td', null, h('b', null, dateText(s.at)), h('div', { class: 'faint' }, when(s.at).split(' · ')[1] || '')),
        h('td', null, s.items.map((i) => h('div', null, `${i.name}${i.qty !== 1 ? ` ×${i.qty}` : ''}`)), s.note ? h('div', { class: 'faint' }, s.note) : null),
        h('td', null, s.clientId ? h('a', { class: 'bz-link', href: `/business/clients/${s.clientId}`, 'data-link': '' }, s.clientName || '—') : s.clientName || h('span', { class: 'bz-dim' }, '—')),
        h('td', null, s.staffName || h('span', { class: 'bz-dim' }, '—')),
        h('td', null, methodLabel(s.paidMethod)),
        h('td', { class: 'num' }, h('b', null, gel(s.total)), s.status === 'REFUNDED' ? badge(t('დაბრუნდა', 'Refunded'), 'neutral') : null),
        h('td', { class: 'num' }, s.status === 'DONE' && canManage() ? button(t('დაბრუნება', 'Refund'), { size: 'sm', variant: 'ghost', onClick: async () => { if (await confirmDialog({ title: t('გაყიდვის დაბრუნება?', 'Refund the sale?'), body: t(`${gel(s.total)} შემოსავლიდან მოიხსნება, მარაგი დაბრუნდება.`, `${gel(s.total)} leaves income, stock goes back.`), confirm: t('დაბრუნება', 'Refund'), danger: true })) { try { await biz.post(`/sales/${s.id}/refund`, {}); paint(); } catch (e) { fail(e); } } } }) : null)))))),
        pager({ ...pg, size: st.state.size, onPage: (pp) => { st.set({ page: pp }); paint(); }, onSize: (n) => { st.set({ size: n, page: 1 }); paint(); } })));
  }

  function productDialog(p) {
    const name = input({ value: p?.name || '', placeholder: t('მაგ. აღმდგენი შამპუნი 250 მლ', 'e.g. Repair shampoo 250 ml') });
    const sku = input({ value: p?.sku || '', placeholder: t('კოდი / შტრიხკოდი', 'Code / barcode') });
    const category = input({ value: p?.category || '', placeholder: t('მაგ. თმის მოვლა', 'e.g. Hair care') });
    const price = input({ type: 'number', min: 0, step: '0.01', value: p?.price ?? '' });
    const cost = input({ type: 'number', min: 0, step: '0.01', value: p?.cost ?? '', placeholder: t('არასავალდებულო', 'optional') });
    const stock = input({ type: 'number', min: 0, step: '1', value: p?.stock ?? '', placeholder: t('ცარიელი = არ ითვლება', 'empty = not tracked') });
    const lowStock = input({ type: 'number', min: 0, step: '1', value: p?.lowStock ?? 3 });
    const unit = select([['pc', t('ცალი', 'pc')], ['ml', t('მლ', 'ml')], ['g', t('გ', 'g')], ['set', t('ნაკრები', 'set')]].map(([v, l]) => ({ value: v, label: l })), p?.unit || 'pc');
    const save = button(t('შენახვა', 'Save'));
    const m = openModal({
      title: p ? t('პროდუქტის რედაქტირება', 'Edit product') : t('ახალი პროდუქტი', 'New product'),
      body: h('div', { class: 'form' },
        field(t('სახელი', 'Name'), name),
        h('div', { class: 'form-row' }, field(t('კოდი', 'Code'), sku), field(t('კატეგორია', 'Category'), category)),
        h('div', { class: 'form-row' }, field(t('ფასი, ₾', 'Price, ₾'), price), field(t('თვითღირებულება, ₾', 'Cost, ₾'), cost)),
        h('div', { class: 'form-row' }, field(t('მარაგი', 'Stock'), stock), field(t('ერთეული', 'Unit'), unit), field(t('„მცირე მარაგი“ ზღვარი', 'Low-stock mark'), lowStock))),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try {
        const body = { name: name.value.trim(), sku: sku.value.trim() || null, category: category.value.trim() || null, price: Number(price.value), cost: cost.value === '' ? null : Number(cost.value), stock: stock.value === '' ? null : Number(stock.value), unit: unit.value, lowStock: Number(lowStock.value) || 0 };
        if (p) await biz.patch(`/products/${p.id}`, body); else await biz.post('/products', body);
        m.close();
        ok(t('შენახულია', 'Saved'));
        paint();
      } catch (e) { fail(e); }
    }));
  }

  function restockDialog(p) {
    const qty = input({ type: 'number', step: '1', value: 10 });
    const cost = input({ type: 'number', min: 0, step: '0.01', value: p.cost ?? '', placeholder: t('ახალი თვითღირებულება (არასავალდებულო)', 'New cost (optional)') });
    const note = input({ placeholder: t('მომწოდებელი, ზედნადები…', 'Supplier, invoice…') });
    const save = button(t('მიღება', 'Stock in'), { icon: 'check' });
    const m = openModal({
      title: t(`მარაგის მიღება — ${p.name}`, `Stock in — ${p.name}`),
      size: 'sm',
      body: h('div', { class: 'form' }, h('p', { class: 'muted' }, p.stock == null ? t('მარაგი ამ მიღებიდან დაიწყება.', 'Stock tracking starts with this delivery.') : t(`ახლა მარაგშია ${p.stock} ${p.unit}. მინუსით — ჩამოწერა.`, `${p.stock} ${p.unit} in stock now. Negative = write-off.`)), h('div', { class: 'form-row' }, field(t('რაოდენობა', 'Quantity'), qty), field(t('თვითღირებულება, ₾', 'Cost, ₾'), cost)), field(t('შენიშვნა', 'Note'), note)),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try {
        await biz.post(`/products/${p.id}/restock`, { qty: Number(qty.value), cost: cost.value === '' ? undefined : Number(cost.value), note: note.value.trim() || undefined });
        m.close();
        ok(t('მიღებულია', 'Stocked in'));
        paint();
      } catch (e) { fail(e); }
    }));
  }

  mount(root,
    pageHead(t('პროდუქტები', 'Products'), t('რასაც დახლთან ყიდი — ფასი, თვითღირებულება, მარაგი. გაყიდვა შემოსავალში, კლიენტის ბარათზე და გამყიდველის ხელფასში ჩაიწერება.', 'What you sell over the counter — price, cost, stock. A sale lands in income, on the client card and in the seller\'s payroll.')),
    host);
  await paint();
}

function kpi(label, value, delta, accent = false) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}

export { phoneText };
