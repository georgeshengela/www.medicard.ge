// MEDICARD web — Home: the day at a glance. Follows the app's Home layouts (mobile src/lib/home/homeLayout.ts +
// homeSectionOrder.ts): „ქალის ჯანმრთელობა“ (cycle first), „აქტიური“, „კვება და წონა“ and „სტანდარტული“.
// The layout is the person's own choice (`extraAnswers.homeLayout`, written only from a click); an admin can
// switch the feature off (`homeLayouts`) and a layout whose core modules are paused falls back to standard.
import { h, mount, icon, section, card, button, fmtDate, greeting, stat, errorBox, skeleton, tile, fmtNum, openModal, toast, ymd } from '../ui.js';
import { session, firstName, featureOn, isFemale, profileExtra, setProfile } from '../session.js';
import { get, put } from '../api.js';
import { t } from '../i18n.js';
import { wordmark } from '../brand.js';

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

/* ── Layouts ─────────────────────────────────────────── */
const LAYOUTS = ['women', 'active', 'weight', 'standard'];
const LAYOUT_NAME = {
  women: t('ქალის ჯანმრთელობა', 'Women’s health'), active: t('აქტიური', 'Active'), weight: t('კვება და წონა', 'Nutrition & weight'), standard: t('სტანდარტული', 'Standard'),
};
const LAYOUT_DESC = {
  women: t('ციკლი, დღის რჩევები და შენი დღე — ერთ ნაზ გვერდზე', 'Your cycle, daily tips and your day on one calm page'),
  active: t('ნაბიჯები, წყალი და მისიები — წინ', 'Steps, water and missions up front'),
  weight: t('დღის ბიუჯეტი, ჩაწერა და წონის გზა', 'Daily budget, logging and your weight path'),
  standard: t('დღის მთავარი: წამლები, აქტიურობა, ანალიზები და კვება', 'Today’s essentials: medicines, activity, labs and food'),
};
const LAYOUT_ICON = { women: ['flower', 'rose'], active: ['footprints', 'green'], weight: ['apple', 'amber'], standard: ['home', 'teal'] };
const layoutsOn = () => featureOn('homeLayouts');
function layoutAvailable(id) {
  if (id === 'standard') return true;
  if (!layoutsOn()) return false;
  if (id === 'women') return isFemale() && featureOn('cycle');
  if (id === 'active') return featureOn('steps') || featureOn('hydration') || featureOn('medirun');
  if (id === 'weight') return featureOn('nutrition') || featureOn('weight');
  return false;
}
function resolveLayout() {
  const chosen = LAYOUTS.includes(profileExtra().homeLayout) ? profileExtra().homeLayout : null;
  if (!layoutsOn() || !chosen) return 'standard';
  return layoutAvailable(chosen) ? chosen : 'standard';
}

/** One set of question chips per layout (mobile HomeAskChips). General questions only — nothing personal. */
const ASK_CHIPS = {
  women: [t('რა მეხმარება მენსტრუაციის ტკივილისას?', 'What helps with period pain?'), t('რა არის PMS და როგორ შევიმსუბუქო?', 'What is PMS and how can I ease it?'), t('რატომ შეიძლება დაგვიანდეს მენსტრუაცია?', 'Why might my period be late?'), t('რა ვჭამო ციკლის სხვადასხვა ფაზაში?', 'What should I eat in each cycle phase?')],
  standard: [t('წნევა 140/90 — ეს მაღალია?', 'Blood pressure 140/90 — is that high?'), t('რა შემოწმებები მჭირდება ჩემს ასაკში?', 'Which check-ups do I need at my age?'), t('როგორ დავანებო თავი მოწევას?', 'How do I quit smoking?'), t('ქოლესტერინი მომემატა — რა შევცვალო?', 'My cholesterol went up — what should I change?')],
  active: [t('კუნთები მტკივა ვარჯიშის შემდეგ — რა ვქნა?', 'My muscles ache after a workout — what helps?'), t('როგორ დავიწყო სირბილი ნულიდან?', 'How do I start running from zero?'), t('რამდენი წყალი მჭირდება ვარჯიშისას?', 'How much water do I need when I train?'), t('მუხლი მტკივა სიარულისას — რატომ?', 'My knee hurts when I walk — why?')],
  weight: [t('რამდენი ცილა მჭირდება დღეში?', 'How much protein do I need a day?'), t('როგორ დავიკლო წონა უსაფრთხოდ?', 'How do I lose weight safely?'), t('რა ვჭამო ვახშმად, რომ მაძღარი ვიყო?', 'What dinner keeps me full?'), t('საღამოს მშია — რა ვქნა?', 'I get hungry in the evening — what helps?')],
};

/** Opens Medi with a draft; the text travels in sessionStorage, never in the URL. `doctor` = straight to the doctor. */
function openMediWith(navigate, text, mode = 'medi') {
  if (text) {
    try { sessionStorage.setItem('medicard.web.mediPrefill', JSON.stringify({ mode, text, at: Date.now() })); } catch { /* ignore */ }
  }
  navigate('/medi');
}

function askMedi(navigate, layout) {
  const inp = h('input', { class: 'input', placeholder: t('მაგ: რა ვჭამო ვარჯიშის შემდეგ?', 'e.g. What should I eat after a workout?'), 'aria-label': t('კითხვა Medi-ს', 'Question for Medi'), style: { background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'transparent' } });
  const go = () => openMediWith(navigate, inp.value.trim());
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  // A chip only puts its question in Medi's composer (nothing is sent until she presses send); the women's
  // chips also bring today's cycle context as a removable chip (mobile prepareCycleAskMedi).
  const chip = (q) => {
    if (layout === 'women' && featureOn('cycle')) import('./cycle.js').then((m) => m.askMediWithCycle(q, navigate)).catch(() => openMediWith(navigate, q, 'doctor'));
    else openMediWith(navigate, q, 'doctor');
  };
  return card({ class: 'spotlight hero-card pad-lg' },
    h('div', { class: 'hstack', style: { gap: '14px', marginBottom: '16px', flexWrap: 'nowrap' } },
      h('span', { class: 'tile', style: { width: '48px', height: '48px' } }, icon('sparkles', { size: 24 })),
      h('div', null,
        h('div', { style: { fontSize: '19px', fontWeight: 700 } }, t('ჰკითხე Medi-ს', 'Ask Medi')),
        h('div', { class: 'muted', style: { fontSize: '14px' } }, t('შენი AI ასისტენტი — ჯანმრთელობა, კვება, წამლები და ანალიზები.', 'Your AI assistant for health, nutrition, medications and lab results.')))),
    h('div', { class: 'hstack', style: { flexWrap: 'nowrap' } }, inp, button(t('კითხვა', 'Ask'), { variant: 'light', icon: 'send', onClick: go })),
    h('div', { class: 'chips', style: { marginTop: '14px' } }, (ASK_CHIPS[layout] || ASK_CHIPS.standard).map((c) => h('button', {
      class: 'chip', style: { background: 'rgba(255,255,255,.08)', color: 'rgba(230,255,251,.85)' },
      onClick: () => chip(c),
    }, c))));
}

/* ── „არ გამოგრჩეს“ (mobile HomeAttention): only while true — a visit in 7 days, a lab result from the last 14 ── */
function attentionSection(navigate) {
  const slot = h('div');
  const today = ymd();
  const addDays = (k, n) => { const d = new Date(`${k}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysUntil = (k) => Math.round((Date.parse(`${k}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const when = (k) => { const d = daysUntil(k); return d === 0 ? t('დღეს', 'Today') : d === 1 ? t('ხვალ', 'Tomorrow') : fmtDate(k); };
  Promise.all([
    featureOn('visits') ? get('/api/visits').then((r) => r.visits || []).catch(() => []) : [],
    featureOn('labs') ? get('/api/account/app-state').then((r) => r.state?.labPanels || []).catch(() => []) : [],
    featureOn('visits') ? import('./visits.js').catch(() => null) : null,
  ]).then(([visits, panels, visitsMod]) => {
    const rows = [];
    const until = addDays(today, 7);
    const visit = visits.filter((v) => v.active !== false && v.visitDate >= today && v.visitDate <= until)
      .sort((a, b) => a.visitDate.localeCompare(b.visitDate) || String(a.visitTime).localeCompare(String(b.visitTime)))[0];
    if (visit) {
      const label = visitsMod?.typeLabel ? visitsMod.typeLabel(visit.doctorType) : visit.doctorType;
      rows.push(h('a', { class: 'card hover home-attn', href: '/visits', 'data-link': '' }, tile('stethoscope', 'sky', 40),
        h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, t(`ვიზიტი: ${label}`, `Visit: ${label}`)), h('div', { class: 'card-sub' }, `${when(visit.visitDate)}${visit.visitTime ? `, ${String(visit.visitTime).slice(0, 5)}` : ''}`)),
        icon('chevronRight', { size: 18 })));
    }
    const from = addDays(today, -14);
    const latest = panels.map((p) => p.date).filter((d) => d >= from && d <= today).sort().at(-1);
    const params = latest ? panels.filter((p) => p.date === latest).flatMap((p) => p.parameters || []) : [];
    if (params.length) {
      const outside = params.filter((p) => p.flag === 'H' || p.flag === 'L').length;
      rows.push(h('a', { class: 'card hover home-attn', href: '/lab', 'data-link': '' }, tile('flask', 'violet', 40),
        h('div', { class: 'row-main' },
          h('div', { class: 'card-title' }, outside ? t(`ანალიზი: ${outside} მაჩვენებელი ნორმის გარეთ`, `Lab: ${outside} ${outside === 1 ? 'value' : 'values'} outside the range`) : t('ანალიზი: ყველა მაჩვენებელი ნორმაშია', 'Lab: every value is in range')),
          h('div', { class: 'card-sub' }, t(`${fmtDate(latest)} · ${params.length} მაჩვენებელი — ნახე და ჰკითხე Medi-ს`, `${fmtDate(latest)} · ${params.length} values — review and ask Medi`))),
        icon('chevronRight', { size: 18 })));
    }
    if (rows.length) mount(slot, section(t('არ გამოგრჩეს', 'Don’t miss'), h('div', { class: 'stack', style: { gap: '10px' } }, rows)));
  });
  return slot;
}

/* ── „შემოწმება AI-სთან“: MEDISCAN (the symptom check lives in the app) ── */
function scanCard() {
  if (!['labs', 'imaging', 'skin'].some((k) => featureOn(k))) return null;
  return h('a', { class: 'card hover home-scan', href: '/scan', 'data-link': '' },
    h('div', { class: 'home-scan-text' },
      h('div', { class: 'home-scan-title' }, wordmark('scan')),
      h('p', null, t('ანალიზი, რენტგენი, ექო ან კანის ფოტო — ატვირთე და Medi წაგიკითხავს, მერე ჰკითხე რაც გინდა.', 'A lab sheet, X-ray, ultrasound or skin photo — upload it, Medi reads it, then ask anything.')),
      h('span', { class: 'cta' }, t('შემოწმება', 'Check'), icon('arrowRight', { size: 15 }))),
    h('span', { class: 'home-scan-lens', 'aria-hidden': 'true' }, h('i'), icon('scanLine', { size: 26 })));
}

function summaryStats() {
  const u = session.user || {};
  const st = session.stats || {};
  const p = session.profile || {};
  const bmi = p.heightCm && p.weightKg ? p.weightKg / ((p.heightCm / 100) ** 2) : null;
  return h('div', { class: 'grid grid-4 grid-stats' },
    card(stat(t('სტრიკი', 'Streak'), fmtNum(u.currentStreak || 0), { icon: 'flame', unit: t('დღე', (u.currentStreak || 0) === 1 ? 'day' : 'days'), delta: t(`რეკორდი ${fmtNum(u.longestStreak || 0)} დღე`, `Best: ${fmtNum(u.longestStreak || 0)} ${(u.longestStreak || 0) === 1 ? 'day' : 'days'}`) })),
    card(stat(t('ქულები', 'Points'), fmtNum(u.points || 0), { icon: 'star', delta: t('ყოველდღიური შესვლით და მისიებით', 'From daily check-ins and missions') })),
    featureOn('medications') ? card(stat(t('აქტიური წამლები', 'Active medications'), fmtNum(st.activeMedications || 0), { icon: 'pill', delta: t(`${fmtNum(st.records || 0)} ჩანაწერი`, `${fmtNum(st.records || 0)} ${(st.records || 0) === 1 ? 'record' : 'records'}`) })) : null,
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
    featureOn('labs') ? { href: '/lab', icon: 'flask', ink: 'violet', title: t('ანალიზები', 'Lab results'), body: t('შედეგები, ნორმები და მაჩვენებლების დინამიკა ჩარტებზე.', 'Results, reference ranges and trends on charts.') } : null,
    featureOn('records') ? { href: '/records', icon: 'folder', ink: 'blue', title: t('ჩანაწერები', 'Records'), body: t('დოკუმენტები, დასკვნები და Medi-სთან საუბრები ერთ ადგილას.', 'Documents, doctor reports and your Medi conversations in one place.') } : null,
    featureOn('visits') ? { href: '/visits', icon: 'stethoscope', ink: 'sky', title: t('ვიზიტები', 'Visits'), body: t('ექიმთან ვიზიტების კალენდარი და ისტორია.', 'Your doctor visit calendar and history.') } : null,
    trackersOn() ? { href: '/health', icon: 'activity', ink: 'green', title: t('მაჩვენებლები', 'Health metrics'), body: t('წონა, ნაბიჯები და წყალი — ტენდენციები დროში.', 'Weight, steps and water: trends over time.') } : null,
    featureOn('pets') ? { href: '/pets', icon: 'paw', ink: 'amber', title: t('ჩემი ცხოველები', 'My pets'), body: t('მოვლა, წონა და MEDIVET შენი ცხოველებისთვის.', 'Care, weight and MEDIVET for your pets.') } : null,
  ].filter(Boolean);
  return h('div', { class: 'grid grid-3' }, tools.map((tool) => h('a', { class: 'card hover', href: tool.href, 'data-link': '' },
    h('div', { class: 'feature' }, tile(tool.icon, tool.ink), h('h3', null, tool.title), h('p', null, tool.body),
      h('span', { class: 'cta' }, t('გახსნა', 'Open'), icon('arrowRight', { size: 15 }))))));
}

/** „მთავარი გვერდი“ picker: the choice is saved to the profile (same field the app reads). */
function openLayoutPicker(current, onPicked) {
  const m = openModal({
    title: t('მთავარი გვერდი', 'Home layout'),
    size: 'sm',
    body: h('div', { class: 'stack', style: { gap: '8px' } },
      h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('ერთი და იგივე მოდულები, სხვა წყობით. ნებისმიერ დროს შეცვლი — აპშიც იგივე გამოჩნდება.', 'The same modules in a different order. Change it any time — the app shows the same.')),
      LAYOUTS.filter((id) => id !== 'women' || isFemale()).map((id) => {
        const ok = layoutAvailable(id);
        const [ic, ink] = LAYOUT_ICON[id];
        const btn = h('button', { type: 'button', class: `home-layout-opt${id === current ? ' on' : ''}`, disabled: !ok, 'aria-pressed': id === current ? 'true' : 'false' },
          tile(ic, ink, 38), h('span', { class: 'row-main' }, h('b', null, LAYOUT_NAME[id]), h('span', null, ok ? LAYOUT_DESC[id] : t('ახლა შეჩერებულია', 'Paused for now'))),
          id === current ? icon('check', { size: 18 }) : null);
        btn.addEventListener('click', async () => {
          if (id === current) { m.close(); return; }
          btn.disabled = true;
          try {
            const r = await put('/api/health-profile', { extraAnswers: { homeLayout: id } });
            if (r?.profile) setProfile(r.profile);
            m.close();
            onPicked(id);
          } catch (e) { btn.disabled = false; toast(e.message, 'error'); }
        });
        return btn;
      })),
  });
}

export default async function home(root, { navigate }) {
  const name = firstName();
  const goal = profileExtra().primaryGoal;
  const layout = resolveLayout();

  const sections = {
    meds: () => featureOn('medications') ? section(t('შემდეგი მიღება', 'Next dose'), lazyCard(() => import('./medications.js'), 'homeCard'), { link: { href: '/medications', label: t('ყველა', 'All') } }) : null,
    activity: () => trackersOn() ? section(t('აქტიურობა', 'Activity'), lazyCard(() => import('./health.js'), 'homeActivityCard'), { link: { href: '/health', label: t('დეტალურად', 'Details') } }) : null,
    nutrition: () => featureOn('nutrition') ? section(t('კვება', 'Nutrition'), lazyCard(() => import('./nutrition.js'), 'homeCard'), { link: { href: '/nutrition', label: t('დღიური', 'Diary') } }) : null,
    cycle: () => featureOn('cycle') && isFemale() ? section(t('ციკლი დღეს', 'Cycle today'), lazyCard(() => import('./cycle.js'), 'homeCard'), { link: { href: '/cycle', label: t('გახსნა', 'Open') } }) : null,
    quest: () => featureOn('quest') ? section('MEDIQUEST', lazyCard(() => import('./quest.js'), 'homeCard'), { link: { href: '/quest', label: t('მისიები', 'Missions') } }) : null,
    coach: () => featureOn('coach') ? section(t('ჩემი ტრენერი', 'My trainer'), lazyCard(() => import('./trainer.js'), 'homeCard'), { link: { href: '/trainer', label: t('გახსნა', 'Open') } }) : null,
  };

  // Order per layout (mobile HOME_LAYOUT_ORDER); the primary goal reorders the standard layout only.
  const ORDER = {
    women: ['cycle', 'meds', 'activity', 'nutrition', 'quest', 'coach'],
    active: ['activity', 'quest', 'meds', 'nutrition', 'coach', 'cycle'],
    weight: ['nutrition', 'activity', 'meds', 'quest', 'coach', 'cycle'],
    standard: ['meds', 'activity', 'quest', 'nutrition', 'coach', 'cycle'],
  };
  const order = [...ORDER[layout]];
  if (layout === 'standard') {
    const first = { medications: 'meds', nutrition: 'nutrition', cycle: 'cycle' }[goal];
    if (first) { order.splice(order.indexOf(first), 1); order.unshift(first); }
  }

  const main = h('div', { class: 'stack', style: { gap: 0 } });
  const side = h('div', { class: 'stack', style: { gap: 0 } });
  // Two columns on desktop: the layout's lead section + meds/nutrition on the left, the rest on the right.
  const leftKeys = new Set([order[0], 'meds', 'nutrition']);
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

  const layoutBtn = layoutsOn()
    ? button(LAYOUT_NAME[layout], { variant: 'ghost', icon: 'grid', onClick: () => openLayoutPicker(layout, () => home(root, { navigate })) })
    : null;
  if (layoutBtn) layoutBtn.title = t('მთავარი გვერდის განლაგება', 'Home layout');
  const scan = scanCard();

  mount(root,
    h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        // No year: date · greeting stay short (mobile header).
        h('p', { style: { marginTop: 0, fontSize: '14px' } }, fmtDate(new Date())),
        h('h1', null, `${greeting()}${name ? `, ${name}` : ''}`)),
      h('div', { class: 'page-head-actions' },
        layoutBtn,
        featureOn('medi') ? button('Medi', { variant: 'secondary', icon: 'sparkles', href: '/medi' }) : null,
        featureOn('medications') ? button(t('წამლის დამატება', 'Add medication'), { icon: 'plus', href: '/medications?add=1' }) : null)),
    featureOn('medi') ? h('div', { class: 'hub-section' }, askMedi(navigate, layout)) : null,
    attentionSection(navigate),
    h('div', { class: 'hub-section' }, summaryStats()),
    news,
    h('div', { class: 'grid grid-main' }, main, side),
    scan ? section(t('შემოწმება AI-სთან', 'Check with AI'), scan) : null,
    section(t('ხელსაწყოები', 'Tools'), toolsGrid()),
    h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), t('MEDICARD არ ანაცვლებს ექიმს. სასწრაფო შემთხვევაში დარეკე 112-ზე.', 'MEDICARD does not replace a doctor. In an emergency, call 112.')));
}
