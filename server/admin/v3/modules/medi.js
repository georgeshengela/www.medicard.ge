/**
 * MediCard Admin V3 — Medi (AI) module wrap.
 * Loaded after admin.js + AdminV3Shell. Caps displayed shares at 100%.
 */
(function adminV3Medi(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const legacy = global.renderAi;
  if (typeof legacy !== 'function') return;

  function injectHelp(root, key, selector) {
    if (!root || root.querySelector(`[data-v3-help="${key}"]`)) return;
    const infoHtml = V().infoButton?.(key);
    if (!infoHtml) return;
    const wrap = document.createElement('span');
    wrap.innerHTML = infoHtml;
    const btn = wrap.firstElementChild;
    if (!btn) return;
    const host = typeof selector === 'string' ? root.querySelector(selector) : selector;
    if (!host) return;
    const title = host.querySelector('.v3-title-row, .card-head > div, .card-head h3, h3');
    (title || host.querySelector('.card-head') || host).appendChild(btn);
  }

  function capShares(root) {
    if (!root) return;
    root.querySelectorAll('[style*="width"]').forEach((el) => {
      const style = el.getAttribute('style') || '';
      const next = style.replace(/width\s*:\s*(\d+(?:\.\d+)?)%/gi, (_, n) => {
        const v = Math.min(100, Math.max(0, Number(n)));
        return `width:${v}%`;
      });
      if (next !== style) el.setAttribute('style', next);
    });
  }

  function enhance(root) {
    const page = root.querySelector('.ai-page, .v3-medi') || root.firstElementChild;
    if (page) page.classList.add('v3-workspace-wide', 'v3-module', 'v3-medi');
    else root.classList.add('v3-workspace-wide', 'v3-module');

    const body = document.getElementById('medi-body') || root;
    if (!body.querySelector('[data-v3-help="medi.errors"]')) {
      injectHelp(body, 'medi.errors', '[data-v3-medi="usage"]');
    }
    if (!body.querySelector('[data-v3-help="medi.interactions"]')) {
      injectHelp(body, 'medi.interactions', '[data-v3-medi="interactions"]');
    }
    if (!body.querySelector('[data-v3-help="medi.quality"]')) {
      injectHelp(body, 'medi.quality', '[data-v3-medi="quality"]');
    }
    capShares(body);
  }

  global.renderAi = async function renderAiV3() {
    const S = Shell();
    S.mountHeader?.({
      tab: 'ai',
      kicker: 'Health & Medi',
      title: 'Medi',
      purpose: 'მუშაობს თუ არა Medi საიმედოდ — შეცდომები, ინტერაქციები და ხარისხის სკანი.',
      helpKey: 'medi.page',
    });

    await legacy.call(global);

    const root = document.getElementById('tab-ai');
    if (!root) return;
    enhance(root);
  };
})(window);
