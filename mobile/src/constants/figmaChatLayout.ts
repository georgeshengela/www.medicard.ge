import { useIsDark } from '@/theme/colors';

/** Figma 11369:93993 — AI Health Assistant chat tokens. */
export const FIGMA_CHAT = {
  brand: '#14B8A6',
  brandQuaternary: '#F0FDFA',
  brandBorderLight: '#CCFBF1',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textOnBrand: '#FFFFFF',
  border: '#E5E7EB',
  borderTertiary: '#D1D5DB',
  cardBg: '#F9FAFB',
  white: '#FFFFFF',
  inverse: '#1F2937',
  onInverse: '#FFFFFF',
  success: '#22C55E',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  paddingH: 16,
  messageGap: 12,
  bubbleRadius: 16,
  inputRadius: 9999,
  navAvatarPad: 24,
  navIconSize: 28,
  bubbleAvatarPad: 20,
  bubbleIconSize: 24,
  userAvatarSize: 40,
  sendBtnSize: 48,
  shadowSm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  shadowXs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;

/** Dark chat / home-card chrome — same gray-950 stack as login. */
export const FIGMA_CHAT_DARK = {
  brandQuaternary: '#042F2E',
  brandBorderLight: '#115E59',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',
  border: '#374151',
  borderTertiary: '#4B5563',
  cardBg: '#111827',
  white: '#1F2937',
  inverse: '#FFFFFF',
  onInverse: '#111827',
  successBg: '#052E16',
  successBorder: '#166534',
} as const;

export function useFigmaChat() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_CHAT, ...FIGMA_CHAT_DARK } : FIGMA_CHAT;
}
