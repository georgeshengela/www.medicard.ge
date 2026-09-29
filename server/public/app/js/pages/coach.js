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

const CSS = '/app/css/coach.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

const APP_STORE = 'https://apps.apple.com/app/id6812517519';
const SUPPORT_EMAIL = 'support@medicard.ge';
const API = '/api/trainer/coach';

/* ── Copy (mobile/src/lib/coach.ts) ───────────────────── */
const SESSION_STATUS = { OPEN: 'თავისუფალი', SCHEDULED: 'დაგეგმილი', CANCELLED: 'გაუქმდა', DONE: 'ჩატარდა', NO_SHOW: 'არ მოვიდა' };
const DAY_STATUS = { ON: 'გეგმაში', OVER: 'გადააჭარბა', UNDER: 'ცოტა ჭამა', LOW_PROTEIN: 'ცილა აკლდა', PENDING: 'მიმდინარე', NONE: 'არ ჩაწერა' };
const DAY_COLOR = { ON: 'var(--ok)', OVER: 'var(--danger)', UNDER: 'var(--warn)', LOW_PROTEIN: 'var(--warn)', PENDING: 'var(--brand-2)', NONE: 'var(--bg3)' };
const GOAL_TYPE = { lose: 'წონის კლება', gain: 'წონის მატება', recomp: 'რეკომპოზიცია', performance: 'ფორმა და ძალა' };
const POSE = { FRONT: 'წინიდან', SIDE: 'გვერდიდან', BACK: 'ზურგიდან', OTHER: 'სხვა' };
const SCOPES = ['workouts', 'nutrition', 'weight', 'photos'];
const SCOPE_COPY = {
  workouts: { title: 'ვარჯიშები და აქტივობა', short: 'ვარჯიში', icon: 'activity', body: 'ნაბიჯები, აქტიური წუთები, პულსი, ძილი და ვარჯიშები Apple Health / Health Connect-იდან.' },
  nutrition: { title: 'კვება', short: 'კვება', icon: 'utensils', body: 'კვების დღიური, კალორიები, მაკროები და შენი გეგმის დაცვა.' },
  weight: { title: 'წონა და მიზანი', short: 'წონა', icon: 'scale', body: 'აწონვები, წონის მიზანი და პროგრესი.' },
  photos: { title: 'პროგრეს-ფოტოები', short: 'ფოტოები', icon: 'camera', body: '„მანამდე / შემდეგ“ ფოტოები. კლიენტთან ნაგულისხმევად გამორთულია.' },
};
const KIND_FALLBACK = { STRENGTH: 'ძალოვანი', CARDIO: 'კარდიო', HIIT: 'HIIT', FUNCTIONAL: 'ფუნქციური', MOBILITY: 'მობილობა', ASSESSMENT: 'შეფასება / გაზომვა', ONLINE: 'ონლაინ' };
const WORKOUT_KIND = {
  traditionalStrengthTraining: 'ძალოვანი ვარჯიში', functionalStrengthTraining: 'ფუნქციური ვარჯიში', highIntensityIntervalTraining: 'HIIT',
  running: 'სირბილი', walking: 'სიარული', cycling: 'ველოსიპედი', swimming: 'ცურვა', yoga: 'იოგა', pilates: 'პილატესი', boxing: 'ბოქსი',
  crossTraining: 'კროს-ტრენინგი', elliptical: 'ელიფსური', rowing: 'ნიჩბოსნობა', coreTraining: 'კორი', flexibility: 'მოქნილობა',
  mixedCardio: 'კარდიო', stairClimbing: 'კიბეები', other: 'ვარჯიში',
};
const workoutKind = (k) => WORKOUT_KIND[k] || WORKOUT_KIND[String(k || '').replace(/^EXERCISE_TYPE_/, '').toLowerCase()] || 'ვარჯიში';
const REPORT_REASONS = [
  ['harassment', 'შეურაცხყოფა ან შევიწროება'], ['inappropriate', 'შეუფერებელი შინაარსი ან ფოტო'], ['unsafe', 'სახიფათო ან არაპროფესიული რჩევა'],
  ['spam', 'სპამი ან რეკლამა'], ['impersonation', 'ყალბი პროფილი ან სერტიფიკატი'], ['other', 'სხვა'],
];
const MEAL_SLOTS = [
  { key: 'breakfast', label: 'საუზმე', time: '08:30' }, { key: 'snack1', label: 'წახემსება', time: '11:30' }, { key: 'lunch', label: 'სადილი', time: '14:00' },
  { key: 'preworkout', label: 'ვარჯიშამდე', time: '17:30' }, { key: 'postworkout', label: 'ვარჯიშის შემდეგ', time: '20:00' },
  { key: 'snack2', label: 'მეორე წახემსება', time: '17:00' }, { key: 'dinner', label: 'ვახშამი', time: '20:30' },
];
const QUICK_EX = ['ბექ სქვოთი', 'ჟიმი წოლით', 'მკვდარი წევა', 'ჟიმი ზემოთ', 'აზიდვა', 'ლანჯი', 'რუმინული წევა', 'ქვედა ბლოკი', 'პლანკა', 'კარდიო'];
const DURATIONS = [30, 45, 60, 75, 90, 120];
const INVITE_TEXT = (code) => `ვარჯიშები, კვების გეგმა და პროგრესი ერთად — MEDICARD-ში. შემომიერთდი ჩემი კოდით ${code}: https://medicard.ge/c/${code}`;

/* ── Small helpers ────────────────────────────────────── */
const firstWord = (s) => String(s || '').trim().split(/\s+/)[0] || '';
const genderKa = (g) => (g === 'FEMALE' ? 'ქალი' : g === 'MALE' ? 'კაცი' : null);
const personLine = (p) => [p.age ? `${p.age} წ.` : null, genderKa(p.gender), p.heightCm ? `${p.heightCm} სმ` : null].filter(Boolean).join(' · ');
const localYmd = (iso) => ymd(new Date(iso));
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const mondayOf = (d) => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const kindLabel = (s, catalog) => s.kindLabel || catalog?.sessionKinds?.find((k) => k.key === s.kind)?.label || KIND_FALLBACK[s.kind] || s.kind;
const shortDay = (v) => { const d = parseDate(v); return `${KA_DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${KA_MONTHS_SHORT[d.getMonth()]}`; };
const longDay = (v) => { const d = parseDate(v); return `${KA_DAYS[d.getDay()]}, ${d.getDate()} ${KA_MONTHS[d.getMonth()]}`; };
function dayWithRel(v) {
  const r = relDay(v);
  return ['დღეს', 'გუშინ', 'ხვალ'].includes(r) ? `${r}, ${fmtDate(v)}` : shortDay(v);
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
  return h('span', { class: 'co-av-wrap' }, el, h('span', { class: 'co-av-check', title: 'დადასტურებული ტრენერი' }, icon('check', { size: Math.max(10, Math.round(size * 0.16)), stroke: 3 })));
}
function timing(startsAt, durationMin, now = Date.now()) {
  const start = new Date(startsAt).getTime();
  const end = start + durationMin * 60000;
  if (now >= start && now < end) return { phase: 'live', text: `მიმდინარეობს · ${Math.max(1, Math.round((end - now) / 60000))} წთ დარჩა` };
  if (now >= end) return { phase: 'past', text: 'დასრულდა' };
  const min = Math.round((start - now) / 60000);
  if (min < 60) return { phase: 'soon', text: `${Math.max(1, min)} წუთში` };
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  if (hh >= 24) return { phase: 'soon', text: dayWithRel(startsAt) };
  return { phase: 'soon', text: mm && hh < 5 ? `${hh} სთ ${mm} წთ-ში` : `${hh} საათში` };
}
function relStart(iso) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'მიმდინარეობს';
  if (mins < 60) return `${mins} წუთში`;
  if (mins < 6 * 60) return `${Math.round(mins / 60)} საათში`;
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
  if (s.status === 'SCHEDULED' && past && s.clientId) return badge('ჩასაწერი', 'warn');
  if (s.status === 'SCHEDULED') return badge(s.clientConfirmedAt ? 'დადასტურდა' : 'დასტურს ელოდება', s.clientConfirmedAt ? 'ok' : 'neutral');
  if (s.status === 'CANCELLED') return badge(s.lateCancel ? 'გვიან გაუქმდა' : SESSION_STATUS.CANCELLED, s.lateCancel ? 'warn' : 'neutral');
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
async function copyText(text, what = 'დაკოპირდა') {
  try {
    await navigator.clipboard.writeText(text);
    toast(what);
  } catch {
    toast('ვერ დაკოპირდა — მონიშნე და დააკოპირე ხელით.', 'info');
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
  const t = Math.max(0, Math.min(1, (Date.parse(ymdStr) - Date.parse(goal.startedYmd)) / span));
  return Math.round((goal.startKg + (goal.targetKg - goal.startKg) * t) * 10) / 10;
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
    const body = frame(env, { active: null, title: 'ტრენერის სივრცე' });
    mount(body, empty('გვერდი ვერ მოიძებნა', 'ეს მისამართი ტრენერის სივრცეში არ არსებობს.', button('დღევანდელ დღეზე', { href: '/coach' })));
  } else {
    await view();
  }
  return () => cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

/* ── Workspace frame: workspace bar + page head ───────── */
const TABS = [
  { key: 'today', href: '/coach', label: 'დღეს', icon: 'home' },
  { key: 'calendar', href: '/coach/calendar', label: 'კალენდარი', icon: 'calendar' },
  { key: 'clients', href: '/coach/clients', label: 'კლიენტები', icon: 'users' },
  { key: 'profile', href: '/coach/profile', label: 'პროფილი', icon: 'user' },
];
function frame(env, { active, title, sub, actions = [], back }) {
  const body = h('div', { class: 'co-body' });
  mount(env.root, h('div', { class: 'co' },
    h('div', { class: 'co-bar' },
      h('span', { class: 'co-bar-mode' }, icon('dumbbell', { size: 15 }), 'ტრენერის სივრცე'),
      h('nav', { class: 'co-nav', 'aria-label': 'ტრენერის სივრცე' }, TABS.map((t) => h('a', {
        href: t.href, 'data-link': '', class: `co-nav-item ${t.key === active ? 'on' : ''}`, 'aria-current': t.key === active ? 'page' : undefined,
      }, icon(t.icon, { size: 17 }), h('span', null, t.label))))),
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
      pageHead('ტრენერის სივრცე', 'MEDI COACH — ვერიფიცირებული ფიტნეს ტრენერებისთვის'),
      card({ class: 'pad-lg co-gate' },
        tile('dumbbell', 'teal', 52),
        h('h2', null, 'ტრენერის პროფილი არ გაქვს'),
        h('p', { class: 'muted' }, 'ტრენერის სივრცე მხოლოდ დადასტურებული ტრენერებისთვისაა. განაცხადი MEDICARD აპში შეიტანება: პროფილი → „ტრენერი ხარ?“ — საჭიროა დადასტურებული ტელეფონი, 18+ ასაკი, დარბაზი და სერტიფიკატი. ადმინისტრაციის დადასტურების შემდეგ აქედანაც იმუშავებ.'),
        h('div', { class: 'hstack' },
          button('ამისთვის გამოიყენე MEDICARD აპი', { icon: 'smartphone', href: APP_STORE, external: true }),
          button('ჩემი ტრენერი (კლიენტის მხარე)', { variant: 'ghost', href: '/trainer' })))));
    return;
  }
  const checks = [
    { ok: Boolean(p.displayName), label: 'სახელი, რომელსაც კლიენტები დაინახავენ' },
    { ok: (p.bio || '').trim().length >= 20, label: 'მოკლე ბიოგრაფია (მინ. 20 სიმბოლო)' },
    { ok: p.specialties.length > 0, label: 'სპეციალიზაცია' },
    { ok: p.gyms.length > 0, label: 'დარბაზი, სადაც ვარჯიშობ' },
    { ok: p.certificates.length > 0, label: 'სერტიფიკატის ფოტო — ადმინი მას ამოწმებს' },
    { ok: p.experienceYears != null, label: 'გამოცდილება (წლები)' },
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
    PENDING: { ink: 'amber', icon: 'clock', title: 'განაცხადი განიხილება', body: `გამოგზავნილია ${p.submittedAt ? fmtDate(p.submittedAt, { year: true }) : ''}. MEDICARD-ის გუნდი ამოწმებს სერტიფიკატს, ტელეფონს და პროფილს. დადასტურებისთანავე აქ გაიხსნება კალენდარი, კლიენტები და მოწვევა.` },
    REJECTED: { ink: 'rose', icon: 'alert', title: 'განაცხადს დაზუსტება სჭირდება', body: 'ქვემოთ ნახე ადმინისტრაციის კომენტარი, შეასწორე პროფილი და გაგზავნე ხელახლა — სტატუსი ისევ „განიხილება“ გახდება.' },
    SUSPENDED: { ink: 'neutral', icon: 'lock', title: 'ტრენერის პროფილი შეჩერებულია', body: `კლიენტებთან კავშირები დასრულდა და მომავალი ვარჯიშები გაუქმდა. დეტალებისთვის მოგვწერე: ${SUPPORT_EMAIL}.` },
  }[p.status] || { ink: 'neutral', icon: 'info', title: 'ტრენერის პროფილი არ არის აქტიური', body: '' };
  const canEdit = p.status === 'PENDING' || p.status === 'REJECTED';
  mount(root, h('div', { class: 'co' },
    pageHead('ტრენერის სივრცე', p.displayName),
    h('div', { class: 'grid grid-main' },
      h('div', { class: 'stack', style: { gap: '16px' } },
        card({ class: 'pad-lg co-gate' },
          tile(head.icon, head.ink, 52),
          h('div', { class: 'hstack' }, h('h2', null, head.title), badge({ PENDING: 'განიხილება', REJECTED: 'უარყოფილი', SUSPENDED: 'შეჩერებული' }[p.status] || p.status, p.status === 'PENDING' ? 'warn' : p.status === 'REJECTED' ? 'danger' : 'neutral')),
          h('p', { class: 'muted' }, head.body),
          p.status === 'REJECTED' && p.reviewNote ? h('div', { class: 'co-note co-note-warn' }, h('b', null, 'ადმინისტრაციის კომენტარი'), h('p', null, p.reviewNote)) : null,
          canEdit ? h('div', { class: 'hstack' },
            button(p.status === 'REJECTED' ? 'შესწორება და ხელახლა გაგზავნა' : 'განაცხადის რედაქტირება', { icon: 'edit', onClick: edit }),
            button('სერტიფიკატის დამატება', { variant: 'ghost', icon: 'award', onClick: addCert })) : button(`მოგვწერე: ${SUPPORT_EMAIL}`, { variant: 'ghost', icon: 'mail', href: `mailto:${SUPPORT_EMAIL}`, external: true })),
        canEdit ? section('განაცხადის შემოწმება', card(
          h('div', { class: 'co-checks' }, checks.map((c) => h('div', { class: `co-check ${c.ok ? 'ok' : ''}` }, icon(c.ok ? 'check' : 'x', { size: 16, stroke: 2.6 }), h('span', null, c.label)))),
          missing.length
            ? h('p', { class: 'faint', style: { marginTop: '12px', fontSize: '13px' } }, `რა აკლია: ${missing.map((m) => m.label.split(' — ')[0].toLowerCase()).join(', ')}. სრული პროფილი უფრო სწრაფად მოწმდება.`)
            : h('p', { class: 'faint', style: { marginTop: '12px', fontSize: '13px' } }, 'ყველაფერი შევსებულია — დაელოდე დადასტურებას.'))) : null),
      h('div', { class: 'stack', style: { gap: '16px' } },
        section('ასე გხედავენ კლიენტები', publicCard(p)),
        p.certificates.length ? section('სერტიფიკატები', certificatesCard(p, canEdit ? reload : null)) : null))));
}

/* ── Dashboard („დღეს“) ───────────────────────────────── */
async function pageToday(env) {
  const { profile } = env;
  const openNew = (preset = {}) => openNewSession(env, { ...preset, onDone: () => reload() });
  const body = frame(env, {
    active: 'today',
    title: `გამარჯობა, ${firstWord(profile.displayName)}`,
    sub: longDay(new Date()),
    actions: [
      button('კლიენტის მოწვევა', { variant: 'secondary', icon: 'userPlus', onClick: () => openInvite(env, { onDone: () => reload() }) }),
      button('ვარჯიშის დანიშვნა', { icon: 'plus', onClick: () => openNew() }),
    ],
  });
  mount(body, h('div', { class: 'stats-row' }, [0, 1, 2, 3].map(() => skeleton(2))), h('div', { class: 'grid grid-main', style: { marginTop: '24px' } }, skeleton(7), skeleton(5)));

  let data = null;
  let week = [];
  const liveNext = h('div');
  const liveTimeline = h('div');

  const answer = async (btn, linkId, accept, name) => {
    if (!accept && !(await confirmDialog({ title: 'მოთხოვნის უარყოფა', body: `${name}-ს მოთხოვნა უარყოფილი იქნება.`, confirm: 'უარყოფა', danger: true }))) return;
    await busy(btn, async () => {
      try {
        await post(`${API}/requests/${encodeURIComponent(linkId)}`, { accept });
        toast(accept ? `${firstWord(name)} ახლა შენი კლიენტია` : 'მოთხოვნა უარყოფილია');
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
            h('div', { class: 'card-title' }, booked.length ? `${booked.length} ვარჯიში დღეს` : 'დღეს მხოლოდ თავისუფალი სლოტებია'),
            h('div', { class: 'card-sub', style: toLog.length ? { color: 'var(--warn)' } : null }, toLog.length ? `${toLog.length} ჩასაწერია — მონიშნე, ჩატარდა თუ არა` : done ? `${done} უკვე ჩატარდა` : 'ყველაფერი წინ არის'))),
        timeline(todays, now))
      : card({ class: 'co-empty-card' },
        tile('calendar', 'teal', 48),
        h('div', { class: 'card-title' }, 'დღეს ვარჯიში არ გაქვს'),
        h('p', { class: 'muted' }, 'დანიშნე კლიენტთან ან გახსენი თავისუფალი სლოტი — კლიენტი თავად დაჯავშნის.'),
        button('ვარჯიშის დანიშვნა', { icon: 'plus', onClick: () => openNew({ date: ymd() }) })));
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
        card(stat('აქტიური კლიენტი', fmtNum(st.clients), { icon: 'users', delta: st.requests ? `${st.requests} ახალი მოთხოვნა` : null, deltaTone: 'up' })),
        card(stat('ვარჯიში 7 დღეში', fmtNum(st.weekSessions), { icon: 'calendar' })),
        card(stat('ჩატარდა', fmtNum(st.done30), { icon: 'calendarCheck', delta: 'ბოლო 30 დღე' })),
        card(stat('დასწრება', attended ? `${Math.round((st.done30 / attended) * 100)}%` : '—', { icon: 'target', delta: attended ? `${st.noShow30} გამოცდენა` : 'ჯერ მონაცემი არ არის', deltaTone: st.noShow30 ? 'down' : '' }))),
      h('div', { class: 'grid grid-main', style: { marginTop: '28px' } },
        h('div', null,
          section('შემდეგი ვარჯიში', liveNext),
          section('დღის განრიგი', liveTimeline, { link: { href: '/coach/calendar', label: 'კალენდარი' } }),
          section('მომავალი 7 დღე', card(
            barChart({
              labels: upcoming7.map((k) => KA_DAYS_SHORT[parseDate(k).getDay()]),
              tipLabels: upcoming7.map((k) => dayWithRel(k)),
              stacked: [{ name: 'კლიენტთან', values: bookedSeries, color: 'var(--c1)' }, { name: 'თავისუფალი სლოტი', values: openSeries, color: 'var(--bg3)' }],
              height: 170,
            }),
            h('div', { class: 'legend', style: { marginTop: '10px' } }, h('span', null, h('i', { style: { background: 'var(--c1)' } }), 'კლიენტთან'), h('span', null, h('i', { style: { background: 'var(--bg3)' } }), 'თავისუფალი სლოტი')),
            upcomingList.length ? h('div', { class: 'list', style: { marginTop: '10px' } }, upcomingList.map((s) => sessionRow(s))) : null))),
        h('div', null,
          data.requests.length ? section(`ახალი მოთხოვნები · ${data.requests.length}`, h('div', { class: 'stack' }, data.requests.map((r) => requestCard(r, answer)))) : null,
          section('ყურადღება', card({ class: 'co-alerts' }, data.alerts.length
            ? h('div', { class: 'list' }, data.alerts.slice(0, 10).map((a) => h('a', { class: 'row row-link', href: `/coach/client/${a.clientId}`, 'data-link': '' },
              tile(a.tone === 'warn' ? 'alert' : a.tone === 'good' ? 'sparkles' : 'info', a.tone === 'warn' ? 'amber' : a.tone === 'good' ? 'green' : 'neutral', 34),
              h('div', { class: 'row-main' }, h('div', { class: 'row-title co-wrap' }, a.text)),
              icon('chevronRight', { size: 16, className: 'row-chev' }))))
            : h('div', { class: 'hstack' }, tile('sparkles', 'green', 38), h('p', { class: 'muted', style: { flex: 1 } }, st.clients
              ? 'ყველაფერი რიგზეა — ახალი სიგნალი არ არის.'
              : 'როცა კლიენტები შემოგიერთდებიან, აქ დაინახავ, ვინ გადაუხვია კვებას, ვინ არ აწონილა ან ვინ გამოტოვა ვარჯიში.'))),
          { link: data.alerts.length ? { href: '/coach/clients', label: 'ყველა კლიენტი' } : null }),
          !st.clients && profile.code ? section('პირველი კლიენტი', card(
            h('div', { class: 'hstack', style: { alignItems: 'flex-start' } }, tile('userPlus', 'teal'),
              h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, `შენი კოდი: ${profile.code}`),
                h('p', { class: 'card-sub' }, 'გაუზიარე კოდი ან ბმული — კლიენტი თავად აირჩევს, რას გაგიზიაროს. ან ჩასვი კლიენტის პირადი QR-ის ბმული.'))),
            h('div', { class: 'hstack', style: { marginTop: '14px' } },
              button('კლიენტის QR ბმული', { icon: 'scanLine', onClick: () => openInvite(env, { onDone: () => reload() }) }),
              button('ტექსტის კოპირება', { variant: 'ghost', icon: 'copy', onClick: () => copyText(INVITE_TEXT(profile.code), 'მოწვევის ტექსტი დაკოპირდა') })))) : null)));
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
          h('div', { class: 'card-title' }, toLog ? 'დღის ვარჯიშები დასრულდა' : 'დაგეგმილი ვარჯიში არ გაქვს'),
          h('div', { class: 'card-sub' }, toLog ? `ჩაწერე შედეგები — ${toLog} ვარჯიში ელოდება` : 'დანიშნე შემდეგი ვარჯიში ან გახსენი სლოტი')),
        button('დანიშვნა', { variant: 'light', size: 'sm', icon: 'plus', onClick: onBook })));
  }
  const t = timing(s.startsAt, s.durationMin, now);
  const live = t.phase === 'live';
  const progress = live ? Math.min(1, (now - new Date(s.startsAt).getTime()) / (s.durationMin * 60000)) : 0;
  return h('a', { class: 'card spotlight hero-card co-next hover', href: `/coach/session/${s.id}`, 'data-link': '' },
    h('div', { class: 'between' },
      h('span', { class: `co-live-pill ${live ? 'on' : ''}` }, live ? 'ახლა მიმდინარეობს' : 'შემდეგი ვარჯიში'),
      h('span', { class: 'co-next-when' }, t.text)),
    h('div', { class: 'co-next-main' },
      h('div', { class: 'co-next-time' }, h('strong', null, fmtTime(s.startsAt)), h('span', null, `${dayWithRel(s.startsAt)} · ${s.durationMin} წთ`)),
      h('span', { class: 'co-next-sep' }),
      avatarEl(s.clientName, s.clientAvatarUrl, 48),
      h('div', { class: 'row-main' }, h('div', { class: 'co-next-name' }, s.clientName), h('div', { class: 'muted' }, s.kindLabel))),
    live ? h('div', { class: 'co-next-progress' }, h('span', { style: { width: `${Math.round(progress * 100)}%` } })) : null,
    h('div', { class: 'hstack co-next-meta' },
      s.gym ? h('span', null, icon('mapPin', { size: 14 }), `${s.gym.brand} · ${s.gym.name}`) : null,
      h('span', { class: s.clientConfirmedAt ? 'ok' : '' }, icon(s.clientConfirmedAt ? 'check' : 'clock', { size: 14 }), s.clientConfirmedAt ? 'კლიენტმა დაადასტურა' : 'დასტურს ელოდება')));
}

function timeline(sessions, now) {
  const wrap = h('div', { class: 'co-tl' });
  const nowIdx = sessions.findIndex((s) => new Date(s.startsAt).getTime() > now);
  const nowLine = () => h('div', { class: 'co-tl-now', 'aria-label': `ახლა ${fmtTime(new Date(now))}` }, h('span', null, fmtTime(new Date(now))), h('i'));
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
        h('div', { class: 'row-title' }, s.clientName || 'თავისუფალი სლოტი'),
        h('div', { class: 'row-sub' }, [`${s.durationMin} წთ`, s.kindLabel, s.gym?.brand].filter(Boolean).join(' · '))),
      sessionPill(s, now)));
  });
  if (nowIdx === -1 && sessions.length) wrap.appendChild(nowLine());
  return wrap;
}

function sessionRow(s, opts = {}) {
  return h('a', { class: 'row row-link co-srow', href: `/coach/session/${s.id}`, 'data-link': '' },
    h('span', { class: 'co-date' }, h('strong', null, parseDate(s.startsAt).getDate()), h('span', null, KA_MONTHS_SHORT[parseDate(s.startsAt).getMonth()])),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, opts.hideName ? `${KA_DAYS[parseDate(s.startsAt).getDay()]} · ${fmtTime(s.startsAt)}` : `${fmtTime(s.startsAt)} · ${s.clientName || 'თავისუფალი სლოტი'}`),
      h('div', { class: 'row-sub' }, [s.kindLabel, `${s.durationMin} წთ`, s.gym ? `${s.gym.brand}` : null].filter(Boolean).join(' · '))),
    sessionPill(s));
}

function requestCard(r, answer) {
  const accept = button('მიღება', { icon: 'check', size: 'sm' });
  const decline = button('უარი', { variant: 'ghost', icon: 'x', size: 'sm' });
  accept.addEventListener('click', () => answer(accept, r.linkId, true, r.name));
  decline.addEventListener('click', () => answer(decline, r.linkId, false, r.name));
  const shared = SCOPES.filter((k) => r.scopes?.[k]);
  return card({ class: 'co-req' },
    h('div', { class: 'hstack' }, avatarEl(r.name, r.avatarUrl, 46),
      h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, r.name), h('div', { class: 'card-sub' }, personLine(r) || 'ახალი კლიენტი')),
      badge('გთხოვს ტრენერობას', 'brand')),
    r.note ? h('div', { class: 'co-quote' }, `„${r.note}“`) : null,
    h('div', { class: 'co-scope-chips' }, shared.length
      ? [h('span', { class: 'faint' }, 'გაგიზიარებს:'), shared.map((k) => h('span', { class: 'co-scope on' }, icon(SCOPE_COPY[k].icon, { size: 13 }), SCOPE_COPY[k].short))]
      : h('span', { class: 'faint' }, 'მხოლოდ ვარჯიშების განრიგი — სხვა მონაცემს ჯერ არ აზიარებს')),
    h('div', { class: 'hstack' }, accept, decline));
}

/* ── Clients ──────────────────────────────────────────── */
async function pageClients(env, opts = {}) {
  const { profile } = env;
  let reloadFn = null;
  const body = frame(env, {
    active: 'clients',
    title: 'კლიენტები',
    sub: 'ყველა კლიენტი ერთ ეკრანზე — კვების დაცვა, წონა და შემდეგი ვარჯიში',
    actions: [
      profile.code ? button('კოდის კოპირება', { variant: 'ghost', icon: 'copy', onClick: () => copyText(INVITE_TEXT(profile.code), 'მოწვევის ტექსტი დაკოპირდა') }) : null,
      button('კლიენტის მოწვევა', { icon: 'userPlus', onClick: () => openInvite(env, { onDone: () => reloadFn?.() }) }),
    ].filter(Boolean),
  });
  mount(body, skeleton(3), skeleton(6));
  const state = { data: null, filter: 'all', q: '' };
  const listBox = h('div');

  const answer = async (btn, linkId, accept, name) => {
    if (!accept && !(await confirmDialog({ title: 'მოთხოვნის უარყოფა', body: `${name}-ს მოთხოვნა უარყოფილი იქნება.`, confirm: 'უარყოფა', danger: true }))) return;
    await busy(btn, async () => {
      try {
        await post(`${API}/requests/${encodeURIComponent(linkId)}`, { accept });
        toast(accept ? `${firstWord(name)} ახლა შენი კლიენტია` : 'მოთხოვნა უარყოფილია');
        await reload();
      } catch (e) { toast(e.message, 'error'); }
    });
  };
  const cancelInvite = async (r) => {
    if (!(await confirmDialog({ title: 'მოწვევის გაუქმება', body: `${r.name} მოწვევას ვეღარ მიიღებს.`, confirm: 'გაუქმება', danger: true }))) return;
    try {
      await del(`${API}/invites/${encodeURIComponent(r.id)}`);
      toast('მოწვევა გაუქმდა');
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
              h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, r.name), h('div', { class: 'card-sub' }, `მოწვეულია ${fmtDate(r.createdAt)} · დასტურს ელოდება`)),
              iconButton('x', { title: `${r.name}-ის მოწვევის გაუქმება`, onClick: () => cancelInvite(r) })),
            h('p', { class: 'faint', style: { fontSize: '13px' } }, 'არაფერი ზიარდება, სანამ კლიენტი მოწვევას არ მიიღებს და თავად არ აირჩევს, რას გაგიზიაროს.'))))
        : card(empty('მოლოდინში არავინაა', 'როცა კლიენტი მოგწერს ან შენს მოწვევას ჯერ არ უპასუხებს, აქ გამოჩნდება.')));
      return;
    }
    const base = state.filter === 'attention' ? attention : clients;
    const needle = state.q.trim().toLowerCase();
    const shown = needle ? base.filter((c) => c.name.toLowerCase().includes(needle)) : base;
    if (!shown.length) {
      mount(listBox, card(clients.length
        ? empty(state.filter === 'attention' && !needle ? 'ყურადღება არავის სჭირდება' : 'ვერ მოიძებნა', state.filter === 'attention' && !needle ? 'ყველა კლიენტი გეგმაშია — კარგი ნამუშევარია.' : 'სცადე სხვა სახელი.')
        : empty('კლიენტები ჯერ არ გყავს', 'სთხოვე კლიენტს, გამოგიგზავნოს თავისი პირადი QR-ის ბმული (აპში: პროფილი → ჩემი QR), ან გაუზიარე შენი კოდი.',
          h('div', { class: 'hstack', style: { justifyContent: 'center' } },
            button('კლიენტის მოწვევა', { icon: 'userPlus', onClick: () => openInvite(env, { onDone: () => reload() }) }),
            profile.code ? button(`კოდი · ${profile.code}`, { variant: 'ghost', icon: 'copy', onClick: () => copyText(INVITE_TEXT(profile.code), 'მოწვევის ტექსტი დაკოპირდა') }) : null))));
      return;
    }
    mount(listBox, card({ class: 'flush co-roster' },
      h('div', { class: 'co-roster-head', 'aria-hidden': 'true' },
        h('span', null, 'კლიენტი'), h('span', null, 'კვება · 7 დღე'), h('span', null, 'დღეს'), h('span', null, 'წონა → მიზანი'), h('span', null, 'შემდეგი ვარჯიში')),
      shown.map((c) => rosterRow(c))));
  };

  const render = () => {
    const { clients, requests, invited } = state.data;
    const attention = clients.filter((c) => c.alerts.some((a) => a.tone === 'warn')).length;
    const waiting = requests.length + invited.length;
    const search = input({ type: 'search', placeholder: 'სახელით ძებნა', value: state.q, 'aria-label': 'კლიენტის ძებნა', class: 'input co-search' });
    search.addEventListener('input', debounce(() => { state.q = search.value; renderList(); }, 150));
    const nutritionShared = clients.filter((c) => c.scopes.nutrition);
    const scores = nutritionShared.map((c) => weekScore(c.week)).filter((v) => v != null);
    mount(body,
      h('div', { class: 'stats-row' },
        card(stat('აქტიური', fmtNum(clients.length), { icon: 'users' })),
        card(stat('ყურადღება სჭირდება', fmtNum(attention), { icon: 'alert', deltaTone: attention ? 'down' : '' })),
        card(stat('ელოდება', fmtNum(waiting), { icon: 'clock', delta: waiting ? `${requests.length} მოთხოვნა · ${invited.length} მოწვევა` : null })),
        card(stat('კვების დაცვა (საშ.)', scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : '—', { icon: 'utensils', delta: `${nutritionShared.length} კლიენტი აზიარებს კვებას` }))),
      h('div', { class: 'co-toolbar' },
        segmented([
          { value: 'all', label: `ყველა · ${clients.length}` },
          { value: 'attention', label: `ყურადღება · ${attention}` },
          { value: 'waiting', label: `ელოდება · ${waiting}` },
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
  const lockedCell = (scope) => h('span', { class: 'co-locked-mini', title: `${SCOPE_COPY[scope].title} არ არის გაზიარებული` }, icon('lock', { size: 13 }), 'არ აზიარებს');
  return h('a', { class: 'co-roster-row', href: `/coach/client/${c.id}`, 'data-link': '' },
    h('div', { class: 'co-rc-who' },
      h('span', { class: 'co-ring-av' }, ring({ value: score ?? 0, max: 100, size: 50, stroke: 4, color: scoreTone(score), label: undefined }), avatarEl(c.name, c.avatarUrl, 38)),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, c.name),
        h('div', { class: 'row-sub' }, personLine(c) || '—'),
        warn ? h('div', { class: 'co-rc-warn' }, icon('alert', { size: 13 }), warn.text.replace(/^[^:]+:\s*/, '')) : null)),
    h('div', { class: 'co-rc-cell', 'data-label': 'კვება · 7 დღე' }, c.scopes.nutrition
      ? h('div', { class: 'co-rc-week' }, statusStrip(c.week || [], { small: true }), h('b', { style: { color: scoreTone(score) } }, score != null ? `${score}%` : '—'))
      : lockedCell('nutrition')),
    h('div', { class: 'co-rc-cell', 'data-label': 'დღეს' }, c.kcalToday
      ? h('span', { class: 'co-chip' }, icon('flame', { size: 13 }), `${fmtNum(c.kcalToday.eaten)}${c.kcalToday.target ? ` / ${fmtNum(c.kcalToday.target)}` : ''} კკალ`)
      : c.scopes.nutrition ? h('span', { class: 'faint' }, '—') : lockedCell('nutrition')),
    h('div', { class: 'co-rc-cell', 'data-label': 'წონა → მიზანი' }, c.weight
      ? h('div', { class: 'co-rc-weight' },
        h('span', null, c.weight.currentKg != null ? `${c.weight.currentKg}${c.weight.goalKg ? ` → ${c.weight.goalKg}` : ''} კგ` : 'აწონვა არ არის'),
        c.weight.percent != null ? h('div', { class: 'progress ink-teal', title: `მიზანი ${c.weight.percent}%` }, h('span', { style: { width: `${Math.max(3, Math.min(100, c.weight.percent))}%` } })) : null)
      : lockedCell('weight')),
    h('div', { class: 'co-rc-cell', 'data-label': 'შემდეგი ვარჯიში' }, c.nextSession
      ? h('span', { class: 'co-chip brand' }, icon('calendar', { size: 13 }), relStart(c.nextSession))
      : h('span', { class: 'faint' }, 'არ არის დაგეგმილი')));
}

/** 7/14-day adherence strip: one square per day, coloured by status. */
function statusStrip(days, opts = {}) {
  return h('div', { class: `co-strip ${opts.small ? 'sm' : ''}`, role: 'img', 'aria-label': days.map((d) => `${fmtDate(d.date)}: ${DAY_STATUS[d.status] || d.status}`).join('; ') },
    days.map((d) => h('span', { style: { background: DAY_COLOR[d.status] || 'var(--bg3)' }, title: `${shortDay(d.date)} · ${DAY_STATUS[d.status] || d.status}${d.calories ? ` · ${fmtNum(d.calories)} კკალ` : ''}` })));
}

/* ── Client detail ────────────────────────────────────── */
async function pageClient(env, clientId) {
  const body = frame(env, { active: 'clients', title: 'კლიენტის ბარათი', back: { href: '/coach/clients', label: 'კლიენტები' } });
  mount(body, h('div', { class: 'grid grid-main' }, skeleton(5), skeleton(5)), skeleton(8));
  let d;
  try {
    d = await get(`${API}/clients/${encodeURIComponent(clientId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'LINK_NOT_ACTIVE') {
      mount(body, card(empty('კავშირი აღარ არის აქტიური', e.message, button('კლიენტების სია', { href: '/coach/clients' }))));
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
  sub.textContent = [personLine(d.client), d.link.since ? `კლიენტი ${fmtDate(d.link.since, { year: true })}-დან` : null].filter(Boolean).join(' · ');
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
    { value: 'overview', label: 'მიმოხილვა' },
    { value: 'food', label: `კვება${sc.nutrition ? '' : ' · დახურულია'}` },
    { value: 'weight', label: `წონა${sc.weight ? '' : ' · დახურულია'}` },
    { value: 'training', label: `ვარჯიში${sc.workouts ? '' : ' · დახურულია'}` },
    { value: 'photos', label: `ფოტოები${sc.photos ? '' : ' · დახურულია'}` },
    { value: 'sessions', label: 'ვარჯიშები შენთან' },
  ];
  let tab = TABS_C.some((t) => t.value === env.ctx.query.tab) ? env.ctx.query.tab : 'overview';
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
          ? h('div', { class: 'co-id-score', style: { color: scoreTone(n.score) } }, `კვების დაცვა ${n.score}% · 14 დღე`)
          : h('div', { class: 'faint', style: { fontSize: '13px', marginTop: '4px' } }, sc.nutrition ? 'კვების ჩანაწერები ჯერ არ არის' : 'კვება არ არის გაზიარებული'))),
    d.link.note ? h('div', { class: 'co-quote' }, `„${d.link.note}“`) : null,
    h('div', null,
      h('div', { class: 'field-label', style: { marginBottom: '8px' } }, 'რას გიზიარებს'),
      h('div', { class: 'co-scope-chips' }, h('span', { class: 'co-scope on' }, icon('calendar', { size: 13 }), 'სესიები'),
        SCOPES.map((k) => h('span', { class: `co-scope ${sc[k] ? 'on' : ''}`, title: sc[k] ? SCOPE_COPY[k].body : `${SCOPE_COPY[k].title} — არ არის გაზიარებული` }, icon(sc[k] ? SCOPE_COPY[k].icon : 'lock', { size: 13 }), SCOPE_COPY[k].short))),
      h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, 'გაზიარებას მხოლოდ კლიენტი მართავს თავის „ჩემი ტრენერი“-ში და ნებისმიერ დროს შეწყვეტს.')),
    h('div', { class: 'co-actions' },
      button('დანიშვნა', { icon: 'plus', onClick: newSession }),
      button('კვების გეგმა', { variant: 'secondary', icon: 'utensils', onClick: () => (sc.nutrition ? env.ctx.navigate(`/coach/plan/${clientId}`) : goTab('food')) }),
      button('მიზანი', { variant: 'secondary', icon: 'target', onClick: () => (sc.weight ? env.ctx.navigate(`/coach/goal/${clientId}`) : goTab('weight')) })));

  const kpis = h('div', { class: 'co-kpis' },
    kpi('scale', 'violet', 'წონა', sc.weight ? (w?.currentKg != null ? `${w.currentKg} კგ` : '—') : null, sc.weight ? (w?.goal ? `მიზანი ${w.goal.targetKg} კგ${w.progress ? ` · ${w.progress.percent}%` : ''}` : 'მიზანი არ არის') : null, () => goTab('weight')),
    kpi('utensils', 'teal', 'კვების დაცვა', sc.nutrition ? (n?.score != null ? `${n.score}%` : '—') : null, sc.nutrition ? (n?.targets ? `გეგმა ${fmtNum(n.targets.calories)} კკალ` : 'გეგმა არ არის') : null, () => goTab('food')),
    kpi('footprints', 'blue', 'ნაბიჯები · 7 დღე', sc.workouts ? (avgSteps(a) ?? '—') : null, sc.workouts ? 'დღიური საშუალო' : null, () => goTab('training')),
    kpi('dumbbell', 'amber', 'ვარჯიში შენთან', fmtNum(pastSessions.filter((s) => s.status === 'DONE').length), `გამოტოვა ${pastSessions.filter((s) => s.status === 'NO_SHOW').length}`, () => goTab('sessions')));

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
        n ? section('კვება · 14 დღე', card(
          barChart({ labels: n.days.map((x) => String(parseDate(x.date).getDate())), tipLabels: n.days.map((x) => `${shortDay(x.date)} · ${DAY_STATUS[x.status]}`), values: n.days.map((x) => x.calories), goal: n.targets?.calories || null, goalLabel: n.targets ? 'გეგმა' : null, unit: 'კკალ', height: 170, color: 'var(--c1)' }),
          h('div', { style: { marginTop: '12px' } }, statusStrip(n.days)),
          h('div', { class: 'card-sub', style: { marginTop: '8px' } }, `დღეს: ${fmtNum(n.days.at(-1)?.calories ?? 0)}${n.targets ? ` / ${fmtNum(n.targets.calories)}` : ''} კკალ · ${n.today.length} კვება`)),
        { action: button('დეტალები', { variant: 'ghost', size: 'sm', onClick: () => goTab('food') }) }) : section('კვება', lockedCard('nutrition', d.client.name, { compact: true })),
        w ? section('წონა', card(weightChart(w, 190)), { action: button('დეტალები', { variant: 'ghost', size: 'sm', onClick: () => goTab('weight') }) }) : section('წონა', lockedCard('weight', d.client.name, { compact: true }))),
      h('div', null,
        toLog.length ? section('ჩასაწერი', card({ class: 'co-note co-note-warn' },
          h('b', null, `${toLog.length} ვარჯიში ელოდება შედეგს`),
          h('div', { class: 'list' }, toLog.slice(0, 3).map((s) => sessionRow(s, { hideName: true }))))) : null,
        section('მომავალი ვარჯიშები', card(upcoming.length
          ? h('div', { class: 'list' }, upcoming.slice(0, 5).map((s) => sessionRow(s, { hideName: true })))
          : h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'დაგეგმილი ვარჯიში არ არის.'), button('ვარჯიშის დანიშვნა', { variant: 'secondary', icon: 'plus', onClick: newSession })))),
        d.link.proposedGoal ? section('შეთავაზებული მიზანი', card(h('div', { class: 'hstack' }, tile('target', 'amber', 38),
          h('div', { class: 'row-main' },
            h('div', { class: 'card-title' }, `${GOAL_TYPE[d.link.proposedGoal.type] || d.link.proposedGoal.type} → ${d.link.proposedGoal.targetKg} კგ`),
            h('div', { class: 'card-sub' }, `ვადა ${fmtDate(d.link.proposedGoal.deadlineYmd, { year: true })} · ელოდება კლიენტის დასტურს`))))) : null,
        section('კვების გეგმა', d.plan ? planSummary(d.plan, sc.nutrition ? () => env.ctx.navigate(`/coach/plan/${clientId}`) : null) : card(h('div', { class: 'stack' },
          h('p', { class: 'muted' }, sc.nutrition ? 'გეგმა ჯერ არ შეგიდგენია. გეგმა კლიენტის პირად კვების პროგრამას არ ცვლის — დაცვა მისი დღიურიდან ითვლება.' : 'კვების გეგმისთვის კლიენტმა ჯერ „კვება“ უნდა გაგიზიაროს.'),
          sc.nutrition ? button('გეგმის შედგენა', { variant: 'secondary', icon: 'utensils', onClick: () => env.ctx.navigate(`/coach/plan/${clientId}`) }) : null))),
        section('კავშირი', card({ class: 'co-danger' },
          h('p', { class: 'faint', style: { fontSize: '13px' } }, 'კავშირის დასრულებისას მომავალი ვარჯიშები გაუქმდება და კლიენტის მონაცემებს ვეღარ ნახავ. ისტორია შენთან დარჩება.'),
          h('div', { class: 'hstack' },
            button('კავშირის დასრულება', { variant: 'ghost', icon: 'userMinus', onClick: endLink }),
            button('შეტყობინება დარღვევაზე', { variant: 'ghost', icon: 'flag', onClick: () => openReport(env, d.client, () => env.ctx.navigate('/coach/clients')) }))))));
  }

  function viewFood() {
    const counts = {};
    n.days.forEach((x) => { counts[x.status] = (counts[x.status] || 0) + 1; });
    const parts = ['ON', 'LOW_PROTEIN', 'UNDER', 'OVER', 'NONE', 'PENDING'].filter((k) => counts[k]).map((k) => ({ name: DAY_STATUS[k], value: counts[k], color: DAY_COLOR[k] }));
    const logged = n.days.filter((x) => x.meals);
    const avg = (k) => (logged.length ? Math.round(logged.reduce((s, x) => s + x[k], 0) / logged.length) : null);
    return h('div', { class: 'stack', style: { gap: '0' } },
      h('div', { class: 'stats-row co-mb' },
        card(stat('გეგმის დაცვა', n.score != null ? `${n.score}%` : '—', { icon: 'target', delta: '14 დღე, დასრულებული დღეები' })),
        card(stat('გეგმა', n.targets ? fmtNum(n.targets.calories) : '—', { unit: n.targets ? 'კკალ / დღე' : '', icon: 'utensils', delta: n.targets?.protein ? `ცილა ${n.targets.protein} გ` : 'გეგმა არ არის' })),
        card(stat('საშუალოდ', avg('calories') != null ? fmtNum(avg('calories')) : '—', { unit: avg('calories') != null ? 'კკალ' : '', icon: 'flame', delta: avg('protein') != null ? `ცილა ${avg('protein')} გ · ${logged.length} დღე ჩაწერილი` : 'ჩანაწერი არ არის' })),
        card(stat('ბოლო ჩანაწერი', n.lastMealYmd ? relDay(n.lastMealYmd) : '—', { icon: 'clock' }))),
      h('div', { class: 'grid grid-main' },
        section('კალორიები და მაკროები · 14 დღე', card(
          barChart({
            labels: n.days.map((x) => String(parseDate(x.date).getDate())),
            tipLabels: n.days.map((x) => `${shortDay(x.date)} · ${fmtNum(x.calories)} კკალ · ${DAY_STATUS[x.status]}`),
            stacked: [
              { name: 'ცილა', values: n.days.map((x) => x.protein * 4), color: 'var(--c1)' },
              { name: 'ნახშირწყალი', values: n.days.map((x) => x.carbs * 4), color: 'var(--c3)' },
              { name: 'ცხიმი', values: n.days.map((x) => x.fat * 9), color: 'var(--c2)' },
            ],
            goal: n.targets?.calories || null, goalLabel: n.targets ? `გეგმა ${fmtNum(n.targets.calories)}` : null, fmt: (v) => `${fmtNum(v)} კკალ`, height: 230,
          }),
          h('div', { class: 'legend', style: { marginTop: '10px' } }, [['ცილა', 'var(--c1)'], ['ნახშირწყალი', 'var(--c3)'], ['ცხიმი', 'var(--c2)']].map(([l, c]) => h('span', null, h('i', { style: { background: c } }), l))),
          h('div', { style: { marginTop: '14px' } }, statusStrip(n.days)))),
        section('დღეების შეფასება', card({ class: 'co-donut' },
          donut({ parts, size: 150, stroke: 18, center: [h('strong', { style: { fontSize: '26px' } }, n.score != null ? `${n.score}%` : '—'), h('span', null, 'გეგმაში')] }),
          h('div', { class: 'co-legend-col' }, parts.map((p) => h('div', { class: 'between' }, h('span', null, h('i', { style: { background: p.color } }), p.name), h('b', null, p.value)))),
          h('p', { class: 'faint', style: { fontSize: '12px' } }, 'გეგმაში = ±10% კალორია და ცილა ≥85%. დღე, როცა არაფერი ჩაწერა, არ ითვლება.')))),
      !n.targets ? card({ class: 'co-note co-mb' }, h('div', { class: 'between' }, h('span', null, 'გეგმის გარეშე ყველა ჩაწერილი დღე „გეგმაშია“. შეადგინე გეგმა, რომ დაცვა გაიზომოს.'), button('გეგმის შედგენა', { size: 'sm', icon: 'utensils', onClick: () => env.ctx.navigate(`/coach/plan/${clientId}`) }))) : null,
      h('div', { class: 'grid grid-2' },
        section('დღეს', card(n.today.length
          ? h('div', { class: 'list' }, n.today.map((m) => h('div', { class: 'row' }, h('span', { class: 'co-time' }, m.time), h('div', { class: 'row-main' }, h('div', { class: 'row-title co-wrap' }, m.title || 'კვება'), h('div', { class: 'row-sub' }, `ცილა ${m.protein} გ`)), h('b', null, `${fmtNum(m.calories)} კკალ`))))
          : h('p', { class: 'muted' }, 'დღეს ჯერ არაფერი ჩაუწერია.'))),
        section('კვების გეგმა', d.plan ? planSummary(d.plan, () => env.ctx.navigate(`/coach/plan/${clientId}`)) : card(h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'გეგმა ჯერ არ არის.'), button('გეგმის შედგენა', { variant: 'secondary', icon: 'utensils', onClick: () => env.ctx.navigate(`/coach/plan/${clientId}`) }))))),
      section('დღიური · 14 დღე', card({ class: 'flush' }, h('div', { class: 'table-wrap' }, h('table', { class: 'table co-table' },
        h('thead', null, h('tr', null, ['დღე', 'კვება', 'კკალ', 'ცილა', 'ნახშ.', 'ცხიმი', 'სტატუსი'].map((t) => h('th', null, t)))),
        h('tbody', null, [...n.days].reverse().map((x) => h('tr', null,
          h('td', null, shortDay(x.date)), h('td', null, x.meals || '—'), h('td', null, x.meals ? fmtNum(x.calories) : '—'),
          h('td', null, x.meals ? `${x.protein} გ` : '—'), h('td', null, x.meals ? `${x.carbs} გ` : '—'), h('td', null, x.meals ? `${x.fat} გ` : '—'),
          h('td', null, h('span', { class: 'co-status' }, h('i', { style: { background: DAY_COLOR[x.status] } }), DAY_STATUS[x.status] || x.status))))))))));
  }

  function viewWeight() {
    const series = w.series || [];
    const first = series[0];
    const last = series.at(-1);
    const change = first && last ? Math.round((last.kg - first.kg) * 10) / 10 : null;
    return h('div', { class: 'stack', style: { gap: '0' } },
      h('div', { class: 'stats-row co-mb' },
        card(stat('ახლა', w.currentKg != null ? `${w.currentKg}` : '—', { unit: w.currentKg != null ? 'კგ' : '', icon: 'scale', delta: w.lastWeighYmd ? `აწონვა: ${relDay(w.lastWeighYmd)}` : 'აწონვა არ არის' })),
        card(stat('მიზანი', w.goal ? `${w.goal.targetKg}` : '—', { unit: w.goal ? 'კგ' : '', icon: 'target', delta: w.goal?.deadlineYmd ? `ვადა ${fmtDate(w.goal.deadlineYmd, { year: true })}` : 'მიზანი არ არის' })),
        card(stat('პროგრესი', w.progress ? `${w.progress.percent}%` : '—', { icon: 'trendDown', delta: w.progress ? `დარჩა ${Math.abs(w.progress.remainingKg)} კგ` : null, children: w.progress ? h('div', { class: 'progress ink-teal', style: { marginTop: '10px' } }, h('span', { style: { width: `${w.progress.percent}%` } })) : null })),
        card(stat('ცვლილება', change != null ? `${change > 0 ? '+' : ''}${change}` : '—', { unit: change != null ? 'კგ' : '', icon: 'activity', delta: first ? `${fmtDate(first.date)}-დან · ${series.length} აწონვა` : null, deltaTone: change != null ? (change <= 0 ? 'up' : 'down') : '' }))),
      section('წონის დინამიკა', card(weightChart(w, 280),
        h('div', { class: 'legend', style: { marginTop: '10px' } },
          h('span', null, h('i', { style: { background: 'var(--c1)' } }), 'წონა'),
          w.goal?.startedYmd && w.goal?.deadlineYmd ? h('span', null, h('i', { style: { background: 'var(--c3)' } }), 'იდეალური გზა ვადამდე') : null,
          w.goal ? h('span', null, h('i', { style: { background: 'var(--text3)' } }), 'მიზანი') : null)),
      { action: button(w.goal ? 'ახალი მიზნის შეთავაზება' : 'მიზნის შეთავაზება', { variant: 'secondary', size: 'sm', icon: 'target', onClick: () => env.ctx.navigate(`/coach/goal/${clientId}`) }) }),
      d.link.proposedGoal ? card({ class: 'co-note' }, `შენი შეთავაზება: ${GOAL_TYPE[d.link.proposedGoal.type] || ''} → ${d.link.proposedGoal.targetKg} კგ, ${fmtDate(d.link.proposedGoal.deadlineYmd, { year: true })}. ელოდება კლიენტის დასტურს.`) : null);
  }

  function viewTraining() {
    const days = a.days || [];
    const last30 = days.slice(-30);
    const withSteps = last30.filter((x) => x.steps != null);
    return h('div', { class: 'stack', style: { gap: '0' } },
      h('div', { class: 'stats-row co-mb' },
        card(stat('ნაბიჯები · 7 დღე', avgSteps(a) || '—', { icon: 'footprints', delta: 'დღიური საშუალო' })),
        card(stat('8 000+ დღეები', `${withSteps.filter((x) => x.steps >= 8000).length}/${withSteps.length || 0}`, { icon: 'target', delta: 'ბოლო 30 დღე' })),
        card(stat('ვარჯიშები საათიდან', fmtNum((a.workouts || []).length), { icon: 'activity', delta: '30 დღე' })),
        card(stat('ძილი', avgOf(last30.slice(-7), 'sleepHours', 1) ?? '—', { unit: avgOf(last30.slice(-7), 'sleepHours', 1) != null ? 'სთ' : '', icon: 'moon', delta: '7 დღის საშუალო' }))),
      section('ნაბიჯები · 30 დღე', card(withSteps.length
        ? barChart({ labels: last30.map((x) => String(parseDate(x.date).getDate())), tipLabels: last30.map((x) => shortDay(x.date)), values: last30.map((x) => x.steps || 0), goal: 8000, goalLabel: '8 000', unit: 'ნაბიჯი', height: 200, color: 'var(--c5)' })
        : h('p', { class: 'muted' }, 'ნაბიჯების მონაცემი არ არის.'))),
      h('div', { class: 'grid grid-2' },
        section('ძილი', card(last30.some((x) => x.sleepHours != null)
          ? lineChart({ labels: last30.map((x) => String(parseDate(x.date).getDate())), tipLabels: last30.map((x) => shortDay(x.date)), series: [{ name: 'ძილი', values: last30.map((x) => x.sleepHours ?? null), color: 'var(--c2)' }], unit: 'სთ', height: 170, min: 0 })
          : h('p', { class: 'muted' }, 'ძილის მონაცემი არ არის.'))),
        section('საშუალო პულსი', card(last30.some((x) => x.heartRate != null)
          ? lineChart({ labels: last30.map((x) => String(parseDate(x.date).getDate())), tipLabels: last30.map((x) => shortDay(x.date)), series: [{ name: 'პულსი', values: last30.map((x) => x.heartRate ?? null), color: 'var(--c4)' }], unit: 'bpm', height: 170 })
          : h('p', { class: 'muted' }, 'პულსის მონაცემი არ არის.')))),
      section('დამოუკიდებელი ვარჯიშები (საათი / ტელეფონი)', card({ class: 'flush' }, (a.workouts || []).length
        ? h('div', { class: 'table-wrap' }, h('table', { class: 'table co-table' },
          h('thead', null, h('tr', null, ['დღე', 'ტიპი', 'ხანგრძლივობა', 'კკალ', 'საშ. პულსი', 'მანძილი'].map((t) => h('th', null, t)))),
          h('tbody', null, a.workouts.slice(0, 20).map((x) => h('tr', null,
            h('td', null, `${shortDay(x.startedAt)} · ${fmtTime(x.startedAt)}`), h('td', null, workoutKind(x.kind)), h('td', null, `${x.durationMin} წთ`),
            h('td', null, x.kcal != null ? fmtNum(x.kcal) : '—'), h('td', null, x.avgHeartRate != null ? `${x.avgHeartRate} bpm` : '—'), h('td', null, x.distanceKm != null ? `${x.distanceKm} კმ` : '—'))))))
        : h('p', { class: 'muted', style: { padding: '20px' } }, 'საათიდან/ტელეფონიდან ვარჯიში ჯერ არ მოსულა.'))));
  }

  function viewPhotos() {
    const photos = d.photos;
    let pose = ['FRONT', 'SIDE', 'BACK'].find((p) => photos.filter((x) => x.pose === p).length >= 2) || 'FRONT';
    const cmpBox = h('div');
    const paint = () => {
      const same = photos.filter((x) => x.pose === pose).sort((x, y) => x.takenOn.localeCompare(y.takenOn));
      mount(cmpBox, same.length >= 2 ? beforeAfter(same[0], same.at(-1)) : card(h('p', { class: 'muted' }, 'ამ რაკურსით შესადარებლად მინიმუმ ორი ფოტოა საჭირო.')));
    };
    const poses = segmented(['FRONT', 'SIDE', 'BACK'].map((p) => ({ value: p, label: `${POSE[p]} · ${photos.filter((x) => x.pose === p).length}` })), pose, (v) => { pose = v; paint(); });
    paint();
    if (!photos.length) return card(empty('ფოტოები ჯერ არ არის', 'კლიენტი ფოტოებს თავის აპში ამატებს („ჩემი ტრენერი“ → პროგრესი).'));
    return h('div', { class: 'grid grid-main' },
      section('მანამდე / შემდეგ', h('div', { class: 'stack' }, poses, cmpBox)),
      section(`ყველა ფოტო · ${photos.length}`, card(h('div', { class: 'co-gallery' }, photos.map((p) => {
        const img = h('img', { alt: `${POSE[p.pose] || ''} ${p.takenOn}`, loading: 'lazy' });
        authedBlobUrl(p.url).then((src) => { if (src) img.src = src; }).catch(() => {});
        return h('figure', { class: 'co-ph' }, img, h('figcaption', null, `${fmtDate(p.takenOn)}${p.weightKg ? ` · ${p.weightKg} კგ` : ''}`, h('span', null, POSE[p.pose] || p.pose)));
      })))));
  }

  function viewSessions() {
    const done = pastSessions.filter((s) => s.status === 'DONE');
    const rated = done.filter((s) => s.clientRating);
    return h('div', { class: 'stack', style: { gap: '0' } },
      h('div', { class: 'stats-row co-mb' },
        card(stat('ჩატარდა', fmtNum(done.length), { icon: 'calendarCheck' })),
        card(stat('არ მოვიდა', fmtNum(pastSessions.length - done.length), { icon: 'x' })),
        card(stat('დასწრება', pastSessions.length ? `${Math.round((done.length / pastSessions.length) * 100)}%` : '—', { icon: 'target' })),
        card(stat('შეფასება', rated.length ? (rated.reduce((s, x) => s + x.clientRating, 0) / rated.length).toFixed(1) : '—', { icon: 'star', delta: rated.length ? `${rated.length} შეფასება` : 'ჯერ არ შეუფასებია' }))),
      section('მომავალი', card(upcoming.length ? h('div', { class: 'list' }, upcoming.map((s) => sessionRow(s, { hideName: true }))) : h('div', { class: 'between' }, h('p', { class: 'muted' }, 'დაგეგმილი ვარჯიში არ არის.'), button('დანიშვნა', { size: 'sm', icon: 'plus', onClick: newSession }))),
      { action: button('დანიშვნა', { variant: 'ghost', size: 'sm', icon: 'plus', onClick: newSession }) }),
      section('ისტორია', card({ class: 'flush' }, d.sessions.filter((s) => new Date(s.startsAt).getTime() <= now).length
        ? h('div', { class: 'table-wrap' }, h('table', { class: 'table co-table' },
          h('thead', null, h('tr', null, ['თარიღი', 'ტიპი', 'სტატუსი', 'სავარჯიშოები', 'საათიდან', ''].map((t) => h('th', null, t)))),
          h('tbody', null, d.sessions.filter((s) => new Date(s.startsAt).getTime() <= now).map((s) => h('tr', { class: 'co-tr-link', onClick: () => env.ctx.navigate(`/coach/session/${s.id}`) },
            h('td', null, `${shortDay(s.startsAt)} · ${fmtTime(s.startsAt)}`),
            h('td', null, kindLabel(s, catalog)),
            h('td', null, sessionPill(s)),
            h('td', { class: 'co-td-ex' }, s.exercises.length ? s.exercises.map((e) => e.name).join(' · ') : '—'),
            h('td', null, s.workout ? `${s.workout.durationMin} წთ${s.workout.kcal ? ` · ${s.workout.kcal} კკალ` : ''}${s.workout.avgHeartRate ? ` · ${s.workout.avgHeartRate} bpm` : ''}` : '—'),
            h('td', null, s.clientRating ? h('span', { class: 'co-stars', title: `შეფასება ${s.clientRating}/5` }, '★'.repeat(s.clientRating)) : ''))))))
        : h('p', { class: 'muted', style: { padding: '20px' } }, 'ჩატარებული ვარჯიში ჯერ არ არის.'))));
  }

  async function endLink() {
    const ok = await confirmDialog({ title: 'კლიენტთან კავშირის დასრულება', body: 'მომავალი ვარჯიშები გაუქმდება და მის მონაცემებს ვეღარ ნახავ.', confirm: 'დასრულება', danger: true });
    if (!ok) return;
    try {
      await del(`${API}/clients/${encodeURIComponent(clientId)}`);
      toast('კავშირი დასრულდა');
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
    h('div', { class: 'co-kpi-v' }, locked ? 'დახურულია' : value),
    h('div', { class: 'co-kpi-l' }, label),
    h('div', { class: 'co-kpi-h' }, locked ? 'კლიენტს არ გაუზიარებია' : hint || ''));
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
      h('div', { class: 'card-title' }, `„${SCOPE_COPY[scope].title}“ არ არის გაზიარებული`),
      h('p', { class: 'muted' }, `ამას მხოლოდ ${firstWord(name) || 'კლიენტი'} ჩართავს თავის „ჩემი ტრენერი“-ში. შეგიძლია სთხოვო — გადაწყვეტილება მისია.`),
      opts.compact ? null : h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '6px' } }, SCOPE_COPY[scope].body)));
}

function planSummary(plan, onEdit) {
  const t = plan.targets || {};
  const macroK = (t.protein || 0) * 4 + (t.carbs || 0) * 4 + (t.fat || 0) * 9;
  return card({ class: 'co-plan' },
    h('div', { class: 'between' }, h('div', null, h('div', { class: 'card-title' }, plan.title), h('div', { class: 'card-sub' }, `${fmtNum(t.calories)} კკალ · ${plan.meals.length} კვება${plan.startsOn ? ` · ${fmtDate(plan.startsOn)}-დან` : ''}`)),
      onEdit ? button('შეცვლა', { variant: 'ghost', size: 'sm', icon: 'edit', onClick: onEdit }) : null),
    macroK ? macroBar(t) : null,
    plan.meals.length ? h('div', { class: 'co-plan-meals' }, plan.meals.map((m) => h('div', { class: 'co-plan-meal' },
      h('b', null, `${MEAL_SLOTS.find((s) => s.key === m.slot)?.label || m.slot}${m.time ? ` · ${m.time}` : ''}`),
      h('span', null, m.items.length ? m.items.map((i) => i.name).join(', ') : '—')))) : null);
}

function macroBar(t) {
  const p = (t.protein || 0) * 4;
  const c = (t.carbs || 0) * 4;
  const f = (t.fat || 0) * 9;
  const total = p + c + f;
  if (!total) return null;
  return h('div', { class: 'co-macro' },
    h('div', { class: 'co-macro-bar' }, [[p, 'var(--c1)'], [c, 'var(--c3)'], [f, 'var(--c2)']].map(([v, col]) => (v ? h('span', { style: { flex: String(v), background: col } }) : null))),
    h('div', { class: 'legend' }, [['ცილა', p, 'var(--c1)', t.protein], ['ნახშირწყალი', c, 'var(--c3)', t.carbs], ['ცხიმი', f, 'var(--c2)', t.fat]].map(([l, v, col, g]) => h('span', null, h('i', { style: { background: col } }), `${l} ${g ?? 0} გ · ${Math.round((v / total) * 100)}%`))));
}

function weightChart(w, height) {
  const series = (w.series || []).slice(-60);
  if (!series.length) return h('p', { class: 'muted' }, 'აწონვა ჯერ არ არის ჩაწერილი.');
  const goal = w.goal;
  const ideal = goal?.startedYmd && goal?.deadlineYmd ? series.map((x) => expectedWeight(goal, x.date)) : null;
  return lineChart({
    labels: series.map((x) => fmtDate(x.date, { short: true, year: false })),
    tipLabels: series.map((x) => fmtDate(x.date, { year: true })),
    series: [
      { name: 'წონა', values: series.map((x) => x.kg), color: 'var(--c1)', dots: series.length <= 30 },
      ideal ? { name: 'იდეალური გზა', values: ideal, color: 'var(--c3)', dashed: true, area: false, width: 2 } : null,
    ].filter(Boolean),
    goal: goal ? goal.targetKg : null,
    goalLabel: goal ? `მიზანი ${goal.targetKg} კგ` : null,
    unit: 'კგ',
    fmt: (v) => fmtNum(v, 1),
    zero: false,
    height,
  });
}

function beforeAfter(before, after) {
  const imgA = h('img', { alt: `მანამდე ${before.takenOn}` });
  const imgB = h('img', { alt: `შემდეგ ${after.takenOn}` });
  authedBlobUrl(before.url).then((s) => { if (s) imgA.src = s; }).catch(() => {});
  authedBlobUrl(after.url).then((s) => { if (s) imgB.src = s; }).catch(() => {});
  const top = h('div', { class: 'co-ba-top' }, imgB);
  const handle = h('div', { class: 'co-ba-handle' }, h('span', null, icon('chevronLeft', { size: 14 }), icon('chevronRight', { size: 14 })));
  const range = h('input', { type: 'range', min: 0, max: 100, value: 50, class: 'co-ba-range', 'aria-label': 'შედარება: მანამდე / შემდეგ' });
  const set = (v) => { top.style.clipPath = `inset(0 0 0 ${v}%)`; handle.style.left = `${v}%`; };
  range.addEventListener('input', () => set(range.value));
  set(50);
  const diff = before.weightKg != null && after.weightKg != null ? Math.round((after.weightKg - before.weightKg) * 10) / 10 : null;
  return card({ class: 'co-ba-card' },
    h('div', { class: 'co-ba' }, imgA, top, handle, range,
      h('span', { class: 'co-ba-tag l' }, `მანამდე · ${fmtDate(before.takenOn)}`),
      h('span', { class: 'co-ba-tag r' }, `შემდეგ · ${fmtDate(after.takenOn)}`)),
    h('div', { class: 'between', style: { marginTop: '12px' } },
      h('span', { class: 'muted' }, `${Math.round((Date.parse(after.takenOn) - Date.parse(before.takenOn)) / 86400000)} დღე`),
      diff != null ? h('b', null, `${before.weightKg} → ${after.weightKg} კგ (${diff > 0 ? '+' : ''}${diff})`) : null));
}

/* ── Calendar ─────────────────────────────────────────── */
async function pageCalendar(env, opts = {}) {
  const catalog = await env.catalog();
  const state = { view: env.ctx.query.view === 'month' ? 'month' : 'week', anchor: new Date(), selected: ymd(), sessions: null, seq: 0 };
  const body = frame(env, {
    active: 'calendar',
    title: 'კალენდარი',
    sub: 'ვარჯიშები, თავისუფალი სლოტები და დასწრება — შენი ადგილობრივი დროით',
    actions: [button('ვარჯიშის დანიშვნა', { icon: 'plus', onClick: () => openNew({ date: state.selected >= ymd() ? state.selected : ymd() }) })],
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
        iconButton('chevronLeft', { title: state.view === 'week' ? 'წინა კვირა' : 'წინა თვე', onClick: () => shift(-1) }),
        iconButton('chevronRight', { title: state.view === 'week' ? 'შემდეგი კვირა' : 'შემდეგი თვე', onClick: () => shift(1) }),
        h('h2', { class: 'co-cal-title' }, title),
        button('დღეს', { variant: 'ghost', size: 'sm', onClick: () => { state.anchor = new Date(); state.selected = ymd(); load(); } })),
      h('div', { class: 'hstack' },
        state.sessions ? h('span', { class: 'co-cal-sum' }, `${booked} ვარჯიში · ${open} სლოტი · ${String(hours).replace('.', ',')} სთ`) : null,
        segmented([{ value: 'week', label: 'კვირა' }, { value: 'month', label: 'თვე' }], state.view, (v) => {
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
    [['var(--brand-2)', 'დაგეგმილი'], ['var(--ok)', 'ჩატარდა'], ['var(--warn)', 'ჩასაწერი'], ['var(--danger)', 'არ მოვიდა'], ['var(--text3)', 'თავისუფალი სლოტი'], ['var(--bg3)', 'გაუქმდა']]
      .map(([c, l]) => h('span', null, h('i', { style: { background: c } }), l)));

  const dayPanel = (map) => {
    const list = map.get(state.selected) || [];
    const isPast = state.selected < ymd();
    return section(dayWithRel(state.selected), card(list.length
      ? h('div', { class: 'list' }, list.map((s) => calRow(s, catalog)))
      : h('div', { class: 'co-empty-card' }, tile('calendar', 'neutral', 44), h('div', { class: 'card-title' }, isPast ? 'ამ დღეს ვარჯიში არ ყოფილა' : 'თავისუფალი დღე'),
        isPast ? null : button('დანიშვნა ამ დღეს', { icon: 'plus', onClick: () => openNew({ date: state.selected }) }))),
    { action: !isPast && list.length ? button('დამატება', { variant: 'ghost', size: 'sm', icon: 'plus', onClick: () => openNew({ date: state.selected }) }) : null });
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
          return section(dayWithRel(k), card(list.length ? h('div', { class: 'list' }, list.map((s) => calRow(s, catalog))) : h('p', { class: 'faint' }, 'ვარჯიში არ არის')),
            { action: k >= ymd() ? iconButton('plus', { title: 'დანიშვნა ამ დღეს', onClick: () => openNew({ date: k }) }) : null });
        })));
      return;
    }
    const { from } = range();
    const cells = Array.from({ length: 42 }, (_, i) => addDays(from, i));
    const month = state.anchor.getMonth();
    const panel = h('div');
    const grid = h('div', { class: 'co-month' },
      ['ორ', 'სმ', 'ოთ', 'ხთ', 'პრ', 'შბ', 'კვ'].map((d) => h('div', { class: 'co-month-h' }, d)),
      cells.map((d) => {
        const k = ymd(d);
        const list = map.get(k) || [];
        const live = list.filter((s) => s.status !== 'CANCELLED');
        return h('button', {
          type: 'button',
          class: `co-month-d ${d.getMonth() !== month ? 'out' : ''} ${k === ymd() ? 'today' : ''} ${k === state.selected ? 'sel' : ''}`,
          'aria-label': `${fmtDate(k)}, ${live.length} ვარჯიში`,
          'aria-pressed': k === state.selected ? 'true' : 'false',
          onClick: () => { state.selected = k; paint(); },
        },
        h('span', { class: 'co-month-n' }, d.getDate()),
        h('span', { class: 'co-month-items' }, live.slice(0, 3).map((s) => h('span', { class: 'co-month-item', style: `--c:${sessionColor(s)}` }, h('i'), h('b', null, fmtTime(s.startsAt)), h('em', null, s.clientName ? firstWord(s.clientName) : 'სლოტი'))),
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
    h('div', { class: 'co-calrow-time' }, h('b', null, fmtTime(s.startsAt)), h('span', null, `${s.durationMin} წთ`)),
    s.clientId ? avatarEl(s.clientName, s.clientAvatarUrl, 36) : h('span', { class: 'co-slot-av' }, icon('plus', { size: 16 })),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, s.clientName || 'თავისუფალი სლოტი'),
      h('div', { class: 'row-sub' }, [kindLabel(s, catalog), s.gym ? `${s.gym.brand} · ${s.gym.name}` : null].filter(Boolean).join(' · '), s.seriesId && s.seriesId !== 'slot' ? h('span', { class: 'co-inline-ic', title: 'ყოველკვირეული' }, icon('repeat', { size: 12 })) : null)),
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
    const hit = h('div', { class: 'co-wk-hit', title: k >= ymd(now) ? 'დააჭირე ვარჯიშის დასანიშნად' : '' });
    hit.addEventListener('click', (e) => {
      if (k < ymd(now)) return;
      const r = hit.getBoundingClientRect();
      const hour = Math.min(GRID_TO - 1, GRID_FROM + Math.floor((e.clientY - r.top) / HOUR_PX));
      const at = new Date(d); at.setHours(hour, 0, 0, 0);
      if (at.getTime() < Date.now() - 15 * 60000) { toast('წარსულ დროზე ვარჯიშს ვერ დანიშნავ.', 'info'); return; }
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
        title: `${fmtTime(p.s.startsAt)} · ${p.s.clientName || 'თავისუფალი სლოტი'} · ${p.s.kindLabel} · ${SESSION_STATUS[p.s.status] || p.s.status}`,
      },
      h('b', null, `${fmtTime(p.s.startsAt)} ${p.s.clientName ? firstWord(p.s.clientName) : 'სლოტი'}`),
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
  const who = select([{ value: '', label: 'თავისუფალი სლოტი — კლიენტი თავად დაჯავშნის' }, ...clients.map((c) => ({ value: c.id, label: c.name }))], st.clientId, { 'aria-label': 'ვისთვის' });
  const whoHint = h('span', { class: 'field-hint' });
  const date = input({ type: 'date', min: today, value: st.date, required: true });
  const time = input({ type: 'time', step: 900, value: st.time, required: true });
  const durBox = h('div', { class: 'chips' });
  const kindBox = h('div', { class: 'chips' });
  const gym = select([...gyms.map((g) => ({ value: g.id, label: `${g.brand} · ${g.name}` })), { value: '', label: 'დარბაზის გარეშე' }], st.gymId, { 'aria-label': 'დარბაზი' });
  const repeat = select(Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: i === 0 ? 'ერთხელ' : `ყოველ კვირას · ${i + 1} კვირა` })), 1, { 'aria-label': 'გამეორება' });
  const note = textarea({ maxlength: 300, rows: 2, placeholder: 'მაგ. ფეხების დღე — წამოიღე ქამარი' });
  const summary = h('div', { class: 'co-summary' });

  const paint = () => {
    mount(durBox, DURATIONS.map((m) => h('button', { type: 'button', class: `chip ${st.duration === m ? 'on' : ''}`, onClick: () => { st.duration = m; paint(); } }, `${m} წთ`)));
    mount(kindBox, kinds.map((k) => h('button', { type: 'button', class: `chip ${st.kind === k.key ? 'on' : ''}`, onClick: () => { st.kind = k.key; paint(); } }, k.label)));
    const c = clients.find((x) => x.id === who.value);
    whoHint.textContent = c ? (c.nextSession ? `შემდეგი ვარჯიში უკვე დაგეგმილია: ${relStart(c.nextSession)}` : 'დაგეგმილი ვარჯიში არ აქვს') : 'სლოტს შენი ნებისმიერი კლიენტი დაჯავშნის „ჩემი ტრენერი“-დან — ერთხელ.';
    const at = date.value && time.value ? new Date(`${date.value}T${time.value}`) : null;
    const n = Number(repeat.value) || 1;
    mount(summary, at && !Number.isNaN(at.getTime())
      ? [icon('calendar', { size: 16 }), h('span', null, `${dayWithRel(date.value)}, ${time.value}–${fmtTime(new Date(at.getTime() + st.duration * 60000))}${n > 1 ? ` · ${n} კვირა, ბოლო ${fmtDate(addDays(at, (n - 1) * 7))}` : ''}`)]
      : h('span', { class: 'faint' }, 'აირჩიე დღე და დრო'));
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
    if (!date.value || !time.value || Number.isNaN(at.getTime())) { err.textContent = 'აირჩიე დღე და დრო.'; err.hidden = false; return; }
    if (at.getTime() < Date.now() - 15 * 60000) { err.textContent = 'წარსულ დროზე ვარჯიშს ვერ დანიშნავ.'; err.hidden = false; return; }
    await busy(submitBtn, async () => {
      try {
        const res = await post(`${API}/sessions`, {
          clientId: who.value || null, startsAt: at.toISOString(), durationMin: st.duration, gymId: gym.value || null, kind: st.kind, note: note.value.trim(), repeatWeeks: Number(repeat.value) || 1,
        });
        const c = clients.find((x) => x.id === who.value);
        toast(who.value ? `${firstWord(c?.name) || 'კლიენტს'} შეტყობინება მიუვა · ${res.sessions.length > 1 ? `${res.sessions.length} ვარჯიში` : 'ვარჯიში დაინიშნა'}` : `${res.sessions.length} თავისუფალი სლოტი გამოქვეყნდა`);
        close();
        preset.onDone?.(res.sessions);
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
  };
  openModal({
    title: 'ვარჯიშის დანიშვნა',
    size: 'md',
    body: (close) => h('form', { class: 'form', novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(close); } },
      field('ვისთვის', who, whoHint),
      h('div', { class: 'form-row' }, field('დღე', date), field('დაწყება', time, 'შენი ადგილობრივი დროით')),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'ხანგრძლივობა'), durBox),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'ვარჯიშის ტიპი'), kindBox),
      h('div', { class: 'form-row' }, gyms.length ? field('დარბაზი', gym) : null, field('გამეორება', repeat)),
      field('შენიშვნა კლიენტს (არასავალდებულო)', note),
      summary,
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, 'კლიენტს შეტყობინება მაშინვე მიუვა, შეხსენება — 24 და 1 საათით ადრე.'),
      err,
      h('button', { type: 'submit', hidden: true })),
    footer: (close) => {
      submitBtn = button('დანიშვნა', { icon: 'check', onClick: () => submit(close) });
      return [button('გაუქმება', { variant: 'ghost', onClick: () => close() }), submitBtn];
    },
  });
}

/* ── Session detail ───────────────────────────────────── */
async function pageSession(env, id) {
  const body = frame(env, { active: 'calendar', title: 'ვარჯიში', back: { href: '/coach/calendar', label: 'კალენდარი' } });
  mount(body, h('div', { class: 'grid grid-main' }, skeleton(6), skeleton(4)));
  let s;
  try {
    ({ session: s } = await get(`${API}/sessions/${encodeURIComponent(id)}`));
  } catch (e) { env.fail(body, e, () => pageSession(env, id)); return; }
  const catalog = await env.catalog();
  const title = s.clientName || (s.status === 'OPEN' ? 'თავისუფალი სლოტი' : 'ვარჯიში');
  env.ctx.setTitle(title);
  const h1 = env.root.querySelector('.page-head h1');
  if (h1) h1.textContent = title;
  const subEl = h('p', null, `${longDay(s.startsAt)} · ${fmtTime(s.startsAt)} · ${s.durationMin} წთ`);
  env.root.querySelector('.page-head-text')?.appendChild(subEl);

  const now = Date.now();
  const started = new Date(s.startsAt).getTime() <= now + 15 * 60000;
  const canLog = Boolean(s.clientId && (s.status === 'DONE' || s.status === 'NO_SHOW' || (s.status === 'SCHEDULED' && started)));
  const canChange = (s.status === 'SCHEDULED' || s.status === 'OPEN') && !started;
  const t = timing(s.startsAt, s.durationMin, now);
  const reload = () => pageSession(env, id);

  const header = card({ class: 'co-sess-head' },
    h('div', { class: 'between' },
      s.status === 'SCHEDULED' ? badge(s.clientConfirmedAt ? 'კლიენტმა დაადასტურა' : 'დასტურს ელოდება', s.clientConfirmedAt ? 'ok' : 'neutral') : badge(SESSION_STATUS[s.status] || s.status, sessionTone(s)),
      s.status === 'SCHEDULED' || s.status === 'OPEN' ? h('span', { class: 'faint' }, t.text) : null),
    h('div', { class: 'co-sess-main' },
      h('div', { class: 'co-next-time' }, h('strong', null, fmtTime(s.startsAt)), h('span', null, dayWithRel(s.startsAt))),
      h('span', { class: 'co-next-sep' }),
      h('div', { class: 'row-main' },
        h('div', { class: 'card-title' }, `${kindLabel(s, catalog)} · ${s.durationMin} წთ`),
        s.gym ? h('div', { class: 'card-sub co-inline' }, icon('mapPin', { size: 14 }), `${s.gym.brand} · ${s.gym.name}${s.gym.city ? `, ${s.gym.city}` : ''}`) : h('div', { class: 'card-sub' }, 'დარბაზის გარეშე'),
        s.seriesId && s.seriesId !== 'slot' ? h('div', { class: 'card-sub co-inline' }, icon('repeat', { size: 14 }), 'ყოველკვირეული სერიის ნაწილი') : null,
        s.seriesId === 'slot' ? h('div', { class: 'card-sub co-inline' }, icon('calendarCheck', { size: 14 }), 'კლიენტმა თავისუფალი სლოტი დაჯავშნა') : null)),
    s.clientId ? h('a', { class: 'co-person', href: `/coach/client/${s.clientId}`, 'data-link': '' },
      avatarEl(s.clientName, s.clientAvatarUrl, 40),
      h('b', { class: 'row-main' }, s.clientName),
      s.clientRating ? h('span', { class: 'co-stars', title: `შეფასება ${s.clientRating} 5-დან` }, '★'.repeat(s.clientRating), h('span', { class: 'faint' }, '★'.repeat(5 - s.clientRating))) : null,
      icon('chevronRight', { size: 16 })) : null,
    s.note ? h('div', { class: 'co-quote' }, `„${s.note}“`) : null,
    s.status === 'CANCELLED' ? h('div', { class: 'co-note co-note-warn' }, `გაუქმდა${s.cancelledBy === 'CLIENT' ? ' კლიენტის მიერ' : s.cancelledBy === 'TRAINER' ? ' შენ მიერ' : ''}${s.cancelReason ? ` — ${s.cancelReason}` : ''}${s.lateCancel ? ' · ბოლო წუთის გაუქმება (<12 სთ)' : ''}`) : null);

  const watch = s.workout ? section(`კლიენტის საათიდან · ${workoutKind(s.workout.kind)}`, h('div', { class: 'grid grid-3' },
    card(stat('ხანგრძლივობა', `${s.workout.durationMin}`, { unit: 'წთ', icon: 'timer' })),
    card(stat('კალორია', s.workout.kcal != null ? fmtNum(s.workout.kcal) : '—', { unit: 'კკალ', icon: 'flame' })),
    card(stat('საშ. პულსი', s.workout.avgHeartRate != null ? `${s.workout.avgHeartRate}` : '—', { unit: 'bpm', icon: 'heart' })))) : null;

  // Results log (exercises).
  let rows = s.exercises.map((e) => ({ name: e.name, sets: e.sets ?? '', reps: e.reps ?? '', kg: e.kg ?? '' }));
  const exBox = h('div', { class: 'co-ex' });
  const volEl = h('span', { class: 'faint' });
  const quickBox = h('div', { class: 'chips' });
  const trainerNote = textarea({ maxlength: 1000, rows: 3, value: s.trainerNote || '', placeholder: 'რა გამოუვიდა კარგად, რაზე იმუშაოს შემდეგ ჯერზე' });
  const paintVolume = () => {
    const v = rows.reduce((sum, r) => sum + (num(r.sets) || 0) * (num(r.reps) || 0) * (num(r.kg) || 0), 0);
    volEl.textContent = v ? `მოცულობა ${fmtNum(Math.round(v))} კგ` : '';
  };
  const paintEx = () => {
    mount(exBox, rows.length ? h('div', { class: 'co-ex-head', 'aria-hidden': 'true' }, h('span', null, '#'), h('span', null, 'სავარჯიშო'), h('span', null, 'სეტი'), h('span', null, 'გამეორება'), h('span', null, 'კგ'), h('span')) : null,
      rows.map((r, i) => {
        const upd = (k) => (e) => { r[k] = k === 'name' ? e.target.value : e.target.value.replace(/[^\d.,]/g, '').slice(0, 6); if (k !== 'name') e.target.value = r[k]; paintVolume(); };
        return h('div', { class: 'co-ex-row' },
          h('span', { class: 'co-ex-n' }, i + 1),
          input({ value: r.name, placeholder: 'სავარჯიშო', maxlength: 80, 'aria-label': `სავარჯიშო ${i + 1}`, onInput: upd('name') }),
          input({ value: r.sets, inputmode: 'numeric', placeholder: '—', 'aria-label': 'სეტი', onInput: upd('sets') }),
          input({ value: r.reps, inputmode: 'numeric', placeholder: '—', 'aria-label': 'გამეორება', onInput: upd('reps') }),
          input({ value: r.kg, inputmode: 'decimal', placeholder: '—', 'aria-label': 'კგ', onInput: upd('kg') }),
          iconButton('trash', { title: 'წაშლა', onClick: () => { rows.splice(i, 1); paintEx(); } }));
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
        toast(status === 'DONE' ? 'შენახულია — კლიენტი ნახავს შედეგს და შეფასებას დატოვებს' : 'მონიშნულია: არ მოვიდა');
        reload();
      } catch (e) { toast(e.message, 'error'); }
    });
  };
  const logSection = canLog ? section('შედეგები', card({ class: 'stack' },
    h('div', { class: 'between' }, h('span', { class: 'field-label' }, 'სავარჯიშოები'), volEl),
    exBox,
    quickBox,
    button('სხვა სავარჯიშო', { variant: 'ghost', size: 'sm', icon: 'plus', onClick: () => { rows.push({ name: '', sets: '', reps: '', kg: '' }); paintEx(); exBox.querySelector('.co-ex-row:last-child input')?.focus(); } }),
    field('შენიშვნა კლიენტს', trainerNote),
    (() => {
      const doneBtn = button(s.status === 'DONE' ? 'განახლება' : 'ჩატარდა', { icon: 'check' });
      const noBtn = button('არ მოვიდა', { variant: 'ghost', icon: 'x' });
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
    const dur = select(DURATIONS.concat(DURATIONS.includes(s.durationMin) ? [] : [s.durationMin]).sort((a, b) => a - b).map((m) => ({ value: m, label: `${m} წთ` })), s.durationMin);
    const kind = select(kinds.map((k) => ({ value: k.key, label: k.label })), s.kind);
    const gym = select([...gyms.map((g) => ({ value: g.id, label: `${g.brand} · ${g.name}` })), ...(s.gym && !gyms.some((g) => g.id === s.gym.id) ? [{ value: s.gym.id, label: `${s.gym.brand} · ${s.gym.name}` }] : []), { value: '', label: 'დარბაზის გარეშე' }], s.gym?.id || '');
    const note = textarea({ maxlength: 300, rows: 2, value: s.note || '' });
    const err = h('div', { class: 'form-error', hidden: true });
    const save = button('ცვლილების შენახვა', { icon: 'check' });
    save.addEventListener('click', async () => {
      err.hidden = true;
      const at = new Date(`${date.value}T${time.value}`);
      if (Number.isNaN(at.getTime())) { err.textContent = 'აირჩიე დღე და დრო.'; err.hidden = false; return; }
      if (at.getTime() < Date.now() - 15 * 60000) { err.textContent = 'წარსულ დროზე ვერ გადაიტან.'; err.hidden = false; return; }
      const body2 = { durationMin: Number(dur.value), kind: kind.value, gymId: gym.value || null, note: note.value.trim() };
      if (at.getTime() !== d0.getTime()) body2.startsAt = at.toISOString();
      await busy(save, async () => {
        try {
          await patch(`${API}/sessions/${encodeURIComponent(s.id)}`, body2);
          toast(body2.startsAt && s.clientId ? 'გადაიტანე — კლიენტს ახალი დროის შეტყობინება მიუვა' : 'შენახულია');
          reload();
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      });
    });
    const cancelBtn = button(s.status === 'OPEN' ? 'სლოტის გაუქმება' : 'ვარჯიშის გაუქმება', { variant: 'ghost', icon: 'x' });
    cancelBtn.addEventListener('click', () => cancelSession(s, reload));
    changeSection = section('ცვლილება', card({ class: 'stack' },
      h('div', { class: 'form-row' }, field('დღე', date), field('დრო', time, 'შენი ადგილობრივი დროით')),
      h('div', { class: 'form-row' }, field('ხანგრძლივობა', dur), field('ტიპი', kind)),
      field('დარბაზი', gym),
      field('შენიშვნა კლიენტს', note),
      s.clientId ? h('p', { class: 'faint', style: { fontSize: '12.5px' } }, 'დროის შეცვლისას კლიენტს შეტყობინება მიუვა და ხელახლა დაადასტურებს.') : null,
      err,
      h('div', { class: 'hstack' }, save, cancelBtn)));
  }

  const info = section('სტატუსი', card({ class: 'stack' },
    h('div', { class: 'list' },
      infoRow('calendar', 'თარიღი', `${longDay(s.startsAt)}, ${fmtTime(s.startsAt)}–${fmtTime(new Date(new Date(s.startsAt).getTime() + s.durationMin * 60000))}`),
      infoRow('user', 'კლიენტი', s.clientName || 'ჯერ არავის დაუჯავშნია'),
      infoRow('check', 'კლიენტის დასტური', s.status === 'OPEN' ? '—' : s.clientConfirmedAt ? fmtDateTimeSafe(s.clientConfirmedAt) : 'ჯერ არ დაუდასტურებია'),
      infoRow('dumbbell', 'სტატუსი', SESSION_STATUS[s.status] || s.status)),
    !canLog && !canChange && s.status !== 'CANCELLED' && s.status !== 'DONE' && s.status !== 'NO_SHOW'
      ? h('p', { class: 'faint', style: { fontSize: '13px' } }, s.status === 'OPEN' ? 'სლოტი უკვე დაიწყო — ცვლილება აღარ შეიძლება.' : 'შედეგის ჩაწერა ვარჯიშის დაწყებიდან შეგეძლება.')
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
  const reason = textarea({ maxlength: 300, rows: 2, placeholder: 'მაგ. დარბაზი დაკეტილია' });
  const err = h('div', { class: 'form-error', hidden: true });
  let btn;
  openModal({
    title: s.status === 'OPEN' ? 'სლოტის გაუქმება' : 'ვარჯიშის გაუქმება',
    size: 'sm',
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted' }, s.clientName ? `${s.clientName}-ს შეტყობინება მიუვა.` : 'სლოტი აღარ გამოჩნდება კლიენტებთან.'),
      s.clientName ? field('მიზეზი (არასავალდებულო)', reason) : null,
      err),
    footer: (close) => {
      btn = button('გაუქმება', { variant: 'danger', onClick: async () => {
        await busy(btn, async () => {
          try {
            await post(`${API}/sessions/${encodeURIComponent(s.id)}/cancel`, { reason: reason.value.trim() });
            toast('გაუქმდა');
            close();
            onDone?.();
          } catch (e) { err.textContent = e.message; err.hidden = false; }
        });
      } });
      return [button('არა', { variant: 'ghost', onClick: () => close() }), btn];
    },
  });
}

/* ── Meal plan editor ─────────────────────────────────── */
async function pagePlan(env, clientId) {
  const body = frame(env, { active: 'clients', title: 'კვების გეგმა', back: { href: `/coach/client/${clientId}?tab=food`, label: 'კლიენტის ბარათი' } });
  mount(body, skeleton(8));
  let d;
  try { d = await get(`${API}/clients/${encodeURIComponent(clientId)}`); } catch (e) { env.fail(body, e, () => pagePlan(env, clientId)); return; }
  const sub = h('p', null, d.client.name);
  env.root.querySelector('.page-head-text')?.appendChild(sub);
  env.ctx.setTitle(`კვების გეგმა · ${d.client.name}`);
  if (!d.link.scopes.nutrition) { mount(body, lockedCard('nutrition', d.client.name)); return; }

  const p = d.plan;
  const st = {
    title: p?.title || 'ჩემი გეგმა',
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
    { label: 'კლება', kcal: Math.round((kg * 26) / 50) * 50, protein: Math.round(kg * 2) },
    { label: 'შენარჩუნება', kcal: Math.round((kg * 31) / 50) * 50, protein: Math.round(kg * 1.8) },
    { label: 'მატება', kcal: Math.round((kg * 36) / 50) * 50, protein: Math.round(kg * 1.8) },
  ] : [];

  const title = input({ value: st.title, maxlength: 80, placeholder: 'მაგ. ჭრის ფაზა · 1900 კკალ', onInput: (e) => { st.title = e.target.value; } });
  const numIn = (key, label) => field(label, input({ value: st[key], inputmode: 'numeric', placeholder: '—', class: 'input co-num', onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); st[key] = e.target.value; paintMacro(); } }));
  const macroBox = h('div');
  const mealsBox = h('div', { class: 'stack' });
  const addBox = h('div', { class: 'chips' });
  const plannedEl = h('span', { class: 'faint' });
  const note = textarea({ value: st.note, maxlength: 1000, rows: 3, placeholder: 'მაგ. ყოველ კვებაში ცილა, 2.5 ლ წყალი, შაქრიანი სასმელი — არა', onInput: (e) => { st.note = e.target.value; } });
  const targetsRow = h('div', { class: 'co-targets' });
  const paintTargets = () => mount(targetsRow, numIn('kcal', 'კკალ / დღე'), numIn('protein', 'ცილა, გ'), numIn('carbs', 'ნახშირწყალი, გ'), numIn('fat', 'ცხიმი, გ'));

  function paintMacro() {
    const t = { calories: num(st.kcal), protein: num(st.protein), carbs: num(st.carbs), fat: num(st.fat) };
    const mk = (t.protein || 0) * 4 + (t.carbs || 0) * 4 + (t.fat || 0) * 9;
    const diff = t.calories ? Math.abs(mk - t.calories) : 0;
    mount(macroBox, mk ? [macroBar(t), t.calories ? h('p', { class: 'co-macro-check', style: { color: diff > 150 ? 'var(--warn)' : 'var(--ok)' } }, `მაკროებიდან ${fmtNum(Math.round(mk))} კკალ${diff > 150 ? ' — დღიურ კალორიას არ ემთხვევა' : ' — ემთხვევა დღიურ კალორიას'}`) : null] : null);
  }
  function paintPlanned() {
    const planned = st.meals.reduce((s, m) => s + m.items.reduce((a, i) => a + (num(i.calories) || 0), 0), 0);
    plannedEl.textContent = planned ? `მენიუში ${fmtNum(Math.round(planned))} კკალ` : '';
  }
  function paintMeals() {
    mount(mealsBox, st.meals.map((m, mi) => card({ class: 'co-meal' },
      h('div', { class: 'co-meal-head' },
        h('b', null, MEAL_SLOTS.find((x) => x.key === m.slot)?.label || m.slot),
        input({ type: 'time', value: m.time, class: 'input co-meal-time', 'aria-label': 'დრო', onInput: (e) => { m.time = e.target.value; } }),
        iconButton('x', { title: 'კვების წაშლა', onClick: () => { st.meals.splice(mi, 1); paintMeals(); } })),
      m.items.length ? h('div', { class: 'co-item-head', 'aria-hidden': 'true' }, h('span', null, 'პროდუქტი'), h('span', null, 'გ'), h('span', null, 'კკალ'), h('span')) : null,
      m.items.map((it, ii) => h('div', { class: 'co-item' },
        input({ value: it.name, placeholder: 'პროდუქტი', maxlength: 80, 'aria-label': 'პროდუქტი', onInput: (e) => { it.name = e.target.value; } }),
        input({ value: it.grams, inputmode: 'numeric', placeholder: 'გ', 'aria-label': 'გრამი', onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); it.grams = e.target.value; } }),
        input({ value: it.calories, inputmode: 'numeric', placeholder: 'კკალ', 'aria-label': 'კალორია', onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); it.calories = e.target.value; paintPlanned(); } }),
        iconButton('trash', { title: 'წაშლა', onClick: () => { m.items.splice(ii, 1); paintMeals(); } }))),
      button('პროდუქტის დამატება', { variant: 'ghost', size: 'sm', icon: 'plus', onClick: () => { m.items.push({ name: '', grams: '', calories: '' }); paintMeals(); mealsBox.querySelectorAll('.co-meal')[mi]?.querySelector('.co-item:last-of-type input')?.focus(); } }))));
    mount(addBox, MEAL_SLOTS.filter((s) => !st.meals.some((m) => m.slot === s.key)).map((s) => h('button', { type: 'button', class: 'chip', onClick: () => { st.meals.push({ slot: s.key, time: s.time, items: [] }); paintMeals(); } }, `+ ${s.label}`)));
    paintPlanned();
  }
  paintTargets();
  paintMacro();
  paintMeals();

  const err = h('div', { class: 'form-error', hidden: true });
  const save = button(p ? 'ახალი ვერსიის გაგზავნა' : 'გეგმის გაგზავნა', { icon: 'send' });
  save.addEventListener('click', async () => {
    err.hidden = true;
    const cal = num(st.kcal);
    if (!cal || cal < 800 || cal > 6000) { err.textContent = 'დღიური კალორია 800–6000 უნდა იყოს.'; err.hidden = false; return; }
    if (st.title.trim().length < 2) { err.textContent = 'დაარქვი გეგმას სახელი.'; err.hidden = false; return; }
    const payload = {
      title: st.title.trim(),
      targets: { calories: Math.round(cal), protein: num(st.protein), carbs: num(st.carbs), fat: num(st.fat) },
      meals: st.meals.map((m) => ({ slot: m.slot, time: /^\d{2}:\d{2}$/.test(m.time) ? m.time : null, items: m.items.filter((i) => String(i.name).trim()).map((i) => ({ name: String(i.name).trim(), grams: num(i.grams), calories: num(i.calories) })) })),
      note: st.note.trim(),
    };
    await busy(save, async () => {
      try {
        await post(`${API}/clients/${encodeURIComponent(clientId)}/plan`, payload);
        toast(`გეგმა გაიგზავნა — ${firstWord(d.client.name)} შეტყობინებას მიიღებს`);
        env.ctx.navigate(`/coach/client/${clientId}?tab=food`);
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
  });

  mount(body, h('div', { class: 'grid grid-main' },
    h('div', null,
      section('სამიზნეები', card({ class: 'stack' },
        field('სათაური', title),
        presets.length ? h('div', { class: 'field' }, h('span', { class: 'field-label' }, `სწრაფი დაწყება (${kg} კგ-ზე)`),
          h('div', { class: 'chips' }, presets.map((pr) => h('button', { type: 'button', class: 'chip', onClick: () => {
            st.kcal = String(pr.kcal); st.protein = String(pr.protein);
            const f = Math.round((pr.kcal * 0.27) / 9);
            st.fat = String(f); st.carbs = String(Math.max(0, Math.round((pr.kcal - pr.protein * 4 - f * 9) / 4)));
            if (!st.title || st.title === 'ჩემი გეგმა') { st.title = `${pr.label} · ${pr.kcal} კკალ`; title.value = st.title; }
            paintTargets(); paintMacro();
          } }, `${pr.label} · ${fmtNum(pr.kcal)}`))),
          h('span', { class: 'field-hint' }, 'საწყისი მიახლოება წონიდან — მორგება შენზეა.')) : null,
        targetsRow,
        macroBox)),
      section('მენიუ', h('div', { class: 'stack' }, mealsBox, addBox), { action: plannedEl })),
    h('div', { class: 'co-sticky' },
      section('რჩევა კლიენტს', card({ class: 'stack' },
        note,
        h('p', { class: 'disclaimer', style: { marginTop: 0 } }, icon('info', { size: 14 }), 'გეგმა კლიენტის პირად კვების პროგრამას არ ცვლის — დაცვა მისი დღიურიდან ითვლება. სამედიცინო მდგომარეობისას (დიაბეტი, თირკმელი, ორსულობა, კვების დარღვევა) კლიენტმა ექიმთანაც უნდა შეათანხმოს.'),
        err,
        save)),
      p ? section('მიმდინარე გეგმა', planSummary(p, null)) : null)));
}

/* ── Goal proposal ────────────────────────────────────── */
async function pageGoal(env, clientId) {
  const body = frame(env, { active: 'clients', title: 'მიზნის შეთავაზება', back: { href: `/coach/client/${clientId}?tab=weight`, label: 'კლიენტის ბარათი' } });
  mount(body, skeleton(6));
  let d;
  try { d = await get(`${API}/clients/${encodeURIComponent(clientId)}`); } catch (e) { env.fail(body, e, () => pageGoal(env, clientId)); return; }
  env.root.querySelector('.page-head-text')?.appendChild(h('p', null, `${d.client.name} — კლიენტი მიიღებს შეტყობინებას და თავად დაადასტურებს`));
  env.ctx.setTitle(`მიზანი · ${d.client.name}`);
  if (!d.link.scopes.weight) { mount(body, lockedCard('weight', d.client.name)); return; }

  const current = d.weight?.currentKg ?? null;
  const st = { type: 'lose', weeks: 12 };
  const target = input({ inputmode: 'decimal', class: 'input co-big-input', placeholder: '72', value: d.weight?.goal ? String(d.weight.goal.targetKg) : current ? String(Math.round(current * 0.93)) : '' });
  const note = textarea({ maxlength: 300, rows: 2, placeholder: 'მაგ. რეალისტური და მდგრადი ტემპი — ერთად გავაკეთებთ' });
  const typeBox = h('div', { class: 'chips' });
  const weeksBox = h('div', { class: 'chips' });
  const calc = h('div');
  const err = h('div', { class: 'form-error', hidden: true });
  const paint = () => {
    mount(typeBox, Object.entries(GOAL_TYPE).map(([k, l]) => h('button', { type: 'button', class: `chip ${st.type === k ? 'on' : ''}`, onClick: () => { st.type = k; paint(); } }, l)));
    mount(weeksBox, [4, 8, 12, 16, 24].map((wk) => h('button', { type: 'button', class: `chip ${st.weeks === wk ? 'on' : ''}`, onClick: () => { st.weeks = wk; paint(); } }, `${wk} კვირა`)));
    const t = num(target.value);
    const pace = current && t ? Math.abs(current - t) / st.weeks : null;
    const pct = current && pace ? (pace / current) * 100 : null;
    const unsafe = pct != null && ((st.type === 'lose' && pct > 1) || (st.type === 'gain' && pace > 0.5));
    const deadline = addDays(new Date(), st.weeks * 7);
    mount(calc,
      h('div', { class: 'grid grid-3' },
        card(stat('ტემპი', pace != null ? fmtNum(pace, 2) : '—', { unit: 'კგ / კვირა' })),
        card(stat('სხეულის წონის', pct != null ? `${fmtNum(pct, 1)}%` : '—', { delta: 'კვირაში' })),
        card(stat('ვადა', fmtDate(deadline, { year: true })))),
      unsafe ? h('div', { class: 'co-note co-note-warn', style: { marginTop: '12px' } }, icon('alert', { size: 16 }), st.type === 'lose'
        ? 'კვირაში სხეულის წონის 1%-ზე მეტი კლება ზედმეტად სწრაფია — კუნთის დაკარგვისა და დაბრუნების რისკია. გაზარდე ვადა.'
        : 'კვირაში 0.5 კგ-ზე მეტი მატება ძირითადად ცხიმია. გაზარდე ვადა.') : null);
  };
  target.addEventListener('input', () => { target.value = target.value.replace(/[^\d.,]/g, '').slice(0, 5); paint(); });
  paint();
  const send = button('შეთავაზება კლიენტს', { icon: 'send' });
  send.addEventListener('click', async () => {
    err.hidden = true;
    const t = num(target.value);
    if (!t || t < 30 || t > 300) { err.textContent = 'მიუთითე წონა 30–300 კგ.'; err.hidden = false; return; }
    await busy(send, async () => {
      try {
        await post(`${API}/clients/${encodeURIComponent(clientId)}/goal`, { type: st.type, targetKg: Math.round(t * 10) / 10, deadlineYmd: ymd(addDays(new Date(), st.weeks * 7)), note: note.value.trim() });
        toast('შეთავაზება გაიგზავნა — კლიენტი თავად დაადასტურებს');
        env.ctx.navigate(`/coach/client/${clientId}?tab=weight`);
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
  });
  mount(body, h('div', { class: 'grid grid-main' },
    section('მიზანი', card({ class: 'stack' },
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'მიზნის ტიპი'), typeBox),
      field(`სამიზნე წონა, კგ${current ? ` (ახლა ${current})` : ''}`, target),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'ვადა'), weeksBox),
      calc,
      field('შეტყობინება კლიენტს (არასავალდებულო)', note),
      err,
      h('div', null, send))),
    h('div', null,
      d.weight ? section('წონა ახლა', card(weightChart(d.weight, 200))) : null,
      d.link.proposedGoal ? section('წინა შეთავაზება', card({ class: 'co-note' }, `${GOAL_TYPE[d.link.proposedGoal.type] || ''} → ${d.link.proposedGoal.targetKg} კგ, ${fmtDate(d.link.proposedGoal.deadlineYmd, { year: true })} — ჯერ არ დაუდასტურებია. ახალი შეთავაზება ძველს ჩაანაცვლებს.`)) : null)));
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
    title: 'პროფილი',
    sub: 'ასე გხედავენ კლიენტები',
    actions: [button('პროფილის რედაქტირება', { icon: 'edit', onClick: () => openProfileEditor(env, p, reload) })],
  });
  const catalog = await env.catalog();
  mount(body, h('div', { class: 'grid grid-main' },
    h('div', null,
      section(null, publicCard(p, catalog)),
      section('სერტიფიკატები', certificatesCard(p, reload), { action: p.certificates.length < 8 ? button('დამატება', { variant: 'ghost', size: 'sm', icon: 'plus', onClick: () => openCertificateForm(reload) }) : null }),
      section('კონფიდენციალობა', card(h('div', { class: 'hstack', style: { alignItems: 'flex-start' } }, tile('shield', 'teal', 38),
        h('p', { class: 'muted', style: { flex: 1 } }, 'კლიენტის მონაცემს ხედავ მხოლოდ მისი თანხმობით და მხოლოდ კავშირის განმავლობაში. გაზიარება კლიენტს ნებისმიერ წამს შეუძლია შეწყვიტოს. მონაცემის აპის გარეთ გადაღება/გადაგზავნა კლიენტის ნებართვის გარეშე არ შეიძლება.'))))),
    h('div', null,
      p.code ? section('ჩემი QR და კოდი', qrCard(p)) : null,
      section('როგორ შემოგიერთდება კლიენტი', card(h('ol', { class: 'co-steps' },
        h('li', null, 'კლიენტი MEDICARD აპში გახსნის „ჩემი ტრენერი“-ს და დაასკანერებს შენს QR-ს ან შეიყვანს კოდს.'),
        h('li', null, 'თანხმობის ეკრანზე თავად აირჩევს, რას გაგიზიაროს: ვარჯიშები, კვება, წონა, ფოტოები.'),
        h('li', null, 'ან პირიქით: ჩასვი მისი პირადი QR-ის ბმული „კლიენტის მოწვევაში“ — მოწვევას თავად მიიღებს.')),
      button('კლიენტის მოწვევა', { variant: 'secondary', icon: 'userPlus', onClick: () => openInvite(env) }))))));
}

function publicCard(p, catalog) {
  const spec = (k) => catalog?.specialties?.find((s) => s.key === k)?.label || {
    weight_loss: 'წონის კლება', muscle: 'კუნთის მატება', strength: 'ძალა', functional: 'ფუნქციური ვარჯიში', crossfit: 'კროსფიტი', cardio: 'კარდიო / გამძლეობა',
    mobility: 'მოქნილობა და მობილობა', rehab: 'რეაბილიტაცია და ტრავმის შემდეგ', boxing: 'ბოქსი / საბრძოლო', yoga: 'იოგა / პილატესი', women: 'ქალის ფიტნესი',
    seniors: 'ხანდაზმულები', nutrition: 'კვების დაგეგმვა', sport: 'სპორტული მომზადება',
  }[k] || k;
  const verified = p.status === 'VERIFIED';
  return card({ class: 'co-public pad-lg' },
    h('div', { class: 'co-public-top' },
      avatarEl(p.displayName, null, 84, { verified }),
      h('div', { class: 'row-main' },
        h('h2', null, p.displayName),
        h('div', { class: 'hstack', style: { marginTop: '6px' } },
          badge(verified ? 'დადასტურებული ტრენერი' : p.status === 'PENDING' ? 'განაცხადი განიხილება' : p.status === 'REJECTED' ? 'უარყოფილი' : 'შეჩერებული', verified ? 'brand' : p.status === 'PENDING' ? 'warn' : 'neutral'),
          p.experienceYears ? badge(`${p.experienceYears} წლის გამოცდილება`) : null,
          p.instagram ? h('a', { class: 'link', href: `https://instagram.com/${encodeURIComponent(p.instagram)}`, target: '_blank', rel: 'noopener' }, `@${p.instagram}`) : null))),
    p.bio ? h('p', { class: 'co-bio' }, p.bio) : h('p', { class: 'faint' }, 'ბიოგრაფია ჯერ არ არის.'),
    p.specialties.length ? h('div', { class: 'chips' }, p.specialties.map((k) => h('span', { class: 'chip co-chip-static' }, spec(k)))) : null,
    p.gyms.length ? h('div', { class: 'list' }, p.gyms.map((g) => h('div', { class: 'row' }, tile('mapPin', 'teal', 34),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, `${g.brand} · ${g.name}`), h('div', { class: 'row-sub' }, [g.city, g.address].filter(Boolean).join(', ')))))) : null);
}

function certificatesCard(p, onChanged) {
  if (!p.certificates.length) {
    return card(h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'სერტიფიკატი ჯერ არ დაგიმატებია. ადმინი სერტიფიკატის ფოტოს ამოწმებს — კლიენტები მხოლოდ სათაურს, გამცემს და წელს ხედავენ.'),
      onChanged ? button('სერტიფიკატის დამატება', { variant: 'secondary', icon: 'award', onClick: () => openCertificateForm(onChanged) }) : null));
  }
  return card(h('div', { class: 'list' }, p.certificates.map((c) => h('div', { class: 'row' }, tile('award', 'amber', 36),
    h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, c.title), h('div', { class: 'row-sub' }, [c.issuer, c.year].filter(Boolean).join(' · ') || '—')),
    h('div', { class: 'row-trail' },
      iconButton('eye', { title: 'ფაილის ნახვა', onClick: () => viewCertificate(c) }),
      onChanged ? iconButton('trash', { title: 'წაშლა', onClick: async () => {
        if (!(await confirmDialog({ title: 'სერტიფიკატის წაშლა', body: `„${c.title}“ წაიშლება პროფილიდან.`, confirm: 'წაშლა', danger: true }))) return;
        try { await del(`/api/trainer/certificates/${encodeURIComponent(c.id)}`); toast('წაიშალა'); onChanged(); } catch (e) { toast(e.message, 'error'); }
      } }) : null)))));
}

async function viewCertificate(c) {
  const img = h('img', { alt: c.title, class: 'co-cert-img' });
  const m = openModal({ title: c.title, size: 'lg', body: h('div', { class: 'co-cert-view' }, img) });
  const src = await authedBlobUrl(`/api/trainer/certificates/${encodeURIComponent(c.id)}/file`).catch(() => null);
  if (src) img.src = src;
  else mount(m.el.querySelector('.modal-body'), errorBox(new Error('ფაილი ვერ ჩაიტვირთა.')));
}

function openCertificateForm(onDone) {
  const title = input({ name: 'title', maxlength: 120, required: true, placeholder: 'მაგ. NASM Certified Personal Trainer' });
  const issuer = input({ name: 'issuer', maxlength: 120, placeholder: 'მაგ. NASM' });
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
    title: 'სერტიფიკატის დამატება',
    size: 'md',
    body: h('div', { class: 'form' },
      field('სათაური', title),
      h('div', { class: 'form-row' }, field('გამცემი', issuer), field('წელი', year)),
      h('label', { class: 'dropzone co-drop' }, icon('upload', { size: 22 }), h('span', null, 'სერტიფიკატის ფოტო (JPEG, PNG, WEBP · 15 MB-მდე)'), file),
      preview,
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, 'ფოტო პრივატულია — მას მხოლოდ შენ და MEDICARD-ის ადმინისტრაცია ხედავთ. EXIF/GPS მონაცემები იშლება.'),
      err),
    footer: (close) => {
      btn = button('ატვირთვა', { icon: 'upload', onClick: async () => {
        err.hidden = true;
        if (title.value.trim().length < 2) { err.textContent = 'მიუთითე სერტიფიკატის სათაური.'; err.hidden = false; return; }
        const f = file.files?.[0];
        if (!f) { err.textContent = 'აირჩიე სერტიფიკატის ფოტო.'; err.hidden = false; return; }
        if (f.size > 15 * 1024 * 1024) { err.textContent = 'ფაილი 15 MB-ზე დიდია.'; err.hidden = false; return; }
        const fd = new FormData();
        fd.append('title', title.value.trim());
        fd.append('issuer', issuer.value.trim());
        if (year.value) fd.append('year', year.value);
        fd.append('file', f, f.name);
        await busy(btn, async () => {
          try {
            await post('/api/trainer/certificates', fd, { timeoutMs: 90_000 });
            toast('სერტიფიკატი დაემატა');
            close();
            onDone?.();
          } catch (e) { err.textContent = e.message; err.hidden = false; }
        });
      } });
      return [button('გაუქმება', { variant: 'ghost', onClick: () => close() }), btn];
    },
  });
}

/** Edits the trainer application (POST /api/trainer/apply). A REJECTED profile is re-submitted for review. */
async function openProfileEditor(env, p, onSaved) {
  const catalog = await env.catalog();
  const specialties = catalog?.specialties || [];
  const st = { specialties: [...p.specialties], gyms: [...p.gyms] };
  const name = input({ value: p.displayName, maxlength: 60, required: true });
  const bio = textarea({ value: p.bio || '', maxlength: 800, rows: 4, placeholder: 'ვისთან მუშაობ, რა მიდგომა გაქვს, პირველი შეხვედრა… ფასი, თუ გინდა — თავისუფალი ტექსტით.' });
  const exp = input({ type: 'number', min: 0, max: 60, value: p.experienceYears ?? '', placeholder: 'მაგ. 5' });
  const insta = input({ value: p.instagram ? `@${p.instagram}` : '', maxlength: 31, placeholder: '@username' });
  const specBox = h('div', { class: 'chips' });
  const gymSel = h('div', { class: 'chips' });
  const gymSearch = input({ type: 'search', placeholder: 'მოძებნე დარბაზი (მაგ. Oktopus, ვაკე)', autocomplete: 'off' });
  const gymResults = h('div', { class: 'co-gym-results' });
  const paintSpec = () => mount(specBox, specialties.map((s) => {
    const on = st.specialties.includes(s.key);
    return h('button', { type: 'button', class: `chip ${on ? 'on' : ''}`, 'aria-pressed': on ? 'true' : 'false', onClick: () => {
      if (on) st.specialties = st.specialties.filter((k) => k !== s.key);
      else if (st.specialties.length < 6) st.specialties.push(s.key);
      else toast('მაქსიმუმ 6 სპეციალიზაცია', 'info');
      paintSpec();
    } }, s.label);
  }));
  const paintGyms = () => mount(gymSel, st.gyms.length ? st.gyms.map((g) => h('span', { class: 'chip on co-chip-x' }, `${g.brand} · ${g.name}`,
    h('button', { type: 'button', 'aria-label': `${g.brand} ${g.name} — წაშლა`, onClick: () => { st.gyms = st.gyms.filter((x) => x.id !== g.id); paintGyms(); } }, icon('x', { size: 13 }))))
    : h('span', { class: 'faint' }, 'დარბაზი არ არის არჩეული'));
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
          if (st.gyms.length >= 5) { toast('მაქსიმუმ 5 დარბაზი', 'info'); return; }
          st.gyms.push(g); paintGyms(); gymSearch.value = ''; clear(gymResults);
        } }, icon(picked ? 'check' : 'mapPin', { size: 15 }), h('span', null, h('b', null, `${g.brand} · ${g.name}`), h('small', null, [g.city, g.address].filter(Boolean).join(', '))));
      }) : h('div', { class: 'faint', style: { padding: '8px' } }, 'ვერ მოიძებნა. დარბაზის დამატება აპიდან შეგიძლია („ჩემი დარბაზი სიაში არ არის“).'));
    } catch { if (my === seq) mount(gymResults, h('div', { class: 'faint', style: { padding: '8px' } }, 'ძებნა ვერ მოხერხდა.')); }
  }, 300);
  gymSearch.addEventListener('input', search);
  paintSpec();
  paintGyms();
  const err = h('div', { class: 'form-error', hidden: true });
  let btn;
  const resubmit = p.status === 'REJECTED';
  openModal({
    title: resubmit ? 'განაცხადის შესწორება' : 'ტრენერის პროფილი',
    size: 'lg',
    body: h('div', { class: 'form' },
      h('div', { class: 'form-row' }, field('სახელი (ხედავენ კლიენტები)', name), field('გამოცდილება, წელი', exp)),
      field('ჩემ შესახებ', bio, 'მაქს. 800 სიმბოლო. ფასები, თუ გინდა, თავისუფალი ტექსტით — აპში გადახდა არ ხდება.'),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, `სპეციალიზაცია · ${st.specialties.length}/6`), specBox),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'დარბაზები (მაქს. 5)'), gymSel, gymSearch, gymResults),
      field('Instagram (არასავალდებულო)', insta),
      resubmit ? h('p', { class: 'co-note co-note-warn' }, 'შენახვის შემდეგ განაცხადი ხელახლა წავა განსახილველად.') : null,
      err),
    footer: (close) => {
      btn = button(resubmit ? 'ხელახლა გაგზავნა' : 'შენახვა', { icon: 'check', onClick: async () => {
        err.hidden = true;
        if (name.value.trim().length < 2) { err.textContent = 'სახელი ძალიან მოკლეა.'; err.hidden = false; return; }
        if (!st.gyms.length) { err.textContent = 'აირჩიე მინიმუმ ერთი დარბაზი.'; err.hidden = false; return; }
        const ig = insta.value.trim().replace(/^@/, '');
        if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) { err.textContent = 'Instagram-ის სახელი არასწორია.'; err.hidden = false; return; }
        const years = exp.value === '' ? null : Number(exp.value);
        if (years != null && (!Number.isInteger(years) || years < 0 || years > 60)) { err.textContent = 'გამოცდილება 0–60 წელი.'; err.hidden = false; return; }
        await busy(btn, async () => {
          try {
            await post('/api/trainer/apply', { displayName: name.value.trim(), bio: bio.value.trim(), specialties: st.specialties, experienceYears: years, instagram: ig, gymIds: st.gyms.map((g) => g.id) });
            toast(resubmit ? 'განაცხადი ხელახლა გაიგზავნა' : 'პროფილი განახლდა');
            close();
            onSaved?.();
          } catch (e) { err.textContent = e.message; err.hidden = false; }
        });
      } });
      return [button('გაუქმება', { variant: 'ghost', onClick: () => close() }), btn];
    },
  });
}

function qrCard(p) {
  const qr = qrSvg(p.link, 208);
  return card({ class: 'spotlight hero-card co-qr' },
    qr ? h('div', { class: 'co-qr-box' }, qr) : null,
    h('div', { class: 'co-qr-code', 'aria-label': `კოდი ${p.code.split('').join(' ')}` }, p.code),
    h('div', { class: 'co-qr-link' }, p.link),
    h('p', { class: 'muted', style: { textAlign: 'center' } }, 'კლიენტი QR-ს დაასკანერებს „ჩემი ტრენერი“-დან (ან ტელეფონის კამერით), ან კოდს შეიყვანს. რას გაგიზიაროს, თავად აირჩევს.'),
    h('div', { class: 'co-qr-actions' },
      button('ბმულის კოპირება', { variant: 'light', size: 'sm', icon: 'link', onClick: () => copyText(p.link, 'ბმული დაკოპირდა') }),
      button('მოწვევის ტექსტი', { variant: 'light', size: 'sm', icon: 'copy', onClick: () => copyText(INVITE_TEXT(p.code), 'მოწვევის ტექსტი დაკოპირდა') }),
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
  const svg = el('svg', { viewBox: `0 0 ${total} ${total}`, width: size, height: size, role: 'img', 'aria-label': 'QR კოდი', 'shape-rendering': 'crispEdges' });
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
  if (/\/c\/[A-Za-z0-9]{6}(?:[/?#]|$)/.test(s) || /^[A-Za-z0-9]{6}$/.test(s)) return { error: 'ეს ტრენერის კოდია. საჭიროა კლიენტის პირადი QR (აპში: პროფილი → ჩემი QR).' };
  return { error: 'ეს MEDICARD-ის პროფილის QR კოდი არ არის. ჩასვი ბმული https://medicard.ge/u/… ან QR-ის ტექსტი.' };
}

function openInvite(env, opts = {}) {
  const inp = input({ placeholder: 'https://medicard.ge/u/…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'კლიენტის პირადი QR-ის ბმული' });
  const note = input({ maxlength: 300, placeholder: 'მაგ. დღეს დარბაზში რომ ვისაუბრეთ — ნინო' });
  const err = h('div', { class: 'form-error', hidden: true });
  const result = h('div');
  let preview = null;
  let checkBtn;
  const showErr = (msg) => { err.textContent = msg; err.hidden = false; };

  const renderPreview = (close, sent) => {
    const p = preview;
    const status = sent || (p.link ? (p.link.status === 'ACTIVE' ? 'ACTIVE' : p.link.initiator === 'TRAINER' ? 'REQUESTED' : null) : null);
    const inviteBtn = button(p.link ? 'მოთხოვნის დადასტურება' : 'კლიენტად მოწვევა', { icon: 'userPlus' });
    inviteBtn.addEventListener('click', () => busy(inviteBtn, async () => {
      err.hidden = true;
      try {
        const r = await post(`${API}/invite`, { token: p.token, note: note.value.trim() });
        toast(r.status === 'ACTIVE' ? `${firstWord(p.user.name)} შემოგიერთდა` : 'მოწვევა გაიგზავნა');
        renderPreview(close, r.status);
        opts.onDone?.(r);
      } catch (e) { showErr(e.message); }
    }));
    mount(result, card({ class: 'co-inv' },
      h('div', { class: 'hstack' }, avatarEl(p.user.name, p.user.avatarUrl, 56),
        h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, p.user.name), h('div', { class: 'card-sub' }, personLine(p.user) || 'MEDICARD მომხმარებელი'))),
      status === 'ACTIVE'
        ? h('div', { class: 'stack' }, h('div', { class: 'co-inline ok' }, icon('check', { size: 16 }), sent ? 'შემოგიერთდა — მისი მოთხოვნა დადასტურდა.' : 'უკვე შენი კლიენტია.'),
          button('კლიენტის გახსნა', { onClick: () => { close(); env.ctx.navigate(`/coach/client/${p.user.id}`); } }))
        : status === 'REQUESTED'
          ? h('p', { class: 'muted' }, `მოწვევა გაიგზავნა. ${firstWord(p.user.name)} ნახავს შეტყობინებას და თავად აირჩევს, რას გაგიზიაროს.`)
          : p.hasOtherTrainer
            ? h('p', { class: 'co-inline danger' }, icon('alert', { size: 16 }), 'ამ ადამიანს უკვე ჰყავს სხვა ტრენერი MEDICARD-ში.')
            : h('div', { class: 'stack' },
              h('p', { class: 'faint', style: { fontSize: '13px' } }, 'ჯანმრთელობის მონაცემი არ ჩანს, სანამ კლიენტი მოწვევას არ მიიღებს და არ აირჩევს, რას გაგიზიაროს.'),
              p.link ? null : field('შეტყობინება (არასავალდებულო)', note),
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
    title: 'კლიენტის მოწვევა',
    size: 'md',
    body: (close) => h('form', { class: 'form', novalidate: true, onSubmit: (e) => { e.preventDefault(); check(close); } },
      h('p', { class: 'muted' }, 'აპში ტრენერი კლიენტის QR-ს ასკანერებს. ვებზე სთხოვე კლიენტს, გამოგიგზავნოს თავისი პირადი QR-ის ბმული (აპში: პროფილი → ჩემი QR) და ჩასვი აქ.'),
      field('კლიენტის QR ბმული ან კოდის ტექსტი', inp, 'მაგ. https://medicard.ge/u/Ab12… — ეს არ არის ტრენერის 6-ნიშნა კოდი'),
      err,
      result,
      env.profile.code ? h('div', { class: 'co-inv-alt' }, icon('info', { size: 15 }), h('span', null, `ან პირიქით: გაუზიარე შენი კოდი ${env.profile.code} — კლიენტი თავად შემოგიერთდება.`),
        h('button', { type: 'button', class: 'link', onClick: () => copyText(INVITE_TEXT(env.profile.code), 'მოწვევის ტექსტი დაკოპირდა') }, 'კოპირება')) : null,
      h('button', { type: 'submit', hidden: true })),
    footer: (close) => {
      checkBtn = button('შემოწმება', { icon: 'search', onClick: () => check(close) });
      return [button('დახურვა', { variant: 'ghost', onClick: () => close() }), checkBtn];
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
  const details = textarea({ maxlength: 1000, rows: 3, placeholder: 'მოკლედ აღწერე' });
  const err = h('div', { class: 'form-error', hidden: true });
  let btn;
  openModal({
    title: 'შეტყობინება დარღვევაზე',
    size: 'md',
    body: h('div', { class: 'form' },
      h('p', { class: 'muted' }, client.name),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'რა მოხდა?'), reasons),
      field('დეტალები (არასავალდებულო)', details, 'არ ჩაწერო ჯანმრთელობის ან სხვისი პირადი მონაცემები.'),
      h('div', { class: 'between co-toggle-row' }, h('div', null, h('b', null, 'კავშირის დასრულება'), h('div', { class: 'faint', style: { fontSize: '12.5px' } }, 'კლიენტთან კავშირი მაშინვე შეწყდება.')), toggle(block, (v) => { block = v; })),
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, 'შეტყობინებას MEDICARD-ის გუნდი განიხილავს.'),
      err),
    footer: (close) => {
      btn = button('გაგზავნა', { icon: 'send', onClick: async () => {
        err.hidden = true;
        if (!reason) { err.textContent = 'აირჩიე მიზეზი.'; err.hidden = false; return; }
        await busy(btn, async () => {
          try {
            await post('/api/trainer/report', { subjectId: client.id, reason, details: details.value.trim(), block });
            toast(block ? 'შეტყობინება მივიღეთ და კავშირი შეწყდა' : 'შეტყობინება მივიღეთ. MEDICARD-ის გუნდი განიხილავს.');
            close();
            if (block) onBlocked?.();
          } catch (e) { err.textContent = e.message; err.hidden = false; }
        });
      } });
      return [button('გაუქმება', { variant: 'ghost', onClick: () => close() }), btn];
    },
  });
}
