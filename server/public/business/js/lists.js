// MEDIBOOK business panel — the list kit: filters as chips, a pager, day groups and sortable heads.
// Every long list in the panel paginates (owner: „უკიდეგანო სიები საშინელებაა“); 25 rows a page by default.
import { h, icon } from '/app/js/ui.js';
import { select } from './fields.js';
import { t } from '/app/js/i18n.js';

export const PAGE_SIZES = [25, 50, 100];

/** Slice `rows` for `page` (1-based); the page is clamped so a shrinking filter never shows an empty page. */
export function paginate(rows, page = 1, size = 25) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const from = (current - 1) * size;
  return { rows: rows.slice(from, from + size), page: current, pages, total, from: total ? from + 1 : 0, to: Math.min(total, from + size) };
}

/** „1–25 / 212“, previous / next, a window of page numbers and the page size. */
export function pager({ total, page, pages, from, to, size, onPage, onSize }) {
  if (!total) return null;
  const btn = (label, target, extra = {}) => h('button', { type: 'button', class: `bz-page${extra.on ? ' on' : ''}`, disabled: extra.disabled, 'aria-label': extra.aria, 'aria-current': extra.on ? 'page' : undefined, onClick: () => onPage(target) }, label);
  const window = [];
  const lo = Math.max(1, Math.min(page - 2, pages - 4));
  const hi = Math.min(pages, lo + 4);
  for (let p = lo; p <= hi; p += 1) window.push(p);
  return h('div', { class: 'bz-pager' },
    h('span', { class: 'bz-pager-count' }, t(`${from}–${to} / ${total}`, `${from}–${to} of ${total}`)),
    h('span', { class: 'spacer' }),
    pages > 1 ? h('div', { class: 'bz-pager-pages' },
      btn(icon('chevronLeft', { size: 15 }), page - 1, { disabled: page <= 1, aria: t('წინა', 'Previous') }),
      lo > 1 ? [btn('1', 1), lo > 2 ? h('span', { class: 'bz-page-gap' }, '…') : null] : null,
      window.map((p) => btn(String(p), p, { on: p === page })),
      hi < pages ? [hi < pages - 1 ? h('span', { class: 'bz-page-gap' }, '…') : null, btn(String(pages), pages)] : null,
      btn(icon('chevronRight', { size: 15 }), page + 1, { disabled: page >= pages, aria: t('შემდეგი', 'Next') })) : null,
    onSize ? select(PAGE_SIZES.map((n) => ({ value: n, label: t(`${n} / გვერდზე`, `${n} per page`) })), size, { class: 'input select bz-pager-size', onChange: (e) => onSize(Number(e.target.value)) }) : null);
}

/** Chips with counts; `value` '' = all. Options: [value, label, count?]. */
export function chips(options, value, onChange) {
  return h('div', { class: 'bz-chips', role: 'radiogroup' }, options.map(([v, label, n]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(v === value), class: `bz-chip${v === value ? ' on' : ''}`, onClick: () => onChange(v),
  }, label, n != null ? h('i', { class: 'n' }, String(n)) : null)));
}

/** A row of filter controls: the search first, then chips and selects, the count on the right. */
export function filterBar(...children) {
  return h('div', { class: 'bz-filters' }, children);
}

/** Group rows by a key (a day, a month) keeping the rows' order: [[key, rows], …]. */
export function groupBy(rows, keyOf) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    map.set(k, [...(map.get(k) || []), r]);
  }
  return [...map.entries()];
}

/** Table head cells that sort on click; `sort` = { key, dir }. */
export function sortableHead(columns, sort, onSort) {
  return h('thead', null, h('tr', null, columns.map((col) => {
    if (!col) return null;
    if (!col.key) return h('th', { class: col.class || '' }, col.label || '');
    const on = sort.key === col.key;
    return h('th', { class: `bz-sort${on ? ' on' : ''} ${col.class || ''}`, 'aria-sort': on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none' },
      h('button', { type: 'button', onClick: () => onSort({ key: col.key, dir: on && sort.dir === 'asc' ? 'desc' : on ? 'asc' : col.dir || 'desc' }) }, col.label, h('span', { class: 'arrow' }, on ? (sort.dir === 'asc' ? '↑' : '↓') : '')));
  })));
}

export function sortRows(rows, sort, getters) {
  const get = getters[sort.key];
  if (!get) return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a); const y = get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y, 'ka') * dir;
    return (x > y ? 1 : x < y ? -1 : 0) * dir;
  });
}

/** Remembers a list's filters and page in the URL hash-less query (so back/forward keep them), per page key. */
export function listState(key, defaults) {
  const store = {};
  try { Object.assign(store, JSON.parse(sessionStorage.getItem(`medicard.business.list.${key}`) || '{}')); } catch { /* ignore */ }
  const state = { ...defaults, ...store };
  const save = () => { try { sessionStorage.setItem(`medicard.business.list.${key}`, JSON.stringify(state)); } catch { /* ignore */ } };
  return { state, set(patch) { Object.assign(state, patch); save(); return state; } };
}
