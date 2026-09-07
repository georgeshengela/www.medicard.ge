/**
 * MediCard Admin V3 — Push & Brain module wrap.
 * Loaded after admin.js + ops-center.js + AdminV3Shell.
 * Brain-first subnav, URL ?tab= sync, funnel help icons.
 */
(function adminV3Push(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const ALLOWED = ['brain', 'compose', 'copy', 'engage', 'history', 'devices'];
  const TAB_LABELS = [
    ['brain', 'გადაწყვეტილებები'],
    ['compose', 'გაგზავნა'],
    ['copy', 'Medi ტექსტები'],
    ['engage', 'ჩართულობა'],
    ['history', 'ისტორია'],
    ['devices', 'მოწყობილობები'],
  ];

  const legacy = global.renderPush;
  if (typeof legacy !== 'function') return;

  function readTab() {
    const raw = (Shell().hashParams ? Shell().hashParams() : new URLSearchParams()).get('tab') || 'brain';
    return ALLOWED.includes(raw) ? raw : 'brain';
  }

  function setStudioTabVar(tab) {
    if (typeof global.setPushStudioTab === 'function') global.setPushStudioTab(tab);
    try {
      if (typeof pushStudioTab !== 'undefined') pushStudioTab = tab;
    } catch {
      /* ignore */
    }
    global.pushStudioTab = tab;
  }

  function injectHelp(host, key, selector) {
    if (!host || host.querySelector(`[data-v3-help="${key}"]`)) return;
    const infoHtml = V().infoButton?.(key);
    if (!infoHtml) return;
    const wrap = document.createElement('span');
    wrap.innerHTML = infoHtml;
    const btn = wrap.firstElementChild;
    if (!btn) return;
    const target = typeof selector === 'string' ? host.querySelector(selector) : selector;
    if (!target) return;
    const title = target.querySelector('.v3-title-row, .card-head > div, .card-head h3, h3');
    (title || target.querySelector('.card-head') || target).appendChild(btn);
  }

  function enhanceBrainHelp(host) {
    if (!host) return;
    // Help icons are baked into v3-brain heads; only backfill if missing.
    if (!host.querySelector('[data-v3-help="brain.funnel"]')) {
      const funnelCard = host.querySelector('[data-v3-brain="funnel"], .v25-dec-funnel-card');
      if (funnelCard) injectHelp(host, 'brain.funnel', funnelCard);
    }
    if (!host.querySelector('[data-v3-help="brain.suppression"]')) {
      const suppress = host.querySelector('[data-v3-brain="suppress"]')
        || Array.from(host.querySelectorAll('.v25-panel')).find((el) =>
          /არ გაგზავნა|დაბლოკ/.test(el.querySelector('h3')?.textContent || ''));
      if (suppress) injectHelp(host, 'brain.suppression', suppress);
    }
    if (!host.querySelector('[data-v3-help="brain.decisions"]')) {
      injectHelp(host, 'brain.decisions', '[data-v3-brain="decisions"], .v25-dec-log');
    }
  }

  function showPanel(tab) {
    document.querySelectorAll('#tab-push [data-push-panel]').forEach((panel) => {
      const on = panel.dataset.pushPanel === tab;
      panel.classList.toggle('hidden', !on);
      panel.toggleAttribute('hidden', !on);
      if (on) {
        panel.removeAttribute('inert');
        panel.removeAttribute('aria-hidden');
      } else {
        panel.setAttribute('inert', '');
        panel.setAttribute('aria-hidden', 'true');
      }
    });
    document.querySelectorAll('#tab-push [data-v3-sub]').forEach((btn) => {
      const on = btn.getAttribute('data-v3-sub') === tab;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
    });
  }

  function selectTab(tab) {
    if (!ALLOWED.includes(tab)) tab = 'brain';
    setStudioTabVar(tab);
    Shell().writeModuleHash?.('push', { tab });
    showPanel(tab);
    if (tab === 'compose') $('push-title')?.focus();
    if (tab === 'brain' && typeof global.renderPushBrainPanel === 'function') {
      const host = $('push-brain-host');
      Promise.resolve(global.renderPushBrainPanel(host)).then(() => enhanceBrainHelp(host));
    }
  }

  function rebuildSubnav(active) {
    const root = $('tab-push');
    if (!root) return;
    const board = root.querySelector('.push-board') || root.querySelector('.push-studio');
    if (!board) return;

    let navHost = root.querySelector('.v3-push-subnav-host');
    if (!navHost) {
      navHost = document.createElement('div');
      navHost.className = 'v3-push-subnav-host';
      const oldNav = root.querySelector('.push-tabs');
      if (oldNav) oldNav.replaceWith(navHost);
      else board.insertBefore(navHost, board.firstChild);
    }

    const S = Shell();
    navHost.innerHTML = S.subnav
      ? S.subnav(TAB_LABELS, active, 'data-v3-sub')
      : TAB_LABELS.map(([key, label]) =>
        `<button type="button" data-v3-sub="${key}" class="${key === active ? 'is-active' : ''}">${label}</button>`).join('');

    if (S.bindSubnav) S.bindSubnav(navHost, 'data-v3-sub', (key) => selectTab(key));
    else {
      navHost.querySelectorAll('[data-v3-sub]').forEach((btn) => {
        btn.addEventListener('click', () => selectTab(btn.getAttribute('data-v3-sub')));
      });
    }

    root.querySelectorAll('[data-push-tab]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        selectTab(btn.dataset.pushTab);
      };
    });
  }

  function wrapWorkspace() {
    const root = $('tab-push');
    if (!root) return;
    const studio = root.querySelector('.push-studio');
    if (!studio || studio.closest('.v3-workspace-wide')) return;
    const wrap = document.createElement('div');
    wrap.className = 'v3-workspace-wide v3-module';
    studio.parentNode.insertBefore(wrap, studio);
    wrap.appendChild(studio);
    studio.classList.add('v3-push');
  }

  function moveBrainPanelFirst() {
    const board = document.querySelector('#tab-push .push-board');
    if (!board) return;
    const brain = board.querySelector('[data-push-panel="brain"]');
    const firstPanel = board.querySelector('[data-push-panel]');
    if (brain && firstPanel && brain !== firstPanel) {
      board.insertBefore(brain, firstPanel);
    }
  }

  function restyleKpis() {
    const root = $('tab-push');
    const strip = root?.querySelector('.v25-push-kpis');
    if (!strip || strip.dataset.v3Restyled) return;
    strip.dataset.v3Restyled = '1';
    strip.classList.add('v3-critical-strip');
    strip.querySelectorAll('.v25-push-kpi').forEach((card) => {
      card.classList.add('v3-critical-item');
    });
  }

  function unifyCompose() {
    const root = $('tab-push');
    if (!root) return;
    const grid = root.querySelector('.push-compose-grid');
    if (grid) {
      grid.classList.add('v3-compose-split', 'v3-split');
    }
    const form = root.querySelector('.push-compose-form');
    if (form) form.classList.add('v3-panel');

    const title = $('push-title');
    const body = $('push-body');
    const syncSummary = () => {
      const segBtn = root.querySelector('.push-seg.active, .push-seg[aria-pressed="true"]');
      const segLabel = segBtn?.querySelector('strong')?.textContent || $('push-segment')?.selectedOptions?.[0]?.textContent || '—';
      const reach = segBtn?.querySelector('span')?.textContent || '';
      const tEl = $('push-summary-seg');
      const rEl = $('push-summary-reach');
      const tl = $('push-summary-title-len');
      const bl = $('push-summary-body-len');
      if (tEl) tEl.textContent = segLabel;
      if (rEl) rEl.textContent = reach || '—';
      if (tl) tl.textContent = `${(title?.value || '').length} / 120`;
      if (bl) bl.textContent = `${(body?.value || '').length} / 500`;
    };
    if (!root.dataset.v3ComposeBound) {
      root.dataset.v3ComposeBound = '1';
      title?.addEventListener('input', syncSummary);
      body?.addEventListener('input', syncSummary);
      root.querySelectorAll('.push-seg').forEach((btn) => {
        btn.addEventListener('click', () => setTimeout(syncSummary, 0));
      });
    }
    syncSummary();
  }

  function enhanceAfterLegacy(tab) {
    wrapWorkspace();
    restyleKpis();
    unifyCompose();
    moveBrainPanelFirst();
    rebuildSubnav(tab);
    showPanel(tab);
    if (tab === 'brain') {
      const host = $('push-brain-host');
      if (host && !host.querySelector('.ops-brain, .v25-brain, .v3-brain')) {
        if (typeof global.renderPushBrainPanel === 'function') {
          Promise.resolve(global.renderPushBrainPanel(host)).then(() => enhanceBrainHelp(host));
        }
      } else {
        enhanceBrainHelp(host);
      }
    }
  }

  function wrapBrainRenderer() {
    const current = global.renderPushBrainPanel;
    if (typeof current !== 'function' || current._v3Wrapped) return;
    const base = current;
    async function renderPushBrainPanelV3(host) {
      const result = await base(host);
      enhanceBrainHelp(host || $('push-brain-host'));
      return result;
    }
    renderPushBrainPanelV3._v3Wrapped = true;
    global.renderPushBrainPanel = renderPushBrainPanelV3;
  }

  wrapBrainRenderer();

  global.renderPush = async function renderPushV3() {
    wrapBrainRenderer();
    const tab = readTab();
    setStudioTabVar(tab);
    Shell().writeModuleHash?.('push', { tab });

    Shell().mountHeader?.({
      tab: 'push',
      kicker: 'Engagement',
      title: 'Push & Brain',
      purpose: 'შეტყობინებები ფასდება, იგეგმება და მიეწოდება — Brain პირველია.',
      helpKey: 'push.page',
    });

    await legacy.call(global);
    enhanceAfterLegacy(tab);
  };
})(window);
