/**
 * MediCard Admin V4 — page tabs for pages that had a work surface before their usage analysis (owner 2026-10-11:
 * every module gets the MEDIVET-style „who uses it and how“ page). The analysis opens first; the old page is the
 * second tab and keeps working as before. Loaded after the module scripts; admin.js switchTab calls these hosts.
 */
(function adminUsageHosts(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const call = (name) => () => global[name]?.();

  // Sidebar glyphs of the new module pages (one distinct shape per page).
  K.glyphs({
    cycle: '<path d="M20 12a8 8 0 1 1-4.2-7"/><path d="M15.6 2.6 16 5.2l-2.6.6"/><circle cx="12" cy="12" r="2.6"/>',
    capsule: '<rect x="2.8" y="8.3" width="18.4" height="7.4" rx="3.7" transform="rotate(-38 12 12)"/><path d="m9.4 8.6 5.2 6.8"/>',
    microscope: '<path d="M6 21h12"/><path d="M8 18h6"/><path d="M14.5 18a5.5 5.5 0 0 0 1.6-9.6"/><path d="m9.2 13.3-2-1.2 4.4-7.6 2 1.2z"/><path d="m11.4 4.6.9-1.6 2 1.2-.9 1.6"/><path d="M9 14.5a2 2 0 1 0 2 2"/>',
  });

  global.renderNutritionHost = K.hostTabs({
    tab: 'nutrition',
    label: 'MEDIFOOD-ის განყოფილებები',
    panes: [['usage', 'ვინ იყენებს და როგორ', call('renderFoodUsage'), 'page'], ['manage', 'კერძები და პარამეტრები', call('renderNutrition'), 'legacy']],
  });
  global.renderQuestsHost = K.hostTabs({
    tab: 'quests',
    label: 'MEDIQUEST-ის განყოფილებები',
    panes: [['usage', 'ვინ იყენებს და როგორ', call('renderQuestUsage'), 'page'], ['manage', 'მისიები', call('renderQuests'), 'legacy']],
  });
  global.renderTrainersHost = K.hostTabs({
    tab: 'trainers',
    label: 'MEDICOACH-ის განყოფილებები',
    panes: [['usage', 'ვინ იყენებს და როგორ', call('renderCoachUsage'), 'page'], ['manage', 'განაცხადები და დარბაზები', call('renderTrainersAdmin'), 'legacy']],
  });
  global.renderAiHost = K.hostTabs({
    tab: 'ai',
    label: 'Medi-ს განყოფილებები',
    panes: [['usage', 'ვინ იყენებს და როგორ', call('renderMediUsage'), 'page'], ['quality', 'ხარისხი და ჟურნალი', call('renderAi'), 'legacy']],
  });
})(window);
