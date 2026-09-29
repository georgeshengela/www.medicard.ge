// MEDICARD web — MEDI COACH, client side (/trainer, /trainer/:section, /trainer/:section/:id) + Home card.
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

const CSS = '/app/css/trainer.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

const APP_STORE = 'https://apps.apple.com/app/id6812517519';

/* ── Copy (mobile/src/lib/coach.ts) ─────────────────────── */
const SCOPES = ['workouts', 'nutrition', 'weight', 'photos'];
const SCOPE_COPY = {
  workouts: { title: 'ვარჯიშები და აქტივობა', body: 'ნაბიჯები, აქტიური წუთები, პულსი, ძილი და ვარჯიშები Apple Health / Health Connect-იდან.', icon: 'activity', ink: 'green' },
  nutrition: { title: 'კვება', body: 'კვების დღიური, კალორიები, მაკროები და ტრენერის გეგმის დაცვა.', icon: 'utensils', ink: 'amber' },
  weight: { title: 'წონა და მიზანი', body: 'აწონვები, წონის მიზანი და პროგრესი.', icon: 'scale', ink: 'blue' },
  photos: { title: 'პროგრეს-ფოტოები', body: 'შენი „მანამდე / შემდეგ“ ფოტოები. ნაგულისხმევად გამორთულია.', icon: 'camera', ink: 'violet' },
};
const ALWAYS_SEEN = ['სახელი', 'ფოტო', 'ასაკი', 'სქესი', 'სიმაღლე', 'ვარჯიშების განრიგი'];
const ALWAYS_TEXT = 'ტრენერი ყოველთვის ხედავს: შენს სახელს, ფოტოს, ასაკს, სქესს, სიმაღლეს და ვარჯიშების განრიგს. ქვემოთ აირჩიე, კიდევ რა გაუზიარო — ყველაფერი გამორთულია, სანამ შენ არ ჩართავ. ჯანმრთელობის მონაცემი განსაკუთრებული კატეგორიაა: გაზიარება ნებაყოფლობითია და ნებისმიერ დროს შეწყდება.';
const NEVER_TEXT = 'ტრენერი ვერ ხედავს: სამედიცინო ჩანაწერებს, ანალიზებს, წამლებს, ციკლს, Medi-სთან საუბრებს. ტრენერები დამოუკიდებელი პროფესიონალები არიან; MEDICARD მათ სერტიფიკატებს ამოწმებს.';
const DAY_STATUS_LABEL = { ON: 'გეგმაში', OVER: 'გადააჭარბა', UNDER: 'ცოტა ჭამა', LOW_PROTEIN: 'ცილა აკლდა', PENDING: 'მიმდინარე', NONE: 'არ ჩაწერა' };
const DAY_STATUS_TONE = { ON: 'ok', OVER: 'danger', UNDER: 'warn', LOW_PROTEIN: 'warn', PENDING: 'brand', NONE: 'none' };
const SESSION_STATUS_LABEL = { OPEN: 'თავისუფალი', SCHEDULED: 'დაგეგმილი', CANCELLED: 'გაუქმდა', DONE: 'ჩატარდა', NO_SHOW: 'არ მოვიდა' };
const POSE_LABEL = { FRONT: 'წინიდან', SIDE: 'გვერდიდან', BACK: 'ზურგიდან', OTHER: 'სხვა' };
const GOAL_TYPE_LABEL = { lose: 'წონის კლება', gain: 'წონის მატება', recomp: 'რეკომპოზიცია', performance: 'ფორმა და ძალა' };
const SLOT_KA = { breakfast: 'საუზმე', snack1: 'წახემსება', lunch: 'სადილი', snack2: 'მეორე წახემსება', dinner: 'ვახშამი', preworkout: 'ვარჯიშამდე', postworkout: 'ვარჯიშის შემდეგ' };
const REASONS = [
  { key: 'harassment', label: 'შეურაცხყოფა ან შევიწროება' },
  { key: 'inappropriate', label: 'შეუფერებელი შინაარსი ან ფოტო' },
  { key: 'unsafe', label: 'სახიფათო ან არაპროფესიული რჩევა' },
  { key: 'spam', label: 'სპამი ან რეკლამა' },
  { key: 'impersonation', label: 'ყალბი პროფილი ან სერტიფიკატი' },
  { key: 'other', label: 'სხვა' },
];
const WORKOUT_KIND_KA = {
  traditionalStrengthTraining: 'ძალოვანი ვარჯიში', functionalStrengthTraining: 'ფუნქციური ვარჯიში', highIntensityIntervalTraining: 'HIIT',
  running: 'სირბილი', walking: 'სიარული', cycling: 'ველოსიპედი', swimming: 'ცურვა', yoga: 'იოგა', pilates: 'პილატესი', boxing: 'ბოქსი',
  crossTraining: 'კროს-ტრენინგი', elliptical: 'ელიფსური', rowing: 'ნიჩბოსნობა', coreTraining: 'კორი', flexibility: 'მოქნილობა', mixedCardio: 'კარდიო',
  stairClimbing: 'კიბეები', other: 'ვარჯიში',
};
const workoutKindLabel = (k) => WORKOUT_KIND_KA[k] || WORKOUT_KIND_KA[String(k || '').replace(/^EXERCISE_TYPE_/, '').toLowerCase()] || 'ვარჯიში';

/* ── Tbilisi time (sessions are stored as instants and shown in Georgia's time, like the app) ── */
const TZ = 4 * 3600000;
const WEEKDAY_SHORT = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
const MONTH_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const tbYmd = (d = new Date()) => new Date(new Date(d).getTime() + TZ).toISOString().slice(0, 10);
const addYmd = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
function clockOf(iso) {
  const t = new Date(new Date(iso).getTime() + TZ);
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
}
function dayLabel(ymd, today = tbYmd()) {
  if (ymd === today) return 'დღეს';
  if (ymd === addYmd(today, 1)) return 'ხვალ';
  if (ymd === addYmd(today, -1)) return 'გუშინ';
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${WEEKDAY_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}
const shortYmd = (ymd) => { const d = new Date(`${ymd}T12:00:00Z`); return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`; };
function relativeStart(iso, now = Date.now()) {
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  if (mins <= 0) return 'მიმდინარეობს';
  if (mins < 60) return `${mins} წუთში`;
  if (mins < 6 * 60) return `${Math.round(mins / 60)} საათში`;
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
    verified ? h('span', { class: 'tr-av-check', title: 'დადასტურებული ტრენერი' }, icon('check', { size: size >= 56 ? 12 : 10, stroke: 3.2 })) : null);
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
  return h('div', { class: `tr-strip ${labels ? 'labels' : ''}`, role: 'img', 'aria-label': `კვების დაცვა: ${on} დღე გეგმაში ${days.length}-დან` },
    days.map((d) => h('div', { class: 'tr-strip-day', title: `${dayLabel(d.date)} · ${DAY_STATUS_LABEL[d.status] || ''}${d.meals ? ` · ${fmtNum(d.calories)} კკალ` : ''}` },
      h('i', { class: `st-${DAY_STATUS_TONE[d.status] || 'none'}` }),
      labels ? h('span', null, String(Number(d.date.slice(8)))) : null)));
}

function stripLegend() {
  return h('div', { class: 'legend tr-legend' },
    [['ok', 'გეგმაში'], ['warn', 'ცოტა / ცილა აკლდა'], ['danger', 'გადააჭარბა'], ['brand', 'დღეს'], ['none', 'არ ჩაწერა']]
      .map(([t, l]) => h('span', null, h('i', { class: `st-${t}` }), l)));
}

function stars(value, onRate) {
  const wrap = h('div', { class: 'tr-stars', role: onRate ? 'radiogroup' : 'img', 'aria-label': value ? `${value} ვარსკვლავი 5-დან` : 'შეფასება' });
  for (let n = 1; n <= 5; n += 1) {
    const on = (value || 0) >= n;
    wrap.appendChild(onRate
      ? h('button', { type: 'button', class: `tr-star ${on ? 'on' : ''}`, 'aria-label': `${n} ვარსკვლავი`, onClick: () => onRate(n) }, icon('star', { size: 30 }))
      : h('span', { class: `tr-star sm ${on ? 'on' : ''}` }, icon('star', { size: 14 })));
  }
  return wrap;
}

function sessionBadge(s) {
  if (s.status === 'SCHEDULED' && s.clientConfirmedAt) return badge('დადასტურებული', 'brand');
  const tone = s.status === 'DONE' ? 'ok' : s.status === 'CANCELLED' || s.status === 'NO_SHOW' ? 'danger' : 'neutral';
  return badge(s.lateCancel && s.status === 'CANCELLED' ? 'ბოლო წუთის გაუქმება' : SESSION_STATUS_LABEL[s.status] || s.status, tone);
}

/** One session line: time block, what/where, status; optional actions under it. */
function sessionRow(s, { href, actions } = {}) {
  const tag = href ? 'a' : 'div';
  return h('div', { class: 'tr-ses' },
    h(tag, { class: `tr-ses-main ${href ? 'is-link' : ''}`, href, 'data-link': href ? '' : undefined, 'aria-label': `${s.label}, ${s.kindLabel}, ${SESSION_STATUS_LABEL[s.status] || ''}` },
      h('div', { class: 'tr-ses-time' }, h('strong', null, clockOf(s.startsAt)), h('span', null, `${s.durationMin} წთ`)),
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
    h('span', null, text, ' ', h('a', { href: APP_STORE, target: '_blank', rel: 'noopener', class: 'link' }, 'MEDICARD აპი')));
}

function errMsg(e) { return e instanceof ApiError || e?.message ? e.message : 'სცადე ხელახლა.'; }

/* ── Actions shared by several pages ─────────────────── */
function cancelSessionFlow(s, after) {
  const late = isLate(s.startsAt);
  formModal({
    title: 'ვარჯიშის გაუქმება',
    size: 'sm',
    submit: 'გაუქმება',
    danger: true,
    fields: [
      h('p', { class: 'muted' }, late ? 'ვარჯიშამდე 12 საათზე ნაკლებია — ტრენერი ამას ბოლო წუთის გაუქმებად ნახავს.' : `${s.label} — ტრენერს შეტყობინება მიუვა.`),
      field('მიზეზი (არასავალდებულო)', textarea({ name: 'reason', maxlength: 300, rows: 2, placeholder: 'მაგ. სამსახურში დამაგვიანდება' })),
    ],
    onSubmit: async (v, close) => {
      await A.cancel(s.id, String(v.reason || '').trim());
      close();
      toast('ვარჯიში გაუქმდა');
      after?.();
    },
  });
}

async function bookFlow(s, after) {
  const ok = await confirmDialog({ title: 'დაჯავშნა', body: `${s.label} · ${s.kindLabel}${s.gym ? ` · ${s.gym.brand}` : ''} · ${s.durationMin} წთ`, confirm: 'დაჯავშნა' });
  if (!ok) return;
  try {
    await A.book(s.id);
    toast('დაჯავშნილია — ტრენერს შეტყობინება მიუვა');
  } catch (e) {
    toast(errMsg(e), 'error');
  }
  after?.();
}

async function confirmFlow(btn, s, after) {
  await busy(btn, async () => {
    try {
      await A.confirm(s.id);
      toast('დადასტურებულია — ტრენერი ნახავს, რომ მოხვალ');
      after?.();
    } catch (e) { toast(errMsg(e), 'error'); }
  });
}

/** Report (and block) a trainer — App Review 1.2. Blocking ends the link at once; the trainer cannot invite again. */
function reportFlow(trainer, after) {
  let reason = null;
  let block = true;
  const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'რა მოხდა?' });
  const drawChips = () => mount(chips, REASONS.map((r) => h('button', {
    type: 'button', class: `chip ${reason === r.key ? 'on' : ''}`, role: 'radio', 'aria-checked': reason === r.key ? 'true' : 'false',
    onClick: () => { reason = r.key; drawChips(); },
  }, r.label)));
  drawChips();
  formModal({
    title: 'შეტყობინება დარღვევაზე',
    submit: 'გაგზავნა',
    fields: [
      h('div', { class: 'hstack' }, avatar(trainer, 40, trainer.verified), h('strong', null, trainer.displayName)),
      field('რა მოხდა?', chips),
      field('დეტალები (არასავალდებულო)', textarea({ name: 'details', maxlength: 1000, rows: 3, placeholder: 'მოკლედ აღწერე' }), 'არ ჩაწერო ჯანმრთელობის ან სხვისი პირადი მონაცემები.'),
      h('div', { class: 'tr-scope' },
        tile('lock', 'rose', 38),
        h('div', { class: 'tr-scope-text' }, h('div', { class: 'row-title' }, 'ტრენერის დაბლოკვა'), h('div', { class: 'row-sub' }, 'კავშირი მაშინვე შეწყდება და ეს ტრენერი ვეღარ მოგწვევს.')),
        toggle(block, (v) => { block = v; })),
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, 'შეტყობინებას MEDICARD-ის გუნდი განიხილავს. საჭიროების შემთხვევაში ტრენერის სტატუსი შეჩერდება.'),
    ],
    onSubmit: async (v, close) => {
      if (!reason) throw new Error('აირჩიე, რა მოხდა.');
      const res = await post('/api/trainer/report', { subjectId: trainer.id, reason, details: String(v.details || '').trim(), block });
      close();
      toast(block ? 'შეტყობინება მივიღეთ და კავშირი შეწყდა. MEDICARD-ის გუნდი განიხილავს.' : 'შეტყობინება მივიღეთ. MEDICARD-ის გუნდი განიხილავს.', 'ok', { ms: 5200 });
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
function trainerDetail(t, { compact = false } = {}) {
  return card({ class: 'tr-profile' },
    h('div', { class: 'tr-profile-head' },
      avatar(t, compact ? 52 : 64, t.verified),
      h('div', { class: 'tr-profile-name' },
        h('h3', null, t.displayName),
        h('div', { class: 'hstack', style: { gap: '6px' } },
          t.verified ? badge('დადასტურებული ტრენერი', 'brand') : null,
          t.experienceYears ? badge(`${t.experienceYears} წლის გამოცდილება`) : null,
          t.clients ? badge(`${t.clients} კლიენტი MEDICARD-ში`, 'ok') : null))),
    t.bio ? h('p', { class: 'tr-bio' }, t.bio) : null,
    t.specialties?.length ? h('div', { class: 'chips tr-chips-static' }, t.specialties.map((s) => h('span', { class: 'chip' }, s.label))) : null,
    h('div', { class: 'tr-facts' },
      (t.gyms || []).map((g) => h('div', { class: 'tr-fact' }, icon('mapPin', { size: 15 }), h('span', null, `${gymLine(g)}, ${g.city}`, g.address ? h('small', null, ` · ${g.address}`) : null))),
      (t.certificates || []).map((c) => h('div', { class: 'tr-fact' }, icon('award', { size: 15 }), h('span', null, [c.title, c.issuer, c.year].filter(Boolean).join(' · ')))),
      t.instagram ? h('div', { class: 'tr-fact' }, icon('externalLink', { size: 15 }),
        h('a', { class: 'link', href: `https://instagram.com/${enc(t.instagram)}`, target: '_blank', rel: 'noopener' }, `@${t.instagram}`)) : null));
}

/* ── Search (hub "no trainer" state and /trainer/search) ─── */
function searchView() {
  const state = { q: '', gym: null, city: '', seq: 0, cities: [] };
  const results = h('div', null, skeleton(3));
  const q = input({ type: 'search', placeholder: 'ტრენერის სახელი ან სპეციალიზაცია', 'aria-label': 'ტრენერის ძებნა', class: 'input tr-search-input' });
  const gymBtn = h('button', { type: 'button', class: 'chip tr-gym-chip' });
  const citySel = h('select', { class: 'input select tr-city', 'aria-label': 'ქალაქი' }, h('option', { value: '' }, 'ყველა ქალაქი'));
  const drawGym = () => {
    mount(gymBtn, icon('mapPin', { size: 15 }), state.gym ? state.gym.label : 'დარბაზი: ყველა',
      state.gym ? h('span', { class: 'tr-chip-x', role: 'button', 'aria-label': 'დარბაზის ფილტრის მოხსნა', onClick: (e) => { e.stopPropagation(); state.gym = null; drawGym(); run(); } }, icon('x', { size: 14 })) : null);
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
      const list = (res.trainers || []).filter((t) => !state.city || (t.gyms || []).some((g) => g.city === state.city));
      mount(results, list.length
        ? h('div', { class: 'grid tr-results' }, list.map(resultCard))
        : card(empty('ტრენერი ვერ მოიძებნა', 'სცადე სხვა დარბაზი ან სახელი. შენს ტრენერს სთხოვე, დარეგისტრირდეს MEDICARD-ში — კოდით პირდაპირ დაგიკავშირდები.')));
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

function resultCard(t) {
  return h('a', { class: 'card hover tr-result', href: `/trainer/connect?trainerId=${enc(t.id)}`, 'data-link': '', 'aria-label': `${t.displayName}, ტრენერი` },
    h('div', { class: 'tr-result-head' },
      avatar(t, 52, t.verified),
      h('div', { class: 'tr-result-name' },
        h('div', { class: 'card-title' }, t.displayName),
        h('div', { class: 'card-sub tr-ellipsis' }, (t.gyms || []).map(gymLine).join(' · ') || 'დადასტურებული ტრენერი')),
      icon('chevronRight', { size: 18, className: 'row-chev' })),
    t.specialties?.length ? h('div', { class: 'tr-result-spec' }, t.specialties.map((s) => s.label).join(' · ')) : null,
    h('div', { class: 'hstack', style: { gap: '6px', marginTop: 'auto' } },
      t.experienceYears ? badge(`${t.experienceYears} წელი`) : null,
      t.clients ? badge(`${t.clients} კლიენტი MEDICARD-ში`, 'brand') : null,
      (t.certificates || []).length ? badge(`${t.certificates.length} სერტიფიკატი`, 'violet') : null));
}

/** Gym directory picker: brands → branches, searchable (GET /api/trainer/gyms). onPick(gym | null). */
function gymPicker(onPick, { exclude = [], allowAll = true } = {}) {
  const list = h('div', { class: 'list tr-gym-list' }, skeleton(4));
  const q = input({ type: 'search', placeholder: 'Oktopus, Aspria, ვაკე, ბათუმი…', 'aria-label': 'დარბაზის ძებნა' });
  let seq = 0;
  let m = null;
  async function run() {
    const my = ++seq;
    try {
      const res = await A.gyms(q.value.trim());
      if (my !== seq) return;
      const rows = (res.brands || []).flatMap((b) => b.branches).filter((g) => !exclude.includes(g.id)).slice(0, 80);
      mount(list,
        allowAll && !q.value.trim() ? row({ icon: 'grid', ink: 'neutral', title: 'ყველა დარბაზი', onClick: () => { m.close(); onPick(null); } }) : null,
        rows.length ? rows.map((g) => row({
          icon: 'mapPin', ink: g.status === 'PROPOSED' ? 'amber' : 'teal', title: gymLine(g),
          sub: [g.city, g.district, g.address].filter(Boolean).join(' · '),
          trailing: g.status === 'PROPOSED' ? badge('გადამოწმდება', 'warn') : undefined,
          onClick: () => { m.close(); onPick(g); },
        })) : h('p', { class: 'muted', style: { padding: '14px 8px' } }, 'ასეთი დარბაზი ვერ მოიძებნა.'));
    } catch (e) {
      if (my === seq) mount(list, errorBox(e, run));
    }
  }
  q.addEventListener('input', debounce(run, 200));
  m = openModal({ title: 'დარბაზის არჩევა', size: 'md', body: h('div', { class: 'stack' }, q, list) });
  run();
  return m;
}

/* ── Code entry (web cannot scan a QR) ────────────────── */
function codeCard(navigate, { autofocus = false } = {}) {
  const err = h('div', { class: 'form-error', hidden: true });
  const inp = input({ class: 'input tr-code', maxlength: 6, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'K7M2QX', 'aria-label': 'ტრენერის კოდი', autofocus });
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); err.hidden = true; });
  const go = () => {
    const code = normalizeCoachCode(inp.value);
    if (!code) { err.textContent = 'კოდი 6 სიმბოლოა (ასოები და ციფრები).'; err.hidden = false; return; }
    navigate(`/trainer/connect?code=${code}`);
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return card({ class: 'tr-codecard' },
    h('div', { class: 'hstack', style: { gap: '12px', alignItems: 'flex-start', flexWrap: 'nowrap' } },
      tile('qr', 'teal', 42),
      h('div', null,
        h('div', { class: 'card-title' }, 'ტრენერის კოდი'),
        h('div', { class: 'card-sub' }, 'კოდს ტრენერი გაგიზიარებს — ის ჩანს მის ტრენერის პროფილში და QR-ის ქვეშ.'))),
    h('div', { class: 'tr-code-row' }, inp, button('ტრენერის ნახვა', { onClick: go })),
    err,
    h('p', { class: 'faint tr-small' }, 'QR კოდის სკანირება MEDICARD აპიდან მუშაობს (ჩემი ტრენერი → ტრენერის QR). ვებზე შეიყვანე კოდი — შედეგი იგივეა.'));
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
      if (alive) mount(root, pageHead('ჩემი ტრენერი', 'MEDI COACH'), errorBox(e, reload));
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
    const title = st === 'VERIFIED' ? 'ტრენერის სივრცის გახსნა' : st === 'PENDING' ? 'განაცხადი განხილვაშია' : st === 'REJECTED' ? 'განაცხადს დაზუსტება სჭირდება' : st === 'SUSPENDED' ? 'ტრენერის პროფილი შეჩერებულია' : 'დარეგისტრირდი როგორც ტრენერი';
    const sub = st === 'VERIFIED' ? 'კალენდარი, კლიენტები, კვების გეგმები'
      : st === 'PENDING' ? 'განაცხადი განიხილება — დადასტურებისას შეტყობინება მოგივა'
        : st === 'REJECTED' ? 'ნახე კომენტარი, გაასწორე და გაგზავნე ხელახლა'
          : st === 'SUSPENDED' ? 'დეტალებისთვის მოგვწერე support@medicard.ge'
            : 'კალენდარი, კლიენტების მართვა და მათი პროგრესი ერთ ადგილას — უფასოდ';
    const tone = st === 'VERIFIED' ? 'ok' : st === 'PENDING' ? 'warn' : st ? 'danger' : null;
    const label = st === 'VERIFIED' ? 'დადასტურებული' : st === 'PENDING' ? 'განიხილება' : st === 'REJECTED' ? 'დასაზუსტებელი' : 'შეჩერებული';
    return section(st === 'PENDING' ? 'შენი ტრენერის განაცხადი' : st === 'VERIFIED' ? 'ტრენერის რეჟიმი' : 'ტრენერი ხარ?',
      h('a', { class: 'card hover tr-mode', href: st === 'VERIFIED' ? '/coach' : '/trainer/apply', 'data-link': '' },
        tile(st === 'VERIFIED' ? 'award' : st === 'PENDING' ? 'clock' : 'award', st === 'VERIFIED' ? 'green' : st ? 'amber' : 'violet'),
        h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, title), h('div', { class: 'card-sub' }, sub)),
        tone ? badge(label, tone) : icon('chevronRight', { size: 18, className: 'row-chev' })));
  }

  function progressLinks(active) {
    return section('პროგრესი', card({ class: 'tr-listcard' }, h('div', { class: 'list' },
      row({ icon: 'camera', ink: 'violet', title: 'ფოტო-პროგრესი', sub: 'მანამდე / შემდეგ', href: '/trainer/progress' }),
      row({ icon: 'scale', ink: 'blue', title: 'წონა და მიზანი', sub: 'აწონვები და მიზნის პროგრესი', href: '/health' }),
      active ? row({ icon: 'dumbbell', ink: 'teal', title: 'ვარჯიშების ისტორია', sub: 'ჩატარებული, შეფასებები', href: '/trainer/sessions' }) : null,
      active && ov?.plan ? row({ icon: 'utensils', ink: 'amber', title: 'კვების გეგმა', sub: ov.plan.title, href: '/trainer/plan' }) : null)));
  }

  /* No trainer yet: find one, or connect by code. */
  function discoverView() {
    const search = searchView();
    const hero = card({ class: 'spotlight hero-card pad-lg tr-hero' },
      tile('dumbbell', 'teal', 46),
      h('h2', null, 'შენი ტრენერი დარბაზს გარეთაც შენთანაა'),
      h('p', { class: 'muted' }, 'ტრენერი ჯავშნებს პირდაპირ აქ გინიშნავს, შეხსენებები თავად მოგივა, კვების გეგმას გიდგენს და ხედავს, როგორ მიდიხარ — მხოლოდ იმას, რასაც შენ გაუზიარებ.'),
      h('ul', { class: 'tr-points' },
        [['calendarCheck', 'ჯავშნები და შეხსენებები — ვარჯიშს აღარ გამოტოვებ'], ['utensils', 'კვების გეგმა და დღიური კონტროლი'], ['target', 'ვარჯიშები ტელეფონიდან, წონა და ფოტო-პროგრესი']]
          .map(([ic, t]) => h('li', null, icon(ic, { size: 18 }), h('span', null, t)))),
      h('div', { class: 'hstack', style: { marginTop: '4px' } },
        button('ტრენერის მოძებნა', { icon: 'search', onClick: () => search.querySelector('input')?.focus() }),
        button('ტრენერის რეგისტრაცია', { variant: 'outline', icon: 'award', href: '/trainer/apply', class: 'tr-on-spot' })));
    return [
      pageHead('ჩემი ტრენერი', 'MEDI COACH — იპოვე დადასტურებული ტრენერი ან დაუკავშირდი მის კოდით. შენ წყვეტ, რას დაინახავს.'),
      h('div', { class: 'grid grid-main tr-top' },
        hero,
        h('div', { class: 'tr-col' },
          section('კოდით დაკავშირება', codeCard(ctx.navigate)),
          section('შენი QR ტრენერისთვის', card({ class: 'tr-mini' },
            tile('scanLine', 'sky', 38),
            h('p', { class: 'muted tr-small' }, 'ტრენერს შეუძლია შენი პირადი QR დაასკანეროს MEDICARD აპში (პროფილი → QR). მოწვევა აქაც გამოჩნდება — სანამ არ მიიღებ, შენს მონაცემებს ვერ ნახავს.'))))),
      section('იპოვე ტრენერი', search),
      h('div', { class: 'grid grid-2' }, trainerModeCard(), progressLinks(false)),
    ];
  }

  /* A trainer scanned the person's QR and invited them: nothing is shared until they accept with scopes. */
  function inviteView() {
    const t = ov.trainer;
    return [
      pageHead('ჩემი ტრენერი', 'MEDI COACH'),
      h('div', { class: 'grid grid-main' },
        h('div', { class: 'tr-col' },
          section('ტრენერი გიწვევს', card({ class: 'spotlight hero-card pad-lg tr-invite' },
            h('div', { class: 'tr-invite-head' }, avatar(t, 64, t.verified),
              h('div', null, h('h2', null, t.displayName), h('p', { class: 'muted' }, (t.gyms || []).map(gymLine).join(' · ') || 'დადასტურებული ტრენერი'))),
            h('p', null, 'შენი QR დაასკანერა და გთავაზობს ერთად ვარჯიშს. სანამ არ მიიღებ, შენს მონაცემებს ვერ ხედავს.'),
            h('div', { class: 'hstack' },
              button('ნახვა და მიღება', { icon: 'check', href: '/trainer/connect?invite=1' }),
              button('უარი', {
                variant: 'outline', class: 'tr-on-spot',
                onClick: async (e) => {
                  const ok = await confirmDialog({ title: 'მოწვევაზე უარი', body: `${t.displayName} ვერ ნახავს შენს მონაცემებს. მოგვიანებით თავად შეგიძლია დაუკავშირდე.`, confirm: 'უარი', danger: true });
                  if (!ok) return;
                  await busy(e.currentTarget, async () => { try { await A.unlink(); toast('მოწვევაზე უარი ითქვა'); await reload(); } catch (er) { toast(errMsg(er), 'error'); } });
                },
              })))),
          section('ტრენერის შესახებ', trainerDetail(t))),
        h('div', { class: 'tr-col' },
          section('რას დაინახავს ტრენერი', card(h('p', { class: 'muted tr-small' }, ALWAYS_TEXT), h('p', { class: 'faint tr-small', style: { marginTop: '10px' } }, NEVER_TEXT))),
          h('button', { type: 'button', class: 'text-btn tr-report', onClick: () => reportFlow(t, () => reload()) }, icon('alert', { size: 16 }), 'შეტყობინება დარღვევაზე / დაბლოკვა'),
          trainerModeCard())),
    ];
  }

  function pendingView() {
    const t = ov.trainer;
    return [
      pageHead('ჩემი ტრენერი', 'MEDI COACH'),
      h('div', { class: 'grid grid-main' },
        h('div', { class: 'tr-col' },
          section('მოთხოვნა გაგზავნილია', card({ class: 'pad-lg' },
            h('div', { class: 'tr-invite-head' }, avatar(t, 56, true),
              h('div', null, h('div', { class: 'card-title' }, t.displayName), h('div', { class: 'card-sub' }, 'ტრენერი ნახავს შენს მოთხოვნას და დაგიდასტურებს.'))),
            h('div', { class: 'tr-sharing-inline' }, 'დადასტურების შემდეგ გაზიარდება: ',
              SCOPES.filter((k) => ov.link.scopes?.[k]).map((k) => SCOPE_COPY[k].title).join(', ') || 'მხოლოდ ვარჯიშების განრიგი'),
            h('div', { class: 'hstack', style: { marginTop: '14px' } },
              button('მოთხოვნის გაუქმება', {
                variant: 'ghost',
                onClick: (e) => busy(e.currentTarget, async () => { try { await A.unlink(); toast('მოთხოვნა გაუქმდა'); await reload(); } catch (er) { toast(errMsg(er), 'error'); } }),
              })))),
          section('ტრენერის შესახებ', trainerDetail(t))),
        h('div', { class: 'tr-col' }, trainerModeCard(), progressLinks(false))),
    ];
  }

  function activeView() {
    const t = ov.trainer;
    const link = ov.link;
    const next = (ov.upcoming || []).find((s) => s.status === 'SCHEDULED');
    const left = h('div', { class: 'tr-col' },
      section('შემდეგი ვარჯიში', nextCard(next), { link: ov.upcoming?.length ? { href: '/trainer/sessions', label: 'ყველა' } : undefined }),
      link.proposedGoal ? section('ტრენერი მიზანს გთავაზობს', goalCard(link.proposedGoal)) : null,
      ov.openSlots?.length ? section('თავისუფალი დრო ტრენერთან', slotsCard(ov.openSlots, reload)) : null,
      section('კვების გეგმა', planSummary(), { link: ov.plan ? { href: '/trainer/plan', label: 'გახსნა' } : undefined }),
      ov.past?.length ? section('ბოლო ვარჯიშები', card({ class: 'tr-listcard' }, h('div', { class: 'tr-seslist' }, ov.past.slice(0, 4).map((s) => sessionRow(s, { href: `/trainer/session/${s.id}` })))), { link: { href: '/trainer/sessions', label: 'ისტორია' } }) : null);
    const right = h('div', { class: 'tr-col' },
      section('ტრენერი', trainerSummary(t)),
      section('რას ხედავს ტრენერი', sharingSummary(link), { link: { href: '/trainer/sharing', label: 'შეცვლა' } }),
      progressLinks(true),
      trainerModeCard());
    return [
      pageHead('ჩემი ტრენერი', `${t.displayName}${link.since ? ` · ერთად ${fmtDate(link.since)}-დან` : ''}`,
        button('ვარჯიშები', { variant: 'ghost', icon: 'calendar', href: '/trainer/sessions' }),
        button('გაზიარება', { variant: 'secondary', icon: 'shield', href: '/trainer/sharing' })),
      h('div', { class: 'grid grid-main' }, left, right),
      h('p', { class: 'faint tr-viewed' }, link.trainerViewedAt ? `ტრენერმა ბოლოს ნახა ${dayLabel(tbYmd(link.trainerViewedAt))} ${clockOf(link.trainerViewedAt)}` : 'ტრენერს შენი მონაცემები ჯერ არ უნახავს'),
    ];
  }

  function nextCard(next) {
    if (!next) {
      return card({ class: 'tr-mini' }, tile('calendar', 'teal', 42),
        h('p', { class: 'muted' }, 'დაგეგმილი ვარჯიში ჯერ არ გაქვს. ტრენერი ჩაგწერს, ან აირჩიე თავისუფალი დრო ქვემოთ.'));
    }
    const confirmBtn = button('მოვალ ✓', { onClick: (e) => confirmFlow(e.currentTarget, next, reload) });
    return card({ class: 'spotlight hero-card pad-lg tr-next' },
      h('div', { class: 'between' },
        h('div', { class: 'tr-next-time' }, clockOf(next.startsAt)),
        h('span', { class: 'tr-pill' }, relativeStart(next.startsAt))),
      h('div', { class: 'tr-next-sub' }, [dayLabel(tbYmd(next.startsAt)), next.kindLabel, `${next.durationMin} წთ`, next.gym ? gymLine(next.gym) : null].filter(Boolean).join(' · ')),
      next.note ? h('p', { class: 'tr-next-note' }, `„${next.note}“`) : null,
      h('div', { class: 'hstack tr-next-actions' },
        next.clientConfirmedAt ? h('span', { class: 'tr-confirmed' }, icon('check', { size: 18, stroke: 2.6 }), 'დადასტურებულია') : confirmBtn,
        button('გაუქმება', { variant: 'outline', class: 'tr-on-spot', onClick: () => cancelSessionFlow(next, reload) })));
  }

  function goalCard(g) {
    return card({ class: 'tr-goal' },
      h('div', { class: 'hstack', style: { flexWrap: 'nowrap', gap: '14px' } },
        tile('target', 'amber', 44),
        h('div', { class: 'row-main' },
          h('div', { class: 'card-title' }, `${GOAL_TYPE_LABEL[g.type] || 'მიზანი'}: ${fmtNum(g.targetKg, 1)} კგ`),
          h('div', { class: 'card-sub' }, `ვადა: ${fmtDate(g.deadlineYmd, { year: true })}`))),
      g.note ? h('p', { class: 'tr-quote' }, `„${g.note}“`) : null,
      h('p', { class: 'faint tr-small' }, 'მიღებისას მიზანი შენს წონის მიზნად შეინახება — ნახავ „მაჩვენებლებში“.'),
      h('div', { class: 'hstack' },
        button('მიღება', {
          icon: 'check',
          onClick: (e) => busy(e.currentTarget, async () => {
            try { await acceptGoal(g); toast('მიზანი შენახულია'); await reload(); } catch (er) { toast(errMsg(er), 'error'); }
          }),
        }),
        button('არა', {
          variant: 'ghost',
          onClick: (e) => busy(e.currentTarget, async () => {
            try { await A.answerGoal('dismissed'); toast('შემოთავაზება დაიხურა', 'info'); await reload(); } catch (er) { toast(errMsg(er), 'error'); }
          }),
        })));
  }

  function planSummary() {
    const plan = ov.plan;
    if (!plan) {
      return card({ class: 'tr-mini' }, tile('utensils', 'amber', 42),
        h('p', { class: 'muted' }, ov.link.scopes?.nutrition ? 'ტრენერს კვების გეგმა ჯერ არ გამოუგზავნია.' : 'კვება ტრენერს არ უზიარებ — გეგმისთვის ჩართე „კვება“ გაზიარებაში.'));
    }
    const days = ov.nutrition?.days || [];
    const today = days[days.length - 1];
    const score = ov.nutrition?.score;
    return h('a', { class: 'card hover tr-plan-sum', href: '/trainer/plan', 'data-link': '' },
      h('div', { class: 'tr-plan-sum-top' },
        h('div', { class: 'row-main' },
          h('div', { class: 'card-title' }, plan.title),
          h('div', { class: 'card-sub' }, `${fmtNum(plan.targets.calories)} კკალ${plan.targets.protein ? ` · ცილა ${plan.targets.protein} გ` : ''}${plan.targets.carbs ? ` · ნახშ. ${plan.targets.carbs} გ` : ''}${plan.targets.fat ? ` · ცხ. ${plan.targets.fat} გ` : ''}`)),
        ring({ value: score ?? 0, max: 100, size: 64, stroke: 7, label: score != null ? `${score}%` : '—', labelScale: 0.24, color: score == null ? 'var(--bg3)' : score >= 70 ? 'var(--ok)' : score >= 40 ? 'var(--warn)' : 'var(--danger)' })),
      days.length ? dayStrip(days) : null,
      today ? h('div', { class: 'tr-plan-today' },
        h('span', null, `დღეს: ${DAY_STATUS_LABEL[today.status]} · ${fmtNum(today.calories)} / ${fmtNum(plan.targets.calories)} კკალ`),
        progress(today.calories, plan.targets.calories, { ink: today.status === 'OVER' ? 'rose' : 'teal' })) : null);
  }

  function trainerSummary(t) {
    return card({ class: 'tr-trainer' },
      h('div', { class: 'tr-trainer-head' },
        avatar(t, 60, t.verified),
        h('div', { class: 'row-main' },
          h('div', { class: 'card-title', style: { fontSize: '16.5px' } }, t.displayName),
          (t.gyms || [])[0] ? h('div', { class: 'card-sub tr-ellipsis' }, icon('mapPin', { size: 13 }), ` ${(t.gyms || []).map(gymLine).join(' · ')}`) : null,
          t.specialties?.length ? h('div', { class: 'faint tr-small tr-ellipsis' }, t.specialties.map((s) => s.label).join(' · ')) : null)),
      h('div', { class: 'tr-kpis' },
        h('div', null, h('strong', null, String(ov.stats?.done ?? 0)), h('span', null, 'ჩატარდა')),
        h('div', null, h('strong', null, String(ov.stats?.noShow ?? 0)), h('span', null, 'გამოტოვა')),
        h('div', null, h('strong', null, ov.nutrition?.score != null ? `${ov.nutrition.score}%` : '—'), h('span', null, 'კვების დაცვა'))),
      h('div', { class: 'between', style: { marginTop: '12px' } },
        h('a', { class: 'link', href: '/trainer/sharing', 'data-link': '' }, icon('shield', { size: 15 }), ' რას ხედავს ტრენერი'),
        h('button', { type: 'button', class: 'text-btn tr-report', onClick: () => reportFlow(t, () => reload()) }, 'შეტყობინება')));
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
    row({ icon: 'calendar', ink: 'teal', title: 'ვარჯიშების განრიგი', sub: 'ყოველთვის — კავშირის საფუძველია', trailing: badge('ყოველთვის', 'neutral') }),
    SCOPES.map((k) => row({
      icon: SCOPE_COPY[k].icon, ink: link.scopes?.[k] ? SCOPE_COPY[k].ink : 'neutral', title: SCOPE_COPY[k].title,
      trailing: link.scopes?.[k] ? badge('ხედავს', 'ok') : badge('არ ხედავს', 'neutral'),
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
        type: 'button', class: 'chip tr-slot', title: `${s.kindLabel}${s.gym ? ` · ${gymLine(s.gym)}` : ''} · ${s.durationMin} წთ`,
        onClick: () => bookFlow(s, after),
      }, icon('clock', { size: 14 }), clockOf(s.startsAt), h('small', null, s.kindLabel)))))),
    h('p', { class: 'faint tr-small' }, 'დააჭირე დროს დასაჯავშნად — ტრენერს შეტყობინება მიუვა.'));
}

/* ═══ Page: connect + consent (/trainer/connect?code= | ?trainerId= | ?invite=1) ═══ */
async function connectPage(root, ctx) {
  const viaSearch = Boolean(ctx.query.trainerId);
  const viaInvite = ctx.query.invite === '1';
  let code = normalizeCoachCode(ctx.query.code) || '';
  let trainer = null;
  let consentVersion = '';
  const scopes = { workouts: false, nutrition: false, weight: false, photos: false };
  const title = viaInvite ? 'ტრენერის მოწვევა' : viaSearch ? 'მოთხოვნა ტრენერთან' : 'ტრენერთან დაკავშირება';
  ctx.setTitle(title);

  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', 'ჩემი ტრენერი'), pageHead(title, viaInvite ? 'გადახედე, ვინ გიწვევს და აირჩიე, რას გაუზიარებ.' : 'ჯერ ნახე ტრენერი, შემდეგ აირჩიე, რას დაინახავს.'), body);

  // The current consent text version comes from /api/trainer/me (the link endpoints refuse any other).
  const meP = A.me().catch(() => null);
  let meNow = null;

  async function load() {
    mount(body, pageSkeleton());
    try {
      if (viaInvite) {
        const ov = await A.overview();
        if (!ov.link || ov.link.initiator !== 'TRAINER' || ov.link.status !== 'REQUESTED' || !ov.trainer) {
          mount(body, card(empty('მოწვევა ვერ მოიძებნა', 'მოწვევა ვერ მოიძებნა ან უკვე დადასტურებულია.', button('ჩემი ტრენერი', { href: '/trainer' }))));
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
    const note = viaSearch ? textarea({ maxlength: 300, rows: 3, placeholder: 'მაგ. მინდა 5 კგ-ის დაკლება და ძალის მომატება' }) : null;
    const submitLabel = viaSearch ? 'მოთხოვნის გაგზავნა' : viaInvite ? 'თანხმობა და მოწვევის მიღება' : 'თანხმობა და დაკავშირება';
    const submit = button(submitLabel, { class: 'btn-block btn-lg', icon: 'check' });
    const other = !viaInvite && meNow?.clientLink && meNow.clientLink.trainerId !== trainer.id;
    if (other) {
      mount(err, 'უკვე გყავს ტრენერი. ახალთან დასაკავშირებლად ჯერ დაასრულე მიმდინარე კავშირი ', h('a', { class: 'link', href: '/trainer/sharing', 'data-link': '' }, 'გაზიარებიდან'), '.');
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
        toast(viaSearch ? 'მოთხოვნა გაიგზავნა — ტრენერი დაგიდასტურებს' : `${trainer.displayName} ახლა შენი ტრენერია`);
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
      h('h3', { class: 'tr-h3' }, 'რას დაინახავს ტრენერი'),
      h('div', { class: 'tr-always' },
        h('div', { class: 'hstack', style: { gap: '8px', flexWrap: 'nowrap', alignItems: 'flex-start' } }, icon('lock', { size: 16 }), h('p', null, ALWAYS_TEXT)),
        h('div', { class: 'chips tr-chips-static' }, ALWAYS_SEEN.map((t) => h('span', { class: 'chip' }, icon('eye', { size: 13 }), t)))),
      h('div', { class: 'tr-scopes' }, SCOPES.map((k) => scopeRow(k, scopes[k], (v) => { scopes[k] = v; }))),
      h('p', { class: 'faint tr-small' }, NEVER_TEXT),
      note ? field('მოკლე მესიჯი ტრენერს (არასავალდებულო)', note) : null,
      err,
      submit,
      h('p', { class: 'faint tr-small', style: { textAlign: 'center' } }, 'გაზიარებას ნებისმიერ დროს შეცვლი ან შეწყვეტ „ჩემი ტრენერი“-დან.'));

    mount(body, h('div', { class: 'grid grid-main' },
      h('div', { class: 'tr-col' },
        section(viaInvite ? 'გიწვევს' : 'ტრენერი', trainerDetail(trainer)),
        viaSearch ? card({ class: 'tr-mini' }, tile('info', 'sky', 38), h('p', { class: 'muted tr-small' }, 'მოთხოვნას ტრენერი დაადასტურებს. მანამდე შენს მონაცემებს ვერ ხედავს; კოდით დაკავშირება მაშინვე აქტიურდება.')) : null,
        h('button', { type: 'button', class: 'text-btn tr-report', onClick: () => reportFlow(trainer, (res) => { if (res?.blocked) ctx.navigate('/trainer', { replace: true }); }) }, icon('alert', { size: 16 }), 'შეტყობინება დარღვევაზე')),
      h('div', { class: 'tr-col tr-sticky' }, consent)));
  }

  await load();
}

function scopeRow(k, value, onChange, { disabled = false } = {}) {
  const c = SCOPE_COPY[k];
  const t = toggle(value, onChange);
  const inp = t.querySelector('input');
  inp.setAttribute('aria-label', c.title);
  if (disabled) inp.disabled = true;
  return h('div', { class: `tr-scope ${disabled ? 'disabled' : ''}` },
    tile(c.icon, c.ink, 38),
    h('div', { class: 'tr-scope-text' }, h('div', { class: 'row-title' }, c.title), h('div', { class: 'row-sub' }, c.body)),
    t);
}

/* ═══ Page: sharing (/trainer/sharing) ═══════════════════ */
async function sharingPage(root, ctx) {
  ctx.setTitle('გაზიარება ტრენერთან');
  const body = h('div', null, pageSkeleton());
  const head = h('div', null, pageHead('გაზიარება ტრენერთან', 'რას ხედავს ტრენერი'));
  mount(root, back('/trainer', 'ჩემი ტრენერი'), head, body);
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
      mount(body, card(empty('ტრენერთან კავშირი არ გაქვს', 'როცა ტრენერს დაუკავშირდები, აქ აირჩევ, რას დაინახავს.', button('ტრენერის მოძებნა', { href: '/trainer', icon: 'search' }))));
      return;
    }
    const t = ov.trainer;
    mount(head, pageHead('გაზიარება ტრენერთან', t?.displayName || ''));
    const active = link.status === 'ACTIVE';
    const invited = link.status === 'REQUESTED' && link.initiator === 'TRAINER';

    const setScope = async (k, v, rowEl) => {
      const prev = link.scopes[k];
      link.scopes = { ...link.scopes, [k]: v };
      rowEl.classList.add('saving');
      try {
        ov = await A.setScopes({ [k]: v });
        toast(v ? `${SCOPE_COPY[k].title} — ტრენერი ახლა ხედავს` : `${SCOPE_COPY[k].title} — ტრენერისთვის დაიმალა`);
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
        h('div', { class: 'tr-scope-text' }, h('div', { class: 'row-title' }, 'ვარჯიშების განრიგი'), h('div', { class: 'row-sub' }, 'ჯავშნები ორივე მხარეს ჩანს — ეს კავშირის საფუძველია.')),
        (() => { const tg = toggle(true, () => {}); tg.querySelector('input').disabled = true; return tg; })()),
      SCOPES.map((k) => {
        let rowEl = null;
        rowEl = scopeRow(k, Boolean(link.scopes?.[k]), (v) => setScope(k, v, rowEl), { disabled: !active });
        return rowEl;
      }));

    const endBtn = active || link.status === 'REQUESTED'
      ? button(invited ? 'მოწვევაზე უარი' : active ? 'ტრენერთან კავშირის დასრულება' : 'მოთხოვნის გაუქმება', {
        variant: 'danger', icon: 'x', class: 'btn-block',
        onClick: async (e) => {
          const btn = e.currentTarget;
          const ok = await confirmDialog(active
            ? { title: 'ტრენერთან კავშირის დასრულება', body: 'ტრენერი მაშინვე ვეღარ ნახავს შენს მონაცემებს, მომავალი ვარჯიშები გაუქმდება. ისტორია შენთან დარჩება.', confirm: 'დასრულება', danger: true }
            : { title: invited ? 'მოწვევაზე უარი' : 'მოთხოვნის გაუქმება', body: `${t?.displayName || 'ტრენერი'} ვერ ნახავს შენს მონაცემებს.`, confirm: invited ? 'უარი' : 'გაუქმება', danger: true });
          if (!ok) return;
          await busy(btn, async () => {
            try { await A.unlink(); toast(active ? 'კავშირი დასრულდა' : 'გაუქმდა'); ctx.navigate('/trainer', { replace: true }); } catch (er) { toast(errMsg(er), 'error'); }
          });
        },
      }) : null;

    mount(body, h('div', { class: 'grid grid-main' },
      h('div', { class: 'tr-col' },
        card({ class: 'tr-mini' }, tile('lock', 'teal', 42),
          h('div', null,
            h('p', null, 'ცვლილება მაშინვე მოქმედებს. გამორთული კატეგორია ტრენერისთვის ქრება — ისტორიის ჩათვლით.'),
            h('p', { class: 'faint tr-small', style: { marginTop: '4px' } }, link.trainerViewedAt ? `ტრენერმა ბოლოს ნახა: ${dayLabel(tbYmd(link.trainerViewedAt))} ${clockOf(link.trainerViewedAt)}` : 'ტრენერს შენი მონაცემები ჯერ არ უნახავს.'))),
        invited ? card({ class: 'tr-mini' }, tile('info', 'amber', 38), h('p', { class: 'muted tr-small' }, 'ეს მოწვევაა — გაზიარებას მიღებისას აირჩევ.'), button('ნახვა და მიღება', { size: 'sm', href: '/trainer/connect?invite=1' }))
          : !active ? card({ class: 'tr-mini' }, tile('clock', 'amber', 38), h('p', { class: 'muted tr-small' }, 'მოთხოვნა ჯერ არ დაუდასტურებია. გაზიარებას შეცვლი, როცა კავშირი გააქტიურდება — მანამდე ტრენერი არაფერს ხედავს.')) : null,
        section('ტრენერი ყოველთვის ხედავს', card(h('div', { class: 'chips tr-chips-static' }, ALWAYS_SEEN.map((x) => h('span', { class: 'chip' }, icon('eye', { size: 13 }), x))))),
        section('შენ წყვეტ', scopesCard),
        h('p', { class: 'faint tr-small' }, 'არასოდეს ჩანს: სამედიცინო ჩანაწერები, ანალიზები, წამლები, ციკლი, Medi-სთან საუბრები.'),
        link.scopes?.workouts ? appHint('საათით ან ტელეფონით ჩაწერილი ვარჯიშები (ხანგრძლივობა, კალორია, პულსი) Apple Health / Health Connect-იდან იკითხება — ამისთვის გამოიყენე') : null),
      h('div', { class: 'tr-col tr-sticky' },
        section('კავშირი', card({ class: 'stack' },
          t ? h('div', { class: 'tr-invite-head' }, avatar(t, 48, t.verified), h('div', null, h('div', { class: 'card-title' }, t.displayName),
            h('div', { class: 'card-sub' }, active ? (link.since ? `ტრენერი ${fmtDate(link.since)}-დან` : 'აქტიური კავშირი') : invited ? 'გიწვევს' : 'მოთხოვნა გაგზავნილია'))) : null,
          endBtn,
          t ? button('შეტყობინება დარღვევაზე / დაბლოკვა', { variant: 'ghost', icon: 'alert', class: 'btn-block', onClick: () => reportFlow(t, (res) => { if (res?.blocked) ctx.navigate('/trainer', { replace: true }); }) }) : null)))));
  }

  await load();
}

/* ═══ Page: sessions (/trainer/sessions) ═════════════════ */
async function sessionsPage(root, ctx) {
  ctx.setTitle('ვარჯიშები');
  const head = h('div', null, pageHead('ვარჯიშები', 'MEDI COACH'));
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', 'ჩემი ტრენერი'), head, body);
  let ov = null;

  async function load() {
    try {
      ov = await A.overview();
      draw();
    } catch (e) { mount(body, errorBox(e, load)); }
  }

  function draw() {
    if (!ov.link || ov.link.status !== 'ACTIVE') {
      mount(body, card(empty('ტრენერთან აქტიური კავშირი არ გაქვს', 'ვარჯიშები აქ გამოჩნდება, როცა ტრენერი დაგიდასტურებს.', button('ჩემი ტრენერი', { href: '/trainer' }))));
      return;
    }
    mount(head, pageHead('ვარჯიშები', ov.trainer?.displayName || ''));
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
          !s.clientConfirmedAt ? button('მოვალ ✓', { size: 'sm', onClick: (e) => confirmFlow(e.currentTarget, s, load) }) : null,
          button('გაუქმება', { size: 'sm', variant: 'ghost', onClick: () => cancelSessionFlow(s, load) }),
        ],
      }))))
      : card(empty('დაგეგმილი ვარჯიში არ არის', 'როცა ტრენერი ჩაგწერს, აქ გამოჩნდება და შეხსენება 24 და 1 საათით ადრე მოგივა (აპში).'));

    mount(body, h('div', { class: 'grid grid-main' },
      h('div', { class: 'tr-col' },
        section('მომავალი', upList),
        ov.openSlots?.length ? section('თავისუფალი დრო ტრენერთან', slotsCard(ov.openSlots, load)) : null,
        past.length ? section('ჩატარებული', card({ class: 'tr-listcard' }, h('div', { class: 'tr-seslist' }, past.map((s) => sessionRow(s, { href: `/trainer/session/${s.id}` }))))) : null,
        cancelled.length ? section('გაუქმებული', card({ class: 'tr-listcard' }, h('div', { class: 'tr-seslist' }, cancelled.map((s) => sessionRow(s))))) : null),
      h('div', { class: 'tr-col tr-sticky' },
        section('სტატისტიკა', card({ class: 'stack' },
          h('div', { class: 'tr-attend' },
            ring({ value: done, max: judged || 1, size: 104, stroke: 10, label: judged ? `${Math.round((done / judged) * 100)}%` : '—', sub: 'დასწრება', labelScale: 0.22 }),
            h('div', { class: 'tr-attend-stats' },
              stat('ჩატარდა', fmtNum(ov.stats?.done ?? 0), { icon: 'check' }),
              stat('გამოტოვა', fmtNum(ov.stats?.noShow ?? 0), { icon: 'x' }),
              avg != null ? stat('საშ. შეფასება', fmtNum(avg, 1), { icon: 'star', unit: '/ 5' }) : null)),
          weeklySessionsChart(past))))));
  }

  await load();
}

/** DONE vs missed per week over the last 8 weeks (from the sessions the overview returns). */
function weeklySessionsChart(past, weeks = 8) {
  if (!past?.length) return h('p', { class: 'muted tr-small' }, 'ჩატარებული ვარჯიშები აქ გამოჩნდება კვირების მიხედვით.');
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
    h('div', { class: 'between', style: { marginBottom: '6px' } }, h('div', { class: 'card-title' }, 'ვარჯიშები კვირაში'),
      h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--c1)' } }), 'ჩატარდა'), h('span', null, h('i', { style: { background: 'var(--c4)' } }), 'გამოტოვა'))),
    barChart({
      labels: starts.map(shortYmd), tipLabels: starts.map((w) => `${shortYmd(w)} – ${shortYmd(addYmd(w, 6))}`), height: 180,
      stacked: [{ name: 'ჩატარდა', values: done, color: 'var(--c1)' }, { name: 'გამოტოვა', values: missed, color: 'var(--c4)' }],
    }));
}

/* ═══ Page: one session (/trainer/session/:id) ═══════════ */
async function sessionDetailPage(root, ctx, id) {
  ctx.setTitle('ვარჯიში');
  const head = h('div', null, pageHead('ვარჯიში', ''));
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer/sessions', 'ვარჯიშები'), head, body);
  let s = null;

  async function load() {
    try {
      s = (await A.session(id)).session;
      draw();
    } catch (e) { mount(body, errorBox(e, load)); }
  }

  function draw() {
    mount(head, pageHead(s.kindLabel, `${dayLabel(tbYmd(s.startsAt))} · ${clockOf(s.startsAt)} · ${s.durationMin} წთ`));
    const ex = s.exercises || [];
    const volume = ex.reduce((sum, e) => sum + (e.sets ?? 0) * (e.reps ?? 0) * (e.kg ?? 0), 0);
    const weighted = ex.filter((e) => e.sets && e.reps && e.kg);
    const w = s.workout;

    const rate = async (n) => {
      const prev = s.clientRating;
      s.clientRating = n;
      draw();
      try { s = { ...s, ...(await A.rate(s.id, n)).session }; toast('მადლობა შეფასებისთვის'); draw(); } catch (e) { s.clientRating = prev; toast(errMsg(e), 'error'); draw(); }
    };

    mount(body, h('div', { class: 'grid grid-main' },
      h('div', { class: 'tr-col' },
        card({ class: 'pad-lg' },
          h('div', { class: 'between' }, h('div', { class: 'card-title', style: { fontSize: '17px' } }, s.kindLabel), sessionBadge(s)),
          h('div', { class: 'stats-row', style: { marginTop: '16px' } },
            stat('ხანგრძლივობა', `${s.durationMin}`, { unit: 'წთ', icon: 'timer' }),
            stat('სავარჯიშო', String(ex.length), { icon: 'dumbbell' }),
            stat('მოცულობა', volume ? fmtNum(Math.round(volume)) : '—', { unit: volume ? 'კგ' : '', icon: 'trendUp' })),
          s.gym ? h('div', { class: 'tr-fact', style: { marginTop: '14px' } }, icon('mapPin', { size: 15 }), h('span', null, `${gymLine(s.gym)}, ${s.gym.city}`)) : null,
          s.note ? h('p', { class: 'tr-quote' }, `„${s.note}“`) : null,
          s.status === 'CANCELLED' ? h('p', { class: 'muted tr-small', style: { marginTop: '10px' } },
            `გააუქმა ${s.cancelledBy === 'CLIENT' ? 'შენ' : 'ტრენერმა'}${s.cancelReason ? ` — „${s.cancelReason}“` : ''}`) : null,
          s.status === 'SCHEDULED' ? h('div', { class: 'hstack', style: { marginTop: '16px' } },
            !s.clientConfirmedAt ? button('მოვალ ✓', { onClick: (e) => confirmFlow(e.currentTarget, s, load) }) : badge('დადასტურებული', 'brand'),
            button('გაუქმება', { variant: 'ghost', onClick: () => cancelSessionFlow(s, load) })) : null),
        ex.length ? section('სავარჯიშოები', card({ class: 'flush' }, h('div', { class: 'table-wrap' }, h('table', { class: 'table tr-extable' },
          h('thead', null, h('tr', null, h('th', null, 'სავარჯიშო'), h('th', null, 'სეტი × გამ.'), h('th', null, 'წონა'), h('th', null, 'დრო'))),
          h('tbody', null, ex.map((e) => h('tr', null,
            h('td', null, h('strong', null, e.name)),
            h('td', { class: 'num' }, e.sets && e.reps ? `${e.sets} × ${e.reps}` : '—'),
            h('td', { class: 'num' }, e.kg ? `${fmtNum(e.kg, 1)} კგ` : '—'),
            h('td', { class: 'num' }, e.minutes ? `${fmtNum(e.minutes)} წთ` : '—')))))))) : null,
        weighted.length >= 2 ? section('მოცულობა სავარჯიშოების მიხედვით', card(barChart({
          labels: weighted.map((e) => e.name.length > 12 ? `${e.name.slice(0, 11)}…` : e.name), tipLabels: weighted.map((e) => e.name),
          values: weighted.map((e) => Math.round(e.sets * e.reps * e.kg)), unit: 'კგ', height: 200, color: 'var(--c2)',
        }))) : null,
        s.trainerNote ? section('ტრენერის შენიშვნა', card(h('p', { class: 'tr-note' }, s.trainerNote))) : null),
      h('div', { class: 'tr-col tr-sticky' },
        s.status === 'DONE' ? section('როგორ იყო ვარჯიში?', card({ class: 'tr-rate' }, stars(s.clientRating, rate), h('p', { class: 'faint tr-small' }, s.clientRating ? 'შეფასება ტრენერს ეხმარება, უკეთ დაგეგმოს.' : 'შეაფასე 1-დან 5-მდე.'))) : null,
        w ? section('შენი საათიდან / ტელეფონიდან', card({ class: 'stack' },
          h('div', { class: 'card-title' }, workoutKindLabel(w.kind)),
          h('div', { class: 'tr-kpis' },
            h('div', null, h('strong', null, `${w.durationMin}`), h('span', null, 'წუთი')),
            h('div', null, h('strong', { style: { color: 'var(--ink-amber)' } }, w.kcal != null ? fmtNum(w.kcal) : '—'), h('span', null, 'კკალ')),
            h('div', null, h('strong', { style: { color: 'var(--ink-rose)' } }, w.avgHeartRate != null ? fmtNum(w.avgHeartRate) : '—'), h('span', null, 'საშ. პულსი'))),
          h('p', { class: 'faint tr-small' }, `${w.source === 'apple_health' ? 'Apple Health' : 'Health Connect'} · ${clockOf(w.startedAt)}–${clockOf(w.endedAt)}`)))
          : s.status === 'DONE' ? appHint('საათით ან ტელეფონით ჩაწერილი ვარჯიში (კალორია, პულსი) აქ ავტომატურად მიებმება, თუ „ვარჯიშებს“ უზიარებ და იყენებ') : null)));
  }

  await load();
}

/* ═══ Page: meal plan (/trainer/plan) ════════════════════ */
async function planPage(root, ctx) {
  ctx.setTitle('კვების გეგმა');
  const head = h('div', null, pageHead('კვების გეგმა', ''));
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', 'ჩემი ტრენერი'), head, body);

  async function load() {
    try { draw(await A.overview()); } catch (e) { mount(body, errorBox(e, load)); }
  }

  function draw(ov) {
    const plan = ov?.plan;
    mount(head, pageHead('კვების გეგმა', ov?.trainer?.displayName ? `ტრენერი: ${ov.trainer.displayName}` : '', plan ? button('კვების ჩაწერა', { icon: 'plus', href: '/nutrition' }) : null));
    if (!plan) {
      mount(body, card(empty('გეგმა ჯერ არ არის', 'როცა ტრენერი კვების გეგმას გამოგიგზავნის, აქ გამოჩნდება და შეტყობინება მოგივა.', button('ჩემი ტრენერი', { href: '/trainer', variant: 'ghost' }))));
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
          plan.startsOn ? h('div', { class: 'card-sub' }, `აქტიურია ${fmtDate(plan.startsOn)}-დან`) : null,
          h('div', { class: 'stats-row tr-targets' },
            stat('კალორია', fmtNum(plan.targets.calories), { unit: 'კკალ / დღე', icon: 'flame' }),
            plan.targets.protein ? stat('ცილა', fmtNum(plan.targets.protein), { unit: 'გ' }) : null,
            plan.targets.carbs ? stat('ნახშირწყლები', fmtNum(plan.targets.carbs), { unit: 'გ' }) : null,
            plan.targets.fat ? stat('ცხიმი', fmtNum(plan.targets.fat), { unit: 'გ' }) : null),
          today ? h('div', { class: 'tr-today' },
            h('div', { class: 'between' },
              h('span', { class: 'muted' }, `დღეს: ${fmtNum(today.calories)} / ${fmtNum(plan.targets.calories)} კკალ`),
              h('strong', { class: `tr-tone-${DAY_STATUS_TONE[today.status]}` }, left != null && left >= 0 ? `დარჩა ${fmtNum(left)}` : `გადაჭარბება ${fmtNum(Math.abs(left ?? 0))}`)),
            progress(today.calories, plan.targets.calories, { ink: today.status === 'OVER' ? 'rose' : 'teal' })) : null),
        plan.meals?.length ? section('დღის მენიუ', h('div', { class: 'grid grid-2' }, plan.meals.map((m) => {
          const kcal = (m.items || []).reduce((sum, it) => sum + (Number(it.calories) || 0), 0);
          return card({ class: 'tr-meal' },
            h('div', { class: 'between' },
              h('div', { class: 'card-title' }, SLOT_KA[m.slot] || m.slot),
              h('span', { class: 'faint tr-small' }, [m.time, kcal ? `${fmtNum(kcal)} კკალ` : null].filter(Boolean).join(' · '))),
            h('ul', { class: 'tr-items' }, (m.items || []).map((it) => h('li', null,
              h('span', null, it.name),
              h('small', null, [it.grams ? `${fmtNum(it.grams)} გ` : null, it.calories ? `${fmtNum(it.calories)} კკალ` : null, it.protein ? `ც ${fmtNum(it.protein)} გ` : null].filter(Boolean).join(' · '))))));
        }))) : null,
        plan.note ? section('ტრენერის რჩევა', card(h('p', { class: 'tr-note' }, plan.note))) : null,
        h('p', { class: 'disclaimer' }, icon('info', { size: 15 }), h('span', null, 'გეგმა ტრენერისგანაა და შენს კვების პროგრამას არ ცვლის. თუ გაქვს დიაბეტი, თირკმლის დაავადება, ორსულობა ან კვების დარღვევის ისტორია, გეგმა ექიმთანაც შეათანხმე.'))),
      h('div', { class: 'tr-col tr-sticky' },
        section('ბოლო 7 დღე', card({ class: 'stack' },
          h('div', { class: 'hstack', style: { flexWrap: 'nowrap', gap: '16px' } },
            ring({ value: score ?? 0, max: 100, size: 88, stroke: 9, label: score != null ? `${score}%` : '—', labelScale: 0.22, color: score == null ? 'var(--bg3)' : score >= 70 ? 'var(--ok)' : score >= 40 ? 'var(--warn)' : 'var(--danger)' }),
            h('div', null, h('div', { class: 'card-title' }, 'გეგმის დაცვა'), h('div', { class: 'card-sub' }, 'დასრულებული, ჩაწერილი დღეები: კალორია ±10 %, ცილა ≥ 85 %.'))),
          days.length ? barChart({
            labels: days.map((d) => String(Number(d.date.slice(8)))), tipLabels: days.map((d) => `${dayLabel(d.date)} · ${DAY_STATUS_LABEL[d.status]}`),
            values: days.map((d) => d.calories), goal: plan.targets.calories, goalLabel: `${fmtNum(plan.targets.calories)} კკალ`, unit: 'კკალ', height: 180, highlightLast: true,
          }) : null,
          days.length ? dayStrip(days) : null,
          stripLegend(),
          h('div', { class: 'list tr-daylist' }, [...days].reverse().map((d) => h('div', { class: 'tr-dayrow' },
            h('span', null, dayLabel(d.date)),
            h('span', { class: 'muted' }, d.meals ? `${fmtNum(d.calories)} კკალ · ც ${fmtNum(d.protein)} გ` : '—'),
            h('strong', { class: `tr-tone-${DAY_STATUS_TONE[d.status]}` }, DAY_STATUS_LABEL[d.status]))))))),
    ));
  }

  await load();
}

/* ═══ Page: progress (/trainer/progress) ═════════════════ */
async function progressPage(root, ctx) {
  ctx.setTitle('პროგრესი');
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', 'ჩემი ტრენერი'), pageHead('პროგრესი', 'წონა, ვარჯიშები, კვება და ფოტოები — ერთ ადგილას. ფოტოებს მხოლოდ შენ ხედავ, თუ ტრენერს არ გაუზიარებ.'), body);
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
        h('div', { class: 'between', style: { marginBottom: '8px' } }, h('div', { class: 'card-title' }, 'წონა · 120 დღე'),
          h('a', { class: 'link', href: '/health', 'data-link': '' }, 'აწონვა', icon('chevronRight', { size: 16 }))),
        lineChart({
          labels: weights.map((w) => shortYmd(w.date)), tipLabels: weights.map((w) => dayLabel(w.date)),
          series: [{ name: 'წონა', values: weights.map((w) => w.kg), color: 'var(--c5)', dots: weights.length < 25 }],
          goal: goal?.targetKg ?? null, goalLabel: goal ? `მიზანი ${fmtNum(goal.targetKg, 1)} კგ` : undefined, unit: 'კგ', height: 240, zero: false, fmt: (v) => fmtNum(v, 1),
        }))
      : card(empty('წონის ისტორია ჯერ არ არის', 'აიწონე რამდენჯერმე და აქ დაინახავ ტრენდს.', button('წონის ჩაწერა', { href: '/health', icon: 'scale', variant: 'secondary' })));

    const nd = ov?.nutrition?.days || [];
    mount(body,
      h('div', { class: 'stats-row tr-progress-stats' },
        card(stat('მიმდინარე წონა', current != null ? fmtNum(current, 1) : '—', { unit: current != null ? 'კგ' : '', icon: 'scale', delta: delta != null ? `${delta > 0 ? '+' : ''}${fmtNum(delta, 1)} კგ 120 დღეში` : undefined, deltaTone: delta != null && goal ? ((goal.targetKg < goal.startKg) === (delta < 0) ? 'up' : 'down') : '' })),
        card(stat('მიზნამდე', remaining != null ? fmtNum(Math.abs(remaining), 1) : '—', { unit: remaining != null ? 'კგ' : '', icon: 'target', delta: goal ? `მიზანი ${fmtNum(goal.targetKg, 1)} კგ` : 'მიზანი არ არის' })),
        card(stat('ჩატარებული ვარჯიში', active ? fmtNum(ov.stats?.done ?? 0) : '—', { icon: 'dumbbell', delta: active ? `გამოტოვა ${ov.stats?.noShow ?? 0}` : 'ტრენერი არ გყავს' })),
        card(stat('კვების დაცვა', ov?.nutrition?.score != null ? `${ov.nutrition.score}%` : '—', { icon: 'utensils', delta: ov?.plan ? 'ბოლო 7 დღე' : 'გეგმა არ არის' }))),
      h('div', { class: 'grid grid-main', style: { marginTop: '16px' } },
        section('წონა', weightCard),
        h('div', { class: 'tr-col' },
          section('ვარჯიშები', card(active ? weeklySessionsChart(ov.past || []) : h('p', { class: 'muted tr-small' }, 'ტრენერთან ვარჯიშები აქ გამოჩნდება კვირების მიხედვით.'))),
          nd.length && ov?.plan ? section('კვების გეგმა', card({ class: 'stack' },
            barChart({ labels: nd.map((d) => String(Number(d.date.slice(8)))), tipLabels: nd.map((d) => `${dayLabel(d.date)} · ${DAY_STATUS_LABEL[d.status]}`), values: nd.map((d) => d.calories), goal: ov.plan.targets.calories, unit: 'კკალ', height: 150, highlightLast: true }),
            dayStrip(nd, false)), { link: { href: '/trainer/plan', label: 'გეგმა' } }) : null)),
      section('ფოტო-პროგრესი', photoSlot));
    drawPhotos();
  }

  function latestWeight() { return weights.at(-1)?.kg ?? (Number(session.profile?.weightKg) || null); }

  function drawPhotos() {
    const active = ov?.link?.status === 'ACTIVE';
    const shared = active && ov.link.scopes?.photos;
    const same = photos.filter((p) => p.pose === pose).sort((a, b) => a.takenOn.localeCompare(b.takenOn));
    const pair = same.length >= 2 ? { before: same[0], after: same[same.length - 1] } : null;

    const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', hidden: true });
    const addBtn = button(`ფოტოს დამატება · ${POSE_LABEL[pose]}`, { icon: 'upload' });
    addBtn.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', () => {
      const f = fileIn.files?.[0];
      fileIn.value = '';
      if (!f) return;
      if (f.size > 15 * 1024 * 1024) { toast('ფოტო 15 მბ-ზე დიდია.', 'error'); return; }
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
          toast('ფოტო დაემატა');
          drawPhotos();
        } catch (e) { toast(errMsg(e), 'error'); }
      });
    });

    const remove = async (p) => {
      const ok = await confirmDialog({ title: 'ფოტოს წაშლა', body: `${POSE_LABEL[p.pose]} · ${fmtDate(p.takenOn, { year: true })}. წაშლა შეუქცევადია.`, confirm: 'წაშლა', danger: true });
      if (!ok) return;
      try {
        await del(`/api/trainer/photos/${enc(p.id)}`);
        photos = photos.filter((x) => x.id !== p.id);
        toast('ფოტო წაიშალა');
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
              h('h3', null, same.length ? 'კიდევ ერთი ფოტო და შედარება გამოჩნდება' : 'პირველი ფოტო — შენი „მანამდე“'),
              h('p', null, 'გადაიღე კვირაში ერთხელ, ერთსა და იმავე პოზაში. რამდენიმე კვირაში აქ დაინახავ განსხვავებას, რომელსაც სარკე ვერ გაჩვენებს.')))),
        h('div', { class: 'tr-photo-side' },
          h('div', { class: 'tr-mini' }, tile('lock', 'teal', 36),
            h('p', { class: 'muted tr-small' }, 'ფოტოები დაცულად ინახება და მხოლოდ შენ ხედავ. ',
              active ? (shared ? 'შენი ტრენერიც ხედავს (გაზიარებაში ჩართულია).' : 'ტრენერს არ უჩანს — ჩართე „პროგრეს-ფოტოები“ გაზიარებაში, თუ გინდა.') : '')),
          h('p', { class: 'faint tr-small' }, 'ყოველთვის ერთნაირად გადაიღე: იგივე ადგილი, იგივე განათება, დილით.'),
          byDate.size ? h('div', { class: 'tr-history' }, [...byDate.entries()].map(([date, list]) => h('div', { class: 'tr-hist-day' },
            h('div', { class: 'tr-hist-label' }, `${dayLabel(date)}${list.find((p) => p.weightKg)?.weightKg ? ` · ${fmtNum(list.find((p) => p.weightKg).weightKg, 1)} კგ` : ''}`),
            h('div', { class: 'tr-thumbs' }, list.map((p) => h('div', { class: `tr-thumb ${p.pose === pose ? 'on' : ''}` },
              h('button', { type: 'button', class: 'tr-thumb-btn', 'aria-label': `${POSE_LABEL[p.pose]}, ${p.takenOn}`, onClick: () => { pose = p.pose === 'OTHER' ? pose : p.pose; drawPhotos(); } },
                privateImg(p.url, POSE_LABEL[p.pose])),
              h('span', null, POSE_LABEL[p.pose]),
              iconButton('trash', { title: 'ფოტოს წაშლა', class: 'tr-thumb-del', size: 16, onClick: () => remove(p) }))))))) : null))));
  }

  await load();
  return () => { alive = false; };
}

/** Before/after with a draggable divider (range input on top, keyboard accessible). */
function compare(before, after) {
  const wrap = h('div', { class: 'tr-compare' },
    privateImg(after.url, 'შემდეგ', 'tr-compare-after'),
    h('div', { class: 'tr-compare-before' }, privateImg(before.url, 'მანამდე')),
    h('div', { class: 'tr-compare-line' }, h('span', null, '‹ ›')),
    h('span', { class: 'tr-compare-tag l' }, `მანამდე · ${shortYmd(before.takenOn)}`),
    h('span', { class: 'tr-compare-tag r' }, `შემდეგ · ${shortYmd(after.takenOn)}`));
  wrap.style.setProperty('--split', '50%');
  const range = h('input', { type: 'range', min: 3, max: 97, value: 50, class: 'tr-compare-range', 'aria-label': 'მანამდე და შემდეგ — გადაათრიე გამყოფი' });
  range.addEventListener('input', () => wrap.style.setProperty('--split', `${range.value}%`));
  wrap.appendChild(range);
  const kg = before.weightKg != null && after.weightKg != null ? Math.round((after.weightKg - before.weightKg) * 10) / 10 : null;
  return h('div', null, wrap,
    h('div', { class: 'between', style: { marginTop: '10px' } },
      h('strong', null, `${daysBetween(before.takenOn, after.takenOn)} დღე`),
      kg != null ? h('strong', { class: kg <= 0 ? 'tr-tone-ok' : 'tr-tone-warn' }, `${kg > 0 ? '+' : ''}${fmtNum(kg, 1)} კგ`) : null));
}

/* ═══ Page: become a trainer (/trainer/apply) ════════════ */
const STEPS = ['შენ შესახებ', 'სპეციალიზაცია და დარბაზი', 'სერტიფიკატები'];

async function applyPage(root, ctx) {
  ctx.setTitle('ტრენერის რეგისტრაცია');
  const body = h('div', null, pageSkeleton());
  mount(root, back('/trainer', 'ჩემი ტრენერი'), body);
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
    if (s === 0 && f.name.trim().length < 2) return 'მიუთითე სახელი, რომლითაც კლიენტები გიცნობენ.';
    if (s === 1 && !f.gyms.length) return 'აირჩიე მინიმუმ ერთი დარბაზი, სადაც ვარჯიშებს ატარებ.';
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
    const phoneReason = 'ტრენერის პროფილისთვის ტელეფონის დადასტურება საჭიროა — ასე კლიენტები დარწმუნებულები არიან, რომ რეალურ ადამიანთან აქვთ საქმე.';
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
          if (await offerPhoneVerification(phoneReason)) setHint('ტელეფონი დადასტურდა — გააგზავნე ხელახლა.');
          return;
        }
        if (e instanceof ApiError && e.code === 'BIRTHDATE_REQUIRED') {
          setHint(e.message, h('a', { class: 'link', href: '/profile', 'data-link': '', style: { marginLeft: '8px' } }, 'პროფილის გახსნა'));
          return;
        }
        setHint(e instanceof ApiError ? e.message : 'ვერ გაიგზავნა. შეამოწმე ინტერნეტი და სცადე ხელახლა.');
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
      if (failed.length) toast(`${failed.join(', ')} — სერტიფიკატი ვერ აიტვირთა. სცადე ხელახლა „რედაქტირებიდან“.`, 'error', { ms: 6000 });
      else toast(profile?.status === 'PENDING' ? 'განაცხადი გაიგზავნა' : 'ცვლილებები შენახულია');
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
    const ok = await confirmDialog({ title: 'სერტიფიკატის წაშლა', body: c.title, confirm: 'წაშლა', danger: true });
    if (!ok) return;
    try {
      const res = await del(`/api/trainer/certificates/${enc(c.id)}`);
      profile = res.trainerProfile;
      toast('სერტიფიკატი წაიშალა');
      draw();
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  /* ── form ── */
  function drawForm() {
    const last = step === STEPS.length - 1;
    const sendLabel = profile ? (profile.status === 'REJECTED' ? 'ხელახლა გაგზავნა' : 'ცვლილებების შენახვა') : 'განაცხადის გაგზავნა';
    const nextBtn = last ? button(sendLabel, { icon: 'send' }) : button('შემდეგი', { icon: 'arrowRight' });
    nextBtn.addEventListener('click', () => {
      if (last) { submit(nextBtn); return; }
      const problem = validate(step);
      setHint(problem);
      if (!problem) { step += 1; drawForm(); }
    });
    const stepBody = step === 0 ? stepAbout() : step === 1 ? stepGyms() : stepCerts();
    const formCard = card({ class: 'pad-lg tr-apply' },
      h('div', { class: 'onb-steps' }, STEPS.map((_, i) => h('i', { class: i <= step ? 'on' : '' }))),
      h('div', { class: 'tr-step-label' }, `ნაბიჯი ${step + 1} / ${STEPS.length} · ${STEPS[step]}`),
      stepBody,
      hint,
      h('div', { class: 'between tr-apply-foot' },
        step > 0 ? button('უკან', { variant: 'ghost', icon: 'chevronLeft', onClick: () => { setHint(null); step -= 1; drawForm(); } }) : (profile ? button('გაუქმება', { variant: 'ghost', onClick: () => { editing = false; setHint(null); draw(); } }) : h('span')),
        nextBtn));

    const aside = !profile
      ? card({ class: 'spotlight hero-card pad-lg tr-hero' },
        tile('award', 'teal', 44),
        h('h2', null, 'ტრენერის სამუშაო სივრცე — უფასოდ'),
        h('ul', { class: 'tr-points' }, ['კალენდარი და ჯავშნები შეხსენებებით', 'კლიენტები QR-ით, ერთი დასკანერებით', 'კვების გეგმა და კლიენტის პროგრესი']
          .map((t) => h('li', null, icon('check', { size: 18 }), h('span', null, t)))),
        h('p', { class: 'muted tr-small' }, 'საჭიროა დადასტურებული ტელეფონი და 18+. პროფილს MEDICARD-ის გუნდი ამოწმებს 1–2 სამუშაო დღეში.'))
      : null;

    mount(body,
      pageHead(profile ? 'განაცხადის რედაქტირება' : 'ტრენერის რეგისტრაცია', 'კლიენტები გნახავენ ძიებაში, როცა MEDICARD-ის გუნდი პროფილს დაადასტურებს.'),
      h('div', { class: 'grid grid-main' }, formCard, h('div', { class: 'tr-col tr-sticky' }, aside, section('შეჯამება', summaryCard()))));
  }

  function stepAbout() {
    const name = input({ value: f.name, maxlength: 60, placeholder: 'მაგ. ნიკა ბერიძე', onInput: (e) => { f.name = e.target.value; } });
    const bio = textarea({ value: f.bio, maxlength: 800, rows: 5, placeholder: 'მაგ. 6 წელია ვმუშაობ ძალოვან ვარჯიშსა და წონის კლებაზე…', onInput: (e) => { f.bio = e.target.value; } });
    const years = input({ value: f.years, inputmode: 'numeric', maxlength: 2, placeholder: '5', onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2); f.years = e.target.value; } });
    const ig = input({ value: f.instagram, maxlength: 31, autocapitalize: 'none', autocomplete: 'off', placeholder: '@username', onInput: (e) => { f.instagram = e.target.value; } });
    return h('div', { class: 'form' },
      field('სახელი, რომლითაც კლიენტები გიცნობენ', name),
      field('შენს შესახებ', bio, 'მიდგომა, გამოცდილება, რისი მიღწევა შეუძლია კლიენტს შენთან. ფასი, თუ გინდა, აქ ჩაწერე — აპში გადახდა არ ხდება.'),
      h('div', { class: 'form-row' }, field('გამოცდილება, წელი', years), field('Instagram', ig)));
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
          else { toast('მაქსიმუმ 6 სპეციალიზაცია', 'info'); return; }
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
          g.status === 'PROPOSED' ? badge('ახალი დარბაზი — გადამოწმდება', 'warn') : null),
        iconButton('x', { title: `${g.brand} წაშლა`, onClick: () => { f.gyms = f.gyms.filter((x) => x.id !== g.id); drawGyms(); refreshSummary(); } }))),
      f.gyms.length < 5 ? h('div', { class: 'hstack' },
        button(f.gyms.length ? 'კიდევ ერთი დარბაზი' : 'დარბაზის არჩევა', {
          variant: 'secondary', icon: 'plus',
          onClick: () => gymPicker((g) => { if (g && !f.gyms.some((x) => x.id === g.id)) { f.gyms = [...f.gyms, g]; setHint(null); drawGyms(); refreshSummary(); } }, { exclude: f.gyms.map((g) => g.id), allowAll: false }),
        }),
        button('ჩემი დარბაზი სიაში არ არის', { variant: 'ghost', onClick: proposeGym })) : null);
    drawGyms();

    function proposeGym() {
      formModal({
        title: 'ახალი დარბაზი',
        size: 'sm',
        submit: 'დამატება',
        fields: [
          h('p', { class: 'muted' }, 'დაამატე დარბაზი — გუნდი გადაამოწმებს და ყველასთვის გამოჩნდება.'),
          field('დარბაზის სახელი', input({ name: 'brand', maxlength: 80, required: true })),
          h('div', { class: 'form-row' }, field('ქალაქი', input({ name: 'city', maxlength: 40, value: 'თბილისი' })), field('მისამართი (არასავალდ.)', input({ name: 'address', maxlength: 160 }))),
        ],
        onSubmit: async (v, close) => {
          if (String(v.brand || '').trim().length < 2) throw new Error('ჩაწერე დარბაზის სახელი.');
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
      h('div', null, h('h3', { class: 'tr-h3' }, 'სპეციალიზაცია'), h('p', { class: 'faint tr-small', style: { margin: '-4px 0 10px' } }, 'აირჩიე 6-მდე'), chips),
      h('div', null, h('h3', { class: 'tr-h3' }, 'სად ვარჯიშებ'), gymList));
  }

  function stepCerts() {
    const title = input({ maxlength: 120, placeholder: 'დასახელება (მაგ. NASM CPT, დიპლომი)' });
    const issuer = input({ maxlength: 120, placeholder: 'გამცემი' });
    const year = input({ inputmode: 'numeric', maxlength: 4, placeholder: 'წელი', onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); } });
    const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', hidden: true });
    const pick = button('ფოტოს არჩევა და დამატება', { variant: 'secondary', icon: 'upload' });
    pick.addEventListener('click', () => {
      if (title.value.trim().length < 2) { setHint('ჯერ ჩაწერე სერტიფიკატის დასახელება.'); title.focus(); return; }
      fileIn.click();
    });
    fileIn.addEventListener('change', () => {
      const file = fileIn.files?.[0];
      fileIn.value = '';
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) { setHint('ფაილი 15 მბ-ზე დიდია.'); return; }
      const item = { key: `${Date.now()}`, title: title.value.trim(), issuer: issuer.value.trim(), year: year.value.trim(), file, preview: URL.createObjectURL(file) };
      setHint(null);
      if (profile) {
        busy(pick, async () => {
          try {
            const res = await uploadCert(item);
            profile = res.trainerProfile;
            toast('სერტიფიკატი დაემატა');
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
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, c.title), h('div', { class: 'row-sub' }, [c.issuer, c.year].filter(Boolean).join(' · ') || 'ფოტო ატვირთულია')),
      iconButton('trash', { title: 'სერტიფიკატის წაშლა', onClick: () => removeCert(c) })));
    const staged = f.staged.map((sc) => h('div', { class: 'tr-gymrow' },
      h('img', { src: sc.preview, alt: '', class: 'tr-cert-prev' }),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, sc.title), h('div', { class: 'row-sub' }, [sc.issuer, sc.year].filter(Boolean).join(' · ') || 'აიტვირთება განაცხადთან ერთად')),
      iconButton('x', { title: 'წაშლა', onClick: () => { URL.revokeObjectURL(sc.preview); f.staged = f.staged.filter((x) => x.key !== sc.key); drawForm(); } })));

    return h('div', { class: 'stack', style: { gap: '16px' } },
      h('p', { class: 'muted tr-small' }, 'არასავალდებულოა, მაგრამ დადასტურებას მნიშვნელოვნად აჩქარებს. ფოტოს ხედავს მხოლოდ MEDICARD-ის გუნდი.'),
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
      h('div', { class: 'card-title' }, `${f.name || '—'}${f.years ? ` · ${f.years} წლის გამოცდილება` : ''}`),
      h('div', { class: 'tr-fact' }, icon('mapPin', { size: 15 }), h('span', null, f.gyms.map(gymLine).join(' · ') || 'დარბაზი არ არის არჩეული')),
      h('div', { class: 'tr-fact' }, icon('sparkles', { size: 15 }), h('span', null, `${f.specialties.length} სპეციალიზაცია · ${certs} სერტიფიკატი`)));
  }

  /* ── status ── */
  function drawStatus() {
    const st = profile.status;
    const tone = st === 'VERIFIED' ? 'ok' : st === 'PENDING' ? 'warn' : 'danger';
    const sent = profile.submittedAt ? fmtDate(profile.submittedAt, { year: true }) : '';
    const steps = [
      { label: 'განაცხადი გაგზავნილია', detail: sent, done: true, current: false },
      { label: 'გუნდი ამოწმებს', detail: st === 'PENDING' ? 'ჩვეულებრივ 1–2 სამუშაო დღე' : st === 'REJECTED' ? 'დაზუსტება სჭირდება' : '', done: st === 'VERIFIED', current: st === 'PENDING' || st === 'REJECTED' },
      { label: 'დადასტურება და ტრენერის რეჟიმი', detail: st === 'VERIFIED' ? 'მზადაა — მოიწვიე კლიენტები' : 'შეტყობინება მოგივა', done: st === 'VERIFIED', current: false },
    ];
    const title = justSent && st === 'PENDING' ? 'განაცხადი გაიგზავნა!' : st === 'PENDING' ? 'განაცხადი განხილვაშია' : st === 'VERIFIED' ? 'დადასტურებული ტრენერი ხარ' : st === 'REJECTED' ? 'განაცხადს დაზუსტება სჭირდება' : 'პროფილი შეჩერებულია';
    const text = st === 'PENDING'
      ? 'MEDICARD-ის გუნდი ამოწმებს შენს პროფილს და სერტიფიკატებს. დადასტურებისას შეტყობინება მოგივა და ტრენერის რეჟიმი გაიხსნება.'
      : st === 'VERIFIED' ? 'კლიენტებს მოიწვევ QR-ით ან კოდით, ჩაწერ ვარჯიშებზე და ნახავ მათ პროგრესს — იმას, რასაც გაგიზიარებენ.'
        : st === 'REJECTED' ? (profile.reviewNote || 'გადახედე მონაცემებს, გაასწორე და გაგზავნე ხელახლა.') : 'დეტალებისთვის მოგვწერე support@medicard.ge';
    const edit = (to) => { editing = true; step = to; setHint(null); draw(); };

    const codeBox = st === 'VERIFIED' && profile.code ? card({ class: 'tr-mycode' },
      h('div', { class: 'card-sub' }, 'შენი ტრენერის კოდი'),
      h('div', { class: 'tr-mycode-val' }, profile.code),
      profile.link ? h('div', { class: 'hstack' },
        h('span', { class: 'faint tr-small tr-ellipsis' }, profile.link),
        button('კოპირება', {
          size: 'sm', variant: 'ghost', icon: 'copy',
          onClick: async () => { try { await navigator.clipboard.writeText(profile.link); toast('ბმული დაკოპირდა'); } catch { toast('ვერ დაკოპირდა', 'error'); } },
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
              st === 'VERIFIED' ? button('ტრენერის სივრცის გახსნა', { href: '/coach', icon: 'arrowRight' }) : null,
              st === 'REJECTED' ? button('გასწორება და ხელახლა გაგზავნა', { icon: 'edit', onClick: () => edit(0) }) : null,
              st === 'PENDING' || st === 'VERIFIED' ? button(profile.certificates.length ? 'განაცხადის რედაქტირება' : 'სერტიფიკატის დამატება', { variant: 'secondary', icon: 'edit', onClick: () => edit(profile.certificates.length ? 0 : 2) }) : null)),
          codeBox),
        h('div', { class: 'tr-col tr-sticky' },
          section('შენი განაცხადი', card({ class: 'stack' },
            h('div', { class: 'card-title', style: { fontSize: '16px' } }, profile.displayName),
            profile.experienceYears ? h('div', { class: 'card-sub' }, `${profile.experienceYears} წლის გამოცდილება`) : null,
            profile.specialties?.length && catalog ? h('div', { class: 'chips tr-chips-static' }, profile.specialties.map((k) => h('span', { class: 'chip' }, catalog.specialties.find((s) => s.key === k)?.label || k))) : null,
            (profile.gyms || []).map((g) => h('div', { class: 'tr-fact' }, icon('mapPin', { size: 15 }), h('span', null, `${gymLine(g)}, ${g.city}`))),
            profile.certificates.map((c) => h('div', { class: 'tr-fact' }, icon('award', { size: 15 }), h('span', { style: { flex: 1 } }, [c.title, c.issuer, c.year].filter(Boolean).join(' · ')),
              st !== 'VERIFIED' ? iconButton('trash', { title: 'სერტიფიკატის წაშლა', size: 16, onClick: () => removeCert(c) }) : null)),
            !profile.certificates.length ? h('p', { class: 'tr-tone-warn tr-small' }, 'სერტიფიკატი არ არის — დამატება დადასტურებას აჩქარებს.') : null)))));
  }

  await load();
}

/* ═══ Page: scan (/trainer/scan) — QR works in the app; the web takes the code ═══ */
function scanPage(root, ctx) {
  ctx.setTitle('ტრენერის QR');
  mount(root, back('/trainer', 'ჩემი ტრენერი'),
    pageHead('ტრენერის QR', 'კამერით სკანირება MEDICARD აპში მუშაობს. ვებზე იგივეს გააკეთებ ტრენერის 6-სიმბოლოიანი კოდით.'),
    h('div', { class: 'grid grid-main' },
      codeCard(ctx.navigate, { autofocus: true }),
      card({ class: 'tr-mini' }, tile('smartphone', 'sky', 42),
        h('div', null,
          h('p', { class: 'muted tr-small' }, 'ტრენერის QR ჩანს მის „პროფილის“ ტაბზე, კოდი კი — QR-ის ქვეშ. აპში: ჩემი ტრენერი → ტრენერის QR-ის სკანირება.'),
          h('a', { class: 'link', href: APP_STORE, target: '_blank', rel: 'noopener', style: { marginTop: '8px' } }, 'MEDICARD აპი', icon('externalLink', { size: 14 }))))));
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
  const t = ov?.trainer;
  const verifiedTrainer = me?.trainerProfile?.status === 'VERIFIED';
  const coachRow = verifiedTrainer ? h('a', { class: 'tr-home-coach', href: '/coach', 'data-link': '' }, tile('users', 'teal', 32),
    h('span', { class: 'row-main' }, h('strong', null, 'ტრენერის სამუშაო სივრცე'), h('small', null, 'დღის განრიგი, კლიენტები, გეგმები')), icon('chevronRight', { size: 16, className: 'row-chev' })) : null;

  if (link?.status === 'ACTIVE' && t) {
    const next = (ov.upcoming || []).find((s) => s.status === 'SCHEDULED');
    const soon = next && new Date(next.startsAt).getTime() - Date.now() < 6 * 3600000;
    return h('div', { class: 'stack', style: { gap: '14px' } },
      h('a', { class: 'tr-home-top', href: '/trainer', 'data-link': '' },
        avatar(t, 52, t.verified),
        h('div', { class: 'row-main' },
          h('div', { class: 'tr-kicker' }, 'ჩემი ტრენერი'),
          h('div', { class: 'card-title' }, t.displayName),
          (t.gyms || [])[0] ? h('div', { class: 'card-sub tr-ellipsis' }, gymLine(t.gyms[0])) : null),
        icon('chevronRight', { size: 18, className: 'row-chev' })),
      h('div', { class: 'tr-home-next' },
        tile('calendarCheck', 'teal', 40),
        h('div', { class: 'row-main' },
          h('div', { class: 'card-sub' }, next ? `შემდეგი ვარჯიში · ${next.kindLabel}` : 'შემდეგი ვარჯიში'),
          h('div', { class: 'tr-home-when' }, next ? `${dayLabel(tbYmd(next.startsAt))}, ${clockOf(next.startsAt)}` : 'ჯერ არ არის დაგეგმილი'),
          next?.gym ? h('div', { class: 'faint tr-small tr-ellipsis' }, gymLine(next.gym)) : null),
        next ? (next.clientConfirmedAt
          ? h('span', { class: 'tr-pill soft' }, soon ? relativeStart(next.startsAt) : 'დადასტურდა')
          : button('მოვალ ✓', { size: 'sm', onClick: (e) => confirmFlow(e.currentTarget, next, reload) })) : null),
      h('div', { class: 'tr-kpis small' },
        h('div', null, h('strong', null, String(ov.stats?.done ?? 0)), h('span', null, 'ჩატარდა')),
        h('div', null, h('strong', null, ov.nutrition?.score != null ? `${ov.nutrition.score}%` : '—'), h('span', null, 'კვების გეგმა')),
        h('div', null, h('strong', null, String(ov.openSlots?.length ?? 0)), h('span', null, 'თავისუფ. დრო'))),
      coachRow);
  }

  if (link?.status === 'REQUESTED' && t) {
    const invited = link.initiator === 'TRAINER';
    return h('div', { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'tr-home-top' },
        avatar(t, 52, t.verified),
        h('div', { class: 'row-main' },
          h('div', { class: 'tr-kicker' }, invited ? 'ტრენერი გიწვევს' : 'მოთხოვნა გაგზავნილია'),
          h('div', { class: 'card-title' }, t.displayName),
          h('div', { class: 'card-sub' }, invited ? 'სანამ არ მიიღებ, შენს მონაცემებს ვერ ხედავს' : 'ტრენერი ნახავს და დაგიდასტურებს'))),
      invited ? h('div', { class: 'hstack' }, button('ნახვა და მიღება', { size: 'sm', href: '/trainer/connect?invite=1' }), button('დეტალები', { size: 'sm', variant: 'ghost', href: '/trainer' })) : null,
      coachRow);
  }

  return h('div', { class: 'stack', style: { gap: '14px' } },
    h('div', { class: 'tr-home-top' },
      tile('dumbbell', 'teal', 46),
      h('div', { class: 'row-main' },
        h('div', { class: 'card-title' }, 'იპოვე ტრენერი'),
        h('div', { class: 'card-sub' }, 'ჯავშნები, შეხსენებები და კვების გეგმა შენი ტრენერისგან — მხოლოდ იმას ნახავს, რასაც გაუზიარებ.')),
      button('მოძებნე', { size: 'sm', href: '/trainer', icon: 'search' })),
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
      ctx.setTitle('ტრენერის მოძებნა');
      mount(root, back('/trainer', 'ჩემი ტრენერი'), pageHead('ტრენერის მოძებნა', 'მოძებნე სახელით, სპეციალიზაციით, დარბაზით ან ქალაქით. ჩანს მხოლოდ MEDICARD-ის მიერ დადასტურებული ტრენერები.'), searchView());
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
