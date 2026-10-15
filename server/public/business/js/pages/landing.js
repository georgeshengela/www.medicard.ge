// MEDIBOOK business panel — the signed-out page: what it is, two ways in (claim / register), the sign-in box.
import { h, mount, icon, tile } from '/app/js/ui.js';
import { t, isEn, lang, setLang } from '/app/js/i18n.js';
import { renderAuthPanel } from '../auth.js';

function langToggle() {
  const other = isEn ? 'ka' : 'en';
  return h('button', { type: 'button', class: 'lang-pill', title: isEn ? 'ქართულად' : 'Switch to English', onClick: () => setLang(other) },
    h('span', { class: lang === 'ka' ? 'on' : '' }, 'ქა'), h('span', { class: lang === 'en' ? 'on' : '' }, 'EN'));
}

export function renderLanding(root, { onSignedIn }) {
  document.title = t('MEDIBOOK ბიზნესი — მედიქარდი', 'MEDIBOOK for business — MEDICARD');
  const panel = h('div', { class: 'auth-box' });
  const intent = (mode) => { try { sessionStorage.setItem('medicard.business.intent', mode); } catch { /* ignore */ } panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); panel.querySelector('input')?.focus(); };
  const page = h('div', { class: 'bz-landing' },
    h('div', { class: 'bz-land-top' },
      h('a', { href: '/', style: { display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 } }, h('img', { src: '/icon.png', alt: '', style: { width: '32px', height: '32px', borderRadius: '9px' } }), h('span', { class: 'wordmark', style: { fontSize: '21px' } }, 'MEDI', h('b', null, 'BOOK'))),
      h('div', { class: 'right' }, h('a', { class: 'btn btn-ghost btn-sm', href: '/' }, t('medicard.ge', 'medicard.ge')), langToggle())),
    h('section', { class: 'bz-hero' },
      h('div', null,
        h('p', { class: 'badge badge-brand', style: { marginBottom: '14px' } }, t('MEDICARD აპის მომხმარებლები — შენი კლიენტები', 'MEDICARD app users — your clients')),
        h('h1', null, t('შენი ბიზნესი MEDICARD-ში: კალენდარი, ჯავშნები, კლიენტები', 'Your business in MEDICARD: calendar, bookings, clients')),
        h('p', { class: 'lead' }, t('სტომატოლოგია, სილამაზის სალონი, ესთეტიკის ცენტრი, კლინიკა, ფიტნესი — ადამიანები MEDICARD აპში რუკაზე გპოულობენ და პირდაპირ შენს კალენდარში ეწერებიან. შენ ერთ პანელში მართავ გუნდს, სერვისებს, ფინანსებს და ანალიტიკას. უფასოდ.', 'A dental clinic, a beauty salon, an aesthetic centre, a clinic, a gym — people find you on the map in the MEDICARD app and book straight into your calendar. You run the team, services, money and analytics in one panel. Free.')),
        h('div', { class: 'bz-hero-cards' },
          h('button', { type: 'button', class: 'bz-hero-card', onClick: () => intent('claim') },
            tile('search', 'violet'), h('b', null, t('ბიზნესის დადასტურება', 'Claim your business')), h('span', null, t('უკვე ვართ კატალოგში — მოძებნე და დაადასტურე, რომ შენია.', 'Already in the catalogue — find it and confirm it is yours.'))),
          h('button', { type: 'button', class: 'bz-hero-card', onClick: () => intent('register') },
            tile('plus', 'teal'), h('b', null, t('ახალი ბიზნესის რეგისტრაცია', 'Register a new business')), h('span', null, t('სახელი, მისამართი რუკაზე, საათები — 3 წუთი.', 'Name, address on the map, hours — three minutes.')))),
        h('p', { class: 'bz-note', style: { marginTop: '18px' } }, t('შესვლა იმავე MEDICARD ანგარიშით, რითაც აპში შედიხარ. განაცხადს ვამოწმებთ 1 სამუშაო დღეში.', 'Sign in with the same MEDICARD account you use in the app. We review every claim within one working day.'))),
      h('div', { class: 'bz-hero-panel' }, panel)),
    h('section', { class: 'bz-features' },
      feature('calendar', t('კალენდარი თანამშრომლებით', 'A calendar per person'), t('კვირის ხედი სვეტებით თითო თანამშრომელზე. ონლაინ ჯავშნები თავისით ჩნდება; ვიზიტორებს ხელით ამატებ ერთ დიალოგში.', 'A week view with a column per person. Online bookings appear by themselves; walk-ins take one dialog.')),
      feature('bell', t('ჯავშანი აპიდან, შეხსენებები თქვენი მაგივრად', 'Booked from the app, reminders done for you'), t('კლიენტი ხედავს თავისუფალ დროებს და თავად ირჩევს. შეხსენებას წინა დღეს და 2 საათით ადრე MEDICARD აგზავნის — ნაკლები გაცდენა.', 'The client sees free times and picks one. MEDICARD reminds them the day before and two hours ahead — fewer no-shows.')),
      feature('users', t('კლიენტების ბაზა', 'A client book'), t('ყველა ვიზიტი, თანხა, გაცდენა, შენიშვნა და ტეგი ერთ ბარათზე. ვინ დაბრუნდა, ვინ დაიკარგა — ერთი ხედით.', 'Every visit, amount, no-show, note and tag on one card. Who came back, who drifted away — at a glance.')),
      feature('wallet', t('ფინანსური მენეჯერი', 'Money manager'), t('დასრულებული ვიზიტი თავისით იწერება შემოსავალში; ხარჯებს კატეგორიებით ამატებ. მოგება, საშუალო ჩეკი, გადახდის მეთოდები.', 'A completed visit writes itself into income; expenses go in by category. Profit, average ticket, payment methods.')),
      feature('trendUp', t('ანალიტიკა და დატვირთვა', 'Analytics and utilisation'), t('მარგი ქმედების კოეფიციენტი თითო თანამშრომელზე, პიკური საათები, ტოპ სერვისები, ახალი და დაბრუნებული კლიენტები, რუკიდან ჯავშნამდე გზა.', 'Utilisation per person, peak hours, top services, new vs returning clients, the path from the map to a booking.')),
      feature('gift', t('ფასდაკლებები და შეფასებები', 'Discounts and reviews'), t('Happy hours, პირველი ვიზიტის ფასდაკლება, პრომო კოდი — აპში ფასი თავისით მცირდება. შეფასებებზე საჯაროდ პასუხობ.', 'Happy hours, first-visit offers, promo codes — the price drops by itself in the app. Answer reviews in public.'))),
    h('section', { class: 'bz-steps' },
      h('h2', { style: { fontSize: '22px' } }, t('როგორ მუშაობს', 'How it works')),
      h('ol', null,
        step(t('შედი და დაადასტურე', 'Sign in and claim'), t('MEDICARD ანგარიშით. მოძებნე ბიზნესი კატალოგში ან დაარეგისტრირე ახალი.', 'With your MEDICARD account. Find the business in the catalogue or register a new one.')),
        step(t('დაამატე სერვისები და გუნდი', 'Add services and the team'), t('ფასი, ხანგრძლივობა, ვინ ასრულებს და რა საათებში მუშაობს.', 'Price, duration, who performs it and their hours.')),
        step(t('ჩართე ონლაინ ჯავშნა', 'Turn on online booking'), t('აპში შენი გვერდი იღებს „ჩაწერა“-ს ღილაკს. დადასტურება ავტომატური ან შენი ხელით.', 'Your page in the app gets a Book button. Confirmation automatic or by hand.')),
        step(t('მართე ყველაფერი ერთ პანელში', 'Run everything in one panel'), t('კალენდარი, კლიენტები, ფინანსები, ანალიტიკა — კომპიუტერში და ტელეფონში.', 'Calendar, clients, money, analytics — on a computer and on the phone.')))),
    h('footer', { class: 'bz-foot' },
      h('span', null, t('© მედიქარდი', '© MEDICARD')),
      h('a', { href: isEn ? '/privacy-en' : '/privacy' }, t('კონფიდენციალურობა', 'Privacy')),
      h('a', { href: isEn ? '/terms-en' : '/terms' }, t('წესები', 'Terms')),
      h('a', { href: 'mailto:support@medicard.ge' }, 'support@medicard.ge')));
  mount(root, page);
  renderAuthPanel(panel, { onDone: onSignedIn });
}

function feature(ic, title, body) {
  return h('div', { class: 'bz-feature' }, tile(ic, 'violet', 40), h('h3', null, title), h('p', null, body));
}
function step(title, body) {
  return h('li', null, h('b', null, title), body);
}

export default async function landingPage(root, ctx) {
  renderLanding(root, { onSignedIn: () => ctx.navigate('/') });
}

export { icon };
