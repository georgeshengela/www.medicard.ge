// MEDICARD web — „ვიზიტები“ (/visits). Mirrors mobile/app/visits/** (VisitCard, VisitEditorScreen) and
// server/src/routes/visits.routes.js. Reminders themselves are local notifications on the phone; the web
// edits the same reminderConfig the app schedules from.
import {
  h, mount, icon, tile, pageHead, section, card, button, iconButton, busy, badge, empty, skeleton,
  errorBox, segmented, field, textarea, input, select, toggle, toast, openModal, confirmDialog,
  fmtDate, relDay, ymd, parseDate, KA_MONTHS, KA_MONTHS_SHORT, KA_DAYS, debounce,
} from '../ui.js';
import { get, post, patch, del, invalidate } from '../api.js';

const CSS = '/app/css/visits.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

const APP_STORE = 'https://apps.apple.com/app/id6812517519';
const DISCLAIMER = 'ეს არ არის დიაგნოზი — საჭიროებისას ექიმს მიმართე.';
const DOCTOR_TYPES = [
  ['GP', 'ოჯახის ექიმი'], ['DENTIST', 'სტომატოლოგი'], ['CARDIO', 'კარდიოლოგი'], ['GYN', 'გინეკოლოგი'],
  ['NEURO', 'ნეუროლოგი'], ['ORTHO', 'ორთოპედი'], ['THERAPIST', 'თერაპევტი'], ['OPHTHALMO', 'ოფთალმოლოგი'],
  ['DERM', 'დერმატოლოგი'], ['PED', 'პედიატრი'], ['OTHER', 'სხვა სპეციალისტი'],
];
const typeLabel = (code) => DOCTOR_TYPES.find(([c]) => c === code)?.[1] || code;
const REMINDER_PRESETS = [
  [10080, '1 კვირით ადრე'], [1440, '1 დღით ადრე'], [180, '3 საათით ადრე'], [60, '1 საათით ადრე'], [30, '30 წთ-ით ადრე'],
];
const POPULAR_TIMES = ['09:00', '10:00', '11:00', '14:00', '16:00', '18:00'];
const DEFAULT_REMINDERS = { enabled: true, offsetsMinutes: [1440, 60], repeatCount: 1 };
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ['კვ', 'ორ', 'სმ', 'ოთ', 'ხთ', 'პრ', 'შბ'];

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
    if (mins <= 0) return 'ახლა';
    return mins < 60 ? `${mins} წუთში` : `${Math.floor(mins / 60)} საათში`;
  }
  if (days === 1) return 'ხვალ';
  return `${days} დღეში`;
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

  const typeSel = select(DOCTOR_TYPES.map(([value, label]) => ({ value, label })), v.doctorType || 'GP', { name: 'doctorType', 'aria-label': 'ექიმის სპეციალობა' });
  const first = input({ name: 'doctorFirstName', placeholder: 'მაგ. ნინო', maxlength: 80, value: v.doctorFirstName || '', autocomplete: 'off' });
  const last = input({ name: 'doctorLastName', placeholder: 'მაგ. ბერიძე', maxlength: 80, value: v.doctorLastName || '', autocomplete: 'off' });
  const date = input({ name: 'visitDate', type: 'date', required: true, value: v.visitDate || presetDate || ymd() });
  const time = input({ name: 'visitTime', type: 'time', required: true, step: 300, value: v.visitTime || '10:00' });
  const timeChips = h('div', { class: 'chips vis-times' });
  const paintTimes = () => mount(timeChips, POPULAR_TIMES.map((t) => h('button', { type: 'button', class: `chip ${time.value === t ? 'on' : ''}`, onClick: () => { time.value = t; paintTimes(); } }, t)));
  time.addEventListener('input', paintTimes);
  paintTimes();

  // Address: live OpenStreetMap search through our /api/visits/geocode proxy.
  const addr = input({ name: 'address', placeholder: 'მაგ. ვაჟა-ფშაველას 29, თბილისი', maxlength: 300, value: place(v), autocomplete: 'off', role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
  const addrHint = h('span', { class: 'field-hint' }, geo ? 'მისამართი არჩეულია · რუკაზე ნახავ' : 'OpenStreetMap · ცოცხალი ძებნა');
  const results = h('div', { class: 'vis-geo', role: 'listbox', hidden: true });
  let seq = 0;
  const closeResults = () => { results.hidden = true; addr.setAttribute('aria-expanded', 'false'); };
  const search = debounce(async () => {
    const q = addr.value.trim();
    const my = ++seq;
    if (q.length < 3) { closeResults(); return; }
    mount(results, h('div', { class: 'vis-geo-note' }, 'მისამართების ძებნა…'));
    results.hidden = false;
    try {
      const { results: rows } = await get('/api/visits/geocode', { q });
      if (my !== seq) return;
      mount(results, rows?.length ? rows.map((r) => h('button', { type: 'button', role: 'option', class: 'vis-geo-row', onClick: () => {
        geo = { label: String(r.label).slice(0, 400), lat: r.lat, lng: r.lng };
        addr.value = String(r.label).slice(0, 300);
        addrHint.textContent = 'მისამართი არჩეულია · რუკაზე ნახავ';
        closeResults();
      } }, icon('mapPin', { size: 16 }), h('span', null, r.label))) : h('div', { class: 'vis-geo-note' }, 'შედეგი ვერ მოიძებნა — სცადე სხვა ფორმატი'));
      addr.setAttribute('aria-expanded', 'true');
    } catch {
      if (my === seq) mount(results, h('div', { class: 'vis-geo-note' }, 'ძებნა ვერ მოხერხდა. შეამოწმე ინტერნეტი და ხელახლა სცადე.'));
    }
  }, 450);
  addr.addEventListener('input', () => { geo = null; addrHint.textContent = 'OpenStreetMap · ცოცხალი ძებნა'; search(); });
  addr.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !results.hidden) { e.stopPropagation(); closeResults(); } });

  const notes = textarea({ name: 'notes', placeholder: 'მაგ. საჭიროა ანალიზების ფოტო', maxlength: 500, rows: 3, value: v.notes || '' });

  const remBody = h('div', { class: 'stack', style: { gap: '12px' } });
  const paintRem = () => {
    remBody.hidden = !remindersOn;
    mount(remBody,
      h('span', { class: 'field-hint' }, 'როდის გინდა შეხსენება'),
      h('div', { class: 'chips' }, REMINDER_PRESETS.map(([m, label]) => h('button', {
        type: 'button', class: `chip ${offsets.includes(m) ? 'on' : ''}`, role: 'checkbox', 'aria-checked': offsets.includes(m) ? 'true' : 'false',
        onClick: () => { offsets = offsets.includes(m) ? offsets.filter((x) => x !== m) : [...offsets, m].sort((a, b) => b - a); paintRem(); },
      }, label))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'რამდენჯერ'),
        segmented([{ value: 1, label: '1-ჯერ' }, { value: 2, label: '2-ჯერ' }, { value: 3, label: '3-ჯერ' }], repeatCount, (n) => { repeatCount = n; }),
        h('span', { class: 'field-hint' }, 'დამატებითი შეხსენება ვიზიტამდე 15 წთ-ით')));
  };
  paintRem();

  const fields = () => h('div', { class: 'stack', style: { gap: '18px' } },
    h('div', { class: 'vis-step' }, h('div', { class: 'vis-step-h' }, tile('stethoscope', 'teal', 30), h('span', null, 'ექიმი')),
      field('ექიმის სპეციალობა', typeSel),
      h('div', { class: 'form-row' }, field('ექიმის სახელი (არასავალდებულო)', first), field('ექიმის გვარი (არასავალდებულო)', last))),
    h('div', { class: 'vis-step' }, h('div', { class: 'vis-step-h' }, tile('calendar', 'blue', 30), h('span', null, 'როდის')),
      h('div', { class: 'form-row' }, field('ვიზიტის თარიღი', date), field('დრო', time)),
      h('div', { class: 'field' }, h('span', { class: 'field-hint' }, 'პოპულარული დროები'), timeChips)),
    h('div', { class: 'vis-step' }, h('div', { class: 'vis-step-h' }, tile('mapPin', 'violet', 30), h('span', null, 'სად')),
      h('div', { class: 'field vis-addr' }, h('span', { class: 'field-label' }, 'კლინიკის მისამართი'), addr, results, addrHint)),
    h('div', { class: 'vis-step' }, h('div', { class: 'vis-step-h' }, tile('bellRing', 'amber', 30), h('span', null, 'დეტალები')),
      field('შენიშვნა', notes),
      h('div', { class: 'between' }, h('span', { class: 'field-label' }, 'შეხსენებები'), toggle(remindersOn, (on) => { remindersOn = on; paintRem(); })),
      remBody,
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, 'შეხსენებებს MEDICARD აპი გამოგიგზავნის ტელეფონზე.')));

  formModal2({
    title: visit ? 'ვიზიტის რედაქტირება' : 'ახალი ვიზიტი',
    submit: 'ვიზიტის შენახვა',
    fields,
    onSubmit: async (_vals, close) => {
      if (!date.value || !time.value) throw new Error('ველის შევსება სავალდებულოა');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.value)) throw new Error('დრო უნდა იყოს HH:mm');
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
      toast(visit ? 'ვიზიტი განახლდა' : 'ვიზიტი დაემატა');
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
          try { await onSubmit(null, close); } catch (e2) { err.textContent = e2?.message || 'ვერ შეინახა.'; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); }
        });
      } }, fields(), err, h('button', { type: 'submit', hidden: true }));
      return form;
    },
    footer: (close) => {
      submitBtn = button(submit, { onClick: () => form.requestSubmit() });
      return [button('გაუქმება', { variant: 'ghost', onClick: () => close() }), submitBtn];
    },
  });
}

/* ── Detail modal ─────────────────────────────────────── */
function openDetail(v, { onEdit, onDelete }) {
  const past = isPast(v);
  const rem = normReminders(v.reminderConfig);
  const map = mapsUrl(v);
  const rows = [
    ['calendar', 'თარიღი', `${longDate(v.visitDate)} · ${v.visitTime}`],
    ['stethoscope', 'სპეციალობა', typeLabel(v.doctorType)],
    ['mapPin', 'მისამართი', place(v) || 'მისამართი არ არის მითითებული'],
    ['bellRing', 'შეხსენებები', rem.enabled
      ? `${REMINDER_PRESETS.filter(([m]) => rem.offsetsMinutes.includes(m)).map(([, l]) => l).join(', ') || rem.offsetsMinutes.map((m) => `${m} წთ-ით ადრე`).join(', ')} · ${rem.repeatCount}-ჯერ`
      : 'გამორთულია'],
  ];
  openModal({
    title: doctorName(v),
    size: 'md',
    body: h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'hstack' }, badge(past ? 'წარსული' : 'მომავალი', past ? 'neutral' : 'brand'), !past ? h('span', { class: 'faint', style: { fontSize: '13px' } }, countdown(v)) : null),
      h('div', { class: 'list' }, rows.map(([ic, label, value]) => h('div', { class: 'row' }, tile(ic, 'teal', 36),
        h('div', { class: 'row-main' }, h('div', { class: 'row-sub', style: { marginTop: 0 } }, label), h('div', { class: 'row-title', style: { fontWeight: 500 } }, value))))),
      v.notes ? h('div', { class: 'vis-note' }, h('div', { class: 'field-label', style: { marginBottom: '4px' } }, 'შენიშვნა'), v.notes) : null,
      map ? h('a', { class: 'link', href: map, target: '_blank', rel: 'noopener' }, 'რუკაში გახსნა', icon('externalLink', { size: 14 })) : null),
    footer: (close) => [
      button('წაშლა', { variant: 'ghost', icon: 'trash', onClick: () => { close(); onDelete(v); } }),
      button('რედაქტირება', { icon: 'edit', onClick: () => { close(); onEdit(v); } }),
    ],
  });
}

/* ── Page ─────────────────────────────────────────────── */
export default async function visitsPage(root, ctx) {
  ensureCss();
  const state = { visits: [], month: null, selected: null, tab: 'upcoming' };
  const addBtn = button('ახალი ვიზიტი', { icon: 'plus', onClick: () => openEditor(null, { onSaved: () => reload(), presetDate: state.selected && state.selected >= ymd() ? state.selected : undefined }) });
  const body = h('div');
  mount(root, pageHead('ვიზიტები', 'ექიმთან ვიზიტების დაგეგმვა, კალენდარი და შეხსენებები', addBtn), body);
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
    const ok = await confirmDialog({ title: 'ვიზიტის წაშლა', body: `ნამდვილად გინდა ვიზიტის წაშლა? ${doctorName(v)} · ${fmtDate(v.visitDate)} ${v.visitTime}`, confirm: 'წაშლა', danger: true });
    if (!ok) return;
    try {
      await del(`/api/visits/${v.id}`);
      state.visits = state.visits.filter((x) => x.id !== v.id);
      toast('ვიზიტი წაიშალა');
      render();
    } catch (e) { toast(e.message, 'error'); }
  };
  const edit = (v) => openEditor(v, { onSaved: () => reload() });
  const show = (v) => openDetail(v, { onEdit: edit, onDelete: remove });

  const render = () => {
    const { visits } = state;
    if (!visits.length) {
      mount(body, card({ class: 'pad-lg' }, empty('ვიზიტები ჯერ არ გაქვს დაგეგმილი', 'დაამატე ექიმთან ვიზიტი — თარიღი, დრო, მისამართი და შეხსენებები.',
        button('ახალი ვიზიტი', { icon: 'plus', size: 'lg', onClick: () => openEditor(null, { onSaved: () => reload() }) }))),
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
      statCard('calendarCheck', 'teal', 'მომავალი', String(upcoming.length), upcoming.length ? `შემდეგი ${relDay(next.visitDate)}` : 'დაგეგმილი არ არის'),
      statCard('calendar', 'blue', 'ამ თვეში', String(thisMonth), KA_MONTHS[today.getMonth()]),
      statCard('clock', 'violet', 'ბოლო 12 თვეში', String(lastYear), 'ჩატარებული ვიზიტი'),
      statCard('stethoscope', 'amber', 'სპეციალისტები', String(new Set(visits.map((v) => v.doctorType)).size), 'სხვადასხვა სპეციალობა'));

    const hero = next ? card({ class: 'spotlight hero-card pad-lg vis-hero' },
      h('div', { class: 'vis-hero-top' },
        h('div', { class: 'hstack', style: { gap: '12px', flexWrap: 'nowrap', minWidth: 0 } }, tile('stethoscope', 'teal', 48),
          h('div', { style: { minWidth: 0 } },
            h('div', { class: 'muted', style: { fontSize: '13px' } }, 'შემდეგი ვიზიტი'),
            h('h2', { class: 'vis-hero-name' }, doctorName(next)),
            h('div', { class: 'muted', style: { fontSize: '14px' } }, typeLabel(next.doctorType)))),
        h('div', { class: 'vis-count' }, h('strong', null, countdown(next)))),
      h('div', { class: 'vis-hero-meta' },
        h('span', null, icon('calendar', { size: 16 }), `${longDate(next.visitDate)} · ${next.visitTime}`),
        place(next) ? h('span', null, icon('mapPin', { size: 16 }), place(next)) : null),
      h('div', { class: 'hstack', style: { marginTop: '18px' } },
        button('დეტალები', { variant: 'light', size: 'sm', onClick: () => show(next) }),
        mapsUrl(next) ? h('a', { class: 'btn btn-sm vis-ghost-light', href: mapsUrl(next), target: '_blank', rel: 'noopener' }, icon('mapPin', { size: 16 }), h('span', null, 'რუკაში გახსნა')) : null)) : null;

    const calHost = h('div');
    const listHost = h('div');
    mount(body,
      h('div', { class: 'stack', style: { gap: '16px', marginBottom: '28px' } }, stats, hero),
      h('div', { class: 'vis-layout' },
        h('div', null, section('კალენდარი', calHost)),
        h('div', null, section('ვიზიტები', listHost, { action: segmented([{ value: 'upcoming', label: `მომავალი · ${upcoming.length}` }, { value: 'past', label: `წარსული · ${past.length}` }], state.tab, (t) => { state.tab = t; paintList(); }) }))),
      h('div', { class: 'vis-app card' }, tile('smartphone', 'neutral', 38),
        h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, 'შეხსენებები ტელეფონზე'),
          h('div', { class: 'card-sub' }, 'ვიზიტის შეხსენებებს MEDICARD აპი გამოგიგზავნის — ამისთვის გამოიყენე MEDICARD აპი.')),
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
          'aria-label': `${fmtDate(d, { year: true })}${list.length ? ` · ${list.length} ვიზიტი` : ''}`,
          'aria-pressed': state.selected === key ? 'true' : 'false',
          onClick: () => { state.selected = state.selected === key ? null : key; if (out) state.month = key.slice(0, 7); paintCal(); },
        }, String(d.getDate()), list.length ? h('span', { class: 'vis-dots' }, list.slice(0, 3).map((v) => h('i', { class: isPast(v) ? 'past' : '' }))) : null));
      }
      const selList = state.selected ? (byDay.get(state.selected) || []) : [];
      const monthVisits = visits.filter((v) => v.visitDate.startsWith(state.month)).length;
      mount(calHost, card({ class: 'vis-cal-card' },
        h('div', { class: 'between', style: { marginBottom: '14px' } },
          iconButton('chevronLeft', { title: 'წინა თვე', onClick: () => { state.month = shiftMonth(state.month, -1); paintCal(); } }),
          h('div', { style: { textAlign: 'center' } }, h('div', { class: 'card-title' }, `${KA_MONTHS[m - 1]} ${y}`), h('div', { class: 'card-sub' }, monthVisits ? `${monthVisits} ვიზიტი` : 'ვიზიტი არ არის')),
          iconButton('chevronRight', { title: 'შემდეგი თვე', onClick: () => { state.month = shiftMonth(state.month, 1); paintCal(); } })),
        h('div', { class: 'cal' }, DAY_SHORT.slice(1).concat(DAY_SHORT[0]).map((d) => h('div', { class: 'cal-h' }, d)), cells),
        h('div', { class: 'between vis-cal-foot' },
          h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--brand)', borderRadius: '50%' } }), 'მომავალი'), h('span', null, h('i', { style: { background: 'var(--text3)', borderRadius: '50%' } }), 'წარსული')),
          state.month !== monthKey ? button('დღეს', { variant: 'ghost', size: 'sm', onClick: () => { state.month = monthKey; state.selected = null; paintCal(); } }) : null),
        state.selected ? h('div', { class: 'vis-day' },
          h('div', { class: 'between' }, h('div', { class: 'card-title' }, longDate(state.selected)),
            state.selected >= todayKey ? button('დამატება', { variant: 'secondary', size: 'sm', icon: 'plus', onClick: () => openEditor(null, { onSaved: () => reload(), presetDate: state.selected }) }) : null),
          selList.length ? h('div', { class: 'list' }, selList.map((v) => visitRow(v, show, remove))) : h('p', { class: 'faint', style: { fontSize: '13.5px', marginTop: '6px' } }, 'ამ დღეს ვიზიტი არ არის.')) : null));
    };

    const paintList = () => {
      const list = state.tab === 'past' ? past : upcoming;
      if (!list.length) {
        mount(listHost, card(empty(state.tab === 'past' ? 'წარსული ვიზიტი ჯერ არ არის' : 'მომავალი ვიზიტი არ არის', state.tab === 'past' ? null : 'დაგეგმე შემდეგი ვიზიტი და შეხსენებას ტელეფონზე მიიღებ.',
          state.tab === 'past' ? null : button('ახალი ვიზიტი', { icon: 'plus', variant: 'secondary', onClick: () => openEditor(null, { onSaved: () => reload() }) }))));
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
    iconButton('trash', { title: 'წაშლა', size: 17, class: 'vis-del', onClick: () => onDelete(v) }));
}

function statCard(ic, ink, label, value, sub) {
  return card({ class: 'kpi' },
    h('div', { class: 'hstack', style: { gap: '10px' } }, tile(ic, ink, 34), h('span', { class: 'stat-label' }, label)),
    h('div', { class: 'stat-value' }, value),
    sub ? h('div', { class: 'stat-delta' }, sub) : null);
}

