// MEDIBOOK business panel — analytics: bookings, revenue, utilisation per person, funnel, busy hours, top services, clients.
import { h, mount, icon, segmented, pageHead, card } from '/app/js/ui.js';
import { barChart, lineChart, donut } from '/app/js/charts.js';
import { t } from '/app/js/i18n.js';
import { biz, gel, pct, minutes, avatar, emptyBox, WEEKDAYS_SHORT, MONTHS_SHORT } from '../shared.js';

export default async function analyticsPage(root, ctx) {
  let range = ctx.query.range || '30';
  const host = h('div');
  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const a = await biz.get('/analytics', { range });
      const labels = a.series.map((d) => { const [, m, dd] = d.date.split('-'); return `${Number(dd)} ${MONTHS_SHORT[Number(m) - 1]}`; });
      const T = a.totals;
      mount(host,
        h('div', { class: 'bz-kpis' },
          kpi(t('ჯავშნები', 'Bookings'), String(T.bookings), t(`${T.completed} დასრულდა · ${T.cancelled} გაუქმდა`, `${T.completed} completed · ${T.cancelled} cancelled`)),
          kpi(t('დატვირთვა (მარგი ქმედების კოეფ.)', 'Utilisation'), T.utilisation == null ? '—' : pct(T.utilisation), t(`${minutes(T.bookedMinutes)} / ${minutes(T.workingMinutes)} სამუშაო დროიდან`, `${minutes(T.bookedMinutes)} of ${minutes(T.workingMinutes)} working time`), true),
          kpi(t('გაცდენის მაჩვენებელი', 'No-show rate'), pct(T.noShowRate), t(`${T.noShow} არ მოვიდა`, `${T.noShow} no-shows`)),
          kpi(t('შემოსავალი', 'Revenue'), gel(T.revenue), T.averageTicket != null ? t(`საშ. ჩეკი ${gel(T.averageTicket)}`, `avg ticket ${gel(T.averageTicket)}`) : '')),
        h('div', { class: 'bz-grid' },
          card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('ჯავშნები დღეების მიხედვით', 'Bookings by day'))),
            a.series.some((d) => d.bookings) ? barChart({ labels, height: 220, stacked: [{ name: t('დასრულებული', 'Completed'), values: a.series.map((d) => d.completed), color: 'var(--c1)' }, { name: t('სხვა', 'Other'), values: a.series.map((d) => d.bookings - d.completed), color: 'var(--c2)' }, { name: t('არ მოვიდა', 'No-show'), values: a.series.map((d) => d.noShow), color: 'var(--c3)' }] }) : emptyBox(t('ჯავშნები ჯერ არ არის', 'No bookings yet'), t('პირველი ჩანაწერებით გრაფიკი ივსება.', 'The chart fills with the first bookings.'))),
          card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('აპიდან ჯავშნამდე', 'From the app to a booking'))),
            h('div', { class: 'bz-funnel' },
              f(a.funnel.views, t('გვერდი გაიხსნა', 'Page views')), f(a.funnel.viewers, t('უნიკალური', 'Unique viewers')), f(a.funnel.calls, t('დარეკვა', 'Calls')), f(a.funnel.routes, t('მარშრუტი', 'Routes')),
              f(a.funnel.favorites, t('შეინახა', 'Saved')), f(a.funnel.bookingStarted, t('ჯავშანი დაიწყო', 'Booking started')), f(a.funnel.booked, t('დაჯავშნა', 'Booked')), f(pct(a.funnel.conversion), t('კონვერსია', 'Conversion'))),
            h('p', { class: 'bz-note', style: { marginTop: '10px' } }, t('კონვერსია = ჯავშნები აპიდან / უნიკალური მნახველები.', 'Conversion = bookings from the app ÷ unique viewers.')))),
        h('div', { class: 'bz-grid' },
          card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('შემოსავალი დღეების მიხედვით', 'Revenue by day')), h('div', { class: 'card-sub' }, t('დასრულებული ვიზიტებიდან, გადახდის დღით', 'From completed visits, by the day they were paid')))),
            a.series.some((d) => d.revenue) ? lineChart({ labels, height: 200, series: [{ name: t('შემოსავალი', 'Revenue'), values: a.series.map((d) => d.revenue), color: 'var(--c1)', area: true }], fmt: (v) => gel(v) }) : emptyBox(t('შემოსავალი ჯერ არ არის', 'No revenue yet'), t('დასრულებული ვიზიტი თავისით იწერება.', 'A completed visit writes itself in.'))),
          card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('სერვისების წილი', 'Share of services')), h('div', { class: 'card-sub' }, t('შემოსავლით, ამ პერიოდში', 'By revenue, in this period')))),
            a.topServices.length ? (() => {
              const top = a.topServices.slice(0, 5);
              const rest = a.topServices.slice(5).reduce((s2, x) => s2 + x.revenue, 0);
              const parts = [...top.map((x, i) => ({ name: x.name, value: x.revenue, color: `var(--c${(i % 6) + 1})` })), ...(rest ? [{ name: t('სხვა', 'Other'), value: rest, color: 'var(--bg3)' }] : [])];
              const sum = parts.reduce((s2, p) => s2 + p.value, 0) || 1;
              return h('div', { class: 'bz-inline', style: { gap: '18px', alignItems: 'center' } }, donut({ parts, size: 120, stroke: 16 }),
                h('div', { class: 'bz-src-legend' }, parts.map((p) => h('div', { class: 'row' }, h('i', { style: { background: p.color } }), h('span', null, p.name), h('b', null, gel(p.value)), h('small', null, `${Math.round((p.value / sum) * 100)}%`)))));
            })() : h('p', { class: 'bz-sub' }, '—'))),
        h('div', { class: 'bz-grid' },
          card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('დატვირთვა თანამშრომლებით', 'Utilisation per person')), h('div', { class: 'card-sub' }, t('დაჯავშნილი დრო ÷ სამუშაო დრო (გასულ საათებზე).', 'Booked time ÷ working time (hours that have passed).')))),
            a.utilisation.length ? h('div', { class: 'bz-util' }, a.utilisation.map((u) => h('div', { class: 'bz-util-row' }, avatar(u.name, u.color || 'var(--book)', 34),
              h('div', null, h('b', null, u.name), h('small', null, t(`${u.appointments} ჩანაწერი · ${u.completed} დასრულდა · ${u.noShow} არ მოვიდა · ${gel(u.revenue)}`, `${u.appointments} bookings · ${u.completed} done · ${u.noShow} no-shows · ${gel(u.revenue)}`)), h('div', { class: 'meter-track' }, h('span', { style: { width: `${u.utilisation ?? 0}%`, background: u.color || 'var(--book)' } }))),
              h('b', { class: 'pct' }, u.utilisation == null ? '—' : pct(u.utilisation))))) : h('p', { class: 'bz-sub' }, t('გუნდი ჯერ არ არის.', 'No team yet.'))),
          card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('პიკური საათები', 'Busy hours')), h('div', { class: 'card-sub' }, a.peak ? t(`ყველაზე დატვირთული: ${WEEKDAYS_SHORT[a.peak.weekday]} ${String(a.peak.hour).padStart(2, '0')}:00`, `Busiest: ${WEEKDAYS_SHORT[a.peak.weekday]} ${String(a.peak.hour).padStart(2, '0')}:00`) : t('ჯერ არ ჩანს', 'Not visible yet')))),
            heat(a.heat))),
        h('div', { class: 'bz-grid-3' },
          card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('ტოპ სერვისები', 'Top services')),
            a.topServices.length ? h('table', { class: 'bz-table' }, h('tbody', null, a.topServices.slice(0, 8).map((s) => h('tr', null, h('td', null, h('b', null, s.name), h('div', { class: 'faint' }, minutes(s.minutes))), h('td', { class: 'num' }, String(s.count)), h('td', { class: 'num' }, gel(s.revenue)))))) : h('p', { class: 'bz-sub' }, '—')),
          card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('კლიენტები', 'Clients')),
            a.clients.active ? h('div', { class: 'bz-inline', style: { gap: '18px' } }, donut({ parts: [{ name: t('ახალი', 'New'), value: a.clients.new, color: 'var(--c1)' }, { name: t('დაბრუნებული', 'Returning'), value: a.clients.returning, color: 'var(--c2)' }], size: 110, stroke: 14 }),
              h('div', { style: { fontSize: '13.5px' } }, h('div', null, h('span', { class: 'bz-color-dot', style: { background: 'var(--c1)' } }), ` ${t('ახალი', 'New')}: ${a.clients.new}`), h('div', null, h('span', { class: 'bz-color-dot', style: { background: 'var(--c2)' } }), ` ${t('დაბრუნებული', 'Returning')}: ${a.clients.returning}`), h('div', { class: 'faint', style: { marginTop: '6px' } }, t(`სულ ${a.clients.total} · მეორედ მოვიდა ${pct(a.clients.repeatShare)}`, `Total ${a.clients.total} · came back ${pct(a.clients.repeatShare)}`)))) : h('p', { class: 'bz-sub' }, '—')),
          card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('წყარო და შეფასებები', 'Sources and ratings')),
            h('div', { style: { fontSize: '13.5px', display: 'grid', gap: '4px' } },
              h('div', null, `${t('აპიდან', 'From the app')}: ${a.sources.APP || 0}`), h('div', null, `${t('ვებიდან', 'From the web')}: ${a.sources.WEB || 0}`), h('div', null, `${t('ხელით', 'Walk-ins')}: ${a.sources.BUSINESS || 0}`),
              h('div', { style: { marginTop: '8px' } }, h('b', null, a.reviews.businessAvg != null ? a.reviews.businessAvg.toFixed(1) : '—'), ' ', h('span', { class: 'faint' }, t(`საშუალო · ${a.reviews.businessCount} შეფასება`, `average · ${a.reviews.businessCount} reviews`))),
              h('div', { class: 'bz-inline', style: { gap: '4px' } }, [5, 4, 3, 2, 1].map((r) => h('span', { class: 'bz-tag' }, `${r}★ ${a.reviews.dist[r - 1]}`)))))));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }
  mount(root,
    pageHead(t('ანალიტიკა', 'Analytics'), t('რამდენი ჯავშანი, რამდენად დატვირთულია თითო ადამიანი, რა საათებში მოდიან, რა ყიდვა ყველაზე მეტად.', 'How many bookings, how busy each person is, which hours people come, what sells most.')),
    h('div', { class: 'bz-toolbar' }, segmented([{ value: '7', label: t('7 დღე', '7 days') }, { value: '30', label: t('30 დღე', '30 days') }, { value: 'month', label: t('ეს თვე', 'This month') }, { value: '90', label: t('90 დღე', '90 days') }, { value: '365', label: t('წელი', 'Year') }], range, (v) => { range = v; paint(); })),
    host);
  await paint();
}

function kpi(label, value, delta, accent) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}
function f(value, label) { return h('div', null, h('b', null, String(value)), h('span', null, label)); }

/** Weekday × hour grid, 08:00–22:00, Monday first. */
function heat(matrix) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 8);
  const max = Math.max(1, ...matrix.flat());
  const rows = [1, 2, 3, 4, 5, 6, 0];
  return h('div', { class: 'bz-heat' },
    h('div'), hours.map((hh) => h('div', { class: 'lbl' }, hh % 2 === 0 ? String(hh) : '')),
    rows.flatMap((wd) => [h('div', { class: 'lbl' }, WEEKDAYS_SHORT[wd]), hours.map((hh) => { const v = matrix[wd]?.[hh] || 0; return h('div', { class: 'cell', title: `${WEEKDAYS_SHORT[wd]} ${hh}:00 — ${v}`, style: v ? { background: `color-mix(in srgb, var(--book) ${Math.round(20 + (v / max) * 80)}%, var(--bg2))` } : {} }); })]));
}

export { icon, lineChart };
