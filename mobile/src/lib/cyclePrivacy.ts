import * as LocalAuthentication from 'expo-local-authentication';
import { isCyclePrivacyLockEnabled } from '@/lib/cycleReminderPrefs';
import { ka } from '@/i18n/ka';

export async function requireCycleUnlock(): Promise<boolean> {
  const enabled = await isCyclePrivacyLockEnabled();
  if (!enabled) return true;

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return true;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: ka.cycle.privacyUnlock,
    cancelLabel: ka.common.cancel,
    disableDeviceFallback: false,
  });

  return result.success;
}
