import { toned } from '@/theme/brandTone';
import { useIsDark, useModuleTone, type ModuleTone } from '@/theme/colors';

/** Figma 11369:93993 — AI Health Assistant chat tokens. */
export const FIGMA_CHAT = toned({
  brand: '#14B8A6',
  brandQuaternary: '#F0FDFA',
  brandBorderLight: '#CCFBF1',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#6B7A80',
  textOnBrand: '#FFFFFF',
  /** Filled send button. */
  sendBg: '#0D9488',
  border: '#E5E7EB',
  borderTertiary: '#D1D5DB',
  cardBg: '#F5F7F7',
  white: '#FFFFFF',
  inverse: '#1F2937',
  onInverse: '#FFFFFF',
  success: '#22C55E',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  paddingH: 16,
  messageGap: 16,
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
} as const);

/** Dark chat / home-card chrome — same gray-950 stack as login. */
export const FIGMA_CHAT_DARK = toned({
  brandQuaternary: '#042F2E',
  brandBorderLight: '#115E59',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',
  border: '#374151',
  borderTertiary: '#4B5563',
  cardBg: '#030712',
  white: '#111827',
  inverse: '#FFFFFF',
  onInverse: '#111827',
  successBg: '#052E16',
  successBorder: '#166534',
} as const);

/** Inside a MEDI module with its own tone (ModuleToneProvider) the chat speaks that colour. */
const MODULE_CHAT: Partial<Record<ModuleTone, { light: Record<string, string>; dark: Record<string, string> }>> = {
  vet: {
    light: { brand: '#0369A1', brandQuaternary: '#E0F2FE', brandBorderLight: '#BAE6FD', sendBg: '#0369A1' },
    dark: { brand: '#0284C7', brandQuaternary: '#0C2A3D', brandBorderLight: '#075985', sendBg: '#0369A1' },
  },
  food: {
    light: { brand: '#047857', brandQuaternary: '#D1FAE5', brandBorderLight: '#A7F3D0', sendBg: '#047857' },
    dark: { brand: '#059669', brandQuaternary: '#022C22', brandBorderLight: '#065F46', sendBg: '#047857' },
  },
};

export function useFigmaChat() {
  const dark = useIsDark();
  const tone = useModuleTone();
  const base = dark ? { ...FIGMA_CHAT, ...FIGMA_CHAT_DARK } : FIGMA_CHAT;
  const toned = tone ? MODULE_CHAT[tone] : undefined;
  return toned ? { ...base, ...toned[dark ? 'dark' : 'light'] } : base;
}
