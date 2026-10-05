// MEDICARD web — „ვიზიტები“ (/visits). Mirrors mobile/app/visits/** (VisitCard, VisitEditorScreen) and
// server/src/routes/visits.routes.js. Reminders themselves are local notifications on the phone; the web
// edits the same reminderConfig the app schedules from.
import {
  h, mount, icon, tile, pageHead, section, card, button, iconButton, busy, badge, empty, skeleton,
  errorBox, segmented, field, textarea, input, select, toggle, toast, openModal, confirmDialog,
  fmtDate, relDay, ymd, parseDate, KA_MONTHS, KA_MONTHS_SHORT, KA_DAYS, debounce,
} from '../ui.js';
import { get, post, patch, del, invalidate } from '../api.js';
import { t, isEn } from '../i18n.js';

const CSS = '/app/css/visits.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

const APP_STORE = 'https://apps.apple.com/app/id6812517519';
const DISCLAIMER = t('ეს არ არის დიაგნოზი — საჭიროებისას ექიმს მიმართე.', 'This is not a diagnosis — see a doctor when needed.');
const DOCTOR_TYPES = isEn ? [
  ['GP', 'Family doctor'], ['DENTIST', 'Dentist'], ['CARDIO', 'Cardiologist'], ['GYN', 'Gynecologist'],
  ['NEURO', 'Neurologist'], ['ORTHO', 'Orthopedist'], ['THERAPIST', 'Internist'], ['OPHTHALMO', 'Ophthalmologist'],
  ['DERM', 'Dermatologist'], ['PED', 'Pediatrician'], ['OTHER', 'Other specialist'],
] : [
  ['GP', 'ოჯახის ექიმი'], ['DENTIST', 'სტომატოლოგი'], ['CARDIO', 'კარდიოლოგი'], ['GYN', 'გინეკოლოგი'],
  ['NEURO', 'ნეუროლოგი'], ['ORTHO', 'ორთოპედი'], ['THERAPIST', 'თერაპევტი'], ['OPHTHALMO', 'ოფთალმოლოგი'],
  ['DERM', 'დერმატოლოგი'], ['PED', 'პედიატრი'], ['OTHER', 'სხვა სპეციალისტი'],
];
export const typeLabel = (code) => DOCTOR_TYPES.find(([c]) => c === code)?.[1] || code;
const REMINDER_PRESETS = isEn ? [
  [10080, '1 week before'], [1440, '1 day before'], [180, '3 hours before'], [60, '1 hour before'], [30, '30 min before'],
] : [
  [10080, '1 კვირით ადრე'], [1440, '1 დღით ადრე'], [180, '3 საათით ადრე'], [60, '1 საათით ადრე'], [30, '30 წთ-ით ადრე'],
];
const POPULAR_TIMES = ['09:00', '10:00', '11:00', '14:00', '16:00', '18:00'];
const DEFAULT_REMINDERS = { enabled: true, offsetsMinutes: [1440, 60], repeatCount: 1 };
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = isEn ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] : ['კვ', 'ორ', 'სმ', 'ოთ', 'ხთ', 'პრ', 'შბ'];

/* ── Visit helpers (mobile lib/visitReminders) ──────────── */
function visitAt(v) {
  const [y, m, d] = String(v.visitDate).split('-').map(Number);
  const [hh, mm] = String(v.visitTime || '00:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}
const isPast = (v) => visitAt(v).getTime() < Date.now();
const doctorName = (v) => [v.doctorFirstName, v.doctorLastName].filter(Boolean).join(' ') || typeLabel(v.doctorType);
const place = (v) => v.addressLabel || v.address || '';
function normReminders(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: c.enabled ?? true,
    offsetsMinutes: Array.isArray(c.offsetsMinutes) && c.offsetsMinutes.length ? c.offsetsMinutes : DEFAULT_REMINDERS.offsetsMinutes,
    repeatCount: c.repeatCount ?? 1,
  };
}
function mapsUrl(v) {
  if (v.lat != null && v.lng != null) return `https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lng}#map=17/${v.lat}/${v.lng}`;
  const q = place(v);
  return q ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}` : null;
}
function countdown(v) {
  const days = Math.round((parseDate(v.visitDate) - parseDate(ymd())) / 86400000);
  if (days === 0) {
    const mins = Math.round((visitAt(v) - Date.now()) / 60000);
    if (mins <= 0) return t('ახლა', 'Now');
    return mins < 60 ? t(`${mins} წუთში`, `in ${mins} min`) : t(`${Math.floor(mins / 60)} საათში`, `in ${Math.floor(mins / 60)} h`);
  }
  if (days === 1) return t('ხვალ', 'Tomorrow');
  return t(`${days} დღეში`, `in ${days} days`);
}
function longDate(d) {
  const x = parseDate(d);
  return `${KA_DAYS[x.getDay()]}, ${fmtDate(x, { year: x.getFullYear() !== new Date().getFullYear() })}`;
}

/* ── Editor ───────────────────────────────────────────── */
function openEditor(visit, { onSaved, presetDate } = {}) {
  const v = visit || {};
  const rem = normReminders(v.reminderConfig);
  let geo = v.lat != null && v.lng != null ? { label: place(v), lat: v.lat, lng: v.lng } : null;
  let offsets = [...rem.offsetsMinutes];
  let repeatCount = rem.repeatCount;
  let remindersOn = rem.enabled;

  const typeSel = select(DOCTOR_TYPES.map(([value, label]) => ({ value, label })), v.doctorType || 'GP', { name: 'doctorType', 'aria-label': t('ექიმის სპეციალობა', 'Doctor’s specialty') });
  const first = input({ name: 'doctorFirstName', placeholder: t('მაგ. ნინო', 'e.g. Nino'), maxlength: 80, value: v.doctorFirstName || '', autocomplete: 'off' });
  const last = input({ name: 'doctorLastName', placeholder: t('მაგ. ბერიძე', 'e.g. Beridze'), maxlength: 80, value: v.doctorLastName || '', autocomplete: 'off' });
  const date = input({ name: 'visitDate', type: 'date', required: true, value: v.visitDate || presetDate || ymd() });
  const time = input({ name: 'visitTime', type: 'time', required: true, step: 300, value: v.visitTime || '10:00' });
  const timeChips = h('div', { class: 'chips vis-times' });
  const paintTimes = () => mount(timeChips, POPULAR_TIMES.map((t) => h('button', { type: 'button', class: `chip ${time.value === t ? 'on' : ''}`, onClick: () => { time.value = t; paintTimes(); } }, t)));
  time.addEventListener('input', paintTimes);
  paintTimes();

  // Address: live OpenStreetMap search through our /api/visits/geocode proxy.
  const addr = input({ name: 'address', placeholder: t('მაგ. ვაჟა-ფშაველას 29, თბილისი', 'e.g. 29 Vazha-Pshavela Ave, Tbilisi'), maxlength: 300, value: place(v), autocomplete: 'off', role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
  const addrHint = h('span', { class: 'field-hint' }, geo ? t('მისამართი არჩეულია · რუკაზე ნახავ', 'Address selected · see it on the map') : t('OpenStreetMap · ცოცხალი ძებნა', 'OpenStreetMap · live search'));
  const results = h('div', { class: 'vis-geo', role: 'listbox', hidden: true });
  let seq = 0;
  const closeResults = () => { results.hidden = true; addr.setAttribute('aria-expanded', 'false'); };
  const search = debounce(async () => {
    const q = addr.value.trim();
    const my = ++seq;
    if (q.length < 3) { closeResults(); return; }
    mount(results, h('div', { class: 'vis-geo-note' }, t('მისამართების ძებნა…', 'Searching addresses…')));
    results.hidden = false;
    try {
      const { results: rows } = await get('/api/visits/geocode', { q });
      if (my !== seq) return;
      mount(results, rows?.length ? rows.map((r) => h('button', { type: 'button', role: 'option', class: 'vis-geo-row', onClick: () => {
        geo = { label: String(r.label).slice(0, 400), lat: r.lat, lng: r.lng };
        addr.value = String(r.label).slice(0, 300);
        addrHint.textContent = t('მისამართი არჩეულია · რუკაზე ნახავ', 'Address selected · see it on the map');
        closeResults();
      } }, icon('mapPin', { size: 16 }), h('span', null, r.label))) : h('div', { class: 'vis-geo-note' }, t('შედეგი ვერ მოიძებნა — სცადე სხვა ფორმატი', 'No results — try a different format')));
      addr.setAttribute('aria-expanded', 'true');
    } catch {
      if (my === seq) mount(results, h('div', { class: 'vis-geo-note' }, t('ძებნა ვერ მოხერხდა. შეამოწმე ინტერნეტი და ხელახლა სცადე.', 'Search failed. Check your connection and try again.')));
    }
  }, 450);
  addr.addEventListener('input', () => { geo = null; addrHint.textContent = t('OpenStreetMap · ცოცხალი ძებნა', 'OpenStreetMap · live search'); search(); });
  addr.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !results.hidden) { e.stopPropagation(); closeResults(); } });

  const notes = textarea({ name: 'notes', placeholder: t('მაგ. საჭიროა ანალიზების ფოტო', 'e.g. Bring photos of test results'), maxlength: 500, rows: 3, value: v.notes || '' });

  const remBody = h('div', { class: 'stack', style: { gap: '12px' } });
  const paintRem = () => {
    remBody.hidden = !remindersOn;
    mount(remBody,
      h('span', { class: 'field-hint' }, t('როდის გინდა შეხსენება', 'When do you want a reminder?')),
      h('div', { class: 'chips' }, REMINDER_PRESETS.map(([m, label]) => h('button', {
        type: 'button', class: `chip ${offsets.includes(m) ? 'on' : ''}`, role: 'checkbox', 'aria-checked': offsets.includes(m) ? 'true' : 'false',
        onClick: () => { offsets = offsets.includes(m) ? offsets.filter((x) => x !== m) : [...offsets, m].sort((a, b) => b - a); paintRem(); },
      }, label))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('რამდენჯერ', 'How many times')),
        segmented([{ value: 1, label: t('1-ჯერ', 'Once') }, { value: 2, label: t('2-ჯერ', 'Twice') }, { value: 3, label: t('3-ჯერ', '3 times') }], repeatCount, (n) => { repeatCount = n; }),
        h('span', { class: 'field-hint' }, t('დამატებითი შეხსენება ვიზიტამდე 15 წთ-ით', 'Extra reminders 15 min apart before the visit'))));
  };
  paintRem();

  const fields = () => h('div', { class: 'stack', style: { gap: '18px' } },
    h('div', { class: 'vis-step' }, h('div', { class: 'vis-step-h' }, tile('stethoscope', 'teal', 30), h('span', null, t('ექიმი', 'Doctor'))),
      field(t('ექიმის სპეციალობა', 'Doctor’s specialty'), typeSel),
      h('div', { class: 'form-row' }, field(t('ექიმის სახელი (არასავალდებულო)', 'Doctor’s first name (optional)'), first), field(t('ექიმის გვარი (არასავალდებულო)', 'Doctor’s last name (optional)'), last))),
    h('div', { class: 'vis-step' }, h('div', { class: 'vis-step-h' }, tile('calendar', 'blue', 30), h('span', null, t('როდის', 'When'))),
      h('div', { class: 'form-row' }, field(t('ვიზიტის თარიღი', 'Visit date'), date), field(t('დრო', 'Time'), time)),
      h('div', { class: 'field' }, h('span', { class: 'field-hint' }, t('პოპულარული დროები', 'Popular times')), timeChips)),
    h('div', { class: 'vis-step' }, h('div', { class: 'vis-step-h' }, tile('mapPin', 'violet', 30), h('span', null, t('სად', 'Where'))),
      h('div', { class: 'field vis-addr' }, h('span', { class: 'field-label' }, t('კლინიკის მისამართი', 'Clinic address')), addr, results, addrHint)),
    h('div', { class: 'vis-step' }, h('div', { class: 'vis-step-h' }, tile('bellRing', 'amber', 30), h('span', null, t('დეტალები', 'Details'))),
      field(t('შენიშვნა', 'Note'), notes),
      h('div', { class: 'between' }, h('span', { class: 'field-label' }, t('შეხსენებები', 'Reminders')), toggle(remindersOn, (on) => { remindersOn = on; paintRem(); })),
      remBody,
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('შეხსენებებს MEDICARD აპი გამოგიგზავნის ტელეფონზე.', 'The MEDICARD app sends reminders to your phone.'))));

  formModal2({
    title: visit ? t('ვიზიტის რედაქტირება', 'Edit visit') : t('ახალი ვიზიტი', 'New visit'),
    submit: t('ვიზიტის შენახვა', 'Save visit'),
    fields,
    onSubmit: async (_vals, close) => {
      if (!date.value || !time.value) throw new Error(t('ველის შევსება სავალდებულოა', 'This field is required'));
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.value)) throw new Error(t('დრო უნდა იყოს HH:mm', 'Time must be HH:mm'));
      const addressText = addr.value.trim();
      const body = {
        doctorType: typeSel.value,
        doctorFirstName: first.value.trim() || undefined,
        doctorLastName: last.value.trim() || undefined,
        visitDate: date.value,
        visitTime: time.value,
        address: addressText || undefined,
        addressLabel: geo?.label ?? (addressText || undefined),
        lat: geo?.lat,
        lng: geo?.lng,
        notes: notes.value.trim() || undefined,
        reminderConfig: { enabled: remindersOn, offsetsMinutes: offsets.length ? offsets : [60], repeatCount },
      };
      const res = visit ? await patch(`/api/visits/${visit.id}`, body) : await post('/api/visits', body);
      invalidate('/api/visits');
      toast(visit ? t('ვიზიტი განახლდა', 'Visit updated') : t('ვიზიტი დაემატა', 'Visit added'));
      close();
      onSaved?.(res.visit);
    },
  });
}

/** formModal with a Node body built by us (so our controls keep their listeners). */
function formModal2({ title, fields, submit, onSubmit }) {
  const err = h('div', { class: 'form-error', hidden: true });
  let form;
  let submitBtn;
  openModal({
    title,
    size: 'md',
    body: (close) => {
      form = h('form', { class: 'form', novalidate: true, onSubmit: async (e) => {
        e.preventDefault();
        err.hidden = true;
        await busy(submitBtn, async () => {
          try { await onSubmit(null, close); } catch (e2) { err.textContent = e2?.message || t('ვერ შეინახა.', 'Couldn’t save.'); err.hidden = false; err.scrollIntoView({ block: 'nearest' }); }
        });
      } }, fields(), err, h('button', { type: 'submit', hidden: true }));
      return form;
    },
    footer: (close) => {
      submitBtn = button(submit, { onClick: () => form.requestSubmit() });
      return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), submitBtn];
    },
  });
}

/* ── Detail modal ─────────────────────────────────────── */
function openDetail(v, { onEdit, onDelete }) {
  const past = isPast(v);
  const rem = normReminders(v.reminderConfig);
  const map = mapsUrl(v);
  const rows = [
    ['calendar', t('თარიღი', 'Date'), `${longDate(v.visitDate)} · ${v.visitTime}`],
    ['stethoscope', t('სპეციალობა', 'Specialty'), typeLabel(v.doctorType)],
    ['mapPin', t('მისამართი', 'Address'), place(v) || t('მისამართი არ არის მითითებული', 'No address added')],
    ['bellRing', t('შეხსენებები', 'Reminders'), rem.enabled
      ? `${REMINDER_PRESETS.filter(([m]) => rem.offsetsMinutes.includes(m)).map(([, l]) => l).join(', ') || rem.offsetsMinutes.map((m) => t(`${m} წთ-ით ადრე`, `${m} min before`)).join(', ')} · ${t(`${rem.repeatCount}-ჯერ`, rem.repeatCount === 1 ? 'once' : rem.repeatCount === 2 ? 'twice' : `${rem.repeatCount} times`)}`
      : t('გამორთულია', 'Off')],
  ];
  openModal({
    title: doctorName(v),
    size: 'md',
    body: h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'hstack' }, badge(past ? t('წარსული', 'Past') : t('მომავალი', 'Upcoming'), past ? 'neutral' : 'brand'), !past ? h('span', { class: 'faint', style: { fontSize: '13px' } }, countdown(v)) : null),
      h('div', { class: 'list' }, rows.map(([ic, label, value]) => h('div', { class: 'row' }, tile(ic, 'teal', 36),
        h('div', { class: 'row-main' }, h('div', { class: 'row-sub', style: { marginTop: 0 } }, label), h('div', { class: 'row-title', style: { fontWeight: 500 } }, value))))),
      v.notes ? h('div', { class: 'vis-note' }, h('div', { class: 'field-label', style: { marginBottom: '4px' } }, t('შენიშვნა', 'Note')), v.notes) : null,
      map ? h('a', { class: 'link', href: map, target: '_blank', rel: 'noopener' }, t('რუკაში გახსნა', 'Open in Maps'), icon('externalLink', { size: 14 })) : null),
    footer: (close) => [
      button(t('წაშლა', 'Delete'), { variant: 'ghost', icon: 'trash', onClick: () => { close(); onDelete(v); } }),
      button(t('რედაქტირება', 'Edit'), { icon: 'edit', onClick: () => { close(); onEdit(v); } }),
    ],
  });
}

/* ── Page ─────────────────────────────────────────────── */
export default async function visitsPage(root, ctx) {
  ensureCss();
  const state = { visits: [], month: null, selected: null, tab: 'upcoming' };
  const addBtn = button(t('ახალი ვიზიტი', 'New visit'), { icon: 'plus', onClick: () => openEditor(null, { onSaved: () => reload(), presetDate: state.selected && state.selected >= ymd() ? state.selected : undefined }) });
  const body = h('div');
  mount(root, pageHead(t('ვიზიტები', 'Doctor visits'), t('ექიმთან ვიზიტების დაგეგმვა, კალენდარი და შეხსენებები', 'Plan doctor visits, with a calendar and reminders'), addBtn), body);
  mount(body, h('div', { class: 'stack', style: { gap: '16px' } }, h('div', { class: 'stats-row' }, [0, 1, 2, 3].map(() => skeleton(2))), h('div', { class: 'vis-layout' }, skeleton(8), skeleton(6))));

  const reload = async () => {
    try {
      invalidate('/api/visits');
      const { visits } = await get('/api/visits');
      state.visits = (visits || []).slice().sort((a, b) => visitAt(a) - visitAt(b));
      render();
    } catch (e) {
      mount(body, errorBox(e, () => reload()));
    }
  };

  const remove = async (v) => {
    const ok = await confirmDialog({ title: t('ვიზიტის წაშლა', 'Delete visit'), body: t(`ნამდვილად გინდა ვიზიტის წაშლა? ${doctorName(v)} · ${fmtDate(v.visitDate)} ${v.visitTime}`, `Delete this visit? ${doctorName(v)} · ${fmtDate(v.visitDate)} ${v.visitTime}`), confirm: t('წაშლა', 'Delete'), danger: true });
    if (!ok) return;
    try {
      await del(`/api/visits/${v.id}`);
      state.visits = state.visits.filter((x) => x.id !== v.id);
      toast(t('ვიზიტი წაიშალა', 'Visit deleted'));
      render();
    } catch (e) { toast(e.message, 'error'); }
  };
  const edit = (v) => openEditor(v, { onSaved: () => reload() });
  const show = (v) => openDetail(v, { onEdit: edit, onDelete: remove });

  const render = () => {
    const { visits } = state;
    if (!visits.length) {
      mount(body, card({ class: 'pad-lg' }, empty(t('ვიზიტები ჯერ არ გაქვს დაგეგმილი', 'No visits planned yet'), t('დაამატე ექიმთან ვიზიტი — თარიღი, დრო, მისამართი და შეხსენებები.', 'Add a doctor visit — date, time, address and reminders.'),
        button(t('ახალი ვიზიტი', 'New visit'), { icon: 'plus', size: 'lg', onClick: () => openEditor(null, { onSaved: () => reload() }) }))),
      h('p', { class: 'disclaimer' }, icon('info', { size: 15 }), DISCLAIMER));
      return;
    }
    const upcoming = visits.filter((v) => !isPast(v));
    const past = visits.filter(isPast).reverse();
    const next = upcoming[0];
    const today = new Date();
    const monthKey = ymd(today).slice(0, 7);
    const thisMonth = visits.filter((v) => v.visitDate.startsWith(monthKey)).length;
    const yearAgo = ymd(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()));
    const lastYear = past.filter((v) => v.visitDate >= yearAgo).length;
    if (!state.month) state.month = next ? next.visitDate.slice(0, 7) : monthKey;

    const stats = h('div', { class: 'stats-row' },
      statCard('calendarCheck', 'teal', t('მომავალი', 'Upcoming'), String(upcoming.length), upcoming.length ? t(`შემდეგი ${relDay(next.visitDate)}`, `Next ${relDay(next.visitDate)}`) : t('დაგეგმილი არ არის', 'Nothing planned')),
      statCard('calendar', 'blue', t('ამ თვეში', 'This month'), String(thisMonth), KA_MONTHS[today.getMonth()]),
      statCard('clock', 'violet', t('ბოლო 12 თვეში', 'Last 12 months'), String(lastYear), t('ჩატარებული ვიზიტი', 'Visits done')),
      statCard('stethoscope', 'amber', t('სპეციალისტები', 'Specialists'), String(new Set(visits.map((v) => v.doctorType)).size), t('სხვადასხვა სპეციალობა', 'Different specialties')));

    const hero = next ? card({ class: 'spotlight hero-card pad-lg vis-hero' },
      h('div', { class: 'vis-hero-top' },
        h('div', { class: 'hstack', style: { gap: '12px', flexWrap: 'nowrap', minWidth: 0 } }, tile('stethoscope', 'teal', 48),
          h('div', { style: { minWidth: 0 } },
            h('div', { class: 'muted', style: { fontSize: '13px' } }, t('შემდეგი ვიზიტი', 'Next visit')),
            h('h2', { class: 'vis-hero-name' }, doctorName(next)),
            h('div', { class: 'muted', style: { fontSize: '14px' } }, typeLabel(next.doctorType)))),
        h('div', { class: 'vis-count' }, h('strong', null, countdown(next)))),
      h('div', { class: 'vis-hero-meta' },
        h('span', null, icon('calendar', { size: 16 }), `${longDate(next.visitDate)} · ${next.visitTime}`),
        place(next) ? h('span', null, icon('mapPin', { size: 16 }), place(next)) : null),
      h('div', { class: 'hstack', style: { marginTop: '18px' } },
        button(t('დეტალები', 'Details'), { variant: 'light', size: 'sm', onClick: () => show(next) }),
        mapsUrl(next) ? h('a', { class: 'btn btn-sm vis-ghost-light', href: mapsUrl(next), target: '_blank', rel: 'noopener' }, icon('mapPin', { size: 16 }), h('span', null, t('რუკაში გახსნა', 'Open in Maps'))) : null)) : null;

    const calHost = h('div');
    const listHost = h('div');
    mount(body,
      h('div', { class: 'stack', style: { gap: '16px', marginBottom: '28px' } }, stats, hero),
      h('div', { class: 'vis-layout' },
        h('div', null, section(t('კალენდარი', 'Calendar'), calHost)),
        h('div', null, section(t('ვიზიტები', 'Doctor visits'), listHost, { action: segmented([{ value: 'upcoming', label: t(`მომავალი · ${upcoming.length}`, `Upcoming · ${upcoming.length}`) }, { value: 'past', label: t(`წარსული · ${past.length}`, `Past · ${past.length}`) }], state.tab, (tab) => { state.tab = tab; paintList(); }) }))),
      h('div', { class: 'vis-app card' }, tile('smartphone', 'neutral', 38),
        h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, t('შეხსენებები ტელეფონზე', 'Reminders on your phone')),
          h('div', { class: 'card-sub' }, t('ვიზიტის შეხსენებებს MEDICARD აპი გამოგიგზავნის — ამისთვის გამოიყენე MEDICARD აპი.', 'The MEDICARD app sends visit reminders — use the MEDICARD app for them.'))),
        h('a', { class: 'link', href: APP_STORE, target: '_blank', rel: 'noopener' }, 'App Store', icon('externalLink', { size: 14 }))),
      h('p', { class: 'disclaimer' }, icon('info', { size: 15 }), DISCLAIMER));

    const paintCal = () => {
      const [y, m] = state.month.split('-').map(Number);
      const firstDay = new Date(y, m - 1, 1);
      const lead = MON_FIRST.indexOf(firstDay.getDay());
      const start = new Date(y, m - 1, 1 - lead);
      const byDay = new Map();
      for (const v of visits) { const l = byDay.get(v.visitDate) || []; l.push(v); byDay.set(v.visitDate, l); }
      const todayKey = ymd();
      const cells = [];
      const daysInMonth = new Date(y, m, 0).getDate();
      const total = Math.ceil((lead + daysInMonth) / 7) * 7;
      for (let i = 0; i < total; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const key = ymd(d);
        const list = byDay.get(key) || [];
        const out = d.getMonth() !== m - 1;
        cells.push(h('button', {
          type: 'button',
          class: `cal-d vis-d ${out ? 'out' : ''} ${key === todayKey ? 'today' : ''} ${state.selected === key ? 'sel' : ''} ${list.length ? 'has' : ''}`,
          'aria-label': `${fmtDate(d, { year: true })}${list.length ? t(` · ${list.length} ვიზიტი`, ` · ${list.length} ${list.length === 1 ? 'visit' : 'visits'}`) : ''}`,
          'aria-pressed': state.selected === key ? 'true' : 'false',
          onClick: () => { state.selected = state.selected === key ? null : key; if (out) state.month = key.slice(0, 7); paintCal(); },
        }, String(d.getDate()), list.length ? h('span', { class: 'vis-dots' }, list.slice(0, 3).map((v) => h('i', { class: isPast(v) ? 'past' : '' }))) : null));
      }
      const selList = state.selected ? (byDay.get(state.selected) || []) : [];
      const monthVisits = visits.filter((v) => v.visitDate.startsWith(state.month)).length;
      mount(calHost, card({ class: 'vis-cal-card' },
        h('div', { class: 'between', style: { marginBottom: '14px' } },
          iconButton('chevronLeft', { title: t('წინა თვე', 'Previous month'), onClick: () => { state.month = shiftMonth(state.month, -1); paintCal(); } }),
          h('div', { style: { textAlign: 'center' } }, h('div', { class: 'card-title' }, `${KA_MONTHS[m - 1]} ${y}`), h('div', { class: 'card-sub' }, monthVisits ? t(`${monthVisits} ვიზიტი`, `${monthVisits} ${monthVisits === 1 ? 'visit' : 'visits'}`) : t('ვიზიტი არ არის', 'No visits'))),
          iconButton('chevronRight', { title: t('შემდეგი თვე', 'Next month'), onClick: () => { state.month = shiftMonth(state.month, 1); paintCal(); } })),
        h('div', { class: 'cal' }, DAY_SHORT.slice(1).concat(DAY_SHORT[0]).map((d) => h('div', { class: 'cal-h' }, d)), cells),
        h('div', { class: 'between vis-cal-foot' },
          h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--brand)', borderRadius: '50%' } }), t('მომავალი', 'Upcoming')), h('span', null, h('i', { style: { background: 'var(--text3)', borderRadius: '50%' } }), t('წარსული', 'Past'))),
          state.month !== monthKey ? button(t('დღეს', 'Today'), { variant: 'ghost', size: 'sm', onClick: () => { state.month = monthKey; state.selected = null; paintCal(); } }) : null),
        state.selected ? h('div', { class: 'vis-day' },
          h('div', { class: 'between' }, h('div', { class: 'card-title' }, longDate(state.selected)),
            state.selected >= todayKey ? button(t('დამატება', 'Add'), { variant: 'secondary', size: 'sm', icon: 'plus', onClick: () => openEditor(null, { onSaved: () => reload(), presetDate: state.selected }) }) : null),
          selList.length ? h('div', { class: 'list' }, selList.map((v) => visitRow(v, show, remove))) : h('p', { class: 'faint', style: { fontSize: '13.5px', marginTop: '6px' } }, t('ამ დღეს ვიზიტი არ არის.', 'No visits on this day.'))) : null));
    };

    const paintList = () => {
      const list = state.tab === 'past' ? past : upcoming;
      if (!list.length) {
        mount(listHost, card(empty(state.tab === 'past' ? t('წარსული ვიზიტი ჯერ არ არის', 'No past visits yet') : t('მომავალი ვიზიტი არ არის', 'No upcoming visits'), state.tab === 'past' ? null : t('დაგეგმე შემდეგი ვიზიტი და შეხსენებას ტელეფონზე მიიღებ.', 'Plan your next visit and get a reminder on your phone.'),
          state.tab === 'past' ? null : button(t('ახალი ვიზიტი', 'New visit'), { icon: 'plus', variant: 'secondary', onClick: () => openEditor(null, { onSaved: () => reload() }) }))));
        return;
      }
      // Group by month for a calm, scannable list.
      const groups = new Map();
      for (const v of list) { const k = v.visitDate.slice(0, 7); groups.set(k, [...(groups.get(k) || []), v]); }
      mount(listHost, h('div', { class: 'stack', style: { gap: '14px' } }, [...groups.entries()].map(([k, vs]) => {
        const [yy, mm] = k.split('-').map(Number);
        return h('div', null,
          h('div', { class: 'vis-month' }, `${KA_MONTHS[mm - 1]}${yy !== today.getFullYear() ? ` ${yy}` : ''}`),
          card({ class: 'flush' }, h('div', { class: 'list vis-list' }, vs.map((v) => visitRow(v, show, remove)))));
      })));
    };

    paintCal();
    paintList();
  };

  await reload();
  return () => {};
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function visitRow(v, onOpen, onDelete) {
  const past = isPast(v);
  const d = parseDate(v.visitDate);
  const named = [v.doctorFirstName, v.doctorLastName].filter(Boolean).length > 0;
  return h('div', { class: `vis-row ${past ? 'past' : ''}` },
    h('button', { type: 'button', class: 'vis-row-main', onClick: () => onOpen(v) },
      h('div', { class: 'vis-date' }, h('strong', null, String(d.getDate())), h('span', null, KA_MONTHS_SHORT[d.getMonth()])),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, doctorName(v)),
        h('div', { class: 'row-sub' }, [named ? typeLabel(v.doctorType) : null, v.visitTime].filter(Boolean).join(' · ')),
        place(v) ? h('div', { class: 'vis-place' }, icon('mapPin', { size: 13 }), h('span', null, place(v))) : null,
        v.notes ? h('div', { class: 'vis-notes' }, v.notes) : null),
      !past ? badge(countdown(v), 'brand') : null),
    iconButton('trash', { title: t('წაშლა', 'Delete'), size: 17, class: 'vis-del', onClick: () => onDelete(v) }));
}

function statCard(ic, ink, label, value, sub) {
  return card({ class: 'kpi' },
    h('div', { class: 'hstack', style: { gap: '10px' } }, tile(ic, ink, 34), h('span', { class: 'stat-label' }, label)),
    h('div', { class: 'stat-value' }, value),
    sub ? h('div', { class: 'stat-delta' }, sub) : null);
}

