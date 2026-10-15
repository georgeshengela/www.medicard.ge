// MEDIBOOK business panel — discounts: percent or fixed, on some services, within dates / weekdays / hours, with a code.
import { h, mount, icon, button, pageHead, card, input, field, select, busy, openModal, confirmDialog, toggle, badge } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, emptyBox, fail, ok, WEEKDAYS_SHORT } from '../shared.js';
import { dateField, timeField } from '../fields.js';

export default async function discountsPage(root) {
  const host = h('div');
  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const [{ discounts }, { services }] = await Promise.all([biz.get('/discounts'), biz.get('/services')]);
      if (!discounts.length) { mount(host, card(emptyBox(t('ფასდაკლება ჯერ არ არის', 'No discounts yet'), t('Happy hours დილით, პირველი ვიზიტის −20%, პრომო კოდი ინსტაგრამისთვის — აპში ფასი თავისით მცირდება.', 'Morning happy hours, −20% on a first visit, a promo code for Instagram — the price drops by itself in the app.'), button(t('ფასდაკლების შექმნა', 'Create a discount'), { icon: 'plus', onClick: () => dialog(null, services, paint) })))); return; }
      mount(host, card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
        h('thead', null, h('tr', null, h('th', null, t('ფასდაკლება', 'Discount')), h('th', null, t('რაზე', 'On')), h('th', null, t('როდის', 'When')), h('th', null, t('კოდი', 'Code')), h('th', { class: 'num' }, t('გამოყენება', 'Used')), h('th', null, t('აქტიური', 'Active')), h('th'))),
        h('tbody', null, discounts.map((d) => h('tr', null,
          h('td', null, h('b', null, d.title), h('div', { class: 'faint' }, d.kind === 'PERCENT' ? `−${d.value}%` : `−${gel(d.value)}`)),
          h('td', null, d.serviceIds.length ? services.filter((s) => d.serviceIds.includes(s.id)).map((s) => s.name).join(', ') : t('ყველა სერვისი', 'Every service')),
          h('td', null, [d.startsOn || d.endsOn ? `${d.startsOn || '…'} – ${d.endsOn || '…'}` : null, d.weekdays.length ? d.weekdays.map((w) => WEEKDAYS_SHORT[w]).join(', ') : null, d.hoursFrom && d.hoursTo ? `${d.hoursFrom}–${d.hoursTo}` : null].filter(Boolean).join(' · ') || t('ყოველთვის', 'Always')),
          h('td', null, d.code ? h('code', null, d.code) : h('span', { class: 'bz-dim' }, '—')),
          h('td', { class: 'num' }, `${d.usedCount}${d.maxUses ? ` / ${d.maxUses}` : ''}`),
          h('td', null, toggle(d.active, async (on) => { try { await biz.patch(`/discounts/${d.id}`, { active: on }); } catch (e) { fail(e); paint(); } })),
          h('td', { class: 'num' }, h('div', { class: 'bz-inline', style: { justifyContent: 'flex-end' } }, button('', { variant: 'ghost', size: 'sm', icon: 'edit', ariaLabel: t('რედაქტირება', 'Edit'), onClick: () => dialog(d, services, paint) }), button('', { variant: 'ghost', size: 'sm', icon: 'trash', ariaLabel: t('წაშლა', 'Delete'), onClick: async () => { if (await confirmDialog({ title: t('წავშალო?', 'Delete?'), body: d.title, confirm: t('წაშლა', 'Delete'), danger: true })) { try { await biz.del(`/discounts/${d.id}`); paint(); } catch (e) { fail(e); } } } }))))))))));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }
  mount(root,
    pageHead(t('ფასდაკლებები', 'Discounts'), t('აპში ფასი თავისით მცირდება, როცა პირობა ემთხვევა; კოდიანი — მხოლოდ კოდით.', 'The price in the app drops by itself when the rule matches; a coded one needs the code.'),
      button(t('ფასდაკლების შექმნა', 'Create a discount'), { icon: 'plus', onClick: async () => dialog(null, (await biz.get('/services')).services, paint) })),
    host);
  await paint();
}

function dialog(d, services, onSaved) {
  const title = input({ value: d?.title || '', required: true, placeholder: t('მაგ. დილის happy hours', 'e.g. Morning happy hours') });
  const kind = select([{ value: 'PERCENT', label: t('პროცენტი', 'Percent') }, { value: 'FIXED', label: t('ფიქსირებული, ₾', 'Fixed, ₾') }], d?.kind || 'PERCENT');
  const value = input({ type: 'number', min: 0, step: '0.01', value: d?.value ?? 10 });
  const checks = services.filter((s) => s.active).map((s) => h('label', { class: `bz-chip${d?.serviceIds.includes(s.id) ? ' on' : ''}`, style: { cursor: 'pointer' } }, h('input', { type: 'checkbox', value: s.id, checked: Boolean(d?.serviceIds.includes(s.id)), onChange: (e) => e.target.parentElement.classList.toggle('on', e.target.checked) }), s.name));
  const startsOn = dateField({ value: d?.startsOn || '', allowEmpty: true, placeholder: t('დღეიდან', 'From today') });
  const endsOn = dateField({ value: d?.endsOn || '', allowEmpty: true, placeholder: t('უვადოდ', 'No end date') });
  const days = [1, 2, 3, 4, 5, 6, 0].map((w) => h('label', { class: `bz-chip${d?.weekdays.includes(w) ? ' on' : ''}`, style: { cursor: 'pointer' } }, h('input', { type: 'checkbox', value: w, checked: Boolean(d?.weekdays.includes(w)), onChange: (e) => e.target.parentElement.classList.toggle('on', e.target.checked) }), WEEKDAYS_SHORT[w]));
  const hoursFrom = timeField({ value: d?.hoursFrom || '', from: '06:00', to: '23:45', step: 30, allowEmpty: true, placeholder: t('მთელი დღე', 'All day') });
  const hoursTo = timeField({ value: d?.hoursTo || '', from: '06:00', to: '24:00', step: 30, allowEmpty: true, placeholder: t('მთელი დღე', 'All day') });
  const code = input({ value: d?.code || '', placeholder: t('მაგ. INSTA20 (არასავალდებულო)', 'e.g. INSTA20 (optional)'), style: { textTransform: 'uppercase' } });
  const maxUses = input({ type: 'number', min: 1, value: d?.maxUses ?? '', placeholder: t('უსასრულო', 'Unlimited') });
  const save = button(t('შენახვა', 'Save'));
  const m = openModal({
    title: d ? t('ფასდაკლების რედაქტირება', 'Edit discount') : t('ახალი ფასდაკლება', 'New discount'),
    size: 'lg',
    body: h('div', { class: 'form' },
      field(t('სათაური (კლიენტი ხედავს)', 'Title (the client sees it)'), title),
      h('div', { class: 'form-row' }, field(t('ტიპი', 'Type'), kind), field(t('ზომა', 'Amount'), value)),
      field(t('სერვისები (ცარიელი = ყველა)', 'Services (empty = all)'), h('div', { class: 'bz-chips' }, checks)),
      h('div', { class: 'form-row' }, field(t('იწყება', 'Starts'), startsOn.el), field(t('მთავრდება', 'Ends'), endsOn.el)),
      field(t('კვირის დღეები (ცარიელი = ყველა)', 'Weekdays (empty = all)'), h('div', { class: 'bz-chips' }, days)),
      h('div', { class: 'form-row' }, field(t('საათებიდან', 'From hour'), hoursFrom.el), field(t('საათებამდე', 'To hour'), hoursTo.el)),
      h('div', { class: 'form-row' }, field(t('პრომო კოდი', 'Promo code'), code), field(t('მაქს. გამოყენება', 'Max uses'), maxUses))),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
  });
  save.addEventListener('click', () => busy(save, async () => {
    try {
      const body = {
        title: title.value.trim(), kind: kind.value, value: Number(value.value), serviceIds: checks.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value),
        startsOn: startsOn.get() || null, endsOn: endsOn.get() || null, weekdays: days.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => Number(i.value)),
        hoursFrom: hoursFrom.get() || null, hoursTo: hoursTo.get() || null, code: code.value.trim().toUpperCase() || null, maxUses: maxUses.value === '' ? null : Number(maxUses.value), active: d ? d.active : true,
      };
      if (d) await biz.patch(`/discounts/${d.id}`, body); else await biz.post('/discounts', body);
      m.close();
      ok(t('შენახულია', 'Saved'));
      onSaved?.();
    } catch (e) { fail(e); }
  }));
}

export { icon, badge };
