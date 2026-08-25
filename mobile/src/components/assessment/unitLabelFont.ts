import { Platform } from 'react-native';

/** Labels that must not use Noto Sans Georgian (lbs, ft, 5'7", etc.). */
export function isLatinUnitLabel(label: string) {
  return /[A-Za-z]/.test(label) || /['"]/.test(label);
}

export function unitLabelFontFamily(label: string, active: boolean) {
  if (!isLatinUnitLabel(label)) {
    return active ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold';
  }
  return Platform.select({
    ios: undefined,
    android: active ? 'sans-serif-medium' : 'sans-serif',
    default: undefined,
  });
}
