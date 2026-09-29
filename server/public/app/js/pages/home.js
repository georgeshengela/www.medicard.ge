// MEDICARD web — Home: the day at a glance. Sections follow the app's hub order,
// with the person's primary goal moved right after "ask Medi".
import { h, mount, icon, section, card, button, fmtDate, greeting, stat, errorBox, skeleton, tile, fmtNum } from '../ui.js';
import { session, firstName, featureOn, isFemale, profileExtra } from '../session.js';

/** A module's Home card, loaded lazily so Home paints at once. */
function lazyCard(loader, exportName) {
  const slot = h('div', null, skeleton(3));
  loader()
    .then((mod) => {
      if (typeof mod[exportName] !== 'function') throw new Error('მოდული ვერ ჩაიტვირთა.');
      mount(slot, mod[exportName]());
    })
    .catch((e) => mount(slot, errorBox(e)));
  return slot;
}

/** Opens Medi with a draft question; the text travels in sessionStorage, never in the URL. */
function openMediWith(navigate, text) {
  if (text) {
    try { sessionStorage.setItem('medicard.web.mediPrefill', JSON.stringify({ mode: 'medi', text, at: Date.now() })); } catch { /* ignore */ }
  }
  navigate('/medi');
}

function askMedi(navigate) {
  const ask = (text) => openMediWith(navigate, text);
  const inp = h('input', { class: 'input', placeholder: 'მაგ: რა ვჭამო ვარჯიშის შემდეგ?', 'aria-label': 'კითხვა Medi-ს', style: { background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'transparent' } });
  const go = () => ask(inp.value.trim());
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const chips = ['როგორ გავაუმჯობესო ძილი?', 'ჩემი ანალიზების ახსნა', 'თავის ტკივილი მაქვს'];
  return card({ class: 'spotlight hero-card pad-lg' },
    h('div', { class: 'hstack', style: { gap: '14px', marginBottom: '16px', flexWrap: 'nowrap' } },
      h('span', { class: 'tile', style: { width: '48px', height: '48px' } }, icon('sparkles', { size: 24 })),
      h('div', null,
        h('div', { style: { fontSize: '19px', fontWeight: 700 } }, 'ჰკითხე Medi-ს'),
        h('div', { class: 'muted', style: { fontSize: '14px' } }, 'შენი AI ასისტენტი — ჯანმრთელობა, კვება, წამლები და ანალიზები.'))),
    h('div', { class: 'hstack', style: { flexWrap: 'nowrap' } }, inp, button('კითხვა', { variant: 'light', icon: 'send', onClick: go })),
    h('div', { class: 'chips', style: { marginTop: '14px' } }, chips.map((c) => h('button', {
      class: 'chip', style: { background: 'rgba(255,255,255,.08)', color: 'rgba(230,255,251,.85)' },
      onClick: () => ask(c),
    }, c))));
}

function summaryStats() {
  const u = session.user || {};
  const st = session.stats || {};
  const p = session.profile || {};
  const bmi = p.heightCm && p.weightKg ? p.weightKg / ((p.heightCm / 100) ** 2) : null;
  return h('div', { class: 'grid grid-4 grid-stats' },
    card(stat('სტრიკი', fmtNum(u.currentStreak || 0), { icon: 'flame', unit: 'დღე', delta: `რეკორდი ${fmtNum(u.longestStreak || 0)} დღე` })),
    card(stat('ქულები', fmtNum(u.points || 0), { icon: 'star', delta: 'ყოველდღიური შესვლით და მისიებით' })),
    card(stat('აქტიური წამლები', fmtNum(st.activeMedications || 0), { icon: 'pill', delta: `${fmtNum(st.records || 0)} ჩანაწერი ბარათში` })),
    card(stat('BMI', bmi ? bmi.toFixed(1) : '—', { icon: 'scale', delta: bmi ? bmiLabel(bmi) : 'დაამატე სიმაღლე და წონა პროფილში' })));
}

function bmiLabel(b) {
  if (b < 18.5) return 'ნორმაზე დაბალი';
  if (b < 25) return 'ნორმის ფარგლებში';
  if (b < 30) return 'ნორმაზე მაღალი';
  return 'საგრძნობლად მაღალი';
}

function toolsGrid() {
  const tools = [
    { href: '/records', icon: 'folder', ink: 'blue', title: 'ჩემი ბარათი', body: 'დოკუმენტები, დასკვნები და Medi-სთან საუბრები ერთ ადგილას.' },
    { href: '/lab', icon: 'flask', ink: 'violet', title: 'ანალიზები', body: 'შედეგები, ნორმები და მაჩვენებლების დინამიკა ჩარტებზე.' },
    { href: '/visits', icon: 'stethoscope', ink: 'sky', title: 'ვიზიტები', body: 'ექიმთან ვიზიტების კალენდარი და ისტორია.' },
    { href: '/health', icon: 'activity', ink: 'green', title: 'მაჩვენებლები', body: 'წონა, ნაბიჯები და წყალი — ტენდენციები დროში.' },
    featureOn('pets') ? { href: '/pets', icon: 'paw', ink: 'amber', title: 'ჩემი ცხოველები', body: 'მოვლა, წონა და Medi Vet შენი ცხოველებისთვის.' } : null,
    featureOn('medi') ? { href: '/medi?mode=doctor', icon: 'stethoscope', ink: 'teal', title: 'ექიმთან', body: 'კლინიკური შეკითხვა Medi-ს ექიმის რეჟიმში.' } : null,
  ].filter(Boolean);
  return h('div', { class: 'grid grid-3' }, tools.map((t) => h('a', { class: 'card hover', href: t.href, 'data-link': '' },
    h('div', { class: 'feature' }, tile(t.icon, t.ink), h('h3', null, t.title), h('p', null, t.body),
      h('span', { class: 'cta' }, 'გახსნა', icon('arrowRight', { size: 15 }))))));
}

export default async function home(root, { navigate }) {
  const name = firstName();
  const goal = profileExtra().primaryGoal;

  const sections = {
    meds: () => section('შემდეგი მიღება', lazyCard(() => import('./medications.js'), 'homeCard'), { link: { href: '/medications', label: 'ყველა' } }),
    activity: () => section('აქტიურობა', lazyCard(() => import('./health.js'), 'homeActivityCard'), { link: { href: '/health', label: 'დეტალურად' } }),
    nutrition: () => featureOn('nutrition') ? section('კვება', lazyCard(() => import('./nutrition.js'), 'homeCard'), { link: { href: '/nutrition', label: 'დღიური' } }) : null,
    cycle: () => featureOn('cycle') && isFemale() ? section('ციკლი', lazyCard(() => import('./cycle.js'), 'homeCard'), { link: { href: '/cycle', label: 'გახსნა' } }) : null,
    quest: () => featureOn('quest') ? section('Medi Quest', lazyCard(() => import('./quest.js'), 'homeCard'), { link: { href: '/quest', label: 'მისიები' } }) : null,
  };

  // Primary goal first (after "ask Medi"), then the usual order.
  const order = ['meds', 'activity', 'nutrition', 'cycle', 'quest'];
  const first = { medications: 'meds', nutrition: 'nutrition', cycle: 'cycle' }[goal];
  if (first) order.splice(order.indexOf(first), 1), order.unshift(first);

  const main = h('div', { class: 'stack', style: { gap: 0 } });
  const side = h('div', { class: 'stack', style: { gap: 0 } });
  // Two columns on desktop: the goal + meds/nutrition on the left, activity/cycle/quest on the right.
  const leftKeys = new Set([order[0], 'meds', 'nutrition'].filter(Boolean));
  for (const key of order) {
    const node = sections[key]?.();
    if (!node) continue;
    (leftKeys.has(key) ? main : side).appendChild(node);
  }

  const news = h('div');
  if (featureOn('news')) {
    import('./news.js').then(async (mod) => {
      if (typeof mod.loadNews !== 'function' || typeof mod.newsCards !== 'function') return;
      const list = await mod.loadNews();
      if (list?.length) mount(news, section('სიახლეები', mod.newsCards(list)));
    }).catch(() => {});
  }

  mount(root,
    h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        h('p', { style: { marginTop: 0, fontSize: '14px' } }, `${fmtDate(new Date(), { year: true })}`),
        h('h1', null, `${greeting()}${name ? `, ${name}` : ''}`)),
      h('div', { class: 'page-head-actions' },
        button('Medi', { variant: 'secondary', icon: 'sparkles', href: '/medi' }),
        button('წამლის დამატება', { icon: 'plus', href: '/medications?add=1' }))),
    featureOn('medi') ? h('div', { class: 'hub-section' }, askMedi(navigate)) : null,
    h('div', { class: 'hub-section' }, summaryStats()),
    news,
    h('div', { class: 'grid grid-main' }, main, side),
    section('ხელსაწყოები', toolsGrid()),
    h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), 'MEDICARD არ ანაცვლებს ექიმს. სასწრაფო შემთხვევაში დარეკე 112-ზე.'));
}
