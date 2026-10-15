// MEDIBOOK business panel — the client book: the book in numbers, filters, a sortable table 25 a page,
// one client's card with history, notes and tags.
import { h, mount, icon, button, pageHead, card, input, textarea, field, busy, openModal, badge } from '/app/js/ui.js';
import { select } from '../fields.js';
import { donut } from '/app/js/charts.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, when, dateText, avatar, emptyBox, debounceFn, fail, ok, statusBadge, minutes, phoneText } from '../shared.js';
import { appointmentLine, loadContext, newAppointmentDialog, openAppointment } from '../appointment.js';
import { chips, filterBar, listState, pager, paginate, sortRows, sortableHead } from '../lists.js';

const D = 86_400_000;

export default async function clientsPage(root, ctx) {
  if (ctx.params.id) return clientDetail(root, ctx, ctx.params.id);
  const ls = listState('clients', { filter: '', tag: '', sort: { key: 'recent', dir: 'desc' }, size: 25 });
  const st = ls.state;
  let q = '';
  let page = 1;
  let all = [];
  let context = null;
  const host = h('div');
  const strip = h('div');
  const chipsHost = h('div');
  const tagsHost = h('div');
  const count = h('span', { class: 'bz-filters-count' });

  async function load() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const [data, c2] = await Promise.all([biz.get('/clients', { sort: 'recent', limit: 2000 }), context ? Promise.resolve(context) : loadContext()]);
      context = c2;
      all = data.clients;
      paintStrip();
      page = 1;
      paint();
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  const isDrifting = (c) => c.visits > 0 && c.lastVisitAt && new Date(c.lastVisitAt).getTime() < Date.now() - 60 * D && !c.nextAt;
  const isNew = (c) => new Date(c.createdAt).getTime() >= Date.now() - 30 * D;

  function paintStrip() {
    if (!all.length) { mount(strip); return; }
    const fresh = all.filter(isNew).length;
    const returning = all.filter((c) => c.visits >= 2).length;
    const once = all.filter((c) => c.visits === 1).length;
    const never = all.length - returning - once;
    const withVisits = all.filter((c) => c.visits > 0);
    const avg = withVisits.length ? withVisits.reduce((s, c) => s + Number(c.totalSpent || 0), 0) / withVisits.length : null;
    const lost = all.filter(isDrifting).length;
    mount(strip, h('div', { class: 'bz-kpis', style: { marginBottom: '14px' } },
      h('div', { class: 'bz-kpi bz-kpi-donut' },
        donut({ parts: [{ name: t('დაბრუნებული', 'Returning'), value: returning, color: 'var(--c1)' }, { name: t('ერთხელ', 'Once'), value: once, color: 'var(--c2)' }, { name: t('ჯერ არ მოსულა', 'Not yet'), value: never, color: 'var(--bg3)' }], size: 64, stroke: 9 }),
        h('div', null, h('div', { class: 'stat-label' }, t('დაბრუნებული', 'Returning')), h('div', { class: 'stat-value' }, `${Math.round((returning / all.length) * 100)}%`), h('div', { class: 'stat-delta' }, t(`${returning} მეორედაც მოვიდა · ${once} ერთხელ`, `${returning} came back · ${once} once`)))),
      h('div', { class: 'bz-kpi' }, h('div', { class: 'stat-label' }, t('ახალი · 30 დღე', 'New · 30 days')), h('div', { class: 'stat-value' }, String(fresh)), h('div', { class: 'stat-delta' }, t(`სულ ${all.length}`, `${all.length} in all`))),
      h('div', { class: 'bz-kpi is-accent' }, h('div', { class: 'stat-label' }, t('საშუალო ხარჯი', 'Average spend')), h('div', { class: 'stat-value' }, avg == null ? '—' : gel(avg)), h('div', { class: 'stat-delta' }, t('ერთ კლიენტზე, ყველა ვიზიტით', 'per client, all visits'))),
      h('div', { class: 'bz-kpi' }, h('div', { class: 'stat-label' }, t('დაკარგვის რისკი', 'Drifting away')), h('div', { class: 'stat-value' }, String(lost)), h('div', { class: 'stat-delta' }, t('60+ დღე არ ყოფილა და ჯავშანი არ აქვს', 'no visit in 60+ days, nothing booked')))));
  }

  function paint() {
    const term = q.trim().toLowerCase();
    const tagCounts = new Map();
    for (const c of all) for (const tag of c.tags || []) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    mount(chipsHost, chips([
      ['', t('ყველა', 'All'), all.length],
      ['app', t('აპის მომხმარებელი', 'App users'), all.filter((c) => c.inApp).length],
      ['manual', t('ხელით დამატებული', 'Added by hand'), all.filter((c) => !c.inApp).length],
      ['new', t('ახალი · 30 დღე', 'New · 30 days'), all.filter(isNew).length],
      ['upcoming', t('მომავალი ჯავშნით', 'With a booking ahead'), all.filter((c) => c.nextAt).length],
      ['noshow', t('გაცდენებით', 'With no-shows'), all.filter((c) => c.noShows > 0).length],
      ['drifting', t('დაკარგვის რისკი', 'Drifting away'), all.filter(isDrifting).length],
    ], st.filter, (v) => { ls.set({ filter: v }); page = 1; paint(); }));
    mount(tagsHost, topTags.length ? h('div', { class: 'bz-inline', style: { gap: '6px' } }, h('span', { class: 'faint' }, t('ტეგი:', 'Tag:')), chips([['', t('ყველა', 'Any')], ...topTags.map(([tag, n]) => [tag, tag, n])], st.tag, (v) => { ls.set({ tag: v }); page = 1; paint(); })) : null);
    let rows = all.filter((c) => {
      if (st.filter === 'app' && !c.inApp) return false;
      if (st.filter === 'manual' && c.inApp) return false;
      if (st.filter === 'new' && !isNew(c)) return false;
      if (st.filter === 'upcoming' && !c.nextAt) return false;
      if (st.filter === 'noshow' && !(c.noShows > 0)) return false;
      if (st.filter === 'drifting' && !isDrifting(c)) return false;
      if (st.tag && !(c.tags || []).includes(st.tag)) return false;
      if (term && !`${c.name} ${c.phone || ''} ${c.email || ''} ${(c.tags || []).join(' ')} ${c.notes || ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
    rows = sortRows(rows, st.sort, {
      recent: (c) => c.lastVisitAt || c.createdAt,
      name: (c) => c.name,
      visits: (c) => c.visits,
      noShows: (c) => c.noShows,
      spent: (c) => Number(c.totalSpent || 0),
      last: (c) => c.lastVisitAt,
      next: (c) => c.nextAt,
    });
    count.textContent = t(`${rows.length} კლიენტი`, `${rows.length} ${rows.length === 1 ? 'client' : 'clients'}`);
    if (!all.length) { mount(host, card(emptyBox(t('კლიენტები ჯერ არ არის', 'No clients yet'), t('პირველი ჯავშნით ბაზა თავისით იწყება; ვიზიტორს ხელითაც დაამატებ.', 'The book starts by itself with the first booking; add a walk-in by hand too.')))); return; }
    if (!rows.length) { mount(host, card(emptyBox(t('ვერაფერი მოიძებნა', 'Nothing found'), t('შეცვალე ფილტრი ან ძებნა.', 'Change the filter or the search.')))); return; }
    const pg = paginate(rows, page, st.size);
    const columns = [
      { key: 'name', label: t('კლიენტი', 'Client'), dir: 'asc' }, { label: t('ტელეფონი', 'Phone') }, { key: 'visits', label: t('ვიზიტი', 'Visits'), class: 'num' }, { key: 'noShows', label: t('გაცდენა', 'No-shows'), class: 'num' },
      { key: 'spent', label: t('თანხა', 'Spent'), class: 'num' }, { key: 'last', label: t('ბოლო ვიზიტი', 'Last visit') }, { key: 'next', label: t('შემდეგი', 'Next') }, { label: '' },
    ];
    mount(host,
      card({ class: 'flush' },
        h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table bz-table-rows' },
          sortableHead(columns, st.sort, (sort) => { ls.set({ sort }); paint(); }),
          h('tbody', null, pg.rows.map((c) => h('tr', { class: 'is-link', onClick: () => ctx.navigate(`/clients/${c.id}`) },
            h('td', null, h('div', { class: 'bz-inline' }, avatar(c.name, c.inApp ? 'var(--book-2)' : 'var(--bg3)', 32),
              h('div', { class: 'bz-cell-main' }, h('b', null, c.name, c.inApp ? h('span', { class: 'bz-tag bz-tag-app', title: t('MEDICARD აპის მომხმარებელი', 'MEDICARD app user') }, t('აპი', 'App')) : null),
                c.tags.length ? h('div', { class: 'bz-tags', style: { marginTop: '3px' } }, c.tags.map((tag) => h('span', { class: 'bz-tag' }, tag))) : c.notes ? h('div', { class: 'faint', title: c.notes }, c.notes.length > 40 ? `${c.notes.slice(0, 40)}…` : c.notes) : null))),
            h('td', null, c.phone ? h('a', { class: 'bz-link', href: `tel:${c.phone}`, onClick: (e) => e.stopPropagation() }, phoneText(c.phone)) : h('span', { class: 'bz-dim' }, '—')),
            h('td', { class: 'num' }, String(c.visits)),
            h('td', { class: `num${c.noShows ? ' bz-bad' : ''}` }, String(c.noShows)),
            h('td', { class: 'num' }, c.totalSpent ? gel(c.totalSpent) : h('span', { class: 'bz-dim' }, '—')),
            h('td', null, c.lastVisitAt ? dateText(c.lastVisitAt) : h('span', { class: 'bz-dim' }, '—')),
            h('td', null, c.nextAt ? h('span', { class: 'bz-next' }, when(c.nextAt)) : h('span', { class: 'bz-dim' }, '—')),
            h('td', { class: 'num' }, h('div', { class: 'bz-row-actions' },
              button('', { variant: 'ghost', size: 'sm', icon: 'plus', ariaLabel: t('ახალი ჩანაწერი', 'New booking'), title: t('ახალი ჩანაწერი', 'New booking'), class: 'bz-row-act', onClick: (e) => { e.stopPropagation(); newAppointmentDialog(context, { clientId: c.id, clientName: c.name, clientPhone: c.phone || '' }, { onCreated: load }); } }),
              button('', { variant: 'ghost', size: 'sm', icon: 'edit', ariaLabel: t('რედაქტირება', 'Edit'), title: t('რედაქტირება', 'Edit'), class: 'bz-row-act', onClick: (e) => { e.stopPropagation(); clientDialog(c, load); } })))))))),
        pager({ ...pg, size: st.size, onPage: (p) => { page = p; paint(); host.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, onSize: (n) => { ls.set({ size: n }); page = 1; paint(); } })));
  }

  const search = input({ type: 'search', placeholder: t('სახელი, ტელეფონი, ტეგი, შენიშვნა…', 'Name, phone, tag, note…'), class: 'input bz-search' });
  search.addEventListener('input', debounceFn(() => { q = search.value; page = 1; paint(); }, 200));
  mount(root,
    pageHead(t('კლიენტები', 'Clients'), t('ყველა, ვინც ოდესმე ჯავშნით ან ხელით ჩაიწერა — ისტორია, შენიშვნები, ტეგები.', 'Everyone who ever booked or was written in by hand — history, notes, tags.'),
      button(t('კლიენტის დამატება', 'Add a client'), { icon: 'userPlus', onClick: () => clientDialog(null, load) })),
    strip,
    filterBar(
      h('div', { class: 'bz-filters-row' }, search,
        select([{ value: 'recent', label: t('ბოლო აქტივობით', 'Most recent') }, { value: 'name', label: t('სახელით', 'By name') }, { value: 'visits', label: t('ვიზიტებით', 'By visits') }, { value: 'spent', label: t('თანხით', 'By spending') }, { value: 'next', label: t('შემდეგი ვიზიტით', 'By next visit') }], st.sort.key, { onChange: (e) => { ls.set({ sort: { key: e.target.value, dir: e.target.value === 'name' ? 'asc' : 'desc' } }); page = 1; paint(); }, style: { maxWidth: '200px' } }),
        h('span', { class: 'spacer' }), count),
      chipsHost, tagsHost),
    host);
  await load();
}

function clientDialog(client, onSaved) {
  const name = input({ value: client?.name || '', required: true, placeholder: t('სახელი გვარი', 'Full name') });
  const phone = input({ type: 'tel', value: client?.phone || '', placeholder: '5XX XXX XXX' });
  const email = input({ type: 'email', value: client?.email || '' });
  const notes = textarea({ rows: 3, value: client?.notes || '', placeholder: t('ალერგია, სურვილები, რა მოსწონს…', 'Preferences, what they like, what to remember…') });
  const tags = input({ value: (client?.tags || []).join(', '), placeholder: t('VIP, ახალი, მეგობრის რეკომენდაცია… (მძიმით)', 'VIP, new, referred… (comma-separated)') });
  const save = button(t('შენახვა', 'Save'));
  const m = openModal({
    title: client ? t('კლიენტის რედაქტირება', 'Edit client') : t('ახალი კლიენტი', 'New client'),
    body: h('div', { class: 'form' }, field(t('სახელი', 'Name'), name), h('div', { class: 'form-row' }, field(t('ტელეფონი', 'Phone'), phone), field(t('ელ-ფოსტა', 'Email'), email)), field(t('შენიშვნები', 'Notes'), notes), field(t('ტეგები', 'Tags'), tags)),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
  });
  save.addEventListener('click', () => busy(save, async () => {
    try {
      const body = { name: name.value.trim(), phone: phone.value.trim() || null, email: email.value.trim() || null, notes: notes.value.trim() || null, tags: tags.value.split(',').map((s) => s.trim()).filter(Boolean) };
      const res = client ? await biz.patch(`/clients/${client.id}`, body) : await biz.post('/clients', body);
      m.close();
      ok(t('შენახულია', 'Saved'));
      onSaved?.(res.client);
    } catch (e) { fail(e); }
  }));
}

async function clientDetail(root, ctx, id) {
  const context = await loadContext();
  let data;
  try { data = await biz.get(`/clients/${id}`); } catch (e) { mount(root, card(emptyBox(t('კლიენტი ვერ მოიძებნა', 'Client not found'), e?.message))); return; }
  const reload = () => clientDetail(root, ctx, id);
  const c = data.client;
  const upcoming = data.appointments.filter((a) => (a.status === 'PENDING' || a.status === 'CONFIRMED') && new Date(a.endsAt) > new Date());
  const history = data.appointments.filter((a) => !upcoming.includes(a));
  const notes = textarea({ rows: 4, value: c.notes || '', placeholder: t('შენიშვნები — მხოლოდ გუნდი ხედავს', 'Notes — only the team sees them') });
  const saved = h('span', { class: 'bz-note' }, t('ინახება თავისით.', 'Saves by itself.'));
  notes.addEventListener('input', debounceFn(async () => { try { await biz.patch(`/clients/${id}`, { notes: notes.value }); saved.textContent = t('შენახულია ✓', 'Saved ✓'); setTimeout(() => { saved.textContent = t('ინახება თავისით.', 'Saves by itself.'); }, 1500); } catch (e) { fail(e); } }, 700));
  const favService = (() => { const m = new Map(); for (const a of data.appointments) if (a.status === 'COMPLETED') m.set(a.serviceName, (m.get(a.serviceName) || 0) + 1); return [...m.entries()].sort((x, y) => y[1] - x[1])[0] || null; })();
  const favStaff = (() => { const m = new Map(); for (const a of data.appointments) if (a.status === 'COMPLETED' && a.staffName) m.set(a.staffName, (m.get(a.staffName) || 0) + 1); return [...m.entries()].sort((x, y) => y[1] - x[1])[0] || null; })();

  mount(root,
    h('a', { class: 'back', href: '/business/clients', 'data-link': '' }, icon('chevronLeft', { size: 16 }), t('კლიენტები', 'Clients')),
    pageHead(c.name, [c.phone ? phoneText(c.phone) : null, c.email, c.inApp ? t('MEDICARD აპის მომხმარებელი', 'MEDICARD app user') : t('ხელით დამატებული', 'Added by hand'), t(`ბაზაში ${dateText(c.createdAt)}-დან`, `in the book since ${dateText(c.createdAt)}`)].filter(Boolean).join(' · '),
      c.phone ? button(t('დარეკვა', 'Call'), { variant: 'ghost', icon: 'phone', href: `tel:${c.phone}`, external: true }) : null,
      button(t('რედაქტირება', 'Edit'), { variant: 'ghost', icon: 'edit', onClick: () => clientDialog(c, reload) }),
      button(t('ახალი ჩანაწერი', 'New booking'), { icon: 'plus', onClick: () => newAppointmentDialog(context, { clientId: c.id, clientName: c.name, clientPhone: c.phone || '' }, { onCreated: reload }) })),
    h('div', { class: 'bz-kpis' },
      kpi(t('ვიზიტები', 'Visits'), String(c.visits), favService ? t(`ყველაზე ხშირად: ${favService[0]}`, `most often: ${favService[0]}`) : ''),
      kpi(t('გაცდენები', 'No-shows'), String(c.noShows), c.visits ? t(`${Math.round((c.noShows / (c.visits + c.noShows)) * 100)}% ვიზიტებიდან`, `${Math.round((c.noShows / (c.visits + c.noShows)) * 100)}% of visits`) : ''),
      kpi(t('სულ თანხა', 'Total spent'), gel(c.totalSpent), c.visits ? t(`საშ. ${gel(c.totalSpent / c.visits)} ვიზიტზე`, `avg ${gel(c.totalSpent / c.visits)} a visit`) : '', true),
      kpi(t('პირველი ვიზიტი', 'First visit'), c.firstVisitAt ? dateText(c.firstVisitAt) : '—', favStaff ? t(`ჩვეულებრივ: ${favStaff[0]}`, `usually with ${favStaff[0]}`) : '')),
    h('div', { class: 'bz-grid' },
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        upcoming.length ? card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('მომავალი', 'Upcoming')), h('div', { class: 'bz-timeline' }, upcoming.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: reload }) })))) : null,
        card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('ისტორია', 'History')), h('span', { class: 'bz-sub' }, t(`${history.length} ჩანაწერი`, `${history.length} entries`))),
          history.length ? h('div', { class: 'bz-timeline' }, history.slice(0, 30).map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: reload }) }))) : h('p', { class: 'bz-sub' }, t('ჯერ ვიზიტი არ ყოფილა.', 'No visits yet.')),
          history.length > 30 ? h('p', { class: 'bz-note', style: { marginTop: '8px' } }, t(`ბოლო 30 ჩანს; სულ ${history.length}.`, `The last 30 are shown; ${history.length} in all.`)) : null)),
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        loyaltyCard(c, reload),
        card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('შენიშვნები', 'Notes')), notes, h('p', { style: { marginTop: '6px' } }, saved)),
        card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('ტეგები', 'Tags')), c.tags.length ? h('div', { class: 'bz-tags' }, c.tags.map((tag) => h('span', { class: 'bz-tag' }, tag))) : h('p', { class: 'bz-sub' }, t('ტეგები რედაქტირებით დაემატება.', 'Add tags through Edit.'))),
        data.reviews.length ? card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('შეფასებები', 'Reviews')), data.reviews.map((r) => h('div', { class: 'bz-review' }, h('div', { class: 'meta' }, h('span', { class: 'bz-stars' }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= r.rating ? '' : 'off' }, icon('star', { size: 13 })))), dateText(r.createdAt)), r.text ? h('div', null, r.text) : null))) : null)));
}

/** Bonus balance with a correction, the passes the client holds, gift cards they bought. Loads by itself. */
function loyaltyCard(c, reload) {
  const host = card(h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' })));
  biz.get(`/clients/${c.id}/loyalty`).then((L) => {
    const live = L.memberships.filter((m) => m.status === 'ACTIVE');
    mount(host,
      h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('ლოიალობა', 'Loyalty')),
        button(t('კორექცია', 'Adjust'), { size: 'sm', variant: 'ghost', icon: 'edit', onClick: () => {
          const amount = input({ type: 'number', step: '0.5', placeholder: t('+10 ან −5', '+10 or −5') });
          const note = input({ placeholder: t('მიზეზი', 'Reason') });
          const save = button(t('შენახვა', 'Save'));
          const m = openModal({ title: t('ბონუსის კორექცია', 'Adjust bonus'), size: 'sm', body: h('div', { class: 'form' }, h('p', { class: 'muted' }, t(`ახლა: ${gel(L.bonusBalance)}`, `Now: ${gel(L.bonusBalance)}`)), field(t('თანხა, ₾ (მინუსით — ჩამოჭრა)', 'Amount, ₾ (negative takes away)'), amount), field(t('მიზეზი', 'Reason'), note)), footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save] });
          save.addEventListener('click', () => busy(save, async () => { try { await biz.post(`/clients/${c.id}/bonus`, { amount: Number(amount.value), note: note.value.trim() || undefined }); m.close(); ok(t('შენახულია', 'Saved')); reload(); } catch (e) { fail(e); } }));
        } })),
      h('div', { class: 'bz-kv', style: { gridTemplateColumns: '1fr auto' } },
        h('dt', null, t('ბონუსი', 'Bonus')), h('dd', null, h('b', null, gel(L.bonusBalance))),
        h('dt', null, t('აბონემენტები', 'Memberships')), h('dd', null, live.length ? live.map((m) => h('div', null, `${m.title} · ${m.kind === 'VISITS' ? t(`დარჩა ${m.visitsLeft}`, `${m.visitsLeft} left`) : gel(m.amountLeft)} · ${dateText(m.endsOn)}`)) : h('span', { class: 'bz-dim' }, '—')),
        L.giftCards.length ? [h('dt', null, t('ბარათები', 'Gift cards')), h('dd', null, L.giftCards.slice(0, 5).map((g) => h('div', null, h('code', null, g.code), ` · ${gel(g.balance)} / ${gel(g.amount)}`)))] : null),
      L.ledger.length ? h('div', { class: 'bz-note', style: { marginTop: '8px' } }, t(`ბოლო: ${L.ledger[0].kind === 'BONUS_EARN' ? 'დაერიცხა' : L.ledger[0].kind === 'BONUS_REDEEM' ? 'დახარჯა' : 'მოძრაობა'} ${gel(Math.abs(L.ledger[0].amount))} · ${dateText(L.ledger[0].createdAt)}`, `Last: ${L.ledger[0].kind.toLowerCase().replace('_', ' ')} ${gel(Math.abs(L.ledger[0].amount))} · ${dateText(L.ledger[0].createdAt)}`)) : null);
  }).catch((e) => mount(host, h('div', { class: 'card-title' }, t('ლოიალობა', 'Loyalty')), h('p', { class: 'bz-sub' }, e?.message || '')));
  return host;
}

function kpi(label, value, delta, accent = false) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}

export { badge, statusBadge, minutes };
