/**
 * Phase 4 — achievement copy (ka/en/fr/ru).
 * Titles and descriptions are generated per family + threshold so the
 * 50-item catalog stays maintainable. Secret achievements are masked
 * until unlocked; the mask copy lives here too.
 */

const RARITY_LABELS = {
  ka: { COMMON: 'ჩვეულებრივი', UNCOMMON: 'იშვიათი', RARE: 'ძვირფასი', EPIC: 'ეპიკური', LEGENDARY: 'ლეგენდარული' },
  en: { COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary' },
  fr: { COMMON: 'Commun', UNCOMMON: 'Peu commun', RARE: 'Rare', EPIC: 'Épique', LEGENDARY: 'Légendaire' },
  ru: { COMMON: 'Обычное', UNCOMMON: 'Необычное', RARE: 'Редкое', EPIC: 'Эпическое', LEGENDARY: 'Легендарное' },
};

const CATEGORY_LABELS = {
  ka: {
    PROGRESSION: 'პროგრესი',
    STREAK: 'სერია',
    MOVEMENT: 'მოძრაობა',
    HYDRATION: 'წყალი',
    MEDI: 'Medi',
    WEEKLY: 'კვირის მისიები',
    LEVEL: 'დონეები',
    COINS: 'Medi Coins',
    SPECIAL: 'განსაკუთრებული',
  },
  en: {
    PROGRESSION: 'Progress',
    STREAK: 'Streak',
    MOVEMENT: 'Movement',
    HYDRATION: 'Hydration',
    MEDI: 'Medi',
    WEEKLY: 'Weekly missions',
    LEVEL: 'Levels',
    COINS: 'Medi Coins',
    SPECIAL: 'Special',
  },
  fr: {
    PROGRESSION: 'Progression',
    STREAK: 'Série',
    MOVEMENT: 'Mouvement',
    HYDRATION: 'Hydratation',
    MEDI: 'Medi',
    WEEKLY: 'Missions de la semaine',
    LEVEL: 'Niveaux',
    COINS: 'Medi Coins',
    SPECIAL: 'Spéciaux',
  },
  ru: {
    PROGRESSION: 'Прогресс',
    STREAK: 'Серия',
    MOVEMENT: 'Движение',
    HYDRATION: 'Вода',
    MEDI: 'Medi',
    WEEKLY: 'Миссии недели',
    LEVEL: 'Уровни',
    COINS: 'Medi Coins',
    SPECIAL: 'Особые',
  },
};

const FIXED_TITLES = {
  ka: {
    FIRST_QUEST: 'პირველი მისია',
    FIRST_CLAIM: 'პირველი ჯილდო',
    FIRST_WEEKLY: 'პირველი კვირა',
    COMEBACK: 'დაბრუნება',
    EARLY_BIRD: 'დილის ჩიტი',
    NIGHT_OWL: 'ღამის ბუ',
  },
  en: {
    FIRST_QUEST: 'First mission',
    FIRST_CLAIM: 'First reward',
    FIRST_WEEKLY: 'First week',
    COMEBACK: 'The comeback',
    EARLY_BIRD: 'Early bird',
    NIGHT_OWL: 'Night owl',
  },
  fr: {
    FIRST_QUEST: 'Première mission',
    FIRST_CLAIM: 'Première récompense',
    FIRST_WEEKLY: 'Première semaine',
    COMEBACK: 'Le retour',
    EARLY_BIRD: 'Lève-tôt',
    NIGHT_OWL: 'Oiseau de nuit',
  },
  ru: {
    FIRST_QUEST: 'Первая миссия',
    FIRST_CLAIM: 'Первая награда',
    FIRST_WEEKLY: 'Первая неделя',
    COMEBACK: 'Возвращение',
    EARLY_BIRD: 'Ранняя пташка',
    NIGHT_OWL: 'Ночная сова',
  },
};

const FIXED_DESCRIPTIONS = {
  ka: {
    FIRST_QUEST: 'შეასრულე შენი პირველი მისია.',
    FIRST_CLAIM: 'მიიღე შენი პირველი ჯილდო.',
    FIRST_WEEKLY: 'შეასრულე კვირის მისია პირველად.',
    COMEBACK: 'დაბრუნდი პაუზის შემდეგ — ესეც ითვლება.',
    EARLY_BIRD: 'შეასრულე მისია დილის 8 საათამდე.',
    NIGHT_OWL: 'შეასრულე მისია საღამოს 10 საათის შემდეგ.',
  },
  en: {
    FIRST_QUEST: 'Complete your very first mission.',
    FIRST_CLAIM: 'Claim your very first reward.',
    FIRST_WEEKLY: 'Complete a weekly mission for the first time.',
    COMEBACK: 'Come back after a break — that counts too.',
    EARLY_BIRD: 'Complete a mission before 8 in the morning.',
    NIGHT_OWL: 'Complete a mission after 10 in the evening.',
  },
  fr: {
    FIRST_QUEST: 'Accomplis ta toute première mission.',
    FIRST_CLAIM: 'Récupère ta toute première récompense.',
    FIRST_WEEKLY: 'Accomplis une mission hebdomadaire pour la première fois.',
    COMEBACK: 'Reviens après une pause — ça compte aussi.',
    EARLY_BIRD: 'Accomplis une mission avant 8 h du matin.',
    NIGHT_OWL: 'Accomplis une mission après 22 h.',
  },
  ru: {
    FIRST_QUEST: 'Выполни свою первую миссию.',
    FIRST_CLAIM: 'Получи свою первую награду.',
    FIRST_WEEKLY: 'Впервые выполни миссию недели.',
    COMEBACK: 'Вернись после паузы — это тоже считается.',
    EARLY_BIRD: 'Выполни миссию до 8 утра.',
    NIGHT_OWL: 'Выполни миссию после 10 вечера.',
  },
};

const FAMILY_TITLES = {
  ka: {
    QUESTS: (n) => `${n} მისია`,
    STREAK: (n) => `სერია · ${n} დღე`,
    MOVE: (n) => `მოძრაობა · ${n}`,
    HYDRATE: (n) => `წყალი · ${n}`,
    MEDI: (n) => `Medi · ${n}`,
    WEEKLY: (n) => `კვირა · ${n}`,
    LEVEL: (n) => `დონე ${n}`,
    COINS_EARNED: (n) => `${n.toLocaleString('ka-GE')} Medi Coin`,
  },
  en: {
    QUESTS: (n) => `${n} missions`,
    STREAK: (n) => `${n}-day streak`,
    MOVE: (n) => `Movement · ${n}`,
    HYDRATE: (n) => `Hydration · ${n}`,
    MEDI: (n) => `Medi · ${n}`,
    WEEKLY: (n) => `Weekly · ${n}`,
    LEVEL: (n) => `Level ${n}`,
    COINS_EARNED: (n) => `${n.toLocaleString('en-US')} Medi Coins`,
  },
  fr: {
    QUESTS: (n) => `${n} missions`,
    STREAK: (n) => `Série de ${n} jours`,
    MOVE: (n) => `Mouvement · ${n}`,
    HYDRATE: (n) => `Hydratation · ${n}`,
    MEDI: (n) => `Medi · ${n}`,
    WEEKLY: (n) => `Hebdo · ${n}`,
    LEVEL: (n) => `Niveau ${n}`,
    COINS_EARNED: (n) => `${n.toLocaleString('fr-FR')} Medi Coins`,
  },
  ru: {
    QUESTS: (n) => `${n} миссий`,
    STREAK: (n) => `Серия · ${n} дней`,
    MOVE: (n) => `Движение · ${n}`,
    HYDRATE: (n) => `Вода · ${n}`,
    MEDI: (n) => `Medi · ${n}`,
    WEEKLY: (n) => `Неделя · ${n}`,
    LEVEL: (n) => `Уровень ${n}`,
    COINS_EARNED: (n) => `${n.toLocaleString('ru-RU')} Medi Coins`,
  },
};

const FAMILY_DESCRIPTIONS = {
  ka: {
    QUESTS: (n) => `შეასრულე სულ ${n} მისია.`,
    STREAK: (n) => `შეინარჩუნე სერია ${n} დღის განმავლობაში.`,
    MOVE: (n) => `შეასრულე ${n} მოძრაობის მისია.`,
    HYDRATE: (n) => `შეასრულე ${n} წყლის მისია.`,
    MEDI: (n) => `შეასრულე ${n} Medi მისია.`,
    WEEKLY: (n) => `შეასრულე ${n} კვირის მისია.`,
    LEVEL: (n) => `მიაღწიე ${n} დონეს.`,
    COINS_EARNED: (n) => `დააგროვე სულ ${n.toLocaleString('ka-GE')} Medi Coin.`,
  },
  en: {
    QUESTS: (n) => `Complete ${n} missions in total.`,
    STREAK: (n) => `Keep your streak alive for ${n} days.`,
    MOVE: (n) => `Complete ${n} movement missions.`,
    HYDRATE: (n) => `Complete ${n} hydration missions.`,
    MEDI: (n) => `Complete ${n} Medi missions.`,
    WEEKLY: (n) => `Complete ${n} weekly missions.`,
    LEVEL: (n) => `Reach level ${n}.`,
    COINS_EARNED: (n) => `Earn ${n.toLocaleString('en-US')} Medi Coins in total.`,
  },
  fr: {
    QUESTS: (n) => `Accomplis ${n} missions au total.`,
    STREAK: (n) => `Garde ta série pendant ${n} jours.`,
    MOVE: (n) => `Accomplis ${n} missions de mouvement.`,
    HYDRATE: (n) => `Accomplis ${n} missions d’hydratation.`,
    MEDI: (n) => `Accomplis ${n} missions Medi.`,
    WEEKLY: (n) => `Accomplis ${n} missions hebdomadaires.`,
    LEVEL: (n) => `Atteins le niveau ${n}.`,
    COINS_EARNED: (n) => `Gagne ${n.toLocaleString('fr-FR')} Medi Coins au total.`,
  },
  ru: {
    QUESTS: (n) => `Выполни всего ${n} миссий.`,
    STREAK: (n) => `Сохрани серию ${n} дней подряд.`,
    MOVE: (n) => `Выполни ${n} миссий движения.`,
    HYDRATE: (n) => `Выполни ${n} водных миссий.`,
    MEDI: (n) => `Выполни ${n} миссий Medi.`,
    WEEKLY: (n) => `Выполни ${n} миссий недели.`,
    LEVEL: (n) => `Достигни уровня ${n}.`,
    COINS_EARNED: (n) => `Накопи всего ${n.toLocaleString('ru-RU')} Medi Coins.`,
  },
};

const TEXT = {
  ka: {
    section: 'მიღწევები',
    subtitle: 'შენი გრძელი გზა Medi Quest-ში',
    preview: 'მიღწევები',
    viewAll: 'ყველა',
    secretTitle: 'საიდუმლო მიღწევა',
    secretBody: 'გაიხსნება მოულოდნელად.',
    claim: 'მიღება',
    claimed: 'მიღებულია',
    locked: 'ჯერ დახურულია',
    unlockedToast: 'ახალი მიღწევა 🏅',
    empty: 'მიღწევები აქ გამოჩნდება.',
    loadError: 'მიღწევები ვერ განახლდა.',
    unlockedOf: (u, t) => `${u} / ${t} გახსნილია`,
    progressOf: (p, t) => `${p} / ${t}`,
    claimableLine: (n) => `${n} ჯილდო გელოდება`,
  },
  en: {
    section: 'Achievements',
    subtitle: 'Your long journey in Medi Quest',
    preview: 'Achievements',
    viewAll: 'View all',
    secretTitle: 'Secret achievement',
    secretBody: 'It reveals itself when you least expect it.',
    claim: 'Claim',
    claimed: 'Claimed',
    locked: 'Still locked',
    unlockedToast: 'New achievement 🏅',
    empty: 'Your achievements will appear here.',
    loadError: 'Couldn’t refresh achievements.',
    unlockedOf: (u, t) => `${u} / ${t} unlocked`,
    progressOf: (p, t) => `${p} / ${t}`,
    claimableLine: (n) => `${n} reward${n === 1 ? '' : 's'} waiting`,
  },
  fr: {
    section: 'Succès',
    subtitle: 'Ton long chemin dans Medi Quest',
    preview: 'Succès',
    viewAll: 'Tout voir',
    secretTitle: 'Succès secret',
    secretBody: 'Il se révèle quand on s’y attend le moins.',
    claim: 'Récupérer',
    claimed: 'Récupéré',
    locked: 'Encore verrouillé',
    unlockedToast: 'Nouveau succès 🏅',
    empty: 'Tes succès apparaîtront ici.',
    loadError: 'Impossible d’actualiser les succès.',
    unlockedOf: (u, t) => `${u} / ${t} débloqués`,
    progressOf: (p, t) => `${p} / ${t}`,
    claimableLine: (n) => `${n} récompense${n > 1 ? 's' : ''} t’attend`,
  },
  ru: {
    section: 'Достижения',
    subtitle: 'Твой длинный путь в Medi Quest',
    preview: 'Достижения',
    viewAll: 'Все',
    secretTitle: 'Секретное достижение',
    secretBody: 'Откроется, когда меньше всего ждёшь.',
    claim: 'Получить',
    claimed: 'Получено',
    locked: 'Пока закрыто',
    unlockedToast: 'Новое достижение 🏅',
    empty: 'Твои достижения появятся здесь.',
    loadError: 'Не удалось обновить достижения.',
    unlockedOf: (u, t) => `${u} / ${t} открыто`,
    progressOf: (p, t) => `${p} / ${t}`,
    claimableLine: (n) => `${n} награда ждёт тебя`,
  },
};

function familyFromKey(key) {
  if (!key) return null;
  const match = String(key).match(/^([A-Z_]+?)_(\d+)$/);
  if (match) return { family: match[1], threshold: Number(match[2]) };
  return { family: String(key), threshold: null };
}

function achievementCopy(locale = 'ka') {
  const loc = TEXT[locale] ? locale : 'ka';
  const t = TEXT[loc];
  return {
    ...t,
    rarity: RARITY_LABELS[loc],
    categories: CATEGORY_LABELS[loc],
    /** item = { key, threshold, secret, unlocked } — masked secrets use secretTitle. */
    title(item) {
      if (!item || (!item.key && item.secret)) return t.secretTitle;
      const fixed = FIXED_TITLES[loc][item.key];
      if (fixed) return fixed;
      const parsed = familyFromKey(item.key);
      const build = parsed && FAMILY_TITLES[loc][parsed.family];
      if (build) return build(item.threshold ?? parsed.threshold ?? 0);
      return String(item.key || t.secretTitle);
    },
    description(item) {
      if (!item || (!item.key && item.secret)) return t.secretBody;
      const fixed = FIXED_DESCRIPTIONS[loc][item.key];
      if (fixed) return fixed;
      const parsed = familyFromKey(item.key);
      const build = parsed && FAMILY_DESCRIPTIONS[loc][parsed.family];
      if (build) return build(item.threshold ?? parsed.threshold ?? 0);
      return t.secretBody;
    },
  };
}

module.exports = { achievementCopy };
