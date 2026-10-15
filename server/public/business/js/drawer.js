// MEDIBOOK business panel — right-hand drawer (appointment, client), one at a time.
import { h, iconButton } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';

let current = null;

/** openDrawer({ title, body: Node | (close) => Node, footer?: (close) => Node[], onClose }) → { close, el, setBody } */
export function openDrawer(opts) {
  current?.close();
  let closed = false;
  const close = (value) => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('in');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => wrap.remove(), 220);
    if (current?.el === panel) current = null;
    opts.onClose?.(value);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const bodyEl = h('div', { class: 'bz-drawer-body' }, typeof opts.body === 'function' ? opts.body(close) : opts.body);
  const footer = typeof opts.footer === 'function' ? opts.footer(close) : opts.footer;
  const footEl = footer ? h('div', { class: 'bz-drawer-foot' }, footer) : null;
  const titleEl = h('h2', null, opts.title || '');
  const panel = h('aside', { class: 'bz-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '' },
    h('div', { class: 'bz-drawer-head' }, titleEl, iconButton('x', { title: t('დახურვა', 'Close'), onClick: () => close() })),
    bodyEl, footEl);
  const wrap = h('div', { class: 'bz-drawer-wrap' }, h('div', { class: 'bz-drawer-scrim', onClick: () => close() }), panel);
  document.body.appendChild(wrap);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => wrap.classList.add('in'));
  const api = {
    close,
    el: panel,
    setTitle: (text) => { titleEl.textContent = text; },
    setBody: (node) => { bodyEl.replaceChildren(node); },
    setFooter: (nodes) => { if (footEl) footEl.replaceChildren(...[].concat(nodes).filter(Boolean)); },
  };
  current = api;
  return api;
}
