// MEDIBOOK business panel — the date and time fields: a month calendar popover and a 15-minute time grid,
// in Tbilisi time, keyboard-friendly, instead of the browser's own <input type=date|time>.
import { h, icon } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { ymd, addDays, weekdayOf, MONTHS, WEEKDAYS_SHORT, MONTHS_SHORT } from './shared.js';

let openPop = null;
function closeOpen() { openPop?.(); openPop = null; }
document.addEventListener('click', (e) => { if (openPop && !e.target.closest?.('.bz-field, .bz-pop')) closeOpen(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openPop) { e.stopPropagation(); closeOpen(); } }, true);
// A scroll anywhere (the modal body, the drawer, the page) moves the button away from a fixed popover — close it.
document.addEventListener('scroll', (e) => { if (openPop && !e.target?.closest?.('.bz-pop')) closeOpen(); }, true);
window.addEventListener('resize', () => closeOpen());

/** The popover is fixed to the viewport and appended to <body>, so a modal or drawer with overflow never clips it. */
function popover(field, button, cls, width) {
  closeOpen();
  const pop = h('div', { class: `bz-pop ${cls}`, role: 'dialog' });
  document.body.appendChild(pop);
  const place = () => {
    const r = button.getBoundingClientRect();
    const w = width || pop.offsetWidth || 300;
    const hgt = pop.offsetHeight || 320;
    let left = r.left;
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - w);
    let top = r.bottom + 6;
    if (top + hgt > window.innerHeight - 8 && r.top - hgt - 6 > 8) top = r.top - hgt - 6;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
    pop.style.minWidth = `${Math.round(Math.max(r.width, width || 0))}px`;
  };
  place();
  button.classList.add('open');
  requestAnimationFrame(() => { place(); pop.classList.add('in'); });
  // While it fades out it must not catch the next click (a chip right under it, for example).
  const close = () => { pop.classList.remove('in'); pop.style.pointerEvents = 'none'; button.classList.remove('open'); setTimeout(() => pop.remove(), 150); };
  openPop = close;
  return { pop, close, place };
}

function pad(n) { return String(n).padStart(2, '0'); }
/** replaceChildren() stringifies arrays and null — flatten and drop the empties first. */
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(Boolean));
const dayLabel = (s) => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return `${WEEKDAYS_SHORT[weekdayOf(s)]}, ${d} ${MONTHS_SHORT[m - 1]} ${y}`; };

/**
 * dateField({ value: 'YYYY-MM-DD', min?, max?, placeholder?, onChange }) → { el, get, set }
 * Month grid, Monday first, today marked, the chosen day filled; „დღეს“ and „გასუფთავება“ at the foot.
 */
export function dateField({ value = '', min = null, max = null, placeholder = t('აირჩიე დღე', 'Pick a day'), onChange, allowEmpty = false } = {}) {
  let current = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  const label = h('span', { class: current ? '' : 'ph' }, current ? dayLabel(current) : placeholder);
  const button = h('button', { type: 'button', class: 'bz-field-btn', 'aria-haspopup': 'dialog' }, icon('calendar', { size: 16 }), label, h('span', { style: { flex: 1 } }), icon('chevronDown', { size: 14 }));
  const el = h('div', { class: 'bz-field' }, button);
  const paint = () => { label.textContent = current ? dayLabel(current) : placeholder; label.className = current ? '' : 'ph'; };
  const set = (next, fire = true) => { current = next || ''; paint(); if (fire) onChange?.(current); };

  button.addEventListener('click', () => {
    if (button.classList.contains('open')) { closeOpen(); return; }
    const { pop, close, place } = popover(el, button, 'bz-cal-pop', 296);
    let view = (current || ymd()).slice(0, 7);
    const render = () => {
      const [y, m] = view.split('-').map(Number);
      const first = `${y}-${pad(m)}-01`;
      const offset = (weekdayOf(first) + 6) % 7; // Monday first
      const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const cells = [];
      for (let i = 0; i < offset; i += 1) cells.push(null);
      for (let d = 1; d <= daysIn; d += 1) cells.push(`${y}-${pad(m)}-${pad(d)}`);
      const today = ymd();
      fill(pop, 
        h('div', { class: 'bz-cal-pop-head' },
          h('button', { type: 'button', 'aria-label': t('წინა თვე', 'Previous month'), onClick: () => { const d = new Date(Date.UTC(y, m - 2, 1)); view = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; render(); } }, icon('chevronLeft', { size: 16 })),
          h('b', null, `${MONTHS[m - 1]} ${y}`),
          h('button', { type: 'button', 'aria-label': t('შემდეგი თვე', 'Next month'), onClick: () => { const d = new Date(Date.UTC(y, m, 1)); view = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; render(); } }, icon('chevronRight', { size: 16 }))),
        h('div', { class: 'bz-cal-pop-grid' },
          [1, 2, 3, 4, 5, 6, 0].map((wd) => h('div', { class: 'wd' }, WEEKDAYS_SHORT[wd].slice(0, 2))),
          cells.map((d) => d ? h('button', {
            type: 'button',
            class: `${d === current ? 'on' : ''} ${d === today ? 'today' : ''}`,
            disabled: (min && d < min) || (max && d > max),
            onClick: () => { set(d); close(); openPop = null; },
          }, String(Number(d.slice(8)))) : h('span'))),
        h('div', { class: 'bz-cal-pop-foot' },
          h('button', { type: 'button', onClick: () => { set(today); close(); openPop = null; } }, t('დღეს', 'Today')),
          allowEmpty ? h('button', { type: 'button', onClick: () => { set(''); close(); openPop = null; } }, t('გასუფთავება', 'Clear')) : h('span')));
      place();
    };
    render();
  });
  return { el, get: () => current, set: (v) => set(v, false), button };
}

const PART = (m) => (m < 12 * 60 ? t('დილა', 'Morning') : m < 17 * 60 ? t('დღე', 'Afternoon') : t('საღამო', 'Evening'));
/** The hours editor's „until“ may be 24:00 (midnight); it is shown as the last button. */

/**
 * timeField({ value: 'HH:mm', step: 15, from: '08:00', to: '22:00', free?: Set<'HH:mm'>, busy?: Set, placeholder?, onChange })
 * A grid of quarter hours in three groups; free slots (from availability) are tinted lime, taken ones struck.
 */
export function timeField({ value = '', step = 15, from = '08:00', to = '22:00', free = null, busy = null, placeholder = t('აირჩიე დრო', 'Pick a time'), onChange, allowEmpty = false } = {}) {
  let current = value && /^\d{1,2}:\d{2}$/.test(value) ? value : '';
  let range = { from, to, step };
  let marks = { free, busy };
  const label = h('span', { class: current ? '' : 'ph' }, current || placeholder);
  const button = h('button', { type: 'button', class: 'bz-field-btn', 'aria-haspopup': 'dialog' }, icon('clock', { size: 16 }), label, h('span', { style: { flex: 1 } }), icon('chevronDown', { size: 14 }));
  const el = h('div', { class: 'bz-field' }, button);
  const paint = () => { label.textContent = current || placeholder; label.className = current ? '' : 'ph'; };
  const set = (next, fire = true) => { current = next || ''; paint(); if (fire) onChange?.(current); };
  const toMin = (s) => { const [hh, mm] = String(s).split(':').map(Number); return hh * 60 + mm; };

  button.addEventListener('click', () => {
    if (button.classList.contains('open')) { closeOpen(); return; }
    const { pop, close, place } = popover(el, button, 'bz-time-pop', 316);
    const groups = new Map();
    for (let m = toMin(range.from); m <= toMin(range.to); m += range.step) {
      const v = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      const g = PART(m);
      groups.set(g, [...(groups.get(g) || []), v]);
    }
    fill(pop, 
      [...groups.entries()].map(([name, list]) => [
        h('div', { class: 'bz-time-group' }, name),
        h('div', { class: 'bz-time-grid' }, list.map((v) => h('button', {
          type: 'button',
          class: `${v === current ? 'on' : ''} ${marks.free?.has(v) ? 'free' : ''} ${marks.busy?.has(v) ? 'busy' : ''}`,
          onClick: () => { set(v); close(); openPop = null; },
        }, v))),
      ]),
      marks.free ? h('div', { class: 'bz-time-note' }, h('span', null, h('i'), t('თავისუფალია', 'Free')), h('span', null, t('სხვა დროც შეიძლება — შემოწმდება ჩაწერისას', 'Other times can be picked too — checked on save'))) : null,
      allowEmpty ? h('div', { class: 'bz-cal-pop-foot' }, h('span'), h('button', { type: 'button', onClick: () => { set(''); close(); openPop = null; } }, t('გასუფთავება', 'Clear'))) : null);
    place();
    const on = pop.querySelector('.bz-time-grid button.on');
    if (on) on.scrollIntoView({ block: 'center' });
  });
  return {
    el,
    get: () => current,
    set: (v) => set(v, false),
    /** Update the grid's bounds and the free / busy marks (e.g. after availability loads). */
    configure: ({ from: f, to: tt, step: st, free: fr, busy: bz } = {}) => { range = { from: f ?? range.from, to: tt ?? range.to, step: st ?? range.step }; marks = { free: fr === undefined ? marks.free : fr, busy: bz === undefined ? marks.busy : bz }; },
    button,
  };
}

