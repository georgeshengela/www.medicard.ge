// MEDICARD web — Medi Quest (/quest): missions, progress (journey, achievements, history), rewards (wallet,
// store, my rewards, collection) and the invite card. Same endpoints as the app (mobile/app/medi-quest/**).
// Journey math, XP, levels and coin balances always come from the server — never recomputed here.
import {
  h, mount, icon, tile, section, button, busy, badge, empty, skeleton, errorBox, progress, segmented,
  toast, openModal, field, input, fmtDate, fmtDateTime, relDay, fmtNum,
} from '../ui.js';
import { get, post, put, ApiError, invalidate } from '../api.js';
import { ring } from '../charts.js';
import { refreshMe, featureOn } from '../session.js';
import { t, isEn } from '../i18n.js';

const CSS = '/app/css/quest.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

/* ── Copy (mobile/src/i18n/quest/*.js, ka + en) ─────────── */
const RANKS = isEn ? {
  LEVEL_1_4: 'Newcomer', LEVEL_5_9: 'In motion', LEVEL_10_14: 'In rhythm', LEVEL_15_19: 'Strong rhythm',
  LEVEL_20_29: 'A habit', LEVEL_30_39: 'Steady path', LEVEL_40_49: 'Rhythm master', LEVEL_50_PLUS: 'Medi legend',
} : {
  LEVEL_1_4: 'დამწყები', LEVEL_5_9: 'მოძრაობაში', LEVEL_10_14: 'რიტმში', LEVEL_15_19: 'ძლიერი რიტმი',
  LEVEL_20_29: 'ჩვევა', LEVEL_30_39: 'დარწმუნებული გზა', LEVEL_40_49: 'რიტმის ოსტატი', LEVEL_50_PLUS: 'Medi ლეგენდა',
};
function rankKeyFromLevel(level) {
  const n = Number(level) || 1;
  if (n >= 50) return 'LEVEL_50_PLUS';
  if (n >= 40) return 'LEVEL_40_49';
  if (n >= 30) return 'LEVEL_30_39';
  if (n >= 20) return 'LEVEL_20_29';
  if (n >= 15) return 'LEVEL_15_19';
  if (n >= 10) return 'LEVEL_10_14';
  if (n >= 5) return 'LEVEL_5_9';
  return 'LEVEL_1_4';
}
const rankLabel = (key) => RANKS[key] || RANKS.LEVEL_1_4;

const Q = isEn ? {
  completed: 'Mission complete', claimed: 'Reward claimed', expired: 'Expired',
  stepsTitle: 'A short walk', stepsBody: 'At your own pace.', stepsZero: 'Start with one small step.',
  stepsNear: 'A little more and this mission is done.', hydroTitle: 'Water balance', hydroBody: 'Reach your goal, nothing extra.',
  mediTitle: 'Check in with Medi', mediBody: 'One real conversation with Medi is enough.', weeklySteps: 'Weekly steps',
} : {
  completed: 'მისია შესრულდა', claimed: 'ჯილდო მიღებულია', expired: 'ვადა ამოიწურა',
  stepsTitle: 'მოკლე გასეირნება', stepsBody: 'ნელი ნაბიჯებით, შენი ტემპით.', stepsZero: 'დავიწყოთ პირველი პატარა ნაბიჯით.',
  stepsNear: 'ცოტაც — და მისია მზადაა.', hydroTitle: 'წყლის ბალანსი', hydroBody: 'დალიე შენი დღიური მიზანი, ზედმეტის გარეშე.',
  mediTitle: 'ესაუბრე Medi-ს', mediBody: 'დღეს ერთი ნამდვილი საუბარი საკმარისია.', weeklySteps: 'კვირის ნაბიჯები',
};
const WHY = isEn ? {
  title: 'Why this goal?',
  personalized: 'This goal is based on your recent days of activity — a little more movement, without extra pressure.',
  comeback: 'Today’s goal is lighter — what matters is easing back into rhythm.',
  default: 'I’m still getting to know your usual rhythm. In a few days the goal becomes more personal.',
} : {
  title: 'რატომ ეს მიზანი?',
  personalized: 'ეს მიზანი შენს ბოლო დღეების აქტივობას ეყრდნობა — ოდნავ მეტი მოძრაობა, ზედმეტი ზეწოლის გარეშე.',
  comeback: 'დღეს უფრო მსუბუქი მიზანია — მთავარია მშვიდად დაბრუნდე რიტმში.',
  default: 'ჯერ შენს ჩვეულ რიტმს ვეცნობი. რამდენიმე დღის შემდეგ მიზანი უფრო პერსონალური გახდება.',
};

function questKind(q) {
  const type = String(q?.progressType || ''), cadence = String(q?.cadence || ''), key = String(q?.key || '');
  if (type === 'HYDRATION_GOAL_PERCENT' || key.includes('hydration')) return 'hydration';
  if (type === 'MEDI_DAILY_USE' || key.includes('medi')) return 'medi';
  if (cadence === 'WEEKLY' || key.includes('weekly')) return 'weekly';
  return 'movement';
}
function questTitle(q) {
  const k = questKind(q);
  return k === 'hydration' ? Q.hydroTitle : k === 'medi' ? Q.mediTitle : k === 'weekly' ? Q.weeklySteps : Q.stepsTitle;
}
function questHelper(q) {
  const k = questKind(q);
  if (q.claimable) return Q.completed;
  if (q.status === 'CLAIMED') return Q.claimed;
  if (q.status === 'EXPIRED') return Q.expired;
  if (k === 'movement' && q.progress <= 0) return Q.stepsZero;
  if (k === 'movement' && q.progressPercent >= 80) return Q.stepsNear;
  return k === 'hydration' ? Q.hydroBody : k === 'medi' ? Q.mediBody : Q.stepsBody;
}
const pct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
function progressLabel(q) {
  const k = questKind(q);
  if (k === 'hydration') return `${pct(q.progressPercent ?? q.progress)}%`;
  if (k === 'medi') return q.progress >= 1 ? '1 / 1' : '0 / 1';
  const target = Math.max(0, Number(q.target) || 0);
  const shown = target > 0 ? Math.min(Math.max(0, Number(q.progress) || 0), target) : Math.max(0, Number(q.progress) || 0);
  return `${fmtNum(shown)} / ${fmtNum(target)}`;
}
const KIND_LOOK = {
  movement: { icon: 'footprints', ink: 'teal' },
  hydration: { icon: 'droplet', ink: 'sky' },
  medi: { icon: 'sparkles', ink: 'violet' },
  weekly: { icon: 'target', ink: 'amber' },
};

/** Reward-ready missions first; completed ones stay visible at the end (hubPresentation.orderedMissions). */
function orderedMissions(list) {
  const w = (q) => (q.claimable && q.status === 'COMPLETED' ? 0 : q.status === 'ACTIVE' ? 1 : 2);
  return [...(list || [])].sort((a, b) => w(a) - w(b));
}

function levelRing(profile) {
  if (!profile) return { percent: 0, remaining: null, maxed: false };
  const lp = profile.levelProgress || {};
  const next = lp.nextLevelXp == null ? null : Math.max(0, Number(lp.nextLevelXp) || 0);
  const total = Math.max(0, Number(profile.totalXp) || 0);
  return { percent: next == null ? 100 : pct(lp.progressPercent), remaining: next == null ? null : Math.max(0, next - total), maxed: next == null };
}

/** Server claim result → dashboard (hubPresentation.applyClaimToDashboard). */
function applyClaim(dash, result) {
  const upd = (rows) => rows.map((q) => (q.id === result.quest.id ? { ...q, status: result.quest.status, claimable: false, claimedAt: result.quest.claimedAt, completedAt: result.quest.completedAt } : q));
  const daily = upd(dash.daily.quests), weekly = upd(dash.weekly.quests);
  return {
    ...dash,
    profile: dash.profile ? {
      ...dash.profile, level: result.profile.currentLevel, rankKey: rankKeyFromLevel(result.profile.currentLevel),
      totalXp: result.profile.totalXp, coinBalance: result.profile.coinBalance,
      currentStreak: result.profile.currentStreak ?? dash.profile.currentStreak, longestStreak: result.profile.longestStreak ?? dash.profile.longestStreak,
      levelProgress: result.profile.levelProgress,
    } : null,
    daily: { ...dash.daily, quests: daily }, weekly: { ...dash.weekly, quests: weekly },
    summary: { ...dash.summary, dailyClaimable: daily.filter((q) => q.claimable).length, unclaimedRewards: [...daily, ...weekly].filter((q) => q.claimable).length },
  };
}

/* Achievements copy (i18n/quest/achievements.js). */
const enNum = (n) => Number(n || 0).toLocaleString('en-US');
const ACH = isEn ? {
  rarity: { COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary' },
  categories: { PROGRESSION: 'Progress', STREAK: 'Streak', MOVEMENT: 'Movement', HYDRATION: 'Hydration', MEDI: 'Medi', WEEKLY: 'Weekly missions', LEVEL: 'Levels', COINS: 'Medi Coins', SPECIAL: 'Special' },
  fixedTitles: { FIRST_QUEST: 'First mission', FIRST_CLAIM: 'First reward', FIRST_WEEKLY: 'First week', COMEBACK: 'The comeback', EARLY_BIRD: 'Early bird', NIGHT_OWL: 'Night owl' },
  fixedBodies: {
    FIRST_QUEST: 'Complete your very first mission.', FIRST_CLAIM: 'Claim your very first reward.', FIRST_WEEKLY: 'Complete a weekly mission for the first time.',
    COMEBACK: 'Come back after a break — that counts too.', EARLY_BIRD: 'Complete a mission before 8 in the morning.', NIGHT_OWL: 'Complete a mission after 10 in the evening.',
  },
  familyTitles: {
    QUESTS: (n) => `${n} missions`, STREAK: (n) => `${n}-day streak`, MOVE: (n) => `Movement · ${n}`, HYDRATE: (n) => `Hydration · ${n}`,
    MEDI: (n) => `Medi · ${n}`, WEEKLY: (n) => `Weekly · ${n}`, LEVEL: (n) => `Level ${n}`, COINS_EARNED: (n) => `${enNum(n)} Medi Coins`,
  },
  familyBodies: {
    QUESTS: (n) => `Complete ${n} missions in total.`, STREAK: (n) => `Keep your streak alive for ${n} days.`, MOVE: (n) => `Complete ${n} movement missions.`,
    HYDRATE: (n) => `Complete ${n} hydration missions.`, MEDI: (n) => `Complete ${n} Medi missions.`, WEEKLY: (n) => `Complete ${n} weekly missions.`,
    LEVEL: (n) => `Reach level ${n}.`, COINS_EARNED: (n) => `Earn ${enNum(n)} Medi Coins in total.`,
  },
} : {
  rarity: { COMMON: 'ჩვეულებრივი', UNCOMMON: 'იშვიათი', RARE: 'ძვირფასი', EPIC: 'ეპიკური', LEGENDARY: 'ლეგენდარული' },
  categories: { PROGRESSION: 'პროგრესი', STREAK: 'სერია', MOVEMENT: 'მოძრაობა', HYDRATION: 'წყალი', MEDI: 'Medi', WEEKLY: 'კვირის მისიები', LEVEL: 'დონეები', COINS: 'Medi Coins', SPECIAL: 'განსაკუთრებული' },
  fixedTitles: { FIRST_QUEST: 'პირველი მისია', FIRST_CLAIM: 'პირველი ჯილდო', FIRST_WEEKLY: 'პირველი კვირა', COMEBACK: 'დაბრუნება', EARLY_BIRD: 'დილის ჩიტი', NIGHT_OWL: 'ღამის ბუ' },
  fixedBodies: {
    FIRST_QUEST: 'შეასრულე შენი პირველი მისია.', FIRST_CLAIM: 'მიიღე შენი პირველი ჯილდო.', FIRST_WEEKLY: 'შეასრულე კვირის მისია პირველად.',
    COMEBACK: 'დაბრუნდი პაუზის შემდეგ — ესეც ითვლება.', EARLY_BIRD: 'შეასრულე მისია დილის 8 საათამდე.', NIGHT_OWL: 'შეასრულე მისია საღამოს 10 საათის შემდეგ.',
  },
  familyTitles: {
    QUESTS: (n) => `${n} მისია`, STREAK: (n) => `სერია · ${n} დღე`, MOVE: (n) => `მოძრაობა · ${n}`, HYDRATE: (n) => `წყალი · ${n}`,
    MEDI: (n) => `Medi · ${n}`, WEEKLY: (n) => `კვირა · ${n}`, LEVEL: (n) => `დონე ${n}`, COINS_EARNED: (n) => `${fmtNum(n)} Medi Coin`,
  },
  familyBodies: {
    QUESTS: (n) => `შეასრულე სულ ${n} მისია.`, STREAK: (n) => `შეინარჩუნე სერია ${n} დღის განმავლობაში.`, MOVE: (n) => `შეასრულე ${n} მოძრაობის მისია.`,
    HYDRATE: (n) => `შეასრულე ${n} წყლის მისია.`, MEDI: (n) => `შეასრულე ${n} Medi მისია.`, WEEKLY: (n) => `შეასრულე ${n} კვირის მისია.`,
    LEVEL: (n) => `მიაღწიე ${n} დონეს.`, COINS_EARNED: (n) => `დააგროვე სულ ${fmtNum(n)} Medi Coin.`,
  },
};
function familyOf(key) {
  const m = String(key || '').match(/^([A-Z_]+?)_(\d+)$/);
  return m ? { family: m[1], threshold: Number(m[2]) } : { family: String(key || ''), threshold: null };
}
function achTitle(item) {
  if (!item || (!item.key && item.secret)) return t('საიდუმლო მიღწევა', 'Secret achievement');
  if (ACH.fixedTitles[item.key]) return ACH.fixedTitles[item.key];
  const p = familyOf(item.key), fn = ACH.familyTitles[p.family];
  return fn ? fn(item.threshold ?? p.threshold ?? 0) : String(item.key || t('საიდუმლო მიღწევა', 'Secret achievement'));
}
function achBody(item) {
  if (!item || (!item.key && item.secret)) return t('გაიხსნება მოულოდნელად.', 'It reveals itself when you least expect it.');
  if (ACH.fixedBodies[item.key]) return ACH.fixedBodies[item.key];
  const p = familyOf(item.key), fn = ACH.familyBodies[p.family];
  return fn ? fn(item.threshold ?? p.threshold ?? 0) : t('გაიხსნება მოულოდნელად.', 'It reveals itself when you least expect it.');
}
function sortAchievements(items) {
  const state = (r) => (r.claimable ? 0 : r.unlocked ? 1 : r.secret && !r.unlocked ? 3 : 2);
  return [...items].sort((a, b) => {
    const sa = state(a), sb = state(b);
    if (sa !== sb) return sa - sb;
    if (sa === 2) { const d = (Number(b.progressPercent) || 0) - (Number(a.progressPercent) || 0); if (d) return d; }
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
}
function groupAchievements(items) {
  const order = ['PROGRESSION', 'STREAK', 'MOVEMENT', 'HYDRATION', 'MEDI', 'WEEKLY', 'LEVEL', 'COINS', 'SPECIAL'];
  const buckets = new Map();
  for (const it of items || []) {
    const k = order.includes(it.category) ? it.category : 'SPECIAL';
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(it);
  }
  return order.filter((k) => buckets.has(k)).map((k) => ({ category: k, items: sortAchievements(buckets.get(k)) }));
}
const RARITY_INK = { COMMON: 'teal', UNCOMMON: 'sky', RARE: 'blue', EPIC: 'violet', LEGENDARY: 'amber' };

/* Rewards copy (i18n/quest/rewards.js). */
const REWARD_TITLES = isEn ? {
  'reward.mediTheme7d.title': 'Medi Quest style — 7 days', 'reward.mediProfileStyle30d.title': 'Profile accent — 30 days',
  'reward.mediPremiumDay.title': '1 day Premium', 'reward.mediPremium3d.title': '3 days Premium', 'reward.partnerTest10.title': 'Partner test',
} : {
  'reward.mediTheme7d.title': 'Medi Quest სტილი — 7 დღე', 'reward.mediProfileStyle30d.title': 'პროფილის აქცენტი — 30 დღე',
  'reward.mediPremiumDay.title': '1 დღე Premium', 'reward.mediPremium3d.title': '3 დღე Premium', 'reward.partnerTest10.title': 'Partner test',
};
const REWARD_DESCRIPTIONS = isEn ? {
  'reward.mediTheme7d.description': 'A gold accent on the Medi Quest hub for 7 days. Cosmetic only — XP and Coins don’t change.',
  'reward.mediProfileStyle30d.description': 'A gold frame around your profile avatar for 30 days. Cosmetic only — no gameplay advantage.',
  'reward.mediPremiumDay.description': '1 day of Medicard Premium.', 'reward.mediPremium3d.description': '3 days of Medicard Premium.',
  'reward.partnerTest10.description': 'DEV/QA architecture test.',
} : {
  'reward.mediTheme7d.description': 'ოქროსფერი აქცენტი Medi Quest ჰაბზე 7 დღით. მხოლოდ კოსმეტიკა — XP/Coins არ იცვლება.',
  'reward.mediProfileStyle30d.description': 'ოქროსფერი ჩარჩო პროფილის ავატარზე 30 დღით. მხოლოდ კოსმეტიკა — თამაშის უპირატესობა არ აქვს.',
  'reward.mediPremiumDay.description': '1 დღე Medicard Premium.', 'reward.mediPremium3d.description': '3 დღე Medicard Premium.',
  'reward.partnerTest10.description': 'DEV/QA არქიტექტურის ტესტი.',
};
const REWARD_TERMS = isEn ? {
  'reward.mediTheme7d.terms': 'Loyalty points — not money. Once every 14 days. Changes only the look of the Medi Quest hub. The style ends when it expires. Coins are not refunded.',
  'reward.mediProfileStyle30d.terms': 'Cosmetic, on the profile avatar only. One active accent at a time. Doesn’t change XP, Coins or quests.',
  'reward.mediPremiumDay.terms': 'Only when a Premium entitlement system exists.', 'reward.mediPremium3d.terms': 'Only when a Premium entitlement system exists.',
  'reward.partnerTest10.terms': 'Not a real partner offer.',
} : {
  'reward.mediTheme7d.terms': 'ლოიალობის ქულები — არა ფული. 14 დღეში ერთხელ. იცვლის მხოლოდ Medi Quest ჰაბის ვიზუალს. ვადის გასვლის შემდეგ სტილი ქრება. Coins არ ბრუნდება.',
  'reward.mediProfileStyle30d.terms': 'კოსმეტიკა მხოლოდ პროფილის ავატარზე. ერთდროულად ერთი აქტიური აქცენტი. არ ცვლის XP, Coins ან ქვესტებს.',
  'reward.mediPremiumDay.terms': 'მხოლოდ როცა Premium უფლების სისტემა არსებობს.', 'reward.mediPremium3d.terms': 'მხოლოდ როცა Premium უფლების სისტემა არსებობს.',
  'reward.partnerTest10.terms': 'არ არის რეალური პარტნიორის შეთავაზება.',
};
const REWARD_ERRORS = isEn ? {
  REWARD_NOT_FOUND: 'Reward not found.', REWARD_NOT_ACTIVE: 'Reward unavailable.', REWARD_NOT_STARTED: 'This reward hasn’t started yet.',
  REWARD_ENDED: 'This reward has ended.', REWARD_OUT_OF_STOCK: 'Out of stock.', REWARD_INSUFFICIENT_COINS: 'Not enough Medi Coins.',
  REWARD_USER_LIMIT: 'Limit reached.', REWARD_PERIOD_LIMIT: 'Limit for this period reached.', REWARD_ALREADY_REDEEMED: 'Already redeemed.',
  REWARD_CODE_UNAVAILABLE: 'Code unavailable.', REWARD_ENTITLEMENT_UNAVAILABLE: 'Entitlement unavailable.', REWARD_REDEMPTION_CONFLICT: 'Redemption conflict. Try again.',
} : {
  REWARD_NOT_FOUND: 'ჯილდო ვერ მოიძებნა.', REWARD_NOT_ACTIVE: 'ჯილდო მიუწვდომელია.', REWARD_NOT_STARTED: 'ჯილდო ჯერ არ დაწყებულა.',
  REWARD_ENDED: 'ჯილდოს ვადა ამოიწურა.', REWARD_OUT_OF_STOCK: 'მარაგი ამოწურულია.', REWARD_INSUFFICIENT_COINS: 'არასაკმარისი Medi Coins.',
  REWARD_USER_LIMIT: 'ლიმიტი ამოწურულია.', REWARD_PERIOD_LIMIT: 'პერიოდის ლიმიტი ამოწურულია.', REWARD_ALREADY_REDEEMED: 'უკვე გაცვლილია.',
  REWARD_CODE_UNAVAILABLE: 'კოდი მიუწვდომელია.', REWARD_ENTITLEMENT_UNAVAILABLE: 'უფლება მიუწვდომელია.', REWARD_REDEMPTION_CONFLICT: 'გაცვლა კონფლიქტშია. ხელახლა სცადე.',
};
const rewardTitle = (r) => REWARD_TITLES[r?.titleKey] || r?.partnerDisplay?.displayName || r?.titleKey || t('ჯილდო', 'Reward');
const rewardDesc = (r) => REWARD_DESCRIPTIONS[r?.descriptionKey] || '';
const rewardTerms = (r) => (r?.termsKey ? REWARD_TERMS[r.termsKey] || '' : '');
function rewardError(code) {
  if (!code) return t('მიუწვდომელი', 'Unavailable');
  return REWARD_ERRORS[code] || REWARD_ERRORS[`REWARD_${code}`] || t('მიუწვდომელი', 'Unavailable');
}
function newIdempotencyKey() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `rw-${Date.now().toString(36)}-${rand}`;
}
const LEDGER = isEn ? {
  QUEST: 'Mission', ACHIEVEMENT: 'Achievement', REWARD_REDEMPTION: 'Medi reward', SYSTEM: 'System adjustment',
  ADMIN_ADJUSTMENT: 'Admin adjustment', HUNT: 'Medi Hunt', REFERRAL: 'Invite bonus',
} : {
  QUEST: 'მისია', ACHIEVEMENT: 'მიღწევა', REWARD_REDEMPTION: 'Medi ჯილდო', SYSTEM: 'სისტემური კორექტირება',
  ADMIN_ADJUSTMENT: 'ადმინისტრაციული კორექტირება', HUNT: 'Medi Hunt', REFERRAL: 'მოწვევის ბონუსი',
};
const ledgerLabel = (type) => LEDGER[String(type || '')] || t('ბალანსის კორექტირება', 'Balance adjustment');
const LEDGER_ICON = { QUEST: 'target', ACHIEVEMENT: 'award', REWARD_REDEMPTION: 'gift', REFERRAL: 'users', HUNT: 'mapPin' };

/* Journey copy (lib/companion/copy.ts, cosmeticNames.ts, cosmeticVisuals.ts). */
const CHAPTERS = isEn ? { 1: 'First path', 2: 'Quiet rhythm', 3: 'Farther on', 4: 'Deeper trail', 5: 'Long horizon' } : { 1: 'პირველი გზა', 2: 'მშვიდი რიტმი', 3: 'უფრო შორს', 4: 'ღრმა კვალი', 5: 'გრძელი ჰორიზონტი' };
const MILESTONES = isEn ? ['First step', 'Easy breath', 'Small light', 'Steady day', 'Chapter I — beginning', 'Soft pace', 'New shade', 'Mid trail', 'Clearer now', 'Chapter II — rhythm', 'Wider view', 'Quiet strength', 'Open sky', 'Deep color', 'Chapter III — rise', 'Long breath', 'Warm trail', 'Firm step', 'Distant glow', 'Chapter IV — depth', 'Calm horizon', 'Closer still', 'Soft glow', 'Long view', 'Chapter V — horizon'] : ['პირველი ნაბიჯი', 'მსუბუქი სუნთქვა', 'პატარა შუქი', 'სტაბილური დღე', 'თავი I — დასაწყისი', 'რბილი ტემპი', 'ახალი ჩრდილი', 'შუა გზა', 'უფრო მკაფიო', 'თავი II — რიტმი', 'შორი ხედი', 'მშვიდი ძალა', 'ღია ცა', 'ღრმა ფერი', 'თავი III — სიმაღლე', 'გრძელი სუნთქვა', 'თბილი კვალი', 'მყარი ნაბიჯი', 'შორი სინათლე', 'თავი IV — სიღრმე', 'მშვიდი ჰორიზონტი', 'უფრო ახლოს', 'რბილი შუქი', 'გრძელი ხედი', 'თავი V — ჰორიზონტი'];
const COSMETIC_NAMES = isEn ? ['Hello wave', 'Quiet plant', 'Teal pin', 'Warm gold', 'Dawn wash', 'Steady focus', 'Soft lamp', 'Glass visor', 'Soft sky', 'Teal room', 'Quiet pride', 'Mini shelf', 'Soft wrap', 'Coral glow', 'City night', 'Rest pose', 'Framed note', 'Orbit ring', 'Violet hush', 'Garden light', 'Trail badge', 'Window light', 'Curious tilt', 'Mint edge', 'Summit dusk'] : ['მისალმების პოზა', 'მწვანე კუთხე', 'თეალი ქინძისთავი', 'თბილი ოქრო', 'განთიადი', 'ფოკუსის პოზა', 'რბილი ნათურა', 'მინის ვიზორი', 'რბილი ცა', 'თეალი ოთახი', 'სიამაყის პოზა', 'მინი თარო', 'რბილი შარფი', 'კორალი', 'ქალაქის ღამე', 'დასვენების პოზა', 'ჩარჩო', 'ორბიტა', 'იისფერი', 'ბაღის შუქი', 'ბეჯი', 'ფანჯარა', 'ცნობისმოყვარეობა', 'მინტი', 'ბინდის ჰორიზონტი'];
const VISUAL = [null, 'pose.wave', 'decor.plant', 'accessory.pin', 'accent.gold', 'bg.dawn', 'pose.focused', 'decor.lamp', 'accessory.visor', 'accent.soft_blue', 'bg.teal_room', 'pose.proud', 'decor.shelf', 'accessory.scarf', 'accent.coral', 'bg.city_night', 'pose.resting', 'decor.frame', 'accessory.orbit', 'accent.violet', 'bg.garden_light', 'accessory.badge', 'decor.window', 'pose.curious', 'accent.mint', 'bg.summit_dusk'];
const SYMBOL_NAMES = isEn ? {
  'pose.wave': 'First wave', 'pose.focused': 'Focus', 'pose.proud': 'Crown', 'pose.resting': 'Moon', 'pose.curious': 'Explorer',
  'accessory.pin': 'My flag', 'accessory.visor': 'Horizon', 'accessory.scarf': 'Ribbon', 'accessory.orbit': 'Orbit', 'accessory.badge': 'Trail mark',
  'bg.teal_room': 'Teal calm',
} : {
  'pose.wave': 'პირველი ტალღა', 'pose.focused': 'ფოკუსი', 'pose.proud': 'გვირგვინი', 'pose.resting': 'მთვარე', 'pose.curious': 'აღმომჩენი',
  'accessory.pin': 'ჩემი დროშა', 'accessory.visor': 'ჰორიზონტი', 'accessory.scarf': 'ლენტი', 'accessory.orbit': 'ორბიტა', 'accessory.badge': 'გზის ნიშანი',
  'bg.teal_room': 'თეალის სიმშვიდე',
};
const ACCENT_COLORS = { 'accent.teal_core': '#14B8A6', 'accent.gold': '#D4A017', 'accent.soft_blue': '#38BDF8', 'accent.coral': '#F472B6', 'accent.violet': '#A78BFA', 'accent.mint': '#5EEAD4' };
const SYMBOL_ICON = {
  'pose.wave': 'sparkles', 'pose.focused': 'target', 'pose.proud': 'trophy', 'pose.resting': 'moon', 'pose.curious': 'search',
  'accessory.pin': 'mapPin', 'accessory.visor': 'eye', 'accessory.scarf': 'award', 'accessory.orbit': 'refresh', 'accessory.badge': 'shield',
};
function visualKey(key) {
  if (!key) return null;
  if (key === 'COSMETIC_DEFAULT_ACCENT') return 'accent.teal_core';
  if (key === 'COSMETIC_DEFAULT_BACKGROUND') return 'bg.calm_navy';
  const m = String(key).match(/COSMETIC_MILESTONE_(\d{2})/);
  return m ? VISUAL[Number(m[1])] || null : null;
}
function chapterTitle(chapterKey) {
  const n = String(chapterKey || '').match(/(\d+)/)?.[1];
  return (n && CHAPTERS[Number(n)]) || String(chapterKey || '');
}
function milestoneTitle(titleKey) {
  const m = String(titleKey || '').match(/milestone_(\d{2})/i);
  const i = m ? Number(m[1]) - 1 : -1;
  return i >= 0 && i < MILESTONES.length ? MILESTONES[i] : String(titleKey || '');
}
function cosmeticTitle(item) {
  const vk = visualKey(item.key);
  if (vk && SYMBOL_NAMES[vk]) return SYMBOL_NAMES[vk];
  if (item.key === 'COSMETIC_DEFAULT_ACCENT') return t('თეალი ბირთვი', 'Teal core');
  if (item.key === 'COSMETIC_DEFAULT_BACKGROUND') return t('მშვიდი ნეივი', 'Calm navy');
  const m = String(item.key || item.titleKey || '').match(/milestone_(\d{2})/i);
  const i = m ? Number(m[1]) - 1 : -1;
  return i >= 0 && i < COSMETIC_NAMES.length ? COSMETIC_NAMES[i] : t('კოლექციის ნივთი', 'Collection item');
}

/** journeyPresentation — thresholds describe completed missions (daily = 1, weekly = 3), from the server. */
function journeyInfo(journey) {
  const milestones = [...(journey?.milestones || [])].sort((a, b) => a.at - b.at);
  const next = milestones.find((m) => m.key === journey?.nextMilestoneKey) ?? null;
  const previous = next ? [...milestones].reverse().find((m) => m.at < next.at && m.unlocked) : null;
  const start = previous?.at ?? 0;
  const percent = next ? Math.max(0, Math.min(100, ((journey.units - start) / Math.max(1, next.at - start)) * 100)) : milestones.length ? 100 : 0;
  return { milestones, next, remaining: next ? Math.max(0, next.at - journey.units) : 0, percent, unlocked: milestones.filter((m) => m.unlocked).length };
}
/** The API returns owned items; upcoming milestones provide the locked previews (questCollection). */
function questCollection(overview) {
  const items = [...(overview?.collection || [])];
  const known = new Set(items.map((i) => i.key));
  for (const m of overview?.journey?.milestones || []) {
    const key = m.cosmeticKey;
    if (!key || known.has(key)) continue;
    const vk = visualKey(key);
    if (!vk) continue;
    const slot = vk.startsWith('bg.') ? 'background' : vk.startsWith('decor.') ? 'decoration' : vk.startsWith('accent.') ? 'accent' : 'accessory';
    items.push({ key, assetKey: vk, slot, type: 'JOURNEY_PREVIEW', unlocked: false });
    known.add(key);
  }
  return items;
}

/** Personal progress seal (QuestEmblem): accent colour, background fill, symbol, decoration. */
function emblem(equipment = {}, size = 84) {
  const ink = ACCENT_COLORS[visualKey(equipment.accent) || 'accent.teal_core'] || '#14B8A6';
  const bg = visualKey(equipment.background) || '';
  const fill = bg.includes('dawn') ? 'var(--q-dawn)' : bg.includes('garden') ? 'var(--q-garden)' : bg.includes('city') ? 'var(--q-city)' : bg.includes('summit') ? 'var(--q-summit)' : bg.includes('teal_room') ? 'var(--q-teal)' : 'var(--bg2)';
  const sym = SYMBOL_ICON[visualKey(equipment.accessory) || ''] || 'compass';
  const decor = visualKey(equipment.decoration) || '';
  const decorIcon = decor.includes('plant') ? 'flower' : decor.includes('lamp') ? 'sun' : decor.includes('frame') ? 'image' : decor.includes('window') ? 'grid' : decor.includes('shelf') ? 'folder' : 'gift';
  const svg = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="${fill}" stroke="${ink}" stroke-width="1" stroke-dasharray="2 6"/><circle cx="50" cy="50" r="35" fill="var(--surface)" stroke="${ink}" stroke-width="1.5"/><path d="M50 4 L53 11 L50 18 L47 11 Z M50 82 L53 89 L50 96 L47 89 Z" fill="${ink}"/></svg>`;
  return h('div', { class: 'q-emblem', style: { width: `${size}px`, height: `${size}px`, color: ink } },
    h('span', { html: svg }),
    h('span', { class: 'q-emblem-mark' }, icon(sym, { size: Math.round(size * 0.34), stroke: 1.6 })),
    equipment.decoration ? h('span', { class: 'q-emblem-decor' }, icon(decorIcon, { size: Math.max(12, Math.round(size * 0.17)) })) : null);
}

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } };
const coin = (n) => h('span', { class: 'q-coin' }, icon('coins', { size: 15 }), fmtNum(n));
const setTab = (tab) => {
  const u = new URL(location.href);
  if (tab === 'missions') u.searchParams.delete('tab'); else u.searchParams.set('tab', tab);
  history.replaceState(history.state, '', u.pathname + u.search);
};

/* ── Phone verification (reward redeem, invite code) ── */
function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('995')) d = d.slice(3);
  return d;
}

/** Offers the one-time phone check the server asks for (403 PHONE_VERIFICATION_REQUIRED). */
export function offerPhoneVerification(reason) {
  return new Promise((resolve) => {
    let handedOff = false;
    openModal({
      title: t('საჭიროა ტელეფონის დადასტურება', 'Phone verification needed'),
      size: 'sm',
      body: h('p', { class: 'muted' }, reason || t('ამ ფუნქციისთვის ერთხელ დაადასტურე ტელეფონის ნომერი — ეს ყალბი ანგარიშებისგან იცავს.', 'Verify your phone number once to use this. It protects against fake accounts.')),
      footer: (close) => [
        button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }),
        button(t('დადასტურება', 'Verify'), { onClick: () => { handedOff = true; close(); verifyPhone().then(resolve); } }),
      ],
      onClose: () => { if (!handedOff) resolve(false); },
    });
  });
}

/** Number → SMS code, through /api/auth/phone/link/start|verify (same as the app's /profile/verify-phone). */
export function verifyPhone() {
  return new Promise((resolve) => {
    let done = false;
    let phone = '';
    const err = h('div', { class: 'form-error', hidden: true });
    const showErr = (e) => { err.textContent = e?.message || t('ვერ შესრულდა. სცადე ხელახლა.', 'That didn’t work. Please try again.'); err.hidden = false; };
    const phoneInput = input({ type: 'tel', inputmode: 'numeric', autocomplete: 'tel-national', placeholder: '5XX XXX XXX', maxlength: 12 });
    const codeInput = input({ type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: '····', maxlength: 4, class: 'input q-otp' });
    const body = h('div', { class: 'stack' });
    const stepPhone = () => mount(body,
      h('p', { class: 'muted' }, t('ქალების სივრცესა და ჯილდოებზე ყალბი ანგარიშებისგან დასაცავად ერთხელ დაადასტურე ნომერი. SMS-ით მოგივა 4-ნიშნა კოდი.', 'Verify your number once to protect the women’s space and rewards from fake accounts. We’ll text you a 4-digit code.')),
      field(t('ტელეფონის ნომერი', 'Phone number'), h('div', { class: 'phone-wrap' }, h('span', null, '+995'), phoneInput)), err);
    const stepCode = (res) => mount(body,
      h('p', { class: 'muted' }, t(`4-ნიშნა კოდი გაიგზავნა ნომერზე +995 ${phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}.`, `We sent a 4-digit code to +995 ${phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}.`)),
      res?.devCode ? h('p', { class: 'faint' }, t(`სატესტო კოდი: ${res.devCode}`, `Test code: ${res.devCode}`)) : null,
      field(t('SMS კოდი', 'SMS code'), codeInput), err);
    stepPhone();
    let step = 'phone';
    openModal({
      title: t('დაადასტურე ტელეფონი', 'Verify your phone'),
      size: 'sm',
      body,
      footer: (close) => {
        const next = button(t('კოდის გაგზავნა', 'Send code'));
        next.addEventListener('click', () => busy(next, async () => {
          err.hidden = true;
          try {
            if (step === 'phone') {
              phone = normPhone(phoneInput.value);
              if (!/^5\d{8}$/.test(phone)) throw new Error(t('ტელეფონის ნომერი უნდა იყოს ფორმატში 5XX XXX XXX', 'Enter the number as 5XX XXX XXX'));
              const res = await post('/api/auth/phone/link/start', { phone });
              step = 'code';
              stepCode(res);
              next.querySelector('span').textContent = t('დადასტურება', 'Verify');
              setTimeout(() => codeInput.focus(), 30);
            } else {
              const code = codeInput.value.replace(/\D/g, '');
              if (code.length !== 4) throw new Error(t('კოდი უნდა შედგებოდეს 4 ციფრისგან', 'The code has 4 digits'));
              await post('/api/auth/phone/link/verify', { phone, code });
              done = true;
              await refreshMe().catch(() => {});
              toast(t('ტელეფონი დადასტურდა', 'Phone verified'));
              close();
            }
          } catch (e) { showErr(e); }
        }));
        return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), next];
      },
      onClose: () => resolve(done),
    });
  });
}

/* ── Page ─────────────────────────────────────────── */
export default async function questPage(root, ctx) {
  ensureCss();
  let dash = null;
  let tab = ['missions', 'progress', 'rewards'].includes(ctx.query?.tab) ? ctx.query.tab : 'missions';
  const claimLocks = new Set();
  let alive = true;

  const hero = h('div');
  const notice = h('div');
  const body = h('div', { class: 'q-body' });
  const tabs = segmented([
    { value: 'missions', label: t('მისიები', 'Missions') }, { value: 'progress', label: t('პროგრესი', 'Progress') }, { value: 'rewards', label: t('ჯილდოები', 'Rewards') },
  ], tab, (v) => { tab = v; setTab(v); renderTab(); });
  tabs.classList.add('q-tabs');

  mount(root,
    h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        h('h1', null, 'MEDI ', h('span', { class: 'q-brand' }, 'QUEST')),
        h('p', null, t('პატარა ნაბიჯები. შენი დიდი პროგრესი.', 'Small steps. Your big progress.'))),
      h('div', { class: 'page-head-actions' },
        button(t('როგორ მუშაობს?', 'How it works'), { variant: 'ghost', icon: 'info', onClick: () => guide() }))),
    hero, notice, tabs, body);

  mount(hero, h('div', { class: 'card spotlight q-hero' }, skeleton(3)));
  mount(body, skeleton(5));

  async function loadDash() {
    try {
      dash = await get('/api/quests', tz() ? { timezone: tz() } : undefined);
      if (!alive) return;
      renderHero();
      renderTab();
    } catch (e) {
      if (!alive) return;
      mount(hero, errorBox(e, () => loadDash()));
      mount(body, '');
    }
  }

  function setDash(next) {
    dash = next;
    renderHero();
  }

  function renderHero() {
    const p = dash?.profile;
    const unavailable = Boolean(dash?.unavailable || (dash && !p));
    if (unavailable) {
      mount(hero, h('div', { class: 'card pad-lg' }, empty(t('მისიები დროებით მიუწვდომელია', 'Missions are temporarily unavailable'), t('სცადე გვერდის განახლება. შენი დაგროვილი მონაცემები ანგარიშზე რჩება.', 'Try refreshing the page. Everything you’ve earned stays on your account.'),
        button(t('ხელახლა ცდა', 'Try again'), { onClick: () => loadDash() }))));
      mount(body, '');
      mount(notice, '');
      tabs.hidden = true;
      return;
    }
    tabs.hidden = false;
    const lr = levelRing(p);
    const sum = dash.summary || {};
    const total = Math.max(0, Number(sum.dailyTotal) || 0);
    const done = Math.min(total, Math.max(0, Number(sum.dailyCompleted) || 0));
    mount(hero, h('div', { class: 'card spotlight q-hero' },
      h('div', { class: 'q-hero-level' },
        ring({ value: lr.percent, max: 100, size: 112, stroke: 10, color: '#5eead4', track: 'rgba(255,255,255,.12)', label: String(p.level), sub: t('დონე', 'Level'), labelScale: 0.3 }),
        h('div', { class: 'q-hero-rank' },
          h('div', { class: 'q-eyebrow' }, t('შენი რანგი', 'Your rank')),
          h('div', { class: 'q-rank' }, rankLabel(p.rankKey || rankKeyFromLevel(p.level))),
          h('div', { class: 'muted' }, t(`${fmtNum(p.totalXp)} XP დაგროვილია`, `${fmtNum(p.totalXp)} XP earned`)),
          h('div', { class: 'q-next' }, lr.remaining != null ? t(`შემდეგ დონემდე ${fmtNum(lr.remaining)} XP`, `${fmtNum(lr.remaining)} XP to next level`) : t('უმაღლესი დონე მიღწეულია', 'Top level reached')))),
      h('div', { class: 'q-hero-stats' },
        heroStat('coins', fmtNum(p.coinBalance), 'Medi Coins', t('ჯილდოებისთვის', 'For rewards'), () => selectTab('rewards')),
        heroStat('flame', t(`${fmtNum(p.currentStreak)} დღე`, `${fmtNum(p.currentStreak)} ${Number(p.currentStreak) === 1 ? 'day' : 'days'}`), t('სერია', 'Streak'), t(`საუკეთესო ${fmtNum(p.longestStreak)} დღე`, `Best: ${fmtNum(p.longestStreak)} ${Number(p.longestStreak) === 1 ? 'day' : 'days'}`)),
        heroStat('target', `${done} / ${total}`, t('დღის მისიები', 'Daily missions'), total && done >= total ? t('დღეს ყველაფერი შესრულებულია', 'Everything is done for today') : t('შესრულდა', 'done')))));
    mount(notice, sum.unclaimedRewards > 0
      ? h('div', { class: 'q-notice' }, icon('gift', { size: 18 }), h('span', null, t(`${sum.unclaimedRewards} მისიის ჯილდო მზადაა — მიიღე ბარათიდან ქვემოთ.`, `${sum.unclaimedRewards} mission ${sum.unclaimedRewards === 1 ? 'reward is' : 'rewards are'} ready — claim below.`)))
      : '');
  }

  function selectTab(v) {
    tab = v;
    const btns = tabs.querySelectorAll('button');
    const i = ['missions', 'progress', 'rewards'].indexOf(v);
    if (btns[i]) btns[i].click();
  }

  function heroStat(ic, value, label, sub, onClick) {
    return h(onClick ? 'button' : 'div', { class: `q-hstat ${onClick ? 'clickable' : ''}`, type: onClick ? 'button' : undefined, onClick },
      h('div', { class: 'q-hstat-top' }, icon(ic, { size: 16 }), h('span', null, label)),
      h('div', { class: 'q-hstat-val' }, value),
      h('div', { class: 'q-hstat-sub' }, sub));
  }

  function renderTab() {
    if (!dash || !dash.profile) return;
    if (tab === 'progress') renderProgress();
    else if (tab === 'rewards') renderRewards();
    else renderMissions();
  }

  /* ── Missions tab ── */
  function missionCard(q, weekly = false) {
    const kind = weekly ? 'weekly' : questKind(q);
    const look = KIND_LOOK[kind] || KIND_LOOK.movement;
    const claimed = q.status === 'CLAIMED';
    const claimable = q.claimable && !claimed;
    const active = q.status === 'ACTIVE';
    const errSlot = h('div');
    let action = null;
    if (claimable) {
      const b = button(t('ჯილდოს მიღება', 'Claim reward'), { icon: 'gift', size: 'sm' });
      b.addEventListener('click', () => busy(b, () => claim(q, errSlot)));
      action = b;
    } else if (active && q.progressType === 'STEPS') {
      action = button(t('ნაბიჯების ნახვა', 'View steps'), { variant: 'ghost', size: 'sm', href: '/health' });
    } else if (active && q.progressType === 'HYDRATION_GOAL_PERCENT') {
      action = button(t('წყლის ჩაწერა', 'Log water'), { variant: 'ghost', size: 'sm', href: '/health' });
    } else if (active && kind === 'medi' && featureOn('medi')) {
      action = button(t('გახსენი Medi', 'Open Medi'), { variant: 'ghost', size: 'sm', href: '/medi' });
    }
    const why = active && kind !== 'hydration' && kind !== 'medi' && q.targetSource
      ? h('button', { type: 'button', class: 'text-btn q-why', onClick: () => whyTarget(q) }, WHY.title) : null;
    return h('div', { class: `card q-mission ${claimable ? 'ready' : ''} ${claimed ? 'done' : ''} ${q.status === 'EXPIRED' ? 'expired' : ''}` },
      h('div', { class: 'q-mission-top' },
        claimed ? h('span', { class: 'tile ink-green', style: { width: '44px', height: '44px' } }, icon('check', { size: 21 })) : tile(look.icon, look.ink, 44),
        h('div', { class: 'q-mission-main' },
          h('div', { class: 'q-mission-title' }, questTitle(q), weekly ? badge(t('კვირა', 'Weekly'), 'warn') : null),
          h('div', { class: 'q-mission-sub' }, questHelper(q))),
        h('div', { class: 'q-rewards' },
          h('span', { class: 'q-pill coin' }, icon('coins', { size: 13 }), `+${fmtNum(q.rewardCoins)}`),
          h('span', { class: 'q-pill xp' }, `+${fmtNum(q.rewardXp)} XP`))),
      active || claimable ? h('div', { class: 'q-mission-progress' },
        progress(pct(q.progressPercent), 100, { ink: claimable ? 'green' : look.ink }),
        h('span', { class: 'num' }, progressLabel(q))) : null,
      action || why ? h('div', { class: 'q-mission-actions' }, why, h('span', { style: { flex: 1 } }), action) : null,
      errSlot);
  }

  async function claim(q, errSlot) {
    const lock = q.id;
    if (claimLocks.has(lock)) return;
    claimLocks.add(lock);
    mount(errSlot, '');
    try {
      const result = await post(`/api/quests/${encodeURIComponent(q.id)}/claim`);
      if (!alive || !result?.ok) throw new Error('claim_failed');
      setDash(applyClaim(dash, result));
      if (result.claimed) toast(t(`+${fmtNum(result.reward.coinsAwarded)} მონეტა · +${fmtNum(result.reward.xpAwarded)} XP`, `+${fmtNum(result.reward.coinsAwarded)} coins · +${fmtNum(result.reward.xpAwarded)} XP`));
      if (result.profile?.leveledUp) levelUp(result.profile.currentLevel, result.reward);
      invalidate('/api/medi-companion');
      invalidate('/api/achievements');
      renderTab();
    } catch {
      mount(errSlot, h('div', { class: 'form-error' }, t('ჯილდოს მიღება ვერ დადასტურდა. სცადე ხელახლა — ერთი მისიის ჯილდო მხოლოდ ერთხელ ირიცხება.', 'We couldn’t confirm the reward. Try again — each mission reward is only credited once.')));
    } finally { claimLocks.delete(lock); }
  }

  function renderMissions() {
    const daily = orderedMissions(dash.daily?.quests || []);
    const weekly = orderedMissions(dash.weekly?.quests || []);
    const sum = dash.summary || {};
    const setupSteps = ![...daily, ...weekly].some((q) => q.progressType === 'STEPS');
    const setupWater = !daily.some((q) => q.progressType === 'HYDRATION_GOAL_PERCENT');
    const left = h('div', { class: 'stack', style: { gap: '28px' } },
      section(t('დღის მისიები', 'Daily missions'), h('div', { class: 'stack' },
        daily.length
          ? h('div', { class: 'card q-daybar' }, h('div', { class: 'between' }, h('span', { class: 'muted' }, t('დღეს', 'Today')), h('b', { class: 'num' }, t(`${sum.dailyCompleted || 0} / ${sum.dailyTotal || 0} შესრულდა`, `${sum.dailyCompleted || 0} / ${sum.dailyTotal || 0} done`))),
            progress(sum.dailyTotal ? ((sum.dailyCompleted || 0) / sum.dailyTotal) * 100 : 0, 100))
          : h('div', { class: 'card' }, empty(t('დღიური მისიები ჯერ არ არის', 'No daily missions yet'), t('შეამოწმე აქტივობისა და ჰიდრატაციის პარამეტრები.', 'Check your activity and hydration settings.'))),
        daily.map((q) => missionCard(q)))),
      weekly.length ? section(t('კვირის გამოწვევა', 'Weekly challenge'), h('div', { class: 'stack' }, h('div', { class: 'faint q-meta' }, t('ორშაბათი — კვირა', 'Monday — Sunday')), weekly.map((q) => missionCard(q, true)))) : null);

    const setup = [];
    if (setupSteps) setup.push(h('div', { class: 'row' }, tile('footprints', 'teal', 38),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t('ნაბიჯები დაუკავშირე', 'Connect your steps')),
        h('div', { class: 'row-sub' }, t('ნაბიჯები ჯანმრთელობის აპიდან სინქრონდება. ამისთვის გამოიყენე MEDICARD აპი.', 'Steps sync from your phone’s health app. Use the MEDICARD app for this.'))),
      h('a', { class: 'link', href: 'https://apps.apple.com/app/id6812517519', target: '_blank', rel: 'noopener' }, t('აპი', 'App'), icon('externalLink', { size: 14 }))));
    if (setupWater) setup.push(h('a', { class: 'row row-link', href: '/health', 'data-link': '' }, tile('droplet', 'sky', 38),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t('წყლის მიზანი დააყენე', 'Set a water goal')), h('div', { class: 'row-sub' }, t('შენი დღიური მიზანი ჰიდრატაციის მისიას გახსნის.', 'Your daily goal unlocks the hydration mission.'))),
      icon('chevronRight', { size: 18, className: 'row-chev' })));
    setup.push(h('button', { type: 'button', class: 'row row-link', onClick: () => selectTab('progress') }, tile('trophy', 'amber', 38),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t('ნახე, როგორ ვითარდები', 'See how you’re growing')), h('div', { class: 'row-sub' }, t('ეტაპები და კოლექცია — შენი შესრულებული მისიებიდან.', 'Milestones and collection, from the missions you’ve completed.'))),
      icon('chevronRight', { size: 18, className: 'row-chev' })));

    const achSlot = h('div', null, skeleton(2));
    const right = h('div', { class: 'stack', style: { gap: '28px' } },
      featureOn('referralRewards') ? section(t('მოიწვიე მეგობარი', 'Invite a friend'), referralCard()) : null,
      section(t('მიღწევები', 'Achievements'), achSlot, { action: h('button', { type: 'button', class: 'link text-btn', onClick: () => selectTab('progress') }, t('ყველა', 'View all'), icon('chevronRight', { size: 16 })) }),
      section(t('დაიწყე აქედან', 'Start here'), h('div', { class: 'card' }, h('div', { class: 'list' }, setup))));
    mount(body, h('div', { class: 'grid grid-main q-grid' }, left, right));
    loadAchievementsPreview(achSlot);
  }

  async function loadAchievementsPreview(slot) {
    try {
      const data = await get('/api/achievements');
      if (!alive) return;
      const items = data?.items || [];
      if (data?.unavailable || !items.length) { mount(slot, h('div', { class: 'card' }, empty(t('მიღწევები აქ გამოჩნდება.', 'Your achievements will appear here.')))); return; }
      const claimable = items.filter((r) => r.claimable);
      const unlocked = items.filter((r) => r.unlocked && !r.claimable).sort((a, b) => String(b.unlockedAt || '').localeCompare(String(a.unlockedAt || '')));
      const nearest = items.filter((r) => !r.unlocked && !r.secret).sort((a, b) => (Number(b.progressPercent) || 0) - (Number(a.progressPercent) || 0));
      const preview = [...claimable, ...unlocked, ...nearest].slice(0, 4);
      const s = data.summary || {};
      mount(slot, h('div', { class: 'card' },
        h('div', { class: 'between', style: { marginBottom: '14px' } },
          h('span', { class: 'muted' }, t(`${fmtNum(s.unlocked || 0)} / ${fmtNum(s.total || items.length)} გახსნილია`, `${fmtNum(s.unlocked || 0)} / ${fmtNum(s.total || items.length)} unlocked`)),
          s.claimable ? badge(t(`${s.claimable} ჯილდო გელოდება`, `${s.claimable} ${s.claimable === 1 ? 'reward' : 'rewards'} waiting`), 'brand') : null),
        h('div', { class: 'q-medals' }, preview.map((a) => medal(a, true)))));
    } catch (e) {
      mount(slot, errorBox(e, () => loadAchievementsPreview(slot)));
    }
  }

  function medal(a, compact = false, onClaimed) {
    const ink = RARITY_INK[a.rarity] || 'teal';
    const locked = !a.unlocked;
    const el = h('div', { class: `q-medal ${locked ? 'locked' : ''} ${a.claimable ? 'ready' : ''} ${compact ? 'compact' : ''}` },
      h('span', { class: `tile ink-${locked ? 'neutral' : ink} q-medal-tile` }, icon(locked ? (a.secret ? 'eyeOff' : 'lock') : 'award', { size: compact ? 20 : 24 })),
      h('div', { class: 'q-medal-title' }, achTitle(a)),
      compact ? null : h('div', { class: 'q-medal-sub' }, achBody(a)),
      compact ? null : h('div', { class: 'q-medal-meta' }, badge(ACH.rarity[a.rarity] || a.rarity || '', locked ? 'neutral' : 'brand'),
        a.rewardCoins ? h('span', { class: 'q-pill coin' }, icon('coins', { size: 12 }), `+${fmtNum(a.rewardCoins)}`) : null,
        a.rewardXp ? h('span', { class: 'q-pill xp' }, `+${fmtNum(a.rewardXp)} XP`) : null),
      !compact && locked && !a.secret && a.threshold ? h('div', { class: 'q-medal-prog' }, progress(pct(a.progressPercent), 100, { ink }),
        h('span', { class: 'faint num' }, `${fmtNum(a.progress ?? 0)} / ${fmtNum(a.threshold)}`)) : null,
      !compact && a.claimable ? (() => {
        const b = button(t('მიღება', 'Claim'), { size: 'sm', icon: 'gift' });
        b.addEventListener('click', () => busy(b, async () => {
          try {
            const r = await post(`/api/achievements/${encodeURIComponent(a.id)}/claim`);
            toast(r.claimed ? t(`+${fmtNum(r.reward?.coinsAwarded)} მონეტა · +${fmtNum(r.reward?.xpAwarded)} XP`, `+${fmtNum(r.reward?.coinsAwarded)} coins · +${fmtNum(r.reward?.xpAwarded)} XP`) : t('ჯილდო უკვე მიღებულია', 'Reward already claimed'), r.claimed ? 'ok' : 'info');
            if (r.profile && dash?.profile) {
              setDash({ ...dash, profile: { ...dash.profile, coinBalance: r.profile.coinBalance, totalXp: r.profile.totalXp,
                level: r.profile.currentLevel, rankKey: r.profile.rankKey || rankKeyFromLevel(r.profile.currentLevel), levelProgress: r.profile.levelProgress } });
              if (r.profile.leveledUp) levelUp(r.profile.currentLevel, r.reward);
            }
            onClaimed?.();
          } catch (e) { toast(e?.message || t('ჯილდოს მიღება ვერ მოხერხდა.', 'Couldn’t claim the reward.'), 'error'); }
        }));
        return b;
      })() : null,
      !compact && a.claimed ? h('div', { class: 'q-medal-state' }, icon('check', { size: 14 }), t('მიღებულია', 'Claimed')) : null);
    el.title = achBody(a);
    return el;
  }

  /* ── Progress tab ── */
  function renderProgress() {
    const journeySlot = h('div', null, skeleton(4));
    const achSlot = h('div', null, skeleton(4));
    const histSlot = h('div', null, skeleton(3));
    const p = dash.profile;
    const left = h('div', { class: 'stack', style: { gap: '28px' } },
      section(t('შენი პირადი გზა', 'Your personal journey'), journeySlot),
      section(t('ჩემი მიღწევები', 'My achievements'), achSlot));
    const right = h('div', { class: 'stack', style: { gap: '28px' } },
      section(t('შენი სერია', 'Your streak'), h('div', { class: 'card' },
        h('div', { class: 'hstack' }, tile('flame', 'amber', 42), h('div', null,
          h('div', { class: 'q-big' }, t(`${fmtNum(p.currentStreak)} დღე`, `${fmtNum(p.currentStreak)} ${Number(p.currentStreak) === 1 ? 'day' : 'days'}`)),
          h('div', { class: 'muted' }, t(`საუკეთესო ${fmtNum(p.longestStreak)} დღე`, `Best: ${fmtNum(p.longestStreak)} ${Number(p.longestStreak) === 1 ? 'day' : 'days'}`)))),
        h('p', { class: 'faint', style: { marginTop: '12px', fontSize: '13px' } }, t('ყოველ დღე ერთი დღიური მისიის შესრულება მაინც აგრძელებს სერიას.', 'Completing at least one daily mission each day keeps your streak going.')))),
      section(t('როგორ ითვლება', 'How it counts'), h('div', { class: 'grid grid-2 q-units' },
        h('div', { class: 'card' }, h('div', { class: 'q-unit' }, '+1'), h('div', { class: 'muted' }, t('დღიური მისიის შესრულება', 'Daily mission completed'))),
        h('div', { class: 'card' }, h('div', { class: 'q-unit' }, '+3'), h('div', { class: 'muted' }, t('კვირის მისიის შესრულება', 'Weekly mission completed'))))),
      section(t('მისიების ისტორია', 'Mission history'), histSlot));
    mount(body, h('div', { class: 'grid grid-main q-grid' }, left, right));
    loadJourney(journeySlot);
    loadAchievements(achSlot);
    loadHistory(histSlot);
  }

  async function loadJourney(slot) {
    try {
      const ov = await get('/api/medi-companion', { reducedMotion: 1 });
      if (!alive) return;
      const j = ov?.journey;
      if (!j) { mount(slot, h('div', { class: 'card' }, empty(t('პროგრესი ვერ ჩაიტვირთა', 'Couldn’t load your progress'), t('მისიების შესრულება შეგიძლია გააგრძელო. შენი პროგრესი ანგარიშზე ინახება.', 'You can keep doing missions. Your progress is saved on your account.')))); return; }
      const info = journeyInfo(j);
      const chapters = [...new Set(info.milestones.map((m) => m.chapterKey))];
      let chapter = chapters.includes(j.chapterKey) ? j.chapterKey : chapters[0];
      const timeline = h('div');
      const drawTimeline = () => mount(timeline, h('div', { class: 'card q-timeline' },
        h('div', { class: 'q-chapter-title' }, chapterTitle(chapter)),
        info.milestones.filter((m) => m.chapterKey === chapter).map((m) => {
          const isNext = m.key === info.next?.key;
          return h('div', { class: `q-ms ${m.unlocked ? 'on' : ''} ${isNext ? 'next' : ''}` },
            h('span', { class: 'q-ms-dot' }, icon(m.unlocked ? 'check' : isNext ? 'target' : 'lock', { size: 15 })),
            h('div', { class: 'q-ms-main' },
              h('div', { class: 'q-ms-title' }, milestoneTitle(m.titleKey)),
              h('div', { class: 'q-ms-sub' }, t(`${fmtNum(m.at)} ქულა · ${m.unlocked ? 'გახსნილია' : isNext ? 'შენი შემდეგი ეტაპი' : 'გასახსნელია'}`, `${fmtNum(m.at)} ${Number(m.at) === 1 ? 'point' : 'points'} · ${m.unlocked ? 'Unlocked' : isNext ? 'Your next milestone' : 'Still ahead'}`)),
              m.cosmeticKey ? h('div', { class: 'q-ms-gift' }, icon('gift', { size: 12 }), t('კოლექციის ნივთი', 'Collection item')) : null));
        })));
      drawTimeline();
      mount(slot, h('div', { class: 'stack' },
        h('div', { class: 'card q-journey' },
          h('div', { class: 'hstack', style: { gap: '18px', flexWrap: 'nowrap' } }, emblem(ov.equipment),
            h('div', { style: { minWidth: 0 } },
              h('div', { class: 'faint', style: { fontSize: '12.5px' } }, t('შენი პირადი გზა', 'Your personal journey')),
              h('div', { class: 'q-big' }, chapterTitle(j.chapterKey)),
              h('div', { class: 'muted', style: { fontSize: '13px' } }, t(`${info.unlocked} / ${info.milestones.length} ეტაპი გახსნილია`, `${info.unlocked} / ${info.milestones.length} milestones unlocked`)))),
          h('div', { class: 'q-units-line' }, h('b', { class: 'num' }, fmtNum(j.units)), h('span', { class: 'muted' }, t('პროგრესის ქულა', 'progress points'))),
          progress(info.percent, 100),
          h('div', { class: 'muted', style: { fontSize: '13px' } }, info.next
            ? t(`შემდეგი: ${milestoneTitle(info.next.titleKey)} · დარჩა ${fmtNum(info.remaining)} ქულა`, `Next: ${milestoneTitle(info.next.titleKey)} · ${fmtNum(info.remaining)} ${Number(info.remaining) === 1 ? 'point' : 'points'} to go`)
            : t('ყველა ეტაპი გახსნილია. შენი მისიები და მიღწევები გრძელდება.', 'Every milestone is unlocked. Your missions and achievements keep going.')),
          h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('ქულა ავტომატურად ემატება შესრულებისას. XP და მონეტები ცალკე ჯილდოა — მისიის ბარათიდან მიიღე.', 'Points are added automatically when you complete a mission. XP and coins are a separate reward — claim them from the mission card.'))),
        chapters.length > 1 ? h('div', { class: 'chips' }, chapters.map((key, i) => {
          const c = h('button', { type: 'button', class: `chip ${key === chapter ? 'on' : ''}`, onClick: () => {
            chapter = key; c.parentNode.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); drawTimeline();
          } }, t(`თავი ${i + 1}`, `Chapter ${i + 1}`));
          return c;
        })) : null,
        timeline));
    } catch (e) {
      mount(slot, errorBox(e, () => loadJourney(slot)));
    }
  }

  async function loadAchievements(slot) {
    try {
      const data = await get('/api/achievements');
      if (!alive) return;
      if (data?.unavailable || !(data?.items || []).length) { mount(slot, h('div', { class: 'card' }, empty(t('მიღწევები აქ გამოჩნდება.', 'Your achievements will appear here.')))); return; }
      const s = data.summary || {};
      const total = Math.max(0, Number(s.total) || 0);
      const unlocked = Math.min(total, Math.max(0, Number(s.unlocked) || 0));
      mount(slot, h('div', { class: 'stack', style: { gap: '18px' } },
        h('div', { class: 'card' },
          h('div', { class: 'between' }, h('span', null, h('b', { class: 'num' }, `${unlocked} / ${total}`), h('span', { class: 'muted' }, t(' გახსნილია', ' unlocked'))),
            s.claimable ? badge(t(`${s.claimable} ჯილდო გელოდება`, `${s.claimable} ${s.claimable === 1 ? 'reward' : 'rewards'} waiting`), 'brand') : null),
          h('div', { style: { marginTop: '10px' } }, progress(total ? (unlocked / total) * 100 : 0, 100, { ink: 'amber' }))),
        groupAchievements(data.items).map((g) => h('div', { class: 'stack' },
          h('div', { class: 'q-cat' }, ACH.categories[g.category] || g.category),
          h('div', { class: 'q-medal-grid' }, g.items.map((a) => medal(a, false, () => { invalidate('/api/achievements'); loadAchievements(slot); })))))));
    } catch (e) {
      mount(slot, errorBox(e, () => loadAchievements(slot)));
    }
  }

  async function loadHistory(slot, cursor, list) {
    try {
      const res = await get('/api/quests/history', { take: 20, cursor });
      if (!alive) return;
      const listEl = list || h('div', { class: 'list' });
      for (const q of res?.items || []) {
        const st = q.status === 'CLAIMED' ? badge(t('მიღებულია', 'Claimed'), 'ok') : q.status === 'COMPLETED' ? badge(t('შესრულდა', 'Done'), 'brand') : badge(t('ვადა ამოიწურა', 'Expired'), 'neutral');
        const look = KIND_LOOK[questKind(q)] || KIND_LOOK.movement;
        listEl.appendChild(h('div', { class: 'row' }, tile(look.icon, q.status === 'EXPIRED' ? 'neutral' : look.ink, 36),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, questTitle(q)),
            h('div', { class: 'row-sub' }, [relDay(q.completedAt || q.claimedAt || q.assignedAt), progressLabel(q)].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' }, st)));
      }
      if (!list) {
        if (!listEl.children.length) { mount(slot, h('div', { class: 'card' }, empty(t('შესრულებული მისიები აქ გამოჩნდება.', 'Your completed missions will appear here.')))); return; }
        const more = h('div');
        mount(slot, h('div', { class: 'card' }, listEl, more));
        slot._more = more;
      }
      const more = slot._more;
      if (more) mount(more, res?.nextCursor ? (() => {
        const b = button(t('კიდევ', 'More'), { variant: 'ghost', size: 'sm' });
        b.addEventListener('click', () => busy(b, () => loadHistory(slot, res.nextCursor, listEl)));
        return h('div', { style: { textAlign: 'center', paddingTop: '8px' } }, b);
      })() : '');
    } catch (e) {
      if (list) toast(e?.message || t('ვერ ჩაიტვირთა', 'Couldn’t load'), 'error');
      else mount(slot, errorBox(e, () => loadHistory(slot)));
    }
  }

  /* ── Rewards tab ── */
  function renderRewards() {
    const storeSlot = h('div', null, skeletonGridLocal());
    const mineSlot = h('div', null, skeleton(2));
    const walletSlot = h('div', null, skeleton(4));
    const collSlot = h('div', null, skeleton(3));
    const left = h('div', { class: 'stack', style: { gap: '28px' } },
      section(t('ჯილდოების მაღაზია', 'Rewards store'), storeSlot),
      section(t('ჩემი ჯილდოები', 'My rewards'), mineSlot));
    const right = h('div', { class: 'stack', style: { gap: '28px' } },
      section(t('ბალანსი', 'Balance'), walletSlot));
    mount(body, h('div', { class: 'stack', style: { gap: '28px' } },
      h('div', { class: 'grid grid-main q-grid' }, left, right),
      section(t('ჩემი კოლექცია', 'My collection'), collSlot)));
    const reloadStore = () => {
      if (!featureOn('rewardsStore')) { mount(storeSlot, h('div', { class: 'card' }, empty(t('ჯილდოების მაღაზია დროებით შეჩერებულია', 'The rewards store is paused for now'), t('მონეტები ბალანსზე რჩება. მალე ისევ ჩაირთვება.', 'Your coins stay in your balance. It will be back soon.')))); return; }
      loadStore(storeSlot, reloadAll);
    };
    const reloadAll = () => { reloadStore(); loadMine(mineSlot); loadWallet(walletSlot); };
    reloadStore();
    loadMine(mineSlot);
    loadWallet(walletSlot);
    loadCollection(collSlot);
  }

  function skeletonGridLocal() { return h('div', { class: 'grid grid-2' }, skeleton(3), skeleton(3)); }

  async function loadWallet(slot) {
    try {
      const w = await get('/api/quests/rewards');
      if (!alive) return;
      const tx = w?.transactions || [];
      mount(slot, h('div', { class: 'stack' },
        h('div', { class: 'card q-wallet' },
          h('div', { class: 'hstack' }, tile('coins', 'amber', 42), h('span', { class: 'muted' }, t('ხელმისაწვდომი ბალანსი', 'Available balance'))),
          h('div', { class: 'q-balance num' }, fmtNum(dash?.profile?.coinBalance ?? w?.balance?.coins ?? 0), h('small', null, ' Medi Coins')),
          h('div', { class: 'grid grid-2', style: { gap: '10px' } },
            h('div', { class: 'q-mini' }, h('span', { class: 'faint' }, t('სულ მიღებული', 'Total earned')), h('b', { class: 'num' }, fmtNum(w?.totalEarned?.coins ?? 0))),
            h('div', { class: 'q-mini' }, h('span', { class: 'faint' }, t('დახარჯული', 'Spent')), h('b', { class: 'num' }, fmtNum(w?.totalSpent?.coins ?? 0)))),
          h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('Medi Coins ფული არ არის და ფულად არ იცვლება.', 'Medi Coins are not money and can’t be exchanged for money.'))),
        h('div', { class: 'card' },
          h('div', { class: 'card-title', style: { marginBottom: '6px' } }, t('ბალანსის ისტორია', 'Balance history')),
          tx.length ? h('div', { class: 'list' }, tx.slice(0, 30).map((row) => {
            const amt = Number(row.amount) || 0;
            const isCoin = row.currency === 'COIN';
            return h('div', { class: 'row' }, tile(LEDGER_ICON[row.sourceType] || 'wallet', amt < 0 ? 'rose' : isCoin ? 'amber' : 'violet', 34),
              h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, ledgerLabel(row.sourceType)), h('div', { class: 'row-sub' }, fmtDateTime(row.createdAt))),
              h('div', { class: `row-trail num q-amt ${amt < 0 ? 'neg' : 'pos'}` }, `${amt > 0 ? '+' : ''}${fmtNum(amt)} ${isCoin ? '' : 'XP'}`.trim()));
          })) : empty(t('Medi Coins გამოჩნდება, როცა ჯილდოს მიიღებ.', 'Your Medi Coins will appear here when you claim rewards.')))));
    } catch (e) {
      mount(slot, errorBox(e, () => loadWallet(slot)));
    }
  }

  async function loadStore(slot, onRedeemed) {
    try {
      const cat = await get('/api/rewards');
      if (!alive) return;
      const featured = cat?.featured || [];
      const available = (cat?.available || []).filter((r) => !featured.some((f) => f.id === r.id));
      const balance = cat?.balance?.coins ?? dash?.profile?.coinBalance ?? 0;
      if (!featured.length && !available.length) { mount(slot, h('div', { class: 'card' }, empty(t('ჯილდოები მალე გამოჩნდება.', 'Rewards will appear soon.'), t('გამოიყენე Medi Coins Medicard-ის სარგებელზე.', 'Use Medi Coins for Medicard benefits.')))); return; }
      mount(slot, h('div', { class: 'stack' },
        featured.length ? h('div', { class: 'q-cat' }, t('რჩეული', 'Featured')) : null,
        featured.length ? h('div', { class: 'grid grid-2' }, featured.map((r) => rewardCard(r, balance, onRedeemed, true))) : null,
        available.length && featured.length ? h('div', { class: 'q-cat' }, t('ხელმისაწვდომი', 'Available')) : null,
        available.length ? h('div', { class: 'grid grid-2' }, available.map((r) => rewardCard(r, balance, onRedeemed))) : null));
    } catch (e) {
      mount(slot, errorBox(e, () => loadStore(slot, onRedeemed)));
    }
  }

  function rewardCard(r, balance, onRedeemed, featured = false) {
    const out = r.inventoryState === 'OUT_OF_STOCK';
    const short = Math.max(0, Math.floor(Number(r.coinCost) || 0) - Math.floor(Number(balance) || 0));
    return h('button', { type: 'button', class: `card hover q-reward ${featured ? 'featured' : ''}`, onClick: () => rewardDetail(r, balance, onRedeemed) },
      h('div', { class: 'between' }, tile(r.partnerDisplay ? 'gift' : 'sparkles', featured ? 'amber' : 'teal', 42),
        out ? badge(t('მარაგი ამოწურულია', 'Out of stock'), 'neutral') : r.userEligibility?.canRedeem ? badge(t('ხელმისაწვდომი', 'Available'), 'ok') : short > 0 ? badge(t(`კიდევ ${fmtNum(short)}`, `${fmtNum(short)} more`), 'warn') : badge(t('მიუწვდომელი', 'Unavailable'), 'neutral')),
      h('div', { class: 'q-reward-title' }, rewardTitle(r)),
      r.partnerDisplay?.displayName ? h('div', { class: 'faint', style: { fontSize: '12.5px' } }, t(`პარტნიორი · ${r.partnerDisplay.displayName}`, `Partner · ${r.partnerDisplay.displayName}`)) : null,
      rewardDesc(r) ? h('div', { class: 'q-reward-sub' }, rewardDesc(r)) : null,
      h('div', { class: 'q-reward-foot' }, coin(r.coinCost), h('span', { class: 'link' }, t('ნახვა', 'View'), icon('chevronRight', { size: 16 }))));
  }

  function rewardDetail(r, balance, onRedeemed) {
    let idem = newIdempotencyKey();
    const after = Math.max(0, (Number(balance) || 0) - (Number(r.coinCost) || 0));
    const short = Math.max(0, Math.floor(Number(r.coinCost) || 0) - Math.floor(Number(balance) || 0));
    const canRedeem = r.inventoryState !== 'OUT_OF_STOCK' && Boolean(r.userEligibility?.canRedeem);
    const err = h('div', { class: 'form-error', hidden: true });
    const m = openModal({
      title: rewardTitle(r),
      size: 'md',
      body: h('div', { class: 'stack', style: { gap: '16px' } },
        rewardDesc(r) ? h('div', null, h('div', { class: 'field-label' }, t('რას მიიღებ', 'What you get')), h('p', { class: 'muted', style: { marginTop: '6px' } }, rewardDesc(r))) : null,
        h('div', { class: 'grid grid-2', style: { gap: '10px' } },
          h('div', { class: 'q-mini' }, h('span', { class: 'faint' }, t('ღირებულება', 'Cost')), h('b', null, coin(r.coinCost))),
          h('div', { class: 'q-mini' }, h('span', { class: 'faint' }, t('შენ გაქვს', 'You have')), h('b', null, coin(balance)))),
        r.entitlementDurationDays || r.redemptionExpiryDays ? h('div', { class: 'muted', style: { fontSize: '13.5px' } },
          t(`მოქმედების ვადა: ${fmtNum(r.entitlementDurationDays || r.redemptionExpiryDays)} დღე`, `Valid for: ${fmtNum(r.entitlementDurationDays || r.redemptionExpiryDays)} ${Number(r.entitlementDurationDays || r.redemptionExpiryDays) === 1 ? 'day' : 'days'}`)) : null,
        r.validUntil ? h('div', { class: 'muted', style: { fontSize: '13.5px' } }, t(`შეთავაზება მოქმედებს ${fmtDate(r.validUntil, { year: true })}-მდე`, `Offer valid until ${fmtDate(r.validUntil, { year: true })}`)) : null,
        rewardTerms(r) ? h('div', null, h('div', { class: 'field-label' }, t('პირობები', 'Terms')), h('p', { class: 'faint', style: { marginTop: '6px', fontSize: '13px' } }, rewardTerms(r))) : null,
        !canRedeem ? h('div', { class: 'q-notice warn' }, icon('info', { size: 16 }), h('span', null,
          r.inventoryState === 'OUT_OF_STOCK' ? t('მარაგი ამოწურულია', 'Out of stock') : short > 0 ? t(`კიდევ ${fmtNum(short)} Medi Coins დაგჭირდება.`, `You need ${fmtNum(short)} more Medi Coins.`) : rewardError(r.userEligibility?.reasonCode))) : null,
        err),
      footer: (close) => {
        const redeem = button(t('გაცვლა', 'Redeem'), { icon: 'gift', disabled: !canRedeem });
        redeem.addEventListener('click', () => {
          // Second step: confirm with the balance before and after.
          openModal({
            title: t('გავცვალო?', 'Redeem?'),
            size: 'sm',
            body: h('div', { class: 'stack' },
              h('p', { class: 'muted' }, t(`გაცვლა ${fmtNum(r.coinCost)} Medi Coins-ზე?`, `Redeem for ${fmtNum(r.coinCost)} Medi Coins?`)),
              h('div', { class: 'between' }, h('span', { class: 'faint' }, t('ამჟამინდელი ბალანსი', 'Current balance')), coin(balance)),
              h('div', { class: 'between' }, h('span', { class: 'faint' }, t('შემდეგ', 'After')), coin(after))),
            footer: (close2) => {
              const yes = button(t('გაცვლა', 'Redeem'));
              yes.addEventListener('click', () => busy(yes, async () => {
                err.hidden = true;
                try {
                  const res = await post(`/api/rewards/${encodeURIComponent(r.id)}/redeem`, { idempotencyKey: idem });
                  close2(); close();
                  if (dash?.profile && res?.wallet) setDash({ ...dash, profile: { ...dash.profile, coinBalance: res.wallet.currentBalance } });
                  invalidate('/api/rewards');
                  invalidate('/api/quests');
                  redeemed(res, r);
                  onRedeemed?.();
                } catch (e) {
                  close2();
                  idem = newIdempotencyKey();
                  if (e instanceof ApiError && e.code === 'PHONE_VERIFICATION_REQUIRED') {
                    close();
                    offerPhoneVerification();
                    return;
                  }
                  err.textContent = e instanceof ApiError && e.code ? rewardError(e.code) : (e?.message || rewardError('REWARD_REDEMPTION_CONFLICT'));
                  err.hidden = false;
                }
              }));
              return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close2() }), yes];
            },
          });
        });
        return [button(t('დახურვა', 'Close'), { variant: 'ghost', onClick: () => close() }), redeem];
      },
    });
    return m;
  }

  function redeemed(res, r) {
    const red = res?.redemption || {};
    const code = red.code || null;
    let shown = false;
    const codeEl = h('span', { class: 'q-code num' }, red.codeMasked || '••••');
    openModal({
      title: t('ჯილდო გაიცვალა', 'Reward redeemed'),
      size: 'sm',
      body: h('div', { class: 'stack', style: { gap: '14px', textAlign: 'center', alignItems: 'center' } },
        h('span', { class: 'tile ink-amber', style: { width: '64px', height: '64px' } }, icon('gift', { size: 30 })),
        h('div', { class: 'q-reward-title' }, rewardTitle(red.reward || r)),
        res?.wallet ? h('div', { class: 'muted' }, t('ახალი ბალანსი: ', 'New balance: '), coin(res.wallet.currentBalance)) : null,
        code ? h('div', { class: 'q-codebox' }, codeEl,
          h('div', { class: 'hstack', style: { justifyContent: 'center' } },
            button(t('კოდის ჩვენება', 'Reveal code'), { variant: 'ghost', size: 'sm', icon: 'eye', onClick: (e) => { shown = !shown; codeEl.textContent = shown ? code : (red.codeMasked || '••••'); e.currentTarget.querySelector('span:last-child').textContent = shown ? t('დამალვა', 'Hide') : t('კოდის ჩვენება', 'Reveal code'); } }),
            button(t('კოდის კოპირება', 'Copy code'), { variant: 'ghost', size: 'sm', icon: 'copy', onClick: () => { navigator.clipboard?.writeText(code).then(() => toast(t('კოდი დაკოპირდა', 'Code copied')), () => {}); } }))) : null,
        red.expiresAt ? h('div', { class: 'faint', style: { fontSize: '13px' } }, t(`ვადა: ${fmtDate(red.expiresAt, { year: true })}`, `Expires: ${fmtDate(red.expiresAt, { year: true })}`)) : null,
        (res?.entitlement || red.entitlement)?.endsAt ? h('div', { class: 'faint', style: { fontSize: '13px' } }, t(`აქტიურია ${fmtDate((res.entitlement || red.entitlement).endsAt, { year: true })}-მდე`, `Active until ${fmtDate((res.entitlement || red.entitlement).endsAt, { year: true })}`)) : null),
      footer: (close) => [button(t('გასაგებია', 'Got it'), { onClick: () => close() })],
    });
  }

  async function loadMine(slot) {
    try {
      const mine = await get('/api/rewards/redemptions');
      if (!alive) return;
      const groups = [[t('აქტიური', 'Active'), mine?.active || [], t('გაცემული', 'Issued'), 'ok'], [t('გამოყენებული', 'Used'), mine?.used || [], t('გამოყენებული', 'Used'), 'neutral'], [t('ვადაგასული', 'Expired'), mine?.expired || [], t('ვადაგასული', 'Expired'), 'neutral']];
      if (!groups.some(([, list]) => list.length)) { mount(slot, h('div', { class: 'card' }, empty(t('ჯერ არც ერთი გაცვლა არ გაქვს.', 'No redemptions yet.')))); return; }
      mount(slot, h('div', { class: 'card' }, groups.filter(([, list]) => list.length).map(([title, list, status, tone]) => h('div', { class: 'q-mine-group' },
        h('div', { class: 'q-cat' }, title),
        h('div', { class: 'list' }, list.map((it) => h('div', { class: 'row' }, tile('gift', tone === 'ok' ? 'amber' : 'neutral', 36),
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, it.reward ? rewardTitle(it.reward) : t('ჯილდო', 'Reward')),
            h('div', { class: 'row-sub' }, [status, fmtDate(it.redeemedAt, { year: true }), it.expiresAt ? t(`ვადა ${fmtDate(it.expiresAt, { year: true })}`, `Expires ${fmtDate(it.expiresAt, { year: true })}`) : ''].filter(Boolean).join(' · ')),
            it.code || it.codeMasked ? h('div', { class: 'q-code-sm num' }, it.codeMasked || '••••') : null),
          h('div', { class: 'row-trail' }, coin(it.coinCost)))))))));
    } catch (e) {
      mount(slot, errorBox(e, () => loadMine(slot)));
    }
  }

  async function loadCollection(slot) {
    try {
      const ov = await get('/api/medi-companion', { reducedMotion: 1 });
      if (!alive) return;
      let equipment = { accent: null, accessory: null, background: null, decoration: null, ...(ov?.equipment || {}) };
      const collection = questCollection(ov);
      const SLOTS = [{ value: 'accent', label: t('ფერი', 'Color') }, { value: 'background', label: t('ფონი', 'Background') }, { value: 'accessory', label: t('სიმბოლო', 'Symbol') }, { value: 'decoration', label: t('დეკორი', 'Decor') }];
      let current = 'accent';
      let busyKey = null;
      const grid = h('div');
      const seal = h('div');
      const errEl = h('div');
      const drawSeal = () => mount(seal, emblem(equipment, 96));
      const draw = () => {
        const items = collection.filter((i) => i.slot === current);
        mount(grid, items.length ? h('div', { class: 'q-coll-grid' }, items.map((item) => {
          const equipped = equipment[current] === item.key;
          const removable = equipped && (current === 'accessory' || current === 'decoration');
          const ms = (ov.journey?.milestones || []).find((m) => m.cosmeticKey === item.key);
          let action;
          if (item.unlocked) {
            action = button(removable ? t('მოხსნა', 'Remove') : equipped ? t('არჩეულია', 'Selected') : t('არჩევა', 'Select'), { variant: 'secondary', size: 'sm', disabled: (equipped && !removable) || Boolean(busyKey) });
            action.addEventListener('click', () => busy(action, async () => {
              busyKey = item.key;
              mount(errEl, '');
              try {
                const res = await put('/api/medi-companion/equipment', { [current]: removable ? null : item.key });
                equipment = { ...equipment, ...(res?.equipment || {}) };
                drawSeal(); draw();
              } catch {
                mount(errEl, h('div', { class: 'form-error' }, t('სტილი ვერ შეინახა. შეამოწმე კავშირი და ხელახლა აირჩიე.', 'Couldn’t save the style. Check your connection and choose again.')));
              } finally { busyKey = null; }
            }));
          } else {
            action = h('div', { class: 'faint q-locked' }, icon('lock', { size: 14 }), t('გააგრძელე მისიები', 'Keep doing missions'));
          }
          return h('div', { class: `card q-coll ${equipped ? 'on' : ''} ${item.unlocked ? '' : 'locked'}` },
            emblem({ ...equipment, [current]: item.key }, 62),
            h('div', { class: 'q-coll-title' }, cosmeticTitle(item)),
            h('div', { class: 'faint', style: { fontSize: '12px' } }, equipped ? t('არჩეულია', 'Selected') : item.unlocked ? t('გახსნილია', 'Unlocked') : ms ? t(`გაიხსნება ${fmtNum(ms.at)} ქულაზე`, `Unlocks at ${fmtNum(ms.at)} ${Number(ms.at) === 1 ? 'point' : 'points'}`) : t('ჯერ გასახსნელია', 'Still locked')),
            h('div', { style: { marginTop: 'auto' } }, action));
        })) : h('div', { class: 'card' }, empty(t('ამ კატეგორიაში ნივთები ჯერ არ არის.', 'No items in this category yet.'))));
      };
      drawSeal(); draw();
      const unlockedCount = collection.filter((i) => i.unlocked).length;
      mount(slot, h('div', { class: 'stack' },
        h('div', { class: 'card q-coll-head' }, seal,
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div', { class: 'card-title' }, t('შენი პროგრესის ნიშანი', 'Your progress seal')),
            h('div', { class: 'muted', style: { fontSize: '13.5px' } }, t('ეტაპებზე გახსნილი ფერით, ფონითა და სიმბოლოებით გააფორმე.', 'Style it with the colors, backgrounds and symbols you unlock at milestones.')),
            h('div', { class: 'faint', style: { fontSize: '12.5px', marginTop: '6px' } }, t(`${unlockedCount} / ${collection.length} გახსნილია · სტილი ცვლის მხოლოდ ვიზუალს — ქულები და ჯილდოები იგივე რჩება.`, `${unlockedCount} / ${collection.length} unlocked · Style only changes the look — points and rewards stay the same.`)))),
        segmented(SLOTS, current, (v) => { current = v; draw(); }),
        errEl, grid));
    } catch (e) {
      mount(slot, errorBox(e, () => loadCollection(slot)));
    }
  }

  function whyTarget(q) {
    const kind = q.targetSource === 'PERSONALIZED' ? 'personalized' : q.targetSource === 'COMEBACK' ? 'comeback' : 'default';
    openModal({ title: WHY.title, size: 'sm',
      body: h('div', { class: 'stack' }, h('b', { class: 'q-brand' }, t(`${fmtNum(q.target)} ნაბიჯი`, `${fmtNum(q.target)} steps`)), h('p', { class: 'muted' }, WHY[kind])),
      footer: (close) => [button(t('გასაგებია', 'Got it'), { onClick: () => close() })] });
  }

  function guide() {
    const QUESTIONS = isEn ? [
      ['What’s the difference between XP and coins?', 'XP is experience and raises your level. Medi Coins are used in the rewards store. You get both when you claim a mission or achievement reward. Spending coins never lowers your XP or level; coins are not money.'],
      ['How are progress points counted?', 'Each completed daily mission gives you 1 progress point, and a weekly mission gives 3. Points are counted automatically when you complete a mission, even before you claim the reward. Progress points unlock new milestones and collection items. Achievements don’t add to these points. They are not a step count or distance walked.'],
      ['How does the streak work?', 'If you complete at least one daily mission, the day counts toward your streak. Active days in a row grow the streak. A missed day ends the current streak; your best streak, earned XP and rewards stay. Just opening the app doesn’t grow the streak.'],
      ['When do missions refresh?', 'Daily missions change when a new day starts, weekly missions on Monday. Time follows your account’s time zone. You can claim a completed mission’s reward later; an unfinished mission moves to history once it expires.'],
      ['Where do steps and water progress come from?', 'Steps sync through a connection to your phone’s health app — use the MEDICARD app on your phone for this. The water mission needs a daily hydration goal and logged water. Progress is counted by the system; you can’t mark a mission done by hand on this page.'],
      ['How is the Medi mission completed?', 'Open Medi and talk to it. The mission is completed after a successful conversation. Talking to Medi is free. Sharing data with AI needs your consent.'],
      ['Why did my goal change?', 'A new movement goal can adapt to your recent activity. “Why this goal?” on the mission card shows the exact reason. The goal of a mission that’s already assigned stays fixed. Play at your own pace — XP and level are not a health assessment.'],
    ] : [
      ['რა განსხვავებაა XP-სა და მონეტებს შორის?', 'XP გამოცდილებაა და შენს დონეს ზრდის. Medi Coins ჯილდოების მაღაზიაში გამოიყენება. ორივეს იღებ მისიის ან მიღწევის ჯილდოს მიღებისას. მონეტების დახარჯვა XP-სა და დონეს არ ამცირებს; მონეტები ფული არ არის.'],
      ['როგორ ვითვლით პროგრესის ქულებს?', 'ყოველი შესრულებული დღიური მისია გაძლევს 1 პროგრესის ქულას, კვირის მისია — 3-ს. ქულები ავტომატურად ითვლება შესრულებისას, ჯილდოს მიღებამდეც. პროგრესის ქულებით ახალ ეტაპებსა და კოლექციის ნივთებს ხსნი. მიღწევები ამ ქულებს არ ამატებს. ეს არ არის ნაბიჯების რაოდენობა ან გავლილი კილომეტრები.'],
      ['როგორ მუშაობს სერია?', 'ერთ დღიურ მისიას მაინც თუ შეასრულებ, დღე სერიაში ჩაითვლება. ზედიზედ აქტიური დღეები სერიას ზრდის. გამოტოვებული დღე მიმდინარე სერიას წყვეტს; შენი საუკეთესო სერია, მიღებული XP და ჯილდოები რჩება. მხოლოდ აპის გახსნა ამ სერიას არ ზრდის.'],
      ['როდის განახლდება მისიები?', 'დღიური მისიები ახალი დღის დაწყებისას იცვლება, კვირის მისიები — ორშაბათს. დრო ანგარიშის დროის სარტყლის მიხედვით ითვლება. უკვე შესრულებული მისიის ჯილდო მოგვიანებითაც შეგიძლია მიიღო; შეუსრულებელი მისია ვადის გასვლის შემდეგ ისტორიაში გადადის.'],
      ['საიდან მოდის ნაბიჯები და წყლის პროგრესი?', 'ნაბიჯები ჯანმრთელობის აპთან კავშირით სინქრონდება — ამისთვის გამოიყენე MEDICARD აპი ტელეფონზე. წყლის მისიისთვის საჭიროა ჰიდრატაციის დღიური მიზანი და დაფიქსირებული წყალი. პროგრესს სისტემა ითვლის; ამ გვერდზე ხელით ვერ მონიშნავ მისიას შესრულებულად.'],
      ['როგორ სრულდება Medi-ს მისია?', 'გახსენი Medi და ესაუბრე მას. მისია შესრულდება წარმატებული საუბრის შემდეგ. Medi-სთან საუბარი უფასოა. მონაცემების AI-სთან გაზიარებისთვის საჭიროა შენი თანხმობა.'],
      ['რატომ შეიცვალა ჩემი მიზანი?', 'მოძრაობის ახალი მიზანი შეიძლება ბოლო აქტივობას მოერგოს. მისიის ბარათზე „რატომ ეს მიზანი?“ ზუსტ მიზეზს გაჩვენებს. უკვე დანიშნული მისიის მიზანი ფიქსირებულია. ითამაშე შენი ტემპით — XP და დონე ჯანმრთელობის შეფასება არ არის.'],
    ];
    const tzName = dash?.daily?.timezone || dash?.profile?.timezone;
    openModal({
      title: t('როგორ მუშაობს?', 'How it works'),
      size: 'md',
      body: h('div', { class: 'stack', style: { gap: '14px' } },
        h('div', { class: 'card q-steps' }, [t('აირჩიე დღიური ან კვირის მისია.', 'Pick a daily or weekly mission.'), t('შეასრულე — პროგრესი ავტომატურად განახლდება.', 'Complete it — progress updates automatically.'), t('დააჭირე „ჯილდოს მიღება“ და მიიღე XP + მონეტები.', 'Tap “Claim reward” to get XP + coins.')]
          .map((line, i) => h('div', { class: 'hstack', style: { flexWrap: 'nowrap', alignItems: 'flex-start' } }, h('b', { class: 'q-brand' }, `0${i + 1}`), h('span', null, line)))),
        QUESTIONS.map(([q, b]) => h('details', { class: 'q-faq' }, h('summary', null, q, icon('chevronDown', { size: 16 })), h('p', { class: 'muted' }, b))),
        tzName ? h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t(`შენი დროის სარტყელი: ${tzName}`, `Your time zone: ${tzName}`)) : null),
      footer: (close) => [button(t('გასაგებია', 'Got it'), { onClick: () => close() })],
    });
  }

  function levelUp(level, reward) {
    openModal({
      title: t('ახალი დონე', 'New level'),
      size: 'sm',
      body: h('div', { class: 'stack', style: { alignItems: 'center', textAlign: 'center', gap: '12px' } },
        ring({ value: 100, max: 100, size: 120, stroke: 10, label: String(level), sub: t('დონე', 'Level'), labelScale: 0.3 }),
        h('div', { class: 'q-rank' }, rankLabel(rankKeyFromLevel(level))),
        h('p', { class: 'muted' }, t('ახალი დონე. ლამაზად მივდივართ 😄', 'New level. Beautifully done 😄')),
        reward ? h('div', { class: 'hstack', style: { justifyContent: 'center' } },
          h('span', { class: 'q-pill coin' }, icon('coins', { size: 13 }), `+${fmtNum(reward.coinsAwarded)}`),
          h('span', { class: 'q-pill xp' }, `+${fmtNum(reward.xpAwarded)} XP`)) : null),
      footer: (close) => [button(t('გაგრძელება', 'Continue'), { onClick: () => close() })],
    });
  }

  await loadDash();

  // Coins and mission progress change on their own (steps, water from the phone): re-read on return.
  const onVis = () => { if (!document.hidden && alive) { invalidate('/api/quests'); get('/api/quests', tz() ? { timezone: tz() } : undefined).then((d) => { if (alive && d) { dash = d; renderHero(); if (tab === 'missions') renderMissions(); } }).catch(() => {}); } };
  document.addEventListener('visibilitychange', onVis);
  return () => { alive = false; document.removeEventListener('visibilitychange', onVis); };
}

/* ── Referral card (Phase 3.4). Coins have no monetary value. ── */
function referralCard() {
  const slot = h('div', { class: 'card q-invite' }, skeleton(3));
  const draw = async () => {
    try {
      const d = await get('/api/referrals/me');
      const steps = isEn ? [
        'Your friend installs MEDICARD and signs up',
        'Within 14 days of signing up, they enter your code',
        'They verify their phone and make a first entry — a medication, lab result, visit, meal or cycle log',
        `You each get ${fmtNum(d?.coinsPerSide ?? 100)} Medi Coins`,
      ] : [
        'მეგობარი აყენებს MEDICARD-ს და რეგისტრირდება',
        'რეგისტრაციიდან 14 დღეში შეჰყავს შენი კოდი',
        'ადასტურებს ტელეფონს და აკეთებს პირველ ჩანაწერს — წამალი, ანალიზი, ვიზიტი, კვება ან ციკლი',
        `ორივე იღებთ ${fmtNum(d?.coinsPerSide ?? 100)} Medi მონეტას`,
      ];
      const parts = [
        h('div', { class: 'hstack', style: { flexWrap: 'nowrap' } }, tile('gift', 'amber', 42),
          h('div', null, h('div', { class: 'card-title' }, t('მოიწვიე ოჯახის წევრი', 'Invite a family member')),
            h('div', { class: 'muted', style: { fontSize: '13px' } }, t(`პირველი ჩანაწერის შემდეგ ორივე მიიღებთ ${fmtNum(d?.coinsPerSide ?? 100)} Medi მონეტას.`, `After their first entry, you each get ${fmtNum(d?.coinsPerSide ?? 100)} Medi Coins.`)))),
      ];
      if (d?.phoneRequired) {
        parts.push(h('div', { class: 'q-notice' }, icon('smartphone', { size: 16 }), h('span', null, t('კოდის მისაღებად დაადასტურე ტელეფონი. ასე ვიცავთ მოწვევებს ყალბი ანგარიშებისგან.', 'Verify your phone to get your code. This protects invites from fake accounts.'))),
          button(t('ტელეფონის დადასტურება', 'Verify phone'), { variant: 'secondary', icon: 'smartphone', onClick: async () => { if (await verifyPhone()) { invalidate('/api/referrals'); draw(); } } }));
      }
      if (d?.code) {
        const shareText = t(`შემოდი MEDICARD-ში — წამლები, ანალიზები და ჯანმრთელობა ერთ აპში. რეგისტრაციის შემდეგ შეიყვანე ჩემი კოდი ${d.code} და ორივე მივიღებთ ${d.coinsPerSide} Medi მონეტას.\n${d.link || ''}`, `Join me on MEDICARD — medications, lab results and health in one app. After you sign up, enter my code ${d.code} and we’ll both get ${d.coinsPerSide} Medi Coins.\n${d.link || ''}`);
        parts.push(
          h('div', { class: 'q-invite-code' }, h('span', { class: 'faint' }, t('შენი კოდი', 'Your code')), h('b', { class: 'num', 'aria-label': t(`შენი კოდი: ${d.code.split('').join(' ')}`, `Your code: ${d.code.split('').join(' ')}`) }, d.code)),
          h('div', { class: 'hstack' },
            button(t('კოდის გაზიარება', 'Share code'), { icon: 'share', onClick: async () => {
              try {
                if (navigator.share) await navigator.share({ text: shareText });
                else { await navigator.clipboard.writeText(shareText); toast(t('ბმული მზადაა გასაზიარებლად', 'Link copied — ready to share')); }
              } catch { /* dismissed */ }
            } }),
            button(t('კოპირება', 'Copy'), { variant: 'ghost', icon: 'copy', onClick: () => navigator.clipboard?.writeText(d.link || d.code).then(() => toast(t('დაკოპირდა', 'Copied')), () => {}) })),
          h('div', { class: 'grid grid-3 q-invite-stats' },
            h('div', { class: 'q-mini' }, h('b', { class: 'num' }, fmtNum(d.invited)), h('span', { class: 'faint' }, t('მოწვეული', 'Invited'))),
            h('div', { class: 'q-mini' }, h('b', { class: 'num' }, fmtNum(d.pending)), h('span', { class: 'faint' }, t('ელოდება', 'Pending'))),
            h('div', { class: 'q-mini' }, h('b', { class: 'num' }, fmtNum(d.coinsEarned)), h('span', { class: 'faint' }, t('მიღებული მონეტა', 'Coins earned')))),
          h('div', { class: 'faint', style: { fontSize: '12.5px' } }, t(`ამ თვეში კიდევ ${fmtNum(d.monthRemaining)} ბონუსი შეგიძლია მიიღო (მაქს. ${fmtNum(d.monthlyCap)}).`, `You can get ${fmtNum(d.monthRemaining)} more ${Number(d.monthRemaining) === 1 ? 'bonus' : 'bonuses'} this month (max ${fmtNum(d.monthlyCap)}).`)));
      }
      parts.push(h('details', { class: 'q-faq' }, h('summary', null, t('როგორ მუშაობს', 'How it works'), icon('chevronDown', { size: 16 })),
        h('ol', { class: 'q-steps-list' }, steps.map((s) => h('li', null, s))),
        h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('Medi მონეტებს ფულადი ღირებულება არ აქვს.', 'Medi Coins have no cash value.'))));
      if (d?.invitedBy) {
        parts.push(h('p', { class: 'muted', style: { fontSize: '13px' } }, d.invitedBy.status === 'REWARDED'
          ? t('მოწვევის ბონუსი უკვე მიღებული გაქვს.', 'You’ve already received your invite bonus.')
          : t('მოწვევის კოდი შეყვანილია. ბონუსს მიიღებ ტელეფონის დადასტურებისა და პირველი ჩანაწერის შემდეგ.', 'Invite code entered. You’ll get the bonus after you verify your phone and make your first entry.')));
      } else if (d?.canClaim) {
        // Claiming a friend's code is tied to one device, so it stays in the phone app.
        parts.push(h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('მეგობრის კოდი გაქვს? შეიყვანე MEDICARD აპში: პროფილი → მოიწვიე მეგობარი.', 'Have a friend’s code? Enter it in the MEDICARD app: Profile → Invite a friend.')));
      }
      mount(slot, h('div', { class: 'stack' }, parts));
    } catch (e) {
      mount(slot, errorBox(e, draw));
    }
  };
  draw();
  return slot;
}

/* ── Home card: level/XP, coins and today's missions. Never throws. ── */
export function homeCard() {
  ensureCss();
  const el = h('div', { class: 'card q-home' }, skeleton(3));
  (async () => {
    try {
      const d = await get('/api/quests', tz() ? { timezone: tz() } : undefined);
      const p = d?.profile;
      if (!p) {
        mount(el, empty(t('მისიები დროებით მიუწვდომელია', 'Missions are temporarily unavailable'), t('შენი დაგროვილი მონაცემები ანგარიშზე რჩება.', 'Everything you’ve earned stays on your account.')));
        return;
      }
      const lr = levelRing(p);
      const daily = orderedMissions(d.daily?.quests || []).filter((q) => q.status !== 'EXPIRED').slice(0, 3);
      const ready = (d.summary?.unclaimedRewards || 0) > 0;
      mount(el,
        h('div', { class: 'q-home-top' },
          ring({ value: lr.percent, max: 100, size: 64, stroke: 7, label: String(p.level), labelScale: 0.34 }),
          h('div', { class: 'q-home-rank' },
            h('div', { class: 'card-title' }, rankLabel(p.rankKey || rankKeyFromLevel(p.level))),
            h('div', { class: 'faint', style: { fontSize: '12.5px' } }, lr.remaining != null ? t(`შემდეგ დონემდე ${fmtNum(lr.remaining)} XP`, `${fmtNum(lr.remaining)} XP to next level`) : t('უმაღლესი დონე მიღწეულია', 'Top level reached'))),
          h('div', { class: 'q-home-coins' }, coin(p.coinBalance), h('span', { class: 'faint' }, t(`${fmtNum(p.currentStreak)} დღე სერია`, `${fmtNum(p.currentStreak)}-day streak`)))),
        ready ? h('div', { class: 'q-notice' }, icon('gift', { size: 16 }), h('span', null, t('ჯილდო მზადაა — მიიღე Medi Quest-ში.', 'A reward is ready — claim it in Medi Quest.'))) : null,
        daily.length ? h('div', { class: 'q-home-list' }, daily.map((q) => {
          const look = KIND_LOOK[questKind(q)] || KIND_LOOK.movement;
          const claimed = q.status === 'CLAIMED';
          return h('div', { class: 'q-home-row' },
            claimed ? h('span', { class: 'tile ink-green', style: { width: '34px', height: '34px' } }, icon('check', { size: 16 })) : tile(look.icon, look.ink, 34),
            h('div', { class: 'q-home-main' },
              h('div', { class: 'between' }, h('span', { class: 'q-home-title' }, questTitle(q)),
                q.claimable ? badge(t('ჯილდო მზადაა', 'Reward ready'), 'brand') : h('span', { class: 'faint num', style: { fontSize: '12.5px' } }, claimed ? t('მიღებულია', 'Claimed') : progressLabel(q))),
              claimed ? null : progress(pct(q.progressPercent), 100, { ink: q.claimable ? 'green' : look.ink })));
        })) : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('დღეს Medi ჯერ არ მოამზადა მისიები.', 'Medi hasn’t prepared missions yet today.')),
        h('a', { class: 'link q-home-link', href: '/quest', 'data-link': '' }, t('გახსენი Medi Quest', 'Open Medi Quest'), icon('chevronRight', { size: 16 })));
    } catch (e) {
      mount(el, errorBox(e, () => { const next = homeCard(); el.replaceWith(next); }));
    }
  })();
  return el;
}
