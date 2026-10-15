// MEDIBOOK business panel — loyalty: cashback rules, gift cards (sell, list), memberships (packages to sell, passes clients hold).
import { h, mount, icon, button, pageHead, card, input, field, select, busy, openModal, confirmDialog, badge, textarea, debounce } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, emptyBox, fail, ok, when, dateText, phoneText, avatar, ymd, addDays, METHODS, minutes } from '../shared.js';
import { chips, filterBar } from '../lists.js';
import { dateField } from '../fields.js';

const KIND_LABEL = { BONUS_EARN: t('ბონუსი დაერიცხა', 'Bonus earned'), BONUS_REDEEM: t('ბონუსით გადაიხადა', 'Paid with bonus'), BONUS_ADJUST: t('ბონუსის კორექცია', 'Bonus adjusted'), GIFT_SOLD: t('ბარათი გაიყიდა', 'Gift card sold'), GIFT_REDEEM: t('ბარათით გადაიხადა', 'Paid with a gift card'), MEMBERSHIP_SOLD: t('აბონემენტი გაიყიდა', 'Membership sold'), MEMBERSHIP_USE: t('აბონემენტი გამოიყენა', 'Membership used') };
const GIFT_STATUS = { ACTIVE: [t('აქტიური', 'Active'), 'ok'], USED: [t('გამოყენებული', 'Used'), 'neutral'], EXPIRED: [t('ვადაგასული', 'Expired'), 'neutral'], CANCELLED: [t('გაუქმებული', 'Cancelled'), 'neutral'] };

export default async function loyaltyPage(root) {
  const host = h('div');
  let tab = 'cashback';
  let services = [];

  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      if (!services.length) services = (await biz.get('/services')).services.filter((s) => s.active);
      const data = await biz.get('/loyalty');
      const tabs = chips([['cashback', t('ქეშბექი', 'Cashback')], ['gifts', t('სასაჩუქრე ბარათები', 'Gift cards'), data.overview.giftCards.active || undefined], ['memberships', t('აბონემენტები', 'Memberships'), data.overview.memberships.active || undefined], ['ledger', t('მოძრაობა', 'Activity')]], tab, (v) => { tab = v; paint(); });
      const body = tab === 'cashback' ? cashbackView(data) : tab === 'gifts' ? await giftsView(data) : tab === 'memberships' ? await membershipsView(data) : ledgerView(data);
      mount(host, filterBar(tabs), body);
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  // ── cashback ──
  function cashbackView(data) {
    const L = data.loyalty;
    const o = data.overview;
    const save = async (patch) => { try { await biz.patch('', { settings: { loyalty: { ...L, ...patch } } }); ok(t('შენახულია', 'Saved')); paint(); } catch (e) { fail(e); } };
    const sel = (options, value, key) => select(options.map(([v, l]) => ({ value: v, label: l })), value, { class: 'input select', style: { width: 'auto' }, onChange: (e) => save({ [key]: Number(e.target.value) }) });
    const row = (title, sub, control) => h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, title), sub ? h('div', { class: 'faint' }, sub) : null), control);
    return h('div', { class: 'bz-grid' },
      card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('ქეშბექი — ბონუსი ყოველი ვიზიტიდან', 'Cashback — bonus from every visit')), h('div', { class: 'card-sub' }, t('ფულით გადახდილი თანხის ნაწილი კლიენტს ბონუსად უბრუნდება და შემდეგ ვიზიტზე იხარჯება. აპში ბალანსი ბიზნესის გვერდზე ჩანს.', 'A share of what the client pays in money comes back as bonus and is spent on the next visit. The balance shows on the business page in the app.')))),
        h('div', { style: { display: 'grid', gap: '10px' } },
          row(t('ქეშბექის პროცენტი', 'Cashback percent'), t('0 = ქეშბექი გამორთულია', '0 = cashback off'), sel([[0, t('გამორთული', 'Off')], [3, '3%'], [5, '5%'], [7, '7%'], [10, '10%'], [15, '15%'], [20, '20%']], L.cashbackPercent, 'cashbackPercent')),
          row(t('პირველი ვიზიტის ბონუსი', 'First-visit bonus'), t('ერთჯერადად, პირველი დასრულებული ვიზიტის შემდეგ', 'Once, after the first completed visit'), sel([[0, t('არა', 'None')], [5, '5 ₾'], [10, '10 ₾'], [20, '20 ₾']], L.welcomeBonus, 'welcomeBonus')),
          row(t('მაქსიმუმ ბონუსით', 'Most payable with bonus'), t('ვიზიტის ფასის რა ნაწილი შეიძლება ბონუსით დაიფაროს', 'How much of a visit may be covered by bonus'), sel([[20, '20%'], [30, '30%'], [50, '50%'], [100, '100%']], L.maxRedeemPercent, 'maxRedeemPercent')))),
      card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('ციფრები', 'Numbers')),
        h('dl', { class: 'bz-kv' },
          h('dt', null, t('ბონუსი კლიენტებზე', 'Bonus on client cards')), h('dd', null, h('b', null, gel(o.bonus.liability)), h('span', { class: 'bz-sub' }, t(` · ${o.bonus.clients} კლიენტი`, ` · ${o.bonus.clients} clients`))),
          h('dt', null, t('30 დღეში დაერიცხა', 'Earned in 30 days')), h('dd', null, gel(o.bonus.earned30)),
          h('dt', null, t('30 დღეში დაიხარჯა', 'Spent in 30 days')), h('dd', null, gel(o.bonus.redeemed30)),
          h('dt', null, t('აქტიური ბარათები', 'Live gift cards')), h('dd', null, `${o.giftCards.active} · ${gel(o.giftCards.balance)}`),
          h('dt', null, t('აქტიური აბონემენტები', 'Live memberships')), h('dd', null, String(o.memberships.active))),
        h('p', { class: 'bz-note', style: { marginTop: '10px' } }, t('ვიზიტის დასრულებისას დიალოგი თავად აჩვენებს კლიენტის ბონუსს, აბონემენტს და იღებს სასაჩუქრე ბარათის კოდს.', 'When completing a visit the dialog shows the client\'s bonus and membership by itself and takes a gift-card code.'))));
  }

  // ── gift cards ──
  async function giftsView() {
    const status = giftsView.status || 'ACTIVE';
    const { giftCards } = await biz.get('/gift-cards', { status });
    const list = h('div');
    const paintList = (q = '') => {
      const term = q.trim().toLowerCase();
      const rows = giftCards.filter((g) => !term || `${g.code} ${g.buyerName || ''} ${g.recipientName || ''} ${g.recipientPhone || ''}`.toLowerCase().includes(term));
      mount(list, rows.length ? card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
        h('thead', null, h('tr', null, h('th', null, t('კოდი', 'Code')), h('th', { class: 'num' }, t('ნომინალი', 'Value')), h('th', { class: 'num' }, t('დარჩა', 'Left')), h('th', null, t('ვისთვის', 'For')), h('th', null, t('ვადა', 'Expires')), h('th', null, t('სტატუსი', 'Status')), h('th'))),
        h('tbody', null, rows.map((g) => h('tr', { class: g.status === 'ACTIVE' ? '' : 'is-muted' },
          h('td', null, h('code', { class: 'bz-code' }, g.code), g.buyerName ? h('div', { class: 'faint' }, t(`იყიდა: ${g.buyerName}`, `bought by ${g.buyerName}`)) : null),
          h('td', { class: 'num' }, gel(g.amount)),
          h('td', { class: 'num' }, h('b', null, gel(g.balance))),
          h('td', null, g.recipientName || h('span', { class: 'bz-dim' }, '—'), g.recipientPhone ? h('div', { class: 'faint' }, phoneText(g.recipientPhone)) : null),
          h('td', null, g.expiresOn ? dateText(g.expiresOn) : '—'),
          h('td', null, badge(GIFT_STATUS[g.status]?.[0] || g.status, GIFT_STATUS[g.status]?.[1] || 'neutral')),
          h('td', { class: 'num' }, g.status === 'ACTIVE' ? button('', { size: 'sm', variant: 'ghost', icon: 'x', ariaLabel: t('გაუქმება', 'Cancel'), onClick: async () => { if (await confirmDialog({ title: t('ბარათის გაუქმება?', 'Cancel the card?'), body: `${g.code} · ${gel(g.balance)}`, confirm: t('გაუქმება', 'Cancel card'), danger: true })) { try { await biz.patch(`/gift-cards/${g.id}`, { status: 'CANCELLED' }); paint(); } catch (e) { fail(e); } } } }) : null)))))))
        : card(emptyBox(t('ბარათი არ არის', 'No gift cards'), t('გაყიდე სასაჩუქრე ბარათი — კოდი კლიენტს მიეცი, ვიზიტის დასრულებისას კოდით იხდის.', 'Sell a gift card — give the code to the client; it pays at the end of a visit.'), button(t('ბარათის გაყიდვა', 'Sell a gift card'), { icon: 'plus', onClick: sellGiftDialog }))));
    };
    paintList();
    return h('div', null,
      filterBar(chips([['ACTIVE', t('აქტიური', 'Active')], ['USED', t('გამოყენებული', 'Used')], ['all', t('ყველა', 'All')]], status, (v) => { giftsView.status = v; paint(); }),
        input({ class: 'input', placeholder: t('ძებნა — კოდი, სახელი, ტელეფონი…', 'Search — code, name, phone…'), onInput: debounce((e) => paintList(e.target.value), 200) }),
        button(t('ბარათის გაყიდვა', 'Sell a gift card'), { icon: 'plus', onClick: sellGiftDialog })),
      list);
  }

  function sellGiftDialog() {
    const amount = input({ type: 'number', min: 1, step: '1', value: 100 });
    const presets = h('div', { class: 'bz-chips' }, [50, 100, 150, 200, 300].map((v) => h('button', { type: 'button', class: 'bz-chip', onClick: () => { amount.value = v; } }, `${v} ₾`)));
    const buyer = input({ placeholder: t('ვინ ყიდულობს (არასავალდებულო)', 'Who buys (optional)') });
    const recipient = input({ placeholder: t('ვისთვის (არასავალდებულო)', 'For whom (optional)') });
    const phone = input({ type: 'tel', placeholder: t('მიმღების ტელეფონი', 'Recipient phone') });
    const expires = dateField({ value: addDays(ymd(), 365) });
    const method = select(METHODS.map(([value, label]) => ({ value, label })), 'CASH');
    const note = textarea({ rows: 2, placeholder: t('შენიშვნა', 'Note') });
    const sell = button(t('გაყიდვა', 'Sell'), { icon: 'check' });
    const m = openModal({
      title: t('სასაჩუქრე ბარათის გაყიდვა', 'Sell a gift card'),
      body: h('div', { class: 'form' },
        h('p', { class: 'muted' }, t('თანხა ახლავე შემოსავალში ჩაიწერება; ბარათი ვიზიტებზე იხარჯება კოდით.', 'The amount goes into income now; the card is spent on visits by its code.')),
        field(t('ნომინალი, ₾', 'Value, ₾'), amount), presets,
        h('div', { class: 'form-row' }, field(t('მყიდველი', 'Buyer'), buyer), field(t('გადახდა', 'Payment'), method)),
        h('div', { class: 'form-row' }, field(t('მიმღები', 'Recipient'), recipient), field(t('ტელეფონი', 'Phone'), phone)),
        field(t('მოქმედების ვადა', 'Valid until'), expires.el),
        field(t('შენიშვნა', 'Note'), note)),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), sell],
    });
    sell.addEventListener('click', () => busy(sell, async () => {
      try {
        const { giftCard } = await biz.post('/gift-cards', { amount: Number(amount.value), buyerName: buyer.value.trim() || undefined, recipientName: recipient.value.trim() || undefined, recipientPhone: phone.value.trim() || undefined, expiresOn: expires.get() || undefined, paidMethod: method.value, note: note.value.trim() || undefined });
        m.close();
        codeDialog(giftCard);
        paint();
      } catch (e) { fail(e); }
    }));
  }

  /** The code, big, with copy — the one thing the client takes home. */
  function codeDialog(g) {
    const text = t(`სასაჩუქრე ბარათი ${gel(g.amount)} — კოდი ${g.code}${g.expiresOn ? `, მოქმედებს ${dateText(g.expiresOn)}-მდე` : ''}.`, `Gift card ${gel(g.amount)} — code ${g.code}${g.expiresOn ? `, valid until ${dateText(g.expiresOn)}` : ''}.`);
    openModal({
      title: t('ბარათი გაყიდულია', 'Gift card sold'),
      size: 'sm',
      body: h('div', { style: { textAlign: 'center', display: 'grid', gap: '10px' } },
        h('div', { class: 'bz-gift-code' }, g.code),
        h('div', { class: 'faint' }, `${gel(g.amount)}${g.recipientName ? ` · ${g.recipientName}` : ''}${g.expiresOn ? ` · ${dateText(g.expiresOn)}` : ''}`),
        h('p', { class: 'bz-note' }, t('კოდი კლიენტს მიეცი — ვიზიტის დასრულებისას „სასაჩუქრე ბარათი“ ველში ჩაიწერება.', 'Give the code to the client — it goes into the "gift card" field when a visit is completed.'))),
      footer: (close) => [button(t('კოპირება', 'Copy'), { variant: 'secondary', icon: 'copy', onClick: async () => { try { await navigator.clipboard.writeText(text); ok(t('დაკოპირდა', 'Copied')); } catch { /* no clipboard */ } } }), button(t('კარგი', 'Done'), { onClick: () => close() })],
    });
  }

  // ── memberships ──
  async function membershipsView() {
    const [{ memberships }, { clientMemberships }] = await Promise.all([biz.get('/memberships', { all: 1 }), biz.get('/client-memberships', { status: membershipsView.status || 'ACTIVE' })]);
    const products = card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('აბონემენტები გასაყიდად', 'Memberships to sell')), h('div', { class: 'card-sub' }, t('ვიზიტების პაკეტი ან წინასწარ გადახდილი თანხა, ვადით.', 'A package of visits or a prepaid amount, with a validity.'))), button(t('ახალი', 'New'), { size: 'sm', icon: 'plus', onClick: () => membershipDialog(null) })),
      memberships.length ? h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
        h('thead', null, h('tr', null, h('th', null, t('სახელი', 'Name')), h('th', null, t('შიგთავსი', 'Contents')), h('th', { class: 'num' }, t('ფასი', 'Price')), h('th', null, t('ვადა', 'Validity')), h('th', { class: 'num' }, t('გაყიდული', 'Sold')), h('th'))),
        h('tbody', null, memberships.map((m) => h('tr', { class: m.active ? '' : 'is-muted' },
          h('td', null, h('b', null, m.title), m.description ? h('div', { class: 'faint' }, m.description) : null),
          h('td', null, m.kind === 'VISITS' ? t(`${m.visitsTotal} ვიზიტი`, `${m.visitsTotal} visits`) : gel(m.amountTotal), h('div', { class: 'faint' }, m.serviceIds.length ? services.filter((s) => m.serviceIds.includes(s.id)).map((s) => s.name).join(', ') : t('ყველა სერვისი', 'Every service'))),
          h('td', { class: 'num' }, gel(m.price)),
          h('td', null, t(`${m.validDays} დღე`, `${m.validDays} days`)),
          h('td', { class: 'num' }, String(m.sold ?? 0)),
          h('td', { class: 'num' }, h('div', { class: 'bz-inline', style: { justifyContent: 'flex-end' } },
            m.active ? button(t('გაყიდვა', 'Sell'), { size: 'sm', onClick: () => sellMembershipDialog(m) }) : null,
            button('', { size: 'sm', variant: 'ghost', icon: 'edit', ariaLabel: t('რედაქტირება', 'Edit'), onClick: () => membershipDialog(m) }),
            m.active ? button('', { size: 'sm', variant: 'ghost', icon: 'trash', ariaLabel: t('გაუქმება', 'Retire'), onClick: async () => { if (await confirmDialog({ title: t('აღარ გაიყიდოს?', 'Stop selling it?'), body: m.title, confirm: t('გაუქმება', 'Retire') })) { try { await biz.del(`/memberships/${m.id}`); paint(); } catch (e) { fail(e); } } } }) : null)))))))
        : h('p', { class: 'bz-sub' }, t('ჯერ არ არის — შექმენი პირველი.', 'None yet — create the first one.')));
    const passes = card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('კლიენტების აბონემენტები', 'Memberships clients hold')), h('div', { class: 'card-sub' }, t('ვიზიტის დასრულებისას დიალოგი თავად სთავაზობს მოქმედ აბონემენტს.', 'When a visit is completed the dialog offers a live membership by itself.'))),
      chips([['ACTIVE', t('მოქმედი', 'Live')], ['USED', t('ამოწურული', 'Used up')], ['all', t('ყველა', 'All')]], membershipsView.status || 'ACTIVE', (v) => { membershipsView.status = v; paint(); })),
      clientMemberships.length ? h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
        h('thead', null, h('tr', null, h('th', null, t('კლიენტი', 'Client')), h('th', null, t('აბონემენტი', 'Membership')), h('th', null, t('დარჩა', 'Left')), h('th', null, t('ვადა', 'Until')), h('th', null, t('სტატუსი', 'Status')), h('th'))),
        h('tbody', null, clientMemberships.map((cm) => h('tr', { class: cm.status === 'ACTIVE' ? '' : 'is-muted' },
          h('td', null, h('div', { class: 'bz-inline' }, avatar(cm.clientName, '#64748B', 28), h('div', null, h('a', { class: 'bz-link', href: `/business/clients/${cm.clientId}`, 'data-link': '' }, cm.clientName), cm.clientPhone ? h('div', { class: 'faint' }, phoneText(cm.clientPhone)) : null))),
          h('td', null, cm.title, h('div', { class: 'faint' }, `${gel(cm.price)} · ${dateText(cm.startsOn)}`)),
          h('td', null, h('b', null, cm.kind === 'VISITS' ? t(`${cm.visitsLeft} / ${cm.visitsTotal} ვიზიტი`, `${cm.visitsLeft} / ${cm.visitsTotal} visits`) : `${gel(cm.amountLeft)} / ${gel(cm.amountTotal)}`)),
          h('td', null, dateText(cm.endsOn)),
          h('td', null, badge(GIFT_STATUS[cm.status]?.[0] || cm.status, GIFT_STATUS[cm.status]?.[1] || 'neutral')),
          h('td', { class: 'num' }, cm.status === 'ACTIVE' ? button('', { size: 'sm', variant: 'ghost', icon: 'x', ariaLabel: t('გაუქმება', 'Cancel'), onClick: async () => { if (await confirmDialog({ title: t('აბონემენტის გაუქმება?', 'Cancel the membership?'), body: `${cm.clientName} · ${cm.title}`, confirm: t('გაუქმება', 'Cancel it'), danger: true })) { try { await biz.patch(`/client-memberships/${cm.id}`, { status: 'CANCELLED' }); paint(); } catch (e) { fail(e); } } } }) : null))))))
        : h('p', { class: 'bz-sub' }, t('ჯერ არავის აქვს.', 'Nobody holds one yet.')));
    return h('div', { style: { display: 'grid', gap: '16px' } }, products, passes);
  }

  function membershipDialog(m) {
    const title = input({ value: m?.title || '', placeholder: t('მაგ. 10 მანიკური', 'e.g. 10 manicures') });
    const description = input({ value: m?.description || '', placeholder: t('ერთი წინადადება კლიენტისთვის', 'One line for the client') });
    const kind = select([{ value: 'VISITS', label: t('ვიზიტების პაკეტი', 'Package of visits') }, { value: 'AMOUNT', label: t('წინასწარ გადახდილი თანხა', 'Prepaid amount') }], m?.kind || 'VISITS');
    const visits = input({ type: 'number', min: 1, max: 200, value: m?.visitsTotal ?? 10 });
    const amount = input({ type: 'number', min: 1, step: '1', value: m?.amountTotal ?? 500 });
    const price = input({ type: 'number', min: 1, step: '1', value: m?.price ?? '' });
    const validDays = select([30, 60, 90, 180, 365].map((v) => ({ value: v, label: t(`${v} დღე`, `${v} days`) })), m?.validDays || 90);
    const checks = services.map((s) => h('label', { class: `bz-chip${m?.serviceIds?.includes(s.id) ? ' on' : ''}`, style: { cursor: 'pointer' } }, h('input', { type: 'checkbox', value: s.id, checked: Boolean(m?.serviceIds?.includes(s.id)), onChange: (e) => e.target.parentElement.classList.toggle('on', e.target.checked) }), `${s.name} · ${minutes(s.durationMin)}`));
    const visitsField = field(t('რამდენი ვიზიტი', 'How many visits'), visits);
    const amountField = field(t('თანხა, ₾', 'Amount, ₾'), amount);
    const sync = () => { visitsField.hidden = kind.value !== 'VISITS'; amountField.hidden = kind.value !== 'AMOUNT'; };
    kind.addEventListener('change', sync);
    sync();
    const save = button(t('შენახვა', 'Save'));
    const dlg = openModal({
      title: m ? t('აბონემენტის რედაქტირება', 'Edit membership') : t('ახალი აბონემენტი', 'New membership'),
      body: h('div', { class: 'form' },
        field(t('სახელი', 'Name'), title), field(t('აღწერა', 'Description'), description),
        h('div', { class: 'form-row' }, field(t('ტიპი', 'Type'), kind), visitsField, amountField),
        h('div', { class: 'form-row' }, field(t('ფასი, ₾', 'Price, ₾'), price), field(t('მოქმედების ვადა', 'Validity'), validDays)),
        field(t('სერვისები (ცარიელი = ყველა)', 'Services (empty = all)'), h('div', { class: 'bz-chips' }, checks))),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
    });
    save.addEventListener('click', () => busy(save, async () => {
      try {
        const body = { title: title.value.trim(), description: description.value.trim() || undefined, kind: kind.value, visitsTotal: Number(visits.value), amountTotal: Number(amount.value), price: Number(price.value), validDays: Number(validDays.value), serviceIds: checks.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value) };
        if (m) await biz.patch(`/memberships/${m.id}`, body); else await biz.post('/memberships', body);
        dlg.close();
        ok(t('შენახულია', 'Saved'));
        paint();
      } catch (e) { fail(e); }
    }));
  }

  function sellMembershipDialog(m) {
    const clientQ = input({ placeholder: t('კლიენტის სახელი ან ტელეფონი…', 'Client name or phone…'), autocomplete: 'off' });
    const clientList = h('div', { class: 'bz-geo-list' });
    let clientId = null;
    const picked = h('div', { class: 'bz-note' });
    const searchClients = debounce(async () => {
      const term = clientQ.value.trim();
      clientId = null;
      picked.textContent = '';
      if (term.length < 2) { mount(clientList); return; }
      try {
        const { clients } = await biz.get('/clients', { q: term, limit: 6 });
        mount(clientList, clients.map((c) => h('button', { type: 'button', onClick: () => { clientId = c.id; clientQ.value = c.name; picked.textContent = t('კლიენტი არჩეულია', 'Client selected'); mount(clientList); } }, icon('user', { size: 14 }), ` ${c.name}`, c.phone ? h('span', { class: 'faint' }, ` · ${c.phone}`) : null)));
      } catch { mount(clientList); }
    }, 250);
    clientQ.addEventListener('input', searchClients);
    const method = select(METHODS.map(([value, label]) => ({ value, label })), 'CASH');
    const starts = dateField({ value: ymd() });
    const sell = button(t('გაყიდვა', 'Sell'), { icon: 'check' });
    const dlg = openModal({
      title: t(`აბონემენტის გაყიდვა — ${m.title}`, `Sell membership — ${m.title}`),
      size: 'sm',
      body: h('div', { class: 'form' },
        h('p', { class: 'muted' }, `${gel(m.price)} · ${m.kind === 'VISITS' ? t(`${m.visitsTotal} ვიზიტი`, `${m.visitsTotal} visits`) : gel(m.amountTotal)} · ${t(`${m.validDays} დღე`, `${m.validDays} days`)}`),
        field(t('კლიენტი', 'Client'), clientQ), clientList, picked,
        h('div', { class: 'form-row' }, field(t('გადახდა', 'Payment'), method), field(t('იწყება', 'Starts'), starts.el))),
      footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), sell],
    });
    sell.addEventListener('click', () => busy(sell, async () => {
      try {
        if (!clientId) throw new Error(t('აირჩიე კლიენტი სიიდან.', 'Pick a client from the list.'));
        await biz.post('/client-memberships', { membershipId: m.id, clientId, paidMethod: method.value, startsOn: starts.get() || undefined });
        dlg.close();
        ok(t('გაყიდულია', 'Sold'));
        membershipsView.status = 'ACTIVE';
        paint();
      } catch (e) { fail(e); }
    }));
  }

  // ── ledger ──
  function ledgerView(data) {
    const rows = data.overview.ledger;
    return rows.length ? card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
      h('thead', null, h('tr', null, h('th', null, t('როდის', 'When')), h('th', null, t('რა', 'What')), h('th', null, t('კლიენტი', 'Client')), h('th', { class: 'num' }, t('თანხა', 'Amount')))),
      h('tbody', null, rows.map((r) => h('tr', null,
        h('td', { class: 'faint' }, when(r.createdAt)),
        h('td', null, KIND_LABEL[r.kind] || r.kind, r.note ? h('div', { class: 'faint' }, r.note) : null),
        h('td', null, r.clientId ? h('a', { class: 'bz-link', href: `/business/clients/${r.clientId}`, 'data-link': '' }, r.clientName || '—') : h('span', { class: 'bz-dim' }, '—')),
        h('td', { class: `num ${r.amount < 0 ? 'bz-bad' : ''}` }, `${r.amount > 0 ? '+' : ''}${gel(r.amount)}`)))))))
      : card(emptyBox(t('მოძრაობა ჯერ არ არის', 'No activity yet'), t('ბონუსები, ბარათები და აბონემენტები აქ ჩაიწერება.', 'Bonuses, gift cards and memberships are recorded here.')));
  }

  mount(root,
    pageHead(t('ლოიალობა', 'Loyalty'), t('ქეშბექი ყოველი ვიზიტიდან, სასაჩუქრე ბარათები და აბონემენტები — რათა კლიენტი დაბრუნდეს.', 'Cashback from every visit, gift cards and memberships — so the client comes back.')),
    host);
  await paint();
}
