/**
 * Medi Quest visual system — keep these the only Quest-specific numbers.
 * Colors come from MediCard theme tokens (`useThemeColors`).
 *
 * radius 16     cards (same as Home Card)
 * radius 12     icon wells
 * pad 16        card padding
 * gap 12        stack inside a card
 * icon 36       category well
 * bar 6 / 8 / 10  daily / weekly / XP
 * accent        movement/hydration/Medi stay teal family, not a rainbow
 */
export const QUEST = {
  radius: 16,
  iconRadius: 12,
  icon: 36,
  glyph: 18,
  pad: 16,
  gap: 12,
  barDaily: 6,
  barWeekly: 8,
  barXp: 10,
  homeMinHeight: 176,
  accent: {
    movement: '#0D9488',
    hydration: '#0EA5A4',
    medi: '#14B8A6',
    weekly: '#0F766E',
    success: '#0F8A5F',
  },
} as const;

export type QuestAccentKind = keyof typeof QUEST.accent;
