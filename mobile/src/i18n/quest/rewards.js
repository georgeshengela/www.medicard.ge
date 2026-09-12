/**
 * Phase 7 — Rewards Store copy (ka / en / fr / ru).
 * Georgian is primary QA. No hardcoded Georgian in business logic.
 */

const REWARD_TITLES = {
  'reward.mediTheme7d.title': {
    ka: 'Medi Quest სტილი — 7 დღე',
    en: 'Medi Quest Style — 7 days',
    fr: 'Style Medi Quest — 7 jours',
    ru: 'Стиль Medi Quest — 7 дней',
  },
  'reward.mediProfileStyle30d.title': {
    ka: 'პროფილის აქცენტი — 30 დღე',
    en: 'Profile accent — 30 days',
    fr: 'Accent profil — 30 jours',
    ru: 'Акцент профиля — 30 дней',
  },
  'reward.mediPremiumDay.title': {
    ka: '1 დღე Premium',
    en: '1 day Premium',
    fr: '1 jour Premium',
    ru: '1 день Premium',
  },
  'reward.mediPremium3d.title': {
    ka: '3 დღე Premium',
    en: '3 days Premium',
    fr: '3 jours Premium',
    ru: '3 дня Premium',
  },
  'reward.partnerTest10.title': {
    ka: 'Partner test',
    en: 'Partner test',
    fr: 'Test partenaire',
    ru: 'Тест партнёра',
  },
};

const REWARD_DESCRIPTIONS = {
  'reward.mediTheme7d.description': {
    ka: 'ოქროსფერი აქცენტი Medi Quest ჰაბზე 7 დღით. მხოლოდ კოსმეტიკა — XP/Coins არ იცვლება.',
    en: 'A gold accent on the Medi Quest hub for 7 days. Cosmetic only — XP/Coins unchanged.',
    fr: 'Accent doré sur le hub Medi Quest pendant 7 jours. Cosmétique uniquement.',
    ru: 'Золотой акцент на Medi Quest хабе на 7 дней. Только косметика.',
  },
  'reward.mediProfileStyle30d.description': {
    ka: 'ოქროსფერი ჩარჩო პროფილის ავატარზე 30 დღით. მხოლოდ კოსმეტიკა — თამაშის უპირატესობა არ აქვს.',
    en: 'A gold frame around your profile avatar for 30 days. Cosmetic only — no gameplay advantage.',
    fr: 'Cadre doré autour de l’avatar profil pendant 30 jours. Cosmétique uniquement.',
    ru: 'Золотая рамка аватара профиля на 30 дней. Только косметика.',
  },
  'reward.mediPremiumDay.description': {
    ka: '1 დღე Medicard Premium.',
    en: '1 day of MediCard Premium access.',
    fr: '1 jour d’accès MediCard Premium.',
    ru: '1 день доступа MediCard Premium.',
  },
  'reward.mediPremium3d.description': {
    ka: '3 დღე Medicard Premium.',
    en: '3 days of MediCard Premium access.',
    fr: '3 jours d’accès MediCard Premium.',
    ru: '3 дня доступа MediCard Premium.',
  },
  'reward.partnerTest10.description': {
    ka: 'DEV/QA არქიტექტურის ტესტი.',
    en: 'DEV/QA architecture validation only.',
    fr: 'Validation d’architecture DEV/QA uniquement.',
    ru: 'Только проверка архитектуры DEV/QA.',
  },
};

const REWARD_TERMS = {
  'reward.mediTheme7d.terms': {
    ka: 'ლოიალობის ქულები — არა ფული. 14 დღეში ერთხელ. იცვლის მხოლოდ Medi Quest ჰაბის ვიზუალს. ვადის გასვლის შემდეგ სტილი ქრება. Coins არ ბრუნდება.',
    en: 'Loyalty points — not money. Once every 14 days. Changes only the Medi Quest hub look. After expiry the style ends. Coins are not refunded.',
    fr: 'Points de fidélité — pas d’argent. Une fois / 14 jours. Change uniquement le hub Medi Quest. Après expiration, le style disparaît. Pas de remboursement.',
    ru: 'Баллы лояльности — не деньги. Раз в 14 дней. Меняет только вид Medi Quest хаба. После срока стиль исчезает. Coins не возвращаются.',
  },
  'reward.mediProfileStyle30d.terms': {
    ka: 'კოსმეტიკა მხოლოდ პროფილის ავატარზე. ერთდროულად ერთი აქტიური აქცენტი. არ ცვლის XP, Coins ან ქვესტებს.',
    en: 'Cosmetic only on the profile avatar. Max one active accent. Does not change XP, Coins, or quests.',
    fr: 'Cosmétique uniquement sur l’avatar profil. Un accent actif max. Ne change ni XP, ni Coins, ni quêtes.',
    ru: 'Только косметика аватара профиля. Максимум один активный акцент. Не меняет XP, Coins и квесты.',
  },
  'reward.mediPremiumDay.terms': {
    ka: 'მხოლოდ როცა Premium უფლების სისტემა არსებობს.',
    en: 'Only when a real Premium entitlement system exists.',
    fr: 'Uniquement si un vrai système Premium existe.',
    ru: 'Только при реальной системе Premium.',
  },
  'reward.mediPremium3d.terms': {
    ka: 'მხოლოდ როცა Premium უფლების სისტემა არსებობს.',
    en: 'Only when a real Premium entitlement system exists.',
    fr: 'Uniquement si un vrai système Premium existe.',
    ru: 'Только при реальной системе Premium.',
  },
  'reward.partnerTest10.terms': {
    ka: 'არ არის რეალური პარტნიორის შეთავაზება.',
    en: 'Not a real partner commercial offer.',
    fr: 'Pas une offre partenaire réelle.',
    ru: 'Не реальное партнёрское предложение.',
  },
};

const STORE = {
  ka: {
    title: 'ჯილდოები',
    tagline: 'გამოიყენე Medi Coins Medicard-ის სარგებელზე.',
    featured: 'რჩეული',
    available: 'ხელმისაწვდომი',
    myRewards: 'ჩემი ჯილდოები',
    useCoins: 'გამოიყენე Medi Coins',
    coinsLabel: 'Medi Coins',
    view: 'ნახვა',
    redeem: 'გაცვლა',
    cancel: 'გაუქმება',
    confirmTitle: 'გავცვალო?',
    confirmBody: (cost) => `გაცვლა ${cost} Medi Coins-ზე?`,
    balanceNow: 'ამჟამინდელი ბალანსი',
    balanceAfter: 'შემდეგ',
    needMore: (n) => `კიდევ ${n} Medi Coins დაგჭირდება.`,
    youHave: 'შენ გაქვს',
    successTitle: 'ჯილდო გაიცვალა',
    viewMine: 'ჩემი ჯილდოები',
    copyCode: 'კოდის კოპირება',
    codeHidden: 'კოდის ჩვენება',
    expires: 'ვადა',
    whatYouGet: 'რას მიიღებ',
    terms: 'პირობები',
    validity: 'მოქმედების ვადა',
    days: (n) => `${n} დღე`,
    partner: 'პარტნიორი',
    offlineRedeem: 'გაცვლა საჭიროებს ინტერნეტს.',
    emptyStore: 'ჯილდოები მალე გამოჩნდება.',
    loadFailed: 'ჯილდოების ჩატვირთვა ვერ მოხერხდა. ხელახლა სცადე.',
    emptyMine: 'ჯერ არც ერთი გაცვლა არ გაქვს.',
    active: 'აქტიური',
    used: 'გამოყენებული',
    expired: 'ვადაგასული',
    statusIssued: 'გაცემული',
    statusUsed: 'გამოყენებული',
    statusExpired: 'ვადაგასული',
    ledgerRedeem: 'Medi ჯილდო',
    costLabel: 'ღირებულება',
    outOfStock: 'მარაგი ამოწურულია',
    unavailable: 'მიუწვდომელი',
  },
  en: {
    title: 'Rewards',
    tagline: 'Use Medi Coins for MediCard benefits.',
    featured: 'Featured',
    available: 'Available',
    myRewards: 'My rewards',
    useCoins: 'Use Medi Coins',
    coinsLabel: 'Medi Coins',
    view: 'View',
    redeem: 'Redeem',
    cancel: 'Cancel',
    confirmTitle: 'Redeem?',
    confirmBody: (cost) => `Redeem for ${cost} Medi Coins?`,
    balanceNow: 'Current balance',
    balanceAfter: 'After',
    needMore: (n) => `You need ${n} more Medi Coins.`,
    youHave: 'You have',
    successTitle: 'Reward redeemed',
    viewMine: 'My rewards',
    copyCode: 'Copy code',
    codeHidden: 'Reveal code',
    expires: 'Expires',
    whatYouGet: 'What you receive',
    terms: 'Terms',
    validity: 'Validity',
    days: (n) => `${n} days`,
    partner: 'Partner',
    offlineRedeem: 'Redeeming requires a connection.',
    emptyStore: 'Rewards will appear soon.',
    loadFailed: 'Could not load rewards. Pull to retry.',
    emptyMine: 'No redemptions yet.',
    active: 'Active',
    used: 'Used',
    expired: 'Expired',
    statusIssued: 'Issued',
    statusUsed: 'Used',
    statusExpired: 'Expired',
    ledgerRedeem: 'Medi reward',
    costLabel: 'Cost',
    outOfStock: 'Out of stock',
    unavailable: 'Unavailable',
  },
  fr: {
    title: 'Récompenses',
    tagline: 'Utilisez les Medi Coins pour des avantages MediCard.',
    featured: 'À la une',
    available: 'Disponibles',
    myRewards: 'Mes récompenses',
    useCoins: 'Utiliser Medi Coins',
    coinsLabel: 'Medi Coins',
    view: 'Voir',
    redeem: 'Échanger',
    cancel: 'Annuler',
    confirmTitle: 'Échanger ?',
    confirmBody: (cost) => `Échanger pour ${cost} Medi Coins ?`,
    balanceNow: 'Solde actuel',
    balanceAfter: 'Après',
    needMore: (n) => `Il vous faut encore ${n} Medi Coins.`,
    youHave: 'Vous avez',
    successTitle: 'Récompense échangée',
    viewMine: 'Mes récompenses',
    copyCode: 'Copier le code',
    codeHidden: 'Afficher le code',
    expires: 'Expire',
    whatYouGet: 'Ce que vous recevez',
    terms: 'Conditions',
    validity: 'Validité',
    days: (n) => `${n} jours`,
    partner: 'Partenaire',
    offlineRedeem: 'L’échange nécessite une connexion.',
    emptyStore: 'Les récompenses arriveront bientôt.',
    loadFailed: 'Impossible de charger les récompenses. Réessayez.',
    emptyMine: 'Aucun échange pour l’instant.',
    active: 'Actives',
    used: 'Utilisées',
    expired: 'Expirées',
    statusIssued: 'Émise',
    statusUsed: 'Utilisée',
    statusExpired: 'Expirée',
    ledgerRedeem: 'Récompense Medi',
    costLabel: 'Coût',
    outOfStock: 'Rupture de stock',
    unavailable: 'Indisponible',
  },
  ru: {
    title: 'Награды',
    tagline: 'Тратьте Medi Coins на преимущества MediCard.',
    featured: 'Избранное',
    available: 'Доступно',
    myRewards: 'Мои награды',
    useCoins: 'Использовать Medi Coins',
    coinsLabel: 'Medi Coins',
    view: 'Смотреть',
    redeem: 'Обменять',
    cancel: 'Отмена',
    confirmTitle: 'Обменять?',
    confirmBody: (cost) => `Обменять за ${cost} Medi Coins?`,
    balanceNow: 'Текущий баланс',
    balanceAfter: 'После',
    needMore: (n) => `Нужно ещё ${n} Medi Coins.`,
    youHave: 'У вас',
    successTitle: 'Награда получена',
    viewMine: 'Мои награды',
    copyCode: 'Скопировать код',
    codeHidden: 'Показать код',
    expires: 'Истекает',
    whatYouGet: 'Что вы получите',
    terms: 'Условия',
    validity: 'Срок',
    days: (n) => `${n} дн.`,
    partner: 'Партнёр',
    offlineRedeem: 'Для обмена нужен интернет.',
    emptyStore: 'Награды появятся позже.',
    loadFailed: 'Не удалось загрузить награды. Потяните, чтобы повторить.',
    emptyMine: 'Пока нет обменов.',
    active: 'Активные',
    used: 'Использованные',
    expired: 'Истёкшие',
    statusIssued: 'Выдана',
    statusUsed: 'Использована',
    statusExpired: 'Истекла',
    ledgerRedeem: 'Награда Medi',
    costLabel: 'Стоимость',
    outOfStock: 'Нет в наличии',
    unavailable: 'Недоступно',
  },
};

const ERRORS = {
  REWARD_NOT_FOUND: { ka: 'ჯილდო ვერ მოიძებნა.', en: 'Reward not found.', fr: 'Récompense introuvable.', ru: 'Награда не найдена.' },
  REWARD_NOT_ACTIVE: { ka: 'ჯილდო მიუწვდომელია.', en: 'Reward unavailable.', fr: 'Récompense indisponible.', ru: 'Награда недоступна.' },
  REWARD_NOT_STARTED: { ka: 'ჯილდო ჯერ არ დაწყებულა.', en: 'Reward not started yet.', fr: 'Récompense pas encore disponible.', ru: 'Награда ещё не началась.' },
  REWARD_ENDED: { ka: 'ჯილდოს ვადა ამოიწურა.', en: 'Reward has ended.', fr: 'Récompense terminée.', ru: 'Срок награды истёк.' },
  REWARD_OUT_OF_STOCK: { ka: 'მარაგი ამოწურულია.', en: 'Out of stock.', fr: 'Rupture de stock.', ru: 'Нет в наличии.' },
  REWARD_INSUFFICIENT_COINS: { ka: 'არასაკმარისი Medi Coins.', en: 'Not enough Medi Coins.', fr: 'Pas assez de Medi Coins.', ru: 'Недостаточно Medi Coins.' },
  REWARD_USER_LIMIT: { ka: 'ლიმიტი ამოწურულია.', en: 'Limit reached.', fr: 'Limite atteinte.', ru: 'Лимит исчерпан.' },
  REWARD_PERIOD_LIMIT: { ka: 'პერიოდის ლიმიტი ამოწურულია.', en: 'Period limit reached.', fr: 'Limite de période atteinte.', ru: 'Лимит периода исчерпан.' },
  REWARD_ALREADY_REDEEMED: { ka: 'უკვე გაცვლილია.', en: 'Already redeemed.', fr: 'Déjà échangé.', ru: 'Уже обменено.' },
  REWARD_CODE_UNAVAILABLE: { ka: 'კოდი მიუწვდომელია.', en: 'Code unavailable.', fr: 'Code indisponible.', ru: 'Код недоступен.' },
  REWARD_ENTITLEMENT_UNAVAILABLE: { ka: 'უფლება მიუწვდომელია.', en: 'Entitlement unavailable.', fr: 'Droit indisponible.', ru: 'Право недоступно.' },
  REWARD_REDEMPTION_CONFLICT: { ka: 'გაცვლა კონფლიქტშია. ხელახლა სცადე.', en: 'Redemption conflict. Try again.', fr: 'Conflit d’échange. Réessayez.', ru: 'Конфликт обмена. Повторите.' },
};

function pick(map, key, locale) {
  const row = map[key];
  if (!row) return key;
  return row[locale] || row.en || row.ka || key;
}

export function rewardsCopy(locale = 'ka') {
  const lang = STORE[locale] ? locale : 'en';
  return STORE[lang];
}

export function rewardTitle(titleKey, locale = 'ka') {
  return pick(REWARD_TITLES, titleKey, locale);
}

export function rewardDescription(descriptionKey, locale = 'ka') {
  return pick(REWARD_DESCRIPTIONS, descriptionKey, locale);
}

export function rewardTerms(termsKey, locale = 'ka') {
  if (!termsKey) return '';
  return pick(REWARD_TERMS, termsKey, locale);
}

export function rewardErrorMessage(code, locale = 'ka') {
  const row = ERRORS[code];
  if (!row) return rewardsCopy(locale).unavailable;
  return row[locale] || row.en || row.ka;
}

export function coinCostBucket(cost) {
  const n = Number(cost) || 0;
  if (n < 500) return 'LOW';
  if (n < 1000) return 'MEDIUM';
  if (n < 2500) return 'HIGH';
  return 'PREMIUM';
}
