/**
 * Alternate home-screen icons (owner 2026-10-03, train 1.0.0.20 — native module, store build only).
 *
 * The icons live in the binary (`expo-alternate-app-icons` plugin in app.json); this file only picks
 * one. iOS shows its own one-line „icon changed“ alert — Apple's rule, it cannot be hidden.
 * Android is off for now: the library swaps launcher activity-aliases and disables MainActivity,
 * which can break `medicard://` deep links until that is verified on devices.
 *
 * Older binaries (no native module) and web report `supported: false`, so the setting never shows
 * there — an OTA of this file into train 19 would simply hide the row.
 */
import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { tx } from '@/i18n/locale';

export type AppIconId = 'classic' | 'midnight' | 'rose' | 'pearl' | 'gold' | 'calendar' | 'flower';

type NativeIcons = {
  supportsAlternateIcons: boolean;
  setAlternateAppIcon: (name: string | null) => Promise<string | null>;
  getAppIconName: () => string | null;
};

let native: NativeIcons | null | undefined;
function nativeIcons(): NativeIcons | null {
  if (native !== undefined) return native;
  native = null;
  if (Platform.OS !== 'ios') return native;
  try {
    // Lazy: a binary without the module throws here instead of at app start.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-alternate-app-icons') as NativeIcons;
    native = mod?.supportsAlternateIcons ? mod : null;
  } catch {
    native = null;
  }
  return native;
}

/** Native icon names (PascalCase, as registered in app.json); classic = the default icon (`null`). */
const NATIVE_NAME: Record<AppIconId, string | null> = {
  classic: null,
  midnight: 'Midnight',
  rose: 'Rose',
  pearl: 'Pearl',
  gold: 'Gold',
  calendar: 'Calendar',
  flower: 'Flower',
};

/**
 * „კალენდარი“ and „ყვავილი“ are the discreet pair (cycle brief [კ-32], train 1.0.0.20): neutral pictures
 * with no cycle symbol and no brand text, so the phone does not say which app it is.
 */
export const DISCREET_APP_ICONS: readonly AppIconId[] = ['calendar', 'flower'];

export const APP_ICONS: { id: AppIconId; name: string; thumb: ImageSourcePropType }[] = [
  { id: 'classic', name: tx('კლასიკური', 'Classic'), thumb: require('../../assets/app-icons/thumb/classic.png') },
  { id: 'rose', name: tx('ვარდისფერი', 'Rose'), thumb: require('../../assets/app-icons/thumb/rose.png') },
  { id: 'midnight', name: tx('ღამე', 'Midnight'), thumb: require('../../assets/app-icons/thumb/midnight.png') },
  { id: 'pearl', name: tx('მარგალიტი', 'Pearl'), thumb: require('../../assets/app-icons/thumb/pearl.png') },
  { id: 'gold', name: tx('ოქრო', 'Gold'), thumb: require('../../assets/app-icons/thumb/gold.png') },
  { id: 'calendar', name: tx('კალენდარი', 'Calendar'), thumb: require('../../assets/app-icons/thumb/calendar.png') },
  { id: 'flower', name: tx('ყვავილი', 'Flower'), thumb: require('../../assets/app-icons/thumb/flower.png') },
];

export function appIconsSupported(): boolean {
  return nativeIcons() !== null;
}

/** The icon on the home screen now. */
export function currentAppIcon(): AppIconId {
  const name = nativeIcons()?.getAppIconName() ?? null;
  const match = (Object.keys(NATIVE_NAME) as AppIconId[]).find((id) => NATIVE_NAME[id] === name);
  return match ?? 'classic';
}

/** Switches the home-screen icon; resolves to the icon now in place (unchanged on failure). */
export async function setAppIcon(id: AppIconId): Promise<AppIconId> {
  const mod = nativeIcons();
  if (!mod) return 'classic';
  try {
    await mod.setAlternateAppIcon(NATIVE_NAME[id]);
  } catch {
    /* iOS refuses while the app is not active, or the user is in a restricted mode */
  }
  return currentAppIcon();
}
