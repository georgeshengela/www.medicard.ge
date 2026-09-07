/**
 * MediCard Admin V3 — shared module shell helpers.
 * Loaded after admin-v3.js. Modules call AdminV3Shell.mount(...)
 */
(function adminV3Shell(global) {
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  function hashParams() {
    return typeof hashSearch === 'function' ? hashSearch() : new URLSearchParams(location.hash.split('?')[1] || '');
  }

  function writeModuleHash(tab, updates = {}) {
    const params = hashParams();
    Object.entries(updates).forEach(([k, v]) => {
      if (v == null || v === '') params.delete(k);
      else params.set(k, String(v));
    });
    if (typeof writeTabHash === 'function') writeTabHash(tab, params);
    else {
      const qs = params.toString();
      const next = qs ? `#/${tab}?${qs}` : `#/${tab}`;
      if (location.hash !== next) history.replaceState({ tab }, '', next);
    }
  }

  function mountHeader({ tab, kicker, title, purpose, helpKey, actionsHtml }) {
    if (typeof setPageHeader === 'function') {
      setPageHeader(tab, {
        [tab]: [kicker || '', title || '', purpose || '', helpKey || ''],
      });
    } else {
      V().syncHeader?.(tab, { [tab]: [kicker, title, purpose, helpKey] });
    }
    V().setHeaderActions?.(actionsHtml || '');
  }

  function workspace(inner, extraClass = '') {
    return `<div class="v3-workspace-wide v3-module ${extraClass}">${inner}</div>`;
  }

  function subnav(items, active, attr = 'data-v3-sub') {
    return `<nav class="v3-subnav" role="tablist">${items.map(([key, label]) => `
      <button type="button" class="v3-subnav-btn${key === active ? ' is-active' : ''}" role="tab"
        aria-selected="${key === active}" ${attr}="${key}">${label}</button>`).join('')}</nav>`;
  }

  function bindSubnav(root, attr, onChange) {
    root.querySelectorAll(`[${attr}]`).forEach((btn) => {
      btn.addEventListener('click', () => onChange(btn.getAttribute(attr)));
    });
  }

  function criticalStrip(items) {
    if (!items?.length) return '';
    return `<div class="v3-critical-strip">${items.map((it) => `
      <div class="v3-critical-item is-${it.tone || 'neutral'}">
        <span>${it.label}</span>
        <strong>${it.value}</strong>
        ${it.hint ? `<em>${it.hint}</em>` : ''}
      </div>`).join('')}</div>`;
  }

  global.AdminV3Shell = {
    hashParams,
    writeModuleHash,
    mountHeader,
    workspace,
    subnav,
    bindSubnav,
    criticalStrip,
    $,
    V,
  };
})(window);
