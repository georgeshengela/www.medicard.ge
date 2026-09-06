/**
 * Quest copy namespaces (logical):
 * quest.common / home / hub / status / claim / level / rank / streak /
 * daily / weekly / history / wallet / setup / error
 */
const RANKS = {
  ka: {
    LEVEL_1_4: 'დამწყები',
    LEVEL_5_9: 'მოძრაობაში',
    LEVEL_10_14: 'რიტმში',
    LEVEL_15_19: 'ძლიერი რიტმი',
    LEVEL_20_29: 'ჩვევა',
    LEVEL_30_39: 'დარწმუნებული გზა',
    LEVEL_40_49: 'რიტმის ოსტატი',
    LEVEL_50_PLUS: 'Medi ლეგენდა',
  },
  en: {
    LEVEL_1_4: 'Newcomer',
    LEVEL_5_9: 'In motion',
    LEVEL_10_14: 'In rhythm',
    LEVEL_15_19: 'Strong rhythm',
    LEVEL_20_29: 'A habit',
    LEVEL_30_39: 'Steady path',
    LEVEL_40_49: 'Rhythm master',
    LEVEL_50_PLUS: 'Medi legend',
  },
  fr: {
    LEVEL_1_4: 'Débutant',
    LEVEL_5_9: 'En mouvement',
    LEVEL_10_14: 'Dans le rythme',
    LEVEL_15_19: 'Rythme solide',
    LEVEL_20_29: 'Une habitude',
    LEVEL_30_39: 'Chemin assuré',
    LEVEL_40_49: 'Maître du rythme',
    LEVEL_50_PLUS: 'Légende Medi',
  },
  ru: {
    LEVEL_1_4: 'Новичок',
    LEVEL_5_9: 'В движении',
    LEVEL_10_14: 'В ритме',
    LEVEL_15_19: 'Сильный ритм',
    LEVEL_20_29: 'Привычка',
    LEVEL_30_39: 'Уверенный путь',
    LEVEL_40_49: 'Мастер ритма',
    LEVEL_50_PLUS: 'Легенда Medi',
  },
};

const TEXT = {
  ka: {
    section: 'Medi Quest',
    open: 'გახსენი Medi Quest',
    claim: 'მიღება',
    claimReward: 'ჯილდოს მიღება',
    empty: 'დღეს Medi ჯერ არ მოამზადა მისიები.',
    stale: 'მონაცემები შეიძლება არ იყოს განახლებული',
    today: 'დღეს',
    weekly: 'კვირის მისია',
    untilSunday: 'კვირამდე',
    history: 'ისტორია',
    wallet: 'ბალანსი',
    retry: 'ხელახლა',
    completed: 'მისია შესრულდა',
    claimed: 'ჯილდო მიღებულია',
    expired: 'ვადა ამოიწურა',
    offlineClaim: 'ჯილდოს მიღება შეიძლება კავშირის აღდგენის შემდეგ',
    level: 'დონე',
    levelUp: 'ახალი დონე',
    continue: 'გაგრძელება',
    streakStart: 'დაიწყე სერია დღეს',
    streakHint: 'სერია გრძელდება, როცა ასრულებ ერთ დღიურ მისიას მაინც.',
    stepsTitle: 'მოკლე გასეირნება',
    stepsBody: 'ნელი ნაბიჯებით, შენი ტემპით.',
    stepsZero: 'დავიწყოთ პირველი პატარა ნაბიჯით.',
    stepsNear: 'ცოტაც — და მისია მზადაა.',
    hydroTitle: 'წყლის ბალანსი',
    hydroBody: 'დალიე შენი დღიური მიზანი, ზედმეტის გარეშე.',
    mediTitle: 'ესაუბრე Medi-ს',
    mediBody: 'დღეს ერთი ნამდვილი საუბარი საკმარისია.',
    openMedi: 'გახსენი Medi',
    weeklySteps: 'კვირის ნაბიჯები',
    historyEmpty: 'შესრულებული მისიები აქ გამოჩნდება.',
    earned: 'სულ მიღებული',
    walletEmpty: 'Medi Coins გამოჩნდება, როცა ჯილდოს მიიღებ.',
    setupSteps: 'დააკავშირე ნაბიჯები და Medi გაგიხსნის მოძრაობის მისიებს.',
    connect: 'დაკავშირება',
    setupHydro: 'დააყენე წყლის მიზანი წყლის მისიებისთვის.',
    setGoal: 'მიზნის დაყენება',
    loadError: 'Medi Quest ვერ განახლდა.',
    toastDone: 'მისია შესრულდა 🎉',
    weatherBest: (start, end) => `საუკეთესო დრო: ${start}–${end}`,
    days: 'ორშ–კვი',
    coinsName: 'Medi Coins',
    rewardReady: 'ჯილდო მზადაა',
    connectToClaim: 'დაკავშირება ჯილდოს მისაღებად',
    loadMore: 'კიდევ',
    view: 'ნახვა',
    yesterday: 'გუშინ',
    recent: 'ბოლო აქტივობა',
    unlockSteps: 'გახსენი მოძრაობის მისიები',
    unlockHydro: 'გახსენი წყლის მისიები',
    mission: 'მისია',
    back: 'უკან',
    dailyMissions: 'დღის მისიები',
    maxLevel: 'მაქსიმალური დონე',
    streakLabel: 'სერია',
    balanceLabel: 'ბალანსი',
    allDoneToday: 'დღეს ყველაფერი შესრულებულია',
    tapToOpen: 'ყველა მისია',
    mood: {
      fresh_day: ['დღეს მშვიდად დავიწყოთ 💚', 'ერთი პატარა ნაბიჯიც კარგი დღეა.'],
      progress_started: ['ნელა ვაგრძელებთ.', 'დღეს ჯერ კიდევ არის დრო.'],
      one_completed: ['პირველი უკვე ჩვენია 😄', 'კარგი დასაწყისია.'],
      near_completion: ['ცოტაც დარჩა 🔥', 'ბოლო ნაბიჯები რბილია.'],
      all_daily_complete: ['დღეს ყველაფერი მზადაა. კარგი დღეა 🎉', 'შეგიძლია მშვიდად დაისვენო.'],
      reward_waiting: ['რაღაც გელოდება 👀', 'ჯილდო მზადაა.'],
      level_up: ['ახალი დონე. ლამაზად მივდივართ 😄'],
    },
  },
  en: {
    section: 'Medi Quest',
    open: 'Open Medi Quest',
    claim: 'Claim',
    claimReward: 'Claim reward',
    empty: 'Medi has not prepared missions yet today.',
    stale: 'Data may be out of date',
    today: 'Today',
    weekly: 'This week’s mission',
    untilSunday: 'Until Sunday',
    history: 'History',
    wallet: 'Balance',
    retry: 'Try again',
    completed: 'Mission complete',
    claimed: 'Reward claimed',
    expired: 'Expired',
    offlineClaim: 'You can claim the reward once you are back online',
    level: 'Level',
    levelUp: 'New level',
    continue: 'Continue',
    streakStart: 'Start a streak today',
    streakHint: 'Your streak continues when you complete at least one daily mission.',
    stepsTitle: 'A short walk',
    stepsBody: 'At your own pace.',
    stepsZero: 'Start with one small step.',
    stepsNear: 'A little more and this mission is done.',
    hydroTitle: 'Water balance',
    hydroBody: 'Reach your goal, nothing extra.',
    mediTitle: 'Check in with Medi',
    mediBody: 'One real conversation with Medi is enough.',
    openMedi: 'Open Medi',
    weeklySteps: 'Weekly steps',
    historyEmpty: 'Your completed missions will appear here.',
    earned: 'Total earned',
    walletEmpty: 'Your Medi Coins will appear here when you claim rewards.',
    setupSteps: 'Connect step tracking and Medi can create movement missions.',
    connect: 'Connect',
    setupHydro: 'Set a water goal to receive hydration missions.',
    setGoal: 'Set goal',
    loadError: 'Couldn’t refresh Medi Quest.',
    toastDone: 'Mission complete 🎉',
    rewardReady: 'Reward ready',
    connectToClaim: 'Connect to claim your reward.',
    loadMore: 'More',
    view: 'View',
    yesterday: 'Yesterday',
    recent: 'Recent activity',
    unlockSteps: 'Unlock movement missions',
    unlockHydro: 'Unlock hydration missions',
    mission: 'Mission',
    back: 'Back',
    weatherBest: (start, end) => `Best time: ${start}–${end}`,
    days: 'Mon–Sun',
    coinsName: 'Medi Coins',
    dailyMissions: 'Daily missions',
    maxLevel: 'Max level',
    streakLabel: 'Streak',
    balanceLabel: 'Balance',
    allDoneToday: 'Everything is done for today',
    tapToOpen: 'All missions',
    mood: {
      fresh_day: ['Let’s start the day gently 💚', 'Even one small step is a good day.', 'Today can stay unhurried.'],
      progress_started: ['We keep going, steadily.', 'There is still time today.', 'Small progress still counts.'],
      one_completed: ['The first one is ours 😄', 'A good start.', 'Even one mission is a good day.'],
      near_completion: ['Almost there 🔥', 'The last stretch can stay calm.', 'Just a little left.'],
      all_daily_complete: ['That’s all for today. A good day 🎉', 'You can rest easy.', 'Today’s rhythm is complete.'],
      reward_waiting: ['Something is waiting for you 👀', 'A reward is ready.', 'Claim it when you like.'],
      level_up: ['New level. Beautifully done 😄', 'A quiet step forward.'],
    },
  },
  fr: {
    section: 'Medi Quest',
    open: 'Ouvrir Medi Quest',
    claim: 'Récupérer',
    claimReward: 'Récupérer la récompense',
    empty: 'Medi n’a pas encore préparé de missions aujourd’hui.',
    stale: 'Les données peuvent ne pas être à jour',
    today: 'Aujourd’hui',
    weekly: 'Mission de la semaine',
    untilSunday: 'Jusqu’à dimanche',
    history: 'Historique',
    wallet: 'Solde',
    retry: 'Réessayer',
    completed: 'Mission accomplie',
    claimed: 'Récompense reçue',
    expired: 'Expirée',
    offlineClaim: 'La récompense pourra être récupérée une fois reconnecté',
    level: 'Niveau',
    levelUp: 'Nouveau niveau',
    continue: 'Continuer',
    streakStart: 'Commence ta série aujourd’hui',
    streakHint: 'La série continue dès qu’une mission du jour est accomplie.',
    stepsTitle: 'Une petite marche',
    stepsBody: 'À ton rythme, sans te presser.',
    stepsZero: 'Commençons par un petit pas.',
    stepsNear: 'Encore un peu — et c’est bon.',
    hydroTitle: 'Équilibre hydrique',
    hydroBody: 'Atteins ton objectif, sans forcer.',
    mediTitle: 'Passe voir Medi',
    mediBody: 'Une vraie conversation avec Medi suffit.',
    openMedi: 'Ouvrir Medi',
    weeklySteps: 'Pas de la semaine',
    historyEmpty: 'Tes missions accomplies apparaîtront ici.',
    earned: 'Total gagné',
    walletEmpty: 'Tes Medi Coins apparaîtront ici après une récompense.',
    setupSteps: 'Connecte tes pas pour ouvrir les missions de mouvement.',
    connect: 'Connecter',
    setupHydro: 'Définis un objectif d’eau pour ouvrir les missions d’hydratation.',
    setGoal: 'Définir l’objectif',
    loadError: 'Impossible d’actualiser Medi Quest.',
    toastDone: 'Mission accomplie 🎉',
    rewardReady: 'Récompense prête',
    connectToClaim: 'Reconnecte-toi pour récupérer la récompense.',
    loadMore: 'Encore',
    view: 'Voir',
    yesterday: 'Hier',
    recent: 'Activité récente',
    unlockSteps: 'Ouvrir les missions de mouvement',
    unlockHydro: 'Ouvrir les missions d’hydratation',
    mission: 'Mission',
    back: 'Retour',
    weatherBest: (start, end) => `Meilleur moment : ${start}–${end}`,
    days: 'Lun–Dim',
    coinsName: 'Medi Coins',
    dailyMissions: 'Missions du jour',
    maxLevel: 'Niveau max',
    streakLabel: 'Série',
    balanceLabel: 'Solde',
    allDoneToday: 'Tout est fait pour aujourd’hui',
    tapToOpen: 'Toutes les missions',
    mood: {
      fresh_day: ['On commence doucement aujourd’hui 💚', 'Un petit pas suffit pour bien commencer.', 'Aujourd’hui, sans se presser.'],
      progress_started: ['On avance, sans se presser.', 'Il reste encore du temps aujourd’hui.', 'Chaque petit pas compte.'],
      one_completed: ['La première est à nous 😄', 'Belle entame.', 'Une mission suffit déjà pour une belle journée.'],
      near_completion: ['Plus que très peu 🔥', 'Les derniers pas sont les plus doux.', 'Presque prêt.'],
      all_daily_complete: ['C’est tout pour aujourd’hui. Belle journée 🎉', 'Tu peux souffler.', 'Le rythme du jour est complet.'],
      reward_waiting: ['Quelque chose t’attend 👀', 'La récompense est prête.', 'Tu peux la prendre quand tu veux.'],
      level_up: ['Nouveau niveau. On avance joliment 😄', 'Un pas calme en avant.'],
    },
  },
  ru: {
    section: 'Medi Quest',
    open: 'Открыть Medi Quest',
    claim: 'Получить',
    claimReward: 'Получить награду',
    empty: 'Сегодня Medi пока не подготовил миссий.',
    stale: 'Данные могут быть не обновлены',
    today: 'Сегодня',
    weekly: 'Миссия недели',
    untilSunday: 'До воскресенья',
    history: 'История',
    wallet: 'Баланс',
    retry: 'Повторить',
    completed: 'Миссия выполнена',
    claimed: 'Награда получена',
    expired: 'Истекла',
    offlineClaim: 'Награду можно получить после подключения',
    level: 'Уровень',
    levelUp: 'Новый уровень',
    continue: 'Продолжить',
    streakStart: 'Начни серию сегодня',
    streakHint: 'Серия продолжается, когда ты выполняешь хотя бы одну ежедневную миссию.',
    stepsTitle: 'Небольшая прогулка',
    stepsBody: 'Спокойным шагом, в своём темпе.',
    stepsZero: 'Начнём с первого небольшого шага.',
    stepsNear: 'Ещё немного — и миссия готова.',
    hydroTitle: 'Водный баланс',
    hydroBody: 'Дойди до цели — без лишнего.',
    mediTitle: 'Загляни к Medi',
    mediBody: 'Поговори с Medi сегодня.',
    openMedi: 'Открыть Medi',
    weeklySteps: 'Шаги недели',
    historyEmpty: 'Выполненные миссии появятся здесь.',
    earned: 'Всего получено',
    walletEmpty: 'Medi Coins появятся здесь, когда ты получишь награду.',
    setupSteps: 'Подключи шаги, и Medi откроет миссии движения.',
    connect: 'Подключить',
    setupHydro: 'Настрой цель воды, чтобы открыть водные миссии.',
    setGoal: 'Настроить цель',
    loadError: 'Не удалось обновить Medi Quest.',
    toastDone: 'Миссия выполнена 🎉',
    rewardReady: 'Награда готова',
    connectToClaim: 'Подключись, чтобы получить награду.',
    loadMore: 'Ещё',
    view: 'Смотреть',
    yesterday: 'Вчера',
    recent: 'Недавняя активность',
    unlockSteps: 'Открой миссии движения',
    unlockHydro: 'Открой водные миссии',
    mission: 'Миссия',
    back: 'Назад',
    weatherBest: (start, end) => `Лучшее время: ${start}–${end}`,
    days: 'Пн–Вс',
    coinsName: 'Medi Coins',
    dailyMissions: 'Миссии дня',
    maxLevel: 'Максимальный уровень',
    streakLabel: 'Серия',
    balanceLabel: 'Баланс',
    allDoneToday: 'На сегодня всё выполнено',
    tapToOpen: 'Все миссии',
    mood: {
      fresh_day: ['Сегодня начинаем спокойно 💚', 'Даже один шаг — уже хороший день.', 'Сегодня без спешки.'],
      progress_started: ['Продолжаем постепенно.', 'Сегодня ещё есть время.', 'Маленький прогресс тоже считается.'],
      one_completed: ['Первая уже наша 😄', 'Хорошее начало.', 'Даже одна миссия — уже хороший день.'],
      near_completion: ['Осталось совсем немного 🔥', 'Последние шаги — самые спокойные.', 'Почти готово.'],
      all_daily_complete: ['На сегодня всё. Хороший день 🎉', 'Можно спокойно выдохнуть.', 'Ритм дня закрыт.'],
      reward_waiting: ['Кажется, тут тебя кое-что ждёт 👀', 'Награда готова.', 'Можно забрать, когда будешь готов.'],
      level_up: ['Новый уровень. Красиво идём 😄', 'Тихий шаг вперёд.'],
    },
  },
};

function questCopy(locale = 'ka') {
  const loc = TEXT[locale] ? locale : 'ka';
  const t = TEXT[loc];
  return {
    ...t,
    rank: RANKS[loc],
    coins: 'Medi Coins',
    xp: 'XP',
    progressOf: (done, total) =>
      loc === 'ka'
        ? `დღეს ${done} / ${total}`
        : loc === 'fr'
          ? `Aujourd’hui ${done} / ${total}`
          : loc === 'ru'
            ? `Сегодня ${done} / ${total}`
            : `Today ${done} / ${total}`,
    rewardWaiting: (n) =>
      loc === 'ka'
        ? `${n} ჯილდო გელოდება`
        : loc === 'fr'
          ? `${n} récompense${n > 1 ? 's' : ''} t’attend`
          : loc === 'ru'
            ? `${n} награда ждёт тебя`
            : `${n} reward${n > 1 ? 's' : ''} waiting`,
    xpToNext: (n) =>
      loc === 'ka'
        ? `${n} XP შემდეგ დონემდე`
        : loc === 'fr'
          ? `${n} XP avant le prochain niveau`
          : loc === 'ru'
            ? `${n} XP до следующего уровня`
            : `${n} XP to next level`,
    // Compact form for tight one-line captions (Home card).
    xpLeft: (n) =>
      loc === 'ka'
        ? `${n} XP დარჩა`
        : loc === 'fr'
          ? `${n} XP restants`
          : loc === 'ru'
            ? `осталось ${n} XP`
            : `${n} XP to go`,
    missionsDone: (done, total) =>
      loc === 'ka'
        ? `${done} / ${total} შესრულებულია`
        : loc === 'fr'
          ? `${done} / ${total} accomplies`
          : loc === 'ru'
            ? `${done} / ${total} выполнено`
            : `${done} / ${total} done`,
    streakDays: (n) =>
      loc === 'ka'
        ? `${n} დღე`
        : loc === 'fr'
          ? `${n} jour${n > 1 ? 's' : ''}`
          : loc === 'ru'
            ? `${n} дн.`
            : `${n} day${n === 1 ? '' : 's'}`,
    a11yQuest: (title, progress, target, percent, coins, xp) =>
      loc === 'ka'
        ? `${title}, ${progress} / ${target}, ${percent} პროცენტი, ჯილდო ${coins} Medi Coins და ${xp} XP`
        : `${title}, ${progress} of ${target}, ${percent} percent complete, reward ${coins} Medi Coins and ${xp} XP`,
    levelsUp: (n) =>
      loc === 'ka'
        ? n === 2
          ? 'ორი დონით წინ'
          : `${n} დონით წინ`
        : loc === 'fr'
          ? n === 2
            ? 'Deux niveaux d’un coup'
            : `${n} niveaux d’un coup`
          : loc === 'ru'
            ? n === 2
              ? 'Сразу на два уровня'
              : `На ${n} уровня сразу`
            : n === 2
              ? 'Two levels up'
              : `${n} levels up`,
  };
}

module.exports = { questCopy };
