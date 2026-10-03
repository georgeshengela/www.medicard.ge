/**
 * `/cycle/settings` is a hub with four screens (W2-9, brief §9 wave 2 item 13, [კ-31]):
 * პროფილი · შეხსენებები · კონფიდენციალურობა · მონაცემები, each with its own save.
 *
 * Old links keep working: `/cycle/settings` still opens the hub, and a `?section=` param (any of the
 * names below — the sections of the former one-page settings) opens the matching screen.
 *
 * Pure (no React Native): node tests load it.
 */

export const CYCLE_SETTINGS_SECTIONS = ['profile', 'reminders', 'privacy', 'data'] as const;
export type CycleSettingsSection = (typeof CYCLE_SETTINGS_SECTIONS)[number];

export const CYCLE_SETTINGS_HUB = '/cycle/settings';

/** Every name the old page's sections went by → the screen that holds them now. */
const SECTION_ALIASES: Record<string, CycleSettingsSection> = {
  profile: 'profile',
  mode: 'profile',
  modes: 'profile',
  cycle: 'profile',
  mycycle: 'profile',
  'my-cycle': 'profile',
  lastperiod: 'profile',
  'last-period': 'profile',
  tracking: 'profile',
  fertility: 'profile',
  contraception: 'profile',
  conditions: 'profile',
  pregnancy: 'profile',
  postpartum: 'profile',
  health: 'profile',
  reminders: 'reminders',
  reminder: 'reminders',
  notifications: 'reminders',
  mask: 'reminders',
  privacy: 'privacy',
  lock: 'privacy',
  faceid: 'privacy',
  discreet: 'privacy',
  partner: 'privacy',
  share: 'privacy',
  sharing: 'privacy',
  data: 'data',
  export: 'data',
  calendar: 'data',
  pdf: 'data',
  report: 'data',
  delete: 'data',
  wipe: 'data',
};

/** The screen a `section` param means, or null (unknown / missing → stay on the hub). */
export function cycleSettingsSection(raw: unknown): CycleSettingsSection | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return SECTION_ALIASES[key] ?? SECTION_ALIASES[key.replace(/-/g, '')] ?? null;
}

/** Route of one settings screen; the hub for anything unknown. */
export function cycleSettingsRoute(section?: unknown): string {
  const known = cycleSettingsSection(section);
  return known ? `${CYCLE_SETTINGS_HUB}/${known}` : CYCLE_SETTINGS_HUB;
}

/** Brief [კ-31]: where her history lives, said on the data screen and under the hub (ka + en). */
export const CYCLE_HISTORY_ACCOUNT_LINE = {
  ka: 'ისტორია შენს ანგარიშშია — ახალ ტელეფონზე შესვლისას ყველაფერი ბრუნდება.',
  en: 'Your history lives in your account — sign in on a new phone and everything comes back.',
} as const;
