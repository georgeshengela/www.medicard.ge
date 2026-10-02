/**
 * MediCard Admin V3 — Medi (AI) module wrap.
 * Loaded after admin.js + AdminV3Shell: sets the page header, then renders the page (admin.js renderAi).
 */
(function adminV3Medi(global) {
  const Shell = () => global.AdminV3Shell || {};
  const legacy = global.renderAi;
  if (typeof legacy !== 'function') return;

  global.renderAi = async function renderAiV3() {
    Shell().mountHeader?.({
      tab: 'ai',
      kicker: 'Health & Medi',
      title: 'Medi',
      purpose: 'Medi-ს გამოყენება, შეცდომები, სიჩქარე და პასუხების ხარისხი.',
      helpKey: 'medi.page',
    });
    await legacy.call(global);
  };
})(window);
