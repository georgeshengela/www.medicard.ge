// MEDIBOOK business panel — the signed-out page. The hero is the product itself: a day column that fills with
// bookings as the page opens; then the two ways in, what the panel does, how it starts, and the sign-in box.
import { h, mount, icon, tile } from '/app/js/ui.js';
import { t, isEn, lang, setLang } from '/app/js/i18n.js';
import { renderAuthPanel } from '../auth.js';
import { avatar } from '../shared.js';

function langToggle() {
  const other = isEn ? 'ka' : 'en';
  return h('button', { type: 'button', class: 'lang-pill', title: isEn ? 'ქართულად' : 'Switch to English', onClick: () => setLang(other) },
    h('span', { class: lang === 'ka' ? 'on' : '' }, 'ქა'), h('span', { class: lang === 'en' ? 'on' : '' }, 'EN'));
}

const wordmark = (size = 21) => h('span', { class: 'wordmark', style: { fontSize: `${size}px` } }, 'MEDI', h('b', null, 'BOOK'));

/** Today's column of a small salon, as a client would fill it: three people, nine hours, one new booking landing. */
function demo() {
  const people = [
    { name: t('ნინო', 'Nino'), title: t('სტილისტი', 'Stylist'), c: '#0ea5e9' },
    { name: t('გიო', 'Gio'), title: t('ბარბერი', 'Barber'), c: '#8b5cf6' },
    { name: t('მარიამი', 'Mariam'), title: t('კოსმეტოლოგი', 'Cosmetologist'), c: '#10b981' },
  ];
  const start = 10; // 10:00 … 19:00
  const ev = (col, from, len, client, service, d, extra = '') => {
    const el = h('div', { class: `bz-demo-ev ${extra}`, style: { top: `calc(var(--h) * ${from - start})`, height: `calc(var(--h) * ${len} - 3px)` } },
      h('b', null, client), extra ? h('span', null, h('em', null, t('აპიდან · ', 'From the app · ')), service) : h('span', null, service));
    el.style.setProperty('--c', people[col].c);
    el.style.setProperty('--d', `${d}s`);
    return el;
  };
  const cols = [
    [ev(0, 10, 1, t('თამარ კ.', 'Tamar K.'), t('შეჭრა', 'Haircut'), 0.2), ev(0, 11.5, 2, t('ანა მ.', 'Ana M.'), t('ფერი და დაბანა', 'Colour and wash'), 0.5), ev(0, 15, 1, t('ლიკა ბ.', 'Lika B.'), t('უკანი', 'Blow-dry'), 0.8), ev(0, 17, 1.5, t('ნათია შ.', 'Natia S.'), t('ქერატინი', 'Keratin'), 2.6, 'is-new')],
    [ev(1, 10.5, 0.75, t('გიორგი ლ.', 'Giorgi L.'), t('წვერი', 'Beard'), 0.35), ev(1, 12, 1, t('დათო რ.', 'Dato R.'), t('შეჭრა', 'Haircut'), 0.65), ev(1, 14, 1, t('ნიკა ა.', 'Nika A.'), t('შეჭრა + წვერი', 'Cut and beard'), 1.0), ev(1, 16, 1, t('ლუკა ჯ.', 'Luka J.'), t('შეჭრა', 'Haircut'), 1.3)],
    [ev(2, 11, 1.5, t('ელენე ხ.', 'Elene Kh.'), t('სახის წმენდა', 'Facial'), 0.5), ev(2, 13.5, 1, t('მარი ო.', 'Mari O.'), t('წარბები', 'Brows'), 0.95), ev(2, 16.5, 1.5, t('სოფო გ.', 'Sopo G.'), t('ლაზერი', 'Laser'), 1.4)],
  ];
  const nowTop = `calc(var(--h) * ${13.75 - start})`;
  return h('div', { class: 'bz-demo-wrap' },
    h('div', { class: 'bz-demo' },
      h('div', { class: 'bz-demo-top' }, h('b', null, t('ხუთშაბათი, 15 ოქტომბერი', 'Thursday, 15 October')), h('span', { class: 'pill' }, h('i'), t('ონლაინ ჯავშნა ჩართულია', 'Online booking on'))),
      h('div', { class: 'bz-demo-cols' }, h('div'), people.map((p) => h('div', null, h('span', { class: 'bz-avatar', style: { background: p.c } }, p.name.slice(0, 1)), h('span', null, p.name), h('small', { class: 'faint', style: { fontWeight: 500 } }, p.title)))),
      h('div', { class: 'bz-demo-body' },
        h('div', { class: 'bz-demo-hours' }, Array.from({ length: 9 }, (_, i) => h('div', null, `${start + i}:00`))),
        cols.map((list, i) => h('div', { class: 'bz-demo-col' }, list, i === 0 ? h('div', { class: 'bz-demo-now', style: { top: nowTop } }) : null)))),
    h('div', { class: 'bz-demo-toast' }, icon('bellRing', { size: 15 }), t('ახალი ჯავშანი: ნათია შ. · 17:00 · ქერატინი', 'New booking: Natia S. · 17:00 · Keratin')));
}

export function renderLanding(root, { onSignedIn }) {
  document.title = t('MEDIBOOK ბიზნესი — მედიქარდი', 'MEDIBOOK for business — MEDICARD');
  const panel = h('div', { class: 'auth-box' });
  const signin = h('section', { class: 'bz-signin', id: 'signin' },
    h('aside', null,
      h('h2', null, t('შედი და დაიწყე', 'Sign in and start')),
      h('p', { class: 'bz-sub' }, t('იგივე MEDICARD ანგარიში, რითაც აპში შედიხარ. ანგარიში არ გაქვს? ტელეფონის ნომერი ერთ წუთში ქმნის.', 'The same MEDICARD account you use in the app. No account yet? A phone number creates one in a minute.')),
      h('ul', null,
        li('check', t('ბიზნესის დადასტურება — კატალოგიდან ან რუკიდან, 1 სამუშაო დღეში ვამოწმებთ', 'Claim — from the catalogue or the map; checked within a working day')),
        li('check', t('რეგისტრაცია — სახელი, მისამართი რუკაზე, საათები; პანელი მაშინვე მუშაობს', 'Register — name, address on the map, hours; the panel works at once')),
        li('check', t('უფასოა ბიზნესისთვისაც და კლიენტისთვისაც', 'Free for the business and for the client')))),
    h('div', { class: 'bz-signin-box' }, panel));
  const go = (mode) => { try { sessionStorage.setItem('medicard.business.intent', mode); } catch { /* ignore */ } signin.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => panel.querySelector('input')?.focus({ preventScroll: true }), 500); };

  const page = h('div', { class: 'bz-landing' },
    h('div', { class: 'bz-land-top' },
      h('a', { href: '/', style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('img', { src: '/icon.png', alt: '', style: { width: '30px', height: '30px', borderRadius: '9px' } }), wordmark()),
      h('div', { class: 'right' }, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onClick: () => go('claim') }, t('შესვლა', 'Sign in')), langToggle())),
    h('section', { class: 'bz-hero' },
      h('div', null,
        h('h1', null, t('კლიენტები აპიდან პირდაპირ შენს კალენდარში', 'Clients book from the app straight into your calendar')),
        h('p', { class: 'lead' }, t('სტომატოლოგია, სილამაზის სალონი, ესთეტიკის ცენტრი, კლინიკა, ფიტნესი — MEDICARD-ის მომხმარებლები რუკაზე გპოულობენ, თავისუფალ დროს ირჩევენ და იწერებიან. შენ ერთ პანელში მართავ გუნდს, კლიენტებს, ფინანსებს და ანალიტიკას.', 'A dental clinic, a beauty salon, an aesthetic centre, a clinic, a gym — MEDICARD users find you on the map, pick a free time and book. You run the team, clients, money and analytics in one panel.')),
        h('div', { class: 'bz-hero-ways' },
          h('button', { type: 'button', class: 'btn btn-primary', onClick: () => go('claim') }, icon('search', { size: 18 }), t('დაადასტურე შენი ბიზნესი', 'Claim your business')),
          h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => go('register') }, icon('plus', { size: 18 }), t('დაარეგისტრირე ახალი', 'Register a new one'))),
        h('div', { class: 'bz-hero-proof' },
          proof('5 700+', t('ადგილი კატალოგში', 'places in the catalogue')),
          proof('0 ₾', t('ბიზნესისთვის, ყოველთვის', 'for the business, always')),
          proof(t('24 სთ', '24 h'), t('შეხსენება კლიენტს ვიზიტამდე', 'reminder before the visit')))),
      demo()),
    h('section', { class: 'bz-section' },
      h('h2', null, t('ყველაფერი, რაც ბიზნესის დღეს სჭირდება', 'Everything a working day needs')),
      h('p', { class: 'bz-sub' }, t('კალენდრიდან ანალიტიკამდე — ერთ ადგილას, შენს ენაზე, კომპიუტერში და ტელეფონში.', 'From the calendar to analytics — in one place, in your language, on a computer and on the phone.')),
      h('div', { class: 'bz-featlist' },
        feat('calendar', t('კალენდარი თითო ადამიანზე', 'A calendar per person'), t('სვეტი თითო თანამშრომელზე თავისი გრაფიკით. ონლაინ ჯავშნები თავისით ჩნდება; ვიზიტორს ერთ დიალოგში ამატებ. ორმაგი ჩანაწერი არ ხდება.', 'A column per person with their own hours. Online bookings appear by themselves; a walk-in takes one dialog. No double-booking.')),
        feat('bellRing', t('შეხსენებები თქვენი მაგივრად', 'Reminders done for you'), t('კლიენტს MEDICARD ახსენებს წინა დღეს და 2 საათით ადრე, შეცვლისას ან გაუქმებისას — მაშინვე. ნაკლები გაცდენა.', 'MEDICARD reminds the client the day before and two hours ahead, and at once when something changes. Fewer no-shows.')),
        feat('users', t('კლიენტების ბაზა', 'A client book'), t('ყველა ვიზიტი, თანხა, გაცდენა, შენიშვნა და ტეგი ერთ ბარათზე. ვინ დაბრუნდა და ვინ დაიკარგა — ერთი ხედით.', 'Every visit, amount, no-show, note and tag on one card. Who came back and who drifted away — at a glance.')),
        feat('wallet', t('ფინანსები', 'Money'), t('დასრულებული ვიზიტი თავისით იწერება შემოსავალში; ხარჯებს კატეგორიებით ამატებ. მოგება, საშუალო ჩეკი, გადახდის მეთოდები.', 'A completed visit writes itself into income; expenses go in by category. Profit, average ticket, payment methods.')),
        feat('trendUp', t('ანალიტიკა და დატვირთვა', 'Analytics and utilisation'), t('მარგი ქმედების კოეფიციენტი თითო ადამიანზე, პიკური საათები, ტოპ სერვისები, ახალი და დაბრუნებული კლიენტები, რუკიდან ჯავშნამდე გზა.', 'Utilisation per person, peak hours, top services, new vs returning clients, the path from the map to a booking.')),
        feat('gift', t('ფასდაკლებები და შეფასებები', 'Discounts and reviews'), t('Happy hours, პირველი ვიზიტის ფასდაკლება, პრომო კოდი — აპში ფასი თავისით მცირდება. შეფასებებზე საჯაროდ პასუხობ.', 'Happy hours, a first-visit offer, a promo code — the price drops by itself in the app. You answer reviews in public.')))),
    h('section', { class: 'bz-section' },
      h('h2', null, t('როგორ იწყება', 'How it starts')),
      h('div', { class: 'bz-steps' },
        step(t('შედი', 'Sign in'), t('MEDICARD ანგარიშით — ტელეფონით, ელფოსტით, Apple-ით ან Google-ით.', 'With your MEDICARD account — phone, email, Apple or Google.')),
        step(t('დაადასტურე ან დაარეგისტრირე', 'Claim or register'), t('მოძებნე ბიზნესი კატალოგში; თუ არ არის — დაარეგისტრირე სამ წუთში.', 'Find the business in the catalogue; if it is not there, register it in three minutes.')),
        step(t('შეავსე სერვისები და გუნდი', 'Add services and the team'), t('ფასი, ხანგრძლივობა, ვინ ასრულებს და რა საათებში.', 'Price, duration, who performs it and when.')),
        step(t('მიიღე პირველი ჯავშანი', 'Take the first booking'), t('შენი გვერდი აპში იღებს „ჩაწერა“-ს ღილაკს. დანარჩენს კალენდარი აკეთებს.', 'Your page in the app gets a Book button. The calendar does the rest.')))),
    signin,
    h('footer', { class: 'bz-foot' },
      h('span', null, t('© მედიქარდი', '© MEDICARD')),
      h('a', { href: isEn ? '/privacy-en' : '/privacy' }, t('კონფიდენციალურობა', 'Privacy')),
      h('a', { href: isEn ? '/terms-en' : '/terms' }, t('წესები', 'Terms')),
      h('a', { href: 'mailto:support@medicard.ge' }, 'support@medicard.ge')));
  mount(root, page);
  renderAuthPanel(panel, { onDone: onSignedIn });
}

function li(ic, text) { return h('li', null, icon(ic, { size: 16 }), h('span', null, text)); }
function proof(value, label) { return h('div', null, h('b', null, value), label); }
function feat(ic, title, body) { return h('div', { class: 'bz-feat' }, tile(ic, 'green', 40), h('div', null, h('h3', null, title), h('p', null, body))); }
function step(title, body) { return h('div', { class: 'bz-step' }, h('i'), h('b', null, title), h('span', null, body)); }

export default async function landingPage(root, ctx) {
  renderLanding(root, { onSignedIn: () => ctx.navigate('/') });
}

export { avatar };
