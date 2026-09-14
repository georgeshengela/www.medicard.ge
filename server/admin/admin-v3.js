/**
 * MediCard Admin V3 — shared operator chrome.
 * Loads last. Wraps toast / openDrawer / closeDrawer at call time.
 * Does not change analytics or migrate page content.
 */
(function adminV3(global) {
  const V3 = {
    dirty: false,
    lastFocus: null,
    overlayMode: null,
    confirmOpen: false,
  };

  const GROUP_KEY = 'medicard.admin.navGroups';
  const COMPACT_KEY = 'medicard.admin.sidebarCompact';

  const HUMAN = {
    status: { ACTIVE: 'შესვლა დაშვებულია', BLOCKED: 'დაბლოკილი' },
    package: { FREE: 'უფასო', STANDARD: 'სტანდარტი', ULTIMATE: 'ალტიმეიტი' },
    rewardStatus: {
      DRAFT: 'მონახაზი', ACTIVE: 'აქტიური', PAUSED: 'შეჩერებული', ARCHIVED: 'დაარქივებული',
      SCHEDULED: 'დაგეგმილი', ENDED: 'დასრულებული', ISSUED: 'გაცემული', USED: 'გამოყენებული',
      EXPIRED: 'ვადაგასული', CANCELLED: 'გაუქმებული', PENDING: 'მოლოდინში',
      OK: 'კარგი', LOW: 'დაბალი', OUT: 'ამოწურული', UNLIMITED: 'ულიმიტო',
    },
    feature: {
      medi: 'Medi',
      medications: "მედიკამენტები",
      cycle: "ციკლი",
      hydration: "ჰიდრატაცია",
      steps: "ნაბიჯები",
      weight: "წონა",
      visits: "ვიზიტები",
      weekly_report: "კვირის ანგარიში",
    },
    suppress: typeof SUPPRESS_KA === 'object' ? SUPPRESS_KA : {
      quiet_hours: 'მშვიდი საათები',
      recent_activity: 'ბოლო აქტივობა',
      fatigue: 'დაღლილობა',
      cooldown: 'შესვენება',
      daily_cap: 'დღიური ლიმიტი',
      privacy: 'კონფიდენციალურობა',
    },
  };

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }

  function el(id) {
    return document.getElementById(id);
  }

  function labelMap(type) {
    if (type === 'feature' && global.FEATURE_USAGE_LABELS) return global.FEATURE_USAGE_LABELS;
    if ((type === 'rewardStatus' || type === 'status') && global.STATUS_KA) {
      return type === 'status' ? { ...HUMAN.status, ...global.STATUS_KA } : global.STATUS_KA;
    }
    if (type === 'category' && global.CATEGORY_KA) return global.CATEGORY_KA;
    if (type === 'suppress' && global.SUPPRESS_KA) return global.SUPPRESS_KA;
    return HUMAN[type] || {};
  }

  function humanLabel(type, value) {
    const key = String(value ?? '');
    const map = labelMap(type);
    return map[key] || key || '—';
  }

  function statusTone(value) {
    const v = String(value || '').toUpperCase();
    if (['ACTIVE', 'OK', 'ISSUED', 'SENT'].includes(v)) return 'ok';
    if (['PAUSED', 'LOW', 'PENDING', 'SCHEDULED', 'WARN'].includes(v)) return 'warn';
    if (['BLOCKED', 'FAILED', 'OUT', 'CANCELLED', 'EXPIRED', 'DANGER', 'BAD'].includes(v)) return 'danger';
    if (['INFO'].includes(v)) return 'info';
    return 'neutral';
  }

  function statusBadge(value, opts = {}) {
    const label = opts.label || humanLabel(opts.type || 'rewardStatus', value);
    const tone = opts.tone || statusTone(value);
    return `<span class="v3-badge is-${tone}">${esc(label)}</span>`;
  }

  function formatDate(value, mode = 'exact') {
    if (!value) return '—';
    if (typeof adminDateParts !== 'function') return String(value);
    const p = adminDateParts(value);
    if (!p) return '—';
    const now = adminDateParts(new Date());
    const a = Date.UTC(p.year, p.month, p.day);
    const b = Date.UTC(now.year, now.month, now.day);
    const diff = Math.round((b - a) / 86400000);
    if (mode === 'relative' || mode === 'smart') {
      if (diff === 0) return `დღეს, ${p.hour}:${p.minute}`;
      if (diff === 1) return `გუშინ, ${p.hour}:${p.minute}`;
    }
    if (mode === 'today') {
      if (diff === 0) return 'დღეს';
      if (diff === 1) return 'გუშინ';
    }
    if (mode === 'compact' || mode === 'table') {
      if (diff === 0) return `${p.hour}:${p.minute}`;
      if (diff === 1) return 'გუშინ';
      return `${p.day} ${MONTHS_KA_SHORT[p.month]}`;
    }
    if (mode === 'short') return `${p.day} ${MONTHS_KA[p.month]}, ${p.year}`;
    if (mode === 'tz') return `${p.day} ${MONTHS_KA[p.month]}, ${p.year}, ${p.hour}:${p.minute} · თბილისი`;
    return `${p.day} ${MONTHS_KA[p.month]}, ${p.year}, ${p.hour}:${p.minute}`;
  }

  function copyIdButton(id, label = 'ID') {
    if (!id) return '';
    return `<button type="button" class="v3-id inv-copy" data-copy="${esc(id)}" data-copy-label="${esc(label)}" title="${esc(label)}">${esc(String(id).slice(0, 8))}…</button>`;
  }

  function pageHeader({ kicker, title, purpose, primary, secondary, helpKey }) {
    return `
      <header class="v3-page-header">
        <div class="v3-page-header-main">
          ${kicker ? `<p class="v3-page-kicker">${esc(kicker)}</p>` : ''}
          <div class="v3-title-row">
            <h2>${esc(title || '')}</h2>
            ${helpKey ? infoButton(helpKey) : ''}
          </div>
          ${purpose ? `<p class="v3-page-purpose">${esc(purpose)}</p>` : ''}
        </div>
        <div class="v3-page-header-actions">
          ${secondary || ''}
          ${primary || ''}
        </div>
      </header>`;
  }

  function section({ title, description, action, content, helpKey }) {
    return `
      <section class="v3-section">
        <div class="v3-section-head">
          <div>
            <div class="v3-title-row">
              <h3>${esc(title || '')}</h3>
              ${helpKey ? infoButton(helpKey) : ''}
            </div>
            ${description ? `<p>${esc(description)}</p>` : ''}
          </div>
          ${action || ''}
        </div>
        <div class="v3-section-body">${content || ''}</div>
      </section>`;
  }

  function infoButton(helpKey, label = 'სექციის ახსნა') {
    if (!helpKey) return '';
    return `<button type="button" class="v3-info-btn" data-v3-help="${esc(helpKey)}" aria-label="${esc(label)}" title="${esc(label)}">${ico('info')}</button>`;
  }

  function renderHelpBody(entry) {
    if (!entry) return '<p class="muted">ახსნა ვერ მოიძებნა.</p>';
    const block = (h, text) => (text ? `<div class="v3-help-block"><h4>${esc(h)}</h4><p>${esc(text)}</p></div>` : '');
    const more = entry.destination?.href
      ? `<p class="v3-help-more"><a href="${esc(entry.destination.href)}">${esc(entry.destination.label || 'მეტი')}</a></p>`
      : '';
    const tech = entry.technical
      ? `<details class="v3-help-tech"><summary>ტექნიკური დეტალები</summary><p>${esc(entry.technical)}</p></details>`
      : '';
    return `
      <div class="v3-help-body">
        <p class="v3-help-summary">${esc(entry.summary || '')}</p>
        ${block('როგორ მუშაობს', entry.howItWorks)}
        ${block('პერიოდი', entry.period)}
        ${block('როგორ წავიკითხოთ', entry.interpretation)}
        ${more}
        ${tech}
      </div>`;
  }

  function closeHelpPopover() {
    el('v3-help-pop')?.remove();
  }

  function openHelp(helpKey, anchor) {
    const entry = global.AdminHelp?.get?.(helpKey);
    if (!entry) {
      toast(`ახსნა ვერ მოიძებნა: ${helpKey}`, 'warn');
      return;
    }
    const long = String(entry.howItWorks || '').length + String(entry.interpretation || '').length > 420;
    if (long || !anchor) {
      openDialog({
        title: entry.title,
        body: renderHelpBody(entry),
        watchDirty: false,
      });
      return;
    }
    closeHelpPopover();
    const pop = document.createElement('div');
    pop.id = 'v3-help-pop';
    pop.className = 'v3-help-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', entry.title);
    pop.innerHTML = `
      <header class="v3-help-pop-head">
        <strong>${esc(entry.title)}</strong>
        <button type="button" class="v3-icon-btn" id="v3-help-x" aria-label="დახურვა" title="დახურვა">${ico('x')}</button>
      </header>
      ${renderHelpBody(entry)}`;
    document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(400, window.innerWidth - 24);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    if (left < 12) left = 12;
    let top = rect.bottom + 8;
    const height = pop.offsetHeight || 280;
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 8);
    pop.style.width = `${width}px`;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    const onDoc = (e) => {
      if (e.target.closest('#v3-help-pop') || e.target.closest(`[data-v3-help="${helpKey}"]`)) return;
      teardown();
    };
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      teardown();
      anchor?.focus?.();
    };
    const teardown = () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('keydown', onEsc, true);
      closeHelpPopover();
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onEsc, true);
    el('v3-help-x')?.addEventListener('click', () => {
      teardown();
      anchor?.focus?.();
    });
    el('v3-help-x')?.focus();
  }

  function bindHelpClicks(root = document) {
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-v3-help]');
      if (!btn) return;
      e.preventDefault();
      openHelp(btn.getAttribute('data-v3-help'), btn);
    });
  }

  function toolbar(inner) {
    return `<div class="v3-toolbar" role="toolbar">${inner || ''}</div>`;
  }

  function filterBar() {
    const presets = [
      ['today', 'დღეს'],
      ['7d', '7დ'],
      ['30d', '30დ'],
      ['90d', '90დ'],
      ['custom', 'მითითებული'],
    ];
    const range = (typeof opsState === 'object' && opsState.range) || '7d';
    const from = (typeof opsState === 'object' && opsState.from) || '';
    const to = (typeof opsState === 'object' && opsState.to) || '';
    const applied = range === 'custom' && (from || to) ? 1 : 0;
    return `
      <div class="v3-filterbar ops-range" role="group" aria-label="პერიოდი · Asia/Tbilisi">
        ${presets.map(([value, label]) => `
          <button type="button" class="ops-range-btn${range === value ? ' active' : ''}" data-ops-range="${value}">${label}</button>
        `).join('')}
        <label class="ops-range-custom${range === 'custom' ? '' : ' hidden'}">
          <input type="date" id="ops-from" value="${esc(from)}" />
          <span>→</span>
          <input type="date" id="ops-to" value="${esc(to)}" />
          <button type="button" class="btn compact" id="ops-custom-apply">გამოყენება</button>
        </label>
        <span class="v3-filter-meta">თბილისი</span>
        ${applied ? `<button type="button" class="v3-filter-clear" id="ops-range-clear">გასუფთავება</button>` : ''}
      </div>`;
  }

  function tabs(items, active) {
    return `<div class="v3-tabs" role="tablist">${(items || []).map(([id, label]) => `
      <button type="button" class="v3-tab" role="tab" data-v3-tab="${esc(id)}" aria-selected="${id === active ? 'true' : 'false'}" tabindex="${id === active ? '0' : '-1'}">${label}</button>
    `).join('')}</div>`;
  }

  function bindTabs(root, onChange) {
    const host = typeof root === 'string' ? document.querySelector(root) : root;
    if (!host) return;
    const list = host.matches('[role="tablist"]') ? host : host.querySelector('[role="tablist"]');
    if (!list) return;
    const all = () => [...list.querySelectorAll('[role="tab"]')];
    const activate = (tab) => {
      all().forEach((btn) => {
        const on = btn === tab;
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      });
      tab.focus();
      onChange?.(tab.dataset.v3Tab || tab.getAttribute('data-v3-tab'));
    };
    all().forEach((tab) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', (e) => {
        const tabsEls = all();
        const i = tabsEls.indexOf(tab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const next = e.key === 'ArrowRight'
            ? tabsEls[(i + 1) % tabsEls.length]
            : tabsEls[(i - 1 + tabsEls.length) % tabsEls.length];
          activate(next);
        } else if (e.key === 'Home') {
          e.preventDefault();
          activate(tabsEls[0]);
        } else if (e.key === 'End') {
          e.preventDefault();
          activate(tabsEls[tabsEls.length - 1]);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(tab);
        }
      });
    });
  }

  function input({
    id, type = 'text', name, value = '', placeholder, disabled, required, rows, options,
  } = {}) {
    const common = `${id ? `id="${esc(id)}"` : ''} ${name ? `name="${esc(name)}"` : ''} class="v3-input"${disabled ? ' disabled' : ''}${required ? ' required' : ''}`;
    if (type === 'select') {
      return `<select ${common}>${(options || []).map((opt) => {
        const val = Array.isArray(opt) ? opt[0] : opt;
        const lab = Array.isArray(opt) ? opt[1] : opt;
        return `<option value="${esc(val)}"${String(val) === String(value) ? ' selected' : ''}>${esc(lab)}</option>`;
      }).join('')}</select>`;
    }
    if (type === 'textarea') {
      return `<textarea ${common} rows="${rows || 4}" placeholder="${esc(placeholder || '')}">${esc(value)}</textarea>`;
    }
    return `<input ${common} type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder || '')}" />`;
  }

  function field({ id, label, required, help, error, control }) {
    return `
      <label class="v3-field${error ? ' is-invalid' : ''}" ${id ? `for="${esc(id)}"` : ''}>
        <span class="v3-field-label">${esc(label || '')}${required ? '<em class="v3-req" aria-hidden="true">*</em>' : ''}</span>
        ${control || ''}
        ${help ? `<span class="v3-field-help">${esc(help)}</span>` : ''}
        ${error ? `<span class="v3-field-error">${esc(error)}</span>` : ''}
      </label>`;
  }

  function emptyState(title, body, ctaHtml) {
    return `<div class="v3-empty">${ico('layers')}<strong>${esc(title)}</strong>${body ? `<p>${esc(body)}</p>` : ''}${ctaHtml || ''}</div>`;
  }

  function errorState(title, body, retryId) {
    return `<div class="v3-error" role="alert"><strong>${esc(title || 'ჩატვირთვა ვერ მოხერხდა')}</strong>${body ? `<p>${esc(body)}</p>` : ''}${retryId ? `<button type="button" class="btn secondary compact" id="${esc(retryId)}">ხელახლა სცადე</button>` : ''}</div>`;
  }

  function skeleton(rows = 4) {
    return `<div class="v3-skel" aria-hidden="true">${Array.from({ length: rows }, () => '<i></i>').join('')}</div>`;
  }

  function dataTable({ headers, rowsHtml, empty, loading, error, clickable }) {
    if (loading) return skeleton(5);
    if (error) return errorState('ცხრილი ვერ ჩაიტვირთა', error);
    if (!rowsHtml) return emptyState(empty?.title || 'ჩანაწერი არ არის', empty?.body);
    return `<div class="v3-table-wrap"><table class="v3-table${clickable ? ' is-clickable' : ''}"><thead><tr>${
      (headers || []).map((h) => `<th>${h}</th>`).join('')
    }</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  }

  function stickyActions({ dirty, cancel, save, danger }) {
    return `
      <footer class="v3-sticky-actions${dirty ? ' is-dirty' : ''}" id="v3-sticky-actions">
        <div class="v3-sticky-actions-danger">${danger || ''}</div>
        <div class="v3-sticky-actions-main">
          ${dirty ? '<span class="v3-dirty-dot">შეცვლილია</span>' : ''}
          ${cancel || ''}
          ${save || ''}
        </div>
      </footer>`;
  }

  function iconButton({ id, name, label, extraClass }) {
    return `<button type="button" class="v3-icon-btn ${extraClass || ''}" ${id ? `id="${esc(id)}"` : ''} aria-label="${esc(label)}" title="${esc(label)}">${ico(name)}</button>`;
  }

  function toast(message, kind = 'ok', opts = {}) {
    const host = el('toasts');
    if (!host) return;
    const type = kind === 'bad' || kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : kind === 'info' ? 'info' : 'ok';
    const node = document.createElement('div');
    node.className = `toast v3-toast is-${type === 'error' ? 'bad' : type}`;
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const title = opts.title ? `<strong>${esc(opts.title)}</strong>` : '';
    node.innerHTML = `${ico(type === 'error' || type === 'warn' ? 'alert' : 'check')}${title}<span>${esc(message)}</span>${opts.action || ''}`;
    host.appendChild(node);
    const ms = opts.timeout != null ? opts.timeout : (type === 'error' ? 7000 : 3600);
    setTimeout(() => node.remove(), ms);
  }

  function setDirty(flag) {
    V3.dirty = Boolean(flag);
    if (global.AdminV3) global.AdminV3.dirty = V3.dirty;
    const foot = el('v3-sticky-actions') || document.querySelector('.v3-sticky-actions');
    if (!foot) return;
    foot.classList.toggle('is-dirty', V3.dirty);
    let dot = foot.querySelector('.v3-dirty-dot');
    if (V3.dirty && !dot) {
      const main = foot.querySelector('.v3-sticky-actions-main');
      if (main) {
        dot = document.createElement('span');
        dot.className = 'v3-dirty-dot';
        dot.textContent = 'შეცვლილია';
        main.prepend(dot);
      }
    } else if (!V3.dirty && dot) {
      dot.remove();
    }
  }

  function watchDirty(root) {
    if (!root) return;
    const mark = () => setDirty(true);
    root.querySelectorAll('input, select, textarea').forEach((field) => {
      field.addEventListener('input', mark);
      field.addEventListener('change', mark);
    });
  }

  function confirmLeave() {
    if (!V3.dirty) return Promise.resolve(true);
    return new Promise((resolve) => {
      openConfirm({
        title: 'ცვლილებები არ არის შენახული',
        message: 'დახურვის შემთხვევაში შეუნახავი ცვლილებები დაიკარგება.',
        confirmLabel: 'დახურვა',
        cancelLabel: 'დარჩენა',
        variant: 'warning',
        onConfirm: async () => { setDirty(false); resolve(true); },
        onCancel: () => resolve(false),
      });
    });
  }

  function trapFocus(panel) {
    if (!panel) return;
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const nodes = [...panel.querySelectorAll(sel)].filter((n) => !n.disabled && n.offsetParent);
    if (!nodes.length) return;
    nodes[0].focus();
    V3._trap = (e) => {
      if (e.key !== 'Tab') return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', V3._trap);
    V3._trapPanel = panel;
  }

  function releaseFocus() {
    if (V3._trapPanel && V3._trap) V3._trapPanel.removeEventListener('keydown', V3._trap);
    V3._trap = null;
    V3._trapPanel = null;
    if (V3.lastFocus && typeof V3.lastFocus.focus === 'function') {
      try { V3.lastFocus.focus(); } catch { /* ignore */ }
    }
    V3.lastFocus = null;
  }

  function adaptLegacyDrawer(opts) {
    const drawer = el('drawer');
    const panel = el('drawer-body');
    if (!drawer || !panel) return;
    if (V3._trap) panel.removeEventListener('keydown', V3._trap);
    drawer.classList.add('v3-ready');
    drawer.setAttribute('role', opts.modal ? 'dialog' : 'complementary');
    drawer.setAttribute('aria-modal', opts.modal ? 'true' : 'false');
    drawer.classList.toggle('v3-as-dialog', Boolean(opts.modal));
    drawer.classList.toggle('v3-as-drawer', !opts.modal);
    const closeBtns = panel.querySelectorAll('#drawer-cancel, .umodal-close');
    closeBtns.forEach((btn) => {
      if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', 'დახურვა');
      if (!btn.getAttribute('title')) btn.setAttribute('title', 'დახურვა');
    });
    if (opts.watchDirty !== false && panel.querySelector('input, select, textarea')) {
      setDirty(false);
      watchDirty(panel);
    } else {
      setDirty(false);
    }
    V3.lastFocus = document.activeElement;
    V3.overlayMode = opts.modal ? 'dialog' : 'drawer';
    trapFocus(panel);
  }

  async function requestCloseOverlay() {
    if (V3.confirmOpen) return false;
    const palette = el('ops-palette');
    if (palette) {
      palette.remove();
      return false;
    }
    if (el('v3-dialog') && V3.closeDialog) {
      return V3.closeDialog();
    }
    const drawer = el('drawer');
    if (!drawer || drawer.classList.contains('hidden')) return true;
    if (V3.dirty) {
      const ok = await confirmLeave();
      if (!ok) return false;
    }
    return true;
  }

  function openConfirm({ title, message, confirmLabel, cancelLabel, variant, pending, onConfirm, onCancel }) {
    const host = el('v3-confirm-root') || document.body;
    el('v3-confirm')?.remove();
    V3.confirmOpen = true;
    const tone = variant === 'danger' ? 'danger' : variant === 'warning' ? 'warn' : 'neutral';
    host.insertAdjacentHTML('beforeend', `
      <div id="v3-confirm" class="v3-overlay" role="dialog" aria-modal="true" aria-labelledby="v3-confirm-title">
        <div class="v3-scrim" id="v3-confirm-scrim"></div>
        <div class="v3-dialog-panel${variant === 'danger' ? ' is-danger' : ''}">
          <header class="v3-overlay-head">
            <div>
              <h3 id="v3-confirm-title">${esc(title || 'დადასტურება')}</h3>
              <p>${esc(message || '')}</p>
            </div>
          </header>
          <footer class="v3-overlay-foot">
            <button type="button" class="btn secondary" id="v3-confirm-cancel">${esc(cancelLabel || 'გაუქმება')}</button>
            <button type="button" class="btn ${tone === 'danger' ? 'danger' : 'primary'}" id="v3-confirm-ok">${esc(confirmLabel || 'დადასტურება')}</button>
          </footer>
        </div>
      </div>`);
    const finish = (ok) => {
      V3.confirmOpen = false;
      el('v3-confirm')?.remove();
      if (ok) onConfirm?.();
      else onCancel?.();
    };
    const onEsc = (e) => {
      if (e.key !== 'Escape' || !V3.confirmOpen) return;
      e.stopPropagation();
      wrapped(false);
    };
    const wrapped = (ok) => {
      document.removeEventListener('keydown', onEsc, true);
      finish(ok);
    };
    document.addEventListener('keydown', onEsc, true);
    el('v3-confirm-cancel').onclick = () => wrapped(false);
    el('v3-confirm-scrim').onclick = () => wrapped(false);
    el('v3-confirm-ok').onclick = async () => {
      const btn = el('v3-confirm-ok');
      if (pending || onConfirm) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }
      try {
        await onConfirm?.();
        document.removeEventListener('keydown', onEsc, true);
        V3.confirmOpen = false;
        el('v3-confirm')?.remove();
      } catch (err) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
        toast(err.message || 'შეცდომა', 'bad');
      }
    };
    el('v3-confirm-ok')?.focus();
  }

  function openDialog({
    title, description, body, footer, wide, watchDirty: dirtyWatch = true, onClose,
  } = {}) {
    el('v3-dialog')?.remove();
    V3.lastFocus = document.activeElement;
    V3.overlayMode = 'dialog';
    const host = el('v3-confirm-root') || document.body;
    host.insertAdjacentHTML('beforeend', `
      <div id="v3-dialog" class="v3-overlay" role="dialog" aria-modal="true" aria-labelledby="v3-dialog-title">
        <div class="v3-scrim" id="v3-dialog-scrim"></div>
        <div class="v3-dialog-panel${wide ? ' is-wide' : ''}">
          <header class="v3-overlay-head">
            <div>
              <h3 id="v3-dialog-title">${esc(title || '')}</h3>
              ${description ? `<p>${esc(description)}</p>` : ''}
            </div>
            ${iconButton({ id: 'v3-dialog-x', name: 'x', label: 'დახურვა' })}
          </header>
          <div class="v3-overlay-body">${body || ''}</div>
          ${footer ? `<footer class="v3-overlay-foot">${footer}</footer>` : ''}
        </div>
      </div>`);
    const panel = document.querySelector('#v3-dialog .v3-dialog-panel');
    if (dirtyWatch && panel?.querySelector('input, select, textarea')) {
      setDirty(false);
      watchDirty(panel);
    } else {
      setDirty(false);
    }
    trapFocus(panel);
    const close = async () => {
      if (V3.dirty) {
        const ok = await confirmLeave();
        if (!ok) return false;
      }
      el('v3-dialog')?.remove();
      V3.overlayMode = null;
      releaseFocus();
      onClose?.();
      return true;
    };
    el('v3-dialog-scrim').onclick = () => { void close(); };
    el('v3-dialog-x').onclick = () => { void close(); };
    V3.closeDialog = close;
    return { close };
  }

  async function runMutation({ action, pendingElement, successMessage, errorMessage, refresh }) {
    const btn = pendingElement;
    if (btn) {
      if (btn.disabled) return { ok: false, skipped: true };
      btn.disabled = true;
      btn.classList.add('is-loading');
    }
    try {
      const result = await action();
      if (successMessage) toast(successMessage, 'ok');
      if (typeof refresh === 'function') await refresh(result);
      return { ok: true, result };
    } catch (err) {
      toast(errorMessage || err.message || 'შეცდომა', 'bad');
      return { ok: false, error: err };
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    }
  }

  function loadGroupState() {
    try { return JSON.parse(localStorage.getItem(GROUP_KEY) || '{}'); } catch { return {}; }
  }

  function saveGroupState(map) {
    localStorage.setItem(GROUP_KEY, JSON.stringify(map));
  }

  function initSidebar() {
    const nav = document.querySelector('.v3-sidebar .sidebar-nav');
    if (!nav) return;
    const collapsed = loadGroupState();
    nav.querySelectorAll('[data-nav-group]').forEach((group) => {
      const id = group.getAttribute('data-nav-group');
      if (collapsed[id]) group.classList.add('is-collapsed');
      const toggle = group.querySelector('.v3-nav-group-toggle');
      if (!toggle) return;
      toggle.setAttribute('aria-expanded', collapsed[id] ? 'false' : 'true');
      toggle.addEventListener('click', () => {
        const next = !group.classList.contains('is-collapsed');
        group.classList.toggle('is-collapsed', next);
        toggle.setAttribute('aria-expanded', next ? 'false' : 'true');
        const map = loadGroupState();
        map[id] = next;
        saveGroupState(map);
      });
    });

    const compact = localStorage.getItem(COMPACT_KEY) === '1';
    document.body.classList.toggle('v3-sidebar-compact', compact);
    const compactBtn = el('sidebar-compact');
    if (compactBtn) {
      compactBtn.setAttribute('aria-pressed', compact ? 'true' : 'false');
      compactBtn.addEventListener('click', () => {
        const on = !document.body.classList.contains('v3-sidebar-compact');
        document.body.classList.toggle('v3-sidebar-compact', on);
        localStorage.setItem(COMPACT_KEY, on ? '1' : '0');
        compactBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        compactBtn.title = on ? 'გაშლილი მენიუ' : 'კომპაქტური მენიუ';
        compactBtn.setAttribute('aria-label', compactBtn.title);
      });
    }

    document.querySelectorAll('.v3-sidebar .nav').forEach((btn) => {
      if (!btn.title) btn.title = btn.querySelector('.nav-label')?.textContent || '';
    });
  }

  function revealNavTab(tab) {
    const btn = document.querySelector(`.v3-sidebar .nav[data-tab="${tab}"]`);
    const group = btn?.closest('[data-nav-group]');
    if (!group || !group.classList.contains('is-collapsed')) return;
    group.classList.remove('is-collapsed');
    const toggle = group.querySelector('.v3-nav-group-toggle');
    toggle?.setAttribute('aria-expanded', 'true');
    const map = loadGroupState();
    map[group.getAttribute('data-nav-group')] = false;
    saveGroupState(map);
  }

  function syncHeader(tab, copy) {
    const row = copy[tab];
    if (!row) return;
    const kicker = el('page-kicker');
    if (kicker) kicker.textContent = row[0] || '';
    const greet = el('page-greeting');
    const sub = el('page-subtitle');
    const mark = el('page-mark');
    const tabIcons = {
      overview: 'layout',
      users: 'users',
      orders: 'wallet',
      packages: 'layers',
      push: 'bell',
      sms: 'message',
      pharmacy: 'pill',
      rewards: 'gift',
      ai: 'spark',
      health: 'activity',
      quality: 'check',
      cycleqa: 'layers',
      audit: 'shield',
      settings: 'settings',
    };
    if (mark) mark.innerHTML = ico(tabIcons[tab] || 'layout');
    if (greet) {
      greet.textContent = row[1];
      const titleRow = greet.closest('.v3-page-title-row') || greet.closest('.topbar-copy') || greet.parentElement;
      titleRow?.querySelectorAll('[data-v3-help].v3-header-help').forEach((n) => n.remove());
      const helpKey = row[3];
      if (helpKey && titleRow) {
        const btn = document.createElement('span');
        btn.innerHTML = infoButton(helpKey);
        const node = btn.firstElementChild;
        if (node) {
          node.classList.add('v3-header-help');
          greet.insertAdjacentElement('afterend', node);
        }
      }
    }
    if (sub) sub.textContent = row[2];
    revealNavTab(tab);
  }

  function setHeaderActions(html) {
    const host = el('page-header-actions');
    if (host) host.innerHTML = html || '';
  }

  function enhanceA11y() {
    const theme = el('theme-toggle');
    if (theme && !theme.getAttribute('aria-label')) {
      const dark = document.documentElement.dataset.theme === 'dark';
      theme.setAttribute('aria-label', dark ? 'ღია თემა' : 'მუქი თემა');
    }
    const logoutBtn = el('logout');
    if (logoutBtn && !logoutBtn.getAttribute('aria-label')) {
      logoutBtn.setAttribute('aria-label', 'გასვლა');
      logoutBtn.setAttribute('title', 'გასვლა');
    }
  }

  function paletteSections() {
    return [
      { group: 'Overview', tab: 'overview', label: 'ოპერაციები' },
      { group: 'People', tab: 'users', label: 'მომხმარებლები' },
      { group: 'Engagement', tab: 'push', label: 'Push · Brain', hash: '#/push?tab=brain' },
      { group: 'Engagement', tab: 'push', label: 'Push · გაგზავნა', hash: '#/push?tab=compose' },
      { group: 'Health & Medi', tab: 'health', label: 'ჯანმრთელობა' },
      { group: 'Health & Medi', tab: 'ai', label: 'Medi' },
      { group: 'Commerce', tab: 'rewards', label: 'ჯილდოები' },
      { group: 'Commerce', tab: 'rewards', label: 'კამპანიები', hash: '#/rewards?tab=campaigns' },
      { group: 'Commerce', tab: 'rewards', label: 'პარტნიორები', hash: '#/rewards?tab=partners' },
      { group: 'Commerce', tab: 'packages', label: 'პაკეტები' },
      { group: 'Operations', tab: 'orders', label: 'შეკვეთები' },
      { group: 'Operations', tab: 'sms', label: 'SMS' },
      { group: 'Operations', tab: 'pharmacy', label: 'ფარმაცია' },
      { group: 'Production', tab: 'quality', label: 'ხარისხი' },
      { group: 'Production', tab: 'cycleqa', label: 'ფაზები' },
      { group: 'Production', tab: 'audit', label: 'აუდიტი' },
      { group: 'Production', tab: 'settings', label: 'რეჟიმი' },
      { group: 'Help', tab: 'overview', label: 'როგორ მუშაობს Admin', helpKey: 'global.howAdminWorks' },
    ];
  }

  function renderPaletteList(q) {
    const sections = paletteSections();
    const query = String(q || '').trim().toLowerCase();
    const filtered = query
      ? sections.filter((s) => `${s.label} ${s.group}`.toLowerCase().includes(query))
      : sections;
    let html = '';
    let last = '';
    filtered.forEach((s) => {
      if (s.group !== last) {
        html += `<div class="v3-palette-group">${esc(s.group)}</div>`;
        last = s.group;
      }
      const attrs = [
        s.tab ? `data-tab="${esc(s.tab)}"` : '',
        s.hash ? `data-hash="${esc(s.hash)}"` : '',
        s.helpKey ? `data-v3-help="${esc(s.helpKey)}"` : '',
      ].filter(Boolean).join(' ');
      html += `<button type="button" ${attrs}>${esc(s.label)}</button>`;
    });
    return html;
  }

  global.AdminV3 = {
    dirty: false,
    humanLabel,
    statusBadge,
    formatDate,
    copyIdButton,
    pageHeader,
    section,
    infoButton,
    openHelp,
    closeHelpPopover,
    renderHelpBody,
    toolbar,
    filterBar,
    tabs,
    bindTabs,
    input,
    field,
    emptyState,
    errorState,
    skeleton,
    dataTable,
    stickyActions,
    iconButton,
    toast,
    setDirty,
    watchDirty,
    confirmLeave,
    openConfirm,
    openDialog,
    runMutation,
    releaseFocus,
    adaptLegacyDrawer,
    requestCloseOverlay,
    initSidebar,
    syncHeader,
    setHeaderActions,
    enhanceA11y,
    paletteSections,
    renderPaletteList,
    statusTone,
  };

  function bindGlobalClicks() {
    document.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('[data-copy]');
      if (!copyBtn) return;
      try {
        await navigator.clipboard.writeText(copyBtn.getAttribute('data-copy') || '');
        toast("დაკოპირდა", 'ok');
      } catch {
        toast("კოპირება ვერ მოხერხდა", 'bad');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSidebar();
      enhanceA11y();
      bindGlobalClicks();
      bindHelpClicks();
    });
  } else {
    initSidebar();
    enhanceA11y();
    bindGlobalClicks();
    bindHelpClicks();
  }
})(window);
