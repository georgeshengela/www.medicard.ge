// MEDIBOOK business panel — overview: what needs attention now, today, this week, the setup checklist.
import { h, mount, icon, button, pageHead, card, badge } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { state } from '../state.js';
import { biz, gel, pct, when, clock, emptyBox, fail } from '../shared.js';
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

  const kpis = h('div', { class: 'bz-kpis' },
    kpi(t('დღეს', 'Today'), String(data.today.filter((a) => a.status !== 'CANCELLED').length), t(`${data.today.filter((a) => a.status === 'COMPLETED').length} დასრულდა`, `${data.today.filter((a) => a.status === 'COMPLETED').length} completed`), 'calendar'),
    kpi(t('შემოსავალი · 7 დღე', 'Revenue · 7 days'), gel(data.week.revenue), t(`${data.week.done} დასრულებული ვიზიტი`, `${data.week.done} completed visits`), 'wallet', true),
    kpi(t('ახალი ჯავშნები · 7 დღე', 'New bookings · 7 days'), String(data.week.booked), t(`${data.week.cancelled} გაუქმდა · ${data.week.noShow} არ მოვიდა`, `${data.week.cancelled} cancelled · ${data.week.noShow} no-shows`), 'calendarCheck'),
    kpi(t('კლიენტები', 'Clients'), String(data.clients.total), t(`+${data.clients.new} ამ კვირაში`, `+${data.clients.new} this week`), 'users'));

  const attention = [];
  if (data.pending) attention.push(h('a', { class: 'bz-banner is-warn', href: '/business/appointments?status=PENDING', 'data-link': '', style: { margin: 0 } }, icon('bellRing', { size: 20 }), h('p', null, h('b', null, t(`${data.pending} ჯავშანი ელოდება დადასტურებას`, `${data.pending} ${data.pending === 1 ? 'booking is' : 'bookings are'} waiting for confirmation`)), t('კლიენტი ხედავს „ელოდება“-ს, სანამ არ დაადასტურებ.', 'The client sees "waiting" until you confirm.'))));
  if (data.reviews.unanswered) attention.push(h('a', { class: 'bz-banner is-info', href: '/business/reviews', 'data-link': '', style: { margin: 0 } }, icon('star', { size: 20 }), h('p', null, h('b', null, t(`${data.reviews.unanswered} შეფასება პასუხის გარეშე`, `${data.reviews.unanswered} ${data.reviews.unanswered === 1 ? 'review' : 'reviews'} without a reply`)), t('პასუხი საჯაროა და ნდობას მატებს.', 'Replies are public and build trust.'))));

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
        card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('დღეს', 'Today')), h('div', { class: 'card-sub' }, t(`${data.today.length} ჩანაწერი`, `${data.today.length} entries`))), h('a', { class: 'link', href: '/business/calendar', 'data-link': '' }, t('კალენდარი', 'Calendar'), icon('chevronRight', { size: 16 }))), todayList),
        data.upcoming.length ? card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('შემდეგი დღეები', 'Coming up')), h('a', { class: 'link', href: '/business/appointments', 'data-link': '' }, t('ყველა', 'All'), icon('chevronRight', { size: 16 }))),
          h('div', { class: 'bz-timeline' }, data.upcoming.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: reload }) })))) : null),
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        doneCount < checklist.length ? card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('მოამზადე გვერდი', 'Set up your page')), h('div', { class: 'card-sub' }, t(`${doneCount} / ${checklist.length} შესრულებულია`, `${doneCount} / ${checklist.length} done`)))),
          h('div', { class: 'bz-progress', style: { marginBottom: '10px' } }, h('span', { style: { width: `${(doneCount / checklist.length) * 100}%` } })),
          h('div', { class: 'bz-check' }, checklist.map((c) => h(c.href ? 'a' : 'div', { href: c.href || undefined, 'data-link': c.href ? '' : undefined }, h('span', { class: `dot${c.done ? ' done' : ''}` }, icon(c.done ? 'check' : 'chevronRight', { size: 14 })), h('div', { class: 'main' }, h('b', null, c.title), h('span', null, c.sub)))))) : null,
        card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('აპიდან · 7 დღე', 'From the app · 7 days'))),
          h('div', { class: 'bz-funnel' },
            h('div', null, h('b', null, String(data.funnel.views)), h('span', null, t('გვერდი გაიხსნა', 'Page opened'))),
            h('div', null, h('b', null, String(data.funnel.calls)), h('span', null, t('დარეკვა', 'Calls'))),
            h('div', null, h('b', null, String(data.funnel.booked)), h('span', null, t('დაჯავშნა', 'Booked'))),
            h('div', null, h('b', null, data.funnel.views ? pct((data.funnel.booked / data.funnel.views) * 100) : '—'), h('span', null, t('კონვერსია', 'Conversion')))),
          h('p', { class: 'bz-note', style: { marginTop: '10px' } }, t('სრული სურათი — ანალიტიკაში: დატვირთვა, პიკური საათები, ტოპ სერვისები.', 'The full picture is in Analytics: utilisation, peak hours, top services.'))),
        card(h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('შეფასებები', 'Reviews')), h('a', { class: 'link', href: '/business/reviews', 'data-link': '' }, t('ყველა', 'All'), icon('chevronRight', { size: 16 }))),
          data.reviews.count ? h('div', { class: 'bz-inline' }, h('span', { style: { fontSize: '28px', fontWeight: 800 } }, data.reviews.avg?.toFixed(1) ?? '—'), h('span', { class: 'bz-stars' }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= Math.round(data.reviews.avg || 0) ? '' : 'off' }, icon('star', { size: 16 })))), h('span', { class: 'bz-sub' }, t(`${data.reviews.count} შეფასება`, `${data.reviews.count} reviews`)))
            : h('p', { class: 'bz-sub' }, t('შეფასებები დასრულებული ვიზიტების შემდეგ ჩნდება — აპი კლიენტს თავად ეკითხება.', 'Reviews come after completed visits — the app asks the client itself.'))))));
}

function kpi(label, value, delta, ic, accent = false) {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}` },
    h('div', { class: 'stat-label' }, icon(ic, { size: 14 }), label),
    h('div', { class: 'stat-value' }, value),
    h('div', { class: 'stat-delta' }, delta));
}

export { badge, clock, fail };
