/**
 * MediCard Admin V4 — exact links (owner 2026-10-11: „ყველა ნოტიფიკაცია ზუსტად უნდა გადადიოდეს იმ ადგილზე, სადაც საჭიროა“).
 * `AdminFocus.go('#/medipulsi?tab=claims&focus=<id>')` opens the page fresh on that tab/pane; the page takes its
 * params once with `AdminFocus.take(tab)` and `AdminFocus.flash(root, id)` scrolls to the `[data-focus="<id>"]`
 * element and lights it up. Params: `focus` (row / card id), `pane` (page tabs of usageHosts.js), plus the page's
 * own (`tab`, `status`, `section`, `thread`…). Pages that read their params from the hash (support, rewards) keep them.
 */
(function adminFocus(global) {
  const doc = document;
  const pending = new Map();
  /** The last hash whose params were used (so a re-render does not jump again). */
  let hashTaken = '';
  const HOSTS = { nutrition: 'renderNutritionHost', quests: 'renderQuestsHost', trainers: 'renderTrainersHost', ai: 'renderAiHost' };

  function parse(href) {
    const [path, query = ''] = String(href || '').replace(/^#\/?/, '').split('?');
    return { tab: path.split('/')[0], path, params: new URLSearchParams(query) };
  }

  /** Navigate to an exact place. The target page is rendered again even when it is already open. */
  function go(href) {
    const { tab, params } = parse(href);
    const panel = doc.getElementById(`tab-${tab}`);
    if (!tab || !panel || tab === 'users') {
      location.hash = href;
      return;
    }
    pending.set(tab, params);
    hashTaken = href.startsWith('#') ? href : `#${href}`;
    global[HOSTS[tab]]?.prefer?.(params.get('pane') || 'usage');
    panel.innerHTML = '';
    const current = typeof state === 'object' && state ? state.tab : null;
    if (current !== tab) location.hash = href;
    else {
      history.replaceState({ tab }, '', href);
      if (typeof global.switchTab === 'function') void global.switchTab(tab, { skipHash: true });
    }
    // Medi: the question and answer open in the log's drawer, whatever pane is showing.
    if (tab === 'ai' && params.get('focus') && typeof global.viewAiInteraction === 'function') {
      pending.delete(tab);
      setTimeout(() => void global.viewAiInteraction(params.get('focus')), 0);
    }
  }

  /**
   * The params `go` left for this page — once. A link opened in a new browser tab (or pasted) has no pending
   * entry: its own hash is read instead, once per hash.
   */
  function take(tab) {
    const p = pending.get(tab) || null;
    pending.delete(tab);
    if (p) return p;
    const here = parse(location.hash);
    if (here.tab !== tab || !here.params.get('focus') || location.hash === hashTaken) return null;
    hashTaken = location.hash;
    return here.params;
  }

  const peek = (tab) => pending.get(tab) || null;

  /** Scroll to `[data-focus="id"]` inside root and light it up for a few seconds. */
  function flash(root, id) {
    if (!root || !id) return false;
    const el = root.querySelector(`[data-focus="${CSS.escape(String(id))}"]`);
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.classList.remove('is-focus');
    void el.offsetWidth;
    el.classList.add('is-focus');
    setTimeout(() => el.classList.remove('is-focus'), 4200);
    return true;
  }

  global.AdminFocus = { go, take, peek, flash, parse };
})(window);
