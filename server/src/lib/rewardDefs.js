/**
 * Phase 7 — Medi Rewards Store catalog.
 * Prices are explicit. Cosmetics only — no pay-to-win.
 *
 * ACTIVE only when the entitlement can be fulfilled.
 * Premium package billing ≠ Quest Premium entitlement → PREMIUM_* stay DRAFT.
 * PARTNER_TEST_10 is DEV/QA architecture only → always DRAFT in production seed.
 */

export const REWARD_TYPES = Object.freeze({
  DIGITAL_PERK: 'DIGITAL_PERK',
  COUPON_CODE: 'COUPON_CODE',
  PARTNER_VOUCHER: 'PARTNER_VOUCHER',
  PREMIUM_ACCESS: 'PREMIUM_ACCESS',
  /** A real item (gift card, gadget) handed over by the team: redemption stays PENDING until it is. */
  PHYSICAL_PRIZE: 'PHYSICAL_PRIZE',
});

export const REWARD_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  ARCHIVED: 'ARCHIVED',
});

export const INVENTORY_MODES = Object.freeze({
  UNLIMITED: 'UNLIMITED',
  FINITE: 'FINITE',
  CODE_POOL: 'CODE_POOL',
});

export const REDEMPTION_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  ISSUED: 'ISSUED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

export const CODE_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  DISABLED: 'DISABLED',
});

export const PERIOD_LIMIT_TYPES = Object.freeze({
  NONE: 'NONE',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  LIFETIME: 'LIFETIME',
  ROLLING_DAYS: 'ROLLING_DAYS',
});

export const LEDGER_SOURCE_REWARD_REDEMPTION = 'REWARD_REDEMPTION';
/** Coins returned when the team cancels a redemption (sourceId = redemption id). */
export const LEDGER_SOURCE_REWARD_REFUND = 'REWARD_REFUND';

/** Canonical entitlement keys for first-party digital perks. */
export const ENTITLEMENT_KEYS = Object.freeze({
  QUEST_THEME_PREMIUM: 'quest.theme.premium',
  QUEST_PROFILE_STYLE: 'quest.style.profile',
});

/**
 * MediCard does not yet have a Quest/Medi Premium entitlement separate from
 * AI package billing (FREE/STANDARD/ULTIMATE). Do not fake premium=true.
 */
export const QUEST_PREMIUM_ENTITLEMENT_EXISTS = false;

/**
 * MEDICARD is entirely free (App Review 2026-09-22): premium-access rewards are retired from
 * the active catalog. Existing rows are archived by `ensureRewardDefinitions`; ledger,
 * redemptions and entitlements already issued stay untouched for data integrity.
 */
export const RETIRED_REWARD_KEYS = Object.freeze(['MEDI_PREMIUM_DAY', 'MEDI_PREMIUM_3D']);


/**
 * Medi Coins store prizes (owner decision 2026-10-02): Zoommer gift cards and popular gadgets, 100 coins ≈ 1 ₾ of
 * shop price, finite stock (the owner's real budget, ~5 000 ₾ if everything goes). A redemption is PENDING until the
 * team hands the prize over in Tbilisi (admin: Rewards → redemptions → „გაცემულია“, or cancel = coins back + stock back).
 * Stock is set here only when the row is created; afterwards it is managed in admin (inventory adjust).
 */
const SHOP_TEXT = {
  giftcard_50: { title: "Zoommer-ის სასაჩუქრე ბარათი 50₾", description: "იყიდე Zoommer-ში ნებისმიერი რამ 50₾-ის ღირებულებით." },
  giftcard_100: { title: "Zoommer-ის სასაჩუქრე ბარათი 100₾", description: "იყიდე Zoommer-ში ნებისმიერი რამ 100₾-ის ღირებულებით." },
  giftcard_200: { title: "Zoommer-ის სასაჩუქრე ბარათი 200₾", description: "იყიდე Zoommer-ში ნებისმიერი რამ 200₾-ის ღირებულებით." },
  buds: { title: "Xiaomi Redmi Buds 6 Active", description: "უსადენო ყურსასმენები ხმაურის ჩახშობით — სირბილისთვის და ყოველდღისთვის." },
  scale: { title: "Xiaomi ჭკვიანი სასწორი S400", description: "წონა, ცხიმოვანი და კუნთოვანი მასა, პულსი — ყოველ დილით ერთ წამში." },
  powerbank: { title: "Xiaomi Power Bank 10 000 mAh", description: "22.5W სწრაფი დატენვა ჯიბის ზომაში: ტელეფონი MEDIRUN-ზე აღარ დაგიჯდება." },
  redmiwatch: { title: "Xiaomi Redmi Watch 5 Active", description: "დიდი ეკრანი, პულსი, ნაბიჯები და ძილი — და გრძელი ბატარეა." },
  band: { title: "Xiaomi Smart Band 10", description: "მსუბუქი სამაჯური AMOLED ეკრანით: პულსი, ძილი და ვარჯიშები." },
  airpods: { title: "Apple AirPods 4", description: "ახალი AirPods: მსუბუქი, კომფორტული, სივრცითი აუდიოთი." },
  airpodspro: { title: "Apple AirPods Pro 3", description: "ხმაურის აქტიური ჩახშობა და პულსის გაზომვა ვარჯიშისას." },
  watch: { title: "Apple Watch SE 3", description: "Apple Watch SE 3 GPS: აქტიურობა, ძილი და ვარჯიში მაჯაზე." },
};
const SHOP_TERMS_GIFT_CARD = "ფიზიკურ ბარათს თბილისში 14 დღეში გადმოგცემთ — დაგიკავშირდებით ანგარიშის ტელეფონზე. ფულზე არ იცვლება. მარაგი შეზღუდულია. თუ გადაცემა ვერ მოხერხდა, Medi Coins სრულად დაგიბრუნდება. Zoommer ამ ჯილდოს სპონსორი არ არის.";
const SHOP_TERMS_GADGET = "ახალი, ოფიციალური გარანტიით. თბილისში 14 დღეში გადმოგცემთ — დაგიკავშირდებით ანგარიშის ტელეფონზე. ფულზე ან სხვა ნივთზე არ იცვლება, ფერი მარაგის მიხედვით. მარაგი შეზღუდულია. თუ გადაცემა ვერ მოხერხდა, Medi Coins სრულად დაგიბრუნდება. Apple და Xiaomi ამ ჯილდოების სპონსორები არ არიან.";
const prize = (id, { coinCost, stock, perUser = 1, sortOrder, featured = false, kind = 'GADGET', retailGel }) => ({
  key: `SHOP_${id.toUpperCase()}`,
  type: REWARD_TYPES.PHYSICAL_PRIZE,
  status: REWARD_STATUSES.ACTIVE,
  // The Georgian copy is the key: older app builds print the key as is; newer ones translate it
  // (mobile/src/i18n/quest/rewards.js has these exact strings as keys).
  titleKey: SHOP_TEXT[id].title,
  descriptionKey: SHOP_TEXT[id].description,
  termsKey: kind === 'GIFT_CARD' ? SHOP_TERMS_GIFT_CARD : SHOP_TERMS_GADGET,
  imageKey: `/rewards/${id.replace(/_/g, '-')}.webp`,
  coinCost,
  inventoryMode: INVENTORY_MODES.FINITE,
  inventoryQuantity: stock,
  perUserLimit: perUser,
  periodLimitType: PERIOD_LIMIT_TYPES.LIFETIME,
  periodLimitCount: perUser,
  redemptionExpiryDays: null,
  sortOrder,
  featured,
  metadata: { kind, retailGel, fulfilment: 'MANUAL_TBILISI' },
});

export const SHOP_PRIZES = Object.freeze([
  prize('giftcard_50', { coinCost: 5000, stock: 10, perUser: 2, sortOrder: 100, featured: true, kind: 'GIFT_CARD', retailGel: 50 }),
  prize('buds', { coinCost: 5500, stock: 5, sortOrder: 110, retailGel: 49 }),
  prize('scale', { coinCost: 7500, stock: 3, sortOrder: 120, retailGel: 69 }),
  prize('powerbank', { coinCost: 9000, stock: 5, sortOrder: 130, retailGel: 89 }),
  prize('giftcard_100', { coinCost: 9500, stock: 5, sortOrder: 140, kind: 'GIFT_CARD', retailGel: 100 }),
  prize('redmiwatch', { coinCost: 9500, stock: 3, sortOrder: 150, retailGel: 89 }),
  prize('band', { coinCost: 12500, stock: 3, sortOrder: 160, retailGel: 119 }),
  prize('giftcard_200', { coinCost: 18500, stock: 2, sortOrder: 170, kind: 'GIFT_CARD', retailGel: 200 }),
  prize('airpods', { coinCost: 36000, stock: 2, sortOrder: 180, featured: true, retailGel: 359 }),
  prize('airpodspro', { coinCost: 62000, stock: 1, sortOrder: 190, retailGel: 649 }),
  prize('watch', { coinCost: 70000, stock: 1, sortOrder: 200, featured: true, retailGel: 769 }),
]);

export const REWARD_CATALOG = Object.freeze([
  {
    key: 'MEDI_THEME_7D',
    type: REWARD_TYPES.DIGITAL_PERK,
    status: REWARD_STATUSES.ACTIVE,
    titleKey: 'reward.mediTheme7d.title',
    descriptionKey: 'reward.mediTheme7d.description',
    termsKey: 'reward.mediTheme7d.terms',
    imageKey: 'theme',
    coinCost: 300,
    inventoryMode: INVENTORY_MODES.UNLIMITED,
    perUserLimit: null,
    periodLimitType: PERIOD_LIMIT_TYPES.ROLLING_DAYS,
    periodLimitCount: 1,
    periodWindowDays: 14,
    redemptionExpiryDays: null,
    entitlementKey: ENTITLEMENT_KEYS.QUEST_THEME_PREMIUM,
    entitlementDurationDays: 7,
    sortOrder: 10,
    featured: true,
  },
  {
    key: 'MEDI_PROFILE_STYLE_30D',
    type: REWARD_TYPES.DIGITAL_PERK,
    status: REWARD_STATUSES.ACTIVE,
    titleKey: 'reward.mediProfileStyle30d.title',
    descriptionKey: 'reward.mediProfileStyle30d.description',
    termsKey: 'reward.mediProfileStyle30d.terms',
    imageKey: 'style',
    coinCost: 600,
    inventoryMode: INVENTORY_MODES.UNLIMITED,
    perUserLimit: null,
    periodLimitType: PERIOD_LIMIT_TYPES.NONE,
    periodLimitCount: null,
    periodWindowDays: null,
    redemptionExpiryDays: null,
    entitlementKey: ENTITLEMENT_KEYS.QUEST_PROFILE_STYLE,
    entitlementDurationDays: 30,
    /** Soft rule: max 1 overlapping ACTIVE entitlement for this key. */
    maxActiveEntitlement: 1,
    sortOrder: 20,
    featured: true,
  },
  {
    key: 'PARTNER_TEST_10',
    type: REWARD_TYPES.PARTNER_VOUCHER,
    status: REWARD_STATUSES.DRAFT,
    titleKey: 'reward.partnerTest10.title',
    descriptionKey: 'reward.partnerTest10.description',
    termsKey: 'reward.partnerTest10.terms',
    imageKey: 'partner',
    coinCost: 1500,
    inventoryMode: INVENTORY_MODES.CODE_POOL,
    perUserLimit: 1,
    periodLimitType: PERIOD_LIMIT_TYPES.LIFETIME,
    periodLimitCount: 1,
    redemptionExpiryDays: 30,
    sortOrder: 90,
    featured: false,
    metadata: { purpose: 'DEV_QA_ONLY', neverShowInProduction: true },
  },
  ...SHOP_PRIZES,
]);

export function rewardCatalogSeedRows() {
  return REWARD_CATALOG.map((row) => {
    const { maxActiveEntitlement, ...data } = row;
    return {
      ...data,
      metadata: {
        ...(data.metadata || {}),
        ...(maxActiveEntitlement != null ? { maxActiveEntitlement } : {}),
      },
    };
  });
}
