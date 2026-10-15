// MEDIBOOK business panel — the sale dialog: products with quantities, a client (optional), who sold, the method.
import { h, mount, icon, button, busy, field, input, select, openModal, debounce } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, fail, ok, METHODS } from './shared.js';

/**
 * `preset` = { clientId, clientName, appointmentId, staffId }. `onCreated(sale)` after the sale is written.
 * Products are loaded here, so any page can open it.
 */
export async function saleDialog(preset = {}, { onCreated } = {}) {
  const [{ products }, { staff }] = await Promise.all([biz.get('/products'), biz.get('/staff')]);
  if (!products.length) { fail(new Error(t('ჯერ პროდუქტი არ არის — დაამატე „პროდუქტები“ გვერდზე.', 'No products yet — add them on the Products page.'))); return null; }
  const clientQ = input({ placeholder: t('კლიენტი (არასავალდებულო)', 'Client (optional)'), autocomplete: 'off', value: preset.clientName || '' });
  const clientList = h('div', { class: 'bz-geo-list' });
  let clientId = preset.clientId || null;
  const searchClients = debounce(async () => {
    const term = clientQ.value.trim();
    clientId = null;
    if (term.length < 2) { mount(clientList); return; }
    try {
      const { clients } = await biz.get('/clients', { q: term, limit: 6 });
      mount(clientList, clients.map((c) => h('button', { type: 'button', onClick: () => { clientId = c.id; clientQ.value = c.name; mount(clientList); } }, icon('user', { size: 14 }), ` ${c.name}`, c.phone ? h('span', { class: 'faint' }, ` · ${c.phone}`) : null)));
    } catch { mount(clientList); }
  }, 250);
  clientQ.addEventListener('input', searchClients);
  const who = select([{ value: '', label: t('— არავინ —', '— nobody —') }, ...staff.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))], preset.staffId || '');
  const method = select(METHODS.map(([value, label]) => ({ value, label })), 'CASH');
  const note = input({ placeholder: t('შენიშვნა', 'Note') });
  const linesHost = h('div', { class: 'bz-sale-lines' });
  const totalEl = h('div', { class: 'bz-pay-summary' });
  const lines = [];
  const opt = (p) => ({ value: p.id, label: `${p.name} · ${gel(p.price)}${p.stock != null ? ` · ${t(`მარაგი ${p.stock}`, `stock ${p.stock}`)}` : ''}` });
  function addLine(productId = products[0].id) {
    const line = { productId, qty: 1 };
    lines.push(line);
    paintLines();
  }
  function paintLines() {
    mount(linesHost, lines.map((line, i) => {
      const sel = select(products.map(opt), line.productId, { onChange: (e) => { line.productId = e.target.value; paintTotal(); } });
      const qty = input({ type: 'number', min: 1, step: '1', value: line.qty, style: { width: '72px' }, onInput: (e) => { line.qty = Math.max(1, Number(e.target.value) || 1); paintTotal(); } });
      return h('div', { class: 'bz-sale-line' }, sel, qty, button('', { variant: 'ghost', size: 'sm', icon: 'x', ariaLabel: t('ამოღება', 'Remove'), onClick: () => { lines.splice(i, 1); paintLines(); } }));
    }), h('button', { type: 'button', class: 'bz-add-line', onClick: () => addLine() }, icon('plus', { size: 14 }), ' ', t('კიდევ პროდუქტი', 'Another product')));
    paintTotal();
  }
  function paintTotal() {
    const total = lines.reduce((s, l) => { const p = products.find((x) => x.id === l.productId); return s + (p ? p.price * l.qty : 0); }, 0);
    mount(totalEl, h('div', { class: 'total' }, h('span', null, t('სულ', 'Total')), h('b', null, gel(total))));
  }
  addLine();
  const err = h('div', { class: 'form-error', hidden: true });
  const sell = button(t('გაყიდვა', 'Sell'), { icon: 'check' });
  const m = openModal({
    title: t('პროდუქტის გაყიდვა', 'Sell products'),
    body: h('div', { class: 'form' },
      field(t('პროდუქტები', 'Products'), linesHost),
      totalEl,
      field(t('კლიენტი', 'Client'), clientQ), clientList,
      h('div', { class: 'form-row' }, field(t('ვინ გაყიდა', 'Sold by'), who), field(t('გადახდა', 'Payment'), method)),
      field(t('შენიშვნა', 'Note'), note), err),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), sell],
  });
  sell.addEventListener('click', () => busy(sell, async () => {
    err.hidden = true;
    try {
      const { sale } = await biz.post('/sales', { items: lines.map((l) => ({ productId: l.productId, qty: l.qty })), clientId: clientId || undefined, clientName: clientQ.value.trim() || undefined, appointmentId: preset.appointmentId || undefined, staffId: who.value || null, paidMethod: method.value, note: note.value.trim() || undefined });
      m.close();
      ok(t(`გაიყიდა · ${gel(sale.total)}`, `Sold · ${gel(sale.total)}`));
      onCreated?.(sale);
    } catch (e) { err.textContent = e?.message || t('ვერ გაიყიდა.', 'Could not sell.'); err.hidden = false; }
  }));
  return m;
}
