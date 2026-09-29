// MEDICARD web — Medi (one screen, three modes), mirrors mobile/app/assistant.tsx + MediConsultation.
//   medi   → the action assistant: POST /api/assistant/plan → signed review → /api/assistant/execute
//   doctor → DOCTOR consultation, streamed from POST /api/ai/query
//   deep   → CONSILIUM ("ღრმა ანალიზი"), streamed from POST /api/ai/query
// Query: ?mode=doctor|deep, ?session=<id> (also ?sessionId=), ?prefill=<text> (put in the composer, never auto-sent).
// Every request that sends data to an AI goes through withAiConsent first.
import {
  h, mount, clear, icon, button, iconButton, toast, openModal, confirmDialog, markdown, relDay, fmtTime, fmtDate, parseDate, ymd,
} from '../ui.js';
import { get, post, del, stream, invalidate, ApiError } from '../api.js';
import { withAiConsent } from '../aiConsent.js';
import { session, firstName } from '../session.js';

const CSS_HREF = '/app/css/medi.css';
const APP_STORE = 'https://apps.apple.com/app/id6812517519';
const LIMIT = 4000;
const DISCLAIMER = 'ეს არ არის დიაგნოზი — საჭიროებისას ექიმს მიმართე.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureCss() {
  if (!document.querySelector(`link[href="${CSS_HREF}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS_HREF }));
}

/* ── Modes (copy from mobile i18n ka.chat / ka.modules) ───────────────── */
const MODES = {
  medi: {
    key: 'medi', label: 'Medi', api: null, sessionMode: 'ASSISTANT', icon: 'sparkles', ink: 'teal',
    subtitle: 'შენი ასისტენტი',
    placeholder: 'დაწერე, რით დაგეხმარო…',
    emptyTitle: (name) => (name ? `გამარჯობა, ${name}` : 'გამარჯობა'),
    emptyBody: 'მითხარი, რა გინდა — წამლის დამატება, წყლის ჩაწერა, ვიზიტის დაგეგმვა ან აპის რომელიმე გვერდის გახსნა. ჩანაწერს შენახვამდე ყოველთვის გადაგამოწმებინებ.',
    starters: [
      { icon: 'droplet', ink: 'sky', text: 'დღეს 500 მლ წყალი დავლიე' },
      { icon: 'pill', ink: 'teal', text: 'მინდა ახალი წამალი დავამატო' },
      { icon: 'calendar', ink: 'violet', text: 'ექიმთან ვიზიტი დამიგეგმე' },
      { icon: 'scale', ink: 'amber', text: 'მინდა 5 კილო დავიკლო' },
    ],
    thinking: 'ვამზადებ…',
  },
  doctor: {
    key: 'doctor', label: 'ექიმთან', api: 'DOCTOR', sessionMode: 'DOCTOR', icon: 'stethoscope', ink: 'blue',
    subtitle: 'ჯანმრთელობის კითხვები და რჩევა',
    placeholder: 'დაწერე შეტყობინება…',
    emptyTitle: () => 'გამარჯობა, მე ვარ Medi',
    emptyBody: 'მითხარი რა გაწუხებს — მეგობრულად და გასაგებად გიპასუხებ. ეს არ ცვლის ექიმს.',
    starters: [
      { icon: 'brain', ink: 'violet', text: 'სამი დღეა თავი მტკივა' },
      { icon: 'heart', ink: 'rose', text: 'მაღალი წნევა მაქვს, რა ვქნა?' },
      { icon: 'activity', ink: 'amber', text: 'ბავშვს 38.5 ტემპერატურა აქვს' },
    ],
    thinking: 'Medi ფიქრობს…',
  },
  deep: {
    key: 'deep', label: 'ღრმა ანალიზი', api: 'CONSILIUM', sessionMode: 'CONSILIUM', icon: 'users', ink: 'violet',
    subtitle: 'რამდენიმე სპეციალისტის ხედვა',
    placeholder: 'აღწერე შემთხვევა დეტალურად…',
    emptyTitle: () => 'ღრმა ანალიზი',
    emptyBody: 'აღწერე სრული სურათი: ჩივილები, ანამნეზი, ჩატარებული კვლევები და მიმდინარე მკურნალობა. სისტემა შეარჩევს რელევანტურ სპეციალისტებს.',
    checklist: ['რა გაწუხებს და რამდენი ხანია', 'ქრონიკული დაავადებები და ალერგიები', 'ჩატარებული ანალიზები და კვლევები', 'რას იღებ ახლა და რა სცადე'],
    starters: [],
    thinking: 'სპეციალისტები განიხილავენ…',
  },
};
const MODE_KEYS = ['medi', 'doctor', 'deep'];

function modeFromParam(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'doctor') return 'doctor';
  if (v === 'deep' || v === 'consilium') return 'deep';
  return 'medi';
}
function modeForSession(m) { return m === 'CONSILIUM' ? 'deep' : m === 'DOCTOR' ? 'doctor' : 'medi'; }

/* ── Planner review helpers (ported from mobile/src/lib/assistant.ts + assistantDialog.ts) ── */
function dialogIntent(text) {
  const v = text.trim().replace(/[.!?։,;]+$/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (['კი', 'დიახ', 'შეინახე', 'დაადასტურე', 'კი შეინახე', 'დიახ შეინახე', 'კი დაადასტურე', 'გააგრძელე', 'ვეთანხმები'].includes(v)) return 'confirm';
  if (['არა', 'გააუქმე', 'გაუქმება', 'არა გააუქმე', 'არ შეინახო', 'შეჩერდი'].includes(v)) return 'cancel';
  return 'message';
}

const FIELD_LABELS = {
  loseKg: 'დასაკლები წონა · კგ', plannedMealId: 'რაციონის კვება', date: 'თარიღი', amountMl: 'წყალი · მლ', goalMl: 'დღიური მიზანი · მლ', targetKg: 'სასურველი წონა · კგ', startKg: 'მიმდინარე წონა · კგ',
  deadlineYmd: 'მიზნის ვადა', targetSteps: 'ნაბიჯების მიზანი', weightKg: 'წონა · კგ', heartRate: 'პულსი · წუთში',
  bloodPressureSystolic: 'ზედა წნევა', bloodPressureDiastolic: 'ქვედა წნევა', sleepHours: 'ძილი · საათი', nutritionKcal: 'დამატებული კალორიები · კკალ',
  startDate: 'დაწყების დღე', endDate: 'დასრულების დღე', courseDays: 'კურსი · დღე', medName: 'მედიკამენტი', dosage: 'შენი დოზა', frequency: 'მიღების დროები', notes: 'შენიშვნა', note: 'შენიშვნა', name: 'სახელი',
  speciesId: 'ცხოველის სახეობა', breedId: 'ჯიში', customBreed: 'ჯიშის დასახელება', sex: 'სქესი', neutered: 'სტერილიზაცია',
  ageKind: 'ასაკის სიზუსტე', birthDate: 'დაბადების თარიღი', approxAgeYears: 'სავარაუდო ასაკი · წელი', approxAgeMonths: 'დამატებით · თვე',
  id: 'ჩანაწერი', petId: 'ცხოველი', recordId: 'შენახული შედეგი', visitId: 'ვიზიტი', medicationId: 'მედიკამენტი', status: 'მდგომარეობა', time: 'დრო · HH:mm',
  doctorType: 'ექიმის სპეციალობა', doctorFirstName: 'ექიმის სახელი', doctorLastName: 'ექიმის გვარი', visitDate: 'ვიზიტის თარიღი', visitTime: 'ვიზიტის დრო', address: 'მისამართი',
  action: 'მოქმედება', flow: 'ინტენსივობა', symptoms: 'სიმპტომები', moods: 'განწყობა', bbt: 'ბაზალური ტემპერატურა · °C',
  ovulationTest: 'ოვულაციის ტესტი', pregnancyTest: 'ორსულობის ტესტი', sleepQuality: 'ძილის ხარისხი', stressLevel: 'სტრესი', energy: 'ენერგია', kickCount: 'დღის მოძრაობების რაოდენობა',
  inputValue: 'წონა', inputUnit: 'ერთეული', recordedOn: 'აღრიცხვის თარიღი', category: 'კატეგორია', reportedStatus: 'დადასტურება', reaction: 'რეაქცია', notedOn: 'შემჩნევის თარიღი', reportedBasis: 'ინფორმაციის წყარო', onsetOn: 'დაწყების თარიღი',
  heightCm: 'სიმაღლე · სმ', bloodType: 'სისხლის ჯგუფი', chronicConditions: 'ქრონიკული მდგომარეობები', allergies: 'ალერგიები', medications: 'მედიკამენტები',
  familyHistory: 'ოჯახური ისტორია', healthGoals: 'ჯანმრთელობის მიზნები', activityLevel: 'აქტივობა', dietType: 'კვება', smokingStatus: 'თამბაქო', alcoholUse: 'ალკოჰოლი',
  kind: 'მოვლის ტიპი', title: 'დასახელება', productId: 'პროდუქტი', formulation: 'ფორმა', batchId: 'პარტიის ნომერი', expiresOn: 'ვადა', dose: 'დოზა', doseUnit: 'დოზის ერთეული', route: 'მიღების გზა', startOn: 'დაწყების დღე', dueTime: 'მიღების დრო', recurrenceKind: 'გამეორება', intervalCount: 'ინტერვალი', recurrenceBasis: 'დათვლის წესი', source: 'ინფორმაციის წყარო', sourceNote: 'წყაროს შენიშვნა', courseEndsOn: 'კურსის დასრულება', timeMode: 'დროის რეჟიმი', timezone: 'დროის სარტყელი', administeredOn: 'ჩატარების დღე', administeredTime: 'ჩატარების დრო',
  avgCycleLength: 'ციკლის საშუალო ხანგრძლივობა', avgPeriodLength: 'პერიოდის ხანგრძლივობა', lastPeriodStart: 'ბოლო პერიოდის დაწყება', isIrregular: 'არარეგულარული ციკლი', dueDate: 'მშობიარობის სავარაუდო თარიღი', pregnancyReferenceDate: 'ორსულობის საწყისი თარიღი', pregnancyReferenceType: 'თარიღის საფუძველი', pregnancyConfirm: 'ორსულობის რეჟიმის დადასტურება', postpartumReferenceDate: 'მშობიარობის თარიღი', postpartumConfirm: 'მშობიარობის შემდგომი რეჟიმის დადასტურება',
  destination: 'გასახსნელი ფუნქცია', mode: 'კონსულტაციის ტიპი', message: 'შეტყობინება', values: 'ცვლილებები',
};
const VALUE_LABELS = {
  'care/history': 'მოვლის ისტორია', 'care/products': 'მოვლის პროდუქტები', 'care/plan': 'მოვლის დაგეგმვა', 'care/record': 'მოვლის აღრიცხვა', care: 'მოვლა', edit: 'პროფილის რედაქტირება', profile: 'პროფილი', weight: 'წონა', allergies: 'ალერგიები', conditions: 'ჯანმრთელობის ჩანაწერები',
  GP: 'ოჯახის ექიმი', DENTIST: 'სტომატოლოგი', CARDIO: 'კარდიოლოგი', GYN: 'გინეკოლოგი', NEURO: 'ნევროლოგი', ORTHO: 'ორთოპედი', THERAPIST: 'თერაპევტი', OPHTHALMO: 'ოფთალმოლოგი', DERM: 'დერმატოლოგი', PED: 'პედიატრი', OTHER: 'სხვა',
  TRACK_PERIOD: 'ციკლის აღრიცხვა', TRY_TO_CONCEIVE: 'დაორსულების მცდელობა', PREGNANCY: 'ორსულობა', PERIMENOPAUSE: 'პერიმენოპაუზა', POSTPARTUM: 'მშობიარობის შემდეგ', LMP: 'ბოლო მენსტრუაციის დაწყება', USER_SELECTED: 'ჩემ მიერ არჩეული თარიღი',
  VACCINATION: 'ვაქცინაცია', FLEA_TICK: 'რწყილი და ტკიპა', DEWORMING: 'ჭიებზე დამუშავება', MEDICATION: 'მედიკამენტი', ONCE: 'ერთჯერადად', EVERY_N_DAYS: 'ყოველ რამდენიმე დღეში', EVERY_N_WEEKS: 'ყოველ რამდენიმე კვირაში', EVERY_N_MONTHS: 'ყოველ რამდენიმე თვეში', DAILY_COURSE: 'ყოველდღიური კურსი', NONE: 'არ მეორდება', FIXED_CALENDAR: 'ფიქსირებული კალენდრით', FROM_ADMINISTRATION: 'ბოლო ჩატარებიდან', VETERINARIAN: 'ვეტერინარი', PRODUCT_INSTRUCTIONS: 'პროდუქტის ინსტრუქცია', USER_ENTERED: 'ჩემი ჩანაწერი', DATE_BASED: 'დღის მიხედვით', EXACT_TIME: 'ზუსტი დროით', oral: 'პერორალურად', topical: 'გარეგანად', injection: 'ინექციით',
  SEDENTARY: 'მჯდომარე', LIGHT: 'მსუბუქი', MODERATE: 'ზომიერი', ACTIVE: 'აქტიური', VERY_ACTIVE: 'ძალიან აქტიური', OMNIVORE: 'შერეული კვება', VEGETARIAN: 'ვეგეტარიანული', VEGAN: 'ვეგანური', KETO: 'კეტო', NEVER: 'არასდროს', FORMER: 'წარსულში', CURRENT: 'ამჟამად', OCCASIONAL: 'ზოგჯერ', REGULAR: 'რეგულარულად', poor: 'ცუდი', okay: 'საშუალო', good: 'კარგი', low: 'დაბალი', high: 'მაღალი', very_low: 'ძალიან დაბალი', very_high: 'ძალიან მაღალი', normal: 'ჩვეულებრივი', lb: 'ფუნტი', mixed: 'მეტისი',
  true: 'კი', false: 'არა', MALE: 'მამრობითი', FEMALE: 'მდედრობითი', UNKNOWN: 'უცნობია', EXACT: 'ზუსტი თარიღი', APPROXIMATE: 'სავარაუდო ასაკი',
  DOCTOR: 'Medi ექიმი', CONSILIUM: 'ღრმა ანალიზი', dog: 'ძაღლი', cat: 'კატა', unknown: 'უცნობია', custom: 'სხვა ჯიში',
  start: 'დაწყება', end: 'დასრულება', none: 'არ არის', spotting: 'ლაქები', light: 'მსუბუქი', medium: 'საშუალო', heavy: 'უხვი',
  positive: 'დადებითი', negative: 'უარყოფითი', unclear: 'გაურკვეველი', taken: 'მივიღე', skipped: 'გამოვტოვე',
  suspected: 'სავარაუდო', veterinarian_confirmed: 'ვეტერინარის მიერ დადასტურებული', owner_reported: 'ჩემი დაკვირვება', active: 'აქტიური', resolved: 'დასრულებული',
  kg: 'კგ', g: 'გრამი', medication: 'მედიკამენტი', food: 'საკვები', environmental: 'გარემო', other: 'სხვა',
};
const HIDDEN_ROWS = new Set(['recurrenceBasis', 'source', 'timeMode', 'timezone']);
const HANDOFF_TOOLS = ['open', 'consult', 'pet_consult', 'pet_open', 'record_open', 'visit_open', 'medication_open', 'nutrition_goal', 'weight_goal'];

function display(value) {
  if (Array.isArray(value)) return value.map(display).join(', ');
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v]) => `${FIELD_LABELS[k] || k}: ${display(v)}`).join('\n');
  return VALUE_LABELS[String(value)] || String(value ?? '');
}

/* ── Native app route → web route (null = only in the app) ─────────── */
function webRouteFor(route) {
  const r = String(route || '').split('?')[0];
  const seg = r.split('/').filter(Boolean);
  if (r === '/(tabs)/home' || r === '/') return '/';
  if (r === '/(tabs)/records') return '/records';
  if (seg[0] === 'record' && UUID.test(seg[1] || '')) return `/records/${seg[1]}`;
  if (r === '/(tabs)/profile' || seg[0] === 'profile') return '/profile';
  if (seg[0] === 'health-metrics' || seg[0] === 'week') return '/health';
  if (seg[0] === 'nutrition') return '/nutrition';
  if (seg[0] === 'medications') return UUID.test(seg[1] || '') ? `/medications/${seg[1]}` : '/medications';
  if (seg[0] === 'visits') return '/visits';
  if (seg[0] === 'cycle') return '/cycle';
  if (seg[0] === 'lab') return '/lab';
  if (seg[0] === 'medi-quest') return '/quest';
  if (seg[0] === 'pets') return UUID.test(seg[1] || '') ? `/pets/${seg[1]}` : '/pets';
  return null; // symptoms, imaging/skin modules, pharmacy, MEDIRUN, weather, permissions …
}

/* In-memory, account-bound, one-shot consult handoff (never from a URL) — like stageAssistantLaunch. */
let staged = null;
const consumedOps = new Set();

/* ══════════════════════════════════════════════════════════════════ */
export default async function mediPage(root, ctx) {
  ensureCss();
  ctx.setTitle('Medi');
  const owner = session.user?.id;
  let alive = true;
  let generation = 0;
  const same = () => alive && session.user?.id === owner;

  const st = {
    mode: modeFromParam(ctx.query.mode),
    conv: { sessionId: ctx.query.session || ctx.query.sessionId || null, key: 0 },
    messages: [],
    loadState: 'ready', // loading | ready | error
    busy: false,
    controller: null,
    stopRequested: false,
    error: null,
    failed: null,
    note: null,
    // planner
    review: null,
    draft: null,
    suggestions: [],
    receipt: null,
    persistChain: Promise.resolve(),
    catalog: null,
    // history
    sessions: null,
    sessionsError: null,
    filter: '',
  };
  if (!UUID.test(String(st.conv.sessionId || ''))) st.conv.sessionId = null;

  /* ── Layout ──────────────────────────────────────────── */
  const side = h('aside', { class: 'medi-side', 'aria-label': 'საუბრები' });
  const head = h('div', { class: 'medi-head' });
  const thread = h('div', { class: 'medi-thread' });
  const log = h('div', { class: 'medi-log', role: 'log', 'aria-live': 'polite' }, thread);
  const jump = h('button', { class: 'medi-jump', type: 'button', hidden: true, onClick: () => scrollToEnd(true, true) }, icon('arrowDown', { size: 16 }), 'ბოლო შეტყობინება');
  const status = h('div', { class: 'medi-status' });
  const ta = h('textarea', {
    rows: 1, maxlength: LIMIT, 'aria-label': 'შეტყობინება Medi-სთვის',
    onInput: () => { autoGrow(); updateSend(); },
    onKeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
      else if (e.key === 'Escape' && st.busy) { e.preventDefault(); stop(); }
    },
  });
  const sendBtn = h('button', { class: 'medi-send', type: 'button', 'aria-label': 'გაგზავნა', title: 'გაგზავნა', onClick: () => (st.busy ? stop() : submit()) });
  const counter = h('span', { class: 'medi-count', hidden: true });
  const composer = h('div', { class: 'medi-composer' }, ta, counter, sendBtn);
  const foot = h('div', { class: 'medi-foot' },
    h('span', { class: 'medi-disc' }, icon('info', { size: 14 }), DISCLAIMER),
    h('span', { class: 'medi-keys' }, h('span', { class: 'kbd' }, 'Enter'), ' გაგზავნა · ', h('span', { class: 'kbd' }, 'Shift+Enter'), ' ახალი ხაზი'));
  const dock = h('div', { class: 'medi-dock' }, status, composer, foot);
  const main = h('section', { class: 'medi-main' }, head, h('div', { class: 'medi-body' }, log, jump), dock);
  mount(root, h('div', { class: 'medi' }, side, main));

  log.addEventListener('scroll', () => { jump.hidden = nearBottom() || !st.messages.length; }, { passive: true });

  /* ── Small utilities ─────────────────────────────────── */
  function nearBottom() { return log.scrollHeight - log.scrollTop - log.clientHeight < 120; }
  function scrollToEnd(force = false, smooth = false) {
    if (!force && !nearBottom()) { jump.hidden = !st.messages.length; return; }
    requestAnimationFrame(() => {
      log.scrollTo({ top: log.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      jump.hidden = true;
    });
  }
  function autoGrow() {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }
  function setComposer(text, focus = true) {
    ta.value = text || '';
    autoGrow();
    updateSend();
    if (focus) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
  function updateSend() {
    const len = ta.value.length;
    counter.hidden = len < LIMIT - 400;
    counter.textContent = `${len}/${LIMIT}`;
    const stoppable = st.busy && Boolean(st.controller);
    mount(sendBtn, icon(stoppable ? 'stopSquare' : 'arrowUp', { size: stoppable ? 16 : 20, stroke: 2.4 }));
    sendBtn.classList.toggle('is-stop', stoppable);
    sendBtn.setAttribute('aria-label', stoppable ? 'შეჩერება' : 'გაგზავნა');
    sendBtn.title = stoppable ? 'შეჩერება (Esc)' : 'გაგზავნა';
    sendBtn.disabled = st.busy ? !stoppable : (!ta.value.trim() || st.loadState !== 'ready');
  }
  const mode = () => MODES[st.mode];
  function errorText(e, fallback) {
    const fields = e?.body?.fields;
    if (Array.isArray(fields) && fields.length) {
      return fields.map((f) => { const key = String(f.field || '').split('.').pop(); return `${FIELD_LABELS[key] || 'ველი'}: ${f.message}`; }).join('\n');
    }
    return e?.message || fallback;
  }
  function syncUrl(push = false) {
    const q = new URLSearchParams();
    if (st.mode !== 'medi') q.set('mode', st.mode);
    if (st.conv.sessionId) q.set('session', st.conv.sessionId);
    const url = `/app/medi${q.toString() ? `?${q}` : ''}`;
    if (url === location.pathname + location.search) return;
    history[push ? 'pushState' : 'replaceState']({}, '', url);
  }

  /* ── Header ──────────────────────────────────────────── */
  function renderHead() {
    const m = mode();
    const sw = h('div', { class: 'medi-modes', role: 'tablist', 'aria-label': 'Medi-ს რეჟიმი' },
      MODE_KEYS.map((k) => h('button', {
        type: 'button', role: 'tab', class: k === st.mode ? 'on' : '', 'aria-selected': k === st.mode ? 'true' : 'false',
        title: MODES[k].subtitle,
        onClick: () => { if (k !== st.mode) openConversation(k, null, { push: true }); },
      }, icon(MODES[k].icon, { size: 16 }), h('span', null, MODES[k].label))));
    mount(head,
      h('div', { class: 'medi-id' },
        h('span', { class: `medi-orb sm ink-${m.ink}` }, icon(m.icon, { size: 18 })),
        h('div', { class: 'medi-id-text' }, h('b', null, 'Medi'), h('span', null, m.subtitle))),
      sw,
      h('div', { class: 'medi-actions' },
        iconButton('history', { title: 'საუბრები', class: 'medi-only-narrow', onClick: openHistoryModal }),
        st.mode === 'medi' ? iconButton('compass', { title: 'რას აკეთებს Medi', onClick: openDirectory }) : null,
        iconButton('squarePen', { title: 'ახალი საუბარი', onClick: () => openConversation(st.mode, null, { push: true }) }),
        iconButton('shield', { title: 'AI და კონფიდენციალურობა', onClick: () => ctx.navigate('/profile') })));
  }

  /* ── Thread ──────────────────────────────────────────── */
  function renderThread() {
    clear(thread);
    if (st.loadState === 'loading') {
      thread.append(h('div', { class: 'medi-loading' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i')), 'საუბარი იტვირთება…'));
      updateSend();
      return;
    }
    if (st.loadState === 'error') {
      thread.append(h('div', { class: 'error-box medi-inline-error' }, icon('alert', { size: 20 }),
        h('div', null, h('strong', null, 'საუბარი ვერ ჩაიტვირთა'), h('p', null, 'შეამოწმე კავშირი და სცადე ხელახლა.')),
        button('ხელახლა', { variant: 'ghost', size: 'sm', onClick: () => loadConversation() })));
      updateSend();
      return;
    }
    if (!st.messages.length) {
      thread.append(emptyHero());
    } else {
      st.messages.forEach((msg, i) => thread.append(messageEl(msg, i)));
    }
    if (st.mode === 'medi') {
      const task = taskEl();
      if (task) thread.append(task);
    }
    updateSend();
  }

  function emptyHero() {
    const m = mode();
    return h('div', { class: 'medi-hero' },
      h('div', { class: `medi-orb lg ink-${m.ink}` }, icon(m.icon, { size: 30 })),
      h('h2', null, m.emptyTitle(firstName())),
      h('p', null, m.emptyBody),
      m.checklist ? h('ul', { class: 'medi-checklist' }, m.checklist.map((c) => h('li', null, icon('check', { size: 15 }), c))) : null,
      m.starters.length ? h('div', { class: 'medi-starters' }, m.starters.map((s) => h('button', {
        type: 'button', class: 'medi-starter', onClick: () => { if (!st.busy) send(s.text); },
      }, h('span', { class: `tile ink-${s.ink}`, style: { width: '34px', height: '34px' } }, icon(s.icon, { size: 17 })), h('span', null, s.text), icon('arrowRight', { size: 16, className: 'medi-starter-go' })))) : null,
      st.mode === 'medi' ? h('button', { type: 'button', class: 'medi-link', onClick: openDirectory }, icon('compass', { size: 16 }), 'ნახე, რას აკეთებს Medi') : null);
  }

  function aiAvatar() {
    const m = mode();
    return h('span', { class: `medi-orb xs ink-${m.ink}`, 'aria-hidden': 'true' }, icon('sparkles', { size: 14 }));
  }

  function messageEl(msg, index) {
    if (msg.role === 'user') {
      return h('div', { class: 'medi-msg me' },
        h('div', { class: 'medi-bubble me' }, msg.content),
        msg.timestamp ? h('div', { class: 'medi-meta' }, fmtTime(msg.timestamp)) : null);
    }
    const body = h('div', { class: 'medi-answer' });
    msg.bodyEl = body;
    paintBody(msg);
    const tools = [];
    if (!msg.streaming && !msg.pending && msg.content && !msg.local) {
      tools.push(iconButton('copy', { title: 'კოპირება', size: 16, class: 'medi-tool', onClick: () => copyText(msg.content) }));
      if (msg.interactionId) {
        tools.push(h('span', { class: 'medi-tools-sep' }));
        for (const [rating, name, label] of [[1, 'thumbsUp', 'კარგი პასუხია'], [-1, 'thumbsDown', 'პასუხი არ მომეწონა']]) {
          const b = iconButton(name, { title: label, size: 16, class: `medi-tool ${msg.feedbackRating === rating ? 'on' : ''}`, onClick: () => rate(index, rating) });
          if (msg.feedbackRating) b.disabled = true;
          tools.push(b);
        }
      }
    }
    return h('div', { class: `medi-msg ai ${msg.local ? 'local' : ''}` },
      aiAvatar(),
      h('div', { class: 'medi-msg-col' },
        body,
        msg.stopped ? h('div', { class: 'medi-stopped' }, icon('info', { size: 14 }), 'შეჩერდა · ეს პასუხი არ შეინახა') : null,
        msg.appOnly ? h('a', { class: 'btn btn-secondary btn-sm medi-app-link', href: APP_STORE, target: '_blank', rel: 'noopener' }, icon('smartphone', { size: 16 }), h('span', null, 'MEDICARD აპის გადმოწერა')) : null,
        tools.length || msg.timestamp ? h('div', { class: 'medi-tools' }, tools, msg.timestamp && !msg.streaming && !msg.pending ? h('span', { class: 'medi-meta' }, fmtTime(msg.timestamp)) : null) : null));
  }

  function paintBody(msg) {
    const el = msg.bodyEl;
    if (!el) return;
    if (msg.pending || (msg.streaming && !msg.content)) {
      mount(el, h('div', { class: 'medi-thinking' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i')), h('span', null, msg.label || mode().thinking)));
      return;
    }
    const md = markdown(msg.content);
    if (msg.streaming) {
      let target = md.lastElementChild || md;
      if (target.tagName === 'UL' || target.tagName === 'OL') target = target.lastElementChild || target;
      target.append(h('span', { class: 'medi-caret', 'aria-hidden': 'true' }));
    }
    mount(el, md);
  }

  let paintQueued = false;
  let lastPaint = 0;
  function schedulePaint(msg) {
    if (paintQueued) return;
    paintQueued = true;
    const wait = Math.max(0, 60 - (performance.now() - lastPaint));
    setTimeout(() => requestAnimationFrame(() => {
      paintQueued = false;
      lastPaint = performance.now();
      if (!alive) return;
      const stick = nearBottom();
      paintBody(msg);
      if (stick) scrollToEnd(true);
    }), wait);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('დაკოპირდა'); }
    catch { toast('კოპირება ვერ მოხერხდა', 'error'); }
  }

  async function rate(index, rating) {
    const msg = st.messages[index];
    if (!msg?.interactionId || msg.feedbackRating) return;
    msg.feedbackRating = rating;
    renderThread();
    try {
      await post('/api/ai/feedback', { interactionId: msg.interactionId, rating });
      if (same()) toast('მადლობა შეფასებისთვის');
    } catch {
      if (!same()) return;
      msg.feedbackRating = undefined;
      renderThread();
      toast('შეფასება ვერ შეინახა', 'error');
    }
  }

  /* ── Status line (error / consent note / draft) ──────── */
  function renderStatus() {
    clear(status);
    if (st.note) {
      status.append(h('div', { class: 'medi-note' }, icon('shield', { size: 16 }),
        h('span', null, st.note),
        h('a', { href: '/profile', 'data-link': '', class: 'link' }, 'პროფილი'),
        iconButton('x', { title: 'დახურვა', size: 16, onClick: () => { st.note = null; renderStatus(); } })));
    }
    if (st.error) {
      status.append(h('div', { class: 'medi-error', role: 'alert' }, icon('alert', { size: 16 }),
        h('span', null, st.error),
        st.failed ? h('button', { type: 'button', class: 'medi-retry', onClick: () => { const f = st.failed; st.failed = null; st.error = null; renderStatus(); send(f.text, f.petId); } }, icon('refresh', { size: 14 }), 'ხელახლა') : null,
        iconButton('x', { title: 'დახურვა', size: 16, onClick: () => { st.error = null; st.failed = null; renderStatus(); } })));
    }
    if (st.mode === 'medi' && st.draft && !st.review) {
      const label = toolLabel(st.draft.tool);
      status.append(h('div', { class: 'medi-draft' }, icon('edit', { size: 15 }),
        h('span', null, 'მიმდინარე: ', h('b', null, label), ' — უპასუხე Medi-ს კითხვას'),
        h('button', { type: 'button', class: 'medi-retry', onClick: cancelReview }, 'გაუქმება')));
    }
  }

  /* ── Conversation lifecycle ─────────────────────────── */
  function abortCurrent() {
    generation++;
    if (st.controller) { st.stopRequested = false; try { st.controller.abort(); } catch { /* ignore */ } }
    st.controller = null;
    st.busy = false;
  }

  function openConversation(nextMode, sessionId, { push = false } = {}) {
    abortCurrent();
    st.mode = MODES[nextMode] ? nextMode : 'medi';
    st.conv = { sessionId: sessionId || null, key: (st.conv?.key || 0) + 1 };
    st.messages = [];
    st.review = null; st.draft = null; st.suggestions = []; st.receipt = null;
    st.error = null; st.failed = null; st.note = null;
    st.persistChain = Promise.resolve();
    st.loadState = sessionId ? 'loading' : 'ready';
    ta.placeholder = mode().placeholder;
    renderHead();
    renderStatus();
    renderThread();
    renderSide();
    syncUrl(push);
    ctx.setTitle('Medi');
    if (sessionId) loadConversation();
    else if (st.mode !== 'medi') consumeStaged();
    if (st.mode === 'medi') loadCatalog();
    if (matchMedia('(pointer: fine)').matches) ta.focus({ preventScroll: true });
  }

  async function loadConversation() {
    const conv = st.conv;
    st.loadState = 'loading';
    renderThread();
    try {
      const r = await get(`/api/chats/${encodeURIComponent(conv.sessionId)}`);
      if (!same() || conv !== st.conv) return;
      const s = r.session || {};
      const m = modeForSession(s.mode);
      if (m !== st.mode) { st.mode = m; ta.placeholder = mode().placeholder; renderHead(); syncUrl(false); if (m === 'medi') loadCatalog(); }
      st.messages = (Array.isArray(s.messages) ? s.messages : []).map((x) => ({
        role: x.role === 'user' ? 'user' : 'assistant', content: String(x.content || ''), timestamp: x.timestamp, interactionId: x.interactionId,
      }));
      st.loadState = 'ready';
      ctx.setTitle(s.title ? `Medi · ${s.title}` : 'Medi');
      renderThread();
      renderSide();
      scrollToEnd(true);
    } catch (e) {
      if (!same() || conv !== st.conv) return;
      if (e instanceof ApiError && e.status === 404) {
        toast('საუბარი ვერ მოიძებნა', 'info');
        openConversation(st.mode, null);
        return;
      }
      st.loadState = 'error';
      renderThread();
    }
  }

  function consumeStaged() {
    const s = staged;
    if (!s || s.owner !== owner || s.mode !== st.mode || s.expires < Date.now() || consumedOps.has(s.operationId)) return;
    staged = null;
    consumedOps.add(s.operationId);
    if (s.message) { setComposer(s.message, false); send(s.message); }
  }

  /* ── Sending ─────────────────────────────────────────── */
  function submit() {
    const text = ta.value;
    if (!text.trim() || st.busy || st.loadState !== 'ready') return;
    send(text);
  }

  function stop() {
    if (!st.busy || !st.controller) return;
    st.stopRequested = true;
    st.controller.abort();
  }

  async function send(text, petId) {
    if (st.busy || st.loadState !== 'ready') return;
    const value = String(text || '').trim();
    if (!value) return;
    if (value.length > LIMIT) { st.error = `შეტყობინება ძალიან გრძელია (მაქს. ${LIMIT} სიმბოლო).`; renderStatus(); return; }
    st.note = null; st.error = null; st.failed = null;
    if (st.mode === 'medi') {
      const intent = dialogIntent(value);
      if (st.review && intent === 'confirm') { setComposer('', false); await confirmReview(); return; }
      if ((st.review || st.draft) && intent === 'cancel') { setComposer('', false); cancelReview(); return; }
    } else if (value.length < 2) {
      st.error = 'შეკითხვა ძალიან მოკლეა.'; renderStatus(); return;
    }
    renderStatus();
    st.busy = true;
    updateSend();
    const gen = ++generation;
    let result;
    try {
      result = await withAiConsent(() => (st.mode === 'medi' ? runPlan(value, gen, petId) : runConsult(value, gen)));
    } catch (e) {
      if (gen === generation && same()) {
        st.error = errorText(e, 'კავშირი შეფერხდა. სცადე ხელახლა.');
        st.failed = { text: value, petId };
        setComposer(value, false);
      }
    } finally {
      if (gen === generation && same()) {
        st.busy = false;
        st.controller = null;
        st.stopRequested = false;
        if (result?.declined) {
          // Declining is a valid choice: nothing was sent. A quiet note, not an error.
          st.note = 'შეტყობინება AI-ს არ გაეგზავნა. თანხმობას ნებისმიერ დროს შეცვლი პროფილში.';
          if (!ta.value.trim()) setComposer(value, false);
        }
        renderStatus();
        renderThread();
        if (matchMedia('(pointer: fine)').matches) ta.focus({ preventScroll: true });
      }
    }
  }

  function historyTurns() {
    return st.messages.filter((m) => !m.local && !m.pending && !m.streaming && m.content.trim())
      .slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, LIMIT) }));
  }

  /** DOCTOR / CONSILIUM: SSE `data: {type:'delta'|'done'|'error'}` from /api/ai/query. */
  async function runConsult(message, gen) {
    const conv = st.conv;
    const ctrl = new AbortController();
    st.controller = ctrl;
    st.stopRequested = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 180_000);
    const now = new Date().toISOString();
    const userMsg = { role: 'user', content: message, timestamp: now };
    const aiMsg = { role: 'assistant', content: '', timestamp: now, streaming: true };
    st.messages.push(userMsg, aiMsg);
    setComposer('', false);
    renderThread();
    scrollToEnd(true);
    const live = () => gen === generation && same() && conv === st.conv;
    let done = null;
    try {
      await stream('/api/ai/query', {
        message, mode: mode().api, ...(conv.sessionId ? { sessionId: conv.sessionId } : {}), stream: true,
      }, (event, data) => {
        if (!live()) return;
        const type = (data && typeof data === 'object' && data.type) || event;
        if (type === 'delta' && data.text) { aiMsg.content += data.text; schedulePaint(aiMsg); }
        else if (type === 'done') done = data;
        else if (type === 'error') throw new ApiError(data?.error || 'პასუხი ვერ მივიღე. სცადე ხელახლა.', Number(data?.status) || 502, { code: 'AI_ENGINE_ERROR' });
      }, { signal: ctrl.signal });
      if (!live()) return {};
      if (!done || typeof done.answer !== 'string' || !done.answer.trim()) throw new ApiError('პასუხი სრულად ვერ მივიღეთ. გთხოვ, სცადე ხელახლა.', 502);
      aiMsg.content = done.answer;
      aiMsg.streaming = false;
      aiMsg.interactionId = done.interactionId;
      aiMsg.timestamp = new Date().toISOString();
      const first = !conv.sessionId;
      conv.sessionId = done.sessionId || conv.sessionId;
      if (first) syncUrl(false);
      if (done.title) ctx.setTitle(`Medi · ${done.title}`);
      invalidate('/api/quests');
      refreshSessions();
      return done;
    } catch (e) {
      if (!live()) return {};
      const idx = st.messages.indexOf(aiMsg);
      if (ctrl.signal.aborted && st.stopRequested) {
        // Stopped by the person: keep what arrived, clearly marked as not saved (the server discards it).
        aiMsg.streaming = false;
        if (aiMsg.content.trim()) aiMsg.stopped = true;
        else { st.messages.splice(idx - 1, 2); setComposer(message, false); }
        return {};
      }
      if (idx >= 0) st.messages.splice(idx - 1, 2);
      if (timedOut) throw new ApiError('პასუხის მოლოდინის დრო ამოიწურა. გთხოვ, სცადე ხელახლა.', 408);
      if (e instanceof ApiError) throw e;
      throw new ApiError('ინტერნეტთან კავშირი ვერ დამყარდა.', 0);
    } finally {
      clearTimeout(timer);
      if (!ctrl.signal.aborted) ctrl.abort(); // release the stream if an error event ended it early
    }
  }

  /** Medi planner: reply + optional signed review / partial draft. */
  async function runPlan(value, gen, petId) {
    const conv = st.conv;
    const ctrl = new AbortController();
    st.controller = ctrl;
    st.stopRequested = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 120_000);
    const currentDraft = st.review ? { tool: st.review.tool, args: st.review.args } : st.draft;
    const history = historyTurns();
    const now = new Date().toISOString();
    const userMsg = { role: 'user', content: value, timestamp: now };
    const pending = { role: 'assistant', content: '', pending: true, timestamp: now };
    st.messages.push(userMsg, pending);
    st.review = null; st.suggestions = []; st.receipt = null;
    setComposer('', false);
    renderStatus();
    renderThread();
    scrollToEnd(true);
    const live = () => gen === generation && same() && conv === st.conv;
    try {
      const result = await post('/api/assistant/plan', {
        text: value, scope: 'auto', history, draft: currentDraft || null, ...(petId ? { subjectId: petId } : {}),
      }, { signal: ctrl.signal });
      if (!live()) return {};
      Object.assign(pending, { content: String(result.reply || ''), pending: false, timestamp: new Date().toISOString() });
      st.review = result.review || null;
      st.draft = result.review ? null : result.draft || null;
      st.suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
      persist(conv, [{ role: 'user', content: value }, { role: 'assistant', content: pending.content }]);
      scrollToEnd(true);
      return result;
    } catch (e) {
      if (!live()) return {};
      const idx = st.messages.indexOf(pending);
      if (idx >= 0) st.messages.splice(idx - 1, 2);
      st.draft = currentDraft || null;
      if (ctrl.signal.aborted && st.stopRequested) { setComposer(value, false); return {}; }
      if (timedOut) throw new ApiError('პასუხის მოლოდინის დრო ამოიწურა. გთხოვ, სცადე ხელახლა.', 408);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Medi conversations are saved as ChatSession mode ASSISTANT (same as the app). */
  function persist(conv, turns) {
    const clean = turns.map((t) => ({ role: t.role, content: String(t.content || '').slice(0, LIMIT) })).filter((t) => t.content.trim());
    if (!clean.length) return;
    st.persistChain = st.persistChain
      .then(() => post('/api/chats/assistant', { ...(conv.sessionId ? { sessionId: conv.sessionId } : {}), turns: clean }))
      .then((r) => {
        if (!same() || !r?.sessionId) return;
        const first = !conv.sessionId;
        conv.sessionId = r.sessionId;
        if (conv === st.conv && first) syncUrl(false);
        refreshSessions();
      })
      .catch(() => undefined);
  }

  /* ── Planner review / task card ─────────────────────── */
  async function loadCatalog() {
    if (st.catalog) return;
    try {
      const c = await get('/api/assistant/catalog', { scope: 'auto' });
      if (!same()) return;
      st.catalog = c;
      if (st.mode === 'medi') { renderStatus(); renderThread(); }
    } catch { /* the conversation works without it; labels fall back */ }
  }
  const tools = () => st.catalog?.tools || [];
  const choices = () => st.catalog?.choices || {};
  function toolLabel(name) { return tools().find((t) => t.name === name)?.label || 'ჩანაწერი'; }
  function isHandoff(name) { return tools().find((t) => t.name === name)?.kind === 'handoff' || HANDOFF_TOOLS.includes(name); }

  function reviewRows(action) {
    const ch = choices();
    return Object.entries(action.args || {}).filter(([k]) => !HIDDEN_ROWS.has(k)).map(([key, value]) => {
      const list = key === 'id' ? (action.tool.startsWith('visit_') ? ch.visitId : ch.medicationId)
        : key === 'breedId' ? ch[`breedId:${action.args.speciesId}`]
          : key === 'productId' ? ch[`productId:${action.args.petId}`] : ch[key];
      const named = Array.isArray(list) ? list.find((o) => o.value === value)?.label : null;
      const label = key === 'petId' ? 'ცხოველი' : key === 'medicationId' ? 'მედიკამენტი' : key === 'id' ? 'ჩანაწერი' : key === 'dueTime' ? 'დრო' : FIELD_LABELS[key] || key;
      return { key, label, value: named || display(value) };
    }).filter((r) => r.value !== '');
  }

  function taskEl() {
    if (st.busy && !st.review) return null;
    const wrap = h('div', { class: 'medi-task' });
    if (st.suggestions.length) {
      wrap.append(h('div', { class: 'medi-suggest' }, st.suggestions.map((s) => h('button', {
        type: 'button', class: 'chip', onClick: () => send(s.text, s.petId),
      }, s.label))));
    }
    if (st.review) {
      const r = st.review;
      const handoff = isHandoff(r.tool);
      const rows = reviewRows(r);
      const saveBtn = button(handoff ? 'გახსნა' : 'შენახვა', { variant: 'primary', icon: handoff ? 'arrowRight' : 'check', onClick: () => confirmReview() });
      wrap.append(h('div', { class: 'medi-review' },
        h('div', { class: 'medi-review-head' },
          h('span', { class: `tile ink-${r.tool.startsWith('pet_') ? 'amber' : 'teal'}`, style: { width: '38px', height: '38px' } }, icon(r.tool.startsWith('pet_') ? 'paw' : handoff ? 'externalLink' : 'check', { size: 18 })),
          h('div', null,
            h('div', { class: 'medi-review-kicker' }, handoff ? 'მზადაა გასახსნელად' : 'გადაამოწმე შენახვამდე'),
            h('div', { class: 'medi-review-title' }, r.label || toolLabel(r.tool)))),
        rows.length ? h('dl', { class: 'medi-review-rows' }, rows.map((row) => h('div', null, h('dt', null, row.label), h('dd', null, row.value)))) : null,
        handoff ? null : h('p', { class: 'medi-review-hint' }, 'შესასწორებლად უბრალოდ დაწერე, რა შევცვალო — მაგ. „არა, 200 მლ“.'),
        h('div', { class: 'medi-review-actions' },
          button('გაუქმება', { variant: 'ghost', onClick: cancelReview }),
          saveBtn)));
    }
    return wrap.childNodes.length ? wrap : null;
  }

  function cancelReview() {
    if (st.busy) return;
    st.review = null; st.draft = null; st.suggestions = []; st.receipt = null;
    const reply = 'კარგი, გაუქმებულია.';
    st.messages.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString() });
    persist(st.conv, [{ role: 'assistant', content: reply }]);
    renderStatus();
    renderThread();
    scrollToEnd(true);
  }

  async function confirmReview() {
    const current = st.review;
    if (!current || st.busy) return;
    const conv = st.conv;
    const gen = ++generation;
    st.busy = true;
    st.error = null;
    renderStatus();
    renderThread();
    const handoff = isHandoff(current.tool);
    const pending = { role: 'assistant', content: '', pending: true, label: handoff ? 'ვხსნი…' : 'ვინახავ…' };
    st.messages.push(pending);
    renderThread();
    scrollToEnd(true);
    const live = () => gen === generation && same() && conv === st.conv;
    try {
      const result = await post('/api/assistant/execute', { token: current.token, confirmed: true }, { timeoutMs: 60_000 });
      if (!live()) return;
      st.messages.splice(st.messages.indexOf(pending), 1);
      st.review = null; st.draft = null; st.suggestions = [];
      if (result.native) {
        handleNative(result.native, result.operationId);
        return;
      }
      const petName = (choices().petId || []).find((p) => p.value === current.args.petId)?.label;
      const reply = current.tool === 'medication_add' ? `${String(current.args.medName)} დამატებულია.`
        : current.tool === 'pet_care_plan' && petName ? `${petName}ს გეგმა შენახულია — ${String(current.args.startOn)}${current.args.dueTime ? `, ${String(current.args.dueTime)}` : ''}.`
          : 'შენახულია.';
      st.messages.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString() });
      persist(conv, [{ role: 'assistant', content: reply }]);
      invalidate(''); // the write went through the server's own domain endpoint: re-read everything
      st.catalog = null;
      loadCatalog();
      toast('შენახულია');
    } catch (e) {
      if (!live()) return;
      const idx = st.messages.indexOf(pending);
      if (idx >= 0) st.messages.splice(idx, 1);
      st.error = errorText(e, 'მოქმედება ვერ შესრულდა.');
    } finally {
      if (gen === generation && same()) {
        st.busy = false;
        renderStatus();
        renderThread();
        scrollToEnd(true);
      }
    }
  }

  /** A confirmed handoff: consultation switches mode in place; pages open on the web when they exist. */
  function handleNative(native, operationId) {
    const route = String(native?.route || '');
    const chat = /^\/chat\/([^/?#]+)/.exec(route);
    if (chat) {
      const target = modeFromParam(chat[1]) === 'deep' ? 'deep' : 'doctor';
      if (native.message && operationId && !consumedOps.has(operationId)) {
        staged = { owner, mode: target, message: String(native.message).slice(0, LIMIT), operationId, expires: Date.now() + 60_000 };
      }
      openConversation(target, null, { push: true });
      return;
    }
    const web = webRouteFor(route);
    if (web) { ctx.navigate(web); return; }
    const reply = 'ეს ფუნქცია MEDICARD აპშია — იქ გააგრძელე.';
    st.messages.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString(), local: true, appOnly: true });
  }

  /* ── Capability directory ("რას აკეთებს Medi") ───────── */
  const FEATURE_WEB = {
    home: '/', metrics: '/health', hydration: '/health', hydration_history: '/health', hydration_calendar: '/health', hydration_log: '/health',
    weight: '/health', weight_history: '/health', weight_goal: '/health', weight_progress: '/health', steps: '/health', steps_history: '/health',
    steps_goal: '/health', steps_progress: '/health', week: '/health',
    nutrition: '/nutrition', nutrition_diary: '/nutrition', nutrition_goal: '/nutrition', nutrition_plan: '/nutrition', nutrition_progress: '/nutrition',
    medications: '/medications', medication_add: '/medications', medication_reminders: '/medications', medication_calendar: '/medications', medication_interactions: '/medications',
    visits: '/visits', visit_editor: '/visits',
    cycle: '/cycle', cycle_log: '/cycle', cycle_journal: '/cycle', cycle_trends: '/cycle', cycle_summary: '/cycle', cycle_settings: '/cycle', pregnancy: '/cycle', pregnancy_timeline: '/cycle', pregnancy_care: '/cycle',
    lab: '/lab', lab_history: '/lab', records: '/records',
    quest: '/quest', quest_achievements: '/quest', quest_history: '/quest', quest_wallet: '/quest', quest_rewards: '/quest', quest_mine: '/quest',
    pets: '/pets', pet_add: '/pets',
    profile: '/profile', health_profile: '/profile', settings: '/profile', ai_sharing: '/profile', ai_settings: '/profile', privacy: '/profile', terms: '/profile', notifications: '/profile', streak: '/profile',
  };
  const GROUP_ICON = { daily: ['heart', 'rose'], treatment: ['pill', 'teal'], cycle: ['flower', 'rose'], analysis: ['stethoscope', 'blue'], activity: ['footprints', 'green'], pets: ['paw', 'amber'], account: ['settings', 'neutral'] };

  async function openDirectory() {
    const body = h('div', { class: 'medi-dir' }, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk', style: { width: '70%' } })));
    const m = openModal({ title: 'რას აკეთებს Medi', size: 'lg', body });
    try {
      await loadCatalog();
      if (!st.catalog) st.catalog = await get('/api/assistant/catalog', { scope: 'auto' });
    } catch (e) {
      mount(body, h('div', { class: 'error-box' }, icon('alert', { size: 20 }), h('div', null, h('strong', null, 'ვერ ჩაიტვირთა'), h('p', null, e?.message || ''))));
      return;
    }
    const c = st.catalog || {};
    const writes = (c.tools || []).filter((t) => t.kind === 'write');
    const search = h('input', { class: 'input', type: 'search', placeholder: 'მოძებნე ფუნქცია…', 'aria-label': 'ძებნა' });
    const list = h('div', { class: 'medi-dir-groups' });
    const renderList = () => {
      const q = search.value.trim().toLowerCase();
      clear(list);
      const writeHits = writes.filter((t) => !q || `${t.label} ${t.description}`.toLowerCase().includes(q));
      if (writeHits.length) {
        list.append(h('div', { class: 'medi-dir-group' },
          h('div', { class: 'medi-dir-title' }, icon('message', { size: 16 }), 'ჩაწერა საუბრით'),
          h('p', { class: 'faint', style: { fontSize: '13px', margin: '0 0 10px' } }, 'აირჩიე და დაწერე დეტალები — Medi ჩანაწერს შენახვამდე გადაგამოწმებინებს.'),
          h('div', { class: 'chips' }, writeHits.map((t) => h('button', {
            type: 'button', class: 'chip', title: t.description,
            onClick: () => { m.close(); setComposer(`${t.label}: `); },
          }, t.label)))));
      }
      for (const g of c.groups || []) {
        const feats = (c.features || []).filter((f) => f.group === g.id && (!q || `${f.label} ${f.description}`.toLowerCase().includes(q)));
        if (!feats.length) continue;
        const [ic, ink] = GROUP_ICON[g.id] || ['grid', 'neutral'];
        list.append(h('div', { class: 'medi-dir-group' },
          h('div', { class: 'medi-dir-title' }, h('span', { class: `tile ink-${ink}`, style: { width: '28px', height: '28px' } }, icon(ic, { size: 15 })), g.label),
          h('div', { class: 'medi-dir-grid' }, feats.map((f) => {
            const consult = f.id === 'doctor' ? 'doctor' : f.id === 'consilium' ? 'deep' : null;
            const web = FEATURE_WEB[f.id];
            return h('button', {
              type: 'button', class: 'medi-dir-item',
              onClick: () => {
                m.close();
                if (consult) openConversation(consult, null, { push: true });
                else if (web) ctx.navigate(web);
                else {
                  st.messages.push({ role: 'assistant', content: `„${f.label}“ MEDICARD აპშია — იქ გააგრძელე.`, timestamp: new Date().toISOString(), local: true, appOnly: true });
                  renderThread(); scrollToEnd(true);
                }
              },
            }, h('b', null, f.label), h('span', null, f.description), !consult && !web ? h('em', { class: 'badge badge-neutral' }, 'აპში') : null);
          }))));
      }
      if (!list.childNodes.length) list.append(h('p', { class: 'muted', style: { padding: '20px 0', textAlign: 'center' } }, 'ვერაფერი მოიძებნა.'));
    };
    search.addEventListener('input', renderList);
    renderList();
    mount(body, search, list);
    search.focus();
  }

  /* ── History (left column / modal on mobile) ────────── */
  let refreshTimer = 0;
  function refreshSessions() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadSessions, 400);
  }
  async function loadSessions() {
    try {
      const r = await get('/api/chats');
      if (!same()) return;
      st.sessions = (r.sessions || []).filter((s) => ['ASSISTANT', 'DOCTOR', 'CONSILIUM'].includes(s.mode));
      st.sessionsError = null;
    } catch (e) {
      if (!same()) return;
      st.sessionsError = e;
    }
    renderSide();
  }

  function bucket(v) {
    const d = parseDate(v);
    if (!d) return 'ადრე';
    const diff = Math.round((new Date(ymd()) - new Date(ymd(d))) / 86400000);
    if (diff <= 0) return 'დღეს';
    if (diff === 1) return 'გუშინ';
    if (diff < 7) return 'ბოლო 7 დღე';
    if (diff < 30) return 'ბოლო 30 დღე';
    return 'ადრე';
  }

  function historyList(onPick) {
    const wrap = h('div', { class: 'medi-hist' });
    if (st.sessionsError && !st.sessions) {
      wrap.append(h('div', { class: 'medi-hist-empty' }, 'ისტორია ვერ ჩაიტვირთა.', button('ხელახლა', { variant: 'ghost', size: 'sm', onClick: loadSessions })));
      return wrap;
    }
    if (!st.sessions) {
      wrap.append(...Array.from({ length: 6 }, () => h('div', { class: 'medi-hist-sk' }, h('div', { class: 'sk' }), h('div', { class: 'sk', style: { width: '60%' } }))));
      return wrap;
    }
    const q = st.filter.trim().toLowerCase();
    const items = st.sessions.filter((s) => !q || `${s.title || ''} ${s.preview || ''}`.toLowerCase().includes(q));
    if (!items.length) {
      wrap.append(h('div', { class: 'medi-hist-empty' }, q ? 'ვერაფერი მოიძებნა.' : 'საუბრები აქ გამოჩნდება.'));
      return wrap;
    }
    let last = '';
    for (const s of items) {
      const b = bucket(s.updatedAt);
      if (b !== last) { wrap.append(h('div', { class: 'medi-hist-group' }, b)); last = b; }
      const m = MODES[modeForSession(s.mode)];
      const active = s.id === st.conv.sessionId;
      const d = parseDate(s.updatedAt);
      const when = d ? (bucket(s.updatedAt) === 'დღეს' ? fmtTime(d) : relDay(d) === 'გუშინ' ? 'გუშინ' : fmtDate(d, { short: true })) : '';
      const delBtn = h('button', {
        type: 'button', class: 'medi-hist-del', title: 'წაშლა', 'aria-label': `წაშლა: ${s.title || ''}`,
        onClick: (e) => { e.stopPropagation(); removeSession(s); },
      }, icon('trash', { size: 15 }));
      wrap.append(h('div', {
        class: `medi-hist-item ${active ? 'on' : ''}`, role: 'button', tabindex: '0', 'aria-current': active ? 'true' : undefined,
        onClick: () => { onPick?.(); if (!active) openConversation(modeForSession(s.mode), s.id, { push: true }); },
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } },
      },
      h('span', { class: `tile ink-${m.ink}`, style: { width: '30px', height: '30px' } }, icon(m.icon, { size: 15 })),
      h('div', { class: 'medi-hist-main' },
        h('div', { class: 'medi-hist-title' }, s.title || 'საუბარი'),
        h('div', { class: 'medi-hist-sub' }, h('span', null, m.label), when ? h('span', null, ` · ${when}`) : null)),
      delBtn));
    }
    return wrap;
  }

  function sideTop(onPick) {
    const search = h('input', {
      class: 'input medi-hist-search', type: 'search', placeholder: 'ძებნა საუბრებში', value: st.filter, 'aria-label': 'ძებნა საუბრებში',
      onInput: (e) => { st.filter = e.target.value; const list = e.target.closest('.medi-side, .modal-body')?.querySelector('.medi-hist'); if (list) list.replaceWith(historyList(onPick)); },
    });
    return h('div', { class: 'medi-side-top' },
      button('ახალი საუბარი', { variant: 'primary', icon: 'plus', class: 'medi-new', onClick: () => { onPick?.(); openConversation(st.mode, null, { push: true }); } }),
      search);
  }

  function renderSide() {
    mount(side, sideTop(null), historyList(null));
  }

  let histModal = null;
  function openHistoryModal() {
    const pick = () => histModal?.modal.close();
    const modal = openModal({
      title: 'საუბრები', size: 'md',
      body: h('div', { class: 'medi-side in-modal' }, sideTop(pick), historyList(pick)),
      onClose: () => { histModal = null; },
    });
    histModal = { modal, pick };
  }

  async function removeSession(s) {
    const ok = await confirmDialog({ title: 'საუბრის წაშლა', body: `„${s.title || 'საუბარი'}“ სამუდამოდ წაიშლება.`, confirm: 'წაშლა', danger: true });
    if (!ok || !same()) return;
    try {
      await del(`/api/chats/${encodeURIComponent(s.id)}`);
      if (!same()) return;
      st.sessions = (st.sessions || []).filter((x) => x.id !== s.id);
      if (histModal) histModal.modal.el.querySelector('.medi-hist')?.replaceWith(historyList(histModal.pick));
      toast('საუბარი წაიშალა');
      if (s.id === st.conv.sessionId) openConversation(st.mode, null);
      else renderSide();
    } catch (e) {
      toast(e?.message || 'წაშლა ვერ მოხერხდა', 'error');
    }
  }

  /* ── Boot ────────────────────────────────────────────── */
  // Other pages hand over a draft through sessionStorage (health text never goes in the URL).
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem('medicard.web.mediPrefill') || 'null');
    sessionStorage.removeItem('medicard.web.mediPrefill');
  } catch { stored = null; }
  const fresh = stored && typeof stored.text === 'string' && Date.now() - Number(stored.at || 0) < 5 * 60_000;
  const prefill = fresh ? stored.text.slice(0, LIMIT) : typeof ctx.query.prefill === 'string' ? ctx.query.prefill.slice(0, LIMIT) : '';
  openConversation(st.mode, st.conv.sessionId, { push: false });
  if (prefill) setComposer(prefill, true); // never auto-sent; the URL is cleaned by syncUrl above
  loadSessions();

  return () => {
    alive = false;
    generation++;
    clearTimeout(refreshTimer);
    try { st.controller?.abort(); } catch { /* ignore */ }
  };
}
