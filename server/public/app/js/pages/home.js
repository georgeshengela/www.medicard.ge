// MEDICARD web — Home: the day at a glance. Sections follow the app's hub order,
// with the person's primary goal moved right after "ask Medi".
import { h, mount, icon, section, card, button, fmtDate, greeting, stat, errorBox, skeleton, tile, fmtNum } from '../ui.js';
import { session, firstName, featureOn, isFemale, profileExtra } from '../session.js';
import { t } from '../i18n.js';

/** A module's Home card, loaded lazily so Home paints at once. */
function lazyCard(loader, exportName) {
  const slot = h('div', null, skeleton(3));
  loader()
    .then((mod) => {
      if (typeof mod[exportName] !== 'function') throw new Error(t('მოდული ვერ ჩაიტვირთა.', 'This section could not load.'));
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
  const inp = h('input', { class: 'input', placeholder: t('მაგ: რა ვჭამო ვარჯიშის შემდეგ?', 'e.g. What should I eat after a workout?'), 'aria-label': t('კითხვა Medi-ს', 'Question for Medi'), style: { background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'transparent' } });
  const go = () => ask(inp.value.trim());
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const chips = [t('როგორ გავაუმჯობესო ძილი?', 'How can I sleep better?'), t('ჩემი ანალიზების ახსნა', 'Explain my lab results'), t('თავის ტკივილი მაქვს', 'I have a headache')];
  return card({ class: 'spotlight hero-card pad-lg' },
    h('div', { class: 'hstack', style: { gap: '14px', marginBottom: '16px', flexWrap: 'nowrap' } },
      h('span', { class: 'tile', style: { width: '48px', height: '48px' } }, icon('sparkles', { size: 24 })),
      h('div', null,
        h('div', { style: { fontSize: '19px', fontWeight: 700 } }, t('ჰკითხე Medi-ს', 'Ask Medi')),
        h('div', { class: 'muted', style: { fontSize: '14px' } }, t('შენი AI ასისტენტი — ჯანმრთელობა, კვება, წამლები და ანალიზები.', 'Your AI assistant for health, nutrition, medications and lab results.')))),
    h('div', { class: 'hstack', style: { flexWrap: 'nowrap' } }, inp, button(t('კითხვა', 'Ask'), { variant: 'light', icon: 'send', onClick: go })),
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
    card(stat(t('სტრიკი', 'Streak'), fmtNum(u.currentStreak || 0), { icon: 'flame', unit: t('დღე', (u.currentStreak || 0) === 1 ? 'day' : 'days'), delta: t(`რეკორდი ${fmtNum(u.longestStreak || 0)} დღე`, `Best: ${fmtNum(u.longestStreak || 0)} ${(u.longestStreak || 0) === 1 ? 'day' : 'days'}`) })),
    card(stat(t('ქულები', 'Points'), fmtNum(u.points || 0), { icon: 'star', delta: t('ყოველდღიური შესვლით და მისიებით', 'From daily check-ins and missions') })),
    featureOn('medications') ? card(stat(t('აქტიური წამლები', 'Active medications'), fmtNum(st.activeMedications || 0), { icon: 'pill', delta: t(`${fmtNum(st.records || 0)} ჩანაწერი ბარათში`, `${fmtNum(st.records || 0)} ${(st.records || 0) === 1 ? 'record' : 'records'} in your card`) })) : null,
    card(stat('BMI', bmi ? bmi.toFixed(1) : '—', { icon: 'scale', delta: bmi ? bmiLabel(bmi) : t('დაამატე სიმაღლე და წონა პროფილში', 'Add your height and weight in Profile') })));
}

function bmiLabel(b) {
  if (b < 18.5) return t('ნორმაზე დაბალი', 'Below the normal range');
  if (b < 25) return t('ნორმის ფარგლებში', 'Within the normal range');
  if (b < 30) return t('ნორმაზე მაღალი', 'Above the normal range');
  return t('საგრძნობლად მაღალი', 'Well above the normal range');
}

/** The activity card and metrics page stay while any tracker runs (admin „მოდულები“). */
const trackersOn = () => ['weight', 'steps', 'hydration'].some((key) => featureOn(key));

function toolsGrid() {
  const tools = [
    featureOn('records') ? { href: '/records', icon: 'folder', ink: 'blue', title: t('ჩემი ბარათი', 'My card'), body: t('დოკუმენტები, დასკვნები და Medi-სთან საუბრები ერთ ადგილას.', 'Documents, doctor reports and your Medi conversations in one place.') } : null,
    featureOn('labs') ? { href: '/lab', icon: 'flask', ink: 'violet', title: t('ანალიზები', 'Lab results'), body: t('შედეგები, ნორმები და მაჩვენებლების დინამიკა ჩარტებზე.', 'Results, reference ranges and trends on charts.') } : null,
    featureOn('visits') ? { href: '/visits', icon: 'stethoscope', ink: 'sky', title: t('ვიზიტები', 'Visits'), body: t('ექიმთან ვიზიტების კალენდარი და ისტორია.', 'Your doctor visit calendar and history.') } : null,
    trackersOn() ? { href: '/health', icon: 'activity', ink: 'green', title: t('მაჩვენებლები', 'Health metrics'), body: t('წონა, ნაბიჯები და წყალი — ტენდენციები დროში.', 'Weight, steps and water: trends over time.') } : null,
    featureOn('pets') ? { href: '/pets', icon: 'paw', ink: 'amber', title: t('ჩემი ცხოველები', 'My pets'), body: t('მოვლა, წონა და MEDIVET შენი ცხოველებისთვის.', 'Care, weight and MEDIVET for your pets.') } : null,
    featureOn('mediDoctor') ? { href: '/medi?mode=doctor', icon: 'stethoscope', ink: 'teal', title: t('ექიმთან', 'Doctor mode'), body: t('კლინიკური შეკითხვა Medi-ს ექიმის რეჟიმში.', 'Ask Medi a clinical question in doctor mode.') } : null,
  ].filter(Boolean);
  return h('div', { class: 'grid grid-3' }, tools.map((tool) => h('a', { class: 'card hover', href: tool.href, 'data-link': '' },
    h('div', { class: 'feature' }, tile(tool.icon, tool.ink), h('h3', null, tool.title), h('p', null, tool.body),
      h('span', { class: 'cta' }, t('გახსნა', 'Open'), icon('arrowRight', { size: 15 }))))));
}

export default async function home(root, { navigate }) {
  const name = firstName();
  const goal = profileExtra().primaryGoal;

  const sections = {
    meds: () => featureOn('medications') ? section(t('შემდეგი მიღება', 'Next dose'), lazyCard(() => import('./medications.js'), 'homeCard'), { link: { href: '/medications', label: t('ყველა', 'All') } }) : null,
    activity: () => trackersOn() ? section(t('აქტიურობა', 'Activity'), lazyCard(() => import('./health.js'), 'homeActivityCard'), { link: { href: '/health', label: t('დეტალურად', 'Details') } }) : null,
    nutrition: () => featureOn('nutrition') ? section(t('კვება', 'Nutrition'), lazyCard(() => import('./nutrition.js'), 'homeCard'), { link: { href: '/nutrition', label: t('დღიური', 'Diary') } }) : null,
    cycle: () => featureOn('cycle') && isFemale() ? section(t('ციკლი', 'Cycle'), lazyCard(() => import('./cycle.js'), 'homeCard'), { link: { href: '/cycle', label: t('გახსნა', 'Open') } }) : null,
    quest: () => featureOn('quest') ? section('MEDIQUEST', lazyCard(() => import('./quest.js'), 'homeCard'), { link: { href: '/quest', label: t('მისიები', 'Missions') } }) : null,
    coach: () => featureOn('coach') ? section(t('ჩემი ტრენერი', 'My trainer'), lazyCard(() => import('./trainer.js'), 'homeCard'), { link: { href: '/trainer', label: t('გახსნა', 'Open') } }) : null,
  };

  // Primary goal first (after "ask Medi"), then the usual order.
  const order = ['meds', 'activity', 'nutrition', 'cycle', 'quest', 'coach'];
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
      if (list?.length) mount(news, section(t('სიახლეები', 'News'), mod.newsCards(list)));
    }).catch(() => {});
  }

  mount(root,
    h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        h('p', { style: { marginTop: 0, fontSize: '14px' } }, `${fmtDate(new Date(), { year: true })}`),
        h('h1', null, `${greeting()}${name ? `, ${name}` : ''}`)),
      h('div', { class: 'page-head-actions' },
        featureOn('medi') ? button('Medi', { variant: 'secondary', icon: 'sparkles', href: '/medi' }) : null,
        featureOn('medications') ? button(t('წამლის დამატება', 'Add medication'), { icon: 'plus', href: '/medications?add=1' }) : null)),
    featureOn('medi') ? h('div', { class: 'hub-section' }, askMedi(navigate)) : null,
    h('div', { class: 'hub-section' }, summaryStats()),
    news,
    h('div', { class: 'grid grid-main' }, main, side),
    section(t('ხელსაწყოები', 'Tools'), toolsGrid()),
    h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), t('MEDICARD არ ანაცვლებს ექიმს. სასწრაფო შემთხვევაში დარეკე 112-ზე.', 'MEDICARD does not replace a doctor. In an emergency, call 112.')));
}
