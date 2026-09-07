/**
 * MediCard Admin V3 — Health features module wrap.
 * Loaded after ops-center.js + AdminV3Shell. Caps feature % at 100.
 */
(function adminV3Health(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const legacy = global.renderHealthOps;
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

  function capPercents(root) {
    if (!root) return;
    root.querySelectorAll('[style*="width"]').forEach((el) => {
      const style = el.getAttribute('style') || '';
      const next = style.replace(/width\s*:\s*(\d+(?:\.\d+)?)%/gi, (_, n) => {
        const v = Math.min(100, Math.max(0, Number(n)));
        return `width:${v}%`;
      });
      if (next !== style) el.setAttribute('style', next);
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.nodeValue;
      if (!text || !/%/.test(text)) return;
      const next = text.replace(/(\d+(?:\.\d+)?)\s*%/g, (full, n) => {
        const v = Number(n);
        if (!Number.isFinite(v) || v <= 100) return full;
        return `${Math.min(100, Math.round(v))}%`;
      });
      if (next !== text) node.nodeValue = next;
    });
  }

  function enhance(root) {
    const page = root.querySelector('.ops-page, .v3-health') || root.firstElementChild;
    if (page) page.classList.add('v3-workspace-wide', 'v3-module', 'v3-health');
    else root.classList.add('v3-workspace-wide', 'v3-module');

    const body = document.getElementById('health-body') || root;
    if (!body.querySelector('[data-v3-help="health.usage"]')) {
      injectHelp(body, 'health.usage', '[data-v3-health="usage"]');
      injectHelp(body, 'health.usage', '[data-v3-health="rank"]');
    }
    if (!body.querySelector('[data-v3-help="health.retention"]')) {
      injectHelp(body, 'health.retention', '[data-v3-health="retention"]');
    }
    capPercents(body);
  }

  global.renderHealthOps = async function renderHealthOpsV3() {
    const S = Shell();
    S.mountHeader?.({
      tab: 'health',
      kicker: 'Health & Medi',
      title: 'ჯანმრთელობის ფიჩერები',
      purpose: 'რომელი ჯანმრთელობის მოდულები გამოიყენება და ინახება — მხოლოდ ჯამები.',
      helpKey: 'health.page',
    });

    await legacy.call(global);

    const root = document.getElementById('tab-health');
    if (!root) return;
    enhance(root);
  };
})(window);
