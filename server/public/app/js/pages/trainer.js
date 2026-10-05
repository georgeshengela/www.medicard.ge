// MEDICARD web — MEDICOACH, client side (/trainer, /trainer/:section, /trainer/:section/:id) + Home card.
// Same endpoints and rules as the app (mobile/app/trainer/**, mobile/src/components/coach/**):
//   GET  /api/trainer/me | /overview | /catalog | /gyms | /search | /card/:id | /code/:code | /session/:id | /photos
//   POST /api/trainer/link | /link/accept | /link/goal | /report | /apply | /certificates | /gyms | /photos
//        /api/trainer/sessions/:id/confirm|cancel|book|rate
//   PATCH/DELETE /api/trainer/link, DELETE /api/trainer/photos/:id | /certificates/:id
// Consent first: nothing is shared until the person switches a category on (DEFAULT_SCOPES all false) and every
// link sends the current consentVersion. Adherence to the trainer's meal plan is computed by the server from the
// person's own diary — the plan never overwrites their nutrition program. The trainer workspace is /coach.
import {
  h, mount, icon, tile, pageHead, section, card, button, iconButton, busy, badge, stat, empty, skeleton, errorBox,
  progress, segmented, field, input, textarea, toggle, toast, openModal, confirmDialog, formModal, row, debounce,
  fmtDate, fmtNum,
} from '../ui.js';
import { get, post, put, patch, del, authedBlobUrl, ApiError } from '../api.js';
import { lineChart, barChart, ring } from '../charts.js';
import { session, loadSession } from '../session.js';
import { t, plural } from '../i18n.js';
import { wordmark } from '../brand.js';

const CSS = '/app/css/trainer.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

const APP_STORE = 'https://apps.apple.com/app/id6812517519';

/* ── Copy (mobile/src/lib/coach.ts) ─────────────────────── */
const SCOPES = ['workouts', 'nutrition', 'weight', 'photos'];
const SCOPE_COPY = {
  workouts: { title: t('ვარჯიშები და აქტივობა', 'Workouts and activity'), body: t('ნაბიჯები, აქტიური წუთები, პულსი, ძილი და ვარჯიშები Apple Health / Health Connect-იდან.', 'Steps, active minutes, heart rate, sleep and workouts from Apple Health / Health Connect.'), icon: 'activity', ink: 'green' },
  nutrition: { title: t('კვება', 'Nutrition'), body: t('კვების დღიური, კალორიები, მაკროები და ტრენერის გეგმის დაცვა.', 'Food diary, calories, macros and how well you follow the trainer’s plan.'), icon: 'utensils', ink: 'amber' },
  weight: { title: t('წონა და მიზანი', 'Weight and goal'), body: t('აწონვები, წონის მიზანი და პროგრესი.', 'Weigh-ins, weight goal and progress.'), icon: 'scale', ink: 'blue' },
  photos: { title: t('პროგრეს-ფოტოები', 'Progress photos'), body: t('შენი „მანამდე / შემდეგ“ ფოტოები. ნაგულისხმევად გამორთულია.', 'Your before / after photos. Off by default.'), icon: 'camera', ink: 'violet' },
};
const ALWAYS_SEEN = [t('სახელი', 'Name'), t('ფოტო', 'Photo'), t('ასაკი', 'Age'), t('სქესი', 'Sex'), t('სიმაღლე', 'Height'), t('ვარჯიშების განრიგი', 'Session schedule')];
const ALWAYS_TEXT = t('ტრენერი ყოველთვის ხედავს: შენს სახელს, ფოტოს, ასაკს, სქესს, სიმაღლეს და ვარჯიშების განრიგს. ქვემოთ აირჩიე, კიდევ რა გაუზიარო — ყველაფერი გამორთულია, სანამ შენ არ ჩართავ. ჯანმრთელობის მონაცემი განსაკუთრებული კატეგორიაა: გაზიარება ნებაყოფლობითია და ნებისმიერ დროს შეწყდება.', 'A trainer always sees: your name, photo, age, sex, height and your session schedule. Below, choose what else to share — everything is off until you turn it on. Health data is a special category: sharing is voluntary and can be stopped at any time.');
const NEVER_TEXT = t('ტრენერი ვერ ხედავს: სამედიცინო ჩანაწერებს, ანალიზებს, წამლებს, ციკლს, Medi-სთან საუბრებს. ტრენერები დამოუკიდებელი პროფესიონალები არიან; MEDICARD მათ სერტიფიკატებს ამოწმებს.', 'A trainer can’t see: medical records, lab results, medications, your cycle, or your conversations with Medi. Trainers are independent professionals; MEDICARD checks their certificates.');
const DAY_STATUS_LABEL = { ON: t('გეგმაში', 'On plan'), OVER: t('გადააჭარბა', 'Over'), UNDER: t('ცოტა ჭამა', 'Under'), LOW_PROTEIN: t('ცილა აკლდა', 'Low protein'), PENDING: t('მიმდინარე', 'In progress'), NONE: t('არ ჩაწერა', 'Not logged') };
const DAY_STATUS_TONE = { ON: 'ok', OVER: 'danger', UNDER: 'warn', LOW_PROTEIN: 'warn', PENDING: 'brand', NONE: 'none' };
const SESSION_STATUS_LABEL = { OPEN: t('თავისუფალი', 'Open'), SCHEDULED: t('დაგეგმილი', 'Scheduled'), CANCELLED: t('გაუქმდა', 'Cancelled'), DONE: t('ჩატარდა', 'Done'), NO_SHOW: t('არ მოვიდა', 'No-show') };
const POSE_LABEL = { FRONT: t('წინიდან', 'Front'), SIDE: t('გვერდიდან', 'Side'), BACK: t('ზურგიდან', 'Back'), OTHER: t('სხვა', 'Other') };
const GOAL_TYPE_LABEL = { lose: t('წონის კლება', 'Lose weight'), gain: t('წონის მატება', 'Gain weight'), recomp: t('რეკომპოზიცია', 'Recomposition'), performance: t('ფორმა და ძალა', 'Fitness and strength') };
const SLOT_KA = { breakfast: t('საუზმე', 'Breakfast'), snack1: t('წახემსება', 'Snack'), lunch: t('სადილი', 'Lunch'), snack2: t('მეორე წახემსება', 'Second snack'), dinner: t('ვახშამი', 'Dinner'), preworkout: t('ვარჯიშამდე', 'Pre-workout'), postworkout: t('ვარჯიშის შემდეგ', 'Post-workout') };
const REASONS = [
  { key: 'harassment', label: t('შეურაცხყოფა ან შევიწროება', 'Abuse or harassment') },
  { key: 'inappropriate', label: t('შეუფერებელი შინაარსი ან ფოტო', 'Inappropriate content or photo') },
  { key: 'unsafe', label: t('სახიფათო ან არაპროფესიული რჩევა', 'Unsafe or unprofessional advice') },
  { key: 'spam', label: t('სპამი ან რეკლამა', 'Spam or advertising') },
  { key: 'impersonation', label: t('ყალბი პროფილი ან სერტიფიკატი', 'Fake profile or certificate') },
  { key: 'other', label: t('სხვა', 'Other') },
];
const WORKOUT_KIND_KA = {
  traditionalStrengthTraining: t('ძალოვანი ვარჯიში', 'Strength training'), functionalStrengthTraining: t('ფუნქციური ვარჯიში', 'Functional training'), highIntensityIntervalTraining: 'HIIT',
  running: t('სირბილი', 'Running'), walking: t('სიარული', 'Walking'), cycling: t('ველოსიპედი', 'Cycling'), swimming: t('ცურვა', 'Swimming'), yoga: t('იოგა', 'Yoga'), pilates: t('პილატესი', 'Pilates'), boxing: t('ბოქსი', 'Boxing'),
  crossTraining: t('კროს-ტრენინგი', 'Cross-training'), elliptical: t('ელიფსური', 'Elliptical'), rowing: t('ნიჩბოსნობა', 'Rowing'), coreTraining: t('კორი', 'Core'), flexibility: t('მოქნილობა', 'Flexibility'), mixedCardio: t('კარდიო', 'Cardio'),
  stairClimbing: t('კიბეები', 'Stairs'), other: t('ვარჯიში', 'Workout'),
};
const workoutKindLabel = (k) => WORKOUT_KIND_KA[k] || WORKOUT_KIND_KA[String(k || '').replace(/^EXERCISE_TYPE_/, '').toLowerCase()] || t('ვარჯიში', 'Workout');

/* ── Tbilisi time (sessions are stored as instants and shown in Georgia's time, like the app) ── */
const TZ = 4 * 3600000;
const WEEKDAY_SHORT = [t('კვი', 'Sun'), t('ორშ', 'Mon'), t('სამ', 'Tue'), t('ოთხ', 'Wed'), t('ხუთ', 'Thu'), t('პარ', 'Fri'), t('შაბ', 'Sat')];
const MONTH_SHORT = [t('იან', 'Jan'), t('თებ', 'Feb'), t('მარ', 'Mar'), t('აპრ', 'Apr'), t('მაი', 'May'), t('ივნ', 'Jun'), t('ივლ', 'Jul'), t('აგვ', 'Aug'), t('სექ', 'Sep'), t('ოქტ', 'Oct'), t('ნოე', 'Nov'), t('დეკ', 'Dec')];
const tbYmd = (d = new Date()) => new Date(new Date(d).getTime() + TZ).toISOString().slice(0, 10);
const addYmd = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
function clockOf(iso) {
  const trn = new Date(new Date(iso).getTime() + TZ);
  return `${String(trn.getUTCHours()).padStart(2, '0')}:${String(trn.getUTCMinutes()).padStart(2, '0')}`;
}
function dayLabel(ymd, today = tbYmd()) {
  if (ymd === today) return t('დღეს', 'Today');
  if (ymd === addYmd(today, 1)) return t('ხვალ', 'Tomorrow');
  if (ymd === addYmd(today, -1)) return t('გუშინ', 'Yesterday');
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${WEEKDAY_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}
const shortYmd = (ymd) => { const d = new Date(`${ymd}T12:00:00Z`); return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`; };
function relativeStart(iso, now = Date.now()) {
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  if (mins <= 0) return t('მიმდინარეობს', 'In progress');
  if (mins < 60) return t(`${mins} წუთში`, `in ${mins} min`);
  if (mins < 6 * 60) return t(`${Math.round(mins / 60)} საათში`, `in ${plural(Math.round(mins / 60), 'hour')}`);
  return `${dayLabel(tbYmd(iso), tbYmd(new Date(now)))} ${clockOf(iso)}`;
}
const isLate = (iso) => new Date(iso).getTime() - Date.now() < 12 * 3600000;

export function normalizeCoachCode(raw) {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code) ? code : null;
}
const hasVerifiedPhone = (user) => String(user?.phone ?? '').replace(/\D/g, '').length >= 9;
const gymLine = (g) => `${g.brand} · ${g.name}`;
const enc = encodeURIComponent;

/* ── API (same surface as mobile api.coach) ─────────────── */
const A = {
  me: () => get('/api/trainer/me'),
  overview: () => get('/api/trainer/overview'),
  catalog: () => get('/api/trainer/catalog'),
  gyms: (q = '', city = '') => get('/api/trainer/gyms', { q, city }),
  search: (q = '', gymId = '') => get('/api/trainer/search', { q, gymId }),
  card: (id) => get(`/api/trainer/card/${enc(id)}`),
  byCode: (code) => get(`/api/trainer/code/${enc(code)}`),
  session: (id) => get(`/api/trainer/session/${enc(id)}`),
  confirm: (id) => post(`/api/trainer/sessions/${enc(id)}/confirm`),
  cancel: (id, reason = '') => post(`/api/trainer/sessions/${enc(id)}/cancel`, { reason }),
  book: (id) => post(`/api/trainer/sessions/${enc(id)}/book`),
  rate: (id, rating) => post(`/api/trainer/sessions/${enc(id)}/rate`, { rating }),
  unlink: () => del('/api/trainer/link'),
  setScopes: (scopes) => patch('/api/trainer/link', { scopes }),
  answerGoal: (decision) => post('/api/trainer/link/goal', { decision }),
  photos: () => get('/api/trainer/photos'),
};

/* ── Small building blocks ───────────────────────────── */
function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase() : 'M';
}

/** Photo avatar (private: Bearer blob) with initials underneath while it loads or when there is none. */
function avatar(person, size = 48, verified = false) {
  const name = person?.displayName || person?.name || '';
  const face = h('span', { class: 'tr-av', style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.36)}px` } }, initialsOf(name));
  if (person?.avatarUrl) {
    authedBlobUrl(person.avatarUrl).then((src) => {
      if (!src) return;
      face.textContent = '';
      face.appendChild(h('img', { src, alt: '' }));
    }).catch(() => {});
  }
  return h('span', { class: 'tr-av-wrap' }, face,
    verified ? h('span', { class: 'tr-av-check', title: t('დადასტურებული ტრენერი', 'Verified trainer') }, icon('check', { size: size >= 56 ? 12 : 10, stroke: 3.2 })) : null);
}

function privateImg(url, alt, cls = '') {
  const box = h('div', { class: `tr-img ${cls}` });
  authedBlobUrl(url).then((src) => {
    if (src) box.appendChild(h('img', { src, alt, loading: 'lazy' }));
    else box.classList.add('broken');
  }).catch(() => box.classList.add('broken'));
  return box;
}

/** Seven (or fourteen) coloured days against the trainer's plan. */
function dayStrip(days, labels = true) {
  const on = days.filter((d) => d.status === 'ON').length;
  return h('div', { class: `tr-strip ${labels ? 'labels' : ''}`, role: 'img', 'aria-label': t(`კვების დაცვა: ${on} დღე გეგმაში ${days.length}-დან`, `Plan adherence: ${on} of ${plural(days.length, 'day')} on plan`) },
    days.map((d) => h('div', { class: 'tr-strip-day', title: `${dayLabel(d.date)} · ${DAY_STATUS_LABEL[d.status] || ''}${d.meals ? ` · ${fmtNum(d.calories)} ${t('კკალ', 'kcal')}` : ''}` },
      h('i', { class: `st-${DAY_STATUS_TONE[d.status] || 'none'}` }),
      labels ? h('span', null, String(Number(d.date.slice(8)))) : null)));
}

function stripLegend() {
  return h('div', { class: 'legend tr-legend' },
    [['ok', t('გეგმაში', 'On plan')], ['warn', t('ცოტა / ცილა აკლდა', 'Under / low protein')], ['danger', t('გადააჭარბა', 'Over')], ['brand', t('დღეს', 'Today')], ['none', t('არ ჩაწერა', 'Not logged')]]
      .map(([trn, l]) => h('span', null, h('i', { class: `st-${trn}` }), l)));
}

function stars(value, onRate) {
  const wrap = h('div', { class: 'tr-stars', role: onRate ? 'radiogroup' : 'img', 'aria-label': value ? t(`${value} ვარსკვლავი 5-დან`, `${value} out of 5 stars`) : t('შეფასება', 'Rating') });
  for (let n = 1; n <= 5; n += 1) {
    const on = (value || 0) >= n;
    wrap.appendChild(onRate
      ? h('button', { type: 'button', class: `tr-star ${on ? 'on' : ''}`, 'aria-label': t(`${n} ვარსკვლავი`, plural(n, 'star')), onClick: () => onRate(n) }, icon('star', { size: 30 }))
      : h('span', { class: `tr-star sm ${on ? 'on' : ''}` }, icon('star', { size: 14 })));
  }
  return wrap;
}

function sessionBadge(s) {
  if (s.status === 'SCHEDULED' && s.clientConfirmedAt) return badge(t('დადასტურებული', 'Confirmed'), 'brand');
  const tone = s.status === 'DONE' ? 'ok' : s.status === 'CANCELLED' || s.status === 'NO_SHOW' ? 'danger' : 'neutral';
  return badge(s.lateCancel && s.status === 'CANCELLED' ? t('ბოლო წუთის გაუქმება', 'Last-minute cancellation') : SESSION_STATUS_LABEL[s.status] || s.status, tone);
}

/** One session line: time block, what/where, status; optional actions under it. */
function sessionRow(s, { href, actions } = {}) {
  const tag = href ? 'a' : 'div';
  return h('div', { class: 'tr-ses' },
    h(tag, { class: `tr-ses-main ${href ? 'is-link' : ''}`, href, 'data-link': href ? '' : undefined, 'aria-label': `${s.label}, ${s.kindLabel}, ${SESSION_STATUS_LABEL[s.status] || ''}` },
      h('div', { class: 'tr-ses-time' }, h('strong', null, clockOf(s.startsAt)), h('span', null, `${s.durationMin} ${t('წთ', 'min')}`)),
      h('div', { class: 'tr-ses-text' },
        h('div', { class: 'row-title' }, `${dayLabel(tbYmd(s.startsAt))} · ${s.kindLabel}`),
        h('div', { class: 'row-sub' }, [s.gym ? gymLine(s.gym) : null, s.status === 'CANCELLED' && s.cancelReason ? `„${s.cancelReason}“` : null].filter(Boolean).join(' · ') || ' '),
        h('div', { class: 'tr-ses-badges' }, sessionBadge(s), s.clientRating ? stars(s.clientRating) : null)),
      href ? icon('chevronRight', { size: 18, className: 'row-chev' }) : null),
    actions ? h('div', { class: 'tr-ses-actions' }, actions) : null);
}

function back(href, label) {
  return h('a', { class: 'back', href, 'data-link': '' }, icon('chevronLeft', { size: 16 }), label);
}

function pageSkeleton() {
  return h('div', null, skeleton(2, { class: 'tr-sk-head' }), h('div', { class: 'grid grid-main' }, h('div', { class: 'stack' }, skeleton(5), skeleton(4)), h('div', { class: 'stack' }, skeleton(4), skeleton(3))));
}

function appHint(text) {
  return h('div', { class: 'tr-apphint' }, icon('smartphone', { size: 18 }),
    h('span', null, text, ' ', h('a', { href: APP_STORE, target: '_blank', rel: 'noopener', class: 'link' }, t('MEDICARD აპი', 'MEDICARD app'))));
}

function errMsg(e) { return e instanceof ApiError || e?.message ? e.message : t('სცადე ხელახლა.', 'Please try again.'); }

/* ── Actions shared by several pages ─────────────────── */
function cancelSessionFlow(s, after) {
  const late = isLate(s.startsAt);
  formModal({
    title: t('ვარჯიშის გაუქმება', 'Cancel session'),
    size: 'sm',
    submit: t('გაუქმება', 'Cancel'),
    danger: true,
    fields: [
      h('p', { class: 'muted' }, late ? t('ვარჯიშამდე 12 საათზე ნაკლებია — ტრენერი ამას ბოლო წუთის გაუქმებად ნახავს.', 'It’s less than 12 hours before the session — your trainer will see this as a last-minute cancellation.') : t(`${s.label} — ტრენერს შეტყობინება მიუვა.`, `${s.label} — your trainer will be notified.`)),
      field(t('მიზეზი (არასავალდებულო)', 'Reason (optional)'), textarea({ name: 'reason', maxlength: 300, rows: 2, placeholder: t('მაგ. სამსახურში დამაგვიანდება', 'e.g. I’ll be late at work') })),
    ],
    onSubmit: async (v, close) => {
      await A.cancel(s.id, String(v.reason || '').trim());
      close();
      toast(t('ვარჯიში გაუქმდა', 'Session cancelled'));
      after?.();
    },
  });
}

async function bookFlow(s, after) {
  const ok = await confirmDialog({ title: t('დაჯავშნა', 'Book'), body: `${s.label} · ${s.kindLabel}${s.gym ? ` · ${s.gym.brand}` : ''} · ${s.durationMin} ${t('წთ', 'min')}`, confirm: t('დაჯავშნა', 'Book') });
  if (!ok) return;
  try {
    await A.book(s.id);
    toast(t('დაჯავშნილია — ტრენერს შეტყობინება მიუვა', 'Booked — your trainer will be notified'));
  } catch (e) {
    toast(errMsg(e), 'error');
  }
  after?.();
}

async function confirmFlow(btn, s, after) {
  await busy(btn, async () => {
    try {
      await A.confirm(s.id);
      toast(t('დადასტურებულია — ტრენერი ნახავს, რომ მოხვალ', 'Confirmed — your trainer will see you’re coming'));
      after?.();
    } catch (e) { toast(errMsg(e), 'error'); }
  });
}

/** Report (and block) a trainer — App Review 1.2. Blocking ends the link at once; the trainer cannot invite again. */
function reportFlow(trainer, after) {
  let reason = null;
  let block = true;
  const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': t('რა მოხდა?', 'What happened?') });
  const drawChips = () => mount(chips, REASONS.map((r) => h('button', {
    type: 'button', class: `chip ${reason === r.key ? 'on' : ''}`, role: 'radio', 'aria-checked': reason === r.key ? 'true' : 'false',
    onClick: () => { reason = r.key; drawChips(); },
  }, r.label)));
  drawChips();
  formModal({
    title: t('შეტყობინება დარღვევაზე', 'Report a problem'),
    submit: t('გაგზავნა', 'Send'),
    fields: [
      h('div', { class: 'hstack' }, avatar(trainer, 40, trainer.verified), h('strong', null, trainer.displayName)),
      field(t('რა მოხდა?', 'What happened?'), chips),
      field(t('დეტალები (არასავალდებულო)', 'Details (optional)'), textarea({ name: 'details', maxlength: 1000, rows: 3, placeholder: t('მოკლედ აღწერე', 'Describe it briefly') }), t('არ ჩაწერო ჯანმრთელობის ან სხვისი პირადი მონაცემები.', 'Don’t include health data or anyone’s personal data.')),
      h('div', { class: 'tr-scope' },
        tile('lock', 'rose', 38),
        h('div', { class: 'tr-scope-text' }, h('div', { class: 'row-title' }, t('ტრენერის დაბლოკვა', 'Block trainer')), h('div', { class: 'row-sub' }, t('კავშირი მაშინვე შეწყდება და ეს ტრენერი ვეღარ მოგწვევს.', 'The connection ends right away and this trainer can’t invite you again.'))),
        toggle(block, (v) => { block = v; })),
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('შეტყობინებას MEDICARD-ის გუნდი განიხილავს. საჭიროების შემთხვევაში ტრენერის სტატუსი შეჩერდება.', 'The MEDICARD team will review your report. If needed, the trainer’s status will be suspended.')),
    ],
    onSubmit: async (v, close) => {
      if (!reason) throw new Error(t('აირჩიე, რა მოხდა.', 'Choose what happened.'));
      const res = await post('/api/trainer/report', { subjectId: trainer.id, reason, details: String(v.details || '').trim(), block });
      close();
      toast(block ? t('შეტყობინება მივიღეთ და კავშირი შეწყდა. MEDICARD-ის გუნდი განიხილავს.', 'Report received and the connection has ended. The MEDICARD team will review it.') : t('შეტყობინება მივიღეთ. MEDICARD-ის გუნდი განიხილავს.', 'Report received. The MEDICARD team will review it.'), 'ok', { ms: 5200 });
      after?.(res);
    },
  });
}

/** Accepting a trainer's goal saves it as the person's own weight goal (same as the app), then clears the proposal. */
async function acceptGoal(g) {
  let current = null;
  try {
    const app = await get('/api/account/app-state');
    const logs = [...(app?.state?.weightLogs || [])].filter((l) => Number.isFinite(Number(l?.kg))).sort((a, b) => String(b.at || b.date).localeCompare(String(a.at || a.date)));
    current = logs[0] ? Number(logs[0].kg) : null;
  } catch { /* fall back to the profile */ }
  if (current == null) current = Number(session.profile?.weightKg) || g.targetKg;
  const weeks = Math.max(1, (Date.parse(g.deadlineYmd) - Date.now()) / (7 * 86400000));
  const pace = Math.round((Math.abs(current - g.targetKg) / weeks) * 100) / 100;
  await patchAppState({
    weightGoal: {
      id: `coach-${Date.now()}`, targetKg: g.targetKg, startKg: current, startedYmd: tbYmd(), deadlineYmd: g.deadlineYmd, paceKgPerWeek: pace,
      pace: pace <= 0.35 ? 'slow' : pace <= 0.75 ? 'moderate' : 'fast', reminderEnabled: false, reminderDays: [], reminderHour: 8, reminderMinute: 0,
      completedSeen: false, updatedAt: new Date().toISOString(),
    },
  });
  await A.answerGoal('accepted');
}
function patchAppState(body) {
  return put('/api/account/app-state', body);
}

/* ── Trainer profile card (search, connect, invite) ───── */
function trainerDetail(trn, { compact = false } = {}) {
  return card({ class: 'tr-profile' },
    h('div', { class: 'tr-profile-head' },
      avatar(trn, compact ? 52 : 64, trn.verified),
      h('div', { class: 'tr-profile-name' },
        h('h3', null, trn.displayName),
        h('div', { class: 'hstack', style: { gap: '6px' } },
          trn.verified ? badge(t('დადასტურებული ტრენერი', 'Verified trainer'), 'brand') : null,
          trn.experienceYears ? badge(t(`${trn.experienceYears} წლის გამოცდილება`, `${plural(trn.experienceYears, 'year')} of experience`)) : null,
          trn.clients ? badge(t(`${trn.clients} კლიენტი MEDICARD-ში`, `${plural(trn.clients, 'client')} on MEDICARD`), 'ok') : null))),
    trn.bio ? h('p', { class: 'tr-bio' }, trn.bio) : null,
    trn.specialties?.length ? h('div', { class: 'chips tr-chips-static' }, trn.specialties.map((s) => h('span', { class: 'chip' }, s.label))) : null,
    h('div', { class: 'tr-facts' },
      (trn.gyms || []).map((g) => h('div', { class: 'tr-fact' }, icon('mapPin', { size: 15 }), h('span', null, `${gymLine(g)}, ${g.city}`, g.address ? h('small', null, ` · ${g.address}`) : null))),
      (trn.certificates || []).map((c) => h('div', { class: 'tr-fact' }, icon('award', { size: 15 }), h('span', null, [c.title, c.issuer, c.year].filter(Boolean).join(' · ')))),
      trn.instagram ? h('div', { class: 'tr-fact' }, icon('externalLink', { size: 15 }),
        h('a', { class: 'link', href: `https://instagram.com/${enc(trn.instagram)}`, target: '_blank', rel: 'noopener' }, `@${trn.instagram}`)) : null));
}

/* ── Search (hub "no trainer" state and /trainer/search) ─── */
function searchView() {
  const state = { q: '', gym: null, city: '', seq: 0, cities: [] };
  const results = h('div', null, skeleton(3));
  const q = input({ type: 'search', placeholder: t('ტრენერის სახელი ან სპეციალიზაცია', 'Trainer name or specialty'), 'aria-label': t('ტრენერის ძებნა', 'Search trainers'), class: 'input tr-search-input' });
  const gymBtn = h('button', { type: 'button', class: 'chip tr-gym-chip' });
  const citySel = h('select', { class: 'input select tr-city', 'aria-label': t('ქალაქი', 'City') }, h('option', { value: '' }, t('ყველა ქალაქი', 'All cities')));
  const drawGym = () => {
    mount(gymBtn, icon('mapPin', { size: 15 }), state.gym ? state.gym.label : t('დარბაზი: ყველა', 'Gym: all'),
      state.gym ? h('span', { class: 'tr-chip-x', role: 'button', 'aria-label': t('დარბაზის ფილტრის მოხსნა', 'Clear gym filter'), onClick: (e) => { e.stopPropagation(); state.gym = null; drawGym(); run(); } }, icon('x', { size: 14 })) : null);
    gymBtn.classList.toggle('on', Boolean(state.gym));
  };
  gymBtn.addEventListener('click', () => gymPicker((g) => { state.gym = g ? { id: g.id, label: gymLine(g) } : null; drawGym(); run(); }));
  drawGym();

  A.gyms().then((r) => {
    state.cities = r?.cities || [];
    for (const c of state.cities) citySel.appendChild(h('option', { value: c }, c));
  }).catch(() => { citySel.hidden = true; });
  citySel.addEventListener('change', () => { state.city = citySel.value; run(); });

  async function run() {
    const seq = ++state.seq;
    try {
      const res = await A.search(state.q, state.gym?.id || '');
      if (seq !== state.seq) return;
      // The server matches name/bio and one gym; the city narrows further by the trainer's gyms.
      const list = (res.trainers || []).filter((trn) => !state.city || (trn.gyms || []).some((g) => g.city === state.city));
      mount(results, list.length
        ? h('div', { class: 'grid tr-results' }, list.map(resultCard))
        : card(empty(t('ტრენერი ვერ მოიძებნა', 'No trainers found'), t('სცადე სხვა დარბაზი ან სახელი. შენს ტრენერს სთხოვე, დარეგისტრირდეს MEDICARD-ში — კოდით პირდაპირ დაგიკავშირდები.', 'Try another gym or name. Ask your trainer to sign up on MEDICARD — then you can connect directly with their code.'))));
    } catch (e) {
      if (seq === state.seq) mount(results, errorBox(e, run));
    }
  }
  const later = debounce(run, 250);
  q.addEventListener('input', () => { state.q = q.value.trim(); later(); });
  run();

  return h('div', { class: 'tr-search' },
    h('div', { class: 'tr-search-bar' },
      h('div', { class: 'tr-search-field' }, icon('search', { size: 18 }), q),
      h('div', { class: 'hstack tr-search-filters' }, gymBtn, citySel)),
    results);
}

function resultCard(trn) {
  return h('a', { class: 'card hover tr-result', href: `/trainer/connect?trainerId=${enc(trn.id)}`, 'data-link': '', 'aria-label': t(`${trn.displayName}, ტრენერი`, `${trn.displayName}, trainer`) },
    h('div', { class: 'tr-result-head' },
      avatar(trn, 52, trn.verified),
      h('div', { class: 'tr-result-name' },
        h('div', { class: 'card-title' }, trn.displayName),
        h('div', { class: 'card-sub tr-ellipsis' }, (trn.gyms || []).map(gymLine).join(' · ') || t('დადასტურებული ტრენერი', 'Verified trainer'))),
      icon('chevronRight', { size: 18, className: 'row-chev' })),
    trn.specialties?.length ? h('div', { class: 'tr-result-spec' }, trn.specialties.map((s) => s.label).join(' · ')) : null,
    h('div', { class: 'hstack', style: { gap: '6px', marginTop: 'auto' } },
      trn.experienceYears ? badge(t(`${trn.experienceYears} წელი`, plural(trn.experienceYears, 'year'))) : null,
      trn.clients ? badge(t(`${trn.clients} კლიენტი MEDICARD-ში`, `${plural(trn.clients, 'client')} on MEDICARD`), 'brand') : null,
      (trn.certificates || []).length ? badge(t(`${trn.certificates.length} სერტიფიკატი`, plural(trn.certificates.length, 'certificate')), 'violet') : null));
}

/** Gym directory picker: brands → branches, searchable (GET /api/trainer/gyms). onPick(gym | null). */
function gymPicker(onPick, { exclude = [], allowAll = true } = {}) {
  const list = h('div', { class: 'list tr-gym-list' }, skeleton(4));
  const q = input({ type: 'search', placeholder: t('Oktopus, Aspria, ვაკე, ბათუმი…', 'Oktopus, Aspria, Vake, Batumi…'), 'aria-label': t('დარბაზის ძებნა', 'Search gyms') });
  let seq = 0;
  let m = null;
  async function run() {
    const my = ++seq;
    try {
      const res = await A.gyms(q.value.trim());
      if (my !== seq) return;
      const rows = (res.brands || []).flatMap((b) => b.branches).filter((g) => !exclude.includes(g.id)).slice(0, 80);
      mount(list,
        allowAll && !q.value.trim() ? row({ icon: 'grid', ink: 'neutral', title: t('ყველა დარბაზი', 'All gyms'), onClick: () => { m.close(); onPick(null); } }) : null,
        rows.length ? rows.map((g) => row({
          icon: 'mapPin', ink: g.status === 'PROPOSED' ? 'amber' : 'teal', title: gymLine(g),
          sub: [g.city, g.district, g.address].filter(Boolean).join(' · '),
          trailing: g.status === 'PROPOSED' ? badge(t('გადამოწმდება', 'Pending review'), 'warn') : undefined,
          onClick: () => { m.close(); onPick(g); },
        })) : h('p', { class: 'muted', style: { padding: '14px 8px' } }, t('ასეთი დარბაზი ვერ მოიძებნა.', 'No gym found.')));
    } catch (e) {
      if (my === seq) mount(list, errorBox(e, run));
    }
  }
  q.addEventListener('input', debounce(run, 200));
  m = openModal({ title: t('დარბაზის არჩევა', 'Choose a gym'), size: 'md', body: h('div', { class: 'stack' }, q, list) });
  run();
  return m;
}

/* ── Code entry (web cannot scan a QR) ────────────────── */
function codeCard(navigate, { autofocus = false } = {}) {
  const err = h('div', { class: 'form-error', hidden: true });
  const inp = input({ class: 'input tr-code', maxlength: 6, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'K7M2QX', 'aria-label': t('ტრენერის კოდი', 'Trainer code'), autofocus });
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); err.hidden = true; });
  const go = () => {
    const code = normalizeCoachCode(inp.value);
    if (!code) { err.textContent = t('კოდი 6 სიმბოლოა (ასოები და ციფრები).', 'The code is 6 characters (letters and digits).'); err.hidden = false; return; }
    navigate(`/trainer/connect?code=${code}`);
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return card({ class: 'tr-codecard' },
    h('div', { class: 'hstack', style: { gap: '12px', alignItems: 'flex-start', flexWrap: 'nowrap' } },
      tile('qr', 'teal', 42),
      h('div', null,
        h('div', { class: 'card-title' }, t('ტრენერის კოდი', 'Trainer code')),
        h('div', { class: 'card-sub' }, t('კოდს ტრენერი გაგიზიარებს — ის ჩანს მის ტრენერის პროფილში და QR-ის ქვეშ.', 'Your trainer shares the code — it’s on their trainer profile, under the QR.')))),
    h('div', { class: 'tr-code-row' }, inp, button(t('ტრენერის ნახვა', 'View trainer'), { onClick: go })),
    err,
    h('p', { class: 'faint tr-small' }, t('QR კოდის სკანირება MEDICARD აპიდან მუშაობს (ჩემი ტრენერი → ტრენერის QR). ვებზე შეიყვანე კოდი — შედეგი იგივეა.', 'Scanning a QR code works in the MEDICARD app (My trainer → Trainer QR). On the web, enter the code — it works the same way.')));
}

/* ═══ Page: hub (/trainer) ═══════════════════════════════ */
async function hubPage(root, ctx, opts = {}) {
  let me = null;
  let ov = null;
  let alive = true;
  mount(root, pageSkeleton());

  async function reload() {
    try {
      [me, ov] = await Promise.all([A.me(), A.overview()]);
      if (!alive) return;
      draw();
    } catch (e) {
      if (alive) mount(root, pageHead(wordmark('coach'), t('ჩემი ტრენერი', 'My trainer')), errorBox(e, reload));
    }
  }

  function draw() {
    const link = ov?.link;
    if (!link) return mount(root, ...discoverView());
    if (link.status === 'REQUESTED' && link.initiator === 'TRAINER') return mount(root, ...inviteView());
    if (link.status === 'REQUESTED') return mount(root, ...pendingView());
    return mount(root, ...activeView());
  }

  function trainerModeCard() {
    const own = me?.trainerProfile;
    const st = own?.status;
    const title = st === 'VERIFIED' ? t('ტრენერის სივრცის გახსნა', 'Open trainer workspace') : st === 'PENDING' ? t('განაცხადი განხილვაშია', 'Application under review') : st === 'REJECTED' ? t('განაცხადს დაზუსტება სჭირდება', 'Your application needs changes') : st === 'SUSPENDED' ? t('ტრენერის პროფილი შეჩერებულია', 'Your trainer profile is suspended') : t('დარეგისტრირდი როგორც ტრენერი', 'Sign up as a trainer');
    const sub = st === 'VERIFIED' ? t('კალენდარი, კლიენტები, კვების გეგმები', 'Calendar, clients, meal plans')
      : st === 'PENDING' ? t('განაცხადი განიხილება — დადასტურებისას შეტყობინება მოგივა', 'Your application is under review — you’ll be notified when it’s approved')
        : st === 'REJECTED' ? t('ნახე კომენტარი, გაასწორე და გაგზავნე ხელახლა', 'Read the comment, fix it and send it again')
          : st === 'SUSPENDED' ? t('დეტალებისთვის მოგვწერე support@medicard.ge', 'For details, write to support@medicard.ge')
            : t('კალენდარი, კლიენტების მართვა და მათი პროგრესი ერთ ადგილას — უფასოდ', 'Calendar, client management and their progress in one place — free');
    const tone = st === 'VERIFIED' ? 'ok' : st === 'PENDING' ? 'warn' : st ? 'danger' : null;
    const label = st === 'VERIFIED' ? t('დადასტურებული', 'Confirmed') : st === 'PENDING' ? t('განიხილება', 'Under review') : st === 'REJECTED' ? t('დასაზუსტებელი', 'Needs changes') : t('შეჩერებული', 'Suspended');
    return section(st === 'PENDING' ? t('შენი ტრენერის განაცხადი', 'Your trainer application') : st === 'VERIFIED' ? t('ტრენერის რეჟიმი', 'Trainer mode') : t('ტრენერი ხარ?', 'Are you a trainer?'),
      h('a', { class: 'card hover tr-mode', href: st === 'VERIFIED' ? '/coach' : '/trainer/apply', 'data-link': '' },
        tile(st === 'VERIFIED' ? 'award' : st === 'PENDING' ? 'clock' : 'award', st === 'VERIFIED' ? 'green' : st ? 'amber' : 'violet'),
        h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, title), h('div', { class: 'card-sub' }, sub)),
        tone ? badge(label, tone) : icon('chevronRight', { size: 18, className: 'row-chev' })));
  }

  function progressLinks(active) {
    return section(t('პროგრესი', 'Progress'), card({ class: 'tr-listcard' }, h('div', { class: 'list' },
      row({ icon: 'camera', ink: 'violet', title: t('ფოტო-პროგრესი', 'Photo progress'), sub: t('მანამდე / შემდეგ', 'Before / after'), href: '/trainer/progress' }),
      row({ icon: 'scale', ink: 'blue', title: t('წონა და მიზანი', 'Weight and goal'), sub: t('აწონვები და მიზნის პროგრესი', 'Weigh-ins and goal progress'), href: '/health' }),
      active ? row({ icon: 'dumbbell', ink: 'teal', title: t('ვარჯიშების ისტორია', 'Session history'), sub: t('ჩატარებული, შეფასებები', 'Completed, ratings'), href: '/trainer/sessions' }) : null,
      active && ov?.plan ? row({ icon: 'utensils', ink: 'amber', title: t('კვების გეგმა', 'Meal plan'), sub: ov.plan.title, href: '/trainer/plan' }) : null)));
  }

  /* No trainer yet: find one, or connect by code. */
  function discoverView() {
    const search = searchView();
    const hero = card({ class: 'spotlight hero-card pad-lg tr-hero' },
      tile('dumbbell', 'teal', 46),
      h('h2', null, t('შენი ტრენერი დარბაზს გარეთაც შენთანაა', 'Your trainer, with you outside the gym too')),
      h('p', { class: 'muted' }, t('ტრენერი ჯავშნებს პირდაპირ აქ გინიშნავს, შეხსენებები თავად მოგივა, კვების გეგმას გიდგენს და ხედავს, როგორ მიდიხარ — მხოლოდ იმას, რასაც შენ გაუზიარებ.', 'Your trainer books sessions for you right here, reminders come on their own, they make your meal plan and see how you’re doing — only what you choose to share.')),
      h('ul', { class: 'tr-points' },
        [['calendarCheck', t('ჯავშნები და შეხსენებები — ვარჯიშს აღარ გამოტოვებ', 'Bookings and reminders — never miss a session')], ['utensils', t('კვების გეგმა და დღიური კონტროლი', 'A meal plan and daily tracking')], ['target', t('ვარჯიშები ტელეფონიდან, წონა და ფოტო-პროგრესი', 'Workouts from your phone, weight and photo progress')]]
          .map(([ic, trn]) => h('li', null, icon(ic, { size: 18 }), h('span', null, trn)))),
      h('div', { class: 'hstack', style: { marginTop: '4px' } },
        button(t('ტრენერის მოძებნა', 'Find a trainer'), { icon: 'search', onClick: () => search.querySelector('input')?.focus() }),
        button(t('ტრენერის რეგისტრაცია', 'Trainer sign-up'), { variant: 'outline', icon: 'award', href: '/trainer/apply', class: 'tr-on-spot' })));
    return [
      pageHead(wordmark('coach'), t('ჩემი ტრენერი — იპოვე დადასტურებული ტრენერი ან დაუკავშირდი მის კოდით. შენ წყვეტ, რას დაინახავს.', 'My trainer — find a verified trainer or connect with their code. You decide what they see.')),
      h('div', { class: 'grid grid-main tr-top' },
        hero,
        h('div', { class: 'tr-col' },
          section(t('კოდით დაკავშირება', 'Connect with a code'), codeCard(ctx.navigate)),
          section(t('შენი QR ტრენერისთვის', 'Your QR for a trainer'), card({ class: 'tr-mini' },
            tile('scanLine', 'sky', 38),
            h('p', { class: 'muted tr-small' }, t('ტრენერს შეუძლია შენი პირადი QR დაასკანეროს MEDICARD აპში (პროფილი → QR). მოწვევა აქაც გამოჩნდება — სანამ არ მიიღებ, შენს მონაცემებს ვერ ნახავს.', 'A trainer can scan your personal QR in the MEDICARD app (Profile → QR). The invite shows up here too — until you accept, they can’t see your data.')))))),
      section(t('იპოვე ტრენერი', 'Find a trainer'), search),
      h('div', { class: 'grid grid-2' }, trainerModeCard(), progressLinks(false)),
    ];
  }

  /* A trainer scanned the person's QR and invited them: nothing is shared until they accept with scopes. */
  function inviteView() {
    const trn = ov.trainer;
    return [
      pageHead(wordmark('coach'), t('ჩემი ტრენერი', 'My trainer')),
      h('div', { class: 'grid grid-main' },
        h('div', { class: 'tr-col' },
          section(t('ტრენერი გიწვევს', 'A trainer is inviting you'), card({ class: 'spotlight hero-card pad-lg tr-invite' },
            h('div', { class: 'tr-invite-head' }, avatar(trn, 64, trn.verified),
              h('div', null, h('h2', null, trn.displayName), h('p', { class: 'muted' }, (trn.gyms || []).map(gymLine).join(' · ') || t('დადასტურებული ტრენერი', 'Verified trainer')))),
            h('p', null, t('შენი QR დაასკანერა და გთავაზობს ერთად ვარჯიშს. სანამ არ მიიღებ, შენს მონაცემებს ვერ ხედავს.', 'They scanned your QR and want to train with you. Until you accept, they can’t see your data.')),
            h('div', { class: 'hstack' },
              button(t('ნახვა და მიღება', 'Review and accept'), { icon: 'check', href: '/trainer/connect?invite=1' }),
              button(t('უარი', 'Decline'), {
                variant: 'outline', class: 'tr-on-spot',
                onClick: async (e) => {
                  const ok = await confirmDialog({ title: t('მოწვევაზე უარი', 'Decline invite'), body: t(`${trn.displayName} ვერ ნახავს შენს მონაცემებს. მოგვიანებით თავად შეგიძლია დაუკავშირდე.`, `${trn.displayName} won’t see your data. You can connect with them yourself later.`), confirm: t('უარი', 'Decline'), danger: true });
                  if (!ok) return;
                  await busy(e.currentTarget, async () => { try { await A.unlink(); toast(t('მოწვევაზე უარი ითქვა', 'Invite declined')); await reload(); } catch (er) { toast(errMsg(er), 'error'); } });
                },
              })))),
          section(t('ტრენერის შესახებ', 'About the trainer'), trainerDetail(trn))),
        h('div', { class: 'tr-col' },
          section(t('რას დაინახავს ტრენერი', 'What the trainer will see'), card(h('p', { class: 'muted tr-small' }, ALWAYS_TEXT), h('p', { class: 'faint tr-small', style: { marginTop: '10px' } }, NEVER_TEXT))),
          h('button', { type: 'button', class: 'text-btn tr-report', onClick: () => reportFlow(trn, () => reload()) }, icon('alert', { size: 16 }), t('შეტყობინება დარღვევაზე / დაბლოკვა', 'Report / block')),
          trainerModeCard())),
    ];
  }

  function pendingView() {
    const trn = ov.trainer;
    return [
      pageHead(wordmark('coach'), t('ჩემი ტრენერი', 'My trainer')),
      h('div', { class: 'grid grid-main' },
        h('div', { class: 'tr-col' },
          section(t('მოთხოვნა გაგზავნილია', 'Request sent'), card({ class: 'pad-lg' },
            h('div', { class: 'tr-invite-head' }, avatar(trn, 56, true),
              h('div', null, h('div', { class: 'card-title' }, trn.displayName), h('div', { class: 'card-sub' }, t('ტრენერი ნახავს შენს მოთხოვნას და დაგიდასტურებს.', 'The trainer will see your request and confirm it.')))),
            h('div', { class: 'tr-sharing-inline' }, t('დადასტურების შემდეგ გაზიარდება: ', 'Shared once confirmed: '),
              SCOPES.filter((k) => ov.link.scopes?.[k]).map((k) => SCOPE_COPY[k].title).join(', ') || t('მხოლოდ ვარჯიშების განრიგი', 'Session schedule only')),
            h('div', { class: 'hstack', style: { marginTop: '14px' } },
              button(t('მოთხოვნის გაუქმება', 'Cancel request'), {
                variant: 'ghost',
                onClick: (e) => busy(e.currentTarget, async () => { try { await A.unlink(); toast(t('მოთხოვნა გაუქმდა', 'Request cancelled')); await reload(); } catch (er) { toast(errMsg(er), 'error'); } }),
              })))),
          section(t('ტრენერის შესახებ', 'About the trainer'), trainerDetail(trn))),
        h('div', { class: 'tr-col' }, trainerModeCard(), progressLinks(false))),
    ];
  }

  function activeView() {
    const trn = ov.trainer;
    const link = ov.link;
    const next = (ov.upcoming || []).find((s) => s.status === 'SCHEDULED');
    const left = h('div', { class: 'tr-col' },
      section(t('შემდეგი ვარჯიში', 'Next session'), nextCard(next), { link: ov.upcoming?.length ? { href: '/trainer/sessions', label: t('ყველა', 'All') } : undefined }),
      link.proposedGoal ? section(t('ტრენერი მიზანს გთავაზობს', 'Your trainer proposes a goal'), goalCard(link.proposedGoal)) : null,
      ov.openSlots?.length ? section(t('თავისუფალი დრო ტრენერთან', 'Open times with your trainer'), slotsCard(ov.openSlots, reload)) : null,
      section(t('კვების გეგმა', 'Meal plan'), planSummary(), { link: ov.plan ? { href: '/trainer/plan', label: t('გახსნა', 'Open') } : undefined }),
      ov.past?.length ? section(t('ბოლო ვარჯიშები', 'Recent sessions'), card({ class: 'tr-listcard' }, h('div', { class: 'tr-seslist' }, ov.past.slice(0, 4).map((s) => sessionRow(s, { href: `/trainer/session/${s.id}` })))), { link: { href: '/trainer/sessions', label: t('ისტორია', 'History') } }) : null);
    const right = h('div', { class: 'tr-col' },
      section(t('ტრენერი', 'Trainer'), trainerSummary(trn)),
      section(t('რას ხედავს ტრენერი', 'What your trainer sees'), sharingSummary(link), { link: { href: '/trainer/sharing', label: t('შეცვლა', 'Change') } }),
      progressLinks(true),
      trainerModeCard());
    return [
      pageHead(wordmark('coach'), `${t('ჩემი ტრენერი', 'My trainer')} · ${trn.displayName}${link.since ? t(` · ერთად ${fmtDate(link.since)}-დან`, ` · together since ${fmtDate(link.since)}`) : ''}`,
        button(t('ვარჯიშები', 'Sessions'), { variant: 'ghost', icon: 'calendar', href: '/trainer/sessions' }),
        button(t('გაზიარება', 'Sharing'), { variant: 'secondary', icon: 'shield', href: '/trainer/sharing' })),
      h('div', { class: 'grid grid-main' }, left, right),
      h('p', { class: 'faint tr-viewed' }, link.trainerViewedAt ? t(`ტრენერმა ბოლოს ნახა ${dayLabel(tbYmd(link.trainerViewedAt))} ${clockOf(link.trainerViewedAt)}`, `Your trainer last viewed ${dayLabel(tbYmd(link.trainerViewedAt))} ${clockOf(link.trainerViewedAt)}`) : t('ტრენერს შენი მონაცემები ჯერ არ უნახავს', 'Your trainer hasn’t viewed your data yet')),
    ];
  }

  function nextCard(next) {
    if (!next) {
      return card({ class: 'tr-mini' }, tile('calendar', 'teal', 42),
        h('p', { class: 'muted' }, t('დაგეგმილი ვარჯიში ჯერ არ გაქვს. ტრენერი ჩაგწერს, ან აირჩიე თავისუფალი დრო ქვემოთ.', 'No session scheduled yet. Your trainer will book you in, or pick an open time below.')));
    }
    const confirmBtn = button(t('მოვალ ✓', 'I’ll be there ✓'), { onClick: (e) => confirmFlow(e.currentTarget, next, reload) });
    return card({ class: 'spotlight hero-card pad-lg tr-next' },
      h('div', { class: 'between' },
        h('div', { class: 'tr-next-time' }, clockOf(next.startsAt)),
        h('span', { class: 'tr-pill' }, relativeStart(next.startsAt))),
      h('div', { class: 'tr-next-sub' }, [dayLabel(tbYmd(next.startsAt)), next.kindLabel, `${next.durationMin} ${t('წთ', 'min')}`, next.gym ? gymLine(next.gym) : null].filter(Boolean).join(' · ')),
      next.note ? h('p', { class: 'tr-next-note' }, `„${next.note}“`) : null,
      h('div', { class: 'hstack tr-next-actions' },
        next.clientConfirmedAt ? h('span', { class: 'tr-confirmed' }, icon('check', { size: 18, stroke: 2.6 }), t('დადასტურებულია', 'Confirmed')) : confirmBtn,
        button(t('გაუქმება', 'Cancel'), { variant: 'outline', class: 'tr-on-spot', onClick: () => cancelSessionFlow(next, reload) })));
  }

  function goalCard(g) {
    return card({ class: 'tr-goal' },
      h('div', { class: 'hstack', style: { flexWrap: 'nowrap', gap: '14px' } },
        tile('target', 'amber', 44),
        h('div', { class: 'row-main' },
          h('div', { class: 'card-title' }, `${GOAL_TYPE_LABEL[g.type] || t('მიზანი', 'Goal')}: ${fmtNum(g.targetKg, 1)} ${t('კგ', 'kg')}`),
          h('div', { class: 'card-sub' }, t(`ვადა: ${fmtDate(g.deadlineYmd, { year: true })}`, `Deadline: ${fmtDate(g.deadlineYmd, { year: true })}`)))),
      g.note ? h('p', { class: 'tr-quote' }, `„${g.note}“`) : null,
      h('p', { class: 'faint tr-small' }, t('მიღებისას მიზანი შენს წონის მიზნად შეინახება — ნახავ „მაჩვენებლებში“.', 'If you accept, it’s saved as your weight goal — you’ll find it in “Health”.')),
      h('div', { class: 'hstack' },
        button(t('მიღება', 'Accept'), {
          icon: 'check',
          onClick: (e) => busy(e.currentTarget, async () => {
            try { await acceptGoal(g); toast(t('მიზანი შენახულია', 'Goal saved')); await reload(); } catch (er) { toast(errMsg(er), 'error'); }
          }),
        }),
        button(t('არა', 'No'), {
          variant: 'ghost',
          onClick: (e) => busy(e.currentTarget, async () => {
            try { await A.answerGoal('dismissed'); toast(t('შემოთავაზება დაიხურა', 'Proposal dismissed'), 'info'); await reload(); } catch (er) { toast(errMsg(er), 'error'); }
          }),
        })));
  }

  function planSummary() {
    const plan = ov.plan;
    if (!plan) {
      return card({ class: 'tr-mini' }, tile('utensils', 'amber', 42),
        h('p', { class: 'muted' }, ov.link.scopes?.nutrition ? t('ტრენერს კვების გეგმა ჯერ არ გამოუგზავნია.', 'Your trainer hasn’t sent a meal plan yet.') : t('კვება ტრენერს არ უზიარებ — გეგმისთვის ჩართე „კვება“ გაზიარებაში.', 'You’re not sharing nutrition with your trainer — turn on “Nutrition” in sharing to get a plan.')));
    }
    const days = ov.nutrition?.days || [];
    const today = days[days.length - 1];
    const score = ov.nutrition?.score;
    return h('a', { class: 'card hover tr-plan-sum', href: '/trainer/plan', 'data-link': '' },
      h('div', { class: 'tr-plan-sum-top' },
        h('div', { class: 'row-main' },
          h('div', { class: 'card-title' }, plan.title),
          h('div', { class: 'card-sub' }, t(`${fmtNum(plan.targets.calories)} კკალ${plan.targets.protein ? ` · ცილა ${plan.targets.protein} გ` : ''}${plan.targets.carbs ? ` · ნახშ. ${plan.targets.carbs} გ` : ''}${plan.targets.fat ? ` · ცხ. ${plan.targets.fat} გ` : ''}`, `${fmtNum(plan.targets.calories)} kcal${plan.targets.protein ? ` · protein ${plan.targets.protein} g` : ''}${plan.targets.carbs ? ` · carbs ${plan.targets.carbs} g` : ''}${plan.targets.fat ? ` · fat ${plan.targets.fat} g` : ''}`))),
        ring({ value: score ?? 0, max: 100, size: 64, stroke: 7, label: score != null ? `${score}%` : '—', labelScale: 0.24, color: score == null ? 'var(--bg3)' : score >= 70 ? 'var(--ok)' : score >= 40 ? 'var(--warn)' : 'var(--danger)' })),
      days.length ? dayStrip(days) : null,
      today ? h('div', { class: 'tr-plan-today' },
        h('span', null, t(`დღეს: ${DAY_STATUS_LABEL[today.status]} · ${fmtNum(today.calories)} / ${fmtNum(plan.targets.calories)} კკალ`, `Today: ${DAY_STATUS_LABEL[today.status]} · ${fmtNum(today.calories)} / ${fmtNum(plan.targets.calories)} kcal`)),
        progress(today.calories, plan.targets.calories, { ink: today.status === 'OVER' ? 'rose' : 'teal' })) : null);
  }

  function trainerSummary(trn) {
    return card({ class: 'tr-trainer' },
      h('div', { class: 'tr-trainer-head' },
        avatar(trn, 60, trn.verified),
        h('div', { class: 'row-main' },
          h('div', { class: 'card-title', style: { fontSize: '16.5px' } }, trn.displayName),
          (trn.gyms || [])[0] ? h('div', { class: 'card-sub tr-ellipsis' }, icon('mapPin', { size: 13 }), ` ${(trn.gyms || []).map(gymLine).join(' · ')}`) : null,
          trn.specialties?.length ? h('div', { class: 'faint tr-small tr-ellipsis' }, trn.specialties.map((s) => s.label).join(' · ')) : null)),
      h('div', { class: 'tr-kpis' },
        h('div', null, h('strong', null, String(ov.stats?.done ?? 0)), h('span', null, t('ჩატარდა', 'Done'))),
        h('div', null, h('strong', null, String(ov.stats?.noShow ?? 0)), h('span', null, t('გამოტოვა', 'Missed'))),
        h('div', null, h('strong', null, ov.nutrition?.score != null ? `${ov.nutrition.score}%` : '—'), h('span', null, t('კვების დაცვა', 'Plan adherence')))),
      h('div', { class: 'between', style: { marginTop: '12px' } },
        h('a', { class: 'link', href: '/trainer/sharing', 'data-link': '' }, icon('shield', { size: 15 }), t(' რას ხედავს ტრენერი', ' What your trainer sees')),
        h('button', { type: 'button', class: 'text-btn tr-report', onClick: () => reportFlow(trn, () => reload()) }, t('შეტყობინება', 'Report'))));
  }

  const alive$ = () => { alive = false; };
  if (opts.report) {
    await reload();
    if (ov?.trainer) reportFlow(ov.trainer, () => reload());
    return alive$;
  }
  await reload();
  return alive$;
}

function sharingSummary(link) {
  return card({ class: 'tr-listcard' }, h('div', { class: 'list' },
    row({ icon: 'calendar', ink: 'teal', title: t('ვარჯიშების განრიგი', 'Session schedule'), sub: t('ყოველთვის — კავშირის საფუძველია', 'Always — it’s the basis of the connection'), trailing: badge(t('ყოველთვის', 'Always'), 'neutral') }),
    SCOPES.map((k) => row({
      icon: SCOPE_COPY[k].icon, ink: link.scopes?.[k] ? SCOPE_COPY[k].ink : 'neutral', title: SCOPE_COPY[k].title,
      trailing: link.scopes?.[k] ? badge(t('ხედავს', 'Sees'), 'ok') : badge(t('არ ხედავს', 'Hidden'), 'neutral'),
    }))));
}

function slotsCard(slots, after) {
  const byDay = new Map();
  for (const s of slots.slice(0, 18)) {
    const d = tbYmd(s.startsAt);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(s);
  }
  return card({ class: 'tr-slots' },
    [...byDay.entries()].map(([d, list]) => h('div', { class: 'tr-slot-day' },
      h('div', { class: 'tr-slot-label' }, dayLabel(d)),
      h('div', { class: 'chips' }, list.map((s) => h('button', {
        type: 'button', class: 'chip tr-slot', title: `${s.kindLabel}${s.gym ? ` · ${gymLine(s.gym)}` : ''} · ${s.durationMin} ${t('წთ', 'min')}`,
        onClick: () => bookFlow(s, after),
      }, icon('clock', { size: 14 }), clockOf(s.startsAt), h('small', null, s.kindLabel)))))),
    h('p', { class: 'faint tr-small' }, t('დააჭირე დროს დასაჯავშნად — ტრენერს შეტყობინება მიუვა.', 'Click a time to book it — your trainer will be notified.')));
}

/* ═══ Page: connect + consent (/trainer/connect?code= | ?trainerId= | ?invite=1) ═══ */
async function connectPage(root, ctx) {
  const viaSearch = Boolean(ctx.query.trainerId);
  const viaInvite = ctx.query.invite === '1';
  let code = normalizeCoachCode(ctx.query.code) || '';
  let trainer = null;
  let consentVersion = '';
  const scopes = { workouts: false, nutrition: false, weight: false, photos: false };
  const title = viaInvite ? t('ტრენერის მოწვევა', 'Trainer invite') : viaSearch ? t('მოთხოვნა ტრენერთან', 'Request a trainer') : t('ტრენერთან დაკავშირება', 'Connect with a trainer');
  ctx.setTitle(title);

  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', t('ჩემი ტრენერი', 'My trainer')), pageHead(title, viaInvite ? t('გადახედე, ვინ გიწვევს და აირჩიე, რას გაუზიარებ.', 'See who’s inviting you and choose what to share.') : t('ჯერ ნახე ტრენერი, შემდეგ აირჩიე, რას დაინახავს.', 'First look at the trainer, then choose what they’ll see.')), body);

  // The current consent text version comes from /api/trainer/me (the link endpoints refuse any other).
  const meP = A.me().catch(() => null);
  let meNow = null;

  async function load() {
    mount(body, pageSkeleton());
    try {
      if (viaInvite) {
        const ov = await A.overview();
        if (!ov.link || ov.link.initiator !== 'TRAINER' || ov.link.status !== 'REQUESTED' || !ov.trainer) {
          mount(body, card(empty(t('მოწვევა ვერ მოიძებნა', 'Invite not found'), t('მოწვევა ვერ მოიძებნა ან უკვე დადასტურებულია.', 'Invite not found or already accepted.'), button(t('ჩემი ტრენერი', 'My trainer'), { href: '/trainer' }))));
          return;
        }
        trainer = ov.trainer;
        consentVersion = ov.consentVersion || '';
      } else if (viaSearch) {
        const res = await A.card(ctx.query.trainerId);
        trainer = res.trainer;
        consentVersion = res.consentVersion || '';
      } else if (code) {
        const res = await A.byCode(code);
        trainer = res.trainer;
        consentVersion = res.consentVersion || '';
      } else {
        mount(body, h('div', { class: 'tr-narrow' }, codeCard(ctx.navigate, { autofocus: true })));
        return;
      }
      meNow = await meP;
      if (meNow?.consentVersion) consentVersion = meNow.consentVersion;
      draw();
    } catch (e) {
      if (!viaSearch && !viaInvite) {
        mount(body, h('div', { class: 'tr-narrow stack' }, errorBox(e), codeCard(ctx.navigate, { autofocus: true })));
      } else mount(body, errorBox(e, load));
    }
  }

  function draw() {
    const err = h('div', { class: 'form-error', hidden: true });
    const note = viaSearch ? textarea({ maxlength: 300, rows: 3, placeholder: t('მაგ. მინდა 5 კგ-ის დაკლება და ძალის მომატება', 'e.g. I want to lose 5 kg and get stronger') }) : null;
    const submitLabel = viaSearch ? t('მოთხოვნის გაგზავნა', 'Send request') : viaInvite ? t('თანხმობა და მოწვევის მიღება', 'Agree and accept invite') : t('თანხმობა და დაკავშირება', 'Agree and connect');
    const submit = button(submitLabel, { class: 'btn-block btn-lg', icon: 'check' });
    const other = !viaInvite && meNow?.clientLink && meNow.clientLink.trainerId !== trainer.id;
    if (other) {
      mount(err, t('უკვე გყავს ტრენერი. ახალთან დასაკავშირებლად ჯერ დაასრულე მიმდინარე კავშირი ', 'You already have a trainer. To connect with a new one, first end your current connection '), h('a', { class: 'link', href: '/trainer/sharing', 'data-link': '' }, t('გაზიარებიდან', 'from Sharing')), '.');
      err.hidden = false;
      submit.disabled = true;
    }
    submit.addEventListener('click', () => busy(submit, async () => {
      err.hidden = true;
      try {
        if (viaInvite) await post('/api/trainer/link/accept', { scopes, consentVersion });
        else {
          await post('/api/trainer/link', {
            ...(viaSearch ? { trainerId: trainer.id } : { code }),
            scopes, consentVersion, note: note ? note.value.trim() : '',
          });
        }
        toast(viaSearch ? t('მოთხოვნა გაიგზავნა — ტრენერი დაგიდასტურებს', 'Request sent — the trainer will confirm it') : t(`${trainer.displayName} ახლა შენი ტრენერია`, `${trainer.displayName} is now your trainer`));
        ctx.navigate('/trainer', { replace: true });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'CONSENT_OUTDATED') {
          const me = await A.me().catch(() => null);
          if (me?.consentVersion) consentVersion = me.consentVersion;
        }
        err.textContent = errMsg(e);
        err.hidden = false;
      }
    }));

    const consent = card({ class: 'pad-lg tr-consent' },
      h('h3', { class: 'tr-h3' }, t('რას დაინახავს ტრენერი', 'What the trainer will see')),
      h('div', { class: 'tr-always' },
        h('div', { class: 'hstack', style: { gap: '8px', flexWrap: 'nowrap', alignItems: 'flex-start' } }, icon('lock', { size: 16 }), h('p', null, ALWAYS_TEXT)),
        h('div', { class: 'chips tr-chips-static' }, ALWAYS_SEEN.map((trn) => h('span', { class: 'chip' }, icon('eye', { size: 13 }), trn)))),
      h('div', { class: 'tr-scopes' }, SCOPES.map((k) => scopeRow(k, scopes[k], (v) => { scopes[k] = v; }))),
      h('p', { class: 'faint tr-small' }, NEVER_TEXT),
      note ? field(t('მოკლე მესიჯი ტრენერს (არასავალდებულო)', 'Short message to the trainer (optional)'), note) : null,
      err,
      submit,
      h('p', { class: 'faint tr-small', style: { textAlign: 'center' } }, t('გაზიარებას ნებისმიერ დროს შეცვლი ან შეწყვეტ „ჩემი ტრენერი“-დან.', 'You can change or stop sharing any time from “My trainer”.')));

    mount(body, h('div', { class: 'grid grid-main' },
      h('div', { class: 'tr-col' },
        section(viaInvite ? t('გიწვევს', 'Inviting you') : t('ტრენერი', 'Trainer'), trainerDetail(trainer)),
        viaSearch ? card({ class: 'tr-mini' }, tile('info', 'sky', 38), h('p', { class: 'muted tr-small' }, t('მოთხოვნას ტრენერი დაადასტურებს. მანამდე შენს მონაცემებს ვერ ხედავს; კოდით დაკავშირება მაშინვე აქტიურდება.', 'The trainer confirms your request. Until then they can’t see your data; connecting with a code is active right away.'))) : null,
        h('button', { type: 'button', class: 'text-btn tr-report', onClick: () => reportFlow(trainer, (res) => { if (res?.blocked) ctx.navigate('/trainer', { replace: true }); }) }, icon('alert', { size: 16 }), t('შეტყობინება დარღვევაზე', 'Report a problem'))),
      h('div', { class: 'tr-col tr-sticky' }, consent)));
  }

  await load();
}

function scopeRow(k, value, onChange, { disabled = false } = {}) {
  const c = SCOPE_COPY[k];
  const trn = toggle(value, onChange);
  const inp = trn.querySelector('input');
  inp.setAttribute('aria-label', c.title);
  if (disabled) inp.disabled = true;
  return h('div', { class: `tr-scope ${disabled ? 'disabled' : ''}` },
    tile(c.icon, c.ink, 38),
    h('div', { class: 'tr-scope-text' }, h('div', { class: 'row-title' }, c.title), h('div', { class: 'row-sub' }, c.body)),
    trn);
}

/* ═══ Page: sharing (/trainer/sharing) ═══════════════════ */
async function sharingPage(root, ctx) {
  ctx.setTitle(t('გაზიარება ტრენერთან', 'Sharing with your trainer'));
  const body = h('div', null, pageSkeleton());
  const head = h('div', null, pageHead(t('გაზიარება ტრენერთან', 'Sharing with your trainer'), t('რას ხედავს ტრენერი', 'What your trainer sees')));
  mount(root, back('/trainer', t('ჩემი ტრენერი', 'My trainer')), head, body);
  let ov = null;

  async function load() {
    try {
      ov = await A.overview();
      draw();
    } catch (e) { mount(body, errorBox(e, load)); }
  }

  function draw() {
    const link = ov.link;
    if (!link) {
      mount(body, card(empty(t('ტრენერთან კავშირი არ გაქვს', 'You’re not connected with a trainer'), t('როცა ტრენერს დაუკავშირდები, აქ აირჩევ, რას დაინახავს.', 'Once you connect with a trainer, you’ll choose here what they see.'), button(t('ტრენერის მოძებნა', 'Find a trainer'), { href: '/trainer', icon: 'search' }))));
      return;
    }
    const trn = ov.trainer;
    mount(head, pageHead(t('გაზიარება ტრენერთან', 'Sharing with your trainer'), trn?.displayName || ''));
    const active = link.status === 'ACTIVE';
    const invited = link.status === 'REQUESTED' && link.initiator === 'TRAINER';

    const setScope = async (k, v, rowEl) => {
      const prev = link.scopes[k];
      link.scopes = { ...link.scopes, [k]: v };
      rowEl.classList.add('saving');
      try {
        ov = await A.setScopes({ [k]: v });
        toast(v ? t(`${SCOPE_COPY[k].title} — ტრენერი ახლა ხედავს`, `${SCOPE_COPY[k].title} — your trainer can see it now`) : t(`${SCOPE_COPY[k].title} — ტრენერისთვის დაიმალა`, `${SCOPE_COPY[k].title} — hidden from your trainer`));
        draw();
      } catch (e) {
        link.scopes = { ...link.scopes, [k]: prev };
        toast(errMsg(e), 'error');
        draw();
      }
    };

    const scopesCard = card({ class: 'tr-scopes-card' },
      h('div', { class: `tr-scope disabled` },
        tile('calendar', 'teal', 38),
        h('div', { class: 'tr-scope-text' }, h('div', { class: 'row-title' }, t('ვარჯიშების განრიგი', 'Session schedule')), h('div', { class: 'row-sub' }, t('ჯავშნები ორივე მხარეს ჩანს — ეს კავშირის საფუძველია.', 'Bookings are visible to both of you — that’s the basis of the connection.'))),
        (() => { const tg = toggle(true, () => {}); tg.querySelector('input').disabled = true; return tg; })()),
      SCOPES.map((k) => {
        let rowEl = null;
        rowEl = scopeRow(k, Boolean(link.scopes?.[k]), (v) => setScope(k, v, rowEl), { disabled: !active });
        return rowEl;
      }));

    const endBtn = active || link.status === 'REQUESTED'
      ? button(invited ? t('მოწვევაზე უარი', 'Decline invite') : active ? t('ტრენერთან კავშირის დასრულება', 'End connection with trainer') : t('მოთხოვნის გაუქმება', 'Cancel request'), {
        variant: 'danger', icon: 'x', class: 'btn-block',
        onClick: async (e) => {
          const btn = e.currentTarget;
          const ok = await confirmDialog(active
            ? { title: t('ტრენერთან კავშირის დასრულება', 'End connection with trainer'), body: t('ტრენერი მაშინვე ვეღარ ნახავს შენს მონაცემებს, მომავალი ვარჯიშები გაუქმდება. ისტორია შენთან დარჩება.', 'Your trainer immediately loses access to your data and upcoming sessions are cancelled. Your history stays with you.'), confirm: t('დასრულება', 'End'), danger: true }
            : { title: invited ? t('მოწვევაზე უარი', 'Decline invite') : t('მოთხოვნის გაუქმება', 'Cancel request'), body: t(`${trn?.displayName || 'ტრენერი'} ვერ ნახავს შენს მონაცემებს.`, `${trn?.displayName || 'The trainer'} won’t see your data.`), confirm: invited ? t('უარი', 'Decline') : t('გაუქმება', 'Cancel'), danger: true });
          if (!ok) return;
          await busy(btn, async () => {
            try { await A.unlink(); toast(active ? t('კავშირი დასრულდა', 'Connection ended') : t('გაუქმდა', 'Cancelled')); ctx.navigate('/trainer', { replace: true }); } catch (er) { toast(errMsg(er), 'error'); }
          });
        },
      }) : null;

    mount(body, h('div', { class: 'grid grid-main' },
      h('div', { class: 'tr-col' },
        card({ class: 'tr-mini' }, tile('lock', 'teal', 42),
          h('div', null,
            h('p', null, t('ცვლილება მაშინვე მოქმედებს. გამორთული კატეგორია ტრენერისთვის ქრება — ისტორიის ჩათვლით.', 'Changes take effect immediately. A category you turn off disappears for your trainer — history included.')),
            h('p', { class: 'faint tr-small', style: { marginTop: '4px' } }, link.trainerViewedAt ? t(`ტრენერმა ბოლოს ნახა: ${dayLabel(tbYmd(link.trainerViewedAt))} ${clockOf(link.trainerViewedAt)}`, `Your trainer last viewed: ${dayLabel(tbYmd(link.trainerViewedAt))} ${clockOf(link.trainerViewedAt)}`) : t('ტრენერს შენი მონაცემები ჯერ არ უნახავს.', 'Your trainer hasn’t viewed your data yet.')))),
        invited ? card({ class: 'tr-mini' }, tile('info', 'amber', 38), h('p', { class: 'muted tr-small' }, t('ეს მოწვევაა — გაზიარებას მიღებისას აირჩევ.', 'This is an invite — you’ll choose what to share when you accept.')), button(t('ნახვა და მიღება', 'Review and accept'), { size: 'sm', href: '/trainer/connect?invite=1' }))
          : !active ? card({ class: 'tr-mini' }, tile('clock', 'amber', 38), h('p', { class: 'muted tr-small' }, t('მოთხოვნა ჯერ არ დაუდასტურებია. გაზიარებას შეცვლი, როცა კავშირი გააქტიურდება — მანამდე ტრენერი არაფერს ხედავს.', 'The request isn’t confirmed yet. You can change sharing once the connection is active — until then the trainer sees nothing.'))) : null,
        section(t('ტრენერი ყოველთვის ხედავს', 'Your trainer always sees'), card(h('div', { class: 'chips tr-chips-static' }, ALWAYS_SEEN.map((x) => h('span', { class: 'chip' }, icon('eye', { size: 13 }), x))))),
        section(t('შენ წყვეტ', 'You decide'), scopesCard),
        h('p', { class: 'faint tr-small' }, t('არასოდეს ჩანს: სამედიცინო ჩანაწერები, ანალიზები, წამლები, ციკლი, Medi-სთან საუბრები.', 'Never visible: medical records, lab results, medications, cycle, conversations with Medi.')),
        link.scopes?.workouts ? appHint(t('საათით ან ტელეფონით ჩაწერილი ვარჯიშები (ხანგრძლივობა, კალორია, პულსი) Apple Health / Health Connect-იდან იკითხება — ამისთვის გამოიყენე', 'Workouts recorded by a watch or phone (duration, calories, heart rate) are read from Apple Health / Health Connect — for this, use the')) : null),
      h('div', { class: 'tr-col tr-sticky' },
        section(t('კავშირი', 'Connection'), card({ class: 'stack' },
          trn ? h('div', { class: 'tr-invite-head' }, avatar(trn, 48, trn.verified), h('div', null, h('div', { class: 'card-title' }, trn.displayName),
            h('div', { class: 'card-sub' }, active ? (link.since ? t(`ტრენერი ${fmtDate(link.since)}-დან`, `Your trainer since ${fmtDate(link.since)}`) : t('აქტიური კავშირი', 'Active connection')) : invited ? t('გიწვევს', 'Inviting you') : t('მოთხოვნა გაგზავნილია', 'Request sent')))) : null,
          endBtn,
          trn ? button(t('შეტყობინება დარღვევაზე / დაბლოკვა', 'Report / block'), { variant: 'ghost', icon: 'alert', class: 'btn-block', onClick: () => reportFlow(trn, (res) => { if (res?.blocked) ctx.navigate('/trainer', { replace: true }); }) }) : null)))));
  }

  await load();
}

/* ═══ Page: sessions (/trainer/sessions) ═════════════════ */
async function sessionsPage(root, ctx) {
  ctx.setTitle(t('ვარჯიშები', 'Sessions'));
  const head = h('div', null, pageHead(t('ვარჯიშები', 'Sessions'), 'MEDICOACH'));
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', t('ჩემი ტრენერი', 'My trainer')), head, body);
  let ov = null;

  async function load() {
    try {
      ov = await A.overview();
      draw();
    } catch (e) { mount(body, errorBox(e, load)); }
  }

  function draw() {
    if (!ov.link || ov.link.status !== 'ACTIVE') {
      mount(body, card(empty(t('ტრენერთან აქტიური კავშირი არ გაქვს', 'You don’t have an active trainer connection'), t('ვარჯიშები აქ გამოჩნდება, როცა ტრენერი დაგიდასტურებს.', 'Sessions will show up here once your trainer confirms you.'), button(t('ჩემი ტრენერი', 'My trainer'), { href: '/trainer' }))));
      return;
    }
    mount(head, pageHead(t('ვარჯიშები', 'Sessions'), ov.trainer?.displayName || ''));
    const upcoming = (ov.upcoming || []).filter((s) => s.status === 'SCHEDULED');
    const cancelled = (ov.upcoming || []).filter((s) => s.status === 'CANCELLED');
    const past = ov.past || [];
    const done = past.filter((s) => s.status === 'DONE').length;
    const judged = past.length;
    const rated = past.filter((s) => s.clientRating);
    const avg = rated.length ? rated.reduce((a, s) => a + s.clientRating, 0) / rated.length : null;

    const upList = upcoming.length
      ? card({ class: 'tr-listcard' }, h('div', { class: 'tr-seslist' }, upcoming.map((s) => sessionRow(s, {
        actions: [
          !s.clientConfirmedAt ? button(t('მოვალ ✓', 'I’ll be there ✓'), { size: 'sm', onClick: (e) => confirmFlow(e.currentTarget, s, load) }) : null,
          button(t('გაუქმება', 'Cancel'), { size: 'sm', variant: 'ghost', onClick: () => cancelSessionFlow(s, load) }),
        ],
      }))))
      : card(empty(t('დაგეგმილი ვარჯიში არ არის', 'No sessions scheduled'), t('როცა ტრენერი ჩაგწერს, აქ გამოჩნდება და შეხსენება 24 და 1 საათით ადრე მოგივა (აპში).', 'When your trainer books you in, it shows up here and you get reminders 24 hours and 1 hour before (in the app).')));

    mount(body, h('div', { class: 'grid grid-main' },
      h('div', { class: 'tr-col' },
        section(t('მომავალი', 'Upcoming'), upList),
        ov.openSlots?.length ? section(t('თავისუფალი დრო ტრენერთან', 'Open times with your trainer'), slotsCard(ov.openSlots, load)) : null,
        past.length ? section(t('ჩატარებული', 'Completed'), card({ class: 'tr-listcard' }, h('div', { class: 'tr-seslist' }, past.map((s) => sessionRow(s, { href: `/trainer/session/${s.id}` }))))) : null,
        cancelled.length ? section(t('გაუქმებული', 'Cancelled'), card({ class: 'tr-listcard' }, h('div', { class: 'tr-seslist' }, cancelled.map((s) => sessionRow(s))))) : null),
      h('div', { class: 'tr-col tr-sticky' },
        section(t('სტატისტიკა', 'Stats'), card({ class: 'stack' },
          h('div', { class: 'tr-attend' },
            ring({ value: done, max: judged || 1, size: 104, stroke: 10, label: judged ? `${Math.round((done / judged) * 100)}%` : '—', sub: t('დასწრება', 'Attendance'), labelScale: 0.22 }),
            h('div', { class: 'tr-attend-stats' },
              stat(t('ჩატარდა', 'Done'), fmtNum(ov.stats?.done ?? 0), { icon: 'check' }),
              stat(t('გამოტოვა', 'Missed'), fmtNum(ov.stats?.noShow ?? 0), { icon: 'x' }),
              avg != null ? stat(t('საშ. შეფასება', 'Avg. rating'), fmtNum(avg, 1), { icon: 'star', unit: '/ 5' }) : null)),
          weeklySessionsChart(past))))));
  }

  await load();
}

/** DONE vs missed per week over the last 8 weeks (from the sessions the overview returns). */
function weeklySessionsChart(past, weeks = 8) {
  if (!past?.length) return h('p', { class: 'muted tr-small' }, t('ჩატარებული ვარჯიშები აქ გამოჩნდება კვირების მიხედვით.', 'Completed sessions will show up here by week.'));
  const today = tbYmd();
  const monday = addYmd(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const starts = Array.from({ length: weeks }, (_, i) => addYmd(monday, (i - weeks + 1) * 7));
  const done = starts.map(() => 0);
  const missed = starts.map(() => 0);
  for (const s of past) {
    const d = tbYmd(s.startsAt);
    const i = starts.findIndex((w, j) => d >= w && (j === weeks - 1 || d < starts[j + 1]));
    if (i < 0) continue;
    if (s.status === 'DONE') done[i] += 1; else if (s.status === 'NO_SHOW') missed[i] += 1;
  }
  return h('div', null,
    h('div', { class: 'between', style: { marginBottom: '6px' } }, h('div', { class: 'card-title' }, t('ვარჯიშები კვირაში', 'Sessions per week')),
      h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--c1)' } }), t('ჩატარდა', 'Done')), h('span', null, h('i', { style: { background: 'var(--c4)' } }), t('გამოტოვა', 'Missed')))),
    barChart({
      labels: starts.map(shortYmd), tipLabels: starts.map((w) => `${shortYmd(w)} – ${shortYmd(addYmd(w, 6))}`), height: 180,
      stacked: [{ name: t('ჩატარდა', 'Done'), values: done, color: 'var(--c1)' }, { name: t('გამოტოვა', 'Missed'), values: missed, color: 'var(--c4)' }],
    }));
}

/* ═══ Page: one session (/trainer/session/:id) ═══════════ */
async function sessionDetailPage(root, ctx, id) {
  ctx.setTitle(t('ვარჯიში', 'Workout'));
  const head = h('div', null, pageHead(t('ვარჯიში', 'Workout'), ''));
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer/sessions', t('ვარჯიშები', 'Sessions')), head, body);
  let s = null;

  async function load() {
    try {
      s = (await A.session(id)).session;
      draw();
    } catch (e) { mount(body, errorBox(e, load)); }
  }

  function draw() {
    mount(head, pageHead(s.kindLabel, `${dayLabel(tbYmd(s.startsAt))} · ${clockOf(s.startsAt)} · ${s.durationMin} ${t('წთ', 'min')}`));
    const ex = s.exercises || [];
    const volume = ex.reduce((sum, e) => sum + (e.sets ?? 0) * (e.reps ?? 0) * (e.kg ?? 0), 0);
    const weighted = ex.filter((e) => e.sets && e.reps && e.kg);
    const w = s.workout;

    const rate = async (n) => {
      const prev = s.clientRating;
      s.clientRating = n;
      draw();
      try { s = { ...s, ...(await A.rate(s.id, n)).session }; toast(t('მადლობა შეფასებისთვის', 'Thanks for rating')); draw(); } catch (e) { s.clientRating = prev; toast(errMsg(e), 'error'); draw(); }
    };

    mount(body, h('div', { class: 'grid grid-main' },
      h('div', { class: 'tr-col' },
        card({ class: 'pad-lg' },
          h('div', { class: 'between' }, h('div', { class: 'card-title', style: { fontSize: '17px' } }, s.kindLabel), sessionBadge(s)),
          h('div', { class: 'stats-row', style: { marginTop: '16px' } },
            stat(t('ხანგრძლივობა', 'Duration'), `${s.durationMin}`, { unit: t('წთ', 'min'), icon: 'timer' }),
            stat(t('სავარჯიშო', 'Exercises'), String(ex.length), { icon: 'dumbbell' }),
            stat(t('მოცულობა', 'Volume'), volume ? fmtNum(Math.round(volume)) : '—', { unit: volume ? t('კგ', 'kg') : '', icon: 'trendUp' })),
          s.gym ? h('div', { class: 'tr-fact', style: { marginTop: '14px' } }, icon('mapPin', { size: 15 }), h('span', null, `${gymLine(s.gym)}, ${s.gym.city}`)) : null,
          s.note ? h('p', { class: 'tr-quote' }, `„${s.note}“`) : null,
          s.status === 'CANCELLED' ? h('p', { class: 'muted tr-small', style: { marginTop: '10px' } },
            t(`გააუქმა ${s.cancelledBy === 'CLIENT' ? 'შენ' : 'ტრენერმა'}${s.cancelReason ? ` — „${s.cancelReason}“` : ''}`, `Cancelled by ${s.cancelledBy === 'CLIENT' ? 'you' : 'your trainer'}${s.cancelReason ? ` — “${s.cancelReason}”` : ''}`)) : null,
          s.status === 'SCHEDULED' ? h('div', { class: 'hstack', style: { marginTop: '16px' } },
            !s.clientConfirmedAt ? button(t('მოვალ ✓', 'I’ll be there ✓'), { onClick: (e) => confirmFlow(e.currentTarget, s, load) }) : badge(t('დადასტურებული', 'Confirmed'), 'brand'),
            button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => cancelSessionFlow(s, load) })) : null),
        ex.length ? section(t('სავარჯიშოები', 'Exercises'), card({ class: 'flush' }, h('div', { class: 'table-wrap' }, h('table', { class: 'table tr-extable' },
          h('thead', null, h('tr', null, h('th', null, t('სავარჯიშო', 'Exercises')), h('th', null, t('სეტი × გამ.', 'Sets × reps')), h('th', null, t('წონა', 'Weight')), h('th', null, t('დრო', 'Time')))),
          h('tbody', null, ex.map((e) => h('tr', null,
            h('td', null, h('strong', null, e.name)),
            h('td', { class: 'num' }, e.sets && e.reps ? `${e.sets} × ${e.reps}` : '—'),
            h('td', { class: 'num' }, e.kg ? `${fmtNum(e.kg, 1)} ${t('კგ', 'kg')}` : '—'),
            h('td', { class: 'num' }, e.minutes ? `${fmtNum(e.minutes)} ${t('წთ', 'min')}` : '—')))))))) : null,
        weighted.length >= 2 ? section(t('მოცულობა სავარჯიშოების მიხედვით', 'Volume by exercise'), card(barChart({
          labels: weighted.map((e) => e.name.length > 12 ? `${e.name.slice(0, 11)}…` : e.name), tipLabels: weighted.map((e) => e.name),
          values: weighted.map((e) => Math.round(e.sets * e.reps * e.kg)), unit: t('კგ', 'kg'), height: 200, color: 'var(--c2)',
        }))) : null,
        s.trainerNote ? section(t('ტრენერის შენიშვნა', 'Trainer’s note'), card(h('p', { class: 'tr-note' }, s.trainerNote))) : null),
      h('div', { class: 'tr-col tr-sticky' },
        s.status === 'DONE' ? section(t('როგორ იყო ვარჯიში?', 'How was the session?'), card({ class: 'tr-rate' }, stars(s.clientRating, rate), h('p', { class: 'faint tr-small' }, s.clientRating ? t('შეფასება ტრენერს ეხმარება, უკეთ დაგეგმოს.', 'Your rating helps your trainer plan better.') : t('შეაფასე 1-დან 5-მდე.', 'Rate it from 1 to 5.')))) : null,
        w ? section(t('შენი საათიდან / ტელეფონიდან', 'From your watch / phone'), card({ class: 'stack' },
          h('div', { class: 'card-title' }, workoutKindLabel(w.kind)),
          h('div', { class: 'tr-kpis' },
            h('div', null, h('strong', null, `${w.durationMin}`), h('span', null, t('წუთი', 'min'))),
            h('div', null, h('strong', { style: { color: 'var(--ink-amber)' } }, w.kcal != null ? fmtNum(w.kcal) : '—'), h('span', null, t('კკალ', 'kcal'))),
            h('div', null, h('strong', { style: { color: 'var(--ink-rose)' } }, w.avgHeartRate != null ? fmtNum(w.avgHeartRate) : '—'), h('span', null, t('საშ. პულსი', 'Avg. HR')))),
          h('p', { class: 'faint tr-small' }, `${w.source === 'apple_health' ? 'Apple Health' : 'Health Connect'} · ${clockOf(w.startedAt)}–${clockOf(w.endedAt)}`)))
          : s.status === 'DONE' ? appHint(t('საათით ან ტელეფონით ჩაწერილი ვარჯიში (კალორია, პულსი) აქ ავტომატურად მიებმება, თუ „ვარჯიშებს“ უზიარებ და იყენებ', 'A workout recorded by a watch or phone (calories, heart rate) is attached here automatically if you share “Workouts” and use the')) : null)));
  }

  await load();
}

/* ═══ Page: meal plan (/trainer/plan) ════════════════════ */
async function planPage(root, ctx) {
  ctx.setTitle(t('კვების გეგმა', 'Meal plan'));
  const head = h('div', null, pageHead(t('კვების გეგმა', 'Meal plan'), ''));
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', t('ჩემი ტრენერი', 'My trainer')), head, body);

  async function load() {
    try { draw(await A.overview()); } catch (e) { mount(body, errorBox(e, load)); }
  }

  function draw(ov) {
    const plan = ov?.plan;
    mount(head, pageHead(t('კვების გეგმა', 'Meal plan'), ov?.trainer?.displayName ? t(`ტრენერი: ${ov.trainer.displayName}`, `Trainer: ${ov.trainer.displayName}`) : '', plan ? button(t('კვების ჩაწერა', 'Log food'), { icon: 'plus', href: '/nutrition' }) : null));
    if (!plan) {
      mount(body, card(empty(t('გეგმა ჯერ არ არის', 'No plan yet'), t('როცა ტრენერი კვების გეგმას გამოგიგზავნის, აქ გამოჩნდება და შეტყობინება მოგივა.', 'When your trainer sends you a meal plan, it shows up here and you’ll be notified.'), button(t('ჩემი ტრენერი', 'My trainer'), { href: '/trainer', variant: 'ghost' }))));
      return;
    }
    const days = ov.nutrition?.days || [];
    const today = days[days.length - 1];
    const left = plan && today ? plan.targets.calories - today.calories : null;
    const score = ov.nutrition?.score;

    mount(body, h('div', { class: 'grid grid-main' },
      h('div', { class: 'tr-col' },
        card({ class: 'pad-lg' },
          h('div', { class: 'card-title', style: { fontSize: '18px' } }, plan.title),
          plan.startsOn ? h('div', { class: 'card-sub' }, t(`აქტიურია ${fmtDate(plan.startsOn)}-დან`, `Active since ${fmtDate(plan.startsOn)}`)) : null,
          h('div', { class: 'stats-row tr-targets' },
            stat(t('კალორია', 'Calories'), fmtNum(plan.targets.calories), { unit: t('კკალ / დღე', 'kcal / day'), icon: 'flame' }),
            plan.targets.protein ? stat(t('ცილა', 'Protein'), fmtNum(plan.targets.protein), { unit: t('გ', 'g') }) : null,
            plan.targets.carbs ? stat(t('ნახშირწყლები', 'Carbs'), fmtNum(plan.targets.carbs), { unit: t('გ', 'g') }) : null,
            plan.targets.fat ? stat(t('ცხიმი', 'Fat'), fmtNum(plan.targets.fat), { unit: t('გ', 'g') }) : null),
          today ? h('div', { class: 'tr-today' },
            h('div', { class: 'between' },
              h('span', { class: 'muted' }, t(`დღეს: ${fmtNum(today.calories)} / ${fmtNum(plan.targets.calories)} კკალ`, `Today: ${fmtNum(today.calories)} / ${fmtNum(plan.targets.calories)} kcal`)),
              h('strong', { class: `tr-tone-${DAY_STATUS_TONE[today.status]}` }, left != null && left >= 0 ? t(`დარჩა ${fmtNum(left)}`, `${fmtNum(left)} left`) : t(`გადაჭარბება ${fmtNum(Math.abs(left ?? 0))}`, `${fmtNum(Math.abs(left ?? 0))} over`))),
            progress(today.calories, plan.targets.calories, { ink: today.status === 'OVER' ? 'rose' : 'teal' })) : null),
        plan.meals?.length ? section(t('დღის მენიუ', 'Daily menu'), h('div', { class: 'grid grid-2' }, plan.meals.map((m) => {
          const kcal = (m.items || []).reduce((sum, it) => sum + (Number(it.calories) || 0), 0);
          return card({ class: 'tr-meal' },
            h('div', { class: 'between' },
              h('div', { class: 'card-title' }, SLOT_KA[m.slot] || m.slot),
              h('span', { class: 'faint tr-small' }, [m.time, kcal ? `${fmtNum(kcal)} ${t('კკალ', 'kcal')}` : null].filter(Boolean).join(' · '))),
            h('ul', { class: 'tr-items' }, (m.items || []).map((it) => h('li', null,
              h('span', null, it.name),
              h('small', null, [it.grams ? `${fmtNum(it.grams)} ${t('გ', 'g')}` : null, it.calories ? `${fmtNum(it.calories)} ${t('კკალ', 'kcal')}` : null, it.protein ? t(`ც ${fmtNum(it.protein)} გ`, `P ${fmtNum(it.protein)} g`) : null].filter(Boolean).join(' · '))))));
        }))) : null,
        plan.note ? section(t('ტრენერის რჩევა', 'Trainer’s tips'), card(h('p', { class: 'tr-note' }, plan.note))) : null,
        h('p', { class: 'disclaimer' }, icon('info', { size: 15 }), h('span', null, t('გეგმა ტრენერისგანაა და შენს კვების პროგრამას არ ცვლის. თუ გაქვს დიაბეტი, თირკმლის დაავადება, ორსულობა ან კვების დარღვევის ისტორია, გეგმა ექიმთანაც შეათანხმე.', 'This plan comes from your trainer and doesn’t replace your own nutrition program. If you have diabetes, kidney disease, are pregnant or have a history of an eating disorder, check the plan with your doctor too.')))),
      h('div', { class: 'tr-col tr-sticky' },
        section(t('ბოლო 7 დღე', 'Last 7 days'), card({ class: 'stack' },
          h('div', { class: 'hstack', style: { flexWrap: 'nowrap', gap: '16px' } },
            ring({ value: score ?? 0, max: 100, size: 88, stroke: 9, label: score != null ? `${score}%` : '—', labelScale: 0.22, color: score == null ? 'var(--bg3)' : score >= 70 ? 'var(--ok)' : score >= 40 ? 'var(--warn)' : 'var(--danger)' }),
            h('div', null, h('div', { class: 'card-title' }, t('გეგმის დაცვა', 'Plan adherence')), h('div', { class: 'card-sub' }, t('დასრულებული, ჩაწერილი დღეები: კალორია ±10 %, ცილა ≥ 85 %.', 'Completed, logged days: calories ±10%, protein ≥ 85%.')))),
          days.length ? barChart({
            labels: days.map((d) => String(Number(d.date.slice(8)))), tipLabels: days.map((d) => `${dayLabel(d.date)} · ${DAY_STATUS_LABEL[d.status]}`),
            values: days.map((d) => d.calories), goal: plan.targets.calories, goalLabel: `${fmtNum(plan.targets.calories)} ${t('კკალ', 'kcal')}`, unit: t('კკალ', 'kcal'), height: 180, highlightLast: true,
          }) : null,
          days.length ? dayStrip(days) : null,
          stripLegend(),
          h('div', { class: 'list tr-daylist' }, [...days].reverse().map((d) => h('div', { class: 'tr-dayrow' },
            h('span', null, dayLabel(d.date)),
            h('span', { class: 'muted' }, d.meals ? t(`${fmtNum(d.calories)} კკალ · ც ${fmtNum(d.protein)} გ`, `${fmtNum(d.calories)} kcal · P ${fmtNum(d.protein)} g`) : '—'),
            h('strong', { class: `tr-tone-${DAY_STATUS_TONE[d.status]}` }, DAY_STATUS_LABEL[d.status]))))))),
    ));
  }

  await load();
}

/* ═══ Page: progress (/trainer/progress) ═════════════════ */
async function progressPage(root, ctx) {
  ctx.setTitle(t('პროგრესი', 'Progress'));
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', t('ჩემი ტრენერი', 'My trainer')), pageHead(t('პროგრესი', 'Progress'), t('წონა, ვარჯიშები, კვება და ფოტოები — ერთ ადგილას. ფოტოებს მხოლოდ შენ ხედავ, თუ ტრენერს არ გაუზიარებ.', 'Weight, workouts, nutrition and photos — in one place. Only you see your photos unless you share them with your trainer.')), body);
  let pose = 'FRONT';
  let photos = [];
  let ov = null;
  let weights = [];
  let goal = null;
  let alive = true;
  const photoSlot = h('div');

  async function load() {
    try {
      const from = addYmd(tbYmd(), -119);
      const [p, o, daily, app] = await Promise.all([
        A.photos(),
        A.overview().catch(() => null),
        get('/api/health-metrics/daily', { from, to: tbYmd() }).catch(() => null),
        get('/api/account/app-state').catch(() => null),
      ]);
      if (!alive) return;
      photos = p.photos || [];
      ov = o;
      const byDate = new Map();
      for (const d of daily?.daily || []) if (d.weightKg != null) byDate.set(d.date, Number(d.weightKg));
      for (const l of [...(app?.state?.weightLogs || [])].sort((a, b) => String(a.at || a.date).localeCompare(String(b.at || b.date)))) {
        if (l?.date && Number.isFinite(Number(l.kg)) && l.date >= from) byDate.set(l.date, Number(l.kg));
      }
      weights = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, kg]) => ({ date, kg }));
      goal = app?.state?.weightGoal && Number.isFinite(Number(app.state.weightGoal.targetKg)) ? app.state.weightGoal : null;
      draw();
    } catch (e) { if (alive) mount(body, errorBox(e, load)); }
  }

  function draw() {
    const active = ov?.link?.status === 'ACTIVE';
    const current = weights.at(-1)?.kg ?? null;
    const first = weights[0]?.kg ?? null;
    const delta = current != null && first != null && weights.length > 1 ? Math.round((current - first) * 10) / 10 : null;
    const remaining = goal && current != null ? Math.round((current - goal.targetKg) * 10) / 10 : null;

    const weightCard = weights.length >= 2
      ? card(
        h('div', { class: 'between', style: { marginBottom: '8px' } }, h('div', { class: 'card-title' }, t('წონა · 120 დღე', 'Weight · 120 days')),
          h('a', { class: 'link', href: '/health', 'data-link': '' }, t('აწონვა', 'Weigh in'), icon('chevronRight', { size: 16 }))),
        lineChart({
          labels: weights.map((w) => shortYmd(w.date)), tipLabels: weights.map((w) => dayLabel(w.date)),
          series: [{ name: t('წონა', 'Weight'), values: weights.map((w) => w.kg), color: 'var(--c5)', dots: weights.length < 25 }],
          goal: goal?.targetKg ?? null, goalLabel: goal ? t(`მიზანი ${fmtNum(goal.targetKg, 1)} კგ`, `Goal ${fmtNum(goal.targetKg, 1)} kg`) : undefined, unit: t('კგ', 'kg'), height: 240, zero: false, fmt: (v) => fmtNum(v, 1),
        }))
      : card(empty(t('წონის ისტორია ჯერ არ არის', 'No weight history yet'), t('აიწონე რამდენჯერმე და აქ დაინახავ ტრენდს.', 'Weigh yourself a few times and you’ll see the trend here.'), button(t('წონის ჩაწერა', 'Log weight'), { href: '/health', icon: 'scale', variant: 'secondary' })));

    const nd = ov?.nutrition?.days || [];
    mount(body,
      h('div', { class: 'stats-row tr-progress-stats' },
        card(stat(t('მიმდინარე წონა', 'Current weight'), current != null ? fmtNum(current, 1) : '—', { unit: current != null ? t('კგ', 'kg') : '', icon: 'scale', delta: delta != null ? t(`${delta > 0 ? '+' : ''}${fmtNum(delta, 1)} კგ 120 დღეში`, `${delta > 0 ? '+' : ''}${fmtNum(delta, 1)} kg in 120 days`) : undefined, deltaTone: delta != null && goal ? ((goal.targetKg < goal.startKg) === (delta < 0) ? 'up' : 'down') : '' })),
        card(stat(t('მიზნამდე', 'To goal'), remaining != null ? fmtNum(Math.abs(remaining), 1) : '—', { unit: remaining != null ? t('კგ', 'kg') : '', icon: 'target', delta: goal ? t(`მიზანი ${fmtNum(goal.targetKg, 1)} კგ`, `Goal ${fmtNum(goal.targetKg, 1)} kg`) : t('მიზანი არ არის', 'No goal') })),
        card(stat(t('ჩატარებული ვარჯიში', 'Completed sessions'), active ? fmtNum(ov.stats?.done ?? 0) : '—', { icon: 'dumbbell', delta: active ? t(`გამოტოვა ${ov.stats?.noShow ?? 0}`, `Missed ${ov.stats?.noShow ?? 0}`) : t('ტრენერი არ გყავს', 'No trainer') })),
        card(stat(t('კვების დაცვა', 'Plan adherence'), ov?.nutrition?.score != null ? `${ov.nutrition.score}%` : '—', { icon: 'utensils', delta: ov?.plan ? t('ბოლო 7 დღე', 'Last 7 days') : t('გეგმა არ არის', 'No plan') }))),
      h('div', { class: 'grid grid-main', style: { marginTop: '16px' } },
        section(t('წონა', 'Weight'), weightCard),
        h('div', { class: 'tr-col' },
          section(t('ვარჯიშები', 'Sessions'), card(active ? weeklySessionsChart(ov.past || []) : h('p', { class: 'muted tr-small' }, t('ტრენერთან ვარჯიშები აქ გამოჩნდება კვირების მიხედვით.', 'Sessions with your trainer will show up here by week.')))),
          nd.length && ov?.plan ? section(t('კვების გეგმა', 'Meal plan'), card({ class: 'stack' },
            barChart({ labels: nd.map((d) => String(Number(d.date.slice(8)))), tipLabels: nd.map((d) => `${dayLabel(d.date)} · ${DAY_STATUS_LABEL[d.status]}`), values: nd.map((d) => d.calories), goal: ov.plan.targets.calories, unit: t('კკალ', 'kcal'), height: 150, highlightLast: true }),
            dayStrip(nd, false)), { link: { href: '/trainer/plan', label: t('გეგმა', 'Plan') } }) : null)),
      section(t('ფოტო-პროგრესი', 'Photo progress'), photoSlot));
    drawPhotos();
  }

  function latestWeight() { return weights.at(-1)?.kg ?? (Number(session.profile?.weightKg) || null); }

  function drawPhotos() {
    const active = ov?.link?.status === 'ACTIVE';
    const shared = active && ov.link.scopes?.photos;
    const same = photos.filter((p) => p.pose === pose).sort((a, b) => a.takenOn.localeCompare(b.takenOn));
    const pair = same.length >= 2 ? { before: same[0], after: same[same.length - 1] } : null;

    const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', hidden: true });
    const addBtn = button(t(`ფოტოს დამატება · ${POSE_LABEL[pose]}`, `Add photo · ${POSE_LABEL[pose]}`), { icon: 'upload' });
    addBtn.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', () => {
      const f = fileIn.files?.[0];
      fileIn.value = '';
      if (!f) return;
      if (f.size > 15 * 1024 * 1024) { toast(t('ფოტო 15 მბ-ზე დიდია.', 'The photo is larger than 15 MB.'), 'error'); return; }
      busy(addBtn, async () => {
        try {
          const fd = new FormData();
          fd.append('pose', pose);
          fd.append('takenOn', tbYmd());
          const kg = latestWeight();
          if (kg) fd.append('weightKg', String(kg));
          fd.append('file', f, f.name || 'photo.jpg');
          await post('/api/trainer/photos', fd, { timeoutMs: 90_000 });
          photos = (await A.photos()).photos || [];
          toast(t('ფოტო დაემატა', 'Photo added'));
          drawPhotos();
        } catch (e) { toast(errMsg(e), 'error'); }
      });
    });

    const remove = async (p) => {
      const ok = await confirmDialog({ title: t('ფოტოს წაშლა', 'Delete photo'), body: t(`${POSE_LABEL[p.pose]} · ${fmtDate(p.takenOn, { year: true })}. წაშლა შეუქცევადია.`, `${POSE_LABEL[p.pose]} · ${fmtDate(p.takenOn, { year: true })}. This can’t be undone.`), confirm: t('წაშლა', 'Delete'), danger: true });
      if (!ok) return;
      try {
        await del(`/api/trainer/photos/${enc(p.id)}`);
        photos = photos.filter((x) => x.id !== p.id);
        toast(t('ფოტო წაიშალა', 'Photo deleted'));
        drawPhotos();
      } catch (e) { toast(errMsg(e), 'error'); }
    };

    const byDate = new Map();
    for (const p of [...photos].sort((a, b) => b.takenOn.localeCompare(a.takenOn))) {
      if (!byDate.has(p.takenOn)) byDate.set(p.takenOn, []);
      byDate.get(p.takenOn).push(p);
    }

    mount(photoSlot, card({ class: 'pad-lg tr-photos' },
      h('div', { class: 'between' },
        segmented(['FRONT', 'SIDE', 'BACK'].map((k) => ({ value: k, label: POSE_LABEL[k] })), pose, (v) => { pose = v; drawPhotos(); }),
        h('div', { class: 'hstack' }, addBtn, fileIn)),
      h('div', { class: 'tr-photo-layout' },
        h('div', null,
          pair ? compare(pair.before, pair.after) : h('div', { class: 'tr-compare-empty' },
            h('div', { class: 'empty' },
              h('div', { class: 'empty-art' }, icon('camera', { size: 26 })),
              h('h3', null, same.length ? t('კიდევ ერთი ფოტო და შედარება გამოჩნდება', 'One more photo and the comparison appears') : t('პირველი ფოტო — შენი „მანამდე“', 'Your first photo — your “before”')),
              h('p', null, t('გადაიღე კვირაში ერთხელ, ერთსა და იმავე პოზაში. რამდენიმე კვირაში აქ დაინახავ განსხვავებას, რომელსაც სარკე ვერ გაჩვენებს.', 'Take one a week, in the same pose. In a few weeks you’ll see a difference here that the mirror can’t show you.'))))),
        h('div', { class: 'tr-photo-side' },
          h('div', { class: 'tr-mini' }, tile('lock', 'teal', 36),
            h('p', { class: 'muted tr-small' }, t('ფოტოები დაცულად ინახება და მხოლოდ შენ ხედავ. ', 'Photos are stored securely and only you can see them. '),
              active ? (shared ? t('შენი ტრენერიც ხედავს (გაზიარებაში ჩართულია).', 'Your trainer sees them too (turned on in sharing).') : t('ტრენერს არ უჩანს — ჩართე „პროგრეს-ფოტოები“ გაზიარებაში, თუ გინდა.', 'Your trainer can’t see them — turn on “Progress photos” in sharing if you want.')) : '')),
          h('p', { class: 'faint tr-small' }, t('ყოველთვის ერთნაირად გადაიღე: იგივე ადგილი, იგივე განათება, დილით.', 'Always take them the same way: same place, same light, in the morning.')),
          byDate.size ? h('div', { class: 'tr-history' }, [...byDate.entries()].map(([date, list]) => h('div', { class: 'tr-hist-day' },
            h('div', { class: 'tr-hist-label' }, `${dayLabel(date)}${list.find((p) => p.weightKg)?.weightKg ? ` · ${fmtNum(list.find((p) => p.weightKg).weightKg, 1)} ${t('კგ', 'kg')}` : ''}`),
            h('div', { class: 'tr-thumbs' }, list.map((p) => h('div', { class: `tr-thumb ${p.pose === pose ? 'on' : ''}` },
              h('button', { type: 'button', class: 'tr-thumb-btn', 'aria-label': `${POSE_LABEL[p.pose]}, ${p.takenOn}`, onClick: () => { pose = p.pose === 'OTHER' ? pose : p.pose; drawPhotos(); } },
                privateImg(p.url, POSE_LABEL[p.pose])),
              h('span', null, POSE_LABEL[p.pose]),
              iconButton('trash', { title: t('ფოტოს წაშლა', 'Delete photo'), class: 'tr-thumb-del', size: 16, onClick: () => remove(p) }))))))) : null))));
  }

  await load();
  return () => { alive = false; };
}

/** Before/after with a draggable divider (range input on top, keyboard accessible). */
function compare(before, after) {
  const wrap = h('div', { class: 'tr-compare' },
    privateImg(after.url, t('შემდეგ', 'After'), 'tr-compare-after'),
    h('div', { class: 'tr-compare-before' }, privateImg(before.url, t('მანამდე', 'Before'))),
    h('div', { class: 'tr-compare-line' }, h('span', null, '‹ ›')),
    h('span', { class: 'tr-compare-tag l' }, t(`მანამდე · ${shortYmd(before.takenOn)}`, `Before · ${shortYmd(before.takenOn)}`)),
    h('span', { class: 'tr-compare-tag r' }, t(`შემდეგ · ${shortYmd(after.takenOn)}`, `After · ${shortYmd(after.takenOn)}`)));
  wrap.style.setProperty('--split', '50%');
  const range = h('input', { type: 'range', min: 3, max: 97, value: 50, class: 'tr-compare-range', 'aria-label': t('მანამდე და შემდეგ — გადაათრიე გამყოფი', 'Before and after — drag the divider') });
  range.addEventListener('input', () => wrap.style.setProperty('--split', `${range.value}%`));
  wrap.appendChild(range);
  const kg = before.weightKg != null && after.weightKg != null ? Math.round((after.weightKg - before.weightKg) * 10) / 10 : null;
  return h('div', null, wrap,
    h('div', { class: 'between', style: { marginTop: '10px' } },
      h('strong', null, t(`${daysBetween(before.takenOn, after.takenOn)} დღე`, plural(daysBetween(before.takenOn, after.takenOn), 'day'))),
      kg != null ? h('strong', { class: kg <= 0 ? 'tr-tone-ok' : 'tr-tone-warn' }, `${kg > 0 ? '+' : ''}${fmtNum(kg, 1)} ${t('კგ', 'kg')}`) : null));
}

/* ═══ Page: become a trainer (/trainer/apply) ════════════ */
const STEPS = [t('შენ შესახებ', 'About you'), t('სპეციალიზაცია და დარბაზი', 'Specialties and gym'), t('სერტიფიკატები', 'Certificates')];

async function applyPage(root, ctx) {
  ctx.setTitle(t('ტრენერის რეგისტრაცია', 'Trainer sign-up'));
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', t('ჩემი ტრენერი', 'My trainer')), body);
  let profile;
  let catalog = null;
  let editing = false;
  let justSent = false;
  let step = 0;
  const f = { name: '', bio: '', years: '', instagram: '', specialties: [], gyms: [], staged: [] };
  const hint = h('div', { class: 'form-error', hidden: true });

  const setHint = (msg, action) => {
    if (!msg) { hint.hidden = true; return; }
    mount(hint, h('span', null, msg), action || null);
    hint.hidden = false;
  };

  function hydrate(p) {
    profile = p;
    if (p) {
      Object.assign(f, {
        name: p.displayName, bio: p.bio || '', years: p.experienceYears != null ? String(p.experienceYears) : '',
        instagram: p.instagram ? `@${p.instagram}` : '', specialties: [...(p.specialties || [])], gyms: [...(p.gyms || [])],
      });
    } else if (!f.name) {
      const n = String(session.user?.fullName || '').trim();
      f.name = n && n !== 'Medicard მომხმარებელი' ? n : '';
    }
  }

  async function load() {
    try {
      const [me, cat] = await Promise.all([A.me(), A.catalog()]);
      catalog = cat;
      hydrate(me.trainerProfile);
      draw();
    } catch (e) { mount(body, errorBox(e, load)); }
  }

  const draw = () => (profile && !editing ? drawStatus() : drawForm());

  function validate(s) {
    if (s === 0 && f.name.trim().length < 2) return t('მიუთითე სახელი, რომლითაც კლიენტები გიცნობენ.', 'Enter the name clients know you by.');
    if (s === 1 && !f.gyms.length) return t('აირჩიე მინიმუმ ერთი დარბაზი, სადაც ვარჯიშებს ატარებ.', 'Choose at least one gym where you train clients.');
    return null;
  }

  async function ensurePhone(reason) {
    if (hasVerifiedPhone(session.user)) return true;
    const { offerPhoneVerification } = await import('./quest.js');
    return offerPhoneVerification(reason);
  }

  async function submit(btn) {
    for (const s of [0, 1]) {
      const problem = validate(s);
      if (problem) { step = s; drawForm(); setHint(problem); return; }
    }
    const phoneReason = t('ტრენერის პროფილისთვის ტელეფონის დადასტურება საჭიროა — ასე კლიენტები დარწმუნებულები არიან, რომ რეალურ ადამიანთან აქვთ საქმე.', 'A trainer profile needs a verified phone — so clients know they’re dealing with a real person.');
    if (!(await ensurePhone(phoneReason))) return;
    await busy(btn, async () => {
      setHint(null);
      const payload = {
        displayName: f.name.trim(), bio: f.bio.trim(), specialties: f.specialties,
        experienceYears: f.years ? Number(f.years) : null, instagram: f.instagram.trim(), gymIds: f.gyms.map((g) => g.id),
      };
      let res;
      try {
        res = await post('/api/trainer/apply', payload);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'PHONE_VERIFICATION_REQUIRED') {
          const { offerPhoneVerification } = await import('./quest.js');
          if (await offerPhoneVerification(phoneReason)) setHint(t('ტელეფონი დადასტურდა — გააგზავნე ხელახლა.', 'Phone verified — send it again.'));
          return;
        }
        if (e instanceof ApiError && e.code === 'BIRTHDATE_REQUIRED') {
          setHint(e.message, h('a', { class: 'link', href: '/profile', 'data-link': '', style: { marginLeft: '8px' } }, t('პროფილის გახსნა', 'Open profile')));
          return;
        }
        setHint(e instanceof ApiError ? e.message : t('ვერ გაიგზავნა. შეამოწმე ინტერნეტი და სცადე ხელახლა.', 'Couldn’t send. Check your internet connection and try again.'));
        return;
      }
      let latest = res.trainerProfile;
      const failed = [];
      for (const sc of f.staged) {
        try { latest = (await uploadCert(sc)).trainerProfile; } catch { failed.push(sc.title); }
      }
      f.staged = [];
      hydrate(latest);
      editing = false;
      justSent = true;
      loadSession().catch(() => {}); // the „ტრენერის სივრცე“ menu item appears for any trainer profile
      draw();
      if (failed.length) toast(t(`${failed.join(', ')} — სერტიფიკატი ვერ აიტვირთა. სცადე ხელახლა „რედაქტირებიდან“.`, `${failed.join(', ')} — certificate upload failed. Try again from “Edit”.`), 'error', { ms: 6000 });
      else toast(profile?.status === 'PENDING' ? t('განაცხადი გაიგზავნა', 'Application sent') : t('ცვლილებები შენახულია', 'Changes saved'));
    });
  }

  function uploadCert(sc) {
    const fd = new FormData();
    fd.append('title', sc.title);
    if (sc.issuer) fd.append('issuer', sc.issuer);
    if (sc.year) fd.append('year', sc.year);
    fd.append('file', sc.file, sc.file.name || 'certificate.jpg');
    return post('/api/trainer/certificates', fd, { timeoutMs: 90_000 });
  }

  async function removeCert(c) {
    const ok = await confirmDialog({ title: t('სერტიფიკატის წაშლა', 'Delete certificate'), body: c.title, confirm: t('წაშლა', 'Delete'), danger: true });
    if (!ok) return;
    try {
      const res = await del(`/api/trainer/certificates/${enc(c.id)}`);
      profile = res.trainerProfile;
      toast(t('სერტიფიკატი წაიშალა', 'Certificate deleted'));
      draw();
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  /* ── form ── */
  function drawForm() {
    const last = step === STEPS.length - 1;
    const sendLabel = profile ? (profile.status === 'REJECTED' ? t('ხელახლა გაგზავნა', 'Resubmit') : t('ცვლილებების შენახვა', 'Save changes')) : t('განაცხადის გაგზავნა', 'Send application');
    const nextBtn = last ? button(sendLabel, { icon: 'send' }) : button(t('შემდეგი', 'Next'), { icon: 'arrowRight' });
    nextBtn.addEventListener('click', () => {
      if (last) { submit(nextBtn); return; }
      const problem = validate(step);
      setHint(problem);
      if (!problem) { step += 1; drawForm(); }
    });
    const stepBody = step === 0 ? stepAbout() : step === 1 ? stepGyms() : stepCerts();
    const formCard = card({ class: 'pad-lg tr-apply' },
      h('div', { class: 'onb-steps' }, STEPS.map((_, i) => h('i', { class: i <= step ? 'on' : '' }))),
      h('div', { class: 'tr-step-label' }, t(`ნაბიჯი ${step + 1} / ${STEPS.length} · ${STEPS[step]}`, `Step ${step + 1} / ${STEPS.length} · ${STEPS[step]}`)),
      stepBody,
      hint,
      h('div', { class: 'between tr-apply-foot' },
        step > 0 ? button(t('უკან', 'Back'), { variant: 'ghost', icon: 'chevronLeft', onClick: () => { setHint(null); step -= 1; drawForm(); } }) : (profile ? button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => { editing = false; setHint(null); draw(); } }) : h('span')),
        nextBtn));

    const aside = !profile
      ? card({ class: 'spotlight hero-card pad-lg tr-hero' },
        tile('award', 'teal', 44),
        h('h2', null, t('ტრენერის სამუშაო სივრცე — უფასოდ', 'Trainer workspace — free')),
        h('ul', { class: 'tr-points' }, [t('კალენდარი და ჯავშნები შეხსენებებით', 'Calendar and bookings with reminders'), t('კლიენტები QR-ით, ერთი დასკანერებით', 'Clients by QR, with a single scan'), t('კვების გეგმა და კლიენტის პროგრესი', 'Meal plans and client progress')]
          .map((trn) => h('li', null, icon('check', { size: 18 }), h('span', null, trn)))),
        h('p', { class: 'muted tr-small' }, t('საჭიროა დადასტურებული ტელეფონი და 18+. პროფილს MEDICARD-ის გუნდი ამოწმებს 1–2 სამუშაო დღეში.', 'You need a verified phone and to be 18+. The MEDICARD team checks your profile within 1–2 working days.')))
      : null;

    mount(body,
      pageHead(profile ? t('განაცხადის რედაქტირება', 'Edit application') : t('ტრენერის რეგისტრაცია', 'Trainer sign-up'), t('კლიენტები გნახავენ ძიებაში, როცა MEDICARD-ის გუნდი პროფილს დაადასტურებს.', 'Clients will find you in search once the MEDICARD team approves your profile.')),
      h('div', { class: 'grid grid-main' }, formCard, h('div', { class: 'tr-col tr-sticky' }, aside, section(t('შეჯამება', 'Summary'), summaryCard()))));
  }

  function stepAbout() {
    const name = input({ value: f.name, maxlength: 60, placeholder: t('მაგ. ნიკა ბერიძე', 'e.g. Nika Beridze'), onInput: (e) => { f.name = e.target.value; } });
    const bio = textarea({ value: f.bio, maxlength: 800, rows: 5, placeholder: t('მაგ. 6 წელია ვმუშაობ ძალოვან ვარჯიშსა და წონის კლებაზე…', 'e.g. I’ve been working on strength training and weight loss for 6 years…'), onInput: (e) => { f.bio = e.target.value; } });
    const years = input({ value: f.years, inputmode: 'numeric', maxlength: 2, placeholder: '5', onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2); f.years = e.target.value; } });
    const ig = input({ value: f.instagram, maxlength: 31, autocapitalize: 'none', autocomplete: 'off', placeholder: '@username', onInput: (e) => { f.instagram = e.target.value; } });
    return h('div', { class: 'form' },
      field(t('სახელი, რომლითაც კლიენტები გიცნობენ', 'The name clients know you by'), name),
      field(t('შენს შესახებ', 'About you'), bio, t('მიდგომა, გამოცდილება, რისი მიღწევა შეუძლია კლიენტს შენთან. ფასი, თუ გინდა, აქ ჩაწერე — აპში გადახდა არ ხდება.', 'Your approach, experience, what clients can achieve with you. Add your prices here if you like — there are no payments in the app.')),
      h('div', { class: 'form-row' }, field(t('გამოცდილება, წელი', 'Experience, years'), years), field('Instagram', ig)));
  }

  function stepGyms() {
    const chips = h('div', { class: 'chips' });
    const drawChips = () => mount(chips, (catalog?.specialties || []).map((sp) => {
      const on = f.specialties.includes(sp.key);
      return h('button', {
        type: 'button', class: `chip ${on ? 'on' : ''}`, 'aria-pressed': on ? 'true' : 'false',
        onClick: () => {
          if (on) f.specialties = f.specialties.filter((k) => k !== sp.key);
          else if (f.specialties.length < 6) f.specialties = [...f.specialties, sp.key];
          else { toast(t('მაქსიმუმ 6 სპეციალიზაცია', 'Up to 6 specialties'), 'info'); return; }
          drawChips();
          refreshSummary();
        },
      }, on ? icon('check', { size: 14 }) : null, sp.label);
    }));
    drawChips();

    const gymList = h('div', { class: 'stack', style: { gap: '8px' } });
    const drawGyms = () => mount(gymList,
      f.gyms.map((g) => h('div', { class: 'tr-gymrow' },
        tile('mapPin', g.status === 'PROPOSED' ? 'amber' : 'blue', 36),
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, gymLine(g)), h('div', { class: 'row-sub' }, [g.city, g.address].filter(Boolean).join(' · ')),
          g.status === 'PROPOSED' ? badge(t('ახალი დარბაზი — გადამოწმდება', 'New gym — pending review'), 'warn') : null),
        iconButton('x', { title: t(`${g.brand} წაშლა`, `Remove ${g.brand}`), onClick: () => { f.gyms = f.gyms.filter((x) => x.id !== g.id); drawGyms(); refreshSummary(); } }))),
      f.gyms.length < 5 ? h('div', { class: 'hstack' },
        button(f.gyms.length ? t('კიდევ ერთი დარბაზი', 'Another gym') : t('დარბაზის არჩევა', 'Choose a gym'), {
          variant: 'secondary', icon: 'plus',
          onClick: () => gymPicker((g) => { if (g && !f.gyms.some((x) => x.id === g.id)) { f.gyms = [...f.gyms, g]; setHint(null); drawGyms(); refreshSummary(); } }, { exclude: f.gyms.map((g) => g.id), allowAll: false }),
        }),
        button(t('ჩემი დარბაზი სიაში არ არის', 'My gym isn’t on the list'), { variant: 'ghost', onClick: proposeGym })) : null);
    drawGyms();

    function proposeGym() {
      formModal({
        title: t('ახალი დარბაზი', 'New gym'),
        size: 'sm',
        submit: t('დამატება', 'Add'),
        fields: [
          h('p', { class: 'muted' }, t('დაამატე დარბაზი — გუნდი გადაამოწმებს და ყველასთვის გამოჩნდება.', 'Add a gym — the team checks it and then it’s visible to everyone.')),
          field(t('დარბაზის სახელი', 'Gym name'), input({ name: 'brand', maxlength: 80, required: true })),
          h('div', { class: 'form-row' }, field(t('ქალაქი', 'City'), input({ name: 'city', maxlength: 40, value: 'თბილისი' })), field(t('მისამართი (არასავალდ.)', 'Address (optional)'), input({ name: 'address', maxlength: 160 }))),
        ],
        onSubmit: async (v, close) => {
          if (String(v.brand || '').trim().length < 2) throw new Error(t('ჩაწერე დარბაზის სახელი.', 'Enter the gym name.'));
          const body2 = { brand: v.brand.trim(), city: String(v.city || '').trim() || 'თბილისი', address: String(v.address || '').trim() };
          let res;
          try {
            res = await post('/api/trainer/gyms', body2);
          } catch (e) {
            if (e instanceof ApiError && e.code === 'PHONE_VERIFICATION_REQUIRED') {
              close();
              const { offerPhoneVerification } = await import('./quest.js');
              await offerPhoneVerification();
              return;
            }
            throw e;
          }
          f.gyms = [...f.gyms, res.gym];
          close();
          setHint(null);
          drawGyms();
          refreshSummary();
        },
      });
    }

    return h('div', { class: 'stack', style: { gap: '22px' } },
      h('div', null, h('h3', { class: 'tr-h3' }, t('სპეციალიზაცია', 'Specialties')), h('p', { class: 'faint tr-small', style: { margin: '-4px 0 10px' } }, t('აირჩიე 6-მდე', 'Choose up to 6')), chips),
      h('div', null, h('h3', { class: 'tr-h3' }, t('სად ვარჯიშებ', 'Where you train')), gymList));
  }

  function stepCerts() {
    const title = input({ maxlength: 120, placeholder: t('დასახელება (მაგ. NASM CPT, დიპლომი)', 'Title (e.g. NASM CPT, diploma)') });
    const issuer = input({ maxlength: 120, placeholder: t('გამცემი', 'Issuer') });
    const year = input({ inputmode: 'numeric', maxlength: 4, placeholder: t('წელი', 'Year'), onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); } });
    const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', hidden: true });
    const pick = button(t('ფოტოს არჩევა და დამატება', 'Choose and add photo'), { variant: 'secondary', icon: 'upload' });
    pick.addEventListener('click', () => {
      if (title.value.trim().length < 2) { setHint(t('ჯერ ჩაწერე სერტიფიკატის დასახელება.', 'Enter the certificate title first.')); title.focus(); return; }
      fileIn.click();
    });
    fileIn.addEventListener('change', () => {
      const file = fileIn.files?.[0];
      fileIn.value = '';
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) { setHint(t('ფაილი 15 მბ-ზე დიდია.', 'The file is larger than 15 MB.')); return; }
      const item = { key: `${Date.now()}`, title: title.value.trim(), issuer: issuer.value.trim(), year: year.value.trim(), file, preview: URL.createObjectURL(file) };
      setHint(null);
      if (profile) {
        busy(pick, async () => {
          try {
            const res = await uploadCert(item);
            profile = res.trainerProfile;
            toast(t('სერტიფიკატი დაემატა', 'Certificate added'));
            drawForm();
          } catch (e) { setHint(errMsg(e)); }
        });
      } else {
        f.staged = [...f.staged, item];
        drawForm();
      }
    });

    const existing = (profile?.certificates || []).map((c) => h('div', { class: 'tr-gymrow' },
      tile('award', 'amber', 36),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, c.title), h('div', { class: 'row-sub' }, [c.issuer, c.year].filter(Boolean).join(' · ') || t('ფოტო ატვირთულია', 'Photo uploaded'))),
      iconButton('trash', { title: t('სერტიფიკატის წაშლა', 'Delete certificate'), onClick: () => removeCert(c) })));
    const staged = f.staged.map((sc) => h('div', { class: 'tr-gymrow' },
      h('img', { src: sc.preview, alt: '', class: 'tr-cert-prev' }),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, sc.title), h('div', { class: 'row-sub' }, [sc.issuer, sc.year].filter(Boolean).join(' · ') || t('აიტვირთება განაცხადთან ერთად', 'Uploads with the application'))),
      iconButton('x', { title: t('წაშლა', 'Delete'), onClick: () => { URL.revokeObjectURL(sc.preview); f.staged = f.staged.filter((x) => x.key !== sc.key); drawForm(); } })));

    return h('div', { class: 'stack', style: { gap: '16px' } },
      h('p', { class: 'muted tr-small' }, t('არასავალდებულოა, მაგრამ დადასტურებას მნიშვნელოვნად აჩქარებს. ფოტოს ხედავს მხოლოდ MEDICARD-ის გუნდი.', 'Optional, but it speeds up approval a lot. Only the MEDICARD team sees the photo.')),
      existing.length || staged.length ? h('div', { class: 'stack', style: { gap: '8px' } }, existing, staged) : null,
      h('div', { class: 'tr-certform' }, title, h('div', { class: 'form-row' }, issuer, year), h('div', { class: 'hstack' }, pick, fileIn)));
  }

  let summaryEl = null;
  function summaryCard() {
    summaryEl = card({ class: 'stack tr-summary' });
    refreshSummary();
    return summaryEl;
  }
  function refreshSummary() {
    if (!summaryEl) return;
    const certs = (profile?.certificates?.length || 0) + f.staged.length;
    mount(summaryEl,
      h('div', { class: 'card-title' }, `${f.name || '—'}${f.years ? t(` · ${f.years} წლის გამოცდილება`, ` · ${plural(Number(f.years), 'year')} of experience`) : ''}`),
      h('div', { class: 'tr-fact' }, icon('mapPin', { size: 15 }), h('span', null, f.gyms.map(gymLine).join(' · ') || t('დარბაზი არ არის არჩეული', 'No gym selected'))),
      h('div', { class: 'tr-fact' }, icon('sparkles', { size: 15 }), h('span', null, t(`${f.specialties.length} სპეციალიზაცია · ${certs} სერტიფიკატი`, `${plural(f.specialties.length, 'specialty', 'specialties')} · ${plural(certs, 'certificate')}`))));
  }

  /* ── status ── */
  function drawStatus() {
    const st = profile.status;
    const tone = st === 'VERIFIED' ? 'ok' : st === 'PENDING' ? 'warn' : 'danger';
    const sent = profile.submittedAt ? fmtDate(profile.submittedAt, { year: true }) : '';
    const steps = [
      { label: t('განაცხადი გაგზავნილია', 'Application sent'), detail: sent, done: true, current: false },
      { label: t('გუნდი ამოწმებს', 'The team is reviewing'), detail: st === 'PENDING' ? t('ჩვეულებრივ 1–2 სამუშაო დღე', 'Usually 1–2 working days') : st === 'REJECTED' ? t('დაზუსტება სჭირდება', 'Needs changes') : '', done: st === 'VERIFIED', current: st === 'PENDING' || st === 'REJECTED' },
      { label: t('დადასტურება და ტრენერის რეჟიმი', 'Approval and trainer mode'), detail: st === 'VERIFIED' ? t('მზადაა — მოიწვიე კლიენტები', 'Ready — invite your clients') : t('შეტყობინება მოგივა', 'You’ll be notified'), done: st === 'VERIFIED', current: false },
    ];
    const title = justSent && st === 'PENDING' ? t('განაცხადი გაიგზავნა!', 'Application sent!') : st === 'PENDING' ? t('განაცხადი განხილვაშია', 'Application under review') : st === 'VERIFIED' ? t('დადასტურებული ტრენერი ხარ', 'You’re a verified trainer') : st === 'REJECTED' ? t('განაცხადს დაზუსტება სჭირდება', 'Your application needs changes') : t('პროფილი შეჩერებულია', 'Profile suspended');
    const text = st === 'PENDING'
      ? t('MEDICARD-ის გუნდი ამოწმებს შენს პროფილს და სერტიფიკატებს. დადასტურებისას შეტყობინება მოგივა და ტრენერის რეჟიმი გაიხსნება.', 'The MEDICARD team is checking your profile and certificates. You’ll be notified when you’re approved and trainer mode will open.')
      : st === 'VERIFIED' ? t('კლიენტებს მოიწვევ QR-ით ან კოდით, ჩაწერ ვარჯიშებზე და ნახავ მათ პროგრესს — იმას, რასაც გაგიზიარებენ.', 'Invite clients by QR or code, book them into sessions and see their progress — whatever they share with you.')
        : st === 'REJECTED' ? (profile.reviewNote || t('გადახედე მონაცემებს, გაასწორე და გაგზავნე ხელახლა.', 'Review your details, fix them and send again.')) : t('დეტალებისთვის მოგვწერე support@medicard.ge', 'For details, write to support@medicard.ge');
    const edit = (to) => { editing = true; step = to; setHint(null); draw(); };

    const codeBox = st === 'VERIFIED' && profile.code ? card({ class: 'tr-mycode' },
      h('div', { class: 'card-sub' }, t('შენი ტრენერის კოდი', 'Your trainer code')),
      h('div', { class: 'tr-mycode-val' }, profile.code),
      profile.link ? h('div', { class: 'hstack' },
        h('span', { class: 'faint tr-small tr-ellipsis' }, profile.link),
        button(t('კოპირება', 'Copy'), {
          size: 'sm', variant: 'ghost', icon: 'copy',
          onClick: async () => { try { await navigator.clipboard.writeText(profile.link); toast(t('ბმული დაკოპირდა', 'Link copied')); } catch { toast(t('ვერ დაკოპირდა', 'Couldn’t copy'), 'error'); } },
        })) : null) : null;

    mount(body,
      h('div', { class: 'grid grid-main', style: { marginTop: '14px' } },
        h('div', { class: 'tr-col' },
          card({ class: 'pad-lg tr-status' },
            h('div', { class: `tr-status-icon tone-${tone}` }, icon(justSent && st === 'PENDING' ? 'sparkles' : st === 'VERIFIED' ? 'award' : st === 'PENDING' ? 'clock' : 'alert', { size: 40 })),
            h('h1', null, title),
            h('p', { class: 'muted' }, text),
            h('div', { class: 'tr-timeline' }, steps.map((s, i) => h('div', { class: `tr-tl ${s.done ? 'done' : ''} ${s.current ? `current tone-${tone}` : ''}` },
              h('div', { class: 'tr-tl-dot' }, s.done ? icon('check', { size: 15, stroke: 3 }) : String(i + 1)),
              h('div', null, h('div', { class: 'row-title' }, s.label), s.detail ? h('div', { class: 'row-sub' }, s.detail) : null)))),
            h('div', { class: 'hstack', style: { justifyContent: 'center', marginTop: '6px' } },
              st === 'VERIFIED' ? button(t('ტრენერის სივრცის გახსნა', 'Open trainer workspace'), { href: '/coach', icon: 'arrowRight' }) : null,
              st === 'REJECTED' ? button(t('გასწორება და ხელახლა გაგზავნა', 'Fix and resubmit'), { icon: 'edit', onClick: () => edit(0) }) : null,
              st === 'PENDING' || st === 'VERIFIED' ? button(profile.certificates.length ? t('განაცხადის რედაქტირება', 'Edit application') : t('სერტიფიკატის დამატება', 'Add certificate'), { variant: 'secondary', icon: 'edit', onClick: () => edit(profile.certificates.length ? 0 : 2) }) : null)),
          codeBox),
        h('div', { class: 'tr-col tr-sticky' },
          section(t('შენი განაცხადი', 'Your application'), card({ class: 'stack' },
            h('div', { class: 'card-title', style: { fontSize: '16px' } }, profile.displayName),
            profile.experienceYears ? h('div', { class: 'card-sub' }, t(`${profile.experienceYears} წლის გამოცდილება`, `${plural(profile.experienceYears, 'year')} of experience`)) : null,
            profile.specialties?.length && catalog ? h('div', { class: 'chips tr-chips-static' }, profile.specialties.map((k) => h('span', { class: 'chip' }, catalog.specialties.find((s) => s.key === k)?.label || k))) : null,
            (profile.gyms || []).map((g) => h('div', { class: 'tr-fact' }, icon('mapPin', { size: 15 }), h('span', null, `${gymLine(g)}, ${g.city}`))),
            profile.certificates.map((c) => h('div', { class: 'tr-fact' }, icon('award', { size: 15 }), h('span', { style: { flex: 1 } }, [c.title, c.issuer, c.year].filter(Boolean).join(' · ')),
              st !== 'VERIFIED' ? iconButton('trash', { title: t('სერტიფიკატის წაშლა', 'Delete certificate'), size: 16, onClick: () => removeCert(c) }) : null)),
            !profile.certificates.length ? h('p', { class: 'tr-tone-warn tr-small' }, t('სერტიფიკატი არ არის — დამატება დადასტურებას აჩქარებს.', 'No certificate — adding one speeds up approval.')) : null)))));
  }

  await load();
}

/* ═══ Page: scan (/trainer/scan) — QR works in the app; the web takes the code ═══ */
function scanPage(root, ctx) {
  ctx.setTitle(t('ტრენერის QR', 'Trainer QR'));
  mount(root, back('/trainer', t('ჩემი ტრენერი', 'My trainer')),
    pageHead(t('ტრენერის QR', 'Trainer QR'), t('კამერით სკანირება MEDICARD აპში მუშაობს. ვებზე იგივეს გააკეთებ ტრენერის 6-სიმბოლოიანი კოდით.', 'Camera scanning works in the MEDICARD app. On the web, do the same with the trainer’s 6-character code.')),
    h('div', { class: 'grid grid-main' },
      codeCard(ctx.navigate, { autofocus: true }),
      card({ class: 'tr-mini' }, tile('smartphone', 'sky', 42),
        h('div', null,
          h('p', { class: 'muted tr-small' }, t('ტრენერის QR ჩანს მის „პროფილის“ ტაბზე, კოდი კი — QR-ის ქვეშ. აპში: ჩემი ტრენერი → ტრენერის QR-ის სკანირება.', 'A trainer’s QR is on their “Profile” tab, with the code under it. In the app: My trainer → Scan trainer QR.')),
          h('a', { class: 'link', href: APP_STORE, target: '_blank', rel: 'noopener', style: { marginTop: '8px' } }, t('MEDICARD აპი', 'MEDICARD app'), icon('externalLink', { size: 14 }))))));
}

/* ═══ Home card ══════════════════════════════════════════ */
/** Home „ჩემი ტრენერი“: linked trainer + next session, an invitation, or a small „იპოვე ტრენერი“. Never throws. */
export function homeCard() {
  ensureCss();
  const box = card({ class: 'tr-home' }, skeleton(2));
  const load = async () => {
    try {
      const me = await A.me();
      const ov = me?.clientLink ? await A.overview() : null;
      mount(box, homeBody(me, ov, load));
    } catch (e) {
      mount(box, errorBox(e, load));
    }
  };
  load();
  return box;
}

function homeBody(me, ov, reload) {
  const link = ov?.link;
  const trn = ov?.trainer;
  const verifiedTrainer = me?.trainerProfile?.status === 'VERIFIED';
  const coachRow = verifiedTrainer ? h('a', { class: 'tr-home-coach', href: '/coach', 'data-link': '' }, tile('users', 'teal', 32),
    h('span', { class: 'row-main' }, h('strong', null, t('ტრენერის სამუშაო სივრცე', 'Trainer workspace')), h('small', null, t('დღის განრიგი, კლიენტები, გეგმები', 'Today’s schedule, clients, plans'))), icon('chevronRight', { size: 16, className: 'row-chev' })) : null;

  if (link?.status === 'ACTIVE' && trn) {
    const next = (ov.upcoming || []).find((s) => s.status === 'SCHEDULED');
    const soon = next && new Date(next.startsAt).getTime() - Date.now() < 6 * 3600000;
    return h('div', { class: 'stack', style: { gap: '14px' } },
      h('a', { class: 'tr-home-top', href: '/trainer', 'data-link': '' },
        avatar(trn, 52, trn.verified),
        h('div', { class: 'row-main' },
          h('div', { class: 'tr-kicker' }, t('ჩემი ტრენერი', 'My trainer')),
          h('div', { class: 'card-title' }, trn.displayName),
          (trn.gyms || [])[0] ? h('div', { class: 'card-sub tr-ellipsis' }, gymLine(trn.gyms[0])) : null),
        icon('chevronRight', { size: 18, className: 'row-chev' })),
      h('div', { class: 'tr-home-next' },
        tile('calendarCheck', 'teal', 40),
        h('div', { class: 'row-main' },
          h('div', { class: 'card-sub' }, next ? t(`შემდეგი ვარჯიში · ${next.kindLabel}`, `Next session · ${next.kindLabel}`) : t('შემდეგი ვარჯიში', 'Next session')),
          h('div', { class: 'tr-home-when' }, next ? `${dayLabel(tbYmd(next.startsAt))}, ${clockOf(next.startsAt)}` : t('ჯერ არ არის დაგეგმილი', 'Not scheduled yet')),
          next?.gym ? h('div', { class: 'faint tr-small tr-ellipsis' }, gymLine(next.gym)) : null),
        next ? (next.clientConfirmedAt
          ? h('span', { class: 'tr-pill soft' }, soon ? relativeStart(next.startsAt) : t('დადასტურდა', 'Confirmed'))
          : button(t('მოვალ ✓', 'I’ll be there ✓'), { size: 'sm', onClick: (e) => confirmFlow(e.currentTarget, next, reload) })) : null),
      h('div', { class: 'tr-kpis small' },
        h('div', null, h('strong', null, String(ov.stats?.done ?? 0)), h('span', null, t('ჩატარდა', 'Done'))),
        h('div', null, h('strong', null, ov.nutrition?.score != null ? `${ov.nutrition.score}%` : '—'), h('span', null, t('კვების გეგმა', 'Meal plan'))),
        h('div', null, h('strong', null, String(ov.openSlots?.length ?? 0)), h('span', null, t('თავისუფ. დრო', 'Open times')))),
      coachRow);
  }

  if (link?.status === 'REQUESTED' && trn) {
    const invited = link.initiator === 'TRAINER';
    return h('div', { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'tr-home-top' },
        avatar(trn, 52, trn.verified),
        h('div', { class: 'row-main' },
          h('div', { class: 'tr-kicker' }, invited ? t('ტრენერი გიწვევს', 'A trainer is inviting you') : t('მოთხოვნა გაგზავნილია', 'Request sent')),
          h('div', { class: 'card-title' }, trn.displayName),
          h('div', { class: 'card-sub' }, invited ? t('სანამ არ მიიღებ, შენს მონაცემებს ვერ ხედავს', 'Until you accept, they can’t see your data') : t('ტრენერი ნახავს და დაგიდასტურებს', 'The trainer will see it and confirm')))),
      invited ? h('div', { class: 'hstack' }, button(t('ნახვა და მიღება', 'Review and accept'), { size: 'sm', href: '/trainer/connect?invite=1' }), button(t('დეტალები', 'Details'), { size: 'sm', variant: 'ghost', href: '/trainer' })) : null,
      coachRow);
  }

  return h('div', { class: 'stack', style: { gap: '14px' } },
    h('div', { class: 'tr-home-top' },
      tile('dumbbell', 'teal', 46),
      h('div', { class: 'row-main' },
        h('div', { class: 'card-title' }, t('იპოვე ტრენერი', 'Find a trainer')),
        h('div', { class: 'card-sub' }, t('ჯავშნები, შეხსენებები და კვების გეგმა შენი ტრენერისგან — მხოლოდ იმას ნახავს, რასაც გაუზიარებ.', 'Bookings, reminders and a meal plan from your trainer — they see only what you share.'))),
      button(t('მოძებნე', 'Search'), { size: 'sm', href: '/trainer', icon: 'search' })),
    coachRow);
}

/* ═══ Router entry ═══════════════════════════════════════ */
export default async function trainerPage(root, ctx) {
  ensureCss();
  const section = ctx.params?.section || '';
  const id = ctx.params?.id || '';
  switch (section) {
    case '': return hubPage(root, ctx);
    case 'search':
      ctx.setTitle(t('ტრენერის მოძებნა', 'Find a trainer'));
      mount(root, back('/trainer', t('ჩემი ტრენერი', 'My trainer')), pageHead(t('ტრენერის მოძებნა', 'Find a trainer'), t('მოძებნე სახელით, სპეციალიზაციით, დარბაზით ან ქალაქით. ჩანს მხოლოდ MEDICARD-ის მიერ დადასტურებული ტრენერები.', 'Search by name, specialty, gym or city. Only trainers verified by MEDICARD are shown.')), searchView());
      return undefined;
    case 'connect': return connectPage(root, ctx);
    case 'sharing': return sharingPage(root, ctx);
    case 'sessions': return sessionsPage(root, ctx);
    case 'session': return id ? sessionDetailPage(root, ctx, id) : sessionsPage(root, ctx);
    case 'plan': return planPage(root, ctx);
    case 'progress': return progressPage(root, ctx);
    case 'apply': return applyPage(root, ctx);
    case 'scan': return scanPage(root, ctx);
    case 'report': return hubPage(root, ctx, { report: true });
    default:
      ctx.navigate('/trainer', { replace: true });
      return undefined;
  }
}
