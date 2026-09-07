import { JOURNEY_COSMETIC_NAMES } from './cosmeticNames';

type Locale = 'ka' | 'en' | 'fr' | 'ru';
type LocStr = Record<Locale, string>;

function pick(map: LocStr, locale: string): string {
  const loc = (['ka', 'en', 'fr', 'ru'].includes(locale) ? locale : 'ka') as Locale;
  return map[loc] || map.ka || map.en;
}

const UI = {
  title: { ka: 'მედი', en: 'Medi', fr: 'Medi', ru: 'Medi' },
  subtitle: {
    ka: 'შენი თანამგზავრი',
    en: 'Your companion',
    fr: 'Ton compagnon',
    ru: 'Твой спутник',
  },
  stage: { ka: 'ეტაპი', en: 'Stage', fr: 'Étape', ru: 'Этап' },
  level: { ka: 'დონე', en: 'Level', fr: 'Niveau', ru: 'Уровень' },
  todaysQuest: {
    ka: 'დღევანდელი ქვესტი',
    en: "Today's Quest",
    fr: 'Quête du jour',
    ru: 'Квест сегодня',
  },
  journey: { ka: 'მოგზაურობა', en: 'Journey', fr: 'Voyage', ru: 'Путь' },
  achievements: {
    ka: 'მიღწევები',
    en: 'Achievements',
    fr: 'Succès',
    ru: 'Достижения',
  },
  collection: {
    ka: 'კოლექცია',
    en: 'Collection',
    fr: 'Collection',
    ru: 'Коллекция',
  },
  style: { ka: 'სტილი', en: 'Style', fr: 'Style', ru: 'Стиль' },
  talk: {
    ka: 'მედისთან საუბარი',
    en: 'Talk to Medi',
    fr: 'Parler à Medi',
    ru: 'Поговорить с Medi',
  },
  nextStop: {
    ka: 'შემდეგი გაჩერება',
    en: 'Next stop',
    fr: 'Prochain arrêt',
    ru: 'Следующая остановка',
  },
  youAreHere: {
    ka: 'აქ ხარ',
    en: 'You are here',
    fr: 'Tu es ici',
    ru: 'Ты здесь',
  },
  locked: { ka: 'ჯერ დახურულია', en: 'Still ahead', fr: 'Encore devant', ru: 'Ещё впереди' },
  unlocked: { ka: 'გახსნილია', en: 'Unlocked', fr: 'Débloqué', ru: 'Открыто' },
  equip: { ka: 'ჩაცმა', en: 'Equip', fr: 'Équiper', ru: 'Надеть' },
  equipped: { ka: 'ჩაცმულია', en: 'Equipped', fr: 'Équipé', ru: 'Надето' },
  unequip: { ka: 'მოხსნა', en: 'Remove', fr: 'Retirer', ru: 'Снять' },
  slotAccent: { ka: 'აქცენტი', en: 'Accent', fr: 'Accent', ru: 'Акцент' },
  slotAccessory: {
    ka: 'აქსესუარი',
    en: 'Accessory',
    fr: 'Accessoire',
    ru: 'Аксессуар',
  },
  slotBackground: {
    ka: 'ფონი',
    en: 'Background',
    fr: 'Fond',
    ru: 'Фон',
  },
  slotDecoration: {
    ka: 'დეკორი',
    en: 'Decoration',
    fr: 'Décor',
    ru: 'Декор',
  },
  offline: {
    ka: 'ოფლაინი — ბოლო შენახული მდგომარეობა',
    en: 'Offline — showing last saved state',
    fr: 'Hors ligne — dernier état enregistré',
    ru: 'Офлайн — последнее сохранённое состояние',
  },
  loadError: {
    ka: 'მედი ვერ ჩაიტვირთა',
    en: "Couldn't load Medi",
    fr: 'Impossible de charger Medi',
    ru: 'Не удалось загрузить Medi',
  },
  retry: { ka: 'თავიდან', en: 'Retry', fr: 'Réessayer', ru: 'Ещё раз' },
  emptyCollection: {
    ka: 'ჯერ ცოტა რამ გაქვს — მოგზაურობა გააგრძელე',
    en: 'A quiet start — keep walking the journey',
    fr: 'Début calme — continue le voyage',
    ru: 'Тихий старт — продолжай путь',
  },
  journeyComplete: {
    ka: 'ვერსია 1 მოგზაურობა დასრულებულია — კარგი ადგილია შესაჩერებლად',
    en: 'Journey chapter complete — a good place to pause',
    fr: 'Chapitre du voyage terminé — belle pause',
    ru: 'Глава пути завершена — хорошая пауза',
  },
  unlockOne: {
    ka: 'ახალი გაჩერება გაიხსნა',
    en: 'A Journey milestone unlocked',
    fr: 'Une étape du voyage débloquée',
    ru: 'Открыта остановка пути',
  },
  viewJourney: {
    ka: 'მოგზაურობის ნახვა',
    en: 'View Journey',
    fr: 'Voir le voyage',
    ru: 'Открыть путь',
  },
  offlineEquip: {
    ka: 'ოფლაინში სტილის შეცვლა შეუძლებელია',
    en: 'Style changes need a connection',
    fr: 'Le style nécessite une connexion',
    ru: 'Стиль требует подключения',
  },
  progressAlong: {
    ka: 'გზაზე',
    en: 'On the way',
    fr: 'En chemin',
    ru: 'В пути',
  },
  unitsToGo: {
    ka: 'დარჩა',
    en: 'to go',
    fr: 'restants',
    ru: 'ещё',
  },
  homeA11y: {
    ka: 'მედისთან გადასვლა',
    en: 'Open Medi companion',
    fr: 'Ouvrir le compagnon Medi',
    ru: 'Открыть спутника Medi',
  },
} as const;

const MESSAGES: Record<string, LocStr> = {
  COMPANION_MORNING_READY: {
    ka: 'დილა კარგია. მზად ვართ, როცა შენ მზად იქნები.',
    en: 'Good morning. Ready when you are.',
    fr: 'Bonjour. Prêt quand tu l’es.',
    ru: 'Доброе утро. Готов, когда ты готов.',
  },
  COMPANION_QUEST_PROGRESS: {
    ka: 'კარგი ტემპი გაქვს დღეს.',
    en: 'Nice pace today.',
    fr: 'Beau rythme aujourd’hui.',
    ru: 'Хороший темп сегодня.',
  },
  COMPANION_ALL_COMPLETE: {
    ka: 'დღე დახურულია. მშვიდად დაისვენე.',
    en: 'Day wrapped. Rest easy.',
    fr: 'Journée bouclée. Repose-toi.',
    ru: 'День закрыт. Отдыхай спокойно.',
  },
  COMPANION_LEVEL_UP: {
    ka: 'ახალი დონე. შენთან ერთად ვიზრდები.',
    en: 'New level. Growing with you.',
    fr: 'Nouveau niveau. Je grandis avec toi.',
    ru: 'Новый уровень. Расту вместе с тобой.',
  },
  COMPANION_ACHIEVEMENT: {
    ka: 'ეს მიღწევა შენია. ამაყი ვარ.',
    en: 'That achievement is yours. Proud of you.',
    fr: 'Ce succès est à toi. Fier de toi.',
    ru: 'Это достижение твоё. Горжусь.',
  },
  COMPANION_COMEBACK: {
    ka: 'კარგია, რომ დაბრუნდი.',
    en: 'Good to see you back.',
    fr: 'Content de te revoir.',
    ru: 'Рад, что ты вернулся.',
  },
  COMPANION_REWARD_REDEEMED: {
    ka: 'ლამაზი არჩევანი.',
    en: 'Nice pick.',
    fr: 'Beau choix.',
    ru: 'Хороший выбор.',
  },
  COMPANION_RAIN: {
    ka: 'წვიმაა გარეთ. შიგნით მშვიდად ვრჩებით.',
    en: 'Rain outside. We’ll stay steady inside.',
    fr: 'Il pleut dehors. On reste calmes ici.',
    ru: 'Снаружи дождь. Здесь держим спокойствие.',
  },
  COMPANION_EVENING: {
    ka: 'საღამოა. ნელი ტემპი საკმარისია.',
    en: 'Evening. A gentle pace is enough.',
    fr: 'Soirée. Un rythme doux suffit.',
    ru: 'Вечер. Спокойного темпа достаточно.',
  },
  COMPANION_CALM: {
    ka: 'აქ ვარ. მშვიდად.',
    en: 'I’m here. Steady.',
    fr: 'Je suis là. Calme.',
    ru: 'Я здесь. Спокойно.',
  },
  COMPANION_CHEERFUL: {
    ka: 'კარგი დღეა ერთად.',
    en: 'A good day to be together.',
    fr: 'Belle journée ensemble.',
    ru: 'Хороший день вместе.',
  },
  COMPANION_FOCUSED: {
    ka: 'ერთ ნაბიჯზე ვფოკუსირდებით.',
    en: 'One step at a time.',
    fr: 'Un pas après l’autre.',
    ru: 'Шаг за шагом.',
  },
  COMPANION_EXCITED: {
    ka: 'რაღაც ლამაზი მოხდა.',
    en: 'Something bright just happened.',
    fr: 'Quelque chose de beau vient d’arriver.',
    ru: 'Случилось что-то светлое.',
  },
  COMPANION_CURIOUS: {
    ka: 'რა გელოდება შემდეგ?',
    en: 'What comes next?',
    fr: 'Que vient ensuite ?',
    ru: 'Что дальше?',
  },
};

const CHAPTERS: Record<string, LocStr> = {
  'companion.journey.chapter.1': {
    ka: 'პირველი გზა',
    en: 'First path',
    fr: 'Premier chemin',
    ru: 'Первый путь',
  },
  'companion.journey.chapter.2': {
    ka: 'მშვიდი რიტმი',
    en: 'Quiet rhythm',
    fr: 'Rythme calme',
    ru: 'Тихий ритм',
  },
  'companion.journey.chapter.3': {
    ka: 'უფრო შორს',
    en: 'Farther on',
    fr: 'Plus loin',
    ru: 'Дальше',
  },
  'companion.journey.chapter.4': {
    ka: 'ღრმა კვალი',
    en: 'Deeper trail',
    fr: 'Sentier plus profond',
    ru: 'Глубже по тропе',
  },
  'companion.journey.chapter.5': {
    ka: 'გრძელი ჰორიზონტი',
    en: 'Long horizon',
    fr: 'Long horizon',
    ru: 'Дальний горизонт',
  },
};

/** Warm milestone titles — not grind language. */
const MILESTONE_TITLES: LocStr[] = [
  { ka: 'პირველი ნაბიჯი', en: 'First step', fr: 'Premier pas', ru: 'Первый шаг' },
  { ka: 'მსუბუქი სუნთქვა', en: 'Easy breath', fr: 'Souffle léger', ru: 'Лёгкое дыхание' },
  { ka: 'პატარა შუქი', en: 'Small light', fr: 'Petite lumière', ru: 'Маленький свет' },
  { ka: 'სტაბილური დღე', en: 'Steady day', fr: 'Jour stable', ru: 'Спокойный день' },
  { ka: 'თავი I — დასაწყისი', en: 'Chapter I — beginning', fr: 'Chapitre I — début', ru: 'Глава I — начало' },
  { ka: 'რბილი ტემპი', en: 'Soft pace', fr: 'Rythme doux', ru: 'Мягкий темп' },
  { ka: 'ახალი ჩრდილი', en: 'New shade', fr: 'Nouvelle nuance', ru: 'Новый оттенок' },
  { ka: 'შუა გზა', en: 'Mid trail', fr: 'Mi-chemin', ru: 'Середина тропы' },
  { ka: 'უფრო მკაფიო', en: 'Clearer now', fr: 'Plus clair', ru: 'Яснее' },
  { ka: 'თავი II — რიტმი', en: 'Chapter II — rhythm', fr: 'Chapitre II — rythme', ru: 'Глава II — ритм' },
  { ka: 'შორი ხედი', en: 'Wider view', fr: 'Vue plus large', ru: 'Шире взгляд' },
  { ka: 'მშვიდი ძალა', en: 'Quiet strength', fr: 'Force calme', ru: 'Тихая сила' },
  { ka: 'ღია ცა', en: 'Open sky', fr: 'Ciel ouvert', ru: 'Открытое небо' },
  { ka: 'ღრმა ფერი', en: 'Deep color', fr: 'Couleur profonde', ru: 'Глубокий цвет' },
  { ka: 'თავი III — სიმაღლე', en: 'Chapter III — rise', fr: 'Chapitre III — élévation', ru: 'Глава III — подъём' },
  { ka: 'გრძელი სუნთქვა', en: 'Long breath', fr: 'Long souffle', ru: 'Длинный вдох' },
  { ka: 'თბილი კვალი', en: 'Warm trail', fr: 'Sentier chaud', ru: 'Тёплая тропа' },
  { ka: 'მყარი ნაბიჯი', en: 'Firm step', fr: 'Pas ferme', ru: 'Уверенный шаг' },
  { ka: 'შორი სინათლე', en: 'Distant glow', fr: 'Lueur lointaine', ru: 'Далёкое сияние' },
  { ka: 'თავი IV — სიღრმე', en: 'Chapter IV — depth', fr: 'Chapitre IV — profondeur', ru: 'Глава IV — глубина' },
  { ka: 'მშვიდი ჰორიზონტი', en: 'Calm horizon', fr: 'Horizon calme', ru: 'Спокойный горизонт' },
  { ka: 'უფრო ახლოს', en: 'Closer still', fr: 'Encore plus près', ru: 'Ещё ближе' },
  { ka: 'რბილი შუქი', en: 'Soft glow', fr: 'Lueur douce', ru: 'Мягкое свечение' },
  { ka: 'გრძელი ხედი', en: 'Long view', fr: 'Longue vue', ru: 'Дальний взгляд' },
  { ka: 'თავი V — ჰორიზონტი', en: 'Chapter V — horizon', fr: 'Chapitre V — horizon', ru: 'Глава V — горизонт' },
];

const MILESTONE_BODIES: LocStr[] = [
  { ka: 'მცირე დასაწყისი, მშვიდი ტონი.', en: 'A small start, a calm tone.', fr: 'Un petit début, un ton calme.', ru: 'Маленькое начало, спокойный тон.' },
  { ka: 'გზა რბილად იხსნება.', en: 'The path opens gently.', fr: 'Le chemin s’ouvre doucement.', ru: 'Путь открывается мягко.' },
  { ka: 'შენი ტემპი საკმარისია.', en: 'Your pace is enough.', fr: 'Ton rythme suffit.', ru: 'Твоего темпа достаточно.' },
  { ka: 'დღეები ერთმანეთს ებმის.', en: 'Days begin to connect.', fr: 'Les jours se relient.', ru: 'Дни начинают связываться.' },
  { ka: 'პირველი თავი დასრულდა.', en: 'First chapter complete.', fr: 'Premier chapitre terminé.', ru: 'Первая глава завершена.' },
  { ka: 'რიტმი უფრო ბუნებრივია.', en: 'The rhythm feels more natural.', fr: 'Le rythme paraît plus naturel.', ru: 'Ритм становится естественнее.' },
  { ka: 'ახალი ფერი ჩნდება.', en: 'A new shade appears.', fr: 'Une nouvelle nuance apparaît.', ru: 'Появляется новый оттенок.' },
  { ka: 'შუა გზაზე ხარ.', en: 'You’re mid-trail.', fr: 'Tu es à mi-chemin.', ru: 'Ты на середине тропы.' },
  { ka: 'უფრო მკაფიო გრძნობა.', en: 'A clearer feeling.', fr: 'Une sensation plus claire.', ru: 'Чувство становится яснее.' },
  { ka: 'მეორე თავი იხსნება.', en: 'Second chapter opens.', fr: 'Le deuxième chapitre s’ouvre.', ru: 'Открывается вторая глава.' },
  { ka: 'ხედი ფართოვდება.', en: 'The view widens.', fr: 'La vue s’élargit.', ru: 'Взгляд расширяется.' },
  { ka: 'სიძლიერე მშვიდია.', en: 'Strength stays quiet.', fr: 'La force reste calme.', ru: 'Сила остаётся тихой.' },
  { ka: 'ცა უფრო ღიაა.', en: 'The sky feels open.', fr: 'Le ciel paraît ouvert.', ru: 'Небо кажется открытым.' },
  { ka: 'ფერი ღრმავდება.', en: 'Color deepens.', fr: 'La couleur s’approfondit.', ru: 'Цвет углубляется.' },
  { ka: 'მესამე თავი დასრულდა.', en: 'Third chapter complete.', fr: 'Troisième chapitre terminé.', ru: 'Третья глава завершена.' },
  { ka: 'სუნთქვა გრძელდება.', en: 'The breath lengthens.', fr: 'Le souffle s’allonge.', ru: 'Дыхание удлиняется.' },
  { ka: 'კვალი თბილია.', en: 'The trail feels warm.', fr: 'Le sentier est chaud.', ru: 'Тропа тёплая.' },
  { ka: 'ნაბიჯი უფრო მყარია.', en: 'Each step feels firmer.', fr: 'Chaque pas est plus ferme.', ru: 'Шаг увереннее.' },
  { ka: 'შორი სინათლე ჩანს.', en: 'A distant glow shows.', fr: 'Une lueur lointaine apparaît.', ru: 'Видно далёкое сияние.' },
  { ka: 'მეოთხე თავი დასრულდა.', en: 'Fourth chapter complete.', fr: 'Quatrième chapitre terminé.', ru: 'Четвёртая глава завершена.' },
  { ka: 'ჰორიზონტი მშვიდია.', en: 'The horizon is calm.', fr: 'L’horizon est calme.', ru: 'Горизонт спокоен.' },
  { ka: 'უფრო ახლოს ხარ.', en: 'You’re closer still.', fr: 'Tu es encore plus près.', ru: 'Ты ещё ближе.' },
  { ka: 'შუქი რბილია.', en: 'The glow is soft.', fr: 'La lueur est douce.', ru: 'Свечение мягкое.' },
  { ka: 'ხედი გრძელია.', en: 'The view stretches far.', fr: 'La vue s’étend loin.', ru: 'Взгляд уходит далеко.' },
  { ka: 'ბოლო თავი — ჰორიზონტი.', en: 'Final chapter — horizon.', fr: 'Dernier chapitre — horizon.', ru: 'Последняя глава — горизонт.' },
];

const COSMETIC_DEFAULT: Record<string, { title: LocStr; description: LocStr }> = {
  'companion.cosmetic.default_accent.title': {
    title: { ka: 'თეალი ბირთვი', en: 'Teal core', fr: 'Cœur teal', ru: 'Бирюзовое ядро' },
    description: { ka: 'მედის ბაზისური აქცენტი.', en: "Medi's base accent.", fr: 'Accent de base de Medi.', ru: 'Базовый акцент Medi.' },
  },
  'companion.cosmetic.default_accent.description': {
    title: { ka: 'თეალი ბირთვი', en: 'Teal core', fr: 'Cœur teal', ru: 'Бирюзовое ядро' },
    description: { ka: 'მედის ბაზისური აქცენტი.', en: "Medi's base accent.", fr: 'Accent de base de Medi.', ru: 'Базовый акцент Medi.' },
  },
  'companion.cosmetic.default_bg.title': {
    title: { ka: 'მშვიდი ნეივი', en: 'Calm navy', fr: 'Bleu marine calme', ru: 'Спокойный navy' },
    description: { ka: 'რბილი ფონი სახლისთვის.', en: 'A soft home backdrop.', fr: 'Un fond doux pour la maison.', ru: 'Мягкий фон для дома.' },
  },
  'companion.cosmetic.default_bg.description': {
    title: { ka: 'მშვიდი ნეივი', en: 'Calm navy', fr: 'Bleu marine calme', ru: 'Спокойный navy' },
    description: { ka: 'რბილი ფონი სახლისთვის.', en: 'A soft home backdrop.', fr: 'Un fond doux pour la maison.', ru: 'Мягкий фон для дома.' },
  },
};

const COSMETIC_FLAVORS: LocStr[] = []; // unused — Journey names live in cosmeticNames.ts

const COSMETIC_DESCS: LocStr[] = [];

function milestoneKey(i: number) {
  return `milestone_${String(i).padStart(2, '0')}`;
}

function cosmeticKey(i: number) {
  return `cosmetic_milestone_${String(i).padStart(2, '0')}`;
}

export function companionCopy(locale = 'ka') {
  return {
    title: pick(UI.title, locale),
    subtitle: pick(UI.subtitle, locale),
    stage: pick(UI.stage, locale),
    level: pick(UI.level, locale),
    todaysQuest: pick(UI.todaysQuest, locale),
    journey: pick(UI.journey, locale),
    achievements: pick(UI.achievements, locale),
    collection: pick(UI.collection, locale),
    style: pick(UI.style, locale),
    talk: pick(UI.talk, locale),
    nextStop: pick(UI.nextStop, locale),
    youAreHere: pick(UI.youAreHere, locale),
    locked: pick(UI.locked, locale),
    unlocked: pick(UI.unlocked, locale),
    equip: pick(UI.equip, locale),
    equipped: pick(UI.equipped, locale),
    unequip: pick(UI.unequip, locale),
    slotAccent: pick(UI.slotAccent, locale),
    slotAccessory: pick(UI.slotAccessory, locale),
    slotBackground: pick(UI.slotBackground, locale),
    slotDecoration: pick(UI.slotDecoration, locale),
    offline: pick(UI.offline, locale),
    loadError: pick(UI.loadError, locale),
    retry: pick(UI.retry, locale),
    emptyCollection: pick(UI.emptyCollection, locale),
    journeyComplete: pick(UI.journeyComplete, locale),
    unlockOne: pick(UI.unlockOne, locale),
    unlockFew: (n: number) =>
      pick(
        {
          ka: `${n} გაჩერება გაიხსნა`,
          en: `${n} Journey milestones unlocked`,
          fr: `${n} étapes débloquées`,
          ru: `Открыто остановок: ${n}`,
        },
        locale,
      ),
    unlockMany: (n: number) =>
      pick(
        {
          ka: `მოგზაურობა დაგეწია — ${n} გაჩერება გაიხსნა`,
          en: `Your Journey caught up — ${n} milestones unlocked`,
          fr: `Ton voyage a rattrapé — ${n} étapes`,
          ru: `Путь догнал — открыто ${n}`,
        },
        locale,
      ),
    viewJourney: pick(UI.viewJourney, locale),
    offlineEquip: pick(UI.offlineEquip, locale),
    progressAlong: pick(UI.progressAlong, locale),
    homeA11y: pick(UI.homeA11y, locale),
    unitsToGo: (n: number) =>
      pick(
        {
          ka: `${n} მისია დარჩა შემდეგ გაჩერებამდე`,
          en: `${n} missions to the next stop`,
          fr: `${n} missions jusqu’au prochain arrêt`,
          ru: `${n} миссий до следующей остановки`,
        },
        locale,
      ),
  };
}

export function companionMessage(messageKey: string | null | undefined, locale = 'ka'): string {
  if (!messageKey) return pick(MESSAGES.COMPANION_CALM, locale);
  const hit = MESSAGES[messageKey];
  return hit ? pick(hit, locale) : pick(MESSAGES.COMPANION_CALM, locale);
}

export function companionChapterTitle(chapterKey: string | null | undefined, locale = 'ka'): string {
  if (!chapterKey) return '';
  const mapKey = `companion.journey.chapter.${chapterKey.replace('CHAPTER_', '')}`;
  const hit = CHAPTERS[mapKey] || CHAPTERS[`companion.journey.chapter.${chapterKey}`];
  if (hit) return pick(hit, locale);
  const byKey = CHAPTERS[`companion.journey.${chapterKey.toLowerCase()}`];
  if (byKey) return pick(byKey, locale);
  // Direct CHAPTER_N → companion.journey.chapter.N
  const n = chapterKey.match(/CHAPTER_(\d+)/)?.[1];
  if (n && CHAPTERS[`companion.journey.chapter.${n}`]) {
    return pick(CHAPTERS[`companion.journey.chapter.${n}`], locale);
  }
  return chapterKey;
}

export function companionMilestoneTitle(titleKey: string | null | undefined, locale = 'ka'): string {
  if (!titleKey) return '';
  const m = titleKey.match(/milestone_(\d{2})/i) || titleKey.match(/MILESTONE_(\d{2})/i);
  if (m) {
    const idx = Number(m[1]) - 1;
    if (idx >= 0 && idx < MILESTONE_TITLES.length) return pick(MILESTONE_TITLES[idx], locale);
  }
  return titleKey;
}

export function companionMilestoneBody(descriptionKey: string | null | undefined, locale = 'ka'): string {
  if (!descriptionKey) return '';
  const m = descriptionKey.match(/milestone_(\d{2})/i) || descriptionKey.match(/MILESTONE_(\d{2})/i);
  if (m) {
    const idx = Number(m[1]) - 1;
    if (idx >= 0 && idx < MILESTONE_BODIES.length) return pick(MILESTONE_BODIES[idx], locale);
  }
  return '';
}

export function companionCosmeticTitle(titleKey: string | null | undefined, locale = 'ka'): string {
  if (!titleKey) return '';
  const def = COSMETIC_DEFAULT[titleKey];
  if (def) return pick(def.title, locale);
  const m = titleKey.match(/cosmetic_milestone_(\d{2})/i) || titleKey.match(/COSMETIC_MILESTONE_(\d{2})/i);
  if (m) {
    const idx = Number(m[1]) - 1;
    if (idx >= 0 && idx < JOURNEY_COSMETIC_NAMES.length) {
      return pick(JOURNEY_COSMETIC_NAMES[idx].title, locale);
    }
  }
  return companionMilestoneTitle(titleKey, locale) || titleKey;
}

export function companionCosmeticBody(descriptionKey: string | null | undefined, locale = 'ka'): string {
  if (!descriptionKey) return '';
  const def = COSMETIC_DEFAULT[descriptionKey];
  if (def) return pick(def.description, locale);
  const m = descriptionKey.match(/cosmetic_milestone_(\d{2})/i) || descriptionKey.match(/COSMETIC_MILESTONE_(\d{2})/i);
  if (m) {
    const idx = Number(m[1]) - 1;
    if (idx >= 0 && idx < JOURNEY_COSMETIC_NAMES.length) {
      return pick(JOURNEY_COSMETIC_NAMES[idx].description, locale);
    }
  }
  return companionMilestoneBody(descriptionKey, locale);
}

export function companionSlotLabel(slot: string, locale = 'ka'): string {
  const copy = companionCopy(locale);
  if (slot === 'accent') return copy.slotAccent;
  if (slot === 'accessory') return copy.slotAccessory;
  if (slot === 'background') return copy.slotBackground;
  if (slot === 'decoration') return copy.slotDecoration;
  return slot;
}

export function companionStageLabel(stage: string | null | undefined, locale = 'ka'): string {
  const n = stage?.match(/STAGE_(\d+)/)?.[1] || '1';
  return `${companionCopy(locale).stage} ${n}`;
}

/** Expose keys for fixtures / tests. */
export const COMPANION_COPY_META = {
  milestoneKey,
  cosmeticKey,
  messageKeys: Object.keys(MESSAGES),
};
