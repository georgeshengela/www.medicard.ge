/**
 * Alternate home-screen icons (owner 2026-10-03, train 1.0.0.20 — native module, store build only;
 * owner 2026-10-04: sixteen more in train 1.0.0.21 — the feminine set and styles from `brand/app-icons/`).
 *
 * The icons live in the binary (`expo-alternate-app-icons` plugin in app.json); this file only picks
 * one. iOS shows its own one-line „icon changed“ alert — Apple's rule, it cannot be hidden.
 * Android is off for now: the library swaps launcher activity-aliases and disables MainActivity,
 * which can break `medicard://` deep links until that is verified on devices.
 *
 * Older binaries (no native module) and web report `supported: false`, so the setting never shows
 * there — an OTA of this file into train 19 would simply hide the row.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { tx } from '@/i18n/locale';

export type AppIconId =
  | 'classic' | 'rose' | 'midnight' | 'pearl' | 'gold'
  | 'chukurtma' | 'silk' | 'orchid' | 'lavender' | 'cherry' | 'sage'
  | 'glass' | 'neon' | 'paper' | 'marble' | 'city' | 'holo' | 'watercolor' | 'puffy' | 'pixel' | 'topo';

export type AppIconGroup = 'core' | 'women' | 'styles';

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
  // Expo Go and binaries before train 20 have no module: ask first, so nothing throws or logs
  // „Cannot find native module 'ExpoAlternateAppIcons'“ (same check as otaUpdates.ts).
  if (!requireOptionalNativeModule('ExpoAlternateAppIcons')) return native;
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
  rose: 'Rose',
  midnight: 'Midnight',
  pearl: 'Pearl',
  gold: 'Gold',
  chukurtma: 'Chukurtma',
  silk: 'Silk',
  orchid: 'Orchid',
  lavender: 'Lavender',
  cherry: 'Cherry',
  sage: 'Sage',
  glass: 'Glass',
  neon: 'Neon',
  paper: 'Paper',
  marble: 'Marble',
  city: 'City',
  holo: 'Holo',
  watercolor: 'Watercolor',
  puffy: 'Puffy',
  pixel: 'Pixel',
  topo: 'Topo',
};

/** The store train whose binary first carries an icon (train 20 shipped the first five). */
const TRAIN_21: AppIconId[] = ['chukurtma', 'silk', 'orchid', 'lavender', 'cherry', 'sage', 'glass', 'neon', 'paper', 'marble', 'city', 'holo', 'watercolor', 'puffy', 'pixel', 'topo'];

export type AppIconInfo = { id: AppIconId; group: AppIconGroup; name: string; note: string; thumb: ImageSourcePropType };

const ALL_ICONS: AppIconInfo[] = [
  { id: 'classic', group: 'core', name: tx('კლასიკური', 'Classic'), note: tx('ფირუზისფერი MEDICARD — ნაგულისხმევი აიქონი.', 'Teal MEDICARD — the default icon.'), thumb: require('../../assets/app-icons/thumb/classic.png') },
  { id: 'rose', group: 'core', name: tx('ვარდისფერი', 'Rose'), note: tx('ვარდისფერი გრადიენტი თეთრი ლოგოთი.', 'A pink gradient with a white mark.'), thumb: require('../../assets/app-icons/thumb/rose.png') },
  { id: 'midnight', group: 'core', name: tx('ღამე', 'Midnight'), note: tx('მუქი ღამე და მანათობელი ფირუზისფერი.', 'Deep night with a glowing teal mark.'), thumb: require('../../assets/app-icons/thumb/midnight.png') },
  { id: 'pearl', group: 'core', name: tx('მარგალიტი', 'Pearl'), note: tx('თითქმის თეთრი — სუფთა და მსუბუქი.', 'Almost white — clean and light.'), thumb: require('../../assets/app-icons/thumb/pearl.png') },
  { id: 'gold', group: 'core', name: tx('ოქრო', 'Gold'), note: tx('ოქროს ლოგო მუქ მწვანეზე.', 'A gold mark on deep green.'), thumb: require('../../assets/app-icons/thumb/gold.png') },
  { id: 'chukurtma', group: 'women', name: tx('ჩუქურთმა', 'Chukurtma'), note: tx('ოქროს ქართული ჩუქურთმა საფერავისფერ ფონზე.', 'Gold Georgian ornament on deep wine.'), thumb: require('../../assets/app-icons/thumb/chukurtma.png') },
  { id: 'silk', group: 'women', name: tx('აბრეშუმი', 'Silk'), note: tx('ვარდისფერი აბრეშუმი და rose-gold ლოგო.', 'Blush silk with a rose-gold mark.'), thumb: require('../../assets/app-icons/thumb/silk.png') },
  { id: 'orchid', group: 'women', name: tx('ორქიდეა', 'Orchid'), note: tx('ღამის ორქიდეა და მარგალიტისფერი ლოგო.', 'Night orchid with a pearly mark.'), thumb: require('../../assets/app-icons/thumb/orchid.png') },
  { id: 'lavender', group: 'women', name: tx('ლავანდა', 'Lavender'), note: tx('iPhone 17-ის ლავანდა და თეთრი მინის ლოგო.', 'iPhone 17 Lavender with a white glass mark.'), thumb: require('../../assets/app-icons/thumb/lavender.png') },
  { id: 'cherry', group: 'women', name: tx('ალუბალი', 'Cherry'), note: tx('ალუბლისფერი წითელი და თეთრი მინა.', 'Cherry red with white glass.'), thumb: require('../../assets/app-icons/thumb/cherry.png') },
  { id: 'sage', group: 'women', name: tx('პიტნა', 'Sage'), note: tx('მშვიდი პიტნისფერი და თბილი თეთრი.', 'Calm sage with warm white.'), thumb: require('../../assets/app-icons/thumb/sage.png') },
  { id: 'glass', group: 'styles', name: tx('მინა', 'Glass'), note: tx('გამჭვირვალე მინა ფერად ნისლში.', 'Clear glass over a coloured haze.'), thumb: require('../../assets/app-icons/thumb/glass.png') },
  { id: 'neon', group: 'styles', name: tx('ნეონი', 'Neon'), note: tx('ფირუზისფერი ნეონის აბრა ღამეში.', 'A teal neon sign at night.'), thumb: require('../../assets/app-icons/thumb/neon.png') },
  { id: 'paper', group: 'styles', name: tx('ქაღალდი', 'Paper'), note: tx('ფენებად ამოჭრილი ქაღალდი.', 'A layered paper cut-out.'), thumb: require('../../assets/app-icons/thumb/paper.png') },
  { id: 'marble', group: 'styles', name: tx('მარმარილო', 'Marble'), note: tx('თეთრი მარმარილო და ოქროს არშია.', 'White marble with a gold edge.'), thumb: require('../../assets/app-icons/thumb/marble.png') },
  { id: 'city', group: 'styles', name: tx('ღამის ქალაქი', 'Night city'), note: tx('MEDIRUN-ის ქალაქი, რომელიც ინთება.', 'The MEDIRUN city lighting up.'), thumb: require('../../assets/app-icons/thumb/city.png') },
  { id: 'holo', group: 'styles', name: tx('ჰოლოგრამა', 'Hologram'), note: tx('ჰოლოგრაფიული ფოლგა და ქრომი.', 'Holographic foil and chrome.'), thumb: require('../../assets/app-icons/thumb/holo.png') },
  { id: 'watercolor', group: 'styles', name: tx('აკვარელი', 'Watercolour'), note: tx('აკვარელი და ფუნჯით დახატული ლოგო.', 'Watercolour with a brushed mark.'), thumb: require('../../assets/app-icons/thumb/watercolor.png') },
  { id: 'puffy', group: 'styles', name: '3D', note: tx('რბილი, გაბერილი 3D ლოგო.', 'A soft, puffy 3D mark.'), thumb: require('../../assets/app-icons/thumb/puffy.png') },
  { id: 'pixel', group: 'styles', name: tx('პიქსელი', 'Pixel'), note: tx('8-ბიტიანი თამაშის პიქსელები.', '8-bit game pixels.'), thumb: require('../../assets/app-icons/thumb/pixel.png') },
  { id: 'topo', group: 'styles', name: tx('ტოპოგრაფია', 'Topography'), note: tx('რუკის იზოხაზები ლოგოს გარშემო.', 'Map contour lines around the mark.'), thumb: require('../../assets/app-icons/thumb/topo.png') },
];

/** Store train of this binary (runtimeVersion `G.0.0.B`); null in development builds. */
function binaryTrain(): number | null {
  if (!requireOptionalNativeModule('ExpoUpdates')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = (require('expo-updates') as typeof import('expo-updates')).runtimeVersion;
    const train = Number(String(runtime ?? '').split('.')[3]);
    return Number.isFinite(train) && train > 0 ? train : null;
  } catch {
    return null;
  }
}

/**
 * Icons this binary can switch to: iOS only switches to icons compiled into the app, so an OTA of
 * this file into train 20 must not offer the train-21 ones.
 */
export const APP_ICONS: AppIconInfo[] = (() => {
  const train = binaryTrain();
  return ALL_ICONS.filter((icon) => train === null || train >= 21 || !TRAIN_21.includes(icon.id));
})();

export const APP_ICON_GROUPS: { id: AppIconGroup; title: string }[] = [
  { id: 'core', title: tx('კლასიკური', 'Classic') },
  { id: 'women', title: tx('ქალური', 'Feminine') },
  { id: 'styles', title: tx('სტილები', 'Styles') },
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
