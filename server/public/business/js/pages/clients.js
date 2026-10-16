// MEDIBOOK business panel — the client book: the book in numbers, filters, a sortable table 25 a page,
// one client's card with history, notes and tags.
import { h, mount, icon, button, pageHead, card, input, badge } from '/app/js/ui.js';
import { select } from '../fields.js';
import { donut } from '/app/js/charts.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, when, dateText, avatar, emptyBox, debounceFn, fail, ok, statusBadge, minutes, phoneText, vocab } from '../shared.js';
import { appointmentLine, loadContext, newAppointmentDialog, openAppointment } from '../appointment.js';
import { chips, filterBar, listState, pager, paginate, sortRows, sortableHead } from '../lists.js';
import { clientCard, clientDialog } from '../client-card.js';

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
    pageHead(vocab('clients'), t('ყველა, ვინც ოდესმე ჯავშნით ან ხელით ჩაიწერა — ისტორია, შენიშვნები, ტეგები.', 'Everyone who ever booked or was written in by hand — history, notes, tags.'),
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

/** The card itself lives in client-card.js (header, six numbers, tabs); the list page only routes to it. */
async function clientDetail(root, ctx, id) { return clientCard(root, ctx, id); }

function kpi(label, value, delta, accent = false) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}

export { badge, statusBadge, minutes, clientDialog };
