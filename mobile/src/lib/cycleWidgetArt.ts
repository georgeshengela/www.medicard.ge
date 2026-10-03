/**
 * The cycle widget's logo art (variant A, owner pick 2026-10-04): the real MEDICARD logo as PNGs rendered
 * from `assets/logo.svg` by `brand/cycle/widget/render-art.cjs` — a header logo, the neutral tile's centre
 * logo and a full-widget ornament per size / theme / tone.
 *
 * The widget extension cannot read the app's bundled assets, so the app copies them once into the app
 * group folder of expo-widgets (`widgetsDirectory`), which both processes can read; the widget then shows
 * them with `Image(uiImage:)`. The folder is versioned: new art gets a new folder instead of overwriting
 * files a running widget may be reading. iOS only; anything missing → `null` and the widget draws no logo.
 */
import { Platform } from 'react-native';

/** Bump when the PNGs change. */
export const CYCLE_WIDGET_ART_FOLDER = 'cycle-art-v1';

const FILES: Record<string, number> = {
  'logo-rose-light.png': require('../../assets/widget/cycle/logo-rose-light.png'),
  'logo-rose-dark.png': require('../../assets/widget/cycle/logo-rose-dark.png'),
  'logo-teal.png': require('../../assets/widget/cycle/logo-teal.png'),
  'ornament-s-rose-light.png': require('../../assets/widget/cycle/ornament-s-rose-light.png'),
  'ornament-s-rose-dark.png': require('../../assets/widget/cycle/ornament-s-rose-dark.png'),
  'ornament-s-teal-light.png': require('../../assets/widget/cycle/ornament-s-teal-light.png'),
  'ornament-s-teal-dark.png': require('../../assets/widget/cycle/ornament-s-teal-dark.png'),
  'ornament-m-rose-light.png': require('../../assets/widget/cycle/ornament-m-rose-light.png'),
  'ornament-m-rose-dark.png': require('../../assets/widget/cycle/ornament-m-rose-dark.png'),
  'ornament-m-teal-light.png': require('../../assets/widget/cycle/ornament-m-teal-light.png'),
  'ornament-m-teal-dark.png': require('../../assets/widget/cycle/ornament-m-teal-dark.png'),
};

let pending: Promise<string | null> | null = null;
let installed: string | null = null;

async function install(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const base = (require('expo-widgets') as { widgetsDirectory?: string | null }).widgetsDirectory;
    if (!base) return null;
    const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    const { Asset } = require('expo-asset') as typeof import('expo-asset');
    const dir = `${base.endsWith('/') ? base : `${base}/`}${CYCLE_WIDGET_ART_FOLDER}/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    for (const [name, module] of Object.entries(FILES)) {
      const target = dir + name;
      const info = await FileSystem.getInfoAsync(target);
      if (info.exists && (info.size ?? 0) > 0) continue;
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      if (!asset.localUri) return null;
      await FileSystem.copyAsync({ from: asset.localUri, to: target });
    }
    return dir;
  } catch {
    return null;
  }
}

/** The folder URI (file:///…/ExpoWidgets/cycle-art-v1/) once every PNG is in place, else null. */
export function cycleWidgetArtDir(): Promise<string | null> {
  if (installed) return Promise.resolve(installed);
  if (!pending) {
    pending = install().then((dir) => {
      installed = dir;
      pending = null; // a failed copy is tried again on the next sync
      return dir;
    });
  }
  return pending;
}
