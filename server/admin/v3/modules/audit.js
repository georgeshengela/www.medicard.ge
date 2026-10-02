/**
 * MediCard Admin V3 — Audit journal (full override of renderAuditLog).
 * Search + action filter + pagination over /api/admin/audit. URL range/grain are unused by audit APIs.
 * Owns the Georgian vocabulary for audit actions, objects and fields; window.AdminAuditLabels shares it
 * with the activity sheet (v4/experience.js).
 */
(function adminV3Audit(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  // Every action the server writes (writeAdminAudit in server/src), grouped by area for the filter.
  // Labels read "<object> · <what happened>", the object named exactly as TARGET_KA names it.
  const ACTION_GROUPS = [
    ['მომხმარებლები', [
      ['user.status', 'მომხმარებელი · სტატუსის შეცვლა'],
      ['user.gender', 'მომხმარებელი · სქესის შეცვლა'],
      ['user.export', 'მომხმარებელი · მონაცემების ექსპორტი'],
      ['coins.grant', 'მომხმარებელი · Medi Coins-ის დარიცხვა'],
      ['coins.revoke', 'მომხმარებელი · Medi Coins-ის ჩამოჭრა'],
    ]],
    ['აპი და მოდულები', [
      ['settings.update', 'აპის პარამეტრები · შეცვლა'],
      ['feature.toggle', 'მოდული · ჩართვა / გამორთვა'],
      ['quest.template.update', 'Medi Quest შაბლონი · შეცვლა'],
      ['capacity.test_alert', 'სისტემა · სატესტო გაფრთხილება'],
    ]],
    ['Push', [
      ['push.template.save', 'Push შაბლონი · შენახვა'],
      ['push.template.reset', 'Push შაბლონი · ნაგულისხმევზე დაბრუნება'],
    ]],
    ['სიახლეები', [
      ['announcement.create', 'სიახლე · შექმნა'],
      ['announcement.update', 'სიახლე · რედაქტირება'],
      ['announcement.publish', 'სიახლე · გამოქვეყნება'],
      ['announcement.unpublish', 'სიახლე · გამოქვეყნების მოხსნა'],
      ['announcement.archive', 'სიახლე · არქივში გადატანა'],
      ['announcement.restore', 'სიახლე · არქივიდან დაბრუნება'],
    ]],
    ['ელფოსტა', [
      ['email.template.update', 'ელფოსტის შაბლონი · შეცვლა'],
      ['email.template.toggle', 'ელფოსტის შაბლონი · ჩართვა / გამორთვა'],
      ['email.template.reset', 'ელფოსტის შაბლონი · ნაგულისხმევზე დაბრუნება'],
      ['email.template.test', 'ელფოსტის შაბლონი · სატესტო წერილი'],
      ['email.campaign.create', 'ელფოსტის კამპანია · შექმნა'],
      ['email.campaign.update', 'ელფოსტის კამპანია · შეცვლა'],
      ['email.campaign.test', 'ელფოსტის კამპანია · სატესტო წერილი'],
      ['email.campaign.queue', 'ელფოსტის კამპანია · გაშვება'],
      ['email.campaign.cancel', 'ელფოსტის კამპანია · გაუქმება'],
      ['email.suppression.remove', 'დაბლოკილი მისამართი · ბლოკის მოხსნა'],
    ]],
    ['მხარდაჭერა', [
      ['support.reply', 'მხარდაჭერის საუბარი · პასუხი'],
      ['support.note', 'მხარდაჭერის საუბარი · შიდა შენიშვნა'],
      ['support.thread.status', 'მხარდაჭერის საუბარი · სტატუსის შეცვლა'],
      ['support.thread.assign', 'მხარდაჭერის საუბარი · პასუხისმგებლის შეცვლა'],
      ['support.attachment.download', 'მხარდაჭერის საუბარი · დანართის ჩამოტვირთვა'],
      ['support.snippet.create', 'სწრაფი პასუხი · შექმნა'],
      ['support.snippet.update', 'სწრაფი პასუხი · შეცვლა'],
      ['support.snippet.delete', 'სწრაფი პასუხი · წაშლა'],
    ]],
    ['დირექტორი', [
      ['director.shift_on', 'დირექტორი · ცვლის ჩართვა'],
      ['director.shift_off', 'დირექტორი · ცვლის გამორთვა'],
      ['director.telegram_pair', 'დირექტორი · Telegram-ის დაკავშირება'],
      ['director.telegram_unpair', 'დირექტორი · Telegram-ის გათიშვა'],
      ['director.telegram_webhook', 'დირექტორი · Telegram-ის კავშირის განახლება'],
      ['director.approve', 'დირექტორის წინადადება · დადასტურება'],
      ['director.reject', 'დირექტორის წინადადება · უარყოფა'],
    ]],
    ['ჯილდოები', [
      ['PARTNER_CREATED', 'პარტნიორი · შექმნა'],
      ['PARTNER_UPDATED', 'პარტნიორი · განახლება'],
      ['REWARD_DEFINITION_CREATED', 'ჯილდო · შექმნა'],
      ['INVENTORY_ADJUSTED', 'ჯილდო · მარაგის კორექტირება'],
      ['CODE_POOL_IMPORTED', 'ჯილდო · კოდების იმპორტი'],
      ['CODE_DISABLED', 'ჯილდოს კოდი · გამორთვა'],
      ['CAMPAIGN_CREATED', 'ჯილდოს კამპანია · შექმნა'],
      ['CAMPAIGN_UPDATED', 'ჯილდოს კამპანია · განახლება'],
      ['CAMPAIGN_ACTIVATED', 'ჯილდოს კამპანია · გააქტიურება'],
      ['CAMPAIGN_PAUSED', 'ჯილდოს კამპანია · შეჩერება'],
      ['REDEMPTION_STATUS_CHANGED', 'ჯილდოს გაცვლა · სტატუსის შეცვლა'],
    ]],
    ['ტრენერები', [
      ['TRAINER_APPROVE', 'ტრენერი · დადასტურება'],
      ['TRAINER_REJECT', 'ტრენერი · უარყოფა'],
      ['TRAINER_SUSPEND', 'ტრენერი · შეჩერება'],
      ['TRAINER_RESTORE', 'ტრენერი · აღდგენა'],
      ['COACH_REPORT_RESOLVE', 'MEDI COACH შეტყობინება · განხილვა'],
      ['GYM_ADD', 'დარბაზი · დამატება'],
      ['GYM_UPDATE', 'დარბაზი · შეცვლა'],
    ]],
    ['კვება', [
      ['NUTRITION_SETTINGS', 'კვების პარამეტრები · შეცვლა'],
      ['NUTRITION_RECIPE', 'რეცეპტი · შენახვა'],
    ]],
  ];
  // Names that only older rows carry; they get a label but are not offered in the filter.
  const LEGACY_ACTIONS = {
    CAMPAIGN_STATUS_CHANGED: 'ჯილდოს კამპანია · სტატუსის შეცვლა',
    CODE_IMPORTED: 'ჯილდო · კოდების იმპორტი',
  };
  const ACTION_KA = { ...LEGACY_ACTIONS, ...Object.fromEntries(ACTION_GROUPS.flatMap(([, items]) => items)) };

  const TARGET_KA = {
    user: 'მომხმარებელი',
    settings: 'აპის პარამეტრები',
    featureFlag: 'მოდული',
    questTemplate: 'Medi Quest შაბლონი',
    system: 'სისტემა',
    pushTemplate: 'Push შაბლონი',
    announcement: 'სიახლე',
    emailTemplate: 'ელფოსტის შაბლონი',
    emailCampaign: 'ელფოსტის კამპანია',
    emailSuppression: 'დაბლოკილი მისამართი',
    supportThread: 'მხარდაჭერის საუბარი',
    supportSnippet: 'სწრაფი პასუხი',
    director: 'დირექტორი',
    director_proposal: 'დირექტორის წინადადება',
    rewardPartner: 'პარტნიორი',
    rewardDefinition: 'ჯილდო',
    rewardCampaign: 'ჯილდოს კამპანია',
    rewardCode: 'ჯილდოს კოდი',
    rewardRedemption: 'ჯილდოს გაცვლა',
    TrainerProfile: 'ტრენერი',
    CoachReport: 'MEDI COACH შეტყობინება',
    Gym: 'დარბაზი',
    NutritionSettings: 'კვების პარამეტრები',
    NutritionRecipe: 'რეცეპტი',
  };
  // The admin page where each kind of object lives (the link in the details dialog).
  const PAGES = {
    settings: ['#/settings', 'აპის რეჟიმი'], features: ['#/features', 'მოდულები'], quests: ['#/quests', 'Medi Quest'],
    capacity: ['#/capacity', 'სერვერის დატვირთვა'], push: ['#/push', 'Push & Brain'], news: ['#/news', 'სიახლეები'],
    email: ['#/email', 'ელფოსტა'], support: ['#/support', 'მხარდაჭერა'], director: ['#/director', 'დირექტორი'],
    rewards: ['#/rewards', 'ჯილდოები'], trainers: ['#/trainers', 'ტრენერები'], nutrition: ['#/nutrition', 'კვების დღიური'],
  };
  const TARGET_PAGE = {
    settings: 'settings', featureFlag: 'features', questTemplate: 'quests', system: 'capacity', pushTemplate: 'push',
    announcement: 'news', emailTemplate: 'email', emailCampaign: 'email', emailSuppression: 'email',
    supportThread: 'support', supportSnippet: 'support', director: 'director', director_proposal: 'director',
    rewardPartner: 'rewards', rewardDefinition: 'rewards', rewardCampaign: 'rewards', rewardCode: 'rewards', rewardRedemption: 'rewards',
    TrainerProfile: 'trainers', CoachReport: 'trainers', Gym: 'trainers', NutritionSettings: 'nutrition', NutritionRecipe: 'nutrition',
  };
  const FEATURE_KA = {
    cycle: 'ციკლი და ორსულობა', nutrition: 'კვების დღიური', nutritionAi: 'კვების AI შეფასება', medi: 'Medi', pets: 'ჩემი ცხოველები',
    mediVet: 'Medi Vet', medirun: 'MEDIRUN', medirunAutopilot: 'MEDIRUN ავტოპილოტი', quest: 'MEDI QUEST', rewardsStore: 'ჯილდოების გაცვლა',
    coach: 'MEDI COACH', community: 'ქალების სივრცე', pharmacy: 'აფთიაქი', news: 'სიახლეები', referralRewards: 'მოწვევის ჯილდოები', email: 'ელფოსტა',
  };
  const EMAIL_TEMPLATE_KA = { welcome: 'მისალმება', password_reset: 'პაროლის აღდგენა', account_deleted: 'ანგარიშის წაშლა' };
  // Objects with one fixed id: the id says nothing, a name does.
  const SINGLETON_KA = { 'settings:default': 'ზოგადი', 'system:capacity': 'სერვერის დატვირთვა', 'director:shift': 'ცვლა', 'director:telegram': 'Telegram', 'NutritionSettings:main': 'ზოგადი' };

  const FIELD_KA = {
    status: 'სტატუსი', enabled: 'ჩართულია', message: 'შეტყობინება', title: 'სათაური', body: 'ტექსტი', subject: 'თემა',
    preheader: 'წინასიტყვა', heading: 'სათაური წერილში', ctaLabel: 'ღილაკის ტექსტი', ctaUrl: 'ღილაკის ბმული', ctaKind: 'ღილაკის ტიპი',
    ctaTarget: 'ღილაკის მისამართი', audience: 'აუდიტორია', gender: 'სქესი', platform: 'პლატფორმა', priority: 'რიგი',
    startsAt: 'დაწყება', endsAt: 'დასრულება', maintenanceMode: 'ტექნიკური რეჟიმი', maintenanceMessage: 'ტექნიკური რეჟიმის ტექსტი',
    forceUpdate: 'იძულებითი განახლება', allowRegistrations: 'რეგისტრაცია ღიაა', minAppVersion: 'მინიმალური ვერსია',
    qaOtpEnabled: 'სატესტო SMS კოდი', supportEmail: 'მხარდაჭერის ელფოსტა', coins: 'ბალანსი (coin)', amount: 'რაოდენობა',
    reason: 'მიზეზი', note: 'შენიშვნა', approvedByOwner: 'მფლობელმა დაადასტურა', chars: 'ტექსტის სიგრძე', defaultTarget: 'სამიზნე',
    target: 'სამიზნე', rewardXp: 'XP ჯილდო', rewardCoins: 'Coin ჯილდო', isActive: 'აქტიურია', active: 'აქტიურია',
    inventoryQuantity: 'მარაგი', delta: 'ცვლილება', sent: 'გაიგზავნა', channel: 'არხი', photoEnabled: 'ფოტოთი შეფასება',
    programEnabled: 'კვების პროგრამა', name: 'სახელი', brand: 'ბრენდი', brandKa: 'ბრენდი (ქართულად)', city: 'ქალაქი',
    district: 'უბანი', address: 'მისამართი', imported: 'იმპორტირდა', accepted: 'მიღებულია', duplicates: 'გამეორებული',
    invalid: 'არასწორი', expiredRejected: 'ვადაგასული', total: 'სულ', exportedAt: 'ექსპორტის დრო', noteId: 'შენიშვნა',
    removed: 'მოხსნილია', reset: 'ნაგულისხმევზე დაბრუნდა', id: 'ID', key: 'გასაღები', type: 'ტიპი', kind: 'ტიპი',
    displayName: 'სახელი', legalName: 'იურიდიული სახელი', category: 'კატეგორია', website: 'ვებგვერდი', countryCode: 'ქვეყანა',
    lowStockThreshold: 'მცირე მარაგის ზღვარი', costCoins: 'ფასი (coin)', coinCost: 'ფასი (coin)', partnerId: 'პარტნიორი',
    codeMasked: 'კოდი', segment: 'სეგმენტი', targetCount: 'მიმღები', sentCount: 'გაგზავნილი', toHash: 'მიმღები (დაშიფრული)',
    url: 'მისამართი', messageId: 'წერილი', attachmentId: 'დანართი', assignedAdminId: 'პასუხისმგებელი ადმინი',
    unread: 'წაუკითხავი', data: 'მონაცემები', result: 'შედეგი', delivered: 'მიწოდებულია',
  };
  const VALUE_KA = {
    ACTIVE: 'აქტიური', BLOCKED: 'დაბლოკილი', PENDING: 'მოლოდინში', DRAFT: 'მონახაზი', PUBLISHED: 'გამოქვეყნებული',
    ARCHIVED: 'არქივში', SCHEDULED: 'დაგეგმილი', ENDED: 'დასრულებული', PAUSED: 'შეჩერებული', VERIFIED: 'დადასტურებული',
    REJECTED: 'უარყოფილი', SUSPENDED: 'შეჩერებული', FULFILLED: 'შესრულებული', USED: 'გამოყენებული', ISSUED: 'გაცემული',
    EXPIRED: 'ვადაგასული', CANCELLED: 'გაუქმებული', CANCELED: 'გაუქმებული', OPEN: 'ღია', CLOSED: 'დახურული',
    AVAILABLE: 'ხელმისაწვდომი', RESERVED: 'დაჯავშნილი', DISABLED: 'გამორთული', HIDDEN: 'დამალული', PROPOSED: 'შემოთავაზებული',
    QUEUED: 'რიგში', SENDING: 'იგზავნება', SENT: 'გაგზავნილი', FAILED: 'ჩაიშალა', DONE: 'დასრულებული',
    MALE: 'კაცი', FEMALE: 'ქალი', OTHER: 'სხვა', ALL: 'ყველა', IOS: 'iOS', ANDROID: 'Android', WEB: 'ვები',
    VOUCHER: 'ვაუჩერი', MARKETING_OPT_IN: 'მარკეტინგზე თანხმობით',
    new: 'ახალი', open: 'ღია', waiting: 'პასუხს ელოდება', closed: 'დახურული',
    route: 'აპის გვერდი', url: 'ბმული', none: 'ღილაკის გარეშე', telegram: 'Telegram',
    '[redacted]': 'დაფარულია',
  };
  // Fallback words for keys nobody mapped yet ("gift.save" → "საჩუქარი · შენახვა").
  const WORDS = {
    user: 'მომხმარებელი', status: 'სტატუსი', settings: 'პარამეტრები', update: 'შეცვლა', updated: 'შეცვლა', create: 'შექმნა',
    created: 'შექმნა', delete: 'წაშლა', deleted: 'წაშლა', remove: 'მოხსნა', removed: 'მოხსნა', add: 'დამატება', save: 'შენახვა',
    reset: 'ნაგულისხმევზე დაბრუნება', toggle: 'ჩართვა / გამორთვა', enable: 'ჩართვა', disable: 'გამორთვა', disabled: 'გამორთვა',
    approve: 'დადასტურება', reject: 'უარყოფა', suspend: 'შეჩერება', restore: 'აღდგენა', archive: 'არქივში გადატანა',
    publish: 'გამოქვეყნება', export: 'ექსპორტი', import: 'იმპორტი', imported: 'იმპორტი', test: 'ტესტი', send: 'გაგზავნა',
    template: 'შაბლონი', campaign: 'კამპანია', email: 'ელფოსტა', push: 'Push', support: 'მხარდაჭერა', reward: 'ჯილდო',
    partner: 'პარტნიორი', code: 'კოდი', coins: 'Medi Coins', feature: 'მოდული', quest: 'Medi Quest', trainer: 'ტრენერი',
    gym: 'დარბაზი', nutrition: 'კვება', recipe: 'რეცეპტი', director: 'დირექტორი', announcement: 'სიახლე', gift: 'საჩუქარი',
    note: 'შენიშვნა', reply: 'პასუხი', changed: 'შეცვლა', resolve: 'განხილვა', paused: 'შეჩერება', activated: 'გააქტიურება',
    community: 'ქალების სივრცე', medirun: 'MEDIRUN', medipulsi: 'MEDIRUN', profile: 'პროფილი', report: 'შეტყობინება',
  };
  function readable(key) {
    const words = String(key || '').replace(/([a-z])([A-Z])/g, '$1_$2').split(/[._\s-]+/).filter(Boolean).map((w) => w.toLowerCase());
    return words.length ? words.map((w) => WORDS[w] || w).join(' · ') : '—';
  }
  const actionLabel = (action) => ACTION_KA[action] || readable(action);
  const targetLabel = (type) => TARGET_KA[type] || readable(type);
  const fieldLabel = (key) => String(key).split('.').map((k) => FIELD_KA[k] || readable(k)).join(' · ');

  let state = { q: '', action: '', offset: 0, limit: 40 };

  function esc(v) {
    if (typeof opsEscape === 'function') return opsEscape(v);
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
  function escA(v) {
    return typeof escapeAttr === 'function' ? escapeAttr(v) : esc(v).replaceAll("'", '&#39;');
  }
  function fmt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('ka-GE');
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function when(iso, mode = 'datetime') {
    if (V().formatDate) return V().formatDate(iso, mode);
    if (typeof fmtDate === 'function') return fmtDate(iso);
    return iso || '—';
  }
  const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

  function valueText(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'კი' : 'არა';
    if (typeof v === 'number') return v.toLocaleString('ka-GE');
    if (Array.isArray(v)) return v.length ? v.map(valueText).join(', ') : '—';
    if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${fieldLabel(k)}: ${valueText(x)}`).join(' · ') || '—';
    const s = String(v);
    if (VALUE_KA[s]) return VALUE_KA[s];
    if (global.CATEGORY_KA?.[s]) return global.CATEGORY_KA[s];
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return when(s);
    return s;
  }

  /** One level of nesting is spelled out ("audience.gender") so a diff names each changed field. */
  function flatten(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
    Object.entries(obj).forEach(([k, v]) => {
      if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) Object.entries(v).forEach(([k2, v2]) => { out[`${k}.${k2}`] = v2; });
      else out[k] = v;
    });
    return out;
  }
  const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

  /**
   * The fields this entry changed. Some writers store a whole "before" snapshot but only the fields that
   * were sent as "after" (settings) — a field missing from "after" was not part of the change.
   */
  function changes(row) {
    const prev = flatten(row.previousValue);
    const next = flatten(row.newValue);
    const both = isObj(row.previousValue) && isObj(row.newValue);
    return [...new Set([...Object.keys(prev), ...Object.keys(next)])]
      .filter((k) => !(both && !(k in next)) && !same(prev[k], next[k]))
      .map((k) => ({ key: k, before: prev[k], after: next[k] }));
  }

  function summary(row) {
    const list = changes(row);
    if (!list.length) return '';
    const created = !isObj(row.previousValue);
    return list.slice(0, 3).map((c) => (created
      ? `${fieldLabel(c.key)}: ${clip(valueText(c.after), 40)}`
      : `${fieldLabel(c.key)}: ${clip(valueText(c.before), 32)} → ${clip(valueText(c.after), 32)}`)).join(' · ')
      + (list.length > 3 ? ` · +${list.length - 3}` : '');
  }

  /** The specific object: a name for known keys, otherwise a short id. */
  function targetDetail(row, { copy = false } = {}) {
    const { targetType: type, targetId: id } = row;
    if (!id) return '';
    if (SINGLETON_KA[`${type}:${id}`]) return esc(SINGLETON_KA[`${type}:${id}`]);
    if (type === 'featureFlag') return esc(FEATURE_KA[id] || id);
    if (type === 'emailTemplate') return esc(EMAIL_TEMPLATE_KA[id] || id);
    if (type === 'pushTemplate' || type === 'questTemplate') return `<code>${esc(id)}</code>`;
    if (copy && V().copyIdButton) return V().copyIdButton(id);
    return `<span class="p3-mono s-muted">${esc(String(id).slice(0, 8))}…</span>`;
  }

  function readHashState() {
    const params = Shell().hashParams ? Shell().hashParams() : new URLSearchParams(location.hash.split('?')[1] || '');
    state.q = (params.get('q') || '').trim();
    state.action = (params.get('action') || '').trim();
    const off = Number(params.get('offset') || 0);
    state.offset = Number.isFinite(off) && off > 0 ? off : 0;
  }

  function writeHashState() {
    Shell().writeModuleHash?.('audit', {
      q: state.q || null,
      action: state.action || null,
      offset: state.offset > 0 ? String(state.offset) : null,
    });
  }

  function metric(label, value, hint) {
    return `<div class="s-metric"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(hint || '')}</small></div>`;
  }

  function actionOptions() {
    // A legacy or unknown action from the URL still shows as the selected option.
    const known = !state.action || ACTION_GROUPS.some(([, items]) => items.some(([key]) => key === state.action));
    return `<option value="">ყველა ქმედება</option>
      ${known ? '' : `<option value="${escA(state.action)}" selected>${esc(actionLabel(state.action))}</option>`}
      ${ACTION_GROUPS.map(([group, items]) => `<optgroup label="${escA(group)}">${items.map(([val, label]) => `<option value="${escA(val)}"${state.action === val ? ' selected' : ''}>${esc(label)}</option>`).join('')}</optgroup>`).join('')}`;
  }

  function openAuditDetail(row) {
    if (!row) return;
    const list = changes(row);
    const created = !isObj(row.previousValue);
    const removed = !isObj(row.newValue) && isObj(row.previousValue);
    const page = row.targetType === 'user' && row.targetId
      ? [`#/users/${encodeURIComponent(row.targetId)}`, 'მომხმარებლის პროფილი']
      : PAGES[TARGET_PAGE[row.targetType]];
    const diff = list.length
      ? `<div class="s-table-wrap"><table class="s-table p3-diff"><thead><tr><th>ველი</th>${created ? '' : '<th>ძველი</th>'}${removed ? '' : '<th>ახალი</th>'}</tr></thead><tbody>${list.map((c) => `<tr>
          <td class="p3-diff-key">${esc(fieldLabel(c.key))}</td>
          ${created ? '' : `<td class="p3-diff-old" data-label="ძველი">${esc(valueText(c.before))}</td>`}
          ${removed ? '' : `<td class="p3-diff-new" data-label="ახალი">${esc(valueText(c.after))}</td>`}
        </tr>`).join('')}</tbody></table></div>`
      : '<div class="s-empty">ამ ქმედებას ცვლილების დეტალი არ ჩაუწერია.</div>';
    const detail = targetDetail(row, { copy: true });
    const dialog = V().openDialog?.({
      title: actionLabel(row.action),
      wide: true,
      watchDirty: false,
      body: `<div class="s-stack p3-audit-detail">
        <dl class="p3-facts">
          <div><dt>ადმინი</dt><dd>${esc(row.adminEmail || '—')}</dd></div>
          <div><dt>დრო</dt><dd>${esc(when(row.createdAt))}</dd></div>
          <div><dt>ობიექტი</dt><dd>${esc(targetLabel(row.targetType))}${detail ? ` · ${detail}` : ''}</dd></div>
        </dl>
        <section class="s-card"><header class="s-card-head"><div><h3>${created ? 'ახალი მნიშვნელობები' : removed ? 'წაშლილი მნიშვნელობები' : 'რა შეიცვალა'}</h3><p>${created ? 'ობიექტი ამ ქმედებით შეიქმნა.' : 'მხოლოდ შეცვლილი ველები; საიდუმლო ველები დაფარულია.'}</p></div></header>
          <div class="s-card-body is-flush">${diff}</div></section>
        <section class="s-card"><details class="s-details p3-tech"><summary>ტექნიკური დეტალები</summary><div>
          <dl class="p3-facts">
            <div><dt>ქმედების კოდი</dt><dd class="p3-mono">${esc(row.action || '—')}</dd></div>
            <div><dt>ობიექტის ტიპი</dt><dd class="p3-mono">${esc(row.targetType || '—')}</dd></div>
            <div><dt>ობიექტის ID</dt><dd class="p3-mono">${esc(row.targetId || '—')}</dd></div>
          </dl>
          <pre class="s-preview-text">${esc(JSON.stringify({ previousValue: row.previousValue ?? null, newValue: row.newValue ?? null }, null, 2))}</pre>
        </div></details></section>
      </div>`,
      footer: page ? `<a class="btn" href="${escA(page[0])}" data-audit-open>${ico('link')} გადასვლა: ${esc(page[1])}</a>` : '',
    });
    document.querySelector('#v3-dialog [data-audit-open]')?.addEventListener('click', () => { void dialog?.close(); });
  }

  function logsQuery() {
    const qs = new URLSearchParams();
    qs.set('limit', String(state.limit));
    qs.set('offset', String(state.offset));
    if (state.q) qs.set('q', state.q);
    if (state.action) qs.set('action', state.action);
    return qs.toString();
  }

  function tableRowsHtml(rows) {
    if (!rows.length) {
      return `<tr><td colspan="5"><div class="s-empty">${ico('search')}<strong>ჩანაწერი არ არის</strong><span>${state.q || state.action ? 'ამ ფილტრით ცვლილება ვერ მოიძებნა — შეცვალე ძებნა ან ქმედება.' : 'ადმინის ცვლილებები (პარამეტრები, სტატუსები, შაბლონები…) აქ გამოჩნდება.'}</span></div></td></tr>`;
    }
    return rows
      .map((row, i) => {
        const change = summary(row);
        const detail = targetDetail(row);
        return `<tr class="is-click" data-audit="${i}" tabindex="0">
        <td class="p3-nowrap">${esc(when(row.createdAt))}</td>
        <td class="p3-admin">${esc(row.adminEmail || '—')}</td>
        <td class="p3-action">${esc(actionLabel(row.action))}</td>
        <td class="p3-target">${detail || '<span class="s-muted">—</span>'}</td>
        <td class="p3-change">${change ? esc(change) : '<span class="s-muted">—</span>'}</td>
      </tr>`;
      })
      .join('');
  }

  function bindRows(host, rows) {
    host.querySelectorAll('tr[data-audit]').forEach((tr) => {
      const open = () => openAuditDetail(rows[Number(tr.dataset.audit)]);
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  async function loadJournal() {
    const tbody = $('audit-log-body');
    const meta = $('audit-log-meta');
    const kpis = $('audit-kpis');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5"><div class="v3-skel" aria-hidden="true"><i></i><i></i><i></i><i></i></div></td></tr>`;
    writeHashState();

    try {
      const data = await api(`/audit?${logsQuery()}`);
      const rows = data.entries || [];
      const total = Number(data.total) || 0;
      const admins = new Set(rows.map((r) => r.adminEmail).filter(Boolean)).size;
      const actions = new Set(rows.map((r) => r.action).filter(Boolean)).size;
      const shownEnd = Math.min(state.offset + rows.length, total);

      tbody.innerHTML = tableRowsHtml(rows);
      bindRows(tbody, rows);

      if (meta) {
        meta.textContent = total
          ? `${fmt(state.offset + (rows.length ? 1 : 0))}–${fmt(shownEnd)} / ${fmt(total)}`
          : '0 ჩანაწერი';
      }
      if (kpis) {
        kpis.innerHTML = `
          ${metric('ჩანაწერი', fmt(total), state.q || state.action ? 'ფილტრის მიხედვით' : 'მთელი ჟურნალი')}
          ${metric('ადმინი', fmt(admins), 'ამ გვერდზე')}
          ${metric('ქმედების ტიპი', fmt(actions), 'ამ გვერდზე')}
        `;
      }

      const prev = $('audit-log-prev');
      const next = $('audit-log-next');
      if (prev) prev.disabled = state.offset <= 0;
      if (next) next.disabled = state.offset + state.limit >= total;
    } catch (err) {
      if (meta) meta.textContent = '—';
      if (kpis) kpis.innerHTML = `${metric('ჩანაწერი', '—', '')}${metric('ადმინი', '—', 'ამ გვერდზე')}${metric('ქმედების ტიპი', '—', 'ამ გვერდზე')}`;
      tbody.innerHTML = `<tr><td colspan="5"><div class="s-empty">${ico('alert')}<strong>აუდიტი ვერ ჩაიტვირთა</strong><span>შეამოწმე კავშირი და სცადე ხელახლა.</span>${err?.message ? `<small class="p3-raw">${esc(err.message)}</small>` : ''}<button type="button" class="btn ghost compact" id="audit-retry">${ico('refresh')} ხელახლა ცდა</button></div></td></tr>`;
      $('audit-retry')?.addEventListener('click', () => void loadJournal());
    }
  }

  async function renderAuditLogV3() {
    const root = $('tab-audit');
    if (!root) return;
    const Sh = Shell();

    readHashState();

    Sh.mountHeader?.({
      tab: 'audit',
      kicker: 'Production',
      title: 'აუდიტი',
      purpose: 'ვინ რა შეცვალა ადმინში და როდის.',
      helpKey: 'audit.page',
    });

    // No "v3-module": its legacy field styles (unify.css) would override the s-* filter controls.
    root.classList.add('v3-workspace-wide', 'v3-audit');
    root.innerHTML = `
      <div class="s-stack v3-tab-shell" data-v3-audit="page">
        <div class="s-toolbar">
          <div class="p3-tools">
            <select id="audit-action" class="p3-select" aria-label="ქმედება">${actionOptions()}</select>
            <label class="p3-search">
              <span class="sr-only">ძებნა</span>
              ${ico('search')}
              <input id="audit-q" type="search" placeholder="ადმინის ელფოსტა ან ობიექტის ID…" value="${escA(state.q)}" autocomplete="off" />
            </label>
            <button type="button" class="btn" id="audit-search">ძებნა</button>
          </div>
          <div class="p3-tools">
            <button type="button" class="btn ghost compact" id="audit-export">${ico('download')} CSV</button>
            <button type="button" class="btn ghost compact" id="audit-refresh">${ico('refresh')} განახლება</button>
          </div>
        </div>

        <div class="s-metrics" id="audit-kpis" role="group" aria-label="აუდიტის მდგომარეობა">
          ${metric('ჩანაწერი', '…', '')}
          ${metric('ადმინი', '…', 'ამ გვერდზე')}
          ${metric('ქმედების ტიპი', '…', 'ამ გვერდზე')}
        </div>

        <section class="s-card" data-v3-audit="journal">
          <header class="s-card-head"><div><h3>აუდიტის ჟურნალი</h3><p>ადმინების ცვლილებები, ახალი პირველი. დააჭირე სტრიქონს დეტალებისთვის; საიდუმლო ველები დაფარულია.</p></div></header>
          <div class="s-card-body is-flush"><div class="s-table-wrap">
            <table class="s-table p3-audit-table">
              <thead>
                <tr>
                  <th>დრო</th>
                  <th>ადმინი</th>
                  <th>ქმედება</th>
                  <th>ობიექტი</th>
                  <th>ცვლილება</th>
                </tr>
              </thead>
              <tbody id="audit-log-body"></tbody>
            </table>
          </div></div>
          <div class="s-pager">
            <span id="audit-log-meta">იტვირთება…</span>
            <div>
              <button type="button" class="btn ghost compact" id="audit-log-prev" disabled>წინა</button>
              <button type="button" class="btn ghost compact" id="audit-log-next" disabled>შემდეგი</button>
            </div>
          </div>
        </section>
      </div>
    `;

    let qTimer = null;
    const applySearch = () => {
      state.q = ($('audit-q')?.value || '').trim();
      state.action = $('audit-action')?.value || '';
      state.offset = 0;
      void loadJournal();
    };

    $('audit-refresh')?.addEventListener('click', () => void loadJournal());
    $('audit-search')?.addEventListener('click', applySearch);
    $('audit-action')?.addEventListener('change', applySearch);
    $('audit-q')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applySearch();
    });
    $('audit-q')?.addEventListener('input', () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(applySearch, 320);
    });
    $('audit-log-prev')?.addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - state.limit);
      void loadJournal();
    });
    $('audit-log-next')?.addEventListener('click', () => {
      state.offset += state.limit;
      void loadJournal();
    });
    $('audit-export')?.addEventListener('click', () => {
      const qs = new URLSearchParams();
      if (state.q) qs.set('q', state.q);
      else if (state.action) qs.set('q', state.action);
      const path = `/export/audit${qs.toString() ? `?${qs}` : ''}`;
      if (typeof opsDownload === 'function') void opsDownload(path, 'audit.csv');
    });

    await loadJournal();
  }

  global.AdminAuditLabels = {
    action: actionLabel,
    target: targetLabel,
    field: fieldLabel,
    value: valueText,
  };
  global.renderAuditLog = renderAuditLogV3;
})(window);
