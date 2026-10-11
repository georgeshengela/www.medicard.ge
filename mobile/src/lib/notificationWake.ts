import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type NotificationWakeModule = { release(): void };

/**
 * iOS: expo-notifications tells iOS a button's response is handled before any JS runs, so iOS may
 * suspend the app while „მივიღე ✓“ is still being saved. From train 22 the binary's
 * MedicardNotificationWake module (mobile/modules/notification-wake) takes background time when such
 * a button is tapped; this ends it once the answer is saved (it ends by itself after 25 s). Binaries
 * without the module: nothing to do.
 */
export function releaseNotificationWake(): void {
  if (Platform.OS !== 'ios') return;
  try {
    requireOptionalNativeModule<NotificationWakeModule>('MedicardNotificationWake')?.release();
  } catch {
    /* the native time ends by itself */
  }
}
