// MEDIBOOK business panel — overview: what needs attention now, today, this week, the setup checklist.
import { h, mount, icon, button, pageHead, card, badge, busy } from '/app/js/ui.js';
import { barChart, donut, ring, sparkline } from '/app/js/charts.js';
import { t } from '/app/js/i18n.js';
import { state, canManage } from '../state.js';
import { biz, gel, pct, when, clock, emptyBox, fail, ok, ymd, fromYmd, weekdayOf, dayLabel, minutes, vocab } from '../shared.js';
import { appointmentLine, loadContext, newAppointmentDialog, openAppointment } from '../appointment.js';

export default async function dashboardPage(root, ctx) {
  const business = state.current.business;
  let data;
  let detail;
  let context;
  try {
    [data, detail, context] = await Promise.all([biz.get('/overview'), biz.get(''), loadContext()]);
  } catch (e) {
    mount(root, card(h('h3', null, t('მონაცემები ვერ ჩაიტვირთა', 'Could not load')), h('p', { class: 'muted' }, e?.message || '')));
    return;
  }
  const b = detail.business;
  const reload = () => dashboardPage(root, ctx);

  const banner = b.status === 'PENDING'
    ? h('div', { class: 'bz-banner is-warn' }, icon('clock', { size: 20 }), h('p', null, h('b', null, t('ბიზნესი განიხილება', 'Your business is under review')), t('პანელი უკვე მუშაობს: დაამატე სერვისები და გუნდი. კატალოგში და აპის რუკაზე დადასტურების შემდეგ გამოჩნდება — ჩვეულებრივ 1 სამუშაო დღეში.', 'The panel already works: add services and your team. The listing and the map pin go live once approved — usually within a working day.')))
    : b.status === 'CLAIMED' && !b.settings.onlineBooking
      ? h('div', { class: 'bz-banner is-info' }, icon('info', { size: 20 }), h('p', null, h('b', null, t('ონლაინ ჯავშნა გამორთულია', 'Online booking is off')), t('კლიენტები აპში გხედავენ, მაგრამ ვერ ეწერებიან. ჩართე პარამეტრებში.', 'Clients see you in the app but cannot book. Turn it on in Settings.'), ' ', h('a', { href: '/business/settings', 'data-link': '', class: 'bz-link' }, t('პარამეტრები', 'Settings'))))
      : null;

  const checklist = [
    { done: detail.services.some((s) => s.active), title: t('სერვისები ფასით და ხანგრძლივობით', 'Services with price and duration'), sub: t('აპში სწორედ ეს ჩანს „ჩაწერა“-ს ღილაკით', 'This is what shows in the app with a Book button'), href: '/business/services' },
    { done: detail.staff.some((s) => s.active), title: t('გუნდი და სამუშაო საათები', 'Team and working hours'), sub: t('თითო ადამიანი თავისი გრაფიკით — თავისუფალი დროები მისგან ითვლება', 'Each person with their own schedule — free slots come from it'), href: '/business/team' },
    { done: Boolean(b.coverUrl || b.logoUrl || b.gallery.length), title: t('ფოტოები', 'Pictures'), sub: t('ფოტოიანი გვერდი 3-ჯერ მეტ ჯავშანს იღებს', 'A page with pictures gets three times the bookings'), href: '/business/settings' },
    { done: Boolean(b.description || b.phone), title: t('აღწერა და კონტაქტი', 'About and contact'), sub: t('ტელეფონი, ვებსაიტი, რამდენიმე წინადადება თქვენზე', 'Phone, website, a few sentences about you'), href: '/business/settings' },
    { done: b.status === 'CLAIMED', title: t('დადასტურება MEDICARD-ის მიერ', 'Verified by MEDICARD'), sub: b.status === 'CLAIMED' ? t('ჩართულია აპში', 'Live in the app') : t('განიხილება', 'Under review'), href: null },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  const todayStr = ymd();
  const days = Array.isArray(data.days) ? data.days : [];
  const pastDays = days.filter((d) => d.date <= todayStr);
  const spark = (key) => pastDays.map((d) => Number(d[key]) || 0);
  const kpis = h('div', { class: 'bz-kpis' },
    kpi(t('დღეს', 'Today'), String(data.today.filter((a) => a.status !== 'CANCELLED').length), t(`${data.today.filter((a) => a.status === 'COMPLETED').length} დასრულდა`, `${data.today.filter((a) => a.status === 'COMPLETED').length} completed`), 'calendar', false, spark('bookings')),
    kpi(t('შემოსავალი · 7 დღე', 'Revenue · 7 days'), gel(data.week.revenue), t(`${data.week.done} დასრულებული ვიზიტი`, `${data.week.done} completed visits`), 'wallet', true, spark('revenue')),
    kpi(t('ახალი ჯავშნები · 7 დღე', 'New bookings · 7 days'), String(data.week.booked), t(`${data.week.cancelled} გაუქმდა · ${data.week.noShow} არ მოვიდა`, `${data.week.cancelled} cancelled · ${data.week.noShow} no-shows`), 'calendarCheck', false, spark('created')),
    kpi(vocab('clients'), String(data.clients.total), t(`+${data.clients.new} ამ კვირაში`, `+${data.clients.new} this week`), 'users', false, spark('newClients')));

  // Three weeks of days: completed, still ahead, missed — today is the bar in the middle.
  const weeksCard = days.length ? card(
    h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('სამი კვირა', 'Three weeks')), h('div', { class: 'card-sub' }, t('ორი გასული და ერთი მომავალი: დასრულებული, მომავალი და გაცდენილი ვიზიტები', 'Two weeks back and one ahead: completed, upcoming and missed visits')))),
    days.some((d) => d.bookings) ? barChart({
      labels: days.map((d) => (d.date === todayStr ? t('დღეს', 'today') : String(Number(d.date.slice(8))))),
      tipLabels: days.map((d) => dayLabel(fromYmd(d.date), { long: true })),
      height: 170,
      stacked: [
        { name: t('დასრულებული', 'Completed'), values: days.map((d) => d.completed), color: 'var(--c1)' },
        { name: t('მომავალი', 'Upcoming'), values: days.map((d) => Math.max(0, d.bookings - d.completed - d.noShow)), color: 'var(--bg3)' },
        { name: t('არ მოვიდა', 'No-show'), values: days.map((d) => d.noShow), color: 'var(--danger)' },
      ],
    }) : emptyBox(t('ჯერ ჩანაწერი არ არის', 'No bookings yet'), t('პირველი ჯავშნებით გრაფიკი ივსება.', 'The chart fills with the first bookings.')),
    h('div', { class: 'bz-legend bz-legend-inline' },
      h('span', null, h('i', { style: { background: 'var(--c1)' } }), t('დასრულებული', 'Completed')),
      h('span', null, h('i', { style: { background: 'var(--bg3)' } }), t('მომავალი', 'Upcoming')),
      h('span', null, h('i', { style: { background: 'var(--danger)' } }), t('არ მოვიდა', 'No-show')))) : null;

  // The team's day: booked time against each person's hours today.
  const toMin = (s2) => { const [hh, mm] = String(s2).split(':').map(Number); return hh * 60 + mm; };
  const todayWd = weekdayOf(todayStr);
  const teamToday = context.staff.map((p) => {
    const own = p.schedule && Object.values(p.schedule).some((l) => Array.isArray(l) && l.length) ? (p.schedule[String(todayWd)] || []) : (b.hours?.[String(todayWd)] || []);
    const working = own.reduce((sum, r) => sum + ((r.to === '24:00' ? 1440 : toMin(r.to)) - toMin(r.from)), 0);
    const mine = data.today.filter((a) => a.staffId === p.id && a.status !== 'CANCELLED');
    const booked = mine.reduce((sum, a) => sum + Number(a.durationMin || 0), 0);
    return { p, working, booked, count: mine.length };
  }).filter((x) => x.working > 0 || x.count > 0);
  const teamCard = teamToday.length ? card(
    h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('გუნდი დღეს', 'The team today')), h('div', { class: 'card-sub' }, t('დაჯავშნილი დრო თითო ადამიანის დღევანდელ საათებთან', 'Booked time against each person\'s hours today'))), h('a', { class: 'link', href: '/business/team', 'data-link': '' }, t('გუნდი', 'Team'), icon('chevronRight', { size: 16 }))),
    h('div', { class: 'bz-team-today' }, teamToday.map((x) => h('div', { class: 'bz-team-today-item', title: x.working ? t(`${minutes(x.booked)} / ${minutes(x.working)}`, `${minutes(x.booked)} of ${minutes(x.working)}`) : '' },
      ring({ value: x.booked, max: x.working || Math.max(1, x.booked), size: 56, stroke: 6, color: x.p.color || 'var(--book)', label: x.working ? `${Math.min(100, Math.round((x.booked / x.working) * 100))}%` : '—', labelScale: 0.21 }),
      h('div', { class: 'who' }, h('b', null, x.p.name), h('span', null, x.count ? t(`${x.count} ჩანაწერი · ${minutes(x.booked)}`, `${x.count} ${x.count === 1 ? 'booking' : 'bookings'} · ${minutes(x.booked)}`) : t('ჯერ არავინ', 'Nobody yet'))))))) : null;

  const src = data.sources || {};
  const srcTotal = (src.APP || 0) + (src.WEB || 0) + (src.BUSINESS || 0);
  const sourcesBlock = srcTotal ? h('div', { class: 'bz-sources' },
    donut({ parts: [{ name: t('აპიდან', 'App'), value: src.APP || 0, color: 'var(--c1)' }, { name: t('ვებიდან', 'Web'), value: src.WEB || 0, color: 'var(--c2)' }, { name: t('ხელით', 'By hand'), value: src.BUSINESS || 0, color: 'var(--bg3)' }], size: 96, stroke: 12, center: h('div', null, h('strong', { style: { fontSize: '18px' } }, String(srcTotal)), h('span', null, t('ვიზიტი', 'visits'))) }),
    h('div', { class: 'bz-src-legend' },
      legendRow('var(--c1)', t('აპიდან', 'From the app'), src.APP || 0, srcTotal),
      legendRow('var(--c2)', t('ვებიდან', 'From the web'), src.WEB || 0, srcTotal),
      legendRow('var(--bg3)', t('ხელით', 'By hand'), src.BUSINESS || 0, srcTotal))) : null;

  const attention = [];
  if (!detail.services.some((s) => s.active) && canManage()) {
    const load = button(t('ჩატვირთვა', 'Load it'), { size: 'sm', style: { marginLeft: 'auto', flex: 'none' }, onClick: () => busy(load, async () => { try { const { added } = await biz.post('/starter-kit', {}); ok(t(`დაემატა ${added.services} სერვისი, ${added.supplies} მასალა, ${added.resources} რესურსი`, `Added ${added.services} services, ${added.supplies} supplies, ${added.resources} resources`)); reload(); } catch (e) { fail(e); } }) });
    attention.push(h('div', { class: 'bz-banner is-info', style: { margin: 0 } }, icon('sparkles', { size: 20 }), h('p', null, h('b', null, t('დაიწყე მზა ნაკრებით', 'Start with the ready-made kit')), t('სერვისები ფასებით, მასალები ნორმებით და ოთახები შენი სეგმენტისთვის — ერთი დაჭერით; მერე ყველაფერს შეცვლი.', 'Services with prices, supplies with norms and rooms for your segment — one click; change anything afterwards.')), load));
  }
  if (data.pending) attention.push(h('a', { class: 'bz-banner is-warn', href: '/business/appointments?status=PENDING', 'data-link': '', style: { margin: 0 } }, icon('bellRing', { size: 20 }), h('p', null, h('b', null, t(`${data.pending} ჯავშანი ელოდება დადასტურებას`, `${data.pending} ${data.pending === 1 ? 'booking is' : 'bookings are'} waiting for confirmation`)), t('კლიენტი ხედავს „ელოდება“-ს, სანამ არ დაადასტურებ.', 'The client sees "waiting" until you confirm.'))));
  if (data.reviews.unanswered) attention.push(h('a', { class: 'bz-banner is-info', href: '/business/reviews', 'data-link': '', style: { margin: 0 } }, icon('star', { size: 20 }), h('p', null, h('b', null, t(`${data.reviews.unanswered} შეფასება პასუხის გარეშე`, `${data.reviews.unanswered} ${data.reviews.unanswered === 1 ? 'review' : 'reviews'} without a reply`)), t('პასუხი საჯაროა და ნდობას მატებს.', 'Replies are public and build trust.'))));
  if (data.waitlist) attention.push(h('a', { class: 'bz-banner is-info', href: '/business/waitlist', 'data-link': '', style: { margin: 0 } }, icon('bellRing', { size: 20 }), h('p', null, h('b', null, t(`${data.waitlist} კლიენტი ელოდება თავისუფალ დროს`, `${data.waitlist} ${data.waitlist === 1 ? 'client is' : 'clients are'} waiting for a free time`)), t('გათავისუფლებული დრო თავისით ეთავაზება; ხელითაც შეგიძლია შესთავაზო ან პირდაპირ ჩაწერო.', 'A freed time is offered by itself; you can also offer one by hand or book them straight in.'))));
  if (data.lowStock) attention.push(h('a', { class: 'bz-banner is-warn', href: '/business/products', 'data-link': '', style: { margin: 0 } }, icon('archive', { size: 20 }), h('p', null, h('b', null, t(`${data.lowStock} პროდუქტი მარაგში იწურება`, `${data.lowStock} ${data.lowStock === 1 ? 'product is' : 'products are'} running low`)), t('შეავსე, სანამ გაყიდვა შეჩერდება.', 'Restock before a sale is refused.'))));
  if (data.birthdays?.length) attention.push(h('a', { class: 'bz-banner is-info', href: `/business/clients/${data.birthdays[0].id}`, 'data-link': '', style: { margin: 0 } }, icon('gift', { size: 20 }), h('p', null, h('b', null, t(`დაბადების დღე ამ კვირაში: ${data.birthdays.length}`, `Birthdays this week: ${data.birthdays.length}`)), data.birthdays.slice(0, 3).map((b) => `${b.name} — ${b.inDays === 0 ? t('დღეს', 'today') : b.inDays === 1 ? t('ხვალ', 'tomorrow') : t(`${b.inDays} დღეში`, `in ${b.inDays} days`)}`).join(' · '))));
  if (data.lowSupplies) attention.push(h('a', { class: 'bz-banner is-warn', href: '/business/supplies', 'data-link': '', style: { margin: 0 } }, icon('flask', { size: 20 }), h('p', null, h('b', null, t(`${data.lowSupplies} მასალა საწყობში იწურება`, `${data.lowSupplies} ${data.lowSupplies === 1 ? 'supply is' : 'supplies are'} running low`)), t('შესაკვეთი სია საწყობის გვერდზეა.', 'The order list is on the stock-room page.'))));

  const todayList = data.today.length
    ? h('div', { class: 'bz-timeline' }, data.today.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: reload }) })))
    : emptyBox(t('დღეს ჩანაწერი არ არის', 'Nothing booked today'), t('ონლაინ ჯავშნები აქ თავისით ჩნდება; ვიზიტორს ხელით დაამატებ.', 'Online bookings appear here by themselves; add a walk-in by hand.'), button(t('ახალი ჩანაწერი', 'New booking'), { size: 'sm', icon: 'plus', onClick: () => newAppointmentDialog(context, {}, { onCreated: reload }) }));

  mount(root,
    pageHead(business.name, t(`${t('მიმოხილვა', 'Overview')} · ${when(new Date().toISOString()).split(' · ')[0]}`, `Overview · ${when(new Date().toISOString()).split(' · ')[0]}`),
      button(t('ახალი ჩანაწერი', 'New booking'), { icon: 'plus', onClick: () => newAppointmentDialog(context, {}, { onCreated: reload }) }),
      button(t('კალენდარი', 'Calendar'), { variant: 'ghost', icon: 'calendar', onClick: () => ctx.navigate('/calendar') })),
    banner,
    attention.length ? h('div', { style: { display: 'grid', gap: '10px', marginBottom: '16px' } }, attention) : null,
    kpis,
    h('div', { class: 'bz-grid' },
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        weeksCard,
        card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('დღეს', 'Today')), h('div', { class: 'card-sub' }, t(`${data.today.length} ჩანაწერი`, `${data.today.length} entries`))), h('a', { class: 'link', href: '/business/calendar', 'data-link': '' }, t('კალენდარი', 'Calendar'), icon('chevronRight', { size: 16 }))), todayList),
        data.upcoming.length ? card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('შემდეგი დღეები', 'Coming up')), h('a', { class: 'link', href: '/business/appointments', 'data-link': '' }, t('ყველა', 'All'), icon('chevronRight', { size: 16 }))),
          h('div', { class: 'bz-timeline' }, data.upcoming.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: reload }) })))) : null),
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        teamCard,
        doneCount < checklist.length ? card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('მოამზადე გვერდი', 'Set up your page')), h('div', { class: 'card-sub' }, t(`${doneCount} / ${checklist.length} შესრულებულია`, `${doneCount} / ${checklist.length} done`)))),
          h('div', { class: 'bz-progress', style: { marginBottom: '10px' } }, h('span', { style: { width: `${(doneCount / checklist.length) * 100}%` } })),
          h('div', { class: 'bz-check' }, checklist.map((c) => h(c.href ? 'a' : 'div', { href: c.href || undefined, 'data-link': c.href ? '' : undefined, class: c.href ? undefined : 'row-static' }, h('span', { class: `dot${c.done ? ' done' : ''}` }, icon(c.done ? 'check' : 'chevronRight', { size: 14 })), h('div', { class: 'main' }, h('b', null, c.title), h('span', null, c.sub)))))) : null,
        card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('საიდან მოდიან', 'Where bookings come from')), h('div', { class: 'card-sub' }, t('ბოლო ორი კვირა · ქვემოთ აპის გვერდის 7 დღე', 'The last two weeks · below, the app page in 7 days')))),
          sourcesBlock,
          h('div', { class: 'bz-funnel', style: { marginTop: sourcesBlock ? '14px' : 0 } },
            h('div', null, h('b', null, String(data.funnel.views)), h('span', null, t('გვერდი გაიხსნა', 'Page opened'))),
            h('div', null, h('b', null, String(data.funnel.calls)), h('span', null, t('დარეკვა', 'Calls'))),
            h('div', null, h('b', null, String(data.funnel.booked)), h('span', null, t('დაჯავშნა', 'Booked'))),
            h('div', null, h('b', null, data.funnel.views ? pct((data.funnel.booked / data.funnel.views) * 100) : '—'), h('span', null, t('კონვერსია', 'Conversion')))),
          h('p', { class: 'bz-note', style: { marginTop: '10px' } }, t('სრული სურათი — ანალიტიკაში: დატვირთვა, პიკური საათები, ტოპ სერვისები.', 'The full picture is in Analytics: utilisation, peak hours, top services.'))),
        card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('შეფასებები', 'Reviews')), h('a', { class: 'link', href: '/business/reviews', 'data-link': '' }, t('ყველა', 'All'), icon('chevronRight', { size: 16 }))),
          data.reviews.count ? h('div', { class: 'bz-inline' }, h('span', { style: { fontSize: '28px', fontWeight: 800 } }, data.reviews.avg?.toFixed(1) ?? '—'), h('span', { class: 'bz-stars' }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= Math.round(data.reviews.avg || 0) ? '' : 'off' }, icon('star', { size: 16 })))), h('span', { class: 'bz-sub' }, t(`${data.reviews.count} შეფასება`, `${data.reviews.count} reviews`)))
            : h('p', { class: 'bz-sub' }, t('შეფასებები დასრულებული ვიზიტების შემდეგ ჩნდება — აპი კლიენტს თავად ეკითხება.', 'Reviews come after completed visits — the app asks the client itself.'))))));
}

function kpi(label, value, delta, ic, accent = false, trend = null) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` },
    h('div', { class: 'stat-label' }, icon(ic, { size: 14 }), label),
    h('div', { class: 'stat-value' }, value),
    h('div', { class: 'stat-delta' }, delta),
    trend && trend.length > 2 && trend.some(Boolean) ? h('div', { class: 'bz-kpi-spark', 'aria-hidden': 'true' }, sparkline(trend, { width: 96, height: 30, color: accent ? 'var(--book)' : 'var(--book-2)' })) : null);
}
function legendRow(color, label, value, total) {
  return h('div', { class: 'row' }, h('i', { style: { background: color } }), h('span', null, label), h('b', null, String(value)), h('small', null, total ? `${Math.round((value / total) * 100)}%` : ''));
}

export { badge, clock, fail };
