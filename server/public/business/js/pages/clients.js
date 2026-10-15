// MEDIBOOK business panel — the client book: list with search and sort, one client's card with history.
import { h, mount, icon, button, pageHead, card, input, select, textarea, field, busy, openModal, badge } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, when, dateText, avatar, emptyBox, debounceFn, fail, ok, statusBadge, minutes } from '../shared.js';
import { appointmentLine, loadContext, newAppointmentDialog, openAppointment } from '../appointment.js';

export default async function clientsPage(root, ctx) {
  if (ctx.params.id) return clientDetail(root, ctx, ctx.params.id);
  let q = '';
  let sort = 'recent';
  const host = h('div');
  const total = h('span', { class: 'bz-sub' });

  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const data = await biz.get('/clients', { q: q || undefined, sort, limit: 300 });
      total.textContent = t(`${data.total} კლიენტი`, `${data.total} clients`);
      if (!data.clients.length) { mount(host, card(emptyBox(q ? t('ვერაფერი მოიძებნა', 'Nothing found') : t('კლიენტები ჯერ არ არის', 'No clients yet'), t('პირველი ჯავშნით ბაზა თავისით იწყება; ვიზიტორს ხელითაც დაამატებ.', 'The book starts by itself with the first booking; add a walk-in by hand too.')))); return; }
      mount(host, card({ class: 'flush' }, h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' },
        h('thead', null, h('tr', null, h('th', null, t('კლიენტი', 'Client')), h('th', null, t('ტელეფონი', 'Phone')), h('th', { class: 'num' }, t('ვიზიტი', 'Visits')), h('th', { class: 'num' }, t('გაცდენა', 'No-shows')), h('th', { class: 'num' }, t('თანხა', 'Spent')), h('th', null, t('ბოლო ვიზიტი', 'Last visit')), h('th', null, t('შემდეგი', 'Next')))),
        h('tbody', null, data.clients.map((c) => h('tr', { class: 'is-link', onClick: () => ctx.navigate(`/clients/${c.id}`) },
          h('td', null, h('div', { class: 'bz-inline' }, avatar(c.name, c.inApp ? '#A21CAF' : '#64748B', 30), h('div', null, h('b', null, c.name), c.inApp ? h('span', { class: 'badge badge-brand', style: { marginLeft: '6px' } }, t('აპი', 'App')) : null, c.tags.length ? h('div', { class: 'bz-tags', style: { marginTop: '2px' } }, c.tags.map((tag) => h('span', { class: 'bz-tag' }, tag))) : null))),
          h('td', null, c.phone || h('span', { class: 'bz-dim' }, '—')),
          h('td', { class: 'num' }, String(c.visits)),
          h('td', { class: `num${c.noShows ? ' bz-bad' : ''}` }, String(c.noShows)),
          h('td', { class: 'num' }, gel(c.totalSpent)),
          h('td', null, c.lastVisitAt ? dateText(c.lastVisitAt) : h('span', { class: 'bz-dim' }, '—')),
          h('td', null, c.nextAt ? when(c.nextAt) : h('span', { class: 'bz-dim' }, '—')))))))));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  const search = input({ type: 'search', placeholder: t('სახელი, ტელეფონი, ტეგი…', 'Name, phone, tag…') });
  search.addEventListener('input', debounceFn(() => { q = search.value.trim(); paint(); }, 250));
  mount(root,
    pageHead(t('კლიენტები', 'Clients'), t('ყველა, ვინც ოდესმე ჯავშნით ან ხელით ჩაიწერა — ისტორია, შენიშვნები, ტეგები.', 'Everyone who ever booked or was written in by hand — history, notes, tags.'),
      button(t('კლიენტის დამატება', 'Add a client'), { icon: 'userPlus', onClick: () => clientDialog(null, () => paint()) })),
    h('div', { class: 'bz-toolbar' }, search,
      select([{ value: 'recent', label: t('ბოლო აქტივობით', 'Most recent') }, { value: 'name', label: t('სახელით', 'By name') }, { value: 'visits', label: t('ვიზიტებით', 'By visits') }, { value: 'spent', label: t('თანხით', 'By spending') }], sort, { onChange: (e) => { sort = e.target.value; paint(); }, style: { maxWidth: '200px' } }),
      h('span', { class: 'spacer' }), total),
    host);
  await paint();
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
  notes.addEventListener('input', debounceFn(async () => { try { await biz.patch(`/clients/${id}`, { notes: notes.value }); } catch (e) { fail(e); } }, 700));

  mount(root,
    h('a', { class: 'back', href: '/business/clients', 'data-link': '' }, icon('chevronLeft', { size: 16 }), t('კლიენტები', 'Clients')),
    pageHead(c.name, [c.phone, c.email, c.inApp ? t('MEDICARD აპის მომხმარებელი', 'MEDICARD app user') : t('ხელით დამატებული', 'Added by hand')].filter(Boolean).join(' · '),
      button(t('რედაქტირება', 'Edit'), { variant: 'ghost', icon: 'edit', onClick: () => clientDialog(c, reload) }),
      button(t('ახალი ჩანაწერი', 'New booking'), { icon: 'plus', onClick: () => newAppointmentDialog(context, { clientId: c.id, clientName: c.name, clientPhone: c.phone || '' }, { onCreated: reload }) })),
    h('div', { class: 'bz-kpis' },
      kpi(t('ვიზიტები', 'Visits'), String(c.visits)), kpi(t('გაცდენები', 'No-shows'), String(c.noShows)), kpi(t('სულ თანხა', 'Total spent'), gel(c.totalSpent)), kpi(t('პირველი ვიზიტი', 'First visit'), c.firstVisitAt ? dateText(c.firstVisitAt) : '—')),
    h('div', { class: 'bz-grid' },
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        upcoming.length ? card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('მომავალი', 'Upcoming')), h('div', { class: 'bz-timeline' }, upcoming.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: reload }) })))) : null,
        card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('ისტორია', 'History')),
          history.length ? h('div', { class: 'bz-timeline' }, history.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: reload }) }))) : h('p', { class: 'bz-sub' }, t('ჯერ ვიზიტი არ ყოფილა.', 'No visits yet.')))),
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('შენიშვნები', 'Notes')), notes, h('p', { class: 'bz-note', style: { marginTop: '6px' } }, t('ინახება თავისით.', 'Saves by itself.'))),
        card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('ტეგები', 'Tags')), c.tags.length ? h('div', { class: 'bz-tags' }, c.tags.map((tag) => h('span', { class: 'bz-tag' }, tag))) : h('p', { class: 'bz-sub' }, t('ტეგები რედაქტირებით დაემატება.', 'Add tags through Edit.'))),
        data.reviews.length ? card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('შეფასებები', 'Reviews')), data.reviews.map((r) => h('div', { class: 'bz-review' }, h('div', { class: 'meta' }, h('span', { class: 'bz-stars' }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= r.rating ? '' : 'off' }, icon('star', { size: 13 })))), dateText(r.createdAt)), r.text ? h('div', null, r.text) : null))) : null)));
}

function kpi(label, value) {
  return h('div', { class: 'bz-kpi' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value));
}

export { badge, statusBadge, minutes };
