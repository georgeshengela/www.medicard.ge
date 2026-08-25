/** Nightingale Authentication — exact tokens from Figma node 11396:82867. */
export const FIGMA_AUTH = {
  screenPaddingX: 24,
  heroLogoSize: 96,
  heroTitleSize: 26,
  heroSubtitleSize: 16,
  heroGap: 16,
  heroBottom: 32,
  formFieldGap: 20,
  sectionGap: 32,
  actionsGap: 16,

  /** InputFieldBase */
  inputMinHeight: 48,
  inputRadius: 14,
  inputPaddingX: 12,
  inputPaddingY: 10,
  inputBorder: '#D1D5DB',
  inputBg: '#FFFFFF',
  labelSize: 14,
  labelColor: '#1F2937',

  /** Primary Button (Sign In) — rounded-16, not pill. Same radius for every CTA. */
  primaryBg: '#14B8A6',
  primaryMinHeight: 48,
  primaryRadius: 16,
  primaryPaddingX: 20,
  primaryPaddingY: 12,
  primaryGap: 10,

  /** ButtonSocialMedia (Google) — same 16 radius as primary */
  socialButtonBg: '#1F2937',
  socialButtonMinHeight: 48,
  socialButtonRadius: 16,
  socialButtonPaddingX: 16,
  socialButtonPaddingY: 10,
  socialButtonGap: 12,
  socialIconSize: 24,

  dividerColor: '#E5E7EB',
  textSecondary: '#4B5563',
  textMuted: '#64748B',
  linkColor: '#14B8A6',
} as const;

/** Figma Shadow/xs — shared by inputs and buttons. */
export const FIGMA_AUTH_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 2,
} as const;

export const FIGMA_WELCOME = {
  progressHeight: 4,
  progressGap: 6,
  sheetRadius: 32,
  navButtonSize: 56,
  heroCropHeight: 478,
} as const;
