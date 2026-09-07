/**
 * Medi Quest visual system — keep these the only Quest-specific numbers.
 * Colors come from MediCard theme tokens (`useThemeColors`) except the
 * teal-family accents and washes below.
 *
 * radius 24     hero / hub cards (same as Home weather + hydration cards)
 * radius 16     list rows (same as Home Card)
 * radius 12     icon wells
 * pad 16        card padding
 * gap 12        stack inside a card
 * icon 40       category well
 * bar 6 / 8 / 10  daily / weekly / XP
 * ring 64 / 96  Home level ring / hub level ring (6 / 8 stroke)
 * accent        movement/hydration/Medi stay teal family, not a rainbow
 */
export const QUEST = {
  radius: 24,
  rowRadius: 16,
  iconRadius: 12,
  icon: 40,
  glyph: 19,
  pad: 16,
  gap: 12,
  barDaily: 6,
  barWeekly: 8,
  barXp: 10,
  ringHome: 64,
  ringHub: 96,
  ringSheet: 120,
  homeMinHeight: 176,
  accent: {
    movement: '#0D9488',
    hydration: '#0EA5A4',
    medi: '#14B8A6',
    weekly: '#0F766E',
    success: '#0F8A5F',
  },
  /** Soft brand tint behind icon wells and hero washes. */
  wash: {
    light: '#CCFBF1',
    dark: '#042F2E',
    lightSoft: '#F0FDFA',
    darkSoft: '#0B2A28',
  },
  /** Reward pill fills (XP = brand, coins = warm amber like the streak chip). */
  pill: {
    xpLight: '#E6FAF6',
    xpDark: '#0B2A28',
    coinLight: '#FBF0DE',
    coinDark: '#3A2A0B',
    coinInkLight: '#B87400',
    coinInkDark: '#FBBF24',
  },
  motion: {
    fast: 180,
    base: 320,
    slow: 620,
    stagger: 60,
  },
  /**
   * Phase 4 — achievement rarity palette. Teal stays the brand base;
   * rarity climbs from quiet gray to warm legendary amber.
   * ink = icon/badge color, fill = medallion wash (light/dark).
   */
  rarity: {
    COMMON: { ink: '#64748B', inkDark: '#94A3B8', fillLight: '#F1F5F9', fillDark: '#1E293B' },
    UNCOMMON: { ink: '#0D9488', inkDark: '#2DD4BF', fillLight: '#CCFBF1', fillDark: '#042F2E' },
    RARE: { ink: '#2563EB', inkDark: '#60A5FA', fillLight: '#DBEAFE', fillDark: '#172554' },
    EPIC: { ink: '#7C3AED', inkDark: '#A78BFA', fillLight: '#EDE9FE', fillDark: '#2E1065' },
    LEGENDARY: { ink: '#B45309', inkDark: '#FBBF24', fillLight: '#FEF3C7', fillDark: '#3A2A0B' },
  },
} as const;

export type QuestAccentKind = keyof typeof QUEST.accent;
export type QuestRarity = keyof typeof QUEST.rarity;
