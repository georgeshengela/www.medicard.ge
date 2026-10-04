/**
 * Haptics for finger-scrubbing a day picker (the /cycle dial, the Home cycle wave): a soft bump when
 * the finger takes hold, a light tick on every new day, a slightly firmer one on today. iOS uses the
 * Taptic engine's selection/impact generators; Android uses view haptics that exist on old devices
 * too (performHapticFeedback respects the system's touch-feedback switch).
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const ignore = () => undefined;

export const scrubHaptics = {
  /** The finger took hold of the picker. */
  grab() {
    if (Platform.OS === 'android') Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key).catch(ignore);
    else if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
  },
  /** The finger moved onto another day. */
  tick() {
    if (Platform.OS === 'android') Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick).catch(ignore);
    else if (Platform.OS === 'ios') Haptics.selectionAsync().catch(ignore);
  },
  /** The finger reached a day that matters (today). */
  landmark() {
    if (Platform.OS === 'android') Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click).catch(ignore);
    else if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
  },
};
