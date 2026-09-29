// MEDICARD web — MEDI COACH trainer workspace (/coach, /coach/:section, /coach/:section/:id).
// Mirrors mobile/app/coach/** (index, clients, client/[id], calendar, session-new, session/[id], plan/[clientId],
// goal/[clientId], profile, scan) and server/src/routes/trainer.routes.js (`coach` router) +
// lib/trainerStore.js. Only VERIFIED trainers get the workspace (requireVerifiedTrainer); a trainer sees a
// client's data only for the scopes the client granted (requireClientAccess) — everything else is a locked
// card, never placeholder numbers. Times are TIMESTAMPTZ and shown in the browser's local time.
import {
  h, mount, clear, icon, tile, pageHead, section, card, button, iconButton, busy, badge, stat, empty, skeleton,
  errorBox, segmented, field, input, textarea, select, toggle, toast, openModal, confirmDialog,
  fmtDate, fmtTime, fmtNum, relDay, ymd, addDays, parseDate, debounce, KA_MONTHS, KA_MONTHS_SHORT, KA_DAYS, KA_DAYS_SHORT,
} from '../ui.js';
import { get, post, patch, del, authedBlobUrl, ApiError } from '../api.js';
import { lineChart, barChart, ring, donut } from '../charts.js';
import { session } from '../session.js';
import { qrMatrix } from './coachQr.js';
import { t, plural } from '../i18n.js';

const CSS = '/app/css/coach.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

const APP_STORE = 'https://apps.apple.com/app/id6812517519';
const SUPPORT_EMAIL = 'support@medicard.ge';
const API = '/api/trainer/coach';

/* ── Copy (mobile/src/lib/coach.ts) ───────────────────── */
const SESSION_STATUS = { OPEN: t('თავისუფალი', 'Open'), SCHEDULED: t('დაგეგმილი', 'Scheduled'), CANCELLED: t('გაუქმდა', 'Cancelled'), DONE: t('ჩატარდა', 'Done'), NO_SHOW: t('არ მოვიდა', 'No-show') };
const DAY_STATUS = { ON: t('გეგმაში', 'On plan'), OVER: t('გადააჭარბა', 'Over'), UNDER: t('ცოტა ჭამა', 'Under'), LOW_PROTEIN: t('ცილა აკლდა', 'Low protein'), PENDING: t('მიმდინარე', 'In progress'), NONE: t('არ ჩაწერა', 'Not logged') };
const DAY_COLOR = { ON: 'var(--ok)', OVER: 'var(--danger)', UNDER: 'var(--warn)', LOW_PROTEIN: 'var(--warn)', PENDING: 'var(--brand-2)', NONE: 'var(--bg3)' };
const GOAL_TYPE = { lose: t('წონის კლება', 'Lose weight'), gain: t('წონის მატება', 'Gain weight'), recomp: t('რეკომპოზიცია', 'Recomposition'), performance: t('ფორმა და ძალა', 'Fitness and strength') };
const POSE = { FRONT: t('წინიდან', 'Front'), SIDE: t('გვერდიდან', 'Side'), BACK: t('ზურგიდან', 'Back'), OTHER: t('სხვა', 'Other') };
const SCOPES = ['workouts', 'nutrition', 'weight', 'photos'];
const SCOPE_COPY = {
  workouts: { title: t('ვარჯიშები და აქტივობა', 'Workouts and activity'), short: t('ვარჯიში', 'Workouts'), icon: 'activity', body: t('ნაბიჯები, აქტიური წუთები, პულსი, ძილი და ვარჯიშები Apple Health / Health Connect-იდან.', 'Steps, active minutes, heart rate, sleep and workouts from Apple Health / Health Connect.') },
  nutrition: { title: t('კვება', 'Nutrition'), short: t('კვება', 'Nutrition'), icon: 'utensils', body: t('კვების დღიური, კალორიები, მაკროები და შენი გეგმის დაცვა.', 'Food diary, calories, macros and how well your plan is followed.') },
  weight: { title: t('წონა და მიზანი', 'Weight and goal'), short: t('წონა', 'Weight'), icon: 'scale', body: t('აწონვები, წონის მიზანი და პროგრესი.', 'Weigh-ins, weight goal and progress.') },
  photos: { title: t('პროგრეს-ფოტოები', 'Progress photos'), short: t('ფოტოები', 'Photos'), icon: 'camera', body: t('„მანამდე / შემდეგ“ ფოტოები. კლიენტთან ნაგულისხმევად გამორთულია.', 'Before / after photos. Off by default for the client.') },
};
const KIND_FALLBACK = { STRENGTH: t('ძალოვანი', 'Strength'), CARDIO: t('კარდიო', 'Cardio'), HIIT: 'HIIT', FUNCTIONAL: t('ფუნქციური', 'Functional'), MOBILITY: t('მობილობა', 'Mobility'), ASSESSMENT: t('შეფასება / გაზომვა', 'Assessment / measurements'), ONLINE: t('ონლაინ', 'Online') };
const WORKOUT_KIND = {
  traditionalStrengthTraining: t('ძალოვანი ვარჯიში', 'Strength training'), functionalStrengthTraining: t('ფუნქციური ვარჯიში', 'Functional training'), highIntensityIntervalTraining: 'HIIT',
  running: t('სირბილი', 'Running'), walking: t('სიარული', 'Walking'), cycling: t('ველოსიპედი', 'Cycling'), swimming: t('ცურვა', 'Swimming'), yoga: t('იოგა', 'Yoga'), pilates: t('პილატესი', 'Pilates'), boxing: t('ბოქსი', 'Boxing'),
  crossTraining: t('კროს-ტრენინგი', 'Cross-training'), elliptical: t('ელიფსური', 'Elliptical'), rowing: t('ნიჩბოსნობა', 'Rowing'), coreTraining: t('კორი', 'Core'), flexibility: t('მოქნილობა', 'Flexibility'),
  mixedCardio: t('კარდიო', 'Cardio'), stairClimbing: t('კიბეები', 'Stairs'), other: t('ვარჯიში', 'Workout'),
};
const workoutKind = (k) => WORKOUT_KIND[k] || WORKOUT_KIND[String(k || '').replace(/^EXERCISE_TYPE_/, '').toLowerCase()] || t('ვარჯიში', 'Workout');
const REPORT_REASONS = [
  ['harassment', t('შეურაცხყოფა ან შევიწროება', 'Abuse or harassment')], ['inappropriate', t('შეუფერებელი შინაარსი ან ფოტო', 'Inappropriate content or photo')], ['unsafe', t('სახიფათო ან არაპროფესიული რჩევა', 'Unsafe or unprofessional advice')],
  ['spam', t('სპამი ან რეკლამა', 'Spam or advertising')], ['impersonation', t('ყალბი პროფილი ან სერტიფიკატი', 'Fake profile or certificate')], ['other', t('სხვა', 'Other')],
];
const MEAL_SLOTS = [
  { key: 'breakfast', label: t('საუზმე', 'Breakfast'), time: '08:30' }, { key: 'snack1', label: t('წახემსება', 'Snack'), time: '11:30' }, { key: 'lunch', label: t('სადილი', 'Lunch'), time: '14:00' },
  { key: 'preworkout', label: t('ვარჯიშამდე', 'Pre-workout'), time: '17:30' }, { key: 'postworkout', label: t('ვარჯიშის შემდეგ', 'Post-workout'), time: '20:00' },
  { key: 'snack2', label: t('მეორე წახემსება', 'Second snack'), time: '17:00' }, { key: 'dinner', label: t('ვახშამი', 'Dinner'), time: '20:30' },
];
const QUICK_EX = t(
  ['ბექ სქვოთი', 'ჟიმი წოლით', 'მკვდარი წევა', 'ჟიმი ზემოთ', 'აზიდვა', 'ლანჯი', 'რუმინული წევა', 'ქვედა ბლოკი', 'პლანკა', 'კარდიო'],
  ['Back squat', 'Bench press', 'Deadlift', 'Overhead press', 'Pull-up', 'Lunge', 'Romanian deadlift', 'Seated cable row', 'Plank', 'Cardio'],
);
const DURATIONS = [30, 45, 60, 75, 90, 120];
const INVITE_TEXT = (code) => t(`ვარჯიშები, კვების გეგმა და პროგრესი ერთად — MEDICARD-ში. შემომიერთდი ჩემი კოდით ${code}: https://medicard.ge/c/${code}`, `Workouts, meal plan and progress in one place — on MEDICARD. Join me with my code ${code}: https://medicard.ge/c/${code}`);

/* ── Small helpers ────────────────────────────────────── */
const firstWord = (s) => String(s || '').trim().split(/\s+/)[0] || '';
const genderKa = (g) => (g === 'FEMALE' ? t('ქალი', 'Female') : g === 'MALE' ? t('კაცი', 'Male') : null);
const personLine = (p) => [p.age ? t(`${p.age} წ.`, `${p.age} y`) : null, genderKa(p.gender), p.heightCm ? t(`${p.heightCm} სმ`, `${p.heightCm} cm`) : null].filter(Boolean).join(' · ');
const localYmd = (iso) => ymd(new Date(iso));
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const mondayOf = (d) => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const kindLabel = (s, catalog) => s.kindLabel || catalog?.sessionKinds?.find((k) => k.key === s.kind)?.label || KIND_FALLBACK[s.kind] || s.kind;
const shortDay = (v) => { const d = parseDate(v); return `${KA_DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${KA_MONTHS_SHORT[d.getMonth()]}`; };
const longDay = (v) => { const d = parseDate(v); return `${KA_DAYS[d.getDay()]}, ${d.getDate()} ${KA_MONTHS[d.getMonth()]}`; };
function dayWithRel(v) {
  const r = relDay(v);
  return ['დღეს', 'გუშინ', 'ხვალ', 'Today', 'Yesterday', 'Tomorrow'].includes(r) ? `${r}, ${fmtDate(v)}` : shortDay(v);
}
function initialsOf(name) {
  const n = String(name || '').trim();
  if (!n) return '?';
  return n.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}
function avatarEl(name, url, size = 38, opts = {}) {
  const el = h('span', { class: 'avatar co-av', style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(11, Math.round(size * 0.36))}px` }, 'aria-hidden': 'true' }, initialsOf(name));
  if (url) authedBlobUrl(url).then((src) => { if (src) mount(el, h('img', { src, alt: '' })); }).catch(() => {});
  if (!opts.verified) return el;
  return h('span', { class: 'co-av-wrap' }, el, h('span', { class: 'co-av-check', title: t('დადასტურებული ტრენერი', 'Verified trainer') }, icon('check', { size: Math.max(10, Math.round(size * 0.16)), stroke: 3 })));
}
function timing(startsAt, durationMin, now = Date.now()) {
  const start = new Date(startsAt).getTime();
  const end = start + durationMin * 60000;
  if (now >= start && now < end) return { phase: 'live', text: t(`მიმდინარეობს · ${Math.max(1, Math.round((end - now) / 60000))} წთ დარჩა`, `In progress · ${Math.max(1, Math.round((end - now) / 60000))} min left`) };
  if (now >= end) return { phase: 'past', text: t('დასრულდა', 'Finished') };
  const min = Math.round((start - now) / 60000);
  if (min < 60) return { phase: 'soon', text: t(`${Math.max(1, min)} წუთში`, `in ${Math.max(1, min)} min`) };
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  if (hh >= 24) return { phase: 'soon', text: dayWithRel(startsAt) };
  return { phase: 'soon', text: mm && hh < 5 ? t(`${hh} სთ ${mm} წთ-ში`, `in ${hh} h ${mm} min`) : t(`${hh} საათში`, `in ${plural(hh, 'hour')}`) };
}
function relStart(iso) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 0) return t('მიმდინარეობს', 'In progress');
  if (mins < 60) return t(`${mins} წუთში`, `in ${mins} min`);
  if (mins < 6 * 60) return t(`${Math.round(mins / 60)} საათში`, `in ${plural(Math.round(mins / 60), 'hour')}`);
  return `${dayWithRel(iso)} · ${fmtTime(iso)}`;
}
function sessionTone(s) {
  if (s.status === 'DONE') return 'ok';
  if (s.status === 'NO_SHOW') return 'danger';
  if (s.status === 'CANCELLED') return 'neutral';
  if (s.status === 'OPEN') return 'brand';
  return s.clientConfirmedAt ? 'ok' : 'neutral';
}
function sessionPill(s, now = Date.now()) {
  const past = new Date(s.startsAt).getTime() + s.durationMin * 60000 < now;
  if (s.status === 'SCHEDULED' && past && s.clientId) return badge(t('ჩასაწერი', 'To log'), 'warn');
  if (s.status === 'SCHEDULED') return badge(s.clientConfirmedAt ? t('დადასტურდა', 'Confirmed') : t('დასტურს ელოდება', 'Awaiting confirmation'), s.clientConfirmedAt ? 'ok' : 'neutral');
  if (s.status === 'CANCELLED') return badge(s.lateCancel ? t('გვიან გაუქმდა', 'Late cancel') : SESSION_STATUS.CANCELLED, s.lateCancel ? 'warn' : 'neutral');
  return badge(SESSION_STATUS[s.status] || s.status, sessionTone(s));
}
function sessionColor(s, now = Date.now()) {
  if (s.status === 'CANCELLED') return 'var(--bg3)';
  if (s.status === 'DONE') return 'var(--ok)';
  if (s.status === 'NO_SHOW') return 'var(--danger)';
  if (s.status === 'OPEN') return 'var(--text3)';
  if (new Date(s.startsAt).getTime() + s.durationMin * 60000 < now) return 'var(--warn)';
  return 'var(--brand-2)';
}
async function copyText(text, what = t('დაკოპირდა', 'Copied')) {
  try {
    await navigator.clipboard.writeText(text);
    toast(what);
  } catch {
    toast(t('ვერ დაკოპირდა — მონიშნე და დააკოპირე ხელით.', 'Couldn’t copy — select it and copy it yourself.'), 'info');
  }
}
function scoreTone(score) {
  if (score == null) return 'var(--text3)';
  if (score >= 75) return 'var(--ok)';
  if (score >= 50) return 'var(--warn)';
  return 'var(--danger)';
}
function weekScore(days) {
  const judged = (days || []).filter((d) => d.status !== 'PENDING');
  if (!judged.length) return null;
  return Math.round((judged.filter((d) => d.status === 'ON').length / judged.length) * 100);
}
function expectedWeight(goal, ymdStr) {
  if (!goal?.startedYmd || !goal?.deadlineYmd || !Number.isFinite(goal.startKg)) return null;
  const span = Date.parse(goal.deadlineYmd) - Date.parse(goal.startedYmd);
  if (!(span > 0)) return null;
  const frac = Math.max(0, Math.min(1, (Date.parse(ymdStr) - Date.parse(goal.startedYmd)) / span));
  return Math.round((goal.startKg + (goal.targetKg - goal.startKg) * frac) * 10) / 10;
}
const num = (v) => { const s = String(v ?? '').trim().replace(',', '.'); return s === '' ? null : Number(s); };

/* ── Page entry ───────────────────────────────────────── */
export default async function coachPage(root, ctx) {
  ensureCss();
  const cleanups = [];
  mount(root, h('div', { class: 'co' }, skeleton(2), h('div', { class: 'grid grid-main', style: { marginTop: '16px' } }, skeleton(6), skeleton(4))));
  let me;
  try {
    me = await get('/api/trainer/me');
    session.trainer = me;
  } catch (e) {
    mount(root, errorBox(e, () => coachPage(root, ctx)));
    return undefined;
  }
  let catalog = null;
  const env = {
    root,
    ctx,
    me,
    profile: me.trainerProfile,
    onCleanup: (fn) => cleanups.push(fn),
    async catalog() {
      if (!catalog) catalog = await get('/api/trainer/catalog').catch(() => null);
      return catalog;
    },
    /** A coach endpoint said "not a (verified) trainer" → show the status screen; else an error box. */
    fail(container, e, retry) {
      if (e instanceof ApiError && ['TRAINER_REQUIRED', 'TRAINER_NOT_VERIFIED'].includes(e.code)) {
        get('/api/trainer/me').then((fresh) => { session.trainer = fresh; renderGate(env, fresh); }).catch(() => mount(container, errorBox(e, retry)));
        return;
      }
      mount(container, errorBox(e, retry));
    },
  };
  if (!me.trainerProfile || me.trainerProfile.status !== 'VERIFIED') {
    renderGate(env, me);
    return () => cleanups.forEach((fn) => fn());
  }
  const section = ctx.params.section || 'today';
  const id = ctx.params.id;
  const views = {
    today: () => pageToday(env),
    clients: () => pageClients(env),
    scan: () => pageClients(env, { invite: true }),
    client: () => (id ? pageClient(env, id) : pageClients(env)),
    calendar: () => pageCalendar(env),
    'session-new': () => pageCalendar(env, { create: true }),
    session: () => (id ? pageSession(env, id) : pageCalendar(env)),
    plan: () => (id ? pagePlan(env, id) : pageClients(env)),
    goal: () => (id ? pageGoal(env, id) : pageClients(env)),
    profile: () => pageProfile(env),
  };
  const view = views[section];
  if (!view) {
    const body = frame(env, { active: null, title: t('ტრენერის სივრცე', 'Trainer workspace') });
    mount(body, empty(t('გვერდი ვერ მოიძებნა', 'Page not found'), t('ეს მისამართი ტრენერის სივრცეში არ არსებობს.', 'This address doesn’t exist in the trainer workspace.'), button(t('დღევანდელ დღეზე', 'Go to today'), { href: '/coach' })));
  } else {
    await view();
  }
  return () => cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

/* ── Workspace frame: workspace bar + page head ───────── */
const TABS = [
  { key: 'today', href: '/coach', label: t('დღეს', 'Today'), icon: 'home' },
  { key: 'calendar', href: '/coach/calendar', label: t('კალენდარი', 'Calendar'), icon: 'calendar' },
  { key: 'clients', href: '/coach/clients', label: t('კლიენტები', 'Clients'), icon: 'users' },
  { key: 'profile', href: '/coach/profile', label: t('პროფილი', 'Profile'), icon: 'user' },
];
function frame(env, { active, title, sub, actions = [], back }) {
  const body = h('div', { class: 'co-body' });
  mount(env.root, h('div', { class: 'co' },
    h('div', { class: 'co-bar' },
      h('span', { class: 'co-bar-mode' }, icon('dumbbell', { size: 15 }), t('ტრენერის სივრცე', 'Trainer workspace')),
      h('nav', { class: 'co-nav', 'aria-label': t('ტრენერის სივრცე', 'Trainer workspace') }, TABS.map((tab) => h('a', {
        href: tab.href, 'data-link': '', class: `co-nav-item ${tab.key === active ? 'on' : ''}`, 'aria-current': tab.key === active ? 'page' : undefined,
      }, icon(tab.icon, { size: 17 }), h('span', null, tab.label))))),
    back ? h('a', { class: 'co-back', href: back.href, 'data-link': '' }, icon('chevronLeft', { size: 16 }), back.label) : null,
    pageHead(title, sub, ...actions),
    body));
  return body;
}

/* ── Status gate (no profile / PENDING / REJECTED / SUSPENDED) ── */
function renderGate(env, me) {
  const p = me.trainerProfile;
  const root = env.root;
  if (!p) {
    mount(root, h('div', { class: 'co' },
      pageHead(t('ტრენერის სივრცე', 'Trainer workspace'), t('MEDI COACH — ვერიფიცირებული ფიტნეს ტრენერებისთვის', 'MEDI COACH — for verified fitness trainers')),
      card({ class: 'pad-lg co-gate' },
        tile('dumbbell', 'teal', 52),
        h('h2', null, t('ტრენერის პროფილი არ გაქვს', 'You don’t have a trainer profile')),
        h('p', { class: 'muted' }, t('ტრენერის სივრცე მხოლოდ დადასტურებული ტრენერებისთვისაა. განაცხადი MEDICARD აპში შეიტანება: პროფილი → „ტრენერი ხარ?“ — საჭიროა დადასტურებული ტელეფონი, 18+ ასაკი, დარბაზი და სერტიფიკატი. ადმინისტრაციის დადასტურების შემდეგ აქედანაც იმუშავებ.', 'The trainer workspace is for verified trainers only. You apply in the MEDICARD app: Profile → “Are you a trainer?” — you need a verified phone, to be 18+, a gym and a certificate. Once the MEDICARD team approves you, you can work from here too.')),
        h('div', { class: 'hstack' },
          button(t('ამისთვის გამოიყენე MEDICARD აპი', 'Use the MEDICARD app for this'), { icon: 'smartphone', href: APP_STORE, external: true }),
          button(t('ჩემი ტრენერი (კლიენტის მხარე)', 'My trainer (client side)'), { variant: 'ghost', href: '/trainer' })))));
    return;
  }
  const checks = [
    { ok: Boolean(p.displayName), label: t('სახელი, რომელსაც კლიენტები დაინახავენ', 'The name clients will see') },
    { ok: (p.bio || '').trim().length >= 20, label: t('მოკლე ბიოგრაფია (მინ. 20 სიმბოლო)', 'Short bio (at least 20 characters)') },
    { ok: p.specialties.length > 0, label: t('სპეციალიზაცია', 'Specialties') },
    { ok: p.gyms.length > 0, label: t('დარბაზი, სადაც ვარჯიშობ', 'The gym where you train') },
    { ok: p.certificates.length > 0, label: t('სერტიფიკატის ფოტო — ადმინი მას ამოწმებს', 'Certificate photo — the MEDICARD team checks it') },
    { ok: p.experienceYears != null, label: t('გამოცდილება (წლები)', 'Experience (years)') },
  ];
  const missing = checks.filter((c) => !c.ok);
  const reload = async () => {
    const fresh = await get('/api/trainer/me');
    session.trainer = fresh;
    if (fresh.trainerProfile?.status === 'VERIFIED') env.ctx.navigate('/coach', { replace: true });
    else renderGate(env, fresh);
  };
  const edit = () => openProfileEditor(env, p, reload);
  const addCert = () => openCertificateForm(reload);
  const head = {
    PENDING: { ink: 'amber', icon: 'clock', title: t('განაცხადი განიხილება', 'Application under review'), body: t(`გამოგზავნილია ${p.submittedAt ? fmtDate(p.submittedAt, { year: true }) : ''}. MEDICARD-ის გუნდი ამოწმებს სერტიფიკატს, ტელეფონს და პროფილს. დადასტურებისთანავე აქ გაიხსნება კალენდარი, კლიენტები და მოწვევა.`, `Submitted ${p.submittedAt ? fmtDate(p.submittedAt, { year: true }) : ''}. The MEDICARD team is checking your certificate, phone and profile. As soon as you’re approved, your calendar, clients and invites open here.`) },
    REJECTED: { ink: 'rose', icon: 'alert', title: t('განაცხადს დაზუსტება სჭირდება', 'Your application needs changes'), body: t('ქვემოთ ნახე ადმინისტრაციის კომენტარი, შეასწორე პროფილი და გაგზავნე ხელახლა — სტატუსი ისევ „განიხილება“ გახდება.', 'Read the MEDICARD team’s comment below, fix your profile and send it again — the status goes back to “Under review”.') },
    SUSPENDED: { ink: 'neutral', icon: 'lock', title: t('ტრენერის პროფილი შეჩერებულია', 'Your trainer profile is suspended'), body: t(`კლიენტებთან კავშირები დასრულდა და მომავალი ვარჯიშები გაუქმდა. დეტალებისთვის მოგვწერე: ${SUPPORT_EMAIL}.`, `Your client connections have ended and upcoming sessions were cancelled. For details, write to us: ${SUPPORT_EMAIL}.`) },
  }[p.status] || { ink: 'neutral', icon: 'info', title: t('ტრენერის პროფილი არ არის აქტიური', 'Your trainer profile isn’t active'), body: '' };
  const canEdit = p.status === 'PENDING' || p.status === 'REJECTED';
  mount(root, h('div', { class: 'co' },
    pageHead(t('ტრენერის სივრცე', 'Trainer workspace'), p.displayName),
    h('div', { class: 'grid grid-main' },
      h('div', { class: 'stack', style: { gap: '16px' } },
        card({ class: 'pad-lg co-gate' },
          tile(head.icon, head.ink, 52),
          h('div', { class: 'hstack' }, h('h2', null, head.title), badge({ PENDING: t('განიხილება', 'Under review'), REJECTED: t('უარყოფილი', 'Rejected'), SUSPENDED: t('შეჩერებული', 'Suspended') }[p.status] || p.status, p.status === 'PENDING' ? 'warn' : p.status === 'REJECTED' ? 'danger' : 'neutral')),
          h('p', { class: 'muted' }, head.body),
          p.status === 'REJECTED' && p.reviewNote ? h('div', { class: 'co-note co-note-warn' }, h('b', null, t('ადმინისტრაციის კომენტარი', 'Comment from the MEDICARD team')), h('p', null, p.reviewNote)) : null,
          canEdit ? h('div', { class: 'hstack' },
            button(p.status === 'REJECTED' ? t('შესწორება და ხელახლა გაგზავნა', 'Fix and resubmit') : t('განაცხადის რედაქტირება', 'Edit application'), { icon: 'edit', onClick: edit }),
            button(t('სერტიფიკატის დამატება', 'Add certificate'), { variant: 'ghost', icon: 'award', onClick: addCert })) : button(t(`მოგვწერე: ${SUPPORT_EMAIL}`, `Write to us: ${SUPPORT_EMAIL}`), { variant: 'ghost', icon: 'mail', href: `mailto:${SUPPORT_EMAIL}`, external: true })),
        canEdit ? section(t('განაცხადის შემოწმება', 'Application checklist'), card(
          h('div', { class: 'co-checks' }, checks.map((c) => h('div', { class: `co-check ${c.ok ? 'ok' : ''}` }, icon(c.ok ? 'check' : 'x', { size: 16, stroke: 2.6 }), h('span', null, c.label)))),
          missing.length
            ? h('p', { class: 'faint', style: { marginTop: '12px', fontSize: '13px' } }, t(`რა აკლია: ${missing.map((m) => m.label.split(' — ')[0].toLowerCase()).join(', ')}. სრული პროფილი უფრო სწრაფად მოწმდება.`, `Missing: ${missing.map((m) => m.label.split(' — ')[0].toLowerCase()).join(', ')}. A complete profile is checked faster.`))
            : h('p', { class: 'faint', style: { marginTop: '12px', fontSize: '13px' } }, t('ყველაფერი შევსებულია — დაელოდე დადასტურებას.', 'Everything’s filled in — just wait for approval.')))) : null),
      h('div', { class: 'stack', style: { gap: '16px' } },
        section(t('ასე გხედავენ კლიენტები', 'How clients see you'), publicCard(p)),
        p.certificates.length ? section(t('სერტიფიკატები', 'Certificates'), certificatesCard(p, canEdit ? reload : null)) : null))));
}

/* ── Dashboard („დღეს“) ───────────────────────────────── */
async function pageToday(env) {
  const { profile } = env;
  const openNew = (preset = {}) => openNewSession(env, { ...preset, onDone: () => reload() });
  const body = frame(env, {
    active: 'today',
    title: t(`გამარჯობა, ${firstWord(profile.displayName)}`, `Hi, ${firstWord(profile.displayName)}`),
    sub: longDay(new Date()),
    actions: [
      button(t('კლიენტის მოწვევა', 'Invite a client'), { variant: 'secondary', icon: 'userPlus', onClick: () => openInvite(env, { onDone: () => reload() }) }),
      button(t('ვარჯიშის დანიშვნა', 'Schedule a session'), { icon: 'plus', onClick: () => openNew() }),
    ],
  });
  mount(body, h('div', { class: 'stats-row' }, [0, 1, 2, 3].map(() => skeleton(2))), h('div', { class: 'grid grid-main', style: { marginTop: '24px' } }, skeleton(7), skeleton(5)));

  let data = null;
  let week = [];
  const liveNext = h('div');
  const liveTimeline = h('div');

  const answer = async (btn, linkId, accept, name) => {
    if (!accept && !(await confirmDialog({ title: t('მოთხოვნის უარყოფა', 'Decline request'), body: t(`${name}-ს მოთხოვნა უარყოფილი იქნება.`, `${name}’s request will be declined.`), confirm: t('უარყოფა', 'Decline'), danger: true }))) return;
    await busy(btn, async () => {
      try {
        await post(`${API}/requests/${encodeURIComponent(linkId)}`, { accept });
        toast(accept ? t(`${firstWord(name)} ახლა შენი კლიენტია`, `${firstWord(name)} is now your client`) : t('მოთხოვნა უარყოფილია', 'Request declined'));
        await reload();
      } catch (e) { toast(e.message, 'error'); }
    });
  };

  const renderLive = () => {
    const now = Date.now();
    const todayKey = ymd();
    const todays = week.filter((s) => localYmd(s.startsAt) === todayKey && s.status !== 'CANCELLED').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const booked = todays.filter((s) => s.clientId);
    const toLog = booked.filter((s) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() + s.durationMin * 60000 < now);
    const next = week.filter((s) => s.clientId && s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() + s.durationMin * 60000 > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] || null;
    mount(liveNext, nextUpCard(next, now, toLog.length, () => openNew()));
    const done = booked.filter((s) => s.status === 'DONE').length;
    mount(liveTimeline, todays.length
      ? card({ class: 'co-day' },
        h('div', { class: 'co-day-head' },
          ring({ value: done, max: booked.length || 1, size: 52, stroke: 6, label: `${done}/${booked.length}`, labelScale: 0.26, color: 'var(--ok)' }),
          h('div', { class: 'row-main' },
            h('div', { class: 'card-title' }, booked.length ? t(`${booked.length} ვარჯიში დღეს`, `${plural(booked.length, 'session')} today`) : t('დღეს მხოლოდ თავისუფალი სლოტებია', 'Only open slots today')),
            h('div', { class: 'card-sub', style: toLog.length ? { color: 'var(--warn)' } : null }, toLog.length ? t(`${toLog.length} ჩასაწერია — მონიშნე, ჩატარდა თუ არა`, `${toLog.length} to log — mark whether it took place`) : done ? t(`${done} უკვე ჩატარდა`, `${done} done already`) : t('ყველაფერი წინ არის', 'All still ahead')))),
        timeline(todays, now))
      : card({ class: 'co-empty-card' },
        tile('calendar', 'teal', 48),
        h('div', { class: 'card-title' }, t('დღეს ვარჯიში არ გაქვს', 'No sessions today')),
        h('p', { class: 'muted' }, t('დანიშნე კლიენტთან ან გახსენი თავისუფალი სლოტი — კლიენტი თავად დაჯავშნის.', 'Schedule one with a client or open a free slot — a client can book it themselves.')),
        button(t('ვარჯიშის დანიშვნა', 'Schedule a session'), { icon: 'plus', onClick: () => openNew({ date: ymd() }) })));
  };

  const render = () => {
    const st = data.stats;
    const attended = st.done30 + st.noShow30;
    const upcoming7 = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i)));
    const byDay = (key, pred) => week.filter((s) => localYmd(s.startsAt) === key && pred(s)).length;
    const bookedSeries = upcoming7.map((k) => byDay(k, (s) => s.clientId && s.status !== 'CANCELLED'));
    const openSeries = upcoming7.map((k) => byDay(k, (s) => s.status === 'OPEN'));
    const upcomingList = week.filter((s) => s.status === 'SCHEDULED' && new Date(s.startsAt) > addDays(startOfDay(new Date()), 1)).slice(0, 8);

    mount(body,
      h('div', { class: 'stats-row' },
        card(stat(t('აქტიური კლიენტი', 'Active clients'), fmtNum(st.clients), { icon: 'users', delta: st.requests ? t(`${st.requests} ახალი მოთხოვნა`, `${plural(st.requests, 'new request')}`) : null, deltaTone: 'up' })),
        card(stat(t('ვარჯიში 7 დღეში', 'Sessions in 7 days'), fmtNum(st.weekSessions), { icon: 'calendar' })),
        card(stat(t('ჩატარდა', 'Done'), fmtNum(st.done30), { icon: 'calendarCheck', delta: t('ბოლო 30 დღე', 'Last 30 days') })),
        card(stat(t('დასწრება', 'Attendance'), attended ? `${Math.round((st.done30 / attended) * 100)}%` : '—', { icon: 'target', delta: attended ? t(`${st.noShow30} გამოცდენა`, `${plural(st.noShow30, 'no-show')}`) : t('ჯერ მონაცემი არ არის', 'No data yet'), deltaTone: st.noShow30 ? 'down' : '' }))),
      h('div', { class: 'grid grid-main', style: { marginTop: '28px' } },
        h('div', null,
          section(t('შემდეგი ვარჯიში', 'Next session'), liveNext),
          section(t('დღის განრიგი', 'Today’s schedule'), liveTimeline, { link: { href: '/coach/calendar', label: t('კალენდარი', 'Calendar') } }),
          section(t('მომავალი 7 დღე', 'Next 7 days'), card(
            barChart({
              labels: upcoming7.map((k) => KA_DAYS_SHORT[parseDate(k).getDay()]),
              tipLabels: upcoming7.map((k) => dayWithRel(k)),
              stacked: [{ name: t('კლიენტთან', 'With a client'), values: bookedSeries, color: 'var(--c1)' }, { name: t('თავისუფალი სლოტი', 'Open slot'), values: openSeries, color: 'var(--bg3)' }],
              height: 170,
            }),
            h('div', { class: 'legend', style: { marginTop: '10px' } }, h('span', null, h('i', { style: { background: 'var(--c1)' } }), t('კლიენტთან', 'With a client')), h('span', null, h('i', { style: { background: 'var(--bg3)' } }), t('თავისუფალი სლოტი', 'Open slot'))),
            upcomingList.length ? h('div', { class: 'list', style: { marginTop: '10px' } }, upcomingList.map((s) => sessionRow(s))) : null))),
        h('div', null,
          data.requests.length ? section(t(`ახალი მოთხოვნები · ${data.requests.length}`, `New requests · ${data.requests.length}`), h('div', { class: 'stack' }, data.requests.map((r) => requestCard(r, answer)))) : null,
          section(t('ყურადღება', 'Needs attention'), card({ class: 'co-alerts' }, data.alerts.length
            ? h('div', { class: 'list' }, data.alerts.slice(0, 10).map((a) => h('a', { class: 'row row-link', href: `/coach/client/${a.clientId}`, 'data-link': '' },
              tile(a.tone === 'warn' ? 'alert' : a.tone === 'good' ? 'sparkles' : 'info', a.tone === 'warn' ? 'amber' : a.tone === 'good' ? 'green' : 'neutral', 34),
              h('div', { class: 'row-main' }, h('div', { class: 'row-title co-wrap' }, a.text)),
              icon('chevronRight', { size: 16, className: 'row-chev' }))))
            : h('div', { class: 'hstack' }, tile('sparkles', 'green', 38), h('p', { class: 'muted', style: { flex: 1 } }, st.clients
              ? t('ყველაფერი რიგზეა — ახალი სიგნალი არ არის.', 'All good — nothing new to flag.')
              : t('როცა კლიენტები შემოგიერთდებიან, აქ დაინახავ, ვინ გადაუხვია კვებას, ვინ არ აწონილა ან ვინ გამოტოვა ვარჯიში.', 'Once clients join you, you’ll see here who went off their meal plan, who hasn’t weighed in or who missed a session.')))),
          { link: data.alerts.length ? { href: '/coach/clients', label: t('ყველა კლიენტი', 'All clients') } : null }),
          !st.clients && profile.code ? section(t('პირველი კლიენტი', 'Your first client'), card(
            h('div', { class: 'hstack', style: { alignItems: 'flex-start' } }, tile('userPlus', 'teal'),
              h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, t(`შენი კოდი: ${profile.code}`, `Your code: ${profile.code}`)),
                h('p', { class: 'card-sub' }, t('გაუზიარე კოდი ან ბმული — კლიენტი თავად აირჩევს, რას გაგიზიაროს. ან ჩასვი კლიენტის პირადი QR-ის ბმული.', 'Share your code or link — the client chooses what to share with you. Or paste the link from a client’s personal QR.')))),
            h('div', { class: 'hstack', style: { marginTop: '14px' } },
              button(t('კლიენტის QR ბმული', 'Client QR link'), { icon: 'scanLine', onClick: () => openInvite(env, { onDone: () => reload() }) }),
              button(t('ტექსტის კოპირება', 'Copy text'), { variant: 'ghost', icon: 'copy', onClick: () => copyText(INVITE_TEXT(profile.code), t('მოწვევის ტექსტი დაკოპირდა', 'Invite text copied')) })))) : null)));
    renderLive();
  };

  const reload = async () => {
    try {
      const from = startOfDay(new Date());
      const [today, sess] = await Promise.all([
        get(`${API}/today`),
        get(`${API}/sessions`, { from: from.toISOString(), to: addDays(from, 8).toISOString() }),
      ]);
      data = today;
      week = sess.sessions || [];
      render();
    } catch (e) { env.fail(body, e, reload); }
  };
  await reload();
  const timer = setInterval(() => { if (data) renderLive(); }, 30000);
  env.onCleanup(() => clearInterval(timer));
}

function nextUpCard(s, now, toLog, onBook) {
  if (!s) {
    return card({ class: 'spotlight hero-card co-next' },
      h('div', { class: 'hstack' }, tile('clock', 'teal', 46),
        h('div', { class: 'row-main' },
          h('div', { class: 'card-title' }, toLog ? t('დღის ვარჯიშები დასრულდა', 'Today’s sessions are over') : t('დაგეგმილი ვარჯიში არ გაქვს', 'No sessions scheduled')),
          h('div', { class: 'card-sub' }, toLog ? t(`ჩაწერე შედეგები — ${toLog} ვარჯიში ელოდება`, `Log the results — ${plural(toLog, 'session')} waiting`) : t('დანიშნე შემდეგი ვარჯიში ან გახსენი სლოტი', 'Schedule your next session or open a slot'))),
        button(t('დანიშვნა', 'Schedule'), { variant: 'light', size: 'sm', icon: 'plus', onClick: onBook })));
  }
  const tm = timing(s.startsAt, s.durationMin, now);
  const live = tm.phase === 'live';
  const progress = live ? Math.min(1, (now - new Date(s.startsAt).getTime()) / (s.durationMin * 60000)) : 0;
  return h('a', { class: 'card spotlight hero-card co-next hover', href: `/coach/session/${s.id}`, 'data-link': '' },
    h('div', { class: 'between' },
      h('span', { class: `co-live-pill ${live ? 'on' : ''}` }, live ? t('ახლა მიმდინარეობს', 'Happening now') : t('შემდეგი ვარჯიში', 'Next session')),
      h('span', { class: 'co-next-when' }, tm.text)),
    h('div', { class: 'co-next-main' },
      h('div', { class: 'co-next-time' }, h('strong', null, fmtTime(s.startsAt)), h('span', null, `${dayWithRel(s.startsAt)} · ${s.durationMin} ${t('წთ', 'min')}`)),
      h('span', { class: 'co-next-sep' }),
      avatarEl(s.clientName, s.clientAvatarUrl, 48),
      h('div', { class: 'row-main' }, h('div', { class: 'co-next-name' }, s.clientName), h('div', { class: 'muted' }, s.kindLabel))),
    live ? h('div', { class: 'co-next-progress' }, h('span', { style: { width: `${Math.round(progress * 100)}%` } })) : null,
    h('div', { class: 'hstack co-next-meta' },
      s.gym ? h('span', null, icon('mapPin', { size: 14 }), `${s.gym.brand} · ${s.gym.name}`) : null,
      h('span', { class: s.clientConfirmedAt ? 'ok' : '' }, icon(s.clientConfirmedAt ? 'check' : 'clock', { size: 14 }), s.clientConfirmedAt ? t('კლიენტმა დაადასტურა', 'Client confirmed') : t('დასტურს ელოდება', 'Awaiting confirmation'))));
}

function timeline(sessions, now) {
  const wrap = h('div', { class: 'co-tl' });
  const nowIdx = sessions.findIndex((s) => new Date(s.startsAt).getTime() > now);
  const nowLine = () => h('div', { class: 'co-tl-now', 'aria-label': t(`ახლა ${fmtTime(new Date(now))}`, `Now ${fmtTime(new Date(now))}`) }, h('span', null, fmtTime(new Date(now))), h('i'));
  sessions.forEach((s, i) => {
    if (i === nowIdx) wrap.appendChild(nowLine());
    const start = new Date(s.startsAt).getTime();
    const past = start + s.durationMin * 60000 < now;
    const running = start <= now && now < start + s.durationMin * 60000;
    wrap.appendChild(h('a', { class: `co-tl-row ${past && !running ? 'past' : ''} ${running ? 'running' : ''}`, href: `/coach/session/${s.id}`, 'data-link': '' },
      h('span', { class: 'co-tl-time' }, fmtTime(s.startsAt)),
      h('span', { class: 'co-tl-dot', style: { background: running ? 'var(--ok)' : sessionColor(s, now) } }),
      s.clientId ? avatarEl(s.clientName, s.clientAvatarUrl, 34) : h('span', { class: 'co-slot-av' }, icon('plus', { size: 16 })),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, s.clientName || t('თავისუფალი სლოტი', 'Open slot')),
        h('div', { class: 'row-sub' }, [`${s.durationMin} ${t('წთ', 'min')}`, s.kindLabel, s.gym?.brand].filter(Boolean).join(' · '))),
      sessionPill(s, now)));
  });
  if (nowIdx === -1 && sessions.length) wrap.appendChild(nowLine());
  return wrap;
}

function sessionRow(s, opts = {}) {
  return h('a', { class: 'row row-link co-srow', href: `/coach/session/${s.id}`, 'data-link': '' },
    h('span', { class: 'co-date' }, h('strong', null, parseDate(s.startsAt).getDate()), h('span', null, KA_MONTHS_SHORT[parseDate(s.startsAt).getMonth()])),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, opts.hideName ? `${KA_DAYS[parseDate(s.startsAt).getDay()]} · ${fmtTime(s.startsAt)}` : `${fmtTime(s.startsAt)} · ${s.clientName || t('თავისუფალი სლოტი', 'Open slot')}`),
      h('div', { class: 'row-sub' }, [s.kindLabel, `${s.durationMin} ${t('წთ', 'min')}`, s.gym ? `${s.gym.brand}` : null].filter(Boolean).join(' · '))),
    sessionPill(s));
}

function requestCard(r, answer) {
  const accept = button(t('მიღება', 'Accept'), { icon: 'check', size: 'sm' });
  const decline = button(t('უარი', 'Decline'), { variant: 'ghost', icon: 'x', size: 'sm' });
  accept.addEventListener('click', () => answer(accept, r.linkId, true, r.name));
  decline.addEventListener('click', () => answer(decline, r.linkId, false, r.name));
  const shared = SCOPES.filter((k) => r.scopes?.[k]);
  return card({ class: 'co-req' },
    h('div', { class: 'hstack' }, avatarEl(r.name, r.avatarUrl, 46),
      h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, r.name), h('div', { class: 'card-sub' }, personLine(r) || t('ახალი კლიენტი', 'New client'))),
      badge(t('გთხოვს ტრენერობას', 'Wants you as trainer'), 'brand')),
    r.note ? h('div', { class: 'co-quote' }, `„${r.note}“`) : null,
    h('div', { class: 'co-scope-chips' }, shared.length
      ? [h('span', { class: 'faint' }, t('გაგიზიარებს:', 'Will share:')), shared.map((k) => h('span', { class: 'co-scope on' }, icon(SCOPE_COPY[k].icon, { size: 13 }), SCOPE_COPY[k].short))]
      : h('span', { class: 'faint' }, t('მხოლოდ ვარჯიშების განრიგი — სხვა მონაცემს ჯერ არ აზიარებს', 'Session schedule only — not sharing any other data yet'))),
    h('div', { class: 'hstack' }, accept, decline));
}

/* ── Clients ──────────────────────────────────────────── */
async function pageClients(env, opts = {}) {
  const { profile } = env;
  let reloadFn = null;
  const body = frame(env, {
    active: 'clients',
    title: t('კლიენტები', 'Clients'),
    sub: t('ყველა კლიენტი ერთ ეკრანზე — კვების დაცვა, წონა და შემდეგი ვარჯიში', 'All your clients on one screen — meal plan adherence, weight and next session'),
    actions: [
      profile.code ? button(t('კოდის კოპირება', 'Copy code'), { variant: 'ghost', icon: 'copy', onClick: () => copyText(INVITE_TEXT(profile.code), t('მოწვევის ტექსტი დაკოპირდა', 'Invite text copied')) }) : null,
      button(t('კლიენტის მოწვევა', 'Invite a client'), { icon: 'userPlus', onClick: () => openInvite(env, { onDone: () => reloadFn?.() }) }),
    ].filter(Boolean),
  });
  mount(body, skeleton(3), skeleton(6));
  const state = { data: null, filter: 'all', q: '' };
  const listBox = h('div');

  const answer = async (btn, linkId, accept, name) => {
    if (!accept && !(await confirmDialog({ title: t('მოთხოვნის უარყოფა', 'Decline request'), body: t(`${name}-ს მოთხოვნა უარყოფილი იქნება.`, `${name}’s request will be declined.`), confirm: t('უარყოფა', 'Decline'), danger: true }))) return;
    await busy(btn, async () => {
      try {
        await post(`${API}/requests/${encodeURIComponent(linkId)}`, { accept });
        toast(accept ? t(`${firstWord(name)} ახლა შენი კლიენტია`, `${firstWord(name)} is now your client`) : t('მოთხოვნა უარყოფილია', 'Request declined'));
        await reload();
      } catch (e) { toast(e.message, 'error'); }
    });
  };
  const cancelInvite = async (r) => {
    if (!(await confirmDialog({ title: t('მოწვევის გაუქმება', 'Cancel invite'), body: t(`${r.name} მოწვევას ვეღარ მიიღებს.`, `${r.name} will no longer be able to accept the invite.`), confirm: t('გაუქმება', 'Cancel'), danger: true }))) return;
    try {
      await del(`${API}/invites/${encodeURIComponent(r.id)}`);
      toast(t('მოწვევა გაუქმდა', 'Invite cancelled'));
      await reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  const renderList = () => {
    const { clients, requests, invited } = state.data;
    const attention = clients.filter((c) => c.alerts.some((a) => a.tone === 'warn'));
    if (state.filter === 'waiting') {
      mount(listBox, requests.length || invited.length
        ? h('div', { class: 'grid grid-2' },
          requests.map((r) => requestCard(r, answer)),
          invited.map((r) => card({ class: 'co-req' },
            h('div', { class: 'hstack' }, avatarEl(r.name, r.avatarUrl, 46),
              h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, r.name), h('div', { class: 'card-sub' }, t(`მოწვეულია ${fmtDate(r.createdAt)} · დასტურს ელოდება`, `Invited ${fmtDate(r.createdAt)} · awaiting confirmation`))),
              iconButton('x', { title: t(`${r.name}-ის მოწვევის გაუქმება`, `Cancel ${r.name}’s invite`), onClick: () => cancelInvite(r) })),
            h('p', { class: 'faint', style: { fontSize: '13px' } }, t('არაფერი ზიარდება, სანამ კლიენტი მოწვევას არ მიიღებს და თავად არ აირჩევს, რას გაგიზიაროს.', 'Nothing is shared until the client accepts the invite and chooses what to share with you.')))))
        : card(empty(t('მოლოდინში არავინაა', 'No one is waiting'), t('როცა კლიენტი მოგწერს ან შენს მოწვევას ჯერ არ უპასუხებს, აქ გამოჩნდება.', 'When a client sends you a request, or hasn’t answered your invite yet, they’ll show up here.'))));
      return;
    }
    const base = state.filter === 'attention' ? attention : clients;
    const needle = state.q.trim().toLowerCase();
    const shown = needle ? base.filter((c) => c.name.toLowerCase().includes(needle)) : base;
    if (!shown.length) {
      mount(listBox, card(clients.length
        ? empty(state.filter === 'attention' && !needle ? t('ყურადღება არავის სჭირდება', 'No one needs attention') : t('ვერ მოიძებნა', 'Nothing found'), state.filter === 'attention' && !needle ? t('ყველა კლიენტი გეგმაშია — კარგი ნამუშევარია.', 'Every client is on plan — nice work.') : t('სცადე სხვა სახელი.', 'Try another name.'))
        : empty(t('კლიენტები ჯერ არ გყავს', 'No clients yet'), t('სთხოვე კლიენტს, გამოგიგზავნოს თავისი პირადი QR-ის ბმული (აპში: პროფილი → ჩემი QR), ან გაუზიარე შენი კოდი.', 'Ask a client to send you their personal QR link (in the app: Profile → My QR), or share your code.'),
          h('div', { class: 'hstack', style: { justifyContent: 'center' } },
            button(t('კლიენტის მოწვევა', 'Invite a client'), { icon: 'userPlus', onClick: () => openInvite(env, { onDone: () => reload() }) }),
            profile.code ? button(t(`კოდი · ${profile.code}`, `Code · ${profile.code}`), { variant: 'ghost', icon: 'copy', onClick: () => copyText(INVITE_TEXT(profile.code), t('მოწვევის ტექსტი დაკოპირდა', 'Invite text copied')) }) : null))));
      return;
    }
    mount(listBox, card({ class: 'flush co-roster' },
      h('div', { class: 'co-roster-head', 'aria-hidden': 'true' },
        h('span', null, t('კლიენტი', 'Client')), h('span', null, t('კვება · 7 დღე', 'Nutrition · 7 days')), h('span', null, t('დღეს', 'Today')), h('span', null, t('წონა → მიზანი', 'Weight → goal')), h('span', null, t('შემდეგი ვარჯიში', 'Next session'))),
      shown.map((c) => rosterRow(c))));
  };

  const render = () => {
    const { clients, requests, invited } = state.data;
    const attention = clients.filter((c) => c.alerts.some((a) => a.tone === 'warn')).length;
    const waiting = requests.length + invited.length;
    const search = input({ type: 'search', placeholder: t('სახელით ძებნა', 'Search by name'), value: state.q, 'aria-label': t('კლიენტის ძებნა', 'Search clients'), class: 'input co-search' });
    search.addEventListener('input', debounce(() => { state.q = search.value; renderList(); }, 150));
    const nutritionShared = clients.filter((c) => c.scopes.nutrition);
    const scores = nutritionShared.map((c) => weekScore(c.week)).filter((v) => v != null);
    mount(body,
      h('div', { class: 'stats-row' },
        card(stat(t('აქტიური', 'Active'), fmtNum(clients.length), { icon: 'users' })),
        card(stat(t('ყურადღება სჭირდება', 'Need attention'), fmtNum(attention), { icon: 'alert', deltaTone: attention ? 'down' : '' })),
        card(stat(t('ელოდება', 'Waiting'), fmtNum(waiting), { icon: 'clock', delta: waiting ? t(`${requests.length} მოთხოვნა · ${invited.length} მოწვევა`, `${plural(requests.length, 'request')} · ${plural(invited.length, 'invite')}`) : null })),
        card(stat(t('კვების დაცვა (საშ.)', 'Plan adherence (avg.)'), scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : '—', { icon: 'utensils', delta: t(`${nutritionShared.length} კლიენტი აზიარებს კვებას`, `${nutritionShared.length} ${nutritionShared.length === 1 ? 'client shares' : 'clients share'} nutrition`) }))),
      h('div', { class: 'co-toolbar' },
        segmented([
          { value: 'all', label: t(`ყველა · ${clients.length}`, `All · ${clients.length}`) },
          { value: 'attention', label: t(`ყურადღება · ${attention}`, `Attention · ${attention}`) },
          { value: 'waiting', label: t(`ელოდება · ${waiting}`, `Waiting · ${waiting}`) },
        ], state.filter, (v) => { state.filter = v; search.hidden = v === 'waiting'; renderList(); }),
        search),
      listBox);
    search.hidden = state.filter === 'waiting';
    renderList();
  };

  const reload = async () => {
    try {
      state.data = await get(`${API}/clients`);
      render();
    } catch (e) { env.fail(body, e, reload); }
  };
  reloadFn = reload;
  if (env.ctx.query.tab === 'waiting') state.filter = 'waiting';
  await reload();
  if (opts.invite) openInvite(env, { onDone: () => reload() });
}

function rosterRow(c) {
  const score = c.scopes.nutrition ? weekScore(c.week) : null;
  const warn = c.alerts.find((a) => a.tone === 'warn');
  const lockedCell = (scope) => h('span', { class: 'co-locked-mini', title: t(`${SCOPE_COPY[scope].title} არ არის გაზიარებული`, `${SCOPE_COPY[scope].title} isn’t shared`) }, icon('lock', { size: 13 }), t('არ აზიარებს', 'Not shared'));
  return h('a', { class: 'co-roster-row', href: `/coach/client/${c.id}`, 'data-link': '' },
    h('div', { class: 'co-rc-who' },
      h('span', { class: 'co-ring-av' }, ring({ value: score ?? 0, max: 100, size: 50, stroke: 4, color: scoreTone(score), label: undefined }), avatarEl(c.name, c.avatarUrl, 38)),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, c.name),
        h('div', { class: 'row-sub' }, personLine(c) || '—'),
        warn ? h('div', { class: 'co-rc-warn' }, icon('alert', { size: 13 }), warn.text.replace(/^[^:]+:\s*/, '')) : null)),
    h('div', { class: 'co-rc-cell', 'data-label': t('კვება · 7 დღე', 'Nutrition · 7 days') }, c.scopes.nutrition
      ? h('div', { class: 'co-rc-week' }, statusStrip(c.week || [], { small: true }), h('b', { style: { color: scoreTone(score) } }, score != null ? `${score}%` : '—'))
      : lockedCell('nutrition')),
    h('div', { class: 'co-rc-cell', 'data-label': t('დღეს', 'Today') }, c.kcalToday
      ? h('span', { class: 'co-chip' }, icon('flame', { size: 13 }), `${fmtNum(c.kcalToday.eaten)}${c.kcalToday.target ? ` / ${fmtNum(c.kcalToday.target)}` : ''} ${t('კკალ', 'kcal')}`)
      : c.scopes.nutrition ? h('span', { class: 'faint' }, '—') : lockedCell('nutrition')),
    h('div', { class: 'co-rc-cell', 'data-label': t('წონა → მიზანი', 'Weight → goal') }, c.weight
      ? h('div', { class: 'co-rc-weight' },
        h('span', null, c.weight.currentKg != null ? `${c.weight.currentKg}${c.weight.goalKg ? ` → ${c.weight.goalKg}` : ''} ${t('კგ', 'kg')}` : t('აწონვა არ არის', 'No weigh-in')),
        c.weight.percent != null ? h('div', { class: 'progress ink-teal', title: t(`მიზანი ${c.weight.percent}%`, `Goal ${c.weight.percent}%`) }, h('span', { style: { width: `${Math.max(3, Math.min(100, c.weight.percent))}%` } })) : null)
      : lockedCell('weight')),
    h('div', { class: 'co-rc-cell', 'data-label': t('შემდეგი ვარჯიში', 'Next session') }, c.nextSession
      ? h('span', { class: 'co-chip brand' }, icon('calendar', { size: 13 }), relStart(c.nextSession))
      : h('span', { class: 'faint' }, t('არ არის დაგეგმილი', 'Not scheduled'))));
}

/** 7/14-day adherence strip: one square per day, coloured by status. */
function statusStrip(days, opts = {}) {
  return h('div', { class: `co-strip ${opts.small ? 'sm' : ''}`, role: 'img', 'aria-label': days.map((d) => `${fmtDate(d.date)}: ${DAY_STATUS[d.status] || d.status}`).join('; ') },
    days.map((d) => h('span', { style: { background: DAY_COLOR[d.status] || 'var(--bg3)' }, title: `${shortDay(d.date)} · ${DAY_STATUS[d.status] || d.status}${d.calories ? ` · ${fmtNum(d.calories)} ${t('კკალ', 'kcal')}` : ''}` })));
}

/* ── Client detail ────────────────────────────────────── */
async function pageClient(env, clientId) {
  const body = frame(env, { active: 'clients', title: t('კლიენტის ბარათი', 'Client card'), back: { href: '/coach/clients', label: t('კლიენტები', 'Clients') } });
  mount(body, h('div', { class: 'grid grid-main' }, skeleton(5), skeleton(5)), skeleton(8));
  let d;
  try {
    d = await get(`${API}/clients/${encodeURIComponent(clientId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'LINK_NOT_ACTIVE') {
      mount(body, card(empty(t('კავშირი აღარ არის აქტიური', 'This connection is no longer active'), e.message, button(t('კლიენტების სია', 'Client list'), { href: '/coach/clients' }))));
      return;
    }
    env.fail(body, e, () => pageClient(env, clientId));
    return;
  }
  const catalog = await env.catalog();
  env.ctx.setTitle(d.client.name);
  const head = env.root.querySelector('.page-head h1');
  if (head) head.textContent = d.client.name;
  const sub = env.root.querySelector('.page-head p') || h('p');
  sub.textContent = [personLine(d.client), d.link.since ? t(`კლიენტი ${fmtDate(d.link.since, { year: true })}-დან`, `Client since ${fmtDate(d.link.since, { year: true })}`) : null].filter(Boolean).join(' · ');
  env.root.querySelector('.page-head-text')?.appendChild(sub);

  const sc = d.link.scopes;
  const n = d.nutrition;
  const w = d.weight;
  const a = d.activity;
  const now = Date.now();
  const upcoming = d.sessions.filter((s) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() > now).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
  const pastSessions = d.sessions.filter((s) => ['DONE', 'NO_SHOW'].includes(s.status));
  const toLog = d.sessions.filter((s) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() + s.durationMin * 60000 < now);
  const reload = () => pageClient(env, clientId);
  const newSession = () => openNewSession(env, { clientId, onDone: reload });

  const TABS_C = [
    { value: 'overview', label: t('მიმოხილვა', 'Overview') },
    { value: 'food', label: `${t('კვება', 'Nutrition')}${sc.nutrition ? '' : t(' · დახურულია', ' · locked')}` },
    { value: 'weight', label: `${t('წონა', 'Weight')}${sc.weight ? '' : t(' · დახურულია', ' · locked')}` },
    { value: 'training', label: `${t('ვარჯიში', 'Training')}${sc.workouts ? '' : t(' · დახურულია', ' · locked')}` },
    { value: 'photos', label: `${t('ფოტოები', 'Photos')}${sc.photos ? '' : t(' · დახურულია', ' · locked')}` },
    { value: 'sessions', label: t('ვარჯიშები შენთან', 'Sessions with you') },
  ];
  let tab = TABS_C.some((x) => x.value === env.ctx.query.tab) ? env.ctx.query.tab : 'overview';
  const tabBody = h('div', { class: 'co-tab-body' });
  const setTab = (v) => {
    tab = v;
    const url = new URL(location.href);
    url.searchParams.set('tab', v);
    window.history.replaceState(window.history.state, '', url);
    renderTab();
  };
  let tabsEl = segmented(TABS_C, tab, setTab);
  const goTab = (v) => { const fresh = segmented(TABS_C, v, setTab); tabsEl.replaceWith(fresh); tabsEl = fresh; setTab(v); };

  const identity = card({ class: 'co-id' },
    h('div', { class: 'co-id-top' },
      h('span', { class: 'co-ring-av lg' }, ring({ value: n?.score ?? 0, max: 100, size: 92, stroke: 5, color: scoreTone(n?.score) }), avatarEl(d.client.name, d.client.avatarUrl, 76)),
      h('div', { class: 'row-main' },
        h('h2', { class: 'co-id-name' }, d.client.name),
        h('div', { class: 'muted' }, personLine(d.client) || '—'),
        n?.score != null
          ? h('div', { class: 'co-id-score', style: { color: scoreTone(n.score) } }, t(`კვების დაცვა ${n.score}% · 14 დღე`, `Plan adherence ${n.score}% · 14 days`))
          : h('div', { class: 'faint', style: { fontSize: '13px', marginTop: '4px' } }, sc.nutrition ? t('კვების ჩანაწერები ჯერ არ არის', 'No food logged yet') : t('კვება არ არის გაზიარებული', 'Nutrition isn’t shared')))),
    d.link.note ? h('div', { class: 'co-quote' }, `„${d.link.note}“`) : null,
    h('div', null,
      h('div', { class: 'field-label', style: { marginBottom: '8px' } }, t('რას გიზიარებს', 'What they share with you')),
      h('div', { class: 'co-scope-chips' }, h('span', { class: 'co-scope on' }, icon('calendar', { size: 13 }), t('სესიები', 'Sessions')),
        SCOPES.map((k) => h('span', { class: `co-scope ${sc[k] ? 'on' : ''}`, title: sc[k] ? SCOPE_COPY[k].body : t(`${SCOPE_COPY[k].title} — არ არის გაზიარებული`, `${SCOPE_COPY[k].title} — not shared`) }, icon(sc[k] ? SCOPE_COPY[k].icon : 'lock', { size: 13 }), SCOPE_COPY[k].short))),
      h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, t('გაზიარებას მხოლოდ კლიენტი მართავს თავის „ჩემი ტრენერი“-ში და ნებისმიერ დროს შეწყვეტს.', 'Only the client controls sharing, from “My trainer”, and can stop it at any time.'))),
    h('div', { class: 'co-actions' },
      button(t('დანიშვნა', 'Schedule'), { icon: 'plus', onClick: newSession }),
      button(t('კვების გეგმა', 'Meal plan'), { variant: 'secondary', icon: 'utensils', onClick: () => (sc.nutrition ? env.ctx.navigate(`/coach/plan/${clientId}`) : goTab('food')) }),
      button(t('მიზანი', 'Goal'), { variant: 'secondary', icon: 'target', onClick: () => (sc.weight ? env.ctx.navigate(`/coach/goal/${clientId}`) : goTab('weight')) })));

  const kpis = h('div', { class: 'co-kpis' },
    kpi('scale', 'violet', t('წონა', 'Weight'), sc.weight ? (w?.currentKg != null ? `${w.currentKg} ${t('კგ', 'kg')}` : '—') : null, sc.weight ? (w?.goal ? t(`მიზანი ${w.goal.targetKg} კგ${w.progress ? ` · ${w.progress.percent}%` : ''}`, `Goal ${w.goal.targetKg} kg${w.progress ? ` · ${w.progress.percent}%` : ''}`) : t('მიზანი არ არის', 'No goal')) : null, () => goTab('weight')),
    kpi('utensils', 'teal', t('კვების დაცვა', 'Plan adherence'), sc.nutrition ? (n?.score != null ? `${n.score}%` : '—') : null, sc.nutrition ? (n?.targets ? t(`გეგმა ${fmtNum(n.targets.calories)} კკალ`, `Plan ${fmtNum(n.targets.calories)} kcal`) : t('გეგმა არ არის', 'No plan')) : null, () => goTab('food')),
    kpi('footprints', 'blue', t('ნაბიჯები · 7 დღე', 'Steps · 7 days'), sc.workouts ? (avgSteps(a) ?? '—') : null, sc.workouts ? t('დღიური საშუალო', 'Daily average') : null, () => goTab('training')),
    kpi('dumbbell', 'amber', t('ვარჯიში შენთან', 'Sessions with you'), fmtNum(pastSessions.filter((s) => s.status === 'DONE').length), t(`გამოტოვა ${pastSessions.filter((s) => s.status === 'NO_SHOW').length}`, `Missed ${pastSessions.filter((s) => s.status === 'NO_SHOW').length}`), () => goTab('sessions')));

  function renderTab() {
    const view = {
      overview: () => viewOverview(),
      food: () => (sc.nutrition && n ? viewFood() : lockedCard('nutrition', d.client.name)),
      weight: () => (sc.weight && w ? viewWeight() : lockedCard('weight', d.client.name)),
      training: () => (sc.workouts && a ? viewTraining() : lockedCard('workouts', d.client.name)),
      photos: () => (sc.photos && d.photos ? viewPhotos() : lockedCard('photos', d.client.name)),
      sessions: () => viewSessions(),
    }[tab];
    mount(tabBody, view());
  }

  function viewOverview() {
    return h('div', { class: 'grid grid-2 co-ov' },
      h('div', null,
        n ? section(t('კვება · 14 დღე', 'Nutrition · 14 days'), card(
          barChart({ labels: n.days.map((x) => String(parseDate(x.date).getDate())), tipLabels: n.days.map((x) => `${shortDay(x.date)} · ${DAY_STATUS[x.status]}`), values: n.days.map((x) => x.calories), goal: n.targets?.calories || null, goalLabel: n.targets ? t('გეგმა', 'Plan') : null, unit: t('კკალ', 'kcal'), height: 170, color: 'var(--c1)' }),
          h('div', { style: { marginTop: '12px' } }, statusStrip(n.days)),
          h('div', { class: 'card-sub', style: { marginTop: '8px' } }, t(`დღეს: ${fmtNum(n.days.at(-1)?.calories ?? 0)}${n.targets ? ` / ${fmtNum(n.targets.calories)}` : ''} კკალ · ${n.today.length} კვება`, `Today: ${fmtNum(n.days.at(-1)?.calories ?? 0)}${n.targets ? ` / ${fmtNum(n.targets.calories)}` : ''} kcal · ${plural(n.today.length, 'meal')}`))),
        { action: button(t('დეტალები', 'Details'), { variant: 'ghost', size: 'sm', onClick: () => goTab('food') }) }) : section(t('კვება', 'Nutrition'), lockedCard('nutrition', d.client.name, { compact: true })),
        w ? section(t('წონა', 'Weight'), card(weightChart(w, 190)), { action: button(t('დეტალები', 'Details'), { variant: 'ghost', size: 'sm', onClick: () => goTab('weight') }) }) : section(t('წონა', 'Weight'), lockedCard('weight', d.client.name, { compact: true }))),
      h('div', null,
        toLog.length ? section(t('ჩასაწერი', 'To log'), card({ class: 'co-note co-note-warn' },
          h('b', null, t(`${toLog.length} ვარჯიში ელოდება შედეგს`, `${plural(toLog.length, 'session')} waiting for results`)),
          h('div', { class: 'list' }, toLog.slice(0, 3).map((s) => sessionRow(s, { hideName: true }))))) : null,
        section(t('მომავალი ვარჯიშები', 'Upcoming sessions'), card(upcoming.length
          ? h('div', { class: 'list' }, upcoming.slice(0, 5).map((s) => sessionRow(s, { hideName: true })))
          : h('div', { class: 'stack' }, h('p', { class: 'muted' }, t('დაგეგმილი ვარჯიში არ არის.', 'No sessions scheduled.')), button(t('ვარჯიშის დანიშვნა', 'Schedule a session'), { variant: 'secondary', icon: 'plus', onClick: newSession })))),
        d.link.proposedGoal ? section(t('შეთავაზებული მიზანი', 'Proposed goal'), card(h('div', { class: 'hstack' }, tile('target', 'amber', 38),
          h('div', { class: 'row-main' },
            h('div', { class: 'card-title' }, `${GOAL_TYPE[d.link.proposedGoal.type] || d.link.proposedGoal.type} → ${d.link.proposedGoal.targetKg} ${t('კგ', 'kg')}`),
            h('div', { class: 'card-sub' }, t(`ვადა ${fmtDate(d.link.proposedGoal.deadlineYmd, { year: true })} · ელოდება კლიენტის დასტურს`, `Deadline ${fmtDate(d.link.proposedGoal.deadlineYmd, { year: true })} · awaiting the client’s confirmation`)))))) : null,
        section(t('კვების გეგმა', 'Meal plan'), d.plan ? planSummary(d.plan, sc.nutrition ? () => env.ctx.navigate(`/coach/plan/${clientId}`) : null) : card(h('div', { class: 'stack' },
          h('p', { class: 'muted' }, sc.nutrition ? t('გეგმა ჯერ არ შეგიდგენია. გეგმა კლიენტის პირად კვების პროგრამას არ ცვლის — დაცვა მისი დღიურიდან ითვლება.', 'You haven’t made a plan yet. Your plan doesn’t replace the client’s own nutrition program — adherence is measured from their food diary.') : t('კვების გეგმისთვის კლიენტმა ჯერ „კვება“ უნდა გაგიზიაროს.', 'For a meal plan, the client first needs to share “Nutrition” with you.')),
          sc.nutrition ? button(t('გეგმის შედგენა', 'Create a plan'), { variant: 'secondary', icon: 'utensils', onClick: () => env.ctx.navigate(`/coach/plan/${clientId}`) }) : null))),
        section(t('კავშირი', 'Connection'), card({ class: 'co-danger' },
          h('p', { class: 'faint', style: { fontSize: '13px' } }, t('კავშირის დასრულებისას მომავალი ვარჯიშები გაუქმდება და კლიენტის მონაცემებს ვეღარ ნახავ. ისტორია შენთან დარჩება.', 'Ending the connection cancels upcoming sessions and you’ll no longer see the client’s data. Your history stays with you.')),
          h('div', { class: 'hstack' },
            button(t('კავშირის დასრულება', 'End connection'), { variant: 'ghost', icon: 'userMinus', onClick: endLink }),
            button(t('შეტყობინება დარღვევაზე', 'Report a problem'), { variant: 'ghost', icon: 'flag', onClick: () => openReport(env, d.client, () => env.ctx.navigate('/coach/clients')) }))))));
  }

  function viewFood() {
    const counts = {};
    n.days.forEach((x) => { counts[x.status] = (counts[x.status] || 0) + 1; });
    const parts = ['ON', 'LOW_PROTEIN', 'UNDER', 'OVER', 'NONE', 'PENDING'].filter((k) => counts[k]).map((k) => ({ name: DAY_STATUS[k], value: counts[k], color: DAY_COLOR[k] }));
    const logged = n.days.filter((x) => x.meals);
    const avg = (k) => (logged.length ? Math.round(logged.reduce((s, x) => s + x[k], 0) / logged.length) : null);
    return h('div', { class: 'stack', style: { gap: '0' } },
      h('div', { class: 'stats-row co-mb' },
        card(stat(t('გეგმის დაცვა', 'Plan adherence'), n.score != null ? `${n.score}%` : '—', { icon: 'target', delta: t('14 დღე, დასრულებული დღეები', '14 days, completed days') })),
        card(stat(t('გეგმა', 'Plan'), n.targets ? fmtNum(n.targets.calories) : '—', { unit: n.targets ? t('კკალ / დღე', 'kcal / day') : '', icon: 'utensils', delta: n.targets?.protein ? t(`ცილა ${n.targets.protein} გ`, `Protein ${n.targets.protein} g`) : t('გეგმა არ არის', 'No plan') })),
        card(stat(t('საშუალოდ', 'Average'), avg('calories') != null ? fmtNum(avg('calories')) : '—', { unit: avg('calories') != null ? t('კკალ', 'kcal') : '', icon: 'flame', delta: avg('protein') != null ? t(`ცილა ${avg('protein')} გ · ${logged.length} დღე ჩაწერილი`, `Protein ${avg('protein')} g · ${plural(logged.length, 'day')} logged`) : t('ჩანაწერი არ არის', 'Nothing logged') })),
        card(stat(t('ბოლო ჩანაწერი', 'Last logged'), n.lastMealYmd ? relDay(n.lastMealYmd) : '—', { icon: 'clock' }))),
      h('div', { class: 'grid grid-main' },
        section(t('კალორიები და მაკროები · 14 დღე', 'Calories and macros · 14 days'), card(
          barChart({
            labels: n.days.map((x) => String(parseDate(x.date).getDate())),
            tipLabels: n.days.map((x) => `${shortDay(x.date)} · ${fmtNum(x.calories)} ${t('კკალ', 'kcal')} · ${DAY_STATUS[x.status]}`),
            stacked: [
              { name: t('ცილა', 'Protein'), values: n.days.map((x) => x.protein * 4), color: 'var(--c1)' },
              { name: t('ნახშირწყალი', 'Carbs'), values: n.days.map((x) => x.carbs * 4), color: 'var(--c3)' },
              { name: t('ცხიმი', 'Fat'), values: n.days.map((x) => x.fat * 9), color: 'var(--c2)' },
            ],
            goal: n.targets?.calories || null, goalLabel: n.targets ? t(`გეგმა ${fmtNum(n.targets.calories)}`, `Plan ${fmtNum(n.targets.calories)}`) : null, fmt: (v) => `${fmtNum(v)} ${t('კკალ', 'kcal')}`, height: 230,
          }),
          h('div', { class: 'legend', style: { marginTop: '10px' } }, [[t('ცილა', 'Protein'), 'var(--c1)'], [t('ნახშირწყალი', 'Carbs'), 'var(--c3)'], [t('ცხიმი', 'Fat'), 'var(--c2)']].map(([l, c]) => h('span', null, h('i', { style: { background: c } }), l))),
          h('div', { style: { marginTop: '14px' } }, statusStrip(n.days)))),
        section(t('დღეების შეფასება', 'Day ratings'), card({ class: 'co-donut' },
          donut({ parts, size: 150, stroke: 18, center: [h('strong', { style: { fontSize: '26px' } }, n.score != null ? `${n.score}%` : '—'), h('span', null, t('გეგმაში', 'On plan'))] }),
          h('div', { class: 'co-legend-col' }, parts.map((p) => h('div', { class: 'between' }, h('span', null, h('i', { style: { background: p.color } }), p.name), h('b', null, p.value)))),
          h('p', { class: 'faint', style: { fontSize: '12px' } }, t('გეგმაში = ±10% კალორია და ცილა ≥85%. დღე, როცა არაფერი ჩაწერა, არ ითვლება.', 'On plan = calories within ±10% and protein ≥85%. Days with nothing logged don’t count.'))))),
      !n.targets ? card({ class: 'co-note co-mb' }, h('div', { class: 'between' }, h('span', null, t('გეგმის გარეშე ყველა ჩაწერილი დღე „გეგმაშია“. შეადგინე გეგმა, რომ დაცვა გაიზომოს.', 'Without a plan, every logged day counts as “on plan”. Create a plan to measure adherence.')), button(t('გეგმის შედგენა', 'Create a plan'), { size: 'sm', icon: 'utensils', onClick: () => env.ctx.navigate(`/coach/plan/${clientId}`) }))) : null,
      h('div', { class: 'grid grid-2' },
        section(t('დღეს', 'Today'), card(n.today.length
          ? h('div', { class: 'list' }, n.today.map((m) => h('div', { class: 'row' }, h('span', { class: 'co-time' }, m.time), h('div', { class: 'row-main' }, h('div', { class: 'row-title co-wrap' }, m.title || t('კვება', 'Nutrition')), h('div', { class: 'row-sub' }, t(`ცილა ${m.protein} გ`, `Protein ${m.protein} g`))), h('b', null, `${fmtNum(m.calories)} ${t('კკალ', 'kcal')}`))))
          : h('p', { class: 'muted' }, t('დღეს ჯერ არაფერი ჩაუწერია.', 'Nothing logged today yet.')))),
        section(t('კვების გეგმა', 'Meal plan'), d.plan ? planSummary(d.plan, () => env.ctx.navigate(`/coach/plan/${clientId}`)) : card(h('div', { class: 'stack' }, h('p', { class: 'muted' }, t('გეგმა ჯერ არ არის.', 'No plan yet.')), button(t('გეგმის შედგენა', 'Create a plan'), { variant: 'secondary', icon: 'utensils', onClick: () => env.ctx.navigate(`/coach/plan/${clientId}`) }))))),
      section(t('დღიური · 14 დღე', 'Diary · 14 days'), card({ class: 'flush' }, h('div', { class: 'table-wrap' }, h('table', { class: 'table co-table' },
        h('thead', null, h('tr', null, [t('დღე', 'Day'), t('კვება', 'Nutrition'), t('კკალ', 'kcal'), t('ცილა', 'Protein'), t('ნახშ.', 'Carbs'), t('ცხიმი', 'Fat'), t('სტატუსი', 'Status')].map((col) => h('th', null, col)))),
        h('tbody', null, [...n.days].reverse().map((x) => h('tr', null,
          h('td', null, shortDay(x.date)), h('td', null, x.meals || '—'), h('td', null, x.meals ? fmtNum(x.calories) : '—'),
          h('td', null, x.meals ? `${x.protein} ${t('გ', 'g')}` : '—'), h('td', null, x.meals ? `${x.carbs} ${t('გ', 'g')}` : '—'), h('td', null, x.meals ? `${x.fat} ${t('გ', 'g')}` : '—'),
          h('td', null, h('span', { class: 'co-status' }, h('i', { style: { background: DAY_COLOR[x.status] } }), DAY_STATUS[x.status] || x.status))))))))));
  }

  function viewWeight() {
    const series = w.series || [];
    const first = series[0];
    const last = series.at(-1);
    const change = first && last ? Math.round((last.kg - first.kg) * 10) / 10 : null;
    return h('div', { class: 'stack', style: { gap: '0' } },
      h('div', { class: 'stats-row co-mb' },
        card(stat(t('ახლა', 'Now'), w.currentKg != null ? `${w.currentKg}` : '—', { unit: w.currentKg != null ? t('კგ', 'kg') : '', icon: 'scale', delta: w.lastWeighYmd ? t(`აწონვა: ${relDay(w.lastWeighYmd)}`, `Weighed: ${relDay(w.lastWeighYmd)}`) : t('აწონვა არ არის', 'No weigh-in') })),
        card(stat(t('მიზანი', 'Goal'), w.goal ? `${w.goal.targetKg}` : '—', { unit: w.goal ? t('კგ', 'kg') : '', icon: 'target', delta: w.goal?.deadlineYmd ? t(`ვადა ${fmtDate(w.goal.deadlineYmd, { year: true })}`, `Deadline ${fmtDate(w.goal.deadlineYmd, { year: true })}`) : t('მიზანი არ არის', 'No goal') })),
        card(stat(t('პროგრესი', 'Progress'), w.progress ? `${w.progress.percent}%` : '—', { icon: 'trendDown', delta: w.progress ? t(`დარჩა ${Math.abs(w.progress.remainingKg)} კგ`, `${Math.abs(w.progress.remainingKg)} kg to go`) : null, children: w.progress ? h('div', { class: 'progress ink-teal', style: { marginTop: '10px' } }, h('span', { style: { width: `${w.progress.percent}%` } })) : null })),
        card(stat(t('ცვლილება', 'Change'), change != null ? `${change > 0 ? '+' : ''}${change}` : '—', { unit: change != null ? t('კგ', 'kg') : '', icon: 'activity', delta: first ? t(`${fmtDate(first.date)}-დან · ${series.length} აწონვა`, `Since ${fmtDate(first.date)} · ${plural(series.length, 'weigh-in')}`) : null, deltaTone: change != null ? (change <= 0 ? 'up' : 'down') : '' }))),
      section(t('წონის დინამიკა', 'Weight trend'), card(weightChart(w, 280),
        h('div', { class: 'legend', style: { marginTop: '10px' } },
          h('span', null, h('i', { style: { background: 'var(--c1)' } }), t('წონა', 'Weight')),
          w.goal?.startedYmd && w.goal?.deadlineYmd ? h('span', null, h('i', { style: { background: 'var(--c3)' } }), t('იდეალური გზა ვადამდე', 'Ideal path to the deadline')) : null,
          w.goal ? h('span', null, h('i', { style: { background: 'var(--text3)' } }), t('მიზანი', 'Goal')) : null)),
      { action: button(w.goal ? t('ახალი მიზნის შეთავაზება', 'Propose a new goal') : t('მიზნის შეთავაზება', 'Propose a goal'), { variant: 'secondary', size: 'sm', icon: 'target', onClick: () => env.ctx.navigate(`/coach/goal/${clientId}`) }) }),
      d.link.proposedGoal ? card({ class: 'co-note' }, t(`შენი შეთავაზება: ${GOAL_TYPE[d.link.proposedGoal.type] || ''} → ${d.link.proposedGoal.targetKg} კგ, ${fmtDate(d.link.proposedGoal.deadlineYmd, { year: true })}. ელოდება კლიენტის დასტურს.`, `Your proposal: ${GOAL_TYPE[d.link.proposedGoal.type] || ''} → ${d.link.proposedGoal.targetKg} kg, ${fmtDate(d.link.proposedGoal.deadlineYmd, { year: true })}. Awaiting the client’s confirmation.`)) : null);
  }

  function viewTraining() {
    const days = a.days || [];
    const last30 = days.slice(-30);
    const withSteps = last30.filter((x) => x.steps != null);
    return h('div', { class: 'stack', style: { gap: '0' } },
      h('div', { class: 'stats-row co-mb' },
        card(stat(t('ნაბიჯები · 7 დღე', 'Steps · 7 days'), avgSteps(a) || '—', { icon: 'footprints', delta: t('დღიური საშუალო', 'Daily average') })),
        card(stat(t('8 000+ დღეები', '8,000+ days'), `${withSteps.filter((x) => x.steps >= 8000).length}/${withSteps.length || 0}`, { icon: 'target', delta: t('ბოლო 30 დღე', 'Last 30 days') })),
        card(stat(t('ვარჯიშები საათიდან', 'Watch workouts'), fmtNum((a.workouts || []).length), { icon: 'activity', delta: t('30 დღე', '30 days') })),
        card(stat(t('ძილი', 'Sleep'), avgOf(last30.slice(-7), 'sleepHours', 1) ?? '—', { unit: avgOf(last30.slice(-7), 'sleepHours', 1) != null ? t('სთ', 'h') : '', icon: 'moon', delta: t('7 დღის საშუალო', '7-day average') }))),
      section(t('ნაბიჯები · 30 დღე', 'Steps · 30 days'), card(withSteps.length
        ? barChart({ labels: last30.map((x) => String(parseDate(x.date).getDate())), tipLabels: last30.map((x) => shortDay(x.date)), values: last30.map((x) => x.steps || 0), goal: 8000, goalLabel: '8 000', unit: t('ნაბიჯი', 'steps'), height: 200, color: 'var(--c5)' })
        : h('p', { class: 'muted' }, t('ნაბიჯების მონაცემი არ არის.', 'No step data.')))),
      h('div', { class: 'grid grid-2' },
        section(t('ძილი', 'Sleep'), card(last30.some((x) => x.sleepHours != null)
          ? lineChart({ labels: last30.map((x) => String(parseDate(x.date).getDate())), tipLabels: last30.map((x) => shortDay(x.date)), series: [{ name: t('ძილი', 'Sleep'), values: last30.map((x) => x.sleepHours ?? null), color: 'var(--c2)' }], unit: t('სთ', 'h'), height: 170, min: 0 })
          : h('p', { class: 'muted' }, t('ძილის მონაცემი არ არის.', 'No sleep data.')))),
        section(t('საშუალო პულსი', 'Average heart rate'), card(last30.some((x) => x.heartRate != null)
          ? lineChart({ labels: last30.map((x) => String(parseDate(x.date).getDate())), tipLabels: last30.map((x) => shortDay(x.date)), series: [{ name: t('პულსი', 'Heart rate'), values: last30.map((x) => x.heartRate ?? null), color: 'var(--c4)' }], unit: 'bpm', height: 170 })
          : h('p', { class: 'muted' }, t('პულსის მონაცემი არ არის.', 'No heart rate data.'))))),
      section(t('დამოუკიდებელი ვარჯიშები (საათი / ტელეფონი)', 'Own workouts (watch / phone)'), card({ class: 'flush' }, (a.workouts || []).length
        ? h('div', { class: 'table-wrap' }, h('table', { class: 'table co-table' },
          h('thead', null, h('tr', null, [t('დღე', 'Day'), t('ტიპი', 'Type'), t('ხანგრძლივობა', 'Duration'), t('კკალ', 'kcal'), t('საშ. პულსი', 'Avg. HR'), t('მანძილი', 'Distance')].map((col) => h('th', null, col)))),
          h('tbody', null, a.workouts.slice(0, 20).map((x) => h('tr', null,
            h('td', null, `${shortDay(x.startedAt)} · ${fmtTime(x.startedAt)}`), h('td', null, workoutKind(x.kind)), h('td', null, `${x.durationMin} ${t('წთ', 'min')}`),
            h('td', null, x.kcal != null ? fmtNum(x.kcal) : '—'), h('td', null, x.avgHeartRate != null ? `${x.avgHeartRate} bpm` : '—'), h('td', null, x.distanceKm != null ? `${x.distanceKm} ${t('კმ', 'km')}` : '—'))))))
        : h('p', { class: 'muted', style: { padding: '20px' } }, t('საათიდან/ტელეფონიდან ვარჯიში ჯერ არ მოსულა.', 'No workouts from a watch or phone yet.')))));
  }

  function viewPhotos() {
    const photos = d.photos;
    let pose = ['FRONT', 'SIDE', 'BACK'].find((p) => photos.filter((x) => x.pose === p).length >= 2) || 'FRONT';
    const cmpBox = h('div');
    const paint = () => {
      const same = photos.filter((x) => x.pose === pose).sort((x, y) => x.takenOn.localeCompare(y.takenOn));
      mount(cmpBox, same.length >= 2 ? beforeAfter(same[0], same.at(-1)) : card(h('p', { class: 'muted' }, t('ამ რაკურსით შესადარებლად მინიმუმ ორი ფოტოა საჭირო.', 'You need at least two photos from this angle to compare.'))));
    };
    const poses = segmented(['FRONT', 'SIDE', 'BACK'].map((p) => ({ value: p, label: `${POSE[p]} · ${photos.filter((x) => x.pose === p).length}` })), pose, (v) => { pose = v; paint(); });
    paint();
    if (!photos.length) return card(empty(t('ფოტოები ჯერ არ არის', 'No photos yet'), t('კლიენტი ფოტოებს თავის აპში ამატებს („ჩემი ტრენერი“ → პროგრესი).', 'The client adds photos in their app (“My trainer” → Progress).')));
    return h('div', { class: 'grid grid-main' },
      section(t('მანამდე / შემდეგ', 'Before / after'), h('div', { class: 'stack' }, poses, cmpBox)),
      section(t(`ყველა ფოტო · ${photos.length}`, `All photos · ${photos.length}`), card(h('div', { class: 'co-gallery' }, photos.map((p) => {
        const img = h('img', { alt: `${POSE[p.pose] || ''} ${p.takenOn}`, loading: 'lazy' });
        authedBlobUrl(p.url).then((src) => { if (src) img.src = src; }).catch(() => {});
        return h('figure', { class: 'co-ph' }, img, h('figcaption', null, `${fmtDate(p.takenOn)}${p.weightKg ? ` · ${p.weightKg} ${t('კგ', 'kg')}` : ''}`, h('span', null, POSE[p.pose] || p.pose)));
      })))));
  }

  function viewSessions() {
    const done = pastSessions.filter((s) => s.status === 'DONE');
    const rated = done.filter((s) => s.clientRating);
    return h('div', { class: 'stack', style: { gap: '0' } },
      h('div', { class: 'stats-row co-mb' },
        card(stat(t('ჩატარდა', 'Done'), fmtNum(done.length), { icon: 'calendarCheck' })),
        card(stat(t('არ მოვიდა', 'No-show'), fmtNum(pastSessions.length - done.length), { icon: 'x' })),
        card(stat(t('დასწრება', 'Attendance'), pastSessions.length ? `${Math.round((done.length / pastSessions.length) * 100)}%` : '—', { icon: 'target' })),
        card(stat(t('შეფასება', 'Rating'), rated.length ? (rated.reduce((s, x) => s + x.clientRating, 0) / rated.length).toFixed(1) : '—', { icon: 'star', delta: rated.length ? t(`${rated.length} შეფასება`, plural(rated.length, 'rating')) : t('ჯერ არ შეუფასებია', 'Not rated yet') }))),
      section(t('მომავალი', 'Upcoming'), card(upcoming.length ? h('div', { class: 'list' }, upcoming.map((s) => sessionRow(s, { hideName: true }))) : h('div', { class: 'between' }, h('p', { class: 'muted' }, t('დაგეგმილი ვარჯიში არ არის.', 'No sessions scheduled.')), button(t('დანიშვნა', 'Schedule'), { size: 'sm', icon: 'plus', onClick: newSession }))),
      { action: button(t('დანიშვნა', 'Schedule'), { variant: 'ghost', size: 'sm', icon: 'plus', onClick: newSession }) }),
      section(t('ისტორია', 'History'), card({ class: 'flush' }, d.sessions.filter((s) => new Date(s.startsAt).getTime() <= now).length
        ? h('div', { class: 'table-wrap' }, h('table', { class: 'table co-table' },
          h('thead', null, h('tr', null, [t('თარიღი', 'Date'), t('ტიპი', 'Type'), t('სტატუსი', 'Status'), t('სავარჯიშოები', 'Exercises'), t('საათიდან', 'From watch'), ''].map((col) => h('th', null, col)))),
          h('tbody', null, d.sessions.filter((s) => new Date(s.startsAt).getTime() <= now).map((s) => h('tr', { class: 'co-tr-link', onClick: () => env.ctx.navigate(`/coach/session/${s.id}`) },
            h('td', null, `${shortDay(s.startsAt)} · ${fmtTime(s.startsAt)}`),
            h('td', null, kindLabel(s, catalog)),
            h('td', null, sessionPill(s)),
            h('td', { class: 'co-td-ex' }, s.exercises.length ? s.exercises.map((e) => e.name).join(' · ') : '—'),
            h('td', null, s.workout ? `${s.workout.durationMin} ${t('წთ', 'min')}${s.workout.kcal ? ` · ${s.workout.kcal} ${t('კკალ', 'kcal')}` : ''}${s.workout.avgHeartRate ? ` · ${s.workout.avgHeartRate} bpm` : ''}` : '—'),
            h('td', null, s.clientRating ? h('span', { class: 'co-stars', title: t(`შეფასება ${s.clientRating}/5`, `Rating ${s.clientRating}/5`) }, '★'.repeat(s.clientRating)) : ''))))))
        : h('p', { class: 'muted', style: { padding: '20px' } }, t('ჩატარებული ვარჯიში ჯერ არ არის.', 'No completed sessions yet.')))));
  }

  async function endLink() {
    const ok = await confirmDialog({ title: t('კლიენტთან კავშირის დასრულება', 'End connection with client'), body: t('მომავალი ვარჯიშები გაუქმდება და მის მონაცემებს ვეღარ ნახავ.', 'Upcoming sessions will be cancelled and you’ll no longer see their data.'), confirm: t('დასრულება', 'End'), danger: true });
    if (!ok) return;
    try {
      await del(`${API}/clients/${encodeURIComponent(clientId)}`);
      toast(t('კავშირი დასრულდა', 'Connection ended'));
      env.ctx.navigate('/coach/clients');
    } catch (e) { toast(e.message, 'error'); }
  }

  mount(body,
    h('div', { class: 'co-client-top' }, identity, kpis),
    h('div', { class: 'co-tabs' }, tabsEl),
    tabBody);
  renderTab();
}

function kpi(ic, ink, label, value, hint, onClick) {
  const locked = value == null;
  return h('button', { type: 'button', class: `card co-kpi ${locked ? 'locked' : ''}`, onClick },
    h('div', { class: 'between' }, tile(locked ? 'lock' : ic, locked ? 'neutral' : ink, 36), icon('chevronRight', { size: 16, className: 'faint' })),
    h('div', { class: 'co-kpi-v' }, locked ? t('დახურულია', 'Locked') : value),
    h('div', { class: 'co-kpi-l' }, label),
    h('div', { class: 'co-kpi-h' }, locked ? t('კლიენტს არ გაუზიარებია', 'The client hasn’t shared this') : hint || ''));
}

function avgSteps(a) {
  const last7 = (a?.days || []).slice(-7).filter((x) => x.steps != null);
  if (!last7.length) return null;
  return fmtNum(Math.round(last7.reduce((s, x) => s + x.steps, 0) / last7.length));
}
function avgOf(list, key, digits = 0) {
  const v = list.map((x) => x[key]).filter((x) => x != null);
  if (!v.length) return null;
  return fmtNum(v.reduce((s, x) => s + x, 0) / v.length, digits);
}

function lockedCard(scope, name, opts = {}) {
  return card({ class: `co-locked ${opts.compact ? 'compact' : ''}` },
    tile('eyeOff', 'neutral', opts.compact ? 38 : 48),
    h('div', null,
      h('div', { class: 'card-title' }, t(`„${SCOPE_COPY[scope].title}“ არ არის გაზიარებული`, `“${SCOPE_COPY[scope].title}” isn’t shared`)),
      h('p', { class: 'muted' }, t(`ამას მხოლოდ ${firstWord(name) || 'კლიენტი'} ჩართავს თავის „ჩემი ტრენერი“-ში. შეგიძლია სთხოვო — გადაწყვეტილება მისია.`, `Only ${firstWord(name) || 'the client'} can turn this on, in their “My trainer”. You can ask — it’s their decision.`)),
      opts.compact ? null : h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '6px' } }, SCOPE_COPY[scope].body)));
}

function planSummary(plan, onEdit) {
  const tg = plan.targets || {};
  const macroK = (tg.protein || 0) * 4 + (tg.carbs || 0) * 4 + (tg.fat || 0) * 9;
  return card({ class: 'co-plan' },
    h('div', { class: 'between' }, h('div', null, h('div', { class: 'card-title' }, plan.title), h('div', { class: 'card-sub' }, t(`${fmtNum(tg.calories)} კკალ · ${plan.meals.length} კვება${plan.startsOn ? ` · ${fmtDate(plan.startsOn)}-დან` : ''}`, `${fmtNum(tg.calories)} kcal · ${plural(plan.meals.length, 'meal')}${plan.startsOn ? ` · from ${fmtDate(plan.startsOn)}` : ''}`))),
      onEdit ? button(t('შეცვლა', 'Edit'), { variant: 'ghost', size: 'sm', icon: 'edit', onClick: onEdit }) : null),
    macroK ? macroBar(tg) : null,
    plan.meals.length ? h('div', { class: 'co-plan-meals' }, plan.meals.map((m) => h('div', { class: 'co-plan-meal' },
      h('b', null, `${MEAL_SLOTS.find((s) => s.key === m.slot)?.label || m.slot}${m.time ? ` · ${m.time}` : ''}`),
      h('span', null, m.items.length ? m.items.map((i) => i.name).join(', ') : '—')))) : null);
}

function macroBar(tg) {
  const p = (tg.protein || 0) * 4;
  const c = (tg.carbs || 0) * 4;
  const f = (tg.fat || 0) * 9;
  const total = p + c + f;
  if (!total) return null;
  return h('div', { class: 'co-macro' },
    h('div', { class: 'co-macro-bar' }, [[p, 'var(--c1)'], [c, 'var(--c3)'], [f, 'var(--c2)']].map(([v, col]) => (v ? h('span', { style: { flex: String(v), background: col } }) : null))),
    h('div', { class: 'legend' }, [[t('ცილა', 'Protein'), p, 'var(--c1)', tg.protein], [t('ნახშირწყალი', 'Carbs'), c, 'var(--c3)', tg.carbs], [t('ცხიმი', 'Fat'), f, 'var(--c2)', tg.fat]].map(([l, v, col, g]) => h('span', null, h('i', { style: { background: col } }), `${l} ${g ?? 0} ${t('გ', 'g')} · ${Math.round((v / total) * 100)}%`))));
}

function weightChart(w, height) {
  const series = (w.series || []).slice(-60);
  if (!series.length) return h('p', { class: 'muted' }, t('აწონვა ჯერ არ არის ჩაწერილი.', 'No weigh-ins logged yet.'));
  const goal = w.goal;
  const ideal = goal?.startedYmd && goal?.deadlineYmd ? series.map((x) => expectedWeight(goal, x.date)) : null;
  return lineChart({
    labels: series.map((x) => fmtDate(x.date, { short: true, year: false })),
    tipLabels: series.map((x) => fmtDate(x.date, { year: true })),
    series: [
      { name: t('წონა', 'Weight'), values: series.map((x) => x.kg), color: 'var(--c1)', dots: series.length <= 30 },
      ideal ? { name: t('იდეალური გზა', 'Ideal path'), values: ideal, color: 'var(--c3)', dashed: true, area: false, width: 2 } : null,
    ].filter(Boolean),
    goal: goal ? goal.targetKg : null,
    goalLabel: goal ? t(`მიზანი ${goal.targetKg} კგ`, `Goal ${goal.targetKg} kg`) : null,
    unit: t('კგ', 'kg'),
    fmt: (v) => fmtNum(v, 1),
    zero: false,
    height,
  });
}

function beforeAfter(before, after) {
  const imgA = h('img', { alt: t(`მანამდე ${before.takenOn}`, `Before ${before.takenOn}`) });
  const imgB = h('img', { alt: t(`შემდეგ ${after.takenOn}`, `After ${after.takenOn}`) });
  authedBlobUrl(before.url).then((s) => { if (s) imgA.src = s; }).catch(() => {});
  authedBlobUrl(after.url).then((s) => { if (s) imgB.src = s; }).catch(() => {});
  const top = h('div', { class: 'co-ba-top' }, imgB);
  const handle = h('div', { class: 'co-ba-handle' }, h('span', null, icon('chevronLeft', { size: 14 }), icon('chevronRight', { size: 14 })));
  const range = h('input', { type: 'range', min: 0, max: 100, value: 50, class: 'co-ba-range', 'aria-label': t('შედარება: მანამდე / შემდეგ', 'Compare: before / after') });
  const set = (v) => { top.style.clipPath = `inset(0 0 0 ${v}%)`; handle.style.left = `${v}%`; };
  range.addEventListener('input', () => set(range.value));
  set(50);
  const diff = before.weightKg != null && after.weightKg != null ? Math.round((after.weightKg - before.weightKg) * 10) / 10 : null;
  return card({ class: 'co-ba-card' },
    h('div', { class: 'co-ba' }, imgA, top, handle, range,
      h('span', { class: 'co-ba-tag l' }, t(`მანამდე · ${fmtDate(before.takenOn)}`, `Before · ${fmtDate(before.takenOn)}`)),
      h('span', { class: 'co-ba-tag r' }, t(`შემდეგ · ${fmtDate(after.takenOn)}`, `After · ${fmtDate(after.takenOn)}`))),
    h('div', { class: 'between', style: { marginTop: '12px' } },
      h('span', { class: 'muted' }, t(`${Math.round((Date.parse(after.takenOn) - Date.parse(before.takenOn)) / 86400000)} დღე`, plural(Math.round((Date.parse(after.takenOn) - Date.parse(before.takenOn)) / 86400000), 'day'))),
      diff != null ? h('b', null, `${before.weightKg} → ${after.weightKg} ${t('კგ', 'kg')} (${diff > 0 ? '+' : ''}${diff})`) : null));
}

/* ── Calendar ─────────────────────────────────────────── */
async function pageCalendar(env, opts = {}) {
  const catalog = await env.catalog();
  const state = { view: env.ctx.query.view === 'month' ? 'month' : 'week', anchor: new Date(), selected: ymd(), sessions: null, seq: 0 };
  const body = frame(env, {
    active: 'calendar',
    title: t('კალენდარი', 'Calendar'),
    sub: t('ვარჯიშები, თავისუფალი სლოტები და დასწრება — შენი ადგილობრივი დროით', 'Sessions, open slots and attendance — in your local time'),
    actions: [button(t('ვარჯიშის დანიშვნა', 'Schedule a session'), { icon: 'plus', onClick: () => openNew({ date: state.selected >= ymd() ? state.selected : ymd() }) })],
  });
  const openNew = (preset) => openNewSession(env, { ...preset, onDone: () => load() });
  const toolbar = h('div', { class: 'co-cal-bar' });
  const main = h('div');
  mount(body, toolbar, main);

  const range = () => {
    if (state.view === 'week') {
      const from = mondayOf(state.anchor);
      return { from, to: addDays(from, 7) };
    }
    const first = new Date(state.anchor.getFullYear(), state.anchor.getMonth(), 1);
    const from = mondayOf(first);
    return { from, to: addDays(from, 42) };
  };

  const paintToolbar = () => {
    const { from, to } = range();
    const last = addDays(to, -1);
    const title = state.view === 'month'
      ? `${KA_MONTHS[state.anchor.getMonth()]} ${state.anchor.getFullYear()}`
      : from.getMonth() === last.getMonth() ? `${from.getDate()}–${last.getDate()} ${KA_MONTHS[from.getMonth()]} ${last.getFullYear()}` : `${from.getDate()} ${KA_MONTHS_SHORT[from.getMonth()]} – ${last.getDate()} ${KA_MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`;
    const live = (state.sessions || []).filter((s) => s.status !== 'CANCELLED');
    const booked = live.filter((s) => s.clientId).length;
    const open = live.filter((s) => s.status === 'OPEN').length;
    const hours = Math.round(live.filter((s) => s.clientId).reduce((a, s) => a + s.durationMin, 0) / 6) / 10;
    mount(toolbar,
      h('div', { class: 'hstack' },
        iconButton('chevronLeft', { title: state.view === 'week' ? t('წინა კვირა', 'Previous week') : t('წინა თვე', 'Previous month'), onClick: () => shift(-1) }),
        iconButton('chevronRight', { title: state.view === 'week' ? t('შემდეგი კვირა', 'Next week') : t('შემდეგი თვე', 'Next month'), onClick: () => shift(1) }),
        h('h2', { class: 'co-cal-title' }, title),
        button(t('დღეს', 'Today'), { variant: 'ghost', size: 'sm', onClick: () => { state.anchor = new Date(); state.selected = ymd(); load(); } })),
      h('div', { class: 'hstack' },
        state.sessions ? h('span', { class: 'co-cal-sum' }, t(`${booked} ვარჯიში · ${open} სლოტი · ${String(hours).replace('.', ',')} სთ`, `${plural(booked, 'session')} · ${plural(open, 'slot')} · ${hours} h`)) : null,
        segmented([{ value: 'week', label: t('კვირა', 'Week') }, { value: 'month', label: t('თვე', 'Month') }], state.view, (v) => {
          state.view = v;
          const url = new URL(location.href);
          url.searchParams.set('view', v);
          window.history.replaceState(window.history.state, '', url);
          load();
        })));
  };

  const shift = (dir) => {
    if (state.view === 'week') state.anchor = addDays(state.anchor, dir * 7);
    else state.anchor = new Date(state.anchor.getFullYear(), state.anchor.getMonth() + dir, 1);
    const { from, to } = range();
    const today = startOfDay(new Date());
    state.selected = today >= from && today < to && (state.view === 'week' || today.getMonth() === state.anchor.getMonth()) ? ymd(today) : ymd(state.view === 'week' ? from : new Date(state.anchor.getFullYear(), state.anchor.getMonth(), 1));
    load();
  };

  const load = async () => {
    const my = ++state.seq;
    state.sessions = null;
    paintToolbar();
    mount(main, skeleton(8));
    const { from, to } = range();
    try {
      const res = await get(`${API}/sessions`, { from: from.toISOString(), to: to.toISOString() });
      if (my !== state.seq) return;
      state.sessions = res.sessions || [];
      paintToolbar();
      paint();
    } catch (e) { if (my === state.seq) env.fail(main, e, load); }
  };

  const byDay = () => {
    const m = new Map();
    for (const s of state.sessions) {
      const k = localYmd(s.startsAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    }
    for (const list of m.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return m;
  };

  const legend = () => h('div', { class: 'legend co-cal-legend' },
    [['var(--brand-2)', t('დაგეგმილი', 'Scheduled')], ['var(--ok)', t('ჩატარდა', 'Done')], ['var(--warn)', t('ჩასაწერი', 'To log')], ['var(--danger)', t('არ მოვიდა', 'No-show')], ['var(--text3)', t('თავისუფალი სლოტი', 'Open slot')], ['var(--bg3)', t('გაუქმდა', 'Cancelled')]]
      .map(([c, l]) => h('span', null, h('i', { style: { background: c } }), l)));

  const dayPanel = (map) => {
    const list = map.get(state.selected) || [];
    const isPast = state.selected < ymd();
    return section(dayWithRel(state.selected), card(list.length
      ? h('div', { class: 'list' }, list.map((s) => calRow(s, catalog)))
      : h('div', { class: 'co-empty-card' }, tile('calendar', 'neutral', 44), h('div', { class: 'card-title' }, isPast ? t('ამ დღეს ვარჯიში არ ყოფილა', 'No sessions on this day') : t('თავისუფალი დღე', 'Free day')),
        isPast ? null : button(t('დანიშვნა ამ დღეს', 'Schedule on this day'), { icon: 'plus', onClick: () => openNew({ date: state.selected }) }))),
    { action: !isPast && list.length ? button(t('დამატება', 'Add'), { variant: 'ghost', size: 'sm', icon: 'plus', onClick: () => openNew({ date: state.selected }) }) : null });
  };

  const paint = () => {
    const map = byDay();
    if (state.view === 'week') {
      const { from } = range();
      const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
      mount(main, card({ class: 'co-week-card' }, weekGrid(days, map, (dateKey, hour) => openNew({ date: dateKey, time: `${String(hour).padStart(2, '0')}:00` })), legend()),
        h('div', { class: 'co-agenda' }, days.map((d) => {
          const k = ymd(d);
          const list = map.get(k) || [];
          return section(dayWithRel(k), card(list.length ? h('div', { class: 'list' }, list.map((s) => calRow(s, catalog))) : h('p', { class: 'faint' }, t('ვარჯიში არ არის', 'No sessions'))),
            { action: k >= ymd() ? iconButton('plus', { title: t('დანიშვნა ამ დღეს', 'Schedule on this day'), onClick: () => openNew({ date: k }) }) : null });
        })));
      return;
    }
    const { from } = range();
    const cells = Array.from({ length: 42 }, (_, i) => addDays(from, i));
    const month = state.anchor.getMonth();
    const panel = h('div');
    const grid = h('div', { class: 'co-month' },
      t(['ორ', 'სმ', 'ოთ', 'ხთ', 'პრ', 'შბ', 'კვ'], ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']).map((d) => h('div', { class: 'co-month-h' }, d)),
      cells.map((d) => {
        const k = ymd(d);
        const list = map.get(k) || [];
        const live = list.filter((s) => s.status !== 'CANCELLED');
        return h('button', {
          type: 'button',
          class: `co-month-d ${d.getMonth() !== month ? 'out' : ''} ${k === ymd() ? 'today' : ''} ${k === state.selected ? 'sel' : ''}`,
          'aria-label': t(`${fmtDate(k)}, ${live.length} ვარჯიში`, `${fmtDate(k)}, ${plural(live.length, 'session')}`),
          'aria-pressed': k === state.selected ? 'true' : 'false',
          onClick: () => { state.selected = k; paint(); },
        },
        h('span', { class: 'co-month-n' }, d.getDate()),
        h('span', { class: 'co-month-items' }, live.slice(0, 3).map((s) => h('span', { class: 'co-month-item', style: `--c:${sessionColor(s)}` }, h('i'), h('b', null, fmtTime(s.startsAt)), h('em', null, s.clientName ? firstWord(s.clientName) : t('სლოტი', 'Slot')))),
          live.length > 3 ? h('span', { class: 'co-month-more' }, `+${live.length - 3}`) : null),
        h('span', { class: 'co-month-dots' }, live.slice(0, 4).map((s) => h('i', { style: { background: sessionColor(s) } }))));
      }));
    mount(panel, dayPanel(map));
    mount(main, h('div', { class: 'grid grid-main' }, card({ class: 'co-month-card' }, grid, legend()), panel));
  };

  paintToolbar();
  await load();
  if (opts.create) openNew({ clientId: env.ctx.query.clientId, date: env.ctx.query.date });
}

function calRow(s, catalog) {
  return h('a', { class: `row row-link co-calrow ${s.status === 'CANCELLED' ? 'cancelled' : ''}`, href: `/coach/session/${s.id}`, 'data-link': '' },
    h('span', { class: 'co-calrow-bar', style: { background: sessionColor(s) } }),
    h('div', { class: 'co-calrow-time' }, h('b', null, fmtTime(s.startsAt)), h('span', null, `${s.durationMin} ${t('წთ', 'min')}`)),
    s.clientId ? avatarEl(s.clientName, s.clientAvatarUrl, 36) : h('span', { class: 'co-slot-av' }, icon('plus', { size: 16 })),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, s.clientName || t('თავისუფალი სლოტი', 'Open slot')),
      h('div', { class: 'row-sub' }, [kindLabel(s, catalog), s.gym ? `${s.gym.brand} · ${s.gym.name}` : null].filter(Boolean).join(' · '), s.seriesId && s.seriesId !== 'slot' ? h('span', { class: 'co-inline-ic', title: t('ყოველკვირეული', 'Weekly') }, icon('repeat', { size: 12 })) : null)),
    sessionPill(s));
}

const GRID_FROM = 6;
const GRID_TO = 23;
const HOUR_PX = 46;
function weekGrid(days, map, onEmpty) {
  const now = new Date();
  const hours = Array.from({ length: GRID_TO - GRID_FROM }, (_, i) => GRID_FROM + i);
  const cols = days.map((d) => {
    const k = ymd(d);
    const list = (map.get(k) || []).slice();
    // Lanes for overlapping blocks (cancelled sessions may overlap live ones).
    const lanes = [];
    const placed = list.map((s) => {
      const start = new Date(s.startsAt);
      const end = new Date(start.getTime() + s.durationMin * 60000);
      let lane = lanes.findIndex((endAt) => endAt <= start.getTime());
      if (lane === -1) { lane = lanes.length; lanes.push(end.getTime()); } else lanes[lane] = end.getTime();
      return { s, start, end, lane };
    });
    const laneCount = Math.max(1, lanes.length);
    const col = h('div', { class: `co-wk-col ${k === ymd(now) ? 'today' : ''} ${k < ymd(now) ? 'past' : ''}` });
    const hit = h('div', { class: 'co-wk-hit', title: k >= ymd(now) ? t('დააჭირე ვარჯიშის დასანიშნად', 'Click to schedule a session') : '' });
    hit.addEventListener('click', (e) => {
      if (k < ymd(now)) return;
      const r = hit.getBoundingClientRect();
      const hour = Math.min(GRID_TO - 1, GRID_FROM + Math.floor((e.clientY - r.top) / HOUR_PX));
      const at = new Date(d); at.setHours(hour, 0, 0, 0);
      if (at.getTime() < Date.now() - 15 * 60000) { toast(t('წარსულ დროზე ვარჯიშს ვერ დანიშნავ.', 'You can’t schedule a session in the past.'), 'info'); return; }
      onEmpty(k, hour);
    });
    col.appendChild(hit);
    for (const p of placed) {
      const startMin = p.start.getHours() * 60 + p.start.getMinutes();
      const top = Math.max(0, ((startMin - GRID_FROM * 60) / 60) * HOUR_PX);
      const height = Math.max(22, (p.s.durationMin / 60) * HOUR_PX - 3);
      col.appendChild(h('a', {
        class: `co-wk-ev ${p.s.status === 'CANCELLED' ? 'cancelled' : ''} ${p.s.status === 'OPEN' ? 'open' : ''}`,
        href: `/coach/session/${p.s.id}`, 'data-link': '',
        style: `top:${top}px;height:${height}px;left:calc(${(p.lane / laneCount) * 100}% + 2px);width:calc(${100 / laneCount}% - 4px);--c:${sessionColor(p.s, now.getTime())}`,
        title: `${fmtTime(p.s.startsAt)} · ${p.s.clientName || t('თავისუფალი სლოტი', 'Open slot')} · ${p.s.kindLabel} · ${SESSION_STATUS[p.s.status] || p.s.status}`,
      },
      h('b', null, `${fmtTime(p.s.startsAt)} ${p.s.clientName ? firstWord(p.s.clientName) : t('სლოტი', 'Slot')}`),
      height > 36 ? h('span', null, [p.s.kindLabel, p.s.gym?.brand].filter(Boolean).join(' · ')) : null));
    }
    if (k === ymd(now)) {
      const m = now.getHours() * 60 + now.getMinutes();
      if (m >= GRID_FROM * 60 && m <= GRID_TO * 60) col.appendChild(h('div', { class: 'co-wk-now', style: { top: `${((m - GRID_FROM * 60) / 60) * HOUR_PX}px` } }));
    }
    return col;
  });
  return h('div', { class: 'co-wk', style: `--hour:${HOUR_PX}px` },
    h('div', { class: 'co-wk-head' }, h('span'), days.map((d) => h('div', { class: `co-wk-day ${ymd(d) === ymd(now) ? 'today' : ''}` }, h('span', null, KA_DAYS_SHORT[d.getDay()]), h('b', null, d.getDate())))),
    h('div', { class: 'co-wk-body', style: { height: `${(GRID_TO - GRID_FROM) * HOUR_PX}px` } },
      h('div', { class: 'co-wk-hours' }, hours.map((hr) => h('span', { style: { top: `${(hr - GRID_FROM) * HOUR_PX}px` } }, `${String(hr).padStart(2, '0')}:00`))),
      cols));
}

/* ── New session (modal) ──────────────────────────────── */
async function openNewSession(env, preset = {}) {
  let clients = [];
  let catalog = null;
  try {
    [{ clients }, catalog] = await Promise.all([get(`${API}/clients`), env.catalog()]);
  } catch (e) { toast(e.message, 'error'); return; }
  const gyms = env.profile.gyms || [];
  const kinds = catalog?.sessionKinds?.length ? catalog.sessionKinds : Object.entries(KIND_FALLBACK).map(([key, label]) => ({ key, label }));
  const today = ymd();
  const st = {
    clientId: preset.clientId && clients.some((c) => c.id === preset.clientId) ? preset.clientId : (preset.clientId === null ? '' : clients[0]?.id || ''),
    date: preset.date && preset.date >= today ? preset.date : today,
    time: preset.time || '',
    duration: 60,
    kind: 'STRENGTH',
    gymId: gyms[0]?.id || '',
    repeat: 1,
    note: '',
  };
  if (!clients.length) st.clientId = '';
  if (!st.time) {
    const next = new Date(Date.now() + 60 * 60000);
    st.time = st.date === today ? `${String(Math.min(22, next.getHours())).padStart(2, '0')}:00` : '18:00';
  }
  const who = select([{ value: '', label: t('თავისუფალი სლოტი — კლიენტი თავად დაჯავშნის', 'Open slot — a client books it themselves') }, ...clients.map((c) => ({ value: c.id, label: c.name }))], st.clientId, { 'aria-label': t('ვისთვის', 'For') });
  const whoHint = h('span', { class: 'field-hint' });
  const date = input({ type: 'date', min: today, value: st.date, required: true });
  const time = input({ type: 'time', step: 900, value: st.time, required: true });
  const durBox = h('div', { class: 'chips' });
  const kindBox = h('div', { class: 'chips' });
  const gym = select([...gyms.map((g) => ({ value: g.id, label: `${g.brand} · ${g.name}` })), { value: '', label: t('დარბაზის გარეშე', 'No gym') }], st.gymId, { 'aria-label': t('დარბაზი', 'Gym') });
  const repeat = select(Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: i === 0 ? t('ერთხელ', 'Once') : t(`ყოველ კვირას · ${i + 1} კვირა`, `Every week · ${i + 1} weeks`) })), 1, { 'aria-label': t('გამეორება', 'Repeat') });
  const note = textarea({ maxlength: 300, rows: 2, placeholder: t('მაგ. ფეხების დღე — წამოიღე ქამარი', 'e.g. Leg day — bring your belt') });
  const summary = h('div', { class: 'co-summary' });

  const paint = () => {
    mount(durBox, DURATIONS.map((m) => h('button', { type: 'button', class: `chip ${st.duration === m ? 'on' : ''}`, onClick: () => { st.duration = m; paint(); } }, `${m} ${t('წთ', 'min')}`)));
    mount(kindBox, kinds.map((k) => h('button', { type: 'button', class: `chip ${st.kind === k.key ? 'on' : ''}`, onClick: () => { st.kind = k.key; paint(); } }, k.label)));
    const c = clients.find((x) => x.id === who.value);
    whoHint.textContent = c ? (c.nextSession ? t(`შემდეგი ვარჯიში უკვე დაგეგმილია: ${relStart(c.nextSession)}`, `Next session already scheduled: ${relStart(c.nextSession)}`) : t('დაგეგმილი ვარჯიში არ აქვს', 'No sessions scheduled')) : t('სლოტს შენი ნებისმიერი კლიენტი დაჯავშნის „ჩემი ტრენერი“-დან — ერთხელ.', 'Any of your clients can book the slot from “My trainer” — once.');
    const at = date.value && time.value ? new Date(`${date.value}T${time.value}`) : null;
    const n = Number(repeat.value) || 1;
    mount(summary, at && !Number.isNaN(at.getTime())
      ? [icon('calendar', { size: 16 }), h('span', null, `${dayWithRel(date.value)}, ${time.value}–${fmtTime(new Date(at.getTime() + st.duration * 60000))}${n > 1 ? t(` · ${n} კვირა, ბოლო ${fmtDate(addDays(at, (n - 1) * 7))}`, ` · ${n} weeks, last on ${fmtDate(addDays(at, (n - 1) * 7))}`) : ''}`)]
      : h('span', { class: 'faint' }, t('აირჩიე დღე და დრო', 'Choose a day and time')));
  };
  [who, date, time, repeat].forEach((el) => el.addEventListener('input', paint));
  who.addEventListener('change', paint);
  repeat.addEventListener('change', paint);
  paint();

  const err = h('div', { class: 'form-error', hidden: true });
  let submitBtn;
  const submit = async (close) => {
    err.hidden = true;
    const at = new Date(`${date.value}T${time.value}`);
    if (!date.value || !time.value || Number.isNaN(at.getTime())) { err.textContent = t('აირჩიე დღე და დრო.', 'Choose a day and time.'); err.hidden = false; return; }
    if (at.getTime() < Date.now() - 15 * 60000) { err.textContent = t('წარსულ დროზე ვარჯიშს ვერ დანიშნავ.', 'You can’t schedule a session in the past.'); err.hidden = false; return; }
    await busy(submitBtn, async () => {
      try {
        const res = await post(`${API}/sessions`, {
          clientId: who.value || null, startsAt: at.toISOString(), durationMin: st.duration, gymId: gym.value || null, kind: st.kind, note: note.value.trim(), repeatWeeks: Number(repeat.value) || 1,
        });
        const c = clients.find((x) => x.id === who.value);
        toast(who.value
          ? t(`${firstWord(c?.name) || 'კლიენტს'} შეტყობინება მიუვა · ${res.sessions.length > 1 ? `${res.sessions.length} ვარჯიში` : 'ვარჯიში დაინიშნა'}`, `${firstWord(c?.name) || 'The client'} will be notified · ${res.sessions.length > 1 ? `${res.sessions.length} sessions` : 'session scheduled'}`)
          : t(`${res.sessions.length} თავისუფალი სლოტი გამოქვეყნდა`, `${res.sessions.length === 1 ? '1 open slot' : `${res.sessions.length} open slots`} published`));
        close();
        preset.onDone?.(res.sessions);
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
  };
  openModal({
    title: t('ვარჯიშის დანიშვნა', 'Schedule a session'),
    size: 'md',
    body: (close) => h('form', { class: 'form', novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(close); } },
      field(t('ვისთვის', 'For'), who, whoHint),
      h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date), field(t('დაწყება', 'Start'), time, t('შენი ადგილობრივი დროით', 'In your local time'))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('ხანგრძლივობა', 'Duration')), durBox),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('ვარჯიშის ტიპი', 'Session type')), kindBox),
      h('div', { class: 'form-row' }, gyms.length ? field(t('დარბაზი', 'Gym'), gym) : null, field(t('გამეორება', 'Repeat'), repeat)),
      field(t('შენიშვნა კლიენტს (არასავალდებულო)', 'Note to the client (optional)'), note),
      summary,
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('კლიენტს შეტყობინება მაშინვე მიუვა, შეხსენება — 24 და 1 საათით ადრე.', 'The client is notified right away and reminded 24 hours and 1 hour before.')),
      err,
      h('button', { type: 'submit', hidden: true })),
    footer: (close) => {
      submitBtn = button(t('დანიშვნა', 'Schedule'), { icon: 'check', onClick: () => submit(close) });
      return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), submitBtn];
    },
  });
}

/* ── Session detail ───────────────────────────────────── */
async function pageSession(env, id) {
  const body = frame(env, { active: 'calendar', title: t('ვარჯიში', 'Session'), back: { href: '/coach/calendar', label: t('კალენდარი', 'Calendar') } });
  mount(body, h('div', { class: 'grid grid-main' }, skeleton(6), skeleton(4)));
  let s;
  try {
    ({ session: s } = await get(`${API}/sessions/${encodeURIComponent(id)}`));
  } catch (e) { env.fail(body, e, () => pageSession(env, id)); return; }
  const catalog = await env.catalog();
  const title = s.clientName || (s.status === 'OPEN' ? t('თავისუფალი სლოტი', 'Open slot') : t('ვარჯიში', 'Session'));
  env.ctx.setTitle(title);
  const h1 = env.root.querySelector('.page-head h1');
  if (h1) h1.textContent = title;
  const subEl = h('p', null, `${longDay(s.startsAt)} · ${fmtTime(s.startsAt)} · ${s.durationMin} ${t('წთ', 'min')}`);
  env.root.querySelector('.page-head-text')?.appendChild(subEl);

  const now = Date.now();
  const started = new Date(s.startsAt).getTime() <= now + 15 * 60000;
  const canLog = Boolean(s.clientId && (s.status === 'DONE' || s.status === 'NO_SHOW' || (s.status === 'SCHEDULED' && started)));
  const canChange = (s.status === 'SCHEDULED' || s.status === 'OPEN') && !started;
  const tm = timing(s.startsAt, s.durationMin, now);
  const reload = () => pageSession(env, id);

  const header = card({ class: 'co-sess-head' },
    h('div', { class: 'between' },
      s.status === 'SCHEDULED' ? badge(s.clientConfirmedAt ? t('კლიენტმა დაადასტურა', 'Client confirmed') : t('დასტურს ელოდება', 'Awaiting confirmation'), s.clientConfirmedAt ? 'ok' : 'neutral') : badge(SESSION_STATUS[s.status] || s.status, sessionTone(s)),
      s.status === 'SCHEDULED' || s.status === 'OPEN' ? h('span', { class: 'faint' }, tm.text) : null),
    h('div', { class: 'co-sess-main' },
      h('div', { class: 'co-next-time' }, h('strong', null, fmtTime(s.startsAt)), h('span', null, dayWithRel(s.startsAt))),
      h('span', { class: 'co-next-sep' }),
      h('div', { class: 'row-main' },
        h('div', { class: 'card-title' }, `${kindLabel(s, catalog)} · ${s.durationMin} ${t('წთ', 'min')}`),
        s.gym ? h('div', { class: 'card-sub co-inline' }, icon('mapPin', { size: 14 }), `${s.gym.brand} · ${s.gym.name}${s.gym.city ? `, ${s.gym.city}` : ''}`) : h('div', { class: 'card-sub' }, t('დარბაზის გარეშე', 'No gym')),
        s.seriesId && s.seriesId !== 'slot' ? h('div', { class: 'card-sub co-inline' }, icon('repeat', { size: 14 }), t('ყოველკვირეული სერიის ნაწილი', 'Part of a weekly series')) : null,
        s.seriesId === 'slot' ? h('div', { class: 'card-sub co-inline' }, icon('calendarCheck', { size: 14 }), t('კლიენტმა თავისუფალი სლოტი დაჯავშნა', 'A client booked this open slot')) : null)),
    s.clientId ? h('a', { class: 'co-person', href: `/coach/client/${s.clientId}`, 'data-link': '' },
      avatarEl(s.clientName, s.clientAvatarUrl, 40),
      h('b', { class: 'row-main' }, s.clientName),
      s.clientRating ? h('span', { class: 'co-stars', title: t(`შეფასება ${s.clientRating} 5-დან`, `Rated ${s.clientRating} out of 5`) }, '★'.repeat(s.clientRating), h('span', { class: 'faint' }, '★'.repeat(5 - s.clientRating))) : null,
      icon('chevronRight', { size: 16 })) : null,
    s.note ? h('div', { class: 'co-quote' }, `„${s.note}“`) : null,
    s.status === 'CANCELLED' ? h('div', { class: 'co-note co-note-warn' }, `${t('გაუქმდა', 'Cancelled')}${s.cancelledBy === 'CLIENT' ? t(' კლიენტის მიერ', ' by the client') : s.cancelledBy === 'TRAINER' ? t(' შენ მიერ', ' by you') : ''}${s.cancelReason ? ` — ${s.cancelReason}` : ''}${s.lateCancel ? t(' · ბოლო წუთის გაუქმება (<12 სთ)', ' · last-minute cancellation (<12 h)') : ''}`) : null);

  const watch = s.workout ? section(t(`კლიენტის საათიდან · ${workoutKind(s.workout.kind)}`, `From the client’s watch · ${workoutKind(s.workout.kind)}`), h('div', { class: 'grid grid-3' },
    card(stat(t('ხანგრძლივობა', 'Duration'), `${s.workout.durationMin}`, { unit: t('წთ', 'min'), icon: 'timer' })),
    card(stat(t('კალორია', 'Calories'), s.workout.kcal != null ? fmtNum(s.workout.kcal) : '—', { unit: t('კკალ', 'kcal'), icon: 'flame' })),
    card(stat(t('საშ. პულსი', 'Avg. HR'), s.workout.avgHeartRate != null ? `${s.workout.avgHeartRate}` : '—', { unit: 'bpm', icon: 'heart' })))) : null;

  // Results log (exercises).
  let rows = s.exercises.map((e) => ({ name: e.name, sets: e.sets ?? '', reps: e.reps ?? '', kg: e.kg ?? '' }));
  const exBox = h('div', { class: 'co-ex' });
  const volEl = h('span', { class: 'faint' });
  const quickBox = h('div', { class: 'chips' });
  const trainerNote = textarea({ maxlength: 1000, rows: 3, value: s.trainerNote || '', placeholder: t('რა გამოუვიდა კარგად, რაზე იმუშაოს შემდეგ ჯერზე', 'What went well, what to work on next time') });
  const paintVolume = () => {
    const v = rows.reduce((sum, r) => sum + (num(r.sets) || 0) * (num(r.reps) || 0) * (num(r.kg) || 0), 0);
    volEl.textContent = v ? t(`მოცულობა ${fmtNum(Math.round(v))} კგ`, `Volume ${fmtNum(Math.round(v))} kg`) : '';
  };
  const paintEx = () => {
    mount(exBox, rows.length ? h('div', { class: 'co-ex-head', 'aria-hidden': 'true' }, h('span', null, '#'), h('span', null, t('სავარჯიშო', 'Exercise')), h('span', null, t('სეტი', 'Sets')), h('span', null, t('გამეორება', 'Repeat')), h('span', null, t('კგ', 'kg')), h('span')) : null,
      rows.map((r, i) => {
        const upd = (k) => (e) => { r[k] = k === 'name' ? e.target.value : e.target.value.replace(/[^\d.,]/g, '').slice(0, 6); if (k !== 'name') e.target.value = r[k]; paintVolume(); };
        return h('div', { class: 'co-ex-row' },
          h('span', { class: 'co-ex-n' }, i + 1),
          input({ value: r.name, placeholder: t('სავარჯიშო', 'Exercise'), maxlength: 80, 'aria-label': t(`სავარჯიშო ${i + 1}`, `Exercise ${i + 1}`), onInput: upd('name') }),
          input({ value: r.sets, inputmode: 'numeric', placeholder: '—', 'aria-label': t('სეტი', 'Sets'), onInput: upd('sets') }),
          input({ value: r.reps, inputmode: 'numeric', placeholder: '—', 'aria-label': t('გამეორება', 'Repeat'), onInput: upd('reps') }),
          input({ value: r.kg, inputmode: 'decimal', placeholder: '—', 'aria-label': t('კგ', 'kg'), onInput: upd('kg') }),
          iconButton('trash', { title: t('წაშლა', 'Delete'), onClick: () => { rows.splice(i, 1); paintEx(); } }));
      }));
    mount(quickBox, QUICK_EX.filter((q) => !rows.some((r) => r.name === q)).map((q) => h('button', { type: 'button', class: 'chip', onClick: () => { rows.push({ name: q, sets: '3', reps: '10', kg: '' }); paintEx(); } }, `+ ${q}`)));
    paintVolume();
  };
  paintEx();
  const complete = async (btn, status) => {
    await busy(btn, async () => {
      try {
        const exercises = rows.filter((r) => String(r.name).trim()).map((r) => ({ name: String(r.name).trim(), sets: num(r.sets), reps: num(r.reps), kg: num(r.kg) }));
        await post(`${API}/sessions/${encodeURIComponent(s.id)}/complete`, { status, exercises, trainerNote: trainerNote.value.trim() });
        toast(status === 'DONE' ? t('შენახულია — კლიენტი ნახავს შედეგს და შეფასებას დატოვებს', 'Saved — the client will see the results and can leave a rating') : t('მონიშნულია: არ მოვიდა', 'Marked as no-show'));
        reload();
      } catch (e) { toast(e.message, 'error'); }
    });
  };
  const logSection = canLog ? section(t('შედეგები', 'Results'), card({ class: 'stack' },
    h('div', { class: 'between' }, h('span', { class: 'field-label' }, t('სავარჯიშოები', 'Exercises')), volEl),
    exBox,
    quickBox,
    button(t('სხვა სავარჯიშო', 'Another exercise'), { variant: 'ghost', size: 'sm', icon: 'plus', onClick: () => { rows.push({ name: '', sets: '', reps: '', kg: '' }); paintEx(); exBox.querySelector('.co-ex-row:last-child input')?.focus(); } }),
    field(t('შენიშვნა კლიენტს', 'Note to the client'), trainerNote),
    (() => {
      const doneBtn = button(s.status === 'DONE' ? t('განახლება', 'Update') : t('ჩატარდა', 'Done'), { icon: 'check' });
      const noBtn = button(t('არ მოვიდა', 'No-show'), { variant: 'ghost', icon: 'x' });
      doneBtn.addEventListener('click', () => complete(doneBtn, 'DONE'));
      noBtn.addEventListener('click', () => complete(noBtn, 'NO_SHOW'));
      return h('div', { class: 'hstack' }, doneBtn, noBtn);
    })())) : null;

  // Move / edit / cancel (only before it starts).
  let changeSection = null;
  if (canChange) {
    const kinds = catalog?.sessionKinds?.length ? catalog.sessionKinds : Object.entries(KIND_FALLBACK).map(([key, label]) => ({ key, label }));
    const gyms = env.profile.gyms || [];
    const d0 = new Date(s.startsAt);
    const date = input({ type: 'date', min: ymd(), value: ymd(d0) });
    const time = input({ type: 'time', step: 900, value: fmtTime(d0) });
    const dur = select(DURATIONS.concat(DURATIONS.includes(s.durationMin) ? [] : [s.durationMin]).sort((a, b) => a - b).map((m) => ({ value: m, label: `${m} ${t('წთ', 'min')}` })), s.durationMin);
    const kind = select(kinds.map((k) => ({ value: k.key, label: k.label })), s.kind);
    const gym = select([...gyms.map((g) => ({ value: g.id, label: `${g.brand} · ${g.name}` })), ...(s.gym && !gyms.some((g) => g.id === s.gym.id) ? [{ value: s.gym.id, label: `${s.gym.brand} · ${s.gym.name}` }] : []), { value: '', label: t('დარბაზის გარეშე', 'No gym') }], s.gym?.id || '');
    const note = textarea({ maxlength: 300, rows: 2, value: s.note || '' });
    const err = h('div', { class: 'form-error', hidden: true });
    const save = button(t('ცვლილების შენახვა', 'Save changes'), { icon: 'check' });
    save.addEventListener('click', async () => {
      err.hidden = true;
      const at = new Date(`${date.value}T${time.value}`);
      if (Number.isNaN(at.getTime())) { err.textContent = t('აირჩიე დღე და დრო.', 'Choose a day and time.'); err.hidden = false; return; }
      if (at.getTime() < Date.now() - 15 * 60000) { err.textContent = t('წარსულ დროზე ვერ გადაიტან.', 'You can’t move it to the past.'); err.hidden = false; return; }
      const body2 = { durationMin: Number(dur.value), kind: kind.value, gymId: gym.value || null, note: note.value.trim() };
      if (at.getTime() !== d0.getTime()) body2.startsAt = at.toISOString();
      await busy(save, async () => {
        try {
          await patch(`${API}/sessions/${encodeURIComponent(s.id)}`, body2);
          toast(body2.startsAt && s.clientId ? t('გადაიტანე — კლიენტს ახალი დროის შეტყობინება მიუვა', 'Moved — the client will be notified of the new time') : t('შენახულია', 'Saved'));
          reload();
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      });
    });
    const cancelBtn = button(s.status === 'OPEN' ? t('სლოტის გაუქმება', 'Cancel slot') : t('ვარჯიშის გაუქმება', 'Cancel session'), { variant: 'ghost', icon: 'x' });
    cancelBtn.addEventListener('click', () => cancelSession(s, reload));
    changeSection = section(t('ცვლილება', 'Change'), card({ class: 'stack' },
      h('div', { class: 'form-row' }, field(t('დღე', 'Day'), date), field(t('დრო', 'Time'), time, t('შენი ადგილობრივი დროით', 'In your local time'))),
      h('div', { class: 'form-row' }, field(t('ხანგრძლივობა', 'Duration'), dur), field(t('ტიპი', 'Type'), kind)),
      field(t('დარბაზი', 'Gym'), gym),
      field(t('შენიშვნა კლიენტს', 'Note to the client'), note),
      s.clientId ? h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('დროის შეცვლისას კლიენტს შეტყობინება მიუვა და ხელახლა დაადასტურებს.', 'If you change the time, the client is notified and confirms again.')) : null,
      err,
      h('div', { class: 'hstack' }, save, cancelBtn)));
  }

  const info = section(t('სტატუსი', 'Status'), card({ class: 'stack' },
    h('div', { class: 'list' },
      infoRow('calendar', t('თარიღი', 'Date'), `${longDay(s.startsAt)}, ${fmtTime(s.startsAt)}–${fmtTime(new Date(new Date(s.startsAt).getTime() + s.durationMin * 60000))}`),
      infoRow('user', t('კლიენტი', 'Client'), s.clientName || t('ჯერ არავის დაუჯავშნია', 'No one has booked it yet')),
      infoRow('check', t('კლიენტის დასტური', 'Client confirmation'), s.status === 'OPEN' ? '—' : s.clientConfirmedAt ? fmtDateTimeSafe(s.clientConfirmedAt) : t('ჯერ არ დაუდასტურებია', 'Not confirmed yet')),
      infoRow('dumbbell', t('სტატუსი', 'Status'), SESSION_STATUS[s.status] || s.status)),
    !canLog && !canChange && s.status !== 'CANCELLED' && s.status !== 'DONE' && s.status !== 'NO_SHOW'
      ? h('p', { class: 'faint', style: { fontSize: '13px' } }, s.status === 'OPEN' ? t('სლოტი უკვე დაიწყო — ცვლილება აღარ შეიძლება.', 'This slot has already started — it can’t be changed.') : t('შედეგის ჩაწერა ვარჯიშის დაწყებიდან შეგეძლება.', 'You can log results once the session has started.'))
      : null));

  mount(body, h('div', { class: 'grid grid-main' },
    h('div', null, section(null, header), watch, logSection),
    h('div', null, changeSection, info)));
}

function fmtDateTimeSafe(v) { return `${fmtDate(v)}, ${fmtTime(v)}`; }
function infoRow(ic, label, value) {
  return h('div', { class: 'row' }, tile(ic, 'teal', 34), h('div', { class: 'row-main' }, h('div', { class: 'row-sub', style: { marginTop: 0 } }, label), h('div', { class: 'row-title', style: { fontWeight: 500 } }, value)));
}

function cancelSession(s, onDone) {
  const reason = textarea({ maxlength: 300, rows: 2, placeholder: t('მაგ. დარბაზი დაკეტილია', 'e.g. The gym is closed') });
  const err = h('div', { class: 'form-error', hidden: true });
  let btn;
  openModal({
    title: s.status === 'OPEN' ? t('სლოტის გაუქმება', 'Cancel slot') : t('ვარჯიშის გაუქმება', 'Cancel session'),
    size: 'sm',
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted' }, s.clientName ? t(`${s.clientName}-ს შეტყობინება მიუვა.`, `${s.clientName} will be notified.`) : t('სლოტი აღარ გამოჩნდება კლიენტებთან.', 'Clients will no longer see this slot.')),
      s.clientName ? field(t('მიზეზი (არასავალდებულო)', 'Reason (optional)'), reason) : null,
      err),
    footer: (close) => {
      btn = button(t('გაუქმება', 'Cancel'), { variant: 'danger', onClick: async () => {
        await busy(btn, async () => {
          try {
            await post(`${API}/sessions/${encodeURIComponent(s.id)}/cancel`, { reason: reason.value.trim() });
            toast(t('გაუქმდა', 'Cancelled'));
            close();
            onDone?.();
          } catch (e) { err.textContent = e.message; err.hidden = false; }
        });
      } });
      return [button(t('არა', 'No'), { variant: 'ghost', onClick: () => close() }), btn];
    },
  });
}

/* ── Meal plan editor ─────────────────────────────────── */
async function pagePlan(env, clientId) {
  const body = frame(env, { active: 'clients', title: t('კვების გეგმა', 'Meal plan'), back: { href: `/coach/client/${clientId}?tab=food`, label: t('კლიენტის ბარათი', 'Client card') } });
  mount(body, skeleton(8));
  let d;
  try { d = await get(`${API}/clients/${encodeURIComponent(clientId)}`); } catch (e) { env.fail(body, e, () => pagePlan(env, clientId)); return; }
  const sub = h('p', null, d.client.name);
  env.root.querySelector('.page-head-text')?.appendChild(sub);
  env.ctx.setTitle(t(`კვების გეგმა · ${d.client.name}`, `Meal plan · ${d.client.name}`));
  if (!d.link.scopes.nutrition) { mount(body, lockedCard('nutrition', d.client.name)); return; }

  const p = d.plan;
  const st = {
    title: p?.title || t('ჩემი გეგმა', 'My plan'),
    kcal: p ? String(p.targets.calories) : '',
    protein: p?.targets.protein ? String(p.targets.protein) : '',
    carbs: p?.targets.carbs ? String(p.targets.carbs) : '',
    fat: p?.targets.fat ? String(p.targets.fat) : '',
    meals: p ? p.meals.map((m) => ({ slot: m.slot, time: m.time || '', items: m.items.map((i) => ({ name: i.name, grams: i.grams ?? '', calories: i.calories ?? '' })) }))
      : [{ slot: 'breakfast', time: '08:30', items: [] }, { slot: 'lunch', time: '14:00', items: [] }, { slot: 'dinner', time: '20:00', items: [] }],
    note: p?.note || '',
  };
  const kg = d.weight?.currentKg ?? null;
  const presets = kg ? [
    { label: t('კლება', 'Cut'), kcal: Math.round((kg * 26) / 50) * 50, protein: Math.round(kg * 2) },
    { label: t('შენარჩუნება', 'Maintain'), kcal: Math.round((kg * 31) / 50) * 50, protein: Math.round(kg * 1.8) },
    { label: t('მატება', 'Gain'), kcal: Math.round((kg * 36) / 50) * 50, protein: Math.round(kg * 1.8) },
  ] : [];

  const title = input({ value: st.title, maxlength: 80, placeholder: t('მაგ. ჭრის ფაზა · 1900 კკალ', 'e.g. Cutting phase · 1900 kcal'), onInput: (e) => { st.title = e.target.value; } });
  const numIn = (key, label) => field(label, input({ value: st[key], inputmode: 'numeric', placeholder: '—', class: 'input co-num', onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); st[key] = e.target.value; paintMacro(); } }));
  const macroBox = h('div');
  const mealsBox = h('div', { class: 'stack' });
  const addBox = h('div', { class: 'chips' });
  const plannedEl = h('span', { class: 'faint' });
  const note = textarea({ value: st.note, maxlength: 1000, rows: 3, placeholder: t('მაგ. ყოველ კვებაში ცილა, 2.5 ლ წყალი, შაქრიანი სასმელი — არა', 'e.g. Protein at every meal, 2.5 L of water, no sugary drinks'), onInput: (e) => { st.note = e.target.value; } });
  const targetsRow = h('div', { class: 'co-targets' });
  const paintTargets = () => mount(targetsRow, numIn('kcal', t('კკალ / დღე', 'kcal / day')), numIn('protein', t('ცილა, გ', 'Protein, g')), numIn('carbs', t('ნახშირწყალი, გ', 'Carbs, g')), numIn('fat', t('ცხიმი, გ', 'Fat, g')));

  function paintMacro() {
    const tg = { calories: num(st.kcal), protein: num(st.protein), carbs: num(st.carbs), fat: num(st.fat) };
    const mk = (tg.protein || 0) * 4 + (tg.carbs || 0) * 4 + (tg.fat || 0) * 9;
    const diff = tg.calories ? Math.abs(mk - tg.calories) : 0;
    mount(macroBox, mk ? [macroBar(tg), tg.calories ? h('p', { class: 'co-macro-check', style: { color: diff > 150 ? 'var(--warn)' : 'var(--ok)' } }, `${t(`მაკროებიდან ${fmtNum(Math.round(mk))} კკალ`, `${fmtNum(Math.round(mk))} kcal from macros`)}${diff > 150 ? t(' — დღიურ კალორიას არ ემთხვევა', ' — doesn’t match daily calories') : t(' — ემთხვევა დღიურ კალორიას', ' — matches daily calories')}`) : null] : null);
  }
  function paintPlanned() {
    const planned = st.meals.reduce((s, m) => s + m.items.reduce((a, i) => a + (num(i.calories) || 0), 0), 0);
    plannedEl.textContent = planned ? t(`მენიუში ${fmtNum(Math.round(planned))} კკალ`, `${fmtNum(Math.round(planned))} kcal in the menu`) : '';
  }
  function paintMeals() {
    mount(mealsBox, st.meals.map((m, mi) => card({ class: 'co-meal' },
      h('div', { class: 'co-meal-head' },
        h('b', null, MEAL_SLOTS.find((x) => x.key === m.slot)?.label || m.slot),
        input({ type: 'time', value: m.time, class: 'input co-meal-time', 'aria-label': t('დრო', 'Time'), onInput: (e) => { m.time = e.target.value; } }),
        iconButton('x', { title: t('კვების წაშლა', 'Delete meal'), onClick: () => { st.meals.splice(mi, 1); paintMeals(); } })),
      m.items.length ? h('div', { class: 'co-item-head', 'aria-hidden': 'true' }, h('span', null, t('პროდუქტი', 'Food')), h('span', null, t('გ', 'g')), h('span', null, t('კკალ', 'kcal')), h('span')) : null,
      m.items.map((it, ii) => h('div', { class: 'co-item' },
        input({ value: it.name, placeholder: t('პროდუქტი', 'Food'), maxlength: 80, 'aria-label': t('პროდუქტი', 'Food'), onInput: (e) => { it.name = e.target.value; } }),
        input({ value: it.grams, inputmode: 'numeric', placeholder: t('გ', 'g'), 'aria-label': t('გრამი', 'Grams'), onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); it.grams = e.target.value; } }),
        input({ value: it.calories, inputmode: 'numeric', placeholder: t('კკალ', 'kcal'), 'aria-label': t('კალორია', 'Calories'), onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); it.calories = e.target.value; paintPlanned(); } }),
        iconButton('trash', { title: t('წაშლა', 'Delete'), onClick: () => { m.items.splice(ii, 1); paintMeals(); } }))),
      button(t('პროდუქტის დამატება', 'Add food'), { variant: 'ghost', size: 'sm', icon: 'plus', onClick: () => { m.items.push({ name: '', grams: '', calories: '' }); paintMeals(); mealsBox.querySelectorAll('.co-meal')[mi]?.querySelector('.co-item:last-of-type input')?.focus(); } }))));
    mount(addBox, MEAL_SLOTS.filter((s) => !st.meals.some((m) => m.slot === s.key)).map((s) => h('button', { type: 'button', class: 'chip', onClick: () => { st.meals.push({ slot: s.key, time: s.time, items: [] }); paintMeals(); } }, `+ ${s.label}`)));
    paintPlanned();
  }
  paintTargets();
  paintMacro();
  paintMeals();

  const err = h('div', { class: 'form-error', hidden: true });
  const save = button(p ? t('ახალი ვერსიის გაგზავნა', 'Send new version') : t('გეგმის გაგზავნა', 'Send plan'), { icon: 'send' });
  save.addEventListener('click', async () => {
    err.hidden = true;
    const cal = num(st.kcal);
    if (!cal || cal < 800 || cal > 6000) { err.textContent = t('დღიური კალორია 800–6000 უნდა იყოს.', 'Daily calories must be 800–6000.'); err.hidden = false; return; }
    if (st.title.trim().length < 2) { err.textContent = t('დაარქვი გეგმას სახელი.', 'Give the plan a name.'); err.hidden = false; return; }
    const payload = {
      title: st.title.trim(),
      targets: { calories: Math.round(cal), protein: num(st.protein), carbs: num(st.carbs), fat: num(st.fat) },
      meals: st.meals.map((m) => ({ slot: m.slot, time: /^\d{2}:\d{2}$/.test(m.time) ? m.time : null, items: m.items.filter((i) => String(i.name).trim()).map((i) => ({ name: String(i.name).trim(), grams: num(i.grams), calories: num(i.calories) })) })),
      note: st.note.trim(),
    };
    await busy(save, async () => {
      try {
        await post(`${API}/clients/${encodeURIComponent(clientId)}/plan`, payload);
        toast(t(`გეგმა გაიგზავნა — ${firstWord(d.client.name)} შეტყობინებას მიიღებს`, `Plan sent — ${firstWord(d.client.name)} will be notified`));
        env.ctx.navigate(`/coach/client/${clientId}?tab=food`);
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
  });

  mount(body, h('div', { class: 'grid grid-main' },
    h('div', null,
      section(t('სამიზნეები', 'Targets'), card({ class: 'stack' },
        field(t('სათაური', 'Title'), title),
        presets.length ? h('div', { class: 'field' }, h('span', { class: 'field-label' }, t(`სწრაფი დაწყება (${kg} კგ-ზე)`, `Quick start (for ${kg} kg)`)),
          h('div', { class: 'chips' }, presets.map((pr) => h('button', { type: 'button', class: 'chip', onClick: () => {
            st.kcal = String(pr.kcal); st.protein = String(pr.protein);
            const f = Math.round((pr.kcal * 0.27) / 9);
            st.fat = String(f); st.carbs = String(Math.max(0, Math.round((pr.kcal - pr.protein * 4 - f * 9) / 4)));
            if (!st.title || st.title === t('ჩემი გეგმა', 'My plan')) { st.title = `${pr.label} · ${pr.kcal} ${t('კკალ', 'kcal')}`; title.value = st.title; }
            paintTargets(); paintMacro();
          } }, `${pr.label} · ${fmtNum(pr.kcal)}`))),
          h('span', { class: 'field-hint' }, t('საწყისი მიახლოება წონიდან — მორგება შენზეა.', 'A starting estimate from body weight — adjust it as you see fit.'))) : null,
        targetsRow,
        macroBox)),
      section(t('მენიუ', 'Menu'), h('div', { class: 'stack' }, mealsBox, addBox), { action: plannedEl })),
    h('div', { class: 'co-sticky' },
      section(t('რჩევა კლიენტს', 'Tips for the client'), card({ class: 'stack' },
        note,
        h('p', { class: 'disclaimer', style: { marginTop: 0 } }, icon('info', { size: 14 }), t('გეგმა კლიენტის პირად კვების პროგრამას არ ცვლის — დაცვა მისი დღიურიდან ითვლება. სამედიცინო მდგომარეობისას (დიაბეტი, თირკმელი, ორსულობა, კვების დარღვევა) კლიენტმა ექიმთანაც უნდა შეათანხმოს.', 'Your plan doesn’t replace the client’s own nutrition program — adherence is measured from their food diary. With a medical condition (diabetes, kidney disease, pregnancy, an eating disorder) the client should also agree it with their doctor.')),
        err,
        save)),
      p ? section(t('მიმდინარე გეგმა', 'Current plan'), planSummary(p, null)) : null)));
}

/* ── Goal proposal ────────────────────────────────────── */
async function pageGoal(env, clientId) {
  const body = frame(env, { active: 'clients', title: t('მიზნის შეთავაზება', 'Propose a goal'), back: { href: `/coach/client/${clientId}?tab=weight`, label: t('კლიენტის ბარათი', 'Client card') } });
  mount(body, skeleton(6));
  let d;
  try { d = await get(`${API}/clients/${encodeURIComponent(clientId)}`); } catch (e) { env.fail(body, e, () => pageGoal(env, clientId)); return; }
  env.root.querySelector('.page-head-text')?.appendChild(h('p', null, t(`${d.client.name} — კლიენტი მიიღებს შეტყობინებას და თავად დაადასტურებს`, `${d.client.name} — the client is notified and confirms it themselves`)));
  env.ctx.setTitle(t(`მიზანი · ${d.client.name}`, `Goal · ${d.client.name}`));
  if (!d.link.scopes.weight) { mount(body, lockedCard('weight', d.client.name)); return; }

  const current = d.weight?.currentKg ?? null;
  const st = { type: 'lose', weeks: 12 };
  const target = input({ inputmode: 'decimal', class: 'input co-big-input', placeholder: '72', value: d.weight?.goal ? String(d.weight.goal.targetKg) : current ? String(Math.round(current * 0.93)) : '' });
  const note = textarea({ maxlength: 300, rows: 2, placeholder: t('მაგ. რეალისტური და მდგრადი ტემპი — ერთად გავაკეთებთ', 'e.g. A realistic, sustainable pace — we’ll do it together') });
  const typeBox = h('div', { class: 'chips' });
  const weeksBox = h('div', { class: 'chips' });
  const calc = h('div');
  const err = h('div', { class: 'form-error', hidden: true });
  const paint = () => {
    mount(typeBox, Object.entries(GOAL_TYPE).map(([k, l]) => h('button', { type: 'button', class: `chip ${st.type === k ? 'on' : ''}`, onClick: () => { st.type = k; paint(); } }, l)));
    mount(weeksBox, [4, 8, 12, 16, 24].map((wk) => h('button', { type: 'button', class: `chip ${st.weeks === wk ? 'on' : ''}`, onClick: () => { st.weeks = wk; paint(); } }, t(`${wk} კვირა`, `${wk} weeks`))));
    const tk = num(target.value);
    const pace = current && tk ? Math.abs(current - tk) / st.weeks : null;
    const pct = current && pace ? (pace / current) * 100 : null;
    const unsafe = pct != null && ((st.type === 'lose' && pct > 1) || (st.type === 'gain' && pace > 0.5));
    const deadline = addDays(new Date(), st.weeks * 7);
    mount(calc,
      h('div', { class: 'grid grid-3' },
        card(stat(t('ტემპი', 'Pace'), pace != null ? fmtNum(pace, 2) : '—', { unit: t('კგ / კვირა', 'kg / week') })),
        card(stat(t('სხეულის წონის', 'Of body weight'), pct != null ? `${fmtNum(pct, 1)}%` : '—', { delta: t('კვირაში', 'per week') })),
        card(stat(t('ვადა', 'Deadline'), fmtDate(deadline, { year: true })))),
      unsafe ? h('div', { class: 'co-note co-note-warn', style: { marginTop: '12px' } }, icon('alert', { size: 16 }), st.type === 'lose'
        ? t('კვირაში სხეულის წონის 1%-ზე მეტი კლება ზედმეტად სწრაფია — კუნთის დაკარგვისა და დაბრუნების რისკია. გაზარდე ვადა.', 'Losing more than 1% of body weight a week is too fast — it risks muscle loss and regaining the weight. Extend the deadline.')
        : t('კვირაში 0.5 კგ-ზე მეტი მატება ძირითადად ცხიმია. გაზარდე ვადა.', 'Gaining more than 0.5 kg a week is mostly fat. Extend the deadline.')) : null);
  };
  target.addEventListener('input', () => { target.value = target.value.replace(/[^\d.,]/g, '').slice(0, 5); paint(); });
  paint();
  const send = button(t('შეთავაზება კლიენტს', 'Propose to client'), { icon: 'send' });
  send.addEventListener('click', async () => {
    err.hidden = true;
    const tk = num(target.value);
    if (!tk || tk < 30 || tk > 300) { err.textContent = t('მიუთითე წონა 30–300 კგ.', 'Enter a weight of 30–300 kg.'); err.hidden = false; return; }
    await busy(send, async () => {
      try {
        await post(`${API}/clients/${encodeURIComponent(clientId)}/goal`, { type: st.type, targetKg: Math.round(tk * 10) / 10, deadlineYmd: ymd(addDays(new Date(), st.weeks * 7)), note: note.value.trim() });
        toast(t('შეთავაზება გაიგზავნა — კლიენტი თავად დაადასტურებს', 'Proposal sent — the client confirms it themselves'));
        env.ctx.navigate(`/coach/client/${clientId}?tab=weight`);
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
  });
  mount(body, h('div', { class: 'grid grid-main' },
    section(t('მიზანი', 'Goal'), card({ class: 'stack' },
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('მიზნის ტიპი', 'Goal type')), typeBox),
      field(t(`სამიზნე წონა, კგ${current ? ` (ახლა ${current})` : ''}`, `Target weight, kg${current ? ` (now ${current})` : ''}`), target),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('ვადა', 'Deadline')), weeksBox),
      calc,
      field(t('შეტყობინება კლიენტს (არასავალდებულო)', 'Message to the client (optional)'), note),
      err,
      h('div', null, send))),
    h('div', null,
      d.weight ? section(t('წონა ახლა', 'Weight now'), card(weightChart(d.weight, 200))) : null,
      d.link.proposedGoal ? section(t('წინა შეთავაზება', 'Previous proposal'), card({ class: 'co-note' }, t(`${GOAL_TYPE[d.link.proposedGoal.type] || ''} → ${d.link.proposedGoal.targetKg} კგ, ${fmtDate(d.link.proposedGoal.deadlineYmd, { year: true })} — ჯერ არ დაუდასტურებია. ახალი შეთავაზება ძველს ჩაანაცვლებს.`, `${GOAL_TYPE[d.link.proposedGoal.type] || ''} → ${d.link.proposedGoal.targetKg} kg, ${fmtDate(d.link.proposedGoal.deadlineYmd, { year: true })} — not confirmed yet. A new proposal replaces the old one.`))) : null)));
}

/* ── Profile ──────────────────────────────────────────── */
async function pageProfile(env) {
  const p = env.profile;
  const reload = async () => {
    const fresh = await get('/api/trainer/me');
    session.trainer = fresh;
    env.profile = fresh.trainerProfile;
    env.me = fresh;
    if (fresh.trainerProfile?.status !== 'VERIFIED') renderGate(env, fresh);
    else pageProfile(env);
  };
  const body = frame(env, {
    active: 'profile',
    title: t('პროფილი', 'Profile'),
    sub: t('ასე გხედავენ კლიენტები', 'How clients see you'),
    actions: [button(t('პროფილის რედაქტირება', 'Edit profile'), { icon: 'edit', onClick: () => openProfileEditor(env, p, reload) })],
  });
  const catalog = await env.catalog();
  mount(body, h('div', { class: 'grid grid-main' },
    h('div', null,
      section(null, publicCard(p, catalog)),
      section(t('სერტიფიკატები', 'Certificates'), certificatesCard(p, reload), { action: p.certificates.length < 8 ? button(t('დამატება', 'Add'), { variant: 'ghost', size: 'sm', icon: 'plus', onClick: () => openCertificateForm(reload) }) : null }),
      section(t('კონფიდენციალობა', 'Privacy'), card(h('div', { class: 'hstack', style: { alignItems: 'flex-start' } }, tile('shield', 'teal', 38),
        h('p', { class: 'muted', style: { flex: 1 } }, t('კლიენტის მონაცემს ხედავ მხოლოდ მისი თანხმობით და მხოლოდ კავშირის განმავლობაში. გაზიარება კლიენტს ნებისმიერ წამს შეუძლია შეწყვიტოს. მონაცემის აპის გარეთ გადაღება/გადაგზავნა კლიენტის ნებართვის გარეშე არ შეიძლება.', 'You see a client’s data only with their consent and only while you’re connected. The client can stop sharing at any moment. Don’t capture or send their data outside the app without the client’s permission.')))))),
    h('div', null,
      p.code ? section(t('ჩემი QR და კოდი', 'My QR and code'), qrCard(p)) : null,
      section(t('როგორ შემოგიერთდება კლიენტი', 'How a client joins you'), card(h('ol', { class: 'co-steps' },
        h('li', null, t('კლიენტი MEDICARD აპში გახსნის „ჩემი ტრენერი“-ს და დაასკანერებს შენს QR-ს ან შეიყვანს კოდს.', 'The client opens “My trainer” in the MEDICARD app and scans your QR or enters your code.')),
        h('li', null, t('თანხმობის ეკრანზე თავად აირჩევს, რას გაგიზიაროს: ვარჯიშები, კვება, წონა, ფოტოები.', 'On the consent screen they choose what to share with you: workouts, nutrition, weight, photos.')),
        h('li', null, t('ან პირიქით: ჩასვი მისი პირადი QR-ის ბმული „კლიენტის მოწვევაში“ — მოწვევას თავად მიიღებს.', 'Or the other way round: paste their personal QR link into “Invite a client” — they accept the invite themselves.'))),
      button(t('კლიენტის მოწვევა', 'Invite a client'), { variant: 'secondary', icon: 'userPlus', onClick: () => openInvite(env) }))))));
}

function publicCard(p, catalog) {
  const spec = (k) => catalog?.specialties?.find((s) => s.key === k)?.label || {
    weight_loss: t('წონის კლება', 'Weight loss'), muscle: t('კუნთის მატება', 'Muscle gain'), strength: t('ძალა', 'Strength'), functional: t('ფუნქციური ვარჯიში', 'Functional training'), crossfit: t('კროსფიტი', 'CrossFit'), cardio: t('კარდიო / გამძლეობა', 'Cardio / endurance'),
    mobility: t('მოქნილობა და მობილობა', 'Flexibility and mobility'), rehab: t('რეაბილიტაცია და ტრავმის შემდეგ', 'Rehab and post-injury'), boxing: t('ბოქსი / საბრძოლო', 'Boxing / combat sports'), yoga: t('იოგა / პილატესი', 'Yoga / Pilates'), women: t('ქალის ფიტნესი', 'Women’s fitness'),
    seniors: t('ხანდაზმულები', 'Older adults'), nutrition: t('კვების დაგეგმვა', 'Meal planning'), sport: t('სპორტული მომზადება', 'Sports conditioning'),
  }[k] || k;
  const verified = p.status === 'VERIFIED';
  return card({ class: 'co-public pad-lg' },
    h('div', { class: 'co-public-top' },
      avatarEl(p.displayName, null, 84, { verified }),
      h('div', { class: 'row-main' },
        h('h2', null, p.displayName),
        h('div', { class: 'hstack', style: { marginTop: '6px' } },
          badge(verified ? t('დადასტურებული ტრენერი', 'Verified trainer') : p.status === 'PENDING' ? t('განაცხადი განიხილება', 'Under review') : p.status === 'REJECTED' ? t('უარყოფილი', 'Rejected') : t('შეჩერებული', 'Suspended'), verified ? 'brand' : p.status === 'PENDING' ? 'warn' : 'neutral'),
          p.experienceYears ? badge(t(`${p.experienceYears} წლის გამოცდილება`, `${plural(p.experienceYears, 'year')} of experience`)) : null,
          p.instagram ? h('a', { class: 'link', href: `https://instagram.com/${encodeURIComponent(p.instagram)}`, target: '_blank', rel: 'noopener' }, `@${p.instagram}`) : null))),
    p.bio ? h('p', { class: 'co-bio' }, p.bio) : h('p', { class: 'faint' }, t('ბიოგრაფია ჯერ არ არის.', 'No bio yet.')),
    p.specialties.length ? h('div', { class: 'chips' }, p.specialties.map((k) => h('span', { class: 'chip co-chip-static' }, spec(k)))) : null,
    p.gyms.length ? h('div', { class: 'list' }, p.gyms.map((g) => h('div', { class: 'row' }, tile('mapPin', 'teal', 34),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, `${g.brand} · ${g.name}`), h('div', { class: 'row-sub' }, [g.city, g.address].filter(Boolean).join(', ')))))) : null);
}

function certificatesCard(p, onChanged) {
  if (!p.certificates.length) {
    return card(h('div', { class: 'stack' }, h('p', { class: 'muted' }, t('სერტიფიკატი ჯერ არ დაგიმატებია. ადმინი სერტიფიკატის ფოტოს ამოწმებს — კლიენტები მხოლოდ სათაურს, გამცემს და წელს ხედავენ.', 'You haven’t added a certificate yet. The MEDICARD team checks the certificate photo — clients see only the title, issuer and year.')),
      onChanged ? button(t('სერტიფიკატის დამატება', 'Add certificate'), { variant: 'secondary', icon: 'award', onClick: () => openCertificateForm(onChanged) }) : null));
  }
  return card(h('div', { class: 'list' }, p.certificates.map((c) => h('div', { class: 'row' }, tile('award', 'amber', 36),
    h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, c.title), h('div', { class: 'row-sub' }, [c.issuer, c.year].filter(Boolean).join(' · ') || '—')),
    h('div', { class: 'row-trail' },
      iconButton('eye', { title: t('ფაილის ნახვა', 'View file'), onClick: () => viewCertificate(c) }),
      onChanged ? iconButton('trash', { title: t('წაშლა', 'Delete'), onClick: async () => {
        if (!(await confirmDialog({ title: t('სერტიფიკატის წაშლა', 'Delete certificate'), body: t(`„${c.title}“ წაიშლება პროფილიდან.`, `“${c.title}” will be removed from your profile.`), confirm: t('წაშლა', 'Delete'), danger: true }))) return;
        try { await del(`/api/trainer/certificates/${encodeURIComponent(c.id)}`); toast(t('წაიშალა', 'Deleted')); onChanged(); } catch (e) { toast(e.message, 'error'); }
      } }) : null)))));
}

async function viewCertificate(c) {
  const img = h('img', { alt: c.title, class: 'co-cert-img' });
  const m = openModal({ title: c.title, size: 'lg', body: h('div', { class: 'co-cert-view' }, img) });
  const src = await authedBlobUrl(`/api/trainer/certificates/${encodeURIComponent(c.id)}/file`).catch(() => null);
  if (src) img.src = src;
  else mount(m.el.querySelector('.modal-body'), errorBox(new Error(t('ფაილი ვერ ჩაიტვირთა.', 'Couldn’t load the file.'))));
}

function openCertificateForm(onDone) {
  const title = input({ name: 'title', maxlength: 120, required: true, placeholder: t('მაგ. NASM Certified Personal Trainer', 'e.g. NASM Certified Personal Trainer') });
  const issuer = input({ name: 'issuer', maxlength: 120, placeholder: t('მაგ. NASM', 'e.g. NASM') });
  const year = input({ name: 'year', type: 'number', min: 1970, max: new Date().getFullYear(), placeholder: String(new Date().getFullYear()) });
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', class: 'co-file' });
  const preview = h('div', { class: 'co-file-preview' });
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    mount(preview, f ? [h('img', { src: URL.createObjectURL(f), alt: '' }), h('span', null, `${f.name} · ${Math.round(f.size / 1024)} KB`)] : null);
  });
  const err = h('div', { class: 'form-error', hidden: true });
  let btn;
  openModal({
    title: t('სერტიფიკატის დამატება', 'Add certificate'),
    size: 'md',
    body: h('div', { class: 'form' },
      field(t('სათაური', 'Title'), title),
      h('div', { class: 'form-row' }, field(t('გამცემი', 'Issuer'), issuer), field(t('წელი', 'Year'), year)),
      h('label', { class: 'dropzone co-drop' }, icon('upload', { size: 22 }), h('span', null, t('სერტიფიკატის ფოტო (JPEG, PNG, WEBP · 15 MB-მდე)', 'Certificate photo (JPEG, PNG, WEBP · up to 15 MB)')), file),
      preview,
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('ფოტო პრივატულია — მას მხოლოდ შენ და MEDICARD-ის ადმინისტრაცია ხედავთ. EXIF/GPS მონაცემები იშლება.', 'The photo is private — only you and the MEDICARD team can see it. EXIF/GPS data is removed.')),
      err),
    footer: (close) => {
      btn = button(t('ატვირთვა', 'Upload'), { icon: 'upload', onClick: async () => {
        err.hidden = true;
        if (title.value.trim().length < 2) { err.textContent = t('მიუთითე სერტიფიკატის სათაური.', 'Enter the certificate title.'); err.hidden = false; return; }
        const f = file.files?.[0];
        if (!f) { err.textContent = t('აირჩიე სერტიფიკატის ფოტო.', 'Choose a certificate photo.'); err.hidden = false; return; }
        if (f.size > 15 * 1024 * 1024) { err.textContent = t('ფაილი 15 MB-ზე დიდია.', 'The file is larger than 15 MB.'); err.hidden = false; return; }
        const fd = new FormData();
        fd.append('title', title.value.trim());
        fd.append('issuer', issuer.value.trim());
        if (year.value) fd.append('year', year.value);
        fd.append('file', f, f.name);
        await busy(btn, async () => {
          try {
            await post('/api/trainer/certificates', fd, { timeoutMs: 90_000 });
            toast(t('სერტიფიკატი დაემატა', 'Certificate added'));
            close();
            onDone?.();
          } catch (e) { err.textContent = e.message; err.hidden = false; }
        });
      } });
      return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), btn];
    },
  });
}

/** Edits the trainer application (POST /api/trainer/apply). A REJECTED profile is re-submitted for review. */
async function openProfileEditor(env, p, onSaved) {
  const catalog = await env.catalog();
  const specialties = catalog?.specialties || [];
  const st = { specialties: [...p.specialties], gyms: [...p.gyms] };
  const name = input({ value: p.displayName, maxlength: 60, required: true });
  const bio = textarea({ value: p.bio || '', maxlength: 800, rows: 4, placeholder: t('ვისთან მუშაობ, რა მიდგომა გაქვს, პირველი შეხვედრა… ფასი, თუ გინდა — თავისუფალი ტექსტით.', 'Who you work with, your approach, the first meeting… and your prices if you like — in your own words.') });
  const exp = input({ type: 'number', min: 0, max: 60, value: p.experienceYears ?? '', placeholder: t('მაგ. 5', 'e.g. 5') });
  const insta = input({ value: p.instagram ? `@${p.instagram}` : '', maxlength: 31, placeholder: '@username' });
  const specBox = h('div', { class: 'chips' });
  const gymSel = h('div', { class: 'chips' });
  const gymSearch = input({ type: 'search', placeholder: t('მოძებნე დარბაზი (მაგ. Oktopus, ვაკე)', 'Search for a gym (e.g. Oktopus, Vake)'), autocomplete: 'off' });
  const gymResults = h('div', { class: 'co-gym-results' });
  const paintSpec = () => mount(specBox, specialties.map((s) => {
    const on = st.specialties.includes(s.key);
    return h('button', { type: 'button', class: `chip ${on ? 'on' : ''}`, 'aria-pressed': on ? 'true' : 'false', onClick: () => {
      if (on) st.specialties = st.specialties.filter((k) => k !== s.key);
      else if (st.specialties.length < 6) st.specialties.push(s.key);
      else toast(t('მაქსიმუმ 6 სპეციალიზაცია', 'Up to 6 specialties'), 'info');
      paintSpec();
    } }, s.label);
  }));
  const paintGyms = () => mount(gymSel, st.gyms.length ? st.gyms.map((g) => h('span', { class: 'chip on co-chip-x' }, `${g.brand} · ${g.name}`,
    h('button', { type: 'button', 'aria-label': t(`${g.brand} ${g.name} — წაშლა`, `Remove ${g.brand} ${g.name}`), onClick: () => { st.gyms = st.gyms.filter((x) => x.id !== g.id); paintGyms(); } }, icon('x', { size: 13 }))))
    : h('span', { class: 'faint' }, t('დარბაზი არ არის არჩეული', 'No gym selected')));
  let seq = 0;
  const search = debounce(async () => {
    const my = ++seq;
    const q = gymSearch.value.trim();
    if (q.length < 2) { clear(gymResults); return; }
    try {
      const res = await get('/api/trainer/gyms', { q });
      if (my !== seq) return;
      const branches = (res.brands || []).flatMap((b) => b.branches).slice(0, 12);
      mount(gymResults, branches.length ? branches.map((g) => {
        const picked = st.gyms.some((x) => x.id === g.id);
        return h('button', { type: 'button', class: 'co-gym-row', disabled: picked, onClick: () => {
          if (st.gyms.length >= 5) { toast(t('მაქსიმუმ 5 დარბაზი', 'Up to 5 gyms'), 'info'); return; }
          st.gyms.push(g); paintGyms(); gymSearch.value = ''; clear(gymResults);
        } }, icon(picked ? 'check' : 'mapPin', { size: 15 }), h('span', null, h('b', null, `${g.brand} · ${g.name}`), h('small', null, [g.city, g.address].filter(Boolean).join(', '))));
      }) : h('div', { class: 'faint', style: { padding: '8px' } }, t('ვერ მოიძებნა. დარბაზის დამატება აპიდან შეგიძლია („ჩემი დარბაზი სიაში არ არის“).', 'Nothing found. You can add a gym from the app (“My gym isn’t on the list”).')));
    } catch { if (my === seq) mount(gymResults, h('div', { class: 'faint', style: { padding: '8px' } }, t('ძებნა ვერ მოხერხდა.', 'Search failed.'))); }
  }, 300);
  gymSearch.addEventListener('input', search);
  paintSpec();
  paintGyms();
  const err = h('div', { class: 'form-error', hidden: true });
  let btn;
  const resubmit = p.status === 'REJECTED';
  openModal({
    title: resubmit ? t('განაცხადის შესწორება', 'Edit application') : t('ტრენერის პროფილი', 'Trainer profile'),
    size: 'lg',
    body: h('div', { class: 'form' },
      h('div', { class: 'form-row' }, field(t('სახელი (ხედავენ კლიენტები)', 'Name (clients see this)'), name), field(t('გამოცდილება, წელი', 'Experience, years'), exp)),
      field(t('ჩემ შესახებ', 'About me'), bio, t('მაქს. 800 სიმბოლო. ფასები, თუ გინდა, თავისუფალი ტექსტით — აპში გადახდა არ ხდება.', 'Max. 800 characters. Prices in your own words if you like — there are no payments in the app.')),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t(`სპეციალიზაცია · ${st.specialties.length}/6`, `Specialties · ${st.specialties.length}/6`)), specBox),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('დარბაზები (მაქს. 5)', 'Gyms (max. 5)')), gymSel, gymSearch, gymResults),
      field(t('Instagram (არასავალდებულო)', 'Instagram (optional)'), insta),
      resubmit ? h('p', { class: 'co-note co-note-warn' }, t('შენახვის შემდეგ განაცხადი ხელახლა წავა განსახილველად.', 'After you save, your application goes back for review.')) : null,
      err),
    footer: (close) => {
      btn = button(resubmit ? t('ხელახლა გაგზავნა', 'Resubmit') : t('შენახვა', 'Save'), { icon: 'check', onClick: async () => {
        err.hidden = true;
        if (name.value.trim().length < 2) { err.textContent = t('სახელი ძალიან მოკლეა.', 'The name is too short.'); err.hidden = false; return; }
        if (!st.gyms.length) { err.textContent = t('აირჩიე მინიმუმ ერთი დარბაზი.', 'Choose at least one gym.'); err.hidden = false; return; }
        const ig = insta.value.trim().replace(/^@/, '');
        if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) { err.textContent = t('Instagram-ის სახელი არასწორია.', 'That Instagram username isn’t valid.'); err.hidden = false; return; }
        const years = exp.value === '' ? null : Number(exp.value);
        if (years != null && (!Number.isInteger(years) || years < 0 || years > 60)) { err.textContent = t('გამოცდილება 0–60 წელი.', 'Experience must be 0–60 years.'); err.hidden = false; return; }
        await busy(btn, async () => {
          try {
            await post('/api/trainer/apply', { displayName: name.value.trim(), bio: bio.value.trim(), specialties: st.specialties, experienceYears: years, instagram: ig, gymIds: st.gyms.map((g) => g.id) });
            toast(resubmit ? t('განაცხადი ხელახლა გაიგზავნა', 'Application resubmitted') : t('პროფილი განახლდა', 'Profile updated'));
            close();
            onSaved?.();
          } catch (e) { err.textContent = e.message; err.hidden = false; }
        });
      } });
      return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), btn];
    },
  });
}

function qrCard(p) {
  const qr = qrSvg(p.link, 208);
  return card({ class: 'spotlight hero-card co-qr' },
    qr ? h('div', { class: 'co-qr-box' }, qr) : null,
    h('div', { class: 'co-qr-code', 'aria-label': t(`კოდი ${p.code.split('').join(' ')}`, `Code ${p.code.split('').join(' ')}`) }, p.code),
    h('div', { class: 'co-qr-link' }, p.link),
    h('p', { class: 'muted', style: { textAlign: 'center' } }, t('კლიენტი QR-ს დაასკანერებს „ჩემი ტრენერი“-დან (ან ტელეფონის კამერით), ან კოდს შეიყვანს. რას გაგიზიაროს, თავად აირჩევს.', 'The client scans the QR from “My trainer” (or with their phone camera), or enters the code. They choose what to share with you.')),
    h('div', { class: 'co-qr-actions' },
      button(t('ბმულის კოპირება', 'Copy link'), { variant: 'light', size: 'sm', icon: 'link', onClick: () => copyText(p.link, t('ბმული დაკოპირდა', 'Link copied')) }),
      button(t('მოწვევის ტექსტი', 'Invite text'), { variant: 'light', size: 'sm', icon: 'copy', onClick: () => copyText(INVITE_TEXT(p.code), t('მოწვევის ტექსტი დაკოპირდა', 'Invite text copied')) }),
      qr ? button('QR (SVG)', { variant: 'light', size: 'sm', icon: 'download', onClick: () => downloadSvg(qrSvg(p.link, 600, true), `medicard-coach-${p.code}.svg`) }) : null));
}

/** Square-module QR (quiet zone 4) with teal finder eyes — plain enough for any camera. */
function qrSvg(text, size, forFile = false) {
  const m = qrMatrix(text);
  if (!m) return null;
  const n = m.length;
  const quiet = 4;
  const total = n + quiet * 2;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const x = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => x.setAttribute(k, String(v))); return x; };
  const svg = el('svg', { viewBox: `0 0 ${total} ${total}`, width: size, height: size, role: 'img', 'aria-label': t('QR კოდი', 'QR code'), 'shape-rendering': 'crispEdges' });
  if (forFile) svg.setAttribute('xmlns', NS);
  svg.appendChild(el('rect', { x: 0, y: 0, width: total, height: total, fill: '#ffffff', rx: forFile ? 0 : 2 }));
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c] && !inFinder(r, c)) d += `M${c + quiet},${r + quiet}h1v1h-1z`;
  svg.appendChild(el('path', { d, fill: '#0f1a1c' }));
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    svg.appendChild(el('path', { d: `M${c + quiet},${r + quiet}h7v7h-7zM${c + quiet + 1},${r + quiet + 1}v5h5v-5z`, fill: '#0f1a1c', 'fill-rule': 'evenodd' }));
    svg.appendChild(el('rect', { x: c + quiet + 2, y: r + quiet + 2, width: 3, height: 3, fill: '#0d9488' }));
  }
  return svg;
}

function downloadSvg(svg, filename) {
  if (!svg) return;
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ── Invite by a client's personal QR (the web cannot scan) ── */
function parsePersonToken(raw) {
  const s = String(raw || '').trim();
  const person = s.match(/\/u\/([A-Za-z0-9_-]{16,40})(?:[/?#]|$)/) || s.match(/^([A-Za-z0-9_-]{16,40})$/);
  if (person) return { token: person[1] };
  if (/\/c\/[A-Za-z0-9]{6}(?:[/?#]|$)/.test(s) || /^[A-Za-z0-9]{6}$/.test(s)) return { error: t('ეს ტრენერის კოდია. საჭიროა კლიენტის პირადი QR (აპში: პროფილი → ჩემი QR).', 'That’s a trainer code. You need the client’s personal QR (in the app: Profile → My QR).') };
  return { error: t('ეს MEDICARD-ის პროფილის QR კოდი არ არის. ჩასვი ბმული https://medicard.ge/u/… ან QR-ის ტექსტი.', 'That isn’t a MEDICARD profile QR code. Paste a https://medicard.ge/u/… link or the QR text.') };
}

function openInvite(env, opts = {}) {
  const inp = input({ placeholder: 'https://medicard.ge/u/…', autocomplete: 'off', spellcheck: 'false', 'aria-label': t('კლიენტის პირადი QR-ის ბმული', 'Client’s personal QR link') });
  const note = input({ maxlength: 300, placeholder: t('მაგ. დღეს დარბაზში რომ ვისაუბრეთ — ნინო', 'e.g. As we discussed at the gym today — Nino') });
  const err = h('div', { class: 'form-error', hidden: true });
  const result = h('div');
  let preview = null;
  let checkBtn;
  const showErr = (msg) => { err.textContent = msg; err.hidden = false; };

  const renderPreview = (close, sent) => {
    const p = preview;
    const status = sent || (p.link ? (p.link.status === 'ACTIVE' ? 'ACTIVE' : p.link.initiator === 'TRAINER' ? 'REQUESTED' : null) : null);
    const inviteBtn = button(p.link ? t('მოთხოვნის დადასტურება', 'Accept request') : t('კლიენტად მოწვევა', 'Invite as client'), { icon: 'userPlus' });
    inviteBtn.addEventListener('click', () => busy(inviteBtn, async () => {
      err.hidden = true;
      try {
        const r = await post(`${API}/invite`, { token: p.token, note: note.value.trim() });
        toast(r.status === 'ACTIVE' ? t(`${firstWord(p.user.name)} შემოგიერთდა`, `${firstWord(p.user.name)} joined you`) : t('მოწვევა გაიგზავნა', 'Invite sent'));
        renderPreview(close, r.status);
        opts.onDone?.(r);
      } catch (e) { showErr(e.message); }
    }));
    mount(result, card({ class: 'co-inv' },
      h('div', { class: 'hstack' }, avatarEl(p.user.name, p.user.avatarUrl, 56),
        h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, p.user.name), h('div', { class: 'card-sub' }, personLine(p.user) || t('MEDICARD მომხმარებელი', 'MEDICARD user')))),
      status === 'ACTIVE'
        ? h('div', { class: 'stack' }, h('div', { class: 'co-inline ok' }, icon('check', { size: 16 }), sent ? t('შემოგიერთდა — მისი მოთხოვნა დადასტურდა.', 'They’ve joined you — their request was accepted.') : t('უკვე შენი კლიენტია.', 'Already your client.')),
          button(t('კლიენტის გახსნა', 'Open client'), { onClick: () => { close(); env.ctx.navigate(`/coach/client/${p.user.id}`); } }))
        : status === 'REQUESTED'
          ? h('p', { class: 'muted' }, t(`მოწვევა გაიგზავნა. ${firstWord(p.user.name)} ნახავს შეტყობინებას და თავად აირჩევს, რას გაგიზიაროს.`, `Invite sent. ${firstWord(p.user.name)} will get a notification and choose what to share with you.`))
          : p.hasOtherTrainer
            ? h('p', { class: 'co-inline danger' }, icon('alert', { size: 16 }), t('ამ ადამიანს უკვე ჰყავს სხვა ტრენერი MEDICARD-ში.', 'This person already has another trainer on MEDICARD.'))
            : h('div', { class: 'stack' },
              h('p', { class: 'faint', style: { fontSize: '13px' } }, t('ჯანმრთელობის მონაცემი არ ჩანს, სანამ კლიენტი მოწვევას არ მიიღებს და არ აირჩევს, რას გაგიზიაროს.', 'No health data is visible until the client accepts the invite and chooses what to share with you.')),
              p.link ? null : field(t('შეტყობინება (არასავალდებულო)', 'Message (optional)'), note),
              h('div', null, inviteBtn))));
  };

  const check = async (close) => {
    err.hidden = true;
    clear(result);
    const parsed = parsePersonToken(inp.value);
    if (parsed.error) { showErr(parsed.error); return; }
    await busy(checkBtn, async () => {
      try {
        preview = await post(`${API}/scan`, { token: parsed.token });
        renderPreview(close);
      } catch (e) { showErr(e.message); }
    });
  };

  openModal({
    title: t('კლიენტის მოწვევა', 'Invite a client'),
    size: 'md',
    body: (close) => h('form', { class: 'form', novalidate: true, onSubmit: (e) => { e.preventDefault(); check(close); } },
      h('p', { class: 'muted' }, t('აპში ტრენერი კლიენტის QR-ს ასკანერებს. ვებზე სთხოვე კლიენტს, გამოგიგზავნოს თავისი პირადი QR-ის ბმული (აპში: პროფილი → ჩემი QR) და ჩასვი აქ.', 'In the app you scan the client’s QR. On the web, ask the client to send you their personal QR link (in the app: Profile → My QR) and paste it here.')),
      field(t('კლიენტის QR ბმული ან კოდის ტექსტი', 'Client QR link or code text'), inp, t('მაგ. https://medicard.ge/u/Ab12… — ეს არ არის ტრენერის 6-ნიშნა კოდი', 'e.g. https://medicard.ge/u/Ab12… — not the 6-character trainer code')),
      err,
      result,
      env.profile.code ? h('div', { class: 'co-inv-alt' }, icon('info', { size: 15 }), h('span', null, t(`ან პირიქით: გაუზიარე შენი კოდი ${env.profile.code} — კლიენტი თავად შემოგიერთდება.`, `Or the other way round: share your code ${env.profile.code} — the client joins you themselves.`)),
        h('button', { type: 'button', class: 'link', onClick: () => copyText(INVITE_TEXT(env.profile.code), t('მოწვევის ტექსტი დაკოპირდა', 'Invite text copied')) }, t('კოპირება', 'Copy'))) : null,
      h('button', { type: 'submit', hidden: true })),
    footer: (close) => {
      checkBtn = button(t('შემოწმება', 'Check'), { icon: 'search', onClick: () => check(close) });
      return [button(t('დახურვა', 'Close'), { variant: 'ghost', onClick: () => close() }), checkBtn];
    },
  });
}

/* ── Report (coachSafety, App Review 1.2) ─────────────── */
function openReport(env, client, onBlocked) {
  let reason = null;
  let block = false;
  const reasons = h('div', { class: 'chips' });
  const paint = () => mount(reasons, REPORT_REASONS.map(([k, l]) => h('button', { type: 'button', class: `chip ${reason === k ? 'on' : ''}`, 'aria-pressed': reason === k ? 'true' : 'false', onClick: () => { reason = k; paint(); } }, l)));
  paint();
  const details = textarea({ maxlength: 1000, rows: 3, placeholder: t('მოკლედ აღწერე', 'Describe it briefly') });
  const err = h('div', { class: 'form-error', hidden: true });
  let btn;
  openModal({
    title: t('შეტყობინება დარღვევაზე', 'Report a problem'),
    size: 'md',
    body: h('div', { class: 'form' },
      h('p', { class: 'muted' }, client.name),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('რა მოხდა?', 'What happened?')), reasons),
      field(t('დეტალები (არასავალდებულო)', 'Details (optional)'), details, t('არ ჩაწერო ჯანმრთელობის ან სხვისი პირადი მონაცემები.', 'Don’t include health data or anyone’s personal data.')),
      h('div', { class: 'between co-toggle-row' }, h('div', null, h('b', null, t('კავშირის დასრულება', 'End connection')), h('div', { class: 'faint', style: { fontSize: '12.5px' } }, t('კლიენტთან კავშირი მაშინვე შეწყდება.', 'Your connection with the client ends right away.'))), toggle(block, (v) => { block = v; })),
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('შეტყობინებას MEDICARD-ის გუნდი განიხილავს.', 'The MEDICARD team will review your report.')),
      err),
    footer: (close) => {
      btn = button(t('გაგზავნა', 'Send'), { icon: 'send', onClick: async () => {
        err.hidden = true;
        if (!reason) { err.textContent = t('აირჩიე მიზეზი.', 'Choose a reason.'); err.hidden = false; return; }
        await busy(btn, async () => {
          try {
            await post('/api/trainer/report', { subjectId: client.id, reason, details: details.value.trim(), block });
            toast(block ? t('შეტყობინება მივიღეთ და კავშირი შეწყდა', 'Report received and the connection has ended') : t('შეტყობინება მივიღეთ. MEDICARD-ის გუნდი განიხილავს.', 'Report received. The MEDICARD team will review it.'));
            close();
            if (block) onBlocked?.();
          } catch (e) { err.textContent = e.message; err.hidden = false; }
        });
      } });
      return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), btn];
    },
  });
}
