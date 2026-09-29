// MEDICARD web — DOM toolkit and shared components (hub design language).
import { t, locale } from './i18n.js';
import { icon } from './icons.js';

export { icon };

/**
 * h('div', { class: 'x', onClick() {}, style: {...}, dataset: {...} }, child, [children], 'text')
 * Falsy children are skipped. Strings are text nodes (never HTML).
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class' || k === 'className') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v; // only for trusted, static markup
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' && 'value' in el) el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = Boolean(v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function mount(el, ...children) { clear(el); append(el, children); return el; }

/* ── Formatting (active language; names kept KA_* for existing imports) ── */
export const KA_MONTHS = t(
  ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'],
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
);
export const KA_MONTHS_SHORT = t(
  ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'],
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
);
export const KA_DAYS = t(
  ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'],
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
);
export const KA_DAYS_SHORT = t(['კვ', 'ორ', 'სმ', 'ოთ', 'ხთ', 'პრ', 'შბ'], ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);

export function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ymd(d = new Date()) {
  const x = parseDate(d) || new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function addDays(d, n) { const x = new Date(parseDate(d)); x.setDate(x.getDate() + n); return x; }

export function fmtDate(v, opts = {}) {
  const d = parseDate(v);
  if (!d) return '—';
  const base = `${d.getDate()} ${(opts.short ? KA_MONTHS_SHORT : KA_MONTHS)[d.getMonth()]}`;
  return opts.year === false || (opts.year !== true && d.getFullYear() === new Date().getFullYear()) ? base : `${base} ${d.getFullYear()}`;
}

export function fmtTime(v) {
  const d = parseDate(v);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtDateTime(v) { return `${fmtDate(v)}, ${fmtTime(v)}`; }

export function relDay(v) {
  const d = parseDate(v);
  if (!d) return '';
  const diff = Math.round((new Date(ymd(d)) - new Date(ymd())) / 86400000);
  if (diff === 0) return t('დღეს', 'Today');
  if (diff === -1) return t('გუშინ', 'Yesterday');
  if (diff === 1) return t('ხვალ', 'Tomorrow');
  return fmtDate(d);
}

export function fmtNum(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).replace(/ /g, ' ');
}

export function greeting() {
  const hr = new Date().getHours();
  if (hr < 5) return t('ღამე მშვიდობისა', 'Good night');
  if (hr < 12) return t('დილა მშვიდობისა', 'Good morning');
  if (hr < 18) return t('შუადღე მშვიდობისა', 'Good afternoon');
  return t('საღამო მშვიდობისა', 'Good evening');
}

/* ── Building blocks ───────────────────────────────────── */
export const INKS = ['teal', 'blue', 'violet', 'rose', 'amber', 'green', 'sky', 'neutral'];

export function tile(name, ink = 'teal', size = 42) {
  return h('span', { class: `tile ink-${ink}`, style: { width: `${size}px`, height: `${size}px` } }, icon(name, { size: Math.round(size * 0.48) }));
}

/** Page header: title + optional subtitle + actions on the right. */
export function pageHead(title, sub, ...actions) {
  return h('header', { class: 'page-head' },
    h('div', { class: 'page-head-text' },
      h('h1', null, title),
      sub ? h('p', null, sub) : null),
    actions.length ? h('div', { class: 'page-head-actions' }, actions) : null);
}

/** Hub section: title outside the card, optional right link. */
export function section(title, content, opts = {}) {
  return h('section', { class: `hub-section ${opts.class || ''}` },
    title ? h('div', { class: 'hub-section-head' },
      h('h2', null, title),
      opts.link ? h('a', { href: opts.link.href, class: 'link', 'data-link': '' }, opts.link.label, icon('chevronRight', { size: 16 })) : null,
      opts.action || null) : null,
    content);
}

export function card(...children) {
  let props = { class: 'card' };
  if (children[0] && typeof children[0] === 'object' && !(children[0] instanceof Node) && !Array.isArray(children[0])) {
    const p = children.shift();
    props = { ...p, class: `card ${p.class || ''}` };
  }
  return h('div', props, children);
}

export function button(label, opts = {}) {
  const variant = opts.variant || 'primary';
  const b = h(opts.href ? 'a' : 'button', {
    class: `btn btn-${variant} ${opts.size ? `btn-${opts.size}` : ''} ${opts.class || ''}`,
    type: opts.href ? undefined : opts.type || 'button',
    href: opts.href,
    'data-link': opts.href && !opts.external ? '' : undefined,
    target: opts.external ? '_blank' : undefined,
    rel: opts.external ? 'noopener' : undefined,
    disabled: opts.disabled,
    onClick: opts.onClick,
    title: opts.title,
    'aria-label': opts.ariaLabel,
  }, opts.icon ? icon(opts.icon, { size: opts.size === 'sm' ? 16 : 18 }) : null, label ? h('span', null, label) : null);
  return b;
}

export function iconButton(name, opts = {}) {
  return h('button', {
    class: `icon-btn ${opts.class || ''}`,
    type: 'button',
    title: opts.title,
    'aria-label': opts.title,
    onClick: opts.onClick,
  }, icon(name, { size: opts.size || 20 }));
}

/** Async button helper: disables + shows spinner while fn runs. */
export async function busy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  btn.classList.add('is-busy');
  try { return await fn(); } finally { btn.disabled = false; btn.classList.remove('is-busy'); }
}

export function badge(text, tone = 'neutral') { return h('span', { class: `badge badge-${tone}` }, text); }

export function stat(label, value, opts = {}) {
  return h('div', { class: `stat ${opts.class || ''}` },
    h('div', { class: 'stat-label' }, opts.icon ? icon(opts.icon, { size: 15 }) : null, label),
    h('div', { class: 'stat-value' }, value, opts.unit ? h('small', null, ` ${opts.unit}`) : null),
    opts.delta ? h('div', { class: `stat-delta ${opts.deltaTone || ''}` }, opts.delta) : null,
    opts.children || null);
}

export function empty(title, body, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-art' }, icon('sparkles', { size: 26 })),
    h('h3', null, title),
    body ? h('p', null, body) : null,
    action || null);
}

export function skeleton(lines = 3, opts = {}) {
  return h('div', { class: `skeleton-card ${opts.class || ''}` },
    Array.from({ length: lines }, (_, i) => h('div', { class: 'sk', style: { width: `${[92, 70, 84, 56, 78][i % 5]}%` } })));
}

export function skeletonGrid(n = 4) {
  return h('div', { class: 'grid grid-auto' }, Array.from({ length: n }, () => skeleton(3)));
}

export function errorBox(err, retry) {
  return h('div', { class: 'error-box' },
    icon('alert', { size: 20 }),
    h('div', null, h('strong', null, t('ვერ ჩაიტვირთა', 'Couldn’t load')), h('p', null, err?.message || String(err || ''))),
    retry ? button(t('ხელახლა', 'Retry'), { variant: 'ghost', size: 'sm', onClick: retry }) : null);
}

export function progress(value, max = 100, opts = {}) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return h('div', { class: `progress ${opts.ink ? `ink-${opts.ink}` : ''}`, role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('span', { style: { width: `${pct}%` } }));
}

/** Segmented control. onChange(value). */
export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'segmented', role: 'tablist' });
  const render = (current) => {
    clear(wrap);
    for (const o of options) {
      wrap.appendChild(h('button', {
        type: 'button',
        role: 'tab',
        class: o.value === current ? 'on' : '',
        'aria-selected': o.value === current ? 'true' : 'false',
        onClick: () => { render(o.value); onChange(o.value); },
      }, o.label));
    }
  };
  render(value);
  return wrap;
}

/* ── Forms ─────────────────────────────────────────────── */
export function field(label, input, hint) {
  return h('label', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    input,
    hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function input(props = {}) { return h('input', { class: 'input', ...props }); }
export function textarea(props = {}) { return h('textarea', { class: 'input textarea', ...props }); }
export function select(options, value, props = {}) {
  return h('select', { class: 'input select', ...props },
    options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
}

export function formData(form) {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

export function toggle(checked, onChange, label) {
  const inp = h('input', { type: 'checkbox', checked, onChange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'toggle' }, inp, h('span', { class: 'toggle-track' }, h('span', { class: 'toggle-thumb' })), label ? h('span', { class: 'toggle-label' }, label) : null);
}

/* ── Toasts ────────────────────────────────────────────── */
let toastHost = null;
export function toast(message, tone = 'ok', opts = {}) {
  if (!toastHost) { toastHost = h('div', { class: 'toast-host', 'aria-live': 'polite' }); document.body.appendChild(toastHost); }
  const t = h('div', { class: `toast toast-${tone}` },
    icon(tone === 'error' ? 'alert' : tone === 'info' ? 'info' : 'check', { size: 18 }),
    h('span', null, message),
    opts.action ? h('button', { class: 'toast-action', onClick: () => { opts.action.onClick(); dismiss(); } }, opts.action.label) : null);
  toastHost.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  const dismiss = () => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  setTimeout(dismiss, opts.ms || 3600);
  return dismiss;
}

/* ── Modal / sheet ─────────────────────────────────────── */
/**
 * openModal({ title, body: Node | (close) => Node, footer?: (close) => Node[], size: 'sm'|'md'|'lg', dismissable })
 * Returns { close, el }. Esc / scrim close unless dismissable === false.
 */
export function openModal(opts) {
  const prevFocus = document.activeElement;
  let closed = false;
  const close = (value) => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('in');
    wrap.classList.add('out');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { wrap.remove(); if (!document.querySelector('.modal-wrap')) document.body.classList.remove('modal-open'); }, 220);
    prevFocus?.focus?.();
    opts.onClose?.(value);
  };
  const onKey = (e) => { if (e.key === 'Escape' && opts.dismissable !== false) close(); };
  const body = typeof opts.body === 'function' ? opts.body(close) : opts.body;
  const footer = typeof opts.footer === 'function' ? opts.footer(close) : opts.footer;
  const dialog = h('div', { class: `modal modal-${opts.size || 'md'}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '' },
    opts.title ? h('div', { class: 'modal-head' },
      h('h2', null, opts.title),
      opts.dismissable === false ? null : iconButton('x', { title: t('დახურვა', 'Close'), onClick: () => close() })) : null,
    h('div', { class: 'modal-body' }, body),
    footer ? h('div', { class: 'modal-foot' }, footer) : null);
  const scrim = h('div', { class: 'modal-scrim', onClick: () => { if (opts.dismissable !== false) close(); } });
  const wrap = h('div', { class: 'modal-wrap' }, scrim, dialog);
  document.body.appendChild(wrap);
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    wrap.classList.add('in');
    const first = dialog.querySelector('input:not([type=hidden]),textarea,select');
    (first || dialog.querySelector('button'))?.focus?.({ preventScroll: true });
  });
  return { close, el: dialog };
}

/** confirmDialog({ title, body, confirm: 'წაშლა', danger: true }) → Promise<boolean> */
export function confirmDialog({ title, body, confirm = t('დადასტურება', 'Confirm'), cancel = t('გაუქმება', 'Cancel'), danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    openModal({
      title,
      size: 'sm',
      body: h('p', { class: 'muted' }, body),
      footer: (close) => [
        button(cancel, { variant: 'ghost', onClick: () => close() }),
        button(confirm, { variant: danger ? 'danger' : 'primary', onClick: () => { result = true; close(); } }),
      ],
      onClose: () => resolve(result),
    });
  });
}

/** Form modal: fields render inside a <form>; onSubmit(values, close) may throw to show an error. */
export function formModal({ title, fields, submit = t('შენახვა', 'Save'), onSubmit, size = 'md', danger }) {
  let form;
  const err = h('div', { class: 'form-error', hidden: true });
  const m = openModal({
    title,
    size,
    body: (close) => {
      form = h('form', { class: 'form', onSubmit: async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type=submit]') || m?.el.querySelector('.modal-foot button[type=submit]');
        err.hidden = true;
        try {
          await busy(btn || h('button'), () => onSubmit(formData(form), close, form));
        } catch (e2) {
          err.textContent = e2?.message || t('ვერ შეინახა.', 'Couldn’t save.');
          err.hidden = false;
        }
      } }, typeof fields === 'function' ? fields() : fields, err, h('button', { type: 'submit', hidden: true }));
      return form;
    },
    footer: (close) => [
      button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }),
      button(submit, { variant: danger ? 'danger' : 'primary', onClick: () => form.requestSubmit() }),
    ],
  });
  return m;
}

/** Tabs row that shares the page width. */
export function tabs(items, active, onChange) {
  return segmented(items, active, onChange);
}

/** Tiny list row: leading tile, title/sub, trailing. */
export function row({ icon: ic, ink = 'teal', title, sub, trailing, href, onClick, class: cls }) {
  const tag = href ? 'a' : onClick ? 'button' : 'div';
  return h(tag, { class: `row ${href || onClick ? 'row-link' : ''} ${cls || ''}`, href, 'data-link': href ? '' : undefined, type: tag === 'button' ? 'button' : undefined, onClick },
    ic ? tile(ic, ink, 38) : null,
    h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, title), sub ? h('div', { class: 'row-sub' }, sub) : null),
    trailing !== undefined ? h('div', { class: 'row-trail' }, trailing) : (href ? icon('chevronRight', { size: 18, className: 'row-chev' }) : null));
}

/** Loads data into a container with skeleton + error handling. render(data) → Node. */
export async function load(container, fetcher, render, opts = {}) {
  if (!opts.silent) mount(container, opts.skeleton || skeleton(4));
  try {
    const data = await fetcher();
    mount(container, render(data));
    return data;
  } catch (e) {
    mount(container, errorBox(e, () => load(container, fetcher, render, opts)));
    return null;
  }
}

export function debounce(fn, ms = 250) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Minimal safe markdown → DOM (bold, italics, lists, headings, links https only, paragraphs). */
export function markdown(text) {
  const root = h('div', { class: 'md' });
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let list = null;
  const inline = (s) => {
    const esc = escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const span = document.createElement('span');
    span.innerHTML = esc;
    return span;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) {
      if (!list) { list = h(/^\s*\d/.test(line) ? 'ol' : 'ul'); root.appendChild(list); }
      list.appendChild(h('li', null, inline(li[1])));
      continue;
    }
    list = null;
    if (!line.trim()) continue;
    const hd = line.match(/^(#{1,4})\s+(.*)$/);
    if (hd) { root.appendChild(h(hd[1].length <= 2 ? 'h3' : 'h4', null, inline(hd[2]))); continue; }
    root.appendChild(h('p', null, inline(line)));
  }
  return root;
}
